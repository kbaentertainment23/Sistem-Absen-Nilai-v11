# Implementasi Dropdown Searchable Interaktif Pemilihan Siswa pada Catatan Siswa

Rencana ini merealisasikan fitur pencarian siswa interaktif (*searchable dropdown*) yang responsif, nyaman dilihat, dan mudah digunakan pada formulir entri Catatan Siswa (`StudentNotesTab.tsx`). Guru dapat dengan cepat mencari dan memilih siswa berdasarkan nama lengkap, NIS, maupun nomor absen tanpa harus menggulir dropdown biasa yang panjang.

---

## User Review & Critical Decisions

> [!IMPORTANT]
> Berdasarkan konfirmasi pertanyaan klarifikasi:
> 1. **Model Komponen**: Dropdown searchable interaktif dengan pratinjau avatar/foto siswa dan nomor absen.
> 2. **Parameter Pencarian**: Mendukung pencarian fleksibel berdasarkan **Nama Lengkap**, **NIS**, maupun **Nomor Absen**.

- **Konfirmasi 1**: Komponen menggantikan elemen `<select>` standar dengan combo-box dropdown kustom yang dilengkapi input pencarian, indikator siswa terpilih, avatar profil, nomor absen, dan tombol reset/clear cepat.
- **Konfirmasi 2**: Navigasi keyboard (Escape untuk menutup, klik di luar elemen untuk menutup otomatis) dan status kosong yang ramah jika pencarian tidak ditemukan.

---

## 1. Overview & Core Concept

- **Apa yang Dibuat**: Komponen dropdown pemilih siswa interaktif (*Searchable Student Selector*) pada formulir Catatan Siswa (`StudentNotesTab.tsx`).
- **Target Pengguna**: Guru mata pelajaran atau wali kelas yang sedang mengisi catatan jurnal/aktivitas siswa di kelas.
- **Nilai Manfaat**: Mempercepat proses pencatatan siswa, mengurangi kesalahan pemilihan siswa (terutama nama yang mirip), dan memberikan pengalaman antarmuka yang bersih serta modern.

---

## 2. User Experience & Visual Design

### Alur Interaksi Pengguna (User Flow)
1. **Keadaan Awal (Default/Empty)**:
   - Tombol pemicu dropdown menampilkan placeholder bersih `"-- Cari atau Pilih Siswa --"` disertai ikon pencarian dan chevron.
2. **Saat Diklik / Dibuka**:
   - Menu dropdown muncul dengan animasi halus, langsung memfokuskan kolom input pencarian di bagian atas dengan placeholder `"Ketik nama, NIS, atau nomor absen..."`.
   - Menampilkan daftar siswa yang tersortir rapi lengkap dengan thumbnail foto profil (dengan fallback inisial/avatar), nama tebal, nomor absen `#XX`, dan NIS.
3. **Saat Guru Mengetik**:
   - Filter real-time langsung menyaring daftar siswa berdasarkan kecocokan nama, NIS, maupun nomor absen.
   - Jika tidak ada yang cocok, ditampilkan pesan ramah: `"Tidak ada siswa yang cocok dengan kata kunci"`.
4. **Saat Siswa Dipilih**:
   - Menu dropdown tertutup otomatis. Tombol pemicu kini menampilkan nama siswa yang dipilih, badge nomor absen, dan foto profil kecil, disertai tombol `X` untuk mereset pilihan jika ingin mengganti.
5. **Saat Mode Edit Catatan**:
   - Siswa yang sebelumnya tersimpan otomatis terpilih dan terisi pada komponen ini.

### Desain Visual & Tata Letak
- **Palet Warna**: Mengikuti palet Indigo/Slate aplikasi (`border-slate-200`, `focus:ring-indigo-500`, `bg-indigo-50/60`).
- **Dimensi & Responsivitas**: Ketinggian item sentuh $\ge 40\text{px}$, ukuran dropdown maksimal `max-h-60` dengan scrollbar halus, tidak merusak layout formulir di sampingnya (grid 2 kolom tanggal & siswa tetap seimbang).

---

## 3. Technical Architecture & Component Mapping

```
┌──────────────────────────────────────────────────────────────┐
│                    StudentNotesTab.tsx                       │
│                                                              │
│  ┌───────────────────────┐    ┌───────────────────────────┐  │
│  │   Input Tanggal       │    │  SearchableStudentSelect  │  │
│  └───────────────────────┘    │  (Foto + Absen + NIS)     │  │
│                               └─────────────┬─────────────┘  │
│                                             │ (Filter query) │
│                                             ▼                │
│                                ┌───────────────────────────┐ │
│                                │ [Input Cari Siswa]        │ │
│                                │ ───────────────────────── │ │
│                                │ • [Foto] #1 Ahmad (NIS)   │ │
│                                │ • [Foto] #2 Budi  (NIS)   │ │
│                                │ • [Foto] #3 Citra (NIS)   │ │
│                                └───────────────────────────┘ │
└──────────────────────────────────────────────────────────────┘
```

### Rincian Perubahan Kode
1. **State & Ref Management**:
   - `isOpenStudentDropdown`: status dropdown terbuka/tertutup.
   - `studentSearchInput`: teks pencarian siswa di dalam dropdown.
   - `dropdownRef`: `useRef` untuk mendeteksi klik di luar komponen (*click outside handler*) agar dropdown menutup otomatis.
2. **Fungsi Penyaringan Siswa**:
   - Memfilter array `students` berdasarkan `nama.toLowerCase()`, `nis`, dan `noAbsen`.
3. **Pembersihan saat Submit / Reset**:
   - Saat formulir disubmit atau dibatalkan, pilihan siswa dan input pencarian ter-reset dengan bersih.
