import { Component } from 'react';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] px-6 text-center">
          <div className="w-16 h-16 bg-danger/10 rounded-full flex items-center justify-center mb-4">
            <svg className="w-8 h-8 text-danger" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h3 className="text-lg font-bold text-gray-800 mb-2">Terjadi Kesalahan</h3>
          <p className="text-sm text-gray-500 mb-6 max-w-xs">
            Maaf, terjadi kesalahan yang tidak terduga. Silakan coba lagi.
          </p>
          <button
            onClick={this.handleRetry}
            className="px-6 py-2.5 bg-navy text-white text-sm font-medium rounded-xl active:bg-navy-dark"
          >
            Coba Lagi
          </button>
          {this.state.error && (
            <details className="mt-4 text-left w-full max-w-xs">
              <summary className="text-xs text-gray-400 cursor-pointer">Detail Error</summary>
              <pre className="mt-2 text-[10px] text-gray-400 bg-gray-50 p-3 rounded-lg overflow-x-auto">
                {this.state.error.toString()}
              </pre>
            </details>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}
