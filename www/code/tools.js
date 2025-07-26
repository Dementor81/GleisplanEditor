"use strict";

import { NumberUtils } from './utils.js';

// Utility functions
export function findFieldNameForObject(container, ref) {
   for (let key of Object.keys(container)) {
      if (container[key] === ref) {
         return key;
      }
   }
   return null;
}

export function swap(current, value1, value2) {
   return current === value1 ? value2 : value1;
}

export function deepEqual(x, y) {
   const ok = Object.keys,
      tx = typeof x,
      ty = typeof y;
   return x && y && tx === "object" && tx === ty
      ? ok(x).length === ok(y).length && ok(x).every((key) => deepEqual(x[key], y[key]))
      : x === y;
}

export function clone(obj) {
   var copy;

   // Handle the 3 simple types, and null or undefined
   if (null == obj || "object" != typeof obj) return obj;

   // Handle Date
   if (obj instanceof Date) {
      copy = new Date();
      copy.setTime(obj.getTime());
      return copy;
   }

   // Handle Array
   if (obj instanceof Array) {
      copy = [];
      for (var i = 0, len = obj.length; i < len; i++) {
         copy[i] = clone(obj[i]);
      }
      return copy;
   }

   // Handle Object
   if (obj instanceof Object) {
      copy = {};
      for (var attr in obj) {
         if (obj.hasOwnProperty(attr)) copy[attr] = clone(obj[attr]);
      }
      return copy;
   }

   throw new Error("Unable to copy obj! Its type isn't supported.");
}

export function uuidv4() {
   return ([1e7] + -1e3 + -4e3 + -8e3 + -1e11).replace(/[018]/g, (c) =>
      (c ^ (crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (c / 4)))).toString(16)
   );
}

export function isPointInsideBox(point, box, rotationAngle) {
   const { topLeft, topRight, bottomRight, bottomLeft } = box;

   // Translate the point to align with the box's axes based on the given rotation angle
   const translatedPoint = {
      x: (point.x - topLeft.x) * Math.cos(-rotationAngle) - (point.y - topLeft.y) * Math.sin(-rotationAngle),
      y: (point.x - topLeft.x) * Math.sin(-rotationAngle) + (point.y - topLeft.y) * Math.cos(-rotationAngle),
   };

   // Check if the translated point is inside the aligned box
   const isInsideX = translatedPoint.x > 0 && translatedPoint.x < Math.hypot(topRight.x - topLeft.x, topRight.y - topLeft.y);
   const isInsideY = translatedPoint.y > 0 && translatedPoint.y < Math.hypot(bottomLeft.x - topLeft.x, bottomLeft.y - topLeft.y);

   return isInsideX && isInsideY;
}

export function rotatePointAroundPivot(angle, pivot, point) {
   var cos = Math.cos(angle);
   var sin = Math.sin(angle);
   var dx = point.x - pivot.x;
   var dy = point.y - pivot.y;
   var x = dx * cos - dy * sin + pivot.x;
   var y = dy * cos + dx * sin + pivot.y;
   return { x: x, y: y };
}

export const TOOLS = {
   /**
    * Finds the nearest point on a line segment to a given point
    * @param {Point|{x: number, y: number}} start - Start point of the line segment
    * @param {Point|{x: number, y: number}} end - End point of the line segment
    * @param {Point|{x: number, y: number}} point - Point to find nearest position to
    * @returns {Point} The nearest point on the line segment
    */
   nearestPointOnLine(start, end, point) {
      const lineDeltaX = end.x - start.x;
      const lineDeltaY = end.y - start.y;
      
      // Handle degenerate case where start and end are the same point
      if (lineDeltaX === 0 && lineDeltaY === 0) {
         return new Point(start.x, start.y);
      }

      // Find the closest point on the line to the point
      // We can avoid the sqrt in lineLength by using squared values
      const lengthSquared = lineDeltaX * lineDeltaX + lineDeltaY * lineDeltaY;
      let u = ((point.x - start.x) * lineDeltaX + (point.y - start.y) * lineDeltaY) / lengthSquared;

      // Clamp u to the range [0, 1]
      u = Math.max(0, Math.min(1, u));

      // Calculate the closest point on the line segment
      return new Point(
         start.x + u * lineDeltaX,
         start.y + u * lineDeltaY
      );
   },
};

