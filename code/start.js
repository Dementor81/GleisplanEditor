"use strict";

const VERSION = "0.43";
const EXCLUDE_JSON = [];

const MODE_PLAY = 1;
const MODE_EDIT = 2;

const GRID_SIZE = 100;
const GRID_SIZE_2 = GRID_SIZE / 2;

const SNAP_2_GRID = 30;
const MAX_SCALE = 5;

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
   DRAWING: 8,
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
   grid;

var previousTouch;
var showGrid = true;
var edit_mode = true;
var drawing_mode = false;
var pl;
var mouseAction = null;
var loadQueue;

var renderer;

var tracks = [];
var switches = [];

var undoHistory = ["[]"];

var signalTemplates = {};

var prevent_input = false;
var scale_changed = true;

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
   main_container.addChild((signal_container = create_container("signals")));
   main_container.addChild((train_container = create_container("trains")));
   stage.addChild((ui_container = create_container("ui")));
   stage.addChild((overlay_container = create_container("overlay")));
   stage.addChild((drawing_container = create_container("drawing_container")));

   ShowPreBuildScreen();

   pl.start().then(() => {
      console.log(`Preloader: ${pl._loadedItems}/${pl._totalItems}`);
      const id = "#newItemMenuAccordination";
      try {
         $(id).append([
            BS.createAccordionItem("Hauptsignale", id, [
               newItemButton(signalTemplates.hv_hp),
               newItemButton(signalTemplates.ks),
               newItemButton(signalTemplates.ls),
            ]),

            BS.createAccordionItem("Vorsignale", id, [newItemButton(signalTemplates.hv_vr), newItemButton(signalTemplates.ks_vr)]),
            BS.createAccordionItem("Lf-Signale", id, [newItemButton(signalTemplates.lf6), newItemButton(signalTemplates.lf7)]),
            BS.createAccordionItem("Ne-Signale", id, [
               newItemButton(signalTemplates.ne4),
               newItemButton(signalTemplates.ne1),
               newItemButton(signalTemplates.ne2),
            ]),
            BS.createAccordionItem("Weitere", id, [
               newItemButton(signalTemplates.zs3),
               newItemButton(signalTemplates.zs10),
               newItemButton(signalTemplates.ra10),
            ]),
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
      if (!prevent_input) {
         prevent_input = true;
         let point = new createjs.Point(stage.mouseX, stage.mouseY);
         let localPoint = stage.globalToLocal(point.x, point.y);

         let old = stage.scale;
         let step = event.deltaY / (1000 / stage.scale);

         stage.scale -= step;

         stage.scale = Math.min(Math.max(0.2, stage.scale), MAX_SCALE);

         if (stage.scale != old) {
            //if we reached MIN or MAX, the scale value doesnt change anymore
            // Find where the original point is now
            let globalPoint = stage.localToGlobal(localPoint.x, localPoint.y);
            // Move the map by the difference
            stage.x -= globalPoint.x - point.x;
            stage.y -= globalPoint.y - point.y;

            drawGrid();
            //if (stage.scale > old)
            {
               renderer.reDrawEverything();
            }

            stage.update();
            save();
         }
         prevent_input = false;
      }
   });
   if (createjs.Touch.isSupported()) {
      myCanvas.addEventListener("touchstart", (event) => {
         if (event.touches.length === 1) {
            let touch = event.touches[0];
            startTrackDrawing(stage.globalToLocal(touch.clientX, touch.clientY));
         }

         /* console.log("touch:" + event.touches.length);
            for (let index = 0; index < event.touches.length; index++) {
                const item = event.touches[index];
                console.log("x:" + item.clientX + ":" + item.clientY);
            } */
      });

      myCanvas.addEventListener("touchmove", (event) => {
         if (event.touches.length === 2) {
            let touch = event.touches[0];

            if (previousTouch) {
               // be aware that these only store the movement of the first touch in the touches array
               stage.x += touch.clientX - previousTouch.clientX;
               stage.y += touch.clientY - previousTouch.clientY;

               drawGrid();
            }

            previousTouch = touch;
         }
      });
   }

   $(btnDrawTracks).click(() => toggleEditMode());

   $("#switch_renderer").on("change", (e) => {
      selectRenderer(!$("#switch_renderer").is(":checked"));
   });

   $("#btnAddSignals").click(() => UI.showMenu(MENU.NEW_SIGNAL));
   $("#btnAddTrain").click(() => UI.showMenu(MENU.NEW_TRAIN));
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
      });

      overlay_container.addChild(mouseAction.container);
   });

   $("#btnClear").click(() => {
      tracks = [];
      switches = [];
      Train.allTrains = [];

      save();
      renderer.reDrawEverything(true); //just to make sure, something accidently not deleted we be drawn to the stage.
      stage.update();
   });

   $("#btnCenter").click(() => {
      stage.scale = 1;
      stage.x = 0;
      stage.y = 0;
      save();
      drawGrid();
      renderer.reDrawEverything();
      stage.update();
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
      drawing_mode = $("#btnDraw").hasClass("active");
      const bsOffcanvas = bootstrap.Offcanvas.getOrCreateInstance(document.getElementById("drawingPanel"));
      if (drawing_mode) {
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
            save();
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
               save();
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
         [].concat(selection.object).forEach((t) => deleteTrack(t, null));
         Track.cleanupTracks();
         Track.connectTracks();
         saveUndoHistory();
      }
      if (selection.type == "Signal") [].concat(selection.object).forEach((s) => removeSignal(s, null));
      save();
      renderer.reDrawEverything(true);
      stage.update();
      selectObject();
   }
}

