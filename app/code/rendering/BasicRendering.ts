"use strict";

// ES6 Module imports
import { Track } from '../track.ts';
import { Switch } from '../switch.ts';
import { Signal } from '../signal.ts';
import { SignalRenderer } from './signalRenderer.ts';
import { GenericObject } from '../generic_object.ts';
import { RailwayCrossing } from '../railway_crossing.ts';
import { geometry } from '../tools.ts';
import { CONFIG } from '../config.ts';
import { gleisGraphics, polygonHitArea, rectHitArea, TrackGraphics } from '../pixiPrimitives.ts';
import { Text } from 'pixi.js';
import { TrackBuildInteraction } from '../interactions/TrackBuildInteraction.ts';
import { createLayerContainer } from '../pixiUtils.ts';
import { TrackRenderingBase } from './TrackRenderingBase.ts';
import { GenericObjectInteraction } from '../interactions/GenericObjectInteraction.ts';
import { railwayCrossingRenderer } from './RailwayCrossingRenderer.ts';
import { SwitchInteraction } from '../interactions/SwitchInteraction.ts';

export class BasicRendering extends TrackRenderingBase {
   static TRACK_COLOR = "#111111";
   static SWITCH_UI_COLOR = "gray";
   static SWITCH_UI_COLOR_SELECTED = "#eee";
   static STROKE = 6;
   static HIT_TEST_DISTANCE = 10;
   static BUMPER_SIZE = 8;
   static SWITCH_SIZE = 30;

   constructor() {
      super();
      this.SIGNAL_DISTANCE_FROM_TRACK = 8;
   }

   protected trainCarHeight(): number {
      return CONFIG.GRID_SIZE * 0.65;
   }

   protected redraw(force: boolean, render_outside_viewport: boolean) {
      const containers = this.app.renderingManager!.containers;
      if (force) {
         containers.removeAllChildren();
         containers.tracks.renderedTracks = new Set();
         containers.tracks.renderedSwitches = new Set();
         this.renderAllCrossings();
      }

      this.renderAllTracks(force, render_outside_viewport);
      this.renderAllSwitches(force, render_outside_viewport);
      if (!render_outside_viewport) this.#cullOffScreenTracksAndSwitches();

      if (force) {
         this.renderAllGenericObjects();
         this.renderAllSignals();
         this.renderAllTrains();
      }
      this.app.renderingManager!.update();
   }

   /**
    * Like advanced mode, a pan/zoom only adds newly visible tracks/switches and culls
    * off-screen ones; signals, trains and objects are rebuilt on forced redraws only.
    */
   onViewportChanged(): void {
      this.reDrawEverything(false);
   }

   #cullOffScreenTracksAndSwitches(): void {
      const rm = this.app.renderingManager!;
      const tracks = rm.containers.tracks;
      if (!(tracks.renderedTracks instanceof Set)) return;
      const rect = this.viewportRenderRect();

