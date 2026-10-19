import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence, LayoutGroup } from 'motion/react';
import { 
  Users, 
  X, 
  Shuffle, 
  Copy, 
  Check, 
  Printer, 
  UserCheck, 
  ArrowRightLeft, 
  Sliders, 
  Sparkles,
  Info,
  Edit3,
  Search,
  ArrowUpDown,
  LayoutGrid,
  List,
  ChevronLeft,
  ChevronRight,
  Palette,
  Dices,
  PartyPopper
} from 'lucide-react';
import { Student } from '../types';

interface GroupDividerModalProps {
  isOpen: boolean;
  onClose: () => void;
  students: Student[];
  classNameText: string;
}

interface GroupResult {
  id: number;
  name: string;
  members: Student[];
  maleCount: number;
  femaleCount: number;
}

type DivideMode = 'byGroups' | 'bySize';

// Preset Naming Themes
const PRESET_NAMING_SCHEMES = [
  { id: 'numbers', label: 'Nomor (Kelompok 1, 2...)', prefix: 'Kelompok' },
  { id: 'letters', label: 'Huruf (Kelompok A, B...)', generator: (i: number) => `Kelompok ${String.fromCharCode(65 + i)}` },
  { id: 'animals', label: 'Nama Hewan', names: ['Garuda', 'Elang', 'Rajawali', 'Harimau', 'Singa', 'Serigala', 'Banteng', 'Kancil', 'Cendrawasih', 'Merpati', 'Panda', 'Lumba-lumba'] },
  { id: 'colors', label: 'Nama Warna', names: ['Merah', 'Biru', 'Hijau', 'Kuning', 'Ungu', 'Jingga', 'Cokelat', 'Nila', 'Emas', 'Perak', 'Merah Muda', 'Pirus'] },
  { id: 'planets', label: 'Nama Planet / Alam', names: ['Merkurius', 'Venus', 'Bumi', 'Mars', 'Jupiter', 'Saturnus', 'Uranus', 'Neptunus', 'Galaksi', 'Kosmos', 'Awan', 'Pelangi'] },
];

// Fisher-Yates Shuffle
function shuffleArray<T>(array: T[]): T[] {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

// Audio feedback utilities
const playShuffleTick = () => {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(320 + Math.random() * 380, ctx.currentTime);
    gain.gain.setValueAtTime(0.04, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.06);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.06);
  } catch {
    // Ignore audio context autoplay restriction if any
  }
};

const playFinishChime = () => {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const freqs = [523.25, 659.25, 783.99, 1046.50];
    freqs.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, ctx.currentTime + i * 0.07);
      gain.gain.setValueAtTime(0.08, ctx.currentTime + i * 0.07);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.07 + 0.25);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime + i * 0.07);
      osc.stop(ctx.currentTime + i * 0.07 + 0.25);
    });
  } catch {
    // Ignore audio context autoplay restriction
  }
};

// Confetti Particle Burst Sub-component
function ConfettiParticles() {
  const particles = useMemo(() => {
    const colors = ['#f43f5e', '#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#ec4899', '#3b82f6'];
    return Array.from({ length: 32 }, (_, i) => ({
      id: i,
      x: (Math.random() - 0.5) * 450,
      y: (Math.random() - 0.5) * 300 - 30,
      size: Math.random() * 9 + 4,
      color: colors[i % colors.length],
      rotation: Math.random() * 360,
    }));
  }, []);

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden z-40 flex items-center justify-center">
      {particles.map((p) => (
        <motion.div
          key={p.id}
          initial={{ opacity: 1, scale: 0, x: 0, y: 0, rotate: 0 }}
          animate={{
            opacity: [1, 1, 0],
            scale: [0, 1.3, 0.7],
            x: p.x,
            y: p.y,
            rotate: p.rotation + 360,
          }}
          transition={{ duration: 1.3, ease: 'easeOut' }}
          style={{
            position: 'absolute',
            width: p.size,
            height: p.size,
            backgroundColor: p.color,
            borderRadius: p.id % 2 === 0 ? '50%' : '3px',
          }}
        />
      ))}
    </div>
  );
}

