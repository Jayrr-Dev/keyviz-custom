import { complementingHexColor, easeInOutExpo } from "@/lib/utils";
import { useKeyEvent } from "@/stores/key_event";
import { useKeyStyle } from "@/stores/key_style";
import { MouseButton } from "@/types/event";
import { platform } from "@tauri-apps/plugin-os";
import { motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { AnimatingClickBurst } from "./animatingClickBurst";
import { MouseIndicator } from "./mouse-indicator";

/** Hold longer than this and the click becomes a grab (ring). */
const SHORT_CLICK_MAX_MS = 180;

/** How long the burst stays visible after a short click. */
const BURST_DISPLAY_MS = 220;

/** Grab ring diameter relative to the click-line highlight size. */
const RING_SIZE_RATIO = 0.5;

/** Grab ring stroke relative to ring diameter. */
const RING_BORDER_RATIO = 0.14;

/** Thin black edge on both sides of the ring stroke. */
const RING_OUTLINE = "0 0 0 0.5px #000000, inset 0 0 0 0.5px #000000";

/**
 * Right click uses the opposite hue of the picker color.
 */
const pickingHighlightColor = (
  button: MouseButton | null,
  baseColor: string,
) => (button === "Right" ? complementingHexColor(baseColor) : baseColor);

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
  const [highlightColor, setHighlightColor] = useState(style.color);
  const [isSwiggly, setIsSwiggly] = useState(false);

  const positionRef = useRef<HTMLDivElement>(null);
  const burstTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const holdTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isGrabRef = useRef(false);
  const hasPressCycleRef = useRef(false);

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
      setHighlightColor(pickingHighlightColor(pressedMouseButton, style.color));
      setIsSwiggly(pressedMouseButton === "Right");
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
      el.style.transform = `translate3d(${state.mouse.x / dpr}px, ${state.mouse.y / dpr}px, 0) translate(-50%, -50%)`;
    });

    return () => unsubscribe();
  }, [
    style.showClicks,
    style.keepHighlight,
    style.showIndicator,
    style.keepIndicator,
  ]);

  const shouldRender =
    style.showClicks ||
    style.keepHighlight ||
    style.showIndicator ||
    style.keepIndicator;
  if (!shouldRender) return null;

  const ringSize = style.size * RING_SIZE_RATIO;
  const ringVisible = showRing || style.keepHighlight;
  const indicatorVisible =
    showBurst || showRing || style.keepIndicator || wheel !== 0;

  return (
    <div className="absolute top-0 left-0 w-full h-full pointer-events-none overflow-hidden">
      <div
        ref={positionRef}
        className="absolute top-0 left-0 will-change-transform"
        style={{
          width: style.size,
          height: style.size,
        }}
      >
        {style.showClicks && (
          <>
            <AnimatingClickBurst
              key={burstKey}
              show={showBurst}
              keepHighlight={false}
              size={style.size}
              color={highlightColor}
              duration={animationDuration}
              swiggly={isSwiggly}
            />
            <motion.div
              className="absolute left-1/2 top-1/2"
              initial={false}
              animate={{
                opacity: ringVisible ? 1 : 0,
                scale: showRing ? 0.85 : 1,
                borderWidth: ringSize * RING_BORDER_RATIO,
                x: "-50%",
                y: "-50%",
              }}
              style={{
                width: ringSize,
                height: ringSize,
                borderColor: highlightColor,
                borderStyle: "solid",
                borderRadius: "50%",
                boxShadow: RING_OUTLINE,
              }}
              transition={{
                duration: animationDuration,
                ease: easeInOutExpo,
              }}
            />
          </>
        )}

        {style.showIndicator && (
          <motion.div
            className="absolute left-1/2 top-1/2"
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
