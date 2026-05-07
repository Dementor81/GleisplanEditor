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
import type { Application } from '../application.ts';
import { createPixiScene, DisplayGroup, Sketch } from '../pixiPrimitives.ts';

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
   #application: Application;
   #stage: any = null;
   #containers: ContainersType | Record<string, any> = {};
   #renderer: any = null;
   #grid: any = null;
   
   constructor(application: Application) {
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
      const myCanvas = (window as any).myCanvas;
      
      // Disable context menu
      myCanvas.oncontextmenu = () => false;
      this.#stage = await createPixiScene(myCanvas);
   }
   
   /**
    * Initialize all containers
    * @private
    */
   #initializeContainers(): void {
      const createContainer = (name: string) => {
         return new DisplayGroup(name);
      };
      
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
         containers.debug.removeAllChildren();
         containers.tracks.removeAllChildren();
         containers.objects.removeAllChildren();
         containers.trains.removeAllChildren();
         containers.signals.removeAllChildren();
         containers.ui.removeAllChildren();
         containers.selection.removeAllChildren();
         containers.overlay.removeAllChildren();
         containers.drawing.removeAllChildren();
      };
      
      this.#containers = containers;
      
      // Build container hierarchy
      this.#stage.addChild(containers.main);
      this.#stage.addChild(containers.debug);
      containers.main.addChild(containers.tracks);
      containers.main.addChild(containers.objects);
      containers.main.addChild(containers.trains);
      containers.main.addChild(containers.signals);
      this.#stage.addChild(containers.ui);
      this.#stage.addChild(containers.selection);
      this.#stage.addChild(containers.overlay);
      this.#stage.addChild(containers.drawing);
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
      this.#stage?.update();
   }

   /**
    * Zoom the stage
    * @param deltaY - The zoom delta
    */
   zoom(deltaY: number): void {
      const myCanvas = (window as any).myCanvas as any;
      
      if (!myCanvas.prevent_input) {
         myCanvas.prevent_input = true;

         const stage = this.stage;
         const point = { x: stage.mouseX, y: stage.mouseY };
         const localPoint = stage.globalToLocal(point.x, point.y);
         const old_scale = stage.scale;
         const step = deltaY / (INPUT.ZOOM_STEP_DIVISOR / stage.scale);

         stage.scale -= step;
         stage.scale = Math.min(Math.max(CONFIG.MIN_SCALE, stage.scale), CONFIG.MAX_SCALE);

         if (stage.scale != old_scale) {
            const globalPoint = stage.localToGlobal(localPoint.x, localPoint.y);
            stage.x -= globalPoint.x - point.x;
            stage.y -= globalPoint.y - point.y;

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
      this.#stage.x += deltaX;
      this.#stage.y += deltaY;
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
      this.#stage.scale = 1;
      this.#stage.x = 0;
      this.#stage.y = 0;
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
         this.#grid = new Sketch("grid");
         this.#grid.name = "grid";
         this.#stage.addChildAt(this.#grid, 0);
      }

      this.#grid.visible = this.#application.showGrid;
      if (!this.#application.showGrid) return;

      if (repaint) {
         const bounds = this.#stage.canvas.getBoundingClientRect();
         const scale = this.#stage.scale;

         // Calculate visible area in grid coordinates
         const size = {
            width: Math.ceil(bounds.width / scale / CONFIG.GRID_SIZE) * CONFIG.GRID_SIZE,
            height: Math.ceil(bounds.height / scale / CONFIG.GRID_SIZE) * CONFIG.GRID_SIZE,
         };

         // Add padding to prevent gaps during panning
         const padding = CONFIG.GRID_SIZE * 2;

         this.#grid.graphics.clear().setStrokeStyle(CONFIG.GRID_STROKE_STYLE, "round").setStrokeDash([5, 5]).beginStroke(COLORS.GRID);

         // Draw vertical lines
         for (let x = -padding; x <= size.width + padding; x += CONFIG.GRID_SIZE) {
            this.#grid.graphics.moveTo(x, -padding).lineTo(x, size.height + padding);
         }

         // Draw horizontal lines
         for (let y = -padding; y <= size.height + padding; y += CONFIG.GRID_SIZE) {
            this.#grid.graphics.moveTo(-padding, y).lineTo(size.width + padding, y);
         }

         // Cache with padding to prevent artifacts
      }

      // Align grid to nearest grid line to prevent floating point artifacts
      const scaled_grid_size = CONFIG.GRID_SIZE * this.#stage.scale;
      this.#grid.x = Math.floor(this.#stage.x / scaled_grid_size) * -CONFIG.GRID_SIZE;
      this.#grid.y = Math.floor(this.#stage.y / scaled_grid_size) * -CONFIG.GRID_SIZE;
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
      this.#stage?.app?.renderer?.resize(canvasWidth, canvasHeight);
      
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
         const scaled_grid_size = CONFIG.GRID_SIZE * this.#stage.scale;
         this.#grid.x = Math.floor(this.#stage.x / scaled_grid_size) * -CONFIG.GRID_SIZE;
         this.#grid.y = Math.floor(this.#stage.y / scaled_grid_size) * -CONFIG.GRID_SIZE;
      }
   }
   
   /**
    * Force a complete redraw of everything
    */
   forceRedraw(): void {
      this.drawGrid(true);
      this.#renderer?.reDrawEverything(true);
   }
   
   // Getters for accessing rendering state
   get stage(): any { return this.#stage; }
   get pixiApp(): any { return this.#stage?.app; }
   get containers(): any { return this.#containers; }
   get renderer(): any { return this.#renderer; }
   get grid(): any { return this.#grid; }
}

