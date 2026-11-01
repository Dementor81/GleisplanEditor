# Signal aspect change and rendering pipeline

This document follows an aspect change made in the main editor. It describes the path from the signal menu to the model, related signals, the PixiJS display tree, the rendered frame, and persistent storage.

## Pipeline at a glance

1. The user activates an aspect control in the signal menu.
2. `Sig_UI` translates the control into a command and calls `Signal.setSignalAspect()`.
3. The signal updates its aspect state and marks itself as changed.
4. Signal dependencies and template rules may update this or other signals.
5. Each `setSignalAspect()` invocation emits `signalAspectChanged`.
6. `RenderingManager` redraws only the affected signal's PixiJS container.
7. `RenderingManager.update()` marks the stage as dirty.
8. The PixiJS ticker submits the next required frame.
9. After the top-level UI action returns, `STORAGE.save()` persists the plan.

Model mutation, application event delivery, and PixiJS display-tree rebuilding all happen synchronously on the browser's main thread. Frame submission occurs on a later PixiJS ticker iteration.

## 1. Opening the aspect controls

Signals rendered in the plan have pointer handling attached by `SignalInteraction`. Selecting one calls `Application.selectObject()`, which opens the signal editing UI through `UIManager`.

`UIManager.showMenu()` initializes two related sets of controls:

- the aspect menu for ordinary operating state changes;
- the configuration menu for properties exposed by the signal definition.

Both can ultimately call the same `Signal.setSignalAspect()` model method.

Relevant code:

- [`SignalInteraction.ts`](../app/code/interactions/SignalInteraction.ts)
- [`application.ts`](../app/code/application.ts)
- [`UIManager.ts`](../app/code/managers/UIManager.ts)
- [`start.html`](../app/start.html)

## 2. Translating UI input into a model command

`Sig_UI.initSignalAspectsMenu()` builds the controls from `signal._template.signalMenu`. The menu is data-driven: `SignalDefinitionBuilder` converts each signal definition's menu entries into runtime button, dropdown, and text-input descriptions.

The control types commit changes as follows:

- Toggle buttons commit on `click`.
- Dropdown entries commit when their selected value changes.
- Text fields commit on `change`, `blur`, or Enter.

A toggle passes its command and the inverse of its current active state:

```ts
signal.setSignalAspect(command, !active);
```

Commands can encode their value, such as `hp=1`, or name a setting whose value is supplied separately, such as `currentSpeed` with a numeric value.

After the model call completes, the UI refreshes the active control states and saves the plan. Text inputs follow the same mutation-and-save pattern.

Relevant code:

- [`sig_ui.ts`](../app/code/sig_ui.ts)
- [`ui.ts`](../app/code/ui.ts)
- [`signalDefinitionBuilder.ts`](../app/code/signalDefinitionBuilder.ts)

## 3. Mutating the signal model

`Signal.setSignalAspect(command, overrideValue, chain)` is the central mutation point.

### Parsing and state

`SignalConditionEvaluator.parseAssignment()` first checks whether `command` contains an assignment. The resulting setting and value are compared with the current value in `_signalStellung`.

When the value differs, the method:

1. writes the new value to `_signalStellung`;
2. sets `_changed` to `true`;
3. records the animation kinds associated with the changed setting in `_aspectAnimations`.

Passing `false` as the override removes the setting by storing `null`. If the value is already equal, no model state is changed and no animation is scheduled.

### Dependency propagation

If the signal belongs to a track, changed state is present, and `chain` is `true`, the signal searches along the track for related signals.

- Main or master signals publish state toward advance signals.
- Advance or slave signals can read state from the next main signal.
- Combined signals can participate in both directions.

`SignalDependency` can propagate route information, advance speed, and configured overrides. It applies those values with `chain = false`. This prevents another track search, while still allowing template rules and change events for the receiving signal.

Propagation is synchronous. A dependent signal can therefore emit its event and redraw before the original signal emits its final event.

### Template rules

After dependencies, the signal evaluates its template rules. A matching rule calls `setSignalAspect()` recursively for the rule's target aspect. This keeps derived aspects on the same mutation path as direct user changes.

### Change event

Finally, the method emits:

```ts
eventManager.emit("signalAspectChanged", { signal: this });
```

The event is emitted even if the requested value was already current. In that case `_changed` remains `false`, so the renderer is notified but normally skips rebuilding the signal's children.

Relevant code:

- [`signal.ts`](../app/code/signal.ts)
- [`signalConditionEvaluator.ts`](../app/code/signalConditionEvaluator.ts)
- [`signalDependency.ts`](../app/code/signalDependency.ts)
- [`signalTemplate.ts`](../app/code/signalTemplate.ts)

## 4. Delivering the redraw event

During initialization, `RenderingManager` subscribes to `signalAspectChanged` and forwards the signal to `redrawSignal()`.

`EventManager.emit()` directly iterates over registered listeners. It does not enqueue a task or use a worker, so the rendering listener runs in the same call stack as `Signal.setSignalAspect()`.

`RenderingManager.redrawSignal()`:

