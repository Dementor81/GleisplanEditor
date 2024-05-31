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
        clearCanvas();
        this.renderAllTracks();
        this.renderAllSwitches();
        stage.update();
    }

    renderAllTracks() {
        tracks.forEach((t) => {
            let shape = this.renderTrack(track_container, t);
            if (selectedTrack == t) selectTrack(shape);
            t.signals.forEach((signal) => {
                let c = signal_container.addChild(createSignalContainer(signal));
                alignSignalWithTrack(c);
            });
        });
    }

    renderTrack(container, track) {
        let shape = new createjs.Shape();
        shape.name = "track";
        shape.track = track;

        let hit = new createjs.Shape();

        let p1 = geometry.perpendicular(track.start, track._tmp.deg, -trackRendering_basic.HIT_TEST_DISTANCE);
        let p2 = geometry.perpendicular(track.start, track._tmp.deg, trackRendering_basic.HIT_TEST_DISTANCE);
        let p3 = geometry.perpendicular(track.end, track._tmp.deg, trackRendering_basic.HIT_TEST_DISTANCE);
        const p4 = geometry.perpendicular(track.end, track._tmp.deg, -trackRendering_basic.HIT_TEST_DISTANCE);

        hit.graphics.beginFill("#000").mt(p1.x, p1.y).lt(p2.x, p2.y).lt(p3.x, p3.y).lt(p4.x, p4.y).lt(p1.x, p1.y);
        shape.hitArea = hit;

        //container.addChild(hit);
        container.addChild(shape);

        shape.graphics.setStrokeStyle(trackRendering_basic.STROKE, "round").beginStroke(trackRendering_basic.TRACK_COLOR);
        shape.color = shape.graphics.command;
        shape.graphics.moveTo(track.start.x, track.start.y).lineTo(track.end.x, track.end.y);
        if (!track._tmp.switches[0]) {
            //prellbock beim start
            p1 = geometry.perpendicular(track.start, track._tmp.deg, -trackRendering_basic.BUMPER_SIZE);
            p2 = geometry.perpendicular(track.start, track._tmp.deg, trackRendering_basic.BUMPER_SIZE);
            shape.graphics.moveTo(p1.x, p1.y).lineTo(p2.x, p2.y);
        }

        if (!track._tmp.switches[1]) {
            //prellbock beim ende
            p1 = geometry.perpendicular(track.end, track._tmp.deg, -trackRendering_basic.BUMPER_SIZE);
            p2 = geometry.perpendicular(track.end, track._tmp.deg, trackRendering_basic.BUMPER_SIZE);
            shape.graphics.moveTo(p1.x, p1.y).lineTo(p2.x, p2.y);
        }

        const text = new createjs.Text(track.id, "Italic 10px Arial", "black");
        const p = geometry.perpendicular(track.along(track.start, track.length / 2), track.deg, 15);

        text.x = p.x;
        text.y = p.y;
        text.textBaseline = "alphabetic";
        ui_container.addChild(text);

        shape.setBounds(track.start.x, track.start.y, track.end.x-track.start.x, track.end.y-track.start.y);

        return shape;
    }

    renderAllSwitches() {
        switches.forEach((sw) => {
            if (!sw.t1 || !sw.t2 || !sw.t3 || (sw.type == SWITCH_TYPE.DKW && !sw.t4)) {
                console.log(sw);
                throw new Error("switch is falty");
            }
            let switch_shape = new createjs.Shape();
            switch_shape.name = "switch";
            switch_shape.sw = sw;
            track_container.addChild(switch_shape);

            let p1, p2;

            p1 = sw.t2.along(sw.location, trackRendering_basic.SWITCH_SIZE);
            p2 = sw.t3.along(sw.location, trackRendering_basic.SWITCH_SIZE);
            this.drawTriangle(switch_shape, "black", sw.location, p1, p2);

            if (sw.type == SWITCH_TYPE.DKW) {
                p1 = sw.t1.along(sw.location, trackRendering_basic.SWITCH_SIZE);
                p2 = sw.t4.along(sw.location, trackRendering_basic.SWITCH_SIZE);

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
        ui_container.addChild(
            (() => {
                const ui_shape = new createjs.Shape();
                ui_shape.name = "switch";
                ui_shape.sw = sw;
                ui_shape.graphics.setStrokeStyle(trackRendering_basic.STROKE / 2, "round").beginStroke("gray");

                const triangle = function (t) {
                    let p1 = t.along(sw.location, 10);
                    let p0 = t.along(sw.location, 3);
                    ui_shape.graphics.moveTo(p0.x, p0.y).lineTo(p1.x, p1.y);
                };

                triangle(sw.t1);
                triangle(sw.t2);
                triangle(sw.t3);

                if (sw.type == SWITCH_TYPE.DKW) triangle(sw.t4);

                ui_shape.graphics.setStrokeStyle(trackRendering_basic.STROKE / 2, "round").beginStroke("white");

                if (!sw.type.is(SWITCH_TYPE.DKW)) triangle(sw.t1);
                else triangle(sw.from);

                triangle(sw.branch);
                return ui_shape;
            })()
        );
    }

    drawTriangle(shape, color, p1, p2, p3) {
        shape.graphics.beginFill(color).moveTo(p1.x, p1.y).lineTo(p2.x, p2.y).lineTo(p3.x, p3.y).cp();
    }
}
