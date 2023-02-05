'use strict';

class preLoader {
    constructor(basefolder) {
        this._basefolder = basefolder;
        this._loaderDic = new Map();
        this._loadedItems = 0;
        this.onProgress = (progress) => { };
        this._loadQueue = new createjs.LoadQueue(false);
        this._loadQueue.setMaxConnections(99);
        this._loadQueue.on("fileload", (e) => { this._loadedItems++; this.onProgress(this._loadedItems / this._totalItems) });

    }


    add(signal) {
        return new Promise((resolve, reject) => {
            let file = this._basefolder;
            if(file.length > 0) file += "/";
            file += signal + ".json";
            preLoader.getJson(file + "?" + VERSION).then((imgCatalog) => {
                let i = 0;
                let img;
                while (i < imgCatalog.length) {
                    img = imgCatalog[i];
                    if (img.src == null || img.src == "") img.src = img.signal;
                    img.src += ".png" + "?" + VERSION;
                    img.id = signal + img.signal;
                    i++;
                    this._loaderDic.set(img.id, img);
                    //this._loadQueue.loadFile(img.src, false, signal + "/");
                }
                this._loadQueue.loadManifest(imgCatalog, false, signal + "/");
                resolve();
            });
        });
    }

    start() {
        return new Promise((resolve, reject) => {
            this._loadQueue.addEventListener("complete", () => { console.log("preload done "); resolve() });
            this._loadQueue.setPaused(false);
        });
    }

    getImage(signal_name, texture_name) {
        if (texture_name == null || texture_name == "") throw "kein texture_name übergeben";
        if (signal_name == null || signal_name == "") throw "kein signal_name übergeben";
        let id = signal_name + texture_name;
        if (this._loaderDic.has(id)) {
            let img = this._loadQueue.getResult(id);
            if (img != null) {
                return { img: img, meta: this._loaderDic.get(id) }
            } else
                console.log(id + " nicht gefunden, nicht vom preLoader geladen")

        } else
            console.log(id + " nicht gefunden, nicht im imgcatalog enthalten")

        return null;
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