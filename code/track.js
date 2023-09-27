"use strict";

class trackShape {
    static findTrackbySignal(s) {
        return tracks.find((t) => t.signals.find((o) => o.signal == s) != undefined);
    }

    static FromObject(o) {
        let t = new trackShape(o.start, o.end);
        t.signals = o.signals;
        return t;
    }

    start = null;
    end = null;
    signals = [];

    SCHWELLEN_VARIANTEN = 24;

    //render values
    schwellenHöhe = 0;
    schwellenBreite = 0;
    schwellenGap = 0;
    rail_offset = 0;

    //Temp values
    deg = 0;
    rad = 0;
    length = 0;
    vector = null;
    switches = [];
    unit = null;

    constructor(start, end) {
        //Start und ende vertauschen, damit die Gleise immer in die selbe Richtung zeigen
        // unabhängig davon, wie rum sie gezeichnet wurden
        if (start.x < end.x) {
            this.start = start;
            this.end = end;
        } else {
            this.start = end;
            this.end = start;
        }

        this.calcTempValues();
    }

    calcTempValues() {
        this.vector = {
            x: this.end.x - this.start.x,
            y: this.end.y - this.start.y,
        }; // start ende von "y" vertauscht, da das Koordinatensystem gespiegelt arbeitet
        this.rad = Math.atan(this.vector.y / this.vector.x);
        this.deg = this.rad * (180 / Math.PI);

        this.length = geometry.length(this.vector);
        this.unit = geometry.unit(this.vector, this.length);
    }

    getPointfromKm(km) {
        return { x: (Math.cos(this.rad) * km).round(0), y: (Math.sin(this.rad) * km).round(0) };
    }

    setNewStart(newStart) {
        //1. check is slope is the same
        if (geometry.slope(this.start, this.end) != geometry.slope(newStart, this.end)) return;

        //2. check if new x is lower then old x
        if (newStart.x >= this.start.x) return;

        //3. calculate distance between new and old start
        const lengthAdded = geometry.distance(newStart, this.start);

        //4. set new start
        this.start = newStart;
        this.calcTempValues();

        //5. reposition all signals acording to the new length
        this.signals.forEach((p) => (p.km += lengthAdded));
    }

    setNewEnd(newEnd) {
        //1. check is slope is the same
        if (geometry.slope(this.start, this.end) != geometry.slope(newEnd, this.end)) return;

        //2. check if new x is higher then old x
        if (newEnd.x <= this.start.x) return;

        //3. set new end
        this.end = newEnd;
        this.calcTempValues();
    }

