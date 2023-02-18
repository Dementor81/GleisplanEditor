'use strict';

const VERSION = '0.43'
const EXCLUDE_JSON = [];

const MODE_PLAY = 1;
const MODE_EDIT = 2;
const MODE_DELETE = 4;


const MOUSE_ACTION = {
    NONE: 0,
    SCROLL: 1,
    DRAW: 2,
    MOVE_ITEM: 3,
    DND_SIGNAL: 4
}




'use strict';
var grid_size = 60;
var signale_scale = 0.3;
var stage, main_container, overlay_container, ui_container, grid_container;
var drawingCanvas;
var color = "#000000";
var stroke = 4;
var startpoint;
var previousTouch;
var showGrid = true;
var mode = MODE_EDIT;
var pl;
var mouseAction = null;

var tracks = [];
var signals = [];

var signalTemplates = {}

$(() => { init(); });



function create_toggleButtonX(text, id, onclick) {
    return $("<button>", {
        type: "button",
        id: id,
        class: "btn btn-secondary btn-sm"
    }).html(text).click(() => { onclick(); });
}

function checkModeButtons() {
    $("button[data-mode]").removeClass("active");
    $("button[data-mode=" + mode + "]").addClass("active");

    /*  $("button[data-mode]").each((x, y) => {
         if (y.attr("data-mode") == mode)
             y.addClass("active");
         else
             y.removeClass("active");
     }); */
}

function init() {

    pl = new preLoader("images");
    initSignals();


    pl.start();



    stage = new createjs.Stage(myCanvas);
    stage.autoClear = true;
    stage.enableDOMEvents(true);
    /* console.log(createjs.Touch.isSupported());
    if (createjs.Touch.isSupported())
        createjs.Touch.enable(stage); */
    createjs.Ticker.framerate = 24;

    grid_container = new createjs.Container();
    grid_container.name = "main";
    grid_container.mouseChildren = true;
    stage.addChild(grid_container);

    main_container = new createjs.Container();
    main_container.name = "main";
    main_container.mouseChildren = true;
    stage.addChild(main_container);

    ui_container = new createjs.Container();
    ui_container.name = "ui";
    stage.addChild(ui_container);

    overlay_container = new createjs.Container();
    overlay_container.name = "overlay";
    stage.addChild(overlay_container);


    stage.on("stagemousedown", handleStageMouseDown);
    stage.on("stagemouseup", handleStageMouseUp);

    myCanvas.oncontextmenu = function () {
        return false;
    };
    myCanvas.addEventListener('wheel', (event) => {
        event.preventDefault();

        let point = new createjs.Point(stage.mouseX, stage.mouseY);
        let localPoint = stage.globalToLocal(point.x, point.y);

        stage.scale -= 0.5 * (event.deltaY / Math.abs(event.deltaY));
        if (stage.scale < 0.3) stage.scale = 0.3;

        // Find where the original point is now
        let globalPoint = stage.localToGlobal(localPoint.x, localPoint.y);
        // Move the map by the difference
        stage.x -= (globalPoint.x - point.x);
        stage.y -= (globalPoint.y - point.y);

        drawGrid(main_container);
        stage.update();
        //console.log("scale: " + main_container.scale);
        save();
    });
    if (createjs.Touch.isSupported()) {
        myCanvas.addEventListener('touchstart', (event) => {
            if (event.touches.length === 1) {
                let touch = event.touches[0];
                startTrackDrawing(stage.globalToLocal(touch.clientX, touch.clientY));
            }


            /* console.log("touch:" + event.touches.length);
            for (let index = 0; index < event.touches.length; index++) {
                const item = event.touches[index];
                console.log("x:" + item.clientX + ":" + item.clientY);
            } */
        });

        myCanvas.addEventListener('touchmove', (event) => {
            if (event.touches.length === 2) {
                let touch = event.touches[0];

                if (previousTouch) {
                    // be aware that these only store the movement of the first touch in the touches array
                    stage.x += touch.clientX - previousTouch.clientX;
                    stage.y += touch.clientY - previousTouch.clientY;

                    drawGrid(main_container);
                };

                previousTouch = touch;
            }

        });
    }

    $("#btnPlay").click((e) => {
        mode = MODE_PLAY;
        checkModeButtons();
    })
    $("#btnDrawTracks").click((e) => {
        mode = MODE_EDIT;
        checkModeButtons();
    })
    $("#btnSignal").click(() => {

    })

    $("#btnGrid").click(() => { showGrid = !showGrid; drawGrid(main_container); stage.update(); })

    $("#btnClear").click(() => { tracks = []; main_container.removeAllChildren(); drawGrid(main_container); save(); stage.update(); })

    $("#btnCenter").click(() => { stage.scale = 1; stage.x = 0; stage.y = 0; save(); drawGrid(main_container); stage.update(); })

    $(btn_test).click((e) => {
        e.preventDefault();
        $([myCanvas, sidebar]).toggleClass("toggled");
    });

    $("#btnImage").click((e) => {
        let sg = showGrid;
        showGrid = false;
        drawGrid(main_container);
        stage.update();
        let img = main_container.toDataURL("#00000000", "image/png");
        console.log(img.slice(0, 50));

        showGrid = sg;
        drawGrid(main_container);
        stage.update();
        //e.target.href = img;

        let a = $("<a>", { download: "gleisplan.png", href: img });
        a[0].click();
    })

    $("#sidebar .newItem").on("mousedown", (e) => {
        mouseAction = {
            action: MOUSE_ACTION.DND_SIGNAL,
            template: signalTemplates[e.target.attributes['data-signal'].value]
        };

        //mouseup beim document anmelden, weil mouseup im stage nicht ausgelöst wird, wenn mousedown nicht auch auf der stage war                
        document.addEventListener("mouseup", handleStageMouseUp, { once: true });

        stage.addEventListener("stagemousemove", handleMouseMove);

        startDragAndDropSignal(e.offsetX, e.offsetY);
    });



    loadRecent();
    onResizeWindow();
    checkModeButtons();

    $(window).resize(() => onResizeWindow());
}



