'use strict';

class VisualElement {
    #_blinkt = null;
    #_image = null;
    #_pos = 0;
    #_btn_text = "";
    #_options = null;
    #_enabled = null;
    #_stellung = [];
    #_childs = null;

    constructor(image, { btn_text = null, blinkt = false, pos = null, enabled = null, options = [], stellung = null, childs = null } = {}) {
        this.#_blinkt = blinkt;
        this.#_btn_text = btn_text;
        this.#_pos = pos;
        this.#_image = image;
        this.#_options = options;
        this.#_enabled = enabled;
        this.#_stellung = stellung;
        this.#_childs = childs;
    }

    get switchable() {
        return this.#_btn_text != null;
    }

    get blinkt() { return this.#_blinkt; }
    set blinkt(v) { this.#_blinkt = v; }

    get image() { return this.#_image; }
    set image(v) { this.#_image = v; }

    get btn_text() { return this.#_btn_text; }
    get options() { return this.#_options; }
    get stellung() { return this.#_stellung; }
    get childs() { return this.#_childs; }

    get pos() { return this.#_pos; }
    set pos(v) { this.#_pos = v; }

    isEnabled(signal) {
        /* if (this.#_enabled) return this.#_enabled(signal);
        if (!this.switchable) return true; */

        return (this.#_enabled == null || this.#_enabled(signal)) && signal.check(this.#_stellung);
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
            if (!signal.options.match(this.#_options)) return false;
    
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
        this.#_format = format
        this.#_color = color;
    }

    get format() { return this.#_format; }
    get color() { return this.#_color; }


    getText = s => "8";
    //setText = (s, text) => s._signalStellung[this.id] = text;
}

class SignalTemplate {
    #_id = null;
    #_title = null;
    #_start = null;
    #_json_file = null;
    #_scale = null;

    contextMenu = [];
    visualElements = [];
    rules = new Map();

    get id() {
        return this.#_id;
    }

    get title() {
        return this.#_title;
    }

    get start() {
        return this.#_start;
    }

    get json_file() {
        return this.#_json_file;
    }

    get scale() {
        return this.#_scale;
    }

    constructor(id, title, json_file, startElements, start, scale = 0.4) {
        this.#_id = id;
        this.#_title = title;
        this.#_start = start;
        this.#_json_file = json_file;
        this.#_scale = scale;

        this.elements = [];
        if (startElements) {
            if (Array.isArray(startElements))
                startElements.forEach(element => {
                    this.add(new VisualElement(element));
                });
            else
                this.add(new VisualElement(startElements));
        }

        pl.add(this.#_id, json_file);
    }

    add(element) {
        this.elements.push(element);
    }

    addRule(key, rule) {
        this.rules.set(key, rule);
    }

    VisualElementIsAllowed(element, signal) {
        return element.stellung == null || this.StellungIsAllowed(element.stellung[0], signal);
    }

    StellungIsAllowed(stellung, signal) {
        const rule = this.rules.get(stellung);
        if (rule)
            return rule(signal);
        else return true
    }

    stringify() {
        return this.id;
    }

}

function initSignals() {

    const menu = {
        Verwendung: {
            text: "Verwendung", childs: [
                { text: "Esig", option: "verwendung.esig" },
                { text: "Asig", option: "verwendung.asig" },
                { text: "Zsig", option: "verwendung.zsig" },
                { text: "Bksig", option: "verwendung.bksig" },
                { text: "Sbk", option: "verwendung.sbk" },
            ]
        },
        Vorsignal: { text: "Vorsignalfunktion", option: "vr" },
        verkürzt: { text: "verkürzt", option: "verk" },
        wiederholer: { text: "Wiederholer", option: "wdh" },
        Mastschild: {
            text: "Mastschild", childs: [
                { text: "weiß-rot-weiß", option: "mastschild.wrw" },
                { text: "weiß-gelb-weiß-gelb-weiß", option: "mastschild.wgwgw" },

            ]
        }
    }

    let t = new SignalTemplate("hv_hp", "Hv Hauptsignal", "hv", [
        "basis",
        "hp",
        "zs1_schirm",
        "schild",
    ], [["hp", 0], ["vr", 0]], 0.07);

    const verw_strecke = ["verwendung.bksig", "verwendung.sbk", "verwendung.esig"];
    const verw_bahnhof = ["verwendung.asig", "verwendung.zsig"];

    t.add(new VisualElement("vr", { options: "vr" }));
    t.add(new VisualElement("wrw", { options: "mastschild.wrw" }));
    t.add(new VisualElement("wgwgw", { options: "mastschild.wgwgw" }));
    t.add(new VisualElement("asig", { options: verw_bahnhof }));
    t.add(new VisualElement("sh1_aus", { options: verw_bahnhof }));
    t.add(new VisualElement("esig", { options: verw_strecke.remove("verwendung.sbk") }));
    t.add(new VisualElement("sbk", { options: verw_strecke }));

    t.add(new VisualElement(null, {
        btn_text: "Hp 0", stellung: ["hp", 0], childs: [
            new VisualElement("asig_hp0", { options: verw_bahnhof }),
            new VisualElement("hp0", { options: verw_strecke })
        ]
    }));

    t.add(new VisualElement("hp00", { options: verw_bahnhof, enabled: s => s.get("ersatz") != "sh1" && s.get("hp") <= 0 }));

    t.add(new VisualElement(null, {
        btn_text: "Hp 1", stellung: ["hp", 1], childs: [
            new VisualElement("asig_hp1", { options: verw_bahnhof }),
            new VisualElement("esig_hp1", { options: verw_strecke.remove("verwendung.sbk") }),
            new VisualElement("sbk_hp1", { options: "verwendung.sbk" })
        ]
    }));

    t.add(new VisualElement(null, {
        btn_text: "Hp 2", stellung: ["hp", 2], childs: [
            new VisualElement(["asig_hp1", "asig_hp2"], { options: verw_bahnhof }),
            new VisualElement(["esig_hp1", "esig_hp2"], { options: verw_strecke.remove("verwendung.sbk") })
        ]
    }));
    t.add(new VisualElement(null, {
        childs: [
            new VisualElement("vr0", { btn_text: "Vr 0", stellung: ["vr", 0] }),
            new VisualElement("vr1", { btn_text: "Vr 1", stellung: ["vr", 1] }),
            new VisualElement("vr2", { btn_text: "Vr 2", stellung: ["vr", 2] })
        ], options: "vr"
        , enabled: s => s.get("hp") > 0
    }));

    t.add(new VisualElement("verk", { options: "verk" }));
    t.add(new VisualElement("verk_licht", { btn_text: "Verkürzt", options: "verk", stellung: ["verk", 1], enabled: (s) => s.get("hp") > 0 }));

    t.add(new VisualElement(null, {
        childs: [
            new VisualElement("zs1", { btn_text: "Zs 1", stellung: ["ersatz", "zs1"] }),
            new VisualElement("sh1", { btn_text: "Sh 1", options: verw_bahnhof, stellung: ["ersatz", "sh1"] })
        ]
        , enabled: s => s.get("hp") == 0 || s.get("hp") == null
    }));

    t.startOptions = ["verwendung.asig", "mastschild.wrw"];
    t.contextMenu = [].concat(menu.Verwendung, menu.Mastschild, menu.Vorsignal, menu.verkürzt);


    signalTemplates.hv_hp = t;

    t = new SignalTemplate("ks_hp", "Ks Hauptsignal", "ks", ["basis", "aus_hp", "wrw"], [["hp", 0]]);
    t.add(new VisualElement("aus_ks1ks2", { options: "vr" }));
    t.add(new VisualElement("wrw_gelb", { options: "vr" }));

    t.add(new VisualElement("hp0", { btn_text: "Hp 0", stellung: ["hp", 0] }))
    t.add(new VisualElement(null, {
        btn_text: "Ks 1", stellung: ["hp", 1], childs: [
            new VisualElement("ks1", { pos: [6, 55], options: "vr" }),
            new VisualElement("ks1", { options: "!vr" })
        ]
    }))
    t.add(new VisualElement("ks2", { btn_text: "Ks 2", options: "vr", stellung: ["hp", 2] }));
    t.add(new VisualElement("zs1", { btn_text: "Zs 1", stellung: ["ersatz", "zs1"], options: verw_bahnhof, enabled: s => s.get("hp") == 0 || s.get("hp") == null, blinkt: true }));
    t.add(new VisualElement("sh1", { btn_text: "Sh 1", stellung: ["ersatz", "sh1"], enabled: s => s.get("hp") == 0 || s.get("hp") == null }));

    t.add(new VisualElement("verk", { btn_text: "Verkürzt", options: "verk", stellung: ["verk", 1], enabled: (s) => s.get("hp") == 2 }));

    t.startOptions = ["verwendung.asig"];
    t.contextMenu = [].concat(menu.Verwendung, menu.Vorsignal, menu.verkürzt);
    signalTemplates.ks_hp = t;

    //Ks Vorsignal
    t = new SignalTemplate("ks_vr", "Ks Vorsignal", "ks", ["basis"], [["hp", 2]]);
    t.add(new VisualElement("ne2", { options: "!wdh" }));
    t.add(new VisualElement("ks1", { btn_text: "Ks 1", pos: [6, 60], stellung: ["hp", 1] }));
    t.add(new VisualElement("ks2", { btn_text: "Ks 2", pos: [21, 60], stellung: ["hp", 2] }));

    t.add(new VisualElement("verk", { btn_text: "Verkürzt", pos: [7, 48], stellung: ["verk", 1], enabled: (s) => s.get("hp") == 2 }));
    t.contextMenu = [].concat(menu.wiederholer, menu.verkürzt);
    signalTemplates.ks_vr = t;

    /*     
    
        
    
        signalTemplates.ks_vr = new SignalTemplate("ks_vr", "Ks Vorsignal", "ks", ["basis", "ne2"], "ks2");
        signalTemplates.ks_vr.add(new VisualElement("ks2", { gruppe: 1, btn_text: "Ks 2", pos: [21, 60] }));
        signalTemplates.ks_vr.add(new VisualElement("ks1", { gruppe: 1, btn_text: "Ks 1", pos: [6, 60] }));
    
        signalTemplates.ne4 = new SignalTemplate("ne4", "Ne 4", "basic", [], "ne4_g");
        signalTemplates.ne4.add(new VisualElement("ne4_g", { gruppe: 1, btn_text: "groß" }))
        signalTemplates.ne4.add(new VisualElement("ne4_k", { gruppe: 1, btn_text: "klein" }))
    
        signalTemplates.ne1 = new SignalTemplate("ne1", "Ne 1", "basic", "ne1");
    
        signalTemplates.lf6 = new SignalTemplate("lf6", "Lf 6", "basic", "lf6");
        signalTemplates.lf6.add(new TextElement("geschw", { pos: [30, 8], format: "bold 30px Arial" }));
    
    
        signalTemplates.lf7 = new SignalTemplate("lf7", "Lf 7", "basic", "lf7");
        signalTemplates.lf7.add(new TextElement("geschw", { pos: [20, 10], format: "bold 40px Arial" }));
    
    
        signalTemplates.zs3 = new SignalTemplate("zs3", "Zs 3 (alleinst.)", "basic", "Zs3_Form");
        signalTemplates.zs3.add(new TextElement("geschw", { pos: [30, 25], format: "bold 25px Arial", color: "#eee" })); */


}


