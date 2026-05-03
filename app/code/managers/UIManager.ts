"use strict";

// ES6 Module imports
import { MENU, CUSTOM_MOUSE_ACTION, Menu } from "../config.ts";
import { ui } from "../ui.ts";
import { Sig_UI } from "../sig_ui.ts";
import { SignalRenderer } from "../signalRenderer.ts";
import { Train } from "../train.ts";
import { GenericObject } from "../generic_object.ts";
import { STORAGE } from "../storage.ts";
import type { Application } from "../application.ts";

// ============================================================================
// Type Definitions
// ============================================================================

interface SignalTemplate {
   scale: number;
   title: string;
   previewsize?: number;
   [key: string]: any;
}

interface EventData {
   editMode?: boolean;
   showGrid?: boolean;
   textured?: boolean;
}

/**
 * UIManager handles all UI-related functionality
 * This class manages menus, modals, and UI state
 */
export class UIManager {
   #activeMenu: Menu | null = null;

   constructor(_application: Application) {}

   /**
    * Initialize UI components
    */
   initialize(): void {
      this.#initializeSignalMenu();
      this.#initializePreBuildScreen();
      this.#initializeInterManagerCommunication();
   }

   /**
    * Initialize inter-manager communication
    * @private
    */
   #initializeInterManagerCommunication(): void {
      const app = (window as any).app;
      app.eventManager.on("editModeChanged", (data: EventData) => {
         this.toggleEditMode(data.editMode, data.showGrid);
      });
      app.eventManager.on("rendererChanged", (data: EventData) => {
         this.handleRendererUIUpdate(data.textured ?? false);
      });
   }

   /**
    * Initialize signal menu
    * @private
    */
   #initializeSignalMenu(): void {
      const app = (window as any).app;
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
            ) as any,
            true
         ),
         ui.createAccordionItem(
            "Vorsignale",
            accordionId,
            this.#createNewItemButtons(app.signalTemplates.hv_vr, app.signalTemplates.ks_vr) as any
         ),
         ui.createAccordionItem(
            "Lf-Signale",
            accordionId,
            this.#createNewItemButtons(app.signalTemplates.lf6, app.signalTemplates.lf7) as any
         ),
         ui.createAccordionItem(
            "Ne-Signale",
            accordionId,
            this.#createNewItemButtons(app.signalTemplates.ne4, app.signalTemplates.ne1, app.signalTemplates.ne2) as any
         ),
         ui.createAccordionItem(
            "Weitere",
            accordionId,
            this.#createNewItemButtons(
               app.signalTemplates.zs3,
               app.signalTemplates.zs6,
               app.signalTemplates.zs10,
               app.signalTemplates.ra10
            ) as any
         ),
      ]);
   }

   /**
    * Initialize pre-build screen
    * @private
    */
   #initializePreBuildScreen(): void {
      // Pre-build screen initialization will be moved here
   }

   /**
    * Create new item buttons for UI
    * @private
    */
   #createNewItemButtons(...templates: (SignalTemplate | null | undefined)[]): JQuery[] {
      const app = (window as any).app;
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
               .on("mousedown", (_e: JQuery.MouseDownEvent) => {
                  app.eventManager.startSignalDragFromTemplate(template);
               });
         })
         .filter((item): item is JQuery => item !== null);
   }

   /**
    * Generate data URL from signal template for preview
    * @private
    */
   #getDataURLFromTemplate(template: SignalTemplate): string {
      const tmpStage = new (createjs as any).Stage($("<canvas>").attr({ width: 450, height: 450 })[0]);
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
    * @param menu - The menu type to show (null to hide)
    */
   showMenu(menu?: Menu | null): void {
      const app = (window as any).app;
      const bootstrap = (window as any).bootstrap;
      const bsOffcanvas = bootstrap.Offcanvas.getOrCreateInstance($("#sidebar"));
      $("input,button", bsOffcanvas._element).off().removeClass("active");

      if (menu == null) {
         bsOffcanvas.hide();
         this.#activeMenu = null;
         return;
      }

      let div_id: string;

      switch (menu) {
         case MENU.EDIT_SIGNAL:
            div_id = "signalEditMenu";
            Sig_UI.initSignalAspectsMenu(app.selection.object);
            Sig_UI.initSignalConfigurationMenu();
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
            (window as any).Track.initEditTrackMenu(app.selection.object);
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
   #initializeNewTrainMenu(): void {
      const app = (window as any).app;
      $("#newTrain").on("mousedown", (_e: JQuery.MouseDownEvent) => {
         app.eventManager.startTrainPlacementDrag();
      });
   }

   /**
    * Initialize new object menu
    * @private
    */
   #initializeNewObjectMenu(): void {
      const app = (window as any).app;
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
   activateCustomMouseMode(): void {
      const app = (window as any).app;
      const myCanvas = (window as any).myCanvas as HTMLCanvasElement;
      
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
    * @param mode - The edit mode to set
    * @param _showGrid - Whether to show grid (unused parameter)
    */
   toggleEditMode(mode?: boolean, _showGrid?: boolean): void {
      const app = (window as any).app;
      const btnDrawTracks = (window as any).btnDrawTracks;
      const newMode = mode !== undefined ? mode : $(btnDrawTracks).is(":checked");

      // Update UI state
      if (mode !== undefined) $(btnDrawTracks).prop("checked", newMode);

      // Emit event for other managers to handle
      app.eventManager.emit("editModeChanged", {
         editMode: newMode,
         showGrid: newMode,
      });
   }

   /**
    * Handle renderer UI update (called by Application)
    * @param textured - Whether to use textured renderer
    */
   handleRendererUIUpdate(textured: boolean): void {
      // Update UI state
      $("#switch_renderer").prop("checked", !textured);
   }

   /**
    * Update undo button state
    */
   updateUndoButtonState(): void {
      const app = (window as any).app;
      $("#btnUndo").prop("disabled", app.undoHistory.length <= 1);
   }

   /**
    * Undo the last action
    */
   undo(): void {
      const app = (window as any).app;
      STORAGE.restoreLastUndoStep();
      STORAGE.save();
      app.renderingManager.renderer.reDrawEverything(true);
      app.renderingManager.update();
      this.updateUndoButtonState();
   }

   /**
    * Show pre-build screen
    */
   showStartScreen(): void {
      const app = (window as any).app;
      const btnLoadRecent = (window as any).btnLoadRecent;
      const btnStartFromZero = (window as any).btnStartFromZero;
      const btnLoadFromFile = (window as any).btnLoadFromFile;
      const loadModal = (window as any).loadModal;
      
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

      $("#btnLoad2Gleisig,#btnLoad1Gleisig").on("click", (e: JQuery.ClickEvent) => {
         const name = $(e.target).attr("data");
         if (name) {
            STORAGE.loadPrebuildbyName(name).then(() => {
               this.hideStartScreen();
               app.renderingManager.drawGrid();
               app.renderingManager.renderer.reDrawEverything(true);
               STORAGE.saveUndoHistory();
            });
         }
      });
      $(btnLoadFromFile).click(() => {
         STORAGE.restoreFromFile().then(() => {
            this.hideStartScreen();
            app.renderingManager.drawGrid();
            app.renderingManager.renderer.reDrawEverything(true);
            STORAGE.saveUndoHistory();
         });
      });

      const bootstrap = (window as any).bootstrap;
      const m = bootstrap.Modal.getOrCreateInstance(loadModal);
      m._element.addEventListener(
         "hidden.bs.modal",
         (x: Event) => {
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
   hideStartScreen(): void {
      const loadModal = (window as any).loadModal;
      const bootstrap = (window as any).bootstrap;
      $("myCanvas").focus();
      bootstrap.Modal.getInstance(loadModal).hide();
   }

   /**
    * Show error toast
    * @param error - The error to display
    */
   showErrorToast(error: Error): void {
      ui.showErrorToast(error);
   }

   /**
    * Show info toast
    * @param message - The message to display
    */
   showInfoToast(message: string): void {
      ui.showInfoToast(message);
   }

   /**
    * Get the currently active menu
    * @returns The active menu type
    */
   get activeMenu(): Menu | null {
      return this.#activeMenu;
   }

   /**
    * Hide the current menu
    */
   hideMenu(): void {
      this.showMenu(null);
   }
}

