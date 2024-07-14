"use strict";

class Train {
   static allTrains = [];

   static addTrain(track, pointX) {
      const train = new Train(track, pointX);
      Train.allTrains.push(train);
      return train;
   }

   static moveTrain(train, movementX) {
      let first_car = train;
      while (first_car.trainCoupledFront != null) {
         first_car = first_car.trainCoupledFront;
      }

      let last_car = train;
      while (last_car.trainCoupledBack != null) {
         last_car = last_car.trainCoupledBack;
      }

      if (!Train.movementPossible(first_car, movementX) || !Train.movementPossible(last_car, movementX)) return;
      //TODO check if the first and last car are either on the same track or the tracks are connected to prevent derailing
      let car = first_car;

      while (car) {
         let currentTrack;
         let new_pos;
         if (car.trainCoupledFront) {
            currentTrack = car.trainCoupledFront.track;
            //new_pos = car.trainCoupledFront.pos + car.trainCoupledFront.track.start.x + renderer.TRAIN_WIDTH + 10 - car.track.start.x;
            new_pos = car.trainCoupledFront.pos + renderer.TRAIN_WIDTH + 10;
         } else {
            currentTrack = car.track;
            new_pos = car.pos + movementX / stage.scale / currentTrack._tmp.cos;
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

   constructor(track, pos) {
      this.track = track;
      this.pos = pos;
   }

   coupleBack(train) {
      this.trainCoupledBack = train;
      train.trainCoupledFront = this;
   }
}
