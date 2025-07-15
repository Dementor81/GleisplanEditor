"use strict";

// ES6 Module imports
import { geometry, V2, Point, type } from './tools.js';
import { Switch } from './switch.js';
import { Signal } from './signal.js';
import { ArrayUtils } from './utils.js';

export class Track {
   static allTracks = [];

   //track drawing
   static isValidTrackNodePoint(p) {
      return true;
   }

   static findTrackbySignal(s) {
      return Track.allTracks.find((t) => t.signals.find((o) => o.data == s) != undefined);
   }
   static findTrackByPoint(p) {
      return Track.allTracks.find((track) => {
         return geometry.pointOnLine(track.start, track.end, p);
      });
   }

   static counter = 0;

   static _getID() {
      return Track.counter++;
   }

   static splitTrackAtPoint(track, point) {
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

      // Remove any existing switch between the two tracks
      if (track2.switchAtTheStart) {
         Switch.removeSwitch(track2.switchAtTheStart);
      }

      if (track1.switchAtTheEnd) {
         Switch.removeSwitch(track1.switchAtTheEnd);
      }

      track2.signals.forEach((s) => {
         s._positioning.track = track1;
         s._positioning.km += cut_km;
         track1.AddSignal(s);
      });
   }

   static checkNodesAndCreateTracks(points) {
      if (points == null || points.length <= 1) return;

      const new_tracks = [];

      //reverse the points array if the user drew it from right to left, or if the user drew straight from bottom to top
      if (ArrayUtils.first(points).x > ArrayUtils.last(points).x || (ArrayUtils.first(points).x == ArrayUtils.last(points).x && ArrayUtils.first(points).y > ArrayUtils.last(points).y)) {
         points.reverse();
      }

      let current_point = points.shift();
      let tmp_points = [current_point];

      //iterate over all points and create tracks
      while (points.length > 0) {
         const next_point = points.shift();

         // Check if the new segment would overlap with any existing track
         const overlapping_tracks = Track.allTracks.filter((track) => {
            return geometry.areSegmentsOverlapping2D(current_point, next_point, track.start, track.end);
         });

         if (overlapping_tracks.length === 0) {
            // No overlap, create a new track
            tmp_points.push(next_point);
            if (tmp_points.length >= 2) {
               new_tracks.push(new Track(tmp_points[0], tmp_points[1]));
               tmp_points = [next_point];
            }
         } else {
            // Handle overlapping tracks
            const overlapping_track = overlapping_tracks[0];

            // If we have a partial track before the overlap, create it
            if (tmp_points.length >= 2) {
               new_tracks.push(new Track(tmp_points[0], tmp_points[1]));
            }

            // Check if we need to create a track from the last point to the overlap point
            if (!current_point.equals(overlapping_track.start) && !current_point.equals(overlapping_track.end)) {
               // Find the overlap point
               const overlap_point = geometry.getIntersectionPoint(
                  current_point,
                  next_point,
                  overlapping_track.start,
                  overlapping_track.end
               );

               if (overlap_point) {
                  new_tracks.push(new Track(current_point, overlap_point));
                  tmp_points = [overlap_point];
               }
            }
         }

         current_point = next_point;
      }

      // Create final track if we have remaining points
      if (tmp_points.length >= 2) {
         new_tracks.push(new Track(tmp_points[0], tmp_points[1]));
      }

      Track.allTracks.push(...new_tracks);

      return new_tracks;
   }

