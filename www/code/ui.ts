"use strict";

import { uuidv4 } from './tools.js';
import * as bootstrap from 'bootstrap';


export const ui = {
    create_toggleButton: function (text: string): JQuery {
       return $("<button>", {
          type: "button",
          id: "btn_" + text.replace(" ", "_"),
          class: "btn btn-primary btn-sm",
       }).html(text);
    },
    
    create_buttonGroup: function (items: JQuery): JQuery {
       return $("<div>", { class: "btn-group", role: "group" }).append(items);
    },

    create_buttonToolbar: function (items: JQuery): JQuery {
        return ui.div("btn-toolbar", items).attr("role", "toolbar");
     },
    
    div: function (c:string, i?:any): JQuery {
      if (i) {
        return $("<div>", { class: c }).append(i);
      } else {
        return $("<div>", { class: c });
      }
    },
 
    showModalDialog: function (content: JQuery, ok_function: () => void): bootstrap.Modal {
       // Create modal div
       let modal_div = $("<div/>", {
          id: "myModal",
          class: "modal fade",
          role: "dialog",
       }).append(
          ui.div("modal-dialog  modal-xl modal-dialog-centered").append(
             ui.div("modal-content").append([
                ui.div("modal-header").append([
                   $("<h4/>", {
                      class: "modal-title",
                      text: "Als Bild speichern",
                   }),
                   $("<button/>", {
                      type: "button",
                      class: "btn-close",
                      "data-bs-dismiss": "modal",
                   }),
                ]),
                ui.div("modal-body").append(content),
                ui.div("modal-footer").append(
                   $("<button/>", {
                      type: "button",
                      class: "btn btn-default",
                      "data-dismiss": "modal",
                      text: "Herunterladen",
                      click: ok_function,
                   })
                ),
             ])
          )
       );
       modal_div.appendTo("body");
 
       let modal = new bootstrap.Modal(modal_div[0]);
       modal.show();
       return modal;
    },// Function to create a toast element
    createToast: function (title: string, txt: string): JQuery {   
       return ui
          .div("toast")
          .attr({ role: "alert", "aria-live": "assertive", "aria-atomic": "true" })
          .append([
             $("<div>")
                .addClass("toast-header")
                .append([
                   $("<strong>").addClass("me-auto").text(title),
                   $("<button>").attr({ type: "button", "data-bs-dismiss": "toast", "aria-label": "Close" }).addClass("btn-close"),
                ]),
             $("<div>")
                .addClass("toast-body")
                .append([$("<p>", { text: txt })]),
          ]);
    },
    
    getToastContainer: function (): JQuery {
       let container = $("#toast-container");
       if (container.length === 0) {
          container = ui.div("toast-container").attr("id", "toast-container").css({ position: "fixed", bottom: "0", right: "0" });
          $("body").append(container);
       }
       return container;
    },
    
    // Function to show the toast
    showErrorToast: function (error: Error): void {
       console.error(error);
       const toast = ui.createToast("Ups, Da gabs einen Fehler", error.message);
       ui.getToastContainer().prepend(ui.div("p-3").append(toast));
       $(toast).toast({ autohide: true, delay: 10000 }).toast("show");
       $(toast).on("hidden.bs.toast", function () {
          $(this).parent().remove();
       });
    },
    
    showInfoToast: function (txt: string): void {
       console.info(txt);
       const toast = ui.createToast("Information:", txt);
       ui.getToastContainer().prepend(ui.div("p-3").append(toast));
       $(toast).toast({ autohide: true, delay: 10000 }).toast("show");
       $(toast).on("hidden.bs.toast", function () {
          $(this).parent().remove();
       });
    },
    create_DropDownItem(text: string, value: string): JQuery {
        return $("<a>", {
           class: "dropdown-item",
           text: text,
           href: "#",
           value: value ?? text,
        });
     },
  
     createAccordionItem(title: string, parent: string, items: JQuery, open = false): JQuery {
        let id = uuidv4();
        return ui.div("accordion-item", [
           $("<h2>", { class: "accordion-header" }).append(
              $("<button>", { class: "accordion-button  user-select-none", type: "button" })
                 .attr("data-bs-toggle", "collapse")
                 .attr("data-bs-target", "#" + id)
                 .text(title)
                 .toggleClass("collapsed", !open)
           ),
           ui
              .div("accordion-collapse collapse", ui.div("accordion-body", items))
              .attr("id", id)
              .attr("data-bs-parent", parent)
              .toggleClass("show", open),
        ]);
     },
  
     create_DropDown(items: string[], text: string, onChange: (value: string) => void): JQuery {
        return ui
           .div("dropdown d-grid", [
              $("<button>", {
                 class: "btn btn-primary dropdown-toggle btn-sm",
                 type: "button",
                 text: text,
                 id: "btn_" + text.replace(" ", "_"),
              }).attr("data-bs-toggle", "dropdown"),
              ui.div(
                 "dropdown-menu",
                 items.map((item) => ui.create_DropDownItem(item.split("|")[0], item.split("|")[1]))
              ),
           ])
           .on("hide.bs.dropdown", (e: JQuery.TriggeredEvent) => {
              const originalEvent = e.originalEvent as any;
              if (originalEvent?.target && originalEvent?.target.nodeName == "A") {
                 const value = $(originalEvent.target).attr("value");
                 $(e.currentTarget).attr("value", value ?? "");
                 if (onChange) onChange(value ?? "");
              }
           })
           .on("show.bs.dropdown", (e: JQuery.TriggeredEvent) => {
              const targetValue = $(e.currentTarget).attr("value");
              if (!targetValue) return;
              $(".dropdown-item", e.currentTarget)
                 .removeClass("active")
                 .each(function () {
                    if ($(this).attr("value") === targetValue) {
                       $(this).addClass("active");
                    }
                 });
           });
     },
  
     createSwitchStructure(
        mainLabel: [string, string?, boolean?], 
        subLabels: [string, string?, boolean?][], 
        onchange: (value: string, checked: boolean) => void
     ): JQuery|null {
        let [text, value, enabled] = mainLabel;
        if (!enabled && subLabels.length == 0) return null;
        let $mainDiv;
        $mainDiv = ui.div("", [
           enabled == null || enabled
              ? ui.div("form-check form-switch", [
                   $("<input/>", {
                      class: "form-check-input",
                      type: "checkbox",
                      role: "switch",
                      id: "switch_" + text,
                   })
                      .on("change", function () {
                         const isChecked = $(this).is(":checked");
                         /* $("input", $mainDiv.children()[1]).prop("disabled", !isChecked); */
                         if (onchange) onchange($(this).attr("value") ?? "", isChecked);
                      })
                      .attr("value", value ?? text)
                      .attr("data-master_switch", ""),
  
                   $("<label/>", {
                      class: "form-check-label",
                      for: "switch_" + text,
                      text: text,
                   }),
                ])
              : $("<label/>", {
                   text: text,
                }),
  
           ui.div(
              "ps-3",
              subLabels
                 .filter((x) => x[2] == null || x[2] == true)
                 .map(function (label) {
                    let [labelText, labelValue, _labelEnabled] = label;
                    return ui.div("form-check form-switch", [
                       $("<input/>", {
                          class: "form-check-input",
                          type: "checkbox",
                          role: "switch",
                          id: "switch_" + labelText,
                          checked: true, // Default to checked as per your example
                       })
                          .on("change", function () {
                             const isChecked = $(this).is(":checked");
                             if (onchange) onchange($(this).attr("value") ?? "", isChecked);
                          })
                          .attr("value", labelValue ?? labelText),
                       $("<label/>", {
                          class: "form-check-label",
                          for: "switch_" + labelText,
                          text: labelText,
                       }),
                    ]);
                 })
           ),
        ]);
        return $mainDiv;
     },
     createOptionGroup(
        header: string, 
        options: [string, string?, boolean?][], 
        inputType = "radio", 
        onchange: (value: string, checked: boolean) => void
     ): JQuery {
        return ui.div("", [
           $("<label>").text(header),
           ui.div(
              "ps-3",
              options.map(function (option) {
                 let [text, value, enabled] = option;
                 let id = "input_" + text;
                 // Create the div for each form-check-inline
                 return ui.div("form-check form-check-inline", [
                    $("<input>")
                       .addClass("form-check-input")
                       .attr("id", id)
                       .attr("name", "OptionGroup_" + header)
                       .attr("type", inputType)
                       .attr("value", value ?? text)
                       .prop("disabled", enabled != null && enabled === false)
                       .on("change", function () {
                          const isChecked = $(this).is(":checked");
                          if (onchange) onchange($(this).attr("value") ?? "", isChecked);
                       }),
                    $("<label>").addClass("form-check-label").attr("for", id).text(text),
                 ]);
              })
           ),
        ]);
     },
 };

