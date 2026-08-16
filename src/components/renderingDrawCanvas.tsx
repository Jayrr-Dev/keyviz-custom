import {
  DRAW_MODE_CLEAR_EVENT,
  DrawInkTool,
  useDrawMode,
} from "@/stores/draw_mode";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { PointerEvent, useEffect, useRef } from "react";

const EXIT_KEY = "Escape";

const ERASE_BUTTON = 2;
const ERASE_RADIUS_PADDING = 10;
const ERASE_STREAK_WIDTH_SCALE = 0.55;
const ERASE_STREAK_EDGE_SCALE = 1.2;
const ERASE_STREAK_MS = 520;
const ERASE_STREAK_EDGE = "180, 180, 186";
const ERASE_STREAK_CORE = "255, 255, 255";
const ERASE_MIN_POINT_GAP = 2;
const ERASE_STEP_GAP = 6;
const STROKE_FADE_MS = 320;
const ARROW_HEAD_MIN = 12;
const ARROW_HEAD_WIDTH_SCALE = 4;
const SHAPE_HIT_STEPS = 32;

interface DrawPoint {
  x: number;
  y: number;
}

interface DrawStroke {
  kind: DrawInkTool;
  color: string;
  width: number;
  points: DrawPoint[];
  finishedAt: number | null;
}

interface EraseTrailPoint extends DrawPoint {
  bornAt: number;
}

/**
 * Reads pointer position in canvas CSS pixels.
 */
const readingCanvasPoint = (
  event: PointerEvent<HTMLCanvasElement>,
): DrawPoint => {
  const bounds = event.currentTarget.getBoundingClientRect();
  return {
    x: event.clientX - bounds.left,
    y: event.clientY - bounds.top,
  };
};

/**
 * Distance from a point to a line segment.
 */
const distancingPointToSegment = (
  point: DrawPoint,
  start: DrawPoint,
  end: DrawPoint,
) => {
  const deltaX = end.x - start.x;
  const deltaY = end.y - start.y;
  const lengthSquared = deltaX * deltaX + deltaY * deltaY;
  if (lengthSquared === 0) {
    return Math.hypot(point.x - start.x, point.y - start.y);
  }
  const amount = Math.max(
    0,
    Math.min(
      1,
      ((point.x - start.x) * deltaX + (point.y - start.y) * deltaY) /
        lengthSquared,
    ),
  );
  return Math.hypot(
    point.x - (start.x + amount * deltaX),
    point.y - (start.y + amount * deltaY),
  );
};

/**
 * Bounding box from the first two drag points.
 */
const readingShapeBox = (points: DrawPoint[]) => {
  const start = points[0];
  const end = points[points.length - 1] ?? start;
  return {
    start,
    end,
    left: Math.min(start.x, end.x),
    top: Math.min(start.y, end.y),
    width: Math.abs(end.x - start.x),
    height: Math.abs(end.y - start.y),
  };
};

/**
 * Outline used for erase hits on shapes.
 */
const listingShapeHitPoints = (stroke: DrawStroke): DrawPoint[] => {
  const box = readingShapeBox(stroke.points);
  if (stroke.kind === "square") {
    return [
      { x: box.left, y: box.top },
      { x: box.left + box.width, y: box.top },
      { x: box.left + box.width, y: box.top + box.height },
      { x: box.left, y: box.top + box.height },
      { x: box.left, y: box.top },
    ];
  }
  if (stroke.kind === "circle") {
    const centerX = box.left + box.width / 2;
    const centerY = box.top + box.height / 2;
    const radiusX = box.width / 2;
    const radiusY = box.height / 2;
    return Array.from({ length: SHAPE_HIT_STEPS + 1 }, (_, index) => {
      const angle = (index / SHAPE_HIT_STEPS) * Math.PI * 2;
      return {
        x: centerX + Math.cos(angle) * radiusX,
        y: centerY + Math.sin(angle) * radiusY,
      };
    });
  }
  if (stroke.kind === "arrow") {
    const head = listingArrowHead(box.start, box.end, stroke.width);
    return [box.start, box.end, ...head];
  }
  return stroke.points;
};

/**
 * Two wings of an arrowhead at the end of a line.
 */
const listingArrowHead = (
  start: DrawPoint,
  end: DrawPoint,
  width: number,
): DrawPoint[] => {
  const angle = Math.atan2(end.y - start.y, end.x - start.x);
  const length = Math.max(ARROW_HEAD_MIN, width * ARROW_HEAD_WIDTH_SCALE);
  const left = angle + Math.PI * 0.82;
  const right = angle - Math.PI * 0.82;
  return [
    {
      x: end.x + Math.cos(left) * length,
      y: end.y + Math.sin(left) * length,
    },
    end,
    {
      x: end.x + Math.cos(right) * length,
      y: end.y + Math.sin(right) * length,
    },
  ];
};

