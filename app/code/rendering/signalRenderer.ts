"use strict";

// ES6 Module imports
import { clone } from './tools.ts';
import { TextElement, VisualElement } from './visualElement.ts';
import { Application } from './application.ts';
import type { Container } from 'pixi.js';
import { Text } from 'pixi.js';

/** Structural type so callers pass RenderingManager without importing it (avoids circular deps). */
export type DomainSink = { bindGameObjToDisplayObj(display: Container, domain: unknown): void };
import { rectHitArea } from './pixiPrimitives.ts';
import { createLayerContainer, findChildByLabel } from './pixiUtils.ts';

export class SignalRenderer {
   static #renderingState = new WeakMap<any, any>();

   static draw(signal: any, container: any, force: boolean = false) {
      if (!SignalRenderer.#renderingState.has(signal) && (force || signal._changed)) {
         SignalRenderer.#renderingState.set(signal, { container });

         container.removeChildren();

         signal._dontCache = false;
         signal._template.elements.forEach((ve: any) => this.drawVisualElement(signal, ve));
         signal._changed = false;
         SignalRenderer.#renderingState.delete(signal);
      }
   }

   static createSignalContainer(rm: DomainSink, signal: any) {
      let c = createLayerContainer("signal");
      rm.bindGameObjToDisplayObj(c, signal);
      c.interactiveChildren = false;
      (c as any).snapToPixel = true;
      c.scale.set(signal._template.scale);
   
      signal.draw(c, true);
      let sig_bounds = c.getLocalBounds();
      if (sig_bounds) {
         // schläft fehl, wenn nichts gezeichnet wurde
         c.hitArea = rectHitArea(sig_bounds.x, sig_bounds.y, sig_bounds.width, sig_bounds.height);
   
         c.pivot.x = sig_bounds.width / 2 + sig_bounds.x;
         c.pivot.y = sig_bounds.height + sig_bounds.y;
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
            if (ve.image) this.addImageElement(signal, ve, ve.blinks());
            ve.childs()?.forEach((c: any) => this.drawVisualElement(signal, c));
         }
      } else console.log("unknown type of VisualElement: " + ve);
      return false;
   }

   static drawTextElement(signal: any, ve: any): void {
      if (!ve.pos()) throw new Error("TextElement doesnt have a position");
      if (ve.isAllowed(signal) && ve.isEnabled(signal)) {
        let txt = ve.getText(signal);
        if (txt == null) return;
        if (typeof txt == "string") txt = txt.replace("-", "\n");
        const format = clone(ve.format) as any[];

        const applyFormatToText = (t: Text) => {
           const fontSize = Number(format[0]);
           t.style.fill = ve.color;
           t.style.fontSize = fontSize;
           t.style.fontFamily = format[1];
           t.style.fontWeight = format[2] ? "bold" : "normal";
           t.style.lineHeight = fontSize;
        };

        const displayObject = new Text({ text: txt });
        displayObject.eventMode = "static";
        applyFormatToText(displayObject);
        [displayObject.x, displayObject.y] = ve.pos();
        displayObject.anchor.x = 0.5;

        let current_bounds, max_bounds;
        do {
           current_bounds = displayObject.getBounds();
           max_bounds = ve.bounds();
           if (max_bounds && (current_bounds.width > max_bounds[0] || current_bounds.height > max_bounds[1])) {
              format[0] = Number(format[0]) - 5;
              applyFormatToText(displayObject);
           } else break;
        } while (true);
        const state = SignalRenderer.#renderingState.get(signal);
        state.container.addChild(displayObject);
      }
   }

   static addImageElement(signal: any, ve: any, blinks: boolean = false) {
      const textureName = typeof ve == "string" ? ve : ve.image;

      if (textureName == null || textureName == "") return;

      if (textureName.includes(",", 1)) textureName.split(",").forEach((x: any) => this.addImageElement(signal, x));
      else {
         const state = SignalRenderer.#renderingState.get(signal);
         if (!findChildByLabel(state.container, textureName)) {
            //check if this texture was already drawn. Some texture are the same for different signals like Zs1 and Zs8
            let bmp = Application.getInstance().preLoader!.getSprite(signal._template.json_file, textureName);
            if (bmp != null) {
               state.container.addChild(bmp);

               if (blinks) {
                  signal._dontCache = true;
                  const ticker = Application.getInstance().renderingManager?.pixiApp?.ticker;
                  let elapsed = 0;
                  ticker?.add((tick: any) => {
                     elapsed = (elapsed + tick.deltaMS) % 2050;
                     bmp.alpha = elapsed < 1000 || elapsed >= 2000 ? 1 : elapsed < 1200 ? 1 - (elapsed - 1000) / 200 : 0;
                  });
               }

               return bmp;
            } else console.log(textureName + " nicht gezeichnet, da sprite für " + textureName + " nicht erstellt wurde");
         }
      }
   }

   static drawPreview(template: any, container: any) {
      container.removeChildren();
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