function onResizeWindow() {
    $(myCanvas).attr("height", $(CanvasContainer).height() - 5);
    $(myCanvas).attr("width", $(CanvasContainer).width());
    drawGrid(main_container);
    stage.update();
}

function drawGrid() {
    grid_container.removeAllChildren();
    if (showGrid) {
        let grid = new createjs.Shape();
        grid.name = "grid";
        grid.mouseEnabled = false;
        grid.graphics.c().setStrokeStyle(1, "round").setStrokeDash([5, 5], 2 - Math.floor(stage.y / (2 * stage.scale)) * 2).beginStroke("#eee");
        let bounds = stage.canvas.getBoundingClientRect();

        let i = Math.floor(stage.x / (grid_size * stage.scale)) * -(grid_size);
        while (i < (bounds.width / stage.scale) - (stage.x / stage.scale)) { //spalten                
            grid.graphics.moveTo(i, 0 - stage.y / stage.scale).lineTo(i, (bounds.height / stage.scale) - stage.y / stage.scale);
            i += grid_size;
        }
        grid.graphics.setStrokeDash([5, 5], 2 - Math.floor(stage.x / (2 * stage.scale)) * 2).beginStroke("#eee");
        i = Math.floor(stage.y / (grid_size * stage.scale)) * -grid_size;
        while (i < (bounds.height / stage.scale) - stage.y / stage.scale) { //zeilen
            grid.graphics.moveTo(0 - stage.x / stage.scale, i).lineTo((bounds.width / stage.scale) - stage.x / stage.scale, i);
            i += grid_size;
        }
        grid_container.addChild(grid);
    }
}


function handleStageMouseDown(event) {

    //console.log("handleStageMouseDown");

    //console.log(main_container.mouseX + "/" + main_container.mouseY);

    let hittest = getHitTest();

    /* if (hittest != null) {

        console.log(hittest.name, hittest.getBounds());
    } */

    mouseAction = {
        action: MOUSE_ACTION.NONE,
        container: hittest,
        startPoint: { x: event.stageX, y: event.stageY },
        offset: hittest?.globalToLocal(stage.mouseX, stage.mouseY),
        distance: function (x, y) { return Math.abs(this.startPoint.x - x) + Math.abs(this.startPoint.y - y) }
    }

    if (mouseAction.offset) {
        let p = mouseAction.container.localToLocal(mouseAction.offset.x, mouseAction.offset.y, stage);
        console.log(p);
    }

    stage.addEventListener("stagemousemove", handleMouseMove);


}

function getHitTest() {
    let local_point = stage.globalToLocal(stage.mouseX, stage.mouseY);

    return main_container.getObjectUnderPoint(local_point.x, local_point.y, 1);
}

function findTrack(offset) {
    let local_point = stage.globalToLocal(stage.mouseX, stage.mouseY);
    //TODO: offset einbauen!
    let circle = { x: local_point.x, y: local_point.y, radius: grid_size / 2 };
    let r;
    for (let index = 0; index < tracks.length; index++) {
        const track = tracks[index];
        if (r = LineIsInCircle(track, circle))
            return r;
    }
}

function createSignalContainer(signal) {
    let c = new createjs.Container();
    c.name = "signal";
    c.signal = signal;
    c.mouseChildren = false;
    c.scale = signale_scale;

    signal.draw(c);
    let sig_bounds = c.getBounds();

    c.regX = sig_bounds.width + sig_bounds.x;
    c.regY = sig_bounds.height + sig_bounds.y;

    return c;
}

