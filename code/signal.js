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
                if (Array.isArray(template.initialSignalStellung)) template.initialSignalStellung.forEach((i) => this.set_stellung(i));
                else this.set_stellung(template.initialSignalStellung);
        }
    }

    //Setzt die Signalstellung, 2 Möglichkeiten:
    //set("zs3",60)
    //oder
    //set("hp=0")
    //set("ersatz=zs7")
    set_stellung(stellung, subkey, value = true, chain = true) {
        let changed = false;
        /* const splitted = stellung.split("=");
        if (splitted.length == 2) {
            value = splitted[1];
            stellung = splitted[0];
        } */
        if (subkey == undefined) [stellung, subkey] = stellung.split("=");
        if (value) {
            if (this.get(stellung) != subkey) {
                /* if (this.check(stellung)) delete this._signalStellung[stellung];
            else this._signalStellung[stellung] = value; */

                if (!isNaN(subkey)) {
                    this._signalStellung[stellung] = Number(subkey);
                } else {
                    this._signalStellung[stellung] = subkey;
                }

                changed = true;
            }
        } else if (this._signalStellung[stellung] != null) {
            //delete this._signalStellung[stellung];
            this._signalStellung[stellung] = -1;
            changed = true;
        }

        //Signal is actual positioned at a track (e.g. When Signal is created, there isnt a track yet)
        //and the signal indication actualy changed
        if (this._positioning.track && changed && chain) {
            let stop = false;
            if (this.features.match(["hp", "master"])) {
                let prevSignal = this;
                do {
                    prevSignal = this.search4Signal(prevSignal, DIRECTION.RIGHT_2_LEFT);
                    if (prevSignal && prevSignal._template.checkSignalDependency) stop = prevSignal._template.checkSignalDependency(prevSignal, this, ["vr", "slave"]);
                } while (!stop && prevSignal);
            }
            if (this.features.match(["vr", "slave"]) && this._template.checkSignalDependency) {
                let nextSignal = this;
                do {
                    nextSignal = this.search4Signal(nextSignal, DIRECTION.LEFT_2_RIGTH);
                    if (nextSignal && nextSignal._template.checkSignalDependency) stop = nextSignal._template.checkSignalDependency(this, nextSignal, ["hp", "master"]);
                } while (!stop && nextSignal);
            }
        }

        if (changed)
            this._template.rules.forEach(
                function (rule) {
                    let trigger = rule[0];
                    let signal_aspect = rule[1];
                    if (this.check(trigger)) this.set_stellung(signal_aspect);
                }.bind(this)
            );
    }

    //get value for a specific Stellung
    //e.g. get("hp") returns 0 for Hp 0
    //can be used like this: get("hp") > 0
    get(stellung) {
        let value = this._signalStellung[stellung];
        if (value != undefined) return value;
        else return -1;
    }

    //checks if a specific Stellung is set
    //e.g. get("hp=0") returns true for Hp 0
    check(stellung) {
        if (stellung == null) return true;

        const equation = splitEquation(stellung);

        if (equation.operator == "&&") return this.check(equation.left) && this.check(equation.right);
        else {
            let data = this.get(equation.left);
            if (equation.operator == "=") return data == equation.right;
            else {
                equation.right = Number.parseInt(equation.right);
                if (equation.operator == "<") return data < equation.right;
                else if (equation.operator == "<=") return data <= equation.right;
                else if (equation.operator == ">=") return data >= equation.right;
                else if (equation.operator == ">") return data > equation.right;
            }
        }
    }

    draw(c) {
        this._rendering = { container: c };

        this._template.elements.forEach((ve) => this.drawVisualElement(ve));

        delete this._rendering;
    }

    drawVisualElement(ve) {
        if (Array.isArray(ve)) ve.forEach((e) => this.drawVisualElement(e));
        else if (typeof ve == "string") {
            this.addImageElement(ve);
        } else if (ve instanceof TextElement) {
            if (!ve.pos) throw new Error("TextElement doesnt have a pos");
            var js_text = new createjs.Text(ve.getText(this), ve.format, ve.color);
            js_text.x = ve.pos[0];
            js_text.y = ve.pos[1];
            js_text.textAlign = "center";
            js_text.textBaseline = "top";
            js_text.lineHeight = 20;
            this._rendering.container.addChild(js_text);
        } else if (ve instanceof VisualElement) {
            if (this.features.match(ve.conditions))
                if (ve.isAllowed(this) && ve.isEnabled(this)) {
                    if (ve.childs) {
                        for (let index = 0; index < ve.childs.length; index++) {
                            const c = ve.childs[index];
                            this.drawVisualElement(c);
                        }
                    }
                    if (ve.image) {
                        this.addImageElement(ve, ve.blinkt);
                    }
                }
        } else console.log("unknown type of VisualElement: " + ve);
        return false;
    }

    addImageElement(ve, blinkt = false) {
        const textureName = typeof ve == "string" ? ve : ve.image;

        if (textureName == null || textureName == "") return;

        if (textureName.includes(",", 1)) textureName.split(",").forEach((x) => this.addImageElement(x));
        else {
            if (!this._rendering.container.getChildByName(textureName)) {
                //check if this texture was already drawn. Some texture are the same for different signals like Zs1 and Zs8
                let bmp = pl.getSprite(this._template.json_file, textureName);
                if (bmp != null) {
                    this._rendering.container.addChild(bmp);

                    if (blinkt) {
                        createjs.Tween.get(bmp, { loop: true }).wait(1000).to({ alpha: 0 }, 200).wait(800).to({ alpha: 1 }, 50);
                    }

                    return bmp;
                } else console.log(textureName + " nicht gezeichnet, da sprite für " + textureName + " nicht erstellt wurde");
            }
        }
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
            const s = (e.stellung ? e.stellung : e.childs[0].stellung).split("=")[0];
            if (!groups.has(s)) groups.set(s, [e]);
            else groups.get(s).push(e);
        });

        groups.forEach((group) => {
            if (!(group[0] instanceof TextElement))
                ul.append(
                    $("<li>", { class: "list-group-item" }).append(
                        ui.create_buttonGroup(group.map((e) => ui.create_toggleButton(e.btn_text, "", e.stellung ? e.stellung : e.childs[0].stellung, this)))
                    )
                );
            else ul.append($("<li>", { class: "list-group-item" }).append(ui.create_Input(group[0].btn_text, group[0].stellung, this)));
        });

        this.syncHTML(ul);
        return ul;
    }

    getHTML2() {
        const ul = $("<ul>", { class: "list-group list-group-flush" });

        this._template.signalMenu.forEach((group) => {
            ul.append($("<li>", { class: "list-group-item" }).append(ui.create_buttonGroup(group.map((item) => ui.create_toggleButton(item.text, null, item.setting, this)))));
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

    search4Signal(signal, dir, feature) {
        if (signal._positioning.above != signal._positioning.flipped) dir *= -1;

        let track = signal._positioning.track;
        let index = track.signals.indexOf(signal) + dir;
        let sw = null;

        //function checks, if this signal and the given signal belong together
        /* above flipped above flipped result
        0   	0	    0   	0   	1
        0	    1	    0   	0   	0
        0   	0   	0   	1   	0
        0   	1	    0   	1	    1
        1   	0   	0   	0   	0
        0   	0   	1   	0   	0
        1   	0   	1   	0   	1
        0   	0   	1	    1   	1
        1   	1   	0	    0	    1
        0   	1   	1	    0   	1
        1   	0   	0   	1	    1
        1   	1   	1   	0   	0
        0   	1	    1   	1	    0
        1   	1	    1   	1	    1 
        the hack is, that wehen all above and flipped are added, the number is even if they belong together*/
        const check = function (pos) {
            return (Number(signal._positioning.above) + Number(signal._positioning.flipped) + Number(pos.flipped) + Number(pos.above)) % 2 == 0;
        };

        const getTrackAtBranch = function (sw, track) {
            if (track == sw.from) return sw.branch;
            if (track == sw.branch) return sw.from;

            return null;
        };

        while (track) {
            while (dir == 1 ? index >= 0 && index < track.signals.length : index >= 0) {
                let nextSignal = track.signals[index];
                if (nextSignal.features.match(feature) && check(nextSignal._positioning)) {
                    return nextSignal; //hauptsignal gefunden
                } else index = index + dir;
            }

            if ((sw = track._tmp.switches[dir == 1 ? 1 : 0])) {
                if (type(sw) == "Track") track = sw;
                else track = getTrackAtBranch(sw, track); //TODO: hier muss noch mehr logik rein!

                if (track) {
                    index = track.signals.length - 1;
                    if (dir == DIRECTION.LEFT_2_RIGTH) index = Math.min(0, index);
                }
            } else track = null;
        }
    }
}
