import { KeyOverlay } from "@/components/key-overlay";
import { MouseOverlay } from "@/components/mouse-overlay";
import { RenderingDrawCanvas } from "@/components/renderingDrawCanvas";
import { ForegroundApp } from "@/lib/matchingForegroundProgram";
import {
  DRAW_MODE_STORE,
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

  const [isListening, setIsListening] = useState(true);
  const [keyLayout, setKeyLayout] = useState<OverlayLayout | null>(null);
  const [foregroundApp, setForegroundApp] = useState<ForegroundApp | null>(
    null,
  );

  useEffect(() => {
    const unlistenPromises = [
      listen<EventPayload>("input-event", (event) => onEvent(event.payload)),
      listenForUpdates<KeyEventStore>(KEY_EVENT_STORE, useKeyEvent.setState),
      listenForUpdates<KeyStyleStore>(KEY_STYLE_STORE, useKeyStyle.setState),
      listen<boolean>("settings-window", (event) => {
        useKeyEvent.setState({ settingsOpen: event.payload });
      }),
      listen<boolean>("listening-toggle", (event) =>
        setIsListening(event.payload),
      ),
      listen<boolean>("draw-mode-toggle", (event) => {
        useDrawMode.setState({ enabled: event.payload });
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
      {isListening ? (
        <>
          <MouseOverlay />
          <KeyOverlay screenStyle={keyStyle} foregroundApp={foregroundApp} />
        </>
      ) : null}
      <RenderingDrawCanvas />
    </div>
  );
}
