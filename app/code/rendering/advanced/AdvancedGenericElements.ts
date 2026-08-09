"use strict";

import { GenericObject } from "../../generic_object.ts";
import { Text } from "pixi.js";
import { rectHitArea, TrackGraphics } from "../../pixiPrimitives.ts";
import { createLayerContainer } from "../../pixiUtils.ts";
import { GenericObjectInteraction } from "../../interactions/GenericObjectInteraction.ts";
import type { AdvancedRendering } from "./AdvancedRendering.ts";

export class AdvancedGenericElements {
   constructor(readonly renderer: AdvancedRendering) {}

   renderAllGenericObjects() {
      const r = this.renderer;
      r.app.renderingManager!.containers.objects.removeChildren();
      GenericObject.all_objects.forEach((o: any) => {
         const c = createLayerContainer("GenericObject");
         r.app.renderingManager!.bindGameObjToDisplayObj(c, o);
         GenericObjectInteraction.attach(c, o);
         c.x = o.pos().x;
         c.y = o.pos().y;

         if (o.type() === GenericObject.OBJECT_TYPE.text) this.renderTextObject(o, c);
         else if (o.type() === GenericObject.OBJECT_TYPE.plattform) this.renderPlattformObject(o, c);
         else throw new Error("Unknown Object");

         r.app.renderingManager!.containers.objects.addChild(c);
      });
   }

   renderTextObject(text_object: any, container: any) {
      const size = text_object.size();
      const hasSize = size.width !== 0 || size.height !== 0;
      const fontSize = hasSize ? Math.abs(size.height) : 20;
      var text = new Text({
         text: text_object.content(),
         style: { fill: text_object.color(), fontFamily: "Arial", fontSize },
      });
      text.eventMode = "static";
      const hitW = hasSize ? Math.abs(size.width) : text.width;
      const hitH = hasSize ? Math.abs(size.height) : text.height;
      text.hitArea = rectHitArea(0, 0, hitW, hitH);
      if (hasSize) {
         const bounds = new TrackGraphics();
         bounds.rect(0, 0, hitW, hitH).fill({ color: 0, alpha: 0 });
         container.addChild(bounds);
      }

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
