import { RenderingDrawToolbar } from "@/components/renderingDrawToolbar";
import {
  markingDrawToolbarLive,
  sizingDrawToolbarWindow,
} from "@/lib/sizingDrawToolbarWindow";
import { DRAW_MODE_STORE, useDrawMode } from "@/stores/draw_mode";
import { listenForUpdates } from "@/stores/sync";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { useEffect, useRef } from "react";

interface DrawState {
  drawMode: boolean;
  clickMode: boolean;
}

const HOST_SHELL =
  "dark inline-flex w-max flex-col items-center bg-transparent p-1";

/**
 * Clears page chrome so only the toolbar card is visible.
 */
const strippingWindowChrome = () => {
  const root = document.getElementById("root");
  for (const node of [document.documentElement, document.body, root]) {
    if (!node) continue;
    node.style.background = "transparent";
    node.style.height = "auto";
    node.style.overflow = "hidden";
  }
};

/**
 * Standalone clickable toolbar window used while Draw Mode is on.
 */
const HostingDrawToolbar = () => {
  const hostRef = useRef<HTMLDivElement>(null);
  const gotToggleRef = useRef(false);
  const enabled = useDrawMode((state) => state.enabled);

  useEffect(() => {
    strippingWindowChrome();
    const readingStartupState = async () => {
      try {
        const state = await invoke<DrawState>("reading_draw_state");
        if (gotToggleRef.current) return;
        markingDrawToolbarLive(state.drawMode);
        useDrawMode.setState({
          enabled: state.drawMode,
          clickMode: state.clickMode,
        });
      } catch {
        return;
      }
    };
    void readingStartupState();
    const unlisten = Promise.all([
      listen<boolean>("draw-mode-toggle", (event) => {
        gotToggleRef.current = true;
        markingDrawToolbarLive(event.payload);
        useDrawMode.setState({ enabled: event.payload, clickMode: false });
      }),
      listen<boolean>("draw-click-mode", (event) => {
        useDrawMode.setState({ clickMode: event.payload });
      }),
      listenForUpdates(DRAW_MODE_STORE, useDrawMode.setState),
    ]);
    return () => {
      markingDrawToolbarLive(false);
      unlisten.then((stops) => stops.forEach((stop) => stop()));
    };
  }, []);

  useEffect(() => {
    const host = hostRef.current;
    if (!host || !enabled) {
      markingDrawToolbarLive(false);
      return;
    }
    markingDrawToolbarLive(true);
    let frame: number | null = null;

    const resizingToContent = () => {
      if (frame != null) return;
      frame = requestAnimationFrame(() => {
        frame = null;
        void sizingDrawToolbarWindow(host.scrollWidth, host.scrollHeight);
      });
    };

    resizingToContent();
    const observer = new ResizeObserver(resizingToContent);
    observer.observe(host);
    return () => {
      observer.disconnect();
      if (frame != null) cancelAnimationFrame(frame);
    };
  }, [enabled]);

  return (
    <div ref={hostRef} className={HOST_SHELL}>
      <RenderingDrawToolbar />
    </div>
  );
};

export default HostingDrawToolbar;