1. searches the signal layer for the PixiJS container bound to the changed domain object;
2. calls `signal.draw(container)` if found;
3. recalculates the container's hit area and bottom pivot;
4. calls `update()` to mark the stage as dirty.

This is a targeted redraw. It does not rebuild tracks, other plan objects, or the complete scene. If the signal container is not present, its display tree is not created here, but the stage is still marked dirty.

Relevant code:

- [`EventManager.ts`](../app/code/managers/EventManager.ts)
- [`RenderingManager.ts`](../app/code/rendering/RenderingManager.ts)
- [`BasicRendering.ts`](../app/code/rendering/BasicRendering.ts)
- [`AdvancedRendererCore.ts`](../app/code/rendering/advanced/AdvancedRendererCore.ts)

## 5. Rebuilding the signal display tree

`Signal.draw()` delegates to `SignalRenderer.draw()`. A rebuild occurs only when the signal is not already being rendered and either:

- `_changed` is `true`; or
- the caller explicitly requests a forced draw.

For an aspect change, `SignalRenderer.draw()`:

1. cancels active transform animations for the signal;
2. captures prior rotations and vertical scales for transition animations;
3. records which rotation, flip, or sequence animations should run;
4. removes the current children from the signal container;
5. walks all visual elements in the signal template;
6. draws only elements whose conditions allow and enable them;
7. clears `_changed` and `_aspectAnimations`;
8. synchronizes sequence animation state.

Visual element conditions are evaluated against the updated model. Elements may produce image sprites, nested groups, or text. Blinking, rotation, flipping, and sequence behavior is attached while these elements are created.

The PixiJS container itself is retained. Its children are replaced, and the container remains bound to the same `Signal` object.

Relevant code:

- [`signalRenderer.ts`](../app/code/rendering/signalRenderer.ts)
- [`visualElement.ts`](../app/code/visualElement.ts)
- [`signalTemplate.ts`](../app/code/signalTemplate.ts)

## 6. Rendering a frame

The application uses on-demand rendering. `RenderingManager.update()` sets a dirty flag rather than rendering immediately.

The low-priority PixiJS ticker listener renders when at least one of these conditions is true:

- the stage is dirty;
- another ticker listener is active, indicating animation;
- animation was active during the previous tick, allowing one trailing frame.

Aspect changes therefore have two distinct rendering phases:

1. The retained PixiJS display tree is updated synchronously during the UI event.
2. PixiJS renders the changed tree on the next qualifying ticker iteration.

Rotation, flip, sequence, and blinking animations add ticker work and keep frames rendering for their duration. No application worker or explicit application-level `requestAnimationFrame()` handoff is involved in this path.

Relevant code:

- [`RenderingManager.ts`](../app/code/rendering/RenderingManager.ts)
- [`signalRenderer.ts`](../app/code/rendering/signalRenderer.ts)
- [`RenderStats.ts`](../app/code/rendering/RenderStats.ts)

## 7. Persistence and undo behavior

Once the top-level aspect-control callback regains control, it calls `STORAGE.save()`. The full versioned plan is serialized and written synchronously to `localStorage`. A signal's `_signalStellung` is included in its serialized state.

Aspect changes do **not** call `STORAGE.saveUndoHistory()`. Consequently:

- the new aspect survives page reload through the normal recent-save mechanism;
- changing an aspect does not create an individual undo step;
- a later operation that does create a snapshot will capture the then-current aspect state.

The “Grundstellung” action follows a related special path: it clears the aspect state, emits a redraw, reapplies initial aspects, and saves without creating an undo snapshot.

Relevant code:

- [`storage.ts`](../app/code/storage.ts)
- [`signal.ts`](../app/code/signal.ts)
- [`track.ts`](../app/code/track.ts)
- [`sig_ui.ts`](../app/code/sig_ui.ts)

## Related signal updates

One user action can cause several redraws:

1. the original signal changes;
2. dependency propagation updates one or more related signals;
3. template rules derive additional settings;
4. each `setSignalAspect()` call emits its own event;
5. each affected signal is targeted independently by `RenderingManager`.

Because this chain is synchronous, the display trees are up to date before the UI callback calls `STORAGE.save()`. The next ticker frame presents the resulting combined state.

## Standalone signal preview

The signal configuration page reuses the model and aspect-menu code but has a separate rendering listener. Its `signalAspectChanged` handler draws directly into the preview container instead of using the main editor's signal layer. Persistence is disabled on that page.

Relevant code:

- [`signalConfig.ts`](../app/code/signalConfig.ts)

## Debugging checkpoints

When an aspect appears not to update, inspect the pipeline in this order:

1. Confirm that the menu command and value reach `Signal.setSignalAspect()`.
2. Inspect `_signalStellung`, `_changed`, and `_aspectAnimations` after parsing.
3. Check whether dependencies or template rules replace the requested state.
4. Confirm that `signalAspectChanged` is emitted for the expected signal.
5. Confirm that `redrawSignal()` finds the bound PixiJS container.
6. Check the visual element's `on`, `off`, and enabled conditions.
7. Confirm that `update()` marks the stage dirty and that the ticker renders a frame.

