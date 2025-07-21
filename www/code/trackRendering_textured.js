"use strict";

// ES6 Module imports
import { Track } from "./track.js";
import { Switch } from "./switch.js";
import { Signal, SignalRenderer } from "./signal.js";
import { Train } from "./train.js";
import { GenericObject } from "./generic_object.js";
import { geometry, Point } from "./tools.js";
import { NumberUtils } from "./utils.js";
import { ui } from "./ui.js";
import { CONFIG, COMPUTED } from "./config.js";
import { Application } from "./application.js";

export class trackRendering_textured {
   static SWITCH_UI_STROKE = 3;
   static TRACK_SCALE = 0.25;
   static signale_scale = 0.5;
   static SCHWELLEN_VARIANTEN = 24;
   static CURVATURE_4WAY_SWITCH = 16;
   static RAILS = [
      [3.2, "#222"],
      [2.8, "#999"],
      [1.4, "#eee"],
   ];

   // Define sleeper pattern for 4-way switch
   static FOUR_WAY_SLEEPER_PATTERN = [
      { offset: 1, length: 1.0 }, // Start straight
      { offset: 1.1, length: 1.2 }, // Start straight
      { offset: 1.2, length: 1.5 }, // Begin transition
      { offset: 1.3, length: 1.5 }, // Peak of curve
   ];

   constructor() {
      this.app = Application.getInstance();
      //cause the class is been loaded before start.js, we have to hack and calculate this constant here
      trackRendering_textured.CURVE_RADIUS = CONFIG.GRID_SIZE * 1.21;

      this.SIGNAL_DISTANCE_FROM_TRACK = 45;

      this.LOD = 5;
      this._lastRenderScale = 0;

      // Cache for sleeper shapes and bitmaps
      this._sleeperCache = {};
      this._bitmapCache = new Array(trackRendering_textured.SCHWELLEN_VARIANTEN);
   }

   cleanUp() {
      if (this._idleCallback) {
         if (window.requestIdleCallback) cancelIdleCallback(this._idleCallback);
         else clearTimeout(this._idleCallback);
      }

      const myIdleCallback =
         window.requestIdleCallback ||
         function (callback) {
            return setTimeout(callback, 1);
         };

      this._idleCallback = myIdleCallback(
         function (r) {
            if (this.app.renderingManager.containers.tracks.renderedTracks.size == 0 || this._rendering != null) return;
            const bounds = this.calcCanvasSize();

            // Find tracks that are no longer visible
            const toBeRemoved = [];
            this.app.renderingManager.containers.tracks.renderedTracks.forEach((track) => {
               if (!this.TrackVisible(track, bounds)) {
                  toBeRemoved.push(track);
               }
            });

            // Remove tracks and their associated signals
            toBeRemoved.forEach((track) => {
               // Remove associated signals
               const signalsToBeRemoved = this.app.renderingManager.containers.signals.children.filter(
                  (cs) => cs.data._positioning.track === track
               );
               signalsToBeRemoved.forEach((cs) => {
                  this.app.renderingManager.containers.signals.removeChild(cs);
               });
               // Remove track from rendered set
               this.app.renderingManager.containers.tracks.renderedTracks.delete(track);

               // Remove track elements from both containers
               const sleepersToRemove = this.app.renderingManager.containers.tracks.children[0].children.filter((c) => c.data === track);
               const railsToRemove = this.app.renderingManager.containers.tracks.children[1].children.filter((c) => c.data === track);

               sleepersToRemove.forEach((c) => {
                  delete c.track;
                  this.app.renderingManager.containers.tracks.children[0].removeChild(c);
               });

               railsToRemove.forEach((c) => {
                  delete c.track;
                  this.app.renderingManager.containers.tracks.children[1].removeChild(c);
               });
            });

            // Clean up sleeper cache if it's getting too large (more than 200 entries)
            if (Object.keys(this._sleeperCache).length > 200) {
               this._sleeperCache = {};
            }

            this._idleCallback = null;
         }.bind(this)
      );
   }

   calcCanvasSize() {
      const stage = this.app.renderingManager.stage;
      const width = (stage.canvas.width + CONFIG.GRID_SIZE * 2) / stage.scaleX,
         height = (stage.canvas.height + CONFIG.GRID_SIZE * 2) / stage.scaleY,
         x = (-stage.x - CONFIG.GRID_SIZE) / stage.scaleX,
         y = (-stage.y - CONFIG.GRID_SIZE) / stage.scaleY;
      return { left: x, top: y, right: x + width, bottom: y + height };
   }

   ///force=false means, each element decides if it needs to be redrawn. If something global changed,
   ///like the scale, force needs to be true.
   /// dont_optimize parameter disables the optimasation to only handle and draw elements inside the viewport
   /// and disables caching. its used by the export to image functionality
   reDrawEverything(force = false, dont_optimize = false) {
      if (!Application.getInstance().preLoader.loaded)
         //stupid code that should prevent drawing, before the preloader is ready
         setTimeout(() => {
            this.reDrawEverything(force, dont_optimize);
         }, 500);
      else {
         const containers = this.app.renderingManager.containers;
         if (this._rendering == undefined) {
            try {
               this._rendering = { dont_optimize: dont_optimize };
               this._rendering.screen_rectangle = this.calcCanvasSize();

               if (force) {
                  this.app.renderingManager.containers.removeAllChildren();

                  this.calcRenderValues();
               } else {
                  //if we passed the LOD in either direction we have to rerender the tracks
                  if (NumberUtils.between(this.LOD, this._lastRenderScale, this.app.renderingManager.stage.scale)) {
                     this._rendering.lodChanged = true;
                  }
               }

               try {
                  this.renderAllTracks(force);
                  this.renderAllSignals(force);
                  this.renderAllTrains();
                  this.renderAllGenericObjects();
                  this._lastRenderScale = this.app.renderingManager.stage.scale;
                  if (!dont_optimize) this.cleanUp();
               } catch (error) {
                  console.error("Error during rendering:", error);
                  throw error;
               } finally {
                  delete this._rendering;
                  this.app.renderingManager.update();
               }
            } catch (error) {
               console.error("Critical rendering error:", error);
               ui.showErrorToast(error);
               // Attempt to recover by clearing rendering state
               delete this._rendering;
               throw error;
            }
         }
      }
   }

