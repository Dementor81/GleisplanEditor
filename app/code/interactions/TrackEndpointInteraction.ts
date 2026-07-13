"use strict";

import type { FederatedPointerEvent } from "pixi.js";
import { Application } from "../application.ts";
import { CONFIG } from "../config.ts";
import { EditorCommitter } from "../editorCommitter.ts";
import { geometry, Point } from "../tools.ts";
import { Track } from "../track.ts";
import { RailwayCrossing } from "../railway_crossing.ts";
import { PointerInteractionAttachment } from "./attachPointerInteraction.ts";
import type { PointerInteraction } from "./PointerInteraction.ts";

/** Drag a track endpoint to reposition it on the grid. */
export class TrackEndpointInteraction implements PointerInteraction {
   readonly planLockPolicy = "block" as const;

   constructor(
      private track: Track,
      private endpoint: "start" | "end"
   ) {}

   onMove(local: Point, _e: FederatedPointerEvent): void {
      const rm = Application.getInstance().renderingManager!;
      const gridSnap = Track.snapToGrid(local);

      if (geometry.distance(local, gridSnap) <= CONFIG.SNAP_TO_GRID) {
         if (Track.isValidTrackNodePoint(gridSnap, null)) {
            const oldStart = this.endpoint === "start" ? this.track.start : undefined;
            if (this.endpoint === "start") this.track.setNewStart(gridSnap);
            else this.track.setNewEnd(gridSnap);
            Track.createRailNetwork();
            RailwayCrossing.refreshAfterTrackGeometryChange(this.track, oldStart);
            rm.renderer.reDrawEverything(true);
         }
      }

      rm.update();
   }

   onUp(_local: Point, _e: FederatedPointerEvent): void {
      EditorCommitter.commit();
   }

   static attach(container: any, track: Track, endpoint: "start" | "end"): void {
      PointerInteractionAttachment.attach(container, () => new TrackEndpointInteraction(track, endpoint));
   }
}
