"use strict";

//Signals are build of Visual elements. Some elements are always been drawn, like the "Mast", others have a varianty of
//conditions.
//1st: a VE has conditions, these must match with the Signals features. e.g.: sh1 are only on Zsig and Asig
//2nd: the visual elemnt must be enabled.
class VisualElement {
    #_blinkt = null;
    #_image = null;
    #_pos = 0;
    #_btn_text = "";
    #_conditions = null;
    #_enabled = null;
    #_stellung = [];
    #_off = null;
    #_childs = null;

    constructor(image, { btn_text = null, blinkt = false, pos = null, enabled = null, conditions: conditions = [], stellung = null, off = null, childs = null } = {}) {
        this.#_blinkt = blinkt;
        this.#_btn_text = btn_text;
        this.#_pos = pos;
        this.#_image = image;
        this.#_conditions = conditions;
        this.#_enabled = enabled;
        this.#_stellung = stellung;
        this.#_off = off;
        this.#_childs = childs;
    }

    get [Symbol.toStringTag]() {
        return this.#_image;
    }

    get switchable() {
        return this.#_btn_text != null;
    }

    get blinkt() {
        return this.#_blinkt;
    }
    set blinkt(v) {
        this.#_blinkt = v;
    }

    get image() {
        return this.#_image;
    }
    set image(v) {
        this.#_image = v;
    }

    get btn_text() {
        return this.#_btn_text;
    }
    get conditions() {
        return this.#_conditions;
    }
    get stellung() {
        return this.#_stellung;
    }
    get off() {
        return this.#_off;
    }
    get childs() {
        return this.#_childs;
    }

    get pos() {
        return this.#_pos;
    }
    set pos(v) {
        this.#_pos = v;
    }

    //visual elements are enabled if the enabled function returns true and the signalstellung is set on the signal
    //if both are not set, its always enabled
    isEnabled(signal) {
        return (this.#_enabled == null || this.#_enabled(signal)) && signal.check(this.#_stellung);
    }

    isAllowed(signal) {
        return this.off == null || !signal.check(this.off);
    }

    /*     disableAllOther = (s, gruppe) => s._template.elements.forEach((e) => { if (e.gruppe === gruppe) e.disable(s) });
    
        isEnabled(signal) {
            if (this.switchable)
                return signal._signalStellung[this.#_id] === true;
            else if (typeof this.#_enabled == "boolean")
                return this.#_enabled;
            else if (typeof this.#_enabled == "function")
                return this.#_enabled(signal);
            else
                return undefined;
        }
    
        isAllowed(signal) {
            if (!signal.conditions.match(this.#_options)) return false;
    
            if (typeof this.#_allowed == "function")
                return this.#_allowed(signal);
            else
                return true;
        }
    
        enable = (s) => {
            if (this.#_enabled == null) {
                if (this.#_gruppe != 0) this.disableAllOther(s, this.#_gruppe)
                s._signalStellung[this.#_id] = true;
            }
            else
                throw "not allowed to set this signalstellung";
        };
    
        disable = (s) => {
            if (this.#_enabled == null)
                s._signalStellung[this.#_id] = false;
            else
                throw "not allowed to set this signalstellung";
        };
    
        toggle = (s) => {
            this.isEnabled(s) ? this.disable(s) : this.enable(s);
        }; */
}

class TextElement extends VisualElement {
    #_format = "";
    #_color = "#000";

    constructor({ format = "bold 20px Arial", color = "#333" } = {}) {
        super(null, arguments[0]);
        this.#_format = format;
        this.#_color = color;
    }

    get format() {
        return this.#_format;
    }
    get color() {
        return this.#_color;
    }

    getText = (s) => s._signalStellung[this.stellung];
    //setText = (s, text) => s._signalStellung[this.id] = text;
}

class SignalTemplate {
    #_id = null;
    #_title = null;
    #_start = null;
    #_json_file = null;
    #_scale = 0.4;

    contextMenu = [];
    visualElements = [];
    //rules = new Map();

    get id() {
        return this.#_id;
    }
    get title() {
        return this.#_title;
    }
    get initialSignalStellung() {
        return this.#_start;
    }
    get json_file() {
        return this.#_json_file;
    }
    get scale() {
        return this.#_scale;
    }
    set scale(v) {
        this.#_scale = v;
    }

