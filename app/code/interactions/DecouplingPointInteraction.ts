"use strict";

import type { FederatedPointerEvent } from "pixi.js";
import { Application } from "../application.ts";
import { CUSTOM_MOUSE_ACTION } from "../config.ts";
import { Point } from "../tools.ts";
import { Train } from "../train.ts";
import type { PointerInteraction } from "./PointerInteraction.ts";

/** Tap a decoupling overlay point to split a train. */
export class DecouplingPointInteraction implements PointerInteraction {
   constructor(private data: any) {}

   onMove(_local: Point, _e: FederatedPointerEvent): void {}

   onUp(_local: Point, _e: FederatedPointerEvent): void {
      Train.handleDecouplingClick(this.data);
   }

   static attach(container: any): void {
      container.on("pointerdown", (e: FederatedPointerEvent) => {
         const app = Application.getInstance();
         if (app.customMouseMode !== CUSTOM_MOUSE_ACTION.TRAIN_DECOUPLE) return;
         if (e.button !== 0) return;
         const rm = app.renderingManager!;
         rm.recordCanvasPointer(e.nativeEvent as MouseEvent);
         const data = rm.getGameObjFromDisplayObj(container);
         app.eventManager!.startInteraction(new DecouplingPointInteraction(data));
         e.stopPropagation();
      });
   }
}
