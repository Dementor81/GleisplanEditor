"use strict";

// ES6 Module imports
import { VisualElement } from './visualElement.ts';
import { ArrayUtils } from './utils.ts';
import { Application } from './application.ts';

export class SignalTemplate {
   #_id: any = null;
   #_title: any = null;
   #_start: any = null;
   #_json_file: any = null;
   #_scale: number = 0.5;
   #_signalMenu: any = null;
   #_distance_from_track: number = 0;

   contextMenu: any[] = [];
   elements: any[] = [];
   rules: any[] = [];

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

   ///creates a structed onbject tree that represents a menu from an array of strings
   ///array: keeps the array
   ///comma sperated string e.g."hp=0,hp=1,hp=2": buttonGroup
   ///single string e.g. "verk=1(verk)": btn
   ///single string without '=' e.g. zs3v: dropdown
   createSignalCommandMenu(menu_string_array: any) {
      let menu_items = menu_string_array.map(
         function (this: any, item: any) {
            if (!Array.isArray(item)) item = [item];
            return item.map(
               function (this: any, str: string) {
                  let items = str.split(",").map(
                     function (this: any, str: string) {
                        let text, command;
                        let match = str.match(/\(([^)]*)\)/);
                        if (match) {
                           command = str.split("(")[0];
                           text = match[1];
                        } else {
                           command = str;
                           // 1. Entferne alles vor und inklusive einem "="
                           text = command.includes("=") ? command.split("=")[1] : command;
                           if (text.length == 1) text = command.replace("=", " ");
                           else text = text.replace(/(\d)/, " $1");
                           // 2. Das erste Zeichen in einen Großbuchstaben verwandeln
                           text = text.charAt(0).toUpperCase() + text.slice(1);
                        }
                        return {
                           type: command.includes("=") ? "btn" : "dropdown",
                           text: text,
                           command: command,
                           visual_elements: this.getVisualElementsByOnCondition(command),
                        };
                     }.bind(this)
                  );

                  if (items.length > 1)
                     return {
                        type: "buttonGroup",
                        items: items,
                     };
                  else return items[0];
               }.bind(this)
            );
         }.bind(this)
      );
      this.#_signalMenu = menu_items;
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
            if (ve.childs()?.some((item: any) => iterateItems.call(this, item)) || [].concat(ve.on()).some((c) => c === condition)) {
               results.push(ve);
               return true;
            }
         }
         return false;
      }

      iterateItems.call(this, this.elements);

      return results;
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
               if (c) c.split("&&").forEach((c: any) => ArrayUtils.pushUnique(conditions, c.replace("!", "")));
            });

            if (ve.childs()) stack.push(...ve.childs());
         }
      }
      return conditions;
   }

   addRule(trigger: any, setting: any) {
      this.rules.push([trigger, setting]);
   }

   stringify() {
      return this.id;
   }
}


