"use strict";

import type { Signal } from "./signal.ts";

export type SignalSemanticState = {
   route?: string;
   currentSpeed?: number;
};

type SignalConditionContext = {
   partner?: Signal;
   partnerSemantics?: SignalSemanticState;
};

type SignalConditionEquation = {
   operands: [string, string];
   operator: string;
};

export class SignalConditionEvaluator {
   static evaluate(signal: Signal, condition: unknown, context: SignalConditionContext = {}): boolean {
      if (condition == null) return true;

      const expr = String(condition);
      const equation = SignalConditionEvaluator.splitEquation(expr);
      if (!equation) return SignalConditionEvaluator.hasAspect(signal, expr, context);

      if (equation.operator === "&&") {
         return equation.operands.every((part) => SignalConditionEvaluator.evaluate(signal, part, context));
      }
      if (equation.operator === "||") {
         return equation.operands.some((part) => SignalConditionEvaluator.evaluate(signal, part, context));
      }

      const left = SignalConditionEvaluator.resolveOperand(signal, equation.operands[0], context);
      const right = SignalConditionEvaluator.resolveOperand(signal, equation.operands[1], context);
      return SignalConditionEvaluator.compareConditionValues(left, right, equation.operator);
   }

   static parseAssignment(command: string): [string, string | number] | null {
      const eqIndex = SignalConditionEvaluator.indexOfOperatorOutsideQuotes(command, "=");
      if (eqIndex === -1) return null;

      const setting = command.slice(0, eqIndex).trim();
      const raw = command.slice(eqIndex + 1).trim();
      const quoted = SignalConditionEvaluator.parseQuotedLiteral(raw);
      if (quoted !== null) return [setting, quoted];
      if (SignalConditionEvaluator.isNumericLiteral(raw)) return [setting, Number(raw)];
      return null;
   }

   static parseQuotedLiteral(token: string): string | null {
      const trimmed = token.trim();
      const match = trimmed.match(/^(['"])(.*)\1$/s);
      return match ? match[2] : null;
   }

   static isNumericLiteral(token: string): boolean {
      const trimmed = token.trim();
      return trimmed.length > 0 && Number.isFinite(Number(trimmed));
   }

   static splitEquation(equation: string): SignalConditionEquation | null {
      const operators = ["||", "&&", "!=", "<=", ">=", "=", ">", "<"];
      for (const op of operators) {
         const index = SignalConditionEvaluator.indexOfOperatorOutsideQuotes(equation, op);
         if (index === -1) continue;
         return {
            operands: [equation.slice(0, index), equation.slice(index + op.length)],
            operator: op,
         };
      }
      return null;
   }

   static compareConditionValues(left: unknown, right: unknown, operator: string): boolean {
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

   private static indexOfOperatorOutsideQuotes(text: string, operator: string): number {
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

   private static hasAspect(signal: Signal, token: string, context: SignalConditionContext): boolean {
      const resolved = SignalConditionEvaluator.resolveAspect(signal, token, context);
      return resolved.target.get(resolved.aspect) != null;
   }

   private static resolveOperand(signal: Signal, token: string, context: SignalConditionContext): unknown {
      const trimmed = token.trim();
      const quoted = SignalConditionEvaluator.parseQuotedLiteral(trimmed);
      if (quoted !== null) return quoted;
      if (SignalConditionEvaluator.isNumericLiteral(trimmed)) return Number(trimmed);

      if (trimmed === "self.id") return signal._template?.id ?? "";
      if (trimmed === "partner.id") return context.partner?._template?.id ?? "";
      if (trimmed === "partner.currentSpeed") return context.partnerSemantics?.currentSpeed;

      const resolved = SignalConditionEvaluator.resolveAspect(signal, trimmed, context);
      const aspect = resolved.target.get(resolved.aspect);
      return aspect != null ? aspect : -1;
   }

   private static resolveAspect(
      signal: Signal,
      token: string,
      context: SignalConditionContext
   ): { target: Signal; aspect: string } {
      const trimmed = token.trim();
      if (trimmed.startsWith("self.")) return { target: signal, aspect: trimmed.slice(5) };
      if (trimmed.startsWith("partner.") && context.partner) {
         return { target: context.partner, aspect: trimmed.slice(8) };
      }
      return { target: signal, aspect: trimmed };
   }
}
