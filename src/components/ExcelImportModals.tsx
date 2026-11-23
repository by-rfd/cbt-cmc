import React, { useState, useRef } from "react";
import * as XLSX from "xlsx";
import {
  FileSpreadsheet,
  Upload,
  Download,
  CheckCircle2,
  AlertTriangle,
  X,
  FileCheck,
  Users,
  GraduationCap,
  Calendar,
  Shield,
  Trash2,
  BookOpen,
} from "lucide-react";
import { motion } from "motion/react";
import { Siswa, Guru, GuruAmpuan, JadwalUjian, Pengawas, JadwalNgawas, Mapel, Kelas, KelasAkademik } from "../types";

// ==========================================
// 1. TEMPLATE DOWNLOAD HELPERS
// ==========================================

export function downloadTemplateSiswa() {
  const rows = [
    {
      "Nama Lengkap": "Ahmad Fauzan Al-Banjari",
      "NISN": "0071234561",
      "No Peserta": "26-04-01-0101",
      "Username": "siswa_0071234561",
      "Password": "Password123",
      "Kelas Akademik": "Kelas IX-1",
      "Ruang CBT": "Ruang 1",
    },
    {
      "Nama Lengkap": "Siti Nurhaliza Zahra",
      "NISN": "0071234562",
      "No Peserta": "26-04-01-0102",
      "Username": "siswa_0071234562",
      "Password": "Password123",
      "Kelas Akademik": "Kelas IX-1",
      "Ruang CBT": "Ruang 1",
    },
    {
      "Nama Lengkap": "Muhammad Rizky Pratama",
      "NISN": "0071234563",
      "No Peserta": "26-04-01-0103",
      "Username": "siswa_0071234563",
      "Password": "Password123",
      "Kelas Akademik": "Kelas IX-2",
      "Ruang CBT": "Ruang 2",
    },
  ];

  const ws = XLSX.utils.json_to_sheet(rows);
  ws["!cols"] = [
    { wch: 28 },
    { wch: 15 },
    { wch: 18 },
    { wch: 20 },
    { wch: 15 },
    { wch: 16 },
    { wch: 14 },
  ];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Data Siswa");
  XLSX.writeFile(wb, "Template_Import_Siswa_CBT.xlsx");
}

export function downloadTemplateMapel() {
  const rows = [
    {
      "Nama Mata Pelajaran": "Bahasa Sunda",
      "Kode Mapel": "SUNDA",
    },
    {
      "Nama Mata Pelajaran": "Matematika Wajib",
      "Kode Mapel": "MAT-W",
    },
    {
      "Nama Mata Pelajaran": "Bahasa Indonesia",
      "Kode Mapel": "B-IND",
    },
    {
      "Nama Mata Pelajaran": "Fiqih",
      "Kode Mapel": "FIQIH",
    },
    {
      "Nama Mata Pelajaran": "Sejarah Kebudayaan Islam",
      "Kode Mapel": "SKI",
    },
  ];

  const ws = XLSX.utils.json_to_sheet(rows);
  ws["!cols"] = [{ wch: 32 }, { wch: 16 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Data Mapel");
  XLSX.writeFile(wb, "Template_Import_Mapel_CBT.xlsx");
}

export function downloadTemplateGuru() {
  const rows = [
    {
      "Nama Guru": "Drs. H. Mulyono, M.Pd",
      "NIP": "197505122000031002",
      "Username": "guru_mulyono",
      "Password": "GuruPassword123",
      "Mata Pelajaran": "Bahasa Sunda",
      "Kelas Diajar": "VII-1, VII-2, VII-3",
    },
    {
      "Nama Guru": "Drs. H. Mulyono, M.Pd",
      "NIP": "197505122000031002",
      "Username": "guru_mulyono",
      "Password": "GuruPassword123",
      "Mata Pelajaran": "Bahasa Indonesia",
      "Kelas Diajar": "VIII-1, VIII-2",
    },
    {
      "Nama Guru": "Hj. Siti Aminah, S.Pd, M.Si",
      "NIP": "198204152006042008",
      "Username": "guru_aminah",
      "Password": "GuruPassword123",
      "Mata Pelajaran": "Matematika",
      "Kelas Diajar": "Semua Kelas",
    },
  ];

  const ws = XLSX.utils.json_to_sheet(rows);
  ws["!cols"] = [
    { wch: 30 },
    { wch: 22 },
    { wch: 18 },
    { wch: 18 },
    { wch: 25 },
    { wch: 28 },
  ];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Data Guru");
  XLSX.writeFile(wb, "Template_Import_Guru_CBT.xlsx");
}

export function downloadTemplateJadwal() {
  const today = new Date().toISOString().split("T")[0];
  const rows = [
    {
      "Mata Pelajaran": "Matematika",
      "Sasaran Kelas": "Kelas IX-1, Kelas IX-2",
      "Tanggal": today,
      "Jam Mulai": "08:00",
      "Jam Selesai": "09:30",
      "Durasi (Menit)": 90,
      "Sesi": "1",
      "Acak Soal": "Ya",
    },
    {
      "Mata Pelajaran": "Bahasa Indonesia",
      "Sasaran Kelas": "Semua Kelas",
      "Tanggal": today,
      "Jam Mulai": "10:00",
      "Jam Selesai": "11:30",
      "Durasi (Menit)": 90,
      "Sesi": "2",
      "Acak Soal": "Ya",
    },
    {
      "Mata Pelajaran": "Fiqih",
      "Sasaran Kelas": "Kelas VII-1",
      "Tanggal": today,
      "Jam Mulai": "13:00",
      "Jam Selesai": "14:30",
      "Durasi (Menit)": 90,
      "Sesi": "3",
      "Acak Soal": "Tidak",
    },
  ];

  const ws = XLSX.utils.json_to_sheet(rows);
  ws["!cols"] = [
    { wch: 22 },
    { wch: 22 },
    { wch: 14 },
    { wch: 12 },
    { wch: 12 },
    { wch: 15 },
    { wch: 8 },
    { wch: 12 },
  ];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Jadwal Ujian");
  XLSX.writeFile(wb, "Template_Import_Jadwal_Ujian_CBT.xlsx");
}

export function downloadTemplatePengawas() {
  const today = new Date().toISOString().split("T")[0];
  const rows = [
    {
      "Nama Pengawas": "Drs. Bambang Supriyadi",
      "NIP": "197801022005011003",
      "Username": "pengawas_bambang",
      "Password": "PengawasPass123",
      "Mata Pelajaran": "Matematika",
      "Ruang CBT": "Ruang 1",
      "Tanggal": today,
      "Sesi": "Sesi 1",
    },
    {
      "Nama Pengawas": "Nurul Hidayati, S.Pd",
      "NIP": "198506142010012015",
      "Username": "pengawas_nurul",
      "Password": "PengawasPass123",
      "Mata Pelajaran": "Matematika",
      "Ruang CBT": "Ruang 2",
      "Tanggal": today,
      "Sesi": "Sesi 1",
    },
    {
      "Nama Pengawas": "Hendra Wijaya, S.Kom",
      "NIP": "199203102019031008",
      "Username": "pengawas_hendra",
      "Password": "PengawasPass123",
      "Mata Pelajaran": "Bahasa Indonesia",
      "Ruang CBT": "Ruang 1",
      "Tanggal": today,
      "Sesi": "Sesi 2",
    },
  ];

  const ws = XLSX.utils.json_to_sheet(rows);
  ws["!cols"] = [
    { wch: 26 },
    { wch: 22 },
    { wch: 18 },
    { wch: 18 },
    { wch: 20 },
    { wch: 14 },
    { wch: 14 },
    { wch: 10 },
  ];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Jadwal Pengawas");
  XLSX.writeFile(wb, "Template_Import_Jadwal_Pengawas_CBT.xlsx");
}

// Helper to read excel/csv files into json
function readSpreadsheet(file: File): Promise<Record<string, any>[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const buffer = e.target?.result as ArrayBuffer;
        const workbook = XLSX.read(buffer, { type: "array" });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const json = XLSX.utils.sheet_to_json<Record<string, any>>(worksheet, { defval: "" });
        resolve(json);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = (err) => reject(err);
    reader.readAsArrayBuffer(file);
  });
}

function normalizeKey(str: string): string {
  return str.toLowerCase().replace(/[^a-z0-9]/g, "");
}

// Find object value by multiple alias keys
function findVal(row: Record<string, any>, aliases: string[]): string {
  const normKeys = Object.keys(row).reduce<Record<string, string>>((acc, k) => {
    acc[normalizeKey(k)] = row[k] != null ? String(row[k]).trim() : "";
    return acc;
  }, {});

  for (const alias of aliases) {
    const nAlias = normalizeKey(alias);
    if (normKeys[nAlias] !== undefined && normKeys[nAlias] !== "") {
      return normKeys[nAlias];
    }
  }
  return "";
}

