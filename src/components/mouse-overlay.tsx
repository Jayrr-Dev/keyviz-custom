import {
  pickingLeftComplementColor,
  pickingRightComplementColor,
} from "@/lib/utils";
import { useKeyEvent } from "@/stores/key_event";
import { useKeyStyle } from "@/stores/key_style";
import { platform } from "@tauri-apps/plugin-os";
import { motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { AnimatingClickBurst } from "./animatingClickBurst";
import { MouseIndicator } from "./mouse-indicator";
import { RenderingGrabShape, resolvingGrabShape } from "./renderingGrabShape";
import { RenderingScrollArrow } from "./renderingScrollArrow";

/** Hold longer than this and the click becomes a grab (ring). */
const SHORT_CLICK_MAX_MS = 180;

/** How long the burst stays visible after a short click. */
const BURST_DISPLAY_MS = 220;

/** Consecutive clicks inside this window grow the burst. */
const CLICK_COMBO_WINDOW_MS = 500;

/** Extra scale added per click in the combo. */
const CLICK_COMBO_SCALE_STEP = 0.28;

/** Cap so the burst stays on screen. */
const CLICK_COMBO_SCALE_MAX = 2.4;

/** Grab ring diameter relative to the click-line highlight size. */
const RING_SIZE_RATIO = 0.5;

/** Grab ring stroke relative to ring diameter. */
const RING_BORDER_RATIO = 0.14;

/** Green scroll arrow sits just right of the pointer. */
const SCROLL_ARROW_OFFSET_X = 12;

/** Drops the arrow onto the cursor body, not the tip. */
const SCROLL_ARROW_OFFSET_Y = 2;

/** Matches the system cursor, not the click highlight. */
const SCROLL_ARROW_SIZE = 16;

/** Idle / always-highlight ring uses the middle button until a real hold. */
const DEFAULT_HOLD_BUTTON = "Middle";

/** Flash the new hold shape on the cursor after a settings change. */
const HOLD_SHAPE_PREVIEW_MS = 800;

const isMacos = platform() === "macos";

/**
 * Ring color for a mouse button. Right and middle use the complements.
 */
const resolvingHoldHighlightColor = (button: string, color: string) => {
  if (button === "Right") return pickingLeftComplementColor(color);
  if (button === "Middle") return pickingRightComplementColor(color);
  return color;
};

/**
 * Which hold-shape row changed, so the overlay can preview that button.
 */
const pickingChangedHoldButton = (
  previous: {
    holdShapeLeft?: string;
    holdShapeMiddle?: string;
    holdShapeRight?: string;
  },
  next: {
    holdShapeLeft?: string;
    holdShapeMiddle?: string;
    holdShapeRight?: string;
  },
): string | null => {
  if (previous.holdShapeLeft !== next.holdShapeLeft) return "Left";
  if (previous.holdShapeMiddle !== next.holdShapeMiddle) return "Middle";
  if (previous.holdShapeRight !== next.holdShapeRight) return "Right";
  return null;
};

/**
 * Click highlight overlay: burst on short clicks, ring while grabbing.
 */
export const MouseOverlay = () => {
  const wheel = useKeyEvent((state) => state.mouse.wheel);
  const pressedMouseButton = useKeyEvent((state) => state.pressedMouseButton);
  const dragging = useKeyEvent((state) => state.mouse.dragging);
  const style = useKeyStyle((state) => state.mouse);
  const animationDuration = useKeyStyle(
    (state) => state.appearance.animationDuration,
  );

  const [showBurst, setShowBurst] = useState(false);
  const [showRing, setShowRing] = useState(false);
  const [burstKey, setBurstKey] = useState(0);
  const [burstVariant, setBurstVariant] = useState<
    "straight" | "wavy" | "jagged"
  >("straight");
  const [comboScale, setComboScale] = useState(1);
  const [comboCount, setComboCount] = useState(1);
  const [highlightColor, setHighlightColor] = useState(style.color);
  const [lastHoldButton, setLastHoldButton] = useState(DEFAULT_HOLD_BUTTON);
  const [previewRing, setPreviewRing] = useState(false);

  const positionRef = useRef<HTMLDivElement>(null);
  const burstTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const holdTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const previewTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isGrabRef = useRef(false);
  const hasPressCycleRef = useRef(false);
  const comboCountRef = useRef(0);
  const lastBurstAtRef = useRef(0);
  const skipHoldShapePreviewRef = useRef(true);
  const previousHoldShapesRef = useRef({
    holdShapeLeft: style.holdShapeLeft,
    holdShapeMiddle: style.holdShapeMiddle,
    holdShapeRight: style.holdShapeRight,
  });

  const clearingTimers = () => {
    if (burstTimeoutRef.current) {
      clearTimeout(burstTimeoutRef.current);
      burstTimeoutRef.current = null;
    }
    if (holdTimeoutRef.current) {
      clearTimeout(holdTimeoutRef.current);
      holdTimeoutRef.current = null;
    }
    if (previewTimeoutRef.current) {
      clearTimeout(previewTimeoutRef.current);
      previewTimeoutRef.current = null;
    }
  };

  const startingGrab = () => {
    isGrabRef.current = true;
    if (holdTimeoutRef.current) {
      clearTimeout(holdTimeoutRef.current);
      holdTimeoutRef.current = null;
    }
    setShowBurst(false);
    setShowRing(true);
  };

  useEffect(() => {
    if (pressedMouseButton) {
      hasPressCycleRef.current = true;
      clearingTimers();
      setPreviewRing(false);
      setLastHoldButton(pressedMouseButton);
      isGrabRef.current = false;
      setBurstVariant(
        pressedMouseButton === "Right"
          ? "wavy"
          : pressedMouseButton === "Middle"
            ? "jagged"
            : "straight",
      );
      setHighlightColor(
        pressedMouseButton === "Right"
          ? pickingLeftComplementColor(style.color)
          : pressedMouseButton === "Middle"
            ? pickingRightComplementColor(style.color)
            : style.color,
      );
      setShowBurst(false);
      setShowRing(false);
      holdTimeoutRef.current = setTimeout(() => {
        startingGrab();
      }, SHORT_CLICK_MAX_MS);
      return;
    }

    if (!hasPressCycleRef.current) {
      return;
    }

    if (holdTimeoutRef.current) {
      clearTimeout(holdTimeoutRef.current);
      holdTimeoutRef.current = null;
    }

    if (isGrabRef.current) {
      setShowRing(false);
      isGrabRef.current = false;
      return;
    }

    const now = Date.now();
    comboCountRef.current =
      now - lastBurstAtRef.current <= CLICK_COMBO_WINDOW_MS
        ? comboCountRef.current + 1
        : 1;
    lastBurstAtRef.current = now;
    setComboCount(comboCountRef.current);
    setComboScale(
      Math.min(
        1 + (comboCountRef.current - 1) * CLICK_COMBO_SCALE_STEP,
        CLICK_COMBO_SCALE_MAX,
      ),
    );
    setBurstKey((key) => key + 1);
    setShowBurst(true);
    burstTimeoutRef.current = setTimeout(() => {
      setShowBurst(false);
      burstTimeoutRef.current = null;
    }, BURST_DISPLAY_MS);
  }, [pressedMouseButton]);

  useEffect(() => {
    if (dragging && pressedMouseButton) {
      startingGrab();
    }
  }, [dragging, pressedMouseButton]);

  useEffect(() => {
    const previous = previousHoldShapesRef.current;
    const next = {
      holdShapeLeft: style.holdShapeLeft,
      holdShapeMiddle: style.holdShapeMiddle,
      holdShapeRight: style.holdShapeRight,
    };
    previousHoldShapesRef.current = next;

    if (skipHoldShapePreviewRef.current) {
      skipHoldShapePreviewRef.current = false;
      return;
    }

    const changedCount = [
      previous.holdShapeLeft !== next.holdShapeLeft,
      previous.holdShapeMiddle !== next.holdShapeMiddle,
      previous.holdShapeRight !== next.holdShapeRight,
    ].filter(Boolean).length;
    if (changedCount !== 1) return;

    const changedButton = pickingChangedHoldButton(previous, next);
    if (!changedButton) return;

    setLastHoldButton(changedButton);
    if (pressedMouseButton || !style.showClicks) return;

    setPreviewRing(true);
    if (previewTimeoutRef.current) {
      clearTimeout(previewTimeoutRef.current);
    }
    previewTimeoutRef.current = setTimeout(() => {
      setPreviewRing(false);
      previewTimeoutRef.current = null;
    }, HOLD_SHAPE_PREVIEW_MS);
  }, [style.holdShapeLeft, style.holdShapeMiddle, style.holdShapeRight]);

  useEffect(() => {
    return () => clearingTimers();
  }, []);

  useEffect(() => {
    if (!positionRef.current) return;

    const unsubscribe = useKeyEvent.subscribe((state) => {
      const el = positionRef.current;
      if (!el) return;

      const shouldUpdatePosition =
        style.keepHighlight ||
        state.pressedMouseButton ||
        state.mouse.dragging ||
        state.mouse.wheel !== 0 ||
        style.showIndicator ||
        style.keepIndicator;

      if (!shouldUpdatePosition) return;

      const dpr = isMacos ? 1 : window.devicePixelRatio || 1;
      el.style.transform = `translate3d(${state.mouse.x / dpr}px, ${state.mouse.y / dpr}px, 0)`;
    });

    return () => unsubscribe();
  }, [
    style.showClicks,
    style.keepHighlight,
    style.showIndicator,
    style.keepIndicator,
  ]);

  const usesMouseIcons = (style.indicatorStyle ?? "keyboard") === "mouse";
  const shouldRender =
    style.showClicks ||
    style.keepHighlight ||
    style.showIndicator ||
    style.keepIndicator ||
    wheel !== 0;
  if (!shouldRender) return null;

  const activeHoldButton = pressedMouseButton ?? lastHoldButton;
  const grabShape =
    resolvingGrabShape(activeHoldButton, style) ?? "triangle-up";
  const ringColor = resolvingHoldHighlightColor(activeHoldButton, style.color);
  const ringSize = style.size * RING_SIZE_RATIO;
  const ringVisible = showRing || previewRing || style.keepHighlight;
  const indicatorVisible =
    showBurst || showRing || style.keepIndicator || wheel !== 0;
  const scrolling = wheel !== 0;

  return (
    <div className="absolute top-0 left-0 w-full h-full pointer-events-none overflow-hidden">
      <div
        ref={positionRef}
        className="absolute top-0 left-0 will-change-transform"
      >
        {style.showClicks && (
          <div
            className="absolute"
            style={{
              width: style.size,
              height: style.size,
              transform: "translate(-50%, -50%)",
            }}
          >
            <AnimatingClickBurst
              key={burstKey}
              show={showBurst}
              keepHighlight={false}
              size={style.size}
              color={highlightColor}
              duration={animationDuration}
              variant={burstVariant}
              comboScale={comboScale}
              comboCount={comboCount}
            />
            <RenderingGrabShape
              shape={grabShape}
              size={ringSize}
              color={ringColor}
              stroke={ringSize * RING_BORDER_RATIO}
              visible={ringVisible}
              pressed={showRing || previewRing}
              duration={animationDuration}
            />
          </div>
        )}

        {style.showIndicator && usesMouseIcons && (
          <motion.div
            className="absolute"
            animate={{ opacity: indicatorVisible ? 1 : 0 }}
            transition={{ duration: 0.2 }}
          >
            <MouseIndicator />
          </motion.div>
        )}

        {scrolling ? (
          <div
            className="absolute"
            style={{
              left: SCROLL_ARROW_OFFSET_X,
              top: SCROLL_ARROW_OFFSET_Y,
            }}
          >
            <RenderingScrollArrow
              direction={wheel > 0 ? "up" : "down"}
              size={SCROLL_ARROW_SIZE}
            />
          </div>
        ) : null}
      </div>
    </div>
  );
};
