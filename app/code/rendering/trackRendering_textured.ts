"use strict";

// ES6 Module imports
import { Track } from "../track.ts";
import { Switch } from "../switch.ts";
import { Signal } from "../signal.ts";
import { SignalRenderer } from "./signalRenderer.ts";
import { GenericObject } from "../generic_object.ts";
import { geometry, Point } from "../tools.ts";
import { NumberUtils } from "../utils.ts";
import { ui } from "../ui.ts";
import { CONFIG } from "../config.ts";
import { Application } from "../application.ts";
import { Rectangle, Sprite, Text } from "pixi.js";
import type { Graphics } from "pixi.js";
import { gleisGraphics, imageSize, polygonHitArea, textureRegion, TrackGraphics } from "../pixiPrimitives.ts";
import { createLayerContainer } from "../pixiUtils.ts";
import { TrackRenderingBase } from "./TrackRenderingBase.ts";

export class trackRendering_textured extends TrackRenderingBase {
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
   main_x1: number = 0;

   constructor() {
      super();
      //cause the class is been loaded before start.js, we have to hack and calculate this constant here
      trackRendering_textured.CURVE_RADIUS = CONFIG.GRID_SIZE * 1.21;      
      this.LOD = 5;
      this._lastRenderScale = 0; //used to check if the LOD has changed since the last rendering

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
            const rm = this.app.renderingManager!;
            toBeRemoved.forEach((track) => {
               // Remove associated signals
               const signalsToBeRemoved = rm.containers.signals.children.filter((cs: any) => {
                  const sig = rm.getGameObjFromDisplayObj(cs) as any;
                  return sig?._positioning?.track === track;
               });
               signalsToBeRemoved.forEach((cs: any) => {
                  rm.containers.signals.removeChild(cs);
               });
               // Remove track from rendered set
               rm.containers.tracks.renderedTracks.delete(track);

               // Remove track elements from both containers
               const sleepersToRemove = rm.containers.tracks.children[0].children.filter((c: any) => rm.getGameObjFromDisplayObj(c) === track);
               const railsToRemove = rm.containers.tracks.children[1].children.filter((c: any) => rm.getGameObjFromDisplayObj(c) === track);

               sleepersToRemove.forEach((c: any) => {
                  rm.containers.tracks.children[0].removeChild(c);
               });

               railsToRemove.forEach((c: any) => {
                  rm.containers.tracks.children[1].removeChild(c);
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
      const vp = this.app.renderingManager!.viewport;
      const canvas = this.app.renderingManager!.canvas;
      const width = (canvas.width + CONFIG.GRID_SIZE * 2) / vp.scale.x,
         height = (canvas.height + CONFIG.GRID_SIZE * 2) / vp.scale.y,
         x = (-vp.x - CONFIG.GRID_SIZE) / vp.scale.x,
         y = (-vp.y - CONFIG.GRID_SIZE) / vp.scale.y;
      return { left: x, top: y, right: x + width, bottom: y + height };
   }

   reDrawEverything(force = false, render_outside_viewport = false) {
      if (!Application.getInstance().preLoader!.loaded) //on slow internet connections, the preLoader may not be loaded yet
         setTimeout(() => {
            this.reDrawEverything(force, render_outside_viewport);
         }, 500);
      else {
         if (this._rendering == undefined) { //prevent multiple rendering calls
            try {
               this._rendering = { render_outside_viewport: render_outside_viewport };
               this._rendering.screen_rectangle = this.calcCanvasSize();

               if (force) {
                  this.app.renderingManager!.containers.removeAllChildren();
                  this.calcRenderValues();
               } else {
                  if (NumberUtils.between(this.LOD, this._lastRenderScale, this.app.renderingManager!.viewport.scale.x)) {
                     this._rendering.lodChanged = true;
                  }
               }

               try {
                  this.renderAllTracks(force);
                  this.renderAllSignals(force);
                  this.renderAllTrains();
                  this.renderAllGenericObjects();
                  this._lastRenderScale = this.app.renderingManager!.viewport.scale.x;
                  if (!render_outside_viewport) this.cleanUp();
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

      this.main_x1 = (Math.sin(Math.PI / 8) * trackRendering_textured.CURVE_RADIUS) / Math.cos(Math.PI / 8);

      this.SIGNAL_DISTANCE_FROM_TRACK = this.schwellenHöhe / 2;
   }

   protected trainCarHeight(): number {
      return this.TRAIN_HEIGHT;
   }

   renderAllGenericObjects() {
      this.app.renderingManager!.containers.objects.removeChildren();
      GenericObject.all_objects.forEach((o: any) => {
         const c = createLayerContainer("GenericObject");
         this.app.renderingManager!.bindGameObjToDisplayObj(c, o);
         c.interactiveChildren = false;
         c.x = o.pos().x;
         c.y = o.pos().y;

         if (o.type() === GenericObject.OBJECT_TYPE.text) this.renderTextObject(o, c);
         else if (o.type() === GenericObject.OBJECT_TYPE.plattform) this.renderPlattformObject(o, c);
         else throw new Error("Unknown Object");

         this.app.renderingManager!.containers.objects.addChild(c);
      });
   }

   renderTextObject(text_object: any, container: any) {
      var text = new Text({
         text: text_object.content(),
         style: { fill: "#000000", fontFamily: "Arial", fontSize: 24 },
      });
      text.eventMode = "static";
      const height = text.height;
      const width = text.width;

      text.hitArea = polygonHitArea([{ x: 0, y: 0 }, { x: width, y: 0 }, { x: width, y: -height }, { x: 0, y: -height }]);

      container.addChild(text);
   }

   renderPlattformObject(plattform: any, container: any) {
      const shape = new TrackGraphics();
      container.addChild(shape);
      const size = plattform.size();
      shape.rect(0, 0, size.width, size.height).fill("#444").stroke({ width: 1, color: "#111111", cap: "round", join: "round" });
      shape.setBounds(0, 0, size.width, size.height);

      var text = new Text({
         text: plattform.content(),
         style: { fill: "#eee", fontFamily: "Arial", fontSize: 16 },
      });
      text.eventMode = "static";
      text.anchor.set(0.5);
      text.x = plattform.size().width / 2;
      text.y = plattform.size().height / 2;

      container.addChild(text);
   }

   renderAllSignals(_force?: boolean) {
      const rm = this.app.renderingManager!;
      rm.containers.signals.removeChildren();
      Signal.allSignals.forEach((signal: any) => {
         let container = rm.containers.signals.addChild(SignalRenderer.createSignalContainer(rm, signal));
         this.app.alignSignalContainerWithTrack(container, signal._positioning);
      });
   }

   renderAllTracks(force?: boolean) {
      const containers = this.app.renderingManager!.containers;
      if (force) {         
         containers.tracks.addChild(this._rendering.sleepers_container = createLayerContainer("global_sleepers"));
         containers.tracks.addChild(this._rendering.rails_container = createLayerContainer("global_rails"));
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

      const sleepers_container = createLayerContainer("track");
      this.app.renderingManager!.bindGameObjToDisplayObj(sleepers_container, track);
      sleepers_container.interactiveChildren = false;
      this._rendering.sleepers_container.addChild(sleepers_container);

      const hitPoints: any[] = [];
      for (const p of points) {
         const straight = p.sleeperOutline.straight;
         hitPoints.push(straight.outer.start, straight.outer.end, straight.inner.end, straight.inner.start);

         if (p.sleeperOutline.curve) {
            const curve = p.sleeperOutline.curve;
            hitPoints.push(curve.inner.start, curve.inner.end, curve.outer.end, curve.outer.start);
         }
      }
      sleepers_container.hitArea = polygonHitArea(hitPoints);

      

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
      const rail_shape = new TrackGraphics("track");
      this.app.renderingManager!.bindGameObjToDisplayObj(rail_shape, track);
      this._rendering.rails_container.addChild(rail_shape);

      for (const point of points) {
         const { straight, curve } = point.rails;

         trackRendering_textured.RAILS.forEach((rail) => {
            const st = {
               width: rail[0],
               color: rail[1],
               cap: "round" as const,
               join: "round" as const,
            };

            rail_shape
               .moveTo(straight.inner.start.x, straight.inner.start.y)
               .lineTo(straight.inner.end.x, straight.inner.end.y)
               .stroke(st);
            rail_shape
               .moveTo(straight.outer.start.x, straight.outer.start.y)
               .lineTo(straight.outer.end.x, straight.outer.end.y)
               .stroke(st);

            if (curve) {
               rail_shape
                  .moveTo(curve.outer.start.x, curve.outer.start.y)
                  .quadraticCurveTo(curve.outer.cp.x, curve.outer.cp.y, curve.outer.end.x, curve.outer.end.y)
                  .stroke(st);
               rail_shape
                  .moveTo(curve.inner.start.x, curve.inner.start.y)
                  .quadraticCurveTo(curve.inner.cp.x, curve.inner.cp.y, curve.inner.end.x, curve.inner.end.y)
                  .stroke(st);
            }
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
      if (this.app.renderingManager!.viewport.scale.x < this.LOD) {
         const yStart = Math.min(0, length);
         const drawLength = Math.abs(length);
         const ry = regY == null ? length / 2 : regY;
         const cacheKey = `shape_${length}`;
         let sleeperShape = this._sleeperCache[cacheKey];
         if (!sleeperShape) {
            sleeperShape = new TrackGraphics();
            const sleeperStroke = { width: 0.2, color: "black", cap: "round" as const, join: "round" as const };
            sleeperShape
               .rect(0, yStart, this.schwellenBreite, drawLength)
               .fill("#99735b")
               .stroke(sleeperStroke);
            sleeperShape.setBounds(0, yStart, this.schwellenBreite, drawLength);
            this._sleeperCache[cacheKey] = sleeperShape;
         }

         let sleeper = gleisGraphics();
         sleeper
            .rect(0, yStart, this.schwellenBreite, drawLength)
            .fill("#99735b")
            .stroke({ width: 0.2, color: "black", cap: "round", join: "round" });
         sleeper.x = x;
         sleeper.y = y;
         sleeper.angle = angle;
         sleeper.pivot.set(0, ry);

         container.addChild(sleeper);
      } else {
         i = i % trackRendering_textured.SCHWELLEN_VARIANTEN;
         const scaleY = length / this.schwellenHöhe;
         const ry = regY == null ? this.schwellenImg.height / 2 : regY / (trackRendering_textured.TRACK_SCALE * scaleY);

         if (!this._bitmapCache[i]) {
            const sourceRect = new Rectangle(
               (i * this.schwellenImg.width) / trackRendering_textured.SCHWELLEN_VARIANTEN,
               0,
               this.sleepersImgWidth,
               this.schwellenImg.height
            );

            const bitmap = new Sprite(textureRegion(this.schwellenImg, sourceRect));
            bitmap.eventMode = "static";
            this._bitmapCache[i] = bitmap;
         }

         const sleeperBitmap = new Sprite(this._bitmapCache[i].texture);
         sleeperBitmap.eventMode = "static";

         sleeperBitmap.x = x;
         sleeperBitmap.y = y;
         sleeperBitmap.pivot.set(0, ry);
         sleeperBitmap.scale.set(trackRendering_textured.TRACK_SCALE, trackRendering_textured.TRACK_SCALE * scaleY);
         sleeperBitmap.angle = angle;

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
         const bumperEnd = new Sprite(this.bumperImg);
         bumperEnd.eventMode = "static";
         bumperEnd.x = track.end.x;
         bumperEnd.y = track.end.y;
         bumperEnd.scale.set(-trackRendering_textured.TRACK_SCALE, trackRendering_textured.TRACK_SCALE);
         bumperEnd.angle = track.deg;
         bumperEnd.pivot.set(imageSize(this.bumperImg).width, imageSize(this.bumperImg).height / 2);
         track_container.addChild(bumperEnd);
      }

      if (track.switchAtTheStart == null) {
         const bumperStart = new Sprite(this.bumperImg);
         bumperStart.eventMode = "static";
         bumperStart.x = track.start.x;
         bumperStart.y = track.start.y;
         bumperStart.scale.set(trackRendering_textured.TRACK_SCALE);
         bumperStart.angle = track.deg;
         bumperStart.pivot.set(imageSize(this.bumperImg).width, imageSize(this.bumperImg).height / 2);
         track_container.addChild(bumperStart);
      }
   }

   updateTrack(track: any) {
      const rmUp = this.app.renderingManager!;
      const sleepersContainer = this._rendering.sleepers_container.children.find((c: any) => rmUp.getGameObjFromDisplayObj(c) === track);
      if (!sleepersContainer) return;

      sleepersContainer.removeChildren();

      const points = this.calculateTrackPoints(track);
      this.drawTrackSleepers(points, sleepersContainer);

      if (track == (track.switchAtTheEnd as any)?.t1) {
         const switchSleepersContainer = this._rendering.sleepers_container.children.find(
            (c: any) => rmUp.getGameObjFromDisplayObj(c) === track.switchAtTheEnd
         );
         const switchRenderingParameter = this.getSwitchRenderingParameter(track.switchAtTheEnd);
         this.drawSleepersOnSwitch(track.switchAtTheEnd, switchRenderingParameter, switchSleepersContainer);
      }

      if (track == (track.switchAtTheStart as any)?.t1) {
         const switchSleepersContainer = this._rendering.sleepers_container.children.find(
            (c: any) => rmUp.getGameObjFromDisplayObj(c) === track.switchAtTheStart
         );
         const switchRenderingParameter = this.getSwitchRenderingParameter(track.switchAtTheStart);
         this.drawSleepersOnSwitch(track.switchAtTheStart, switchRenderingParameter, switchSleepersContainer);
      }
   }

   updateSwitch(sw: any) {
      const rmSw = this.app.renderingManager!;
      const sleepersContainer = this._rendering.sleepers_container.children.find((c: any) => rmSw.getGameObjFromDisplayObj(c) === sw);
      if (!sleepersContainer) return;

      const switchRenderingParameter = this.getSwitchRenderingParameter(sw);

      this.drawSleepersOnSwitch(sw, switchRenderingParameter, sleepersContainer);
   }

   drawSleepersOnSwitch(sw: any, switchRenderingParameter: any, container?: any) {
      const { mainTrack, straightBranch, curvedBranch, curvedBranch2, flipped, mirrored } = switchRenderingParameter;

      if (container == null) {
         container = createLayerContainer("switch_sleepers");
         this.app.renderingManager!.bindGameObjToDisplayObj(container, sw);
         container.interactiveChildren = false;
         this._rendering.sleepers_container.addChild(container);
      } else {
         container.removeChildren();
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

      const shape = new TrackGraphics("switch");
      this.app.renderingManager!.bindGameObjToDisplayObj(shape, sw);
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

   renderThreeWaySwitch(shape: TrackGraphics, switchRenderingParameter: any) {
      const g = shape;
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
         const st = {
            width: rail[0],
            color: rail[1],
            cap: "round" as const,
            join: "round" as const,
         };

         g.moveTo(mainTrack.rails.outer.x, mainTrack.rails.outer.y).quadraticCurveTo(
            intersections.outerCurve.x,
            intersections.outerCurve.y,
            curvedBranch.rails.outer.x,
            curvedBranch.rails.outer.y
         ).stroke(st);

         g.moveTo(mainTrack.rails.inner.x, mainTrack.rails.inner.y)
            .quadraticCurveTo(
               intersections.innerCurve.x - flipped,
               intersections.innerCurve.y - flipped,
               frogPoints.curveEnd.x,
               frogPoints.curveEnd.y
            )
            .lineTo(frogPoints.straightEnd.x, frogPoints.straightEnd.y)
            .stroke(st);

         g.moveTo(straightBranch.rails.outer.x, straightBranch.rails.outer.y)
            .lineTo(intersections.frog.x, intersections.frog.y)
            .lineTo(curvedBranch.rails.inner.x, curvedBranch.rails.inner.y)
            .stroke(st);

         g.moveTo(mainTrack.rails.inner.x, mainTrack.rails.inner.y)
            .lineTo(straightBranch.rails.inner.x, straightBranch.rails.inner.y)
            .stroke(st);

         g.moveTo(frogPoints.curveStart.x, frogPoints.curveStart.y)
            .lineTo(frogPoints.straightStart.x, frogPoints.straightStart.y)
            .lineTo(mainTrack.rails.outer.x, mainTrack.rails.outer.y + 2 * flipped)
            .stroke(st);
      }
   }

   renderFourWaySwitch(shape: TrackGraphics, switchRenderingParameter: any) {
      const { mainTrack, straightBranch, curvedBranch, curvedBranch2 } = switchRenderingParameter;

      const drawRail = (
         graphics: Graphics,
         startTrack: any,
         endTrack: any,
         railSide: "inner" | "outer",
         st: { width: number; color: string; cap: "round"; join: "round" }
      ) => {
         const startPoint = startTrack.rails[railSide];
         const endPoint = endTrack.rails[railSide];

         const cp1 = geometry.add(startPoint, geometry.multiply(startTrack.unit, trackRendering_textured.CURVATURE_4WAY_SWITCH));
         const cp2 = geometry.add(endPoint, geometry.multiply(endTrack.unit, -trackRendering_textured.CURVATURE_4WAY_SWITCH));

         graphics
            .moveTo(startPoint.x, startPoint.y)
            .bezierCurveTo(cp1.x, cp1.y, cp2.x, cp2.y, endPoint.x, endPoint.y)
            .stroke(st);
      };

      const g = shape;

      for (const rail of trackRendering_textured.RAILS) {
         const st = {
            width: rail[0],
            color: rail[1],
            cap: "round" as const,
            join: "round" as const,
         };

         drawRail(g, straightBranch, curvedBranch2, "outer", st);
         drawRail(g, curvedBranch, mainTrack, "inner", st);
         drawRail(g, straightBranch, curvedBranch2, "inner", st);
         drawRail(g, curvedBranch, mainTrack, "outer", st);

         g.moveTo(mainTrack.rails.inner.x, mainTrack.rails.inner.y)
            .lineTo(straightBranch.rails.inner.x, straightBranch.rails.inner.y)
            .stroke(st);

         g.moveTo(mainTrack.rails.outer.x, mainTrack.rails.outer.y)
            .lineTo(straightBranch.rails.outer.x, straightBranch.rails.outer.y)
            .stroke(st);

         g.moveTo(curvedBranch.rails.inner.x, curvedBranch.rails.inner.y)
            .lineTo(curvedBranch2.rails.inner.x, curvedBranch2.rails.inner.y)
            .stroke(st);

         g.moveTo(curvedBranch.rails.outer.x, curvedBranch.rails.outer.y)
            .lineTo(curvedBranch2.rails.outer.x, curvedBranch2.rails.outer.y)
            .stroke(st);
      }
   }

   renderSwitchUI(sw: Switch) {
      const arrowStroke = {
         width: trackRendering_textured.SWITCH_UI_STROKE,
         color: "#333",
         cap: "round" as const,
         join: "round" as const,
      };

      const drawArrow = (g: Graphics, length: number, size: number) => {
         g.moveTo(0, 0).lineTo(length, 0).stroke(arrowStroke);
         g.moveTo(length - size, -size / 2).lineTo(length, 0).lineTo(length - size, size / 2).stroke(arrowStroke);
      };

      const rmUi = this.app.renderingManager!;
      let container = rmUi.containers.ui.children.find((c: any) => rmUi.getGameObjFromDisplayObj(c) === sw);

      if (container) {
         container.removeChildren();
      } else {
         container = createLayerContainer("switch");
         rmUi.bindGameObjToDisplayObj(container, sw);
         container.interactiveChildren = false;
         rmUi.containers.ui.addChild(container);
      }

      [sw.from, sw.branch].forEach((t: any) => {
         const arrow = gleisGraphics();
         container.addChild(arrow);

         drawArrow(arrow, 20, 5);
         arrow.x = sw.location.x;
         arrow.y = sw.location.y;
         arrow.angle = Switch.findAngle(sw.location, t.end.equals(sw.location) ? t.start : t.end);
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
      if (this._rendering?.render_outside_viewport) return true;

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
      if (this._rendering?.render_outside_viewport) return true;
      const screen_rectangle = this._rendering.screen_rectangle;

      if (this.PointVisible(sw.location)) return true;

      const tracks = [sw.track1, sw.track2, sw.track3, sw.track4].filter((t: any) => t);
      return tracks.some((track: any) => this.TrackVisible(track, screen_rectangle));
   }
}


