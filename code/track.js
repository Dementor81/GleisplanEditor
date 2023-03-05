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
        return s;
    }


    _template = null;
    _signalStellung = null;

    constructor(template) {
        this._template = template;
        this._signalStellung = {};
        if (template.start)
            template.elements[template.start].enable(this);

    }

    draw(c) {
        this._rendering = { container: c };

        for (let v in this._template.elements) {
            let x = this._template.elements[v]
            if (x instanceof TextElement) {
                var js_text = new createjs.Text(x.getText(this), x.format, x.color);
                js_text.x = x.pos[0];
                js_text.y = x.pos[1];
                js_text.textAlign = "center";
                js_text.textBaseline = "top";
                js_text.lineHeight = 20;
                this._rendering.container.addChild(js_text);
            } else if (x instanceof VisualElement) {
                if (x.isEnabled(this) && x.isAllowed(this))
                    this.addImage(x.image, { blinkt: x.blinkt, pos: x.pos });
            }
        }

        this._rendering = null;
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
        let ul = $("<ul>", { class: "list-group list-group-flush" });

        let switchable_visuell_elements = this._template.elements.filter((e) => e.switchable);
        for (let g = 1; g <= 5; g++) {
            let elements_in_group = switchable_visuell_elements.filter(e => e.gruppe == g);
            if (elements_in_group.length) {
                ul.append($("<li>", { class: "list-group-item" }).append(ui.create_buttonGroup(elements_in_group.map((e) => ui.create_toggleButton(e.btn_text, e.id, () => { e.toggle(this) })))));
            }
        }

        this.syncHTML(ul);
        return ul;
    }

    syncHTML(popup) {
        let buttons = $("button", popup);
        let switchable_visuell_elements = this._template.elements.filter((e) => e.switchable);
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
        });
    }

}