import React, { useState, useMemo } from 'react';
import { 
  Student, 
  GradeAttitude, 
  MonthlyRecap, 
  StudentNote, 
  AttendanceRecord,
  GradeWeightConfig 
} from '../types';
import { 
  calculateAttitudeScore, 
  getPredikatInfo,
  DEFAULT_GRADE_WEIGHTS 
} from '../utils/gradeCalculator';
import { 
  Sparkles, 
  Search, 
  Save, 
  RotateCcw, 
  Check, 
  AlertCircle, 
  Info, 
  HelpCircle, 
  User, 
  Edit3, 
  Award, 
  ShieldCheck, 
  TrendingUp, 
  AlertTriangle,
  Clock,
  ThumbsUp,
  ThumbsDown,
  Loader2,
  ChevronDown,
  ChevronUp,
  HeartHandshake
} from 'lucide-react';

interface AttitudeGradesViewProps {
  students: Student[];
  attitudeGrades: GradeAttitude[];
  recap: MonthlyRecap[];
  studentNotes: StudentNote[];
  attendance: AttendanceRecord[];
  gradeWeights?: GradeWeightConfig;
  onSaveAttitude?: (records: GradeAttitude[]) => Promise<void>;
  selectedSemester?: 1 | 2;
  activeClassName?: string;
  onSelectStudent?: (student: Student) => void;
}

const getStudentPhotoUrl = (foto?: string) => foto || undefined;
const handleStudentPhotoError = (e: any, ..._args: any[]) => {
  if (e?.currentTarget) {
    e.currentTarget.style.display = 'none';
  }
};

