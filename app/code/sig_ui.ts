"use strict";

// ES6 Module imports
import { ui } from './ui.ts';
import { ArrayUtils, ConditionUtils } from './utils.ts';
import { STORAGE } from './storage.ts';
import { Application } from './application.ts';
import { Signal } from './signal.ts';
import type { SignalConfigOptionDefinition } from './signalDefinition.ts';

export class Sig_UI {
   static create_SpeedDropDown(signal: any, text: string, onChange: any) {
      const items = Array.from({ length: 10 }, (_, i) => `${i}0|${signal}=${i}`);
      items[0] = `aus|${signal}=-1`;
      return ui.create_DropDown(items, text, onChange);
   }

   /**
    * Builds the signal configuration menu based on the selected signals template and its Conditions.
    */
   static initSignalConfigurationMenu() {

      const app = Application.getInstance();

      let selectedSignal: Signal | null = app.selection.object as Signal | null;
      if (!selectedSignal?._template) return;
      const template = selectedSignal._template;

      const conditions = template.getAllVisualElementConditions();

      const update = function (command: any, isOn?: any) {
         selectedSignal.setSignalAspect(command, isOn);
         Sig_UI.initSignalAspectsMenu(selectedSignal);
         Sig_UI.syncSignalMenu(selectedSignal);
         STORAGE.save();
      };
      let signalConfigurationTab = $("#SignalConfigurationTab");

      $("#btnGrundstellung").on("click", Sig_UI.handleGrundstellung as any);
      $("#btnRemoveSignal").on("click", () => app.deleteSelectedObject());
      signalConfigurationTab.empty();
      if (selectedSignal.check("HPsig"))
         signalConfigurationTab.append(
            ui.div(
               "p-3 border-bottom",
               ui.create_DropDown(
                  "Esig,Asig,Zsig,Bksig,Sbk".split(",").map((x: any) => x + "|verw='" + x.toLowerCase() + "'"),
                  "Verwendung",
                  update
               )
            )
         );
      const vorsignalOptions: [string, string?][] = [];
      if (conditions.includes("vr_op='verk'")) vorsignalOptions.push(["verkürzt", "vr_op='verk'"]);
      if (conditions.includes("vr_op='wdh'")) vorsignalOptions.push(["wiederholer", "vr_op='wdh'"]);

      const vorsignalSwitch = ui.createSwitchStructure(
         ["Vorsignalfunktion", "VRsig", conditions.includes("VRsig")],
         vorsignalOptions,
         update
      );
      if (vorsignalSwitch) signalConfigurationTab.append(vorsignalSwitch.addClass("p-3 border-bottom"));
      if (conditions.includes("zusatz_unten") || conditions.includes("zusatz_oben")) {
         const a: any[] = [
            ["unten", "zusatz_unten"],
            ["oben", "zusatz_oben"],
         ];
         a.forEach((x) => x.push(conditions.includes(x[1])));

         signalConfigurationTab.append(ui.createOptionGroup("Zusatzanzeiger", a, "checkbox", update).addClass("p-3 border-bottom"));
      }

      const configOptions = template.configOptions;
      if (configOptions?.length) {
         const applyConfigOption = (optionName: string, isOn: boolean) => {
            const opt = template.getConfigOption(optionName);
            if (isOn) {
               update(optionName, true);
               if (opt?.convertTo) {
                  const optionKey = optionName.split("=")[0];
                  const convertKey = opt.convertTo.split("=")[0];
                  if (optionKey !== convertKey) update(opt.convertTo, false);
               }
            } else {
               update(optionName, false);
               if (opt?.convertTo) update(opt.convertTo, true);
            }
         };

         signalConfigurationTab.append(
            ui.div(
               "p-3 border-bottom",
               configOptions.map((opt: SignalConfigOptionDefinition) =>
                  ui.div("form-check form-switch", [
                     $("<input/>", {
                        class: "form-check-input",
                        type: "checkbox",
                        role: "switch",
                        id: "switch_config_" + opt.name,
                     })
                        .attr("value", opt.name)
                        .attr("data-config-option", "")
                        .on("change", function () {
                           applyConfigOption($(this).attr("value") ?? "", $(this).is(":checked"));
                        }),
                     $("<label/>", {
                        class: "form-check-label",
                        for: "switch_config_" + opt.name,
                        text: opt.title,
                     }),
                  ])
               )
            )
         );
      }
   }

   static syncConfigOptionSwitches(signal: any) {
      $("#SignalConfigurationTab input[data-config-option]").each(function () {
         const input = $(this);
         input.prop("checked", signal.check(input.attr("value")) ? "checked" : null);
      });
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

      Sig_UI.syncConfigOptionSwitches(signal);
   }

