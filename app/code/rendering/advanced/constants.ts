"use strict";

export const SWITCH_UI_STROKE = 3;
export const TRACK_SCALE = 0.25;
export const SCHWELLEN_VARIANTEN = 24;
export const SWITCH_WING_RAIL_LENGTH = 10;
export const SWITCH_WING_RAIL_THICKNESS = 3.5;
export const SWITCH_WING_RAIL_SLOPE_FACTOR = 1.5;
export const RAILS: [number, string][] = [
   [3.2, "#222"],
   [2.8, "#999"],
   [1.4, "#eee"],
];

/** Minimum tangent length spent on a Track-Track curve (matches the legacy fixed size). */
export const TRACK_CURVE_MIN_SIZE = 30;
/** Extra tangent length added as the joint angle approaches 90°. */
export const TRACK_CURVE_ANGLE_FACTOR = 40;
/** Minimum straight section that must remain between two curves on the same track. */
export const TRACK_CURVE_MIN_STRAIGHT = 1;

/** Set true to draw switchRenderingValues points on the debug layer. */
export const DEBUG_VISUALIZE_SWITCH_PARAMS = false;

/** Set true to draw track centerLine / rail / sleeper calculation points on the debug layer. */
export const DEBUG_VISUALIZE_TRACK_PARAMS = false;