const UI = {
   ///Shows the menu on the right.
   /// menu==null just hides it.
   showMenu(menu) {
      var bsOffcanvas = bootstrap.Offcanvas.getOrCreateInstance($("#sidebar"));
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
            body.append(mouseAction.container.signal.getHTML());
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
};

function toggleEditMode(mode) {
   edit_mode = mode != undefined ? mode : !edit_mode;
   showGrid = edit_mode;
   drawGrid();
   stage.update();
   $(btnDrawTracks).toggleClass("active", edit_mode);
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
      default:
         menu = null;
         break;
   }

   UI.showMenu(menu);
}

function clearCanvas() {
   drawing_container.removeAllChildren();
   debug_container.removeAllChildren();
   track_container.removeAllChildren();
   signal_container.removeAllChildren();
   overlay_container.removeAllChildren();
   train_container.removeAllChildren();
   ui_container.removeAllChildren();
   stage.update();
}

function onResizeWindow() {
   $(myCanvas).attr("height", $(CanvasContainer).height() - 5);
   $(myCanvas).attr("width", $(CanvasContainer).width());
   drawGrid();
   stage.update();
}

function drawGrid(repaint = true) {
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
}

function handleStageMouseDown(event) {
   //console.log("handleStageMouseDown", event);

   //console.log(main_container.mouseX + "/" + main_container.mouseY);

   let hittest = getHitTest();
   //console.log(hittest);

   //console.log(hittest ? hittest : "nothing hit");

   mouseAction = {
      action: drawing_mode ? MOUSE_DOWN_ACTION.DRAWING : MOUSE_DOWN_ACTION.NONE,
      container: hittest,
      startPoint: stage.globalToLocal(stage.mouseX, stage.mouseY),
      _distancePoint: new Point(event.stageX, event.stageY),
      offset: hittest?.globalToLocal(stage.mouseX, stage.mouseY), //Koordinate auf dem angeklickten Object (zb Signal), damit der Container am Mauszeiger "klebt"
      distance: function () {
         return geometry.distance(this._distancePoint, new Point(stage.mouseX, stage.mouseY));
      },
   };

   if (drawing_mode) {
      const color = document.querySelector('input[name="DrawingColor"]:checked').value;
      const width = document.querySelector('input[name="DrawingWidth"]:checked').value;

      drawing_container.addChild((mouseAction.shape = new createjs.Shape()));
      mouseAction.shape.graphics.setStrokeStyle(width, "round", "round").beginStroke(color);
      mouseAction.old_point = new Point(event.stageX, event.stageY);
   }

   //if ($("#btnAddTrain").hasClass("active")) mouseAction.action = MOUSE_DOWN_ACTION.ADD_TRAIN;

   //console.log(mouseAction);
   stage.addEventListener("stagemousemove", handleMouseMove);
}

function getHitTest(container) {
   let local_point = stage.globalToLocal(stage.mouseX, stage.mouseY);

   return (container ? container : stage).getObjectUnderPoint(local_point.x, local_point.y, 1);
}

