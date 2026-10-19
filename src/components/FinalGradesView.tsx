import React, { useState, useMemo } from 'react';
import { 
  Student, 
  GradeFormative, 
  GradeSummative, 
  GradeAttitude, 
  GradeColumn, 
  MonthlyRecap, 
  StudentNote, 
  AttendanceRecord,
  GradeWeightConfig
} from '../types';
import { 
  calculateStudentGradeBreakdown, 
  StudentScoreBreakdown,
  DEFAULT_GRADE_WEIGHTS 
} from '../utils/gradeCalculator';
import { 
  Sparkles, 
  Search, 
  Check, 
  AlertCircle, 
  Info, 
  Award, 
  User, 
  Share2, 
  Copy, 
  Send, 
  Download, 
  TrendingUp, 
  CheckCircle2, 
  AlertTriangle,
  X,
  BookOpen,
  GraduationCap,
  HeartHandshake,
  Percent
} from 'lucide-react';

interface FinalGradesViewProps {
  students: Student[];
  formativeGrades: GradeFormative[];
  summativeGrades: GradeSummative[];
  attitudeGrades: GradeAttitude[];
  formativeCols?: GradeColumn[];
  summativeCols?: GradeColumn[];
  studentNotes?: StudentNote[];
  attendance?: AttendanceRecord[];
  recap?: MonthlyRecap[];
  gradeWeights?: GradeWeightConfig;
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

export default function FinalGradesView({
  students,
  formativeGrades,
  summativeGrades,
  attitudeGrades,
  formativeCols = [],
  summativeCols = [],
  studentNotes = [],
  attendance = [],
  recap = [],
  gradeWeights = DEFAULT_GRADE_WEIGHTS,
  selectedSemester = 1,
  activeClassName = 'Kelas',
  onSelectStudent
}: FinalGradesViewProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterPredicate, setFilterPredicate] = useState<'all' | 'A' | 'B' | 'C' | 'D' | 'incomplete'>('all');
  const [selectedStudentForModal, setSelectedStudentForModal] = useState<{
    student: Student;
    breakdown: StudentScoreBreakdown;
  } | null>(null);
  const [copySuccess, setCopySuccess] = useState(false);

  // Compute all breakdowns using central gradeCalculator
  const studentBreakdowns = useMemo(() => {
    return students.map((s, idx) => {
      const f = formativeGrades.find(g => g.nis === s.nis);
      const sum = summativeGrades.find(g => g.nis === s.nis);
      const att = attitudeGrades.find(g => g.nis === s.nis);

      const breakdown = calculateStudentGradeBreakdown(
        s,
        f,
        sum,
        formativeCols,
        summativeCols,
        gradeWeights,
        att,
        studentNotes,
        recap,
        attendance
      );

      const noAbsen = s.noAbsen || String(idx + 1);

      return {
        student: s,
        noAbsen,
        breakdown
      };
    });
  }, [students, formativeGrades, summativeGrades, attitudeGrades, studentNotes, recap, attendance, formativeCols, summativeCols, gradeWeights]);

  // Filter list
  const filteredList = useMemo(() => {
    return studentBreakdowns.filter(item => {
      const matchesSearch = 
        item.student.nama.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.student.nis.includes(searchQuery) ||
        item.noAbsen.includes(searchQuery);

      if (!matchesSearch) return false;

      if (filterPredicate === 'all') return true;
      if (filterPredicate === 'incomplete') return !item.breakdown.isComplete;
      return item.breakdown.predikat === filterPredicate;
    });
  }, [studentBreakdowns, searchQuery, filterPredicate]);

