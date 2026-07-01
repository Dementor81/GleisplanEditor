"use strict";

import type { Container, FederatedPointerEvent } from "pixi.js";
import { Application } from "../application.ts";
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

   static attach(container: Container, crossing: RailwayCrossing): void {
      PointerInteractionAttachment.attach(container, ({ start }) => new RailwayCrossingInteraction(crossing, start));
   }
}