export default function AttitudeGradesView({
  students,
  attitudeGrades,
  recap,
  studentNotes,
  attendance,
  gradeWeights = DEFAULT_GRADE_WEIGHTS,
  onSaveAttitude,
  selectedSemester = 1,
  activeClassName = 'Kelas',
  onSelectStudent
}: AttitudeGradesViewProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterPredicate, setFilterPredicate] = useState<'all' | 'A' | 'B' | 'C' | 'D' | 'override'>('all');
  const [localAttitude, setLocalAttitude] = useState<GradeAttitude[]>(attitudeGrades);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [showMechanismDetails, setShowMechanismDetails] = useState(false);
  const [selectedStudentForModal, setSelectedStudentForModal] = useState<Student | null>(null);

  // Synchronize incoming attitudeGrades when prop changes
  React.useEffect(() => {
    setLocalAttitude(attitudeGrades);
  }, [attitudeGrades]);

  // Compute calculated student attitude rows
  const calculatedRows = useMemo(() => {
    return students.map((s, idx) => {
      const studentRecap = recap.find(r => r.nis === s.nis);
      const studentAbs = attendance.filter(a => a.nis === s.nis);
      const notes = studentNotes.filter(n => n.nis === s.nis);
      const activeNotesCount = notes.filter(n => n.tipe === 'aktif').length;
      const problemNotesCount = notes.filter(n => n.tipe === 'bermasalah').length;
      const attRecord = localAttitude.find(a => a.nis === s.nis);

      // Raw attendance percentage
      let attendancePct = 0;
      let lateCount = 0;
      if (studentRecap) {
        attendancePct = Math.round((studentRecap.persentaseKehadiran || 0) * 100);
        lateCount = studentRecap.terlambatCount || 0;
      } else if (studentAbs.length > 0) {
        const hadir = studentAbs.filter(a => a.status === 'Hadir').length;
        attendancePct = Math.round((hadir / studentAbs.length) * 100);
        lateCount = studentAbs.filter(a => (a.terlambat && a.terlambat > 0) || a.keterangan?.toLowerCase().includes('terlambat')).length;
      }

      // Automated calculation
      const autoScore = calculateAttitudeScore(
        s.nis,
        [], // pass empty to force automated formula calculation
        studentNotes,
        recap,
        attendance
      );

      // Final effective score (manual override if specified)
      const hasManualOverride = attRecord?.manualScore !== undefined && attRecord?.manualScore !== null && !isNaN(Number(attRecord.manualScore));
      const effectiveScore = hasManualOverride
        ? Math.min(100, Math.max(0, Number(attRecord?.manualScore)))
        : autoScore;

      const predikatInfo = getPredikatInfo(effectiveScore);

      return {
        student: s,
        nis: s.nis,
        nama: s.nama,
        noAbsen: s.noAbsen || String(idx + 1),
        attendancePct,
        lateCount,
        activeNotesCount,
        problemNotesCount,
        autoScore,
        manualScore: attRecord?.manualScore ?? null,
        hasManualOverride,
        effectiveScore,
        predikat: predikatInfo.predikat,
        predikatLengkap: predikatInfo.predikatLengkap,
        deskripsi: predikatInfo.deskripsi,
        catatanSikap: attRecord?.catatanSikap || ''
      };
    });
  }, [students, localAttitude, recap, studentNotes, attendance]);

  // Filtered rows
  const filteredRows = useMemo(() => {
    return calculatedRows.filter(row => {
      const matchesSearch = 
        row.nama.toLowerCase().includes(searchQuery.toLowerCase()) ||
        row.nis.includes(searchQuery) ||
        row.noAbsen.includes(searchQuery);

      if (!matchesSearch) return false;

      if (filterPredicate === 'all') return true;
      if (filterPredicate === 'override') return row.hasManualOverride;
      return row.predikat === filterPredicate;
    });
  }, [calculatedRows, searchQuery, filterPredicate]);

  // Class Summary Statistics
  const stats = useMemo(() => {
    if (calculatedRows.length === 0) return { avg: 0, countA: 0, countB: 0, countC: 0, countD: 0, countOverride: 0 };
    const validRows = calculatedRows.filter(r => !isNaN(Number(r.effectiveScore)) && Number(r.effectiveScore) > 0);
    const total = validRows.reduce((acc, curr) => acc + (Number(curr.effectiveScore) || 0), 0);
    const rawAvg = validRows.length > 0 ? total / validRows.length : 0;
    const avg = isNaN(rawAvg) ? 0 : parseFloat(rawAvg.toFixed(1));
    const countA = calculatedRows.filter(r => r.predikat === 'A').length;
    const countB = calculatedRows.filter(r => r.predikat === 'B').length;
    const countC = calculatedRows.filter(r => r.predikat === 'C').length;
    const countD = calculatedRows.filter(r => r.predikat === 'D').length;
    const countOverride = calculatedRows.filter(r => r.hasManualOverride).length;
    return { avg, countA, countB, countC, countD, countOverride };
  }, [calculatedRows]);

  // Handlers for manual score change
  const handleScoreChange = (nis: string, studentName: string, value: string) => {
    setLocalAttitude(prev => {
      const copy = [...prev];
      const idx = copy.findIndex(a => a.nis === nis);
      const valNum = value === '' ? null : Number(value);

      if (idx >= 0) {
        copy[idx] = {
          ...copy[idx],
          manualScore: valNum !== null && !isNaN(valNum) ? Math.min(100, Math.max(0, valNum)) : null,
          updatedAt: new Date().toISOString()
        };
      } else {
        copy.push({
          nis,
          nama: studentName,
          kelas: activeClassName,
          semester: selectedSemester,
          manualScore: valNum !== null && !isNaN(valNum) ? Math.min(100, Math.max(0, valNum)) : null,
          updatedAt: new Date().toISOString()
        });
      }
      return copy;
    });
  };

  const handleResetToAuto = (nis: string) => {
    setLocalAttitude(prev => {
      const copy = [...prev];
      const idx = copy.findIndex(a => a.nis === nis);
      if (idx >= 0) {
        copy[idx] = {
          ...copy[idx],
          manualScore: null,
          updatedAt: new Date().toISOString()
        };
      }
      return copy;
    });
  };

  const handleCatatanSikapChange = (nis: string, studentName: string, catatan: string) => {
    setLocalAttitude(prev => {
      const copy = [...prev];
      const idx = copy.findIndex(a => a.nis === nis);
      if (idx >= 0) {
        copy[idx] = {
          ...copy[idx],
          catatanSikap: catatan,
          updatedAt: new Date().toISOString()
        };
      } else {
        copy.push({
          nis,
          nama: studentName,
          kelas: activeClassName,
          semester: selectedSemester,
          manualScore: null,
          catatanSikap: catatan,
          updatedAt: new Date().toISOString()
        });
      }
      return copy;
    });
  };

  const handleSaveAll = async () => {
    if (!onSaveAttitude) return;
    setIsSaving(true);
    try {
      await onSaveAttitude(localAttitude);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      console.error('Error saving attitude grades:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const sikapBobot = gradeWeights?.sikap ?? 10;

  return (
    <div className="space-y-6">
      {/* Top Banner: Explanation & Mechanism Info */}
      <div className="bg-gradient-to-br from-indigo-900 via-indigo-850 to-slate-900 text-white p-5 lg:p-6 rounded-3xl shadow-lg border border-indigo-700/40 relative overflow-hidden">
        <div className="absolute right-0 top-0 translate-x-8 -translate-y-8 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-5">
          <div className="space-y-2">
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="px-3 py-1 bg-indigo-500/30 border border-indigo-400/40 text-indigo-200 rounded-xl text-xs font-black tracking-wider uppercase flex items-center gap-1.5">
                <HeartHandshake className="w-4 h-4 text-indigo-300" />
                Penilaian Sikap &amp; Karakter
              </span>
              <span className="px-3 py-1 bg-amber-500/20 border border-amber-400/30 text-amber-300 rounded-xl text-xs font-black">
                Bobot Nilai Akhir: {sikapBobot}%
              </span>
              <span className="px-3 py-1 bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 rounded-xl text-xs font-black flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5" />
                Otomatisasi Cerdas Berbasis Data
              </span>
            </div>
            
            <h3 className="text-xl lg:text-2xl font-black text-white tracking-tight">
              Mekanisme Penilaian Sikap Terpadu
            </h3>
            <p className="text-xs lg:text-sm text-indigo-200/90 max-w-3xl leading-relaxed">
              Sistem secara otomatis menghitung nilai sikap siswa berdasarkan <strong>Disiplin Presensi</strong> (kehadiran &amp; keterlambatan) serta <strong>Catatan Karakter Kelas</strong> (keaktifan &amp; pelanggaran). Guru tetap dapat melakukan penyesuaian nilai manual kapan saja.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={() => setShowMechanismDetails(!showMechanismDetails)}
              className="px-4 py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-bold transition flex items-center gap-2 border border-white/10 cursor-pointer active:scale-95"
            >
              <Info className="w-4 h-4 text-indigo-300" />
              <span>{showMechanismDetails ? 'Sembunyikan Rumus' : 'Lihat Rumus & Logika'}</span>
              {showMechanismDetails ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>

            <button
              type="button"
              onClick={handleSaveAll}
              disabled={isSaving || students.length === 0}
              className="px-5 py-2.5 bg-emerald-500 hover:bg-emerald-600 disabled:bg-slate-700 text-white rounded-xl text-xs lg:text-sm font-black transition flex items-center gap-2 shadow-md cursor-pointer active:scale-95"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Menyimpan...</span>
                </>
              ) : saveSuccess ? (
                <>
                  <Check className="w-4 h-4" />
                  <span>Tersimpan!</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>Simpan Nilai Sikap</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Collapsible Detailed Formula Card */}
        {showMechanismDetails && (
          <div className="mt-5 pt-5 border-t border-indigo-700/60 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 animate-in fade-in duration-200">
            <div className="bg-white/5 border border-white/10 p-3.5 rounded-2xl space-y-1.5">
              <div className="flex items-center gap-2 text-indigo-300 font-bold text-xs">
                <Sparkles className="w-4 h-4 text-amber-300" />
                <span>1. Baseline Nilai</span>
              </div>
              <p className="text-xl font-black text-white">85.0 Poin</p>
              <p className="text-[11px] text-indigo-200/80 leading-snug">
                Nilai dasar awal setiap siswa adalah predikat <strong>Baik (B)</strong> sebelum penambahan/pengurangan.
              </p>
            </div>

            <div className="bg-white/5 border border-white/10 p-3.5 rounded-2xl space-y-1.5">
              <div className="flex items-center gap-2 text-emerald-300 font-bold text-xs">
                <TrendingUp className="w-4 h-4 text-emerald-400" />
                <span>2. Presensi &amp; Disiplin</span>
              </div>
              <p className="text-xs font-bold text-white">Bonus / Pengurangan</p>
              <ul className="text-[11px] text-indigo-200/80 space-y-0.5">
                <li>• Kehadiran &ge;95%: <strong>+3.0 poin</strong></li>
                <li>• Kehadiran &ge;90%: <strong>+1.5 poin</strong></li>
                <li>• Kehadiran &lt;80%: <strong>-5.0 poin</strong> (&lt;70%: <strong>-10</strong>)</li>
                <li>• Terlambat: <strong>-1.5 poin</strong> / kejadian</li>
              </ul>
            </div>

            <div className="bg-white/5 border border-white/10 p-3.5 rounded-2xl space-y-1.5">
              <div className="flex items-center gap-2 text-amber-300 font-bold text-xs">
                <ThumbsUp className="w-4 h-4 text-amber-400" />
                <span>3. Catatan Karakter</span>
              </div>
              <p className="text-xs font-bold text-white">Apresiasi &amp; Koreksi</p>
              <ul className="text-[11px] text-indigo-200/80 space-y-0.5">
                <li>• Catatan Aktif/Positif: <strong>+3.0 poin</strong> (maks +10)</li>
                <li>• Catatan Masalah: <strong>-5.0 poin</strong> / catatan</li>
                <li>• Rentang Skor: <strong>50.0 s/d 100.0</strong></li>
              </ul>
            </div>

            <div className="bg-white/5 border border-white/10 p-3.5 rounded-2xl space-y-1.5">
              <div className="flex items-center gap-2 text-rose-300 font-bold text-xs">
                <Edit3 className="w-4 h-4 text-rose-400" />
                <span>4. Override Manual Guru</span>
              </div>
              <p className="text-xs font-bold text-white">Kewenangan Penuh Guru</p>
              <p className="text-[11px] text-indigo-200/80 leading-snug">
                Guru dapat memasukkan nilai manual pada kolom <strong>Nilai Manual</strong> jika terdapat evaluasi observasi langsung.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Class Statistics Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs">
          <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Rata-Rata Sikap</p>
          <p className="text-xl font-black text-indigo-600 mt-0.5">{isNaN(stats.avg) ? '0' : stats.avg}</p>
          <p className="text-[10px] text-slate-500 font-bold">Kelas {activeClassName}</p>
        </div>

        <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs">
          <p className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-600">Sangat Baik (A)</p>
          <p className="text-xl font-black text-emerald-600 mt-0.5">{stats.countA} <span className="text-xs font-medium text-slate-400">siswa</span></p>
          <p className="text-[10px] text-slate-500 font-bold">Nilai &ge; 88</p>
        </div>

        <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs">
          <p className="text-[10px] font-extrabold uppercase tracking-wider text-blue-600">Baik (B)</p>
          <p className="text-xl font-black text-blue-600 mt-0.5">{stats.countB} <span className="text-xs font-medium text-slate-400">siswa</span></p>
          <p className="text-[10px] text-slate-500 font-bold">Nilai 78 - 87.9</p>
        </div>

        <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs">
          <p className="text-[10px] font-extrabold uppercase tracking-wider text-amber-600">Cukup (C)</p>
          <p className="text-xl font-black text-amber-600 mt-0.5">{stats.countC} <span className="text-xs font-medium text-slate-400">siswa</span></p>
          <p className="text-[10px] text-slate-500 font-bold">Nilai 68 - 77.9</p>
        </div>

        <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs">
          <p className="text-[10px] font-extrabold uppercase tracking-wider text-rose-600">Bimbingan (D)</p>
          <p className="text-xl font-black text-rose-600 mt-0.5">{stats.countD} <span className="text-xs font-medium text-slate-400">siswa</span></p>
          <p className="text-[10px] text-slate-500 font-bold">Nilai &lt; 68</p>
        </div>

        <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs">
          <p className="text-[10px] font-extrabold uppercase tracking-wider text-purple-600">Override Guru</p>
          <p className="text-xl font-black text-purple-600 mt-0.5">{stats.countOverride} <span className="text-xs font-medium text-slate-400">siswa</span></p>
          <p className="text-[10px] text-slate-500 font-bold">Manual Setting</p>
        </div>
      </div>

      {/* Main Table Card */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
        {/* Filter & Search Header */}
        <div className="p-4 lg:p-5 border-b border-slate-200 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="relative w-full md:w-80">
            <input
              type="text"
              placeholder="Cari siswa, NIS, atau nomor absen..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 text-xs lg:text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50/50"
            />
            <Search className="absolute left-3 top-3 text-slate-400 w-4 h-4" />
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto justify-end">
            <span className="text-xs font-bold text-slate-500 mr-1">Filter Predikat:</span>
            {(['all', 'A', 'B', 'C', 'D', 'override'] as const).map(p => (
              <button
                key={p}
                type="button"
                onClick={() => setFilterPredicate(p)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                  filterPredicate === p
                    ? 'bg-indigo-600 text-white shadow-2xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {p === 'all' ? 'Semua' : p === 'override' ? 'Override Manual' : `Predikat ${p}`}
              </button>
            ))}
          </div>
        </div>

        {/* Table Content */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/80 text-slate-600 font-black text-xs uppercase tracking-wider border-b border-slate-200">
                <th className="py-3.5 px-4 text-center w-14">No</th>
                <th className="py-3.5 px-4">Siswa</th>
                <th className="py-3.5 px-3 text-center">Kehadiran</th>
                <th className="py-3.5 px-3 text-center">Disiplin Jam</th>
                <th className="py-3.5 px-3 text-center">Catatan Positif</th>
                <th className="py-3.5 px-3 text-center">Catatan Masalah</th>
                <th className="py-3.5 px-3 text-center bg-indigo-50/40">Skor Otomatis</th>
                <th className="py-3.5 px-3 text-center bg-purple-50/40">Override Manual</th>
                <th className="py-3.5 px-4 text-center bg-indigo-50/80">Nilai Efektif</th>
                <th className="py-3.5 px-4 text-center">Predikat</th>
                <th className="py-3.5 px-4">Catatan Perkembangan Karakter</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={11} className="py-12 text-center text-slate-400 font-bold">
                    Tidak ditemukan data siswa yang sesuai.
                  </td>
                </tr>
              ) : (
                filteredRows.map((row, idx) => {
                  const matchingStudent = row.student;
                  const photoUrl = matchingStudent?.foto || localStorage.getItem(`student_photo_${row.nis}`);

                  return (
                    <tr key={row.nis} className="hover:bg-slate-50/70 transition">
                      {/* No Absen */}
                      <td className="py-3.5 px-4 text-center font-bold text-slate-500">
                        {row.noAbsen}
                      </td>

                      {/* Siswa Photo & Info */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          {photoUrl ? (
                            <img
                              src={getStudentPhotoUrl(photoUrl)}
                              alt={row.nama}
                              referrerPolicy="no-referrer"
                              onError={(e) => handleStudentPhotoError(e, photoUrl)}
                              className="w-9 h-9 object-cover rounded-full border border-slate-200 shrink-0"
                            />
                          ) : (
                            <div className="w-9 h-9 bg-slate-100 rounded-full border border-slate-200 flex items-center justify-center text-slate-400 shrink-0">
                              <User className="w-4 h-4" />
                            </div>
                          )}
                          <div className="min-w-0">
                            <button
                              type="button"
                              onClick={() => onSelectStudent && onSelectStudent(matchingStudent)}
                              className="font-bold text-slate-900 block truncate text-left hover:text-indigo-600 hover:underline transition cursor-pointer"
                              title="Klik untuk melihat Profil Riwayat Nilai Siswa (Sem 1 & Sem 2)"
                            >
                              {row.nama}
                            </button>
                            <span className="font-mono text-[10px] text-slate-400 block select-all">
                              NIS: {row.nis} {matchingStudent.jenisKelamin ? `• ${matchingStudent.jenisKelamin}` : ''}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Kehadiran (%) */}
                      <td className="py-3.5 px-3 text-center">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-md font-bold text-[11px] ${
                          row.attendancePct >= 90
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : row.attendancePct >= 80
                            ? 'bg-blue-50 text-blue-700 border border-blue-200'
                            : 'bg-rose-50 text-rose-700 border border-rose-200'
                        }`}>
                          {row.attendancePct}%
                        </span>
                      </td>

                      {/* Terlambat */}
                      <td className="py-3.5 px-3 text-center font-bold">
                        {row.lateCount > 0 ? (
                          <span className="text-rose-600 bg-rose-50 px-2 py-0.5 rounded-md border border-rose-200">
                            {row.lateCount}x
                          </span>
                        ) : (
                          <span className="text-slate-400">0x</span>
                        )}
                      </td>

                      {/* Catatan Aktif */}
                      <td className="py-3.5 px-3 text-center">
                        {row.activeNotesCount > 0 ? (
                          <span className="inline-flex items-center gap-1 font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                            <ThumbsUp className="w-3 h-3 text-emerald-600" />
                            +{row.activeNotesCount}
                          </span>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>

                      {/* Catatan Bermasalah */}
                      <td className="py-3.5 px-3 text-center">
                        {row.problemNotesCount > 0 ? (
                          <span className="inline-flex items-center gap-1 font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-md border border-rose-200">
                            <ThumbsDown className="w-3 h-3 text-rose-600" />
                            {row.problemNotesCount}
                          </span>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>

                      {/* Skor Otomatis */}
                      <td className="py-3.5 px-3 text-center bg-indigo-50/20 font-bold text-indigo-700">
                        {row.autoScore}
                      </td>

                      {/* Input Override Manual */}
                      <td className="py-3.5 px-3 text-center bg-purple-50/20">
                        <div className="flex items-center justify-center gap-1">
                          <input
                            type="number"
                            min="0"
                            max="100"
                            step="0.5"
                            placeholder={String(row.autoScore)}
                            value={row.manualScore !== null && row.manualScore !== undefined ? row.manualScore : ''}
                            onChange={e => handleScoreChange(row.nis, row.nama, e.target.value)}
                            className={`w-16 text-center py-1 rounded-lg border text-xs font-bold focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white ${
                              row.hasManualOverride ? 'border-purple-300 text-purple-700 bg-purple-50/40' : 'border-slate-200 text-slate-600'
                            }`}
                          />
                          {row.hasManualOverride && (
                            <button
                              type="button"
                              onClick={() => handleResetToAuto(row.nis)}
                              title="Reset nilai ke kalkulasi otomatis"
                              className="p-1 text-slate-400 hover:text-rose-600 rounded-md transition cursor-pointer"
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>

                      {/* Nilai Efektif */}
                      <td className="py-3.5 px-4 text-center bg-indigo-50/40 font-black text-sm">
                        <span className={
                          row.effectiveScore >= 88 
                            ? 'text-emerald-700' 
                            : row.effectiveScore >= 78 
                            ? 'text-indigo-700' 
                            : row.effectiveScore >= 68 
                            ? 'text-amber-700' 
                            : 'text-rose-700'
                        }>
                          {row.effectiveScore}
                        </span>
                      </td>

                      {/* Predikat */}
                      <td className="py-3.5 px-4 text-center">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-lg font-black text-xs border ${
                          row.predikat === 'A'
                            ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                            : row.predikat === 'B'
                            ? 'bg-blue-100 text-blue-800 border-blue-200'
                            : row.predikat === 'C'
                            ? 'bg-amber-100 text-amber-800 border-amber-200'
                            : 'bg-rose-100 text-rose-800 border-rose-200'
                        }`}>
                          {row.predikat}
                        </span>
                      </td>

                      {/* Catatan Sikap / Karakter */}
                      <td className="py-3.5 px-4">
                        <input
                          type="text"
                          placeholder="Catatan sikap / perilaku positif siswa..."
                          value={row.catatanSikap}
                          onChange={e => handleCatatanSikapChange(row.nis, row.nama, e.target.value)}
                          className="w-full px-3 py-1.5 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                        />
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
