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
    _stage = null;
    _position = null;

    constructor(p, signal, stage) {
        super();
        this._position = p;
        this._signal = signal;
        this.name = "signal";
        this._stage = stage;
        this._stage.addChild(this);
        this.mouseChildren = false;

        this.on("pressmove", function (evt) {
            if (mode == MODE_EDIT) {
                let p = this._stage.globalToLocal(this._stage.mouseX, this._stage.mouseY);
                
                this.x = p.x + this.offset.x;
                this.y = p.y + this.offset.y;
                this._stage.update();
            }
        });

        this.on("mousedown", function (evt) {
			this.offset = {x: this.x - evt.stageX, y: this.y - evt.stageY};
		});

        this.scale = 0.1;
        this.rotation = 270;
        this.x = this._position.x;
        this.y = this._position.y;

    }

    drawSignal() {
        this._signal.buildAndRepaint(this);
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