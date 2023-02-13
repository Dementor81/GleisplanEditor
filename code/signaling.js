'use strict';

class VisualElement {
    #_id = "";
    #_blinkt = null;
    #_allowed = null;
    #_enabled = null;
    #_image = null;
    #_pos = 0;
    #_gruppe = null;
    btn_text = "";

    constructor(id, { allowed = true, enabled = null, gruppe = 0, btn = id, blinkt = false, pos = 0, image = null } = {}) {
        this.#_id = id;
        this.#_allowed = allowed;
        this.#_enabled = enabled;
        this.#_gruppe = gruppe;
        this.#_blinkt = blinkt;
        this.btn = btn;
        this.#_pos = pos;
        this.#_image = image;
    }

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

    setEnabled(signal, v) {
        if (this.#_enabled == null)
            signal._signalStellung[this.#_id] = v;
        else
            throw "not allowed";
    }

    isAllowed(signal) {
        if (typeof this.#_allowed == "function")
            return this.#_allowed(signal);
        else
            return true;
    }

    get blinkt() {
        return this.#_blinkt;
    }

    set blinkt(v) {
        this.#_blinkt = v;
    }

    get image() {
        return this.#_image != null ? this.#_image : this.#_id;
    }

    set image(v) {
        this.#_image = v;
    }

    get gruppe() { return this.#_gruppe; }
    get id() { return this.#_id; }

    get pos() {
        if (typeof this.#_pos == "function")
            return this.#_pos();
        else
            return this.#_pos;
    }

    set pos(v) {
        this.#_pos = v;
    }

    /*    static disableAllOther(signalBilder, gruppe) {
           for (let v in signalBilder) {
               let x = signalBilder[v]
               if (x instanceof SignalBild) {
                   if (x.enabled && x.gruppe === gruppe)
                       x.disable();
               } else if (typeof x == "object") {
                   SignalBild.disableAllOther(x, gruppe)
               }
           }
       }
   
       enable = () => {
           if (this.#_gruppe != 0) SignalBild.disableAllOther(this.#_signal._signalbilder, this.#_gruppe)
           this.#_signal._signalStellung[this.#_id] = true;
       };
       disable = () => {
           this.#_signal._signalStellung[this.#_id] = false;
       };
       toggle = () => {
           this.enabled ? this.disable() : this.enable();
       }; */
}

class SignalTemplate {
    #_id = null;
    get id() {
        return this.#_id;
    }

    constructor(id, elements) {
        this.#_id = id;
        this.elements = {};
        //pl.add(id)


        elements.forEach(element => {
            this.elements[element.id ] = element;
        });
    }

}

function initSignals() {
    signalTemplates.ks = new SignalTemplate("ks", [
        new VisualElement("basis", { enabled: true }),
        new VisualElement("wrw", { enabled: true }),
        new VisualElement("hp0"),
        new VisualElement("ks1")
    ]);
}


