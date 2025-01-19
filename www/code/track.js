"use strict";

class Track {
   //track drawing
   static isValidTrackNodePoint(p) {
      return true;
   }

   static findTrackbySignal(s) {
      return tracks.find((t) => t.signals.find((o) => o.data == s) != undefined);
   }
   static findTrackByPoint(p) {
      return tracks.find((track) => geometry.pointOnLine(track.start, track.end, p));
   }

   static counter = 0;

   static _getID() {
      return Track.counter++;
   }

   static splitTrackAtPoint(track, split_point) {
      const nodes_1 = [Point.fromPoint(track.start)];
      const nodes_2 = [Point.fromPoint(split_point)];
      let cut = false;

      track.nodes.forEach((node) => {
         if (!cut) {
            if (geometry.pointOnLine(node._tmp.prev, node, split_point)) {
               cut = true;
               nodes_1.push(Point.fromPoint(split_point));
               //only add the split point if we split in the middle of a node
               if (!split_point.equals(node)) nodes_2.push(Point.fromPoint(node));
            } else {
               nodes_1.push(Point.fromPoint(node));
            }
         } else nodes_2.push(Point.fromPoint(node));
      });

      if (!cut) throw new Error("The split point is not on the track");

      /* track.signals.forEach((signal) => {
         if (geometry.pointOnLine(track.start, point, signal._positioning.point)) {
            t1.AddSignal(signal);
         } else {
            t2.AddSignal(signal);
         }
      }); */
      return [nodes_1, nodes_2];
   }

   /* static splitTrack(track, point) {
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
   } */

   static joinTracks(track1, track2) {
      if (track1.end.equals(track2.start)) {
         const nodes = [track1.start].concat(track1.nodes).concat(track2.nodes);
         tracks.remove(track1);
         tracks.remove(track2);
         return Track.checkNodesAndCreateTracks(nodes);
      } else {
         throw new Error("Tracks cannot be joined. The end of the first track must match the start of the second track.");
      }
   }

   /* static joinTrack(track1, track2) {
      let cut_km = track1.length;
      track1.setNewEnd(track2.end);

      track2.signals.forEach((s) => {
         s._positioning.track = track1;
         s._positioning.km += cut_km;
         track1.AddSignal(s);
      });
   } */

   static checkNodesAndCreateTracks(nodes) {
      if (nodes == null || nodes.length <= 1) return;

      const new_tracks = [];

      if (nodes.first().x > nodes.last().x) {
         nodes.reverse();
      }

      let prev,
         current_node = null,
         processed_nodes = [];

      //iterate over all nodes and calculate the temp values and removes unnessesary nodes
      while (nodes.length > 0) {
         current_node = nodes.shift();

         Track.calcTempValues4Nodes(prev, current_node);
         if (processed_nodes.length > 1) {
            if (prev._tmp.slope === current_node._tmp.slope) {
               processed_nodes.pop();
               Track.calcTempValues4Nodes(processed_nodes.last(), current_node);
            }
         }
         processed_nodes.push(current_node);
         prev = current_node;
      }

      let tmp;
      //adds the first node to the tmp_nodes array as the start node of the new track
      let tmp_nodes = [processed_nodes.shift()];
      while (processed_nodes.length > 0) {
         current_node = processed_nodes.shift();

         //search for a node with the same slope and that overlaps with the current node
         const overlapping_nodes = (() => {
            let foundNodes = [];
            tracks.forEach((track) => {
               track.nodes.forEach((node) => {
                  if (
                     node._tmp.slope === current_node._tmp.slope &&
                     geometry.areSegmentsOverlapping2D(node._tmp.prev, node, current_node._tmp.prev, current_node)
                  ) {
                     foundNodes.push(node);
                  }
               });
            });
            return foundNodes.length > 0 ? foundNodes : null;
         })();

         //if no node was found, add the current node to the tmp_nodes array
         if (!overlapping_nodes) tmp_nodes.push(current_node);
         else {
            let p1 = Point.fromPoint(current_node._tmp.prev);
            overlapping_nodes.forEach((overlapping_node) => {
               //if the current node's start is not on the found node, it must be infront of it
               //therefore we need to create a new track from the start of the current node to the start of the found node
               if (!geometry.pointOnLine(overlapping_node._tmp.prev, overlapping_node, p1)) {
                  tmp = Point.fromPoint(overlapping_node._tmp.prev);
                  Track.calcTempValues4Nodes(tmp_nodes.last(), tmp);
                  tmp_nodes.push(tmp);
               }

               //if the whole track started on the found node, the tmp_nodes array has only one entry
               //if the track started before, the tmp_nodes array has already two or more entries
               if (tmp_nodes.length >= 2) {
                  new_tracks.push(Track.createTrack(tmp_nodes));
               }
               tmp_nodes = [];

               p1 = Point.fromPoint(overlapping_node);
               Track.calcTempValues4Nodes(tmp_nodes.last(), p1);
               tmp_nodes.push(p1);
            });

            /*const overlapping_node = overlapping_nodes.last();

             if (!geometry.pointOnLine(overlapping_node._tmp.prev, overlapping_node, current_node)) {
               tmp = new Point(overlapping_node.x, overlapping_node.y);
               tmp_nodes.push(tmp);
            } */

            if (!current_node.equals(tmp_nodes.last())) {
               Track.calcTempValues4Nodes(tmp_nodes.last(), current_node);
               tmp_nodes.push(current_node);
            }
         }
      }
      if (tmp_nodes.length >= 2) {
         new_tracks.push(Track.createTrack(tmp_nodes));
         tmp_nodes = [];
      }

      return new_tracks;
   }

