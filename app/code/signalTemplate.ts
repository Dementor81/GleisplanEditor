"use strict";

// ES6 Module imports
import { VisualElement } from './visualElement.ts';
import { ArrayUtils, ConditionUtils } from './utils.ts';
import { Application } from './application.ts';
import type {
   AspectAnimationKind,
   SignalConfigOptionDefinition,
   SignalConfigSwitchOptionDefinition,
   SignalDependencyDefinition,
   SignalMenuRuntime,
   SignalSequenceStepDefinition
} from './signalDefinition.ts';

export interface SequenceController {
   on: string | null;
   steps: SignalSequenceStepDefinition[];
   managedLabels: string[];
}
import type { SignalDependency } from './signalDependency.ts';
import type { Signal } from './signal.ts';

export class SignalTemplate {
   #_id: any = null;
   #_title: any = null;
   #_start: any = null;
   #_json_file: any = null;
   #_scale: number = 0.5;
   #_signalMenu: SignalMenuRuntime | null = null;
   #_padding: number = 0;

   elements: any[] = [];
   rules: any[] = [];
   configOptions: SignalConfigOptionDefinition[] = [];
   dependency?: SignalDependencyDefinition;
   previewsize?: number;
   #dependencyHandler?: SignalDependency;

   get id() {
      return this.#_id;
   }
   get title() {
      return this.#_title;
   }
   get initialSignalStellung() {
      return this.#_start;
   }
   get json_file() {
      return this.#_json_file;
   }
   get scale() {
      return this.#_scale;
   }
   set scale(v: number) {
      this.#_scale = v;
   }
   get padding() {
      return this.#_padding;
   }
   set padding(v: number) {
      this.#_padding = v;
   }

   get signalMenu() {
      return this.#_signalMenu;
   }

   get start() {
      return this.#_start;
   }

   getConfigOption(name: string): SignalConfigSwitchOptionDefinition | undefined {
      return this.configOptions.find((o): o is SignalConfigSwitchOptionDefinition => 'name' in o && o.name === name);
   }

   setSignalMenu(menu: SignalMenuRuntime) {
      this.#_signalMenu = menu;
   }

   constructor(id: any, title: any, json_file: string, startElements: any, initialSignalStellung: any) {
      this.#_id = id;
      this.#_title = title;
      if (initialSignalStellung) this.#_start = Array.isArray(initialSignalStellung) ? initialSignalStellung : [initialSignalStellung];
      this.#_json_file = json_file;

      if (startElements) {
         if (Array.isArray(startElements)) this.elements = startElements;
         else this.elements = [startElements];
      } else this.elements = [id];

      Application.getInstance().preLoader!.addSpriteSheet(json_file);
   }

   getVisualElementsByOnCondition(condition: any) {
      let results: any[] = [];
      function iterateItems(this: any, ve: any): boolean {
         if (Array.isArray(ve)) return ve.some((item: any) => iterateItems.call(this, item));
         else if (ve instanceof VisualElement) {
            if (ve.childs()?.some((item: any) => iterateItems.call(this, item)) || ve.on()?.includes(condition)) {
               results.push(ve);
               return true;
            }
         }
         return false;
      }

      iterateItems.call(this, this.elements);

      return results;
   }

   #_aspectAnimationKeys: Map<AspectAnimationKind, Set<string>> | null = null;

   #addAspectKeys(keys: Set<string>, on: string): void {
      if (!on) return;
      ConditionUtils.splitParts(on).forEach((trimmed: string) => {
         const key = trimmed.split("=")[0]?.trim();
         if (key) keys.add(key);
      });
   }

   /** Setting keys (e.g. hp, vr) grouped by the animation kind they trigger. */
   getAspectAnimationKeys(): Map<AspectAnimationKind, Set<string>> {
      if (this.#_aspectAnimationKeys) return this.#_aspectAnimationKeys;

      const map = new Map<AspectAnimationKind, Set<string>>([
         ["rotation", new Set<string>()],
         ["flip", new Set<string>()],
         ["sequence", new Set<string>()],
      ]);

      const stack = [...this.elements];
      while (stack.length > 0) {
         const ve = stack.pop();
         if (Array.isArray(ve)) {
            stack.push(...ve);
            continue;
         }
         if (typeof ve !== "object" || !(ve instanceof VisualElement)) continue;

         if (ve.rotation()) this.#addAspectKeys(map.get("rotation")!, ve.on());
         if (ve.flip()) this.#addAspectKeys(map.get("flip")!, ve.on());
         if (ve.sequence()) this.#addAspectKeys(map.get("sequence")!, ve.on());

         if (ve.childs()) stack.push(...ve.childs());
      }

      this.#_aspectAnimationKeys = map;
      return map;
   }

   /** Which animation kinds should react when the given setting key changes. */
   getAnimationKindsForAspect(setting: string): AspectAnimationKind[] {
      const kinds: AspectAnimationKind[] = [];
      for (const [kind, keys] of this.getAspectAnimationKeys()) {
         if (keys.has(setting)) kinds.push(kind);
      }
      return kinds;
   }

   #_sequenceControllers: SequenceController[] | null = null;

   /** Sequence controllers (elements with a `sequence`) and the labels they manage. */
   getSequenceControllers(): SequenceController[] {
      if (this.#_sequenceControllers) return this.#_sequenceControllers;

      const controllers: SequenceController[] = [];
      const stack = [...this.elements];
      while (stack.length > 0) {
         const ve = stack.pop();
         if (Array.isArray(ve)) {
            stack.push(...ve);
            continue;
         }
         if (typeof ve !== "object" || !(ve instanceof VisualElement)) continue;

         const steps = ve.sequence() as SignalSequenceStepDefinition[] | null;
         if (steps) {
            controllers.push({ on: ve.on() ?? null, steps, managedLabels: steps.map((s) => s.element) });
         }
         if (ve.childs()) stack.push(...ve.childs());
      }

      this.#_sequenceControllers = controllers;
      return controllers;
   }

   #_sequenceManagedLabels: Set<string> | null = null;

   /** Whether a label is shown/hidden by a sequence controller. */
   isSequenceManagedLabel(label: string): boolean {
      if (!this.#_sequenceManagedLabels) {
         this.#_sequenceManagedLabels = new Set(this.getSequenceControllers().flatMap((c) => c.managedLabels));
      }
      return this.#_sequenceManagedLabels.has(label);
   }

   ///returns an array with all conditions. Used by UI to determent if a Feauture should be displayed
   getAllVisualElementConditions() {
      const stack = [...this.elements];
      const conditions: any[] = [];
      let ve: any;
      while (stack.length > 0) {
         ve = stack.pop();
         if (typeof ve == "object") {
            const on = ve.on();
            if (on) ConditionUtils.splitParts(on).forEach((part: string) => ArrayUtils.pushUnique(conditions, part));

            if (ve.childs()) stack.push(...ve.childs());
         }
      }
      return conditions;
   }

   addRule(trigger: any, setting: any) {
      this.rules.push([trigger, setting]);
   }

   hasDependencyHandler(): boolean {
      return this.#dependencyHandler !== undefined;
   }

   attachDependencyHandler(handler: SignalDependency): void {
      this.#dependencyHandler = handler;
   }

   checkSignalDependency(signal: Signal, partner: Signal): boolean {
      return this.#dependencyHandler?.check(signal, partner) ?? false;
   }

   stringify() {
      return this.id;
   }
}


