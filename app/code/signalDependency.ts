import type { SignalDependencyDefinition } from './signalDefinition.ts';

export type SemanticState = {
   route?: string;
   currentSpeed?: number;
};

type AspectSignal = {
   get(key: string): number | string | null;
   check(condition: string | string[]): boolean;
   setSignalAspect(command: string, value: unknown, chain?: boolean): void;
   _template?: { dependency?: SignalDependencyDefinition };
};

export function evaluateCondition(signal: AspectSignal, partner: AspectSignal, expr: string): boolean {
   if (expr.includes('&&')) return expr.split('&&').every((part) => evaluateCondition(signal, partner, part.trim()));
   if (expr.includes('||')) return expr.split('||').some((part) => evaluateCondition(signal, partner, part.trim()));

   if (expr.startsWith('self.')) return signal.check(expr.slice(5));
   if (expr.startsWith('partner.')) return partner.check(expr.slice(8));
   return signal.check(expr);
}

function evaluateRules(signal: AspectSignal, rules: Array<[string, string | number]> | undefined, aspectKey: string): string | number | undefined {
   if (!rules) return undefined;

   for (const [condition, value] of rules) {
      if (condition === 'else') {
         if (typeof value === 'string' && value === aspectKey) return signal.get(aspectKey) as number;
         return value;
      }
      if (signal.check(condition)) {
         if (typeof value === 'string' && value === aspectKey) return signal.get(aspectKey) as number;
         return value;
      }
   }
   return undefined;
}

export function publishSemantics(partner: AspectSignal, publish?: SignalDependencyDefinition['publish']): SemanticState {
   if (!publish) return {};

   const semantics: SemanticState = {};

   if (publish.route) {
      const route = evaluateRules(partner, publish.route, 'route');
      if (route !== undefined) semantics.route = String(route);
   }

   if (publish.currentSpeed === 'currentSpeed') {
      const value = partner.get('currentSpeed');
      if (value !== null) semantics.currentSpeed = Number(value);
   } else if (publish.currentSpeed) {
      const value = evaluateRules(partner, publish.currentSpeed, 'currentSpeed');
      if (value !== undefined) semantics.currentSpeed = Number(value);
   } else {
      const value = partner.get('currentSpeed');
      if (value !== null) semantics.currentSpeed = Number(value);
   }

   return semantics;
}

function applyRouteSubscribe(signal: AspectSignal, semantics: SemanticState, subscribe?: SignalDependencyDefinition['subscribe']) {
   if (!subscribe || semantics.route === undefined) return;

   for (const [aspect, mapping] of Object.entries(subscribe)) {
      const routeValue = mapping.route[semantics.route];
      if (routeValue !== undefined) signal.setSignalAspect(aspect, routeValue, false);
   }
}

function applySpeedPropagation(signal: AspectSignal, semantics: SemanticState, _config: SignalDependencyDefinition) {
   if (semantics.currentSpeed === undefined) return;
   signal.setSignalAspect('advanceSpeed', semantics.currentSpeed, false);
}

function applyOverrides(signal: AspectSignal, partner: AspectSignal, overrides?: SignalDependencyDefinition['overrides']) {
   if (!overrides) return;

   for (const [condition, sets] of overrides) {
      if (!evaluateCondition(signal, partner, condition)) continue;

      const when = sets.when as string | undefined;
      if (when && !evaluateCondition(signal, partner, when)) continue;

      for (const [aspect, value] of Object.entries(sets)) {
         if (aspect === 'when') continue;
         signal.setSignalAspect(aspect, value, false);
      }
   }
}

function passesGuards(signal: AspectSignal, partner: AspectSignal, config: SignalDependencyDefinition): boolean {
   if (config.when?.length && !config.when.every((expr) => evaluateCondition(signal, partner, expr))) return false;
   if (config.unless?.some((expr) => evaluateCondition(signal, partner, expr))) return false;
   return true;
}

export function makeCheckSignalDependency(config: SignalDependencyDefinition) {
   return function checkSignalDependency(signal: AspectSignal, partner: AspectSignal): boolean {
      if (!passesGuards(signal, partner, config)) return false;

      const semantics = publishSemantics(partner, partner._template?.dependency?.publish);
      applyRouteSubscribe(signal, semantics, config.subscribe);
      applySpeedPropagation(signal, semantics, config);
      applyOverrides(signal, partner, config.overrides);

      if (!config.stopUnless) return true;
      return !evaluateCondition(signal, partner, config.stopUnless);
   };
}
