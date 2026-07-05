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
   #_on: any = null;
   #_off: any = null;
   #_childs: any = null;
   #_rotation: any = null;
   #_flip: any = null;
   #_sequence: any = null;
   #_blendMode: any = null;
   #_label: any = null;

   constructor(image?: any) {
      this.#_image = image;
   }

   on(condition?: any): any {
      if (condition === undefined) return this.#_on;
      this.#_on = condition;
      return this;
   }

   off(condition?: any): any {
      if (condition === undefined) return this.#_off;
      this.#_off = condition;
      return this;
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

   rotation(rotation?: any): any {
      if (rotation === undefined) return this.#_rotation;
      else {
         this.#_rotation = rotation;
         return this;
      }
   }

   flip(flip?: any): any {
      if (flip === undefined) return this.#_flip;
      else {
         this.#_flip = flip;
         return this;
      }
   }

   sequence(sequence?: any): any {
      if (sequence === undefined) return this.#_sequence;
      else {
         this.#_sequence = sequence;
         return this;
      }
   }

   blendMode(blendMode?: any): any {
      if (blendMode === undefined) return this.#_blendMode;
      else {
         this.#_blendMode = blendMode;
         return this;
      }
   }

   label(label?: any): any {
      if (label === undefined) return this.#_label;
      else {
         this.#_label = label;
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


   getText(signal: any): any {
      return signal.get(this.#_source);
   }
}


