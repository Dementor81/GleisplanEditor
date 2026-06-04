"use strict";

import type { FederatedPointerEvent } from "pixi.js";
import { Application } from "../application.ts";
import { CUSTOM_MOUSE_ACTION } from "../config.ts";
import { STORAGE } from "../storage.ts";
import type { Point } from "../tools.ts";
import { GenericObject } from "../generic_object.ts";
import type { PointerInteraction } from "./PointerInteraction.ts";

/** Place a new text label on pointer up (text tool mode). */
export class TextPlaceInteraction implements PointerInteraction {
   onMove(): void {}

   onUp(local: Point, _e: FederatedPointerEvent): void {
      const app = Application.getInstance();
      const o = new GenericObject(GenericObject.OBJECT_TYPE.text);
      o.pos(local);
      o.content("Text");
      GenericObject.all_objects.push(o);
      app.selectObject(o);
      app.renderingManager!.renderer.renderAllGenericObjects();
      app.customMouseMode = CUSTOM_MOUSE_ACTION.NONE;
      STORAGE.saveUndoHistory();
      STORAGE.save();
   }
}
