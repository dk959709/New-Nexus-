import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw, RotateCcw, ChevronDown, ChevronUp } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  showDetails: boolean;
}

export class AppBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
    showDetails: false,
  };

  public static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[NEXUS Uncaught Error]', error, errorInfo);
    this.setState({ errorInfo });
  }

  private handleTryAgain = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  private handleReload = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    window.location.reload();
  };

  private toggleDetails = () => {
    this.setState((prev) => ({ showDetails: !prev.showDetails }));
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div
          id="error-boundary-screen"
          className="min-h-screen flex items-center justify-center p-6 bg-slate-950 text-slate-100 font-sans"
        >
          <div
            className="w-full max-w-lg p-6 sm:p-8 rounded-3xl backdrop-blur-xl border border-rose-500/30 text-center shadow-2xl bg-gradient-to-br from-slate-900/95 to-slate-950/95"
          >
            <div className="w-14 h-14 rounded-full bg-rose-500/20 text-rose-400 border border-rose-500/40 flex items-center justify-center mx-auto mb-4 shadow-[0_0_20px_rgba(244,63,94,0.3)]">
              <AlertTriangle size={28} />
            </div>

            <h2 className="text-xl font-bold text-white mb-2 tracking-tight">
              Application Encountered an Issue
            </h2>

            <p className="text-sm text-slate-300 mb-6 leading-relaxed">
              {this.state.error?.message || 'An unexpected rendering error occurred in this view.'}
            </p>

            <div className="flex items-center justify-center gap-3 flex-wrap mb-4">
              <button
                type="button"
                onClick={this.handleTryAgain}
                className="px-5 py-2.5 rounded-full font-bold text-xs sm:text-sm bg-cyan-500 hover:bg-cyan-400 text-slate-950 transition-all duration-200 flex items-center gap-2 shadow-lg hover:shadow-cyan-500/25"
              >
                <RotateCcw size={14} />
                Try Again
              </button>

              <button
                type="button"
                onClick={this.handleReload}
                className="px-5 py-2.5 rounded-full font-bold text-xs sm:text-sm bg-white/10 hover:bg-white/20 text-white border border-white/15 transition-all duration-200 flex items-center gap-2 shadow-sm"
              >
                <RefreshCw size={14} />
                Reload Page
              </button>
            </div>

            {/* Diagnostic Details Toggle */}
            {this.state.error && (
              <div className="mt-4 pt-4 border-t border-white/10 text-left">
                <button
                  type="button"
                  onClick={this.toggleDetails}
                  className="w-full flex items-center justify-between text-xs text-slate-400 hover:text-slate-200 py-1"
                >
                  <span className="font-mono font-medium">Diagnostic Details</span>
                  {this.state.showDetails ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </button>

                {this.state.showDetails && (
                  <div className="mt-2 p-3 rounded-xl bg-slate-900/90 border border-slate-800 text-[11px] font-mono text-rose-300 overflow-x-auto max-h-40 leading-relaxed">
                    <p className="font-bold text-white mb-1">{this.state.error.name}: {this.state.error.message}</p>
                    {this.state.error.stack && (
                      <pre className="text-slate-400 text-[10px] whitespace-pre-wrap">{this.state.error.stack}</pre>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export { AppBoundary as ErrorBoundary };
