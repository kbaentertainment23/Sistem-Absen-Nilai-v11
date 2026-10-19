export interface Student {
  noAbsen?: string;
  nis: string;
  nama: string;
  jenisKelamin?: 'L' | 'P';
  kelas?: string;
  foto?: string; // Base64 encoded compressed photo
  label?: string; // e.g. "Ketua Kelas", "OSIS", "Siswa Bermasalah", etc.
}

export interface AttendanceRecord {
  tanggal: string; // YYYY-MM-DD
  nis: string;
  nama: string;
  jenisKelamin?: 'L' | 'P';
  kelas?: string;
  semester?: 1 | 2;
  tahunAjaran?: string;
  semester_tahun?: string; // Composite Partition Key (e.g. "sem1_2026_2027" or "sem1_2024")
  status: 'Hadir' | 'Sakit' | 'Izin' | 'Alfa';
  terlambat: number; // minutes
  keterangan: string;
}

export interface GradeColumn {
  key: string;
  label: string;
  description?: string;
}

export interface GradeFormative {
  nis: string;
  nama: string;
  jenisKelamin?: 'L' | 'P';
  kelas?: string;
  semester?: 1 | 2;
  tahunAjaran?: string;
  semester_tahun?: string;
  rataRata: number | null;
  [key: string]: any; // supports f1, f2, f3, f4, etc. dynamically
}

export interface GradeSummative {
  nis: string;
  nama: string;
  jenisKelamin?: 'L' | 'P';
  kelas?: string;
  semester?: 1 | 2;
  tahunAjaran?: string;
  semester_tahun?: string;
  rataRata: number | null;
  [key: string]: any; // supports s1, s2, s3, uas, etc. dynamically
}

export interface MonthlyRecap {
  nis: string;
  nama: string;
  jenisKelamin?: 'L' | 'P';
  kelas?: string;
  hadir: number;
  sakit: number;
  izin: number;
  alfa: number;
  terlambatCount: number;
  persentaseKehadiran: number;
}

export interface SpreadsheetInfo {
  id: string;
  name: string;
  url: string;
}

export interface StudentNote {
  id: string;
  tanggal: string; // YYYY-MM-DD
  nis: string;
  nama: string;
  kelas: string;
  semester?: 1 | 2;
  tahunAjaran?: string;
  semester_tahun?: string;
  jamPembelajaran: string; // e.g. "Jam 1-2 (07:00-08:30)"
  tipe: 'aktif' | 'bermasalah';
  catatan: string;
}

export interface ExtraTikPeserta {
  nis: string;
  nama: string;
  kelas: string;
  tanggalDaftar: string;
  status: 'Aktif' | 'Alumni' | 'Keluar';
}

export interface ExtraTikAbsensi {
  tanggal: string;
  nis: string;
  nama: string;
  kelas: string;
  semester?: 1 | 2;
  tahunAjaran?: string;
  semester_tahun?: string;
  statusKehadiran: 'Hadir' | 'Sakit' | 'Izin' | 'Alfa';
  keterangan: string;
}

export interface ExtraTikNilai {
  nis: string;
  nama: string;
  kelas: string;
  semester?: 1 | 2;
  tahunAjaran?: string;
  semester_tahun?: string;
  nilaiTugas: number | null;
  nilaiPraktik: number | null;
  nilaiTeori: number | null;
  rataRata: number | null;
  predikat: string;
}

export interface JurnalHarianRecord {
  id: string;
  tanggal: string; // YYYY-MM-DD
  kelas: string;
  semester?: 1 | 2;
  tahunAjaran?: string;
  semester_tahun?: string;
  jamPelajaran: number[]; // e.g., [2, 3]
  materi: string;
  catatan: string;
  hambatan?: string;
  solusi?: string;
  keaktifan?: number; // 1-5 rating
  adaTugas?: boolean;
  deskripsiTugas?: string;
  tidakHadirSnapshot?: { nis: string; nama: string; status: 'Sakit' | 'Izin' | 'Alfa' }[];
  catatanSiswaSnapshot?: { nis: string; nama: string; tipe: 'aktif' | 'bermasalah'; catatan: string; jamPembelajaran: string }[];
  templateId?: string; // ID template bank materi yang digunakan
  mingguKe?: number; // Minggu ke materi pembelajaran
  tujuanPembelajaran?: string; // Tujuan Pembelajaran (TP) terkait
}

