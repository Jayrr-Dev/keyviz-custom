import { RenderingDrawToolbar } from "@/components/renderingDrawToolbar";
import {
  FALLBACK_MONITOR_STYLE,
  readingCursorMonitorStyle,
} from "@/lib/readingCursorMonitor";
import { useDrawMode } from "@/stores/draw_mode";
import { alignmentForRow } from "@/types/style";
import { invoke } from "@tauri-apps/api/core";
import { platform } from "@tauri-apps/plugin-os";
import { CSSProperties, useEffect, useRef, useState } from "react";

const isMacos = platform() === "macos";

const ANCHOR_SHELL = "pointer-events-none absolute z-50 flex overflow-hidden";
const TOOLBAR_SLOT = "pointer-events-auto relative w-max max-w-full";

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
 * Pins the draw toolbar to the active display using Settings alignment
 * and offset.
 */
export const AnchoringDrawToolbar = () => {
  const enabled = useDrawMode((state) => state.enabled);
  const toolbarAlignment = useDrawMode((state) => state.toolbarAlignment);
  const toolbarOffsetX = useDrawMode((state) => state.toolbarOffsetX);
  const toolbarOffsetY = useDrawMode((state) => state.toolbarOffsetY);
  const toolbarLayout = useDrawMode((state) => state.toolbarLayout);
  const [monitorStyle, setMonitorStyle] = useState<CSSProperties>(
    FALLBACK_MONITOR_STYLE,
  );
  const slotRef = useRef<HTMLDivElement>(null);
  const alignment =
    alignmentForRow[toolbarAlignment] ?? alignmentForRow["bottom-center"];

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
    const measuringSlot = () =>
      reportingToolbarRect(slot.getBoundingClientRect());
    measuringSlot();
    const observer = new ResizeObserver(measuringSlot);
    observer.observe(slot);
    return () => {
      observer.disconnect();
      reportingToolbarRect(null);
    };
  }, [
    enabled,
    monitorStyle,
    toolbarAlignment,
    toolbarOffsetX,
    toolbarOffsetY,
    toolbarLayout,
  ]);

  if (!enabled) return null;

  return (
    <div
      className={ANCHOR_SHELL}
      style={{
        ...monitorStyle,
        justifyContent: alignment.justifyContent,
        alignItems: alignment.alignItems,
        paddingInline: toolbarOffsetX,
        paddingBlock: toolbarOffsetY,
      }}
    >
      <div ref={slotRef} className={TOOLBAR_SLOT}>
        <RenderingDrawToolbar />
      </div>
    </div>
  );
};
