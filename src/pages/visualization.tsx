import { AnchoringDrawToolbar } from "@/components/anchoringDrawToolbar";
import { KeyOverlay } from "@/components/key-overlay";
import { MouseOverlay } from "@/components/mouse-overlay";
import { RenderingDrawCanvas } from "@/components/renderingDrawCanvas";
import { ForegroundApp } from "@/lib/matchingForegroundProgram";
import {
  DRAW_HOTKEY_EVENT,
  DRAW_INK_COLORS,
  DRAW_MODE_STORE,
  DRAW_STROKE_WIDTHS,
  DrawInkTool,
  DrawModeStore,
  useDrawMode,
} from "@/stores/draw_mode";
import {
  KEY_EVENT_STORE,
  KeyEventStore,
  useKeyEvent,
} from "@/stores/key_event";
import {
  KEY_STYLE_STORE,
  KeyStyleStore,
  useKeyStyle,
} from "@/stores/key_style";
import { listenForUpdates } from "@/stores/sync";
import { EventPayload } from "@/types/event";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { platform } from "@tauri-apps/plugin-os";
import { useEffect, useState } from "react";

const isMacos = platform() === "macos";
const FOREGROUND_POLL_MS = 400;

interface OverlayLayout {
  keyX: number;
  keyY: number;
  keyWidth: number;
  keyHeight: number;
}

/**
 * Full-desktop visualization: mouse overlay spans every display.
 * Keycaps stay on one display unless Placement is Follow cursor.
 */
export function Visualization() {
  const monitor = useKeyStyle((state) => state.appearance.monitor);
  const onEvent = useKeyEvent((state) => state.onEvent);
  const tick = useKeyEvent((state) => state.tick);
  const drawMode = useDrawMode((state) => state.enabled);
  const clickMode = useDrawMode((state) => state.clickMode);

  const [isListening, setIsListening] = useState(true);
  const [keyLayout, setKeyLayout] = useState<OverlayLayout | null>(null);
  const [foregroundApp, setForegroundApp] = useState<ForegroundApp | null>(
    null,
  );

  useEffect(() => {
    const unlistenPromises = [
      listen<EventPayload>("input-event", (event) => {
        const draw = useDrawMode.getState();
        if (draw.enabled && !draw.clickMode) return;
        onEvent(event.payload);
      }),
      listenForUpdates<KeyEventStore>(KEY_EVENT_STORE, useKeyEvent.setState),
      listenForUpdates<KeyStyleStore>(KEY_STYLE_STORE, useKeyStyle.setState),
      listen<boolean>("settings-window", (event) => {
        useKeyEvent.setState({ settingsOpen: event.payload });
      }),
      listen<boolean>("listening-toggle", (event) =>
        setIsListening(event.payload),
      ),
      listen<boolean>("draw-mode-toggle", (event) => {
        useDrawMode.setState({ enabled: event.payload, clickMode: false });
      }),
      listen<boolean>("draw-click-mode", (event) => {
        useDrawMode.setState({ clickMode: event.payload });
      }),
      listen<{
        tool?: string;
        colorIndex?: number;
        strokeCycle?: boolean;
        clickModeToggle?: boolean;
      }>(DRAW_HOTKEY_EVENT, (event) => {
        const { tool, colorIndex, strokeCycle, clickModeToggle } =
          event.payload;
        if (tool) {
          useDrawMode.getState().setDrawTool(tool as DrawInkTool);
          invoke("set_draw_click_mode", { enabled: false }).catch(
            () => undefined,
          );
          if (tool !== "type") {
            invoke("set_draw_typing", { enabled: false }).catch(
              () => undefined,
            );
          }
        }
        if (typeof colorIndex === "number") {
          const next = DRAW_INK_COLORS[colorIndex];
          if (next) useDrawMode.getState().togglingDrawColor(next);
        }
        if (strokeCycle) {
          const widths = DRAW_STROKE_WIDTHS;
          const current = useDrawMode.getState().strokeWidth;
          const index = widths.findIndex((width) => width === current);
          const next = widths[(index + 1) % widths.length] ?? widths[0];
          useDrawMode.getState().setStrokeWidth(next);
        }
        if (clickModeToggle) {
          const next = !useDrawMode.getState().clickMode;
          useDrawMode.getState().setClickMode(next);
          invoke("set_draw_click_mode", { enabled: next }).catch(
            () => undefined,
          );
          invoke("set_draw_typing", { enabled: false }).catch(
            () => undefined,
          );
        }
      }),
      listenForUpdates<DrawModeStore>(DRAW_MODE_STORE, useDrawMode.setState),
    ];
    const id = setInterval(tick, 250);
    const foregroundId = setInterval(() => {
      invoke<ForegroundApp>("reading_foreground_app")
        .then(setForegroundApp)
        .catch(() => undefined);
    }, FOREGROUND_POLL_MS);

    return () => {
      clearInterval(id);
      clearInterval(foregroundId);
      unlistenPromises.forEach((p) => p.then((f) => f()));
    };
  }, []);

  useEffect(() => {
    const applyingOverlaySpan = async () => {
      try {
        const layout = await invoke<OverlayLayout | null>(
          "set_main_window_monitor",
          { monitorName: monitor ?? null },
        );
        setKeyLayout(layout);
      } catch (error) {
        console.error("Failed to span overlay:", error);
      }
    };
    applyingOverlaySpan();
  }, [monitor]);

  const dpr = isMacos ? 1 : window.devicePixelRatio || 1;
  const keyStyle = keyLayout
    ? {
        left: keyLayout.keyX / dpr,
        top: keyLayout.keyY / dpr,
        width: keyLayout.keyWidth / dpr,
        height: keyLayout.keyHeight / dpr,
      }
    : { left: 0, top: 0, width: "100%", height: "100%" };

  return (
    <div className="w-screen h-screen relative overflow-hidden">
      {isListening && (!drawMode || clickMode) ? (
        <>
          <MouseOverlay />
          <KeyOverlay screenStyle={keyStyle} foregroundApp={foregroundApp} />
        </>
      ) : null}
      <RenderingDrawCanvas />
      <AnchoringDrawToolbar />
    </div>
  );
}
