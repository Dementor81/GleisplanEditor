# GleisplanEditor Refactoring Phases

This document tracks the progress of modernizing the GleisplanEditor codebase by breaking down the monolithic `start.js` file into a maintainable, modular architecture.

## Overview

The goal is to transform the current monolithic structure into a clean, maintainable codebase using modern JavaScript practices, proper separation of concerns, and scalable architecture patterns.

## Phase Status Legend
- 🔴 **Not Started**
- 🟡 **In Progress**
- 🟢 **Completed**
- 🔵 **Optional/Stretch Goal**

---

## Phase 1: Extract Configuration and Constants 🟢 **COMPLETED**

### Goals
- Extract all hardcoded constants from `start.js`
- Create centralized configuration management
- Improve maintainability and reduce magic numbers

### Completed Tasks
- ✅ Created `config.js` with centralized configuration
- ✅ Extracted all constants (CONFIG, DIRECTION, MOUSE_DOWN_ACTION, etc.)
- ✅ Updated `start.js` to import from config
- ✅ Updated dependent files to use imported constants
- ✅ Maintained backward compatibility with global window assignments

### Files Modified
- `www/code/config.js` (new)
- `www/code/start.js`
- `www/code/storage.js`
- `www/code/switch.js`
- `www/code/trackRendering_textured.js`
- `www/code/track.js`
- `www/code/signal.js`

---

## Phase 2: Create Core Application Class and State Management 🟢 **COMPLETED**

### Goals
- Create a centralized Application class
- Implement singleton pattern for application state
- Replace monolithic initialization with organized structure

### Completed Tasks
- ✅ Created `Application` class with singleton pattern
- ✅ Moved initialization logic from `init()` function
- ✅ Organized initialization into logical phases
- ✅ Added proper error handling and async initialization
- ✅ Maintained backward compatibility with global references
- ✅ Added getters/setters for controlled state access

### Files Modified
- `www/code/application.js` (new)
- `www/code/start.js` (updated to use Application class)

---

## Phase 3: Refactor Event Handling System 🟢 **COMPLETED**

### Goals
- Create specialized manager classes to prevent Application class bloat
- Separate concerns into focused managers
- Improve maintainability and testability
- Move all event handling and UI management to dedicated managers
- Remove backward compatibility layer for cleaner architecture

### Completed Tasks
- ✅ Created `EventManager` for all event-related functionality
- ✅ Created `RenderingManager` for rendering operations
- ✅ Created `UIManager` for UI state and behavior
- ✅ Updated Application class to use managers
- ✅ Reduced Application class size significantly
- ✅ Maintained clean separation of concerns
- ✅ Moved all mouse event handlers (handleStageMouseDown, handleStageMouseUp, handleMouseMove) to EventManager
- ✅ Moved event utility functions (getHitTest, getHitInfoForSignalPositioning, determineMouseAction) to EventManager
- ✅ Moved visual feedback functions (draw_SignalPositionLine, drawBluePrintTrack) to EventManager
- ✅ Moved geometry functions (addTrackAnchorPoint, getSnapPoint) to EventManager
- ✅ Moved signal drag-and-drop functionality to EventManager
- ✅ Moved UI management functions (toggleEditMode, selectRenderer, selectObject, deleteSelectedObject) to UIManager
- ✅ Moved rendering functions (clear, center, onResizeWindow) to RenderingManager
- ✅ Moved UI object and its methods to UIManager
- ✅ Significantly cleaned up start.js by removing moved functions
- ✅ **Removed all backward compatibility layer** - Updated all references to use Application.getInstance() pattern
- ✅ Cleaned up global window assignments for cleaner architecture

### Files Modified
- `www/code/managers/EventManager.js` (new)
- `www/code/managers/RenderingManager.js` (new)
- `www/code/managers/UIManager.js` (new)
- `www/code/application.js` (updated to use managers, removed backward compatibility)
- `www/code/start.js` (significantly cleaned up - removed moved functions and backward compatibility)
- `www/code/storage.js` (updated to use Application.getInstance())
- `www/code/signal.js` (updated to use Application.getInstance())

---

## Phase 4: Break Down UI Management into Smaller Modules 🔴 **NOT STARTED**

### Goals
- Further modularize UI components
- Create specialized UI handlers for different features
- Improve UI state management

### Planned Tasks
- [ ] Create `MenuManager` for menu-specific functionality
- [ ] Create `ModalManager` for modal dialogs
- [ ] Create `ToastManager` for notifications
- [ ] Create `SignalUIManager` for signal-specific UI
- [ ] Create `TrainUIManager` for train-specific UI
- [ ] Refactor UIManager to coordinate between specialized managers

### Expected Benefits
- Better organization of UI logic
- Easier to maintain specific UI features
- Improved testability of UI components

---

## Phase 5: Modernize Input Handling (Mouse/Touch/Keyboard) 🔴 **NOT STARTED**

