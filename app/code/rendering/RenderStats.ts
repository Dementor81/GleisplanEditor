"use strict";

/** Timings and counters of the most recent scene rebuild (`reDrawEverything`) and Pixi frame. */
export class RenderStats {
   forced = false;
   redrawMs = 0;
   itemsDrawn = 0;
   frameMs = 0;
   saveMs = 0;
   gridMs = 0;
   #redrawStart = 0;

   beginRedraw(forced: boolean): void {
      this.forced = forced;
      this.itemsDrawn = 0;
      this.#redrawStart = performance.now();
   }

   endRedraw(): void {
      this.redrawMs = performance.now() - this.#redrawStart;
   }

   /** Time `draw` and record it as the last Pixi frame (CPU submit time; the GPU runs asynchronously). */
   timeFrame(draw: () => void): void {
      const start = performance.now();
      draw();
      this.frameMs = performance.now() - start;
   }

   timeGrid(draw: () => void): void {
      const start = performance.now();
      draw();
      this.gridMs = performance.now() - start;
   }
}
