"use strict";

// ES6 Module imports
import { VisualElement } from './visualElement.ts';
import { ArrayUtils, ConditionUtils } from './utils.ts';
import { Application } from './application.ts';
import type { SignalConfigOptionDefinition, SignalDependencyDefinition, SignalMenuRuntime } from './signalDefinition.ts';
import type { SignalDependency } from './signalDependency.ts';
import type { Signal } from './signal.ts';

export class SignalTemplate {
   #_id: any = null;
   #_title: any = null;
   #_start: any = null;
   #_json_file: any = null;
   #_scale: number = 0.5;
   #_signalMenu: SignalMenuRuntime | null = null;
   #_distance_from_track: number = 0;

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
   get distance_from_track() {
      return this.#_distance_from_track;
   }
   set distance_from_track(v: number) {
      this.#_distance_from_track = v;
   }

   get signalMenu() {
      return this.#_signalMenu;
   }

   get start() {
      return this.#_start;
   }

   getConfigOption(name: string): SignalConfigOptionDefinition | undefined {
      return this.configOptions.find((o) => o.name === name);
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
            if (ve.childs()?.some((item: any) => iterateItems.call(this, item)) || [].concat(ve.on()).some((c: any) => c.includes(condition))) {
               results.push(ve);
               return true;
            }
         }
         return false;
      }

      iterateItems.call(this, this.elements);

      return results;
   }

   #_rotationAspectKeys: Set<string> | null = null;

   /** Setting keys (e.g. hp) that appear in `on` conditions of elements with rotation. */
   getRotationAspectKeys(): Set<string> {
      if (this.#_rotationAspectKeys) return this.#_rotationAspectKeys;

      const keys = new Set<string>();
      const stack = [...this.elements];
      while (stack.length > 0) {
         const ve = stack.pop();
         if (Array.isArray(ve)) {
            stack.push(...ve);
            continue;
         }
         if (typeof ve !== "object" || !(ve instanceof VisualElement)) continue;

         if (ve.rotation()) {
            [].concat(ve.on()).forEach((c: any) => {
               if (!c) return;
               ConditionUtils.splitParts(c).forEach((trimmed: string) => {
                  const key = trimmed.split("=")[0]?.trim();
                  if (key) keys.add(key);
               });
            });
         }
         if (ve.childs()) stack.push(...ve.childs());
      }

      this.#_rotationAspectKeys = keys;
      return keys;
   }

   #_flipAspectKeys: Set<string> | null = null;

   /** Setting keys (e.g. vr) that appear in `on` conditions of elements with flip. */
   getFlipAspectKeys(): Set<string> {
      if (this.#_flipAspectKeys) return this.#_flipAspectKeys;

      const keys = new Set<string>();
      const stack = [...this.elements];
      while (stack.length > 0) {
         const ve = stack.pop();
         if (Array.isArray(ve)) {
            stack.push(...ve);
            continue;
         }
         if (typeof ve !== "object" || !(ve instanceof VisualElement)) continue;

         if (ve.flip()) {
            [].concat(ve.on()).forEach((c: any) => {
               if (!c) return;
               ConditionUtils.splitParts(c).forEach((trimmed: string) => {
                  const key = trimmed.split("=")[0]?.trim();
                  if (key) keys.add(key);
               });
            });
         }
         if (ve.childs()) stack.push(...ve.childs());
      }

      this.#_flipAspectKeys = keys;
      return keys;
   }

   ///returns an array with all conditions. Used by UI to determent if a Feauture should be displayed
   getAllVisualElementConditions() {
      const stack = [...this.elements];
      const conditions: any[] = [];
      let ve: any;
      while (stack.length > 0) {
         ve = stack.pop();
         if (typeof ve == "object") {
            [].concat(ve.on()).forEach((c: any) => {
               if (c) ConditionUtils.splitParts(c).forEach((part: string) => ArrayUtils.pushUnique(conditions, part));
            });

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

   checkSignalDependency(signal: Signal, partner: Signal, _searchConditions?: string[]): boolean {
      return this.#dependencyHandler?.check(signal, partner) ?? false;
   }

   stringify() {
      return this.id;
   }
}


