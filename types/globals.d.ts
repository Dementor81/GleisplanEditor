/**
 * Global type definitions for the application
 * This file declares types for global variables and window extensions
 */

import type { Application } from '../www/code/application';
import type { Track } from '../www/code/track';
import type { Signal } from '../www/code/signal';
import type { Switch } from '../www/code/switch';
import type { GenericObject } from '../www/code/generic_object';
import type { Train } from '../www/code/train';
import type { geometry } from '../www/code/tools';

// ============================================================================
// Global Window Extensions
// ============================================================================

declare global {
  interface Window {
    // Main application instance
    app: Application;
    
    // Exposed classes for debugging/console access
    Track: typeof Track;
    Signal: typeof Signal;
    Switch: typeof Switch;
    GenericObject: typeof GenericObject;
    Train: typeof Train;
    geometry: typeof geometry;
    
    // Version info
    VERSION: string;
  }

  // ============================================================================
  // Global Constants/Variables
  // ============================================================================

  // Canvas elements
  var myCanvas: HTMLCanvasElement & {
    prevent_input?: boolean;
    oncontextmenu?: () => boolean;
  };
  
  var CanvasContainer: HTMLElement;
  
  // UI elements (referenced in code)
  var btnDrawTracks: HTMLElement;
  var btnPlay: HTMLElement;
  var btnStartFromZero: HTMLElement;
  var btnLoadRecent: HTMLElement;
  var btnLoadFromFile: HTMLElement;
  var btnUndo: HTMLElement;
  var loadModal: HTMLElement;
  var sidebar: HTMLElement;

  // Application instance (aliased to window.app)
  var app: Application;
}

// ============================================================================
// Module Augmentations
// ============================================================================

// Extend HTMLElement for custom properties
declare module 'HTMLElement' {
  interface HTMLElement {
    data?: any;
  }
}

export {};

