import { LogicalSize, PhysicalPosition } from "@tauri-apps/api/dpi";
import { currentMonitor, getCurrentWindow } from "@tauri-apps/api/window";

const TOOLBAR_BOTTOM_GAP = 20;
const TOOLBAR_PAD = 4;
/** Skip resizes under this many pixels so the window cannot oscillate. */
const SIZE_TOLERANCE = 2;

let appliedWidth = 0;
let appliedHeight = 0;
let running = false;

/**
 * Sizes the draw-toolbar window to its content and pins it to the bottom center.
 * Repeat calls with the same size are dropped, which keeps resize observers
 * from feeding themselves.
 */
export const sizingDrawToolbarWindow = async (
  width: number,
  height: number,
) => {
  const nextWidth = Math.max(1, Math.ceil(width) + TOOLBAR_PAD);
  const nextHeight = Math.max(1, Math.ceil(height) + TOOLBAR_PAD);
  const settled =
    Math.abs(nextWidth - appliedWidth) < SIZE_TOLERANCE &&
    Math.abs(nextHeight - appliedHeight) < SIZE_TOLERANCE;
  if (running || settled) return;

  running = true;
  try {
    const window = getCurrentWindow();
    await window.setSize(new LogicalSize(nextWidth, nextHeight));
    appliedWidth = nextWidth;
    appliedHeight = nextHeight;

    const monitor = await currentMonitor();
    if (!monitor) return;
    const scale = monitor.scaleFactor;
    const x =
      monitor.position.x +
      Math.round((monitor.size.width - nextWidth * scale) / 2);
    const y =
      monitor.position.y +
      monitor.size.height -
      Math.round(nextHeight * scale) -
      Math.round(TOOLBAR_BOTTOM_GAP * scale);
    await window.setPosition(new PhysicalPosition(x, y));
  } catch {
    appliedWidth = 0;
    appliedHeight = 0;
  } finally {
    running = false;
  }
};
