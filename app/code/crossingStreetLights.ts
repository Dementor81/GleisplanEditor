"use strict";

import { Application } from "./application.ts";
import { Signal } from "./signal.ts";
import { SignalConditionEvaluator } from "./signalConditionEvaluator.ts";
import type { RailwayCrossing } from "./railway_crossing.ts";
import { SignalRenderer } from "./rendering/signalRenderer.ts";
import type { SignalTemplate } from "./signalTemplate.ts";
import type { AspectAnimationKind, SequenceState } from "./signalDefinition.ts";

/** Render facade for crossing street warning lights (reuses SignalRenderer + template). */
export class CrossingStreetLights {
   readonly _template: SignalTemplate;
   _changed = false;
   _dontCache = false;
   _aspectAnimations = new Set<AspectAnimationKind>();
   _sequenceState?: SequenceState;

   constructor(readonly crossing: RailwayCrossing) {
      const template = Application.getInstance().signalTemplates.crossing_street_light;
      if (!template) throw new Error("crossing_street_light template not registered");
      this._template = template;
   }

   get(aspect: string): unknown {
      if (aspect === "secured") return this.crossing.secured;
      const value = this.crossing.streetLightAspects[aspect];
      return value !== undefined ? value : null;
   }

   check(condition: string): boolean {
      return SignalConditionEvaluator.evaluate(this as unknown as Signal, condition);
   }

   draw(container: unknown, force = false): void {
      SignalRenderer.draw(this, container, force);
   }

   markChanged(): void {
      this._changed = true;
   }

   setSignalAspect(command: string, overrideValue: unknown = true): void {
      let setting: string;
      let value: unknown;
      const assignment = SignalConditionEvaluator.parseAssignment(command);
      if (assignment) {
         [setting, value] = assignment;
         if (overrideValue === false) value = null;
      } else {
         setting = command;
         value = overrideValue === false ? null : overrideValue;
      }

      if (setting === "secured") {
         const next = value == null ? 0 : Number(value);
         if (this.crossing.secured !== next) this.#flagAnimations(setting);
         this.crossing.setSecured(next);
         return;
      }

      const current = this.get(setting);
      if (current === value || (current == null && value == null)) return;

      this.#flagAnimations(setting);

      if (value == null) delete this.crossing.streetLightAspects[setting];
      else this.crossing.streetLightAspects[setting] = value;

      this.crossing.refreshStreetSignDisplays();
   }

   #flagAnimations(setting: string): void {
      for (const kind of this._template.getAnimationKindsForAspect(setting)) this._aspectAnimations.add(kind);
   }
}
