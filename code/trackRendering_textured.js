"use strict";

class trackRendering_textured {
    static TRACK_SCALE = 0.1;

    static signale_scale = 0.1;
    static SCHWELLEN_VARIANTEN = 24;

    static RAIL = [
        [1.4, "#222"],
        [1.2, "#999999"],
        [0.6, "#eeeeee"],
    ];

    constructor() {
        //cause the class is been loaded before start.js, we have to hack and calculate this constant here
        trackRendering_textured.CURVE_RADIUS = GRID_SIZE * 1.2;

        this.SIGNAL_DISTANCE_FROM_TRACK = 30;
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
        this.schwellenBreite = (this.schwellenImg.width / trackRendering_textured.SCHWELLEN_VARIANTEN) * trackRendering_textured.TRACK_SCALE;
        this.schwellenGap = this.schwellenBreite * 1;
        this.rail_offset = this.schwellenHöhe / 5;

        this.main_x1 = (Math.sin(π / 8) * trackRendering_textured.CURVE_RADIUS) / Math.cos(π / 8);
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

    createHitArea(startpoint, endpoint, deg) {
        const hit = new createjs.Shape();
        const sw2 = this.schwellenHöhe / 2;
        const p1 = geometry.perpendicular(startpoint, deg, -sw2);
        const p2 = geometry.perpendicular(startpoint, deg, sw2);
        const p3 = geometry.perpendicular(endpoint, deg, sw2);
        const p4 = geometry.perpendicular(endpoint, deg, -sw2);

        hit.graphics.beginFill("#000").mt(p1.x, p1.y).lt(p2.x, p2.y).lt(p3.x, p3.y).lt(p4.x, p4.y).lt(p1.x, p1.y);

        return hit;
    }

    renderTrack(container, track) {
        const texture_container = new createjs.Container();
        texture_container.name = "track";
        texture_container.track = track;
        texture_container.mouseChildren = false;

        this.drawStraightTrack(texture_container, track);

        if (type(track.switchAtTheEnd) == "Track") this.drawCurvedTrack(texture_container, track, track.switchAtTheEnd);

        texture_container.x = track.start.x;
        texture_container.y = track.start.y;

        container.addChild(texture_container);
        return texture_container;
    }

    renderTrack_old(container, track) {
        const texture_container = new createjs.Container();
        texture_container.name = "track";
        texture_container.track = track;
        texture_container.mouseChildren = false;
        let rail_shape = new createjs.Shape();

        let hit = new createjs.Shape();

        let p1 = geometry.perpendicular(track.start, track._tmp.deg, -this.schwellenHöhe / 2);
        let p2 = geometry.perpendicular(track.start, track._tmp.deg, this.schwellenHöhe / 2);
        let p3 = geometry.perpendicular(track.end, track._tmp.deg, this.schwellenHöhe / 2);
        const p4 = geometry.perpendicular(track.end, track._tmp.deg, -this.schwellenHöhe / 2);

        hit.graphics.beginFill("#000").mt(p1.x, p1.y).lt(p2.x, p2.y).lt(p3.x, p3.y).lt(p4.x, p4.y).lt(p1.x, p1.y);
        rail_shape.hitArea = hit;

        //const kleinEisenImg = loadQueue.getResult("kleineisen");

        track._tmp.switches //alle weichen am Ende eines Gleises, die eine Kurve sind (damit jede Kurve nur 1x gezeichnet wird)
            .filter((p) => p.km == track._tmp.length && p.type === SWITCH_TYPE.ARCH)
            .forEach((p) => this.drawCurvedTrack(track, texture_container, p, p.km, track._tmp.deg, p.track._tmp.deg, this.schwellenImg));

        if (track._tmp.switches[1]) this.drawCurvedTrack(texture_container, track, track._tmp.switches[1]);

        track._tmp.switches.filter((sw) => sw.km != 0 && sw.km != track._tmp.length).forEach((sw) => this.drawSwitch(track, texture_container, sw));

        let counter = 0,
            weiche = null,
            switch_values = null,
            endpoint = null,
            startpoint = { x: 0, y: 0 },
            km = 0;
        do {
            if (track._tmp.switches.length > counter) {
                weiche = track._tmp.switches[counter];
                switch_values = this.calcValuesForCurvedRail(track, weiche);

                if (weiche.km > km) {
                    //weiche nach mir
                    if (weiche.type === SWITCH_TYPE.DKW) {
                        if (track._tmp.rad == 0) endpoint = switch_values.p3;
                        else endpoint = switch_values.p2;
                    } else if (switch_values.type == SWITCH_TYPE.TO_LEFT || switch_values.type == SWITCH_TYPE.TO_RIGHT) endpoint = switch_values.p1;
                    else {
                        if (weiche.km == track._tmp.length) endpoint = switch_values.p2;
                        else endpoint = switch_values.p3;
                    }
                } else endpoint = null;
                km = weiche?.km;
            } else {
                weiche = null;
                endpoint = track.getPointfromKm(track._tmp.length);
                km = track._tmp.length;
            }

            if (endpoint) {
                this.drawSchwellen(track, startpoint, endpoint, texture_container, this.schwellenImg);
                this.drawStraightDoubleRail(rail_shape, startpoint, endpoint);
            }

            if (weiche) {
                counter++;
                if (weiche.type === SWITCH_TYPE.DKW) {
                    if (track._tmp.rad == 0) startpoint = switch_values.p1;
                    else startpoint = switch_values.p4;
                } else if (switch_values.type == SWITCH_TYPE.FROM_LEFT || switch_values.type == SWITCH_TYPE.FROM_RIGHT) startpoint = switch_values.p1;
                else {
                    if (weiche.km == 0) startpoint = switch_values.p2;
                    else startpoint = switch_values.p3;
                }
            }
        } while (km < track._tmp.length);

        texture_container.addChild(rail_shape);

        texture_container.x = track.start.x;
        texture_container.y = track.start.y;

        container.addChild(texture_container);
        return texture_container;
    }

    drawSchwellen(track, startPoint, endPoint, texture_container) {
        const cos = Math.cos(track._tmp.rad),
            sin = Math.sin(track._tmp.rad);

        //kleine verschieben, damit man mit einer lücke anfängt - Zentrierung der schwelle
        let x = startPoint.x + sin * (this.schwellenHöhe / 2) + cos * (this.schwellenGap / 2);
        let y = startPoint.y - cos * (this.schwellenHöhe / 2) + sin * (this.schwellenGap / 2);
        let l = geometry.distance(startPoint, endPoint);
        let tmp = l / (this.schwellenBreite + this.schwellenGap);
        let anzSchwellen = Math.floor(tmp);
        let custom_gap = ((tmp - anzSchwellen) * (this.schwellenBreite + this.schwellenGap)) / anzSchwellen + this.schwellenGap;

        for (let i = 0; i < anzSchwellen; i++) {
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
            y += sin * (this.schwellenBreite + custom_gap);
            x += cos * (this.schwellenBreite + custom_gap);
        }
    }

    drawPoint(point, label = "", color = "#000", size = 1) {
        const s = new createjs.Shape();
        s.graphics.setStrokeStyle(1).beginStroke(color).beginFill(color).drawCircle(0, 0, size);
        s.x = point.x; //+ track.start.x;
        s.y = point.y; //+ track.start.y;

        ui_container.addChild(s);

        if (label) {
            const text = new createjs.Text(label, "Italic 10px Arial", color);
            text.x = s.x;
            text.y = s.y - 5;
            text.textBaseline = "alphabetic";
            ui_container.addChild(text);
        }
    }

    drawStraightDoubleRail(rail_shape, startPoint, endPoint) {
        this.drawStraightRail(rail_shape, startPoint, endPoint, -this.schwellenHöhe / 2 + this.rail_offset);
        this.drawStraightRail(rail_shape, startPoint, endPoint, this.schwellenHöhe / 2 - this.rail_offset);
    }

    drawStraightRail(rail_shape, startPoint, endPoint, y) {
        const rad = deg2rad(findAngle(startPoint, endPoint));

        const cos = Math.cos(rad + π / 2),
            sin = Math.sin(rad + π / 2);

        let x1 = startPoint.x + cos * y,
            x2 = endPoint.x + cos * y,
            y1 = startPoint.y + sin * y,
            y2 = endPoint.y + sin * y;

        trackRendering_textured.RAIL.forEach((r) => {
            rail_shape.graphics.setStrokeStyle(r[0]).beginStroke(r[1]);
            rail_shape.graphics.moveTo(x1, y1).lineTo(x2, y2);
        });
    }

    calcValuesForCurvedRail(track, sw) {
        const switchpoint = track.getPointfromKm(sw.km);
        let type = sw.type;

        let angleDeg = track._tmp.deg == 0 ? sw.track._tmp.deg : track._tmp.deg;
        if (sw.type == SWITCH_TYPE.ARCH) {
            if (track._tmp.deg != 0) {
                angleDeg = track._tmp.deg;
                if (sw.km == track._tmp.length) angleDeg += 180;
            } else {
                angleDeg = sw.track._tmp.deg;
                if (sw.km == 0) angleDeg += 180;
            }

            if (angleDeg < 0) angleDeg += 360;

            type = ((angleDeg / 45) % 8) + 1;
        }

        if (sw.type == SWITCH_TYPE.DKW) {
            if (angleDeg > 0) type = SWITCH_TYPE.FROM_LEFT;
            else type = SWITCH_TYPE.FROM_RIGHT;
        }

        let p1 = null,
            p2 = null,
            p3 = null,
            p4 = null,
            centerpoint = null,
            deg = 0;

        switch (type) {
            case SWITCH_TYPE.TO_RIGHT:
                {
                    p1 = { x: switchpoint.x - x, y: switchpoint.y };
                    p2 = { x: switchpoint.x + x2, y: switchpoint.y + x2 };
                    p3 = { x: switchpoint.x + x2, y: switchpoint.y };
                    centerpoint = { x: p1.x, y: p1.y + trackRendering_textured.CURVE_RADIUS };
                    deg = 270;
                }
                break;
            case SWITCH_TYPE.TO_LEFT:
                {
                    p1 = { x: switchpoint.x - x, y: switchpoint.y };
                    p2 = { x: switchpoint.x + x2, y: switchpoint.y - x2 };
                    p3 = { x: switchpoint.x + x2, y: switchpoint.y };
                    centerpoint = { x: p1.x, y: p1.y - trackRendering_textured.CURVE_RADIUS };
                    deg = 45;
                }
                break;
            case SWITCH_TYPE.FROM_RIGHT:
                {
                    p1 = { x: switchpoint.x + x, y: switchpoint.y };
                    p2 = { x: switchpoint.x - x2, y: switchpoint.y + x2 };
                    p3 = { x: switchpoint.x - x2, y: switchpoint.y };
                    centerpoint = { x: p1.x, y: p1.y + trackRendering_textured.CURVE_RADIUS };
                    deg = 225;
                }
                break;
            case SWITCH_TYPE.FROM_LEFT:
                {
                    p1 = { x: switchpoint.x + x, y: switchpoint.y };
                    p2 = { x: switchpoint.x - x2, y: switchpoint.y - x2 };
                    p3 = { x: switchpoint.x - x2, y: switchpoint.y };
                    centerpoint = { x: p1.x, y: p1.y - trackRendering_textured.CURVE_RADIUS };
                    deg = 90;
                }
                break;

            default:
                break;
        }

        let angle = sw.km.is(0, track._tmp.length) ? sw.track._tmp.deg : track._tmp.deg;
        if (sw.type != SWITCH_TYPE.ARCH && angle != 0) {
            if (angle == 45) {
                if (type == SWITCH_TYPE.TO_LEFT) {
                    p2 = { x: switchpoint.x + x, y: switchpoint.y };
                    p1 = { x: switchpoint.x - x2, y: switchpoint.y - x2 };
                    p3 = { x: switchpoint.x + x2, y: switchpoint.y + x2 };
                    centerpoint = { x: p2.x, y: p2.y - trackRendering_textured.CURVE_RADIUS };
                    deg = 90;
                } else if (type == SWITCH_TYPE.FROM_RIGHT) {
                    p2 = { x: switchpoint.x - x, y: switchpoint.y };
                    p1 = { x: switchpoint.x + x2, y: switchpoint.y + x2 };
                    p3 = { x: switchpoint.x - x2, y: switchpoint.y - x2 };
                    centerpoint = { x: p2.x, y: p2.y + trackRendering_textured.CURVE_RADIUS };
                    deg = 270;
                }
            }
            if (angle == -45) {
                if (type == SWITCH_TYPE.TO_RIGHT) {
                    p2 = { x: switchpoint.x + x, y: switchpoint.y };
                    p1 = { x: switchpoint.x - x2, y: switchpoint.y + x2 };
                    p3 = { x: switchpoint.x + x2, y: switchpoint.y - x2 };
                    centerpoint = { x: p2.x, y: p2.y + trackRendering_textured.CURVE_RADIUS };
                    deg = 225;
                } else if (type == SWITCH_TYPE.FROM_LEFT) {
                    p2 = { x: switchpoint.x - x, y: switchpoint.y };
                    p1 = { x: switchpoint.x + x2, y: switchpoint.y - x2 };
                    p3 = { x: switchpoint.x - x2, y: switchpoint.y + x2 };
                    centerpoint = { x: p2.x, y: p2.y - trackRendering_textured.CURVE_RADIUS };
                    deg = 45;
                }
            }
        }

        if (sw.type === SWITCH_TYPE.DKW) {
            p1 = { x: switchpoint.x + x, y: switchpoint.y };
            p3 = { x: switchpoint.x - x, y: switchpoint.y };
            if (angleDeg > 0) p4 = { x: switchpoint.x + x2, y: switchpoint.y + x2 };
            else p4 = { x: switchpoint.x + x2, y: switchpoint.y - x2 };
            this.drawPoint(geometry.add(track.start, p4), "p4");
        }

        /* this.drawPoint(geometry.add(track.start, p1), "p1");
        this.drawPoint(geometry.add(track.start, p2), "p2");
        this.drawPoint(geometry.add(track.start, p3), "p3"); */
        //this.drawPoint(geometry.add(track.start, centerpoint), "c");

        return {
            p1: p1,
            p2: p2,
            p3: p3,
            p4: p4,
            centerpoint: centerpoint,
            type: type,
            deg: deg,
        };
    }

    drawStraightTrack(container, track) {
        let endpoint = geometry.sub(track.end, track.start),
            startpoint = new Point(0, 0);

        const rail_shape = new createjs.Shape();

        if (track._tmp.switches[0]) startpoint = track.unit.multiply(this.main_x1);
        if (track._tmp.switches[1]) endpoint = geometry.add(endpoint, track.unit.multiply(-this.main_x1));

        rail_shape.hitArea = this.createHitArea(startpoint, endpoint, track.deg);

        this.drawSchwellen(track, startpoint, endpoint, container, this.schwellenImg);
        container.addChild(rail_shape);
        this.drawStraightDoubleRail(rail_shape, startpoint, endpoint);
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
        this.drawCurvedRail(shape, values.centerpoint, values.deg, trackRendering_textured.CURVE_RADIUS - this.schwellenHöhe / 2 + this.rail_offset);
        this.drawCurvedRail(shape, values.centerpoint, values.deg, trackRendering_textured.CURVE_RADIUS + this.schwellenHöhe / 2 - this.rail_offset);
    }

    drawCurvedTrack_old(container, track) {
        const values = this.calcValuesForCurvedRail(track, sw, km, startDeg, endDeg);

        this.DrawImagesInCircle(container, values.centerpoint, trackRendering_textured.CURVE_RADIUS, values.deg, img, this.schwellenHöhe / 2);

        const shape = new createjs.Shape();
        container.addChild(shape);
        this.drawCurvedRail(shape, values.centerpoint, values.deg, trackRendering_textured.CURVE_RADIUS - this.schwellenHöhe / 2 + this.rail_offset);
        this.drawCurvedRail(shape, values.centerpoint, values.deg, trackRendering_textured.CURVE_RADIUS + this.schwellenHöhe / 2 - this.rail_offset);
    }

    drawCurvedRail(rail_shape, centerpoint, start_deg, radius) {
        trackRendering_textured.RAIL.forEach((r) => this.drawArc(rail_shape, centerpoint, radius, start_deg, r[1], r[0]));
    }

    drawSwitch(track, container, sw) {
        if (sw.type == SWITCH_TYPE.DKW && track._tmp.rad != 0) return;
        const switch_values = this.calcValuesForCurvedRail(track, sw);

        if (sw.type == SWITCH_TYPE.DKW) {
            let img = pl.getImage("dkw");
            container.addChild(
                new createjs.Bitmap(img).set({
                    y: switch_values.p3.y,
                    x: switch_values.p3.x - 1.8 + (sw.track._tmp.deg == 45 ? 0 : img.width * trackRendering_textured.TRACK_SCALE),
                    regY: img.height / 2,
                    scale: trackRendering_textured.TRACK_SCALE,
                    scaleX: sw.track._tmp.deg == 45 ? trackRendering_textured.TRACK_SCALE : -trackRendering_textured.TRACK_SCALE,
                    rotation: 0,
                })
            );
            return;
        }

        const s = new createjs.Shape();

        this.drawStraightDoubleRail(s, switch_values.p1, switch_values.p3);

        if (sw.type == SWITCH_TYPE.DKW) {
            this.drawStraightDoubleRail(s, switch_values.p2, switch_values.p4);
        }

        const schwelle = pl.getImage("schwellen");
        let random;
        let dir = sw.type.is(SWITCH_TYPE.FROM_RIGHT, SWITCH_TYPE.FROM_LEFT) ? -1 : 1;
        const schwellen = track._tmp.rad == 0 ? [0, 0, 0, 1, 2, 3, 4, 5, 6, 7, 8.2, 7] : [0, 0, 0, 1, 2, 3, 4, 5, 6, 7, 8.3, 7.5, 4.5, 0];
        const custom_gap = track._tmp.rad == 0 ? 2.599999999 : 2.54975; //werte festgelegt, müssten bei Grid size änderung neu berechnet werden
        schwellen.forEach((y, i) => {
            random = Math.randomInt(trackRendering_textured.SCHWELLEN_VARIANTEN - 1);
            let yy = switch_values.p1.y;
            yy += Math.sin(track._tmp.rad) * ((this.schwellenBreite + custom_gap) * (i * dir) + (this.schwellenGap / 2) * dir);
            yy +=
                Math.sin(track._tmp.rad + π / 2) *
                (sw.type.is(SWITCH_TYPE.FROM_RIGHT, SWITCH_TYPE.TO_RIGHT) ? -this.schwellenHöhe / 2 : this.schwellenHöhe / 2 - schwelle.height * (trackRendering_textured.TRACK_SCALE + y / 100));

            let xx = switch_values.p1.x;
            xx += Math.cos(track._tmp.rad) * ((this.schwellenBreite + custom_gap) * (i * dir) + (this.schwellenGap / 2) * dir);
            xx +=
                Math.cos(track._tmp.rad + π / 2) *
                (sw.type.is(SWITCH_TYPE.FROM_RIGHT, SWITCH_TYPE.TO_RIGHT) ? -this.schwellenHöhe / 2 : this.schwellenHöhe / 2 - schwelle.height * (trackRendering_textured.TRACK_SCALE + y / 100));

            container.addChild(
                new createjs.Bitmap(schwelle).set({
                    x: xx,
                    y: yy,
                    regX: dir == -1 ? schwelle.width / trackRendering_textured.SCHWELLEN_VARIANTEN : 0, //die schwellen, die Rückwärtslaufen gezeichnet werden, an der anderen Seite ausrichten
                    scale: trackRendering_textured.TRACK_SCALE,
                    scaleY: trackRendering_textured.TRACK_SCALE + y / 100,
                    sourceRect: new createjs.Rectangle(
                        (random * schwelle.width) / trackRendering_textured.SCHWELLEN_VARIANTEN,
                        0,
                        schwelle.width / trackRendering_textured.SCHWELLEN_VARIANTEN,
                        schwelle.height
                    ),
                    rotation: track._tmp.deg,
                })
            );
        });

        this.drawCurvedRail(s, switch_values.centerpoint, switch_values.deg, trackRendering_textured.CURVE_RADIUS - this.schwellenHöhe / 2 + this.rail_offset);
        this.drawCurvedRail(s, switch_values.centerpoint, switch_values.deg, trackRendering_textured.CURVE_RADIUS + this.schwellenHöhe / 2 - this.rail_offset);
        container.addChild(s);
    }

    drawArc(rail_shape, centerpoint, radius, start_deg, color, thickness) {
        rail_shape.graphics
            .setStrokeStyle(thickness)
            .beginStroke(color)
            .arc(centerpoint.x, centerpoint.y, radius, deg2rad(start_deg), deg2rad(start_deg + 45));
    }

    DrawSleepersInCircle(container, centerpoint, deg) {
        const radius = trackRendering_textured.CURVE_RADIUS;
        const l = (π / 4) * radius;
        let tmp = l / (this.schwellenBreite + this.schwellenGap);
        let anzSchwellen = Math.floor(tmp);

        let startAngle = deg2rad(deg);
        let endAngle = startAngle + π / 4;

        const step = (endAngle - startAngle) / anzSchwellen;
        let rad = startAngle + step / 4;
        let random;

        for (let i = 0; i < anzSchwellen; i++) {
            random = Math.randomInt(trackRendering_textured.SCHWELLEN_VARIANTEN - 1);

            container.addChild(
                new createjs.Bitmap(this.schwellenImg).set({
                    x: centerpoint.x + Math.cos(rad) * (radius + this.schwellenHöhe / 2),
                    y: centerpoint.y + Math.sin(rad) * (radius + this.schwellenHöhe / 2),
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
            if (sw.type.is(SWITCH_TYPE.ARCH, SWITCH_TYPE.CROSSING)) return;
        });
    }

    calcSwitchValues(sw) {
        const p1 = sw.t1.along(sw.location, this.main_x1);

        return { p1: p1, flip_hor: p1.x > sw.location.x, flip_vert: sw.type.is(SWITCH_TYPE.FROM_RIGHT, SWITCH_TYPE.TO_RIGHT) };
    }

    renderSwitch(container, sw) {
        const switch_values = this.calcSwitchValues(sw);
        let img;

        if (sw.type != SWITCH_TYPE.DKW) {
            img = pl.getImage("weiche");

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
            return;
        } else {
            let img = pl.getImage("dkw");
            container.addChild(
                new createjs.Bitmap(img).set({
                    y: switch_values.p1.y,
                    x: switch_values.p1.x - 1.8 + (sw.t1.deg == 45 ? 0 : img.width * trackRendering_textured.TRACK_SCALE),
                    regY: img.height / 2,
                    scale: trackRendering_textured.TRACK_SCALE,
                    scaleX: sw.t1.deg == 45 ? trackRendering_textured.TRACK_SCALE : -trackRendering_textured.TRACK_SCALE,
                    rotation: 0,
                })
            );
            return;
        }
    }

    reRenderSwitch(sw) {
        const s = ui_container.children.find((c) => c.sw == sw);
        if (s) s.parent.removeChild(s);

        renderSwitchUI(sw);
    }

    renderSwitchUI(sw) {}
}