// Smart resolver to map class text (e.g. "10-1, x-2, Kelas X-3") to canonical KelasAkademik IDs
function resolveKelasAkademikIds(rawText: string, kelasAkademikList: KelasAkademik[]): string[] {
  const trimmed = (rawText || "").trim();
  if (!trimmed) return [];
  const lowerAll = trimmed.toLowerCase();
  if (lowerAll === "semua" || lowerAll === "semua kelas" || lowerAll === "all" || lowerAll === "-") {
    return [];
  }

  const normalizeClassToken = (s: string) => {
    let cleaned = s.trim().toLowerCase().replace(/^kelas\s+/i, "");
    // Convert leading 7/8/9 to roman numerals vii/viii/ix for matching (e.g. "7-1" -> "vii-1")
    cleaned = cleaned.replace(/^9(?=\b|[-_\s])/i, "ix");
    cleaned = cleaned.replace(/^8(?=\b|[-_\s])/i, "viii");
    cleaned = cleaned.replace(/^7(?=\b|[-_\s])/i, "vii");
    return cleaned.replace(/[^a-z0-9]/g, "");
  };

  const tokens = trimmed.split(/[,;|]+/).map((t) => t.trim()).filter(Boolean);
  const matchedIds: string[] = [];

  tokens.forEach((tok) => {
    const normTok = normalizeClassToken(tok);
    if (!normTok) return;
    // Exact normalized match first, then partial fallback
    const exactMatch = kelasAkademikList.find((ka) => normalizeClassToken(ka.nama) === normTok);
    const fallbackMatch =
      exactMatch ||
      kelasAkademikList.find((ka) => {
        const kaNorm = normalizeClassToken(ka.nama);
        return kaNorm.includes(normTok) || normTok.includes(kaNorm);
      });
    if (fallbackMatch && !matchedIds.includes(fallbackMatch.id)) {
      matchedIds.push(fallbackMatch.id);
    }
  });

  return matchedIds;
}

// ==========================================
// 2. MODAL IMPORT SISWA (MURID)
// ==========================================

interface ImportSiswaModalProps {
  existingSiswa: Siswa[];
  kelasList: Kelas[];
  kelasAkademikList: KelasAkademik[];
  onClose: () => void;
  onSave: (newSiswaList: Siswa[]) => void;
}

