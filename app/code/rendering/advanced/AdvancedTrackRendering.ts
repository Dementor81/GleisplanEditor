"use strict";

import { Text } from "pixi.js";
import { gleisGraphics, polygonHitArea, TrackGraphics } from "../../pixiPrimitives.ts";
import { TrackBuildInteraction } from "../../interactions/TrackBuildInteraction.ts";
import { createLayerContainer } from "../../pixiUtils.ts";
import { DEBUG_VISUALIZE_TRACK_PARAMS, RAILS } from "./constants.ts";
import type { AdvancedRendering } from "./AdvancedRendering.ts";

export class AdvancedTrackRendering {
   constructor(readonly renderer: AdvancedRendering) {}

   renderTrack(track: any) {
      const r = this.renderer;
      const centerLine = r.trackCalculations.calculateTrackPoints(track);

      const sleepers_container = createLayerContainer("track");
      r.app.renderingManager!.bindGameObjToDisplayObj(sleepers_container, track);
      sleepers_container.interactiveChildren = false;
      r._rendering.sleepers_container.addChild(sleepers_container);

      // Trace a non-self-intersecting outline: outer edge forward, inner edge backward.
      // curve.outer.start == straight.outer.end and curve.inner.start == straight.inner.end
      // (set in AdvancedTrackCalculations.parallelOffsetLines), so we skip those duplicates.
      const straight = centerLine.sleeperOutline.straight;
      const curve = centerLine.sleeperOutline.curve;
      const hitPoints: any[] = [straight.outer.start, straight.outer.end];
      if (curve) hitPoints.push(curve.outer.end, curve.inner.end);
      hitPoints.push(straight.inner.end, straight.inner.start);
      sleepers_container.hitArea = polygonHitArea(hitPoints);
      TrackBuildInteraction.attach(sleepers_container, track);

      r.sleeperRendering.drawTrackSleepers(centerLine, sleepers_container);
      this.renderRails(track, centerLine);
      if (track.hasBumper) r.sleeperRendering.drawBumper(track, r._rendering.rails_container);

      if (DEBUG_VISUALIZE_TRACK_PARAMS) {
         this.debugVisualizeTrackRenderingParameter(track, centerLine);
      }
   }

   debugVisualizeTrackRenderingParameter(track: any, centerLine: any) {
      const r = this.renderer;
      const debugContainer = r.app.renderingManager!.containers.debug;

      const layer = createLayerContainer("track_params_debug");
      r.app.renderingManager!.bindGameObjToDisplayObj(layer, track);

      const points = gleisGraphics("track_params_debug");
      const visit = (value: any, path: string) => {
         if (value == null || typeof value !== "object") return;

         if (typeof value.x === "number" && typeof value.y === "number") {
            const color = this.getTrackDebugPointColor(path);
            points.circle(value.x, value.y, 0.5).fill(color).stroke({ width: 0.1, color: "#000" });
            const label = new Text({
               text: path,
               style: { fill: color, fontFamily: "Arial", fontSize: 3 },
               textureStyle: { scaleMode: "nearest" },
            });
            label.eventMode = "none";
            label.resolution = r.app.renderingManager!.scale;
            label.x = value.x + 3;
            label.y = value.y - 4;
            layer.addChild(label);
            return;
         }

         for (const key of Object.keys(value)) {
            if (key === "track") continue;
            const childPath = path ? `${path}.${key}` : key;
            visit(value[key], childPath);
         }
      };

      visit(centerLine, "");
      layer.addChild(points);
      debugContainer.addChild(layer);
   }

   getTrackDebugPointColor(path: string): string {
      if (path.includes(".rails")) return "#00cc44";
      if (path.includes("sleeperOutline")) return "#33ccff";
      if (path.includes("controlPoint") || path.includes(".cp")) return "#ff8800";
      if (path === "unit" || path === "nextUnit" || path.includes(".unit")) return "#3388ff";
      return "#000000";
   }

   renderRails(track: any, centerLine: any) {
      const r = this.renderer;
      const rail_shape = new TrackGraphics("track");
      rail_shape.eventMode = "none";
      r.app.renderingManager!.bindGameObjToDisplayObj(rail_shape, track);
      r._rendering.rails_container.addChild(rail_shape);

      const { straight, curve } = centerLine.rails;

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

      const bounds = r.trackCalculations.calculateRailBounds(centerLine);
      rail_shape.setBounds(bounds.x, bounds.y, bounds.width, bounds.height);
   }

   updateTrack(track: any) {
      const r = this.renderer;
      const rm = r.app.renderingManager!;
      const sleepersContainer = r._rendering.sleepers_container.children.find((c: any) => rm.getGameObjFromDisplayObj(c) === track);
      if (!sleepersContainer) return;

      sleepersContainer.removeChildren();

      const centerLine = r.trackCalculations.calculateTrackPoints(track);
      r.sleeperRendering.drawTrackSleepers(centerLine, sleepersContainer);

      if (track == (track.switchAtTheEnd as any)?.t1) {
         const switchSleepersContainer = r._rendering.sleepers_container.children.find(
            (c: any) => rm.getGameObjFromDisplayObj(c) === track.switchAtTheEnd
         );
         const switchRenderingValues = r.switchCalculations.getSwitchRenderingValues(track.switchAtTheEnd);
         r.sleeperRendering.drawSleepersOnSwitch(track.switchAtTheEnd, switchRenderingValues, switchSleepersContainer);
      }

      if (track == (track.switchAtTheStart as any)?.t1) {
         const switchSleepersContainer = r._rendering.sleepers_container.children.find(
            (c: any) => rm.getGameObjFromDisplayObj(c) === track.switchAtTheStart
         );
         const switchRenderingValues = r.switchCalculations.getSwitchRenderingValues(track.switchAtTheStart);
         r.sleeperRendering.drawSleepersOnSwitch(track.switchAtTheStart, switchRenderingValues, switchSleepersContainer);
      }
   }
}
