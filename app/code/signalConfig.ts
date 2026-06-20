"use strict";

// ES6 Module imports
import 'bootstrap/dist/css/bootstrap.min.css';
import * as bootstrap from 'bootstrap';
import { EditorView, basicSetup } from 'codemirror';
import { json } from '@codemirror/lang-json';
import { EditorState } from '@codemirror/state';

import { Application } from './application.ts';
import { Signal } from './signal.ts';
import { Sig_UI } from './sig_ui.ts';
import { STORAGE } from './storage.ts';
import { buildSignalTemplate } from './signalDefinitionBuilder.ts';
import { signalDefinitions } from './signal_library.ts';
import { SignalRenderer } from './rendering/signalRenderer.ts';
import { createPixiApplicationWithViewport } from './pixiPrimitives.ts';
import { CONFIG, INPUT, PATHS } from './config.ts';

// Make Bootstrap available globally for data-attribute API (tabs, dropdowns in the reused menus)
(window as any).bootstrap = bootstrap;
(window as any).VERSION = CONFIG.VERSION;

// This page never persists anything – stub out save so reused editor code can never overwrite the
// user's saved track plan in localStorage.
STORAGE.save = () => {};
STORAGE.saveUndoHistory = () => {};

let app: Application;
let pixiApp: any;
let viewport: any;
let configView: EditorView;
let atlasView: EditorView;

let currentSignal: any = null;
let currentContainer: any = null;
let errorToast: any = null;

/** Show an error as a Bootstrap toast at the bottom that only closes manually (or on next render). */
function showError(message: string) {
   hideError();
   const container = document.getElementById("scToastContainer")!;
   const toastEl = document.createElement("div");
   toastEl.className = "toast align-items-center text-bg-danger border-0";
   toastEl.setAttribute("role", "alert");
   toastEl.setAttribute("aria-live", "assertive");
   toastEl.setAttribute("aria-atomic", "true");

   const body = document.createElement("div");
   body.className = "toast-body";
   body.textContent = message;
   const closeBtn = document.createElement("button");
   closeBtn.type = "button";
   closeBtn.className = "btn-close btn-close-white me-2 m-auto";
   closeBtn.setAttribute("data-bs-dismiss", "toast");
   closeBtn.setAttribute("aria-label", "Schließen");

   const flex = document.createElement("div");
   flex.className = "d-flex";
   flex.append(body, closeBtn);
   toastEl.append(flex);
   container.append(toastEl);

   toastEl.addEventListener("hidden.bs.toast", () => toastEl.remove());
   errorToast = new bootstrap.Toast(toastEl, { autohide: false });
   errorToast.show();
}

function hideError() {
   if (errorToast) {
      errorToast.hide();
      errorToast = null;
   }
}

function setReadOnlyDoc(view: EditorView, text: string) {
   view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: text } });
}

/**
 * Anchor the signal by its bottom-center to a fixed point in viewport space. The pivot is a fixed
 * point in the signal's own coordinate system, so the bottom stays put even when an aspect changes
 * the signal's height (no jumping). Only called once per render – aspect redraws leave it untouched.
 */
function anchorContainer() {
   if (!currentContainer) return;
   const b = currentContainer.getLocalBounds();
   currentContainer.pivot.set(b.x + b.width / 2, b.y + b.height);
   currentContainer.position.set(0, 0);
}

/** Reset pan/zoom so the freshly rendered signal sits centered above the bottom of the canvas. */
function frameViewport() {
   if (!currentContainer) return;
   const b = currentContainer.getLocalBounds();
   const displayHeight = b.height * currentContainer.scale.y;
   const target = pixiApp.screen.height * 0.8;
   let scale = displayHeight > 0 ? target / displayHeight : 1;
   scale = Math.min(Math.max(CONFIG.MIN_SCALE, scale), CONFIG.MAX_SCALE);
   viewport.scale.set(scale);
   viewport.position.set(pixiApp.screen.width / 2, pixiApp.screen.height * 0.9);
}

/** Wheel zoom around the cursor – mirrors RenderingManager.zoom. */
function zoomAt(deltaY: number, x: number, y: number) {
   const point = { x, y };
   const local = viewport.toLocal(point);
   const oldScale = viewport.scale.x;
   const step = deltaY / (INPUT.ZOOM_STEP_DIVISOR / oldScale);
   const nextScale = Math.min(Math.max(CONFIG.MIN_SCALE, oldScale - step), CONFIG.MAX_SCALE);
   viewport.scale.set(nextScale);
   if (viewport.scale.x !== oldScale) {
      const global = viewport.toGlobal(local);
      viewport.x -= global.x - point.x;
      viewport.y -= global.y - point.y;
   }
}

/** Show the hovered position in the signal's own (atlas) coordinate space in the corner overlay. */
function updateCoords(canvas: HTMLCanvasElement, e: PointerEvent) {
   const el = document.getElementById("previewCoords")!;
   if (!currentContainer) {
      el.textContent = "";
      return;
   }
   const rect = canvas.getBoundingClientRect();
   const local = currentContainer.toLocal({ x: e.clientX - rect.left, y: e.clientY - rect.top });
   el.textContent = `x: ${Math.round(local.x)}  y: ${Math.round(local.y)}`;
}

