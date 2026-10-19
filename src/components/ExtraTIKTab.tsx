import React, { useState, useMemo } from 'react';
import { Student, ExtraTikPeserta, ExtraTikAbsensi, ExtraTikNilai } from '../types';
import { getFriendlyErrorMessage } from '../lib/errorHelper';
import { 
  Users, CheckSquare, Award, ArrowLeft, Plus, Trash2, Save, 
  Search, AlertCircle, RefreshCw, Check, Calendar, UserCheck, Edit2, ChevronDown, X, UserPlus,
  ChevronLeft, ChevronRight
} from 'lucide-react';
import { motion } from 'motion/react';

interface ExtraTIKTabProps {
  students: Student[];
  extraTikPeserta: ExtraTikPeserta[];
  extraTikAbsensi: ExtraTikAbsensi[];
  extraTikNilai: ExtraTikNilai[];
  onSyncPeserta: (peserta: ExtraTikPeserta[], deletedNis?: string) => Promise<void>;
  onSyncAbsensi: (absensi: ExtraTikAbsensi[], dateToClear?: string, classToClear?: string) => Promise<void>;
  onSyncNilai: (nilai: ExtraTikNilai[]) => Promise<void>;
  onBackToDashboard: () => void;
  classes: { id: number; name: string }[];
  selectedClassId?: number;
}

type SubTab = 'peserta' | 'absen' | 'nilai' | 'rekap';

