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
         _template: this._template.id,
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

         if (template.initialFeatures)
            if (Array.isArray(template.initialFeatures)) template.initialFeatures.forEach((i) => this.setFeature(i, true));
            else this.setFeature(template.initialFeatures, true);

         if (template.initialSignalStellung) template.initialSignalStellung.forEach((i) => this.set_stellung(i, null, false));
      }
   }

   get title() {
      let title = "";
      if (this.matchFeature("hp"))
          switch (this.getFeature("verwendung")) {
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
      

      const bez = this.getFeature("bez");
      if(bez)
          title += " " + bez.replace("-", " ");

      return title;
  }

   //features saves how a signal is used (Asig,Esig etc) and if it supports things like Vorsignal or Verkürzte Bremswege
   //there are two types of features: single worded like "vr" or "verk"
   //and features which work es a group and are build out of 2 Words like "mastschild.wgwgw"
   setFeature(o, value) {
      const splitted = o.split(".");
      if (splitted.length == 1) {
         if (value) this._features.set(o, value);
         else this._features.delete(o);
      } else if (splitted.length == 2) this._features.set(splitted[0], splitted[1]);
      else throw new Error();

      this._changed = true;
   }

   getFeature(key) {
      if (this._features.has(key)) return this._features.get(key);
      else return null;
   }

   matchFeature(condition) {
      if (condition == null || condition.length == 0) return true; // wenn das visualElement keine conditions fordert, ist es immer ein match
      const match_single = function (singleCondition) {
         const splitted = singleCondition.split(".");
         const antiMatch = splitted[0][0] == "!";
         let retValue;
         if (antiMatch) splitted[0] = splitted[0].substring(1);
         if (splitted.length == 1) retValue = this._features.has(splitted[0]);
         else if (splitted.length == 2) retValue = this._features.get(splitted[0]) == splitted[1];
         else throw new Error();

         return antiMatch ? !retValue : retValue;
      }.bind(this);
      if (Array.isArray(condition)) {
         return condition.some(this.matchFeature.bind(this));
      } else if (condition.includes("&&")) {
         return condition.split("&&").every(match_single);
      } else return match_single(condition);
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
   set_stellung(stellung, subkey, chain = true) {
      if (subkey == undefined) [stellung, subkey] = stellung.split("=");
      else [stellung] = stellung.split("=");

      if (this.get(stellung) != subkey) {
         if (!isNaN(subkey)) {
            this._signalStellung[stellung] = Number(subkey);
         } else {
            this._signalStellung[stellung] = subkey;
         }

         this._changed = true;
      }

      //Signal is actual positioned at a track (e.g. When Signal is created, there isnt a track yet)
      //and the signal indication actualy changed
      if (this._positioning.track && this._changed && chain) {
         let stop = false;
         if (this.matchFeature(["hp", "master"])) {
            let prevSignal = this;
            do {
               prevSignal = this.search4Signal(prevSignal, DIRECTION.RIGHT_2_LEFT);
               if (prevSignal && prevSignal._template.checkSignalDependency) stop = prevSignal._template.checkSignalDependency(prevSignal, this);
            } while (!stop && prevSignal);
         }
         if (this.matchFeature(["vr", "slave"]) && this._template.checkSignalDependency) {
            let nextSignal = this;
            do {
               nextSignal = this.search4Signal(nextSignal, DIRECTION.LEFT_2_RIGTH);
               if (nextSignal && nextSignal._template.checkSignalDependency)
                  stop = nextSignal._template.checkSignalDependency(this, nextSignal, ["hp", "master"]);
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
      else return -1;
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

      if (!ret.operator) throw new Error("Operator not found in equation");

      return ret;
   }

   //checks if a specific Stellung is set
   //e.g. get("hp=0") returns true for Hp 0
   check(stellung) {
      if (stellung == null) return true;

      const equation = Signal._splitEquation(stellung);

      switch (equation.operator) {
         case "&&":
            return equation.operands.every(this.check, this);
         case "||":
            return equation.operands.some(this.check, this);
      }

      let data = this.get(equation.operands[0].trim());
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
         if (!ve.pos) throw new Error("TextElement doesnt have a position");
         if (this.matchFeature(ve.conditions) && ve.isAllowed(this) && ve.isEnabled(this)) {
            var js_text = new createjs.Text(ve.getText(this), ve.format, ve.color);
            js_text.x = ve.pos[0];
            js_text.y = ve.pos[1];
            js_text.textAlign = "center";
            js_text.textBaseline = "top";
            js_text.lineHeight = 20;
            this._rendering.container.addChild(js_text);
         }
      } else if (ve instanceof VisualElement) {
         if (this.matchFeature(ve.conditions))
            if (ve.isAllowed(this) && ve.isEnabled(this)) {
               if (ve.image) {
                  this.addImageElement(ve, ve.blinkt);
               }
               if (ve.childs) {
                  for (let index = 0; index < ve.childs.length; index++) {
                     const c = ve.childs[index];
                     this.drawVisualElement(c);
                  }
               }
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
         const ul = $("<ul>", { class: "list-group list-group-flush" });

         const updateFunc = function (command, active) {
            this.set_stellung(command, active ? -1 : undefined);
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

   createBootstrapMenuItems(data, update) {
      if (data) {
         if (Array.isArray(data)) {
            let items = data.map((item) => this.createBootstrapMenuItems(item, update)).justNull();
            if (items) {
               let menu = BS.createListGroupItem(BS.create_buttonToolbar(items));
               return menu;
            } else return null;
         } else if (data.btnGroup) {
            let buttons = data.items
               .filter((mi) => mi.ve != null && mi.ve.length > 0 && mi.ve.every((ve) => this.matchFeature(ve.conditions)))
               .map((item) =>
                  ui.create_toggleButton(item.text, item.setting).on("click", (e) => update.bind(this)(item.setting, $(e.target).hasClass("active")))
               )
               .justNull();
            if (buttons) return ui.create_buttonGroup(buttons);
            else return null;
         } else if (data.input) {
            return Sig_UI.create_SpeedDropDown(data.setting, data.text).onValueChanged(update.bind(this));
         }
      }
   }

   checkBootstrapMenu(data, popup) {
      if (data) {
         if (Array.isArray(data)) {
            data.forEach((item) => this.checkBootstrapMenu(item, popup));
         } else if (data.btnGroup) {
            data.items.forEach((item) => {
               let button = $("#btn_" + item.text.replace(" ", "_"), popup);
               if (button.length == 1) {
                  button.toggleClass("active", this.check(item.setting));
                  if (item.ve.every((ve) => ve.isAllowed(this))) button.removeAttr("disabled");
                  else button.attr("disabled", "disabled");
               }
            });
         } else if (data.input) {
            let button = $("#btn_" + data.text.replace(" ", "_"), popup);
            if (button.length == 1) {
               const v = this.get(data.setting);
               button.text(data.text + (v > 0 ? " Kz " + v : " aus"));
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
            if (nextSignal.matchFeature(feature) && check(nextSignal._positioning)) {
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
   create_zs3DropDownItems(stellung) {
      let a = [BS.create_DropDownItem("aus").attr("data_command", stellung + "=-1")];
      for (let i = 1; i <= 9; i++) {
         a.push(BS.create_DropDownItem(i + "0").attr("data_command", stellung + "=" + i));
      }
      return a;
   },
   create_SpeedDropDown(signal, text) {
      const dd = BS.create_DropDown(this.create_zs3DropDownItems(signal), text);
      dd.onValueChanged = function (f) {
         this._onValueChanged = f;
         return this;
      }.bind(dd);
      dd.on("hide.bs.dropdown", (e) => {
         if (e.clickEvent?.target && e.clickEvent?.target.nodeName == "A" && dd._onValueChanged) {
            dd._onValueChanged($(e.clickEvent.target).attr("data_command"));
         }
      });

      return dd;
   },
};
