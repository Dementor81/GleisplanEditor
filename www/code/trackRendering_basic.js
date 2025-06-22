"use strict";

class trackRendering_basic {
   static TRACK_COLOR = "#111111";
   static STROKE = 4;
   static HIT_TEST_DISTANCE = 10;
   static BUMPER_SIZE = 6;
   static SWITCH_SIZE = 10;

   constructor() {
      this.SIGNAL_DISTANCE_FROM_TRACK = 18;
   }

   reDrawEverything() {
      track_container.removeAllChildren();
      signal_container.removeAllChildren();
      train_container.removeAllChildren();
      ui_container.removeAllChildren();
      debug_container.removeAllChildren();
      object_container.removeAllChildren();

      this.renderAllTracks();
      this.renderAllSwitches();
      this.renderAllGenericObjects();
      this.renderAllSignals();
      stage.update();
   }

   renderAllSignals() {
      signal_container.removeAllChildren();
      Signal.allSignals.forEach((signal) => {
         let container = signal_container.addChild(SignalRenderer.createSignalContainer(signal));
         alignSignalContainerWithTrack(container, signal._positioning);
         if (selection.isSelectedObject(signal)) {
            container.shadow = new createjs.Shadow("#ff0000", 0, 0, 3);
         }
      });
   }

   renderAllTracks() {
      Track.allTracks.forEach((t) => {
         this.renderTrack(track_container, t);
      });
   }

   isSelected(c) {
      c.color.style = "#ff0000";
   }

   updateSelection() {
      track_container.children.forEach((c) => {
         if (c.data) {
            if (selection.isSelectedObject(c.data)) this.isSelected(c);
            else c.color.style = trackRendering_basic.TRACK_COLOR;
         }
      });
      signal_container.children.forEach(function (c) {
         if (c.data) {
            if (selection.isSelectedObject(c.data)) c.shadow = new createjs.Shadow("#ff0000", 0, 0, 3);
            else c.shadow = null;
         }
      });
      stage.update();
   }

   renderAllGenericObjects() {
      object_container.removeAllChildren();
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

         object_container.addChild(c);
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
         const B1 = geometry.perpendicular(track.start, track.deg, -trackRendering_basic.BUMPER_SIZE);
         const B2 = geometry.perpendicular(track.start, track.deg, trackRendering_basic.BUMPER_SIZE);
         bumper_start = [B1, B2];
      } else if (type(track.switchAtTheStart) == "Switch") {
         corr_start = track.along(track.switchAtTheStart.location, track.switchAtTheStart.size);
      }

      if (!track.switchAtTheEnd) {
         //prellbock beim ende
         const B1 = geometry.perpendicular(track.end, track.deg, -trackRendering_basic.BUMPER_SIZE);
         const B2 = geometry.perpendicular(track.end, track.deg, trackRendering_basic.BUMPER_SIZE);
         bumper_end = [B1, B2];
      } else if (type(track.switchAtTheEnd) == "Switch") {
         corr_end = track.along(track.switchAtTheEnd.location, -track.switchAtTheEnd.size);
      }

      const p1 = geometry.perpendicular(corr_start, track.deg, -trackRendering_basic.HIT_TEST_DISTANCE);
      const p2 = geometry.perpendicular(corr_start, track.deg, trackRendering_basic.HIT_TEST_DISTANCE);
      const p3 = geometry.perpendicular(corr_end, track.deg, trackRendering_basic.HIT_TEST_DISTANCE);
      const p4 = geometry.perpendicular(corr_end, track.deg, -trackRendering_basic.HIT_TEST_DISTANCE);
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
      if (selection.isSelectedObject(track)) this.isSelected(shape);

      const text = new createjs.Text(track.id, "Italic 10px Arial", "black");
      const p = geometry.perpendicular(track.along(track.start, track.length / 2), track.deg, 15);

      text.x = p.x;
      text.y = p.y;
      text.textBaseline = "alphabetic";
      ui_container.addChild(text);

