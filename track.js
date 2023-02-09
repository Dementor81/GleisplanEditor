'use strict';

class trackShape extends createjs.Shape {
    _startPnt = null;
    _endPnt = null;
    _stage = null;

    constructor(start, end, stage) {
        super();
        this._stage = stage;
        stage.addChild(this);
        this.name = "track";
        if (start.x < end.x) {
            this._startPnt = start;
            this._endPnt = end;
        }
        else {
            this._startPnt = end;
            this._endPnt = start;
        }
    }

    drawTrack() {
        this.graphics.setStrokeStyle(stroke, "round").beginStroke("#000000").moveTo(this._startPnt.x, this._startPnt.y).lineTo(this._endPnt.x, this._endPnt.y);
    }

    hitTest(mx, my) {
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
    }
}

class signalShape extends createjs.Container {
    _signal = null;
    _container = null;
    _position = null;

    constructor(p, signal, container) {
        super();
        this._signalStellung = {};

        this._position = p;
        this._signal = signal;
        this.name = "signal";
        this._container = container;
        this._container.addChild(this);
        this.mouseChildren = false;

        /* this.on("pressmove", function (evt) {
            if (mode == MODE_EDIT) {
                let p = this._stage.globalToLocal(this._stage.mouseX, this._stage.mouseY);
                
                this.x = p.x + this.offset.x;
                this.y = p.y + this.offset.y;
                this._stage.update();
            }
        });

        this.on("mousedown", function (evt) {
			this.offset = {x: this.x - evt.stageX, y: this.y - evt.stageY};
		}); */

        /* this.scale = 0.1;
        this.rotation = 270; */
        this.x = this._position.x;
        this.y = this._position.y;

    }

    drawSignal() {
        for (let v in this._signal.elements) {
            let x = this._signal.elements[v]
            if (x instanceof VisualElement) {
                if (x.isEnabled(this) && x.isAllowed(this))
                    this.addImage(x.image, { blinkt: x.blinkt, posIndex: x.pos });
            } else if (typeof x == "object") {
                //keine Ahnung was hier passieren soll
            }
        }
    }

    addImage(texture_name, { index = -1, posIndex = 0, name = null, blinkt = false, offset = 0, nextGen = false } = {}) {
        if (texture_name == null || texture_name == "") throw "kein Signal übergeben";
        let texture = pl.getImage(this._class.toLowerCase(), texture_name);
        if (texture != null) {

            let param = { name: name != null ? name : texture_name, x: 0, y: 0 };

            if (texture.meta.hasOwnProperty("sourceRect")) {
                //param.sourceRect = new createjs.Rectangle(imageData.sourceRect.x,imageData.sourceRect.y, imageData.sourceRect.width, imageData.sourceRect.height);
                param.sourceRect = new createjs.Rectangle(texture.meta.sourceRect.x, texture.meta.sourceRect.y, texture.meta.sourceRect.width, texture.meta.sourceRect.height);
            }

            if (texture.meta.hasOwnProperty("pos")) {
                if (posIndex == null || posIndex > texture.meta.pos.length - 1) {
                    posIndex = texture.meta.pos.length - 1;
                    console.log(texture_name + " posindex " + posIndex + " zu groß");
                }
                let pos = texture.meta.pos[posIndex == null ? 0 : posIndex];
                if (!nextGen) {
                    let ref;
                    if (pos.hasOwnProperty("ref"))
                        ref = this._temp.container.getChildByName(pos.ref);
                    else ref = this._temp.container.getChildByName("basis");
                    if (ref != null) {
                        param.x = ref.x;
                        param.y = ref.y;
                    }
                }

                if (pos.hasOwnProperty("top"))
                    param.y += pos.top;

                if (pos.hasOwnProperty("left"))
                    param.x += pos.left;
            }

            if (index != -1) {
                if (!texture.meta.hasOwnProperty("width")) throw "sprite sheet needs a width";
                let width = texture.meta.width;
                param.sourceRect = new createjs.Rectangle(width * index, 0, width, texture.img.height);
            }

            param.x += offset;

            let bmp = new createjs.Bitmap(texture.img).set(param);
            this._temp.container.addChild(bmp);

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