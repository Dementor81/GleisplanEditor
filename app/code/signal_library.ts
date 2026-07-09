"use strict";

import { SignalTemplateDefinition } from './signalDefinition.ts';
import { SignalDefinitionBuilder } from './signalDefinitionBuilder.ts';
import hvHpDefinition from './signal-definitions/hv_hp.json';
import hvVrDefinition from './signal-definitions/hv_vr.json';
import ksDefinition from './signal-definitions/ks.json';
import ksVrDefinition from './signal-definitions/ks_vr.json';
import lsDefinition from './signal-definitions/ls.json';
import formHpDefinition from './signal-definitions/form_hp.json';
import formVrDefinition from './signal-definitions/form_vr.json';
import simpleSignDefinitions from './signal-definitions/simple-signs.json';
import crossingStreetLightDefinition from './signal-definitions/crossing_street_light.json';
import bueDefinition from './signal-definitions/bue.json';

/**
 * All signal configuration definitions keyed exactly like the runtime template registry.
 * Single source of truth shared by the editor (initSignals) and the signal configuration page.
 */
export const signalDefinitions: Record<string, SignalTemplateDefinition> = (() => {
   const defs: Record<string, SignalTemplateDefinition> = {
      hv_hp: hvHpDefinition as unknown as SignalTemplateDefinition,
      hv_vr: hvVrDefinition as unknown as SignalTemplateDefinition,
      ks: ksDefinition as unknown as SignalTemplateDefinition,
      ks_vr: ksVrDefinition as unknown as SignalTemplateDefinition,
      ls: lsDefinition as unknown as SignalTemplateDefinition,
      form_hp: formHpDefinition as unknown as SignalTemplateDefinition,
      form_vr: formVrDefinition as unknown as SignalTemplateDefinition,
   };
   (simpleSignDefinitions as SignalTemplateDefinition[]).forEach((definition) => {
      defs[definition.id === "zusatz" ? "zusatzSignal" : definition.id] = definition;
   });
   defs.crossing_street_light = crossingStreetLightDefinition as unknown as SignalTemplateDefinition;
   defs.bue = bueDefinition as unknown as SignalTemplateDefinition;
   return defs;
})();

export const CONDITIONS = (function () {
   const BKsig = "verw='bksig'",
      SBK = "verw='sbk'",
      Esig = "verw='esig'",
      Asig = "verw='asig'",
      Zsig = "verw='zsig'",
      STRECKE = [BKsig, SBK, Esig],
      GRENZEN = [BKsig, Esig],
      BAHNHOF = [Asig, Zsig];
   return { BKsig, SBK, Esig, Asig, Zsig, STRECKE, GRENZEN, BAHNHOF };
})();

function registerSignalTemplate(signalTemplates: Record<string, any>, key: string, definition: SignalTemplateDefinition) {
   signalTemplates[key] = SignalDefinitionBuilder.build(definition);
}

export function initSignals(signalTemplatesRef: Record<string, any>) {
   const signalTemplates = signalTemplatesRef;

   registerSignalTemplate(signalTemplates, "hv_hp", signalDefinitions.hv_hp);
   registerSignalTemplate(signalTemplates, "hv_vr", signalDefinitions.hv_vr);
   registerSignalTemplate(signalTemplates, "ks", signalDefinitions.ks);
   registerSignalTemplate(signalTemplates, "ks_vr", signalDefinitions.ks_vr);
   registerSignalTemplate(signalTemplates, "ls", signalDefinitions.ls);
   registerSignalTemplate(signalTemplates, "form_hp", signalDefinitions.form_hp);
   registerSignalTemplate(signalTemplates, "form_vr", signalDefinitions.form_vr);

   (simpleSignDefinitions as SignalTemplateDefinition[]).forEach((definition) => {
      const key = definition.id === "zusatz" ? "zusatzSignal" : definition.id;
      registerSignalTemplate(signalTemplates, key, signalDefinitions[key]);
   });

   registerSignalTemplate(signalTemplates, "crossing_street_light", signalDefinitions.crossing_street_light);
   registerSignalTemplate(signalTemplates, "bue", signalDefinitions.bue);
}
