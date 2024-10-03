"use strict";

class preLoader {
    constructor(basefolder) {
        this._promises = [];
        this._basefolder = basefolder;
        if (basefolder.length > 0) this._basefolder += "/";
        this._jsonFiles = [];
        this._loadedItems = 0;
        this.onProgress = (progress) => {};
        this._loadQueue = new createjs.LoadQueue(true, basefolder, true);
        this._loadQueue.setMaxConnections(99);
        this._loadQueue.on("fileload", (e) => {
            this._loadedItems++;
            this.onProgress(this._loadedItems / this._totalItems);
        });
    }

    get loaded() {
        return this._loadQueue.loaded;
    }

    addSpriteSheet(json_file) {
        if(this._jsonFiles.includes(json_file)) return null;
        this._jsonFiles.push(json_file);
        let p = new Promise((resolve, reject) => {
            preLoader.getJson(this._basefolder + json_file + ".json" + "?" + VERSION).then((imgCatalog) => {
                let i = 0;
                let img;
                while (i < imgCatalog.length) {
                    img = imgCatalog[i];
                    img.src = json_file + ".png" + "?" + VERSION;
                    img.id = json_file + img.signal;
                    i++;
                }
                this._loadQueue.loadManifest(imgCatalog, false, this._basefolder);
                resolve();
            });
        });
        this._promises.push(p);
        return p;
    }

    addImage(src, id) {
        this._loadQueue.loadFile({ id: id, src: src, type: createjs.LoadQueue.IMAGE }, false, this._basefolder);
    }

    start() {
        return new Promise((resolve, reject) => {
            Promise.all(this._promises).then(() => {
                this._loadQueue.addEventListener("error", (e) => {
                    console.log(e.title + ":" + e.data.id);
                });
                //this._loadQueue.addEventListener("fileload", () => {  });
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

    getPreload(configFile) {
        let x = this._loaderDic.get(configFile.toLowerCase());
        if (x == null) throw new Error("Loader for " + configFile + " not found");
        return x;
    }
}
