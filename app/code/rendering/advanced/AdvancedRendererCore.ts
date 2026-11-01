"use strict";

import { Track } from "../../track.ts";
import { Switch } from "../../switch.ts";
import { Signal } from "../../signal.ts";
import { SignalRenderer } from "../signalRenderer.ts";
import { NumberUtils } from "../../utils.ts";
import { ui } from "../../ui.ts";
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
      return this.renderer.viewportRenderRect();
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
      return screen_rectangle ? this.renderer.pointInRect(p1, screen_rectangle) : false;
   }

   TrackVisible(track: any, screen_rectangle = this.renderer._rendering.screen_rectangle) {
      if (this.renderer._rendering?.render_outside_viewport) return true;
      return this.renderer.trackInRect(track, screen_rectangle);
   }

   SwitchVisible(sw: any, screen_rectangle = this.renderer._rendering.screen_rectangle) {
      if (this.renderer._rendering?.render_outside_viewport) return true;
      return this.renderer.switchInRect(sw, screen_rectangle);
   }
}
