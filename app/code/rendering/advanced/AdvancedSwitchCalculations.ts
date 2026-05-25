"use strict";

import { Track } from "../../track.ts";
import { Switch } from "../../switch.ts";
import { geometry, Point, V2 } from "../../tools.ts";
import { CONFIG } from "../../config.ts";
import {
   SWITCH_WING_RAIL_LENGTH,
   SWITCH_WING_RAIL_SLOPE_FACTOR,
   SWITCH_WING_RAIL_THICKNESS,
} from "./constants.ts";
import { AdvancedTrackCalculations } from "./AdvancedTrackCalculations.ts";

export abstract class AdvancedSwitchCalculations extends AdvancedTrackCalculations {
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
      const branchSize = switchRenderingValues.branchSize;
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
      while (x < branchSize) {
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

   protected getSwitchBranchRenderingValues(unit: V2, anchor: Point | V2, sleeperOverscan = 0) {
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

   getBranchSize(sw: Switch, track: Track | null = null): number {
      if (track === sw.track1 && sw.type !== Switch.SWITCH_TYPE.DKW) return CONFIG.GRID_SIZE;
      let size = CONFIG.GRID_SIZE;
      let distance = 0;
      let iteration = 0;
      while (distance < this.schwellenHöhe && iteration < 100) {
         size += 5;
         iteration++;
         distance = geometry.distance(sw.location.add(geometry.multiply(sw.track2!.unit, size)), sw.location.add(geometry.multiply(sw.track3!.unit, size)));
      }
      return size;
   }

   protected getSwitchRenderingValues(sw: Switch) {
      const localFrame = this.getSwitchLocalFrame(sw);
      const spineUnit = new V2(new Point(1, 0));
      const branchSize = this.getBranchSize(sw);
      const maintrack = this.getSwitchBranchRenderingValues(spineUnit, new Point(sw.type !== Switch.SWITCH_TYPE.DKW ? -CONFIG.GRID_SIZE : -branchSize, 0));
      const straightBranch = this.getSwitchBranchRenderingValues(spineUnit, new Point(branchSize, 0));

      const curvedUnit = this.toLocalVector(sw.tracks[2]!.unit, localFrame);
      const curvedBranch = this.getSwitchBranchRenderingValues(
         curvedUnit,
         curvedUnit.multiply(branchSize),
         0
      );

      let curvedBranch2 = null;
      if (sw.track4) {
         const unit = this.toLocalVector(sw.track4.unit, localFrame);
         curvedBranch2 = this.getSwitchBranchRenderingValues(
            unit,
            unit.multiply(-branchSize),
            0
         );
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

      const wingRailUpper = frog.add(new Point(-SWITCH_WING_RAIL_THICKNESS * (1 + SWITCH_WING_RAIL_SLOPE_FACTOR - Math.abs(sw.slope) * SWITCH_WING_RAIL_SLOPE_FACTOR), 0));
      const wingRail = {
         upper: wingRailUpper,
         upperEnd: wingRailUpper.add(geometry.multiply(curvedBranch.unit, SWITCH_WING_RAIL_LENGTH)),
         lower: frog.sub(geometry.multiply(curvedBranch.unit, SWITCH_WING_RAIL_THICKNESS * (1 + SWITCH_WING_RAIL_SLOPE_FACTOR - Math.abs(sw.slope) * SWITCH_WING_RAIL_SLOPE_FACTOR))),
         lowerEnd: new Point(0, 0),
      };
      wingRail.lowerEnd = wingRail.lower.add(geometry.multiply(straightBranch.unit, SWITCH_WING_RAIL_LENGTH));

      let frog2: Point | null = null;
      let wingRail2: { upper: Point; upperEnd: Point; lower: Point; lowerEnd: Point } | null = null;
      if (sw.type === Switch.SWITCH_TYPE.DKW) {
         frog2 = frog.mirror();
         wingRail2 = {
            upper: wingRail.upper.mirror(),
            upperEnd: wingRail.upperEnd.mirror(),
            lower: wingRail.lower.mirror(),
            lowerEnd: wingRail.lowerEnd.mirror(),
         };
      }

      const points = {
         frog,
         frog2,
         curves,
         wingRail,
         wingRail2,
         switchRail: new Point(maintrack.rails.upper.x - 5, maintrack.rails.upper.y + 2.5),
         switchRailEnd: new Point(maintrack.rails.upper.x + 30, maintrack.rails.upper.y + 1.5),
      };

      return {
         localFrame,
         branches,
         branchSize,
         points: points,
      };
   }
}
