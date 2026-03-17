import { Component, type ReactNode, type ErrorInfo } from 'react';

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

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-black flex items-center justify-center px-4">
          <div className="max-w-lg text-center">
            <h1 className="text-xl font-bold text-red-400 mb-3">Errore di rendering</h1>
            <p className="text-sm text-zinc-400 mb-4">
              {this.state.error?.message || 'Errore sconosciuto'}
            </p>
            <pre className="text-xs text-zinc-600 bg-zinc-900 rounded-lg p-4 overflow-auto max-h-40 text-left mb-4">
              {this.state.error?.stack?.slice(0, 500)}
            </pre>
            <button
              onClick={() => {
                this.setState({ hasError: false, error: null });
                window.location.href = '/admin/new/';
              }}
              className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm"
            >
              Torna alla dashboard
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
