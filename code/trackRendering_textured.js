"use strict";

class trackRendering_textured {
    static TRACK_SCALE = 0.2;
    static signale_scale = 0.5;
    static SCHWELLEN_VARIANTEN = 24;

    static RAILS = [
        [2.8, "#222"],
        [2.4, "#999"],
        [1.2, "#eee"],
    ];

    constructor() {
        //cause the class is been loaded before start.js, we have to hack and calculate this constant here
        trackRendering_textured.CURVE_RADIUS = GRID_SIZE * 1.21;

        this.SIGNAL_DISTANCE_FROM_TRACK = 35;

        this.LOD = 1.2;
    }

    reDrawEverything() {
        if (!pl.loaded)
            setTimeout(() => {
                reDrawEverything();
            }, 500);
        else {
            clearCanvas();

            this.calcRenderValues();

            this.renderAllTracks();
            this.renderAllSwitches();

            stage.update();
        }
    }

    calcRenderValues() {
        this.schwellenImg = pl.getImage("schwellen");
        this.schwellenHöhe = this.schwellenImg.height * trackRendering_textured.TRACK_SCALE;
        this.schwellenHöhe_2 = this.schwellenHöhe / 2;
        this.schwellenBreite = (this.schwellenImg.width / trackRendering_textured.SCHWELLEN_VARIANTEN) * trackRendering_textured.TRACK_SCALE;
        this.schwellenGap = this.schwellenBreite * 1;
        this.rail_offset = this.schwellenHöhe / 4.7;

        this.main_x1 = (Math.sin(π / 8) * trackRendering_textured.CURVE_RADIUS) / Math.cos(π / 8);
    }

    renderAllTracks() {
        tracks.forEach((t) => {
            this.renderTrack(track_container, t);
            t.signals.forEach((signal) => {
                let c = signal_container.addChild(createSignalContainer(signal));
                alignSignalWithTrack(c);
            });
        });
    }

    createHitArea(startpoint, endpoint, deg) {
        const hit = new createjs.Shape();
        const sw2 = this.schwellenHöhe_2;
        const p1 = geometry.perpendicular(startpoint, deg, -sw2);
        const p2 = geometry.perpendicular(startpoint, deg, sw2);
        const p3 = geometry.perpendicular(endpoint, deg, sw2);
        const p4 = geometry.perpendicular(endpoint, deg, -sw2);

        hit.graphics.beginFill("#000").mt(p1.x, p1.y).lt(p2.x, p2.y).lt(p3.x, p3.y).lt(p4.x, p4.y).lt(p1.x, p1.y);

        return hit;
    }

    renderTrack(container, track) {
        const track_container = new createjs.Container();
        track_container.name = "track";
        track_container.track = track;
        track_container.mouseChildren = false;

        const bounds_points = this.drawStraightTrack(track_container, track);

        if (type(track.switchAtTheEnd) == "Track") bounds_points.push(...this.drawCurvedTrack(track_container, track, track.switchAtTheEnd));

        if (track.selected) this.#isSelected(track_container);

        track_container.x = track.start.x;
        track_container.y = track.start.y;

        bounds_points.forEach((p) => drawPoint(p, track_container));
        const bounds = {
            x: 0,
            y: 0 - this.schwellenHöhe_2,
            width: track.end.x - track.start.x,
            height: track.end.y - track.start.y + this.schwellenHöhe,
        };
        //texture_container.setBounds(bounds.x,bounds.y,bounds.width,bounds.height);

        //texture_container.cache(bounds.x,bounds.y,bounds.width,bounds.height);

        container.addChild(track_container);
        return track_container;
    }

