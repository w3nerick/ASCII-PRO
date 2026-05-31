import { Component, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          padding: 32,
          textAlign: 'center',
          color: 'var(--label-secondary)',
          background: 'var(--bg)',
          height: '100dvh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 12,
        }}>
          <p style={{ fontSize: 16, fontWeight: 600, color: 'var(--label)' }}>Something went wrong</p>
          <p style={{ fontSize: 13, color: 'var(--label-tertiary)', maxWidth: 320 }}>
            {this.state.error?.message ?? 'An unexpected error occurred'}
          </p>
          <button
            type="button"
            className="btn btn-tinted btn-sm"
            onClick={() => this.setState({ hasError: false, error: null })}
            style={{ marginTop: 8 }}
          >
            Try Again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