   calcRenderValues() {
      this.schwellenImg = this.app.preLoader.getImage("schwellen");
      this.bumperImg = this.app.preLoader.getImage("bumper");
      this.sleepersImgWidth = this.schwellenImg.width / trackRendering_textured.SCHWELLEN_VARIANTEN;
      this.schwellenHöhe = this.schwellenImg.height * trackRendering_textured.TRACK_SCALE;
      this.schwellenHöhe_2 = this.schwellenHöhe / 2;
      this.schwellenBreite = this.sleepersImgWidth * trackRendering_textured.TRACK_SCALE;
      this.schwellenGap = this.schwellenBreite * 1.1; // distance between the sleepers
      this.sleeperIntervall = this.schwellenBreite + this.schwellenGap;
      this.rail_offset = this.schwellenHöhe / 4.7; // distance between the rail and the end of the sleeper
      this.rail_distance = this.schwellenHöhe_2 - this.rail_offset; // distance between the rail and the center of the track

      this.TRAIN_HEIGHT = this.schwellenHöhe - this.rail_offset;
      this.TRAIN_WIDTH = CONFIG.GRID_SIZE * 0.7;

      this.main_x1 = (Math.sin(Math.PI / 8) * trackRendering_textured.CURVE_RADIUS) / Math.cos(Math.PI / 8);
   }

   renderAllTrains() {
      this.app.renderingManager.containers.trains.removeAllChildren();

      // Only render trains that aren't coupled to another train's front
      // This ensures we only create containers for lead cars
      Train.allTrains
         .filter((train) => !train.trainCoupledFront)
         .forEach((train) => {
            const c = new createjs.Container();
            c.name = "train";
            c.train = train;
            c.mouseChildren = true;

            // Start rendering from the first car (locomotive)
            this.renderCar(train, c);

            this.app.renderingManager.containers.trains.addChild(c);
         });
   }

   renderCar(car, container) {
      // Create graphics for the car
      const g = new createjs.Graphics();
      g.setStrokeStyle(1);
      g.beginStroke(createjs.Graphics.getRGB(0, 0, 0));
      g.beginFill(car.color);

      // Use the car's actual length for width instead of fixed TRAIN_WIDTH
      const carWidth = car.length;
      const carHeight = this.TRAIN_HEIGHT;

      // Set corner radius based on car type and position in train
      let corner = [1.5, 1.5, 1.5, 1.5];

      // If this is the first car (locomotive), round the front
      if (car.type == Train.CAR_TYPES.LOCOMOTIVE) {
         corner[0] = corner[3] = corner[1] = corner[2] = 8;
      }

      /* // If this is the last car, round the back
      if (car.trainCoupledBack == null) {
         corner[1] = corner[2] = 20;
      } */

      // Draw car with rounded corners
      g.drawRoundRectComplex(0, 0, carWidth, carHeight, corner[0], corner[1], corner[2], corner[3]);

      // Create the shape and position it
      const s = new createjs.Shape(g);
      s.data = car;
      s.mouseChildren = false;
      s.name = "train";

      // Get the position on the track based on the car's km position
      const p = car.track.getPointFromKm(car.pos);

      s.x = p.x;
      s.y = p.y;
      s.regX = carWidth / 2;
      s.regY = carHeight / 2;
      s.rotation = car.track.deg;

      container.addChild(s);
      // Add train number if it exists
      if (car.number && car.type == Train.CAR_TYPES.LOCOMOTIVE) {
         const text = new createjs.Text(car.number, "10px Arial", "#000000");
         text.textAlign = "center";
         text.x = p.x;
         text.y = p.y;
         text.textBaseline = "middle";
         container.addChild(text);
      }
      // Recursively render coupled cars
      if (car.trainCoupledBack) {
         this.renderCar(car.trainCoupledBack, container);
      }
   }

   renderAllGenericObjects() {
      this.app.renderingManager.containers.objects.removeAllChildren();
      GenericObject.all_objects.forEach((o) => {
         const c = new createjs.Container();
         c.name = "GenericObject";
         c.data = o;
         c.mouseChildren = false;
         c.x = o.pos().x;
         c.y = o.pos().y;

         if (o.type() === GenericObject.OBJECT_TYPE.text) this.renderTextObject(o, c);
         else if (o.type() === GenericObject.OBJECT_TYPE.plattform) this.renderPlattformObject(o, c);
         else throw new Error("Unknown Object");

         this.app.renderingManager.containers.objects.addChild(c);
      });
   }

   renderTextObject(text_object, container) {
      var text = new createjs.Text(text_object.content(), "24px Arial", "#000000");
      text.textBaseline = "alphabetic";
      const height = text.getMeasuredHeight();
      const width = text.getMeasuredWidth();

      const hit = new createjs.Shape();
      hit.graphics.beginFill("#000").mt(0, 0).lt(width, 0).lt(width, -height).lt(0, -height).lt(0, 0);

      text.hitArea = hit;

      container.addChild(text);
   }

   renderPlattformObject(plattform, container) {
      const shape = new createjs.Shape();
      container.addChild(shape);
      const size = plattform.size();
      shape.graphics.beginStroke("#111111").beginFill("#444").drawRect(0, 0, size.width, size.height);
      shape.setBounds(0, 0, size.width, size.height);

      var text = new createjs.Text(plattform.content(), "16px Arial", "#eee");
      text.textBaseline = "middle";
      text.textAlign = "center";
      text.x = plattform.size().width / 2;
      text.y = plattform.size().height / 2;

      container.addChild(text);
   }

   renderAllSignals(force) {
      this.app.renderingManager.containers.signals.removeAllChildren();
      Signal.allSignals.forEach((signal) => {
         let container = this.app.renderingManager.containers.signals.addChild(SignalRenderer.createSignalContainer(signal));
         this.app.alignSignalContainerWithTrack(container, signal._positioning);
      });
   }

   renderAllTracks(force) {
      const containers = this.app.renderingManager.containers;
      //if we have to force a redraw, we have to create the containers for the sleepers and rails
      if (force) {
         const sleepers_container = new createjs.Container();
         sleepers_container.name = "global_sleepers";
         sleepers_container.mouseChildren = true;

         const rails_container = new createjs.Container();
         rails_container.name = "global_rails";
         rails_container.mouseChildren = true;

         this._rendering.sleepers_container = sleepers_container;
         this._rendering.rails_container = rails_container;

         containers.tracks.addChild(sleepers_container);
         containers.tracks.addChild(rails_container);
         containers.tracks.renderedTracks = new Set();
         containers.tracks.renderedSwitches = new Set();
      } else {
         this._rendering.sleepers_container = containers.tracks.children[0];
         this._rendering.rails_container = containers.tracks.children[1];
      }

      for (const t of Track.allTracks) {
         if (this.TrackVisible(t)) {
            //either we have a forced redraw or the track is not rendered yet
            if (force || !containers.tracks.renderedTracks.has(t)) {
               this.renderTrack(t);
               containers.tracks.renderedTracks.add(t);
            } else if (this._rendering.lodChanged) {
               this.updateTrack(t);
            }
         }
      }

      for (const sw of Switch.allSwitches) {
         if (this.SwitchVisible(sw)) {
            if (force || !containers.tracks.renderedSwitches.has(sw)) {
               this.renderSwitch(sw);
               containers.tracks.renderedSwitches.add(sw);
            } else if (this._rendering.lodChanged) {
               this.updateSwitch(sw);
            }
         }
      }
   }

