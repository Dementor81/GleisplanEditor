"use strict";

// ES6 Module imports
import { preLoader } from "./preLoader.ts";
import { Signal } from "./signal.ts";
import { Train } from "./train.ts";
import { Track } from "./track.ts";
import { GenericObject } from "./generic_object.ts";
import { STORAGE } from "./storage.ts";
import { initSignals } from "./signal_library.ts";
import { geometry } from "./tools.ts";
import { ui } from "./ui.ts";
import { CONFIG, CUSTOM_MOUSE_ACTION, MENU, PATHS, Menu, CustomMouseAction } from "./config.ts";
import { EventManager } from "./managers/EventManager.ts";
import { RenderingManager } from "./managers/RenderingManager.ts";
import { UIManager } from "./managers/UIManager.ts";

// ============================================================================
// Type Definitions
// ============================================================================

interface Selection {
   type: string;
   object: any;
   isSelectedObject(test: any): boolean;
}

interface SignalPosition {
   track: any;
   km: number;
   above: boolean;
   flipped?: boolean;
}

/**
 * Main Application class that manages the entire application lifecycle
 * This class follows the singleton pattern and serves as the central coordinator
 */
export class Application {
   static #instance: Application | null = null;

   // Core application state
   #preLoader: preLoader | null = null;
   #signalTemplates: Record<string, any> = {};
   #undoHistory: string[] = [];
   #selection: Selection = {
      type: "",
      object: null,
      isSelectedObject: function (test: any): boolean {
         if (!test || !this.object || this.type != Application.getInstance().getObjectType(test)) return false;
         if (Array.isArray(this.object)) return this.object.includes(test);
         else return this.object === test;
      },
   };

   // Application state
   #editMode: boolean = true;
   #showGrid: boolean = true;
   #customMouseMode: CustomMouseAction = CUSTOM_MOUSE_ACTION.NONE;

   // Managers
   #eventManager: EventManager = new EventManager(this);
   #renderingManager: RenderingManager = new RenderingManager(this);
   #uiManager: UIManager = new UIManager(this);

   /**
    * Get the singleton instance of the Application
    * @returns The application instance
    */
   static getInstance(): Application {
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
    * @returns Promise that resolves when initialization is complete
    */
   async initialize(): Promise<void> {
      try {
         await this.#initializePreLoader();
         this.#initializeManagers();

         console.log("Application initialized successfully");
         return Promise.resolve();
      } catch (error) {
         console.error("Failed to initialize application:", error);
         ui.showErrorToast(error as Error);
         return Promise.reject(error);
      }
   }

   /**
    * Initialize the preloader and signal templates
    * @private
    */
   async #initializePreLoader(): Promise<void> {
      this.#preLoader = new preLoader(PATHS.IMAGES);
      initSignals(this.#signalTemplates);

      // Add basic images
      this.#preLoader.addImage("schwellen.png", "schwellen");
      this.#preLoader.addImage("bumper1.svg", "bumper");

      // Start preloading
      await this.#preLoader.start();
      console.log(`Preloader completed: ${(this.#preLoader as any)._loadedItems}/${(this.#preLoader as any)._totalItems}`);
   }

   /**
    * Initialize managers
    * @private
    */
   #initializeManagers(): void {     

      // Initialize each manager
      this.#renderingManager.initialize();
      this.#eventManager.initialize();
      this.#uiManager.initialize();

      // Initialize renderer
      this.#renderingManager.selectRenderer(!CONFIG.DEFAULT_SIMPLIFIED_VIEW);
      this.#uiManager.updateUndoButtonState();
   }

   /**
    * Start the application
    */
   start(): void {
      this.#uiManager?.showStartScreen();
   }

   /**
    * Align signal container with track
    * @param container - Signal container
    * @param pos - Position information
    */
   alignSignalContainerWithTrack(container: any, pos: SignalPosition): void {
      const point = pos.track.getPointFromKm(pos.km);

      let p: any;
      if (pos.above) {
         container.rotation = 270 + pos.track.deg;
         p = point.add(
            geometry
               .perpendicular(pos.track.unit)
               .multiply(
                  -this.#renderingManager!.renderer.SIGNAL_DISTANCE_FROM_TRACK - container.data._template.distance_from_track
               )
         );
      } else {
         container.rotation = 90 + pos.track.deg;
         p = point.add(
            geometry
               .perpendicular(pos.track.unit)
               .multiply(
                  this.#renderingManager!.renderer.SIGNAL_DISTANCE_FROM_TRACK + container.data._template.distance_from_track
               )
         );
      }
      if (pos.flipped) container.rotation += 180;

      container.x = p.x;
      container.y = p.y;
   }

   /**
    * Get the type of an object
    * @param object - The object to get the type of
    * @returns The object type as a string
    */
   getObjectType(object: any): string | null {
      if (object instanceof Signal) return "Signal";
      else if (object instanceof Train) return "Train";
      else if (object instanceof GenericObject) return "GenericObject";
      else if (object instanceof Track) return "Track";
      else return null;
   }

   /**
    * Select object
    * @param object - Object to select
    * @param e - Event object
    */
   selectObject(object?: any, e?: any): void {
      if (!object) {
         this.selection.object = null;
         this.selection.type = "";
         this.renderingManager?.renderer?.updateSelection();
         this.uiManager?.showMenu();
         return;
      }

      const t = this.getObjectType(object);

      if (t != this.selection.type) {
         this.selection.object = object;
         this.selection.type = t || "";
      } else {
         if (e?.nativeEvent?.ctrlKey)
            this.selection.object = Array.isArray(this.selection.object)
               ? [...this.selection.object, object]
               : [this.selection.object, object];
         else this.selection.object = object;
      }
      this.renderingManager?.renderer?.updateSelection();

      let menu: Menu | null = null;
      if (object instanceof Signal) {
         if (!Array.isArray(this.selection.object)) menu = MENU.EDIT_SIGNAL;
      } else if (object instanceof Train) {
         menu = MENU.EDIT_TRAIN;
      } else if (object instanceof GenericObject) {
         menu = MENU.EDIT_OBJECT;
      } else if (object instanceof Track) {
         menu = MENU.EDIT_TRACK;
      } else {
         menu = null;
      }

      this.uiManager?.showMenu(menu);
   }

   /**
    * Delete selected object
    */
   deleteSelectedObject(): void {
      if (this.selection.object) {
         if (this.selection.type == "Track") {
            const removedTracks = [].concat(this.selection.object);
            removedTracks.forEach((t: any) => Track.removeTrack(t));
            for (const track of removedTracks) {
               const trainsOnTrack = Train.allTrains.filter((train: any) => train.track === track);
               for (const train of trainsOnTrack) {
                  Train.deleteTrain(train);
               }
            }
            Track.createRailNetwork();
         }
         if (this.selection.type == "Signal") [].concat(this.selection.object).forEach((s: any) => Signal.removeSignal(s));
         STORAGE.saveUndoHistory();
         STORAGE.save();
         this.renderingManager?.renderer.reDrawEverything(true);
         this.renderingManager?.update();
         this.selectObject();
      }
   }

   /**
    * Toggle edit mode
    * @param mode - The edit mode to set
    */
   toggleEditMode(mode?: boolean): void {
      const btnDrawTracks = (window as any).btnDrawTracks;
      this.editMode = mode != undefined ? mode : $(btnDrawTracks).is(":checked");
      this.showGrid = this.editMode;
      this.renderingManager?.drawGrid();
      this.renderingManager?.update();
      if (mode != undefined) $(btnDrawTracks).prop("checked", this.editMode);
   }

   /**
    * Undo the last action
    */
   undo(): void {
      STORAGE.restoreLastUndoStep();
      STORAGE.save();
      this.renderingManager?.renderer.reDrawEverything(true);
      this.renderingManager?.update();
      this.uiManager?.updateUndoButtonState();
   }

   // Getters for accessing internal state
   get preLoader(): preLoader | null {
      return this.#preLoader;
   }
   get signalTemplates(): Record<string, any> {
      return this.#signalTemplates;
   }
   get selection(): Selection {
      return this.#selection;
   }
   get undoHistory(): string[] {
      return this.#undoHistory;
   }
   get editMode(): boolean {
      return this.#editMode;
   }
   get showGrid(): boolean {
      return this.#showGrid;
   }
   get customMouseMode(): CustomMouseAction {
      return this.#customMouseMode;
   }

   // Manager getters
   get eventManager(): EventManager | null {
      return this.#eventManager;
   }
   get renderingManager(): RenderingManager | null {
      return this.#renderingManager;
   }
   get uiManager(): UIManager | null {
      return this.#uiManager;
   }

   // Setters for controlled state changes
   set editMode(mode: boolean) {
      this.#editMode = mode;
   }
   set showGrid(show: boolean) {
      this.#showGrid = show;
   }
   set customMouseMode(mode: CustomMouseAction) {
      this.#customMouseMode = mode;
   }
}

