"use strict";

// ES6 Module imports
import { CONFIG, COLORS, CONTAINERS, INPUT } from '../config.ts';
import { STORAGE } from '../storage.ts';
import { Train } from '../train.ts';
import { Track } from '../track.ts';
import { Switch } from '../switch.ts';
import { Signal } from '../signal.ts';
import { GenericObject } from '../generic_object.ts';
import { trackRendering_basic } from '../trackRendering_basic.ts';
import { trackRendering_textured } from '../trackRendering_textured.ts';
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
   main: any;
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

interface EventData {
   editMode?: boolean;
   showGrid?: boolean;
   textured?: boolean;
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
   #renderer: any = null;
   #grid: any = null;
   #domainByDisplay = new WeakMap<Container, unknown>();

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
      
      // Listen for edit mode changes
      const eventManager = this.#application.eventManager as any;
      if (eventManager) {
         eventManager.on('editModeChanged', (data: EventData) => {
            this.handleEditModeChange(data.editMode ?? false, data.showGrid ?? false);
         });
      }
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
      containers.main = createContainer(CONTAINERS.MAIN);
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
      vp.addChild(containers.main);
      vp.addChild(containers.debug);
      containers.main.addChild(containers.tracks);
      containers.main.addChild(containers.objects);
      containers.main.addChild(containers.trains);
      containers.main.addChild(containers.signals);
      vp.addChild(containers.ui);
      vp.addChild(containers.selection);
      vp.addChild(containers.overlay);
      vp.addChild(containers.drawing);
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
    * @param textured - Whether to use textured renderer
    */
   selectRenderer(textured: boolean): void {
      // Update the renderer
      this.#renderer = textured ? 
         new trackRendering_textured() : 
         new trackRendering_basic();
      
      // Emit event for other managers to handle
      const eventManager = this.#application.eventManager as any;
      if (eventManager) {
         eventManager.emit('rendererChanged', { textured });
      }
      
      this.reDrawEverything(true);
   }

   /**
    * Redraw everything
    * @param force - Force redraw
    * @param dont_optimize - Don't optimize rendering
    */
   reDrawEverything(force: boolean = false, dont_optimize: boolean = false): void {
      this.#renderer?.reDrawEverything(force, dont_optimize);
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
   }

   /**
    * Handle renderer change event
    * @param _textured - Whether to use textured renderer (unused)
    */
   handleRendererChange(_textured: boolean): void {
      // The renderer is already set by the RenderingManager
      // Just redraw everything with the new renderer
      this.#renderer?.reDrawEverything(true);
      this.update();
   }

   /**
    * Handle edit mode change event
    * @param editMode - The new edit mode
    * @param showGrid - Whether to show grid
    */
   handleEditModeChange(editMode: boolean, showGrid: boolean): void {
      this.#application.editMode = editMode;
      this.#application.showGrid = showGrid;
      this.drawGrid();
      this.update();
   }
   
   /**
    * Clear all content from the application
    */
   clear(): void {
      this.#application.selectObject(null as any, null as any);
      // Stop any moving trains first
      Train.stopAllTrains();

      Track.allTracks = [];
      Switch.allSwitches = [];
      Signal.allSignals = new Set();
      Train.allTrains = [];
      GenericObject.all_objects = [];

      this.#renderer?.reDrawEverything(true);
   }
   
   /**
    * Center the viewport
    */
   center(): void {
      const vp = this.#viewport!;
      vp.scale.set(1);
      vp.x = 0;
      vp.y = 0;
      STORAGE.save();
      this.drawGrid();
      this.reDrawEverything();
      this.update();
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

      this.#grid.visible = this.#application.showGrid;
      if (!this.#application.showGrid) return;

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
            this.#grid.moveTo(x, -padding).lineTo(x, size.height + padding).stroke(gridStroke);
         }

         for (let y = -padding; y <= size.height + padding; y += CONFIG.GRID_SIZE) {
            this.#grid.moveTo(-padding, y).lineTo(size.width + padding, y).stroke(gridStroke);
         }
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
    * Update the grid position and scale
    */
   updateGrid(): void {
      if (this.#grid && this.#application.showGrid) {
         const scaled_grid_size = CONFIG.GRID_SIZE * this.#viewport!.scale.x;
         this.#grid.x = Math.floor(this.#viewport!.x / scaled_grid_size) * -CONFIG.GRID_SIZE;
         this.#grid.y = Math.floor(this.#viewport!.y / scaled_grid_size) * -CONFIG.GRID_SIZE;
      }
   }
   
   /**
    * Force a complete redraw of everything
    */
   forceRedraw(): void {
      this.drawGrid(true);
      this.#renderer?.reDrawEverything(true);
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
   get renderer(): any { return this.#renderer; }
   get grid(): any { return this.#grid; }

   /** Whether the textured (detailed) track renderer is active. */
   usesTexturedRenderer(): boolean {
      return this.#renderer instanceof trackRendering_textured;
   }
}

