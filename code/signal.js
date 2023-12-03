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

            if (template.startOptions)
                if (Array.isArray(template.startOptions)) template.startOptions.forEach((i) => this.features.set(i));
                else this.features.set(template.startOptions);

            if (template.start)
                if (Array.isArray(template.start)) template.start.forEach((i) => this.set(i));
                else this.set(template.start);
        }
    }

    set(stellung, value) {
        const splitted = stellung.split("=");
        if (splitted.length == 1) this._signalStellung[splitted[0]] = value;
        else if (this.check(stellung)) delete this._signalStellung[splitted[0]];
        else this._signalStellung[splitted[0]] = splitted[1];
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

        this._rendering = null;
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

    getContectMenu() {
        return this._template.contextMenu;
    }

    search4NextSignal() {
        let index = this._positioning.track.signals.indexOf(this);
        if(index < this._positioning.track.signals.length-1){
            //check signal
        }
        else{
            //check next track
        }
        
        while (hp) {
        }



    }
}
