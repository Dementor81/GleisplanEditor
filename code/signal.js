"use strict";

class Signal {
   static FromObject(o) {
      let s = new Signal();

      s._template = signalTemplates[o._template];
      s._signalStellung = o._signalStellung;
      s._positioning = o._positioning;
      s._features = new Map(JSON.parse(o.features));
      return s;
   }

   _template = null;
   _signalStellung = {};
   _positioning = {
      track: null,
      km: 0,
      above: false,
      flipped: false,
   };
   _features = new Map();
   _changed = false;
   _dontCache = false;

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
         features: JSON.stringify(Array.from(this._features.entries())),
      };
   }

   constructor(template) {
      if (template) {
         this._template = template;

         /* if (template.initialFeatures)
            if (Array.isArray(template.initialFeatures)) template.initialFeatures.forEach((i) => this.setFeature(i, true));
            else this.setFeature(template.initialFeatures, true);
 */
         if (template.initialSignalStellung) template.initialSignalStellung.forEach((i) => this.set_stellung(i, true, false));
      }
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
      if (overideValue == false) value = null; //false would be better but in javascript hp=0 and hp=false is the same
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
               if (prevSignal && prevSignal._template.checkSignalDependency) stop = prevSignal._template.checkSignalDependency(prevSignal, this);
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
      if (this._rendering == undefined && (force || this._changed)) {
         this._rendering = { container: c };

         c.removeAllChildren();

         this._dontCache = false;
         this._template.elements.forEach((ve) => this.drawVisualElement(ve));
         this._changed = false;
         delete this._rendering;
      }
   }

   drawVisualElement(ve) {
      if (Array.isArray(ve)) ve.forEach((e) => this.drawVisualElement(e));
      else if (typeof ve == "string") {
         this.addImageElement(ve);
      } else if (ve instanceof TextElement) {
         if (!ve.pos()) throw new Error("TextElement doesnt have a position");
         if (ve.isAllowed(this) && ve.isEnabled(this)) {
            var js_text = new createjs.Text(ve.getText(this), ve.format, ve.color);
            [js_text.x, js_text.y] = ve.pos();
            js_text.textAlign = "center";
            js_text.textBaseline = "top";
            js_text.lineHeight = 20;
            this._rendering.container.addChild(js_text);
         }
      } else if (ve instanceof VisualElement) {
         if (ve.isAllowed(this) && ve.isEnabled(this)) {
            if (ve.image) this.addImageElement(ve, ve.blinkt());
            ve.childs()?.forEach((c) => this.drawVisualElement(c));
         }
      } else console.log("unknown type of VisualElement: " + ve);
      return false;
   }

   addImageElement(ve, blinkt = false) {
      const textureName = typeof ve == "string" ? ve : ve.image;

      if (textureName == null || textureName == "") return;

      if (textureName.includes(",", 1)) textureName.split(",").forEach((x) => this.addImageElement(x));
      else {
         if (!this._rendering.container.getChildByName(textureName)) {
            //check if this texture was already drawn. Some texture are the same for different signals like Zs1 and Zs8
            let bmp = pl.getSprite(this._template.json_file, textureName);
            if (bmp != null) {
               this._rendering.container.addChild(bmp);

               if (blinkt) {
                  this._dontCache = true;
                  createjs.Tween.get(bmp, { loop: true }).wait(1000).to({ alpha: 0 }, 200).wait(800).to({ alpha: 1 }, 50);
               }

               return bmp;
            } else console.log(textureName + " nicht gezeichnet, da sprite für " + textureName + " nicht erstellt wurde");
         }
      }
   }

   getHTML() {
      if (this._template.signalMenu?.length) {
         const ul = ui.div("d-flex flex-column bd-highlight mb-3");

         const updateFunc = function (command, active) {
            this.set_stellung(command, !active);
            renderer.reDrawEverything();
            stage.update();
            this.checkBootstrapMenu(this._template.signalMenu, ul);
            save();
         };

         ul.append(this._template.signalMenu.map((data) => this.createBootstrapMenuItems(data, updateFunc)));

         this.syncHTML(ul);

         return ul;
      }
      return "";
   }

   createBootstrapMenuItems(menu_item, update) {
      if (menu_item) {
         if (Array.isArray(menu_item)) {
            let items = menu_item.map((item) => this.createBootstrapMenuItems(item, update)).justNull();
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
                        const on = ve.on();
                        if (on == mi.command) return true;
                        else return this.check(on);
                     })
               )
               .map((item) =>
                  ui.create_toggleButton(item.text, item.command).on("click", (e) => update.bind(this)(item.command, $(e.target).hasClass("active")))
               )
               .justNull();
            if (buttons) return ui.create_buttonGroup(buttons);
            else return null;
         } else if (menu_item.type == "dropdown") {
            return Sig_UI.create_SpeedDropDown(menu_item.command, menu_item.text, update.bind(this));
         }
      }
   }

   checkBootstrapMenu(data, popup) {
      if (data) {
         if (Array.isArray(data)) {
            data.forEach((item) => this.checkBootstrapMenu(item, popup));
         } else if (data.type == "buttonGroup") {
            data.items.forEach((item) => {
               let button = $("#btn_" + item.text.replace(" ", "_"), popup);
               if (button.length == 1) {
                  button.toggleClass("active", this.check(item.command));
                  if (item.visual_elements.every((ve) => ve.isAllowed(this))) button.removeAttr("disabled");
                  else button.attr("disabled", "disabled");
               }
            });
         } else if (data.type == "dropdown") {
            let button = $("#btn_" + data.text.replace(" ", "_"), popup);
            if (button.length == 1) {
               const v = this.get(data.command);
               button.text(data.text + (v > 0 ? " Kz " + v : " aus"));
            }
         } else if (data.type == "btn") {
            let button = $("#btn_" + data.text.replace(" ", "_"), popup);
            if (button.length == 1) {
               button.toggleClass("active", this.check(data.command));
               if (data.visual_elements.every((ve) => ve.isAllowed(this))) button.removeAttr("disabled");
               else button.attr("disabled", "disabled");
            }
         }
      }
   }

   syncHTML(popup) {
      this.checkBootstrapMenu(this._template.signalMenu, popup);
   }

   getContextMenu() {
      return this._template.contextMenu;
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
         return (Number(signal._positioning.above) + Number(signal._positioning.flipped) + Number(pos.flipped) + Number(pos.above)) % 2 == 0;
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
         save();
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
};
