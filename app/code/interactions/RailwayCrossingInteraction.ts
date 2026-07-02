"use strict";

import type { Container, FederatedPointerEvent } from "pixi.js";
import { Application } from "../application.ts";
import { EditorCommitter } from "../editorCommitter.ts";
import type { RailwayCrossing } from "../railway_crossing.ts";
import { PointerInteractionAttachment } from "./attachPointerInteraction.ts";
import { ElementInteraction } from "./ElementInteraction.ts";
import type { Point } from "../tools.ts";

export class RailwayCrossingInteraction extends ElementInteraction {
   constructor(private crossing: RailwayCrossing, start: Point) {
      super(start);
   }

   protected onTap(_local: Point, event: FederatedPointerEvent): void {
      Application.getInstance().selectObject(this.crossing, event);
   }

   protected override onDragStart(): void {
      Application.getInstance().selectObject(this.crossing);
      Application.getInstance().renderingManager!.canvas.style.cursor = "move";
   }

   protected override onDrag(local: Point): void {
      if (!this.crossing.moveToPointOnAnchorTrack(local)) return;

      const rm = Application.getInstance().renderingManager!;
      rm.renderer.reDrawEverything(true);
      rm.renderer.updateSelection();
      rm.update();
   }

   protected override onDragEnd(): void {
      Application.getInstance().renderingManager!.canvas.style.cursor = "auto";
      EditorCommitter.commit();
   }

   static attach(container: Container, crossing: RailwayCrossing): void {
      PointerInteractionAttachment.attach(container, ({ start }) => new RailwayCrossingInteraction(crossing, start));
   }
}
