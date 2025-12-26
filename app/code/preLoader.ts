"use strict";

// ES6 Module imports
import { ArrayUtils } from './utils.ts';
import { ui } from './ui.ts';

// ============================================================================
// Type Definitions
// ============================================================================

interface SpriteManifestItem {
   id: string;
   src: string;
   signal: string;
   pos: {
      top: number;
      left: number;
   };
   sourceRect: {
      x: number;
      y: number;
      width: number;
      height: number;
   };
}

interface LoadQueueItem {
   id: string;
   src: string;
   type: string;
}

// CreateJS LoadQueue types (simplified for our usage)
interface CreateJSLoadQueue {
   loaded: boolean;
   setMaxConnections(num: number): void;
   loadManifest(manifest: SpriteManifestItem[], loadNow: boolean, basePath?: string): void;
   loadFile(item: LoadQueueItem, loadNow: boolean, basePath?: string): void;
   addEventListener(type: string, listener: (event?: any) => void): void;
   setPaused(paused: boolean): void;
   getResult(id: string): any;
   _loadItemsById: Record<string, SpriteManifestItem>;
}

// ============================================================================
// PreLoader Class
// ============================================================================

export class preLoader {
   private _promises: Promise<void>[] = [];
   private _basefolder: string;
   private _jsonFiles: string[] = [];
   private _loadedItems: number = 0;
   private _totalItems: number = 0;
   private _loadQueue: CreateJSLoadQueue;
   
   public onProgress: (progress: number) => void = () => {};

   constructor(basefolder: string) {
      this._basefolder = basefolder;
      if (basefolder.length > 0) this._basefolder += "/";
      
      // Initialize CreateJS LoadQueue
      this._loadQueue = new (createjs as any).LoadQueue(false, basefolder, false);
      this._loadQueue.setMaxConnections(99);
      
      /* this._loadQueue.on("fileload", (e) => {
         this._loadedItems++;
         this.onProgress(this._loadedItems / this._totalItems);
      }); */
   }

   get loaded(): boolean {
      return this._loadQueue.loaded;
   }

   /**
    * Add a sprite sheet (JSON + PNG) to the load queue
    * @param json_file - Name of the JSON file (without extension)
    * @returns Promise that resolves when the sprite sheet manifest is loaded
    */
   addSpriteSheet(json_file: string): Promise<void> | null {
      if (!ArrayUtils.pushUnique(this._jsonFiles, json_file)) return null;
      
      const promise = new Promise<void>((resolve, reject) => {
         preLoader.getJson(this._basefolder + json_file + ".json" + "?" + (window as any).VERSION)
            .then((imgCatalog: SpriteManifestItem[]) => {
               let i = 0;
               let img: SpriteManifestItem;
               while (i < imgCatalog.length) {
                  img = imgCatalog[i];
                  img.src = json_file + ".png" + "?" + (window as any).VERSION;
                  img.id = json_file + img.signal;
                  i++;
               }
               this._totalItems += imgCatalog.length;
               this._loadQueue.loadManifest(imgCatalog, false, this._basefolder);
               resolve();
            })
            .catch(reject);
      });
      
      this._promises.push(promise);
      return promise;
   }

   /**
    * Add a single image to the load queue
    * @param src - Source path of the image
    * @param id - ID to reference the image later
    */
   addImage(src: string, id: string): void {
      this._totalItems++;
      this._loadQueue.loadFile(
         { 
            id: id, 
            src: src, 
            type: (createjs as any).LoadQueue.IMAGE 
         }, 
         false, 
         this._basefolder
      );
   }

   /**
    * Start loading all queued assets
    * @returns Promise that resolves when all assets are loaded
    */
   start(): Promise<void> {
      return new Promise<void>((resolve, reject) => {
         Promise.all(this._promises).then(() => {
            this._loadQueue.addEventListener("error", (e: any) => {
               ui.showInfoToast(e.title + ":" + e.data.id);
            });
            
            this._loadQueue.addEventListener("fileload", () => { 
               this._loadedItems++; 
            });
            
            this._loadQueue.addEventListener("complete", () => {
               resolve();
            });

            this._loadQueue.setPaused(false);
         }).catch(reject);
      });
   }

   /**
    * Get a sprite from a loaded sprite sheet
    * @param json_file - Name of the sprite sheet JSON file
    * @param texture_name - Name of the texture within the sprite sheet
    * @returns CreateJS Bitmap or null if not found
    */
   getSprite(json_file: string, texture_name: string): any | null {
      if (texture_name == null || texture_name == "") {
         throw new Error("kein texture_name übergeben");
      }
      if (json_file == null || json_file == "") {
         throw new Error("kein signal_name übergeben");
      }
      
      const id = json_file + texture_name;
      const img = this._loadQueue.getResult(id);
      
      if (img != null) {
         const item = this._loadQueue._loadItemsById[id];
         return new (createjs as any).Bitmap(img).set({
            name: texture_name,
            y: item.pos.top,
            x: item.pos.left,
            sourceRect: new (createjs as any).Rectangle(
               item.sourceRect.x, 
               item.sourceRect.y, 
               item.sourceRect.width, 
               item.sourceRect.height
            ),
         });
      } else {
         console.log(id + " nicht gefunden, nicht vom preLoader geladen");
      }

      return null;
   }

   /**
    * Get a loaded image by ID
    * @param id - ID of the image to retrieve
    * @returns The loaded image or undefined
    */
   getImage(id: string): any {
      return this._loadQueue.getResult(id);
   }

   /**
    * Load and parse a JSON file
    * @param file - Path to the JSON file
    * @returns Promise that resolves with the parsed JSON data
    */
   static getJson(file: string): Promise<any> {
      return new Promise((resolve, reject) => {
         $.getJSON(file, (data) => resolve(data)).fail((_jqXHR, textStatus, _errorThrown) => {
            reject(new Error(`Failed to load JSON: ${file} - ${textStatus}`));
         });
      });
   }
}