  // Summary Statistics
  const stats = useMemo(() => {
    if (studentBreakdowns.length === 0) {
      return { avg: 0, countA: 0, countB: 0, countC: 0, countD: 0, passCount: 0, incompleteCount: 0 };
    }
    const validScores = studentBreakdowns
      .map(i => Number(i.breakdown.nilaiAkhir))
      .filter(v => !isNaN(v) && v > 0);
    const totalScore = validScores.reduce((acc, curr) => acc + curr, 0);
    const rawAvg = validScores.length > 0 ? totalScore / validScores.length : 0;
    const avg = isNaN(rawAvg) ? 0 : parseFloat(rawAvg.toFixed(1));
    const countA = studentBreakdowns.filter(i => i.breakdown.predikat === 'A').length;
    const countB = studentBreakdowns.filter(i => i.breakdown.predikat === 'B').length;
    const countC = studentBreakdowns.filter(i => i.breakdown.predikat === 'C').length;
    const countD = studentBreakdowns.filter(i => i.breakdown.predikat === 'D').length;
    const passCount = studentBreakdowns.filter(i => i.breakdown.isTuntas).length;
    const incompleteCount = studentBreakdowns.filter(i => !i.breakdown.isComplete).length;

    return { avg, countA, countB, countC, countD, passCount, incompleteCount };
  }, [studentBreakdowns]);

  // Generate WA Message for student report
  const generateWaMessage = (item: { student: Student; breakdown: StudentScoreBreakdown }) => {
    const { student, breakdown } = item;
    const w = breakdown.weights;
    
    return `*LAPORAN HASIL BELAJAR PESERTA DIDIK*
━━━━━━━━━━━━━━━━━━━━
👤 *Nama:* ${student.nama}
🆔 *NIS:* ${student.nis}
🏫 *Kelas:* ${activeClassName}
🗓️ *Semester:* ${selectedSemester}

📊 *RINCIAN NILAI & PERSENTASE BOBOT:*
• *Nilai Formatif (${w.formatif}%):* ${(Number(breakdown.formatifAvg) || 0).toFixed(1)} ➔ Kontribusi: *${(Number(breakdown.formatifWeighted) || 0).toFixed(1)}*
• *Nilai Sumatif (${w.sumatif}%):* ${(Number(breakdown.sumatifAvg) || 0).toFixed(1)} ➔ Kontribusi: *${(Number(breakdown.sumatifWeighted) || 0).toFixed(1)}*
• *Nilai UAS (${w.uas}%):* ${(Number(breakdown.uasScore) || 0).toFixed(1)} ➔ Kontribusi: *${(Number(breakdown.uasWeighted) || 0).toFixed(1)}*
• *Nilai Sikap (${w.sikap}%):* ${(Number(breakdown.sikapScore) || 0).toFixed(1)} ➔ Kontribusi: *${(Number(breakdown.sikapWeighted) || 0).toFixed(1)}*

━━━━━━━━━━━━━━━━━━━━
🏆 *NILAI AKHIR (100%): ${(Number(breakdown.nilaiAkhir) || 0).toFixed(1)}*
🎖️ *Predikat:* ${breakdown.predikat} (${breakdown.predikatLengkap})
📌 *Status:* ${breakdown.isTuntas ? '✅ TUNTAS' : '⚠️ PERLU PERBAIKAN'}
📝 *Catatan Karakter:* ${breakdown.catatanSikap || breakdown.deskripsi}

_Dicetak otomatis melalui Sistem Penilaian Digital Kelas ${activeClassName}_`;
  };

