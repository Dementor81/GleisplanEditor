"use strict";

import { Switch } from "../../switch.ts";
import { geometry, Point } from "../../tools.ts";
import { Text } from "pixi.js";
import type { Graphics } from "pixi.js";
import type { LineCap, LineJoin } from "pixi.js";
import { gleisGraphics, TrackGraphics } from "../../pixiPrimitives.ts";
import { createLayerContainer } from "../../pixiUtils.ts";
import { DEBUG_VISUALIZE_SWITCH_PARAMS, RAILS, SWITCH_UI_STROKE } from "./constants.ts";
import type { AdvancedRendering } from "./AdvancedRendering.ts";

/** Draw a pointed rail end at the tip of a rail, used for the switch rail. */
function drawTaperedRailEnd(
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

export class AdvancedSwitchRendering {
   constructor(readonly renderer: AdvancedRendering) {}

   renderSwitch(sw: any) {
      const r = this.renderer;
      const switchRenderingValues = r.switchCalculations.getSwitchRenderingValues(sw);

      const shape = new TrackGraphics("switch");
      r.app.renderingManager!.bindGameObjToDisplayObj(shape, sw);
      r._rendering.rails_container.addChild(shape);

      if (switchRenderingValues.branches.curvedBranch2 == null) {
         this.renderThreeWaySwitch(shape, switchRenderingValues);
      } else {
         this.renderFourWaySwitch(shape, switchRenderingValues);
      }

      r.sleeperRendering.drawSleepersOnSwitch(sw, switchRenderingValues);

      if (DEBUG_VISUALIZE_SWITCH_PARAMS) {
         this.debugVisualizeSwitchRenderingParameter(sw, switchRenderingValues);
      }

      this.renderSwitchUI(sw);
   }

   updateSwitch(sw: any) {
      const r = this.renderer;
      const rmSw = r.app.renderingManager!;
      const sleepersContainer = r._rendering.sleepers_container.children.find((c: any) => rmSw.getGameObjFromDisplayObj(c) === sw);
      if (!sleepersContainer) return;

      const switchRenderingValues = r.switchCalculations.getSwitchRenderingValues(sw);

      r.sleeperRendering.drawSleepersOnSwitch(sw, switchRenderingValues, sleepersContainer);
   }

   debugVisualizeSwitchRenderingParameter(sw: any, switchRenderingValues: any) {
      const r = this.renderer;
      const debugContainer = r.app.renderingManager!.containers.debug;

      const layer = createLayerContainer("switch_params_debug");
      r.app.renderingManager!.bindGameObjToDisplayObj(layer, sw);
      const localFrame = switchRenderingValues.localFrame;

      const points = gleisGraphics("switch_params_debug");
      const visit = (value: any, path: string) => {
         if (value == null || typeof value !== "object") return;

         if (typeof value.x === "number" && typeof value.y === "number") {
            const color = this.getSwitchDebugPointColor(path);
            {
               const worldPoint = localFrame ? r.switchCalculations.toWorldPoint(value, localFrame) : value;
               points.circle(worldPoint.x, worldPoint.y, 0.5).fill(color).stroke({ width: 0.1, color: "#000" });
            }
            const labelPoint = localFrame ? r.switchCalculations.toWorldPoint(value, localFrame) : value;
            const label = new Text({
               text: path,
               style: { fill: color, fontFamily: "Arial", fontSize: 3 },
               textureStyle: { scaleMode: "nearest" },
            });
            label.eventMode = "none";
            label.resolution = r.app.renderingManager!.scale;
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

   renderThreeWaySwitch(g: TrackGraphics, switchRenderingValues: any) {
      const r = this.renderer;
      const world = r.switchCalculations.transformSwitchParameterToWorld(switchRenderingValues);
      const { maintrack, straightBranch, curvedBranch } = world.branches;
      const { frog, curves, wingRail, switchRail, switchRailEnd } = world.points;
      const st = {
         width: 0,
         color: "",
         cap: "butt" as LineCap,
         join: "miter" as LineJoin,
      };
      for (const rail of RAILS) {
         st.width = rail[0];
         st.color = rail[1];

         g.lineFromTo(maintrack.rails.lower, straightBranch.rails.lower)
            .lineFromTo(straightBranch.rails.upper, frog).line2Point(curvedBranch.rails.lower)
            .move2Point(maintrack.rails.upper).quadraticCurve2Point(
               curves.upperRail,
               curvedBranch.rails.upper
            )
            .move2Point(maintrack.rails.lower).quadraticCurve2Point(
               curves.lowerRail,
               wingRail.lower
            ).line2Point(wingRail.lowerEnd)
            .lineFromTo(switchRailEnd, wingRail.upper).line2Point(wingRail.upperEnd)
            .stroke(st);

         drawTaperedRailEnd(g, switchRail, switchRailEnd, rail[0], rail[1]);
      }
   }

   renderFourWaySwitch(g: TrackGraphics, switchRenderingValues: any) {
      const r = this.renderer;
      const world = r.switchCalculations.transformSwitchParameterToWorld(switchRenderingValues);
      const { maintrack, straightBranch, curvedBranch, curvedBranch2 } = world.branches;
      const { frog, frog2, curves, wingRail, wingRail2 } = world.points;
      const st = {
         width: 0,
         color: "",
         cap: "butt" as LineCap,
         join: "miter" as LineJoin,
      };

      for (const rail of RAILS) {
         st.width = rail[0];
         st.color = rail[1];

         g.lineFromTo(wingRail2.upperEnd, wingRail2.upper).line2Point(straightBranch.rails.lower)
            .lineFromTo(straightBranch.rails.upper, frog).line2Point(curvedBranch.rails.lower)
            .move2Point(maintrack.rails.upper).quadraticCurve2Point(
               curves.upperRail,
               curvedBranch.rails.upper
            )
            .move2Point(curvedBranch2.rails.lower).quadraticCurve2Point(
               curves.lowerRail2,
               straightBranch.rails.lower
            )
            .move2Point(wingRail2.upper).quadraticCurve2Point(
               curves.lowerRail,
               wingRail.lower
            ).line2Point(wingRail.lowerEnd)
            .lineFromTo(maintrack.rails.upper, wingRail.upper).line2Point(wingRail.upperEnd)
            .lineFromTo(curvedBranch.rails.upper, wingRail2.lower).line2Point(wingRail2.lowerEnd)
            .lineFromTo(wingRail.lowerEnd, wingRail.lower).line2Point(curvedBranch2.rails.lower)
            .lineFromTo(maintrack.rails.lower, frog2).line2Point(curvedBranch2.rails.upper)
            .move2Point(wingRail2.lower).quadraticCurve2Point(curves.upperRail, wingRail.upper)
            .stroke(st);
      }
   }

   renderSwitchUI(sw: Switch) {
      const r = this.renderer;
      const arrowStroke = {
         width: SWITCH_UI_STROKE,
         color: "#333",
         cap: "round" as LineCap,
         join: "miter" as LineJoin,
      };

      const drawArrow = (g: Graphics, length: number, size: number) => {
         g.moveTo(0, 0).lineTo(length, 0).stroke(arrowStroke);
         g.moveTo(length - size, -size / 2).lineTo(length, 0).lineTo(length - size, size / 2).stroke(arrowStroke);
      };

      const rmUi = r.app.renderingManager!;
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
}
