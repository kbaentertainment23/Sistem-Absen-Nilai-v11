import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Student, StudentNote } from '../types';
import { stripClockFromJamString } from '../utils/textHelper';
import { getStudentPhotoUrl, handleStudentPhotoError } from '../lib/photoOptimizer';
import { 
  Sparkles, 
  AlertTriangle, 
  Plus, 
  Trash2, 
  Calendar, 
  Clock, 
  FileText, 
  User,
  CheckCircle,
  HelpCircle,
  X,
  Edit2,
  Search,
  ChevronDown
} from 'lucide-react';

interface StudentNotesTabProps {
  students: Student[];
  notes: StudentNote[];
  onAddNote?: (note: Omit<StudentNote, 'id'>) => void;
  onDeleteNote: (id: string) => void;
  onUpdateNote?: (id: string, updated: Partial<StudentNote>) => void;
  onSaveNote?: (note: StudentNote) => Promise<void>;
}

const COMMON_JAM_PEMBELAJARAN = [
  "Jam 1 - 2",
  "Jam 3 - 4",
  "Jam 5 - 6",
  "Jam 6 - 7"
];

const LESSON_HOURS = [1, 2, 3, 4, 5, 6, 7];

function formatHoursToJamString(hours: number[]): string {
  if (hours.length === 0) return '';
  const sorted = Array.from(new Set(hours)).sort((a, b) => a - b);
  if (sorted.length === 1) return `Jam ${sorted[0]}`;
  
  let isContinuous = true;
  for (let i = 0; i < sorted.length - 1; i++) {
    if (sorted[i + 1] !== sorted[i] + 1) {
      isContinuous = false;
      break;
    }
  }

  if (isContinuous) {
    return `Jam ${sorted[0]} - ${sorted[sorted.length - 1]}`;
  }

  return `Jam ${sorted.join(', ')}`;
}

function parseJamStringToState(jamStr: string): { hours: number[]; isCustom: boolean; customText: string } {
  if (!jamStr) return { hours: [1, 2], isCustom: false, customText: '' };
  
  const cleanJam = stripClockFromJamString(jamStr);

  if (/^Jam\s+/i.test(cleanJam)) {
    const rawNumbers = cleanJam.replace(/^Jam\s+/i, '').trim();

    const rangeMatch = rawNumbers.match(/^(\d+)\s*[-–—]\s*(\d+)$/);
    if (rangeMatch) {
      const start = parseInt(rangeMatch[1], 10);
      const end = parseInt(rangeMatch[2], 10);
      if (!isNaN(start) && !isNaN(end) && start >= 1 && end <= 7 && start <= end) {
        const rangeHours: number[] = [];
        for (let h = start; h <= end; h++) rangeHours.push(h);
        return { hours: rangeHours, isCustom: false, customText: '' };
      }
    }

    const nums = rawNumbers.split(/[,.\s]+/).map(x => parseInt(x.trim(), 10)).filter(x => !isNaN(x) && x >= 1 && x <= 7);
    if (nums.length > 0) {
      const uniqueSorted = Array.from(new Set(nums)).sort((a, b) => a - b);
      return { hours: uniqueSorted, isCustom: false, customText: '' };
    }
  }

  return { hours: [], isCustom: true, customText: cleanJam };
}

