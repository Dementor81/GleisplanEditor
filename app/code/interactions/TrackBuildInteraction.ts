"use strict";

import type { FederatedPointerEvent, Graphics } from "pixi.js";
import { Application } from "../application.ts";
import { COLORS, CONFIG } from "../config.ts";
import { EditorCommitter } from "../editorCommitter.ts";
import { geometry, Point } from "../tools.ts";
import { ArrayUtils } from "../utils.ts";
import { Track } from "../track.ts";
import { Train } from "../train.ts";
import { gleisGraphics } from "../pixiPrimitives.ts";
import { BasicRendering } from "../rendering/BasicRendering.ts";
import { PointerInteractionAttachment } from "./attachPointerInteraction.ts";
import { ElementInteraction } from "./ElementInteraction.ts";
/** Tap to select/deselect; drag to place new track nodes on the grid. */
export class TrackBuildInteraction extends ElementInteraction {
   #nodes: Point[] = [];
   #lineShape: Graphics | null = null;

   constructor(start: Point, private track: Track | null) {
      super(start);
   }

   protected onTap(_local: Point, e: FederatedPointerEvent): void {
      const app = Application.getInstance();
      if (this.track) app.selectObject(this.track, e);
      else app.selectObject();
   }

   protected override onDragStart(local: Point): void {
      const rm = Application.getInstance().renderingManager!;
      this.#nodes = [];
      this.#addAnchor(Track.snapToGrid(local));
      this.#lineShape = gleisGraphics();
      rm.containers.overlay.addChild(this.#lineShape);
   }

   protected override onDrag(local: Point): void {
      const gridSnap = Track.snapToGrid(local);
      let valid = Track.isValidTrackNodePoint(gridSnap, this.#nodes);

      if (geometry.distance(local, gridSnap) <= CONFIG.SNAP_TO_GRID) {
         const existingIndex = this.#nodes.findIndex((node) => node.equals(gridSnap));
         if (existingIndex !== -1) {
            this.#nodes = this.#nodes.slice(0, existingIndex + 1);
         } else if (valid) {
            this.#addAnchor(gridSnap);
         } else {
            valid = false;
         }
      }

      this.#drawBlueprint(!valid);
   }

   protected override onDragEnd(): void {
      const rm = Application.getInstance().renderingManager!;
      if (this.#nodes.length > 0) {
         Track.checkNodesAndCreateTracks(this.#nodes);
         Track.createRailNetwork();
         Train.allTrains.forEach((t) => t.restore());
         rm.renderer.reDrawEverything(true);
         EditorCommitter.commit();
      }
      if (this.#lineShape) rm.containers.overlay.removeChild(this.#lineShape);
      rm.update();
   }

   #addAnchor(p: Point): void {
      this.#nodes.push(p);
   }

   #drawBlueprint(invalid: boolean): void {
      if (!this.#lineShape || this.#nodes.length === 0) return;
      const shape = this.#lineShape;
      shape.clear();

      const blueprintStroke = {
         width: BasicRendering.STROKE,
         color: COLORS.DRAWING_BLUEPRINT,
         cap: "round" as const,
         join: "round" as const,
      };
      shape.moveTo(this.#nodes[0].x, this.#nodes[0].y);
      for (let index = 1; index < this.#nodes.length; index++) {
         const point = this.#nodes[index];
         shape.lineTo(point.x, point.y);
      }
      shape.stroke(blueprintStroke);

      const last = ArrayUtils.last(this.#nodes)!;
      const p = Point.fromPoint(Application.getInstance().renderingManager!.viewportPointerLocal());
      shape
         .moveTo(last.x, last.y)
         .lineTo(p.x, p.y)
         .stroke({
            width: BasicRendering.STROKE,
            color: invalid ? COLORS.DRAWING_INVALID : COLORS.DRAWING_ACTIVE,
            cap: "round",
            join: "round",
         });
   }

   static attach(container: any, track: Track): void {
      PointerInteractionAttachment.attach(container, ({ start }) => new TrackBuildInteraction(start, track));
   }
}
