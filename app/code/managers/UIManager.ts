"use strict";

// ES6 Module imports
import { MENU, CUSTOM_MOUSE_ACTION, Menu } from "../config.ts";
import { ui } from "../ui.ts";
import { Sig_UI } from "../sig_ui.ts";
import { SignalRenderer } from "../rendering/signalRenderer.ts";
import { Train } from "../train.ts";
import { GenericObject } from "../generic_object.ts";
import { STORAGE } from "../storage.ts";
import type { Application } from "../application.ts";
import { createLayerContainer } from "../pixiUtils.ts";
import { mountRendererChoiceCards, type RendererChoiceCardsHandle } from "../ui/rendererChoiceCards.ts";
import { StartScreen } from "../ui/StartScreen.ts";
import { ViewportHud } from "../ui/ViewportHud.ts";

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
   textured?: boolean;
}

/**
 * UIManager handles all UI-related functionality
 * This class manages menus, modals, and UI state
 */
export class UIManager {
   #activeMenu: Menu | null = null;
   #rendererChoiceCardsHandle: RendererChoiceCardsHandle | null = null;
   #startScreenRendererHandle: RendererChoiceCardsHandle | null = null;
   #startScreen = new StartScreen();
   #viewportHud = new ViewportHud();

   constructor(_application: Application) {}

   get rendererChoiceCardsHandle(): RendererChoiceCardsHandle | null {
      return this.#rendererChoiceCardsHandle;
   }

   /**
    * Initialize UI components
    */
   initialize(): void {
      this.#startScreen.mount();
      this.#rendererChoiceCardsHandle = mountRendererChoiceCards($("#rendererChoiceModalMount"));
      const $startMount = $("#startScreenRendererMount");
      if ($startMount.length) {
         this.#startScreenRendererHandle = mountRendererChoiceCards($startMount);
         this.#startScreen.setRendererChoiceHandle(this.#startScreenRendererHandle);
      }
      const app = (window as any).app;
      const textured = app?.renderingManager?.usesTexturedRenderer();
      if (textured !== undefined) {
         this.#rendererChoiceCardsHandle?.syncSelection(textured);
         this.#startScreenRendererHandle?.syncSelection(textured);
      }
      this.#initializeSignalMenu();
      this.#initializeInterManagerCommunication();
      this.#viewportHud.mount();
   }

   /**
    * Initialize inter-manager communication
    * @private
    */
   #initializeInterManagerCommunication(): void {
      const app = (window as any).app;
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
      const app = (window as any).app;
      const tmpStage = createLayerContainer("signalPreview");
      tmpStage.scale.set(template.scale);

      SignalRenderer.drawPreview(template, tmpStage);

      const sig_bounds = tmpStage.getLocalBounds();
      if (sig_bounds == null) throw Error(template.title + " has no visual Element visible");
      const canvas = app.renderingManager.pixiApp.renderer.extract.canvas({
         target: tmpStage,
         resolution: 0.5,
      }) as HTMLCanvasElement;
      return canvas.toDataURL("image/png");
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
      $("#newTrain").off("mousedown").on("mousedown", (_e: JQuery.MouseDownEvent) => {
         app.eventManager.startTrainPlacementDrag();
      });
   }

   /**
    * Initialize new object menu
    * @private
    */
   #initializeNewObjectMenu(): void {
      const app = (window as any).app;
      $("#btnAddText").onclick(() => {
         app.customMouseMode = $("#btnAddText").hasClass("active") ? CUSTOM_MOUSE_ACTION.TEXT : CUSTOM_MOUSE_ACTION.NONE;
         this.activateCustomMouseMode();
      });
      $("#btnAddPlatform").onclick(() => {
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
    * Handle renderer UI update (called by Application)
    * @param textured - Whether to use textured renderer
    */
   handleRendererUIUpdate(textured: boolean): void {
      this.#rendererChoiceCardsHandle?.syncSelection(textured);
      this.#startScreenRendererHandle?.syncSelection(textured);
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
      this.#startScreen.show();
   }

   /**
    * Hide start screen
    */
   hideStartScreen(): void {
      this.#startScreen.hide();
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

