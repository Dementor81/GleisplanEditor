'use strict';

class trackShape {
    static findTrackbySignal(s) {
        return tracks.find((t) => t.signals.find((o) => o.signal == s) != undefined)
    }


    static FromObject(o) {
        let t = new trackShape(o.start, o.end);
        t.signals = o.signals;
        return t;
    }

    start = null;
    end = null;
    signals = [];

    deg = 0;
    length = 0;
    vector = null;
    points = [];
    unit = null;

    constructor(start, end) {

        if (start.x < end.x) {
            this.start = start;
            this.end = end;
        }
        else {
            this.start = end;
            this.end = start;
        }


        this.calcTempValues();
    }

    calcTempValues() {
        this.vector = { x: this.end.x - this.start.x, y: this.start.y - this.end.y }; // start ende vertauscht, da das Koordinatensystem gespiegelt arbeitet
        this.deg = Math.atan(this.vector.y / this.vector.x) * (180 / Math.PI);
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
        this.signals.forEach(p => p.km += lengthAdded);
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
        let shape = new createjs.Shape();
        let texture = new createjs.Shape();
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
        container.addChild(texture);
        shape.graphics.setStrokeStyle(stroke, "round").beginStroke(track_color);
        shape.color = shape.graphics.command;
        shape.graphics.moveTo(this.start.x, this.start.y).lineTo(this.end.x, this.end.y);
        if (!this.points.some(p => p.km == 0)) {
            //prellbock beim start
            p1 = geometry.perpendicular(this.start, this.deg, -6);
            p2 = geometry.perpendicular(this.start, this.deg, 6);
            shape.graphics.moveTo(p1.x, p1.y).lineTo(p2.x, p2.y);
        }

        if (!this.points.some(p => p.km == this.length)) {
            //prellbock beim ende
            p1 = geometry.perpendicular(this.end, this.deg, -6);
            p2 = geometry.perpendicular(this.end, this.deg, 6);
            shape.graphics.moveTo(p1.x, p1.y).lineTo(p2.x, p2.y);
        }

        //Filter points at start end end
        this.points.filter(p => p.km != 0 && p.km != this.length).forEach(p => {

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

        let pointAtEnd = false;
        let pointAtStart = false;

        //kurve am ende
        this.points.filter(p => p.km == this.length).forEach(p => {

            const img = loadQueue.getResult("bogen");
            const bmp = new createjs.Bitmap(img);
            const imgSize = img.height * 0.05;
            bmp.x = this.end.x - imgSize / 2 - 7.8;
            bmp.y = this.end.y - imgSize / 2;
            bmp.scale = 0.05;
            bmp.rotation = p.track.deg*-1;
            container.addChild(bmp);
            pointAtEnd = true;
        })

        if (this.points.some(p => p.km == 0)) {
            //prellbock beim start
            pointAtStart = true;
        }

        const straightTrackImg = loadQueue.getResult("grade");
        const trackHeight = straightTrackImg.height * 0.05;
        var mtx = new createjs.Matrix2D();
        mtx.scale(0.05, 0.05);
        /* mtx.tx = p1.x;
        mtx.ty = p1.y; */
        texture.regX = 0;
        texture.regY = trackHeight / 2;
        let l = this.length;
        if (pointAtEnd) l -= 30;
        if (pointAtStart) l -= 23.8;
        texture.graphics.beginBitmapFill(straightTrackImg, 'repeat-x', mtx).drawRect(0, 0, l, straightTrackImg.height);
        texture.x = this.start.x + (pointAtStart ? 23.8 : 0);
        texture.y = this.start.y;
        texture.rotation = this.deg * -1;

    }

    AddSignal(position) {
        let i = this.signals.findIndex((item) => position.km > item.km);
        this.signals.splice(i + 1, 0, position);
    }

    AddPoint(point) {
        let i = this.points.findIndex((item) => point.km > item.km);
        this.points.splice(i + 1, 0, point);
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
    _signalStellung = {

    };


    options = {
        map: new Map(),
        set: function (o, value) {
            const splitted = o.split('.');
            if (splitted.length == 1) {
                if (value)
                    this.map.set(o, true);
                else
                    this.map.delete(o);
            }
            else if (splitted.length == 2)
                this.map.set(splitted[0], splitted[1]);
            else
                throw new Error();
        },
        match: function (options) {
            if (options == null || options.length == 0) return true; // wenn das visualElement keine Options fordert, ist es immer ein match
            const match_single = (function (singleOptions) {
                const splitted = singleOptions.split('.');
                const antiMatch = splitted[0][0] == '!';
                let retValue;
                if (antiMatch)
                    splitted[0] = splitted[0].substring(1);
                if (splitted.length == 1)
                    retValue = this.map.has(splitted[0]);
                else if (splitted.length == 2)
                    retValue = this.map.get(splitted[0]) == splitted[1];
                else
                    throw new Error();

                return antiMatch ? !retValue : retValue;
            }).bind(this);
            if (Array.isArray(options)) {
                return options.find(match_single) != null;
            } else
                return match_single(options);

        },
        stringify: function () {
            return JSON.stringify(Array.from(this.map.entries()))
        }
    };




    constructor(template) {
        this._template = template;

        if (template.startOptions)
            if (Array.isArray(template.startOptions))
                template.startOptions.forEach(i => this.options.set(i))
            else
                this.options.set(template.startOptions);


        if (template.start)
            if (Array.isArray(template.start))
                template.start.forEach(i => this.set(i));
            else
                this.set(template.start);

    }

    set(stellung, value) {
        const splitted = stellung.split("=");
        if (splitted.length == 1)
            this._signalStellung[splitted[0]] = value;
        else if (this.check(stellung))
            delete this._signalStellung[splitted[0]];
        else
            this._signalStellung[splitted[0]] = splitted[1];
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

        this._template.elements.forEach(ve => this.drawVisualElement(ve));

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
                    if (Array.isArray(ve.image))
                        ve.image.forEach(i => this.addImage(i, { blinkt: ve.blinkt, pos: ve.pos }));
                    else
                        this.addImage(ve.image, { blinkt: ve.blinkt, pos: ve.pos });
                } else if (ve.childs) {
                    ve.childs.forEach(c => this.drawVisualElement(c));
                }
        }
        else
            console.log(ve);
    }

    addImage(texture_name, { pos = null, blinkt = false } = {}) {
        if (texture_name == null || texture_name == "") return;

        let bmp = pl.getImage(this._template.json_file, texture_name);;
        if (bmp != null) {
            if (pos) {
                bmp.x = pos[0];
                bmp.y = pos[1];
            }


            this._rendering.container.addChild(bmp);

            if (blinkt) {
                createjs.Tween.get(bmp, { loop: true })
                    .wait(1000)
                    .to({ alpha: 0 }, 200)
                    .wait(800)
                    .to({ alpha: 1 }, 50)
            }

            return bmp;
        }
        else
            console.log(texture_name + " nicht gezeichnet")
    }

    getHTML() {
        const ul = $("<ul>", { class: "list-group list-group-flush" });

        const filterTree = (function (array) {
            let a = [];
            array.forEach(item => {
                if (this.options.match(item.options)) {
                    if (item.switchable) a.push(item);
                    if (item.childs)
                        a = a.concat(filterTree(item.childs));

                }
            })

            return a;
        }).bind(this);


        const switchable_visuell_elements = filterTree(this._template.elements);


        const groups = new Map();

        switchable_visuell_elements.forEach(e => {
            const s = e.stellung.split("=")[0];
            if (!groups.has(s))
                groups.set(s, [e]);
            else
                groups.get(s).push(e);
        })

        groups.forEach((group) => {
            if (!(group[0] instanceof TextElement))
                ul.append($("<li>", { class: "list-group-item" }).append(ui.create_buttonGroup(group.map((e) => ui.create_toggleButton(e.btn_text, "", e.stellung, this)))));
            else
                ul.append($("<li>", { class: "list-group-item" }).append(ui.create_Input(group[0].btn_text, group[0].stellung, this)));

        })

        this.syncHTML(ul);
        return ul;
    }

    syncHTML(popup) {
        let buttons = $("button", popup);
        buttons.each((i, e) => {
            const stellung = e.attributes['data_signal'].value;
            $(e).toggleClass("active", this.check(stellung));

            if (this._template.StellungIsAllowed(stellung[0], this))
                $(e).removeAttr('disabled');
            else
                $(e).attr('disabled', 'disabled');
        })

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