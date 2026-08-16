import { message } from "@tauri-apps/plugin-dialog";

const ERROR_DIALOG_TITLE = "Keyviz";
const DEDUPE_MS = 2000;

let lastText = "";
let lastShownAt = 0;

/**
 * Turns an unknown throw value into dialog text.
 */
const formattingErrorText = (error: unknown) => {
  if (error instanceof Error) {
    return error.stack || error.message || "Unknown error";
  }
  return String(error);
};

/**
 * Removes Vite's fullscreen overlay so it cannot lock the desktop.
 */
export const hidingViteErrorOverlay = () => {
  document.querySelectorAll("vite-error-overlay").forEach((node) => {
    node.remove();
  });
};

/**
 * Shows a native Windows message box instead of a fullscreen overlay.
 */
export const showingWindowsError = async (error: unknown) => {
  hidingViteErrorOverlay();
  const text = formattingErrorText(error);
  const now = Date.now();
  if (text === lastText && now - lastShownAt < DEDUPE_MS) return;
  lastText = text;
  lastShownAt = now;

  try {
    await message(text, { title: ERROR_DIALOG_TITLE, kind: "error" });
  } catch {
    window.alert(text);
  }
};
