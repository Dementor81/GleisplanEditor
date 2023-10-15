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

function LineIsInCircle(line, circle) {
    // Find the distance between the line start and end points
    const lineDeltaX = line.end.x - line.start.x;
    const lineDeltaY = line.end.y - line.start.y;
    const lineLength = Math.sqrt(lineDeltaX * lineDeltaX + lineDeltaY * lineDeltaY);

    // Find the unit vector of the line
    const lineUnitVector = {
        x: lineDeltaX / lineLength,
        y: lineDeltaY / lineLength,
    };

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
            track: line,
            above: closestPointOnLine.y > circle.y,
            km: u * lineLength,
        };
    return null;
}

function deg2rad(deg) {
    return deg * (Math.PI / 180);
}

const ui = {
    create_toggleButton: function (text, id, stellung, signal) {
        return $("<button>", {
            type: "button",
            id: "btn_" + id,
            class: "btn btn-primary btn-sm",
        })
            .attr("data_signal", stellung)
            .html(text)
            .click(() => {
                signal.set(stellung);
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
                    signal.set(stellung, e.target.value);
                    reDrawEverything();
                    save();
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
            $dummy = $("<div>", { id: "dummy", width: r.width, height: r.height });
            $(document.body).append($dummy);
        }
        $dummy.css({ position: "absolute", left: r.x + rect.x, top: r.y + rect.y });
        let popup = bootstrap.Popover.getOrCreateInstance($dummy);
        if (popup) {
            $(document).off("mousedown");
            popup.dispose();
        }

        popup = new bootstrap.Popover($dummy, {
            html: true,
            trigger: "manual",
            title: title,
            placement: "right",
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
                    a.toggleClass("active", signal.options.match(item.option));
                    a.click(() => {
                        signal.options?.set(item.option, !a.hasClass("active"));
                        dd.hide();
                        reDrawEverything();
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
        if(exclude && (deepEqual(pA, pC)||deepEqual(pB, pC))) return false;
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

        return { x: intersectionX, y: intersectionY };
    },

    //calculates a point which is perpendicular to the given vector
    perpendicular: function (p, deg, distance) {
        return {
            y: p.y + Math.sin(deg2rad(deg+90)) * distance,
            x: p.x + Math.cos(deg2rad(deg+90)) * distance,
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

    flipY: (v) => ({ x: v.x, y: v.y * -1 }),

    round: (v) => ({ x: Math.round(v.x), y: Math.round(v.y) }),
};

//sw=switch location
//rad= angle of track_1 in rad
//c= end of the track_2 to find angle
function findAngle(sw, c, rad=0) {
    let atan = Math.atan2((c.y - sw.y) , c.x - sw.x) - rad;
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
