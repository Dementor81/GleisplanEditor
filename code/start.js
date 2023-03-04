'use strict';

const VERSION = '0.43'
const EXCLUDE_JSON = [];

const MODE_PLAY = 1;
const MODE_EDIT = 2;


const MOUSE_ACTION = {
    NONE: 0,
    SCROLL: 1,
    DRAW: 2,
    MOVE_ITEM: 3,
    DND_SIGNAL: 4
}

const track_color = "#000000";
const stroke = 2;
const grid_size = 60;
const signale_scale = 0.3;

var stage, main_container, overlay_container, ui_container, grid_container, signal_container, track_container;
var drawingCanvas;


var startpoint;
var previousTouch;
var showGrid = true;
var mode = MODE_EDIT;
var pl;
var mouseAction = null;
var selectedTrack;

var tracks = [];
var signals = [];

var signalTemplates = {}

$(() => { init(); });

function init() {

    pl = new preLoader("images");
    initSignals();


    pl.start().then(() => {
        $("#collapseOne .accordion-body").append(newItemButton(signalTemplates.ks_hp));
        $("#collapseTwo .accordion-body").append(newItemButton(signalTemplates.ks_vr));
        $("#collapseThree .accordion-body").append(newItemButton(signalTemplates.ne4));
        $("#collapseThree .accordion-body").append(newItemButton(signalTemplates.ne1));
        $("#collapseThree .accordion-body").append(newItemButton(signalTemplates.lf6));
        $("#collapseThree .accordion-body").append(newItemButton(signalTemplates.lf7));
        $("#collapseThree .accordion-body").append(newItemButton(signalTemplates.zs3));
    });



    stage = new createjs.Stage(myCanvas);
    stage.autoClear = true;
    stage.enableDOMEvents(true);
    /* console.log(createjs.Touch.isSupported());
    if (createjs.Touch.isSupported())
        createjs.Touch.enable(stage); */
    createjs.Ticker.framerate = 24;

    const create_container = n => {
        let c = new createjs.Container();
        c.name = n;
        c.mouseChildren = true;
        return c;
    }

    stage.addChild(grid_container = create_container("grid"));
    stage.addChild(main_container = create_container("main"));
    main_container.addChild(signal_container = create_container("signals"));
    main_container.addChild(track_container = create_container("tracks"));
    stage.addChild(ui_container = create_container("ui"));
    stage.addChild(overlay_container = create_container("overlay"));

    createjs.Ticker.addEventListener("tick", stage);
    createjs.Ticker.setFPS(25);


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

        drawGrid();
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

                    drawGrid();
                };

                previousTouch = touch;
            }

        });
    }

    $(btnPlay).click(() => changeMode(MODE_PLAY));

    $(btnDrawTracks).click(() => changeMode(MODE_EDIT));

    $("#btnGrid").click(() => { showGrid = !showGrid; drawGrid(); stage.update(); })

    $("#btnClear").click(() => { tracks = []; signal_container.removeAllChildren(); track_container.removeAllChildren(); drawGrid(); save(); stage.update(); })

    $("#btnCenter").click(() => { stage.scale = 1; stage.x = 0; stage.y = 0; save(); drawGrid(); stage.update(); })

    $("#btnImage").click((e) => {
        /* let bounds =   main_container.getBounds()
        main_container.cache(bounds.x, bounds.y, bounds.width, bounds.height);
        let img = main_container.bitmapCache.getCacheDataURL(); */
        grid_container.visible = false;
        stage.update();
        let img = stage.toDataURL("#00000000", "image/png");
        grid_container.visible = true;
        stage.update();
        let a = $("<a>", { download: "gleisplan.png", href: img });
        a[0].click();
    })

    document.addEventListener("keydown", (e) => {
        if (e.code == "Delete" && selectedTrack != null) {
            deleteTrack(selectedTrack);
            selectedTrack = null;
            save();
        }
    });

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
    changeMode(MODE_EDIT);

    $(window).resize(onResizeWindow);
    myCanvas.focus();
}

function changeMode(newMode) {
    $(btnPlay).toggleClass("active", newMode == MODE_PLAY)
    $(btnDrawTracks).toggleClass("active", newMode == MODE_EDIT)
    $([myCanvas, sidebar]).toggleClass("toggled", newMode == MODE_EDIT);
    mode = newMode;
}

