"use strict";

// ES6 Module imports
import { ArrayUtils } from './utils.js';
import { ui } from './ui.js';

export class preLoader {
    constructor(basefolder) {
        this._promises = [];
        this._basefolder = basefolder;
        if (basefolder.length > 0) this._basefolder += "/";
        this._jsonFiles = [];
        this._loadedItems = 0;
        this._totalItems = 0;
        this.onProgress = (progress) => {};
        this._loadQueue = new createjs.LoadQueue(false, basefolder, false);
        this._loadQueue.setMaxConnections(99);
        /* this._loadQueue.on("fileload", (e) => {
            this._loadedItems++;
            this.onProgress(this._loadedItems / this._totalItems);
        }); */
    }

    get loaded() {
        return this._loadQueue.loaded;
    }

    addSpriteSheet(json_file) {
        if(!ArrayUtils.pushUnique(this._jsonFiles, json_file))return null;
        
        let p = new Promise((resolve, reject) => {
            preLoader.getJson(this._basefolder + json_file + ".json" + "?" + window.VERSION).then((imgCatalog) => {
                let i = 0;
                let img;
                while (i < imgCatalog.length) {
                    img = imgCatalog[i];
                    img.src = json_file + ".png" + "?" + window.VERSION;
                    img.id = json_file + img.signal;
                    i++;
                }
                this._totalItems+=imgCatalog.length;
                this._loadQueue.loadManifest(imgCatalog, false, this._basefolder);
                resolve();
            });
        });
        this._promises.push(p);
        return p;
    }

    addImage(src, id) {
        this._totalItems++;
        this._loadQueue.loadFile({ id: id, src: src, type: createjs.LoadQueue.IMAGE }, false, this._basefolder);
    }

    start() {
        return new Promise((resolve, reject) => {
            Promise.all(this._promises).then(() => {
                this._loadQueue.addEventListener("error", (e) => {
                    ui.showInfoToast(e.title + ":" + e.data.id);
                });
                this._loadQueue.addEventListener("fileload", () => { this._loadedItems++; });
                this._loadQueue.addEventListener("complete", () => {
                    resolve();
                });

                this._loadQueue.setPaused(false);
            });
        });
    }

    getSprite(json_file, texture_name) {
        if (texture_name == null || texture_name == "") throw "kein texture_name übergeben";
        if (json_file == null || json_file == "") throw "kein signal_name übergeben";
        const id = json_file + texture_name;
        const img = this._loadQueue.getResult(id);
        if (img != null) {
            let item = this._loadQueue._loadItemsById[id];
            return new createjs.Bitmap(img).set({
                name:texture_name,
                y: item.pos.top,
                x: item.pos.left,
                sourceRect: new createjs.Rectangle(item.sourceRect.x, item.sourceRect.y, item.sourceRect.width, item.sourceRect.height),
            });
        } else console.log(id + " nicht gefunden, nicht vom preLoader geladen");

        return null;
    }

    getImage(id) {
        return this._loadQueue.getResult(id);
    }

    static getJson(file) {
        return new Promise((resolve, reject) => {
            $.getJSON(file, (data) => resolve(data));
        });
    }

}


