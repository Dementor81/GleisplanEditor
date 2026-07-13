"use strict";

import type { FederatedPointerEvent } from "pixi.js";
import { Application } from "../application.ts";
import { INPUT } from "../config.ts";
import { geometry, Point } from "../tools.ts";
import type { PlanLockPolicy, PointerInteraction } from "./PointerInteraction.ts";

/** Base for element-owned interactions: handles the tap-vs-drag threshold once. */
export abstract class ElementInteraction implements PointerInteraction {
   readonly planLockPolicy: PlanLockPolicy = "selectOnly";
   protected dragging = false;

   constructor(protected start: Point) {}

   onMove(local: Point, e: FederatedPointerEvent): void {
      if (!this.dragging && geometry.distance(this.start, local) > INPUT.MOUSE_MOVEMENT_THRESHOLD) {
         const app = Application.getInstance();
         if (app.planLocked && this.planLockPolicy === "selectOnly") return;
         this.dragging = true;
         this.onDragStart(local, e);
      }
      if (this.dragging) this.onDrag(local, e);
   }

   onUp(local: Point, e: FederatedPointerEvent): void {
      if (this.dragging) this.onDragEnd(local, e);
      else this.onTap(local, e);
   }

   protected onDragStart(_local: Point, _e: FederatedPointerEvent): void {}
   protected onDrag(_local: Point, _e: FederatedPointerEvent): void {}
   protected onDragEnd(_local: Point, _e: FederatedPointerEvent): void {}
   protected abstract onTap(local: Point, e: FederatedPointerEvent): void;
}