export interface AttendanceDateNote {
  tanggal: string; // YYYY-MM-DD
  kelas: string;   // e.g. "Kelas 8.1"
  semester?: 1 | 2;
  tahunAjaran?: string;
  semester_tahun?: string;
  alasan: string;  // e.g. "Libur Hari Raya Idul Fitri", "Kegiatan Sekolah", etc.
}

export interface ReportConfig {
  govName?: string;
  deptName?: string;
  schoolName?: string;
  schoolAddress?: string;
  schoolPhone?: string;
  logoKiri?: string | null;
  logoKanan?: string | null;
  cityName?: string;
  teacherSubject?: string;
  teacherName?: string;
  teacherNip?: string;
  headmasterName?: string;
  headmasterNip?: string;
  parafMode?: 'digital' | 'custom_image' | 'stamp' | 'manual';
  customParafImg?: string | null;
  updatedAt?: string;
}

export interface GradeWeightConfig {
  formatif: number; // e.g. 20 (20%)
  sumatif: number;  // e.g. 40 (40%)
  uas: number;      // e.g. 30 (30%)
  sikap: number;    // e.g. 10 (10%)
  kktp?: number;    // e.g. 76 (Kriteria Ketercapaian Tujuan Pembelajaran)
  updatedAt?: string;
}

export interface GradeAttitude {
  nis: string;
  nama: string;
  jenisKelamin?: 'L' | 'P';
  kelas?: string;
  semester?: 1 | 2;
  tahunAjaran?: string;
  semester_tahun?: string;
  manualScore?: number | null; // Optional manual score overridden by teacher
  predikatManual?: string | null;
  catatanSikap?: string;
  updatedAt?: string;
}

export type DayOfWeek = 'Senin' | 'Selasa' | 'Rabu' | 'Kamis' | 'Jumat' | 'Sabtu' | 'Minggu';

export interface ScheduleVersion {
  id?: string;
  label?: string; // e.g. "Roster 1 (Awal)", "Roster 2 (Mulai 1 Sep)"
  hari: DayOfWeek[]; // e.g. ["Senin"]
  jamPelajaran?: string; // e.g. "Jam ke 1-3 (07:30 - 09:30)"
  ruang?: string; // e.g. "Lab Komputer 1"
  keterangan?: string;
  tanggalMulai: string; // YYYY-MM-DD (Tanggal Mulai Berlaku Versi Ini)
  tanggalSelesai?: string; // YYYY-MM-DD (Tanggal Berakhir Versi Ini, opsional jika sedang aktif)
  isActive?: boolean; // Menandai jika versi ini dipilih secara manual sebagai jadwal aktif saat ini
}

export interface ClassSchedule {
  kelas: string; // e.g. "Kelas 8.1"
  hari: DayOfWeek[]; // e.g. ["Senin", "Kamis"] (Hari aktif terbaru)
  jamPelajaran?: string; // e.g. "Jam ke 1-3 (07:30 - 09:30)"
  ruang?: string; // e.g. "Lab Komputer 1"
  keterangan?: string;
  tanggalMulaiSemester?: string; // e.g. "2026-07-13" (Tanggal Awal Semester)
  tanggalSelesaiSemester?: string; // e.g. "2026-12-19" (Tanggal Akhir Semester)
  activeVersionId?: string; // ID versi roster yang sedang aktif digunakan
  riwayatJadwal?: ScheduleVersion[]; // Riwayat versi perubahan jadwal (Effective Date Schedule History)
  jadwalLama?: {
    hari: DayOfWeek[];
    jamPelajaran?: string;
    ruang?: string;
    keterangan?: string;
  };
  updatedAt?: string;
}

export interface WeeklyMaterialTemplate {
  id: string; // unique ID e.g. "minggu_1" or "tpl_xxx"
  mingguKe: number; // e.g. 1, 2, 3...
  labelMinggu?: string; // e.g. "Minggu ke-1", "Pertemuan 1"
  topikMateri: string; // Judul pokok materi
  tujuanPembelajaran?: string; // TP terkait (opsional)
  catatanKegiatan: string; // Catatan kegiatan / model pembelajaran
  jamPelajaranDefault?: number[]; // [1, 2], [2, 3] etc.
  hambatanDefault?: string;
  solusiDefault?: string;
  keaktifanDefault?: number; // 1-5
  adaTugas?: boolean;
  deskripsiTugas?: string;
  semester?: 1 | 2;
  tahunAjaran?: string;
  updatedAt?: string;
}