function getHitTrackInfo(use_offset) {
   let local_point = stage.globalToLocal(stage.mouseX, stage.mouseY);
   if (mouseAction.offset && use_offset) {
      let p = mouseAction.container.localToLocal(mouseAction.offset.x, mouseAction.offset.y, stage);
      local_point.x -= p.x - mouseAction.container.x;
      local_point.y -= p.y - mouseAction.container.y;
   }
   let circleShape = overlay_container.getChildByName("circle");
   if (circleShape == null) {
      circleShape = new createjs.Shape();
      circleShape.name = "circle";
      circleShape.graphics
         .setStrokeStyle(1)
         .beginStroke("#e00")
         .drawCircle(0, 0, GRID_SIZE / 2);
      overlay_container.addChild(circleShape);
   }
   circleShape.x = local_point.x;
   circleShape.y = local_point.y;
   let circle = { x: local_point.x, y: local_point.y, radius: GRID_SIZE / 2 };
   let result;
   let track, box;
   for (let index = 0; index < tracks.length; index++) {
      track = tracks[index];
      box = createBoxFromLine(track.start, track.end, track._tmp.unit, GRID_SIZE_2);
      debug_container.removeAllChildren();
      /* drawPoint(box.topLeft, "topLeft", "#000", 3);
        drawPoint(box.topRight, "topRight", "#000", 3);
        drawPoint(box.bottomRight, "bottomRight", "#000", 3);
        drawPoint(box.bottomLeft, "bottomLeft", "#000", 3);  */

      if (isPointInsideBox(local_point, box, track._tmp.rad))
         if ((result = LineIsInCircle(track, circle))) {
            result.track = track;
            result.above = result.point.y > circle.y;
            return result;
         }
   }
}