   static splitTracksAtIntersections() {
      let intersection,
         skip = false, // true if the track was already split
         new_tracks = [],
         remainingTracks = [...Track.allTracks]; //copy of the tracks, will be modified during the loop

      //iterate over all tracks and search for intersections
      while (remainingTracks.length > 0) {
         skip = false;
         const track1 = remainingTracks.shift();

         //iterate over all remaining tracks
         for (let k = 0; k < remainingTracks.length && !skip; k++) {
            const track2 = remainingTracks[k];

            // Get intersection point of the two tracks
            intersection = geometry.getIntersectionPoint(track1, track2);

            //check if the intersection point is on the grid
            if (intersection && intersection.x % window.GRID_SIZE == 0 && intersection.y % window.GRID_SIZE == 0) {
               // Split track1 if intersection is not at start or end
               if (!intersection.equals(track1.start) && !intersection.equals(track1.end)) {
                  const km = track1.getKmfromPoint(intersection);
                  const signals_on_track = [...track1.signals];

                  // Create two new tracks
                  const t1 = new Track(track1.start, intersection);
                  const t2 = new Track(intersection, track1.end);

                  const startSwitch = track1.switchAtTheStart;
                  if (startSwitch) {
                     if (startSwitch instanceof Switch) {
                        startSwitch.replaceTrackReference(track1, t1);
                        t1.switchAtTheStart = startSwitch;
                     } else if (startSwitch instanceof Track) {
                        // If it's a track, update the track reference
                        if (startSwitch.switchAtTheEnd === track1) {
                           startSwitch.switchAtTheEnd = t1;
                        } else if (startSwitch.switchAtTheStart === track1) {
                           startSwitch.switchAtTheStart = t1; //Ich glaube das ist nicht nötig
                        }
                        t1.switchAtTheStart = startSwitch;
                     }

                     
                  }

                  const endSwitch = track1.switchAtTheEnd;
                  if (endSwitch) {
                     if (endSwitch instanceof Switch) {
                        endSwitch.replaceTrackReference(track1, t2);
                        t2.switchAtTheEnd = endSwitch;
                     } else if (endSwitch instanceof Track) {
                        // If it's a track, update the track reference
                        if (endSwitch.switchAtTheEnd === track1) {
                           endSwitch.switchAtTheEnd = t2;
                        } else if (endSwitch.switchAtTheStart === track1) {
                           endSwitch.switchAtTheStart = t2; //Ich glaube das ist nicht nötig
                        }
                        t2.switchAtTheEnd = endSwitch;
                     }
                  }

                  // Remove the original track
                  ArrayUtils.remove(Track.allTracks, track1);
                  ArrayUtils.remove(remainingTracks, track1);

                  // Add new tracks
                  new_tracks.push(t1, t2);

                  // Reassign signals to the appropriate new track
                  signals_on_track.forEach((signal) => {
                     if (signal._positioning.km < km) {
                        signal.setTrack(t1, signal._positioning.km);
                     } else {
                        signal.setTrack(t2, signal._positioning.km - km);
                     }
                  });

                  remainingTracks.push(t1, t2);
                  skip = true;
               }

               // Split track2 if intersection is not at start or end
               if (!intersection.equals(track2.start) && !intersection.equals(track2.end)) {
                  const km = track2.getKmfromPoint(intersection);
                  const signals_on_track = [...track2.signals];

                  // Create two new tracks
                  const t1 = new Track(track2.start, intersection);
                  const t2 = new Track(intersection, track2.end);

                  const startSwitch = track2.switchAtTheStart;
                  if (startSwitch) {
                     if (startSwitch instanceof Switch) {
                        startSwitch.replaceTrackReference(track2, t1);
                        t1.switchAtTheStart = startSwitch;
                     } else if (startSwitch instanceof Track) {
                        // If it's a track, update the track reference
                        if (startSwitch.switchAtTheEnd === track2) {
                           startSwitch.switchAtTheEnd = t1;
                        } else if (startSwitch.switchAtTheStart === track2) {
                           startSwitch.switchAtTheStart = t1; //Ich glaube das ist nicht nötig
                        }
                        t1.switchAtTheStart = startSwitch;
                     }
                  }

                  const endSwitch = track2.switchAtTheEnd;
                  if (endSwitch) {
                     if (endSwitch instanceof Switch) {
                        endSwitch.replaceTrackReference(track2, t2);
                        t2.switchAtTheEnd = endSwitch;
                     } else if (endSwitch instanceof Track) {
                        // If it's a track, update the track reference
                        if (endSwitch.switchAtTheEnd === track2) {
                           endSwitch.switchAtTheEnd = t2;
                        } else if (endSwitch.switchAtTheStart === track2) {
                           endSwitch.switchAtTheStart = t2; //Ich glaube das ist nicht nötig
                        }
                        t2.switchAtTheEnd = endSwitch;
                     }
                  }

                  // Remove the original track
                  ArrayUtils.remove(Track.allTracks, track2);
                  ArrayUtils.remove(remainingTracks, track2);

                  // Add new tracks
                  new_tracks.push(t1, t2);

                  // Reassign signals to the appropriate new track
                  signals_on_track.forEach((signal) => {
                     if (signal._positioning.km < km) {
                        signal.setTrack(t1, signal._positioning.km);
                     } else {
                        signal.setTrack(t2, signal._positioning.km - km);
                     }
                  });

                  remainingTracks.push(t1, t2);
                  skip = true;
               }
            }
         }
      }

      // Add all new tracks to the global tracks array
      Track.allTracks.push(...new_tracks);
   }

