const STORAGE = {
   MIN_STORAGE_VERSION: 0.5,
   STORAGE_IDENT: "bahnhof_last1",

   classMap: {
      Track: Track,
      Switch: Switch,
      Signal: Signal,
      Train: Train,
      GenericObject: GenericObject,
   },

   receiver(key, value) {
      if (value?._class && STORAGE.classMap[value._class]) {
         const MyClass = STORAGE.classMap[value._class];
         const instance = MyClass.FromObject(value);
         if (instance == null) showErrorToast(new Error("error loading " + key));
         return instance;
      }
      return value;
   },

   replacer(key, value) {
      return typeof value?.stringify === "function" ? value.stringify() : value;
   },

   getSaveString() {
      return (
         VERSION +
         ";" +
         JSON.stringify(
            {
               tracks: Track.allTracks,
               trains: Train.allTrains,
               switches: Switch.allSwitches,
               objects: GenericObject.all_objects,
               settings: {
                  zoom: stage.scale,
                  scrollX: stage.x,
                  scrollY: stage.y,
                  renderer: renderer instanceof trackRendering_textured ? "textured" : "basic",
               },
            },
            STORAGE.replacer
         )
      );
   },

   restoreLastUndoStep() {
      if (undoHistory.length <= 1) return;
      undoHistory.pop();
      const last = undoHistory.last();
      if (last) {
         STORAGE.loadFromJson(last);
      } else Track.allTracks = [];

      updateUndoButtonState();
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
      RENDERING.clear();
      let loaded = JSON.parse(json, STORAGE.receiver);
      if (loaded.settings) {
         stage.x = loaded.settings.scrollX;
         stage.y = loaded.settings.scrollY;
         stage.scale = loaded.settings.zoom;
         if (loaded.settings.renderer) {
            selectRenderer(loaded.settings.renderer === "textured");
         }
      }
      if (loaded.objects) GenericObject.all_objects = loaded.objects;
      Track.allTracks = loaded.tracks?.clean() || []; //when something went wront while loading track, we filter all nulls
      Switch.allSwitches = loaded.switches?.clean() || []; //when something went wront while loading switch, we filter all nulls

      // Reset counters
      Track.counter = Track.allTracks.length ? Math.max(...Track.allTracks.map((t) => t.id)) + 1 : 0;
      Switch.counter = Switch.allSwitches.length ? Math.max(...Switch.allSwitches.map((s) => s.id)) + 1 : 0;

      STORAGE.linkObjects();

      Track.createRailNetwork();
      Train.allTrains = loaded.trains?.clean() || []; ////when something went wront while loading trains, we filter all nulls
      Train.allTrains.forEach((t) => t.restore());
      Train.allTrains.forEach((t) => {
         delete t.trainCoupledFrontId;
         delete t.trainCoupledBackId;
      });
      Train.allTrains = Train.allTrains.filter((t) => t.track != null);
   },

   saveUndoHistory() {
      undoHistory.push(JSON.stringify({ tracks: Track.allTracks, objects: GenericObject.all_objects }, STORAGE.replacer));
      if (undoHistory.length > MOST_UNDO) undoHistory.shift();

      updateUndoButtonState();
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
         showErrorToast(error);
      }
      updateUndoButtonState();
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
}; 