   static createTrack(nodes) {
      const track = new Track(nodes);
      tracks.push(track);
      return track;
   }

   static isValidSwitch(location, tracks) {
      const allNodes = tracks.flatMap((track) => track.nodes).filter((n) => n._tmp.prev.equals(location) || n.equals(location));
      if (!allNodes.length.between(3, 4)) {
         console.log("1");
         return false;
      }
      const ordered_nodes = allNodes.toSorted((n, n1) => n1._tmp.rad - n1._tmp.rad);
      if (ordered_nodes[0]._tmp.rad != ordered_nodes[1]._tmp.rad) {
         console.log("2");
         return false;
      }
      return true;
   }

   /**
    * Creates a switch object based on the provided location and tracks.
    *
    * @param {Object} location - The location of the switch.
    * @param {Array} tracks - An array of track objects.
    * @returns {Object} The created switch object.
    * @throws {Error} If the tracks do not have 2 different angles.
    */
   static createSwitch(location, tracks) {
      const sw = {
         location: location,
         t1: null,
         t2: null,
         t3: null,
         type: 0,
         branch: null,
         from: null,
      };

      const left_tracks = tracks.filter((t) => t.end.equals(location));
      const right_tracks = tracks.filter((t) => t.start.equals(location));
      let rad = 0;

      if (left_tracks.length == 1) {
         sw.t1 = left_tracks[0];
         rad = sw.t1.end._tmp.rad;
         sw.t2 = right_tracks.find((t) => t.nodes.first()._tmp.rad == rad);
      } else {
         sw.t1 = right_tracks[0];
         rad = sw.t1.nodes.first()._tmp.rad;
         sw.t2 = left_tracks.find((t) => t.end._tmp.rad == rad);
      }

      if (sw.t2 == null) throw new Error("couldnt find 2 tracks with the same slope");

      //find the other two tracks and sort them by their start point
      [sw.t3, sw.t4] = tracks.filter((t) => t != sw.t1 && t != sw.t2).sort((a, b) => a.start.x - b.start.x);

      if (sw.t4) sw.type = SWITCH_TYPE.DKW;
      else {
         const angle = findAngle(location, sw.t3.end.equals(location) ? sw.t3.end : sw.t3.nodes.first(), rad);
         sw.type = Math.ceil((angle % 360) / 90);
      }
      //console.log(Object.keys(SWITCH_TYPE).find((key) => SWITCH_TYPE[key] === sw.type));

      sw.branch = sw.t2;
      sw.from = sw.t1;
      return sw;
   }

   static connectTracks() {
      tracks.forEach((track) => (track._tmp.switches = [])); //delets all swichtes
      let intersection,
         skip = false; // true if the track was already split

      let new_tracks = [];
      let remainingTracks = [...tracks]; //copy of the tracks, will be modified during the loop

      //iterate over all tracks and search for intersections
      while (remainingTracks.length > 0) {
         skip = false;
         const track1 = remainingTracks.shift();
         //iterate over all nodes of the track
         for (let j = 0; j < track1.nodes.length && !skip; j++) {
            const node1 = track1.nodes[j];
            //iterate over all remaining tracks (all tracks from the start plus the new tracks, which were created during the loop)
            for (let k = 0; k < remainingTracks.length && !skip; k++) {
               const track2 = remainingTracks[k];
               //iterate over all nodes of the second track
               for (let l = 0; l < track2.nodes.length; l++) {
                  const node2 = track2.nodes[l];
                  // retrive the intersection point of the two nodes
                  intersection = geometry.getIntersectionPoint(
                     { start: node1._tmp.prev, end: node1 },
                     { start: node2._tmp.prev, end: node2 }
                  );
                  //check if the intersection point is on the grid
                  if (intersection && intersection.x % GRID_SIZE == 0 && intersection.y % GRID_SIZE == 0) {
                     //now we need to splitt both tracks at the intersection point
                     //if the intersection point is not the start or end point of the tracks
                     if (!intersection.equals(track1.start) && !intersection.equals(track1.end)) {
                        const nodes = Track.splitTrackAtPoint(track1, intersection);
                        tracks.remove(track1);
                        nodes.forEach((nodes) => new_tracks.push(...Track.checkNodesAndCreateTracks(nodes)));
                        remainingTracks.push(...new_tracks);
                        new_tracks = [];
                        skip = true;
                     }

                     if (!intersection.equals(track2.start) && !intersection.equals(track2.end)) {
                        const nodes = Track.splitTrackAtPoint(track2, intersection);
                        tracks.remove(track2);
                        remainingTracks.remove(track2);
                        nodes.forEach((nodes) => new_tracks.push(...Track.checkNodesAndCreateTracks(nodes)));
                        remainingTracks.push(...new_tracks); //OPT: maybe only if the tracks are longer then 1.5
                        new_tracks = [];
                        skip = true;
                        console.log(`split track2 (${track2._tmp.id}) at ${intersection.x},${intersection.y}`);
                     }
                  }

                  if (skip) break;
               }
            }
         }
      }

      remainingTracks = [...tracks]; //copy of the tracks, will be modified during the loop
      //iterate over all tracks and search for intersections
      while (remainingTracks.length > 0) {
         const track = remainingTracks.shift();

         const end_node = track.end; //gets its endpoint

         //searches for every track wich starts or ends at that point
         const connected_tracks = tracks.filter((t) => t != track && (t.start.equals(end_node) || t.end.equals(end_node)));

         if (connected_tracks.length == 1) {
            const t = connected_tracks[0];
            const n = t.nodes.first();
            const angle = geometry.calculateAngle(end_node, n, end_node._tmp.prev);
            

            if (angle > 90) {
               remainingTracks.push(...Track.joinTracks(track, connected_tracks[0]));
               remainingTracks.remove(connected_tracks[0]);
            }
         }
      }

      let sw;
      for (let i = 0; i < tracks.length; i++) {
         const track = tracks[i];
         if (track.switchAtTheEnd) continue;
         const end_node = track.end; //gets its endpoint

         //searches for every track wich starts or ends at that point
         const connected_tracks = tracks.filter((t) => t != track && (t.start.equals(end_node) || t.end.equals(end_node)));
         

         if (connected_tracks.length.between(2, 3)) {
            connected_tracks.push(track);

            if (Track.isValidSwitch(end_node, connected_tracks)) {
               sw = Track.createSwitch(end_node, connected_tracks);
               [sw.t1, sw.t2, sw.t3, sw.t4].forEach((track) => track && track.addSwitch(sw));
            }
         }
      }
   }

