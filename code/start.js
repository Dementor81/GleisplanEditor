"use strict";

const VERSION = "0.43";
const EXCLUDE_JSON = [];

const MODE_PLAY = 1;
const MODE_EDIT = 2;

const GRID_SIZE = 70;
const GRID_SIZE_2 = GRID_SIZE / 2;

const MOUSE_ACTION = {
    NONE: 0,
    SCROLL: 1,
    BUILD_TRACK: 2,
    MOVE_ITEM: 3,
    DND_SIGNAL: 4,
};

const SWITCH_TYPE = {
    NONE: 0,
    ARCH: 1,
    TO_RIGHT: 2, //45°
    FROM_RIGHT: 4, //135°
    FROM_LEFT: 6, //225°
    TO_LEFT: 8, //315°
    DKW: 9,
    CROSSING: 10,
};

var stage, main_container, overlay_container, ui_container, signal_container, track_container, grid;

var TEXTURE_MODE = false;
var startpoint;
var previousTouch;
var showGrid = true;
var mode = MODE_EDIT;
var pl;
var mouseAction = null;
var selectedTrack;
var loadQueue;

var renderer;

var tracks = [];
var switches = [];

var signalTemplates = {};

$(() => {
    init();
});

function init() {
    pl = new preLoader("images");
    initSignals();

    pl.addImage("schwellen.png", "schwellen");
    pl.addImage("dkw.png", "dkw");

    pl.start().then(() => {
        $("#collapseOne .accordion-body").append(newItemButton(signalTemplates.hv_hp));
        $("#collapseOne .accordion-body").append(newItemButton(signalTemplates.ks_hp));
        $("#collapseTwo .accordion-body").append(newItemButton(signalTemplates.hv_vr));
        $("#collapseTwo .accordion-body").append(newItemButton(signalTemplates.ks_vr));
        $("#collapseThree .accordion-body").append(newItemButton(signalTemplates.ne4));
        $("#collapseThree .accordion-body").append(newItemButton(signalTemplates.ne1));
        $("#collapseThree .accordion-body").append(newItemButton(signalTemplates.lf6));
        $("#collapseThree .accordion-body").append(newItemButton(signalTemplates.lf7));
        $("#collapseThree .accordion-body").append(newItemButton(signalTemplates.zs3));
        loadRecent();
    });

    stage = new createjs.Stage(myCanvas);
    stage.enableDOMEvents(true);
    /* console.log(createjs.Touch.isSupported());
    if (createjs.Touch.isSupported())
        createjs.Touch.enable(stage); */
    createjs.Ticker.framerate = 1;

    const create_container = (n) => {
        let c = new createjs.Container();
        c.name = n;
        c.mouseChildren = true;
        return c;
    };

    stage.addChild((main_container = create_container("main")));
    main_container.addChild((track_container = create_container("tracks")));
    main_container.addChild((signal_container = create_container("signals")));
    stage.addChild((ui_container = create_container("ui")));
    stage.addChild((overlay_container = create_container("overlay")));

    createjs.Ticker.addEventListener("tick", stage);

    stage.addEventListener("stagemousedown", handleStageMouseDown);
    stage.addEventListener("stagemouseup", handleStageMouseUp);

    myCanvas.oncontextmenu = () => false;
    myCanvas.addEventListener("wheel", (event) => {
        event.preventDefault();

        let point = new createjs.Point(stage.mouseX, stage.mouseY);
        let localPoint = stage.globalToLocal(point.x, point.y);

        stage.scale -= event.deltaY / (1000 / stage.scale);

        stage.scale = Math.min(Math.max(0.2, stage.scale), 6);       

        // Find where the original point is now
        let globalPoint = stage.localToGlobal(localPoint.x, localPoint.y);
        // Move the map by the difference
        stage.x -= globalPoint.x - point.x;
        stage.y -= globalPoint.y - point.y;

        drawGrid();
        stage.update();
        save();
    });
    if (createjs.Touch.isSupported()) {
        myCanvas.addEventListener("touchstart", (event) => {
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

        myCanvas.addEventListener("touchmove", (event) => {
            if (event.touches.length === 2) {
                let touch = event.touches[0];

                if (previousTouch) {
                    // be aware that these only store the movement of the first touch in the touches array
                    stage.x += touch.clientX - previousTouch.clientX;
                    stage.y += touch.clientY - previousTouch.clientY;

                    drawGrid();
                }

                previousTouch = touch;
            }
        });
    }

    $(btnPlay).click(() => changeMode(MODE_PLAY));

    $(btnDrawTracks).click(() => changeMode(MODE_EDIT));

    $(btnGrid).click((e) => {
        onShowGrid(!$(btnGrid).hasClass("active"));
    });

    $(btnTexture).click((e) => {
        TEXTURE_MODE = !TEXTURE_MODE;
        $(btnTexture).toggleClass("active", TEXTURE_MODE);
        selectRenderer(TEXTURE_MODE);
    });

    $("#btnClear").click(() => {
        tracks = [];

        save();
        clearCanvas();
    });

    $("#btnCenter").click(() => {
        stage.scale = 1;
        stage.x = 0;
        stage.y = 0;
        save();
        drawGrid();
        stage.update();
    });

    $("#btnImage").click((e) => {
        /* let bounds =   main_container.getBounds()
        main_container.cache(bounds.x, bounds.y, bounds.width, bounds.height);
        let img = main_container.bitmapCache.getCacheDataURL(); */
        grid.visible = false;
        stage.update();
        let img = stage.toDataURL("#00000000", "image/png");
        grid.visible = showGrid;
        stage.update();
        let a = $("<a>", { download: "gleisplan.png", href: img });
        a[0].click();
    });

    document.addEventListener("keydown", (e) => {
        if (e.code == "Delete" && selectedTrack != null) {
            deleteTrack(selectedTrack, null);
            selectedTrack = null;
            save();
            renderer.reDrawEverything();
        }
    });

    onResizeWindow();
    changeMode(MODE_EDIT);
    onShowGrid(showGrid);
    selectRenderer(false);

    $(window).resize(onResizeWindow);
    myCanvas.focus();
}

function changeMode(newMode) {
    $(btnPlay).toggleClass("active", newMode == MODE_PLAY);
    $(btnDrawTracks).toggleClass("active", newMode == MODE_EDIT);
    $([myCanvas, sidebar]).toggleClass("toggled", newMode == MODE_EDIT);
    mode = newMode;
}

function selectRenderer(textured) {
    if (textured) {
        renderer = new trackRendering_textured();
    } else {
        renderer = new trackRendering_basic();
    }
    renderer.reDrawEverything();
}

function clearCanvas() {
    track_container.removeAllChildren();
    signal_container.removeAllChildren();
    overlay_container.removeAllChildren();
    ui_container.removeAllChildren();
    stage.update();
}

function onShowGrid(on) {
    showGrid = on;
    drawGrid();
    stage.update();
    $(btnGrid).toggleClass("active", on);
}

function onResizeWindow() {
    $(myCanvas).attr("height", $(CanvasContainer).height() - 5);
    $(myCanvas).attr("width", $(CanvasContainer).width());
    drawGrid();
    stage.update();
}

function drawGrid(repaint = true) {
    if (!grid) {
        grid = new createjs.Shape();
        grid.name = "grid";
        grid.mouseEnabled = false;
        main_container.addChildAt(grid, 0);
        grid.graphics.setStrokeStyle(1, "round");
    }
    grid.visible = showGrid;
    if (showGrid) {
        if (repaint) {
            grid.graphics.c().setStrokeStyle(1, "round").setStrokeDash([5, 5], 2).beginStroke("#ccc");

            const bounds = stage.canvas.getBoundingClientRect();
            const scale = stage.scale;
            const size = {
                width: bounds.width / scale,
                height: bounds.height / scale,
            };
            let x = 0;
            while (x < size.width) {
                grid.graphics.moveTo(x, -GRID_SIZE).lineTo(x, size.height);
                x += GRID_SIZE;
            }

            let y = 0;
            while (y < size.height) {
                grid.graphics.moveTo(-GRID_SIZE, y).lineTo(size.width, y);
                y += GRID_SIZE;
            }
            grid.cache(-GRID_SIZE, -GRID_SIZE, size.width + GRID_SIZE * scale, size.height + GRID_SIZE * scale, scale);
        }
        const scaled_grid_size = GRID_SIZE * stage.scale;
        grid.x = Math.floor(stage.x / scaled_grid_size) * -GRID_SIZE;
        grid.y = Math.floor(stage.y / scaled_grid_size) * -GRID_SIZE;
    }
}

function handleStageMouseDown(event) {
    //console.log("handleStageMouseDown", event);

    //console.log(main_container.mouseX + "/" + main_container.mouseY);

    let hittest = getHitTest();
    //console.log(hittest);

    console.log(hittest ? hittest : "nothing hit");

    mouseAction = {
        action: MOUSE_ACTION.NONE,
        container: hittest,
        startPoint: { x: event.stageX, y: event.stageY },
        offset: hittest?.globalToLocal(stage.mouseX, stage.mouseY),
        distance: function (x, y) {
            return geometry.distance(this.startPoint, { x: x, y: y });
        },
    };

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
        local_point.x -= p.x - mouseAction.container.x;
        local_point.y -= p.y - mouseAction.container.y;
    }
    /*  let circleShape = overlay_container.getChildByName("circle");
     if (circleShape == null) {
         circleShape = new createjs.Shape();
         circleShape.name = "circle";
         circleShape.graphics.setStrokeStyle(1).beginStroke("#e00").drawCircle(0, 0, GRID_SIZE / 2);
         overlay_container.addChild(circleShape);
     }
     circleShape.x = local_point.x
     circleShape.y = local_point.y */
    let circle = { x: local_point.x, y: local_point.y, radius: GRID_SIZE / 2 };
    let r;
    for (let index = 0; index < tracks.length; index++) {
        const track = tracks[index];
        if ((r = LineIsInCircle(track, circle))) return r;
    }
}

function createSignalContainer(signal) {
    let c = new createjs.Container();
    c.name = "signal";
    c.signal = signal;
    c.mouseChildren = false;
    c.scale = signal._template.scale;

    signal.draw(c);
    let sig_bounds = c.getBounds();
    if (sig_bounds) {
        // schläft fehl, wenn nichts gezeichnet wurde
        let hit = new createjs.Shape();
        hit.graphics.beginFill("#000").drawRect(sig_bounds.x, sig_bounds.y, sig_bounds.width, sig_bounds.height);
        c.hitArea = hit;

        c.regX = sig_bounds.width / 2 + sig_bounds.x;
        c.regY = sig_bounds.height + sig_bounds.y;
    } else console.error("Wahrscheinlich fehler beim Zeichen des Signals!");

    return c;
}

function alignSignalWithTrack(c_sig, track, pos) {
    //koordinaten anhand des Strecken KM suchen
    c_sig.x = Math.cos(track._tmp.rad) * pos.km + track.start.x;
    c_sig.y = Math.sin(track._tmp.rad) * pos.km + track.start.y;
    let p;
    if (pos.above) {
        c_sig.rotation = 270 + track._tmp.deg;
        p = geometry.perpendicular(c_sig, track._tmp.deg, -(GRID_SIZE_2 - 14));
    } else {
        c_sig.rotation = 90 + track._tmp.deg;
        p = geometry.perpendicular(c_sig, track._tmp.deg, GRID_SIZE_2 - 14);
    }
    c_sig.x = p.x;
    c_sig.y = p.y;
    if (pos.flipped) {
        c_sig.rotation += 180;
    }
}

function startDragAndDropSignal(mouseX, mouseY) {
    if (mouseAction.container) {
        mouseAction.container.parent.removeChild(mouseAction.container);
    } else {
        let signal = new signalShape(mouseAction.template);
        mouseAction.container = createSignalContainer(signal);
        mouseAction.container.x = mouseX;
        mouseAction.container.y = mouseY;
    }

    overlay_container.addChild(mouseAction.container);
    /* let circle = new createjs.Shape();
    circle.name = "circle";
    circle.graphics.setStrokeStyle(1).beginStroke("#e00").drawCircle(0, 0, GRID_SIZE / 2);
    mouseAction.container.addChild(circle); */
    stage.update();
}

function handleMouseMove(event) {
    //console.log("handleMouseMove", event);

    if (!event.primary) {
        return;
    }
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
                if (track) track.removeSignal(mouseAction.container.signal);
                mouseAction.action = MOUSE_ACTION.DND_SIGNAL;
                //versatz zwischen Maus- und Container-Koordninate, damit der Container am Mauszeiger "klebt"
                //wird noch nicht ausgewertet

                startDragAndDropSignal();
            } else if (event.nativeEvent.which == 1 && mode === MODE_EDIT && mouseAction.container?.name != "signal") {
                //stage.addEventListener("stagemousemove", handleMouseMove);
                mouseAction.lineShape = new createjs.Shape();
                overlay_container.addChild(mouseAction.lineShape);
                mouseAction.ankerPoints = [
                    {
                        x: Math.round(local_point.x / GRID_SIZE) * GRID_SIZE,
                        y: Math.round(local_point.y / GRID_SIZE) * GRID_SIZE,
                    },
                ];
                mouseAction.action = MOUSE_ACTION.BUILD_TRACK;
            } else if (event.nativeEvent.which == 3) {
                //stage.addEventListener("stagemousemove", handleMouseMove);
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
                flipped: event.nativeEvent.altKey,
            });
            mouseAction.hit_track = findTrack(true);
            if (mouseAction.hit_track) {
                mouseAction.pos = {
                    km: mouseAction.hit_track.km,
                    signal: mouseAction.container.signal,
                    above: mouseAction.hit_track.above,
                    flipped: event.nativeEvent.altKey,
                };
                alignSignalWithTrack(mouseAction.container, mouseAction.hit_track.track, mouseAction.pos);
            }
        }

        if (temp_hit == null || mouseAction.hit_track == null) {
            mouseAction.hit_track = null;
            mouseAction.container.rotation = 0;
            if (mouseAction.offset) {
                let p = mouseAction.container.localToLocal(mouseAction.offset.x, mouseAction.offset.y, stage);
                local_point.x -= p.x - mouseAction.container.x;
                local_point.y -= p.y - mouseAction.container.y;
            }
            mouseAction.container.x = local_point.x;
            mouseAction.container.y = local_point.y;
        }
    } else if (mouseAction.action === MOUSE_ACTION.BUILD_TRACK) {
        setTrackAnchorPoints();
        mouseAction.lineShape.graphics.c().setStrokeStyle(trackRendering_basic.STROKE).beginStroke(trackRendering_basic.TRACK_COLOR).moveTo(mouseAction.ankerPoints[0].x, mouseAction.ankerPoints[0].y);
        for (let index = 1; index < mouseAction.ankerPoints.length; index++) {
            const co = mouseAction.ankerPoints[index];
            mouseAction.lineShape.graphics.lt(co.x, co.y);
        }
    } else if (mouseAction.action === MOUSE_ACTION.SCROLL) {
        stage.x += event.nativeEvent.movementX;
        stage.y += event.nativeEvent.movementY;
        drawGrid(false);
    }

    stage.update();
}