function onResizeWindow() {
    $(myCanvas).attr("height", $(CanvasContainer).height() - 5);
    $(myCanvas).attr("width", $(CanvasContainer).width());
    drawGrid();
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
    //console.log(hittest);
    /* if (hittest != null) {

        console.log(hittest);
    } */

    mouseAction = {
        action: MOUSE_ACTION.NONE,
        container: hittest,
        startPoint: { x: event.stageX, y: event.stageY },
        offset: hittest?.globalToLocal(stage.mouseX, stage.mouseY),
        distance: function (x, y) { return Math.abs(this.startPoint.x - x) + Math.abs(this.startPoint.y - y) }
    }

    stage.addEventListener("stagemousemove", handleMouseMove);
}

function getHitTest() {
    let local_point = stage.globalToLocal(stage.mouseX, stage.mouseY);

    return main_container.getObjectUnderPoint(local_point.x, local_point.y, 1);
}

function findTrack(use_offset) {
    let local_point = stage.globalToLocal(stage.mouseX, stage.mouseY);
    if (mouseAction.offset && use_offset) {
        let p = mouseAction.container.localToLocal(mouseAction.offset.x, mouseAction.offset.y, stage);
        local_point.x -= (p.x - mouseAction.container.x);
        local_point.y -= (p.y - mouseAction.container.y);
    }
    /*  let circleShape = overlay_container.getChildByName("circle");
     if (circleShape == null) {
         circleShape = new createjs.Shape();
         circleShape.name = "circle";
         circleShape.graphics.setStrokeStyle(1).beginStroke("#e00").drawCircle(0, 0, grid_size / 2);
         overlay_container.addChild(circleShape);
     }
     circleShape.x = local_point.x
     circleShape.y = local_point.y */
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
    let hit = new createjs.Shape();
    hit.graphics.beginFill("#000").drawRect(sig_bounds.x, sig_bounds.y, sig_bounds.width, sig_bounds.height);
    c.hitArea = hit;

    c.regX = sig_bounds.width / 2 + sig_bounds.x;
    c.regY = sig_bounds.height + sig_bounds.y;

    return c;
}

function alignSignalWithTrack(c_sig, track, pos) {
    //koordinaten anhand des Strecken KM suchen
    c_sig.x = Math.cos(deg2rad(track.deg)) * pos.km + track.start.x;
    c_sig.y = Math.sin(deg2rad(track.deg)) * -pos.km + track.start.y;


    if (pos.above) {
        c_sig.rotation = 270 - track.deg;
        //im rechten winkel zur Strecke ausrichten
        c_sig.y -= Math.cos(deg2rad(track.deg)) * (grid_size / 2 - 14);
        c_sig.x -= Math.sin(deg2rad(track.deg)) * (grid_size / 2 - 14);
    }
    else {
        c_sig.rotation = 90 - track.deg;
        c_sig.y += Math.cos(deg2rad(track.deg)) * (grid_size / 2 - 14);
        c_sig.x += Math.sin(deg2rad(track.deg)) * (grid_size / 2 - 14);
    }

    if (pos.flipped) {
        c_sig.rotation += 180;
    }
    else {
        let sig_bounds = c_sig.getBounds();
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
    drawingCanvas.graphics.c().setStrokeStyle(stroke).beginStroke(track_color).moveTo(startpoint.x, startpoint.y);
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
                if (track)
                    track.removeSignal(mouseAction.container.signal);
                mouseAction.action = MOUSE_ACTION.DND_SIGNAL;
                //versatz zwischen Maus- und Container-Koordninate, damit der Container am Mauszeiger "klebt"
                //wird noch nicht ausgewertet

                startDragAndDropSignal();
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
        let temp_hit = findTrack(false);
        if (temp_hit) {
            alignSignalWithTrack(mouseAction.container, temp_hit.track, {
                km: temp_hit.km,
                signal: mouseAction.container.signal,
                above: temp_hit.above,
                flipped: event.nativeEvent.altKey
            });
            mouseAction.hit_track = findTrack(true);
            if (mouseAction.hit_track) {
                mouseAction.pos = {
                    km: mouseAction.hit_track.km,
                    signal: mouseAction.container.signal,
                    above: mouseAction.hit_track.above,
                    flipped: event.nativeEvent.altKey
                }
                alignSignalWithTrack(mouseAction.container, mouseAction.hit_track.track, mouseAction.pos);
            }
        }

        if (temp_hit == null || mouseAction.hit_track == null) {
            mouseAction.hit_track = null;
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
            let popup = ui.showPopup({ x: event.rawX, y: event.rawY, widht: 10, height: 10 }, mouseAction.container.signal.getHTML(), $(myCanvas));
            $(".popover-body button").click(mouseAction.container.signal, (e) => {
                e.data.syncHTML(popup.tip);
                reDrawEverything();
            })
        } else if (event.nativeEvent.which == 1 && mode === MODE_EDIT && mouseAction.container?.name == "track") {
            selectTrack(mouseAction.container);
            stage.update();
        }

    } else if (mouseAction.action === MOUSE_ACTION.DND_SIGNAL) {
        overlay_container.removeChild(mouseAction.container);

        if (mouseAction.hit_track) {
            signal_container.addChild(mouseAction.container);
            mouseAction.hit_track.track.AddSignal(mouseAction.pos);
        }
        save();
        overlay_container.removeAllChildren();
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
        overlay_container.removeAllChildren();
        stage.update();
    } else if (mouseAction.action === MOUSE_ACTION.SCROLL) {
        save();
    }
    mouseAction = null;
}