function bindSignal2Track(c_sig, track, pos) {

    //koordinaten anhand des Strecken KM suchen
    c_sig.x = Math.cos(deg2rad(track.deg)) * pos.km + track.start.x;
    c_sig.y = Math.sin(deg2rad(track.deg)) * -pos.km + track.start.y;


    if (pos.above) {
        c_sig.rotation = 270 - track.deg;
        //im rechten winkel zur Strecke ausrichten
        c_sig.y -= Math.cos(deg2rad(track.deg)) * (grid_size / 2);
        c_sig.x -= Math.sin(deg2rad(track.deg)) * (grid_size / 2);
    }
    else {
        c_sig.rotation = 90 - track.deg;
        c_sig.y += Math.cos(deg2rad(track.deg)) * (grid_size / 2);
        c_sig.x += Math.sin(deg2rad(track.deg)) * (grid_size / 2);
    }

    if (pos.flipped) {
        c_sig.rotation += 180;
        //c_sig.regX = 0;
    }
    else {
        let sig_bounds = c_sig.getBounds();
        //c_sig.regX = sig_bounds.width + sig_bounds.x;
    }
}

function startDragAndDropSignal(mouseX, mouseY) {

    if (mouseAction.container) {
        mouseAction.container.parent.removeChild(mouseAction.container)
    } else {
        let signal = new signalShape(mouseAction.template);
        mouseAction.container = createSignalContainer(signal);
        mouseAction.container.x = mouseX;
        mouseAction.container.y = mouseY;
    }

    overlay_container.addChild(mouseAction.container);
    /* let circle = new createjs.Shape();
    circle.name = "circle";
    circle.graphics.setStrokeStyle(1).beginStroke("#e00").drawCircle(0, 0, grid_size / 2);
    mouseAction.container.addChild(circle); */
    stage.update();
}

function startTrackDrawing() {
    startpoint = stage.globalToLocal(stage.mouseX, stage.mouseY);
    drawingCanvas = new createjs.Shape();
    main_container.addChild(drawingCanvas);
    drawingCanvas.graphics.c().setStrokeStyle(stroke).beginStroke(color).moveTo(startpoint.x, startpoint.y);
}

function handleMouseMove(event) {
    if (!event.primary) { return; }
    if (mouseAction == null) return;
    //falls mouseMove noch läuft, obwohl der User keinen button mehr drückt
    //tritt vor allem beim debugging auf
    if (event.nativeEvent.buttons == 0) return handleStageMouseUp(event);

    let local_point = stage.globalToLocal(stage.mouseX, stage.mouseY);
    //console.log(local_point,stage.mouseX, stage.mouseY);

    if (mouseAction.action === MOUSE_ACTION.NONE) {
        //wie weit wurde die maus seit mousedown bewegt
        if (mouseAction.distance(stage.mouseX, stage.mouseY) > 4) {
            if (event.nativeEvent.which == 1 && mode === MODE_EDIT && mouseAction.container?.name == "signal") {

                //strecke suchen, an der das Signal klemmt
                let track = trackShape.findTrackbySignal(mouseAction.container.signal);
                //das Signal dort entfernen
                track.removeSignal(mouseAction.container.signal);
                mouseAction.action = MOUSE_ACTION.DND_SIGNAL;
                //versatz zwischen Maus- und Container-Koordninate, damit der Container am Mauszeiger "klebt"
                //wird noch nicht ausgewertet

                startDragAndDropSignal();

                console.log(mouseAction);
            }
            else if (event.nativeEvent.which == 1 && mode === MODE_EDIT && mouseAction.container?.name != "signal") {
                stage.addEventListener("stagemousemove", handleMouseMove);
                startTrackDrawing();
                mouseAction.action = MOUSE_ACTION.DRAW;
            } else if (event.nativeEvent.which == 3) {
                stage.addEventListener("stagemousemove", handleMouseMove);
                mouseAction.action = MOUSE_ACTION.SCROLL;
            }
        }
    }


    if (mouseAction.action === MOUSE_ACTION.DND_SIGNAL) {
        mouseAction.hit_track = findTrack(mouseAction.offset);
        if (mouseAction.hit_track) {
            mouseAction.pos = {
                km: mouseAction.hit_track.km,
                signal: mouseAction.container.signal,
                above: mouseAction.hit_track.above,
                flipped: event.nativeEvent.altKey
            }
            bindSignal2Track(mouseAction.container, mouseAction.hit_track.track, mouseAction.pos);
        } else {
            mouseAction.container.rotation = 0;
            if (mouseAction.offset) {
                let p = mouseAction.container.localToLocal(mouseAction.offset.x, mouseAction.offset.y, stage);
                local_point.x -= (p.x - mouseAction.container.x);
                local_point.y -= (p.y - mouseAction.container.y);
            }
            mouseAction.container.x = local_point.x;
            mouseAction.container.y = local_point.y;
        }
    } else if (mouseAction.action === MOUSE_ACTION.DRAW) {

        drawingCanvas.graphics.lineTo(local_point.x, local_point.y);
    }
    else if (mouseAction.action === MOUSE_ACTION.SCROLL) {
        stage.x += event.nativeEvent.movementX;
        stage.y += event.nativeEvent.movementY;
        drawGrid();
    }


    stage.update();
}