    #isSelected(c) {
        c.shadow = new createjs.Shadow("#ff0000", 0, 0, 3);
    }

    updateSelection() {
        track_container.children.forEach((c) => {
            if (c.track?.selected) this.#isSelected(c);
            else c.shadow = null;
        });
        stage.update();
    }

    drawSchwellen(track, startPoint, endPoint, texture_container) {
        const cos = track._tmp.cos,
            sin = track._tmp.sin;

        const bounds_points = [];

        //kleine verschieben, damit man mit einer lücke anfängt - Zentrierung der schwelle
        let x = startPoint.x + sin * this.schwellenHöhe_2;
        let y = startPoint.y - cos * this.schwellenHöhe_2;

        bounds_points.push({ x: x, y: y }, { x: x - sin * this.schwellenHöhe, y: y + cos * this.schwellenHöhe });

        //kleine verschieben, damit man mit einer lücke anfängt - Zentrierung der schwelle
        x += cos * (this.schwellenGap / 2);
        y += sin * (this.schwellenGap / 2);

        let l = geometry.distance(startPoint, endPoint);
        let tmp = l / (this.schwellenBreite + this.schwellenGap);
        let anzSchwellen = Math.floor(tmp);
        let custom_gap = ((tmp - anzSchwellen) * (this.schwellenBreite + this.schwellenGap)) / anzSchwellen + this.schwellenGap;

        for (let i = 0; i < anzSchwellen; i++) {
            if (stage.scale < this.LOD) {
                var sleeper = texture_container.addChild(new createjs.Shape()).set({ x: x, y: y, rotation: track._tmp.deg });

                sleeper.graphics.setStrokeStyle(0.2, "round").beginStroke("black").beginFill("#99735b").r(0, 0, this.schwellenBreite, this.schwellenHöhe).ef();
            } else {
                let random = Math.randomInt(trackRendering_textured.SCHWELLEN_VARIANTEN - 1);
                texture_container.addChild(
                    new createjs.Bitmap(this.schwellenImg).set({
                        y: y,
                        x: x,
                        sourceRect: new createjs.Rectangle(
                            (random * this.schwellenImg.width) / trackRendering_textured.SCHWELLEN_VARIANTEN,
                            0,
                            this.schwellenImg.width / trackRendering_textured.SCHWELLEN_VARIANTEN,
                            this.schwellenImg.height
                        ),
                        scale: trackRendering_textured.TRACK_SCALE,
                        rotation: track._tmp.deg,
                    })
                );
            }
            y += sin * (this.schwellenBreite + custom_gap);
            x += cos * (this.schwellenBreite + custom_gap);
        }
        bounds_points.push({ x: x, y: y }, { x: x - sin * this.schwellenHöhe, y: y + cos * this.schwellenHöhe });
        return bounds_points;
    }

    drawStraightRail(g, track, startPoint, endPoint) {
        const offset = this.schwellenHöhe_2 - this.rail_offset;

        const x = track._tmp.sin * offset,
            y = track._tmp.cos * offset;

        let p1, p2;

        let points = [
            { x: startPoint.x + x, y: startPoint.y - y },
            { x: endPoint.x + x, y: endPoint.y - y },
            { x: startPoint.x - x, y: startPoint.y + y },
            { x: endPoint.x - x, y: endPoint.y + y },
        ];
        for (let i = 0; i <= 2; i += 2) {
            trackRendering_textured.RAILS.forEach((r) => {
                g.setStrokeStyle(r[0]).beginStroke(r[1]);
                p1 = points[i];
                p2 = points[i + 1];

                g.moveTo(p1.x, p1.y).lineTo(p2.x, p2.y);
            });
        }

        return points;
    }

    drawStraightTrack(container, track) {
        let endPoint = geometry.sub(track.end, track.start),
            startPoint = new Point(0, 0);

        const rail_shape = new createjs.Shape();

        const bounds_points = [];

        if (track.switchAtTheStart) startPoint = track.unit.multiply(this.main_x1);
        if (track.switchAtTheEnd) endPoint = geometry.add(endPoint, track.unit.multiply(-this.main_x1));
        if (geometry.distance(startPoint, endPoint) > 1) {
            rail_shape.hitArea = this.createHitArea(startPoint, endPoint, track.deg);

            bounds_points.push(...this.drawSchwellen(track, startPoint, endPoint, container));
            container.addChild(rail_shape);
            bounds_points.push(...this.drawStraightRail(rail_shape.graphics, track, startPoint, endPoint));
        }

        return bounds_points;
    }

    calcValuesForCurvedTrack(track1, track2) {
        //get the horizontal and the diagonal track
        const horizontalTrack = track1.deg == 0 ? track1 : track2;
        const diagonalTrack = track1.deg == 0 ? track2 : track1;
        //calculate the point on the horizontal Track, where the curve ends
        //the centerpoint is always above or below the horizontal track
        const p1 = horizontalTrack.along(track1.end, this.main_x1);

        //centerpoint is above or below the P1 point
        const centerpoint = { x: p1.x, y: p1.y - trackRendering_textured.CURVE_RADIUS * Math.sign(track1.deg - track2.deg) };

        //get the angle of diagonal track
        let deg = findAngle(track1.end, diagonalTrack.start.equals(track1.end) ? diagonalTrack.end : diagonalTrack.start);

        //some magic to get the angle for drawArc
        deg += track1.deg + track2.deg > 0 ? 225 : 90;

        //change the reference Point (we draw in local system but calculated in globalsystem)
        return { centerpoint: geometry.sub(centerpoint, track1.start), deg: deg };
    }

    drawCurvedTrack(container, track, nextTrack) {
        const values = this.calcValuesForCurvedTrack(track, nextTrack);
        this.DrawSleepersInCircle(container, values.centerpoint, values.deg);

        const shape = new createjs.Shape();
        container.addChild(shape);

        const top = trackRendering_textured.CURVE_RADIUS - this.schwellenHöhe_2 + this.rail_offset,
            bottom = trackRendering_textured.CURVE_RADIUS + this.schwellenHöhe_2 - this.rail_offset;

        const rad = deg2rad(values.deg);
        const rad2 = rad + π / 4;
        trackRendering_textured.RAILS.forEach((r) => {
            shape.graphics.setStrokeStyle(r[0]).beginStroke(r[1]);
            shape.graphics.arc(values.centerpoint.x, values.centerpoint.y, top, rad, rad2);
            shape.graphics.beginStroke(r[1]);
            shape.graphics.arc(values.centerpoint.x, values.centerpoint.y, bottom, rad, rad2);
            shape.graphics.endStroke();
        });

        return [
            geometry.pointOnArc(top, rad, values.centerpoint),
            geometry.pointOnArc(top, rad2, values.centerpoint),
            geometry.pointOnArc(bottom, rad, values.centerpoint),
            geometry.pointOnArc(bottom, rad2, values.centerpoint),
        ];
    }

    drawArc(rail_shape, centerpoint, radius, start_deg, color, thickness) {
        rail_shape.graphics
            .setStrokeStyle(thickness)
            .beginStroke(color)
            .arc(centerpoint.x, centerpoint.y, radius, deg2rad(start_deg), deg2rad(start_deg + 45));
    }

    DrawSleepersInCircle(container, centerpoint, deg) {
        const radius = trackRendering_textured.CURVE_RADIUS,
            l = (π / 4) * radius,
            anzSchwellen = Math.floor(l / (this.schwellenBreite + this.schwellenGap));

        const startAngle = deg2rad(deg),
            endAngle = startAngle + π / 4;

        const step = (endAngle - startAngle) / anzSchwellen;
        let rad = startAngle + step / 4,
            random;

        for (let i = 0; i < anzSchwellen; i++) {
            random = Math.randomInt(trackRendering_textured.SCHWELLEN_VARIANTEN - 1);

            container.addChild(
                new createjs.Bitmap(this.schwellenImg).set({
                    x: centerpoint.x + Math.cos(rad) * (radius + this.schwellenHöhe_2),
                    y: centerpoint.y + Math.sin(rad) * (radius + this.schwellenHöhe_2),
                    scale: trackRendering_textured.TRACK_SCALE,
                    sourceRect: new createjs.Rectangle(
                        (random * this.schwellenImg.width) / trackRendering_textured.SCHWELLEN_VARIANTEN,
                        0,
                        this.schwellenImg.width / trackRendering_textured.SCHWELLEN_VARIANTEN,
                        this.schwellenImg.height
                    ),
                    rotation: (rad * 180) / Math.PI + 90,
                })
            );

            rad += step;
        }
    }

    renderAllSwitches() {
        switches.forEach((sw) => {
            this.renderSwitch(track_container, sw);
            if (sw.type.is(SWITCH_TYPE.CROSSING)) return;
        });
    }

    calcSwitchValues(sw) {
        const p1 = sw.t1.along(sw.location, this.main_x1);

        return { p1: p1, flip_hor: p1.x > sw.location.x, flip_vert: sw.type.is(SWITCH_TYPE.FROM_RIGHT, SWITCH_TYPE.TO_RIGHT) };
    }

    renderSwitch(container, sw) {
        let img;
        if (sw.type != SWITCH_TYPE.DKW) {
            img = pl.getImage("weiche");
            const switch_values = this.calcSwitchValues(sw);

            container.addChild(
                new createjs.Bitmap(img).set({
                    y: switch_values.p1.y,
                    x: switch_values.p1.x,
                    regY: img.height - this.schwellenHöhe / trackRendering_textured.TRACK_SCALE / 2,
                    scaleX: switch_values.flip_hor ? -trackRendering_textured.TRACK_SCALE : trackRendering_textured.TRACK_SCALE,
                    scaleY: switch_values.flip_vert ? -trackRendering_textured.TRACK_SCALE : trackRendering_textured.TRACK_SCALE,
                    rotation: sw.t1.deg,
                })
            );
        } else {
            img = pl.getImage("dkw");
            container.addChild(
                new createjs.Bitmap(img).set({
                    y: sw.location.y,
                    x: sw.location.x,
                    regY: img.height / 2,
                    regX: img.width / 2,
                    scale: trackRendering_textured.TRACK_SCALE,
                    scaleX: sw.t3.deg == 45 ? trackRendering_textured.TRACK_SCALE : -trackRendering_textured.TRACK_SCALE,
                })
            );
        }

        this.renderSwitchUI(sw);
    }

    reRenderSwitch(sw) {
        const s = ui_container.children.find((c) => c.sw == sw);
        if (s) s.parent.removeChild(s);

        this.renderSwitchUI(sw);
        stage.update();
    }

    renderSwitchUI(sw) {
        ui_container.addChild(
            (() => {
                let c = new createjs.Container();
                c.mouseChildren = false;
                c.name = "switch";
                c.sw = sw;
                [sw.from, sw.branch].forEach((t) => {
                    const arrow = new createjs.Shape();
                    c.addChild(arrow);

                    arrow.graphics.setStrokeStyle(trackRendering_basic.STROKE, "round").beginStroke("#333");
                    arrow.graphics.drawArrow(20, 5);
                    arrow.x = sw.location.x;
                    arrow.y = sw.location.y;
                    arrow.rotation = findAngle(sw.location, t.end.equals(sw.location) ? t.start : t.end);
                });
                return c;
            })()
        );
    }
}
