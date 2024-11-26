"use strict";

const VERSION = "0.43";

const MODE_PLAY = 1;
const MODE_EDIT = 2;

const GRID_SIZE = 100;
const GRID_SIZE_2 = GRID_SIZE / 2;

const SNAP_2_GRID = 30;
const MAX_SCALE = 5;
const MIN_SCALE = 0.2;

const MOST_UNDO = 20;

const DIRECTION = {
   LEFT_2_RIGTH: 1,
   RIGHT_2_LEFT: -1,
};

const MOUSE_DOWN_ACTION = {
   NONE: 0,
   SCROLL: 1,
   BUILD_TRACK: 2,
   MOVE_ITEM: 3,
   DND_SIGNAL: 4,
   ADD_TRAIN: 5,
   MOVE_TRAIN: 6,
   MOVE_OBJECT: 7,
   CUSTOM: 8,
};

const CUSTOM_MOUSE_ACTION = {
   NONE: 0,
   DRAWING: 1,
   TEXT: 2,
   PLATTFORM: 3,
};

const SWITCH_TYPE = {
   NONE: 0,
   TO_RIGHT: 2, //45°
   FROM_RIGHT: 4, //135°
   FROM_LEFT: 6, //225°
   TO_LEFT: 8, //315°
   DKW: 9,
   CROSSING: 10,
};

const MENU = {
   EDIT_SIGNAL: 0,
   NEW_SIGNAL: 1,
   EDIT_TRAIN: 2,
   NEW_TRAIN: 3,
   NEW_OBJECT: 4,
   EDIT_OBJECT: 5,
};

var stage,
   debug_container,
   main_container,
   overlay_container,
   ui_container,
   signal_container,
   track_container,
   train_container,
   drawing_container,
   object_container,
   grid;

var previousTouch;
var showGrid = true;
var edit_mode = true;
var custom_mouse_mode = CUSTOM_MOUSE_ACTION.NONE;
var pl;
var mouseAction = null;
var loadQueue;

var renderer;

var tracks = [];
var switches = [];

var undoHistory = ["[]"];

var signalTemplates = {};

var selection = {
   type: "",
   object: null,
   isSelectedObject: function (test) {
      if (!test || !this.object || this.type != type(test)) return false;
      if (Array.isArray(this.object)) return this.object.includes(test);
      else return this.object === test;
   },
};

$(() => {
   init();
});

