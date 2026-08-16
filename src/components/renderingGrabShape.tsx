import { easeInOutExpo } from "@/lib/utils";
import { motion } from "motion/react";

/** Height of an equilateral triangle relative to its side. */
const EQUILATERAL_HEIGHT_RATIO = Math.sqrt(3) / 2;

export type GrabShape = "circle" | "square" | "triangle";

interface RenderingGrabShapeProps {
  shape: GrabShape;
  size: number;
  color: string;
  stroke: number;
  visible: boolean;
  pressed: boolean;
  duration: number;
}

/**
 * Equilateral triangle points, inset so the stroke stays inside the box.
 */
const buildingTrianglePoints = (size: number, inset: number) => {
  const side = size - inset * 2;
  const height = side * EQUILATERAL_HEIGHT_RATIO;
  const top = (size - height) / 2;
  const left = inset;
  const right = size - inset;
  return `${size / 2},${top} ${left},${top + height} ${right},${top + height}`;
};

/**
 * Hold highlight: circle, square, or equilateral triangle around the cursor.
 */
export const RenderingGrabShape = ({
  shape,
  size,
  color,
  stroke,
  visible,
  pressed,
  duration,
}: RenderingGrabShapeProps) => {
  const inset = stroke / 2 + 0.5;
  const inner = size - inset * 2;
  const trianglePoints = buildingTrianglePoints(size, inset);
  const resolvedShape = shape === "square" ? "circle" : shape;

  return (
    <motion.svg
      className="absolute left-1/2 top-1/2 overflow-visible"
      width={size}
      height={size}
      initial={false}
      animate={{
        opacity: visible ? 1 : 0,
        scale: pressed ? 0.85 : 1,
        x: "-50%",
        y: "-50%",
      }}
      transition={{ duration, ease: easeInOutExpo }}
    >
      {resolvedShape === "circle" && (
        <>
          <circle
            cx={size / 2}
            cy={size / 2}
            r={inner / 2}
            fill="none"
            stroke="#000000"
            strokeWidth={stroke + 1}
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={inner / 2}
            fill="none"
            stroke={color}
            strokeWidth={stroke}
          />
        </>
      )}
      {resolvedShape === "square" && (
        <>
          <rect
            x={inset}
            y={inset}
            width={inner}
            height={inner}
            fill="none"
            stroke="#000000"
            strokeWidth={stroke + 1}
          />
          <rect
            x={inset}
            y={inset}
            width={inner}
            height={inner}
            fill="none"
            stroke={color}
            strokeWidth={stroke}
          />
        </>
      )}
      {resolvedShape === "triangle" && (
        <>
          <polygon
            points={trianglePoints}
            fill="none"
            stroke="#000000"
            strokeWidth={stroke + 1}
            strokeLinejoin="miter"
          />
          <polygon
            points={trianglePoints}
            fill="none"
            stroke={color}
            strokeWidth={stroke}
            strokeLinejoin="miter"
          />
        </>
      )}
    </motion.svg>
  );
};