function selectTrack(track) {
    if (selectedTrack)
        selectedTrack.color.style = track_color;

    selectedTrack = track
    /* let box = new createjs.Shape();
    box.graphics.setStrokeStyle(1).beginStroke("#e00").drawRect(track.start.x-5, track.start.y-5,track.end.x-track.start.x +5 ,track.end.y-track.start.y + 5 );
    
    ui_container.addChild(box); */

    selectedTrack.color.style = "red";
}

function deleteTrack(trackShape) {
    track_container.removeChild(trackShape);

    const index = tracks.indexOf(trackShape.track);
    if (index > -1) {
        tracks.splice(index, 1);
    }
    trackShape.track.signals.forEach(s => {
        let i = signal_container.children.findIndex(c => c.signal === s.signal);
        if (i != -1)
            signal_container.removeChildAt(i);
    });

}

function createTrack(p1, p2) {
    let track = new trackShape(p1, p2);
    track.draw(track_container);
    tracks.push(track);
}



function reDrawEverything() {
    if (!pl.loaded)
        setTimeout(() => {
            reDrawEverything();
        }, 500);
    else {
        track_container.removeAllChildren();
        signal_container.removeAllChildren();
        tracks.forEach((t) => {

            t.draw(track_container);
            t.signals.forEach((p) => {
                let c = signal_container.addChild(createSignalContainer(p.signal));
                alignSignalWithTrack(c, t, p);
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

function newItemButton(template) {
    return $("<button>",{class:"newItem"}).css("background-image", 'url(' + GetDataURL_FromTemplate(template) + ')')
        .attr("data-signal", template.id)
        .on("mousedown", (e) => {
            mouseAction = {
                action: MOUSE_ACTION.DND_SIGNAL,
                template: signalTemplates[e.target.attributes['data-signal'].value]
            };

            //mouseup beim document anmelden, weil mouseup im stage nicht ausgelöst wird, wenn mousedown nicht auch auf der stage war                
            document.addEventListener("mouseup", handleStageMouseUp, { once: true });

            stage.addEventListener("stagemousemove", handleMouseMove);

            startDragAndDropSignal(e.offsetX, e.offsetY);
        })
}



function GetDataURL_FromTemplate(template) {

    let signal = new signalShape(template);

    let c = $("<canvas>").attr({ width: 100, height: 100 });
    $(document.body).append(c);

    let s = new createjs.Stage(c[0]);
    signal.draw(s);
    let sig_bounds = s.getBounds();

    s.cache(sig_bounds.x, sig_bounds.y, sig_bounds.width, sig_bounds.height);
    let data_url = s.bitmapCache.getCacheDataURL();
    c.remove();
    return data_url;


}

