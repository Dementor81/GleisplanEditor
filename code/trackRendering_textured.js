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
      if (this._idleCallback) cancelIdleCallback(this._idleCallback);

      const rIC = requestIdleCallback ?? setTimeout;

      this._idleCallback = rIC(
         function (r) {
            const toBeRemoved = track_container.children.filter((c) => c.track && !this.TrackVisible(c.track));
            toBeRemoved.forEach((c) => {
               const signalsToBeRemoved = signal_container.children.filter((cs) => cs.signal._positioning.track == c.track);
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
      this.schwellenBreite = (this.schwellenImg.width / trackRendering_textured.SCHWELLEN_VARIANTEN) * trackRendering_textured.TRACK_SCALE;
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
      var text = new createjs.Text(text_object.content(), "20px Arial", "#000000");
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
      shape.graphics.beginStroke("#111111").beginFill("#333333").drawRect(0, 0, plattform.size().width, plattform.size().height);

      var text = new createjs.Text(plattform.content(), "20px Arial", "#eee");
      text.textBaseline = "middle";
      text.textAlign = "center";
      text.x = plattform.size().width / 2;
      text.y = plattform.size().height / 2;

      /* const height = text.getMeasuredHeight();
      const width = text.getMeasuredWidth();

      const hit = new createjs.Shape();
      hit.graphics.beginFill("#000").mt(0, 0).lt(width, 0).lt(width, -height).lt(0, -height).lt(0, 0);

      text.hitArea = hit; */

      container.addChild(text);
   }

   renderAllTracks(c, force) {
      tracks.forEach((t) => {
         if (this.TrackVisible(t)) {
            if (force || !t.rendered) {
               this.renderTrack(c, t);
               t.signals.forEach((signal) => {
                  const c = signal_container.addChild(createSignalContainer(signal));
                  if (selection.isSelectedObject(signal)) c.shadow = new createjs.Shadow("#ff0000", 0, 0, 3);
                  alignSignalContainerWithTrack(c);
                  this.handleCachingSignal(c);
               });
            } else if (this._rendering.lodChanged) {
               const c2 = c.children.find((c) => c.track == t);
               this.updateTrack(c2, t);
            }
         }
      });
      if (!force) {
         signal_container.children.forEach((c) => {
            if (c.signal._changed) {
               c.signal.draw(c);
               this.handleCachingSignal(c);
            }
         });
      }
   }

   handleCachingSignal(c) {
      if (!c.signal._dontCache && !this._rendering.dont_optimize) {
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

      const bounds_points = this.drawStraightTrack(track_container, track);

      if (type(track.switchAtTheEnd) == "Track") bounds_points.push(...this.drawCurvedTrack(track_container, track, track.switchAtTheEnd));

      if (selection.isSelectedObject(track)) this.#isSelected(track_container);

      this.drawBumper(track, track_container);

      track_container.x = track.start.x;
      track_container.y = track.start.y;

      //bounds_points.forEach((p) => drawPoint(p, track_container));

      const bounds = boundingBox(bounds_points);
      track_container.setBounds(bounds.x, bounds.y, bounds.width, bounds.height);

      if (!this._rendering.dont_optimize) track_container.cache(bounds.x, bounds.y, bounds.width, bounds.height, MAX_SCALE + 2);

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
      this.drawStraightTrack(container, track);

      if (type(track.switchAtTheEnd) == "Track") this.drawCurvedTrack(container, track, track.switchAtTheEnd);
      this.drawBumper(track, container);

      container.updateCache();
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
         if (c.signal) {
            if (selection.isSelectedObject(c.signal)) this.#isSelected(c);
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

   drawStraightTrack(container, track) {
      let endPoint = geometry.sub(track.end, track.start),
         startPoint = new Point(0, 0);

      const rail_shape = new createjs.Shape();
      rail_shape.snapToPixel = true;

      if (track.switchAtTheStart) startPoint = track.unit.multiply(this.main_x1);
      else startPoint = geometry.add(startPoint, track.unit.multiply(-GRID_SIZE_2));
      if (track.switchAtTheEnd) endPoint = geometry.add(endPoint, track.unit.multiply(-this.main_x1));
      else endPoint = geometry.add(endPoint, track.unit.multiply(GRID_SIZE_2));
      if (geometry.distance(startPoint, endPoint) > 1) {
         rail_shape.hitArea = this.createHitArea(startPoint, endPoint, track.deg);

         this.drawSchwellen(track, startPoint, endPoint, container);
         container.addChild(rail_shape);
         this.drawStraightRail(rail_shape.graphics, track, startPoint, endPoint);
      }

      return this.calcBoundPoints(startPoint, endPoint, this.schwellenHöhe_2, track.rad, track.rad);
   }

   calcValuesForCurvedTrack(track1, track2) {
      //get the horizontal and the diagonal track
      const horizontalTrack = track1.deg == 0 ? track1 : track2;
      const diagonalTrack = track1.deg == 0 ? track2 : track1;
      //calculate the point on the horizontal Track, where the curve ends
      //the centerpoint is always above or below the horizontal track
      const p1 = horizontalTrack.along(track1.end, this.main_x1);

      //centerpoint is above or below the P1 point
      const centerpoint = { x: p1.x, y: p1.y - trackRendering_textured.CURVE_RADIUS * Math.sign(track1.deg - track2.deg) };

      //get the angle of diagonal track
      let deg = findAngle(track1.end, diagonalTrack.start.equals(track1.end) ? diagonalTrack.end : diagonalTrack.start);

      //some magic to get the angle for drawArc
      deg += track1.deg + track2.deg > 0 ? 225 : 90;

      //change the reference Point (we draw in local system but calculated in globalsystem)
      return { centerpoint: geometry.sub(centerpoint, track1.start), deg: deg };
   }

   drawCurvedTrack(container, track, nextTrack) {
      const values = this.calcValuesForCurvedTrack(track, nextTrack);
      this.DrawSleepersInCircle(container, values.centerpoint, values.deg);

      const shape = new createjs.Shape();
      shape.snapToPixel = true;
      container.addChild(shape);

      const top = trackRendering_textured.CURVE_RADIUS - this.schwellenHöhe_2 + this.rail_offset,
         bottom = trackRendering_textured.CURVE_RADIUS + this.schwellenHöhe_2 - this.rail_offset;

      const rad = deg2rad(values.deg);
      const rad2 = rad + π / 4;
      trackRendering_textured.RAILS.forEach((r) => {
         shape.graphics.setStrokeStyle(r[0]).beginStroke(r[1]);
         shape.graphics.arc(values.centerpoint.x, values.centerpoint.y, top, rad, rad2);
         shape.graphics.beginStroke(r[1]);
         shape.graphics.arc(values.centerpoint.x, values.centerpoint.y, bottom, rad, rad2);
         shape.graphics.endStroke();
      });

      return [
         geometry.pointOnArc(trackRendering_textured.CURVE_RADIUS - this.schwellenHöhe_2, rad, values.centerpoint),
         geometry.pointOnArc(trackRendering_textured.CURVE_RADIUS - this.schwellenHöhe_2, rad2, values.centerpoint),
         geometry.pointOnArc(trackRendering_textured.CURVE_RADIUS + this.schwellenHöhe_2, rad, values.centerpoint),
         geometry.pointOnArc(trackRendering_textured.CURVE_RADIUS + this.schwellenHöhe_2, rad2, values.centerpoint),
      ];
   }

   drawArc(rail_shape, centerpoint, radius, start_deg, color, thickness) {
      rail_shape.graphics
         .setStrokeStyle(thickness)
         .beginStroke(color)
         .arc(centerpoint.x, centerpoint.y, radius, deg2rad(start_deg), deg2rad(start_deg + 45));
   }

   DrawSleepersInCircle(container, centerpoint, deg) {
      const radius = trackRendering_textured.CURVE_RADIUS,
         l = (π / 4) * radius,
         anzSchwellen = Math.floor(l / (this.schwellenBreite + this.schwellenGap));

      const startAngle = deg2rad(deg),
         endAngle = startAngle + π / 4;

      const step = (endAngle - startAngle) / anzSchwellen;
      let rad = startAngle + step / 4,
         random;

      for (let i = 0; i < anzSchwellen; i++) {
         random = Math.randomInt(trackRendering_textured.SCHWELLEN_VARIANTEN - 1);

         container.addChild(
            new createjs.Bitmap(this.schwellenImg).set({
               x: centerpoint.x + Math.cos(rad) * (radius + this.schwellenHöhe_2),
               y: centerpoint.y + Math.sin(rad) * (radius + this.schwellenHöhe_2),
               scale: trackRendering_textured.TRACK_SCALE,
               sourceRect: new createjs.Rectangle(
                  (random * this.schwellenImg.width) / trackRendering_textured.SCHWELLEN_VARIANTEN,
                  0,
                  this.schwellenImg.width / trackRendering_textured.SCHWELLEN_VARIANTEN,
                  this.schwellenImg.height
               ),
               rotation: (rad * 180) / Math.PI + 90,
            })
         );

         rad += step;
      }
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
      const width = stage.canvas.width / stage.scaleX,
         height = stage.canvas.height / stage.scaleY,
         x = -stage.x / stage.scaleX,
         y = -stage.y / stage.scaleY;

      return p1.x.between(x, x + width) && p1.y.between(y, y + height);
   }

   TrackVisible(track) {
      if (this._rendering?.dont_optimize) return true;
      const width = stage.canvas.width / stage.scaleX,
         height = stage.canvas.height / stage.scaleY,
         x = -stage.x / stage.scaleX,
         y = -stage.y / stage.scaleY;
      const screen_rectangle = { left: x, top: y, right: x + width, bottom: y + height };

      const isInside = (point, rect) => point.x > rect.left && point.x < rect.right && point.y > rect.top && point.y < rect.bottom;

      if (isInside(track.start, screen_rectangle) || isInside(track.end, screen_rectangle)) return true; //

      //left
      let p1 = { x: x, y: y },
         p2 = { x: x, y: screen_rectangle.bottom };
      if (geometry.doLineSegmentsIntersect(p1, p2, track.start, track.end)) return true;
      //bottom
      p1 = p2;
      p2 = { x: screen_rectangle.right, y: screen_rectangle.bottom };
      if (geometry.doLineSegmentsIntersect(p1, p2, track.start, track.end)) return true;
      //right
      p1 = p2;
      p2 = { x: screen_rectangle.right, y: y };
      if (geometry.doLineSegmentsIntersect(p1, p2, track.start, track.end)) return true;
      //top
      p1 = p2;
      p2 = { x: x, y: y };
      if (geometry.doLineSegmentsIntersect(p1, p2, track.start, track.end)) return true;

      return false;
   }
}
