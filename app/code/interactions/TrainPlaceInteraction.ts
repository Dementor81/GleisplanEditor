"use strict";

import type { FederatedPointerEvent, Graphics } from "pixi.js";
import { Application } from "../application.ts";
import { STORAGE } from "../storage.ts";
import type { Point } from "../tools.ts";
import { Track } from "../track.ts";
import { Train } from "../train.ts";
import { gleisGraphics } from "../pixiPrimitives.ts";
import type { PointerInteraction } from "./PointerInteraction.ts";

/** Drag a train preview from the palette onto a track. */
export class TrainPlaceInteraction implements PointerInteraction {
   readonly planLockPolicy = "allow" as const;
   readonly #preview: Graphics;

   constructor(start: Point) {
      const rm = Application.getInstance().renderingManager!;
      this.#preview = gleisGraphics("trainPreview");
      this.#preview.x = start.x;
      this.#preview.y = start.y;
      this.#preview.roundRect(-20, -8, 40, 16, 4).fill("#333");
      rm.containers.overlay.addChild(this.#preview);
   }

   onMove(local: Point, _e: FederatedPointerEvent): void {
      this.#preview.x = local.x;
      this.#preview.y = local.y;
      Application.getInstance().renderingManager!.update();
   }

   onUp(local: Point, _e: FederatedPointerEvent): void {
      const app = Application.getInstance();
      const rm = app.renderingManager!;
      rm.containers.overlay.removeChild(this.#preview);

      const hit = rm.hitTest(rm.containers.tracks);
      if (hit?.label === "track") {
         const track = rm.getGameObjFromDisplayObj(hit) as Track;
         const hitInfo = app.eventManager!.getHitInfoForSignalPositioning(local);
         if (hitInfo) {
            Train.addTrain(track, 3, hitInfo.km, Train.CAR_TYPES.PASSENGER);
            rm.renderer.renderAllTrains();
            STORAGE.save();
         }
      }

      rm.update();
   }
}
