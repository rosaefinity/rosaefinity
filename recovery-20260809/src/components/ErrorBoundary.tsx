import React, { Component, type ReactNode } from "react";
import { AlertTriangle, RefreshCw, RotateCcw, Copy, Activity } from "lucide-react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  pageName?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    this.setState({ errorInfo });
    const electronAPI = (window as any).electronAPI;
    if (electronAPI?.logError) {
      electronAPI.logError({
        message: error.message,
        stack: error.stack,
        componentStack: errorInfo.componentStack,
        page: this.props.pageName || "unknown",
      });
    }
    console.error(`[ErrorBoundary${this.props.pageName ? `:${this.props.pageName}` : ""}]`, error, errorInfo);
  }

  handleReload = () => { window.location.href = "/"; };
  handleRetry = () => { this.setState({ hasError: false, error: null, errorInfo: null }); };
  handleCopyError = () => {
    const { error, errorInfo } = this.state;
    const text = `Error: ${error?.message}\n\nStack: ${error?.stack}\n\nComponent Stack: ${errorInfo?.componentStack || 'N/A'}`;
    navigator.clipboard.writeText(text);
  };
  handleOpenDiagnostics = () => { window.location.href = "/diagnostics"; };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div className="flex flex-col items-center justify-center min-h-[400px] p-8 text-center">
          <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mb-5">
            <AlertTriangle className="w-8 h-8 text-red-400" />
          </div>
          <h2 className="text-xl font-bold text-white mb-2">Something went wrong</h2>
          <p className="text-gray-400 mb-6 max-w-md text-sm">
            {this.props.pageName
              ? `The ${this.props.pageName} page encountered an error.`
              : "An unexpected error occurred."}
            {" "}Your stream is not affected â€” alerts continue to work.
          </p>
          <div className="flex flex-wrap gap-2 justify-center">
            <button onClick={this.handleRetry} className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-sm font-medium transition-colors">
              <RefreshCw className="w-4 h-4" /> Try Again
            </button>
            <button onClick={this.handleReload} className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 text-gray-300 border border-white/10 rounded-lg text-sm font-medium transition-colors">
              <RotateCcw className="w-4 h-4" /> Reload App
            </button>
            <button onClick={this.handleCopyError} className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 text-gray-300 border border-white/10 rounded-lg text-sm font-medium transition-colors">
              <Copy className="w-4 h-4" /> Copy Error
            </button>
            <button onClick={this.handleOpenDiagnostics} className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 text-gray-300 border border-white/10 rounded-lg text-sm font-medium transition-colors">
              <Activity className="w-4 h-4" /> Diagnostics
            </button>
          </div>
          {import.meta.env.DEV && this.state.error && (
            <pre className="mt-6 text-xs text-red-400 bg-black/40 border border-red-500/20 p-4 rounded-xl max-w-2xl w-full overflow-auto text-left scrollbar-thin">
              {this.state.error.message}
              {"\n\n"}
              {this.state.error.stack}
            </pre>
          )}
        </div>
      );
    }
    return this.props.children;
  }
}
