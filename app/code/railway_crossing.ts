"use strict";

import { Application } from "./application.ts";
import { CONFIG } from "./config.ts";
import { EditorCommitter } from "./editorCommitter.ts";
import { Track } from "./track.ts";
import { CrossingStreetLights } from "./crossingStreetLights.ts";
import { geometry, Point, type IPoint } from "./tools.ts";
import { railwayCrossingRenderer } from "./rendering/RailwayCrossingRenderer.ts";
import { Sig_UI } from "./sig_ui.ts";

export type CrossingApproachSide = "min" | "max";

export interface RailwayCrossingEntry {
   track: Track | null;
   trackId: number;
   km: number;
}

export interface CrossingRange {
   startKm: number;
   endKm: number;
}

export interface RoadMarkingLine {
   start: Point;
   end: Point;
   width: number;
}

export interface CrossingDecorationPlacement {
   position: Point;
   rotation: number;
   scale: number;
   side?: CrossingApproachSide;
}

interface CrossingObject {
   id: number;
   center: IPoint;
   trackAngle: number;
   streetWidth: number;
   streetLength: number;
   secured?: number;
   streetLightAspects?: Record<string, unknown>;
   entries: { trackId: number; km: number }[];
}

export class RailwayCrossing {
   static allCrossings: RailwayCrossing[] = [];
   static counter = 0;
   static DEFAULT_STREET_WIDTH = CONFIG.GRID_SIZE * 2.5;
   static DEFAULT_STREET_LENGTH = CONFIG.GRID_SIZE * 4;
   static STREET_OVERHANG = CONFIG.GRID_SIZE * 3;
   static ROAD_MARKING_COLOR = "#cccccc";
   static ROAD_MARKING_WIDTH = 2;
   static ROAD_MARKING_EDGE_PADDING = CONFIG.GRID_SIZE * 0.10;
   static ROAD_MARKING_STOP_LINE_WIDTH = 5;
   static ROAD_MARKING_STOP_LINE_DISTANCE = CONFIG.GRID_SIZE * 0.75;
   static HIT_TEST_DISTANCE = 10;
   static STREET_SIGN_OFFSET_STREET = -75;
   static STREET_SIGN_OFFSET_TRACK = 0;
   static STREET_SIGN_ROTATION_OFFSET = 270;

   id: number;
   center: Point;
   trackAngle: number;
   streetWidth: number;
   streetLength: number;
   entries: RailwayCrossingEntry[];
   secured = 0;
   streetLightAspects: Record<string, unknown> = {};
   readonly streetLights: CrossingStreetLights;

   constructor(
      center: Point,
      trackAngle: number,
      entries: RailwayCrossingEntry[],
      streetWidth = RailwayCrossing.DEFAULT_STREET_WIDTH,
      streetLength = RailwayCrossing.DEFAULT_STREET_LENGTH
   ) {
      this.id = RailwayCrossing.counter++;
      this.center = center;
      this.trackAngle = trackAngle;
      this.entries = entries;
      this.streetWidth = streetWidth;
      this.streetLength = streetLength;
      this.streetLights = new CrossingStreetLights(this);
   }

   setSecured(value: number): void {
      const next = value ? 1 : 0;
      if (this.secured === next) return;
      this.secured = next;
      this.refreshStreetSignDisplays();
   }

   refreshStreetSignDisplays(): void {
      this.streetLights.markChanged();
      const rm = Application.getInstance().renderingManager;
      if (rm) railwayCrossingRenderer.redrawStreetSigns(rm, this);
   }

   static createAt(anchorTrack: Track, clickPoint: Point): RailwayCrossing | null {
      const anchorPoint = geometry.nearestPointOnLine(anchorTrack.start, anchorTrack.end, clickPoint);
      const anchorKm = anchorTrack.getKmfromPoint(anchorPoint);
      const center = anchorTrack.getPointFromKm(anchorKm);
      const entries = RailwayCrossing.findAffectedEntries(anchorTrack, center);

      if (entries.length === 0) return null;
      const crossing = new RailwayCrossing(center, anchorTrack.rad, entries);
      return crossing;
   }

   static findNearestTrack(point: Point): Track | null {
      let nearestTrack: Track | null = null;
      let nearestDistance = Number.POSITIVE_INFINITY;

      Track.allTracks.forEach((track) => {
         const distance = geometry.pointToSegmentDistance(point, track.start, track.end);
         if (distance <= CONFIG.GRID_SIZE / 2 && distance < nearestDistance) {
            nearestTrack = track;
            nearestDistance = distance;
         }
      });

      return nearestTrack;
   }

