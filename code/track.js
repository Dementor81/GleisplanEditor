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
        container.addChild(shape);
        shape.graphics.setStrokeStyle(stroke, "round").beginStroke("#000000").moveTo(this.start.x, this.start.y).lineTo(this.end.x, this.end.y);
    }

    AddSignal(position) {
        let i = this.signals.findIndex((item) => position.km > item.km);
        this.signals.splice(i + 1, 0, position);
    }

    removeSignal(s) {
        let i = this.signals.findIndex((item) => s === item.signal);
        if (i != -1) {
            this.signals.splice(i,1);
        }
    }

    hitTest(mx, my) {
        let p1 = this.start;
        let p2 = this.end;

        var p3 = {
            x: mx,
            y: my,
            r: 20
        };

        let a = {
            x: mx - p1.x,
            y: my - p1.y
        };

        var b = {
            x: p2.x - p1.x,
            y: p2.y - p1.y
        };

        var p = {
            x: p1.x + (a.x * b.x + a.y * b.y) / (b.x * b.x + b.y * b.y) * b.x,
            y: p1.y + (a.x * b.x + a.y * b.y) / (b.x * b.x + b.y * b.y) * b.y
        };

        var d2 = Math.pow(p.x - mx, 2) + Math.pow(p.y - my, 2);
        var plen2 = Math.pow(p.x - p1.x, 2) + Math.pow(p.y - p1.y, 2);
        var blen2 = b.x * b.x + b.y * b.y;
        var ptimd = (p.x - p1.x) * b.x + (p.y - p1.y) * b.y;

        var dist1 = Math.pow(p3.x - p1.x, 2) + Math.pow(p3.y - p1.y, 2);
        var dist2 = Math.pow(p3.x - p2.x, 2) + Math.pow(p3.y - p2.y, 2);

        if (d2 <= p3.r * p3.r && plen2 <= blen2 && ptimd >= 0 || dist1 <= p3.r || dist2 <= p3.r) {
            return true;
        } else {
            return false;
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
            if (x instanceof VisualElement) {
                if (x.isEnabled(this) && x.isAllowed(this))
                    this.addImage(x.image, { blinkt: x.blinkt, posIndex: x.pos });
            } else if (typeof x == "object") {
                //keine Ahnung was hier passieren soll
            }
        }

        this._rendering = null;
    }

    addImage(texture_name, { index = -1, posIndex = 0, name = null, blinkt = false } = {}) {
        if (texture_name == null || texture_name == "") throw "kein Signal übergeben";

        let bmp = pl.getImage(this._template.json_file, texture_name);;
        if (bmp != null) {
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
        return this._template.elements.filter((e) => e.enabled == null).map((e) => ui.create_toggleButton(e.btn_text, e.id, () => { e.toggle(this) }));
    }

    /* hitTest(mx, my) {
        let p1 = this._startPnt;
        let p2 = this._endPnt;

        var p3 = {
            x: mx,
            y: my,
            r: 20
        };

        let a = {
            x: mx - p1.x,
            y: my - p1.y
        };

        var b = {
            x: p2.x - p1.x,
            y: p2.y - p1.y
        };

        var p = {
            x: p1.x + (a.x * b.x + a.y * b.y) / (b.x * b.x + b.y * b.y) * b.x,
            y: p1.y + (a.x * b.x + a.y * b.y) / (b.x * b.x + b.y * b.y) * b.y
        };

        var d2 = Math.pow(p.x - mx, 2) + Math.pow(p.y - my, 2);
        var plen2 = Math.pow(p.x - p1.x, 2) + Math.pow(p.y - p1.y, 2);
        var blen2 = b.x * b.x + b.y * b.y;
        var ptimd = (p.x - p1.x) * b.x + (p.y - p1.y) * b.y;

        var dist1 = Math.pow(p3.x - p1.x, 2) + Math.pow(p3.y - p1.y, 2);
        var dist2 = Math.pow(p3.x - p2.x, 2) + Math.pow(p3.y - p2.y, 2);

        if (d2 <= p3.r * p3.r && plen2 <= blen2 && ptimd >= 0 || dist1 <= p3.r || dist2 <= p3.r) {
            return true;
        } else {
            return false;
        }
    } */
}