function init() {
   try {
      pl = new preLoader("images");
      initSignals();

      pl.addImage("schwellen.png", "schwellen");
      pl.addImage("dkw2.svg", "dkw");
      pl.addImage("weiche2.svg", "weiche");
      pl.addImage("bumper1.svg", "bumper");
   } catch (error) {
      showErrorToast(error);
   }

   stage = new createjs.Stage(myCanvas);
   stage.autoClear = true;
   stage.enableDOMEvents(true);
   /* console.log(createjs.Touch.isSupported());
    if (createjs.Touch.isSupported())
        createjs.Touch.enable(stage); */
   createjs.Ticker.framerate = 1;

   const create_container = (n) => {
      let c = new createjs.Container();
      c.name = n;
      c.mouseChildren = true;
      return c;
   };

   stage.addChild((main_container = create_container("main")));
   stage.addChild((debug_container = create_container("debug")));
   main_container.addChild((track_container = create_container("tracks")));
   main_container.addChild((object_container = create_container("objects")));
   main_container.addChild((train_container = create_container("trains")));
   main_container.addChild((signal_container = create_container("signals")));
   stage.addChild((ui_container = create_container("ui")));
   stage.addChild((overlay_container = create_container("overlay")));
   stage.addChild((drawing_container = create_container("drawing_container")));

   UI.ShowPreBuildScreen();

   pl.start().then(() => {
      console.log(`Preloader: ${pl._loadedItems}/${pl._totalItems}`);
      const id = "#newItemMenuAccordination";
      try {
         $(id).append([
            BS.createAccordionItem(
               "Hauptsignale",
               id,
               UI.newItemButtons(signalTemplates.hv_hp, signalTemplates.ks, signalTemplates.ls, signalTemplates.zusatzSignal),
               true
            ),

            BS.createAccordionItem("Vorsignale", id, UI.newItemButtons(signalTemplates.hv_vr, signalTemplates.ks_vr)),
            BS.createAccordionItem("Lf-Signale", id, UI.newItemButtons(signalTemplates.lf6, signalTemplates.lf7)),
            BS.createAccordionItem("Ne-Signale", id, UI.newItemButtons(signalTemplates.ne4, signalTemplates.ne1, signalTemplates.ne2)),
            BS.createAccordionItem(
               "Weitere",
               id,
               UI.newItemButtons(signalTemplates.zs3, signalTemplates.zs6, signalTemplates.zs10, signalTemplates.ra10)
            ),
         ]);

         selectRenderer(true);
         //loadRecent();
      } catch (error) {
         showErrorToast(error);
      }
   });

   createjs.Ticker.addEventListener("tick", stage);

   stage.addEventListener("stagemousedown", handleStageMouseDown);
   stage.addEventListener("stagemouseup", handleStageMouseUp);

   myCanvas.oncontextmenu = () => false;
   myCanvas.addEventListener("wheel", (event) => {
      event.preventDefault();
      if (!myCanvas.prevent_input) {
         myCanvas.prevent_input = true;
         let point = new createjs.Point(stage.mouseX, stage.mouseY);
         let localPoint = stage.globalToLocal(point.x, point.y);
         let old_scale = stage.scale;
         let step = event.deltaY / (1000 / stage.scale);
         stage.scale -= step;
         stage.scale = Math.min(Math.max(MIN_SCALE, stage.scale), MAX_SCALE);

         if (stage.scale != old_scale) {
            //if we reached MIN or MAX, the scale value doesnt change anymore
            // Find where the original point is now
            let globalPoint = stage.localToGlobal(localPoint.x, localPoint.y);
            // Move the map by the difference
            stage.x -= globalPoint.x - point.x;
            stage.y -= globalPoint.y - point.y;
            RENDERING.drawGrid();
            renderer.reDrawEverything();
            stage.update();
            STORAGE.save();
         }
         myCanvas.prevent_input = false;
      }
   });
   if (createjs.Touch.isSupported()) {
      myCanvas.addEventListener("touchstart", (event) => {
         if (event.touches.length === 1) {
            let touch = event.touches[0];
            //startTrackDrawing(stage.globalToLocal(touch.clientX, touch.clientY));
         }

         /* console.log("touch:" + event.touches.length);
            for (let index = 0; index < event.touches.length; index++) {
                const item = event.touches[index];
                console.log("x:" + item.clientX + ":" + item.clientY);
            } */
      });

      myCanvas.addEventListener("touchmove", (event) => {
         if (event.touches.length === 1) {
            let touch = event.touches[0];

            if (previousTouch) {
               // be aware that these only store the movement of the first touch in the touches array
               stage.x += touch.clientX - previousTouch.clientX;
               stage.y += touch.clientY - previousTouch.clientY;

               RENDERING.drawGrid(false);
               renderer.reDrawEverything();
            }

            previousTouch = touch;
         }
      });
   }

   $("#btnDrawTracks,#btnPlay").click(() => toggleEditMode());

   $("#switch_renderer").on("change", (e) => {
      selectRenderer(!$("#switch_renderer").is(":checked"));
   });

   $("#btnAddSignals").click(() => UI.showMenu(MENU.NEW_SIGNAL));
   $("#btnAddTrain").click(() => UI.showMenu(MENU.NEW_TRAIN));
   $("#btnAddObject").click(() => UI.showMenu(MENU.NEW_OBJECT));

   $("#btnClear").click(() => {
      RENDERING.clear();
   });

   $("#btnCenter").click(() => {
      RENDERING.center();
   });

   $("#btnImage").click((e) => {
      let backup = { x: stage.x, y: stage.y, scale: stage.scale };

      try {
         const custom_scale = 2;
         stage.enableDOMEvents(false);

         stage.scale = custom_scale;

         renderer.reDrawEverything(true, true);

         let bounds = main_container.getBounds();
         if (!bounds) {
            showInfoToast("Nix zu sehen");
            return;
         }
         const anotherCanvas = $("<canvas>", { id: "test" })
            .attr("width", bounds.width * custom_scale)
            .attr("height", bounds.height * custom_scale);
         stage.canvas = anotherCanvas[0];
         stage.x = bounds.x * -custom_scale;
         stage.y = bounds.y * -custom_scale;
         grid.visible = false;
         drawing_container.visible = false;
         ui_container.visible = false;
         stage.update();

         let img_data = stage.toDataURL("#00000000", "image/png");
         const img = $("<img>", { src: img_data, width: "100%" }).css("object-fit", "scale-down").css("max-height", "50vh");
         ui.showModalDialog(img, (e) => {
            const a = $("<a>", { download: "gleisplan.png", href: img_data });
            a[0].click();
         });
      } catch (error) {
         showErrorToast(error);
      } finally {
         stage.x = backup.x;
         stage.y = backup.y;
         stage.scale = backup.scale;
         stage.canvas = myCanvas;
         grid.visible = showGrid;
         drawing_container.visible = true;
         ui_container.visible = true;
         renderer.reDrawEverything(true);
         stage.enableDOMEvents(true);
         stage.update();
      }
   });

   $("#btnDraw").click((e) => {
      custom_mouse_mode = $("#btnDraw").hasClass("active") ? CUSTOM_MOUSE_ACTION.DRAWING : CUSTOM_MOUSE_ACTION.NONE;
      const bsOffcanvas = bootstrap.Offcanvas.getOrCreateInstance(document.getElementById("drawingPanel"));
      if (custom_mouse_mode === CUSTOM_MOUSE_ACTION.DRAWING) {
         bsOffcanvas.show();
      } else {
         bsOffcanvas.hide();
      }
   });

   $("#btnDrawingClear").click((e) => {
      drawing_container.removeAllChildren();
      stage.update();
   });

   $("#btnGrundstellung").click((e) => {
      if (selection.type == "Signal") {
         [].concat(selection.object).forEach((s) => {
            s._signalStellung = {};
            if (s._template.initialSignalStellung) s._template.initialSignalStellung.forEach((i) => s.set_stellung(i, null, true));
            STORAGE.save();
            renderer.reDrawEverything(true);
            stage.update();
         });
      }
   });

   $("#btnRemoveSignal").click((e) => {
      deleteSelectedObject();
   });
   $("#btnUndo").click((e) => {
      undo();
   });

   document.addEventListener("keydown", (e) => {
      if (e.target.tagName != "INPUT" && e.code == "Delete") {
         deleteSelectedObject();
      }
   });

   $("#signalEditMenuHeader a").on("click", () => {
      $("#signalEditMenuHeader .card-text").hide();
      $("#signalEditMenuHeader input")
         .val(selection.object.get("bez"))
         .show()
         .focus()
         .on("keydown", function (e) {
            if (e.key === "Enter") {
               selection.object.set_stellung("bez", $(this).val());
               $("#signalEditMenuHeader .card-text").show();
               $("#signalEditMenuHeader input").hide();
               Sig_UI.syncSignalMenu(selection.object);
               STORAGE.save();
               renderer.reDrawEverything(true);
               stage.update();
            }
         })
         .on("blur", () => {
            $("#signalEditMenuHeader .card-text").show();
            $("#signalEditMenuHeader input").hide();
         });
   });

   onResizeWindow();
   toggleEditMode(edit_mode);

   $(window).resize(onResizeWindow);
   myCanvas.focus();
}

