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
import { TrackRenderingBase } from "../TrackRenderingBase.ts";
import { SCHWELLEN_VARIANTEN, TRACK_SCALE } from "./constants.ts";

export abstract class AdvancedRendererCore extends TrackRenderingBase {
   LOD: number;
   _lastRenderScale: number;
   _bitmapCache: any[];
   _idleCallback: any;
   _rendering: any;

   schwellenImg: any;
   bumperImg: any;
   sleepersImgWidth: number = 0;
   schwellenHöhe: number = 0;
   schwellenHöhe_2: number = 0;
   schwellenBreite: number = 0;
   schwellenGap: number = 0;
   sleeperIntervall: number = 0;
   rail_offset: number = 0;
   rail_distance: number = 0;
   TRAIN_HEIGHT: number = 0;

   constructor() {
      super();
      this.LOD = 2;
      this._lastRenderScale = 0;
      this._bitmapCache = new Array(SCHWELLEN_VARIANTEN);
   }

   cleanUp() {
      if (this._idleCallback) {
         if (typeof (window as any).requestIdleCallback === "function") cancelIdleCallback(this._idleCallback);
         else clearTimeout(this._idleCallback);
      }

      const myIdleCallback =
         (typeof (window as any).requestIdleCallback === "function" ? (window as any).requestIdleCallback : null) ||
         function (callback: any) {
            return setTimeout(callback, 1);
         };

      this._idleCallback = myIdleCallback(
         () => {
            if (this.app.renderingManager!.containers.tracks.renderedTracks.size == 0 || this._rendering != null) return;
            const bounds = this.calcCanvasSize();

            const toBeRemoved: any[] = [];
            this.app.renderingManager!.containers.tracks.renderedTracks.forEach((track: any) => {
               if (!this.TrackVisible(track, bounds)) {
                  toBeRemoved.push(track);
               }
            });

            const rm = this.app.renderingManager!;
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

            this._idleCallback = null;
         }
      );
   }

   calcCanvasSize() {
      const vp = this.app.renderingManager!.viewport;
      const canvas = this.app.renderingManager!.canvas;
      const width = (canvas.width + CONFIG.GRID_SIZE * 2) / vp.scale.x,
         height = (canvas.height + CONFIG.GRID_SIZE * 2) / vp.scale.y,
         x = (-vp.x - CONFIG.GRID_SIZE) / vp.scale.x,
         y = (-vp.y - CONFIG.GRID_SIZE) / vp.scale.y;
      return { left: x, top: y, right: x + width, bottom: y + height };
   }

   reDrawEverything(force = false, render_outside_viewport = false) {
      if (!Application.getInstance().preLoader!.loaded)
         setTimeout(() => {
            this.reDrawEverything(force, render_outside_viewport);
         }, 500);
      else {
         if (this._rendering == undefined) {
            try {
               this._rendering = { render_outside_viewport: render_outside_viewport };
               this._rendering.screen_rectangle = this.calcCanvasSize();

               if (force) {
                  this.app.renderingManager!.containers.removeAllChildren();
                  this.calcRenderValues();
               } else {
                  if (NumberUtils.between(this.LOD, this._lastRenderScale, this.app.renderingManager!.viewport.scale.x)) {
                     this._rendering.lodChanged = true;
                  }
               }

               try {
                  this.renderAllTracks(force);
                  this.renderAllSignals();
                  this.renderAllTrains();
                  this.renderAllGenericObjects();
                  this._lastRenderScale = this.app.renderingManager!.viewport.scale.x;
                  if (!render_outside_viewport) this.cleanUp();
               } catch (error) {
                  console.error("Error during rendering:", error);
                  throw error;
               } finally {
                  delete this._rendering;
                  this.app.renderingManager!.update();
               }
            } catch (error) {
               console.error("Critical rendering error:", error);
               ui.showErrorToast(error as any);
               delete this._rendering;
               throw error;
            }
         }
      }
   }

   calcRenderValues() {
      this.schwellenImg = this.app.preLoader!.getImage("schwellen");
      this.bumperImg = this.app.preLoader!.getImage("bumper");
      this.sleepersImgWidth = this.schwellenImg.width / SCHWELLEN_VARIANTEN;
      this.schwellenHöhe = this.schwellenImg.height * TRACK_SCALE;
      this.schwellenHöhe_2 = this.schwellenHöhe / 2;
      this.schwellenBreite = this.sleepersImgWidth * TRACK_SCALE;
      this.schwellenGap = this.schwellenBreite * 1.1;
      this.sleeperIntervall = this.schwellenBreite + this.schwellenGap;
      this.rail_offset = this.schwellenHöhe / 4.7;
      this.rail_distance = this.schwellenHöhe_2 - this.rail_offset;

      this.TRAIN_HEIGHT = this.schwellenHöhe - this.rail_offset;

      this.SIGNAL_DISTANCE_FROM_TRACK = this.schwellenHöhe / 2;
   }

   protected trainCarHeight(): number {
      return this.TRAIN_HEIGHT;
   }

   renderAllSignals() {
      const rm = this.app.renderingManager!;
      rm.containers.signals.removeChildren();
      Signal.allSignals.forEach((signal: any) => {
         let container = rm.containers.signals.addChild(SignalRenderer.createSignalContainer(rm, signal));
         this.app.alignSignalContainerWithTrack(container, signal._positioning);
      });
   }

   renderAllTracks(force?: boolean) {
      const containers = this.app.renderingManager!.containers;
      if (force) {
         containers.tracks.addChild(this._rendering.sleepers_container = createLayerContainer("global_sleepers"));
         containers.tracks.addChild(this._rendering.rails_container = createLayerContainer("global_rails"));
         containers.tracks.renderedTracks = new Set();
         containers.tracks.renderedSwitches = new Set();
      } else {
         this._rendering.sleepers_container = containers.tracks.children[0];
         this._rendering.rails_container = containers.tracks.children[1];
      }

      for (const sw of Switch.allSwitches) {
         if (this.SwitchVisible(sw)) {
            if (force || !containers.tracks.renderedSwitches.has(sw)) {
               this.renderSwitch(sw);
               containers.tracks.renderedSwitches.add(sw);
            } else if (this._rendering.lodChanged) {
               this.updateSwitch(sw);
            }
         }
      }

      for (const t of Track.allTracks) {
         if (this.TrackVisible(t)) {
            if (force || !containers.tracks.renderedTracks.has(t)) {
               this.renderTrack(t);
               containers.tracks.renderedTracks.add(t);
            } else if (this._rendering.lodChanged) {
               this.updateTrack(t);
            }
         }
      }
   }

   PointVisible(p1: any) {
      const screen_rectangle = this._rendering.screen_rectangle;

      return (
         NumberUtils.between(p1.x, screen_rectangle.left, screen_rectangle.right) &&
         NumberUtils.between(p1.y, screen_rectangle.top, screen_rectangle.bottom)
      );
   }

   TrackVisible(track: any, screen_rectangle = this._rendering.screen_rectangle) {
      if (this._rendering?.render_outside_viewport) return true;

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
      if (this._rendering?.render_outside_viewport) return true;
      const screen_rectangle = this._rendering.screen_rectangle;

      if (this.PointVisible(sw.location)) return true;

      const tracks = [sw.track1, sw.track2, sw.track3, sw.track4].filter((t: any) => t);
      return tracks.some((track: any) => this.TrackVisible(track, screen_rectangle));
   }

   protected abstract renderTrack(track: any): void;
   protected abstract updateTrack(track: any): void;
   protected abstract renderSwitch(sw: any): void;
   protected abstract updateSwitch(sw: any): void;
}
