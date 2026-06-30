# Signal Definition Files

Signal definitions describe how a signal looks, which aspects it stores, which controls appear in the UI, and how it reacts to neighbouring signals.

The JSON files in this directory are converted into `SignalTemplate` objects by `../signalDefinitionBuilder.ts`. Placed signals then store their current aspect values in `Signal` objects from `../signal.ts`.

## Start Here

Use this shape for a new signal:

```json
{
  "id": "example",
  "title": "Example Signal",
  "atlas": "basis",
  "scale": 0.2,
  "initial": ["hp=0", "HPsig"],
  "menu": [
    {
      "section": [
        {
          "buttonGroup": [
            { "text": "Hp 0", "command": "hp=0" },
            { "text": "Hp 1", "command": "hp=1" }
          ]
        }
      ]
    }
  ],
  "elements": [
    "mast",
    { "image": "red_light", "on": "hp=0" },
    { "image": "green_light", "on": "hp=1" }
  ]
}
```

Keep these rules in mind:

- Sprite names come from `app/images/<atlas>.json`.
- Aspect names are arbitrary state keys such as `hp`, `vr`, `currentSpeed`, `VRsig`, or `verw`.
- Numeric assignments use `key=1`.
- String assignments must quote the value: `verw='asig'`.
- A bare command such as `HPsig` sets that aspect to `true`.
- If `elements` is omitted, the renderer tries to draw a sprite with the same name as `id`.

## Top-Level Options

### `id`

Unique template id. It is used for saved layouts, migration, dependency checks like `partner.id='lf7'`, and registration in `../signal_library.ts`.

### `title`

Display name shown in the editor.

### `atlas`

Sprite sheet name. `atlas: "hv"` loads sprites from the `hv` atlas.

### `scale`

Render scale for placed signals. Defaults to `0.5` in `SignalTemplate`.

### `previewsize`

Optional size hint for palette previews.

### `initial`

Aspect command or list of commands applied when a signal is created and when the Grundstellung button resets it.

```json
"initial": ["hp=0", "vr=0", "HPsig", "verw='asig'"]
```

### `elements`

