"use strict";

class trackRendering_textured {
   static TRACK_SCALE = 0.2;
   static signale_scale = 0.5;
   static SCHWELLEN_VARIANTEN = 24;

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
            if(track_container.renderedTracks.size == 0 || this._rendering != null) return;
            const bounds = this.calcCanvasSize();
            
            // Find tracks that are no longer visible
            const toBeRemoved = [];
            track_container.renderedTracks.forEach(track => {
               if (!this.TrackVisible(track, bounds)) {
                  toBeRemoved.push(track);
               }
            });

            // Remove tracks and their associated signals
            toBeRemoved.forEach(track => {
               // Remove associated signals
               const signalsToBeRemoved = signal_container.children.filter(cs => cs.data._positioning.track === track);
               signalsToBeRemoved.forEach(cs => {
                  signal_container.removeChild(cs);
               });
               // Remove track from rendered set
               track_container.renderedTracks.delete(track);

               // Remove track elements from both containers
               const sleepersToRemove = track_container.children[0].children.filter(c => c.data === track);
               const railsToRemove = track_container.children[1].children.filter(c => c.data === track);

               sleepersToRemove.forEach(c => {
                  delete c.track;
                  track_container.children[0].removeChild(c);
               });

               railsToRemove.forEach(c => {
                  delete c.track;
                  track_container.children[1].removeChild(c);
               });               
            });      
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

            this.renderAllTracks(force);
            this.renderAllTrains();
            this.renderAllGenericObjects();
            this._lastRenderScale = stage.scale;
            if (!dont_optimize) this.cleanUp();
            delete this._rendering;
            stage.update();
            
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
      this.schwellenGap = this.schwellenBreite * 1.1;
      this.sleeperIntervall = this.schwellenBreite + this.schwellenGap;
      this.rail_offset = this.schwellenHöhe / 4.7;

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

