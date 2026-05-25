"use strict";

import { geometry, Point } from "../../tools.ts";
import { Rectangle, Sprite } from "pixi.js";
import { gleisGraphics, imageSize, textureRegion } from "../../pixiPrimitives.ts";
import { createLayerContainer } from "../../pixiUtils.ts";
import { SCHWELLEN_VARIANTEN, TRACK_SCALE } from "./constants.ts";
import { AdvancedTrackRendering } from "./AdvancedTrackRendering.ts";

export abstract class AdvancedSleeperRendering extends AdvancedTrackRendering {
   drawTrackSleepers(points: any[], container: any) {
      for (let pi = 0; pi < points.length; pi++) {
         const point = points[pi];

         this.drawSleepersAlongStraight(
            point.track,
            point.start,
            point.straightEnd,
            container,
         );

         if (point.rails.curve) {
            this.drawSleepersAlongCurve(
               point.straightEnd,
               point.curveEnd,
               point.controlPoint,
               container,
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

   drawSleepersAlongStraight(track: any, startPoint: any, endPoint: any, container: any) {
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
         this.drawSleeper(i, x, y, track.deg, container);
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
         i = i % SCHWELLEN_VARIANTEN;
         const scaleY = length / this.schwellenHöhe;
         const ry = this.schwellenImg.height / 2;

         if (!this._bitmapCache[i]) {
            const sourceRect = new Rectangle(
               (i * this.schwellenImg.width) / SCHWELLEN_VARIANTEN,
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
         sleeperBitmap.scale.set(TRACK_SCALE, TRACK_SCALE * scaleY);
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
         bumperEnd.scale.set(-TRACK_SCALE, TRACK_SCALE);
         bumperEnd.angle = track.deg;
         bumperEnd.pivot.set(imageSize(this.bumperImg).width, imageSize(this.bumperImg).height / 2);
         track_container.addChild(bumperEnd);
      }

      if (track.switchAtTheStart == null) {
         const bumperStart = new Sprite(this.bumperImg);
         bumperStart.eventMode = "static";
         bumperStart.x = track.start.x;
         bumperStart.y = track.start.y;
         bumperStart.scale.set(TRACK_SCALE);
         bumperStart.angle = track.deg;
         bumperStart.pivot.set(imageSize(this.bumperImg).width, imageSize(this.bumperImg).height / 2);
         track_container.addChild(bumperStart);
      }
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
}
