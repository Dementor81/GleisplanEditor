"use strict";

// ES6 Module imports
import { Track } from './track.ts';
import { Switch } from './switch.ts';
import { Signal } from './signal.ts';
import { Train } from './train.ts';
import { GenericObject } from './generic_object.ts';
import { RailwayCrossing } from './railway_crossing.ts';
import { ArrayUtils } from './utils.ts';
import { ui } from './ui.ts';
import { CONFIG } from './config.ts';
import { Application } from './application.ts';
import { AdvancedRendering } from './rendering/advanced/AdvancedRendering.ts';
import { getCDataValue } from './tools.ts';

// ============================================================================
// Type Definitions
// ============================================================================

interface ClassMap {
   Track: typeof Track;
   Switch: typeof Switch;
   Signal: typeof Signal;
   Train: typeof Train;
   GenericObject: typeof GenericObject;
   RailwayCrossing: typeof RailwayCrossing;
}

interface SavedSettings {
   zoom: number;
   scrollX: number;
   scrollY: number;
   renderer: "advanced" | "basic" | "textured";
}

interface LoadedData {
   tracks?: any[];
   trains?: any[];
   switches?: any[];
   objects?: any[];
   crossings?: any[];
   settings?: SavedSettings;
}

interface SwitchData {
   type: "Switch" | "Track";
   id: number;
}

// ============================================================================
// STORAGE Object
// ============================================================================

