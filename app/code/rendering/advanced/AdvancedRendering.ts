"use strict";

import type { Switch } from "../../switch.ts";
import { TrackRenderingBase } from "../TrackRenderingBase.ts";
import { SCHWELLEN_VARIANTEN, TRACK_SCALE } from "./constants.ts";
import { AdvancedRendererCore } from "./AdvancedRendererCore.ts";
import { AdvancedTrackCalculations } from "./AdvancedTrackCalculations.ts";
import { AdvancedSwitchCalculations } from "./AdvancedSwitchCalculations.ts";
import { AdvancedGenericElements } from "./AdvancedGenericElements.ts";
import { AdvancedTrackRendering } from "./AdvancedTrackRendering.ts";
import { AdvancedSleeperRendering } from "./AdvancedSleeperRendering.ts";
import { AdvancedSwitchRendering } from "./AdvancedSwitchRendering.ts";

export class AdvancedRendering extends TrackRenderingBase {
   readonly core: AdvancedRendererCore;
   readonly trackCalculations: AdvancedTrackCalculations;
   readonly switchCalculations: AdvancedSwitchCalculations;
   readonly genericElements: AdvancedGenericElements;
   readonly trackRendering: AdvancedTrackRendering;
   readonly sleeperRendering: AdvancedSleeperRendering;
   readonly switchRendering: AdvancedSwitchRendering;

   LOD: number;
   _lastRenderScale: number;
   _bitmapCache: any[];
   _idleCallback: any;
   _rendering: any;

   schwellenImg: any;
   bumperImg: any;
   sleepersImgWidth: number = 0;
   schwellenHöhe: number = 0;
   schwellenHöhe_2: number = 0;
   schwellenBreite: number = 0;
   schwellenGap: number = 0;
   sleeperIntervall: number = 0;
   rail_offset: number = 0;
   rail_distance: number = 0;
   TRAIN_HEIGHT: number = 0;

   constructor() {
      super();
      this.LOD = 2;
      this._lastRenderScale = 0;
      this._bitmapCache = new Array(SCHWELLEN_VARIANTEN);

      this.core = new AdvancedRendererCore(this);
      this.trackCalculations = new AdvancedTrackCalculations(this);
      this.switchCalculations = new AdvancedSwitchCalculations(this);
      this.genericElements = new AdvancedGenericElements(this);
      this.trackRendering = new AdvancedTrackRendering(this);
      this.sleeperRendering = new AdvancedSleeperRendering(this);
      this.switchRendering = new AdvancedSwitchRendering(this);
   }

   calcRenderValues() {
      this.schwellenImg = this.app.preLoader!.getImage("schwellen");
      this.bumperImg = this.app.preLoader!.getImage("bumper");
      this.sleepersImgWidth = this.schwellenImg.width / SCHWELLEN_VARIANTEN;
      this.schwellenHöhe = this.schwellenImg.height * TRACK_SCALE;
      this.schwellenHöhe_2 = this.schwellenHöhe / 2;
      this.schwellenBreite = this.sleepersImgWidth * TRACK_SCALE;
      this.schwellenGap = this.schwellenBreite * 1.1;
      this.sleeperIntervall = this.schwellenBreite + this.schwellenGap;
      this.rail_offset = this.schwellenHöhe / 4.7;
      this.rail_distance = this.schwellenHöhe_2 - this.rail_offset;

      this.TRAIN_HEIGHT = this.schwellenHöhe - this.rail_offset;

      this.SIGNAL_DISTANCE_FROM_TRACK = this.schwellenHöhe / 2;
   }

   reDrawEverything(force = false, render_outside_viewport = false) {
      return this.core.reDrawEverything(force, render_outside_viewport);
   }

   renderAllGenericObjects() {
      return this.genericElements.renderAllGenericObjects();
   }

   renderAllSignals() {
      return this.core.renderAllSignals();
   }

   renderSwitchUI(sw: Switch) {
      return this.switchRendering.renderSwitchUI(sw);
   }

   protected trainCarHeight(): number {
      return this.TRAIN_HEIGHT;
   }
}
