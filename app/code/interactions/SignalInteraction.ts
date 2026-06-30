"use strict";

import type { Container, FederatedPointerEvent } from "pixi.js";
import { Application } from "../application.ts";
import { Point } from "../tools.ts";
import { PointerInteractionAttachment } from "./attachPointerInteraction.ts";
import { ElementInteraction } from "./ElementInteraction.ts";
import { SignalDragCommitter, SignalDragState } from "./signalDrag.ts";

/** Select on tap, drag-and-drop reposition on track on drag. */
export class SignalInteraction extends ElementInteraction {
   #drag: SignalDragState;

   constructor(private signal: any, private container: Container, start: Point) {
      super(start);
      this.#drag = new SignalDragState(container, new Point(start.x - container.x, start.y - container.y));
   }

   protected onTap(_local: Point, e: FederatedPointerEvent): void {
      Application.getInstance().selectObject(this.signal, e);
   }

   protected override onDragStart(): void {
      const rm = Application.getInstance().renderingManager!;
      rm.canvas.style.cursor = "move";

      if (this.signal._positioning?.track) {
         this.signal._positioning.track.removeSignal(this.signal);
      }
      this.container.parent?.removeChild(this.container);
      rm.containers.overlay.addChild(this.container);
   }

   protected override onDrag(local: Point, e: FederatedPointerEvent): void {
      this.#drag.update(local, e.altKey);
   }

   protected override onDragEnd(): void {
      SignalDragCommitter.commit(this.signal, this.container, this.#drag);
   }

   static attach(container: Container, signal: any): void {
      PointerInteractionAttachment.attach(container, ({ start }) => new SignalInteraction(signal, container, start));
   }
}
