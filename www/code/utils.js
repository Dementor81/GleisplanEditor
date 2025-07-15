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
   between(value, a, b) {
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
   outoff(value, a, b) {
      return !this.between(value, a, b);
   },

   /**
    * Check if a value equals any of the provided arguments
    * @param {number} value - The value to check
    * @param {...number} args - Values to compare against
    * @returns {boolean} True if value matches any argument
    */
   is(value, ...args) {
      return args.includes(value);
   },

   /**
    * Round a number to specified decimal places
    * @param {number} value - The number to round
    * @param {number} places - Number of decimal places
    * @returns {number} Rounded number
    */
   round(value, places) {
      return Number(Math.round(value + "e" + places) + "e-" + places);
   },

   /**
    * Check if a value is close to a multiple of another value within tolerance
    * @param {number} value - The value to check
    * @param {number} multiple - The multiple to check against
    * @param {number} tolerance - Allowed tolerance
    * @returns {boolean} True if value is close to a multiple
    */
   closeToBy(value, multiple, tolerance) {
      const mod = value % multiple;
      return Math.min(mod, multiple - mod) < tolerance;
   },

   /**
    * Constrain a value between min and max
    * @param {number} min - Minimum value
    * @param {number} value - Value to constrain
    * @param {number} max - Maximum value
    * @returns {number} Constrained value
    */
   minmax(min, value, max) {
      return Math.max(min, Math.min(max, value));
   },

   /**
    * Generate random integer between 0 and max (inclusive)
    * @param {number} max - Maximum value
    * @returns {number} Random integer
    */
   randomInt(max) {
      return Math.floor(Math.random() * (max + 1));
   }
};

// Array utilities
export const ArrayUtils = {
   /**
    * Remove an item from an array
    * @param {Array} array - The array to modify
    * @param {*} item - The item to remove
    * @returns {boolean} True if item was found and removed
    */
   remove(array, item) {
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
   last(array) {
      return array[array.length - 1];
   },

   /**
    * Get the first element of an array
    * @param {Array} array - The array
    * @returns {*} First element or undefined if empty
    */
   first(array) {
      return array[0];
   },

   /**
    * Remove all null and undefined values from array
    * @param {Array} array - The array to clean
    * @returns {Array} Array with null/undefined values removed
    */
   cleanUp(array) {
      return array.filter(item => item != null);
   },

   /**
    * Get a random element from the array
    * @param {Array} array - The array
    * @returns {*} Random element or undefined if empty
    */
   random(array) {
      return array[Math.floor(Math.random() * array.length)];
   },

   /**
    * Count elements that appear more than once
    * @param {Array} array - The array to analyze
    * @returns {number} Count of non-unique elements
    */
   countNonUnique(array) {
      const counts = {};
      let nonUniqueCount = 0;
      
      for (const item of array) {
         if (counts[item] === 1) {
            nonUniqueCount++; // Only increment on second occurrence
         }
         counts[item] = (counts[item] || 0) + 1;
      }
      return nonUniqueCount;
   },

   /**
    * Add element to array only if it doesn't already exist
    * @param {Array} array - The array to modify
    * @param {*} element - The element to add
    * @returns {boolean} True if element was added, false if it already existed
    */
   pushUnique(array, element) {
      if (array.indexOf(element) === -1) {
         array.push(element);
         return true;
      }
      return false;
   },

   /**
    * Group array items by a property path
    * @param {Array} array - The array to group
    * @param {string} propertyPath - Dot-separated property path
    * @returns {Array} Array of grouped arrays, sorted by group size descending
    */
   groupBy(array, propertyPath) {
      const groups = array.reduce((storage, item) => {
         const property = propertyPath.split('.').reduce((acc, key) => acc[key], item);
         const group = property;
         
         storage[group] = storage[group] || [];
         storage[group].push(item);
         return storage;
      }, {});

      return Object.keys(groups)
         .map(key => groups[key])
         .sort((a, b) => b.length - a.length);
   },

   /**
    * Return a copy of the array without the specified item
    * @param {Array} array - The source array
    * @param {*} item - The item to exclude
    * @returns {Array} New array without the item
    */
   without(array, item) {
      return array.filter(element => element !== item);
   }
};

