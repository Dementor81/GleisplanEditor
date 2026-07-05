"use strict";

import { Container } from "pixi.js";
import { RailwayCrossing } from "../railway_crossing.ts";
import { polygonHitArea, TrackGraphics } from "../pixiPrimitives.ts";
import { createLayerContainer } from "../pixiUtils.ts";
import { RailwayCrossingInteraction } from "../interactions/RailwayCrossingInteraction.ts";
import { SignalRenderer } from "./signalRenderer.ts";
import type { RenderingManager } from "./RenderingManager.ts";

export class RailwayCrossingRenderer {
   createDisplay(rm: RenderingManager, crossing: RailwayCrossing): Container {
      const root = createLayerContainer("railway_crossing");
      root.eventMode = "static";

      const surface = new TrackGraphics("railway_crossing_surface");
      this.#drawCrossingSurface(surface, crossing);
      root.addChild(surface);

      const gates = createLayerContainer("gates");
      root.addChild(gates);

      rm.bindGameObjToDisplayObj(root, crossing);
      root.hitArea = polygonHitArea(crossing.hitPolygon());
      RailwayCrossingInteraction.attach(root, crossing);

      return root;
   }

   renderStreetSigns(rm: RenderingManager): void {
      RailwayCrossing.allCrossings.forEach((crossing) => {
         this.#addStreetSignDisplays(rm, rm.containers.signals, crossing);
      });
   }

   redrawStreetSigns(rm: RenderingManager, crossing: RailwayCrossing): void {
      const facade = crossing.streetLights;
      facade.markChanged();
      for (const child of rm.containers.signals.children) {
         if (child.label?.startsWith(`crossing_street_sign_${crossing.id}_`)) {
            facade.draw(child, true);
            SignalRenderer.applyContainerBounds(child);
         }
      }
      rm.update();
   }

   #drawCrossingSurface(shape: TrackGraphics, crossing: RailwayCrossing): void {
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

   #addStreetSignDisplays(
      rm: RenderingManager,
      container: Container,
      crossing: RailwayCrossing
   ): void {
      const facade = crossing.streetLights;
      crossing.streetSignPlacements().forEach((placement, index) => {
         const signalContainer = SignalRenderer.createSignalContainer(rm, facade, false);
         signalContainer.label = `crossing_street_sign_${crossing.id}_${index}`;
         signalContainer.eventMode = "none";
         signalContainer.position.set(placement.position.x, placement.position.y);
         signalContainer.angle = placement.rotation;
         container.addChild(signalContainer);
      });
   }
}

export const railwayCrossingRenderer = new RailwayCrossingRenderer();
