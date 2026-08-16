import { easeInOutExpo } from "@/lib/utils";
import { motion } from "motion/react";

/** Height of an equilateral triangle relative to its side. */
const EQUILATERAL_HEIGHT_RATIO = Math.sqrt(3) / 2;

export type GrabShape =
  | "circle"
  | "square"
  | "triangle-up"
  | "triangle-right"
  | "triangle-left";

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
 * Equilateral triangle vertices, inset so the stroke stays inside the box.
 * Each facing is its own point list, not a runtime rotate.
 */
const buildingTrianglePoints = (
  size: number,
  inset: number,
  facing: GrabShape,
) => {
  const side = size - inset * 2;
  const height = side * EQUILATERAL_HEIGHT_RATIO;
  const center = size / 2;
  if (facing === "triangle-right") {
    const left = (size - height) / 2;
    return `${left + height},${center} ${left},${inset} ${left},${size - inset}`;
  }
  if (facing === "triangle-left") {
    const right = (size + height) / 2;
    return `${right - height},${center} ${right},${inset} ${right},${size - inset}`;
  }
  const top = (size - height) / 2;
  return `${center},${top} ${inset},${top + height} ${size - inset},${top + height}`;
};

/**
 * Hold highlight: circle, square, or a prerotated triangle around the cursor.
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
  const center = size / 2;
  const trianglePoints = buildingTrianglePoints(size, inset, shape);
  const isTriangle = shape.startsWith("triangle");

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
      {shape === "circle" && (
        <>
          <circle
            cx={center}
            cy={center}
            r={inner / 2}
            fill="none"
            stroke="#000000"
            strokeWidth={stroke + 1}
          />
          <circle
            cx={center}
            cy={center}
            r={inner / 2}
            fill="none"
            stroke={color}
            strokeWidth={stroke}
          />
        </>
      )}
      {shape === "square" && (
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
      {isTriangle && (
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