   ///calculate start and end points for each node of a track and the control point for the curve
   ///start and end points of straight segments are adjusted for the curves
   calculateTrackPoints(track) {
      const startConnection = track.switchAtTheStart;
      const endConnection = track.switchAtTheEnd;

      let startPoint = track.start;
      let endPoint = track.end;

      // Handle the start of the track
      if (startConnection) {
         // If there's a connection, shorten the track to make space
         const size = startConnection instanceof Switch ? startConnection.size : COMPUTED.GRID_SIZE_2;
         startPoint = startPoint.add(geometry.multiply(track.unit, size));
      } else {
         // If there's no connection, extend it for the bumper
         startPoint = startPoint.sub(geometry.multiply(track.unit, COMPUTED.GRID_SIZE_2));
      }

      let straightEndPoint = endPoint;
      let curveEnd = null;
      let controlPoint = null;
      let nextUnit = null;

      // Handle the end of the track
      if (endConnection) {
         // If there's a connection, shorten the track to make space for the switch or curve
         const size = endConnection instanceof Switch ? endConnection.size : COMPUTED.GRID_SIZE_2;
         straightEndPoint = endPoint.sub(geometry.multiply(track.unit, size));

         if (endConnection instanceof Track) {
            // If the connection is another track, calculate the curve
            const nextTrack = endConnection;
            nextUnit = nextTrack.unit;
            // The curve should end at the *shortened* start of the next track
            curveEnd = nextTrack.start.add(geometry.multiply(nextUnit, COMPUTED.GRID_SIZE_2));
            controlPoint = geometry.getIntersectionPointX(straightEndPoint, track.unit, curveEnd, nextUnit);
         }
      } else {
         // If there's no connection, extend the track for the bumper.
         straightEndPoint = endPoint.add(geometry.multiply(track.unit, COMPUTED.GRID_SIZE_2));
      }

      const centerLine = {
         track: track,
         start: startPoint,
         straightEnd: straightEndPoint, // This is the end of the straight part, before any curve.
         end: endPoint, // Original end point for reference.
         unit: track.unit,
         curveEnd: curveEnd, // End point of the curve.
         controlPoint: controlPoint, // Control point for the curve.
         nextUnit: nextUnit, // Unit vector of the next track.
      };

      this.calculateRailPositions(centerLine);
      this.calculateSleeperOutline(centerLine);

      return [centerLine];
   }

   /**
    * Calculate sleeper outline for a track segment
    * @param {Object} centerLine - The centerline object to add sleeper outline to
    */
   calculateSleeperOutline(centerLine) {
      const sleeperOffset = this.schwellenHöhe_2;
      const sleeperOffsetVector = geometry.perpendicular(centerLine.unit.multiply(sleeperOffset));

      centerLine.sleeperOutline = {
         straight: {
            inner: {
               start: centerLine.start.add(sleeperOffsetVector),
               end: centerLine.straightEnd.add(sleeperOffsetVector),
            },
            outer: {
               start: centerLine.start.sub(sleeperOffsetVector),
               end: centerLine.straightEnd.sub(sleeperOffsetVector),
            },
         },
      };

      if (centerLine.controlPoint) {
         const nextSleeperOffsetVector = geometry.perpendicular(centerLine.nextUnit.multiply(sleeperOffset));

         const curveOuterEnd = centerLine.curveEnd.sub(nextSleeperOffsetVector);
         const curveInnerEnd = centerLine.curveEnd.add(nextSleeperOffsetVector);

         const curveOuterStart = centerLine.sleeperOutline.straight.outer.end;
         const curveInnerStart = centerLine.sleeperOutline.straight.inner.end;

         const cpOuter = geometry.getIntersectionPointX(curveOuterStart, centerLine.unit, curveOuterEnd, centerLine.nextUnit);
         const cpInner = geometry.getIntersectionPointX(curveInnerStart, centerLine.unit, curveInnerEnd, centerLine.nextUnit);

         centerLine.sleeperOutline.curve = {
            outer: { start: curveOuterStart, end: curveOuterEnd, cp: cpOuter },
            inner: { start: curveInnerStart, end: curveInnerEnd, cp: cpInner },
         };
      }
   }

   /**
    * Calculate rail positions for a track segment
    * @param {Object} centerLine - The centerline object to add rail positions to
    */
   calculateRailPositions(centerLine) {
      // Calculate rail offset vectors
      const railOffsetVector = geometry.perpendicular(centerLine.unit.multiply(this.rail_distance));

      // Calculate rail positions for straight segment
      centerLine.rails = {
         straight: {
            // Inner rail (usually the right side in the direction of travel)
            inner: {
               start: centerLine.start.add(railOffsetVector),
               end: centerLine.straightEnd.add(railOffsetVector),
            },
            // Outer rail (usually the left side in the direction of travel)
            outer: {
               start: centerLine.start.sub(railOffsetVector),
               end: centerLine.straightEnd.sub(railOffsetVector),
            },
         },
      };

      // Calculate rail positions for curve if it exists
      if (centerLine.controlPoint) {
         const nextRailOffsetVector = geometry.perpendicular(centerLine.nextUnit.multiply(this.rail_distance));

         // Calculate curve endpoints
         const curveInnerEnd = centerLine.curveEnd.add(nextRailOffsetVector);
         const curveOuterEnd = centerLine.curveEnd.sub(nextRailOffsetVector);

         // Calculate curve startpoints (same as straight segment endpoints)
         const curveInnerStart = centerLine.rails.straight.inner.end;
         const curveOuterStart = centerLine.rails.straight.outer.end;

         // Calculate control points for inner and outer rail curves
         const cpInner = geometry.getIntersectionPointX(curveInnerStart, centerLine.unit, curveInnerEnd, centerLine.nextUnit);
         const cpOuter = geometry.getIntersectionPointX(curveOuterStart, centerLine.unit, curveOuterEnd, centerLine.nextUnit);

         // Store curve rail positions
         centerLine.rails.curve = {
            inner: {
               start: curveInnerStart,
               end: curveInnerEnd,
               cp: cpInner,
            },
            outer: {
               start: curveOuterStart,
               end: curveOuterEnd,
               cp: cpOuter,
            },
         };
      }
   }