      shape.setBounds(
         params.start.x - trackRendering_basic.HIT_TEST_DISTANCE,
         params.start.y - trackRendering_basic.HIT_TEST_DISTANCE,
         params.end.x - params.start.x + trackRendering_basic.HIT_TEST_DISTANCE * 2,
         params.end.y - params.start.y + trackRendering_basic.HIT_TEST_DISTANCE * 2
      );

      return shape;
   }

   renderAllSwitches() {
      Switch.allSwitches.forEach((sw) => {
         if (!sw.t1 || !sw.t2 || !sw.t3 || (sw.type == Switch.SWITCH_TYPE.DKW && !sw.t4)) {
            console.log(sw);
            throw new Error("switch is falty");
         }
         let switch_shape = new createjs.Shape();
         switch_shape.name = "switch";
         switch_shape.sw = sw;
         track_container.addChild(switch_shape);

         // Draw the switch branch tracks
         switch_shape.graphics.setStrokeStyle(trackRendering_basic.STROKE, "round").beginStroke(trackRendering_basic.TRACK_COLOR);

         // Draw all track branches using a loop
         const maxTracks = sw.type == Switch.SWITCH_TYPE.DKW ? 4 : 3;
         for (let i = 0; i < maxTracks; i++) {
            if (sw.track_directions[i]) {
               let end_point = sw.location.add(sw.track_directions[i].multiply(sw.size));
               switch_shape.graphics.moveTo(sw.location.x, sw.location.y).lineTo(end_point.x, end_point.y);
            }
         }

         /* let p1, p2;

         p1 = sw.getBranchEndPoint('t2', trackRendering_basic.SWITCH_SIZE);
         p2 = sw.getBranchEndPoint('t3', trackRendering_basic.SWITCH_SIZE);
         if (p1 && p2) {
            switch_shape.graphics.drawTriangle("black", sw.location, p1, p2);
         }

         if (sw.type == Switch.SWITCH_TYPE.DKW) {
            p1 = sw.getBranchEndPoint('t1', trackRendering_basic.SWITCH_SIZE);
            p2 = sw.getBranchEndPoint('t4', trackRendering_basic.SWITCH_SIZE);
            if (p1 && p2) {
               switch_shape.graphics.drawTriangle("black", sw.location, p1, p2);
            }
         } */

         /* this.renderSwitchUI(sw); */
      });
   }

   renderSwitchUI(sw) {
      return;
      // Check if a container already exists for this switch
      let container = ui_container.children.find((c) => c.sw === sw);

      if (container) {
         // If container exists, clear it but keep it
         container.removeAllChildren();
      } else {
         // Create a new container if none exists
         container = new createjs.Container();
         container.mouseChildren = false;
         container.name = "switch";
         container.sw = sw;
         ui_container.addChild(container);
      }

      const ui_shape = new createjs.Shape();
      ui_shape.name = "switch";
      ui_shape.sw = sw;
      container.addChild(ui_shape);
      ui_shape.graphics.setStrokeStyle(trackRendering_basic.STROKE / 2, "round").beginStroke("gray");

      const triangle = function (t) {
         let p1 = sw.getBranchEndPoint(t, 13);
         let p0 = sw.getBranchEndPoint(t, 5);
         if (p1 && p0) {
            ui_shape.graphics.moveTo(p0.x, p0.y).lineTo(p1.x, p1.y);
         }
      };

      triangle("t1");
      triangle("t2");
      triangle("t3");

      if (sw.type == Switch.SWITCH_TYPE.DKW) triangle("t4");

      ui_shape.graphics.setStrokeStyle(trackRendering_basic.STROKE / 2, "round").beginStroke("white");

      // Handle special cases for 'from' and 'branch' which are track objects
      if (!sw.type.is(Switch.SWITCH_TYPE.DKW)) {
         triangle("t1");
      } else {
         // For DKW switches, 'from' could be t1 or t4
         if (sw.from === sw.t1) triangle("t1");
         else if (sw.from === sw.t4) triangle("t4");
      }

      // 'branch' could be t2 or t3
      if (sw.branch === sw.t2) triangle("t2");
      else if (sw.branch === sw.t3) triangle("t3");
   }
}
