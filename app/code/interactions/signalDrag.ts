"use strict";

import type { Container, Graphics } from "pixi.js";
import { Application } from "../application.ts";
import { COLORS } from "../config.ts";
import { Point } from "../tools.ts";
import { gleisGraphics } from "../pixiPrimitives.ts";
import { findChildByLabel } from "../pixiUtils.ts";

/** Drag positioning state shared by canvas-signal and template-signal interactions. */
export class SignalDragState {
   hitTrack: any = null;

   constructor(
      readonly container: Container,
      readonly offset: Point
   ) {}

   update(local: Point, altKey: boolean): void {
      const app = Application.getInstance();
      const hit = app.eventManager!.getHitInfoForSignalPositioning(local);

      if (hit) {
         hit.flipped = altKey;
         this.hitTrack = hit;
         app.alignSignalContainerWithTrack(this.container, hit);
      } else {
         this.hitTrack = null;
         this.container.angle = 0;
         this.container.x = local.x - this.offset.x;
         this.container.y = local.y - this.offset.y;
      }
      this.#drawPositionLine();
      app.renderingManager!.renderer.updateSelection();
   }

   #drawPositionLine(): void {
      const overlay = Application.getInstance().renderingManager!.containers.overlay;
      const existing = findChildByLabel(overlay, "SignalPositionLine") as Graphics | null;
      if (existing) overlay.removeChild(existing);

      if (!this.hitTrack) return;

      const point = this.hitTrack.point;
      const shape = gleisGraphics("SignalPositionLine");
      shape
         .moveTo(this.container.x, this.container.y)
         .lineTo(point.x, point.y)
         .stroke({ width: 1, color: COLORS.SIGNAL_POSITION_LINE, cap: "round", join: "round" });
      overlay.addChild(shape);
   }

   clearPositionLine(): void {
      const overlay = Application.getInstance().renderingManager!.containers.overlay;
      const shape = findChildByLabel(overlay, "SignalPositionLine") as Graphics | null;
      if (shape) overlay.removeChild(shape);
   }
}