    constructor(id, title, json_file, startElements, initialSignalStellung) {
        this.#_id = id;
        this.#_title = title;
        this.#_start = initialSignalStellung;
        this.#_json_file = json_file;

        this.elements = [];

        const intStartElements = (element) => {
            this.add(element);
            /* if (typeof element == "string") this.add(new VisualElement(element));
            else this.add(element); */
        };

        if (startElements) {
            if (Array.isArray(startElements))
                startElements.forEach((element) => {
                    intStartElements(element);
                });
            else intStartElements(startElements);
        }

        pl.addSpriteSheet(this.#_id, json_file);
    }

    add(element) {
        this.elements.push(element);
    }

    addRule(key, rule) {
        this.rules.set(key, rule);
    }

    StellungIsAllowed(stellung, signal) {
        /* const rule = this.rules.get(stellung);
        if (rule) return rule(signal);
        else return true; */
        return true;
    }

    VisualElementIsAllowed(element, signal) {
        //return element.stellung == null || this.StellungIsAllowed(element.stellung[0], signal);
        return true;
    }
    stringify() {
        return this.id;
    }
}

function initSignals() {
    const settingsMenu = {
        Verwendung: {
            text: "Verwendung",
            childs: [
                { text: "Esig", option: "verwendung.esig" },
                { text: "Asig", option: "verwendung.asig" },
                { text: "Zsig", option: "verwendung.zsig" },
                { text: "Bksig", option: "verwendung.bksig" },
                { text: "Sbk", option: "verwendung.sbk" },
            ],
        },
        Vorsignal: { text: "Vorsignalfunktion", option: "vr" },
        verkürzt: { text: "verkürzt", option: "verk" },
        wiederholer: { text: "Wiederholer", option: "wdh" },
        Mastschild: {
            text: "Mastschild",
            childs: [
                { text: "weiß-rot-weiß", option: "mastschild.wrw" },
                { text: "weiß-gelb-weiß-gelb-weiß", option: "mastschild.wgwgw" },
            ],
        },
    };

    const lightMenu = [
        [
            { text: "Hp 0", setting: "hp=0" },
            { text: "Hp 1", setting: "hp=1" },
            { text: "Hp 2", setting: "hp=2" },
        ],
        [
            { text: "Vr 0", setting: "vr=0" },
            { text: "Vr 1", setting: "vr=1" },
            { text: "Vr 2", setting: "vr=2" },
        ],
        [
            { text: "Zs 1", setting: "ersatz=zs1" },
            { text: "Zs 7", setting: "ersatz=zs7" },
            { text: "Zs 8", setting: "ersatz=zs8" },
            { text: "Sh 1", setting: "ersatz=sh1" },
            { text: "Kennlicht", setting: "ersatz=kennlicht" },
        ],
    ];

    const verw_strecke = ["verwendung.bksig", "verwendung.sbk", "verwendung.esig"];
    const verw_bahnhof = ["verwendung.asig", "verwendung.zsig"];

    const checkSignalDependencyFunction4HV = function (signal, hp) {
        if (signal.get("vr") != -2) {
            //-2 heißt, die Vorsignalfunktion ist vom User ausgeschaltet
            if (!signal.features.match("hp") || signal.get("hp") != 0) {
                //Das Hauptsignal leuchtet oder es ist ein alleinstehndes Vorsignal
                switch (hp._template.id) {
                    case "Hv77":
                    case "hv_hp":
                    case "hv_vr":
                        {
                            signal.set_stellung("vr", hp.get("hp") >= 0 ? hp.get("hp") : 0, true, false);
                            if (!signal.features.match("wdh")) return true;
                        }
                        break;
                    case "Hl":
                    case "ks_hp":
                    case "ks_vr":
                        {
                            signal.set_stellung("vr", hp.get("hp") <= 0 ? 0 : 1, false);
                            if (!signal.features.match("wdh")) return true;
                        }
                        break;

                    default:
                        throw hp._template.id + " unbekannt";
                }

                /* if (hp._signalStellung.zs3.v == 40) {
                this._signalStellung.zs3v.v = 0;
                if (this._signalStellung.vr > 0) this._signalStellung.vr = 2;
            } else this._signalStellung.zs3v.v = hp._signalStellung.zs3.v; */
            }
        }

        return false;
    };

    let t = new SignalTemplate(
        "hv_hp",
        "Hv Hauptsignal",
        "hv",
        [
            "mast,schild,hp_schirm",
            new VisualElement("wrw", { conditions: "mastschild.wrw" }),

            new VisualElement("hp_asig_lichtp", { conditions: verw_bahnhof }),
            new VisualElement("hp_bk_lichtp_unten", { conditions: verw_strecke }),
            new VisualElement("hp_bk_lichtp_oben", { conditions: verw_strecke.without("verwendung.sbk") }),

            //new VisualElement("wgwgw", { conditions: "mastschild.wgwgw" }),

            new VisualElement(null, {
                stellung: "hp=0",
                childs: [
                    new VisualElement("hp_asig_rot_re", { conditions: verw_bahnhof, off: "ersatz=sh1" }),
                    new VisualElement("hp_asig_rot_li", { conditions: verw_bahnhof }),
                    new VisualElement("hp_bk_rot_unten_li", { conditions: verw_strecke }),
                ],
            }),
            new VisualElement(null, {
                stellung: "hp=1",
                childs: [
                    new VisualElement("hp_asig_gr", { conditions: verw_bahnhof }),
                    new VisualElement("hp_bk_gr_unten_re", { conditions: "verwendung.sbk" }),
                    new VisualElement("hp_bk_gr_oben_re", { conditions: verw_strecke.without("verwendung.sbk") }),
                ],
            }),
            new VisualElement(null, {
                stellung: "hp=2",
                childs: [
                    new VisualElement("hp_asig_gelb,hp_asig_gr", { conditions: verw_bahnhof }),
                    new VisualElement("hp_bk_gelb_unten_re,hp_bk_gr_oben_re", { conditions: verw_strecke.without("verwendung.sbk") }),
                ],
            }),
            new VisualElement("hp_asig_schuten", { conditions: verw_bahnhof }),
            new VisualElement("hp_bk_schute_unten", { conditions: verw_strecke }),
            new VisualElement("hp_bk_schute_oben", { conditions: verw_strecke.without("verwendung.sbk") }),

            new VisualElement(null, {
                childs: [
                    "vr_schirm",
                    "vr_lichtp",
                    new VisualElement("vr_zusatz_schirm,vr_zusatz_lichtp", { conditions: "verk" }),
                    new VisualElement("vr_zusatz_licht", { btn_text: "Verkürzt", conditions: "verk", stellung: "hp>0" }),
                    new VisualElement(null, {
                        childs: [
                            new VisualElement("vr_gelb_oben,vr_gelb_unten", { btn_text: "Vr 0", stellung: "vr=0" }),
                            new VisualElement("vr_grün_oben,vr_grün_unten", { btn_text: "Vr 1", stellung: "vr=1" }),
                            new VisualElement("vr_gelb_unten,vr_grün_oben", { btn_text: "Vr 2", stellung: "vr=2" }),
                        ],
                        off: "hp<=0",
                    }),
                    "vr_schuten",
                    new VisualElement("vr_zusatz_schute", { conditions: "verk" }),
                ],
                conditions: "vr",
            }),

            new VisualElement(null, {
                childs: ["hp_asig_kennlicht_lichtp", new VisualElement("hp_asig_kennlicht_licht", { btn_text: "Kennlicht", stellung: "ersatz=kennlicht", off: "hp>=0" }), "hp_asig_kennlicht_schute"],
                conditions: verw_bahnhof,
            }),

            new VisualElement(null, {
                childs: ["hp_asig_sh1_lichtp", new VisualElement("hp_asig_sh1_licht", { btn_text: "Sh 1", stellung: "ersatz=sh1", off: "hp>0" }), "hp_asig_sh1_schute"],
                conditions: verw_bahnhof,
            }),

            new VisualElement(null, {
                childs: ["hp_zs1_lichtp", new VisualElement("hp_zs1_licht", { btn_text: "Zs 1", stellung: "ersatz=zs1", off: "hp>0" }), "hp_zs1_schuten"],
                conditions: ["verwendung.asig", "verwendung.sbk"],
            }),

            new VisualElement(null, {
                childs: ["hp_zs1_lichtp", new VisualElement("hp_zs1_licht", { btn_text: "Zs 8", stellung: "ersatz=zs8", off: "hp>0" , blinkt:true }), "hp_zs1_schuten"],
                conditions: ["verwendung.asig", "verwendung.bksig"],
            }),

            new VisualElement(null, {
                childs: ["hp_zs7_lichtp", new VisualElement("hp_zs7_licht", { btn_text: "Zs 7", stellung: "ersatz=zs7", off: "hp>0" }), "hp_zs7_schuten"],
                conditions: ["verwendung.esig", "verwendung.zsig"],
            }),
        ],
        ["hp=0", "vr=0"]
    );
    t.scale = 0.05;
    t.checkSignalDependency = checkSignalDependencyFunction4HV;
    t.initialFeatures = ["hp", "verwendung.asig", "mastschild.wrw"];
    t.contextMenu = [].concat(settingsMenu.Verwendung, settingsMenu.Mastschild, settingsMenu.Vorsignal, settingsMenu.verkürzt);
    t.signalMenu = lightMenu;
    signalTemplates.hv_hp = t;

    //HV Vorsignal
    /* t = new SignalTemplate(
        "hv_vr",
        "Hv Vorsignal",
        "hv",
        [
            "basis",
            "vr",
            new VisualElement("ne2", { conditions: "!wdh" }),
            new VisualElement(null, {
                childs: [
                    new VisualElement("vr0", { btn_text: "Vr 0", stellung: "vr=0" }),
                    new VisualElement("vr1", { btn_text: "Vr 1", stellung: "vr=1" }),
                    new VisualElement("vr2", { btn_text: "Vr 2", stellung: "vr=2" }),
                ],
            }),
            new VisualElement("verk", { conditions: ["verk", "wdh"] }),
            new VisualElement("verk_licht", { btn_text: "Verkürzt", conditions: "verk", stellung: "verk=1" }),
            new VisualElement("verk_licht", { conditions: "wdh" }),
        ],
        "vr=0"
    );
    t.scale = 0.05;
    t.checkSignalDependency = checkSignalDependencyFunction4HV;
    t.initialFeatures = ["vr"];
    t.contextMenu = [].concat(menu.verkürzt, menu.wiederholer);
    signalTemplates.hv_vr = t;

    //KS Hauptsignal
    t = new SignalTemplate(
        "ks_hp",
        "Ks Hauptsignal",
        "ks",
        [
            "basis",
            "aus_hp",
            "wrw",
            new VisualElement("aus_ks1ks2", { conditions: "vr" }),
            new VisualElement("wrw_gelb", { conditions: "vr" }),
            new VisualElement("hp0", { btn_text: "Hp 0", stellung: "hp=0" }),
            new VisualElement(null, {
                btn_text: "Ks 1",
                stellung: "hp=1",
                childs: [new VisualElement("ks1", { pos: [6, 55], conditions: "vr" }), new VisualElement("ks1", { conditions: "!vr" })],
            }),
            new VisualElement("ks2", { btn_text: "Ks 2", conditions: "vr", stellung: "hp=2" }),
            new VisualElement("zs1", { btn_text: "Zs 1", stellung: "ersatz=zs1", conditions: verw_bahnhof, enabled: (s) => s.get("hp") == 0 || s.get("hp") == null, blinkt: true }),
            new VisualElement("sh1", { btn_text: "Sh 1", stellung: "ersatz=sh1", enabled: (s) => s.get("hp") == 0 || s.get("hp") == null }),
            new VisualElement("verk", { btn_text: "Verkürzt", conditions: "verk", stellung: "verk=1", enabled: (s) => s.get("hp") == 2 }),
        ],
        "hp=0"
    );

    t.initialFeatures = ["verwendung.asig"];
    t.contextMenu = [].concat(menu.Verwendung, menu.Vorsignal, menu.verkürzt);
    signalTemplates.ks_hp = t;

    //Ks Vorsignal
    signalTemplates.ks_vr = new SignalTemplate(
        "ks_vr",
        "Ks Vorsignal",
        "ks",
        [
            "basis",
            new VisualElement("ne2", { conditions: "!wdh" }),
            new VisualElement("ks1", { btn_text: "Ks 1", pos: [6, 60], stellung: "hp=1" }),
            new VisualElement("ks2", { btn_text: "Ks 2", pos: [21, 60], stellung: "hp=2" }),
            new VisualElement("verk", { btn_text: "Verkürzt", conditions: "!wdh", pos: [7, 48], stellung: "verk=1", enabled: (s) => s.get("hp") == 2 }),
            new VisualElement("verk", { pos: [7, 85], conditions: "wdh", enabled: (s) => s.check("hp=2") }),
        ],
        "hp=2"
    );
    signalTemplates.ks_vr.contextMenu = [].concat(menu.wiederholer); */

    //ne4
    signalTemplates.ne4 = new SignalTemplate("ne4", "Ne 4", "basic", [new VisualElement("ne4_g", { conditions: "bauart.groß" }), new VisualElement("ne4_k", { conditions: "bauart.klein" })]);
    signalTemplates.ne4.contextMenu = [
        {
            text: "Bauart",
            childs: [
                { text: "Groß", option: "bauart.groß" },
                { text: "klein", option: "bauart.klein" },
            ],
        },
    ];
    signalTemplates.ne4.initialFeatures = ["bauart.groß"];

    signalTemplates.ne1 = new SignalTemplate("ne1", "Ne 1", "basic", "ne1");

    signalTemplates.lf6 = new SignalTemplate("lf6", "Lf 6", "basic", ["lf6", new TextElement({ pos: [30, 8], format: "bold 30px Arial", btn_text: "Kennziffer", stellung: "geschw" })], "geschw=9");
    signalTemplates.lf6.initialFeatures = ["slave"];

    signalTemplates.lf7 = new SignalTemplate("lf7", "Lf 7", "basic", ["lf7", new TextElement({ pos: [20, 10], format: "bold 40px Arial", btn_text: "Kennziffer", stellung: "geschw" })], "geschw=6");
    signalTemplates.lf7.initialFeatures = ["master"];

    signalTemplates.zs3 = new SignalTemplate(
        "zs3",
        "Zs 3 (alleinst.)",
        "basic",
        ["Zs3_Form", new TextElement({ pos: [30, 25], format: "bold 25px Arial", color: "#eee", btn_text: "Kennziffer", stellung: "geschw" })],
        "geschw=8"
    );
}
