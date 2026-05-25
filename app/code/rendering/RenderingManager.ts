"use strict";

// ES6 Module imports
import { CONFIG, COLORS, CONTAINERS, INPUT } from '../config.ts';
import { STORAGE } from '../storage.ts';
import { Train } from '../train.ts';
import { Track } from '../track.ts';
import { Switch } from '../switch.ts';
import { Signal } from '../signal.ts';
import { GenericObject } from '../generic_object.ts';
import { BasicRendering } from './BasicRendering.ts';
import { AdvancedRendering } from './advanced/AdvancedRendering.ts';
import type { TrackRenderingBase } from './TrackRenderingBase.ts';
import type { Application as GleisApplication } from '../application.ts';
import type { Application as PixiApplication } from 'pixi.js';
import { Container } from 'pixi.js';
import { createPixiApplicationWithViewport, hitTestFromViewportLocal, TrackGraphics } from '../pixiPrimitives.ts';
import { createLayerContainer } from '../pixiUtils.ts';

type PointXY = { x: number; y: number };

// ============================================================================
// Type Definitions
// ============================================================================

interface ContainersType {
   debug: any;
   tracks: any;
   objects: any;
   trains: any;
   signals: any;
   ui: any;
   selection: any;
   overlay: any;
   drawing: any;
   removeAllChildren: () => void;
}

/**
 * RenderingManager handles all rendering-related functionality
 * This class manages grid drawing, clearing, centering, and other rendering operations
 */
export class RenderingManager {
   #application: GleisApplication;
   #pixiApp: PixiApplication | null = null;
   #viewport: Container | null = null;
   #canvas: HTMLCanvasElement | null = null;
   #pointerX = 0;
   #pointerY = 0;
   #containers: ContainersType | Record<string, any> = {};
   #renderer: TrackRenderingBase | null = null;
   #grid: TrackGraphics | null = null;
   #domainByDisplay = new WeakMap<Container, unknown>();



   public get scale(): number {
      return this.#viewport!.scale.x;
   }

   constructor(application: GleisApplication) {
      this.#application = application;
   }

   /**
    * Initialize the rendering manager
    */
   async initialize(): Promise<void> {
      await this.#initializeStage();
      this.#initializeContainers();
      this.#initializeRenderer();
   }

   /**
    * Initialize the PixiJS scene
    * @private
    */
   async #initializeStage(): Promise<void> {
      const myCanvas = (window as any).myCanvas as HTMLCanvasElement;

