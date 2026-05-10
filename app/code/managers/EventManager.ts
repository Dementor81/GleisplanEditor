"use strict";

// ES6 Module imports
import { Modal } from "bootstrap";
import { CONFIG, INPUT, CUSTOM_MOUSE_ACTION, MOUSE_DOWN_ACTION, COLORS, COMPUTED, MENU } from "../config.ts";
import { STORAGE } from "../storage.ts";
import { ui } from "../ui.ts";
import { Point, geometry, TOOLS } from "../tools.ts";
import { ArrayUtils, NumberUtils } from "../utils.ts";
import { Signal } from "../signal.ts";
import { SignalRenderer } from "../signalRenderer.ts";
import { Sig_UI } from "../sig_ui.ts";
import { Train } from "../train.ts";
import { Track } from "../track.ts";
import { Switch } from "../switch.ts";
import { GenericObject } from "../generic_object.ts";
import { trackRendering_basic } from "../trackRendering_basic.ts";
import { Application } from "../application.ts";
import type { Graphics } from "pixi.js";
import { gleisGraphics } from "../pixiPrimitives.ts";
import { findChildByLabel } from "../pixiUtils.ts";
import { DrawingPanel } from "../ui/DrawingPanel.ts";
import { DRAWING_MODE_CURSORS } from "../ui/drawingCursors.ts";

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
 *    console.log('Renderer changed to:', data.textured);
 * });
 *
 * // Emit an event
 * eventManager.emit('rendererChanged', { textured: true });
 * ```
 */
export class EventManager {
   #app: Application;
   #drawingPanel: DrawingPanel;
   #eventListeners: Map<string, Function[]> = new Map();
   #mainCanvas: HTMLCanvasElement = (window as any).myCanvas as HTMLCanvasElement;

   #previousTouch: Touch | null = null;
   #mouseAction: any = null;

   // Store bound function references for proper event listener removal
   #boundHandleStageMouseDown: (event: any) => void = () => {};
   #boundHandleStageMouseUp: (event: any) => void = () => {};
   #boundHandleMouseMove: (event: any) => void = () => {};
   #boundHandleWheelEvent: (event: WheelEvent) => void = () => {};
   #boundHandleKeyDown: (event: KeyboardEvent) => void = () => {};
   #boundHandleWindowResize: () => void = () => {};
   #boundHandleTouchStart: (event: TouchEvent) => void = () => {};
   #boundHandleTouchMove: (event: TouchEvent) => void = () => {};
   #boundHandleCanvasPointerMove: (event: PointerEvent) => void = () => {};
   #boundSyncDrawModeCanvasCursor: () => void = () => {};
   #boundClearCanvasCursor: () => void = () => {};

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

      this.#mouseAction = {
         action: MOUSE_DOWN_ACTION.DND_SIGNAL,
         template: template,
      } as any;

      const local = rm.viewportPointerLocal();
      this.startDragAndDropSignal(local.x, local.y);

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
      const rm = this.#app.renderingManager;
      if (!rm) return;

      this.#mouseAction = {
         action: MOUSE_DOWN_ACTION.ADD_TRAIN,
      } as any;

      const local_point = rm.viewportPointerLocal();
      const preview = gleisGraphics("trainPreview");
      preview.x = local_point.x;
      preview.y = local_point.y;
      preview.roundRect(-20, -8, 40, 16, 4).fill("#333");
      this.#mouseAction.container = preview;

      rm.containers.overlay.addChild(this.#mouseAction.container);

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
      this.#boundHandleStageMouseDown = this.handleStageMouseDown.bind(this);
      this.#boundHandleStageMouseUp = this.handleStageMouseUp.bind(this);
      this.#boundHandleMouseMove = this.handleMouseMove.bind(this);
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
      c?.addEventListener("pointerdown", this.#boundHandleStageMouseDown!);
      c?.addEventListener("pointerup", this.#boundHandleStageMouseUp!);
      c?.addEventListener("pointermove", this.#boundHandleCanvasPointerMove!);
      c?.addEventListener("pointerenter", this.#boundSyncDrawModeCanvasCursor);
      c?.addEventListener("pointerleave", this.#boundClearCanvasCursor);
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

   /** Keeps pointer coords in sync with {@link RenderingManager.recordCanvasPointer}; forwards moves during an interaction. */
   #handleCanvasPointerMove(event: PointerEvent): void {
      this.#app.renderingManager?.recordCanvasPointer(event);
      if (this.#mouseAction) this.handleMouseMove(event);
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

   #initializeButtonEvents(): void {
      // Menu buttons
      $("#btnAddSignals").onclick(() => this.#app.uiManager?.showMenu(MENU.NEW_SIGNAL));
      $("#btnAddTrain").onclick(() => this.#app.uiManager?.showMenu(MENU.NEW_TRAIN));
      $("#btnAddObject").onclick(() => this.#app.uiManager?.showMenu(MENU.NEW_OBJECT));
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
            this.#app.renderingManager?.usesTexturedRenderer() ?? true
         );
      });

      $("#btnRendererChoiceOk").onclick(() => {
         const handle = this.#app.uiManager?.rendererChoiceCardsHandle;
         if (!handle) return;
         this.#app.renderingManager?.selectRenderer(handle.getSelectedTextured());
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
    * Handle stage mouse down event
    * @param {Event} event - The mouse down event
    */
   handleStageMouseDown(event: PointerEvent): void {
      const rm = this.#app.renderingManager!;
      rm.recordCanvasPointer(event);

      let hittest = this.getHitTest();
      const app = this.#app;
      const startLocal = rm.viewportPointerLocal();
      let mouseAction = {
         action: app.customMouseMode != CUSTOM_MOUSE_ACTION.NONE ? MOUSE_DOWN_ACTION.CUSTOM : MOUSE_DOWN_ACTION.NONE,
         container: hittest,
         startPoint: startLocal,
         _distancePoint: new Point(startLocal.x, startLocal.y),
         offset: hittest ? null : undefined,
         distance: function () {
            const cur = rm.viewportPointerLocal();
            return geometry.distance(this._distancePoint, new Point(cur.x, cur.y));
         },
      } as any;

      // Check if we clicked on a track endpoint
      if (mouseAction.container?.label === "track_endpoint") {
         const ep = rm.getGameObjFromDisplayObj(mouseAction.container) as { track: any; endpoint: string } | undefined;
         if (ep) {
            mouseAction.action = MOUSE_DOWN_ACTION.DND_TRACK;
            mouseAction.track = ep.track;
            mouseAction.endpoint = ep.endpoint;
         }
      }

      if (app.customMouseMode == CUSTOM_MOUSE_ACTION.DRAWING) {
         const color = this.#drawingPanel.getStrokeColor();
         const width = this.#drawingPanel.getStrokeWidth();

         const drawShape = gleisGraphics();
         app.renderingManager?.containers.drawing.addChild((mouseAction.shape = drawShape));
         mouseAction._drawStroke = {
            width,
            color,
            cap: "round" as const,
            join: "round" as const,
         };
         mouseAction._lastDraw = { x: startLocal.x, y: startLocal.y };
      }

      this.#mouseAction = mouseAction;
      if (hittest) {
         mouseAction.offset = {
            x: mouseAction.startPoint.x - hittest.x,
            y: mouseAction.startPoint.y - hittest.y,
         };
      }
   }

   /**
    * Handle stage mouse up event
    * @param {Event} event - The mouse up event
    */
   handleStageMouseUp(event: PointerEvent | MouseEvent | { nativeEvent: MouseEvent }): void {
      let ma = this.#mouseAction;
      const rm = this.#app.renderingManager!;
      const native =
         "nativeEvent" in event && event.nativeEvent
            ? event.nativeEvent
            : (event as MouseEvent);
      rm.recordCanvasPointer(native);
      try {
         this.#syncDrawModeCanvasCursor();
         if (ma == null) return;

         let local_point = Point.fromPoint(rm.viewportPointerLocal());

         const ev = native;
         // DOM pointer events use button===0; legacy mouse events used which===1
         const primaryClick = ev.button === 0 || ev.which === 1;
         if (primaryClick) {
            if (ma.action === MOUSE_DOWN_ACTION.DND_SIGNAL) {
               this.#app.renderingManager?.containers.overlay.removeChild(ma.container);

               if (ma.hit_track) {
                  this.#app.renderingManager?.containers.signals.addChild(ma.container);
                  const signal = rm.getGameObjFromDisplayObj(ma.container);
                  ma.hit_track.track.AddSignal(signal, ma.hit_track.km, ma.hit_track.above, ma.hit_track.flipped);
               } else {
                  Signal.removeSignal(rm.getGameObjFromDisplayObj(ma.container));
               }
               this.#app.renderingManager?.renderer.reDrawEverything(true);
               STORAGE.save();
               STORAGE.saveUndoHistory();
            } else if (ma.action === MOUSE_DOWN_ACTION.BUILD_TRACK) {
               if (ma.nodes.length > 0) {
                  Track.checkNodesAndCreateTracks(ma.nodes);
                  Track.createRailNetwork();
                  Train.allTrains.forEach((t) => t.restore());
                  this.#app.renderingManager?.renderer.reDrawEverything(true);
                  STORAGE.saveUndoHistory();
                  STORAGE.save();
               }
            } else if (ma.action === MOUSE_DOWN_ACTION.DND_TRACK) {
               this.#app.renderingManager?.renderer.reDrawEverything(true);
               STORAGE.saveUndoHistory();
               STORAGE.save();
            } else if (ma.action === MOUSE_DOWN_ACTION.ADD_TRAIN) {
               this.#app.renderingManager?.containers.overlay.removeChild(ma.container);
               const hit = this.getHitTest(this.#app.renderingManager?.containers.tracks);
               if (hit?.label == "track") {
                  const track = rm.getGameObjFromDisplayObj(hit);
                  const hitInfo = this.getHitInfoForSignalPositioning(local_point);
                  const km = hitInfo.km;
                  Train.addTrain(track as Track, 3, km, Train.CAR_TYPES.PASSENGER);
                  this.#app.renderingManager?.renderer.renderAllTrains();
                  STORAGE.save();
               }
            } else if (NumberUtils.is(ma.action, MOUSE_DOWN_ACTION.MOVE_TRAIN, MOUSE_DOWN_ACTION.MOVE_OBJECT)) {
               STORAGE.save();
               STORAGE.saveUndoHistory();
            } else if (ma.action === MOUSE_DOWN_ACTION.CUSTOM) {
               if (this.#app.customMouseMode == CUSTOM_MOUSE_ACTION.TEXT) {
                  const o = new GenericObject(GenericObject.OBJECT_TYPE.text);
                  o.pos(local_point);
                  o.content("Text");
                  GenericObject.all_objects.push(o);
                  this.#app.selectObject(o);
                  this.#app.renderingManager?.renderer.renderAllGenericObjects();
                  this.#app.customMouseMode = CUSTOM_MOUSE_ACTION.NONE;
                  STORAGE.saveUndoHistory();
                  STORAGE.save();
               } else if (this.#app.customMouseMode == CUSTOM_MOUSE_ACTION.PLATTFORM) {
                  this.#app.renderingManager?.containers.overlay.removeChildren();
                  const o = new GenericObject(GenericObject.OBJECT_TYPE.plattform);
                  o.content("Bahnsteig");
                  o.pos(ma.startPoint);
                  o.size(local_point.x - ma.startPoint.x, local_point.y - ma.startPoint.y);
                  GenericObject.all_objects.push(o);
                  this.#app.renderingManager?.renderer.renderAllGenericObjects();
                  this.#app.selectObject(o);
                  this.#app.customMouseMode = CUSTOM_MOUSE_ACTION.NONE;
                  STORAGE.saveUndoHistory();
                  STORAGE.save();
               } else if (this.#app.customMouseMode === CUSTOM_MOUSE_ACTION.TRAIN_DECOUPLE) {
                  if (ma.container?.label == "decouplingPoint") {
                     Train.handleDecouplingClick(rm.getGameObjFromDisplayObj(ma.container));
                  } else {
                     Train.exitDecouplingMode();
                  }
               } else if (this.#app.customMouseMode === CUSTOM_MOUSE_ACTION.TRAIN_COUPLE) {
                  if (ma.container?.label == "couplingPoint") {
                     Train.handleCouplingClick(rm.getGameObjFromDisplayObj(ma.container));
                  } else {
                     Train.exitCouplingMode();
                  }
               }
            } else if (ma.action === MOUSE_DOWN_ACTION.NONE && ma.distance() < INPUT.MOUSE_MOVEMENT_THRESHOLD) {
               if (ma.container?.label == "signal") {
                  this.#app.selectObject(rm.getGameObjFromDisplayObj(ma.container), event);
               } else if (
                  ma.container?.label == "couplingPoint" &&
                  this.#app.customMouseMode === CUSTOM_MOUSE_ACTION.TRAIN_COUPLE
               ) {
                  // Handle coupling at this point
                  Train.handleCouplingClick(rm.getGameObjFromDisplayObj(ma.container));
               } else if (ma.container?.label == "train") {
                  this.#app.selectObject(rm.getGameObjFromDisplayObj(ma.container), event);
               } else if (ma.container?.label == "track") {
                  this.#app.selectObject(rm.getGameObjFromDisplayObj(ma.container), event);
               } else if (ma.container?.label == "GenericObject") {
                  this.#app.selectObject(rm.getGameObjFromDisplayObj(ma.container), event);
               } else if (ma.container?.label == "switch") {
                  const sw = rm.getGameObjFromDisplayObj(ma.container) as Switch;
                  Switch.switch_A_Switch(sw, local_point.x);
                  this.#app.renderingManager?.renderer.renderSwitchUI(sw);
               } else {
                  this.#app.selectObject();
               }
            }
         } else if (ma.action === MOUSE_DOWN_ACTION.SCROLL) {
            STORAGE.save();
         }
      } catch (error) {
         ui.showErrorToast(error as any);
      } finally {
         ma = null;
         this.#mouseAction = null;
         this.#app.renderingManager?.containers.overlay.removeChildren();
         this.#app.renderingManager?.update();
      }
   }

   /**
    * Handle mouse move event
    * @param {Event} event - The mouse move event
    */
   handleMouseMove(event: PointerEvent): void {
      if (!event.isPrimary) return;
      if (this.#mouseAction == null) {
         return;
      }
      //falls mouseMove noch läuft, obwohl der User keinen button mehr drückt
      //tritt vor allem beim debugging auf
      if (event.buttons == 0) {
         console.log("debug mouse error");
         return this.handleStageMouseUp(event);
      }

      const rm = this.#app.renderingManager!;
      let local_point = Point.fromPoint(rm.viewportPointerLocal());

      if (this.#mouseAction.action === MOUSE_DOWN_ACTION.NONE) {
         this.determineMouseAction(event, local_point);
      } else if (this.#mouseAction.action === MOUSE_DOWN_ACTION.CUSTOM) {
         if (this.#app.customMouseMode == CUSTOM_MOUSE_ACTION.DRAWING) {
            const ma = this.#mouseAction;
            const last = ma._lastDraw;
            ma.shape.moveTo(last.x, last.y).lineTo(local_point.x, local_point.y).stroke(ma._drawStroke);
            ma._lastDraw = { x: local_point.x, y: local_point.y };
         } else if (this.#app.customMouseMode == CUSTOM_MOUSE_ACTION.ERASER) {
            const drawingContainer = rm.containers.drawing;
            const hit = rm.hitTest(drawingContainer);
            if (hit) {
               drawingContainer.removeChild(hit);
               this.#app.renderingManager?.update();
            }
         } else if (this.#app.customMouseMode == CUSTOM_MOUSE_ACTION.PLATTFORM) {
            this.#app.renderingManager?.containers.overlay.removeChildren();
            const plat = gleisGraphics();
            plat
               .rect(
                  this.#mouseAction.startPoint.x,
                  this.#mouseAction.startPoint.y,
                  local_point.x - this.#mouseAction.startPoint.x,
                  local_point.y - this.#mouseAction.startPoint.y
               )
               .stroke({ width: 1, color: COLORS.DRAWING_PLATTFORM, cap: "round", join: "round" });
            this.#app.renderingManager?.containers.overlay.addChild((this.#mouseAction.shape = plat));
            this.#app.renderingManager?.update();
         }
      } else if (this.#mouseAction.action === MOUSE_DOWN_ACTION.MOVE_OBJECT) {
         const o = rm.getGameObjFromDisplayObj(this.#mouseAction.container) as GenericObject;
         o.pos(local_point);
         if (this.#mouseAction.offset) {
            local_point.x -= this.#mouseAction.offset.x;
            local_point.y -= this.#mouseAction.offset.y;
         }
         this.#mouseAction.container.x = local_point.x;
         this.#mouseAction.container.y = local_point.y;
         this.#app.renderingManager?.renderer.updateSelection();
      } else if (this.#mouseAction.action === MOUSE_DOWN_ACTION.DND_SIGNAL) {
         this.dragnDropSignal(local_point, event.altKey);
         this.#app.renderingManager?.renderer.updateSelection();
      } else if (this.#mouseAction.action === MOUSE_DOWN_ACTION.BUILD_TRACK) {
         const grid_snap_point = this.getSnapPoint(local_point);
         let valid = Track.isValidTrackNodePoint(grid_snap_point, this.#mouseAction.nodes);

         if (geometry.distance(local_point, grid_snap_point) <= CONFIG.SNAP_TO_GRID) {
            // If the node already exists, revert to that node by removing any nodes after it
            let existingIndex: number = -1;
            if(this.#mouseAction.nodes) {
               existingIndex = this.#mouseAction.nodes.findIndex((node: any) => node.equals(grid_snap_point));
            }
            if (existingIndex !== -1) {
               // Keep nodes up to and including the found node
               this.#mouseAction.nodes = this.#mouseAction.nodes.slice(0, existingIndex + 1);
            } else if (valid) {
               this.addTrackAnchorPoint(grid_snap_point);
            } else {
               valid = false;
            }
         }
         this.drawBluePrintTrack(!valid);
      } else if (this.#mouseAction.action === MOUSE_DOWN_ACTION.SCROLL) {
         this.#app.renderingManager?.scroll(event.movementX, event.movementY);
      } else if (this.#mouseAction.action === MOUSE_DOWN_ACTION.MOVE_TRAIN) {
         Train.moveTrain(rm.getGameObjFromDisplayObj(this.#mouseAction.container) as Train, event.movementX);
         this.#app.renderingManager?.reDrawEverything();
      } else if (this.#mouseAction.action === MOUSE_DOWN_ACTION.ADD_TRAIN) {
         this.#mouseAction.container.x = local_point.x;
         this.#mouseAction.container.y = local_point.y;
      } else if (this.#mouseAction.action === MOUSE_DOWN_ACTION.DND_TRACK) {
         const grid_snap_point = this.getSnapPoint(local_point);

         if (geometry.distance(local_point, grid_snap_point) <= CONFIG.SNAP_TO_GRID) {
            if (Track.isValidTrackNodePoint(grid_snap_point,null)) { //TODO: currently always returns true
               if (this.#mouseAction.endpoint === "start") {
                  this.#mouseAction.track.setNewStart(grid_snap_point);
               } else {
                  this.#mouseAction.track.setNewEnd(grid_snap_point);
               }
               Track.createRailNetwork();
               this.#app.renderingManager?.renderer.reDrawEverything(true);
            }
         }
      }

      this.#app.renderingManager?.update();
   }

   /**
    * Get hit test result
    * @param {*} container - Container to test against
    * @returns {*} The hit object
    */
   getHitTest(container?: any): any {
      const rm = this.#app.renderingManager!;
      const root = container ?? rm.viewport;
      return rm.hitTest(root);
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
               const point = TOOLS.nearestPointOnLine(track.start, track.end, testPoint);

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
    * Determine mouse action based on movement
    * @param {Event} event - The mouse event
    * @param {Point} local_point - Local point coordinates
    */
   determineMouseAction(event: PointerEvent, local_point: Point): void {
      let ma = this.#mouseAction;
      //wie weit wurde die maus seit mousedown bewegt
      if (ma.distance() > INPUT.MOUSE_MOVEMENT_THRESHOLD) {
         if (event.buttons == 1) {
            if (ma.container?.label == "signal") {
               this.#mainCanvas.style.cursor = "move";
               ma.action = MOUSE_DOWN_ACTION.DND_SIGNAL;
               const sig = this.#app.renderingManager!.getGameObjFromDisplayObj(ma.container) as any;
               sig._positioning.track.removeSignal(sig);
               this.startDragAndDropSignal();
            } else if (ma.container?.label == "GenericObject") {
               this.#mainCanvas.style.cursor = "move";
               ma.action = MOUSE_DOWN_ACTION.MOVE_OBJECT;
            } else if (ma.container?.label == "track" || ma.container?.label == "switch" || ma.container == null) {
               ma.action = MOUSE_DOWN_ACTION.BUILD_TRACK;
               this.addTrackAnchorPoint(this.getSnapPoint(local_point));
               this.#app.renderingManager?.containers.overlay.addChild((ma.lineShape = gleisGraphics()));
            }
            if (ma.container?.label == "train") {
               ma.action = MOUSE_DOWN_ACTION.MOVE_TRAIN;
            }
         } else if (event.buttons == 2) {
            ma.action = MOUSE_DOWN_ACTION.SCROLL;
         }
      }
   }

   /**
    * Drag and drop signal
    * @param {Point} local_point - Local point coordinates
    * @param {boolean} flipped - Whether signal is flipped
    */
   dragnDropSignal(local_point: Point, flipped: boolean): void {
      let ma = this.#mouseAction;

      let hitInformation = this.getHitInfoForSignalPositioning(local_point);
      if (hitInformation) {
         hitInformation.flipped = flipped;
         ma.hit_track = hitInformation;
         //console.log(hitInformation);
         this.#app.alignSignalContainerWithTrack(ma.container, hitInformation);
      } else {
         ma.hit_track = null;
         ma.container.angle = 0;
         if (ma.offset) {
            local_point.x -= ma.offset.x;
            local_point.y -= ma.offset.y;
         }
         ma.container.x = local_point.x;
         ma.container.y = local_point.y;
      }
      this.draw_SignalPositionLine();
   }

   /**
    * Draw signal position line
    */
   draw_SignalPositionLine(): void {
      let shape = findChildByLabel(this.#app.renderingManager!.containers.overlay, "SignalPositionLine") as Graphics | null;
      if (shape) this.#app.renderingManager?.containers.overlay.removeChild(shape);

      if (this.#mouseAction.hit_track) {
         const point = this.#mouseAction.hit_track.point;
         shape = gleisGraphics("SignalPositionLine");
         shape
            .moveTo(this.#mouseAction.container.x, this.#mouseAction.container.y)
            .lineTo(point.x, point.y)
            .stroke({ width: 1, color: COLORS.SIGNAL_POSITION_LINE, cap: "round", join: "round" });
         this.#app.renderingManager?.containers.overlay.addChild(shape);
      }
   }

   /**
    * Draw blueprint track
    */
   drawBluePrintTrack(invalid: boolean = false): void {
      if (this.#mouseAction.nodes == null) return;
      const shape = this.#mouseAction.lineShape as Graphics;
      shape.clear();

      const blueprintStroke = {
         width: trackRendering_basic.STROKE,
         color: COLORS.DRAWING_BLUEPRINT,
         cap: "round" as const,
         join: "round" as const,
      };
      shape.moveTo(this.#mouseAction.nodes[0].x, this.#mouseAction.nodes[0].y);
      for (let index = 1; index < this.#mouseAction.nodes.length; index++) {
         const point = this.#mouseAction.nodes[index];
         shape.lineTo(point.x, point.y);
      }
      shape.stroke(blueprintStroke);

      const last = ArrayUtils.last(this.#mouseAction.nodes) as any;
      const p = Point.fromPoint(this.#app.renderingManager!.viewportPointerLocal());
      shape
         .moveTo(last.x, last.y)
         .lineTo(p.x, p.y)
         .stroke({
            width: trackRendering_basic.STROKE,
            color: invalid ? COLORS.DRAWING_INVALID : COLORS.DRAWING_ACTIVE,
            cap: "round",
            join: "round",
         });
   }

   /**
    * Add track anchor point
    * @param {Point} p - Point to add
    */
   addTrackAnchorPoint(p: Point): void {
      if (this.#mouseAction.nodes == null) {
         this.#mouseAction.nodes = [];
      }

      this.#mouseAction.nodes.push(p);
   }

   /**
    * Get snap point
    * @param {Point} local_point - Local point coordinates
    * @returns {Point} Snap point
    */
   getSnapPoint(local_point: Point): Point {
      return new Point(
         Math.round(local_point.x / CONFIG.GRID_SIZE) * CONFIG.GRID_SIZE,
         Math.round(local_point.y / CONFIG.GRID_SIZE) * CONFIG.GRID_SIZE
      );
   }

   /**
    * Start drag and drop signal
    * @param {number} mouseX - Mouse X coordinate
    * @param {number} mouseY - Mouse Y coordinate
    */
   startDragAndDropSignal(mouseX?: number, mouseY?: number): void {
      if (this.#mouseAction.container) {
         this.#mouseAction.container.parent.removeChild(this.#mouseAction.container);
      } else {
         let signal = new Signal(this.#mouseAction.template);
         const rmDnD = this.#app.renderingManager!;
         this.#mouseAction.container = SignalRenderer.createSignalContainer(rmDnD, signal);
         this.#mouseAction.container.x = mouseX;
         this.#mouseAction.container.y = mouseY;
      }

      this.#app.renderingManager?.containers.overlay.addChild(this.#mouseAction.container);
      this.#app.renderingManager?.update();
   }

   /**
    * Handle key down event
    * @private
    */
   #handleKeyDown(e: KeyboardEvent): void {
      if ((e.target as HTMLElement)?.tagName != "INPUT"){
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

         const b = rm.containers.main.getLocalBounds();
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
            target: rm.containers.main,
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
                  this.#app.renderingManager?.renderer.reDrawEverything(true);
                  this.#app.renderingManager?.update();
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
    * Get bound mouse move handler for external use
    * @returns {Function} The bound mouse move handler
    */
   get boundMouseMoveHandler(): ((event: any) => void) | null {
      return this.#boundHandleMouseMove;
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
      c?.removeEventListener("pointerdown", this.#boundHandleStageMouseDown!);
      c?.removeEventListener("pointerup", this.#boundHandleStageMouseUp!);
      c?.removeEventListener("pointermove", this.#boundHandleCanvasPointerMove!);
      c?.removeEventListener("touchstart", this.#boundHandleTouchStart!);
      c?.removeEventListener("touchmove", this.#boundHandleTouchMove!);

      // Remove document event listeners
      document.removeEventListener("keydown", this.#boundHandleKeyDown!);

      // Remove window event listeners
      $(window).off("resize", this.#boundHandleWindowResize!);
   }
}
