export type SignalInitialAspects = string | string[];

export interface SignalMenuButtonItem {
   text: string;
   command: string;
}

export interface SignalMenuButtonDefinition {
   button: SignalMenuButtonItem;
}

export interface SignalMenuDropdownDefinition {
   dropdown: SignalMenuButtonItem;
}

export interface SignalMenuButtonGroupDefinition {
   buttonGroup: SignalMenuButtonItem[];
}

export type SignalMenuItemDefinition =
   | SignalMenuButtonGroupDefinition
   | SignalMenuButtonDefinition
   | SignalMenuDropdownDefinition;

export interface SignalMenuSectionDefinition {
   section: SignalMenuItemDefinition[];
}

export type SignalMenuDefinition = SignalMenuSectionDefinition[];

export interface SignalMenuRuntimeButton {
   type: 'button';
   text: string;
   command: string;
   visual_elements: unknown[];
}

export interface SignalMenuRuntimeDropdown {
   type: 'dropdown';
   text: string;
   command: string;
   visual_elements: unknown[];
}

export interface SignalMenuRuntimeButtonGroup {
   type: 'buttonGroup';
   items: SignalMenuRuntimeButton[];
}

export type SignalMenuRuntimeItem =
   | SignalMenuRuntimeButtonGroup
   | SignalMenuRuntimeButton
   | SignalMenuRuntimeDropdown;

export interface SignalMenuRuntimeSection {
   section: SignalMenuRuntimeItem[];
}

export type SignalMenuRuntime = SignalMenuRuntimeSection[];

export type SignalElementDefinition =
   | string
   | SignalVisualElementDefinition
   | SignalTextElementDefinition
   | SignalElementDefinition[];

export interface SignalRotationDefinition {
   element?: string | string[];
   angle: number;
   pivot?: [number, number];
   duration?: number;
}

export type SignalRotationConfig = SignalRotationDefinition | SignalRotationDefinition[];

export interface SignalFlipDefinition {
   element?: string | string[];
   scaleY: 0 | 1;
   pivot?: [number, number];
   duration?: number;
}

export type SignalFlipConfig = SignalFlipDefinition | SignalFlipDefinition[];

export type SignalBlendMode = "multiply";

export interface SignalVisualElementDefinition {
   label?: string;
   image?: string;
   pos?: [number, number];
   on?: string;
   off?: string;
   blinks?: boolean;
   blendMode?: SignalBlendMode;
   rotation?: SignalRotationConfig;
   flip?: SignalFlipConfig;
   children?: SignalElementDefinition[];
}

export interface SignalTextElementDefinition {
   text: string;
   format?: Array<string | number>;
   color?: string;
   pos: [number, number];
   on?: string;
   off?: string;
   blinks?: boolean;
}

export interface SignalConfigOptionDefinition {
   name: string;
   title: string;
   convertTo?: string;
}

export type PublishRule = [condition: string, value: string | number];

export interface SignalDependencyDefinition {
   when?: string[];
   unless?: string[];
   publish?: {
      route?: PublishRule[];
      currentSpeed?: PublishRule[];
   };
   subscribe?: {
      vr?: { route: Record<string, number> };
      hp?: { route: Record<string, number> };
   };
   overrides?: Array<[string, Record<string, string | number>]>;
   stopUnless?: string;
}

export interface SignalTemplateDefinition {
   id: string;
   title: string;
   atlas: string;
   elements?: SignalElementDefinition[];
   initial?: SignalInitialAspects;
   scale?: number;
   previewsize?: number;
   menu?: SignalMenuDefinition;
   rules?: Array<[string, string]>;
   config_options?: SignalConfigOptionDefinition[];
   dependency?: SignalDependencyDefinition;
}
