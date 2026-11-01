"use strict";

import { Application } from "../application.ts";
import { CONFIG } from "../config.ts";
import { geometry } from "../tools.ts";
import { GenericObject } from "../generic_object.ts";
import { PlatformResizeInteraction } from "../interactions/PlatformResizeInteraction.ts";
import { RailwayCrossing } from "../railway_crossing.ts";
import type { Switch } from "../switch.ts";
import { gleisGraphics, polygonHitArea, rectHitArea, TrackGraphics } from "../pixiPrimitives.ts";
import { TrackEndpointInteraction } from "../interactions/TrackEndpointInteraction.ts";
import { TrainRenderer } from "./TrainRenderer.ts";

/** Shared state and public surface used outside the rendering package for both track renderers. */
export abstract class TrackRenderingBase {
   readonly app: Application;
   SIGNAL_DISTANCE_FROM_TRACK = 0;
   readonly #trainRenderer = new TrainRenderer();

   protected constructor() {
      this.app = Application.getInstance();
   }

   reDrawEverything(force = false, render_outside_viewport = false): void {
      const stats = this.app.renderingManager!.stats;
      stats.beginRedraw(force);
      try {
         this.redraw(force, render_outside_viewport);
      } finally {
         stats.endRedraw();
      }
   }

   protected abstract redraw(force: boolean, render_outside_viewport: boolean): void;

   /**
    * React to a pan/zoom change without rebuilding unchanged content.
    * The scene is retained-mode and lives in world space under the viewport container,
    * so moving the camera only requires a re-render (plus incremental culling in advanced mode).
    */
   abstract onViewportChanged(): void;

   abstract renderAllGenericObjects(): void;
   abstract renderAllSignals(): void;
   abstract renderSwitchUI(sw: Switch): void;

   /** Car body height in layout units (basic vs advanced scale). */
   protected abstract trainCarHeight(): number;

   /** Visible world rect plus one grid cell of padding, used for viewport culling in both renderers. */
   viewportRenderRect(): { left: number; top: number; right: number; bottom: number } {
      const rm = this.app.renderingManager!;
      const vp = rm.viewport;
      const canvas = rm.canvas;
      const width = (canvas.width + CONFIG.GRID_SIZE * 2) / vp.scale.x;
      const height = (canvas.height + CONFIG.GRID_SIZE * 2) / vp.scale.y;
      const x = (-vp.x - CONFIG.GRID_SIZE) / vp.scale.x;
      const y = (-vp.y - CONFIG.GRID_SIZE) / vp.scale.y;
      return { left: x, top: y, right: x + width, bottom: y + height };
   }

   pointInRect(p: { x: number; y: number }, rect: { left: number; top: number; right: number; bottom: number }): boolean {
      return p.x > rect.left && p.x < rect.right && p.y > rect.top && p.y < rect.bottom;
   }

   trackInRect(track: any, rect: { left: number; top: number; right: number; bottom: number }): boolean {
      if (this.pointInRect(track.start, rect) || this.pointInRect(track.end, rect)) return true;

      let p1 = { x: rect.left, y: rect.top };
      let p2 = { x: rect.left, y: rect.bottom };
      if (geometry.doLineSegmentsIntersect(p1, p2, track.start, track.end)) return true;
      p1 = p2;
      p2 = { x: rect.right, y: rect.bottom };
      if (geometry.doLineSegmentsIntersect(p1, p2, track.start, track.end)) return true;
      p1 = p2;
      p2 = { x: rect.right, y: rect.top };
      return geometry.doLineSegmentsIntersect(p1, p2, track.start, track.end);
   }

   switchInRect(sw: any, rect: { left: number; top: number; right: number; bottom: number }): boolean {
      if (this.pointInRect(sw.location, rect)) return true;
      const tracks = [sw.track1, sw.track2, sw.track3, sw.track4].filter((t: any) => t);
      return tracks.some((track: any) => this.trackInRect(track, rect));
   }

   /** Remove every direct child of `parent` bound to `domain` (one rendered track/switch). */
   protected removeBoundDisplayObjects(parent: any, domain: unknown): void {
      const rm = this.app.renderingManager!;
      for (const child of parent.children.filter((c: any) => rm.getGameObjFromDisplayObj(c) === domain)) {
         parent.removeChild(child);
      }
   }