    draw(container) {
        if (!TEXTURE_MODE) {
            let shape = new createjs.Shape();
            shape.name = "track";
            shape.track = this;

            let hit = new createjs.Shape();

            let p1 = geometry.perpendicular(this.start, this.deg, -8);
            let p2 = geometry.perpendicular(this.start, this.deg, 8);
            const p3 = geometry.perpendicular(this.end, this.deg, 8);
            const p4 = geometry.perpendicular(this.end, this.deg, -8);

            hit.graphics.beginFill("#000").mt(p1.x, p1.y).lt(p2.x, p2.y).lt(p3.x, p3.y).lt(p4.x, p4.y).lt(p1.x, p1.y);
            shape.hitArea = hit;

            //container.addChild(hit);
            container.addChild(shape);

            shape.graphics.setStrokeStyle(stroke, "round").beginStroke(track_color);
            shape.color = shape.graphics.command;
            shape.graphics.moveTo(this.start.x, this.start.y).lineTo(this.end.x, this.end.y);
            if (!this.switches.some((p) => p.km == 0)) {
                //prellbock beim start
                p1 = geometry.perpendicular(this.start, this.deg, -6);
                p2 = geometry.perpendicular(this.start, this.deg, 6);
                shape.graphics.moveTo(p1.x, p1.y).lineTo(p2.x, p2.y);
            }

            if (!this.switches.some((p) => p.km == this.length)) {
                //prellbock beim ende
                p1 = geometry.perpendicular(this.end, this.deg, -6);
                p2 = geometry.perpendicular(this.end, this.deg, 6);
                shape.graphics.moveTo(p1.x, p1.y).lineTo(p2.x, p2.y);
            }
            //Weichen malen (kleines Dreieck in die Weiche)
            //Filter switches at start end end
            this.switches
                .filter((p) => p.km != 0 && p.km != this.length)
                .forEach((p) => {
                    let point = geometry.round(geometry.add(this.start, geometry.multiply(this.unit, p.km)));
                    //this.drawPoint(point, p.type);
                    if (!deepEqual(point, p.track.end)) {
                        p1 = geometry.add(point, geometry.multiply(this.unit, 10));
                        p2 = geometry.add(point, geometry.multiply(p.track.unit, 10));
                        shape.graphics.beginFill("#000").moveTo(point.x, point.y).lineTo(p1.x, p1.y).lineTo(p2.x, p2.y).cp();
                    }
                    if (!deepEqual(point, p.track.start)) {
                        p1 = geometry.add(point, geometry.multiply(this.unit, -10));
                        p2 = geometry.add(point, geometry.multiply(p.track.unit, -10));
                        shape.graphics.beginFill("#000").moveTo(point.x, point.y).lineTo(p1.x, p1.y).lineTo(p2.x, p2.y).cp();
                    }
                });
            return shape;
        } else {
            const texture_container = new createjs.Container();
            texture_container.name = "track";
            texture_container.track = this;
            texture_container.mouseChildren = false;
            let rail_shape = new createjs.Shape();
            const schwellenImg = pl.getImage("schwellen");
            //const kleinEisenImg = loadQueue.getResult("kleineisen");

            this.schwellenHöhe = schwellenImg.height * TRACK_SCALE;
            this.schwellenBreite = (schwellenImg.width / this.SCHWELLEN_VARIANTEN) * TRACK_SCALE;
            this.schwellenGap = this.schwellenBreite * 1;
            this.rail_offset = this.schwellenHöhe / 5;

            this.switches
                .filter((p) => p.km == this.length && p.type === SWITCH_TYPE.ARCH)
                .forEach((p) => {
                    this.drawCurvedTrack2(texture_container, p, p.km, this.deg, p.track.deg, schwellenImg);
                });

            this.switches
                .filter((p) => p.km != 0 && p.km != this.length)
                .forEach((p) => {
                    let switch_values = this.calcValuesForCurvedRail2(p, p.km, this.deg, p.track.deg);
                    let switch_location = this.getPointfromKm(p.km);

                    this.drawSwitch(texture_container, p, switch_values);
                    /* texture_container.addChild(
                        new createjs.Bitmap(pl.getImage("weiche_ru")).set({
                            x: switch_values.p1.x,
                            y: switch_values.p1.y,
                            regY: this.schwellenHöhe / 2 / TRACK_SCALE,
                            scale: TRACK_SCALE,
                            rotation: -this.deg,
                            scaleY: geometry.slope(switch_values.p1,switch_values.p3) > geometry.slope(switch_values.p1,switch_values.p2)? -TRACK_SCALE : TRACK_SCALE,
                        })
                    ); */

                    /* switch (p.type) {
                        case SWITCH_TYPE.RIGHT_BOTTOM:
                            {
                                texture_container.addChild(
                                    new createjs.Bitmap(pl.getImage("weiche_ru")).set({
                                        x: p.km - grid_size_2 - 4.8,
                                        y: -(this.schwellenHöhe/2+0.5),
                                        scale: TRACK_SCALE,
                                        rotation: 0,
                                    })
                                );
                            }
                            break;
                        case SWITCH_TYPE.LEFT_TOP:
                            {
                                texture_container.addChild(
                                    new createjs.Bitmap(pl.getImage("weiche_ru")).set({
                                        x: p.km - grid_size_2 - 4.8,
                                        y: (this.schwellenHöhe/2+0.5),
                                        scale: TRACK_SCALE,
                                        rotation: 0,
                                        scaleY:-TRACK_SCALE
                                    })
                                );
                            }
                            break;

                        default:
                            break;
                    } */
                });

            let km_start = 0,
                km_end = 0,
                x = 0,
                y = 0,
                counter = 0,
                weiche = null,
                switch_values = {},
                endpoint = null,
                startpoint = { x: 0, y: 0 },
                km = 0;
            do {
                if (this.switches.length > counter) {
                    weiche = this.switches[counter];

                    if (weiche.km != 0) switch_values = this.calcValuesForCurvedRail2(weiche, weiche.km, this.deg, weiche.track.deg);
                    else switch_values = this.calcValuesForCurvedRail2(weiche, weiche.km, weiche.track.deg, this.deg);

                    if (weiche.km > km) {
                        //weiche nach mir
                        if (switch_values.type == SWITCH_TYPE.TO_LEFT || switch_values.type == SWITCH_TYPE.TO_RIGHT) endpoint = switch_values.p1;
                        else {
                            if (weiche.km == this.length) endpoint = switch_values.p2;
                            else endpoint = switch_values.p3;
                        }
                    } else endpoint = null;
                    km = weiche?.km;
                } else {
                    weiche = null;
                    endpoint = this.getPointfromKm(this.length);
                    km = this.length;
                }

                if (endpoint) {
                    this.drawSchwellen(startpoint, endpoint, texture_container, schwellenImg);

                    [-this.schwellenHöhe / 2 + this.rail_offset, this.schwellenHöhe / 2 - this.rail_offset].forEach((y) => {
                        this.drawStraightRail(rail_shape, startpoint, endpoint, y);
                    });
                }

                if (weiche) {
                    counter++;
                    if (switch_values.type == SWITCH_TYPE.FROM_LEFT || switch_values.type == SWITCH_TYPE.FROM_RIGHT) startpoint = switch_values.p1;
                    else {
                        if (weiche.km == 0) startpoint = switch_values.p2;
                        else startpoint = switch_values.p3;
                    }
                }
            } while (km < this.length);

            texture_container.addChild(rail_shape);

            texture_container.x = this.start.x;
            texture_container.y = this.start.y;

            container.addChild(texture_container);
            return texture_container;
        }
    }

