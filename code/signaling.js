'use strict';

class VisualElement {
    #_id = "";
    #_blinkt = null;
    #_allowed = null;
    #_enabled = null;
    #_image = null;
    #_pos = 0;
    #_gruppe = null;
    #_btn_text = "";
    #_options = null;

    constructor(id, { allowed = true, enabled = null, gruppe = 0, btn_text = id, blinkt = false, pos = null, image = id, options = [] } = {}) {
        this.#_id = id;
        this.#_allowed = allowed;
        this.#_enabled = enabled;
        this.#_gruppe = gruppe;
        this.#_blinkt = blinkt;
        this.#_btn_text = btn_text;
        this.#_pos = pos;
        this.#_image = image;
        this.#_options = options;
    }

    get switchable() {
        return this.#_enabled == null;
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

    get gruppe() { return this.#_gruppe; }
    get id() { return this.#_id; }
    get btn_text() { return this.#_btn_text; }

    get pos() {
        if (typeof this.#_pos == "function")
            return this.#_pos();
        else
            return this.#_pos;
    }

    set pos(v) {
        this.#_pos = v;
    }

    disableAllOther = (s, gruppe) => s._template.elements.forEach((e) => { if (e.gruppe === gruppe) e.disable(s) });

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
        if (this.#_options?.length && (signal.options == null || !signal.options.some(r => Array.isArray(this.#_options) ? this.#_options.includes(r) : r == this.#_options))) return false;

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
    };
}

class TextElement extends VisualElement {

    #_format = "";
    #_color = "#000";

    constructor(id, { format = "bold 20px Arial", color = "#333" } = {}) {
        super(id, arguments[1]);
        this.#_format = format
        this.#_color = color;
    }

    get format() { return this.#_format; }
    get color() { return this.#_color; }


    getText = s => "8";//s._signalStellung[this.id];
    setText = (s, text) => s._signalStellung[this.id] = text;
}

class SignalTemplate {
    #_id = null;
    #_title = null;
    #_start = null;
    #_json_file = null;
    #_scale = null;

    contextMenu = [];

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

    constructor(id, title, json_file, elements, start, scale = 0.3) {
        this.#_id = id;
        this.#_title = title;
        this.#_start = start;
        this.#_json_file = json_file;
        this.#_scale = scale;

        this.elements = {};
        //add a forEach function to the elements Object
        this.elements.forEach = f => {
            for (let v in this.elements) {
                let x = this.elements[v]
                if (typeof x != "function")
                    f(x);
            }
        }

        //add a filter function to the elements Object
        this.elements.filter = f => {
            let r = [];
            for (let v in this.elements) {
                let x = this.elements[v]
                if (typeof x != "function" && f(x))
                    r.push(x);
            }
            return r;
        }


        if (elements) {
            if (Array.isArray(elements))
                elements.forEach(element => {
                    this.add(new VisualElement(element, { enabled: true }));
                });
            else
                this.add(new VisualElement(elements, { enabled: true }));
        }



        pl.add(this.#_id, json_file);
    }

    add(element) {
        this.elements[element.id] = element;
    }



    stringify() {
        return this.id;
    }

}

function initSignals() {

    const menu1 = {
        text: "Verwendung", childs: [
            { text: "Esig", option:"Esig" },
            { text: "Asig", option:"Asig" },
            { text: "Zsig", option:"Zsig" },
            { text: "Bksig", option:"Bksig" },
            { text: "Sbk", option:"Sbk" },

        ]
    }

    signalTemplates.hv_hp = new SignalTemplate("hv_hp", "Hv Hauptsignal", "hv", [
        "basis",
        "hp",
        "bk",
        "vr",
        "wrw",
        "zs1_aus",
    ], "hp0", 0.15);

    signalTemplates.hv_hp.add(new VisualElement("hp0", { image: "bk_hp0", gruppe: 1, btn_text: "Hp 0" }));
    signalTemplates.hv_hp.add(new VisualElement("hp1", { image: "esig_hp1", gruppe: 1, btn_text: "Hp 1" }));
    signalTemplates.hv_hp.add(new VisualElement("hp2", { image: "esig_hp2", gruppe: 1, btn_text: "Hp 2" }));
    signalTemplates.hv_hp.add(new VisualElement("vr0", { gruppe: 2, btn_text: "Vr 0", allowed: (s) => s._signalStellung.hp1 || s._signalStellung.hp2 }));
    signalTemplates.hv_hp.add(new VisualElement("vr1", { gruppe: 2, btn_text: "Vr 1", allowed: (s) => s._signalStellung.hp1 || s._signalStellung.hp2 }));
    signalTemplates.hv_hp.add(new VisualElement("vr2", { gruppe: 2, btn_text: "Vr 2", allowed: (s) => s._signalStellung.hp1 || s._signalStellung.hp2 }));
    signalTemplates.hv_hp.add(new VisualElement("zs1", { gruppe: 3, btn_text: "Zs 1", allowed: (s) => s._signalStellung.hp0 || s._signalStellung.aus }));
    signalTemplates.hv_hp.add(new VisualElement("aus", { gruppe: 1, btn_text: "aus", image: null }));


    signalTemplates.hv_hp_1 = new SignalTemplate("hv_hp_1", "Hv Hauptsignal", "hv", [
        "basis",
        "hp",
        "asig",
        "vr",
        "wrw",
        "zs1_aus",
    ], "hp0", 0.15);
    signalTemplates.hv_hp_1.add(new VisualElement("hp0", { image: "asig_hp0", gruppe: 1, btn_text: "Hp 0" }));
    signalTemplates.hv_hp_1.add(new VisualElement("hp00", { options: "asig", image: "asig_hp00", enabled: true, allowed: (s) => !s._signalStellung.sh1 && s._signalStellung.hp0 }));
    signalTemplates.hv_hp_1.add(new VisualElement("hp1", { image: "esig_hp1", gruppe: 1, btn_text: "Hp 1" }));
    signalTemplates.hv_hp_1.add(new VisualElement("hp2", { image: "esig_hp2", gruppe: 1, btn_text: "Hp 2" }));
    signalTemplates.hv_hp_1.add(new VisualElement("vr0", { gruppe: 2, btn_text: "Vr 0", allowed: (s) => s._signalStellung.hp1 || s._signalStellung.hp2 }));
    signalTemplates.hv_hp_1.add(new VisualElement("vr1", { gruppe: 2, btn_text: "Vr 1", allowed: (s) => s._signalStellung.hp1 || s._signalStellung.hp2 }));
    signalTemplates.hv_hp_1.add(new VisualElement("vr2", { gruppe: 2, btn_text: "Vr 2", allowed: (s) => s._signalStellung.hp1 || s._signalStellung.hp2 }));
    signalTemplates.hv_hp_1.add(new VisualElement("zs1", { gruppe: 3, btn_text: "Zs 1", allowed: (s) => s._signalStellung.hp0 || s._signalStellung.aus }));
    signalTemplates.hv_hp_1.add(new VisualElement("aus", { gruppe: 1, btn_text: "aus", image: null }));

    signalTemplates.hv_hp_1.contextMenu.push(menu1);

    signalTemplates.ks_hp = new SignalTemplate("ks_hp", "Ks Hauptsignal", "ks", ["basis", "aus_hp", "wrw"], "hp0");
    signalTemplates.ks_hp.add(new VisualElement("hp0", { gruppe: 1, btn_text: "Hp 0" }))
    signalTemplates.ks_hp.add(new VisualElement("ks1", { gruppe: 1, btn_text: "Ks 1" }))
    signalTemplates.ks_hp.add(new VisualElement("zs1", { gruppe: 2, btn_text: "Zs 1", allowed: (s) => s._signalStellung.hp0 || s._signalStellung.aus, blinkt: true }),)
    signalTemplates.ks_hp.add(new VisualElement("sh1", { gruppe: 2, btn_text: "Sh 1", allowed: (s) => s._signalStellung.hp0 || s._signalStellung.aus }),)
    signalTemplates.ks_hp.add(new VisualElement("aus", { gruppe: 1, btn_text: "aus", image: null }),)

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
    signalTemplates.zs3.add(new TextElement("geschw", { pos: [30, 25], format: "bold 25px Arial", color: "#eee" }));


}


