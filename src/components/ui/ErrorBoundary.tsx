"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";

interface State {
  error: Error | null;
}

/** Catches WebGL/initialisation failures and explains them instead of showing a blank page. */
export class GameErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[MEMORA] The 3D world failed to start:", error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="absolute inset-0 z-[60] flex items-center justify-center bg-ink p-6 text-center text-ivory">
        <div className="max-w-md">
          <h1 className="font-display text-3xl tracking-[0.3em]">MEMORA</h1>
          <p className="mt-4 text-ivory/80">The museum couldn’t open its doors on this device.</p>
          <p className="mt-2 text-sm text-ivory/55">
            MEMORA needs WebGL. Please make sure hardware acceleration is enabled in your browser settings, or try a recent version of Chrome, Edge, Firefox or Safari.
          </p>
          <p className="mt-4 font-mono text-xs text-ivory/40">{this.state.error.message}</p>
          <button type="button" className="primary-button mt-6" onClick={() => window.location.reload()}>
            Try again
          </button>
        </div>
      </div>
    );
  }
}
