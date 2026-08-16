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
import { GrabShape, RenderingGrabShape } from "./renderingGrabShape";

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

const GRAB_SHAPE_BY_BUTTON: Record<string, GrabShape> = {
  Left: "circle",
  Right: "circle",
  Middle: "triangle",
};

/**
 * Hold shape for each mouse button.
 */
const pickingGrabShape = (button: string | null): GrabShape => {
  if (!button) return "circle";
  return GRAB_SHAPE_BY_BUTTON[button] ?? "circle";
};

const isMacos = platform() === "macos";

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

  const positionRef = useRef<HTMLDivElement>(null);
  const burstTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const holdTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isGrabRef = useRef(false);
  const hasPressCycleRef = useRef(false);
  const comboCountRef = useRef(0);
  const lastBurstAtRef = useRef(0);

  const clearingTimers = () => {
    if (burstTimeoutRef.current) {
      clearTimeout(burstTimeoutRef.current);
      burstTimeoutRef.current = null;
    }
    if (holdTimeoutRef.current) {
      clearTimeout(holdTimeoutRef.current);
      holdTimeoutRef.current = null;
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
    style.keepIndicator;
  if (!shouldRender) return null;

  const ringSize = style.size * RING_SIZE_RATIO;
  const ringVisible = showRing || style.keepHighlight;
  const grabShape = pickingGrabShape(pressedMouseButton);
  const indicatorVisible =
    showBurst || showRing || style.keepIndicator || wheel !== 0;

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
              key={grabShape}
              shape={grabShape}
              size={ringSize}
              color={highlightColor}
              stroke={ringSize * RING_BORDER_RATIO}
              visible={ringVisible}
              pressed={showRing}
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
      </div>
    </div>
  );
};
