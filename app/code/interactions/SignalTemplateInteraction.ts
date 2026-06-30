"use strict";

import type { Container, FederatedPointerEvent } from "pixi.js";
import { Application } from "../application.ts";
import { Point } from "../tools.ts";
import { Signal } from "../signal.ts";
import { SignalRenderer } from "../rendering/signalRenderer.ts";
import type { PointerInteraction } from "./PointerInteraction.ts";
import { SignalDragCommitter, SignalDragState } from "./signalDrag.ts";

/** Drag a new signal from the template palette onto the plan. */
export class SignalTemplateInteraction implements PointerInteraction {
   readonly signal: any;
   readonly container: Container;
   readonly #drag: SignalDragState;

   constructor(template: any, start: Point) {
      const app = Application.getInstance();
      const rm = app.renderingManager!;
      this.signal = new Signal(template);
      this.container = SignalRenderer.createSignalContainer(rm, this.signal, false);
      this.container.x = start.x;
      this.container.y = start.y;
      rm.containers.overlay.addChild(this.container);
      this.#drag = new SignalDragState(this.container, new Point(0, 0));
   }

   onMove(local: Point, e: FederatedPointerEvent): void {
      this.#drag.update(local, e.altKey);
      Application.getInstance().renderingManager!.update();
   }

   onUp(_local: Point, _e: FederatedPointerEvent): void {
      const rm = Application.getInstance().renderingManager!;
      SignalDragCommitter.commit(this.signal, this.container, this.#drag);
      rm.update();
   }
}
