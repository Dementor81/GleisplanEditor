"use strict";

import type { Container, FederatedPointerEvent } from "pixi.js";
import { Application } from "../application.ts";
import { EditorCommitter } from "../editorCommitter.ts";
import { Point } from "../tools.ts";
import type { GenericObject } from "../generic_object.ts";
import { PointerInteractionAttachment } from "./attachPointerInteraction.ts";
import { ElementInteraction } from "./ElementInteraction.ts";

/** Select on tap, move on drag for platform/text objects. Owns its full lifecycle. */
export class GenericObjectInteraction extends ElementInteraction {
   #offset: Point;

   constructor(private obj: GenericObject, private container: any, start: Point) {
      super(start);
      this.#offset = new Point(start.x - container.x, start.y - container.y);
   }

   protected onTap(_local: Point, e: FederatedPointerEvent): void {
      Application.getInstance().selectObject(this.obj, e);
   }

   protected override onDragStart(): void {
      Application.getInstance().renderingManager!.canvas.style.cursor = "move";
   }

   protected override onDrag(local: Point): void {
      const rm = Application.getInstance().renderingManager!;
      this.container.x = local.x - this.#offset.x;
      this.container.y = local.y - this.#offset.y;
      this.#syncPosFromContainer();
      rm.renderer.updateSelection();
   }

   protected override onDragEnd(): void {
      this.#syncPosFromContainer();
      EditorCommitter.commit();
   }

   #syncPosFromContainer(): void {
      this.obj.pos({ x: this.container.x, y: this.container.y });
   }

   /** Wire a GenericObject container so its pointerdown starts a GenericObjectInteraction. */
   static attach(container: Container, obj: GenericObject): void {
      PointerInteractionAttachment.attach(container, ({ start }) => new GenericObjectInteraction(obj, container, start));
   }
}