   static findAffectedEntries(anchorTrack: Track, center: Point, streetWidth = RailwayCrossing.DEFAULT_STREET_WIDTH, streetLength = RailwayCrossing.DEFAULT_STREET_LENGTH): RailwayCrossingEntry[] {
      const streetUnit = geometry.perpendicular(anchorTrack.unit);
      const halfLength = streetLength / 2;
      const streetLine = {
         start: center.add(streetUnit.multiply(-halfLength)),
         end: center.add(streetUnit.multiply(halfLength)),
      };
      const entries: RailwayCrossingEntry[] = [];

      Track.allTracks.forEach((track) => {
         if (!RailwayCrossing.areTracksParallel(anchorTrack, track)) return;

         const point = geometry.getIntersectionPoint(
            { start: track.start, end: track.end },
            streetLine
         );
         if (!point) return;

         const km = track.getKmfromPoint(point);
         if (!RailwayCrossing.canFitOnTrack(track, km, streetWidth)) return;

         entries.push({ track, trackId: track.id, km });
      });

      return entries.sort((a, b) => {
         if (a.track === anchorTrack) return -1;
         if (b.track === anchorTrack) return 1;
         return a.km - b.km;
      });
   }

   static areTracksParallel(anchorTrack: Track, track: Track): boolean {
      return Math.abs(anchorTrack.unit.dot(track.unit)) > 0.999;
   }

   static canFitOnTrack(track: Track, km: number, streetWidth: number): boolean {
      const { min, max } = RailwayCrossing.kmRangeOnTrack(track, streetWidth);
      return km >= min && km <= max;
   }

   static kmRangeOnTrack(track: Track, streetWidth: number): { min: number; max: number } {
      const halfWidth = streetWidth / 2;
      const startMargin = track.switchAtTheStart ? CONFIG.GRID_SIZE / 2 : 0;
      const endMargin = track.switchAtTheEnd ? CONFIG.GRID_SIZE / 2 : 0;
      return {
         min: startMargin + halfWidth,
         max: track.length - endMargin - halfWidth,
      };
   }

   anchorEntry(): RailwayCrossingEntry | undefined {
      return this.entries.find((entry) => entry.track != null);
   }

   moveToPointOnAnchorTrack(point: Point): boolean {
      const anchor = this.anchorEntry();
      if (!anchor?.track) return false;

      const track = anchor.track;
      const projected = geometry.nearestPointOnLine(track.start, track.end, point);
      const range = RailwayCrossing.kmRangeOnTrack(track, this.streetWidth);
      if (range.min > range.max) return false;

      const km = Math.max(range.min, Math.min(range.max, track.getKmfromPoint(projected)));
      this.center = track.getPointFromKm(km);
      this.trackAngle = track.rad;
      this.streetLength = Math.max(this.streetLength, RailwayCrossing.DEFAULT_STREET_LENGTH);
      this.entries = RailwayCrossing.findAffectedEntries(track, this.center, this.streetWidth, this.streetLength);
      return this.entries.length > 0;
   }

   static rangesForTrack(track: Track): CrossingRange[] {
      return RailwayCrossing.allCrossings
         .flatMap((crossing) => crossing.entries
            .filter((entry) => entry.track === track)
            .map((entry) => crossing.rangeForEntry(entry)))
         .sort((a, b) => a.startKm - b.startKm);
   }

   static removeTrackReference(track: Track): void {
      RailwayCrossing.allCrossings.forEach((crossing) => {
         crossing.entries = crossing.entries.filter((entry) => entry.track !== track);
      });
      RailwayCrossing.allCrossings = RailwayCrossing.allCrossings.filter((crossing) => crossing.entries.length > 0);
   }

   static removeCrossing(crossing: RailwayCrossing): void {
      RailwayCrossing.allCrossings = RailwayCrossing.allCrossings.filter((item) => item !== crossing);
   }

   static initEditMenu(crossing: RailwayCrossing): void {
      $("#inputRailwayCrossingWidth")
         .off()
         .val(crossing.streetWidth)
         .on("input", function (this: HTMLInputElement) {
            const width = Number(this.value);
            if (!Number.isFinite(width) || width <= 0) return;

            crossing.streetWidth = width;
            crossing.refreshFromAnchor();
            const rm = Application.getInstance().renderingManager!;
            rm.renderer.reDrawEverything(true);
            rm.renderer.updateSelection();
            rm.update();
         })
         .on("change", () => {
            EditorCommitter.commit();
         });

      Sig_UI.initSignalAspectsMenu(
         crossing.streetLights,
         "#crossingStreetLightMenu",
         () => EditorCommitter.commit()
      );

      const refreshStreetLightMenu = () => {
         Sig_UI.initSignalAspectsMenu(
            crossing.streetLights,
            "#crossingStreetLightMenu",
            () => EditorCommitter.commit()
         );
      };

      Sig_UI.initConfigOptionsMenu(
         crossing.streetLights,
         "#crossingStreetLightConfigMenu",
         () => EditorCommitter.commit(),
         refreshStreetLightMenu
      );

      $("#btnRemoveRailwayCrossing")
         .off()
         .onclick(() => {
            Application.getInstance().deleteSelectedObject();
         });
   }

