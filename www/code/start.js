"use strict";

// ES6 Module imports

import { Application } from './application.js';
import { Track } from './track.js';
import { Signal } from './signal.js';
import { Switch } from './switch.js';
import { GenericObject } from './generic_object.js';
import { Train } from './train.js';



$(() => {
   initializeApplication();
});

async function initializeApplication() {
   try {
      window.Track = Track;
      window.Signal = Signal;
      window.Switch = Switch;
      window.GenericObject = GenericObject;
      window.Train = Train;

      window.app = Application.getInstance();
      await app.initialize();    
      app.start();
      
   } catch (error) {
      console.error("Failed to initialize application:", error);
      ui.showErrorToast(error);
   }
}                       

function drawPoint(point, displayObject, label = "", color = "#000", size = 0.5) {
   const s = new createjs.Shape();
   s.graphics.setStrokeStyle(1).beginStroke(color).beginFill(color).drawCircle(0, 0, size);
   s.x = point.x;
   s.y = point.y;

   app.renderingManager.containers.debug.addChild(s);

   if (label) {
      const text = new createjs.Text(label, "Italic 6px Arial", color);
      text.x = s.x;
      text.y = s.y - 5;
      text.textBaseline = "alphabetic";
      app.renderingManager.containers.debug.addChild(text);
   }
}
