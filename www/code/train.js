"use strict";

class Train {
   static allTrains = [];
   static nextId = 0;

   static CAR_TYPES = {
      LOCOMOTIVE: "locomotive",
      PASSENGER: "passenger",
      MULTIPLE_UNIT_CAR: "multiple_unit_car",
      MULTIPLE_UNIT_HEAD_FRONT: "multiple_unit_head_front",
      MULTIPLE_UNIT_HEAD_BACK: "multiple_unit_head_back"
   };

   static getNextId() {
      return Train.nextId++;
   }


   // Constants for different car types
   static LOCO_LENGTH = 42;
   static PASSENGER_LENGTH = 50;
   static MULTIPLE_UNIT_CAR_LENGTH = 50;
   static MULTIPLE_UNIT_HEAD_FRONT_LENGTH = 50;
   static MULTIPLE_UNIT_HEAD_BACK_LENGTH = 50;
   
   // Car spacing
   static CAR_SPACING = 5;

   static addTrain(track, km, color = "#ff0000", type = Train.CAR_TYPES.LOCOMOTIVE, number = "") {
      const train = new Train();
      train.track = track;
      train.pos = km;
      train._color = color;
      train._type = type;
      train._number = number;      
      
      Train.allTrains.push(train);
      return train;
   }

   static initEditTrainMenu(train) {
      $("#colorInputTrain")
         .off()
         .val(train.color)
         .on("change", function (e) {
            train.color = $(this).val();
            renderer.renderAllTrains();
            stage.update();
            STORAGE.save();
         });

      $("#inputZugnummer")
         .off()
         .val(train.number)
         .on("change", function (e) {
            train.number = $(this).val();
            renderer.renderAllTrains();
            stage.update();
            STORAGE.save();
         });

      $("#selectTrainType")
         .off()
         .val(train.type)
         .on("change", function(e) {
            train.type = $(this).val();
            renderer.renderAllTrains();
            stage.update();
            STORAGE.save();
         });

      $("#btnRemoveTrain")
         .off()
         .click(() => Train.deleteTrain(train));
         
      $("#btnCoupleTrain")
         .off()
         .click(() => {
            // Set global state for coupling mode
            if (!window.couplingMode) {
               window.couplingMode = {
                  firstCar: train,
                  message: "Select second car to couple"
               };
               // Show coupling message
               $("#couplingMessage").text(window.couplingMode.message).show();
            } else {
               // Complete coupling
               const firstCar = window.couplingMode.firstCar;
               firstCar.coupleBack(train);
               // Reset coupling mode
               window.couplingMode = null;
               $("#couplingMessage").hide();
               renderer.renderAllTrains();
               stage.update();
               STORAGE.save();
            }
         });
         
      $("#btnUncoupleTrain")
         .off()
         .click(() => {
            if (train.trainCoupledBack) {
               train.uncouple();
               renderer.renderAllTrains();
               stage.update();
               STORAGE.save();
            }
         });
   }

   static deleteTrain(train) {
      // Uncouple the train from both ends
      if (train.trainCoupledFront) {
         train.trainCoupledFront.trainCoupledBack = null;
         train.trainCoupledFront = null;
      }
      
      // Get the last car in the train that will be deleted
      let currentCar = train;
      while (currentCar.trainCoupledBack) {
         currentCar = currentCar.trainCoupledBack;
      }
      
      // Remove all cars in this train from allTrains      
      while (currentCar) {
         this.allTrains.remove(currentCar);
         const nextCar = currentCar.trainCoupledFront;
         currentCar.trainCoupledFront = null;
         currentCar.trainCoupledBack = null;
         currentCar.track = null;
         currentCar.pos = null;
         currentCar = nextCar;
      }
      
      renderer.renderAllTrains();
      stage.update();
      STORAGE.save();
   }