function deleteSelectedObject() {
   if (selection.object) {
      if (selection.type == "Track") {
         [].concat(selection.object).forEach((t) => tracks.remove(t));
         Track.cleanupTracks();
         Track.connectTracks();
         STORAGE.saveUndoHistory();
      }
      if (selection.type == "Signal") [].concat(selection.object).forEach((s) => Signal.removeSignal(s, null));
      STORAGE.save();
      renderer.reDrawEverything(true);
      stage.update();
      selectObject();
   }
}

function undo() {
   STORAGE.restoreLastUndoStep();
   renderer.reDrawEverything(true);
   stage.update();
}

const RENDERING = {
   clear() {
      tracks = [];
      switches = [];
      Train.allTrains = [];
      GenericObject.all_objects = [];

      STORAGE.save();
      renderer.reDrawEverything(true); //just to make sure, something accidently not deleted we be drawn to the stage.
      stage.update();
   },
   center() {
      stage.scale = 1;
      stage.x = 0;
      stage.y = 0;
      STORAGE.save();
      RENDERING.drawGrid();
      renderer.reDrawEverything();
      stage.update();
   },
   drawGrid(repaint = true) {
      if (!grid) {
         grid = new createjs.Shape();
         grid.name = "grid";
         grid.mouseEnabled = false;
         stage.addChildAt(grid, 0);
         grid.graphics.setStrokeStyle(1, "round");
      }
      grid.visible = showGrid;
      if (showGrid) {
         if (repaint) {
            grid.graphics.c().setStrokeStyle(1, "round").setStrokeDash([5, 5], 2).beginStroke("#ccc");

            const bounds = stage.canvas.getBoundingClientRect();
            const scale = stage.scale;
            const size = {
               width: bounds.width / scale,
               height: bounds.height / scale,
            };
            let x = 0;
            while (x < size.width) {
               grid.graphics.moveTo(x, -GRID_SIZE).lineTo(x, size.height);
               x += GRID_SIZE;
            }

            let y = 0;
            while (y < size.height) {
               grid.graphics.moveTo(-GRID_SIZE, y).lineTo(size.width, y);
               y += GRID_SIZE;
            }
            grid.cache(-GRID_SIZE, -GRID_SIZE, size.width + GRID_SIZE * scale, size.height + GRID_SIZE * scale, scale);
         }
         const scaled_grid_size = GRID_SIZE * stage.scale;
         grid.x = Math.floor(stage.x / scaled_grid_size) * -GRID_SIZE;
         grid.y = Math.floor(stage.y / scaled_grid_size) * -GRID_SIZE;
      }
   },
};

