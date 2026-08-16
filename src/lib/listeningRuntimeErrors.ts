import {
  hidingViteErrorOverlay,
  showingWindowsError,
} from "@/lib/showingWindowsError";

/**
 * Routes window crashes to a Windows popup and strips Vite's lock overlay.
 */
export const listeningRuntimeErrors = () => {
  const handlingError = (event: ErrorEvent) => {
    hidingViteErrorOverlay();
    void showingWindowsError(event.error ?? event.message);
  };
  const handlingRejection = (event: PromiseRejectionEvent) => {
    hidingViteErrorOverlay();
    void showingWindowsError(event.reason);
  };

  window.addEventListener("error", handlingError);
  window.addEventListener("unhandledrejection", handlingRejection);

  const observer = new MutationObserver(() => {
    const overlay = document.querySelector("vite-error-overlay");
    if (!overlay) return;
    const text = overlay.textContent?.trim() || "Keyviz hit an error";
    hidingViteErrorOverlay();
    void showingWindowsError(text);
  });
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
  });

  return () => {
    window.removeEventListener("error", handlingError);
    window.removeEventListener("unhandledrejection", handlingRejection);
    observer.disconnect();
  };
};