   renderTrack(track) {
      const points = this.calculateTrackPoints(track);

      const sleepers_container = new createjs.Container();
      sleepers_container.name = "track";
      sleepers_container.mouseChildren = false;
      sleepers_container.data = track;
      this._rendering.sleepers_container.addChild(sleepers_container);

      const hitArea = new createjs.Shape();
      hitArea.graphics.beginFill("#000"); // Color doesn't matter, only need one fill
      for (const p of points) {
         const straight = p.sleeperOutline.straight;
         hitArea.graphics
            .moveTo(straight.outer.start.x, straight.outer.start.y)
            .lineTo(straight.outer.end.x, straight.outer.end.y)
            .lineTo(straight.inner.end.x, straight.inner.end.y)
            .lineTo(straight.inner.start.x, straight.inner.start.y)
            .closePath();

         if (p.sleeperOutline.curve) {
            const curve = p.sleeperOutline.curve;
            hitArea.graphics
               .moveTo(curve.inner.start.x, curve.inner.start.y)
               .quadraticCurveTo(curve.inner.cp.x, curve.inner.cp.y, curve.inner.end.x, curve.inner.end.y)
               .lineTo(curve.outer.end.x, curve.outer.end.y)
               .quadraticCurveTo(curve.outer.cp.x, curve.outer.cp.y, curve.outer.start.x, curve.outer.start.y)
               .closePath();
         }
      }
      sleepers_container.hitArea = hitArea;

      // Draw main points for debugging using a debug container
      if (true) {
         const debugContainer = new createjs.Container();
         debugContainer.name = "debug_points";
         for (const p of points) {
            // Start point (green)
            const startShape = new createjs.Shape();
            startShape.graphics.beginFill("#00ff00").drawCircle(p.start.x, p.start.y, 4).endFill();
            debugContainer.addChild(startShape);

            // Straight end (blue)
            const straightEndShape = new createjs.Shape();
            straightEndShape.graphics.beginFill("#0000ff").drawCircle(p.straightEnd.x, p.straightEnd.y, 4).endFill();
            debugContainer.addChild(straightEndShape);

            // End point (red)
            const endShape = new createjs.Shape();
            endShape.graphics.beginFill("#ff0000").drawCircle(p.end.x, p.end.y, 4).endFill();
            debugContainer.addChild(endShape);

            // Curve end (purple)
            if (p.curveEnd) {
               const curveEndShape = new createjs.Shape();
               curveEndShape.graphics.beginFill("#800080").drawCircle(p.curveEnd.x, p.curveEnd.y, 4).endFill();
               debugContainer.addChild(curveEndShape);
            }

            // Control point (orange)
            if (p.controlPoint) {
               const controlPointShape = new createjs.Shape();
               controlPointShape.graphics.beginFill("#ffa500").drawCircle(p.controlPoint.x, p.controlPoint.y, 4).endFill();
               debugContainer.addChild(controlPointShape);
            }
         }
         sleepers_container.addChild(debugContainer);
      }

      this.drawTrackSleepers(points, sleepers_container);      
      this.renderRails(track, points);
      this.drawBumper(track, this._rendering.rails_container);
   }

   calculateRailBounds(points) {
      // Initialize bounds with first point
      let minX = Infinity,
         minY = Infinity,
         maxX = -Infinity,
         maxY = -Infinity;

      // Helper to update bounds with a point
      const updateBounds = (point) => {
         minX = Math.min(minX, point.x);
         minY = Math.min(minY, point.y);
         maxX = Math.max(maxX, point.x);
         maxY = Math.max(maxY, point.y);
      };

      // Iterate through all points and collect extremes
      for (const point of points) {
         // Add all straight segment points to bounds
         const { inner, outer } = point.rails.straight;
         updateBounds(inner.start);
         updateBounds(inner.end);
         updateBounds(outer.start);
         updateBounds(outer.end);

         // Handle curve segments
         if (point.rails.curve) {
            const curve = point.rails.curve;

            // Add curve endpoints and control points
            updateBounds(curve.inner.start);
            updateBounds(curve.inner.end);
            updateBounds(curve.outer.start);
            updateBounds(curve.outer.end);
         }
      }

      // Add padding for line thickness
      const padding = trackRendering_textured.RAILS[0][0] * 0.5; // Half of the thickest rail
      return {
         x: minX - padding,
         y: minY - padding,
         width: maxX - minX + padding * 2,
         height: maxY - minY + padding * 2,
      };
   }

   renderRails(track, points) {
      const rail_shape = new createjs.Shape();
      rail_shape.name = "track";
      rail_shape.snapToPixel = true;
      rail_shape.data = track;
      this._rendering.rails_container.addChild(rail_shape);

      for (const point of points) {
         // Use pre-calculated rail positions
         const { straight, curve } = point.rails;

         trackRendering_textured.RAILS.forEach((rail) => {
            rail_shape.graphics.setStrokeStyle(rail[0]).beginStroke(rail[1]);

            // Draw straight segments
            rail_shape.graphics
               .mt(straight.inner.start.x, straight.inner.start.y)
               .lt(straight.inner.end.x, straight.inner.end.y)
               .mt(straight.outer.start.x, straight.outer.start.y)
               .lt(straight.outer.end.x, straight.outer.end.y);

            // Draw curves if present
            if (curve) {
               rail_shape.graphics
                  .mt(curve.outer.start.x, curve.outer.start.y)
                  .quadraticCurveTo(curve.outer.cp.x, curve.outer.cp.y, curve.outer.end.x, curve.outer.end.y)
                  .mt(curve.inner.start.x, curve.inner.start.y)
                  .quadraticCurveTo(curve.inner.cp.x, curve.inner.cp.y, curve.inner.end.x, curve.inner.end.y);
            }

            rail_shape.graphics.endStroke();
         });
      }

      // Calculate and set bounds for the rail shape
      const bounds = this.calculateRailBounds(points);
      rail_shape.setBounds(bounds.x, bounds.y, bounds.width, bounds.height);

      return rail_shape;
   }

   drawTrackSleepers(points, container) {
      for (const point of points) {
         // Draw sleepers for straight segment
         this.drawSleepers(point.track, point.start, point.straightEnd, container);

         // Draw sleepers for curve if exists
         if (point.rails.curve) {
            this.drawSleepersAlongCurve(point.straightEnd, point.curveEnd, point.controlPoint, container);
         }
      }
   }

   drawSleepersAlongCurve(startPoint, endPoint, controlPoint, container) {
      //the curve is eproximat 11% times longer than the straight line
      const steps = Math.floor((geometry.distance(startPoint, endPoint) * 1.11) / this.sleeperIntervall);
      const step = 1 / steps;
      let t = 0.25 / steps,
         point,
         angle;

      for (let i = 0; i < steps; i++) {
         point = this.getPointOnCurve(t, startPoint, controlPoint, endPoint);
         angle = this.getDegreeOfTangentOnCurve(t, startPoint, controlPoint, endPoint);

         this.drawSleeper(i, point.x, point.y, angle, container);
         t += step;
      }
   }

