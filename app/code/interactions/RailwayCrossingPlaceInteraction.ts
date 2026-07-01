"use strict";

import type { FederatedPointerEvent } from "pixi.js";
import { Application } from "../application.ts";
import { CUSTOM_MOUSE_ACTION } from "../config.ts";
import { EditorCommitter } from "../editorCommitter.ts";
import { RailwayCrossing } from "../railway_crossing.ts";
import { Point } from "../tools.ts";
import type { Track } from "../track.ts";
import type { PointerInteraction } from "./PointerInteraction.ts";

export class RailwayCrossingPlaceInteraction implements PointerInteraction {
   constructor(private anchorTrack: Track | null = null) {}

   onMove(): void {}

   onUp(local: Point, _event: FederatedPointerEvent): void {
      const track = this.anchorTrack ?? RailwayCrossing.findNearestTrack(local);
      if (!track) return;

      const crossing = RailwayCrossing.createAt(track, local);
      if (!crossing) return;

      const app = Application.getInstance();
      RailwayCrossing.allCrossings.push(crossing);
      app.selectObject(crossing);
      app.customMouseMode = CUSTOM_MOUSE_ACTION.NONE;
      app.renderingManager!.renderer.reDrawEverything(true);
      app.renderingManager!.renderer.updateSelection();
      EditorCommitter.commit();
   }
}
