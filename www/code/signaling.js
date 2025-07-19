"use strict";

// ES6 Module imports
import { ArrayUtils } from './utils.js';
import { Application } from './application.js';

//Signals are build of Visual elements. Some elements are always been drawn, like the "Mast", others have a varianty of
//conditions.
//1st: a VE has conditions, these must match with the Signals features. e.g.: sh1 are only on Zsig and Asig
//2nd: the visual elemnt must be enabled.
export class VisualElement {
   #_blinkt = null;
   #_image = null;
   #_pos = 0;
   #_enabled = null;
   #_on = [];
   #_off = null;
   #_childs = null;

   constructor(image) {
      this.#_image = image;
   }

   on(condition, logic_op = "||") {
      if (condition === undefined) return this.#_on;
      else {
         if (Array.isArray(condition)) condition = condition.join(logic_op);
         if (this.#_on == null || !Array.isArray(this.#_on)) this.#_on = condition;
         else this.#_on.push(condition);
         return this;
      }
   }

   off(condition, logic_op = "||") {
      if (condition === undefined) return this.#_off;
      else {
         if (Array.isArray(condition)) condition = condition.join(logic_op);
         if (this.#_off == null || !Array.isArray(this.#_off)) this.#_off = condition;
         else this.#_off.push(condition);
         return this;
      }
   }

   childs(childs) {
      if (childs === undefined) return this.#_childs;
      else {
         this.#_childs = childs;
         return this;
      }
   }

   blinkt(blinkt) {
      if (blinkt === undefined) return this.#_blinkt;
      else {
         this.#_blinkt = blinkt;
         return this;
      }
   }

   pos(pos) {
      if (pos === undefined) return this.#_pos;
      else {
         this.#_pos = pos;
         return this;
      }
   }

   get [Symbol.toStringTag]() {
      return this.#_image;
   }

   get image() {
      return this.#_image;
   }

   //visual elements are visible if the enabled function returns true and the signalstellung is set on the signal
   //if both are not set, its always enabled
   isEnabled(signal) {
      return (this.#_enabled == null || this.#_enabled(signal)) && signal.check(this.#_on);
   }

   isAllowed(signal) {
      return this.off() == null || !signal.check(this.off());
   }
}

export class TextElement extends VisualElement {
   #_format;
   #_color;
   #_source;
   #_width_height;

   constructor(source, format = ["25","Arial","bold"], color = "#eee") {
      super();
      this.#_source = source;
      this.#_format = format;
      this.#_color = color;
   }

   
   get format() {
      return this.#_format;
   }

   get color() {
      return this.#_color;
   }


   //must be an array containing max width and height
   bounds(width_height){
      if (width_height === undefined) return this.#_width_height;
      else {         
         this.#_width_height = width_height;
         return this;
      }
   }

   getText(signal) {
      return signal.get(this.#_source);
   }
}

export class SignalTemplate {
   #_id = null;
   #_title = null;
   #_start = null;
   #_json_file = null;
   #_scale = 0.5;
   #_signalMenu = null;
   #_distance_from_track = 0;

   contextMenu = [];
   elements = [];
   rules = [];

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
   set scale(v) {
      this.#_scale = v;
   }
   get distance_from_track() {
      return this.#_distance_from_track;
   }
   set distance_from_track(v) {
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
   createSignalCommandMenu(menu_string_array) {
      let menu_items = menu_string_array.map(
         function (item) {
            if (!Array.isArray(item)) item = [item];
            return item.map(
               function (str) {
                  let items = str.split(",").map(
                     function (str) {
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

   constructor(id, title, json_file, startElements, initialSignalStellung) {
      this.#_id = id;
      this.#_title = title;
      if (initialSignalStellung) this.#_start = Array.isArray(initialSignalStellung) ? initialSignalStellung : [initialSignalStellung];
      this.#_json_file = json_file;

      if (startElements) {
         if (Array.isArray(startElements)) this.elements = startElements;
         else this.elements = [startElements];
      } else this.elements = [id];

      Application.getInstance().preLoader.addSpriteSheet(json_file);
   }

   getVisualElementsByOnCondition(condition) {
      let results = [];
      function iterateItems(ve) {
         if (Array.isArray(ve)) return ve.some((item) => iterateItems(item));
         else if (ve instanceof VisualElement) {
            if (ve.childs()?.some((item) => iterateItems(item)) || [].concat(ve.on()).some((c) => c === condition)) {
               results.push(ve);
               return true;
            }
         }
         return false;
      }

      iterateItems(this.elements);

      return results;
   }

   ///returns an array with all conditions. Used by UI to determent if a Feauture should be displayed
   getAllVisualElementConditions() {
      const stack = [...this.elements];
      const conditions = [];
      let ve;
      while (stack.length > 0) {
         ve = stack.pop();
         if (typeof ve == "object") {
            [].concat(ve.on()).forEach((c) => {
               if (c) c.split("&&").forEach((c) => ArrayUtils.pushUnique(conditions, c.replace("!", "")));
            });

            if (ve.childs()) stack.push(...ve.childs());
         }
      }
      return conditions;
   }

   addRule(trigger, setting) {
      this.rules.push([trigger, setting]);
   }

   stringify() {
      return this.id;
   }
}




