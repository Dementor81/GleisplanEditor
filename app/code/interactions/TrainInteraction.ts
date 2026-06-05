"use strict";

import type { FederatedPointerEvent } from "pixi.js";
import { Application } from "../application.ts";
import { CUSTOM_MOUSE_ACTION } from "../config.ts";
import { STORAGE } from "../storage.ts";
import { Point } from "../tools.ts";
import { Train } from "../train.ts";
import { ElementInteraction } from "./ElementInteraction.ts";

/** Select on tap, drag to move along track on drag. */
export class TrainInteraction extends ElementInteraction {
   constructor(private train: Train, start: Point) {
      super(start);
   }

   protected onTap(_local: Point, e: FederatedPointerEvent): void {
      Application.getInstance().selectObject(this.train, e);
   }

   protected override onDragStart(): void {
      Application.getInstance().renderingManager!.canvas.style.cursor = "move";
   }

   protected override onDrag(_local: Point, e: FederatedPointerEvent): void {
      const rm = Application.getInstance().renderingManager!;
      Train.moveTrain(this.train, e.movementX);
      rm.renderer.renderAllTrains();
   }

   protected override onDragEnd(): void {
      STORAGE.save();
      STORAGE.saveUndoHistory();
   }

   static attach(container: any, train: Train): void {
      container.on("pointerdown", (e: FederatedPointerEvent) => {
         const app = Application.getInstance();
         if (app.customMouseMode !== CUSTOM_MOUSE_ACTION.NONE) return;
         if (e.button !== 0) return;
         const rm = app.renderingManager!;
         rm.recordCanvasPointer(e.nativeEvent as MouseEvent);
         const start = Point.fromPoint(rm.viewportPointerLocal());
         app.eventManager!.startInteraction(new TrainInteraction(train, start));
         e.stopPropagation();
      });
   }
}
