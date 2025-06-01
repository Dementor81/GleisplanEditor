"use strict";

class SignalRenderer {
   static #renderingState = new WeakMap();

   static draw(signal, container, force = false) {
      if (!SignalRenderer.#renderingState.has(signal) && (force || signal._changed)) {
         SignalRenderer.#renderingState.set(signal, { container });

         container.removeAllChildren();

         signal._dontCache = false;
         signal._template.elements.forEach((ve) => this.drawVisualElement(signal, ve));
         signal._changed = false;
         SignalRenderer.#renderingState.delete(signal);
      }
   }

   static createSignalContainer(signal) {
      let c = new createjs.Container();
      c.name = "signal";
      c.data = signal;
      c.mouseChildren = false;
      c.snapToPixel = true;
      c.scale = signal._template.scale;
   
      signal.draw(c, true);
      let sig_bounds = c.getBounds();
      if (sig_bounds) {
         // schläft fehl, wenn nichts gezeichnet wurde
         let hit = new createjs.Shape();
         hit.graphics.beginFill("#000").drawRect(sig_bounds.x, sig_bounds.y, sig_bounds.width, sig_bounds.height);
         c.hitArea = hit;
   
         c.regX = sig_bounds.width / 2 + sig_bounds.x;
         c.regY = sig_bounds.height + sig_bounds.y;
      } else console.error("Wahrscheinlich fehler beim Zeichen des Signals!");
   
      return c;
   }

   static drawVisualElement(signal, ve) {
      if (Array.isArray(ve)) ve.forEach((e) => this.drawVisualElement(signal, e));
      else if (typeof ve == "string") {
         this.addImageElement(signal, ve);
      } else if (ve instanceof TextElement) {
         this.drawTextElement(signal, ve);
      } else if (ve instanceof VisualElement) {
         if (ve.isAllowed(signal) && ve.isEnabled(signal)) {
            if (ve.image) this.addImageElement(signal, ve, ve.blinkt());
            ve.childs()?.forEach((c) => this.drawVisualElement(signal, c));
         }
      } else console.log("unknown type of VisualElement: " + ve);
      return false;
   }

   static drawTextElement(signal, ve) {
      if (!ve.pos()) throw new Error("TextElement doesnt have a position");
      if (ve.isAllowed(signal) && ve.isEnabled(signal)) {
         const formatString = (f) => `${f[2] ? "bold" : ""} ${f[0]}px ${f[1]}`;

         let txt = ve.getText(signal);
         if (txt == null) return false;
         if (typeof txt == "string") txt = txt.replace("-", "\n");
         let ar = clone(ve.format);
         const displayObject = new createjs.Text(txt, formatString(ar), ve.color);
         [displayObject.x, displayObject.y] = ve.pos();
         displayObject.textAlign = "center";

         let current_bounds, max_bounds;
         do {
            current_bounds = displayObject.getBounds();
            max_bounds = ve.bounds();
            if (max_bounds && (current_bounds.width > max_bounds[0] || current_bounds.height > max_bounds[1])) {
               ar[0] -= 5;
               displayObject.font = formatString(ar);
               displayObject.lineHeight = ar[0];
            } else break;
         } while (true);
         const state = SignalRenderer.#renderingState.get(signal);
         state.container.addChild(displayObject);
      }
   }

   static addImageElement(signal, ve, blinkt = false) {
      const textureName = typeof ve == "string" ? ve : ve.image;

      if (textureName == null || textureName == "") return;

      if (textureName.includes(",", 1)) textureName.split(",").forEach((x) => this.addImageElement(signal, x));
      else {
         const state = SignalRenderer.#renderingState.get(signal);
         if (!state.container.getChildByName(textureName)) {
            //check if this texture was already drawn. Some texture are the same for different signals like Zs1 and Zs8
            let bmp = pl.getSprite(signal._template.json_file, textureName);
            if (bmp != null) {
               state.container.addChild(bmp);

               if (blinkt) {
                  signal._dontCache = true;
                  createjs.Tween.get(bmp, { loop: true }).wait(1000).to({ alpha: 0 }, 200).wait(800).to({ alpha: 1 }, 50);
               }

               return bmp;
            } else console.log(textureName + " nicht gezeichnet, da sprite für " + textureName + " nicht erstellt wurde");
         }
      }
   }

   static drawPreview(template, container) {
      container.removeAllChildren();
      // Create a minimal context for preview rendering
      const previewContext = {
         _template: template,
         _signalStellung: {},
         check: () => true, // For preview, always show all elements
         get: () => null
      };
      
      SignalRenderer.#renderingState.set(previewContext, { container });
      // Use existing drawVisualElement but with our preview context
      template.elements.forEach(ve => 
         this.drawVisualElement(previewContext, ve)
      );
      SignalRenderer.#renderingState.delete(previewContext);
   }
}