   static cleanUpTracks() {
      let i = 0;
      while (i < Track.allTracks.length) {
         const track = Track.allTracks[i];

         //searches for every track wich starts or end at that point, filters tracks wich would combine to a 90° angle
         const connected_tracks = Track.allTracks.filter(
            (t) => t != track && (t.start.equals(track.end) || t.end.equals(track.end))
         );

         if (connected_tracks.length == 1 && connected_tracks[0].rad == track.rad) {
            Track.joinTrack(track, connected_tracks[0]);
            ArrayUtils.remove(Track.allTracks, connected_tracks[0]);
         } else i++;
      }
   }

   static createSwitches() {
      const processedPoints = new Set();

      Track.allTracks.forEach((track) => {
         const end_point = track.end;
         if (!processedPoints.has(end_point)) {
            Switch.updateSwitchAtPoint(end_point);
            processedPoints.add(end_point);
         }

         const start_point = track.start;
         if (!processedPoints.has(start_point)) {
            Switch.updateSwitchAtPoint(start_point);
            processedPoints.add(start_point);
         }
      });
   }

   static removeTrack(track) {
      // Get switches before removing the track
      const startSwitch = track.switchAtTheStart;
      const endSwitch = track.switchAtTheEnd;

      // Remove track from allTracks array
      ArrayUtils.remove(Track.allTracks, track);

      if (type(track.switchAtTheStart) == "Track") track.switchAtTheStart.switchAtTheEnd = null;
      if (type(track.switchAtTheEnd) == "Track") track.switchAtTheEnd.switchAtTheStart = null;
      
      // Update switches at the former track's endpoints
      Switch.updateSwitchAtPoint(track.start, startSwitch instanceof Switch ? startSwitch : null);
      Switch.updateSwitchAtPoint(track.end, endSwitch instanceof Switch ? endSwitch : null);

      // Remove any signals on the track
      track.signals.forEach((signal) => {
         ArrayUtils.remove(Signal.allSignals, signal);
      });
   }

   static createRailNetwork() {
      Track.splitTracksAtIntersections();
      Track.cleanUpTracks();
      Track.createSwitches();
   }

   #_start = null;
   #_end = null;
   signals = [];

   switches = [null, null];
   id = 0;

   // Vector calculations (moved from TrackNode)
   #_vector = null;
   #_rad = null;
   #_deg = null;
   #_length = null;
   #_unit = null;
   #_slope = null;
   #_sin = null;
   #_cos = null;

   get id() {
      return this.id;
   }

   get start() {
      return this.#_start;
   }

   get end() {
      return this.#_end;
   }