   static moveTrain(train, movementX) {
      // Find the head of the train (first car with no front coupling)
      let firstCar = train;
      while (firstCar.trainCoupledFront != null) {
         firstCar = firstCar.trainCoupledFront;
      }

      // Find the last car
      let lastCar = firstCar;
      while (lastCar.trainCoupledBack != null) {
         lastCar = lastCar.trainCoupledBack;
      }

      if (!Train.movementPossible(firstCar, movementX) || !Train.movementPossible(lastCar, movementX)) return;
      
      // Move each car starting from the first
      let car = firstCar;
      let new_pos;
      let currentTrack;

      currentTrack = car.track;
      
      // Get the node the car is currently on
      const trackPosition = currentTrack.getPointFromKm(car.pos);
      const currentNode = trackPosition.node;
      
      // Calculate new position using the node's unit vector
      new_pos = car.pos + movementX / stage.scale / currentNode.cos;

      while (car) {
         if (car != firstCar) {
            // Calculate position based on previous car and car length
            // Take into account the spacing between cars (5 units)
            const prevCar = car.trainCoupledFront;
            const spacing = 5; // Gap between cars
            new_pos = prevCar.pos + prevCar.length/2 + spacing + car.length/2;
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
      
      // Get the node the train is currently on
      const trackPosition = currentTrack.getPointFromKm(train.pos);
      const currentNode = trackPosition.node;
      
      // Calculate new position using the node's unit vector
      let new_pos = train.pos + movementX / stage.scale / currentNode.cos;
      
      if (new_pos.outoff(0 + train.length / 2, currentTrack.length - train.length / 2)) {
         const sw = new_pos <= 0 + train.length / 2 ? currentTrack.switchAtTheStart : currentTrack.switchAtTheEnd;

         return sw != null && (type(sw) == "Track" || sw.from == currentTrack || sw.branch == currentTrack);
      } else return true;
   }

   static FromObject(o) {
      const train = new Train();
      train._id = o._id;
      Train.nextId = Math.max(Train.nextId, o._id + 1);
      train._color = o.color;
      train._coordinates = Point.fromPoint(o.coordinates);
      train._type = o.type || Train.CAR_TYPES.LOCOMOTIVE;
      train._number = o.number || "";
      train.trainCoupledBackId = o.trainCoupledBackId;
      train.trainCoupledFrontId = o.trainCoupledFrontId;
      return train;
   }

   

   _id = Train.getNextId();
   _track = null;
   _pos = null;
   _coordinates = null;
   _color = "#000000";
   _number = "";
   _type = Train.CAR_TYPES.LOCOMOTIVE;
   trainCoupledBack = null;
   trainCoupledFront = null;

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
      if (this._track) this._coordinates = this._track.getPointFromKm(km).point;
   }

   get color() {
      return this._color;
   }

   set color(c) {
      this._color = c;
      // Propagate color to all cars in the train
      let car = this.trainCoupledBack;
      while (car) {
         car._color = c;
         car = car.trainCoupledBack;
      }
   }

   get number() {
      return this._number;
   }
   
   set number(n) {
      this._number = n;
   }
   
   get type() {
      return this._type;
   }
   
   set type(t) {
      this._type = t;      
   }

   get length() {
      switch (this._type) {
         case Train.CAR_TYPES.LOCOMOTIVE:
            return Train.LOCO_LENGTH;
         case Train.CAR_TYPES.PASSENGER:
            return Train.PASSENGER_LENGTH;
         case Train.CAR_TYPES.MULTIPLE_UNIT_CAR:
            return Train.MULTIPLE_UNIT_CAR_LENGTH;
         case Train.CAR_TYPES.MULTIPLE_UNIT_HEAD_FRONT:
            return Train.MULTIPLE_UNIT_HEAD_FRONT_LENGTH;
         case Train.CAR_TYPES.MULTIPLE_UNIT_HEAD_BACK:
            return Train.MULTIPLE_UNIT_HEAD_BACK_LENGTH;
         default:
            return Train.PASSENGER_LENGTH; // Default to passenger length if type is unknown
      }
   }

   coupleBack(train) {
      if (train === this) return; // Can't couple to self
      
      // First uncouple the train from any previous connections
      if (train.trainCoupledFront) {
         train.trainCoupledFront.trainCoupledBack = null;
         train.trainCoupledFront = null;
      }
      
      this.trainCoupledBack = train;
      train.trainCoupledFront = this;
      train.trainCoupledFrontId = this._id;
      
   }
   
   uncouple() {
      if (this.trainCoupledBack) {
         this.trainCoupledBack.trainCoupledFront = null;
         this.trainCoupledBack.trainCoupledFrontId = null;
         this.trainCoupledBack = null;
      }
   }

   // Find the locomotive (head) of this train
   getLocomotive() {
      let loco = this;
      while (loco.trainCoupledFront) {
         loco = loco.trainCoupledFront;
      }
      return loco;
   }
   
   // Count all cars in this train
   getCarCount() {
      let count = 1;
      let car = this.trainCoupledBack;
      while (car) {
         count++;
         car = car.trainCoupledBack;
      }
      return count;
   }

   restore() {
      
      const t = Track.findTrackByPoint(this._coordinates);
      if (t) {
         this.track = t;
         this.pos = t.getKmfromPoint(this._coordinates);
      }

      if (this.trainCoupledFrontId) {
         const frontCar = Train.allTrains.find(t => t._id === this.trainCoupledFrontId);
         if (frontCar) {
            this.trainCoupledFront = frontCar;
         }

         delete this.trainCoupledFrontId;
      }

      if (this.trainCoupledBackId) {
         const backCar = Train.allTrains.find(t => t._id === this.trainCoupledBackId);
         if (backCar) {
            this.trainCoupledBack = backCar;
         }

         delete this.trainCoupledBackId;
      }
      
   }

   stringify() {
      return { 
         _class: "Train", 
         _id: this._id,
         coordinates: this._coordinates, 
         color: this._color, 
         number: this._number,
         type: this._type,
         trainCoupledBackId: this.trainCoupledBack ? this.trainCoupledBack._id : null,
         trainCoupledFrontId: this.trainCoupledFront ? this.trainCoupledFront._id : null
      };
   }
}
