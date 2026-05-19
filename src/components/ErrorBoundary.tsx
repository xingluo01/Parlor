import { Component, type ErrorInfo, type ReactNode } from 'react';
import i18n from '../i18n';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[Parlor] ErrorBoundary caught:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      const error = this.state.error;
      const detail = error?.stack || error?.message || '未知错误';

      return (
        <div className="min-h-screen bg-dark-300 flex items-center justify-center p-6">
          <div className="glass max-w-2xl w-full p-8 shadow-dramatic">
            <h1 className="text-2xl font-bold text-white mb-3 font-serif tracking-tight">
              <span className="text-red-400">⚠</span> {i18n.t('errors.errorBoundary.title')}
            </h1>
            <p className="text-gray-500 mb-4">
              {error?.message || i18n.t('errors.errorBoundary.description')}
            </p>

            {/* 错误详细信息 */}
            <div className="mb-6">
              <details className="group">
                <summary className="text-xs text-gray-400 cursor-pointer hover:text-gray-300 select-none">
                  查看错误详情
                </summary>
                <pre className="mt-2 p-3 rounded bg-dark-300/80 border border-glass-border text-xs text-gray-400 overflow-auto max-h-64 whitespace-pre-wrap break-all">
                  {detail}
                </pre>
              </details>
            </div>

            <div className="flex gap-3 justify-center">
              <button
                onClick={() => {
                  navigator.clipboard.writeText(detail);
                }}
                className="px-4 py-2 bg-dark-300 hover:bg-dark-100 text-gray-400 rounded-lg transition-colors border border-glass-border text-sm"
              >
                复制错误详情
              </button>
              <button
                onClick={() => {
                  this.setState({ hasError: false, error: null });
                  window.location.href = '/';
                }}
                className="px-6 py-2 bg-parlor-500 hover:bg-parlor-600 text-white rounded-lg transition-colors border border-parlor-500/20 text-sm"
              >
                {i18n.t('errors.errorBoundary.returnHome')}
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
