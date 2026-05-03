"use strict";

// ES6 Module imports
import { Offcanvas } from "bootstrap";
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
   #eventListeners: Map<string, Function[]> = new Map();
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
   

   constructor(application: Application) {
      this.#app = application;
   }

   /**
    * Start a new signal drag operation from a signal template.
    * Moved from UI layer to centralize mouseAction handling.
    */
   startSignalDragFromTemplate(template: any): void {
      const stage = this.#app.renderingManager?.stage;
      if (!stage) return;

      // Initialize mouse action state
      this.#mouseAction = {
         action: MOUSE_DOWN_ACTION.DND_SIGNAL,
         template: template,
      } as any;

      // Compute current local mouse position and spawn preview
      const local = stage.globalToLocal(stage.mouseX, stage.mouseY);
      this.startDragAndDropSignal(local.x, local.y);

      // Wire move + one-time mouseup
      stage.addEventListener("stagemousemove", this.#boundHandleMouseMove!);
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
      const stage = this.#app.renderingManager?.stage;
      if (!stage) return;

      // Initialize mouse action state
      this.#mouseAction = {
         action: MOUSE_DOWN_ACTION.ADD_TRAIN,
      } as any;

      // Create preview bitmap at current mouse location
      const local_point = stage.globalToLocal(stage.mouseX, stage.mouseY);
      this.#mouseAction.container = new (createjs as any).Bitmap("zug.png").set({
         x: local_point.x,
         y: local_point.y,
         scale: 0.5,
         regY: 96 / 2,
      });

      this.#app.renderingManager?.containers.overlay.addChild(this.#mouseAction.container);

      // Wire move + one-time mouseup
      stage.addEventListener("stagemousemove", this.#boundHandleMouseMove!);
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

      this.#initializeStageEvents();
      this.#initializeCanvasEvents();
      this.#initializeTouchEvents();
      this.#initializeButtonEvents();
      this.#initializeKeyboardEvents();
      this.#initializeWindowEvents();
   }

   /**
    * Initialize stage-specific events
    * @private
    */
   #initializeStageEvents(): void {
      const stage = this.#app.renderingManager?.stage;

      stage?.addEventListener("stagemousedown", this.#boundHandleStageMouseDown!);
      stage?.addEventListener("stagemouseup", this.#boundHandleStageMouseUp!);
   }

   /**
    * Initialize canvas-specific events
    * @private
    */
   #initializeCanvasEvents(): void {
      // Wheel event for zooming
      myCanvas?.addEventListener("wheel", this.#boundHandleWheelEvent!, { passive: false });
   }

   /**
    * Initialize touch events
    * @private
    */
   #initializeTouchEvents(): void {
      if (!createjs.Touch.isSupported()) return;

      const canvas = myCanvas;
      canvas.addEventListener("touchstart", this.#boundHandleTouchStart!);
      canvas.addEventListener("touchmove", this.#boundHandleTouchMove!);
   }

   /**
    * Initialize button events
    * @private
    */
   #initializeButtonEvents(): void {
      // Edit mode toggle
      $("#btnDrawTracks,#btnPlay").click(() => this.#app.toggleEditMode());

      // Renderer switch
      $("#switch_renderer").on("change", (e) => {
         this.#app.renderingManager?.selectRenderer(!$("#switch_renderer").is(":checked"));
         STORAGE.save();
      });

      // Menu buttons
      $("#btnAddSignals").click(() => this.#app.uiManager?.showMenu(MENU.NEW_SIGNAL));
      $("#btnAddTrain").click(() => this.#app.uiManager?.showMenu(MENU.NEW_TRAIN));
      $("#btnAddObject").click(() => this.#app.uiManager?.showMenu(MENU.NEW_OBJECT));
      $("#btnDownload").click(() => STORAGE.downloadAsFile());

      // Action buttons
      $("#btnClear").click(() => this.#app.renderingManager?.clear());
      $("#btnCenter").click(() => this.#app.renderingManager?.center());
      $("#btnRedraw").click(() => this.#app.renderingManager?.forceRedraw());
      $("#btnImage").click(this.#handleImageExport.bind(this));
      $("#btnDraw").click(this.#handleDrawToggle.bind(this));
      $("#btnDrawingClear").click(this.#handleDrawingClear.bind(this));

      // Eraser button for drawing annotations
      $("#btnDrawingEraser").click(() => {
         const mode_active = this.#app.customMouseMode === CUSTOM_MOUSE_ACTION.ERASER;

         $("#btnDrawingEraser").toggleClass("active", !mode_active);

         this.#app.customMouseMode = !mode_active ? CUSTOM_MOUSE_ACTION.ERASER : CUSTOM_MOUSE_ACTION.DRAWING;
      });

      $("#btnUndo").click(this.#handleUndo.bind(this));

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
      this.#app.renderingManager?.zoom(event.deltaY);
   }

   /**
    * Handle touch start event
    * @private
    */
   #handleTouchStart(event: TouchEvent): void {
      if (event.touches.length === 1) {
         let touch = event.touches[0];
         //startTrackDrawing(this.#application.stage.globalToLocal(touch.clientX, touch.clientY));
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
            // be aware that these only store the movement of the first touch in the touches array
            this.#app.renderingManager!.stage.x += touch.clientX - this.#previousTouch.clientX;
            this.#app.renderingManager!.stage.y += touch.clientY - this.#previousTouch.clientY;

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
   handleStageMouseDown(event: any): void {
      let hittest = this.getHitTest();
      //console.log(hittest);
      const app = this.#app;
      let mouseAction = {
         action: app.customMouseMode != CUSTOM_MOUSE_ACTION.NONE ? MOUSE_DOWN_ACTION.CUSTOM : MOUSE_DOWN_ACTION.NONE,
         container: hittest,
         startPoint: app.renderingManager?.stage.globalToLocal(
            app.renderingManager?.stage.mouseX,
            app.renderingManager?.stage.mouseY
         ),
         _distancePoint: new Point(event.stageX, event.stageY),
         offset: hittest?.globalToLocal(app.renderingManager?.stage.mouseX, app.renderingManager?.stage.mouseY),
         distance: function () {
            return geometry.distance(
               this._distancePoint,
               new Point(app.renderingManager?.stage.mouseX, app.renderingManager?.stage.mouseY)
            );
         },
      } as any;

      // Check if we clicked on a track endpoint
      if (mouseAction.container?.name === "track_endpoint") {
         mouseAction.action = MOUSE_DOWN_ACTION.DND_TRACK;
         mouseAction.track = mouseAction.container.track;
         mouseAction.endpoint = mouseAction.container.endpoint;
      }

      if (app.customMouseMode == CUSTOM_MOUSE_ACTION.DRAWING) {
         const color = (document.querySelector('input[name="DrawingColor"]:checked') as HTMLInputElement)?.value;
         const width = (document.querySelector('input[name="DrawingWidth"]:checked') as HTMLInputElement)?.value;

         app.renderingManager?.containers.drawing.addChild((mouseAction.shape = new createjs.Shape()));
         mouseAction.shape.graphics.setStrokeStyle(width, "round", "round").beginStroke(color);
         mouseAction.shape.graphics.mt(event.stageX, event.stageY);
      }

      this.#mouseAction = mouseAction;

      this.#app.renderingManager?.stage?.addEventListener("stagemousemove", this.#boundHandleMouseMove!);
   }

   /**
    * Handle stage mouse up event
    * @param {Event} event - The mouse up event
    */
   handleStageMouseUp(event: any): void {
      let ma = this.#mouseAction;
      const stage = this.#app.renderingManager?.stage;
      try {
         stage.removeEventListener("stagemousemove", this.#boundHandleMouseMove);
         myCanvas.style.cursor = "auto";
         if (ma == null) return;

         let local_point = Point.fromPoint(stage.globalToLocal(stage.mouseX, stage.mouseY));

         //left button
         if (event.nativeEvent.which == 1) {
            if (ma.action === MOUSE_DOWN_ACTION.DND_SIGNAL) {
               this.#app.renderingManager?.containers.overlay.removeChild(ma.container);

               if (ma.hit_track) {
                  this.#app.renderingManager?.containers.signals.addChild(ma.container);
                  const signal = ma.container.data;
                  ma.hit_track.track.AddSignal(signal, ma.hit_track.km, ma.hit_track.above, ma.hit_track.flipped);
               } else {
                  Signal.removeSignal(ma.container.data);
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
               if (hit?.name == "track") {                  
                  const track = hit.data;
                  const hitInfo = this.getHitInfoForSignalPositioning(local_point);
                  const km = hitInfo.km;
                  Train.addTrain(track, 3,km,Train.CAR_TYPES.PASSENGER)
                  this.#app.renderingManager?.renderer.renderAllTrains();
                  STORAGE.save();
               }
            } else if (NumberUtils.is(ma.action, MOUSE_DOWN_ACTION.MOVE_TRAIN, MOUSE_DOWN_ACTION.MOVE_OBJECT)) {
               STORAGE.save();
               STORAGE.saveUndoHistory();
            } else if (ma.action === MOUSE_DOWN_ACTION.CUSTOM) {
               if (this.#app.customMouseMode == CUSTOM_MOUSE_ACTION.DRAWING) {
                  this.#mouseAction.shape.graphics.endStroke();
               } else if (this.#app.customMouseMode == CUSTOM_MOUSE_ACTION.TEXT) {
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
                  this.#app.renderingManager?.containers.overlay.removeAllChildren();
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
                  if (ma.container?.name == "decouplingPoint") {
                     Train.handleDecouplingClick(ma.container.data);
                  } else {
                     Train.exitDecouplingMode();
                  }
               } else if (this.#app.customMouseMode === CUSTOM_MOUSE_ACTION.TRAIN_COUPLE) {
                  if (ma.container?.name == "couplingPoint") {
                     Train.handleCouplingClick(ma.container.data);
                  } else {
                     Train.exitCouplingMode();
                  }
               }
            } else if (ma.action === MOUSE_DOWN_ACTION.NONE && ma.distance() < INPUT.MOUSE_MOVEMENT_THRESHOLD) {
               if (ma.container?.name == "signal") {
                  this.#app.selectObject(ma.container.data, event);
               } else if (
                  ma.container?.name == "couplingPoint" &&
                  this.#app.customMouseMode === CUSTOM_MOUSE_ACTION.TRAIN_COUPLE
               ) {
                  // Handle coupling at this point
                  Train.handleCouplingClick(ma.container.data);
               } else if (ma.container?.name == "train") {
                  this.#app.selectObject(ma.container.data, event);
               } else if (ma.container?.name == "track") {
                  this.#app.selectObject(ma.container.data, event);
               } else if (ma.container?.name == "GenericObject") {
                  this.#app.selectObject(ma.container.data, event);
               } else if (ma.container?.name == "switch") {
                  Switch.switch_A_Switch(ma.container.data, local_point.x);
                  this.#app.renderingManager?.renderer.renderSwitchUI(ma.container.data);
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
         this.#app.renderingManager?.containers.overlay.removeAllChildren();
         this.#app.renderingManager?.update();
      }
   }

   /**
    * Handle mouse move event
    * @param {Event} event - The mouse move event
    */
   handleMouseMove(event: any): void {
      // Eraser drag logic

      if (!event.primary) return;
      if (this.#mouseAction == null) {
         this.#app.renderingManager?.stage.removeEventListener("stagemousemove", this.#boundHandleMouseMove);
         return;
      }
      //falls mouseMove noch läuft, obwohl der User keinen button mehr drückt
      //tritt vor allem beim debugging auf
      if (event.nativeEvent.buttons == 0) {
         console.log("debug mouse error");
         return this.handleStageMouseUp(event);
      }

      let local_point = this.#app.renderingManager?.stage.globalToLocal(
         this.#app.renderingManager?.stage.mouseX,
         this.#app.renderingManager?.stage.mouseY
      );

      if (this.#mouseAction.action === MOUSE_DOWN_ACTION.NONE) {
         this.determineMouseAction(event, local_point);
      } else if (this.#mouseAction.action === MOUSE_DOWN_ACTION.CUSTOM) {
         if (this.#app.customMouseMode == CUSTOM_MOUSE_ACTION.DRAWING) {
            this.#mouseAction.shape.graphics.lt(local_point.x, local_point.y);
         } else if (this.#app.customMouseMode == CUSTOM_MOUSE_ACTION.ERASER) {
            const local = this.#app.renderingManager?.stage.globalToLocal(
               this.#app.renderingManager?.stage.mouseX,
               this.#app.renderingManager?.stage.mouseY
            );
            const drawingContainer = this.#app.renderingManager?.containers.drawing;
            const hit = drawingContainer.getObjectUnderPoint(local.x, local.y, 1);
            if (hit) {
               drawingContainer.removeChild(hit);
               this.#app.renderingManager?.update();
            }
         } else if (this.#app.customMouseMode == CUSTOM_MOUSE_ACTION.PLATTFORM) {
            this.#app.renderingManager?.containers.overlay.removeAllChildren();
            this.#app.renderingManager?.containers.overlay.addChild((this.#mouseAction.shape = new createjs.Shape()));
            this.#mouseAction.shape.graphics
               .beginStroke(COLORS.DRAWING_PLATTFORM)
               .drawRect(
                  this.#mouseAction.startPoint.x,
                  this.#mouseAction.startPoint.y,
                  local_point.x - this.#mouseAction.startPoint.x,
                  local_point.y - this.#mouseAction.startPoint.y
               );
            this.#app.renderingManager?.update();
         }
      } else if (this.#mouseAction.action === MOUSE_DOWN_ACTION.MOVE_OBJECT) {
         const o = this.#mouseAction.container.data;
         o.pos(local_point);
         if (this.#mouseAction.offset) {
            let p = this.#mouseAction.container.localToLocal(
               this.#mouseAction.offset.x,
               this.#mouseAction.offset.y,
               this.#app.renderingManager?.stage
            );
            local_point.x -= p.x - this.#mouseAction.container.x;
            local_point.y -= p.y - this.#mouseAction.container.y;
         }
         this.#mouseAction.container.x = local_point.x;
         this.#mouseAction.container.y = local_point.y;
         this.#app.renderingManager?.renderer.updateSelection();
      } else if (this.#mouseAction.action === MOUSE_DOWN_ACTION.DND_SIGNAL) {
         this.dragnDropSignal(local_point, event.nativeEvent.altKey);
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
         this.#app.renderingManager?.scroll(event.nativeEvent.movementX, event.nativeEvent.movementY);
      } else if (this.#mouseAction.action === MOUSE_DOWN_ACTION.MOVE_TRAIN) {
         Train.moveTrain(this.#mouseAction.container.data, event.nativeEvent.movementX);
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
      let local_point = this.#app.renderingManager?.stage.globalToLocal(
         this.#app.renderingManager?.stage.mouseX,
         this.#app.renderingManager?.stage.mouseY
      );
      return (container ? container : this.#app.renderingManager?.stage).getObjectUnderPoint(local_point.x, local_point.y, 1);
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
   determineMouseAction(event: any, local_point: Point): void {
      let ma = this.#mouseAction;
      //wie weit wurde die maus seit mousedown bewegt
      if (ma.distance() > INPUT.MOUSE_MOVEMENT_THRESHOLD) {
         if (event.nativeEvent.buttons == 1) {
            if (this.#app.editMode) {
               if (ma.container?.name == "signal") {
                  myCanvas.style.cursor = "move";
                  ma.action = MOUSE_DOWN_ACTION.DND_SIGNAL;
                  ma.container.data._positioning.track.removeSignal(ma.container.data);
                  this.startDragAndDropSignal();
               } else if (ma.container?.name == "GenericObject") {
                  myCanvas.style.cursor = "move";
                  ma.action = MOUSE_DOWN_ACTION.MOVE_OBJECT;
               } else if (ma.container?.name == "track" || ma.container?.name == "switch" || ma.container == null) {
                  ma.action = MOUSE_DOWN_ACTION.BUILD_TRACK;
                  this.addTrackAnchorPoint(this.getSnapPoint(local_point));
                  this.#app.renderingManager?.containers.overlay.addChild((ma.lineShape = new createjs.Shape()));
               }
            }
            if (ma.container?.name == "train") {
               ma.action = MOUSE_DOWN_ACTION.MOVE_TRAIN;
            }
         } else if (event.nativeEvent.buttons == 2) {
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
         ma.container.rotation = 0;
         if (ma.offset) {
            let p = ma.container.localToLocal(ma.offset.x, ma.offset.y, this.#app.renderingManager?.stage);
            local_point.x -= p.x - ma.container.x;
            local_point.y -= p.y - ma.container.y;
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
      let shape = this.#app.renderingManager?.containers.overlay.getChildByName("SignalPositionLine");
      if (shape) this.#app.renderingManager?.containers.overlay.removeChild(shape);

      if (this.#mouseAction.hit_track) {
         const point = this.#mouseAction.hit_track.point;
         shape = new createjs.Shape();
         shape.name = "SignalPositionLine";
         shape.graphics
            .setStrokeStyle(1)
            .beginStroke(COLORS.SIGNAL_POSITION_LINE)
            .mt(this.#mouseAction.container.x, this.#mouseAction.container.y)
            .lt(point.x, point.y)
            .es();
         this.#app.renderingManager?.containers.overlay.addChild(shape);
      }
   }

   /**
    * Draw blueprint track
    */
   drawBluePrintTrack(invalid: boolean = false): void {
      if (this.#mouseAction.nodes == null) return;
      const g = this.#mouseAction.lineShape.graphics;
      g.c()
         .setStrokeStyle(trackRendering_basic.STROKE)
         .beginStroke(COLORS.DRAWING_BLUEPRINT)
         .moveTo(this.#mouseAction.nodes[0].x, this.#mouseAction.nodes[0].y);

      for (let index = 1; index < this.#mouseAction.nodes.length; index++) {
         const point = this.#mouseAction.nodes[index];
         g.lt(point.x, point.y);
      }

      const last = ArrayUtils.last(this.#mouseAction.nodes) as any;
      const p = this.#app.renderingManager?.stage.globalToLocal(
         this.#app.renderingManager?.stage.mouseX,
         this.#app.renderingManager?.stage.mouseY
      );
      g.beginStroke(invalid ? COLORS.DRAWING_INVALID : COLORS.DRAWING_ACTIVE)
         .moveTo(last.x, last.y)
         .lt(p.x, p.y)
         .endStroke();
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
         this.#mouseAction.container = SignalRenderer.createSignalContainer(signal);
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
   #handleImageExport(e: any): void {
      const stage = this.#app.renderingManager?.stage;
      let backup = { x: stage.x, y: stage.y, scale: stage.scale, canvas: stage.canvas };

      try {
         const custom_scale = 2;
         stage.enableDOMEvents(false);

         stage.scale = custom_scale;

         this.#app.renderingManager?.reDrawEverything(true, true);

         let bounds = this.#app.renderingManager?.containers.main.getBounds();
         if (!bounds) {
            ui.showInfoToast("Nix zu sehen");
            return;
         }
         const anotherCanvas = $("<canvas>", { id: "test" })
            .attr("width", bounds.width * custom_scale)
            .attr("height", bounds.height * custom_scale);
         stage.canvas = anotherCanvas[0];
         stage.x = bounds.x * -custom_scale;
         stage.y = bounds.y * -custom_scale;
         this.#app.renderingManager!.setGridVisible(false);
         this.#app.renderingManager!.containers.drawing.visible = false;
         this.#app.renderingManager!.containers.ui.visible = false;
         stage.update();

         let img_data = stage.toDataURL("#00000000", "image/png");
         const img = $("<img>", { src: img_data, width: "100%" }).css("object-fit", "scale-down").css("max-height", "50vh");
         ui.showModalDialog(img, () => {
            const a = $("<a>", { download: "gleisplan.png", href: img_data });
            a[0].click();
         });
      } catch (error) {
         ui.showErrorToast(error as Error);
      } finally {
         stage.x = backup.x;
         stage.y = backup.y;
         stage.scale = backup.scale;
         stage.canvas = backup.canvas;
         this.#app.renderingManager!.setGridVisible(this.#app.showGrid);
         this.#app.renderingManager!.containers.drawing.visible = true;
         this.#app.renderingManager!.containers.ui.visible = true;
         this.#app.renderingManager?.reDrawEverything(true);
         stage.enableDOMEvents(true);
         stage.update();
      }
   }

   /**
    * Handle draw toggle
    * @private
    */
   #handleDrawToggle(e: any): void {
      this.#app.customMouseMode = $("#btnDraw").hasClass("active") ? CUSTOM_MOUSE_ACTION.DRAWING : CUSTOM_MOUSE_ACTION.NONE;
      $("#btnDrawingEraser").removeClass("active");
      const bsOffcanvas = Offcanvas.getOrCreateInstance(document.getElementById("drawingPanel")!);
      if (this.#app.customMouseMode === CUSTOM_MOUSE_ACTION.DRAWING) {
         bsOffcanvas.show();
      } else {
         bsOffcanvas.hide();
      }
   }

   /**
    * Handle drawing clear
    * @private
    */
   #handleDrawingClear(e: any): void {
      this.#app.renderingManager?.containers.drawing.removeAllChildren();
      this.#app.renderingManager?.update();
   }

   /**
    * Handle undo
    * @private
    */
   #handleUndo(e: any): void {
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

      // Remove stage event listeners
      if (this.#app?.renderingManager?.stage) {
         const stage = this.#app.renderingManager?.stage;
         stage?.removeEventListener("stagemousedown", this.#boundHandleStageMouseDown!);
         stage?.removeEventListener("stagemouseup", this.#boundHandleStageMouseUp!);
         stage?.removeEventListener("stagemousemove", this.#boundHandleMouseMove!);
      }

      // Remove canvas event listeners
      myCanvas?.removeEventListener("wheel", this.#boundHandleWheelEvent!);
      myCanvas?.removeEventListener("touchstart", this.#boundHandleTouchStart!);
      myCanvas?.removeEventListener("touchmove", this.#boundHandleTouchMove!);

      // Remove document event listeners
      document.removeEventListener("keydown", this.#boundHandleKeyDown!);

      // Remove window event listeners
      $(window).off("resize", this.#boundHandleWindowResize!);
   }
}