    drawSchwellen(startPoint, endPoint, texture_container, schwellenImg) {
        const cos = Math.cos(this.rad),
            sin = Math.sin(this.rad);

        //kleine verschieben, damit man mit einer lücke anfängt - Zentrierung der schwelle

        let x = startPoint.x + sin * (this.schwellenHöhe / 2) + cos * (this.schwellenGap / 2);
        let y = startPoint.y - cos * (this.schwellenHöhe / 2) + sin * (this.schwellenGap / 2);
        let l = geometry.distance(startPoint, endPoint);
        let tmp = l / (this.schwellenBreite + this.schwellenGap);
        let anzSchwellen = Math.floor(tmp);
        let custom_gap = (tmp - anzSchwellen) * (this.schwellenBreite + this.schwellenGap)/anzSchwellen + this.schwellenGap;
        anzSchwellen * this.schwellenBreite;

        for (let i = 0; i < anzSchwellen; i++) {
            let random = Math.randomInt(this.SCHWELLEN_VARIANTEN - 1);
            texture_container.addChild(
                new createjs.Bitmap(schwellenImg).set({
                    y: y,
                    x: x,
                    sourceRect: new createjs.Rectangle((random * schwellenImg.width) / this.SCHWELLEN_VARIANTEN, 0, schwellenImg.width / this.SCHWELLEN_VARIANTEN, schwellenImg.height),
                    scale: TRACK_SCALE,
                    rotation: this.deg,
                })
            );
            y += sin * (this.schwellenBreite + custom_gap);
            x += cos * (this.schwellenBreite + custom_gap);
        }
    }

