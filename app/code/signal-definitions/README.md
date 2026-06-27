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
  "menu": [
    {
      "section": [
        {
          "buttonGroup": [
            { "text": "Vr 0", "command": "vr=0" },
            { "text": "Vr 1", "command": "vr=1" },
            { "text": "Vr 2", "command": "vr=2" }
          ]
        },
        {
          "dropdown": { "text": "Vorsignalgeschwindigkeit", "command": "advanceSpeed" }
        }
      ]
    }
  ],
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
| `on`, `off` | `"vr=0"` | — | Visibility conditions (use `&&` / `||` in the string). |
| `elements` | `"mast,schirm"` or `{ ... }` | `[ "mast", { ... } ]` | Root visual tree: each entry is a sprite string, visual object, text object, or nested array of those. |
| `children` | — | `["zs3v", { "text": "advanceSpeed" }]` | Child nodes under a visual group (always an array when present). |
| `image` | `"vr_gelb_oben"` | — | Multiple sprites in **one string**, comma-separated: `"vr_gelb_oben,vr_gelb_unten"`. |
| `rotation`, `flip` | `{ "element": "flügel", ... }` | `[{ ... }, { ... }]` | One transform or several (e.g. different aspects for different wing angles). |
| `rotation.element`, `flip.element` | `"lichtscheibe_oben"` | `["lichtscheibe_oben", "lichtscheibe_unten"]` | One labelled child or several animated together. |
| `dependency.when` | — | `["partner.HPsig"]` | **AND** — all must pass (only array form is used). |
| `dependency.unless` | — | `["self.vr=-1", "self.HPsig&&self.hp=0"]` | **OR** — handler skips if **any** entry matches (only array form is used). |
| `publish.currentSpeed` | — | `[["hp=2&&currentSpeed<=0", 4]]` | Optional override rules; native `currentSpeed` is published by default when `publish` is set. |

**Examples**

```json
"initial": "VRsig"
```

```json
"initial": ["vr=0", "VRsig", "verw='asig'"]
```

```json
"on": "hp=1"
```

