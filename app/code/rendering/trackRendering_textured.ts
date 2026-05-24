"use strict";

// ES6 Module imports
import { Track } from "../track.ts";
import { Switch } from "../switch.ts";
import { Signal } from "../signal.ts";
import { SignalRenderer } from "./signalRenderer.ts";
import { GenericObject } from "../generic_object.ts";
import { geometry, Point, V2 } from "../tools.ts";
import { NumberUtils } from "../utils.ts";
import { ui } from "../ui.ts";
import { CONFIG } from "../config.ts";
import { Application } from "../application.ts";
import { Rectangle, Sprite, Text } from "pixi.js";
import type { Graphics } from "pixi.js";
import { gleisGraphics, imageSize, polygonHitArea, textureRegion, TrackGraphics } from "../pixiPrimitives.ts";
import { createLayerContainer } from "../pixiUtils.ts";
import { TrackRenderingBase } from "./TrackRenderingBase.ts";
import type { LineCap, LineJoin } from "pixi.js";

export class trackRendering_textured extends TrackRenderingBase {
   static SWITCH_UI_STROKE = 3;
   static TRACK_SCALE = 0.25;
   static SCHWELLEN_VARIANTEN = 24;
   static SWITCH_WING_RAIL_LENGTH = 10;
   static SWITCH_WING_RAIL_THICKNESS = 3.5;
   static RAILS: [number, string][] = [
      [3.2, "#222"],
      [2.8, "#999"],
      [1.4, "#eee"],
   ];

   /** Set true to draw switchRenderingValues points on the debug layer. */
   static DEBUG_VISUALIZE_SWITCH_PARAMS = false;

   LOD: number;
   _lastRenderScale: number;
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

