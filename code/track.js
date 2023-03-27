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
    deg = null;
    signals = [];

    constructor(start, end) {

        if (start.x < end.x) {
            this.start = start;
            this.end = end;
        }
        else {
            this.start = end;
            this.end = start;
        }

        let dx = (this.end.x - this.start.x);
        let dy = (this.start.y - this.end.y); // start ende vertauscht, da das Koordinatensystem gespiegelt arbeitet
        this.deg = Math.atan(dy / dx) * (180 / Math.PI);
    }

    draw(container) {
        let shape = new createjs.Shape();
        shape.name = "track";
        shape.track = this;

        let hit = new createjs.Shape();

        let y1 = this.start.y - Math.cos(deg2rad(this.deg)) * 5;
        let x1 = this.start.x - Math.sin(deg2rad(this.deg)) * 5;

        let y2 = this.start.y + Math.cos(deg2rad(this.deg)) * 5;
        let x2 = this.start.x + Math.sin(deg2rad(this.deg)) * 5;

        let y3 = this.end.y + Math.cos(deg2rad(this.deg)) * 5;
        let x3 = this.end.x + Math.sin(deg2rad(this.deg)) * 5;

        let y4 = this.end.y - Math.cos(deg2rad(this.deg)) * 5;
        let x4 = this.end.x - Math.sin(deg2rad(this.deg)) * 5;

        hit.graphics.beginFill(1, "#000").mt(x1, y1).lt(x2, y2).lt(x3, y3).lt(x4, y4).lt(x1, y1);
        shape.hitArea = hit;

        //container.addChild(hit);
        container.addChild(shape);
        shape.graphics.setStrokeStyle(stroke, "round").beginStroke(track_color);
        shape.color = shape.graphics.command;
        shape.graphics.moveTo(this.start.x, this.start.y).lineTo(this.end.x, this.end.y);
    }

    AddSignal(position) {
        let i = this.signals.findIndex((item) => position.km > item.km);
        this.signals.splice(i + 1, 0, position);
    }

    removeSignal(s) {
        let i = this.signals.findIndex((item) => s === item.signal);
        if (i != -1) {
            this.signals.splice(i, 1);
        }
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
            if (this.map.size == 0) return false; //wenn das signal keine optionen hat, kann es nir ein match sein
            const match_single = (function (singleOptions) {
                const splitted = singleOptions.split('.');
                if (splitted.length == 1)
                    return this.map.has(singleOptions);
                else if (splitted.length == 2)
                    return this.map.get(splitted[0]) == splitted[1];
                else
                    throw new Error();
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

    set(stellung) {
        if (this.check(stellung))
            delete this._signalStellung[stellung[0]];
        else
            this._signalStellung[stellung[0]] = stellung[1];

    }

    get(stellung) {
        return this._signalStellung[stellung];
    }

    check(stellung) {
        return this._signalStellung[stellung[0]] == stellung[1];
    }

    draw(c) {
        this._rendering = { container: c };

        this._template.elements.forEach(ve=>this.drawVisualElement(ve));
        
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
                }else if(ve.childs){
                    ve.childs.forEach(c=>this.drawVisualElement(c));
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

        const switchable_visuell_elements = this._template.elements.filter((e) => e.switchable && this.options.match(e.options));
        const groups = new Map();

        switchable_visuell_elements.forEach(e => {
            const s = e.stellung[0];
            if (!groups.has(s))
                groups.set(s, [e]);
            else if (groups.get(s).find(i => i.stellung[1] === e.stellung[1]) == null)
                groups.get(s).push(e);
        })

        groups.forEach((v) => {
            ul.append($("<li>", { class: "list-group-item" }).append(ui.create_buttonGroup(v.map((e) => ui.create_toggleButton(e.btn_text, "", e.stellung, this)))));

        })

        this.syncHTML(ul);
        return ul;
    }

    syncHTML(popup) {
        let buttons = $("button", popup);
        buttons.each((i, e) => {
            const stellung = e.attributes['data_signal'].value.split(",");
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