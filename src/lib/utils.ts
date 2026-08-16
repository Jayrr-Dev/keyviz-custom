import { clsx, type ClassValue } from "clsx";
import { colord } from "colord";
import { BezierDefinition } from "motion/react";
import { twMerge } from "tailwind-merge";

/** Two steps toward green from yellow on a 12-hue wheel. */
const LEFT_COMPLEMENT_HUE_DEG = 60;

/** One step toward orange from yellow on a 12-hue wheel. */
const RIGHT_COMPLEMENT_HUE_DEG = -30;

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function lighten(hex: string, l: number): string {
  return `oklch(from ${hex} clamp(0, calc(l + ${l}), 1) c h)`;
}

export function darken(hex: string, l: number): string {
  return `oklch(from ${hex} clamp(0, calc(l - ${l}), 1) c h)`;
}

export const easeOutQuint: BezierDefinition = [0.23, 1.0, 0.32, 1.0];
export const easeInQuint: BezierDefinition = [0.76, 0.05, 0.86, 0.06];
export const easeInOutExpo: BezierDefinition = [0.86, 0.0, 0.07, 1.0];

/**
 * Color to the left of the pick on a 12-hue wheel. Yellow becomes green.
 */
export const pickingLeftComplementColor = (hex: string): string =>
  colord(hex).rotate(LEFT_COMPLEMENT_HUE_DEG).toHex();

/**
 * Color to the right of the pick on a 12-hue wheel. Yellow becomes orange.
 */
export const pickingRightComplementColor = (hex: string): string =>
  colord(hex).rotate(RIGHT_COMPLEMENT_HUE_DEG).toHex();
