"use strict";

import { CUSTOM_MOUSE_ACTION, type CustomMouseAction } from "../config.ts";

type ObjectKind = "text" | "platform";

interface ObjectKindDef {
   buttonId: string;
   mode: CustomMouseAction;
   hint: string;
}

const KINDS: Record<ObjectKind, ObjectKindDef> = {
   text: {
      buttonId: "btnAddText",
      mode: CUSTOM_MOUSE_ACTION.TEXT,
      hint: "Klicke an die gewünschte Stelle im Gleisplan, um eine Beschriftung zu platzieren.",
   },
   platform: {
      buttonId: "btnAddPlatform",
      mode: CUSTOM_MOUSE_ACTION.PLATTFORM,
      hint: "Ziehe entlang eines Gleises, um einen Bahnsteig zu zeichnen.",
   },
};

const MARKUP = `
<div id="newObjectMenu" class="sidebar_menu">
   <div id="newObjectMenuHeader" class="sidebar_menue_header">
      <h5 class="card-title">Weitere Elemente</h5>
      <p class="card-text">Wähle weitere Elemente aus, um sie im Gleisplan hinzuzufügen</p>
   </div>
   <div class="d-grid gap-2">
      <button id="btnAddText" type="button" class="btn btn-secondary" title="Beschriftung hinzufügen">
         <i class="bi bi-card-text"></i> Beschriftung
      </button>
      <button id="btnAddPlatform" type="button" class="btn btn-secondary" title="Bahnsteig hinzufügen">
         <i class="bi bi-signpost"></i> Bahnsteig
      </button>
   </div>
   <div id="newObjectMenuHint" class="alert alert-info mt-3 mb-0 small" role="status" style="display: none;"></div>
</div>
`.trim();

/**
 * Sidebar menu for adding non-track objects (text labels, platforms).
 * Buttons are mutually exclusive; selecting one shows a contextual hint.
 */
export class NewObjectMenu {
   mount(): void {
      if (document.getElementById("newObjectMenu")) return;
      $(MARKUP).appendTo("#sidebar");
   }

   /** Called every time the menu is shown; (re)binds events and resets state. */
   activate(): void {
      this.#setActive(null);
      (Object.keys(KINDS) as ObjectKind[]).forEach((kind) => {
         $("#" + KINDS[kind].buttonId)
            .off("click")
            .onclick(() => this.#toggle(kind));
      });
   }

   #toggle(kind: ObjectKind): void {
      const isActive = $("#" + KINDS[kind].buttonId).hasClass("active");
      this.#setActive(isActive ? null : kind);
   }

   #setActive(kind: ObjectKind | null): void {
      const app = (window as any).app;
      (Object.keys(KINDS) as ObjectKind[]).forEach((k) => {
         $("#" + KINDS[k].buttonId).toggleClass("active", k === kind);
      });

      const $hint = $("#newObjectMenuHint");
      if (kind) $hint.text(KINDS[kind].hint).show();
      else $hint.hide();

      app.customMouseMode = kind ? KINDS[kind].mode : CUSTOM_MOUSE_ACTION.NONE;
   }
}