   drawSleepers(track, startPoint, endPoint, container) {
      let x = startPoint.x;
      let y = startPoint.y;

      const l = geometry.distance(startPoint, endPoint);
      // Calculate how many sleepers fit
      const amount = Math.floor(l / this.sleeperIntervall);

      // Calculate the remaining space after fitting full sleepers
      const remainingSpace = l % this.sleeperIntervall;
      // Distribute the remaining space evenly between sleepers
      const adjustedInterval = this.sleeperIntervall + remainingSpace / amount;

      const step_x = track.cos * adjustedInterval,
         step_y = track.sin * adjustedInterval;

      // Add the end gap
      x += track.cos * (this.schwellenGap / 2);
      y += track.sin * (this.schwellenGap / 2);

      for (let i = 0; i < amount; i++) {
         this.drawSleeper(i, x, y, track.deg, container);
         // Move to next position using sleeperIntervall
         y += step_y;
         x += step_x;
      }
   }

   drawSleeper(i, x, y, angle, container, length = this.schwellenHöhe, regY) {
      if (this.app.renderingManager.stage.scale < this.LOD) {
         // For simple shapes at low LOD
         const ry = regY == null ? length / 2 : regY;

         // Create a unique cache key based on the length
         const cacheKey = `shape_${length}`;

         // Get cached shape or create a new one
         let sleeperShape = this._sleeperCache[cacheKey];
         if (!sleeperShape) {
            sleeperShape = new createjs.Shape();
            sleeperShape.graphics
               .setStrokeStyle(0.2, "round")
               .beginStroke("black")
               .beginFill("#99735b")
               .r(0, 0, this.schwellenBreite, length)
               .ef();
            sleeperShape.setBounds(0, 0, this.schwellenBreite, length);
            // Store in cache
            this._sleeperCache[cacheKey] = sleeperShape;
         }

         // Clone the cached shape for this instance
         let sleeper = sleeperShape.clone();
         sleeper.x = x;
         sleeper.y = y;
         sleeper.rotation = angle;
         sleeper.regY = ry;
         sleeper.regX = 0;

         container.addChild(sleeper);
      } else {
         // Use bitmap rendering at higher LOD
         i = i % trackRendering_textured.SCHWELLEN_VARIANTEN;
         const scaleY = length / this.schwellenHöhe;
         const ry = regY == null ? this.schwellenImg.height / 2 : regY / (trackRendering_textured.TRACK_SCALE * scaleY);

         // Check if we have a cached bitmap for this index
         if (!this._bitmapCache[i]) {
            // Create the sourceRect for this index
            const sourceRect = new createjs.Rectangle(
               (i * this.schwellenImg.width) / trackRendering_textured.SCHWELLEN_VARIANTEN,
               0,
               this.sleepersImgWidth,
               this.schwellenImg.height
            );

            // Create and cache the bitmap
            const bitmap = new createjs.Bitmap(this.schwellenImg);
            bitmap.sourceRect = sourceRect;
            this._bitmapCache[i] = bitmap;
         }

         // Clone the cached bitmap
         const sleeperBitmap = this._bitmapCache[i].clone();

         // Set position and transformation properties
         sleeperBitmap.x = x;
         sleeperBitmap.y = y;
         sleeperBitmap.regY = ry;
         sleeperBitmap.regX = 0;
         sleeperBitmap.scale = trackRendering_textured.TRACK_SCALE;
         sleeperBitmap.scaleY = trackRendering_textured.TRACK_SCALE * scaleY;
         sleeperBitmap.rotation = angle;

         container.addChild(sleeperBitmap);
      }
   }

   getPointOnCurve(t, p0, cp, p1) {
      const oneMinusT = 1 - t;
      const tSquared = t * t;
      const oneMinusTSquared = oneMinusT * oneMinusT;
      const twoTimesT = 2 * oneMinusT * t;

      return new Point(
         oneMinusTSquared * p0.x + twoTimesT * cp.x + tSquared * p1.x,
         oneMinusTSquared * p0.y + twoTimesT * cp.y + tSquared * p1.y
      );
   }

   getDegreeOfTangentOnCurve(t, p0, cp, p1) {
      const mt = 1 - t;
      const dx = 2 * (mt * (cp.x - p0.x) + t * (p1.x - cp.x));
      const dy = 2 * (mt * (cp.y - p0.y) + t * (p1.y - cp.y));
      return Math.atan2(dy, dx) * (180 / Math.PI);
   }

   drawBumper(track, track_container) {
      if (track.switchAtTheEnd == null) {
         track_container.addChild(
            new createjs.Bitmap(this.bumperImg).set({
               y: track.end.y,
               x: track.end.x,
               scale: trackRendering_textured.TRACK_SCALE,
               scaleX: -trackRendering_textured.TRACK_SCALE,
               rotation: track.deg,
               regY: this.bumperImg.height / 2,
               regX: this.bumperImg.width,
            })
         );
      }

      if (track.switchAtTheStart == null) {
         track_container.addChild(
            new createjs.Bitmap(this.bumperImg).set({
               y: track.start.y,
               x: track.start.x,
               scale: trackRendering_textured.TRACK_SCALE,
               scaleX: trackRendering_textured.TRACK_SCALE,
               rotation: track.deg,
               regY: this.bumperImg.height / 2,
               regX: this.bumperImg.width,
            })
         );
      }
   }

   updateTrack(track) {
      // Find the sleepers container for this track
      const sleepersContainer = this._rendering.sleepers_container.children.find((c) => c.data === track);
      if (!sleepersContainer) return;

      // Remove existing sleepers
      sleepersContainer.removeAllChildren();

      // Calculate points and redraw sleepers with current LOD
      const points = this.calculateTrackPoints(track);
      this.drawTrackSleepers(points, sleepersContainer);

      if (track == track.switchAtTheEnd?.t1) {
         const switchSleepersContainer = this._rendering.sleepers_container.children.find((c) => c.data === track.switchAtTheEnd);
         const switchRenderingParameter = this.getSwitchRenderingParameter(track.switchAtTheEnd);
         this.drawSleepersOnSwitch(track.switchAtTheEnd, switchRenderingParameter, switchSleepersContainer);
      }

      if (track == track.switchAtTheStart?.t1) {
         const switchSleepersContainer = this._rendering.sleepers_container.children.find(
            (c) => c.data === track.switchAtTheStart
         );
         const switchRenderingParameter = this.getSwitchRenderingParameter(track.switchAtTheStart);
         this.drawSleepersOnSwitch(track.switchAtTheStart, switchRenderingParameter, switchSleepersContainer);
      }
   }

