"use strict";

/**
 * Application Configuration and Constants
 * This file contains all configuration values and constants used throughout the application
 */

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
    MAX_SCALE: 8,
    MIN_SCALE: 0.2,
    
    // History and undo
    MOST_UNDO: 20,    
    
    // Canvas settings
    CANVAS_AUTO_CLEAR: true,
    CANVAS_ENABLE_DOM_EVENTS: true,
    TICKER_FRAMERATE: 1,
};

// Computed values based on CONFIG
export const COMPUTED = {
    GRID_SIZE_2: CONFIG.GRID_SIZE / 2,
};

// Direction constants
export const DIRECTION = {
    LEFT_2_RIGHT: 1,
    RIGHT_2_LEFT: -1,
};

// Mouse action constants
export const MOUSE_DOWN_ACTION = {
    NONE: 0,
    SCROLL: 1,
    BUILD_TRACK: 2,
    MOVE_ITEM: 3,
    DND_SIGNAL: 4,
    ADD_TRAIN: 5,
    MOVE_TRAIN: 6,
    MOVE_OBJECT: 7,
    DND_TRACK: 8,
    CUSTOM: 9,
};

// Custom mouse action constants
export const CUSTOM_MOUSE_ACTION = {
    NONE: 0,
    DRAWING: 1,
    ERASER: 2,
    TEXT: 3,
    PLATTFORM: 4,
    TRAIN_COUPLE: 5,
    TRAIN_DECOUPLE: 6,
};

// Menu constants
export const MENU = {
    EDIT_SIGNAL: 0,
    NEW_SIGNAL: 1,
    EDIT_TRAIN: 2,
    NEW_TRAIN: 3,
    NEW_OBJECT: 4,
    EDIT_OBJECT: 5,
    EDIT_TRACK: 6,
};



// Default colors
export const COLORS = {
    GRID: "#ccc",
    SIGNAL_POSITION_LINE: "#e00",
    DRAWING_BLUEPRINT: "blue",
    DRAWING_ACTIVE: "#0000ff90",
    DRAWING_INVALID: "red",
    TRANSPARENT: "#00000000",
    DRAWING_PLATTFORM: "#111111",
    
    // Train colors
    TRAIN_COLORS: ["#ff0000", "#ffff00", "#00ff00", "#0000ff"],
};

// File paths and resource locations
export const PATHS = {
    IMAGES: "images",
    PREBUILDS: "prebuilds.xml",
    FONTS: {
        CONDENSED: "condenced",
        ARIAL: "Arial",
        DOT: "DOT",
    },
};

// Input settings
export const INPUT = {
    MOUSE_MOVEMENT_THRESHOLD: 4, // pixels
    TOUCH_SUPPORTED: true,
    CONTEXT_MENU_ENABLED: false,
    ZOOM_STEP_DIVISOR: 1000,
};

// Container names for CreateJS
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
};

// Default export for convenience
export default {
    CONFIG,
    COMPUTED,
    DIRECTION,
    MOUSE_DOWN_ACTION,
    CUSTOM_MOUSE_ACTION,
    MENU,
    COLORS,
    PATHS,
    INPUT,
    CONTAINERS,
}; 