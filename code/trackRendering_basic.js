"use strict";

class trackRendering_basic {
    static TRACK_COLOR = "#000000";
    static STROKE = 2;

    reDrawEverything() {
        clearCanvas();
        this.renderAllTracks();
        this.renderAllSwitches();
        stage.update();
    }

    renderAllTracks() {
        tracks.forEach((t) => {
            let shape = this.renderTrack(track_container, t);
            if (selectedTrack == t) selectTrack(shape);
            t.signals.forEach((p) => {
                let c = signal_container.addChild(createSignalContainer(p.signal));
                alignSignalWithTrack(c, t, p);
            });
        });
    }

    renderTrack(container, track) {
        let shape = new createjs.Shape();
        shape.name = "track";
        shape.track = track;

        let hit = new createjs.Shape();

        let p1 = geometry.perpendicular(track.start, track.deg, -8);
        let p2 = geometry.perpendicular(track.start, track.deg, 8);
        let p3 = geometry.perpendicular(track.end, track.deg, 8);
        const p4 = geometry.perpendicular(track.end, track.deg, -8);

        hit.graphics.beginFill("#000").mt(p1.x, p1.y).lt(p2.x, p2.y).lt(p3.x, p3.y).lt(p4.x, p4.y).lt(p1.x, p1.y);
        shape.hitArea = hit;

        //container.addChild(hit);
        container.addChild(shape);

        shape.graphics.setStrokeStyle(trackRendering_basic.STROKE, "round").beginStroke(trackRendering_basic.TRACK_COLOR);
        shape.color = shape.graphics.command;
        shape.graphics.moveTo(track.start.x, track.start.y).lineTo(track.end.x, track.end.y);
        if (!track.switches.some((p) => p.km == 0)) {
            //prellbock beim start
            p1 = geometry.perpendicular(track.start, track.deg, -6);
            p2 = geometry.perpendicular(track.start, track.deg, 6);
            shape.graphics.moveTo(p1.x, p1.y).lineTo(p2.x, p2.y);
        }

        if (!track.switches.some((p) => p.km == track.length)) {
            //prellbock beim ende
            p1 = geometry.perpendicular(track.end, track.deg, -6);
            p2 = geometry.perpendicular(track.end, track.deg, 6);
            shape.graphics.moveTo(p1.x, p1.y).lineTo(p2.x, p2.y);
        }

        return shape;
    }

    renderAllSwitches() {
        switches.forEach((sw) => {
            if (sw.type.is(SWITCH_TYPE.ARCH, SWITCH_TYPE.CROSSING)) return;

            let switch_shape = new createjs.Shape();
            switch_shape.name = "switch";
            switch_shape.sw = sw;
            track_container.addChild(switch_shape);

            let p1, p2;

            let l = sw.type == SWITCH_TYPE.FROM_LEFT || sw.type == SWITCH_TYPE.FROM_RIGHT ? -10 : 10;
            //if (sw.type == SWITCH_TYPE.DKW && this.deg == 0) l *= -1;
            p1 = geometry.add(sw.location, geometry.multiply(sw.t1.unit, l));
            p2 = geometry.add(sw.location, geometry.multiply(sw.t2.unit, l));

            this.drawTriangle(switch_shape, "black", sw.location, p1, p2);

            if (sw.type == SWITCH_TYPE.DKW) {
                p1 = geometry.add(sw.location, geometry.multiply(sw.t1.unit, -l));
                p2 = geometry.add(sw.location, geometry.multiply(sw.t2.unit, -l));

                this.drawTriangle(switch_shape, "black", sw.location, p1, p2);
            }

            this.renderSwitchUI(sw);
        });
    }

    reRenderSwitch(sw) {
        const s = ui_container.children.find((c) => c.sw == sw);
        if (s) s.parent.removeChild(s);

        this.renderSwitchUI(sw);
    }

    renderSwitchUI(sw) {
        let p1;
        let ui_shape = new createjs.Shape();
        ui_shape.name = "switch";
        ui_shape.sw = sw;
        ui_container.addChild(ui_shape);

        ui_shape.graphics.setStrokeStyle(0.8, "round").beginStroke("gray");

        let l = sw.type == SWITCH_TYPE.FROM_LEFT || sw.type == SWITCH_TYPE.FROM_RIGHT ? -10 : 10;

        p1 = geometry.add(sw.location, geometry.multiply(sw.t1.unit, -10));
        ui_shape.graphics.moveTo(sw.location.x, sw.location.y).lineTo(p1.x, p1.y);

        p1 = geometry.add(sw.location, geometry.multiply(sw.t1.unit, 10));
        ui_shape.graphics.moveTo(sw.location.x, sw.location.y).lineTo(p1.x, p1.y);

        p1 = geometry.add(sw.location, geometry.multiply(sw.t2.unit, l));
        ui_shape.graphics.moveTo(sw.location.x, sw.location.y).lineTo(p1.x, p1.y);

        if (sw.type == SWITCH_TYPE.DKW) {
            p1 = geometry.add(sw.location, geometry.multiply(sw.t2.unit, -l));
            ui_shape.graphics.moveTo(sw.location.x, sw.location.y).lineTo(p1.x, p1.y);
        }

        ui_shape.graphics.setStrokeStyle(0.8, "round").beginStroke("white");
        if (!sw.type.is(SWITCH_TYPE.DKW)) {
            p1 = geometry.add(sw.location, geometry.multiply(sw.t1.unit, -l));
        } else p1 = geometry.add(sw.location, geometry.multiply(sw.from.unit, -l));
        ui_shape.graphics.moveTo(sw.location.x, sw.location.y).lineTo(p1.x, p1.y);

        p1 = geometry.add(sw.location, geometry.multiply(sw.branch.unit, l));
        ui_shape.graphics.moveTo(sw.location.x, sw.location.y).lineTo(p1.x, p1.y);
    }

    drawTriangle(shape, color, p1, p2, p3) {
        shape.graphics.beginFill(color).moveTo(p1.x, p1.y).lineTo(p2.x, p2.y).lineTo(p3.x, p3.y).cp();
    }
}
