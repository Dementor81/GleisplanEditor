"use strict";

// ES6 Module imports
import { Collapse, Modal } from "bootstrap";
import { COMPUTED, CUSTOM_MOUSE_ACTION, MENU } from "../config.ts";
import { STORAGE } from "../storage.ts";
import { ui } from "../ui.ts";
import { Point, geometry } from "../tools.ts";
import { NumberUtils } from "../utils.ts";
import { Sig_UI } from "../sig_ui.ts";
import { Track } from "../track.ts";
import { Application } from "../application.ts";
import type { FederatedPointerEvent } from "pixi.js";
import { DrawingPanel } from "../ui/DrawingPanel.ts";
import { DRAWING_MODE_CURSORS } from "../ui/drawingCursors.ts";
import type { PointerInteraction } from "../interactions/PointerInteraction.ts";
import { DrawingInteraction } from "../interactions/DrawingInteraction.ts";
import { EraserInteraction } from "../interactions/EraserInteraction.ts";
import { PlatformPlaceInteraction } from "../interactions/PlatformPlaceInteraction.ts";
import { SignalTemplateInteraction } from "../interactions/SignalTemplateInteraction.ts";
import { TextPlaceInteraction } from "../interactions/TextPlaceInteraction.ts";
import { TrackBuildInteraction } from "../interactions/TrackBuildInteraction.ts";
import { TrainCoupleModeCancelInteraction } from "../interactions/TrainCoupleModeCancelInteraction.ts";
import { TrainPlaceInteraction } from "../interactions/TrainPlaceInteraction.ts";
import { ViewportScrollInteraction } from "../interactions/ViewportScrollInteraction.ts";

/**
 * EventManager handles all event-related functionality
 * This class centralizes event handling and provides a clean API for event management
 *
 * Event System:
 * - Supports multiple listeners per event using the 'on' method
 * - Emits events using the 'emit' method
 *
 * Example Usage:
 * ```javascript
 * // Register a listener
 * eventManager.on('rendererChanged', (data) => {
 *    console.log('Renderer changed to:', data.advanced);
 * });
 *
 * // Emit an event
 * eventManager.emit('rendererChanged', { advanced: true });
 * ```
 */
export class EventManager {
   #app: Application;
   #drawingPanel: DrawingPanel;
   #eventListeners: Map<string, Function[]> = new Map();
   #mainCanvas: HTMLCanvasElement = (window as any).myCanvas as HTMLCanvasElement;

   #previousTouch: Touch | null = null;
   #activeInteraction: PointerInteraction | null = null;

   // Store bound function references for proper event listener removal
   #boundHandleStagePointerDown: (event: FederatedPointerEvent) => void = () => { };
   #boundHandleStagePointerUp: (event: FederatedPointerEvent) => void = () => { };
   #boundHandleStageGlobalPointerMove: (event: FederatedPointerEvent) => void = () => { };
   #boundHandleWheelEvent: (event: WheelEvent) => void = () => { };
   #boundHandleKeyDown: (event: KeyboardEvent) => void = () => { };
   #boundHandleWindowResize: () => void = () => { };
   #boundHandleTouchStart: (event: TouchEvent) => void = () => { };
   #boundHandleTouchMove: (event: TouchEvent) => void = () => { };
   #boundHandleCanvasPointerMove: (event: PointerEvent) => void = () => { };
   #boundSyncDrawModeCanvasCursor: () => void = () => { };
   #boundClearCanvasCursor: () => void = () => { };

   constructor(application: Application) {
      this.#app = application;
      this.#drawingPanel = new DrawingPanel();
   }

   /**
    * Start a new signal drag operation from a signal template.
    * Moved from UI layer to centralize mouseAction handling.
    */
   startSignalDragFromTemplate(template: any): void {
      const rm = this.#app.renderingManager;
      if (!rm) return;

      const start = Point.fromPoint(rm.viewportPointerLocal());
      this.startInteraction(new SignalTemplateInteraction(template, start));

      document.addEventListener(
         "mouseup",
         (e: MouseEvent) => this.handleStageMouseUp({ nativeEvent: e }),
         { once: true }
      );
   }

