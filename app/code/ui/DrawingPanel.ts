"use strict";

import { Offcanvas } from "bootstrap";

/**
 * Bottom toolbar for freehand drawing: stroke color, width, eraser, clear.
 * Builds its own DOM and keeps Bootstrap Offcanvas lifecycle internal.
 */
export class DrawingPanel {
   readonly element: HTMLElement;
   readonly btnEraser: HTMLButtonElement;
   readonly btnClear: HTMLButtonElement;

   #offcanvas: Offcanvas | null = null;

   static readonly strokeWidthMin = 2;
   static readonly strokeWidthMax = 28;
   static readonly strokeWidthDefault = 5;

   static readonly #palette = [
      { id: "btnDrawingColorRed", hex: "#dc3545", label: "Rot" },
      { id: "btnDrawingColorGreen", hex: "#198754", label: "Grün" },
      { id: "btnDrawingColorBlue", hex: "#0d6efd", label: "Blau" },
      { id: "btnDrawingColorYellow", hex: "#ffc107", label: "Gelb" },
      { id: "btnDrawingColorOrange", hex: "#fd7e14", label: "Orange" },
      { id: "btnDrawingColorViolet", hex: "#6f42c1", label: "Violett" },
   ] as const;

   static #colorGroupHtml(): string {
      return DrawingPanel.#palette
         .map(
            (c, i) => `
         <input type="radio" class="btn-check" name="DrawingColor" id="${c.id}" value="${c.hex}" autocomplete="off" ${i === 0 ? "checked" : ""} />
         <label class="btn btn-outline-light drawing-panel-color-label" for="${c.id}" title="${c.label}">
            <span class="drawing-panel-swatch" style="background-color:${c.hex}" aria-hidden="true"></span>
            <span class="visually-hidden">${c.label}</span>
         </label>`
         )
         .join("");
   }

   static #markup(): string {
      return `
<div id="drawingPanel" class="offcanvas offcanvas-bottom drawing-panel rounded-top-3 toolbar-shadow border-0" tabindex="-1" data-bs-scroll="true" data-bs-backdrop="false" aria-labelledby="drawingPanelTitle">
   <div class="offcanvas-body drawing-panel-body">
      <div class="btn-group btn-group-sm" role="group" aria-label="Zeichenfarbe">${DrawingPanel.#colorGroupHtml()}
      </div>
      <div class="drawing-panel-width d-flex align-items-center gap-2 flex-shrink-0" role="group" aria-label="Strichstärke">
         <label for="drawingStrokeWidth" class="drawing-panel-width-label user-select-none mb-0">Stärke</label>
         <input type="range" class="form-range drawing-panel-range" id="drawingStrokeWidth" min="${DrawingPanel.strokeWidthMin}" max="${DrawingPanel.strokeWidthMax}" step="1" value="${DrawingPanel.strokeWidthDefault}" />
      </div>
      <div>
      <button id="btnDrawingEraser" type="button" class="btn btn-secondary btn-nav drawing-panel-tool-btn" title="Radierer" aria-label="Radierer">
         <i class="bi bi-eraser-fill" aria-hidden="true"></i>
      </button>
      <button id="btnDrawingClear" type="button" class="btn btn-secondary btn-nav drawing-panel-tool-btn" title="Alle Zeichnungen löschen" aria-label="Alle Zeichnungen löschen">
         <i class="bi bi-trash3-fill" aria-hidden="true"></i>
      </button>
      </div>
   </div>
</div>`;
   }

   constructor(parent: HTMLElement = document.body) {
      let root = document.getElementById("drawingPanel") as HTMLElement | null;
      if (!root) {
         const frag = document.createElement("template");
         frag.innerHTML = DrawingPanel.#markup().trim();
         root = frag.content.firstElementChild as HTMLElement;
         parent.appendChild(root);
      }
      this.element = root;
      this.btnEraser = root.querySelector("#btnDrawingEraser") as HTMLButtonElement;
      this.btnClear = root.querySelector("#btnDrawingClear") as HTMLButtonElement;
   }

   getOffcanvas(): Offcanvas {
      if (!this.#offcanvas) this.#offcanvas = Offcanvas.getOrCreateInstance(this.element);
      return this.#offcanvas;
   }

   show(): void {
      this.getOffcanvas().show();
   }

   hide(): void {
      this.getOffcanvas().hide();
   }

   getStrokeColor(): string {
      const el = this.element.querySelector<HTMLInputElement>('input[name="DrawingColor"]:checked');
      return el?.value ?? DrawingPanel.#palette[0].hex;
   }

   getStrokeWidth(): number {
      const el = this.element.querySelector<HTMLInputElement>("#drawingStrokeWidth");
      const raw = Number(el?.value ?? DrawingPanel.strokeWidthDefault);
      if (!Number.isFinite(raw)) return DrawingPanel.strokeWidthDefault;
      return Math.min(DrawingPanel.strokeWidthMax, Math.max(DrawingPanel.strokeWidthMin, raw));
   }

   setEraserActive(active: boolean): void {
      this.btnEraser.classList.toggle("active", active);
   }
}
