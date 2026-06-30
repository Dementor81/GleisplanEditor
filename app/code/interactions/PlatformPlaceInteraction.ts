"use strict";

import type { FederatedPointerEvent } from "pixi.js";
import { Application } from "../application.ts";
import { COLORS, CUSTOM_MOUSE_ACTION } from "../config.ts";
import { EditorCommitter } from "../editorCommitter.ts";
import type { Point } from "../tools.ts";
import { GenericObject } from "../generic_object.ts";
import { gleisGraphics } from "../pixiPrimitives.ts";
import type { PointerInteraction } from "./PointerInteraction.ts";

/** Drag a rectangle on the canvas to place a new platform (platform tool mode). */
export class PlatformPlaceInteraction implements PointerInteraction {
   constructor(private start: Point) {}

   onMove(local: Point, _e: FederatedPointerEvent): void {
      const rm = Application.getInstance().renderingManager!;
      rm.containers.overlay.removeChildren();
      const plat = gleisGraphics();
      plat
         .rect(
            this.start.x,
            this.start.y,
            local.x - this.start.x,
            local.y - this.start.y
         )
         .stroke({ width: 1, color: COLORS.DRAWING_PLATTFORM, cap: "round", join: "round" });
      rm.containers.overlay.addChild(plat);
      rm.update();
   }

   onUp(local: Point, _e: FederatedPointerEvent): void {
      const app = Application.getInstance();
      app.renderingManager!.containers.overlay.removeChildren();
      const o = new GenericObject(GenericObject.OBJECT_TYPE.plattform);
      o.content("Bahnsteig");
      o.pos(this.start);
      o.size(local.x - this.start.x, local.y - this.start.y);
      GenericObject.all_objects.push(o);
      app.renderingManager!.renderer.renderAllGenericObjects();
      app.selectObject(o);
      app.customMouseMode = CUSTOM_MOUSE_ACTION.NONE;
      EditorCommitter.commit();
   }
}
