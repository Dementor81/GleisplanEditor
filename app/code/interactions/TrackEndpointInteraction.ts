"use strict";

import type { FederatedPointerEvent } from "pixi.js";
import { Application } from "../application.ts";
import { CONFIG, CUSTOM_MOUSE_ACTION } from "../config.ts";
import { STORAGE } from "../storage.ts";
import { geometry, Point } from "../tools.ts";
import { Track } from "../track.ts";
import type { PointerInteraction } from "./PointerInteraction.ts";

/** Drag a track endpoint to reposition it on the grid. */
export class TrackEndpointInteraction implements PointerInteraction {
   constructor(
      private track: Track,
      private endpoint: "start" | "end"
   ) {}

   onMove(local: Point, _e: FederatedPointerEvent): void {
      const rm = Application.getInstance().renderingManager!;
      const gridSnap = Track.snapToGrid(local);

      if (geometry.distance(local, gridSnap) <= CONFIG.SNAP_TO_GRID) {
         if (Track.isValidTrackNodePoint(gridSnap, null)) {
            if (this.endpoint === "start") this.track.setNewStart(gridSnap);
            else this.track.setNewEnd(gridSnap);
            Track.createRailNetwork();
            rm.renderer.reDrawEverything(true);
         }
      }

      rm.update();
   }

   onUp(_local: Point, _e: FederatedPointerEvent): void {
      STORAGE.saveUndoHistory();
      STORAGE.save();
   }

   static attach(container: any, track: Track, endpoint: "start" | "end"): void {
      container.on("pointerdown", (e: FederatedPointerEvent) => {
         const app = Application.getInstance();
         if (app.customMouseMode !== CUSTOM_MOUSE_ACTION.NONE) return;
         if (e.button !== 0) return;
         const rm = app.renderingManager!;
         rm.recordCanvasPointer(e.nativeEvent as MouseEvent);
         app.eventManager!.startInteraction(new TrackEndpointInteraction(track, endpoint));
         e.stopPropagation();
      });
   }
}
