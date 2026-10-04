import { Component, type ErrorInfo, type ReactNode } from "react";
import { reportError } from "@/lib/errors";
import { ErrorScreen } from "./error-page";

type State = { error: unknown; hasError: boolean };

/**
 * Last line of defense around the whole app, for errors the router's own boundaries can't reach
 * (providers, the router itself). Route errors are handled by ErrorPage instead.
 */
export class AppErrorBoundary extends Component<{ children: ReactNode }, State> {
  override state: State = { error: null, hasError: false };

  static getDerivedStateFromError(error: unknown): State {
    return { error, hasError: true };
  }

  override componentDidCatch(error: unknown, info: ErrorInfo) {
    reportError(error, { source: "react", componentStack: info.componentStack ?? undefined });
  }

  override render() {
    if (this.state.hasError) {
      return (
        <ErrorScreen
          error={this.state.error}
          onRetry={() => this.setState({ error: null, hasError: false })}
          // No router out here (it may be what broke), so going home is a full page load.
          onGoHome={() => window.location.assign("/")}
        />
      );
    }
    return this.props.children;
  }
}
