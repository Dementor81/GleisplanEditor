"use strict";

import type { FederatedPointerEvent, Graphics } from "pixi.js";
import { Application } from "../application.ts";
import type { Point } from "../tools.ts";
import { gleisGraphics } from "../pixiPrimitives.ts";
import type { DrawingPanel } from "../ui/DrawingPanel.ts";
import type { PointerInteraction } from "./PointerInteraction.ts";

/** Freehand stroke on the drawing layer (draw tool mode). */
export class DrawingInteraction implements PointerInteraction {
   readonly planLockPolicy = "block" as const;
   readonly #shape: Graphics;
   #lastDraw: Point;
   readonly #stroke: { width: number; color: string; cap: "round"; join: "round" };

   constructor(start: Point, panel: DrawingPanel) {
      const rm = Application.getInstance().renderingManager!;
      this.#shape = gleisGraphics();
      rm.containers.drawing.addChild(this.#shape);
      this.#lastDraw = start;
      this.#stroke = {
         width: panel.getStrokeWidth(),
         color: panel.getStrokeColor(),
         cap: "round",
         join: "round",
      };
   }

   onMove(local: Point, _e: FederatedPointerEvent): void {
      this.#shape.moveTo(this.#lastDraw.x, this.#lastDraw.y).lineTo(local.x, local.y).stroke(this.#stroke);
      this.#lastDraw = local;
   }

   onUp(_local: Point, _e: FederatedPointerEvent): void {}
}
