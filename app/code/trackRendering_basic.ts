"use strict";

// ES6 Module imports
import { Track } from './track.ts';
import { Switch } from './switch.ts';
import { Signal } from './signal.ts';
import { SignalRenderer } from './signalRenderer.ts';
import { GenericObject } from './generic_object.ts';
import { Train } from './train.ts';
import { geometry } from './tools.ts';
import { Application } from './application.ts';
import { CONFIG } from './config.ts';
import { DisplayGroup, LabelText, Sketch, polygonHitArea } from './pixiPrimitives.ts';

export class trackRendering_basic {
   static TRACK_COLOR = "#111111";
   static SWITCH_UI_COLOR = "gray";
   static SWITCH_UI_COLOR_SELECTED = "#eee";
   static STROKE = 6;
   static HIT_TEST_DISTANCE = 10;
   static BUMPER_SIZE = 8;
   static SWITCH_SIZE = 30;

   SIGNAL_DISTANCE_FROM_TRACK: number;
   app: Application;

   constructor() {
      this.SIGNAL_DISTANCE_FROM_TRACK = 18;
      this.app = Application.getInstance();
   }

   reDrawEverything(_force?: boolean, _dont_optimize?: boolean) {
      
      this.app.renderingManager!.containers.removeAllChildren();

      this.renderAllTracks();
      this.renderAllSwitches();
      this.renderAllGenericObjects();
      this.renderAllSignals();
      this.renderAllTrains();
      this.app.renderingManager!.update();
   }

   renderAllTrains() {
      const rm = this.app.renderingManager!;
      rm.containers.trains.removeAllChildren();

      Train.allTrains
         .filter((train: any) => !train.trainCoupledFront)
         .forEach((train: any) => {
            const c = new DisplayGroup("train");
            c.name = "train";
            (c as any).train = train;
            c.interactiveChildren = true;

            this.renderCar(train, c);

            rm.containers.trains.addChild(c);
         });
   }

   renderCar(car: any, container: any) {
      const carWidth = car.length;
      const carHeight = CONFIG.GRID_SIZE * 0.65;
      const corner = car.type == Train.CAR_TYPES.LOCOMOTIVE ? 8 : 1.5;
      const s = new Sketch("train", car);
      s.graphics.setStrokeStyle(1).beginStroke("#000").beginFill(car.color).drawRoundRect(0, 0, carWidth, carHeight, corner);
      s.data = car;
      s.name = "train";

      const p = car.track.getPointFromKm(car.pos);

      s.x = p.x;
      s.y = p.y;
      s.pivot.set(carWidth / 2, carHeight / 2);
      s.angle = car.track.deg;

      container.addChild(s);
      if (car.number && car.type == Train.CAR_TYPES.LOCOMOTIVE) {
         const text = new LabelText(car.number, "10px Arial", "#000000");
         text.anchor.set(0.5);
         text.x = p.x;
         text.y = p.y;
         container.addChild(text);
      }
      if (car.trainCoupledBack) {
         this.renderCar(car.trainCoupledBack, container);
      }
   }

   renderAllSignals() {
      this.app.renderingManager!.containers.signals.removeAllChildren();
      Signal.allSignals.forEach((signal: any) => {
         let container = this.app.renderingManager!.containers.signals.addChild(SignalRenderer.createSignalContainer(signal));
         this.app.alignSignalContainerWithTrack(container, signal._positioning);
         if (this.app.selection.isSelectedObject(signal)) {
            container.tint = 0xff0000;
         }
      });
   }

   renderAllTracks() {
      Track.allTracks.forEach((t) => {
         this.renderTrack(this.app.renderingManager!.containers.tracks, t);
      });
   }

   isSelected(c: any) {
      c.tint = 0xff0000;
   }

   updateSelection() {
      app.renderingManager!.containers.tracks.children.forEach((c: any) => {
         if (c.data) {
            if (app.selection.isSelectedObject(c.data)) this.isSelected(c);
            else c.tint = 0xffffff;
         }
      });
      app.renderingManager!.containers.signals.children.forEach(function (c: any) {
         if (c.data) {
            if (app.selection.isSelectedObject(c.data)) c.tint = 0xff0000;
            else c.tint = 0xffffff;
         }
      });
      this.app.renderingManager!.update();
   }

