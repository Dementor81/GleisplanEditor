"use strict";

class trackRendering_textured {
    static TRACK_SCALE = 0.1;

    
    static signale_scale = 0.1;
    static CURVE_RADIUS 
    static SCHWELLEN_VARIANTEN = 24;

    static RAIL = [
        [1.4, "#222"],
        [1.2, "#999999"],
        [0.6, "#eeeeee"],
    ];

    static {
        //render values
        this.schwellenHöhe = 0;
        this.schwellenBreite = 0;
        this.schwellenGap = 0;
        this.rail_offset = 0;
    }

    constructor(){
        this.CURVE_RADIUS = GRID_SIZE * 1.2;
        this.GRID_SIZE_2 = GRID_SIZE / 2;
    }

    reDrawEverything() {
        if (!pl.loaded)
            setTimeout(() => {
                reDrawEverything();
            }, 500);
        else {
            track_container.removeAllChildren();
            signal_container.removeAllChildren();
            overlay_container.removeAllChildren();
            ui_container.removeAllChildren();

            renderAllTracks();
            renderAllSwitches();

            stage.update();
        }
    }

    renderAllTracks() {
        tracks.forEach((t) => {
            t.draw(track_container);
            if (selectedTrack == t) selectTrack(c);
            t.signals.forEach((p) => {
                let c = signal_container.addChild(createSignalContainer(p.signal));
                alignSignalWithTrack(c, t, p);
            });
        });
    }

    
    renderTrack_simple(container, track) {
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

        shape.graphics.setStrokeStyle(stroke, "round").beginStroke(track_color);
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

            drawTriangle(switch_shape, "black", sw.location, p1, p2);

            if (sw.type == SWITCH_TYPE.DKW) {
                p1 = geometry.add(sw.location, geometry.multiply(sw.t1.unit, -l));
                p2 = geometry.add(sw.location, geometry.multiply(sw.t2.unit, -l));

                drawTriangle(switch_shape, "black", sw.location, p1, p2);
            }

            if (!TEXTURE_MODE) renderSwitchUI(sw);
        });
    }

    reRenderSwitch(sw) {
        const s = ui_container.children.find((c) => c.sw == sw);
        if (s) s.parent.removeChild(s);

        renderSwitchUI(sw);
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
