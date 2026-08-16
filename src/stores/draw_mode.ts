import { getCurrentWindow } from "@tauri-apps/api/window";
import { createJSONStorage, persist } from "zustand/middleware";
import { tauriStorage } from "./storage";
import { createSyncedStore } from "./sync";

export const DRAW_MODE_STORE = "draw_mode_store";
export const DRAW_MODE_CLEAR_EVENT = "draw-mode-clear";

export const DEFAULT_DRAW_COLOR = "#ef4444";
export const DEFAULT_STROKE_WIDTH = 4;
export const MIN_STROKE_WIDTH = 2;
export const MAX_STROKE_WIDTH = 24;

export interface DrawModeState {
  enabled: boolean;
  color: string;
  strokeWidth: number;
}

interface DrawModeActions {
  setEnabled: (enabled: boolean) => void;
  setColor: (color: string) => void;
  setStrokeWidth: (strokeWidth: number) => void;
}

export type DrawModeStore = DrawModeState & DrawModeActions;

const createDrawModeStore = createSyncedStore<DrawModeStore>(
  DRAW_MODE_STORE,
  (set) => ({
    enabled: false,
    color: DEFAULT_DRAW_COLOR,
    strokeWidth: DEFAULT_STROKE_WIDTH,
    setEnabled: (enabled) => set({ enabled }),
    setColor: (color) => set({ color }),
    setStrokeWidth: (strokeWidth) => set({ strokeWidth }),
  }),
  (config) =>
    persist(config, {
      name: DRAW_MODE_STORE,
      storage: createJSONStorage(() => tauriStorage),
      partialize: (state) => ({
        color: state.color,
        strokeWidth: state.strokeWidth,
      }),
    }),
);

export const useDrawMode = createDrawModeStore(
  getCurrentWindow().label === "settings",
);