   /**
    * Start a new train placement drag operation.
    * Moved from UI layer to centralize mouseAction handling.
    */
   startTrainPlacementDrag(): void {
      const start = Point.fromPoint(this.#app.renderingManager!.viewportPointerLocal());
      this.startInteraction(new TrainPlaceInteraction(start));

      document.addEventListener(
         "mouseup",
         (e: MouseEvent) => this.handleStageMouseUp({ nativeEvent: e }),
         { once: true }
      );
   }

   /**
    * Initialize all event listeners
    */
   initialize(): void {

      // Create bound function references for proper event listener removal
      this.#boundHandleStagePointerDown = this.handleStageMouseDown.bind(this);
      this.#boundHandleStagePointerUp = this.handleStageMouseUp.bind(this);
      this.#boundHandleStageGlobalPointerMove = this.handleMouseMove.bind(this);
      this.#boundHandleWheelEvent = this.#handleWheelEvent.bind(this);
      this.#boundHandleKeyDown = this.#handleKeyDown.bind(this);
      this.#boundHandleWindowResize = this.#handleWindowResize.bind(this);
      this.#boundHandleTouchStart = this.#handleTouchStart.bind(this);
      this.#boundHandleTouchMove = this.#handleTouchMove.bind(this);
      this.#boundHandleCanvasPointerMove = this.#handleCanvasPointerMove.bind(this);
      this.#boundSyncDrawModeCanvasCursor = this.#syncDrawModeCanvasCursor.bind(this);
      this.#boundClearCanvasCursor = this.#clearCanvasCursor.bind(this);

      this.#initializeCanvasEvents();
      this.#initializeTouchEvents();
      this.#initializeButtonEvents();
      this.#initializeKeyboardEvents();
      this.#initializeWindowEvents();
   }

   /**
    * Initialize canvas-specific events
    * @private
    */
   #initializeCanvasEvents(): void {
      const c = this.#mainCanvas;
      c?.addEventListener("wheel", this.#boundHandleWheelEvent!, { passive: false });
      c?.addEventListener("pointermove", this.#boundHandleCanvasPointerMove!);
      c?.addEventListener("pointerenter", this.#boundSyncDrawModeCanvasCursor);
      c?.addEventListener("pointerleave", this.#boundClearCanvasCursor);

      const rm = this.#app.renderingManager!;
      const stage = rm.pixiApp.stage;
      stage.eventMode = "static";
      stage.hitArea = rm.pixiApp.renderer.screen;
      stage.on("pointerdown", this.#boundHandleStagePointerDown);
      stage.on("globalpointermove", this.#boundHandleStageGlobalPointerMove);
      stage.on("pointerup", this.#boundHandleStagePointerUp);
      stage.on("pointerupoutside", this.#boundHandleStagePointerUp);
   }

   /** SVG cursors for annotate modes; preserves text cursor when placing labels. */
   #syncDrawModeCanvasCursor(): void {
      const m = this.#app.customMouseMode;
      if (m === CUSTOM_MOUSE_ACTION.ERASER) this.#mainCanvas.style.cursor = DRAWING_MODE_CURSORS.eraser;
      else if (m === CUSTOM_MOUSE_ACTION.DRAWING) this.#mainCanvas.style.cursor = DRAWING_MODE_CURSORS.brush;
      else if (m === CUSTOM_MOUSE_ACTION.TEXT) this.#mainCanvas.style.cursor = "text";
      else this.#mainCanvas.style.cursor = "auto";
   }

   #clearCanvasCursor(): void {
      this.#mainCanvas.style.cursor = "auto";
   }

   /** Keeps pointer coords in sync with {@link RenderingManager.recordCanvasPointer} for wheel-zoom around cursor. */
   #handleCanvasPointerMove(event: PointerEvent): void {
      this.#app.renderingManager?.recordCanvasPointer(event);
   }

   /**
    * Initialize touch events
    * @private
    */
   #initializeTouchEvents(): void {
      if (!("ontouchstart" in window) && navigator.maxTouchPoints === 0) return;

      const canvas = this.#mainCanvas;
      if (!canvas) return;
      canvas.addEventListener("touchstart", this.#boundHandleTouchStart!);
      canvas.addEventListener("touchmove", this.#boundHandleTouchMove!);
   }

   /**
    * Initialize button events
    * @private
    */
   #afterAdvancedPlanLoad(): void {
      const rm = this.#app.renderingManager;
      rm?.drawGrid();
      rm?.renderer.reDrawEverything(true);
      $("#myCanvas").trigger("focus");
   }

   #collapseNewItemsMenubarOnMobile(): void {
      if (window.matchMedia("(min-width: 992px)").matches) return;
      const el = document.getElementById("newItemsMenubarCollapse");
      if (!el?.classList.contains("show")) return;
      Collapse.getOrCreateInstance(el).hide();
   }

   #initializeButtonEvents(): void {
      // Menu buttons
      $("#btnAddSignals").onclick(() => {
         this.#collapseNewItemsMenubarOnMobile();
         this.#app.uiManager?.showMenu(MENU.NEW_SIGNAL);
      });
      $("#btnAddTrain").onclick(() => {
         this.#collapseNewItemsMenubarOnMobile();
         this.#app.uiManager?.showMenu(MENU.NEW_TRAIN);
      });
      $("#btnAddObject").onclick(() => {
         this.#collapseNewItemsMenubarOnMobile();
         this.#app.uiManager?.showMenu(MENU.NEW_OBJECT);
      });
      $("#menuNeu").onclick(() => this.#app.uiManager?.showStartScreen());
      $("#menuSpeichern").onclick(() => STORAGE.downloadAsFile());
      $("#menuModusAendern").onclick(() => {
         Modal.getOrCreateInstance(document.getElementById("rendererChoiceModal")!).show();
      });


      $("#menuLoadFromFile").onclick(() => {
         STORAGE.restoreFromFile().then(() => {
            this.#afterAdvancedPlanLoad();
            STORAGE.saveUndoHistory();
         });
      });

      const rendererModalEl = document.getElementById("rendererChoiceModal");
      rendererModalEl?.addEventListener("show.bs.modal", () => {
         this.#app.uiManager?.handleRendererUIUpdate(
            this.#app.renderingManager?.usesAdvancedRenderer() ?? true
         );
      });

      $("#btnRendererChoiceOk").onclick(() => {
         const handle = this.#app.uiManager?.rendererChoiceCardsHandle;
         if (!handle) return;
         this.#app.renderingManager?.selectRenderer(handle.getSelectedAdvanced());
         STORAGE.save();
         Modal.getInstance(document.getElementById("rendererChoiceModal")!)?.hide();
      });

      // Action buttons
      $("#btnClear").onclick(() => this.#app.renderingManager?.clear());
      $("#btnRedraw").onclick(() => this.#app.renderingManager?.forceRedraw());
      $("#btnImage").onclick(this.#handleImageExport.bind(this));
      $("#btnDraw").onclick(this.#handleDrawToggle.bind(this));
      $(this.#drawingPanel.btnClear).onclick(this.#handleDrawingClear.bind(this));

      $(this.#drawingPanel.btnEraser).onclick(() => {
         const mode_active = this.#app.customMouseMode === CUSTOM_MOUSE_ACTION.ERASER;
         this.#drawingPanel.setEraserActive(!mode_active);
         this.#app.customMouseMode = !mode_active ? CUSTOM_MOUSE_ACTION.ERASER : CUSTOM_MOUSE_ACTION.DRAWING;
         this.#syncDrawModeCanvasCursor();
      });

      $("#btnUndo").onclick(this.#handleUndo.bind(this));

      // Signal edit menu
      $("#signalEditMenuHeader a").on("click", this.#handleSignalEditClick.bind(this));
   }

   /**
    * Initialize keyboard events
    * @private
    */
   #initializeKeyboardEvents(): void {
      document.addEventListener("keydown", this.#boundHandleKeyDown!);
   }

   /**
    * Initialize window events
    * @private
    */
   #initializeWindowEvents(): void {
      $(window).on("resize", this.#boundHandleWindowResize!);
   }

   /**
    * Handle wheel event for zooming
    * @private
    */
   #handleWheelEvent(event: WheelEvent): void {
      event.preventDefault();
      this.#app.renderingManager?.recordCanvasPointer(event);
      this.#app.renderingManager?.zoom(event.deltaY);
   }

   /**
    * Handle touch start event
    * @private
    */
   #handleTouchStart(event: TouchEvent): void {
      if (event.touches.length === 1) {
         // Single-touch drawing can be added here if needed.
      }
   }

   /**
    * Handle touch move event
    * @private
    */
   #handleTouchMove(event: TouchEvent): void {
      if (event.touches.length === 1) {
         let touch = event.touches[0];

         if (this.#previousTouch) {
            const vp = this.#app.renderingManager!.viewport;
            vp.x += touch.clientX - this.#previousTouch.clientX;
            vp.y += touch.clientY - this.#previousTouch.clientY;

            this.#app.renderingManager?.drawGrid(false);
            this.#app.renderingManager?.reDrawEverything();
         }

         this.#previousTouch = touch;
      }
   }

   /**
    * Stage-level pointerdown. Fires only for "empty space" (elements stop propagation in their own
    * pointerdown handlers); container is therefore always null here.
    */
   handleStageMouseDown(event: FederatedPointerEvent): void {
      const rm = this.#app.renderingManager!;
      rm.recordCanvasPointer(event.nativeEvent as MouseEvent);
      const start = Point.fromPoint(rm.viewportPointerLocal());
      const mode = this.#app.customMouseMode;

      if (mode === CUSTOM_MOUSE_ACTION.TEXT) {
         this.startInteraction(new TextPlaceInteraction());
         return;
      }
      if (mode === CUSTOM_MOUSE_ACTION.PLATTFORM) {
         this.startInteraction(new PlatformPlaceInteraction(start));
         return;
      }
      if (mode === CUSTOM_MOUSE_ACTION.TRAIN_COUPLE || mode === CUSTOM_MOUSE_ACTION.TRAIN_DECOUPLE) {
         this.startInteraction(new TrainCoupleModeCancelInteraction(mode));
         return;
      }
      if (mode === CUSTOM_MOUSE_ACTION.DRAWING) {
         this.startInteraction(new DrawingInteraction(start, this.#drawingPanel));
         return;
      }
      if (mode === CUSTOM_MOUSE_ACTION.ERASER) {
         this.startInteraction(new EraserInteraction());
         return;
      }

      if (event.button === 2) {
         this.startInteraction(new ViewportScrollInteraction());
         return;
      }
      if (event.button === 0) {
         this.startInteraction(new TrackBuildInteraction(start, null));
      }
   }

   /** Register a self-contained interaction; the stage forwards subsequent move/up to it until release. */
   startInteraction(interaction: PointerInteraction): void {
      this.#activeInteraction = interaction;
   }

   /**
    * Handle stage mouse up event
    * @param {Event} event - The mouse up event
    */
   handleStageMouseUp(event: FederatedPointerEvent | MouseEvent | { nativeEvent: MouseEvent }): void {
      const rm = this.#app.renderingManager!;
      const native =
         "nativeEvent" in event && event.nativeEvent
            ? event.nativeEvent
            : (event as MouseEvent);
      rm.recordCanvasPointer(native as MouseEvent);      

      if (this.#activeInteraction) {
         const local = Point.fromPoint(rm.viewportPointerLocal());
         this.#activeInteraction.onUp(local, event as FederatedPointerEvent);
         this.#activeInteraction = null;
      }
      this.#syncDrawModeCanvasCursor();
      rm.containers.overlay.removeChildren();
      rm.update();
   }

   /**
    * Handle mouse move event
    * @param {Event} event - The mouse move event
    */
   handleMouseMove(event: FederatedPointerEvent): void {
      if (!event.isPrimary || !this.#activeInteraction) return;

      if (event.buttons === 0) return this.handleStageMouseUp(event);

      const local = Point.fromPoint(this.#app.renderingManager!.viewportPointerLocal());
      this.#activeInteraction.onMove(local, event);
      this.#app.renderingManager?.update();
   }

   /**
    * Get hit info for signal positioning
    * @param {Point} testPoint - Point to test
    * @returns {*} Hit information
    */
   getHitInfoForSignalPositioning(testPoint: Point): any {
      for (const track of Track.allTracks) {
         if (NumberUtils.between(testPoint.x, track.start.x, track.end.x)) {
            const distance = geometry.pointToSegmentDistance(testPoint, track.start, track.end);
            if (distance <= COMPUTED.GRID_SIZE_2) {
               const point = geometry.nearestPointOnLine(track.start, track.end, testPoint);

               return {
                  track: track,
                  point: point,
                  km: track.getKmfromPoint(point),
                  above: testPoint.y < point.y,
               };
            }
         }
      }
   }

   /**
    * Handle key down event
    * @private
    */
   #handleKeyDown(e: KeyboardEvent): void {
      if ((e.target as HTMLElement)?.tagName != "INPUT") {
         if (e.code == "Delete" || e.code == "Backspace") {
            this.#app.deleteSelectedObject();
         }
         if (e.code == "Escape") {
            this.#app.selectObject();
         }
         // Handle Ctrl+Z / Cmd+Z for undo
         if ((e.ctrlKey || e.metaKey) && (e.key === "z" || e.key === "Z")) {
            e.preventDefault();
            this.#app.undo();
         }
      }
   }

   /**
    * Handle window resize event
    * @private
    */
   #handleWindowResize(): void {
      this.#app.renderingManager?.onResizeWindow();
   }

   /**
    * Handle image export
    * @private
    */
   async #handleImageExport(): Promise<void> {
      const viewport = this.#app.renderingManager!.viewport;
      let backup = { x: viewport.x, y: viewport.y, scale: viewport.scale.x };

      try {
         const rm = this.#app.renderingManager!;
         const renderer = rm.pixiApp.renderer;

         rm.reDrawEverything(true, true);

         const b = rm.viewport.getLocalBounds();
         if (!(b.width > 0 && b.height > 0 && Number.isFinite(b.width + b.height))) {
            ui.showInfoToast("Nix zu sehen");
            return;
         }

         const bw = Math.max(1, Math.ceil(b.width));
         const bh = Math.max(1, Math.ceil(b.height));
         const gl = (renderer as { gl?: WebGLRenderingContext }).gl;
         const maxDim = gl ? gl.getParameter(gl.MAX_TEXTURE_SIZE) : 8192;
         const exportResolution = Math.min(2, maxDim / Math.max(bw, bh));

         rm.setGridVisible(false);
         rm.containers.drawing.visible = false;
         rm.containers.ui.visible = false;
         rm.update();

         const img_data = await renderer.extract.base64({
            target: rm.viewport,
            resolution: exportResolution,
            clearColor: "#00000000",
            antialias: false,
         });
         const img = $("<img>", { src: img_data, width: "100%" }).css("object-fit", "scale-down").css("max-height", "50vh");
         ui.showModalDialog(img, () => {
            const a = $("<a>", { download: "gleisplan.png", href: img_data });
            a[0].click();
         });
      } catch (error) {
         ui.showErrorToast(error as Error);
      } finally {
         viewport.x = backup.x;
         viewport.y = backup.y;
         viewport.scale.set(backup.scale);
         this.#app.renderingManager!.setGridVisible(true);
         this.#app.renderingManager!.containers.drawing.visible = true;
         this.#app.renderingManager!.containers.ui.visible = true;
         this.#app.renderingManager?.reDrawEverything(true);
         this.#app.renderingManager!.update();
         this.#app.renderingManager?.notifyViewportChanged();
      }
   }

   /**
    * Handle draw toggle
    * @private
    */
   #handleDrawToggle(): void {
      this.#app.customMouseMode = $("#btnDraw").hasClass("active") ? CUSTOM_MOUSE_ACTION.DRAWING : CUSTOM_MOUSE_ACTION.NONE;
      this.#drawingPanel.setEraserActive(false);
      if (this.#app.customMouseMode === CUSTOM_MOUSE_ACTION.DRAWING) {
         this.#drawingPanel.show();
      } else {
         this.#drawingPanel.hide();
      }
      this.#syncDrawModeCanvasCursor();
   }

   /**
    * Handle drawing clear
    * @private
    */
   #handleDrawingClear(): void {
      this.#app.renderingManager?.containers.drawing.removeChildren();
      this.#app.renderingManager?.update();
   }

   /**
    * Handle undo
    * @private
    */
   #handleUndo(): void {
      this.#app.undo();
   }

   /**
    * Handle signal edit click
    * @private
    */
   #handleSignalEditClick(): void {
      $("#signalEditMenuHeader .card-text").hide();
      $("#signalEditMenuHeader input")
         .val(this.#app.selection.object.get("bez"))
         .show()
         .focus()
         .on(
            "keydown",
            (e) => {
               if (e.key === "Enter") {
                  this.#app.selection.object.setSignalAspect("bez", (e.target as HTMLInputElement).value);
                  $("#signalEditMenuHeader .card-text").show();
                  $("#signalEditMenuHeader input").hide();
                  Sig_UI.syncSignalMenu(this.#app.selection.object);
                  STORAGE.save();
               }
            }
         )
         .on("blur", () => {
            $("#signalEditMenuHeader .card-text").show();
            $("#signalEditMenuHeader input").hide();
         });
   }

   /**
    * Register an event listener (supports multiple listeners per event)
    * @param {string} eventType - The type of event
    * @param {Function} listener - The event listener function
    */
   on(eventType: string, listener: Function): void {
      if (!this.#eventListeners.has(eventType)) {
         this.#eventListeners.set(eventType, []);
      }
      this.#eventListeners.get(eventType)!.push(listener);
   }

   /**
    * Unregister an event listener
    * @param {string} eventType - The type of event
    * @param {Function} listener - The event listener function to remove
    */
   off(eventType: string, listener: Function): void {
      const listeners = this.#eventListeners.get(eventType);
      if (listeners) {
         const index = listeners.indexOf(listener);
         if (index > -1) {
            listeners.splice(index, 1);
         }
      }
   }

   /**
    * Emit a custom event
    * @param {string} eventType - The type of event
    * @param {*} data - Event data
    */
   emit(eventType: string, data?: any): void {
      // Call multiple listeners
      const listeners = this.#eventListeners.get(eventType);
      if (listeners) {
         listeners.forEach((listener) => {
            try {
               listener(data);
            } catch (error) {
               console.error(`Error in event listener for ${eventType}:`, error);
            }
         });
      }
   }

   /**
    * Clean up all event listeners
    */
   cleanup(): void {
      // Remove all event listeners
      this.#eventListeners.clear();

      // Remove canvas event listeners
      const c = this.#mainCanvas;
      c?.removeEventListener("wheel", this.#boundHandleWheelEvent!);
      c?.removeEventListener("pointermove", this.#boundHandleCanvasPointerMove!);
      c?.removeEventListener("touchstart", this.#boundHandleTouchStart!);
      c?.removeEventListener("touchmove", this.#boundHandleTouchMove!);

      // Remove stage federated event listeners
      const stage = this.#app.renderingManager?.pixiApp?.stage;
      stage?.off("pointerdown", this.#boundHandleStagePointerDown);
      stage?.off("globalpointermove", this.#boundHandleStageGlobalPointerMove);
      stage?.off("pointerup", this.#boundHandleStagePointerUp);
      stage?.off("pointerupoutside", this.#boundHandleStagePointerUp);

      // Remove document event listeners
      document.removeEventListener("keydown", this.#boundHandleKeyDown!);

      // Remove window event listeners
      $(window).off("resize", this.#boundHandleWindowResize!);
   }
}