   static refreshAfterTrackGeometryChange(track: Track, oldStart?: Point): void {
      const addedLength = oldStart ? geometry.distance(oldStart, track.start) : 0;

      RailwayCrossing.allCrossings.forEach((crossing) => {
         crossing.entries.forEach((entry) => {
            if (entry.track === track && oldStart) entry.km += addedLength;
         });
         if (crossing.entries.some((entry) => entry.track === track)) {
            crossing.refreshFromAnchor();
         }
      });
      RailwayCrossing.allCrossings = RailwayCrossing.allCrossings.filter((crossing) => crossing.entries.length > 0);
   }

   static FromObject(o: CrossingObject): RailwayCrossing {
      const crossing = new RailwayCrossing(
         Point.fromPoint(o.center),
         o.trackAngle,
         o.entries.map((entry) => ({ track: null, trackId: entry.trackId, km: entry.km })),
         o.streetWidth,
         Math.max(o.streetLength, RailwayCrossing.DEFAULT_STREET_LENGTH)
      );
      crossing.id = o.id;
      crossing.secured = o.secured ?? 0;
      crossing.streetLightAspects = o.streetLightAspects ? { ...o.streetLightAspects } : {};
      return crossing;
   }

   relinkTracks(): void {
      this.entries = this.entries
         .map((entry) => ({
            ...entry,
            track: Track.allTracks.find((track) => track.id === entry.trackId) ?? null,
         }))
         .filter((entry) => entry.track != null);
   }

   rangeForEntry(entry: RailwayCrossingEntry): CrossingRange {
      const halfWidth = this.streetWidth / 2;
      return { startKm: entry.km - halfWidth, endKm: entry.km + halfWidth };
   }

   refreshFromAnchor(): void {
      const anchor = this.entries.find((entry) => entry.track != null);
      if (!anchor?.track || !RailwayCrossing.canFitOnTrack(anchor.track, anchor.km, this.streetWidth)) {
         this.entries = [];
         return;
      }

      this.center = anchor.track.getPointFromKm(anchor.km);
      this.trackAngle = anchor.track.rad;
      this.streetLength = Math.max(this.streetLength, RailwayCrossing.DEFAULT_STREET_LENGTH);
      this.entries = RailwayCrossing.findAffectedEntries(anchor.track, this.center, this.streetWidth, this.streetLength);
   }

   streetPolygon(padding = 0): Point[] {
      const frame = this.streetFrame(padding);
      const widthVector = this.scaled(frame.trackUnit, frame.halfWidth);
      const lengthVector = this.scaled(frame.streetUnit, frame.halfLength);

      return [
         frame.center.add(lengthVector).add(widthVector),
         frame.center.add(lengthVector).sub(widthVector),
         frame.center.sub(lengthVector).sub(widthVector),
         frame.center.sub(lengthVector).add(widthVector),
      ];
   }

   roadMarkings(): RoadMarkingLine[] {
      const frame = this.streetFrame();
      const edgeOffset = Math.max(0, frame.halfWidth - RailwayCrossing.ROAD_MARKING_EDGE_PADDING);
      const lines: RoadMarkingLine[] = [
         this.markingLine(frame, -frame.halfLength, edgeOffset, frame.halfLength, edgeOffset),
         this.markingLine(frame, -frame.halfLength, -edgeOffset, frame.halfLength, -edgeOffset),
         this.markingLine(frame, -frame.halfLength, 0, frame.halfLength, 0),
      ];

      const stopGeometry = this.stopLineGeometry(frame);
      if (stopGeometry) {
         lines.push(this.stopLine(frame, stopGeometry.minStop, 0, -stopGeometry.stopLaneEdge));
         lines.push(this.stopLine(frame, stopGeometry.maxStop, 0, stopGeometry.stopLaneEdge));
      }

      return lines;
   }

   streetSignPlacements(): CrossingDecorationPlacement[] {
      const frame = this.streetFrame();
      const stopGeometry = this.stopLineGeometry(frame);
      if (!stopGeometry) return [];

      const streetOffset = RailwayCrossing.STREET_SIGN_OFFSET_STREET;
      const trackOffset = RailwayCrossing.STREET_SIGN_OFFSET_TRACK;
      const rotationOffset = RailwayCrossing.STREET_SIGN_ROTATION_OFFSET;
      const { minStop, maxStop, stopLaneEdge } = stopGeometry;

      const minStopFacing = this.scaled(frame.streetUnit, -1);
      const maxStopFacing = frame.streetUnit;

      return [
         {
            side: "min",
            position: this.localStreetPoint(
               frame,
               minStop + streetOffset,
               -stopLaneEdge - trackOffset
            ),
            rotation: Math.atan2(minStopFacing.y, minStopFacing.x) * (180 / Math.PI) + rotationOffset,
            scale: 1,
         },
         {
            side: "max",
            position: this.localStreetPoint(
               frame,
               maxStop - streetOffset,
               stopLaneEdge + trackOffset
            ),
            rotation: Math.atan2(maxStopFacing.y, maxStopFacing.x) * (180 / Math.PI) + rotationOffset,
            scale: 1,
         },
      ];
   }

