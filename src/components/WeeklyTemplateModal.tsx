import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, 
  BookOpen, 
  Sparkles, 
  Plus, 
  Edit3, 
  Trash2, 
  Save, 
  Check, 
  Search, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  Layers, 
  Copy, 
  RotateCcw,
  BookMarked,
  FileSpreadsheet,
  CheckSquare,
  HelpCircle,
  ArrowRight
} from 'lucide-react';
import { WeeklyMaterialTemplate } from '../types';

export interface TemplateEditInfo {
  oldTemplate: WeeklyMaterialTemplate;
  newTemplate: WeeklyMaterialTemplate;
}

interface WeeklyTemplateModalProps {
  isOpen: boolean;
  onClose: () => void;
  templates: WeeklyMaterialTemplate[];
  onSaveTemplates: (
    templates: WeeklyMaterialTemplate[],
    editInfo?: TemplateEditInfo
  ) => Promise<{ updatedJournalsCount?: number } | void> | void;
  onApplyTemplate: (template: WeeklyMaterialTemplate) => void;
  activeClassName?: string;
  selectedSemester?: 1 | 2;
}

// Default empty templates - templates are created manually by teacher
export const DEFAULT_WEEKLY_TEMPLATES: WeeklyMaterialTemplate[] = [];

export const WeeklyTemplateModal: React.FC<WeeklyTemplateModalProps> = ({
  isOpen,
  onClose,
  templates,
  onSaveTemplates,
  onApplyTemplate,
  activeClassName = 'Kelas',
  selectedSemester = 1
}) => {
  const [activeTab, setActiveTab] = useState<'select' | 'manage'>('select');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterSemester, setFilterSemester] = useState<'all' | '1' | '2'>('all');
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccessMessage, setSaveSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [templateToDelete, setTemplateToDelete] = useState<WeeklyMaterialTemplate | null>(null);
  const [isFormHighlighted, setIsFormHighlighted] = useState(false);

  // Form container ref for smooth auto-scroll on edit
  const formSectionRefStr = useRef<HTMLDivElement | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);

  // Editing / Adding form state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formMingguKe, setFormMingguKe] = useState<number>(1);
  const [formLabelMinggu, setFormLabelMinggu] = useState<string>('Minggu ke-1');
  const [formTopik, setFormTopik] = useState<string>('');
  const [formTP, setFormTP] = useState<string>('');
  const [formCatatan, setFormCatatan] = useState<string>('');
  const [formJamDefault, setFormJamDefault] = useState<number[]>([1, 2]);
  const [formAdaTugas, setFormAdaTugas] = useState<boolean>(false);
  const [formDeskripsiTugas, setFormDeskripsiTugas] = useState<string>('');
  const [formSemester, setFormSemester] = useState<1 | 2>(selectedSemester);

  // Local copy of templates for editing
  const [localTemplates, setLocalTemplates] = useState<WeeklyMaterialTemplate[]>(templates);

  useEffect(() => {
    setLocalTemplates(templates);
  }, [templates]);

  // SCROLL LOCK EFFECT: Freezes background scroll when popup is open
  useEffect(() => {
    if (isOpen) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = originalOverflow || '';
      };
    }
  }, [isOpen]);

  // Keyboard shortcut: ESC to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Sync default form week when switching to manage tab or when templates change
  useEffect(() => {
    if (!editingId) {
      const nextWeek = localTemplates.length > 0
        ? Math.max(...localTemplates.map(t => t.mingguKe || 0)) + 1
        : 1;
      setFormMingguKe(nextWeek);
      setFormLabelMinggu(`Minggu ke-${nextWeek}`);
    }
  }, [editingId, localTemplates]);

  const filteredTemplates = useMemo(() => {
    return localTemplates
      .filter(t => {
        if (filterSemester !== 'all') {
          const sem = Number(t.semester) === 2 ? 2 : 1;
          if (String(sem) !== filterSemester) return false;
        }
        if (!searchQuery.trim()) return true;
        const q = searchQuery.toLowerCase();
        return (
          t.topikMateri.toLowerCase().includes(q) ||
          (t.tujuanPembelajaran && t.tujuanPembelajaran.toLowerCase().includes(q)) ||
          t.catatanKegiatan.toLowerCase().includes(q) ||
          (t.labelMinggu && t.labelMinggu.toLowerCase().includes(q)) ||
          `minggu ${t.mingguKe}`.includes(q)
        );
      })
      .sort((a, b) => (a.mingguKe || 0) - (b.mingguKe || 0));
  }, [localTemplates, searchQuery, filterSemester]);

  const handleResetForm = () => {
    setEditingId(null);
    const nextWeek = localTemplates.length > 0
      ? Math.max(...localTemplates.map(t => t.mingguKe || 0)) + 1
      : 1;
    setFormMingguKe(nextWeek);
    setFormLabelMinggu(`Minggu ke-${nextWeek}`);
    setFormTopik('');
    setFormTP('');
    setFormCatatan('');
    setFormJamDefault([1, 2]);
    setFormAdaTugas(false);
    setFormDeskripsiTugas('');
    setFormSemester(selectedSemester);
  };

  const handleEditClick = (template: WeeklyMaterialTemplate) => {
    setEditingId(template.id);
    setFormMingguKe(template.mingguKe);
    setFormLabelMinggu(template.labelMinggu || `Minggu ke-${template.mingguKe}`);
    setFormTopik(template.topikMateri);
    setFormTP(template.tujuanPembelajaran || '');
    setFormCatatan(template.catatanKegiatan);
    setFormJamDefault(template.jamPelajaranDefault || [1, 2]);
    setFormAdaTugas(Boolean(template.adaTugas));
    setFormDeskripsiTugas(template.deskripsiTugas || '');
    setFormSemester(template.semester === 2 ? 2 : 1);
    setActiveTab('manage');

    // Smoothly scroll and highlight the edit form
    setIsFormHighlighted(true);
    
    // Smooth scrolling using container scrollTo
    requestAnimationFrame(() => {
      if (scrollContainerRef.current) {
        scrollContainerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
      }
    });

    // Gently focus on the topic input without interrupting smooth scrolling
    setTimeout(() => {
      const topicInput = document.getElementById('form-topik-materi-input');
      if (topicInput) {
        topicInput.focus({ preventScroll: true });
      }
    }, 220);

    setTimeout(() => {
      setIsFormHighlighted(false);
    }, 2500);
  };

  const handleDeleteClick = (template: WeeklyMaterialTemplate) => {
    setTemplateToDelete(template);
  };

  const handleConfirmDelete = async () => {
    if (!templateToDelete) return;
    const targetId = templateToDelete.id;
    const updated = localTemplates.filter(t => t.id !== targetId);
    setLocalTemplates(updated);
    if (editingId === targetId) {
      handleResetForm();
    }
    try {
      setIsSaving(true);
      await onSaveTemplates(updated);
      setSaveSuccessMessage(`Template "${templateToDelete.labelMinggu || `Minggu ${templateToDelete.mingguKe}`}" berhasil dihapus dari database!`);
      setTimeout(() => setSaveSuccessMessage(''), 2500);
    } catch (err: any) {
      console.error('Failed to delete template:', err);
      setErrorMessage(err?.message || 'Gagal menghapus template dari database.');
      setTimeout(() => setErrorMessage(''), 3500);
    } finally {
      setIsSaving(false);
      setTemplateToDelete(null);
    }
  };

  const handleSaveForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTopik.trim() || !formCatatan.trim()) {
      setErrorMessage('Mohon lengkapi Topik Materi dan Catatan Pembelajaran!');
      setTimeout(() => setErrorMessage(''), 3000);
      return;
    }

    const templateItem: WeeklyMaterialTemplate = {
      id: editingId || `tpl_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      mingguKe: Number(formMingguKe) || 1,
      labelMinggu: formLabelMinggu.trim() || `Minggu ke-${formMingguKe}`,
      topikMateri: formTopik.trim(),
      tujuanPembelajaran: formTP.trim() || undefined,
      catatanKegiatan: formCatatan.trim(),
      jamPelajaranDefault: formJamDefault.length > 0 ? formJamDefault : [1, 2],
      adaTugas: formAdaTugas,
      deskripsiTugas: formAdaTugas ? formDeskripsiTugas.trim() : undefined,
      semester: formSemester,
      updatedAt: new Date().toISOString()
    };

    const oldTemplate = editingId ? localTemplates.find(t => t.id === editingId) : undefined;
    let updated: WeeklyMaterialTemplate[];
    if (editingId) {
      updated = localTemplates.map(t => (t.id === editingId ? templateItem : t));
    } else {
      updated = [...localTemplates, templateItem];
    }

    // Sort by mingguKe
    updated.sort((a, b) => a.mingguKe - b.mingguKe);
    setLocalTemplates(updated);

    try {
      setIsSaving(true);
      const result = await onSaveTemplates(updated, oldTemplate ? { oldTemplate, newTemplate: templateItem } : undefined);
      const updatedJournalsCount = (result && typeof result === 'object' && 'updatedJournalsCount' in result)
        ? (result as any).updatedJournalsCount
        : 0;

      if (editingId) {
        if (updatedJournalsCount && updatedJournalsCount > 0) {
          setSaveSuccessMessage(`✨ Template diperbarui & otomatis disinkronkan ke ${updatedJournalsCount} jurnal kelas yang telah dicatat!`);
        } else {
          setSaveSuccessMessage('Perubahan template berhasil disimpan ke database!');
        }
      } else {
        setSaveSuccessMessage('Template baru berhasil ditambahkan ke database!');
      }
      setTimeout(() => setSaveSuccessMessage(''), 3500);
      handleResetForm();
    } catch (err: any) {
      setErrorMessage(`Gagal menyimpan template: ${err?.message || 'Terjadi kesalahan'}`);
      setTimeout(() => setErrorMessage(''), 3500);
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div 
        className="bg-white w-full max-w-4xl rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh] sm:max-h-[85vh] animate-in zoom-in-95 duration-200"
        role="dialog"
        aria-modal="true"
        aria-labelledby="weekly-modal-title"
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-900 via-indigo-800 to-indigo-950 text-white p-4 sm:p-5 flex items-center justify-between shrink-0 border-b border-indigo-700/50">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-600/60 text-amber-300 rounded-2xl border border-indigo-400/30 shadow-inner">
              <BookMarked className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 id="weekly-modal-title" className="text-base sm:text-lg font-black text-white flex items-center gap-2">
                  Bank Template Materi Mingguan
                </h3>
                <span className="text-[10px] font-black bg-amber-400 text-slate-950 px-2 py-0.5 rounded-full uppercase tracking-wider shadow-xs">
                  {localTemplates.length} Modul
                </span>
              </div>
              <p className="text-xs text-indigo-200 font-medium">
                Pilih materi per minggu untuk otomatis mengisi jurnal di 11 kelas tanpa mengetik ulang.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-indigo-200 hover:text-white hover:bg-white/10 transition cursor-pointer"
            title="Tutup (ESC)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs & Search Toolbar */}
        <div className="bg-slate-50 border-b border-slate-200 p-3 sm:p-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 shrink-0">
          {/* Main Mode Tabs */}
          <div className="flex items-center bg-slate-200/80 p-1 rounded-2xl border border-slate-300/60 self-start">
            <button
              type="button"
              onClick={() => setActiveTab('select')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition flex items-center gap-2 cursor-pointer ${
                activeTab === 'select'
                  ? 'bg-white text-indigo-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <CheckSquare className="w-3.5 h-3.5 text-indigo-600" />
              Pilih &amp; Terapkan ke Jurnal
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('manage')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition flex items-center gap-2 cursor-pointer ${
                activeTab === 'manage'
                  ? 'bg-white text-indigo-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Edit3 className="w-3.5 h-3.5 text-indigo-600" />
              {editingId ? 'Edit Template' : 'Kelola / Tambah Template'}
            </button>
          </div>

          {/* Search & Filter when on select tab */}
          {activeTab === 'select' && (
            <div className="flex items-center gap-2 flex-1 sm:justify-end">
              <div className="relative flex-1 sm:max-w-xs">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Cari materi / TP / minggu..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-xl pl-8 pr-3 py-1.5 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-2xs"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
                  >
                    ×
                  </button>
                )}
              </div>

              {/* Semester Filter */}
              <select
                value={filterSemester}
                onChange={(e) => setFilterSemester(e.target.value as any)}
                className="bg-white border border-slate-200 text-xs font-bold text-slate-700 rounded-xl px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer shadow-2xs"
              >
                <option value="all">Semua Sem.</option>
                <option value="1">Sem. Ganjil</option>
                <option value="2">Sem. Genap</option>
              </select>
            </div>
          )}
        </div>

        {/* Global Save Success Notification Banner */}
        {saveSuccessMessage && (
          <div className="bg-emerald-50 border-b border-emerald-200 text-emerald-800 px-4 py-2 text-xs font-bold flex items-center justify-between gap-2 shrink-0 animate-in fade-in">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{saveSuccessMessage}</span>
            </div>
            <span className="text-[10px] text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded font-mono">Tersimpan di Cloud</span>
          </div>
        )}

        {/* Global Error Notification Banner */}
        {errorMessage && (
          <div className="bg-rose-50 border-b border-rose-200 text-rose-800 px-4 py-2 text-xs font-bold flex items-center justify-between gap-2 shrink-0 animate-in fade-in">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{errorMessage}</span>
            </div>
            <button 
              type="button" 
              onClick={() => setErrorMessage('')}
              className="text-[10px] text-rose-700 hover:text-rose-900 font-black cursor-pointer"
            >
              Tutup
            </button>
          </div>
        )}

        {/* Modal Scrollable Body */}
        <div ref={scrollContainerRef} className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 scroll-smooth">
          <AnimatePresence mode="wait">
            {/* TAB 1: PILIH & TERAPKAN TEMPLATE */}
            {activeTab === 'select' && (
              <motion.div
                key="tab-select"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                className="space-y-4"
              >
                <div className="flex items-center justify-between bg-indigo-50/70 border border-indigo-100 rounded-2xl p-3 sm:p-4">
                  <div className="space-y-0.5">
                    <span className="text-xs font-extrabold text-indigo-950 flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4 text-amber-500" />
                      Penerapan Instan untuk Kelas <span className="text-indigo-700 underline font-black">{activeClassName}</span>
                    </span>
                    <p className="text-[11px] text-indigo-900/80">
                      Klik tombol <strong>"Terapkan ke Jurnal Hari Ini"</strong> pada minggu materi yang diajarkan. Seluruh materi, catatan, TP, dan tugas langsung terisi otomatis!
                    </p>
                  </div>
                </div>

                {filteredTemplates.length === 0 ? (
                  <div className="text-center py-12 bg-slate-50 border border-dashed border-slate-200 rounded-3xl p-6 space-y-3">
                    <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-500 flex items-center justify-center mx-auto">
                      <BookOpen className="w-6 h-6" />
                    </div>
                    <h4 className="text-sm font-extrabold text-slate-800">
                      {searchQuery ? 'Tidak ada template yang cocok dengan pencarian' : 'Bank Template Materi Belum Memiliki Data'}
                    </h4>
                    <p className="text-xs text-slate-500 max-w-md mx-auto">
                      {searchQuery 
                        ? 'Coba gunakan kata kunci lain atau bersihkan filter pencarian.' 
                        : 'Mulai input template materi mingguan Anda secara manual melalui tab Kelola / Tambah Template.'}
                    </p>
                    <div className="flex justify-center gap-2 pt-2">
                      <button
                        type="button"
                        onClick={() => {
                          handleResetForm();
                          setActiveTab('manage');
                        }}
                        className="bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white text-xs font-black px-5 py-2.5 rounded-xl flex items-center gap-2 cursor-pointer shadow-xs transition duration-150"
                      >
                        <Plus className="w-4 h-4" />
                        Tambah Template Manual
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                    {filteredTemplates.map((tpl) => (
                      <div
                        key={tpl.id}
                        className="bg-white border border-slate-200 hover:border-indigo-300 rounded-2xl p-4 hover:shadow-md transition-all duration-200 flex flex-col justify-between gap-3 group relative overflow-hidden"
                      >
                        <div className="space-y-2.5">
                          {/* Top Header of Card */}
                          <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-2">
                            <div className="flex items-center gap-2">
                              <span className="text-[11px] font-black bg-indigo-100 text-indigo-900 px-2.5 py-0.5 rounded-lg border border-indigo-200 shadow-2xs">
                                {tpl.labelMinggu || `Minggu ke-${tpl.mingguKe}`}
                              </span>
                              <span className="text-[10px] font-extrabold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                                Sem. {tpl.semester === 2 ? 'Genap (2)' : 'Ganjil (1)'}
                              </span>
                            </div>

                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => handleEditClick(tpl)}
                                className="px-2.5 py-1 text-indigo-700 bg-indigo-50 hover:bg-indigo-100 active:scale-95 rounded-lg transition text-[11px] font-extrabold flex items-center gap-1 cursor-pointer border border-indigo-200/70"
                                title="Edit Template Ini"
                              >
                                <Edit3 className="w-3 h-3 text-indigo-600" />
                                <span>Edit</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteClick(tpl)}
                                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 active:scale-95 rounded-lg transition cursor-pointer"
                                title="Hapus Template"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>

                          {/* Materi Topik */}
                          <div>
                            <h4 className="text-xs sm:text-sm font-extrabold text-slate-900 leading-snug group-hover:text-indigo-950 transition">
                              {tpl.topikMateri}
                            </h4>
                            {tpl.tujuanPembelajaran && (
                              <p className="text-[11px] font-semibold text-indigo-700 mt-1 flex items-start gap-1 bg-indigo-50/50 p-1.5 rounded-lg border border-indigo-100/60">
                                <span className="shrink-0 font-bold">🎯 TP:</span>
                                <span className="leading-tight">{tpl.tujuanPembelajaran}</span>
                              </p>
                            )}
                          </div>

                          {/* Catatan Pembelajaran Snippet */}
                          <div className="bg-slate-50 border border-slate-100 rounded-xl p-2.5 text-[11px] text-slate-600 leading-relaxed font-medium">
                            <span className="font-bold text-slate-700 block text-[10px] uppercase tracking-wider mb-0.5">Uraian KBM:</span>
                            <p className="line-clamp-3">{tpl.catatanKegiatan}</p>
                          </div>

                          {/* Badges / Extras */}
                          <div className="flex items-center gap-2 flex-wrap pt-0.5">
                            <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-md flex items-center gap-1">
                              <Clock className="w-3 h-3 text-indigo-500" />
                              Jam otomatis ikut jadwal kelas aktif ⚡
                            </span>
                            {tpl.adaTugas && (
                              <span className="text-[10px] font-bold text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md flex items-center gap-1">
                                📌 Ada PR: {tpl.deskripsiTugas || 'Tugas Mandiri'}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex items-center gap-2 pt-1">
                          <button
                            type="button"
                            onClick={() => {
                              onApplyTemplate(tpl);
                              onClose();
                            }}
                            className="flex-1 bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] text-white text-xs font-black py-2.5 px-3 rounded-xl flex items-center justify-center gap-2 cursor-pointer shadow-xs transition duration-150"
                          >
                            <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                            Terapkan ke Jurnal Hari Ini
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </motion.div>
            )}

            {/* TAB 2: KELOLA & TAMBAH TEMPLATE BARU */}
            {activeTab === 'manage' && (
              <motion.div
                key="tab-manage"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                className="space-y-6"
              >
                {/* Add / Edit Form Card */}
                <div 
                  ref={formSectionRefStr}
                  id="form-manage-template-section"
                  className={`transition-all duration-300 rounded-3xl p-4 sm:p-6 space-y-4 ${
                    isFormHighlighted || editingId
                      ? 'bg-indigo-50/50 border-2 border-indigo-500 shadow-xl shadow-indigo-100/80 ring-4 ring-indigo-500/15'
                      : 'bg-slate-50 border border-slate-200 shadow-2xs'
                  }`}
                >
                  {/* Mode Edit Banner Indicator */}
                  {editingId && (
                    <div className="space-y-2 animate-in fade-in slide-in-from-top-1">
                      <div className="bg-amber-50 border border-amber-200/80 text-amber-950 px-3.5 py-2.5 rounded-2xl flex items-center justify-between gap-2 shadow-2xs">
                        <div className="flex items-center gap-2.5">
                          <span className="flex h-2.5 w-2.5 relative shrink-0">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500"></span>
                          </span>
                          <span className="text-xs font-black text-amber-900">
                            Sedang Mengedit: <span className="underline decoration-amber-400">{formLabelMinggu}</span>
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={handleResetForm}
                          className="text-[11px] font-extrabold text-amber-900 hover:text-rose-700 bg-amber-100/80 hover:bg-amber-200/80 px-2.5 py-1 rounded-xl transition cursor-pointer flex items-center gap-1"
                        >
                          <RotateCcw className="w-3 h-3" />
                          Batal Edit
                        </button>
                      </div>

                      {/* Auto-Sync Banner */}
                      <div className="bg-indigo-50/90 border border-indigo-200/90 rounded-2xl p-3 flex items-start gap-2.5 text-xs text-indigo-950 shadow-2xs">
                        <Sparkles className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                        <div className="space-y-0.5">
                          <span className="font-extrabold block text-indigo-950 text-xs">
                            🔄 Auto-Sync Jurnal Guru Aktif
                          </span>
                          <span className="text-[11px] text-indigo-800 leading-relaxed block">
                            Setiap perubahan topik materi atau uraian KBM pada template ini akan <strong>secara otomatis diperbarui pada seluruh jurnal guru</strong> yang telah dicatat sebelumnya.
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="flex items-center justify-between border-b border-slate-200/80 pb-3">
                    <div className="flex items-center gap-2.5">
                      <div className={`p-2 rounded-xl transition-all duration-200 ${editingId ? 'bg-indigo-600 text-white shadow-sm' : 'bg-indigo-100 text-indigo-700'}`}>
                        {editingId ? <Edit3 className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-xs sm:text-sm font-black text-slate-800">
                            {editingId ? `Perbarui Template: ${formLabelMinggu}` : 'Tambah Template Materi Mingguan Baru'}
                          </h4>
                        </div>
                        <p className="text-[10px] text-slate-500">
                          {editingId 
                            ? 'Perbarui rincian topik, TP, uraian KBM, atau jam pelajaran template ini lalu simpan.'
                            : 'Isi form di bawah ini untuk menyimpan modul pembelajaran ke database Firestore.'}
                        </p>
                      </div>
                    </div>

                    {editingId && (
                      <button
                        type="button"
                        onClick={handleResetForm}
                        className="text-xs font-bold text-rose-600 hover:text-rose-800 bg-rose-50 hover:bg-rose-100 border border-rose-200 px-3 py-1.5 rounded-xl flex items-center gap-1.5 cursor-pointer transition shadow-2xs"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        Batal Edit
                      </button>
                    )}
                  </div>

                <form onSubmit={handleSaveForm} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {/* Minggu Ke */}
                    <div>
                      <label className="text-[11px] font-extrabold text-slate-700 block mb-1">
                        Urutan Minggu Ke- <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="40"
                        value={formMingguKe}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          setFormMingguKe(val);
                          if (!editingId) setFormLabelMinggu(`Minggu ke-${val}`);
                        }}
                        className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                        required
                      />
                    </div>

                    {/* Label Minggu */}
                    <div>
                      <label className="text-[11px] font-extrabold text-slate-700 block mb-1">
                        Label / Nama Pertemuan
                      </label>
                      <input
                        type="text"
                        placeholder="Contoh: Minggu ke-1 atau Pertemuan 1"
                        value={formLabelMinggu}
                        onChange={(e) => setFormLabelMinggu(e.target.value)}
                        className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                        required
                      />
                    </div>

                    {/* Semester */}
                    <div>
                      <label className="text-[11px] font-extrabold text-slate-700 block mb-1">
                        Semester
                      </label>
                      <select
                        value={formSemester}
                        onChange={(e) => setFormSemester(Number(e.target.value) as 1 | 2)}
                        className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:outline-none cursor-pointer"
                      >
                        <option value={1}>Semester 1 (Ganjil)</option>
                        <option value={2}>Semester 2 (Genap)</option>
                      </select>
                    </div>
                  </div>

                  {/* Topik Materi */}
                  <div>
                    <label className="text-[11px] font-extrabold text-slate-700 block mb-1">
                      Topik / Judul Materi Pelajaran <span className="text-rose-500">*</span>
                    </label>
                    <input
                      id="form-topik-materi-input"
                      type="text"
                      placeholder="Misal: Penerapan Formula Lanjutan Excel VLOOKUP & HLOOKUP"
                      value={formTopik}
                      onChange={(e) => setFormTopik(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:outline-none placeholder:text-slate-400 transition"
                      required
                    />
                  </div>

                  {/* Tujuan Pembelajaran TP */}
                  <div>
                    <label className="text-[11px] font-extrabold text-slate-700 block mb-1">
                      Tujuan Pembelajaran (TP) Terkait <span className="text-[10px] text-slate-400 font-normal">(Opsional)</span>
                    </label>
                    <input
                      type="text"
                      placeholder="Misal: TP 3.4: Siswa mampu membaca data multi-tabel menggunakan fungsi referensi"
                      value={formTP}
                      onChange={(e) => setFormTP(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:outline-none placeholder:text-slate-400"
                    />
                  </div>

                  {/* Catatan Pembelajaran / Model KBM */}
                  <div>
                    <label className="text-[11px] font-extrabold text-slate-700 block mb-1">
                      Uraian Kegiatan Pembelajaran / Model KBM <span className="text-rose-500">*</span>
                    </label>
                    <textarea
                      rows={3}
                      placeholder="Tuliskan uraian proses belajar mengajar standar yang akan otomatis disalin ke jurnal kelas."
                      value={formCatatan}
                      onChange={(e) => setCatatanForm(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2.5 text-xs font-medium text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:outline-none placeholder:text-slate-400 resize-none leading-relaxed"
                      required
                    />
                  </div>

                  {/* Tugas Mandiri Checkbox */}
                  <div className="bg-white border border-slate-200 p-3.5 rounded-2xl space-y-2">
                    <label className="flex items-center gap-2.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formAdaTugas}
                        onChange={(e) => setFormAdaTugas(e.target.checked)}
                        className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                      />
                      <span className="text-xs font-bold text-slate-800">
                        Sertakan Tugas / Pekerjaan Rumah (PR) pada Minggu Ini
                      </span>
                    </label>

                    {formAdaTugas && (
                      <input
                        type="text"
                        placeholder="Deskripsi tugas, misal: Mengerjakan latihan VLOOKUP pada tabel lab"
                        value={formDeskripsiTugas}
                        onChange={(e) => setFormDeskripsiTugas(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                        required
                      />
                    )}
                  </div>

                  {/* Form Submit Buttons */}
                  <div className="flex items-center justify-end gap-2 pt-2">
                    {editingId && (
                      <button
                        type="button"
                        onClick={handleResetForm}
                        className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-200 transition cursor-pointer"
                      >
                        Batal
                      </button>
                    )}
                    <button
                      type="submit"
                      disabled={isSaving}
                      className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-black px-5 py-2.5 rounded-xl flex items-center gap-2 cursor-pointer shadow-xs transition"
                    >
                      <Save className="w-4 h-4" />
                      {isSaving ? 'Menyimpan ke Cloud...' : editingId ? 'Simpan Perubahan' : 'Tambah ke Bank Template'}
                    </button>
                  </div>
                </form>
              </div>

              {/* Existing Templates Table / List for Management */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider">
                    Daftar Semua Template ({localTemplates.length} Minggu)
                  </h4>
                  <span className="text-[11px] text-slate-500 font-medium">
                    Tersimpan permanen di cloud database
                  </span>
                </div>

                <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-2xs">
                  <div className="overflow-x-auto max-h-72">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead className="bg-slate-100 text-slate-700 font-black border-b border-slate-200 sticky top-0 z-10">
                        <tr>
                          <th className="p-3 w-16 text-center">Minggu</th>
                          <th className="p-3">Topik Materi</th>
                          <th className="p-3 hidden sm:table-cell">Uraian KBM</th>
                          <th className="p-3 w-20 text-center">Semester</th>
                          <th className="p-3 w-24 text-center">Aksi</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {localTemplates.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="p-6 text-center text-slate-400 font-medium">
                              Belum ada template. Silakan masukkan materi melalui formulir di atas.
                            </td>
                          </tr>
                        ) : (
                          localTemplates.map((t) => {
                            const isRowEditing = editingId === t.id;
                            return (
                              <tr 
                                key={t.id} 
                                className={`transition ${
                                  isRowEditing 
                                    ? 'bg-indigo-100/60 font-bold border-l-4 border-l-indigo-600' 
                                    : 'hover:bg-slate-50'
                                }`}
                              >
                                <td className="p-3 text-center font-black text-indigo-700">
                                  {t.mingguKe}
                                </td>
                                <td className="p-3 font-bold text-slate-800">
                                  <div className="flex items-center gap-1.5">
                                    <span>{t.topikMateri}</span>
                                    {isRowEditing && (
                                      <span className="text-[9px] bg-indigo-600 text-white px-1.5 py-0.2 rounded font-black">
                                        Sedang Diedit
                                      </span>
                                    )}
                                  </div>
                                  {t.adaTugas && (
                                    <span className="text-[9px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.2 rounded mt-0.5 inline-block">
                                      PR: {t.deskripsiTugas}
                                    </span>
                                  )}
                                </td>
                                <td className="p-3 text-slate-600 hidden sm:table-cell text-[11px] max-w-xs truncate">
                                  {t.catatanKegiatan}
                                </td>
                                <td className="p-3 text-center text-slate-500 font-semibold">
                                  Sem. {t.semester === 2 ? '2' : '1'}
                                </td>
                                <td className="p-3 text-center">
                                  <div className="flex items-center justify-center gap-1">
                                    <button
                                      type="button"
                                      onClick={() => handleEditClick(t)}
                                      className={`p-1.5 rounded-lg transition cursor-pointer ${
                                        isRowEditing ? 'bg-indigo-600 text-white' : 'text-indigo-600 hover:bg-indigo-50'
                                      }`}
                                      title="Edit"
                                    >
                                      <Edit3 className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteClick(t)}
                                      className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                                      title="Hapus"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
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
              </div>

            </motion.div>
          )}
          </AnimatePresence>
        </div>

        {/* Modal Footer */}
        <div className="bg-slate-50 border-t border-slate-200 p-3 sm:p-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <Sparkles className="w-4 h-4 text-indigo-600" />
            <span className="hidden sm:inline">Bank materi ini berlaku otomatis untuk seluruh 11 kelas yang Anda ampu.</span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl text-xs font-black bg-slate-200 hover:bg-slate-300 text-slate-800 transition cursor-pointer"
          >
            Tutup
          </button>
        </div>
      </div>

      {/* CUSTOM CONFIRMATION MODAL: DELETE TEMPLATE */}
      {templateToDelete && (
        <div 
          className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-150"
          onClick={(e) => {
            if (e.target === e.currentTarget) setTemplateToDelete(null);
          }}
        >
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl border border-slate-200 space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-start gap-3">
              <div className="p-3 bg-rose-100 text-rose-600 rounded-2xl shrink-0">
                <Trash2 className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h4 className="text-sm font-black text-slate-900">
                  Hapus Template Materi?
                </h4>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Apakah Anda yakin ingin menghapus <strong>{templateToDelete.labelMinggu || `Minggu ke-${templateToDelete.mingguKe}`}</strong>?
                </p>
                <div className="p-2 bg-slate-50 border border-slate-200 rounded-xl text-[11px] font-semibold text-slate-700 mt-2">
                  "{templateToDelete.topikMateri}"
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setTemplateToDelete(null)}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={isSaving}
                onClick={handleConfirmDelete}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white text-xs font-black rounded-xl transition flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <Trash2 className="w-3.5 h-3.5" />
                {isSaving ? 'Menghapus...' : 'Ya, Hapus Template'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  function setCatatanForm(val: string) {
    setFormCatatan(val);
  }
};
