import { RenderingDrawToolbar } from "@/components/renderingDrawToolbar";
import {
  FALLBACK_MONITOR_STYLE,
  readingCursorMonitorStyle,
} from "@/lib/readingCursorMonitor";
import { useDrawMode } from "@/stores/draw_mode";
import { invoke } from "@tauri-apps/api/core";
import { platform } from "@tauri-apps/plugin-os";
import { CSSProperties, useEffect, useRef, useState } from "react";

const isMacos = platform() === "macos";

const ANCHOR_SHELL =
  "pointer-events-none absolute z-50 flex items-end justify-center overflow-hidden";
const TOOLBAR_SLOT = "pointer-events-auto relative mb-5 w-max max-w-full";

interface ToolbarRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Tells rust where the toolbar sits, in window physical pixels. Click mode
 * keeps that box clickable while the rest of the overlay passes clicks on.
 */
const reportingToolbarRect = (box: DOMRect | null) => {
  const dpr = isMacos ? 1 : window.devicePixelRatio || 1;
  const rect: ToolbarRect | null = box
    ? {
        x: box.left * dpr,
        y: box.top * dpr,
        width: box.width * dpr,
        height: box.height * dpr,
      }
    : null;
  invoke("setting_toolbar_rect", { rect }).catch(() => undefined);
};

/**
 * Pins the draw toolbar to the bottom of the display under the cursor.
 * It lives inside the overlay window, so its buttons are plain DOM clicks.
 */
export const AnchoringDrawToolbar = () => {
  const enabled = useDrawMode((state) => state.enabled);
  const [monitorStyle, setMonitorStyle] = useState<CSSProperties>(
    FALLBACK_MONITOR_STYLE,
  );
  const slotRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!enabled) return;
    let current = true;
    readingCursorMonitorStyle().then((style) => {
      if (current) setMonitorStyle(style);
    });
    return () => {
      current = false;
    };
  }, [enabled]);

  useEffect(() => {
    const slot = slotRef.current;
    if (!enabled || !slot) {
      reportingToolbarRect(null);
      return;
    }
    const measuringSlot = () => reportingToolbarRect(slot.getBoundingClientRect());
    measuringSlot();
    const observer = new ResizeObserver(measuringSlot);
    observer.observe(slot);
    return () => {
      observer.disconnect();
      reportingToolbarRect(null);
    };
  }, [enabled, monitorStyle]);

  if (!enabled) return null;

  return (
    <div className={ANCHOR_SHELL} style={monitorStyle}>
      <div ref={slotRef} className={TOOLBAR_SLOT}>
        <RenderingDrawToolbar />
      </div>
    </div>
  );
};