      myCanvas.oncontextmenu = () => false;
      this.#canvas = myCanvas;
      const { app, viewport } = await createPixiApplicationWithViewport(myCanvas);
      this.#pixiApp = app;
      this.#viewport = viewport;
   }

   /**
    * Initialize all containers
    * @private
    */
   #initializeContainers(): void {
      const createContainer = (name: string) => createLayerContainer(name);

      // Create all containers
      const containers: any = {};
      containers.debug = createContainer(CONTAINERS.DEBUG);
      containers.tracks = createContainer(CONTAINERS.TRACKS);
      containers.objects = createContainer(CONTAINERS.OBJECTS);
      containers.trains = createContainer(CONTAINERS.TRAINS);
      containers.signals = createContainer(CONTAINERS.SIGNALS);
      containers.ui = createContainer(CONTAINERS.UI);
      containers.selection = createContainer(CONTAINERS.SELECTION);
      containers.overlay = createContainer(CONTAINERS.OVERLAY);
      containers.drawing = createContainer(CONTAINERS.DRAWING);

      containers.removeAllChildren = () => {
         containers.debug.removeChildren();
         containers.tracks.removeChildren();
         containers.objects.removeChildren();
         containers.trains.removeChildren();
         containers.signals.removeChildren();
         containers.ui.removeChildren();
         containers.selection.removeChildren();
         containers.overlay.removeChildren();
         containers.drawing.removeChildren();
      };

      this.#containers = containers;

      const vp = this.#viewport!;
      vp.addChild(containers.tracks);
      vp.addChild(containers.objects);
      vp.addChild(containers.trains);
      vp.addChild(containers.ui);
      vp.addChild(containers.signals);
      vp.addChild(containers.selection);
      vp.addChild(containers.overlay);
      vp.addChild(containers.drawing);
      vp.addChild(containers.debug);
   }

   /**
    * Initialize the renderer
    * @private
    */
   #initializeRenderer(): void {
      this.selectRenderer(!CONFIG.DEFAULT_SIMPLIFIED_VIEW);
      this.onResizeWindow();
   }

   /**
    * Select renderer - central point for renderer management
    * @param advanced - Whether to use the advanced renderer
    */
   selectRenderer(advanced: boolean): void {
      this.#renderer = advanced ?
         new AdvancedRendering() :
         new BasicRendering();

      const eventManager = this.#application.eventManager as any;
      if (eventManager) {
         eventManager.emit('rendererChanged', { advanced });
      }

      this.reDrawEverything(true);
   }

   /**
    * Redraw everything
    * @param force - removes all children from the containers and recalculates the render values
    * @param render_outside_viewport - does not check if  objects are outside the viewport, used for image export
    */
   reDrawEverything(force: boolean = false, render_outside_viewport: boolean = false): void {
      this.#renderer?.reDrawEverything(force, render_outside_viewport);
   }

   /**
    * Update the stage
    */
   update(): void {
      if (this.#pixiApp) this.#pixiApp.renderer.render(this.#pixiApp.stage);
   }

   recordCanvasPointer(event: MouseEvent): void {
      if (!this.#canvas) return;
      const rect = this.#canvas.getBoundingClientRect();
      this.#pointerX = event.clientX - rect.left;
      this.#pointerY = event.clientY - rect.top;
   }

   /** Pointer position in viewport/world layer space (same space as layout coordinates). */
   viewportPointerLocal(): PointXY {
      return this.#viewport!.toLocal({ x: this.#pointerX, y: this.#pointerY });
   }

   hitTest(root: Container, pointViewportLocal?: PointXY): any {
      return hitTestFromViewportLocal(this.#viewport!, root, pointViewportLocal ?? this.viewportPointerLocal());
   }

   bindGameObjToDisplayObj(display: Container, domain: unknown): void {
      this.#domainByDisplay.set(display, domain);
   }

   getGameObjFromDisplayObj(display: Container): unknown | undefined {
      return this.#domainByDisplay.get(display);
   }

   /**
    * Zoom the stage
    * @param deltaY - The zoom delta
    */
   zoom(deltaY: number): void {
      const myCanvas = (window as any).myCanvas as any;

      if (!myCanvas.prevent_input) {
         myCanvas.prevent_input = true;

         const viewport = this.viewport;
         const point = { x: this.#pointerX, y: this.#pointerY };
         const localPoint = viewport.toLocal(point);
         const old_scale = viewport.scale.x;
         const step = deltaY / (INPUT.ZOOM_STEP_DIVISOR / viewport.scale.x);

         let nextScale = viewport.scale.x - step;
         nextScale = Math.min(Math.max(CONFIG.MIN_SCALE, nextScale), CONFIG.MAX_SCALE);
         viewport.scale.set(nextScale);

         if (viewport.scale.x != old_scale) {
            const globalPoint = viewport.toGlobal(localPoint);
            viewport.x -= globalPoint.x - point.x;
            viewport.y -= globalPoint.y - point.y;

            this.drawGrid();
            this.reDrawEverything();
            this.update();
            STORAGE.save();
            this.notifyViewportChanged();
         }

         myCanvas.prevent_input = false;
      }
   }

   /**
    * Scroll the stage
    * @param deltaX - The X scroll delta
    * @param deltaY - The Y scroll delta
    */
   scroll(deltaX: number, deltaY: number): void {
      const vp = this.#viewport!;
      vp.x += deltaX;
      vp.y += deltaY;
      this.drawGrid();
      this.reDrawEverything();
      this.notifyViewportChanged();
   }

   /**
    * Handle renderer change event
    * @param _advanced - Whether to use the advanced renderer (unused)
    */
   handleRendererChange(_advanced: boolean): void {
      // The renderer is already set by the RenderingManager
      // Just redraw everything with the new renderer
      this.#renderer?.reDrawEverything(true);
      this.update();
   }

   /**
    * Clear all content from the application
    */
   clear(): void {
      this.#application.selectObject(null as any, null as any);
      STORAGE.saveUndoHistory();
      // Stop any moving trains first
      Train.stopAllTrains();

      Track.allTracks = [];
      Switch.allSwitches = [];
      Signal.allSignals = new Set();
      Train.allTrains = [];
      GenericObject.all_objects = [];

      this.#renderer?.reDrawEverything(true);
   }

   /** Zoom back to 100 %; keeps the canvas-center point fixed (same adjustment as wheel zoom around the pointer). */
   resetZoom(): void {
      const viewport = this.#viewport!;
      const canvas = this.#canvas!;

      const point = { x: canvas.width / 2, y: canvas.height / 2 };
      const localPoint = viewport.toLocal(point);
      const old_scale = viewport.scale.x;
      const nextScale = Math.min(Math.max(CONFIG.MIN_SCALE, 1), CONFIG.MAX_SCALE);

      viewport.scale.set(nextScale);

      if (viewport.scale.x !== old_scale) {
         const globalPoint = viewport.toGlobal(localPoint);
         viewport.x -= globalPoint.x - point.x;
         viewport.y -= globalPoint.y - point.y;
      }

      this.#commitViewportChange();
   }

   /** Pan back to origin; zoom unchanged. */
   resetScroll(): void {
      const vp = this.#viewport!;
      vp.x = 0;
      vp.y = 0;
      this.#commitViewportChange();
   }

   /** Zoom 100 % and pan origin (same as resetZoom + resetScroll). */
   center(): void {
      const vp = this.#viewport!;
      vp.scale.set(1);
      vp.x = 0;
      vp.y = 0;
      this.#commitViewportChange();
   }

   #commitViewportChange(): void {
      STORAGE.save();
      this.drawGrid();
      this.reDrawEverything();
      this.notifyViewportChanged();
   }

   /** Notify listeners (e.g. viewport HUD) after pan/zoom changed. */
   notifyViewportChanged(): void {
      this.#application.eventManager?.emit("viewportChanged", { scale: this.#viewport!.scale.x });
   }

   /**
    * Draw the grid
    * @param repaint - Whether to repaint the grid
    */
   drawGrid(repaint: boolean = true): void {
      if (!this.#grid) {
         this.#grid = new TrackGraphics("grid");
         this.#viewport!.addChildAt(this.#grid, 0);
      }

      this.#grid.visible = true;

      if (repaint) {
         const bounds = this.#canvas!.getBoundingClientRect();
         const scale = this.#viewport!.scale.x;

         // Calculate visible area in grid coordinates
         const size = {
            width: Math.ceil(bounds.width / scale / CONFIG.GRID_SIZE) * CONFIG.GRID_SIZE,
            height: Math.ceil(bounds.height / scale / CONFIG.GRID_SIZE) * CONFIG.GRID_SIZE,
         };

         // Add padding to prevent gaps during panning
         const padding = CONFIG.GRID_SIZE * 2;

         const gridStroke = {
            width: CONFIG.GRID_STROKE_STYLE,
            color: COLORS.GRID,
            cap: "round" as const,
            join: "round" as const,
         };

         this.#grid.clear();

         for (let x = -padding; x <= size.width + padding; x += CONFIG.GRID_SIZE) {
            this.#grid.dashedLine(x, -padding, x, size.height + padding);
         }
         for (let y = -padding; y <= size.height + padding; y += CONFIG.GRID_SIZE) {
            this.#grid.dashedLine(-padding, y, size.width + padding, y);
         }
         this.#grid.stroke(gridStroke);
      }

      // Align grid to nearest grid line to prevent floating point artifacts
      const scaled_grid_size = CONFIG.GRID_SIZE * this.#viewport!.scale.x;
      this.#grid.x = Math.floor(this.#viewport!.x / scaled_grid_size) * -CONFIG.GRID_SIZE;
      this.#grid.y = Math.floor(this.#viewport!.y / scaled_grid_size) * -CONFIG.GRID_SIZE;
   }

   /**
    * Handle window resize
    */
   onResizeWindow(): void {
      const myCanvas = (window as any).myCanvas;
      const CanvasContainer = (window as any).CanvasContainer;

      const height = $(CanvasContainer).height();
      const width = $(CanvasContainer).width();

      if (height === undefined || width === undefined) return;

      const canvasHeight = height;
      const canvasWidth = width;
      myCanvas.width = canvasWidth;
      myCanvas.height = canvasHeight;
      myCanvas.style.width = `${canvasWidth}px`;
      myCanvas.style.height = `${canvasHeight}px`;
      this.#pixiApp?.renderer.resize(canvasWidth, canvasHeight);

      this.drawGrid();
      this.update();
   }

   /**
    * Set grid visibility
    * @param visible - Whether the grid should be visible
    */
   setGridVisible(visible: boolean): void {
      if (this.#grid) {
         this.#grid.visible = visible;
      }
   }



   /**
    * Force a complete redraw of everything
    */
   forceRedraw(): void {
      const startTime = performance.now();
      this.drawGrid(true);
      this.#renderer?.reDrawEverything(true);
      const endTime = performance.now();
      console.log(`Rendering completed in ${(endTime - startTime).toFixed(2)} ms`);

   }

   get viewport(): Container {
      return this.#viewport!;
   }

   get canvas(): HTMLCanvasElement {
      return this.#canvas!;
   }

   get pixiApp(): PixiApplication {
      return this.#pixiApp!;
   }
   get containers(): any { return this.#containers; }
   get renderer(): TrackRenderingBase {
      return this.#renderer!;
   }
   get grid(): any { return this.#grid; }

   /** Whether the advanced (detailed) renderer is active. */
   usesAdvancedRenderer(): boolean {
      return this.#renderer instanceof AdvancedRendering;
   }
}

