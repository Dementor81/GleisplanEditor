import { SignalTemplateDefinition, SignalCondition, SignalElementDefinition, SignalTextElementDefinition } from './signalDefinition.ts';
import { SignalTemplate } from './signalTemplate.ts';
import { TextElement, VisualElement } from './visualElement.ts';

function applyCondition(element: VisualElement, method: "on" | "off", condition?: SignalCondition) {
   if (condition === undefined) return;

   if (Array.isArray(condition)) {
      condition.forEach((singleCondition) => element[method](singleCondition));
      return;
   }

   element[method](condition);
}

function buildTextElement(definition: SignalTextElementDefinition): TextElement {
   const textElement = new TextElement(definition.text, definition.format, definition.color).pos(definition.pos);

   applyCondition(textElement, "on", definition.on);
   applyCondition(textElement, "off", definition.off);
   if (definition.blinks !== undefined) textElement.blinks(definition.blinks);

   return textElement;
}

function buildElement(definition: SignalElementDefinition): any {
   if (typeof definition === "string") return definition;
   if (Array.isArray(definition)) return definition.map(buildElement);
   if ("text" in definition) return buildTextElement(definition);

   const visualElement = new VisualElement(definition.image);
   if (definition.pos) visualElement.pos(definition.pos);
   applyCondition(visualElement, "on", definition.on);
   applyCondition(visualElement, "off", definition.off);
   if (definition.blinks !== undefined) visualElement.blinks(definition.blinks);
   if (definition.children) visualElement.childs(definition.children.map(buildElement));

   return visualElement;
}

export function buildSignalTemplate(definition: SignalTemplateDefinition): SignalTemplate {
   const template = new SignalTemplate(
      definition.id,
      definition.title,
      definition.atlas,
      definition.elements?.map(buildElement),
      definition.initial
   );

   if (definition.scale !== undefined) template.scale = definition.scale;
   if (definition.previewsize !== undefined) (template as any).previewsize = definition.previewsize;
   definition.rules?.forEach(([trigger, setting]) => template.addRule(trigger, setting));
   if (definition.menu) template.createSignalCommandMenu(definition.menu);
   if (definition.config_options?.length) template.configOptions = [...definition.config_options];

   return template;
}
