import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  DRAW_MODE_CLEAR_EVENT,
  DrawInkTool,
  HOTKEY_HINT_HIDE_MS,
  useDrawMode,
} from "@/stores/draw_mode";
import {
  ArrowUpRight01Icon,
  Cancel01Icon,
  Circle,
  Cursor01Icon,
  CursorEdit01Icon,
  Square01Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { invoke } from "@tauri-apps/api/core";
import { emit } from "@tauri-apps/api/event";
import { useEffect, useState } from "react";

const DRAW_HINT = "Hold right-click to erase. Escape or Ctrl+Alt+D to exit";
const CLICK_HINT = "Click mode. Drawings stay. Press Draw to ink again";

const MODE_BUTTON_ACTIVE =
  "flex items-center gap-1 rounded-lg bg-neutral-700 px-2.5 py-1 text-sm text-white";
const MODE_BUTTON_IDLE =
  "flex items-center gap-1 rounded-lg px-2.5 py-1 text-sm text-neutral-400 hover:bg-neutral-700/70 hover:text-neutral-100";

const DRAW_COLORS = ["#ef4444", "#f59e0b", "#22c55e", "#3b82f6", "#fafafa"];

const DRAW_WIDTHS = [3, 6, 12];

const TOOLBAR_SHELL =
  "flex items-center gap-2 rounded-xl border border-white/20 bg-neutral-900 px-3 py-2 shadow-2xl";

const TOOLBAR_HOST =
  "flex w-full flex-col items-center justify-end pointer-events-none";

const TOOLBAR_STACK = "flex flex-col items-center gap-2 pointer-events-auto";

const DRAW_INK_TOOLS: {
  id: DrawInkTool;
  label: string;
  icon: typeof CursorEdit01Icon;
}[] = [
  { id: "pen", label: "Pen", icon: CursorEdit01Icon },
  { id: "arrow", label: "Arrow", icon: ArrowUpRight01Icon },
  { id: "square", label: "Square", icon: Square01Icon },
  { id: "circle", label: "Circle", icon: Circle },
];

/**
 * Stops a toolbar click from starting a stroke on the canvas.
 */
const stoppingCanvasDraw = (event: { stopPropagation: () => void }) => {
  event.stopPropagation();
};

/**
 * Draw tools. Lives in its own window so Click mode can still use it.
 */
export const RenderingDrawToolbar = () => {
  const color = useDrawMode((state) => state.color);
  const strokeWidth = useDrawMode((state) => state.strokeWidth);
  const clickMode = useDrawMode((state) => state.clickMode);
  const drawTool = useDrawMode((state) => state.drawTool);
  const setColor = useDrawMode((state) => state.setColor);
  const setStrokeWidth = useDrawMode((state) => state.setStrokeWidth);
  const setEnabled = useDrawMode((state) => state.setEnabled);
  const setClickMode = useDrawMode((state) => state.setClickMode);
  const setDrawTool = useDrawMode((state) => state.setDrawTool);
  const showHotkeyHint = useDrawMode((state) => state.showHotkeyHint) ?? true;
  const [hintVisible, setHintVisible] = useState(showHotkeyHint);

  useEffect(() => {
    if (!showHotkeyHint) {
      setHintVisible(false);
      return;
    }
    setHintVisible(true);
    const hideId = window.setTimeout(() => {
      setHintVisible(false);
    }, HOTKEY_HINT_HIDE_MS);
    return () => window.clearTimeout(hideId);
  }, [showHotkeyHint]);

  const clearingDrawings = () => {
    emit(DRAW_MODE_CLEAR_EVENT).catch(() => undefined);
  };

  const exitingDrawMode = () => {
    setEnabled(false);
    invoke("set_draw_mode", { enabled: false }).catch(() => undefined);
  };

  const pickingDrawTool = () => {
    setClickMode(false);
    invoke("set_draw_click_mode", { enabled: false }).catch(() => undefined);
  };

  const pickingInkTool = (tool: DrawInkTool) => {
    setDrawTool(tool);
    invoke("set_draw_click_mode", { enabled: false }).catch(() => undefined);
  };

  const pickingClickTool = () => {
    setClickMode(true);
    invoke("set_draw_click_mode", { enabled: true }).catch(() => undefined);
  };

  return (
    <div className={TOOLBAR_HOST}>
      <div className={TOOLBAR_STACK}>
        {hintVisible ? (
          <div className="rounded-full bg-neutral-950 px-4 py-1.5 text-sm font-medium text-white shadow-lg">
            {clickMode ? CLICK_HINT : DRAW_HINT}
          </div>
        ) : null}
        <div className={TOOLBAR_SHELL} onPointerDown={stoppingCanvasDraw}>
          <div className="flex items-center gap-0.5">
            <button
              type="button"
              aria-label="Draw"
              onClick={pickingDrawTool}
              className={clickMode ? MODE_BUTTON_IDLE : MODE_BUTTON_ACTIVE}
            >
              <HugeiconsIcon icon={CursorEdit01Icon} size={14} />
              Draw
            </button>
            <button
              type="button"
              aria-label="Click through"
              onClick={pickingClickTool}
              className={clickMode ? MODE_BUTTON_ACTIVE : MODE_BUTTON_IDLE}
            >
              <HugeiconsIcon icon={Cursor01Icon} size={14} />
              Click
            </button>
          </div>
          <Separator orientation="vertical" className="h-6 bg-white/15" />
          <div className="flex items-center gap-0.5">
            {DRAW_INK_TOOLS.map((tool) => (
              <button
                key={tool.id}
                type="button"
                aria-label={tool.label}
                onClick={() => pickingInkTool(tool.id)}
                className={
                  !clickMode && drawTool === tool.id
                    ? MODE_BUTTON_ACTIVE
                    : MODE_BUTTON_IDLE
                }
              >
                <HugeiconsIcon icon={tool.icon} size={14} />
                {tool.label}
              </button>
            ))}
          </div>
          <Separator orientation="vertical" className="h-6 bg-white/15" />
          <div className="flex items-center gap-1.5">
            {DRAW_COLORS.map((swatch) => (
              <button
                key={swatch}
                type="button"
                aria-label={`Ink ${swatch}`}
                onClick={() => setColor(swatch)}
                className={
                  color === swatch
                    ? "size-6 rounded-full ring-2 ring-white ring-offset-2 ring-offset-neutral-800"
                    : "size-6 rounded-full ring-1 ring-white/20 hover:ring-white/50"
                }
                style={{ backgroundColor: swatch }}
              />
            ))}
          </div>
          <Separator orientation="vertical" className="h-6 bg-white/15" />
          <div className="flex items-center gap-1">
            {DRAW_WIDTHS.map((width) => (
              <button
                key={width}
                type="button"
                aria-label={`Stroke ${width}`}
                onClick={() => setStrokeWidth(width)}
                className={
                  strokeWidth === width
                    ? "flex size-8 items-center justify-center rounded-lg bg-neutral-700 text-neutral-100"
                    : "flex size-8 items-center justify-center rounded-lg text-neutral-400 hover:bg-neutral-700/70 hover:text-neutral-100"
                }
              >
                <span
                  className="rounded-full bg-current"
                  style={{ width: width + 2, height: width + 2 }}
                />
              </button>
            ))}
          </div>
          <Separator orientation="vertical" className="h-6 bg-white/15" />
          <Button variant="outline" size="sm" onClick={clearingDrawings}>
            <HugeiconsIcon icon={Cancel01Icon} />
            Clear
          </Button>
          <Button size="sm" onClick={exitingDrawMode}>
            Exit
          </Button>
        </div>
      </div>
    </div>
  );
};
