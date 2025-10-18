# 🎯 Config Object Migration Pattern - Best Practices

## Summary

This document explains the best TypeScript pattern used for migrating `config.js` to `config.ts`.

## ✅ What We Did

### 1. **Simple Constants → `as const`**

For plain objects that should never be modified:

```typescript
export const CONFIG = {
    VERSION: "0.5",
    GRID_SIZE: 50,
    MAX_SCALE: 8,
    // ...
} as const;
```

**Benefits:**
- ✅ **Readonly:** Prevents accidental modification
- ✅ **Literal types:** `VERSION` is `"0.5"` (not `string`)
- ✅ **Type inference:** No manual typing needed
- ✅ **Zero overhead:** No runtime cost

### 2. **Categorical Constants → Enums**

For constants that represent a fixed set of options (like MENU, DIRECTION):

```typescript
// TypeScript Enum (preferred for new code)
export enum Menu {
    EDIT_SIGNAL = 0,
    NEW_SIGNAL = 1,
    EDIT_TRAIN = 2,
}

// Backward compatibility object (for existing JS code)
export const MENU = {
    EDIT_SIGNAL: Menu.EDIT_SIGNAL,
    NEW_SIGNAL: Menu.NEW_SIGNAL,
    EDIT_TRAIN: Menu.EDIT_TRAIN,
} as const;
```

**Benefits:**
- ✅ **Type-safe:** Can use as function parameter types
- ✅ **Backward compatible:** Old code still works
- ✅ **Better IDE support:** Autocomplete shows all options
- ✅ **Runtime value:** Can be used in switch statements

### 3. **Nested Arrays → Nested `as const`**

For arrays within objects:

```typescript
export const COLORS = {
    GRID: "#ccc",
    TRAIN_COLORS: ["#ff0000", "#ffff00", "#00ff00"] as const,
} as const;

// Type is: readonly ["#ff0000", "#ffff00", "#00ff00"]
// Not: string[]
```

### 4. **Type Exports**

Export types for external use:

```typescript
export type AppConfig = typeof CONFIG;
export type ColorConfig = typeof COLORS;

// Usage in other files:
function updateConfig(config: Partial<AppConfig>) {
    // ...
}
```

---

## 📋 Migration Checklist for Config Objects

- [x] Add `as const` to all constant objects
- [x] Convert categorical constants to enums
- [x] Add backward compatibility objects
- [x] Add `as const` to nested arrays/objects
- [x] Export types using `typeof`
- [x] Add JSDoc comments for enums
- [x] Test type checking (`npm run type-check`)
- [x] Test build (`npm run build:dev`)
- [x] Test in browser

---

## 🎯 When to Use Each Pattern

### Use `as const` for:
- ✅ Configuration values (sizes, colors, paths)
- ✅ String constants
- ✅ Number constants
- ✅ Objects that should never change

### Use `enum` for:
- ✅ Menu types
- ✅ Action types
- ✅ State types
- ✅ Anything used in `switch` statements
- ✅ Anything used as function parameter types

### Keep both (enum + object) for:
- ✅ Gradual migration (backward compatibility)
- ✅ When existing JS code uses the object pattern

---

## 📊 File Status After Migration

| Aspect | Before (JS) | After (TS) |
|--------|-------------|------------|
| **Type Safety** | ❌ None | ✅ Full |
| **Immutability** | ⚠️ Runtime only | ✅ Compile-time |
| **IDE Support** | ⚠️ Basic | ✅ Full autocomplete |
| **Type Checking** | ❌ None | ✅ Strict |
| **Backward Compat** | N/A | ✅ 100% |
| **Runtime Overhead** | ✅ None | ✅ None (zero cost) |

---

## 🚀 Example Usage in Other Files

### Before (JavaScript):
```javascript
import { CONFIG, MENU } from './config.js';

if (app.activeMenu === MENU.EDIT_SIGNAL) {
    // ...
}
```

### After (TypeScript):
```typescript
import { CONFIG, Menu, MENU } from './config';

// Option 1: Use enum (type-safe)
function showMenu(menu: Menu) {
    if (menu === Menu.EDIT_SIGNAL) {
        // TypeScript knows menu can only be Menu values
    }
}

// Option 2: Use old constant (backward compatible)
if (app.activeMenu === MENU.EDIT_SIGNAL) {
    // Still works! Backward compatible
}
```

---

## 💡 Key Takeaways

1. **`as const` is your friend** - Makes objects readonly and gives literal types
2. **Enums for categorical data** - Better type safety and autocomplete
3. **Keep backward compatibility** - Export both enum and object
4. **Export types** - Let other files reference your config types
5. **Zero runtime cost** - All benefits are compile-time only

---

## 🐛 Common Pitfalls

### ❌ Don't: Forget `as const`
```typescript
// Bad - mutable
export const CONFIG = {
    GRID_SIZE: 50
};
CONFIG.GRID_SIZE = 100; // Works! But shouldn't!
```

### ✅ Do: Add `as const`
```typescript
// Good - immutable
export const CONFIG = {
    GRID_SIZE: 50
} as const;
CONFIG.GRID_SIZE = 100; // Error! Cannot assign to read-only property
```

### ❌ Don't: Forget nested `as const`
```typescript
// Bad
export const COLORS = {
    TRAIN_COLORS: ["#ff0000", "#00ff00"] // Type: string[]
} as const;
```

### ✅ Do: Add `as const` to nested arrays
```typescript
// Good
export const COLORS = {
    TRAIN_COLORS: ["#ff0000", "#00ff00"] as const // Type: readonly ["#ff0000", "#00ff00"]
} as const;
```

---

## 📈 Next Steps

This pattern can be applied to similar files:
- ✅ `config.ts` - Done!
- 🔜 Other constant files
- 🔜 Any file with const objects

---

**Status:** Config migration complete ✅  
**Pattern:** Proven and ready to use for other files

