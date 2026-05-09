import { Container } from "pixi.js";

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
