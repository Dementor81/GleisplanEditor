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

   constructor(
      image,
      { btn_text = null, blinkt = false, pos = null, enabled = null, conditions: conditions = [], stellung = null, off = null, childs = null } = {}
   ) {
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
}

class TextElement extends VisualElement {
   #_format;
   #_color;

   constructor({ format, color }) {
      super(arguments[0], arguments[1]);
      this.#_format = arguments[1].format ?? "bold 25px Arial";
      this.#_color = arguments[1].color ?? "#eee";
   }

   get format() {
      return this.#_format;
   }
   get color() {
      return this.#_color;
   }

   getText(signal) {
      if (this.stellung[0] == "#") return signal.getFeature(this.stellung.substring(1));
      else return signal.get(this.stellung);
   }
   //setText = (s, text) => s._signalStellung[this.id] = text;

   isEnabled(signal) {
      if (this.stellung[0] == "#") return true;
      const val = signal.get(this.stellung);
      return isNaN(val) || val > 0;
   }
}

class SignalTemplate {
   #_id = null;
   #_title = null;
   #_start = null;
   #_json_file = null;
   #_scale = 0.5;
   #_signalMenu = null;
   #_distance_from_track = 0;

   contextMenu = [];
   elements = [];
   rules = [];

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
   get distance_from_track() {
      return this.#_distance_from_track;
   }
   set distance_from_track(v) {
      this.#_distance_from_track = v;
   }

   set signalMenu(m) {
      this.#_signalMenu = m;

      let queue = [...m];

      while (queue.length > 0) {
         let current = queue.shift();

         if (Array.isArray(current)) queue.push(...current);
         else {
            if (current.items) queue.push(...[].concat(current.items));
            if (current.setting) current.ve = this.getVisualElementByStellung(current.setting);
         }
      }
   }

   get signalMenu() {
      return this.#_signalMenu;
   }

