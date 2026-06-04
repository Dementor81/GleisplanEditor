import { Container, type FederatedPointerEvent } from "pixi.js";
import { Application } from "./application.ts";
import { CUSTOM_MOUSE_ACTION, type CustomMouseAction } from "./config.ts";

/** Layer container: Pixi `label`, pointer-ready (domain via RenderingManager.bindDomain). */
export function createLayerContainer(label?: string): Container {
   const c = new Container({ label: label ?? "" });
   c.eventMode = "static";
   c.interactiveChildren = true;
   return c;
}

export function findChildByLabel(parent: Container, label: string): Container | null {
   const hit = parent.children.find((child: any) => child.label === label);
   return (hit as Container) ?? null;
}

/** Pointerdown on an interactive element: forwards to EventManager unless a custom mouse mode is active or it's a non-primary button. */
export function attachElementPointerDown(container: any): void {
   container.on("pointerdown", (e: FederatedPointerEvent) => {
      const app = Application.getInstance();
      if (app.customMouseMode !== CUSTOM_MOUSE_ACTION.NONE) return;
      if (e.button !== 0) return;
      app.eventManager!.beginInteractionFromElement(container, e);
      e.stopPropagation();
   });
}

/** Like {@link attachElementPointerDown} but only fires while the matching custom mouse mode is active (e.g. coupling points). */
export function attachElementPointerDownForMode(container: any, requiredMode: CustomMouseAction): void {
   container.on("pointerdown", (e: FederatedPointerEvent) => {
      const app = Application.getInstance();
      if (app.customMouseMode !== requiredMode) return;
      if (e.button !== 0) return;
      app.eventManager!.beginInteractionFromElement(container, e);
      e.stopPropagation();
   });
}
