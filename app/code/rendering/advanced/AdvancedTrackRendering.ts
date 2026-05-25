"use strict";

import { polygonHitArea, TrackGraphics } from "../../pixiPrimitives.ts";
import { createLayerContainer } from "../../pixiUtils.ts";
import { RAILS } from "./constants.ts";
import { AdvancedGenericElements } from "./AdvancedGenericElements.ts";

export abstract class AdvancedTrackRendering extends AdvancedGenericElements {
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

   renderRails(track: any, points: any[]) {
      const rail_shape = new TrackGraphics("track");
      this.app.renderingManager!.bindGameObjToDisplayObj(rail_shape, track);
      this._rendering.rails_container.addChild(rail_shape);

      for (const point of points) {
         const { straight, curve } = point.rails;

         RAILS.forEach((rail) => {
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

   updateTrack(track: any) {
      const rm = this.app.renderingManager!;
      const sleepersContainer = this._rendering.sleepers_container.children.find((c: any) => rm.getGameObjFromDisplayObj(c) === track);
      if (!sleepersContainer) return;

      sleepersContainer.removeChildren();

      const points = this.calculateTrackPoints(track);
      this.drawTrackSleepers(points, sleepersContainer);

      if (track == (track.switchAtTheEnd as any)?.t1) {
         const switchSleepersContainer = this._rendering.sleepers_container.children.find(
            (c: any) => rm.getGameObjFromDisplayObj(c) === track.switchAtTheEnd
         );
         const switchRenderingValues = this.getSwitchRenderingValues(track.switchAtTheEnd);
         this.drawSleepersOnSwitch(track.switchAtTheEnd, switchRenderingValues, switchSleepersContainer);
      }

      if (track == (track.switchAtTheStart as any)?.t1) {
         const switchSleepersContainer = this._rendering.sleepers_container.children.find(
            (c: any) => rm.getGameObjFromDisplayObj(c) === track.switchAtTheStart
         );
         const switchRenderingValues = this.getSwitchRenderingValues(track.switchAtTheStart);
         this.drawSleepersOnSwitch(track.switchAtTheStart, switchRenderingValues, switchSleepersContainer);
      }
   }

   protected abstract drawTrackSleepers(points: any[], container: any): void;
   protected abstract drawBumper(track: any, track_container: any): void;
   protected abstract drawSleepersOnSwitch(sw: any, switchRenderingValues: any, container?: any): void;
}
