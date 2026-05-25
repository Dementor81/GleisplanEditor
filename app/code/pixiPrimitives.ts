import {
   Application as PixiApplication,
   Assets,
   Circle,
   Container,
   Graphics,
   Polygon,
   Rectangle,
   Texture,
} from "pixi.js";
import { createLayerContainer } from "./pixiUtils.ts";

type PointLike = { x: number; y: number };

/** Attach Pixi `label` and pointer hit readiness (domain lives on RenderingManager WeakMap). */
export function attachGleisGraphicsMeta(displayObject: Graphics | Container, label?: string): void {
   displayObject.label = label ?? "";
   displayObject.eventMode = "static";
}

/** Plain `Graphics` with label/eventMode (no editor bounds). */
export function gleisGraphics(label?: string): TrackGraphics {
   const g = new TrackGraphics();
   attachGleisGraphicsMeta(g, label);
   return g;
}

/** Graphics used for tracks/rails/editor overlays — keeps logical `editorBounds` separate from mesh bounds. */
export class TrackGraphics extends Graphics {
   editorBounds?: Rectangle;

   constructor(label?: string) {
      super();
      attachGleisGraphicsMeta(this, label);
   }

   setBounds(x: number, y: number, width: number, height: number): void {
      this.editorBounds = new Rectangle(x, y, width, height);
   }

   line2Point(p: PointLike): this {
      return super.lineTo(p.x, p.y);
   }

   lineFromTo(p1: PointLike, p2: PointLike): this {
      return super.moveTo(p1.x, p1.y).lineTo(p2.x, p2.y);
   }

   move2Point(p: PointLike): this {
      return super.moveTo(p.x, p.y);
   }

   quadraticCurve2Point(cp: PointLike, p: PointLike): this {
      return super.quadraticCurveTo(cp.x, cp.y, p.x, p.y);
   }

   fillPoly(points: PointLike[], color: string): this {
      if (points.length < 3) return this;
      this.moveTo(points[0].x, points[0].y);
      for (let i = 1; i < points.length; i++) {
         this.lineTo(points[i].x, points[i].y);
      }
      return this.closePath().fill(color);
   }

   /** Dashed segment along a straight line (axis-aligned paths use a fast path). */
   dashedLine(
      x1: number,
      y1: number,
      x2: number,
      y2: number,
      dashLength = 5,
      spaceLength = 5,
   ): this {
      const dx = x2 - x1;
      const dy = y2 - y1;
      if (dx === 0) {
         return this.#dashedLineAxis(y1, y2, x1, true, dashLength, spaceLength);
      }
      if (dy === 0) {
         return this.#dashedLineAxis(x1, x2, y1, false, dashLength, spaceLength);
      }

      const len = Math.hypot(dx, dy);
      if (len <= 0) return this;

      const ux = dx / len;
      const uy = dy / len;
      const dashX = ux * dashLength;
      const dashY = uy * dashLength;
      const spaceX = ux * spaceLength;
      const spaceY = uy * spaceLength;

      this.moveTo(x1, y1);
      let px = x1;
      let py = y1;
      let remaining = len;
      while (remaining > 0) {
         if (remaining <= dashLength) {
            this.lineTo(x2, y2);
            break;
         }
         px += dashX;
         py += dashY;
         this.lineTo(px, py);
         remaining -= dashLength;
         if (remaining <= 0) break;
         px += spaceX;
         py += spaceY;
         this.moveTo(px, py);
         remaining -= spaceLength;
      }
      return this;
   }

   /** Dashed outline of an axis-aligned rectangle (same origin/size convention as `setBounds`). */
   dashedRect(
      x: number,
      y: number,
      width: number,
      height: number,
      dashLength = 5,
      spaceLength = 5,
   ): this {
      if (width === 0 || height === 0) return this;
      const right = x + width;
      const bottom = y + height;
      return this
         .dashedLine(x, y, right, y, dashLength, spaceLength)
         .dashedLine(right, y, right, bottom, dashLength, spaceLength)
         .dashedLine(right, bottom, x, bottom, dashLength, spaceLength)
         .dashedLine(x, bottom, x, y, dashLength, spaceLength);
   }

