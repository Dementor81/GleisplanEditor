"use strict";

import { ui } from "../ui.ts";

export interface RendererChoiceCardsHandle {
   syncSelection(advanced: boolean): void;
   getSelectedAdvanced(): boolean;
}

const cardSelector = ".renderer-choice-card";

const PREVIEW_ADVANCED = "assets/static_images/complex_preview.png";
const PREVIEW_BASIC = "assets/static_images/simple_preview.png";

/**
 * Mounts a reusable row of two renderer choice cards under $container (clears container first).
 */
export function mountRendererChoiceCards($container: JQuery): RendererChoiceCardsHandle {
   $container.empty();

   const row = ui.div("renderer-choice-card-row").append([
      $("<div>", { class: "renderer-choice-card-col" }).append(
         rendererCard(
            "advanced",
            "Detaillierte Ansicht",
            "Diese Darstellung zeigt die Gleise mit Schwellen und Texturen.",
            PREVIEW_ADVANCED
         )
      ),
      $("<div>", { class: "renderer-choice-card-col" }).append(
         rendererCard(
            "basic",
            "Vereinfachte Ansicht",
            "Einfache Darstellung, optisch nicht so detailliert, dafür lassen sich komplexere Anlagen bauen.",
            PREVIEW_BASIC
         )
      ),
   ]);

   $container.append(row);

   const $cards = $container.find(cardSelector);

   function applyActive(advanced: boolean): void {
      $cards.removeClass("active");
      $cards.filter(`[data-renderer="${advanced ? "advanced" : "basic"}"]`).addClass("active");
   }

   function activateFromElement(el: HTMLElement): void {
      const mode = el.getAttribute("data-renderer");
      applyActive(mode === "advanced");
   }

   $cards.on("click", function (this: HTMLElement) {
      activateFromElement(this);
   });

   return {
      syncSelection(advanced: boolean): void {
         applyActive(advanced);
      },
      getSelectedAdvanced(): boolean {
         const $active = $container.find(`${cardSelector}.active`);
         return ($active.attr("data-renderer") ?? "advanced") === "advanced";
      },
   };
}

function rendererCard(mode: "advanced" | "basic", title: string, text: string, imageSrc: string): JQuery {
   return ui
      .div("card renderer-choice-card h-100 overflow-hidden")
      .attr({
         role: "button",
         tabindex: "0",
         "data-renderer": mode,
      })
      .append([
         $("<img>", {
            class: "card-img-top renderer-choice-card-img",
            src: imageSrc,
            alt: title,
            decoding: "async",
         }),
         ui.div("card-body").append([
            $("<h6>", { class: "card-title", text: title }),
            $("<p>", { class: "card-text small text-secondary mb-0", text }),
         ]),
      ]);
}