   updateSwitch(sw) {
      // Find the sleepers container for this switch
      const sleepersContainer = this._rendering.sleepers_container.children.find((c) => c.data === sw);
      if (!sleepersContainer) return;

      // Get rendering parameters
      const switchRenderingParameter = this.getSwitchRenderingParameter(sw);

      // Redraw sleepers with current LOD
      this.drawSleepersOnSwitch(sw, switchRenderingParameter, sleepersContainer);
   }

   /**
    * Creates a shape for a track endpoint
    * @param {Point} point - The point where the endpoint should be
    * @param {Track} track - The track this endpoint belongs to
    * @param {string} endpointType - Either "start" or "end"
    * @returns {createjs.Shape} The created shape
    */
   createEndpointShape(point, track, endpointType) {
      const RECT_SIZE = 8;
      const shape = new createjs.Shape();

      // Set properties to identify the shape
      shape.name = "track_endpoint";
      shape.endpoint = endpointType;
      shape.track = track;

      // Create hit area
      const hitArea = new createjs.Shape();
      hitArea.graphics.beginFill("#000").drawRect(point.x - RECT_SIZE / 2, point.y - RECT_SIZE / 2, RECT_SIZE, RECT_SIZE);
      shape.hitArea = hitArea;

      // Draw rectangle
      shape.graphics
         .setStrokeStyle(2)
         .beginStroke("#ff0000")
         .drawRect(point.x - RECT_SIZE / 2, point.y - RECT_SIZE / 2, RECT_SIZE, RECT_SIZE);

      return shape;
   }

   /**
    * Draws selection rectangles at the start and end points of a track
    * @param {Track} track - The track to draw selection rectangles for
    */
   drawTrackEndpoints(track) {
      // Create and add shapes for start and end points
      this.app.renderingManager.containers.selection.addChild(this.createEndpointShape(track.start, track, "start"));
      this.app.renderingManager.containers.selection.addChild(this.createEndpointShape(track.end, track, "end"));
   }

   updateSelection() {
      this.app.renderingManager.containers.selection.removeAllChildren();

      if (this.app.selection.type == "Track") {
         this.app.renderingManager.containers.tracks.children[0].children.forEach((c) => {
            if (this.app.selection.isSelectedObject(c.data)) {
               this.visualizeTrackBounds(c);
               this.drawTrackEndpoints(c.data);
            }
         });
      } else if (this.app.selection.type == "Signal") {
         this.app.renderingManager.containers.signals.children.forEach((c) => {
            if (c.data) {
               if (this.app.selection.isSelectedObject(c.data)) this.visualizeTrackBounds(c);
            }
         });
      } else if (this.app.selection.type == "GenericObject") {
         this.app.renderingManager.containers.objects.children.forEach((c) => {
            if (c.data) {
               if (this.app.selection.isSelectedObject(c.data)) this.visualizeTrackBounds(c);
            }
         });
      }
      this.app.renderingManager.update();
   }

   drawSleepersOnSwitch(sw, switchRenderingParameter, container) {
      const { mainTrack, straightBranch, curvedBranch, curvedBranch2, flipped, mirrored } = switchRenderingParameter;

      if (container == null) {
         container = new createjs.Container();
         container.name = "switch_sleepers";
         container.data = sw;
         container.mouseChildren = false;
         this._rendering.sleepers_container.addChild(container);
      } else {
         container.removeAllChildren();
      }

      const deg = sw.track1.deg;

      const back2front = NumberUtils.is(sw.type, Switch.SWITCH_TYPE.FROM_RIGHT, Switch.SWITCH_TYPE.FROM_LEFT);

      if (curvedBranch2 == null) {
         const cp = geometry.getIntersectionPointX(
            mainTrack.sleepers.outer,
            mainTrack.unit,
            curvedBranch.sleepers.outer,
            curvedBranch.unit
         );

         const length = geometry.distance(mainTrack.sleepers.inner, straightBranch.sleepers.inner); //length of the straight part + half of the gap, to minimize the gap the to next track
         const length2 = geometry.distance(mainTrack.sleepers.outer, curvedBranch.sleepers.outer); //almost the length of the curve

         const amount_on_straight_rail = Math.floor(length / this.sleeperIntervall);
         const amount_on_curved_rail = Math.floor(length2 / (this.sleeperIntervall * 1.15));
         const new_intervall = (this.sleeperIntervall + (length % this.sleeperIntervall) / amount_on_straight_rail) * mirrored; //new intervall to minimize the gap and using the leftover from the division
         let p1, t, sleeper_length;

         if (back2front) p1 = mainTrack.sleepers.inner.sub(geometry.multiply(mainTrack.unit, this.sleeperIntervall));
         else p1 = mainTrack.sleepers.inner.add(geometry.multiply(mainTrack.unit, (this.schwellenGap / 2) * mirrored));

         const step_vector = geometry.multiply(mainTrack.unit, new_intervall);

         for (let i = 0; i < amount_on_curved_rail; i++) {
            t = i / amount_on_curved_rail + 0.4 / amount_on_curved_rail;

            sleeper_length = Math.max(
               geometry.distance(this.getPointOnCurve(t, mainTrack.sleepers.outer, cp, curvedBranch.sleepers.outer), p1),
               this.schwellenHöhe
            );

            this.drawSleeper(i, p1.x, p1.y, deg, container, -sleeper_length * flipped, 0);
            p1 = p1.add(step_vector);
         }

         for (let i = amount_on_curved_rail; i < amount_on_straight_rail; i++) {
            t = (this.sleeperIntervall * i) / length2;
            //subtract the sleeper intervall to create a gap to the next sleeper
            sleeper_length = Math.max(
               geometry.distance(
                  geometry.getIntersectionPointX(
                     curvedBranch.sleepers.outer,
                     geometry.perpendicular(curvedBranch.unit),
                     p1,
                     geometry.perpendicular(mainTrack.unit)
                  ),
                  p1
               ),
               this.schwellenHöhe
            );

            this.drawSleeper(i, p1.x, p1.y, deg, container, -sleeper_length * flipped, 0);
            p1 = p1.add(step_vector);
         }
      } else {
         // Calculate starting point and offset vector
         let centerPoint = straightBranch.position.add(mainTrack.unit.multiply(this.sleeperIntervall / 4));
         const step_vector = mainTrack.unit.multiply(this.sleeperIntervall);

         // Create a full symmetric pattern from the half pattern
         const pattern = trackRendering_textured.FOUR_WAY_SLEEPER_PATTERN;
         let reversed_pattern
         if(pattern.length % 2 == 0) {
            reversed_pattern = pattern.slice().reverse(); //remove the last element because its right on the point of the switch
         } else {
            reversed_pattern = pattern.slice(0, -1).reverse(); //remove the last element because its right on the point of the switch
         }
         const point_symmetric_pattern = reversed_pattern.map((p) => ({ offset: 2 * p.length - p.offset, length: p.length }));
         const fullPattern = [...pattern, ...point_symmetric_pattern];

         // Draw sleepers using the pattern
         fullPattern.forEach((data, i) => {
            this.drawSleeper(
               i,
               centerPoint.x,
               centerPoint.y,
               deg,
               container,
               data.length * this.schwellenHöhe,
               data.offset * this.schwellenHöhe_2
            );
            centerPoint = centerPoint.add(step_vector);
         });
      }
   }

