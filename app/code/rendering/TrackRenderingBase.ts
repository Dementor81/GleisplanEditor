"use strict";

import { Application } from "../application.ts";
import type { Switch } from "../switch.ts";
import { gleisGraphics, rectHitArea, TrackGraphics } from "../pixiPrimitives.ts";
import { TrainRenderer } from "./TrainRenderer.ts";

/** Shared state and public surface used outside the rendering package for both track renderers. */
export abstract class TrackRenderingBase {
   readonly app: Application;
   SIGNAL_DISTANCE_FROM_TRACK = 0;
   readonly #trainRenderer = new TrainRenderer();

   protected constructor() {
      this.app = Application.getInstance();
   }

   abstract reDrawEverything(force?: boolean, render_outside_viewport?: boolean): void;
   abstract renderAllGenericObjects(): void;
   abstract renderSwitchUI(sw: Switch): void;

   /** Car body height in layout units (basic vs textured track scale). */
   protected abstract trainCarHeight(): number;

   renderAllTrains(): void {
      this.#trainRenderer.renderAllTrains(this.app.renderingManager!, this.trainCarHeight());
   }

   /** Textured layout uses sleepers under `tracks.children[0]`; basic attaches graphics directly to `tracks`. */
   protected trackDisplayObjectsForSelection(): any[] {
      const tracks = this.app.renderingManager!.containers.tracks as any;
      if (tracks.renderedTracks instanceof Set && tracks.children[0]) {
         return tracks.children[0].children as any[];
      }
      return tracks.children as any[];
   }

   updateSelection(): void {
      const rmSel = this.app.renderingManager!;
      rmSel.containers.selection.removeChildren();

      if (this.app.selection.type == "Track") {
         for (const c of this.trackDisplayObjectsForSelection()) {
            const d = rmSel.getGameObjFromDisplayObj(c);
            if (d != null && this.app.selection.isSelectedObject(d)) {
               this.visualizeTrackBounds(c);
               this.drawTrackEndpoints(d);
            }
         }
      } else if (this.app.selection.type == "Signal") {
         rmSel.containers.signals.children.forEach((c: any) => {
            const d = rmSel.getGameObjFromDisplayObj(c);
            if (d != null && this.app.selection.isSelectedObject(d)) this.visualizeTrackBounds(c);
         });
      } else if (this.app.selection.type == "GenericObject") {
         rmSel.containers.objects.children.forEach((c: any) => {
            const d = rmSel.getGameObjFromDisplayObj(c);
            if (d != null && this.app.selection.isSelectedObject(d)) this.visualizeTrackBounds(c);
         });
      }
      rmSel.update();
   }

   protected createEndpointShape(point: any, track: any, endpointType: string) {
      const RECT_SIZE = 8;
      const shape = new TrackGraphics("track_endpoint");
      this.app.renderingManager!.bindGameObjToDisplayObj(shape, { track, endpoint: endpointType });

      shape.hitArea = rectHitArea(point.x - RECT_SIZE / 2, point.y - RECT_SIZE / 2, RECT_SIZE, RECT_SIZE);

      shape
         .rect(point.x - RECT_SIZE / 2, point.y - RECT_SIZE / 2, RECT_SIZE, RECT_SIZE)
         .stroke({ width: 2, color: "#ff0000", cap: "round", join: "round" });

      return shape;
   }

   protected drawTrackEndpoints(track: any) {
      const sel = this.app.renderingManager!.containers.selection;
      sel.addChild(this.createEndpointShape(track.start, track, "start"));
      sel.addChild(this.createEndpointShape(track.end, track, "end"));
   }

   protected visualizeTrackBounds(container: any) {
      const bounds = container.getBounds();
      const object = this.app.renderingManager!.getGameObjFromDisplayObj(container);

      if (bounds == null) throw new Error("Bounds are null");
      const vp = this.app.renderingManager!.viewport;
      const topLeft = vp.toLocal({ x: bounds.x, y: bounds.y });
      const bottomRight = vp.toLocal({ x: bounds.x + bounds.width, y: bounds.y + bounds.height });
      const localBounds = {
         x: topLeft.x,
         y: topLeft.y,
         width: bottomRight.x - topLeft.x,
         height: bottomRight.y - topLeft.y,
      };

      const padding = 5;
      localBounds.x -= padding;
      localBounds.y -= padding;
      localBounds.width += padding * 2;
      localBounds.height += padding * 2;

      const boundsShape = gleisGraphics("selection");
      if (object !== undefined) this.app.renderingManager!.bindGameObjToDisplayObj(boundsShape, object);
      boundsShape.alpha = 0.7;

      boundsShape
         .rect(localBounds.x, localBounds.y, localBounds.width, localBounds.height)
         .stroke({ width: 2, color: "#000000", cap: "round", join: "round" });

      this.app.renderingManager!.containers.selection.addChild(boundsShape);
   }
}