function createSignalContainer(signal) {
   let c = new createjs.Container();
   c.name = "signal";
   c.signal = signal;
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

function alignSignalWithTrack(signal_shape, pos) {
   if (!pos) pos = signal_shape.signal._positioning;

   //koordinaten anhand des Strecken KM suchen
   let coordinates;
   if (pos.point) coordinates = pos.point;
   else coordinates = geometry.add(pos.track.getPointfromKm(pos.km), pos.track.start);

   const template = signal_shape.signal._template;

   let p;
   if (pos.above) {
      signal_shape.rotation = 270 + pos.track._tmp.deg;
      p = geometry.perpendicular(coordinates, pos.track._tmp.deg, -renderer.SIGNAL_DISTANCE_FROM_TRACK - template.distance_from_track);
   } else {
      signal_shape.rotation = 90 + pos.track._tmp.deg;
      p = geometry.perpendicular(coordinates, pos.track._tmp.deg, renderer.SIGNAL_DISTANCE_FROM_TRACK + template.distance_from_track);
   }

   signal_shape.x = p.x;
   signal_shape.y = p.y;
   if (pos.flipped) {
      signal_shape.rotation += 180;
   }
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
   /* let circle = new createjs.Shape();
    circle.name = "circle";
    circle.graphics.setStrokeStyle(1).beginStroke("#e00").drawCircle(0, 0, GRID_SIZE / 2);
    mouseAction.container.addChild(circle); */
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
         if (event.nativeEvent.buttons == 1 && edit_mode && mouseAction.container?.name == "signal") {
            mouseAction.action = MOUSE_DOWN_ACTION.DND_SIGNAL;

            mouseAction.container.signal._positioning.track.removeSignal(mouseAction.container.signal);

            startDragAndDropSignal();
         } else if (event.nativeEvent.buttons == 1 && mouseAction.container?.name == "train") {
            mouseAction.action = MOUSE_DOWN_ACTION.MOVE_TRAIN;
         } else if (event.nativeEvent.buttons == 1 && edit_mode && mouseAction.container?.name != "signal") {
            //stage.addEventListener("stagemousemove", handleMouseMove);
            mouseAction.lineShape = new createjs.Shape();
            overlay_container.addChild(mouseAction.lineShape);
            setTrackAnchorPoints();
            mouseAction.action = MOUSE_DOWN_ACTION.BUILD_TRACK;
         } else if (event.nativeEvent.buttons == 2) {
            //stage.addEventListener("stagemousemove", handleMouseMove);
            mouseAction.action = MOUSE_DOWN_ACTION.SCROLL;
         }
      }
   }
   if (mouseAction.action === MOUSE_DOWN_ACTION.DRAWING) {
      mouseAction.shape.graphics.mt(mouseAction.startPoint.x, mouseAction.startPoint.y).lt(local_point.x, local_point.y);

      mouseAction.startPoint.x = local_point.x;
      mouseAction.startPoint.y = local_point.y;
   } else if (mouseAction.action === MOUSE_DOWN_ACTION.DND_SIGNAL) {
      //searches for a hit in 2 steps:
      //1st: at the mouse position and if it finds a track there
      //it 2nd searches for the track at the signal´s base
      let hitInformation = getHitTrackInfo(false);
      if (hitInformation) {
         hitInformation.flipped = event.nativeEvent.altKey;

         alignSignalWithTrack(mouseAction.container, hitInformation);
         mouseAction.hit_track = hitInformation = getHitTrackInfo(true);
         if (hitInformation) {
            mouseAction.container.signal._positioning = {
               track: hitInformation.track,
               km: hitInformation.km,
               above: hitInformation.above,
               flipped: event.nativeEvent.altKey,
            };
            alignSignalWithTrack(mouseAction.container);
         }
      }

      if (hitInformation == null || mouseAction.hit_track == null) {
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
   } else if (mouseAction.action === MOUSE_DOWN_ACTION.BUILD_TRACK) {
      setTrackAnchorPoints();
      drawBluePrintTrack();
   } else if (mouseAction.action === MOUSE_DOWN_ACTION.SCROLL) {
      stage.x += event.nativeEvent.movementX;
      stage.y += event.nativeEvent.movementY;
      drawGrid(false);
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

   /* debug_container.removeAllChildren();
    for (let index = 1; index < mouseAction.ankerPoints.length; index++) {
        const co = mouseAction.ankerPoints[index];
        drawPoint(co, index);
    } */
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

function getGlobalBounds(container) {
   let tl = container.localToGlobal(0, 0);
   let bounds = container.getBounds();
   let tr = container.localToGlobal(bounds.width, 0);
   let br = container.localToGlobal(bounds.width, bounds.height);
   let bl = container.localToGlobal(0, bounds.height);

   let minX = Math.min(tl.x, tr.x, br.x, bl.x);
   let minY = Math.min(tl.y, tr.y, br.y, bl.y);
   let w = Math.max(tl.x, tr.x, br.x, bl.x) - minX;
   let h = Math.max(tl.y, tr.y, br.y, bl.y) - minY;

   if (container.rotation.is(90, 270)) {
      return new createjs.Rectangle(minX, minY, h, w);
   } else return new createjs.Rectangle(minX, minY, w, h);
}

function handleStageMouseUp(e) {
   //console.log("handleStageMouseUp", e);
   if (mouseAction == null) {
      stage.removeEventListener("stagemousemove", handleMouseMove);
      return;
   }
   let local_point = stage.globalToLocal(stage.mouseX, stage.mouseY);
   if (e.nativeEvent.which == 1) {
      if (mouseAction.action === MOUSE_DOWN_ACTION.DND_SIGNAL) {
         overlay_container.removeChild(mouseAction.container);

         if (mouseAction.hit_track) {
            signal_container.addChild(mouseAction.container);
            mouseAction.hit_track.track.AddSignal(mouseAction.container.signal);
         }
         save();
         saveUndoHistory();
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
                  checkAndCreateTrack(tmpPoint, p1);
                  tmpPoint = p1;
               }
            }
            Track.cleanupTracks();
            Track.connectTracks();
            renderer.reDrawEverything(true);
            saveUndoHistory();
            save();
         }
         overlay_container.removeAllChildren();

         stage.update();
      } else if (mouseAction.action === MOUSE_DOWN_ACTION.ADD_TRAIN) {
         overlay_container.removeChild(mouseAction.container);
         const hit = getHitTest(track_container);
         if (hit.name == "track") {
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
            save();
         }
      } else if (mouseAction.action === MOUSE_DOWN_ACTION.MOVE_TRAIN) {
         save();
      } else if (mouseAction.action === MOUSE_DOWN_ACTION.NONE && mouseAction.distance() < 4) {
         if (mouseAction.container?.name == "signal") {
            selectObject(mouseAction.container.signal, e);
         } else if (mouseAction.container?.name == "train") {
            selectObject(mouseAction.container.train, e);
         } else if (mouseAction.container?.name == "track") {
            selectObject(mouseAction.container.track, e);
         } else if (mouseAction.container?.name == "switch") {
            Track.switch_A_Switch(mouseAction.container.sw, local_point.x);
            renderer.reRenderSwitch(mouseAction.container.sw);
            stage.update();
         } else {
            selectObject();
         }
      }
   } else if (mouseAction.action === MOUSE_DOWN_ACTION.SCROLL) {
      save();
   }

   stage.removeEventListener("stagemousemove", handleMouseMove);
}

