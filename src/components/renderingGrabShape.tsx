import { easeInOutExpo } from "@/lib/utils";
import { HoldShapeStyle } from "@/stores/key_style";
import { motion } from "motion/react";

/** Height of an equilateral triangle relative to its side. */
const EQUILATERAL_HEIGHT_RATIO = Math.sqrt(3) / 2;

/** Half-side of a square whose 45° diamond fits inside the stroke box. */
const DIAMOND_HALF_SIDE_RATIO = 1 / (2 * Math.SQRT2);

/** Default hold family when a saved style is missing the field. */
const DEFAULT_HOLD_SHAPE_STYLE: HoldShapeStyle = "triangle";

export type GrabShape =
  | "circle"
  | "triangle-up"
  | "triangle-right"
  | "triangle-left"
  | "square-up"
  | "square-right"
  | "square-left";

interface RenderingGrabShapeProps {
  shape: GrabShape;
  size: number;
  color: string;
  stroke: number;
  visible: boolean;
  pressed: boolean;
  duration: number;
}

const TRIANGLE_BY_BUTTON: Record<string, GrabShape> = {
  Left: "triangle-right",
  Right: "triangle-left",
  Middle: "triangle-up",
};

const SQUARE_BY_BUTTON: Record<string, GrabShape> = {
  Left: "square-right",
  Right: "square-left",
  Middle: "square-up",
};

/**
 * Prerotated square: middle is a diamond (vertex up). Left/right are that
 * diamond turned 90°, same treatment as the triangles.
 */
const SQUARE_ROTATION_BY_FACING: Record<string, number> = {
  "square-up": Math.PI / 4,
  "square-right": Math.PI / 4 + Math.PI / 2,
  "square-left": Math.PI / 4 - Math.PI / 2,
};

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
 * Square vertices prerotated around the center. Sized so a 45° diamond stays
 * inside the stroke box.
 */
const buildingSquarePoints = (
  size: number,
  inset: number,
  facing: GrabShape,
) => {
  const inner = size - inset * 2;
  const center = size / 2;
  const half = inner * DIAMOND_HALF_SIDE_RATIO;
  const angle = SQUARE_ROTATION_BY_FACING[facing] ?? Math.PI / 4;
  const corners: [number, number][] = [
    [-half, -half],
    [half, -half],
    [half, half],
    [-half, half],
  ];
  return corners
    .map(([x, y]) => {
      const rx = x * Math.cos(angle) - y * Math.sin(angle);
      const ry = x * Math.sin(angle) + y * Math.cos(angle);
      return `${center + rx},${center + ry}`;
    })
    .join(" ");
};

/**
 * Concrete grab geometry for a mouse button from the per-button hold family.
 */
export const resolvingGrabShape = (
  button: string | null,
  styles: {
    holdShapeLeft?: HoldShapeStyle;
    holdShapeMiddle?: HoldShapeStyle;
    holdShapeRight?: HoldShapeStyle;
  },
): GrabShape | null => {
  if (!button) return null;
  const family =
    button === "Left"
      ? (styles.holdShapeLeft ?? DEFAULT_HOLD_SHAPE_STYLE)
      : button === "Right"
        ? (styles.holdShapeRight ?? DEFAULT_HOLD_SHAPE_STYLE)
        : button === "Middle"
          ? (styles.holdShapeMiddle ?? DEFAULT_HOLD_SHAPE_STYLE)
          : DEFAULT_HOLD_SHAPE_STYLE;
  if (family === "circle") return "circle";
  if (family === "square") {
    return SQUARE_BY_BUTTON[button] ?? "square-up";
  }
  return TRIANGLE_BY_BUTTON[button] ?? "triangle-up";
};

/**
 * Hold highlight: circle, prerotated square, or prerotated triangle.
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
  const squarePoints = buildingSquarePoints(size, inset, shape);
  const isTriangle = shape.startsWith("triangle");
  const isSquare = shape.startsWith("square");

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
      {isSquare && (
        <>
          <polygon
            points={squarePoints}
            fill="none"
            stroke="#000000"
            strokeWidth={stroke + 1}
            strokeLinejoin="miter"
          />
          <polygon
            points={squarePoints}
            fill="none"
            stroke={color}
            strokeWidth={stroke}
            strokeLinejoin="miter"
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
