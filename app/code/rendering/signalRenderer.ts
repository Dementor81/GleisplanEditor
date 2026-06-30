"use strict";

// ES6 Module imports
import { clone } from '../tools.ts';
import { TextElement, VisualElement } from '../visualElement.ts';
import { Application } from '../application.ts';
import type { Container } from 'pixi.js';
import { Graphics, Text } from 'pixi.js';

/** Set true to draw rotation pivot markers on rotated signal elements. */
export const DEBUG_VISUALIZE_SIGNAL_PIVOTS = true;

const DEFAULT_ROTATION_DURATION_MS = 400;
const ROTATION_ANGLE_EPSILON = 1e-4;
const FLIP_SCALE_EPSILON = 1e-4;

/** Structural type so callers pass RenderingManager without importing it (avoids circular deps). */
export type DomainSink = { bindGameObjToDisplayObj(display: Container, domain: unknown): void };
import { rectHitArea } from '../pixiPrimitives.ts';
import { createLayerContainer, findChildByLabel } from '../pixiUtils.ts';
import { SignalInteraction } from '../interactions/SignalInteraction.ts';
import { Signal } from '../signal.ts';
import { SignalConditionEvaluator } from '../signalConditionEvaluator.ts';
import type { SignalFlipConfig, SignalFlipDefinition, SignalRotationConfig, SignalRotationDefinition } from '../signalDefinition.ts';

type DrawParent = { container: Container; originX: number; originY: number; ve?: VisualElement } | VisualElement | null;

type RenderingState = {
   container: Container;
   previousRotations?: Map<string, number>;
   previousScaleYs?: Map<string, number>;
   animateRotation?: boolean;
   animateFlip?: boolean;
};

export class SignalRenderer {
   static #renderingState = new WeakMap<any, RenderingState>();
   static #activeTransformAnimations = new WeakMap<any, Set<() => void>>();

