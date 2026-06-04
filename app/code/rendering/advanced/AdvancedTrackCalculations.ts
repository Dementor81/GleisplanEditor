"use strict";

import { Track } from "../../track.ts";
import { Switch } from "../../switch.ts";
import { geometry } from "../../tools.ts";
import type { V2 } from "../../tools.ts";
import { CONFIG } from "../../config.ts";
import {
   RAILS,
   TRACK_CURVE_ANGLE_FACTOR,
   TRACK_CURVE_MIN_SIZE,
   TRACK_CURVE_MIN_STRAIGHT,
} from "./constants.ts";
import type { AdvancedRendering } from "./AdvancedRendering.ts";

export class AdvancedTrackCalculations {
   constructor(readonly renderer: AdvancedRendering) {}

   /**
    * Angle-aware ideal curve length at a Track-Track joint.
    * 0 turn (straight continuation) -> TRACK_CURVE_MIN_SIZE; 90° kink -> + TRACK_CURVE_ANGLE_FACTOR.
    */
   private getJointCurveBaseSize(thisUnit: V2, nextUnit: V2): number {
      const turn = geometry.angleBetweenRad(thisUnit, nextUnit);
      return TRACK_CURVE_MIN_SIZE + TRACK_CURVE_ANGLE_FACTOR * Math.sin(turn / 2);
   }

   /** Final tangent length reserved on `track`'s `side`, clamped so both ends fit within track.length. */
   private getTrackEndOffset(track: Track, side: "start" | "end"): number {
      const conn = side === "start" ? track.switchAtTheStart : track.switchAtTheEnd;
      if (!conn) return -CONFIG.GRID_SIZE;
      if (conn instanceof Switch) return this.renderer.switchCalculations.getBranchSize(conn, track);

      const ideal = this.getJointCurveBaseSize(track.unit, conn.unit);

      const otherConn = side === "start" ? track.switchAtTheEnd : track.switchAtTheStart;
      const otherIdeal = !otherConn
         ? CONFIG.GRID_SIZE
         : otherConn instanceof Switch
            ? this.renderer.switchCalculations.getBranchSize(otherConn, track)
            : this.getJointCurveBaseSize(track.unit, otherConn.unit);

      const available = track.length - TRACK_CURVE_MIN_STRAIGHT;
      if (ideal + otherIdeal <= available) return ideal;
      return ideal * (available / (ideal + otherIdeal));
   }

   calculateTrackPoints(track: any) {
      const endConnection = track.switchAtTheEnd;

      const startOffset = this.getTrackEndOffset(track, "start");
      const startPoint = track.start.add(geometry.multiply(track.unit, startOffset));

      let straightEndPoint = track.end;
      let curveEnd: any = null;
      let controlPoint: any = null;
      let nextUnit: any = null;

      if (endConnection) {
         const endOffset = this.getTrackEndOffset(track, "end");
         straightEndPoint = track.end.sub(geometry.multiply(track.unit, endOffset));

         if (endConnection instanceof Track) {
            nextUnit = endConnection.unit;
            const nextStartOffset = this.getTrackEndOffset(endConnection, "start");
            curveEnd = endConnection.start.add(geometry.multiply(nextUnit, nextStartOffset));
            controlPoint = geometry.getIntersectionPointX(straightEndPoint, track.unit, curveEnd, nextUnit);
         }
      } else {
         straightEndPoint = track.end.add(geometry.multiply(track.unit, CONFIG.GRID_SIZE));
      }

      const centerLine: any = {
         track,
         start: startPoint,
         straightEnd: straightEndPoint,
         unit: track.unit,
         curveEnd,
         controlPoint,
         nextUnit,
      };

      centerLine.rails = this.parallelOffsetLines(centerLine, this.renderer.rail_distance);
      centerLine.sleeperOutline = this.parallelOffsetLines(centerLine, this.renderer.schwellenHöhe_2);

      return centerLine;
   }

   /** Lines parallel to the centerLine (straight + optional curve), offset perpendicular by `offset`. */
   private parallelOffsetLines(centerLine: any, offset: number) {
      const offsetVec = geometry.perpendicular(centerLine.unit.multiply(offset));
      const result: any = {
         straight: {
            inner: { start: centerLine.start.add(offsetVec), end: centerLine.straightEnd.add(offsetVec) },
            outer: { start: centerLine.start.sub(offsetVec), end: centerLine.straightEnd.sub(offsetVec) },
         },
      };

      if (centerLine.controlPoint) {
         const nextOffsetVec = geometry.perpendicular(centerLine.nextUnit.multiply(offset));
         const innerStart = result.straight.inner.end;
         const outerStart = result.straight.outer.end;
         const innerEnd = centerLine.curveEnd.add(nextOffsetVec);
         const outerEnd = centerLine.curveEnd.sub(nextOffsetVec);

         result.curve = {
            inner: { start: innerStart, end: innerEnd, cp: geometry.getIntersectionPointX(innerStart, centerLine.unit, innerEnd, centerLine.nextUnit) },
            outer: { start: outerStart, end: outerEnd, cp: geometry.getIntersectionPointX(outerStart, centerLine.unit, outerEnd, centerLine.nextUnit) },
         };
      }

      return result;
   }

   calculateRailBounds(centerLine: any) {
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      const updateBounds = (point: any) => {
         minX = Math.min(minX, point.x);
         minY = Math.min(minY, point.y);
         maxX = Math.max(maxX, point.x);
         maxY = Math.max(maxY, point.y);
      };

      const { inner, outer } = centerLine.rails.straight;
      updateBounds(inner.start);
      updateBounds(inner.end);
      updateBounds(outer.start);
      updateBounds(outer.end);

      if (centerLine.rails.curve) {
         const curve = centerLine.rails.curve;
         updateBounds(curve.inner.start);
         updateBounds(curve.inner.end);
         updateBounds(curve.outer.start);
         updateBounds(curve.outer.end);
      }

      const padding = RAILS[0][0] * 0.5;
      return {
         x: minX - padding,
         y: minY - padding,
         width: maxX - minX + padding * 2,
         height: maxY - minY + padding * 2,
      };
   }
}
