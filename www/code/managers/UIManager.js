"use strict";

// ES6 Module imports
import { MENU, CUSTOM_MOUSE_ACTION } from "../config.js";
import { ui } from "../ui.js";
import { Sig_UI, SignalRenderer } from "../signal.js";
import { Train } from "../train.js";
import { GenericObject } from "../generic_object.js";
import { STORAGE } from "../storage.js";
import { MOUSE_DOWN_ACTION } from "../config.js";

/**
 * UIManager handles all UI-related functionality
 * This class manages menus, modals, and UI state
 */
export class UIManager {
   #activeMenu = null;

   constructor(application) {}

   /**
    * Initialize UI components
    */
   initialize() {
      this.#initializeSignalMenu();
      this.#initializePreBuildScreen();
      this.#initializeInterManagerCommunication();
   }

   #initializeInterManagerCommunication() {
      app.eventManager.on("editModeChanged", (data) => {
         this.toggleEditMode(data.editMode, data.showGrid);
      });
      app.eventManager.on("rendererChanged", (data) => {
         this.handleRendererUIUpdate(data.textured);
      });
   }

   /**
    * Initialize signal menu
    * @private
    */
   #initializeSignalMenu() {
      const accordionId = "#newItemMenuAccordination";
      $(accordionId).append([
         ui.createAccordionItem(
            "Hauptsignale",
            accordionId,
            this.#createNewItemButtons(
               app.signalTemplates.hv_hp,
               app.signalTemplates.ks,
               app.signalTemplates.ls,
               app.signalTemplates.zusatzSignal
            ),
            true
         ),
         ui.createAccordionItem(
            "Vorsignale",
            accordionId,
            this.#createNewItemButtons(app.signalTemplates.hv_vr, app.signalTemplates.ks_vr)
         ),
         ui.createAccordionItem(
            "Lf-Signale",
            accordionId,
            this.#createNewItemButtons(app.signalTemplates.lf6, app.signalTemplates.lf7)
         ),
         ui.createAccordionItem(
            "Ne-Signale",
            accordionId,
            this.#createNewItemButtons(app.signalTemplates.ne4, app.signalTemplates.ne1, app.signalTemplates.ne2)
         ),
         ui.createAccordionItem(
            "Weitere",
            accordionId,
            this.#createNewItemButtons(
               app.signalTemplates.zs3,
               app.signalTemplates.zs6,
               app.signalTemplates.zs10,
               app.signalTemplates.ra10
            )
         ),
      ]);
   }

   /**
    * Initialize pre-build screen
    * @private
    */
   #initializePreBuildScreen() {
      // Pre-build screen initialization will be moved here
   }

   /**
    * Create new item buttons for UI
    * @private
    */
   #createNewItemButtons(...templates) {
      return templates
         .map((template) => {
            if (!template) return null;

            return ui
               .div("d-flex newSignalItem align-items-center user-select-none", [
                  ui
                     .div("flex-shrink-0 newItem_image")
                     .css("background-image", "url(" + this.#getDataURLFromTemplate(template) + ")")
                     .css("background-size", template.previewsize ?? 45),
                  ui.div("flex-grow-5 ms-2", template.title),
               ])
               .on("mousedown", (e) => {
                  // This will be handled by the original event system for now
                  app.mouseAction = {
                     action: MOUSE_DOWN_ACTION.DND_SIGNAL,
                     template: template,
                  };

                  document.addEventListener("mouseup", (e) => app.eventManager.handleStageMouseUp({ nativeEvent: e }), {
                     once: true,
                  });
                  app.renderingManager.stage.addEventListener("stagemousemove", app.eventManager.boundMouseMoveHandler);
                  app.eventManager.startDragAndDropSignal(e.offsetX, e.offsetY);
               });
         })
         .filter(Boolean);
   }

   /**
    * Generate data URL from signal template for preview
    * @private
    */
   #getDataURLFromTemplate(template) {
      const tmpStage = new createjs.Stage($("<canvas>").attr({ width: 450, height: 450 })[0]);
      tmpStage.scale = template.scale;

      SignalRenderer.drawPreview(template, tmpStage);
      tmpStage.update();

      const sig_bounds = tmpStage.getBounds();
      if (sig_bounds == null) throw Error(template.title + " has no visual Element visible");
      tmpStage.cache(sig_bounds.x, sig_bounds.y, sig_bounds.width, sig_bounds.height, 0.5);
      return tmpStage.bitmapCache.getCacheDataURL();
   }

   /**
    * Show a menu
    * @param {number} menu - The menu type to show
    */
   showMenu(menu) {
      const bsOffcanvas = bootstrap.Offcanvas.getOrCreateInstance($("#sidebar"));
      $("input,button", bsOffcanvas._element).off().removeClass("active");

      if (menu == null) {
         bsOffcanvas.hide();
         this.#activeMenu = null;
         return;
      }

      const current_id = $('#sidebar>div:not([style*="display: none"])');
      let div_id;

      switch (menu) {
         case MENU.EDIT_SIGNAL:
            div_id = "signalEditMenu";
            let body = $("#nav-home");
            body.empty();
            body.append(Sig_UI.getHTML(app.selection.object));
            Sig_UI.initSignalMenu();
            Sig_UI.syncSignalMenu(app.selection.object);
            break;
         case MENU.NEW_SIGNAL:
            div_id = "newItemMenu";
            break;
         case MENU.EDIT_TRAIN:
            div_id = "editTrainMenu";
            Train.initEditTrainMenu(app.selection.object);
            break;
         case MENU.NEW_TRAIN:
            div_id = "newTrainMenu";
            this.#initializeNewTrainMenu();
            break;
         case MENU.NEW_OBJECT:
            div_id = "newObjectMenu";
            this.#initializeNewObjectMenu();
            break;
         case MENU.EDIT_OBJECT:
            div_id = "editObjectMenu";
            GenericObject.initEditMenu(app.selection.object);
            break;
         case MENU.EDIT_TRACK:
            div_id = "editTrackMenu";
            Track.initEditTrackMenu(app.selection.object);
            break;
         default:
            throw new Error("unknown Menu");
      }

      $("#sidebar > div")
         .not("#" + div_id)
         .hide();
      $("#sidebar > #" + div_id).show();

      bsOffcanvas.show();
      this.#activeMenu = menu;
   }

   /**
    * Initialize new train menu
    * @private
    */
   #initializeNewTrainMenu() {
      $("#newTrain").on("mousedown", (e) => {
         app.mouseAction = {
            action: MOUSE_DOWN_ACTION.ADD_TRAIN,
         };

         document.addEventListener("mouseup", (e) => app.eventManager.handleStageMouseUp({ nativeEvent: e }), {
            once: true,
         });

         app.renderingManager.stage.addEventListener("stagemousemove", app.eventManager.boundMouseMoveHandler);

         let local_point = app.renderingManager.stage.globalToLocal(
            app.renderingManager.stage.mouseX,
            app.renderingManager.stage.mouseY
         );
         app.mouseAction.container = new createjs.Bitmap("zug.png").set({
            x: local_point.x,
            y: local_point.y,
            scale: 0.5,
            regY: 96 / 2,
         });

         app.renderingManager.containers.overlay.addChild(app.mouseAction.container);
      });
   }

   /**
    * Initialize new object menu
    * @private
    */
   #initializeNewObjectMenu() {
      $("#btnAddText").click(() => {
         app.customMouseMode = $("#btnAddText").hasClass("active") ? CUSTOM_MOUSE_ACTION.TEXT : CUSTOM_MOUSE_ACTION.NONE;
         this.activateCustomMouseMode();
      });
      $("#btnAddPlatform").click(() => {
         app.customMouseMode = $("#btnAddPlatform").hasClass("active") ? CUSTOM_MOUSE_ACTION.PLATTFORM : CUSTOM_MOUSE_ACTION.NONE;
         this.activateCustomMouseMode();
      });
   }

   /**
    * Activate custom mouse mode
    */
   activateCustomMouseMode() {
      switch (app.customMouseMode) {
         case CUSTOM_MOUSE_ACTION.TEXT:
            myCanvas.style.cursor = "text";
            break;
         default:
            myCanvas.style.cursor = "auto";
      }
   }

   /**
    * Toggle edit mode
    * @param {boolean} mode - The edit mode to set
    */
   toggleEditMode(mode) {
      const newMode = mode != undefined ? mode : $(btnDrawTracks).is(":checked");

      // Update UI state
      if (mode != undefined) $(btnDrawTracks).prop(":checked", newMode);

      // Emit event for other managers to handle
      app.eventManager.emit("editModeChanged", {
         editMode: newMode,
         showGrid: newMode,
      });
   }

   /**
    * Handle renderer UI update (called by Application)
    * @param {boolean} textured - Whether to use textured renderer
    */
   handleRendererUIUpdate(textured) {
      // Update UI state
      $("#switch_renderer").prop("checked", !textured);
   }

   /**
    * Update undo button state
    */
   updateUndoButtonState() {
      $("#btnUndo").prop("disabled", app.undoHistory.length <= 1);
   }

   /**
    * Undo the last action
    */
   undo() {
      STORAGE.restoreLastUndoStep();
      STORAGE.save();
      app.renderingManager.renderer.reDrawEverything(true);
      app.renderingManager.update();
      this.updateUndoButtonState();
   }

   /**
    * Show pre-build screen
    */
   showStartScreen() {
      if (localStorage.getItem("bahnhof_last1") == null) $(btnLoadRecent).attr("disabled", "disabled");

      $(btnStartFromZero).click(() => {
         this.hideStartScreen();
         app.renderingManager.drawGrid();
         app.renderingManager.renderer.reDrawEverything(true);
      });
      $(btnLoadRecent).click(() => {
         STORAGE.loadRecent();
         this.hideStartScreen();
         app.renderingManager.drawGrid();
         app.renderingManager.renderer.reDrawEverything(true);
      });

      $("#btnLoad2Gleisig,#btnLoad1Gleisig").on("click", (e) => {
         const name = $(e.target).attr("data");
         STORAGE.loadPrebuildbyName(name).then(() => {
            this.hideStartScreen();
            app.renderingManager.drawGrid();
            app.renderingManager.renderer.reDrawEverything(true);
            STORAGE.saveUndoHistory();
         });
      });
      $(btnLoadFromFile).click(() => {
         STORAGE.restoreFromFile().then(() => {
            this.hideStartScreen();
            app.renderingManager.drawGrid();
            app.renderingManager.renderer.reDrawEverything(true);
            STORAGE.saveUndoHistory();
         });
      });

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

   /**
    * Hide start screen
    */
   hideStartScreen() {
      $("myCanvas").focus();
      bootstrap.Modal.getInstance(loadModal).hide();
   }

   /**
    * Show modal dialog
    * @param {*} content - The content to show in the modal
    * @param {Function} onConfirm - Callback for confirmation
    */
   showModalDialog(content, onConfirm) {
      // Modal dialog functionality will be implemented here
   }

   /**
    * Show error toast
    * @param {Error} error - The error to display
    */
   showErrorToast(error) {
      ui.showErrorToast(error);
   }

   /**
    * Show info toast
    * @param {string} message - The message to display
    */
   showInfoToast(message) {
      ui.showInfoToast(message);
   }

   /**
    * Get the currently active menu
    * @returns {number|null} The active menu type
    */
   get activeMenu() {
      return this.#activeMenu;
   }

   /**
    * Hide the current menu
    */
   hideMenu() {
      this.showMenu(null);
   }
}
