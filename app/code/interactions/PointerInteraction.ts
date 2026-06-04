"use strict";

import type { FederatedPointerEvent } from "pixi.js";
import type { Point } from "../tools.ts";

/** A single, self-contained pointer interaction that owns its own move/up logic. */
export interface PointerInteraction {
   onMove(local: Point, event: FederatedPointerEvent): void;
   onUp(local: Point, event: FederatedPointerEvent): void;
}
