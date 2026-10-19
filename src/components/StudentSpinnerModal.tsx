import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import confetti from 'canvas-confetti';
import { Student } from '../types';
import { 
  Dices, 
  X, 
  Sparkles, 
  Trophy, 
  RotateCw, 
  UserCheck, 
  Volume2, 
  VolumeX, 
  Users, 
  CheckCircle2, 
  Shuffle,
  GraduationCap
} from 'lucide-react';

interface StudentSpinnerModalProps {
  isOpen: boolean;
  onClose: () => void;
  students: Student[];
  classNameText: string;
}

export default function StudentSpinnerModal({
  isOpen,
  onClose,
  students,
  classNameText
}: StudentSpinnerModalProps) {
  const [isSpinning, setIsSpinning] = useState(false);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [winner, setWinner] = useState<Student | null>(null);
  const [excludedNis, setExcludedNis] = useState<string[]>([]);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [showConfetti, setShowConfetti] = useState(false);

  const audioCtxRef = useRef<AudioContext | null>(null);

  // Play tick sound using Web Audio API with pitch elevation and sound design
  const playTickSound = (isWinnerSound = false, progress = 0) => {
    if (!soundEnabled) return;
    try {
      if (!audioCtxRef.current) {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioContextClass) {
          audioCtxRef.current = new AudioContextClass();
        }
      }
      const ctx = audioCtxRef.current;
      if (!ctx) return;

      if (ctx.state === 'suspended') {
        ctx.resume();
      }

      const now = ctx.currentTime;

      if (isWinnerSound) {
        // Triumphant multi-note victory fanfare arpeggio (C5 -> E5 -> G5 -> C6)
        const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
        notes.forEach((freq, idx) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();

          osc.type = 'triangle';
          osc.frequency.setValueAtTime(freq, now + idx * 0.08);

          // Envelope
          gain.gain.setValueAtTime(0, now + idx * 0.08);
          gain.gain.linearRampToValueAtTime(0.12, now + idx * 0.08 + 0.02);
          gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.08 + 0.6);

          osc.connect(gain);
          gain.connect(ctx.destination);

          osc.start(now + idx * 0.08);
          osc.stop(now + idx * 0.08 + 0.65);
        });
      } else {
        // Soft, warm wooden tick sound with gentle lowpass filter
        const baseFreq = 340 + Math.pow(progress, 2) * 320; // Gentle pitch rise from 340Hz to 660Hz
        
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const filter = ctx.createBiquadFilter();

        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(1200, now);

        osc.type = 'sine';
        osc.frequency.setValueAtTime(baseFreq, now);

        // Smooth, soft attack & gentle decay for comfortable listening
        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(0.05, now + 0.004);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.038);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now);
        osc.stop(now + 0.04);
      }
    } catch (e) {
      // Ignore audio errors if blocked
    }
  };

  const availableStudents = students.filter(s => !excludedNis.includes(s.nis));

  const animFrameRef = useRef<number | null>(null);

  const handleClose = () => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    setIsSpinning(false);
    onClose();
  };

  // Reset when modal closes or class changes
  useEffect(() => {
    if (!isOpen) {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
        animFrameRef.current = null;
      }
      setIsSpinning(false);
      setWinner(null);
      setShowConfetti(false);
    }
  }, [isOpen]);

  useEffect(() => {
    setExcludedNis([]);
    setWinner(null);
  }, [classNameText]);

  const fireCelebrationConfetti = () => {
    // Center burst
    confetti({
      particleCount: 80,
      spread: 70,
      origin: { y: 0.6 },
      colors: ['#f59e0b', '#ec4899', '#3b82f6', '#10b981', '#8b5cf6', '#eab308']
    });

    // Left cannon
    setTimeout(() => {
      confetti({
        particleCount: 50,
        angle: 60,
        spread: 55,
        origin: { x: 0.1, y: 0.7 },
        colors: ['#f59e0b', '#3b82f6', '#10b981']
      });
    }, 150);

    // Right cannon
    setTimeout(() => {
      confetti({
        particleCount: 50,
        angle: 120,
        spread: 55,
        origin: { x: 0.9, y: 0.7 },
        colors: ['#ec4899', '#8b5cf6', '#f59e0b']
      });
    }, 300);
  };

  // Clean up animation frame on unmount
  useEffect(() => {
    return () => {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, []);

  const handleStartSpin = () => {
    if (availableStudents.length === 0 || isSpinning) return;

    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
    }

    setIsSpinning(true);
    setWinner(null);
    setShowConfetti(false);

    // Pick random winner beforehand with fair uniform random
    const winnerIndex = Math.floor(Math.random() * availableStudents.length);
    const chosenWinner = availableStudents[winnerIndex];

    const duration = 5000; // 5 seconds duration
    const startTime = performance.now();

    // Calculate total steps: minimum 5 full rotations around the list plus index offset to reach winner
    const minRotations = Math.max(3, Math.ceil(30 / availableStudents.length));
    const totalSteps = minRotations * availableStudents.length + winnerIndex;

    let lastStep = -1;

    const animateSpin = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / duration);

      // Quartic ease-out curve for fast spin at start and dramatic slow down at the end
      const easedProgress = 1 - Math.pow(1 - progress, 4);
      const currentStep = Math.min(totalSteps, Math.floor(easedProgress * (totalSteps + 1)));

      if (currentStep !== lastStep) {
        lastStep = currentStep;
        const displayIdx = currentStep % availableStudents.length;
        setCurrentIndex(displayIdx);
        if (progress < 0.99) {
          playTickSound(false, progress);
        }
      }

      if (elapsed < duration) {
        animFrameRef.current = requestAnimationFrame(animateSpin);
      } else {
        // Spin finished at exactly 5 seconds
        setCurrentIndex(winnerIndex);
        setIsSpinning(false);
        setWinner(chosenWinner);
        setShowConfetti(true);
        playTickSound(true);
        fireCelebrationConfetti();
      }
    };

    animFrameRef.current = requestAnimationFrame(animateSpin);
  };

  const handleExcludeWinner = () => {
    if (winner) {
      setExcludedNis(prev => [...prev, winner.nis]);
      setWinner(null);
      setShowConfetti(false);
    }
  };

  const handleResetExcluded = () => {
    setExcludedNis([]);
    setWinner(null);
    setShowConfetti(false);
  };

  // Freeze background screen when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      document.body.style.userSelect = 'none';
    } else {
      document.body.style.overflow = '';
      document.body.style.userSelect = '';
    }
    return () => {
      document.body.style.overflow = '';
      document.body.style.userSelect = '';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div 
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
      className="fixed inset-0 z-[9999] flex items-center justify-center p-2 sm:p-3 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200 pointer-events-auto overscroll-none"
    >
      <div className="bg-white rounded-2xl sm:rounded-3xl shadow-2xl border border-slate-100 max-w-md sm:max-w-lg md:max-w-2xl lg:max-w-3xl xl:max-w-4xl w-full max-h-[98vh] sm:max-h-[95vh] relative flex flex-col my-auto transition-all overflow-hidden select-text z-10">
        
        {/* Header */}
        <div className="bg-linear-to-r from-amber-500 via-orange-500 to-amber-600 px-3 py-2 sm:px-4 sm:py-2.5 lg:px-5 lg:py-3 text-white relative shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 sm:w-8 sm:h-8 lg:w-9 lg:h-9 rounded-lg bg-white/20 backdrop-blur-md flex items-center justify-center border border-white/30 shadow-inner shrink-0">
                <Dices className="w-3.5 h-3.5 sm:w-4 sm:h-4 lg:w-5 lg:h-5 text-white animate-bounce" />
              </div>
              <div>
                <h3 className="text-xs sm:text-sm lg:text-base font-black tracking-tight text-white flex items-center gap-1.5">
                  Spin Siswa Maju
                  <Sparkles className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-amber-200 fill-amber-200" />
                </h3>
                <p className="text-[10px] sm:text-[11px] lg:text-xs text-amber-100 font-semibold flex items-center gap-1 mt-0.5">
                  <GraduationCap className="w-3 h-3" />
                  {classNameText} • {availableStudents.length} siswa siap
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setSoundEnabled(!soundEnabled)}
                className="p-1 sm:p-1.5 rounded-lg bg-white/10 hover:bg-white/20 active:scale-95 text-white transition cursor-pointer min-w-[30px] min-h-[30px] sm:min-w-[34px] sm:min-h-[34px] flex items-center justify-center"
                title={soundEnabled ? "Matikan Suara" : "Aktifkan Suara"}
              >
                {soundEnabled ? <Volume2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> : <VolumeX className="w-3.5 h-3.5 sm:w-4 sm:h-4" />}
              </button>

              <button
                onClick={handleClose}
                className="p-1 sm:p-1.5 rounded-lg bg-white/10 hover:bg-white/20 active:scale-95 text-white transition cursor-pointer min-w-[30px] min-h-[30px] sm:min-w-[34px] sm:min-h-[34px] flex items-center justify-center"
              >
                <X className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="p-2.5 sm:p-3.5 md:p-4 flex-1 min-h-0 flex flex-col justify-between gap-2 sm:gap-3 overflow-hidden">

          {/* If no students */}
          {students.length === 0 ? (
            <div className="text-center py-6 sm:py-8 text-slate-500 space-y-2">
              <Users className="w-8 h-8 sm:w-10 sm:h-10 text-slate-300 mx-auto" />
              <p className="text-xs sm:text-sm font-semibold">Tidak ada data siswa di {classNameText}.</p>
              <p className="text-[10px] sm:text-xs text-slate-400">Silakan pilih kelas lain atau tambahkan data siswa terlebih dahulu.</p>
            </div>
          ) : availableStudents.length === 0 ? (
            <div className="text-center py-5 sm:py-6 space-y-2 bg-amber-50/50 rounded-xl border border-amber-100 p-3 sm:p-4">
              <CheckCircle2 className="w-8 h-8 sm:w-10 sm:h-10 text-amber-500 mx-auto" />
              <p className="text-xs sm:text-base font-bold text-amber-900">Semua siswa di {classNameText} sudah ditandai maju!</p>
              <button
                onClick={handleResetExcluded}
                className="px-3.5 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold transition shadow-md shadow-amber-200 cursor-pointer inline-flex items-center gap-1.5 active:scale-95 min-h-[36px]"
              >
                <RotateCw className="w-3.5 h-3.5" />
                Reset & Putar Lagi Dari Awal
              </button>
            </div>
          ) : (
            <>
              {/* Display Box / Wheel Spinner */}
              <div className="relative bg-slate-900 rounded-xl sm:rounded-2xl p-2.5 sm:p-4 border-2 sm:border-3 border-amber-400/40 shadow-lg shadow-amber-500/10 flex-1 min-h-0 flex flex-col items-center justify-center overflow-hidden">
                {/* Background glow effects */}
                <div className="absolute inset-0 bg-radial from-amber-500/30 via-transparent to-transparent opacity-90 pointer-events-none" />

                {/* Confetti Animation when Winner is Selected */}
                {showConfetti && (
                  <div className="absolute inset-0 pointer-events-none flex items-center justify-center overflow-hidden z-10">
                    {Array.from({ length: 30 }).map((_, i) => (
                      <motion.div
                        key={i}
                        initial={{
                          x: 0,
                          y: 0,
                          scale: 0,
                          rotate: 0,
                          opacity: 1
                        }}
                        animate={{
                          x: (Math.random() - 0.5) * 500,
                          y: (Math.random() - 0.5) * 350,
                          scale: Math.random() * 1.1 + 0.6,
                          rotate: Math.random() * 360,
                          opacity: [1, 1, 0]
                        }}
                        transition={{ duration: 1.8, ease: 'easeOut' }}
                        className="absolute w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full"
                        style={{
                          backgroundColor: ['#f59e0b', '#ec4899', '#3b82f6', '#10b981', '#8b5cf6', '#f43f5e'][i % 6]
                        }}
                      />
                    ))}
                  </div>
                )}

                {/* Content inside Box */}
                <AnimatePresence mode="wait">
                  {winner ? (
                    <motion.div
                      key="winner"
                      initial={{ scale: 0.5, opacity: 0, y: 10 }}
                      animate={{ scale: 1, opacity: 1, y: 0 }}
                      exit={{ scale: 0.8, opacity: 0 }}
                      className="text-center relative z-20 space-y-1.5 sm:space-y-2 px-2"
                    >
                      <div className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-amber-400/20 text-amber-300 rounded-full text-[10px] sm:text-xs font-black uppercase tracking-wider border border-amber-400/50 shadow-inner">
                        <Trophy className="w-3 h-3 text-amber-400" />
                        Siswa Terpilih!
                      </div>
                      <h2 className="text-xl sm:text-3xl md:text-4xl lg:text-5xl font-black text-white tracking-tight leading-tight drop-shadow-lg max-w-full truncate px-1">
                        {winner.nama}
                      </h2>
                      <div className="flex items-center justify-center gap-2 text-[11px] sm:text-xs md:text-sm font-bold text-amber-200">
                        <span>NIS: {winner.nis || '-'}</span>
                        <span>•</span>
                        <span>{winner.jenisKelamin === 'L' ? 'Laki-laki' : 'Perempuan'}</span>
                      </div>
                    </motion.div>
                  ) : isSpinning ? (
                    <motion.div
                      key="spinning"
                      initial={{ opacity: 0.8 }}
                      animate={{ opacity: 1 }}
                      className="text-center relative z-20 space-y-1.5 sm:space-y-2 px-2"
                    >
                      <div className="text-[10px] sm:text-xs font-extrabold text-amber-400 uppercase tracking-widest animate-pulse flex items-center justify-center gap-1">
                        <Shuffle className="w-3 h-3 animate-spin" />
                        Mengacak Siswa...
                      </div>
                      <h3 className="text-xl sm:text-3xl md:text-4xl lg:text-5xl font-black text-amber-100 tracking-tight transition-all drop-shadow-md max-w-full truncate px-1">
                        {availableStudents[currentIndex]?.nama || '...'}
                      </h3>
                      <p className="text-[10px] sm:text-xs font-semibold text-slate-400">
                        {availableStudents[currentIndex]?.nis ? `NIS: ${availableStudents[currentIndex].nis}` : ''}
                      </p>
                    </motion.div>
                  ) : (
                    <motion.div
                      key="idle"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="text-center relative z-20 space-y-1.5 sm:space-y-2 px-2"
                    >
                      <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mx-auto text-amber-400">
                        <Dices className="w-5 h-5 sm:w-6 sm:h-6" />
                      </div>
                      <p className="text-sm sm:text-lg md:text-xl font-bold text-slate-200">
                        Siap Memutar Nama Siswa
                      </p>
                      <p className="text-[11px] sm:text-xs text-slate-400">
                        Klik tombol di bawah untuk memilih siswa secara acak
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Action Buttons */}
              <div className="space-y-1.5 sm:space-y-2 shrink-0">
                {winner ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 sm:gap-2">
                    <button
                      onClick={handleStartSpin}
                      className="w-full min-h-[38px] sm:min-h-[42px] py-2 bg-linear-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 active:scale-98 text-white font-black text-xs sm:text-sm rounded-xl shadow-md shadow-amber-500/20 transition cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      <RotateCw className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                      Putar Lagi
                    </button>

                    <button
                      onClick={handleExcludeWinner}
                      className="w-full min-h-[38px] sm:min-h-[42px] py-2 bg-slate-100 hover:bg-slate-200 active:scale-98 text-slate-700 font-black text-xs sm:text-sm rounded-xl border border-slate-200 transition cursor-pointer flex items-center justify-center gap-1.5"
                      title="Tandai siswa ini sudah dipanggil agar tidak terpilih lagi di sesi ini"
                    >
                      <UserCheck className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-600" />
                      Tandai Sudah Maju
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={handleStartSpin}
                    disabled={isSpinning}
                    className="w-full min-h-[38px] sm:min-h-[42px] py-2 sm:py-2.5 bg-linear-to-r from-amber-500 via-orange-500 to-amber-600 hover:from-amber-600 hover:to-orange-600 active:scale-98 text-white font-black text-xs sm:text-sm md:text-base rounded-xl shadow-md shadow-amber-500/25 transition cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    <Dices className={`w-4 h-4 sm:w-5 sm:h-5 ${isSpinning ? 'animate-spin' : ''}`} />
                    <span>{isSpinning ? 'Sedang Memutar (5 Detik)...' : 'Acak / Spin Nama Siswa'}</span>
                  </button>
                )}

                {/* Marked Students List / Chips */}
                {excludedNis.length > 0 && (
                  <div className="bg-slate-50 rounded-xl p-1.5 sm:p-2 border border-slate-200/80 space-y-1">
                    <div className="flex items-center justify-between text-[11px] sm:text-xs text-slate-600 font-bold">
                      <span className="flex items-center gap-1 text-slate-700">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                        Sudah Dipanggil ({excludedNis.length}):
                      </span>
                      <button
                        onClick={handleResetExcluded}
                        className="text-amber-600 hover:text-amber-700 font-extrabold underline cursor-pointer flex items-center gap-0.5 text-[10px] sm:text-[11px]"
                      >
                        <RotateCw className="w-2.5 h-2.5" />
                        Reset
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-1 max-h-12 sm:max-h-16 overflow-y-auto pt-0.5">
                      {excludedNis.map(nis => {
                        const st = students.find(s => s.nis === nis);
                        return st ? (
                          <span
                            key={nis}
                            className="inline-flex items-center gap-1 px-2 py-0.5 bg-white border border-slate-200 text-slate-700 rounded-md text-[11px] font-semibold shadow-2xs"
                          >
                            <span>{st.nama}</span>
                            <button
                              onClick={() => setExcludedNis(prev => prev.filter(id => id !== nis))}
                              className="text-slate-400 hover:text-rose-500 p-0.5 rounded-full cursor-pointer ml-0.5"
                              title="Kembalikan ke antrean spin"
                            >
                              <X className="w-2.5 h-2.5" />
                            </button>
                          </span>
                        ) : null;
                      })}
                    </div>
                  </div>
                )}

                {/* Footer Status */}
                <div className="flex items-center justify-between text-[10px] sm:text-[11px] text-slate-500 pt-1 border-t border-slate-100">
                  <span className="font-semibold">
                    Tersedia: <strong className="text-slate-800">{availableStudents.length}</strong> dari {students.length} siswa
                  </span>
                  <span className="text-slate-400">
                    Durasi: 5 Detik
                  </span>
                </div>
              </div>
            </>
          )}

        </div>
      </div>
    </div>
  );
}
