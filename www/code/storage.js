"use strict";

// ES6 Module imports
import { Track } from './track.js';
import { Switch } from './switch.js';
import { Signal } from './signal.js';
import { Train } from './train.js';
import { GenericObject } from './generic_object.js';
import { ArrayUtils } from './utils.js';
import { ui } from './ui.js';
import { CONFIG } from './config.js';
import { Application } from './application.js';
import { trackRendering_textured } from './trackRendering_textured.js';

export const STORAGE = {
   MIN_STORAGE_VERSION: 0.5,
   STORAGE_IDENT: "bahnhof_last1",
   

   getClassMap() {
      return {
         Track: Track,
         Switch: Switch,
         Signal: Signal,
         Train: Train,
         GenericObject: GenericObject,
      };
   },

   receiver(key, value) {
      if (value?._class && STORAGE.getClassMap()[value._class]) {
         const MyClass = STORAGE.getClassMap()[value._class];
         const instance = MyClass.FromObject(value);
         if (instance == null) ui.showErrorToast(new Error("error loading " + key));
         return instance;
      }
      return value;
   },

   replacer(key, value) {
      return typeof value?.stringify === "function" ? value.stringify() : value;
   },

   getSaveString() {
      return (
         CONFIG.VERSION +
         ";" +
         STORAGE.getJSONString()
      );
   },

   getJSONString(include_settings = true) {
      return JSON.stringify(
         {
            tracks: Track.allTracks,
            trains: Train.allTrains,
            switches: Switch.allSwitches,
            objects: GenericObject.all_objects,
            settings: include_settings ? {
               zoom: Application.getInstance().renderingManager.stage.scale,
               scrollX: Application.getInstance().renderingManager.stage.x,
               scrollY: Application.getInstance().renderingManager.stage.y,
               renderer: Application.getInstance().renderingManager.renderer instanceof trackRendering_textured ? "textured" : "basic",
            } : null,
         },
         STORAGE.replacer
      )
   },

   restoreLastUndoStep() {
      if (Application.getInstance().undoHistory.length <= 1) return;
      Application.getInstance().undoHistory.pop();
      const last = ArrayUtils.last(Application.getInstance().undoHistory);
      if (last) {
         STORAGE.loadFromJson(last);
      } else Track.allTracks = [];

      Application.getInstance().uiManager.updateUndoButtonState();
   },

   linkObjects() {
      // Link switches to tracks
      Switch.allSwitches.forEach((s) => {
         if (s.tracks_id) {
            s.tracks = s.tracks_id.map((id) => (id ? Track.allTracks.find((t) => t.id === id) : null));
         }
         s.branch = s.branch_id ? Track.allTracks.find((t) => t.id === s.branch_id) : null;
         s.from = s.from_id ? Track.allTracks.find((t) => t.id === s.from_id) : null;
         s.calculateParameters();
         delete s.tracks_id;
         delete s.branch_id;
         delete s.from_id;
      });

      // Link tracks to switches/other tracks
      Track.allTracks.forEach((t) => {
         t.switches = t.switches_data.map((sd) => {
            if (!sd) return null;
            if (sd.type === "Switch") {
               return Switch.allSwitches.find((s) => s.id === sd.id);
            } else if (sd.type === "Track") {
               return Track.allTracks.find((tr) => tr.id === sd.id);
            }
            return null;
         });
         delete t.switches_data;
      });
   },

   loadFromJson(json) {
      app.renderingManager.clear();
      let loaded = JSON.parse(json, STORAGE.receiver);
      if (loaded.settings) {
         app.renderingManager.stage.x = loaded.settings.scrollX;
         app.renderingManager.stage.y = loaded.settings.scrollY;
         app.renderingManager.stage.scale = loaded.settings.zoom;
         if (loaded.settings.renderer) {
            app.renderingManager.selectRenderer(loaded.settings.renderer === "textured");
         }
      }
      if (loaded.objects) GenericObject.all_objects = loaded.objects;
      Track.allTracks = loaded.tracks ? ArrayUtils.cleanUp(loaded.tracks) : []; //when something went wront while loading track, we filter all nulls
      Switch.allSwitches = loaded.switches ? ArrayUtils.cleanUp(loaded.switches) : []; //when something went wront while loading switch, we filter all nulls

      // Reset counters
      Track.counter = Track.allTracks.length ? Math.max(...Track.allTracks.map((t) => t.id)) + 1 : 0;
      Switch.counter = Switch.allSwitches.length ? Math.max(...Switch.allSwitches.map((s) => s.id)) + 1 : 0;

      STORAGE.linkObjects();

      Track.createRailNetwork();
      Train.allTrains = loaded.trains ? ArrayUtils.cleanUp(loaded.trains) : []; ////when something went wront while loading trains, we filter all nulls
      Train.allTrains.forEach((t) => t.restore());
      Train.allTrains.forEach((t) => {
         delete t.trainCoupledFrontId;
         delete t.trainCoupledBackId;
      });
      Train.allTrains = Train.allTrains.filter((t) => t.track != null);
   },

   saveUndoHistory() {
      Application.getInstance().undoHistory.push(STORAGE.getJSONString(false));
      if (Application.getInstance().undoHistory.length > CONFIG.MOST_UNDO) Application.getInstance().undoHistory.shift();

      Application.getInstance().uiManager.updateUndoButtonState();
   },

   save() {
      localStorage.setItem(STORAGE.STORAGE_IDENT, STORAGE.getSaveString());
   },

   loadRecent() {
      try {
         const x = localStorage.getItem(STORAGE.STORAGE_IDENT);
         if (x != null) {
            const indexOfFirst = x.indexOf(";");
            if (indexOfFirst > -1) {
               const loaded_version = parseFloat(x.substring(0, indexOfFirst));
               if (loaded_version >= STORAGE.MIN_STORAGE_VERSION) STORAGE.loadFromJson(x.slice(indexOfFirst + 1));
               else console.error(`stored version ${loaded_version} to old`);
            } else throw new Error("Version Tag is missing");
            STORAGE.saveUndoHistory();
         }
      } catch (error) {
         ui.showErrorToast(error);
      }
      Application.getInstance().uiManager.updateUndoButtonState();
   },

   loadPrebuildbyName(name) {
      return new Promise((resolve, reject) => {
         let xmlhttp = new XMLHttpRequest();
         xmlhttp.onreadystatechange = function () {
            if (this.readyState == 4 && this.status == 200) {
               let i;
               let xmlDoc = this.responseXML;

               let x = xmlDoc.getElementsByTagName("setup");
               for (i = 0; i < x.length; i++) {
                  if (x[i].getElementsByTagName("title")[0].textContent == name) {
                     STORAGE.loadFromJson(x[i].getElementsByTagName("json")[0].childNodes[0].wholeText.trim());
                     resolve();
                  }
               }
            }
         };
         xmlhttp.open("GET", "prebuilds.xml" + "?" + Math.floor(Math.random() * 100), true);
         xmlhttp.send();
      });
   },

   downloadAsFile() {
      let xmlStr = `<?xml version="1.0" encoding="UTF-8"?>
      <setup>
      <date>${(new Date).toLocaleString()}</date>
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

   async restoreFromFile() {
      return new Promise((resolve, reject) => {
         let input = document.createElement('input');
         input.type = 'file';
         input.accept = "text/xml";
         input.onchange = e => {
            if (input.files.length == 0) {
               ui.showErrorToast(new Error("keine datei hochgeladen!"));
               reject(new Error("keine datei hochgeladen!"));
               return;
            }

            let file = input.files[0];

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

            let reader = new FileReader();
            reader.readAsText(file, 'UTF-8');

            reader.onload = readerEvent => {
               try {
                  let content = readerEvent.target.result;
                  let xmlDoc = (new DOMParser()).parseFromString(content, "text/xml");
                  let json = xmlDoc.getElementsByTagName("json")[0].childNodes[0].nodeValue;
                  let version = xmlDoc.getElementsByTagName("version")[0].childNodes[0].nodeValue;
                  if (version < STORAGE.MIN_STORAGE_VERSION) {
                     ui.showErrorToast(new Error("Diese Datei ist zu alt!"));
                     reject(new Error("Diese Datei ist zu alt!"));
                     return;
                  }
                  STORAGE.loadFromJson(json);
                  resolve();
               } catch (err) {
                  ui.showErrorToast(err);
                  reject(err);
               }
            };

            reader.onerror = err => {
               ui.showErrorToast(err);
               reject(err);
            };
         };
         input.click();
      });
   }, 
  
  
};

 