const UI = {
   ///Shows the menu on the right.
   /// menu==null just hides it.
   showMenu(menu) {
      var bsOffcanvas = bootstrap.Offcanvas.getOrCreateInstance($("#sidebar"));
      $("input,button", bsOffcanvas._element).off();

      if (nll(menu)) {
         bsOffcanvas.hide();
         return;
      }
      const current_id = $('#sidebar>div:not([style*="display: none"])');
      let div_id;
      switch (menu) {
         case MENU.EDIT_SIGNAL:
            div_id = "signalEditMenu";
            let body = $("#nav-home");
            body.empty();
            body.append(Sig_UI.getHTML(selection.object));
            Sig_UI.initSignalMenu();
            Sig_UI.syncSignalMenu(selection.object);
            break;
         case MENU.NEW_SIGNAL:
            div_id = "newItemMenu";
            break;
         case MENU.EDIT_TRAIN:
            div_id = "editTrainMenu";
            Train.initEditTrainMenu(selection.object);
            break;
         case MENU.NEW_TRAIN:
            div_id = "newTrainMenu";
            $("#newTrain").on("mousedown", (e) => {
               mouseAction = {
                  action: MOUSE_DOWN_ACTION.ADD_TRAIN,
               };

               //mouseup beim document anmelden, weil mouseup im stage nicht ausgelöst wird, wenn mousedown nicht auch auf der stage war
               //little hack, weil handleStageMouseUp ein event von createjs erwartet
               document.addEventListener("mouseup", (e) => handleStageMouseUp({ nativeEvent: e }), {
                  once: true,
               });

               stage.addEventListener("stagemousemove", handleMouseMove);

               let local_point = stage.globalToLocal(stage.mouseX, stage.mouseY);
               mouseAction.container = new createjs.Bitmap("zug.png").set({
                  x: local_point.x,
                  y: local_point.y,
                  scale: 0.5,
                  regY: 96 / 2,
               });

               overlay_container.addChild(mouseAction.container);
            });
            break;
         case MENU.NEW_OBJECT:
            div_id = "newObjectMenu";
            $("#btnAddText").click(() => {
               custom_mouse_mode = $("#btnAddText").hasClass("active") ? CUSTOM_MOUSE_ACTION.TEXT : CUSTOM_MOUSE_ACTION.NONE;
               UI.activate_custom_mouse_mode();
            });
            $("#btnAddPlatform").click(() => {
               custom_mouse_mode = $("#btnAddPlatform").hasClass("active") ? CUSTOM_MOUSE_ACTION.PLATTFORM : CUSTOM_MOUSE_ACTION.NONE;
               UI.activate_custom_mouse_mode();
            });
            break;
         case MENU.EDIT_OBJECT:
            div_id = "editObjectMenu";
            GenericObject.initEditMenu(selection.object);
            break;
         default:
            throw new Error("unknown Menu");
      }

      $("#sidebar > div")
         .not("#" + div_id)
         .hide();
      $("#sidebar > #" + div_id).show();

      bsOffcanvas.show();
      if (bsOffcanvas._isShown) {
         //bsOffcanvas.show();
      } else {
         //bsOffcanvas.hide();
      }
   },

   activate_custom_mouse_mode() {
      switch (custom_mouse_mode) {
         case CUSTOM_MOUSE_ACTION.TEXT:
            myCanvas.style.cursor = "text";
            break;
         default:
            myCanvas.style.cursor = "auto";
      }
   },

   ShowPreBuildScreen() {
      if (localStorage.getItem("bahnhof_last1") == null) $(btnLoadRecent).attr("disabled", "disabled");
      $(btnStartFromZero).click(UI.hideStartScreen);
      $(btnLoadRecent).click(() => {
         STORAGE.loadRecent();
         UI.hideStartScreen();
         RENDERING.drawGrid();
         renderer.reDrawEverything(true);
         STORAGE.saveUndoHistory();
      });
      $("#btnLoad2Gleisig,#btnLoad1Gleisig").on("click", (e) => {
         const name = $(e.target).attr("data");
         STORAGE.loadPrebuildbyName(name).then(() => {
            UI.hideStartScreen();
            RENDERING.drawGrid();
            renderer.reDrawEverything(true);
            STORAGE.saveUndoHistory();
         });
      });
      /*$(btnLoadFromFile).click(() => { loadSignalsFromFile(); hideStartScreen(); });
       loadPrebuilds(); */
      let m = bootstrap.Modal.getOrCreateInstance(loadModal);
      m._element.addEventListener(
         "hidden.bs.modal",
         (x) => {
            bootstrap.Modal.getOrCreateInstance(x.target).dispose();
            $(btnStartFromZero).off("click");
            $(btnLoadRecent).off("click");
            $(btnLoadFromFile).off("click");
         },
         { once: true }
      );
      m.show();
   },

   hideStartScreen() {
      $("myCanvas").focus();
      bootstrap.Modal.getInstance(loadModal).hide();
   },

   newItemButtons(...templates) {
      return templates.map((t) =>
         ui
            .div("d-flex newSignalItem align-items-center user-select-none", [
               ui
                  .div("flex-shrink-0 newItem_image")
                  .css("background-image", "url(" + UI.GetDataURL_FromTemplate(t) + ")")
                  .css("background-size", t.previewsize ?? 45),
               ui.div("flex-grow-5 ms-2", t.title),
            ])
            .on("mousedown", (e) => {
               mouseAction = {
                  action: MOUSE_DOWN_ACTION.DND_SIGNAL,
                  template: t,
               };

               //mouseup beim document anmelden, weil mouseup im stage nicht ausgelöst wird, wenn mousedown nicht auch auf der stage war
               //little hack, weil handleStageMouseUp ein event von createjs erwartet
               document.addEventListener("mouseup", (e) => handleStageMouseUp({ nativeEvent: e }), {
                  once: true,
               });
               stage.addEventListener("stagemousemove", handleMouseMove);
               startDragAndDropSignal(e.offsetX, e.offsetY);
            })
      );
   },

   GetDataURL_FromTemplate(template) {
      const tmpStage = new createjs.Stage($("<canvas>").attr({ width: 450, height: 450 })[0]);
      tmpStage.scale = template.scale;
      new Signal(template).draw(tmpStage, true);
      tmpStage.update();
      const sig_bounds = tmpStage.getBounds();
      if (sig_bounds == null) throw Error(template.title + " has no visual Element visible");
      tmpStage.cache(sig_bounds.x, sig_bounds.y, sig_bounds.width, sig_bounds.height, 0.5);
      return tmpStage.bitmapCache.getCacheDataURL();
   },
};

function toggleEditMode(mode) {
   edit_mode = mode != undefined ? mode : $(btnDrawTracks).is(":checked");
   showGrid = edit_mode;
   RENDERING.drawGrid();
   stage.update();
   if (mode != undefined) $(btnDrawTracks).prop(":checked", edit_mode);
}

function selectRenderer(textured) {
   if (textured) {
      renderer = new trackRendering_textured();
      $("#switch_renderer").prop(":checked", false);
   } else {
      renderer = new trackRendering_basic();
      $("#switch_renderer").prop(":checked", true);
   }
   renderer.reDrawEverything(true);
   stage.update();
}

