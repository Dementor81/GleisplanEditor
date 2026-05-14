"use strict";

// ES6 Module imports
import { Track } from '../track.ts';
import { Switch } from '../switch.ts';
import { Signal } from '../signal.ts';
import { SignalRenderer } from './signalRenderer.ts';
import { GenericObject } from '../generic_object.ts';
import { geometry } from '../tools.ts';
import { CONFIG } from '../config.ts';
import type { Graphics } from 'pixi.js';
import { gleisGraphics, polygonHitArea, TrackGraphics } from '../pixiPrimitives.ts';
import { Text } from 'pixi.js';
import { createLayerContainer } from '../pixiUtils.ts';
import { TrackRenderingBase } from './TrackRenderingBase.ts';

export class trackRendering_basic extends TrackRenderingBase {
   static TRACK_COLOR = "#111111";
   static SWITCH_UI_COLOR = "gray";
   static SWITCH_UI_COLOR_SELECTED = "#eee";
   static STROKE = 6;
   static HIT_TEST_DISTANCE = 10;
   static BUMPER_SIZE = 8;
   static SWITCH_SIZE = 30;

   constructor() {
      super();
      this.SIGNAL_DISTANCE_FROM_TRACK = 18;
   }

   protected trainCarHeight(): number {
      return CONFIG.GRID_SIZE * 0.65;
   }

   reDrawEverything(_force?: boolean, _render_outside_viewport?: boolean) {
      
      this.app.renderingManager!.containers.removeAllChildren();

      this.renderAllTracks();
      this.renderAllSwitches();
      this.renderAllGenericObjects();
      this.renderAllSignals();
      this.renderAllTrains();
      this.app.renderingManager!.update();
   }

   renderAllSignals() {
      const rm = this.app.renderingManager!;
      rm.containers.signals.removeChildren();
      Signal.allSignals.forEach((signal: any) => {
         let container = rm.containers.signals.addChild(SignalRenderer.createSignalContainer(rm, signal));
         this.app.alignSignalContainerWithTrack(container, signal._positioning);
      });
   }

   renderAllTracks() {
      Track.allTracks.forEach((t) => {
         this.renderTrack(this.app.renderingManager!.containers.tracks, t);
      });
   }

   renderAllGenericObjects() {
      this.app.renderingManager!.containers.objects.removeChildren();
      GenericObject.all_objects.forEach((o: any) => {
         const c = createLayerContainer("GenericObject");
         this.app.renderingManager!.bindGameObjToDisplayObj(c, o);
         c.interactiveChildren = false;
         c.x = o.pos().x;
         c.y = o.pos().y;

         if (o.type() === GenericObject.OBJECT_TYPE.text) this.renderTextObject(o, c);
         else if (o.type() === GenericObject.OBJECT_TYPE.plattform) this.renderPlattformObject(o, c);
         else throw new Error("Unknown Object");

         this.app.renderingManager!.containers.objects.addChild(c);
      });
   }

   renderTextObject(text_object: any, container: any) {
      var text = new Text({
         text: text_object.content(),
         style: { fill: "#000000", fontFamily: "Arial", fontSize: 20 },
      });
      text.eventMode = "static";
      const height = text.height;
      const width = text.width;

      text.hitArea = polygonHitArea([{ x: 0, y: 0 }, { x: width, y: 0 }, { x: width, y: -height }, { x: 0, y: -height }]);

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
      let corr_start = track.start,
         corr_end = track.end;
      let bumper_start: any, bumper_end: any;

      if (!track.switchAtTheStart && track.hasBumper) {
         //prellbock beim start
         const B1 = track.start.add(geometry.perpendicular(track.unit).multiply(-trackRendering_basic.BUMPER_SIZE));
         const B2 = track.start.add(geometry.perpendicular(track.unit).multiply(trackRendering_basic.BUMPER_SIZE));
         bumper_start = [B1, B2];
      } else if (track.switchAtTheStart instanceof Switch) {
         corr_start = track.along(track.switchAtTheStart.location, track.switchAtTheStart.size);
      }

      if (!track.switchAtTheEnd && track.hasBumper) {
         //prellbock beim ende
         const B1 = track.end.add(geometry.perpendicular(track.unit).multiply(-trackRendering_basic.BUMPER_SIZE));
         const B2 = track.end.add(geometry.perpendicular(track.unit).multiply(trackRendering_basic.BUMPER_SIZE));
         bumper_end = [B1, B2];
      } else if (track.switchAtTheEnd instanceof Switch) {
         corr_end = track.along(track.switchAtTheEnd.location, -track.switchAtTheEnd.size);
      }

      const p1 = corr_start.add(geometry.perpendicular(track.unit).multiply(-trackRendering_basic.HIT_TEST_DISTANCE));
      const p2 = corr_start.add(geometry.perpendicular(track.unit).multiply(trackRendering_basic.HIT_TEST_DISTANCE));
      const p3 = corr_end.add(geometry.perpendicular(track.unit).multiply(trackRendering_basic.HIT_TEST_DISTANCE));
      const p4 = corr_end.add(geometry.perpendicular(track.unit).multiply(-trackRendering_basic.HIT_TEST_DISTANCE));
      return {
         hit_area: [p1, p2, p3, p4],
         bumper: [bumper_start, bumper_end],
         start: corr_start,
         end: corr_end,
      };
   }