class Signal {
   static allSignals = new Set();

   static removeSignal(s) {
      const track = Track.allTracks.find((t) => t.signals.includes(s));
      if (track) track.removeSignal(s);
   }

   

   _template = null;
   _signalStellung = {};
   _positioning = {
      track: null,
      km: 0,
      above: false,
      flipped: false,
   };
   _changed = false;
   _dontCache = false;

   

   constructor(template) {
      this._template = template;
      this._positioning = {
         track: null,
         km: 0,
         above: false,
         flipped: false
      };
      Signal.allSignals.add(this);
      if (template.initialSignalStellung) template.initialSignalStellung.forEach((i) => this.set_stellung(i, true, false));
   }

   get title() {
      let title = "";
      if (this.check("HPsig"))
         switch (this.get("verw")) {
            case "zsig":
               title += "Zsig";
               break;
            case "esig":
               title += "Esig";
               break;
            case "asig":
               title += "Asig";
               break;
            case "bksig":
               title += "Bk";
               break;
            case "sbk":
               title += "Sbk";
               break;

            default:
               break;
         }

      const bez = this.get("bez");
      if (bez) title += (" " + bez).replace("-", " ");

      return title;
   }

   //Setzt die Signalstellung, 2 Möglichkeiten:
   //set("zs3",60)
   //set("hp",1)
   //oder
   //set("hp=0")
   //set("ersatz=zs7")
   //set("hp=0,1") der Value hat vorrang vor dem in stellung enthaltenen Value
   //value=false schaltet die Signalstellung auf -1, also aus. Wird vom Menü zum ausschalten einer Signalstellung verwendet
   //chain=false verhindert, dass das Signal versucht das davor und dahinterliegende Signal zu informieren
   set_stellung(command, overideValue = true, chain = true) {
      /* if (subkey == undefined) [command, subkey] = command.split("=");
      else [command] = command.split("="); */
      let setting, value;
      [setting, value] = command.split("=");
      if (overideValue === false) value = null; //false would be better but in javascript hp=0 and hp=false is the same
      else if (value == undefined) value = overideValue;

      if (this.get(setting) != value) {
         if (value == null) this._signalStellung[setting] = null;
         else if (!isNaN(value)) this._signalStellung[setting] = Number(value);
         else this._signalStellung[setting] = value;

         this._changed = true;
      }

      //Signal is actual positioned at a track (e.g. When Signal is created, there isnt a track yet)
      //and the signal indication actualy changed
      if (this._positioning.track && this._changed && chain) {
         let stop = false;
         if (this.check(["HPsig||master"])) {
            let prevSignal = this;
            do {
               prevSignal = this.search4Signal(prevSignal, DIRECTION.RIGHT_2_LEFT);
               if (prevSignal && prevSignal._template.checkSignalDependency)
                  stop = prevSignal._template.checkSignalDependency(prevSignal, this);
            } while (!stop && prevSignal);
         }
         if (this.check(["VRsig||slave"]) && this._template.checkSignalDependency) {
            let nextSignal = this;
            do {
               nextSignal = this.search4Signal(nextSignal, DIRECTION.LEFT_2_RIGTH);
               if (nextSignal && nextSignal._template.checkSignalDependency)
                  stop = nextSignal._template.checkSignalDependency(this, nextSignal, ["HPsig||master"]);
            } while (!stop && nextSignal);
         }
      }

      if (this._changed)
         this._template.rules.forEach(
            function (rule) {
               let trigger = rule[0];
               let signal_aspect = rule[1];
               if (!this.check(signal_aspect) && this.check(trigger)) this.set_stellung(signal_aspect);
            }.bind(this)
         );
   }

   //get value for a specific Stellung
   //e.g. get("hp") returns 0 for Hp 0
   //can be used like this: get("hp") > 0
   get(stellung) {
      let value = this._signalStellung[stellung];
      if (value != undefined) return value;
      else return null;
   }

   static _splitEquation(equation) {
      const ret = {};
      //the order is important, otherwise it would find '=' before '!='
      //and OR ist prioritised before AND
      const operators = ["||", "&&", "!=", "<=", ">=", "=", ">", "<"];
      let parts;
      for (let op of operators) {
         parts = equation.split(op);
         if (parts.length > 1) {
            ret.operands = parts;
            ret.operator = op;
            break;
         }
      }

      if (!ret.operator) return null;

      return ret;
   }

