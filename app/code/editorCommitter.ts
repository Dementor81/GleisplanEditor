"use strict";

import { STORAGE } from "./storage.ts";

export class EditorCommitter {
   static commit(): void {
      STORAGE.saveUndoHistory();
      STORAGE.save();
   }
}
