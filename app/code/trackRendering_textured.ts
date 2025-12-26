"use strict";

// ES6 Module imports
import { Track } from "./track.ts";
import { Switch } from "./switch.ts";
import { Signal } from "./signal.ts";
import { SignalRenderer } from "./signalRenderer.ts";
import { Train } from "./train.ts";
import { GenericObject } from "./generic_object.ts";
import { geometry, Point } from "./tools.ts";
import { NumberUtils } from "./utils.ts";
import { ui } from "./ui.ts";
import { CONFIG } from "./config.ts";
import { Application } from "./application.ts";

export class trackRendering_textured {
   static SWITCH_UI_STROKE = 3;
   static TRACK_SCALE = 0.25;
   static signale_scale = 0.5;
   static SCHWELLEN_VARIANTEN = 24;
   static CURVATURE_4WAY_SWITCH = 16;
   static RAILS: [number, string][] = [
      [3.2, "#222"],
      [2.8, "#999"],
      [1.4, "#eee"],
   ];
   static FOUR_WAY_SLEEPER_PATTERN = [
      { offset: 1, length: 1.0 },
      { offset: 1.1, length: 1.2 },
      { offset: 1.2, length: 1.5 },
      { offset: 1.3, length: 1.5 },
   ];
   static CURVE_RADIUS: number;

   app: Application;
   SIGNAL_DISTANCE_FROM_TRACK: number;
   LOD: number;
   _lastRenderScale: number;
   _sleeperCache: Record<string, any>;
   _bitmapCache: any[];
   _idleCallback: any;
   _rendering: any;

