"use strict";

class TrackNode {
   #_start;
   #_end;

   constructor(start, end) {
    if (!end && end instanceof TrackNode) {
       throw new TypeError("end must be of type Point");
    }

      if (start instanceof Point) this.#_start = start;
      else if (start instanceof TrackNode) this.chain(start);
      //else throw new TypeError("start must be either be a Point or a TrackNode");

      if (start && start.equals(end)) throw new TypeError("start and end need to be different");

      this.#_end = end;
   }

   get x() {
      return this.#_end.x;
   }

   get y() {
      return this.#_end.y;
   }

   //global coordinates
   get start() {
      return this.#_start;
   }

   set start(value) {
      this.#_start = value;
      this.#resetCache();
   }

   //global coordinates
   get end() {
      return this.#_end;
   }

   set end(value) {
      this.#_end = value;
      this.#resetCache();
   }

   get vector() {
      if (!this._vector) {
         this._vector = {
            x: this.#_end.x - this.#_start.x,
            y: this.#_end.y - this.#_start.y,
         };
      }
      return this._vector;
   }

   get rad() {
      if (!this._rad) this._rad = Math.atan2(this.vector.y, this.vector.x);
      return this._rad;
   }

   get deg() {
      if (!this._deg) this._deg = this.rad * (180 / Math.PI);
      return this._deg;
   }

   get length() {
      if (!this._length) this._length = geometry.length(this.vector);
      return this._length;
   }

   get unit() {
      if (!this._unit) this._unit = new V2(geometry.unit(this.vector, this.length));
      return this._unit;
   }

   get slope() {
      return this._slope ? this._slope : (this._slope = this.vector.y / this.vector.x);
   }

   get sin() {
      if (!this._sin) this._sin = Math.sin(this.rad);
      return this._sin;
   }
   get cos() {
      if (!this._cos) this._cos = Math.cos(this.rad);
      return this._cos;
   }

   #resetCache() {
      this._vector = null;
      this._rad = null;
      this._deg = null;
      this._length = null;
      this._unit = null;
      this._slope = null;
      this._sin = null;
      this._cos = null;
   }

   chain(node) {
      if (node instanceof TrackNode) this.#_start = Point.fromPoint(node.end);
      else if (node instanceof Point) this.#_start = Point.fromPoint(node);
      else throw new TypeError("parameter must be of type TrackNode or Point");

      this.#resetCache();
   }

   getPointfromKm(km) {
      return { x: (Math.cos(this._rad) * km).round(0), y: (Math.sin(this._rad) * km).round(0) };
   }

   getKmFromPoint(p) {
      if (!geometry.pointOnLine(this.start, this.end, p)) return;

      let v = new V2(this.start);
      v = v.sub(p);
      return v.length;
   }

   /* ------------------------------------- */

   equals(point) {
      return this.#_end.x === point.x && this.#_end.y === point.y;
   }

   stringify() {
      return { _class: "TrackNode", end: this.end };
   }

   static FromObject(o) {
      let n = new TrackNode(null, Point.fromPoint(o.end));      
      return n;
   }
}
