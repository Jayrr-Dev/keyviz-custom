import { easeOutQuint } from "@/lib/utils";
import { colord } from "colord";
import { motion } from "motion/react";
import { useMemo } from "react";

/** Number of spark lines on the first click. */
const CLICK_RAY_COUNT = 8;

/** Extra rays added per consecutive click in the combo window. */
const CLICK_RAY_COMBO_EXTRA = 2;

/** Cap so the burst stays readable. */
const CLICK_RAY_COUNT_MAX = 20;

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

/** Wave amplitude as a fraction of ray length. */
const CLICK_RAY_WAVE_AMP_RATIO = 0.045;

/** Zigzag amplitude as a fraction of ray length. */
const CLICK_RAY_JAG_AMP_RATIO = 0.05;

/** Sharp corners along a middle-click ray. */
const CLICK_RAY_JAG_STEPS = 4;

/**
 * Random value in `[min, max]`.
 */
const pickingRandomRange = (min: number, max: number) =>
  min + Math.random() * (max - min);

/**
 * One cubic S-curve from the hotspot out along +Y.
 */
const buildingWavyPath = (length: number, amplitude: number, phase: number) => {
  const startBend = Math.cos(phase) * amplitude;
  const midBend = Math.sin(phase) * amplitude;
  return `M 0 0 C ${startBend.toFixed(2)} ${(length * 0.33).toFixed(2)} ${(-midBend).toFixed(2)} ${(length * 0.67).toFixed(2)} 0 ${length.toFixed(2)}`;
};

/**
 * Sharp zigzag from the hotspot out along +Y.
 */
const buildingJaggedPath = (
  length: number,
  amplitude: number,
  phase: number,
) => {
  const points = Array.from({ length: CLICK_RAY_JAG_STEPS + 1 }, (_, index) => {
    const t = index / CLICK_RAY_JAG_STEPS;
    const isEnd = index === 0 || index === CLICK_RAY_JAG_STEPS;
    const side = index % 2 === 0 ? 1 : -1;
    const x = isEnd
      ? 0
      : side * amplitude * (0.75 + 0.25 * Math.sin(phase + index));
    return `${x.toFixed(2)},${(t * length).toFixed(2)}`;
  });
  return `M ${points.join(" L ")}`;
};

type ClickBurstVariant = "straight" | "wavy" | "jagged";

interface AnimatingClickBurstProps {
  show: boolean;
  keepHighlight: boolean;
  size: number;
  color: string;
  duration: number;
  variant?: ClickBurstVariant;
  comboScale?: number;
  comboCount?: number;
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
  variant = "straight",
  comboScale = 1,
  comboCount = 1,
}: AnimatingClickBurstProps) => {
  const rayCount = Math.min(
    CLICK_RAY_COUNT + (comboCount - 1) * CLICK_RAY_COMBO_EXTRA,
    CLICK_RAY_COUNT_MAX,
  );
  const rays = useMemo(
    () =>
      Array.from({ length: rayCount }, (_, index) => ({
        angle: index * (360 / rayCount),
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
            (variant === "jagged"
              ? CLICK_RAY_JAG_AMP_RATIO
              : CLICK_RAY_WAVE_AMP_RATIO) * 0.85,
            (variant === "jagged"
              ? CLICK_RAY_JAG_AMP_RATIO
              : CLICK_RAY_WAVE_AMP_RATIO) * 1.15,
          ),
      })),
    [size, variant, rayCount],
  );
  const innerGap = size * CLICK_RAY_INNER_RATIO;
  const isVisible = show || keepHighlight;
  const visibleOpacity = keepHighlight && !show ? 0.55 : 1;
  const fillColor = colord(color).alpha(1).toHex();

  return (
    <div
      className="relative h-full w-full"
      style={{ transform: `scale(${comboScale})` }}
    >
      {rays.map((ray) => (
        <div
          key={ray.angle}
          className="absolute left-1/2 top-1/2"
          style={{
            transform: `translate(-50%, -50%) rotate(${ray.angle}deg)`,
          }}
        >
          {variant !== "straight" ? (
            <motion.svg
              className="absolute left-1/2 overflow-visible"
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
                d={
                  variant === "jagged"
                    ? buildingJaggedPath(ray.length, ray.amplitude, ray.phase)
                    : buildingWavyPath(ray.length, ray.amplitude, ray.phase)
                }
                fill="none"
                stroke="#000000"
                strokeWidth={ray.width + 1}
                strokeLinecap={variant === "jagged" ? "square" : "round"}
                strokeLinejoin={variant === "jagged" ? "miter" : "round"}
                transform={`translate(${Math.max(ray.amplitude * 2 + ray.width * 4, 8) / 2} 0)`}
              />
              <path
                d={
                  variant === "jagged"
                    ? buildingJaggedPath(ray.length, ray.amplitude, ray.phase)
                    : buildingWavyPath(ray.length, ray.amplitude, ray.phase)
                }
                fill="none"
                stroke={fillColor}
                strokeWidth={ray.width}
                strokeLinecap={variant === "jagged" ? "square" : "round"}
                strokeLinejoin={variant === "jagged" ? "miter" : "round"}
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