   renderTrack(container: any, track: Track) {
      let params = this.calculateTrackDrawingParameters(track);
      let shape = new TrackGraphics("track");
      this.app.renderingManager!.bindGameObjToDisplayObj(shape, track);

      shape.hitArea = polygonHitArea(params.hit_area);

      container.addChild(shape);

      const trackStroke = {
         width: trackRendering_basic.STROKE,
         color: trackRendering_basic.TRACK_COLOR,
         cap: "round" as const,
         join: "round" as const,
      };
      shape.moveTo(params.start.x, params.start.y).lineTo(params.end.x, params.end.y).stroke(trackStroke);
      if (params.bumper[0]) {
         shape
            .moveTo(params.bumper[0][0].x, params.bumper[0][0].y)
            .lineTo(params.bumper[0][1].x, params.bumper[0][1].y)
            .stroke(trackStroke);
      }

      if (params.bumper[1]) {
         shape
            .moveTo(params.bumper[1][0].x, params.bumper[1][0].y)
            .lineTo(params.bumper[1][1].x, params.bumper[1][1].y)
            .stroke(trackStroke);
      }
      shape.setBounds(
         params.start.x - trackRendering_basic.HIT_TEST_DISTANCE,
         params.start.y - trackRendering_basic.HIT_TEST_DISTANCE,
         params.end.x - params.start.x + trackRendering_basic.HIT_TEST_DISTANCE * 2,
         params.end.y - params.start.y + trackRendering_basic.HIT_TEST_DISTANCE * 2
      );

      return shape;
   }

   static drawTriangle(graphics: Graphics, color: string, p1: any, p2: any, p3: any) {
      graphics.moveTo(p1.x, p1.y).lineTo(p2.x, p2.y).lineTo(p3.x, p3.y).closePath().fill(color);
   }

   renderAllSwitches() {
      Switch.allSwitches.forEach((sw) => {
         if (!sw.track1 || !sw.track2 || !sw.track3 || (sw.type == Switch.SWITCH_TYPE.DKW && !sw.track4)) {
            console.log(sw);
            throw new Error("switch is falty");
         }
         let switch_shape = new TrackGraphics("switch");
         this.app.renderingManager!.bindGameObjToDisplayObj(switch_shape, sw);
         this.app.renderingManager!.containers.tracks.addChild(switch_shape);

         const swStroke = {
            width: trackRendering_basic.STROKE,
            color: trackRendering_basic.TRACK_COLOR,
            cap: "round" as const,
            join: "round" as const,
         };

         const maxTracks = sw.type == Switch.SWITCH_TYPE.DKW ? 4 : 3;
         for (let i = 0; i < maxTracks; i++) {
            if (sw.track_directions[i]) {
               let end_point = sw.getBranchEndPoint(i);
               switch_shape.moveTo(sw.location.x, sw.location.y).lineTo(end_point.x, end_point.y).stroke(swStroke);
            }
         }

         let p1: any, p2: any;

         p1 = sw.getBranchEndPoint(1, trackRendering_basic.SWITCH_SIZE);
         p2 = sw.getBranchEndPoint(2, trackRendering_basic.SWITCH_SIZE);
         if (p1 && p2) {
            trackRendering_basic.drawTriangle(switch_shape, "black", sw.location, p1, p2);
         }

         if (sw.type == Switch.SWITCH_TYPE.DKW) {
            p1 = sw.getBranchEndPoint(0, trackRendering_basic.SWITCH_SIZE);
            p2 = sw.getBranchEndPoint(3, trackRendering_basic.SWITCH_SIZE);
            if (p1 && p2) {
               trackRendering_basic.drawTriangle(switch_shape, "black", sw.location, p1, p2);
            }
         }

         this.renderSwitchUI(sw);
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
         container.interactiveChildren = false;
         rm.containers.ui.addChild(container);
      }

      const ui_shape = gleisGraphics();
      container.addChild(ui_shape);

      const uiStroke = {
         width: trackRendering_basic.STROKE / 2,
         cap: "round" as const,
         join: "round" as const,
      };

      const draw_line = function (t: number, color: string) {
         let p1 = sw.getBranchEndPoint(t, trackRendering_basic.SWITCH_SIZE);
         let p0 = sw.getBranchEndPoint(t, trackRendering_basic.SWITCH_SIZE / 2);
         ui_shape.moveTo(p0.x, p0.y).lineTo(p1.x, p1.y).stroke({ ...uiStroke, color });
      };

      sw.tracks.forEach((t, i) => {
         if (t)
            draw_line(
               i,
               t === sw.from || t === sw.branch
                  ? trackRendering_basic.SWITCH_UI_COLOR_SELECTED
                  : trackRendering_basic.SWITCH_UI_COLOR
            );
      });
   }
}




