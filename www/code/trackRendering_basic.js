"use strict";

// ES6 Module imports
import { Track } from './track.js';
import { Switch } from './switch.js';
import { Signal, SignalRenderer } from './signal.js';
import { Train } from './train.js';
import { GenericObject } from './generic_object.js';
import { geometry, type } from './tools.js';
import { NumberUtils } from './utils.js';
import { Application } from './application.js';

export class trackRendering_basic {
   static TRACK_COLOR = "#111111";
   static SWITCH_UI_COLOR = "gray";
   static SWITCH_UI_COLOR_SELECTED = "#eee";
   static STROKE = 6;
   static HIT_TEST_DISTANCE = 10;
   static BUMPER_SIZE = 8;
   static SWITCH_SIZE = 30;

   constructor() {
      this.SIGNAL_DISTANCE_FROM_TRACK = 18;
      this.app = Application.getInstance();
   }

   reDrawEverything() {
      
      this.app.renderingManager.containers.removeAllChildren();

      this.renderAllTracks();
      this.renderAllSwitches();
      this.renderAllGenericObjects();
      this.renderAllSignals();
      this.app.renderingManager.update();
   }

   renderAllSignals() {
      this.app.renderingManager.containers.signals.removeAllChildren();
      Signal.allSignals.forEach((signal) => {
         let container = this.app.renderingManager.containers.signals.addChild(SignalRenderer.createSignalContainer(signal));
         this.app.alignSignalContainerWithTrack(container, signal._positioning);
         if (this.app.selection.isSelectedObject(signal)) {
            container.shadow = new createjs.Shadow("#ff0000", 0, 0, 3);
         }
      });
   }

   renderAllTracks() {
      Track.allTracks.forEach((t) => {
         this.renderTrack(this.app.renderingManager.containers.tracks, t);
      });
   }

   isSelected(c) {
      c.color.style = "#ff0000";
   }

   updateSelection() {
      this.app.renderingManager.containers.tracks.children.forEach((c) => {
         if (c.data) {
            if (this.app.selection.isSelectedObject(c.data)) this.isSelected(c);
            else c.color.style = trackRendering_basic.TRACK_COLOR;
         }
      });
      this.app.renderingManager.containers.signals.children.forEach(function (c) {
         if (c.data) {
            if (this.app.selection.isSelectedObject(c.data)) c.shadow = new createjs.Shadow("#ff0000", 0, 0, 3);
            else c.shadow = null;
         }
      });
      this.app.renderingManager.update();
   }

   renderAllGenericObjects() {
      this.app.renderingManager.containers.objects.removeAllChildren();
      GenericObject.all_objects.forEach((o) => {
         const c = new createjs.Container();
         c.name = "object";
         c.object = o;
         c.mouseChildren = false;
         c.x = o.pos().x;
         c.y = o.pos().y;

         if (o.type() === GenericObject.OBJECT_TYPE.text) this.renderTextObject(o, c);
         else if (o.type() === GenericObject.OBJECT_TYPE.plattform) this.renderPlattformObject(o, c);
         else throw new Error("Unknown Object");

         this.app.renderingManager.containers.objects.addChild(c);
      });
   }

   renderTextObject(text_object, container) {
      var text = new createjs.Text(text_object.content(), "20px Arial", "#000000");
      text.textBaseline = "alphabetic";
      const height = text.getMeasuredHeight();
      const width = text.getMeasuredWidth();

      const hit = new createjs.Shape();
      hit.graphics.beginFill("#000").mt(0, 0).lt(width, 0).lt(width, -height).lt(0, -height).lt(0, 0);

      text.hitArea = hit;

      container.addChild(text);
   }

   renderPlattformObject(plattform, container) {
      const shape = new createjs.Shape();
      container.addChild(shape);
      shape.graphics.beginStroke("#111111").beginFill("#444").drawRect(0, 0, plattform.size().width, plattform.size().height);

      var text = new createjs.Text(plattform.content(), "20px Arial", "#eee");
      text.textBaseline = "middle";
      text.textAlign = "center";
      text.x = plattform.size().width / 2;
      text.y = plattform.size().height / 2;

      container.addChild(text);
   }

