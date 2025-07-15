"use strict";

// ES6 Module imports
import { ArrayUtils, NumberUtils } from './utils.js';
import { STORAGE } from './storage.js';
import { ui } from './ui.js';
import { Track } from './track.js';
import { Point, type } from './tools.js';

export class Train {
   static allTrains = [];
   static nextId = 0;
   static movingTrains = new Set(); // To track which trains are currently moving
   static movementTimer = null; // Timer for automatic movement
   static MOVEMENT_INTERVAL = 50; // Milliseconds between movement updates
   static MOVEMENT_SPEED = 2; // Units to move per update

   static CAR_TYPES = {
      LOCOMOTIVE: "locomotive",
      PASSENGER: "passenger",
      MULTIPLE_UNIT_CAR: "multiple_unit_car",
      MULTIPLE_UNIT_HEAD_FRONT: "multiple_unit_head_front",
      MULTIPLE_UNIT_HEAD_BACK: "multiple_unit_head_back",
   };

   static getNextId() {
      return Train.nextId++;
   }

   // Constants for different car types
   static LOCO_LENGTH = 80;
   static PASSENGER_LENGTH = 100;
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
            window.renderer.renderAllTrains();
            window.stage.update();
            STORAGE.save();
         });

      $("#inputZugnummer")
         .off()
         .val(train.number)
         .on("change", function (e) {
            train.number = $(this).val();
            window.renderer.renderAllTrains();
            window.stage.update();
            STORAGE.save();
         });

      $("#selectTrainType")
         .off()
         .val(train.type)
         .on("change", function (e) {
            train.type = $(this).val();
            window.renderer.renderAllTrains();
            window.stage.update();
            STORAGE.save();
         });

      $("#btnRemoveTrain")
         .off()
         .click(() => Train.deleteTrain(train));

      $("#btnCoupleTrain")
         .off()
         .click(() => {
            // Set global state for coupling mode
            if (window.custom_mouse_mode === window.CUSTOM_MOUSE_ACTION.NONE) {
               // First check if there are any coupling points available
               if (Train.showCouplingPoints(train)) {
                  // Add active class to button
                  $("#btnCoupleTrain").addClass("active");

                  window.custom_mouse_mode = window.CUSTOM_MOUSE_ACTION.TRAIN_COUPLE;

                  // Show coupling message
                  $("#couplingMessage")
                     .text("Klicke auf einen Kupplungspunkt um Züge zu kuppeln oder überall anders um abzubrechen")
                     .show();
               } else {
                  // Points are already cleared and message shown by showCouplingPoints
               }
            } else {
               Train.exitCouplingMode();
            }
         });

      $("#btnUncoupleTrain")
         .off()
         .click(() => {
            // Set global state for decoupling mode
            if (window.custom_mouse_mode === window.CUSTOM_MOUSE_ACTION.NONE) {
               // First check if there are any decoupling points available
               if (Train.showDecouplingPoints(train)) {
                  // Add active class to button
                  $("#btnUncoupleTrain").addClass("active");

                  window.custom_mouse_mode = window.CUSTOM_MOUSE_ACTION.TRAIN_DECOUPLE;

                  // Show decoupling message
                  $("#couplingMessage")
                     .text("Klicke zwischen Wagen um Züge zu entkuppeln oder überall anders um abzubrechen")
                     .show();
               } else {
                  // Points are already cleared and message shown by showDecouplingPoints
               }
            } else {
               Train.exitDecouplingMode();
            }
         });
         
      // Only show movement controls for locomotives (first car of a train)
      const isLocomotive = train.type === Train.CAR_TYPES.LOCOMOTIVE;
      $("#trainMovementControls").toggle(isLocomotive);
      
      if (isLocomotive) {
         // Initialize movement direction buttons
         if (!train.movementDirection) {
            train.movementDirection = 1; // Default to forward
         }
         
         // Update button states based on current direction
         $("#btnDirectionForward").toggleClass("active", train.movementDirection > 0);
         $("#btnDirectionBackward").toggleClass("active", train.movementDirection < 0);
         
         // Update start/stop button based on movement state
         const isMoving = Train.movingTrains.has(train);
         $("#btnStartStopTrain")
            .toggleClass("btn-success", !isMoving)
            .toggleClass("btn-danger", isMoving)
            .html(isMoving ? '<i class="bi bi-stop-fill"></i> Stop' : '<i class="bi bi-play-fill"></i> Start');
         
         // Set up direction button handlers
         $("#btnDirectionForward")
            .off()
            .click(() => {
               train.movementDirection = 1;
               $("#btnDirectionForward").addClass("active");
               $("#btnDirectionBackward").removeClass("active");
            });
            
         $("#btnDirectionBackward")
            .off()
            .click(() => {
               train.movementDirection = -1;
               $("#btnDirectionBackward").addClass("active");
               $("#btnDirectionForward").removeClass("active");
            });
            
         // Set up start/stop button handler
         $("#btnStartStopTrain")
            .off()
            .click(() => {
               if (Train.movingTrains.has(train)) {
                  // Stop the train
                  Train.stopTrain(train);
               } else {
                  // Start the train
                  Train.startTrain(train);
               }
            });
      }
   }

   static deleteTrain(train) {
      // Stop the train if it's moving
      if (Train.movingTrains.has(train)) {
         Train.stopTrain(train);
      }  

      // Get the last car in the train that will be deleted
      let currentCar = train;
      while (currentCar.trainCoupledBack) {
         currentCar = currentCar.trainCoupledBack;
      }

      // Remove all cars in this train from allTrains
      while (currentCar) {
         ArrayUtils.remove(this.allTrains, currentCar);
         //save the next car before removing all references to other objects
         const nextCar = currentCar.trainCoupledFront;
         currentCar.trainCoupledFront = null;
         currentCar.trainCoupledBack = null;
         currentCar.track = null;
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


      // Calculate new position using the node's unit vector
      new_pos = car.pos + movementX / stage.scale / car.track.cos;

      while (car) {
         if (car != firstCar) {
            // Calculate position based on previous car and car length
            // Take into account the spacing between cars (5 units)
            const prevCar = car.trainCoupledFront;
            const spacing = 5; // Gap between cars
            new_pos = prevCar.pos + prevCar.length / 2 + spacing + car.length / 2;
         }

         let newTrack;
         if (NumberUtils.outoff(new_pos, 0, currentTrack.length)) {
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

      // Calculate new position using the node's unit vector
      let new_pos = train.pos + movementX / stage.scale / train.track.cos;

      if (NumberUtils.outoff(new_pos, 0 + train.length / 2, currentTrack.length - train.length / 2)) {
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
      if (this._track) this._coordinates = this._track.getPointFromKm(km);
   }

   get color() {
      return this._color;
   }

   set color(c) {
      this._color = c;
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
   }

   uncouple() {
      if (this.trainCoupledBack) {
         this.trainCoupledBack.trainCoupledFront = null;
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
         const frontCar = Train.allTrains.find((t) => t._id === this.trainCoupledFrontId);
         if (frontCar) {
            this.trainCoupledFront = frontCar;
         }

         
      }

      if (this.trainCoupledBackId) {
         const backCar = Train.allTrains.find((t) => t._id === this.trainCoupledBackId);
         if (backCar) {
            this.trainCoupledBack = backCar;
         }

         
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
         trainCoupledFrontId: this.trainCoupledFront ? this.trainCoupledFront._id : null,
      };
   }

   static showDecouplingPoints(train) {
      // Clear any existing overlay
      overlay_container.removeAllChildren();

      // Find the first car in the train
      let firstCar = train;
      while (firstCar.trainCoupledFront) {
         firstCar = firstCar.trainCoupledFront;
      }

      // Start with the first car
      let currentCar = firstCar;
      let decouplingPointsFound = 0;

      // Add decoupling points between each car
      while (currentCar && currentCar.trainCoupledBack) {
         const nextCar = currentCar.trainCoupledBack;

         // Get positions of the two cars
         const currentPos = currentCar.track.getPointFromKm(currentCar.pos);
         const nextPos = nextCar.track.getPointFromKm(nextCar.pos);

         // Calculate midpoint between cars for decoupling point
         const midX = (currentPos.x + nextPos.x) / 2;
         const midY = (currentPos.y + nextPos.y) / 2;

         // Create a decoupling point (circle)
         const decouplingPoint = new createjs.Shape();
         decouplingPoint.graphics.beginFill("#ff0000").drawCircle(0, 0, 6);
         decouplingPoint.x = midX;
         decouplingPoint.y = midY;
         // Store the cars to decouple in the shape's data
         decouplingPoint.data = {
            carToDeCoupleFrom: currentCar,
            carToDeCouple: nextCar,
         };
         decouplingPoint.name = "decouplingPoint";

         // Add to overlay container
         overlay_container.addChild(decouplingPoint);
         decouplingPointsFound++;

         // Move to the next car
         currentCar = nextCar;
      }

      // If no decoupling points found, show a message
      if (decouplingPointsFound === 0) {
         // Show a message
         ui.showInfoToast("Keine Wagen in der Nähe zum entkuppeln gefunden, dieser Zug hat nur einen Wagen");
         return false;
      } else {
         stage.update();
         return true;
      }
   }

   static handleDecouplingClick(data) {
      if (!data) throw new Error("No train provided");
      // Decouple at this point
      data.carToDeCoupleFrom.uncouple();

      // Exit decoupling mode
      Train.exitDecouplingMode();

      // Update display
      renderer.renderAllTrains();
      stage.update();
      STORAGE.save();
   }

   static exitDecouplingMode() {
      // Remove decoupling points
      window.overlay_container.removeAllChildren();

      // Reset custom action mode
      window.custom_mouse_mode = window.CUSTOM_MOUSE_ACTION.NONE;

      // Hide message with a small delay to ensure it's fully shown first
      setTimeout(() => {
         $("#couplingMessage").hide();
      }, 50);

      // Deactivate any active buttons
      $("#btnUncoupleTrain").removeClass("active");

      window.stage.update();
   }

   static showCouplingPoints(train) {
      // Clear any existing overlay
      window.overlay_container.removeAllChildren();

      // Get the head and tail of the train
      let firstCar = train;
      while (firstCar.trainCoupledFront) {
         firstCar = firstCar.trainCoupledFront;
      }

      let lastCar = train;
      while (lastCar.trainCoupledBack) {
         lastCar = lastCar.trainCoupledBack;
      }

      // Get positions of the train ends
      const firstCarPos = firstCar.pos;
      const lastCarPos = lastCar.pos;
      let distance = 0;
      let couplingPointsFound = 0;

      // Check all other trains for possible coupling points
      Train.allTrains.forEach((otherCar) => {
         // Skip cars in the same train
         if (
            otherCar === firstCar ||
            otherCar === lastCar ||
            (otherCar.trainCoupledFront != null && otherCar.trainCoupledBack != null) ||
            otherCar.track != train.track
         ) {
            return;
         }

         // Get positions of the other train ends
         const otherCarPos = otherCar.pos;

         // Check distance between train ends (front to front)
         const maxCouplingDistance = 80; // Maximum distance for coupling

         // Check front of our train to back of other train
         if (otherCar.trainCoupledBack == null) {
            distance = firstCarPos - otherCarPos;
            if (NumberUtils.between(distance, 0, maxCouplingDistance)) {
               addCouplingPoint(otherCar, firstCar);
               couplingPointsFound++;
            }
         }

         // Check back of our train to front of other train
         if (otherCar.trainCoupledFront == null) {
            distance = otherCarPos - lastCarPos;
            if (NumberUtils.between(distance, 0, maxCouplingDistance)) {
               addCouplingPoint(lastCar, otherCar);
               couplingPointsFound++;
            }
         }
      });

      // If no coupling points found, show a message
      if (couplingPointsFound === 0) {
         // Show a message
         ui.showInfoToast("Keine Wagen in der Nähe zum kuppeln gefunden");
         return false;
      } else {
         window.stage.update();
         return true;
      }

      // Helper function to add a coupling point
      function addCouplingPoint(car1, car2) {
         // Calculate midpoint between cars for coupling point
         const car1Pos = car1.track.getPointFromKm(car1.pos);
         const car2Pos = car2.track.getPointFromKm(car2.pos);
         const midX = (car1Pos.x + car2Pos.x) / 2;
         const midY = (car1Pos.y + car2Pos.y) / 2;

         // Create a coupling point (circle)
         const couplingPoint = new createjs.Shape();
         couplingPoint.graphics.beginFill("#00ff00").drawCircle(0, 0, 6);
         couplingPoint.x = midX;
         couplingPoint.y = midY;

         // Store the cars to couple in the shape's data
         couplingPoint.data = {
            car1: car1,
            car2: car2,
         };
         couplingPoint.name = "couplingPoint";

         // Add to overlay container
         window.overlay_container.addChild(couplingPoint);
      }
   }

   static handleCouplingClick(data) {
      if (!data) throw new Error("No train data provided");

      // Determine which cars to couple
      data.car1.coupleBack(data.car2);

      // Exit coupling mode
      Train.exitCouplingMode();

      // Update display
      renderer.renderAllTrains();
      stage.update();
      STORAGE.save();
   }

   static exitCouplingMode() {
      // Remove coupling points
      window.overlay_container.removeAllChildren();

      // Reset custom action mode
      window.custom_mouse_mode = window.CUSTOM_MOUSE_ACTION.NONE;

      $("#couplingMessage").hide();

      // Deactivate any active buttons
      $("#btnCoupleTrain").removeClass("active");

      window.stage.update();
   }

   // Add new methods for automatic train movement

   static startTrain(train) {
      // Add train to the set of moving trains
      Train.movingTrains.add(train);
      
      // Update button state
      $("#btnStartStopTrain")
         .removeClass("btn-success")
         .addClass("btn-danger")
         .html('<i class="bi bi-stop-fill"></i> Stop');
      
      // Start movement timer if not already running
      if (!Train.movementTimer) {
         Train.movementTimer = setInterval(Train.updateMovingTrains, Train.MOVEMENT_INTERVAL);
      }
   }
   
   static stopTrain(train) {
      // Remove train from the set of moving trains
      Train.movingTrains.delete(train);
      
      // Update button state
      $("#btnStartStopTrain")
         .removeClass("btn-danger")
         .addClass("btn-success")
         .html('<i class="bi bi-play-fill"></i> Start');
      
      // If no trains are moving, stop the timer
      if (Train.movingTrains.size === 0 && Train.movementTimer) {
         clearInterval(Train.movementTimer);
         Train.movementTimer = null;
      }
   }
   
   static stopAllTrains() {
      // Stop all moving trains
      for (const train of Train.movingTrains) {
         Train.stopTrain(train);
      }
      
      // Clear the set of moving trains
      Train.movingTrains.clear();
      
      // Stop the timer
      if (Train.movementTimer) {
         clearInterval(Train.movementTimer);
         Train.movementTimer = null;
      }
   }
   
   static updateMovingTrains() {
      let needsUpdate = false;
      
      // Move each train in the set of moving trains
      for (const train of Train.movingTrains) {
         // Calculate movement amount based on direction and speed
         const movementAmount = train.movementDirection * Train.MOVEMENT_SPEED;
         
         // Check if movement is possible
         const firstCar = train.getLocomotive();
         const lastCar = Train.getLastCar(firstCar);
         
         if (Train.movementPossible(firstCar, movementAmount) && 
             Train.movementPossible(lastCar, movementAmount)) {
            // Move the train
            Train.moveTrain(firstCar, movementAmount);
            needsUpdate = true;
         } else {
            // Stop the train if movement is not possible
            Train.stopTrain(train);
            ui.showInfoToast("Zug kann nicht weiter fahren");
         }
      }
      
      // Update the display if any trains moved
      if (needsUpdate) {
         renderer.renderAllTrains();
         stage.update();
      }
   }
   
   static getLastCar(train) {
      let lastCar = train;
      while (lastCar.trainCoupledBack) {
         lastCar = lastCar.trainCoupledBack;
      }
      return lastCar;
   }
}


