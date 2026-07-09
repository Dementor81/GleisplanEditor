"use strict";

import type { FederatedPointerEvent } from "pixi.js";
import { Application } from "../application.ts";
import { EditorCommitter } from "../editorCommitter.ts";
import type { GenericObject } from "../generic_object.ts";
import { Point } from "../tools.ts";
import { PointerInteractionAttachment } from "./attachPointerInteraction.ts";
import type { PointerInteraction } from "./PointerInteraction.ts";

const MIN_SIZE = 10;

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
      if (Math.abs(w) < MIN_SIZE) w = w < 0 ? -MIN_SIZE : MIN_SIZE;
      if (Math.abs(h) < MIN_SIZE) h = h < 0 ? -MIN_SIZE : MIN_SIZE;

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