function setupPanZoom(canvas: HTMLCanvasElement) {
   let dragging = false;
   let lastX = 0;
   let lastY = 0;

   canvas.addEventListener("wheel", (e) => {
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      zoomAt(e.deltaY, e.clientX - rect.left, e.clientY - rect.top);
   }, { passive: false });

   canvas.addEventListener("pointerdown", (e) => {
      dragging = true;
      lastX = e.clientX;
      lastY = e.clientY;
      canvas.setPointerCapture(e.pointerId);
   });
   canvas.addEventListener("pointermove", (e) => {
      updateCoords(canvas, e);
      if (!dragging) return;
      viewport.x += e.clientX - lastX;
      viewport.y += e.clientY - lastY;
      lastX = e.clientX;
      lastY = e.clientY;
   });
   const endDrag = (e: PointerEvent) => {
      dragging = false;
      try { canvas.releasePointerCapture(e.pointerId); } catch { /* ignore */ }
   };
   canvas.addEventListener("pointerup", endDrag);
   canvas.addEventListener("pointercancel", endDrag);
   canvas.addEventListener("pointerleave", () => {
      document.getElementById("previewCoords")!.textContent = "";
   });
   canvas.addEventListener("contextmenu", (e) => e.preventDefault());
}

function resizePreview() {
   const wrap = document.getElementById("previewCanvasWrap")!;
   pixiApp.renderer.resize(wrap.clientWidth, wrap.clientHeight);
}

/**
 * Build a signal from the edited JSON and (re)render it together with its aspect/config menus.
 * When `preserveState` is set (re-rendering the same signal after a JSON edit), the current aspect
 * state is carried over so toggled aspects/configuration survive the re-render.
 */
function renderSignal(preserveState = false) {
   hideError();
   const text = configView.state.doc.toString();

   const savedStellung = preserveState && currentSignal ? { ...currentSignal._signalStellung } : null;

   let definition: any;
   try {
      definition = JSON.parse(text);
   } catch (e: any) {
      showError("JSON-Fehler: " + e.message);
      return;
   }

   try {
      const template = buildSignalTemplate(definition);
      const signal = new Signal(template);
      if (savedStellung) signal._signalStellung = { ...savedStellung };

      app.selection.object = signal;
      app.selection.type = "Signal";
      currentSignal = signal;

      viewport.removeChildren();
      currentContainer = SignalRenderer.createSignalContainer(app.renderingManager as any, signal, false);
      viewport.addChild(currentContainer);
      anchorContainer();
      frameViewport();

      Sig_UI.initSignalAspectsMenu(signal);
      Sig_UI.initSignalConfigurationMenu();
      Sig_UI.syncSignalMenu(signal);
   } catch (e: any) {
      showError("Render-Fehler: " + (e?.message ?? String(e)));
   }
}

/** Load the read-only atlas image + manifest JSON for the given atlas name. */
async function loadAtlas(atlas: string) {
   const version = (window as any).VERSION;
   (document.getElementById("atlasImage") as HTMLImageElement).src = `${PATHS.IMAGES}/${atlas}.png?${version}`;
   try {
      const res = await fetch(`${PATHS.IMAGES}/${atlas}.json?${version}`);
      const txt = await res.text();
      setReadOnlyDoc(atlasView, txt);
   } catch {
      setReadOnlyDoc(atlasView, "// Atlas konnte nicht geladen werden");
   }
}

/** Select an existing configuration: fill the editor, show its atlas, render it. */
function loadTemplate(key: string) {
   const definition = signalDefinitions[key];
   if (!definition) return;
   setReadOnlyDoc(configView, JSON.stringify(definition, null, 3));
   loadAtlas(definition.atlas);
   renderSignal();
}

function populateSelect() {
   const select = document.getElementById("templateSelect") as HTMLSelectElement;
   Object.keys(signalDefinitions).forEach((key) => {
      const option = document.createElement("option");
      option.value = key;
      option.textContent = `${signalDefinitions[key].title} (${key})`;
      select.appendChild(option);
   });
   select.addEventListener("change", () => loadTemplate(select.value));
   return select;
}

$(async () => {
   try {
      app = Application.getInstance();
      (window as any).app = app;
      await app.initializeForSignalPreview();

      const canvas = document.getElementById("previewCanvas") as HTMLCanvasElement;
      const created = await createPixiApplicationWithViewport(canvas);
      pixiApp = created.app;
      viewport = created.viewport;
      app.renderingManager!.attachExternalPixiApp(pixiApp);
      setupPanZoom(canvas);

      configView = new EditorView({
         doc: "",
         extensions: [basicSetup, json()],
         parent: document.getElementById("configEditor")!,
      });
      atlasView = new EditorView({
         doc: "",
         extensions: [basicSetup, json(), EditorState.readOnly.of(true), EditorView.editable.of(false)],
         parent: document.getElementById("atlasEditor")!,
      });

      // Redraw the preview whenever an aspect/configuration changes through the reused menus.
      app.eventManager!.on("signalAspectChanged", ({ signal }: { signal: any }) => {
         if (signal !== currentSignal || !currentContainer) return;
         // Redraw only – the bottom-anchored pivot and the user's pan/zoom stay untouched.
         signal.draw(currentContainer);
         Sig_UI.syncSignalMenu(signal);
      });

      document.getElementById("btnRender")!.addEventListener("click", () => renderSignal(true));

      const select = populateSelect();
      resizePreview();
      window.addEventListener("resize", resizePreview);

      if (select.value) loadTemplate(select.value);
   } catch (error) {
      console.error("Failed to initialize signal configuration page:", error);
      showError("Initialisierung fehlgeschlagen: " + ((error as any)?.message ?? String(error)));
   }
});
