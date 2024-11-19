"use strict";

function initSignals() {
   const lightMenu = [
      ["hp=0,hp=1,hp=2", "zs3"],
      ["vr=0,vr=1,vr=2", "verk=1(verk)", "zs3v"],
      "ersatz=zs1,ersatz=zs7,ersatz=zs8,ersatz=sh1,ersatz=kennlicht",
      "zs6=1(Zs 6)",
   ];

   //signal: ist das signal, dessen Stellung wir gerade setzen
   //hp: ist das signal, dessen Stellung wir vorsignalisieren wollen
   const checkSignalDependencyFunction4HV = function (signal, hp) {
      //make sure we only handle main signals
      if (!hp.check("HPsig") || !signal.check("VRsig")) return;
      let stop_propagation = false;

      //-1 heißt, die Vorsignalfunktion ist vom User ausgeschaltet
      if (signal.get("vr") != -1) {
         //Das Hauptsignal zeigt nicht Hp 0 oder es ist ein alleinstehndes Vorsignal
         if (!signal.check("HPsig") || signal.get("hp") != 0) {
            switch (hp._template.id) {
               case "Hv77":
               case "hv_hp":
               case "hv_vr":
                  {
                     signal.set_stellung("vr", hp.get("hp") >= 0 ? hp.get("hp") : 0, false);
                     if (!signal.check("vr_op=wdh")) stop_propagation = true;
                  }
                  break;
               case "Hl":
               case "ks":
               case "ks_vr":
                  {
                     signal.set_stellung("vr", hp.get("hp") <= 0 ? 0 : 1, false);
                     if (!signal.check("vr_op=wdh")) stop_propagation = true;
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
         new VisualElement("wrw").on("mastschild=wrw"),
         new VisualElement("wgwgw").on("mastschild=wgwgw"),

         new VisualElement("hp_asig_lichtp").on(CONDITIONS.BAHNHOF),
         new VisualElement("hp_bk_lichtp_unten").on(CONDITIONS.STRECKE),
         new VisualElement("hp_bk_lichtp_oben").on(CONDITIONS.GRENZEN),

         new VisualElement()
            .on("hp=0")
            .childs([
               new VisualElement("hp_asig_rot_re").on(CONDITIONS.BAHNHOF).off("ersatz=sh1"),
               new VisualElement("hp_asig_rot_li").on(CONDITIONS.BAHNHOF),
               new VisualElement("hp_bk_rot_unten_li").on(CONDITIONS.STRECKE),
            ]),

         new VisualElement()
            .on("hp=1")
            .off("zs3<=6 && zs3>0") //used by UI to disable the corospoding button
            .childs([
               new VisualElement("hp_asig_gr").on(CONDITIONS.BAHNHOF),
               new VisualElement("hp_bk_gr_unten_re").on(CONDITIONS.SBK),
               new VisualElement("hp_bk_gr_oben_re").on(CONDITIONS.GRENZEN),
            ]),

         new VisualElement()
            .on("hp=2")
            .off("zs3>6") //used by UI to disable the corospoding button
            .childs([
               new VisualElement("hp_asig_gelb,hp_asig_gr").on(CONDITIONS.BAHNHOF),
               new VisualElement("hp_bk_gelb_unten_re,hp_bk_gr_oben_re").on(CONDITIONS.GRENZEN),
            ]),

         new VisualElement("hp_asig_schuten").on(CONDITIONS.BAHNHOF),
         new VisualElement("hp_bk_schute_unten").on(CONDITIONS.STRECKE),
         new VisualElement("hp_bk_schute_oben").on(CONDITIONS.GRENZEN),

         new VisualElement()
            .on("VRsig")
            .childs([
               "vr_schirm",
               "vr_lichtp",
               new VisualElement("vr_zusatz_schirm,vr_zusatz_lichtp").on("vr_op=verk"),
               new VisualElement("vr_zusatz_licht").on("vr_op=verk").on("verk=1").off("hp=0"),
               new VisualElement()
                  .off("hp=0")
                  .childs([
                     new VisualElement("vr_gelb_oben,vr_gelb_unten").on("vr=0"),
                     new VisualElement("vr_grün_oben,vr_grün_unten").on("vr=1"),
                     new VisualElement("vr_gelb_unten,vr_grün_oben").on("vr=2"),
                  ]),
               "vr_schuten",
               new VisualElement("vr_zusatz_schute").on("vr_op=verk"),
            ]),
         new VisualElement()
            .on(CONDITIONS.BAHNHOF)
            .childs([
               "hp_asig_kennlicht_lichtp",
               new VisualElement("hp_asig_kennlicht_licht").on("ersatz=kennlicht").off("hp>=0"),
               "hp_asig_kennlicht_schute",
            ]),

         new VisualElement()
            .on(CONDITIONS.BAHNHOF)
            .childs(["hp_asig_sh1_lichtp", new VisualElement("hp_asig_sh1_licht").on("ersatz=sh1").off("hp>0"), "hp_asig_sh1_schute"]),

         new VisualElement()
            .on([CONDITIONS.Asig, CONDITIONS.Zsig, CONDITIONS.SBK])
            .childs(["hp_zs1_lichtp", new VisualElement("hp_zs1_licht").on("ersatz=zs1").off("hp>0"), "hp_zs1_schuten"]),

         new VisualElement()
            .on([CONDITIONS.Esig, CONDITIONS.Zsig])
            .childs(["hp_zs7_lichtp", new VisualElement("hp_zs7_licht").on("ersatz=zs7").off("hp>0"), "hp_zs7_schuten"]),

         new VisualElement()
            .on([CONDITIONS.Asig, CONDITIONS.BKsig])
            .childs(["hp_zs1_lichtp", new VisualElement("hp_zs1_licht").on("ersatz=zs8").off("hp>0").blinkt(true), "hp_zs1_schuten"]),

         new VisualElement()
            .on("zs3>0")
            .off("zs3=40||zusatz_oben")
            .childs(["zs3", new TextElement("zs3", "bold 80px Arial").pos([115, 80])]),

         new VisualElement()
            .on("zs3v>0")
            .off("zusatz_unten")
            .childs(["zs3v", new TextElement("zs3v", "bold 80px Arial", "#ffde36").pos([115, 890])]),

         new VisualElement("zs3_licht").on("zusatz_oben").childs([new TextElement("zs3", "60px DOT").pos([120, 78]).on("zs3>0").off("hp<=0")]),
         new VisualElement("zs3v_licht")
            .on("zusatz_unten")
            .childs([new TextElement("zs3v", "60px DOT", "#ffde36").pos([120, 885]).on("zs3v>0").off("hp<=0")]),
         new VisualElement()
            .on([CONDITIONS.Asig, CONDITIONS.BKsig])
            .on("zs6=1")
            .off("zs3v>0")
            .childs([new VisualElement("zs6_blech_unten").off("zusatz_unten"), new VisualElement("zs6_licht_unten").on("zusatz_unten").on("hp>0")]),
         new VisualElement("schild").on("bez").childs([new TextElement("bez", "bold 55px condenced", "#333").pos([116, 1033])]),
         ,
      ],
      ["hp=0", "vr=0", "HPsig", "verw=asig", "mastschild=wrw"]
   );
   t.scale = 0.15;
   t.previewsize = 20;
   t.distance_from_track = 5;
   t.checkSignalDependency = checkSignalDependencyFunction4HV;
   t.addRule("hp>0 && zs3>6", "hp=1");
   t.addRule("hp>0 && zs3<=6 && zs3>0", "hp=2");
   t.createSignalCommandMenu(lightMenu);
   signalTemplates.hv_hp = t;

   t = new SignalTemplate(
      "hv_vr",
      "Hv Vorsignal",
      "hv",
      [
         "mast,vr_schirm,vr_lichtp",
         new VisualElement("ne2").off("vr_op=wdh"),
         new VisualElement("vr_zusatz_schirm,vr_zusatz_lichtp").on(["vr_op=verk", "vr_op=wdh"]),
         new VisualElement("vr_zusatz_licht").on("vr_op=verk").on("verk=1"),
         new VisualElement("vr_zusatz_licht").on("vr_op=wdh"),
         new VisualElement().childs([
            new VisualElement("vr_gelb_oben,vr_gelb_unten").on("vr=0"),
            new VisualElement("vr_grün_oben,vr_grün_unten").on("vr=1"),
            new VisualElement("vr_gelb_unten,vr_grün_oben").on("vr=2"),
         ]),
         "vr_schuten",
         new VisualElement("vr_zusatz_schute").on("vr_op=verk"),
         new VisualElement()
            .on("zs3v>0")
            .off("zusatz_unten")
            .childs(["zs3v", new TextElement("zs3v", "bold 80px Arial", "#ffde36").pos([115, 890])]),
         new VisualElement("zs3v_licht").on("zusatz_unten").childs([new TextElement("zs3v", "60px DOT", "#ffde36").pos([120, 885]).on("zs3v>0")]),
      ],
      ["vr=0", "VRsig"]
   );
   t.scale = 0.15;
   t.distance_from_track = 4;
   t.checkSignalDependency = checkSignalDependencyFunction4HV;
   t.createSignalCommandMenu(["vr=0,vr=1,vr=2", "verk=1(verk)", "zs3v"]);
   signalTemplates.hv_vr = t;

   //KS Hauptsignal
   t = new SignalTemplate(
      "ks",
      "Ks Hauptsignal",
      "ks",
      [
         new VisualElement("zs3_licht").on("zusatz_oben").childs([new TextElement("zs3", "85px DOT").pos([90, 40]).on("zs3>0").off("hp<=0")]),

         new VisualElement()
            .on("zs3>0")
            .off("!zusatz_oben")
            .childs(["zs3", new TextElement("zs3", "bold 80px Arial").pos([85, 80])]),
         "mast",
         "schirm_hp",
         "wrw",

         new VisualElement().on("VRsig").childs(["ks1_2_optik_hpvr", new VisualElement("ks2").on("hp=2")]),
         new VisualElement("ks1_optik_hp").off("VRsig"),

         new VisualElement()
            .on("hp=1")
            .childs([
               new VisualElement("ks1_hpvr").on("VRsig").on("zs3v>0").blinkt(true),
               new VisualElement("ks1_hpvr").on("VRsig").off("zs3v>0"),
               new VisualElement("ks1_hp").off("VRsig").on("zs3v>0").blinkt(true),
               new VisualElement("ks1_hp").off("VRsig||zs3v>0"),
            ]),

         new VisualElement("möhre").on("VRsig"),
         new VisualElement("hp0").on("hp=0"),
         new VisualElement()
            .on([CONDITIONS.Asig, CONDITIONS.BKsig, CONDITIONS.SBK])
            .childs(["zs1_optik", new VisualElement("zs1").on("ersatz=zs1").off("hp>0").blinkt(true)]),

         new VisualElement().on([CONDITIONS.Esig, CONDITIONS.Zsig]).childs(["zs7_optik", new VisualElement("zs7").on("ersatz=zs7").off("hp>0")]),
         ,
         new VisualElement().on(CONDITIONS.BAHNHOF).childs(["sh1_optik", "zs1_optik", new VisualElement("zs1,sh1").on("ersatz=sh1").off("hp>0")]),

         new VisualElement()
            .on("vr_op=verk&&VRsig")
            .childs(["kennlicht_optik", new VisualElement("kennlicht").on("verk=1").off("hp=0||hp=1&&zs3v<=0")]),
         ,
         new VisualElement().on(CONDITIONS.BAHNHOF).childs(["kennlicht_optik", new VisualElement("kennlicht").on("ersatz=kennlicht").off("hp>=0")]),

         new VisualElement()
            .on("zs3v>0")
            .off("zusatz_unten")
            .childs(["zs3v", new TextElement("zs3v", "bold 80px Arial", "#ffde36").pos([85, 490])]),

         new VisualElement("zs6_licht").on("zs6=1").on("zusatz_oben").off("hp<=0||zs3>0"),

         new VisualElement("zs3v_licht")
            .on("zusatz_unten")
            .childs([new TextElement("zs3v", "85px DOT", "#ffde36").on("zs3v>0").off("hp<=0").pos([90, 520])]),

         new VisualElement("schild").on("bez").childs([new TextElement("bez", "bold 55px condenced", "#333").pos([85, 634])]),
      ],
      ["HPsig", CONDITIONS.Asig, "hp=0"]
   );
   t.scale = 0.15;
   t.distance_from_track = 15;
   t.createSignalCommandMenu([
      ["hp=0,hp=1(Ks 1),hp=2(Ks 2)", "zs3"],
      "zs3v",
      "ersatz=zs1,ersatz=zs7,ersatz=zs8,ersatz=sh1,ersatz=kennlicht",
      "verk=1(Verk)",
      "zs6=1(Zs 6)",
   ]);

   //signal: ist das signal, dessen Stellung wir gerade setzen
   //hp: ist das signal, dessen Stellung wir vorsignalisieren wollen
   t.checkSignalDependency = function (signal, hp) {
      //make sure we only handle main signals
      if (!hp.check("HPsig") || !signal.check("VRsig")) return;
      let stop_propagation = false;
      //-1 heißt, das Signal ist vom User ausgeschaltet
      if (signal.get("hp") != -1) {
         //Das Hauptsignal zeigt nicht Hp 0 oder es ist ein alleinstehndes Vorsignal
         let anderes_zs3 = hp.get("zs3");
         let eigenes_zs3 = signal.get("zs3");
         if (!signal.check("HPsig") || signal.get("hp") != 0) {
            let x = hp.get("hp");

            switch (hp._template.id) {
               case "Hv77":
               case "hv_hp":
               case "hv_vr":
                  {
                     signal.set_stellung("hp", x >= 1 ? 1 : 2, false);
                     if (x == 2 && anderes_zs3 <= 0) anderes_zs3 = 4;

                     if (!signal.check("vr_op=wdh")) stop_propagation = true;
                  }
                  break;
               case "Hl":
               case "ks":
               case "ks_vr":
                  {
                     signal.set_stellung("hp", x <= 0 ? 2 : 1, false);

                     if (!signal.check("vr_op=wdh")) stop_propagation = true;
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
         new VisualElement("ks2_vr").on("hp=2"),

         new VisualElement().on("hp=1").childs([new VisualElement("ks1_vr").on("zs3v>0").blinkt(true), new VisualElement("ks1_vr").off("zs3v>0")]),

         new VisualElement().on("vr_op.wdh").childs(["sh1_optik", new VisualElement("verk").off("hp=0||hp=1&&zs3v<=0")]),

         new VisualElement("ne2").off("vr_op.wdh"),

         new VisualElement().on("vr_op.verk").childs(["verk_optik", new VisualElement("verk").off("hp=0||hp=1&&zs3v<=0")]),

         new VisualElement()
            .on("zs3v>0")
            .off("zusatz_unten")
            .childs(["zs3v", new TextElement("zs3v", "bold 80px Arial", "#ffde36").pos([85, 490])]),

         new VisualElement("zs3v_licht")
            .on("zusatz_unten")
            .childs([new TextElement("zs3v", "85px DOT", "#ffde36").on("zs3v>0").off("hp<=0").pos([90, 520])]),
      ],
      ["VRsig", "hp=2"]
   );
   t.scale = 0.13;
   t.distance_from_track = 15;
   t.createSignalCommandMenu(["hp=1(Ks 1),hp=2(Ks 2)", "zs3v", "ersatz=kennlicht"]);

   t.checkSignalDependency = signalTemplates.ks.checkSignalDependency;
   signalTemplates.ks_vr = t;

   //ls
   t = new SignalTemplate(
      "ls",
      "Lichtsperrsignal",
      "ls",
      [
         "basis",
         "wrw",
         "lp_r_links",
         "lp_r_rechts",
         "lp_w_oben",
         "lp_w_unten",
         new VisualElement("r_links,r_rechts").on("hp=0"),
         new VisualElement("w_oben,w_unten").on("hp=1"),
         new VisualElement("w_oben").on("ersatz=kennlicht"),
         "schute_r_links",
         "schute_r_rechts",
         "schute_w_oben",
         "schute_w_unten",
         new VisualElement("schild").on("bez").childs([new TextElement("bez", "bold 55px condenced", "#333").pos([210, 125])]),
      ],
      "hp=0"
   );
   t.scale = 0.07;
   t.createSignalCommandMenu(["hp=0,hp=1(Sh 1)", "ersatz=kennlicht(Kennlicht)"]);
   signalTemplates.ls = t;

   signalTemplates.ne4 = new SignalTemplate("ne4", "Ne 4", "basis");
   signalTemplates.ne4.scale = 0.2;
   signalTemplates.ne4.previewsize = 10;

   signalTemplates.ne1 = new SignalTemplate("ne1", "Ne 1", "basis", ["ne1", new TextElement("ne1", "bold 20px Arial").pos([100, 105])]);
   signalTemplates.ne1.scale = 0.15;
   signalTemplates.ne1.distance_from_track = 5;
   signalTemplates.ne2 = new SignalTemplate("ne2", "Ne 2", "basis");
   signalTemplates.ne2.scale = 0.25;
   signalTemplates.ne2.previewsize = 20;

   signalTemplates.lf6 = new SignalTemplate(
      "lf6",
      "Lf 6",
      "basis",
      ["lf6", new TextElement("geschw", "bold 110px Arial", "#333").pos([98, 8])],
      ["slave", "geschw=9"]
   );
   signalTemplates.lf6.createSignalCommandMenu(["geschw()"]);
   signalTemplates.lf6.scale = 0.12;

   signalTemplates.lf7 = new SignalTemplate(
      "lf7",
      "Lf 7",
      "basis",
      ["lf7", new TextElement("geschw", "bold 130px Arial", "#333").pos([55, 20])],
      ["master", "geschw=9"]
   );
   signalTemplates.lf7.createSignalCommandMenu(["geschw()"]);
   signalTemplates.lf7.scale = 0.15;
   signalTemplates.lf7.previewsize = 30;

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
      "basis",
      ["zs3", new TextElement("geschw", "bold 110px Arial").pos([90, 60])],
      "geschw=9"
   );

   signalTemplates.zs3.createSignalCommandMenu(["geschw()"]);
   signalTemplates.zs3.scale = 0.15;

   signalTemplates.zs10 = new SignalTemplate("zs10", "Zs 10", "basis");
   signalTemplates.zs10.scale = 0.2;
   signalTemplates.zs10.previewsize = 15;

   signalTemplates.ra10 = new SignalTemplate("ra10", "Ra 10", "basis");
   signalTemplates.ra10.scale = 0.15;

   signalTemplates.zs6 = new SignalTemplate("zs6", "Zs 6", "basis", ["zs6_blech_mast", "zs6_blech"]);
   signalTemplates.zs6.scale = 0.2;
   signalTemplates.zs6.previewsize = 30;

   signalTemplates.zusatzSignal = new SignalTemplate(
      "zusatz",
      "Zusatzanzeiger",
      "basis",
      ["zusatzanzeiger", new VisualElement("zs6_licht").on("zs6=1"), new TextElement("zs3", "85px DOT").pos([70, 40]).off("zs6=1").on("zs3>0")],
      "zs6=1"
   );
   signalTemplates.zusatzSignal.scale = 0.15;
   signalTemplates.zusatzSignal.createSignalCommandMenu([["zs6=1(Zs 6)"], "zs3()"]);
   signalTemplates.zusatzSignal.previewsize = 30;
}
