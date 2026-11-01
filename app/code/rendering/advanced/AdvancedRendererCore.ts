"use strict";

import { Track } from "../../track.ts";
import { Switch } from "../../switch.ts";
import { Signal } from "../../signal.ts";
import { SignalRenderer } from "../signalRenderer.ts";
import { geometry } from "../../tools.ts";
import { NumberUtils } from "../../utils.ts";
import { ui } from "../../ui.ts";
import { CONFIG } from "../../config.ts";
import { Application } from "../../application.ts";
import { createLayerContainer } from "../../pixiUtils.ts";
import { RailwayCrossing } from "../../railway_crossing.ts";
import { railwayCrossingRenderer } from "../RailwayCrossingRenderer.ts";
import type { AdvancedRendering } from "./AdvancedRendering.ts";

export class AdvancedRendererCore {
   constructor(readonly renderer: AdvancedRendering) {}

   cleanUp() {
      const r = this.renderer;
      if (r._idleCallback) {
         if (typeof (window as any).requestIdleCallback === "function") cancelIdleCallback(r._idleCallback);
         else clearTimeout(r._idleCallback);
      }

      const myIdleCallback =
         (typeof (window as any).requestIdleCallback === "function" ? (window as any).requestIdleCallback : null) ||
         function (callback: any) {
            return setTimeout(callback, 1);
         };

      r._idleCallback = myIdleCallback(
         () => {
            const rm = r.app.renderingManager!;
            const tracks = rm.containers.tracks;
            const renderedTracks: Set<any> | undefined = tracks.renderedTracks;
            const renderedSwitches: Set<any> | undefined = tracks.renderedSwitches;
            if ((!renderedTracks?.size && !renderedSwitches?.size) || r._rendering != null) return;
            const bounds = this.calcCanvasSize();

            const removeBoundChildren = (parent: any, domain: unknown) => {
               for (const child of parent.children.filter((c: any) => rm.getGameObjFromDisplayObj(c) === domain)) {
                  parent.removeChild(child);
               }
            };

            for (const track of renderedTracks ?? []) {
               if (this.TrackVisible(track, bounds)) continue;
               renderedTracks!.delete(track);
               removeBoundChildren(tracks.children[0], track);
               removeBoundChildren(tracks.children[2], track);
            }

            for (const sw of renderedSwitches ?? []) {
               if (this.SwitchVisible(sw, bounds)) continue;
               renderedSwitches!.delete(sw);
               removeBoundChildren(tracks.children[0], sw);
               removeBoundChildren(tracks.children[2], sw);
               removeBoundChildren(rm.containers.ui, sw);
            }

            r._idleCallback = null;
         }
      );
   }

   calcCanvasSize() {
      const vp = this.renderer.app.renderingManager!.viewport;
      const canvas = this.renderer.app.renderingManager!.canvas;
      const width = (canvas.width + CONFIG.GRID_SIZE * 2) / vp.scale.x,
         height = (canvas.height + CONFIG.GRID_SIZE * 2) / vp.scale.y,
         x = (-vp.x - CONFIG.GRID_SIZE) / vp.scale.x,
         y = (-vp.y - CONFIG.GRID_SIZE) / vp.scale.y;
      return { left: x, top: y, right: x + width, bottom: y + height };
   }

   redraw(force: boolean, render_outside_viewport: boolean) {
      const r = this.renderer;
      // Wait for the preloader to load before rendering
      // mostly the case on slow internet connections
      if (!Application.getInstance().preLoader!.loaded)
         setTimeout(() => {
            r.reDrawEverything(force, render_outside_viewport);
         }, 500);
      else {
         if (r._rendering == undefined) {
            try {
               r._rendering = { render_outside_viewport: render_outside_viewport };
               r._rendering.screen_rectangle = this.calcCanvasSize();

               if (force) {
                  r.app.renderingManager!.containers.removeAllChildren();
                  r.calcRenderValues();
               } else {
                  if (NumberUtils.between(r.LOD, r._lastRenderScale, r.app.renderingManager!.viewport.scale.x)) {
                     r._rendering.lodChanged = true;
                  }
               }

               try {
                  this.renderAllTracks(force);
                  if (force) {
                     this.renderAllCrossings();
                     this.renderAllSignals();
                     r.renderAllTrains();
                     r.genericElements.renderAllGenericObjects();
                  }
                  r._lastRenderScale = r.app.renderingManager!.viewport.scale.x;
                  if (!render_outside_viewport) this.cleanUp();
               } catch (error) {
                  console.error("Error during rendering:", error);
                  throw error;
               } finally {
                  delete r._rendering;
                  r.app.renderingManager!.update();
               }
            } catch (error) {
               console.error("Critical rendering error:", error);
               ui.showErrorToast(error as any);
               delete r._rendering;
               throw error;
            }
         }
      }
   }

