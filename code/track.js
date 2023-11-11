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

    //Temp values
    _tmp = {
        deg: 0,
        rad: 0,
        length: 0,
        slope: 0,
        vector: null,
        switches: [],
        unit: null,
    };

    constructor(start, end) {
        this.start = start;
        this.end = end;

        this.calcTempValues();
    }

    calcTempValues() {
        this._tmp.vector = {
            x: this.end.x - this.start.x,
            y: this.end.y - this.start.y,
        };
        this._tmp.rad = Math.atan(this._tmp.vector.y / this._tmp.vector.x);
        this._tmp.deg = this._tmp.rad * (180 / Math.PI);

        this._tmp.length = geometry.length(this._tmp.vector);
        this._tmp.unit = geometry.unit(this._tmp.vector, this._tmp.length);

        this._tmp.slope = geometry.slope(this.start, this.end);
    }

    getPointfromKm(km) {
        return { x: (Math.cos(this._tmp.rad) * km).round(0), y: (Math.sin(this._tmp.rad) * km).round(0) };
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

    AddSignal(position) {
        let i = this.signals.findIndex((item) => position.km > item.km);
        this.signals.splice(i + 1, 0, position);
    }

    AddSwitch(weiche) {
        let i = this._tmp.switches.findIndex((item) => weiche.km < item.km);
        if (i == -1) this._tmp.switches.push(weiche);
        else this._tmp.switches.splice(i, 0, weiche);
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
