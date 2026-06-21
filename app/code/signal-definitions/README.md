# Signal configuration JSON

Each signal type is defined by one JSON object in this folder (or an entry in `simple-signs.json`). At runtime, [`signalDefinitionBuilder.ts`](../signalDefinitionBuilder.ts) turns the JSON into a `SignalTemplate` used by the editor and renderer.

A minimal example:

```json
{
  "id": "hv_vr",
  "title": "Hv Vorsignal",
  "atlas": "hv",
  "scale": 0.125,
  "initial": ["vr=0", "VRsig"],
  "menu": ["vr=0,vr=1,vr=2", "advanceSpeed"],
  "elements": ["mast,vr_schirm"]
}
```

---

## Top-level keys

| Key | Required | Description |
|-----|----------|-------------|
| `id` | yes | Unique template identifier. Used in saved layouts and `signal_library.ts`. |
| `title` | yes | Display name in the UI. |
| `atlas` | yes | Sprite sheet name (PNG + JSON in `app/images/`). |
| `elements` | no | Visual tree of images and labels. If omitted, defaults to `[id]`. |
| `initial` | no | Aspects set when a new signal is placed. String or array of strings. |
| `scale` | no | Render scale (default `0.5`). |
| `previewsize` | no | Size hint for palette previews. |
| `menu` | no | Stellung (aspect) controls in the signal configuration panel. |
| `rules` | no | Automatic aspect corrections after each change. |
| `config_options` | no | Structural placement variants (e.g. bent vs straight mast, mastschild type). |
| `dependency` | no | Inter-signal communication via the semantic aspect bus. |

---

## String or array

Many properties accept **either a single value or an array**. The builder normalises both forms; pick whichever reads clearer in JSON.

| Property | Single value | Array | Effect |
|----------|--------------|-------|--------|
| `initial` | `"hp=0"` | `["hp=0", "VRsig"]` | Aspects set when the signal is placed. |
| `on`, `off` | `"vr=0"` | `["VRsig", "advanceSpeed>0"]` | **AND** — all conditions must match. Same as `"VRsig&&advanceSpeed>0"`. |
| `elements` | `"mast,schirm"` or `{ ... }` | `[ "mast", { ... } ]` | Root visual tree: each entry is a sprite string, visual object, text object, or nested array of those. |
| `children` | — | `["zs3v", { "text": "advanceSpeed" }]` | Child nodes under a visual group (always an array when present). |
| `image` | `"vr_gelb_oben"` | — | Multiple sprites in **one string**, comma-separated: `"vr_gelb_oben,vr_gelb_unten"`. |
| `menu` | one row per string | `["a", "b"]` on a row | Outer array = panel rows. Inner array = controls on the same row. |
| `rotation`, `flip` | `{ "element": "flügel", ... }` | `[{ ... }, { ... }]` | One transform or several (e.g. different aspects for different wing angles). |
| `rotation.element`, `flip.element` | `"lichtscheibe_oben"` | `["lichtscheibe_oben", "lichtscheibe_unten"]` | One labelled child or several animated together. |
| `dependency.when` | — | `["partner.HPsig", "self.VRsig"]` | **AND** — all must pass (only array form is used). |
| `dependency.unless` | — | `["self.vr=-1", "self.HPsig&&self.hp=0"]` | **OR** — handler skips if **any** entry matches (only array form is used). |
| `publish.currentSpeed` | `"currentSpeed"` | `[["hp=2&&currentSpeed<=0", 4], ["else", "currentSpeed"]]` | Shorthand “copy aspect” vs rule list (see `dependency`). |

**Examples**

```json
"initial": "VRsig"
```

```json
"initial": ["vr=0", "VRsig", "verw=asig"]
```

```json
"on": "hp=1"
```

```json
"on": ["VRsig", "advanceSpeed>0"]
```

```json
"off": "zusatz_unten||currentSpeed>0&&currentSpeed<=advanceSpeed"
```

```json
"elements": [
  "mast",
  { "image": "ks1_hp", "on": "hp=1" },
  ["zs3", { "text": "currentSpeed", "pos": [85, 70] }]
]
```

```json
"rotation": {
  "element": "flügel",
  "angle": 45,
  "pivot": [28, 162]
}
```

```json
"rotation": [
  { "element": "lichtscheibe_oben", "angle": 0, "pivot": [7, 63] },
  { "element": ["lichtscheibe_unten", "flügel"], "angle": 0, "pivot": [86, 62] }
]
```

