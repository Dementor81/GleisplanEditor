"use strict";

import { GenericObject } from "../../generic_object.ts";
import { Text } from "pixi.js";
import { polygonHitArea, TrackGraphics } from "../../pixiPrimitives.ts";
import { createLayerContainer } from "../../pixiUtils.ts";
import { AdvancedSwitchCalculations } from "./AdvancedSwitchCalculations.ts";

export abstract class AdvancedGenericElements extends AdvancedSwitchCalculations {
   renderAllGenericObjects() {
      this.app.renderingManager!.containers.objects.removeChildren();
      GenericObject.all_objects.forEach((o: any) => {
         const c = createLayerContainer("GenericObject");
         this.app.renderingManager!.bindGameObjToDisplayObj(c, o);
         c.interactiveChildren = false;
         c.x = o.pos().x;
         c.y = o.pos().y;

         if (o.type() === GenericObject.OBJECT_TYPE.text) this.renderTextObject(o, c);
         else if (o.type() === GenericObject.OBJECT_TYPE.plattform) this.renderPlattformObject(o, c);
         else throw new Error("Unknown Object");

         this.app.renderingManager!.containers.objects.addChild(c);
      });
   }

   renderTextObject(text_object: any, container: any) {
      var text = new Text({
         text: text_object.content(),
         style: { fill: "#000000", fontFamily: "Arial", fontSize: 24 },
      });
      text.eventMode = "static";
      const height = text.height;
      const width = text.width;

      text.hitArea = polygonHitArea([{ x: 0, y: 0 }, { x: width, y: 0 }, { x: width, y: -height }, { x: 0, y: -height }]);

      container.addChild(text);
   }

   renderPlattformObject(plattform: any, container: any) {
      const shape = new TrackGraphics();
      container.addChild(shape);
      const size = plattform.size();
      shape.rect(0, 0, size.width, size.height).fill("#444").stroke({ width: 1, color: "#111111", cap: "round", join: "round" });
      shape.setBounds(0, 0, size.width, size.height);

      var text = new Text({
         text: plattform.content(),
         style: { fill: "#eee", fontFamily: "Arial", fontSize: 16 },
      });
      text.eventMode = "static";
      text.anchor.set(0.5);
      text.x = plattform.size().width / 2;
      text.y = plattform.size().height / 2;

      container.addChild(text);
   }
}
