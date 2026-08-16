import { DRAW_MODE_CLEAR_EVENT, useDrawMode } from "@/stores/draw_mode";
import { listen } from "@tauri-apps/api/event";
import { PointerEvent, useEffect, useRef } from "react";

const DRAW_HINT = "Draw mode · Ctrl+Alt+Y to exit";

interface DrawPoint {
  x: number;
  y: number;
}

interface DrawStroke {
  color: string;
  width: number;
  points: DrawPoint[];
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
 * Paints every stroke onto the canvas.
 */
const paintingStrokes = (canvas: HTMLCanvasElement, strokes: DrawStroke[]) => {
  const context = canvas.getContext("2d");
  if (!context) return;
  const dpr = window.devicePixelRatio || 1;
  context.setTransform(dpr, 0, 0, dpr, 0, 0);
  context.clearRect(0, 0, canvas.width, canvas.height);
  for (const stroke of strokes) {
    if (stroke.points.length === 0) continue;
    context.strokeStyle = stroke.color;
    context.lineWidth = stroke.width;
    context.lineCap = "round";
    context.lineJoin = "round";
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
};

/**
 * Full-screen drawing layer. Takes clicks only while Draw Mode is on.
 */
export const RenderingDrawCanvas = () => {
  const enabled = useDrawMode((state) => state.enabled);
  const color = useDrawMode((state) => state.color);
  const strokeWidth = useDrawMode((state) => state.strokeWidth);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const strokesRef = useRef<DrawStroke[]>([]);
  const currentRef = useRef<DrawStroke | null>(null);

  const paintingCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const live = currentRef.current
      ? [...strokesRef.current, currentRef.current]
      : strokesRef.current;
    paintingStrokes(canvas, live);
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
      paintingCanvas();
    });
    return () => {
      window.removeEventListener("resize", sizingCanvas);
      unlisten.then((stop) => stop());
    };
  }, []);

  const startingStroke = (event: PointerEvent<HTMLCanvasElement>) => {
    if (!enabled) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    currentRef.current = {
      color,
      width: strokeWidth,
      points: [readingCanvasPoint(event)],
    };
    paintingCanvas();
  };

  const movingStroke = (event: PointerEvent<HTMLCanvasElement>) => {
    if (!currentRef.current) return;
    currentRef.current.points.push(readingCanvasPoint(event));
    paintingCanvas();
  };

  const endingStroke = () => {
    if (!currentRef.current) return;
    if (currentRef.current.points.length > 0) {
      strokesRef.current = [...strokesRef.current, currentRef.current];
    }
    currentRef.current = null;
    paintingCanvas();
  };

  return (
    <div
      className={
        enabled
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
      />
      {enabled ? (
        <div className="absolute top-4 left-1/2 z-50 -translate-x-1/2 rounded-full bg-neutral-900/90 px-4 py-1.5 text-sm font-medium text-neutral-100 shadow-md">
          {DRAW_HINT}
        </div>
      ) : null}
    </div>
  );
};