      for (const track of tracks.renderedTracks) {
         if (this.trackInRect(track, rect)) continue;
         tracks.renderedTracks.delete(track);
         this.removeBoundDisplayObjects(tracks, track);
      }
      for (const sw of tracks.renderedSwitches) {
         if (this.switchInRect(sw, rect)) continue;
         tracks.renderedSwitches.delete(sw);
         this.removeBoundDisplayObjects(tracks, sw);
         this.removeBoundDisplayObjects(rm.containers.ui, sw);
      }
   }

   renderAllSignals() {
      const rm = this.app.renderingManager!;
      rm.containers.signals.removeChildren();
      Signal.signalsForRendering().forEach((signal: any) => {
         let container = rm.containers.signals.addChild(SignalRenderer.createSignalContainer(rm, signal));
         this.app.alignSignalContainerWithTrack(container, signal._positioning);
      });
      railwayCrossingRenderer.renderStreetSigns(rm);
   }

   renderAllTracks(force = false, render_outside_viewport = false) {
      const tracks = this.app.renderingManager!.containers.tracks;
      const rendered: Set<any> = (tracks.renderedTracks ??= new Set());
      const rect = render_outside_viewport ? null : this.viewportRenderRect();
      Track.allTracks.forEach((t) => {
         if (rect && !this.trackInRect(t, rect)) return;
         if (!force && rendered.has(t)) return;
         this.renderTrack(tracks, t);
         rendered.add(t);
         this.app.renderingManager!.stats.itemsDrawn++;
      });
   }

   renderAllCrossings() {
      const container = this.app.renderingManager!.containers.tracks;
      RailwayCrossing.allCrossings.forEach((crossing) => {
         container.addChild(railwayCrossingRenderer.createDisplay(this.app.renderingManager!, crossing));
      });
   }

   renderAllGenericObjects() {
      this.app.renderingManager!.containers.objects.removeChildren();
      GenericObject.all_objects.forEach((o: any) => {
         const c = createLayerContainer("GenericObject");
         this.app.renderingManager!.bindGameObjToDisplayObj(c, o);
         GenericObjectInteraction.attach(c, o);
         c.x = o.pos().x;
         c.y = o.pos().y;

         if (o.type() === GenericObject.OBJECT_TYPE.text) this.renderTextObject(o, c);
         else if (o.type() === GenericObject.OBJECT_TYPE.plattform) this.renderPlattformObject(o, c);
         else throw new Error("Unknown Object");

         this.app.renderingManager!.containers.objects.addChild(c);
      });
   }

   renderTextObject(text_object: any, container: any) {
      const size = text_object.size();
      const hasSize = size.width !== 0 || size.height !== 0;
      const fontSize = hasSize ? Math.abs(size.height) : 20;
      var text = new Text({
         text: text_object.content(),
         style: { fill: text_object.color(), fontFamily: "Arial", fontSize },
      });
      text.eventMode = "static";
      const hitW = hasSize ? Math.abs(size.width) : text.width;
      const hitH = hasSize ? Math.abs(size.height) : text.height;
      text.hitArea = rectHitArea(0, 0, hitW, hitH);
      if (hasSize) {
         const bounds = gleisGraphics();
         bounds.rect(0, 0, hitW, hitH).fill({ color: 0, alpha: 0 });
         container.addChild(bounds);
      }

      container.addChild(text);
   }

   renderPlattformObject(plattform: any, container: any) {
      const shape = gleisGraphics();
      container.addChild(shape);
      const w = plattform.size().width,
         h = plattform.size().height;
      shape.rect(0, 0, w, h).fill("#444").stroke({ width: 1, color: "#111111", cap: "round", join: "round" });

      var text = new Text({
         text: plattform.content(),
         style: { fill: "#eee", fontFamily: "Arial", fontSize: 20 },
      });
      text.eventMode = "static";
      text.anchor.set(0.5);
      text.x = plattform.size().width / 2;
      text.y = plattform.size().height / 2;

      container.addChild(text);
   }

   calculateTrackDrawingParameters(track: Track): any {
      let bumper_start: any, bumper_end: any;

      const perpendicular = geometry.perpendicular(track.unit);

      if (!track.switchAtTheStart && track.hasBumper) {
         //prellbock beim start
         const B1 = track.start.add(perpendicular.multiply(-BasicRendering.BUMPER_SIZE));
         const B2 = track.start.add(perpendicular.multiply(BasicRendering.BUMPER_SIZE));
         bumper_start = [B1, B2];
      }

      if (!track.switchAtTheEnd && track.hasBumper) {
         //prellbock beim ende
         const B1 = track.end.add(perpendicular.multiply(-BasicRendering.BUMPER_SIZE));
         const B2 = track.end.add(perpendicular.multiply(BasicRendering.BUMPER_SIZE));
         bumper_end = [B1, B2];
      }

      const p1 = track.start.add(perpendicular.multiply(-BasicRendering.HIT_TEST_DISTANCE));
      const p2 = track.start.add(perpendicular.multiply(BasicRendering.HIT_TEST_DISTANCE));
      const p3 = track.end.add(perpendicular.multiply(BasicRendering.HIT_TEST_DISTANCE));
      const p4 = track.end.add(perpendicular.multiply(-BasicRendering.HIT_TEST_DISTANCE));
      return {
         hit_area: [p1, p2, p3, p4],
         bumper: [bumper_start, bumper_end],
         start: track.start,
         end: track.end,
      };
   }

   renderTrack(container: any, track: Track) {
      let params = this.calculateTrackDrawingParameters(track);
      let shape = new TrackGraphics("track");
      this.app.renderingManager!.bindGameObjToDisplayObj(shape, track);

      shape.hitArea = polygonHitArea(params.hit_area);
      TrackBuildInteraction.attach(shape, track);

      container.addChild(shape);

      const trackStroke = {
         width: BasicRendering.STROKE,
         color: BasicRendering.TRACK_COLOR,
         cap: "round" as const,
         join: "round" as const,
      };
      shape.lineFromTo(params.start, params.end).stroke(trackStroke);
      if (params.bumper[0]) {
         shape
            .lineFromTo(params.bumper[0][0], params.bumper[0][1])
            .stroke(trackStroke);
      }

      if (params.bumper[1]) {
         shape
            .lineFromTo(params.bumper[1][0], params.bumper[1][1])
            .stroke(trackStroke);
      }
      shape.setBounds(params.hit_area[0].x, params.hit_area[0].y, params.hit_area[2].x - params.hit_area[0].x, params.hit_area[2].y - params.hit_area[0].y);

      return shape;
   }

   static drawTriangle(g: TrackGraphics, color: string, p1: any, p2: any, p3: any) {
      g.fillPoly([p1, p2, p3], color);
   }

   renderAllSwitches(force = false, render_outside_viewport = false) {
      const tracks = this.app.renderingManager!.containers.tracks;
      const rendered: Set<any> = (tracks.renderedSwitches ??= new Set());
      const rect = render_outside_viewport ? null : this.viewportRenderRect();
      Switch.allSwitches.forEach((sw) => {
         if (!Switch.isCompleteForRendering(sw)) {
            console.warn(`Skipping faulty switch ${sw.id}`);
            return;
         }
         if (rect && !this.switchInRect(sw, rect)) return;
         if (!force && rendered.has(sw)) return;
         let switch_shape = new TrackGraphics("switch");
         switch_shape.eventMode = "none";
         this.app.renderingManager!.bindGameObjToDisplayObj(switch_shape, sw);
         this.app.renderingManager!.containers.tracks.addChild(switch_shape);

         let p1: any, p2: any;

         p1 = sw.location.add(sw.track_directions[1]!.multiply(BasicRendering.SWITCH_SIZE));
         p2 = sw.location.add(sw.track_directions[2]!.multiply(BasicRendering.SWITCH_SIZE));
         if (p1 && p2) {
            switch_shape.fillPoly([sw.location, p1, p2], "black");
         }

         if (sw.type == Switch.SWITCH_TYPE.DKW) {
            p1 = sw.location.add(sw.track_directions[0]!.multiply(BasicRendering.SWITCH_SIZE));
            p2 = sw.location.add(sw.track_directions[3]!.multiply(BasicRendering.SWITCH_SIZE));
            if (p1 && p2) {
               switch_shape.fillPoly([sw.location, p1, p2], "black");
            }
         }

         this.renderSwitchUI(sw);
         rendered.add(sw);
         this.app.renderingManager!.stats.itemsDrawn++;
      });
   }

   renderSwitchUI(sw: Switch) {
      const rm = this.app.renderingManager!;
      // Check if a container already exists for this switch
      let container = rm.containers.ui.children.find((c: any) => rm.getGameObjFromDisplayObj(c) === sw);

      if (container) {
         // If container exists, clear it but keep it
         container.removeChildren();
      } else {
         // Create a new container if none exists
         container = createLayerContainer("switch");
         rm.bindGameObjToDisplayObj(container, sw);
         container.interactiveChildren = true;
         SwitchInteraction.attach(container, sw);
         rm.containers.ui.addChild(container);
      }

      const ui_shape = gleisGraphics();
      container.addChild(ui_shape);

      const uiStroke = {
         width: BasicRendering.STROKE / 2,
         cap: "round" as const,
         join: "round" as const,
      };

      const draw_line = function (t: number, color: string) {
         let p0 = sw.location.add(sw.track_directions[t]!.multiply(10));
         let p1 = p0.add(sw.track_directions[t]!.multiply(15));
         ui_shape.moveTo(p0.x, p0.y).lineTo(p1.x, p1.y).stroke({ ...uiStroke, color });
      };

      sw.tracks.forEach((t, i) => {
         if (t)
            draw_line(
               i,
               t === sw.from || t === sw.branch
                  ? BasicRendering.SWITCH_UI_COLOR_SELECTED
                  : BasicRendering.SWITCH_UI_COLOR
            );
      });
   }
}