export const geometry = {
   PRECISION: 3,
   distance: function (p1, p2) {
      return NumberUtils.round(Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2)), this.PRECISION);
   },
   length: function (v) {
      return NumberUtils.round(Math.sqrt(Math.pow(v.x, 2) + Math.pow(v.y, 2)), this.PRECISION);
   },
   slope: function (p1, p2) {
      return (p1.y - p2.y) / (p1.x - p2.x);
   },
   
   getIntersectionPoint: function (line1, line2) {
      const denominator =
         (line2.end.y - line2.start.y) * (line1.end.x - line1.start.x) -
         (line2.end.x - line2.start.x) * (line1.end.y - line1.start.y);

      // If the denominator is 0, the lines are parallel and don't intersect
      if (denominator === 0) {
         return null;
      }

      const ua =
         ((line2.end.x - line2.start.x) * (line1.start.y - line2.start.y) -
            (line2.end.y - line2.start.y) * (line1.start.x - line2.start.x)) /
         denominator;
      const ub =
         ((line1.end.x - line1.start.x) * (line1.start.y - line2.start.y) -
            (line1.end.y - line1.start.y) * (line1.start.x - line2.start.x)) /
         denominator;

      // If ua or ub is less than 0 or greater than 1, the intersection point is outside of the segments
      if (ua < 0 || ua > 1 || ub < 0 || ub > 1) {
         return null;
      }

      // Calculate the intersection point
      const intersectionX = line1.start.x + ua * (line1.end.x - line1.start.x);
      const intersectionY = line1.start.y + ua * (line1.end.y - line1.start.y);

      return new Point(intersectionX, intersectionY);
   },

   //returns the intersection point of 2 lines, regardless of their length
   getIntersectionPointX: function (p1, d1, p2, d2) {
      // Solve for t and s using the equations:
      const denominator = d1.x * d2.y - d1.y * d2.x;
      if (denominator === 0) return null; // Vectors are parallel or collinear
      // Compute parameters t and s
      const t = ((p2.x - p1.x) * d2.y - (p2.y - p1.y) * d2.x) / denominator;
      // Compute the intersection point using either vector
      return new Point(p1.x + t * d1.x, p1.y + t * d1.y);
   },

   /**
    * Checks if a target point lies on the line segment defined by two points.
    * @param {Object} point1 - The first point of the line segment.
    * @param {number} point1.x - The x-coordinate of the first point.
    * @param {number} point1.y - The y-coordinate of the first point.
    * @param {Object} point2 - The second point of the line segment.
    * @param {number} point2.x - The x-coordinate of the second point.
    * @param {number} point2.y - The y-coordinate of the second point.
    * @param {Object} targetPoint - The point to check.
    * @param {number} targetPoint.x - The x-coordinate of the target point.
    * @param {number} targetPoint.y - The y-coordinate of the target point.
    * @returns {boolean} True if the target point lies on the line segment, false otherwise.
    */
   pointOnLine: function (point1, point2, targetPoint) {
      // Extract coordinates from the objects
      let x1 = point1.x,
         y1 = point1.y;
      let x2 = point2.x,
         y2 = point2.y;
      let px = targetPoint.x,
         py = targetPoint.y;

      //if(x1==px && y1==py || x2==px && y2 == py) return false;

      // Calculate parameters for the parametric equations
      let tX = px == x1 && x1 == x2 ? 0 : (px - x1) / (x2 - x1);
      let tY = py == y1 && y1 == y2 ? 0 : (py - y1) / (y2 - y1);

      // Check if the point is on the line (within the segment boundaries)
      if (tX >= 0 && tX <= 1 && tY >= 0 && tY <= 1) {
         return true; // Point lies on the line segment
      } else {
         return false; // Point is outside the line segment
      }
   },
   areSegmentsOverlapping2D: function (p1, p2, p3, p4) {

      if (p1.x === p3.x && p1.y === p3.y && p2.x === p4.x && p2.y === p4.y) return true;

      if ((p2.x === p3.x && p2.y === p3.y) || (p1.x === p4.x && p1.y === p4.y)) return false;

      // Check if the segments are parallel
      const slopeCheck = (p2.y - p1.y) * (p4.x - p3.x) === (p4.y - p3.y) * (p2.x - p1.x);

      // Check if they lie on the same line
      const colinearCheck = (p3.y - p1.y) * (p2.x - p1.x) === (p3.x - p1.x) * (p2.y - p1.y);

      if (!slopeCheck || !colinearCheck) {
         return false; // Not parallel or not colinear
      }

      // Check for overlap in projections (dominant axis)
      const overlapX = Math.max(p1.x, p2.x) >= Math.min(p3.x, p4.x) && Math.max(p3.x, p4.x) >= Math.min(p1.x, p2.x);
      const overlapY = Math.max(p1.y, p2.y) >= Math.min(p3.y, p4.y) && Math.max(p3.y, p4.y) >= Math.min(p1.y, p2.y);

      return overlapX && overlapY;
   },
   //returns true if 2 line, described by 4 points intersect, each other
   doLineSegmentsIntersect: function (p1, q1, p2, q2) {
      const orientation = (p, q, r) => {
         const val = (q.y - p.y) * (r.x - q.x) - (q.x - p.x) * (r.y - q.y);
         return val === 0 ? 0 : val > 0 ? 1 : 2;
      };

      const onSegment = (p, q, r) => {
         return q.x <= Math.max(p.x, r.x) && q.x >= Math.min(p.x, r.x) && q.y <= Math.max(p.y, r.y) && q.y >= Math.min(p.y, r.y);
      };

      const o1 = orientation(p1, q1, p2);
      const o2 = orientation(p1, q1, q2);
      const o3 = orientation(p2, q2, p1);
      const o4 = orientation(p2, q2, q1);

      if (o1 !== o2 && o3 !== o4) {
         return true; // Segments intersect
      }

      if (o1 === 0 && onSegment(p1, p2, q1)) return true;
      if (o2 === 0 && onSegment(p1, q2, q1)) return true;
      if (o3 === 0 && onSegment(p2, p1, q2)) return true;
      if (o4 === 0 && onSegment(p2, q1, q2)) return true;

      return false; // No intersection
   },
   pointOnArc: function (radius, rad, centerpoint) {
      const v = {
         x: radius * Math.cos(rad) + centerpoint?.x,
         y: radius * Math.sin(rad) + centerpoint?.y,
      };

      return v;
   },

   //returns the distance between a point and a line
   pointToSegmentDistance: function(point, start, end) {
      const dx = end.x - start.x;
      const dy = end.y - start.y;
      
      // Handle degenerate case where start and end are the same point
      if (dx === 0 && dy === 0) {
          return Math.hypot(point.x - start.x, point.y - start.y);
      }
      
      // Compute the projection of the point onto the line defined by start and end
      const t = ((point.x - start.x) * dx + (point.y - start.y) * dy) / (dx * dx + dy * dy);
      
      // Clamp t to the range [0,1] to restrict to the segment
      const tClamped = Math.max(0, Math.min(1, t));
      
      // Find the closest point on the segment
      const closestX = start.x + tClamped * dx;
      const closestY = start.y + tClamped * dy;
      
      // Return the Euclidean distance
      return Math.hypot(point.x - closestX, point.y - closestY);
  },

   
   //calculates a point which is perpendicular to the given vector
   perpendicular: function (v) {
      return new V2({
         y: v.x,
         x: -v.y,
      });
   },

   //returns the unit vector of the given vector
   unit: function (v, l) {
      const length = l ? l : this.length(v);
      return this.multiply(v, 1 / length);
   },

   multiply: function (v, s) {
      return {
         x: NumberUtils.round(v.x * s, this.PRECISION),
         y: NumberUtils.round(v.y * s, this.PRECISION),
      };
   },

   add: function (v1, v2) {
      return new Point(v1.x + v2.x, v1.y + v2.y);
   },

   sub: function (v1, v2) {
      return new Point(v1.x - v2.x, v1.y - v2.y);
   },

   calculateAngle: function (reference, point1, point2) {
      // Calculate vectors
      const v1 = { x: point1.x - reference.x, y: point1.y - reference.y };
      const v2 = { x: point2.x - reference.x, y: point2.y - reference.y };

      // Dot product
      const dotProduct = v1.x * v2.x + v1.y * v2.y;

      // Magnitudes
      const magnitudeV1 = Math.sqrt(v1.x ** 2 + v1.y ** 2);
      const magnitudeV2 = Math.sqrt(v2.x ** 2 + v2.y ** 2);

      // Cosine of the angle
      const cosTheta = dotProduct / (magnitudeV1 * magnitudeV2);

      // Angle in radians
      const theta = Math.acos(cosTheta);

      // Convert to degrees (optional)
      return theta * (180 / Math.PI); // Return the angle in degrees
   },

   /**
    * Returns the midpoint between two points
    * @param {Object} p1 - First point
    * @param {number} p1.x - X coordinate of first point
    * @param {number} p1.y - Y coordinate of first point
    * @param {Object} p2 - Second point
    * @param {number} p2.x - X coordinate of second point
    * @param {number} p2.y - Y coordinate of second point
    * @returns {Point} The midpoint between p1 and p2
    */
   midpoint: function(p1, p2) {
      return new Point(
         NumberUtils.round((p1.x + p2.x) / 2, this.PRECISION),
         NumberUtils.round((p1.y + p2.y) / 2, this.PRECISION)
      );
   },

   /**
    * Returns the angle bisector of two normalized vectors
    * @param {Object} v1 - First normalized vector
    * @param {number} v1.x - X component of first vector
    * @param {number} v1.y - Y component of first vector
    * @param {Object} v2 - Second normalized vector
    * @param {number} v2.x - X component of second vector
    * @param {number} v2.y - Y component of second vector
    * @returns {Point} The angle bisector vector (normalized)
    */
   angleBisector: function(v1, v2) {
      // Add the two vectors to get the bisector
      const bisector = this.add(v1, v2);    
      
      
      // Normalize the bisector using the existing normalize function
      return this.unit(bisector);
   },

   /**
    * Returns a point along the angle bisector of two unit vectors at a given distance
    * @param {Object} v1 - First normalized vector
    * @param {number} v1.x - X component of first vector
    * @param {number} v1.y - Y component of first vector
    * @param {Object} v2 - Second normalized vector
    * @param {number} v2.x - X component of second vector
    * @param {number} v2.y - Y component of second vector
    * @param {number} distance - Distance to move along the bisector
    * @returns {Point} The point at the specified distance along the angle bisector
    */
   pointAlongBisector: function(v1, v2, distance) {
      // Get the angle bisector vector
      const bisector = this.angleBisector(v1, v2);
      
      // Scale the bisector by the desired distance
      const scaledBisector = this.multiply(bisector, distance);
      
      return scaledBisector;
   },

   /**
    * Inverts a given vector by negating both x and y components
    * @param {Object} v - Vector to invert
    * @param {number} v.x - X component of vector
    * @param {number} v.y - Y component of vector
    * @returns {Point} The inverted vector
    */
   invert: function(v) {
      return new Point(-v.x, -v.y);
   },
   dotProduct: function(v1, v2) {
      return v1.x * v2.x + v1.y * v2.y;
   },
};