function selectObject(object, e) {
   if (!object) {
      selection.object = null;
      selection.type = "";
      renderer.updateSelection();
      UI.showMenu();
      return;
   }
   const t = type(object);

   if (t != selection.type) {
      selection.object = object;
      selection.type = t;
   } else {
      if (e?.nativeEvent?.ctrlKey) selection.object = Array.isArray(selection.object) ? [...selection.object, object] : [selection.object, object];
      else selection.object = object;
   }
   renderer.updateSelection();

   let menu;
   switch (t) {
      case "Signal":
         if (!Array.isArray(selection.object)) menu = MENU.EDIT_SIGNAL;
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

   UI.showMenu(menu);
}

function onResizeWindow() {
   $(myCanvas).attr("height", $(CanvasContainer).height() - 5);
   $(myCanvas).attr("width", $(CanvasContainer).width());
   RENDERING.drawGrid();
   stage.update();
}

function handleStageMouseDown(event) {
   //console.log("handleStageMouseDown", event);

   let hittest = getHitTest();

   //console.log(hittest ? hittest : "nothing hit");

   mouseAction = {
      action: custom_mouse_mode != CUSTOM_MOUSE_ACTION.NONE ? MOUSE_DOWN_ACTION.CUSTOM : MOUSE_DOWN_ACTION.NONE,
      container: hittest,
      startPoint: stage.globalToLocal(stage.mouseX, stage.mouseY),
      _distancePoint: new Point(event.stageX, event.stageY),
      offset: hittest?.globalToLocal(stage.mouseX, stage.mouseY), //Koordinate auf dem angeklickten Object (zb Signal), damit der Container am Mauszeiger "klebt"
      distance: function () {
         return geometry.distance(this._distancePoint, new Point(stage.mouseX, stage.mouseY));
      },
   };

   if (custom_mouse_mode == CUSTOM_MOUSE_ACTION.DRAWING) {
      const color = document.querySelector('input[name="DrawingColor"]:checked').value;
      const width = document.querySelector('input[name="DrawingWidth"]:checked').value;

      drawing_container.addChild((mouseAction.shape = new createjs.Shape()));
      mouseAction.shape.graphics.setStrokeStyle(width, "round", "round").beginStroke(color);
      mouseAction.old_point = new Point(event.stageX, event.stageY);
   }
   //console.log(mouseAction);
   stage.addEventListener("stagemousemove", handleMouseMove);
}

function getHitTest(container) {
   let local_point = stage.globalToLocal(stage.mouseX, stage.mouseY);

   return (container ? container : stage).getObjectUnderPoint(local_point.x, local_point.y, 1);
}

function getHitInfoForSignalPositioning(testPoint) {
   let circle = { x: testPoint.x, y: testPoint.y, radius: GRID_SIZE / 2 };
   let box, result;
   for (const track of tracks) {
      if (testPoint.x.between(track.start.x, track.end.x)) {
         box = TOOLS.createBoxFromLine(track.start, track.end, track._tmp.unit, GRID_SIZE_2);
         if (isPointInsideBox(testPoint, box, track._tmp.rad))
            if ((result = TOOLS.LineIsInCircle(track, circle))) {
               result.track = track;
               result.above = result.point.y > circle.y;
               return result;
            }
      }
   }
}

function createSignalContainer(signal) {
   let c = new createjs.Container();
   c.name = "signal";
   c.data = signal;
   c.mouseChildren = false;
   c.snapToPixel = true;
   c.scale = signal._template.scale;

   signal.draw(c, true);
   let sig_bounds = c.getBounds();
   if (sig_bounds) {
      // schläft fehl, wenn nichts gezeichnet wurde
      let hit = new createjs.Shape();
      hit.graphics.beginFill("#000").drawRect(sig_bounds.x, sig_bounds.y, sig_bounds.width, sig_bounds.height);
      c.hitArea = hit;

      c.regX = sig_bounds.width / 2 + sig_bounds.x;
      c.regY = sig_bounds.height + sig_bounds.y;
   } else console.error("Wahrscheinlich fehler beim Zeichen des Signals!");

   return c;
}

function alignSignalContainerWithTrack(c) {
   const pos = c.data._positioning;
   //koordinaten anhand des Strecken KM suchen
   const coordinates = geometry.add(pos.track.getPointfromKm(pos.km), pos.track.start);
   let p;
   if (pos.above) {
      c.rotation = 270 + pos.track._tmp.deg;
      p = geometry.perpendicular(coordinates, pos.track._tmp.deg, -renderer.SIGNAL_DISTANCE_FROM_TRACK - c.data._template.distance_from_track);
   } else {
      c.rotation = 90 + pos.track._tmp.deg;
      p = geometry.perpendicular(coordinates, pos.track._tmp.deg, renderer.SIGNAL_DISTANCE_FROM_TRACK + c.data._template.distance_from_track);
   }
   if (pos.flipped) c.rotation += 180;

   c.x = p.x;
   c.y = p.y;
}

function startDragAndDropSignal(mouseX, mouseY) {
   if (mouseAction.container) {
      mouseAction.container.parent.removeChild(mouseAction.container);
   } else {
      let signal = new Signal(mouseAction.template);
      mouseAction.container = createSignalContainer(signal);
      mouseAction.container.x = mouseX;
      mouseAction.container.y = mouseY;
   }

   overlay_container.addChild(mouseAction.container);
   stage.update();
}

function handleMouseMove(event) {
   //console.log("handleMouseMove", event);
   if (!event.primary) {
      return;
   }
   if (mouseAction == null) {
      stage.removeEventListener("stagemousemove", handleMouseMove);
      return;
   }
   //falls mouseMove noch läuft, obwohl der User keinen button mehr drückt
   //tritt vor allem beim debugging auf
   if (event.nativeEvent.buttons == 0) {
      console.log("debug mouse error");
      return handleStageMouseUp(event);
   }

   let local_point = stage.globalToLocal(stage.mouseX, stage.mouseY);
   //console.log(local_point, { x: stage.mouseX, y: stage.mouseY });

   if (mouseAction.action === MOUSE_DOWN_ACTION.NONE) {
      //wie weit wurde die maus seit mousedown bewegt
      if (mouseAction.distance() > 4) {
         if (event.nativeEvent.buttons == 1) {
            if (edit_mode) {
               if (mouseAction.container?.name == "signal") {
                  myCanvas.style.cursor = "move";
                  mouseAction.action = MOUSE_DOWN_ACTION.DND_SIGNAL;
                  mouseAction.container.data._positioning.track.removeSignal(mouseAction.container.data);
                  startDragAndDropSignal();
               } else if (mouseAction.container?.name == "object") {
                  myCanvas.style.cursor = "move";

                  mouseAction.action = MOUSE_DOWN_ACTION.MOVE_OBJECT;
               } else {
                  mouseAction.lineShape = new createjs.Shape();
                  overlay_container.addChild(mouseAction.lineShape);
                  setTrackAnchorPoints();
                  mouseAction.action = MOUSE_DOWN_ACTION.BUILD_TRACK;
               }
            } else {
               if (mouseAction.container?.name == "train") {
                  mouseAction.action = MOUSE_DOWN_ACTION.MOVE_TRAIN;
               }
            }
         } else if (event.nativeEvent.buttons == 2) {
            //stage.addEventListener("stagemousemove", handleMouseMove);
            mouseAction.action = MOUSE_DOWN_ACTION.SCROLL;
         }
      }
   }
   if (mouseAction.action === MOUSE_DOWN_ACTION.CUSTOM) {
      if (custom_mouse_mode == CUSTOM_MOUSE_ACTION.DRAWING) {
         mouseAction.shape.graphics.mt(mouseAction.startPoint.x, mouseAction.startPoint.y).lt(local_point.x, local_point.y);
         mouseAction.startPoint.x = local_point.x;
         mouseAction.startPoint.y = local_point.y;
      } else if (custom_mouse_mode == CUSTOM_MOUSE_ACTION.PLATTFORM) {
         overlay_container.removeAllChildren();
         overlay_container.addChild((mouseAction.shape = new createjs.Shape()));
         mouseAction.shape.graphics
            .beginStroke("#111111")
            .drawRect(
               mouseAction.startPoint.x,
               mouseAction.startPoint.y,
               local_point.x - mouseAction.startPoint.x,
               local_point.y - mouseAction.startPoint.y
            );
         stage.update();
      }
   }
   if (mouseAction.action === MOUSE_DOWN_ACTION.MOVE_OBJECT) {
      const o = mouseAction.container.object;
      o.pos(local_point);
      if (mouseAction.offset) {
         let p = mouseAction.container.localToLocal(mouseAction.offset.x, mouseAction.offset.y, stage);
         local_point.x -= p.x - mouseAction.container.x;
         local_point.y -= p.y - mouseAction.container.y;
      }
      mouseAction.container.x = local_point.x;
      mouseAction.container.y = local_point.y;
   } else if (mouseAction.action === MOUSE_DOWN_ACTION.DND_SIGNAL) {
      dragnDropSignal(local_point, event.nativeEvent.altKey);
   } else if (mouseAction.action === MOUSE_DOWN_ACTION.BUILD_TRACK) {
      setTrackAnchorPoints();
      drawBluePrintTrack();
   } else if (mouseAction.action === MOUSE_DOWN_ACTION.SCROLL) {
      stage.x += event.nativeEvent.movementX;
      stage.y += event.nativeEvent.movementY;
      RENDERING.drawGrid(false);
      renderer.reDrawEverything();
   } else if (mouseAction.action === MOUSE_DOWN_ACTION.MOVE_TRAIN) {
      Train.moveTrain(mouseAction.container.train, event.nativeEvent.movementX);
      renderer.reDrawEverything();
   } else if (mouseAction.action === MOUSE_DOWN_ACTION.ADD_TRAIN) {
      mouseAction.container.x = local_point.x;
      mouseAction.container.y = local_point.y;
   }

   stage.update();
}

function dragnDropSignal(local_point, flipped) {
   let hitInformation = getHitInfoForSignalPositioning(local_point);
   if (hitInformation) {
      mouseAction.hit_track = hitInformation;
      mouseAction.container.data._positioning = {
         track: hitInformation.track,
         km: hitInformation.km,
         above: hitInformation.above,
         flipped: flipped,
      };
      alignSignalContainerWithTrack(mouseAction.container);
   } else {
      mouseAction.hit_track = null;
      mouseAction.container.rotation = 0;
      if (mouseAction.offset) {
         let p = mouseAction.container.localToLocal(mouseAction.offset.x, mouseAction.offset.y, stage);
         local_point.x -= p.x - mouseAction.container.x;
         local_point.y -= p.y - mouseAction.container.y;
      }
      mouseAction.container.x = local_point.x;
      mouseAction.container.y = local_point.y;
   }
   draw_SignalPositionLine();
}

function draw_SignalPositionLine() {
   let shape = overlay_container.getChildByName("SignalPositionLine");
   if (shape) overlay_container.removeChild(shape);

   if (mouseAction.hit_track) {
      const track = mouseAction.hit_track.track;
      const km = mouseAction.hit_track.km;
      const point = geometry.add(track.getPointfromKm(km), track.start);
      shape = new createjs.Shape();
      shape.name = "SignalPositionLine";
      shape.graphics.setStrokeStyle(1).beginStroke("#e00").mt(mouseAction.container.x, mouseAction.container.y).lt(point.x, point.y).es();
      overlay_container.addChild(shape);
   }
}

function drawBluePrintTrack() {
   if (mouseAction.ankerPoints == null || mouseAction.ankerPoints.length == 0) return;
   mouseAction.lineShape.graphics
      .c()
      .setStrokeStyle(trackRendering_basic.STROKE)
      .beginStroke("blue")
      .moveTo(mouseAction.ankerPoints[0].x, mouseAction.ankerPoints[0].y);
   for (let index = 1; index < mouseAction.ankerPoints.length; index++) {
      const co = mouseAction.ankerPoints[index];
      mouseAction.lineShape.graphics.lt(co.x, co.y);
   }
}

function setTrackAnchorPoints() {
   let local_point = stage.globalToLocal(stage.mouseX, stage.mouseY);

   const ankerPoints = mouseAction.ankerPoints;

   const current = new Point(Math.round(local_point.x / GRID_SIZE) * GRID_SIZE, Math.round(local_point.y / GRID_SIZE) * GRID_SIZE);

   if (ankerPoints == null || ankerPoints.length == 0) {
      mouseAction.ankerPoints = [current];
   } else {
      const last = ankerPoints.lastItem();
      //if (!local_point.x.closeToBy(GRID_SIZE, SNAP_2_GRID) || !local_point.y.closeToBy(GRID_SIZE, SNAP_2_GRID)) return;
      if (!last.equals(current)) {
         const slope = geometry.slope(last, current);
         if (ankerPoints.length == 1) {
            if (slope.is(1, 0, -1)) ankerPoints.push(current);
         } else {
            let direction = Math.sign(ankerPoints[1].x - ankerPoints[0].x);
            //haben wir den Punkt schon eingetragen?
            const y = current.x - GRID_SIZE * direction;
            const i = ankerPoints.findIndex((p) => Math.sign(p.x - y) == direction);

            if (i >= 0) {
               //bis zu diesem Punkt alle vorhandenen Punkte löschen und den aktuellen Punkt versuchen neu einzutragen
               ankerPoints.splice(i);
               setTrackAnchorPoints();
            } else {
               //checks for the right slope
               //no other straight or 45° and the previous slope and current slope musst not create a 90° angle
               if (slope.is(1, 0, -1) && (slope == 0 || slope + geometry.slope(last, ankerPoints[ankerPoints.length - 2]) != 0)) {
                  ankerPoints.push(current);
               }
            }
         }
      }
   }
}

function handleStageMouseUp(e) {
   //console.log("handleStageMouseUp", e);

   stage.removeEventListener("stagemousemove", handleMouseMove);
   myCanvas.style.cursor = "auto";
   if (mouseAction == null) return;

   let local_point = stage.globalToLocal(stage.mouseX, stage.mouseY);
   //left button
   if (e.nativeEvent.which == 1) {
      if (mouseAction.action === MOUSE_DOWN_ACTION.DND_SIGNAL) {
         overlay_container.removeChild(mouseAction.container);

         if (mouseAction.hit_track) {
            signal_container.addChild(mouseAction.container);
            mouseAction.hit_track.track.AddSignal(mouseAction.container.data);
         }
         STORAGE.save();
         STORAGE.saveUndoHistory();
         overlay_container.removeAllChildren();
         stage.update();
      } else if (mouseAction.action === MOUSE_DOWN_ACTION.BUILD_TRACK) {
         if (mouseAction.ankerPoints.length > 1) {
            let tmpPoint = mouseAction.ankerPoints[0];
            for (let i = 1; i < mouseAction.ankerPoints.length; i++) {
               const p0 = mouseAction.ankerPoints[i - 1];
               const p1 = mouseAction.ankerPoints[i];
               const p2 = mouseAction.ankerPoints.length > i + 1 ? mouseAction.ankerPoints[i + 1] : null;
               //steigung ändert sich, also track erstellen
               if (!p2 || geometry.slope(p0, p1) != geometry.slope(p1, p2)) {
                  Track.checkAndCreateTrack(tmpPoint, p1);
                  tmpPoint = p1;
               }
            }
            Track.cleanupTracks();
            Track.connectTracks();
            renderer.reDrawEverything(true);
            STORAGE.saveUndoHistory();
            STORAGE.save();
         }
         overlay_container.removeAllChildren();

         stage.update();
      } else if (mouseAction.action === MOUSE_DOWN_ACTION.ADD_TRAIN) {
         overlay_container.removeChild(mouseAction.container);
         const hit = getHitTest(track_container);
         if (hit?.name == "track") {
            const color = ["#ff0000", "#ffff00", "#00ff00", "#0000ff"].random();
            const track = hit.track;
            let train, car, car2;
            car = train = Train.addTrain(track, (local_point.x - track.start.x) / track._tmp.cos, color);
            Train.allTrains.push(train);
            for (let index = 0; index <= 2; index++) {
               car2 = Train.addTrain(track, (local_point.x - track.start.x) / track._tmp.cos, color);
               car.coupleBack(car2);
               car = car2;
            }
            Train.moveTrain(train, 0);
            renderer.reDrawEverything();
            stage.update();
            STORAGE.save();
         }
      } else if (mouseAction.action.is(MOUSE_DOWN_ACTION.MOVE_TRAIN, MOUSE_DOWN_ACTION.MOVE_OBJECT)) {
         STORAGE.save();
         STORAGE.saveUndoHistory();
      } else if (mouseAction.action === MOUSE_DOWN_ACTION.CUSTOM) {
         if (custom_mouse_mode == CUSTOM_MOUSE_ACTION.TEXT) {
            const o = new GenericObject(GenericObject.OBJECT_TYPE.text).pos(local_point).content("Text");
            GenericObject.all_objects.push(o);
            selectObject(o);
            renderer.renderAllGenericObjects();
            custom_mouse_mode = CUSTOM_MOUSE_ACTION.NONE;
            UI.activate_custom_mouse_mode();
            stage.update();
            STORAGE.saveUndoHistory();
            STORAGE.save();
         } else if (custom_mouse_mode == CUSTOM_MOUSE_ACTION.PLATTFORM) {
            overlay_container.removeAllChildren();
            const o = new GenericObject(GenericObject.OBJECT_TYPE.plattform)
               .content("Bahnsteig")
               .pos(mouseAction.startPoint)
               .size(local_point.x - mouseAction.startPoint.x, local_point.y - mouseAction.startPoint.y);
            GenericObject.all_objects.push(o);
            selectObject(o);
            renderer.renderAllGenericObjects();
            custom_mouse_mode = CUSTOM_MOUSE_ACTION.NONE;
            UI.activate_custom_mouse_mode();
            stage.update();
            STORAGE.saveUndoHistory();
            STORAGE.save();
         }
      } else if (mouseAction.action === MOUSE_DOWN_ACTION.NONE && mouseAction.distance() < 4) {
         if (mouseAction.container?.name == "signal") {
            selectObject(mouseAction.container.data, e);
         } else if (mouseAction.container?.name == "train") {
            selectObject(mouseAction.container.train, e);
         } else if (mouseAction.container?.name == "track") {
            selectObject(mouseAction.container.track, e);
         } else if (mouseAction.container?.name == "object") {
            selectObject(mouseAction.container.object, e);
         } else if (mouseAction.container?.name == "switch") {
            Track.switch_A_Switch(mouseAction.container.sw, local_point.x);
            renderer.reRenderSwitch(mouseAction.container.sw);
            stage.update();
         } else {
            selectObject();
         }
      }
   } else if (mouseAction.action === MOUSE_DOWN_ACTION.SCROLL) {
      STORAGE.save();
   }
}

const STORAGE = {
   MIN_STORAGE_VERSION: 0.43,
   STORAGE_IDENT: "bahnhof_last1",

   receiver(key, value) {
      if (value?._class) {
         const myClass = eval(value._class + ".FromObject")(value);
         if (myClass == null) showErrorToast(new Error("error loading " + key));
         return myClass;
      } else return value;
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
               tracks: tracks,
               trains: Train.allTrains,
               objects: GenericObject.all_objects,
               settings: {
                  zoom: stage.scale,
                  scrollX: stage.x,
                  scrollY: stage.y,
               },
            },
            STORAGE.replacer
         )
      );
   },

   restoreLastUndoStep() {
      if (undoHistory.length <= 1) return;
      undoHistory.pop();
      const last = undoHistory.lastItem();
      if (last) {
         loadFromJson(last);
      } else tracks = [];
   },

   loadFromJson(json) {
      let loaded = JSON.parse(json, STORAGE.receiver);
      if (loaded.settings) {
         stage.x = loaded.settings.scrollX;
         stage.y = loaded.settings.scrollY;
         stage.scale = loaded.settings.zoom;
      }
      if (loaded.objects) GenericObject.all_objects = loaded.objects;
      tracks = loaded.tracks?.clean() || []; //when something went wront while loading track, we filter all nulls

      Track.connectTracks();
      Train.allTrains = loaded.trains?.clean() || []; ////when something went wront while loading trains, we filter all nulls
      Train.allTrains.forEach((t) => t.restore());
      Train.allTrains = Train.allTrains.filter((t) => t.track != null);
   },

   saveUndoHistory() {
      undoHistory.push(JSON.stringify({ tracks: tracks, objects: GenericObject.all_objects }, STORAGE.replacer));
      if (undoHistory.length > MOST_UNDO) undoHistory.shift();
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
         }
      } catch (error) {
         showErrorToast(error);
      }
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

/* function drawPoint(point, displayObject, label = "", color = "#000", size = 1) {
   const s = new createjs.Shape();
   s.graphics.setStrokeStyle(1).beginStroke(color).beginFill(color).drawCircle(0, 0, size);
   s.x = point.x; //+ track.start.x;
   s.y = point.y; //+ track.start.y;

   displayObject.addChild(s);

   if (label) {
      const text = new createjs.Text(label, "Italic 10px Arial", color);
      text.x = s.x;
      text.y = s.y - 5;
      text.textBaseline = "alphabetic";
      debug_container.addChild(text);
   }
} */
