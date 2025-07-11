"use strict";

const π = Math.PI;

Number.prototype.between = function (a, b) {
   var min = Math.min.apply(Math, [a, b]),
      max = Math.max.apply(Math, [a, b]);
   return this >= min && this <= max;
};

Number.prototype.outoff = function (a, b) {
   var min = Math.min.apply(Math, [a, b]),
      max = Math.max.apply(Math, [a, b]);
   return this < min || this > max;
};

Math.minmax = function (min, value, max) {
   return Math.max(min, Math.min(max, value));
};

Number.prototype.is = function (a) {
   return Array.from(arguments).includes(this);
};

Number.prototype.round = function (places) {
   const x = Math.pow(10, places);
   return Math.round(this * x) / x;
};

Number.prototype.closeToBy = function (y, z) {
   const mod = this % y;
   return Math.min(mod, y - mod) < z;
};

Array.prototype.remove = function (item) {
   const index = this.indexOf(item);
   if (index > -1) {
      this.splice(index, 1);
   }
};

Array.prototype.justNull = function () {
   if (this.every((i) => i == null)) return null;
   else return this;
};

Array.prototype.last = function () {
   if (this.length > 0) {
      return this[this.length - 1];
   } else return null;
};

Array.prototype.first = function () {
   if (this.length > 0) {
      return this[0];
   } else return null;
};

//removes all null items from the array
Array.prototype.clean = function () {
   return this.filter((n) => n);
};

//returns a random item from the array
Array.prototype.random = function () {
   if (this.length == 0) return;
   return this[Math.randomInt(this.length - 1)];
};

Array.prototype.countNonUnique = function() {
   const counts = {};
   let nonUniqueCount = 0;
   for (const item of this) {
      if (counts[item] === 1) nonUniqueCount++; // Only increment on second occurrence
      counts[item] = (counts[item] || 0) + 1;
   }
   return nonUniqueCount;
}

//will only add the element if the array does not already contain it.
Array.prototype.pushUnique = function (newElement) {
   if (this.indexOf(newElement) === -1) {
      this.push(newElement);
      return true;
   }
   return false;
};

Array.prototype.groupBy = function (propertyPath) {
   // `data` is an array of objects, `key` is the key (or property accessor) to group by
   // reduce runs this anonymous function on each element of `data` (the `item` parameter,
   // returning the `storage` parameter at the end

   return Object.values(
      this.reduce(function (storage, item) {
         let property = propertyPath.split(".").reduce((acc, key) => acc[key], item);
         // get the first instance of the key by which we're grouping
         let group = property;

         // set `storage` for this instance of group to the outer scope (if not empty) or initialize it
         storage[group] = storage[group] || [];

         // add this item to its group within `storage`
         storage[group].push(item);

         // return the updated storage to the reduce function, which will then loop through the next
         return storage;
      }, {})
   ).sort((a, b) => b.length - a.length); // {} is the initial value of the storage
};

function nll(o) {
   return o == null;
}

function findFieldNameForObject(container, ref) {
   for (let key of Object.keys(container)) {
      if (container[key] === ref) {
         return key;
      }
   }
   return null;
}

function type(value) {
   if (value === null) {
      return "null";
   }
   const baseType = typeof value;
   // Primitive types
   if (!["object", "function"].includes(baseType)) {
      return baseType;
   }

   // Symbol.toStringTag often specifies the "display name" of the
   // object's class. It's used in Object.prototype.toString().
   const tag = value[Symbol.toStringTag];
   if (typeof tag === "string") {
      return tag;
   }

   // If it's a function whose source code starts with the "class" keyword
   if (baseType === "function" && Function.prototype.toString.call(value).startsWith("class")) {
      return "class";
   }

   // The name of the constructor; for example `Array`, `GeneratorFunction`,
   // `Number`, `String`, `Boolean` or `MyCustomClass`
   const className = value.constructor.name;
   if (typeof className === "string" && className !== "") {
      return className;
   }

   // At this point there's no robust way to get the type of value,
   // so we use the base implementation.
   return baseType;
}

function swap(current, value1, value2) {
   return current === value1 ? value2 : value1;
}

//returns a copy where the given item is missing
Array.prototype.without = function (item) {
   return this.filter((i) => i != item);
};

Math.randomInt = function (max) {
   return Math.floor(Math.random() * (max + 1));
};

