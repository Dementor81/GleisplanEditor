'use strict';

class trackShape {
    start = null;
    end = null;
    deg = null;

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
        this.deg = Math.atan(dy/dx) * (180/Math.PI);;
    }

    draw(container) {
        let shape = new createjs.Shape();
        container.addChild(shape);
        shape.graphics.setStrokeStyle(stroke, "round").beginStroke("#000000").moveTo(this.start.x, this.start.y).lineTo(this.end.x, this.end.y);
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
    _template = null;

    constructor(template) {
        this._template = template;
        this._signalStellung = {};
        this._rendering = {};
    }

    draw(container) {
        this._rendering.container = container;

        for (let v in this._template.elements) {
            let x = this._template.elements[v]
            if (x instanceof VisualElement) {
                if (x.isEnabled(this) && x.isAllowed(this))
                    this.addImage(x.image, { blinkt: x.blinkt, posIndex: x.pos });
            } else if (typeof x == "object") {
                //keine Ahnung was hier passieren soll
            }
        }

        this._rendering.container = null;
    }

    addImage(texture_name, { index = -1, posIndex = 0, name = null, blinkt = false, offset = 0, nextGen = false } = {}) {
        if (texture_name == null || texture_name == "") throw "kein Signal übergeben";
        let texture = pl.getImage(this._template.id, texture_name);
        if (texture != null) {

            let param = { name: name != null ? name : texture_name, x: 0, y: 0 };

            if (texture.meta.hasOwnProperty("sourceRect")) {
                //param.sourceRect = new createjs.Rectangle(imageData.sourceRect.x,imageData.sourceRect.y, imageData.sourceRect.width, imageData.sourceRect.height);
                param.sourceRect = new createjs.Rectangle(texture.meta.sourceRect.x, texture.meta.sourceRect.y, texture.meta.sourceRect.width, texture.meta.sourceRect.height);
            }

            if (texture.meta.hasOwnProperty("pos")) {
                //für zs3/zs3v, werde ich hier nicht brauchen
                /* if (posIndex == null || posIndex > texture.meta.pos.length - 1) {
                    posIndex = texture.meta.pos.length - 1;
                    console.log(texture_name + " posindex " + posIndex + " zu groß");
                } */
                let pos = texture.meta.pos[posIndex == null ? 0 : posIndex];

                if (pos.hasOwnProperty("top"))
                    param.y += pos.top;

                if (pos.hasOwnProperty("left"))
                    param.x += pos.left;
            }

            //für zs3/zs3v, werde ich hier nicht brauchen
            /* if (index != -1) {
                if (!texture.meta.hasOwnProperty("width")) throw "sprite sheet needs a width";
                let width = texture.meta.width;
                param.sourceRect = new createjs.Rectangle(width * index, 0, width, texture.img.height);
            } */

            param.x += offset;

            let bmp = new createjs.Bitmap(texture.img).set(param);
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