   constructor() {
      super();
      this.LOD = 5;
      this._lastRenderScale = 0; //used to check if the LOD has changed since the last rendering
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
                  this.renderAllSignals();
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

   renderAllSignals() {
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

      const { skipFirst, skipLast } = this.getSwitchSleeperSkipFlags(track);
      this.drawTrackSleepers(points, sleepers_container, skipFirst, skipLast);
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
               cap: "butt" as const,
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
   }

   getSwitchSleeperSkipFlags(track: any): { skipFirst: boolean; skipLast: boolean } {
      let skipFirst = false;
      let skipLast = false;

      const startSw = track.switchAtTheStart;
      if (startSw instanceof Switch && (track === startSw.track2 || track === startSw.track3 || track === startSw.track4)) {
         skipFirst = true;
      }

      const endSw = track.switchAtTheEnd;
      if (endSw instanceof Switch && (track === endSw.track2 || track === endSw.track3 || track === endSw.track4)) {
         skipLast = true;
      }

      return { skipFirst, skipLast };
   }

   drawTrackSleepers(points: any[], container: any, skipFirst = false, skipLast = false) {
      for (let pi = 0; pi < points.length; pi++) {
         const point = points[pi];
         const isFirst = pi === 0;
         const isLast = pi === points.length - 1;

         this.drawSleepersAlongStraight(
            point.track,
            point.start,
            point.straightEnd,
            container,
            isFirst && skipFirst,
            isLast && skipLast && !point.rails.curve
         );

         if (point.rails.curve) {
            this.drawSleepersAlongCurve(
               point.straightEnd,
               point.curveEnd,
               point.controlPoint,
               container,
               false,
               isLast && skipLast
            );
         }
      }
   }

   drawSleepersAlongCurve(
      startPoint: any,
      endPoint: any,
      controlPoint: any,
      container: any,
      skipFirst = false,
      skipLast = false
   ) {
      const steps = Math.floor((geometry.distance(startPoint, endPoint) * 1.11) / this.sleeperIntervall);
      const step = 1 / steps;
      let t = 0.25 / steps,
         point,
         angle;

      for (let i = 0; i < steps; i++) {
         if ((skipFirst && i === 0) || (skipLast && i === steps - 1)) {
            t += step;
            continue;
         }

         point = geometry.getPointOnCurve(t, startPoint, controlPoint, endPoint);
         angle = geometry.getDegreeOfTangentOnCurve(t, startPoint, controlPoint, endPoint);

         this.drawSleeper(i, point.x, point.y, angle, container);
         t += step;
      }
   }

   drawSleepersAlongStraight(track: any, startPoint: any, endPoint: any, container: any, skipFirst = false, skipLast = false) {
      let x = startPoint.x;
      let y = startPoint.y;

      const l = geometry.distance(startPoint, endPoint);
      const amount = Math.floor(l / this.sleeperIntervall);

      const remainingSpace = l % this.sleeperIntervall;
      const adjustedInterval = this.sleeperIntervall + remainingSpace / amount;

      const step_x = track.cos * adjustedInterval,
         step_y = track.sin * adjustedInterval;

      x += track.cos * (this.schwellenGap / 2) + track.cos * (this.schwellenBreite / 2);
      y += track.sin * (this.schwellenGap / 2) + track.sin * (this.schwellenBreite / 2)

      for (let i = 0; i < amount; i++) {
         if (!(skipFirst && i === 0) && !(skipLast && i === amount - 1)) {
            this.drawSleeper(i, x, y, track.deg, container);
         }
         y += step_y;
         x += step_x;
      }
   }

   drawSleeper(i: number, x: number, y: number, angle: number, container: any, length = this.schwellenHöhe) {
      if (this.app.renderingManager!.viewport.scale.x < this.LOD) {
         const yStart = Math.min(0, length);
         const drawLength = Math.abs(length);
         const ry = length / 2;

         let sleeper = gleisGraphics();
         sleeper
            .rect(0, yStart, this.schwellenBreite, drawLength)
            .fill("#99735b")
            .stroke({ width: 0.2, color: "black", cap: "round", join: "round" });
         sleeper.x = x;
         sleeper.y = y;
         sleeper.angle = angle;
         sleeper.pivot.set(this.schwellenBreite / 2, ry);

         container.addChild(sleeper);
      } else {
         i = i % trackRendering_textured.SCHWELLEN_VARIANTEN;
         const scaleY = length / this.schwellenHöhe;
         const ry = this.schwellenImg.height / 2;

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
         sleeperBitmap.pivot.set(this.sleepersImgWidth / 2, ry);
         sleeperBitmap.scale.set(trackRendering_textured.TRACK_SCALE, trackRendering_textured.TRACK_SCALE * scaleY);
         sleeperBitmap.angle = angle;

         container.addChild(sleeperBitmap);
      }
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
      const { skipFirst, skipLast } = this.getSwitchSleeperSkipFlags(track);
      this.drawTrackSleepers(points, sleepersContainer, skipFirst, skipLast);

      if (track == (track.switchAtTheEnd as any)?.t1) {
         const switchSleepersContainer = this._rendering.sleepers_container.children.find(
            (c: any) => rmUp.getGameObjFromDisplayObj(c) === track.switchAtTheEnd
         );
         const switchRenderingValues = this.getSwitchRenderingValues(track.switchAtTheEnd);
         this.drawSleepersOnSwitch(track.switchAtTheEnd, switchRenderingValues, switchSleepersContainer);
      }

      if (track == (track.switchAtTheStart as any)?.t1) {
         const switchSleepersContainer = this._rendering.sleepers_container.children.find(
            (c: any) => rmUp.getGameObjFromDisplayObj(c) === track.switchAtTheStart
         );
         const switchRenderingValues = this.getSwitchRenderingValues(track.switchAtTheStart);
         this.drawSleepersOnSwitch(track.switchAtTheStart, switchRenderingValues, switchSleepersContainer);
      }
   }

   updateSwitch(sw: any) {
      const rmSw = this.app.renderingManager!;
      const sleepersContainer = this._rendering.sleepers_container.children.find((c: any) => rmSw.getGameObjFromDisplayObj(c) === sw);
      if (!sleepersContainer) return;

      const switchRenderingValues = this.getSwitchRenderingValues(sw);

      this.drawSleepersOnSwitch(sw, switchRenderingValues, sleepersContainer);
   }

   drawSleepersOnSwitch(sw: any, switchRenderingValues: any, container?: any) {

      if (container == null) {
         container = createLayerContainer("switch_sleepers");
         this.app.renderingManager!.bindGameObjToDisplayObj(container, sw);
         container.interactiveChildren = false;
         this._rendering.sleepers_container.addChild(container);
      } else {
         container.removeChildren();
      }

      const deg = sw.track1.deg;


      this.drawSleepersOnThreeWaySwitch(sw, switchRenderingValues, container, deg);

   }

   drawSleepersOnThreeWaySwitch(_sw: any, switchRenderingValues: any, container: any, deg: number) {
      const sleepers = this.getSleepersRenderingValues(_sw, switchRenderingValues);
      const worldSleepers = this.transformSwitchParameterToWorld(
         sleepers,
         switchRenderingValues.localFrame
      );

      worldSleepers.forEach((sleeper: { position: Point, length: number }, index: number) => {
         this.drawSleeper(index, sleeper.position.x, sleeper.position.y, deg, container, sleeper.length);
      });

   }

   renderSwitch(sw: any) {
      const switchRenderingValues = this.getSwitchRenderingValues(sw);

      const shape = new TrackGraphics("switch");
      this.app.renderingManager!.bindGameObjToDisplayObj(shape, sw);
      this._rendering.rails_container.addChild(shape);

      if (switchRenderingValues.branches.curvedBranch2 == null) {
         this.renderThreeWaySwitch(shape, switchRenderingValues);
      } else {
         this.renderFourWaySwitch(shape, switchRenderingValues);
      }

      this.drawSleepersOnSwitch(sw, switchRenderingValues);

      if (trackRendering_textured.DEBUG_VISUALIZE_SWITCH_PARAMS) {
         this.debugVisualizeSwitchRenderingParameter(sw, switchRenderingValues);
      }

      this.renderSwitchUI(sw);
   }

   /** Debug: plot every point in switchRenderingValues (debug layer). */
   debugVisualizeSwitchRenderingParameter(sw: any, switchRenderingValues: any) {
      const debugContainer = this.app.renderingManager!.containers.debug;

      const layer = createLayerContainer("switch_params_debug");
      this.app.renderingManager!.bindGameObjToDisplayObj(layer, sw);
      const localFrame = switchRenderingValues.localFrame;

      const points = gleisGraphics("switch_params_debug");
      const visit = (value: any, path: string) => {
         if (value == null || typeof value !== "object") return;

         if (typeof value.x === "number" && typeof value.y === "number") {
            const color = this.getSwitchDebugPointColor(path);
            {
               const worldPoint = localFrame ? this.toWorldPoint(value, localFrame) : value;
               points.circle(worldPoint.x, worldPoint.y, 1.5).fill(color).stroke({ width: 0.5, color: "#000" });
            }
            const labelPoint = localFrame ? this.toWorldPoint(value, localFrame) : value;
            const label = new Text({
               text: path,
               style: { fill: color, fontFamily: "Arial", fontSize: 3 },
               textureStyle: { scaleMode: "nearest" },
            });
            label.eventMode = "none";
            label.resolution = 8;
            label.x = labelPoint.x + 3;
            label.y = labelPoint.y - 4;
            layer.addChild(label);
            return;
         }

         for (const key of Object.keys(value)) {
            if (key === "localFrame") continue;
            const childPath = path ? `${path}.${key}` : key;
            visit(value[key], childPath);
         }
      };

      visit(switchRenderingValues, "");
      layer.addChild(points);
      debugContainer.addChild(layer);
   }

   getSwitchDebugPointColor(path: string): string {
      if (path.includes(".rails")) return "#00cc44";
      if (path.includes(".sleepers")) return "#33ccff";
      if (path.includes(".unit")) return "#3388ff";
      return "#000000";
   }

   getSwitchLocalFrame(sw: Switch) {
      let spine = sw.track1!.unit;
      if (spine.x < 0 || (spine.x === 0 && spine.y < 0)) {
         spine = new V2(new Point(-spine.x, -spine.y));
      }
      const rotation = Math.atan2(spine.y, spine.x);
      const cos = Math.cos(rotation);
      const sin = Math.sin(rotation);

      let mirrorX = false;
      let mirrorY = false;
      if (sw.type === Switch.SWITCH_TYPE.TO_RIGHT) {
         mirrorY = true;
      } else if (sw.type === Switch.SWITCH_TYPE.FROM_LEFT) {
         mirrorX = true;
      } else if (sw.type === Switch.SWITCH_TYPE.FROM_RIGHT) {
         mirrorX = true;
         mirrorY = true;
      }

      const mirrorSignX = mirrorX ? -1 : 1;
      const mirrorSignY = mirrorY ? -1 : 1;

      return {
         origin: Point.fromPoint(sw.location),
         cos,
         sin,
         mirrorSignX,
         mirrorSignY,
      };
   }

   toLocalVector(vector: any, frame: any): V2 {
      const rotatedX = frame.cos * vector.x + frame.sin * vector.y;
      const rotatedY = -frame.sin * vector.x + frame.cos * vector.y;
      return new V2(new Point(Math.abs(rotatedX), -Math.abs(rotatedY)));
   }

   toWorldPoint(localPoint: any, frame: any) {
      const reflectedX = localPoint.x * frame.mirrorSignX;
      const reflectedY = localPoint.y * frame.mirrorSignY;
      return geometry.add(
         frame.origin,
         new Point(
            frame.cos * reflectedX - frame.sin * reflectedY,
            frame.sin * reflectedX + frame.cos * reflectedY
         )
      );
   }

   isPointLike(value: any): boolean {
      return value != null && typeof value === "object" && typeof value.x === "number" && typeof value.y === "number";
   }

   transformSwitchParameterToWorld(data: any, localFrame?: any) {
      const frame = localFrame ?? data?.localFrame;
      if (!frame) return data;

      const transformNode = (value: any, key = ""): any => {
         if (value == null || typeof value !== "object") return value;
         if (this.isPointLike(value)) {
            if (key === "unit") return value;
            return this.toWorldPoint(value, frame);
         }
         if (Array.isArray(value)) {
            return value.map((entry) => transformNode(entry, key));
         }

         const result: any = {};
         for (const childKey of Object.keys(value)) {
            if (childKey === "localFrame") continue;
            result[childKey] = transformNode(value[childKey], childKey);
         }
         return result;
      };

      if (Array.isArray(data)) {
         return transformNode(data);
      }

      return {
         localFrame: frame,
         ...transformNode(data),
      };
   }




   getSleepersRenderingValues(sw: Switch, switchRenderingValues: any): { position: Point, length: number }[] {
      const { maintrack, straightBranch, curvedBranch, curvedBranch2 } = switchRenderingValues.branches;

      const switchLengthStraight = geometry.distance(maintrack.sleepers.upper, straightBranch.sleepers.upper);
      const amountOfSleepers = Math.floor(switchLengthStraight / this.sleeperIntervall);
      const remainingSpace = switchLengthStraight % this.sleeperIntervall;
      const sleepersIntervall =
         amountOfSleepers > 0
            ? this.sleeperIntervall + remainingSpace / amountOfSleepers
            : this.sleeperIntervall;

      const sleeperCurveControlPoints = {
         upper: geometry.getIntersectionPointX(
            maintrack.sleepers.upper,
            maintrack.unit,
            curvedBranch.sleepers.upper,
            curvedBranch.unit
         ),
         lower: curvedBranch2
            ? geometry.getIntersectionPointX(
               curvedBranch2.sleepers.lower,
               curvedBranch2.unit,
               straightBranch.sleepers.lower,
               straightBranch.unit
            )
            : null,
      };

      let x = maintrack.sleepers.upper.x + (this.schwellenBreite + this.schwellenGap) / 2;
      const sleepers: { position: Point, length: number }[] = [];
      while (x < sw.size + 20) {
         const y_upper = geometry.getBezierYAtX(x, maintrack.sleepers.upper, sleeperCurveControlPoints.upper!, curvedBranch.sleepers.upper)
            ?? geometry.getLinearYAtX(x, curvedBranch.sleepers.upper, curvedBranch.sleepers.lower);
         const y_lower = sw.type === Switch.SWITCH_TYPE.DKW && sleeperCurveControlPoints.lower
            ? (geometry.getBezierYAtX(x, curvedBranch2.sleepers.lower, sleeperCurveControlPoints.lower, straightBranch.sleepers.lower)
               ?? geometry.getLinearYAtX(x, curvedBranch2.sleepers.lower, curvedBranch2.sleepers.upper))
            : this.schwellenHöhe_2;
         if (y_upper !== null && y_lower != null) {
            sleepers.push({ position: new Point(x, (y_upper + y_lower) / 2), length: Math.abs(y_upper) + Math.abs(y_lower) });
         }
         x += sleepersIntervall;
      }
      return sleepers;
   }

   /** Rails and sleeper edges for one switch leg, offset perpendicular to unit at anchor. */
   private getSwitchBranchRenderingValues(unit: V2, anchor: Point | V2, sleeperOverscan = 0) {
      const perpendicular = geometry.perpendicular(unit);
      const railOffset = perpendicular.multiply(this.rail_distance);
      const sleeperOffset = perpendicular.multiply(this.schwellenHöhe_2);
      const sleeperAnchor = anchor.add(unit.multiply(sleeperOverscan));

      return {
         unit,
         rails: {
            upper: anchor.sub(railOffset),
            lower: anchor.add(railOffset),
         },
         sleepers: {
            upper: sleeperAnchor.sub(sleeperOffset),
            lower: sleeperAnchor.add(sleeperOffset),
         },
      };
   }

   private getSwitchRenderingValues(sw: Switch) {
      const localFrame = this.getSwitchLocalFrame(sw);
      const spineUnit = new V2(new Point(1, 0));

      const maintrack = this.getSwitchBranchRenderingValues(spineUnit, new Point(-sw.size, 0));
      const straightBranch = this.getSwitchBranchRenderingValues(spineUnit, new Point(sw.size, 0));

      const curvedUnit = this.toLocalVector(sw.tracks[2]!.unit, localFrame);
      const curvedBranch = this.getSwitchBranchRenderingValues(curvedUnit, curvedUnit.multiply(sw.size), this.sleeperIntervall);

      let curvedBranch2 = null;
      if (sw.track4) {
         const unit = this.toLocalVector(sw.track4.unit, localFrame);
         curvedBranch2 = this.getSwitchBranchRenderingValues(unit, unit.multiply(-sw.size), -this.sleeperIntervall);
      }

      const branches = { maintrack, straightBranch, curvedBranch, curvedBranch2 };

      const frog = geometry.getIntersectionPointX(
         straightBranch.rails.upper,
         straightBranch.unit,
         curvedBranch.rails.lower,
         curvedBranch.unit
      )!;

      const curves: { upperRail: Point; lowerRail: Point; lowerRail2?: Point } = {
         upperRail: geometry.getIntersectionPointX(
            maintrack.rails.upper,
            maintrack.unit,
            curvedBranch.rails.upper,
            curvedBranch.unit
         )!,
         lowerRail: geometry.getIntersectionPointX(
            maintrack.rails.lower,
            maintrack.unit,
            curvedBranch.rails.lower,
            curvedBranch.unit
         )!,
      };

      if (curvedBranch2) {
         curves.lowerRail2 = geometry.getIntersectionPointX(
            curvedBranch2.rails.lower,
            curvedBranch2.unit,
            straightBranch.rails.lower,
            straightBranch.unit
         )!;
      }

      const wingRailUpper = frog.add(new Point(-trackRendering_textured.SWITCH_WING_RAIL_THICKNESS, 0));
      const wingRail = {
         upper: wingRailUpper,
         upperEnd: wingRailUpper.add(geometry.multiply(curvedBranch.unit, trackRendering_textured.SWITCH_WING_RAIL_LENGTH)),
         lower: frog.sub(geometry.multiply(curvedBranch.unit, trackRendering_textured.SWITCH_WING_RAIL_THICKNESS)),
         lowerEnd: frog
            .sub(geometry.multiply(curvedBranch.unit, trackRendering_textured.SWITCH_WING_RAIL_THICKNESS))
            .add(geometry.multiply(straightBranch.unit, trackRendering_textured.SWITCH_WING_RAIL_LENGTH)),
      };

      return {
         localFrame,
         branches,
         points: {
            frog,
            curves,
            wingRail,
            switchRail: new Point(maintrack.rails.upper.x - 5, maintrack.rails.upper.y + 2.5),
            switchRailEnd: new Point(maintrack.rails.upper.x + 30, maintrack.rails.upper.y + 1.5),
         },
      };
   }

   /** Filled taper from tip to a full-width anchor — one layer of the 3-layer rail stack. */
   private static drawTaperedRailEnd(
      g: TrackGraphics,
      tip: Point,
      wideAnchor: Point,
      width: number,
      color: string,
   ) {
      const along = geometry.sub(wideAnchor, tip);
      if (geometry.length(along) === 0) return;

      const half = width / 2;
      const n = geometry.perpendicular(geometry.unit(along)).multiply(half);
      g.fillPoly([tip, wideAnchor.add(n), wideAnchor.sub(n)], color);
   }

   renderThreeWaySwitch(g: TrackGraphics, switchRenderingValues: any) {
      const world = this.transformSwitchParameterToWorld(switchRenderingValues);
      const { maintrack, straightBranch, curvedBranch } = world.branches;
      const { frog, curves, wingRail, switchRail, switchRailEnd } = world.points;
      const st = {
         width: 0,
         color: "",
         cap: "butt" as LineCap,
         join: "miter" as LineJoin,
      };
      for (const rail of trackRendering_textured.RAILS) {
         st.width = rail[0];
         st.color = rail[1];

         // lower straight stock rail
         g.lineFromTo(maintrack.rails.lower, straightBranch.rails.lower)
            // rail to and from frog
            .lineFromTo(straightBranch.rails.upper, frog).line2Point(curvedBranch.rails.lower)
            // upper curved stock rail
            .move2Point(maintrack.rails.upper).quadraticCurve2Point(
               curves.upperRail,
               curvedBranch.rails.upper
            )
            // lower curved switch rail with wing rail
            .move2Point(maintrack.rails.lower).quadraticCurve2Point(
               curves.lowerRail,
               wingRail.lower
            ).line2Point(wingRail.lowerEnd)            
            // upper  switch rail with wing rail
            .lineFromTo(switchRailEnd, wingRail.upper).line2Point(wingRail.upperEnd)
            .stroke(st);

         trackRendering_textured.drawTaperedRailEnd(g, switchRail, switchRailEnd, rail[0], rail[1]);
      }
   }

   renderFourWaySwitch(g: TrackGraphics, switchRenderingValues: any) {
      const world = this.transformSwitchParameterToWorld(switchRenderingValues);
      const { maintrack, straightBranch, curvedBranch, curvedBranch2 } = world.branches;
      const { frog, curves, wingRail, switchRail } = world.points;
      const st = {
         width: 0,
         color: "",
         cap: "butt" as LineCap,
         join: "miter" as LineJoin,
      };

      for (const rail of trackRendering_textured.RAILS) {
         st.width = rail[0];
         st.color = rail[1];

         // lower straight stock rail
         g.lineFromTo(maintrack.rails.lower, straightBranch.rails.lower)
            // rail to and from frog
            .lineFromTo(straightBranch.rails.upper, frog).line2Point(curvedBranch.rails.lower)
            // upper curved stock rail
            .move2Point(maintrack.rails.upper).quadraticCurve2Point(
               curves.upperRail,
               curvedBranch.rails.upper
            )
            // lower curved stock rail
            .move2Point(curvedBranch2.rails.lower).quadraticCurve2Point(
               curves.lowerRail2,
               straightBranch.rails.lower
            )
            // lower curved switch rail with wing rail
            .move2Point(maintrack.rails.lower).quadraticCurve2Point(
               curves.lowerRail,
               wingRail.lower
            )
            .line2Point(wingRail.lowerEnd)
            // upper switch rail with wing rail (body only; tip drawn as filled taper)
            .lineFromTo(maintrack.rails.upper, wingRail.upper).line2Point(wingRail.upperEnd)
            .lineFromTo(curvedBranch.rails.upper, curvedBranch2.rails.upper)
            .lineFromTo(wingRail.lowerEnd, wingRail.lower).line2Point(curvedBranch2.rails.lower)
            .move2Point(curvedBranch2.rails.upper).quadraticCurve2Point(curves.upperRail, wingRail.upper)
            .stroke(st);

      }
   }

   renderSwitchUI(sw: Switch) {
      const arrowStroke = {
         width: trackRendering_textured.SWITCH_UI_STROKE,
         color: "#333",
         cap: "round" as LineCap,
         join: "miter" as LineJoin,
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


