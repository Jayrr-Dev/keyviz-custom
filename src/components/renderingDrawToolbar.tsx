import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { DRAW_MODE_CLEAR_EVENT, useDrawMode } from "@/stores/draw_mode";
import { Cancel01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { invoke } from "@tauri-apps/api/core";
import { emit } from "@tauri-apps/api/event";

const DRAW_HINT = "Draw mode · Ctrl+Alt+Y to exit";

const DRAW_COLORS = ["#ef4444", "#f59e0b", "#22c55e", "#3b82f6", "#fafafa"];

const DRAW_WIDTHS = [3, 6, 12];

const TOOLBAR_SHELL =
  "flex items-center gap-2 rounded-xl border border-white/15 bg-neutral-800 px-3 py-2 shadow-lg";

/**
 * Stops a toolbar click from starting a stroke on the canvas.
 */
const stoppingCanvasDraw = (event: { stopPropagation: () => void }) => {
  event.stopPropagation();
};

/**
 * Centered draw tools under the hint, same card language as Settings.
 */
export const RenderingDrawToolbar = () => {
  const color = useDrawMode((state) => state.color);
  const strokeWidth = useDrawMode((state) => state.strokeWidth);
  const setColor = useDrawMode((state) => state.setColor);
  const setStrokeWidth = useDrawMode((state) => state.setStrokeWidth);
  const setEnabled = useDrawMode((state) => state.setEnabled);

  const clearingDrawings = () => {
    emit(DRAW_MODE_CLEAR_EVENT).catch(() => undefined);
  };

  const exitingDrawMode = () => {
    setEnabled(false);
    invoke("set_draw_mode", { enabled: false }).catch(() => undefined);
  };

  return (
    <div className="absolute bottom-6 left-1/2 z-50 flex -translate-x-1/2 flex-col items-center gap-2">
      <div className="rounded-full bg-neutral-900/90 px-4 py-1.5 text-sm font-medium text-neutral-100">
        {DRAW_HINT}
      </div>
      <div className={TOOLBAR_SHELL} onPointerDown={stoppingCanvasDraw}>
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
  );
};