   constructor(id, title, json_file, startElements, initialSignalStellung) {
      this.#_id = id;
      this.#_title = title;
      if (initialSignalStellung) this.#_start = Array.isArray(initialSignalStellung) ? initialSignalStellung : [initialSignalStellung];
      this.#_json_file = json_file;

      if (startElements) {
         if (Array.isArray(startElements)) this.elements = startElements;
         else this.elements = [startElements];
      }

      pl.addSpriteSheet(this.#_id, json_file);
   }

   add(element) {
      this.elements.push(element);
   }

   getVisualElementByStellung(signal_aspect) {
      let results = [];
      const iterateItems = function (current) {
         if (Array.isArray(current)) return current.some((item) => iterateItems(item));
         if (current instanceof VisualElement) {
            if (current.childs !== null && current.childs.some((item) => iterateItems(item))) {
               results.push(current);
               return true;
            }

            if (current.stellung === signal_aspect) {
               results.push(current);
               return true;
            }
         }
         return false;
      };

      this.elements.forEach((e) => iterateItems(e));

      return results;
   }

   getAllMenuItems;

   addRule(trigger, setting) {
      this.rules.push([trigger, setting]);
   }

   StellungIsAllowed(stellung, signal) {
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
      verkürzt: { text: "verkürzt", option: "vr_op.verk" },
      wiederholer: { text: "Wiederholer", option: "vr_op.wdh" },
      Mastschild: {
         text: "Mastschild",
         childs: [
            { text: "weiß-rot-weiß", option: "mastschild.wrw" },
            { text: "weiß-gelb-weiß-gelb-weiß", option: "mastschild.wgwgw" },
         ],
      },
      Zusatz: {
         text: "Zusatzanzeiger",
         childs: [
            { text: "oben", option: "zusatz_oben" },
            { text: "unten", option: "zusatz_unten" },
         ],
      },
      Bezeichnung: {
         input: "Bezeichnung",
      },
   };

   const lightMenu = [
      [
         {
            btnGroup: 1,
            items: [
               { btn: 1, text: "Hp 0", setting: "hp=0" },
               { btn: 1, text: "Hp 1", setting: "hp=1" },
               { btn: 1, text: "Hp 2", setting: "hp=2" },
            ],
         },
         { input: 1, text: "Zs 3", setting: "zs3" },
      ],

      [
         {
            btnGroup: 1,
            items: [
               { btn: 1, text: "Vr 0", setting: "vr=0" },
               { btn: 1, text: "Vr 1", setting: "vr=1" },
               { btn: 1, text: "Vr 2", setting: "vr=2" },
               { btn: 1, text: "verkürzt", setting: "verk=1" },
            ],
         },
         { input: 1, text: "Zs 3v", setting: "zs3v" },
      ],
      [
         {
            btnGroup: 1,
            items: [
               { btn: 1, text: "Zs 1", setting: "ersatz=zs1" },
               { btn: 1, text: "Zs 7", setting: "ersatz=zs7" },
               { btn: 1, text: "Zs 8", setting: "ersatz=zs8" },
               { btn: 1, text: "Sh 1", setting: "ersatz=sh1" },
               { btn: 1, text: "Kennlicht", setting: "ersatz=kennlicht" },
            ],
         },
      ],
   ];

   const verw_strecke = ["verwendung.bksig", "verwendung.sbk", "verwendung.esig"];
   const verw_bahnhof = ["verwendung.asig", "verwendung.zsig"];

   //signal: ist das signal, dessen Stellung wir gerade setzen
   //hp: ist das signal, dessen Stellung wir vorsignalisieren wollen
   const checkSignalDependencyFunction4HV = function (signal, hp) {
      //make sure we only handle main signals
      if (!hp.matchFeature("hp") || !signal.matchFeature("vr")) return;
      let stop_propagation = false;

      //-1 heißt, die Vorsignalfunktion ist vom User ausgeschaltet
      if (signal.get("vr") != -1) {
         //Das Hauptsignal zeigt nicht Hp 0 oder es ist ein alleinstehndes Vorsignal
         if (!signal.matchFeature("hp") || signal.get("hp") != 0) {
            switch (hp._template.id) {
               case "Hv77":
               case "hv_hp":
               case "hv_vr":
                  {
                     signal.set_stellung("vr", hp.get("hp") >= 0 ? hp.get("hp") : 0, false);
                     if (!signal.matchFeature("vr_op.wdh")) stop_propagation = true;
                  }
                  break;
               case "Hl":
               case "ks":
               case "ks_vr":
                  {
                     signal.set_stellung("vr", hp.get("hp") <= 0 ? 0 : 1, false);
                     if (!signal.matchFeature("vr_op.wdh")) stop_propagation = true;
                  }
                  break;
            }

            if (hp.get("zs3") == 4) {
               signal.set_stellung("zs3v", 0, false);

               if (signal.get("vr") > 0) signal.set_stellung("vr", 2, false);
            } else signal.set_stellung("zs3v", hp.get("zs3"), false);

            //if (hp.get("zs3").between(1,6) && hp.get("hp") > 0) signal.set_stellung("vr", 2, false);
         }
      }

      return stop_propagation;
   };

   let t = new SignalTemplate(
      "hv_hp",
      "Hv Hauptsignal",
      "hv",
      [
         "mast,hp_schirm",
         new VisualElement("wrw", { conditions: "mastschild.wrw" }),
         new VisualElement("wgwgw", { conditions: "mastschild.wgwgw" }),

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
            off: "zs3<=6 && zs3>0",
         }),
         new VisualElement(null, {
            stellung: "hp=2",

            childs: [
               new VisualElement("hp_asig_gelb,hp_asig_gr", { conditions: verw_bahnhof }),
               new VisualElement("hp_bk_gelb_unten_re,hp_bk_gr_oben_re", { conditions: verw_strecke.without("verwendung.sbk") }),
            ],
            off: "zs3>6",
         }),
         new VisualElement("hp_asig_schuten", { conditions: verw_bahnhof }),
         new VisualElement("hp_bk_schute_unten", { conditions: verw_strecke }),
         new VisualElement("hp_bk_schute_oben", { conditions: verw_strecke.without("verwendung.sbk") }),

         new VisualElement(null, {
            childs: [
               "vr_schirm",
               "vr_lichtp",
               new VisualElement("vr_zusatz_schirm,vr_zusatz_lichtp", { conditions: "vr_op.verk" }),
               new VisualElement("vr_zusatz_licht", { conditions: "vr_op.verk", stellung: "verk=1", off: "hp=0" }),
               new VisualElement(null, {
                  childs: [
                     new VisualElement("vr_gelb_oben,vr_gelb_unten", { stellung: "vr=0" }),
                     new VisualElement("vr_grün_oben,vr_grün_unten", { stellung: "vr=1" }),
                     new VisualElement("vr_gelb_unten,vr_grün_oben", { stellung: "vr=2" }),
                  ],
                  off: "hp=0",
               }),
               "vr_schuten",
               new VisualElement("vr_zusatz_schute", { conditions: "vr_op.verk" }),
            ],
            conditions: "vr",
         }),

         new VisualElement(null, {
            childs: [
               "hp_asig_kennlicht_lichtp",
               new VisualElement("hp_asig_kennlicht_licht", { stellung: "ersatz=kennlicht", off: "hp>=0" }),
               "hp_asig_kennlicht_schute",
            ],
            conditions: verw_bahnhof,
         }),

         new VisualElement(null, {
            childs: ["hp_asig_sh1_lichtp", new VisualElement("hp_asig_sh1_licht", { stellung: "ersatz=sh1", off: "hp>0" }), "hp_asig_sh1_schute"],
            conditions: verw_bahnhof,
         }),

         new VisualElement(null, {
            childs: ["hp_zs1_lichtp", new VisualElement("hp_zs1_licht", { stellung: "ersatz=zs1", off: "hp>0" }), "hp_zs1_schuten"],
            conditions: ["verwendung.asig", "verwendung.bksig", "verwendung.sbk"],
         }),

         new VisualElement(null, {
            childs: ["hp_zs7_lichtp", new VisualElement("hp_zs7_licht", { stellung: "ersatz=zs7", off: "hp>0" }), "hp_zs7_schuten"],
            conditions: ["verwendung.esig", "verwendung.zsig"],
         }),

         new VisualElement(null, {
            childs: ["hp_zs1_lichtp", new VisualElement("hp_zs1_licht", { stellung: "ersatz=zs8", off: "hp>0", blinkt: true }), "hp_zs1_schuten"],
            conditions: ["verwendung.asig", "verwendung.bksig"],
         }),

         new VisualElement(null, {
            childs: ["zs3", new TextElement("zs3", { pos: [115, 80], format: "bold 80px Arial", color: "#eee", stellung: "zs3" })],
            off: "zs3<=0",
            conditions: "!zusatz_oben",
         }),

         new VisualElement(null, {
            childs: ["zs3v", new TextElement("zs3v", { pos: [115, 890], format: "bold 80px Arial", color: "#ffde36", stellung: "zs3v" })],
            off: "zs3v<=0",
            conditions: "!zusatz_unten",
         }),

         new VisualElement("zs3v_licht", {
            conditions: "zusatz_unten",
            childs: [
               new TextElement("zs3v", {
                  pos: [120, 885],
                  format: "60px DOT",
                  color: "#ffde36",
                  conditions: "zusatz_unten",
                  stellung: "zs3v",
                  off: "hp<=0",
               }),
            ],
         }),

         new VisualElement("zs3_licht", {
            conditions: "zusatz_oben",
            childs: [
               new TextElement("zs3", {
                  pos: [120, 78],
                  format: "60px DOT",
                  color: "#eee",
                  conditions: "zusatz_oben",
                  stellung: "zs3",
                  off: "hp<=0",
               }),
            ],
         }),
         new VisualElement("schild", {
            conditions: "bez",
            childs: [new TextElement("Bez", { pos: [116, 1033], format: "bold 55px condenced", color: "#333", stellung: "#bez" })],
         }),
      ],
      ["hp=0", "vr=0"]
   );
   t.scale = 0.15;
   t.distance_from_track = 4;
   t.checkSignalDependency = checkSignalDependencyFunction4HV;
   t.addRule("hp>0 && zs3>6", "hp=1");
   t.addRule("hp>0 && zs3<=6 && zs3>0", "hp=2");
   t.initialFeatures = ["hp", "verwendung.asig", "mastschild.wrw"];
   t.contextMenu = [].concat(
      settingsMenu.Verwendung,
      settingsMenu.Mastschild,
      settingsMenu.Vorsignal,
      settingsMenu.verkürzt,
      settingsMenu.Zusatz,
      settingsMenu.Bezeichnung
   );
   t.signalMenu = lightMenu;
   signalTemplates.hv_hp = t;

   t = new SignalTemplate(
      "hv_vr",
      "Hv Vorsignal",
      "hv",
      [
         "mast,vr_schirm,vr_lichtp",
         new VisualElement("ne2", { conditions: "!vr_op.wdh" }),
         new VisualElement("vr_zusatz_schirm,vr_zusatz_lichtp", { conditions: ["vr_op.verk", "vr_op.wdh"] }),
         new VisualElement("vr_zusatz_licht", { conditions: "vr_op.verk", stellung: "verk=1" }),
         new VisualElement("vr_zusatz_licht", { conditions: "vr_op.wdh" }),
         new VisualElement(null, {
            childs: [
               new VisualElement("vr_gelb_oben,vr_gelb_unten", { stellung: "vr=0" }),
               new VisualElement("vr_grün_oben,vr_grün_unten", { stellung: "vr=1" }),
               new VisualElement("vr_gelb_unten,vr_grün_oben", { stellung: "vr=2" }),
            ],
         }),
         "vr_schuten",
         new VisualElement("vr_zusatz_schute", { conditions: "vr_op.verk" }),
         new VisualElement(null, {
            childs: ["zs3v", new TextElement("zs3v", { pos: [115, 890], format: "bold 80px Arial", color: "#ffde36", stellung: "zs3v" })],
            off: "zs3v<=0",
            conditions: "!zusatz_unten",
         }),
         new VisualElement("zs3v_licht", {
            conditions: "zusatz_unten",
            childs: [
               new TextElement("zs3v", {
                  pos: [120, 885],
                  format: "60px DOT",
                  color: "#ffde36",
                  conditions: "zusatz_unten",
                  stellung: "zs3v",
                  off: "vr=0",
               }),
            ],
         }),
      ],
      ["vr=0"]
   );
   t.scale = 0.15;
   t.distance_from_track = 4;
   t.checkSignalDependency = checkSignalDependencyFunction4HV;
   t.initialFeatures = ["vr"];
   t.contextMenu = [].concat(settingsMenu.verkürzt, settingsMenu.wiederholer, settingsMenu.Zusatz);
   t.signalMenu = [
      [
         {
            btnGroup: 1,
            items: [
               { btn: 1, text: "Vr 0", setting: "vr=0" },
               { btn: 1, text: "Vr 1", setting: "vr=1" },
               { btn: 1, text: "Vr 2", setting: "vr=2" },
               { btn: 1, text: "verkürzt", setting: "verk=1" },
            ],
         },
         { input: 1, text: "Zs 3v", setting: "zs3v" },
      ],
   ];
   signalTemplates.hv_vr = t;

   //KS Hauptsignal
   t = new SignalTemplate(
      "ks",
      "Ks Hauptsignal",
      "ks",
      [
         new VisualElement("zs3_licht", {
            conditions: "zusatz_oben",
            childs: [
               new TextElement("zs3", { pos: [90, 40], format: "85px DOT", color: "#eee", conditions: "zusatz_oben", stellung: "zs3", off: "hp<=0" }),
            ],
         }),

         new VisualElement(null, {
            childs: [
               "zs3",
               new TextElement("zs3", { pos: [85, 80], format: "bold 80px Arial", color: "#eee", btn_text: "Zs 3 Geschwindigkeit", stellung: "zs3" }),
            ],
            off: "zs3<=0",
            conditions: "!zusatz_oben",
         }),
         "mast",
         "schirm_hp",
         "wrw",

         new VisualElement(null, {
            conditions: "vr",
            childs: ["ks1_2_optik_hpvr", new VisualElement("ks2", { stellung: "hp=2" })],
         }),
         new VisualElement("ks1_optik_hp", { conditions: "!vr" }),

         new VisualElement(null, {
            stellung: "hp=1",
            childs: [
               new VisualElement("ks1_hpvr", { conditions: "vr", blinkt: true, off: "zs3v<=0" }),
               new VisualElement("ks1_hpvr", { conditions: "vr", off: "zs3v>0" }),
               new VisualElement("ks1_hp", { conditions: "!vr", blinkt: true, off: "zs3v<=0" }),
               new VisualElement("ks1_hp", { conditions: "!vr", off: "zs3v>0" }),
            ],
         }),

         new VisualElement("möhre", { conditions: "vr" }),
         new VisualElement("hp0", { stellung: "hp=0" }),
         new VisualElement(null, {
            conditions: ["verwendung.asig", "verwendung.bksig", "verwendung.sbk"],
            childs: ["zs1_optik", new VisualElement("zs1", { stellung: "ersatz=zs1", off: "hp>0", blinkt: true })],
         }),
         new VisualElement(null, {
            conditions: ["verwendung.esig", "verwendung.zsig"],
            childs: ["zs7_optik", new VisualElement("zs7", { stellung: "ersatz=zs7", off: "hp>0" })],
         }),
         new VisualElement(null, {
            conditions: verw_bahnhof,
            childs: ["sh1_optik", "zs1_optik", new VisualElement("zs1,sh1", { stellung: "ersatz=sh1", off: "hp>0" })],
         }),

         new VisualElement(null, {
            conditions: ["vr_op.verk&&vr"],
            childs: ["kennlicht_optik", new VisualElement("kennlicht", { stellung: "verk=1", off: "hp=0||hp=1&&zs3v<=0" })],
         }),

         new VisualElement(null, {
            conditions: verw_bahnhof,
            childs: ["kennlicht_optik", new VisualElement("kennlicht", { stellung: "ersatz=kennlicht", off: "hp>=0" })],
         }),

         new VisualElement(null, {
            childs: ["zs3v", new TextElement("zs3v", { pos: [85, 480], format: "bold 80px Arial", color: "#ffde36", stellung: "zs3v" })],
            off: "zs3v<=0",
            conditions: "!zusatz_unten",
         }),

         new VisualElement("zs3v_licht", {
            conditions: "zusatz_unten",
            childs: [
               new TextElement("zs3v", {
                  pos: [90, 520],
                  format: "85px DOT",
                  color: "#ffde36",
                  conditions: "zusatz_unten",
                  stellung: "zs3v",
                  off: "hp<=0",
               }),
               new VisualElement("zs6_licht", { stellung: "zs6=1", off: "hp<=0" }),
            ],
         }),
         new VisualElement("schild", {
            conditions: "bez",
            childs: [new TextElement("Bez", { pos: [85, 634], format: "bold 55px condenced", color: "#333", stellung: "#bez" })],
         }),
      ],
      "hp=0"
   );
   t.scale = 0.15;
   t.distance_from_track = 15;
   t.initialFeatures = ["hp", "verwendung.asig"];
   t.contextMenu = [].concat(settingsMenu.Verwendung, settingsMenu.Vorsignal, settingsMenu.verkürzt, settingsMenu.Zusatz,settingsMenu.Bezeichnung);
   t.signalMenu = [
      [
         {
            btnGroup: 1,
            items: [
               { btn: 1, text: "Hp 0", setting: "hp=0" },
               { btn: 1, text: "Ks 1", setting: "hp=1" },
               { btn: 1, text: "Ks 2", setting: "hp=2" },
            ],
         },
         { input: 1, text: "Zs 3", setting: "zs3" },
      ],

      [{ input: 1, text: "Zs 3v", setting: "zs3v" }],
      [
         {
            btnGroup: 1,
            items: [
               { btn: 1, text: "Zs 1", setting: "ersatz=zs1" },
               { btn: 1, text: "Zs 7", setting: "ersatz=zs7" },
               { btn: 1, text: "Zs 8", setting: "ersatz=zs8" },
               { btn: 1, text: "Sh 1", setting: "ersatz=sh1" },
               { btn: 1, text: "Kennlicht", setting: "ersatz=kennlicht" },
            ],
         },
         {
            btnGroup: 1,
            items: [{ btn: 1, text: "Verk", setting: "verk=1" }],
         },
      ],
      [
         {
            btnGroup: 1,
            items: [{ btn: 1, text: "Zs 6", setting: "zs6=1" }],
         },
      ],
   ];
   //signal: ist das signal, dessen Stellung wir gerade setzen
   //hp: ist das signal, dessen Stellung wir vorsignalisieren wollen
   t.checkSignalDependency = function (signal, hp) {
      //make sure we only handle main signals
      if (!hp.matchFeature("hp") || !signal.matchFeature("vr")) return;
      let stop_propagation = false;
      //-1 heißt, das Signal ist vom User ausgeschaltet
      if (signal.get("hp") != -1) {
         //Das Hauptsignal zeigt nicht Hp 0 oder es ist ein alleinstehndes Vorsignal
         let anderes_zs3 = hp.get("zs3");
         let eigenes_zs3 = signal.get("zs3");
         if (!signal.matchFeature("hp") || signal.get("hp") != 0) {
            let x = hp.get("hp");

            switch (hp._template.id) {
               case "Hv77":
               case "hv_hp":
               case "hv_vr":
                  {
                     signal.set_stellung("hp", x >= 1 ? 1 : 2, false);
                     if (x == 2 && anderes_zs3 <= 0) anderes_zs3 = 4;

                     if (!signal.matchFeature("vr_op.wdh")) stop_propagation = true;
                  }
                  break;
               case "Hl":
               case "ks":
               case "ks_vr":
                  {
                     signal.set_stellung("hp", x <= 0 ? 2 : 1, false);

                     if (!signal.matchFeature("vr_op.wdh")) stop_propagation = true;
                  }
                  break;
            }
         }
         if (eigenes_zs3 <= anderes_zs3 && eigenes_zs3 > 0) anderes_zs3 = -1;
         signal.set_stellung("zs3v", anderes_zs3, false);
      }

      return stop_propagation;
   };

   signalTemplates.ks = t;

   t = new SignalTemplate(
      "ks_vr",
      "Ks Vorsignal",
      "ks",
      [
         "mast",
         "schirm_vr",
         new VisualElement("ks2_vr", { stellung: "hp=2" }),

         new VisualElement(null, {
            stellung: "hp=1",
            childs: [new VisualElement("ks1_vr", { blinkt: true, off: "zs3v<=0" }), new VisualElement("ks1_vr", { off: "zs3v>0" })],
         }),

         new VisualElement(null, {
            conditions: "vr_op.wdh",
            childs: ["sh1_optik", new VisualElement("sh1", { off: "hp=0||hp=1&&zs3v<=0" })],
         }),

         new VisualElement("ne2", {
            conditions: "!vr_op.wdh",
         }),

         new VisualElement(null, {
            conditions: "vr_op.verk",
            childs: ["verk_optik", new VisualElement("verk", { off: "hp=0||hp=1&&zs3v<=0" })],
         }),

         new VisualElement(null, {
            conditions: "!zusatz_unten",
            childs: [
               "zs3v",
               new TextElement("zs3v", {
                  pos: [85, 490],
                  format: "bold 80px Arial",
                  color: "#ffde36",
                  btn_text: "Zs 3v Geschwindigkeit",
                  stellung: "zs3v",
               }),
            ],
            off: "zs3v<=0",
         }),
         new VisualElement("zs3v_licht", {
            conditions: "zusatz_unten",
            childs: [new TextElement("zs3v", { pos: [90, 520], format: "85px DOT", color: "#ffde36", stellung: "zs3v", off: "hp=2" })],
         }),
      ],
      "hp=2"
   );
   t.scale = 0.13;
   t.distance_from_track = 15;
   t.initialFeatures = ["vr"];
   t.contextMenu = [].concat(settingsMenu.verkürzt, settingsMenu.wiederholer, settingsMenu.Zusatz);
   t.signalMenu = [
      [
         {
            btnGroup: 1,
            items: [
               { btn: 1, text: "Ks 1", setting: "hp=1" },
               { btn: 1, text: "Ks 2", setting: "hp=2" },
            ],
         },
      ],

      [{ input: 1, text: "Zs 3v", setting: "zs3v" }],
      [
         {
            btnGroup: 1,
            items: [
               { btn: 1, text: "Zs 1", setting: "ersatz=zs1" },
               { btn: 1, text: "Zs 7", setting: "ersatz=zs7" },
               { btn: 1, text: "Zs 8", setting: "ersatz=zs8" },
               { btn: 1, text: "Sh 1", setting: "ersatz=sh1" },
               { btn: 1, text: "Kennlicht", setting: "ersatz=kennlicht" },
            ],
         },
      ],
   ];
   t.checkSignalDependency = signalTemplates.ks.checkSignalDependency;
   signalTemplates.ks_vr = t;

   //ne4
   signalTemplates.ne4 = new SignalTemplate("ne4", "Ne 4", "basic", [
      new VisualElement("ne4_g", { conditions: "bauart.groß" }),
      new VisualElement("ne4_k", { conditions: "bauart.klein" }),
   ]);
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
   signalTemplates.ne1.scale = 1;
   signalTemplates.ne1.distance_from_track = 5;

   signalTemplates.lf6 = new SignalTemplate(
      "lf6",
      "Lf 6",
      "basic",
      ["lf6", new TextElement("lf6", { pos: [30, 8], format: "bold 30px Arial", color: "#333", stellung: "geschw" })],
      "geschw=9"
   );
   signalTemplates.lf6.initialFeatures = ["slave"];
   signalTemplates.lf6.signalMenu = [{ input: 1, text: "Geschwindigkeit", setting: "geschw" }];

   signalTemplates.lf7 = new SignalTemplate(
      "lf7",
      "Lf 7",
      "basic",
      ["lf7", new TextElement("lf7", { pos: [20, 10], format: "bold 40px Arial", color: "#333", stellung: "geschw" })],
      "geschw=6"
   );
   signalTemplates.lf7.initialFeatures = ["master"];
   signalTemplates.lf7.signalMenu = [{ input: 1, text: "Geschwindigkeit", setting: "geschw" }];

   signalTemplates.lf7.checkSignalDependency = signalTemplates.lf6.checkSignalDependency = function (signal, hp) {
      if (signal._template.id == "lf6" && hp._template.id == "lf7") {
         signal.set_stellung("geschw", hp.get("geschw"), false);
         return true;
      }
      return false;
   };

   signalTemplates.zs3 = new SignalTemplate(
      "zs3",
      "Zs 3 (alleinst.)",
      "basic",
      ["Zs3_Form", new TextElement("zs3", { pos: [30, 25], format: "bold 25px Arial", stellung: "geschw" })],
      "geschw=8"
   );

   signalTemplates.zs3.signalMenu = [{ input: 1, text: "Geschwindigkeit", setting: "geschw" }];
}