   static #captureRotations(container: Container): Map<string, number> {
      const rotations = new Map<string, number>();
      const walk = (node: Container) => {
         for (const child of node.children) {
            if (child.label) rotations.set(child.label, child.rotation);
            if (child.children.length > 0) walk(child);
         }
      };
      walk(container);
      return rotations;
   }

   static #captureScaleYs(container: Container): Map<string, number> {
      const scaleYs = new Map<string, number>();
      const walk = (node: Container) => {
         for (const child of node.children) {
            if (child.label) scaleYs.set(child.label, child.scale.y);
            if (child.children.length > 0) walk(child);
         }
      };
      walk(container);
      return scaleYs;
   }

   static #cancelTransformAnimations(signal: any) {
      const cancelSet = SignalRenderer.#activeTransformAnimations.get(signal);
      if (!cancelSet) return;
      cancelSet.forEach((cancel) => cancel());
      cancelSet.clear();
   }

   static #registerTransformAnimation(signal: any, remove: () => void) {
      let set = SignalRenderer.#activeTransformAnimations.get(signal);
      if (!set) {
         set = new Set();
         SignalRenderer.#activeTransformAnimations.set(signal, set);
      }
      set.add(remove);
   }

   static #applyPivot(sprite: Container, pivot: [number, number], elementName: string) {
      const [pivotX, pivotY] = pivot;
      sprite.x += pivotX - sprite.pivot.x;
      sprite.y += pivotY - sprite.pivot.y;
      sprite.pivot.set(pivotX, pivotY);
      if (DEBUG_VISUALIZE_SIGNAL_PIVOTS) SignalRenderer.#drawPivotMarker(sprite, pivotX, pivotY, elementName);
   }

   static #animateRotation(signal: any, sprite: Container, fromRad: number, toRad: number, durationMs: number) {
      const ticker = Application.getInstance().renderingManager?.pixiApp?.ticker;
      if (!ticker || durationMs <= 0) {
         sprite.rotation = toRad;
         return;
      }

      sprite.rotation = fromRad;
      let elapsed = 0;
      const remove = () => {
         ticker.remove(tick);
         SignalRenderer.#activeTransformAnimations.get(signal)?.delete(remove);
      };
      const tick = (t: { deltaMS: number }) => {
         elapsed += t.deltaMS;
         const progress = Math.min(1, elapsed / durationMs);
         sprite.rotation = fromRad + (toRad - fromRad) * progress;
         if (progress >= 1) remove();
      };

      SignalRenderer.#registerTransformAnimation(signal, remove);
      ticker.add(tick);
   }

   static #animateFlipScaleY(signal: any, sprite: Container, fromScaleY: number, toScaleY: number, durationMs: number) {
      const ticker = Application.getInstance().renderingManager?.pixiApp?.ticker;
      if (!ticker || durationMs <= 0) {
         sprite.scale.y = toScaleY;
         return;
      }

      sprite.scale.x = 1;
      sprite.scale.y = fromScaleY;
      let elapsed = 0;
      const remove = () => {
         ticker.remove(tick);
         SignalRenderer.#activeTransformAnimations.get(signal)?.delete(remove);
      };
      const tick = (t: { deltaMS: number }) => {
         elapsed += t.deltaMS;
         const progress = Math.min(1, elapsed / durationMs);
         sprite.scale.y = fromScaleY + (toScaleY - fromScaleY) * progress;
         if (progress >= 1) {
            sprite.scale.y = toScaleY;
            remove();
         }
      };

      SignalRenderer.#registerTransformAnimation(signal, remove);
      ticker.add(tick);
   }

   static #resolveElementNames(target: string | string[]): string[] {
      return (Array.isArray(target) ? target : [target]).flatMap((entry) =>
         entry.split(",").map((name) => name.trim()).filter(Boolean)
      );
   }

   static #applyRotations(signal: any, rotation: SignalRotationConfig | undefined, defaultElement?: string) {
      if (!rotation) return;
      const rotations = Array.isArray(rotation) ? rotation : [rotation];
      rotations.forEach((r) => SignalRenderer.applyRotation(signal, r, defaultElement));
   }

   static #applyFlips(signal: any, flip: SignalFlipConfig | undefined, defaultElement?: string) {
      if (!flip) return;
      const flips = Array.isArray(flip) ? flip : [flip];
      flips.forEach((f) => SignalRenderer.applyFlip(signal, f, defaultElement));
   }

   static #groupContext(parent: DrawParent) {
      return parent && "container" in parent ? parent : null;
   }

   static #drawPivotMarker(target: Container, pivotX: number, pivotY: number, elementName: string) {
      const marker = new Graphics();
      marker.eventMode = "none";
      marker.label = `pivot_debug:${elementName}`;
      const size = 5;
      marker.circle(0, 0, size).fill({ color: 0xff00ff, alpha: 0.35 }).stroke({ width: 1, color: 0xff00ff });
      marker.moveTo(-size - 2, 0).lineTo(size + 2, 0).moveTo(0, -size - 2).lineTo(0, size + 2).stroke({ width: 1, color: 0xff00ff });
      marker.x = pivotX;
      marker.y = pivotY;
      target.addChild(marker);
   }

   static draw(signal: any, container: any, force: boolean = false) {
      if (!SignalRenderer.#renderingState.has(signal) && (force || signal._changed)) {
         SignalRenderer.#cancelTransformAnimations(signal);
         const previousRotations = SignalRenderer.#captureRotations(container);
         const previousScaleYs = SignalRenderer.#captureScaleYs(container);
         const animateRotation = !!signal._rotationAspectChanged;
         const animateFlip = !!signal._flipAspectChanged;

         SignalRenderer.#renderingState.set(signal, { container, previousRotations, previousScaleYs, animateRotation, animateFlip });

         container.removeChildren();

         signal._dontCache = false;
         signal._template.elements.forEach((ve: any) => this.drawVisualElement(signal, ve));
         signal._changed = false;
         signal._rotationAspectChanged = false;
         signal._flipAspectChanged = false;
         SignalRenderer.#renderingState.delete(signal);
      }
   }

   static applyContainerBounds(container: Container): void {
      const sig_bounds = container.getLocalBounds();
      if (sig_bounds) {
         container.hitArea = rectHitArea(sig_bounds.x, sig_bounds.y, sig_bounds.width, sig_bounds.height);
         container.pivot.y = sig_bounds.height + sig_bounds.y;
      } else console.error("Wahrscheinlich Fehler beim Zeichen des Signals!");
   }

   static createSignalContainer(rm: DomainSink, signal: any, attachPointer = true) {
      let c = createLayerContainer("signal");
      rm.bindGameObjToDisplayObj(c, signal);
      c.interactiveChildren = false;
      c.scale.set(signal._template.scale);

      signal.draw(c, true);
      SignalRenderer.applyContainerBounds(c);

      if (attachPointer) SignalInteraction.attach(c, signal);

      return c;
   }

   static drawVisualElement(signal: any, ve: any, parent: DrawParent = null) {
      const groupContext = SignalRenderer.#groupContext(parent);

      if (Array.isArray(ve)) ve.forEach((e) => this.drawVisualElement(signal, e, parent));
      else if (typeof ve == "string") {
         this.addImageElement(
            signal,
            ve,
            false,
            undefined,
            groupContext?.container,
            groupContext ? { x: groupContext.originX, y: groupContext.originY } : undefined
         );
      } else if (ve instanceof TextElement) {
         this.drawTextElement(signal, ve, parent);
      } else if (ve instanceof VisualElement) {
         if (ve.isAllowed(signal) && ve.isEnabled(signal)) {
            const label = ve.label();
            if (label) {
               const state = SignalRenderer.#renderingState.get(signal)!;
               const originPos = Array.isArray(ve.pos()) && ve.pos().length
                  ? { x: ve.pos()[0], y: ve.pos()[1] }
                  : Application.getInstance().preLoader!.getSpritePos(signal._template.json_file, ve.image) ?? { x: 0, y: 0 };

               const group = createLayerContainer(label);
               group.x = originPos.x;
               group.y = originPos.y;
               state.container.addChild(group);

               const childContext = { container: group, originX: originPos.x, originY: originPos.y, ve };

               if (ve.image) this.addImageElement(signal, ve, ve.blinks(), undefined, group, originPos);
               ve.childs()?.forEach((c: any) => this.drawVisualElement(signal, c, childContext));
               SignalRenderer.#applyRotations(signal, ve.rotation(), label);
               SignalRenderer.#applyFlips(signal, ve.flip(), label);
            } else {
               const origin = groupContext ? { x: groupContext.originX, y: groupContext.originY } : undefined;
               if (ve.image) this.addImageElement(signal, ve, ve.blinks(), undefined, groupContext?.container, origin);
               ve.childs()?.forEach((c: any) => this.drawVisualElement(signal, c, parent ?? ve));
               SignalRenderer.#applyRotations(signal, ve.rotation());
               SignalRenderer.#applyFlips(signal, ve.flip());
            }
         }
      } else console.log("unknown type of VisualElement: " + ve);
      return false;
   }

   static drawTextElement(signal: any, ve: any, parent: DrawParent = null): void {
      if (!ve.pos()) throw new Error("TextElements require a position");
      if (ve.isAllowed(signal) && ve.isEnabled(signal)) {
        let txt = ve.getText(signal);
        if (txt == null) return;
        if (typeof txt == "string") txt = txt.replace("-", "\n");
        const format = clone(ve.format) as any[];

        const applyFormatToText = (t: Text) => {
           const fontSize = Number(format[0]);
           t.style.fill = ve.color;
           t.style.align = "center";
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

        const state = SignalRenderer.#renderingState.get(signal)!;
        const groupContext = SignalRenderer.#groupContext(parent);
        const veParent = groupContext?.ve ?? (parent instanceof VisualElement ? parent : null);
        let max_bounds;
        if (!max_bounds && veParent?.image) {
           const lookupContainer = groupContext?.container ?? state.container;
           const parentSprite = findChildByLabel(lookupContainer, veParent.image);
           if (parentSprite) {
              const b = parentSprite.getLocalBounds();
              max_bounds = [b.width, b.height];
           }
        }

        let current_bounds;
        do {
           current_bounds = displayObject.getBounds();
           if (max_bounds && (current_bounds.width > max_bounds[0] || current_bounds.height > max_bounds[1])) {
              format[0] = Number(format[0]) - 5;
              applyFormatToText(displayObject);
           } else break;
        } while (true);
        (groupContext?.container ?? state.container).addChild(displayObject);
      }
   }

   static addImageElement(
      signal: any,
      ve: any,
      blinks: boolean = false,
      blendMode?: string,
      targetContainer?: Container,
      origin?: { x: number; y: number }
   ) {
      const textureName = typeof ve == "string" ? ve : ve.image;

      if (textureName == null || textureName == "") return;

      const configuredBlendMode = blendMode ?? (typeof ve !== "string" ? ve.blendMode?.() : undefined);

      if (textureName.includes(",", 1)) {
         textureName.split(",").forEach((x: string) =>
            this.addImageElement(signal, x.trim(), blinks, configuredBlendMode, targetContainer, origin)
         );
      } else {
         const state = SignalRenderer.#renderingState.get(signal)!;
         const container = targetContainer ?? state.container;
         if (!findChildByLabel(container, textureName)) {
            //check if this texture was already drawn. Some texture are the same for different signals like Zs1 and Zs8
            let bmp = Application.getInstance().preLoader!.getSprite(signal._template.json_file, textureName);
            if (bmp != null) {
               container.addChild(bmp);

               const overridePos = typeof ve !== "string" && Array.isArray(ve.pos()) ? ve.pos() : null;
               if (overridePos) {
                  bmp.x = overridePos[0] - (origin?.x ?? 0);
                  bmp.y = overridePos[1] - (origin?.y ?? 0);
               } else if (origin) {
                  bmp.x -= origin.x;
                  bmp.y -= origin.y;
               }

               if (configuredBlendMode) bmp.blendMode = configuredBlendMode;

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

   static applyRotation(signal: any, rotation: SignalRotationDefinition, defaultElement?: string) {
      const state = SignalRenderer.#renderingState.get(signal)!;
      const target = rotation.element ?? defaultElement;
      if (!target) {
         console.warn("Rotation has no element and no defaultElement");
         return;
      }

      const elements = SignalRenderer.#resolveElementNames(target);

      for (const elementName of elements) {
         const sprite = findChildByLabel(state.container, elementName) as any;
         if (!sprite) {
            console.warn(`Rotation target "${elementName}" not found`);
            continue;
         }

         if (rotation.pivot) SignalRenderer.#applyPivot(sprite, rotation.pivot, elementName);

         const targetRad = (rotation.angle * Math.PI) / 180;
         const fromRad = state.previousRotations?.get(elementName);
         const durationMs = rotation.duration ?? DEFAULT_ROTATION_DURATION_MS;

         if (
            state.animateRotation
            && fromRad !== undefined
            && Math.abs(fromRad - targetRad) > ROTATION_ANGLE_EPSILON
         ) {
            SignalRenderer.#animateRotation(signal, sprite, fromRad, targetRad, durationMs);
         } else {
            sprite.rotation = targetRad;
         }
      }
   }

   static applyFlip(signal: any, flip: SignalFlipDefinition, defaultElement?: string) {
      const state = SignalRenderer.#renderingState.get(signal)!;
      const target = flip.element ?? defaultElement;
      if (!target) {
         console.warn("Flip has no element and no defaultElement");
         return;
      }

      const elements = SignalRenderer.#resolveElementNames(target);

      for (const elementName of elements) {
         const sprite = findChildByLabel(state.container, elementName) as any;
         if (!sprite) {
            console.warn(`Flip target "${elementName}" not found`);
            continue;
         }

         if (flip.pivot) SignalRenderer.#applyPivot(sprite, flip.pivot, elementName);

         sprite.scale.x = 1;
         const targetScaleY = flip.scaleY;
         const startScaleY = state.previousScaleYs?.get(elementName);
         const durationMs = flip.duration ?? DEFAULT_ROTATION_DURATION_MS;

         if (
            state.animateFlip
            && startScaleY !== undefined
            && Math.abs(startScaleY - targetScaleY) > FLIP_SCALE_EPSILON
         ) {
            SignalRenderer.#animateFlipScaleY(signal, sprite, startScaleY, targetScaleY, durationMs);
         } else {
            sprite.scale.y = targetScaleY;
         }
      }
   }

   static #applyInitialSignalStellung(stellung: Record<string, unknown>, command: string) {
      const assignment = SignalConditionEvaluator.parseAssignment(command);
      if (assignment) {
         const [setting, value] = assignment;
         stellung[setting] = value;
         return;
      }
      stellung[command] = true;
   }

   static drawPreview(template: any, container: any) {
      container.removeChildren();

      const previewContext: any = {
         _template: template,
         _signalStellung: {},
         get(stellung: string) {
            const value = this._signalStellung[stellung];
            return value != undefined ? value : null;
         },
         check(stellung: any) {
            return Signal.prototype.check.call(this, stellung);
         },
      };

      template.initialSignalStellung?.forEach((command: string) =>
         SignalRenderer.#applyInitialSignalStellung(previewContext._signalStellung, command)
      );

      SignalRenderer.#renderingState.set(previewContext, { container });
      template.elements.forEach((ve: any) => this.drawVisualElement(previewContext, ve));
      SignalRenderer.#renderingState.delete(previewContext);
   }
}