---

## Aspects (signal state)

An **aspect** is a named value stored on each placed signal (`signal.get("hp")`, `signal.setSignalAspect("hp", 1)`). Aspects drive rendering (`on`/`off` conditions), menus, rules, and dependencies.

### Setting aspects in JSON

| Form | Meaning |
|------|---------|
| `"hp=0"` | Set aspect `hp` to `0`. |
| `"VRsig"` | Enable flag aspect `VRsig` (any truthy presence). |
| `"bez"` | Enable text aspect `bez` (value comes from user input). |

### Common aspect keys

| Aspect | Role |
|--------|------|
| `HPsig` | Main signal function enabled. |
| `VRsig` | Advance signal function enabled. |
| `master` / `slave` | Paired speed boards (Lf 7 / Lf 6). |
| `hp` | Main signal aspect (0 = stop, 1/2 = proceed variants). |
| `vr` | Advance signal aspect (0 = expect stop, 1 = caution, 2 = clear). |
| `verw` | Usage type: `asig`, `esig`, `zsig`, `bksig`, `sbk`. |
| `ersatz` | Replacement indication: `zs1`, `zs7`, `kennlicht`, etc. |
| `vr_op` | Advance signal mode: `verk` (shortened), `wdh` (repeater). |
| `zusatz_oben` / `zusatz_unten` | Speed indicator above/below the mast. |
| `bez` | Name plate text. |
| `mast` / `mast2` | Mast geometry variants. |

### Speed aspects (three vocabularies)

| Aspect | Used on | Bus participation |
|--------|---------|-------------------|
| `currentSpeed` | Main / master signals (HP, zs3) | Published to downstream signals. Value `−1` = off. Speed in km/h (e.g. `60`) or special values like `4`. |
| `advanceSpeed` | Advance / slave signals (VR, zs3v) | Received from partner’s `currentSpeed`. Never published. |
| `localSpeed` | Standalone boards (Lf 6/7) | **Not** part of the bus — isolated from HP/VR chains. |

**Example — main signal with speed annex:**

```json
"menu": [["hp=0,hp=1,hp=2", "currentSpeed"]]
```

**Example — isolated construction speed board:**

```json
"initial": "localSpeed=60",
"menu": ["localSpeed()"]
```

No `dependency` block → the sign never participates in inter-signal propagation.

---

## Conditions

Conditions appear in `on`, `off`, `rules`, `dependency`, and elsewhere. Evaluated by `Signal.check()`.

### Syntax

