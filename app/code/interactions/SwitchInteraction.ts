"use strict";

import type { Container, FederatedPointerEvent } from "pixi.js";
import { Application } from "../application.ts";
import { CUSTOM_MOUSE_ACTION } from "../config.ts";
import type { Point } from "../tools.ts";
import { Switch } from "../switch.ts";
import type { PointerInteraction } from "./PointerInteraction.ts";

/** Click the switch UI arrows to toggle branch direction. */
export class SwitchInteraction implements PointerInteraction {
   constructor(private sw: Switch) {}

   onMove(_local: Point, _e: FederatedPointerEvent): void {}

   onUp(local: Point, _e: FederatedPointerEvent): void {
      const rm = Application.getInstance().renderingManager!;
      Switch.switch_A_Switch(this.sw, local.x);
      rm.renderer.renderSwitchUI(this.sw);
      rm.update();
   }

   static attach(container: Container, sw: Switch): void {
      container.on("pointerdown", (e: FederatedPointerEvent) => {
         const app = Application.getInstance();
         if (app.customMouseMode !== CUSTOM_MOUSE_ACTION.NONE) return;
         if (e.button !== 0) return;
         const rm = app.renderingManager!;
         rm.recordCanvasPointer(e.nativeEvent as MouseEvent);
         app.eventManager!.startInteraction(new SwitchInteraction(sw));
         e.stopPropagation();
      });
   }
}