```json
"on": "VRsig&&advanceSpeed>0"
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
| `"hp=0"` | Set aspect `hp` to numeric literal `0`. |
| `"verw='asig'"` | Set aspect `verw` to string literal `asig`. |
| `"VRsig"` | Enable flag aspect `VRsig` (any truthy presence). |
| `"bez"` | Enable text aspect `bez` (value comes from user input). |

String literals in assignments and comparisons must be **quoted** (`'asig'` or `"asig"`). Unquoted words are treated as aspect **keywords** (resolved via `signal.get()`). Numbers (`0`, `-1`, `60`) are numeric literals and stay unquoted.

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
| `advanceSpeed` | Advance / slave signals (VR, zs3v) | Received from partner’s `currentSpeed`. Never published. 

**Example — main signal with speed annex:**

```json
"menu": [
  {
    "section": [
      {
        "buttonGroup": [
          { "text": "Hp 0", "command": "hp=0" },
          { "text": "Hp 1", "command": "hp=1" },
          { "text": "Hp 2", "command": "hp=2" }
        ]
      },
      { "dropdown": { "text": "Geschwindigkeit", "command": "currentSpeed" } }
    ]
  }
]
```

**Example — isolated construction speed board:**

```json
"initial": "localSpeed=60",
"menu": [
  {
    "section": [
      { "dropdown": { "text": "Geschwindigkeit", "command": "localSpeed" } }
    ]
  }
]
```

No `dependency` block → the sign never participates in inter-signal propagation.

---

## Conditions

Conditions appear in `on`, `off`, `rules`, `dependency`, and elsewhere. Evaluated by `Signal.check()`.

### Syntax

| Form | Meaning |
|------|---------|
| `"hp=0"` | Aspect `hp` equals numeric literal `0`. |
| `"verw='zsig'"` | Aspect `verw` equals string literal `zsig`. |
| `"hp>0"` | Numeric comparison against a literal. |
| `"currentSpeed<=advanceSpeed"` | Compare two aspects on the same signal (both sides are keywords). |
| `"hp<=0"`, `"hp>=2"`, `"hp!=1"` | Other comparators (literal or aspect on the right). |
| `"VRsig"` | Aspect `VRsig` is set. |
| `"a&&b"` | AND condition, Both must match. |
| `"a||b"` | OR condition, Either matches. |

Unquoted words are aspect keywords; quoted strings and numbers are literals. Example: `verw='asig'||verw='zsig'` matches either usage type, while `verw=asig` would incorrectly treat `asig` as an aspect name.

### Dependency-scoped conditions

Inside `dependency`, prefix whose signal is tested:

| Prefix | Refers to |
|--------|-----------|
| `self.` | The signal being updated (subscriber). |
| `partner.` | The neighbouring signal providing data. |
| `self.id` / `partner.id` | Template `id` from JSON (exact string match, e.g. `partner.id='lf7'`). |

Subscriber role (`VRsig` or `slave`) is enforced by the engine before propagation runs — it does not need to appear in `when`.

```json
"when": ["partner.HPsig"]
```

```json
"when": ["partner.id='lf7'"]
```

---

## `menu`

Built by [`SignalDefinitionBuilder.buildMenu()`](../signalDefinitionBuilder.ts). Each entry in the outer array is one **section** (a bordered row in the Signalstellung tab). A section contains one or more controls rendered side by side.

### Menu item types

| JSON key | Fields | UI control |
|----------|--------|------------|
| `section` | array of child items | Row with bottom border; groups controls on one line. |
| `buttonGroup` | array of `{ text, command }` | Mutually exclusive toggle buttons. |
| `button` | `{ text, command }` | Single toggle button. |
| `dropdown` | `{ text, command }` | Speed dropdown (0–90 km/h, `−1` = off) when `command` is a speed aspect (`currentSpeed`, `advanceSpeed`, `localSpeed`). |

Every button and dropdown requires explicit `text` (label) and `command` (aspect assignment or aspect name for dropdowns).

### Example (`hv_hp`)

```json
"menu": [
  {
    "section": [
      {
        "buttonGroup": [
          { "text": "Hp 0", "command": "hp=0" },
          { "text": "Hp 1", "command": "hp=1" },
          { "text": "Hp 2", "command": "hp=2" }
        ]
      },
      { "dropdown": { "text": "Geschwindigkeit", "command": "currentSpeed" } }
    ]
  },
  {
    "section": [
      {
        "buttonGroup": [
          { "text": "Vr 0", "command": "vr=0" },
          { "text": "Vr 1", "command": "vr=1" },
          { "text": "Vr 2", "command": "vr=2" }
        ]
      },
      { "button": { "text": "verk", "command": "verk=1" } },
      { "dropdown": { "text": "Vorsignalgeschwindigkeit", "command": "advanceSpeed" } }
    ]
  },
  {
    "section": [
      {
        "buttonGroup": [
          { "text": "Zs 1", "command": "ersatz='zs1'" },
          { "text": "Zs 7", "command": "ersatz='zs7'" },
          { "text": "Kennlicht", "command": "ersatz='kennlicht'" }
        ]
      }
    ]
  },
  {
    "section": [
      { "button": { "text": "Zs 6", "command": "zs6=1" } }
    ]
  }
]
```

- **Outer array** → sections (bordered rows).
- **Items inside a `section`** → controls on the same toolbar row.

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

`name` is an aspect command — a flag aspect (`"mast"`) or a full assignment (`"mastschild='wrw'"`, `"3_begriffig=1"`). With `convertTo`, two options are mutually exclusive (checking one disables the other).

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
  { "name": "mastschild='wrw'", "title": "W-R-W", "convertTo": "mastschild='wgwgw'" },
  { "name": "mastschild='wgwgw'", "title": "W-G-W-G-W", "convertTo": "mastschild='wrw'" }
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
| `on` | Condition required to show. |
| `off` | Condition that hides the element. |
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
    { "image": "hp_asig_rot_re", "on": "verw='asig'" }
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
| `route` | `stop`, `go` | Published by mains, consumed by advances. |
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
| `when` | All expressions must pass; otherwise the signal is **transparent** (chain continues, no propagation). |
| `unless` | If any expression passes, skip propagation (`subscribe` / speed / `overrides`); `stopUnless` is still evaluated. Use `self.vr=-1` / `self.hp=-1` when the user turned the signal off to disable auto-sync. |
| `publish` | How **this** template exposes semantics when it is the **partner**. |
| `subscribe` | How **this** template maps `route` → native aspects when it is updated. |
| `overrides` | Extra aspect sets after normal mapping. |
| `stopUnless` | Optional. When omitted, propagation stops after this signal. When set, the walk continues while the condition is true (e.g. `vr_op='wdh'` for repeaters). |


```json
"on": "advanceSpeed>0",
"off": "zusatz_unten||currentSpeed>0&&currentSpeed<=advanceSpeed"
```

The advance speed blinks only when it is effectively shown:

```json
"on": "VRsig&&advanceSpeed>0",
"off": "currentSpeed>0&&currentSpeed<=advanceSpeed",
"blinks": true
```

### `publish`

```json
"publish": {
  "route": [
    ["hp<=0", "stop"],
    ["hp>=1", "go"]
  ],
  "currentSpeed": [
    ["hp=2&&currentSpeed<=0", 4]
  ]
}
```

**Route rules** — first matching condition wins:

| Partner `hp` | Published `route` |
|--------------|-------------------|
| 0 | `stop` |
| ≥ 1 | `go` |

**CurrentSpeed** — native `currentSpeed` is always published when a `publish` block exists. Override rules replace it when their condition matches:

| Condition | Published value |
|-----------|-----------------|
| `hp=2` and no speed set | `4` (distance marker → expect caution at VR) |
| otherwise | native `currentSpeed` |

If `publish.route` exists but `currentSpeed` rules are omitted, native `currentSpeed` is still copied when set.

### `subscribe`

Maps semantic `route` to a native aspect. Speed mapping is built-in (`currentSpeed` → `advanceSpeed`).

**Hv / Form VR:**

```json
"subscribe": {
  "vr": { "route": { "stop": 0, "go": 1 } }
}
```

| `route` | Sets `vr` to |
|---------|--------------|
| `stop` | 0 (expect stop — double yellow) |
| `go` | 1 (proceed — double green) |

**Ks / Ks VR:**

```json
"subscribe": {
  "hp": { "route": { "stop": 2, "go": 1 } }
}
```

| `route` | Sets `hp` to |
|---------|--------------|
| `stop` | 2 (Ks 2 — expect stop at next main) |
| `go` | 1 (Ks 1) |

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
  "when": ["partner.HPsig"],
  "unless": ["self.HPsig&&self.hp=0", "self.vr=-1"],
  "subscribe": {
    "vr": { "route": { "stop": 0, "go": 1 } }
  },
  "overrides": [
    ["partner.currentSpeed=4", { "advanceSpeed": 0, "vr": 2, "when": "self.vr>0" }]
  ],
  "stopUnless": "vr_op='wdh'"
}
```

