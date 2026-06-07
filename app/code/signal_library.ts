"use strict";

import { SignalTemplateDefinition } from './signalDefinition.ts';
import { buildSignalTemplate } from './signalDefinitionBuilder.ts';
import hvHpDefinition from './signal-definitions/hv_hp.json';
import hvVrDefinition from './signal-definitions/hv_vr.json';
import ksDefinition from './signal-definitions/ks.json';
import ksVrDefinition from './signal-definitions/ks_vr.json';
import lsDefinition from './signal-definitions/ls.json';
import formHpDefinition from './signal-definitions/form_hp.json';
import simpleSignDefinitions from './signal-definitions/simple-signs.json';

export const CONDITIONS = (function () {
   const BKsig = "verw=bksig",
      SBK = "verw=sbk",
      Esig = "verw=esig",
      Asig = "verw=asig",
      Zsig = "verw=zsig",
      STRECKE = [BKsig, SBK, Esig],
      GRENZEN = [BKsig, Esig],
      BAHNHOF = [Asig, Zsig];
   return { BKsig, SBK, Esig, Asig, Zsig, STRECKE, GRENZEN, BAHNHOF };
})();

function registerSignalTemplate(signalTemplates: Record<string, any>, key: string, definition: SignalTemplateDefinition) {
   const template = buildSignalTemplate(definition);
   signalTemplates[key] = template;
   return template;
}

export function initSignals(signalTemplatesRef: Record<string, any>) {
   const signalTemplates = signalTemplatesRef;

   //signal: ist das signal, dessen Stellung wir gerade setzen
   //hp: ist das signal, dessen Stellung wir vorsignalisieren wollen
   const checkSignalDependencyFunction4HV = function (signal: any, hp: any) {
      //make sure we only handle main signals
      if (!hp.check("HPsig") || !signal.check("VRsig")) return;
      let stop_propagation = false;

      //-1 heißt, die Vorsignalfunktion ist vom User ausgeschaltet
      if (signal.get("vr") != -1) {
         //Das Hauptsignal zeigt nicht Hp 0 oder es ist ein alleinstehndes Vorsignal
         if (!signal.check("HPsig") || signal.get("hp") != 0) {
            switch (hp._template.id) {
               case "Hv77":
               case "hv_hp":
               case "hv_vr":
                  {
                     signal.setSignalAspect("vr", hp.get("hp") >= 0 ? hp.get("hp") : 0, false);
                     if (!signal.check("vr_op=wdh")) stop_propagation = true;
                  }
                  break;
               case "Hl":
               case "ks":
               case "ks_vr":
                  {
                     signal.setSignalAspect("vr", hp.get("hp") <= 0 ? 0 : 1, false);
                     if (!signal.check("vr_op=wdh")) stop_propagation = true;
                  }
                  break;
            }

            if (hp.get("zs3") == 4) {
               signal.setSignalAspect("zs3v", 0, false);

               if (signal.get("vr") > 0) signal.setSignalAspect("vr", 2, false);
            } else signal.setSignalAspect("zs3v", hp.get("zs3"), false);
         }
      }

      return stop_propagation;
   };

   const hvHp = registerSignalTemplate(signalTemplates, "hv_hp", hvHpDefinition as SignalTemplateDefinition);
   (hvHp as any).checkSignalDependency = checkSignalDependencyFunction4HV;

   const hvVr = registerSignalTemplate(signalTemplates, "hv_vr", hvVrDefinition as SignalTemplateDefinition);
   (hvVr as any).checkSignalDependency = checkSignalDependencyFunction4HV;

   const ks = registerSignalTemplate(signalTemplates, "ks", ksDefinition as SignalTemplateDefinition);

   //signal: ist das signal, dessen Stellung wir gerade setzen
   //hp: ist das signal, dessen Stellung wir vorsignalisieren wollen
   (ks as any).checkSignalDependency = function (signal: any, hp: any) {
      //make sure we only handle main signals
      if (!hp.check("HPsig") || !signal.check("VRsig")) return;
      let stop_propagation = false;
      //-1 heißt, das Signal ist vom User ausgeschaltet
      if (signal.get("hp") != -1) {
         //Das Hauptsignal zeigt nicht Hp 0 oder es ist ein alleinstehndes Vorsignal
         let anderes_zs3 = hp.get("zs3");
         let eigenes_zs3 = signal.get("zs3");
         if (!signal.check("HPsig") || signal.get("hp") != 0) {
            let x = hp.get("hp");

            switch (hp._template.id) {
               case "Hv77":
               case "hv_hp":
               case "hv_vr":
                  {
                     signal.setSignalAspect("hp", x >= 1 ? 1 : 2, false);
                     if (x == 2 && anderes_zs3 <= 0) anderes_zs3 = 4;

                     if (!signal.check("vr_op=wdh")) stop_propagation = true;
                  }
                  break;
               case "Hl":
               case "ks":
               case "ks_vr":
                  {
                     signal.setSignalAspect("hp", x <= 0 ? 2 : 1, false);

                     if (!signal.check("vr_op=wdh")) stop_propagation = true;
                  }
                  break;
            }
         }
         if (eigenes_zs3 <= anderes_zs3 && eigenes_zs3 > 0) anderes_zs3 = -1;
         signal.setSignalAspect("zs3v", anderes_zs3, false);
      }

      return stop_propagation;
   };

   const ksVr = registerSignalTemplate(signalTemplates, "ks_vr", ksVrDefinition as SignalTemplateDefinition);
   (ksVr as any).checkSignalDependency = (ks as any).checkSignalDependency;

   registerSignalTemplate(signalTemplates, "ls", lsDefinition as SignalTemplateDefinition);

   (simpleSignDefinitions as SignalTemplateDefinition[]).forEach((definition) => {
      const key = definition.id === "zusatz" ? "zusatzSignal" : definition.id;
      registerSignalTemplate(signalTemplates, key, definition);
   });

   (signalTemplates.lf7 as any).checkSignalDependency = (signalTemplates.lf6 as any).checkSignalDependency = function (signal: any, hp: any) {
      if (signal._template.id == "lf6" && hp._template.id == "lf7") {
         signal.setSignalAspect("geschw", hp.get("geschw"), false);
         return true;
      }
      return false;
   };

   registerSignalTemplate(signalTemplates, "form_hp", formHpDefinition as SignalTemplateDefinition);
}
