"use strict";

// Number utilities
export const NumberUtils = {
   /**
    * Check if a value is between two other values (inclusive)
    * @param {number} value - The value to check
    * @param {number} a - First boundary
    * @param {number} b - Second boundary  
    * @returns {boolean} True if value is between a and b
    */
   between(value: number, a: number, b: number): boolean {
      const min = Math.min(a, b);
      const max = Math.max(a, b);
      return value >= min && value <= max;
   },

   /**
    * Check if a value is outside the range of two other values
    * @param {number} value - The value to check
    * @param {number} a - First boundary
    * @param {number} b - Second boundary
    * @returns {boolean} True if value is outside the range
    */
   outoff(value: number, a: number, b: number): boolean {
      return !this.between(value, a, b);
   },

   /**
    * Check if a value equals any of the provided arguments
    * @param {number} value - The value to check
    * @param {...number} args - Values to compare against
    * @returns {boolean} True if value matches any argument
    */
   is(value:number, ...args: number[]): boolean {
      return args.includes(value);
   },

   /**
    * Round a number to specified decimal places
    * @param {number} value - The number to round
    * @param {number} places - Number of decimal places
    * @returns {number} Rounded number
    */
   round(value: number, places: number): number {
      let factor = Math.pow(10, places);
      return Number(Math.round(value*factor) / factor);
   },

   /**
    * Constrain a value between min and max
    * @param {number} min - Minimum value
    * @param {number} value - Value to constrain
    * @param {number} max - Maximum value
    * @returns {number} Constrained value
    */
   minmax(min: number, value: number, max: number): number {
      return Math.max(min, Math.min(max, value));
   },

   /**
    * Generate random integer between 0 and max (inclusive)
    * @param {number} max - Maximum value
    * @returns {number} Random integer
    */
   randomInt(max: number): number {
      return Math.floor(Math.random() * (max + 1));
   }
} as const;

// Array utilities
export const ArrayUtils = {
   /**
    * Remove an item from an array
    * @param {Array} array - The array to modify
    * @param {*} item - The item to remove
    * @returns {boolean} True if item was found and removed
    */
   remove(array: unknown[], item: unknown): boolean {
      const index = array.indexOf(item);
      if (index !== -1) {
         array.splice(index, 1);
         return true;
      }
      return false;
   },



   /**
    * Get the last element of an array
    * @param {Array} array - The array
    * @returns {*} Last element or undefined if empty
    */
   last<T>(array: T[]): T {
      return array[array.length - 1];
   },

   /**
    * Get the first element of an array
    * @param {Array} array - The array
    * @returns {*} First element or undefined if empty
    */
   first<T>(array: T[]): T {
      return array[0];
   },

   /**
    * Remove all null and undefined values from array
    * @param {Array} array - The array to clean
    * @returns {Array} Array with null/undefined values removed
    */
   cleanUp(array: unknown[]): unknown[] {
      return array.filter(item => item != null);
   },

   /**
    * Get a random element from the array
    * @param {Array} array - The array
    * @returns {*} Random element or undefined if empty
    */
   random(array: readonly unknown[]): unknown {
      return array[Math.floor(Math.random() * array.length)];
   },

   /**
    * Counts elements that appear more than once
    * @param {Array} array - The array to analyze
    * @returns {number} Count of non-unique elements
    */
   countNonUnique(array: unknown[]): number {
      const counts: Record<string | number | symbol, number> = {} as Record<string | number | symbol, number>;
      let nonUniqueCount = 0;
      
      for (const item of array) {
         if (counts[item as string | number | symbol] === 1) {
            nonUniqueCount++; // Only increment on second occurrence
         }
         counts[item as string | number | symbol] = (counts[item as string | number | symbol] || 0) + 1;
      }
      return nonUniqueCount;
   },

   /**
    * Add element to array only if it doesn't already exist
    * @param {Array} array - The array to modify
    * @param {*} element - The element to add
    * @returns {boolean} True if element was added, false if it already existed
    */
   pushUnique(array: unknown[], element: unknown): boolean {
      if (array.indexOf(element) === -1) {
         array.push(element);
         return true;
      }
      return false;
   },

} as const;

