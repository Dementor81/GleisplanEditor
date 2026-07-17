"use strict";

// ES6 Module imports
import { Collapse, Modal, Offcanvas } from "bootstrap";
import { CUSTOM_MOUSE_ACTION, MENU, Menu, COLORS } from "../config.ts";
import { STORAGE } from "../storage.ts";
import { ui } from "../ui.ts";
import { Sig_UI } from "../sig_ui.ts";
import { SignalRenderer } from "../rendering/signalRenderer.ts";
import { Track } from "../track.ts";
import { Train } from "../train.ts";
import { GenericObject } from "../generic_object.ts";
import { RailwayCrossing } from "../railway_crossing.ts";
import type { Application } from "../application.ts";
import { createLayerContainer } from "../pixiUtils.ts";
import { mountRendererChoiceCards, type RendererChoiceCardsHandle } from "../ui/rendererChoiceCards.ts";
import { DrawingPanel } from "../ui/DrawingPanel.ts";
import { StartScreen } from "../ui/StartScreen.ts";
import { ViewportHud } from "../ui/ViewportHud.ts";
import { NewObjectMenu } from "../ui/NewObjectMenu.ts";

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
   advanced?: boolean;
}

/**
 * UIManager handles all UI-related functionality
 * This class manages menus, modals, and UI state
 */
export class UIManager {
   #app: Application;
   #activeMenu: Menu | null = null;
   #rendererChoiceCardsHandle: RendererChoiceCardsHandle | null = null;
   #startScreenRendererHandle: RendererChoiceCardsHandle | null = null;
   #drawingPanel = new DrawingPanel();
   #startScreen = new StartScreen();
   #viewportHud = new ViewportHud();
   #newObjectMenu = new NewObjectMenu();

   constructor(application: Application) {
      this.#app = application;
   }

   get rendererChoiceCardsHandle(): RendererChoiceCardsHandle | null {
      return this.#rendererChoiceCardsHandle;
   }

   get drawingPanel(): DrawingPanel {
      return this.#drawingPanel;
   }

   deactivateNewObjectTool(): void {
      this.#newObjectMenu.deactivate();
   }

   /**
    * Initialize UI components
    */
   initialize(): void {
      this.#applyDarkMode(STORAGE.getDarkMode());
      this.#startScreen.mount();
      this.#rendererChoiceCardsHandle = mountRendererChoiceCards($("#rendererChoiceModalMount"));
      const $startMount = $("#startScreenRendererMount");
      if ($startMount.length) {
         this.#startScreenRendererHandle = mountRendererChoiceCards($startMount);
         this.#startScreen.setRendererChoiceHandle(this.#startScreenRendererHandle);
      }
      const advanced = this.#app.renderingManager?.usesAdvancedRenderer();
      if (advanced !== undefined) {
         this.#rendererChoiceCardsHandle?.syncSelection(advanced);
         this.#startScreenRendererHandle?.syncSelection(advanced);
      }
      this.#initializeSignalMenu();
      this.#initializeInterManagerCommunication();
      this.#initializeButtonEvents();
      this.#viewportHud.mount();
      this.#newObjectMenu.mount();
   }

   #applyDarkMode(enabled: boolean): void {
      document.documentElement.setAttribute("data-bs-theme", enabled ? "dark" : "light");
      document.documentElement.classList.toggle("dark-mode", enabled);
      COLORS.GRID = enabled ? COLORS.GRID_DARK : COLORS.GRID_LIGHT;
      this.#app.renderingManager?.drawGrid(true);

