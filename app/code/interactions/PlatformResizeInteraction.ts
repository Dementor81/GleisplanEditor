"use strict";

import type { FederatedPointerEvent } from "pixi.js";
import { Application } from "../application.ts";
import { EditorCommitter } from "../editorCommitter.ts";
import { GenericObject } from "../generic_object.ts";
import { Point } from "../tools.ts";
import { PointerInteractionAttachment } from "./attachPointerInteraction.ts";
import type { PointerInteraction } from "./PointerInteraction.ts";

/** Drag the lower-right corner of a platform to resize it. */
export class PlatformResizeInteraction implements PointerInteraction {
   constructor(private obj: GenericObject) {}

   onMove(local: Point, _e: FederatedPointerEvent): void {
      const rm = Application.getInstance().renderingManager!;
      rm.canvas.style.cursor = "nwse-resize";

      const { x, y } = this.obj.pos();
      const { width, height } = this.obj.size();
      const tl = { x: Math.min(x, x + width), y: Math.min(y, y + height) };

      let w = local.x - tl.x;
      let h = local.y - tl.y;
      const min = GenericObject.MIN_PLATFORM_SIZE;
      if (Math.abs(w) < min) w = w < 0 ? -min : min;
      if (Math.abs(h) < min) h = h < 0 ? -min : min;

      this.obj.pos(tl);
      this.obj.size(w, h);
      rm.renderer.renderAllGenericObjects();
      rm.renderer.updateSelection();
      rm.update();
   }

   onUp(_local: Point, _e: FederatedPointerEvent): void {
      Application.getInstance().renderingManager!.canvas.style.cursor = "";
      EditorCommitter.commit();
   }

   static attach(container: any, obj: GenericObject): void {
      PointerInteractionAttachment.attach(container, () => new PlatformResizeInteraction(obj));
   }
}
