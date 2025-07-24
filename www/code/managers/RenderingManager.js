"use strict";

// ES6 Module imports
import { CONFIG, COLORS, CONTAINERS, INPUT } from '../config.js';
import { STORAGE } from '../storage.js';
import { Train } from '../train.js';
import { Track } from '../track.js';
import { Switch } from '../switch.js';
import { Signal } from '../signal.js';
import { GenericObject } from '../generic_object.js';
import { trackRendering_basic } from '../trackRendering_basic.js';
import { trackRendering_textured } from '../trackRendering_textured.js';

/**
 * RenderingManager handles all rendering-related functionality
 * This class manages grid drawing, clearing, centering, and other rendering operations
 */
export class RenderingManager {
   #application = null;
   #stage = null;
   #containers = {};
   #renderer = null;
   #grid = null;
   
   constructor(application) {
      this.#application = application;
   }
   
      /**
    * Initialize the rendering manager
    */
   initialize() {
      this.#initializeStage();
      this.#initializeContainers();
      this.#initializeRenderer();
      
      // Listen for renderer changes
      
      
      // Listen for edit mode changes
      this.#application.eventManager.on('editModeChanged', (data) => {
         this.handleEditModeChange(data.editMode, data.showGrid);
      });
   }
   
   /**
    * Initialize the CreateJS stage
    * @private
    */
   #initializeStage() {
      // Disable context menu
      myCanvas.oncontextmenu = () => false;
      this.#stage = new createjs.Stage(myCanvas);
      this.#stage.autoClear = true;
      this.#stage.enableDOMEvents(true);
      createjs.Ticker.framerate = CONFIG.TICKER_FRAMERATE;
      createjs.Ticker.addEventListener("tick", this.#stage);
   }
   
   /**
    * Initialize all containers
    * @private
    */
   #initializeContainers() {
      const createContainer = (name) => {
         const container = new createjs.Container();
         container.name = name;
         container.mouseChildren = true;
         return container;
      };
      
      // Create all containers
      this.#containers.main = createContainer(CONTAINERS.MAIN);
      this.#containers.debug = createContainer(CONTAINERS.DEBUG);
      this.#containers.tracks = createContainer(CONTAINERS.TRACKS);
      this.#containers.objects = createContainer(CONTAINERS.OBJECTS);
      this.#containers.trains = createContainer(CONTAINERS.TRAINS);
      this.#containers.signals = createContainer(CONTAINERS.SIGNALS);
      this.#containers.ui = createContainer(CONTAINERS.UI);
      this.#containers.selection = createContainer(CONTAINERS.SELECTION);
      this.#containers.overlay = createContainer(CONTAINERS.OVERLAY);
      this.#containers.drawing = createContainer(CONTAINERS.DRAWING);

      this.#containers.removeAllChildren = () => {
         this.#containers.debug.removeAllChildren();
         this.#containers.tracks.removeAllChildren();
         this.#containers.objects.removeAllChildren();
         this.#containers.trains.removeAllChildren();
         this.#containers.signals.removeAllChildren();
         this.#containers.ui.removeAllChildren();
         this.#containers.selection.removeAllChildren();
         this.#containers.overlay.removeAllChildren();
         this.#containers.drawing.removeAllChildren();
      };
      
      // Build container hierarchy
      this.#stage.addChild(this.#containers.main);
      this.#stage.addChild(this.#containers.debug);
      this.#containers.main.addChild(this.#containers.tracks);
      this.#containers.main.addChild(this.#containers.objects);
      this.#containers.main.addChild(this.#containers.trains);
      this.#containers.main.addChild(this.#containers.signals);
      this.#stage.addChild(this.#containers.ui);
      this.#stage.addChild(this.#containers.selection);
      this.#stage.addChild(this.#containers.overlay);
      this.#stage.addChild(this.#containers.drawing);
   }
   
   /**
    * Initialize the renderer
    * @private
    */
   #initializeRenderer() {
      this.selectRenderer(!CONFIG.DEFAULT_SIMPLIFIED_VIEW);
      this.onResizeWindow();
   }

   /**
    * Select renderer - central point for renderer management
    * @param {boolean} textured - Whether to use textured renderer
    */
   selectRenderer(textured) {
      // Update the renderer
      this.#renderer = textured ? 
         new trackRendering_textured() : 
         new trackRendering_basic();
      
      // Emit event for other managers to handle
      this.#application.eventManager.emit('rendererChanged', { textured });
      
      this.reDrawEverything(true);
   }

   reDrawEverything(force = false, dont_optimize = false) {
      this.#renderer.reDrawEverything(force, dont_optimize);
   }

   update() {
      this.#stage.update();
   }

   zoom(deltaY) {
      if (!myCanvas.prevent_input) {
         myCanvas.prevent_input = true;

         const stage = this.stage;
         let point = new createjs.Point(stage.mouseX, stage.mouseY);
         let localPoint = stage.globalToLocal(point.x, point.y);
         let old_scale = stage.scale;
         let step = deltaY / (INPUT.ZOOM_STEP_DIVISOR / stage.scale);

         stage.scale -= step;
         stage.scale = Math.min(Math.max(CONFIG.MIN_SCALE, stage.scale), CONFIG.MAX_SCALE);

         if (stage.scale != old_scale) {
            let globalPoint = stage.localToGlobal(localPoint.x, localPoint.y);
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

   scroll(deltaX, deltaY) {
      this.#stage.x += deltaX;
      this.#stage.y += deltaY;
      this.drawGrid();
      this.reDrawEverything();
   }
   /**
    * Handle renderer change event
    * @param {boolean} textured - Whether to use textured renderer
    */
   handleRendererChange(textured) {
      // The renderer is already set by the RenderingManager
      // Just redraw everything with the new renderer
      this.#renderer.reDrawEverything(true);
      this.update();
   }

   /**
    * Handle edit mode change event
    * @param {boolean} editMode - The new edit mode
    * @param {boolean} showGrid - Whether to show grid
    */
   handleEditModeChange(editMode, showGrid) {
      this.#application.editMode = editMode;
      this.#application.showGrid = showGrid;
      this.drawGrid();
      this.update();
   }
   
   /**
    * Clear all content from the application
    */
   clear() {
      this.#application.selectObject();
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
   center() {
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
    * @param {boolean} repaint - Whether to repaint the grid
    */
   drawGrid(repaint = true) {
      if (!this.#grid) {
         this.#grid = new createjs.Shape();
         this.#grid.name = "grid";
         this.#grid.mouseEnabled = false;
         this.#stage.addChildAt(this.#grid, 0);
         this.#grid.graphics.setStrokeStyle(CONFIG.GRID_STROKE_STYLE, "round");
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

         this.#grid.graphics.clear().setStrokeStyle(CONFIG.GRID_STROKE_STYLE, "round").setStrokeDash([5, 5], 2).beginStroke(COLORS.GRID);

         // Draw vertical lines
         for (let x = -padding; x <= size.width + padding; x += CONFIG.GRID_SIZE) {
            this.#grid.graphics.moveTo(x, -padding).lineTo(x, size.height + padding);
         }

         // Draw horizontal lines
         for (let y = -padding; y <= size.height + padding; y += CONFIG.GRID_SIZE) {
            this.#grid.graphics.moveTo(-padding, y).lineTo(size.width + padding, y);
         }

         // Cache with padding to prevent artifacts
         this.#grid.cache(-padding, -padding, size.width + padding * 2, size.height + padding * 2, scale);
      }

      // Align grid to nearest grid line to prevent floating point artifacts
      const scaled_grid_size = CONFIG.GRID_SIZE * this.#stage.scale;
      this.#grid.x = Math.floor(this.#stage.x / scaled_grid_size) * -CONFIG.GRID_SIZE;
      this.#grid.y = Math.floor(this.#stage.y / scaled_grid_size) * -CONFIG.GRID_SIZE;
   }
   
   /**
    * Handle window resize
    */
   onResizeWindow() {
      $(myCanvas).attr("height", $(CanvasContainer).height() - 5);
      $(myCanvas).attr("width", $(CanvasContainer).width());
      this.drawGrid();
      this.update();
   }
   
   /**
    * Set grid visibility
    * @param {boolean} visible - Whether the grid should be visible
    */
   setGridVisible(visible) {
      if (this.#grid) {
         this.#grid.visible = visible;
      }
   }
   
   /**
    * Update the grid position and scale
    */
   updateGrid() {
      if (this.#grid && this.#application.showGrid) {
         const scaled_grid_size = CONFIG.GRID_SIZE * this.#stage.scale;
         this.#grid.x = Math.floor(this.#stage.x / scaled_grid_size) * -CONFIG.GRID_SIZE;
         this.#grid.y = Math.floor(this.#stage.y / scaled_grid_size) * -CONFIG.GRID_SIZE;
      }
   }
   
   /**
    * Force a complete redraw of everything
    */
   forceRedraw() {
      this.drawGrid(true);
      this.#renderer.reDrawEverything(true);
   }
   
   // Getters for accessing rendering state
   get stage() { return this.#stage; }
   get containers() { return this.#containers; }
   get renderer() { return this.#renderer; }
   get grid() { return this.#grid; }
} 