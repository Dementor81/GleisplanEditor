"use strict";

import type { Container, FederatedPointerEvent } from "pixi.js";
import { Application } from "../application.ts";
import { CUSTOM_MOUSE_ACTION } from "../config.ts";
import { STORAGE } from "../storage.ts";
import { Point } from "../tools.ts";
import { Signal } from "../signal.ts";
import { ElementInteraction } from "./ElementInteraction.ts";
import { SignalDragState } from "./signalDrag.ts";

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
      const app = Application.getInstance();
      const rm = app.renderingManager!;
      this.#drag.clearPositionLine();

      rm.containers.overlay.removeChild(this.container);

      if (this.#drag.hitTrack) {
         rm.containers.signals.addChild(this.container);
         this.#drag.hitTrack.track.AddSignal(
            this.signal,
            this.#drag.hitTrack.km,
            this.#drag.hitTrack.above,
            this.#drag.hitTrack.flipped
         );
         rm.renderer.renderAllSignals();
         rm.renderer.updateSelection();
      } else {
         Signal.removeSignal(this.signal);
         rm.renderer.reDrawEverything(true);
      }

      STORAGE.save();
      STORAGE.saveUndoHistory();
   }

   static attach(container: Container, signal: any): void {
      container.on("pointerdown", (e: FederatedPointerEvent) => {
         const app = Application.getInstance();
         if (app.customMouseMode !== CUSTOM_MOUSE_ACTION.NONE) return;
         if (e.button !== 0) return;
         const rm = app.renderingManager!;
         rm.recordCanvasPointer(e.nativeEvent as MouseEvent);
         const start = Point.fromPoint(rm.viewportPointerLocal());
         app.eventManager!.startInteraction(new SignalInteraction(signal, container, start));
         e.stopPropagation();
      });
   }
}
