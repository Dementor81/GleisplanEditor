"use strict";

/**
 * Application Configuration and Constants
 * This file contains all configuration values and constants used throughout the application
 */

// ============================================================================
// Main Application Config
// ============================================================================

export const CONFIG = {
    // Application metadata
    VERSION: "0.5",
    
    // Default settings
    DEFAULT_SIMPLIFIED_VIEW: true,
    
    // Grid and layout settings
    GRID_SIZE: 50,
    SNAP_TO_GRID: 5,
    GRID_STROKE_STYLE: 0.25,
    
    // Zoom and scaling
    MAX_SCALE: 20,
    MIN_SCALE: 0.2,
    
    // History and undo
    MOST_UNDO: 20,    
    
    // Canvas settings
    CANVAS_AUTO_CLEAR: true,
    CANVAS_ENABLE_DOM_EVENTS: true,
    TICKER_FRAMERATE: 1,
} as const;

// Type helper: Extract the type of CONFIG
export type AppConfig = typeof CONFIG;

// ============================================================================
// Computed Values
// ============================================================================

export const COMPUTED = {
    GRID_SIZE_2: CONFIG.GRID_SIZE / 2,
} as const;

// ============================================================================
// Enums for Type-Safe Constants
// ============================================================================

/**
 * Direction constants for signal and train movement
 */
export enum Direction {
    LEFT_2_RIGHT = 1,
    RIGHT_2_LEFT = -1,
}

// Backward compatibility - keep the old object export
export const DIRECTION = {
    LEFT_2_RIGHT: Direction.LEFT_2_RIGHT,
    RIGHT_2_LEFT: Direction.RIGHT_2_LEFT,
} as const;

/**
 * Custom mouse action types
 */
export enum CustomMouseAction {
    NONE = 0,
    DRAWING = 1,
    ERASER = 2,
    TEXT = 3,
    PLATTFORM = 4,
    TRAIN_COUPLE = 5,
    TRAIN_DECOUPLE = 6,
    RAILWAY_CROSSING = 7,
}

// Backward compatibility
export const CUSTOM_MOUSE_ACTION = {
    NONE: CustomMouseAction.NONE,
    DRAWING: CustomMouseAction.DRAWING,
    ERASER: CustomMouseAction.ERASER,
    TEXT: CustomMouseAction.TEXT,
    PLATTFORM: CustomMouseAction.PLATTFORM,
    TRAIN_COUPLE: CustomMouseAction.TRAIN_COUPLE,
    TRAIN_DECOUPLE: CustomMouseAction.TRAIN_DECOUPLE,
    RAILWAY_CROSSING: CustomMouseAction.RAILWAY_CROSSING,
} as const;

/**
 * Menu types
 */
export enum Menu {
    EDIT_SIGNAL = 0,
    NEW_SIGNAL = 1,
    EDIT_TRAIN = 2,
    NEW_TRAIN = 3,
    NEW_OBJECT = 4,
    EDIT_OBJECT = 5,
    EDIT_TRACK = 6,
    EDIT_RAILWAY_CROSSING = 7,
}

// Backward compatibility
export const MENU = {
    EDIT_SIGNAL: Menu.EDIT_SIGNAL,
    NEW_SIGNAL: Menu.NEW_SIGNAL,
    EDIT_TRAIN: Menu.EDIT_TRAIN,
    NEW_TRAIN: Menu.NEW_TRAIN,
    NEW_OBJECT: Menu.NEW_OBJECT,
    EDIT_OBJECT: Menu.EDIT_OBJECT,
    EDIT_TRACK: Menu.EDIT_TRACK,
    EDIT_RAILWAY_CROSSING: Menu.EDIT_RAILWAY_CROSSING,
} as const;

// ============================================================================
// Colors
// ============================================================================

export const COLORS = {
    GRID: "#ccc",
    SIGNAL_POSITION_LINE: "#e00",
    DRAWING_BLUEPRINT: "blue",
    DRAWING_ACTIVE: "#0000ff90",
    DRAWING_INVALID: "red",
    TRANSPARENT: "#00000000",
    DRAWING_PLATTFORM: "#111111",
    
    // Train colors
    TRAIN_COLORS: ["#ff0000", "#ffff00", "#00ff00", "#0000ff"] as const,
} as const;

// ============================================================================
// File Paths and Resources
// ============================================================================

export const PATHS = {
    IMAGES: "images",
    PREBUILDS: "prebuilds.xml",
    FONTS: {
        CONDENSED: "condenced",
        ARIAL: "Arial",
        DOT: "DOT",
    } as const,
} as const;

// ============================================================================
// Input Settings
// ============================================================================

export const INPUT = {
    MOUSE_MOVEMENT_THRESHOLD: 4, // pixels
    TOUCH_SUPPORTED: true,
    CONTEXT_MENU_ENABLED: false,
    ZOOM_STEP_DIVISOR: 1000,
} as const;

// ============================================================================
// Container Names
// ============================================================================

export const CONTAINERS = {
    MAIN: "main",
    DEBUG: "debug",
    TRACKS: "tracks",
    OBJECTS: "objects",
    TRAINS: "trains",
    SIGNALS: "signals",
    UI: "ui",
    SELECTION: "selection",
    OVERLAY: "overlay",
    DRAWING: "drawing_container",
} as const;

// ============================================================================
// Type Exports
// ============================================================================

export type ColorConfig = typeof COLORS;
export type PathConfig = typeof PATHS;
export type InputConfig = typeof INPUT;
export type ContainerNames = typeof CONTAINERS;

// ============================================================================
// Default Export (for convenience)
// ============================================================================

export default {
    CONFIG,
    COMPUTED,
    DIRECTION,
    CUSTOM_MOUSE_ACTION,
    MENU,
    COLORS,
    PATHS,
    INPUT,
    CONTAINERS,
    
    // Export enums too
    Direction,
    CustomMouseAction,
    Menu,
} as const; 