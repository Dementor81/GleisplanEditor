"use strict";

import { NumberUtils } from './utils.ts';

// ============================================================================
// Type Definitions
// ============================================================================

/** A point or vector with x and y coordinates */
export interface IPoint {
   x: number;
   y: number;
}

/** A line segment with start and end points */
export interface ILine {
   start: IPoint;
   end: IPoint;
}

/** A box with four corner points */
export interface IBox {
   topLeft: IPoint;
   topRight: IPoint;
   bottomRight: IPoint;
   bottomLeft: IPoint;
}

// ============================================================================
// Utility Functions
// ============================================================================

export function findFieldNameForObject(container: Record<string, any>, ref: any): string | null {
   for (let key of Object.keys(container)) {
      if (container[key] === ref) {
         return key;
      }
   }
   return null;
}

export function swap<T>(current: T, value1: T, value2: T): T {
   return current === value1 ? value2 : value1;
}

export function deepEqual(x: any, y: any): boolean {
   const ok = Object.keys,
      tx = typeof x,
      ty = typeof y;
   return x && y && tx === "object" && tx === ty
      ? ok(x).length === ok(y).length && ok(x).every((key) => deepEqual(x[key], y[key]))
      : x === y;
}

export function clone<T>(obj: T): T {
   // Handle the 3 simple types, and null or undefined
   if (null == obj || "object" != typeof obj) return obj;

   // Handle Date
   if (obj instanceof Date) {
      const copy = new Date();
      copy.setTime(obj.getTime());
      return copy as any;
   }

   // Handle Array
   if (obj instanceof Array) {
      const copy: any[] = [];
      for (let i = 0, len = obj.length; i < len; i++) {
         copy[i] = clone(obj[i]);
      }
      return copy as any;
   }

   // Handle Object
   if (obj instanceof Object) {
      const copy: Record<string, any> = {};
      for (const attr in obj) {
         if (obj.hasOwnProperty(attr)) copy[attr] = clone((obj as any)[attr]);
      }
      return copy as any;
   }

   throw new Error("Unable to copy obj! Its type isn't supported.");
}

export function uuidv4(): string {
   return (([1e7] as any) + -1e3 + -4e3 + -8e3 + -1e11).replace(/[018]/g, (c: any) =>
      (c ^ (crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (c / 4)))).toString(16)
   );
}

export function getCDataValue(element: Element): string | null {
   const cdataNode = Array.from(element.childNodes)
     .find(node => node.nodeType === Node.CDATA_SECTION_NODE);
   return cdataNode?.nodeValue ?? null;
 }