export function ImportSiswaModal({
  existingSiswa,
  kelasList,
  onClose,
  onSave,
}: ImportSiswaModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [parsedRows, setParsedRows] = useState<any[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"file" | "paste">("file");
  const [pasteText, setPasteText] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processRawRows = (rawRows: Record<string, any>[]) => {
    const existingNisns = new Set(existingSiswa.map((s) => s.nisn.toLowerCase()));
    const existingUsers = new Set(existingSiswa.map((s) => s.username.toLowerCase()));

    const processed = rawRows.map((row, idx) => {
      const nama = findVal(row, ["namalengkap", "nama", "namasiswa", "fullname", "name"]);
      const nisn = findVal(row, ["nisn", "nomorinduk", "noinduk"]);
      const noPeserta =
        findVal(row, ["nopeserta", "nomorpeserta", "nopes", "noujian"]) ||
        `26-04-01-${Math.floor(1000 + Math.random() * 9000)}`;
      const username =
        findVal(row, ["username", "user", "idlogin", "loginid"]) ||
        `siswa_${nisn || Math.floor(100000 + Math.random() * 900000)}`;
      const password = findVal(row, ["password", "katasandi", "pass"]) || "Password123";
      const kelas = findVal(row, ["kelasakademik", "kelas", "tingkat", "rombel"]) || "Kelas VII-1";
      const ruangNama = findVal(row, ["ruangcbt", "ruang", "namaruang", "lab"]);

      // Match Ruang CBT with kelasList
      let matchedKelas = kelasList.find(
        (k) =>
          k.nama.toLowerCase() === ruangNama.toLowerCase() ||
          k.nama.toLowerCase().includes(ruangNama.toLowerCase()) ||
          k.id === ruangNama
      );
      if (!matchedKelas && kelasList.length > 0) {
        matchedKelas = kelasList[0];
      }
      const kelasId = matchedKelas ? matchedKelas.id : "k1";
      const resolvedRuang = matchedKelas ? matchedKelas.nama : (ruangNama || "Ruang 1");

      const isDuplicate = existingNisns.has(nisn.toLowerCase()) || existingUsers.has(username.toLowerCase());
      const isValid = Boolean(nama && nisn);

      return {
        key: idx,
        nama,
        nisn,
        noPeserta,
        username,
        password,
        kelas,
        kelasId,
        ruang: resolvedRuang,
        isValid,
        isDuplicate,
      };
    });

    setParsedRows(processed);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;
    setFile(selectedFile);
    setErrorMessage(null);
    setIsProcessing(true);
    try {
      const rawRows = await readSpreadsheet(selectedFile);
      if (rawRows.length === 0) {
        setErrorMessage("File kosong atau format kolom tidak terbaca.");
        setParsedRows([]);
      } else {
        processRawRows(rawRows);
      }
    } catch (err: any) {
      setErrorMessage(`Gagal membaca file: ${err.message || "Pastikan format .xlsx/.xls/.csv valid."}`);
      setParsedRows([]);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleProcessPaste = () => {
    if (!pasteText.trim()) {
      setErrorMessage("Silakan tempel teks tabel dari Excel/Spreadsheet.");
      return;
    }
    const lines = pasteText.split("\n").map((l) => l.trim()).filter((l) => l.length > 0);
    if (lines.length === 0) return;

    const rawRows: Record<string, string>[] = [];
    lines.forEach((line) => {
      if (line.toLowerCase().includes("nama") && line.toLowerCase().includes("nisn")) return;
      const cols = line.split("\t");
      if (cols.length >= 2) {
        rawRows.push({
          "Nama Lengkap": cols[0] || "",
          "NISN": cols[1] || "",
          "No Peserta": cols[2] || "",
          "Username": cols[3] || "",
          "Password": cols[4] || "",
          "Kelas Akademik": cols[5] || "",
          "Ruang CBT": cols[6] || "",
        });
      }
    });

    if (rawRows.length === 0) {
      setErrorMessage("Tidak ada baris data valid yang terbaca dari teks yang ditempel.");
      return;
    }

    setErrorMessage(null);
    processRawRows(rawRows);
  };

  const validRows = parsedRows.filter((r) => r.isValid && !r.isDuplicate);
  const duplicateCount = parsedRows.filter((r) => r.isDuplicate).length;

  const handleCommit = () => {
    if (validRows.length === 0) {
      alert("Tidak ada baris siswa baru yang valid untuk disimpan.");
      return;
    }

    const newSiswaItems: Siswa[] = validRows.map((r) => ({
      id: `siswa_xl_${Date.now()}_` + Math.random().toString(36).substring(2, 7),
      nama: r.nama,
      nisn: r.nisn,
      noPeserta: r.noPeserta,
      username: r.username,
      password: r.password,
      kelas: r.kelas,
      kelasId: r.kelasId,
    }));

    onSave(newSiswaItems);
    alert(`Berhasil mengimpor ${newSiswaItems.length} siswa baru ke sistem CBT!`);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-3 sm:p-4 animate-fade-in">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden text-left flex flex-col font-sans"
      >
        {/* Header */}
        <div className="bg-[#0666AE] text-white p-4 sm:p-5 flex justify-between items-center">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-white/10 rounded-xl">
              <FileSpreadsheet size={22} className="text-emerald-300" />
            </div>
            <div>
              <h3 className="font-black text-sm sm:text-base tracking-tight flex items-center gap-2">
                Import Siswa (Peserta CBT) dari Excel
              </h3>
              <p className="text-[11px] text-slate-100 font-medium">
                Dukungan file .xlsx, .xls, .csv & Copy-Paste Spreadsheet
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-white/80 hover:text-white bg-white/10 hover:bg-white/20 p-1.5 rounded-full cursor-pointer text-xs font-bold w-8 h-8 flex items-center justify-center"
          >
            <X size={18} />
          </button>
        </div>

        {/* Action Bar / Template */}
        <div className="bg-slate-50 border-b border-slate-200 p-3 sm:p-4 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab("file")}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                activeTab === "file"
                  ? "bg-[#0666AE] text-white shadow-sm"
                  : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-250"
              }`}
            >
              📁 Unggah File Excel (.xlsx / .csv)
            </button>
            <button
              onClick={() => setActiveTab("paste")}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                activeTab === "paste"
                  ? "bg-[#0666AE] text-white shadow-sm"
                  : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-250"
              }`}
            >
              📋 Salin-Tempel (Copy-Paste)
            </button>
          </div>

          <button
            type="button"
            onClick={downloadTemplateSiswa}
            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-lg transition-all shadow-sm flex items-center gap-1.5 cursor-pointer text-[11px]"
          >
            <Download size={14} />
            <span>Unduh Template Excel Siswa</span>
          </button>
        </div>

        {/* Body Content */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-4 flex-1 text-xs">
          {activeTab === "file" ? (
            <div className="space-y-3">
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-emerald-300 hover:border-emerald-500 bg-emerald-50/40 hover:bg-emerald-50/70 rounded-2xl p-6 text-center cursor-pointer transition-all space-y-2"
              >
                <Upload size={32} className="mx-auto text-emerald-600 animate-bounce" />
                <p className="font-extrabold text-slate-700 text-sm">
                  {file ? file.name : "Klik di sini atau Seret File Excel (.xlsx, .xls, .csv)"}
                </p>
                <p className="text-[11px] text-slate-500 font-medium">
                  Pastikan kolom sesuai template: Nama Lengkap, NISN, No Peserta, Username, Password, Kelas, Ruang CBT
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx, .xls, .csv"
                  className="hidden"
                  onChange={handleFileChange}
                />
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <label className="text-[10px] font-extrabold uppercase text-slate-500">
                  Tempelkan (Ctrl + V) Data Hasil Copy dari Excel:
                </label>
                <button
                  type="button"
                  onClick={() =>
                    setPasteText(
                      `Ahmad Fauzan\t0071234561\t26-04-01-0101\tsiswa_0071234561\tPass123\tKelas IX-1\tRuang 1\nSiti Zahra\t0071234562\t26-04-01-0102\tsiswa_0071234562\tPass123\tKelas IX-1\tRuang 1`
                    )
                  }
                  className="text-emerald-700 font-bold hover:underline text-[10px] cursor-pointer"
                >
                  Gunakan Contoh Teks
                </button>
              </div>
              <textarea
                className="w-full h-32 p-3 border border-slate-300 rounded-xl font-mono text-[11px] text-slate-800 focus:outline-none focus:border-[#0666AE]"
                placeholder="Nama Lengkap [TAB] NISN [TAB] No Peserta [TAB] Username [TAB] Password [TAB] Kelas [TAB] Ruang CBT"
                value={pasteText}
                onChange={(e) => setPasteText(e.target.value)}
              />
              <button
                type="button"
                onClick={handleProcessPaste}
                className="px-4 py-2 bg-[#0666AE] hover:bg-[#0666AE]/90 text-white rounded-xl font-bold cursor-pointer transition-all"
              >
                Proses Teks Hasil Copy
              </button>
            </div>
          )}

          {errorMessage && (
            <div className="p-3 bg-red-50 border border-red-250 rounded-xl text-red-700 font-bold text-xs flex items-center gap-2">
              <AlertTriangle size={16} />
              <span>{errorMessage}</span>
            </div>
          )}

          {isProcessing && (
            <p className="text-center py-4 font-bold text-slate-500 animate-pulse">
              Memproses & membaca isi file spreadsheet...
            </p>
          )}

          {/* Table Preview */}
          {parsedRows.length > 0 && (
            <div className="space-y-3 pt-2">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-2">
                <span className="font-black text-slate-700 uppercase text-xs flex items-center gap-1.5">
                  <FileCheck size={16} className="text-emerald-600" />
                  Pratinjau Data Terbaca ({parsedRows.length} Baris)
                </span>
                <div className="flex items-center gap-2 text-[11px]">
                  <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 font-extrabold rounded-md">
                    Siap Disimpan: {validRows.length}
                  </span>
                  {duplicateCount > 0 && (
                    <span className="px-2 py-0.5 bg-amber-100 text-amber-800 font-extrabold rounded-md">
                      Duplikat/Dilewati: {duplicateCount}
                    </span>
                  )}
                </div>
              </div>

              <div className="overflow-x-auto border border-slate-200 rounded-xl max-h-60 overflow-y-auto">
                <table className="w-full text-left border-collapse text-[11px]">
                  <thead className="bg-slate-100 sticky top-0 text-slate-700 font-bold border-b border-slate-200 z-10">
                    <tr>
                      <th className="p-2 border-r border-slate-200">No</th>
                      <th className="p-2 border-r border-slate-200">Nama Siswa</th>
                      <th className="p-2 border-r border-slate-200">NISN</th>
                      <th className="p-2 border-r border-slate-200">No Peserta</th>
                      <th className="p-2 border-r border-slate-200">Username</th>
                      <th className="p-2 border-r border-slate-200">Kelas</th>
                      <th className="p-2 border-r border-slate-200">Ruang CBT</th>
                      <th className="p-2 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-150">
                    {parsedRows.map((r, i) => (
                      <tr
                        key={r.key}
                        className={
                          r.isDuplicate
                            ? "bg-amber-50/50 text-amber-900"
                            : !r.isValid
                            ? "bg-red-50/50 text-red-900"
                            : "hover:bg-slate-50"
                        }
                      >
                        <td className="p-2 text-center font-mono border-r border-slate-200">{i + 1}</td>
                        <td className="p-2 font-bold border-r border-slate-200">{r.nama || "-"}</td>
                        <td className="p-2 font-mono border-r border-slate-200">{r.nisn || "-"}</td>
                        <td className="p-2 font-mono border-r border-slate-200">{r.noPeserta}</td>
                        <td className="p-2 font-mono border-r border-slate-200">{r.username}</td>
                        <td className="p-2 border-r border-slate-200">{r.kelas}</td>
                        <td className="p-2 border-r border-slate-200">{r.ruang}</td>
                        <td className="p-2 text-center">
                          {r.isDuplicate ? (
                            <span className="px-1.5 py-0.5 bg-amber-100 text-amber-800 rounded font-black text-[9px]">
                              NISN Ada
                            </span>
                          ) : !r.isValid ? (
                            <span className="px-1.5 py-0.5 bg-red-100 text-red-800 rounded font-black text-[9px]">
                              Data Tidak Lengkap
                            </span>
                          ) : (
                            <span className="px-1.5 py-0.5 bg-emerald-100 text-emerald-800 rounded font-black text-[9px] flex items-center justify-center gap-1">
                              <CheckCircle2 size={10} /> Valid
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-slate-50 border-t border-slate-200 p-4 flex justify-between items-center">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-slate-300 rounded-xl font-bold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            Batal
          </button>
          <button
            type="button"
            disabled={validRows.length === 0}
            onClick={handleCommit}
            className={`px-5 py-2.5 rounded-xl font-black text-white transition-all shadow-md flex items-center gap-2 cursor-pointer ${
              validRows.length > 0
                ? "bg-emerald-600 hover:bg-emerald-700 active:scale-95"
                : "bg-slate-350 cursor-not-allowed opacity-60"
            }`}
          >
            <CheckCircle2 size={16} />
            <span>Simpan ({validRows.length}) Siswa ke CBT</span>
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ==========================================
// 2B. MODAL IMPORT MATA PELAJARAN (DATA MASTER)
// ==========================================

interface ImportMapelModalProps {
  existingMapel: Mapel[];
  onClose: () => void;
  onSave: (newMapelList: Mapel[]) => void;
}

export function ImportMapelModal({
  existingMapel,
  onClose,
  onSave,
}: ImportMapelModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [parsedRows, setParsedRows] = useState<any[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const generateAutoKode = (nama: string) =>
    nama
      .trim()
      .replace(/[^a-zA-Z0-9]/g, "")
      .substring(0, 8)
      .toUpperCase() || "MPL";

  const processRawRows = (rawRows: Record<string, any>[]) => {
    const seenNames = new Set(existingMapel.map((m) => m.nama.trim().toLowerCase()));

    const processed = rawRows.map((row, idx) => {
      const nama = findVal(row, [
        "namamatapelajaran",
        "matapelajaran",
        "namamapel",
        "mapel",
        "nama",
        "pelajaran",
      ]);
      const rawKode = findVal(row, ["kodemapel", "kode", "singkatan", "code"]);
      const kode = (rawKode || generateAutoKode(nama)).toUpperCase();

      const normNama = nama.trim().toLowerCase();
      const isValid = Boolean(nama.trim());
      const isDuplicate = isValid && seenNames.has(normNama);
      if (isValid && !isDuplicate) {
        seenNames.add(normNama);
      }

      return {
        key: idx,
        nama: nama.trim(),
        kode,
        isValid,
        isDuplicate,
      };
    });

    setParsedRows(processed);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;
    setFile(selectedFile);
    setErrorMessage(null);
    setIsProcessing(true);
    try {
      const rawRows = await readSpreadsheet(selectedFile);
      if (rawRows.length === 0) {
        setErrorMessage("File kosong atau format kolom tidak sesuai.");
        setParsedRows([]);
      } else {
        processRawRows(rawRows);
      }
    } catch (err: any) {
      setErrorMessage(`Gagal membaca file: ${err.message || "Gunakan format .xlsx/.xls/.csv"}`);
      setParsedRows([]);
    } finally {
      setIsProcessing(false);
    }
  };

  const validRows = parsedRows.filter((r) => r.isValid && !r.isDuplicate);
  const duplicateCount = parsedRows.filter((r) => r.isDuplicate).length;

  const handleCommit = () => {
    if (validRows.length === 0) {
      alert("Tidak ada baris mata pelajaran baru yang valid untuk disimpan.");
      return;
    }

    const newMapelItems: Mapel[] = validRows.map((r, idx) => ({
      id: `mapel_xl_${Date.now()}_${idx}_${Math.random().toString(36).substring(2, 6)}`,
      nama: r.nama,
      kode: r.kode,
    }));

    onSave(newMapelItems);
    alert(`Berhasil mengimpor ${newMapelItems.length} mata pelajaran baru ke Data Master!`);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-3 sm:p-4 animate-fade-in">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden text-left flex flex-col font-sans"
      >
        <div className="bg-[#0666AE] text-white p-4 sm:p-5 flex justify-between items-center">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-white/10 rounded-xl">
              <BookOpen size={22} className="text-sky-200" />
            </div>
            <div>
              <h3 className="font-black text-sm sm:text-base tracking-tight">
                Import Mata Pelajaran dari File Excel
              </h3>
              <p className="text-[11px] text-slate-100 font-medium">
                Tambahkan banyak mata pelajaran sekaligus ke Data Master CBT
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-white/80 hover:text-white bg-white/10 hover:bg-white/20 p-1.5 rounded-full cursor-pointer text-xs font-bold w-8 h-8 flex items-center justify-center"
          >
            <X size={18} />
          </button>
        </div>

        <div className="bg-slate-50 border-b border-slate-200 p-3 sm:p-4 flex flex-wrap items-center justify-between gap-3 text-xs">
          <p className="text-slate-600 font-semibold text-[11px]">
            Kolom Excel: <span className="font-bold text-slate-800">Nama Mata Pelajaran, Kode Mapel (opsional)</span>
          </p>
          <button
            type="button"
            onClick={downloadTemplateMapel}
            className="px-3 py-1.5 bg-[#0666AE] hover:bg-[#05558E] text-white font-black rounded-lg transition-all shadow-sm flex items-center gap-1.5 cursor-pointer text-[11px]"
          >
            <Download size={14} />
            <span>Unduh Template Mapel</span>
          </button>
        </div>

        <div className="p-4 sm:p-6 overflow-y-auto space-y-4 flex-1 text-xs">
          <div
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-sky-300 hover:border-[#0666AE] bg-sky-50/40 hover:bg-sky-50/70 rounded-2xl p-6 text-center cursor-pointer transition-all space-y-2"
          >
            <Upload size={32} className="mx-auto text-[#0666AE]" />
            <p className="font-extrabold text-slate-700 text-sm">
              {file ? file.name : "Klik di sini untuk memilih File Excel Mapel (.xlsx, .xls, .csv)"}
            </p>
            <p className="text-[11px] text-slate-500 font-medium">
              Kode Mapel otomatis dibuat apabila kolom kode dikosongkan. Duplikat nama otomatis dilewati.
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx, .xls, .csv"
              className="hidden"
              onChange={handleFileChange}
            />
          </div>

          {errorMessage && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 font-bold text-xs flex items-center gap-2">
              <AlertTriangle size={16} />
              <span>{errorMessage}</span>
            </div>
          )}

          {isProcessing && (
            <p className="text-center py-4 font-bold text-slate-500 animate-pulse">
              Membaca & memvalidasi daftar mata pelajaran...
            </p>
          )}

          {parsedRows.length > 0 && (
            <div className="space-y-3 pt-2">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-2">
                <span className="font-black text-slate-700 uppercase text-xs flex items-center gap-1.5">
                  <FileCheck size={16} className="text-[#0666AE]" />
                  Pratinjau Mata Pelajaran ({parsedRows.length} Baris)
                </span>
                <div className="flex items-center gap-2 text-[11px]">
                  <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 font-extrabold rounded-md">
                    Siap Disimpan: {validRows.length}
                  </span>
                  {duplicateCount > 0 && (
                    <span className="px-2 py-0.5 bg-amber-100 text-amber-800 font-extrabold rounded-md">
                      Sudah Ada: {duplicateCount}
                    </span>
                  )}
                </div>
              </div>

              <div className="overflow-x-auto border border-slate-200 rounded-xl max-h-60 overflow-y-auto">
                <table className="w-full text-left border-collapse text-[11px]">
                  <thead className="bg-slate-100 sticky top-0 text-slate-700 font-bold border-b border-slate-200 z-10">
                    <tr>
                      <th className="p-2 border-r border-slate-200 w-10 text-center">No</th>
                      <th className="p-2 border-r border-slate-200">Nama Mata Pelajaran</th>
                      <th className="p-2 border-r border-slate-200 w-28">Kode Mapel</th>
                      <th className="p-2 text-center w-28">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {parsedRows.map((r, i) => (
                      <tr
                        key={r.key}
                        className={
                          r.isDuplicate
                            ? "bg-amber-50/50 text-amber-900"
                            : !r.isValid
                            ? "bg-red-50/50 text-red-900"
                            : "hover:bg-slate-50"
                        }
                      >
                        <td className="p-2 text-center font-mono border-r border-slate-200">{i + 1}</td>
                        <td className="p-2 font-bold border-r border-slate-200 uppercase">{r.nama || "-"}</td>
                        <td className="p-2 font-mono font-bold border-r border-slate-200 text-[#0666AE]">{r.kode}</td>
                        <td className="p-2 text-center">
                          {r.isDuplicate ? (
                            <span className="px-1.5 py-0.5 bg-amber-100 text-amber-800 rounded font-black text-[9px]">
                              Sudah Ada
                            </span>
                          ) : !r.isValid ? (
                            <span className="px-1.5 py-0.5 bg-red-100 text-red-800 rounded font-black text-[9px]">
                              Nama Kosong
                            </span>
                          ) : (
                            <span className="px-1.5 py-0.5 bg-emerald-100 text-emerald-800 rounded font-black text-[9px] inline-flex items-center gap-1">
                              <CheckCircle2 size={10} /> Valid
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        <div className="bg-slate-50 border-t border-slate-200 p-4 flex justify-between items-center">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-slate-300 rounded-xl font-bold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            Batal
          </button>
          <button
            type="button"
            disabled={validRows.length === 0}
            onClick={handleCommit}
            className={`px-5 py-2.5 rounded-xl font-black text-white transition-all shadow-md flex items-center gap-2 cursor-pointer ${
              validRows.length > 0
                ? "bg-[#0666AE] hover:bg-[#05558E] active:scale-95"
                : "bg-slate-300 cursor-not-allowed opacity-60"
            }`}
          >
            <CheckCircle2 size={16} />
            <span>Simpan ({validRows.length}) Mapel ke Data Master</span>
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ==========================================
// 3. MODAL IMPORT GURU (MULTI MAPEL & KELAS)
// ==========================================

interface ImportGuruModalProps {
  existingGuru: Guru[];
  mapelList: Mapel[];
  kelasAkademikList?: KelasAkademik[];
  onClose: () => void;
  onSave: (newGuruList: Guru[]) => void;
}

export function ImportGuruModal({
  existingGuru,
  mapelList,
  kelasAkademikList = [],
  onClose,
  onSave,
}: ImportGuruModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [parsedRows, setParsedRows] = useState<any[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const matchMapelByName = (mNameRaw: string): Mapel | undefined => {
    const mName = mNameRaw.trim().toLowerCase();
    if (!mName) return undefined;
    return (
      mapelList.find((m) => m.nama.toLowerCase() === mName || m.kode.toLowerCase() === mName) ||
      mapelList.find((m) => m.nama.toLowerCase().includes(mName) || mName.includes(m.nama.toLowerCase()))
    );
  };

  const processRawRows = (rawRows: Record<string, any>[]) => {
    const existingNips = new Set(existingGuru.map((g) => g.nip.toLowerCase()));
    const existingUsers = new Set(existingGuru.map((g) => g.username.toLowerCase()));

    // Group rows by NIP/Username so multiple Excel rows for the same teacher merge cleanly into multi-mapel + per-mapel kelas!
    const groupedMap = new Map<string, any>();

    rawRows.forEach((row, idx) => {
      const nama = findVal(row, ["namaguru", "nama", "namalengkap", "guru", "fullname"]);
      const nip = findVal(row, ["nip", "nuptk", "nipguru", "idguru"]);
      const username =
        findVal(row, ["username", "user", "idlogin"]) ||
        `guru_${nip || Math.floor(1000 + Math.random() * 9000)}`;
      const password = findVal(row, ["password", "katasandi", "pass"]) || "Guru123";
      const mapelStr = findVal(row, ["matapelajaran", "mapel", "pelajaran", "bidangstudi"]);
      const kelasStr = findVal(row, ["kelasdiajar", "kelas", "sasarankelas", "mengajardikelas", "kelastarget", "rombel"]);

      // Support either:
      // 1) Separate column "Kelas Diajar" applied to mapels in this row
      // 2) Inline syntax "Bahasa Sunda (VII-1; VII-2; VII-3), Bahasa Indonesia (VIII-1)"
      const rowDefaultKelasIds = resolveKelasAkademikIds(kelasStr, kelasAkademikList);
      const rowEntries: GuruAmpuan[] = [];

      // Split top-level commas outside parentheses
      const mapelSegments = mapelStr
        .split(/,(?![^(]*\))/)
        .map((s) => s.trim())
        .filter(Boolean);

      mapelSegments.forEach((seg) => {
        const parenMatch = seg.match(/^(.+?)\(([^)]+)\)$/);
        const rawMapelName = parenMatch ? parenMatch[1].trim() : seg;
        const inlineKelasStr = parenMatch ? parenMatch[2].trim() : "";
        const foundMapel = matchMapelByName(rawMapelName);
        if (foundMapel) {
          const resolvedKelas = inlineKelasStr
            ? resolveKelasAkademikIds(inlineKelasStr, kelasAkademikList)
            : rowDefaultKelasIds;
          rowEntries.push({
            mapelId: foundMapel.id,
            kelasIds: resolvedKelas,
          });
        }
      });

      if (rowEntries.length === 0 && mapelList.length > 0 && !mapelStr) {
        rowEntries.push({
          mapelId: mapelList[0].id,
          kelasIds: rowDefaultKelasIds,
        });
      }

      const groupKey = (nip || username || `row_${idx}`).toLowerCase();
      if (!groupedMap.has(groupKey)) {
        groupedMap.set(groupKey, {
          key: idx,
          nama,
          nip,
          username,
          password,
          mapelKelas: [] as GuruAmpuan[],
          unmatchedMapelNote: rowEntries.length === 0 && mapelStr ? mapelStr : "",
        });
      }

      const target = groupedMap.get(groupKey);
      rowEntries.forEach((entry) => {
        const existingEntry = target.mapelKelas.find((mk: GuruAmpuan) => mk.mapelId === entry.mapelId);
        if (existingEntry) {
          if (existingEntry.kelasIds.length === 0 || entry.kelasIds.length === 0) {
            existingEntry.kelasIds = [];
          } else {
            existingEntry.kelasIds = Array.from(new Set([...existingEntry.kelasIds, ...entry.kelasIds]));
          }
        } else {
          target.mapelKelas.push({
            mapelId: entry.mapelId,
            kelasIds: [...entry.kelasIds],
          });
        }
      });
    });

    const processed = Array.from(groupedMap.values()).map((g) => {
      const mapelIds = g.mapelKelas.map((mk: GuruAmpuan) => mk.mapelId);
      const mapelSummaries = g.mapelKelas.map((mk: GuruAmpuan) => {
        const mObj = mapelList.find((m) => m.id === mk.mapelId);
        const kelasNames =
          mk.kelasIds.length > 0
            ? mk.kelasIds
                .map((kId) => kelasAkademikList.find((ka) => ka.id === kId)?.nama || kId)
                .join(", ")
            : "Semua Kelas";
        return `${mObj?.nama || mk.mapelId} (${kelasNames})`;
      });

      const isDuplicate =
        existingNips.has((g.nip || "").toLowerCase()) ||
        existingUsers.has((g.username || "").toLowerCase());
      const isValid = Boolean(g.nama && g.nip);

      return {
        ...g,
        mapelIds,
        mapelStr: mapelSummaries.join(" • ") || g.unmatchedMapelNote || "Belum diplot",
        isValid,
        isDuplicate,
      };
    });

    setParsedRows(processed);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;
    setFile(selectedFile);
    setErrorMessage(null);
    setIsProcessing(true);
    try {
      const rawRows = await readSpreadsheet(selectedFile);
      if (rawRows.length === 0) {
        setErrorMessage("File kosong atau format kolom tidak sesuai.");
        setParsedRows([]);
      } else {
        processRawRows(rawRows);
      }
    } catch (err: any) {
      setErrorMessage(`Gagal membaca file: ${err.message || "Gunakan format .xlsx/.xls/.csv"}`);
      setParsedRows([]);
    } finally {
      setIsProcessing(false);
    }
  };

  const validRows = parsedRows.filter((r) => r.isValid && !r.isDuplicate);
  const duplicateCount = parsedRows.filter((r) => r.isDuplicate).length;

  const handleCommit = () => {
    if (validRows.length === 0) {
      alert("Tidak ada baris guru baru yang valid untuk disimpan.");
      return;
    }

    const newGuruItems: Guru[] = validRows.map((r) => ({
      id: `guru_xl_${Date.now()}_` + Math.random().toString(36).substring(2, 7),
      nama: r.nama,
      nip: r.nip,
      username: r.username,
      password: r.password,
      mapelIds: r.mapelIds,
      mapelKelas: r.mapelKelas,
    }));

    onSave(newGuruItems);
    alert(`Berhasil mengimpor ${newGuruItems.length} guru pengampu ke sistem CBT!`);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-3 sm:p-4 animate-fade-in">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden text-left flex flex-col font-sans"
      >
        {/* Header */}
        <div className="bg-[#0666AE] text-white p-4 sm:p-5 flex justify-between items-center">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-white/10 rounded-xl">
              <GraduationCap size={22} className="text-emerald-300" />
            </div>
            <div>
              <h3 className="font-black text-sm sm:text-base tracking-tight">
                Import Dewan Guru dari File Excel
              </h3>
              <p className="text-[11px] text-slate-100 font-medium">
                Mendukung 1 guru mengampu banyak mata pelajaran & plotting kelas spesifik (mis. X-1, X-2, X-3)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-white/80 hover:text-white bg-white/10 hover:bg-white/20 p-1.5 rounded-full cursor-pointer text-xs font-bold w-8 h-8 flex items-center justify-center"
          >
            <X size={18} />
          </button>
        </div>

        {/* Toolbar */}
        <div className="bg-slate-50 border-b border-slate-200 p-3 sm:p-4 flex flex-wrap items-center justify-between gap-3 text-xs">
          <p className="text-slate-600 font-semibold text-[11px]">
            Kolom: <span className="font-bold text-slate-800">Nama Guru, NIP, Username, Password, Mata Pelajaran, Kelas Diajar</span>
          </p>
          <button
            type="button"
            onClick={downloadTemplateGuru}
            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-lg transition-all shadow-sm flex items-center gap-1.5 cursor-pointer text-[11px]"
          >
            <Download size={14} />
            <span>Unduh Template Excel Guru</span>
          </button>
        </div>

        {/* Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-4 flex-1 text-xs">
          <div
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-emerald-300 hover:border-emerald-500 bg-emerald-50/40 hover:bg-emerald-50/70 rounded-2xl p-6 text-center cursor-pointer transition-all space-y-2"
          >
            <Upload size={32} className="mx-auto text-emerald-600 animate-bounce" />
            <p className="font-extrabold text-slate-700 text-sm">
              {file ? file.name : "Klik di sini atau Seret File Excel Guru (.xlsx, .xls, .csv)"}
            </p>
            <p className="text-[11px] text-slate-500 font-medium">
              Baris dengan NIP/Username sama otomatis digabung menjadi multi-mapel beserta masing-masing kelas ajarnya.
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx, .xls, .csv"
              className="hidden"
              onChange={handleFileChange}
            />
          </div>

          {errorMessage && (
            <div className="p-3 bg-red-50 border border-red-250 rounded-xl text-red-700 font-bold text-xs flex items-center gap-2">
              <AlertTriangle size={16} />
              <span>{errorMessage}</span>
            </div>
          )}

          {isProcessing && (
            <p className="text-center py-4 font-bold text-slate-500 animate-pulse">
              Membaca & memvalidasi data guru...
            </p>
          )}

          {parsedRows.length > 0 && (
            <div className="space-y-3 pt-2">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-2">
                <span className="font-black text-slate-700 uppercase text-xs flex items-center gap-1.5">
                  <FileCheck size={16} className="text-emerald-600" />
                  Pratinjau Guru ({parsedRows.length} Akun)
                </span>
                <div className="flex items-center gap-2 text-[11px]">
                  <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 font-extrabold rounded-md">
                    Siap Disimpan: {validRows.length}
                  </span>
                  {duplicateCount > 0 && (
                    <span className="px-2 py-0.5 bg-amber-100 text-amber-800 font-extrabold rounded-md">
                      NIP/User Sudah Ada: {duplicateCount}
                    </span>
                  )}
                </div>
              </div>

              <div className="overflow-x-auto border border-slate-200 rounded-xl max-h-60 overflow-y-auto">
                <table className="w-full text-left border-collapse text-[11px]">
                  <thead className="bg-slate-100 sticky top-0 text-slate-700 font-bold border-b border-slate-200 z-10">
                    <tr>
                      <th className="p-2 border-r border-slate-200">No</th>
                      <th className="p-2 border-r border-slate-200">Nama Guru</th>
                      <th className="p-2 border-r border-slate-200">NIP</th>
                      <th className="p-2 border-r border-slate-200">Username</th>
                      <th className="p-2 border-r border-slate-200">Password</th>
                      <th className="p-2 border-r border-slate-200">Mapel & Kelas Diajar</th>
                      <th className="p-2 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-150">
                    {parsedRows.map((r, i) => (
                      <tr
                        key={r.key}
                        className={
                          r.isDuplicate
                            ? "bg-amber-50/50 text-amber-900"
                            : !r.isValid
                            ? "bg-red-50/50 text-red-900"
                            : "hover:bg-slate-50"
                        }
                      >
                        <td className="p-2 text-center font-mono border-r border-slate-200">{i + 1}</td>
                        <td className="p-2 font-bold border-r border-slate-200">{r.nama}</td>
                        <td className="p-2 font-mono border-r border-slate-200">{r.nip}</td>
                        <td className="p-2 font-mono border-r border-slate-200">{r.username}</td>
                        <td className="p-2 font-mono border-r border-slate-200">{r.password}</td>
                        <td className="p-2 border-r border-slate-200">
                          <span className="px-2 py-0.5 bg-blue-50 text-blue-700 border border-blue-200 rounded-md font-bold inline-block">
                            {r.mapelStr}
                          </span>
                        </td>
                        <td className="p-2 text-center">
                          {r.isDuplicate ? (
                            <span className="px-1.5 py-0.5 bg-amber-100 text-amber-800 rounded font-black text-[9px]">
                              NIP Ada
                            </span>
                          ) : !r.isValid ? (
                            <span className="px-1.5 py-0.5 bg-red-100 text-red-800 rounded font-black text-[9px]">
                              Tidak Lengkap
                            </span>
                          ) : (
                            <span className="px-1.5 py-0.5 bg-emerald-100 text-emerald-800 rounded font-black text-[9px] flex items-center justify-center gap-1">
                              <CheckCircle2 size={10} /> Valid
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-slate-50 border-t border-slate-200 p-4 flex justify-between items-center">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-slate-300 rounded-xl font-bold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            Batal
          </button>
          <button
            type="button"
            disabled={validRows.length === 0}
            onClick={handleCommit}
            className={`px-5 py-2.5 rounded-xl font-black text-white transition-all shadow-md flex items-center gap-2 cursor-pointer ${
              validRows.length > 0
                ? "bg-emerald-600 hover:bg-emerald-700 active:scale-95"
                : "bg-slate-350 cursor-not-allowed opacity-60"
            }`}
          >
            <CheckCircle2 size={16} />
            <span>Simpan ({validRows.length}) Guru ke Database</span>
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ==========================================
// 4. MODAL IMPORT JADWAL UJIAN
// ==========================================

interface ImportJadwalModalProps {
  existingJadwal: JadwalUjian[];
  mapelList: Mapel[];
  kelasAkademikList: KelasAkademik[];
  onClose: () => void;
  onSave: (newJadwalList: JadwalUjian[]) => void;
}

export function ImportJadwalModal({
  existingJadwal,
  mapelList,
  kelasAkademikList,
  onClose,
  onSave,
}: ImportJadwalModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [parsedRows, setParsedRows] = useState<any[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processRawRows = (rawRows: Record<string, any>[]) => {
    const today = new Date().toISOString().split("T")[0];

    const processed = rawRows.map((row, idx) => {
      const mapelStr = findVal(row, ["matapelajaran", "mapel", "pelajaran", "kodemapel"]);
      const kelasStr = findVal(row, ["sasarankelas", "kelas", "targetkelas", "rombel"]);
      let tanggal = findVal(row, ["tanggal", "tgl", "date"]) || today;
      // normalize date if DD/MM/YYYY
      if (tanggal.includes("/")) {
        const parts = tanggal.split("/");
        if (parts.length === 3) {
          tanggal = `${parts[2]}-${parts[1].padStart(2, "0")}-${parts[0].padStart(2, "0")}`;
        }
      }

      let jamMulai = findVal(row, ["jammulai", "mulai", "waktumulai", "start"]) || "08:00";
      let jamSelesai = findVal(row, ["jamselesai", "selesai", "waktuselesai", "end"]) || "09:30";
      // ensure HH:mm
      if (jamMulai.length === 4 && jamMulai.includes(":")) jamMulai = "0" + jamMulai;
      if (jamSelesai.length === 4 && jamSelesai.includes(":")) jamSelesai = "0" + jamSelesai;

      const durasiStr = findVal(row, ["durasi", "durasimenit", "waktu", "duration"]);
      const durasiMenit = parseInt(durasiStr, 10) || 90;

      const acakStr = findVal(row, ["acaksoal", "acak", "random"]).toLowerCase();
      const acakSoal = acakStr === "ya" || acakStr === "yes" || acakStr === "true" || acakStr === "1";

      // Match Mapel
      const matchedMapel = mapelList.find(
        (m) =>
          m.nama.toLowerCase().includes(mapelStr.toLowerCase()) ||
          mapelStr.toLowerCase().includes(m.nama.toLowerCase()) ||
          m.kode.toLowerCase() === mapelStr.toLowerCase()
      ) || mapelList[0];

      // Match Kelas Target
      let targetClasses: string[] = [];
      if (!kelasStr || kelasStr.toLowerCase().includes("semua")) {
        targetClasses = kelasAkademikList.map((ka) => ka.nama);
      } else {
        const requested = kelasStr.split(",").map((k) => k.trim().toLowerCase());
        targetClasses = kelasAkademikList
          .filter((ka) => requested.some((req) => ka.nama.toLowerCase().includes(req)))
          .map((ka) => ka.nama);
        if (targetClasses.length === 0) {
          targetClasses = kelasAkademikList.map((ka) => ka.nama);
        }
      }

      const isValid = Boolean(matchedMapel && tanggal && jamMulai && jamSelesai);

      return {
        key: idx,
        mapelId: matchedMapel ? matchedMapel.id : "",
        mapelNama: matchedMapel ? matchedMapel.nama : (mapelStr || "Mapel Tidak Dikenal"),
        targetClasses,
        targetClassesStr: targetClasses.join(", "),
        tanggal,
        jamMulai,
        jamSelesai,
        durasiMenit,
        acakSoal,
        isValid,
      };
    });

    setParsedRows(processed);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;
    setFile(selectedFile);
    setErrorMessage(null);
    setIsProcessing(true);
    try {
      const rawRows = await readSpreadsheet(selectedFile);
      if (rawRows.length === 0) {
        setErrorMessage("File kosong atau format kolom tidak sesuai.");
        setParsedRows([]);
      } else {
        processRawRows(rawRows);
      }
    } catch (err: any) {
      setErrorMessage(`Gagal membaca file: ${err.message || "Gunakan format .xlsx/.xls/.csv"}`);
      setParsedRows([]);
    } finally {
      setIsProcessing(false);
    }
  };

  const validRows = parsedRows.filter((r) => r.isValid);

  const handleCommit = () => {
    if (validRows.length === 0) {
      alert("Tidak ada jadwal valid untuk disimpan.");
      return;
    }

    const newJadwalItems: JadwalUjian[] = validRows.map((r) => ({
      id: `jadwal_xl_${Date.now()}_` + Math.random().toString(36).substring(2, 7),
      mapelId: r.mapelId,
      kelasIds: r.targetClasses,
      tanggal: r.tanggal,
      jamMulai: r.jamMulai,
      jamSelesai: r.jamSelesai,
      durasiMenit: r.durasiMenit,
      acakSoal: r.acakSoal,
    }));

    onSave(newJadwalItems);
    alert(`Berhasil mengimpor ${newJadwalItems.length} jadwal pelaksanaan ujian ke CBT!`);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-3 sm:p-4 animate-fade-in">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden text-left flex flex-col font-sans"
      >
        {/* Header */}
        <div className="bg-[#0666AE] text-white p-4 sm:p-5 flex justify-between items-center">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-white/10 rounded-xl">
              <Calendar size={22} className="text-emerald-300" />
            </div>
            <div>
              <h3 className="font-black text-sm sm:text-base tracking-tight">
                Import Jadwal Pelaksanaan Ujian dari Excel
              </h3>
              <p className="text-[11px] text-slate-100 font-medium">
                Plotting serentak tanggal, waktu, durasi, dan target kelas ujian CBT
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-white/80 hover:text-white bg-white/10 hover:bg-white/20 p-1.5 rounded-full cursor-pointer text-xs font-bold w-8 h-8 flex items-center justify-center"
          >
            <X size={18} />
          </button>
        </div>

        {/* Toolbar */}
        <div className="bg-slate-50 border-b border-slate-200 p-3 sm:p-4 flex flex-wrap items-center justify-between gap-3 text-xs">
          <p className="text-slate-600 font-semibold text-[11px]">
            Kolom: <span className="font-bold text-slate-800">Mata Pelajaran, Sasaran Kelas, Tanggal, Jam Mulai, Jam Selesai, Durasi, Acak Soal</span>
          </p>
          <button
            type="button"
            onClick={downloadTemplateJadwal}
            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-lg transition-all shadow-sm flex items-center gap-1.5 cursor-pointer text-[11px]"
          >
            <Download size={14} />
            <span>Unduh Template Excel Jadwal</span>
          </button>
        </div>

        {/* Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-4 flex-1 text-xs">
          <div
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-emerald-300 hover:border-emerald-500 bg-emerald-50/40 hover:bg-emerald-50/70 rounded-2xl p-6 text-center cursor-pointer transition-all space-y-2"
          >
            <Upload size={32} className="mx-auto text-emerald-600 animate-bounce" />
            <p className="font-extrabold text-slate-700 text-sm">
              {file ? file.name : "Klik di sini atau Seret File Excel Jadwal Ujian (.xlsx, .xls, .csv)"}
            </p>
            <p className="text-[11px] text-slate-500 font-medium">
              Sistem mencocokkan nama mapel dan kelas akademik yang tersedia di madrasah.
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx, .xls, .csv"
              className="hidden"
              onChange={handleFileChange}
            />
          </div>

          {errorMessage && (
            <div className="p-3 bg-red-50 border border-red-250 rounded-xl text-red-700 font-bold text-xs flex items-center gap-2">
              <AlertTriangle size={16} />
              <span>{errorMessage}</span>
            </div>
          )}

          {isProcessing && (
            <p className="text-center py-4 font-bold text-slate-500 animate-pulse">
              Membaca & memeriksa jadwal ujian...
            </p>
          )}

          {parsedRows.length > 0 && (
            <div className="space-y-3 pt-2">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-2">
                <span className="font-black text-slate-700 uppercase text-xs flex items-center gap-1.5">
                  <FileCheck size={16} className="text-emerald-600" />
                  Pratinjau Jadwal Ujian ({parsedRows.length} Baris)
                </span>
                <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 font-extrabold rounded-md text-[11px]">
                  Siap Diterbitkan: {validRows.length}
                </span>
              </div>

              <div className="overflow-x-auto border border-slate-200 rounded-xl max-h-60 overflow-y-auto">
                <table className="w-full text-left border-collapse text-[11px]">
                  <thead className="bg-slate-100 sticky top-0 text-slate-700 font-bold border-b border-slate-200 z-10">
                    <tr>
                      <th className="p-2 border-r border-slate-200">No</th>
                      <th className="p-2 border-r border-slate-200">Mata Pelajaran</th>
                      <th className="p-2 border-r border-slate-200">Sasaran Kelas</th>
                      <th className="p-2 border-r border-slate-200">Tanggal</th>
                      <th className="p-2 border-r border-slate-200">Waktu (Mulai - Selesai)</th>
                      <th className="p-2 border-r border-slate-200">Durasi</th>
                      <th className="p-2 border-r border-slate-200">Acak Soal</th>
                      <th className="p-2 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-150">
                    {parsedRows.map((r, i) => (
                      <tr key={r.key} className={!r.isValid ? "bg-red-50/50" : "hover:bg-slate-50"}>
                        <td className="p-2 text-center font-mono border-r border-slate-200">{i + 1}</td>
                        <td className="p-2 font-bold text-slate-800 border-r border-slate-200">{r.mapelNama}</td>
                        <td className="p-2 border-r border-slate-200">
                          <span className="px-1.5 py-0.5 bg-slate-100 text-slate-700 rounded font-semibold text-[10px]">
                            {r.targetClassesStr}
                          </span>
                        </td>
                        <td className="p-2 font-mono border-r border-slate-200">{r.tanggal}</td>
                        <td className="p-2 font-mono font-bold text-[#0666AE] border-r border-slate-200">
                          {r.jamMulai} - {r.jamSelesai}
                        </td>
                        <td className="p-2 font-mono border-r border-slate-200">{r.durasiMenit} Menit</td>
                        <td className="p-2 border-r border-slate-200">
                          {r.acakSoal ? (
                            <span className="text-emerald-600 font-bold">Ya</span>
                          ) : (
                            <span className="text-slate-400">Tidak</span>
                          )}
                        </td>
                        <td className="p-2 text-center">
                          {r.isValid ? (
                            <span className="px-1.5 py-0.5 bg-emerald-100 text-emerald-800 rounded font-black text-[9px] flex items-center justify-center gap-1">
                              <CheckCircle2 size={10} /> Siap Rilis
                            </span>
                          ) : (
                            <span className="px-1.5 py-0.5 bg-red-100 text-red-800 rounded font-black text-[9px]">
                              Format Kurang
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-slate-50 border-t border-slate-200 p-4 flex justify-between items-center">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-slate-300 rounded-xl font-bold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            Batal
          </button>
          <button
            type="button"
            disabled={validRows.length === 0}
            onClick={handleCommit}
            className={`px-5 py-2.5 rounded-xl font-black text-white transition-all shadow-md flex items-center gap-2 cursor-pointer ${
              validRows.length > 0
                ? "bg-emerald-600 hover:bg-emerald-700 active:scale-95"
                : "bg-slate-350 cursor-not-allowed opacity-60"
            }`}
          >
            <CheckCircle2 size={16} />
            <span>Terbitkan ({validRows.length}) Jadwal Ujian</span>
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ==========================================
// 5. MODAL IMPORT JADWAL PENGAWAS
// ==========================================

interface ImportPengawasModalProps {
  existingPengawas: Pengawas[];
  existingJadwalNgawas: JadwalNgawas[];
  mapelList: Mapel[];
  kelasList: Kelas[];
  onClose: () => void;
  onSave: (newPengawas: Pengawas[], newJadwalNgawas: JadwalNgawas[]) => void;
}

export function ImportPengawasModal({
  existingPengawas,
  existingJadwalNgawas,
  mapelList,
  kelasList,
  onClose,
  onSave,
}: ImportPengawasModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [parsedRows, setParsedRows] = useState<any[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processRawRows = (rawRows: Record<string, any>[]) => {
    const today = new Date().toISOString().split("T")[0];

    const processed = rawRows.map((row, idx) => {
      const nama = findVal(row, ["namapengawas", "nama", "pengawas", "fullname", "namalengkap"]);
      const nip = findVal(row, ["nip", "nuptk", "nippengawas"]) || `19800101${Math.floor(100000 + Math.random() * 900000)}`;
      const username =
        findVal(row, ["username", "user", "idlogin"]) ||
        `pengawas_${nip.slice(-4) || Math.floor(1000 + Math.random() * 9000)}`;
      const password = findVal(row, ["password", "katasandi", "pass"]) || "Pengawas123";
      const mapelStr = findVal(row, ["matapelajaran", "mapel", "pelajaran"]);
      const ruangStr = findVal(row, ["ruangcbt", "ruang", "namaruang", "lab"]);
      let tanggal = findVal(row, ["tanggal", "tgl", "date"]) || today;
      if (tanggal.includes("/")) {
        const parts = tanggal.split("/");
        if (parts.length === 3) {
          tanggal = `${parts[2]}-${parts[1].padStart(2, "0")}-${parts[0].padStart(2, "0")}`;
        }
      }
      const sesi = findVal(row, ["sesi", "sesiujian", "sesijaga"]) || "Sesi 1";

      // Match Mapel
      const matchedMapel = mapelList.find(
        (m) =>
          m.nama.toLowerCase().includes(mapelStr.toLowerCase()) ||
          mapelStr.toLowerCase().includes(m.nama.toLowerCase()) ||
          m.kode.toLowerCase() === mapelStr.toLowerCase()
      ) || (mapelList.length > 0 ? mapelList[0] : null);

      // Match Ruang CBT
      const matchedRuang = kelasList.find(
        (k) =>
          k.nama.toLowerCase().includes(ruangStr.toLowerCase()) ||
          ruangStr.toLowerCase().includes(k.nama.toLowerCase()) ||
          k.id === ruangStr
      ) || (kelasList.length > 0 ? kelasList[0] : null);

      const isValid = Boolean(nama && matchedMapel && matchedRuang);

      return {
        key: idx,
        nama,
        nip,
        username,
        password,
        mapelId: matchedMapel ? matchedMapel.id : "",
        mapelNama: matchedMapel ? matchedMapel.nama : (mapelStr || "Mapel CBT"),
        ruangId: matchedRuang ? matchedRuang.id : "",
        ruangNama: matchedRuang ? matchedRuang.nama : (ruangStr || "Ruang 1"),
        tanggal,
        sesi: sesi.startsWith("Sesi") ? sesi : `Sesi ${sesi}`,
        isValid,
      };
    });

    setParsedRows(processed);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;
    setFile(selectedFile);
    setErrorMessage(null);
    setIsProcessing(true);
    try {
      const rawRows = await readSpreadsheet(selectedFile);
      if (rawRows.length === 0) {
        setErrorMessage("File kosong atau format kolom tidak sesuai.");
        setParsedRows([]);
      } else {
        processRawRows(rawRows);
      }
    } catch (err: any) {
      setErrorMessage(`Gagal membaca file: ${err.message || "Gunakan format .xlsx/.xls/.csv"}`);
      setParsedRows([]);
    } finally {
      setIsProcessing(false);
    }
  };

  const validRows = parsedRows.filter((r) => r.isValid);

  const handleCommit = () => {
    if (validRows.length === 0) {
      alert("Tidak ada baris jadwal pengawas valid untuk disimpan.");
      return;
    }

    // Keep track of newly created / existing pengawas
    const pengawasPool = [...existingPengawas];
    const newPengawasCreated: Pengawas[] = [];
    const newJadwalNgawasCreated: JadwalNgawas[] = [];

    validRows.forEach((r) => {
      // Find or create Pengawas
      let pObj = pengawasPool.find(
        (p) =>
          p.nip.toLowerCase() === r.nip.toLowerCase() ||
          p.nama.toLowerCase() === r.nama.toLowerCase() ||
          p.username.toLowerCase() === r.username.toLowerCase()
      );

      if (!pObj) {
        pObj = {
          id: `pengawas_xl_${Date.now()}_` + Math.random().toString(36).substring(2, 7),
          nama: r.nama,
          nip: r.nip,
          username: r.username,
          password: r.password,
        };
        pengawasPool.push(pObj);
        newPengawasCreated.push(pObj);
      }

      // Create Jadwal Ngawas
      newJadwalNgawasCreated.push({
        id: `ngawas_xl_${Date.now()}_` + Math.random().toString(36).substring(2, 7),
        pengawasId: pObj.id,
        mapelId: r.mapelId,
        ruangId: r.ruangId,
        sesi: r.sesi,
        tanggal: r.tanggal,
      });
    });

    onSave(newPengawasCreated, newJadwalNgawasCreated);
    alert(
      `Berhasil mengimpor ${newJadwalNgawasCreated.length} plotting jadwal pengawas (${newPengawasCreated.length} personil pengawas baru ditambahkan)!`
    );
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-3 sm:p-4 animate-fade-in">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden text-left flex flex-col font-sans"
      >
        {/* Header */}
        <div className="bg-[#0666AE] text-white p-4 sm:p-5 flex justify-between items-center">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-white/10 rounded-xl">
              <Shield size={22} className="text-emerald-300" />
            </div>
            <div>
              <h3 className="font-black text-sm sm:text-base tracking-tight">
                Import Jadwal & Dewan Pengawas Ruang dari Excel
              </h3>
              <p className="text-[11px] text-slate-100 font-medium">
                Pendaftaran personil pengawas sekaligus plotting ruang ujian dan sesinya
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-white/80 hover:text-white bg-white/10 hover:bg-white/20 p-1.5 rounded-full cursor-pointer text-xs font-bold w-8 h-8 flex items-center justify-center"
          >
            <X size={18} />
          </button>
        </div>

        {/* Toolbar */}
        <div className="bg-slate-50 border-b border-slate-200 p-3 sm:p-4 flex flex-wrap items-center justify-between gap-3 text-xs">
          <p className="text-slate-600 font-semibold text-[11px]">
            Format Kolom: <span className="font-bold text-slate-800">Nama Pengawas, NIP, Username, Password, Mata Pelajaran, Ruang CBT, Tanggal, Sesi</span>
          </p>
          <button
            type="button"
            onClick={downloadTemplatePengawas}
            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-lg transition-all shadow-sm flex items-center gap-1.5 cursor-pointer text-[11px]"
          >
            <Download size={14} />
            <span>Unduh Template Excel Pengawas</span>
          </button>
        </div>

        {/* Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-4 flex-1 text-xs">
          <div
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-emerald-300 hover:border-emerald-500 bg-emerald-50/40 hover:bg-emerald-50/70 rounded-2xl p-6 text-center cursor-pointer transition-all space-y-2"
          >
            <Upload size={32} className="mx-auto text-emerald-600 animate-bounce" />
            <p className="font-extrabold text-slate-700 text-sm">
              {file ? file.name : "Klik di sini atau Seret File Excel Jadwal Pengawas (.xlsx, .xls, .csv)"}
            </p>
            <p className="text-[11px] text-slate-500 font-medium">
              Sistem otomatis membuat akun login pengawas bila belum terdaftar dan menghubungkannya dengan ruang CBT.
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx, .xls, .csv"
              className="hidden"
              onChange={handleFileChange}
            />
          </div>

          {errorMessage && (
            <div className="p-3 bg-red-50 border border-red-250 rounded-xl text-red-700 font-bold text-xs flex items-center gap-2">
              <AlertTriangle size={16} />
              <span>{errorMessage}</span>
            </div>
          )}

          {isProcessing && (
            <p className="text-center py-4 font-bold text-slate-500 animate-pulse">
              Membaca & memvalidasi plotting pengawas...
            </p>
          )}

          {parsedRows.length > 0 && (
            <div className="space-y-3 pt-2">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-2">
                <span className="font-black text-slate-700 uppercase text-xs flex items-center gap-1.5">
                  <FileCheck size={16} className="text-emerald-600" />
                  Pratinjau Jadwal Pengawas ({parsedRows.length} Baris)
                </span>
                <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 font-extrabold rounded-md text-[11px]">
                  Siap Ditetapkan: {validRows.length}
                </span>
              </div>

              <div className="overflow-x-auto border border-slate-200 rounded-xl max-h-60 overflow-y-auto">
                <table className="w-full text-left border-collapse text-[11px]">
                  <thead className="bg-slate-100 sticky top-0 text-slate-700 font-bold border-b border-slate-200 z-10">
                    <tr>
                      <th className="p-2 border-r border-slate-200">No</th>
                      <th className="p-2 border-r border-slate-200">Nama Pengawas</th>
                      <th className="p-2 border-r border-slate-200">NIP</th>
                      <th className="p-2 border-r border-slate-200">Username Login</th>
                      <th className="p-2 border-r border-slate-200">Mata Pelajaran</th>
                      <th className="p-2 border-r border-slate-200">Ruang CBT</th>
                      <th className="p-2 border-r border-slate-200">Tanggal</th>
                      <th className="p-2 border-r border-slate-200">Sesi</th>
                      <th className="p-2 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-150">
                    {parsedRows.map((r, i) => (
                      <tr key={r.key} className={!r.isValid ? "bg-red-50/50" : "hover:bg-slate-50"}>
                        <td className="p-2 text-center font-mono border-r border-slate-200">{i + 1}</td>
                        <td className="p-2 font-bold text-slate-800 border-r border-slate-200">{r.nama}</td>
                        <td className="p-2 font-mono border-r border-slate-200">{r.nip}</td>
                        <td className="p-2 font-mono border-r border-slate-200">{r.username}</td>
                        <td className="p-2 font-semibold text-[#0666AE] border-r border-slate-200">{r.mapelNama}</td>
                        <td className="p-2 font-bold border-r border-slate-200">{r.ruangNama}</td>
                        <td className="p-2 font-mono border-r border-slate-200">{r.tanggal}</td>
                        <td className="p-2 border-r border-slate-200">
                          <span className="px-1.5 py-0.5 bg-blue-100 text-blue-800 rounded font-bold text-[10px]">
                            {r.sesi}
                          </span>
                        </td>
                        <td className="p-2 text-center">
                          {r.isValid ? (
                            <span className="px-1.5 py-0.5 bg-emerald-100 text-emerald-800 rounded font-black text-[9px] flex items-center justify-center gap-1">
                              <CheckCircle2 size={10} /> Valid
                            </span>
                          ) : (
                            <span className="px-1.5 py-0.5 bg-red-100 text-red-800 rounded font-black text-[9px]">
                              Tidak Lengkap
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-slate-50 border-t border-slate-200 p-4 flex justify-between items-center">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-slate-300 rounded-xl font-bold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            Batal
          </button>
          <button
            type="button"
            disabled={validRows.length === 0}
            onClick={handleCommit}
            className={`px-5 py-2.5 rounded-xl font-black text-white transition-all shadow-md flex items-center gap-2 cursor-pointer ${
              validRows.length > 0
                ? "bg-emerald-600 hover:bg-emerald-700 active:scale-95"
                : "bg-slate-350 cursor-not-allowed opacity-60"
            }`}
          >
            <CheckCircle2 size={16} />
            <span>Simpan ({validRows.length}) Jadwal Pengawas</span>
          </button>
        </div>
      </motion.div>
    </div>
  );
}
