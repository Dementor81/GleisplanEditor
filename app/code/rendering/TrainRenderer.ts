"use strict";

import { Train } from "../train.ts";
import { gleisGraphics } from "../pixiPrimitives.ts";
import { Text } from "pixi.js";
import { createLayerContainer } from "../pixiUtils.ts";
import type { RenderingManager } from "./RenderingManager.ts";

export class TrainRenderer {
   renderAllTrains(rm: RenderingManager, carHeight: number): void {
      rm.containers.trains.removeChildren();

      Train.allTrains
         .filter((train: any) => !train.trainCoupledFront)
         .forEach((train: any) => {
            const c = createLayerContainer("train");
            c.interactiveChildren = true;
            this.#renderCar(rm, train, c, carHeight);
            rm.containers.trains.addChild(c);
         });
   }

   #renderCar(rm: RenderingManager, car: any, container: any, carHeight: number): void {
      const carWidth = car.length;
      const corner = car.type == Train.CAR_TYPES.LOCOMOTIVE ? 8 : 1.5;
      const s = gleisGraphics("train");
      rm.bindGameObjToDisplayObj(s, car);
      s.roundRect(0, 0, carWidth, carHeight, corner)
         .fill(car.color)
         .stroke({ width: 1, color: "#000", cap: "round", join: "round" });

      const p = car.track.getPointFromKm(car.pos);

      s.x = p.x;
      s.y = p.y;
      s.pivot.set(carWidth / 2, carHeight / 2);
      s.angle = car.track.deg;

      container.addChild(s);
      if (car.number && car.type == Train.CAR_TYPES.LOCOMOTIVE) {
         const text = new Text({
            text: car.number,
            style: { fill: "#000000", fontFamily: "Arial", fontSize: 10 },
         });
         text.eventMode = "static";
         text.anchor.set(0.5);
         text.x = p.x;
         text.y = p.y;
         container.addChild(text);
      }
      if (car.trainCoupledBack) {
         this.#renderCar(rm, car.trainCoupledBack, container, carHeight);
      }
   }
}
