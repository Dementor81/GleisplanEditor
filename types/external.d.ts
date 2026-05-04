/**
 * Type definitions for external libraries
 * 
 * This file provides TypeScript types for libraries that don't have official @types packages.
 * 
 * Official types are installed via npm:
 * - jQuery: @types/jquery
 * - Bootstrap: @types/bootstrap
 * 
 * Custom types defined here:
 * - CreateJS (no official types available)
 */

/// <reference types="jquery" />
/// <reference types="bootstrap" />

interface JQuery {
  onclick(
    handler: JQuery.TypeEventHandler<HTMLElement, undefined, HTMLElement, HTMLElement, "click">
  ): JQuery;
}

// ============================================================================
// CreateJS Type Definitions
// ============================================================================

declare namespace createjs {
  // Core Classes
  export class Stage {
    constructor(canvas: HTMLCanvasElement | string);
    canvas: HTMLCanvasElement;
    autoClear: boolean;
    scale: number;
    scaleX: number;
    scaleY: number;
    x: number;
    y: number;
    mouseX: number;
    mouseY: number;
    
    addChild(child: DisplayObject): DisplayObject;
    addChildAt(child: DisplayObject, index: number): DisplayObject;
    removeChild(child: DisplayObject): boolean;
    removeAllChildren(): void;
    getChildByName(name: string): DisplayObject | null;
    update(): void;
    clear(): void;
    enableDOMEvents(enable: boolean): void;
    addEventListener(type: string, listener: Function | any): void;
    removeEventListener(type: string, listener: Function | any): void;
    globalToLocal(x: number, y: number): Point;
    localToGlobal(x: number, y: number): Point;
    getObjectUnderPoint(x: number, y: number, mode: number): DisplayObject | null;
    getBounds(): Rectangle | null;
    cache(x: number, y: number, width: number, height: number, scale?: number): void;
    toDataURL(backgroundColor?: string, mimeType?: string): string;
    bitmapCache?: {
      getCacheDataURL(): string;
    };
  }

  export class Container extends DisplayObject {
    constructor();
    mouseChildren: boolean;
    children: DisplayObject[];
    getObjectUnderPoint(x: number, y: number, mode: number): DisplayObject | null;
  }

  export class DisplayObject {
    name: string;
    x: number;
    y: number;
    regX: number;
    regY: number;
    rotation: number;
    scaleX: number;
    scaleY: number;
    scale: number;
    alpha: number;
    visible: boolean;
    hitArea: DisplayObject | null;
    parent: Container | null;
    mouseEnabled: boolean;
    snapToPixel: boolean;
    shadow: Shadow | null;
    data: any;
    color?: any;
    endpoint?: any;
    track?: any;
    
    addChild(child: DisplayObject): DisplayObject;
    removeChild(child: DisplayObject): boolean;
    removeAllChildren(): void;
    getChildByName(name: string): DisplayObject | null;
    getBounds(): Rectangle | null;
    getTransformedBounds(): Rectangle | null;
    setBounds(x: number, y: number, width: number, height: number): void;
    cache(x: number, y: number, width: number, height: number, scale?: number): void;
    localToLocal(x: number, y: number, target: DisplayObject | Stage): Point;
    localToGlobal(x: number, y: number): Point;
    globalToLocal(x: number, y: number): Point;
    set(props: any): DisplayObject;
  }

  export class Shape extends DisplayObject {
    constructor(graphics?: Graphics);
    graphics: Graphics;
  }

  export class Graphics {
    command: any;
    // static helpers
    static getRGB(r: number, g: number, b: number, a?: number): string;
    clear(): Graphics;
    beginFill(color: string): Graphics;
    endFill(): Graphics;
    beginStroke(color: string): Graphics;
    endStroke(): Graphics;
    setStrokeStyle(thickness: number, caps?: string, joints?: string, miterLimit?: number): Graphics;
    setStrokeDash(segments: number[], offset?: number): Graphics;
    moveTo(x: number, y: number): Graphics;
    lineTo(x: number, y: number): Graphics;
    mt(x: number, y: number): Graphics;
    lt(x: number, y: number): Graphics;
    r(x: number, y: number, w: number, h: number): Graphics; // short rect
    ef(): Graphics; // end fill
    drawRect(x: number, y: number, w: number, h: number): Graphics;
    drawCircle(x: number, y: number, radius: number): Graphics;
    drawRoundRect(x: number, y: number, w: number, h: number, radius: number): Graphics;
    drawRoundRectComplex(x: number, y: number, w: number, h: number, radiusTL: number, radiusTR: number, radiusBR: number, radiusBL: number): Graphics;
    arc(x: number, y: number, radius: number, startAngle: number, endAngle: number, anticlockwise?: boolean): Graphics;
    bezierCurveTo(cp1x: number, cp1y: number, cp2x: number, cp2y: number, x: number, y: number): Graphics;
    quadraticCurveTo(cpx: number, cpy: number, x: number, y: number): Graphics;
    closePath(): Graphics;
    c(): Graphics; // alias for clear
    es(): Graphics; // alias for endStroke
  }

  export class Text extends DisplayObject {
    constructor(text?: string, font?: string, color?: string);
    text: string;
    font: string;
    color: string;
    textAlign: string;
    textBaseline: string;
    lineHeight: number;
    getMeasuredWidth(): number;
    getMeasuredHeight(): number;
  }

  export class Bitmap extends DisplayObject {
    constructor(imageOrUri: HTMLImageElement | string);
    image: HTMLImageElement;
    sourceRect: Rectangle | null;
    clone(): Bitmap;
  }

  export class Rectangle {
    constructor(x: number, y: number, width: number, height: number);
    x: number;
    y: number;
    width: number;
    height: number;
  }

  export class Point {
    constructor(x: number, y: number);
    x: number;
    y: number;
  }

  export class Ticker {
    static framerate: number;
    static addEventListener(type: string, listener: any): void;
    static removeEventListener(type: string, listener: any): void;
  }

  export class LoadQueue {
    constructor(useXHR?: boolean, basePath?: string, crossOrigin?: boolean);
    
    static IMAGE: string;
    static JSON: string;
    
    loaded: boolean;
    
    loadFile(loadItem: any, loadImmediately?: boolean, basePath?: string): void;
    loadManifest(manifest: any[], loadImmediately?: boolean, basePath?: string): void;
    setMaxConnections(value: number): void;
    setPaused(value: boolean): void;
    getResult(value: string): any;
    addEventListener(type: string, listener: Function): void;
    removeEventListener(type: string, listener: Function): void;
    
    _loadItemsById: { [id: string]: any };
  }

  export class Touch {
    static isSupported(): boolean;
    static enable(stage: Stage): void;
  }

  export class Tween {
    static get(target: any, props?: any): Tween;
    
    to(props: any, duration: number, ease?: Function): Tween;
    wait(duration: number): Tween;
    set(props: any): Tween;
    call(callback: Function, params?: any[], scope?: any): Tween;
  }
  
  export class Shadow {
    constructor(color?: string, offsetX?: number, offsetY?: number, blur?: number);
    color: string;
    offsetX: number;
    offsetY: number;
    blur: number;
  }
}

// ============================================================================
// Window Extensions for CreateJS
// ============================================================================

interface Window {
  VERSION: string;
  createjs: typeof createjs;
}