    drawPoint(point, label = "", color = "#000", size = 1) {
        const s = new createjs.Shape();
        s.graphics.setStrokeStyle(1).beginStroke(color).beginFill(color).drawCircle(0, 0, size);
        s.x = point.x; //+ this.start.x;
        s.y = point.y; //+ this.start.y;

        ui_container.addChild(s);

        if (label) {
            const text = new createjs.Text(label, "Italic 10px Arial", color);
            text.x = s.x;
            text.y = s.y - 5;
            text.textBaseline = "alphabetic";
            ui_container.addChild(text);
        }
    }

    drawStraightRail(rail_shape, startPoint, endPoint, y) {
        const cos = Math.cos(this.rad + π / 2),
            sin = Math.sin(this.rad + π / 2);

        let x1 = startPoint.x + cos * y,
            x2 = endPoint.x + cos * y,
            y1 = startPoint.y + sin * y,
            y2 = endPoint.y + sin * y;

        rail_shape.graphics.setStrokeStyle(1.4).beginStroke("#222");
        rail_shape.graphics.moveTo(x1, y1).lineTo(x2, y2);
        rail_shape.graphics.setStrokeStyle(1.2).beginStroke("#999999");
        rail_shape.graphics.moveTo(x1, y1).lineTo(x2, y2);
        rail_shape.graphics.setStrokeStyle(0.6).beginStroke("#eeeeee");
        rail_shape.graphics.moveTo(x1, y1).lineTo(x2, y2);
    }

