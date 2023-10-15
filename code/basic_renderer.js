"use strict";

function reDrawEverything() {
    if (!pl.loaded)
        setTimeout(() => {
            reDrawEverything();
        }, 500);
    else {
        track_container.removeAllChildren();
        signal_container.removeAllChildren();
        overlay_container.removeAllChildren();
        ui_container.removeAllChildren();

        tracks.forEach((t) => {
            let c = t.draw(track_container);
            if (selectedTrack == t) selectTrack(c);
            t.signals.forEach((p) => {
                let c = signal_container.addChild(createSignalContainer(p.signal));
                alignSignalWithTrack(c, t, p);
            });
        });

        renderAllSwitches();

        stage.update();
    }
}

function renderAllSwitches() {
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

        renderSwitchUI(sw);
    });
}

function reRenderSwitch(sw) {
    const s = ui_container.children.find((c) => c.sw == sw);
    if (s) s.parent.removeChild(s);

    renderSwitchUI(sw);
}

function renderSwitchUI(sw) {
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

function drawTriangle(shape, color, p1, p2, p3) {
    shape.graphics.beginFill(color).moveTo(p1.x, p1.y).lineTo(p2.x, p2.y).lineTo(p3.x, p3.y).cp();
}
