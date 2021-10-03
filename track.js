'use strict';

class track {
    _shape = null;
    _startPnt = null;
    _endPnt = null;

    constructor(shape, start, end) {
        this._shape = shape;
        if (start.x < end.x) {
            this._startPnt = start;
            this._endPnt = end;
        }
        else {
            this._startPnt = end;
            this._endPnt = start;
        }
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