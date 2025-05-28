"use strict";

class trackRendering_textured {
   static TRACK_SCALE = 0.2;
   static signale_scale = 0.5;
   static SCHWELLEN_VARIANTEN = 24;
   static CURVATURE_4WAY_SWITCH = 22;
   static RAILS = [
      [2.8, "#222"],
      [2.4, "#999"],
      [1.2, "#eee"],
   ];

   // Define sleeper pattern for 4-way switch
   static FOUR_WAY_SLEEPER_PATTERN = [
      { offset: 1, length: 1.0 }, // Start straight
      { offset: 1.1, length: 1.2 }, // Begin transition
      { offset: 1.3, length: 1.65 }, // Peak of curve
      { offset: 1.5, length: 1.7 }, // Curve
      { offset: 1.8, length: 1.7 }, // Curve
      { offset: 2, length: 1.7 }, // Curve
      { offset: 2.1, length: 1.7 }, // Curve
      { offset: 2, length: 1.6 }, // Peak of curve
      { offset: 1.3, length: 1.2 }, // End transition
      { offset: 1, length: 1.0 }, // End straight
   ];

   constructor() {
      //cause the class is been loaded before start.js, we have to hack and calculate this constant here
      trackRendering_textured.CURVE_RADIUS = GRID_SIZE * 1.21;

      this.SIGNAL_DISTANCE_FROM_TRACK = 35;

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
            if (track_container.renderedTracks.size == 0 || this._rendering != null) return;
            const bounds = this.calcCanvasSize();

            // Find tracks that are no longer visible
            const toBeRemoved = [];
            track_container.renderedTracks.forEach((track) => {
               if (!this.TrackVisible(track, bounds)) {
                  toBeRemoved.push(track);
               }
            });

            // Remove tracks and their associated signals
            toBeRemoved.forEach((track) => {
               // Remove associated signals
               const signalsToBeRemoved = signal_container.children.filter((cs) => cs.data._positioning.track === track);
               signalsToBeRemoved.forEach((cs) => {
                  signal_container.removeChild(cs);
               });
               // Remove track from rendered set
               track_container.renderedTracks.delete(track);

               // Remove track elements from both containers
               const sleepersToRemove = track_container.children[0].children.filter((c) => c.data === track);
               const railsToRemove = track_container.children[1].children.filter((c) => c.data === track);

               sleepersToRemove.forEach((c) => {
                  delete c.track;
                  track_container.children[0].removeChild(c);
               });

               railsToRemove.forEach((c) => {
                  delete c.track;
                  track_container.children[1].removeChild(c);
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
      const width = (stage.canvas.width + GRID_SIZE * 2) / stage.scaleX,
         height = (stage.canvas.height + GRID_SIZE * 2) / stage.scaleY,
         x = (-stage.x - GRID_SIZE) / stage.scaleX,
         y = (-stage.y - GRID_SIZE) / stage.scaleY;
      return { left: x, top: y, right: x + width, bottom: y + height };
   }

   ///force=false means, each element decides if it needs to be redrawn. If something global changed,
   ///like the scale, force needs to be true.
   /// dont_optimize parameter disables the optimasation to only handle and draw elements inside the viewport
   /// and disables caching. its used by the export to image functionality
   reDrawEverything(force = false, dont_optimize = false) {
      if (!pl.loaded)
         //stupid code that should prevent drawing, before the preloader is ready
         setTimeout(() => {
            this.reDrawEverything(force, dont_optimize);
         }, 500);
      else {
         if (this._rendering == undefined) {
            try {
               this._rendering = { dont_optimize: dont_optimize };
               this._rendering.screen_rectangle = this.calcCanvasSize();

               if (force) {
                  track_container.removeAllChildren();
                  signal_container.removeAllChildren();
                  ui_container.removeAllChildren();
                  train_container.removeAllChildren();
                  object_container.removeAllChildren();
                  debug_container.removeAllChildren();
                  this.calcRenderValues();
               } else {
                  //if we passed the LOD in either direction we have to rerender the tracks
                  if (this.LOD.between(this._lastRenderScale, stage.scale)) {
                     this._rendering.lodChanged = true;
                  }
               }

               try {
                  this.renderAllTracks(force);
                  this.renderAllSignals(force);
                  this.renderAllTrains();
                  this.renderAllGenericObjects();
                  this._lastRenderScale = stage.scale;
                  if (!dont_optimize) this.cleanUp();
               } catch (error) {
                  console.error("Error during rendering:", error);
                  throw error;
               } finally {
                  delete this._rendering;
                  stage.update();
               }
            } catch (error) {
               console.error("Critical rendering error:", error);
               showErrorToast(error);
               // Attempt to recover by clearing rendering state
               delete this._rendering;
               throw error;
            }
         }
      }
   }

   calcRenderValues() {
      this.schwellenImg = pl.getImage("schwellen");
      this.bumperImg = pl.getImage("bumper");
      this.sleepersImgWidth = this.schwellenImg.width / trackRendering_textured.SCHWELLEN_VARIANTEN;
      this.schwellenHöhe = this.schwellenImg.height * trackRendering_textured.TRACK_SCALE;
      this.schwellenHöhe_2 = this.schwellenHöhe / 2;
      this.schwellenBreite = this.sleepersImgWidth * trackRendering_textured.TRACK_SCALE;
      this.schwellenGap = this.schwellenBreite * 1.1; // distance between the sleepers
      this.sleeperIntervall = this.schwellenBreite + this.schwellenGap;
      this.rail_offset = this.schwellenHöhe / 4.7; // distance between the rail and the end of the sleeper
      this.rail_distance = this.schwellenHöhe_2 - this.rail_offset; // distance between the rail and the center of the track

      this.TRAIN_HEIGHT = this.schwellenHöhe - this.rail_offset;
      this.TRAIN_WIDTH = GRID_SIZE * 0.7;

      this.main_x1 = (Math.sin(π / 8) * trackRendering_textured.CURVE_RADIUS) / Math.cos(π / 8);
   }

   renderAllTrains() {
      train_container.removeAllChildren();
      Train.allTrains.forEach((train) => {
         const c = new createjs.Container();
         c.name = "train";
         c.train = train;
         c.mouseChildren = false;
         const p = geometry.add(train.track.start, train.track.unit.multiply(train.pos));
         this.renderCar(train, c, true);
         if (train.trainCoupledBack) this.renderCar(train.trainCoupledBack, c);

         train_container.addChild(c);
      });
   }

   renderCar(car, container, first = false) {
      const g = new createjs.Graphics();
      g.setStrokeStyle(1);
      g.beginStroke(createjs.Graphics.getRGB(0, 0, 0));
      g.beginFill(car.color);
      let corner = [1.5, 1.5, 1.5, 1.5];

      if (first) {
         corner[0] = corner[3] = 20;
      }

      if (car.trainCoupledBack == null) {
         corner[1] = corner[2] = 20;
      }

      g.drawRoundRectComplex(0, 0, this.TRAIN_WIDTH, this.TRAIN_HEIGHT, corner[0], corner[1], corner[2], corner[3]);

      const s = new createjs.Shape(g);
      const p = geometry.add(car.track.start, car.track.unit.multiply(car.pos));
      s.x = p.x;
      s.y = p.y;
      s.regX = this.TRAIN_WIDTH / 2;
      s.regY = this.TRAIN_HEIGHT / 2;
      s.rotation = car.track.deg;

      container.addChild(s);
      if (car.trainCoupledBack) this.renderCar(car.trainCoupledBack, container);
   }

   renderAllGenericObjects() {
      object_container.removeAllChildren();
      GenericObject.all_objects.forEach((o) => {
         const c = new createjs.Container();
         c.name = "object";
         c.object = o;
         c.mouseChildren = false;
         c.x = o.pos().x;
         c.y = o.pos().y;

         if (o.type() === GenericObject.OBJECT_TYPE.text) this.renderTextObject(o, c);
         else if (o.type() === GenericObject.OBJECT_TYPE.plattform) this.renderPlattformObject(o, c);
         else throw new Error("Unknown Object");

         object_container.addChild(c);
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
      shape.graphics.beginStroke("#111111").beginFill("#444").drawRect(0, 0, plattform.size().width, plattform.size().height);

      var text = new createjs.Text(plattform.content(), "16px Arial", "#eee");
      text.textBaseline = "middle";
      text.textAlign = "center";
      text.x = plattform.size().width / 2;
      text.y = plattform.size().height / 2;

      container.addChild(text);
   }

   renderAllSignals(force) {
      signal_container.removeAllChildren();
      Signal.allSignals.forEach((signal) => {
         let container = signal_container.addChild(createSignalContainer(signal));
         alignSignalContainerWithTrack(container, signal._positioning);
         if (selection.isSelectedObject(signal)) {
            container.shadow = new createjs.Shadow("#ff0000", 0, 0, 3);
         }
      });
   }

   renderAllTracks(force) {
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

         track_container.addChild(sleepers_container);
         track_container.addChild(rails_container);
         track_container.renderedTracks = new Set();
      } else {
         this._rendering.sleepers_container = track_container.children[0];
         this._rendering.rails_container = track_container.children[1];
      }

      for (const t of tracks) {
         if (this.TrackVisible(t)) {
            //either we have a forced redraw or the track is not rendered yet
            if (force || !track_container.renderedTracks.has(t)) {
               this.renderTrack(t);               
            } else if (this._rendering.lodChanged) {
               this.updateTrack(t);
            }
         }
      }

      if (!force) {
         signal_container.children.forEach((c) => {
            if (c.data._changed) {
               c.data.draw(c);
               this.handleCachingSignal(c);
            }
         });
      }
   }

   handleCachingSignal(c) {
      if (!c.data._dontCache && !this._rendering.dont_optimize) {
         if (c.bitmapCache) c.uncache(); // c.updateCache(); //we cant just update the cache, cause maybe the bounds have changed
         //else {
         const bounds = c.getBounds();
         c.cache(bounds.x, bounds.y, bounds.width, bounds.height, stage.scale);
         //}
      } else c.uncache();
   }

   createHitArea(startpoint, endpoint, deg) {
      const hit = new createjs.Shape();
      const sw2 = this.schwellenHöhe_2;
      const p1 = geometry.perpendicular(startpoint, deg, -sw2);
      const p2 = geometry.perpendicular(startpoint, deg, sw2);
      const p3 = geometry.perpendicular(endpoint, deg, sw2);
      const p4 = geometry.perpendicular(endpoint, deg, -sw2);

      hit.graphics.beginFill("#000").mt(p1.x, p1.y).lt(p2.x, p2.y).lt(p3.x, p3.y).lt(p4.x, p4.y).lt(p1.x, p1.y);

      return hit;
   }

   renderTrack(track) {
      this.renderTrackNodes(track);

      if (track == track.switchAtTheEnd?.t1) {
         this.renderSwitch(track.switchAtTheEnd);
      }

      if (track == track.switchAtTheStart?.t1) {
         this.renderSwitch(track.switchAtTheStart);
      }

      track_container.renderedTracks.add(track);

      //if (selection.isSelectedObject(track)) this.#isSelected(track_container);
   }

   ///calculate start and end points for each node of a track and the control point for the curve
   ///start and end points of straight segments are adjusted for the curves
   calculateTrackPoints(track) {
      const hasSwitchStart = track.switchAtTheStart != null;
      const hasSwitchEnd = track.switchAtTheEnd != null;
      const nodes = track.nodes;
      const points = new Array(nodes.length);

      let node = nodes[0],
         isFirst = true,
         isLast,
         next,
         startPoint,
         endPoint,
         straightEndPoint,
         centerLine;

      for (let i = 0; i < nodes.length; i++) {
         isLast = i === nodes.length - 1;
         if (!isLast) next = nodes[i + 1];

         startPoint = node.start;
         endPoint = node.end;

         // Adjust points if there are switches
         if (!isFirst || hasSwitchStart) {
            startPoint = startPoint.add(geometry.multiply(node.unit, GRID_SIZE_2));
         }

         if (isFirst && !hasSwitchStart) {
            startPoint = startPoint.sub(geometry.multiply(node.unit, GRID_SIZE_2));
         }

         if (isLast && hasSwitchEnd) {
            endPoint = endPoint.add(geometry.multiply(node.unit, -GRID_SIZE_2));
         }

         if (isLast && !hasSwitchEnd) {
            endPoint = endPoint.add(geometry.multiply(node.unit, GRID_SIZE_2));
         }

         // Calculate straight segment end point
         straightEndPoint = isLast ? endPoint : endPoint.add(geometry.multiply(node.unit, -GRID_SIZE_2));

         centerLine = {
            node: node,
            start: startPoint,
            straightEnd: straightEndPoint,
            end: endPoint,
            unit: node.unit,
         };

         // If not the last node, calculate curve control point
         if (!isLast) {
            const nextStart = next.start.add(geometry.multiply(next.unit, GRID_SIZE_2));
            centerLine.curveEnd = nextStart;
            centerLine.nextUnit = next.unit;
            centerLine.controlPoint = geometry.getIntersectionPointX(straightEndPoint, node.unit, nextStart, next.unit);
         }

         points[i] = centerLine;
         if (!isLast) {
            isFirst = false;
            node = next;
         }
      }

      return points;
   }

   renderTrackNodes(track) {
      const points = this.calculateTrackPoints(track);

      const sleepers_container = new createjs.Container();
      sleepers_container.name = "track";
      sleepers_container.mouseChildren = false;
      sleepers_container.data = track;
      this._rendering.sleepers_container.addChild(sleepers_container);

      this.drawTrackSleepers(points, sleepers_container);

      // Draw rails
      this.renderRails(track, points);

      this.drawBumper(track, this._rendering.rails_container);
   }

   renderRails(track, points) {
      const rail_shape = new createjs.Shape();
      rail_shape.name = "track";
      rail_shape.snapToPixel = true;
      rail_shape.data = track;
      this._rendering.rails_container.addChild(rail_shape);

      let offset_vector, rail1_start, rail1_end, rail2_start, rail2_end;
      let curveStart1, curveStart2, next_offset_vector, curveEnd1, curveEnd2, cp1, cp2;

      for (const point of points) {
         offset_vector = next_offset_vector || geometry.perpendicularX(point.unit.multiply(this.rail_distance));
         // Draw straight segment rails
         rail1_start = point.start.add(offset_vector);
         rail1_end = point.straightEnd.add(offset_vector);
         rail2_start = point.start.sub(offset_vector);
         rail2_end = point.straightEnd.sub(offset_vector);
         if (point.controlPoint) {
            curveStart1 = rail1_end || point.straightEnd.add(offset_vector);
            curveStart2 = rail2_end || point.straightEnd.sub(offset_vector);
            next_offset_vector = geometry.perpendicularX(point.nextUnit.multiply(this.rail_distance));
            curveEnd1 = point.curveEnd.add(next_offset_vector);
            curveEnd2 = point.curveEnd.sub(next_offset_vector);
            cp1 = geometry.getIntersectionPointX(curveStart1, point.unit, curveEnd1, point.nextUnit);
            cp2 = geometry.getIntersectionPointX(curveStart2, point.unit, curveEnd2, point.nextUnit);
         }

         trackRendering_textured.RAILS.forEach((rail) => {
            rail_shape.graphics.setStrokeStyle(rail[0]).beginStroke(rail[1]);
            rail_shape.graphics
               .mt(rail1_start.x, rail1_start.y)
               .lt(rail1_end.x, rail1_end.y)
               .mt(rail2_start.x, rail2_start.y)
               .lt(rail2_end.x, rail2_end.y);
            if (point.controlPoint) {
               rail_shape.graphics
                  .quadraticCurveTo(cp2.x, cp2.y, curveEnd2.x, curveEnd2.y)
                  .mt(curveStart1.x, curveStart1.y)
                  .quadraticCurveTo(cp1.x, cp1.y, curveEnd1.x, curveEnd1.y);
            }
            rail_shape.graphics.endStroke();
         });
      }
   }

   drawTrackSleepers(points, container) {
      for (const point of points) {
         // Draw sleepers for straight segment
         this.drawSleepers(point.node, point.start, point.straightEnd, container);

         // Draw sleepers for curve if exists
         if (point.controlPoint) {
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

   drawSleepers(node, startPoint, endPoint, container) {
      let x = startPoint.x;
      let y = startPoint.y;

      const l = geometry.distance(startPoint, endPoint);
      // Calculate how many sleepers fit
      const amount = Math.floor(l / this.sleeperIntervall);

      // Calculate the remaining space after fitting full sleepers
      const remainingSpace = l % this.sleeperIntervall;
      // Distribute the remaining space evenly between sleepers
      const adjustedInterval = this.sleeperIntervall + remainingSpace / amount;

      const step_x = node.cos * adjustedInterval,
         step_y = node.sin * adjustedInterval;

      // Add the end gap
      x += node.cos * (this.schwellenGap / 2);
      y += node.sin * (this.schwellenGap / 2);

      for (let i = 0; i < amount; i++) {
         this.drawSleeper(i, x, y, node.deg, container);
         // Move to next position using sleeperIntervall
         y += step_y;
         x += step_x;
      }
   }

   drawSleeper(i, x, y, angle, container, length = this.schwellenHöhe, regY) {
      if (stage.scale < this.LOD) {
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
         const node = track.lastNode;
         track_container.addChild(
            new createjs.Bitmap(this.bumperImg).set({
               y: node.end.y,
               x: node.end.x,
               scale: trackRendering_textured.TRACK_SCALE,
               scaleX: -trackRendering_textured.TRACK_SCALE,
               rotation: node.deg,
               regY: this.bumperImg.height / 2,
               regX: this.bumperImg.width,
            })
         );
      }

      if (track.switchAtTheStart == null) {
         const node = track.firstNode;
         track_container.addChild(
            new createjs.Bitmap(this.bumperImg).set({
               y: node.start.y,
               x: node.start.x,
               scale: trackRendering_textured.TRACK_SCALE,
               scaleX: trackRendering_textured.TRACK_SCALE,
               rotation: node.deg,
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

   #isSelected(c) {
      c.shadow = new createjs.Shadow("#ff0000", 0, 0, 3);
   }

   updateSelection() {
      track_container.children.forEach((c) => {
         if (selection.isSelectedObject(c.track)) this.#isSelected(c);
         else c.shadow = null;
      });
      signal_container.children.forEach((c) => {
         if (c.data) {
            if (selection.isSelectedObject(c.data)) this.#isSelected(c);
            else c.shadow = null;
         }
      });
      stage.update();
   }

   calcBoundPoints(p1, p2, offset, rad1, rad2) {
      const x1 = Math.sin(rad1) * offset,
         x2 = Math.sin(rad2) * offset,
         y1 = Math.cos(rad1) * offset,
         y2 = Math.cos(rad2) * offset;
      return [
         { x: p1.x + x1, y: p1.y - y1 },
         { x: p2.x + x2, y: p2.y - y2 },
         { x: p1.x - x1, y: p1.y + y1 },
         { x: p2.x - x2, y: p2.y + y2 },
      ];
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

      const deg = sw.t1.getNodeAtLocation(sw.location).deg;

      const back2front = sw.type.is(SWITCH_TYPE.FROM_RIGHT, SWITCH_TYPE.FROM_LEFT);

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
                     geometry.perpendicularX(curvedBranch.unit),
                     p1,
                     geometry.perpendicularX(mainTrack.unit)
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
         // Draw sleepers using the pattern
         trackRendering_textured.FOUR_WAY_SLEEPER_PATTERN.forEach((data, i) => {
            // Draw sleeper with scaled length
            this.drawSleeper(
               i,
               centerPoint.x,
               centerPoint.y,
               deg,
               container,
               data.length * this.schwellenHöhe,
               data.offset * this.schwellenHöhe_2
            );

            // Move to next position
            centerPoint = centerPoint.add(step_vector);
         });
      }
   }

   renderSwitch(sw) {
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
      const tracks = [sw.t1, sw.t2, sw.t3, sw.t4].filter((t) => t);
      const flipped = sw.type.is(SWITCH_TYPE.FROM_RIGHT, SWITCH_TYPE.TO_RIGHT) ? -1 : 1;
      const mirrored = sw.type.is(SWITCH_TYPE.FROM_LEFT, SWITCH_TYPE.FROM_RIGHT) ? -1 : 1;

      // Calculate track data for each track
      const calcTrackData = (track) => {
         const node = track.getNodeAtLocation(sw.location);
         const railOffset = geometry.perpendicularX(node.unit.multiply(this.rail_distance * flipped));
         const sleeperOffset = geometry.perpendicularX(node.unit.multiply(this.schwellenHöhe_2 * flipped));
         const position = track.along(sw.location, GRID_SIZE_2);

         return {
            unit: node.unit,
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
      const mainTrack = calcTrackData(tracks[0]);
      const straightBranch = calcTrackData(tracks[1]);
      const curvedBranch = calcTrackData(tracks[2]);
      const curvedBranch2 = tracks.length === 4 ? calcTrackData(tracks[3]) : null;

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
      // Check if a container already exists for this switch
      let container = ui_container.children.find((c) => c.sw === sw);
      
      if (container) {
         // If container exists, clear it but keep it
         container.removeAllChildren();
      } else {
         // Create a new container if none exists
         container = new createjs.Container();
         container.mouseChildren = false;
         container.name = "switch";
         container.sw = sw;
         ui_container.addChild(container);
      }
      
      // Add arrows for both tracks
      [sw.from, sw.branch].forEach((t) => {
         const arrow = new createjs.Shape();
         container.addChild(arrow);

         arrow.graphics.setStrokeStyle(trackRendering_basic.STROKE, "round").beginStroke("#333");
         arrow.graphics.drawArrow(20, 5);
         arrow.x = sw.location.x;
         arrow.y = sw.location.y;
         arrow.rotation = findAngle(sw.location, t.getNodeAtLocation(sw.location));
      });
   }

   PointVisible(p1) {
      if (this._rendering?.dont_optimize) return true;
      const screen_rectangle = this._rendering.screen_rectangle;

      return (
         p1.x.between(screen_rectangle.left, screen_rectangle.right) &&
         p1.y.between(screen_rectangle.top, screen_rectangle.bottom)
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
}