   get vector() {
      if (!this.#_vector) {
         this.#_vector = {
            x: this.#_end.x - this.#_start.x,
            y: this.#_end.y - this.#_start.y,
         };
      }
      return this.#_vector;
   }

   get rad() {
      if (!this.#_rad) this.#_rad = Math.atan2(this.vector.y, this.vector.x);
      return this.#_rad;
   }

   get deg() {
      if (!this.#_deg) this.#_deg = this.rad * (180 / Math.PI);
      return this.#_deg;
   }

   get length() {
      if (!this.#_length) this.#_length = geometry.length(this.vector);
      return this.#_length;
   }

   get unit() {
      if (!this.#_unit) this.#_unit = new V2(geometry.unit(this.vector, this.length));
      return this.#_unit;
   }

   get slope() {
      return this.#_slope ? this.#_slope : (this.#_slope = this.vector.y / this.vector.x);
   }

   get sin() {
      if (!this.#_sin) this.#_sin = Math.sin(this.rad);
      return this.#_sin;
   }

   get cos() {
      if (!this.#_cos) this.#_cos = Math.cos(this.rad);
      return this.#_cos;
   }

   #resetCache() {
      this.#_vector = null;
      this.#_rad = null;
      this.#_deg = null;
      this.#_length = null;
      this.#_unit = null;
      this.#_slope = null;
      this.#_sin = null;
      this.#_cos = null;
   }

   get switches() {
      return this.switches;
   }

   get switchAtTheEnd() {
      return this.switches[1];
   }

   set switchAtTheEnd(value) {
      this.switches[1] = value;
   }

   get switchAtTheStart() {
      return this.switches[0];
   }

   set switchAtTheStart(value) {
      this.switches[0] = value;
   }

   constructor(start, end) {
      if (!start || !end) throw new Error("Track must have start and end points");
      this.id = Track._getID();

      if (start instanceof Point) this.#_start = start;
      else this.#_start = new Point(start.x, start.y);

      if (end instanceof Point) this.#_end = end;
      else this.#_end = new Point(end.x, end.y);
   }

   //returns the Point
   getPointFromKm(km) {
      if (km < 0 || km > this.length) {
         throw new Error("Km exceeds track length");
      }
      const point = geometry.add(this.start, geometry.multiply(this.unit, km));
      return point;
   }

   getKmfromPoint(p) {
      if (p.equals(this.start)) {
         return 0;
      }

      if (!geometry.pointOnLine(this.start, this.end, p)) {
         throw new Error("Point is not on the track.");
      }

      const distanceOnTrack = geometry.distance(this.start, p);
      return distanceOnTrack;
   }

   //returns the point, if u go x km from point along the track, so point must be track.start or track.end
   //the direction is automaticly optained
   along(point, x) {
      return geometry.add(point, geometry.multiply(this.unit, x));
   }

   AddSignal(signal, km, above, flipped) {
      signal._positioning.km = km;
      signal._positioning.track = this;
      signal._positioning.above = above;
      signal._positioning.flipped = flipped;
      let i = this.signals.findIndex((s) => km < s._positioning.km);
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
      // Store switch at index 0 for start position, 1 for end position
      const isAtEnd = this.end.equals(sw.location);
      this.switches[isAtEnd ? 1 : 0] = sw;
   }

   stringify() {
      const switchData = this.switches.map((s) => {
         if (!s) return null;
         return { type: s.constructor.name, id: s.id };
      });
      return {
         _class: "Track",
         id: this.id,
         start: this.start,
         end: this.end,
         signals: this.signals,
         switches: switchData,
      };
   }

   static FromObject(o) {
      let t = new Track(Point.fromPoint(o.start), Point.fromPoint(o.end));
      t.id = o.id;
      t.signals = o.signals;
      t.switches_data = o.switches;
      t.signals.forEach(function (s) {
         s._positioning.track = t;
      });
      return t;
   }

   /**
    * Changes the start point of the track to the new point
    * @param {Point} newStart - The new start point
    */
   setNewStart(newStart) {
      if (!newStart) return;
      this.#_start = newStart;
      this.#resetCache();
   }

   /**
    * Changes the end point of the track to the new point
    * @param {Point} newEnd - The new end point
    */
   setNewEnd(newEnd) {
      if (!newEnd) return;
      this.#_end = newEnd;
      this.#resetCache();
   }
}


