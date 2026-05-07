/**
 * Type definitions for external libraries
 * 
 * This file provides TypeScript types for libraries that don't have official @types packages.
 * 
 * Official types are installed via npm:
 * - jQuery: @types/jquery
 * - Bootstrap: @types/bootstrap
 * 
 * Custom types defined here:
 * - jQuery onclick helper
 */

/// <reference types="jquery" />
/// <reference types="bootstrap" />

interface JQuery {
  onclick(
    handler: JQuery.TypeEventHandler<HTMLElement, undefined, HTMLElement, HTMLElement, "click">
  ): JQuery;
}

interface Window {
  VERSION: string;
}

