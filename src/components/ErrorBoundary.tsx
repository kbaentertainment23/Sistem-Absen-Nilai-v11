import { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

export interface Props {
  children?: ReactNode;
  fallbackTitle?: string;
  onReset?: () => void;
}

export interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ErrorBoundary caught error]:', error, errorInfo);
    this.setState({ error, errorInfo });
  }

  handleReload = () => {
    window.location.reload();
  };

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  handleClearCacheAndReload = () => {
    try {
      // Preserve critical auth info if possible
      const role = localStorage.getItem('user_role');
      const loggedIn = localStorage.getItem('user_logged_in');
      localStorage.clear();
      if (role) localStorage.setItem('user_role', role);
      if (loggedIn) localStorage.setItem('user_logged_in', loggedIn);
    } catch (e) {
      console.error(e);
    }
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 font-sans text-slate-800">
          <div className="max-w-md w-full bg-white rounded-2xl shadow-xl border border-slate-200 p-6 sm:p-8 text-center space-y-5">
            <div className="mx-auto w-16 h-16 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center shadow-inner">
              <AlertTriangle className="w-8 h-8" />
            </div>

            <div className="space-y-2">
              <h2 className="text-xl font-bold text-slate-900">
                {this.props.fallbackTitle || 'Terjadi Kendala pada Tampilan'}
              </h2>
              <p className="text-xs text-slate-600 leading-relaxed">
                Sistem mengalami gangguan kecil saat memuat komponen ini. Aplikasi mencegah layar putih secara otomatis agar data Anda tetap aman.
              </p>
            </div>

            {this.state.error && (
              <div className="bg-slate-100 rounded-xl p-3 text-left overflow-auto max-h-32 text-[11px] font-mono text-slate-700 border border-slate-200/80">
                <span className="font-bold text-rose-600 block mb-1">Rincian Error:</span>
                {this.state.error.toString()}
              </div>
            )}

            <div className="flex flex-col gap-2 pt-2">
              <button
                onClick={this.handleReset}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-medium text-xs shadow-md transition-all cursor-pointer"
              >
                <RefreshCw className="w-4 h-4" />
                Coba Muat Ulang Komponen
              </button>

              <button
                onClick={this.handleReload}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium text-xs transition-all cursor-pointer"
              >
                <Home className="w-4 h-4" />
                Refresh Halaman
              </button>

              <button
                onClick={this.handleClearCacheAndReload}
                className="text-[11px] text-slate-400 hover:text-slate-600 underline pt-1 cursor-pointer"
              >
                Bersihkan Cache & Refresh
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
export default ErrorBoundary;
