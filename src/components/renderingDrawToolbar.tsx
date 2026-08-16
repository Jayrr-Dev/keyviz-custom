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
  Pen01Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { invoke } from "@tauri-apps/api/core";
import { emit } from "@tauri-apps/api/event";
import { useEffect, useState } from "react";

const DRAW_HINT = "Hold right-click to erase. Escape or Ctrl+Alt+D to exit";
const CLICK_HINT = "Click mode. Drawings stay. Press Draw to ink again";

const DRAW_COLORS = ["#ef4444", "#f59e0b", "#22c55e", "#3b82f6", "#fafafa"];

const DRAW_WIDTHS = [3, 6, 12];

/** Single row that never wraps, so the window size stays stable. */
const TOOLBAR_SHELL =
  "flex w-max flex-nowrap items-center gap-1.5 rounded-xl border border-white/20 bg-neutral-900 px-2 py-1.5 shadow-2xl";

const TOOLBAR_HOST = "inline-flex w-max flex-col items-center gap-1.5";

const HINT_SHELL =
  "whitespace-nowrap rounded-full bg-neutral-950 px-3 py-1 text-xs font-medium text-white shadow-lg";

const HINT_STACK = "grid justify-items-center";

const ICON_BUTTON_ACTIVE =
  "flex size-7 items-center justify-center rounded-lg bg-neutral-700 text-white";
const ICON_BUTTON_IDLE =
  "flex size-7 items-center justify-center rounded-lg text-neutral-400 hover:bg-neutral-700/70 hover:text-neutral-100";

const TEXT_BUTTON_ACTIVE =
  "flex h-7 items-center gap-1 rounded-lg bg-neutral-700 px-2 text-xs font-medium text-white";
const TEXT_BUTTON_IDLE =
  "flex h-7 items-center gap-1 rounded-lg px-2 text-xs font-medium text-neutral-400 hover:bg-neutral-700/70 hover:text-neutral-100";

const SEPARATOR = "h-5 bg-white/15";

const ICON_SIZE = 14;
const SQUARE_GLYPH_VIEWBOX = 24;
const SQUARE_GLYPH_INSET = 5;
const SQUARE_GLYPH_STROKE = 1.5;

const DRAW_INK_TOOLS: {
  id: DrawInkTool;
  label: string;
  icon: typeof CursorEdit01Icon | null;
}[] = [
  { id: "pen", label: "Pen", icon: Pen01Icon },
  { id: "arrow", label: "Arrow", icon: ArrowUpRight01Icon },
  { id: "square", label: "Square", icon: null },
  { id: "circle", label: "Circle", icon: Circle },
];

/**
 * Geometric square outline. Hugeicons Square01 is a rounded squircle.
 */
const RenderingSquareGlyph = ({ size }: { size: number }) => {
  const side = SQUARE_GLYPH_VIEWBOX - SQUARE_GLYPH_INSET * 2;
  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${SQUARE_GLYPH_VIEWBOX} ${SQUARE_GLYPH_VIEWBOX}`}
      fill="none"
      aria-hidden="true"
    >
      <rect
        x={SQUARE_GLYPH_INSET}
        y={SQUARE_GLYPH_INSET}
        width={side}
        height={side}
        stroke="currentColor"
        strokeWidth={SQUARE_GLYPH_STROKE}
      />
    </svg>
  );
};

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
    void invoke("log", { message: "exit-source: toolbar-button" });
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
      {hintVisible ? (
        <div className={HINT_STACK}>
          <div
            className={`${HINT_SHELL} col-start-1 row-start-1 ${clickMode ? "invisible" : ""}`}
          >
            {DRAW_HINT}
          </div>
          <div
            className={`${HINT_SHELL} col-start-1 row-start-1 ${clickMode ? "" : "invisible"}`}
          >
            {CLICK_HINT}
          </div>
        </div>
      ) : null}
      <div className={TOOLBAR_SHELL} onPointerDown={stoppingCanvasDraw}>
        <button
          type="button"
          title="Draw"
          aria-label="Draw"
          onClick={pickingDrawTool}
          className={clickMode ? TEXT_BUTTON_IDLE : TEXT_BUTTON_ACTIVE}
        >
          <HugeiconsIcon icon={CursorEdit01Icon} size={ICON_SIZE} />
          Draw
        </button>
        <button
          type="button"
          title="Click through"
          aria-label="Click through"
          onClick={pickingClickTool}
          className={clickMode ? TEXT_BUTTON_ACTIVE : TEXT_BUTTON_IDLE}
        >
          <HugeiconsIcon icon={Cursor01Icon} size={ICON_SIZE} />
          Click
        </button>

        <Separator orientation="vertical" className={SEPARATOR} />

        {DRAW_INK_TOOLS.map((tool) => (
          <button
            key={tool.id}
            type="button"
            title={tool.label}
            aria-label={tool.label}
            onClick={() => pickingInkTool(tool.id)}
            className={
              !clickMode && drawTool === tool.id
                ? ICON_BUTTON_ACTIVE
                : ICON_BUTTON_IDLE
            }
          >
            {tool.icon ? (
              <HugeiconsIcon icon={tool.icon} size={ICON_SIZE} />
            ) : (
              <RenderingSquareGlyph size={ICON_SIZE} />
            )}
          </button>
        ))}

        <Separator orientation="vertical" className={SEPARATOR} />

        {DRAW_COLORS.map((swatch) => (
          <button
            key={swatch}
            type="button"
            title={`Ink ${swatch}`}
            aria-label={`Ink ${swatch}`}
            onClick={() => setColor(swatch)}
            className={
              color === swatch
                ? "size-5 rounded-full ring-2 ring-white ring-offset-2 ring-offset-neutral-900"
                : "size-5 rounded-full ring-1 ring-white/25 hover:ring-white/60"
            }
            style={{ backgroundColor: swatch }}
          />
        ))}

        <Separator orientation="vertical" className={SEPARATOR} />

        {DRAW_WIDTHS.map((width) => (
          <button
            key={width}
            type="button"
            title={`Stroke ${width}`}
            aria-label={`Stroke ${width}`}
            onClick={() => setStrokeWidth(width)}
            className={
              strokeWidth === width ? ICON_BUTTON_ACTIVE : ICON_BUTTON_IDLE
            }
          >
            <span
              className="rounded-full bg-current"
              style={{ width: width + 2, height: width + 2 }}
            />
          </button>
        ))}

        <Separator orientation="vertical" className={SEPARATOR} />

        <button
          type="button"
          title="Clear drawings"
          aria-label="Clear drawings"
          onClick={clearingDrawings}
          className={TEXT_BUTTON_IDLE}
        >
          <HugeiconsIcon icon={Cancel01Icon} size={ICON_SIZE} />
          Clear
        </button>
        <button
          type="button"
          title="Exit draw mode"
          aria-label="Exit draw mode"
          onClick={exitingDrawMode}
          className="flex h-7 items-center rounded-lg bg-white px-2.5 text-xs font-semibold text-neutral-900 hover:bg-neutral-200"
        >
          Exit
        </button>
      </div>
    </div>
  );
};
