"use strict";

// ES6 Module imports
import { ArrayUtils } from './utils.ts';
import { findFieldNameForObject } from './tools.ts';
import { Track } from './track.ts';
import { DIRECTION } from './config.ts';
import { Application } from './application.ts';
import { SignalRenderer } from './rendering/signalRenderer.ts';
import { SignalTemplate } from './signalTemplate.ts';


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

   

   _template: SignalTemplate | null = null;
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

   

   constructor(template: SignalTemplate) {
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
    * command like "hp=1" or you could set the aspect by a command "currentSpeed" and the override Value 20.
    * @param command {any} - The command to set the signal aspect
    * @param overideValue {any} - The value to override the signal aspect
    * @param chain {boolean} - Whether to chain the signal aspect
    */
   setSignalAspect(command: any, overideValue: any = true, chain: boolean = true) {
      let setting: string, value: unknown;
      const assignment = Signal._parseAssignment(command);
      if (assignment) {
         [setting, value] = assignment;
         if (overideValue === false) value = null;
      } else {
         setting = command;
         value = overideValue === false ? null : overideValue;
      }

      if (this.get(setting) != value) {
         if (value == null) this._signalStellung[setting] = null;
         else if (typeof value === "number") this._signalStellung[setting] = value;
         else this._signalStellung[setting] = value;

         this._changed = true;
         if (this._template!.getRotationAspectKeys().has(setting)) this._rotationAspectChanged = true;
         if (this._template!.getFlipAspectKeys().has(setting)) this._flipAspectChanged = true;
         
      }

      if (this._positioning.track && this._changed && chain) {
         let stop = false; //stop the propagation of the signal dependency, if a signal returns true (a main Signal always returns true while a advance signal decides if the dependency should be propagated)
         // 1st we check the dependency of the main signal or a master signal and will inform the advance signals
         // Attention:we must check both both cases since some signals are main and advance at the same time
         // master is used for signals like lf6 and lf7, which are independent of the main signal
         if (this.check("HPsig||master")) {
            let prevSignal: Signal | null = this;
            do {
               prevSignal = this.search4Signal(prevSignal, DIRECTION.RIGHT_2_LEFT);
               //if we found a signal and it has a checkSignalDependency function
               if (prevSignal && prevSignal._template!.hasDependencyHandler())
                  stop = prevSignal._template!.checkSignalDependency(prevSignal, this);
            } while (!stop && prevSignal);
         }

         //then we check the dependency of our advance signal and will get the information from the main signal
         if (this.check("VRsig||slave") && this._template!.hasDependencyHandler()) {
            let nextSignal: Signal | null = this;
            do {
               nextSignal = this.search4Signal(nextSignal, DIRECTION.LEFT_2_RIGHT);
               if (nextSignal && nextSignal._template!.hasDependencyHandler())
                  stop = nextSignal._template!.checkSignalDependency(this, nextSignal);
            } while (!stop && nextSignal);
         }
      }

      if (this._changed)
         this._template!.rules.forEach(
            function (this: any, rule: any) {
               let trigger = rule[0];
               let signal_aspect = rule[1];
               if (!this.check(signal_aspect) && this.check(trigger)) this.setSignalAspect(signal_aspect);
            }.bind(this)
         );
         Application.getInstance().eventManager?.emit("signalAspectChanged", { signal: this });
   }

   get(stellung: any) {
      let value = this._signalStellung[stellung];
      if (value != undefined) return value;
      else return null;
   }

   static _parseQuotedLiteral(token: string): string | null {
      const trimmed = token.trim();
      const match = trimmed.match(/^(['"])(.*)\1$/s);
      return match ? match[2] : null;
   }

   static _isNumericLiteral(token: string): boolean {
      const trimmed = token.trim();
      return trimmed.length > 0 && Number.isFinite(Number(trimmed));
   }

   static _parseAssignment(command: string): [string, string | number] | null {
      const eqIndex = Signal._indexOfOperatorOutsideQuotes(command, "=");
      if (eqIndex === -1) return null;

      const setting = command.slice(0, eqIndex).trim();
      const raw = command.slice(eqIndex + 1).trim();
      const quoted = Signal._parseQuotedLiteral(raw);
      if (quoted !== null) return [setting, quoted];
      if (Signal._isNumericLiteral(raw)) return [setting, Number(raw)];
      return null;
   }

   static _indexOfOperatorOutsideQuotes(text: string, operator: string): number {
      let inQuote: "'" | '"' | null = null;
      for (let i = 0; i <= text.length - operator.length; i++) {
         const ch = text[i];
         if (inQuote) {
            if (ch === inQuote) inQuote = null;
            continue;
         }
         if (ch === "'" || ch === '"') {
            inQuote = ch;
            continue;
         }
         if (text.startsWith(operator, i)) return i;
      }
      return -1;
   }

   static _splitEquation(equation: string) {
      const operators = ["||", "&&", "!=", "<=", ">=", "=", ">", "<"];
      for (const op of operators) {
         const index = Signal._indexOfOperatorOutsideQuotes(equation, op);
         if (index === -1) continue;
         return {
            operands: [equation.slice(0, index), equation.slice(index + op.length)],
            operator: op,
         };
      }
      return null;
   }

   static _resolveConditionOperand(signal: Signal, token: string) {
      const trimmed = token.trim();
      const quoted = Signal._parseQuotedLiteral(trimmed);
      if (quoted !== null) return quoted;
      if (Signal._isNumericLiteral(trimmed)) return Number(trimmed);
      const aspect = signal.get(trimmed);
      if (aspect != null) return aspect;
      return -1;
   }

   static _compareConditionValues(left: unknown, right: unknown, operator: string) {
      const leftValue = left === null || left === undefined ? "null" : left;
      const rightValue = right === null || right === undefined ? "null" : right;

      if (operator === "=") return leftValue == rightValue;
      if (operator === "!=") return leftValue != rightValue;

      const ln = Number(leftValue);
      const rn = Number(rightValue);
      if (Number.isNaN(ln) || Number.isNaN(rn)) return false;

      switch (operator) {
         case "<":
            return ln < rn;
         case "<=":
            return ln <= rn;
         case ">=":
            return ln >= rn;
         case ">":
            return ln > rn;
      }
      return false;
   }

   check(stellung: any) {
      if (stellung == null) return true;

      const equation = Signal._splitEquation(stellung);
      if (equation == null) return this.get(stellung) != null;

      switch (equation.operator) {
         case "&&":
            return equation.operands.every(this.check, this);
         case "||":
            return equation.operands.some(this.check, this);
      }

      const left = Signal._resolveConditionOperand(this, equation.operands[0]);
      const right = Signal._resolveConditionOperand(this, equation.operands[1]);
      return Signal._compareConditionValues(left, right, equation.operator);
   }

   draw(c: any, force: boolean = false) {
      SignalRenderer.draw(this, c, force);
   }

   search4Signal(signal: any, dir: number, feature?: any): Signal | null {
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
      return null;
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
      const templateKey = o._template;
      const s = new Signal(Application.getInstance().signalTemplates[templateKey]);
      s._signalStellung = Signal.migrateSignalStellung(templateKey, o._signalStellung);
      s._positioning = o._positioning;
      return s;
   }

   static migrateSignalStellung(templateKey: string, stellung: Record<string, unknown>) {
      if (!stellung) return stellung;

      const migrated = { ...stellung };
      const busCurrent = new Set(["hv_hp", "hv_vr", "form_hp", "form_vr", "ks", "ks_vr", "lf7"]);
      const busAdvance = new Set(["hv_hp", "hv_vr", "form_hp", "form_vr", "ks", "ks_vr", "lf6"]);
      const localTemplates = new Set(["zs3", "zusatzSignal", "zusatz"]);

      if (migrated.zs3 !== undefined) {
         if (localTemplates.has(templateKey)) migrated.localSpeed = migrated.zs3;
         else if (busCurrent.has(templateKey)) migrated.currentSpeed = migrated.zs3;
         delete migrated.zs3;
      }
      if (migrated.zs3v !== undefined) {
         if (busAdvance.has(templateKey)) migrated.advanceSpeed = migrated.zs3v;
         delete migrated.zs3v;
      }
      if (migrated.geschw !== undefined) {
         if (localTemplates.has(templateKey)) migrated.localSpeed = migrated.geschw;
         else if (templateKey === "lf7") migrated.currentSpeed = migrated.geschw;
         else if (templateKey === "lf6") migrated.advanceSpeed = migrated.geschw;
         delete migrated.geschw;
      }
      return migrated;
   }
}


