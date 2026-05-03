"use strict";

// ES6 Module imports

//Signals are build of Visual elements. Some elements are always been drawn, like the "Mast", others have a varianty of
//conditions.
//1st: a VE has conditions, these must match with the Signals features. e.g.: sh1 are only on Zsig and Asig
//2nd: the visual elemnt must be enabled.
export class VisualElement {
   #_blinkt: any = null;
   #_image: any = null;
   #_pos: any = 0;
   #_enabled: ((signal: any) => boolean) | null = null;
   #_on: any = [];
   #_off: any = null;
   #_childs: any = null;

   constructor(image?: any) {
      this.#_image = image;
   }

   on(condition?: any, logic_op: string = "||"): any {
      if (condition === undefined) return this.#_on;
      else {
         if (Array.isArray(condition)) condition = condition.join(logic_op);
         if (this.#_on == null || !Array.isArray(this.#_on)) this.#_on = condition;
         else this.#_on.push(condition);
         return this;
      }
   }

   off(condition?: any, logic_op: string = "||"): any {
      if (condition === undefined) return this.#_off;
      else {
         if (Array.isArray(condition)) condition = condition.join(logic_op);
         if (this.#_off == null || !Array.isArray(this.#_off)) this.#_off = condition;
         else this.#_off.push(condition);
         return this;
      }
   }

   childs(childs?: any): any {
      if (childs === undefined) return this.#_childs;
      else {
         this.#_childs = childs;
         return this;
      }
   }

   blinks(blinks?: any): any {
      if (blinks === undefined) return this.#_blinkt;
      else {
         this.#_blinkt = blinks;
         return this;
      }
   }

   pos(pos?: any): any {
      if (pos === undefined) return this.#_pos;
      else {
         this.#_pos = pos;
         return this;
      }
   }

   get [Symbol.toStringTag](): any {
      return this.#_image;
   }

   get image(): any {
      return this.#_image;
   }

   //visual elements are visible if the enabled function returns true and the signalstellung is set on the signal
   //if both are not set, its always enabled
   isEnabled(signal: any): boolean {
      return (this.#_enabled == null || this.#_enabled(signal)) && signal.check(this.#_on);
   }

   isAllowed(signal: any): boolean {
      return this.off() == null || !signal.check(this.off());
   }
}

export class TextElement extends VisualElement {
   #_format: any;
   #_color: any;
   #_source: any;
   #_width_height: any;

   constructor(source: any, format: any = ["25","Arial","bold"], color: any = "#eee") {
      super();
      this.#_source = source;
      this.#_format = format;
      this.#_color = color;
   }

   
   get format(): any {
      return this.#_format;
   }

   get color(): any {
      return this.#_color;
   }


   //must be an array containing max width and height
   bounds(width_height?: any): any {
      if (width_height === undefined) return this.#_width_height;
      else {         
         this.#_width_height = width_height;
         return this;
      }
   }

   getText(signal: any): any {
      return signal.get(this.#_source);
   }
}