| Form | Meaning |
|------|---------|
| `"hp=0"` | Aspect `hp` equals `0`. |
| `"hp>0"` | Numeric comparison against a literal. |
| `"currentSpeed<=advanceSpeed"` | Compare two aspects on the same signal. |
| `"hp<=0"`, `"hp>=2"`, `"hp!=1"` | Other comparators (literal or aspect on the right). |
| `"VRsig"` | Aspect `VRsig` is set. |
| `"a&&b"` | AND condition, Both must match. |
| `"a||b"` | OR condition, Either matches. |
| `["a", "b"]` | Shorthand for `a&&b` on `on`/`off` only (see [String or array](#string-or-array)). |

### Dependency-scoped conditions

Inside `dependency`, prefix whose signal is tested:

| Prefix | Refers to |
|--------|-----------|
| `self.` | The signal being updated (subscriber). |
| `partner.` | The neighbouring signal providing data. |

```json
"when": ["partner.HPsig", "self.VRsig"]
```

---

## `menu`

Both use the same string format. Parsed in `SignalTemplate.#parseCommandMenu()`. Each entry in the outer array is one **row**; a row may be a single string or an inner array of strings (see [String or array](#string-or-array)).

### Menu item types

| String pattern | UI control | Example |
|----------------|------------|---------|
| `"hp=0,hp=1,hp=2"` | Button group | Three exclusive buttons. |
| `"verk=1(verk)"` | Single button | Command `verk=1`, label `verk`. |
| `"currentSpeed"` | Speed dropdown | Values 0–90 km/h, `−1` = off. |
| `"currentSpeed()"` | Speed dropdown | Same; `()` allows a custom label via `(label)`. |
| `"zs6=1(Zs 6)"` | Single button | Label in parentheses. |

### Nesting

```json
"menu": [
  ["hp=0,hp=1,hp=2", "currentSpeed"],
  "ersatz=zs1,ersatz=zs7",
  "advanceSpeed"
]
```

- **Outer array** → rows in the configuration panel.
- **Inner array** → controls grouped on one row.

---

## `rules`

Automatic corrections run after every aspect change (before re-render). Each rule is `[trigger, target]`:

- When `trigger` matches and `target` does **not** yet match → set `target`.

**Example from `hv_hp.json` — speed display forces HP aspect:**

```json
"rules": [
  ["hp>0 && currentSpeed>60", "hp=1"],
  ["hp>0 && currentSpeed<=60 && currentSpeed>0", "hp=2"]
]
```

If the user sets `currentSpeed=80` while `hp>0`, the signal is corrected to `hp=1` (single green). If `currentSpeed=40`, it becomes `hp=2` (yellow + green).

---

## `config_options`

Structural variants shown as toggle switches in the configuration panel (not the aspect/Stellung tab).

`name` is an aspect command — a flag aspect (`"mast"`) or a full assignment (`"mastschild=wrw"`, `"3_begriffig=1"`). With `convertTo`, two options are mutually exclusive (checking one disables the other).

**Example — mast geometry (`ks.json`):**

```json
"config_options": [
  { "name": "mast", "title": "Mast geknickt", "convertTo": "mast2" },
  { "name": "mast2", "title": "Mast gerade", "convertTo": "mast" }
]
```

**Example — mastschild type (`hv_hp.json`):**

```json
"config_options": [
  { "name": "mastschild=wrw", "title": "W-R-W", "convertTo": "mastschild=wgwgw" },
  { "name": "mastschild=wgwgw", "title": "W-G-W-G-W", "convertTo": "mastschild=wrw" }
]
```

**Example — single toggle (`form_hp.json`):**

```json
"config_options": [
  { "name": "3_begriffig=1", "title": "Dreibegriffig" }
]
```

---

## `elements` — visual tree

The renderer walks this tree and shows/hides parts based on `on`/`off` conditions.

### Shorthand string

```json
"mast,vr_schirm,vr_lichtp"
```

Comma-separated **sprite names** from the atlas (not aspect names).

### Visual object

```json
{
  "image": "vr_gelb_oben,vr_gelb_unten",
  "on": "vr=0",
  "pos": [10, 20],
  "blinks": true,
  "blendMode": "multiply",
  "children": ["vr_schuten"]
}
```

| Key | Description |
|-----|-------------|
| `image` | Sprite name(s), comma-separated. |
| `label` | Internal label for rotation/flip targeting (see below). |
| `pos` | Offset `[x, y]` from parent. |
| `on` | Condition(s) required to show. String or array (AND). |
| `off` | Condition(s) that hide the element. String or array (AND). |
| `blinks` | Blinking animation. |
| `blendMode` | `"multiply"` for colour overlay sprites. |
| `rotation` | Rotate labelled children when this `on` matches. Single object or array of objects. |
| `flip` | Flip labelled children vertically. Single object or array of objects. |
| `children` | Nested elements (strings, objects, or arrays). |

### Text object

Displays the value of an aspect:

```json
{
  "text": "advanceSpeed",
  "format": [80, "Arial", 1],
  "color": "#ffde36",
  "pos": [115, 890],
  "on": "advanceSpeed>0",
  "off": "hp<=0"
}
```

| Key | Description |
|-----|-------------|
| `text` | Aspect name whose value is drawn. |
| `format` | `[size, fontName, scale]` or `[size, "DOT"]` for dot matrix. |
| `color` | CSS colour (optional). |
| `pos` | `[x, y]` position. |

### Group without image

A container with only `on`/`off` and `children`:

```json
{
  "on": "hp=0",
  "children": [
    { "image": "hp_asig_rot_re", "on": "verw=asig" }
  ]
}
```

### `rotation` and `flip`

Used heavily in form signals. When the parent’s `on` condition is active, labelled children animate.

```json
{
  "on": "vr=0",
  "rotation": [
    {
      "element": ["lichtscheibe_oben"],
      "angle": 0,
      "pivot": [7, 63],
      "duration": 300
    }
  ],
  "flip": [
    {
      "element": ["flügel"],
      "scaleY": 1,
      "pivot": [28, 162]
    }
  ]
}
```

| Key | Description |
|-----|-------------|
| `element` | `label` of child element(s) to transform. String or array of strings. |
| `angle` | Target rotation in degrees. |
| `scaleY` | `0` or `1` for flip state. |
| `pivot` | Rotation/flip origin. |
| `duration` | Animation time in ms (optional). |

---

## `dependency` — semantic aspect bus

Templates with a `dependency` block get `checkSignalDependency`. When an aspect changes, the editor walks along the track and calls this handler on neighbouring signals.

Signals **without** `dependency` are skipped during the walk (transparent).

### Bus vocabulary

| Semantic key | Values | Direction |
|--------------|--------|-----------|
| `route` | `stop`, `caution`, `clear` | Published by mains, consumed by advances. |
| `currentSpeed` | number | Published by mains/masters. |
| `advanceSpeed` | number | Written on subscribers (from partner `currentSpeed`). |


### Flow

```
Main signal (partner)                     Advance signal (self)
─────────────────────                     ─────────────────────
hp, currentSpeed                          vr, advanceSpeed
       │                                         ▲
       ▼ publish                                 │ subscribe + speed copy
  route, currentSpeed  ──────────────────────────┘
```

### `dependency` keys

| Key | Description |
|-----|-------------|
| `when` | All expressions must pass, or the handler exits. |
| `unless` | If any expression passes, the handler exits. Use `self.vr=-1` / `self.hp=-1` when the user turned the signal off to disable auto-sync. |
| `publish` | How **this** template exposes semantics when it is the **partner**. |
| `subscribe` | How **this** template maps `route` → native aspects when it is updated. |
| `overrides` | Extra aspect sets after normal mapping. |
| `stopUnless` | Optional. When omitted, propagation stops after this signal. When set, the walk continues while the condition is true (e.g. `vr_op=wdh` for repeaters). |

When a combined main signal has its own `currentSpeed` that is stricter than the propagated `advanceSpeed`, hide the advance speed display in `elements` instead of manipulating the aspect in `dependency`:

```json
"on": "advanceSpeed>0",
"off": "zusatz_unten||currentSpeed>0&&currentSpeed<=advanceSpeed"
```

The advance speed blinks only when it is effectively shown:

```json
"on": ["VRsig", "advanceSpeed>0"],
"off": "currentSpeed>0&&currentSpeed<=advanceSpeed",
"blinks": true
```

### `publish`

```json
"publish": {
  "route": [
    ["hp<=0", "stop"],
    ["hp=1", "caution"],
    ["hp>=2", "clear"]
  ],
  "currentSpeed": [
    ["hp=2&&currentSpeed<=0", 4],
    ["else", "currentSpeed"]
  ]
}
```

**Route rules** — first matching condition wins:

| Partner `hp` | Published `route` |
|--------------|-------------------|
| 0 | `stop` |
| 1 | `caution` |
| ≥ 2 | `clear` |

**CurrentSpeed rules** — special values:

| Condition | Published value |
|-----------|-----------------|
| `hp=2` and no speed set | `4` (distance marker → expect caution at VR) |
| otherwise | copy native `currentSpeed` |

Shorthand `"currentSpeed": "currentSpeed"` copies the aspect unchanged (used on Lf 7).

If `publish.route` exists but `currentSpeed` is omitted, native `currentSpeed` is still copied when set.

### `subscribe`

Maps semantic `route` to a native aspect. Speed mapping is built-in (`currentSpeed` → `advanceSpeed`).

**Hv / Form VR:**

```json
"subscribe": {
  "vr": { "route": { "stop": 0, "caution": 1, "clear": 2 } }
}
```

| `route` | Sets `vr` to |
|---------|--------------|
| `stop` | 0 |
| `caution` | 1 |
| `clear` | 2 |

**Ks / Ks VR:**

```json
"subscribe": {
  "hp": { "route": { "stop": 2, "caution": 1, "clear": 1 } }
}
```

| `route` | Sets `hp` to |
|---------|--------------|
| `stop` | 2 (Ks 2) |
| `caution` | 1 (Ks 1) |
| `clear` | 1 |

### `overrides`

Applied after route and speed propagation:

```json
"overrides": [
  ["partner.currentSpeed=4", { "advanceSpeed": 0, "vr": 2, "when": "self.vr>0" }]
]
```

When partner published `currentSpeed=4` and this signal already shows `vr>0`, force `vr=2` and clear `advanceSpeed`.

### Complete examples

**Hv Vorsignal** (`hv_vr.json`) — subscriber only:

```json
"dependency": {
  "when": ["partner.HPsig", "self.VRsig"],
  "unless": ["self.HPsig&&self.hp=0", "self.vr=-1"],
  "subscribe": {
    "vr": { "route": { "stop": 0, "caution": 1, "clear": 2 } }
  },
  "overrides": [
    ["partner.currentSpeed=4", { "advanceSpeed": 0, "vr": 2, "when": "self.vr>0" }]
  ],
  "stopUnless": "vr_op=wdh"
}
```

- Reacts only to main signals (`partner.HPsig`) when advance function is on (`self.VRsig`).
- Skips when this is a combined HP+VR stuck at `hp=0`.
- User can disable auto-sync with `vr=−1` (`unless` includes `self.vr=-1`).
- Repeater (`vr_op=wdh`) lets propagation continue to the next advance signal.

**Hv Hauptsignal** (`hv_hp.json`) — publisher and subscriber (combined mast):

```json
"dependency": {
  "publish": {
    "route": [["hp<=0","stop"],["hp=1","caution"],["hp>=2","clear"]],
    "currentSpeed": [["hp=2&&currentSpeed<=0", 4],["else", "currentSpeed"]]
  },
  "when": ["partner.HPsig", "self.VRsig"],
  "unless": ["self.HPsig&&self.hp=0", "self.vr=-1"],
  "subscribe": { "vr": { "route": { "stop": 0, "caution": 1, "clear": 2 } } },
  "stopUnless": "vr_op=wdh"
}
```

**Ks Hauptsignal** — KS-specific publish and min-speed rule:

```json
"dependency": {
  "when": ["partner.HPsig", "self.VRsig"],
  "unless": ["self.HPsig&&self.hp=0", "self.hp=-1"],
  "publish": {
    "route": [["hp<=0","stop"],["hp=1","caution"],["hp>=2","caution"]]
  },
  "subscribe": {
    "hp": { "route": { "stop": 2, "caution": 1, "clear": 1 } }
  },
  "stopUnless": "vr_op=wdh"
}
```

KS never publishes `route=clear`, so a Ks main always signals at most “caution” to an Hv VR. Use `off: "currentSpeed>0&&currentSpeed<=advanceSpeed"` on advance-speed visuals when the main’s own speed annex overrides the propagated value.

**Lf 7 / Lf 6** — isolated from HP/VR by different guards:

```json
// lf7 — master (publish only; no track-walk handler)
"dependency": {
  "publish": { "currentSpeed": "currentSpeed" }
}

// lf6 — slave (no stopUnless → stops after handling)
"dependency": {
  "when": ["partner.master", "self.slave"]
}
```

Lf 7 only defines `publish`; it is not invoked during the track walk. Lf 6 copies `advanceSpeed` from Lf 7’s `currentSpeed` and stops propagation (default). An Hv main does not satisfy `partner.master`, so it never affects Lf 6.

**Zs 3 standalone** — no `dependency` key. Uses only `localSpeed`. Placed between HP and VR on a track, it is invisible to the bus.

---

## Atlas sprites vs aspect names

Sprite names in `image` and shorthand strings (`"zs3"`, `"zs3v"`) refer to **atlas entries** in `app/images/<atlas>.json`. They are independent of aspect names.

```json
{
  "on": "advanceSpeed>0",
  "children": [
    "zs3v",
    { "text": "advanceSpeed", "pos": [115, 890] }
  ]
}
```

- `"zs3v"` → draw the `zs3v` sprite from the atlas.
- `"text": "advanceSpeed"` → print the `advanceSpeed` aspect value.

---

## File locations

| File | Contents |
|------|----------|
| `hv_hp.json`, `hv_vr.json` | Hv main and advance |
| `ks.json`, `ks_vr.json` | Ks main and advance |
| `form_hp.json`, `form_vr.json` | Form signals |
| `ls.json` | Lichtsperrsignal |
| `simple-signs.json` | Array of small signs (Ne, Lf, Zs 3, Zusatz, …) |

Registration: [`signal_library.ts`](../signal_library.ts).  
Types: [`signalDefinition.ts`](../signalDefinition.ts).  
Dependency engine: [`signalDependency.ts`](../signalDependency.ts).

---

## Checklist for a new signal

1. Add sprites to `app/images/<atlas>.json` (+ PNG).
2. Create `<id>.json` with `id`, `title`, `atlas`, `elements`.
3. Set `initial` aspects for new placements.
4. Add `menu` entries for user-controlled aspects.
5. Use `on`/`off` on elements to match aspects.
6. If the signal must react to neighbours: add `dependency` with correct `when` guards.
7. If it is a standalone speed board: use `localSpeed`, **no** `dependency`.
8. Register in `signal_library.ts` if not loaded via `simple-signs.json`.