export function isPointInsideBox(point: IPoint, box: IBox, rotationAngle: number): boolean {
   const { topLeft, topRight, bottomLeft } = box;

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

export function rotatePointAroundPivot(angle: number, pivot: IPoint, point: IPoint): IPoint {
   const cos = Math.cos(angle);
   const sin = Math.sin(angle);
   const dx = point.x - pivot.x;
   const dy = point.y - pivot.y;
   const x = dx * cos - dy * sin + pivot.x;
   const y = dy * cos + dx * sin + pivot.y;
   return { x, y };
}

// ============================================================================
// TOOLS Object
// ============================================================================

export const TOOLS = {
   /**
    * Finds the nearest point on a line segment to a given point
    */
   nearestPointOnLine(start: IPoint, end: IPoint, point: IPoint): Point {
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

// ============================================================================
// Geometry Object
// ============================================================================

export const geometry = {
   PRECISION: 3,
   
   distance(p1: IPoint, p2: IPoint): number {
      return NumberUtils.round(Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2)), this.PRECISION);
   },
   
   length(v: IPoint): number {
      return NumberUtils.round(Math.sqrt(Math.pow(v.x, 2) + Math.pow(v.y, 2)), this.PRECISION);
   },
   
   slope(p1: IPoint, p2: IPoint): number {
      return (p1.y - p2.y) / (p1.x - p2.x);
   },
   
   getIntersectionPoint(line1: ILine, line2: ILine): Point | null {
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

   /**
    * Returns the intersection point of 2 lines, regardless of their length
    */
   getIntersectionPointX(p1: IPoint, d1: IPoint, p2: IPoint, d2: IPoint): Point | null {
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
    */
   pointOnLine(point1: IPoint, point2: IPoint, targetPoint: IPoint): boolean {
      // Extract coordinates from the objects
      const x1 = point1.x, y1 = point1.y;
      const x2 = point2.x, y2 = point2.y;
      const px = targetPoint.x, py = targetPoint.y;

      // Calculate parameters for the parametric equations
      const tX = px == x1 && x1 == x2 ? 0 : (px - x1) / (x2 - x1);
      const tY = py == y1 && y1 == y2 ? 0 : (py - y1) / (y2 - y1);

      // Check if the point is on the line (within the segment boundaries)
      return tX >= 0 && tX <= 1 && tY >= 0 && tY <= 1;
   },
   
   areSegmentsOverlapping2D(p1: IPoint, p2: IPoint, p3: IPoint, p4: IPoint): boolean {
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
   
   /**
    * Returns true if 2 line segments intersect each other
    */
   doLineSegmentsIntersect(p1: IPoint, q1: IPoint, p2: IPoint, q2: IPoint): boolean {
      const orientation = (p: IPoint, q: IPoint, r: IPoint): number => {
         const val = (q.y - p.y) * (r.x - q.x) - (q.x - p.x) * (r.y - q.y);
         return val === 0 ? 0 : val > 0 ? 1 : 2;
      };

      const onSegment = (p: IPoint, q: IPoint, r: IPoint): boolean => {
         return q.x <= Math.max(p.x, r.x) && q.x >= Math.min(p.x, r.x) && 
                q.y <= Math.max(p.y, r.y) && q.y >= Math.min(p.y, r.y);
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
   
   pointOnArc(radius: number, rad: number, centerpoint?: IPoint): IPoint {
      return {
         x: radius * Math.cos(rad) + (centerpoint?.x ?? 0),
         y: radius * Math.sin(rad) + (centerpoint?.y ?? 0),
      };
   },

   /**
    * Returns the distance between a point and a line segment
    */
   pointToSegmentDistance(point: IPoint, start: IPoint, end: IPoint): number {
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
   
   /**
    * Calculates a point which is perpendicular to the given vector
    */
   perpendicular(v: IPoint): V2 {
      return new V2({
         y: v.x,
         x: -v.y,
      });
   },

   /**
    * Returns the unit vector of the given vector
    */
   unit(v: IPoint, l?: number): IPoint {
      const length = l ?? this.length(v);
      return this.multiply(v, 1 / length);
   },

   multiply(v: IPoint, s: number): IPoint {
      return {
         x: NumberUtils.round(v.x * s, this.PRECISION),
         y: NumberUtils.round(v.y * s, this.PRECISION),
      };
   },

   add(v1: IPoint, v2: IPoint): Point {
      return new Point(v1.x + v2.x, v1.y + v2.y);
   },

   sub(v1: IPoint, v2: IPoint): Point {
      return new Point(v1.x - v2.x, v1.y - v2.y);
   },

   calculateAngle(reference: IPoint, point1: IPoint, point2: IPoint): number {
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

      // Convert to degrees
      return theta * (180 / Math.PI);
   },

   /**
    * Returns the midpoint between two points
    */
   midpoint(p1: IPoint, p2: IPoint): Point {
      return new Point(
         NumberUtils.round((p1.x + p2.x) / 2, this.PRECISION),
         NumberUtils.round((p1.y + p2.y) / 2, this.PRECISION)
      );
   },

   /**
    * Returns the angle bisector of two normalized vectors
    */
   angleBisector(v1: IPoint, v2: IPoint): Point {
      // Add the two vectors to get the bisector
      const bisector = this.add(v1, v2);
      // Normalize the bisector
      return this.unit(bisector) as Point;
   },

   /**
    * Returns a point along the angle bisector of two unit vectors at a given distance
    */
   pointAlongBisector(v1: IPoint, v2: IPoint, distance: number): IPoint {
      // Get the angle bisector vector
      const bisector = this.angleBisector(v1, v2);
      
      // Scale the bisector by the desired distance
      return this.multiply(bisector, distance);
   },

   /**
    * Inverts a given vector by negating both x and y components
    */
   invert(v: IPoint): Point {
      return new Point(-v.x, -v.y);
   },
   
   dotProduct(v1: IPoint, v2: IPoint): number {
      return v1.x * v2.x + v1.y * v2.y;
   },

      /**
    * Get the Y coordinate of a bezier curve at a given X coordinate.
    * @param x - The X coordinate to get the Y coordinate for.
    * @param p0 - The start point of the curve.
    * @param p1 - The first control point of the curve.
    * @param p2 - The end point of the curve.
    * @returns The Y coordinate of the curve at the given X coordinate. returns null if the X coordinate is out of the curve.
    */
   getBezierYAtX(x: number, p0: Point, p1: Point, p2: Point): number | null {
         const A = p0.x - 2 * p1.x + p2.x;
         const B = 2 * (p1.x - p0.x);
         const C = p0.x - x;
   
         if (Math.abs(A) < 0.0001) {
            const t = -C / B;
            if (t >= 0 && t <= 1) return (1 - t) * p0.y + t * p2.y;
            return null;
         }
   
         const discriminant = B * B - 4 * A * C;
         if (discriminant < 0) return null; // No intersection
   
         const sqrtD = Math.sqrt(discriminant);
         const t1 = (-B + sqrtD) / (2 * A);
         const t2 = (-B - sqrtD) / (2 * A);
   
         const t = (t1 >= 0 && t1 <= 1) ? t1 : ((t2 >= 0 && t2 <= 1) ? t2 : null);
         if (t === null) return null; // Track has ended or hasn't started yet
   
         return (1 - t) * (1 - t) * p0.y + 2 * (1 - t) * t * p1.y + t * t * p2.y;
      },
   
      /**
       * Get the Y coordinate of a linear line at a given X position.
       * @param x - The X coordinate to get the Y coordinate for.
       * @param p0 - The start point of the line.
       * @param p1 - The end point of the line.
       * @returns The Y coordinate of the line at the given X coordinate. returns null if the X coordinate is out of the line.
       */
      getLinearYAtX(x: number, p0: Point, p1: Point): number | null {
   
         const minX = Math.min(p0.x, p1.x);
         const maxX = Math.max(p0.x, p1.x);
   
         if (x < minX || x > maxX) return null;
         if (Math.abs(p1.x - p0.x) < 0.0001) return null;
         const t = (x - p0.x) / (p1.x - p0.x);
         return p0.y + t * (p1.y - p0.y);
      },

      /**
       * Get a point on a cubic bezier curve at a given t value.
       * @param t - The t value to get the point for, between 0 and 1.
       * @param p0 - The start point of the curve.
       * @param cp - The control point of the curve.
       * @param p1 - The end point of the curve.
       * @returns The point on the curve at the given t value.
       */
      getPointOnCurve(t: number, p0: any, cp: any, p1: any) {
         const oneMinusT = 1 - t;
         const tSquared = t * t;
         const oneMinusTSquared = oneMinusT * oneMinusT;
         const twoTimesT = 2 * oneMinusT * t;
   
         return new Point(
            oneMinusTSquared * p0.x + twoTimesT * cp.x + tSquared * p1.x,
            oneMinusTSquared * p0.y + twoTimesT * cp.y + tSquared * p1.y
         );
      },
   
      /**
       * Get the degree of the tangent of a cubic bezier curve at a given t value.
       * @param t - The t value to get the tangent for, between 0 and 1.
       * @param p0 - The start point of the curve.
       * @param cp - The control point of the curve.
       * @param p1 - The end point of the curve.
       * @returns The degree of the tangent at the given t value.
       */
      getDegreeOfTangentOnCurve(t: number, p0: any, cp: any, p1: any) {
         const mt = 1 - t;
         const dx = 2 * (mt * (cp.x - p0.x) + t * (p1.x - cp.x));
         const dy = 2 * (mt * (cp.y - p0.y) + t * (p1.y - cp.y));
         return Math.atan2(dy, dx) * (180 / Math.PI);
      }
};

// ============================================================================
// Classes
// ============================================================================

export class V2 implements IPoint {
   static fromV2(v: IPoint): V2 {
      return new V2(v);
   }

   #_length: number | null = null;
   _p: IPoint;

   get length(): number {
      if (this.#_length == null) this.#_length = geometry.length(this);
      return this.#_length;
   }

   get x(): number {
      return this._p.x;
   }

   get y(): number {
      return this._p.y;
   }

   constructor(p: IPoint) {
      this._p = p;
   }

   add(v: IPoint): V2 {
      return new V2(geometry.add(this, v));
   }

   sub(v: IPoint): V2 {
      return new V2(geometry.sub(this, v));
   }

   multiply(s: number): V2 {
      return new V2(geometry.multiply(this, s));
   }

   unit(): V2 {
      return new V2(geometry.unit(this));
   }
   
   invert(): V2 {
      return new V2(geometry.invert(this));
   }
   
   dot(v: IPoint): number {
      return geometry.dotProduct(this, v);
   }
}

export class Point implements IPoint {
   x: number;
   y: number;

   static fromPoint(p: IPoint): Point {
      return new Point(p.x, p.y);
   }

   constructor(x: number, y: number) {
      this.x = x;
      this.y = y;
   }

   add(v: IPoint): Point {
      return new Point(this.x + v.x, this.y + v.y);
   }

   sub(v: IPoint): Point {
      return new Point(this.x - v.x, this.y - v.y);
   }

   equals(p: IPoint): boolean {
      return p.x == this.x && p.y == this.y;
   }
}

// ============================================================================
// Performance Testing
// ============================================================================

export function testPerformance(f: () => void, txt: string): void {
   const start = performance.now();
   f();
   const end = performance.now();
   console.info(`${txt}: ${(end - start).toFixed(3)}ms`);
}

// Legacy export for backward compatibility - remove 'type' function if not used
export function type(obj: any): string {
   return Object.prototype.toString.call(obj).slice(8, -1);
}