    calcValuesForCurvedRail2(sw) {
        const switchpoint = this.getPointfromKm(sw.km);
        let type = sw.type;

        if (sw.type == SWITCH_TYPE.ARCH) {
            let angleDeg = this.deg == 0 ? sw.track.deg : this.deg;
            if (this.deg != 0) {
                angleDeg = this.deg;
                if (sw.km == this.length) angleDeg += 180;
            } else {
                angleDeg = sw.track.deg;
                if (sw.km == 0) angleDeg += 180;
            }

            if (angleDeg < 0) angleDeg += 360;

            type = ((angleDeg / 45) % 8) + 1;
        }

        const cord_2 = Math.sin(π / 8) * CURVE_RADIUS;

        let x = cord_2 / Math.cos(π / 8);
        let p1 = null;

        let x2 = x * Math.sin(π / 4);
        let p2 = null;
        let p3 = { x: switchpoint.x + x2, y: switchpoint.y };

        let centerpoint = {};
        let deg;

        switch (type) {
            case SWITCH_TYPE.TO_RIGHT:
                {
                    p1 = { x: switchpoint.x - x, y: switchpoint.y };
                    p2 = { x: switchpoint.x + x2, y: switchpoint.y + x2 };
                    p3 = { x: switchpoint.x + x2, y: switchpoint.y };
                    centerpoint = { x: p1.x, y: p1.y + CURVE_RADIUS };
                    deg = 270;
                }
                break;
            case SWITCH_TYPE.TO_LEFT:
                {
                    p1 = { x: switchpoint.x - x, y: switchpoint.y };
                    p2 = { x: switchpoint.x + x2, y: switchpoint.y - x2 };
                    p3 = { x: switchpoint.x + x2, y: switchpoint.y };
                    centerpoint = { x: p1.x, y: p1.y - CURVE_RADIUS };
                    deg = 45;
                }
                break;
            case SWITCH_TYPE.FROM_RIGHT:
                {
                    p1 = { x: switchpoint.x + x, y: switchpoint.y };
                    p2 = { x: switchpoint.x - x2, y: switchpoint.y + x2 };
                    p3 = { x: switchpoint.x - x2, y: switchpoint.y };
                    centerpoint = { x: p1.x, y: p1.y + CURVE_RADIUS };
                    deg = 225;
                }
                break;
            case SWITCH_TYPE.FROM_LEFT:
                {
                    p1 = { x: switchpoint.x + x, y: switchpoint.y };
                    p2 = { x: switchpoint.x - x2, y: switchpoint.y - x2 };
                    p3 = { x: switchpoint.x - x2, y: switchpoint.y };
                    centerpoint = { x: p1.x, y: p1.y - CURVE_RADIUS };
                    deg = 90;
                }
                break;

            default:
                break;
        }

        let angle = sw.km.is(0, this.length) ? sw.track.deg : this.deg;
        if (sw.type != SWITCH_TYPE.ARCH && angle != 0) {
            if (angle == 45) {
                if (type == SWITCH_TYPE.TO_LEFT) {
                    p2 = { x: switchpoint.x + x, y: switchpoint.y };
                    p1 = { x: switchpoint.x - x2, y: switchpoint.y - x2 };
                    p3 = { x: switchpoint.x + x2, y: switchpoint.y + x2 };
                    centerpoint = { x: p2.x, y: p2.y - CURVE_RADIUS };
                    deg = 90;
                } else if (type == SWITCH_TYPE.FROM_RIGHT) {
                    p2 = { x: switchpoint.x - x, y: switchpoint.y };
                    p1 = { x: switchpoint.x + x2, y: switchpoint.y + x2 };
                    p3 = { x: switchpoint.x - x2, y: switchpoint.y - x2 };
                    centerpoint = { x: p2.x, y: p2.y + CURVE_RADIUS };
                    deg = 270;
                }
            }
            if (angle == -45) {
                if (type == SWITCH_TYPE.TO_RIGHT) {
                    p2 = { x: switchpoint.x + x, y: switchpoint.y };
                    p1 = { x: switchpoint.x - x2, y: switchpoint.y + x2 };
                    p3 = { x: switchpoint.x + x2, y: switchpoint.y - x2 };
                    centerpoint = { x: p2.x, y: p2.y + CURVE_RADIUS };
                    deg = 225;
                } else if (type == SWITCH_TYPE.FROM_LEFT) {
                    p2 = { x: switchpoint.x - x, y: switchpoint.y };
                    p1 = { x: switchpoint.x + x2, y: switchpoint.y - x2 };
                    p3 = { x: switchpoint.x - x2, y: switchpoint.y + x2 };
                    centerpoint = { x: p2.x, y: p2.y - CURVE_RADIUS };
                    deg = 45;
                }
            }
        }
        /* this.drawPoint(geometry.add(this.start, p1), "p1");
        this.drawPoint(geometry.add(this.start, p2), "p2");
        this.drawPoint(geometry.add(this.start, p3), "p3");
        this.drawPoint(geometry.add(this.start, centerpoint), "c"); */

        return {
            p1: p1,
            p2: p2,
            p3: p3,
            centerpoint: centerpoint,
            type: type,
            deg: deg,
        };
    }

    drawCurvedTrack2(container, sw, km, startDeg, endDeg, img) {
        const values = this.calcValuesForCurvedRail2(sw, km, startDeg, endDeg);

        this.DrawImagesInCircle(container, values.centerpoint, CURVE_RADIUS, values.deg, img, this.schwellenHöhe / 2);

        const shape = new createjs.Shape();
        container.addChild(shape);
        this.drawCurvedRail2(shape, values.centerpoint, values.deg, CURVE_RADIUS - this.schwellenHöhe / 2 + this.rail_offset);
        this.drawCurvedRail2(shape, values.centerpoint, values.deg, CURVE_RADIUS + this.schwellenHöhe / 2 - this.rail_offset);
    }

    drawCurvedRail2(rail_shape, centerpoint, start_deg, radius) {
        this.drawArc(rail_shape, centerpoint, radius, start_deg, "#222", 1.4);
        this.drawArc(rail_shape, centerpoint, radius, start_deg, "#999", 1.2);
        this.drawArc(rail_shape, centerpoint, radius, start_deg, "#eee", 0.6);
    }