   renderSwitch(sw, force) {
      const switchRenderingParameter = this.getSwitchRenderingParameter(sw);

      const shape = new createjs.Shape();
      shape.data = sw;
      shape.snapToPixel = true;
      this._rendering.rails_container.addChild(shape);

      // Draw track based on the number of tracks
      if (switchRenderingParameter.curvedBranch2 == null) {
         this.renderThreeWaySwitch(shape, switchRenderingParameter);
      } else {
         this.renderFourWaySwitch(shape, switchRenderingParameter);
      }

      this.drawSleepersOnSwitch(sw, switchRenderingParameter);
      this.renderSwitchUI(sw);
   }

   getSwitchRenderingParameter(sw) {
      const flipped = NumberUtils.is(sw.type, Switch.SWITCH_TYPE.FROM_RIGHT, Switch.SWITCH_TYPE.TO_RIGHT) ? -1 : 1;
      const mirrored = NumberUtils.is(sw.type, Switch.SWITCH_TYPE.FROM_LEFT, Switch.SWITCH_TYPE.FROM_RIGHT) ? -1 : 1;

      // Calculate track data for each track
      const calcTrackData = (index) => {
         let track = sw.tracks[index];
         let unit = sw.track_directions[index];
         if (!unit) {
            // This can happen if calculateParameters hasn't been called on the switch.
            // For robustness, we can calculate it here, but it's better to ensure it's calculated in the switch class.
            console.warn("Switch track_directions not calculated, calculating on the fly.");
            sw.calculateParameters();
            unit = sw.track_directions[index];
         }

         const railOffset = geometry.perpendicular(track.unit.multiply(this.rail_distance * flipped));
         const sleeperOffset = geometry.perpendicular(track.unit.multiply(this.schwellenHöhe_2 * flipped));
         // The position should be on the track, at a certain distance from the switch location.
         const position = sw.location.add(unit.multiply(sw.size));

         return {
            unit: track.unit,
            position: position,
            rails: {
               inner: position.add(railOffset),
               outer: position.sub(railOffset),
            },
            sleepers: {
               inner: position.add(sleeperOffset),
               outer: position.sub(sleeperOffset),
            },
         };
      };

      const mainTrack = calcTrackData(0);
      const straightBranch = calcTrackData(1);
      const curvedBranch = calcTrackData(2);
      const curvedBranch2 = sw.track4 ? calcTrackData(3) : null;

      return { mainTrack, straightBranch, curvedBranch, curvedBranch2, flipped, mirrored };
   }

   renderThreeWaySwitch(shape, switchRenderingParameter) {
      const g = shape.graphics;
      const { mainTrack, straightBranch, curvedBranch, flipped, mirrored } = switchRenderingParameter;

      // Calculate intersection points once - reuse for all rail sizes
      const intersections = {
         outerCurve: geometry.getIntersectionPointX(
            mainTrack.rails.outer,
            mainTrack.unit,
            curvedBranch.rails.outer,
            curvedBranch.unit
         ),

         frog: geometry.getIntersectionPointX(
            straightBranch.rails.outer,
            straightBranch.unit,
            curvedBranch.rails.inner,
            curvedBranch.unit
         ),
      };

      // Calculate inner curve control point using the already calculated frog point
      intersections.innerCurve = geometry.getIntersectionPointX(
         mainTrack.rails.inner,
         mainTrack.unit,
         intersections.frog,
         curvedBranch.unit
      );

      // Pre-calculate all herzstück (frog) points
      const frogOffset = -trackRendering_textured.RAILS[0][0] * mirrored; //thats the distance between the frog and the point blades
      const guardRailLength = 10 * mirrored;
      const frogPoints = {
         curveEnd: Point.fromPoint(intersections.frog).add(curvedBranch.unit.multiply(frogOffset)),
         straightStart: Point.fromPoint(intersections.frog).add(straightBranch.unit.multiply(frogOffset)),
      };

      // Calculate end points using the pre-calculated points
      frogPoints.straightEnd = frogPoints.curveEnd.add(straightBranch.unit.multiply(guardRailLength));
      frogPoints.curveStart = frogPoints.straightStart.add(curvedBranch.unit.multiply(guardRailLength));

      // Draw all rails with different thicknesses in one pass
      for (const rail of trackRendering_textured.RAILS) {
         g.setStrokeStyle(rail[0]).beginStroke(rail[1]);

         // Outer curved branch
         g.mt(mainTrack.rails.outer.x, mainTrack.rails.outer.y).quadraticCurveTo(
            intersections.outerCurve.x,
            intersections.outerCurve.y,
            curvedBranch.rails.outer.x,
            curvedBranch.rails.outer.y
         );

         // Inner curved branch with frog connection
         g.mt(mainTrack.rails.inner.x, mainTrack.rails.inner.y)
            .quadraticCurveTo(
               intersections.innerCurve.x - flipped,
               intersections.innerCurve.y - flipped,
               frogPoints.curveEnd.x,
               frogPoints.curveEnd.y
            )
            .lt(frogPoints.straightEnd.x, frogPoints.straightEnd.y);

         // Frog point and connecting rails
         g.mt(straightBranch.rails.outer.x, straightBranch.rails.outer.y)
            .lt(intersections.frog.x, intersections.frog.y)
            .lt(curvedBranch.rails.inner.x, curvedBranch.rails.inner.y);

         // Straight connection
         g.mt(mainTrack.rails.inner.x, mainTrack.rails.inner.y).lt(straightBranch.rails.inner.x, straightBranch.rails.inner.y);

         // Guard rail
         g.mt(frogPoints.curveStart.x, frogPoints.curveStart.y)
            .lt(frogPoints.straightStart.x, frogPoints.straightStart.y)
            .lt(mainTrack.rails.outer.x, mainTrack.rails.outer.y + 2 * flipped); //TODO  we can implement switching the switch here

         g.endStroke();
      }
   }

