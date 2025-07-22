"use strict";

// ES6 Module imports
import { CONFIG, INPUT, CUSTOM_MOUSE_ACTION, MOUSE_DOWN_ACTION, COLORS, COMPUTED, MENU } from "../config.js";
import { STORAGE } from "../storage.js";
import { ui } from "../ui.js";
import { Point, geometry, TOOLS } from "../tools.js";
import { ArrayUtils, NumberUtils } from "../utils.js";
import { Signal, SignalRenderer } from "../signal.js";
import { Train } from "../train.js";
import { Track } from "../track.js";
import { Switch } from "../switch.js";
import { GenericObject } from "../generic_object.js";
import { trackRendering_basic } from "../trackRendering_basic.js";

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
   #app = null;
   #eventListeners = new Map();
   #previousTouch = null;

   // Store bound function references for proper event listener removal
   #boundHandleStageMouseDown = null;
   #boundHandleStageMouseUp = null;
   #boundHandleMouseMove = null;
   #boundHandleWheelEvent = null;
   #boundHandleKeyDown = null;
   #boundHandleWindowResize = null;
   #boundHandleTouchStart = null;
   #boundHandleTouchMove = null;

   constructor(application) {
      this.#app = application;
   }

   /**
    * Initialize all event listeners
    */
   initialize() {
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
      this._test = null;
   }

   /**
    * Initialize stage-specific events
    * @private
    */
   #initializeStageEvents() {
      const stage = this.#app.renderingManager.stage;

      stage.addEventListener("stagemousedown", this.#boundHandleStageMouseDown);
      stage.addEventListener("stagemouseup", this.#boundHandleStageMouseUp);
   }

   /**
    * Initialize canvas-specific events
    * @private
    */
   #initializeCanvasEvents() {
      // Wheel event for zooming
      myCanvas.addEventListener("wheel", this.#boundHandleWheelEvent);
   }

   /**
    * Initialize touch events
    * @private
    */
   #initializeTouchEvents() {
      if (!createjs.Touch.isSupported()) return;

      const canvas = myCanvas;
      canvas.addEventListener("touchstart", this.#boundHandleTouchStart);
      canvas.addEventListener("touchmove", this.#boundHandleTouchMove);
   }

   /**
    * Initialize button events
    * @private
    */
   #initializeButtonEvents() {
      // Edit mode toggle
      $("#btnDrawTracks,#btnPlay").click(() => this.#app.toggleEditMode());

      // Renderer switch
      $("#switch_renderer").on("change", (e) => {
         this.#app.renderingManager.selectRenderer(!$("#switch_renderer").is(":checked"));
         STORAGE.save();
      });

      // Menu buttons
      $("#btnAddSignals").click(() => this.#app.uiManager.showMenu(MENU.NEW_SIGNAL));
      $("#btnAddTrain").click(() => this.#app.uiManager.showMenu(MENU.NEW_TRAIN));
      $("#btnAddObject").click(() => this.#app.uiManager.showMenu(MENU.NEW_OBJECT));
      $("#btnDownload").click(() => STORAGE.downloadAsFile());

      // Action buttons
      $("#btnClear").click(() => this.#app.renderingManager.clear());
      $("#btnCenter").click(() => this.#app.renderingManager.center());
      $("#btnRedraw").click(() => this.#app.renderingManager.forceRedraw());
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
   #initializeKeyboardEvents() {
      document.addEventListener("keydown", this.#boundHandleKeyDown);
   }

   /**
    * Initialize window events
    * @private
    */
   #initializeWindowEvents() {
      $(window).resize(this.#boundHandleWindowResize);
   }

   /**
    * Handle wheel event for zooming
    * @private
    */
   #handleWheelEvent(event) {
      event.preventDefault();
      this.#app.renderingManager.zoom(event.deltaY);
   }

   /**
    * Handle touch start event
    * @private
    */
   #handleTouchStart(event) {
      if (event.touches.length === 1) {
         let touch = event.touches[0];
         //startTrackDrawing(this.#application.stage.globalToLocal(touch.clientX, touch.clientY));
      }
   }

   /**
    * Handle touch move event
    * @private
    */
   #handleTouchMove(event) {
      if (event.touches.length === 1) {
         let touch = event.touches[0];

         if (this.#previousTouch) {
            // be aware that these only store the movement of the first touch in the touches array
            this.#app.renderingManager.stage.x += touch.clientX - this.#previousTouch.clientX;
            this.#app.renderingManager.stage.y += touch.clientY - this.#previousTouch.clientY;

            this.#app.renderingManager.drawGrid(false);
            this.#app.renderingManager.reDrawEverything();
         }

         this.#previousTouch = touch;
      }
   }

   /**
    * Handle stage mouse down event
    * @param {Event} event - The mouse down event
    */
   handleStageMouseDown(event) {
      let hittest = this.getHitTest();
      console.log(hittest);
      let mouseAction = {
         action: app.customMouseMode != CUSTOM_MOUSE_ACTION.NONE ? MOUSE_DOWN_ACTION.CUSTOM : MOUSE_DOWN_ACTION.NONE,
         container: hittest,
         startPoint: app.renderingManager.stage.globalToLocal(
            app.renderingManager.stage.mouseX,
            app.renderingManager.stage.mouseY
         ),
         _distancePoint: new Point(event.stageX, event.stageY),
         offset: hittest?.globalToLocal(app.renderingManager.stage.mouseX, app.renderingManager.stage.mouseY),
         distance: function () {
            return geometry.distance(
               this._distancePoint,
               new Point(app.renderingManager.stage.mouseX, app.renderingManager.stage.mouseY)
            );
         },
      };

      // Check if we clicked on a track endpoint
      if (mouseAction.container?.name === "track_endpoint") {
         mouseAction.action = MOUSE_DOWN_ACTION.DND_TRACK;
         mouseAction.track = mouseAction.container.track;
         mouseAction.endpoint = mouseAction.container.endpoint;
      }

      if (app.customMouseMode == CUSTOM_MOUSE_ACTION.DRAWING) {
         const color = document.querySelector('input[name="DrawingColor"]:checked').value;
         const width = document.querySelector('input[name="DrawingWidth"]:checked').value;

         app.renderingManager.containers.drawing.addChild((mouseAction.shape = new createjs.Shape()));
         mouseAction.shape.graphics.setStrokeStyle(width, "round", "round").beginStroke(color);
         mouseAction.shape.graphics.mt(event.stageX, event.stageY);
      }

      app.mouseAction = mouseAction;

      app.renderingManager.stage.addEventListener("stagemousemove", this.#boundHandleMouseMove);
   }

   /**
    * Handle stage mouse up event
    * @param {Event} event - The mouse up event
    */
   handleStageMouseUp(event) {
      let ma = this.#app.mouseAction;
      const stage = this.#app.renderingManager.stage;
      try {
         stage.removeEventListener("stagemousemove", this.#boundHandleMouseMove);
         myCanvas.style.cursor = "auto";
         if (ma == null) return;

         let local_point = Point.fromPoint(stage.globalToLocal(stage.mouseX, stage.mouseY));

         //left button
         if (event.nativeEvent.which == 1) {
            if (ma.action === MOUSE_DOWN_ACTION.DND_SIGNAL) {
               this.#app.renderingManager.containers.overlay.removeChild(ma.container);

               if (ma.hit_track) {
                  this.#app.renderingManager.containers.signals.addChild(ma.container);
                  const signal = ma.container.data;
                  ma.hit_track.track.AddSignal(signal, ma.hit_track.km, ma.hit_track.above, ma.hit_track.flipped);
               } else {
                  Signal.removeSignal(ma.container.data);
               }
               this.#app.renderingManager.renderer.reDrawEverything(true);
               STORAGE.save();
               STORAGE.saveUndoHistory();
            } else if (ma.action === MOUSE_DOWN_ACTION.BUILD_TRACK) {
               if (ma.nodes.length > 0) {
                  Track.checkNodesAndCreateTracks(ma.nodes);
                  Track.createRailNetwork();
                  Train.allTrains.forEach((t) => t.restore());
                  this.#app.renderingManager.renderer.reDrawEverything(true);
                  STORAGE.saveUndoHistory();
                  STORAGE.save();
               }
            } else if (ma.action === MOUSE_DOWN_ACTION.DND_TRACK) {
               this.#app.renderingManager.renderer.reDrawEverything(true);
               STORAGE.saveUndoHistory();
               STORAGE.save();
            } else if (ma.action === MOUSE_DOWN_ACTION.ADD_TRAIN) {
               this.#app.renderingManager.containers.overlay.removeChild(ma.container);
               const hit = this.getHitTest(this.#app.renderingManager.containers.tracks);
               if (hit?.name == "track") {
                  const color = ArrayUtils.random(COLORS.TRAIN_COLORS);
                  const track = hit.data;
                  const hitInfo = this.getHitInfoForSignalPositioning(local_point);
                  let train, car, car2;
                  const km = hitInfo.km;

                  // Create locomotive as the first car
                  car = train = Train.addTrain(track, km, color, Train.CAR_TYPES.LOCOMOTIVE, "");

                  // Add passenger cars
                  car2 = Train.addTrain(track, km, color, Train.CAR_TYPES.PASSENGER, "");
                  car.coupleBack(car2);
                  car = car2;

                  // Add another passenger car
                  car2 = Train.addTrain(track, km, color, Train.CAR_TYPES.PASSENGER, "");
                  car.coupleBack(car2);
                  car = car2;

                  // Add a third passenger car
                  car2 = Train.addTrain(track, km, color, Train.CAR_TYPES.PASSENGER, "");
                  car.coupleBack(car2);

                  // Update train positions
                  Train.moveTrain(train, 0);
                  this.#app.renderingManager.renderer.renderAllTrains();
                  STORAGE.save();
               }
            } else if (NumberUtils.is(ma.action, MOUSE_DOWN_ACTION.MOVE_TRAIN, MOUSE_DOWN_ACTION.MOVE_OBJECT)) {
               STORAGE.save();
               STORAGE.saveUndoHistory();
            } else if (ma.action === MOUSE_DOWN_ACTION.CUSTOM) {
               if (this.#app.customMouseMode == CUSTOM_MOUSE_ACTION.DRAWING) {
                  this.#app.mouseAction.shape.graphics.endStroke();
               } else if (this.#app.customMouseMode == CUSTOM_MOUSE_ACTION.TEXT) {
                  const o = new GenericObject(GenericObject.OBJECT_TYPE.text).pos(local_point).content("Text");
                  GenericObject.all_objects.push(o);
                  this.#app.selectObject(o);
                  this.#app.renderingManager.renderer.renderAllGenericObjects();
                  this.#app.customMouseMode = CUSTOM_MOUSE_ACTION.NONE;
                  STORAGE.saveUndoHistory();
                  STORAGE.save();
               } else if (this.#app.customMouseMode == CUSTOM_MOUSE_ACTION.PLATTFORM) {
                  this.#app.renderingManager.containers.overlay.removeAllChildren();
                  const o = new GenericObject(GenericObject.OBJECT_TYPE.plattform)
                     .content("Bahnsteig")
                     .pos(ma.startPoint)
                     .size(local_point.x - ma.startPoint.x, local_point.y - ma.startPoint.y);
                  GenericObject.all_objects.push(o);
                  this.#app.renderingManager.renderer.renderAllGenericObjects();
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
                  this.#app.renderingManager.renderer.renderSwitchUI(ma.container.data);
               } else {
                  this.#app.selectObject();
               }
            }
         } else if (ma.action === MOUSE_DOWN_ACTION.SCROLL) {
            STORAGE.save();
         }
      } catch (error) {
         ui.showErrorToast(error);
      } finally {
         ma = null;
         this.#app.renderingManager.containers.overlay.removeAllChildren();
         this.#app.renderingManager.update();
      }
   }

   /**
    * Handle mouse move event
    * @param {Event} event - The mouse move event
    */
   handleMouseMove(event) {
      // Eraser drag logic

      if (!event.primary) return;
      if (this.#app.mouseAction == null) {
         this.#app.renderingManager.stage.removeEventListener("stagemousemove", this.#boundHandleMouseMove);
         return;
      }
      //falls mouseMove noch läuft, obwohl der User keinen button mehr drückt
      //tritt vor allem beim debugging auf
      if (event.nativeEvent.buttons == 0) {
         console.log("debug mouse error");
         return this.handleStageMouseUp(event);
      }

      let local_point = this.#app.renderingManager.stage.globalToLocal(
         this.#app.renderingManager.stage.mouseX,
         this.#app.renderingManager.stage.mouseY
      );

      if (this.#app.mouseAction.action === MOUSE_DOWN_ACTION.NONE) {
         this.determineMouseAction(event, local_point);
      } else if (this.#app.mouseAction.action === MOUSE_DOWN_ACTION.CUSTOM) {
         if (this.#app.customMouseMode == CUSTOM_MOUSE_ACTION.DRAWING) {
            this.#app.mouseAction.shape.graphics.lt(local_point.x, local_point.y);
         } else if (this.#app.customMouseMode == CUSTOM_MOUSE_ACTION.ERASER) {
            const local = this.#app.renderingManager.stage.globalToLocal(
               this.#app.renderingManager.stage.mouseX,
               this.#app.renderingManager.stage.mouseY
            );
            const drawingContainer = this.#app.renderingManager.containers.drawing;
            const hit = drawingContainer.getObjectUnderPoint(local.x, local.y, 1);
            if (hit) {
               drawingContainer.removeChild(hit);
               this.#app.renderingManager.update();
            }
         } else if (this.#app.customMouseMode == CUSTOM_MOUSE_ACTION.PLATTFORM) {
            this.#app.renderingManager.containers.overlay.removeAllChildren();
            this.#app.renderingManager.containers.overlay.addChild((this.#app.mouseAction.shape = new createjs.Shape()));
            this.#app.mouseAction.shape.graphics
               .beginStroke(COLORS.DRAWING_PLATTFORM)
               .drawRect(
                  this.#app.mouseAction.startPoint.x,
                  this.#app.mouseAction.startPoint.y,
                  local_point.x - this.#app.mouseAction.startPoint.x,
                  local_point.y - this.#app.mouseAction.startPoint.y
               );
            this.#app.renderingManager.update();
         }
      } else if (this.#app.mouseAction.action === MOUSE_DOWN_ACTION.MOVE_OBJECT) {
         const o = this.#app.mouseAction.container.data;
         o.pos(local_point);
         if (this.#app.mouseAction.offset) {
            let p = this.#app.mouseAction.container.localToLocal(
               this.#app.mouseAction.offset.x,
               this.#app.mouseAction.offset.y,
               this.#app.renderingManager.stage
            );
            local_point.x -= p.x - this.#app.mouseAction.container.x;
            local_point.y -= p.y - this.#app.mouseAction.container.y;
         }
         this.#app.mouseAction.container.x = local_point.x;
         this.#app.mouseAction.container.y = local_point.y;
         this.#app.renderingManager.renderer.updateSelection();
      } else if (this.#app.mouseAction.action === MOUSE_DOWN_ACTION.DND_SIGNAL) {
         this.dragnDropSignal(local_point, event.nativeEvent.altKey);
         this.#app.renderingManager.renderer.updateSelection();
      } else if (this.#app.mouseAction.action === MOUSE_DOWN_ACTION.BUILD_TRACK) {
         const grid_snap_point = this.getSnapPoint(local_point);
         let valid = Track.isValidTrackNodePoint(grid_snap_point, this.#app.mouseAction.nodes);

         if (geometry.distance(local_point, grid_snap_point) <= CONFIG.SNAP_TO_GRID) {
            // If the node already exists, revert to that node by removing any nodes after it
            const existingIndex = this.#app.mouseAction.nodes.findIndex((node) => node.equals(grid_snap_point));
            if (existingIndex !== -1) {
               // Keep nodes up to and including the found node
               this.#app.mouseAction.nodes = this.#app.mouseAction.nodes.slice(0, existingIndex + 1);
            } else if (valid) {
               this.addTrackAnchorPoint(grid_snap_point);
            } else {
               valid = false;
            }
         }
         this.drawBluePrintTrack(!valid);
      } else if (this.#app.mouseAction.action === MOUSE_DOWN_ACTION.SCROLL) {
         app.renderingManager.scroll(event.nativeEvent.movementX, event.nativeEvent.movementY);
      } else if (this.#app.mouseAction.action === MOUSE_DOWN_ACTION.MOVE_TRAIN) {
         Train.moveTrain(this.#app.mouseAction.container.data, event.nativeEvent.movementX);
         this.#app.renderingManager.reDrawEverything();
      } else if (this.#app.mouseAction.action === MOUSE_DOWN_ACTION.ADD_TRAIN) {
         this.#app.mouseAction.container.x = local_point.x;
         this.#app.mouseAction.container.y = local_point.y;
      } else if (this.#app.mouseAction.action === MOUSE_DOWN_ACTION.DND_TRACK) {
         const grid_snap_point = this.getSnapPoint(local_point);

         if (geometry.distance(local_point, grid_snap_point) <= CONFIG.SNAP_TO_GRID) {
            if (Track.isValidTrackNodePoint(grid_snap_point)) {
               if (this.#app.mouseAction.endpoint === "start") {
                  this.#app.mouseAction.track.setNewStart(grid_snap_point);
               } else {
                  this.#app.mouseAction.track.setNewEnd(grid_snap_point);
               }
               Track.createRailNetwork();
               this.#app.renderingManager.renderer.reDrawEverything(true);
            }
         }
      }

      this.#app.renderingManager.update();
   }

   /**
    * Get hit test result
    * @param {*} container - Container to test against
    * @returns {*} The hit object
    */
   getHitTest(container) {
      let local_point = this.#app.renderingManager.stage.globalToLocal(
         this.#app.renderingManager.stage.mouseX,
         this.#app.renderingManager.stage.mouseY
      );
      return (container ? container : this.#app.renderingManager.stage).getObjectUnderPoint(local_point.x, local_point.y, 1);
   }

   /**
    * Get hit info for signal positioning
    * @param {Point} testPoint - Point to test
    * @returns {*} Hit information
    */
   getHitInfoForSignalPositioning(testPoint) {
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
   determineMouseAction(event, local_point) {
      let ma = this.#app.mouseAction;
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
                  this.#app.renderingManager.containers.overlay.addChild((ma.lineShape = new createjs.Shape()));
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
   dragnDropSignal(local_point, flipped) {
      let ma = this.#app.mouseAction;

      let hitInformation = this.getHitInfoForSignalPositioning(local_point);
      if (hitInformation) {
         hitInformation.flipped = flipped;
         ma.hit_track = hitInformation;
         console.log(hitInformation);
         this.#app.alignSignalContainerWithTrack(ma.container, hitInformation);
      } else {
         ma.hit_track = null;
         ma.container.rotation = 0;
         if (ma.offset) {
            let p = ma.container.localToLocal(ma.offset.x, ma.offset.y, this.#app.renderingManager.stage);
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
   draw_SignalPositionLine() {
      let shape = this.#app.renderingManager.containers.overlay.getChildByName("SignalPositionLine");
      if (shape) this.#app.renderingManager.containers.overlay.removeChild(shape);

      if (this.#app.mouseAction.hit_track) {
         const point = this.#app.mouseAction.hit_track.point;
         shape = new createjs.Shape();
         shape.name = "SignalPositionLine";
         shape.graphics
            .setStrokeStyle(1)
            .beginStroke(COLORS.SIGNAL_POSITION_LINE)
            .mt(this.#app.mouseAction.container.x, this.#app.mouseAction.container.y)
            .lt(point.x, point.y)
            .es();
         this.#app.renderingManager.containers.overlay.addChild(shape);
      }
   }

   /**
    * Draw blueprint track
    */
   drawBluePrintTrack(invalid = false) {
      if (this.#app.mouseAction.nodes == null) return;
      const g = this.#app.mouseAction.lineShape.graphics;
      g.c()
         .setStrokeStyle(trackRendering_basic.STROKE)
         .beginStroke(COLORS.DRAWING_BLUEPRINT)
         .moveTo(this.#app.mouseAction.nodes[0].x, this.#app.mouseAction.nodes[0].y);

      for (let index = 1; index < this.#app.mouseAction.nodes.length; index++) {
         const point = this.#app.mouseAction.nodes[index];
         g.lt(point.x, point.y);
      }

      const last = ArrayUtils.last(this.#app.mouseAction.nodes);
      const p = this.#app.renderingManager.stage.globalToLocal(
         this.#app.renderingManager.stage.mouseX,
         this.#app.renderingManager.stage.mouseY
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
   addTrackAnchorPoint(p) {
      if (this.#app.mouseAction.nodes == null) {
         this.#app.mouseAction.nodes = [];
      }

      this.#app.mouseAction.nodes.push(p);
   }

   /**
    * Get snap point
    * @param {Point} local_point - Local point coordinates
    * @returns {Point} Snap point
    */
   getSnapPoint(local_point) {
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
   startDragAndDropSignal(mouseX, mouseY) {
      if (this.#app.mouseAction.container) {
         this.#app.mouseAction.container.parent.removeChild(this.#app.mouseAction.container);
      } else {
         let signal = new Signal(this.#app.mouseAction.template);
         this.#app.mouseAction.container = SignalRenderer.createSignalContainer(signal);
         this.#app.mouseAction.container.x = mouseX;
         this.#app.mouseAction.container.y = mouseY;
      }

      this.#app.renderingManager.containers.overlay.addChild(this.#app.mouseAction.container);
      this.#app.renderingManager.update();
   }

   /**
    * Handle key down event
    * @private
    */
   #handleKeyDown(e) {
      if (e.target.tagName != "INPUT" && (e.code == "Delete" || e.code == "Backspace")) {
         this.#app.deleteSelectedObject();
      }
   }

   /**
    * Handle window resize event
    * @private
    */
   #handleWindowResize() {
      this.#app.renderingManager.onResizeWindow();
   }

   /**
    * Handle image export
    * @private
    */
   #handleImageExport(e) {
      // Image export functionality will be moved here
   }

   /**
    * Handle draw toggle
    * @private
    */
   #handleDrawToggle(e) {
      this.#app.customMouseMode = $("#btnDraw").hasClass("active") ? CUSTOM_MOUSE_ACTION.DRAWING : CUSTOM_MOUSE_ACTION.NONE;
      $("#btnDrawingEraser").removeClass("active");
      const bsOffcanvas = bootstrap.Offcanvas.getOrCreateInstance(document.getElementById("drawingPanel"));
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
   #handleDrawingClear(e) {
      this.#app.renderingManager.containers.drawing.removeAllChildren();
      this.#app.renderingManager.update();
   }

   /**
    * Handle undo
    * @private
    */
   #handleUndo(e) {
      this.#app.undo();
   }

   /**
    * Handle signal edit click
    * @private
    */
   #handleSignalEditClick() {
      $("#signalEditMenuHeader .card-text").hide();
      $("#signalEditMenuHeader input")
         .val(this.#app.selection.object.get("bez"))
         .show()
         .focus()
         .on(
            "keydown",
            function (e) {
               if (e.key === "Enter") {
                  this.#app.selection.object.set_stellung("bez", $(this).val());
                  $("#signalEditMenuHeader .card-text").show();
                  $("#signalEditMenuHeader input").hide();
                  Sig_UI.syncSignalMenu(this.#app.selection.object);
                  STORAGE.save();
                  this.#app.renderingManager.renderer.reDrawEverything(true);
                  this.#app.renderingManager.update();
               }
            }.bind(this)
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
   on(eventType, listener) {
      if (!this.#eventListeners.has(eventType)) {
         this.#eventListeners.set(eventType, []);
      }
      this.#eventListeners.get(eventType).push(listener);
   }

   /**
    * Unregister an event listener
    * @param {string} eventType - The type of event
    * @param {Function} listener - The event listener function to remove
    */
   off(eventType, listener) {
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
   emit(eventType, data) {
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
   get boundMouseMoveHandler() {
      return this.#boundHandleMouseMove;
   }

   /**
    * Clean up all event listeners
    */
   cleanup() {
      // Remove all event listeners
      this.#eventListeners.clear();

      // Remove stage event listeners
      if (this.#app?.renderingManager?.stage) {
         const stage = this.#app.renderingManager.stage;
         stage.removeEventListener("stagemousedown", this.#boundHandleStageMouseDown);
         stage.removeEventListener("stagemouseup", this.#boundHandleStageMouseUp);
         stage.removeEventListener("stagemousemove", this.#boundHandleMouseMove);
      }

      // Remove canvas event listeners
      if (myCanvas) {
         myCanvas.removeEventListener("wheel", this.#boundHandleWheelEvent);
         myCanvas.removeEventListener("touchstart", this.#boundHandleTouchStart);
         myCanvas.removeEventListener("touchmove", this.#boundHandleTouchMove);
      }

      // Remove document event listeners
      document.removeEventListener("keydown", this.#boundHandleKeyDown);

      // Remove window event listeners
      $(window).off("resize", this.#boundHandleWindowResize);
   }
}
