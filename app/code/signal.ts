"use strict";

// ES6 Module imports
import { ArrayUtils } from './utils.ts';
import { findFieldNameForObject } from './tools.ts';
import { Track } from './track.ts';
import { DIRECTION } from './config.ts';
import { Application } from './application.ts';
import { SignalRenderer } from './rendering/signalRenderer.ts';


/**
 * Represents any signal. It mainly manages the signal aspect and the signal positioning.
 * @class Signal
 * @param template {any} - The template of the signal
 */
export class Signal {
   static allSignals = new Set<any>();

   static removeSignal(s: any) {
      const track = Track.allTracks.find((t) => t.signals.includes(s));
      if (track) {
         track.removeSignal(s);
      }
      Signal.allSignals.delete(s);
   }

   

   _template: any = null;
   _signalStellung: any = {};
   _positioning: any = {
      track: null,
      km: 0,
      above: false,
      flipped: false,
   };
   _changed: boolean = false;
   _dontCache: boolean = false;
   _rotationAspectChanged: boolean = false;
   _flipAspectChanged: boolean = false;

   

   constructor(template: any) {
      this._template = template;
      this._positioning = {
         track: null,
         km: 0,
         above: false,
         flipped: false
      };
      Signal.allSignals.add(this);
      if (template.initialSignalStellung) template.initialSignalStellung.forEach((i: any) => this.setSignalAspect(i, true, false));
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

   /**
    * Sets the signal aspect. Supports two ways of seeting the aspect, you could either set the aspect by a 
    * command like "hp=1" or you could set the aspect by a command "zs3" and the override Value 20.
    * @param command {any} - The command to set the signal aspect
    * @param overideValue {any} - The value to override the signal aspect
    * @param chain {boolean} - Whether to chain the signal aspect
    */
   setSignalAspect(command: any, overideValue: any = true, chain: boolean = true) {
      let setting, value;
      [setting, value] = command.split("=");
      if (overideValue === false) value = null;
      else if (value == undefined) value = overideValue;

      if (this.get(setting) != value) {
         if (value == null) this._signalStellung[setting] = null;
         else if (!isNaN(value)) this._signalStellung[setting] = Number(value);
         else this._signalStellung[setting] = value;

         this._changed = true;
         if (this._template.getRotationAspectKeys().has(setting)) this._rotationAspectChanged = true;
         if (this._template.getFlipAspectKeys().has(setting)) this._flipAspectChanged = true;
         Application.getInstance().eventManager?.emit("signalAspectChanged", { signal: this });
      }

      if (this._positioning.track && this._changed && chain) {
         let stop = false;
         if (this.check(["HPsig||master"])) {
            let prevSignal: any = this;
            do {
               prevSignal = this.search4Signal(prevSignal, DIRECTION.RIGHT_2_LEFT);
               if (prevSignal && prevSignal._template.checkSignalDependency)
                  stop = prevSignal._template.checkSignalDependency(prevSignal, this);
            } while (!stop && prevSignal);
         }
         if (this.check(["VRsig||slave"]) && this._template.checkSignalDependency) {
            let nextSignal: any = this;
            do {
               nextSignal = this.search4Signal(nextSignal, DIRECTION.LEFT_2_RIGHT);
               if (nextSignal && nextSignal._template.checkSignalDependency)
                  stop = nextSignal._template.checkSignalDependency(this, nextSignal, ["HPsig||master"]);
            } while (!stop && nextSignal);
         }
      }

      if (this._changed)
         this._template.rules.forEach(
            function (this: any, rule: any) {
               let trigger = rule[0];
               let signal_aspect = rule[1];
               if (!this.check(signal_aspect) && this.check(trigger)) this.setSignalAspect(signal_aspect);
            }.bind(this)
         );
   }

   get(stellung: any) {
      let value = this._signalStellung[stellung];
      if (value != undefined) return value;
      else return null;
   }

   static _splitEquation(equation: string) {
      const ret: any = {};
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

   check(stellung: any) {
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

   draw(c: any, force: boolean = false) {
      SignalRenderer.draw(this, c, force);
   }

   search4Signal(signal: any, dir: number, feature?: any) {
      if (signal._positioning.above != signal._positioning.flipped) dir *= -1;

      let track = signal._positioning.track;
      let index = track.signals.indexOf(signal) + dir;
      let sw: any = null;

      const check = function (pos: any) {
         return (
            (Number(signal._positioning.above) + Number(signal._positioning.flipped) + Number(pos.flipped) + Number(pos.above)) %
               2 ==
            0
         );
      };

      const getTrackAtBranch = function (sw: any, track: any) {
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

         if ((sw = track.switches[dir == 1 ? 1 : 0])) {
            if (sw instanceof Track) track = sw;
            else track = getTrackAtBranch(sw, track);

            if (track) {
               index = track.signals.length - 1;
               if (dir == DIRECTION.LEFT_2_RIGHT) index = Math.min(0, index);
            }
         } else track = null;
      }
   }

   setTrack(track: any,km: number) {
      if (this._positioning.track) {
         ArrayUtils.remove(this._positioning.track.signals, this);
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
         _template: findFieldNameForObject(Application.getInstance().signalTemplates, this._template),
         _signalStellung: this._signalStellung,
         _positioning: {
            km: this._positioning.km,
            above: this._positioning.above,
            flipped: this._positioning.flipped,
         },
      };
   }

   static FromObject(o: any) {
      let s = new Signal(Application.getInstance().signalTemplates[o._template]);      
      s._signalStellung = o._signalStellung;
      s._positioning = o._positioning;
      return s;
   }
}