   //checks if a specific Stellung is set
   //e.g. get("hp=0") returns true for Hp 0
   check(stellung) {
      if (stellung == null) return true;

      if (Array.isArray(stellung)) return stellung.every(this.check.bind(this));

      const equation = Signal._splitEquation(stellung);
      if (equation == null) return this.get(stellung) != null;

      switch (equation.operator) {
         case "&&":
            return equation.operands.every(this.check, this);
         case "||":
            return equation.operands.some(this.check, this);
      }

      let data = this.get(equation.operands[0].trim());
      if (data === null) data = "null";
      if (equation.operator == "=") return data == equation.operands[1].trim();
      else {
         const right = Number.parseInt(equation.operands[1].trim());
         if (equation.operator == "<") return data < right;
         else if (equation.operator == "<=") return data <= right;
         else if (equation.operator == ">=") return data >= right;
         else if (equation.operator == ">") return data > right;
         else if (equation.operator == "!=") return data != right;
      }
   }

   draw(c, force = false) {
      SignalRenderer.draw(this, c, force);
   }

   search4Signal(signal, dir, feature) {
      if (signal._positioning.above != signal._positioning.flipped) dir *= -1;

      let track = signal._positioning.track;
      let index = track.signals.indexOf(signal) + dir;
      let sw = null;

      //function checks, if this signal and the given signal belong together
      /* above flipped above flipped result
        0   	0	    0   	0   	1
        0	    1	    0   	0   	0
        0   	0   	0   	1   	0
        0   	1	    0   	1	    1
        1   	0   	0   	0   	0
        0   	0   	1   	0   	0
        1   	0   	1   	0   	1
        0   	0   	1	    1   	1
        1   	1   	0	    0	    1
        0   	1   	1	    0   	1
        1   	0   	0   	1	    1
        1   	1   	1   	0   	0
        0   	1	    1   	1	    0
        1   	1	    1   	1	    1 
        the hack is, that wehen all above and flipped are added, the number is even if they belong together*/
      const check = function (pos) {
         return (
            (Number(signal._positioning.above) + Number(signal._positioning.flipped) + Number(pos.flipped) + Number(pos.above)) %
               2 ==
            0
         );
      };

      const getTrackAtBranch = function (sw, track) {
         if (track == sw.from) return sw.branch;
         if (track == sw.branch) return sw.from;

         return null;
      };

      while (track) {
         while (dir == 1 ? index >= 0 && index < track.signals.length : index >= 0) {
            let nextSignal = track.signals[index];
            if (nextSignal.check(feature) && check(nextSignal._positioning)) {
               return nextSignal; //hauptsignal gefunden
            } else index = index + dir;
         }

         if ((sw = track._tmp.switches[dir == 1 ? 1 : 0])) {
            if (type(sw) == "Track") track = sw;
            else track = getTrackAtBranch(sw, track);

            if (track) {
               index = track.signals.length - 1;
               if (dir == DIRECTION.LEFT_2_RIGTH) index = Math.min(0, index);
            }
         } else track = null;
      }
   }

   setTrack(track,km) {
      if (this._positioning.track) {
         this._positioning.track.signals.remove(this);
      }
      this._positioning.track = track;
      this._positioning.km = km;
      if (track) {
         track.signals.push(this);
      }
   }

   stringify() {
      return {
         _class: "Signal",
         _template: findFieldNameForObject(signalTemplates, this._template),
         _signalStellung: this._signalStellung,
         _positioning: {
            km: this._positioning.km,
            above: this._positioning.above,
            flipped: this._positioning.flipped,
         },
      };
   }

   static FromObject(o) {
      let s = new Signal(signalTemplates[o._template]);      
      s._signalStellung = o._signalStellung;
      s._positioning = o._positioning;
      return s;
   }
}

