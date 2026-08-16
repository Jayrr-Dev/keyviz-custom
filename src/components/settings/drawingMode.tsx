import { Button } from "@/components/ui/button";
import { ColorInput } from "@/components/ui/color-picker";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemTitle,
} from "@/components/ui/item";
import { NumberInput } from "@/components/ui/number-input";
import { Switch } from "@/components/ui/switch";
import {
  DRAW_MODE_CLEAR_EVENT,
  MAX_STROKE_WIDTH,
  MIN_STROKE_WIDTH,
  useDrawMode,
} from "@/stores/draw_mode";
import {
  Cancel01Icon,
  CursorEdit01Icon,
  PaintBoardIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { invoke } from "@tauri-apps/api/core";
import { emit, listen } from "@tauri-apps/api/event";
import { useEffect } from "react";

const DRAW_SHORTCUT = "Ctrl+Alt+Y";

/**
 * Settings for on-screen drawing.
 */
export const DrawingMode = () => {
  const enabled = useDrawMode((state) => state.enabled);
  const color = useDrawMode((state) => state.color);
  const strokeWidth = useDrawMode((state) => state.strokeWidth);
  const setEnabled = useDrawMode((state) => state.setEnabled);
  const setColor = useDrawMode((state) => state.setColor);
  const setStrokeWidth = useDrawMode((state) => state.setStrokeWidth);

  useEffect(() => {
    const unlisten = listen<boolean>("draw-mode-toggle", (event) => {
      setEnabled(event.payload);
    });
    return () => {
      unlisten.then((stop) => stop());
    };
  }, [setEnabled]);

  const togglingDrawMode = (next: boolean) => {
    setEnabled(next);
    invoke("set_draw_mode", { enabled: next }).catch(() => undefined);
  };

  const clearingDrawings = () => {
    emit(DRAW_MODE_CLEAR_EVENT).catch(() => undefined);
  };

  return (
    <div className="flex flex-col gap-y-4 p-6">
      <h1 className="text-xl font-semibold">Draw Mode</h1>

      <Item variant="muted">
        <ItemContent>
          <ItemTitle>
            <HugeiconsIcon icon={CursorEdit01Icon} size="1em" /> Draw on screen
          </ItemTitle>
          <ItemDescription>
            Click and drag on the overlay. {DRAW_SHORTCUT} turns it on or off.
            Other apps cannot be clicked while this is on.
          </ItemDescription>
        </ItemContent>
        <ItemActions>
          <Switch checked={enabled} onCheckedChange={togglingDrawMode} />
        </ItemActions>
      </Item>

      <Item variant="muted">
        <ItemContent>
          <ItemTitle>
            <HugeiconsIcon icon={PaintBoardIcon} size="1em" /> Color
          </ItemTitle>
          <ItemDescription>Ink color for new strokes</ItemDescription>
        </ItemContent>
        <ItemActions>
          <ColorInput value={color} onChange={setColor} />
        </ItemActions>
      </Item>

      <Item variant="muted">
        <ItemContent>
          <ItemTitle>Stroke size</ItemTitle>
          <ItemDescription>Line thickness in pixels</ItemDescription>
        </ItemContent>
        <ItemActions className="max-w-20">
          <NumberInput
            className="h-8"
            value={strokeWidth}
            onChange={setStrokeWidth}
            minValue={MIN_STROKE_WIDTH}
            maxValue={MAX_STROKE_WIDTH}
          />
        </ItemActions>
      </Item>

      <Item variant="muted">
        <ItemContent>
          <ItemTitle>
            <HugeiconsIcon icon={Cancel01Icon} size="1em" /> Clear drawings
          </ItemTitle>
          <ItemDescription>
            Removes every stroke from the overlay
          </ItemDescription>
        </ItemContent>
        <ItemActions>
          <Button variant="outline" onClick={clearingDrawings}>
            Clear
          </Button>
        </ItemActions>
      </Item>
    </div>
  );
};
