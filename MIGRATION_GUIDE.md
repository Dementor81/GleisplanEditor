# TypeScript Migration Guide

## 📋 Phase 1: Setup ✅ COMPLETE

### What was done:
- ✅ Created `tsconfig.json` with strict type checking
- ✅ Created type definitions for external libraries (`types/external.d.ts`)
- ✅ Created global type definitions (`types/globals.d.ts`)
- ✅ Updated `package.json` with TypeScript dependencies
- ✅ Updated `webpack.config.js` to handle TypeScript files
- ✅ Created `.gitignore` for TypeScript artifacts

### Installation

Run the following command to install the new dependencies:

```bash
npm install
```

This will install:
- `typescript` - The TypeScript compiler
- `ts-loader` - Webpack loader for TypeScript

### New npm scripts:

- `npm run type-check` - Check types without emitting files
- `npm run type-check:watch` - Watch mode for type checking
- `npm run build` - Production build (unchanged, now handles TS)
- `npm run build:dev` - Development build (unchanged, now handles TS)
- `npm run start` - Dev server (unchanged, now handles TS)

### Verification

After installing dependencies, verify the setup:

```bash
# 1. Check TypeScript is installed
npx tsc --version

# 2. Run type checker (should pass with no errors since we only have JS files)
npm run type-check

# 3. Try building (should work as before)
npm run build:dev
```

## 📝 Next Steps: Phase 2

Once Phase 1 is verified, we can start migrating actual files. The order will be:

1. **config.js → config.ts** (no dependencies)
2. **utils.js → utils.ts** (no dependencies)
3. **tools.js → tools.ts** (depends on utils)
4. And so on...

## 🔍 Migration Checklist Template

For each file you migrate, follow this checklist:

```
File: <filename>.ts
□ Renamed .js → .ts
□ Added type annotations to function parameters
□ Added return type annotations
□ Added property type annotations
□ Created interfaces for complex objects
□ Updated imports (remove .js extensions)
□ Fixed all TypeScript errors
□ Tested in browser
□ Updated imports in other files
```

## 💡 Tips

### Gradual Migration
- JS and TS files can coexist
- Start with files that have no dependencies
- Work your way up the dependency tree
- Test after each file migration

### Import Statements
When migrating, update imports:
```typescript
// Before (JS)
import { something } from './file.js';

// After (TS) - webpack will resolve the extension
import { something } from './file';
```

### Common Patterns

#### 1. Function with types
```typescript
// Before
export function distance(p1, p2) {
  return Math.sqrt((p1.x - p2.x) ** 2 + (p1.y - p2.y) ** 2);
}

// After
export function distance(p1: Point, p2: Point): number {
  return Math.sqrt((p1.x - p2.x) ** 2 + (p1.y - p2.y) ** 2);
}
```

#### 2. Class with private fields
```typescript
// Before
class MyClass {
  #privateField = null;
  
  constructor(value) {
    this.#privateField = value;
  }
}

// After
class MyClass {
  #privateField: string | null = null;
  
  constructor(value: string) {
    this.#privateField = value;
  }
}
```

#### 3. Object with interface
```typescript
// Define interface
interface Config {
  version: string;
  gridSize: number;
  maxScale: number;
}

// Use it
export const CONFIG: Config = {
  version: "0.5",
  gridSize: 50,
  maxScale: 8,
};
```

## 🐛 Troubleshooting

### Issue: "Cannot find module" errors
**Solution:** Make sure `allowJs: true` is set in `tsconfig.json`

### Issue: Type errors in CreateJS
**Solution:** The type definitions are minimal. You can expand `types/external.d.ts` as needed or use `any` temporarily

### Issue: Circular dependency errors
**Solution:** Use type-only imports:
```typescript
import type { MyClass } from './myClass';
```

## 📚 Resources

- [TypeScript Handbook](https://www.typescriptlang.org/docs/handbook/intro.html)
- [TypeScript Migration Guide](https://www.typescriptlang.org/docs/handbook/migrating-from-javascript.html)
- [ts-loader Documentation](https://github.com/TypeStrong/ts-loader)

---

**Status:** Phase 1 Complete ✅
**Next:** Ready to start migrating files in Phase 2