Visual tree. Entries can be sprite strings, visual objects, text objects, or nested arrays. See [Elements](#elements).

### `menu`

Controls in the Signalstellung tab. See [Menu](#menu).

### `rules`

Automatic corrections that run after an aspect changes. See [Rules](#rules).

### `config_options`

Switches in the configuration tab for structural variants. See [Configuration Options](#configuration-options).

### `dependency`

Inter-signal propagation. Use it when a signal publishes state to neighbours or receives state from neighbours. See [Dependencies](#dependencies).

## Aspects And Commands

An aspect is one stored value on a placed signal. `Signal.get("hp")` reads it, and `Signal.setSignalAspect(...)` writes it.

Commands have two valid forms:

```json
"hp=0"
"verw='asig'"
"HPsig"
```

- `hp=0` stores the number `0`.
- `verw='asig'` stores the string `asig`.
- `HPsig` stores `true`.
- Setting a command with value `false` clears the aspect by writing `null`.

Unquoted text on the right side is not a string literal. `verw=asig` is not a valid string assignment and should be written as `verw='asig'`.

Common aspects used by existing definitions:

- `HPsig`: this signal has a main-signal function.
- `VRsig`: this signal has an advance-signal function.
- `master`: this signal publishes speed independently, for example `lf7`.
- `slave`: this signal receives speed independently, for example `lf6`.
- `hp`: main aspect.
- `vr`: advance aspect.
- `verw`: main-signal usage, for example `asig`, `esig`, `zsig`, `bksig`, `sbk`.
- `currentSpeed`: speed published by a main or master signal.
- `advanceSpeed`: speed received by an advance or slave signal.
- `localSpeed`: local speed text that does not participate in dependencies.

## Conditions

Conditions are used in `on`, `off`, `rules`, and `dependency`.

```json
"hp=0"
"verw='asig'||verw='zsig'"
"hp>0&&currentSpeed<=6"
"VRsig"
```

Supported operators are `=`, `!=`, `<`, `<=`, `>=`, `>`, `&&`, and `||`.

Behavior details:

- A bare condition such as `VRsig` is true when that aspect is not `null`.
- Missing aspects compare as `-1` in value comparisons. This makes conditions like `currentSpeed<=0` true when no speed is set.
- Numbers are numeric literals.
- Quoted values are string literals.
- Unquoted words are aspect names.
- Parentheses are not supported. Keep conditions simple.

In dependencies, conditions may use prefixes:

- `self.hp=0` checks the signal being updated.
- `partner.HPsig` checks the neighbouring signal that provides data.
- `self.id='hv_hp'` or `partner.id='lf7'` checks template ids.
- `partner.currentSpeed=4` checks the semantic speed published by the partner, after publish overrides.

## Elements

Elements are drawn in order. A visual element is drawn only when its `on` condition is true and its `off` condition is false.

### Sprite Strings

```json
"mast,hp_schirm"
```

A string draws one or more comma-separated sprites from the selected atlas.

### Visual Objects

```json
{
  "image": "hp_asig_gelb,hp_asig_gr",
  "on": "hp=2",
  "off": "currentSpeed>6",
  "pos": [10, 20],
  "children": ["zs3"]
}
```

Options:

- `image`: sprite name or comma-separated sprite names.
- `label`: render label used as a target for `rotation` and `flip`.
- `pos`: `[x, y]` position. When used inside a labelled group, child positions are relative to that group.
- `on`: condition required for drawing.
- `off`: condition that prevents drawing.
- `blinks`: enables blink animation and disables caching for that signal.
- `blendMode`: currently typed as `"multiply"`.
- `children`: nested elements.
- `rotation`: rotate a labelled element when this visual object is active.
- `flip`: set vertical scale on a labelled element when this visual object is active.

### Text Objects

```json
{
  "text": "currentSpeed",
  "format": [120, "Arial", 1],
  "color": "#333",
  "pos": [94, 40],
  "on": "currentSpeed>0"
}
```

Options:

- `text`: aspect name whose value is drawn.
- `format`: `[fontSize, fontFamily, bold]`. Existing definitions also use `"DOT"` as the font family.
- `color`: CSS color. Defaults to `#eee`.
- `pos`: required `[x, y]` position.
- `on`, `off`, `blinks`: same behavior as visual objects.

If the text value is missing, nothing is drawn. String values replace `-` with a line break.

### Rotation And Flip

```json
{
  "label": "fluegel",
  "image": "fluegel",
  "on": "hp=0",
  "rotation": {
    "angle": 45,
    "pivot": [28, 162],
    "duration": 300
  }
}
```

Options:

- `element`: target label or list of labels. If omitted, the current element's `label` is used.
- `angle`: rotation in degrees.
- `scaleY`: target vertical scale for `flip`; use `0` or `1`.
- `pivot`: optional transform origin.
- `duration`: animation duration in milliseconds. Defaults to `400`.

The renderer animates only when the aspect key that controls the active `on` condition changes.

## Menu

The `menu` array creates the Signalstellung tab. Each entry is one bordered section.

```json
"menu": [
  {
    "section": [
      {
        "buttonGroup": [
          { "text": "Hp 0", "command": "hp=0" },
          { "text": "Hp 1", "command": "hp=1" }
        ]
      },
      {
        "dropdown": { "text": "Zs3", "command": "currentSpeed" }
      }
    ]
  }
]
```

Menu item types:

- `buttonGroup`: multiple toggle buttons rendered as one group.
- `button`: one toggle button.
- `dropdown`: speed dropdown with `aus` and `0` through `90`; it writes values like `currentSpeed=6`.

Button behavior:

- A button is shown only if its command appears in at least one visual element `on` condition.
- A button is hidden when no matching visual element exists.
- A button is disabled when all matching visual elements are blocked by their `off` condition.
- Clicking an active button clears its aspect; clicking an inactive button sets its command.

Dropdown behavior:

- Dropdowns are always shown.
- The selected value is written to the aspect named by `command`.
- The displayed label shows `Kz <value>` when the value is greater than `0`, otherwise `aus`.

## Configuration Options

`config_options` create switches in the configuration tab, not in the Signalstellung tab.

```json
"config_options": [
  {
    "name": "mastschild='wrw'",
    "title": "W-R-W",
    "convertTo": "mastschild='wgwgw'"
  }
]
```

Options:

- `name`: aspect command controlled by the switch.
- `title`: switch label.
- `convertTo`: opposite state used when the switch is turned off.

Behavior:

- Turning a switch on applies `name`.
- Turning a switch off clears `name`.
- If `convertTo` is set, turning the switch off applies `convertTo`.
- If `name` and `convertTo` use different aspect keys, turning the switch on also clears `convertTo`.
- If they use the same key, assigning `name` naturally replaces the `convertTo` value.

Use this for structural variants such as mast shape or mastschild type.

## Rules

Rules are automatic aspect corrections:

```json
"rules": [
  ["hp>0&&currentSpeed>6", "hp=1"],
  ["hp>0&&currentSpeed<=6&&currentSpeed>0", "hp=2"]
]
```

Each rule is `[trigger, target]`.

After any aspect change, each rule runs. If `trigger` is true and `target` is not already true, the target command is applied.

Rules are useful when one user choice implies another. In `hv_hp.json`, a high speed forces `hp=1`, while a lower active speed forces `hp=2`.

## Dependencies

Dependencies connect neighbouring signals through a semantic state:

- `route`: usually `stop` or `go`.
- `currentSpeed`: numeric speed published by the partner.

The source signal is called `partner`. The signal being updated is called `self`.

Propagation starts when a signal aspect changes:

- A signal with `HPsig` or `master` searches backwards along the track and informs advance/slave signals.
- A signal with `VRsig` or `slave` searches forwards and reads from the next partner.
- Signals without a dependency handler are transparent.
- A dependency that has only `publish` does not create a handler, but its published values can still be read by another signal.

### `publish`

Defines what this signal exposes when it is the partner.

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

Behavior:

- `route` rules are checked in order; the first matching value is published.
- If `publish` exists, the signal's native `currentSpeed` is published when set.
- `publish.currentSpeed` rules can override the native speed.
- An empty `publish` object is enough to publish native `currentSpeed`.

### `when`

All `when` conditions must be true before the dependency handles the signal.

```json
"when": ["partner.HPsig"]
```

If `when` fails, this signal is transparent and propagation continues to the next signal.

### `unless`

Any matching `unless` condition skips route subscription and overrides.

```json
"unless": ["self.HPsig&&self.hp=0", "self.vr=-1"]
```

Speed propagation still happens when `unless` matches. This is intentional in the current code: `advanceSpeed` is copied before propagation stops or continues.

### `subscribe`

Maps semantic `route` values to native aspects on `self`.

```json
"subscribe": {
  "vr": { "route": { "stop": 0, "go": 1 } }
}
```

Only `hp` and `vr` are currently typed as subscription targets.

### Speed Propagation

If the partner publishes `currentSpeed`, the receiver always writes it to `advanceSpeed`.

This is built in; it does not need a `subscribe` entry.

### `overrides`

Extra aspect writes after normal route and speed propagation.

```json
"overrides": [
  ["partner.currentSpeed=4", { "advanceSpeed": 0, "vr": 2, "when": "self.vr>0" }]
]
```

Behavior:

- The outer condition must match.
- If the object contains `when`, that condition must also match.
- Every other key in the object is written as an aspect.

### `stopUnless`

Controls whether propagation continues after this signal.

```json
"stopUnless": "vr_op='wdh'"
```

Behavior:

- If `stopUnless` is omitted, propagation stops after this signal.
- If `stopUnless` is present and true, propagation continues.
- If `stopUnless` is present and false, propagation stops.

Repeaters use this to receive the partner state and still let the next advance signal receive it too.

## Speed Aspect Patterns

Use the speed aspect that matches the signal's role:

- `currentSpeed`: main or master signal publishes this to neighbours.
- `advanceSpeed`: advance or slave signal receives this from neighbours.
- `localSpeed`: standalone signs display this locally and do not participate in dependencies.

Examples:

- `hv_hp`, `ks`, `form_hp`, and `lf7` use `currentSpeed`.
- `hv_vr`, `ks_vr`, `form_vr`, and `lf6` use `advanceSpeed`.
- Standalone `zs3` and `zusatz` use `localSpeed`.

## New Signal Checklist

1. Add sprites to the right atlas JSON and image.
2. Create the signal definition with `id`, `title`, `atlas`, and `elements`.
3. Add `initial` aspects for the default state.
4. Add visual `on` and `off` conditions.
5. Add `menu` controls only for aspects the user should change.
6. Add `config_options` only for structural variants.
7. Add `rules` only when one aspect should automatically correct another.
8. Add `dependency` only when the signal should publish to or receive from neighbours.
9. Register the definition in `../signal_library.ts` unless it is part of `simple-signs.json`.
