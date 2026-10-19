import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Student, AttendanceRecord, AttendanceDateNote, ClassSchedule } from '../types';
import { useLazyList } from '../hooks/useLazyList';
import { isClassScheduledOnDate, getDayOfWeekFromDate, getClassScheduleForDate } from '../utils/scheduleHelper';
import { 
  Check, Clock, Calendar, Search, AlertCircle, Save, Loader2, 
  ChevronLeft, ChevronRight, Info, Bell, AlertTriangle, Trash2, 
  CheckCircle2, Zap, ChevronDown, ChevronUp, Tag, CalendarOff, Edit3, X,
  UserX, ShieldAlert, Sparkles, Filter, ExternalLink, CalendarCheck
} from 'lucide-react';

interface AttendanceTabProps {
  students: Student[];
  attendance: AttendanceRecord[];
  dateNotes?: AttendanceDateNote[];
  classSchedule?: ClassSchedule;
  className?: string;
  onSave: (records: AttendanceRecord[]) => Promise<void>;
  onDelete?: (date: string) => Promise<void>;
  onSaveDateNote?: (note: AttendanceDateNote) => Promise<void>;
  onDeleteDateNote?: (date: string) => Promise<void>;
  isBackgroundSyncing?: boolean;
}

export default function AttendanceTab({ 
  students, 
  attendance, 
  dateNotes = [],
  classSchedule,
  className = '',
  onSave, 
  onDelete, 
  onSaveDateNote, 
  onDeleteDateNote,
  isBackgroundSyncing = false 
}: AttendanceTabProps) {
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [localRecords, setLocalRecords] = useState<AttendanceRecord[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  const [showOutOfScheduleConfirm, setShowOutOfScheduleConfirm] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [isTopPanelCollapsed, setIsTopPanelCollapsed] = useState(false);
  const [isAtRiskExpanded, setIsAtRiskExpanded] = useState(false);

  // Quick Action Feedback State
  const [bulkToast, setBulkToast] = useState<string | null>(null);

  // Student Detail Modal for At-Risk Early Warning
  const [selectedAtRiskStudent, setSelectedAtRiskStudent] = useState<{
    student: Student;
    alfaCount: number;
    hadirCount: number;
    sakitCount: number;
    izinCount: number;
    totalDays: number;
    attendancePct: number;
    alfaDates: string[];
    history: AttendanceRecord[];
  } | null>(null);

  // Date Note Marking States
  const [isMarkModalOpen, setIsMarkModalOpen] = useState(false);
  const [markModalReason, setMarkModalReason] = useState('');
  const [isSavingDateNote, setIsSavingDateNote] = useState(false);
  const [showConfirmDeleteDateNote, setShowConfirmDeleteDateNote] = useState(false);

  const lastSelectedDateRef = useRef(selectedDate);
  const isDirtyRef = useRef(false);

  const [viewYear, setViewYear] = useState(() => {
    const d = new Date(selectedDate);
    return isNaN(d.getTime()) ? new Date().getFullYear() : d.getFullYear();
  });
  const [viewMonth, setViewMonth] = useState(() => {
    const d = new Date(selectedDate);
    return isNaN(d.getTime()) ? new Date().getMonth() : d.getMonth();
  });

  const monthNames = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
  ];

  const handlePrevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear(prev => prev - 1);
    } else {
      setViewMonth(prev => prev - 1);
    }
  };

  const handleNextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear(prev => prev + 1);
    } else {
      setViewMonth(prev => prev + 1);
    }
  };

  const totalDays = new Date(viewYear, viewMonth + 1, 0).getDate();
  const firstDayOfWeekIndex = (new Date(viewYear, viewMonth, 1).getDay() + 6) % 7;

  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDayOfWeekIndex; i++) {
    cells.push(null);
  }
  for (let d = 1; d <= totalDays; d++) {
    cells.push(d);
  }

  const getFormattedDateString = (year: number, month: number, day: number) => {
    const mm = String(month + 1).padStart(2, '0');
    const dd = String(day).padStart(2, '0');
    return `${year}-${mm}-${dd}`;
  };

  const recordedDates = useMemo(() => {
    const dates = new Set<string>();
    const studentNises = new Set(students.map(s => s.nis));
    attendance.forEach(r => {
      if (r.tanggal && studentNises.has(r.nis)) {
        dates.add(r.tanggal);
      }
    });
    return dates;
  }, [attendance, students]);

  const dateNotesMap = useMemo(() => {
    const map = new Map<string, string>();
    dateNotes.forEach(n => {
      if (n.tanggal && n.alasan) {
        map.set(n.tanggal, n.alasan);
      }
    });
    return map;
  }, [dateNotes]);

  const currentDateNote = useMemo(() => {
    return dateNotes.find(n => n.tanggal === selectedDate);
  }, [dateNotes, selectedDate]);

  const handleSaveMarkModal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!markModalReason.trim()) return;
    setIsSavingDateNote(true);
    try {
      if (onSaveDateNote) {
        await onSaveDateNote({
          tanggal: selectedDate,
          kelas: '',
          alasan: markModalReason.trim()
        });
      }
      setIsMarkModalOpen(false);
    } catch (err) {
      console.error('Gagal menyimpan penanda tanggal:', err);
    } finally {
      setIsSavingDateNote(false);
    }
  };

  const handleDeleteDateNoteConfirm = async () => {
    setIsSavingDateNote(true);
    try {
      if (onDeleteDateNote) {
        await onDeleteDateNote(selectedDate);
      }
      setIsMarkModalOpen(false);
    } catch (err) {
      console.error('Gagal menghapus penanda tanggal:', err);
    } finally {
      setIsSavingDateNote(false);
    }
  };

  const hasAttendanceToday = useMemo(() => {
    const studentNises = new Set(students.map(s => s.nis));
    return attendance.some(r => r.tanggal === selectedDate && studentNises.has(r.nis));
  }, [attendance, selectedDate, students]);

  // Menghitung siswa berisiko (Early Warning: Alfa >= 3 kali ATAU Kehadiran < 80%)
  const studentsAtRisk = useMemo(() => {
    const data: Record<string, { 
      student: Student; 
      hadir: number;
      sakit: number;
      izin: number;
      alfa: number;
      alfaDates: string[];
      history: AttendanceRecord[];
    }> = {};
    
    // Inisialisasi daftar siswa di kelas ini
    students.forEach(s => {
      data[s.nis] = { 
        student: s, 
        hadir: 0, 
        sakit: 0, 
        izin: 0, 
        alfa: 0, 
        alfaDates: [], 
        history: [] 
      };
    });

    // Kumpulkan dari riwayat absensi yang tersimpan (kecuali tanggal yang sedang diubah)
    attendance.forEach(record => {
      if (record.tanggal !== selectedDate && data[record.nis]) {
        data[record.nis].history.push(record);
        if (record.status === 'Hadir') data[record.nis].hadir++;
        else if (record.status === 'Sakit') data[record.nis].sakit++;
        else if (record.status === 'Izin') data[record.nis].izin++;
        else if (record.status === 'Alfa') {
          data[record.nis].alfa++;
          data[record.nis].alfaDates.push(record.tanggal);
        }
      }
    });

    // Masukkan status terkini dari formulir pengisian lokal harian
    localRecords.forEach(record => {
      if (data[record.nis]) {
        data[record.nis].history.push(record);
        if (record.status === 'Hadir') data[record.nis].hadir++;
        else if (record.status === 'Sakit') data[record.nis].sakit++;
        else if (record.status === 'Izin') data[record.nis].izin++;
        else if (record.status === 'Alfa') {
          data[record.nis].alfa++;
          if (!data[record.nis].alfaDates.includes(record.tanggal)) {
            data[record.nis].alfaDates.push(record.tanggal);
          }
        }
      }
    });

    // Filter siswa yang memiliki Alfa >= 3 ATAU Kehadiran < 80% (jika ada data absensi tercatat)
    return Object.values(data)
      .map(item => {
        const hadir = Number(item.hadir) || 0;
        const sakit = Number(item.sakit) || 0;
        const izin = Number(item.izin) || 0;
        const alfa = Number(item.alfa) || 0;
        const total = hadir + sakit + izin + alfa;
        const rawPct = total > 0 ? (hadir / total) * 100 : 100;
        const pct = isNaN(rawPct) ? 100 : rawPct;
        const hasExcessiveAlfa = alfa >= 3;
        const hasLowAttendance = total >= 3 && pct < 80;
        const isAtRisk = hasExcessiveAlfa || hasLowAttendance;

        return {
          student: item.student,
          alfaCount: alfa,
          hadirCount: hadir,
          sakitCount: sakit,
          izinCount: izin,
          totalDays: total,
          attendancePct: Math.round(pct) || 0,
          alfaDates: item.alfaDates.sort(),
          history: item.history,
          hasExcessiveAlfa,
          hasLowAttendance,
          isAtRisk
        };
      })
      .filter(item => item.isAtRisk)
      .sort((a, b) => b.alfaCount - a.alfaCount || a.attendancePct - b.attendancePct);
  }, [students, attendance, localRecords, selectedDate]);

  // Lookup map for fast student at risk access in row badges
  const studentsAtRiskMap = useMemo(() => {
    const map = new Map<string, typeof studentsAtRisk[0]>();
    studentsAtRisk.forEach(item => {
      map.set(item.student.nis, item);
    });
    return map;
  }, [studentsAtRisk]);

  // Sync view when selectedDate changes
  useEffect(() => {
    const d = new Date(selectedDate);
    if (!isNaN(d.getTime())) {
      setViewYear(d.getFullYear());
      setViewMonth(d.getMonth());
    }
  }, [selectedDate]);

  // Load records for the selected date, or initialize if empty
  useEffect(() => {
    // If the selected date changed, we always reset the dirty flag to load the new date's records
    if (lastSelectedDateRef.current !== selectedDate) {
      isDirtyRef.current = false;
      lastSelectedDateRef.current = selectedDate;
    }

    // If local records have unsaved edits (dirty) and this effect was triggered by an external prop update,
    // DO NOT overwrite active inputs
    if (isDirtyRef.current) {
      console.log('[AttendanceTab] Unsaved edits detected. Preserving local records.');
      return;
    }

    const existingRecords = attendance.filter(r => r.tanggal === selectedDate);
    
    const initialized = students.map(student => {
      const match = existingRecords.find(r => r.nis === student.nis);
      if (match) return { ...match };
      
      // Default initial record
      return {
        tanggal: selectedDate,
        nis: student.nis,
        nama: student.nama,
        status: 'Hadir' as const,
        terlambat: 0,
        keterangan: '',
      };
    });
    
    setLocalRecords(initialized);
    setSaveStatus('idle');
  }, [selectedDate, students, attendance]);

  const handleStatusChange = (nis: string, status: 'Hadir' | 'Sakit' | 'Izin' | 'Alfa') => {
    isDirtyRef.current = true;
    setLocalRecords(prev =>
      prev.map(r => (r.nis === nis ? { ...r, status } : r))
    );
  };

  const handleBulkStatusChange = (status: 'Hadir' | 'Sakit' | 'Izin' | 'Alfa') => {
    isDirtyRef.current = true;
    setLocalRecords(prev =>
      prev.map(r => ({
        ...r,
        status,
        terlambat: status === 'Hadir' ? r.terlambat : 0
      }))
    );
    if (status === 'Hadir') {
      setBulkToast(`Seluruh siswa (${localRecords.length} orang) telah diatur menjadi "Hadir".`);
      setTimeout(() => setBulkToast(null), 3500);
    }
  };

  const handleLatenessChange = (nis: string, value: string) => {
    const parsed = parseInt(value, 10);
    const minutes = isNaN(parsed) || parsed < 0 ? 0 : parsed;
    isDirtyRef.current = true;
    setLocalRecords(prev =>
      prev.map(r => (r.nis === nis ? { ...r, terlambat: minutes } : r))
    );
  };

  const handleRemarkChange = (nis: string, remark: string) => {
    isDirtyRef.current = true;
    setLocalRecords(prev =>
      prev.map(r => (r.nis === nis ? { ...r, keterangan: remark } : r))
    );
  };

  const executeSave = async () => {
    setIsSaving(true);
    setSaveStatus('idle');
    try {
      await onSave(localRecords);
      isDirtyRef.current = false; // Reset dirty flag after successful save
      setSaveStatus('success');
      setTimeout(() => setSaveStatus('idle'), 3000);
    } catch (err) {
      console.error(err);
      setSaveStatus('error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSave = async () => {
    // Jika tanggal ini bukan jadwal belajar resmi dan jadwal kelas telah dikonfigurasi, minta konfirmasi
    if (!isSelectedDateScheduled && effectiveScheduledDays.length > 0) {
      setShowOutOfScheduleConfirm(true);
      return;
    }
    await executeSave();
  };

  const filteredRecords = localRecords.filter(
    r =>
      r.nama.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.nis.includes(searchQuery)
  );

  // Lazy loading hook for high performance rendering of large attendance rosters
  const { 
    visibleItems: visibleRecords, 
    visibleCount, 
    totalCount: totalRecordsCount, 
    hasMore: hasMoreRecords, 
    loadAll: loadAllRecords, 
    sentinelRef: attendanceSentinelRef 
  } = useLazyList(filteredRecords, { initialCount: 40, batchSize: 40 });

  // Stats for the day
  const total = localRecords.length || 0;
  const present = localRecords.filter(r => r.status === 'Hadir').length || 0;
  const sick = localRecords.filter(r => r.status === 'Sakit').length || 0;
  const excused = localRecords.filter(r => r.status === 'Izin').length || 0;
  const absent = localRecords.filter(r => r.status === 'Alfa').length || 0;
  const lateCount = localRecords.filter(r => r.status === 'Hadir' && (Number(r.terlambat) || 0) > 0).length || 0;

  const todayDateStr = new Date().toISOString().split('T')[0];

  const resolvedSelectedSchedule = useMemo(() => {
    return getClassScheduleForDate(classSchedule, selectedDate);
  }, [classSchedule, selectedDate]);

  const resolvedTodaySchedule = useMemo(() => {
    return getClassScheduleForDate(classSchedule, todayDateStr);
  }, [classSchedule, todayDateStr]);

  const effectiveScheduledDays = useMemo(() => {
    if (resolvedSelectedSchedule?.hari && resolvedSelectedSchedule.hari.length > 0) {
      return resolvedSelectedSchedule.hari;
    }
    return classSchedule?.hari || [];
  }, [resolvedSelectedSchedule, classSchedule]);

  const isSelectedDateScheduled = useMemo(() => {
    return isClassScheduledOnDate(classSchedule, selectedDate);
  }, [classSchedule, selectedDate]);

  const isTodayScheduled = useMemo(() => {
    return isClassScheduledOnDate(classSchedule, todayDateStr);
  }, [classSchedule, todayDateStr]);

  const isTodayAttendanceFilled = useMemo(() => {
    const studentNises = new Set(students.map(s => s.nis));
    return attendance.some(r => r.tanggal === todayDateStr && studentNises.has(r.nis));
  }, [attendance, todayDateStr, students]);

  return (
    <div id="attendance-section" className="space-y-6">
      {/* Pengingat Jadwal Belajar Hari Ini */}
      {isTodayScheduled && !isTodayAttendanceFilled && (
        <div className="bg-linear-to-r from-indigo-900 via-blue-900 to-indigo-950 text-white rounded-2xl p-4 sm:p-5 shadow-lg border border-indigo-700/60 relative overflow-hidden animate-in fade-in slide-in-from-top-2 duration-300">
          <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-blue-400/20 via-transparent to-transparent pointer-events-none" />
          <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3.5">
            <div className="flex items-start gap-3">
              <div className="p-2.5 bg-blue-500/30 border border-blue-400/40 rounded-xl shrink-0 text-blue-200">
                <Bell className="w-5 h-5 animate-bounce" />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[10px] font-black uppercase tracking-wider bg-blue-500/40 border border-blue-300/40 text-blue-100 px-2.5 py-0.5 rounded-full">
                    Pengingat Jadwal Belajar Hari Ini
                  </span>
                  <span className="text-xs font-bold text-blue-200">
                    {className ? `Kelas ${className}` : ''}
                  </span>
                  {resolvedTodaySchedule?.isVersioned && (
                    <span className="text-[10px] font-bold bg-blue-400/30 text-blue-100 px-2 py-0.5 rounded-md border border-blue-300/30">
                      {resolvedTodaySchedule.versionName}
                    </span>
                  )}
                </div>
                <h4 className="text-sm sm:text-base font-black text-white">
                  Hari ini ({getDayOfWeekFromDate(todayDateStr)}) ada jadwal pelajaran untuk kelas ini!
                </h4>
                <p className="text-xs text-blue-200/90 leading-relaxed max-w-2xl">
                  {resolvedTodaySchedule?.jamPelajaran ? `Waktu: ${resolvedTodaySchedule.jamPelajaran}. ` : (classSchedule?.jamPelajaran ? `Waktu: ${classSchedule.jamPelajaran}. ` : '')}
                  {resolvedTodaySchedule?.ruang ? `Ruang: ${resolvedTodaySchedule.ruang}. ` : (classSchedule?.ruang ? `Ruang: ${classSchedule.ruang}. ` : '')}
                  Jangan lupa mengisi dan menyimpan data absensi kehadiran siswa hari ini.
                </p>
              </div>
            </div>

            {selectedDate !== todayDateStr && (
              <button
                type="button"
                onClick={() => setSelectedDate(todayDateStr)}
                className="px-4 py-2 bg-white text-indigo-900 hover:bg-blue-50 font-black text-xs rounded-xl transition cursor-pointer shadow-md shrink-0 flex items-center gap-1.5 self-end sm:self-center"
              >
                <CalendarCheck className="w-4 h-4 text-indigo-600" />
                <span>Isi Absen Hari Ini</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Auto-Sync status info banner */}
      <div className="bg-amber-50 border border-amber-200/80 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-amber-800 text-xs sm:text-sm animate-in fade-in duration-200">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-amber-100 text-amber-700 rounded-xl shrink-0">
            <Clock className="w-4 h-4 animate-pulse" />
          </div>
          <div>
            <p className="font-semibold text-slate-800 text-sm">
              Sinkronisasi Otomatis Ditangguhkan Sementara
            </p>
            <p className="text-amber-700 text-xs mt-0.5 leading-relaxed">
              Selama Anda berada di halaman Absensi Harian, sinkronisasi otomatis dinonaktifkan agar pengisian tidak terganggu. Tekan tombol <strong className="font-bold">"Simpan & Sinkronkan"</strong> di bawah untuk memperbarui database Firebase Firestore secara permanen.
            </p>
          </div>
        </div>
        <div className="px-3 py-1.5 bg-amber-100 border border-amber-200 text-amber-800 rounded-lg font-black shrink-0 uppercase tracking-wider text-[10px] text-center self-start sm:self-center">
          Mode Edit Lokal
        </div>
      </div>

      {/* Peringatan Dini Siswa Berisiko (Alfa >= 3 atau Kehadiran < 80%) */}
      {studentsAtRisk.length > 0 && (
        <div className="bg-linear-to-br from-rose-50 to-orange-50/50 border border-rose-200/80 rounded-2xl shadow-xs overflow-hidden transition-all duration-300 animate-in fade-in slide-in-from-top-2">
          {/* Header Bar - Klik untuk Buka / Tutup */}
          <div 
            onClick={() => setIsAtRiskExpanded(!isAtRiskExpanded)}
            className="p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer hover:bg-rose-100/40 transition select-none"
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                setIsAtRiskExpanded(!isAtRiskExpanded);
              }
            }}
            aria-expanded={isAtRiskExpanded}
          >
            <div className="flex items-center gap-3">
              <div className="p-2 bg-rose-600 text-white rounded-xl shrink-0 shadow-xs shadow-rose-300">
                <ShieldAlert className="w-5 h-5 animate-pulse" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h4 className="text-xs sm:text-sm font-black text-rose-950">
                    Peringatan Dini Absensi (Siswa Berisiko)
                  </h4>
                  <span className="bg-rose-600 text-white text-[10px] font-black px-2 py-0.5 rounded-full shadow-2xs">
                    {studentsAtRisk.length} Siswa
                  </span>
                  {!isAtRiskExpanded && (
                    <span className="text-[10px] font-bold text-rose-700/90 bg-rose-200/60 px-2 py-0.5 rounded-md hidden md:inline-block">
                      Alfa ≥ 3x atau Hadir &lt; 80%
                    </span>
                  )}
                </div>
                <p className="text-[11px] sm:text-xs text-rose-800/80 mt-0.5">
                  {isAtRiskExpanded 
                    ? 'Klik untuk menyembunyikan rincian siswa berisiko.' 
                    : 'Terdeteksi siswa yang membutuhkan perhatian absensi. Klik tombol untuk membuka rincian.'}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setIsAtRiskExpanded(!isAtRiskExpanded);
              }}
              className="px-3 py-1.5 bg-white hover:bg-rose-50 text-rose-700 border border-rose-300/80 rounded-xl text-xs font-black transition cursor-pointer shadow-2xs shrink-0 flex items-center gap-1.5 self-end sm:self-center"
            >
              <span>{isAtRiskExpanded ? 'Sembunyikan' : 'Buka Peringatan'}</span>
              {isAtRiskExpanded ? (
                <ChevronUp className="w-4 h-4 text-rose-600" />
              ) : (
                <ChevronDown className="w-4 h-4 text-rose-600" />
              )}
            </button>
          </div>

          {/* Konten Terbuka (Expanded) */}
          {isAtRiskExpanded && (
            <div className="p-4 sm:p-5 pt-1 sm:pt-1 space-y-4 border-t border-rose-200/50 mt-1 animate-in fade-in duration-200">
              <p className="text-rose-800/90 text-xs leading-relaxed max-w-3xl pt-2">
                Siswa di bawah terdeteksi memiliki <strong className="font-extrabold text-rose-950">Alfa ≥ 3 kali</strong> atau <strong className="font-extrabold text-rose-950">Persentase Kehadiran &lt; 80%</strong>. Klik tombol detail pada kartu untuk melihat seluruh riwayat absensi atau mempersiapkan catatan pembinaan.
              </p>

              {/* Grid of at-risk student cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {studentsAtRisk.map(item => {
                  const isUrgent = item.alfaCount >= 3;
                  return (
                    <div 
                      key={item.student.nis} 
                      className={`bg-white border rounded-2xl p-4 flex flex-col justify-between hover:shadow-md transition duration-200 ${
                        isUrgent ? 'border-rose-200/90 ring-1 ring-rose-200/50' : 'border-amber-200/90'
                      }`}
                    >
                      <div className="space-y-2.5">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <span className="font-black text-slate-800 text-xs sm:text-sm block truncate" title={item.student.nama}>
                              {item.student.nama}
                            </span>
                            <span className="text-[10px] text-slate-400 font-mono">NIS: {item.student.nis}</span>
                          </div>
                          <div className="flex flex-col items-end gap-1 shrink-0">
                            {item.hasExcessiveAlfa && (
                              <span className="bg-rose-100 border border-rose-200 text-rose-700 text-[10px] font-black px-2.5 py-0.5 rounded-full whitespace-nowrap shadow-2xs">
                                {item.alfaCount}x Alfa
                              </span>
                            )}
                            {item.hasLowAttendance && (
                              <span className="bg-amber-100 border border-amber-200 text-amber-800 text-[10px] font-black px-2.5 py-0.5 rounded-full whitespace-nowrap shadow-2xs">
                                {item.attendancePct}% Hadir
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Mini Attendance Breakdown Badges */}
                        <div className="grid grid-cols-4 gap-1 text-center bg-slate-50 p-1.5 rounded-xl border border-slate-100 text-[10px]">
                          <div>
                            <span className="text-slate-400 block text-[9px] font-bold">Hadir</span>
                            <span className="font-black text-emerald-700">{item.hadirCount}</span>
                          </div>
                          <div>
                            <span className="text-slate-400 block text-[9px] font-bold">Sakit</span>
                            <span className="font-black text-blue-700">{item.sakitCount}</span>
                          </div>
                          <div>
                            <span className="text-slate-400 block text-[9px] font-bold">Izin</span>
                            <span className="font-black text-amber-700">{item.izinCount}</span>
                          </div>
                          <div>
                            <span className="text-slate-400 block text-[9px] font-bold">Alfa</span>
                            <span className="font-black text-rose-700">{item.alfaCount}</span>
                          </div>
                        </div>
                      </div>
                      
                      {/* Action Bar */}
                      <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between gap-2">
                        <span className="text-[10px] font-bold text-slate-400">
                          Total {item.totalDays} Hari Absensi
                        </span>
                        <button
                          type="button"
                          onClick={() => setSelectedAtRiskStudent(item)}
                          className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200/80 rounded-lg text-[11px] font-extrabold transition cursor-pointer flex items-center gap-1 shadow-2xs"
                        >
                          <span>Lihat Riwayat</span>
                          <ChevronRight className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Date & Quick Stats Panel */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 bg-slate-50/80 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
              <Calendar className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Tanggal Presensi</span>
                {isSelectedDateScheduled ? (
                  <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 bg-blue-100 text-blue-800 border border-blue-200 rounded-md flex items-center gap-1">
                    <CalendarCheck className="w-3 h-3 text-blue-600" />
                    Jadwal Belajar
                    {resolvedSelectedSchedule?.isVersioned && resolvedSelectedSchedule.versionName && (
                      <span className="text-[9px] font-extrabold text-blue-700 bg-blue-200/60 px-1 py-0.2 rounded ml-0.5">
                        {resolvedSelectedSchedule.versionName}
                      </span>
                    )}
                  </span>
                ) : effectiveScheduledDays.length > 0 ? (
                  <span 
                    className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 bg-amber-100 text-amber-900 border border-amber-300 rounded-md flex items-center gap-1"
                    title={`Bukan jadwal belajar resmi ${className || ''}. Jadwal resmi tanggal ini: ${effectiveScheduledDays.join(', ')}`}
                  >
                    <AlertTriangle className="w-3 h-3 text-amber-700 shrink-0" />
                    Bukan Jadwal Belajar
                  </span>
                ) : null}
              </div>
              <span className="text-sm font-black text-slate-800">
                {new Date(selectedDate).toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => {
                setMarkModalReason(currentDateNote?.alasan || '');
                setIsMarkModalOpen(true);
              }}
              className={`px-3 py-1.5 font-extrabold text-xs rounded-xl transition cursor-pointer flex items-center gap-1.5 shadow-2xs ${
                currentDateNote
                  ? 'bg-amber-500 hover:bg-amber-600 text-white border border-amber-600'
                  : 'bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200'
              }`}
              title="Tandai tanggal ini kenapa tidak absen (Libur, Tanggal Merah, dsb.)"
            >
              <Tag className="w-3.5 h-3.5" />
              <span>{currentDateNote ? 'Edit Penanda' : 'Tandai Tidak Absen'}</span>
            </button>

            <div className="flex items-center gap-1.5 bg-white px-2.5 py-1 rounded-xl border border-slate-200 text-xs font-extrabold text-slate-700">
              <span className="text-emerald-600">Hadir: {present}</span>
              <span className="text-slate-300">•</span>
              <span className="text-blue-600">Sakit: {sick}</span>
              <span className="text-slate-300">•</span>
              <span className="text-amber-600">Izin: {excused}</span>
              <span className="text-slate-300">•</span>
              <span className="text-rose-600">Alfa: {absent}</span>
              {lateCount > 0 && (
                <>
                  <span className="text-slate-300">•</span>
                  <span className="text-purple-600">Terlambat: {lateCount}</span>
                </>
              )}
            </div>

            <button
              type="button"
              onClick={() => setIsTopPanelCollapsed(prev => !prev)}
              className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-600 border border-slate-200 rounded-xl text-xs font-extrabold transition cursor-pointer flex items-center gap-1"
            >
              {isTopPanelCollapsed ? (
                <>
                  <span>Buka Kalender</span>
                  <ChevronDown className="w-3.5 h-3.5" />
                </>
              ) : (
                <>
                  <span>Sembunyikan Kalender</span>
                  <ChevronUp className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          </div>
        </div>

        {/* Banner Penanda Tanggal Tidak Absen (Warna Oranye) */}
        {currentDateNote && (
          <div className="mx-5 mt-5 bg-amber-500 border-2 border-amber-600 text-white rounded-2xl p-4 sm:p-5 shadow-sm space-y-2 animate-in fade-in duration-200">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="p-2.5 bg-amber-600/90 rounded-xl shrink-0 text-white shadow-xs">
                  <CalendarOff className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] font-black uppercase tracking-wider bg-amber-700/90 text-amber-100 px-2.5 py-0.5 rounded-md border border-amber-400/40">
                      Penanda Tanggal Tidak Absen
                    </span>
                    <span className="text-xs font-extrabold text-amber-100">
                      {new Date(selectedDate).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                    </span>
                  </div>
                  <p className="text-base sm:text-lg font-black mt-1 leading-snug drop-shadow-xs">
                    "{currentDateNote.alasan}"
                  </p>
                  <p className="text-xs text-amber-100/90 mt-0.5">
                    Catatan penanda warna oranye untuk mengingat alasan mengapa tidak ada absen pada tanggal ini.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                <button
                  type="button"
                  onClick={() => {
                    setMarkModalReason(currentDateNote.alasan);
                    setIsMarkModalOpen(true);
                  }}
                  className="px-3 py-1.5 bg-white/20 hover:bg-white/30 text-white font-extrabold text-xs rounded-xl backdrop-blur-xs transition flex items-center gap-1.5 cursor-pointer border border-white/30"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>Edit Alasan</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowConfirmDeleteDateNote(true)}
                  disabled={isSavingDateNote}
                  className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-xs rounded-xl transition flex items-center gap-1.5 cursor-pointer border border-rose-500 disabled:opacity-50"
                  title="Hapus Penanda Tanggal Ini"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Hapus Penanda</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {!isTopPanelCollapsed && (
          <div className="p-5 grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in fade-in duration-150">
            <div>
              <p className="text-xs text-slate-400 mb-3 leading-relaxed">
                Pilih tanggal pada kalender untuk mengisi atau melihat histori presensi.
              </p>

              {/* Elegant Mini Monthly Calendar */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                    Kalender Presensi
                  </span>
                  <div className="flex items-center gap-1 bg-slate-50 p-1 rounded-xl border border-slate-100">
                    <button
                      type="button"
                      onClick={handlePrevMonth}
                      className="p-1 hover:bg-white hover:shadow-xs rounded-lg text-slate-500 hover:text-slate-700 transition cursor-pointer flex items-center justify-center"
                      title="Bulan Sebelumnya"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" />
                    </button>
                    <span className="text-[11px] font-extrabold text-slate-700 min-w-24 text-center">
                      {monthNames[viewMonth]} {viewYear}
                    </span>
                    <button
                      type="button"
                      onClick={handleNextMonth}
                      className="p-1 hover:bg-white hover:shadow-xs rounded-lg text-slate-500 hover:text-slate-700 transition cursor-pointer flex items-center justify-center"
                      title="Bulan Berikutnya"
                    >
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Day of week headers */}
                <div className="grid grid-cols-7 gap-1 text-center mb-1.5">
                  {['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'].map(day => (
                    <span key={day} className="text-[10px] font-extrabold text-slate-400 uppercase tracking-tight">
                      {day}
                    </span>
                  ))}
                </div>

                {/* Days grid */}
                <div className="grid grid-cols-7 gap-1">
                  {cells.map((day, idx) => {
                    if (day === null) {
                      return <div key={`empty-${idx}`} className="h-7" />;
                    }

                    const dateStr = getFormattedDateString(viewYear, viewMonth, day);
                    const isSelected = dateStr === selectedDate;
                    const hasAttendance = recordedDates.has(dateStr);
                    const noteAlasan = dateNotesMap.get(dateStr);
                    const hasDateNote = Boolean(noteAlasan);

                    const semStart = classSchedule?.tanggalMulaiSemester;
                    const semEnd = classSchedule?.tanggalSelesaiSemester;
                    const isWithinSemester = (!semStart || dateStr >= semStart) && (!semEnd || dateStr <= semEnd);
                    const isDayScheduled = isWithinSemester && isClassScheduledOnDate(classSchedule, dateStr);
                    const schedOnDate = getClassScheduleForDate(classSchedule, dateStr);
                    const effectiveDaysOnDate = schedOnDate?.hari && schedOnDate.hari.length > 0 ? schedOnDate.hari : (classSchedule?.hari || []);
                    const isOutOfSchedule = !isDayScheduled && effectiveDaysOnDate.length > 0;

                    let buttonStyle = 'bg-slate-50 hover:bg-slate-100 text-slate-500 hover:text-slate-800 border border-transparent';
                    if (isSelected && hasDateNote) {
                      buttonStyle = 'bg-amber-500 text-white font-black shadow-md border-2 border-amber-300 ring-2 ring-amber-400';
                    } else if (isSelected) {
                      buttonStyle = 'bg-indigo-600 text-white shadow-xs font-bold';
                    } else if (hasDateNote) {
                      buttonStyle = 'bg-amber-500 text-white font-black border border-amber-600 hover:bg-amber-600 shadow-2xs';
                    } else if (hasAttendance) {
                      buttonStyle = isOutOfSchedule
                        ? 'bg-amber-100 text-amber-900 border border-amber-300 font-bold hover:bg-amber-200'
                        : 'bg-emerald-50 text-emerald-700 border border-emerald-150 font-bold hover:bg-emerald-100/80 hover:text-emerald-800';
                    } else if (isDayScheduled) {
                      buttonStyle = 'bg-blue-50/70 text-blue-800 border border-blue-200/80 font-bold hover:bg-blue-100/80';
                    }

                    return (
                      <button
                        key={`day-${day}`}
                        type="button"
                        onClick={() => setSelectedDate(dateStr)}
                        className={`h-7 text-xs font-semibold rounded-lg transition relative flex flex-col items-center justify-center cursor-pointer ${buttonStyle}`}
                        title={
                          hasDateNote
                            ? `Ditandai Tidak Absen: ${noteAlasan}`
                            : isSelected
                            ? `Terpilih: ${day} ${monthNames[viewMonth]}${isDayScheduled ? ' (Jadwal Pelajaran)' : isOutOfSchedule ? ' (Bukan Hari Jadwal)' : ''}`
                            : hasAttendance
                            ? isOutOfSchedule
                              ? `⚠️ Sudah Absen di Luar Hari Jadwal: ${day} ${monthNames[viewMonth]}`
                              : `Sudah Absen: ${day} ${monthNames[viewMonth]}${isDayScheduled ? ' (Jadwal Pelajaran)' : ''}`
                            : isDayScheduled
                            ? `Jadwal Belajar (Belum Absen): ${day} ${monthNames[viewMonth]}`
                            : `Belum Absen: ${day} ${monthNames[viewMonth]}`
                        }
                      >
                        <span>{day}</span>
                        {hasDateNote ? (
                          <span className="w-1.5 h-1.5 rounded-full absolute bottom-0.5 bg-amber-200 animate-pulse" />
                        ) : hasAttendance ? (
                          <span className={`w-1 h-1 rounded-full absolute bottom-1 ${
                            isSelected ? 'bg-emerald-400' : isOutOfSchedule ? 'bg-amber-600' : 'bg-emerald-500'
                          }`} />
                        ) : isDayScheduled ? (
                          <span className={`w-1 h-1 rounded-full absolute bottom-1 ${
                            isSelected ? 'bg-blue-300' : 'bg-blue-500'
                          }`} />
                        ) : null}
                      </button>
                    );
                  })}
                </div>

                {/* Legend & Today quick button */}
                <div className="mt-3 flex items-center justify-between text-[10px] text-slate-400 border-t border-slate-50 pt-2.5">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <span className="flex items-center gap-1 font-medium">
                      <span className="w-2.5 h-2.5 rounded-md bg-blue-100 border border-blue-300 inline-block shrink-0" />
                      Jadwal
                    </span>
                    <span className="flex items-center gap-1 font-medium">
                      <span className="w-2.5 h-2.5 rounded-md bg-emerald-50 border border-emerald-150 inline-block shrink-0" />
                      Sudah Absen
                    </span>
                    <span className="flex items-center gap-1 font-medium">
                      <span className="w-2.5 h-2.5 rounded-md bg-amber-100 border border-amber-300 inline-block shrink-0" />
                      Di Luar Jadwal
                    </span>
                    <span className="flex items-center gap-1 font-medium">
                      <span className="w-2.5 h-2.5 rounded-md bg-amber-500 border border-amber-600 inline-block shrink-0" />
                      Ditandai
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const todayStr = new Date().toISOString().split('T')[0];
                      setSelectedDate(todayStr);
                    }}
                    className="text-indigo-600 hover:text-indigo-700 font-bold hover:underline cursor-pointer ml-auto"
                  >
                    Hari Ini
                  </button>
                </div>
              </div>
            </div>

            <div className="col-span-1 lg:col-span-2 space-y-3">
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Ringkasan Detail Kehadiran Class
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                <div className="bg-emerald-50 p-3 rounded-xl border border-emerald-150 text-center">
                  <span className="block text-xl font-bold text-emerald-700">{present}</span>
                  <span className="text-[10px] font-semibold text-emerald-600">Hadir</span>
                </div>
                <div className="bg-blue-50 p-3 rounded-xl border border-blue-150 text-center">
                  <span className="block text-xl font-bold text-blue-700">{sick}</span>
                  <span className="text-[10px] font-semibold text-blue-600">Sakit</span>
                </div>
                <div className="bg-amber-50 p-3 rounded-xl border border-amber-150 text-center">
                  <span className="block text-xl font-bold text-amber-700">{excused}</span>
                  <span className="text-[10px] font-semibold text-amber-600">Izin</span>
                </div>
                <div className="bg-rose-50 p-3 rounded-xl border border-rose-150 text-center">
                  <span className="block text-xl font-bold text-rose-700">{absent}</span>
                  <span className="text-[10px] font-semibold text-rose-600">Alfa</span>
                </div>
                <div className="bg-slate-100 p-3 rounded-xl border border-slate-200 text-center col-span-2 sm:col-span-1">
                  <span className="block text-xl font-bold text-slate-700">{lateCount}</span>
                  <span className="text-[10px] font-semibold text-slate-600">Terlambat</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Banner Peringatan Absensi di Luar Jadwal */}
      {!isSelectedDateScheduled && Boolean(effectiveScheduledDays.length > 0) && hasAttendanceToday && (
        <div className="p-4 bg-amber-50 border border-amber-200/90 rounded-2xl flex items-center justify-between gap-3 flex-wrap shadow-2xs">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-100 text-amber-800 rounded-xl shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-black text-amber-900">
                Peringatan: Ada data absensi tercatat pada hari di luar jadwal pelajaran resmi {className || ''} (Jadwal resmi tanggal ini: {effectiveScheduledDays.join(', ')}).
              </p>
              <p className="text-[11px] text-amber-700 mt-0.5">
                Jika tanggal ini tercatat karena kekeliruan atau sisa data lama, Anda dapat menghapus data absensi tanggal ini secara permanen.
              </p>
            </div>
          </div>
          {onDelete && (
            <button
              type="button"
              onClick={() => setShowConfirmDelete(true)}
              disabled={isSaving || isDeleting}
              className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 disabled:bg-slate-300 text-white font-extrabold text-xs rounded-xl transition flex items-center gap-1.5 cursor-pointer shadow-xs ml-auto"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Hapus Absensi Tanggal Ini</span>
            </button>
          )}
        </div>
      )}

      {/* Roster Table Section */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden relative">
        {/* Progress Bar Sinkronisasi Latar Belakang */}
        {isBackgroundSyncing && (
          <div className="absolute top-0 left-0 right-0 h-1 bg-linear-to-r from-indigo-500 via-rose-500 to-indigo-500 animate-pulse z-30" />
        )}
        
        {/* Actions & Bulk Auto-Fill Header */}
        <div className="p-3.5 sm:p-4 border-b border-slate-200 flex flex-col lg:flex-row items-center justify-between gap-3 bg-slate-50/50">
          <div className="flex items-center gap-2.5 w-full lg:w-auto flex-1 flex-wrap sm:flex-nowrap">
            <div className="relative w-full sm:w-64">
              <input
                type="text"
                placeholder="Cari NIS atau Nama..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 font-medium"
              />
              <Search className="absolute left-2.5 top-2 text-slate-400 w-3.5 h-3.5" />
            </div>

            {/* Auto Fill Bulk Buttons */}
            <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
              <span className="text-[10px] font-extrabold uppercase text-slate-400 tracking-wider">Aksi Cepat:</span>
              <button
                type="button"
                onClick={() => handleBulkStatusChange('Hadir')}
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black transition cursor-pointer flex items-center gap-1.5 shadow-sm shadow-emerald-200 active:scale-95"
                title="Tandai seluruh siswa di kelas menjadi Hadir dalam 1 klik"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Tandai Semua Hadir</span>
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full lg:w-auto justify-between lg:justify-end flex-wrap">
            <div className="flex items-center gap-2 ml-auto">
              {isBackgroundSyncing && (
                <span className="text-xs text-indigo-600 font-bold flex items-center gap-1 bg-indigo-50 border border-indigo-100 px-2.5 py-1.5 rounded-xl animate-pulse">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Menyimpan...
                </span>
              )}
              {saveStatus === 'success' && !isBackgroundSyncing && (
                <span className="text-xs text-emerald-600 font-bold flex items-center gap-1">
                  <Check className="w-3.5 h-3.5" /> Tersimpan!
                </span>
              )}
              {saveStatus === 'error' && (
                <span className="text-xs text-rose-600 font-bold flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5" /> Gagal!
                </span>
              )}
              
              {hasAttendanceToday && onDelete && (
                <button
                  type="button"
                  onClick={() => setShowConfirmDelete(true)}
                  disabled={isSaving || isDeleting}
                  className="border border-rose-200 hover:bg-rose-50 text-rose-600 font-extrabold text-xs px-3 py-1.5 rounded-xl transition flex items-center gap-1.5 cursor-pointer disabled:opacity-55"
                  title="Hapus data absensi tanggal ini"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Hapus Absensi</span>
                </button>
              )}

              <button
                onClick={handleSave}
                disabled={isSaving || students.length === 0}
                className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 text-white font-extrabold text-xs px-4 py-2 rounded-xl transition flex items-center gap-1.5 cursor-pointer shadow-sm shadow-indigo-100"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Sinkronisasi...</span>
                  </>
                ) : (
                  <>
                    <Save className="w-3.5 h-3.5" />
                    <span>Simpan &amp; Sinkronkan</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Bulk Action Toast Alert */}
        {bulkToast && (
          <div className="px-4 py-2.5 bg-emerald-50 border-b border-emerald-150 flex items-center justify-between text-xs font-bold text-emerald-800 animate-in fade-in slide-in-from-top-1 duration-200">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{bulkToast}</span>
            </div>
            <button
              type="button"
              onClick={() => setBulkToast(null)}
              className="text-emerald-600 hover:text-emerald-800 p-1 rounded-md cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* List of students */}
        {students.length === 0 ? (
          <div className="p-12 text-center text-slate-500">
            <AlertCircle className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="font-bold text-slate-600">Belum ada siswa yang terdaftar.</p>
            <p className="text-xs text-slate-400 mt-1">Gunakan tab "Kelola Siswa" untuk menambahkan murid pertama.</p>
          </div>
        ) : filteredRecords.length === 0 ? (
          <div className="p-12 text-center text-slate-400 text-sm">
            Tidak ada siswa yang cocok dengan pencarian "{searchQuery}"
          </div>
        ) : (
          <div>
            {/* Mobile View: High-Density Compact Rows */}
            <div className="block md:hidden divide-y divide-slate-100 bg-slate-50/30">
              {visibleRecords.map((record, index) => {
                const studentInfo = students.find(s => s.nis === record.nis);
                const noAbsen = studentInfo?.noAbsen || (index + 1);
                
                let rowBg = "bg-white";
                if (record.status === 'Sakit') rowBg = "bg-blue-50/40";
                else if (record.status === 'Izin') rowBg = "bg-amber-50/40";
                else if (record.status === 'Alfa') rowBg = "bg-rose-50/40";

                return (
                  <div key={record.nis} className={`p-3 space-y-2.5 transition ${rowBg}`}>
                    {/* Header: No Absen, Name, Tag */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="w-6 h-6 bg-slate-100 border border-slate-200 text-slate-700 rounded-lg text-[10px] font-black font-mono flex items-center justify-center shrink-0">
                          {noAbsen}
                        </span>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-extrabold text-slate-800 text-xs block truncate">{record.nama}</span>
                            {(() => {
                              const riskData = studentsAtRiskMap.get(record.nis);
                              if (!riskData) return null;
                              return (
                                <button
                                  type="button"
                                  onClick={() => setSelectedAtRiskStudent(riskData)}
                                  className={`px-1.5 py-0.2 rounded-md text-[9px] font-black border uppercase tracking-wider shrink-0 cursor-pointer shadow-2xs transition active:scale-95 ${
                                    riskData.alfaCount >= 3 
                                      ? 'bg-rose-100 text-rose-700 border-rose-300 hover:bg-rose-200' 
                                      : 'bg-amber-100 text-amber-800 border-amber-300 hover:bg-amber-200'
                                  }`}
                                  title={`Peringatan: ${riskData.alfaCount}x Alfa, ${riskData.attendancePct}% Hadir. Klik untuk detail.`}
                                >
                                  ⚠️ {riskData.alfaCount >= 3 ? `${riskData.alfaCount}x Alfa` : `${riskData.attendancePct}%`}
                                </button>
                              );
                            })()}
                          </div>
                          <span className="font-mono text-[10px] text-slate-400 block">NIS: {record.nis}</span>
                        </div>
                      </div>

                      {studentInfo?.label && (
                        (() => {
                          let bgClass = "bg-slate-100 text-slate-700 border-slate-200";
                          if (studentInfo.label.toLowerCase().includes("ketua kelas")) bgClass = "bg-indigo-50 text-indigo-700 border-indigo-200";
                          else if (studentInfo.label.toLowerCase().includes("osis") || studentInfo.label.toLowerCase().includes("omp")) bgClass = "bg-emerald-50 text-emerald-700 border-emerald-200";
                          else if (studentInfo.label.toLowerCase().includes("bermasalah")) bgClass = "bg-rose-50 text-rose-700 border-rose-200";
                          const displayVal = studentInfo.label.toUpperCase() === 'OSIS' ? 'OMP' : studentInfo.label;
                          return (
                            <span className={`px-1.5 py-0.5 rounded-md text-[8px] font-black border uppercase tracking-wider shrink-0 ${bgClass}`}>
                              {displayVal}
                            </span>
                          );
                        })()
                      )}
                    </div>

                    {/* Compact 4-Button Segmented Selector */}
                    <div className="grid grid-cols-4 gap-1 bg-slate-200/70 p-1 rounded-xl border border-slate-200/80">
                      <button
                        type="button"
                        onClick={() => handleStatusChange(record.nis, 'Hadir')}
                        className={`py-1.5 text-xs font-black rounded-lg transition cursor-pointer text-center ${
                          record.status === 'Hadir'
                            ? 'bg-emerald-600 text-white shadow-2xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        Hadir
                      </button>
                      <button
                        type="button"
                        onClick={() => handleStatusChange(record.nis, 'Sakit')}
                        className={`py-1.5 text-xs font-black rounded-lg transition cursor-pointer text-center ${
                          record.status === 'Sakit'
                            ? 'bg-blue-600 text-white shadow-2xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        Sakit
                      </button>
                      <button
                        type="button"
                        onClick={() => handleStatusChange(record.nis, 'Izin')}
                        className={`py-1.5 text-xs font-black rounded-lg transition cursor-pointer text-center ${
                          record.status === 'Izin'
                            ? 'bg-amber-500 text-white shadow-2xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        Izin
                      </button>
                      <button
                        type="button"
                        onClick={() => handleStatusChange(record.nis, 'Alfa')}
                        className={`py-1.5 text-xs font-black rounded-lg transition cursor-pointer text-center ${
                          record.status === 'Alfa'
                            ? 'bg-rose-600 text-white shadow-2xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        Alfa
                      </button>
                    </div>

                    {/* Inputs */}
                    <div className="flex items-center gap-2">
                      {record.status === 'Hadir' && (
                        <div className="relative shrink-0 w-28">
                          <input
                            type="number"
                            min="0"
                            value={record.terlambat === null || record.terlambat === undefined || isNaN(Number(record.terlambat)) ? 0 : record.terlambat}
                            onChange={e => handleLatenessChange(record.nis, e.target.value)}
                            className={`w-full pl-2 pr-12 py-1 text-xs rounded-lg border font-mono font-bold ${
                              record.terlambat > 0
                                ? 'border-rose-300 text-rose-700 bg-rose-50'
                                : 'border-slate-200 text-slate-700'
                            }`}
                            placeholder="0"
                          />
                          <span className="absolute right-2 top-1 text-[10px] text-slate-400 font-bold select-none">min</span>
                        </div>
                      )}
                      <input
                        type="text"
                        value={record.keterangan}
                        onChange={e => handleRemarkChange(record.nis, e.target.value)}
                        placeholder="Keterangan / Alasan..."
                        className="w-full py-1 px-2.5 text-xs rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Desktop View: Ringkas High-Density Table */}
            <div className="hidden md:block overflow-x-auto max-h-[calc(100vh-210px)] min-h-[380px] overflow-y-auto custom-scrollbar">
              <table className="w-full min-w-[680px] text-left border-collapse">
                <thead className="sticky top-0 z-20 bg-slate-100 text-slate-700 font-black text-[11px] lg:text-xs uppercase tracking-wider shadow-2xs border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-3 lg:py-3 text-center w-12">No</th>
                    <th className="py-2.5 px-3 lg:py-3 min-w-56 max-w-72">Siswa &amp; NIS</th>
                    <th className="py-2.5 px-3 lg:py-3 text-center w-80">Status Kehadiran</th>
                    <th className="py-2.5 px-3 lg:py-3 text-center w-28">Terlambat</th>
                    <th className="py-2.5 px-3 lg:py-3">Keterangan / Alasan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs lg:text-sm">
                  {visibleRecords.map((record, idx) => {
                    const studentInfo = students.find(s => s.nis === record.nis);
                    const noAbsen = studentInfo?.noAbsen || (idx + 1);

                    let rowBg = "hover:bg-indigo-50/20";
                    if (record.status === 'Sakit') rowBg = "bg-blue-50/30 hover:bg-blue-50/50";
                    else if (record.status === 'Izin') rowBg = "bg-amber-50/30 hover:bg-amber-50/50";
                    else if (record.status === 'Alfa') rowBg = "bg-rose-50/30 hover:bg-rose-50/50";

                    return (
                      <tr key={record.nis} className={`transition ${rowBg}`}>
                        {/* No Absen */}
                        <td className="py-2 px-3 lg:py-2.5 text-center font-mono font-bold text-slate-500 text-xs lg:text-sm">
                          {noAbsen}
                        </td>

                        {/* Nama Siswa & NIS */}
                        <td className="py-2 px-3 lg:py-2.5">
                          <div className="flex items-center gap-2">
                            <span className="font-extrabold text-slate-800 text-xs lg:text-sm block truncate max-w-60" title={record.nama}>
                              {record.nama}
                            </span>
                            {(() => {
                              const riskData = studentsAtRiskMap.get(record.nis);
                              if (!riskData) return null;
                              return (
                                <button
                                  type="button"
                                  onClick={() => setSelectedAtRiskStudent(riskData)}
                                  className={`px-1.5 py-0.2 rounded-md text-[8px] lg:text-[10px] font-black border uppercase tracking-wider shrink-0 cursor-pointer shadow-2xs transition active:scale-95 ${
                                    riskData.alfaCount >= 3 
                                      ? 'bg-rose-100 text-rose-700 border-rose-300 hover:bg-rose-200' 
                                      : 'bg-amber-100 text-amber-800 border-amber-300 hover:bg-amber-200'
                                  }`}
                                  title={`Peringatan Berisiko: ${riskData.alfaCount}x Alfa, ${riskData.attendancePct}% Hadir. Klik untuk lihat riwayat.`}
                                >
                                  ⚠️ {riskData.alfaCount >= 3 ? `${riskData.alfaCount}x Alfa` : `${riskData.attendancePct}% Hadir`}
                                </button>
                              );
                            })()}
                            {studentInfo?.label && (
                              (() => {
                                let bgClass = "bg-slate-100 text-slate-700 border-slate-200";
                                if (studentInfo.label.toLowerCase().includes("ketua kelas")) bgClass = "bg-indigo-50 text-indigo-700 border-indigo-200";
                                else if (studentInfo.label.toLowerCase().includes("osis") || studentInfo.label.toLowerCase().includes("omp")) bgClass = "bg-emerald-50 text-emerald-700 border-emerald-200";
                                else if (studentInfo.label.toLowerCase().includes("bermasalah")) bgClass = "bg-rose-50 text-rose-700 border-rose-200";
                                const displayVal = studentInfo.label.toUpperCase() === 'OSIS' ? 'OMP' : studentInfo.label;
                                return (
                                  <span className={`px-1.5 py-0.2 rounded-md text-[8px] lg:text-[10px] font-black border uppercase tracking-wider shrink-0 ${bgClass}`}>
                                    {displayVal}
                                  </span>
                                );
                              })()
                            )}
                            <span className="font-mono text-[10px] lg:text-xs text-slate-400 shrink-0 ml-auto hidden lg:inline">
                              {record.nis}
                            </span>
                          </div>
                        </td>

                        {/* Compact Status Buttons */}
                        <td className="py-2 px-3 lg:py-2.5 text-center">
                          <div className="inline-flex rounded-lg p-0.5 bg-slate-200/70 gap-0.5 border border-slate-200">
                            <button
                              type="button"
                              onClick={() => handleStatusChange(record.nis, 'Hadir')}
                              className={`px-3 py-1 lg:px-3.5 lg:py-1.5 text-[11px] lg:text-xs font-black rounded-md transition cursor-pointer ${
                                record.status === 'Hadir'
                                  ? 'bg-emerald-600 text-white shadow-2xs'
                                  : 'text-slate-600 hover:text-emerald-700 hover:bg-emerald-50/50'
                              }`}
                            >
                              Hadir
                            </button>
                            <button
                              type="button"
                              onClick={() => handleStatusChange(record.nis, 'Sakit')}
                              className={`px-3 py-1 lg:px-3.5 lg:py-1.5 text-[11px] lg:text-xs font-black rounded-md transition cursor-pointer ${
                                record.status === 'Sakit'
                                  ? 'bg-blue-600 text-white shadow-2xs'
                                  : 'text-slate-600 hover:text-blue-700 hover:bg-blue-50/50'
                              }`}
                            >
                              Sakit
                            </button>
                            <button
                              type="button"
                              onClick={() => handleStatusChange(record.nis, 'Izin')}
                              className={`px-3 py-1 lg:px-3.5 lg:py-1.5 text-[11px] lg:text-xs font-black rounded-md transition cursor-pointer ${
                                record.status === 'Izin'
                                  ? 'bg-amber-500 text-white shadow-2xs'
                                  : 'text-slate-600 hover:text-amber-700 hover:bg-amber-50/50'
                              }`}
                            >
                              Izin
                            </button>
                            <button
                              type="button"
                              onClick={() => handleStatusChange(record.nis, 'Alfa')}
                              className={`px-3 py-1 lg:px-3.5 lg:py-1.5 text-[11px] lg:text-xs font-black rounded-md transition cursor-pointer ${
                                record.status === 'Alfa'
                                  ? 'bg-rose-600 text-white shadow-2xs'
                                  : 'text-slate-600 hover:text-rose-700 hover:bg-rose-50/50'
                              }`}
                            >
                              Alfa
                            </button>
                          </div>
                        </td>

                        {/* Terlambat (Menit) */}
                        <td className="py-2 px-3 lg:py-2.5 text-center">
                          <div className="flex items-center justify-center">
                            <div className="relative w-20 lg:w-24">
                              <input
                                type="number"
                                min="0"
                                disabled={record.status !== 'Hadir'}
                                value={record.status !== 'Hadir' ? '' : (record.terlambat === null || record.terlambat === undefined || isNaN(Number(record.terlambat)) ? 0 : record.terlambat)}
                                onChange={e => handleLatenessChange(record.nis, e.target.value)}
                                className={`w-full text-center py-1 lg:py-1.5 text-xs lg:text-sm rounded-md border font-mono font-bold ${
                                  record.status !== 'Hadir'
                                    ? 'bg-slate-100 text-slate-300 border-slate-200 cursor-not-allowed'
                                    : record.terlambat > 0
                                    ? 'border-rose-300 text-rose-700 bg-rose-50 font-black'
                                    : 'border-slate-200 text-slate-700 focus:ring-1 focus:ring-indigo-500'
                                }`}
                                placeholder="0"
                              />
                              {record.status === 'Hadir' && record.terlambat > 0 && (
                                <span className="absolute right-1 top-1.5 text-rose-500 animate-pulse">
                                  <Clock className="w-3 h-3 lg:w-3.5 lg:h-3.5" />
                                </span>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Keterangan */}
                        <td className="py-2 px-3 lg:py-2.5">
                          <input
                            type="text"
                            value={record.keterangan}
                            onChange={e => handleRemarkChange(record.nis, e.target.value)}
                            placeholder={
                              record.status === 'Sakit'
                                ? 'Contoh: Demam, Surat dokter'
                                : record.status === 'Izin'
                                ? 'Contoh: Acara keluarga'
                                : record.status === 'Hadir' && record.terlambat > 0
                                ? 'Contoh: Ketinggalan angkot'
                                : 'Catatan...'
                            }
                            className="w-full py-1 lg:py-1.5 px-2.5 text-xs lg:text-sm rounded-md border border-slate-200 bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Lazy Loading Sentinel and Controller */}
            {hasMoreRecords ? (
              <div ref={attendanceSentinelRef} className="py-3 px-4 border-t border-slate-200 bg-slate-50/80 text-center flex flex-col sm:flex-row items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-600">
                  <Loader2 className="w-4 h-4 animate-spin text-indigo-600 shrink-0" />
                  <span>Menampilkan <strong className="text-slate-900 font-extrabold">{visibleRecords.length}</strong> dari <strong className="text-slate-900 font-extrabold">{totalRecordsCount}</strong> presensi (Lazy Loading)</span>
                </div>
                <button
                  type="button"
                  onClick={loadAllRecords}
                  className="px-3 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg text-xs font-extrabold transition cursor-pointer"
                >
                  Tampilkan Semua ({totalRecordsCount})
                </button>
              </div>
            ) : totalRecordsCount > 40 && (
              <div className="py-2.5 px-4 border-t border-slate-200 bg-slate-50/50 text-center text-xs font-bold text-slate-500">
                Menampilkan seluruh <strong className="text-slate-800">{totalRecordsCount}</strong> data presensi.
              </div>
            )}

          </div>
        )}
      </div>

      {/* Modal Konfirmasi Hapus */}
      {showConfirmDelete && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-xl max-w-md w-full p-6 space-y-5 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-start gap-3">
              <div className="p-3 bg-rose-50 text-rose-600 rounded-2xl shrink-0">
                <Trash2 className="w-6 h-6 animate-pulse" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-extrabold text-slate-950">
                  Hapus Data Absensi?
                </h3>
                <p className="text-xs text-slate-500">
                  Tindakan ini tidak dapat dibatalkan.
                </p>
              </div>
            </div>

            <div className="text-xs text-slate-600 leading-relaxed bg-slate-50 border border-slate-100 rounded-xl p-3.5 space-y-1">
              <p>
                Anda akan menghapus seluruh data absensi kelas <strong className="font-bold text-slate-800">{(students[0]?.kelas) || 'ini'}</strong> untuk tanggal:
              </p>
              <p className="font-extrabold text-indigo-700">
                {new Date(selectedDate).toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
              </p>
              <p className="text-[10px] text-slate-400 italic pt-1">
                Data absensi pada tanggal tersebut akan dihapus secara permanen dari database Firebase dan rekap bulanan akan dikalkulasikan ulang otomatis.
              </p>
            </div>

            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={() => setShowConfirmDelete(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={async () => {
                  setShowConfirmDelete(false);
                  setIsDeleting(true);
                  setSaveStatus('idle');
                  try {
                    if (onDelete) {
                      await onDelete(selectedDate);
                      isDirtyRef.current = false; // Reset dirty flag after deleting
                      // Reset local records to default "Hadir" for this date
                      const initialized = students.map(student => ({
                        tanggal: selectedDate,
                        nis: student.nis,
                        nama: student.nama,
                        status: 'Hadir' as const,
                        terlambat: 0,
                        keterangan: '',
                        kelas: student.kelas,
                        jenisKelamin: student.jenisKelamin
                      }));
                      setLocalRecords(initialized);
                      setSaveStatus('success');
                      setTimeout(() => setSaveStatus('idle'), 3000);
                    }
                  } catch (err) {
                    console.error(err);
                    setSaveStatus('error');
                  } finally {
                    setIsDeleting(false);
                  }
                }}
                disabled={isDeleting}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 disabled:bg-slate-300 text-white font-bold rounded-xl text-xs transition flex items-center gap-1.5 cursor-pointer shadow-sm shadow-rose-200"
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Menghapus...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    Ya, Hapus Data
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Konfirmasi Simpan di Luar Jadwal Belajar */}
      {showOutOfScheduleConfirm && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-md w-full p-6 space-y-4 animate-in zoom-in-95 duration-200">
            <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-600 flex items-center justify-center">
              <AlertTriangle className="w-6 h-6" />
            </div>

            <div>
              <h3 className="font-extrabold text-slate-900 text-base">
                Simpan Presensi di Luar Jadwal?
              </h3>
              <p className="text-xs text-slate-600 mt-2 leading-relaxed">
                Hari ini (<strong className="text-slate-800">{new Date(selectedDate).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</strong>) bukan merupakan hari jadwal belajar resmi untuk <strong className="text-slate-800">{className || 'kelas ini'}</strong>.
              </p>
              <div className="mt-2.5 p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-600 space-y-1">
                <span className="font-bold text-slate-700 block">Jadwal Belajar Terdaftar:</span>
                <span className="text-indigo-600 font-extrabold">{classSchedule?.hari?.join(', ') || '-'}</span>
              </div>
              <p className="text-[11px] text-slate-500 mt-3 italic">
                Apakah ini sesi kelas pengganti atau bimbingan khusus sehingga Anda tetap ingin menyimpan presensi ini?
              </p>
            </div>

            <div className="flex gap-2.5 justify-end pt-2">
              <button
                type="button"
                onClick={() => setShowOutOfScheduleConfirm(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={async () => {
                  setShowOutOfScheduleConfirm(false);
                  await executeSave();
                }}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-extrabold rounded-xl text-xs transition flex items-center gap-1.5 cursor-pointer shadow-sm shadow-amber-200"
              >
                <Check className="w-3.5 h-3.5" />
                Tetap Simpan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Tandai Tanggal Tidak Absen */}
      {isMarkModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-md w-full p-5 space-y-4 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-amber-100 text-amber-700 rounded-xl">
                  <Tag className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-black text-slate-800 text-sm">
                    Tandai Tanggal Tidak Absen
                  </h3>
                  <p className="text-[11px] text-slate-400 font-medium">
                    {new Date(selectedDate).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsMarkModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveMarkModal} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Alasan Kenapa Tidak Absen:
                </label>
                <textarea
                  rows={3}
                  value={markModalReason}
                  onChange={e => setMarkModalReason(e.target.value)}
                  placeholder="Contoh: Libur Hari Raya Idul Fitri, Tanggal Merah, Activities Classmeeting..."
                  className="w-full p-2.5 text-xs rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500 font-medium"
                  required
                />
              </div>

              {/* Quick Suggestion Chips */}
              <div className="space-y-1.5">
                <span className="text-[10px] font-extrabold uppercase text-slate-400 tracking-wider block">
                  Pilihan Cepat (Klik untuk memilih):
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    'Libur Hari Raya',
                    'Tanggal Merah / Libur Nasional',
                    'Kegiatan / Piknik Sekolah',
                    'Classmeeting',
                    'Rapat Guru / Dinas',
                    'Libur Semester',
                    'Ujian PAS / PAT'
                  ].map(preset => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setMarkModalReason(preset)}
                      className="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-lg text-[10px] font-bold transition cursor-pointer"
                    >
                      + {preset}
                    </button>
                  ))}
                </div>
              </div>

              <div className="p-3 bg-amber-50 border border-amber-200/80 rounded-xl text-[11px] text-amber-800 flex items-start gap-2">
                <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <p>
                  Setelah disimpan, tanggal pada kalender akan berubah menjadi <strong className="font-extrabold text-amber-900">warna Oranye</strong> untuk membedakannya dari tanggal biasa.
                </p>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-slate-100 gap-2">
                {currentDateNote ? (
                  <button
                    type="button"
                    onClick={() => setShowConfirmDeleteDateNote(true)}
                    disabled={isSavingDateNote}
                    className="px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-black transition cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Hapus Penanda</span>
                  </button>
                ) : (
                  <div />
                )}

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsMarkModalOpen(false)}
                    className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold text-xs rounded-xl transition cursor-pointer"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={isSavingDateNote || !markModalReason.trim()}
                    className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white font-extrabold text-xs rounded-xl transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50 shadow-sm shadow-amber-200"
                  >
                    {isSavingDateNote ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Check className="w-3.5 h-3.5" />
                    )}
                    <span>Simpan Penanda</span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Detail Siswa Berisiko (Early Warning) */}
      {selectedAtRiskStudent && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-lg w-full p-6 space-y-5 animate-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="flex items-start justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-rose-100 text-rose-700 rounded-2xl">
                  <ShieldAlert className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-black text-slate-900 text-base leading-tight">
                    Detail Riwayat Siswa Berisiko
                  </h3>
                  <p className="text-xs text-slate-500 font-medium mt-0.5">
                    {selectedAtRiskStudent.student.nama} (NIS: {selectedAtRiskStudent.student.nis})
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedAtRiskStudent(null)}
                className="text-slate-400 hover:text-slate-700 p-1.5 rounded-xl hover:bg-slate-100 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Performance Indicators */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <div className="bg-emerald-50 border border-emerald-150 p-2.5 rounded-xl text-center">
                <span className="block text-xs font-bold text-emerald-600">Hadir</span>
                <span className="text-lg font-black text-emerald-800">{selectedAtRiskStudent.hadirCount}</span>
              </div>
              <div className="bg-blue-50 border border-blue-150 p-2.5 rounded-xl text-center">
                <span className="block text-xs font-bold text-blue-600">Sakit</span>
                <span className="text-lg font-black text-blue-800">{selectedAtRiskStudent.sakitCount}</span>
              </div>
              <div className="bg-amber-50 border border-amber-150 p-2.5 rounded-xl text-center">
                <span className="block text-xs font-bold text-amber-600">Izin</span>
                <span className="text-lg font-black text-amber-800">{selectedAtRiskStudent.izinCount}</span>
              </div>
              <div className="bg-rose-50 border border-rose-150 p-2.5 rounded-xl text-center">
                <span className="block text-xs font-bold text-rose-600">Alfa</span>
                <span className="text-lg font-black text-rose-800">{selectedAtRiskStudent.alfaCount}</span>
              </div>
            </div>

            {/* Attendance Percentage & Risk Status */}
            <div className="p-3.5 bg-slate-50 border border-slate-150 rounded-2xl space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-extrabold text-slate-700">Tingkat Kehadiran:</span>
                <span className={`font-black text-sm ${
                  selectedAtRiskStudent.attendancePct < 80 ? 'text-rose-600' : 'text-emerald-600'
                }`}>
                  {selectedAtRiskStudent.attendancePct}%
                </span>
              </div>
              <div className="w-full bg-slate-200 h-2.5 rounded-full overflow-hidden">
                <div 
                  className={`h-full rounded-full transition-all duration-500 ${
                    selectedAtRiskStudent.attendancePct < 80 ? 'bg-rose-500' : 'bg-emerald-500'
                  }`}
                  style={{ width: `${Math.min(100, Math.max(0, selectedAtRiskStudent.attendancePct))}%` }}
                />
              </div>
              <p className="text-[11px] text-slate-500 leading-relaxed pt-1">
                {selectedAtRiskStudent.alfaCount >= 3 ? (
                  <span className="text-rose-700 font-bold">
                    ⚠️ Memiliki {selectedAtRiskStudent.alfaCount} kali Alfa. Disarankan membuat surat pemberitahuan atau melakukan panggilan wali murid.
                  </span>
                ) : (
                  <span className="text-amber-800 font-bold">
                    ⚠️ Kehadiran di bawah ambang batas minimal 80% ({selectedAtRiskStudent.attendancePct}%). Perlu pendampingan wali kelas.
                  </span>
                )}
              </p>
            </div>

            {/* List of Alfa Dates */}
            {selectedAtRiskStudent.alfaDates.length > 0 && (
              <div className="space-y-2">
                <label className="block text-xs font-extrabold text-slate-700 uppercase tracking-wider">
                  Daftar Tanggal Tanpa Keterangan (Alfa):
                </label>
                <div className="max-h-36 overflow-y-auto space-y-1.5 pr-1">
                  {selectedAtRiskStudent.alfaDates.map(dateStr => {
                    const d = new Date(dateStr);
                    const formatted = isNaN(d.getTime()) 
                      ? dateStr 
                      : d.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
                    return (
                      <div 
                        key={dateStr}
                        className="flex items-center justify-between p-2 bg-rose-50/70 border border-rose-100 rounded-xl text-xs"
                      >
                        <span className="font-bold text-rose-900">{formatted}</span>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedDate(dateStr);
                            setSelectedAtRiskStudent(null);
                          }}
                          className="text-[10px] font-black text-indigo-600 hover:text-indigo-800 bg-white px-2 py-0.5 rounded-md border border-indigo-100 shadow-2xs hover:underline cursor-pointer flex items-center gap-1"
                        >
                          <span>Buka Tanggal</span>
                          <ExternalLink className="w-2.5 h-2.5" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Footer buttons */}
            <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => {
                  setSearchQuery(selectedAtRiskStudent.student.nama);
                  setSelectedAtRiskStudent(null);
                }}
                className="px-3.5 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-extrabold text-xs rounded-xl transition cursor-pointer flex items-center gap-1.5"
              >
                <Search className="w-3.5 h-3.5" />
                <span>Filter di Tabel Presensi</span>
              </button>

              <button
                type="button"
                onClick={() => setSelectedAtRiskStudent(null)}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl transition cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Konfirmasi Hapus Penanda Tanggal */}
      {showConfirmDeleteDateNote && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-xl max-w-md w-full p-6 space-y-5 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-start gap-3">
              <div className="p-3 bg-amber-50 text-amber-600 rounded-2xl shrink-0">
                <Trash2 className="w-6 h-6 animate-pulse" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-extrabold text-slate-950">
                  Hapus Penanda Tanggal?
                </h3>
                <p className="text-xs text-slate-500">
                  Tindakan ini akan menghapus catatan libur/kegiatan pada tanggal ini.
                </p>
              </div>
            </div>

            <div className="text-xs text-slate-600 leading-relaxed bg-slate-50 border border-slate-100 rounded-xl p-3.5 space-y-1">
              <p>
                Penanda untuk tanggal:
              </p>
              <p className="font-extrabold text-indigo-700">
                {new Date(selectedDate).toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
              </p>
              {currentDateNote?.alasan && (
                <p className="text-xs text-slate-700 font-semibold italic bg-amber-50/60 p-2 rounded-lg border border-amber-100/60 mt-1">
                  "{currentDateNote.alasan}"
                </p>
              )}
              <p className="text-[10px] text-slate-400 italic pt-1">
                Tanggal ini akan dikembalikan menjadi hari sekolah biasa di kalender presensi.
              </p>
            </div>

            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={() => setShowConfirmDeleteDateNote(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={async () => {
                  setShowConfirmDeleteDateNote(false);
                  await handleDeleteDateNoteConfirm();
                }}
                disabled={isSavingDateNote}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 disabled:bg-slate-300 text-white font-bold rounded-xl text-xs transition flex items-center gap-1.5 cursor-pointer shadow-sm shadow-rose-200"
              >
                {isSavingDateNote ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Menghapus...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    Ya, Hapus Penanda
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
