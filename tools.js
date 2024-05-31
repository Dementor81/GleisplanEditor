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

Number.prototype.is = function (a) {
    return Array.from(arguments).includes(this);
};

Number.prototype.round = function (places) {
    const x = Math.pow(10, places);
    return Math.round(this * x) / x;
};

Array.prototype.remove = function (item) {
    const index = this.indexOf(item);
    if (index > -1) {
        this.splice(index, 1);
    }
};

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

var groupBy = function (data, propertyPath) {
    // `data` is an array of objects, `key` is the key (or property accessor) to group by
    // reduce runs this anonymous function on each element of `data` (the `item` parameter,
    // returning the `storage` parameter at the end

    return data.reduce(function (storage, item) {
        let property = propertyPath.split(".").reduce((acc, key) => acc[key], item);
        // get the first instance of the key by which we're grouping
        var group = property;

        // set `storage` for this instance of group to the outer scope (if not empty) or initialize it
        storage[group] = storage[group] || [];

        // add this item to its group within `storage`
        storage[group].push(item);

        // return the updated storage to the reduce function, which will then loop through the next
        return storage;
    }, {}); // {} is the initial value of the storage
};

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
    return x && y && tx === "object" && tx === ty ? ok(x).length === ok(y).length && ok(x).every((key) => deepEqual(x[key], y[key])) : x === y;
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
    return ([1e7] + -1e3 + -4e3 + -8e3 + -1e11).replace(/[018]/g, (c) => (c ^ (crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (c / 4)))).toString(16));
}