   calculateTrackDrawingParameters(track) {
      let corr_start = track.start,
         corr_end = track.end;
      let bumper_start, bumper_end;

      if (!track.switchAtTheStart) {
         //prellbock beim start
         const B1 = track.start.add(geometry.perpendicular(track.unit).multiply(-trackRendering_basic.BUMPER_SIZE));
         const B2 = track.start.add(geometry.perpendicular(track.unit).multiply(trackRendering_basic.BUMPER_SIZE));
         bumper_start = [B1, B2];
      } else if (type(track.switchAtTheStart) == "Switch") {
         corr_start = track.along(track.switchAtTheStart.location, track.switchAtTheStart.size);
      }

      if (!track.switchAtTheEnd) {
         //prellbock beim ende
         const B1 = track.end.add(geometry.perpendicular(track.unit).multiply(-trackRendering_basic.BUMPER_SIZE));
         const B2 = track.end.add(geometry.perpendicular(track.unit).multiply(trackRendering_basic.BUMPER_SIZE));
         bumper_end = [B1, B2];
      } else if (type(track.switchAtTheEnd) == "Switch") {
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

   renderTrack(container, track) {
      let params = this.calculateTrackDrawingParameters(track);
      let shape = new createjs.Shape();
      shape.name = "track";
      shape.data = track;

      let hit = new createjs.Shape();

      hit.graphics
         .beginFill("#000")
         .mt(params.hit_area[0].x, params.hit_area[0].y)
         .lt(params.hit_area[1].x, params.hit_area[1].y)
         .lt(params.hit_area[2].x, params.hit_area[2].y)
         .lt(params.hit_area[3].x, params.hit_area[3].y)
         .lt(params.hit_area[0].x, params.hit_area[0].y);
      shape.hitArea = hit;

      //container.addChild(hit);
      container.addChild(shape);

      shape.graphics.setStrokeStyle(trackRendering_basic.STROKE, "round").beginStroke(trackRendering_basic.TRACK_COLOR);
      shape.color = shape.graphics.command;
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

      /* const text = new createjs.Text(track.id, "Italic 10px Arial", "black");
      const p = track.along(track.start, track.length / 2).add(geometry.perpendicular(track.unit).multiply(15));

      text.x = p.x;
      text.y = p.y;
      text.textBaseline = "alphabetic";
      this.app.renderingManager.containers.ui.addChild(text); */

      shape.setBounds(
         params.start.x - trackRendering_basic.HIT_TEST_DISTANCE,
         params.start.y - trackRendering_basic.HIT_TEST_DISTANCE,
         params.end.x - params.start.x + trackRendering_basic.HIT_TEST_DISTANCE * 2,
         params.end.y - params.start.y + trackRendering_basic.HIT_TEST_DISTANCE * 2
      );

      return shape;
   }

   static drawTriangle(graphics, color, p1, p2, p3) {
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
         let switch_shape = new createjs.Shape();
         switch_shape.name = "switch";
         switch_shape.data = sw;
         this.app.renderingManager.containers.tracks.addChild(switch_shape);
         
         // Draw the switch branch tracks
         switch_shape.graphics.setStrokeStyle(trackRendering_basic.STROKE, "round").beginStroke(trackRendering_basic.TRACK_COLOR);
         switch_shape.color = switch_shape.graphics.command;

         // Draw all track branches using a loop
         const maxTracks = sw.type == Switch.SWITCH_TYPE.DKW ? 4 : 3;
         for (let i = 0; i < maxTracks; i++) {
            if (sw.track_directions[i]) {
               let end_point = sw.getBranchEndPoint(i);
               switch_shape.graphics.moveTo(sw.location.x, sw.location.y).lineTo(end_point.x, end_point.y);
            }
         }

         let p1, p2;

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

   renderSwitchUI(sw) {
      // Check if a container already exists for this switch
      let container = this.app.renderingManager.containers.ui.children.find((c) => c.data === sw);

      if (container) {
         // If container exists, clear it but keep it
         container.removeAllChildren();
      } else {
         // Create a new container if none exists
         container = new createjs.Container();
         container.mouseChildren = false;
         container.name = "switch";
         container.data = sw;
         this.app.renderingManager.containers.ui.addChild(container);
      }

      const ui_shape = new createjs.Shape();
      ui_shape.graphics.setStrokeStyle(trackRendering_basic.STROKE / 2, "round");
      container.addChild(ui_shape);

      const draw_line = function (t, color) {
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


