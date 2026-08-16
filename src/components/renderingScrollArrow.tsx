const ARROW_FILL = "#00FF6A";
const ARROW_HALO = "#052e16";
const ARROW_VIEWBOX = 24;
const ARROW_UP_PATH = "M12 3.5 L20.5 14.5 H15.5 V20.5 H8.5 V14.5 H3.5 Z";
const ARROW_DOWN_PATH = "M12 20.5 L3.5 9.5 H8.5 V3.5 H15.5 V9.5 H20.5 Z";

export type ScrollArrowDirection = "up" | "down";

interface RenderingScrollArrowProps {
  direction: ScrollArrowDirection;
  size: number;
}

/**
 * Green scroll arrow shown to the right of the cursor.
 */
export const RenderingScrollArrow = ({
  direction,
  size,
}: RenderingScrollArrowProps) => {
  const path = direction === "up" ? ARROW_UP_PATH : ARROW_DOWN_PATH;
  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${ARROW_VIEWBOX} ${ARROW_VIEWBOX}`}
      fill="none"
      aria-hidden="true"
    >
      <path
        d={path}
        fill={ARROW_FILL}
        stroke={ARROW_HALO}
        strokeWidth={1.4}
        strokeLinejoin="round"
      />
    </svg>
  );
};