   renderAllSignals() {
      const rm = this.renderer.app.renderingManager!;
      rm.containers.signals.removeChildren();
      Signal.signalsForRendering().forEach((signal: any) => {
         let container = rm.containers.signals.addChild(SignalRenderer.createSignalContainer(rm, signal));
         this.renderer.app.alignSignalContainerWithTrack(container, signal._positioning);
      });
      railwayCrossingRenderer.renderStreetSigns(rm);
   }

   /**
    * Render all tracks
    * @param force - Force redraw, ignores cached items, used when when user changes something, should only be false on pan/zoom
    */
   renderAllTracks(force?: boolean) {
      const r = this.renderer;
      const containers = r.app.renderingManager!.containers;
      if (force) {
         containers.tracks.addChild(r._rendering.sleepers_container = createLayerContainer("global_sleepers"));
         containers.tracks.addChild(r._rendering.crossings_container = createLayerContainer("global_crossings"));
         containers.tracks.addChild(r._rendering.rails_container = createLayerContainer("global_rails"));
         containers.tracks.renderedTracks = new Set();
         containers.tracks.renderedSwitches = new Set();
      } else {
         r._rendering.sleepers_container = containers.tracks.children[0];
         r._rendering.crossings_container = containers.tracks.children[1];
         r._rendering.rails_container = containers.tracks.children[2];
      }

      for (const sw of Switch.allSwitches) {
         if (!Switch.isCompleteForRendering(sw)) continue;
         if (this.SwitchVisible(sw)) {
            if (force || !containers.tracks.renderedSwitches.has(sw)) {
               r.switchRendering.renderSwitch(sw);
               containers.tracks.renderedSwitches.add(sw);
               r.app.renderingManager!.stats.itemsDrawn++;
            } else if (r._rendering.lodChanged) {
               r.switchRendering.updateSwitch(sw);
            }
         }
      }

      for (const t of Track.allTracks) {
         if (this.TrackVisible(t)) {
            if (force || !containers.tracks.renderedTracks.has(t)) {
               r.trackRendering.renderTrack(t);
               containers.tracks.renderedTracks.add(t);
               r.app.renderingManager!.stats.itemsDrawn++;
            } else if (r._rendering.lodChanged) {
               r.trackRendering.updateTrack(t);
            }
         }
      }
   }

   renderAllCrossings() {
      const r = this.renderer;
      const container = r._rendering.crossings_container;
      container.removeChildren();

      RailwayCrossing.allCrossings.forEach((crossing) => {
         container.addChild(railwayCrossingRenderer.createDisplay(r.app.renderingManager!, crossing));
      });
   }

   PointVisible(p1: any, screen_rectangle = this.renderer._rendering?.screen_rectangle) {
      if (!screen_rectangle) return false;

      return (
         NumberUtils.between(p1.x, screen_rectangle.left, screen_rectangle.right) &&
         NumberUtils.between(p1.y, screen_rectangle.top, screen_rectangle.bottom)
      );
   }

   TrackVisible(track: any, screen_rectangle = this.renderer._rendering.screen_rectangle) {
      const r = this.renderer;
      if (r._rendering?.render_outside_viewport) return true;

      const isInside = (point: any, rect: any) =>
         point.x > rect.left && point.x < rect.right && point.y > rect.top && point.y < rect.bottom;

      if (isInside(track.start, screen_rectangle) || isInside(track.end, screen_rectangle)) return true;

      let p1 = { x: screen_rectangle.left, y: screen_rectangle.top },
         p2 = { x: screen_rectangle.left, y: screen_rectangle.bottom };
      if (geometry.doLineSegmentsIntersect(p1, p2, track.start, track.end)) return true;
      p1 = p2;
      p2 = { x: screen_rectangle.right, y: screen_rectangle.bottom };
      if (geometry.doLineSegmentsIntersect(p1, p2, track.start, track.end)) return true;
      p1 = p2;
      p2 = { x: screen_rectangle.right, y: screen_rectangle.top };
      if (geometry.doLineSegmentsIntersect(p1, p2, track.start, track.end)) return true;

      return false;
   }

   SwitchVisible(sw: any, screen_rectangle = this.renderer._rendering.screen_rectangle) {
      const r = this.renderer;
      if (r._rendering?.render_outside_viewport) return true;

      if (this.PointVisible(sw.location, screen_rectangle)) return true;

      const tracks = [sw.track1, sw.track2, sw.track3, sw.track4].filter((t: any) => t);
      return tracks.some((track: any) => this.TrackVisible(track, screen_rectangle));
   }
}
