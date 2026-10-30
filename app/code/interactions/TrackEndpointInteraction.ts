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

      const moved = this.endpoint === "start" ? this.track.start : this.track.end;
      if (geometry.distance(local, gridSnap) <= CONFIG.SNAP_TO_GRID && !gridSnap.equals(moved)) {
         const [start, end] = this.endpoint === "start" ? [gridSnap, this.track.end] : [this.track.start, gridSnap];
         // Tracks always run from left to right (bottom to top if vertical) and must keep a length.
         if (start.x < end.x || (start.x === end.x && start.y < end.y)) {
            let startShift = 0;
            if (this.endpoint === "start") startShift = this.track.setNewStart(gridSnap);
            else this.track.setNewEnd(gridSnap);
            Track.refreshConnections();
            RailwayCrossing.refreshAfterTrackGeometryChange(this.track, startShift);
            rm.renderer.reDrawEverything(true);
         }
      }

      rm.update();
   }

   /** Tracks are only split or joined once the endpoint is released, so the dragged track stays valid while moving. */
   onUp(_local: Point, _e: FederatedPointerEvent): void {
      const rm = Application.getInstance().renderingManager!;
      Track.createRailNetwork();
      rm.renderer.reDrawEverything(true);
      rm.update();
      EditorCommitter.commit();
   }

   static attach(container: any, track: Track, endpoint: "start" | "end"): void {
      PointerInteractionAttachment.attach(container, () => new TrackEndpointInteraction(track, endpoint));
   }
}
