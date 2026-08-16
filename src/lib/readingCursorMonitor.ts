import {
  availableMonitors,
  cursorPosition,
  getCurrentWindow,
} from "@tauri-apps/api/window";
import { platform } from "@tauri-apps/plugin-os";
import { CSSProperties } from "react";

/**
 * CSS pixel ratio for overlay layout. macOS already reports CSS pixels.
 */
const readingCssDpr = () => {
  try {
    return platform() === "macos" ? 1 : window.devicePixelRatio || 1;
  } catch {
    return window.devicePixelRatio || 1;
  }
};

export const FALLBACK_MONITOR_STYLE: CSSProperties = {
  left: 0,
  top: 0,
  width: "100%",
  height: "100%",
};

interface PhysicalMonitor {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface MonitorLayoutCache {
  originX: number;
  originY: number;
  dpr: number;
  monitors: PhysicalMonitor[];
}

/**
 * True when two toolbar boxes sit on the same display.
 */
export const matchingMonitorStyle = (
  left: CSSProperties,
  right: CSSProperties,
) =>
  left.left === right.left &&
  left.top === right.top &&
  left.width === right.width &&
  left.height === right.height;

/**
 * Loads every display in the same space as the spanning overlay window.
 */
export const loadingMonitorLayoutCache =
  async (): Promise<MonitorLayoutCache | null> => {
    try {
      const [monitors, origin] = await Promise.all([
        availableMonitors(),
        getCurrentWindow().outerPosition(),
      ]);
      if (monitors.length === 0) return null;
      return {
        originX: origin.x,
        originY: origin.y,
        dpr: readingCssDpr(),
        monitors: monitors.map((monitor) => ({
          x: monitor.position.x,
          y: monitor.position.y,
          width: monitor.size.width,
          height: monitor.size.height,
        })),
      };
    } catch {
      return null;
    }
  };

/**
 * CSS box for the display that contains a physical desktop point.
 */
export const pickingMonitorStyleAtPoint = (
  cache: MonitorLayoutCache,
  physicalX: number,
  physicalY: number,
): CSSProperties => {
  const monitor =
    cache.monitors.find(
      (row) =>
        physicalX >= row.x &&
        physicalY >= row.y &&
        physicalX < row.x + row.width &&
        physicalY < row.y + row.height,
    ) ?? cache.monitors[0];
  if (!monitor) return FALLBACK_MONITOR_STYLE;
  return {
    left: (monitor.x - cache.originX) / cache.dpr,
    top: (monitor.y - cache.originY) / cache.dpr,
    width: monitor.width / cache.dpr,
    height: monitor.height / cache.dpr,
  };
};

/**
 * CSS box for the display under a point in overlay CSS pixels.
 */
export const pickingMonitorStyleAtCssPoint = (
  cache: MonitorLayoutCache,
  cssX: number,
  cssY: number,
): CSSProperties =>
  pickingMonitorStyleAtPoint(
    cache,
    cache.originX + cssX * cache.dpr,
    cache.originY + cssY * cache.dpr,
  );

/**
 * CSS box for the display under the mouse right now.
 */
export const readingCursorMonitorStyle = async (
  cache?: MonitorLayoutCache | null,
): Promise<CSSProperties> => {
  try {
    const layout = cache ?? (await loadingMonitorLayoutCache());
    if (!layout) return FALLBACK_MONITOR_STYLE;
    const cursor = await cursorPosition();
    return pickingMonitorStyleAtPoint(layout, cursor.x, cursor.y);
  } catch {
    return FALLBACK_MONITOR_STYLE;
  }
};
