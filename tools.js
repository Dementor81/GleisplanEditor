'use strict';
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
  return ([1e7] + -1e3 + -4e3 + -8e3 + -1e11).replace(/[018]/g, c =>
    (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)
  );
}

function LineIsInCircle(line, circle) {
  // Find the distance between the line start and end points
  const lineDeltaX = line.end.x - line.start.x;
  const lineDeltaY = line.end.y - line.start.y;
  const lineLength = Math.sqrt(lineDeltaX * lineDeltaX + lineDeltaY * lineDeltaY);

  // Find the unit vector of the line
  const lineUnitVector = {
    x: lineDeltaX / lineLength,
    y: lineDeltaY / lineLength
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
      y: line.start.y + u * lineUnitVector.y * lineLength
    };
  }

  // Check if the closest point on the line is within the circle
  const distanceToCircle = Math.sqrt(Math.pow(closestPointOnLine.x - circle.x, 2) + Math.pow(closestPointOnLine.y - circle.y, 2));
  if (distanceToCircle <= circle.radius)
    return {
      point: closestPointOnLine,
      track: line,
      above: closestPointOnLine.y > circle.y,
      km: u * lineLength
    };
  return null;
}

function deg2rad(deg) {
  return deg * (Math.PI / 180);
}

const ui = {
  create_toggleButton: function (text, id, onclick) {
    return $("<button>", {
      type: "button",
      id: id,
      class: "btn btn-primary btn-sm"
    }).html(text).click(onclick);
  },
  create_buttonGroup: function (items) {
    return $("<div>", { class: "btn-group", role: "group" }).append(items);
  },
  showPopup: function (r, content, parent) {
    let $dummy = $("#dummy");
    let rect = parent[0].getBoundingClientRect();
    if ($dummy.length == 0) {
      $dummy = $("<div>", { id: "dummy", width: r.width, height: r.height });
      $(document.body).append($dummy)
    }
    $dummy.css({ position: "absolute", left: r.x + rect.x, top: r.y + rect.y });
    let popup = bootstrap.Popover.getOrCreateInstance($dummy);
    if (popup) {
      $(document).off("click");
      popup.dispose();
    }

    let random = Math.random();

    popup = new bootstrap.Popover($dummy, {
      html: true,
      trigger: "manual",
      title: "test",
      placement: "right",
      sanitize: false,
      content: $("<div>", { id: "popup" }).html(content)
    });
    $dummy[0].addEventListener('hidden.bs.popover', (e) => {
      $(document).off("click");
      let p = bootstrap.Popover.getOrCreateInstance(e.target)
      if (p) p.dispose();
      $(e.target).remove();

    }, { once: true });
    $dummy[0].addEventListener('shown.bs.popover', (e) => {
      $(document).on("click", (event) => {
        let $target = $(event.target);
        if ($target.closest('div.popover').length == 0) {
          let p = bootstrap.Popover.getOrCreateInstance(e.target)
          if (p)
            p.hide();
        }
      })
    }, { once: true });
    popup.show();
  },
  div : function(c){
    return $("<div>", { class: c });
}
}

function log(param1,param2,param3,param4,param5) {
  console.log(param1,param2,param3,param4,param5);
}
