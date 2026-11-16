import { Component } from "react";
import type { ErrorInfo, ReactNode } from "react";
import { FatalScreen } from "./FatalScreen";

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error(
      "Unhandled application error",
      error,
      errorInfo.componentStack
    );
  }

  render() {
    if (this.state.hasError) {
      return (
        <FatalScreen
          title="Что-то пошло не так"
          message="Попробуйте перезагрузить приложение. Если ошибка повторится, откройте его позже."
          actionLabel="Перезагрузить"
          onAction={() => window.location.reload()}
        />
      );
    }

    return this.props.children;
  }
}