   gatePlacements(): CrossingDecorationPlacement[] {
      return [];
   }

   private renderHalfLength(streetUnit: IPoint): number {
      const projections = this.entryStreetProjections(streetUnit);
      if (projections.length === 0) return RailwayCrossing.STREET_OVERHANG;

      const halfSpan = (Math.max(...projections) - Math.min(...projections)) / 2;
      return halfSpan + RailwayCrossing.STREET_OVERHANG;
   }

   private stopLineGeometry(frame: ReturnType<RailwayCrossing["streetFrame"]>): {
      minStop: number;
      maxStop: number;
      stopLaneEdge: number;
   } | null {
      const projections = this.entryStreetProjections(frame.streetUnit);
      if (projections.length === 0) return null;

      const stopLaneEdge = Math.max(0, frame.halfWidth - RailwayCrossing.ROAD_MARKING_EDGE_PADDING);
      return {
         minStop: Math.min(...projections) - frame.centerOffset - RailwayCrossing.ROAD_MARKING_STOP_LINE_DISTANCE,
         maxStop: Math.max(...projections) - frame.centerOffset + RailwayCrossing.ROAD_MARKING_STOP_LINE_DISTANCE,
         stopLaneEdge,
      };
   }

   private streetFrame(padding = 0): {
      center: Point;
      centerOffset: number;
      trackUnit: IPoint;
      streetUnit: IPoint;
      halfWidth: number;
      halfLength: number;
   } {
      const trackUnit = new Point(Math.cos(this.trackAngle), Math.sin(this.trackAngle));
      const streetUnit = geometry.perpendicular(trackUnit);
      const projections = this.entryStreetProjections(streetUnit);
      const centerOffset = projections.length > 0 ? (Math.min(...projections) + Math.max(...projections)) / 2 : 0;

      return {
         center: this.center.add(this.scaled(streetUnit, centerOffset)),
         centerOffset,
         trackUnit,
         streetUnit,
         halfWidth: this.streetWidth / 2 + padding,
         halfLength: this.renderHalfLength(streetUnit) + padding,
      };
   }

   private markingLine(
      frame: { center: Point; trackUnit: IPoint; streetUnit: IPoint },
      startStreet: number,
      startTrack: number,
      endStreet: number,
      endTrack: number
   ): RoadMarkingLine {
      return {
         start: this.localStreetPoint(frame, startStreet, startTrack),
         end: this.localStreetPoint(frame, endStreet, endTrack),
         width: RailwayCrossing.ROAD_MARKING_WIDTH,
      };
   }

   private stopLine(
      frame: { center: Point; trackUnit: IPoint; streetUnit: IPoint },
      streetOffset: number,
      startTrack: number,
      endTrack: number
   ): RoadMarkingLine {
      return {
         start: this.localStreetPoint(frame, streetOffset, startTrack),
         end: this.localStreetPoint(frame, streetOffset, endTrack),
         width: RailwayCrossing.ROAD_MARKING_STOP_LINE_WIDTH,
      };
   }

   private localStreetPoint(
      frame: { center: Point; trackUnit: IPoint; streetUnit: IPoint },
      streetOffset: number,
      trackOffset: number
   ): Point {
      return frame.center.add(this.scaled(frame.streetUnit, streetOffset)).add(this.scaled(frame.trackUnit, trackOffset));
   }

   private scaled(unit: IPoint, length: number): Point {
      return new Point(unit.x * length, unit.y * length);
   }

   private entryStreetProjections(streetUnit: IPoint): number[] {
      return this.entries
         .filter((entry) => entry.track != null)
         .map((entry) => {
            const point = entry.track!.getPointFromKm(entry.km);
            return (point.x - this.center.x) * streetUnit.x + (point.y - this.center.y) * streetUnit.y;
         });
   }

   hitPolygon(): Point[] {
      return this.streetPolygon(RailwayCrossing.HIT_TEST_DISTANCE);
   }

   stringify(): any {
      return {
         _class: "RailwayCrossing",
         id: this.id,
         center: this.center,
         trackAngle: this.trackAngle,
         streetWidth: this.streetWidth,
         streetLength: this.streetLength,
         secured: this.secured,
         streetLightAspects: this.streetLightAspects,
         entries: this.entries.map((entry) => ({ trackId: entry.track?.id ?? entry.trackId, km: entry.km })),
      };
   }
}
