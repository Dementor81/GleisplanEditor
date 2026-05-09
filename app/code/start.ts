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
import { Text } from 'pixi.js';
import { gleisGraphics } from './pixiPrimitives.ts';

// Make Bootstrap available globally for data-attribute API
(window as any).bootstrap = bootstrap;

declare global {
  interface JQuery {
   onclick(
     handler: JQuery.TypeEventHandler<HTMLElement, undefined, HTMLElement, HTMLElement, "click">
   ): JQuery;
 }
}

$.fn.onclick = function (
   this: JQuery,
   handler: JQuery.TypeEventHandler<HTMLElement, undefined, HTMLElement, HTMLElement, "click">
): JQuery {
   return this.on("click", handler);
};

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

function drawPoint(point: any, _displayObject: any, label: string = "", color: string = "#000", size: number = 0.5) {
   const s = gleisGraphics();
   const st = { width: 1, color, cap: "round" as const, join: "round" as const };
   s.circle(0, 0, size).fill(color).stroke(st);
   s.x = point.x;
   s.y = point.y;

   (window as any).app.renderingManager.containers.debug.addChild(s);

   if (label) {
      const text = new Text({
         text: label,
         style: {
            fill: color,
            fontFamily: "Arial",
            fontSize: 6,
            fontStyle: "italic",
         },
      });
      text.eventMode = "static";
      text.x = s.x;
      text.y = s.y - 5;
      (window as any).app.renderingManager.containers.debug.addChild(text);
   }
}

(window as any).drawPoint = drawPoint;