    drawSwitch(container, p, switch_values) {
        const s = new createjs.Shape();

        [-this.schwellenHöhe / 2 + this.rail_offset, this.schwellenHöhe / 2 - this.rail_offset].forEach((y) => {
            this.drawStraightRail(s, switch_values.p1, switch_values.p3, y);
        });

        const schwelle = pl.getImage("schwellen");
        let random;
        let dir = p.type.is(SWITCH_TYPE.FROM_RIGHT, SWITCH_TYPE.FROM_LEFT) ? -1 : 1;
        const schwellen = this.rad == 0 ? [0, 0, 0, 1, 2, 3, 4, 5, 6, 7, 8.2, 7] : [0, 0, 0, 1, 2, 3, 4, 5, 6, 7, 8.3, 7.5, 4.5, 0, ];
        const custom_gap = this.rad == 0 ?2.599999999:2.54975;
        schwellen.forEach((y, i) => {
            random = Math.randomInt(this.SCHWELLEN_VARIANTEN - 1);
            let yy = switch_values.p1.y;
            yy += Math.sin(this.rad) * ((this.schwellenBreite + custom_gap) * (i * dir) + (this.schwellenGap / 2) * dir);
            yy += Math.sin(this.rad + π / 2) * (p.type.is(SWITCH_TYPE.FROM_RIGHT, SWITCH_TYPE.TO_RIGHT) ? -this.schwellenHöhe / 2 : this.schwellenHöhe / 2 - schwelle.height * (TRACK_SCALE + y / 100));

            let xx = switch_values.p1.x;
            xx += Math.cos(this.rad) * ((this.schwellenBreite + custom_gap) * (i * dir) + (this.schwellenGap / 2) * dir);
            xx += Math.cos(this.rad + π / 2) * (p.type.is(SWITCH_TYPE.FROM_RIGHT, SWITCH_TYPE.TO_RIGHT) ? -this.schwellenHöhe / 2 : this.schwellenHöhe / 2 - schwelle.height * (TRACK_SCALE + y / 100));

            container.addChild(
                new createjs.Bitmap(schwelle).set({
                    x: xx,
                    y: yy,
                    regX: dir == -1 ? schwelle.width / this.SCHWELLEN_VARIANTEN : 0, //die schwellen, die Rückwärtslaufen gezeichnet werden, an der anderen Seite ausrichten
                    scale: TRACK_SCALE,
                    scaleY: TRACK_SCALE + y / 100,
                    sourceRect: new createjs.Rectangle((random * schwelle.width) / this.SCHWELLEN_VARIANTEN, 0, schwelle.width / this.SCHWELLEN_VARIANTEN, schwelle.height),
                    rotation: this.deg,
                })
            );
        });

        this.drawCurvedRail2(s, switch_values.centerpoint, switch_values.deg, CURVE_RADIUS - this.schwellenHöhe / 2 + this.rail_offset);
        this.drawCurvedRail2(s, switch_values.centerpoint, switch_values.deg, CURVE_RADIUS + this.schwellenHöhe / 2 - this.rail_offset);
        container.addChild(s);
    }

    drawArc(rail_shape, centerpoint, radius, start_deg, color, thickness) {
        rail_shape.graphics
            .setStrokeStyle(thickness)
            .beginStroke(color)
            .arc(centerpoint.x, centerpoint.y, radius, deg2rad(start_deg), deg2rad(start_deg + 45));
    }