/**
 * True when the eraser circle touches this stroke.
 */
const hittingStroke = (
  stroke: DrawStroke,
  point: DrawPoint,
  radius: number,
) => {
  const hitRadius = radius + stroke.width / 2;
  const points = listingShapeHitPoints(stroke);
  if (points.length === 1) {
    return (
      Math.hypot(point.x - points[0].x, point.y - points[0].y) <= hitRadius
    );
  }
  for (let index = 1; index < points.length; index += 1) {
    if (
      distancingPointToSegment(point, points[index - 1], points[index]) <=
      hitRadius
    ) {
      return true;
    }
  }
  return false;
};

/**
 * Draws a finished or in-progress shape.
 */
const strokingShape = (
  context: CanvasRenderingContext2D,
  stroke: DrawStroke,
) => {
  const box = readingShapeBox(stroke.points);
  if (stroke.kind === "square") {
    context.strokeRect(box.left, box.top, box.width, box.height);
    return;
  }
  if (stroke.kind === "circle") {
    context.beginPath();
    context.ellipse(
      box.left + box.width / 2,
      box.top + box.height / 2,
      box.width / 2,
      box.height / 2,
      0,
      0,
      Math.PI * 2,
    );
    context.stroke();
    return;
  }
  if (stroke.kind === "arrow") {
    context.beginPath();
    context.moveTo(box.start.x, box.start.y);
    context.lineTo(box.end.x, box.end.y);
    context.stroke();
    const head = listingArrowHead(box.start, box.end, stroke.width);
    context.beginPath();
    context.moveTo(head[0].x, head[0].y);
    context.lineTo(head[1].x, head[1].y);
    context.lineTo(head[2].x, head[2].y);
    context.stroke();
  }
};

/**
 * Paints every stroke onto the canvas.
 */
const paintingStrokes = (
  canvas: HTMLCanvasElement,
  strokes: DrawStroke[],
  lifetimeMs: number,
) => {
  const context = canvas.getContext("2d");
  if (!context) return;
  const dpr = window.devicePixelRatio || 1;
  const now = performance.now();
  context.setTransform(dpr, 0, 0, dpr, 0, 0);
  context.clearRect(0, 0, canvas.width, canvas.height);
  for (const stroke of strokes) {
    if (stroke.points.length === 0) continue;
    let alpha = 1;
    if (lifetimeMs > 0 && stroke.finishedAt != null) {
      const age = now - stroke.finishedAt;
      if (age >= lifetimeMs) continue;
      const remaining = lifetimeMs - age;
      if (remaining < STROKE_FADE_MS) {
        alpha = remaining / STROKE_FADE_MS;
      }
    }
    context.save();
    context.globalAlpha = alpha;
    context.strokeStyle = stroke.color;
    context.lineWidth = stroke.width;
    context.lineCap = "round";
    context.lineJoin = "round";
    if (stroke.kind && stroke.kind !== "pen") {
      strokingShape(context, stroke);
    } else {
      context.beginPath();
      context.moveTo(stroke.points[0].x, stroke.points[0].y);
      for (const point of stroke.points.slice(1)) {
        context.lineTo(point.x, point.y);
      }
      if (stroke.points.length === 1) {
        context.lineTo(stroke.points[0].x + 0.1, stroke.points[0].y);
      }
      context.stroke();
    }
    context.restore();
  }
};

/**
 * One continuous ribbon. Midpoint quads keep joints from looking like dots.
 */
const strokingSmoothedPath = (
  context: CanvasRenderingContext2D,
  points: DrawPoint[],
) => {
  if (points.length < 2) return;
  context.beginPath();
  context.moveTo(points[0].x, points[0].y);
  if (points.length === 2) {
    context.lineTo(points[1].x, points[1].y);
    context.stroke();
    return;
  }
  for (let index = 1; index < points.length - 1; index += 1) {
    const midX = (points[index].x + points[index + 1].x) / 2;
    const midY = (points[index].y + points[index + 1].y) / 2;
    context.quadraticCurveTo(points[index].x, points[index].y, midX, midY);
  }
  const last = points[points.length - 1];
  context.lineTo(last.x, last.y);
  context.stroke();
};

/**
 * Soft grey-white wipe drawn as a single fading ribbon.
 */
