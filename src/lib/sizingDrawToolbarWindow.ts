import { LogicalSize, PhysicalPosition } from "@tauri-apps/api/dpi";
import { getCurrentWindow } from "@tauri-apps/api/window";

const TOOLBAR_PAD = 4;
/** Skip resizes under this many pixels so the window cannot oscillate. */
const SIZE_TOLERANCE = 2;

let appliedWidth = 0;
let appliedHeight = 0;
let running = false;
let toolbarLive = false;

/**
 * Allows or blocks toolbar window moves. Hidden windows must not call setSize,
 * which can show the window again after draw mode has already closed.
 */
export const markingDrawToolbarLive = (live: boolean) => {
  toolbarLive = live;
  if (!live) {
    running = false;
  }
};

/**
 * Sizes the draw-toolbar window to its content.
 * The bottom center stays put so a resize does not hop diagonally.
 */
export const sizingDrawToolbarWindow = async (
  width: number,
  height: number,
) => {
  if (!toolbarLive) return;
  const nextWidth = Math.max(1, Math.ceil(width) + TOOLBAR_PAD);
  const nextHeight = Math.max(1, Math.ceil(height) + TOOLBAR_PAD);
  const settled =
    Math.abs(nextWidth - appliedWidth) < SIZE_TOLERANCE &&
    Math.abs(nextHeight - appliedHeight) < SIZE_TOLERANCE;
  if (running || settled) return;

  running = true;
  try {
    const window = getCurrentWindow();
    const visible = await window.isVisible();
    if (!toolbarLive || !visible) return;
    const previousSize = await window.outerSize();
    const previousPos = await window.outerPosition();
    await window.setSize(new LogicalSize(nextWidth, nextHeight));
    if (!toolbarLive) {
      await window.hide();
      return;
    }
    appliedWidth = nextWidth;
    appliedHeight = nextHeight;

    const nextSize = await window.outerSize();
    const x =
      previousPos.x + Math.round((previousSize.width - nextSize.width) / 2);
    const y = previousPos.y + (previousSize.height - nextSize.height);
    await window.setPosition(new PhysicalPosition(x, y));
    if (!toolbarLive) {
      await window.hide();
    }
  } catch {
    appliedWidth = 0;
    appliedHeight = 0;
  } finally {
    running = false;
  }
};