  const handleCopyWaText = (item: { student: Student; breakdown: StudentScoreBreakdown }) => {
    const text = generateWaMessage(item);
    navigator.clipboard.writeText(text);
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 2500);
  };

  const handleOpenWaDirect = (item: { student: Student; breakdown: StudentScoreBreakdown }) => {
    const text = encodeURIComponent(generateWaMessage(item));
    window.open(`https://wa.me/?text=${text}`, '_blank');
  };

  const w = gradeWeights;

  return (
    <div className="space-y-6">
      {/* Top Banner with Weight Distribution */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-5 lg:p-6 rounded-3xl border border-indigo-800/40 shadow-xl relative overflow-hidden">
        <div className="relative z-10 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-5">
          <div className="space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-3 py-1 bg-indigo-500/30 border border-indigo-400/40 text-indigo-200 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5">
                <Percent className="w-3.5 h-3.5 text-indigo-300" />
                Rekapitulasi Nilai Akhir &amp; Rapor
              </span>
              <span className="px-3 py-1 bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 rounded-xl text-xs font-black">
                Total Bobot: 100%
              </span>
            </div>
            <h3 className="text-xl lg:text-2xl font-black text-white tracking-tight">
              Kalkulasi Nilai Akhir 4-Komponen Terbobot
            </h3>
            <p className="text-xs lg:text-sm text-slate-300 max-w-3xl leading-relaxed">
              Nilai akhir dihitung secara proporsional sesuai pengaturan persentase nilai: 
              <strong> Formatif ({w.formatif}%)</strong>, <strong> Sumatif ({w.sumatif}%)</strong>, <strong> UAS ({w.uas}%)</strong>, dan <strong> Sikap ({w.sikap}%)</strong>.
            </p>
          </div>

          {/* Quick Bobot Visualizer Badges */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 w-full lg:w-auto shrink-0">
            <div className="bg-white/10 border border-white/10 px-3.5 py-2 rounded-2xl text-center">
              <span className="text-[10px] font-bold text-indigo-200 block uppercase">Formatif</span>
              <span className="text-lg font-black text-white">{w.formatif}%</span>
            </div>
            <div className="bg-white/10 border border-white/10 px-3.5 py-2 rounded-2xl text-center">
              <span className="text-[10px] font-bold text-emerald-200 block uppercase">Sumatif</span>
              <span className="text-lg font-black text-white">{w.sumatif}%</span>
            </div>
            <div className="bg-white/10 border border-white/10 px-3.5 py-2 rounded-2xl text-center">
              <span className="text-[10px] font-bold text-amber-200 block uppercase">UAS</span>
              <span className="text-lg font-black text-white">{w.uas}%</span>
            </div>
            <div className="bg-white/10 border border-white/10 px-3.5 py-2 rounded-2xl text-center">
              <span className="text-[10px] font-bold text-pink-200 block uppercase">Sikap</span>
              <span className="text-lg font-black text-white">{w.sikap}%</span>
            </div>
          </div>
        </div>
      </div>

      {/* Class Statistics Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs">
          <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Rata-Rata Akhir</p>
          <p className="text-xl font-black text-indigo-600 mt-0.5">{isNaN(stats.avg) ? '0' : stats.avg}</p>
          <p className="text-[10px] text-slate-500 font-bold">Kelas {activeClassName}</p>
        </div>

        <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs">
          <p className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-600">Predikat A</p>
          <p className="text-xl font-black text-emerald-600 mt-0.5">{stats.countA} <span className="text-xs font-medium text-slate-400">siswa</span></p>
          <p className="text-[10px] text-slate-500 font-bold">Sangat Baik (&ge;88)</p>
        </div>

        <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs">
          <p className="text-[10px] font-extrabold uppercase tracking-wider text-blue-600">Predikat B</p>
          <p className="text-xl font-black text-blue-600 mt-0.5">{stats.countB} <span className="text-xs font-medium text-slate-400">siswa</span></p>
          <p className="text-[10px] text-slate-500 font-bold">Baik (78 - 87.9)</p>
        </div>

        <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs">
          <p className="text-[10px] font-extrabold uppercase tracking-wider text-amber-600">Predikat C / D</p>
          <p className="text-xl font-black text-amber-600 mt-0.5">{stats.countC + stats.countD} <span className="text-xs font-medium text-slate-400">siswa</span></p>
          <p className="text-[10px] text-slate-500 font-bold">Perlu Bimbingan</p>
        </div>

        <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs">
          <p className="text-[10px] font-extrabold uppercase tracking-wider text-teal-600">Ketuntasan</p>
          <p className="text-xl font-black text-teal-600 mt-0.5">{stats.passCount} <span className="text-xs font-medium text-slate-400">/ {students.length}</span></p>
          <p className="text-[10px] text-slate-500 font-bold">Nilai &ge; KKM (75)</p>
        </div>

        <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs">
          <p className="text-[10px] font-extrabold uppercase tracking-wider text-rose-600">Belum Lengkap</p>
          <p className="text-xl font-black text-rose-600 mt-0.5">{stats.incompleteCount} <span className="text-xs font-medium text-slate-400">siswa</span></p>
          <p className="text-[10px] text-slate-500 font-bold">Ada Komponen Kosong</p>
        </div>
      </div>

      {/* Main Table Card */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
        {/* Filter Header */}
        <div className="p-4 lg:p-5 border-b border-slate-200 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="relative w-full md:w-80">
            <input
              type="text"
              placeholder="Cari siswa, NIS, atau no absen..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 text-xs lg:text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50/50"
            />
            <Search className="absolute left-3 top-3 text-slate-400 w-4 h-4" />
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto justify-end">
            <span className="text-xs font-bold text-slate-500 mr-1">Filter:</span>
            {(['all', 'A', 'B', 'C', 'D', 'incomplete'] as const).map(p => (
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
                {p === 'all' ? 'Semua' : p === 'incomplete' ? 'Belum Lengkap' : `Predikat ${p}`}
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
                <th className="py-3.5 px-4 min-w-[200px]">Siswa</th>
                <th className="py-3.5 px-3 text-center bg-indigo-50/40 min-w-[110px]">
                  Formatif <span className="text-indigo-600 text-[10px]">({w.formatif}%)</span>
                </th>
                <th className="py-3.5 px-3 text-center bg-emerald-50/40 min-w-[110px]">
                  Sumatif <span className="text-emerald-600 text-[10px]">({w.sumatif}%)</span>
                </th>
                <th className="py-3.5 px-3 text-center bg-amber-50/40 min-w-[100px]">
                  UAS <span className="text-amber-600 text-[10px]">({w.uas}%)</span>
                </th>
                <th className="py-3.5 px-3 text-center bg-pink-50/40 min-w-[100px]">
                  Sikap <span className="text-pink-600 text-[10px]">({w.sikap}%)</span>
                </th>
                <th className="py-3.5 px-4 text-center bg-slate-900 text-white min-w-[120px]">
                  Nilai Akhir
                </th>
                <th className="py-3.5 px-4 text-center min-w-[90px]">Predikat</th>
                <th className="py-3.5 px-4 text-center min-w-[110px]">Status</th>
                <th className="py-3.5 px-4 text-center min-w-[120px]">Aksi / Rapor</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {filteredList.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-slate-400 font-bold">
                    Tidak ditemukan data nilai yang sesuai.
                  </td>
                </tr>
              ) : (
                filteredList.map((item) => {
                  const { student, noAbsen, breakdown } = item;
                  const photoUrl = student.foto || localStorage.getItem(`student_photo_${student.nis}`);

                  return (
                    <tr key={student.nis} className="hover:bg-slate-50/70 transition">
                      {/* No Absen */}
                      <td className="py-3.5 px-4 text-center font-bold text-slate-500">
                        {noAbsen}
                      </td>

                      {/* Siswa Photo & Info */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          {photoUrl ? (
                            <img
                              src={getStudentPhotoUrl(photoUrl)}
                              alt={student.nama}
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
                              onClick={() => onSelectStudent && onSelectStudent(student)}
                              className="font-bold text-slate-900 block truncate text-left hover:text-indigo-600 hover:underline transition cursor-pointer"
                              title="Klik untuk melihat Profil Riwayat Nilai Siswa (Sem 1 & Sem 2)"
                            >
                              {student.nama}
                            </button>
                            <span className="font-mono text-[10px] text-slate-400 block select-all">
                              NIS: {student.nis} {student.jenisKelamin ? `• ${student.jenisKelamin}` : ''}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Formatif Score & Contribution */}
                      <td className="py-3.5 px-3 text-center bg-indigo-50/20">
                        <span className="font-bold text-slate-800 block text-xs">
                          {breakdown.formatifAvg > 0 ? breakdown.formatifAvg.toFixed(1) : '-'}
                        </span>
                        <span className="text-[10px] font-mono text-indigo-600 block">
                          +{breakdown.formatifWeighted.toFixed(1)}
                        </span>
                      </td>

                      {/* Sumatif Score & Contribution */}
                      <td className="py-3.5 px-3 text-center bg-emerald-50/20">
                        <span className="font-bold text-slate-800 block text-xs">
                          {breakdown.sumatifAvg > 0 ? breakdown.sumatifAvg.toFixed(1) : '-'}
                        </span>
                        <span className="text-[10px] font-mono text-emerald-600 block">
                          +{breakdown.sumatifWeighted.toFixed(1)}
                        </span>
                      </td>

                      {/* UAS Score & Contribution */}
                      <td className="py-3.5 px-3 text-center bg-amber-50/20">
                        <span className="font-bold text-slate-800 block text-xs">
                          {breakdown.uasScore > 0 ? breakdown.uasScore.toFixed(1) : '-'}
                        </span>
                        <span className="text-[10px] font-mono text-amber-600 block">
                          +{breakdown.uasWeighted.toFixed(1)}
                        </span>
                      </td>

                      {/* Sikap Score & Contribution */}
                      <td className="py-3.5 px-3 text-center bg-pink-50/20">
                        <span className="font-bold text-slate-800 block text-xs">
                          {breakdown.sikapScore > 0 ? breakdown.sikapScore.toFixed(1) : '-'}
                        </span>
                        <span className="text-[10px] font-mono text-pink-600 block">
                          +{breakdown.sikapWeighted.toFixed(1)}
                        </span>
                      </td>

                      {/* Nilai Akhir Total */}
                      <td className="py-3.5 px-4 text-center bg-slate-900 text-white font-black text-sm">
                        {breakdown.nilaiAkhir.toFixed(1)}
                      </td>

                      {/* Predikat */}
                      <td className="py-3.5 px-4 text-center">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-lg font-black text-xs border ${
                          breakdown.predikat === 'A'
                            ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                            : breakdown.predikat === 'B'
                            ? 'bg-blue-100 text-blue-800 border-blue-200'
                            : breakdown.predikat === 'C'
                            ? 'bg-amber-100 text-amber-800 border-amber-200'
                            : 'bg-rose-100 text-rose-800 border-rose-200'
                        }`}>
                          {breakdown.predikat}
                        </span>
                      </td>

                      {/* Status Kelulusan */}
                      <td className="py-3.5 px-4 text-center">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-bold text-[11px] ${
                          breakdown.isTuntas
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-rose-50 text-rose-700 border border-rose-200'
                        }`}>
                          {breakdown.isTuntas ? 'Tuntas' : 'Perlu Remidi'}
                        </span>
                      </td>

                      {/* Action / Detail Modal */}
                      <td className="py-3.5 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => setSelectedStudentForModal(item)}
                            className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold rounded-lg text-[11px] transition cursor-pointer border border-indigo-200 flex items-center gap-1"
                            title="Lihat rincian kalkulasi nilai & kirim rapor"
                          >
                            <span>Rincian</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenWaDirect(item)}
                            className="p-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold rounded-lg transition cursor-pointer border border-emerald-200"
                            title="Kirim nilai ke WhatsApp"
                          >
                            <Send className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Student Breakdown & WA Share Modal */}
      {selectedStudentForModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="p-5 bg-gradient-to-r from-slate-900 to-indigo-950 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/10 rounded-xl">
                  <Award className="w-6 h-6 text-amber-300" />
                </div>
                <div>
                  <h4 className="font-black text-lg text-white">{selectedStudentForModal.student.nama}</h4>
                  <p className="text-xs text-indigo-200 font-mono">
                    NIS: {selectedStudentForModal.student.nis} • Kelas: {activeClassName} • Semester: {selectedSemester}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedStudentForModal(null)}
                className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-white/10 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-6">
              {/* Score Highlight Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-indigo-50/70 p-3 rounded-2xl border border-indigo-100 text-center">
                  <span className="text-[10px] font-extrabold text-indigo-600 uppercase">Formatif ({w.formatif}%)</span>
                  <span className="text-xl font-black text-slate-900 block mt-0.5">
                    {selectedStudentForModal.breakdown.formatifAvg.toFixed(1)}
                  </span>
                  <span className="text-[10px] text-indigo-700 font-bold">
                    Bobot: +{selectedStudentForModal.breakdown.formatifWeighted.toFixed(1)}
                  </span>
                </div>

                <div className="bg-emerald-50/70 p-3 rounded-2xl border border-emerald-100 text-center">
                  <span className="text-[10px] font-extrabold text-emerald-600 uppercase">Sumatif ({w.sumatif}%)</span>
                  <span className="text-xl font-black text-slate-900 block mt-0.5">
                    {selectedStudentForModal.breakdown.sumatifAvg.toFixed(1)}
                  </span>
                  <span className="text-[10px] text-emerald-700 font-bold">
                    Bobot: +{selectedStudentForModal.breakdown.sumatifWeighted.toFixed(1)}
                  </span>
                </div>

                <div className="bg-amber-50/70 p-3 rounded-2xl border border-amber-100 text-center">
                  <span className="text-[10px] font-extrabold text-amber-600 uppercase">UAS ({w.uas}%)</span>
                  <span className="text-xl font-black text-slate-900 block mt-0.5">
                    {selectedStudentForModal.breakdown.uasScore.toFixed(1)}
                  </span>
                  <span className="text-[10px] text-amber-700 font-bold">
                    Bobot: +{selectedStudentForModal.breakdown.uasWeighted.toFixed(1)}
                  </span>
                </div>

                <div className="bg-pink-50/70 p-3 rounded-2xl border border-pink-100 text-center">
                  <span className="text-[10px] font-extrabold text-pink-600 uppercase">Sikap ({w.sikap}%)</span>
                  <span className="text-xl font-black text-slate-900 block mt-0.5">
                    {selectedStudentForModal.breakdown.sikapScore.toFixed(1)}
                  </span>
                  <span className="text-[10px] text-pink-700 font-bold">
                    Bobot: +{selectedStudentForModal.breakdown.sikapWeighted.toFixed(1)}
                  </span>
                </div>
              </div>

              {/* Total & Predicate Highlight */}
              <div className="bg-slate-900 text-white p-4 rounded-2xl flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">NILAI AKHIR RAPOR</span>
                  <span className="text-3xl font-black text-emerald-400">
                    {selectedStudentForModal.breakdown.nilaiAkhir.toFixed(1)}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">PREDIKAT</span>
                  <span className="text-xl font-black text-white">
                    {selectedStudentForModal.breakdown.predikat} ({selectedStudentForModal.breakdown.predikatLengkap})
                  </span>
                </div>
              </div>

              {/* WA Text Preview */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700">Teks Rapor untuk WhatsApp / Siswa:</span>
                  {copySuccess && (
                    <span className="text-xs font-bold text-emerald-600 flex items-center gap-1 animate-pulse">
                      <Check className="w-3.5 h-3.5" /> Teks Berhasil Disalin!
                    </span>
                  )}
                </div>
                <textarea
                  readOnly
                  rows={8}
                  value={generateWaMessage(selectedStudentForModal)}
                  className="w-full p-3.5 rounded-2xl bg-slate-50 border border-slate-200 text-xs font-mono text-slate-800 select-all focus:outline-none"
                />
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setSelectedStudentForModal(null)}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold rounded-xl text-xs transition cursor-pointer"
              >
                Tutup
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleCopyWaText(selectedStudentForModal)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-xl text-xs transition flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <Copy className="w-4 h-4" />
                  <span>Salin Teks</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleOpenWaDirect(selectedStudentForModal)}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs transition flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <Send className="w-4 h-4" />
                  <span>Buka WhatsApp</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
