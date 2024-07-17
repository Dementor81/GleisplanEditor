"use strict";

class Track {
   static findTrackbySignal(s) {
      return tracks.find((t) => t.signals.find((o) => o.signal == s) != undefined);
   }
   static findTrackByPoint(p) {      
      return tracks.find(track=>geometry.pointOnLine(track.start, track.end, p))
   }

   static counter = 0;

   static _getID(s) {
      return Track.counter++;
   }

   static splitTrack(track, point) {
      const t1 = new Track(track.start, point);
      const t2 = new Track(point, track.end);
      const cut_km = track.getKmfromPoint(point);

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

   static createSwitch(location, tracks) {
      const sw = {
         location: location,
         t1: null,
         t2: null,
         t3: null,
         //t4: null //only available if its a dkw
         type: 0,
         branch: null, // one of the tracks
         from: null, //normal switch: always t1, on dkw switchable
      };

      const groupedByRad = Object.values(groupBy(tracks, "_tmp.rad"));
      if (groupedByRad.length != 2) return; // throw new Error("Wrong switch connection! found " + groupedByRad.length + " different slopes");

      //sort each group by its x coordinate
      groupedByRad.forEach((a) => a.sort((t1, t2) => t1.start.x - t2.start.x));
      //sort the groups by the number of tracks in it. this way, the branch is always in the 2nd group.
      groupedByRad.sort((a, b) => b.length - a.length);

      //cause we have sorted by the number of tracks, t3 is always the branch
      sw.t3 = groupedByRad[1][0];

      sw.type = ((findAngle(location, sw.t3.end.equals(location) ? sw.t3.start : sw.t3.end, groupedByRad[0][0].rad) / 45) % 8) + 1;

      if (sw.type == SWITCH_TYPE.FROM_LEFT || sw.type == SWITCH_TYPE.FROM_RIGHT) {
         sw.t1 = groupedByRad[0][1];
         sw.t2 = groupedByRad[0][0];
      } else {
         sw.t1 = groupedByRad[0][0];
         sw.t2 = groupedByRad[0][1];
      }
      //stellt die Weiche standardmäßig ins Hauptgleis
      sw.branch = sw.t2;
      sw.from = sw.t1;

      if (tracks.length == 4) {
         sw.type = SWITCH_TYPE.DKW;
         sw.t4 = groupedByRad[1][1];
      }

      sw.t1.addSwitch(sw);
      sw.t2.addSwitch(sw);
      if (sw.t3) sw.t3.addSwitch(sw);
      if (sw.t4) sw.t4.addSwitch(sw);

      return sw;
   }

   static connectTracks() {
      tracks.forEach((track) => (track._tmp.switches = [])); //delets all swichtes
      switches = [];
      let sw;
      const end_points = [];
      //iterate over all tracks
      for (let i = 0; i < tracks.length; i++) {
         const track = tracks[i];
         const location = track.end; //gets its endpoint
         if (!end_points.some((p) => p.equals(location))) {
            //checks if the point was already handled
            end_points.push(location);
            //searches for every track wich starts or end at that point, filters tracks wich would combine to a 90° angle
            const connected_tracks = tracks.filter(
               (t) => t != track && (t.start.equals(location) || t.end.equals(location)) && (t._tmp.deg == 0 || t._tmp.deg + track._tmp.deg != 0)
            );

            if (connected_tracks.length == 1) {
               track._tmp.switches[1] = connected_tracks[0];
               connected_tracks[0]._tmp.switches[0] = track;
            } else if (connected_tracks.length.between(2, 3)) {
               connected_tracks.push(track);
               if ((sw = Track.createSwitch(location, connected_tracks))) switches.push(sw);
            }
         }
      }
   }

   static cleanupTracks() {
      let i = 0;
      while (i < tracks.length) {
         const track = tracks[i];

         //searches for every track wich starts or end at that point, filters tracks wich would combine to a 90° angle
         const connected_tracks = tracks.filter((t) => t != track && (t.start.equals(track.end) || t.end.equals(track.end)));

         if (connected_tracks.length == 1 && connected_tracks[0].rad == track.rad) {
            Track.joinTrack(track, connected_tracks[0]);
            deleteTrack(connected_tracks[0], false);
         } else i++;
      }
   }

   static switch_A_Switch(sw, mouseX) {
      if (!sw.type.is(SWITCH_TYPE.DKW)) {
         sw.branch = swap(sw.branch, sw.t2, sw.t3);
      } else {
         if (mouseX < sw.location.x) {
            sw.branch = swap(sw.branch, sw.t2, sw.t3);
         } else {
            sw.from = swap(sw.from, sw.t1, sw.t4);
         }
      }
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
   selected = false;
   rendered = false;

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

   get switchAtTheEnd() {
      return this._tmp.switches[1];
   }

   get switchAtTheStart() {
      return this._tmp.switches[0];
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

   get unit() {
      return this._tmp.unit;
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
      this._tmp.unit = new V2(geometry.unit(this._tmp.vector, this._tmp.length));

      this._tmp.slope = geometry.slope(this.start, this.end);

      this._tmp.sin = Math.sin(this._tmp.rad);
      this._tmp.cos = Math.cos(this._tmp.rad);
      this._tmp.id = Track._getID();
   }

   //returns the Point
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

   //returns the point, if u go x km from point along the track, so point must be track.start or track.end
   //the direction is automaticly optained
   along(point, x) {
      return geometry.add(point, geometry.multiply(this.unit, x * (point.x == this.start.x ? 1 : -1)));
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