function deepEqual(x, y) {
   const ok = Object.keys,
      tx = typeof x,
      ty = typeof y;
   return x && y && tx === "object" && tx === ty
      ? ok(x).length === ok(y).length && ok(x).every((key) => deepEqual(x[key], y[key]))
      : x === y;
}

function clone(obj) {
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

function uuidv4() {
   return ([1e7] + -1e3 + -4e3 + -8e3 + -1e11).replace(/[018]/g, (c) =>
      (c ^ (crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (c / 4)))).toString(16)
   );
}

function isPointInsideBox(point, box, rotationAngle) {
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
const TOOLS = {
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

function deg2rad(deg) {
   return deg * (Math.PI / 180);
}

const ui = {
   create_toggleButton: function (text) {
      return $("<button>", {
         type: "button",
         id: "btn_" + text.replace(" ", "_"),
         class: "btn btn-primary btn-sm",
      }).html(text);
   },
   create_Input: function (text, stellung, signal) {
      const id = uuidv4();
      return $("<div>", { class: "form-floating" }).append([
         $("<input>", {
            type: "number",
            id: id,
            class: "form-control  form-control-sm",
            value: signal.get(stellung),
         })
            .attr("data_signal", stellung)
            .on("input", (e) => {
               signal.set_stellung(stellung, e.target.value);
            }),
         $("<label>", { for: id, text: text }),
      ]);
   },
   create_buttonGroup: function (items) {
      return $("<div>", { class: "btn-group", role: "group" }).append(items);
   },
   showPopup: function (r, title, content, parent) {
      let $dummy = $("#dummy");
      let rect = parent[0].getBoundingClientRect();
      if ($dummy.length == 0) {
         $dummy = $("<div>", { id: "dummy" });
         $(document.body).append($dummy);
      }
      $dummy.css({ position: "absolute", left: r.x + rect.x, top: r.y + rect.y, width: r.width, height: r.height });
      let popup = bootstrap.Popover.getOrCreateInstance($dummy);
      if (popup) {
         $(document).off("mousedown");
         popup.dispose();
      }

      popup = new bootstrap.Popover($dummy, {
         html: true,
         trigger: "manual",
         title: title,
         placement: "bottom",
         sanitize: false,
         content: content,
      });
      $dummy[0].addEventListener(
         "hidden.bs.popover",
         (e) => {
            $(document).off("mousedown");
            let p = bootstrap.Popover.getOrCreateInstance(e.target);
            if (p) p.dispose();
            $(e.target).remove();
         },
         { once: true }
      );
      $dummy[0].addEventListener(
         "shown.bs.popover",
         (e) => {
            $(document).on("mousedown", (event) => {
               let $target = $(event.target);

               if ($target.closest("div.popover").length == 0) {
                  let p = bootstrap.Popover.getOrCreateInstance(e.target);
                  if (p) p.hide();
               }
            });
         },
         { once: true }
      );
      popup.show();
      return popup;
   },

   /* showContextMenu: function (point, parent, items, signal) {
      const createDropDownItems = function (items, dd) {
         return items.map((item) => {
            if (item.text) {
               const li = $("<li>");
               const a = $("<a>", { class: "dropdown-item", href: "#" }).text(item.text);
               if (item.childs) {
                  li.addClass("dropend");
                  a.addClass("dropdown-toggle submenu");
                  a.attr("type", "button");
                  a.attr("data-bs-toggle", "dropdown");
                  a.append($("<ul>", { class: "dropdown-menu dropdown-menu-end" }).append(createDropDownItems(item.childs, dd)));
               } else {
                  a.attr("data-signal-option", item.option);
                  a.toggleClass("active", signal.matchFeature(item.option));
                  a.click(() => {
                     signal.setFeature(item.option, !a.hasClass("active"));
                     dd.hide();
                     renderer.reDrawEverything();
                     stage.update();
                     STORAGE.save();
                  });
               }
               li.append(a);
               return li;
            } else {
               const id = uuidv4();
               return ui.div("dropdown-item").append(
                  $("<div>", { class: "form-floating" }).append([
                     $("<input>", {
                        type: "text",
                        id: id,
                        class: "form-control  form-control-sm",
                        value: signal.getFeature("bez"),
                     }).on("input", (e) => {
                        signal.setFeature("bez", e.target.value);
                        renderer.reDrawEverything();
                        STORAGE.save();
                     }),
                     $("<label>", { for: id, text: item.input }),
                  ])
               );
            }
         });
      }; 

      const a = $("<a>", { class: "visually-hidden" }).attr("data-bs-toggle", "dropdown").attr("data-bs-auto-close", "false");
      const ul = $("<ul>", { class: "dropdown-menu" });
      const div = $("<div>", { id: "generated_menu", class: "dropdown" }).append([a, ul]);
      $(document.body).append(div);
      const dropdownList = bootstrap.Dropdown.getOrCreateInstance(a);
      ul.append(createDropDownItems(items, dropdownList));
      setTimeout(() => (dropdownList._config.autoClose = "outside"), 2);
      dropdownList._parent.addEventListener("hidden.bs.dropdown", (e) => {
         const t = $(e.target);
         if (!t.hasClass("submenu")) $(e.target).parent().remove();
      });
      let $dummy = $(dropdownList._parent);
      let rect = parent[0].getBoundingClientRect();

      $dummy.css({ position: "absolute", left: point.x + rect.x, top: point.y + rect.y });
      dropdownList.show();
   },*/
   div: function (c, i) {
      return $("<div>", { class: c }).append(i);
   },

   showModalDialog: function (content, ok_function) {
      // Create modal div
      let modal_div = $("<div/>", {
         id: "myModal",
         class: "modal fade",
         role: "dialog",
      }).append(
         ui.div("modal-dialog  modal-xl modal-dialog-centered").append(
            ui.div("modal-content").append([
               ui.div("modal-header").append([
                  $("<h4/>", {
                     class: "modal-title",
                     text: "Als Bild speichern",
                  }),
                  $("<button/>", {
                     type: "button",
                     class: "btn-close",
                     "data-bs-dismiss": "modal",
                  }),
               ]),
               ui.div("modal-body").append(content),
               ui.div("modal-footer").append(
                  $("<button/>", {
                     type: "button",
                     class: "btn btn-default",
                     "data-dismiss": "modal",
                     text: "Herunterladen",
                     click: ok_function,
                  })
               ),
            ])
         )
      );
      modal_div.appendTo("body");

      let modal = new bootstrap.Modal(modal_div[0]);
      modal.show();
      return modal;
   },
};

const geometry = {
   PRECISION: 3,
   distance: function (p1, p2) {
      return Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2)).round(this.PRECISION);
   },
   length: function (v) {
      return Math.sqrt(Math.pow(v.x, 2) + Math.pow(v.y, 2)).round(this.PRECISION);
   },
   slope: function (p1, p2) {
      return (p1.y - p2.y) / (p1.x - p2.x);
   },

   //checks if point c is between a and b
   within: function (pA, pB, pC, exclude) {
      if (exclude && (deepEqual(pA, pC) || deepEqual(pB, pC))) return false;
      if (pC.x.outoff(pA.x, pB.x) || pC.y.outoff(pA.y, pB.y)) return false;
      return (pB.x - pA.x) * (pC.y - pA.y) == (pC.x - pA.x) * (pB.y - pA.y);
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
   perpendicular: function (p, deg, distance) {
      return {
         y: p.y + Math.sin(deg2rad(deg + 90)) * distance,
         x: p.x + Math.cos(deg2rad(deg + 90)) * distance,
      };
   },

   //calculates a point which is perpendicular to the given vector
   perpendicularX: function (v) {
      return new V2({
         y: v.x,
         x: -v.y,
      });
   },

   parallel: function (deg, distance) {
      return {
         y: Math.sin(deg2rad(deg)) * -distance,
         x: Math.cos(deg2rad(deg)) * distance,
      };
   },

   //returns the unit vector of the given vector
   unit: function (v, l) {
      const length = l ? l : this.length(v);
      return this.multiply(v, 1 / length);
   },

   multiply: function (v, s) {
      return {
         x: (v.x * s).round(this.PRECISION),
         y: (v.y * s).round(this.PRECISION),
      };
   },

   add: function (v1, v2) {
      return new Point(v1.x + v2.x, v1.y + v2.y);
   },

   sub: function (v1, v2) {
      return new Point(v1.x - v2.x, v1.y - v2.y);
   },

   flipY: (v) => ({ x: v.x, y: v.y * -1 }),

   round: (v) => ({ x: Math.round(v.x), y: Math.round(v.y) }),

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
         ((p1.x + p2.x) / 2).round(this.PRECISION),
         ((p1.y + p2.y) / 2).round(this.PRECISION)
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
};



function rotatePointAroundPivot(angle, pivot, point) {
   var cos = Math.cos(angle);
   var sin = Math.sin(angle);
   var dx = point.x - pivot.x;
   var dy = point.y - pivot.y;
   var x = dx * cos - dy * sin + pivot.x;
   var y = dy * cos + dx * sin + pivot.y;
   return { x: x, y: y };
}

class V2 {
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
}

class Point {
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

// Function to create a toast element
const createToast = (title, txt) => {
   return ui
      .div("toast")
      .attr({ role: "alert", "aria-live": "assertive", "aria-atomic": "true" })
      .append([
         $("<div>")
            .addClass("toast-header")
            .append([
               $("<strong>").addClass("me-auto").text(title),
               $("<button>").attr({ type: "button", "data-bs-dismiss": "toast", "aria-label": "Close" }).addClass("btn-close"),
            ]),
         $("<div>")
            .addClass("toast-body")
            .append([$("<p>", { text: txt })]),
      ]);
};

const getToastContainer = () => {
   let container = $("#toast-container");
   if (container.length === 0) {
      container = ui.div("toast-container").attr("id", "toast-container").css({ position: "fixed", bottom: "0", right: "0" });
      $("body").append(container);
   }
   return container;
};

// Function to show the toast
const showErrorToast = (error) => {
   console.error(error);
   const toast = createToast("Ups, Da gabs einen Fehler", error.message);
   getToastContainer().prepend(ui.div("p-3").append(toast));
   $(toast).toast({ autohide: true, delay: 10000 }).toast("show");
   $(toast).on("hidden.bs.toast", function () {
      $(this).parent().remove();
   });
};

const showInfoToast = (txt) => {
   console.info(txt);
   const toast = createToast("Information:", txt);
   getToastContainer().prepend(ui.div("p-3").append(toast));
   $(toast).toast({ autohide: true, delay: 10000 }).toast("show");
   $(toast).on("hidden.bs.toast", function () {
      $(this).parent().remove();
   });
};

const BS = {
   createListGroupItem(items) {
      return $("<li>", { class: "list-group-item" }).append(items);
   },

   create_buttonToolbar(items) {
      return ui.div("btn-toolbar", items).attr("role", "toolbar");
   },
   create_buttonGroup(items) {
      return ui.div("btn-group", items);
   },
   create_DropDownItem(text, value) {
      return $("<a>", {
         class: "dropdown-item",
         text: text,
         href: "#",
         value: value ?? text,
      });
   },

   createAccordionItem(title, parent, items, open = false) {
      let id = uuidv4();
      return ui.div("accordion-item", [
         $("<h2>", { class: "accordion-header" }).append(
            $("<button>", { class: "accordion-button  user-select-none", type: "button" })
               .attr("data-bs-toggle", "collapse")
               .attr("data-bs-target", "#" + id)
               .text(title)
               .toggleClass("collapsed", !open)
         ),
         ui
            .div("accordion-collapse collapse", ui.div("accordion-body", items))
            .attr("id", id)
            .attr("data-bs-parent", parent)
            .toggleClass("show", open),
      ]);
   },

   create_DropDown(items, text, onChange) {
      return ui
         .div("dropdown d-grid", [
            $("<button>", {
               class: "btn btn-primary dropdown-toggle btn-sm",
               type: "button",
               text: text,
               id: "btn_" + text.replace(" ", "_"),
            }).attr("data-bs-toggle", "dropdown"),
            ui.div(
               "dropdown-menu",
               items.map((item) => BS.create_DropDownItem(...item.split("|")))
            ),
         ])
         .on("hide.bs.dropdown", (e) => {
            if (e.clickEvent?.target && e.clickEvent?.target.nodeName == "A") {
               const value = $(e.clickEvent.target).attr("value");
               $(e.currentTarget).attr("value", value);
               if (onChange) onChange(value);
            }
         })
         .on("show.bs.dropdown", (e) => {
            const targetValue = $(e.currentTarget).attr("value");
            if (!targetValue) return;
            $(".dropdown-item", e.currentTarget)
               .removeClass("active")
               .each(function () {
                  if ($(this).attr("value") === targetValue) {
                     $(this).addClass("active");
                  }
               });
         });
   },

   createSwitchStructure(mainLabel, subLabels, onchange) {
      let [text, value, enabled] = mainLabel;
      if (!enabled && subLabels.length == 0) return null;
      let $mainDiv;
      $mainDiv = ui.div("", [
         enabled == null || enabled
            ? ui.div("form-check form-switch", [
                 $("<input/>", {
                    class: "form-check-input",
                    type: "checkbox",
                    role: "switch",
                    id: "switch_" + text,
                 })
                    .on("change", function () {
                       const isChecked = $(this).is(":checked");
                       /* $("input", $mainDiv.children()[1]).prop("disabled", !isChecked); */
                       if (onchange) onchange($(this).attr("value"), isChecked);
                    })
                    .attr("value", value ?? text)
                    .attr("data-master_switch", ""),

                 $("<label/>", {
                    class: "form-check-label",
                    for: "switch_" + text,
                    text: text,
                 }),
              ])
            : $("<label/>", {
                 text: text,
              }),

         ui.div(
            "ps-3",
            subLabels
               .filter((x) => x[2] == null || x[2] == true)
               .map(function (label) {
                  [text, value, enabled] = label;
                  return ui.div("form-check form-switch", [
                     $("<input/>", {
                        class: "form-check-input",
                        type: "checkbox",
                        role: "switch",
                        id: "switch_" + text,
                        checked: true, // Default to checked as per your example
                     })
                        .on("change", function () {
                           const isChecked = $(this).is(":checked");
                           if (onchange) onchange($(this).attr("value"), isChecked);
                        })
                        .attr("value", value ?? text),
                     $("<label/>", {
                        class: "form-check-label",
                        for: "switch_" + text,
                        text: text,
                     }),
                  ]);
               })
         ),
      ]);
      return $mainDiv;
   },
   createOptionGroup(header, options, inputType = "radio", onchange) {
      return ui.div("", [
         $("<label>").text(header),
         ui.div(
            "ps-3",
            options.map(function (option) {
               let [text, value, enabled] = option;
               let id = "input_" + text;
               // Create the div for each form-check-inline
               return ui.div("form-check form-check-inline", [
                  $("<input>")
                     .addClass("form-check-input")
                     .attr("id", id)
                     .attr("name", "OptionGroup_" + header)
                     .attr("type", inputType)
                     .attr("value", value ?? text)
                     .attr("disabled", enabled != null && !enabled)
                     .on("change", function () {
                        const isChecked = $(this).is(":checked");
                        if (onchange) onchange($(this).attr("value"), isChecked);
                     }),
                  $("<label>").addClass("form-check-label").attr("for", id).text(text),
               ]);
            })
         ),
      ]);
   },

   lightBulb() {
      return $(
         "<svg xmlns='http://www.w3.org/2000/svg' width='16' height='16' fill='currentColor' class='bi bi-lightbulb' viewBox='0 0 16 16'>" +
            "<path d='M2 6a6 6 0 1 1 10.174 4.31c-.203.196-.359.4-.453.619l-.762 1.769A.5.5 0 0 1 10.5 13a.5.5 0 0 1 0 1 .5.5 0 0 1 0 1l-.224.447a1 1 0 0 1-.894.553H6.618a1 1 0 0 1-.894-.553L5.5 15a.5.5 0 0 1 0-1 .5.5 0 0 1 0-1 .5.5 0 0 1-.46-.302l-.761-1.77a1.964 1.964 0 0 0-.453-.618A5.984 5.984 0 0 1 2 6zm6-5a5 5 0 0 0-3.479 8.592c.263.254.514.564.676.941L5.83 12h4.342l.632-1.467c.162-.377.413-.687.676-.941A5 5 0 0 0 8 1z'/> </svg>"
      );
   },

   createAndAppendZs3(listGroup, signal, label) {
      listGroup.append(
         this.create_ListGroupItem([this.create_label(label), this.createButtonContainer(this.create_Zs3DropDown(signal))])
      );
   },
};

createjs.Graphics.prototype.drawArrow = function (length, size) {
   this.mt(0, 0)
      .lt(length, 0)
      .mt(length - size, -size / 2)
      .lt(length, 0)
      .lt(length - size, size / 2);
};

createjs.Graphics.prototype.drawTriangle = function(color, p1, p2, p3) {
   this.beginFill(color)
      .mt(p1.x, p1.y)
      .lt(p2.x, p2.y)
      .lt(p3.x, p3.y)
      .lt(p1.x, p1.y);
};


createjs.Container.prototype.countContainers = function () {
   return this.children.filter((c) => c instanceof createjs.Container).reduce((count, c) => count + c.countContainers(), 0) + 1;
};

function testPerformance(f, txt) {
   const startTime = performance.now();

   for (let i = 0; i < 1000; i++) {
      f();
   }

   let endTime = performance.now();
   let timeDiff = Math.round((endTime - startTime) / 10);

   console.log(`Execution time: ${timeDiff} ms for ${txt}`);
}
