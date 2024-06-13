"use strict";

class Signal {
    static FromObject(o) {
        let s = new Signal();

        s._template = signalTemplates[o._template];
        s._signalStellung = o._signalStellung;
        s._positioning = o._positioning;
        s._bezeichnung = o._bezeichnung;
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
    _bezeichnung = "";

    stringify() {
        return {
            _class: "Signal",
            _template: this._template.id,
            _signalStellung: this._signalStellung,
            _bezeichnung: this._bezeichnung,
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

            if (template.initialSignalStellung) template.initialSignalStellung.forEach((i) => this.set_stellung(i, null, false));
        }
    }

    //Setzt die Signalstellung, 2 Möglichkeiten:
    //set("zs3",60)
    //set("hp",1)
    //oder
    //set("hp=0")
    //set("ersatz=zs7")
    //set("hp=0,1") der Value hat vorrang vor dem in stellung enthaltenen Value
    //value=false schaltet die Signalstellung auf -1, also aus. Wird vom Menü zum ausschalten einer Signalstellung verwendet
    //chain=false verhindert, dass das Signal versucht das davor und dahinterliegende Signal zu informieren
    set_stellung(stellung, subkey, chain = true) {
        let changed = false;
        /* const splitted = stellung.split("=");
        if (splitted.length == 2) {
            value = splitted[1];
            stellung = splitted[0];
        } */
        if (subkey == undefined) [stellung, subkey] = stellung.split("=");
        else [stellung] = stellung.split("=");

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
                    if (!this.check(signal_aspect) && this.check(trigger)) this.set_stellung(signal_aspect);
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
        else if (equation.operator == "||") return this.check(equation.left) || this.check(equation.right);
        else {
            let data = this.get(equation.left);
            if (equation.operator == "=") return data == equation.right;
            else {
                equation.right = Number.parseInt(equation.right);
                if (equation.operator == "<") return data < equation.right;
                else if (equation.operator == "<=") return data <= equation.right;
                else if (equation.operator == ">=") return data >= equation.right;
                else if (equation.operator == ">") return data > equation.right;
                else if (equation.operator == "!=") return data != equation.right;
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

        const update = function (command, active) {
            this.set_stellung(command,active? -1 : undefined);
            renderer.reDrawEverything();
            this.checkBootstrapMenu(this._template.signalMenu, ul);
            save();
        };

        ul.append(this._template.signalMenu.map((data) => this.createBootstrapMenuItems(data, update)));

        this.syncHTML(ul);

        return ul;
    }

    setStellungFromUI(command, activ) {
        this.set_stellung(command);
        renderer.reDrawEverything();
        save();
    }

    createBootstrapMenuItems(data, update) {
        if (data) {
            if (Array.isArray(data)) {
                let items = data.map((item) => this.createBootstrapMenuItems(item, update)).justNull();
                if (items) {
                    let menu = BS.createListGroupItem(BS.create_buttonToolbar(items));
                    return menu;
                } else return null;
            } else if (data.btnGroup) {
                let buttons = data.items
                    .filter((mi) => mi.ve != null && mi.ve.length > 0 && mi.ve.every((ve) => this.features.match(ve.conditions)))
                    .map((item) => ui.create_toggleButton(item.text, item.setting).on("click", (e) => update.bind(this)(item.setting, $(e.target).hasClass("active"))))
                    .justNull();
                if (buttons) return ui.create_buttonGroup(buttons);
                else return null;
            } else if (data.input) {
                return Sig_UI.create_SpeedDropDown(data.setting, data.text).onValueChanged(update.bind(this));
            }
        }
    }

    checkBootstrapMenu(data, popup) {
        if (data) {
            if (Array.isArray(data)) {
                data.forEach((item) => this.checkBootstrapMenu(item, popup));
            } else if (data.btnGroup) {
                data.items.forEach((item) => {
                    let button = $("#btn_" + item.text.replace(" ", "_"), popup);
                    if (button.length == 1) {
                        button.toggleClass("active", this.check(item.setting));
                        if (item.ve.every((ve) => ve.isAllowed(this))) button.removeAttr("disabled");
                        else button.attr("disabled", "disabled");
                    }
                });
            } else if (data.input) {
                let button = $("#btn_" + data.text.replace(" ", "_"), popup);
                if (button.length == 1) {
                    const v = this.get(data.setting);
                    button.text(data.text + (v > 0 ? " Kz " + v : " aus"));
                }
            }
        }
    }

    syncHTML(popup) {
        this.checkBootstrapMenu(this._template.signalMenu, popup);
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

const Sig_UI = {
    create_zs3DropDownItems(stellung) {
        let a = [BS.create_DropDownItem("aus").attr("data_command", stellung + "=-1")];
        for (let i = 1; i <= 9; i++) {
            a.push(BS.create_DropDownItem(i + "0").attr("data_command", stellung + "=" + i));
        }
        return a;
    },
    create_SpeedDropDown(signal, text) {
        const dd = BS.create_DropDown(this.create_zs3DropDownItems(signal), text);
        dd.onValueChanged = function (f) {
            this._onValueChanged = f;
            return this;
        }.bind(dd);
        dd.on("hide.bs.dropdown", (e) => {
            if (e.clickEvent?.target && e.clickEvent?.target.nodeName == 'A' && dd._onValueChanged) {
                dd._onValueChanged($(e.clickEvent.target).attr("data_command"));
            }
        });

        return dd;

        return BS.create_buttonGroup([
            dd,
            /*  ui.create_toggleButtonX(this.lightBulb(), "btn_" + signal + "licht", () => {
                this._signalStellung[signal].licht = !this._signalStellung[signal].licht;
            }), */
        ]);
    },
};
