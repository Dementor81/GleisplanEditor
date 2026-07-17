"use strict";

import { STORAGE } from "../storage.ts";
import type { RendererChoiceCardsHandle } from "./rendererChoiceCards.ts";

const START_SCREEN_MARKUP = `
<div class="modal fade" id="loadModal" tabindex="-1" aria-labelledby="loadModalTitle">
   <div class="modal-dialog modal-dialog-scrollable modal-dialog-centered modal-lg modal-fullscreen-lg-down modal-renderer-choice">
      <div class="modal-content">
         <div class="modal-header">
            <img src="logo.svg" alt="" width="70" height="70" />
            <div>
               <h5 class="modal-title" id="loadModalTitle">Willkommen beim Bahn Baukasten</h5>
               <p class="mb-0 text-muted small">
                  Wähle die Darstellung und eine Beispiel-Strecke, dann tippe unten auf Start.
               </p>
            </div>
            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Schließen"></button>
         </div>
         <div class="modal-body">
            <p class="small text-secondary mb-2">Darstellung</p>
            <div id="startScreenRendererMount"></div>
            <hr class="my-4" />
            <p class="small text-secondary mb-2">Beispiel-Strecke</p>
            <div class="row g-3 align-items-start">
               <div class="col-md-4">
                  <div class="list-group" id="startScreenLayoutTab" role="tablist">
                     <a class="list-group-item list-group-item-action active"
                        id="startScreen-layout-2g-tab"
                        data-bs-toggle="list"
                        href="#startScreen-layout-2g-panel"
                        data-layout="2gleisig"
                        role="tab"
                        aria-controls="startScreen-layout-2g-panel"
                        aria-selected="true">Zweigleisig</a>
                     <a class="list-group-item list-group-item-action"
                        id="startScreen-layout-1g-tab"
                        data-bs-toggle="list"
                        href="#startScreen-layout-1g-panel"
                        data-layout="1gleisig"
                        role="tab"
                        aria-controls="startScreen-layout-1g-panel"
                        aria-selected="false">Eingleisig</a>
                     <a class="list-group-item list-group-item-action"
                        id="startScreen-layout-empty-tab"
                        data-bs-toggle="list"
                        href="#startScreen-layout-empty-panel"
                        data-layout="empty"
                        role="tab"
                        aria-controls="startScreen-layout-empty-panel"
                        aria-selected="false">Leer</a>
                  </div>
               </div>
               <div class="col-md-8">
                  <div class="tab-content" id="startScreenLayoutTabContent">
                     <div class="tab-pane fade show active"
                        id="startScreen-layout-2g-panel"
                        role="tabpanel"
                        aria-labelledby="startScreen-layout-2g-tab">
                        <div class="start-screen-layout-preview-frame start-screen-layout-preview-frame--2g mb-3">
                           <img src="assets/static_images/gleisplan2.png"
                              alt="Vorschau zweigleisige Beispielstrecke"
                              class="start-screen-layout-preview-img"
                              decoding="async" />
                        </div>
                        <p class="mb-0 small">Dieses Layout besteht aus mehreren Bahnhöfen hintereinander an einer zweigleisigen Strecke mit einer Abzweig- und einer Überleitstelle.</p>
                     </div>
                     <div class="tab-pane fade"
                        id="startScreen-layout-1g-panel"
                        role="tabpanel"
                        aria-labelledby="startScreen-layout-1g-tab">
                        <div class="start-screen-layout-preview-frame start-screen-layout-preview-frame--1g mb-3">
                           <img src="assets/static_images/gleisplan1.png"
                              alt="Vorschau eingleisige Beispielstrecke"
                              class="start-screen-layout-preview-img"
                              decoding="async" />
                        </div>
                        <p class="mb-0 small">Dieses Layout zeigt eine eingleisige Strecke mit mehreren Bahnhöfen an denen Züge kreuzen können.</p>
                     </div>
                     <div class="tab-pane fade"
                        id="startScreen-layout-empty-panel"
                        role="tabpanel"
                        aria-labelledby="startScreen-layout-empty-tab">
                        <p class="mb-0 small">Ein leerer Zeichenbereich ohne vorgegebenes Gleisnetz. Im Menü kannst du später ein vorgegebenes Layout oder ein lokal gespeichertes Gleisnetz laden.</p>
                     </div>
                  </div>
               </div>
            </div>
         </div>
         <div class="modal-footer">
            <button type="button" class="btn btn-primary" id="btnStartWelcome">Start</button>
         </div>
      </div>
   </div>
</div>
`;

/**
 * Welcome modal: renderer choice + layout choice + footer Start.
 */
export class StartScreen {
   #rendererChoiceHandle: RendererChoiceCardsHandle | null = null;

   setRendererChoiceHandle(handle: RendererChoiceCardsHandle | null): void {
      this.#rendererChoiceHandle = handle;
   }

   mount(): void {
      if (document.getElementById("loadModal")) return;
      const wrapper = document.createElement("div");
      wrapper.innerHTML = START_SCREEN_MARKUP.trim();
      const root = wrapper.firstElementChild;
      if (!root) return;
      document.body.appendChild(root);
   }

   show(): void {
      const app = (window as any).app;
      const bootstrap = (window as any).bootstrap;
      const loadModal = document.getElementById("loadModal");
      if (!loadModal || !app || !bootstrap) return;

      this.#rendererChoiceHandle?.syncSelection(app.renderingManager.usesAdvancedRenderer());

      const btnStart = $("#btnStartWelcome");
      btnStart.off("click").on("click", () => {
         const advanced = this.#rendererChoiceHandle?.getSelectedAdvanced() ?? true;
         app.renderingManager.selectRenderer(advanced);
         STORAGE.save();

         const layout = $("#startScreenLayoutTab .list-group-item.active").attr("data-layout");
         if (!layout) return;

         const finish = () => {
            this.hide();
            app.renderingManager.drawGrid();
            app.renderingManager.renderer.reDrawEverything(true);
         };

         if (layout === "empty") {
            finish();
            return;
         }

         STORAGE.loadPrebuildbyName(layout).then(() => {
            finish();
            STORAGE.saveUndoHistory();
         });
      });

      const m = bootstrap.Modal.getOrCreateInstance(loadModal);
      const onHidden = () => {
         bootstrap.Modal.getInstance(loadModal)?.dispose();
         btnStart.off("click");
      };
      loadModal.addEventListener("hidden.bs.modal", onHidden, { once: true });
      m.show();
   }

   hide(): void {
      const loadModal = document.getElementById("loadModal");
      const bootstrap = (window as any).bootstrap;
      if (!loadModal || !bootstrap) return;
      $("#myCanvas").trigger("focus");
      const inst = bootstrap.Modal.getInstance(loadModal);
      inst?.hide();
   }
}