function setTrackAnchorPoints() {
    let local_point = stage.globalToLocal(stage.mouseX, stage.mouseY);

    const p1 = mouseAction.ankerPoints[mouseAction.ankerPoints.length - 1];
    const p0 = mouseAction.ankerPoints.length > 1 ? mouseAction.ankerPoints[mouseAction.ankerPoints.length - 2] : p1;
    const pc = {
        x: Math.round(local_point.x / GRID_SIZE) * GRID_SIZE,
        y: Math.round(local_point.y / GRID_SIZE) * GRID_SIZE,
    };

    //der letzte und aktuelle Punkt sind unterschiedlich und die Pause ist nahe am pc
    if (!deepEqual(p1, pc)) {
        const i = mouseAction.ankerPoints.findIndex((p) => pc.x === p.x && pc.y === p.y);
        if (i > 0) {
            mouseAction.ankerPoints.splice(i);
            setTrackAnchorPoints();
        } else {
            if (Math.abs(p0.x - pc.x) < GRID_SIZE * 1.5 && mouseAction.ankerPoints.length > 1) {
                const slope = geometry.slope(p0, pc);

                if (slope.is(1, 0, -1) && geometry.distance(local_point, pc) < 10) mouseAction.ankerPoints[mouseAction.ankerPoints.length - 1] = pc;
            } else {
                const slope = geometry.slope(p1, pc);
                if (slope.is(1, 0, -1)) {
                    mouseAction.ankerPoints.push(pc);
                }
            }
        }
    }
}

