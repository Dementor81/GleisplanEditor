"use strict";

import { Container, Sprite, type Texture } from "pixi.js";
import { RailwayCrossing, type CrossingDecorationPlacement } from "../railway_crossing.ts";
import { imageSize, polygonHitArea, TrackGraphics } from "../pixiPrimitives.ts";
import { createLayerContainer } from "../pixiUtils.ts";
import { RailwayCrossingInteraction } from "../interactions/RailwayCrossingInteraction.ts";
import type { RenderingManager } from "./RenderingManager.ts";

function drawCrossingSurface(shape: TrackGraphics, crossing: RailwayCrossing): void {
   const polygon = crossing.streetPolygon();
   shape.fillPoly(polygon, "#777777");
   crossing.roadMarkings().forEach((line) => {
      shape.lineFromTo(line.start, line.end).stroke({
         width: line.width,
         color: RailwayCrossing.ROAD_MARKING_COLOR,
         cap: "butt",
         join: "round",
      });
   });

   const xs = polygon.map((point) => point.x);
   const ys = polygon.map((point) => point.y);
   const minX = Math.min(...xs);
   const minY = Math.min(...ys);
   shape.setBounds(minX, minY, Math.max(...xs) - minX, Math.max(...ys) - minY);
}

function addDecorationSprite(
   container: Container,
   texture: Texture,
   placement: CrossingDecorationPlacement
): void {
   const sprite = new Sprite(texture);
   const { width, height } = imageSize(texture);
   sprite.pivot.set(width / 2, height);
   sprite.position.set(placement.position.x, placement.position.y);
   sprite.angle = placement.rotation;
   sprite.scale.set(placement.scale);
   container.addChild(sprite);
}

export function createRailwayCrossingDisplay(
   rm: RenderingManager,
   crossing: RailwayCrossing,
   signTexture: Texture
): Container {
   const root = createLayerContainer("railway_crossing");
   root.eventMode = "static";

   const surface = new TrackGraphics("railway_crossing_surface");
   drawCrossingSurface(surface, crossing);
   root.addChild(surface);

   const decorations = createLayerContainer("decorations");
   crossing.andreaskreuzPlacements().forEach((placement) => {
      addDecorationSprite(decorations, signTexture, placement);
   });
   root.addChild(decorations);

   const gates = createLayerContainer("gates");
   root.addChild(gates);

   rm.bindGameObjToDisplayObj(root, crossing);
   root.hitArea = polygonHitArea(crossing.hitPolygon());
   RailwayCrossingInteraction.attach(root, crossing);

   return root;
}