   renderFourWaySwitch(shape, switchRenderingParameter) {
      const { mainTrack, straightBranch, curvedBranch, curvedBranch2 } = switchRenderingParameter;

      const drawRail = (graphics, startTrack, endTrack, railSide) => {
         // railSide: 'inner' or 'outer'

         const startPoint = startTrack.rails[railSide];
         const endPoint = endTrack.rails[railSide];

         const cp1 = geometry.add(startPoint, geometry.multiply(startTrack.unit, trackRendering_textured.CURVATURE_4WAY_SWITCH));
         const cp2 = geometry.add(endPoint, geometry.multiply(endTrack.unit, -trackRendering_textured.CURVATURE_4WAY_SWITCH));

         graphics.mt(startPoint.x, startPoint.y).bezierCurveTo(cp1.x, cp1.y, cp2.x, cp2.y, endPoint.x, endPoint.y);
      };

      const g = shape.graphics;

      // Draw all rails with different thicknesses
      for (const rail of trackRendering_textured.RAILS) {
         g.setStrokeStyle(rail[0]).beginStroke(rail[1]);

         // Draw using the helper method for consistent curve rendering
         drawRail(g, straightBranch, curvedBranch2, "outer");
         drawRail(g, curvedBranch, mainTrack, "inner");
         drawRail(g, straightBranch, curvedBranch2, "inner");
         drawRail(g, curvedBranch, mainTrack, "outer");

         // Draw straight connections
         g.mt(mainTrack.rails.inner.x, mainTrack.rails.inner.y).lt(straightBranch.rails.inner.x, straightBranch.rails.inner.y);

         g.mt(mainTrack.rails.outer.x, mainTrack.rails.outer.y).lt(straightBranch.rails.outer.x, straightBranch.rails.outer.y);

         g.mt(curvedBranch.rails.inner.x, curvedBranch.rails.inner.y).lt(
            curvedBranch2.rails.inner.x,
            curvedBranch2.rails.inner.y
         );

         g.mt(curvedBranch.rails.outer.x, curvedBranch.rails.outer.y).lt(
            curvedBranch2.rails.outer.x,
            curvedBranch2.rails.outer.y
         );

         g.endStroke();
      }
   }

   renderSwitchUI(sw) {
      const drawArrow = (graphics, length, size) => {
         graphics
            .mt(0, 0)
            .lt(length, 0)
            .mt(length - size, -size / 2)
            .lt(length, 0)
            .lt(length - size, size / 2);
      };

      // Check if a container already exists for this switch
      let container =  this.app.renderingManager.containers.ui.children.find((c) => c.data === sw);

      if (container) {
         // If container exists, clear it but keep it
         container.removeAllChildren();
      } else {
         // Create a new container if none exists
         container = new createjs.Container();
         container.mouseChildren = false;
         container.name = "switch";
         container.data = sw;
         this.app.renderingManager.containers.ui.addChild(container);
      }

      // Add arrows for both tracks
      [sw.from, sw.branch].forEach((t) => {
         const arrow = new createjs.Shape();
         container.addChild(arrow);

         arrow.graphics.setStrokeStyle(trackRendering_textured.SWITCH_UI_STROKE, "round").beginStroke("#333");
         drawArrow(arrow.graphics, 20, 5);
         arrow.x = sw.location.x;
         arrow.y = sw.location.y;
         arrow.rotation = Switch.findAngle(sw.location, t.end.equals(sw.location) ? t.start : t.end);
      });
   }

   PointVisible(p1) {
      if (this._rendering?.dont_optimize) return true;
      const screen_rectangle = this._rendering.screen_rectangle;

      return (
         NumberUtils.between(p1.x, screen_rectangle.left, screen_rectangle.right) &&
         NumberUtils.between(p1.y, screen_rectangle.top, screen_rectangle.bottom)
      );
   }

   TrackVisible(track, screen_rectangle = this._rendering.screen_rectangle) {
      if (this._rendering?.dont_optimize) return true;

      const isInside = (point, rect) =>
         point.x > rect.left && point.x < rect.right && point.y > rect.top && point.y < rect.bottom;

      //first the easy part, if either on of its end points is visible
      if (isInside(track.start, screen_rectangle) || isInside(track.end, screen_rectangle)) return true; //

      //now we have to make sure, if the track is going through the whole screen
      //we check, if the track intersects one of the screen borders

      //left
      let p1 = { x: screen_rectangle.left, y: screen_rectangle.top },
         p2 = { x: screen_rectangle.left, y: screen_rectangle.bottom };
      if (geometry.doLineSegmentsIntersect(p1, p2, track.start, track.end)) return true;
      //bottom
      p1 = p2;
      p2 = { x: screen_rectangle.right, y: screen_rectangle.bottom };
      if (geometry.doLineSegmentsIntersect(p1, p2, track.start, track.end)) return true;
      //right
      p1 = p2;
      p2 = { x: screen_rectangle.right, y: screen_rectangle.top };
      if (geometry.doLineSegmentsIntersect(p1, p2, track.start, track.end)) return true;
      //top we do not need to check all borders
      /* p1 = p2;
      p2 = { x: x, y: y };
      if (geometry.doLineSegmentsIntersect(p1, p2, track.start, track.end)) return true; */

      return false;
   }

   SwitchVisible(sw) {
      if (this._rendering?.dont_optimize) return true;
      const screen_rectangle = this._rendering.screen_rectangle;

      // Check if switch location is visible
      if (this.PointVisible(sw.location)) return true;

      // Check if any of the switch's tracks are visible
      const tracks = [sw.track1, sw.track2, sw.track3, sw.track4].filter((t) => t);
      return tracks.some((track) => this.TrackVisible(track, screen_rectangle));
   }

   /**
    * Visualize track bounds for debugging
    * @param {Object} container - The container to visualize bounds for
    */
   visualizeTrackBounds(container) {
      const bounds = container.getTransformedBounds();
      const object = container.data;

      if (bounds == null) throw new Error("Bounds are null");

      // Add padding to bounds
      const padding = 5;
      bounds.x -= padding;
      bounds.y -= padding;
      bounds.width += padding * 2;
      bounds.height += padding * 2;

      // Create a shape for the bounds visualization
      const boundsShape = new createjs.Shape();
      boundsShape.name = "selection";
      boundsShape.mouseEnabled = false;
      boundsShape.data = object;

      // Draw the bounds rectangle
      boundsShape.graphics
         .setStrokeStyle(2)
         .setStrokeDash([5, 5])
         .beginStroke("rgba(0, 0, 0, 0.7)")
         .drawRect(bounds.x, bounds.y, bounds.width, bounds.height)
         .endStroke();

      this.app.renderingManager.containers.selection.addChild(boundsShape);
   }
}