function handleStageMouseUp(e) {
    //console.log("handleStageMouseUp", e);

    let p2 = stage.globalToLocal(stage.mouseX, stage.mouseY);
    if (mouseAction == null) return;
    if (e.nativeEvent.which == 1) {
        if (mouseAction.action === MOUSE_ACTION.NONE && mouseAction.distance(stage.mouseX, stage.mouseY) < 4) {
            if (mouseAction.container?.name == "signal") {
                if (mode === MODE_PLAY) {
                    let popup = ui.showPopup({ x: e.rawX, y: e.rawY, widht: 10, height: 10 }, mouseAction.container.signal._template.title, mouseAction.container.signal.getHTML(), $(myCanvas));
                    $(".popover-body button").click(mouseAction.container.signal, (e) => {
                        e.data.syncHTML(popup.tip);
                        renderer.reDrawEverything();
                        save();
                    });
                } else if (mode === MODE_EDIT) {
                    if (!$("#generated_menu").length) {
                        let context_menu = ui.showContextMenu({ x: e.rawX, y: e.rawY }, $(myCanvas), mouseAction.container.signal.getContectMenu(), mouseAction.container.signal);
                    }
                }
            } else if (mouseAction.container?.name == "track") {
                if (mode === MODE_EDIT) {
                    selectTrack(mouseAction.container);
                    stage.update();
                }
            } else if (mouseAction.container?.name == "switch") {
                switch_A_Switch(mouseAction.container.sw, mouseAction);
            } else {
                selectTrack(null);
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
        } else if (mouseAction.action === MOUSE_ACTION.BUILD_TRACK) {
            if (mouseAction.ankerPoints.length > 1) {
                let tmpPoint = mouseAction.ankerPoints[0];
                for (let i = 1; i < mouseAction.ankerPoints.length; i++) {
                    const p0 = mouseAction.ankerPoints[i - 1];
                    const p1 = mouseAction.ankerPoints[i];
                    const p2 = mouseAction.ankerPoints.length > i + 1 ? mouseAction.ankerPoints[i + 1] : null;
                    //steigung ändert sich, also track erstellen
                    if (!p2 || geometry.slope(p0, p1) != geometry.slope(p1, p2)) {
                        checkAndCreateTrack(tmpPoint, p1);
                        tmpPoint = p1;
                    }
                }
                connectTracks();
                renderer.reDrawEverything();

                save();
            }
            overlay_container.removeAllChildren();

            stage.update();
        }
    } else if (mouseAction.action === MOUSE_ACTION.SCROLL) {
        save();
    }

    stage.removeEventListener("stagemousemove", handleMouseMove);
}

function switch_A_Switch(sw, mouseAction) {
    if (!sw.type.is(SWITCH_TYPE.DKW)) {
        if (sw.branch == sw.t1) sw.branch = sw.t2;
        else sw.branch = sw.t1;
    } else {
        if (mouseAction.offset.x < sw.location.x) {
            if (sw.from == sw.t1) sw.from = sw.t2;
            else sw.from = sw.t1;
        } else {
            if (sw.branch == sw.t1) sw.branch = sw.t2;
            else sw.branch = sw.t1;
        }
    }

    renderer.reRenderSwitch(sw);
}

function selectTrack(container) {
    if (selectedTrack) {
        //selectedTrack.color.style = track_color;
        let c = track_container.children.find((c) => c.track == selectedTrack);
        if (c) c.shadow = null;
    }

    selectedTrack = container?.track;
    /* let box = new createjs.Shape();
    box.graphics.setStrokeStyle(1).beginStroke("#e00").drawRect(track.start.x-5, track.start.y-5,track.end.x-track.start.x +5 ,track.end.y-track.start.y + 5 );
    
    ui_container.addChild(box); */
    if (container) {
        //selectedTrack.color.style = "red";
        container.shadow = new createjs.Shadow("#ff0000", 0, 0, 5);
        console.log(selectedTrack);
    }
}

function deleteTrack(track, trackShape) {
    if (!track) track = trackShape.track;
    else trackShape = track_container.children.find((c) => c.track === track);

    track_container.removeChild(trackShape);

    tracks.remove(track);

    track.signals.forEach((s) => {
        let i = signal_container.children.findIndex((c) => c.signal === s.signal);
        if (i != -1) signal_container.removeChildAt(i);
    });

    track._tmp.switches.forEach((s) => {
        let i = s.track._tmp.switches.findIndex((sw) => sw.track === track);
        if (i >= 0) s.track._tmp.switches.splice(i, 1);
    });
}

function checkAndCreateTrack(start, end) {
    //liegt die track vollständig in einer anderen Track?
    if (tracks.some((track) => geometry.within(track.start, track.end, start) && geometry.within(track.start, track.end, end))) return;

    //sicherstellen, das Tracks immer von links nach rechts verlaufen
    if (start.x > end.x) {
        const hlp = start;
        start = end;
        end = hlp;
    }

    const slope = geometry.slope(start, end);

    //sucht alle tracks, deren start oder ende innerhalb der neue Track liegt und den gleichen Slope haben
    const filteredTracks = tracks.filter((track) => track._tmp.slope == slope && (geometry.within(start, end, track.start) || geometry.within(start, end, track.end)));
    if (filteredTracks.length == 0) createTrack(start, end);
    else {
        let track = filteredTracks[0];
        filteredTracks.forEach((t) => {
            if (t.start.x < start.x) start = t.start;
        });
        track.setNewStart(start);

        filteredTracks.forEach((t) => {
            if (t.end.x > end.x) end = t.end;
        });
        track.setNewEnd(end);

        for (let i = 1; i < filteredTracks.length; i++) {
            deleteTrack(filteredTracks[i]);
        }
    }
}

function detectSwitch(t1, t2, recursion = false) {
    if (deepEqual(t1.start, t2.start) || deepEqual(t1.end, t2.end)) return;

    let km_t1 = 0,
        km_t2 = 0,
        switch_type = SWITCH_TYPE.NONE,
        switch_location;

    if (t1._tmp.deg + t2._tmp.deg != 0) {
        if (deepEqual(t1.start, t2.end)) {
            switch_location = t1.start;
            switch_type = SWITCH_TYPE.ARCH;
        } else if (geometry.within(t1.start, t1.end, t2.start, true)) {
            switch_location = t2.start;
            switch_type = ((findAngle(switch_location, t2.end, t1.rad) / 45) % 8) + 1;
        } else if (geometry.within(t1.start, t1.end, t2.end, true)) {
            switch_location = t2.end;
            switch_type = ((findAngle(switch_location, t2.start, t1.rad) / 45) % 8) + 1;
        }

        if (switch_type == SWITCH_TYPE.NONE && !recursion) {
            if (detectSwitch(t2, t1, true)) return true;
        }
    }

    if (switch_type == SWITCH_TYPE.NONE) {
        switch_location = geometry.getIntersectionPoint(t1, t2);
        if (switch_location && !(deepEqual(switch_location, t2.start) || deepEqual(switch_location, t2.end) || deepEqual(switch_location, t1.start) || deepEqual(switch_location, t1.end))) {
            switch_type = t2._tmp.deg + t1._tmp.deg == 0 ? SWITCH_TYPE.CROSSING : SWITCH_TYPE.DKW;
        }
    }

    if (switch_type != SWITCH_TYPE.NONE) {
        km_t1 = geometry.distance(t1.start, switch_location);
        km_t2 = geometry.distance(t2.start, switch_location);

        const sw = {
            type: switch_type,
            location: switch_location,
        };

        //stellt sicher, das immer das durchgehende hauptgleis t1 ist
        if (deepEqual(switch_location, t1.start, t1.end)) {
            sw.t1 = t2;
            sw.t2 = t1;
        } else {
            sw.t1 = t1;
            sw.t2 = t2;
        }

        //stellt die Weiche standardmäßig ins Hauptgelis
        sw.branch = sw.t1;

        if (switch_type == SWITCH_TYPE.DKW) sw.from = sw.t1;

        switches.push(sw);

        t1.AddSwitch({
            km: km_t1,
            track: t2,
            type: switch_type,
            sw: sw,
        });
        t2.AddSwitch({
            km: km_t2,
            track: t1,
            type: switch_type,
            sw: sw,
        });

        return true;
    }
    return false;
}

function connectTracks() {
    tracks.forEach((track) => (track._tmp.switches = []));
    switches = [];
    for (let i = 0; i < tracks.length; i++) {
        const t1 = tracks[i];
        for (let j = i + 1; j < tracks.length; j++) {
            const t2 = tracks[j];
            if (t1._tmp.deg != t2._tmp.deg) detectSwitch(t1, t2);
        }
    }
}

function createTrack(p1, p2) {
    let track = new trackShape(p1, p2);
    renderer.renderTrack(track_container, track);
    tracks.push(track);
}

function replacer(key, value) {
    if (value != null && typeof value.stringify === "function") {
        return value.stringify();
    } else {
        if (EXCLUDE_JSON.includes(key)) return undefined;
        else return value;
    }
}

function getSaveString() {
    return JSON.stringify(
        {
            tracks: tracks,
            zoom: stage.scale,
            scrollX: stage.x,
            scrollY: stage.y,
        },
        replacer
    );
}

function save() {
    localStorage.setItem("bahnhof_last1", `0.16;${getSaveString()}`);
}

function loadRecent() {
    try {
        const x = localStorage.getItem("bahnhof_last1");
        if (x != null) {
            const indexOfFirst = x.indexOf(";");
            if (indexOfFirst > -1) {
                const loaded_version = parseFloat(x.substring(0, indexOfFirst));
                if (loaded_version >= 0.16) loadFromJson(x.slice(indexOfFirst + 1));
                else console.error(`stored version ${loaded_version} to old`);
            }
        }
    } catch (error) {
        console.error(error);
    }
}

function receiver(key, value) {
    if (key == "signal") return signalShape.FromObject(value);
    if (key == "tracks")
        return value.map((item) => {
            return trackShape.FromObject(item);
        });
    if (key == "features") return { map: new Map(JSON.parse(value)) };

    return value;
}

function loadFromJson(json) {
    let loaded = JSON.parse(json, receiver);
    stage.x = loaded.scrollX;
    stage.y = loaded.scrollY;
    stage.scale = loaded.zoom;
    tracks = loaded.tracks;
    connectTracks();
    drawGrid();
    renderer.reDrawEverything();
}

function newItemButton(template) {
    return $("<button>", { class: "newItem" })
        .css("background-image", "url(" + GetDataURL_FromTemplate(template) + ")")
        .attr("data-signal", template.id)
        .on("mousedown", (e) => {
            mouseAction = {
                action: MOUSE_ACTION.DND_SIGNAL,
                template: signalTemplates[e.target.attributes["data-signal"].value],
            };

            //mouseup beim document anmelden, weil mouseup im stage nicht ausgelöst wird, wenn mousedown nicht auch auf der stage war
            //little hack, weil handleStageMouseUp ein event von createjs erwartet
            document.addEventListener("mouseup", (e) => handleStageMouseUp({ nativeEvent: e }), {
                once: true,
            });

            stage.addEventListener("stagemousemove", handleMouseMove);

            startDragAndDropSignal(e.offsetX, e.offsetY);
        });
}

function GetDataURL_FromTemplate(template) {
    let signal = new signalShape(template);

    let c = $("<canvas>").attr({ width: 100, height: 100 });
    $(document.body).append(c);

    let s = new createjs.Stage(c[0]);
    signal.draw(s);
    let sig_bounds = s.getBounds();
    if (sig_bounds == null) throw Error(template.title + " has no visual Element visible");
    s.cache(sig_bounds.x, sig_bounds.y, sig_bounds.width, sig_bounds.height);
    let data_url = s.bitmapCache.getCacheDataURL();
    c.remove();
    return data_url;
}