function deleteTrack(track) {
   tracks.remove(track);
}

function removeSignal(s) {
   const track = tracks.find((t) => t.signals.includes(s));
   if (track) track.removeSignal(s);
}

function checkAndCreateTrack(p1, p2) {
   if (deepEqual(p1, p2)) return;

   if (p1.x > p2.x) {
      const hlp = p1;
      p1 = p2;
      p2 = hlp;
   }
   const slope = geometry.slope(p1, p2);

   //if (tracks.some((track) => geometry.within(track.start, track.end, p1) && geometry.within(track.start, track.end, p2))) return;

   const tracksWithSameSlope = tracks.filter((track) => track._tmp.slope == slope);
   let track;
   tracksWithSameSlope
      .filter((t) => geometry.within(t.start, t.end, p1))
      .forEach((t) => {
         if (t.end.x > p1.x) p1 = t.end;
      });

   tracksWithSameSlope
      .filter((t) => geometry.within(t.start, t.end, p2))
      .forEach((t) => {
         if (t.start.x < p2.x) p2 = t.start;
      });

   if ((track = tracksWithSameSlope.find((t) => geometry.within(t.start, t.end, p2)))) {
      p2 = track.start;
   }

   if (p1.x > p2.x) return;

   if ((track = tracksWithSameSlope.find((t) => geometry.within(p1, p2, t.start) && geometry.within(p1, p2, t.end)))) {
      checkAndCreateTrack(p1, track.start);
      checkAndCreateTrack(track.end, p2);
      return;
   }

   const line = { start: p1, end: p2 };
   const intersecting_tracks = tracks
      .filter((t) => slope != t._tmp.slope && slope + t._tmp.slope != 0) //filter all track with same slope or 90° angles
      .map((t) => [t, geometry.getIntersectionPoint(line, t)]) //get all intersection points
      .filter((item) => item[1] != null) //removes items with no intersection
      .sort((a, b) => a[1].x - b[1].x); // sort by x
   intersecting_tracks.forEach((item) => {
      // split tracks
      let t = item[0];
      let intersection = item[1];
      if (!t.start.equals(intersection) && !t.end.equals(intersection)) {
         tracks = tracks.concat(Track.splitTrack(t, intersection));
         deleteTrack(t, false);
      }
   });

   if (intersecting_tracks?.length > 0) {
      let intersection;
      intersecting_tracks.forEach((item) => {
         if (item) {
            intersection = item[1];
            if (!intersection.equals(p1)) createTrack(p1, intersection);
            p1 = intersection;
         }
      });
      if (!intersection.equals(p2)) createTrack(p1, p2); //last bit, from the last intersection to the end
   } else createTrack(p1, p2);
}

function createTrack(start, end) {
   tracks.push(new Track(start, end));
}

function replacer(key, value) {
   if (value != null && typeof value.stringify === "function") {
      return value.stringify();
   } else {
      if (EXCLUDE_JSON.includes(key)) return undefined;
      else return value;
   }
}

function getSaveString() {
   return JSON.stringify(
      {
         tracks: tracks,
         trains: Train.allTrains,
         zoom: stage.scale,
         scrollX: stage.x,
         scrollY: stage.y,
      },
      replacer
   );
}

function undo() {
   if (undoHistory.length <= 1) return;
   undoHistory.pop();
   const last = undoHistory.lastItem();
   if (last) {
      tracks = JSON.parse(last, receiver).clean() || [];
      Track.connectTracks();
   } else tracks = [];

   renderer.reDrawEverything(true);
   stage.update();
}

function saveUndoHistory() {
   undoHistory.push(JSON.stringify(tracks, replacer));
   if (undoHistory.length > MOST_UNDO) undoHistory.shift();
}

function save() {
   localStorage.setItem("bahnhof_last1", `0.17;${getSaveString()}`);
}

