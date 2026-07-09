"use strict";

// ES6 Module imports
import { ui } from './ui.ts';
import { ArrayUtils, ConditionUtils } from './utils.ts';
import { STORAGE } from './storage.ts';
import { Application } from './application.ts';
import { Signal } from './signal.ts';
import type { SignalConfigOptionDefinition, SignalTextInputDefinition } from './signalDefinition.ts';

export class Sig_UI {
   static #toInputValue(value: unknown): string {
      return value == null ? "" : String(value);
   }

   static #sanitizeId(value: string): string {
      return value.replace(/[^a-zA-Z0-9_-]/g, "_");
   }

   static #trimmedInputValue(raw: string, maxLength?: number): string {
      const value = raw.trim();
      if (maxLength == null || maxLength < 0) return value;
      return value.slice(0, maxLength);
   }

   static create_SpeedDropDown(signal: any, text: string, onChange: any) {
      const items = Array.from({ length: 10 }, (_, i) => `${i}0|${signal}=${i}`);
      items[0] = `aus|${signal}=-1`;
      return ui.create_DropDown(items, text, onChange);
   }

   static buildTextInputField(
      signal: any,
      inputDef: SignalTextInputDefinition,
      onChange: (command: string, value: string | null) => void,
      cssClass = "mb-2"
   ): JQuery {
      const safeId = `textinput_${Sig_UI.#sanitizeId(inputDef.command)}_${Sig_UI.#sanitizeId(inputDef.text)}`;
      const input = $("<input/>", {
         class: "form-control form-control-sm flex-grow-1 min-w-0",
         id: safeId,
         type: "text",
      })
         .attr("data-textinput-command", inputDef.command)
         .val(Sig_UI.#toInputValue(signal.get(inputDef.command)));

      if (inputDef.maxLength != null) input.attr("maxlength", Math.max(0, inputDef.maxLength));

      const commit = () => {
         const nextValue = Sig_UI.#trimmedInputValue(String(input.val() ?? ""), inputDef.maxLength);
         input.val(nextValue);
         onChange(inputDef.command, nextValue.length ? nextValue : null);
      };

      input.on("change", commit);
      input.on("blur", commit);
      input.on("keydown", (event) => {
         if (event.key === "Enter") {
            event.preventDefault();
            commit();
            input.trigger("blur");
         }
      });

      return ui.div(`${cssClass} d-flex align-items-center gap-2 w-100`, [
         $("<label/>", {
            class: "col-form-label col-form-label-sm mb-0 flex-shrink-0",
            for: safeId,
            text: inputDef.text,
         }),
         input,
      ]);
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
         const configSection = Sig_UI.buildConfigOptionsSection(selectedSignal, update);
         if (configSection) signalConfigurationTab.append(configSection);
      }
   }

   static buildConfigOptionsSection(
      signal: any,
      update: (command: string, isOn?: unknown) => void
   ): JQuery | null {
      const template = signal._template;
      const configOptions = template.configOptions;
      if (!configOptions?.length) return null;

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

      const updateTextInput = (command: string, value: string | null) => {
         update(command, value);
      };

      return ui.div(
         "p-3 border-bottom",
         configOptions.map((opt: SignalConfigOptionDefinition) => {
            if (opt.type === "textinput") {
               return Sig_UI.buildTextInputField(signal, opt, updateTextInput, "mb-3");
            }

            return ui.div("form-check form-switch", [
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
            ]);
         })
      );
   }

   static initConfigOptionsMenu(
      signal: any,
      menuContainer: JQuery | string,
      onChange?: () => void,
      refreshAspectsMenu?: () => void
   ): void {
      const tab = typeof menuContainer === "string" ? $(menuContainer) : menuContainer;
      tab.empty();

      const update = (command: string, isOn?: unknown) => {
         signal.setSignalAspect(command, isOn);
         refreshAspectsMenu?.();
         Sig_UI.syncConfigOptionSwitches(signal, tab);
         STORAGE.save();
         onChange?.();
      };

      const section = Sig_UI.buildConfigOptionsSection(signal, update);
      if (section) tab.append(section);
      Sig_UI.syncConfigOptionSwitches(signal, tab);
   }

   static syncConfigOptionSwitches(signal: any, container: JQuery | string = "#SignalConfigurationTab") {
      const root = typeof container === "string" ? $(container) : container;
      root.find("input[data-config-option]").each(function () {
         const input = $(this);
         input.prop("checked", signal.check(input.attr("value")) ? "checked" : null);
      });
      root.find("input[data-textinput-command]").each(function () {
         const input = $(this);
         const command = input.attr("data-textinput-command");
         if (!command) return;
         input.val(Sig_UI.#toInputValue(signal.get(command)));
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

      $("#SignalConfigurationTab>div input[type='checkbox']").each(function () {
         const input = $(this);
         const v = signal.check(input.attr("value"));
         input.prop("checked", v ? "checked" : null);
         if (input.attr("data-master_switch") != null) $("input", input.parent().next()).prop("disabled", !v);
      });

      Sig_UI.syncConfigOptionSwitches(signal);
   }

   static initSignalAspectsMenu(
      signal: any,
      menuContainer: JQuery | string = "#signalAspectTab",
      onChange?: () => void
   ) {
      if (signal._template.signalMenu?.length) {
         const ul = ui.div("d-flex flex-column bd-highlight mb-3");

         const updateFunc = function (this: any, command: any, active: boolean) {
            signal.setSignalAspect(command, !active);
            Sig_UI.checkSignalAspectMenu(signal, signal._template.signalMenu, ul);
            STORAGE.save();
            onChange?.();
         };

         ul.append(
            ArrayUtils.cleanUp(
               signal._template.signalMenu.map((section: any) =>
                  Sig_UI.createSignalAspectsMenuSection(signal, section, updateFunc)
               )
            ) as any
         );

         Sig_UI.checkSignalAspectMenu(signal, signal._template.signalMenu, ul);

         const tab = typeof menuContainer === "string" ? $(menuContainer) : menuContainer;
         tab.empty();
         tab.append(ul);
      }
   }
   static createSignalAspectsMenuSection(signal: any, section: any, update: any) {
      const items = ArrayUtils.cleanUp(
         section.section.map((item: any) => Sig_UI.createSignalAspectsMenuItem(signal, item, update))
      ) as JQuery[];
      if (!items.length) return null;

      const toolbarItems = items.filter((item) => !item.is("[data-menu-textinput]"));
      const textInputs = items.filter((item) => item.is("[data-menu-textinput]"));
      const sectionItems: JQuery[] = [];

      if (toolbarItems.length) sectionItems.push(ui.create_buttonToolbar(toolbarItems as any));
      textInputs.forEach((input) => sectionItems.push(input));

      if (sectionItems.length) return ui.div("p-3 border-bottom", sectionItems);
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
                     const on = ve.on();
                     if (on == mi.command || ConditionUtils.includesPart(on, mi.command)) return true;
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

      if (menu_item.type == "textinput") {
         const onChange = (command: string, value: string | null) => {
            signal.setSignalAspect(command, value);
            Sig_UI.checkSignalAspectMenu(signal, signal._template.signalMenu, $("#signalAspectTab"));
            STORAGE.save();
         };

         return Sig_UI.buildTextInputField(signal, menu_item, onChange).attr("data-menu-textinput", "");
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
      } else if (menu_configuration.type == "textinput") {
         const input = $(`input[data-textinput-command='${menu_configuration.command}']`, html_menu);
         if (input.length == 1) input.val(Sig_UI.#toInputValue(signal.get(menu_configuration.command)));
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
            s._aspectAnimations.clear();
            app.eventManager?.emit("signalAspectChanged", { signal: s });
            if (s._template.initialSignalStellung)
               s._template.initialSignalStellung.forEach((i: any) => s.setSignalAspect(i, null, true));
            STORAGE.save();
         });
      }
   }
}


