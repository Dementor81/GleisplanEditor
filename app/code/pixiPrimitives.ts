import {
   Application as PixiApplication,
   Assets,
   Circle,
   Container,
   Graphics,
   Polygon,
   Rectangle,
   Sprite,
   Text,
   Texture,
} from "pixi.js";

type PointLike = { x: number; y: number };

const assignMetadata = (displayObject: any, name?: string, data?: any) => {
   Object.defineProperty(displayObject, "name", {
      value: name ?? "",
      writable: true,
      configurable: true,
   });
   if (name) displayObject.label = name;
   if (data !== undefined) displayObject.data = data;
   displayObject.eventMode = "static";
   return displayObject;
};

const applyDisplayProps = (displayObject: any, props: Record<string, any>) => {
   Object.entries(props).forEach(([key, value]) => {
      if (key === "scale") displayObject.scale.set(value);
      else if (key === "scaleX") displayObject.scale.x = value;
      else if (key === "scaleY") displayObject.scale.y = value;
      else if (key === "regX") displayObject.pivot.x = value;
      else if (key === "regY") displayObject.pivot.y = value;
      else if (key === "rotation") displayObject.angle = value;
      else if (key === "name") {
         Object.defineProperty(displayObject, "name", {
            value,
            writable: true,
            configurable: true,
         });
         displayObject.label = value;
      }
      else displayObject[key] = value;
   });
   return displayObject;
};

export class DisplayGroup extends Container {
   data?: any;
   snapToPixel?: boolean;

   constructor(name?: string, data?: any) {
      super();
      assignMetadata(this, name, data);
      this.interactiveChildren = true;
   }

   removeAllChildren(): void {
      this.removeChildren();
   }

   override getChildByName(name: string): any {
      return this.children.find((child: any) => child.name === name || child.label === name) ?? null;
   }

   set(props: Record<string, any>): this {
      return applyDisplayProps(this, props);
   }

   getTransformedBounds(): Rectangle | null {
      return this.getBounds() as unknown as Rectangle;
   }
}

class GraphicsFacade {
   #target: Sketch;
   #strokeStyle: any = null;
   #fillStyle: any = null;
   #firstPoint: PointLike | null = null;

   constructor(target: Sketch) {
      this.#target = target;
   }

   #flushStroke() {
      if (this.#strokeStyle) this.#target.stroke(this.#strokeStyle);
   }

   #flushFill() {
      if (this.#fillStyle) this.#target.fill(this.#fillStyle);
   }

   clear() {
      this.#target.clear();
      this.#firstPoint = null;
      return this;
   }

   c() {
      return this.clear();
   }

   beginFill(color: string) {
      this.#fillStyle = color;
      return this;
   }

   endFill() {
      this.#flushFill();
      this.#fillStyle = null;
      return this;
   }

   ef() {
      return this.endFill();
   }

