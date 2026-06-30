import { Signal } from './signal.ts';
import { SignalConditionEvaluator, type SignalSemanticState } from './signalConditionEvaluator.ts';
import type { SignalDependencyDefinition } from './signalDefinition.ts';

export type SemanticState = SignalSemanticState;

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
      const semantics =
         partnerSemantics ??
         SignalDependency.publishSemantics(partner, partner._template?.dependency?.publish);
      return SignalConditionEvaluator.evaluate(signal, expr, {
         partner,
         partnerSemantics: semantics,
      });
   }

   static publishSemantics(partner: Signal, publish?: SignalDependencyDefinition['publish']): SemanticState {
      if (!publish) return {};

      const semantics: SemanticState = {};

      if (publish.route) {
         const route = SignalDependency.evaluateRules(partner, publish.route);
         if (route !== undefined) semantics.route = String(route);
      }

      const nativeSpeed = partner.get('currentSpeed');
      if (nativeSpeed !== null) semantics.currentSpeed = Number(nativeSpeed);

      if (publish.currentSpeed?.length) {
         const ruled = SignalDependency.evaluateRules(partner, publish.currentSpeed);
         if (ruled !== undefined) semantics.currentSpeed = Number(ruled);
      }

      return semantics;
   }

   private static evaluateRules(
      signal: Signal,
      rules: Array<[string, string | number]> | undefined
   ): string | number | undefined {
      if (!rules) return undefined;

      for (const [condition, value] of rules) {
         if (signal.check(condition)) return value;
      }
      return undefined;
   }

   /**
    * Checks the signal dependency. returns true if the signal should NOT be propagated further.
    * @param signal - The signal to check. The signal that is the destination of the data. It should always be a advance signal or a combined main and advance signal.
    * @param partner - The partner signal. The signal that is the source of the data. It should always be a main or master signal.
    * @returns True if the signal should NOT be propagated further, false otherwise.
    */
   check(signal: Signal, partner: Signal): boolean {
      const semantics = SignalDependency.publishSemantics(partner, partner._template?.dependency?.publish);
      const matches = (expr: string) =>
         SignalConditionEvaluator.evaluate(signal, expr, {
            partner,
            partnerSemantics: semantics,
         });

      // checks when condition is met. if not, the signal is transparent and the propagation stops.
      if (this.config.when?.length && !this.config.when.every(matches)) {
         return false; // the signal is transparent and the propagation goes on.
      }

      // checks the unless condition. if it fails, the signal will not presignal the stop/go aspect but it will apply the speed..
      const skipApply = this.config.unless?.some(matches) ?? false;

      if (signal.check('VRsig||slave') ) {
         if (!skipApply) this.applyRouteSubscribe(signal, semantics);
         this.applySpeedPropagation(signal, semantics);
         if (!skipApply) this.applyOverrides(signal, partner, semantics);
      }

      if (!this.config.stopUnless) return true;
      const shouldContinue = matches(this.config.stopUnless);
      return !shouldContinue;
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
