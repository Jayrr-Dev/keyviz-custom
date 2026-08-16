import { showingWindowsError } from "@/lib/showingWindowsError";
import { invoke } from "@tauri-apps/api/core";
import { Component, ReactNode } from "react";

interface CatchingAppErrorsProps {
  children: ReactNode;
}

interface CatchingAppErrorsState {
  hasError: boolean;
}

/**
 * Catches render crashes and shows a Windows popup instead of a fullscreen overlay.
 */
export class CatchingAppErrors extends Component<
  CatchingAppErrorsProps,
  CatchingAppErrorsState
> {
  state: CatchingAppErrorsState = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    void showingWindowsError(error);
    invoke("set_draw_mode", { enabled: false }).catch(() => undefined);
  }

  render() {
    if (this.state.hasError) return null;
    return this.props.children;
  }
}