function handleStageMouseUp(event) {
    //console.log("handleStageMouseUp", event.nativeEvent.which);

    let p2 = stage.globalToLocal(stage.mouseX, stage.mouseY);
    if (mouseAction == null) return;
    if (mouseAction.action === MOUSE_ACTION.NONE) {

        if (event.nativeEvent.which == 1 && mode === MODE_PLAY && mouseAction.container?.name == "signal") {
            ui.showPopup({ x: event.rawX, y: event.rawY, widht: 10, height: 10 }, mouseAction.container.signal.getHTML(), $(myCanvas));
            $("#popup button").click(() => {
                reDrawEverything();
            })
        }
    } else if (mouseAction.action === MOUSE_ACTION.DND_SIGNAL) {
        overlay_container.removeChild(mouseAction.container);
        if (mouseAction.hit_track) {
            main_container.addChild(mouseAction.container);

            mouseAction.hit_track.track.AddSignal(mouseAction.pos);

            //addSignal2Canvas(signalTemplates.ks, mouseAction.hit_track.point, mouseAction.hit_track.track, mouseAction.hit_track.above);
        }
        save();
        stage.update();
    } else if (mouseAction.action === MOUSE_ACTION.DRAW) {
        main_container.removeChild(drawingCanvas);
        //main_container.clear();

        let p1 = startpoint;


        if (Math.abs(p1.x - p2.x) >= grid_size || Math.abs(p1.y - p2.y) >= grid_size) {

            let diagonal = (Math.abs(p1.x - p2.x) / Math.abs(p1.y - p2.y)) < 4;
            if (diagonal) {
                p2.x = startpoint.x + Math.abs(p2.y - startpoint.y) * ((startpoint.x > p2.x) ? -1 : 1);
            }
            else
                p2.y = startpoint.y;

            p1.y = Math.round(p1.y / grid_size) * grid_size;
            p1.x = Math.round(p1.x / grid_size) * grid_size;

            p2.y = Math.round(p2.y / grid_size) * grid_size;
            p2.x = Math.round(p2.x / grid_size) * grid_size;

            if (p1.x - p2.x != 0) {
                createTrack(p1, p2);
                save();
            }
        }
        stage.update();
    } else if (mouseAction.action === MOUSE_ACTION.SCROLL) {
        save();
    }


    mouseAction = null;
}

function createTrack(p1, p2) {
    let track = new trackShape(p1, p2);
    track.draw(main_container);
    tracks.push(track);
}



function reDrawEverything() {
    if (!pl.loaded)
        setTimeout(() => {
            reDrawEverything();
        }, 500);
    else {
        main_container.removeAllChildren();
        tracks.forEach((t) => {

            t.draw(main_container);
            t.signals.forEach((p) => {
                let c = main_container.addChild(createSignalContainer(p.signal));
                bindSignal2Track(c, t, p);
            })
        })
        stage.update();
    }
}

function replacer(key, value) {
    if (value != null && typeof value.stringify === "function") {
        return value.stringify();
    } else {
        if (EXCLUDE_JSON.includes(key))
            return undefined
        else
            return value;
    }
}

function getSaveString() {
    return JSON.stringify({
        tracks: tracks,
        //signals: signals,
        version: 0.15,
        zoom: stage.scale,
        scrollX: stage.x,
        scrollY: stage.y
    }, replacer);
}

function save() {
    localStorage.setItem("bahnhof_last1", getSaveString());
}

function loadRecent() {
    try {
        let x = localStorage.getItem('bahnhof_last1');
        if (x != null) {
            loadFromJson(x);

        }
    } catch (error) {
        console.error(error);
    }

}

function receiver(key, value) {
    if (key == "signal")
        return signalShape.FromObject(value);
    if (key == "tracks")
        return value.map((item) => {
            return trackShape.FromObject(item);
        })

    return value;
}

function loadFromJson(json) {
    let loaded = JSON.parse(json, receiver);
    if (loaded.version >= 0.15) {
        stage.x = loaded.scrollX;
        stage.y = loaded.scrollY;
        stage.scale = loaded.zoom;
        tracks = loaded.tracks;
        reDrawEverything();
        /* loaded.tracks.forEach(s => {
            createTrack(s.start, s.end);
        }); */
    } else
        console.error(`stored version ${loaded.version} to old`)
}

