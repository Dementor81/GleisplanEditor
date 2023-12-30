"use strict";

class Signal {
    static FromObject(o) {
        let s = new Signal();

        s._template = signalTemplates[o._template];
        s._signalStellung = o._signalStellung;
        s._positioning = o._positioning;
        s.features.map = new Map(JSON.parse(o.features));
        return s;
    }

    _template = null;
    _signalStellung = {};
    _positioning = {
        track: null,
        km: 0,
        above: false,
        flipped: false,
    };

    stringify() {
        return {
            _class: "Signal",
            _template: this._template.id,
            _signalStellung: this._signalStellung,
            _positioning: {
                km: this._positioning.km,
                above: this._positioning.above,
                flipped: this._positioning.flipped,
            },
            features: this.features,
        };
    }

    //features saves how a signal is used (Asig,Esig etc) and if it supports things like Vorsignal or Verkürzte Bremswege
    //there are two types of features: single worded like "vr" or "verk"
    //and features which work es a group and are build out of 2 Words like "mastschild.wgwgw"
    features = {
        map: new Map(),
        set: function (o, value) {
            const splitted = o.split(".");
            if (splitted.length == 1) {
                if (value) this.map.set(o, true);
                else this.map.delete(o);
            } else if (splitted.length == 2) this.map.set(splitted[0], splitted[1]);
            else throw new Error();
        },
        match: function (condition) {
            if (condition == null || condition.length == 0) return true; // wenn das visualElement keine conditions fordert, ist es immer ein match
            const match_single = function (singleCondition) {
                const splitted = singleCondition.split(".");
                const antiMatch = splitted[0][0] == "!";
                let retValue;
                if (antiMatch) splitted[0] = splitted[0].substring(1);
                if (splitted.length == 1) retValue = this.map.has(splitted[0]);
                else if (splitted.length == 2) retValue = this.map.get(splitted[0]) == splitted[1];
                else throw new Error();

                return antiMatch ? !retValue : retValue;
            }.bind(this);
            if (Array.isArray(condition)) {
                return condition.find(match_single) != null;
            } else return match_single(condition);
        },
        stringify: function () {
            return JSON.stringify(Array.from(this.map.entries()));
        },
    };

    constructor(template) {
        if (template) {
            this._template = template;

            if (template.initialFeatures)
                if (Array.isArray(template.initialFeatures)) template.initialFeatures.forEach((i) => this.features.set(i, true));
                else this.features.set(template.initialFeatures);

            if (template.initialSignalStellung)
                if (Array.isArray(template.initialSignalStellung)) template.initialSignalStellung.forEach((i) => this.set(i));
                else this.set(template.initialSignalStellung);
        }
    }

    //Setzt die Signalstellung, 2 Möglichkeiten:
    //set("hp",0)
    //oder
    //set("hp=0")
    set(stellung, value) {
        let changed = false;
        /* const splitted = stellung.split("=");
        if (splitted.length == 2) {
            value = splitted[1];
            stellung = splitted[0];
        } */
        if (value == undefined) [stellung, value] = stellung.split("=");

        if (this.get(stellung) != value) {
            /* if (this.check(stellung)) delete this._signalStellung[stellung];
            else this._signalStellung[stellung] = value; */
            this._signalStellung[stellung] = value;
            changed = true;
        }

        //Signal is actual positioned at a track (e.g. When Signal is created, there isnt a track yet)
        //and the signal indication actualy changed
        if (this._positioning.track && changed) {
            if (this.features.match("hp")) {
                const prevSignal = this.search4Signal(DIRECTION.RIGHT_2_LEFT,"vr");
                if (prevSignal && prevSignal._template.checkSignalDependency) prevSignal._template.checkSignalDependency(prevSignal, this);
            }
            if (this.features.match("vr")) {
                const nextSignal = this.search4Signal(DIRECTION.LEFT_2_RIGTH,"hp");
                if (nextSignal && nextSignal.features.match("hp") && this._template.checkSignalDependency) this._template.checkSignalDependency(this, nextSignal);
            }
        }
    }

    get(stellung) {
        return this._signalStellung[stellung];
    }

    check(stellung) {
        if (stellung == null) return true;
        const splitted = stellung.split("=");
        return splitted.length == 1 || this._signalStellung[splitted[0]] == splitted[1];
    }

    draw(c) {
        this._rendering = { container: c };

        this._template.elements.forEach((ve) => this.drawVisualElement(ve));

        delete this._rendering;
    }

