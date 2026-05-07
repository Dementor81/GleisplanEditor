"use strict";

// ES6 Module imports
import { ArrayUtils } from './utils.ts';
import { ui } from './ui.ts';
import { Rectangle, type Texture } from 'pixi.js';
import { TextureSprite, loadTexture, textureRegion } from './pixiPrimitives.ts';

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

// ============================================================================
// PreLoader Class
// ============================================================================

export class preLoader {
   private _promises: Promise<void>[] = [];
   private _basefolder: string;
   private _jsonFiles: string[] = [];
   private _loadedItems: number = 0;
   private _totalItems: number = 0;
   private _loaded: boolean = false;
   private _imageRequests: { src: string; id: string }[] = [];
   private _textures: Record<string, Texture> = {};
   private _spriteItems: Record<string, SpriteManifestItem> = {};
   
   public onProgress: (progress: number) => void = () => {};

   constructor(basefolder: string) {
      this._basefolder = basefolder;
      if (basefolder.length > 0) this._basefolder += "/";
      
   }

   get loaded(): boolean {
      return this._loaded;
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
               this._totalItems++;
               imgCatalog.forEach((item) => {
                  this._spriteItems[item.id] = item;
               });
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
      this._imageRequests.push({ src, id });
   }

   /**
    * Start loading all queued assets
    * @returns Promise that resolves when all assets are loaded
    */
   start(): Promise<void> {
      return new Promise<void>((resolve, reject) => {
         Promise.all(this._promises)
            .then(async () => {
               const sheetNames = Array.from(new Set(Object.values(this._spriteItems).map((item) => item.src)));
               const imageRequests = [
                  ...this._imageRequests,
                  ...sheetNames.map((src) => ({ src, id: src })),
               ];

               try {
                  await Promise.all(
                     imageRequests.map(async ({ src, id }) => {
                        this._textures[id] = await loadTexture(this._basefolder + src);
                        this._loadedItems++;
                     })
                  );
                  this._loaded = true;
                  resolve();
               } catch (error: any) {
                  ui.showInfoToast(error?.message ?? String(error));
                  reject(error);
               }
            })
            .catch(reject);
      });
   }

   /**
    * Get a sprite from a loaded sprite sheet
    * @param json_file - Name of the sprite sheet JSON file
    * @param texture_name - Name of the texture within the sprite sheet
    * @returns Pixi sprite or null if not found
    */
   getSprite(json_file: string, texture_name: string): any | null {
      if (texture_name == null || texture_name == "") {
         throw new Error("kein texture_name übergeben");
      }
      if (json_file == null || json_file == "") {
         throw new Error("kein signal_name übergeben");
      }
      
      const id = json_file + texture_name;
      const item = this._spriteItems[id];
      
      if (item != null) {
         const texture = this._textures[item.src];
         if (!texture) return null;
         return new TextureSprite(
            textureRegion(
               texture,
               new Rectangle(item.sourceRect.x, item.sourceRect.y, item.sourceRect.width, item.sourceRect.height)
            )
         ).set({
            name: texture_name,
            y: item.pos.top,
            x: item.pos.left,
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
      return this._textures[id];
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

