import {
   SignalTemplateDefinition,
   SignalCondition,
   SignalElementDefinition,
   SignalTextElementDefinition,
   SignalMenuDefinition,
   SignalMenuItemDefinition,
   SignalMenuButtonItem,
   SignalMenuRuntime,
   SignalMenuRuntimeButton,
   SignalMenuRuntimeDropdown,
   SignalMenuRuntimeItem,
} from './signalDefinition.ts';
import { SignalTemplate } from './signalTemplate.ts';
import { TextElement, VisualElement } from './visualElement.ts';
import { SignalDependency } from './signalDependency.ts';
import { ArrayUtils } from './utils.ts';

export class SignalDefinitionBuilder {
   static build(definition: SignalTemplateDefinition): SignalTemplate {
      const template = new SignalTemplate(
         definition.id,
         definition.title,
         definition.atlas,
         definition.elements?.map(SignalDefinitionBuilder.buildElement),
         definition.initial
      );

      if (definition.scale !== undefined) template.scale = definition.scale;
      if (definition.previewsize !== undefined) template.previewsize = definition.previewsize;
      definition.rules?.forEach(([trigger, setting]) => template.addRule(trigger, setting));
      if (definition.menu) template.setSignalMenu(SignalDefinitionBuilder.buildMenu(definition.menu, template));
      if (definition.config_options?.length) template.configOptions = [...definition.config_options];
      if (definition.dependency) {
         template.dependency = definition.dependency;
         if (SignalDependency.hasHandler(definition.dependency)) {
            template.attachDependencyHandler(new SignalDependency(definition.dependency));
         }
      }

      return template;
   }

   private static applyCondition(element: VisualElement, method: 'on' | 'off', condition?: SignalCondition) {
      if (condition === undefined) return;

      if (Array.isArray(condition)) {
         condition.forEach((singleCondition) => element[method](singleCondition));
         return;
      }

      element[method](condition);
   }

   private static buildTextElement(definition: SignalTextElementDefinition): TextElement {
      const textElement = new TextElement(definition.text, definition.format, definition.color).pos(definition.pos);

      SignalDefinitionBuilder.applyCondition(textElement, 'on', definition.on);
      SignalDefinitionBuilder.applyCondition(textElement, 'off', definition.off);
      if (definition.blinks !== undefined) textElement.blinks(definition.blinks);

      return textElement;
   }

   private static buildButtonItem(item: SignalMenuButtonItem, template: SignalTemplate): SignalMenuRuntimeButton {
      return {
         type: 'button',
         text: item.text,
         command: item.command,
         visual_elements: template.getVisualElementsByOnCondition(item.command),
      };
   }

   private static buildDropdownItem(item: SignalMenuButtonItem, template: SignalTemplate): SignalMenuRuntimeDropdown {
      return {
         type: 'dropdown',
         text: item.text,
         command: item.command,
         visual_elements: template.getVisualElementsByOnCondition(item.command),
      };
   }

   private static buildMenuItemDefinition(item: SignalMenuItemDefinition, template: SignalTemplate): SignalMenuRuntimeItem | null {
      if ('buttonGroup' in item) {
         if (!item.buttonGroup.length) return null;
         return {
            type: 'buttonGroup',
            items: item.buttonGroup.map((btn) => SignalDefinitionBuilder.buildButtonItem(btn, template)),
         };
      }
      if ('button' in item) return SignalDefinitionBuilder.buildButtonItem(item.button, template);
      if ('dropdown' in item) return SignalDefinitionBuilder.buildDropdownItem(item.dropdown, template);
      throw new Error('Unknown menu item');
   }

   static buildMenu(menu: SignalMenuDefinition, template: SignalTemplate): SignalMenuRuntime {
      return menu.map((section) => ({
         section: ArrayUtils.cleanUp(
            section.section.map((item) => SignalDefinitionBuilder.buildMenuItemDefinition(item, template))
         ) as SignalMenuRuntimeItem[],
      }));
   }

   private static buildElement(definition: SignalElementDefinition): any {
      if (typeof definition === 'string') return definition;
      if (Array.isArray(definition)) return definition.map(SignalDefinitionBuilder.buildElement);
      if ('text' in definition) return SignalDefinitionBuilder.buildTextElement(definition);

      const visualElement = new VisualElement(definition.image);
      if (definition.label) visualElement.label(definition.label);
      if (definition.pos) visualElement.pos(definition.pos);
      SignalDefinitionBuilder.applyCondition(visualElement, 'on', definition.on);
      SignalDefinitionBuilder.applyCondition(visualElement, 'off', definition.off);
      if (definition.blinks !== undefined) visualElement.blinks(definition.blinks);
      if (definition.blendMode) visualElement.blendMode(definition.blendMode);
      if (definition.rotation) visualElement.rotation(definition.rotation);
      if (definition.flip) visualElement.flip(definition.flip);
      if (definition.children) visualElement.childs(definition.children.map(SignalDefinitionBuilder.buildElement));

      return visualElement;
   }
}
