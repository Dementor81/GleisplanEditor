"use strict";

import type { FederatedPointerEvent } from "pixi.js";
import { CUSTOM_MOUSE_ACTION } from "../config.ts";
import type { Point } from "../tools.ts";
import { Train } from "../train.ts";
import { PointerInteractionAttachment } from "./attachPointerInteraction.ts";
import type { PointerInteraction } from "./PointerInteraction.ts";

/** Tap a coupling overlay point to join two trains. */
export class CouplingPointInteraction implements PointerInteraction {
   readonly planLockPolicy = "allow" as const;

   constructor(private data: any) {}

   onMove(_local: Point, _e: FederatedPointerEvent): void {}

   onUp(_local: Point, _e: FederatedPointerEvent): void {
      Train.handleCouplingClick(this.data);
   }

   static attach(container: any): void {
      PointerInteractionAttachment.attach(
         container,
         ({ app }) => new CouplingPointInteraction(app.renderingManager!.getGameObjFromDisplayObj(container)),
         { mode: CUSTOM_MOUSE_ACTION.TRAIN_COUPLE }
      );
   }
}
