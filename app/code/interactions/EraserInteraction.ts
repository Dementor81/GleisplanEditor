"use strict";

import type { FederatedPointerEvent } from "pixi.js";
import { Application } from "../application.ts";
import type { Point } from "../tools.ts";
import type { PointerInteraction } from "./PointerInteraction.ts";

/** Erase drawing strokes under the pointer (eraser tool mode). */
export class EraserInteraction implements PointerInteraction {
   readonly planLockPolicy = "block" as const;

   onMove(_local: Point, _e: FederatedPointerEvent): void {
      const rm = Application.getInstance().renderingManager!;
      const drawingContainer = rm.containers.drawing;
      const hit = rm.hitTest(drawingContainer);
      if (hit) {
         drawingContainer.removeChild(hit);
         rm.update();
      }
   }

   onUp(_local: Point, _e: FederatedPointerEvent): void {}
}
