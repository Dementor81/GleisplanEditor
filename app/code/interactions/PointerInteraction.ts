"use strict";

import type { FederatedPointerEvent } from "pixi.js";
import type { Point } from "../tools.ts";

export type PlanLockPolicy = "allow" | "selectOnly" | "block";

/** A single, self-contained pointer interaction that owns its own move/up logic. */
export interface PointerInteraction {
   readonly planLockPolicy?: PlanLockPolicy;
   onMove(local: Point, event: FederatedPointerEvent): void;
   onUp(local: Point, event: FederatedPointerEvent): void;
}
