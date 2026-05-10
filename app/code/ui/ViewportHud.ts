"use strict";

export class ViewportHud {
   static readonly #markup = `
<div id="viewportHudRoot" class="position-fixed bottom-0 end-0 m-3 " style="z-index: 98">
   <div class="card bg-dark text-white border-secondary toolbar-shadow">
      <div class="card-body py-2 px-3 d-flex align-items-center gap-2">
         <span class="badge text-bg-secondary user-select-none" id="viewportHudZoom" aria-live="polite">100%</span>
         <div class="btn-group" role="group" aria-label="Ansicht">
            <button type="button" class="btn btn-sm btn-outline-light" id="viewportHudResetZoom" title="Zoom auf 100 %" aria-label="Zoom auf 100 Prozent">
               <i class="bi bi-arrows-angle-contract" aria-hidden="true"></i>
            </button>
            <button type="button" class="btn btn-sm btn-outline-light" id="viewportHudResetScroll" title="zurück zum Startpunkt" aria-label="zurück zum Startpunkt">
               <i class="bi bi-arrows-move" aria-hidden="true"></i>
            </button>
         </div>
      </div>
   </div>
</div>`;

   #boundRefresh = this.#refresh.bind(this);

   mount(): void {
      if (document.getElementById("viewportHudRoot")) return;
      $(ViewportHud.#markup).appendTo("body");
      $("#viewportHudResetZoom").on("click", () => {
         (window as any).app?.renderingManager?.resetZoom();
      });
      $("#viewportHudResetScroll").on("click", () => {
         (window as any).app?.renderingManager?.resetScroll();
      });
      const em = (window as any).app?.eventManager;
      em?.on("viewportChanged", this.#boundRefresh);
      this.#refresh();
   }

   #refresh(): void {
      const scale = (window as any).app?.renderingManager?.viewport?.scale?.x;
      const pct = Math.round((typeof scale === "number" ? scale : 1) * 100);
      $("#viewportHudZoom").text(`${pct}%`);
   }
}