const paintingEraseTrail = (
  context: CanvasRenderingContext2D,
  points: EraseTrailPoint[],
  width: number,
  held: boolean,
) => {
  if (points.length < 2) return;
  const now = performance.now();
  const newest = points[points.length - 1];
  const alpha = held
    ? 1
    : Math.max(0, 1 - (now - newest.bornAt) / ERASE_STREAK_MS);
  if (alpha <= 0) return;
  context.lineCap = "round";
  context.lineJoin = "round";
  context.strokeStyle = `rgba(${ERASE_STREAK_EDGE}, ${0.22 * alpha})`;
  context.lineWidth = width * ERASE_STREAK_EDGE_SCALE;
  strokingSmoothedPath(context, points);
  context.strokeStyle = `rgba(${ERASE_STREAK_CORE}, ${0.55 * alpha})`;
  context.lineWidth = width;
  strokingSmoothedPath(context, points);
};

/**
 * Evenly spaced points from the last trail sample to the pointer.
 */
const fillingEraseSteps = (
  from: DrawPoint,
  to: DrawPoint,
  bornAt: number,
): EraseTrailPoint[] => {
  const distance = Math.hypot(to.x - from.x, to.y - from.y);
  if (distance < ERASE_MIN_POINT_GAP) return [];
  const steps = Math.max(1, Math.ceil(distance / ERASE_STEP_GAP));
  const next: EraseTrailPoint[] = [];
  for (let index = 1; index <= steps; index += 1) {
    const amount = index / steps;
    next.push({
      x: from.x + (to.x - from.x) * amount,
      y: from.y + (to.y - from.y) * amount,
      bornAt,
    });
  }
  return next;
};

/**
 * Full-screen drawing layer. Takes clicks only while Draw Mode is on.
 */
