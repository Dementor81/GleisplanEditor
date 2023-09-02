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
            y: this.start.y - this.end.y,
        }; // start ende vertauscht, da das Koordinatensystem gespiegelt arbeitet
        this.rad = Math.atan(this.vector.y / this.vector.x);
        this.deg = this.rad * (180 / Math.PI);

        this.length = geometry.length(this.vector);
        this.unit = geometry.unit(this.vector, this.length);
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
        if (!loadQueue.loaded) {
            console.log("waiting...");
            setTimeout(
                function () {
                    this.draw(container);
                }.bind(this),
                500
            );
            return;
        }
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

        if (!TEXTURE_MODE) {
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
                    let point = geometry.round(geometry.add(this.start, geometry.flipY(geometry.multiply(this.unit, p.km))));
                    if (!deepEqual(point, p.track.end)) {
                        p1 = geometry.add(point, geometry.flipY(geometry.multiply(this.unit, 10)));
                        p2 = geometry.add(point, geometry.flipY(geometry.multiply(p.track.unit, 10)));
                        shape.graphics.beginFill("#000").moveTo(point.x, point.y).lineTo(p1.x, p1.y).lineTo(p2.x, p2.y).cp();
                    }
                    if (!deepEqual(point, p.track.start)) {
                        p1 = geometry.add(point, geometry.flipY(geometry.multiply(this.unit, -10)));
                        p2 = geometry.add(point, geometry.flipY(geometry.multiply(p.track.unit, -10)));
                        shape.graphics.beginFill("#000").moveTo(point.x, point.y).lineTo(p1.x, p1.y).lineTo(p2.x, p2.y).cp();
                    }
                });
            //} else {
            const texture_container = new createjs.Container();
            let rail_shape = new createjs.Shape();
            const schwellenImg = loadQueue.getResult("schwellen");
            const kleinEisenImg = loadQueue.getResult("kleineisen");

            this.schwellenHöhe = schwellenImg.height * TRACK_SCALE;
            this.schwellenBreite = (schwellenImg.width / this.SCHWELLEN_VARIANTEN) * TRACK_SCALE;
            this.schwellenGap = this.schwellenBreite * 1;
            this.rail_offset = this.schwellenHöhe / 5;

            this.switches
                .filter((p) => p.km == this.length && p.type === SWITCH_TYPE.ARCH)
                .forEach((p) => {
                    this.drawCurvedTrack(texture_container, p.km, this.deg, p.track.deg, schwellenImg);
                });

            /* this.switches
                .filter((p) => p.km != 0 && p.km != this.length)
                .forEach((p) => {
                    switch (p.type) {
                        case SWITCH_TYPE.RIGHT_BOTTOM:
                            {
                                texture_container.addChild(
                                    new createjs.Bitmap(loadQueue.getResult("weicheRU")).set({
                                        x: p.km - grid_size_2 - 3.4,
                                        y: -0.4,
                                        scale: 0.078,
                                        rotation: 0,
                                    })
                                );
                            }
                            break;
                        case SWITCH_TYPE.LEFT_TOP:
                            {
                                texture_container.addChild(
                                    new createjs.Bitmap(loadQueue.getResult("weicheLO")).set({
                                        x: p.km - grid_size_2 - 2,
                                        y: -25,
                                        scale: 0.13,
                                        rotation: 0,
                                    })
                                );
                            }
                            break;

                        default:
                            break;
                    }
                }); */

            let x_start = 0,
                x_end = 0,
                x = 0,
                y = 0,
                counter = 0,
                weiche = null,
                anzSchwellen = 0,
                random = 0;

            const cos = Math.cos(this.rad),
                sin = Math.sin(this.rad);
            const step = grid_size / cos;

            do {
                if (this.switches.length > counter) {
                    weiche = this.switches[counter];
                    x_end = weiche.km - step / 2;
                } else x_end = this.length;
                if (x_end > x_start) {
                    anzSchwellen = Math.floor((x_end - x_start) / (this.schwellenBreite + this.schwellenGap));

                    for (let i = 0; i < anzSchwellen; i++) {
                        random = Math.randomInt(this.SCHWELLEN_VARIANTEN - 1);
                        texture_container.addChild(
                            new createjs.Bitmap(schwellenImg).set({
                                y: 0 - sin * ((this.schwellenBreite + this.schwellenGap) * i) - sin * x_start  - cos * (this.schwellenHöhe / 2),
                                x: cos * ((this.schwellenBreite + this.schwellenGap) * i) + cos * x_start - sin * (this.schwellenHöhe / 2),
                                sourceRect: new createjs.Rectangle((random * schwellenImg.width) / this.SCHWELLEN_VARIANTEN, 0, schwellenImg.width / this.SCHWELLEN_VARIANTEN, schwellenImg.height),
                                scale: TRACK_SCALE,
                                rotation: -this.deg,
                            })
                        );
                    }

                    [-this.schwellenHöhe / 2 + this.rail_offset, this.schwellenHöhe / 2 - this.rail_offset].forEach((y) => {
                        this.drawStraightRail(rail_shape, x_start, x_end, y, this.rad);
                    });
                }
                x_start = x_end + step;
                counter++;
            } while (x_start < this.length);

            /* y =  this.rail_offset - (kleinEisenImg.height * TRACK_SCALE) / 2;
            let x = x_offset + (schwellenBreite / 2 - kleinEisenImg.width / 2) * TRACK_SCALE + ( this.schwellenGap * TRACK_SCALE) / 2;
            let y2 = this.schwellenHöhe * TRACK_SCALE -  this.rail_offset - (kleinEisenImg.height * TRACK_SCALE) / 2;
            for (let i = 0; i < anzSchwellen; i++) {
                [y, y2].forEach((_y) =>
                    texture_container.addChild(
                        new createjs.Bitmap(kleinEisenImg).set({
                            y: _y,
                            x: x,
                            scale: TRACK_SCALE,
                        })
                    )
                );
                x += (schwellenBreite +  this.schwellenGap) * TRACK_SCALE;
            }  */

            texture_container.addChild(rail_shape);

            //texture_container.regY = (this.schwellenHöhe * TRACK_SCALE) / 2;
            texture_container.x = this.start.x;
            texture_container.y = this.start.y;
            //texture_container.rotation = this.deg * -1;

            container.addChild(texture_container);
        }
    }

    drawPoint(point, label = "", color = "#000", size = 5) {
        const s = new createjs.Shape();
        s.graphics.setStrokeStyle(1).beginStroke(color).beginFill(color).drawCircle(0, 0, size);
        s.x = point.x;
        s.y = point.y;

        stage.addChild(s);

        if (label) {
            const text = new createjs.Text(label, "Italic 12px Arial", color);
            text.x = point.x;
            text.y = point.y - 5;
            text.textBaseline = "alphabetic";
            stage.addChild(text);
        }
    }

    drawStraightRail(rail_shape, x_start, x_end, y, rad) {
        let x1 = Math.cos(rad) * x_start + Math.sin(rad) * y,
            y1 = 0 - Math.sin(rad) * x_start + Math.cos(rad) * y,
            x2 = Math.cos(rad) * x_end + Math.sin(rad) * y,
            y2 = 0 - Math.sin(rad) * x_end + Math.cos(rad) * y;

        rail_shape.graphics.setStrokeStyle(1.4).beginStroke("#222");
        rail_shape.graphics.moveTo(x1, y1).lineTo(x2, y2);
        rail_shape.graphics.setStrokeStyle(1.2).beginStroke("#999999");
        rail_shape.graphics.moveTo(x1, y1).lineTo(x2, y2);
        rail_shape.graphics.setStrokeStyle(0.6).beginStroke("#eeeeee");
        rail_shape.graphics.moveTo(x1, y1).lineTo(x2, y2);
    }

    drawCurvedTrack(container, x, startDeg, endDeg, img) {
        let y1 = 0,
            y2 = 0,
            clockwise = 0;
        if (startDeg == 0 && endDeg == 45) {
            y2 = -grid_size_2;
            clockwise = 0;
        } else if (startDeg == 0 && endDeg == -45) {
            y2 = 0 - grid_size_2;
            clockwise = 0;
        } else if (startDeg == 45 && endDeg == 0) {
            y1 = 0 - grid_size_2;
            clockwise = 0;
        } else if (startDeg == -45 && endDeg == 0) {
            y1 = grid_size_2;
            clockwise = 1;
        }

        let p1 = { x: x - grid_size_2, y: y1 };
        let p2 = { x: x + grid_size_2, y: y2 };

        this.DrawImagesInCircle(container, 45, clockwise, p1, p2, img, this.schwellenHöhe / 2);
        const shape = new createjs.Shape();
        container.addChild(shape);
        this.drawCurvedRail(shape, clockwise, p1, p2, -this.schwellenHöhe / 2 + this.rail_offset);
        this.drawCurvedRail(shape, clockwise, p1, p2, this.schwellenHöhe / 2 - this.rail_offset);
    }

    drawCurvedRail(rail_shape, clockwise, p1, p2, radius_offset) {
        this.drawArc(rail_shape, 45, clockwise, p1, p2, "#222", 1.4, radius_offset);
        this.drawArc(rail_shape, 45, clockwise, p1, p2, "#999", 1.2, radius_offset);
        this.drawArc(rail_shape, 45, clockwise, p1, p2, "#eee", 0.6, radius_offset);
    }

    drawArc(rail_shape, deg, clockwise, p1, p2, color, thickness, offset = 0) {
        // Define the desired angle in radians
        let desiredAngle = deg2rad(deg);

        // Calculate the distance between the two points
        let distance = geometry.distance(p1, p2);

        // Calculate the radius of the circle
        let radius = distance / 2 / Math.sin(desiredAngle / 2);

        let h = Math.sqrt(Math.pow(radius, 2) - Math.pow(distance / 2, 2));

        if (clockwise) h *= -1;

        // Calculate the angle between the x-axis and the line connecting the two points
        let lineAngle = Math.atan2(p2.y - p1.y, p2.x - p1.x);

        //1st calculate the midpoint between p1 and p2, then calc a perpendicular point by adding 90° to the lineAngle with h as heigth above the midpoint.
        let pointC = { x: (p1.x + p2.x) / 2 - Math.cos(lineAngle + Math.PI / 2) * h, y: (p1.y + p2.y) / 2 - Math.sin(lineAngle + Math.PI / 2) * h };
        //drawPoint(pointC, "pC", "#000", 3);

        //drawLine(midpoint, pointC);

        // Calculate the starting and ending angles for drawing the circular curve
        if (!clockwise) lineAngle += Math.PI;
        let startAngle = lineAngle - desiredAngle / 2 - Math.PI / 2;
        let endAngle = desiredAngle + startAngle;

        rail_shape.graphics
            .setStrokeStyle(thickness)
            .beginStroke(color)
            .arc(pointC.x, pointC.y, radius + offset, startAngle, endAngle);
    }

    DrawImagesInCircle(container, deg, clockwise, p1, p2, img, offset = 0) {
        // Define the desired angle in radians
        const desiredAngle = deg2rad(deg);

        // Calculate the distance between the two points
        const distance = geometry.distance(p1, p2);

        // Calculate the radius of the circle
        const radius = distance / 2 / Math.sin(desiredAngle / 2);

        let length = 2 * Math.PI * radius * (deg / 360);
        const step = desiredAngle / Math.floor(length / (this.schwellenGap + this.schwellenBreite));
        const startOffset = desiredAngle / Math.floor(length / this.schwellenGap) / 2;

        let h = Math.sqrt(Math.pow(radius, 2) - Math.pow(distance / 2, 2));

        if (clockwise) h *= -1;

        // Calculate the angle between the x-axis and the line connecting the two points
        let lineAngle = Math.atan2(p2.y - p1.y, p2.x - p1.x);

        //1st calculate the midpoint between p1 and p2, then calc a perpendicular point by adding 90° to the lineAngle with h as heigth above the midpoint.
        let pointC = { x: (p1.x + p2.x) / 2 - Math.cos(lineAngle + Math.PI / 2) * h, y: (p1.y + p2.y) / 2 - Math.sin(lineAngle + Math.PI / 2) * h };
        //drawPoint(pointC, "pC", "#000", 3);

        //drawLine(midpoint, pointC);

        // Calculate the starting and ending angles for drawing the circular curve
        if (!clockwise) lineAngle += Math.PI;
        let startAngle = lineAngle - desiredAngle / 2 - Math.PI / 2 + startOffset;
        let endAngle = desiredAngle + startAngle - step;
        let random;
        for (let rad = startAngle; rad < endAngle; rad += step) {
            random = Math.randomInt(this.SCHWELLEN_VARIANTEN - 1);

            container.addChild(
                new createjs.Bitmap(img).set({
                    x: pointC.x + Math.cos(rad) * (radius + offset),
                    y: pointC.y + Math.sin(rad) * (radius + offset),
                    scale: TRACK_SCALE,
                    sourceRect: new createjs.Rectangle((random * img.width) / this.SCHWELLEN_VARIANTEN, 0, img.width / this.SCHWELLEN_VARIANTEN, img.height),
                    rotation: (rad * 180) / Math.PI + 90,
                })
            );
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

        let bmp = pl.getImage(this._template.json_file, texture_name);
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