export class V2 {
   static fromV2(v) {
      return new V2(v);
   }

   #_length = null;

   get length() {
      if (this.#_length == null) this.#_length = geometry.length(this);
      return this.#_length;
   }

   get x() {
      return this._p.x;
   }

   get y() {
      return this._p.y;
   }

   constructor(p) {
      this._p = p;
   }

   add(v) {
      return new V2(geometry.add(this, v));
   }

   sub(v) {
      return new V2(geometry.sub(this, v));
   }

   multiply(s) {
      return new V2(geometry.multiply(this, s));
   }

   unit() {
      return new V2(geometry.unit(this));
   }
   invert() {
      return new V2(geometry.invert(this));
   }
   dot(v) {
      return geometry.dotProduct(this, v);
   }
}

export class Point {
   static fromPoint(p) {
      return new Point(p.x, p.y);
   }

   constructor(x, y) {
      this.x = x;
      this.y = y;
   }

   add(v) {
      return new Point(this.x + v.x, this.y + v.y);
   }

   sub(v) {
      return new Point(this.x - v.x, this.y - v.y);
   }

   equals(p) {
      return p.x == this.x && p.y == this.y;
   }
}

export function testPerformance(f, txt) {
   const start = performance.now();
   f();
   const end = performance.now();
   console.info(`${txt}: ${(end - start).toFixed(3)}ms`);
}