   renderAllTracks(force) {
      if (force) {
         const sleepers_container = new createjs.Container();
         sleepers_container.name = "global_sleepers";
         sleepers_container.mouseChildren = false;

         const rails_container = new createjs.Container();
         rails_container.name = "global_rails";
         rails_container.mouseChildren = false;

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
            
            if (force || !track_container.renderedTracks.has(t)) {
               this.renderTrack(t);
               /* for (const signal of t.signals) {
                  const c = signal_container.addChild(createSignalContainer(signal));
                  if (selection.isSelectedObject(signal)) c.shadow = new createjs.Shadow("#ff0000", 0, 0, 3);
                  alignSignalContainerWithTrack(c);
                  this.handleCachingSignal(c);
               } */
            } else if (this._rendering.lodChanged) {
               /* const c2 = c.children.find((c) => c.track == t);
               this.updateTrack(c2, t); */
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

   renderTrackNodes(track) {
      const hasSwitchStart = track.switchAtTheStart != null;
      const hasSwitchEnd = track.switchAtTheEnd != null;
      const nodes = track.nodes;
      // Calculate all center line points
      const points = [];
      const rail_distance = this.schwellenHöhe_2 - this.rail_offset;

      for (let i = 0; i < nodes.length; i++) {
         const node = nodes[i];
         const isFirst = i === 0;
         const isLast = i === nodes.length - 1;
         const next = nodes[i + 1];

         let startPoint = node.start;
         let endPoint = node.end;

         // Adjust points if there are switches
         if (!isFirst || hasSwitchStart) {
            startPoint = startPoint.add(geometry.multiply(node.unit, GRID_SIZE_2));
         }

         if (isLast && hasSwitchEnd) {
            endPoint = endPoint.add(geometry.multiply(node.unit, -GRID_SIZE_2));
         }

         // Calculate straight segment end point
         const straightEndPoint = isLast ? endPoint : endPoint.add(geometry.multiply(node.unit, -GRID_SIZE_2));

         const centerLine = {
            node: node,
            start: startPoint,
            straightEnd: straightEndPoint,
            end: endPoint,
            unit: node.unit,
            deg: node.deg,
         };

         // If not the last node, calculate curve control point
         if (!isLast) {
            const nextStart = next.start.add(geometry.multiply(next.unit, GRID_SIZE_2));
            centerLine.curveEnd = nextStart;
            centerLine.nextUnit = next.unit;
            centerLine.controlPoint = geometry.getIntersectionPointX(straightEndPoint, node.unit, nextStart, next.unit);
         }

         points.push(centerLine);
      }

      const sleepers_container = new createjs.Container();
      sleepers_container.name = "track_sleepers";
      sleepers_container.mouseChildren = false;
      sleepers_container.data = track;
      this._rendering.sleepers_container.addChild(sleepers_container);
      // Draw sleepers
      for (const point of points) {
         // Draw sleepers for straight segment
         this.drawSleepers(point.node, point.start, point.straightEnd, sleepers_container);

         // Draw sleepers for curve if exists
         if (point.controlPoint) {
            this.drawSleepersAlongCurve(
               point.straightEnd,
               point.curveEnd,
               point.controlPoint,
               sleepers_container
            );
         }
      }

      // Draw rails
      const rail_shape = new createjs.Shape();
      rail_shape.snapToPixel = true;
      rail_shape.data = track;
      this._rendering.rails_container.addChild(rail_shape);

      trackRendering_textured.RAILS.forEach((rail) => {
         rail_shape.graphics.setStrokeStyle(rail[0]).beginStroke(rail[1]);

         for (const point of points) {
            const offset_vector = geometry.perpendicularX(geometry.multiply(point.unit, rail_distance));
            // Draw straight segment rails
            const p1 = geometry.add(point.start, offset_vector);
            const p2 = geometry.add(point.straightEnd, offset_vector);
            const p3 = geometry.sub(point.start, offset_vector);
            const p4 = geometry.sub(point.straightEnd, offset_vector);

            rail_shape.graphics.mt(p1.x, p1.y).lt(p2.x, p2.y).mt(p3.x, p3.y).lt(p4.x, p4.y);

            // Draw curve if exists
            if (point.controlPoint) {
               const curveStart1 = geometry.add(point.straightEnd, offset_vector);
               const curveStart2 = geometry.sub(point.straightEnd, offset_vector);
               const offset_vector2 = geometry.perpendicularX(geometry.multiply(point.nextUnit, rail_distance));
               const curveEnd1 = geometry.add(point.curveEnd, offset_vector2);
               const curveEnd2 = geometry.sub(point.curveEnd, offset_vector2);
               const cp1 = geometry.getIntersectionPointX(curveStart1, point.unit, curveEnd1, point.nextUnit);
               const cp2 = geometry.getIntersectionPointX(curveStart2, point.unit, curveEnd2, point.nextUnit);

               rail_shape.graphics
                  .mt(curveStart1.x, curveStart1.y)
                  .quadraticCurveTo(cp1.x, cp1.y, curveEnd1.x, curveEnd1.y)
                  .mt(curveStart2.x, curveStart2.y)
                  .quadraticCurveTo(cp2.x, cp2.y, curveEnd2.x, curveEnd2.y);
            }
         }
         rail_shape.graphics.endStroke();
      });

      
   }

   drawSleepersAlongCurve(startPoint, endPoint, controlPoint, container) {
      //the curve is eproximat 11% times longer than the straight line
      const steps = Math.floor((geometry.distance(startPoint, endPoint) * 1.11) / this.sleeperIntervall);
      const step4 = 0.25 / steps;
      for (let i = 0; i < steps; i++) {
         const t = i / steps + step4; 
         const point = this.getPointOnCurve(t, startPoint, controlPoint, endPoint);
         const angle = this.getDegreeOfTangentOnCurve(t, startPoint, controlPoint, endPoint);

         this.drawSleeper(point.x, point.y, angle, container);
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
      const dx = 2 * (1 - t) * (cp.x - p0.x) + 2 * t * (p1.x - cp.x);
      const dy = 2 * (1 - t) * (cp.y - p0.y) + 2 * t * (p1.y - cp.y);
      return (Math.atan2(dy, dx) * 180) / Math.PI;
   }

   drawBumper(track, track_container) {
      if (track.switchAtTheEnd == null) {
         track_container.addChild(
            new createjs.Bitmap(this.bumperImg).set({
               y: track._tmp.vector.y,
               x: track._tmp.vector.x,
               scale: trackRendering_textured.TRACK_SCALE,
               scaleX: -trackRendering_textured.TRACK_SCALE,
               rotation: track._tmp.deg,
               regY: this.bumperImg.height / 2,
               regX: this.bumperImg.width,
            })
         );
      }

      if (track.switchAtTheStart == null) {
         track_container.addChild(
            new createjs.Bitmap(this.bumperImg).set({
               y: 0,
               x: 0,
               scale: trackRendering_textured.TRACK_SCALE,
               scaleX: trackRendering_textured.TRACK_SCALE,
               rotation: track._tmp.deg,
               regY: this.bumperImg.height / 2,
               regX: this.bumperImg.width,
            })
         );
      }
   }

   updateTrack(container, track) {
      container.removeAllChildren();
      this.drawStraightTrack2(container, track);

      if (type(track.switchAtTheEnd) == "Track") this.drawCurvedTrack2(container, track, track.switchAtTheEnd);
      this.drawBumper(track, container);

      //container.updateCache();
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

   drawSleepers(node, startPoint, endPoint, container) {
      let x = startPoint.x;
      let y = startPoint.y;

      let l = geometry.distance(startPoint, endPoint);
      // Calculate how many sleepers fit
      let amount = Math.floor(l / this.sleeperIntervall);

      // Calculate the remaining space after fitting full sleepers
      let remainingSpace = l % this.sleeperIntervall;
      // Distribute the remaining space evenly between sleepers
      let adjustedInterval = this.sleeperIntervall + remainingSpace / amount;

      const step_x = node.cos * adjustedInterval,
         step_y = node.sin * adjustedInterval;
      // Calculate the total space needed for sleepers
      let totalSpace = amount * this.sleeperIntervall;
      // Calculate the remaining space to be distributed at both ends
      let endGap = (l - totalSpace) / 2;

      // Add the end gap
      x += node.cos * (this.schwellenGap / 2);
      y += node.sin * (this.schwellenGap / 2);

      for (let i = 0; i < amount; i++) {
         this.drawSleeper(x, y, node.deg, container);
         // Move to next position using sleeperIntervall
         y += step_y;
         x += step_x;
      }
   }

   drawSleeper(x, y, angle, container, length = this.schwellenHöhe, regY) {
      if (stage.scale < this.LOD) {
         const ry = regY == null ? length / 2 : regY;
         var sleeper = container.addChild(new createjs.Shape()).set({ x: x, y: y, rotation: angle, regY: ry, regX: 0 });

         sleeper.graphics
            .setStrokeStyle(0.2, "round")
            .beginStroke("black")
            .beginFill("#99735b")
            .r(0, 0, this.schwellenBreite, length)
            .ef();
      } else {
         let random = Math.randomInt(trackRendering_textured.SCHWELLEN_VARIANTEN - 1);
         const scaleY = length / this.schwellenHöhe;
         const ry = regY == null ? this.schwellenImg.height / 2 : regY / (trackRendering_textured.TRACK_SCALE * scaleY);
         container.addChild(
            new createjs.Bitmap(this.schwellenImg).set({
               y: y,
               x: x,
               regY: ry,
               regX: 0,
               sourceRect: new createjs.Rectangle(
                  (random * this.schwellenImg.width) / trackRendering_textured.SCHWELLEN_VARIANTEN,
                  0,
                  this.sleepersImgWidth,
                  this.schwellenImg.height
               ),
               scale: trackRendering_textured.TRACK_SCALE,
               scaleY: trackRendering_textured.TRACK_SCALE * scaleY,
               rotation: angle,
            })
         );
      }
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

   

   drawSleepersOnSwitch(sw) {
      // Function to get a point on the quadratic curve

      const container = new createjs.Container();
      container.name = "switch_sleepers";
      container.data = sw;
      container.mouseChildren = false;
      this._rendering.sleepers_container.addChild(container);

      let points = [];

      let tracks = [sw.t1, sw.t2, sw.t3, sw.t4].filter((t) => t);
      const flipped = sw.type.is(SWITCH_TYPE.FROM_RIGHT, SWITCH_TYPE.TO_RIGHT) ? -1 : 1;
      const mirrored = sw.type.is(SWITCH_TYPE.FROM_LEFT, SWITCH_TYPE.FROM_RIGHT) ? -1 : 1;

      let deg = (sw.location.equals(sw.t1.start) ? sw.t1.firstNode : sw.t1.lastNode).deg;

      const back2front = sw.type.is(SWITCH_TYPE.FROM_RIGHT, SWITCH_TYPE.FROM_LEFT);

      tracks.forEach((track, i) => {
         let p = track.along(sw.location, GRID_SIZE_2);
         let node = sw.location.equals(track.start) ? track.firstNode : track.lastNode;
         let p1 = geometry.add(p, geometry.perpendicularX(geometry.multiply(node.unit, this.schwellenHöhe_2 * flipped))),
            p2 = geometry.add(p, geometry.perpendicularX(geometry.multiply(node.unit, -this.schwellenHöhe_2 * flipped)));

         points.push([p, p1, p2, node.unit]);
      });

      if (tracks.length == 3) {
         const cp = geometry.getIntersectionPointX(points[0][2], points[0][3], points[2][2], points[2][3]);

         const length = geometry.distance(points[0][1], points[1][1]); //length of the straight part + half of the gap, to minimize the gap the to next track
         const length2 = geometry.distance(points[0][2], points[2][2]); //almost the length of the curve

         const amount_on_straight_rail = Math.floor(length / this.sleeperIntervall);
         const amount_on_curved_rail = Math.floor(length2 / (this.sleeperIntervall * 1.15));
         const new_intervall = (this.sleeperIntervall + (length % this.sleeperIntervall) / amount_on_straight_rail) * mirrored; //new intervall to minimize the gap and using the leftover from the division
         let p1, t, sleeper_length;

         if (back2front) p1 = points[0][1].sub(geometry.multiply(points[0][3], this.sleeperIntervall));
         else p1 = points[0][1].add(geometry.multiply(points[0][3], (this.schwellenGap / 2) * mirrored));

         const step_vector = geometry.multiply(points[0][3], new_intervall);

         for (let i = 0; i < amount_on_curved_rail; i++) {
            t = i / amount_on_curved_rail + 0.4 / amount_on_curved_rail;

            sleeper_length = Math.max(
               geometry.distance(this.getPointOnCurve(t, points[0][2], cp, points[2][2]), p1),
               this.schwellenHöhe
            );

            this.drawSleeper(p1.x, p1.y, deg, container, -sleeper_length * flipped, 0);
            p1 = p1.add(step_vector);
         }

         for (let i = amount_on_curved_rail; i < amount_on_straight_rail; i++) {
            t = (this.sleeperIntervall * i) / length2;
            //subtract the sleeper intervall to create a gap to the next sleeper
            sleeper_length = Math.max(
               geometry.distance(
                  geometry.getIntersectionPointX(
                     points[2][2],
                     geometry.perpendicularX(points[2][3]),
                     p1,
                     geometry.perpendicularX(points[0][3])
                  ),
                  p1
               ),
               this.schwellenHöhe
            );

            this.drawSleeper(p1.x, p1.y, deg, container, -sleeper_length * flipped, 0);
            p1 = p1.add(step_vector);
         }
      } else if (tracks.length == 4) {
         // Calculate starting point and offset vector
         let centerPoint = points[1][0].add(geometry.multiply(points[0][3], this.sleeperIntervall / 4));
         const offsetVector = geometry.perpendicularX(points[0][3]);

         // Draw sleepers using the pattern
         trackRendering_textured.FOUR_WAY_SLEEPER_PATTERN.forEach((data) => {
            // Calculate sleeper position
            const sleeperPosition = centerPoint.add(offsetVector.multiply());

            // Draw sleeper with scaled length
            this.drawSleeper(
               centerPoint.x,
               centerPoint.y,
               deg,
               container,
               data.length * this.schwellenHöhe,
               data.offset * this.schwellenHöhe_2
            );

            // Move to next position
            centerPoint = centerPoint.add(geometry.multiply(points[0][3], this.sleeperIntervall));
         });
      }
   }

   drawBezierRail(graphics, startTrack, endTrack, railSide) {
      // railSide: 0 for inner rail, 1 for outer rail
      const curvature = 22;
      const startPoint = railSide === 0 ? startTrack.rails.inner : startTrack.rails.outer;
      const endPoint = railSide === 0 ? endTrack.rails.inner : endTrack.rails.outer;

      const cp1 = geometry.add(startPoint, geometry.multiply(startTrack.unit, curvature));
      const cp2 = geometry.add(endPoint, geometry.multiply(endTrack.unit, -curvature));

      // Draw control points for debugging
      //drawPoint(cp1, null, "cp1", "#0fffa0");
      //drawPoint(cp2, null, "cp2", "#0fffa0");

      graphics.mt(startPoint.x, startPoint.y).bezierCurveTo(cp1.x, cp1.y, cp2.x, cp2.y, endPoint.x, endPoint.y);
   }

   renderSwitch(sw) {
      this.drawSleepersOnSwitch(sw);

      // Calculate common values once
      const rail_distance = this.schwellenHöhe_2 - this.rail_offset;
      const tracks = [sw.t1, sw.t2, sw.t3, sw.t4].filter((t) => t);
      const flipped = sw.type.is(SWITCH_TYPE.FROM_RIGHT, SWITCH_TYPE.TO_RIGHT) ? -1 : 1;
      const mirrored = sw.type.is(SWITCH_TYPE.FROM_LEFT, SWITCH_TYPE.FROM_RIGHT) ? -1 : 1;

      // Pre-calculate track data once
      const trackData = tracks.map((track) => {
         const node = sw.location.equals(track.start) ? track.firstNode : track.lastNode;
         const unit = node.unit;
         // Calculate rail offset vector once per track
         const railOffset = geometry.perpendicularX(geometry.multiply(unit, rail_distance * flipped));
         const position = track.along(sw.location, GRID_SIZE_2);

         return {
            position,
            unit,
            // Calculate rail positions once
            rails: {
               inner: position.add(railOffset),
               outer: position.sub(railOffset),
            },
         };
      });

      const shape = new createjs.Shape();
      shape.data = sw;
      shape.snapToPixel = true;
      this._rendering.rails_container.addChild(shape);

      const mainTrack = trackData[0];
      const straightBranch = trackData[1];
      const curvedBranch = trackData[2];

      // Calculate intersection points once
      let g = null;

      if (trackData.length === 3) {
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
         const frogOffset = -3 * mirrored;
         const guardRailLength = 10 * mirrored;
         const frogPoints = {
            curveEnd: Point.fromPoint(intersections.frog).add(curvedBranch.unit.multiply(frogOffset)),
            straightStart: Point.fromPoint(intersections.frog).add(straightBranch.unit.multiply(frogOffset)),
         };

         // Calculate end points using the pre-calculated points
         frogPoints.straightEnd = frogPoints.curveEnd.add(straightBranch.unit.multiply(guardRailLength));
         frogPoints.curveStart = frogPoints.straightStart.add(curvedBranch.unit.multiply(guardRailLength));

         // Draw all rails
         trackRendering_textured.RAILS.forEach((rail) => {
            g = shape.graphics.setStrokeStyle(rail[0]).beginStroke(rail[1]);

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
               .lt(mainTrack.rails.outer.x, mainTrack.rails.outer.y + 2 * flipped);
            g.endStroke();
         });
      } else if (trackData.length === 4) {
         const curvedBranch2 = trackData[3];

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

         intersections.frog2 = geometry.getIntersectionPointX(
            mainTrack.rails.inner,
            mainTrack.unit,
            curvedBranch2.rails.outer,
            curvedBranch2.unit
         );

         intersections.innerCurve = geometry.getIntersectionPointX(
            mainTrack.rails.inner,
            mainTrack.unit,
            curvedBranch.rails.inner,
            curvedBranch.unit
         );

         intersections.outerCurve2 = geometry.getIntersectionPointX(
            straightBranch.rails.outer,
            straightBranch.unit,
            curvedBranch2.rails.outer,
            curvedBranch2.unit
         );

         intersections.innerCurve2 = geometry.getIntersectionPointX(
            straightBranch.rails.inner,
            straightBranch.unit,
            curvedBranch2.rails.inner,
            curvedBranch2.unit
         );

         trackRendering_textured.RAILS.forEach((rail) => {
            g = shape.graphics.setStrokeStyle(rail[0]).beginStroke(rail[1]);

            // Draw outer rails
            this.drawBezierRail(g, straightBranch, curvedBranch2, 1);
            this.drawBezierRail(g, curvedBranch, mainTrack, 0);
            this.drawBezierRail(g, straightBranch, curvedBranch2, 0);
            this.drawBezierRail(g, curvedBranch, mainTrack, 1);

            let p1 = straightBranch.rails.outer.add(straightBranch.unit.multiply(30));
            g.mt(mainTrack.rails.outer.x, mainTrack.rails.outer.y).lt(p1.x, p1.y);

            p1 = mainTrack.rails.inner.add(mainTrack.unit.multiply(-30));
            g.mt(straightBranch.rails.inner.x, straightBranch.rails.inner.y).lt(p1.x, p1.y);

            p1 = curvedBranch.rails.inner.add(curvedBranch.unit.multiply(30));
            g.mt(curvedBranch2.rails.inner.x, curvedBranch2.rails.inner.y).lt(p1.x, p1.y);

            p1 = curvedBranch2.rails.outer.add(curvedBranch2.unit.multiply(-30));
            g.mt(curvedBranch.rails.outer.x, curvedBranch.rails.outer.y).lt(p1.x, p1.y);

            // Frog point and connecting rails
            g.mt(straightBranch.rails.outer.x, straightBranch.rails.outer.y)
               .lt(intersections.frog.x, intersections.frog.y)
               .lt(curvedBranch.rails.inner.x, curvedBranch.rails.inner.y);

            g.mt(mainTrack.rails.inner.x, mainTrack.rails.inner.y)
               .lt(intersections.frog2.x, intersections.frog2.y)
               .lt(curvedBranch2.rails.outer.x, curvedBranch2.rails.outer.y);

            g.endStroke();
         });
      }
   }

   reRenderSwitch(sw) {
      const s = ui_container.children.find((c) => c.sw == sw);
      if (s) s.parent.removeChild(s);

      //this.renderSwitchUI(sw);
   }

   renderSwitchUI(sw) {
      ui_container.addChild(
         (() => {
            let c = new createjs.Container();
            c.mouseChildren = false;
            c.name = "switch";
            c.sw = sw;
            [sw.from, sw.branch].forEach((t) => {
               const arrow = new createjs.Shape();
               c.addChild(arrow);

               arrow.graphics.setStrokeStyle(trackRendering_basic.STROKE, "round").beginStroke("#333");
               arrow.graphics.drawArrow(20, 5);
               arrow.x = sw.location.x;
               arrow.y = sw.location.y;
               arrow.rotation = findAngle(sw.location, t.end.equals(sw.location) ? t.start : t.end);
            });
            return c;
         })()
      );
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
