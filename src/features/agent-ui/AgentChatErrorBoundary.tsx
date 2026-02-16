"use client";

import { Component, type ReactNode } from "react";
import { AlertCircle, RefreshCw } from "lucide-react";
import { ar } from "@/lib/ar";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class AgentChatErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("Agent chat error:", error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: undefined });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div
          className="agent-error-fallback"
          role="alert"
        >
          <AlertCircle size={32} className="agent-error-icon" />
          <h2 className="agent-error-title">{ar.error}</h2>
          <p className="agent-error-message">
            {ar.agentErrorFallback}
          </p>
          <button
            type="button"
            className="agent-btn primary"
            onClick={this.handleRetry}
          >
            <RefreshCw size={16} />
            {ar.refresh}
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
