"use strict";

// ES6 Module imports
import { preLoader } from './preLoader.js';
import { SignalRenderer, Signal } from './signal.js';
import { Train } from './train.js';
import { Switch } from './switch.js';
import { Track } from './track.js';
import { GenericObject } from './generic_object.js';
import { STORAGE } from './storage.js';
import { trackRendering_basic } from './trackRendering_basic.js';
import { trackRendering_textured } from './trackRendering_textured.js';
import { initSignals } from './signal_library.js';
import { 
   type, 
   geometry, 
   Point, 
} from './tools.js';
import { ArrayUtils } from './utils.js';
import { ui } from './ui.js';
import { 
   CONFIG, 
   DIRECTION, 
   MOUSE_DOWN_ACTION, 
   CUSTOM_MOUSE_ACTION, 
   MENU,
   CONTAINERS,
   PATHS 
} from './config.js';
import { EventManager } from './managers/EventManager.js';
import { RenderingManager } from './managers/RenderingManager.js';
import { UIManager } from './managers/UIManager.js';

/**
 * Main Application class that manages the entire application lifecycle
 * This class follows the singleton pattern and serves as the central coordinator
 */
export class Application {
   static #instance = null;
   
   // Core application state
   #preLoader = null;
   #signalTemplates = {};
   #undoHistory = [];
   #selection = {
      type: "",
      object: null,
      isSelectedObject: function (test) {
         if (!test || !this.object || this.type != type(test)) return false;
         if (Array.isArray(this.object)) return this.object.includes(test);
         else return this.object === test;
      },
   };
   
   // Application state
   #editMode = true;
   #showGrid = true;
   #customMouseMode = CUSTOM_MOUSE_ACTION.NONE;
   #mouseAction = null;
   
   // Managers
   #eventManager = null;
   #renderingManager = null;
   #uiManager = null;
   
   /**
    * Get the singleton instance of the Application
    * @returns {Application} The application instance
    */
   static getInstance() {
      if (!Application.#instance) {
         Application.#instance = new Application();
      }
      return Application.#instance;
   }
   
   /**
    * Private constructor to enforce singleton pattern
    */
   constructor() {
      if (Application.#instance) {
         throw new Error("Application is a singleton. Use Application.getInstance() instead.");
      }
   }
   
   /**
    * Initialize the application
    * @returns {Promise} Promise that resolves when initialization is complete
    */
   async initialize() {
      try {
         await this.#initializePreLoader();
         this.#initializeManagers();
         
         console.log("Application initialized successfully");
         return Promise.resolve();
      } catch (error) {
         console.error("Failed to initialize application:", error);
         ui.showErrorToast(error);
         return Promise.reject(error);
      }
   }
   
   /**
    * Initialize the preloader and signal templates
    * @private
    */
   async #initializePreLoader() {
      this.#preLoader = new preLoader(PATHS.IMAGES);
      initSignals(this.#signalTemplates);
      
      // Add basic images
      this.#preLoader.addImage("schwellen.png", "schwellen");      
      this.#preLoader.addImage("bumper1.svg", "bumper");
      
      // Start preloading
      await this.#preLoader.start();
      console.log(`Preloader completed: ${this.#preLoader._loadedItems}/${this.#preLoader._totalItems}`);
   }
   

   
   /**
    * Initialize managers
    * @private
    */
   #initializeManagers() {
      // Initialize managers
      this.#renderingManager = new RenderingManager(this);
      this.#eventManager = new EventManager(this);
      this.#uiManager = new UIManager(this);
      
      // Initialize each manager
      this.#renderingManager.initialize();
      this.#eventManager.initialize();
      this.#uiManager.initialize();
      
      // Initialize renderer
      this.#renderingManager.selectRenderer(!CONFIG.DEFAULT_SIMPLIFIED_VIEW);
      this.#uiManager.updateUndoButtonState();
   }

   start() {
      this.#uiManager.showPreBuildScreen();
   }
     

   
   /**
    * Align signal container with track
    * @param {*} container - Signal container
    * @param {*} pos - Position information
    */
   alignSignalContainerWithTrack(container, pos) {
      const point = pos.track.getPointFromKm(pos.km);
      
      let p;
      if (pos.above) {
         container.rotation = 270 + pos.track.deg;
         p = point.add(
            geometry
               .perpendicular(pos.track.unit)
               .multiply(-this.#renderingManager.renderer.SIGNAL_DISTANCE_FROM_TRACK - container.data._template.distance_from_track)
         );
      } else {
         container.rotation = 90 + pos.track.deg;
         p = point.add(
            geometry
               .perpendicular(pos.track.unit)
               .multiply(this.#renderingManager.renderer.SIGNAL_DISTANCE_FROM_TRACK + container.data._template.distance_from_track)
         );
      }
      if (pos.flipped) container.rotation += 180;
      
      container.x = p.x;
      container.y = p.y;
   }

   /**
    * Select object
    * @param {*} object - Object to select
    * @param {Event} e - Event object
    */
   selectObject(object, e) {
      if (!object) {
         this.selection.object = null;
         this.selection.type = "";
         this.renderingManager.renderer?.updateSelection();
         this.uiManager.showMenu();
         return;
      }
      
      const t = type(object);
      if (object) console.log(object);
      
      if (t != this.selection.type) {
         this.selection.object = object;
         this.selection.type = t;
      } else {
         if (e?.nativeEvent?.ctrlKey)
            this.selection.object = Array.isArray(this.selection.object) ? [...this.selection.object, object] : [this.selection.object, object];
         else this.selection.object = object;
      }
      this.renderingManager.renderer?.updateSelection();
      
      let menu;
      switch (t) {
         case "Signal":
            if (!Array.isArray(this.selection.object)) menu = MENU.EDIT_SIGNAL;
            break;
         case "Train":
            menu = MENU.EDIT_TRAIN;
            break;
         case "GenericObject":
            menu = MENU.EDIT_OBJECT;
            break;
         default:
            menu = null;
            break;
      }

      this.uiManager.showMenu(menu);
   }

   /**
    * Delete selected object
    */
   deleteSelectedObject() {
      if (this.selection.object) {
         if (this.selection.type == "Track") {
            const removedTracks = [].concat(this.selection.object);
            removedTracks.forEach((t) => Track.removeTrack(t));
            for (const track of removedTracks) {
               const trainsOnTrack = Train.allTrains.filter((train) => train.track === track);
               for (const train of trainsOnTrack) {
                  Train.deleteTrain(train);
               }
            }
            Track.createRailNetwork();
         }
         if (this.selection.type == "Signal") [].concat(this.selection.object).forEach((s) => Signal.removeSignal(s, null));
         STORAGE.saveUndoHistory();
         STORAGE.save();
         this.renderingManager.renderer.reDrawEverything(true);
         this.renderingManager.update();
         this.selectObject();
      }
   }

   
   /**
    * Toggle edit mode
    * @param {boolean} mode - The edit mode to set
    */
   toggleEditMode(mode) {
      this.editMode = mode != undefined ? mode : $(btnDrawTracks).is(":checked");
      this.showGrid = this.editMode;
      this.renderingManager.drawGrid();
      this.renderingManager.update();
      if (mode != undefined) $(btnDrawTracks).prop(":checked", this.editMode);
   }
   
   /**
    * Undo the last action
    */
   undo() {
      STORAGE.restoreLastUndoStep();
      STORAGE.save();
      this.renderingManager.renderer.reDrawEverything(true);
      this.renderingManager.update();
      this.uiManager.updateUndoButtonState();
   }
   
   // Getters for accessing internal state
   get preLoader() { return this.#preLoader; }
   get signalTemplates() { return this.#signalTemplates; }
   get selection() { return this.#selection; }
   get undoHistory() { return this.#undoHistory; }
   get editMode() { return this.#editMode; }
   get showGrid() { return this.#showGrid; }
   get customMouseMode() { return this.#customMouseMode; }
   get mouseAction() { return this.#mouseAction; }
   
   // Manager getters
   get eventManager() { return this.#eventManager; }
   get renderingManager() { return this.#renderingManager; }
   get uiManager() { return this.#uiManager; }
   
   // Setters for controlled state changes
   set editMode(mode) { this.#editMode = mode; }
   set showGrid(show) { this.#showGrid = show; }
   set customMouseMode(mode) { 
      this.#customMouseMode = mode;
   }
   set mouseAction(action) { 
      this.#mouseAction = action; 
   }
} 