export const RenderingDrawCanvas = () => {
  const enabled = useDrawMode((state) => state.enabled);
  const color = useDrawMode((state) => state.color);
  const strokeWidth = useDrawMode((state) => state.strokeWidth);
  const strokeLifetimeSec =
    useDrawMode((state) => state.strokeLifetimeSec) ?? 0;
  const clickMode = useDrawMode((state) => state.clickMode);
  const drawTool = useDrawMode((state) => state.drawTool);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const strokesRef = useRef<DrawStroke[]>([]);
  const currentRef = useRef<DrawStroke | null>(null);
  const erasingRef = useRef(false);
  const eraseTrailRef = useRef<EraseTrailPoint[]>([]);
  const eraseFrameRef = useRef<number | null>(null);
  const strokeLifetimeRef = useRef(strokeLifetimeSec);
  strokeLifetimeRef.current = strokeLifetimeSec;

  const paintingCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const live = currentRef.current
      ? [...strokesRef.current, currentRef.current]
      : strokesRef.current;
    paintingStrokes(canvas, live, strokeLifetimeRef.current * 1000);
    const context = canvas.getContext("2d");
    if (!context) return;
    paintingEraseTrail(
      context,
      eraseTrailRef.current,
      Math.max(2, strokeWidth * ERASE_STREAK_WIDTH_SCALE),
      erasingRef.current,
    );
  };

  /**
   * Drops ink that has passed its lifetime.
   */
  const droppingExpiredStrokes = () => {
    const lifetimeMs = strokeLifetimeRef.current * 1000;
    if (lifetimeMs <= 0) return false;
    const now = performance.now();
    const next = strokesRef.current.filter(
      (stroke) =>
        stroke.finishedAt == null || now - stroke.finishedAt < lifetimeMs,
    );
    if (next.length === strokesRef.current.length) return true;
    strokesRef.current = next;
    return true;
  };

  /**
   * Keeps erase trails and timed ink fading until they are gone.
   */
  const schedulingCanvasTick = () => {
    if (eraseFrameRef.current != null) return;
    const tickingCanvas = () => {
      const now = performance.now();
      eraseTrailRef.current = eraseTrailRef.current.filter(
        (point) => now - point.bornAt < ERASE_STREAK_MS,
      );
      const inkStillTicking = droppingExpiredStrokes();
      paintingCanvas();
      const keepGoing =
        eraseTrailRef.current.length > 0 ||
        (inkStillTicking &&
          strokesRef.current.some((stroke) => stroke.finishedAt != null));
      if (keepGoing) {
        eraseFrameRef.current = requestAnimationFrame(tickingCanvas);
        return;
      }
      eraseFrameRef.current = null;
    };
    eraseFrameRef.current = requestAnimationFrame(tickingCanvas);
  };

  const sizingCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.floor(window.innerWidth * dpr);
    canvas.height = Math.floor(window.innerHeight * dpr);
    canvas.style.width = `${window.innerWidth}px`;
    canvas.style.height = `${window.innerHeight}px`;
    paintingCanvas();
  };

  useEffect(() => {
    sizingCanvas();
    window.addEventListener("resize", sizingCanvas);
    const unlisten = listen(DRAW_MODE_CLEAR_EVENT, () => {
      strokesRef.current = [];
      currentRef.current = null;
      eraseTrailRef.current = [];
      paintingCanvas();
    });
    return () => {
      window.removeEventListener("resize", sizingCanvas);
      if (eraseFrameRef.current != null) {
        cancelAnimationFrame(eraseFrameRef.current);
        eraseFrameRef.current = null;
      }
      unlisten.then((stop) => stop());
    };
  }, []);

  useEffect(() => {
    if (enabled) return;
    strokesRef.current = [];
    currentRef.current = null;
    eraseTrailRef.current = [];
    if (eraseFrameRef.current != null) {
      cancelAnimationFrame(eraseFrameRef.current);
      eraseFrameRef.current = null;
    }
    paintingCanvas();
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;
    const exitingOnEscape = (event: KeyboardEvent) => {
      if (event.key !== EXIT_KEY) return;
      event.preventDefault();
      void invoke("log", { message: "exit-source: escape" });
      invoke("set_draw_mode", { enabled: false }).catch(() => undefined);
    };
    window.addEventListener("keydown", exitingOnEscape);
    return () => window.removeEventListener("keydown", exitingOnEscape);
  }, [enabled]);

  /**
   * Removes strokes under the eraser.
   */
  const erasingAtPoint = (point: DrawPoint) => {
    const radius = strokeWidth / 2 + ERASE_RADIUS_PADDING;
    const next = strokesRef.current.filter(
      (stroke) => !hittingStroke(stroke, point, radius),
    );
    if (next.length === strokesRef.current.length) return;
    strokesRef.current = next;
  };

  /**
   * Adds a fading wipe mark and erases ink under it.
   */
  const wipingAtPoint = (point: DrawPoint) => {
    const bornAt = performance.now();
    const trail = eraseTrailRef.current;
    const last = trail[trail.length - 1];
    const added = last
      ? fillingEraseSteps(last, point, bornAt)
      : [{ ...point, bornAt }];
    if (added.length === 0) {
      erasingAtPoint(point);
      return;
    }
    eraseTrailRef.current = [...trail, ...added];
    for (const step of added) {
      erasingAtPoint(step);
    }
    paintingCanvas();
    schedulingCanvasTick();
  };

  const startingStroke = (event: PointerEvent<HTMLCanvasElement>) => {
    if (!enabled || clickMode) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    if (event.button === ERASE_BUTTON) {
      currentRef.current = null;
      erasingRef.current = true;
      wipingAtPoint(readingCanvasPoint(event));
      return;
    }
    erasingRef.current = false;
    currentRef.current = {
      kind: drawTool,
      color,
      width: strokeWidth,
      points: [readingCanvasPoint(event)],
      finishedAt: null,
    };
    paintingCanvas();
  };

  const movingStroke = (event: PointerEvent<HTMLCanvasElement>) => {
    if (erasingRef.current || (event.buttons & 2) === 2) {
      currentRef.current = null;
      erasingRef.current = true;
      wipingAtPoint(readingCanvasPoint(event));
      return;
    }
    if (!currentRef.current) return;
    const nextPoint = readingCanvasPoint(event);
    if (currentRef.current.kind === "pen") {
      currentRef.current.points.push(nextPoint);
    } else {
      currentRef.current.points = [currentRef.current.points[0], nextPoint];
    }
    paintingCanvas();
  };

  const endingStroke = (event: PointerEvent<HTMLCanvasElement>) => {
    if (event.button === ERASE_BUTTON || erasingRef.current) {
      erasingRef.current = false;
      currentRef.current = null;
      paintingCanvas();
      return;
    }
    if (!currentRef.current) return;
    if (currentRef.current.points.length > 0) {
      strokesRef.current = [
        ...strokesRef.current,
        { ...currentRef.current, finishedAt: performance.now() },
      ];
    }
    currentRef.current = null;
    paintingCanvas();
    if (strokeLifetimeRef.current > 0) {
      schedulingCanvasTick();
    }
  };

  const blockingContextMenu = (event: { preventDefault: () => void }) => {
    event.preventDefault();
  };

  return (
    <div
      className={
        enabled && !clickMode
          ? "absolute inset-0 z-40 pointer-events-auto"
          : "absolute inset-0 z-40 pointer-events-none"
      }
    >
      <canvas
        ref={canvasRef}
        className="absolute inset-0 h-full w-full"
        onPointerDown={startingStroke}
        onPointerMove={movingStroke}
        onPointerUp={endingStroke}
        onPointerCancel={endingStroke}
        onContextMenu={blockingContextMenu}
      />
    </div>
  );
};
