import { getCurrentWindow } from "@tauri-apps/api/window";
import { createJSONStorage, persist } from "zustand/middleware";
import { tauriStorage } from "./storage";
import { createSyncedStore } from "./sync";

export const DRAW_MODE_STORE = "draw_mode_store";
export const DRAW_MODE_CLEAR_EVENT = "draw-mode-clear";

export const DEFAULT_DRAW_COLOR = "#ef4444";
export const DEFAULT_STROKE_WIDTH = 4;
/** Freehand ink. Type places text. Highlight is a square-nib marker. Shape tools drag from start to end. */
export type DrawInkTool =
  | "pen"
  | "type"
  | "highlight"
  | "arrow"
  | "square"
  | "circle";
export const DEFAULT_DRAW_TOOL: DrawInkTool = "pen";
export const MIN_STROKE_WIDTH = 2;
export const MAX_STROKE_WIDTH = 24;
/** Filled highlight stays readable over the screen without blocking it. */
export const HIGHLIGHT_OPACITY = 0.35;
/** Highlight nib is wider than the ink stroke. */
export const HIGHLIGHT_WIDTH_SCALE = 3;
/** 0 keeps ink until erase, clear, or leaving draw mode. */
export const DEFAULT_STROKE_LIFETIME_SEC = 0;
export const DEFAULT_SHOW_HOTKEY_HINT = true;
export const HOTKEY_HINT_HIDE_MS = 5000;

export interface DrawModeState {
  enabled: boolean;
  clickMode: boolean;
  drawTool: DrawInkTool;
  color: string;
  strokeWidth: number;
  strokeLifetimeSec: number;
  showHotkeyHint: boolean;
}

interface DrawModeActions {
  setEnabled: (enabled: boolean) => void;
  setClickMode: (clickMode: boolean) => void;
  setDrawTool: (drawTool: DrawInkTool) => void;
  setColor: (color: string) => void;
  setStrokeWidth: (strokeWidth: number) => void;
  setStrokeLifetimeSec: (strokeLifetimeSec: number) => void;
  setShowHotkeyHint: (showHotkeyHint: boolean) => void;
}

export type DrawModeStore = DrawModeState & DrawModeActions;

const createDrawModeStore = createSyncedStore<DrawModeStore>(
  DRAW_MODE_STORE,
  (set) => ({
    enabled: false,
    clickMode: false,
    drawTool: DEFAULT_DRAW_TOOL,
    color: DEFAULT_DRAW_COLOR,
    strokeWidth: DEFAULT_STROKE_WIDTH,
    strokeLifetimeSec: DEFAULT_STROKE_LIFETIME_SEC,
    showHotkeyHint: DEFAULT_SHOW_HOTKEY_HINT,
    setEnabled: (enabled) => set({ enabled, clickMode: false }),
    setClickMode: (clickMode) => set({ clickMode }),
    setDrawTool: (drawTool) => set({ drawTool, clickMode: false }),
    setColor: (color) => set({ color }),
    setStrokeWidth: (strokeWidth) => set({ strokeWidth }),
    setStrokeLifetimeSec: (strokeLifetimeSec) => set({ strokeLifetimeSec }),
    setShowHotkeyHint: (showHotkeyHint) => set({ showHotkeyHint }),
  }),
  (config) =>
    persist(config, {
      name: DRAW_MODE_STORE,
      storage: createJSONStorage(() => tauriStorage),
      partialize: (state) => ({
        color: state.color,
        drawTool: state.drawTool,
        strokeWidth: state.strokeWidth,
        strokeLifetimeSec: state.strokeLifetimeSec,
        showHotkeyHint: state.showHotkeyHint,
      }),
      merge: (persisted, current) => {
        const saved =
          persisted && typeof persisted === "object"
            ? (persisted as Partial<DrawModeState>)
            : {};
        return {
          ...current,
          ...saved,
          enabled: current.enabled,
          clickMode: current.clickMode,
          drawTool: saved.drawTool ?? current.drawTool,
          strokeLifetimeSec:
            typeof saved.strokeLifetimeSec === "number"
              ? saved.strokeLifetimeSec
              : current.strokeLifetimeSec,
          showHotkeyHint:
            typeof saved.showHotkeyHint === "boolean"
              ? saved.showHotkeyHint
              : current.showHotkeyHint,
        };
      },
    }),
);

const DRAW_STORE_SENDERS = new Set(["settings", "main"]);

export const useDrawMode = createDrawModeStore(
  DRAW_STORE_SENDERS.has(getCurrentWindow().label),
);
