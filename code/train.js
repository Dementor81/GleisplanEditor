"use strict";

class Train {
   static allTrains = [];

   static addTrain(track, km, color = "#ff0000") {
      const train = new Train();
      train.track = track;
      train.pos = km;
      train._color = color;

      return train;
   }

   static moveTrain(train, movementX) {
      let first_car = train;

      let last_car = train;
      while (last_car.trainCoupledBack != null) {
         last_car = last_car.trainCoupledBack;
      }

      if (!Train.movementPossible(first_car, movementX) || !Train.movementPossible(last_car, movementX)) return;
      //TODO check if the first and last car are either on the same track or the tracks are connected to prevent derailing
      let car = first_car;
      let new_pos;
      let currentTrack;

      currentTrack = car.track;
      new_pos = car.pos + movementX / stage.scale / currentTrack._tmp.cos;

      while (car) {
         if (car != first_car) {
            //new_pos = car.trainCoupledFront.pos + car.trainCoupledFront.track.start.x + renderer.TRAIN_WIDTH + 10 - car.track.start.x;
            new_pos += renderer.TRAIN_WIDTH + 10;
         }
         let newTrack;
         if (new_pos.outoff(0, currentTrack.length)) {
            const sw = new_pos <= 0 ? currentTrack.switchAtTheStart : currentTrack.switchAtTheEnd;

            if (sw) {
               if (type(sw) == "Track") newTrack = sw;
               else if (sw.from == currentTrack) newTrack = sw.branch;
               else if (sw.branch == currentTrack) newTrack = sw.from;

               if (newTrack) {
                  car.track = newTrack;
                  car.pos = new_pos <= 0 ? newTrack.length + new_pos : new_pos - currentTrack.length;
                  currentTrack = newTrack;
                  new_pos = car.pos;
               }
            }
         } else {
            car.track = currentTrack;
            car.pos = new_pos;
         }

         car = car.trainCoupledBack;
      }
   }

   static movementPossible(train, movementX) {
      const currentTrack = train.track;
      let new_pos = train.pos + movementX / stage.scale / currentTrack._tmp.cos;
      if (new_pos.outoff(0 + renderer.TRAIN_WIDTH / 2, currentTrack.length - renderer.TRAIN_WIDTH / 2)) {
         const sw = new_pos <= 0 + renderer.TRAIN_WIDTH / 2 ? currentTrack.switchAtTheStart : currentTrack.switchAtTheEnd;

         return sw != null && (type(sw) == "Track" || sw.from == currentTrack || sw.branch == currentTrack);
      } else return true;
   }

   static FromObject(o) {
      const train = new Train();
      train._color = o.color;
      train._coordinates = o.coordinates;
      train.trainCoupledBack = o.trainCoupledBack;
      return train;
   }

   _track = null;
   _pos = null;
   _coordinates = null;
   _color = "#000000";
   trainCoupledBack = null;

   get track() {
      return this._track;
   }

   set track(t) {
      this._track = t;
   }

   get pos() {
      return this._pos;
   }

   set pos(km) {
      this._pos = km;
      if (this._track) this._coordinates = geometry.add(this._track.start, this._track.getPointfromKm(km));
   }

   get color() {
      return this._color;
   }

   coupleBack(train) {
      this.trainCoupledBack = train;
   }

   restore() {
      const t = Track.findTrackByPoint(this._coordinates);
      if (t) {
         this.track = t;
         this.pos = t.getKmfromPoint(this._coordinates);
      }
      if (this.trainCoupledBack) this.trainCoupledBack.restore();
   }

   stringify() {
      return { _class: "Train", coordinates: this._coordinates, color: this._color, trainCoupledBack: this.trainCoupledBack };
   }
}
