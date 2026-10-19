import React, { useState } from 'react';
import { 
  Database, 
  Loader2, 
  Lock, 
  UserCheck, 
  ShieldCheck, 
  KeyRound, 
  ArrowRight,
  AlertCircle
} from 'lucide-react';
import { convertGoogleDriveUrl } from '../utils/imageHelper';

interface LoginPageProps {
  onGuruSignIn: (password: string) => Promise<boolean>;
  onAdminSignIn: (password: string) => Promise<boolean>;
  isLoggingIn?: boolean;
  isSyncingData?: boolean;
  syncingMessage?: string;
  errorMsg?: string;
  appLogoUrl?: string;
}

export default function LoginPage({
  onGuruSignIn,
  onAdminSignIn,
  isLoggingIn = false,
  isSyncingData = false,
  syncingMessage = '',
  errorMsg = '',
  appLogoUrl = ''
}: LoginPageProps) {
  const [activeAccessTab, setActiveAccessTab] = useState<'guru' | 'admin'>('guru');
  const [guruPassword, setGuruPassword] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');

  const [imageError, setImageError] = useState(false);
  const directLogoUrl = appLogoUrl && !imageError ? convertGoogleDriveUrl(appLogoUrl) : '';

  const handleGuruSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError('');
    if (!guruPassword) {
      setPasswordError('Silakan masukkan password Guru.');
      return;
    }

    const success = await onGuruSignIn(guruPassword);
    if (!success) {
      setPasswordError('Password Guru salah! Silakan coba lagi.');
    }
  };

  const handleAdminSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError('');
    if (!adminPassword) {
      setPasswordError('Silakan masukkan password Admin.');
      return;
    }

    const success = await onAdminSignIn(adminPassword);
    if (!success) {
      setPasswordError('Password Admin salah! Silakan coba lagi.');
    }
  };

  return (
    <div className="fixed inset-0 h-screen h-dvh w-screen overflow-hidden bg-gradient-to-b from-slate-50 via-slate-100 to-slate-200 flex flex-col items-center justify-center p-3 sm:p-5 md:p-8 font-sans select-none z-50">
      {/* Background Glows */}
      <div className="absolute top-0 left-1/4 w-72 h-72 sm:w-96 sm:h-96 bg-indigo-200/40 rounded-full blur-3xl -translate-y-1/2 pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-72 h-72 sm:w-96 sm:h-96 bg-emerald-200/30 rounded-full blur-3xl translate-y-1/2 pointer-events-none" />

      {/* Main Centered Card Container */}
      <div className="w-full max-w-xs sm:max-w-md my-auto flex flex-col justify-center relative z-10">
        
        {/* Header Branding */}
        <div className="text-center mb-3 sm:mb-5 shrink-0">
          {directLogoUrl ? (
            <div className="mx-auto h-12 sm:h-16 md:h-20 w-auto max-w-[160px] sm:max-w-[200px] flex items-center justify-center mb-2 sm:mb-3 transition-transform duration-300">
              <img
                src={directLogoUrl}
                alt="Logo Portal"
                className="h-full w-auto object-contain max-h-full"
                onError={() => setImageError(true)}
              />
            </div>
          ) : (
            <div className="mx-auto h-12 w-12 sm:h-16 sm:w-16 md:h-20 md:w-20 bg-gradient-to-br from-indigo-600 to-indigo-800 rounded-2xl sm:rounded-3xl flex items-center justify-center text-white shadow-xl mb-2 sm:mb-3 transition-transform duration-300">
              <Database className="w-6 h-6 sm:w-8 sm:h-8 md:w-10 md:h-10 drop-shadow-sm" />
            </div>
          )}
          <h1 className="text-xl sm:text-2xl md:text-3xl font-black text-slate-900 tracking-tight leading-tight">
            Portal Presensi &amp; Nilai
          </h1>
          <div className="mt-1 sm:mt-1.5 flex items-center justify-center gap-1.5 sm:gap-2">
            <span className="h-px w-5 sm:w-8 bg-slate-300" />
            <p className="text-[10px] sm:text-xs text-indigo-600 font-extrabold uppercase tracking-wider sm:tracking-widest">
              Sistem Manajemen Presensi &amp; Nilai
            </p>
            <span className="h-px w-5 sm:w-8 bg-slate-300" />
          </div>
        </div>

        {/* Card Box */}
        <div className="bg-white/95 backdrop-blur-md p-4 sm:p-6 shadow-xl sm:shadow-2xl rounded-2xl sm:rounded-3xl border border-white/80 space-y-3 sm:space-y-4">
          
          {/* Access Mode Selector */}
          <div className="bg-slate-100 p-1 rounded-xl sm:rounded-2xl flex border border-slate-200 text-xs font-black">
            <button
              type="button"
              onClick={() => {
                setActiveAccessTab('guru');
                setPasswordError('');
              }}
              className={`flex-1 py-2 sm:py-2.5 rounded-lg sm:rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer text-xs ${
                activeAccessTab === 'guru'
                  ? 'bg-white text-indigo-700 shadow-sm font-black'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <UserCheck className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
              <span>Akses Guru</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveAccessTab('admin');
                setPasswordError('');
              }}
              className={`flex-1 py-2 sm:py-2.5 rounded-lg sm:rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer text-xs ${
                activeAccessTab === 'admin'
                  ? 'bg-white text-indigo-700 shadow-sm font-black'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
              <span>Akses Admin</span>
            </button>
          </div>

          {isSyncingData && (
            <div className="rounded-xl bg-indigo-50/80 p-2.5 sm:p-3 border border-indigo-100 flex gap-2.5 text-xs text-indigo-800 font-bold items-center shadow-xs">
              <Loader2 className="w-4 h-4 shrink-0 text-indigo-600 animate-spin" />
              <span className="text-[11px] sm:text-xs leading-snug">{syncingMessage || "Memuat data dari Firebase Firestore... Mohon tunggu."}</span>
            </div>
          )}

          {(errorMsg || passwordError) && (
            <div className="rounded-xl bg-rose-50 p-2.5 sm:p-3 border border-rose-100 flex items-start gap-2 text-xs text-rose-700 font-bold shadow-xs">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span className="text-[11px] sm:text-xs leading-snug">{passwordError || errorMsg}</span>
            </div>
          )}

          {/* GURU ACCESS FORM */}
          {activeAccessTab === 'guru' && (
            <form onSubmit={handleGuruSubmit} className="space-y-3">
              <div className="bg-indigo-50/60 p-3 sm:p-3.5 rounded-xl sm:rounded-2xl border border-indigo-100 text-slate-700 text-xs space-y-0.5 sm:space-y-1">
                <p className="font-extrabold text-indigo-900 flex items-center gap-1.5 text-xs">
                  <KeyRound className="w-3.5 h-3.5 text-indigo-600 shrink-0" /> Mode Guru (Password)
                </p>
                <p className="text-slate-600 leading-relaxed text-[11px] sm:text-xs">
                  Akses pengisian presensi harian, jurnal kelas, penginputan nilai, dan catatan siswa.
                </p>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] sm:text-[11px] font-extrabold text-slate-700 uppercase tracking-wider block">
                  Password Guru
                </label>
                <div className="relative">
                  <Lock className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="password"
                    value={guruPassword}
                    onChange={(e) => setGuruPassword(e.target.value)}
                    placeholder="Masukkan password guru"
                    className="w-full pl-9 sm:pl-10 pr-3 sm:pr-4 py-2.5 sm:py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-extrabold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition"
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoggingIn || isSyncingData}
                className="w-full flex justify-center items-center gap-2 py-2.5 sm:py-3 px-4 border border-transparent rounded-xl sm:rounded-2xl shadow-md hover:shadow-lg text-xs font-extrabold text-white bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 focus:outline-none transition duration-150 cursor-pointer disabled:opacity-50"
              >
                {isLoggingIn ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-white" />
                    Memproses Masuk...
                  </>
                ) : (
                  <>
                    Masuk Sebagai Guru <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          )}

          {/* ADMIN ACCESS FORM */}
          {activeAccessTab === 'admin' && (
            <form onSubmit={handleAdminSubmit} className="space-y-3">
              <div className="bg-slate-50 p-3 sm:p-3.5 rounded-xl sm:rounded-2xl border border-slate-200 text-slate-700 text-xs space-y-0.5 sm:space-y-1">
                <p className="font-extrabold text-slate-900 flex items-center gap-1.5 text-xs">
                  <KeyRound className="w-3.5 h-3.5 text-indigo-600 shrink-0" /> Mode Admin (Password)
                </p>
                <p className="text-slate-500 leading-relaxed text-[11px] sm:text-xs">
                  Akses penuh administrator termasuk kelola siswa, manajemen kelas, dan pengaturan data Firebase.
                </p>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] sm:text-[11px] font-extrabold text-slate-700 uppercase tracking-wider block">
                  Password Admin
                </label>
                <div className="relative">
                  <Lock className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="password"
                    value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)}
                    placeholder="Masukkan password admin"
                    className="w-full pl-9 sm:pl-10 pr-3 sm:pr-4 py-2.5 sm:py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-extrabold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition"
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoggingIn || isSyncingData}
                className="w-full flex justify-center items-center gap-2 py-2.5 sm:py-3 px-4 border border-transparent rounded-xl sm:rounded-2xl shadow-md hover:shadow-lg text-xs font-extrabold text-white bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 focus:outline-none transition duration-150 cursor-pointer disabled:opacity-50"
              >
                {isLoggingIn ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-white" />
                    Memproses Masuk...
                  </>
                ) : (
                  <>
                    Masuk Sebagai Admin <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          )}

          <div className="pt-1.5 sm:pt-2 text-center border-t border-slate-100">
            <span className="text-[9px] sm:text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
              Sistem Terhubung ke Database Firebase Firestore
            </span>
          </div>

        </div>
      </div>
    </div>
  );
}
