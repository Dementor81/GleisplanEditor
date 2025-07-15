"use strict";

import { uuidv4 } from './tools.js';

export const ui = {
    create_toggleButton: function (text) {
       return $("<button>", {
          type: "button",
          id: "btn_" + text.replace(" ", "_"),
          class: "btn btn-primary btn-sm",
       }).html(text);
    },
    
    create_buttonGroup: function (items) {
       return $("<div>", { class: "btn-group", role: "group" }).append(items);
    },

    create_buttonToolbar: function (items) {
        return ui.div("btn-toolbar", items).attr("role", "toolbar");
     },
    
    div: function (c, i) {
       return $("<div>", { class: c }).append(i);
    },
 
    showModalDialog: function (content, ok_function) {
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
    createToast: function (title, txt) {   
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
    
    getToastContainer: function () {
       let container = $("#toast-container");
       if (container.length === 0) {
          container = ui.div("toast-container").attr("id", "toast-container").css({ position: "fixed", bottom: "0", right: "0" });
          $("body").append(container);
       }
       return container;
    },
    
    // Function to show the toast
    showErrorToast: function (error) {
       console.error(error);
       const toast = ui.createToast("Ups, Da gabs einen Fehler", error.message);
       ui.getToastContainer().prepend(ui.div("p-3").append(toast));
       $(toast).toast({ autohide: true, delay: 10000 }).toast("show");
       $(toast).on("hidden.bs.toast", function () {
          $(this).parent().remove();
       });
    },
    
    showInfoToast: function (txt) {
       console.info(txt);
       const toast = ui.createToast("Information:", txt);
       ui.getToastContainer().prepend(ui.div("p-3").append(toast));
       $(toast).toast({ autohide: true, delay: 10000 }).toast("show");
       $(toast).on("hidden.bs.toast", function () {
          $(this).parent().remove();
       });
    },
    create_DropDownItem(text, value) {
        return $("<a>", {
           class: "dropdown-item",
           text: text,
           href: "#",
           value: value ?? text,
        });
     },
  
     createAccordionItem(title, parent, items, open = false) {
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
  
     create_DropDown(items, text, onChange) {
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
                 items.map((item) => ui.create_DropDownItem(...item.split("|")))
              ),
           ])
           .on("hide.bs.dropdown", (e) => {
              if (e.clickEvent?.target && e.clickEvent?.target.nodeName == "A") {
                 const value = $(e.clickEvent.target).attr("value");
                 $(e.currentTarget).attr("value", value);
                 if (onChange) onChange(value);
              }
           })
           .on("show.bs.dropdown", (e) => {
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
  
     createSwitchStructure(mainLabel, subLabels, onchange) {
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
                         if (onchange) onchange($(this).attr("value"), isChecked);
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
                    [text, value, enabled] = label;
                    return ui.div("form-check form-switch", [
                       $("<input/>", {
                          class: "form-check-input",
                          type: "checkbox",
                          role: "switch",
                          id: "switch_" + text,
                          checked: true, // Default to checked as per your example
                       })
                          .on("change", function () {
                             const isChecked = $(this).is(":checked");
                             if (onchange) onchange($(this).attr("value"), isChecked);
                          })
                          .attr("value", value ?? text),
                       $("<label/>", {
                          class: "form-check-label",
                          for: "switch_" + text,
                          text: text,
                       }),
                    ]);
                 })
           ),
        ]);
        return $mainDiv;
     },
     createOptionGroup(header, options, inputType = "radio", onchange) {
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
                       .attr("disabled", enabled != null && !enabled)
                       .on("change", function () {
                          const isChecked = $(this).is(":checked");
                          if (onchange) onchange($(this).attr("value"), isChecked);
                       }),
                    $("<label>").addClass("form-check-label").attr("for", id).text(text),
                 ]);
              })
           ),
        ]);
     },
 };

 // Backward compatibility: Still expose utilities on window during transition
// TODO: Remove this once all files are converted to modules
if (typeof window !== 'undefined') {
    window.ui = ui;
 }