- Reacts only to main signals (`partner.HPsig`); advance function is engine-gated via `VRsig||slave`.
- Skips when this is a combined HP+VR stuck at `hp=0`.
- User can disable auto-sync with `vr=−1` (`unless` includes `self.vr=-1`).
- Repeater (`vr_op='wdh'`) lets propagation continue to the next advance signal.

**Hv Hauptsignal** (`hv_hp.json`) — publisher and subscriber (combined mast):

```json
"dependency": {
  "publish": {
    "route": [["hp<=0","stop"],["hp>=1","go"]],
    "currentSpeed": [["hp=2&&currentSpeed<=0", 4]]
  },
  "when": ["partner.HPsig"],
  "unless": ["self.HPsig&&self.hp=0", "self.vr=-1"],
  "subscribe": { "vr": { "route": { "stop": 0, "go": 1 } } },
  "stopUnless": "vr_op='wdh'"
}
```

**Ks Hauptsignal** — KS-specific publish and min-speed rule:

```json
"dependency": {
  "when": ["partner.HPsig"],
  "unless": ["self.HPsig&&self.hp=0", "self.hp=-1"],
  "publish": {
    "route": [["hp<=0","stop"],["hp>=1","go"]]
  },
  "subscribe": {
    "hp": { "route": { "stop": 2, "go": 1 } }
  },
  "stopUnless": "vr_op='wdh'"
}
```

Ks hp=2 (“proceed, stop at next main”) still publishes `go` on the bus; the advance signal derives Ks 1 locally. Use `off: "currentSpeed>0&&currentSpeed<=advanceSpeed"` on advance-speed visuals when the main’s own speed annex overrides the propagated value.

**Lf 7 / Lf 6** — isolated from HP/VR by template id guard:

```json
// lf7 — master (publish only; no track-walk handler)
"dependency": {
  "publish": {}
}

// lf6 — slave (no stopUnless → stops after handling)
"dependency": {
  "when": ["partner.id='lf7'"]
}
```

Lf 7 only defines `publish`; it is not invoked during the track walk. Lf 6 copies `advanceSpeed` from Lf 7’s `currentSpeed` and stops propagation (default). The `slave` aspect in `initial` enables the engine subscriber gate; `partner.id='lf7'` ensures an Hv main (or any non-Lf-7 partner) is transparent to the chain.

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
