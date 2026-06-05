"use strict";

import type { FederatedPointerEvent } from "pixi.js";
import { Application } from "../application.ts";
import { STORAGE } from "../storage.ts";
import type { Point } from "../tools.ts";
import type { PointerInteraction } from "./PointerInteraction.ts";

/** Right-button drag to pan the viewport. */
export class ViewportScrollInteraction implements PointerInteraction {
   onMove(_local: Point, e: FederatedPointerEvent): void {
      Application.getInstance().renderingManager?.scroll(e.movementX, e.movementY);
   }

   onUp(_local: Point, _e: FederatedPointerEvent): void {
      STORAGE.save();
   }
}