export const STORAGE = {
   MIN_STORAGE_VERSION: 0.5 as const,
   STORAGE_IDENT: "bahnhof_last1" as const,
   
   /**
    * Get the class map for deserialization
    */
   getClassMap(): ClassMap {
      return {
         Track: Track,
         Switch: Switch,
         Signal: Signal,
         Train: Train,
         GenericObject: GenericObject,
         RailwayCrossing: RailwayCrossing,
      };
   },

   /**
    * JSON receiver function for parsing saved objects
    */
   receiver(key: string, value: any): any {
      if (value?._class && STORAGE.getClassMap()[value._class as keyof ClassMap]) {
         const MyClass = STORAGE.getClassMap()[value._class as keyof ClassMap];
         const instance = MyClass.FromObject(value);
         if (instance == null) ui.showErrorToast(new Error("error loading " + key));
         return instance;
      }
      return value;
   },

   /**
    * JSON replacer function for stringifying objects
    */
   replacer(_key: string, value: any): any {
      return typeof value?.stringify === "function" ? value.stringify() : value;
   },

   /**
    * Get the complete save string with version prefix
    */
   getSaveString(): string {
      return (
         CONFIG.VERSION +
         ";" +
         STORAGE.getJSONString()
      );
   },

   /**
    * Get JSON string of current application state
    */
   getJSONString(include_settings: boolean = true): string {
      const app = Application.getInstance();
      const rm = app.renderingManager as any;
      
      let settings: SavedSettings | null = null;
      if (include_settings && rm) {
         const viewport = rm.viewport;
         const renderer = rm.renderer;
         if (viewport && renderer) {
            settings = {
               zoom: viewport.scale.x,
               scrollX: viewport.x,
               scrollY: viewport.y,
               renderer: renderer instanceof AdvancedRendering ? "advanced" : "basic",
            };
         }
      }
      
      return JSON.stringify(
         {
            tracks: Track.allTracks,
            trains: Train.allTrains,
            switches: Switch.allSwitches,
            objects: GenericObject.all_objects,
            crossings: RailwayCrossing.allCrossings,
            settings: settings,
         },
         STORAGE.replacer
      );
   },

   /**
    * Restore the last undo step
    */
   restoreLastUndoStep(): void {
      const app = Application.getInstance();
      if (app.undoHistory.length <= 1) return;
      app.undoHistory.pop();
      const last = ArrayUtils.last(app.undoHistory) as string | undefined;
      if (last) {
         STORAGE.loadFromJson(last);
      } else {
         Track.allTracks = [];
      }

      const uiManager = app.uiManager as any;
      if (uiManager) uiManager.updateUndoButtonState();
   },

   /**
    * Link objects after deserialization (resolve ID references)
    */
   linkObjects(): void {
      // Link switches to tracks
      Switch.allSwitches.forEach((s: any) => {
         if (s.tracks_id) {
            s.tracks = s.tracks_id.map((id: number | null) => (id ? Track.allTracks.find((t) => t.id === id) ?? null : null));
         }
         s.branch = s.branch_id ? Track.allTracks.find((t) => t.id === s.branch_id) ?? null : null;
         s.from = s.from_id ? Track.allTracks.find((t) => t.id === s.from_id) ?? null : null;
         if (Switch.hasMinimumTracks(s)) s.calculateParameters();
         else console.warn(`Switch ${s.id} has incomplete track references after load`);
         delete s.tracks_id;
         delete s.branch_id;
         delete s.from_id;
      });

      // Link tracks to switches/other tracks
      Track.allTracks.forEach((t: any) => {
         t.switches = t.switches_data.map((sd: SwitchData | null) => {
            if (!sd) return null;
            if (sd.type === "Switch") {
               return Switch.allSwitches.find((s) => s.id === sd.id) ?? null;
            } else if (sd.type === "Track") {
               return Track.allTracks.find((tr) => tr.id === sd.id) ?? null;
            }
            return null;
         });
         delete t.switches_data;
      });

      RailwayCrossing.allCrossings.forEach((crossing) => crossing.relinkTracks());
      RailwayCrossing.allCrossings = RailwayCrossing.allCrossings.filter((crossing) => crossing.entries.length > 0);
   },

   /**
    * Load application state from JSON string
    */
   loadFromJson(json: string): void {
      (window as any).app.renderingManager.clear(false);
      const loaded: LoadedData = JSON.parse(json, STORAGE.receiver);
      
      if (loaded.settings) {
         const vp = (window as any).app.renderingManager.viewport;
         vp.x = loaded.settings.scrollX;
         vp.y = loaded.settings.scrollY;
         vp.scale.set(loaded.settings.zoom);
         if (loaded.settings.renderer) {
            (window as any).app.renderingManager.selectRenderer(
               loaded.settings.renderer === "advanced" || loaded.settings.renderer === "textured"
            );
         }
      }
      
      if (loaded.objects) GenericObject.all_objects = loaded.objects;
      RailwayCrossing.allCrossings = loaded.crossings ? (ArrayUtils.cleanUp(loaded.crossings) as RailwayCrossing[]) : [];
      Track.allTracks = loaded.tracks ? (ArrayUtils.cleanUp(loaded.tracks) as unknown as Track[]) : []; // Filter out nulls from loading errors
      Switch.allSwitches = loaded.switches ? (ArrayUtils.cleanUp(loaded.switches) as unknown as Switch[]) : []; // Filter out nulls from loading errors

      // Reset counters
      Track.counter = Track.allTracks.length ? Math.max(...Track.allTracks.map((t) => t.id)) + 1 : 0;
      Switch.counter = Switch.allSwitches.length ? Math.max(...Switch.allSwitches.map((s) => s.id)) + 1 : 0;
      RailwayCrossing.counter = RailwayCrossing.allCrossings.length ? Math.max(...RailwayCrossing.allCrossings.map((crossing) => crossing.id)) + 1 : 0;

      STORAGE.linkObjects();

      Signal.migrateRenderOrder();

      Track.createRailNetwork();
      Train.allTrains = loaded.trains ? (ArrayUtils.cleanUp(loaded.trains) as unknown as Train[]) : []; // Filter out nulls from loading errors
      Train.allTrains.forEach((t: any) => t.restore());
      Train.allTrains.forEach((t: any) => {
         delete t.trainCoupledFrontId;
         delete t.trainCoupledBackId;
      });
      Train.allTrains = Train.allTrains.filter((t: any) => t.track != null);

      Application.getInstance().renderingManager?.notifyViewportChanged();
   },

   /**
    * Save current state to undo history
    */
   saveUndoHistory(): void {
      const app = Application.getInstance();
      app.undoHistory.push(STORAGE.getJSONString(false));
      if (app.undoHistory.length > CONFIG.MOST_UNDO) {
         app.undoHistory.shift();
      }

      const uiManager = app.uiManager as any;
      if (uiManager) uiManager.updateUndoButtonState();
   },

   /**
    * Save current state to localStorage
    */
   save(): void {
      localStorage.setItem(STORAGE.STORAGE_IDENT, STORAGE.getSaveString());
   },

   /**
    * True if localStorage has a version-tagged save we can pass to loadRecent().
    */
   hasRecentSave(): boolean {
      const x = localStorage.getItem(STORAGE.STORAGE_IDENT);
      if (x == null) return false;
      const sep = x.indexOf(";");
      if (sep <= 0) return false;
      const v = parseFloat(x.substring(0, sep));
      return !Number.isNaN(v) && v >= STORAGE.MIN_STORAGE_VERSION;
   },

   /**
    * Load most recent save from localStorage
    */
   loadRecent(): void {
      try {
         const x = localStorage.getItem(STORAGE.STORAGE_IDENT);
         if (x != null) {
            const indexOfFirst = x.indexOf(";");
            if (indexOfFirst > -1) {
               const loaded_version = parseFloat(x.substring(0, indexOfFirst));
               if (loaded_version >= STORAGE.MIN_STORAGE_VERSION) {
                  STORAGE.loadFromJson(x.slice(indexOfFirst + 1));
               } else {
                  console.error(`stored version ${loaded_version} too old`);
               }
            } else {
               throw new Error("Version Tag is missing");
            }
            STORAGE.saveUndoHistory();
         }
      } catch (error) {
         ui.showErrorToast(error as Error);
      }
      const uiManager = Application.getInstance().uiManager as any;
      if (uiManager) uiManager.updateUndoButtonState();
   },

   /**
    * Load a prebuild layout by name from prebuilds.xml
    */
   loadPrebuildbyName(name: string): Promise<void> {
      return new Promise((resolve, reject) => {
         const xmlhttp = new XMLHttpRequest();
         xmlhttp.onreadystatechange = function () {
            if (this.readyState == 4 && this.status == 200) {
               const xmlDoc = this.responseXML;
               if (!xmlDoc) {
                  reject(new Error("Failed to parse XML"));
                  return;
               }

               const setups = xmlDoc.getElementsByTagName("setup");
               for (let i = 0; i < setups.length; i++) {
                  const titleElement = setups[i].getElementsByTagName("title")[0];
                  if (titleElement && titleElement.textContent == name) {
                     const jsonElement = setups[i].getElementsByTagName("json")[0];
                     const jsonText = getCDataValue(jsonElement);
                     if (jsonText) {
                        STORAGE.loadFromJson(jsonText);
                        resolve();
                        return;
                     }
                  }
               }
               reject(new Error("Prebuild not found"));
            }
         };
         xmlhttp.open("GET", "prebuilds.xml" + "?" + Math.floor(Math.random() * 100), true);
         xmlhttp.send();
      });
   },

   /**
    * Download current state as XML file
    */
   downloadAsFile(): void {
      const xmlStr = `<?xml version="1.0" encoding="UTF-8"?>
      <setup>
      <date>${new Date().toLocaleString()}</date>
      <version>${CONFIG.VERSION}</version>
      <json>
          ${STORAGE.getJSONString(false)}
      </json>
      </setup> `;
  
      const a = document.createElement('a');
      a.href = 'data:text/plain;charset=utf-8,' + encodeURIComponent(xmlStr);
      a.download = 'bahnhof.xml';
      a.click();
   },

   /**
    * Restore state from uploaded file
    */
   async restoreFromFile(): Promise<void> {
      return new Promise((resolve, reject) => {
         const input = document.createElement('input');
         input.type = 'file';
         input.accept = "text/xml";
         input.onchange = (_e: Event) => {
            if (!input.files || input.files.length == 0) {
               ui.showErrorToast(new Error("keine datei hochgeladen!"));
               reject(new Error("keine datei hochgeladen!"));
               return;
            }

            const file = input.files[0];

            if (file.size > 512 * 1024) {
               ui.showErrorToast(new Error("Dateigröße darf 512kb nicht überschreiten!"));
               reject(new Error("Dateigröße darf 512kb nicht überschreiten!"));
               return;
            }

            if (input.accept != file.type) {
               ui.showErrorToast(new Error("falsches Dateiformat!"));
               reject(new Error("falsches Dateiformat!"));
               return;
            }

            const reader = new FileReader();
            reader.readAsText(file, 'UTF-8');

            reader.onload = (readerEvent: ProgressEvent<FileReader>) => {
               try {
                  const content = readerEvent.target?.result as string;
                  if (!content) {
                     reject(new Error("File is empty"));
                     return;
                  }
                  
                  const xmlDoc = new DOMParser().parseFromString(content, "text/xml");
                  const jsonElement = xmlDoc.getElementsByTagName("json")[0];
                  const versionElement = xmlDoc.getElementsByTagName("version")[0];
                  
                  const json = jsonElement?.childNodes[0]?.nodeValue;
                  const versionStr = versionElement?.childNodes[0]?.nodeValue;
                  
                  if (!json || !versionStr) {
                     reject(new Error("Invalid file format"));
                     return;
                  }
                  
                  const version = parseFloat(versionStr);
                  if (version < STORAGE.MIN_STORAGE_VERSION) {
                     ui.showErrorToast(new Error("Diese Datei ist zu alt!"));
                     reject(new Error("Diese Datei ist zu alt!"));
                     return;
                  }
                  
                  STORAGE.loadFromJson(json);
                  resolve();
               } catch (err) {
                  ui.showErrorToast(err as Error);
                  reject(err);
               }
            };

            reader.onerror = (_err: ProgressEvent<FileReader>) => {
               const error = new Error("Failed to read file");
               ui.showErrorToast(error);
               reject(error);
            };
         };
         input.click();
      });
   }, 
};

