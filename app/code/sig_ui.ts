"use strict";

// ES6 Module imports
import { ui } from './ui.ts';
import { ArrayUtils } from './utils.ts';
import { STORAGE } from './storage.ts';
import { Application } from './application.ts';

export class Sig_UI {
   static create_SpeedDropDown(signal: any, text: string, onChange: any) {
      const items = Array.from({ length: 10 }, (_, i) => `${i}0|${signal}=${i}`);
      items[0] = `aus|${signal}=-1`;
      return ui.create_DropDown(items, text, onChange);
   }
   static initSignalMenu() {
      const conditions = Application.getInstance().selection.object._template.getAllVisualElementConditions();
      const update = function (this: any, command: any, isOn: any) {
         Application.getInstance().selection.object.set_stellung(command, isOn);
         Sig_UI.syncSignalMenu(Application.getInstance().selection.object);
         Application.getInstance().renderingManager!.reDrawEverything();
         Application.getInstance().renderingManager!.update();
         STORAGE.save();
      };
      let signalConfigurationTab = $("#SignalConfigurationTab");

      $("#btnGrundstellung").on("click", Sig_UI.handleGrundstellung as any);
      $("#btnRemoveSignal").on("click", () => Application.getInstance().deleteSelectedObject());
      signalConfigurationTab.empty();
      if (Application.getInstance().selection.object.check("HPsig"))
         signalConfigurationTab.append(
            ui.div(
               "p-3 border-bottom",
               ui.create_DropDown(
                  "Esig,Asig,Zsig,Bksig,Sbk".split(",").map((x: any) => x + "|verw=" + x.toLowerCase()),
                  "Verwendung",
                  update
               )
            )
         );
      signalConfigurationTab.append(
         ui.createSwitchStructure(
            ["Vorsignalfunktion", "VRsig", conditions.includes("VRsig")],
            [
               ...(conditions.includes("vr_op=verk") ? [["verkürzt", "vr_op=verk"]] : []),
               ...(conditions.includes("vr_op=wdh") ? [["wiederholer", "vr_op=wdh"]] : []),
            ],
            update
         )?.addClass("p-3 border-bottom")
      );
      if (conditions.includes("mastschild=wrw") && conditions.includes("mastschild=wgwgw"))
         signalConfigurationTab.append(
            ui.createOptionGroup(
               "Mastschild",
               [
                  ["W-R-W", "mastschild=wrw"],
                  ["W-G-W-G-W", "mastschild=wgwgw"],
               ],
               "radio",
               update
            ).addClass("p-3 border-bottom")
         );
      if (conditions.includes("zusatz_unten") || conditions.includes("zusatz_oben")) {
         const a: any[] = [
            ["unten", "zusatz_unten"],
            ["oben", "zusatz_oben"],
         ];
         a.forEach((x) => x.push(conditions.includes(x[1])));

         signalConfigurationTab.append(ui.createOptionGroup("Zusatzanzeiger", a, "checkbox", update).addClass("p-3 border-bottom"));
      }
   }
   static syncSignalMenu(signal: any) {
      //header
      $("#signalEditMenuHeader .card-title").text(signal._template.title);
      $("#signalEditMenuHeader .card-text>span").text(signal.title);
      //feature Menu
      $("#SignalConfigurationTab>div a").each(function () {
         const $a = $(this);
         $a.toggleClass("active", signal.check($a.attr("value")));
      });

      $("#SignalConfigurationTab>div input").each(function () {
         const input = $(this);
         const v = signal.check(input.attr("value"));
         input.prop("checked", v ? "checked" : null);
         if (input.attr("data-master_switch") != null) $("input", input.parent().next()).prop("disabled", !v);
      });
   }
   static getHTML(signal: any) {
      if (signal._template.signalMenu?.length) {
         const ul = ui.div("d-flex flex-column bd-highlight mb-3");

         const updateFunc = function (this: any, command: any, active: boolean) {
            signal.set_stellung(command, !active);
            Application.getInstance().renderingManager!.reDrawEverything();
            Application.getInstance().renderingManager!.update();
            Sig_UI.checkBootstrapMenu(signal, signal._template.signalMenu, ul);
            STORAGE.save();
         };

         ul.append(signal._template.signalMenu.map((data: any) => Sig_UI.createBootstrapMenuItems(signal, data, updateFunc)));

         Sig_UI.checkBootstrapMenu(signal, signal._template.signalMenu, ul);

         return ul;
      }
      return "";
   }
   static createBootstrapMenuItems(signal: any, menu_item: any, update: any) {
      if (menu_item) {
         if (Array.isArray(menu_item)) {
            let items = ArrayUtils.cleanUp(menu_item.map((item) => Sig_UI.createBootstrapMenuItems(signal, item, update)));
            if (items) {
               return ui.div("p-3 border-bottom", ui.create_buttonToolbar(items));
            } else return null;
         } else if (menu_item.type == "buttonGroup" || menu_item.type == "btn") {
            let buttons = menu_item.type == "buttonGroup" ? menu_item.items : [menu_item];
            buttons = buttons
               .filter(
                  (mi: any) =>
                     mi.visual_elements?.length > 0 &&
                     mi.visual_elements.every((ve: any) => {
                        let on = ve.on();
                        if (Array.isArray(on)) {
                           if (on.includes(mi.command)) on = on.toSpliced(on.indexOf(mi.command), 1);
                        } else if (on == mi.command) return true;

                        return signal.check(on);
                     })
               )
               .map((item: any) =>
                  ui
                     .create_toggleButton(item.text, item.command)
                     .on("click", (e: any) => update.bind(signal)(item.command, $(e.target).hasClass("active")))
               )
            buttons = ArrayUtils.cleanUp(buttons);
            if (buttons) return ui.create_buttonGroup(buttons);
            else return null;
         } else if (menu_item.type == "dropdown") {
            return Sig_UI.create_SpeedDropDown(menu_item.command, menu_item.text, update.bind(signal));
         }
      }
   }
   static checkBootstrapMenu(signal: any, data: any, popup: any) {
      if (data) {
         if (Array.isArray(data)) {
            data.forEach((item) => Sig_UI.checkBootstrapMenu(signal, item, popup));
         } else if (data.type == "buttonGroup") {
            data.items.forEach((item: any) => {
               let button = $("#btn_" + item.text.replace(" ", "_"), popup);
               if (button.length == 1) {
                  button.toggleClass("active", signal.check(item.command));
                  if (item.visual_elements.every((ve: any) => ve.isAllowed(signal))) button.removeAttr("disabled");
                  else button.attr("disabled", "disabled");
               }
            });
         } else if (data.type == "dropdown") {
            let button = $("#btn_" + data.text.replace(" ", "_"), popup);
            if (button.length == 1) {
               const v = signal.get(data.command);
               button.text(data.text + (v > 0 ? " Kz " + v : " aus"));
            }
         } else if (data.type == "btn") {
            let button = $("#btn_" + data.text.replace(" ", "_"), popup);
            if (button.length == 1) {
               button.toggleClass("active", signal.check(data.command));
               if (data.visual_elements.every((ve: any) => ve.isAllowed(signal))) button.removeAttr("disabled");
               else button.attr("disabled", "disabled");
            }
         }
      }
   }
   /**
    * Handle Grundstellung
    * @private
    */
   static handleGrundstellung(e: any) {
      const selection = (window as any).app.selection;
      if (selection.type == "Signal") {
         [].concat(selection.object).forEach((s: any) => {
            s._signalStellung = {};
            if (s._template.initialSignalStellung)
               s._template.initialSignalStellung.forEach((i: any) => s.set_stellung(i, null, true));
            STORAGE.save();
            (window as any).app.renderingManager.renderer.reDrawEverything(true);
            (window as any).app.renderingManager.update();
         });
      }
   }
}


