"use strict";

import type { Container, FederatedPointerEvent } from "pixi.js";
import { Application } from "../application.ts";
import { CUSTOM_MOUSE_ACTION, type CustomMouseAction } from "../config.ts";
import { Point } from "../tools.ts";
import type { PointerInteraction } from "./PointerInteraction.ts";

type PointerInteractionContext = {
   app: Application;
   event: FederatedPointerEvent;
   start: Point;
};

type AttachPointerInteractionOptions = {
   mode?: CustomMouseAction;
   button?: number;
};

export class PointerInteractionAttachment {
   static attach(
      container: Container,
      createInteraction: (context: PointerInteractionContext) => PointerInteraction,
      options: AttachPointerInteractionOptions = {}
   ): void {
      const mode = options.mode ?? CUSTOM_MOUSE_ACTION.NONE;
      const button = options.button ?? 0;

      container.on("pointerdown", (event: FederatedPointerEvent) => {
         const app = Application.getInstance();
         if (app.customMouseMode !== mode) return;
         if (event.button !== button) return;

         const rm = app.renderingManager!;
         rm.recordCanvasPointer(event.nativeEvent as MouseEvent);
         app.eventManager!.startInteraction(
            createInteraction({
               app,
               event,
               start: Point.fromPoint(rm.viewportPointerLocal()),
            })
         );
         event.stopPropagation();
      });
   }
}
