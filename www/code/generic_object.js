"use strict";

// ES6 Module imports
import { ArrayUtils } from './utils.js';
import { STORAGE } from './storage.js';

export class GenericObject {
   static OBJECT_TYPE = {
      none: 0,
      text: 1,
      plattform: 2,
   };

   static all_objects = [];

   static FromObject(o) {
      return new GenericObject().pos(o.pos).size(o.size.width,o.size.height).type(o.type).content(o.content);
   }

   static removeObject(o) {
      ArrayUtils.remove(this.all_objects, o);
      window.renderer.renderAllGenericObjects();
      window.stage.update();
      STORAGE.save();
      STORAGE.saveUndoHistory();
   }

   static initEditMenu(o) {
      let header_text;
      switch (o.type()) {
         case GenericObject.OBJECT_TYPE.text:
            header_text = "Text";
            break;
            case GenericObject.OBJECT_TYPE.plattform:
               header_text = "Bahnsteig";
               break;
         default:
            break;
      }
      $("#editObjectMenu h5").text(header_text);

      
      $("#inputContent")
         .off()
         .val(o.content())
         .on("input", function (e) {
            o.content($(this).val());
            window.renderer.renderAllGenericObjects();
            window.renderer.updateSelection();
            window.stage.update();
            STORAGE.save();
         });

      $("#btnRemoveObject")
         .off()
         .click(() => {
            this.removeObject(o);
            window.selectObject()
         });

      setTimeout(() => {
         $("#inputContent").focus();
      }, 50);
   }

   #_pos = { x: 0, y: 0 };
   #_size = { width: 0, height: 0 };
   #_type = GenericObject.OBJECT_TYPE.none;
   #_content = "";

   constructor(t = GenericObject.OBJECT_TYPE.none) {
      this.#_type = t;
   }

   pos(p) {
      if (p === undefined) return this.#_pos;
      this.#_pos = p;
      return this;
   }

   size(w,h) {
      if (w === undefined) return this.#_size;
      this.#_size.width = w;
      this.#_size.height = h;
      return this;
   }

   type(t) {
      if (t === undefined) return this.#_type;
      this.#_type = t;
      return this;
   }

   content(c) {
      if (c === undefined) return this.#_content;
      this.#_content = c;
      return this;
   }

   stringify() {
      return { _class: "GenericObject", pos: this.#_pos, size: this.#_size, type: this.#_type, content: this.#_content };
   }
}