      const $item = $("#menuDarkMode");
      if ($item.length) {
         $item.attr("aria-checked", enabled ? "true" : "false");
         $item.find(".dark-mode-check").toggleClass("d-none", !enabled);
      }
   }

   /**
    * Initialize inter-manager communication
    * @private
    */
   #initializeInterManagerCommunication(): void {
      this.#app.eventManager!.on("rendererChanged", (data: EventData) => {
         this.handleRendererUIUpdate(data.advanced ?? false);
      });
   }

   #afterAdvancedPlanLoad(): void {
      const rm = this.#app.renderingManager;
      rm?.drawGrid();
      rm?.renderer.reDrawEverything(true);
      $("#myCanvas").trigger("focus");
   }

   #collapseNewItemsMenubarOnMobile(): void {
      if (window.matchMedia("(min-width: 992px)").matches) return;
      const el = document.getElementById("newItemsMenubarCollapse");
      if (!el?.classList.contains("show")) return;
      Collapse.getOrCreateInstance(el).hide();
   }

   #initializeButtonEvents(): void {
      $("#btnAddSignals").onclick(() => {
         this.#collapseNewItemsMenubarOnMobile();
         this.showMenu(MENU.NEW_SIGNAL);
      });
      $("#btnAddTrain").onclick(() => {
         this.#collapseNewItemsMenubarOnMobile();
         this.showMenu(MENU.NEW_TRAIN);
      });
      $("#btnAddObject").onclick(() => {
         this.#collapseNewItemsMenubarOnMobile();
         this.showMenu(MENU.NEW_OBJECT);
      });
      $("#menuNeu").onclick(() => this.showStartScreen());
      $("#menuSpeichern").onclick(() => STORAGE.downloadAsFile());
      $("#menuModusAendern").onclick(() => {
         Modal.getOrCreateInstance(document.getElementById("rendererChoiceModal")!).show();
      });
      $("#menuDarkMode").onclick(() => {
         const enabled = !STORAGE.getDarkMode();
         STORAGE.setDarkMode(enabled);
         this.#applyDarkMode(enabled);
      });

      $("#menuLoadFromFile").onclick(() => {
         STORAGE.restoreFromFile().then(() => {
            this.#afterAdvancedPlanLoad();
            STORAGE.saveUndoHistory();
         });
      });

      const rendererModalEl = document.getElementById("rendererChoiceModal");
      rendererModalEl?.addEventListener("show.bs.modal", () => {
         this.handleRendererUIUpdate(this.#app.renderingManager?.usesAdvancedRenderer() ?? true);
      });

      $("#btnRendererChoiceOk").onclick(() => {
         const handle = this.rendererChoiceCardsHandle;
         if (!handle) return;
         this.#app.renderingManager?.selectRenderer(handle.getSelectedAdvanced());
         STORAGE.save();
         Modal.getInstance(document.getElementById("rendererChoiceModal")!)?.hide();
      });

      $("#btnClear").onclick(() => this.#app.renderingManager?.clear());
      $("#btnRedraw").onclick(() => this.#app.renderingManager?.forceRedraw());
      $("#btnImage").onclick(this.#handleImageExport.bind(this));
      $("#btnDraw").onclick(this.#handleDrawToggle.bind(this));
      $("#btnLock").onclick(this.#handleLockToggle.bind(this));
      $(this.#drawingPanel.btnClear).onclick(this.#handleDrawingClear.bind(this));

      $(this.#drawingPanel.btnEraser).onclick(() => {
         const modeActive = this.#app.customMouseMode === CUSTOM_MOUSE_ACTION.ERASER;
         this.#drawingPanel.setEraserActive(!modeActive);
         this.#app.customMouseMode = !modeActive ? CUSTOM_MOUSE_ACTION.ERASER : CUSTOM_MOUSE_ACTION.DRAWING;
      });

      $("#btnUndo").onclick(() => this.#app.undo());
      $("#signalEditMenuHeader a").on("click", this.#handleSignalEditClick.bind(this));
   }

   /**
    * Initialize signal menu
    * @private
    */
   #initializeSignalMenu(): void {
      const accordionId = "#newItemMenuAccordination";
      $(accordionId).append([
         ui.createAccordionItem(
            "Hauptsignale",
            accordionId,
            this.#createNewItemButtons(
               this.#app.signalTemplates.hv_hp,
               this.#app.signalTemplates.ks,
               this.#app.signalTemplates.form_hp,
               this.#app.signalTemplates.ls
            ) as any,
            true
         ),
         ui.createAccordionItem(
            "Vorsignale",
            accordionId,
            this.#createNewItemButtons(
               this.#app.signalTemplates.hv_vr,
               this.#app.signalTemplates.ks_vr,
               this.#app.signalTemplates.form_vr
            ) as any
         ),
         ui.createAccordionItem(
            "Lf-Signale",
            accordionId,
            this.#createNewItemButtons(
               this.#app.signalTemplates.lf1,
               this.#app.signalTemplates.lf2,
               this.#app.signalTemplates.lf3,
               this.#app.signalTemplates.lf6,
               this.#app.signalTemplates.lf7
            ) as any
         ),
         ui.createAccordionItem(
            "Ne-Signale",
            accordionId,
            this.#createNewItemButtons(
               this.#app.signalTemplates.ne4,
               this.#app.signalTemplates.ne5,
               this.#app.signalTemplates.ne1,
               this.#app.signalTemplates.ne2,
               this.#app.signalTemplates.ne_3,
               this.#app.signalTemplates.ne14
            ) as any
         ),
         ui.createAccordionItem(
            "Zusatzsignale",
            accordionId,
            this.#createNewItemButtons(
               this.#app.signalTemplates.zs3,
               this.#app.signalTemplates.zs3v,
               this.#app.signalTemplates.zs6,
               this.#app.signalTemplates.zs10,
               this.#app.signalTemplates.zusatzSignal
            ) as any
         ),
         ui.createAccordionItem(
            "Weitere",
            accordionId,
            this.#createNewItemButtons(
               this.#app.signalTemplates.ra10
            ) as any
         ),
         ui.createAccordionItem(
            "Bahnübergang",
            accordionId,
            this.#createNewItemButtons(
               this.#app.signalTemplates.bue,
               this.#app.signalTemplates["bü_kennzeichen"],
               this.#app.signalTemplates["bü_2"],
               this.#app.signalTemplates["bü_3"]
            ) as any
         ),
      ]);
   }

   /**
    * Create new item buttons for UI
    * @private
    */
   #createNewItemButtons(...templates: (SignalTemplate | null | undefined)[]): JQuery[] {
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
                  this.#app.eventManager!.startSignalDragFromTemplate(template);
               });
         })
         .filter((item): item is JQuery => item !== null);
   }

   /**
    * Generate data URL from signal template for preview
    * @private
    */
   #getDataURLFromTemplate(template: SignalTemplate): string {
      const tmpStage = createLayerContainer("signalPreview");
      tmpStage.scale.set(template.scale);

      SignalRenderer.drawPreview(template, tmpStage);

      const sig_bounds = tmpStage.getLocalBounds();
      if (sig_bounds == null) throw Error(template.title + " has no visual Element visible");
      const canvas = this.#app.renderingManager!.pixiApp.renderer.extract.canvas({
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
      const sidebar = document.getElementById("sidebar")!;
      const bsOffcanvas = Offcanvas.getOrCreateInstance(sidebar);
      $("input,button", sidebar).off().removeClass("active");

      if (menu == null) {
         bsOffcanvas.hide();
         this.#activeMenu = null;
         return;
      }

      let div_id: string;

      switch (menu) {
         case MENU.EDIT_SIGNAL:
            div_id = "signalEditMenu";
            Sig_UI.initSignalAspectsMenu(this.#app.selection.object);
            Sig_UI.initSignalConfigurationMenu();
            Sig_UI.syncSignalMenu(this.#app.selection.object);
            break;
         case MENU.NEW_SIGNAL:
            div_id = "newItemMenu";
            break;
         case MENU.EDIT_TRAIN:
            div_id = "editTrainMenu";
            Train.initEditTrainMenu(this.#app.selection.object);
            break;
         case MENU.NEW_TRAIN:
            div_id = "newTrainMenu";
            this.#initializeNewTrainMenu();
            break;
         case MENU.NEW_OBJECT:
            div_id = "newObjectMenu";
            this.#newObjectMenu.activate();
            break;
         case MENU.EDIT_OBJECT:
            div_id = "editObjectMenu";
            GenericObject.initEditMenu(this.#app.selection.object);
            break;
         case MENU.EDIT_TRACK:
            div_id = "editTrackMenu";
            Track.initEditTrackMenu(this.#app.selection.object);
            break;
         case MENU.EDIT_RAILWAY_CROSSING:
            div_id = "editRailwayCrossingMenu";
            RailwayCrossing.initEditMenu(this.#app.selection.object);
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
      $("#newTrain").off("mousedown").on("mousedown", (_e: JQuery.MouseDownEvent) => {
         this.#app.eventManager!.startTrainPlacementDrag();
      });
   }

   async #handleImageExport(): Promise<void> {
      const viewport = this.#app.renderingManager!.viewport;
      const backup = { x: viewport.x, y: viewport.y, scale: viewport.scale.x };

      try {
         const rm = this.#app.renderingManager!;
         const renderer = rm.pixiApp.renderer;

         rm.reDrawEverything(true, true);

         const bounds = rm.viewport.getLocalBounds();
         if (!(bounds.width > 0 && bounds.height > 0 && Number.isFinite(bounds.width + bounds.height))) {
            ui.showInfoToast("Nix zu sehen");
            return;
         }

         const width = Math.max(1, Math.ceil(bounds.width));
         const height = Math.max(1, Math.ceil(bounds.height));
         const gl = (renderer as { gl?: WebGLRenderingContext }).gl;
         const maxDim = gl ? gl.getParameter(gl.MAX_TEXTURE_SIZE) : 8192;
         const exportResolution = Math.min(2, maxDim / Math.max(width, height));

         rm.setGridVisible(false);
         rm.containers.drawing.visible = false;
         rm.containers.ui.visible = false;
         rm.update();

         const imgData = await renderer.extract.base64({
            target: rm.viewport,
            resolution: exportResolution,
            clearColor: "#00000000",
            antialias: false,
         });
         const img = $("<img>", { src: imgData, width: "100%" }).css("object-fit", "scale-down").css("max-height", "50vh");
         ui.showModalDialog(img, () => {
            const link = $("<a>", { download: "gleisplan.png", href: imgData });
            link[0].click();
         });
      } catch (error) {
         ui.showErrorToast(error as Error);
      } finally {
         viewport.x = backup.x;
         viewport.y = backup.y;
         viewport.scale.set(backup.scale);
         this.#app.renderingManager!.setGridVisible(true);
         this.#app.renderingManager!.containers.drawing.visible = true;
         this.#app.renderingManager!.containers.ui.visible = true;
         this.#app.renderingManager?.reDrawEverything(true);
         this.#app.renderingManager!.update();
         this.#app.renderingManager?.notifyViewportChanged();
      }
   }

   #handleDrawToggle(): void {
      if (this.#app.planLocked) {
         $("#btnDraw").removeClass("active");
         return;
      }
      this.#app.customMouseMode = $("#btnDraw").hasClass("active") ? CUSTOM_MOUSE_ACTION.DRAWING : CUSTOM_MOUSE_ACTION.NONE;
      this.#drawingPanel.setEraserActive(false);
      if (this.#app.customMouseMode === CUSTOM_MOUSE_ACTION.DRAWING) {
         this.#drawingPanel.show();
      } else {
         this.#drawingPanel.hide();
      }
   }

   #handleLockToggle(): void {
      const locked = $("#btnLock").hasClass("active");
      $("#btnLock i")
         .toggleClass("bi-lock", locked)
         .toggleClass("bi-unlock-fill", !locked);
      this.#app.planLocked = locked;
   }

   syncPlanLockUI(): void {
      const locked = this.#app.planLocked;

      if (locked) {
         $("#btnDraw").removeClass("active");
         this.#drawingPanel.setEraserActive(false);
         this.#drawingPanel.hide();
         this.#newObjectMenu.deactivate();
      }

      $("#btnDraw").prop("disabled", locked);
      $("#btnUndo").prop("disabled", locked || this.#app.undoHistory.length <= 1);
      $("#btnAddSignals").prop("disabled", locked);
      $("#btnAddObject").prop("disabled", locked);
      $(
         "#btnRemoveTrack, #btnRemoveSignal, #btnRemoveObject, #btnRemoveRailwayCrossing, #btnRemoveTrain"
      ).prop("disabled", locked);

      if (!locked) this.updateUndoButtonState();
   }

   #handleDrawingClear(): void {
      this.#app.renderingManager?.containers.drawing.removeChildren();
      this.#app.renderingManager?.update();
   }

   #handleSignalEditClick(): void {
      $("#signalEditMenuHeader .card-text").hide();
      $("#signalEditMenuHeader input")
         .val(this.#app.selection.object.get("bez"))
         .show()
         .focus()
         .on("keydown", (event) => {
            if (event.key !== "Enter") return;
            this.#app.selection.object.setSignalAspect("bez", (event.target as HTMLInputElement).value);
            $("#signalEditMenuHeader .card-text").show();
            $("#signalEditMenuHeader input").hide();
            Sig_UI.syncSignalMenu(this.#app.selection.object);
            STORAGE.save();
         })
         .on("blur", () => {
            $("#signalEditMenuHeader .card-text").show();
            $("#signalEditMenuHeader input").hide();
         });
   }

   /**
    * Handle renderer UI update (called by Application)
    * @param advanced - Whether to use the advanced renderer
    */
   handleRendererUIUpdate(advanced: boolean): void {
      this.#rendererChoiceCardsHandle?.syncSelection(advanced);
      this.#startScreenRendererHandle?.syncSelection(advanced);
   }

   /**
    * Update undo button state
    */
   updateUndoButtonState(): void {
      $("#btnUndo").prop("disabled", this.#app.planLocked || this.#app.undoHistory.length <= 1);
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