   static initSignalAspectsMenu(signal: any) {
      if (signal._template.signalMenu?.length) {
         const ul = ui.div("d-flex flex-column bd-highlight mb-3");

         const updateFunc = function (this: any, command: any, active: boolean) {
            signal.setSignalAspect(command, !active);
            Sig_UI.checkSignalAspectMenu(signal, signal._template.signalMenu, ul);
            STORAGE.save();
         };

         ul.append(
            ArrayUtils.cleanUp(
               signal._template.signalMenu.map((section: any) =>
                  Sig_UI.createSignalAspectsMenuSection(signal, section, updateFunc)
               )
            ) as any
         );

         Sig_UI.checkSignalAspectMenu(signal, signal._template.signalMenu, ul);

         const tab = $("#signalAspectTab");
         tab.empty();
         tab.append(ul);
      }
   }
   static createSignalAspectsMenuSection(signal: any, section: any, update: any) {
      const items = ArrayUtils.cleanUp(
         section.section.map((item: any) => Sig_UI.createSignalAspectsMenuItem(signal, item, update))
      );
      if (items.length) return ui.div("p-3 border-bottom", ui.create_buttonToolbar(items as any));
      return null;
   }

   static createSignalAspectsMenuItem(signal: any, menu_item: any, update: any) {
      if (!menu_item) return null;

      if (menu_item.type == "buttonGroup" || menu_item.type == "button") {
         let buttons = menu_item.type == "buttonGroup" ? menu_item.items : [menu_item];
         buttons = buttons
            .filter(
               (mi: any) =>
                  mi.visual_elements?.length > 0 &&
                  mi.visual_elements.every((ve: any) => {
                     let on = ve.on();
                     if (Array.isArray(on)) {
                        if (on.includes(mi.command)) {
                           on = [...on];
                           ArrayUtils.remove(on, mi.command);
                        } else if (on.every((c: any) => ConditionUtils.includesPart(c, mi.command))) {
                           return true;
                        }
                     } else if (on == mi.command || ConditionUtils.includesPart(on, mi.command)) return true;

                     return signal.check(on);
                  })
            )
            .map((item: any) =>
               ui
                  .create_toggleButton(item.text)
                  .on("click", (e: any) => update.bind(signal)(item.command, $(e.target).hasClass("active")))
            );
         buttons = ArrayUtils.cleanUp(buttons);
         if (buttons.length) return ui.create_buttonGroup(buttons as any);
         return null;
      }

      if (menu_item.type == "dropdown") {
         return Sig_UI.create_SpeedDropDown(menu_item.command, menu_item.text, update.bind(signal));
      }

      return null;
   }

   static checkSignalAspectMenu(signal: any, menu_configuration: any, html_menu: any) {
      if (!menu_configuration) return;

      if (Array.isArray(menu_configuration)) {
         menu_configuration.forEach((section) => {
            section.section?.forEach((item: any) => Sig_UI.checkSignalAspectMenu(signal, item, html_menu));
         });
         return;
      }

      if (menu_configuration.type == "buttonGroup") {
         menu_configuration.items.forEach((item: any) => {
            let button = $("#btn_" + item.text.replace(" ", "_"), html_menu);
            if (button.length == 1) {
               button.toggleClass("active", signal.check(item.command));
               if (item.visual_elements.every((ve: any) => ve.isAllowed(signal))) button.removeAttr("disabled");
               else button.attr("disabled", "disabled");
            }
         });
      } else if (menu_configuration.type == "dropdown") {
         let button = $("#btn_" + menu_configuration.text.replace(" ", "_"), html_menu);
         if (button.length == 1) {
            const v = signal.get(menu_configuration.command);
            button.text(menu_configuration.text + (v > 0 ? " Kz " + v : " aus"));
         }
      } else if (menu_configuration.type == "button") {
         let button = $("#btn_" + menu_configuration.text.replace(" ", "_"), html_menu);
         if (button.length == 1) {
            button.toggleClass("active", signal.check(menu_configuration.command));
            if (menu_configuration.visual_elements.every((ve: any) => ve.isAllowed(signal))) button.removeAttr("disabled");
            else button.attr("disabled", "disabled");
         }
      }
   }
   /**
    * Handle Grundstellung
    * @private
    */
   static handleGrundstellung() {
      const app = Application.getInstance();
      const selection = app.selection;
      if (selection.type == "Signal") {
         [].concat(selection.object).forEach((s: any) => {
            s._signalStellung = {};
            s._changed = true;
            s._rotationAspectChanged = false;
            s._flipAspectChanged = false;
            app.eventManager?.emit("signalAspectChanged", { signal: s });
            if (s._template.initialSignalStellung)
               s._template.initialSignalStellung.forEach((i: any) => s.setSignalAspect(i, null, true));
            STORAGE.save();
         });
      }
   }
}