export default function ExtraTIKTab({
  students,
  extraTikPeserta,
  extraTikAbsensi,
  extraTikNilai,
  onSyncPeserta,
  onSyncAbsensi,
  onSyncNilai,
  onBackToDashboard,
  classes,
  selectedClassId
}: ExtraTIKTabProps) {
  const [activeSubTab, setActiveSubTab] = useState<SubTab>('peserta');
  
  // Search & Filter state
  const [pesertaSearch, setPesertaSearch] = useState('');
  const [pesertaClassFilter, setPesertaClassFilter] = useState('Semua');
  
  // Add Participant Form State
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedNisForNew, setSelectedNisForNew] = useState('');
  const [newTanggalDaftar, setNewTanggalDaftar] = useState(new Date().toISOString().split('T')[0]);
  const [newStatus, setNewStatus] = useState<'Aktif' | 'Alumni' | 'Keluar'>('Aktif');
  const [isOpenSelect, setIsOpenSelect] = useState(false);
  const [studentSearchQuery, setStudentSearchQuery] = useState('');
  const [modalSelectedClass, setModalSelectedClass] = useState<string>('Semua');
  
  // Attendance Sub-Tab State
  const [attendanceDate, setAttendanceDate] = useState(new Date().toISOString().split('T')[0]);
  const [attendanceClassFilter, setAttendanceClassFilter] = useState('Semua');
  const [localAttendanceMap, setLocalAttendanceMap] = useState<Record<string, { status: 'Hadir' | 'Sakit' | 'Izin' | 'Alfa'; keterangan: string }>>({});
  
  // Grade Sub-Tab State
  const [gradeClassFilter, setGradeClassFilter] = useState('Semua');
  const [localGradesMap, setLocalGradesMap] = useState<Record<string, { tugas: number | null; praktik: number | null; teori: number | null }>>({});

  // Rekap Absensi Sub-Tab State
  const [rekapClassFilter, setRekapClassFilter] = useState('Semua');
  const [rekapSearch, setRekapSearch] = useState('');

  // Loading & Notification state
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [errorText, setErrorText] = useState('');

  // Delete Confirmation Dialog states
  const [deleteConfirmNis, setDeleteConfirmNis] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Delete Attendance Modal states
  const [showDeleteAbsensiModal, setShowDeleteAbsensiModal] = useState(false);
  const [absensiToDeleteDate, setAbsensiToDeleteDate] = useState<string | null>(null);
  const [isDeletingAbsensi, setIsDeletingAbsensi] = useState(false);

  // Scroll to top when changing activeSubTab
  React.useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    if (document.documentElement) document.documentElement.scrollTop = 0;
    if (document.body) document.body.scrollTop = 0;
  }, [activeSubTab]);

  // ----------------- HELPER FUNCTIONS -----------------
  const showToast = (status: 'success' | 'error', text = '') => {
    setSyncStatus(status);
    setErrorText(text);
    setTimeout(() => {
      setSyncStatus('idle');
    }, 3000);
  };

  const calculatePredikat = (average: number | null): string => {
    if (average === null) return '-';
    if (average >= 85) return 'A';
    if (average >= 75) return 'B';
    if (average >= 60) return 'C';
    if (average >= 45) return 'D';
    return 'E';
  };

  const calculateRataRata = (tugas: number | null, praktik: number | null, teori: number | null): number | null => {
    const values = [tugas, praktik, teori].filter((v): v is number => v !== null);
    if (values.length === 0) return null;
    const sum = values.reduce((acc, curr) => acc + curr, 0);
    return Math.round(sum / values.length);
  };

  // ----------------- DATA PREPARATION -----------------
  
  // Resolve participant's current student info by NIS to keep them perfectly connected and accurate!
  const resolvedExtraTikPeserta = useMemo(() => {
    return extraTikPeserta.map(p => {
      const normalizedNis = p.nis?.toString().trim() || '';
      const student = students.find(s => s.nis?.toString().trim() === normalizedNis);
      return {
        ...p,
        nis: normalizedNis,
        nama: student ? student.nama : (p.nama || ''),
        kelas: student ? (student.kelas || 'Belum Diatur') : (p.kelas || 'Belum Diatur')
      };
    });
  }, [extraTikPeserta, students]);

  // Helper for natural sorting by Class then Name alphabetically
  const sortStudentsByClassAndName = <T extends { kelas?: string; nama: string }>(items: T[]): T[] => {
    return [...items].sort((a, b) => {
      const classA = a.kelas || '';
      const classB = b.kelas || '';
      const classComp = classA.localeCompare(classB, undefined, { numeric: true, sensitivity: 'base' });
      if (classComp !== 0) return classComp;
      return a.nama.localeCompare(b.nama, undefined, { sensitivity: 'base' });
    });
  };

  // Available students to enroll (those who aren't currently active in Extra TIK)
  const studentsInThisClass = useMemo(() => {
    return students.filter(s => modalSelectedClass === 'Semua' || !modalSelectedClass || s.kelas === modalSelectedClass);
  }, [students, modalSelectedClass]);

  const availableStudents = useMemo(() => {
    const enrolledNisSet = new Set(resolvedExtraTikPeserta.filter(p => p.status === 'Aktif').map(p => p.nis));

    const list = students
      .filter(s => !enrolledNisSet.has(s.nis?.toString().trim()))
      .filter(s => modalSelectedClass === 'Semua' || !modalSelectedClass || s.kelas === modalSelectedClass);

    return sortStudentsByClassAndName(list);
  }, [students, resolvedExtraTikPeserta, modalSelectedClass]);

  // Filtered Participants List
  const filteredPeserta = useMemo(() => {
    const list = resolvedExtraTikPeserta.filter(p => {
      const matchSearch = p.nama.toLowerCase().includes(pesertaSearch.toLowerCase()) || 
                          p.nis.includes(pesertaSearch);
      const matchClass = pesertaClassFilter === 'Semua' || p.kelas === pesertaClassFilter;
      return matchSearch && matchClass;
    });
    return sortStudentsByClassAndName(list);
  }, [resolvedExtraTikPeserta, pesertaSearch, pesertaClassFilter]);

  // Active Participants for Attendance and Grade calculation
  const activePeserta = useMemo(() => {
    const list = resolvedExtraTikPeserta.filter(p => p.status === 'Aktif');
    return sortStudentsByClassAndName(list);
  }, [resolvedExtraTikPeserta]);

  // Filtered Active Participants for Attendance
  const filteredActivePesertaForAttendance = useMemo(() => {
    const list = activePeserta.filter(p => {
      return attendanceClassFilter === 'Semua' || p.kelas === attendanceClassFilter;
    });
    return sortStudentsByClassAndName(list);
  }, [activePeserta, attendanceClassFilter]);

  // Filtered Active Participants for Grade
  const filteredActivePesertaForGrade = useMemo(() => {
    const list = activePeserta.filter(p => {
      return gradeClassFilter === 'Semua' || p.kelas === gradeClassFilter;
    });
    return sortStudentsByClassAndName(list);
  }, [activePeserta, gradeClassFilter]);

  // Attendance Statistics for Active Students
  const attendanceStats = useMemo(() => {
    const stats: Record<string, { hadir: number; sakit: number; izin: number; alfa: number; total: number; percentage: number }> = {};
    
    // Initialize for all active peserta
    activePeserta.forEach(p => {
      stats[p.nis] = { hadir: 0, sakit: 0, izin: 0, alfa: 0, total: 0, percentage: 0 };
    });

    // Count from extraTikAbsensi
    extraTikAbsensi.forEach(a => {
      if (stats[a.nis]) {
        stats[a.nis].total += 1;
        if (a.statusKehadiran === 'Hadir') stats[a.nis].hadir += 1;
        else if (a.statusKehadiran === 'Sakit') stats[a.nis].sakit += 1;
        else if (a.statusKehadiran === 'Izin') stats[a.nis].izin += 1;
        else if (a.statusKehadiran === 'Alfa') stats[a.nis].alfa += 1;
      }
    });

    // Calculate percentage
    activePeserta.forEach(p => {
      const s = stats[p.nis];
      if (s.total > 0) {
        s.percentage = Math.round((s.hadir / s.total) * 100);
      } else {
        s.percentage = 0; // default if no classes held yet
      }
    });

    return stats;
  }, [activePeserta, extraTikAbsensi]);

  // Filtered Active Participants for Rekap
  const filteredActivePesertaForRekap = useMemo(() => {
    const list = activePeserta.filter(p => {
      const matchSearch = p.nama.toLowerCase().includes(rekapSearch.toLowerCase()) || p.nis.includes(rekapSearch);
      const matchClass = rekapClassFilter === 'Semua' || p.kelas === rekapClassFilter;
      return matchSearch && matchClass;
    });
    return sortStudentsByClassAndName(list);
  }, [activePeserta, rekapSearch, rekapClassFilter]);

  // Memoized Set of dates that have attendance recorded for the selected class/all classes
  const recordedDates = useMemo(() => {
    const dates = new Set<string>();
    extraTikAbsensi.forEach(record => {
      if (record.tanggal) {
        if (attendanceClassFilter === 'Semua' || record.kelas === attendanceClassFilter) {
          dates.add(record.tanggal);
        }
      }
    });
    return dates;
  }, [extraTikAbsensi, attendanceClassFilter]);

  // Check if current selected attendanceDate has saved records
  const isCurrentDateRecorded = useMemo(() => {
    return extraTikAbsensi.some(a => a.tanggal === attendanceDate && (attendanceClassFilter === 'Semua' || a.kelas === attendanceClassFilter));
  }, [extraTikAbsensi, attendanceDate, attendanceClassFilter]);

  // Recorded sessions summary list for quick deletion or navigation
  const recordedSessionsList = useMemo(() => {
    const map = new Map<string, { tanggal: string; totalCount: number; hadirCount: number }>();
    extraTikAbsensi.forEach(a => {
      if (attendanceClassFilter === 'Semua' || a.kelas === attendanceClassFilter) {
        const existing = map.get(a.tanggal) || { tanggal: a.tanggal, totalCount: 0, hadirCount: 0 };
        existing.totalCount += 1;
        if (a.statusKehadiran === 'Hadir') existing.hadirCount += 1;
        map.set(a.tanggal, existing);
      }
    });
    return Array.from(map.values()).sort((a, b) => b.tanggal.localeCompare(a.tanggal));
  }, [extraTikAbsensi, attendanceClassFilter]);

  // Calendar calculations based on selected attendanceDate
  const { year, month, daysInMonth, firstDayIndex, currentDay } = useMemo(() => {
    const [yStr, mStr, dStr] = attendanceDate.split('-');
    const y = parseInt(yStr) || new Date().getFullYear();
    const m = parseInt(mStr) || (new Date().getMonth() + 1);
    const d = parseInt(dStr) || new Date().getDate();
    
    // Total days in this month
    const dim = new Date(y, m, 0).getDate();
    // Weekday index of 1st day of the month (0 = Sunday, 1 = Monday...)
    const fdi = new Date(y, m - 1, 1).getDay();
    
    return {
      year: y,
      month: m,
      daysInMonth: dim,
      firstDayIndex: fdi,
      currentDay: d
    };
  }, [attendanceDate]);

  const monthNamesIndonesian = useMemo(() => [
    "Januari", "Februari", "Maret", "April", "Mei", "Juni",
    "Juli", "Agustus", "September", "Oktober", "November", "Desember"
  ], []);

  const currentMonthName = useMemo(() => monthNamesIndonesian[month - 1] || "", [month, monthNamesIndonesian]);

  // Helper navigation handlers
  const handlePrevMonth = () => {
    const date = new Date(year, month - 2, 1);
    const newDateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`;
    setAttendanceDate(newDateStr);
  };

  const handleNextMonth = () => {
    const date = new Date(year, month, 1);
    const newDateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`;
    setAttendanceDate(newDateStr);
  };

  const handleSelectDay = (dayNum: number) => {
    const formattedDate = `${year}-${String(month).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
    setAttendanceDate(formattedDate);
  };

  const calendarCells = useMemo(() => {
    const cells = [];
    // Empty padding cells for first week alignment
    for (let i = 0; i < firstDayIndex; i++) {
      cells.push({ dayNum: null, dateStr: null, isRecorded: false, isActive: false });
    }
    // Month days
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const isRecorded = recordedDates.has(dateStr);
      const isActive = currentDay === day;
      cells.push({ dayNum: day, dateStr, isRecorded, isActive });
    }
    return cells;
  }, [year, month, daysInMonth, firstDayIndex, currentDay, recordedDates]);

  // Initialize local attendance map when date or active participants change
  React.useEffect(() => {
    const existingForDate = extraTikAbsensi.filter(a => a.tanggal === attendanceDate);
    const newMap: Record<string, { status: 'Hadir' | 'Sakit' | 'Izin' | 'Alfa'; keterangan: string }> = {};
    
    // Fill with active participants
    activePeserta.forEach(p => {
      const match = existingForDate.find(a => a.nis === p.nis);
      newMap[p.nis] = {
        status: match ? match.statusKehadiran : 'Hadir',
        keterangan: match ? match.keterangan : ''
      };
    });
    setLocalAttendanceMap(newMap);
  }, [attendanceDate, activePeserta, extraTikAbsensi]);

  // Initialize local grades map when active participants change
  React.useEffect(() => {
    const newMap: Record<string, { tugas: number | null; praktik: number | null; teori: number | null }> = {};
    activePeserta.forEach(p => {
      const match = extraTikNilai.find(n => n.nis === p.nis);
      newMap[p.nis] = {
        tugas: match ? match.nilaiTugas : null,
        praktik: match ? match.nilaiPraktik : null,
        teori: match ? match.nilaiTeori : null
      };
    });
    setLocalGradesMap(newMap);
  }, [activePeserta, extraTikNilai]);

  // Synchronize modal selected class with active dashboard class, and reset selections correctly
  React.useEffect(() => {
    if (showAddModal) {
      const activeClass = classes.find(c => c.id === selectedClassId);
      setModalSelectedClass(activeClass ? activeClass.name : 'Semua');
      setSelectedNisForNew('');
    }
  }, [showAddModal, selectedClassId, classes]);

  React.useEffect(() => {
    setSelectedNisForNew('');
  }, [modalSelectedClass]);

  // ----------------- ACTION HANDLERS -----------------
  
  // Add new participant
  const handleAddParticipant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedNisForNew) {
      showToast('error', 'Pilih siswa terlebih dahulu.');
      return;
    }
    const student = students.find(s => s.nis === selectedNisForNew);
    if (!student) return;

    // Check if they are already in the list but not active
    const existingIdx = extraTikPeserta.findIndex(p => p.nis?.toString().trim() === student.nis?.toString().trim());
    let updatedList = [...extraTikPeserta];

    if (existingIdx > -1) {
      updatedList[existingIdx] = {
        ...updatedList[existingIdx],
        status: 'Aktif',
        tanggalDaftar: newTanggalDaftar
      };
    } else {
      updatedList.push({
        nis: student.nis?.toString().trim(),
        nama: student.nama,
        kelas: student.kelas || 'Belum Diatur',
        tanggalDaftar: newTanggalDaftar,
        status: 'Aktif'
      });
    }

    try {
      setIsSyncing(true);
      await onSyncPeserta(updatedList);
      showToast('success');
      setSelectedNisForNew('');
      setShowAddModal(false);
    } catch (err) {
      showToast('error', `Gagal mendaftarkan peserta: ${getFriendlyErrorMessage(err)}`);
    } finally {
      setIsSyncing(false);
    }
  };

  // Change participant status
  const handleUpdateStatus = async (nis: string, status: 'Aktif' | 'Alumni' | 'Keluar') => {
    const updatedList = extraTikPeserta.map(p => {
      if (p.nis?.toString().trim() === nis?.toString().trim()) {
        return { ...p, status };
      }
      return p;
    });

    try {
      setIsSyncing(true);
      await onSyncPeserta(updatedList);
      showToast('success');
    } catch (err) {
      showToast('error', `Gagal memperbarui status peserta: ${getFriendlyErrorMessage(err)}`);
    } finally {
      setIsSyncing(false);
    }
  };

  // Initiate delete participant by opening custom modal
  const initiateDeleteParticipant = (nis: string) => {
    setDeleteConfirmNis(nis);
  };

  // Delete participant completely after confirmation
  const handleConfirmDeleteParticipant = async () => {
    if (!deleteConfirmNis) return;
    const targetNis = deleteConfirmNis.toString().trim();
    const updatedList = extraTikPeserta.filter(p => p.nis?.toString().trim() !== targetNis);
    
    try {
      setIsDeleting(true);
      await onSyncPeserta(updatedList, targetNis);
      showToast('success', 'Peserta berhasil dihapus dari Ekstrakurikuler TIK.');
      setDeleteConfirmNis(null);
    } catch (err) {
      showToast('error', `Gagal menghapus peserta: ${getFriendlyErrorMessage(err)}`);
    } finally {
      setIsDeleting(false);
    }
  };

  // Bulk mark all as Hadir
  const handleMarkAllHadir = () => {
    const updated = { ...localAttendanceMap };
    filteredActivePesertaForAttendance.forEach(p => {
      if (updated[p.nis]) {
        updated[p.nis].status = 'Hadir';
      }
    });
    setLocalAttendanceMap(updated);
  };

  // Save/Sync Attendance
  const handleSaveAttendance = async () => {
    // We update the master attendance records for this date and class filter
    const filteredAbsensi = extraTikAbsensi.filter(a => !(a.tanggal === attendanceDate && (attendanceClassFilter === 'Semua' || a.kelas === attendanceClassFilter)));
    
    // Add new ones from local map
    const newRecords: ExtraTikAbsensi[] = [];
    activePeserta.forEach(p => {
      if (attendanceClassFilter !== 'Semua' && p.kelas !== attendanceClassFilter) return;
      const local = localAttendanceMap[p.nis];
      if (local) {
        newRecords.push({
          tanggal: attendanceDate,
          nis: p.nis,
          nama: p.nama,
          kelas: p.kelas,
          statusKehadiran: local.status,
          keterangan: local.keterangan
        });
      }
    });

    const updatedMaster = [...filteredAbsensi, ...newRecords];

    try {
      setIsSyncing(true);
      await onSyncAbsensi(updatedMaster, attendanceDate, attendanceClassFilter);
      showToast('success', 'Presensi berhasil disimpan.');
    } catch (err) {
      showToast('error', `Gagal menyimpan presensi: ${getFriendlyErrorMessage(err)}`);
    } finally {
      setIsSyncing(false);
    }
  };

  // Delete/Cancel Attendance for a date
  const handleConfirmDeleteAbsensi = async () => {
    const targetDate = absensiToDeleteDate || attendanceDate;
    const targetClass = attendanceClassFilter;

    const filteredAbsensi = extraTikAbsensi.filter(a => !(a.tanggal === targetDate && (targetClass === 'Semua' || a.kelas === targetClass)));

    try {
      setIsDeletingAbsensi(true);
      await onSyncAbsensi(filteredAbsensi, targetDate, targetClass);
      
      // Reset local map for active participants if targetDate is selected
      if (targetDate === attendanceDate) {
        setLocalAttendanceMap(prev => {
          const next = { ...prev };
          activePeserta.forEach(p => {
            next[p.nis] = { status: 'Hadir', keterangan: '' };
          });
          return next;
        });
      }

      showToast('success', `Presensi tanggal ${targetDate} berhasil dihapus.`);
      setShowDeleteAbsensiModal(false);
      setAbsensiToDeleteDate(null);
    } catch (err) {
      showToast('error', `Gagal menghapus presensi: ${getFriendlyErrorMessage(err)}`);
    } finally {
      setIsDeletingAbsensi(false);
    }
  };

  // Save/Sync Grades
  const handleSaveGrades = async () => {
    const newGrades: ExtraTikNilai[] = [];
    activePeserta.forEach(p => {
      const local = localGradesMap[p.nis];
      if (local) {
        const average = calculateRataRata(local.tugas, local.praktik, local.teori);
        const predikat = calculatePredikat(average);
        newGrades.push({
          nis: p.nis,
          nama: p.nama,
          kelas: p.kelas,
          nilaiTugas: local.tugas,
          nilaiPraktik: local.praktik,
          nilaiTeori: local.teori,
          rataRata: average,
          predikat
        });
      }
    });

    try {
      setIsSyncing(true);
      await onSyncNilai(newGrades);
      showToast('success');
    } catch (err) {
      showToast('error', `Gagal menyimpan nilai: ${getFriendlyErrorMessage(err)}`);
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Area */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between bg-white p-6 rounded-2xl border border-slate-100 shadow-sm gap-4">
        <div>
          <span className="px-3 py-1 text-xs font-semibold text-sky-600 bg-sky-50 rounded-full">
            Menu Administrasi Khusus
          </span>
          <h1 className="text-2xl font-bold text-slate-800 mt-2 font-sans tracking-tight">
            Manajemen Ekstrakurikuler Teknologi Informasi &amp; Komunikasi (TIK)
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Atur peserta, pencatatan absensi mingguan, dan pengolahan nilai ekstra TIK secara praktis.
          </p>
        </div>
      </div>

      {/* Sub Tabs Navigation */}
      <div className="flex border-b border-slate-200 bg-white px-4 pt-4 rounded-xl shadow-xs">
        <button
          onClick={() => setActiveSubTab('peserta')}
          className={`flex items-center gap-2 px-5 py-3 border-b-2 font-medium text-sm transition-all ${
            activeSubTab === 'peserta'
              ? 'border-sky-500 text-sky-600'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
          id="subtab-peserta"
        >
          <Users className="w-4 h-4" />
          Kelola Peserta Extra
        </button>
        <button
          onClick={() => setActiveSubTab('absen')}
          className={`flex items-center gap-2 px-5 py-3 border-b-2 font-medium text-sm transition-all ${
            activeSubTab === 'absen'
              ? 'border-sky-500 text-sky-600'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
          id="subtab-absen"
        >
          <CheckSquare className="w-4 h-4" />
          Absen Extra
        </button>
        <button
          onClick={() => setActiveSubTab('nilai')}
          className={`flex items-center gap-2 px-5 py-3 border-b-2 font-medium text-sm transition-all ${
            activeSubTab === 'nilai'
              ? 'border-sky-500 text-sky-600'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
          id="subtab-nilai"
        >
          <Award className="w-4 h-4" />
          Nilai Extra
        </button>
        <button
          onClick={() => setActiveSubTab('rekap')}
          className={`flex items-center gap-2 px-5 py-3 border-b-2 font-medium text-sm transition-all ${
            activeSubTab === 'rekap'
              ? 'border-sky-500 text-sky-600'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
          id="subtab-rekap"
        >
          <Calendar className="w-4 h-4" />
          Rekap Absensi Extra
        </button>
      </div>

      {/* Toast Notification */}
      {syncStatus !== 'idle' && (
        <div 
          className={`fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg border text-sm transition-all transform animate-bounce ${
            syncStatus === 'success' 
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800' 
              : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}
          id="toast-notification"
        >
          {syncStatus === 'success' ? (
            <>
              <Check className="w-4 h-4 text-emerald-600" />
              <span>Data berhasil disimpan dan disinkronisasikan ke Google Sheets!</span>
            </>
          ) : (
            <>
              <AlertCircle className="w-4 h-4 text-rose-600" />
              <span>{errorText || 'Terjadi kesalahan sistem.'}</span>
            </>
          )}
        </div>
      )}

      {/* Main Tab Contents */}
      <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-xs">
        
        {/* SUB TAB 1: KELOLA PESERTA EXTRA */}
        {activeSubTab === 'peserta' && (
          <div className="space-y-6">
            {/* Header section with add button */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-100">
              <div>
                <h2 className="text-base font-bold text-slate-800">Daftar Peserta Ekstrakurikuler</h2>
                <p className="text-xs text-slate-400 mt-0.5">Total peserta aktif: {resolvedExtraTikPeserta.filter(p => p.status === 'Aktif').length} siswa</p>
              </div>
              <button
                onClick={() => setShowAddModal(true)}
                className="flex items-center gap-2 px-4.5 py-2.5 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs font-semibold transition-all hover:shadow-md cursor-pointer w-fit"
                id="btn-open-add-peserta"
              >
                <UserPlus className="w-4 h-4" />
                <span>Tambah Peserta Extra</span>
              </button>
            </div>

            <div className="space-y-4">
              {/* Filter & Search Bar */}
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Cari berdasarkan NIS atau Nama..."
                    value={pesertaSearch}
                    onChange={(e) => setPesertaSearch(e.target.value)}
                    className="w-full text-xs sm:text-sm pl-9.5 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500/30 focus:border-sky-500 transition-all text-slate-700 placeholder-slate-400 shadow-xs"
                    id="search-peserta"
                  />
                </div>
                <div className="w-full sm:w-48">
                  <select
                    value={pesertaClassFilter}
                    onChange={(e) => setPesertaClassFilter(e.target.value)}
                    className="w-full text-xs sm:text-sm px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500/30 focus:border-sky-500 transition-all font-semibold text-slate-700 hover:border-slate-300 cursor-pointer shadow-xs"
                    id="filter-kelas-peserta"
                  >
                    <option value="Semua">Semua Kelas</option>
                    {classes.map(c => (
                      <option key={c.id} value={c.name}>{c.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Table */}
              <div className="overflow-x-auto border border-slate-100 rounded-xl">
                <table className="w-full text-left border-collapse" id="table-peserta-extra">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100 text-xs font-semibold text-slate-500 uppercase">
                      <th className="px-4 py-3">NIS</th>
                      <th className="px-4 py-3">Nama Lengkap</th>
                      <th className="px-4 py-3">Kelas</th>
                      <th className="px-4 py-3">Tgl Daftar</th>
                      <th className="px-4 py-3 text-center">Status</th>
                      <th className="px-4 py-3 text-center">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm">
                    {filteredPeserta.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-4 py-8 text-center text-slate-400 text-xs">
                          Tidak ada peserta terdaftar yang sesuai kriteria.
                        </td>
                      </tr>
                    ) : (
                      filteredPeserta.map((p) => (
                        <tr key={p.nis} className="hover:bg-slate-50/50 transition">
                          <td className="px-4 py-3.5 font-mono text-xs font-semibold text-slate-600">{p.nis}</td>
                          <td className="px-4 py-3.5 font-medium text-slate-800">{p.nama}</td>
                          <td className="px-4 py-3.5 text-slate-600">{p.kelas}</td>
                          <td className="px-4 py-3.5 text-xs text-slate-500 font-mono">{p.tanggalDaftar}</td>
                          <td className="px-4 py-3.5 text-center">
                            <select
                              value={p.status}
                              onChange={(e) => handleUpdateStatus(p.nis, e.target.value as any)}
                              className={`text-xs font-semibold px-2.5 py-1 rounded-full border focus:outline-none ${
                                p.status === 'Aktif'
                                  ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                                  : p.status === 'Alumni'
                                  ? 'bg-blue-50 border-blue-200 text-blue-700'
                                  : 'bg-rose-50 border-rose-200 text-rose-700'
                              }`}
                            >
                              <option value="Aktif">Aktif</option>
                              <option value="Alumni">Alumni</option>
                              <option value="Keluar">Keluar</option>
                            </select>
                          </td>
                          <td className="px-4 py-3.5 text-center">
                            <button
                              type="button"
                              onClick={() => initiateDeleteParticipant(p.nis)}
                              className="p-1.5 text-rose-500 hover:bg-rose-50 hover:text-rose-700 rounded-lg transition cursor-pointer"
                              title="Hapus dari Extra TIK"
                              id={`btn-delete-peserta-${p.nis}`}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              <div className="text-right text-xs text-slate-400">
                Total Peserta TIK: <strong className="text-slate-700">{filteredPeserta.length}</strong> anak
              </div>
            </div>

            {/* Modal Popup Tambah Peserta */}
            {showAddModal && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 overflow-y-auto">
                <div className="bg-white rounded-2xl max-w-md w-full border border-slate-100 shadow-2xl overflow-visible animate-in fade-in zoom-in-95 duration-200">
                  {/* Modal Header */}
                  <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50 rounded-t-2xl">
                    <div className="flex items-center gap-2 text-slate-800 font-bold text-base">
                      <UserCheck className="w-5 h-5 text-sky-500" />
                      <span>Daftarkan Siswa ke Extra TIK</span>
                    </div>
                    <button
                      onClick={() => {
                        setShowAddModal(false);
                        setSelectedNisForNew('');
                      }}
                      className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600 transition cursor-pointer"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  {/* Modal Body / Form */}
                  <form onSubmit={handleAddParticipant} className="p-6 space-y-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                        Pilih Kelas
                      </label>
                      <select
                        value={modalSelectedClass}
                        onChange={(e) => setModalSelectedClass(e.target.value)}
                        className="w-full text-xs sm:text-sm px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500/30 focus:border-sky-500 transition-all font-semibold text-slate-700 hover:border-slate-300 cursor-pointer shadow-xs"
                      >
                        <option value="Semua">Semua Kelas</option>
                        {classes.map(c => (
                          <option key={c.id} value={c.name}>{c.name}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                        Pilih Siswa dari Roster
                      </label>
                      {studentsInThisClass.length === 0 ? (
                        <p className="text-xs text-rose-600 bg-rose-50 p-2.5 rounded-xl border border-rose-100 font-semibold leading-relaxed">
                          Kelas ini belum ada siswa yang terdata.
                        </p>
                      ) : availableStudents.length === 0 ? (
                        <p className="text-xs text-amber-600 bg-amber-50 p-2.5 rounded-xl border border-amber-100 font-medium leading-relaxed">
                          Semua siswa sudah terdaftar aktif.
                        </p>
                      ) : (
                        <div className="relative">
                          {/* Hidden native select for ID target matching compatibility */}
                          <select
                            value={selectedNisForNew}
                            onChange={(e) => setSelectedNisForNew(e.target.value)}
                            className="sr-only"
                            id="select-add-peserta"
                          >
                            <option value="">-- Pilih Siswa --</option>
                            {availableStudents.map(s => (
                              <option key={s.nis} value={s.nis}>
                                {s.nama} ({s.kelas || 'Belum Diatur'}) - {s.nis}
                              </option>
                            ))}
                          </select>

                          {/* Beautiful Custom Dropdown Trigger Button */}
                          <button
                            type="button"
                            onClick={() => setIsOpenSelect(!isOpenSelect)}
                            className="w-full text-left text-xs sm:text-sm px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500/30 focus:border-sky-500 flex items-center justify-between shadow-xs cursor-pointer hover:border-slate-300 transition-all text-slate-700"
                          >
                            <span className="truncate">
                              {selectedNisForNew
                                ? `${availableStudents.find(s => s.nis === selectedNisForNew)?.nama || ''} (${availableStudents.find(s => s.nis === selectedNisForNew)?.kelas || 'Belum Diatur'})`
                                : '-- Pilih Siswa --'}
                            </span>
                            <ChevronDown className="w-4 h-4 text-slate-400 shrink-0 ml-2 transition-transform duration-200" style={{ transform: isOpenSelect ? 'rotate(180deg)' : 'none' }} />
                          </button>

                          {/* Dropdown Menu */}
                          {isOpenSelect && (
                            <div className="absolute z-50 mt-1.5 w-full bg-white border border-slate-200/80 rounded-2xl shadow-xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
                              {/* Search Box */}
                              <div className="p-2 border-b border-slate-100 bg-slate-50/50">
                                <div className="relative">
                                  <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
                                  <input
                                    type="text"
                                    placeholder="Cari nama atau NIS..."
                                    value={studentSearchQuery}
                                    onChange={(e) => setStudentSearchQuery(e.target.value)}
                                    className="w-full text-xs pl-8.5 pr-3 py-1.5 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
                                    onClick={(e) => e.stopPropagation()}
                                    autoFocus
                                  />
                                </div>
                              </div>

                              {/* Options List with max-h and scroll capability */}
                              <div className="max-h-[265px] overflow-y-auto divide-y divide-slate-50 py-1" style={{ WebkitOverflowScrolling: 'touch' }}>
                                {(() => {
                                  const filtered = availableStudents.filter(s => {
                                    const term = studentSearchQuery.toLowerCase();
                                    return (
                                      s.nama.toLowerCase().includes(term) ||
                                      s.nis.includes(term) ||
                                      (s.kelas || '').toLowerCase().includes(term)
                                    );
                                  });

                                  if (filtered.length === 0) {
                                    return (
                                      <div className="px-3 py-5 text-center text-xs text-slate-400 font-medium">
                                        Tidak ada siswa ditemukan
                                      </div>
                                    );
                                  }

                                  return filtered.map(s => {
                                    const isSelected = s.nis === selectedNisForNew;
                                    return (
                                      <button
                                        key={s.nis}
                                        type="button"
                                        onClick={() => {
                                          setSelectedNisForNew(s.nis);
                                          setIsOpenSelect(false);
                                          setStudentSearchQuery('');
                                        }}
                                        className={`w-full text-left px-3.5 py-2.5 text-xs flex items-center justify-between hover:bg-sky-50/50 transition-colors ${
                                          isSelected ? 'bg-sky-50 text-sky-700 font-semibold' : 'text-slate-700 hover:text-slate-900'
                                        }`}
                                      >
                                        <div className="truncate pr-2">
                                          <div className="font-semibold truncate text-slate-800">{s.nama}</div>
                                          <div className="text-[10px] text-slate-500 flex items-center gap-1.5 mt-0.5 font-medium">
                                            <span className="bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-mono font-medium">{s.nis}</span>
                                            <span>•</span>
                                            <span>Kelas: {s.kelas || 'Belum Diatur'}</span>
                                          </div>
                                        </div>
                                        {isSelected && <Check className="w-4 h-4 text-sky-600 shrink-0 ml-2" />}
                                      </button>
                                    );
                                  });
                                })()}
                              </div>
                            </div>
                          )}

                          {/* Overlay backdrop to close dropdown */}
                          {isOpenSelect && (
                            <div
                              className="fixed inset-0 z-20"
                              onClick={() => {
                                setIsOpenSelect(false);
                                setStudentSearchQuery('');
                              }}
                            />
                          )}
                        </div>
                      )}
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                        Tanggal Daftar
                      </label>
                      <input
                        type="date"
                        value={newTanggalDaftar}
                        onChange={(e) => setNewTanggalDaftar(e.target.value)}
                        className="w-full text-sm px-4 py-2.5 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500/30 focus:border-sky-500 transition-all text-slate-700"
                        id="input-tanggal-daftar"
                      />
                    </div>

                    <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 mt-6">
                      <button
                        type="button"
                        onClick={() => {
                          setShowAddModal(false);
                          setSelectedNisForNew('');
                        }}
                        className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition font-medium text-xs sm:text-sm cursor-pointer"
                      >
                        Batal
                      </button>
                      <button
                        type="submit"
                        disabled={isSyncing || !selectedNisForNew}
                        className="px-5 py-2.5 bg-sky-600 hover:bg-sky-700 text-white rounded-xl transition font-semibold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-sm disabled:opacity-50 cursor-pointer min-w-[140px]"
                        id="btn-tambah-peserta"
                      >
                        {isSyncing ? (
                          <>
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                            <span>Mendaftarkan...</span>
                          </>
                        ) : (
                          <>
                            <Plus className="w-4 h-4" />
                            <span>Daftarkan Sekarang</span>
                          </>
                        )}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}
          </div>
        )}

        {/* SUB TAB 2: ABSEN EXTRA */}
        {activeSubTab === 'absen' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
              
              {/* Left Column: Controls & Attendance Table */}
              <div className="lg:col-span-3 space-y-6">
                {/* Control Panel Absensi */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200/60">
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-sky-500" />
                      <span className="text-xs font-semibold text-slate-600">Tanggal Pertemuan:</span>
                    </div>
                    <span className="text-xs sm:text-sm px-3.5 py-2 bg-white border border-slate-200 rounded-xl font-bold text-slate-700 shadow-xs">
                      {currentDay} {currentMonthName} {year}
                    </span>
                    
                    <select
                      value={attendanceClassFilter}
                      onChange={(e) => setAttendanceClassFilter(e.target.value)}
                      className="text-xs sm:text-sm px-3.5 py-2 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500/30 focus:border-sky-500 transition-all font-semibold text-slate-700 shadow-xs cursor-pointer"
                      id="attendance-class-filter"
                    >
                      <option value="Semua">Semua Kelas</option>
                      {classes.map(c => (
                        <option key={c.id} value={c.name}>{c.name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {isCurrentDateRecorded && (
                      <button
                        type="button"
                        onClick={() => {
                          setAbsensiToDeleteDate(attendanceDate);
                          setShowDeleteAbsensiModal(true);
                        }}
                        disabled={isSyncing || isDeletingAbsensi}
                        className="flex items-center gap-1.5 px-3 py-1.5 border border-rose-200 bg-rose-50/80 hover:bg-rose-100 hover:border-rose-300 text-rose-700 rounded-lg transition text-xs font-semibold shadow-2xs disabled:opacity-50 cursor-pointer"
                        id="btn-delete-attendance-date"
                        title="Hapus atau batalkan presensi yang sudah tersimpan untuk tanggal ini"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Hapus Presensi</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={handleMarkAllHadir}
                      className="px-3 py-1.5 bg-white border border-slate-200 hover:border-slate-300 text-slate-700 rounded-lg transition text-xs font-semibold shadow-xs cursor-pointer"
                      id="btn-mark-all-hadir"
                    >
                      Set Semua Hadir
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveAttendance}
                      disabled={isSyncing || filteredActivePesertaForAttendance.length === 0}
                      className="flex items-center gap-1.5 px-4 py-1.5 bg-sky-600 hover:bg-sky-700 text-white rounded-lg transition text-xs font-semibold shadow-sm disabled:opacity-50 cursor-pointer"
                      id="btn-save-attendance"
                    >
                      {isSyncing ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Save className="w-3.5 h-3.5" />
                      )}
                      Simpan Presensi
                    </button>
                  </div>
                </div>

                {/* List Absen Siswa */}
                <div className="overflow-x-auto border border-slate-100 rounded-xl bg-white shadow-xs">
                  <table className="w-full text-left border-collapse" id="table-attendance-extra">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-100 text-xs font-semibold text-slate-500 uppercase">
                        <th className="px-4 py-3">NIS</th>
                        <th className="px-4 py-3">Nama Lengkap</th>
                        <th className="px-4 py-3">Kelas</th>
                        <th className="px-4 py-3 text-center w-64">Status Kehadiran</th>
                        <th className="px-4 py-3">Keterangan / Catatan</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-sm">
                      {filteredActivePesertaForAttendance.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="px-4 py-8 text-center text-slate-400 text-xs">
                            Tidak ada peserta aktif terdaftar.
                          </td>
                        </tr>
                      ) : (
                        filteredActivePesertaForAttendance.map((p) => {
                          const localVal = localAttendanceMap[p.nis] || { status: 'Hadir', keterangan: '' };
                          return (
                            <tr key={p.nis} className="hover:bg-slate-50/50 transition">
                              <td className="px-4 py-3.5 font-mono text-xs font-semibold text-slate-600">{p.nis}</td>
                              <td className="px-4 py-3.5 font-medium text-slate-800">{p.nama}</td>
                              <td className="px-4 py-3.5 text-slate-600">{p.kelas}</td>
                              <td className="px-4 py-3.5 text-center">
                                <div className="inline-flex rounded-lg border border-slate-200 p-0.5 bg-slate-50">
                                  {(['Hadir', 'Sakit', 'Izin', 'Alfa'] as const).map((st) => (
                                    <button
                                      key={st}
                                      type="button"
                                      onClick={() => {
                                        setLocalAttendanceMap(prev => ({
                                          ...prev,
                                          [p.nis]: { ...prev[p.nis], status: st }
                                        }));
                                      }}
                                      className={`px-2.5 py-1 rounded-md text-xs font-semibold transition ${
                                        localVal.status === st
                                          ? st === 'Hadir'
                                            ? 'bg-emerald-500 text-white shadow-xs'
                                            : st === 'Sakit'
                                            ? 'bg-blue-500 text-white shadow-xs'
                                            : st === 'Izin'
                                            ? 'bg-amber-500 text-white shadow-xs'
                                            : 'bg-rose-500 text-white shadow-xs'
                                          : 'text-slate-500 hover:text-slate-800'
                                      }`}
                                    >
                                      {st}
                                    </button>
                                  ))}
                                </div>
                              </td>
                              <td className="px-4 py-3.5">
                                <input
                                  type="text"
                                  value={localVal.keterangan}
                                  onChange={(e) => {
                                    setLocalAttendanceMap(prev => ({
                                      ...prev,
                                      [p.nis]: { ...prev[p.nis], keterangan: e.target.value }
                                    }));
                                  }}
                                  placeholder="Masukkan keterangan (opsional)..."
                                  className="w-full text-xs px-2.5 py-1 bg-white border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-sky-500"
                                />
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>

                <div className="bg-sky-50 border border-sky-100 p-4 rounded-xl flex items-start gap-2.5 text-xs text-sky-800">
                  <AlertCircle className="w-4 h-4 text-sky-600 mt-0.5 shrink-0" />
                  <div>
                    <strong className="font-semibold">Petunjuk Presensi:</strong>
                    <p className="mt-0.5">
                      Gunakan filter tanggal di atas untuk mencatat presensi pada pertemuan tertentu. Tombol <strong>Set Semua Hadir</strong> membantu menandai seluruh siswa sebelum mengubah status siswa tertentu yang berhalangan hadir. Jangan lupa klik <strong>Simpan Presensi</strong> untuk mengirim perubahan ke Google Sheets.
                    </p>
                  </div>
                </div>
              </div>

              {/* Right Column: Month Calendar Attendance Tracker */}
              <div className="lg:col-span-1 bg-white p-5 rounded-2xl border border-slate-200/60 shadow-xs space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Status Absensi</h3>
                  <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-full text-[10px] font-bold">
                    {recordedDates.size} Sesi
                  </span>
                </div>
                
                {/* Calendar Card */}
                <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-100">
                  {/* Calendar Header with navigation */}
                  <div className="flex items-center justify-between mb-3">
                    <button
                      type="button"
                      onClick={handlePrevMonth}
                      className="p-1 hover:bg-slate-200 rounded-lg text-slate-500 transition-all"
                      title="Bulan Sebelumnya"
                    >
                      <ChevronLeft className="w-4 h-4 text-slate-600" />
                    </button>
                    <span className="text-xs font-extrabold text-slate-700">
                      {currentMonthName} {year}
                    </span>
                    <button
                      type="button"
                      onClick={handleNextMonth}
                      className="p-1 hover:bg-slate-200 rounded-lg text-slate-500 transition-all"
                      title="Bulan Selanjutnya"
                    >
                      <ChevronRight className="w-4 h-4 text-slate-600" />
                    </button>
                  </div>

                  {/* Days of Week */}
                  <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-bold text-slate-400 mb-1">
                    {['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'].map((d) => (
                      <div key={d} className="py-1">{d}</div>
                    ))}
                  </div>

                  {/* Calendar Grid */}
                  <div className="grid grid-cols-7 gap-1">
                    {calendarCells.map((cell, idx) => {
                      if (cell.dayNum === null) {
                        return <div key={`empty-${idx}`} className="aspect-square" />;
                      }
                      
                      return (
                        <button
                          key={cell.dateStr}
                          type="button"
                          onClick={() => handleSelectDay(cell.dayNum!)}
                          className={`aspect-square text-[11px] font-semibold rounded-lg flex flex-col items-center justify-center transition-all relative ${
                            cell.isActive 
                              ? 'ring-2 ring-sky-500 ring-offset-1 scale-105 z-10 font-bold bg-sky-50' 
                              : ''
                          } ${
                            cell.isRecorded
                              ? 'bg-emerald-500 hover:bg-emerald-600 text-white shadow-xs font-bold'
                              : 'bg-white border border-slate-200/60 hover:bg-slate-100 text-slate-600'
                          }`}
                        >
                          <span>{cell.dayNum}</span>
                          {cell.isRecorded && !cell.isActive && (
                            <span className="absolute bottom-0.5 w-1 h-1 bg-white rounded-full" />
                          )}
                          {cell.isRecorded && cell.isActive && (
                            <span className="absolute bottom-0.5 w-1 h-1 bg-sky-500 rounded-full" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Calendar Legend */}
                <div className="space-y-2 text-[11px] text-slate-500 border-t border-slate-100 pt-3">
                  <div className="flex items-center gap-2">
                    <div className="w-3.5 h-3.5 rounded-md bg-emerald-500" />
                    <span className="font-medium text-slate-600">Sudah Presensi (Hijau)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3.5 h-3.5 rounded-md border border-slate-200 bg-white" />
                    <span className="font-medium text-slate-600">Belum Ada Presensi</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3.5 h-3.5 rounded-md ring-2 ring-sky-500 bg-white" />
                    <span className="font-medium text-slate-600">Tanggal Terpilih</span>
                  </div>
                </div>

                <div className="p-3 bg-sky-50/50 border border-sky-100/60 rounded-xl text-[11px] text-sky-800 leading-relaxed">
                  <span className="font-bold text-sky-900">Petunjuk Cepat:</span> Klik pada tanggal di kalender untuk melihat atau mengedit absensi pada tanggal tersebut secara instan.
                </div>

                {/* Sesi Presensi Terrekam List */}
                <div className="pt-2 border-t border-slate-100 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-slate-700">Daftar Sesi Terrekam</h4>
                    <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                      {recordedSessionsList.length} Tanggal
                    </span>
                  </div>

                  {recordedSessionsList.length === 0 ? (
                    <p className="text-[11px] text-slate-400 italic">Belum ada sesi presensi tersimpan.</p>
                  ) : (
                    <div className="max-h-52 overflow-y-auto space-y-1.5 pr-1">
                      {recordedSessionsList.map(session => {
                        const isSelected = session.tanggal === attendanceDate;
                        return (
                          <div 
                            key={session.tanggal} 
                            className={`flex items-center justify-between p-2 rounded-xl text-xs transition border ${
                              isSelected 
                                ? 'bg-sky-50 border-sky-200' 
                                : 'bg-slate-50 border-slate-100 hover:bg-slate-100/80'
                            }`}
                          >
                            <div className="min-w-0 flex-1">
                              <div className="font-bold text-slate-700 truncate">{session.tanggal}</div>
                              <div className="text-[10px] text-slate-500 font-medium">
                                {session.hadirCount}/{session.totalCount} Siswa Hadir
                              </div>
                            </div>
                            <div className="flex items-center gap-1 shrink-0 ml-2">
                              <button
                                type="button"
                                onClick={() => setAttendanceDate(session.tanggal)}
                                className={`px-2 py-1 rounded text-[10px] font-bold transition cursor-pointer ${
                                  isSelected
                                    ? 'bg-sky-600 text-white'
                                    : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                                }`}
                              >
                                Lihat
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setAbsensiToDeleteDate(session.tanggal);
                                  setShowDeleteAbsensiModal(true);
                                }}
                                className="p-1 text-rose-500 hover:bg-rose-50 hover:text-rose-700 rounded transition cursor-pointer"
                                title="Hapus / batalkan sesi presensi ini"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

            </div>
          </div>
        )}

        {/* SUB TAB 3: NILAI EXTRA */}
        {activeSubTab === 'nilai' && (
          <div className="space-y-6">
            {/* Control Panel Nilai */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200/60">
              <div className="flex items-center gap-3">
                <span className="text-xs font-semibold text-slate-600">Filter Kelas:</span>
                <select
                  value={gradeClassFilter}
                  onChange={(e) => setGradeClassFilter(e.target.value)}
                  className="text-xs sm:text-sm px-3.5 py-2 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500/30 focus:border-sky-500 transition-all font-semibold text-slate-700 shadow-xs cursor-pointer"
                  id="grade-class-filter"
                >
                  <option value="Semua">Semua Kelas</option>
                  {classes.map(c => (
                    <option key={c.id} value={c.name}>{c.name}</option>
                  ))}
                </select>
              </div>

              <button
                onClick={handleSaveGrades}
                disabled={isSyncing || filteredActivePesertaForGrade.length === 0}
                className="flex items-center justify-center gap-1.5 px-4 py-1.5 bg-sky-600 hover:bg-sky-700 text-white rounded-lg transition text-xs font-semibold shadow-sm disabled:opacity-50"
                id="btn-save-grades"
              >
                {isSyncing ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Save className="w-3.5 h-3.5" />
                )}
                Simpan Nilai Extra
              </button>
            </div>

            {/* List Nilai Siswa */}
            <div className="overflow-x-auto border border-slate-100 rounded-xl">
              <table className="w-full text-left border-collapse" id="table-grades-extra">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100 text-xs font-semibold text-slate-500 uppercase">
                    <th className="px-4 py-3">NIS</th>
                    <th className="px-4 py-3">Nama Lengkap</th>
                    <th className="px-4 py-3">Kelas</th>
                    <th className="px-4 py-3 text-center w-36">Kehadiran (H/S/I/A)</th>
                    <th className="px-4 py-3 text-center w-28">Nilai Tugas</th>
                    <th className="px-4 py-3 text-center w-28">Nilai Praktik</th>
                    <th className="px-4 py-3 text-center w-28">Nilai Teori</th>
                    <th className="px-4 py-3 text-center w-24">Rata-rata</th>
                    <th className="px-4 py-3 text-center w-20">Predikat</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {filteredActivePesertaForGrade.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="px-4 py-8 text-center text-slate-400 text-xs">
                        Tidak ada peserta aktif terdaftar.
                      </td>
                    </tr>
                  ) : (
                    filteredActivePesertaForGrade.map((p) => {
                      const localVal = localGradesMap[p.nis] || { tugas: null, praktik: null, teori: null };
                      const avg = calculateRataRata(localVal.tugas, localVal.praktik, localVal.teori);
                      const pred = calculatePredikat(avg);
                      
                      const stats = attendanceStats[p.nis] || { hadir: 0, sakit: 0, izin: 0, alfa: 0, total: 0, percentage: 0 };

                      const getPredikatBadgeStyle = (pr: string) => {
                        if (pr === 'A' || pr === 'B') return 'bg-emerald-50 text-emerald-700 border-emerald-150';
                        if (pr === 'C') return 'bg-blue-50 text-blue-700 border-blue-150';
                        if (pr === 'D') return 'bg-amber-50 text-amber-700 border-amber-150';
                        if (pr === 'E') return 'bg-rose-50 text-rose-700 border-rose-150';
                        return 'bg-slate-50 text-slate-400 border-slate-100';
                      };

                      return (
                        <tr key={p.nis} className="hover:bg-slate-50/50 transition">
                          <td className="px-4 py-3.5 font-mono text-xs font-semibold text-slate-600">{p.nis}</td>
                          <td className="px-4 py-3.5 font-medium text-slate-800">{p.nama}</td>
                          <td className="px-4 py-3.5 text-slate-600">{p.kelas}</td>
                          <td className="px-4 py-3.5 text-center text-xs">
                            <span className="font-bold text-slate-700">
                              {stats.percentage}%
                            </span>
                            <span className="text-[10px] text-slate-500 block font-semibold">
                              ({stats.hadir}H/{stats.sakit}S/{stats.izin}I/{stats.alfa}A)
                            </span>
                          </td>
                          <td className="px-4 py-3.5 text-center">
                            <input
                              type="number"
                              min="0"
                              max="100"
                              placeholder="0-100"
                              value={localVal.tugas !== null ? localVal.tugas : ''}
                              onChange={(e) => {
                                const val = e.target.value === '' ? null : Math.min(100, Math.max(0, parseInt(e.target.value) || 0));
                                setLocalGradesMap(prev => ({
                                  ...prev,
                                  [p.nis]: { ...prev[p.nis], tugas: val }
                                }));
                              }}
                              className="w-20 text-center text-xs px-2 py-1 bg-white border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-sky-500 font-semibold"
                            />
                          </td>
                          <td className="px-4 py-3.5 text-center">
                            <input
                              type="number"
                              min="0"
                              max="100"
                              placeholder="0-100"
                              value={localVal.praktik !== null ? localVal.praktik : ''}
                              onChange={(e) => {
                                const val = e.target.value === '' ? null : Math.min(100, Math.max(0, parseInt(e.target.value) || 0));
                                setLocalGradesMap(prev => ({
                                  ...prev,
                                  [p.nis]: { ...prev[p.nis], praktik: val }
                                }));
                              }}
                              className="w-20 text-center text-xs px-2 py-1 bg-white border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-sky-500 font-semibold"
                            />
                          </td>
                          <td className="px-4 py-3.5 text-center">
                            <input
                              type="number"
                              min="0"
                              max="100"
                              placeholder="0-100"
                              value={localVal.teori !== null ? localVal.teori : ''}
                              onChange={(e) => {
                                const val = e.target.value === '' ? null : Math.min(100, Math.max(0, parseInt(e.target.value) || 0));
                                setLocalGradesMap(prev => ({
                                  ...prev,
                                  [p.nis]: { ...prev[p.nis], teori: val }
                                }));
                              }}
                              className="w-20 text-center text-xs px-2 py-1 bg-white border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-sky-500 font-semibold"
                            />
                          </td>
                          <td className="px-4 py-3.5 text-center font-bold text-slate-700 font-mono">
                            {avg !== null ? avg : '-'}
                          </td>
                          <td className="px-4 py-3.5 text-center">
                            <span className={`inline-block px-2.5 py-0.5 rounded-md text-xs font-bold border ${getPredikatBadgeStyle(pred)}`}>
                              {pred}
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            <div className="bg-amber-50 border border-amber-100 p-4 rounded-xl flex items-start gap-2.5 text-xs text-amber-800">
              <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
              <div>
                <strong className="font-semibold">Skema Penilaian Predikat:</strong>
                <p className="mt-0.5">
                  Rata-rata dihitung dari total nilai Tugas, Praktik, dan Teori yang diinput. Aturan predikat: <strong className="text-amber-900">A</strong> (85 - 100), <strong className="text-amber-900">B</strong> (75 - 84), <strong className="text-amber-900">C</strong> (60 - 74), <strong className="text-amber-900">D</strong> (45 - 59), dan <strong className="text-amber-900">E</strong> (&lt; 45). Pastikan Anda mengklik tombol <strong>Simpan Nilai Extra</strong> untuk mengunggah nilai ke Google Sheets.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* SUB TAB 4: REKAP ABSENSI EXTRA */}
        {activeSubTab === 'rekap' && (
          <div className="space-y-6">
            {/* Control Panel & Stats Summary */}
            <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200/60">
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-slate-600">Filter Kelas:</span>
                  <select
                    value={rekapClassFilter}
                    onChange={(e) => setRekapClassFilter(e.target.value)}
                    className="text-xs sm:text-sm px-3.5 py-2 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500/30 focus:border-sky-500 transition-all font-semibold text-slate-700 shadow-xs cursor-pointer"
                    id="rekap-class-filter"
                  >
                    <option value="Semua">Semua Kelas</option>
                    {classes.map(c => (
                      <option key={c.id} value={c.name}>{c.name}</option>
                    ))}
                  </select>
                </div>

                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-slate-400">
                    <Search className="w-3.5 h-3.5" />
                  </span>
                  <input
                    type="text"
                    placeholder="Cari nama / NIS..."
                    value={rekapSearch}
                    onChange={(e) => setRekapSearch(e.target.value)}
                    className="pl-9.5 pr-4 py-2 text-xs sm:text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500/30 focus:border-sky-500 transition-all text-slate-700 shadow-xs w-48 sm:w-64"
                    id="rekap-search-input"
                  />
                </div>
              </div>

              {/* Summary Badges */}
              <div className="flex items-center gap-3 self-end lg:self-center text-xs">
                <div className="bg-white border border-slate-200 px-3 py-1.5 rounded-lg text-slate-600 font-semibold shadow-xs">
                  Siswa Aktif: <span className="text-sky-600 font-bold">{filteredActivePesertaForRekap.length}</span>
                </div>
                <div className="bg-white border border-slate-200 px-3 py-1.5 rounded-lg text-slate-600 font-semibold shadow-xs">
                  Total Pertemuan: <span className="text-sky-600 font-bold">{new Set(extraTikAbsensi.map(a => a.tanggal)).size} Sesi</span>
                </div>
              </div>
            </div>

            {/* List Rekap Absen Siswa */}
            <div className="overflow-x-auto border border-slate-100 rounded-xl">
              <table className="w-full text-left border-collapse" id="table-rekap-absensi-extra">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100 text-xs font-semibold text-slate-500 uppercase">
                    <th className="px-4 py-3">NIS</th>
                    <th className="px-4 py-3">Nama Lengkap</th>
                    <th className="px-4 py-3">Kelas</th>
                    <th className="px-4 py-3 text-center">Hadir (H)</th>
                    <th className="px-4 py-3 text-center">Sakit (S)</th>
                    <th className="px-4 py-3 text-center">Izin (I)</th>
                    <th className="px-4 py-3 text-center">Alfa (A)</th>
                    <th className="px-4 py-3 text-center">Total Input</th>
                    <th className="px-4 py-3 text-center w-36">Persentase Kehadiran</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {filteredActivePesertaForRekap.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="px-4 py-8 text-center text-slate-400 text-xs">
                        Tidak ada data rekapitulasi.
                      </td>
                    </tr>
                  ) : (
                    filteredActivePesertaForRekap.map((p) => {
                      const stats = attendanceStats[p.nis] || { hadir: 0, sakit: 0, izin: 0, alfa: 0, total: 0, percentage: 0 };
                      
                      const getPercentageBadgeColor = (percentage: number) => {
                        if (percentage >= 85) return 'bg-emerald-50 text-emerald-700 border-emerald-150';
                        if (percentage >= 70) return 'bg-blue-50 text-blue-700 border-blue-150';
                        if (percentage >= 50) return 'bg-amber-50 text-amber-700 border-amber-150';
                        return 'bg-rose-50 text-rose-700 border-rose-150';
                      };

                      return (
                        <tr key={p.nis} className="hover:bg-slate-50/50 transition">
                          <td className="px-4 py-3.5 font-mono text-xs font-semibold text-slate-600">{p.nis}</td>
                          <td className="px-4 py-3.5 font-medium text-slate-800">{p.nama}</td>
                          <td className="px-4 py-3.5 text-slate-600">{p.kelas}</td>
                          <td className="px-4 py-3.5 text-center text-emerald-600 font-bold font-mono">{stats.hadir}</td>
                          <td className="px-4 py-3.5 text-center text-blue-600 font-bold font-mono">{stats.sakit}</td>
                          <td className="px-4 py-3.5 text-center text-amber-600 font-bold font-mono">{stats.izin}</td>
                          <td className="px-4 py-3.5 text-center text-rose-600 font-bold font-mono">{stats.alfa}</td>
                          <td className="px-4 py-3.5 text-center text-slate-500 font-mono">{stats.total}</td>
                          <td className="px-4 py-3.5 text-center">
                            <div className="flex items-center gap-2 justify-center">
                              <span className={`inline-block px-2 py-0.5 rounded-md text-xs font-bold border ${getPercentageBadgeColor(stats.percentage)}`}>
                                {stats.percentage}%
                              </span>
                              <div className="w-16 bg-slate-100 rounded-full h-1.5 hidden sm:block overflow-hidden">
                                <div 
                                  className={`h-1.5 rounded-full ${
                                    stats.percentage >= 85 ? 'bg-emerald-500' :
                                    stats.percentage >= 70 ? 'bg-blue-500' :
                                    stats.percentage >= 50 ? 'bg-amber-500' : 'bg-rose-500'
                                  }`}
                                  style={{ width: `${stats.percentage}%` }}
                                />
                              </div>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            <div className="bg-sky-50 border border-sky-100 p-4 rounded-xl flex items-start gap-2.5 text-xs text-sky-800">
              <AlertCircle className="w-4 h-4 text-sky-600 mt-0.5 shrink-0" />
              <div>
                <strong className="font-semibold">Sistem Penghitungan Kehadiran Extra:</strong>
                <p className="mt-0.5">
                  Persentase Kehadiran dihitung berdasarkan rumus: <code className="font-mono bg-sky-100/80 px-1 py-0.5 rounded text-sky-900 font-semibold">(Jumlah Hadir / Total Pertemuan yang Diinput) * 100%</code>. Jika belum ada pertemuan yang dicatat untuk siswa bersangkutan, persentase default bernilai 0%.
                </p>
              </div>
            </div>
          </div>
        )}
        
      </div>

      {/* Custom Confirmation Dialog for Participant Deletion */}
      {deleteConfirmNis && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl max-w-md w-full border border-slate-100 shadow-2xl p-6 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-rose-50 rounded-full text-rose-600 shrink-0">
                <Trash2 className="w-6 h-6 animate-pulse" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-slate-800">Hapus Peserta Ekstrakurikuler TIK</h3>
                <p className="text-xs sm:text-sm text-slate-500 leading-relaxed">
                  Apakah Anda yakin ingin menghapus siswa{' '}
                  <strong className="text-slate-800">
                    {resolvedExtraTikPeserta.find(p => p.nis === deleteConfirmNis)?.nama || 'Siswa'}
                  </strong>{' '}
                  ({deleteConfirmNis}) dari pendataan Ekstrakurikuler TIK? Tindakan ini akan menghapus data pendaftarannya secara permanen.
                </p>
              </div>
            </div>

            <div className="mt-6 flex items-center justify-end gap-3 border-t border-slate-100 pt-4">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setDeleteConfirmNis(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition font-medium text-xs sm:text-sm disabled:opacity-50 cursor-pointer"
                id="btn-cancel-delete-peserta"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleConfirmDeleteParticipant}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl transition font-semibold text-xs sm:text-sm flex items-center gap-2 shadow-sm disabled:opacity-50 cursor-pointer"
                id="btn-confirm-delete-peserta"
              >
                {isDeleting ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Menghapus...</span>
                  </>
                ) : (
                  <span>Ya, Hapus</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Custom Confirmation Dialog for Attendance Deletion */}
      {showDeleteAbsensiModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl max-w-md w-full border border-slate-100 shadow-2xl p-6 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-rose-50 rounded-full text-rose-600 shrink-0">
                <Trash2 className="w-6 h-6 animate-pulse" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-slate-800">Hapus / Batalkan Presensi Extra TIK</h3>
                <p className="text-xs sm:text-sm text-slate-500 leading-relaxed">
                  Apakah Anda yakin ingin menghapus / membatalkan data presensi Extra TIK pada tanggal{' '}
                  <strong className="text-slate-800">{absensiToDeleteDate || attendanceDate}</strong>
                  {attendanceClassFilter !== 'Semua' ? ` (Kelas: ${attendanceClassFilter})` : ''}? Seluruh data presensi siswa pada tanggal ini akan dihapus permanen.
                </p>
              </div>
            </div>

            <div className="mt-6 flex items-center justify-end gap-3 border-t border-slate-100 pt-4">
              <button
                type="button"
                disabled={isDeletingAbsensi}
                onClick={() => {
                  setShowDeleteAbsensiModal(false);
                  setAbsensiToDeleteDate(null);
                }}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition font-medium text-xs sm:text-sm disabled:opacity-50 cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={isDeletingAbsensi}
                onClick={handleConfirmDeleteAbsensi}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl transition font-semibold text-xs sm:text-sm flex items-center gap-2 shadow-sm disabled:opacity-50 cursor-pointer"
              >
                {isDeletingAbsensi ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Menghapus...</span>
                  </>
                ) : (
                  <span>Ya, Hapus Presensi</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
