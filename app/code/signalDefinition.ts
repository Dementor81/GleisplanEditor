export type SignalCondition = string | string[];

export type SignalMenuDefinition = Array<string | string[]>;

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
   on?: SignalCondition;
   off?: SignalCondition;
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
   on?: SignalCondition;
   off?: SignalCondition;
   blinks?: boolean;
}

export interface SignalConfigOptionDefinition {
   name: string;
   title: string;
   convertTo?: string;
}

export interface SignalTemplateDefinition {
   id: string;
   title: string;
   atlas: string;
   elements?: SignalElementDefinition[];
   initial?: SignalCondition;
   scale?: number;
   previewsize?: number;
   menu?: SignalMenuDefinition;
   config_menu?: SignalMenuDefinition;
   rules?: Array<[string, string]>;
   config_options?: SignalConfigOptionDefinition[];
}
