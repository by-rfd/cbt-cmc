export interface Kelas {
  id: string;
  nama: string; // e.g., "Ruang CBT 01", "Ruang LAB-1"
  jurusan: string; // e.g., "UMUM", "LAB"
}

export interface KelasAkademik {
  id: string;
  nama: string; // e.g., "Kelas VII-1", "Kelas IX-3"
}

export interface Mapel {
  id: string;
  nama: string; // e.g., "Matematika", "Bahasa Inggris"
  kode: string; // e.g., "MAT-MTs"
}

export interface Siswa {
  id: string;
  nama: string;
  nisn: string;
  username: string;
  password?: string;
  kelasId: string; // FK to Kelas / Ruang
  kelas: string;   // Academic class (e.g., "Kelas VII", "Kelas IX-1")
  noPeserta: string; // Examinee number
}

export interface GuruAmpuan {
  mapelId: string;
  kelasIds: string[]; // Target kelasAkademik IDs taught for this mapel; empty = all classes
}

export interface Guru {
  id: string;
  nama: string;
  nip: string;
  username: string;
  password?: string;
  mapelIds: string[]; // Mapels taught (kept in sync with mapelKelas for compatibility)
  mapelKelas?: GuruAmpuan[]; // Detailed per-mapel class assignments
}

export interface Soal {
  id: string;
  mapelId: string;
  teks: string;
  gambarUrl?: string;
  audioUrl?: string;
  audioName?: string;
  opsi: {
    A: string;
    B: string;
    C: string;
    D: string;
    E: string;
  };
  opsiGambar?: {
    A?: string;
    B?: string;
    C?: string;
    D?: string;
    E?: string;
  };
  kunci: "A" | "B" | "C" | "D" | "E";
  guruId?: string; // If added by a specific teacher
  kelasIds?: string[]; // Target academic class IDs (e.g., X-1, X-2, X-3)
}

export interface JadwalUjian {
  id: string;
  mapelId: string;
  kelasIds: string[]; // Target classes
  tanggal: string; // YYYY-MM-DD
  jamMulai: string; // HH:MM
  jamSelesai: string; // HH:MM
  acakSoal: boolean;
  durasiMenit: number;
  guruIds?: string[]; // Optional teacher author filter (empty = all teachers)
  soalIds?: string[]; // Optional explicit hand-picked question IDs
  sesi?: string | number;
}

export interface TokenUjian {
  id: string; // Mapel ID
  mapelNama: string;
  token: string; // 6 digits
  createdAt: number; // timestamp
  expiresAt: number; // timestamp (10 minutes rotation)
}

export interface PelanggaranLog {
  timestamp: string;
  tipe: string; // e.g., "Tab Switch", "Split Screen"
  keterangan: string;
}

export interface SesiSiswa {
  id: string; // Nisn ATAU SiswaID
  siswaNama: string;
  siswaKelas: string;
  mapelNama: string;
  mapelId?: string;
  jadwalId?: string;
  questionIds?: string[]; // Ordered soal IDs active in student's exam
  status: "Belum Mulai" | "Mengerjakan" | "Selesai" | "Diskualifikasi";
  deviceId: string;
  pelanggaranCount: number;
  pelanggaranLogs: PelanggaranLog[];
  jawabanTerisi: number;
  totalSoal: number;
  raguRagu: Record<number, boolean>; // Index -> boolean
  jawabanSiswa: Record<number, string>; // Index -> key (A-E)
  lastUpdated: string;
}

export interface HasilUjian {
  id: string;
  siswaNisn?: string;
  siswaNama: string;
  siswaKelas: string;
  mapelId?: string;
  mapelNama: string;
  totalSoal: number;
  salah: number;
  benar: number;
  nilai: number;
  tanggalSelesai: string;
  waktuSelesai?: string;
  status: "Selesai" | "Diskualifikasi";
}

export interface KonfigurasiSekolah {
  namaSekolah: string;
  alamatSekolah: string;
  kodeRegistrasi: string;
  logoKiriUrl: string; // base64 or URL
  logoKananUrl: string;
  bgUrl: string;
  ttdKepsekUrl: string;
  stempelSekolahUrl: string;
  namaKepsek: string;
  nipKepsek: string;
  zonaWaktu: "WIB" | "WITA" | "WIT";
  batasPelanggaran: number; // default 3
}

export interface JadwalNgawas {
  id: string;
  pengawasId: string;
  mapelId: string;
  ruangId: string;
  sesi: string;
  tanggal: string;
}

export interface Pengawas {
  id: string;
  nama: string;
  nip: string;
  username: string;
  password?: string;
}

