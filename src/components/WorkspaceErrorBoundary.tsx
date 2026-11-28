/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Aurum Intelligence — Resilient Workspace Error Boundary
 *
 * Isolates rendering or chart calculation faults to the active workspace panel
 * so the surrounding navigation shell, live quotes, and session state remain intact.
 */

import React from 'react';
import { AlertTriangle, LayoutDashboard, RotateCcw } from 'lucide-react';

interface WorkspaceErrorBoundaryProps {
  workspaceTitle: string;
  resetKey: string;
  onReturnToOverview: () => void;
  children: React.ReactNode;
}

interface WorkspaceErrorBoundaryState {
  hasError: boolean;
  errorMessage: string;
}

export class WorkspaceErrorBoundary extends React.Component<
  WorkspaceErrorBoundaryProps,
  WorkspaceErrorBoundaryState
> {
  constructor(props: WorkspaceErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, errorMessage: '' };
  }

  static getDerivedStateFromError(error: Error): WorkspaceErrorBoundaryState {
    return {
      hasError: true,
      errorMessage: error?.message || 'Unexpected rendering exception in workspace.',
    };
  }

  componentDidUpdate(prevProps: WorkspaceErrorBoundaryProps) {
    if (prevProps.resetKey !== this.props.resetKey && this.state.hasError) {
      this.setState({ hasError: false, errorMessage: '' });
    }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[WorkspaceErrorBoundary]', this.props.workspaceTitle, error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <section
          role="alert"
          aria-live="assertive"
          className="bg-slate-900 border border-rose-500/40 rounded-lg p-6 max-w-2xl mx-auto my-8 space-y-4"
        >
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" aria-hidden="true" />
            <div>
              <span className="text-[11px] font-mono uppercase tracking-wider text-rose-400 block">
                Workspace Fault Isolated
              </span>
              <h2 className="text-lg font-bold text-slate-100 mt-0.5">
                {this.props.workspaceTitle} encountered a display error
              </h2>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                Navigation, market quotes, and saved portfolio data remain unaffected. You can retry loading this module or return to Commodity Overview.
              </p>
            </div>
          </div>

          {this.state.errorMessage && (
            <div className="bg-slate-950 border border-slate-800 rounded p-3 text-xs font-mono text-rose-300 break-words">
              {this.state.errorMessage}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2.5 pt-2">
            <button
              type="button"
              onClick={() => this.setState({ hasError: false, errorMessage: '' })}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-md bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-xs transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
              Reload Workspace
            </button>
            <button
              type="button"
              onClick={() => {
                this.setState({ hasError: false, errorMessage: '' });
                this.props.onReturnToOverview();
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-medium text-xs transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <LayoutDashboard className="w-3.5 h-3.5" aria-hidden="true" />
              Return to Overview
            </button>
          </div>
        </section>
      );
    }

    return this.props.children;
  }
}
