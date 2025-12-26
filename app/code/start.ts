"use strict";

// ES6 Module imports
import 'bootstrap/dist/css/bootstrap.min.css';
import * as bootstrap from 'bootstrap';

import { Application } from './application.ts';
import { Track } from './track.ts';
import { Signal } from './signal.ts';
import { Switch } from './switch.ts';
import { GenericObject } from './generic_object.ts';
import { Train } from './train.ts';
import { geometry } from './tools.ts';
import { ui } from './ui.ts';

// Make Bootstrap available globally for data-attribute API
(window as any).bootstrap = bootstrap;



$(() => {
   initializeApplication();
});

async function initializeApplication() {
   try {
      (window as any).Track = Track;
      (window as any).Signal = Signal;
      (window as any).Switch = Switch;
      (window as any).GenericObject = GenericObject;
      (window as any).Train = Train;
      (window as any).geometry = geometry;

      (window as any).app = Application.getInstance();
      await (window as any).app.initialize();    
      (window as any).app.start();
      
   } catch (error) {
      console.error("Failed to initialize application:", error);
      ui.showErrorToast(error as any);
   }
}                       

function drawPoint(point: any, displayObject: any, label: string = "", color: string = "#000", size: number = 0.5) {
   const s = new createjs.Shape();
   s.graphics.setStrokeStyle(1).beginStroke(color).beginFill(color).drawCircle(0, 0, size);
   s.x = point.x;
   s.y = point.y;

   (window as any).app.renderingManager.containers.debug.addChild(s);

   if (label) {
      const text = new createjs.Text(label, "Italic 6px Arial", color);
      text.x = s.x;
      text.y = s.y - 5;
      text.textBaseline = "alphabetic";
      (window as any).app.renderingManager.containers.debug.addChild(text);
   }
}