### Goals
- Modernize input handling system
- Improve touch support
- Better gesture recognition
- Cleaner input abstraction

### Planned Tasks
- [ ] Create `InputManager` for unified input handling
- [ ] Create `MouseManager` for mouse-specific interactions
- [ ] Create `TouchManager` for touch/gesture support
- [ ] Create `KeyboardManager` for keyboard shortcuts
- [ ] Implement proper input abstraction layer
- [ ] Add gesture recognition (pinch-to-zoom, etc.)

### Expected Benefits
- Better cross-platform support
- Improved user experience
- Cleaner input handling code
- Better accessibility

---

## Phase 6: Improve Rendering Architecture 🔴 **NOT STARTED**

### Goals
- Modernize rendering system
- Improve performance
- Better separation of rendering concerns

### Planned Tasks
- [ ] Create `RenderManager` for high-level rendering coordination
- [ ] Create `GridRenderer` for grid-specific rendering
- [ ] Create `SignalRenderer` for signal rendering
- [ ] Create `TrackRenderer` for track rendering
- [ ] Create `TrainRenderer` for train rendering
- [ ] Implement rendering optimization strategies
- [ ] Add support for different rendering backends

### Expected Benefits
- Better performance
- Cleaner rendering code
- Easier to add new rendering features
- Better separation of rendering concerns

---

## Phase 7: Add Error Handling and Logging 🔴 **NOT STARTED**

### Goals
- Implement comprehensive error handling
- Add proper logging system
- Improve debugging capabilities

### Planned Tasks
- [ ] Create `ErrorManager` for centralized error handling
- [ ] Create `Logger` class for structured logging
- [ ] Implement error boundaries
- [ ] Add error reporting system
- [ ] Create debugging utilities
- [ ] Add performance monitoring

### Expected Benefits
- Better error recovery
- Easier debugging
- Improved user experience
- Better monitoring capabilities

---

## Phase 8: Add Testing Framework 🔴 **NOT STARTED**

### Goals
- Implement comprehensive testing
- Add unit tests for all components
- Add integration tests
- Add end-to-end tests

### Planned Tasks
- [ ] Set up testing framework (Jest/Vitest)
- [ ] Create unit tests for managers
- [ ] Create unit tests for utility classes
- [ ] Create integration tests for Application class
- [ ] Create end-to-end tests for user workflows
- [ ] Add test coverage reporting
- [ ] Set up CI/CD testing pipeline

### Expected Benefits
- Higher code quality
- Easier refactoring
- Better bug prevention
- Improved maintainability

---

## Phase 9: Optimize Build System 🔴 **NOT STARTED**

### Goals
- Modernize build system
- Improve development experience
- Optimize for production

### Planned Tasks
- [ ] Update Webpack configuration
- [ ] Add development server with hot reload
- [ ] Implement code splitting
- [ ] Add asset optimization
- [ ] Set up production build optimization
- [ ] Add development tools (ESLint, Prettier)
- [ ] Implement build caching

### Expected Benefits
- Faster development
- Better production performance
- Improved developer experience
- Better code quality tools

---

## Phase 10: Add TypeScript (Optional) 🔵 **STRETCH GOAL**

### Goals
- Add TypeScript for better type safety
- Improve developer experience
- Better IDE support

### Planned Tasks
- [ ] Set up TypeScript configuration
- [ ] Convert JavaScript files to TypeScript
- [ ] Add type definitions
- [ ] Update build system for TypeScript
- [ ] Add strict type checking
- [ ] Create type definitions for external libraries

### Expected Benefits
- Better type safety
- Improved IDE support
- Easier refactoring
- Better documentation through types

---

## Current Status Summary

### Completed Phases: 3/10 (30%)
- ✅ Phase 1: Configuration extraction
- ✅ Phase 2: Application class creation
- ✅ Phase 3: Manager classes implementation

### Next Priority: Phase 4
Breaking down UI management into smaller modules will further improve the architecture and make the codebase more maintainable.

### Architecture Overview
```
Application (Singleton)
├── EventManager (Event handling)
├── RenderingManager (Rendering operations)
├── UIManager (UI state and behavior)
└── Core State Management
```

### Key Benefits Achieved So Far
- ✅ Reduced Application class complexity
- ✅ Better separation of concerns
- ✅ Improved maintainability
- ✅ Cleaner architecture
- ✅ Better testability foundation
- ✅ Maintained backward compatibility

---

## Notes

- All phases maintain backward compatibility with existing code
- Each phase builds upon the previous ones
- The modular architecture makes it easier to implement subsequent phases
- Testing and error handling will be added as the architecture stabilizes
- TypeScript is optional and can be added at any point

---

*Last Updated: Phase 3 completed*
*Next Phase: Phase 4 - Break Down UI Management into Smaller Modules* 