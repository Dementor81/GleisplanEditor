import { Signal } from './signal.ts';
import type { SignalDependencyDefinition } from './signalDefinition.ts';

export type SemanticState = {
   route?: string;
   currentSpeed?: number;
};

export class SignalDependency {
   readonly config: SignalDependencyDefinition;

   constructor(config: SignalDependencyDefinition) {
      this.config = config;
   }

   static hasHandler(dependency: SignalDependencyDefinition): boolean {
      return !!(
         dependency.when?.length ||
         dependency.unless?.length ||
         dependency.subscribe ||
         dependency.overrides?.length ||
         dependency.stopUnless
      );
   }

   static evaluateCondition(
      signal: Signal,
      partner: Signal,
      expr: string,
      partnerSemantics?: SemanticState
   ): boolean {
      if (expr.includes('&&')) {
         return expr.split('&&').every((part) =>
            SignalDependency.evaluateCondition(signal, partner, part.trim(), partnerSemantics)
         );
      }
      if (expr.includes('||')) {
         return expr.split('||').some((part) =>
            SignalDependency.evaluateCondition(signal, partner, part.trim(), partnerSemantics)
         );
      }

      if (expr.startsWith('partner.currentSpeed')) {
         const semantics =
            partnerSemantics ??
            SignalDependency.publishSemantics(partner, partner._template?.dependency?.publish);
         if (semantics.currentSpeed === undefined) return false;
         return SignalDependency.evaluateAspectValueCondition(
            semantics.currentSpeed,
            expr.slice('partner.'.length)
         );
      }

      if (expr.startsWith('self.')) return signal.check(expr.slice(5));
      if (expr.startsWith('partner.')) return partner.check(expr.slice(8));
      return signal.check(expr);
   }

   private static evaluateAspectValueCondition(value: number, aspectCondition: string): boolean {
      const equation = Signal._splitEquation(aspectCondition);
      if (!equation) return false;

      const rightToken = equation.operands[1].trim();
      const quoted = Signal._parseQuotedLiteral(rightToken);
      const right =
         quoted !== null ? quoted : Signal._isNumericLiteral(rightToken) ? Number(rightToken) : rightToken;
      return Signal._compareConditionValues(value, right, equation.operator);
   }

   static publishSemantics(partner: Signal, publish?: SignalDependencyDefinition['publish']): SemanticState {
      if (!publish) return {};

      const semantics: SemanticState = {};

      if (publish.route) {
         const route = SignalDependency.evaluateRules(partner, publish.route, 'route');
         if (route !== undefined) semantics.route = String(route);
      }

      if (publish.currentSpeed === 'currentSpeed') {
         const value = partner.get('currentSpeed');
         if (value !== null) semantics.currentSpeed = Number(value);
      } else if (publish.currentSpeed) {
         const value = SignalDependency.evaluateRules(partner, publish.currentSpeed, 'currentSpeed');
         if (value !== undefined) semantics.currentSpeed = Number(value);
      } else {
         const value = partner.get('currentSpeed');
         if (value !== null) semantics.currentSpeed = Number(value);
      }

      return semantics;
   }

   private static evaluateRules(
      signal: Signal,
      rules: Array<[string, string | number]> | undefined,
      aspectKey: string
   ): string | number | undefined {
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

   check(signal: Signal, partner: Signal): boolean {
      if (!this.passesGuards(signal, partner)) return false;

      const semantics = SignalDependency.publishSemantics(partner, partner._template?.dependency?.publish);
      this.applyRouteSubscribe(signal, semantics);
      this.applySpeedPropagation(signal, semantics);
      this.applyOverrides(signal, partner, semantics);

      if (!this.config.stopUnless) return true;
      return !SignalDependency.evaluateCondition(signal, partner, this.config.stopUnless);
   }

   private passesGuards(signal: Signal, partner: Signal): boolean {
      if (this.config.when?.length && !this.config.when.every((expr) => SignalDependency.evaluateCondition(signal, partner, expr))) {
         return false;
      }
      if (this.config.unless?.some((expr) => SignalDependency.evaluateCondition(signal, partner, expr))) return false;
      return true;
   }

   private applyRouteSubscribe(signal: Signal, semantics: SemanticState) {
      const subscribe = this.config.subscribe;
      if (!subscribe || semantics.route === undefined) return;

      for (const [aspect, mapping] of Object.entries(subscribe)) {
         const routeValue = mapping.route[semantics.route];
         if (routeValue !== undefined) signal.setSignalAspect(aspect, routeValue, false);
      }
   }

   private applySpeedPropagation(signal: Signal, semantics: SemanticState) {
      if (semantics.currentSpeed === undefined) return;
      signal.setSignalAspect('advanceSpeed', semantics.currentSpeed, false);
   }

   private applyOverrides(signal: Signal, partner: Signal, partnerSemantics: SemanticState) {
      const overrides = this.config.overrides;
      if (!overrides) return;

      for (const [condition, sets] of overrides) {
         if (!SignalDependency.evaluateCondition(signal, partner, condition, partnerSemantics)) continue;

         const when = sets.when as string | undefined;
         if (when && !SignalDependency.evaluateCondition(signal, partner, when, partnerSemantics)) continue;

         for (const [aspect, value] of Object.entries(sets)) {
            if (aspect === 'when') continue;
            signal.setSignalAspect(aspect, value, false);
         }
      }
   }
}
