"use strict";

import { geometry, Point } from "../../tools.ts";
import { Rectangle, Sprite } from "pixi.js";
import { gleisGraphics, imageSize, textureRegion } from "../../pixiPrimitives.ts";
import { createLayerContainer } from "../../pixiUtils.ts";
import { RailwayCrossing } from "../../railway_crossing.ts";
import { SCHWELLEN_VARIANTEN, TRACK_SCALE } from "./constants.ts";
import type { AdvancedRendering } from "./AdvancedRendering.ts";

export class AdvancedSleeperRendering {
   constructor(readonly renderer: AdvancedRendering) {}

   drawTrackSleepers(centerLine: any, container: any) {
      this.drawSleepersAlongStraight(centerLine.track, centerLine.start, centerLine.straightEnd, container);

      if (centerLine.rails.curve) {
         this.drawSleepersAlongCurve(centerLine.straightEnd, centerLine.curveEnd, centerLine.controlPoint, container);
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
      const r = this.renderer;
      const steps = Math.floor((geometry.distance(startPoint, endPoint) * 1.11) / r.sleeperIntervall);
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
      const r = this.renderer;
      const l = geometry.distance(startPoint, endPoint);
      const amount = Math.floor(l / r.sleeperIntervall);
      if (amount <= 0) return;

      const remainingSpace = l % r.sleeperIntervall;
      const adjustedInterval = r.sleeperIntervall + remainingSpace / amount;
      const crossingRanges = RailwayCrossing.rangesForTrack(track);

      const step_x = track.cos * adjustedInterval;
      const step_y = track.sin * adjustedInterval;

      const startOffset = r.sleeperIntervall / 2;
      let x = startPoint.x + track.cos * startOffset;
      let y = startPoint.y + track.sin * startOffset;

      for (let i = 0; i < amount; i++) {
         const km = track.unit.dot({ x: x - track.start.x, y: y - track.start.y });
         if (!crossingRanges.some((range) => km >= range.startKm && km <= range.endKm)) {
            this.drawSleeper(i, x, y, track.deg, container);
         }
         y += step_y;
         x += step_x;
      }
   }

   drawSleeper(i: number, x: number, y: number, angle: number, container: any, length = this.renderer.schwellenHöhe) {
      const r = this.renderer;
      if (r.app.renderingManager!.viewport.scale.x < r.LOD) {
         const yStart = Math.min(0, length);
         const drawLength = Math.abs(length);
         const ry = length / 2;

         let sleeper = gleisGraphics();
         sleeper
            .rect(0, yStart, r.schwellenBreite, drawLength)
            .fill("#99735b")
            .stroke({ width: 0.2, color: "black", cap: "round", join: "round" });
         sleeper.x = x;
         sleeper.y = y;
         sleeper.angle = angle;
         sleeper.pivot.set(r.schwellenBreite / 2, ry);

         container.addChild(sleeper);
      } else {
         i = i % SCHWELLEN_VARIANTEN;
         const scaleY = length / r.schwellenHöhe;
         const ry = r.schwellenImg.height / 2;

         if (!r._bitmapCache[i]) {
            const sourceRect = new Rectangle(
               (i * r.schwellenImg.width) / SCHWELLEN_VARIANTEN,
               0,
               r.sleepersImgWidth,
               r.schwellenImg.height
            );

            const bitmap = new Sprite(textureRegion(r.schwellenImg, sourceRect));
            bitmap.eventMode = "static";
            r._bitmapCache[i] = bitmap;
         }

         const sleeperBitmap = new Sprite(r._bitmapCache[i].texture);
         sleeperBitmap.eventMode = "static";

         sleeperBitmap.x = x;
         sleeperBitmap.y = y;
         sleeperBitmap.pivot.set(r.sleepersImgWidth / 2, ry);
         sleeperBitmap.scale.set(TRACK_SCALE, TRACK_SCALE * scaleY);
         sleeperBitmap.angle = angle;

         container.addChild(sleeperBitmap);
      }
   }

   drawBumper(track: any, track_container: any) {
      const r = this.renderer;
      if (track.switchAtTheEnd == null) {
         const bumperEnd = new Sprite(r.bumperImg);
         bumperEnd.eventMode = "static";
         bumperEnd.x = track.end.x;
         bumperEnd.y = track.end.y;
         bumperEnd.scale.set(-TRACK_SCALE, TRACK_SCALE);
         bumperEnd.angle = track.deg;
         bumperEnd.pivot.set(imageSize(r.bumperImg).width, imageSize(r.bumperImg).height / 2);
         track_container.addChild(bumperEnd);
      }

      if (track.switchAtTheStart == null) {
         const bumperStart = new Sprite(r.bumperImg);
         bumperStart.eventMode = "static";
         bumperStart.x = track.start.x;
         bumperStart.y = track.start.y;
         bumperStart.scale.set(TRACK_SCALE);
         bumperStart.angle = track.deg;
         bumperStart.pivot.set(imageSize(r.bumperImg).width, imageSize(r.bumperImg).height / 2);
         track_container.addChild(bumperStart);
      }
   }

   drawSleepersOnSwitch(sw: any, switchRenderingValues: any, container?: any) {
      const r = this.renderer;
      if (container == null) {
         container = createLayerContainer("switch_sleepers");
         r.app.renderingManager!.bindGameObjToDisplayObj(container, sw);
         container.interactiveChildren = false;
         r._rendering.sleepers_container.addChild(container);
      } else {
         container.removeChildren();
      }

      const deg = sw.track1.deg;

      this.drawSleepersOnThreeWaySwitch(sw, switchRenderingValues, container, deg);
   }

   drawSleepersOnThreeWaySwitch(_sw: any, switchRenderingValues: any, container: any, deg: number) {
      const r = this.renderer;
      const sleepers = r.switchCalculations.getSleepersRenderingValues(_sw, switchRenderingValues);
      const worldSleepers = r.switchCalculations.transformSwitchParameterToWorld(
         sleepers,
         switchRenderingValues.localFrame
      );

      worldSleepers.forEach((sleeper: { position: Point, length: number }, index: number) => {
         this.drawSleeper(index, sleeper.position.x, sleeper.position.y, deg, container, sleeper.length);
      });
   }
}