export default function GroupDividerModal({
  isOpen,
  onClose,
  students,
  classNameText
}: GroupDividerModalProps) {
  // Config States
  const [divideMode, setDivideMode] = useState<DivideMode>('byGroups');
  const [numGroups, setNumGroups] = useState<number>(4);
  const [studentsPerGroup, setStudentsPerGroup] = useState<number>(5);
  const [balanceGender, setBalanceGender] = useState<boolean>(true);
  const [namingScheme, setNamingScheme] = useState<string>('numbers');
  
  // Results & UI States
  const [groups, setGroups] = useState<GroupResult[]>([]);
  const [copied, setCopied] = useState<boolean>(false);
  const [isShuffling, setIsShuffling] = useState<boolean>(false);
  const [justShuffled, setJustShuffled] = useState<boolean>(false);
  const [shuffleProgress, setShuffleProgress] = useState<number>(0);
  const [editingGroupId, setEditingGroupId] = useState<number | null>(null);
  const [groupNames, setGroupNames] = useState<{ [key: number]: string }>({});
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [mobileTabGroupIndex, setMobileTabGroupIndex] = useState<number>(-1);
  const [viewLayout, setViewLayout] = useState<'grid' | 'single'>('grid');
  
  // Swap Student Modal / State
  const [swapSource, setSwapSource] = useState<{ groupId: number; student: Student } | null>(null);

  // Student stats
  const totalStudents = students.length;
  const maleStudents = useMemo(() => students.filter(s => s.jenisKelamin === 'L'), [students]);
  const femaleStudents = useMemo(() => students.filter(s => s.jenisKelamin === 'P'), [students]);
  const unknownGenderStudents = useMemo(() => students.filter(s => s.jenisKelamin !== 'L' && s.jenisKelamin !== 'P'), [students]);

  // Calculate target groups count based on mode
  const calculatedGroupCount = useMemo(() => {
    if (totalStudents === 0) return 1;
    if (divideMode === 'byGroups') {
      return Math.max(1, Math.min(totalStudents, numGroups));
    } else {
      const size = Math.max(1, studentsPerGroup);
      return Math.max(1, Math.ceil(totalStudents / size));
    }
  }, [divideMode, numGroups, studentsPerGroup, totalStudents]);

  // Lock body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [isOpen]);

  // Sync default values on open
  useEffect(() => {
    if (isOpen && students.length > 0) {
      const defaultGroupCount = Math.max(2, Math.min(8, Math.ceil(students.length / 5)));
      setNumGroups(defaultGroupCount);
      setStudentsPerGroup(5);
      setMobileTabGroupIndex(-1);
      setViewLayout('grid');
      generateGroups(defaultGroupCount, balanceGender, namingScheme);
    }
  }, [isOpen, students]);

  // Get name for group index
  const getGroupName = (index: number, schemeId: string) => {
    if (groupNames[index + 1]) return groupNames[index + 1];
    
    const scheme = PRESET_NAMING_SCHEMES.find(s => s.id === schemeId);
    if (!scheme) return `Kelompok ${index + 1}`;

    if (scheme.names && scheme.names[index]) {
      return `Kelompok ${scheme.names[index]}`;
    }
    if (scheme.generator) {
      return scheme.generator(index);
    }
    return `Kelompok ${index + 1}`;
  };

  // Main Group Generator
  const generateGroups = (
    targetCount: number, 
    isGenderBalanced: boolean,
    currentNamingScheme: string
  ) => {
    if (students.length === 0) {
      setGroups([]);
      return;
    }

    const actualCount = Math.max(1, Math.min(targetCount, students.length));
    const newGroups: GroupResult[] = Array.from({ length: actualCount }, (_, i) => ({
      id: i + 1,
      name: getGroupName(i, currentNamingScheme),
      members: [],
      maleCount: 0,
      femaleCount: 0
    }));

    if (isGenderBalanced) {
      const shuffledMales = shuffleArray(maleStudents);
      const shuffledFemales = shuffleArray(femaleStudents);
      const shuffledOthers = shuffleArray(unknownGenderStudents);

      // Round-robin for males
      shuffledMales.forEach((m, idx) => {
        const targetGroupIndex = idx % actualCount;
        newGroups[targetGroupIndex].members.push(m);
        newGroups[targetGroupIndex].maleCount++;
      });

      // Reverse round-robin for females to keep groups balanced
      shuffledFemales.forEach((f, idx) => {
        const targetGroupIndex = (actualCount - 1 - (idx % actualCount));
        newGroups[targetGroupIndex].members.push(f);
        newGroups[targetGroupIndex].femaleCount++;
      });

      // Distribute others
      shuffledOthers.forEach((o) => {
        const sortedGroups = [...newGroups].sort((a, b) => a.members.length - b.members.length);
        sortedGroups[0].members.push(o);
        if (o.jenisKelamin === 'L') sortedGroups[0].maleCount++;
        else if (o.jenisKelamin === 'P') sortedGroups[0].femaleCount++;
      });
    } else {
      const shuffled = shuffleArray(students);
      shuffled.forEach((s, idx) => {
        const targetGroupIndex = idx % actualCount;
        newGroups[targetGroupIndex].members.push(s);
        if (s.jenisKelamin === 'L') newGroups[targetGroupIndex].maleCount++;
        else if (s.jenisKelamin === 'P') newGroups[targetGroupIndex].femaleCount++;
      });
    }

    setGroups(newGroups);
  };

  // Re-generate on parameter change
  const handleConfigChange = (
    mode: DivideMode, 
    nGroups: number, 
    sPerGroup: number, 
    balGender: boolean,
    scheme: string
  ) => {
    setDivideMode(mode);
    setNumGroups(nGroups);
    setStudentsPerGroup(sPerGroup);
    setBalanceGender(balGender);
    setNamingScheme(scheme);

    let targetCount = nGroups;
    if (mode === 'bySize') {
      const size = Math.max(1, sPerGroup);
      targetCount = Math.max(1, Math.ceil(totalStudents / size));
    }

    generateGroups(targetCount, balGender, scheme);
  };

  // Reshuffle trigger with smooth professional animation
  const handleReshuffle = () => {
    if (isShuffling) return;
    setIsShuffling(true);
    setJustShuffled(false);
    setShuffleProgress(0);

    let count = 0;
    const maxTicks = 14;
    const intervalTime = 80; // ms

    const timer = setInterval(() => {
      count++;
      setShuffleProgress(Math.round((count / maxTicks) * 100));
      playShuffleTick();

      if (count >= maxTicks) {
        clearInterval(timer);
        generateGroups(calculatedGroupCount, balanceGender, namingScheme);
        setIsShuffling(false);
        setJustShuffled(true);
        playFinishChime();
        setTimeout(() => setJustShuffled(false), 2600);
      }
    }, intervalTime);
  };

  // Change preset theme names
  const handleSchemeChange = (newScheme: string) => {
    setNamingScheme(newScheme);
    // Reset individual custom names to apply preset
    setGroupNames({});
    setGroups(prev => prev.map((g, idx) => ({
      ...g,
      name: getGroupName(idx, newScheme)
    })));
  };

  // Move student between groups manually
  const handleSwapStudent = (targetGroupId: number) => {
    if (!swapSource || swapSource.groupId === targetGroupId) {
      setSwapSource(null);
      return;
    }

    const { groupId: srcGroupId, student } = swapSource;

    setGroups(prev => {
      return prev.map(g => {
        if (g.id === srcGroupId) {
          const filtered = g.members.filter(m => (m.nis || m.nama) !== (student.nis || student.nama));
          const mCount = filtered.filter(m => m.jenisKelamin === 'L').length;
          const fCount = filtered.filter(m => m.jenisKelamin === 'P').length;
          return { ...g, members: filtered, maleCount: mCount, femaleCount: fCount };
        }
        if (g.id === targetGroupId) {
          const updated = [...g.members, student];
          const mCount = updated.filter(m => m.jenisKelamin === 'L').length;
          const fCount = updated.filter(m => m.jenisKelamin === 'P').length;
          return { ...g, members: updated, maleCount: mCount, femaleCount: fCount };
        }
        return g;
      });
    });

    setSwapSource(null);
  };

  const handleGroupNameChange = (id: number, newName: string) => {
    setGroupNames(prev => ({ ...prev, [id]: newName }));
    setGroups(prev => prev.map(g => g.id === id ? { ...g, name: newName } : g));
  };

  // Copy text to WhatsApp formatted message
  const handleCopyText = () => {
    let text = `📌 *PEMBAGIAN KELOMPOK - KELAS ${classNameText.toUpperCase()}*\n`;
    text += `📊 Total: ${students.length} Siswa | ${groups.length} Kelompok\n`;
    text += `⚙️ Metode: ${balanceGender ? 'Proporsional L/P Merata' : 'Acak Sepenuhnya'}\n`;
    text += `====================================\n\n`;

    groups.forEach((g) => {
      text += `*${g.name.toUpperCase()}* (${g.members.length} Siswa: ${g.maleCount}L / ${g.femaleCount}P)\n`;
      g.members.forEach((m, i) => {
        const genderBadge = m.jenisKelamin ? `[${m.jenisKelamin}]` : '';
        text += `${i + 1}. ${m.nama} ${genderBadge}\n`;
      });
      text += `\n`;
    });

    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  // Print format generator
  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    let html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Pembagian Kelompok Kelas ${classNameText}</title>
        <style>
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 25px; color: #0f172a; }
          h1 { font-size: 22px; margin-bottom: 4px; text-align: center; text-transform: uppercase; letter-spacing: 0.5px; }
          .subtitle { font-size: 13px; color: #475569; text-align: center; margin-bottom: 20px; padding-bottom: 12px; border-bottom: 2px dashed #cbd5e1; }
          .grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; }
          .card { border: 1.5px solid #94a3b8; border-radius: 10px; padding: 14px; page-break-inside: avoid; background: #fff; }
          .card-title { font-weight: 800; font-size: 15px; margin-bottom: 10px; background: #f1f5f9; padding: 8px 12px; border-radius: 6px; display: flex; justify-content: space-between; align-items: center; }
          ol { margin: 0; padding-left: 22px; font-size: 13px; line-height: 1.6; }
          li { font-weight: 600; color: #1e293b; }
          .gender { font-size: 11px; font-weight: normal; color: #64748b; margin-left: 4px; }
          @media print {
            body { padding: 0; }
            .grid { grid-template-columns: repeat(2, 1fr); }
          }
        </style>
      </head>
      <body>
        <h1>PEMBAGIAN KELOMPOK BELAJAR SISWA</h1>
        <div class="subtitle">Kelas: <strong>${classNameText}</strong> | Total Siswa: ${students.length} | Jumlah Kelompok: ${groups.length}</div>
        <div class="grid">
    `;

    groups.forEach(g => {
      html += `
        <div class="card">
          <div class="card-title">
            <span>${g.name}</span>
            <span style="font-size: 11px; font-weight: normal; color: #475569;">${g.members.length} Siswa (${g.maleCount}L / ${g.femaleCount}P)</span>
          </div>
          <ol>
      `;
      g.members.forEach(m => {
        html += `<li>${m.nama} <span class="gender">(${m.jenisKelamin || '-'})</span></li>`;
      });
      html += `
          </ol>
        </div>
      `;
    });

    html += `
        </div>
        <script>
          window.onload = function() { window.print(); }
        </script>
      </body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
  };

  // Card color palette definitions
  const CARD_THEMES = [
    { bg: 'bg-indigo-600', text: 'text-white', badge: 'bg-indigo-500/30 text-white', border: 'border-indigo-200', highlight: 'text-indigo-600 bg-indigo-50' },
    { bg: 'bg-emerald-600', text: 'text-white', badge: 'bg-emerald-500/30 text-white', border: 'border-emerald-200', highlight: 'text-emerald-600 bg-emerald-50' },
    { bg: 'bg-amber-600', text: 'text-white', badge: 'bg-amber-500/30 text-white', border: 'border-amber-200', highlight: 'text-amber-600 bg-amber-50' },
    { bg: 'bg-rose-600', text: 'text-white', badge: 'bg-rose-500/30 text-white', border: 'border-rose-200', highlight: 'text-rose-600 bg-rose-50' },
    { bg: 'bg-cyan-600', text: 'text-white', badge: 'bg-cyan-500/30 text-white', border: 'border-cyan-200', highlight: 'text-cyan-600 bg-cyan-50' },
    { bg: 'bg-violet-600', text: 'text-white', badge: 'bg-violet-500/30 text-white', border: 'border-violet-200', highlight: 'text-violet-600 bg-violet-50' },
    { bg: 'bg-teal-600', text: 'text-white', badge: 'bg-teal-500/30 text-white', border: 'border-teal-200', highlight: 'text-teal-600 bg-teal-50' },
    { bg: 'bg-fuchsia-600', text: 'text-white', badge: 'bg-fuchsia-500/30 text-white', border: 'border-fuchsia-200', highlight: 'text-fuchsia-600 bg-fuchsia-50' }
  ];

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
    <AnimatePresence>
      <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[9999] flex items-center justify-center p-2 sm:p-4 overflow-y-auto pointer-events-auto overscroll-none">
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 12 }}
          transition={{ duration: 0.2 }}
          className="bg-slate-50 border border-slate-200 rounded-2xl sm:rounded-3xl shadow-2xl w-full max-w-6xl max-h-[96vh] sm:max-h-[90vh] flex flex-col overflow-hidden select-text relative z-10"
        >
          {/* Header Bar */}
          <div className="px-4 sm:px-6 py-3.5 sm:py-4 bg-white border-b border-slate-200 flex items-center justify-between shrink-0 shadow-2xs">
            <div className="flex items-center gap-3 min-w-0">
              <div className="p-2.5 bg-gradient-to-br from-emerald-500 to-teal-600 text-white rounded-2xl shadow-sm shrink-0">
                <Users className="w-5 h-5 sm:w-6 sm:h-6" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-base sm:text-lg font-black text-slate-900 tracking-tight">
                    Bagi Kelompok Siswa
                  </h2>
                  <span className="text-xs font-black bg-emerald-100 text-emerald-800 border border-emerald-300 px-2.5 py-0.5 rounded-full shrink-0">
                    Kelas {classNameText}
                  </span>
                </div>
                <p className="text-xs text-slate-500 font-semibold truncate hidden sm:block">
                  Membagi {totalStudents} siswa ({maleStudents.length} Laki-Laki, {femaleStudents.length} Perempuan) secara otomatis & merata
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {/* Layout Switcher (Desktop) */}
              <div className="hidden md:flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
                <button
                  onClick={() => setViewLayout('grid')}
                  className={`p-1.5 rounded-lg text-xs font-bold transition ${viewLayout === 'grid' ? 'bg-white text-indigo-600 shadow-2xs' : 'text-slate-500 hover:text-slate-800'}`}
                  title="Tampilan Grid Semua Kelompok"
                >
                  <LayoutGrid className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setViewLayout('single')}
                  className={`p-1.5 rounded-lg text-xs font-bold transition ${viewLayout === 'single' ? 'bg-white text-indigo-600 shadow-2xs' : 'text-slate-500 hover:text-slate-800'}`}
                  title="Tampilan Tab Per Kelompok"
                >
                  <List className="w-4 h-4" />
                </button>
              </div>

              <button
                onClick={onClose}
                className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Config Controls Header */}
          <div className="p-3 sm:p-5 bg-white border-b border-slate-200 space-y-3 shrink-0">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
              
              {/* Mode Selection */}
              <div className="bg-slate-50 p-2.5 sm:p-3 rounded-2xl border border-slate-200 flex flex-col justify-between space-y-2">
                <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Sliders className="w-3.5 h-3.5 text-indigo-600" />
                    Metode Pembagian
                  </span>
                </label>

                <div className="grid grid-cols-2 gap-1 bg-slate-200/80 p-1 rounded-xl">
                  <button
                    type="button"
                    onClick={() => handleConfigChange('byGroups', numGroups, studentsPerGroup, balanceGender, namingScheme)}
                    className={`py-1.5 text-[11px] font-extrabold rounded-lg transition ${
                      divideMode === 'byGroups' ? 'bg-white text-indigo-700 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Jml Kelompok
                  </button>
                  <button
                    type="button"
                    onClick={() => handleConfigChange('bySize', numGroups, studentsPerGroup, balanceGender, namingScheme)}
                    className={`py-1.5 text-[11px] font-extrabold rounded-lg transition ${
                      divideMode === 'bySize' ? 'bg-white text-indigo-700 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Siswa / Kelompok
                  </button>
                </div>
              </div>

              {/* Slider / Count Input */}
              <div className="bg-slate-50 p-2.5 sm:p-3 rounded-2xl border border-slate-200 flex flex-col justify-between space-y-2">
                <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                  <span>{divideMode === 'byGroups' ? 'Jumlah Kelompok:' : 'Target Per Kelompok:'}</span>
                  <span className="text-xs font-black text-indigo-700 bg-indigo-100 px-2 py-0.5 rounded-md border border-indigo-200">
                    {divideMode === 'byGroups' ? `${numGroups} Kelompok` : `${studentsPerGroup} Siswa`}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      if (divideMode === 'byGroups') {
                        const nextVal = Math.max(2, numGroups - 1);
                        handleConfigChange('byGroups', nextVal, studentsPerGroup, balanceGender, namingScheme);
                      } else {
                        const nextVal = Math.max(2, studentsPerGroup - 1);
                        handleConfigChange('bySize', numGroups, nextVal, balanceGender, namingScheme);
                      }
                    }}
                    className="w-8 h-8 rounded-xl bg-white border border-slate-200 font-black text-slate-700 hover:bg-indigo-50 hover:text-indigo-600 transition flex items-center justify-center shrink-0 cursor-pointer"
                  >
                    -
                  </button>
                  <input
                    type="range"
                    min={2}
                    max={divideMode === 'byGroups' ? Math.max(2, Math.min(15, totalStudents)) : Math.max(2, Math.min(15, totalStudents))}
                    value={divideMode === 'byGroups' ? numGroups : studentsPerGroup}
                    onChange={(e) => {
                      const val = parseInt(e.target.value) || 2;
                      if (divideMode === 'byGroups') {
                        handleConfigChange('byGroups', val, studentsPerGroup, balanceGender, namingScheme);
                      } else {
                        handleConfigChange('bySize', numGroups, val, balanceGender, namingScheme);
                      }
                    }}
                    className="w-full accent-indigo-600 cursor-pointer h-2 bg-slate-200 rounded-lg"
                  />
                  <button
                    onClick={() => {
                      if (divideMode === 'byGroups') {
                        const nextVal = Math.min(totalStudents, numGroups + 1);
                        handleConfigChange('byGroups', nextVal, studentsPerGroup, balanceGender, namingScheme);
                      } else {
                        const nextVal = Math.min(totalStudents, studentsPerGroup + 1);
                        handleConfigChange('bySize', numGroups, nextVal, balanceGender, namingScheme);
                      }
                    }}
                    className="w-8 h-8 rounded-xl bg-white border border-slate-200 font-black text-slate-700 hover:bg-indigo-50 hover:text-indigo-600 transition flex items-center justify-center shrink-0 cursor-pointer"
                  >
                    +
                  </button>
                </div>
              </div>

              {/* Gender Balance Toggle */}
              <div className="bg-slate-50 p-2.5 sm:p-3 rounded-2xl border border-slate-200 flex flex-col justify-between space-y-2">
                <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                  <span className="flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                    Proporsi Gender (L/P)
                  </span>
                  <span className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${balanceGender ? 'bg-emerald-100 text-emerald-800 border-emerald-200' : 'bg-slate-200 text-slate-600 border-slate-300'}`}>
                    {balanceGender ? 'Merata' : 'Acak'}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => handleConfigChange(divideMode, numGroups, studentsPerGroup, !balanceGender, namingScheme)}
                  className={`w-full py-1.5 px-3 rounded-xl text-xs font-extrabold transition cursor-pointer flex items-center justify-center gap-2 border ${
                    balanceGender
                      ? 'bg-emerald-600 text-white border-emerald-700 shadow-2xs hover:bg-emerald-700'
                      : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                  }`}
                >
                  <ArrowRightLeft className="w-3.5 h-3.5" />
                  <span>{balanceGender ? 'Rasio L/P Diatur Merata' : 'Acak Murni Sepenuhnya'}</span>
                </button>
              </div>

              {/* Preset Naming Scheme Selector */}
              <div className="bg-slate-50 p-2.5 sm:p-3 rounded-2xl border border-slate-200 flex flex-col justify-between space-y-2">
                <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                  <span className="flex items-center gap-1.5">
                    <Palette className="w-3.5 h-3.5 text-purple-600" />
                    Gaya Nama Kelompok
                  </span>
                </div>

                <select
                  value={namingScheme}
                  onChange={(e) => handleSchemeChange(e.target.value)}
                  className="w-full py-1.5 px-2.5 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 cursor-pointer"
                >
                  {PRESET_NAMING_SCHEMES.map((scheme) => (
                    <option key={scheme.id} value={scheme.id}>
                      {scheme.label}
                    </option>
                  ))}
                </select>
              </div>

            </div>

            {/* Quick Action Bar (Shuffle, Copy, Print, Search) */}
            <div className="flex items-center justify-between gap-2 pt-1 flex-wrap">
              <div className="flex items-center gap-2 flex-1 min-w-[240px]">
                <div className="relative flex-1">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Cari nama siswa di kelompok..."
                    className="w-full pl-8 pr-3 py-1.5 bg-slate-100 focus:bg-white border border-slate-200 focus:border-indigo-400 rounded-xl text-xs font-semibold text-slate-800 placeholder-slate-400 transition outline-none"
                  />
                  {searchQuery && (
                    <button 
                      onClick={() => setSearchQuery('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-bold"
                    >
                      ×
                    </button>
                  )}
                </div>

                {swapSource && (
                  <div className="bg-amber-100 text-amber-900 border border-amber-300 px-3 py-1 rounded-xl text-xs font-extrabold flex items-center gap-2 animate-pulse">
                    <span>Pilih kelompok tujuan untuk memindahkan <strong>{swapSource.student.nama}</strong></span>
                    <button 
                      onClick={() => setSwapSource(null)}
                      className="p-0.5 hover:bg-amber-200 rounded text-amber-800"
                    >
                      ✕
                    </button>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={handleReshuffle}
                  disabled={isShuffling}
                  className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white rounded-xl text-xs font-black transition cursor-pointer flex items-center gap-1.5 shadow-2xs disabled:opacity-50"
                  title="Acak Ulang Susunan Kelompok"
                >
                  <Shuffle className={`w-3.5 h-3.5 ${isShuffling ? 'animate-spin' : ''}`} />
                  <span>Acak Ulang</span>
                </button>

                <button
                  onClick={handleCopyText}
                  className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-900 active:scale-95 text-white rounded-xl text-xs font-black transition cursor-pointer flex items-center gap-1.5 shadow-2xs"
                  title="Salin Teks ke Format WhatsApp"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? 'Tersalin!' : 'Salin WA'}</span>
                </button>

                <button
                  onClick={handlePrint}
                  className="p-1.5 bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 rounded-xl text-xs font-bold transition cursor-pointer flex items-center justify-center shadow-2xs"
                  title="Cetak Pembagian Kelompok Ini"
                >
                  <Printer className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Mobile Group Tabs (Visible on small screens) */}
          <div className="md:hidden bg-slate-200/70 p-1.5 flex gap-1 overflow-x-auto shrink-0 border-b border-slate-300">
            <button
              onClick={() => setMobileTabGroupIndex(-1)}
              className={`px-3 py-1 rounded-lg text-xs font-extrabold whitespace-nowrap transition ${
                mobileTabGroupIndex === -1 ? 'bg-indigo-600 text-white shadow-2xs' : 'bg-white/80 text-slate-700'
              }`}
            >
              Semua ({groups.length})
            </button>
            {groups.map((g, idx) => (
              <button
                key={g.id}
                onClick={() => setMobileTabGroupIndex(idx)}
                className={`px-3 py-1 rounded-lg text-xs font-extrabold whitespace-nowrap transition flex items-center gap-1.5 ${
                  mobileTabGroupIndex === idx ? 'bg-indigo-600 text-white shadow-2xs' : 'bg-white/80 text-slate-700'
                }`}
              >
                <span>{g.name}</span>
                <span className="text-[10px] bg-black/10 px-1.5 py-0.2 rounded-full">{g.members.length}</span>
              </button>
            ))}
          </div>

          {/* Main Content Area - Display Groups */}
          <div className="p-3 sm:p-6 overflow-y-auto flex-1 bg-slate-100/80 relative">
            {totalStudents === 0 ? (
              <div className="text-center py-16 text-slate-400 space-y-2">
                <Info className="w-10 h-10 mx-auto text-slate-300" />
                <p className="text-sm font-bold">Tidak ada data siswa di kelas ini.</p>
              </div>
            ) : (
              <div>
                {/* Shuffling Status & Success Banners */}
                <AnimatePresence>
                  {isShuffling && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="mb-4 bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 p-3 rounded-2xl text-white shadow-lg flex flex-col sm:flex-row items-center justify-between gap-2 border border-white/20 overflow-hidden relative"
                    >
                      <div className="flex items-center gap-2.5 z-10">
                        <div className="p-2 bg-white/20 backdrop-blur-md rounded-xl animate-spin">
                          <Dices className="w-5 h-5 text-yellow-300" />
                        </div>
                        <div>
                          <p className="text-xs font-black tracking-wide">Sedang Mengacak Kelompok...</p>
                          <p className="text-[10px] text-indigo-100 font-semibold">Mengacak & membagikan {totalStudents} siswa secara adil</p>
                        </div>
                      </div>

                      <div className="w-full sm:w-48 bg-black/20 h-2.5 rounded-full overflow-hidden border border-white/20 p-0.5 z-10">
                        <div 
                          className="bg-gradient-to-r from-amber-300 to-emerald-400 h-full rounded-full transition-all duration-75"
                          style={{ width: `${shuffleProgress}%` }}
                        />
                      </div>
                    </motion.div>
                  )}

                  {justShuffled && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      className="mb-4 bg-emerald-600 text-white p-2.5 rounded-2xl shadow-md flex items-center justify-between gap-2 border border-emerald-400/30"
                    >
                      <div className="flex items-center gap-2">
                        <PartyPopper className="w-5 h-5 text-yellow-300 animate-bounce" />
                        <span className="text-xs font-black">Kelompok Berhasil Diacak! Susunan Baru Telah Diberlakukan.</span>
                      </div>
                      <span className="text-[10px] bg-white/20 px-2 py-0.5 rounded-full font-extrabold">{groups.length} Kelompok</span>
                    </motion.div>
                  )}
                </AnimatePresence>

                {justShuffled && <ConfettiParticles />}

                {/* Single View Mode or Tab View for Mobile */}
                {(viewLayout === 'single' || (mobileTabGroupIndex >= 0)) ? (
                  <div className="max-w-2xl mx-auto space-y-4">
                    {/* Navigation Carousel Controls */}
                    <div className="flex items-center justify-between bg-white p-2.5 rounded-2xl border border-slate-200 shadow-2xs">
                      <button
                        onClick={() => setMobileTabGroupIndex(prev => Math.max(0, prev - 1))}
                        disabled={mobileTabGroupIndex <= 0}
                        className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-extrabold disabled:opacity-40 flex items-center gap-1 cursor-pointer"
                      >
                        <ChevronLeft className="w-4 h-4" />
                        <span>Sebelumnya</span>
                      </button>

                      <div className="text-center">
                        <span className="text-xs font-black text-indigo-700">
                          {groups[Math.max(0, mobileTabGroupIndex)]?.name || 'Kelompok'}
                        </span>
                        <p className="text-[10px] text-slate-400 font-medium">
                          Kelompok {Math.max(0, mobileTabGroupIndex) + 1} dari {groups.length}
                        </p>
                      </div>

                      <button
                        onClick={() => setMobileTabGroupIndex(prev => Math.min(groups.length - 1, prev + 1))}
                        disabled={mobileTabGroupIndex >= groups.length - 1}
                        className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-extrabold disabled:opacity-40 flex items-center gap-1 cursor-pointer"
                      >
                        <span>Berikutnya</span>
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Active Group Card */}
                    {groups[Math.max(0, mobileTabGroupIndex)] && (
                      <GroupCard 
                        group={groups[Math.max(0, mobileTabGroupIndex)]} 
                        index={Math.max(0, mobileTabGroupIndex)}
                        theme={CARD_THEMES[Math.max(0, mobileTabGroupIndex) % CARD_THEMES.length]}
                        searchQuery={searchQuery}
                        editingGroupId={editingGroupId}
                        setEditingGroupId={setEditingGroupId}
                        onGroupNameChange={handleGroupNameChange}
                        swapSource={swapSource}
                        setSwapSource={setSwapSource}
                        onSwapTarget={handleSwapStudent}
                        isShuffling={isShuffling}
                      />
                    )}
                  </div>
                ) : (
                  /* Grid View (Default Desktop & Mobile "Semua") */
                  <LayoutGroup id="groups-grid">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
                      {groups.map((g, idx) => (
                        <GroupCard 
                          key={g.id}
                          group={g} 
                          index={idx}
                          theme={CARD_THEMES[idx % CARD_THEMES.length]}
                          searchQuery={searchQuery}
                          editingGroupId={editingGroupId}
                          setEditingGroupId={setEditingGroupId}
                          onGroupNameChange={handleGroupNameChange}
                          swapSource={swapSource}
                          setSwapSource={setSwapSource}
                          onSwapTarget={handleSwapStudent}
                          isShuffling={isShuffling}
                        />
                      ))}
                    </div>
                  </LayoutGroup>
                )}
              </div>
            )}
          </div>

          {/* Footer Info */}
          <div className="px-4 sm:px-6 py-3 bg-white border-t border-slate-200 flex items-center justify-between text-xs text-slate-500 font-medium shrink-0">
            <span className="flex items-center gap-1.5 text-slate-600 truncate">
              <UserCheck className="w-4 h-4 text-emerald-600 shrink-0" />
              <span className="truncate">Siswa dapat dipindahkan manual dengan mengklik nama siswa & memilih kelompok tujuan.</span>
            </span>

            <button
              onClick={onClose}
              className="px-4 py-1.5 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-xl text-xs transition cursor-pointer shrink-0 ml-2"
            >
              Selesai
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

// Individual Group Card Sub-Component
interface GroupCardProps {
  group: GroupResult;
  index: number;
  theme: { bg: string; text: string; badge: string; border: string; highlight: string };
  searchQuery: string;
  editingGroupId: number | null;
  setEditingGroupId: (id: number | null) => void;
  onGroupNameChange: (id: number, newName: string) => void;
  swapSource: { groupId: number; student: Student } | null;
  setSwapSource: (source: { groupId: number; student: Student } | null) => void;
  onSwapTarget: (targetGroupId: number) => void;
  isShuffling?: boolean;
}

function GroupCard({
  group,
  index,
  theme,
  searchQuery,
  editingGroupId,
  setEditingGroupId,
  onGroupNameChange,
  swapSource,
  setSwapSource,
  onSwapTarget,
  isShuffling = false
}: GroupCardProps) {
  const isTargetForSwap = swapSource && swapSource.groupId !== group.id;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12, scale: 0.96 }}
      animate={{ 
        opacity: 1, 
        y: 0,
        scale: isShuffling ? [1, 1.015, 0.985, 1] : 1,
      }}
      transition={{
        duration: 0.25,
        delay: index * 0.03,
        ease: [0.16, 1, 0.3, 1]
      }}
      className={`bg-white rounded-2xl border ${theme.border} shadow-2xs overflow-hidden flex flex-col transition-all duration-200 relative ${
        isShuffling ? 'ring-2 ring-indigo-500/80 border-indigo-400 shadow-lg shadow-indigo-100/60' : ''
      } ${
        isTargetForSwap ? 'ring-2 ring-amber-400 border-amber-400 bg-amber-50/20' : ''
      }`}
    >
      {/* Card Header */}
      <div className={`${theme.bg} ${theme.text} p-3 flex items-center justify-between shrink-0 relative overflow-hidden`}>
        {isShuffling && (
          <motion.div 
            className="absolute inset-0 bg-gradient-to-r from-transparent via-white/25 to-transparent pointer-events-none"
            animate={{ x: ['-100%', '100%'] }}
            transition={{ repeat: Infinity, duration: 0.8, ease: 'linear' }}
          />
        )}
        {editingGroupId === group.id ? (
          <input
            type="text"
            value={group.name}
            onChange={(e) => onGroupNameChange(group.id, e.target.value)}
            onBlur={() => setEditingGroupId(null)}
            onKeyDown={(e) => e.key === 'Enter' && setEditingGroupId(null)}
            autoFocus
            className="bg-white/20 text-white font-black text-sm px-2 py-0.5 rounded border border-white/40 focus:outline-none w-36"
          />
        ) : (
          <div 
            onClick={() => setEditingGroupId(group.id)}
            className="flex items-center gap-1.5 cursor-pointer group/title min-w-0"
            title="Klik untuk ubah nama kelompok"
          >
            <span className="font-black text-sm tracking-wide truncate">{group.name}</span>
            {isShuffling ? (
              <Dices className="w-3.5 h-3.5 text-yellow-300 animate-spin shrink-0" />
            ) : (
              <Edit3 className="w-3 h-3 opacity-60 group-hover/title:opacity-100 transition shrink-0" />
            )}
          </div>
        )}

        <div className="flex items-center gap-1.5 shrink-0">
          <div className={`text-[10px] font-black px-2 py-0.5 rounded-full ${theme.badge} flex items-center gap-1`}>
            <span>{group.members.length} S</span>
            <span>•</span>
            <span>{group.maleCount}L/{group.femaleCount}P</span>
          </div>

          {isTargetForSwap && (
            <button
              onClick={() => onSwapTarget(group.id)}
              className="bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-[10px] px-2 py-0.5 rounded-md shadow-xs animate-bounce"
            >
              Pindah Sini ↵
            </button>
          )}
        </div>
      </div>

      {/* Members List */}
      <div className="p-2 sm:p-2.5 divide-y divide-slate-100 flex-1 overflow-y-auto max-h-64 min-h-[140px] relative">
        {group.members.length === 0 ? (
          <div className="text-center py-8 text-xs text-slate-400 font-semibold italic">
            Kelompok Kosong
          </div>
        ) : (
          group.members.map((m, mIdx) => {
            const isMatch = searchQuery.trim() !== '' && m.nama.toLowerCase().includes(searchQuery.toLowerCase());
            const isSelectedForSwap = swapSource && swapSource.student.nama === m.nama && swapSource.groupId === group.id;

            return (
              <motion.div
                key={m.nis || (m.nama + '_' + mIdx)}
                layout
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.15, ease: 'easeOut' }}
                onClick={() => {
                  if (isSelectedForSwap) {
                    setSwapSource(null);
                  } else {
                    setSwapSource({ groupId: group.id, student: m });
                  }
                }}
                className={`py-1.5 px-2 rounded-xl flex items-center justify-between text-xs transition cursor-pointer ${
                  isSelectedForSwap
                    ? 'bg-amber-100 text-amber-900 font-black border border-amber-300'
                    : isMatch
                    ? 'bg-yellow-100 font-extrabold text-slate-900 border border-yellow-300'
                    : 'hover:bg-slate-50 text-slate-800 font-medium'
                }`}
                title="Klik untuk memilih siswa & pindahkan ke kelompok lain"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-[10px] font-bold text-slate-400 w-4 text-right shrink-0">
                    {mIdx + 1}.
                  </span>
                  <span className="truncate">
                    {m.nama}
                  </span>
                </div>

                <div className="flex items-center gap-1.5 shrink-0 ml-1">
                  <span className={`text-[10px] font-black px-1.5 py-0.2 rounded ${
                    m.jenisKelamin === 'L' 
                      ? 'bg-blue-50 text-blue-700 border border-blue-200' 
                      : m.jenisKelamin === 'P'
                      ? 'bg-pink-50 text-pink-700 border border-pink-200'
                      : 'bg-slate-100 text-slate-600'
                  }`}>
                    {m.jenisKelamin || '-'}
                  </span>
                </div>
              </motion.div>
            );
          })
        )}
      </div>
    </motion.div>
  );
}