   renderAllTrains(): void {
      this.#trainRenderer.renderAllTrains(this.app.renderingManager!, this.trainCarHeight());
   }

   /** Advanced layout uses sleepers under `tracks.children[0]`; basic attaches graphics directly to `tracks`. */
   protected trackDisplayObjectsForSelection(): any[] {
      const tracks = this.app.renderingManager!.containers.tracks as any;
      if (tracks.children[0]?.label === "global_sleepers") {
         return tracks.children[0].children as any[];
      }
      return tracks.children as any[];
   }

   protected crossingDisplayObjectsForSelection(): any[] {
      const tracks = this.app.renderingManager!.containers.tracks as any;
      if (tracks.children[1]?.label === "global_crossings") {
         return tracks.children[1].children as any[];
      }
      return tracks.children.filter((child: any) => this.app.renderingManager!.getGameObjFromDisplayObj(child) instanceof RailwayCrossing);
   }

   updateSelection(): void {
      const rmSel = this.app.renderingManager!;
      rmSel.containers.selection.removeChildren();

      if (this.app.selection.type == "Track") {
         for (const c of this.trackDisplayObjectsForSelection()) {
            const d = rmSel.getGameObjFromDisplayObj(c);
            if (d != null && this.app.selection.isSelectedObject(d)) {
               this.visualizeTrackBounds(c);
               if (!this.app.planLocked) this.drawTrackEndpoints(d);
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
            if (d != null && this.app.selection.isSelectedObject(d)) {
               this.visualizeTrackBounds(c);
               if (
                  !this.app.planLocked &&
                  d instanceof GenericObject &&
                  (d.type() === GenericObject.OBJECT_TYPE.plattform ||
                     d.type() === GenericObject.OBJECT_TYPE.text)
               ) {
                  this.drawPlatformResizeHandle(c, d);
               }
            }
         });
      } else if (this.app.selection.type == "RailwayCrossing") {
         for (const c of this.crossingDisplayObjectsForSelection()) {
            const d = rmSel.getGameObjFromDisplayObj(c);
            if (d != null && this.app.selection.isSelectedObject(d)) this.visualizeTrackBounds(c);
         }
      }
      rmSel.update();
   }

   protected createEndpointShape(point: any, track: any, endpointType: string) {
      const RECT_SIZE = 8;
      const shape = new TrackGraphics("track_endpoint");
      this.app.renderingManager!.bindGameObjToDisplayObj(shape, { track, endpoint: endpointType });

      shape.hitArea = rectHitArea(point.x - RECT_SIZE / 2, point.y - RECT_SIZE / 2, RECT_SIZE, RECT_SIZE);
      TrackEndpointInteraction.attach(shape, track, endpointType as "start" | "end");

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

   protected drawPlatformResizeHandle(container: any, obj: GenericObject) {
      const HANDLE_SIZE = 8;
      const bounds = container.getBounds();
      const vp = this.app.renderingManager!.viewport;
      const corner = vp.toLocal({ x: bounds.x + bounds.width, y: bounds.y + bounds.height });

      const p1 = { x: corner.x - HANDLE_SIZE, y: corner.y };
      const p2 = { x: corner.x, y: corner.y };
      const p3 = { x: corner.x, y: corner.y - HANDLE_SIZE };

      const shape = new TrackGraphics("platform_resize");
      this.app.renderingManager!.bindGameObjToDisplayObj(shape, obj);
      shape.hitArea = polygonHitArea([p1, p2, p3]);
      PlatformResizeInteraction.attach(shape, obj);

      shape
         .moveTo(p1.x, p1.y)
         .lineTo(p2.x, p2.y)
         .lineTo(p3.x, p3.y)
         .closePath()
         .fill("#aa0000")
         .stroke({ width: 0.1, color: "#111111", cap: "round", join: "round" });

      this.app.renderingManager!.containers.selection.addChild(shape);
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
         .dashedRect(localBounds.x, localBounds.y, localBounds.width, localBounds.height)
         .stroke({ width: 1, color: "#000000", cap: "round", join: "round" });

      this.app.renderingManager!.containers.selection.addChild(boundsShape);
   }
}
