"use strict";

import { Track } from "../../track.ts";
import { Switch } from "../../switch.ts";
import { geometry } from "../../tools.ts";
import { CONFIG } from "../../config.ts";
import { RAILS } from "./constants.ts";
import { AdvancedRendererCore } from "./AdvancedRendererCore.ts";

export abstract class AdvancedTrackCalculations extends AdvancedRendererCore {
   calculateTrackPoints(track: any) {
      const startConnection = track.switchAtTheStart;
      const endConnection = track.switchAtTheEnd;

      let startPoint = track.start;
      let endPoint = track.end;

      if (startConnection) {
         const size =
            startConnection instanceof Switch
               ? this.getBranchSize(startConnection, track)
               : CONFIG.GRID_SIZE;
         startPoint = startPoint.add(geometry.multiply(track.unit, size));
      } else {
         startPoint = startPoint.sub(geometry.multiply(track.unit, CONFIG.GRID_SIZE));
      }

      let straightEndPoint = endPoint;
      let curveEnd: any = null;
      let controlPoint: any = null;
      let nextUnit: any = null;

      if (endConnection) {
         const size =
            endConnection instanceof Switch
               ? this.getBranchSize(endConnection, track)
               : CONFIG.GRID_SIZE;
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

      const padding = RAILS[0][0] * 0.5;
      return {
         x: minX - padding,
         y: minY - padding,
         width: maxX - minX + padding * 2,
         height: maxY - minY + padding * 2,
      };
   }

   protected abstract getBranchSize(sw: Switch, track: Track | null): number;
}
