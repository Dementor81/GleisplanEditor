"use strict";

import type { FederatedPointerEvent } from "pixi.js";
import { CUSTOM_MOUSE_ACTION, type CustomMouseAction } from "../config.ts";
import type { Point } from "../tools.ts";
import { Train } from "../train.ts";
import type { PointerInteraction } from "./PointerInteraction.ts";

/** Click empty space while in couple/decouple mode to cancel. */
export class TrainCoupleModeCancelInteraction implements PointerInteraction {
   constructor(private mode: CustomMouseAction) {}

   onMove(_local: Point, _e: FederatedPointerEvent): void {}

   onUp(_local: Point, _e: FederatedPointerEvent): void {
      if (this.mode === CUSTOM_MOUSE_ACTION.TRAIN_COUPLE) Train.exitCouplingMode();
      else Train.exitDecouplingMode();
   }
}
