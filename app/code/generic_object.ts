"use strict";

// ES6 Module imports
import { ArrayUtils } from './utils.ts';
import { EditorCommitter } from './editorCommitter.ts';
import { STORAGE } from './storage.ts';
import { Application } from './application.ts';

export class GenericObject {
   static OBJECT_TYPE = {
      none: 0,
      text: 1,
      plattform: 2,
   };

   static MIN_PLATFORM_SIZE = 50;

   static all_objects: any[] = [];

   static FromObject(o: any): GenericObject {
      return new GenericObject()
         .pos(o.pos)
         .size(o.size.width, o.size.height)
         .type(o.type)
         .content(o.content);
   }

   static removeObject(o: any): void {
      if (Application.getInstance().planLocked) return;
      ArrayUtils.remove(this.all_objects, o);
      Application.getInstance().renderingManager!.renderer.renderAllGenericObjects();
      Application.getInstance().renderingManager!.update();
      EditorCommitter.commit();
   }

   static initEditMenu(o: any): void {
      let header_text: string | undefined;
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
      $("#editObjectMenu h5").text(header_text ?? "");

      
      $("#inputContent")
         .off()
         .val(o.content())
         .on("input", function (this: HTMLInputElement) {
            o.content($(this).val());
            Application.getInstance().renderingManager!.renderer.renderAllGenericObjects();
            Application.getInstance().renderingManager!.renderer.updateSelection();
            Application.getInstance().renderingManager!.update();
            STORAGE.save();
         });

      $("#btnRemoveObject")
         .off()
         .onclick(() => {
            this.removeObject(o);
            Application.getInstance().selectObject();
         });

      setTimeout(() => {
         $("#inputContent").focus();
      }, 50);
   }

   #_pos: { x: number; y: number } = { x: 0, y: 0 };
   #_size: { width: number; height: number } = { width: 0, height: 0 };
   #_type: number = GenericObject.OBJECT_TYPE.none;
   #_content: string = "";

   constructor(t: number = GenericObject.OBJECT_TYPE.none) {
      this.#_type = t;
   }

   pos(p?: any): any {
      if (p === undefined) return this.#_pos;
      this.#_pos = p;
      return this;
   }

   size(w?: any, h?: any): any {
      if (w === undefined) return this.#_size;
      this.#_size.width = w;
      this.#_size.height = h;
      return this;
   }

   type(t?: any): any {
      if (t === undefined) return this.#_type;
      this.#_type = t;
      return this;
   }

   content(c?: any): any {
      if (c === undefined) return this.#_content;
      this.#_content = c;
      return this;
   }

   stringify(): any {
      return { _class: "GenericObject", pos: this.#_pos, size: this.#_size, type: this.#_type, content: this.#_content };
   }
}