const Sig_UI = {
   create_SpeedDropDown(signal, text, onChange) {
      const items = Array.from({ length: 10 }, (_, i) => `${i}0|${signal}=${i}`);
      items[0] = `aus|${signal}=-1`;
      return BS.create_DropDown(items, text, onChange);
   },
   initSignalMenu() {
      const conditions = selection.object._template.getAllVisualElementConditions();
      const update = function (command, isOn) {
         selection.object.set_stellung(command, isOn);
         Sig_UI.syncSignalMenu(selection.object);
         renderer.reDrawEverything();
         STORAGE.save();
      };
      $("#navFeatures").empty();
      if (selection.object.check("HPsig"))
         $("#navFeatures").append(
            ui.div(
               "p-3 border-bottom",
               BS.create_DropDown(
                  "Esig,Asig,Zsig,Bksig,Sbk".split(",").map((x) => x + "|verw=" + x.toLowerCase()),
                  "Verwendung",
                  update
               )
            )
         );
      $("#navFeatures").append(
         BS.createSwitchStructure(
            ["Vorsignalfunktion", "VRsig", conditions.includes("VRsig")],
            [
               ...(conditions.includes("vr_op=verk") ? [["verkürzt", "vr_op=verk"]] : []),
               ...(conditions.includes("vr_op=wdh") ? [["wiederholer", "vr_op=wdh"]] : []),
            ],
            update
         )?.addClass("p-3 border-bottom")
      );
      if (conditions.includes("mastschild=wrw") && conditions.includes("mastschild=wgwgw"))
         $("#navFeatures").append(
            BS.createOptionGroup(
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
         const a = [
            ["unten", "zusatz_unten"],
            ["oben", "zusatz_oben"],
         ];
         a.forEach((x) => x.push(conditions.includes(x[1])));

         $("#navFeatures").append(BS.createOptionGroup("Zusatzanzeiger", a, "checkbox", update).addClass("p-3 border-bottom"));
      }
   },
   syncSignalMenu(signal) {
      //header
      $("#signalEditMenuHeader .card-title").text(signal._template.title);
      $("#signalEditMenuHeader .card-text>span").text(signal.title);
      //feature Menu
      $("#navFeatures>div a").each(function () {
         const $a = $(this);
         $a.toggleClass("active", signal.check($a.attr("value")));
      });

      $("#navFeatures>div input").each(function () {
         const input = $(this);
         const v = signal.check(input.attr("value"));
         input.prop("checked", v ? "checked" : null);
         if (input.attr("data-master_switch") != null) $("input", input.parent().next()).prop("disabled", !v);
      });
   },

   getHTML(signal) {
      if (signal._template.signalMenu?.length) {
         const ul = ui.div("d-flex flex-column bd-highlight mb-3");

         const updateFunc = function (command, active) {
            signal.set_stellung(command, !active);
            renderer.reDrawEverything();
            stage.update();
            Sig_UI.checkBootstrapMenu(signal, signal._template.signalMenu, ul);
            STORAGE.save();
         };

         ul.append(signal._template.signalMenu.map((data) => Sig_UI.createBootstrapMenuItems(signal, data, updateFunc)));

         Sig_UI.checkBootstrapMenu(signal, signal._template.signalMenu, ul);

         return ul;
      }
      return "";
   },

   createBootstrapMenuItems(signal, menu_item, update) {
      if (menu_item) {
         if (Array.isArray(menu_item)) {
            let items = menu_item.map((item) => Sig_UI.createBootstrapMenuItems(signal, item, update)).justNull();
            if (items) {
               return ui.div("p-3 border-bottom", BS.create_buttonToolbar(items));
            } else return null;
         } else if (menu_item.type == "buttonGroup" || menu_item.type == "btn") {
            let buttons = menu_item.type == "buttonGroup" ? menu_item.items : [menu_item];
            buttons = buttons
               .filter(
                  (mi) =>
                     mi.visual_elements?.length > 0 &&
                     mi.visual_elements.every((ve) => {
                        let on = ve.on();
                        if (Array.isArray(on)) {
                           if (on.includes(mi.command)) on = on.toSpliced(on.indexOf(mi.command), 1);
                        } else if (on == mi.command) return true;

                        return signal.check(on);
                     })
               )
               .map((item) =>
                  ui
                     .create_toggleButton(item.text, item.command)
                     .on("click", (e) => update.bind(signal)(item.command, $(e.target).hasClass("active")))
               )
               .justNull();
            if (buttons) return ui.create_buttonGroup(buttons);
            else return null;
         } else if (menu_item.type == "dropdown") {
            return Sig_UI.create_SpeedDropDown(menu_item.command, menu_item.text, update.bind(signal));
         }
      }
   },

   checkBootstrapMenu(signal, data, popup) {
      if (data) {
         if (Array.isArray(data)) {
            data.forEach((item) => Sig_UI.checkBootstrapMenu(signal, item, popup));
         } else if (data.type == "buttonGroup") {
            data.items.forEach((item) => {
               let button = $("#btn_" + item.text.replace(" ", "_"), popup);
               if (button.length == 1) {
                  button.toggleClass("active", signal.check(item.command));
                  if (item.visual_elements.every((ve) => ve.isAllowed(signal))) button.removeAttr("disabled");
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
               if (data.visual_elements.every((ve) => ve.isAllowed(signal))) button.removeAttr("disabled");
               else button.attr("disabled", "disabled");
            }
         }
      }
   },
};
