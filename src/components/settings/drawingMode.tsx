import { AlignmentSelector } from "@/components/ui/alignment-selector";
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
import { NumberScrubber } from "@/components/ui/number-input-scrub";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Toggle } from "@/components/ui/toggle";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  DEFAULT_STROKE_LIFETIME_SEC,
  DRAW_MODE_CLEAR_EVENT,
  DrawToolbarLayout,
  MAX_STROKE_WIDTH,
  MAX_TOOLBAR_OFFSET,
  MIN_STROKE_WIDTH,
  MIN_TOOLBAR_OFFSET,
  useDrawMode,
} from "@/stores/draw_mode";
import { Alignment } from "@/types/style";
import {
  ArrowHorizontalIcon,
  ArrowVerticalIcon,
  Cancel01Icon,
  CursorEdit01Icon,
  Link02Icon,
  PaintBoardIcon,
  ParagraphSpacingIcon,
  TextAlignLeftIcon,
  Time03Icon,
  Unlink02Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { invoke } from "@tauri-apps/api/core";
import { emit, listen } from "@tauri-apps/api/event";
import { useEffect, useState } from "react";

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
  const toolbarLayout =
    useDrawMode((state) => state.toolbarLayout) ?? "horizontal";
  const toolbarAlignment =
    useDrawMode((state) => state.toolbarAlignment) ?? "bottom-center";
  const toolbarOffsetX = useDrawMode((state) => state.toolbarOffsetX) ?? 20;
  const toolbarOffsetY = useDrawMode((state) => state.toolbarOffsetY) ?? 20;
  const setToolbarLayout = useDrawMode((state) => state.setToolbarLayout);
  const setToolbarAlignment = useDrawMode((state) => state.setToolbarAlignment);
  const setToolbarOffsetX = useDrawMode((state) => state.setToolbarOffsetX);
  const setToolbarOffsetY = useDrawMode((state) => state.setToolbarOffsetY);
  const [offsetLinked, setOffsetLinked] = useState(
    toolbarOffsetX === toolbarOffsetY,
  );

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
            Click and drag on the overlay. Select and move relocates marks. Type
            places text. Alt+X/D/T/H/A/S/C picks tools; Alt+R cycles stroke
            size; Alt+Q toggles Click mode; Alt+1-7 picks colors. Hold
            right-click to erase. Hold the middle button for a laser pointer.
            Use Click on the toolbar to use other apps without losing your
            drawings. {DRAW_SHORTCUT} or Escape turns it off.
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
          <ItemDescription>
            Default ink color. A toolbar swatch overrides it until you click
            that swatch again.
          </ItemDescription>
        </ItemContent>
        <ItemActions>
          <ColorInput value={color} onChange={setColor} />
        </ItemActions>
      </Item>

      <Item variant="muted">
        <ItemContent>
          <ItemTitle>Hotkey hint</ItemTitle>
          <ItemDescription>
            Shows the shortcut note next to the toolbar for 5 seconds when you
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

      <h2 className="text-sm font-medium text-muted-foreground">Toolbar</h2>

      <Item variant="muted">
        <ItemContent>
          <ItemTitle>
            <HugeiconsIcon icon={ArrowHorizontalIcon} size="1em" /> Layout
          </ItemTitle>
          <ItemDescription>
            Vertical is icon-only and sits better on the sides of the screen
          </ItemDescription>
        </ItemContent>
        <ItemActions>
          <ToggleGroup
            size="sm"
            type="single"
            variant="outline"
            value={toolbarLayout}
            onValueChange={(value) => {
              if (!value) return;
              setToolbarLayout(value as DrawToolbarLayout);
            }}
          >
            <ToggleGroupItem value="horizontal" aria-label="Horizontal toolbar">
              <HugeiconsIcon icon={ArrowHorizontalIcon} strokeWidth={2} /> Row
            </ToggleGroupItem>
            <ToggleGroupItem value="vertical" aria-label="Vertical toolbar">
              <HugeiconsIcon icon={ArrowVerticalIcon} strokeWidth={2} /> Column
            </ToggleGroupItem>
          </ToggleGroup>
        </ItemActions>
      </Item>

      <Item variant="muted">
        <ItemContent className="self-start">
          <ItemTitle>
            <HugeiconsIcon icon={TextAlignLeftIcon} size="1em" /> Alignment
          </ItemTitle>
          <ItemDescription>
            Position of the draw toolbar on the screen
          </ItemDescription>
        </ItemContent>
        <ItemActions>
          <AlignmentSelector
            className="h-28 w-32 text-base"
            value={toolbarAlignment}
            onChange={(value: Alignment) => setToolbarAlignment(value)}
          />
        </ItemActions>
      </Item>

      <Item variant="muted">
        <ItemContent>
          <ItemTitle>
            <HugeiconsIcon icon={ParagraphSpacingIcon} size="1em" /> Offset
          </ItemTitle>
          <ItemDescription>Space from the edge of the screen</ItemDescription>
        </ItemContent>
        <ItemActions>
          <NumberScrubber
            value={toolbarOffsetX}
            onChange={
              offsetLinked
                ? (value) => {
                    setToolbarOffsetX(value);
                    setToolbarOffsetY(value);
                  }
                : setToolbarOffsetX
            }
            min={MIN_TOOLBAR_OFFSET}
            max={MAX_TOOLBAR_OFFSET}
            step={1}
            icon={<span className="ml-0.5 text-xs font-medium">X</span>}
            className="w-18"
          />
          <Toggle
            variant="default"
            pressed={offsetLinked}
            onPressedChange={(pressed) => {
              setOffsetLinked(pressed);
              if (pressed) {
                setToolbarOffsetY(toolbarOffsetX);
              }
            }}
            aria-label="Offset linked"
          >
            <HugeiconsIcon
              icon={offsetLinked ? Link02Icon : Unlink02Icon}
              size="1em"
            />
          </Toggle>
          <NumberScrubber
            value={toolbarOffsetY}
            onChange={setToolbarOffsetY}
            min={MIN_TOOLBAR_OFFSET}
            max={MAX_TOOLBAR_OFFSET}
            step={1}
            icon={<span className="ml-0.5 text-xs font-medium">Y</span>}
            className="w-18"
            disabled={offsetLinked}
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
