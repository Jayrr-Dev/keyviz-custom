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
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  DEFAULT_STROKE_LIFETIME_SEC,
  DRAW_MODE_CLEAR_EVENT,
  MAX_STROKE_WIDTH,
  MIN_STROKE_WIDTH,
  useDrawMode,
} from "@/stores/draw_mode";
import {
  Cancel01Icon,
  CursorEdit01Icon,
  PaintBoardIcon,
  Time03Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { invoke } from "@tauri-apps/api/core";
import { emit, listen } from "@tauri-apps/api/event";
import { useEffect } from "react";

const DRAW_SHORTCUT = "Ctrl+Alt+D";

const STROKE_LIFETIME_OPTIONS = [
  { id: "until", seconds: 0, label: "Until cleared" },
  { id: "2", seconds: 2, label: "2 seconds" },
  { id: "5", seconds: 5, label: "5 seconds" },
  { id: "10", seconds: 10, label: "10 seconds" },
  { id: "15", seconds: 15, label: "15 seconds" },
  { id: "30", seconds: 30, label: "30 seconds" },
  { id: "60", seconds: 60, label: "1 minute" },
];

/**
 * Settings for on-screen drawing.
 */
export const DrawingMode = () => {
  const enabled = useDrawMode((state) => state.enabled);
  const color = useDrawMode((state) => state.color);
  const strokeWidth = useDrawMode((state) => state.strokeWidth);
  const strokeLifetimeSec =
    useDrawMode((state) => state.strokeLifetimeSec) ??
    DEFAULT_STROKE_LIFETIME_SEC;
  const setEnabled = useDrawMode((state) => state.setEnabled);
  const setColor = useDrawMode((state) => state.setColor);
  const setStrokeWidth = useDrawMode((state) => state.setStrokeWidth);
  const setStrokeLifetimeSec = useDrawMode(
    (state) => state.setStrokeLifetimeSec,
  );
  const showHotkeyHint = useDrawMode((state) => state.showHotkeyHint) ?? true;
  const setShowHotkeyHint = useDrawMode((state) => state.setShowHotkeyHint);

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
            Click and drag on the overlay. Type places text. Hold right-click to
            erase. Use Click on the toolbar to use other apps without losing
            your drawings. {DRAW_SHORTCUT} or Escape turns it off.
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
          <ItemTitle>Hotkey hint</ItemTitle>
          <ItemDescription>
            Shows the shortcut note above the toolbar for 5 seconds when you
            enter draw mode
          </ItemDescription>
        </ItemContent>
        <ItemActions>
          <Switch
            checked={showHotkeyHint}
            onCheckedChange={setShowHotkeyHint}
          />
        </ItemActions>
      </Item>

      <Item variant="muted">
        <ItemContent>
          <ItemTitle>
            <HugeiconsIcon icon={Time03Icon} size="1em" /> Stroke lifetime
          </ItemTitle>
          <ItemDescription>
            How long ink stays after you draw. Until cleared keeps it until you
            erase or leave draw mode.
          </ItemDescription>
        </ItemContent>
        <ItemActions>
          <Select
            value={
              STROKE_LIFETIME_OPTIONS.find(
                (option) => option.seconds === strokeLifetimeSec,
              )?.id ?? "until"
            }
            onValueChange={(value) => {
              const option = STROKE_LIFETIME_OPTIONS.find(
                (row) => row.id === value,
              );
              if (!option) return;
              setStrokeLifetimeSec(option.seconds);
            }}
          >
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {STROKE_LIFETIME_OPTIONS.map((option) => (
                  <SelectItem key={option.id} value={option.id}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
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