    drawVisualElement(ve) {
        if (ve instanceof TextElement) {
            var js_text = new createjs.Text(ve.getText(this), ve.format, ve.color);
            js_text.x = ve.pos[0];
            js_text.y = ve.pos[1];
            js_text.textAlign = "center";
            js_text.textBaseline = "top";
            js_text.lineHeight = 20;
            this._rendering.container.addChild(js_text);
        } else if (ve instanceof VisualElement) {
            if (this.features.match(ve.conditions) && this._template.VisualElementIsAllowed(ve, this) && ve.isEnabled(this))
                if (ve.image) {
                    if (Array.isArray(ve.image)) ve.image.forEach((i) => this.addImage(i, { blinkt: ve.blinkt, pos: ve.pos }));
                    else
                        this.addImage(ve.image, {
                            blinkt: ve.blinkt,
                            pos: ve.pos,
                        });
                } else if (ve.childs) {
                    ve.childs.forEach((c) => this.drawVisualElement(c));
                }
        } else console.log(ve);
    }

    addImage(texture_name, { pos = null, blinkt = false } = {}) {
        if (texture_name == null || texture_name == "") return;

        let bmp = pl.getSprite(this._template.json_file, texture_name);
        if (bmp != null) {
            if (pos) {
                bmp.x = pos[0];
                bmp.y = pos[1];
            }

            this._rendering.container.addChild(bmp);

            if (blinkt) {
                createjs.Tween.get(bmp, { loop: true }).wait(1000).to({ alpha: 0 }, 200).wait(800).to({ alpha: 1 }, 50);
            }

            return bmp;
        } else console.log(texture_name + " nicht gezeichnet");
    }

    getHTML() {
        const ul = $("<ul>", { class: "list-group list-group-flush" });

        //recursive function to retrieve alle switchable visual elements from the template
        const getSwitchableElements = function (array) {
            let a = [];
            array.forEach((visualElemets) => {
                if (this.features.match(visualElemets.conditions)) {
                    if (visualElemets.switchable) a.push(visualElemets);
                    if (visualElemets.childs) a = a.concat(getSwitchableElements(visualElemets.childs));
                }
            });

            return a;
        }.bind(this);

        const switchable_visuell_elements = getSwitchableElements(this._template.elements);

        const groups = new Map();

        switchable_visuell_elements.forEach((e) => {
            const s = e.stellung.split("=")[0];
            if (!groups.has(s)) groups.set(s, [e]);
            else groups.get(s).push(e);
        });

        groups.forEach((group) => {
            if (!(group[0] instanceof TextElement))
                ul.append($("<li>", { class: "list-group-item" }).append(ui.create_buttonGroup(group.map((e) => ui.create_toggleButton(e.btn_text, "", e.stellung, this)))));
            else ul.append($("<li>", { class: "list-group-item" }).append(ui.create_Input(group[0].btn_text, group[0].stellung, this)));
        });

        this.syncHTML(ul);
        return ul;
    }

    syncHTML(popup) {
        let buttons = $("button", popup);
        buttons.each((i, e) => {
            const stellung = e.attributes["data_signal"].value;
            $(e).toggleClass("active", this.check(stellung));

            if (this._template.StellungIsAllowed(stellung[0], this)) $(e).removeAttr("disabled");
            else $(e).attr("disabled", "disabled");
        });

        /* let switchable_visuell_elements = this._template.elements.filter((e) => e.switchable && this.options.match(e.options));
        switchable_visuell_elements.forEach(element => {
            let button = $("#btn_" + element.id, popup);
            if (button.length) {
                if (element.isEnabled(this)) {
                    button.addClass("active");
                    button.attr("aria-pressed", "true");
                }
                else {
                    button.attr("aria-pressed", "false");
                    button.removeClass("active");
                }
    
                if (element.isAllowed(this))
                    button.removeAttr('disabled');
                else
                    button.attr('disabled', 'disabled');
    
            }
        }); */
    }

    getContextMenu() {
        return this._template.contextMenu;
    }

    search4Signal(dir, feature) {
        
        let track = this._positioning.track;
        let index = track.signals.indexOf(this) + dir;
        let sw = null;

        while (track) {
            while (dir == 1 ? index < track.signals.length : index >= 0) {
                let nextSignal = track.signals[index];
                if (nextSignal.features.match(feature)) {
                    return nextSignal; //hauptsignal gefunden
                } else index = index + dir;
            }

            if ((sw = track._tmp.switches[dir == 1 ? 1 : 0])) {
                if (type(sw) == "Track") track = sw;
                else track = sw.branch; //TODO: hier muss noch mehr logik rein!

                index = track.signals.length - 1;
            } else track = null;
        }
    }
}