export default function StudentNotesTab({
  students,
  notes,
  onAddNote,
  onDeleteNote,
  onUpdateNote,
  onSaveNote
}: StudentNotesTabProps) {
  // Form states
  const [tanggalInput, setTanggalInput] = useState<string>(
    new Date().toLocaleDateString('en-CA') // YYYY-MM-DD local timezone friendly
  );
  const [selectedNis, setSelectedNis] = useState<string>('');
  const [isStudentDropdownOpen, setIsStudentDropdownOpen] = useState<boolean>(false);
  const [studentSearchTerm, setStudentSearchTerm] = useState<string>('');
  const studentDropdownRef = useRef<HTMLDivElement>(null);
  const studentSearchInputRef = useRef<HTMLInputElement>(null);

  const [selectedHours, setSelectedHours] = useState<number[]>([1, 2]);
  const [isCustomJam, setIsCustomJam] = useState<boolean>(false);
  const [customJamInput, setCustomJamInput] = useState<string>('');
  const [tipeInput, setTipeInput] = useState<'aktif' | 'bermasalah'>('aktif');
  const [catatanInput, setCatatanInput] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  
  // Close student searchable dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (studentDropdownRef.current && !studentDropdownRef.current.contains(event.target as Node)) {
        setIsStudentDropdownOpen(false);
      }
    };
    if (isStudentDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      // Auto-focus search input when opened
      setTimeout(() => {
        studentSearchInputRef.current?.focus();
      }, 50);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isStudentDropdownOpen]);

  // Selected student object
  const selectedStudentObj = useMemo(() => {
    return students.find(s => s.nis === selectedNis);
  }, [students, selectedNis]);

  // Filtered students for searchable dropdown (by name, NIS, and attendance number)
  const filteredDropdownStudents = useMemo(() => {
    if (!studentSearchTerm.trim()) {
      return students;
    }
    const cleanTerm = studentSearchTerm.toLowerCase().trim();
    return students.filter(s => {
      const matchName = s.nama.toLowerCase().includes(cleanTerm);
      const matchNis = s.nis.toLowerCase().includes(cleanTerm);
      const matchAbsen = s.noAbsen ? String(s.noAbsen).toLowerCase().includes(cleanTerm) : false;
      return matchName || matchNis || matchAbsen;
    });
  }, [students, studentSearchTerm]);
  
  // Edit states
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [noteToDelete, setNoteToDelete] = useState<StudentNote | null>(null);

  // Success / Error alerts
  const [successMsg, setSuccessMsg] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string>('');

  // Handle Form Submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (!selectedNis) {
      setErrorMsg('Pilih siswa terlebih dahulu.');
      return;
    }

    const student = students.find(s => s.nis === selectedNis);
    if (!student) {
      setErrorMsg('Siswa tidak ditemukan.');
      return;
    }

    const jam = isCustomJam ? customJamInput.trim() : formatHoursToJamString(selectedHours);
    if (!jam) {
      setErrorMsg('Tentukan jam pembelajaran (pilih minimal satu jam pelajaran atau ketik kustom).');
      return;
    }

    if (!catatanInput.trim()) {
      setErrorMsg('Tulis deskripsi catatan aktivitas.');
      return;
    }

    const notePayload: StudentNote = {
      id: editingNoteId || `note_${Date.now()}`,
      tanggal: tanggalInput,
      nis: selectedNis,
      nama: student.nama,
      kelas: student.kelas || 'Kelas 8.1',
      jamPembelajaran: jam,
      tipe: tipeInput,
      catatan: catatanInput.trim()
    };

    if (onSaveNote) {
      await onSaveNote(notePayload);
    } else if (editingNoteId && onUpdateNote) {
      onUpdateNote(editingNoteId, notePayload);
    } else if (onAddNote) {
      onAddNote(notePayload);
    }

    setSuccessMsg(editingNoteId ? 'Catatan siswa berhasil diperbarui!' : 'Catatan siswa berhasil ditambahkan!');
    setEditingNoteId(null);

    // Reset some inputs
    setCatatanInput('');
    // Keep date, student, and session for potential rapid batch entry
    setTimeout(() => setSuccessMsg(''), 3000);
  };

  // Set form to edit mode
  const handleEditClick = (note: StudentNote) => {
    setEditingNoteId(note.id);
    setTanggalInput(note.tanggal);
    setSelectedNis(note.nis);
    setTipeInput(note.tipe);
    setCatatanInput(note.catatan);
    
    const parsed = parseJamStringToState(note.jamPembelajaran);
    if (parsed.isCustom) {
      setIsCustomJam(true);
      setCustomJamInput(parsed.customText);
      setSelectedHours([]);
    } else {
      setIsCustomJam(false);
      setSelectedHours(parsed.hours);
      setCustomJamInput('');
    }
    
    // Scroll form into view if mobile
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCancelEdit = () => {
    setEditingNoteId(null);
    setSelectedNis('');
    setCatatanInput('');
    setSelectedHours([1, 2]);
    setIsCustomJam(false);
    setCustomJamInput('');
    setSuccessMsg('');
    setErrorMsg('');
  };

  // Filter notes to display based on date, search, etc.
  const filteredNotes = notes.filter(n => {
    const matchesSearch = 
      n.nama.toLowerCase().includes(searchQuery.toLowerCase()) ||
      n.nis.includes(searchQuery) ||
      n.catatan.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSearch;
  });

  return (
    <div className="space-y-6">
      {/* Tab Header Banner */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            🗒️ Jurnal & Catatan Siswa Harian
          </h2>
          <p className="text-xs text-slate-500 mt-1 leading-relaxed">
            Catat siswa yang <strong>aktif / berprestasi</strong> maupun yang <strong>bermasalah / melanggar tata tertib</strong> selama pembelajaran kelas berlangsung.
          </p>
        </div>
        <div className="text-right shrink-0">
          <span className="text-[10px] font-bold text-slate-400 block uppercase tracking-wider">Metode Sinkronisasi</span>
          <span className="px-3 py-1 bg-teal-50 border border-teal-100 text-teal-700 font-bold rounded-full text-[10px] uppercase mt-1 inline-block">
            Auto-Sync Lokal (Offline-First)
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* LEFT SIDE: Entry Form */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs lg:col-span-5 space-y-5">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="font-extrabold text-slate-800 text-sm tracking-tight uppercase">
              {editingNoteId ? '✏️ Edit Catatan Siswa' : '📝 Tambah Catatan Baru'}
            </h3>
            {editingNoteId && (
              <button 
                type="button" 
                onClick={handleCancelEdit}
                className="text-xs text-slate-400 hover:text-slate-600 font-bold transition flex items-center gap-1 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" /> Batal Edit
              </button>
            )}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4 text-xs">
            {/* Tanggal & Pilih Siswa */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                  <Calendar className="w-3 h-3 text-indigo-500" /> Tanggal
                </label>
                <input
                  type="date"
                  required
                  value={tanggalInput}
                  onChange={e => setTanggalInput(e.target.value)}
                  className="w-full px-3 py-2.5 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium bg-slate-50 text-slate-700"
                />
              </div>

              {/* Searchable Student Dropdown */}
              <div className="relative" ref={studentDropdownRef}>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                  <span className="flex items-center gap-1">
                    <User className="w-3 h-3 text-indigo-500" /> Pilih Siswa ({students.length} anak)
                  </span>
                  {selectedStudentObj && (
                    <span className="text-[9px] font-mono text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded-md font-bold">
                      {selectedStudentObj.noAbsen ? `Absen #${selectedStudentObj.noAbsen}` : `NIS: ${selectedStudentObj.nis}`}
                    </span>
                  )}
                </label>

                {/* Dropdown Trigger Button */}
                <button
                  type="button"
                  onClick={() => setIsStudentDropdownOpen(prev => !prev)}
                  className={`w-full px-3 py-2 text-xs rounded-xl border transition-all flex items-center justify-between text-left cursor-pointer ${
                    isStudentDropdownOpen
                      ? 'border-indigo-500 ring-2 ring-indigo-500/20 bg-white'
                      : selectedStudentObj
                      ? 'border-indigo-300 bg-indigo-50/40 text-slate-900 shadow-2xs'
                      : 'border-slate-200 bg-slate-50 text-slate-500 hover:border-slate-300'
                  }`}
                  aria-haspopup="listbox"
                  aria-expanded={isStudentDropdownOpen}
                >
                  {selectedStudentObj ? (
                    <div className="flex items-center gap-2.5 min-w-0 pr-1">
                      {selectedStudentObj.foto ? (
                        <img
                          src={getStudentPhotoUrl(selectedStudentObj.foto)}
                          alt={selectedStudentObj.nama}
                          referrerPolicy="no-referrer"
                          onError={(e) => handleStudentPhotoError(e, selectedStudentObj.foto)}
                          className="w-6 h-6 rounded-full object-cover border border-indigo-200 shrink-0"
                        />
                      ) : (
                        <div className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-600 border border-indigo-200 flex items-center justify-center font-bold text-[10px] shrink-0">
                          {selectedStudentObj.nama.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div className="min-w-0">
                        <span className="font-bold text-slate-800 block truncate leading-tight">
                          {selectedStudentObj.nama}
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono block leading-none mt-0.5">
                          NIS: {selectedStudentObj.nis}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-slate-400">
                      <Search className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="truncate">-- Cari atau Pilih Siswa --</span>
                    </div>
                  )}

                  <div className="flex items-center gap-1 shrink-0 ml-1">
                    {selectedStudentObj && (
                      <span
                        role="button"
                        tabIndex={0}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedNis('');
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.stopPropagation();
                            setSelectedNis('');
                          }
                        }}
                        className="p-1 hover:bg-slate-200/80 rounded-full text-slate-400 hover:text-slate-600 transition"
                        title="Hapus pilihan"
                      >
                        <X className="w-3 h-3" />
                      </span>
                    )}
                    <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${isStudentDropdownOpen ? 'rotate-180 text-indigo-600' : ''}`} />
                  </div>
                </button>

                {/* Dropdown Floating Panel */}
                {isStudentDropdownOpen && (
                  <div className="absolute left-0 right-0 top-full mt-1.5 z-40 bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
                    {/* Search Input Field inside Dropdown */}
                    <div className="p-2.5 border-b border-slate-100 bg-slate-50/80">
                      <div className="relative">
                        <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                          ref={studentSearchInputRef}
                          type="text"
                          value={studentSearchTerm}
                          onChange={(e) => setStudentSearchTerm(e.target.value)}
                          placeholder="Ketik nama, NIS, atau no absen..."
                          className="w-full pl-8 pr-7 py-1.5 text-xs rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-slate-800 placeholder:text-slate-400"
                        />
                        {studentSearchTerm && (
                          <button
                            type="button"
                            onClick={() => setStudentSearchTerm('')}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 rounded-full"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Student List */}
                    <div className="max-h-56 overflow-y-auto divide-y divide-slate-100/80 p-1">
                      {filteredDropdownStudents.length === 0 ? (
                        <div className="p-4 text-center text-slate-400">
                          <p className="font-medium text-xs">Siswa tidak ditemukan</p>
                          <p className="text-[10px] text-slate-400 mt-0.5">Coba kata kunci nama, nomor absen, atau NIS lain.</p>
                        </div>
                      ) : (
                        filteredDropdownStudents.map((s) => {
                          const isSelected = s.nis === selectedNis;
                          return (
                            <button
                              key={s.nis}
                              type="button"
                              onClick={() => {
                                setSelectedNis(s.nis);
                                setIsStudentDropdownOpen(false);
                                setStudentSearchTerm('');
                              }}
                              className={`w-full px-3 py-2 text-left rounded-xl transition flex items-center justify-between gap-2.5 cursor-pointer ${
                                isSelected
                                  ? 'bg-indigo-50/80 text-indigo-900 font-bold'
                                  : 'hover:bg-slate-50 text-slate-700'
                              }`}
                            >
                              <div className="flex items-center gap-2.5 min-w-0">
                                {s.foto ? (
                                  <img
                                    src={getStudentPhotoUrl(s.foto)}
                                    alt={s.nama}
                                    referrerPolicy="no-referrer"
                                    onError={(e) => handleStudentPhotoError(e, s.foto)}
                                    className="w-7 h-7 rounded-full object-cover border border-slate-200 shrink-0"
                                  />
                                ) : (
                                  <div className="w-7 h-7 rounded-full bg-slate-100 text-slate-500 border border-slate-200 flex items-center justify-center font-bold text-xs shrink-0">
                                    {s.nama.charAt(0).toUpperCase()}
                                  </div>
                                )}
                                <div className="min-w-0">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    {s.noAbsen && (
                                      <span className="font-mono text-[9px] px-1 py-0.2 rounded bg-slate-100 text-slate-600 font-bold">
                                        #{s.noAbsen}
                                      </span>
                                    )}
                                    <span className="font-bold text-slate-800 text-xs block truncate">
                                      {s.nama}
                                    </span>
                                  </div>
                                  <span className="font-mono text-[10px] text-slate-400 block">
                                    NIS: {s.nis} {s.jenisKelamin ? `• ${s.jenisKelamin}` : ''}
                                  </span>
                                </div>
                              </div>

                              {isSelected && (
                                <CheckCircle className="w-4 h-4 text-indigo-600 shrink-0" />
                              )}
                            </button>
                          );
                        })
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Jam Pembelajaran Multi-selector */}
            <div className="space-y-3 bg-slate-50/70 border border-slate-200/80 p-3.5 rounded-2xl">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                <label className="text-xs font-extrabold text-slate-700 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-indigo-500" />
                  Jam Pembelajaran <span className="text-rose-500">*</span>
                </label>
                <span className="text-[10px] text-slate-400 font-medium italic">
                  (Pilih kombinasi jam secara bebas atau gunakan preset)
                </span>
              </div>

              {!isCustomJam ? (
                <div className="space-y-2.5">
                  {/* Quick Presets */}
                  <div>
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider block mb-1">Pilihan Kombinasi Cepat:</span>
                    <div className="flex flex-wrap gap-1.5">
                      {[
                        { label: 'Jam 1 - 2', hours: [1, 2] },
                        { label: 'Jam 2 - 3', hours: [2, 3] },
                        { label: 'Jam 3 - 4', hours: [3, 4] },
                        { label: 'Jam 4 - 5', hours: [4, 5] },
                        { label: 'Jam 5 - 6', hours: [5, 6] },
                        { label: 'Jam 6 - 7', hours: [6, 7] },
                      ].map((preset) => {
                        const isPresetSelected = preset.hours.every(h => selectedHours.includes(h)) && preset.hours.length === selectedHours.length;
                        return (
                          <button
                            key={preset.label}
                            type="button"
                            onClick={() => setSelectedHours(preset.hours)}
                            className={`px-2.5 py-1.5 rounded-lg text-[10px] font-extrabold cursor-pointer transition border ${
                              isPresetSelected
                                ? 'bg-indigo-600 border-indigo-700 text-white shadow-xs'
                                : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-600'
                            }`}
                          >
                            {preset.label}
                          </button>
                        );
                      })}
                      <button
                        type="button"
                        onClick={() => setIsCustomJam(true)}
                        className="px-2.5 py-1.5 rounded-lg text-[10px] font-extrabold cursor-pointer transition border bg-white hover:bg-slate-50 border-slate-200 text-slate-600"
                      >
                        ✏️ Ketik Kustom
                      </button>
                      {selectedHours.length > 0 && (
                        <button
                          type="button"
                          onClick={() => setSelectedHours([])}
                          className="px-2.5 py-1.5 rounded-lg text-[10px] font-extrabold cursor-pointer transition border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-600"
                        >
                          Hapus
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Individual Toggle Toggles */}
                  <div>
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider block mb-1">Pilih Satu per Satu (Kombinasi Bebas):</span>
                    <div className="grid grid-cols-4 sm:grid-cols-7 gap-1.5">
                      {LESSON_HOURS.map(hour => {
                        const isSelected = selectedHours.includes(hour);
                        return (
                          <button
                            key={hour}
                            type="button"
                            onClick={() => {
                              setSelectedHours(prev =>
                                prev.includes(hour)
                                  ? prev.filter(h => h !== hour)
                                  : [...prev, hour].sort((a, b) => a - b)
                              );
                            }}
                            className={`py-1.5 rounded-xl text-xs font-black cursor-pointer transition border flex flex-col items-center justify-center gap-0.5 ${
                              isSelected
                                ? 'bg-indigo-600 border-indigo-700 text-white shadow-xs'
                                : 'bg-white hover:bg-slate-100 border-slate-200 text-slate-600 shadow-2xs'
                            }`}
                          >
                            <span className="text-[8px] opacity-75 font-extrabold uppercase">Jam</span>
                            <span className="text-xs font-black">{hour}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Summary of Selected Hours */}
                  {selectedHours.length > 0 && (
                    <div className="text-[10px] font-bold text-indigo-700 bg-indigo-50/80 border border-indigo-150 rounded-xl px-3 py-2 flex items-center justify-between gap-2 mt-1">
                      <div className="flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse shrink-0" />
                        <span>Kombinasi Terpilih:</span>
                      </div>
                      <span className="font-extrabold bg-white px-2.5 py-0.5 rounded-md border border-indigo-200 text-indigo-800">
                        {formatHoursToJamString(selectedHours)}
                      </span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-1.5 pt-1">
                  <span className="text-[9px] font-black text-amber-600 uppercase tracking-wider block">Ketik Nama Sesi / Jam Pembelajaran Kustom:</span>
                  <div className="relative">
                    <input
                      type="text"
                      required
                      placeholder="Contoh: Jam Istirahat / Kegiatan Ekstrakurikuler / Jam 2 dan 3"
                      value={customJamInput}
                      onChange={e => setCustomJamInput(e.target.value)}
                      className="w-full pl-3 pr-24 py-2 text-xs rounded-xl border border-amber-300 focus:outline-none focus:ring-2 focus:ring-amber-500 font-semibold text-slate-700 bg-amber-50/30"
                    />
                    <button
                      type="button"
                      onClick={() => setIsCustomJam(false)}
                      className="absolute right-2 top-1.5 px-2.5 py-1 text-[10px] font-bold text-slate-600 hover:text-slate-800 bg-white border border-slate-200 rounded-lg shadow-2xs cursor-pointer"
                    >
                      Kembali ke Pilihan
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Tipe Catatan (Aktif vs Bermasalah) */}
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                Tipe Karakter / Aktivitas Siswa
              </label>
              <div className="grid grid-cols-2 gap-2.5">
                {/* Tipe Aktif */}
                <button
                  type="button"
                  onClick={() => setTipeInput('aktif')}
                  className={`py-3 px-4 rounded-xl border font-bold transition flex flex-col items-center justify-center gap-1 cursor-pointer ${
                    tipeInput === 'aktif'
                      ? 'bg-emerald-50 border-emerald-500 text-emerald-700 shadow-xs'
                      : 'bg-slate-50/50 hover:bg-slate-50 border-slate-200 text-slate-500'
                  }`}
                >
                  <Sparkles className={`w-5 h-5 ${tipeInput === 'aktif' ? 'text-emerald-500' : 'text-slate-400'}`} />
                  <span className="text-[10px]">Siswa Aktif</span>
                  <span className="text-[8px] font-normal text-slate-400">(Bertanya, Kreatif, dll)</span>
                </button>

                {/* Tipe Bermasalah */}
                <button
                  type="button"
                  onClick={() => setTipeInput('bermasalah')}
                  className={`py-3 px-4 rounded-xl border font-bold transition flex flex-col items-center justify-center gap-1 cursor-pointer ${
                    tipeInput === 'bermasalah'
                      ? 'bg-rose-50 border-rose-500 text-rose-700 shadow-xs'
                      : 'bg-slate-50/50 hover:bg-slate-50 border-slate-200 text-slate-500'
                  }`}
                >
                  <AlertTriangle className={`w-5 h-5 ${tipeInput === 'bermasalah' ? 'text-rose-500' : 'text-slate-400'}`} />
                  <span className="text-[10px]">Siswa Bermasalah</span>
                  <span className="text-[8px] font-normal text-slate-400">(Tidur, Ribut, dll)</span>
                </button>
              </div>
            </div>

            {/* Deskripsi Catatan */}
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                <FileText className="w-3 h-3 text-indigo-500" /> Isi Catatan Kejadian
              </label>
              <textarea
                required
                rows={4}
                value={catatanInput}
                onChange={e => setCatatanInput(e.target.value)}
                placeholder={
                  tipeInput === 'aktif'
                    ? "Contoh: Sangat aktif menjawab pertanyaan analisis dan membantu temannya menyelesaikan soal matematika tingkat tinggi."
                    : "Contoh: Tertidur pulas selama 20 menit saat penjelasan materi berlangsung dan tidak mengumpulkan tugas latihan harian."
                }
                className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder-slate-400 text-slate-700 leading-relaxed font-medium"
              />
            </div>

            {/* Feedback messages */}
            {successMsg && (
              <div className="p-3 bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-xl font-bold text-[11px] flex items-center gap-2">
                <CheckCircle className="w-4 h-4 shrink-0 text-emerald-500" />
                <span>{successMsg}</span>
              </div>
            )}

            {errorMsg && (
              <div className="p-3 bg-rose-50 text-rose-700 border border-rose-100 rounded-xl font-bold text-[11px] flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-rose-500" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Submit button */}
            <button
              type="submit"
              className={`w-full py-2.5 px-4 rounded-xl text-xs font-black text-white transition shadow-xs flex items-center justify-center gap-2 cursor-pointer ${
                editingNoteId 
                  ? 'bg-amber-600 hover:bg-amber-700' 
                  : 'bg-indigo-600 hover:bg-indigo-700'
              }`}
            >
              {editingNoteId ? (
                <>
                  <Edit2 className="w-4 h-4" /> Perbarui Catatan
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4" /> Simpan Catatan Harian
                </>
              )}
            </button>
          </form>
        </div>

        {/* RIGHT SIDE: List / History of Notes */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs lg:col-span-7 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
            <div>
              <h3 className="font-extrabold text-slate-800 text-sm tracking-tight uppercase">
                📋 Daftar Jurnal Kejadian Kelas
              </h3>
              <p className="text-[10px] text-slate-400 mt-0.5 font-semibold">
                Menampilkan semua catatan untuk kelas terpilih ({filteredNotes.length} entri)
              </p>
            </div>

            {/* Simple Search bar */}
            <div className="relative w-full sm:w-52 shrink-0">
              <input
                type="text"
                placeholder="Cari nama atau catatan..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-[10px] rounded-xl border border-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-semibold text-slate-700"
              />
              <FileText className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
            </div>
          </div>

          {filteredNotes.length === 0 ? (
            <div className="py-16 text-center text-slate-400 text-xs flex flex-col items-center justify-center gap-3">
              <div className="w-12 h-12 bg-slate-50 border border-slate-100 rounded-2xl flex items-center justify-center text-slate-300 shadow-inner">
                <HelpCircle className="w-6 h-6" />
              </div>
              <p className="font-semibold max-w-xs">
                {searchQuery 
                  ? 'Tidak ditemukan catatan yang cocok dengan pencarian.'
                  : 'Belum ada catatan aktivitas siswa. Silakan tambahkan pada form di samping.'
                }
              </p>
            </div>
          ) : (
            <div className="space-y-3.5 max-h-[500px] overflow-y-auto pr-1">
              {filteredNotes.map((note) => {
                const s = students.find(std => std.nis === note.nis);
                return (
                  <div 
                    key={note.id} 
                    className={`p-4 rounded-2xl border transition hover:shadow-xs flex flex-col sm:flex-row gap-4 items-start ${
                      note.tipe === 'aktif'
                        ? 'border-emerald-100 bg-emerald-50/20 hover:bg-emerald-50/40'
                        : 'border-rose-100 bg-rose-50/20 hover:bg-rose-50/40'
                    }`}
                  >
                    {/* Student Photo or initial */}
                    <div className="w-10 h-10 rounded-xl overflow-hidden bg-slate-100 border border-slate-200 flex-shrink-0 flex items-center justify-center font-bold text-slate-600 text-sm shadow-sm">
                      {s?.foto ? (
                        <img 
                          src={getStudentPhotoUrl(s.foto)} 
                          alt={note.nama} 
                          referrerPolicy="no-referrer"
                          onError={(e) => handleStudentPhotoError(e, s.foto)}
                          className="w-full h-full object-cover" 
                        />
                      ) : (
                        note.nama.charAt(0)
                      )}
                    </div>

                    {/* Description Area */}
                    <div className="flex-grow space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        {s?.noAbsen && (
                          <span className="px-1.5 py-0.5 bg-indigo-50 border border-indigo-100 rounded text-indigo-700 font-mono font-extrabold text-[9px] shrink-0">
                            Absen: {s.noAbsen}
                          </span>
                        )}
                        <span className="font-black text-slate-800 text-xs leading-none">
                          {note.nama}
                        </span>
                        <span className="text-[9px] text-slate-400 font-mono">
                          NIS: {note.nis}
                        </span>
                        <span className="text-[10px] text-slate-400 font-semibold">• {note.tanggal}</span>
                      </div>

                      {/* Time / Session Info */}
                      <div className="flex items-center gap-3 text-[10px] text-slate-500 font-bold">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3 text-slate-400" /> {stripClockFromJamString(note.jamPembelajaran)}
                        </span>
                        <span className={`px-2 py-0.5 rounded-full text-[8px] uppercase tracking-wider font-extrabold flex items-center gap-1 ${
                          note.tipe === 'aktif'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-rose-100 text-rose-800'
                        }`}>
                          {note.tipe === 'aktif' ? (
                            <>
                              <Sparkles className="w-2.5 h-2.5" /> Siswa Aktif
                            </>
                          ) : (
                            <>
                              <AlertTriangle className="w-2.5 h-2.5" /> Siswa Bermasalah
                            </>
                          )}
                        </span>
                      </div>

                      <p className="text-xs text-slate-600 leading-relaxed font-medium pt-1">
                        {note.catatan}
                      </p>
                    </div>

                    {/* Action buttons */}
                    <div className="flex sm:flex-col gap-1.5 w-full sm:w-auto justify-end sm:justify-start shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-200/50 mt-2 sm:mt-0">
                      <button
                        type="button"
                        onClick={() => handleEditClick(note)}
                        className="px-2 py-1.5 text-[10px] text-amber-600 hover:text-white hover:bg-amber-500 border border-amber-200 hover:border-amber-500 rounded-lg font-bold transition flex items-center gap-1 cursor-pointer"
                        title="Edit Catatan"
                      >
                        <Edit2 className="w-3 h-3" /> <span className="sm:hidden">Edit</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setNoteToDelete(note)}
                        className="px-2 py-1.5 text-[10px] text-rose-600 hover:text-white hover:bg-rose-500 border border-rose-200 hover:border-rose-500 rounded-lg font-bold transition flex items-center gap-1 cursor-pointer"
                        title="Hapus Catatan"
                      >
                        <Trash2 className="w-3 h-3" /> <span className="sm:hidden">Hapus</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
      {/* Custom Delete Confirmation Modal */}
      {noteToDelete && (
        <div 
          className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-200"
          onClick={() => setNoteToDelete(null)}
        >
          <div 
            className="bg-white rounded-3xl p-6 shadow-2xl border border-slate-150 max-w-md w-full flex flex-col items-center text-center gap-4 animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-14 h-14 bg-rose-50 border border-rose-100 rounded-2xl flex items-center justify-center text-rose-500 shadow-inner">
              <AlertTriangle className="w-7 h-7" />
            </div>

            <div className="space-y-1.5">
              <h4 className="text-base font-black text-slate-900">Hapus Catatan Harian?</h4>
              <p className="text-xs text-slate-500 max-w-xs leading-relaxed">
                Tindakan ini bersifat permanen dan tidak dapat dibatalkan. Data keaktifan / kendala yang sudah dihapus tidak akan dapat dikembalikan.
              </p>
            </div>

            {/* Selected Note Details Card */}
            <div className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 text-left space-y-2 text-xs">
              <div className="flex items-center justify-between font-bold text-slate-400 text-[10px]">
                <span>IDENTITAS SISWA</span>
                <span>{noteToDelete.tanggal}</span>
              </div>
              <div>
                <span className="font-extrabold text-slate-800 text-xs block">{noteToDelete.nama}</span>
                <span className="font-mono text-[9px] text-slate-400">NIS: {noteToDelete.nis}</span>
              </div>
              <div className="border-t border-slate-200/60 pt-2">
                <span className="text-[10px] font-bold text-slate-400 block mb-0.5">ISI CATATAN KEJADIAN:</span>
                <p className="text-slate-600 italic font-medium leading-relaxed bg-white p-2.5 rounded-lg border border-slate-100 max-h-24 overflow-y-auto">
                  "{noteToDelete.catatan}"
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 w-full mt-2">
              <button
                type="button"
                onClick={() => setNoteToDelete(null)}
                className="py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => {
                  onDeleteNote(noteToDelete.id);
                  setNoteToDelete(null);
                }}
                className="py-2.5 px-4 bg-rose-600 hover:bg-rose-700 text-white font-black rounded-xl text-xs transition cursor-pointer shadow-xs"
              >
                Ya, Hapus Permanen
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
