import { easeOutQuint } from "@/lib/utils";
import { colord } from "colord";
import { motion } from "motion/react";
import { useMemo } from "react";

/** Number of spark lines around the cursor. */
const CLICK_RAY_COUNT = 8;

/** Even spacing around a full circle. */
const CLICK_RAY_STEP_DEG = 360 / CLICK_RAY_COUNT;

/** Min/max ray length as a fraction of the highlight size. */
const CLICK_RAY_LENGTH_RATIO_MIN = 0.12;
const CLICK_RAY_LENGTH_RATIO_MAX = 0.32;

/** Min/max ray thickness as a fraction of the highlight size. */
const CLICK_RAY_WIDTH_RATIO_MIN = 0.012;
const CLICK_RAY_WIDTH_RATIO_MAX = 0.024;

/** Gap from the hotspot to the inner end of each ray. */
const CLICK_RAY_INNER_RATIO = 0.1;

/** Max extra delay so rays shoot out together, not around the ring. */
const CLICK_RAY_BURST_DELAY_MAX_S = 0.03;

/** Hard black edge around each ray. */
const CLICK_RAY_OUTLINE = "0 0 0 0.5px #000000";

/** Wave cycles along a swiggly right-click ray. */
const CLICK_RAY_WAVE_CYCLES = 2.2;

/** Wave amplitude as a fraction of ray length. */
const CLICK_RAY_WAVE_AMP_RATIO = 0.18;

/** Samples used to draw each wavy path. */
const CLICK_RAY_WAVE_STEPS = 18;

const CLICK_RAY_ANGLES = Array.from(
  { length: CLICK_RAY_COUNT },
  (_, index) => index * CLICK_RAY_STEP_DEG,
);

/**
 * Random value in `[min, max]`.
 */
const pickingRandomRange = (min: number, max: number) =>
  min + Math.random() * (max - min);

/**
 * Sine path from the hotspot out along +Y.
 */
const buildingWavyPath = (
  length: number,
  amplitude: number,
  phase: number,
) => {
  const points = Array.from({ length: CLICK_RAY_WAVE_STEPS + 1 }, (_, index) => {
    const t = index / CLICK_RAY_WAVE_STEPS;
    const x =
      Math.sin(t * CLICK_RAY_WAVE_CYCLES * Math.PI * 2 + phase) * amplitude;
    const y = t * length;
    return `${x.toFixed(2)},${y.toFixed(2)}`;
  });
  return `M ${points.join(" L ")}`;
};

interface AnimatingClickBurstProps {
  show: boolean;
  keepHighlight: boolean;
  size: number;
  color: string;
  duration: number;
  swiggly?: boolean;
}

/**
 * Click highlight: rays grow outward from the cursor hotspot.
 */
export const AnimatingClickBurst = ({
  show,
  keepHighlight,
  size,
  color,
  duration,
  swiggly = false,
}: AnimatingClickBurstProps) => {
  const rays = useMemo(
    () =>
      CLICK_RAY_ANGLES.map((angle) => ({
        angle,
        length:
          size *
          pickingRandomRange(
            CLICK_RAY_LENGTH_RATIO_MIN,
            CLICK_RAY_LENGTH_RATIO_MAX,
          ),
        width:
          size *
          pickingRandomRange(
            CLICK_RAY_WIDTH_RATIO_MIN,
            CLICK_RAY_WIDTH_RATIO_MAX,
          ),
        delay: pickingRandomRange(0, CLICK_RAY_BURST_DELAY_MAX_S),
        phase: pickingRandomRange(0, Math.PI * 2),
        amplitude:
          size *
          pickingRandomRange(
            CLICK_RAY_WAVE_AMP_RATIO * 0.7,
            CLICK_RAY_WAVE_AMP_RATIO * 1.3,
          ),
      })),
    [size],
  );
  const innerGap = size * CLICK_RAY_INNER_RATIO;
  const isVisible = show || keepHighlight;
  const visibleOpacity = keepHighlight && !show ? 0.55 : 1;
  const fillColor = colord(color).alpha(1).toHex();

  return (
    <div className="relative h-full w-full">
      {rays.map((ray) => (
        <div
          key={ray.angle}
          className="absolute left-1/2 top-1/2"
          style={{
            transform: `translate(-50%, -50%) rotate(${ray.angle}deg)`,
          }}
        >
          {swiggly ? (
            <motion.svg
              className="absolute left-1/2 overflow-visible"
              initial={{ scaleY: 0, opacity: 0 }}
              animate={
                isVisible
                  ? { scaleY: 1, opacity: visibleOpacity, rotate: [0, 8, -6, 0] }
                  : { scaleY: 0, opacity: 0, rotate: 0 }
              }
              transition={{
                duration,
                ease: easeOutQuint,
                delay: isVisible ? ray.delay : 0,
                rotate: { duration: duration * 1.4, ease: "easeInOut" },
              }}
              width={Math.max(ray.amplitude * 2 + ray.width * 4, 8)}
              height={ray.length}
              style={{
                marginTop: innerGap,
                originX: 0.5,
                originY: 0,
                x: "-50%",
              }}
            >
              <path
                d={buildingWavyPath(ray.length, ray.amplitude, ray.phase)}
                fill="none"
                stroke="#000000"
                strokeWidth={ray.width + 1}
                strokeLinecap="round"
                strokeLinejoin="round"
                transform={`translate(${Math.max(ray.amplitude * 2 + ray.width * 4, 8) / 2} 0)`}
              />
              <path
                d={buildingWavyPath(ray.length, ray.amplitude, ray.phase)}
                fill="none"
                stroke={fillColor}
                strokeWidth={ray.width}
                strokeLinecap="round"
                strokeLinejoin="round"
                transform={`translate(${Math.max(ray.amplitude * 2 + ray.width * 4, 8) / 2} 0)`}
              />
            </motion.svg>
          ) : (
            <motion.span
              className="absolute left-1/2 rounded-full"
              initial={{ scaleY: 0, opacity: 0 }}
              animate={
                isVisible
                  ? { scaleY: 1, opacity: visibleOpacity }
                  : { scaleY: 0, opacity: 0 }
              }
              transition={{
                duration,
                ease: easeOutQuint,
                delay: isVisible ? ray.delay : 0,
              }}
              style={{
                width: ray.width,
                height: ray.length,
                marginTop: innerGap,
                backgroundColor: fillColor,
                originX: 0.5,
                originY: 0,
                x: "-50%",
                boxShadow: CLICK_RAY_OUTLINE,
              }}
            />
          )}
        </div>
      ))}
    </div>
  );
};