function loadRecent() {
   try {
      const x = localStorage.getItem("bahnhof_last1");
      if (x != null) {
         const indexOfFirst = x.indexOf(";");
         if (indexOfFirst > -1) {
            const loaded_version = parseFloat(x.substring(0, indexOfFirst));
            if (loaded_version >= 0.17) loadFromJson(x.slice(indexOfFirst + 1));
            else console.error(`stored version ${loaded_version} to old`);
         }
      }
   } catch (error) {
      showErrorToast(error);
   }
}

function receiver(key, value) {
   if (value?._class) {
      const myClass = eval(value._class + ".FromObject")(value);
      if (myClass == null) showErrorToast(new Error("error loading " + key));
      return myClass;
   } else return value;
}

function loadFromJson(json) {
   let loaded = JSON.parse(json, receiver);
   stage.x = loaded.scrollX;
   stage.y = loaded.scrollY;
   stage.scale = loaded.zoom;
   tracks = loaded.tracks?.clean() || []; //when something went wront while loading track, we filter all nulls
   Track.connectTracks();
   Train.allTrains = loaded.trains?.clean() || []; ////when something went wront while loading trains, we filter all nulls
   Train.allTrains.forEach((t) => t.restore());
   Train.allTrains = Train.allTrains.filter((t) => t.track != null);

   drawGrid();
   renderer.reDrawEverything(true);
   stage.update();
}

function newItemButton(template) {
   if (!template) throw new Error("No template given. Probably there was an error while creating the SignalTemplate");

   return ui
      .div("d-flex newSignalItem align-items-center user-select-none", [
         ui.div("flex-shrink-0 newItem_image").css("background-image", "url(" + GetDataURL_FromTemplate(template) + ")"),
         ui.div("flex-grow-5 ms-2", template.title),
      ])
      .on("mousedown", (e) => {
         mouseAction = {
            action: MOUSE_DOWN_ACTION.DND_SIGNAL,
            template: template,
         };

         //mouseup beim document anmelden, weil mouseup im stage nicht ausgelöst wird, wenn mousedown nicht auch auf der stage war
         //little hack, weil handleStageMouseUp ein event von createjs erwartet
         document.addEventListener("mouseup", (e) => handleStageMouseUp({ nativeEvent: e }), {
            once: true,
         });

         stage.addEventListener("stagemousemove", handleMouseMove);

         startDragAndDropSignal(e.offsetX, e.offsetY);
      });
}

function GetDataURL_FromTemplate(template) {
   let signal = new Signal(template);

   let c = $("<canvas>").attr({ width: 450, height: 450 });
   $(document.body).append(c);

   let s = new createjs.Stage(c[0]);
   s.scale = template.scale;
   signal.draw(s, true);
   s.update();
   let sig_bounds = s.getBounds();

   if (sig_bounds == null) throw Error(template.title + " has no visual Element visible");
   s.cache(sig_bounds.x, sig_bounds.y, sig_bounds.width, sig_bounds.height, template.scale);

   let data_url = s.bitmapCache.getCacheDataURL();
   c.remove();
   return data_url;
}

function drawPoint(point, displayObject, label = "", color = "#000", size = 1) {
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
}

function hideStartScreen() {
   bootstrap.Modal.getInstance(loadModal).hide();
}

function ShowPreBuildScreen() {
   if (localStorage.getItem("bahnhof_last1") == null) $(btnLoadRecent).attr("disabled", "disabled");
   $(btnStartFromZero).click(hideStartScreen);
   $(btnLoadRecent).click(() => {
      loadRecent();
      hideStartScreen();
   });
   $(btnLoad2Gleisig).on("click", () => {
      loadPrebuildbyName("ktm_2");
      hideStartScreen();
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
}

function loadPrebuildbyName(name) {
   let xmlhttp = new XMLHttpRequest();
   xmlhttp.onreadystatechange = function () {
      if (this.readyState == 4 && this.status == 200) {
         let i;
         let xmlDoc = this.responseXML;

         let x = xmlDoc.getElementsByTagName("setup");
         for (i = 0; i < x.length; i++) {
            if (x[i].getElementsByTagName("title")[0].textContent == name) {
               loadFromJson(x[i].getElementsByTagName("json")[0].childNodes[0].wholeText.trim());
            }
         }
      }
   };
   xmlhttp.open("GET", "prebuilds.xml" + "?" + Math.floor(Math.random() * 100), true);
   xmlhttp.send();
}