   static calcTempValues4Nodes(p1, p2) {
      if (p2 == null) return;
      if (p1 == null) {
         p2._tmp = {};
         return;
      }
      if (p1.x === p2.x && p1.y === p2.y) throw new Error("two same points are not allowed for a node");

      p2._tmp = {};
      p2._tmp.prev = p1;
      p2._tmp.vector = {
         x: p2.x - p1.x,
         y: p2.y - p1.y,
      };
      p2._tmp.rad = Math.atan(p2._tmp.vector.y / p2._tmp.vector.x);
      p2._tmp.deg = p2._tmp.rad * (180 / Math.PI);

      p2._tmp.length = geometry.length(p2._tmp.vector);
      p2._tmp.unit = new V2(geometry.unit(p2._tmp.vector, p2._tmp.length));

      p2._tmp.slope = geometry.slope(p1, p2);

      p2._tmp.sin = Math.sin(p2._tmp.rad);
      p2._tmp.cos = Math.cos(p2._tmp.rad);
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

   nodes = [];
   #_start = null;
   signals = [];
   rendered = false;

   //Temp values
   _tmp = {
      switches: [null, null],
      id: 0,
   };

   get id() {
      return this._tmp.id;
   }

   get start() {
      return this.#_start;
   }

   get end() {
      return this.nodes.last();
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

   get length() {
      return this.nodes.reduce((acc, p, i) => (acc += p._tmp.length), 0);
   }

   constructor(nodes) {
      if (!nodes || nodes.length <= 1) throw new Error("Track must have at least 2 nodes");
      this._tmp.id = Track._getID();

      const start = nodes.shift();

      if (type(start) == "Point") this.#_start = start;
      else this.#_start = new Point(start.x, start.y);

      this.nodes = nodes;
   }

   /*    addNode(p2) {
      const p1 = this.nodes.length > 0 ? this.nodes.last() : this.start;

      this.calcTempValues4Nodes(p1, p2);

      //if the last node has the same angle as the new node, remove the last node to remove unnessesary nodes
      if (p1._tmp && p1._tmp.deg == p2._tmp.deg) {
         this.nodes.pop();
      }

      this.nodes.push(p2);
   } */

   /*   finish() {
      if (this.start.x > this.end.x) {
         this.nodes.reverse();
         this.nodes.push(this.start);
         this.#_start = this.nodes.shift();
         for (let i = 0; i < this.nodes.length; i++) {
            const p2 = this.nodes[i];
            const p1 = i == 0 ? this.#_start : this.nodes[i - 1];
            this.calcTempValues4Nodes(p1, p2);
         }
      }
   } */

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
      this.calcTempValues4Nodes();

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
      this.calcTempValues4Nodes();
   }

   //returns the point, if u go x km from point along the track, so point must be track.start or track.end
   //the direction is automaticly optained
   along(point, x) {
      x = x * (point.x == this.start.x ? 1 : -1);
      if (x > 0) return geometry.add(point, geometry.multiply(this.nodes.first()._tmp.unit, x));
      else return geometry.add(point, geometry.multiply(this.end._tmp.unit, x));
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
