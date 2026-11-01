"use strict";

import { Switch } from "../switch.ts";
import { Track } from "../track.ts";

/** Bottom-left overlay with timings and scene sizes of the last render; only polls while visible. */
export class RenderStatsPanel {
   static readonly #REFRESH_MS = 500;
   static readonly #markup = `
<div id="renderStatsRoot" class="position-fixed bottom-0 start-0 m-3 d-none" style="z-index: 98">
   <div class="card text-white border-secondary toolbar-shadow" style="background: rgba(33, 37, 41, 0.8)">
      <div class="card-body position-relative py-1 px-2 pe-3 font-monospace" style="font-size: 0.7rem">
         <button type="button" class="btn-close btn-close-white position-absolute top-0 end-0 m-1" id="renderStatsClose" aria-label="Schließen" style="font-size: 0.5rem"></button>
         <table class="mb-0"><tbody id="renderStatsRows"></tbody></table>
      </div>
   </div>
</div>`;

   #timer: number | undefined;

   mount(): void {
      if (document.getElementById("renderStatsRoot")) return;
      $(RenderStatsPanel.#markup).appendTo("body");
      $("#renderStatsClose").on("click", () => this.setVisible(false));
   }

   toggle(): boolean {
      return this.setVisible($("#renderStatsRoot").hasClass("d-none"));
   }

   setVisible(visible: boolean): boolean {
      $("#renderStatsRoot").toggleClass("d-none", !visible);
      window.clearInterval(this.#timer);
      if (visible) {
         this.#refresh();
         this.#timer = window.setInterval(() => this.#refresh(), RenderStatsPanel.#REFRESH_MS);
      }
      const $item = $("#menuRenderStats");
      $item.attr("aria-checked", visible ? "true" : "false");
      $item.find(".render-stats-check").toggleClass("d-none", !visible);
      return visible;
   }

   #refresh(): void {
      const rm = (window as any).app?.renderingManager;
      if (!rm) return;
      const stats = rm.stats;
      const tracks = rm.containers.tracks;

      const rows: [string, string][] = [
         ["Neuaufbau", `${stats.redrawMs.toFixed(1)} ms`],
         ["Erzwungen", stats.forced ? "ja" : "nein"],
         ["Neu gezeichnet", `${stats.itemsDrawn} Gleise/Weichen`],
         ["Frame (CPU)", `${stats.frameMs.toFixed(1)} ms`],
         ["Speichern", `${stats.saveMs.toFixed(1)} ms`],
         ["Raster", `${stats.gridMs.toFixed(1)} ms`],
         ["Gleise gerendert", `${tracks.renderedTracks?.size ?? Track.allTracks.length} / ${Track.allTracks.length}`],
         ["Weichen gerendert", `${tracks.renderedSwitches?.size ?? Switch.allSwitches.length} / ${Switch.allSwitches.length}`],
      ];

      $("#renderStatsRows").html(
         rows
            .map(([label, value]) => `<tr><td class="pe-2">${label}</td><td class="text-end">${value}</td></tr>`)
            .join("")
      );
   }
}
