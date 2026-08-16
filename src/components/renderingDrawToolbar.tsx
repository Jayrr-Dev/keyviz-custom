import { Separator } from "@/components/ui/separator";
import {
  DRAW_INK_COLORS,
  DRAW_MODE_CLEAR_EVENT,
  DRAW_STROKE_WIDTHS,
  DrawInkTool,
  DrawToolbarLayout,
  HOTKEY_HINT_HIDE_MS,
  useDrawMode,
} from "@/stores/draw_mode";
import { Alignment } from "@/types/style";
import {
  ArrowAllDirectionIcon,
  ArrowUpRight01Icon,
  Cancel01Icon,
  Circle,
  Cursor01Icon,
  HighlighterIcon,
  Pen01Icon,
  TextFontIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { invoke } from "@tauri-apps/api/core";
import { emit } from "@tauri-apps/api/event";
import { useEffect, useState } from "react";

const DRAW_HINT =
  "Alt+X/D/T/H/A/S/C · Alt+R size · Alt+Q click · Alt+1-7 color";
const CLICK_HINT = "Click mode. Drawings stay. Alt+Q or Draw to ink again";

const DRAW_COLORS = [...DRAW_INK_COLORS];

const DRAW_WIDTHS = [...DRAW_STROKE_WIDTHS];

const TOOLBAR_SHELL_HORIZONTAL =
  "flex w-max flex-nowrap items-center gap-1.5 rounded-xl border border-white/20 bg-neutral-900 px-2 py-1.5 shadow-2xl";
const TOOLBAR_SHELL_VERTICAL =
  "flex w-max flex-col flex-nowrap items-center gap-1.5 rounded-xl border border-white/20 bg-neutral-900 px-1.5 py-2 shadow-2xl";

const TOOLBAR_HOST = "relative inline-flex w-max";

const HINT_BASE =
  "pointer-events-none absolute z-10 whitespace-nowrap rounded-full bg-neutral-950 px-3 py-1 text-xs font-medium text-white shadow-lg";
const HINT_ABOVE = `${HINT_BASE} bottom-full left-1/2 mb-1.5 -translate-x-1/2`;
const HINT_BELOW = `${HINT_BASE} top-full left-1/2 mt-1.5 -translate-x-1/2`;
const HINT_RIGHT = `${HINT_BASE} left-full top-1/2 ml-1.5 -translate-y-1/2`;
const HINT_LEFT = `${HINT_BASE} right-full top-1/2 mr-1.5 -translate-y-1/2`;

const ICON_BUTTON_ACTIVE =
  "flex size-7 items-center justify-center rounded-lg bg-neutral-700 text-white";
const ICON_BUTTON_IDLE =
  "flex size-7 items-center justify-center rounded-lg text-neutral-400 hover:bg-neutral-700/70 hover:text-neutral-100";

const TEXT_BUTTON_ACTIVE =
  "flex h-7 items-center gap-1 rounded-lg bg-neutral-700 px-2 text-xs font-medium text-white";
const TEXT_BUTTON_IDLE =
  "flex h-7 items-center gap-1 rounded-lg px-2 text-xs font-medium text-neutral-400 hover:bg-neutral-700/70 hover:text-neutral-100";

const EXIT_BUTTON_WIDE =
  "flex h-7 items-center rounded-lg bg-white px-2.5 text-xs font-semibold text-neutral-900 hover:bg-neutral-200";
const EXIT_BUTTON_ICON =
  "flex size-7 items-center justify-center rounded-lg bg-white text-neutral-900 hover:bg-neutral-200";

const SEPARATOR_HORIZONTAL = "h-5 bg-white/15";
const SEPARATOR_VERTICAL = "w-5 bg-white/15";

const ICON_SIZE = 14;
const SQUARE_GLYPH_VIEWBOX = 24;
const SQUARE_GLYPH_INSET = 5;
const SQUARE_GLYPH_STROKE = 1.5;
const DRAW_MODE_GLYPH_PATH = "M3 17 C7 7 9 19 14 11 C17 6 19 12 21 8";

const SELECT_MOVE_CURSOR_SCALE = 0.78;
const SELECT_MOVE_ARROWS_SCALE = 0.7;

const DRAW_INK_TOOLS: {
  id: DrawInkTool;
  label: string;
  icon: typeof Pen01Icon | null;
}[] = [
  { id: "move", label: "Select and move", icon: null },
  { id: "pen", label: "Pen", icon: Pen01Icon },
  { id: "type", label: "Type", icon: TextFontIcon },
  { id: "highlight", label: "Highlight", icon: HighlighterIcon },
  { id: "arrow", label: "Arrow", icon: ArrowUpRight01Icon },
  { id: "square", label: "Square", icon: null },
  { id: "circle", label: "Circle", icon: Circle },
];

/**
 * Ink squiggle. Draw mode is not the Pen tool, so this stays off the pencil.
 */
const RenderingDrawModeGlyph = ({ size }: { size: number }) => (
  <svg
    width={size}
    height={size}
    viewBox={`0 0 ${SQUARE_GLYPH_VIEWBOX} ${SQUARE_GLYPH_VIEWBOX}`}
    fill="none"
    aria-hidden="true"
  >
    <path
      d={DRAW_MODE_GLYPH_PATH}
      stroke="currentColor"
      strokeWidth={SQUARE_GLYPH_STROKE}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

/**
 * Puts the hotkey hint on the open side of the toolbar.
 */
const pickingHintClass = (alignment: Alignment, layout: DrawToolbarLayout) => {
  if (layout === "vertical") {
    if (alignment.endsWith("right")) return HINT_LEFT;
    return HINT_RIGHT;
  }
  if (alignment.startsWith("top")) return HINT_BELOW;
  return HINT_ABOVE;
};

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
 * Cursor plus four-way arrows, for the select-and-move tool.
 */
const RenderingSelectMoveGlyph = ({ size }: { size: number }) => {
  const cursorSize = Math.max(8, Math.round(size * SELECT_MOVE_CURSOR_SCALE));
  const arrowsSize = Math.max(7, Math.round(size * SELECT_MOVE_ARROWS_SCALE));
  return (
    <span
      className="relative block"
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      <span className="absolute bottom-0 left-0">
        <HugeiconsIcon icon={Cursor01Icon} size={cursorSize} />
      </span>
      <span className="absolute -right-px -top-px">
        <HugeiconsIcon icon={ArrowAllDirectionIcon} size={arrowsSize} />
      </span>
    </span>
  );
};

/**
 * Draw tools, rendered on the overlay above the ink canvas.
 */
export const RenderingDrawToolbar = () => {
  const pickedSwatch = useDrawMode((state) => state.pickedSwatch);
  const strokeWidth = useDrawMode((state) => state.strokeWidth);
  const clickMode = useDrawMode((state) => state.clickMode);
  const drawTool = useDrawMode((state) => state.drawTool);
  const toolbarLayout =
    useDrawMode((state) => state.toolbarLayout) ?? "horizontal";
  const toolbarAlignment =
    useDrawMode((state) => state.toolbarAlignment) ?? "bottom-center";
  const togglingDrawColor = useDrawMode((state) => state.togglingDrawColor);
  const setStrokeWidth = useDrawMode((state) => state.setStrokeWidth);
  const setClickMode = useDrawMode((state) => state.setClickMode);
  const setDrawTool = useDrawMode((state) => state.setDrawTool);
  const showHotkeyHint = useDrawMode((state) => state.showHotkeyHint) ?? true;
  const [hintVisible, setHintVisible] = useState(showHotkeyHint);
  const iconOnly = toolbarLayout === "vertical";
  const shellClass = iconOnly
    ? TOOLBAR_SHELL_VERTICAL
    : TOOLBAR_SHELL_HORIZONTAL;
  const separatorClass = iconOnly ? SEPARATOR_VERTICAL : SEPARATOR_HORIZONTAL;
  const separatorOrientation = iconOnly ? "horizontal" : "vertical";
  const modeButtonActive = iconOnly ? ICON_BUTTON_ACTIVE : TEXT_BUTTON_ACTIVE;
  const modeButtonIdle = iconOnly ? ICON_BUTTON_IDLE : TEXT_BUTTON_IDLE;

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
        <div className={pickingHintClass(toolbarAlignment, toolbarLayout)}>
          {clickMode ? CLICK_HINT : DRAW_HINT}
        </div>
      ) : null}
      <div className={shellClass}>
        <button
          type="button"
          aria-label="Draw"
          onClick={pickingDrawTool}
          className={clickMode ? modeButtonIdle : modeButtonActive}
        >
          <RenderingDrawModeGlyph size={ICON_SIZE} />
          {iconOnly ? null : "Draw"}
        </button>
        <button
          type="button"
          aria-label="Click through"
          onClick={pickingClickTool}
          className={clickMode ? modeButtonActive : modeButtonIdle}
        >
          <HugeiconsIcon icon={Cursor01Icon} size={ICON_SIZE} />
          {iconOnly ? null : "Click"}
        </button>

        <Separator
          orientation={separatorOrientation}
          className={separatorClass}
        />

        {DRAW_INK_TOOLS.map((tool) => (
          <button
            key={tool.id}
            type="button"
            aria-label={tool.label}
            onClick={() => pickingInkTool(tool.id)}
            className={
              !clickMode && drawTool === tool.id
                ? ICON_BUTTON_ACTIVE
                : ICON_BUTTON_IDLE
            }
          >
            {tool.id === "move" ? (
              <RenderingSelectMoveGlyph size={ICON_SIZE} />
            ) : tool.icon ? (
              <HugeiconsIcon icon={tool.icon} size={ICON_SIZE} />
            ) : (
              <RenderingSquareGlyph size={ICON_SIZE} />
            )}
          </button>
        ))}

        <Separator
          orientation={separatorOrientation}
          className={separatorClass}
        />

        {DRAW_COLORS.map((swatch) => (
          <button
            key={swatch}
            type="button"
            aria-label={`Ink ${swatch}`}
            onClick={() => togglingDrawColor(swatch)}
            className={
              pickedSwatch === swatch
                ? "size-5 rounded-full ring-2 ring-white ring-offset-2 ring-offset-neutral-900"
                : "size-5 rounded-full ring-1 ring-white/25 hover:ring-white/60"
            }
            style={{ backgroundColor: swatch }}
          />
        ))}

        <Separator
          orientation={separatorOrientation}
          className={separatorClass}
        />

        {DRAW_WIDTHS.map((width) => (
          <button
            key={width}
            type="button"
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

        <Separator
          orientation={separatorOrientation}
          className={separatorClass}
        />

        <button
          type="button"
          aria-label="Clear drawings"
          onClick={clearingDrawings}
          className={iconOnly ? ICON_BUTTON_IDLE : TEXT_BUTTON_IDLE}
        >
          {iconOnly ? (
            <HugeiconsIcon icon={Cancel01Icon} size={ICON_SIZE} />
          ) : (
            "Clear"
          )}
        </button>
        <button
          type="button"
          aria-label="Exit draw mode"
          onClick={exitingDrawMode}
          className={iconOnly ? EXIT_BUTTON_ICON : EXIT_BUTTON_WIDE}
        >
          {iconOnly ? "×" : "Exit"}
        </button>
      </div>
    </div>
  );
};
