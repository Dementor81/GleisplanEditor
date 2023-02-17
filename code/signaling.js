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

    constructor(id, { allowed = true, enabled = null, gruppe = 0, btn_text = id, blinkt = false, pos = 0, image = null } = {}) {
        this.#_id = id;
        this.#_allowed = allowed;
        this.#_enabled = enabled;
        this.#_gruppe = gruppe;
        this.#_blinkt = blinkt;
        this.#_btn_text = btn_text;
        this.#_pos = pos;
        this.#_image = image;
    }



    get blinkt() {
        return this.#_blinkt;
    }

    set blinkt(v) {
        this.#_blinkt = v;
    }

    get enabled() {
        return this.#_enabled;
    }

    get image() {
        return this.#_image != null ? this.#_image : this.#_id;
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
        if (this.#_enabled == null)
            return signal._signalStellung[this.#_id] === true;
        else if (typeof this.#_enabled == "boolean")
            return this.#_enabled;
        else if (typeof this.#_enabled == "function")
            return this.#_enabled(signal);
        else
            return undefined;
    }

    isAllowed(signal) {
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

class SignalTemplate {
    #_id = null;
    #_start = null;
    #_json_file = null;

    get id() {
        return this.#_id;
    }

    get start() {
        return this.#_start;
    }

    get json_file() {
        return this.#_json_file;
    }

    constructor(id, json_file, elements, start) {
        this.#_id = id;
        this.#_start = start;
        this.#_json_file = json_file;
        this.elements = {};
        this.elements.forEach = f => {
            for (let v in this.elements) {
                let x = this.elements[v]
                if (typeof x != "function")
                    f(x);
            }
        }

        this.elements.filter = f => {
            let r = [];
            for (let v in this.elements) {
                let x = this.elements[v]
                if (typeof x != "function" && f(x))
                    r.push(x);
            }
            return r;
        }


        elements.forEach(element => {
            this.elements[element.id] = element;
        });

        pl.add(this.#_id, json_file);
    }

    

    stringify() {
        return this.id;
    }

}

function initSignals() {
    signalTemplates.ks_hp = new SignalTemplate("ks_hp", "ks", [
        new VisualElement("basis", { enabled: true }),
        new VisualElement("aus_hp", { enabled: true }),
        //new VisualElement("aus_zs3", { enabled: true }),
        new VisualElement("wrw", { enabled: true }),
        new VisualElement("hp0", {gruppe:1, btn_text: "Hp 0" }),
        new VisualElement("ks1", { gruppe:1, btn_text: "Ks 1" })
    ], "hp0");

    signalTemplates.ks_vr = new SignalTemplate("ks_vr", "ks", [
        new VisualElement("basis", { enabled: true }),
        new VisualElement("ne2", { enabled: true }),
        new VisualElement("ks2", { gruppe:1, btn_text: "Ks 2" }),
        new VisualElement("ks1", { gruppe:1, btn_text: "Ks 1" })
    ], "ks2");
}