function splitEquation(equation) {
    let leftOperand, rightOperand, operator;
    const index = equation.indexOf("&&");
    if (index !== -1) {
        leftOperand = equation.substring(0, index).trim();
        rightOperand = equation.substring(index + 2).trim();
        operator = "&&";
    } else {
        const math_operators = /[=<>]+/; // Regular expression to match any of the operators

        const parts = equation.split(math_operators, 2);
        leftOperand = parts[0].trim(); // "a"
        rightOperand = parts[1].trim(); // "6"
        operator = equation.match(math_operators)[0];
    }
    return {
        left: leftOperand,
        right: rightOperand,
        operator: operator,
    };
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

function createBoxFromLine(startPoint, endPoint, unit, size) {
    // Calculate the perpendicular vector (swapping x and y components and negating one of them)
    const perpendicularX = -unit.y * size;
    const perpendicularY = unit.x * size;
    return {
        bottomLeft: {
            x: startPoint.x + perpendicularX,
            y: startPoint.y + perpendicularY,
        },
        bottomRight: {
            x: endPoint.x + perpendicularX,
            y: endPoint.y + perpendicularY,
        },
        topRight: {
            x: endPoint.x - perpendicularX,
            y: endPoint.y - perpendicularY,
        },
        topLeft: {
            x: startPoint.x - perpendicularX,
            y: startPoint.y - perpendicularY,
        },
    };
}

function LineIsInCircle(line, circle) {
    // Find the distance between the line start and end points
    const lineDeltaX = line.end.x - line.start.x;
    const lineDeltaY = line.end.y - line.start.y;
    const lineLength = line._tmp.length;
    const lineUnitVector = line._tmp.unit;

    // Find the closest point on the line to the circle
    const u = ((circle.x - line.start.x) * lineUnitVector.x + (circle.y - line.start.y) * lineUnitVector.y) / lineLength;

    let closestPointOnLine;
    if (u < 0) {
        closestPointOnLine = line.start;
    } else if (u > 1) {
        closestPointOnLine = line.end;
    } else {
        closestPointOnLine = {
            x: line.start.x + u * lineUnitVector.x * lineLength,
            y: line.start.y + u * lineUnitVector.y * lineLength,
        };
    }

    // Check if the closest point on the line is within the circle
    const distanceToCircle = Math.sqrt(Math.pow(closestPointOnLine.x - circle.x, 2) + Math.pow(closestPointOnLine.y - circle.y, 2));
    if (distanceToCircle <= circle.radius)
        return {
            point: closestPointOnLine,
            km: u * lineLength,
        };
    return null;
}

function deg2rad(deg) {
    return deg * (Math.PI / 180);
}

const ui = {
    create_toggleButton: function (menu_item, signal) {
        if (menu_item.ve != null && menu_item.ve.length > 0 && menu_item.ve.every((ve) => signal.features.match(ve.conditions)))
            return $("<button>", {
                type: "button",
                id: "btn_" + menu_item.text.replace(" ", "_"),
                class: "btn btn-primary btn-sm",
            })
                .attr("data_signal", menu_item.setting)
                .html(menu_item.text)
                .click((e) => {
                    signal.set_stellung(menu_item.setting, null, !$(e.target).hasClass("active"));
                });
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

    showContextMenu: function (point, parent, items, signal) {
        const createDropDownItems = function (items, dd) {
            return items.map((item) => {
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
                    a.toggleClass("active", signal.features.match(item.option));
                    a.click(() => {
                        signal.features?.set(item.option, !a.hasClass("active"));
                        dd.hide();
                        renderer.reDrawEverything();
                        save();
                    });
                }
                li.append(a);
                return li;
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
    },
    div: function (c) {
        return $("<div>", { class: c });
    },

    showModalDialog: function (content,ok_function) {
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
                            click: ok_function
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
        const denominator = (line2.end.y - line2.start.y) * (line1.end.x - line1.start.x) - (line2.end.x - line2.start.x) * (line1.end.y - line1.start.y);

        // If the denominator is 0, the lines are parallel and don't intersect
        if (denominator === 0) {
            return null;
        }

        const ua = ((line2.end.x - line2.start.x) * (line1.start.y - line2.start.y) - (line2.end.y - line2.start.y) * (line1.start.x - line2.start.x)) / denominator;
        const ub = ((line1.end.x - line1.start.x) * (line1.start.y - line2.start.y) - (line1.end.y - line1.start.y) * (line1.start.x - line2.start.x)) / denominator;

        // If ua or ub is less than 0 or greater than 1, the intersection point is outside of the segments
        if (ua < 0 || ua > 1 || ub < 0 || ub > 1) {
            return null;
        }

        // Calculate the intersection point
        const intersectionX = line1.start.x + ua * (line1.end.x - line1.start.x);
        const intersectionY = line1.start.y + ua * (line1.end.y - line1.start.y);

        return new Point(intersectionX, intersectionY);
    },
    pointOnLine: function (point1, point2, targetPoint) {
        // Extract coordinates from the objects
        let x1 = point1.x,
            y1 = point1.y;
        let x2 = point2.x,
            y2 = point2.y;
        let px = targetPoint.x,
            py = targetPoint.y;

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

    //calculates a point which is perpendicular to the given vector
    perpendicular: function (p, deg, distance) {
        return {
            y: p.y + Math.sin(deg2rad(deg + 90)) * distance,
            x: p.x + Math.cos(deg2rad(deg + 90)) * distance,
        };
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
        return { x: v1.x + v2.x, y: v1.y + v2.y };
    },

    sub: function (v1, v2) {
        return { x: v1.x - v2.x, y: v1.y - v2.y };
    },

    flipY: (v) => ({ x: v.x, y: v.y * -1 }),

    round: (v) => ({ x: Math.round(v.x), y: Math.round(v.y) }),
};

//sw=switch location
//rad= angle of track_1 in rad
//c= end of the track_2 to find angle
function findAngle(sw, c, rad = 0) {
    let atan = Math.atan2(c.y - sw.y, c.x - sw.x) - rad;
    if (atan < 0) atan += 2 * π; //macht aus neg Winkeln durch addition von 360° positive winkel

    let val = (atan * 180) / π;
    return val;
}

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
}

class Point {
    constructor(x, y) {
        this.x = x;
        this.y = y;
    }

    equals(p) {
        return p.x == this.x && p.y == this.y;
    }
}