   beginStroke(color: string) {
      this.#strokeStyle = {
         width: this.#strokeStyle?.width ?? 1,
         color,
         cap: this.#strokeStyle?.cap ?? "round",
         join: this.#strokeStyle?.join ?? "round",
      };
      return this;
   }

   endStroke() {
      this.#flushStroke();
      this.#strokeStyle = null;
      return this;
   }

   es() {
      return this.endStroke();
   }

   setStrokeStyle(width: number, cap: string = "round", join: string = "round") {
      this.#strokeStyle = { ...(this.#strokeStyle ?? {}), width, cap, join };
      return this;
   }

   setStrokeDash(segments: number[]) {
      void segments;
      return this;
   }

   moveTo(x: number, y: number) {
      this.#firstPoint = { x, y };
      this.#target.moveTo(x, y);
      return this;
   }

   mt(x: number, y: number) {
      return this.moveTo(x, y);
   }

   lineTo(x: number, y: number) {
      this.#target.lineTo(x, y);
      this.#flushStroke();
      if (this.#fillStyle && this.#firstPoint && this.#firstPoint.x === x && this.#firstPoint.y === y) this.#flushFill();
      return this;
   }

   lt(x: number, y: number) {
      return this.lineTo(x, y);
   }

   quadraticCurveTo(cpx: number, cpy: number, x: number, y: number) {
      this.#target.quadraticCurveTo(cpx, cpy, x, y);
      this.#flushStroke();
      return this;
   }

   bezierCurveTo(cp1x: number, cp1y: number, cp2x: number, cp2y: number, x: number, y: number) {
      this.#target.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, x, y);
      this.#flushStroke();
      return this;
   }

   closePath() {
      this.#target.closePath();
      this.#flushFill();
      this.#flushStroke();
      return this;
   }

   drawRect(x: number, y: number, width: number, height: number) {
      this.#target.rect(x, y, width, height);
      this.#flushFill();
      this.#flushStroke();
      return this;
   }

   r(x: number, y: number, width: number, height: number) {
      return this.drawRect(x, y, width, height);
   }

   drawCircle(x: number, y: number, radius: number) {
      this.#target.circle(x, y, radius);
      this.#flushFill();
      this.#flushStroke();
      return this;
   }

   drawRoundRect(x: number, y: number, width: number, height: number, radius: number) {
      this.#target.roundRect(x, y, width, height, radius);
      this.#flushFill();
      this.#flushStroke();
      return this;
   }

   drawRoundRectComplex(
      x: number,
      y: number,
      width: number,
      height: number,
      radiusTL: number,
      radiusTR: number,
      radiusBR: number,
      radiusBL: number
   ) {
      this.#target.roundRect(x, y, width, height, Math.max(radiusTL, radiusTR, radiusBR, radiusBL));
      this.#flushFill();
      this.#flushStroke();
      return this;
   }

   arc(x: number, y: number, radius: number, startAngle: number, endAngle: number, anticlockwise?: boolean) {
      this.#target.arc(x, y, radius, startAngle, endAngle, anticlockwise);
      this.#flushStroke();
      return this;
   }

   get command() {
      return { style: this.#strokeStyle?.color };
   }
}

export class Sketch extends Graphics {
   graphics: GraphicsFacade;
   data?: any;
   color?: any;

   constructor(name?: string, data?: any) {
      super();
      assignMetadata(this, name, data);
      this.graphics = new GraphicsFacade(this);
   }

   set(props: Record<string, any>): this {
      return applyDisplayProps(this, props);
   }

   setBounds(x: number, y: number, width: number, height: number): void {
      (this as any)._editorBounds = new Rectangle(x, y, width, height);
   }

   getTransformedBounds(): Rectangle | null {
      return this.getBounds() as unknown as Rectangle;
   }
}

export class LabelText extends Text {
   #font: string = "";
   lineHeight: number = 0;

   constructor(text: string, font: string, color: string) {
      super({ text, style: fontToStyle(font, color) });
      this.font = font;
      this.eventMode = "static";
   }

   get font(): string {
      return this.#font;
   }

   set font(value: string) {
      this.#font = value;
      this.style = fontToStyle(value, String((this.style as any).fill ?? "#000000"));
   }

   getMeasuredWidth(): number {
      return this.width;
   }

   getMeasuredHeight(): number {
      return this.height;
   }

   set(props: Record<string, any>): this {
      return applyDisplayProps(this, props);
   }
}

export class TextureSprite extends Sprite {
   data?: any;

   constructor(texture: Texture | string) {
      super(typeof texture === "string" ? Texture.from(texture) : texture);
      this.eventMode = "static";
   }

   set(props: Record<string, any>): this {
      return applyDisplayProps(this, props);
   }

   clone(): TextureSprite {
      return new TextureSprite(this.texture);
   }
}

export class PixiScene {
   readonly app: PixiApplication;
   readonly viewport: DisplayGroup;
   readonly canvas: HTMLCanvasElement;
   mouseX = 0;
   mouseY = 0;
   #listeners = new Map<Function, EventListener>();

   constructor(app: PixiApplication, canvas: HTMLCanvasElement) {
      this.app = app;
      this.canvas = canvas;
      this.viewport = new DisplayGroup("viewport");
      this.app.stage.addChild(this.viewport);
      this.canvas.addEventListener("pointermove", (event) => this.#recordPointer(event));
   }

   get x(): number {
      return this.viewport.x;
   }

   set x(value: number) {
      this.viewport.x = value;
   }

   get y(): number {
      return this.viewport.y;
   }

   set y(value: number) {
      this.viewport.y = value;
   }

   get scale(): number {
      return this.viewport.scale.x;
   }

   set scale(value: number) {
      this.viewport.scale.set(value);
   }

   get scaleX(): number {
      return this.viewport.scale.x;
   }

   get scaleY(): number {
      return this.viewport.scale.y;
   }

   addChild(child: any): any {
      return this.viewport.addChild(child);
   }

   addChildAt(child: any, index: number): any {
      return this.viewport.addChildAt(child, index);
   }

   update(): void {
      this.app.renderer.render(this.app.stage);
   }

   globalToLocal(x: number, y: number): PointLike {
      return this.viewport.toLocal({ x, y });
   }

   localToGlobal(x: number, y: number): PointLike {
      return this.viewport.toGlobal({ x, y });
   }

   addEventListener(type: string, listener: Function): void {
      const domType = type === "stagemousedown" ? "pointerdown" : type === "stagemouseup" ? "pointerup" : "pointermove";
      const wrapped = ((event: PointerEvent) => {
         this.#recordPointer(event);
         const local = this.globalToLocal(this.mouseX, this.mouseY);
         listener({
            nativeEvent: event,
            primary: event.isPrimary,
            stageX: local.x,
            stageY: local.y,
         });
      }) as EventListener;
      this.#listeners.set(listener, wrapped);
      this.canvas.addEventListener(domType, wrapped);
   }

   removeEventListener(type: string, listener: Function): void {
      const domType = type === "stagemousedown" ? "pointerdown" : type === "stagemouseup" ? "pointerup" : "pointermove";
      const wrapped = this.#listeners.get(listener);
      if (wrapped) this.canvas.removeEventListener(domType, wrapped);
      this.#listeners.delete(listener);
   }

   findAt(point: PointLike, root: any = this.viewport): any {
      const globalPoint = this.viewport.toGlobal(point);
      return findDisplayObjectAt(root, globalPoint);
   }

   #recordPointer(event: PointerEvent): void {
      const rect = this.canvas.getBoundingClientRect();
      this.mouseX = event.clientX - rect.left;
      this.mouseY = event.clientY - rect.top;
   }
}

export async function createPixiScene(canvas: HTMLCanvasElement): Promise<PixiScene> {
   const app = new PixiApplication();
   await app.init({
      canvas,
      backgroundAlpha: 0,
      antialias: true,
      autoDensity: true,
      resolution: window.devicePixelRatio || 1,
   });
   return new PixiScene(app, canvas);
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

export function clearDisplay(displayObject: { removeChildren: () => void }): void {
   displayObject.removeChildren();
}

export function findChild(displayObject: { children: any[] }, name: string): any {
   return displayObject.children.find((child: any) => child.name === name || child.label === name) ?? null;
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

function fontToStyle(font: string, color: string): any {
   const sizeMatch = /(\d+)px/.exec(font);
   const family = font.replace(/bold|italic|\d+px/g, "").trim() || "Arial";
   return {
      fill: color,
      fontFamily: family,
      fontSize: sizeMatch ? Number(sizeMatch[1]) : 16,
      fontStyle: font.includes("Italic") || font.includes("italic") ? "italic" : "normal",
      fontWeight: font.includes("bold") ? "bold" : "normal",
   };
}
