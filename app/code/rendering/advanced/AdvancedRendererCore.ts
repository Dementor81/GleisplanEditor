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
            if (r.app.renderingManager!.containers.tracks.renderedTracks.size == 0 || r._rendering != null) return;
            const bounds = this.calcCanvasSize();

            const toBeRemoved: any[] = [];
            r.app.renderingManager!.containers.tracks.renderedTracks.forEach((track: any) => {
               if (!this.TrackVisible(track, bounds)) {
                  toBeRemoved.push(track);
               }
            });

            const rm = r.app.renderingManager!;
            toBeRemoved.forEach((track) => {
               const signalsToBeRemoved = rm.containers.signals.children.filter((cs: any) => {
                  const sig = rm.getGameObjFromDisplayObj(cs) as any;
                  return sig?._positioning?.track === track;
               });
               signalsToBeRemoved.forEach((cs: any) => {
                  rm.containers.signals.removeChild(cs);
               });
               rm.containers.tracks.renderedTracks.delete(track);

               const sleepersToRemove = rm.containers.tracks.children[0].children.filter((c: any) => rm.getGameObjFromDisplayObj(c) === track);
               const railsToRemove = rm.containers.tracks.children[1].children.filter((c: any) => rm.getGameObjFromDisplayObj(c) === track);

               sleepersToRemove.forEach((c: any) => {
                  rm.containers.tracks.children[0].removeChild(c);
               });

               railsToRemove.forEach((c: any) => {
                  rm.containers.tracks.children[1].removeChild(c);
               });
            });

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

   reDrawEverything(force = false, render_outside_viewport = false) {
      const r = this.renderer;
      if (!Application.getInstance().preLoader!.loaded)
         setTimeout(() => {
            this.reDrawEverything(force, render_outside_viewport);
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
                  this.renderAllSignals();
                  r.renderAllTrains();
                  r.genericElements.renderAllGenericObjects();
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
      Signal.allSignals.forEach((signal: any) => {
         let container = rm.containers.signals.addChild(SignalRenderer.createSignalContainer(rm, signal));
         this.renderer.app.alignSignalContainerWithTrack(container, signal._positioning);
      });
   }

   renderAllTracks(force?: boolean) {
      const r = this.renderer;
      const containers = r.app.renderingManager!.containers;
      if (force) {
         containers.tracks.addChild(r._rendering.sleepers_container = createLayerContainer("global_sleepers"));
         containers.tracks.addChild(r._rendering.rails_container = createLayerContainer("global_rails"));
         containers.tracks.renderedTracks = new Set();
         containers.tracks.renderedSwitches = new Set();
      } else {
         r._rendering.sleepers_container = containers.tracks.children[0];
         r._rendering.rails_container = containers.tracks.children[1];
      }

      for (const sw of Switch.allSwitches) {
         if (this.SwitchVisible(sw)) {
            if (force || !containers.tracks.renderedSwitches.has(sw)) {
               r.switchRendering.renderSwitch(sw);
               containers.tracks.renderedSwitches.add(sw);
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
            } else if (r._rendering.lodChanged) {
               r.trackRendering.updateTrack(t);
            }
         }
      }
   }

   PointVisible(p1: any) {
      const screen_rectangle = this.renderer._rendering.screen_rectangle;

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

   SwitchVisible(sw: any) {
      const r = this.renderer;
      if (r._rendering?.render_outside_viewport) return true;
      const screen_rectangle = r._rendering.screen_rectangle;

      if (this.PointVisible(sw.location)) return true;

      const tracks = [sw.track1, sw.track2, sw.track3, sw.track4].filter((t: any) => t);
      return tracks.some((track: any) => this.TrackVisible(track, screen_rectangle));
   }
}