    DrawImagesInCircle(container, centerpoint, radius, deg, img, offset = 0) {
        const l = (π / 4) * radius;
        let tmp = l / (this.schwellenBreite + this.schwellenGap);
        let anzSchwellen = Math.floor(tmp);

        let startAngle = deg2rad(deg);
        let endAngle = startAngle + π / 4;

        const step = (endAngle - startAngle) / anzSchwellen;
        let rad = startAngle+step/4;
        let random;

        for (let i = 0; i < anzSchwellen; i++) {
            random = Math.randomInt(this.SCHWELLEN_VARIANTEN - 1);

            container.addChild(
                new createjs.Bitmap(img).set({
                    x: centerpoint.x + Math.cos(rad) * (radius + offset),
                    y: centerpoint.y + Math.sin(rad) * (radius + offset),
                    scale: TRACK_SCALE,
                    sourceRect: new createjs.Rectangle((random * img.width) / this.SCHWELLEN_VARIANTEN, 0, img.width / this.SCHWELLEN_VARIANTEN, img.height),
                    rotation: (rad * 180) / Math.PI + 90,
                })
            );

            rad += step;
        }
    }

    AddSignal(position) {
        let i = this.signals.findIndex((item) => position.km > item.km);
        this.signals.splice(i + 1, 0, position);
    }

    AddSwitch(weiche) {
        let i = this.switches.findIndex((item) => weiche.km < item.km);
        if (i == -1) this.switches.push(weiche);
        else this.switches.splice(i, 0, weiche);
    }

    removeSignal(s) {
        let i = this.signals.findIndex((item) => s === item.signal);
        if (i != -1) {
            this.signals.splice(i, 1);
        }
    }

    stringify() {
        return { start: this.start, end: this.end, signals: this.signals };
    }
}

class signalShape {
    static FromObject(o) {
        let s = new signalShape(signalTemplates[o._template]);
        s._signalStellung = o._signalStellung;
        s.options.map = o.options.map;
        return s;
    }

    _template = null;
    _signalStellung = {};

    options = {
        map: new Map(),
        set: function (o, value) {
            const splitted = o.split(".");
            if (splitted.length == 1) {
                if (value) this.map.set(o, true);
                else this.map.delete(o);
            } else if (splitted.length == 2) this.map.set(splitted[0], splitted[1]);
            else throw new Error();
        },
        match: function (options) {
            if (options == null || options.length == 0) return true; // wenn das visualElement keine Options fordert, ist es immer ein match
            const match_single = function (singleOptions) {
                const splitted = singleOptions.split(".");
                const antiMatch = splitted[0][0] == "!";
                let retValue;
                if (antiMatch) splitted[0] = splitted[0].substring(1);
                if (splitted.length == 1) retValue = this.map.has(splitted[0]);
                else if (splitted.length == 2) retValue = this.map.get(splitted[0]) == splitted[1];
                else throw new Error();

                return antiMatch ? !retValue : retValue;
            }.bind(this);
            if (Array.isArray(options)) {
                return options.find(match_single) != null;
            } else return match_single(options);
        },
        stringify: function () {
            return JSON.stringify(Array.from(this.map.entries()));
        },
    };

    constructor(template) {
        this._template = template;

        if (template.startOptions)
            if (Array.isArray(template.startOptions)) template.startOptions.forEach((i) => this.options.set(i));
            else this.options.set(template.startOptions);

        if (template.start)
            if (Array.isArray(template.start)) template.start.forEach((i) => this.set(i));
            else this.set(template.start);
    }

    set(stellung, value) {
        const splitted = stellung.split("=");
        if (splitted.length == 1) this._signalStellung[splitted[0]] = value;
        else if (this.check(stellung)) delete this._signalStellung[splitted[0]];
        else this._signalStellung[splitted[0]] = splitted[1];
    }

    get(stellung) {
        return this._signalStellung[stellung];
    }

    check(stellung) {
        if (stellung == null) return true;
        const splitted = stellung.split("=");
        return splitted.length == 1 || this._signalStellung[splitted[0]] == splitted[1];
    }

    draw(c) {
        this._rendering = { container: c };

        this._template.elements.forEach((ve) => this.drawVisualElement(ve));

        this._rendering = null;
    }