   #dashedLineAxis(
      start: number,
      end: number,
      fixed: number,
      vertical: boolean,
      dashLength: number,
      spaceLength: number,
   ): this {
      const len = Math.abs(end - start);
      if (len <= 0) return this;

      const sign = end >= start ? 1 : -1;
      const dashStep = sign * dashLength;
      const spaceStep = sign * spaceLength;

      if (vertical) {
         this.moveTo(fixed, start);
      } else {
         this.moveTo(start, fixed);
      }

      let pos = start;
      let remaining = len;
      while (remaining > 0) {
         if (remaining <= dashLength) {
            if (vertical) this.lineTo(fixed, end);
            else this.lineTo(end, fixed);
            break;
         }
         pos += dashStep;
         if (vertical) this.lineTo(fixed, pos);
         else this.lineTo(pos, fixed);
         remaining -= dashLength;
         if (remaining <= 0) break;
         pos += spaceStep;
         if (vertical) this.moveTo(fixed, pos);
         else this.moveTo(pos, fixed);
         remaining -= spaceLength;
      }
      return this;
   }
}

/** Bootstrap Pixi Application + pan/zoom root container (children attach here, not to app.stage). */
export async function createPixiApplicationWithViewport(
   canvas: HTMLCanvasElement
): Promise<{ app: PixiApplication; viewport: Container }> {
   const app = new PixiApplication();
   await app.init({
      canvas,
      backgroundAlpha: 0,
      antialias: true,
      autoDensity: true,
      resolution: window.devicePixelRatio || 1,
      preference: "webgl", // extract.base64 / canvas previews need 2D toDataURL (WebGPU path does not)
   });
   const viewport = createLayerContainer("viewport");
   app.stage.addChild(viewport);
   return { app, viewport };
}

/** Hit-test in viewport space: `point` is in the same coordinates as pointer positions from canvas CSS pixels. */
export function hitTestFromViewportLocal(viewport: Container, root: Container, pointViewportLocal: PointLike): any {
   const globalPoint = viewport.toGlobal(pointViewportLocal);
   return findDisplayObjectAt(root, globalPoint);
}

export async function loadTexture(url: string): Promise<Texture> {
   return Assets.load<Texture>(url);
}

export function textureRegion(texture: Texture, frame: Rectangle): Texture {
   return new Texture({ source: texture.source, frame });
}

export function imageSize(texture: Texture): { width: number; height: number } {
   return { width: texture.width, height: texture.height };
}

export function rectHitArea(x: number, y: number, width: number, height: number): Rectangle {
   return new Rectangle(x, y, width, height);
}

export function circleHitArea(x: number, y: number, radius: number): Circle {
   return new Circle(x, y, radius);
}

export function polygonHitArea(points: PointLike[]): Polygon {
   return new Polygon(points.flatMap((point) => [point.x, point.y]));
}

/** Geometry-only: point lies under this node or any descendant (ignores interactiveChildren). */
function subtreeGeometryHits(root: any, globalPoint: PointLike): boolean {
   if (!root?.visible) return false;
   const local = root.toLocal ? root.toLocal(globalPoint) : globalPoint;
   if (root.hitArea?.contains?.(local.x, local.y)) return true;
   if (root.containsPoint?.(local)) return true;
   const kids = root.children ?? [];
   for (let i = kids.length - 1; i >= 0; i--) {
      if (subtreeGeometryHits(kids[i], globalPoint)) return true;
   }
   return false;
}

function findDisplayObjectAt(root: any, globalPoint: PointLike): any {
   if (!root?.visible) return null;

   // Match Pixi: children are not separate hit targets; pick this container if geometry hits anywhere inside.
   if (root.interactiveChildren === false) {
      if (!root.eventMode || root.eventMode === "none") return null;
      return subtreeGeometryHits(root, globalPoint) ? root : null;
   }

   const childCount = root.children?.length ?? 0;
   for (let i = childCount - 1; i >= 0; i--) {
      const hit = findDisplayObjectAt(root.children[i], globalPoint);
      if (hit) return hit;
   }

   if (!root.eventMode || root.eventMode === "none") return null;
   const local = root.toLocal ? root.toLocal(globalPoint) : globalPoint;
   if (root.hitArea?.contains?.(local.x, local.y)) return root;
   if (root.containsPoint?.(local)) return root;
   return null;
}
