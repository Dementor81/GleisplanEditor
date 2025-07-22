"use strict";

// ES6 Module imports
import { geometry, V2, Point, type } from "./tools.js";
import { Switch } from "./switch.js";
import { Signal } from "./signal.js";
import { ArrayUtils } from "./utils.js";
import { CONFIG } from "./config.js";

export class Track {
   static allTracks = [];

   //this function checks if the point is a valid node point for the track drawing
   //nodes is an array of points that are already used as nodes, the array can be null
   static isValidTrackNodePoint(p, nodes) {
      if (!nodes || nodes.length === 0) {
         return true; // First point is always valid
      }
      const lastNode = nodes[nodes.length - 1];

      if (p.equals(lastNode)) return true;

      // 1. Disallow vertical movement
      if (p.x === lastNode.x && p.y != lastNode.y) {
         return false;
      }

      if (nodes.length >= 2) {
         const secondLastNode = nodes[nodes.length - 2];

         // 2. Check for consistent X movement direction
         const xDirection = Math.sign(lastNode.x - secondLastNode.x);
         const newXDirection = Math.sign(p.x - lastNode.x);
         if (xDirection !== 0 && newXDirection !== xDirection) {
            return false;
         }

         // 3. Check if the slope change is less than 45°
         const v1 = { x: lastNode.x - secondLastNode.x, y: lastNode.y - secondLastNode.y };
         const v2 = { x: p.x - lastNode.x, y: p.y - lastNode.y };

         const angle1 = Math.atan2(v1.y, v1.x);
         const angle2 = Math.atan2(v2.y, v2.x);
         let angleDiff = Math.abs(angle1 - angle2);

         if (angleDiff > Math.PI) {
            angleDiff = 2 * Math.PI - angleDiff;
         }

         if (angleDiff > Math.PI / 4) {
            return false;
         }
      }

      //check against the existing rail network
      /* for (const track of Track.allTracks) {
         if (geometry.doLineSegmentsIntersect(p, lastNode, track.start, track.end)) {
            // if the new segment starts at an endpoint of the track, it is considered a valid connection, not an overlap.
            if (lastNode.equals(track.start) || lastNode.equals(track.end) || p.equals(track.start) || p.equals(track.end)) {
               //todo: check the angle between the new segment and the existing track
               continue;
            }

            const newAngle = Math.atan2(p.y - lastNode.y, p.x - lastNode.x);
            const existingAngle = track.rad;
            let angleDiff = Math.abs(newAngle - existingAngle);

            if (angleDiff > Math.PI) {
               angleDiff = 2 * Math.PI - angleDiff;
            }

            // The difference must be approximately 45 degrees for a valid intersection
            const requiredAngle = Math.PI / 4; // 45 degrees
            const tolerance = 0.02; // radians, approx 1 degree

            if (Math.abs(angleDiff - requiredAngle) > tolerance) {
               return false;
            }
         }
      } */

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

   /**
    * Joins two tracks together, track2 will be removed and track1 will be extended
    * the tracks will be ordered automatically, so it doesn't matter which track is passed first
    * @param {Track} track1 - The first track
    * @param {Track} track2 - The second track
    */
   static joinTrack(track1, track2) {
      if (track1.slope !== track2.slope) {
         throw new Error("Tracks have different slopes and cannot be joined");
      }

      // Order track1 and track2 so that track1 is always "in front" of track2 by x and y
      // "In front" means: track1.start.x < track2.start.x, or if equal, track1.start.y < track2.start.y
      if (track1.start.x > track2.start.x || (track1.start.x === track2.start.x && track1.start.y > track2.start.y)) {
         // Swap track1 and track2
         const tmp = track1;
         track1 = track2;
         track2 = tmp;
      }

      if (
         (track1.switchAtTheEnd && track1.switchAtTheEnd != track2) ||
         (track2.switchAtTheStart && track2.switchAtTheStart != track1)
      ) {
         throw new Error("Tracks are connected and cannot be joined together");
      }

      let cut_km = track1.length;
      track1.setNewEnd(track2.end);

      track1.switchAtTheEnd = null;

      // Remove any existing switch between the two tracks
      if (track2.switchAtTheEnd) {
         if (track2.switchAtTheEnd instanceof Switch) {
            track2.switchAtTheEnd.replaceTrackReference(track2, track1);
         }
         track1.switchAtTheEnd = track2.switchAtTheEnd;
      }

      track2.signals.forEach((s) => {
         s._positioning.track = track1;
         s._positioning.km += cut_km;
      });
   }

   static checkNodesAndCreateTracks(points) {
      if (points == null || points.length <= 1) return;

      points = (() => {
         const filtered = [];
         let curr_point = points[0];
         let prev_slope = null;
         for (let i = 0; i < points.length - 1; i++) {
            const next_point = points[i + 1];
            const slope = geometry.slope(curr_point, next_point);
            if (slope !== prev_slope) {
               filtered.push(curr_point);
            }
            prev_slope = slope;
            curr_point = next_point;
         }

         filtered.push(ArrayUtils.last(points));
         return filtered;
      })();

      const new_tracks = [];

      //reverse the points array if the user drew it from right to left, or if the user drew straight from bottom to top
      if (
         ArrayUtils.first(points).x > ArrayUtils.last(points).x ||
         (ArrayUtils.first(points).x == ArrayUtils.last(points).x && ArrayUtils.first(points).y > ArrayUtils.last(points).y)
      ) {
         points.reverse();
      }

      let current_point = points.shift();
      let tmp_points = [current_point];

      //iterate over all points and create tracks
      while (points.length > 0) {
         const next_point = points.shift();
         const current_track = new Track(current_point, next_point);

         // Check if the new segment would overlap with any existing track
         const overlapping_tracks = Track.allTracks
            .filter((track) => current_track.slope === track.slope)
            .filter((track) => {
               return geometry.areSegmentsOverlapping2D(current_point, next_point, track.start, track.end);
            });

         if (overlapping_tracks.length === 0) {
            // No overlap, create a new track
            new_tracks.push(current_track);
         } else {
            // Handle overlapping tracks
            for (const overlapping_track of overlapping_tracks) {
               // Helper: get distances along the overlapping track
               const startOn = geometry.pointOnLine(overlapping_track.start, overlapping_track.end, current_point);
               const endOn = geometry.pointOnLine(overlapping_track.start, overlapping_track.end, next_point);

               // Case 1: new track is fully inside the overlapping track
               if (startOn && endOn) {
                  //we do nothing, the new track is fully inside the overlapping track
               }
               // Case 2: new track fully covers the overlapping track
               else if (
                  !startOn &&
                  !endOn &&
                  geometry.pointOnLine(current_point, next_point, overlapping_track.start) &&
                  geometry.pointOnLine(current_point, next_point, overlapping_track.end)
               ) {
                  // Remove the overlapping track, add the new track
                  overlapping_track.setNewStart(current_point);
                  overlapping_track.setNewEnd(next_point);
               }
               // Case 3: new track starts before and ends inside the overlapping track
               else if (!startOn && endOn) {
                  overlapping_track.setNewStart(current_point);
               }
               // Case 4: new track starts inside and ends after the overlapping track
               else if (startOn && !endOn) {
                  overlapping_track.setNewEnd(next_point);
               }
               // If none of the above, just skip (or handle as needed)
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
            if (intersection && intersection.x % CONFIG.GRID_SIZE == 0 && intersection.y % CONFIG.GRID_SIZE == 0) {
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
                  ArrayUtils.remove(new_tracks, track1);

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
                  ArrayUtils.remove(new_tracks, track2);
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
      const old_start = this.start;
      this.#_start = newStart;
      const added_length = geometry.distance(old_start, newStart);
      this.#resetCache();

      this.signals.forEach((s) => {
         s._positioning.km += added_length;
      });
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
