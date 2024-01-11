"use strict";

class Track {
    static findTrackbySignal(s) {
        return tracks.find((t) => t.signals.find((o) => o.signal == s) != undefined);
    }

    static counter = 0;

    static _getID(s) {
        return Track.counter++;
    }

    static splitTrack(track, point) {
        const t1 = new Track(track.start, point);
        const t2 = new Track(point, track.end);

        //wahrscheinlich unnötig, da nach einem splitt die tracks eh neu verbunden werden
        /* t1._tmp.switches[0] = track._tmp.switches[0];
        t2._tmp.switches[1] = track._tmp.switches[1];
        t1._tmp.switches[1] = t2;
        t2._tmp.switches[0] = t1; */

        let cut_km = track.getKmfromPoint(point);

        track.signals.forEach((s) => {
            if (s._positioning.km < cut_km) {
                s._positioning.track = t1;
                t1.AddSignal(s);
            } else {
                s._positioning.track = t2;
                s._positioning.km -= cut_km;
                t2.AddSignal(s);
            }
        });

        return [t1, t2];
    }

    static joinTrack(track1, track2) {
        let cut_km = track1.length;
        track1.setNewEnd(track2.end);

        track2.signals.forEach((s) => {
            s._positioning.track = track1;
            s._positioning.km += cut_km;
            track1.AddSignal(s);
        });
    }

    static FromObject(o) {
        let t = new Track(o.start, o.end);
        t.signals = o.signals;
        t.signals.forEach(function (s) {
            s._positioning.track = t;
        });
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
        switches: [null, null],
        unit: null,
        sin: 0,
        cos: 0,
        id: 0,
    };

    get id() {
        return this._tmp.id;
    }

    get switches() {
        return this._tmp.switches;
    }

    get rad() {
        return this._tmp.rad;
    }

    get deg() {
        return this._tmp.deg;
    }

    get length() {
        return this._tmp.length;
    }

    constructor(start, end) {
        if (type(start) == "Point") this.start = start;
        else this.start = new Point(start.x, start.y);

        if (type(end) == "Point") this.end = end;
        else this.end = new Point(end.x, end.y);

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

        this._tmp.sin = Math.sin(this._tmp.rad);
        this._tmp.cos = Math.cos(this._tmp.rad);
        this._tmp.id = Track._getID();
    }

    getPointfromKm(km) {
        return { x: (Math.cos(this._tmp.rad) * km).round(0), y: (Math.sin(this._tmp.rad) * km).round(0) };
    }

    getKmfromPoint(p) {
        if (!geometry.pointOnLine(this.start, this.end, p)) return;

        let v = new V2(this.start);
        v = v.sub(p);
        return v.length;
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

    along(point, x) {
        return geometry.multiply(this._tmp.unit, x * (point.x == this.start.x ? 1 : -1));
    }

    AddSignal(signal) {
        let i = this.signals.findIndex((s) => signal._positioning.km < s._positioning.km);
        if (i != -1) this.signals.splice(i, 0, signal);
        else this.signals.push(signal);
    }

    removeSignal(s) {
        let i = this.signals.indexOf(s);
        if (i != -1) {
            this.signals.splice(i, 1);
        }
    }

    addSwitch(sw) {
        this._tmp.switches[this.end.equals(sw.location) ? 1 : 0] = sw;
    }

    stringify() {
        return { _class: "Track", start: this.start, end: this.end, signals: this.signals };
    }
}
