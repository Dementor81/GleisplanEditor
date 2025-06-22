"use strict";

class Switch {
   static allSwitches = [];

   static SWITCH_TYPE = {
      NONE: 0,
      TO_RIGHT: 1, //45°
      FROM_RIGHT: 2, //135°
      FROM_LEFT: 3, //225°
      TO_LEFT: 4, //315°
      DKW: 9,
      CROSSING: 10,
   };

   //sw=switch location
   //rad= angle of track_1 in rad
   //c= end of the track_2 to find angle
   static findAngle(sw, c, rad = 0) {
      let atan = Math.atan2(c.y - sw.y, c.x - sw.x) - rad;
      if (atan < 0) atan += 2 * Math.PI; //macht aus neg Winkeln durch addition von 360° positive winkel

      let val = (atan * 180) / Math.PI;
      return val;
   }

   /**
    * Validates if a switch at a given location is valid based on the provided tracks.
    *
    * @param {Object} location - The location to check for a valid switch.
    * @param {Array} tracks - An array of track objects, each containing nodes with start and end points.
    * @returns {boolean} - Returns true if the switch is valid, otherwise false.
    */
   static isValidSwitch(location, tracks) {
      if (!tracks.length.between(3, 4)) {
         console.log(`too many nodes ${tracks.length}`);
         return false;
      }
      const slopes = tracks.map((t) => t.slope);
      const equal_slopes = slopes.countNonUnique();
      if (!((tracks.length == 3 && equal_slopes == 1) || (tracks.length == 4 && equal_slopes == 2))) {
         console.log(`2 tracks with the same slope are necessary`);
         return false;
      }

      for (let i = 1; i < slopes.length; i++) {
         if (Math.abs(slopes[i - 1] - slopes[i]) > 1) {
            console.log(`slope between 2 tracks must be lower than 45°`);
            return false;
         }
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
      const sw = new Switch(location);

      const left_tracks = tracks.filter((t) => t.end.equals(location)).sort((a, b) => b.slope - a.slope);
      const right_tracks = tracks.filter((t) => t.start.equals(location)).sort((a, b) => b.slope - a.slope);
      let rad = 0;

      if (left_tracks.length == 1) {
         sw.t1 = left_tracks[0];
         rad = sw.t1.rad;
         sw.t2 = right_tracks.find((t) => t.rad == rad);
      } else {
         sw.t1 = right_tracks[0];
         rad = sw.t1.rad;
         sw.t2 = left_tracks.find((t) => t.rad == rad);
      }

      if (sw.t2 == null) throw new Error("couldnt find 2 tracks with the same slope");

      //find the other two tracks and sort them by their start point
      [sw.t3, sw.t4] = tracks.filter((t) => t != sw.t1 && t != sw.t2).sort((a, b) => a.start.x - b.start.x);

      // Calculate direction vectors for each track branch
      sw.calculateParameters();

      //TODO calculate connection points and shorten the tracks

      sw.branch = sw.t2;
      sw.from = sw.t1;

      return sw;
   }

   /**
    * Checks for and creates/updates a switch at a specific point in the track network.
    * This function encapsulates the logic for determining if a point is a simple connection,
    * a valid switch, or an invalid connection, and performs the necessary updates.
    * @param {Point} point - The connection point to check.
    * @param {Switch} [existingSwitch=null] - An optional, pre-existing switch to re-evaluate.
    */
   static updateSwitchAtPoint(point, existingSwitch = null) {
      const tracksAtPoint = Track.allTracks.filter(
         (t) => t.start.equals(point) || t.end.equals(point)
      );

      if (!existingSwitch) {
         existingSwitch = Switch.allSwitches.find(sw => sw.location.equals(point));
      }else{
         if(!existingSwitch.location.equals(point)) throw new Error("existing switch at wrong point");
      }

      if (tracksAtPoint.length === 2) {
         // Simple connection, not a switch.
         const track1 = tracksAtPoint[0];
         const track2 = tracksAtPoint[1];

         if (track1.start.equals(point)) track1.switchAtTheStart = track2;
         else track1.switchAtTheEnd = track2;
         
         if (track2.start.equals(point)) track2.switchAtTheStart = track1;
         else track2.switchAtTheEnd = track1;

         if (existingSwitch) {
            Switch.removeSwitch(existingSwitch);
         }
      } else if (tracksAtPoint.length.between(3, 4)) {
         // Potential switch.
         if (Switch.isValidSwitch(point, tracksAtPoint)) {
            if (existingSwitch) {
               const existingTracks = [existingSwitch.t1, existingSwitch.t2, existingSwitch.t3, existingSwitch.t4].filter(t => t);
               const tracksMatch = existingTracks.length === tracksAtPoint.length &&
                  existingTracks.every(existingTrack => tracksAtPoint.some(currentTrack => currentTrack === existingTrack));

               if (!tracksMatch) {
                  Switch.removeSwitch(existingSwitch);
                  const sw = Switch.createSwitch(point, tracksAtPoint);
                  [sw.t1, sw.t2, sw.t3, sw.t4].forEach((track) => track && track.addSwitch(sw));
                  Switch.allSwitches.push(sw);
               }
            } else {
               const sw = Switch.createSwitch(point, tracksAtPoint);
               [sw.t1, sw.t2, sw.t3, sw.t4].forEach((track) => track && track.addSwitch(sw));
               Switch.allSwitches.push(sw);
            }
         } else if (existingSwitch) {
            Switch.removeSwitch(existingSwitch);
         }
      } else if (existingSwitch) {
         // Any other configuration is not a switch, so remove if one exists.
         Switch.removeSwitch(existingSwitch);
      }
   }

   /**
    * Removes a switch and cleans up all references to it
    * @param {Switch} switchToRemove - The switch to remove
    */
   static removeSwitch(switchToRemove) {
      // Remove switch from all tracks that reference it
      [switchToRemove.t1, switchToRemove.t2, switchToRemove.t3, switchToRemove.t4].forEach((track) => {
         if (track) {
            track.switches = track.switches.map((sw) => (sw === switchToRemove ? null : sw));
         }
      });

      // Remove switch from the global switches array
      Switch.allSwitches.remove(switchToRemove);
   }

   static switch_A_Switch(sw, mouseX) {
      if (!sw.type.is(Switch.SWITCH_TYPE.DKW)) {
         sw.branch = swap(sw.branch, sw.t2, sw.t3);
      } else {
         if (mouseX < sw.location.x) {
            sw.branch = swap(sw.branch, sw.t2, sw.t3);
         } else {
            sw.from = swap(sw.from, sw.t1, sw.t4);
         }
      }
   }

   constructor(location) {
      this.id = Switch.allSwitches.length + 1;
      this.location = location;
      this.type = Switch.SWITCH_TYPE.NONE;

      this.size = GRID_SIZE;

      this.t1 = null;
      this.t2 = null;
      this.t3 = null;
      this.t4 = null;

      this.branch = null;
      this.from = null;

      // Direction information for rendering - stores the direction vector for each track
      this.track_directions = new Array(4);
   }

   /**
    * Calculates the direction vectors for each track branch
    * This eliminates the need for runtime direction calculations during rendering
    */
   calculateParameters() {
      // For each track, determine if it connects to the switch at its start or end
      // and use the appropriate direction (unit vector or its opposite)

      this.track_directions = [this.t1, this.t2, this.t3, this.t4].map((track) =>
         track ? (track.end.equals(this.location) ? V2.fromV2(track.unit).invert() : V2.fromV2(track.unit)) : null
      );

      if (this.t4) this.type = Switch.SWITCH_TYPE.DKW;
      else {
         const angle = Switch.findAngle(this.location, this.t3.end, this.t3.rad);
         this.type = Math.ceil((angle % 360) / 90);
      }
   }

   /**
    * Replaces all references to an old track with a new track within this switch.
    * @param {Track} oldTrack - The track to be replaced.
    * @param {Track} newTrack - The new track to reference.
    */
   replaceTrackReference(oldTrack, newTrack) {
      if (this.t1 === oldTrack) this.t1 = newTrack;
      if (this.t2 === oldTrack) this.t2 = newTrack;
      if (this.t3 === oldTrack) this.t3 = newTrack;
      if (this.t4 === oldTrack) this.t4 = newTrack;

      if (this.branch === oldTrack) this.branch = newTrack;
      if (this.from === oldTrack) this.from = newTrack;

      // After updating track references, it's crucial to recalculate the directions
      // for rendering and other logic.
      this.calculateParameters();
   }
}
