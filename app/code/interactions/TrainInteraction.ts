"use strict";

import type { FederatedPointerEvent } from "pixi.js";
import { Application } from "../application.ts";
import { EditorCommitter } from "../editorCommitter.ts";
import { Point } from "../tools.ts";
import { Train } from "../train.ts";
import { PointerInteractionAttachment } from "./attachPointerInteraction.ts";
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
      EditorCommitter.commit();
   }

   static attach(container: any, train: Train): void {
      PointerInteractionAttachment.attach(container, ({ start }) => new TrainInteraction(train, start));
   }
}
