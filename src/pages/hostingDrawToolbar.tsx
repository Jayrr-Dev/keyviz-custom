import { RenderingDrawToolbar } from "@/components/renderingDrawToolbar";
import { DRAW_MODE_STORE, useDrawMode } from "@/stores/draw_mode";
import { listenForUpdates } from "@/stores/sync";
import { listen } from "@tauri-apps/api/event";
import { useEffect } from "react";

/**
 * Standalone clickable toolbar window used while Draw Mode is on.
 */
const HostingDrawToolbar = () => {
  useEffect(() => {
    document.documentElement.style.background = "transparent";
    document.body.style.background = "transparent";
    const unlisten = Promise.all([
      listen<boolean>("draw-mode-toggle", (event) => {
        useDrawMode.setState({ enabled: event.payload, clickMode: false });
      }),
      listen<boolean>("draw-click-mode", (event) => {
        useDrawMode.setState({ clickMode: event.payload });
      }),
      listenForUpdates(DRAW_MODE_STORE, useDrawMode.setState),
    ]);
    return () => {
      unlisten.then((stops) => stops.forEach((stop) => stop()));
    };
  }, []);

  return (
    <div className="dark flex h-screen w-screen items-end justify-center overflow-hidden bg-transparent">
      <RenderingDrawToolbar />
    </div>
  );
};

export default HostingDrawToolbar;
