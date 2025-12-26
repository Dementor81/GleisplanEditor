"use strict";

// ES6 Module imports
import { ui } from './ui.ts';
import { clone } from './tools.ts';
import { TextElement, VisualElement } from './visualElement.ts';
import { Application } from './application.ts';

export class SignalRenderer {
   static #renderingState = new WeakMap<any, any>();

   static draw(signal: any, container: any, force: boolean = false) {
      if (!SignalRenderer.#renderingState.has(signal) && (force || signal._changed)) {
         SignalRenderer.#renderingState.set(signal, { container });

         container.removeAllChildren();

         signal._dontCache = false;
         signal._template.elements.forEach((ve: any) => this.drawVisualElement(signal, ve));
         signal._changed = false;
         SignalRenderer.#renderingState.delete(signal);
      }
   }

   static createSignalContainer(signal: any) {
      let c = new createjs.Container();
      c.name = "signal";
      c.data = signal;
      c.mouseChildren = false;
      c.snapToPixel = true;
      c.scale = signal._template.scale;
   
      signal.draw(c, true);
      let sig_bounds = c.getBounds();
      if (sig_bounds) {
         // schläft fehl, wenn nichts gezeichnet wurde
         let hit = new createjs.Shape();
         hit.graphics.beginFill("#000").drawRect(sig_bounds.x, sig_bounds.y, sig_bounds.width, sig_bounds.height);
         c.hitArea = hit;
   
         c.regX = sig_bounds.width / 2 + sig_bounds.x;
         c.regY = sig_bounds.height + sig_bounds.y;
      } else console.error("Wahrscheinlich fehler beim Zeichen des Signals!");
   
      return c;
   }

   static drawVisualElement(signal: any, ve: any) {
      if (Array.isArray(ve)) ve.forEach((e) => this.drawVisualElement(signal, e));
      else if (typeof ve == "string") {
         this.addImageElement(signal, ve);
      } else if (ve instanceof TextElement) {
         this.drawTextElement(signal, ve);
      } else if (ve instanceof VisualElement) {
         if (ve.isAllowed(signal) && ve.isEnabled(signal)) {
            if (ve.image) this.addImageElement(signal, ve, ve.blinkt());
            ve.childs()?.forEach((c: any) => this.drawVisualElement(signal, c));
         }
      } else console.log("unknown type of VisualElement: " + ve);
      return false;
   }

   static drawTextElement(signal: any, ve: any) {
      if (!ve.pos()) throw new Error("TextElement doesnt have a position");
      if (ve.isAllowed(signal) && ve.isEnabled(signal)) {
         const formatString = (f: any) => `${f[2] ? "bold" : ""} ${f[0]}px ${f[1]}`;

        let txt = ve.getText(signal);
        if (txt == null) return false;
        if (typeof txt == "string") txt = txt.replace("-", "\n");
        let ar = clone(ve.format);
        const displayObject = new createjs.Text(txt, formatString(ar), ve.color);
        [displayObject.x, displayObject.y] = ve.pos();
        displayObject.textAlign = "center";

        let current_bounds, max_bounds;
        do {
           current_bounds = displayObject.getBounds();
           max_bounds = ve.bounds();
           if (max_bounds && (current_bounds.width > max_bounds[0] || current_bounds.height > max_bounds[1])) {
              ar[0] -= 5;
              displayObject.font = formatString(ar);
              displayObject.lineHeight = ar[0];
           } else break;
        } while (true);
        const state = SignalRenderer.#renderingState.get(signal);
        state.container.addChild(displayObject);
      }
   }

   static addImageElement(signal: any, ve: any, blinkt: boolean = false) {
      const textureName = typeof ve == "string" ? ve : ve.image;

      if (textureName == null || textureName == "") return;

      if (textureName.includes(",", 1)) textureName.split(",").forEach((x: any) => this.addImageElement(signal, x));
      else {
         const state = SignalRenderer.#renderingState.get(signal);
         if (!state.container.getChildByName(textureName)) {
            //check if this texture was already drawn. Some texture are the same for different signals like Zs1 and Zs8
            let bmp = Application.getInstance().preLoader!.getSprite(signal._template.json_file, textureName);
            if (bmp != null) {
               state.container.addChild(bmp);

               if (blinkt) {
                  signal._dontCache = true;
                  createjs.Tween.get(bmp, { loop: true }).wait(1000).to({ alpha: 0 }, 200).wait(800).to({ alpha: 1 }, 50);
               }

               return bmp;
            } else console.log(textureName + " nicht gezeichnet, da sprite für " + textureName + " nicht erstellt wurde");
         }
      }
   }

   static drawPreview(template: any, container: any) {
      container.removeAllChildren();
      // Create a minimal context for preview rendering
      const previewContext = {
         _template: template,
         _signalStellung: {},
         check: () => true, // For preview, always show all elements
         get: () => null
      };
      
      SignalRenderer.#renderingState.set(previewContext, { container });
      // Use existing drawVisualElement but with our preview context
      template.elements.forEach((ve: any) => 
         this.drawVisualElement(previewContext, ve)
      );
      SignalRenderer.#renderingState.delete(previewContext);
   }
}