   renderAllGenericObjects() {
      this.app.renderingManager!.containers.objects.removeAllChildren();
      GenericObject.all_objects.forEach((o: any) => {
         const c = new DisplayGroup("GenericObject", o);
         c.name = "GenericObject";
         c.data = o;
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
      var text = new LabelText(text_object.content(), "20px Arial", "#000000");
      const height = text.getMeasuredHeight();
      const width = text.getMeasuredWidth();

      text.hitArea = polygonHitArea([{ x: 0, y: 0 }, { x: width, y: 0 }, { x: width, y: -height }, { x: 0, y: -height }]);

      container.addChild(text);
   }

   renderPlattformObject(plattform: any, container: any) {
      const shape = new Sketch();
      container.addChild(shape);
      shape.graphics.beginStroke("#111111").beginFill("#444").drawRect(0, 0, plattform.size().width, plattform.size().height);

      var text = new LabelText(plattform.content(), "20px Arial", "#eee");
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
      let shape = new Sketch("track", track);
      shape.name = "track";
      shape.data = track;

      shape.hitArea = polygonHitArea(params.hit_area);

      //container.addChild(hit);
      container.addChild(shape);

      shape.graphics.setStrokeStyle(trackRendering_basic.STROKE, "round").beginStroke(trackRendering_basic.TRACK_COLOR);
      shape.color = (shape.graphics as any).command;
      shape.graphics.moveTo(params.start.x, params.start.y).lineTo(params.end.x, params.end.y);
      if (params.bumper[0]) {
         //prellbock beim start
         shape.graphics.moveTo(params.bumper[0][0].x, params.bumper[0][0].y).lineTo(params.bumper[0][1].x, params.bumper[0][1].y);
      }

      if (params.bumper[1]) {
         //prellbock beim ende
         shape.graphics.moveTo(params.bumper[1][0].x, params.bumper[1][0].y).lineTo(params.bumper[1][1].x, params.bumper[1][1].y);
      }
      if (this.app.selection.isSelectedObject(track)) this.isSelected(shape);

      shape.setBounds(
         params.start.x - trackRendering_basic.HIT_TEST_DISTANCE,
         params.start.y - trackRendering_basic.HIT_TEST_DISTANCE,
         params.end.x - params.start.x + trackRendering_basic.HIT_TEST_DISTANCE * 2,
         params.end.y - params.start.y + trackRendering_basic.HIT_TEST_DISTANCE * 2
      );

      return shape;
   }

   static drawTriangle(graphics: any, color: string, p1: any, p2: any, p3: any) {
      graphics.beginFill(color)
         .mt(p1.x, p1.y)
         .lt(p2.x, p2.y)
         .lt(p3.x, p3.y)
         .lt(p1.x, p1.y);
   }

   renderAllSwitches() {
      Switch.allSwitches.forEach((sw) => {
         if (!sw.track1 || !sw.track2 || !sw.track3 || (sw.type == Switch.SWITCH_TYPE.DKW && !sw.track4)) {
            console.log(sw);
            throw new Error("switch is falty");
         }
         let switch_shape = new Sketch("switch", sw);
         switch_shape.name = "switch";
         switch_shape.data = sw;
         this.app.renderingManager!.containers.tracks.addChild(switch_shape);
         
         // Draw the switch branch tracks
         switch_shape.graphics.setStrokeStyle(trackRendering_basic.STROKE, "round").beginStroke(trackRendering_basic.TRACK_COLOR);
         switch_shape.color = (switch_shape.graphics as any).command;

         // Draw all track branches using a loop
         const maxTracks = sw.type == Switch.SWITCH_TYPE.DKW ? 4 : 3;
         for (let i = 0; i < maxTracks; i++) {
            if (sw.track_directions[i]) {
               let end_point = sw.getBranchEndPoint(i);
               switch_shape.graphics.moveTo(sw.location.x, sw.location.y).lineTo(end_point.x, end_point.y);
            }
         }

         let p1: any, p2: any;

         p1 = sw.getBranchEndPoint(1, trackRendering_basic.SWITCH_SIZE);
         p2 = sw.getBranchEndPoint(2, trackRendering_basic.SWITCH_SIZE);
         if (p1 && p2) {
            trackRendering_basic.drawTriangle(switch_shape.graphics, "black", sw.location, p1, p2);
         }

         if (sw.type == Switch.SWITCH_TYPE.DKW) {
            p1 = sw.getBranchEndPoint(0, trackRendering_basic.SWITCH_SIZE);
            p2 = sw.getBranchEndPoint(3, trackRendering_basic.SWITCH_SIZE);
            if (p1 && p2) {
               trackRendering_basic.drawTriangle(switch_shape.graphics, "black", sw.location, p1, p2);
            }
         }

         this.renderSwitchUI(sw);
      });
   }

   renderSwitchUI(sw: Switch) {
      // Check if a container already exists for this switch
      let container = this.app.renderingManager!.containers.ui.children.find((c: any) => c.data === sw);

      if (container) {
         // If container exists, clear it but keep it
         container.removeAllChildren();
      } else {
         // Create a new container if none exists
         container = new DisplayGroup("switch", sw);
         container.interactiveChildren = false;
         container.name = "switch";
         container.data = sw;
         this.app.renderingManager!.containers.ui.addChild(container);
      }

      const ui_shape = new Sketch();
      ui_shape.graphics.setStrokeStyle(trackRendering_basic.STROKE / 2, "round");
      container.addChild(ui_shape);

      const draw_line = function (t: number, color: string) {
         ui_shape.graphics.beginStroke(color);
         let p1 = sw.getBranchEndPoint(t, trackRendering_basic.SWITCH_SIZE);
         let p0 = sw.getBranchEndPoint(t, trackRendering_basic.SWITCH_SIZE / 2);
         ui_shape.graphics.moveTo(p0.x, p0.y).lineTo(p1.x, p1.y);
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