   schwellenImg: any;
   bumperImg: any;
   sleepersImgWidth: number = 0;
   schwellenHöhe: number = 0;
   schwellenHöhe_2: number = 0;
   schwellenBreite: number = 0;
   schwellenGap: number = 0;
   sleeperIntervall: number = 0;
   rail_offset: number = 0;
   rail_distance: number = 0;
   TRAIN_HEIGHT: number = 0;
   TRAIN_WIDTH: number = 0;
   main_x1: number = 0;

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
         if (typeof (window as any).requestIdleCallback === "function") cancelIdleCallback(this._idleCallback);
         else clearTimeout(this._idleCallback);
      }

      const myIdleCallback =
         (typeof (window as any).requestIdleCallback === "function" ? (window as any).requestIdleCallback : null) ||
         function (callback: any) {
            return setTimeout(callback, 1);
         };

      this._idleCallback = myIdleCallback(
         () => {
            if (this.app.renderingManager!.containers.tracks.renderedTracks.size == 0 || this._rendering != null) return;
            const bounds = this.calcCanvasSize();

            // Find tracks that are no longer visible
            const toBeRemoved: any[] = [];
            this.app.renderingManager!.containers.tracks.renderedTracks.forEach((track: any) => {
               if (!this.TrackVisible(track, bounds)) {
                  toBeRemoved.push(track);
               }
            });

            // Remove tracks and their associated signals
            toBeRemoved.forEach((track) => {
               // Remove associated signals
               const signalsToBeRemoved = this.app.renderingManager!.containers.signals.children.filter(
                  (cs: any) => cs.data._positioning.track === track
               );
               signalsToBeRemoved.forEach((cs: any) => {
                  this.app.renderingManager!.containers.signals.removeChild(cs);
               });
               // Remove track from rendered set
               this.app.renderingManager!.containers.tracks.renderedTracks.delete(track);

               // Remove track elements from both containers
               const sleepersToRemove = this.app.renderingManager!.containers.tracks.children[0].children.filter((c: any) => c.data === track);
               const railsToRemove = this.app.renderingManager!.containers.tracks.children[1].children.filter((c: any) => c.data === track);

               sleepersToRemove.forEach((c: any) => {
                  delete c.track;
                  this.app.renderingManager!.containers.tracks.children[0].removeChild(c);
               });

               railsToRemove.forEach((c: any) => {
                  delete c.track;
                  this.app.renderingManager!.containers.tracks.children[1].removeChild(c);
               });
            });

            // Clean up sleeper cache if it's getting too large (more than 200 entries)
            if (Object.keys(this._sleeperCache).length > 200) {
               this._sleeperCache = {};
            }

            this._idleCallback = null;
         }
      );
   }

   calcCanvasSize() {
      const stage = this.app.renderingManager!.stage;
      const width = (stage.canvas.width + CONFIG.GRID_SIZE * 2) / stage.scaleX,
         height = (stage.canvas.height + CONFIG.GRID_SIZE * 2) / stage.scaleY,
         x = (-stage.x - CONFIG.GRID_SIZE) / stage.scaleX,
         y = (-stage.y - CONFIG.GRID_SIZE) / stage.scaleY;
      return { left: x, top: y, right: x + width, bottom: y + height };
   }

   reDrawEverything(force = false, dont_optimize = false) {
      if (!Application.getInstance().preLoader!.loaded)
         setTimeout(() => {
            this.reDrawEverything(force, dont_optimize);
         }, 500);
      else {
         if (this._rendering == undefined) {
            try {
               this._rendering = { dont_optimize: dont_optimize };
               this._rendering.screen_rectangle = this.calcCanvasSize();

               if (force) {
                  this.app.renderingManager!.containers.removeAllChildren();

                  this.calcRenderValues();
               } else {
                  if (NumberUtils.between(this.LOD, this._lastRenderScale, this.app.renderingManager!.stage.scale)) {
                     this._rendering.lodChanged = true;
                  }
               }

               try {
                  this.renderAllTracks(force);
                  this.renderAllSignals(force);
                  this.renderAllTrains();
                  this.renderAllGenericObjects();
                  this._lastRenderScale = this.app.renderingManager!.stage.scale;
                  if (!dont_optimize) this.cleanUp();
               } catch (error) {
                  console.error("Error during rendering:", error);
                  throw error;
               } finally {
                  delete this._rendering;
                  this.app.renderingManager!.update();
               }
            } catch (error) {
               console.error("Critical rendering error:", error);
               ui.showErrorToast(error as any);
               delete this._rendering;
               throw error;
            }
         }
      }
   }

   calcRenderValues() {
      this.schwellenImg = this.app.preLoader!.getImage("schwellen");
      this.bumperImg = this.app.preLoader!.getImage("bumper");
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
      this.app.renderingManager!.containers.trains.removeAllChildren();

      Train.allTrains
         .filter((train: any) => !train.trainCoupledFront)
         .forEach((train: any) => {
            const c = new createjs.Container();
            c.name = "train";
            (c as any).train = train;
            c.mouseChildren = true;

            this.renderCar(train, c);

            this.app.renderingManager!.containers.trains.addChild(c);
         });
   }

   renderCar(car: any, container: any) {
      const g = new createjs.Graphics();
      g.setStrokeStyle(1);
      g.beginStroke(createjs.Graphics.getRGB(0, 0, 0));
      g.beginFill(car.color);

      const carWidth = car.length;
      const carHeight = this.TRAIN_HEIGHT;

      let corner = [1.5, 1.5, 1.5, 1.5];

      if (car.type == Train.CAR_TYPES.LOCOMOTIVE) {
         corner[0] = corner[3] = corner[1] = corner[2] = 8;
      }

      g.drawRoundRectComplex(0, 0, carWidth, carHeight, corner[0], corner[1], corner[2], corner[3]);

      const s = new createjs.Shape(g as any);
      s.data = car;
      s.name = "train";

      const p = car.track.getPointFromKm(car.pos);

      s.x = p.x;
      s.y = p.y;
      s.regX = carWidth / 2;
      s.regY = carHeight / 2;
      s.rotation = car.track.deg;

      container.addChild(s);
      if (car.number && car.type == Train.CAR_TYPES.LOCOMOTIVE) {
         const text = new createjs.Text(car.number, "10px Arial", "#000000");
         text.textAlign = "center";
         text.x = p.x;
         text.y = p.y;
         text.textBaseline = "middle";
         container.addChild(text);
      }
      if (car.trainCoupledBack) {
         this.renderCar(car.trainCoupledBack, container);
      }
   }

   renderAllGenericObjects() {
      this.app.renderingManager!.containers.objects.removeAllChildren();
      GenericObject.all_objects.forEach((o: any) => {
         const c = new createjs.Container();
         c.name = "GenericObject";
         c.data = o;
         c.mouseChildren = false;
         c.x = o.pos().x;
         c.y = o.pos().y;

         if (o.type() === GenericObject.OBJECT_TYPE.text) this.renderTextObject(o, c);
         else if (o.type() === GenericObject.OBJECT_TYPE.plattform) this.renderPlattformObject(o, c);
         else throw new Error("Unknown Object");

         this.app.renderingManager!.containers.objects.addChild(c);
      });
   }

   renderTextObject(text_object: any, container: any) {
      var text = new createjs.Text(text_object.content(), "24px Arial", "#000000");
      text.textBaseline = "alphabetic";
      const height = text.getMeasuredHeight();
      const width = text.getMeasuredWidth();

      const hit = new createjs.Shape();
      hit.graphics.beginFill("#000").mt(0, 0).lt(width, 0).lt(width, -height).lt(0, -height).lt(0, 0);

      text.hitArea = hit;

      container.addChild(text);
   }

   renderPlattformObject(plattform: any, container: any) {
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

   renderAllSignals(_force?: boolean) {
      this.app.renderingManager!.containers.signals.removeAllChildren();
      Signal.allSignals.forEach((signal: any) => {
         let container = this.app.renderingManager!.containers.signals.addChild(SignalRenderer.createSignalContainer(signal));
         this.app.alignSignalContainerWithTrack(container, signal._positioning);
      });
   }

   renderAllTracks(force?: boolean) {
      const containers = this.app.renderingManager!.containers;
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

   calculateTrackPoints(track: any) {
      const startConnection = track.switchAtTheStart;
      const endConnection = track.switchAtTheEnd;

      let startPoint = track.start;
      let endPoint = track.end;

      if (startConnection) {
         const size = startConnection instanceof Switch ? startConnection.size : CONFIG.GRID_SIZE;
         startPoint = startPoint.add(geometry.multiply(track.unit, size));
      } else {
         startPoint = startPoint.sub(geometry.multiply(track.unit, CONFIG.GRID_SIZE));
      }

      let straightEndPoint = endPoint;
      let curveEnd: any = null;
      let controlPoint: any = null;
      let nextUnit: any = null;

      if (endConnection) {
         const size = endConnection instanceof Switch ? endConnection.size : CONFIG.GRID_SIZE;
         straightEndPoint = endPoint.sub(geometry.multiply(track.unit, size));

         if (endConnection instanceof Track) {
            const nextTrack = endConnection;
            nextUnit = nextTrack.unit;
            curveEnd = nextTrack.start.add(geometry.multiply(nextUnit, CONFIG.GRID_SIZE));
            controlPoint = geometry.getIntersectionPointX(straightEndPoint, track.unit, curveEnd, nextUnit);
         }
      } else {
         straightEndPoint = endPoint.add(geometry.multiply(track.unit, CONFIG.GRID_SIZE));
      }

      const centerLine: any = {
         track: track,
         start: startPoint,
         straightEnd: straightEndPoint,
         end: endPoint,
         unit: track.unit,
         curveEnd: curveEnd,
         controlPoint: controlPoint,
         nextUnit: nextUnit,
      };

      this.calculateRailPositions(centerLine);
      this.calculateSleeperOutline(centerLine);

      return [centerLine];
   }

   calculateSleeperOutline(centerLine: any) {
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

   calculateRailPositions(centerLine: any) {
      const railOffsetVector = geometry.perpendicular(centerLine.unit.multiply(this.rail_distance));

      centerLine.rails = {
         straight: {
            inner: {
               start: centerLine.start.add(railOffsetVector),
               end: centerLine.straightEnd.add(railOffsetVector),
            },
            outer: {
               start: centerLine.start.sub(railOffsetVector),
               end: centerLine.straightEnd.sub(railOffsetVector),
            },
         },
      };

      if (centerLine.controlPoint) {
         const nextRailOffsetVector = geometry.perpendicular(centerLine.nextUnit.multiply(this.rail_distance));

         const curveInnerEnd = centerLine.curveEnd.add(nextRailOffsetVector);
         const curveOuterEnd = centerLine.curveEnd.sub(nextRailOffsetVector);

         const curveInnerStart = centerLine.rails.straight.inner.end;
         const curveOuterStart = centerLine.rails.straight.outer.end;

         const cpInner = geometry.getIntersectionPointX(curveInnerStart, centerLine.unit, curveInnerEnd, centerLine.nextUnit);
         const cpOuter = geometry.getIntersectionPointX(curveOuterStart, centerLine.unit, curveOuterEnd, centerLine.nextUnit);

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

   renderTrack(track: any) {
      const points = this.calculateTrackPoints(track);

      const sleepers_container = new createjs.Container();
      sleepers_container.name = "track";
      sleepers_container.mouseChildren = false;
      sleepers_container.data = track;
      this._rendering.sleepers_container.addChild(sleepers_container);

      const hitArea = new createjs.Shape();
      hitArea.graphics.beginFill("#000");
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

      

      this.drawTrackSleepers(points, sleepers_container);      
      this.renderRails(track, points);
      if (track.hasBumper) this.drawBumper(track, this._rendering.rails_container);
   }

   calculateRailBounds(points: any[]) {
      let minX = Infinity,
         minY = Infinity,
         maxX = -Infinity,
         maxY = -Infinity;

      const updateBounds = (point: any) => {
         minX = Math.min(minX, point.x);
         minY = Math.min(minY, point.y);
         maxX = Math.max(maxX, point.x);
         maxY = Math.max(maxY, point.y);
      };

      for (const point of points) {
         const { inner, outer } = point.rails.straight;
         updateBounds(inner.start);
         updateBounds(inner.end);
         updateBounds(outer.start);
         updateBounds(outer.end);

         if (point.rails.curve) {
            const curve = point.rails.curve;
            updateBounds(curve.inner.start);
            updateBounds(curve.inner.end);
            updateBounds(curve.outer.start);
            updateBounds(curve.outer.end);
         }
      }

      const padding = trackRendering_textured.RAILS[0][0] * 0.5;
      return {
         x: minX - padding,
         y: minY - padding,
         width: maxX - minX + padding * 2,
         height: maxY - minY + padding * 2,
      };
   }

   renderRails(track: any, points: any[]) {
      const rail_shape = new createjs.Shape();
      rail_shape.name = "track";
      rail_shape.snapToPixel = true;
      rail_shape.data = track;
      this._rendering.rails_container.addChild(rail_shape);

      for (const point of points) {
         const { straight, curve } = point.rails;

         trackRendering_textured.RAILS.forEach((rail) => {
            rail_shape.graphics.setStrokeStyle(rail[0]).beginStroke(rail[1]);

            rail_shape.graphics
               .mt(straight.inner.start.x, straight.inner.start.y)
               .lt(straight.inner.end.x, straight.inner.end.y)
               .mt(straight.outer.start.x, straight.outer.start.y)
               .lt(straight.outer.end.x, straight.outer.end.y);

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

      const bounds = this.calculateRailBounds(points);
      rail_shape.setBounds(bounds.x, bounds.y, bounds.width, bounds.height);

      return rail_shape;
   }

   drawTrackSleepers(points: any[], container: any) {
      for (const point of points) {
         this.drawSleepers(point.track, point.start, point.straightEnd, container);

         if (point.rails.curve) {
            this.drawSleepersAlongCurve(point.straightEnd, point.curveEnd, point.controlPoint, container);
         }
      }
   }

   drawSleepersAlongCurve(startPoint: any, endPoint: any, controlPoint: any, container: any) {
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

   drawSleepers(track: any, startPoint: any, endPoint: any, container: any) {
      let x = startPoint.x;
      let y = startPoint.y;

      const l = geometry.distance(startPoint, endPoint);
      const amount = Math.floor(l / this.sleeperIntervall);

      const remainingSpace = l % this.sleeperIntervall;
      const adjustedInterval = this.sleeperIntervall + remainingSpace / amount;

      const step_x = track.cos * adjustedInterval,
         step_y = track.sin * adjustedInterval;

      x += track.cos * (this.schwellenGap / 2);
      y += track.sin * (this.schwellenGap / 2);

      for (let i = 0; i < amount; i++) {
         this.drawSleeper(i, x, y, track.deg, container);
         y += step_y;
         x += step_x;
      }
   }

   drawSleeper(i: number, x: number, y: number, angle: number, container: any, length = this.schwellenHöhe, regY?: number) {
      if (this.app.renderingManager!.stage.scale < this.LOD) {
         const ry = regY == null ? length / 2 : regY;
         const cacheKey = `shape_${length}`;
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
            this._sleeperCache[cacheKey] = sleeperShape;
         }

         let sleeper = sleeperShape.clone();
         sleeper.x = x;
         sleeper.y = y;
         sleeper.rotation = angle;
         sleeper.regY = ry;
         sleeper.regX = 0;

         container.addChild(sleeper);
      } else {
         i = i % trackRendering_textured.SCHWELLEN_VARIANTEN;
         const scaleY = length / this.schwellenHöhe;
         const ry = regY == null ? this.schwellenImg.height / 2 : regY / (trackRendering_textured.TRACK_SCALE * scaleY);

         if (!this._bitmapCache[i]) {
            const sourceRect = new createjs.Rectangle(
               (i * this.schwellenImg.width) / trackRendering_textured.SCHWELLEN_VARIANTEN,
               0,
               this.sleepersImgWidth,
               this.schwellenImg.height
            );

            const bitmap = new createjs.Bitmap(this.schwellenImg);
            bitmap.sourceRect = sourceRect;
            this._bitmapCache[i] = bitmap;
         }

         const sleeperBitmap = this._bitmapCache[i].clone();

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

   getPointOnCurve(t: number, p0: any, cp: any, p1: any) {
      const oneMinusT = 1 - t;
      const tSquared = t * t;
      const oneMinusTSquared = oneMinusT * oneMinusT;
      const twoTimesT = 2 * oneMinusT * t;

      return new Point(
         oneMinusTSquared * p0.x + twoTimesT * cp.x + tSquared * p1.x,
         oneMinusTSquared * p0.y + twoTimesT * cp.y + tSquared * p1.y
      );
   }

   getDegreeOfTangentOnCurve(t: number, p0: any, cp: any, p1: any) {
      const mt = 1 - t;
      const dx = 2 * (mt * (cp.x - p0.x) + t * (p1.x - cp.x));
      const dy = 2 * (mt * (cp.y - p0.y) + t * (p1.y - cp.y));
      return Math.atan2(dy, dx) * (180 / Math.PI);
   }

   drawBumper(track: any, track_container: any) {
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

   updateTrack(track: any) {
      const sleepersContainer = this._rendering.sleepers_container.children.find((c: any) => c.data === track);
      if (!sleepersContainer) return;

      sleepersContainer.removeAllChildren();

      const points = this.calculateTrackPoints(track);
      this.drawTrackSleepers(points, sleepersContainer);

      if (track == (track.switchAtTheEnd as any)?.t1) {
         const switchSleepersContainer = this._rendering.sleepers_container.children.find((c: any) => c.data === track.switchAtTheEnd);
         const switchRenderingParameter = this.getSwitchRenderingParameter(track.switchAtTheEnd);
         this.drawSleepersOnSwitch(track.switchAtTheEnd, switchRenderingParameter, switchSleepersContainer);
      }

      if (track == (track.switchAtTheStart as any)?.t1) {
         const switchSleepersContainer = this._rendering.sleepers_container.children.find(
            (c: any) => c.data === track.switchAtTheStart
         );
         const switchRenderingParameter = this.getSwitchRenderingParameter(track.switchAtTheStart);
         this.drawSleepersOnSwitch(track.switchAtTheStart, switchRenderingParameter, switchSleepersContainer);
      }
   }

   updateSwitch(sw: any) {
      const sleepersContainer = this._rendering.sleepers_container.children.find((c: any) => c.data === sw);
      if (!sleepersContainer) return;

      const switchRenderingParameter = this.getSwitchRenderingParameter(sw);

      this.drawSleepersOnSwitch(sw, switchRenderingParameter, sleepersContainer);
   }

   createEndpointShape(point: any, track: any, endpointType: string) {
      const RECT_SIZE = 8;
      const shape = new createjs.Shape();

      shape.name = "track_endpoint";
      (shape as any).endpoint = endpointType;
      (shape as any).track = track;

      const hitArea = new createjs.Shape();
      hitArea.graphics.beginFill("#000").drawRect(point.x - RECT_SIZE / 2, point.y - RECT_SIZE / 2, RECT_SIZE, RECT_SIZE);
      shape.hitArea = hitArea;

      shape.graphics
         .setStrokeStyle(2)
         .beginStroke("#ff0000")
         .drawRect(point.x - RECT_SIZE / 2, point.y - RECT_SIZE / 2, RECT_SIZE, RECT_SIZE);

      return shape;
   }

   drawTrackEndpoints(track: any) {
      this.app.renderingManager!.containers.selection.addChild(this.createEndpointShape(track.start, track, "start"));
      this.app.renderingManager!.containers.selection.addChild(this.createEndpointShape(track.end, track, "end"));
   }

   updateSelection() {
      this.app.renderingManager!.containers.selection.removeAllChildren();

      if (this.app.selection.type == "Track") {
         this.app.renderingManager!.containers.tracks.children[0].children.forEach((c: any) => {
            if (this.app.selection.isSelectedObject(c.data)) {
               this.visualizeTrackBounds(c);
               this.drawTrackEndpoints(c.data);
            }
         });
      } else if (this.app.selection.type == "Signal") {
         this.app.renderingManager!.containers.signals.children.forEach((c: any) => {
            if (c.data) {
               if (this.app.selection.isSelectedObject(c.data)) this.visualizeTrackBounds(c);
            }
         });
      } else if (this.app.selection.type == "GenericObject") {
         this.app.renderingManager!.containers.objects.children.forEach((c: any) => {
            if (c.data) {
               if (this.app.selection.isSelectedObject(c.data)) this.visualizeTrackBounds(c);
            }
         });
      }
      this.app.renderingManager!.update();
   }

   drawSleepersOnSwitch(sw: any, switchRenderingParameter: any, container?: any) {
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

         const length = geometry.distance(mainTrack.sleepers.inner, straightBranch.sleepers.inner);
         const length2 = geometry.distance(mainTrack.sleepers.outer, curvedBranch.sleepers.outer);

         const amount_on_straight_rail = Math.floor(length / this.sleeperIntervall);
         const amount_on_curved_rail = Math.floor(length2 / (this.sleeperIntervall * 1.15));
         const new_intervall = (this.sleeperIntervall + (length % this.sleeperIntervall) / amount_on_straight_rail) * mirrored;
         let p1, t, sleeper_length;

         if (back2front) p1 = mainTrack.sleepers.inner.sub(geometry.multiply(mainTrack.unit, this.sleeperIntervall));
         else p1 = mainTrack.sleepers.inner.add(geometry.multiply(mainTrack.unit, (this.schwellenGap / 2) * mirrored));

         const step_vector = geometry.multiply(mainTrack.unit, new_intervall);

         for (let i = 0; i < amount_on_curved_rail; i++) {
            t = i / amount_on_curved_rail + 0.4 / amount_on_curved_rail;

            sleeper_length = Math.max(
               geometry.distance(this.getPointOnCurve(t, mainTrack.sleepers.outer, cp!, curvedBranch.sleepers.outer), p1),
               this.schwellenHöhe
            );

            this.drawSleeper(i, p1.x, p1.y, deg, container, -sleeper_length * flipped, 0);
            p1 = p1.add(step_vector);
         }

         for (let i = amount_on_curved_rail; i < amount_on_straight_rail; i++) {
            t = (this.sleeperIntervall * i) / length2;
            sleeper_length = Math.max(
               geometry.distance(
                  geometry.getIntersectionPointX(
                     curvedBranch.sleepers.outer,
                     geometry.perpendicular(curvedBranch.unit),
                     p1,
                     geometry.perpendicular(mainTrack.unit)
                  )!,
                  p1
               ),
               this.schwellenHöhe
            );

            this.drawSleeper(i, p1.x, p1.y, deg, container, -sleeper_length * flipped, 0);
            p1 = p1.add(step_vector);
         }
      } else {
         let centerPoint = straightBranch.position.add(mainTrack.unit.multiply(this.sleeperIntervall / 4));
         const step_vector = mainTrack.unit.multiply(this.sleeperIntervall);

         const pattern = trackRendering_textured.FOUR_WAY_SLEEPER_PATTERN;
         let reversed_pattern;
         if(pattern.length % 2 == 0) {
            reversed_pattern = pattern.slice().reverse();
         } else {
            reversed_pattern = pattern.slice(0, -1).reverse();
         }
         const point_symmetric_pattern = reversed_pattern.map((p: any) => ({ offset: 2 * p.length - p.offset, length: p.length }));
         const fullPattern = [...pattern, ...point_symmetric_pattern];

         fullPattern.forEach((data: any, i: number) => {
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

   renderSwitch(sw: any, _force?: boolean) {
      const switchRenderingParameter = this.getSwitchRenderingParameter(sw);

      const shape = new createjs.Shape();
      shape.data = sw;
      shape.snapToPixel = true;
      this._rendering.rails_container.addChild(shape);

      if (switchRenderingParameter.curvedBranch2 == null) {
         this.renderThreeWaySwitch(shape, switchRenderingParameter);
      } else {
         this.renderFourWaySwitch(shape, switchRenderingParameter);
      }

      this.drawSleepersOnSwitch(sw, switchRenderingParameter);
      this.renderSwitchUI(sw);
   }

   getSwitchRenderingParameter(sw: any) {
      const flipped = NumberUtils.is(sw.type, Switch.SWITCH_TYPE.FROM_RIGHT, Switch.SWITCH_TYPE.TO_RIGHT) ? -1 : 1;
      const mirrored = NumberUtils.is(sw.type, Switch.SWITCH_TYPE.FROM_LEFT, Switch.SWITCH_TYPE.FROM_RIGHT) ? -1 : 1;

      const calcTrackData = (index: number) => {
         let track = sw.tracks[index];
         let unit = sw.track_directions[index];
         if (!unit) {
            console.warn("Switch track_directions not calculated, calculating on the fly.");
            sw.calculateParameters();
            unit = sw.track_directions[index];
         }

         const railOffset = geometry.perpendicular(track.unit.multiply(this.rail_distance * flipped));
         const sleeperOffset = geometry.perpendicular(track.unit.multiply(this.schwellenHöhe_2 * flipped));
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

   renderThreeWaySwitch(shape: any, switchRenderingParameter: any) {
      const g = shape.graphics;
      const { mainTrack, straightBranch, curvedBranch, flipped, mirrored } = switchRenderingParameter;

      const intersections: any = {
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

      intersections.innerCurve = geometry.getIntersectionPointX(
         mainTrack.rails.inner,
         mainTrack.unit,
         intersections.frog,
         curvedBranch.unit
      );

      const frogOffset = -trackRendering_textured.RAILS[0][0] * mirrored;
      const guardRailLength = 10 * mirrored;
      const frogPoints: any = {
         curveEnd: Point.fromPoint(intersections.frog).add(curvedBranch.unit.multiply(frogOffset)),
         straightStart: Point.fromPoint(intersections.frog).add(straightBranch.unit.multiply(frogOffset)),
      };

      frogPoints.straightEnd = frogPoints.curveEnd.add(straightBranch.unit.multiply(guardRailLength));
      frogPoints.curveStart = frogPoints.straightStart.add(curvedBranch.unit.multiply(guardRailLength));

      for (const rail of trackRendering_textured.RAILS) {
         g.setStrokeStyle(rail[0]).beginStroke(rail[1]);

         g.mt(mainTrack.rails.outer.x, mainTrack.rails.outer.y).quadraticCurveTo(
            intersections.outerCurve.x,
            intersections.outerCurve.y,
            curvedBranch.rails.outer.x,
            curvedBranch.rails.outer.y
         );

         g.mt(mainTrack.rails.inner.x, mainTrack.rails.inner.y)
            .quadraticCurveTo(
               intersections.innerCurve.x - flipped,
               intersections.innerCurve.y - flipped,
               frogPoints.curveEnd.x,
               frogPoints.curveEnd.y
            )
            .lt(frogPoints.straightEnd.x, frogPoints.straightEnd.y);

         g.mt(straightBranch.rails.outer.x, straightBranch.rails.outer.y)
            .lt(intersections.frog.x, intersections.frog.y)
            .lt(curvedBranch.rails.inner.x, curvedBranch.rails.inner.y);

         g.mt(mainTrack.rails.inner.x, mainTrack.rails.inner.y).lt(straightBranch.rails.inner.x, straightBranch.rails.inner.y);

         g.mt(frogPoints.curveStart.x, frogPoints.curveStart.y)
            .lt(frogPoints.straightStart.x, frogPoints.straightStart.y)
            .lt(mainTrack.rails.outer.x, mainTrack.rails.outer.y + 2 * flipped);

         g.endStroke();
      }
   }

   renderFourWaySwitch(shape: any, switchRenderingParameter: any) {
      const { mainTrack, straightBranch, curvedBranch, curvedBranch2 } = switchRenderingParameter;

      const drawRail = (graphics: any, startTrack: any, endTrack: any, railSide: "inner" | "outer") => {
         const startPoint = startTrack.rails[railSide];
         const endPoint = endTrack.rails[railSide];

         const cp1 = geometry.add(startPoint, geometry.multiply(startTrack.unit, trackRendering_textured.CURVATURE_4WAY_SWITCH));
         const cp2 = geometry.add(endPoint, geometry.multiply(endTrack.unit, -trackRendering_textured.CURVATURE_4WAY_SWITCH));

         graphics.mt(startPoint.x, startPoint.y).bezierCurveTo(cp1.x, cp1.y, cp2.x, cp2.y, endPoint.x, endPoint.y);
      };

      const g = shape.graphics;

      for (const rail of trackRendering_textured.RAILS) {
         g.setStrokeStyle(rail[0]).beginStroke(rail[1]);

         drawRail(g, straightBranch, curvedBranch2, "outer");
         drawRail(g, curvedBranch, mainTrack, "inner");
         drawRail(g, straightBranch, curvedBranch2, "inner");
         drawRail(g, curvedBranch, mainTrack, "outer");

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

   renderSwitchUI(sw: any) {
      const drawArrow = (graphics: any, length: number, size: number) => {
         graphics
            .mt(0, 0)
            .lt(length, 0)
            .mt(length - size, -size / 2)
            .lt(length, 0)
            .lt(length - size, size / 2);
      };

      let container =  this.app.renderingManager!.containers.ui.children.find((c: any) => c.data === sw);

      if (container) {
         container.removeAllChildren();
      } else {
         container = new createjs.Container();
         container.mouseChildren = false;
         container.name = "switch";
         container.data = sw;
         this.app.renderingManager!.containers.ui.addChild(container);
      }

      [sw.from, sw.branch].forEach((t: any) => {
         const arrow = new createjs.Shape();
         container.addChild(arrow);

         arrow.graphics.setStrokeStyle(trackRendering_textured.SWITCH_UI_STROKE, "round").beginStroke("#333");
         drawArrow(arrow.graphics, 20, 5);
         arrow.x = sw.location.x;
         arrow.y = sw.location.y;
         arrow.rotation = Switch.findAngle(sw.location, t.end.equals(sw.location) ? t.start : t.end);
      });
   }

   PointVisible(p1: any) {
      if (this._rendering?.dont_optimize) return true;
      const screen_rectangle = this._rendering.screen_rectangle;

      return (
         NumberUtils.between(p1.x, screen_rectangle.left, screen_rectangle.right) &&
         NumberUtils.between(p1.y, screen_rectangle.top, screen_rectangle.bottom)
      );
   }

   TrackVisible(track: any, screen_rectangle = this._rendering.screen_rectangle) {
      if (this._rendering?.dont_optimize) return true;

      const isInside = (point: any, rect: any) =>
         point.x > rect.left && point.x < rect.right && point.y > rect.top && point.y < rect.bottom;

      if (isInside(track.start, screen_rectangle) || isInside(track.end, screen_rectangle)) return true;

      let p1 = { x: screen_rectangle.left, y: screen_rectangle.top },
         p2 = { x: screen_rectangle.left, y: screen_rectangle.bottom };
      if (geometry.doLineSegmentsIntersect(p1, p2, track.start, track.end)) return true;
      p1 = p2;
      p2 = { x: screen_rectangle.right, y: screen_rectangle.bottom };
      if (geometry.doLineSegmentsIntersect(p1, p2, track.start, track.end)) return true;
      p1 = p2;
      p2 = { x: screen_rectangle.right, y: screen_rectangle.top };
      if (geometry.doLineSegmentsIntersect(p1, p2, track.start, track.end)) return true;

      return false;
   }

   SwitchVisible(sw: any) {
      if (this._rendering?.dont_optimize) return true;
      const screen_rectangle = this._rendering.screen_rectangle;

      if (this.PointVisible(sw.location)) return true;

      const tracks = [sw.track1, sw.track2, sw.track3, sw.track4].filter((t: any) => t);
      return tracks.some((track: any) => this.TrackVisible(track, screen_rectangle));
   }

   visualizeTrackBounds(container: any) {
      const bounds = container.getTransformedBounds();
      const object = container.data;

      if (bounds == null) throw new Error("Bounds are null");

      const padding = 5;
      bounds.x -= padding;
      bounds.y -= padding;
      bounds.width += padding * 2;
      bounds.height += padding * 2;

      const boundsShape = new createjs.Shape();
      boundsShape.name = "selection";
      boundsShape.mouseEnabled = false;
      boundsShape.data = object;

      boundsShape.graphics
         .setStrokeStyle(2)
         .setStrokeDash([5, 5])
         .beginStroke("rgba(0, 0, 0, 0.7)")
         .drawRect(bounds.x, bounds.y, bounds.width, bounds.height)
         .endStroke();

      this.app.renderingManager!.containers.selection.addChild(boundsShape);
   }
}


