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

   constructor() {
      //cause the class is been loaded before start.js, we have to hack and calculate this constant here
      trackRendering_textured.CURVE_RADIUS = GRID_SIZE * 1.21;

      this.SIGNAL_DISTANCE_FROM_TRACK = 35;

      this.LOD = 1.2;
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
            const bounds = this.calcCanvasSize();
            const toBeRemoved = track_container.children.filter((c) => c.track && !this.TrackVisible(c.track, bounds));
            toBeRemoved.forEach((c) => {
               const signalsToBeRemoved = signal_container.children.filter((cs) => cs.data._positioning.track == c.track);
               signalsToBeRemoved.forEach((cs) => {
                  signal_container.removeChild(cs);
               });

               c.track.rendered = false;
               delete c.track;
               track_container.removeChild(c);
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
   /// and disables caching.
   /// its used by the export to image functionality
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
               this.calcRenderValues();
               tracks.forEach((t) => (t.rendered = false));
               switches.forEach((sw) => (sw.rendered = false));
            } else {
               //if we passed the LOD in either direction we have to rerender the tracks
               if (this.LOD.between(this._lastRenderScale, stage.scale)) {
                  this._rendering.lodChanged = true;
               }
            }

            this.renderAllTracks(track_container, force);
            this.renderAllSwitches(track_container, force);
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
      this.schwellenHöhe = this.schwellenImg.height * trackRendering_textured.TRACK_SCALE;
      this.schwellenHöhe_2 = this.schwellenHöhe / 2;
      this.schwellenBreite =
         (this.schwellenImg.width / trackRendering_textured.SCHWELLEN_VARIANTEN) * trackRendering_textured.TRACK_SCALE;
      this.schwellenGap = this.schwellenBreite * 1;
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

   renderAllTracks(c, force) {
      for (const t of tracks) {
         if (this.TrackVisible(t, this._rendering.screen_rectangle)) {
            if (force || !t.rendered) {
               this.renderTrack(c, t);
               for (const signal of t.signals) {
                  const c = signal_container.addChild(createSignalContainer(signal));
                  if (selection.isSelectedObject(signal)) c.shadow = new createjs.Shadow("#ff0000", 0, 0, 3);
                  alignSignalContainerWithTrack(c);
                  this.handleCachingSignal(c);
               }
            } else if (this._rendering.lodChanged) {
               const c2 = c.children.find((c) => c.track == t);
               this.updateTrack(c2, t);
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

   renderTrack(container, track) {
      const track_container = new createjs.Container();
      track_container.name = "track";
      track_container.track = track;
      track_container.mouseChildren = false;

      const bounds_points = this.drawStraightTrack2(track_container, track);

      if (type(track.switchAtTheEnd) == "Track")
         bounds_points.push(...this.drawCurvedTrack2(track_container, track, track.switchAtTheEnd));

      if (selection.isSelectedObject(track)) this.#isSelected(track_container);

      this.drawBumper(track, track_container);

      track_container.x = track.start.x;
      track_container.y = track.start.y;

      //bounds_points.forEach((p) => drawPoint(p, track_container));

      const bounds = TOOLS.boundingBox(bounds_points);
      track_container.setBounds(bounds.x, bounds.y, bounds.width, bounds.height);

      //if (!this._rendering.dont_optimize) track_container.cache(bounds.x, bounds.y, bounds.width, bounds.height, MAX_SCALE + 2);

      container.addChild(track_container);
      track.rendered = true;
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

   drawSchwellen(track, startPoint, endPoint, texture_container) {
      const cos = track._tmp.cos,
         sin = track._tmp.sin;

      let x = startPoint.x + sin * this.schwellenHöhe_2;
      let y = startPoint.y - cos * this.schwellenHöhe_2;

      //kleine verschieben, damit man mit einer lücke anfängt - Zentrierung der schwelle
      x += cos * (this.schwellenGap / 2);
      y += sin * (this.schwellenGap / 2);

      let l = geometry.distance(startPoint, endPoint);
      let tmp = l / (this.schwellenBreite + this.schwellenGap);
      let anzSchwellen = Math.floor(tmp);
      let custom_gap = ((tmp - anzSchwellen) * (this.schwellenBreite + this.schwellenGap)) / anzSchwellen + this.schwellenGap;

      for (let i = 0; i < anzSchwellen; i++) {
         if (stage.scale < this.LOD) {
            var sleeper = texture_container.addChild(new createjs.Shape()).set({ x: x, y: y, rotation: track._tmp.deg });

            sleeper.graphics
               .setStrokeStyle(0.2, "round")
               .beginStroke("black")
               .beginFill("#99735b")
               .r(0, 0, this.schwellenBreite, this.schwellenHöhe)
               .ef();
         } else {
            let random = Math.randomInt(trackRendering_textured.SCHWELLEN_VARIANTEN - 1);
            texture_container.addChild(
               new createjs.Bitmap(this.schwellenImg).set({
                  y: y,
                  x: x,
                  sourceRect: new createjs.Rectangle(
                     (random * this.schwellenImg.width) / trackRendering_textured.SCHWELLEN_VARIANTEN,
                     0,
                     this.schwellenImg.width / trackRendering_textured.SCHWELLEN_VARIANTEN,
                     this.schwellenImg.height
                  ),
                  scale: trackRendering_textured.TRACK_SCALE,
                  rotation: track._tmp.deg,
               })
            );
         }
         y += sin * (this.schwellenBreite + custom_gap);
         x += cos * (this.schwellenBreite + custom_gap);
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

   drawStraightTrack2(container, track) {
      let endPoint = geometry.sub(track.end, track.start),
         startPoint = new Point(0, 0);

      const rail_shape = new createjs.Shape();
      rail_shape.snapToPixel = true;

      if (track.switchAtTheStart) startPoint = geometry.multiply(track.unit, GRID_SIZE_2);

      if (track.switchAtTheEnd) endPoint = track.along(endPoint, GRID_SIZE_2);

      if (geometry.distance(startPoint, endPoint) > 1) {
         rail_shape.hitArea = this.createHitArea(startPoint, endPoint, track.deg);

         this.drawSchwellen(track, startPoint, endPoint, container);
         container.addChild(rail_shape);
         this.drawStraightRail(rail_shape.graphics, track, startPoint, endPoint);
      }

      return this.calcBoundPoints(startPoint, endPoint, this.schwellenHöhe_2, track.rad, track.rad);
   }

   drawStraightRail(g, track, startPoint, endPoint) {
      let points = this.calcBoundPoints(startPoint, endPoint, this.schwellenHöhe_2 - this.rail_offset, track.rad, track.rad);

      let p1, p2;
      for (let i = 0; i <= 2; i += 2) {
         trackRendering_textured.RAILS.forEach((r) => {
            g.setStrokeStyle(r[0]).beginStroke(r[1]);
            p1 = points[i];
            p2 = points[i + 1];

            g.moveTo(p1.x, p1.y).lineTo(p2.x, p2.y);
         });
      }
   }

   drawCurvedTrack2(container, track, nextTrack) {
      const rail_distance = this.schwellenHöhe_2 - this.rail_offset;
      const pc = geometry.sub(track.end, track.start); //local centerpoint of the curve
      const p1 = geometry.add(pc, geometry.multiply(track.unit, -GRID_SIZE_2)), //startpoint
         p2 = geometry.add(pc, geometry.multiply(nextTrack.unit, GRID_SIZE_2)); //endpoint

      //start and endpoint of each rail
      const p1r1 = geometry.add(p1, geometry.perpendicularX(geometry.multiply(track.unit, rail_distance))),
         p1r2 = geometry.add(p1, geometry.perpendicularX(geometry.multiply(track.unit, -rail_distance))),
         p2r1 = geometry.add(p2, geometry.perpendicularX(geometry.multiply(nextTrack.unit, rail_distance))),
         p2r2 = geometry.add(p2, geometry.perpendicularX(geometry.multiply(nextTrack.unit, -rail_distance)));

      //controlpoint of each rail
      const cpr1 = geometry.getIntersectionPointX(p1r1, track.unit, p2r1, nextTrack.unit);
      const cpr2 = geometry.getIntersectionPointX(p1r2, track.unit, p2r2, nextTrack.unit);
      const cp = geometry.getIntersectionPointX(p1, track.unit, p2, nextTrack.unit);

      // Function to get a point on the quadratic curve
      function getPointOnCurve(t, p0, cp, p1) {
         return {
            x: (1 - t) * (1 - t) * p0.x + 2 * (1 - t) * t * cp.x + t * t * p1.x,
            y: (1 - t) * (1 - t) * p0.y + 2 * (1 - t) * t * cp.y + t * t * p1.y,
         };
      }     

      function getDegreeOfTangentOnCurve(t, p0, cp, p1) {
         const dx = 2 * (1 - t) * (cp.x - p0.x) + 2 * t * (p1.x - cp.x);
         const dy = 2 * (1 - t) * (cp.y - p0.y) + 2 * t * (p1.y - cp.y);       
         return (Math.atan2(dy, dx) * 180) / Math.PI;
       }

      const regX = this.schwellenBreite / 2 / trackRendering_textured.TRACK_SCALE,
         regY = this.schwellenHöhe_2 / trackRendering_textured.TRACK_SCALE;
      let random;
      for (let i = 0; i < 10; i++) {
         const t = i / 10 + 0.04; // Parameter along the curve
         const pointOnCurve = getPointOnCurve(t, p1, cp, p2);
         const angle = getDegreeOfTangentOnCurve(t, p1, cp, p2);

         random = Math.randomInt(trackRendering_textured.SCHWELLEN_VARIANTEN - 1);

         container.addChild(
            new createjs.Bitmap(this.schwellenImg).set({
               x: pointOnCurve.x,
               y: pointOnCurve.y,
               regY: regY,
               regX: regX,
               scale: trackRendering_textured.TRACK_SCALE,
               sourceRect: new createjs.Rectangle(
                  (random * this.schwellenImg.width) / trackRendering_textured.SCHWELLEN_VARIANTEN,
                  0,
                  this.schwellenImg.width / trackRendering_textured.SCHWELLEN_VARIANTEN,
                  this.schwellenImg.height
               ),
               rotation: angle,
            })
         );
      }

      const shape = new createjs.Shape();
      shape.snapToPixel = true;
      container.addChild(shape);
      trackRendering_textured.RAILS.forEach((r) => {
         shape.graphics.setStrokeStyle(r[0]).beginStroke(r[1]);
         shape.graphics.mt(p1r1.x, p1r1.y).quadraticCurveTo(cpr1.x, cpr1.y, p2r1.x, p2r1.y);
         shape.graphics.beginStroke(r[1]);
         shape.graphics.mt(p1r2.x, p1r2.y).quadraticCurveTo(cpr2.x, cpr2.y, p2r2.x, p2r2.y);
         shape.graphics.endStroke();
      });

      return [p1r1, p1r2, p2r1, p2r2];
   }

   renderAllSwitches(c, force) {
      switches.forEach((sw) => {
         if (this.PointVisible(sw.location) && (force || !sw.rendered)) this.renderSwitch(c, sw);
         //if (sw.type.is(SWITCH_TYPE.CROSSING)) return;
      });
   }

   calcSwitchValues(sw) {
      const p1 = sw.t1.along(sw.location, this.main_x1);

      return { p1: p1, flip_hor: p1.x > sw.location.x, flip_vert: sw.type.is(SWITCH_TYPE.FROM_RIGHT, SWITCH_TYPE.TO_RIGHT) };
   }

   renderSwitch(container, sw) {
      let img, bitmap;

      if (sw.type != SWITCH_TYPE.DKW) {
         img = pl.getImage("weiche");

         const switch_values = this.calcSwitchValues(sw);

         container.addChild(
            (bitmap = new createjs.Bitmap(img).set({
               name: "switch",
               sw: sw,
               y: switch_values.p1.y,
               x: switch_values.p1.x,
               regY: img.height - this.schwellenHöhe / trackRendering_textured.TRACK_SCALE / 2,
               scaleX: switch_values.flip_hor ? -trackRendering_textured.TRACK_SCALE : trackRendering_textured.TRACK_SCALE,
               scaleY: switch_values.flip_vert ? -trackRendering_textured.TRACK_SCALE : trackRendering_textured.TRACK_SCALE,
               rotation: sw.t1.deg,
            }))
         );
      } else {
         img = pl.getImage("dkw");
         container.addChild(
            (bitmap = new createjs.Bitmap(img).set({
               name: "switch",
               sw: sw,
               y: sw.location.y,
               x: sw.location.x,
               regY: img.height / 2,
               regX: img.width / 2,
               scale: trackRendering_textured.TRACK_SCALE,
               scaleX: sw.t3.deg == 45 ? trackRendering_textured.TRACK_SCALE : -trackRendering_textured.TRACK_SCALE,
            }))
         );
      }
      /* const bounds = bitmap.getBounds();
        bitmap.cache(bounds.x,bounds.y,bounds.width,bounds.height,stage.scale); */
      sw.rendered = true;
      this.renderSwitchUI(sw);
   }

   reRenderSwitch(sw) {
      const s = ui_container.children.find((c) => c.sw == sw);
      if (s) s.parent.removeChild(s);

      this.renderSwitchUI(sw);
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

   TrackVisible(track, screen_rectangle) {
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
