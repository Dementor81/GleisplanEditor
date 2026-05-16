export type SignalCondition = string | string[];

export type SignalMenuDefinition = Array<string | string[]>;

export type SignalElementDefinition =
   | string
   | SignalVisualElementDefinition
   | SignalTextElementDefinition
   | SignalElementDefinition[];

export interface SignalVisualElementDefinition {
   image?: string;
   pos?: [number, number];
   on?: SignalCondition;
   off?: SignalCondition;
   blinks?: boolean;
   children?: SignalElementDefinition[];
}

export interface SignalTextElementDefinition {
   text: string;
   format?: Array<string | number>;
   color?: string;
   pos: [number, number];
   bounds?: [number, number];
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
   rules?: Array<[string, string]>;
   config_options?: SignalConfigOptionDefinition[];
}