    drawVisualElement(ve) {
        if (ve instanceof TextElement) {
            var js_text = new createjs.Text(ve.getText(this), ve.format, ve.color);
            js_text.x = ve.pos[0];
            js_text.y = ve.pos[1];
            js_text.textAlign = "center";
            js_text.textBaseline = "top";
            js_text.lineHeight = 20;
            this._rendering.container.addChild(js_text);
        } else if (ve instanceof VisualElement) {
            if (this.options.match(ve.options) && this._template.VisualElementIsAllowed(ve, this) && ve.isEnabled(this))
                if (ve.image) {
                    if (Array.isArray(ve.image)) ve.image.forEach((i) => this.addImage(i, { blinkt: ve.blinkt, pos: ve.pos }));
                    else
                        this.addImage(ve.image, {
                            blinkt: ve.blinkt,
                            pos: ve.pos,
                        });
                } else if (ve.childs) {
                    ve.childs.forEach((c) => this.drawVisualElement(c));
                }
        } else console.log(ve);
    }

    addImage(texture_name, { pos = null, blinkt = false } = {}) {
        if (texture_name == null || texture_name == "") return;

        let bmp = pl.getSprite(this._template.json_file, texture_name);
        if (bmp != null) {
            if (pos) {
                bmp.x = pos[0];
                bmp.y = pos[1];
            }

            this._rendering.container.addChild(bmp);

            if (blinkt) {
                createjs.Tween.get(bmp, { loop: true }).wait(1000).to({ alpha: 0 }, 200).wait(800).to({ alpha: 1 }, 50);
            }

            return bmp;
        } else console.log(texture_name + " nicht gezeichnet");
    }

    getHTML() {
        const ul = $("<ul>", { class: "list-group list-group-flush" });

        const filterTree = function (array) {
            let a = [];
            array.forEach((item) => {
                if (this.options.match(item.options)) {
                    if (item.switchable) a.push(item);
                    if (item.childs) a = a.concat(filterTree(item.childs));
                }
            });

            return a;
        }.bind(this);

        const switchable_visuell_elements = filterTree(this._template.elements);

        const groups = new Map();

        switchable_visuell_elements.forEach((e) => {
            const s = e.stellung.split("=")[0];
            if (!groups.has(s)) groups.set(s, [e]);
            else groups.get(s).push(e);
        });

        groups.forEach((group) => {
            if (!(group[0] instanceof TextElement))
                ul.append($("<li>", { class: "list-group-item" }).append(ui.create_buttonGroup(group.map((e) => ui.create_toggleButton(e.btn_text, "", e.stellung, this)))));
            else ul.append($("<li>", { class: "list-group-item" }).append(ui.create_Input(group[0].btn_text, group[0].stellung, this)));
        });

        this.syncHTML(ul);
        return ul;
    }

    syncHTML(popup) {
        let buttons = $("button", popup);
        buttons.each((i, e) => {
            const stellung = e.attributes["data_signal"].value;
            $(e).toggleClass("active", this.check(stellung));

            if (this._template.StellungIsAllowed(stellung[0], this)) $(e).removeAttr("disabled");
            else $(e).attr("disabled", "disabled");
        });

        /* let switchable_visuell_elements = this._template.elements.filter((e) => e.switchable && this.options.match(e.options));
        switchable_visuell_elements.forEach(element => {
            let button = $("#btn_" + element.id, popup);
            if (button.length) {
                if (element.isEnabled(this)) {
                    button.addClass("active");
                    button.attr("aria-pressed", "true");
                }
                else {
                    button.attr("aria-pressed", "false");
                    button.removeClass("active");
                }
    
                if (element.isAllowed(this))
                    button.removeAttr('disabled');
                else
                    button.attr('disabled', 'disabled');
    
            }
        }); */
    }

    getContectMenu() {
        return this._template.contextMenu;
    }
}
