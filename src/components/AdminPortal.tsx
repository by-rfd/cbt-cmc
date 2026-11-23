import React, { useState, useEffect } from "react";
import {
  getDB,
  setDB,
  subscribeToDB,
  notifySync,
  isFirebaseConfigured,
  seedDefaultDataToFirebase,
  getSyncStatus,
  subscribeToSyncStatus,
  clearSyncError,
  getBackendProvider,
  SyncStatus,
} from "../firebaseConfig";
import {
  Kelas,
  Mapel,
  Siswa,
  Guru,
  GuruAmpuan,
  Soal,
  JadwalUjian,
  TokenUjian,
  SesiSiswa,
  HasilUjian,
  KonfigurasiSekolah,
  Pengawas,
  JadwalNgawas,
} from "../types";
import {
  LayoutDashboard,
  FolderOpen,
  Users,
  BookOpen,
  Calendar,
  Database,
  Key,
  Activity,
  Award,
  ShieldCheck,
  Plus,
  Trash2,
  Edit,
  FileSpreadsheet,
  FileText,
  QrCode,
  RotateCw,
  Clock,
  Printer,
  Settings,
  Shield,
  Check,
  Play,
  Upload,
  Download,
  LogOut,
  Layers,
  ShieldAlert,
  Trash,
  X,
  Smartphone,
  Menu,
  Search,
  Filter,
  UserCheck,
  CheckSquare,
  Square,
  ImagePlus,
  Eye,
  AlertCircle,
  Cloud,
  CheckCircle2,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import * as XLSX from "xlsx";
import { PrintCards, PrintBeritaAcara } from "./PrintViews";
import {
  downloadTemplateSiswa,
  downloadTemplateMapel,
  downloadTemplateGuru,
  downloadTemplateJadwal,
  downloadTemplatePengawas,
  ImportSiswaModal,
  ImportMapelModal,
  ImportGuruModal,
  ImportJadwalModal,
  ImportPengawasModal,
} from "./ExcelImportModals";
import {
  filterQuestionsForJadwal,
  isQuestionClassMatchForSchedule,
  formatSoalKelasNames,
  normalizeSoalKelasIds,
  getClassGradeLevel,
  SYSTEM_GURU_ID,
} from "../utils/examQuestionFilter";
import {
  executeForceSubmitSession,
  executeResetStudentSession,
} from "../utils/sessionControls";
import {
  parseMassSoalText,
  buildSoalObjectsFromParsed,
  OpsiKey,
} from "../utils/massSoalParser";
import { parseDocxSoalFile } from "../utils/docxSoalParser";
import { compressImageFile } from "../utils/imageUtils";
import RichMathText from "./RichMathText";

interface AdminPortalProps {
  onLogout: () => void;
  adminEmail: string;
}

export default function AdminPortal({ onLogout, adminEmail }: AdminPortalProps) {
  const [activeMenu, setActiveMenu] = useState("dashboard");
  const [dbState, setDbState] = useState({
    kelas: getDB.kelas(),
    kelasAkademik: getDB.kelasAkademik(),
    mapel: getDB.mapel(),
    siswa: getDB.siswa(),
    guru: getDB.guru(),
    pengawas: getDB.pengawas(),
    jadwalNgawas: getDB.jadwalNgawas(),
    soal: getDB.soal(),
    jadwal: getDB.jadwal(),
    tokens: getDB.tokens(),
    sessions: getDB.sessions(),
    hasil: getDB.hasil(),
    konfig: getDB.konfig(),
  });

  const [syncStatus, setSyncStatus] = useState<SyncStatus>(getSyncStatus());
  const [toastMsg, setToastMsg] = useState<{ type: "success" | "error" | "info"; text: string } | null>(null);

  const showToast = (text: string, type: "success" | "error" | "info" = "success") => {
    setToastMsg({ type, text });
    window.setTimeout(() => {
      setToastMsg((prev) => (prev?.text === text ? null : prev));
    }, 4500);
  };

  // Synchronize on observer update
  useEffect(() => {
    const unsubDB = subscribeToDB(() => {
      setDbState({
        kelas: getDB.kelas(),
        kelasAkademik: getDB.kelasAkademik(),
        mapel: getDB.mapel(),
        siswa: getDB.siswa(),
        guru: getDB.guru(),
        pengawas: getDB.pengawas(),
        jadwalNgawas: getDB.jadwalNgawas(),
        soal: getDB.soal(),
        jadwal: getDB.jadwal(),
        tokens: getDB.tokens(),
        sessions: getDB.sessions(),
        hasil: getDB.hasil(),
        konfig: getDB.konfig(),
      });
    });
    const unsubSync = subscribeToSyncStatus((status) => {
      setSyncStatus(status);
    });
    return () => {
      unsubDB();
      unsubSync();
    };
  }, []);

  // Selection & Filter states for Rekap Nilai
  const [selectedHasilIds, setSelectedHasilIds] = useState<string[]>([]);
  const [nilaiFilterMapel, setNilaiFilterMapel] = useState("");
  const [nilaiFilterKelas, setNilaiFilterKelas] = useState("");
  const [nilaiSearch, setNilaiSearch] = useState("");

  const getNilaiGradeLevel = (nama: string): "VII" | "VIII" | "IX" | "Lainnya" => {
    const upper = (nama || "").toUpperCase();
    if (/\bIX\b/.test(upper) || /\b9\b/.test(upper) || /\b9[A-Z]\b/.test(upper)) return "IX";
    if (/\bVIII\b/.test(upper) || /\b8\b/.test(upper) || /\b8[A-Z]\b/.test(upper)) return "VIII";
    if (/\bVII\b/.test(upper) || /\b7\b/.test(upper) || /\b7[A-Z]\b/.test(upper)) return "VII";
    return "Lainnya";
  };

  const getFilteredAdminHasil = () => {
    return (dbState.hasil || []).filter((h: any) => {
      if (nilaiFilterMapel) {
        const mapelObj = dbState.mapel.find((m) => m.id === nilaiFilterMapel);
        const matchById = h.mapelId && h.mapelId === nilaiFilterMapel;
        const matchByName = mapelObj && h.mapelNama === mapelObj.nama;
        if (!matchById && !matchByName) return false;
      }

      if (nilaiFilterKelas) {
        const siswaKelas = (h.siswaKelas || "").trim();
        if (nilaiFilterKelas.startsWith("grade:")) {
          const targetLvl = nilaiFilterKelas.replace("grade:", "");
          if (getNilaiGradeLevel(siswaKelas) !== targetLvl) return false;
        } else {
          if (siswaKelas.toLowerCase() !== nilaiFilterKelas.trim().toLowerCase()) return false;
        }
      }

      if (nilaiSearch.trim()) {
        const q = nilaiSearch.trim().toLowerCase();
        const matchNama = (h.siswaNama || "").toLowerCase().includes(q);
        const matchKelas = (h.siswaKelas || "").toLowerCase().includes(q);
        const matchMapel = (h.mapelNama || "").toLowerCase().includes(q);
        if (!matchNama && !matchKelas && !matchMapel) return false;
      }

      return true;
    });
  };

  // Interactive confirm modal states to bypass sandboxed iframe confirm() restrictions
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void | Promise<void>;
    isDanger?: boolean;
  } | null>(null);

  const triggerConfirm = (title: string, message: string, onConfirm: () => void | Promise<void>, isDanger = true) => {
    setConfirmModal({
      isOpen: true,
      title,
      message,
      onConfirm,
      isDanger,
    });
  };

  // Sub edit modes in Data Master
  const [editingRuangId, setEditingRuangId] = useState<string | null>(null);
  const [editingMapelId, setEditingMapelId] = useState<string | null>(null);

  // Academic class management states
  const [editingKelasAkademikId, setEditingKelasAkademikId] = useState<string | null>(null);
  const [inputKelasAkademikNama, setInputKelasAkademikNama] = useState("");

  // Schedule edit states
  const [editingJadwalId, setEditingJadwalId] = useState<string | null>(null);

  // Question configuration modal/overlay option
  const [openConfigJadwalId, setOpenConfigJadwalId] = useState<string | null>(null);
  const [configModalSearch, setConfigModalSearch] = useState("");
  const [configModalFilterGuru, setConfigModalFilterGuru] = useState<string>("ALL");
  const [configModalFilterStatus, setConfigModalFilterStatus] = useState<"ALL" | "MATCHED" | "OTHER">("ALL");

  const handleOpenConfigModal = (jadwalId: string) => {
    setConfigModalSearch("");
    setConfigModalFilterGuru("ALL");
    setConfigModalFilterStatus("ALL");
    setOpenConfigJadwalId(jadwalId);
  };

  // Firebase seeding / migration status states
  const [isSeeding, setIsSeeding] = useState(false);
  const [seedError, setSeedError] = useState<string | null>(null);
  const [seedSuccess, setSeedSuccess] = useState(false);

  const handleConfigureFirebaseSeeding = () => {
    triggerConfirm(
      "Seeding Data Bawaan ke Cloud Firestore",
      "PERINGATAN: Tindakan ini akan menimpa seluruh data saat ini dengan data contoh bawaan (seeding default). Apakah Anda yakin?",
      async () => {
        setIsSeeding(true);
        setSeedError(null);
        setSeedSuccess(false);
        try {
          await seedDefaultDataToFirebase();
          setSeedSuccess(true);
          showToast("Inisialisasi seeding data bawaan berhasil disimpan!");
        } catch (err: any) {
          setSeedError(err?.message || String(err));
          showToast("Gagal inisialisasi data: " + (err?.message || String(err)), "error");
        } finally {
          setIsSeeding(false);
        }
      },
      true
    );
  };

  const handleExportBackupJSON = () => {
    const backupData = {
      app: "CBT MTs. AL-MA'SUM II CMC",
      version: "1.0",
      exportedAt: new Date().toISOString(),
      school: dbState.konfig.namaSekolah,
      soal: dbState.soal,
      siswa: dbState.siswa,
      guru: dbState.guru,
      pengawas: dbState.pengawas,
      jadwalNgawas: dbState.jadwalNgawas,
      jadwal: dbState.jadwal,
      mapel: dbState.mapel,
      kelas: dbState.kelas,
      kelasAkademik: dbState.kelasAkademik,
      konfig: dbState.konfig,
      hasil: dbState.hasil,
    };
    const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Backup_Database_CBT_${dbState.konfig.kodeRegistrasi}_${new Date().toISOString().split("T")[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleRestoreBackupJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    triggerConfirm(
      "Pulihkan Cadangan Database",
      `Apakah Anda yakin ingin memulihkan data dari berkas cadangan "${file.name}"? Data di database akan disinkronkan dengan isi cadangan ini.`,
      () => {
        const reader = new FileReader();
        reader.onload = (evt) => {
          try {
            const text = evt.target?.result as string;
            const data = JSON.parse(text);

            let restoredCount = 0;
            if (Array.isArray(data.soal)) { setDB.soal(data.soal); restoredCount++; }
            if (Array.isArray(data.siswa)) { setDB.siswa(data.siswa); restoredCount++; }
            if (Array.isArray(data.guru)) { setDB.guru(data.guru); restoredCount++; }
            if (Array.isArray(data.pengawas)) { setDB.pengawas(data.pengawas); restoredCount++; }
            if (Array.isArray(data.jadwalNgawas)) { setDB.jadwalNgawas(data.jadwalNgawas); restoredCount++; }
            if (Array.isArray(data.jadwal)) { setDB.jadwal(data.jadwal); restoredCount++; }
            if (Array.isArray(data.mapel)) { setDB.mapel(data.mapel); restoredCount++; }
            if (Array.isArray(data.kelas)) { setDB.kelas(data.kelas); restoredCount++; }
            if (Array.isArray(data.kelasAkademik)) { setDB.kelasAkademik(data.kelasAkademik); restoredCount++; }
            if (data.konfig) { setDB.konfig(data.konfig); restoredCount++; }
            if (Array.isArray(data.hasil)) { setDB.hasil(data.hasil); restoredCount++; }

            showToast(`Pemulihan berhasil! ${restoredCount} entitas data disinkronkan ke Cloud Firestore.`);
          } catch (err: any) {
            showToast("Gagal membaca berkas cadangan: " + (err.message || "Pastikan format file JSON valid."), "error");
          }
        };
        reader.readAsText(file);
      },
      true
    );
    e.target.value = "";
  };

  // Helper for generating token: 4 letters + 2 numbers (e.g., ABCD12)
  const generateToken4L2N = (): string => {
    const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    const numbers = "0123456789";
    let token = "";
    for (let i = 0; i < 4; i++) {
      token += letters.charAt(Math.floor(Math.random() * letters.length));
    }
    for (let i = 0; i < 2; i++) {
      token += numbers.charAt(Math.floor(Math.random() * numbers.length));
    }
    return token;
  };

  // Sync token rotation local simulation timer (10 Minutes)
  const [timerProgress, setTimerProgress] = useState(100);
  const [secondsRemaining, setSecondsRemaining] = useState(600); // 10 minutes = 600s

  useEffect(() => {
    // Only generate missing initial tokens when cloud snapshot arrives; avoid automatic startup writes on existing tokens
    if (syncStatus.cloudReady && !syncStatus.quotaExceeded) {
      const currentTokens = getDB.tokens();
      const activeJadwal = getDB.jadwal();
      if (activeJadwal.length > 0 && currentTokens.length === 0) {
        rotateAllTokens();
      }
    }

    const interval = setInterval(() => {
      setSecondsRemaining((prev) => {
        if (prev <= 1) {
          const st = getSyncStatus();
          if (st.cloudReady && !st.quotaExceeded) {
            rotateAllTokens();
          }
          return 600;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [syncStatus.cloudReady]);

  useEffect(() => {
    setTimerProgress((secondsRemaining / 600) * 100);
  }, [secondsRemaining]);

  // Auto-repair orphaned questions globally only after initial cloud load completes
  useEffect(() => {
    if (!syncStatus.cloudReady || syncStatus.quotaExceeded) return;
    if (dbState.soal.length > 0 && dbState.mapel.length > 0 && dbState.guru.length > 0) {
      let needsRepair = false;
      const repairedSoals = dbState.soal.map((s) => {
        const mapelExists = dbState.mapel.some((m) => m.id === s.mapelId);
        if (!mapelExists) {
          const teacherObj = dbState.guru.find((g) => g.id === s.guruId);
          const teacherMapels = teacherObj?.mapelIds || [];

          let targetMapelId = "";
          if (teacherMapels.length > 0) {
            targetMapelId = teacherMapels[0];
          } else {
            targetMapelId = dbState.mapel[0].id;
          }

          if (targetMapelId && s.mapelId !== targetMapelId) {
            needsRepair = true;
            return {
              ...s,
              mapelId: targetMapelId,
            };
          }
        }
        return s;
      });

      if (needsRepair) {
        setDB.soal(repairedSoals);
      }
    }
  }, [syncStatus.cloudReady, dbState.soal, dbState.mapel, dbState.guru]);

  const rotateAllTokens = () => {
    const activeExams = getDB.jadwal();
    const mapels = getDB.mapel();
    const updatedTokens: TokenUjian[] = [];

    activeExams.forEach((exam) => {
      const matchMapel = mapels.find((m) => m.id === exam.mapelId);
      const mapelNama = matchMapel ? matchMapel.nama : "Ujian CBT";
      const randomToken = generateToken4L2N();

      updatedTokens.push({
        id: exam.mapelId,
        mapelNama,
        token: randomToken,
        createdAt: Date.now(),
        expiresAt: Date.now() + 10 * 60 * 1000,
      });
    });

    setDB.tokens(updatedTokens);
  };

  const handleManualTokenRotation = (mapelId: string) => {
    const currentTokens = [...getDB.tokens()];
    const index = currentTokens.findIndex((t) => t.id === mapelId);
    if (index !== -1) {
      const randomToken = generateToken4L2N();
      currentTokens[index].token = randomToken;
      currentTokens[index].createdAt = Date.now();
      currentTokens[index].expiresAt = Date.now() + 10 * 60 * 1000;
      setDB.tokens(currentTokens);
    }
  };

  const formatTimeMinutes = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const [showPrintCards, setShowPrintCards] = useState(false);
  const [showPrintBeritaAcara, setShowPrintBeritaAcara] = useState(false);
  const [showImportExcelSiswaModal, setShowImportExcelSiswaModal] = useState(false);
  const [showImportExcelMapelModal, setShowImportExcelMapelModal] = useState(false);
  const [showImportExcelGuruModal, setShowImportExcelGuruModal] = useState(false);
  const [showImportExcelJadwalModal, setShowImportExcelJadwalModal] = useState(false);
  const [showImportExcelPengawasModal, setShowImportExcelPengawasModal] = useState(false);
  const [excelSiswaInput, setExcelSiswaInput] = useState("");

  // Class & Jurusan (Ruang CBT) States & Handlers
  const [inputKelasNama, setInputKelasNama] = useState("");
  const [inputKelasJurusan, setInputKelasJurusan] = useState("UMUM");

  const handleAddKelas = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputKelasNama.trim()) return;
    const items = [...getDB.kelas()];
    let feedbackMsg = "";

    if (editingRuangId) {
      const index = items.findIndex((k) => k.id === editingRuangId);
      if (index !== -1) {
        items[index] = {
          ...items[index],
          nama: inputKelasNama.trim(),
          jurusan: inputKelasJurusan,
        };
        feedbackMsg = "Ruang CBT berhasil diperbarui & tersimpan realtime!";
      }
      setEditingRuangId(null);
    } else {
      const item = {
        id: "kelas_" + Date.now(),
        nama: inputKelasNama.trim(),
        jurusan: inputKelasJurusan,
      };
      items.push(item);
      feedbackMsg = "Ruang CBT baru berhasil ditambahkan & tersimpan realtime!";
    }

    setDB.kelas(items);
    setInputKelasNama("");
    setInputKelasJurusan("UMUM");
    if (feedbackMsg) showToast(feedbackMsg);
  };

  const handleEditRuangClick = (k: any) => {
    setEditingRuangId(k.id);
    setInputKelasNama(k.nama);
    setInputKelasJurusan(k.jurusan);
  };

  const handleCancelEditRuang = () => {
    setEditingRuangId(null);
    setInputKelasNama("");
    setInputKelasJurusan("UMUM");
  };

  const handleDeleteKelas = (id: string) => {
    triggerConfirm(
      "Hapus Ruang CBT",
      "Apakah Anda yakin ingin menghapus Ruang CBT ini? Data tidak dapat dipulihkan.",
      async () => {
        const ok = await setDB.deleteKelas(id);
        showToast(ok ? "Ruang CBT berhasil dihapus permanen di server." : "Gagal menghapus di server Firestore (cek status kuota/koneksi).", ok ? "success" : "error");
      }
    );
  };

  // Subject (Mata Pelajaran) States & Handlers
  const [inputMapelNama, setInputMapelNama] = useState("");
  const [inputMapelKode, setInputMapelKode] = useState("");

  const handleAddMapel = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputMapelNama.trim()) return;
    const items = [...getDB.mapel()];

    // Auto-generate high-quality uppercase key/code for backward-compatibility
    const autoKode = inputMapelNama
      .trim()
      .replace(/[^a-zA-Z0-9]/g, "")
      .substring(0, 8)
      .toUpperCase() || "MPL";

    let feedbackMsg = "";
    if (editingMapelId) {
      const index = items.findIndex((m) => m.id === editingMapelId);
      if (index !== -1) {
        items[index] = {
          ...items[index],
          nama: inputMapelNama.trim(),
          kode: autoKode,
        };
        feedbackMsg = "Mata Pelajaran berhasil diperbarui & tersimpan realtime!";
      }
      setEditingMapelId(null);
    } else {
      const item = {
        id: "mapel_" + Date.now(),
        nama: inputMapelNama.trim(),
        kode: autoKode,
      };
      items.push(item);
      feedbackMsg = "Mata Pelajaran baru berhasil ditambahkan & tersimpan realtime!";
    }

    setDB.mapel(items);
    setInputMapelNama("");
    setInputMapelKode("");
    if (feedbackMsg) showToast(feedbackMsg);
  };

  const handleEditMapelClick = (m: any) => {
    setEditingMapelId(m.id);
    setInputMapelNama(m.nama);
    setInputMapelKode(m.kode || "");
  };

  const handleCancelEditMapel = () => {
    setEditingMapelId(null);
    setInputMapelNama("");
    setInputMapelKode("");
  };

  const handleDeleteMapel = (id: string) => {
    triggerConfirm(
      "Hapus Mata Pelajaran",
      "Apakah Anda yakin ingin menghapus Mata Pelajaran ini? Semua relasi guru, soal, dan jadwal mapel bersangkutan akan terdampak.",
      async () => {
        const ok = await setDB.deleteMapel(id);
        showToast(ok ? "Mata pelajaran berhasil dihapus permanen di server." : "Gagal menghapus di server Firestore (cek status kuota/koneksi).", ok ? "success" : "error");
      }
    );
  };

  // Academic Class (Kelas Akademik) Handlers
  const handleAddKelasAkademik = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputKelasAkademikNama.trim()) return;
    const items = [...getDB.kelasAkademik()];
    let feedbackMsg = "";

    if (editingKelasAkademikId) {
      const index = items.findIndex((ka) => ka.id === editingKelasAkademikId);
      if (index !== -1) {
        items[index] = {
          ...items[index],
          nama: inputKelasAkademikNama.trim(),
        };
        feedbackMsg = "Nama Kelas Akademik berhasil diperbarui & tersimpan!";
      }
      setEditingKelasAkademikId(null);
    } else {
      if (items.some((ka) => ka.nama.toLowerCase() === inputKelasAkademikNama.trim().toLowerCase())) {
        showToast("Kelas Akademik dengan nama tersebut sudah terdaftar!", "error");
        return;
      }
      const item = {
        id: "kelas_akademik_" + Date.now(),
        nama: inputKelasAkademikNama.trim(),
      };
      items.push(item);
      feedbackMsg = "Kelas Akademik baru berhasil dideklarasikan & tersimpan!";
    }

    setDB.kelasAkademik(items);
    setInputKelasAkademikNama("");
    if (feedbackMsg) showToast(feedbackMsg);
  };

  const handleEditKelasAkademikClick = (ka: any) => {
    setEditingKelasAkademikId(ka.id);
    setInputKelasAkademikNama(ka.nama);
  };

  const handleCancelEditKelasAkademik = () => {
    setEditingKelasAkademikId(null);
    setInputKelasAkademikNama("");
  };

  const handleDeleteKelasAkademik = (id: string) => {
    triggerConfirm(
      "Hapus Kelas Akademik",
      "Apakah Anda yakin ingin menghapus Kelas Akademik ini? Data siswa yang terdaftar di kelas ini akan terpengaruh.",
      async () => {
        const ok = await setDB.deleteKelasAkademik(id);
        showToast(ok ? "Kelas akademik berhasil dihapus permanen di server." : "Gagal menghapus di server Firestore (cek status kuota/koneksi).", ok ? "success" : "error");
      }
    );
  };

  // Student States
  const [inputSiswaNama, setInputSiswaNama] = useState("");
  const [inputSiswaNisn, setInputSiswaNisn] = useState("");
  const [inputSiswaUser, setInputSiswaUser] = useState("");
  const [inputSiswaPass, setInputSiswaPass] = useState("");
  const [inputSiswaKelasAkademik, setInputSiswaKelasAkademik] = useState("");
  const [inputSiswaKelas, setInputSiswaKelas] = useState(""); // represents ruangId / kelasId
  const [inputSiswaNoPeserta, setInputSiswaNoPeserta] = useState("");
  const [editingSiswaId, setEditingSiswaId] = useState<string | null>(null);

  const handleAddSiswa = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputSiswaNama.trim() || !inputSiswaNisn.trim() || !inputSiswaUser.trim() || !inputSiswaKelas || !inputSiswaKelasAkademik || !inputSiswaNoPeserta.trim()) {
      showToast("Silakan lengkapi seluruh isian siswa (termasuk Kelas, Ruang, dan No. Peserta)!", "error");
      return;
    }
    const items = [...getDB.siswa()];
    let feedbackMsg = "";
    if (editingSiswaId) {
      // Editing Mode
      const index = items.findIndex((s) => s.id === editingSiswaId);
      if (index !== -1) {
        items[index] = {
          ...items[index],
          nama: inputSiswaNama.trim(),
          nisn: inputSiswaNisn.trim(),
          username: inputSiswaUser.trim(),
          password: inputSiswaPass || "Password123",
          kelasId: inputSiswaKelas,
          kelas: inputSiswaKelasAkademik,
          noPeserta: inputSiswaNoPeserta.trim(),
        };
        feedbackMsg = `Data siswa ${inputSiswaNama.trim()} berhasil diperbarui & tersimpan realtime!`;
      }
      setEditingSiswaId(null);
    } else {
      // Adding Mode
      if (items.some((s) => s.nisn === inputSiswaNisn.trim())) {
        showToast("Siswa dengan NISN tersebut sudah ada!", "error");
        return;
      }
      const item: Siswa = {
        id: "siswa_" + Date.now(),
        nama: inputSiswaNama.trim(),
        nisn: inputSiswaNisn.trim(),
        username: inputSiswaUser.trim(),
        password: inputSiswaPass || "Password123",
        kelasId: inputSiswaKelas,
        kelas: inputSiswaKelasAkademik,
        noPeserta: inputSiswaNoPeserta.trim(),
      };
      items.push(item);
      feedbackMsg = `Siswa baru ${item.nama} berhasil didaftarkan & tersimpan realtime!`;
    }
    setDB.siswa(items);
    setInputSiswaNama("");
    setInputSiswaNisn("");
    setInputSiswaUser("");
    setInputSiswaPass("");
    setInputSiswaKelasAkademik("");
    setInputSiswaKelas("");
    setInputSiswaNoPeserta("");
    if (feedbackMsg) showToast(feedbackMsg);
  };

  const handleEditSiswaClick = (siswa: Siswa) => {
    setEditingSiswaId(siswa.id);
    setInputSiswaNama(siswa.nama);
    setInputSiswaNisn(siswa.nisn);
    setInputSiswaUser(siswa.username);
    setInputSiswaPass(siswa.password || "Password123");
    setInputSiswaKelasAkademik(siswa.kelas || "");
    setInputSiswaKelas(siswa.kelasId);
    setInputSiswaNoPeserta(siswa.noPeserta || "");
    window.setTimeout(() => {
      document.getElementById("form-edit-siswa")?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 60);
  };

  const handleCancelEditSiswa = () => {
    setEditingSiswaId(null);
    setInputSiswaNama("");
    setInputSiswaNisn("");
    setInputSiswaUser("");
    setInputSiswaPass("");
    setInputSiswaKelasAkademik("");
    setInputSiswaKelas("");
    setInputSiswaNoPeserta("");
  };

  const handleDeleteSiswa = (id: string) => {
    triggerConfirm(
      "Hapus Data Siswa",
      "Apakah Anda yakin ingin menghapus data siswa ini secara permanen dari server?",
      async () => {
        const ok = await setDB.deleteSiswa(id);
        showToast(ok ? "Data siswa berhasil dihapus permanen di server." : "Gagal menghapus di server Firestore (cek status kuota/koneksi).", ok ? "success" : "error");
      }
    );
  };

  const handleSimulateImportSiswa = () => {
    const demoStudents = [
      { id: "s_imp_1", nama: "Galih Wicaksono", nisn: "0095432110", username: "galihw", password: "Password123", kelasId: "k1", kelas: "Kelas IX-1", noPeserta: "26-04-01-0010" },
      { id: "s_imp_2", nama: "Indah Permatasari", nisn: "0095432111", username: "indahp", password: "Password123", kelasId: "k2", kelas: "Kelas IX-1", noPeserta: "26-04-01-0011" },
      { id: "s_imp_3", nama: "Muhammad Ridho", nisn: "0095432112", username: "ridhom", password: "Password123", kelasId: "k3", kelas: "Kelas IX-2", noPeserta: "26-04-02-0010" },
      { id: "s_imp_4", nama: "Nadia Syahila", nisn: "0115432113", username: "nadias", password: "Password123", kelasId: "k4", kelas: "Kelas VII-1", noPeserta: "26-04-03-0010" },
      { id: "s_imp_5", nama: "Rian Hidayat", nisn: "0105432114", username: "rianh", password: "Password123", kelasId: "k1", kelas: "Kelas VIII-1", noPeserta: "26-04-04-0010" },
    ];
    const consolidated = [...getDB.siswa()];
    demoStudents.forEach((stud) => {
      if (!consolidated.some((s) => s.nisn === stud.nisn)) {
        consolidated.push(stud);
      }
    });
    setDB.siswa(consolidated);
    showToast("5 siswa demo dari template berhasil dimuat ke sistem!");
  };

  const handleProcessImportExcel = (textInput: string) => {
    if (!textInput.trim()) {
      showToast("Silakan tempel (paste) data dari Excel terlebih dahulu!", "error");
      return;
    }

    const lines = textInput.split("\n").map(l => l.trim()).filter(l => l.length > 0);
    if (lines.length === 0) {
      showToast("Tidak ada baris data yang terbaca.", "error");
      return;
    }

    const currentStudents = [...getDB.siswa()];
    const currentKelas = getDB.kelas();
    let addedCount = 0;
    let skippedCount = 0;

    lines.forEach((line) => {
      if (line.toLowerCase().includes("nama") && line.toLowerCase().includes("nisn")) {
        return;
      }

      const cols = line.split("\t");
      if (cols.length >= 2) {
        const nama = cols[0] || "";
        const nisn = cols[1] || "";
        const noPeserta = cols[2] || `26-04-01-${Math.floor(1000 + Math.random() * 9000)}`;
        const username = cols[3] || `siswa_${nisn || Math.floor(Math.random() * 100000)}`;
        const password = cols[4] || "Password123";
        const kelas = cols[5] || "Kelas VII-1";
        const ruangNama = cols[6] || "";

        let kelasId = currentKelas[0]?.id || "k1";
        if (ruangNama) {
          const matchedRuang = currentKelas.find(
            (k) =>
              k.nama.toLowerCase().includes(ruangNama.trim().toLowerCase()) ||
              k.id === ruangNama.trim()
          );
          if (matchedRuang) {
            kelasId = matchedRuang.id;
          }
        }

        if (currentStudents.some((s) => s.nisn === nisn)) {
          skippedCount++;
        } else if (nama && nisn) {
          currentStudents.push({
            id: `siswa_xls_${Date.now()}_` + Math.random().toString(36).substr(2, 5),
            nama: nama.trim(),
            nisn: nisn.trim(),
            noPeserta: noPeserta.trim(),
            username: username.trim(),
            password: password.trim(),
            kelas: kelas.trim(),
            kelasId,
          });
          addedCount++;
        } else {
          skippedCount++;
        }
      } else {
        skippedCount++;
      }
    });

    if (addedCount > 0) {
      setDB.siswa(currentStudents);
      setShowImportExcelSiswaModal(false);
      setExcelSiswaInput("");
      showToast(`Sukses mengimpor ${addedCount} siswa dari data Excel! (Dilewati: ${skippedCount})`);
    } else {
      showToast(`Gagal mengimpor data. Tidak ada baris baru yang valid (Dilewati: ${skippedCount}).`, "error");
    }
  };

  // Teacher States
  const [inputGuruNama, setInputGuruNama] = useState("");
  const [inputGuruNip, setInputGuruNip] = useState("");
  const [inputGuruUser, setInputGuruUser] = useState("");
  const [inputGuruPass, setInputGuruPass] = useState("");
  const [inputGuruMapelKelas, setInputGuruMapelKelas] = useState<GuruAmpuan[]>([]);
  const [activePlotMapelId, setActivePlotMapelId] = useState<string>("");
  const [editingGuruId, setEditingGuruId] = useState<string | null>(null);
  const [guruPlotModalTarget, setGuruPlotModalTarget] = useState<Guru | null>(null);
  const [modalPlotMapelKelas, setModalPlotMapelKelas] = useState<GuruAmpuan[]>([]);
  const [modalPlotActiveMapelId, setModalPlotActiveMapelId] = useState<string>("");
  const [modalPlotSearchMapel, setModalPlotSearchMapel] = useState<string>("");

  const handleAddGuru = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputGuruNama.trim() || !inputGuruNip.trim() || !inputGuruUser.trim()) {
      showToast("Silakan lengkapi Data dewan Guru (Nama, NIP, dan Username)!", "error");
      return;
    }
    const items = [...getDB.guru()];
    const cleanMapelKelas = inputGuruMapelKelas.map((mk) => ({
      mapelId: mk.mapelId,
      kelasIds: Array.from(new Set(mk.kelasIds || [])),
    }));
    const syncedMapelIds = cleanMapelKelas.map((mk) => mk.mapelId);

    let feedbackMsg = "";
    if (editingGuruId) {
      // Editing Mode
      const index = items.findIndex((g) => g.id === editingGuruId);
      if (index !== -1) {
        items[index] = {
          ...items[index],
          nama: inputGuruNama.trim(),
          nip: inputGuruNip.trim(),
          username: inputGuruUser.trim(),
          password: inputGuruPass || "Password123",
          mapelIds: syncedMapelIds,
          mapelKelas: cleanMapelKelas,
        };
        feedbackMsg = `Data guru ${inputGuruNama.trim()} berhasil diperbarui & tersimpan realtime!`;
      }
      setEditingGuruId(null);
    } else {
      // Adding Mode
      if (items.some((g) => g.nip === inputGuruNip.trim())) {
        showToast("Guru dengan NIP tersebut sudah terdaftar!", "error");
        return;
      }
      const item: Guru = {
        id: "guru_" + Date.now(),
        nama: inputGuruNama.trim(),
        nip: inputGuruNip.trim(),
        username: inputGuruUser.trim(),
        password: inputGuruPass || "Password123",
        mapelIds: syncedMapelIds,
        mapelKelas: cleanMapelKelas,
      };
      items.push(item);
      feedbackMsg = `Guru baru ${item.nama} berhasil didaftarkan & tersimpan realtime!`;
    }
    setDB.guru(items);
    setInputGuruNama("");
    setInputGuruNip("");
    setInputGuruUser("");
    setInputGuruPass("");
    setInputGuruMapelKelas([]);
    setActivePlotMapelId("");
    if (feedbackMsg) showToast(feedbackMsg);
  };

  const handleEditGuruClick = (g: Guru) => {
    setEditingGuruId(g.id);
    setInputGuruNama(g.nama);
    setInputGuruNip(g.nip);
    setInputGuruUser(g.username);
    setInputGuruPass(g.password || "Password123");
    if (g.mapelKelas && g.mapelKelas.length > 0) {
      const cloned = g.mapelKelas.map((mk) => ({
        mapelId: mk.mapelId,
        kelasIds: [...(mk.kelasIds || [])],
      }));
      setInputGuruMapelKelas(cloned);
      setActivePlotMapelId(cloned[0]?.mapelId || "");
    } else {
      const cloned = (g.mapelIds || []).map((id) => ({
        mapelId: id,
        kelasIds: [],
      }));
      setInputGuruMapelKelas(cloned);
      setActivePlotMapelId(cloned[0]?.mapelId || "");
    }
    window.setTimeout(() => {
      document.getElementById("form-edit-guru")?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 60);
  };

  const handleCancelEditGuru = () => {
    setEditingGuruId(null);
    setInputGuruNama("");
    setInputGuruNip("");
    setInputGuruUser("");
    setInputGuruPass("");
    setInputGuruMapelKelas([]);
    setActivePlotMapelId("");
  };

  const handleDeleteGuru = (id: string) => {
    triggerConfirm(
      "Hapus Data Guru",
      "Apakah Anda yakin ingin menghapus dewan guru ini secara permanen dari pangkalan data?",
      async () => {
        const ok = await setDB.deleteGuru(id);
        showToast(ok ? "Data guru berhasil dihapus permanen di server." : "Gagal menghapus di server Firestore (cek status kuota/koneksi).", ok ? "success" : "error");
      }
    );
  };

  // Pengawas States
  const [inputPengawasNama, setInputPengawasNama] = useState("");
  const [inputPengawasNip, setInputPengawasNip] = useState("");
  const [inputPengawasUser, setInputPengawasUser] = useState("");
  const [inputPengawasPass, setInputPengawasPass] = useState("");
  const [editingPengawasId, setEditingPengawasId] = useState<string | null>(null);

  const handleAddPengawas = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputPengawasNama.trim() || !inputPengawasNip.trim() || !inputPengawasUser.trim()) {
      showToast("Silakan lengkapi Data dewan Pengawas (Nama, NIP, dan Username)!", "error");
      return;
    }
    const items = [...getDB.pengawas()];
    let feedbackMsg = "";
    if (editingPengawasId) {
      // Editing Mode
      const index = items.findIndex((p) => p.id === editingPengawasId);
      if (index !== -1) {
        items[index] = {
          ...items[index],
          nama: inputPengawasNama.trim(),
          nip: inputPengawasNip.trim(),
          username: inputPengawasUser.trim(),
          password: inputPengawasPass || "Password123",
        };
        feedbackMsg = `Data pengawas ${inputPengawasNama.trim()} berhasil diperbarui & tersimpan realtime!`;
      }
      setEditingPengawasId(null);
    } else {
      // Adding Mode
      if (items.some((p) => p.nip === inputPengawasNip.trim())) {
        showToast("Pengawas dengan NIP tersebut sudah terdaftar!", "error");
        return;
      }
      const item: Pengawas = {
        id: "pengawas_" + Date.now(),
        nama: inputPengawasNama.trim(),
        nip: inputPengawasNip.trim(),
        username: inputPengawasUser.trim(),
        password: inputPengawasPass || "Password123",
      };
      items.push(item);
      feedbackMsg = `Pengawas baru ${item.nama} berhasil didaftarkan & tersimpan realtime!`;
    }
    setDB.pengawas(items);
    setInputPengawasNama("");
    setInputPengawasNip("");
    setInputPengawasUser("");
    setInputPengawasPass("");
    if (feedbackMsg) showToast(feedbackMsg);
  };

  const handleEditPengawasClick = (p: any) => {
    setEditingPengawasId(p.id);
    setInputPengawasNama(p.nama);
    setInputPengawasNip(p.nip);
    setInputPengawasUser(p.username);
    setInputPengawasPass(p.password || "Password123");
    window.setTimeout(() => {
      document.getElementById("form-edit-pengawas")?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 60);
  };

  const handleCancelEditPengawas = () => {
    setEditingPengawasId(null);
    setInputPengawasNama("");
    setInputPengawasNip("");
    setInputPengawasUser("");
    setInputPengawasPass("");
  };

  const handleDeletePengawas = (id: string) => {
    triggerConfirm(
      "Hapus Data Pengawas",
      "Apakah Anda yakin ingin menghapus dewan pengawas ini secara permanen beserta seluruh plotting jadwal jaganya?",
      async () => {
        const ok = await setDB.deletePengawas(id);
        showToast(ok ? "Data pengawas berhasil dihapus permanen di server." : "Gagal menghapus di server Firestore (cek status kuota/koneksi).", ok ? "success" : "error");
      }
    );
  };

  const handleDeleteAllSiswa = () => {
    triggerConfirm(
      "Hapus Seluruh Siswa (Sapu Bersih)",
      "PERINGATAN BERSAMA: Apakah Anda yakin ingin menghapus SELURUH data siswa dari pangkalan data? Tindakan ini tidak dapat dibatalkan.",
      async () => {
        const ok = await setDB.deleteAllSiswa();
        showToast(ok ? "Seluruh data siswa berhasil dihapus permanen." : "Gagal menghapus di server Firestore (cek status kuota/koneksi).", ok ? "success" : "error");
      }
    );
  };

  const handleDeleteAllGuru = () => {
    triggerConfirm(
      "Hapus Seluruh Guru (Sapu Bersih)",
      "PERINGATAN BERSAMA: Apakah Anda yakin ingin menghapus SELURUH data dewan guru dari pangkalan data? Tindakan ini tidak dapat dibatalkan.",
      async () => {
        const ok = await setDB.deleteAllGuru();
        showToast(ok ? "Seluruh data guru berhasil dihapus permanen." : "Gagal menghapus di server Firestore (cek status kuota/koneksi).", ok ? "success" : "error");
      }
    );
  };

  const handleDeleteAllPengawas = () => {
    triggerConfirm(
      "Hapus Seluruh Pengawas & Jadwal (Sapu Bersih)",
      "PERINGATAN BERSAMA: Apakah Anda yakin ingin menghapus SELURUH data pengawas beserta jadwal jaganya? Tindakan ini tidak dapat dibatalkan.",
      async () => {
        const ok = await setDB.deleteAllPengawas();
        showToast(ok ? "Seluruh data pengawas & jadwal berhasil dihapus permanen." : "Gagal menghapus di server Firestore (cek status kuota/koneksi).", ok ? "success" : "error");
      }
    );
  };

  // Jadwal Ngawas States
  const [inputNgawasPengawasId, setInputNgawasPengawasId] = useState("");
  const [inputNgawasMapelId, setInputNgawasMapelId] = useState("");
  const [inputNgawasRuangId, setInputNgawasRuangId] = useState("");
  const [inputNgawasSesi, setInputNgawasSesi] = useState("Sesi I (07:30 - 09:30)");
  const [inputNgawasTanggal, setInputNgawasTanggal] = useState("2026-06-08");
  const [editingNgawasId, setEditingNgawasId] = useState<string | null>(null);

  const handleAddJadwalNgawas = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputNgawasPengawasId || !inputNgawasMapelId || !inputNgawasRuangId || !inputNgawasTanggal) {
      showToast("Silakan lengkapi plotting Jadwal Ngawas Pengawas!", "error");
      return;
    }
    const items = [...getDB.jadwalNgawas()];
    let feedbackMsg = "";
    if (editingNgawasId) {
      // Edit Mode
      const index = items.findIndex((jn) => jn.id === editingNgawasId);
      if (index !== -1) {
        items[index] = {
          ...items[index],
          pengawasId: inputNgawasPengawasId,
          mapelId: inputNgawasMapelId,
          ruangId: inputNgawasRuangId,
          sesi: inputNgawasSesi,
          tanggal: inputNgawasTanggal,
        };
        feedbackMsg = "Plotting Jadwal Ngawas berhasil diperbarui & tersimpan realtime!";
      }
      setEditingNgawasId(null);
    } else {
      // Add Mode
      const item: JadwalNgawas = {
        id: "jn_" + Date.now(),
        pengawasId: inputNgawasPengawasId,
        mapelId: inputNgawasMapelId,
        ruangId: inputNgawasRuangId,
        sesi: inputNgawasSesi,
        tanggal: inputNgawasTanggal,
      };
      items.push(item);
      feedbackMsg = "Plotting Jadwal Ngawas baru berhasil disimpan realtime!";
    }
    setDB.jadwalNgawas(items);
    setInputNgawasPengawasId("");
    setInputNgawasMapelId("");
    setInputNgawasRuangId("");
    if (feedbackMsg) showToast(feedbackMsg);
  };

  const handleEditJadwalNgawasClick = (jn: any) => {
    setEditingNgawasId(jn.id);
    setInputNgawasPengawasId(jn.pengawasId);
    setInputNgawasMapelId(jn.mapelId);
    setInputNgawasRuangId(jn.ruangId);
    setInputNgawasSesi(jn.sesi);
    setInputNgawasTanggal(jn.tanggal);
    window.setTimeout(() => {
      document.getElementById("form-edit-jadwal-ngawas")?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 60);
  };

  const handleCancelEditJadwalNgawas = () => {
    setEditingNgawasId(null);
    setInputNgawasPengawasId("");
    setInputNgawasMapelId("");
    setInputNgawasRuangId("");
  };

  const handleDeleteJadwalNgawas = (id: string) => {
    triggerConfirm(
      "Hapus Jadwal Jaga",
      "Apakah Anda yakin ingin menghapus plot jadwal jaga pengawas ini?",
      async () => {
        const ok = await setDB.deleteJadwalNgawas(id);
        showToast(ok ? "Jadwal jaga pengawas berhasil dihapus permanen di server." : "Gagal menghapus jadwal pengawas di server Firestore (cek kuota/koneksi).", ok ? "success" : "error");
      }
    );
  };

  // Question States
  const [inputSoalTeks, setInputSoalTeks] = useState("");
  const [inputSoalMapel, setInputSoalMapel] = useState("");
  const [inputSoalKunci, setInputSoalKunci] = useState<OpsiKey>("A");
  const [inputSoalImg, setInputSoalImg] = useState("");
  const [inputSoalAudioName, setInputSoalAudioName] = useState("");
  const [inputSoalOpsi, setInputSoalOpsi] = useState({
    A: "",
    B: "",
    C: "",
    D: "",
    E: "",
  });
  const [inputSoalOpsiGambar, setInputSoalOpsiGambar] = useState<Partial<Record<OpsiKey, string>>>({});

  // Admin Bank Soal Filter States
  const [bsoalSearch, setBsoalSearch] = useState("");
  const [bsoalFilterMapel, setBsoalFilterMapel] = useState("");
  const [bsoalFilterGuru, setBsoalFilterGuru] = useState("");
  const [bsoalFilterKelas, setBsoalFilterKelas] = useState("");
  const [expandedGroupKey, setExpandedGroupKey] = useState<string | null>(null);

  // Admin Add & Upload Soal Modal States
  const [showAddSoalModal, setShowAddSoalModal] = useState(false);
  const [addSoalTab, setAddSoalTab] = useState<"mass" | "manual" | "json">("mass");
  const [massSoalText, setMassSoalText] = useState("");
  const [inputSoalKelasIds, setInputSoalKelasIds] = useState<string[]>([]);
  const [isParsingDocx, setIsParsingDocx] = useState(false);
  const [showMassPreviewModal, setShowMassPreviewModal] = useState(false);

  const massParsePreview = React.useMemo(() => {
    if (!massSoalText.trim()) return { questions: [], skipped: [] };
    return parseMassSoalText(massSoalText);
  }, [massSoalText]);

  // Edit Soal Modal States
  const [editingSoal, setEditingSoal] = useState<Soal | null>(null);
  const [editSoalTeks, setEditSoalTeks] = useState("");
  const [editSoalMapel, setEditSoalMapel] = useState("");
  const [editSoalKunci, setEditSoalKunci] = useState<OpsiKey>("A");
  const [editSoalImg, setEditSoalImg] = useState("");
  const [editSoalOpsi, setEditSoalOpsi] = useState({
    A: "",
    B: "",
    C: "",
    D: "",
    E: "",
  });
  const [editSoalOpsiGambar, setEditSoalOpsiGambar] = useState<Partial<Record<OpsiKey, string>>>({});
  const [editSoalKelasIds, setEditSoalKelasIds] = useState<string[]>([]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>, setImgUrl: (url: string) => void) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    try {
      if (file.size > 5 * 1024 * 1024) {
        showToast("Ukuran file gambar terlalu besar (maks 5MB).", "error");
        return;
      }
      const compressed = await compressImageFile(file);
      setImgUrl(compressed);
    } catch {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (reader.result && typeof reader.result === "string") {
          setImgUrl(reader.result);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAdminDocxFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    setIsParsingDocx(true);
    try {
      const res = await parseDocxSoalFile(file);
      if (!res.rawExtractedText.trim()) {
        showToast("File Word kosong atau tidak mengandung teks/soal yang terbaca.", "error");
        return;
      }
      setMassSoalText((prev) => (prev.trim() ? `${prev.trim()}\n\n${res.rawExtractedText}` : res.rawExtractedText));
      const eqCount = (res.rawExtractedText.match(/\$[^$\n]+\$/g) || []).length;
      showToast(
        `Berhasil membaca "${file.name}": ${res.parsed.questions.length} soal terdeteksi${res.extractedImageCount > 0 ? `, ${res.extractedImageCount} gambar diekstrak` : ""}${eqCount > 0 ? `, ${eqCount} rumus dikonversi` : ""}.`
      );
    } catch (err: any) {
      showToast(err?.message || "Gagal membaca file Word (.docx).", "error");
    } finally {
      setIsParsingDocx(false);
    }
  };

  const handleBulkDeleteAdminGroup = (mapelId: string, kelasId: string, mapelNama: string, kelasNama: string) => {
    const count = getDB.soal().filter((s) => {
      const matchesMapel = s.mapelId === mapelId;
      const matchesKelas = kelasId === "umum"
        ? (!s.kelasIds || s.kelasIds.length === 0)
        : (s.kelasIds && s.kelasIds.includes(kelasId));
      return matchesMapel && matchesKelas;
    }).length;
    triggerConfirm(
      "Hapus Semua Soal Kelompok",
      `Apakah Anda yakin ingin menghapus SELURUH (${count} butir) soal untuk Mata Pelajaran "${mapelNama}" dengan Sasaran "${kelasNama}"? Tindakan ini tidak dapat dibatalkan!`,
      () => {
        const remaining = getDB.soal().filter((s) => {
          const matchesMapel = s.mapelId === mapelId;
          const matchesKelas = kelasId === "umum"
            ? (!s.kelasIds || s.kelasIds.length === 0)
            : (s.kelasIds && s.kelasIds.includes(kelasId));
          return !(matchesMapel && matchesKelas);
        });
        setDB.soal(remaining);
        setExpandedGroupKey(null);
        showToast(`Berhasil menghapus seluruh soal Mata Pelajaran "${mapelNama}" (${kelasNama})!`);
      }
    );
  };

  // Function to prefill edit fields and open edit modal
  const startEditSoal = (s: Soal) => {
    setEditingSoal(s);
    setEditSoalTeks(s.teks);
    setEditSoalMapel(s.mapelId);
    setEditSoalKunci(s.kunci);
    setEditSoalImg(s.gambarUrl || "");
    setEditSoalOpsi({
      A: s.opsi.A || "",
      B: s.opsi.B || "",
      C: s.opsi.C || "",
      D: s.opsi.D || "",
      E: s.opsi.E || "",
    });
    setEditSoalOpsiGambar({ ...(s.opsiGambar || {}) });
    setEditSoalKelasIds(s.kelasIds || []);
  };

  const handleUpdateSoal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSoal) return;
    const hasA = Boolean(editSoalOpsi.A.trim() || editSoalOpsiGambar.A);
    const hasB = Boolean(editSoalOpsi.B.trim() || editSoalOpsiGambar.B);
    if (!editSoalTeks.trim() || !editSoalMapel || !hasA || !hasB) {
      showToast("Mohon isi teks soal, mapel, dan minimal opsi A & B (teks atau gambar).", "error");
      return;
    }

    const cleanOpsiGambar: Partial<Record<OpsiKey, string>> = {};
    (["A", "B", "C", "D", "E"] as const).forEach((k) => {
      if (editSoalOpsiGambar[k]) cleanOpsiGambar[k] = editSoalOpsiGambar[k];
    });

    const updated = getDB.soal().map((s) => {
      if (s.id === editingSoal.id) {
        return {
          ...s,
          teks: editSoalTeks.trim(),
          mapelId: editSoalMapel,
          kunci: editSoalKunci,
          gambarUrl: editSoalImg || undefined,
          opsi: { ...editSoalOpsi },
          opsiGambar: Object.keys(cleanOpsiGambar).length > 0 ? cleanOpsiGambar : undefined,
          kelasIds: editSoalKelasIds,
        };
      }
      return s;
    });

    setDB.soal(updated);
    setEditingSoal(null);
    showToast("Soal berhasil diperbarui & tersimpan realtime!");
  };

  const handleAddSoal = (e: React.FormEvent) => {
    e.preventDefault();
    const hasA = Boolean(inputSoalOpsi.A.trim() || inputSoalOpsiGambar.A);
    const hasB = Boolean(inputSoalOpsi.B.trim() || inputSoalOpsiGambar.B);
    if (!inputSoalTeks.trim() || !inputSoalMapel || !hasA || !hasB) {
      showToast("Mohon isi teks soal, mapel, dan minimal opsi A & B (teks atau gambar).", "error");
      return;
    }
    const cleanOpsiGambar: Partial<Record<OpsiKey, string>> = {};
    (["A", "B", "C", "D", "E"] as const).forEach((k) => {
      if (inputSoalOpsiGambar[k]) cleanOpsiGambar[k] = inputSoalOpsiGambar[k];
    });

    const items = [...getDB.soal()];
    const item: Soal = {
      id: "soal_" + Date.now(),
      mapelId: inputSoalMapel,
      teks: inputSoalTeks.trim(),
      opsi: { ...inputSoalOpsi },
      kunci: inputSoalKunci,
      kelasIds: inputSoalKelasIds || [],
    };
    if (inputSoalImg && inputSoalImg.trim()) {
      item.gambarUrl = inputSoalImg.trim();
    }
    if (Object.keys(cleanOpsiGambar).length > 0) {
      item.opsiGambar = cleanOpsiGambar;
    }
    if (inputSoalAudioName && inputSoalAudioName.trim()) {
      item.audioName = inputSoalAudioName.trim();
    }
    items.push(item);
    setDB.soal(items);

    setInputSoalTeks("");
    setInputSoalKunci("A");
    setInputSoalImg("");
    setInputSoalAudioName("");
    setInputSoalOpsi({ A: "", B: "", C: "", D: "", E: "" });
    setInputSoalOpsiGambar({});
    setInputSoalKelasIds([]);
    setShowAddSoalModal(false);
    showToast("Soal berhasil disimpan ke bank soal!");
  };

  const handleAdminMassSoal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!massSoalText.trim()) {
      showToast("Silakan tempel teks naskah soal atau unggah file Word terlebih dahulu!", "error");
      return;
    }
    if (!inputSoalMapel) {
      showToast("Silakan pilih Mata Pelajaran target terlebih dahulu!", "error");
      return;
    }

    try {
      const result = parseMassSoalText(massSoalText);
      if (result.questions.length === 0) {
        showToast("Belum ada soal yang valid terdeteksi. Pastikan setiap butir punya pertanyaan dan minimal opsi A & B (Latin atau Arab أ ب).", "error");
        return;
      }

      const parsedSoals = buildSoalObjectsFromParsed(result.questions, {
        mapelId: inputSoalMapel,
        kelasIds: [...(inputSoalKelasIds || [])],
        idPrefix: "soal_admin",
      });

      const updated = [...getDB.soal(), ...parsedSoals];
      setDB.soal(updated);
      setMassSoalText("");
      setInputSoalKelasIds([]);
      setShowMassPreviewModal(false);
      setShowAddSoalModal(false);

      const skippedMsg = result.skipped.length > 0 ? ` (${result.skipped.length} blok dilewati karena tidak lengkap)` : "";
      showToast(`Berhasil mengimpor ${parsedSoals.length} butir soal ke Bank Soal & tersimpan realtime!${skippedMsg}`);
    } catch (err) {
      showToast("Terjadi kegagalan parsing naskah: " + String(err), "error");
    }
  };

  const handleExportSoalJSON = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(getDB.soal(), null, 2));
    const downloadAnchor = document.createElement("a");
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `bank_soal_almasum_${getLocalDateStr()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const handleImportSoalJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const currentSoal = getDB.soal();
          const existingIds = new Set(currentSoal.map((s) => s.id));
          const consolidated = [...currentSoal];
          let added = 0;
          parsed.forEach((q: any) => {
            if (q.teks && q.mapelId && q.opsi) {
              const id = q.id && !existingIds.has(q.id) ? q.id : "soal_import_" + Date.now() + "_" + Math.random().toString(36).substr(2, 5);
              consolidated.push({ ...q, id });
              added++;
            }
          });
          setDB.soal(consolidated);
          showToast(`Sukses memulihkan/mengimpor ${added} butir soal dari berkas JSON!`);
        } else {
          showToast("Format JSON tidak valid atau berkas kosong.", "error");
        }
      } catch (err) {
        showToast("Gagal membaca berkas JSON: " + String(err), "error");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const handleBatchImportSoal = () => {
    const batchQuestions: Soal[] = [
      {
        id: "batch_q_1",
        mapelId: "m3",
        teks: "Sebuah mobil mainan bermassa 2 kg ditarik dengan gaya horizontal sebesar 10 Newton. Jika lantai licin tanpa gesekan, hitung percepatan mobil tersebut!",
        opsi: {
          A: "5 m/s²",
          B: "2 m/s²",
          C: "20 m/s²",
          D: "8 m/s²",
          E: "15 m/s²",
        },
        kunci: "A",
      },
      {
        id: "batch_q_2",
        mapelId: "m3",
        teks: "Menurut hukum termodinamika pertama, perubahan energi dalam suatu sistem tertutup sama dengan...",
        opsi: {
          A: "Kalor yang masuk dikurangi usaha yang dilakukan sistem",
          B: "Kalor yang keluar ditambah usaha sistem",
          C: "Usaha bersih dibagi efisiensi mesin carnot",
          D: "Kalor konveksi radiasi solar",
          E: "Nol mutlak Kelvin",
        },
        kunci: "A",
      },
    ];

    const consolidated = [...getDB.soal()];
    batchQuestions.forEach((q) => {
      if (!consolidated.some((s) => s.teks === q.teks)) {
        consolidated.push(q);
      }
    });
    setDB.soal(consolidated);
    showToast("Batch soal contoh Fisika berhasil ditambahkan.");
  };

  const handleDeleteSoal = (id: string) => {
    setDB.deleteSoal(id);
  };

  // Exam Schedule States
  const getLocalDateStr = () => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const r = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${r}`;
  };

  const [schedMapel, setSchedMapel] = useState("");
  const [schedKelas, setSchedKelas] = useState<string[]>([]);
  const [schedGuruIds, setSchedGuruIds] = useState<string[]>([]);
  const [schedTanggal, setSchedTanggal] = useState(getLocalDateStr());
  const [schedMulai, setSchedMulai] = useState("07:30");
  const [schedSelesai, setSchedSelesai] = useState("23:59");
  const [schedAllDay, setSchedAllDay] = useState(true);
  const [schedDurasi, setSchedDurasi] = useState("90");
  const [schedAcak, setSchedAcak] = useState(true);

  const handleCreateJadwal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!schedMapel || schedKelas.length === 0) {
      showToast("Pilih mata pelajaran dan minimal satu kelas target!", "error");
      return;
    }

    const finalJamMulai = schedAllDay ? "00:00" : (schedMulai || "07:30");
    const finalJamSelesai = schedAllDay ? "23:59" : (schedSelesai || "23:59");
    const durationMins = Number(schedDurasi) || 90;

    const items = [...getDB.jadwal()];
    let feedbackMsg = "";

    if (editingJadwalId) {
      const index = items.findIndex((j) => j.id === editingJadwalId);
      if (index !== -1) {
        items[index] = {
          ...items[index],
          mapelId: schedMapel,
          kelasIds: schedKelas,
          tanggal: schedTanggal,
          jamMulai: finalJamMulai,
          jamSelesai: finalJamSelesai,
          acakSoal: schedAcak,
          durasiMenit: durationMins,
          guruIds: schedGuruIds.length > 0 ? [...schedGuruIds] : [],
        };
        feedbackMsg = "Jadwal Ujian berhasil diperbarui & tersimpan realtime!";
      }
      setEditingJadwalId(null);
    } else {
      const item: JadwalUjian = {
        id: "jadwal_" + Date.now(),
        mapelId: schedMapel,
        kelasIds: schedKelas,
        tanggal: schedTanggal,
        jamMulai: finalJamMulai,
        jamSelesai: finalJamSelesai,
        acakSoal: schedAcak,
        durasiMenit: durationMins,
        guruIds: schedGuruIds.length > 0 ? [...schedGuruIds] : [],
      };
      items.push(item);
      feedbackMsg = "Jadwal Ujian Baru berhasil dirilis & tersimpan realtime!";
    }

    setDB.jadwal(items);

    // Reset fields
    setSchedKelas([]);
    setSchedGuruIds([]);
    setSchedMapel("");
    setSchedTanggal(getLocalDateStr());
    setSchedMulai("07:30");
    setSchedSelesai("23:59");
    setSchedAllDay(true);
    setSchedDurasi("90");
    setSchedAcak(true);
    if (feedbackMsg) showToast(feedbackMsg);
  };

  const handleEditJadwalClick = (j: JadwalUjian) => {
    setEditingJadwalId(j.id);
    setSchedMapel(j.mapelId);
    setSchedKelas(j.kelasIds);
    setSchedGuruIds(j.guruIds || []);
    setSchedTanggal(j.tanggal);
    const isAllDay = j.jamMulai === "00:00" && j.jamSelesai === "23:59";
    setSchedAllDay(isAllDay);
    setSchedMulai(j.jamMulai || "07:30");
    setSchedSelesai(j.jamSelesai || "23:59");
    setSchedDurasi(j.durasiMenit.toString());
    setSchedAcak(j.acakSoal);
    window.setTimeout(() => {
      document.getElementById("form-edit-jadwal")?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 60);
  };

  const handleCancelEditJadwal = () => {
    setEditingJadwalId(null);
    setSchedKelas([]);
    setSchedGuruIds([]);
    setSchedMapel("");
    setSchedTanggal(getLocalDateStr());
    setSchedMulai("07:30");
    setSchedSelesai("23:59");
    setSchedAllDay(true);
    setSchedDurasi("90");
    setSchedAcak(true);
  };

  const handleDeleteJadwal = (id: string) => {
    triggerConfirm(
      "Hapus Jadwal Ujian",
      "Apakah Anda yakin ingin menghapus jadwal ujian ini?",
      async () => {
        const ok = await setDB.deleteJadwal(id);
        showToast(ok ? "Jadwal ujian berhasil dihapus permanen di server." : "Gagal menghapus jadwal ujian di server Firestore (cek kuota/koneksi).", ok ? "success" : "error");
      }
    );
  };

  // Admin Live Monitoring controls
  const handleClearSiswaViolations = (id: string) => {
    const list = [...getDB.sessions()];
    const index = list.findIndex((s) => s.id === id);
    if (index !== -1) {
      list[index] = {
        ...list[index],
        pelanggaranCount: 0,
        pelanggaranLogs: [],
        status: "Mengerjakan",
        lastUpdated: new Date().toISOString(),
      };
      setDB.sessions(list);
    }
  };

  const handleForceSubmitSession = (sesObjOrId: any) => {
    const targetObj =
      typeof sesObjOrId === "string"
        ? getDB.sessions().find((s: any) => s.id === sesObjOrId)
        : sesObjOrId;
    if (!targetObj) return;

    triggerConfirm(
      "Submit Paksa Ujian Siswa",
      `Apakah Anda yakin ingin melakukan Submit Paksa untuk "${targetObj.siswaNama}"? Ujian siswa akan langsung berakhir (${targetObj.jawabanTerisi || 0}/${targetObj.totalSoal || 0} terjawab) dan nilainya otomatis terekap.`,
      () => {
        executeForceSubmitSession(targetObj);
      },
      true
    );
  };

  const handleResetSession = (sesObjOrId: any) => {
    const targetObj =
      typeof sesObjOrId === "string"
        ? getDB.sessions().find((s: any) => s.id === sesObjOrId) || { id: sesObjOrId }
        : sesObjOrId;
    if (!targetObj) return;

    triggerConfirm(
      "Reset Sesi & Ulangi Dari Awal",
      `Apakah Anda yakin ingin mereset sesi "${targetObj.siswaNama || targetObj.id}"? Seluruh progres jawaban, pelanggaran, dan nilai sesi ini akan dihapus sehingga siswa langsung mengulang ujian dari awal.`,
      async () => {
        await executeResetStudentSession(targetObj);
      },
      true
    );
  };

  // Excel Download (.xlsx) with active Mapel / Kelas / Angkatan filters
  const handleDownloadExcel = () => {
    const filteredHasil = getFilteredAdminHasil();
    if (filteredHasil.length === 0) {
      showToast("Tidak ada data nilai atau hasil ujian siswa yang sesuai filter untuk di-export.", "error");
      return;
    }

    const rows = filteredHasil.map((h: any, index: number) => {
      const matchSiswa = dbState.siswa?.find(
        (s) => s.id === h.siswaId || s.nama.toLowerCase() === (h.siswaNama || "").toLowerCase()
      );
      const kelulusan = h.nilai >= 75 ? "LULUS" : "REMIDI";
      return {
        "No": index + 1,
        "No. Peserta": matchSiswa?.noPeserta || "-",
        "NISN": matchSiswa?.nisn || h.siswaNisn || "-",
        "Nama Siswa": h.siswaNama,
        "Kelas": h.siswaKelas,
        "Mata Pelajaran": h.mapelNama,
        "Benar": h.benar ?? 0,
        "Salah": h.salah ?? 0,
        "Skor Akhir": h.nilai,
        "Status Kelulusan": kelulusan,
        "Waktu Selesai": h.waktuSelesai || h.tanggalSelesai || new Date().toLocaleString("id-ID"),
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(rows);

    worksheet["!cols"] = [
      { wch: 6 },
      { wch: 18 },
      { wch: 16 },
      { wch: 28 },
      { wch: 14 },
      { wch: 26 },
      { wch: 10 },
      { wch: 10 },
      { wch: 14 },
      { wch: 18 },
      { wch: 22 },
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Rekap Nilai Siswa");

    const mapelObj = nilaiFilterMapel ? dbState.mapel.find((m) => m.id === nilaiFilterMapel) : null;
    const mapelSlug = mapelObj ? `_${mapelObj.nama.replace(/[^a-zA-Z0-9]/g, "_")}` : "";
    const kelasSlug = nilaiFilterKelas
      ? `_${nilaiFilterKelas.replace("grade:", "Angkatan_").replace(/[^a-zA-Z0-9_]/g, "_")}`
      : "";
    const todayStr = new Date().toISOString().split("T")[0];
    XLSX.writeFile(workbook, `Rekap_Nilai_CBT_MTs-ALMASUM2-CMC${mapelSlug}${kelasSlug}_${todayStr}.xlsx`);
  };

  // Delete individual exam result
  const handleDeleteSingleHasil = (id: string) => {
    triggerConfirm(
      "Hapus Hasil Ujian",
      "Apakah Anda yakin ingin menghapus 1 data hasil ujian ini secara permanen?",
      () => {
        setDB.deleteHasil(id, getDB.hasil());
        setSelectedHasilIds(selectedHasilIds.filter((selId) => selId !== id));
        showToast("Data hasil ujian dihapus.");
      }
    );
  };

  // Delete selected exam results
  const handleDeleteSelectedHasil = () => {
    if (selectedHasilIds.length === 0) {
      showToast("Pilih data hasil ujian terlebih dahulu melalui checkbox.", "error");
      return;
    }
    triggerConfirm(
      "Hapus Hasil Terpilih",
      `Apakah Anda yakin ingin menghapus ${selectedHasilIds.length} data hasil ujian terpilih ini secara masal?`,
      () => {
        setDB.deleteSelectedHasil(selectedHasilIds, getDB.hasil());
        setSelectedHasilIds([]);
        showToast("Hasil ujian terpilih berhasil dihapus.");
      }
    );
  };

  // Mass purge all exam results
  const handleDeleteAllHasil = () => {
    triggerConfirm(
      "Sapu Bersih Semua Hasil",
      "⚠️ PERINGATAN KRITIS: Apakah Anda yakin ingin MENGHAPUS SELURUH data hasil ujian di server? Sesi siswa yang bersangkutan juga akan ikut dihapus. Tindakan ini permanen.",
      () => {
        setDB.deleteAllHasil();
        setSelectedHasilIds([]);
        showToast("Seluruh data hasil ujian berhasil dibersihkan.");
      }
    );
  };

  // Configuration modifiers
  const [configNama, setConfigNama] = useState(dbState.konfig.namaSekolah);
  const [configAlamat, setConfigAlamat] = useState(dbState.konfig.alamatSekolah);
  const [configKepsek, setConfigKepsek] = useState(dbState.konfig.namaKepsek);
  const [configNip, setConfigNip] = useState(dbState.konfig.nipKepsek);
  const [configLimit, setConfigLimit] = useState(dbState.konfig.batasPelanggaran);
  const [configTz, setConfigTz] = useState(dbState.konfig.zonaWaktu);

  const [simLogoKiri, setSimLogoKiri] = useState(dbState.konfig.logoKiriUrl);
  const [simLogoKanan, setSimLogoKanan] = useState(dbState.konfig.logoKananUrl);
  const [simStempel, setSimStempel] = useState(dbState.konfig.stempelSekolahUrl || "https://images.unsplash.com/photo-1578301978693-85fa9c0320b9?w=120&auto=format&fit=crop&q=80");
  const [simTtd, setSimTtd] = useState(dbState.konfig.ttdKepsekUrl || "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=120&auto=format&fit=crop&q=80");

  useEffect(() => {
    if (activeMenu === "config") {
      setConfigNama(dbState.konfig.namaSekolah);
      setConfigAlamat(dbState.konfig.alamatSekolah);
      setConfigKepsek(dbState.konfig.namaKepsek);
      setConfigNip(dbState.konfig.nipKepsek);
      setConfigLimit(dbState.konfig.batasPelanggaran);
      setConfigTz(dbState.konfig.zonaWaktu);
      setSimLogoKiri(dbState.konfig.logoKiriUrl);
      setSimLogoKanan(dbState.konfig.logoKananUrl);
      if (dbState.konfig.stempelSekolahUrl) setSimStempel(dbState.konfig.stempelSekolahUrl);
      if (dbState.konfig.ttdKepsekUrl) setSimTtd(dbState.konfig.ttdKepsekUrl);
    }
  }, [activeMenu]);

  const handleSaveKonfig = (e: React.FormEvent) => {
    e.preventDefault();
    const currentKonfig = getDB.konfig();
    const updated: KonfigurasiSekolah = {
      namaSekolah: configNama,
      alamatSekolah: configAlamat,
      kodeRegistrasi: currentKonfig.kodeRegistrasi,
      logoKiriUrl: simLogoKiri,
      logoKananUrl: simLogoKanan,
      bgUrl: currentKonfig.bgUrl,
      ttdKepsekUrl: simTtd,
      stempelSekolahUrl: simStempel,
      namaKepsek: configKepsek,
      nipKepsek: configNip,
      zonaWaktu: configTz,
      batasPelanggaran: Number(configLimit) || 3,
    };
    setDB.konfig(updated);
    showToast("Konfigurasi sekolah & Aturan CBT berhasil diperbarui secara global!");
  };

  const getGuruGradeLevel = (nama: string): "VII" | "VIII" | "IX" | "Lainnya" => {
    const upper = nama.toUpperCase();
    if (/\bIX\b/.test(upper) || /\b9\b/.test(upper) || /\b9[A-Z]\b/.test(upper)) return "IX";
    if (/\bVIII\b/.test(upper) || /\b8\b/.test(upper) || /\b8[A-Z]\b/.test(upper)) return "VIII";
    if (/\bVII\b/.test(upper) || /\b7\b/.test(upper) || /\b7[A-Z]\b/.test(upper)) return "VII";
    return "Lainnya";
  };

  const toggleTeacherMapel = (mapelId: string) => {
    if (inputGuruMapelKelas.some((mk) => mk.mapelId === mapelId)) {
      const next = inputGuruMapelKelas.filter((mk) => mk.mapelId !== mapelId);
      setInputGuruMapelKelas(next);
      if (activePlotMapelId === mapelId) {
        setActivePlotMapelId(next[0]?.mapelId || "");
      }
    } else {
      setInputGuruMapelKelas([...inputGuruMapelKelas, { mapelId, kelasIds: [] }]);
      setActivePlotMapelId(mapelId);
    }
  };

  const selectOrAddTeacherMapel = (mapelId: string) => {
    if (!mapelId) {
      setActivePlotMapelId("");
      return;
    }
    if (!inputGuruMapelKelas.some((mk) => mk.mapelId === mapelId)) {
      setInputGuruMapelKelas((prev) => [...prev, { mapelId, kelasIds: [] }]);
    }
    setActivePlotMapelId(mapelId);
  };

  const toggleTeacherMapelKelas = (mapelId: string, kelasId: string) => {
    setInputGuruMapelKelas((prev) =>
      prev.map((mk) => {
        if (mk.mapelId !== mapelId) return mk;
        const exists = mk.kelasIds.includes(kelasId);
        return {
          ...mk,
          kelasIds: exists
            ? mk.kelasIds.filter((id) => id !== kelasId)
            : [...mk.kelasIds, kelasId],
        };
      })
    );
  };

  const applyTeacherMapelAngkatan = (
    mapelId: string,
    mode: "VII" | "VIII" | "IX" | "ALL" | "NONE"
  ) => {
    setInputGuruMapelKelas((prev) =>
      prev.map((mk) => {
        if (mk.mapelId !== mapelId) return mk;
        if (mode === "NONE") return { ...mk, kelasIds: [] };
        if (mode === "ALL") return { ...mk, kelasIds: dbState.kelasAkademik.map((ka) => ka.id) };
        const matchedIds = dbState.kelasAkademik
          .filter((ka) => getGuruGradeLevel(ka.nama) === mode)
          .map((ka) => ka.id);
        const allSelected = matchedIds.length > 0 && matchedIds.every((id) => mk.kelasIds.includes(id));
        return {
          ...mk,
          kelasIds: allSelected
            ? mk.kelasIds.filter((id) => !matchedIds.includes(id))
            : Array.from(new Set([...mk.kelasIds, ...matchedIds])),
        };
      })
    );
  };

  const openGuruPlottingModal = (guruTarget: Guru) => {
    const baseList: GuruAmpuan[] =
      guruTarget.id === "__FORM__"
        ? inputGuruMapelKelas.map((mk) => ({ mapelId: mk.mapelId, kelasIds: [...(mk.kelasIds || [])] }))
        : guruTarget.mapelKelas && guruTarget.mapelKelas.length > 0
        ? guruTarget.mapelKelas.map((mk) => ({ mapelId: mk.mapelId, kelasIds: [...(mk.kelasIds || [])] }))
        : (guruTarget.mapelIds || []).map((id) => ({ mapelId: id, kelasIds: [] }));
    setGuruPlotModalTarget(guruTarget);
    setModalPlotMapelKelas(baseList);
    setModalPlotSearchMapel("");
    setModalPlotActiveMapelId(baseList[0]?.mapelId || dbState.mapel[0]?.id || "");
  };

  const saveGuruPlottingModal = () => {
    if (!guruPlotModalTarget) return;
    const cleanList = modalPlotMapelKelas.map((mk) => ({
      mapelId: mk.mapelId,
      kelasIds: Array.from(new Set(mk.kelasIds || [])),
    }));
    if (guruPlotModalTarget.id === "__FORM__") {
      setInputGuruMapelKelas(cleanList);
      setActivePlotMapelId(cleanList[0]?.mapelId || "");
      setGuruPlotModalTarget(null);
      return;
    }
    const updatedGurus = getDB.guru().map((g) =>
      g.id === guruPlotModalTarget.id
        ? {
            ...g,
            mapelIds: cleanList.map((mk) => mk.mapelId),
            mapelKelas: cleanList,
          }
        : g
    );
    setDB.guru(updatedGurus);
    if (editingGuruId === guruPlotModalTarget.id) {
      setInputGuruMapelKelas(cleanList);
      setActivePlotMapelId(cleanList[0]?.mapelId || "");
    }
    const targetNama = guruPlotModalTarget.nama;
    setGuruPlotModalTarget(null);
    showToast(`Plotting mapel & kelas untuk ${targetNama} berhasil disimpan realtime!`);
  };

  // Mobile responsive nav drawer state
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  // Live monitor filter states
  const [monitorSelectedJadwalId, setMonitorSelectedJadwalId] = useState<string>("all");
  const [monitorSelectedStatus, setMonitorSelectedStatus] = useState<"all" | "mengerjakan" | "selesai" | "infraction">("all");
  const [monitorSelectedKelas, setMonitorSelectedKelas] = useState<string>("all");
  const [monitorSearchQuery, setMonitorSearchQuery] = useState<string>("");

  const menuItems = [
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { id: "master", label: "Data Master", icon: FolderOpen },
    { id: "kelas_akademik", label: "Manajemen Kelas", icon: Layers },
    { id: "users", label: "Manajemen User", icon: Users },
    { id: "bsoal", label: "Bank Soal", icon: BookOpen },
    { id: "jadwal", label: "Jadwal Ujian", icon: Calendar },
    { id: "pengawas", label: "Jadwal & Pengawas", icon: Shield },
    { id: "tokens", label: "Token Ujian", icon: Key },
    { id: "logmonitor", label: "Live Monitoring", icon: Activity },
    { id: "nilai", label: "Rekap Nilai", icon: Award },
    { id: "cetak", label: "Cetak Kartu & Berita", icon: Printer },
    { id: "config", label: "Konfigurasi Sekolah", icon: Settings },
    { id: "lisensi", label: "Info Lisensi", icon: ShieldCheck },
  ];

  // Compile unified live monitoring data: combines active sessions + completed results so finished students never disappear!
  const unifiedMonitorList = React.useMemo(() => {
    const sessionMap = new Map<string, any>();

    // 1. Process active and recorded sessions
    dbState.sessions.forEach((ses) => {
      const matchHasil = dbState.hasil.find(
        (h) =>
          (h.siswaNisn === ses.id || (h.siswaNama || "").toLowerCase() === (ses.siswaNama || "").toLowerCase()) &&
          (!h.mapelNama || !ses.mapelNama || h.mapelNama.toLowerCase() === ses.mapelNama.toLowerCase())
      );
      sessionMap.set(ses.id, {
        ...ses,
        hasilDocId: matchHasil?.id,
        nilai: matchHasil ? matchHasil.nilai : undefined,
        benar: matchHasil ? matchHasil.benar : undefined,
        salah: matchHasil ? matchHasil.salah : undefined,
        waktuSelesai: matchHasil ? matchHasil.tanggalSelesai : (ses.status === "Selesai" ? (ses.lastUpdated ? new Date(ses.lastUpdated).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }) : "Selesai") : undefined),
      });
    });

    // 2. Also inject students who completed (in dbState.hasil) but might not have an in-memory session
    dbState.hasil.forEach((h) => {
      const isAlreadyInMap = Array.from(sessionMap.values()).some(
        (s) =>
          (s.id === h.siswaNisn || (s.siswaNama || "").toLowerCase() === (h.siswaNama || "").toLowerCase()) &&
          (!h.mapelNama || !s.mapelNama || s.mapelNama.toLowerCase() === h.mapelNama.toLowerCase())
      );
      if (!isAlreadyInMap) {
        sessionMap.set(`h_${h.id}`, {
          id: h.siswaNisn || h.id,
          hasilDocId: h.id,
          siswaNama: h.siswaNama,
          siswaKelas: h.siswaKelas,
          mapelId: h.mapelId,
          mapelNama: h.mapelNama,
          status: "Selesai",
          deviceId: "Perangkat Siswa",
          pelanggaranCount: 0,
          pelanggaranLogs: [],
          jawabanTerisi: h.totalSoal,
          totalSoal: h.totalSoal,
          raguRagu: {},
          jawabanSiswa: {},
          lastUpdated: h.tanggalSelesai,
          nilai: h.nilai,
          benar: h.benar,
          salah: h.salah,
          waktuSelesai: h.tanggalSelesai,
        });
      }
    });

    return Array.from(sessionMap.values());
  }, [dbState.sessions, dbState.hasil]);

  return (
    <div className="flex flex-col lg:flex-row bg-white text-slate-800 min-h-[580px] h-full rounded-2xl overflow-hidden border border-slate-200 shadow-md text-left relative">
      {/* 1. MOBILE TOP NAVIGATION BAR (Visible only on < lg) */}
      <div className="lg:hidden w-full bg-slate-50 border-b border-slate-200 p-3 sm:p-4 flex items-center justify-between select-none shrink-0 z-30">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded bg-[#0666AE]/10 text-[#0666AE] border border-[#0666AE]/20">
            <Shield size={16} />
          </div>
          <div>
            <h2 className="text-[9px] font-bold text-slate-400 uppercase tracking-widest leading-none">ADMINISTRATOR</h2>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="text-xs font-black text-slate-800">
                {menuItems.find((m) => m.id === activeMenu)?.label || "Menu"}
              </span>
              {activeMenu === "logmonitor" && dbState.sessions.filter((s) => s.status === "Mengerjakan" || s.pelanggaranCount > 0).length > 0 && (
                <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping"></span>
              )}
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setMobileNavOpen((prev) => !prev)}
          className="p-2 px-3 bg-white border border-slate-200 rounded-xl text-slate-700 font-bold text-xs flex items-center gap-1.5 shadow-sm active:scale-95 cursor-pointer hover:bg-slate-50 transition"
        >
          {mobileNavOpen ? <X size={15} className="text-rose-500" /> : <Menu size={15} className="text-[#0666AE]" />}
          <span>{mobileNavOpen ? "Tutup" : "Menu"}</span>
        </button>
      </div>

      {/* MOBILE COLLAPSIBLE DRAWER */}
      <AnimatePresence>
        {mobileNavOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="lg:hidden w-full bg-slate-50 border-b border-slate-200 p-3 overflow-hidden select-none z-20"
          >
            <div className="grid grid-cols-2 gap-1.5 text-xs max-h-[55vh] overflow-y-auto p-1">
              {menuItems.map((m) => {
                const Icon = m.icon;
                const isActive = activeMenu === m.id;
                return (
                  <button
                    key={m.id}
                    onClick={() => {
                      setActiveMenu(m.id);
                      setMobileNavOpen(false);
                    }}
                    className={`flex items-center gap-2 p-2.5 rounded-xl text-left font-semibold transition cursor-pointer ${
                      isActive
                        ? "bg-[#0666AE] text-white shadow-sm font-extrabold"
                        : "bg-white text-slate-700 hover:bg-slate-100 border border-slate-200/60"
                    }`}
                  >
                    <Icon size={14} className={isActive ? "text-white" : "text-[#0666AE]"} />
                    <span className="truncate">{m.label}</span>
                  </button>
                );
              })}
            </div>
            <div className="mt-2 pt-2 border-t border-slate-200 flex justify-between items-center text-[10px] px-1">
              <span className="text-slate-400 font-mono truncate">{adminEmail}</span>
              <button
                onClick={onLogout}
                className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg font-bold flex items-center gap-1 cursor-pointer transition"
              >
                <LogOut size={11} />
                <span>Keluar Sesi</span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 2. DESKTOP PERMANENT SIDE NAVIGATION BAR */}
      <aside className="hidden lg:flex w-64 bg-slate-50 border-r border-slate-250/75 flex-col justify-between shrink-0 select-none">
        <div>
          <div className="p-5 border-b border-slate-200 bg-slate-100/50">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded bg-[#0666AE]/10 text-[#0666AE] border border-[#0666AE]/20 shadow-inner">
                <Shield size={18} />
              </div>
              <div className="text-left">
                <h2 className="text-[9px] font-bold text-slate-400 uppercase tracking-widest leading-none">PANEL UTAMA</h2>
                <h1 className="text-sm font-bold text-slate-800 mt-1 line-clamp-1">ADMINISTRATOR</h1>
              </div>
            </div>
            <p className="text-[10px] text-[#0666AE] font-mono mt-2 bg-[#0666AE]/5 p-1 px-2 rounded-lg border border-[#0666AE]/10 text-center uppercase tracking-wide font-bold">
              CBT MTs. Al-Ma'sum II Cmc
            </p>
          </div>

          <nav className="p-3 flex flex-col gap-1 text-xs">
            {menuItems.map((m) => {
              const Icon = m.icon;
              const isActive = activeMenu === m.id;
              return (
                <button
                  key={m.id}
                  onClick={() => setActiveMenu(m.id)}
                  className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-left font-semibold transition-all duration-350 cursor-pointer ${
                    isActive
                      ? "bg-[#0666AE] text-white shadow-sm font-extrabold"
                      : "text-slate-600 hover:bg-slate-200/50 hover:text-slate-900"
                  }`}
                >
                  <Icon size={15} />
                  <span>{m.label}</span>
                  {m.id === "logmonitor" && dbState.sessions.filter((s) => s.status === "Mengerjakan" || s.pelanggaranCount > 0).length > 0 && (
                    <span className="ml-auto w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse"></span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        <div className="p-4 border-t border-slate-200 bg-slate-100/50 text-[10px] text-left">
          <p className="text-slate-400">ID Pengguna:</p>
          <p className="font-mono text-[#0666AE] truncate font-bold">{adminEmail || "almasumcimuncang@gmail.com"}</p>
          <button
            onClick={onLogout}
            className="mt-3 w-full py-2 px-3 bg-white border border-slate-200 text-slate-600 hover:text-red-650 rounded-xl flex items-center justify-center gap-1.5 cursor-pointer hover:bg-red-50 hover:border-red-200 transition-all font-bold"
          >
            <LogOut size={11} className="text-red-500" />
            <span>Keluar Sesi</span>
          </button>
        </div>
      </aside>

      {/* 2. MAIN WORKING SCREEN WITH ANIMS */}
      <main className="flex-1 p-3 sm:p-6 overflow-y-auto bg-white flex flex-col justify-stretch">
        {/* TOP LEVEL NAVIGATION SUMMARY */}
        <div className="flex flex-wrap justify-between items-center gap-3 pb-4 mb-5 border-b border-slate-200 select-none">
          <div className="text-left">
            <p className="text-[10px] text-slate-400 uppercase tracking-widest font-mono font-bold">Panel Administrasi CBT Utama</p>
            <h1 className="text-md md:text-lg font-black uppercase text-slate-800 flex items-center gap-1.5">
              <span>{dbState.konfig.namaSekolah}</span>
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {isFirebaseConfigured && (
              <div
                className={`px-3 py-1.5 rounded-xl border text-[11px] font-bold flex items-center gap-1.5 ${
                  syncStatus.lastError
                    ? "bg-rose-50 text-rose-700 border-rose-200"
                    : syncStatus.pendingCount > 0
                    ? "bg-amber-50 text-amber-700 border-amber-200"
                    : "bg-emerald-50 text-emerald-700 border-emerald-200"
                }`}
              >
                <Cloud size={14} className={syncStatus.pendingCount > 0 ? "animate-pulse" : ""} />
                <span>
                  {syncStatus.lastError
                    ? "Gagal Sync Cloud"
                    : syncStatus.pendingCount > 0
                    ? "Menyimpan ke Cloud..."
                    : "Cloud Sync Aktif"}
                </span>
              </div>
            )}

            <div className="flex items-center gap-4 bg-slate-50 p-2 px-3 rounded-xl border border-slate-200 text-xs text-left shadow-sm">
              <div className="shrink-0 flex items-center justify-center w-8 h-8 rounded-full bg-amber-50 border border-amber-200 text-amber-500 animate-pulse">
                <Clock size={16} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-slate-600">Rotasi Token</span>
                  <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 font-mono text-[9px] font-black">
                    {formatTimeMinutes(secondsRemaining)}
                  </span>
                </div>
                <div className="w-24 bg-slate-200 h-1 rounded-full mt-1 overflow-hidden">
                  <div
                    className="bg-amber-500 h-full transition-all duration-1000"
                    style={{ width: `${timerProgress}%` }}
                  ></div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* TOAST & CLOUD ERROR BANNERS */}
        {toastMsg && (
          <div
            className={`mb-4 p-3 rounded-2xl border text-xs font-bold flex items-center justify-between gap-3 shadow-sm ${
              toastMsg.type === "error"
                ? "bg-rose-50 border-rose-200 text-rose-700"
                : toastMsg.type === "info"
                ? "bg-sky-50 border-sky-200 text-sky-700"
                : "bg-emerald-50 border-emerald-200 text-emerald-800"
            }`}
          >
            <div className="flex items-center gap-2">
              {toastMsg.type === "error" ? (
                <AlertCircle size={15} className="shrink-0" />
              ) : (
                <CheckCircle2 size={15} className="shrink-0" />
              )}
              <span>{toastMsg.text}</span>
            </div>
            <button
              type="button"
              onClick={() => setToastMsg(null)}
              className="p-1 rounded-lg hover:bg-black/5 cursor-pointer"
            >
              <X size={14} />
            </button>
          </div>
        )}

        {syncStatus.lastError && (
          <div className="mb-4 p-3.5 rounded-2xl border bg-rose-50 border-rose-200 text-rose-800 text-xs font-bold flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start gap-2.5">
              <AlertCircle size={16} className="shrink-0 mt-0.5 text-rose-600" />
              <div className="space-y-1">
                <p>Status Sinkronisasi Database: {syncStatus.lastError}</p>
                {syncStatus.quotaExceeded && (
                  <p className="text-[11px] font-medium text-rose-700">
                    Kuota tulis harian gratis habis sehingga edit/hapus belum bisa tersimpan ke server hingga kuota tersedia atau beralih ke Supabase.
                  </p>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={() => clearSyncError()}
              className="px-3 py-1.5 rounded-lg bg-white border border-rose-200 text-rose-700 hover:bg-rose-100 text-[10px] font-extrabold cursor-pointer shrink-0 self-end sm:self-center"
            >
              Tutup
            </button>
          </div>
        )}

        <AnimatePresence mode="wait">
          {/* MENU 1: DASHBOARD */}
          {activeMenu === "dashboard" && (
            <motion.div
              key="dashboard"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.25 }}
              className="space-y-6 text-left"
            >
              {/* Firebase Seeder Hero Alert when DB is empty */}
              {isFirebaseConfigured && (dbState.kelas.length === 0 || seedSuccess) && (
                <div className="p-6 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-3xl space-y-4 shadow-sm relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-8 text-blue-100 opacity-20 transform translate-x-4 -translate-y-4">
                    <Shield size={180} />
                  </div>
                  <div className="relative z-10 space-y-2">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-100 text-blue-800 font-extrabold text-[10px] tracking-wide uppercase animate-pulse">
                      🚨 Cloud Sync Berjalan
                    </span>
                    <h3 className="text-base font-extrabold text-slate-800">
                      Inisialisasi Database Cloud Firestore (Seeding Data)
                    </h3>
                    <p className="text-xs text-slate-500 max-w-2xl leading-relaxed font-semibold">
                      Aplikasi ini telah berhasil dihubungkan ke Firebase Anda! Namun, database Cloud Firestore Anda saat ini masih kosong. Silakan jalankan inisialisasi di bawah untuk mengunggah otomatis master data sekolah, guru, pengawas, mata pelajaran, jadwal, dan daftar siswa contoh langsung ke server Firebase Anda.
                    </p>
                  </div>

                  {seedError && (
                    <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs font-semibold leading-relaxed">
                      ❌ Gagal inisialisasi data: {seedError}
                      <br />
                      <span className="text-[10px] text-rose-500 mt-1 block">Pastikan Aturan Keamanan (Firestore Security Rules) Anda di Firebase console sudah dideploy dengan benar dan Provider Anonymous Authentication di tab Auth sudah Aktif.</span>
                    </div>
                  )}

                  {seedSuccess && (
                    <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-bold flex items-center gap-2">
                      <Check size={16} className="text-emerald-600 font-black shrink-0" />
                      <span>Inisialisasi Sukses! Seluruh data simulasi awal telah berhasil diunggah dan terhubung secara real-time ke akun Cloud Firestore Anda. Portal sinkron secara langsung.</span>
                    </div>
                  )}

                  {!seedSuccess && (
                    <div className="flex flex-wrap items-center gap-3 pt-1">
                      <button
                        onClick={handleConfigureFirebaseSeeding}
                        disabled={isSeeding}
                        className="p-3 px-6 bg-[#0666AE] hover:bg-[#0666AE]/90 text-white font-black text-xs uppercase tracking-wider rounded-xl transition cursor-pointer flex items-center gap-2 disabled:opacity-60 shadow-sm hover:shadow"
                      >
                        {isSeeding ? (
                          <>
                            <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                            <span>Sedang Seeding Data...</span>
                          </>
                        ) : (
                          <>
                            <Upload size={14} />
                            <span>Unggah & Sinkronisasikan Data Sekarang</span>
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* LINK SHARING FOR STUDENTS CARD */}
              <div className="p-6 bg-emerald-50 border border-emerald-200 rounded-3xl space-y-3.5 shadow-sm text-xs text-left relative overflow-hidden">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-emerald-100 text-emerald-800 rounded-xl border border-emerald-150">
                    <Smartphone size={18} className="text-emerald-700 font-bold" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-slate-800">Tautan Resmi Cetak / Bagikan Aplikasi CBT Siswa</h3>
                    <p className="text-[10px] text-emerald-750 font-bold uppercase tracking-wider">Akses Mandiri Siswa MTs. Al-Ma'sum II Cimuncang</p>
                  </div>
                </div>
                
                <p className="text-[11px] text-slate-600 leading-relaxed font-semibold">
                  Bagikan tautan resmi di bawah ini kepada seluruh siswa/peserta ujian. Tautan ini akan membuka Lembar Ujian <strong>CBT MTs. Al-Ma'sum II Cmc</strong> secara mandiri dalam tampilan browser utuh penuh (full-screen) di HP Android/Komputer tanpa dipotong oleh simulator admin:
                </p>

                <div className="flex flex-col sm:flex-row items-center gap-2.5 bg-white p-2 border border-emerald-200 rounded-2xl">
                  <input
                    type="text"
                    readOnly
                    value={typeof window !== "undefined" ? `${window.location.origin}/?siswa=true` : "Silakan muat ulang halaman"}
                    className="w-full bg-slate-50 border-0 outline-none p-2 font-mono text-xs select-all text-emerald-800 font-bold rounded-lg shrink-0 sm:shrink"
                  />
                  <button
                    onClick={() => {
                      if (typeof window !== "undefined") {
                        navigator.clipboard.writeText(`${window.location.origin}/?siswa=true`);
                        showToast("Tautan Siswa berhasil disalin ke papan klip!");
                      }
                    }}
                    className="w-full sm:w-auto px-4 py-2.5 bg-emerald-600 hover:bg-emerald-750 text-white font-black rounded-xl text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow transition active:scale-95 shrink-0"
                  >
                    <Check size={14} />
                    <span>Salin Link Siswa</span>
                  </button>
                </div>
                
                <p className="text-[10px] text-emerald-850 leading-tight bg-emerald-100/40 p-2.5 rounded-xl font-bold border border-emerald-200/40">
                  ⚡ <strong>Jaminan Akses:</strong> Tautan di atas terhubung langsung dengan service lokal & real-time Cloud Firestore. Siswa dapat login dengan akun masing-masing tanpa dialihkan lewat halaman pemberitahuan apa pun.
                </p>
              </div>

              {/* Core Stats Bento Layout */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl hover:border-[#0666AE]/30 transition-all shadow-sm">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-[10px] uppercase font-extrabold text-slate-400 tracking-wider">TOTAL SISWA</p>
                      <h3 className="text-2xl font-black mt-1 text-slate-800">{dbState.siswa.length}</h3>
                    </div>
                    <div className="p-2 rounded-xl bg-blue-50 text-[#0666AE] border border-blue-105">
                      <Users size={16} />
                    </div>
                  </div>
                  <div className="text-[10px] text-slate-500 mt-2 flex items-center gap-1 font-semibold">
                    <span className="text-emerald-600 font-bold">100% Valid</span>
                    <span>terdaftar di database</span>
                  </div>
                </div>

                <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl hover:border-[#0666AE]/30 transition-all shadow-sm">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-[10px] uppercase font-extrabold text-slate-400 tracking-wider">TENAGA GURU</p>
                      <h3 className="text-2xl font-black mt-1 text-slate-800">{dbState.guru.length}</h3>
                    </div>
                    <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-100">
                      <ShieldCheck size={16} />
                    </div>
                  </div>
                  <div className="text-[10px] text-slate-500 mt-2 font-semibold">
                    Mata pelajaran CBS Pengawas aktif
                  </div>
                </div>

                <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl hover:border-[#0666AE]/30 transition-all shadow-sm">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-[10px] uppercase font-extrabold text-slate-400 tracking-wider">JADWAL RILIS</p>
                      <h3 className="text-2xl font-black mt-1 text-slate-800">{dbState.jadwal.length}</h3>
                    </div>
                    <div className="p-2 rounded-xl bg-amber-50 text-amber-600 border border-amber-100">
                      <Calendar size={16} />
                    </div>
                  </div>
                  <div className="text-[10px] text-slate-500 mt-2 font-semibold">
                    Ujian berlangsung hari ini
                  </div>
                </div>

                <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl hover:border-[#0666AE]/30 transition-all shadow-sm">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-[10px] uppercase font-extrabold text-slate-400 tracking-wider">REPO BANK SOAL</p>
                      <h3 className="text-2xl font-black mt-1 text-slate-800">{dbState.soal.length}</h3>
                    </div>
                    <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-100">
                      <BookOpen size={16} />
                    </div>
                  </div>
                  <div className="text-[10px] text-slate-500 mt-2 font-semibold">
                    Pilihan ganda dan attachments
                  </div>
                </div>
              </div>

              {/* Quick Status and Info Header */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 p-5 bg-slate-50/55 border border-slate-200 rounded-2xl space-y-4 shadow-sm">
                  <h4 className="text-xs font-black text-slate-705 uppercase tracking-widest flex items-center gap-1.5 text-slate-600">
                    <Play size={12} className="text-[#0666AE] fill-[#0666AE]" />
                    STATUS JALUR CBT MADRASAH
                  </h4>
                  <div className="space-y-2">
                    <div className="p-3 bg-white rounded-xl border border-slate-100 flex justify-between items-center text-xs shadow-sm">
                      <div>
                        <p className="font-extrabold text-slate-800">Secure Core Anticheat API</p>
                        <p className="text-[10px] text-slate-400 font-semibold">Antiviral state container browser listener</p>
                      </div>
                      <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-200 font-bold text-[9px] tracking-wider uppercase">
                        ONLINE
                      </span>
                    </div>
                    <div className="p-3 bg-white rounded-xl border border-slate-100 flex justify-between items-center text-xs shadow-sm">
                      <div>
                        <p className="font-extrabold text-slate-800">Firebase Real-time Sync Node</p>
                        <p className="text-[10px] text-slate-400 font-semibold">
                          {isFirebaseConfigured ? "Connected to Cloud Firestore instances" : "Simulation memory cluster nodes"}
                        </p>
                      </div>
                      <span className={`px-2.5 py-0.5 rounded-full font-bold text-[9px] tracking-wider uppercase ${
                        isFirebaseConfigured ? "bg-indigo-50 text-indigo-600 border border-indigo-200" : "bg-sky-50 text-[#0666AE] border border-sky-200"
                      }`}>
                        {isFirebaseConfigured ? "LIVE FIRESTORE" : "SIMULASI LOCAL"}
                      </span>
                    </div>
                  </div>

                  <div className="p-4 bg-sky-50/70 border border-sky-200/60 rounded-xl text-xs space-y-1.5 leading-relaxed font-semibold text-slate-600 shadow-inner">
                    <p className="font-bold text-[#0666AE]">💡 Panduan Singkat Alur Kerja:</p>
                    <p className="text-[11px] text-slate-500 font-medium">
                      1. Siswa dapat login secara mandiri menggunakan HP Android atau Komputer dengan tautan di atas.<br />
                      2. Datangi tab <strong>"Cetak Kartu & Berita"</strong> untuk memproyeksi QR Code login instan atau autentikasikan manual dengan kode siswa "siswa1".<br />
                      3. Pada lembar tes siswa, cobalah memicu alarm sistem anti-contek dengan berpindah fokus jendela/halaman browser. Hal ini akan langsung termonitor secara real-time pada menu <strong>"Live Monitoring"</strong>!
                    </p>
                  </div>
                </div>

                <div className="p-5 bg-slate-50/55 border border-slate-200 rounded-2xl space-y-4 flex flex-col justify-between shadow-sm">
                  <div>
                    <h4 className="text-xs font-black text-slate-505 uppercase tracking-wider pb-2 border-b border-slate-200 text-slate-500">
                      PROFIL LEMBAGA
                    </h4>
                    <div className="py-3 space-y-3.5 text-xs text-slate-600">
                      <div>
                        <span className="text-slate-450 uppercase text-[9px] font-bold block">Kode Registrasi</span>
                        <span className="font-extrabold text-slate-800 font-mono text-[11px] bg-white border border-slate-100 p-1 px-2 rounded-lg inline-block mt-0.5">{dbState.konfig.kodeRegistrasi}</span>
                      </div>
                      <div>
                        <span className="text-slate-450 uppercase text-[9px] font-bold block">Pimpinan</span>
                        <span className="font-bold text-slate-800">{dbState.konfig.namaKepsek}</span>
                      </div>
                      <div>
                        <span className="text-slate-450 uppercase text-[9px] font-bold block">Toleransi Multi-tab</span>
                        <span className="font-extrabold text-red-600 font-mono">{dbState.konfig.batasPelanggaran} Kali Pemicu Alarm</span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white p-3 rounded-xl border border-slate-100 text-[10px] flex items-center justify-between shadow-inner">
                    <div className="font-semibold text-slate-500 text-left">
                      <p>Sesi Terhubung Aktif:</p>
                      <p className="font-mono text-xs font-black text-[#0666AE] mt-0.5">
                        {dbState.sessions.length} Piranti Siswa
                      </p>
                    </div>
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping"></span>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* MENU 2: DATA MASTER */}
          {activeMenu === "master" && (
            <motion.div
              key="master"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.25 }}
              className="space-y-6 text-left"
            >
              <h3 className="text-xs font-black text-slate-550 uppercase tracking-widest pb-1 border-b border-slate-200 text-slate-500">
                PENGELOLAAN DATA MASTER RUANG & MAPEL
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Tab Ruang */}
                <div className="p-5 bg-slate-50/55 rounded-2xl border border-slate-200 space-y-4 shadow-sm">
                  <div className="flex justify-between items-center pb-2 border-b border-slate-200">
                    <h4 className="text-xs font-black text-slate-700 uppercase">DAFTAR RUANG UJIAN</h4>
                    <span className="px-2 py-0.5 rounded-lg bg-[#0666AE]/10 text-[#0666AE] text-[10px] font-mono font-bold">
                      {dbState.kelas.length} Ruang Terdaftar
                    </span>
                  </div>

                  <form onSubmit={handleAddKelas} className="grid grid-cols-3 gap-2 text-xs">
                    <input
                      type="text"
                      value={inputKelasNama}
                      onChange={(e) => setInputKelasNama(e.target.value)}
                      placeholder="Eg: Ruang CBT 01, Ruang LAB 2"
                      className="p-2.5 bg-white border border-slate-200 rounded-xl text-slate-800 col-span-2 focus:outline-none focus:border-[#0666AE] font-medium"
                    />
                    <select
                      value={inputKelasJurusan}
                      onChange={(e) => setInputKelasJurusan(e.target.value)}
                      className="p-2.5 bg-white border border-slate-200 rounded-xl text-slate-705 font-bold focus:outline-none focus:border-[#0666AE] cursor-pointer"
                    >
                      <option value="UMUM">UMUM</option>
                      <option value="LAB">LAB</option>
                      <option value="KHUSUS">KHUSUS</option>
                    </select>
                    <button
                      type="submit"
                      className="mt-1 p-2.5 bg-[#0666AE] hover:bg-[#0666AE]/95 text-white rounded-xl font-bold col-span-3 transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      <Plus size={14} />
                      <span>Daftarkan Ruang Baru</span>
                    </button>
                  </form>

                  <div className="max-h-[220px] overflow-y-auto space-y-1.5 text-xs pr-1">
                    {dbState.kelas.map((k) => (
                      <div
                        key={k.id}
                        className="p-3 bg-white rounded-xl border border-slate-100 flex justify-between items-center shadow-sm"
                      >
                        <div className="font-semibold">
                          <span className="font-bold text-slate-800">{k.nama}</span>
                          <span className="ml-2 px-2 py-0.5 rounded-lg bg-teal-50 text-teal-700 font-bold text-[9px] border border-teal-100 uppercase">
                            {k.jurusan}
                          </span>
                        </div>
                        <button
                          onClick={() => handleDeleteKelas(k.id)}
                          className="text-slate-400 hover:text-red-500 p-1 cursor-pointer transition-colors"
                          title="Hapus Ruang"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Tab Mapel */}
                <div className="p-5 bg-slate-50/55 rounded-2xl border border-slate-200 space-y-4 shadow-sm">
                  <div className="flex flex-wrap justify-between items-center pb-2 border-b border-slate-200 gap-2">
                    <h4 className="text-xs font-black text-slate-700 uppercase">MATA PELAJARAN DIKLAT</h4>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setShowImportExcelMapelModal(true)}
                        className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-lg flex items-center gap-1 transition-colors cursor-pointer font-bold text-[10px] shadow-2xs"
                        title="Upload daftar mata pelajaran dari Excel (.xlsx, .xls, .csv)"
                      >
                        <FileSpreadsheet size={12} className="text-emerald-600" />
                        <span>Import Excel</span>
                      </button>
                      <button
                        type="button"
                        onClick={downloadTemplateMapel}
                        className="px-2 py-1 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-lg flex items-center gap-1 transition-colors cursor-pointer font-bold text-[10px] shadow-2xs"
                        title="Unduh format template Excel mata pelajaran"
                      >
                        <Download size={11} className="text-[#0666AE]" />
                        <span>Template</span>
                      </button>
                      <span className="px-2 py-0.5 rounded-lg bg-[#0666AE]/10 text-[#0666AE] text-[10px] font-mono font-bold">
                        {dbState.mapel.length} Mapel
                      </span>
                    </div>
                  </div>

                  <form onSubmit={handleAddMapel} className="space-y-2 text-xs">
                    <div>
                      <input
                        type="text"
                        value={inputMapelNama}
                        onChange={(e) => setInputMapelNama(e.target.value)}
                        placeholder="Nama Mata Pelajaran (eg: Bahasa Sunda, Matematika)"
                        className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:border-[#0666AE] font-black uppercase text-xs"
                        required
                      />
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="submit"
                        className="flex-1 p-2.5 bg-[#0666AE] hover:bg-[#0666AE]/95 text-white rounded-xl font-bold transition-colors cursor-pointer flex items-center justify-center gap-1.5 uppercase text-[11px] tracking-wide"
                      >
                        <Plus size={14} />
                        <span>{editingMapelId ? "Simpan Perubahan Mapel" : "Daftarkan Mapel Baru"}</span>
                      </button>
                      {editingMapelId && (
                        <button
                          type="button"
                          onClick={handleCancelEditMapel}
                          className="px-3 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl font-bold cursor-pointer transition-colors"
                        >
                          Batal
                        </button>
                      )}
                    </div>
                  </form>

                  <div className="max-h-[220px] overflow-y-auto space-y-1.5 text-xs pr-1">
                    {dbState.mapel.map((m) => (
                      <div
                        key={m.id}
                        className="p-3 bg-white rounded-xl border border-slate-100 flex justify-between items-center shadow-sm"
                      >
                        <div className="font-semibold flex items-center gap-2 min-w-0">
                          <span className="font-extrabold text-slate-805 uppercase text-xs truncate">{m.nama}</span>
                          <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 font-mono text-[9px] font-bold shrink-0">
                            {m.kode}
                          </span>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleEditMapelClick(m)}
                            className="text-slate-400 hover:text-[#0666AE] p-1 cursor-pointer transition-colors"
                            title="Edit Mapel"
                          >
                            <Edit size={13} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteMapel(m.id)}
                            className="text-slate-400 hover:text-red-500 p-1 cursor-pointer transition-colors"
                            title="Hapus Mapel"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* MENU: MANAJEMEN KELAS AKADEMIK */}
          {activeMenu === "kelas_akademik" && (
            <motion.div
              key="kelas_akademik"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.25 }}
              className="space-y-6 text-left"
            >
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-2 border-b border-slate-200">
                <h3 className="text-xs font-black uppercase tracking-widest text-slate-500">
                  MANAJEMEN KELAS AKADEMIK (TINGKAT DAN JURUSAN)
                </h3>
                <span className="text-[11px] bg-sky-50 text-sky-700 font-extrabold px-3 py-1 rounded-full border border-sky-100">
                  {dbState.kelasAkademik.length} Kelas Terdaftar
                </span>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                <div className="lg:col-span-4 p-5 bg-slate-50/50 rounded-2xl border border-slate-200 text-xs space-y-4 shadow-sm">
                  <h4 className="text-[12px] font-extrabold text-slate-700 uppercase mb-2">
                    {editingKelasAkademikId ? "EDIT KELAS AKADEMIK" : "DEKLARASI KELAS BARU"}
                  </h4>
                  <form onSubmit={handleAddKelasAkademik} className="space-y-4">
                    <div>
                      <label className="text-[9px] font-black uppercase text-slate-550 block mb-1">
                        Nama Kelas Akademik
                      </label>
                      <input
                        type="text"
                        className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-slate-800 font-bold focus:outline-none focus:border-[#0666AE]"
                        placeholder="Contoh: Kelas VII-1, Kelas VIII-2, Kelas IX-1"
                        value={inputKelasAkademikNama}
                        onChange={(e) => setInputKelasAkademikNama(e.target.value)}
                        required
                      />
                    </div>
                    <div className="flex gap-2 pt-1">
                      <button
                        type="submit"
                        className="flex-1 bg-[#0666AE] hover:bg-[#05558E] text-white p-2.5 rounded-xl font-bold cursor-pointer transition-colors shadow-sm flex items-center justify-center gap-2"
                      >
                        <Plus size={14} />
                        {editingKelasAkademikId ? "Simpan Perubahan" : "Deklarasikan Kelas"}
                      </button>
                      {editingKelasAkademikId && (
                        <button
                          type="button"
                          onClick={handleCancelEditKelasAkademik}
                          className="bg-slate-200 hover:bg-slate-300 text-slate-700 p-2.5 rounded-xl font-bold cursor-pointer transition-colors"
                        >
                          Batal
                        </button>
                      )}
                    </div>
                  </form>
                </div>

                <div className="lg:col-span-8 space-y-4">
                  <h4 className="text-[11px] font-black text-slate-500 uppercase pb-2 border-b border-slate-200">
                    DAFTAR KELAS AKADEMIK DI DATABASE
                  </h4>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {dbState.kelasAkademik.map((ka) => {
                      const countStudents = dbState.siswa.filter(
                        (s) => s.kelas.trim() === ka.nama.trim()
                      ).length;

                      return (
                        <div
                          key={ka.id}
                          className="p-3.5 bg-white border border-slate-200/80 rounded-2xl flex justify-between items-center hover:shadow-md hover:border-[#0666AE]/30 transition-all shadow-sm"
                        >
                          <div className="space-y-1">
                            <p className="font-extrabold text-slate-800 text-[13px]">{ka.nama}</p>
                            <p className="text-[10px] text-slate-500 font-bold uppercase">
                              {countStudents} siswa terplot
                            </p>
                          </div>
                          <div className="flex gap-1.5">
                            <button
                              onClick={() => handleEditKelasAkademikClick(ka)}
                              className="text-slate-400 hover:text-[#0666AE] p-1.5 rounded-lg hover:bg-blue-50 transition-colors cursor-pointer"
                              title="Edit Nama Kelas"
                            >
                              <Edit size={14} />
                            </button>
                            <button
                              onClick={() => handleDeleteKelasAkademik(ka.id)}
                              className="text-slate-400 hover:text-red-650 p-1.5 rounded-lg hover:bg-red-50 transition-colors cursor-pointer"
                              title="Hapus Kelas"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* MENU 3: USER MANAGEMENT */}
          {activeMenu === "users" && (
            <motion.div
              key="users"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.25 }}
              className="space-y-6 text-left"
            >
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-2 border-b border-slate-200">
                <h3 className="text-xs font-black text-slate-550 uppercase tracking-widest text-slate-500">
                  MANAJEMEN USERS (KREDENSIAL PORTAL)
                </h3>
                <div className="flex flex-wrap gap-2 text-xs">
                  <button
                    onClick={() => setShowImportExcelSiswaModal(true)}
                    className="px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-250 rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer font-bold shadow-sm"
                    title="Upload file spreadsheet siswa (.xlsx, .xls, .csv)"
                  >
                    <FileSpreadsheet size={14} className="text-emerald-600" />
                    <span>Import Excel Siswa</span>
                  </button>
                  <button
                    onClick={downloadTemplateSiswa}
                    className="px-2.5 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer font-bold shadow-sm"
                    title="Unduh format template Excel data siswa"
                  >
                    <Download size={13} className="text-emerald-600" />
                    <span>Template Siswa</span>
                  </button>
                  <button
                    onClick={() => setShowPrintCards(true)}
                    className="px-3 py-2 bg-[#0666AE] hover:bg-[#0666AE]/95 text-white rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer font-bold shadow-sm"
                  >
                    <QrCode size={14} />
                    <span>Generate ID Cards QR</span>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                {/* Data Siswa */}
                <div className="p-5 bg-slate-50/55 rounded-2xl border border-slate-200 space-y-4 shadow-sm">
                  <div className="flex justify-between items-center pb-2 border-b border-slate-200">
                    <h4 className="text-xs font-black text-slate-700 uppercase flex items-center gap-1.5">
                      <Users size={15} className="text-[#0666AE]" />
                      SISWA AKTIF ({dbState.siswa.length} Record)
                    </h4>
                    {dbState.siswa.length > 0 && (
                      <button
                        type="button"
                        onClick={handleDeleteAllSiswa}
                        className="text-[10px] text-red-600 hover:text-red-700 font-extrabold hover:underline cursor-pointer flex items-center gap-1 bg-red-50 hover:bg-red-100 px-2 py-1 rounded-md border border-red-250 transition-all select-none"
                        title="Hapus Seluruh Data Siswa"
                      >
                        <Trash2 size={11} />
                        Hapus Masal
                      </button>
                    )}
                  </div>

                  <form
                    id="form-edit-siswa"
                    onSubmit={handleAddSiswa}
                    className={`grid grid-cols-2 gap-3 text-xs bg-white p-4 rounded-xl border shadow-inner transition-all ${
                      editingSiswaId ? "border-amber-400 ring-2 ring-amber-200/70" : "border-slate-100"
                    }`}
                  >
                    {editingSiswaId && (
                      <div className="col-span-2 p-2.5 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-between text-[11px] font-extrabold text-amber-800">
                        <span>✏️ MODE EDIT AKTIF: {inputSiswaNama || "Siswa"}</span>
                        <button
                          type="button"
                          onClick={handleCancelEditSiswa}
                          className="text-amber-700 hover:underline cursor-pointer"
                        >
                          Batal Edit
                        </button>
                      </div>
                    )}
                    <div className="col-span-2">
                      <label className="text-[9px] text-slate-450 font-extrabold uppercase text-slate-500 block mb-0.5">Nama Lengkap Siswa</label>
                      <input
                        type="text"
                        className="w-full p-2.5 border border-slate-200 rounded-xl text-slate-800 font-medium focus:outline-none focus:border-[#0666AE]"
                        placeholder="Nama Lengkap Siswa"
                        value={inputSiswaNama}
                        onChange={(e) => setInputSiswaNama(e.target.value)}
                        required
                      />
                    </div>
                    <div>
                      <label className="text-[9px] text-slate-450 font-extrabold uppercase text-slate-500 block mb-0.5">10-Digit NISN</label>
                      <input
                        type="text"
                        className="w-full p-2.5 border border-slate-200 rounded-xl text-slate-800 font-medium focus:outline-none focus:border-[#0666AE]"
                        placeholder="NISN (10 Digit)"
                        value={inputSiswaNisn}
                        onChange={(e) => setInputSiswaNisn(e.target.value)}
                        required
                      />
                    </div>
                    <div>
                      <label className="text-[9px] text-slate-450 font-extrabold uppercase text-slate-500 block mb-0.5">No. Peserta Ujian</label>
                      <input
                        type="text"
                        className="w-full p-2.5 border border-slate-200 rounded-xl text-slate-800 font-medium focus:outline-none focus:border-[#0666AE] font-mono"
                        placeholder="Ex: 26-04-01-0001"
                        value={inputSiswaNoPeserta}
                        onChange={(e) => setInputSiswaNoPeserta(e.target.value)}
                        required
                      />
                    </div>
                    <div>
                      <label className="text-[9px] text-slate-450 font-extrabold uppercase text-slate-500 block mb-0.5">Username Login</label>
                      <input
                        type="text"
                        className="w-full p-2.5 border border-slate-200 rounded-xl text-slate-800 font-semibold focus:outline-none focus:border-[#0666AE]"
                        placeholder="Username"
                        value={inputSiswaUser}
                        onChange={(e) => setInputSiswaUser(e.target.value)}
                        required
                      />
                    </div>
                    <div>
                      <label className="text-[9px] text-slate-450 font-extrabold uppercase text-slate-500 block mb-0.5">Kunci Sandi (Password)</label>
                      <input
                        type="text"
                        className="w-full p-2.5 border border-slate-200 rounded-xl text-slate-800 font-medium focus:outline-none focus:border-[#0666AE]"
                        placeholder="Password"
                        value={inputSiswaPass}
                        onChange={(e) => setInputSiswaPass(e.target.value)}
                        required
                      />
                    </div>
                    <div>
                      <label className="text-[9px] text-slate-450 font-extrabold uppercase text-slate-500 block mb-0.5">Kelas Akademik</label>
                      <select
                        className="w-full p-2.5 border border-slate-200 rounded-xl text-slate-700 font-bold cursor-pointer focus:outline-none focus:border-[#0666AE]"
                        value={inputSiswaKelasAkademik}
                        onChange={(e) => setInputSiswaKelasAkademik(e.target.value)}
                        required
                      >
                        <option value="">-- Pilih Kelas --</option>
                        {dbState.kelasAkademik.map((ka) => (
                          <option key={ka.id} value={ka.nama}>
                            {ka.nama}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-[9px] text-slate-450 font-extrabold uppercase text-slate-500 block mb-0.5">Ruang CBT (Ujian)</label>
                      <select
                        className="w-full p-2.5 border border-slate-200 rounded-xl text-slate-700 font-bold cursor-pointer focus:outline-none focus:border-[#0666AE]"
                        value={inputSiswaKelas}
                        onChange={(e) => setInputSiswaKelas(e.target.value)}
                        required
                      >
                        <option value="">-- Pilih Ruang --</option>
                        {dbState.kelas.map((k) => (
                          <option key={k.id} value={k.id}>
                            {k.nama} ({k.jurusan})
                          </option>
                        ))}
                      </select>
                    </div>
                    
                    <div className="col-span-2 flex gap-2 pt-2 border-t border-slate-100">
                      <button
                        type="submit"
                        className={`flex-1 p-2.5 text-white rounded-xl font-bold cursor-pointer transition-all active:scale-[0.99] select-none text-center ${
                          editingSiswaId ? "bg-amber-600 hover:bg-amber-700 shadow-sm shadow-amber-600/10" : "bg-sky-600 hover:bg-sky-700 shadow-sm shadow-sky-600/10"
                        }`}
                      >
                        {editingSiswaId ? "💾 Simpan Perubahan Data" : "➕ Daftarkan Siswa Baru"}
                      </button>
                      {editingSiswaId && (
                        <button
                          type="button"
                          onClick={handleCancelEditSiswa}
                          className="px-4 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl font-bold cursor-pointer transition-colors"
                        >
                          Batal
                        </button>
                      )}
                    </div>
                  </form>

                  <div className="max-h-[300px] overflow-y-auto space-y-2 text-xs pr-1">
                    {dbState.siswa.map((s) => (
                      <div
                        key={s.id}
                        className="p-3 bg-white rounded-xl border border-slate-100 flex justify-between items-center shadow-sm hover:border-[#0666AE]/20 transition-all font-sans"
                      >
                        <div className="text-left flex-1 min-w-0 pr-2">
                          <p className="font-extrabold text-slate-800 text-[13px] truncate">{s.nama}</p>
                          <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-[10px] text-slate-400 mt-1.5 font-medium leading-relaxed">
                            <p>NISN: <span className="font-mono text-slate-600 font-bold bg-slate-50 px-1 py-0.2 rounded">{s.nisn}</span></p>
                            <p>No. Peserta: <span className="font-mono text-emerald-600 font-bold bg-emerald-50 px-1 py-0.2 rounded">{s.noPeserta || "-"}</span></p>
                            <p>Username: <span className="text-[#0666AE] font-bold">{s.username}</span></p>
                            <p>Password: <span className="text-purple-600 font-mono font-bold">{s.password || "Password123"}</span></p>
                            <p>Kelas: <span className="text-slate-700 font-extrabold">{s.kelas || "-"}</span></p>
                            <p>Ruang CBT: <span className="text-amber-600 font-extrabold">{dbState.kelas.find((k) => k.id === s.kelasId)?.nama || "-"}</span></p>
                          </div>
                        </div>
                        <div className="flex gap-1">
                          <button
                            onClick={() => handleEditSiswaClick(s)}
                            className="text-slate-400 hover:text-amber-600 p-2 transition-colors cursor-pointer rounded-xl hover:bg-amber-50"
                            title="Edit Data Siswa"
                          >
                            <Edit size={13} />
                          </button>
                          <button
                            onClick={() => handleDeleteSiswa(s.id)}
                            className="text-slate-400 hover:text-red-600 p-2 transition-colors cursor-pointer rounded-xl hover:bg-red-50"
                            title="Hapus Siswa Dr Pangkalan Data"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Data Guru */}
                <div className="p-5 bg-slate-50/55 rounded-2xl border border-slate-200 space-y-4 shadow-sm">
                  <div className="flex flex-wrap justify-between items-center pb-2 border-b border-slate-200 gap-2">
                    <h4 className="text-xs font-black text-slate-700 uppercase flex items-center gap-1.5">
                      <Shield size={15} className="text-emerald-600" />
                      DEWAN GURU ({dbState.guru.length} Guru)
                    </h4>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setShowImportExcelGuruModal(true)}
                        className="px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-250 rounded-lg flex items-center gap-1 transition-colors cursor-pointer font-bold text-[10px] shadow-sm"
                        title="Upload file spreadsheet guru (.xlsx, .xls, .csv)"
                      >
                        <FileSpreadsheet size={13} className="text-emerald-600" />
                        <span>Import Guru</span>
                      </button>
                      <button
                        type="button"
                        onClick={downloadTemplateGuru}
                        className="px-2 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-lg flex items-center gap-1 transition-colors cursor-pointer font-bold text-[10px] shadow-sm"
                        title="Unduh format template Excel dewan guru"
                      >
                        <Download size={12} className="text-emerald-600" />
                        <span>Template</span>
                      </button>
                      {dbState.guru.length > 0 && (
                        <button
                          type="button"
                          onClick={handleDeleteAllGuru}
                          className="text-[10px] text-red-600 hover:text-red-700 font-extrabold hover:underline cursor-pointer flex items-center gap-1 bg-red-50 hover:bg-red-100 px-2 py-1 rounded-md border border-red-250 transition-all select-none"
                          title="Hapus Seluruh Data Guru"
                        >
                          <Trash2 size={11} />
                          Hapus Masal
                        </button>
                      )}
                    </div>
                  </div>

                  <form
                    id="form-edit-guru"
                    onSubmit={handleAddGuru}
                    className={`grid grid-cols-2 gap-3 text-xs bg-white p-4 rounded-xl border shadow-inner transition-all ${
                      editingGuruId ? "border-emerald-400 ring-2 ring-emerald-200/70" : "border-slate-100"
                    }`}
                  >
                    {editingGuruId && (
                      <div className="col-span-2 p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between text-[11px] font-extrabold text-emerald-800">
                        <span>✏️ MODE EDIT GURU: {inputGuruNama || "Guru"}</span>
                        <button
                          type="button"
                          onClick={handleCancelEditGuru}
                          className="text-emerald-700 hover:underline cursor-pointer"
                        >
                          Batal Edit
                        </button>
                      </div>
                    )}
                    <div className="col-span-2 sm:col-span-1">
                      <label className="text-[9px] text-slate-500 font-extrabold uppercase block mb-0.5">Nama Lengkap & Gelar</label>
                      <input
                        type="text"
                        className="w-full p-2.5 border border-slate-200 rounded-xl text-slate-800 font-medium focus:outline-none focus:border-emerald-600"
                        placeholder="Nama Lengkap & Gelar"
                        value={inputGuruNama}
                        onChange={(e) => setInputGuruNama(e.target.value)}
                        required
                      />
                    </div>
                    <div className="col-span-2 sm:col-span-1">
                      <label className="text-[9px] text-slate-500 font-extrabold uppercase block mb-0.5">NIP Pengenal</label>
                      <input
                        type="text"
                        className="w-full p-2.5 border border-slate-200 rounded-xl text-slate-800 font-mono focus:outline-none focus:border-emerald-600"
                        placeholder="NIP Pengenal"
                        value={inputGuruNip}
                        onChange={(e) => setInputGuruNip(e.target.value)}
                        required
                      />
                    </div>
                    <div className="col-span-2 sm:col-span-1">
                      <label className="text-[9px] text-slate-500 font-extrabold uppercase block mb-0.5">Username Login</label>
                      <input
                        type="text"
                        className="w-full p-2.5 border border-slate-200 rounded-xl text-slate-800 font-semibold focus:outline-none focus:border-emerald-600"
                        placeholder="Username"
                        value={inputGuruUser}
                        onChange={(e) => setInputGuruUser(e.target.value)}
                        required
                      />
                    </div>
                    <div className="col-span-2 sm:col-span-1">
                      <label className="text-[9px] text-slate-500 font-extrabold uppercase block mb-0.5">Kata Sandi (Password)</label>
                      <input
                        type="text"
                        className="w-full p-2.5 border border-slate-200 rounded-xl text-slate-800 font-medium focus:outline-none focus:border-emerald-600"
                        placeholder="Password"
                        value={inputGuruPass}
                        onChange={(e) => setInputGuruPass(e.target.value)}
                      />
                    </div>

                    {/* Clean Step-by-Step Multi-Mapel + Plotting Kelas Picker */}
                    <div className="col-span-2 p-3.5 bg-slate-50 rounded-2xl border border-slate-200 text-xs space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <p className="font-extrabold text-slate-700 uppercase text-[10px] tracking-wider">
                            Mata Pelajaran & Kelas yang Diajar
                          </p>
                          <p className="text-[10px] text-slate-500">
                            1) Pilih Mapel di dropdown • 2) Klik kelas yang diajar (mis. X-1, X-2, X-3)
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            openGuruPlottingModal({
                              id: "__FORM__",
                              nama: inputGuruNama || "Guru Baru",
                              nip: inputGuruNip || "-",
                              username: inputGuruUser || "-",
                              mapelIds: inputGuruMapelKelas.map((mk) => mk.mapelId),
                              mapelKelas: inputGuruMapelKelas,
                            })
                          }
                          className="px-2.5 py-1.5 bg-white hover:bg-sky-50 text-[#0666AE] border border-sky-200 rounded-xl font-extrabold text-[10px] flex items-center gap-1 cursor-pointer shadow-2xs transition"
                        >
                          <Layers size={12} />
                          <span>Buka Tampilan Lebar</span>
                        </button>
                      </div>

                      {/* 1. Chips daftar mapel yang sudah diplot ke guru ini */}
                      <div className="space-y-1.5">
                        {inputGuruMapelKelas.length === 0 ? (
                          <div className="p-2.5 bg-white/80 border border-dashed border-slate-300 rounded-xl text-[10px] text-slate-400 text-center font-medium">
                            Belum ada mata pelajaran dipilih. Pilih mata pelajaran di bawah untuk menambahkan.
                          </div>
                        ) : (
                          <div className="flex flex-wrap gap-1.5">
                            {inputGuruMapelKelas.map((mk) => {
                              const mObj = dbState.mapel.find((m) => m.id === mk.mapelId);
                              const isActive = activePlotMapelId === mk.mapelId;
                              const kelasText =
                                mk.kelasIds.length > 0
                                  ? mk.kelasIds
                                      .map((kId) => dbState.kelasAkademik.find((ka) => ka.id === kId)?.nama || kId)
                                      .join(", ")
                                  : "Semua Kelas";
                              return (
                                <div
                                  key={mk.mapelId}
                                  className={`inline-flex items-center gap-1.5 pl-2.5 pr-1.5 py-1.5 rounded-xl border text-[10px] transition cursor-pointer ${
                                    isActive
                                      ? "bg-emerald-600 text-white border-emerald-600 shadow-sm"
                                      : "bg-white text-slate-700 border-emerald-300 hover:bg-emerald-50"
                                  }`}
                                  onClick={() => setActivePlotMapelId(mk.mapelId)}
                                  title="Klik untuk ubah kelas mata pelajaran ini"
                                >
                                  <span className="font-extrabold">{mObj?.nama || "Mapel"}</span>
                                  <span
                                    className={`px-1.5 py-0.5 rounded-md font-bold text-[9px] ${
                                      isActive ? "bg-white/20 text-white" : "bg-emerald-50 text-emerald-700"
                                    }`}
                                  >
                                    {kelasText}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      toggleTeacherMapel(mk.mapelId);
                                    }}
                                    className={`p-0.5 rounded-full transition cursor-pointer ${
                                      isActive
                                        ? "hover:bg-white/25 text-white"
                                        : "hover:bg-rose-100 text-slate-400 hover:text-rose-600"
                                    }`}
                                    title="Hapus mapel dari guru ini"
                                  >
                                    <X size={12} />
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>

                      {/* 2. Dropdown tambah/pilih mapel */}
                      <div className="flex flex-col sm:flex-row gap-2">
                        <select
                          value={activePlotMapelId}
                          onChange={(e) => selectOrAddTeacherMapel(e.target.value)}
                          className="flex-1 p-2.5 bg-white border border-slate-200 rounded-xl font-bold text-slate-700 focus:outline-none focus:border-emerald-600 cursor-pointer text-[11px]"
                        >
                          <option value="">+ Tambah / Pilih Mata Pelajaran untuk Diatur Kelasnya...</option>
                          {dbState.mapel.map((m) => {
                            const already = inputGuruMapelKelas.some((mk) => mk.mapelId === m.id);
                            return (
                              <option key={m.id} value={m.id}>
                                {already ? `✓ ${m.nama} (${m.kode}) — Sudah Diampu` : `${m.nama} (${m.kode})`}
                              </option>
                            );
                          })}
                        </select>
                      </div>

                      {/* 3. Panel pilih kelas dikelompokkan rapi per Angkatan VII / VIII / IX */}
                      {activePlotMapelId && (() => {
                        const activeEntry = inputGuruMapelKelas.find((mk) => mk.mapelId === activePlotMapelId);
                        const activeMapel = dbState.mapel.find((m) => m.id === activePlotMapelId);
                        if (!activeEntry || !activeMapel) return null;

                        const gradeGroups: { label: string; key: "VII" | "VIII" | "IX" | "Lainnya"; list: typeof dbState.kelasAkademik }[] = [
                          { label: "Angkatan VII", key: "VII", list: dbState.kelasAkademik.filter((ka) => getGuruGradeLevel(ka.nama) === "VII") },
                          { label: "Angkatan VIII", key: "VIII", list: dbState.kelasAkademik.filter((ka) => getGuruGradeLevel(ka.nama) === "VIII") },
                          { label: "Angkatan IX", key: "IX", list: dbState.kelasAkademik.filter((ka) => getGuruGradeLevel(ka.nama) === "IX") },
                          { label: "Kelas Lainnya", key: "Lainnya", list: dbState.kelasAkademik.filter((ka) => getGuruGradeLevel(ka.nama) === "Lainnya") },
                        ];

                        return (
                          <div className="p-3 bg-white rounded-xl border border-emerald-200 space-y-2.5 shadow-2xs">
                            <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-100">
                              <div className="text-[11px] font-extrabold text-slate-700">
                                Kelas untuk <span className="text-emerald-700">{activeMapel.nama}</span>:
                              </div>
                              <div className="flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => applyTeacherMapelAngkatan(activeMapel.id, "NONE")}
                                  className={`px-2 py-1 rounded-lg text-[10px] font-extrabold border cursor-pointer transition ${
                                    activeEntry.kelasIds.length === 0
                                      ? "bg-[#0666AE] text-white border-[#0666AE]"
                                      : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                                  }`}
                                >
                                  Semua Kelas
                                </button>
                                <button
                                  type="button"
                                  onClick={() => applyTeacherMapelAngkatan(activeMapel.id, "ALL")}
                                  className="px-2 py-1 rounded-lg text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 cursor-pointer transition"
                                >
                                  Centang Semua
                                </button>
                              </div>
                            </div>

                            <div className="space-y-2">
                              {gradeGroups
                                .filter((g) => g.list.length > 0)
                                .map((grp) => {
                                  const allGrpChecked = grp.list.every((ka) => activeEntry.kelasIds.includes(ka.id));
                                  return (
                                    <div key={grp.key} className="flex flex-wrap items-center gap-1.5 pb-1.5 border-b border-slate-100 last:border-b-0 last:pb-0">
                                      {grp.key !== "Lainnya" ? (
                                        <button
                                          type="button"
                                          onClick={() => applyTeacherMapelAngkatan(activeMapel.id, grp.key as "VII" | "VIII" | "IX")}
                                          className={`px-2 py-1 rounded-lg text-[9px] font-black uppercase border cursor-pointer shrink-0 transition ${
                                            allGrpChecked
                                              ? "bg-emerald-600 text-white border-emerald-600"
                                              : "bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200"
                                          }`}
                                          title={`Pilih / hapus semua ${grp.label}`}
                                        >
                                          {allGrpChecked ? `✓ ${grp.label}` : `+ ${grp.label}`}
                                        </button>
                                      ) : (
                                        <span className="text-[9px] font-black uppercase text-slate-400 px-1.5">
                                          {grp.label}:
                                        </span>
                                      )}

                                      {grp.list.map((ka) => {
                                        const isKChecked = activeEntry.kelasIds.includes(ka.id);
                                        return (
                                          <button
                                            key={ka.id}
                                            type="button"
                                            onClick={() => toggleTeacherMapelKelas(activeMapel.id, ka.id)}
                                            className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border cursor-pointer transition ${
                                              isKChecked
                                                ? "bg-emerald-600 text-white border-emerald-600 shadow-2xs"
                                                : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-emerald-50 hover:border-emerald-300"
                                            }`}
                                          >
                                            {isKChecked ? `✓ ${ka.nama}` : ka.nama}
                                          </button>
                                        );
                                      })}
                                    </div>
                                  );
                                })}
                            </div>
                          </div>
                        );
                      })()}
                    </div>

                    <div className="col-span-2 flex gap-2">
                      <button
                        type="submit"
                        className="p-2.5 bg-emerald-600 hover:bg-emerald-700 text-white flex-1 rounded-xl font-bold cursor-pointer transition-colors"
                      >
                        {editingGuruId ? "Simpan Perubahan" : "Daftar dewan Guru Baru"}
                      </button>
                      {editingGuruId && (
                        <button
                          type="button"
                          onClick={handleCancelEditGuru}
                          className="px-4 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl font-bold cursor-pointer transition-colors"
                        >
                          Batal
                        </button>
                      )}
                    </div>
                  </form>

                  <div className="max-h-[300px] overflow-y-auto space-y-2 text-xs pr-1">
                    {dbState.guru.map((g) => {
                      const ampuanList: GuruAmpuan[] =
                        g.mapelKelas && g.mapelKelas.length > 0
                          ? g.mapelKelas
                          : (g.mapelIds || []).map((id) => ({ mapelId: id, kelasIds: [] }));

                      return (
                        <div
                          key={g.id}
                          className="p-3 bg-white rounded-xl border border-slate-100 flex justify-between items-start gap-2 shadow-sm"
                        >
                          <div className="text-left font-sans flex-1 min-w-0">
                            <p className="font-bold text-slate-800">{g.nama}</p>
                            <p className="text-[10px] text-slate-400 font-mono mt-0.5 leading-relaxed">
                              NIP: {g.nip} | User: <span className="text-emerald-600 font-bold">{g.username}</span> | Pass: <span className="text-indigo-600 font-bold">{g.password || "Password123"}</span>
                            </p>
                            <div className="mt-1.5 flex flex-wrap gap-1">
                              {ampuanList.length > 0 ? (
                                ampuanList.map((mk) => {
                                  const mapelNama = dbState.mapel.find((m) => m.id === mk.mapelId)?.nama || "Mapel";
                                  const kelasNames =
                                    mk.kelasIds && mk.kelasIds.length > 0
                                      ? mk.kelasIds
                                          .map((kId) => dbState.kelasAkademik.find((ka) => ka.id === kId)?.nama || kId)
                                          .join(", ")
                                      : "Semua Kelas";
                                  return (
                                    <span
                                      key={mk.mapelId}
                                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200 text-[9px] font-bold"
                                    >
                                      <span>{mapelNama}:</span>
                                      <span className="text-[#0666AE] font-extrabold">{kelasNames}</span>
                                    </span>
                                  );
                                })
                              ) : (
                                <span className="text-[9px] text-slate-400 italic">Belum ada mapel diplot</span>
                              )}
                            </div>
                          </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => openGuruPlottingModal(g)}
                            className="px-2 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 text-[10px] font-extrabold flex items-center gap-1 transition-colors cursor-pointer"
                            title="Atur Mapel & Kelas Ajar"
                          >
                            <Layers size={12} />
                            <span>Plot Kelas</span>
                          </button>
                          <button
                            onClick={() => handleEditGuruClick(g)}
                            className="text-slate-400 hover:text-[#0666AE] p-1 transition-colors cursor-pointer"
                            title="Edit"
                          >
                            <Edit size={14} />
                          </button>
                          <button
                            onClick={() => handleDeleteGuru(g.id)}
                            className="text-slate-400 hover:text-red-500 p-1 transition-colors cursor-pointer"
                            title="Hapus"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* MENU 4: BANK SOAL */}
          {activeMenu === "bsoal" && (
            <motion.div
              key="bsoal"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.25 }}
              className="space-y-6 text-left"
            >
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 pb-4 border-b border-slate-200">
                <div>
                  <h3 className="text-xs font-black text-[#0666AE] uppercase tracking-widest">
                    REPOSITORI & RINGKASAN BANK SOAL KARYA GURU
                  </h3>
                  <p className="text-[11px] text-slate-500 mt-1 font-semibold leading-relaxed">
                    Kumpulan seluruh butir soal ujian digital CBT yang diunggah dan dikelola oleh Bapak/Ibu Guru pengampu mata pelajaran, dikelompokkan berdasarkan Mata Pelajaran dan Target Kelas. Silakan klik kelompok untuk melihat daftar soal secara rinci.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setInputSoalMapel(dbState.mapel[0]?.id || "");
                      setShowAddSoalModal(true);
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-[#0666AE] hover:bg-[#0666AE]/90 text-white rounded-xl text-xs font-extrabold shadow-sm transition-all cursor-pointer"
                  >
                    <Plus size={14} />
                    <span>Unggah / Tambah Soal</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleExportSoalJSON}
                    className="flex items-center gap-1 px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-[11px] font-bold border border-slate-200 transition-all cursor-pointer"
                    title="Cadangkan seluruh bank soal dalam format JSON"
                  >
                    <Download size={13} />
                    <span>Backup JSON</span>
                  </button>

                  <label className="flex items-center gap-1 px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-[11px] font-bold border border-slate-200 transition-all cursor-pointer">
                    <Upload size={13} />
                    <span>Restore JSON</span>
                    <input
                      type="file"
                      accept=".json"
                      onChange={handleImportSoalJSON}
                      className="hidden"
                    />
                  </label>

                  <div className="flex bg-[#0666AE]/5 rounded-xl px-3 py-1.5 border border-[#0666AE]/20 text-xs items-center gap-2">
                    <span className="font-black text-[#0666AE]">{dbState.soal.length}</span>
                    <span className="text-slate-500 font-extrabold text-[10px] uppercase">Soal Terdaftar</span>
                  </div>
                </div>
              </div>

              {/* STATISTIK BANK SOAL RINGKASAN */}
              {(() => {
                const uniqueGuruIds = Array.from(new Set(dbState.soal.map((s) => s.guruId).filter(Boolean)));
                const totalGuruContributor = uniqueGuruIds.length;
                const uniqueMapelIds = Array.from(new Set(dbState.soal.map((s) => s.mapelId).filter(Boolean)));
                const totalMapelWithSoal = uniqueMapelIds.length;

                const filteredSoalList = dbState.soal.filter((soal) => {
                  // Keyword Search
                  if (bsoalSearch) {
                    const kw = bsoalSearch.toLowerCase();
                    const matchTeks = soal.teks.toLowerCase().includes(kw);
                    const matchOpsi = Object.values(soal.opsi).some((opt) => opt && (opt as string).toLowerCase().includes(kw));
                    if (!matchTeks && !matchOpsi) return false;
                  }

                  // Mapel Filter
                  if (bsoalFilterMapel && soal.mapelId !== bsoalFilterMapel) {
                    return false;
                  }

                  // Guru Filter
                  if (bsoalFilterGuru) {
                    if (bsoalFilterGuru === "sistem") {
                      if (soal.guruId) return false;
                    } else {
                      if (soal.guruId !== bsoalFilterGuru) return false;
                    }
                  }

                  // Target Class Filter
                  if (bsoalFilterKelas) {
                    if (bsoalFilterKelas === "general") {
                      if (soal.kelasIds && soal.kelasIds.length > 0) return false;
                    } else {
                      if (!soal.kelasIds || !soal.kelasIds.includes(bsoalFilterKelas)) return false;
                    }
                  }

                  return true;
                });

                // Compute groupings from the filtered/searched list
                const groupedMap = (() => {
                  const groups: Record<string, {
                    key: string;
                    mapelId: string;
                    mapelNama: string;
                    kelasId: string;
                    kelasNama: string;
                    soalList: Soal[];
                  }> = {};

                  filteredSoalList.forEach((soal) => {
                    const mapelObj = dbState.mapel.find((m) => m.id === soal.mapelId);
                    const mapelNama = mapelObj ? mapelObj.nama : "Tanpa Mata Pelajaran";
                    const mapelId = soal.mapelId || "unmapped";

                    if (!soal.kelasIds || soal.kelasIds.length === 0) {
                      const key = `${mapelId}_umum`;
                      if (!groups[key]) {
                        groups[key] = {
                          key,
                          mapelId,
                          mapelNama,
                          kelasId: "umum",
                          kelasNama: "Semua Kelas / Umum",
                          soalList: [],
                        };
                      }
                      groups[key].soalList.push(soal);
                    } else {
                      soal.kelasIds.forEach((kId) => {
                        const kelasObj = dbState.kelasAkademik.find((ka) => ka.id === kId || ka.nama === kId);
                        const kelasNama = kelasObj ? kelasObj.nama : kId;
                        const finalKId = kelasObj ? kelasObj.id : kId;

                        const key = `${mapelId}_${finalKId}`;
                        if (!groups[key]) {
                          groups[key] = {
                            key,
                            mapelId,
                            mapelNama,
                            kelasId: finalKId,
                            kelasNama,
                            soalList: [],
                          };
                        }
                        groups[key].soalList.push(soal);
                      });
                    }
                  });

                  // Convert to array and sort by Mapel Name then Class Name
                  return Object.values(groups).sort((a, b) => {
                    const mComp = a.mapelNama.localeCompare(b.mapelNama);
                    if (mComp !== 0) return mComp;
                    return a.kelasNama.localeCompare(b.kelasNama);
                  });
                })();

                return (
                  <div className="space-y-6">
                    {/* STAT CARDS */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-sm flex items-center gap-3">
                        <div className="p-2.5 bg-sky-50 text-[#0666AE] rounded-xl border border-sky-100">
                          <BookOpen size={18} />
                        </div>
                        <div>
                          <div className="text-lg font-black text-slate-800">{dbState.soal.length} Butir</div>
                          <p className="text-[9px] text-slate-500 font-extrabold uppercase tracking-wider">TOTAL INVENTARIS SOAL</p>
                        </div>
                      </div>

                      <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-sm flex items-center gap-3">
                        <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl border border-emerald-100">
                          <Check size={18} />
                        </div>
                        <div>
                          <div className="text-lg font-black text-slate-800">{totalGuruContributor} Guru</div>
                          <p className="text-[9px] text-slate-500 font-extrabold uppercase tracking-wider">GURU ELEKTIF KONTRIBUTOR</p>
                        </div>
                      </div>

                      <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-sm flex items-center gap-3">
                        <div className="p-2.5 bg-violet-50 text-violet-600 rounded-xl border border-violet-100">
                          <Layers size={18} />
                        </div>
                        <div>
                          <div className="text-lg font-black text-slate-800">{totalMapelWithSoal} Mapel</div>
                          <p className="text-[9px] text-slate-500 font-extrabold uppercase tracking-wider">MATA PELAJARAN TER-COVER</p>
                        </div>
                      </div>
                    </div>

                    {/* FILTER PANEL */}
                    <div className="bg-slate-50/70 p-4 rounded-2xl border border-slate-200 shadow-sm text-xs space-y-4">
                      <div className="flex items-center gap-2 border-b border-slate-200/60 pb-2">
                        <Layers size={14} className="text-[#0666AE]" />
                        <span className="font-extrabold text-slate-700 uppercase tracking-wider text-[10px]">Filter & Panel Pencarian Soal</span>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                        {/* Search Text */}
                        <div className="space-y-1">
                          <label className="text-[10px] text-slate-500 font-extrabold uppercase block">Cari Kata Kunci</label>
                          <input
                            type="text"
                            value={bsoalSearch}
                            onChange={(e) => setBsoalSearch(e.target.value)}
                            placeholder="Ketik teks soal / kata kunci..."
                            className="w-full p-2 bg-white border border-slate-250 rounded-xl text-slate-700 font-semibold focus:outline-none focus:border-[#0666AE] placeholder-slate-400"
                          />
                        </div>

                        {/* Filter Mapel */}
                        <div className="space-y-1">
                          <label className="text-[10px] text-slate-500 font-extrabold uppercase block">Mata Pelajaran</label>
                          <select
                            value={bsoalFilterMapel}
                            onChange={(e) => setBsoalFilterMapel(e.target.value)}
                            className="w-full p-2 bg-white border border-slate-250 rounded-xl text-[#0666AE] font-bold focus:outline-none focus:border-[#0666AE]"
                          >
                            <option value="">-- Semua Mata Pelajaran --</option>
                            {dbState.mapel.map((m) => (
                              <option key={m.id} value={m.id}>
                                {m.nama}
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* Filter Guru */}
                        <div className="space-y-1">
                          <label className="text-[10px] text-slate-500 font-extrabold uppercase block">Pembuat / Guru</label>
                          <select
                            value={bsoalFilterGuru}
                            onChange={(e) => setBsoalFilterGuru(e.target.value)}
                            className="w-full p-2 bg-white border border-slate-250 rounded-xl text-[#0666AE] font-bold focus:outline-none focus:border-[#0666AE]"
                          >
                            <option value="">-- Semua Guru / Pembuat --</option>
                            {dbState.guru.map((g) => (
                              <option key={g.id} value={g.id}>
                                {g.nama}
                              </option>
                            ))}
                            <option value="sistem">Sistem (Default / Pre-seeded)</option>
                          </select>
                        </div>

                        {/* Filter Target Kelas */}
                        <div className="space-y-1">
                          <label className="text-[10px] text-slate-500 font-extrabold uppercase block">Tingkat Kelas Sasar (Siswa)</label>
                          <select
                            value={bsoalFilterKelas}
                            onChange={(e) => setBsoalFilterKelas(e.target.value)}
                            className="w-full p-2 bg-white border border-slate-250 rounded-xl text-[#0666AE] font-bold focus:outline-none focus:border-[#0666AE]"
                          >
                            <option value="">-- Semua Sasaran Kelas --</option>
                            {dbState.kelasAkademik.map((ka) => (
                              <option key={ka.id} value={ka.id}>
                                {ka.nama}
                              </option>
                            ))}
                            <option value="general">Umum (Tanpa Batasan Kelas)</option>
                          </select>
                        </div>
                      </div>
                    </div>

                    {/* MAIN LIST VIEW */}
                    <div className="space-y-4">
                      <div className="flex justify-between items-center bg-slate-100/60 p-3 rounded-xl border border-slate-200">
                        <span className="text-xs font-bold text-slate-600">
                          Menunjukkan <strong className="text-slate-800">{groupedMap.length}</strong> Kelompok (Total {filteredSoalList.length} soal terfilter)
                        </span>
                        {bsoalSearch || bsoalFilterMapel || bsoalFilterGuru || bsoalFilterKelas ? (
                          <button
                            onClick={() => {
                              setBsoalSearch("");
                              setBsoalFilterMapel("");
                              setBsoalFilterGuru("");
                              setBsoalFilterKelas("");
                              setExpandedGroupKey(null);
                            }}
                            className="text-[10px] text-red-650 hover:text-red-700 font-bold tracking-tight uppercase border-b border-red-250 pb-0.5"
                          >
                            Reset Filter
                          </button>
                        ) : null}
                      </div>

                      {groupedMap.length === 0 ? (
                        <div className="p-12 text-center bg-white border border-dashed border-slate-200 rounded-3xl space-y-3">
                          <Layers className="mx-auto text-slate-300 h-10 w-10" />
                          <div>
                            <span className="block text-slate-700 font-extrabold text-sm uppercase">Tidak Ada Butir Soal / Kelompok Cocok</span>
                            <span className="block text-slate-400 text-xs mt-1">Sesuaikan kata kunci pencarian atau bersihkan filter di atas.</span>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {groupedMap.map((group) => {
                            const isExpanded = expandedGroupKey === group.key;
                            return (
                              <div
                                key={group.key}
                                className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm transition-all"
                              >
                                {/* Group Header Accordion */}
                                <div className="w-full p-4 flex items-center justify-between gap-3 hover:bg-slate-50 transition-colors border-b border-slate-100">
                                  <button
                                    type="button"
                                    onClick={() => setExpandedGroupKey(isExpanded ? null : group.key)}
                                    className="flex-1 flex items-center justify-between text-left cursor-pointer select-none gap-3 min-w-0"
                                  >
                                    <div className="flex items-center gap-3 min-w-0">
                                      <div className="p-2.5 bg-[#0666AE]/10 text-[#0666AE] rounded-xl border border-[#0666AE]/10 shrink-0">
                                        <FolderOpen size={16} />
                                      </div>
                                      <div className="min-w-0">
                                        <h4 className="font-black text-slate-800 text-[13px] uppercase truncate">
                                          {group.mapelNama}
                                        </h4>
                                        <p className="text-[10px] font-bold text-slate-400 mt-0.5">
                                          Sasaran Kelas: <span className="text-[#0666AE] font-black">{group.kelasNama}</span>
                                        </p>
                                      </div>
                                    </div>

                                    <div className="flex items-center gap-3 shrink-0">
                                      <span className="p-1 px-2.5 bg-sky-50 text-[#0666AE] font-black border border-sky-100 rounded-lg text-[10px]">
                                        {group.soalList.length} Butir Soal
                                      </span>
                                      <span className="text-slate-500 font-bold text-[10px] uppercase">
                                        {isExpanded ? "▲ Tutup" : "▼ Detail"}
                                      </span>
                                    </div>
                                  </button>

                                  {group.soalList.length > 0 && (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        handleBulkDeleteAdminGroup(group.mapelId, group.kelasId, group.mapelNama, group.kelasNama)
                                      }
                                      className="p-1 px-2.5 rounded-lg text-red-650 bg-red-50 hover:bg-red-100 border border-red-100 hover:border-red-200 font-extrabold text-[10px] uppercase cursor-pointer transition-all flex items-center gap-1 shrink-0"
                                      title="Hapus seluruh isi soal di kelompok ini"
                                    >
                                      <Trash2 size={10} />
                                      <span>Hapus Kelompok</span>
                                    </button>
                                  )}
                                </div>

                                {/* Group Questions List Expanded Container */}
                                {isExpanded && (
                                  <div className="p-4 bg-slate-50/40 border-t border-slate-100 space-y-4">
                                    {group.soalList.map((soal, sIdx) => {
                                      const isFromGuru = !!soal.guruId;
                                      const creatorObj = isFromGuru ? dbState.guru.find((g) => g.id === soal.guruId) : null;
                                      const creatorName = creatorObj ? creatorObj.nama : (soal.guruId ? `Guru ID: ${soal.guruId}` : "Sistem (Default)");
                                      const creatorNip = creatorObj?.nip;

                                      return (
                                        <div
                                          key={soal.id}
                                          className="p-4 bg-white border border-slate-200 rounded-xl space-y-3 relative shadow-xs hover:border-[#0666AE]/30 transition-all font-sans"
                                        >
                                          <div className="flex flex-wrap gap-2 items-center justify-between border-b border-slate-100 pb-2">
                                            <div className="flex flex-wrap gap-1.5 items-center">
                                              <span className="px-2 py-0.5 bg-slate-100 text-slate-600 font-bold border border-slate-200 rounded-lg text-[9px] flex items-center gap-1">
                                                <span className="text-slate-400 font-normal">Pembuat Soal:</span>
                                                <span className="text-slate-700 font-black">{creatorName}</span>
                                                {creatorNip && <span className="text-slate-500 font-normal">({creatorNip})</span>}
                                              </span>
                                            </div>

                                            <div className="flex gap-1.5 items-center">
                                              <span className="px-2 py-0.5 text-[9px] bg-emerald-50 text-emerald-650 font-black border border-emerald-100 rounded-lg">
                                                KUNCI JAWABAN: {soal.kunci}
                                              </span>
                                              
                                              {/* EDIT BUTTON */}
                                              <button
                                                onClick={() => startEditSoal(soal)}
                                                className="flex items-center gap-1 px-2 py-1.5 text-[10px] font-black text-[#0666AE] bg-sky-50 hover:bg-sky-100 border border-[#0666AE]/20 rounded-lg transition-all cursor-pointer uppercase"
                                                title="Ubah Butir Soal"
                                              >
                                                <Edit size={11} />
                                                <span>Edit Soal</span>
                                              </button>

                                              {/* DELETE BUTTON */}
                                              <button
                                                onClick={() => {
                                                  triggerConfirm(
                                                    "Hapus Butir Soal",
                                                    `Apakah Anda yakin ingin menghapus butir soal ini dari repositori bank soal?`,
                                                    () => {
                                                      handleDeleteSoal(soal.id);
                                                      showToast("Butir soal berhasil dihapus!");
                                                    }
                                                  );
                                                }}
                                                className="flex items-center gap-1 px-2 py-1.5 text-[10px] font-black text-red-650 bg-red-50 hover:bg-red-100 border border-red-200 rounded-lg transition-all cursor-pointer uppercase"
                                                title="Hapus Soal"
                                              >
                                                <Trash2 size={11} />
                                                <span>Hapus Soal</span>
                                              </button>
                                            </div>
                                          </div>

                                          <div className="font-extrabold text-slate-800 leading-relaxed text-[12.5px] flex items-start gap-1.5">
                                            <span className="shrink-0">{sIdx + 1}.</span>
                                            <div className="flex-1 min-w-0">
                                              <RichMathText text={soal.teks} />
                                            </div>
                                          </div>

                                          {soal.gambarUrl && (
                                            <div className="bg-slate-50 p-2 rounded-lg border border-slate-150 inline-block">
                                              <img
                                                src={soal.gambarUrl}
                                                alt="Lampiran visual soal"
                                                referrerPolicy="no-referrer"
                                                className="max-h-40 object-contain rounded border border-slate-200"
                                              />
                                            </div>
                                          )}

                                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-[11px] font-semibold pt-2 border-t border-slate-100">
                                            {(["A", "B", "C", "D", "E"] as const).map((key) => {
                                              const val = soal.opsi?.[key];
                                              const optImg = soal.opsiGambar?.[key];
                                              if (!val && !optImg) return null;
                                              const isCorrect = key === soal.kunci;
                                              return (
                                                <div
                                                  key={key}
                                                  className={`p-2 rounded-lg border flex flex-col gap-1.5 ${
                                                    isCorrect
                                                      ? "bg-emerald-50 text-emerald-700 border-emerald-200 font-black"
                                                      : "bg-white text-slate-600 border-slate-150 font-medium"
                                                  }`}
                                                >
                                                  <div className="flex gap-1.5 items-start">
                                                    <strong className={isCorrect ? "text-emerald-700 font-mono shrink-0" : "text-[#0666AE] font-mono shrink-0"}>
                                                      {key}.
                                                    </strong>
                                                    {val && (
                                                      <div className="flex-1 min-w-0">
                                                        <RichMathText text={val} />
                                                      </div>
                                                    )}
                                                    {isCorrect && (
                                                      <Check size={12} className="text-emerald-600 ml-auto flex-shrink-0" />
                                                    )}
                                                  </div>
                                                  {optImg && (
                                                    <img
                                                      src={optImg}
                                                      alt={`Gambar Opsi ${key}`}
                                                      className="max-h-24 w-auto object-contain rounded border border-slate-200 bg-white self-start ml-5"
                                                    />
                                                  )}
                                                </div>
                                              );
                                            })}
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}
            </motion.div>
          )}

          {/* MENU 5: JADWAL UJIAN */}
          {activeMenu === "jadwal" && (
            <motion.div
              key="jadwal"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.25 }}
              className="space-y-6 text-left"
            >
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-2 border-b border-slate-200">
                <div>
                  <h3 className="text-xs font-black text-slate-550 uppercase tracking-widest text-[#0666AE]">
                    JADWAL PELAKSANAAN UJIAN CBT
                  </h3>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Atur jadwal rilis soal, durasi waktu, serta token ujian bagi siswa.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowImportExcelJadwalModal(true)}
                    className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-250 rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer font-bold text-xs shadow-sm"
                    title="Upload file spreadsheet jadwal ujian (.xlsx, .xls, .csv)"
                  >
                    <FileSpreadsheet size={14} className="text-emerald-600" />
                    <span>Import Excel Jadwal</span>
                  </button>
                  <button
                    type="button"
                    onClick={downloadTemplateJadwal}
                    className="px-2.5 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer font-bold text-xs shadow-sm"
                    title="Unduh format template Excel jadwal ujian"
                  >
                    <Download size={13} className="text-emerald-600" />
                    <span>Template Jadwal</span>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
                {/* Form Input */}
                <form
                  id="form-edit-jadwal"
                  onSubmit={handleCreateJadwal}
                  className={`p-5 bg-slate-50/55 rounded-2xl border text-xs space-y-4 xl:col-span-5 shadow-sm transition-all ${
                    editingJadwalId ? "border-sky-400 ring-2 ring-sky-200/70" : "border-slate-200"
                  }`}
                >
                  <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                    <h4 className="text-xs font-bold text-slate-700 uppercase">
                      {editingJadwalId ? "✏️ EDIT JADWAL UJIAN" : "RILIS JADWAL UJIAN BARU"}
                    </h4>
                    {editingJadwalId && (
                      <button
                        type="button"
                        onClick={handleCancelEditJadwal}
                        className="text-[11px] font-extrabold text-sky-700 hover:underline cursor-pointer"
                      >
                        Batal
                      </button>
                    )}
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] text-slate-500 font-extrabold">MATA PELAJARAN</label>
                    <select
                      className="w-full p-2.5 bg-white border border-slate-200 rounded-xl font-bold cursor-pointer focus:outline-none focus:border-[#0666AE]"
                      value={schedMapel}
                      onChange={(e) => {
                        setSchedMapel(e.target.value);
                        setSchedGuruIds([]);
                      }}
                    >
                      <option value="">-- Pilih Pelajaran --</option>
                      {dbState.mapel.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.nama}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Sumber Soal Dari Guru Mana (Opsional - memudahkan agar tidak salah bank soal guru) */}
                  {schedMapel && (() => {
                    const mapelSoal = dbState.soal.filter((s) => s.mapelId === schedMapel);
                    const hasSystemSoal = mapelSoal.some((s) => !s.guruId);
                    const relevantGuru = dbState.guru.filter(
                      (g) =>
                        (g.mapelIds || []).includes(schedMapel) ||
                        (g.mapelKelas || []).some((mk) => mk.mapelId === schedMapel) ||
                        mapelSoal.some((s) => s.guruId === g.id)
                    );

                    const previewDraft: JadwalUjian = {
                      id: "draft",
                      mapelId: schedMapel,
                      kelasIds: schedKelas,
                      tanggal: schedTanggal,
                      jamMulai: schedMulai,
                      jamSelesai: schedSelesai,
                      acakSoal: schedAcak,
                      durasiMenit: Number(schedDurasi) || 90,
                      guruIds: schedGuruIds,
                    };
                    const draftMatchedCount = filterQuestionsForJadwal(
                      previewDraft,
                      dbState.soal,
                      dbState.kelasAkademik
                    ).length;

                    return (
                      <div className="space-y-2 p-3 bg-white border border-sky-200/80 rounded-xl shadow-inner">
                        <div className="flex items-center justify-between gap-2">
                          <label className="text-[10px] text-[#0666AE] font-extrabold uppercase flex items-center gap-1">
                            <UserCheck size={12} />
                            SUMBER SOAL DARI GURU (OPSIONAL)
                          </label>
                          <span className="text-[9.5px] font-black px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                            {draftMatchedCount} Soal Masuk
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          <button
                            type="button"
                            onClick={() => setSchedGuruIds([])}
                            className={`px-2.5 py-1 rounded-lg text-[10px] font-extrabold border transition cursor-pointer ${
                              schedGuruIds.length === 0
                                ? "bg-[#0666AE] text-white border-[#0666AE] shadow-sm"
                                : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                            }`}
                          >
                            Semua Guru ({mapelSoal.length} soal)
                          </button>
                          {relevantGuru.map((g) => {
                            const gSoal = mapelSoal.filter((s) => s.guruId === g.id);
                            const active = schedGuruIds.includes(g.id);
                            return (
                              <button
                                key={g.id}
                                type="button"
                                onClick={() => {
                                  setSchedGuruIds((prev) =>
                                    prev.includes(g.id)
                                      ? prev.filter((id) => id !== g.id)
                                      : [...prev, g.id]
                                  );
                                }}
                                className={`px-2.5 py-1 rounded-lg text-[10px] font-extrabold border transition cursor-pointer ${
                                  active
                                    ? "bg-emerald-600 text-white border-emerald-600 shadow-sm"
                                    : "bg-slate-50 text-slate-700 border-slate-200 hover:border-sky-300"
                                }`}
                              >
                                {active ? "✓ " : ""}
                                {g.nama} ({gSoal.length})
                              </button>
                            );
                          })}
                          {hasSystemSoal && (
                            <button
                              type="button"
                              onClick={() => {
                                setSchedGuruIds((prev) =>
                                  prev.includes(SYSTEM_GURU_ID)
                                    ? prev.filter((id) => id !== SYSTEM_GURU_ID)
                                    : [...prev, SYSTEM_GURU_ID]
                                );
                              }}
                              className={`px-2.5 py-1 rounded-lg text-[10px] font-extrabold border transition cursor-pointer ${
                                schedGuruIds.includes(SYSTEM_GURU_ID)
                                  ? "bg-emerald-600 text-white border-emerald-600 shadow-sm"
                                  : "bg-slate-50 text-slate-600 border-slate-200 hover:border-sky-300"
                              }`}
                            >
                              {schedGuruIds.includes(SYSTEM_GURU_ID) ? "✓ " : ""}
                              Bank Sistem ({mapelSoal.filter((s) => !s.guruId).length})
                            </button>
                          )}
                        </div>
                        <p className="text-[9.5px] text-slate-500 font-medium">
                          {schedGuruIds.length === 0
                            ? "Semua guru pengampu mapel ini otomatis disertakan (tetap dipisah per kelas soal)."
                            : "Hanya soal milik guru terpilih di atas yang akan masuk ke jadwal ini."}
                        </p>
                      </div>
                    );
                  })()}

                   <div className="space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-1.5">
                      <label className="text-[10px] text-slate-500 font-extrabold uppercase">SASARAN KELAS AKADEMIK (BISA MULTI)</label>
                      <div className="flex flex-wrap gap-1">
                        {(["VII", "VIII", "IX"] as const).map((lvl) => {
                          const lvlNames = dbState.kelasAkademik
                            .filter((ka) => getClassGradeLevel(ka.nama) === lvl)
                            .map((ka) => ka.nama);
                          if (lvlNames.length === 0) return null;
                          const allLvlSelected = lvlNames.every((n) => schedKelas.includes(n));
                          return (
                            <button
                              key={lvl}
                              type="button"
                              onClick={() => {
                                if (allLvlSelected) {
                                  setSchedKelas((prev) => prev.filter((n) => !lvlNames.includes(n)));
                                } else {
                                  setSchedKelas((prev) => Array.from(new Set([...prev, ...lvlNames])));
                                }
                              }}
                              className={`px-2 py-0.5 rounded text-[9px] font-black border cursor-pointer transition ${
                                allLvlSelected
                                  ? "bg-[#0666AE] text-white border-[#0666AE]"
                                  : "bg-white text-slate-600 border-slate-200 hover:bg-sky-50"
                              }`}
                            >
                              Kelas {lvl}
                            </button>
                          );
                        })}
                        <button
                          type="button"
                          onClick={() => setSchedKelas([])}
                          className="px-2 py-0.5 rounded text-[9px] font-bold bg-white text-slate-500 border border-slate-200 hover:bg-slate-100 cursor-pointer"
                        >
                          Reset
                        </button>
                      </div>
                    </div>
                    <div className="p-3 bg-white border border-slate-200 rounded-xl flex flex-wrap gap-2 shadow-inner max-h-[140px] overflow-y-auto">
                      {dbState.kelasAkademik.map((ka) => {
                        const kNama = ka.nama;
                        const hasSelected = schedKelas.includes(kNama);
                        return (
                          <label key={ka.id} className="flex items-center gap-2 cursor-pointer font-bold text-slate-600 text-[11px] bg-slate-50 p-1.5 px-2.5 rounded-lg border border-slate-200/70 hover:bg-slate-100 transition-all select-none">
                            <input
                              type="checkbox"
                              checked={hasSelected}
                              onChange={() => {
                                if (hasSelected) {
                                  setSchedKelas(schedKelas.filter((name) => name !== kNama));
                                } else {
                                  setSchedKelas([...schedKelas, kNama]);
                                }
                              }}
                              className="rounded border-slate-250 text-[#0666AE] focus:ring-0"
                            />
                            <span>{kNama}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <label className="text-[10px] text-slate-500 font-extrabold">TANGGAL TES</label>
                      <input
                        type="date"
                        className="w-full p-2 bg-white border border-slate-200 rounded-xl text-slate-800 font-semibold"
                        value={schedTanggal}
                        onChange={(e) => setSchedTanggal(e.target.value)}
                      />
                    </div>
                    
                    {/* All-Day Session Checkbox */}
                    <div className="flex items-center justify-between p-2.5 bg-sky-50/60 border border-sky-200/70 rounded-xl select-none">
                      <div>
                        <span className="block text-[11px] font-black text-[#0666AE]">Buka Sesi Sepanjang Hari</span>
                        <span className="block text-[9px] text-slate-500 font-semibold">00:00 - 23:59 WIB (Siswa leluasa akses kapan saja hari ini)</span>
                      </div>
                      <input
                        type="checkbox"
                        checked={schedAllDay}
                        onChange={(e) => setSchedAllDay(e.target.checked)}
                        className="w-4 h-4 rounded text-[#0666AE] cursor-pointer"
                      />
                    </div>
                  </div>

                  {!schedAllDay && (
                    <div className="grid grid-cols-2 gap-2 p-2.5 bg-slate-100/50 rounded-xl border border-slate-200">
                      <div className="space-y-1">
                        {(() => {
                          const [currHour, currMin] = (schedMulai || "07:30").split(":");
                          return (
                            <>
                              <div className="flex justify-between items-center">
                                <label className="text-[9.5px] text-slate-700 font-extrabold block">
                                  JAM MULAI (Format 24 Jam)
                                </label>
                                <span className="text-[10px] font-mono font-bold text-[#0666AE] bg-sky-100 px-1.5 py-0.5 rounded">
                                  {currHour}:{currMin} WIB
                                </span>
                              </div>
                              <div className="flex gap-1 items-center">
                                <div className="flex-1">
                                  <label className="text-[8px] text-slate-500 font-bold block mb-0.5">Jam (00-23)</label>
                                  <select
                                    value={currHour || "07"}
                                    onChange={(e) => setSchedMulai(`${e.target.value}:${currMin || "30"}`)}
                                    className="w-full p-1.5 bg-white border border-slate-200 rounded-lg text-slate-800 font-mono font-bold text-xs"
                                  >
                                    {Array.from({ length: 24 }).map((_, i) => {
                                      const val = String(i).padStart(2, "0");
                                      return <option key={val} value={val}>{val}</option>;
                                    })}
                                  </select>
                                </div>
                                <span className="text-slate-400 font-bold pt-3">:</span>
                                <div className="flex-1">
                                  <label className="text-[8px] text-slate-500 font-bold block mb-0.5">Menit (00-59)</label>
                                  <select
                                    value={currMin || "30"}
                                    onChange={(e) => setSchedMulai(`${currHour || "07"}:${e.target.value}`)}
                                    className="w-full p-1.5 bg-white border border-slate-200 rounded-lg text-slate-800 font-mono font-bold text-xs"
                                  >
                                    {Array.from({ length: 60 }).map((_, i) => {
                                      const val = String(i).padStart(2, "0");
                                      return <option key={val} value={val}>{val}</option>;
                                    })}
                                  </select>
                                </div>
                              </div>
                            </>
                          );
                        })()}
                      </div>

                      <div className="space-y-1">
                        {(() => {
                          const [currHour, currMin] = (schedSelesai || "23:59").split(":");
                          return (
                            <>
                              <div className="flex justify-between items-center">
                                <label className="text-[9.5px] text-slate-700 font-extrabold block">
                                  JAM TUTUP (Format 24 Jam)
                                </label>
                                <span className="text-[10px] font-mono font-bold text-slate-700 bg-slate-200 px-1.5 py-0.5 rounded">
                                  {currHour}:{currMin} WIB
                                </span>
                              </div>
                              <div className="flex gap-1 items-center">
                                <div className="flex-1">
                                  <label className="text-[8px] text-slate-500 font-bold block mb-0.5">Jam (00-23)</label>
                                  <select
                                    value={currHour || "23"}
                                    onChange={(e) => setSchedSelesai(`${e.target.value}:${currMin || "59"}`)}
                                    className="w-full p-1.5 bg-white border border-slate-200 rounded-lg text-slate-800 font-mono font-bold text-xs"
                                  >
                                    {Array.from({ length: 24 }).map((_, i) => {
                                      const val = String(i).padStart(2, "0");
                                      return <option key={val} value={val}>{val}</option>;
                                    })}
                                  </select>
                                </div>
                                <span className="text-slate-400 font-bold pt-3">:</span>
                                <div className="flex-1">
                                  <label className="text-[8px] text-slate-500 font-bold block mb-0.5">Menit (00-59)</label>
                                  <select
                                    value={currMin || "59"}
                                    onChange={(e) => setSchedSelesai(`${currHour || "23"}:${e.target.value}`)}
                                    className="w-full p-1.5 bg-white border border-slate-200 rounded-lg text-slate-800 font-mono font-bold text-xs"
                                  >
                                    {Array.from({ length: 60 }).map((_, i) => {
                                      const val = String(i).padStart(2, "0");
                                      return <option key={val} value={val}>{val}</option>;
                                    })}
                                  </select>
                                </div>
                              </div>
                            </>
                          );
                        })()}
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <label className="text-[10px] text-slate-500 font-extrabold uppercase flex justify-between items-center">
                        <span>DURASI PENGERJAAN</span>
                        <span className="text-[8.5px] text-[#0666AE] font-mono">Timer Siswa</span>
                      </label>
                      <input
                        type="number"
                        className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-slate-800 font-bold"
                        value={schedDurasi}
                        onChange={(e) => setSchedDurasi(e.target.value)}
                      />
                    </div>
                    <div className="flex items-center justify-center p-2.5 mt-4 bg-white border border-slate-200 rounded-xl shadow-inner cursor-pointer font-bold select-none text-slate-650">
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={schedAcak}
                          onChange={(e) => setSchedAcak(e.target.checked)}
                          className="rounded text-[#0666AE]"
                        />
                        <span>Kocok Soal (Acak)</span>
                      </label>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2">
                    <button
                      type="submit"
                      className="w-full py-2.5 bg-[#0666AE] hover:bg-[#0666AE]/95 text-white rounded-xl uppercase font-extrabold transition shadow cursor-pointer"
                    >
                      {editingJadwalId ? "Simpan Perubahan" : "Rilis Sesi Jadwal CBT"}
                    </button>
                    {editingJadwalId && (
                      <button
                        type="button"
                        onClick={handleCancelEditJadwal}
                        className="w-full py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl uppercase font-extrabold transition cursor-pointer"
                      >
                        Batal Edit
                      </button>
                    )}
                  </div>
                </form>

                {/* List of schedules */}
                <div className="xl:col-span-7 space-y-4">
                  <h4 className="text-xs font-bold text-slate-700 uppercase pb-2 border-b border-slate-200">
                    JADWAL CBT AKTIF DI SERVER ({dbState.jadwal.length} Jadwal Rilis)
                  </h4>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {dbState.jadwal.map((jad) => {
                      const matchSubject = dbState.mapel.find((m) => m.id === jad.mapelId);
                      return (
                        <div
                          key={jad.id}
                          className="p-4 bg-slate-50 border border-slate-200 hover:border-[#0666AE]/30 rounded-2xl text-xs space-y-2 text-left relative shadow-sm"
                        >
                          <div className="flex justify-between items-center bg-white p-1.5 rounded-lg border border-slate-100 shadow-inner">
                            <span className="font-extrabold text-[#0666AE] text-[9px] uppercase tracking-wider bg-[#0666AE]/5 px-2 py-0.5 rounded">
                              {matchSubject ? matchSubject.kode : "CBT"}
                            </span>
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => handleEditJadwalClick(jad)}
                                className="text-slate-450 hover:text-[#0666AE] cursor-pointer p-0.5 rounded transition-all hover:bg-blue-50"
                                title="Edit Jadwal"
                              >
                                <Edit size={12} />
                              </button>
                              <button
                                onClick={() => handleDeleteJadwal(jad.id)}
                                className="text-slate-450 hover:text-red-500 cursor-pointer p-0.5 rounded transition-all hover:bg-red-50"
                                title="Hapus Jadwal"
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>
                          </div>

                          <p className="font-black text-slate-800 text-sm leading-tight pt-1 truncate">{matchSubject ? matchSubject.nama : "Ujian CBT"}</p>
                          <p className="text-slate-500 font-extrabold text-[11px]">
                            Target Kelas: <span className="text-slate-700">{jad.kelasIds.join(", ") || "Semua Tingkat"}</span>
                          </p>

                          <div className="pt-2 border-t border-slate-200/50 mt-2 font-semibold text-[10px] text-slate-400 space-y-1 leading-none font-mono">
                            <div className="flex justify-between">
                              <span>TGL TES</span>
                              <span className="text-slate-700 font-sans font-bold">{jad.tanggal}</span>
                            </div>
                            <div className="flex justify-between">
                              <span>WAKTU DURASI</span>
                              <span className="text-slate-700 font-sans font-bold">{jad.jamMulai} WIB ({jad.durasiMenit} Mins)</span>
                            </div>
                            <div className="flex justify-between pt-1">
                              <span>METODE SOAL</span>
                              <span className="text-emerald-600 font-sans font-extrabold uppercase">{jad.acakSoal ? "🚨 ACAK SOAL" : "URUT STANDAR"}</span>
                            </div>
                          </div>

                          {/* Detail & Konfigurasi Soal Sesuai Tuntutan Kelas & Guru */}
                          {(() => {
                            const matchedSoalList = filterQuestionsForJadwal(
                              jad,
                              dbState.soal,
                              dbState.kelasAkademik
                            );
                            const totalMatchedSoal = matchedSoalList.length;

                            const selectedGuruNames = (jad.guruIds || []).map((gId) => {
                              if (gId === SYSTEM_GURU_ID) return "Bank Sistem";
                              return dbState.guru.find((g) => g.id === gId)?.nama || "Guru";
                            });

                            const isManualMode = Boolean(jad.soalIds && jad.soalIds.length > 0);

                            return (
                              <div className="pt-2.5 border-t border-slate-200/80 mt-2.5 space-y-2 text-[11px] font-sans">
                                <div className="bg-[#0666AE]/5 p-2 rounded-xl border border-[#0666AE]/10 space-y-1">
                                  <div className="flex justify-between items-center">
                                    <span className="font-extrabold text-[#0666AE] uppercase text-[9px] tracking-wider">BANK SOAL MAPEL:</span>
                                    <span
                                      className={`font-black px-2 py-0.5 rounded text-[10px] border ${
                                        totalMatchedSoal > 0
                                          ? "text-emerald-700 bg-emerald-50 border-emerald-200"
                                          : "text-amber-700 bg-amber-50 border-amber-200"
                                      }`}
                                    >
                                      {totalMatchedSoal} Soal Masuk Sesi
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-1 flex-wrap text-[9.5px] font-bold text-slate-600">
                                    <UserCheck size={11} className="text-[#0666AE] shrink-0" />
                                    {isManualMode ? (
                                      <span className="text-indigo-700 font-extrabold">
                                        Mode Pilih Manual ({jad.soalIds?.length} butir)
                                      </span>
                                    ) : selectedGuruNames.length > 0 ? (
                                      <span className="text-emerald-700 font-extrabold truncate">
                                        Guru: {selectedGuruNames.join(", ")}
                                      </span>
                                    ) : (
                                      <span className="text-slate-500">Semua Guru Pengampu</span>
                                    )}
                                  </div>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => handleOpenConfigModal(jad.id)}
                                  className="w-full bg-white hover:bg-sky-50 text-slate-700 hover:text-[#0666AE] font-bold py-1.5 px-2.5 rounded-xl border border-slate-200 hover:border-[#0666AE]/30 text-[10px] transition cursor-pointer flex items-center justify-center gap-1.5 shadow-sm"
                                >
                                  <Settings size={11} className="text-[#0666AE]" />
                                  Detail & Pilih Soal Guru
                                </button>
                              </div>
                            );
                          })()}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* MENU 5.5: JADWAL & PENGAWAS */}
          {activeMenu === "pengawas" && (
            <motion.div
              key="pengawas"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.25 }}
              className="space-y-6 text-left"
            >
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-2 border-b border-slate-200">
                <div>
                  <h3 className="text-xs font-black text-slate-550 uppercase tracking-widest text-[#0666AE]">
                    JADWAL & DEWAN PENGAWAS RUANGAN
                  </h3>
                  <p className="text-[11px] text-slate-500 mt-1">Kelola personil pengawas ruang ujian CBT dan plot daftar jadwal jaga di madrasah secara terintegrasi.</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowImportExcelPengawasModal(true)}
                    className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-250 rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer font-bold text-xs shadow-sm"
                    title="Upload file spreadsheet jadwal pengawas (.xlsx, .xls, .csv)"
                  >
                    <FileSpreadsheet size={14} className="text-emerald-600" />
                    <span>Import Excel Pengawas</span>
                  </button>
                  <button
                    type="button"
                    onClick={downloadTemplatePengawas}
                    className="px-2.5 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer font-bold text-xs shadow-sm"
                    title="Unduh format template Excel jadwal pengawas"
                  >
                    <Download size={13} className="text-emerald-600" />
                    <span>Template Pengawas</span>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                {/* COLUMN 1: MANAJEMEN PERSONIL PENGAWAS */}
                <div className="p-5 bg-slate-50/55 rounded-2xl border border-slate-200 space-y-4 shadow-sm flex flex-col">
                  <div className="flex justify-between items-center pb-2 border-b border-slate-200">
                    <h4 className="text-xs font-black text-slate-700 uppercase flex items-center gap-1.5">
                      <Shield size={15} className="text-[#0666AE]" />
                      Dewan Pengawas Ruang ({dbState.pengawas.length} Personil)
                    </h4>
                    {dbState.pengawas.length > 0 && (
                      <button
                        type="button"
                        onClick={handleDeleteAllPengawas}
                        className="text-[10px] text-red-600 hover:text-red-700 font-extrabold hover:underline cursor-pointer flex items-center gap-1 bg-red-50 hover:bg-red-100 px-2 py-1 rounded-md border border-red-250 transition-all select-none"
                        title="Hapus Seluruh Data Pengawas"
                      >
                        <Trash2 size={11} />
                        Hapus Masal
                      </button>
                    )}
                  </div>

                  {/* Form Pengawas */}
                  <form
                    id="form-edit-pengawas"
                    onSubmit={handleAddPengawas}
                    className={`grid grid-cols-2 gap-3 text-xs bg-white p-4 rounded-xl border shadow-inner overflow-visible transition-all ${
                      editingPengawasId ? "border-amber-400 ring-2 ring-amber-200/70" : "border-slate-100"
                    }`}
                  >
                    {editingPengawasId && (
                      <div className="col-span-2 p-2.5 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-between text-[11px] font-extrabold text-amber-800">
                        <span>✏️ MODE EDIT PENGAWAS: {inputPengawasNama || "Pengawas"}</span>
                        <button
                          type="button"
                          onClick={handleCancelEditPengawas}
                          className="text-amber-700 hover:underline cursor-pointer"
                        >
                          Batal Edit
                        </button>
                      </div>
                    )}
                    <div className="col-span-2">
                      <label className="text-[10px] text-slate-500 font-extrabold uppercase block mb-0.5">Nama Lengkap & Gelar</label>
                      <input
                        type="text"
                        className="w-full p-2.5 border border-slate-200 rounded-xl text-slate-800 font-medium focus:outline-none focus:border-[#0666AE]"
                        placeholder="Nama Lengkap & Gelar (Tanpa Singkatan)"
                        value={inputPengawasNama}
                        onChange={(e) => setInputPengawasNama(e.target.value)}
                        required
                      />
                    </div>
                    <div className="col-span-2 sm:col-span-1">
                      <label className="text-[10px] text-slate-500 font-extrabold uppercase block mb-0.5">NIP Pengenal</label>
                      <input
                        type="text"
                        className="w-full p-2.5 border border-slate-200 rounded-xl text-slate-800 font-mono focus:outline-none focus:border-[#0666AE]"
                        placeholder="NIP Pengawas"
                        value={inputPengawasNip}
                        onChange={(e) => setInputPengawasNip(e.target.value)}
                        required
                      />
                    </div>
                    <div className="col-span-2 sm:col-span-1">
                      <label className="text-[10px] text-slate-500 font-extrabold uppercase block mb-0.5">Username Login</label>
                      <input
                        type="text"
                        className="w-full p-2.5 border border-slate-200 rounded-xl text-slate-800 font-semibold focus:outline-none focus:border-[#0666AE]"
                        placeholder="Username"
                        value={inputPengawasUser}
                        onChange={(e) => setInputPengawasUser(e.target.value)}
                        required
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="text-[10px] text-slate-500 font-extrabold uppercase block mb-0.5">Kata Sandi (Password)</label>
                      <input
                        type="text"
                        className="w-full p-2.5 border border-slate-200 rounded-xl text-slate-800 font-medium focus:outline-none focus:border-[#0666AE]"
                        placeholder="Password (Default: Password123)"
                        value={inputPengawasPass}
                        onChange={(e) => setInputPengawasPass(e.target.value)}
                      />
                    </div>

                    <div className="col-span-2 flex gap-2">
                      <button
                        type="submit"
                        className="p-2.5 bg-[#0666AE] hover:bg-[#0666AE]/90 text-white flex-1 rounded-xl font-bold cursor-pointer transition-colors"
                      >
                        {editingPengawasId ? "💾 Simpan Perubahan" : "➕ Daftarkan Pengawas"}
                      </button>
                      {editingPengawasId && (
                        <button
                          type="button"
                          onClick={handleCancelEditPengawas}
                          className="px-4 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl font-bold cursor-pointer transition-colors"
                        >
                          Batal
                        </button>
                      )}
                    </div>
                  </form>

                  {/* List Pengawas */}
                  <div className="max-h-[350px] overflow-y-auto space-y-2 text-xs pr-1 flex-1">
                    {dbState.pengawas.length === 0 ? (
                      <p className="text-center italic text-slate-400 py-6">Belum ada dewan pengawas terdaftar.</p>
                    ) : (
                      dbState.pengawas.map((p) => (
                        <div
                          key={p.id}
                          className="p-3.5 bg-white rounded-xl border border-slate-100 flex justify-between items-center shadow-sm hover:border-[#0666AE]/20 transition-all font-sans"
                        >
                          <div className="text-left font-sans flex-1 min-w-0 pr-2">
                            <p className="font-extrabold text-[#0666AE] text-[13px]">{p.nama}</p>
                            <p className="text-[11px] text-slate-400 font-mono mt-1">
                              NIP: <span className="text-slate-600 font-bold">{p.nip}</span>
                            </p>
                            <div className="flex gap-4 text-[10px] font-bold text-slate-500 mt-2 bg-slate-50 p-1 px-2 rounded-lg border border-slate-100/80 w-fit">
                              <p>User: <span className="text-indigo-600 font-mono font-black">{p.username}</span></p>
                              <p>Pass: <span className="text-purple-600 font-mono font-black">{p.password || "Password123"}</span></p>
                            </div>
                          </div>
                          <div className="flex gap-1.5 shrink-0">
                            <button
                              onClick={() => handleEditPengawasClick(p)}
                              className="text-slate-400 hover:text-amber-500 p-2 rounded-lg hover:bg-amber-50 transition-colors cursor-pointer"
                              title="Edit Pengawas"
                            >
                              <Edit size={14} />
                            </button>
                            <button
                              onClick={() => handleDeletePengawas(p.id)}
                              className="text-slate-400 hover:text-red-500 p-2 rounded-lg hover:bg-red-50 transition-colors cursor-pointer"
                              title="Hapus Pengawas"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* COLUMN 2: PENJADWALAN / PLOTTING TUGAS NGAWAS */}
                <div className="p-5 bg-slate-50/55 rounded-2xl border border-slate-200 space-y-4 shadow-sm flex flex-col">
                  <h4 className="text-xs font-black text-slate-700 pb-2 border-b border-slate-200 uppercase flex items-center gap-1.5">
                    <Calendar size={15} className="text-[#0666AE]" />
                    Plotting Penugasan Ruang CBT ({dbState.jadwalNgawas.length} Jadwal)
                  </h4>

                  {/* Form Plotting */}
                  <form
                    id="form-edit-jadwal-ngawas"
                    onSubmit={handleAddJadwalNgawas}
                    className={`grid grid-cols-2 gap-3 text-xs bg-white p-4 rounded-xl border shadow-inner overflow-visible transition-all ${
                      editingNgawasId ? "border-emerald-400 ring-2 ring-emerald-200/70" : "border-slate-100"
                    }`}
                  >
                    {editingNgawasId && (
                      <div className="col-span-2 p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between text-[11px] font-extrabold text-emerald-800">
                        <span>✏️ MODE EDIT JADWAL NGAWAS</span>
                        <button
                          type="button"
                          onClick={handleCancelEditJadwalNgawas}
                          className="text-emerald-700 hover:underline cursor-pointer"
                        >
                          Batal Edit
                        </button>
                      </div>
                    )}
                    <div className="col-span-2">
                      <label className="text-[10px] text-slate-500 font-extrabold uppercase block mb-0.5">Pilih Pengawas Ruang</label>
                      <select
                        className="w-full p-2.5 border border-slate-200 rounded-xl text-slate-800 font-bold focus:outline-none focus:border-[#0666AE] bg-white cursor-pointer"
                        value={inputNgawasPengawasId}
                        onChange={(e) => setInputNgawasPengawasId(e.target.value)}
                        required
                      >
                        <option value="">-- Pilih Pengawas --</option>
                        {dbState.pengawas.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.nama} ({p.username})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="col-span-2 sm:col-span-1">
                      <label className="text-[10px] text-slate-500 font-extrabold uppercase block mb-0.5">Mata Pelajaran Ujian</label>
                      <select
                        className="w-full p-2.5 border border-slate-200 rounded-xl text-slate-800 font-bold focus:outline-none focus:border-[#0666AE] bg-white cursor-pointer"
                        value={inputNgawasMapelId}
                        onChange={(e) => setInputNgawasMapelId(e.target.value)}
                        required
                      >
                        <option value="">-- Pilih Mapel --</option>
                        {dbState.mapel.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.nama} ({m.kode})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="col-span-2 sm:col-span-1">
                      <label className="text-[10px] text-slate-500 font-extrabold uppercase block mb-0.5">Ruang CBT Ujian</label>
                      <select
                        className="w-full p-2.5 border border-slate-200 rounded-xl text-slate-800 font-bold focus:outline-none focus:border-[#0666AE] bg-white cursor-pointer"
                        value={inputNgawasRuangId}
                        onChange={(e) => setInputNgawasRuangId(e.target.value)}
                        required
                      >
                        <option value="">-- Pilih Ruang CBT --</option>
                        {dbState.kelas.map((k) => (
                          <option key={k.id} value={k.id}>
                            {k.nama}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="col-span-2 sm:col-span-1">
                      <label className="text-[10px] text-slate-500 font-extrabold uppercase block mb-0.5">Sesi Waktu Jaga</label>
                      <input
                        type="text"
                        className="w-full p-2.5 border border-slate-200 rounded-xl text-slate-800 font-semibold focus:outline-none focus:border-[#0666AE]"
                        placeholder="Ex: Sesi I (07:30 - 09:30)"
                        value={inputNgawasSesi}
                        onChange={(e) => setInputNgawasSesi(e.target.value)}
                        required
                      />
                    </div>

                    <div className="col-span-2 sm:col-span-1">
                      <label className="text-[10px] text-slate-500 font-extrabold uppercase block mb-0.5">Tanggal Tugas</label>
                      <input
                        type="date"
                        className="w-full p-2.5 border border-slate-200 rounded-xl text-slate-800 font-mono focus:outline-none focus:border-[#0666AE]"
                        value={inputNgawasTanggal}
                        onChange={(e) => setInputNgawasTanggal(e.target.value)}
                        required
                      />
                    </div>

                    <div className="col-span-2 flex gap-2">
                      <button
                        type="submit"
                        className="p-2.5 bg-emerald-600 hover:bg-emerald-700 text-white flex-1 rounded-xl font-bold cursor-pointer transition-colors"
                      >
                        {editingNgawasId ? "💾 Simpan Jadwal" : "📅 Jadwalkan Slot Tugas"}
                      </button>
                      {editingNgawasId && (
                        <button
                          type="button"
                          onClick={handleCancelEditJadwalNgawas}
                          className="px-4 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl font-bold cursor-pointer transition-colors"
                        >
                          Batal
                        </button>
                      )}
                    </div>
                  </form>

                  {/* List Plotting */}
                  <div className="max-h-[350px] overflow-y-auto space-y-2 text-xs pr-1 flex-1">
                    {dbState.jadwalNgawas.length === 0 ? (
                      <p className="text-center italic text-slate-400 py-6">Belum ada plotting jadwal pengawas.</p>
                    ) : (
                      dbState.jadwalNgawas.map((jn) => {
                        const mName = dbState.mapel.find((m) => m.id === jn.mapelId)?.nama || "Unknown Mapel";
                        const mCode = dbState.mapel.find((m) => m.id === jn.mapelId)?.kode || "";
                        const rName = dbState.kelas.find((k) => k.id === jn.ruangId)?.nama || "Unknown Ruang";
                        const pName = dbState.pengawas.find((p) => p.id === jn.pengawasId)?.nama || "Unknown Proctor";

                        return (
                          <div
                            key={jn.id}
                            className="p-3.5 bg-white rounded-xl border border-slate-100 flex justify-between items-center shadow-sm hover:border-[#0666AE]/20 transition-all font-sans"
                          >
                            <div className="text-left font-sans flex-1 min-w-0 pr-2">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="px-1.5 py-0.5 bg-emerald-50 text-emerald-800 border border-emerald-100 text-[9px] uppercase font-black rounded font-mono">
                                  {jn.tanggal}
                                </span>
                                <span className="px-1.5 py-0.5 bg-amber-50 text-amber-800 border border-amber-100 text-[9px] uppercase font-black rounded font-mono">
                                  {rName}
                                </span>
                                <span className="px-1.5 py-0.5 bg-indigo-50 text-indigo-800 border border-indigo-100 text-[9px] uppercase font-medium rounded font-sans">
                                  {jn.sesi}
                                </span>
                              </div>
                              <p className="font-extrabold text-slate-800 text-[13px] mt-2">
                                {pName}
                              </p>
                              <p className="text-[11px] text-slate-450 mt-1 font-medium italic text-slate-500">
                                Jaga Ujian: <span className="text-slate-700 font-extrabold">{mName}</span> {mCode && <span className="font-mono text-[9px] bg-slate-100 p-0.5 px-1 rounded">({mCode})</span>}
                              </p>
                            </div>
                            <div className="flex gap-1.5 shrink-0">
                              <button
                                onClick={() => handleEditJadwalNgawasClick(jn)}
                                className="text-slate-400 hover:text-amber-500 p-2 rounded-lg hover:bg-amber-50 transition-colors cursor-pointer"
                                title="Edit Jadwal"
                              >
                                <Edit size={14} />
                              </button>
                              <button
                                onClick={() => handleDeleteJadwalNgawas(jn.id)}
                                className="text-slate-400 hover:text-red-500 p-2 rounded-lg hover:bg-red-50 transition-colors cursor-pointer"
                                title="Hapus Jadwal"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* MENU 6: TOKEN UJIAN */}
          {activeMenu === "tokens" && (
            <motion.div
              key="tokens"
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={{ duration: 0.3 }}
              className="space-y-6 text-left"
            >
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-1 border-b border-slate-200">
                <div className="text-left">
                  <h3 className="text-xs font-black text-slate-550 uppercase tracking-widest text-[#0666AE]">
                    PAPAN MULTI-TOKEN KEUANGAN UJIAN CBT
                  </h3>
                  <p className="text-[10px] text-slate-400 font-semibold leading-tight">Serverless otomatisasi perputaran kode pengunci setiap 10 menit</p>
                </div>
                <button
                  onClick={rotateAllTokens}
                  className="px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 rounded-xl text-xs font-extrabold flex items-center gap-1 cursor-pointer transition-all active:scale-[0.98] shadow-sm"
                >
                  <RotateCw size={13} />
                  <span>Rotasi Paksa Semua</span>
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pt-2">
                {dbState.tokens.length === 0 ? (
                  <div className="p-10 col-span-full text-center bg-slate-50 border border-slate-200 rounded-2xl text-slate-400 font-medium italic">
                    Belum ada jadwal cbt aktif hari ini untuk dipancarkan token autorisasinya.
                  </div>
                ) : (
                  dbState.tokens.map((tok) => (
                    <div
                      key={tok.id}
                      className="p-5 bg-slate-50/50 border border-slate-200 hover:border-[#0666AE]/30 rounded-2xl flex flex-col justify-between space-y-4 transition-all shadow-sm"
                    >
                      <div className="text-left space-y-1">
                        <span className="px-2 py-0.5 rounded-lg bg-[#0666AE]/10 border border-[#0666AE]/15 text-[#0666AE] text-[9px] font-black uppercase font-mono">
                          MAPEL ID: {tok.id}
                        </span>
                        <h4 className="font-extrabold text-slate-800 text-sm">{tok.mapelNama}</h4>
                        {(() => {
                          const matchJadwal = dbState.jadwal.find((j) => j.mapelId === tok.id);
                          const kelasTarget = matchJadwal && matchJadwal.kelasIds.length > 0
                            ? matchJadwal.kelasIds.join(", ")
                            : "Ujian Umum";
                          return (
                            <p className="text-[10px] text-slate-500 font-semibold mt-1">
                              Target Kelas: <span className="font-black text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded">{kelasTarget}</span>
                            </p>
                          );
                        })()}
                      </div>

                      <div className="bg-white border border-slate-100 p-4 rounded-xl flex items-center justify-between shadow-inner">
                        <div>
                          <span className="text-[9px] text-slate-400 block uppercase font-mono font-bold tracking-wider">KODE AKSES TOKEN</span>
                          <span className="text-3xl font-black font-mono text-amber-500 tracking-wider">
                            {tok.token}
                          </span>
                        </div>
                        <button
                          onClick={() => handleManualTokenRotation(tok.id)}
                          className="p-2.5 bg-slate-150 hover:bg-slate-200 text-slate-600 rounded-xl cursor-pointer transition-all shadow-sm hover:scale-102"
                          title="Rotasikan Token Mapel Ini"
                        >
                          <RotateCw size={14} className="text-amber-500" />
                        </button>
                      </div>

                      <div className="text-[10px] text-slate-400 font-bold flex justify-between items-center">
                        <div className="flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                          <span>Sinkron</span>
                        </div>
                        <div className="font-mono text-amber-600 font-black">
                          Sisa: {formatTimeMinutes(secondsRemaining)}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>


            </motion.div>
          )}

          {/* MENU 7: PEMANTAUAN UJIAN (LIVE MONITOR) */}
          {activeMenu === "logmonitor" && (() => {
            // Selected schedule metadata
            const activeJadwalObj = monitorSelectedJadwalId !== "all" 
              ? dbState.jadwal.find((j) => j.id === monitorSelectedJadwalId) 
              : null;

            // 1. Filter by Jadwal / Sesi / Mapel
            const filteredByJadwal = unifiedMonitorList.filter((item) => {
              if (!activeJadwalObj) return true;
              const matchMapel = dbState.mapel.find((m) => m.id === activeJadwalObj.mapelId);
              const targetMapelNama = matchMapel ? matchMapel.nama.toLowerCase() : "";

              const mapelMatch = !item.mapelNama || (targetMapelNama && item.mapelNama.toLowerCase().includes(targetMapelNama));
              let kelasMatch = true;
              if (activeJadwalObj.kelasIds && activeJadwalObj.kelasIds.length > 0) {
                kelasMatch = activeJadwalObj.kelasIds.some(
                  (k) => (item.siswaKelas || "").toLowerCase().includes(k.toLowerCase())
                );
              }
              return mapelMatch || kelasMatch;
            });

            // 2. Filter by Kelas
            const filteredByKelas = filteredByJadwal.filter((item) => {
              if (monitorSelectedKelas === "all") return true;
              return (item.siswaKelas || "").toLowerCase() === monitorSelectedKelas.toLowerCase();
            });

            // Calculate counts for status badges
            const countTotal = filteredByKelas.length;
            const countMengerjakan = filteredByKelas.filter((s) => s.status === "Mengerjakan").length;
            const countSelesai = filteredByKelas.filter((s) => s.status === "Selesai").length;
            const countInfraction = filteredByKelas.filter(
              (s) => (s.pelanggaranCount || 0) > 0 || s.status === "Diskualifikasi"
            ).length;

            // 3. Filter by Status & Search Query
            const displayList = filteredByKelas.filter((item) => {
              if (monitorSelectedStatus === "mengerjakan" && item.status !== "Mengerjakan") return false;
              if (monitorSelectedStatus === "selesai" && item.status !== "Selesai") return false;
              if (monitorSelectedStatus === "infraction" && (item.pelanggaranCount || 0) === 0 && item.status !== "Diskualifikasi") return false;

              if (monitorSearchQuery.trim()) {
                const q = monitorSearchQuery.toLowerCase();
                const matchName = (item.siswaNama || "").toLowerCase().includes(q);
                const matchId = (item.id || "").toLowerCase().includes(q);
                const matchKelas = (item.siswaKelas || "").toLowerCase().includes(q);
                if (!matchName && !matchId && !matchKelas) return false;
              }
              return true;
            });

            return (
              <motion.div
                key="logmonitor"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                transition={{ duration: 0.25 }}
                className="space-y-5 text-left"
              >
                {/* Header Title & Alarm Banner */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-3 border-b border-slate-200">
                  <div>
                    <h3 className="text-xs font-black uppercase tracking-widest text-[#0666AE] flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping"></span>
                      <span>REAL-TIME EXAM MONITORING (SITUASI KEAMANAN DIGITAL)</span>
                    </h3>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Memantau aktivitas ujian siswa aktif dan riwayat siswa yang telah menyelesaikan pengerjaan.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="text-xs flex items-center gap-1.5 text-slate-600 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200 font-bold">
                      <span className="text-[#0666AE]">Toleransi Alarm:</span>
                      <span className="font-mono font-black text-rose-600 bg-rose-50 px-2 py-0.5 rounded-lg text-[10px]">
                        {dbState.konfig.batasPelanggaran} Kali
                      </span>
                    </div>
                  </div>
                </div>

                {/* Filter Controls: Sesi/Jadwal, Ruang/Kelas, & Search */}
                <div className="bg-slate-50/80 p-3.5 sm:p-4 rounded-2xl border border-slate-200 space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {/* Sesi & Jadwal Selector */}
                    <div>
                      <label className="text-[10px] font-extrabold uppercase text-slate-500 block mb-1">
                        Pilih Sesi / Jadwal Ujian:
                      </label>
                      <select
                        value={monitorSelectedJadwalId}
                        onChange={(e) => setMonitorSelectedJadwalId(e.target.value)}
                        className="w-full p-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:border-[#0666AE] cursor-pointer"
                      >
                        <option value="all">Semua Sesi & Mata Pelajaran</option>
                        {dbState.jadwal.map((j) => {
                          const matchMapel = dbState.mapel.find((m) => m.id === j.mapelId);
                          const mapelNama = matchMapel ? matchMapel.nama : "Ujian CBT";
                          return (
                            <option key={j.id} value={j.id}>
                              {j.tanggal} • Sesi {j.sesi || 1} • {mapelNama} ({j.jamMulai} - {j.jamSelesai})
                            </option>
                          );
                        })}
                      </select>
                    </div>

                    {/* Kelas / Ruang Selector */}
                    <div>
                      <label className="text-[10px] font-extrabold uppercase text-slate-500 block mb-1">
                        Filter Kelas / Ruang:
                      </label>
                      <select
                        value={monitorSelectedKelas}
                        onChange={(e) => setMonitorSelectedKelas(e.target.value)}
                        className="w-full p-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:border-[#0666AE] cursor-pointer"
                      >
                        <option value="all">Semua Kelas / Ruang</option>
                        {Array.from(new Set([
                          ...dbState.kelas.map((k) => k.nama),
                          ...dbState.kelasAkademik.map((ka) => ka.nama),
                          ...dbState.siswa.map((s) => s.kelas),
                        ])).filter(Boolean).map((kName) => (
                          <option key={kName} value={kName}>{kName}</option>
                        ))}
                      </select>
                    </div>

                    {/* Quick Search */}
                    <div>
                      <label className="text-[10px] font-extrabold uppercase text-slate-500 block mb-1">
                        Cari Siswa:
                      </label>
                      <div className="relative">
                        <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
                        <input
                          type="text"
                          value={monitorSearchQuery}
                          onChange={(e) => setMonitorSearchQuery(e.target.value)}
                          placeholder="Ketik Nama atau NISN..."
                          className="w-full pl-8 pr-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-[#0666AE] font-medium"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Status Tabs Navigation */}
                  <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-slate-200/70">
                    <button
                      onClick={() => setMonitorSelectedStatus("all")}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                        monitorSelectedStatus === "all"
                          ? "bg-[#0666AE] text-white shadow-sm"
                          : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
                      }`}
                    >
                      <span>Semua Peserta</span>
                      <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                        monitorSelectedStatus === "all" ? "bg-white/20 text-white" : "bg-slate-100 text-slate-700"
                      }`}>
                        {countTotal}
                      </span>
                    </button>

                    <button
                      onClick={() => setMonitorSelectedStatus("mengerjakan")}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                        monitorSelectedStatus === "mengerjakan"
                          ? "bg-sky-600 text-white shadow-sm"
                          : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
                      }`}
                    >
                      <span>Sedang Mengerjakan</span>
                      <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                        monitorSelectedStatus === "mengerjakan" ? "bg-white/20 text-white" : "bg-sky-50 text-sky-700"
                      }`}>
                        {countMengerjakan}
                      </span>
                    </button>

                    <button
                      onClick={() => setMonitorSelectedStatus("selesai")}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                        monitorSelectedStatus === "selesai"
                          ? "bg-emerald-600 text-white shadow-sm"
                          : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
                      }`}
                    >
                      <span>Sudah Selesai</span>
                      <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                        monitorSelectedStatus === "selesai" ? "bg-white/20 text-white" : "bg-emerald-50 text-emerald-700"
                      }`}>
                        {countSelesai}
                      </span>
                    </button>

                    <button
                      onClick={() => setMonitorSelectedStatus("infraction")}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                        monitorSelectedStatus === "infraction"
                          ? "bg-rose-600 text-white shadow-sm"
                          : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
                      }`}
                    >
                      <span>Pelanggaran / Blokir</span>
                      <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                        monitorSelectedStatus === "infraction" ? "bg-white/20 text-white" : "bg-rose-50 text-rose-700"
                      }`}>
                        {countInfraction}
                      </span>
                    </button>
                  </div>
                </div>

                {/* Grid of Student Session Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5 pt-1">
                  {displayList.length === 0 ? (
                    <div className="col-span-full p-12 text-center bg-slate-50 border border-slate-200 rounded-2xl text-slate-500 font-medium space-y-3">
                      <p className="text-sm font-bold text-slate-600">
                        Tidak ada siswa yang cocok dengan filter sesi/status ini.
                      </p>
                      <p className="text-xs text-slate-400">
                        {monitorSelectedJadwalId !== "all" || monitorSelectedStatus !== "all" || monitorSelectedKelas !== "all" || monitorSearchQuery
                          ? "Cobalah untuk mengubah opsi filter sesi jadwal atau reset filter ke Semua."
                          : "Aktivitas pengerjaan siswa akan otomatis muncul secara live di sini saat siswa memulai ujian."}
                      </p>
                      {(monitorSelectedJadwalId !== "all" || monitorSelectedStatus !== "all" || monitorSelectedKelas !== "all" || monitorSearchQuery) && (
                        <button
                          onClick={() => {
                            setMonitorSelectedJadwalId("all");
                            setMonitorSelectedStatus("all");
                            setMonitorSelectedKelas("all");
                            setMonitorSearchQuery("");
                          }}
                          className="px-4 py-2 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl text-xs font-bold text-[#0666AE] transition cursor-pointer shadow-sm"
                        >
                          Reset Semua Filter
                        </button>
                      )}
                    </div>
                  ) : (
                    displayList.map((ses: any) => {
                      const isInfraction = (ses.pelanggaranCount || 0) > 0;
                      const isCompleted = ses.status === "Selesai";
                      const isBlocked = !isCompleted && (ses.status === "Diskualifikasi" || (ses.pelanggaranCount || 0) >= dbState.konfig.batasPelanggaran);

                      return (
                        <div
                          key={ses.id}
                          className={`p-4 sm:p-5 rounded-2xl flex flex-col justify-between space-y-3.5 border transition-all ${
                            isBlocked
                              ? "bg-red-50/80 border-red-200 shadow-[0_4px_15px_rgba(239,68,68,0.06)]"
                              : isCompleted
                              ? "bg-emerald-50/50 border-emerald-200 shadow-sm"
                              : isInfraction
                              ? "bg-amber-50/70 border-amber-300"
                              : "bg-white border-slate-200 shadow-xs"
                          }`}
                        >
                          <div className="text-left space-y-1">
                            <div className="flex justify-between items-center">
                              <span className="font-extrabold text-slate-500 text-[10px] bg-slate-100/90 rounded-md px-2 py-0.5 border border-slate-200">
                                {ses.siswaKelas || "Kelas Siswa"}
                              </span>
                              <span
                                className={`px-2.5 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-wider ${
                                  isBlocked
                                    ? "bg-red-100 text-red-650 border border-red-200"
                                    : isCompleted
                                    ? "bg-emerald-100 text-emerald-800 border border-emerald-250 flex items-center gap-1"
                                    : "bg-sky-100 text-sky-700 border border-sky-200"
                                }`}
                              >
                                {isCompleted && <Check size={10} />}
                                {isBlocked ? "DI-BLOKIR" : isCompleted ? "SELESAI" : ses.status}
                              </span>
                            </div>
                            <h4 className="font-extrabold text-slate-800 text-sm truncate leading-tight pt-1">
                              {ses.siswaNama}
                            </h4>
                            <p className="text-[10px] text-[#0666AE] font-mono italic font-bold">
                              {ses.mapelNama || "Mata Pelajaran Ujian"}
                            </p>
                          </div>

                          {/* Progress & Device Info */}
                          <div className="bg-slate-50/80 border border-slate-200 p-2.5 rounded-xl space-y-1.5 text-left text-[10.5px] font-semibold text-slate-500">
                            <div className="flex justify-between items-center">
                              <span>STATUS PENGERJAAN</span>
                              <span className={`font-bold ${isCompleted ? "text-emerald-700" : "text-slate-800"}`}>
                                {isCompleted
                                  ? "100% Selesai Dikumpulkan"
                                  : `${ses.jawabanTerisi || 0} / ${ses.totalSoal || 0} Soal Dijawab`}
                              </span>
                            </div>

                            {/* Completed Result Badge if available */}
                            {isCompleted && ses.nilai !== undefined && (
                              <div className="flex justify-between items-center pt-1 border-t border-slate-200/80">
                                <span>HASIL & SKOR</span>
                                <span className="font-mono font-black text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-md text-[10px]">
                                  Nilai: {ses.nilai} {ses.benar !== undefined && `(${ses.benar}B / ${ses.salah}S)`}
                                </span>
                              </div>
                            )}

                            {ses.waktuSelesai && (
                              <div className="flex justify-between items-center text-[9.5px] text-slate-400 font-mono">
                                <span>WAKTU PENGUMPULAN</span>
                                <span className="font-bold text-slate-600">{ses.waktuSelesai}</span>
                              </div>
                            )}

                            <div className="flex justify-between items-center text-[9.5px] text-slate-400 font-mono">
                              <span>KODE PERANGKAT</span>
                              <span className="text-slate-600">{ses.deviceId || "MOBILE-DEVICE"}</span>
                            </div>
                          </div>

                          {/* Anti-cheat alarm info */}
                          <div className="space-y-1 text-left">
                            <div className="flex justify-between items-center text-[10px] font-extrabold text-slate-500 uppercase">
                              <span>INTEGRITAS (ALARM)</span>
                              <span
                                className={`font-mono font-black ${
                                  isBlocked ? "text-red-600" : isInfraction ? "text-amber-600" : "text-emerald-600"
                                }`}
                              >
                                {ses.pelanggaranCount || 0} / {dbState.konfig.batasPelanggaran} Pelanggaran
                              </span>
                            </div>
                            <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
                              <div
                                className={`h-full ${
                                  isBlocked
                                    ? "bg-red-500"
                                    : isInfraction
                                    ? "bg-amber-500"
                                    : "bg-emerald-500"
                                }`}
                                style={{
                                  width: `${Math.min(
                                    ((ses.pelanggaranCount || 0) / dbState.konfig.batasPelanggaran) * 100,
                                    100
                                  )}%`,
                                }}
                              ></div>
                            </div>

                            {isInfraction && ses.pelanggaranLogs && ses.pelanggaranLogs.length > 0 && (
                              <div className="mt-2 text-[9px] bg-white p-2 border border-rose-100 rounded-xl text-red-600 font-mono space-y-1 max-h-[60px] overflow-y-auto leading-tight shadow-sm font-semibold">
                                {ses.pelanggaranLogs.map((log: any, lIdx: number) => (
                                  <p key={lIdx}>
                                    [🔒] {log.tipe}: {log.keterangan}
                                  </p>
                                ))}
                              </div>
                            )}
                          </div>

                          {/* Action Buttons */}
                          <div className="pt-2 border-t border-slate-100 flex flex-wrap gap-2 text-[10px] font-bold">
                            {isBlocked && (
                              <button
                                onClick={() => handleClearSiswaViolations(ses.id)}
                                className="flex-1 min-w-[110px] p-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl flex items-center justify-center gap-1 cursor-pointer transition shadow-xs active:scale-95"
                                title="Buka blokir dan lanjutkan ujian siswa"
                              >
                                <ShieldCheck size={12} />
                                <span>Buka Blokir</span>
                              </button>
                            )}

                            {!isCompleted ? (
                              <button
                                onClick={() => handleForceSubmitSession(ses)}
                                className="flex-1 min-w-[110px] p-2 bg-indigo-600 hover:bg-indigo-700 text-white text-center rounded-xl transition cursor-pointer font-bold shadow-xs active:scale-95"
                                title="Hentikan & selesaikan ujian siswa sekarang serta rekap nilainya"
                              >
                                Submit Paksa
                              </button>
                            ) : (
                              <span className="flex-1 min-w-[110px] p-2 bg-emerald-100 text-emerald-800 text-center rounded-xl font-bold flex items-center justify-center gap-1">
                                <Check size={12} />
                                Sudah Selesai
                              </span>
                            )}

                            <button
                              onClick={() => handleResetSession(ses)}
                              className="flex-1 min-w-[100px] p-2 bg-slate-100 hover:bg-rose-100 text-slate-700 hover:text-rose-700 rounded-xl transition cursor-pointer text-center font-bold active:scale-95"
                              title="Hapus sesi & nilai agar siswa langsung ulangi dari awal"
                            >
                              Reset Sesi
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </motion.div>
            );
          })()}

          {/* MENU 8: REKAP NILAI */}
          {activeMenu === "nilai" && (() => {
            const filteredAdminHasil = getFilteredAdminHasil();
            const availableClassNames = Array.from(
              new Set([
                ...dbState.kelasAkademik.map((ka) => ka.nama),
                ...dbState.hasil.map((h: any) => h.siswaKelas).filter(Boolean),
              ])
            ).sort();
            const allFilteredSelected =
              filteredAdminHasil.length > 0 &&
              filteredAdminHasil.every((h: any) => selectedHasilIds.includes(h.id));

            return (
              <motion.div
                key="nilai"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                transition={{ duration: 0.25 }}
                className="space-y-6 text-left"
              >
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-2 border-b border-slate-200">
                  <div>
                    <h3 className="text-xs font-black text-slate-550 uppercase tracking-widest text-[#0666AE]">
                      REKAP KELULUSAN & NILAI HASIL CBT DIGITAL
                    </h3>
                    <p className="text-[11px] text-slate-400 font-medium mt-0.5">
                      Menampilkan <strong className="text-[#0666AE]">{filteredAdminHasil.length}</strong> dari {dbState.hasil.length} total nilai
                    </p>
                  </div>
                  {dbState.hasil.length > 0 && (
                    <button
                      onClick={handleDownloadExcel}
                      className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black rounded-xl flex items-center gap-1.5 cursor-pointer transition-all shadow"
                    >
                      <FileSpreadsheet size={15} />
                      <span>Download Nilai Excel ({filteredAdminHasil.length})</span>
                    </button>
                  )}
                </div>

                {/* Filter Panel: Pencarian, Mapel, & Kelas/Angkatan */}
                {dbState.hasil.length > 0 && (
                  <div className="bg-slate-50/80 p-3.5 rounded-2xl border border-slate-200 grid grid-cols-1 md:grid-cols-4 gap-3 text-xs">
                    <div className="space-y-1">
                      <label className="text-[10px] font-extrabold text-slate-500 uppercase block">
                        Cari Siswa
                      </label>
                      <div className="relative">
                        <Search size={13} className="absolute left-2.5 top-2.5 text-slate-400" />
                        <input
                          type="text"
                          value={nilaiSearch}
                          onChange={(e) => setNilaiSearch(e.target.value)}
                          placeholder="Nama siswa / kelas..."
                          className="w-full pl-8 pr-2.5 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-[#0666AE]"
                        />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-extrabold text-slate-500 uppercase block">
                        Filter Mata Pelajaran
                      </label>
                      <select
                        value={nilaiFilterMapel}
                        onChange={(e) => setNilaiFilterMapel(e.target.value)}
                        className="w-full p-2 bg-white border border-slate-200 rounded-xl font-bold text-[#0666AE] focus:outline-none cursor-pointer"
                      >
                        <option value="">-- Semua Mata Pelajaran --</option>
                        {dbState.mapel.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.nama}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-extrabold text-slate-500 uppercase block">
                        Filter Kelas / Angkatan
                      </label>
                      <select
                        value={nilaiFilterKelas}
                        onChange={(e) => setNilaiFilterKelas(e.target.value)}
                        className="w-full p-2 bg-white border border-slate-200 rounded-xl font-bold text-[#0666AE] focus:outline-none cursor-pointer"
                      >
                        <option value="">-- Semua Kelas & Angkatan --</option>
                        <option value="grade:VII">Angkatan / Kelas VII (Semua)</option>
                        <option value="grade:VIII">Angkatan / Kelas VIII (Semua)</option>
                        <option value="grade:IX">Angkatan / Kelas IX (Semua)</option>
                        {availableClassNames.map((kelasNama) => (
                          <option key={kelasNama} value={kelasNama}>
                            {kelasNama}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="flex items-end">
                      {(nilaiFilterMapel || nilaiFilterKelas || nilaiSearch) ? (
                        <button
                          type="button"
                          onClick={() => {
                            setNilaiFilterMapel("");
                            setNilaiFilterKelas("");
                            setNilaiSearch("");
                          }}
                          className="w-full py-2 px-3 bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 rounded-xl font-extrabold uppercase text-[10px] cursor-pointer transition"
                        >
                          Reset Filter
                        </button>
                      ) : (
                        <div className="w-full py-2 px-3 bg-white border border-slate-200 rounded-xl text-[10px] text-slate-400 font-bold text-center">
                          Excel mengikuti filter aktif
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Action Purging Command Bar */}
                {dbState.hasil.length > 0 && (
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-rose-50/30 p-4 rounded-2xl border border-rose-150/50 shadow-inner">
                    <div className="text-xs font-semibold text-slate-800 text-left">
                      <p className="font-extrabold text-rose-600 flex items-center gap-1">
                        <ShieldAlert size={14} />
                        Panel Penghapusan Hasil Ujian (Akses Admin):
                      </p>
                      <p className="text-slate-500 font-medium font-sans">
                        Pilih dari tabel di bawah, lalu hapus sebagian atau hapus permanen seluruh riwayat nilai di server.
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2 text-xs">
                      {selectedHasilIds.length > 0 && (
                        <button
                          onClick={handleDeleteSelectedHasil}
                          className="px-4 py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-black rounded-xl transition duration-150 flex items-center gap-1.5 cursor-pointer shadow-sm"
                        >
                          <Trash2 size={13} />
                          Hapus Terpilih ({selectedHasilIds.length})
                        </button>
                      )}
                      <button
                        onClick={handleDeleteAllHasil}
                        className="px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-black rounded-xl transition duration-150 flex items-center gap-1.5 cursor-pointer shadow-sm"
                      >
                        <Trash size={13} />
                        Kosongkan Seluruh Hasil (Massal)
                      </button>
                    </div>
                  </div>
                )}

                <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left text-slate-600">
                      <thead className="bg-[#0666AE]/5 border-b border-slate-200 text-slate-700 uppercase text-[10px] font-sans font-extrabold tracking-wider">
                        <tr>
                          <th className="p-3 text-center w-12">
                            <input
                              type="checkbox"
                              checked={allFilteredSelected}
                              onChange={(e) => {
                                const visibleIds = filteredAdminHasil.map((h: any) => h.id);
                                if (e.target.checked) {
                                  setSelectedHasilIds(Array.from(new Set([...selectedHasilIds, ...visibleIds])));
                                } else {
                                  setSelectedHasilIds(selectedHasilIds.filter((id) => !visibleIds.includes(id)));
                                }
                              }}
                              className="rounded text-[#0666AE] focus:ring-0 cursor-pointer w-4 h-4"
                            />
                          </th>
                          <th className="p-3 text-center">No</th>
                          <th className="p-3">Nama Siswa</th>
                          <th className="p-3 text-center">Kelas</th>
                          <th className="p-3">Mata Pelajaran</th>
                          <th className="p-3 text-center">Benar</th>
                          <th className="p-3 text-center">Salah</th>
                          <th className="p-3 text-center">Nilai Final</th>
                          <th className="p-3 text-center">Kejujuran Sesi</th>
                          <th className="p-3 text-center">Skema KKM</th>
                          <th className="p-3 text-center w-16">Aksi</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {filteredAdminHasil.length === 0 ? (
                          <tr>
                            <td colSpan={11} className="p-10 text-center italic text-slate-400 font-medium">
                              {dbState.hasil.length === 0
                                ? "Belum ada lembar jawaban dikumpulkan. Selesaikan tes pada aplikasi siswa untuk mensinkronkan nilai."
                                : "Tidak ada data nilai ujian yang sesuai dengan filter mapel / kelas / angkatan."}
                            </td>
                          </tr>
                        ) : (
                          filteredAdminHasil.map((res: HasilUjian, i: number) => {
                            const isLulus = res.nilai >= 75;
                            const hasSelected = selectedHasilIds.includes(res.id);
                            return (
                              <tr key={res.id} className="hover:bg-slate-50/50 transition-colors border-b border-slate-100 last:border-0">
                                <td className="p-3 text-center">
                                  <input
                                    type="checkbox"
                                    checked={hasSelected}
                                    onChange={() => {
                                      if (hasSelected) {
                                        setSelectedHasilIds(selectedHasilIds.filter((id) => id !== res.id));
                                      } else {
                                        setSelectedHasilIds([...selectedHasilIds, res.id]);
                                      }
                                    }}
                                    className="rounded text-[#0666AE] focus:ring-0 cursor-pointer w-4 h-4"
                                  />
                                </td>
                                <td className="p-3 text-center font-mono text-slate-400 font-extrabold">{i + 1}</td>
                                <td className="p-3 font-extrabold text-slate-800">{res.siswaNama}</td>
                                <td className="p-3 text-center font-bold text-slate-500">{res.siswaKelas}</td>
                                <td className="p-3 font-bold text-[#0666AE]">{res.mapelNama}</td>
                                <td className="p-3 text-center text-emerald-600 font-mono font-bold">{res.benar}</td>
                                <td className="p-3 text-center text-red-500 font-mono font-bold">{res.salah}</td>
                                <td className="p-3 text-center font-bold text-lg font-mono text-[#0666AE]">
                                  {res.nilai}
                                </td>
                                <td className="p-3 text-center">
                                  <span className={`px-2 py-0.5 rounded-lg text-[9px] font-extrabold uppercase ${
                                    res.status === "Diskualifikasi" ? "bg-red-50 text-red-600 border border-red-200" : "bg-emerald-50 text-emerald-600 border border-emerald-100"
                                  }`}>
                                    {res.status}
                                  </span>
                                </td>
                                <td className="p-3 text-center">
                                  <span className={`px-1.5 py-0.5 rounded-lg font-extrabold text-[9px] ${
                                    isLulus ? "bg-emerald-50 text-emerald-600 border border-emerald-200" : "bg-amber-50 text-amber-700 border border-amber-200"
                                  }`}>
                                    {isLulus ? "LULUS" : "REMIDI"}
                                  </span>
                                </td>
                                <td className="p-3 text-center">
                                  <button
                                    onClick={() => handleDeleteSingleHasil(res.id)}
                                    className="text-slate-400 hover:text-red-600 cursor-pointer p-1.5 rounded-lg hover:bg-red-50 transition-colors"
                                    title="Hapus Nilai"
                                  >
                                    <Trash2 size={13} />
                                  </button>
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </motion.div>
            );
          })()}

          {/* MENU 9: CETAK */}
          {activeMenu === "cetak" && (
            <motion.div
              key="cetak"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.25 }}
              className="space-y-6 text-left"
            >
              <h3 className="text-xs font-black text-slate-550 uppercase tracking-widest text-[#0666AE] pb-1 border-b border-slate-200">
                KARTU PESERTA & PROTOKOL BERITA ACARA
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="p-5 bg-slate-50 border border-slate-200 rounded-2xl space-y-4 flex flex-col justify-between shadow-sm">
                  <div>
                    <h4 className="text-sm font-extrabold text-slate-800">1. KARTU UJIAN SISWA (DILENGKAPI QR CODES)</h4>
                    <p className="text-xs text-slate-500 leading-relaxed mt-2 font-medium">
                      Mengenerate ID Card resmi berstempel dan berlogo madrasah secara nirlaba bagi seluruh pendaftar. Kartu ujian mendukung pendeteksian scan QR cepat pada kamera HP siswa untuk bypass sandi otentikasi login secara langsung.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowPrintCards(true)}
                    className="w-full p-2.5 bg-[#0666AE] hover:bg-[#0666AE]/95 text-white rounded-xl text-xs font-black uppercase transition shadow-sm flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Printer size={15} />
                    <span>Cetak Kartu Ujian QR</span>
                  </button>
                </div>

                <div className="p-5 bg-slate-50 border border-slate-200 rounded-2xl space-y-4 flex flex-col justify-between shadow-sm">
                  <div>
                    <h4 className="text-sm font-extrabold text-slate-800">2. TEMPLATE BERITA ACARA & DAFTAR HADIR</h4>
                    <p className="text-xs text-slate-500 leading-relaxed mt-2 font-medium">
                      Mencetak Berita Acara yang memuat data administrasi madrasah kepala sekolah, stempel resmi, kolom deklarasi pengawas dwan guru, serta lembar absensi tandatangan murid yang diuji.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowPrintBeritaAcara(true)}
                    className="w-full p-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black uppercase transition shadow-sm flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Printer size={15} />
                    <span>Cetak Berita Acara & Hadir</span>
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {/* MENU 10: KONFIGURASI */}
          {activeMenu === "config" && (
            <motion.div
              key="config"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.25 }}
              className="space-y-6 text-left"
            >
              <h3 className="text-xs font-black text-slate-550 uppercase tracking-widest text-[#0666AE] pb-1 border-b border-slate-200">
                PROFIL MADRASAH & ATURAN INTENSITAS KEAMANAN CBT
              </h3>

              <form onSubmit={handleSaveKonfig} className="bg-slate-50 p-6 rounded-2xl border border-slate-200 space-y-5 text-xs shadow-sm shadow-slate-100">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] text-slate-500 font-extrabold block">NAMA LEMBAGA SEKOLAH / MADRASAH</label>
                    <input
                      type="text"
                      className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-slate-800 font-bold"
                      value={configNama}
                      onChange={(e) => setConfigNama(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] text-slate-500 font-extrabold block">KODE REGISTRASI CBT (IMMUTABLE)</label>
                    <input
                      type="text"
                      disabled
                      className="w-full p-2.5 bg-slate-100 border border-slate-200 rounded-xl text-slate-400 font-mono font-bold"
                      value={dbState.konfig.kodeRegistrasi}
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] text-slate-500 font-extrabold block">ALAMAT MANDATARY SEKOLAH</label>
                  <input
                    type="text"
                    className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-slate-800 font-semibold"
                    value={configAlamat}
                    onChange={(e) => setConfigAlamat(e.target.value)}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] text-slate-500 font-extrabold block">NAMA KEPALA MADRASAH (KEPSEK)</label>
                    <input
                      type="text"
                      className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-slate-800 font-bold"
                      value={configKepsek}
                      onChange={(e) => setConfigKepsek(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] text-slate-500 font-extrabold block">NIP KEPALA MADRASAH</label>
                    <input
                      type="text"
                      className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-slate-800 font-mono"
                      value={configNip}
                      onChange={(e) => setConfigNip(e.target.value)}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 border-t border-slate-200/80 pt-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] text-slate-500 font-extrabold block">ZONA WAKTU CBT</label>
                    <select
                      className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-slate-705 font-bold cursor-pointer"
                      value={configTz}
                      onChange={(e) => setConfigTz(e.target.value as any)}
                    >
                      <option value="WIB">WIB (GMT+7)</option>
                      <option value="WITA">WITA (GMT+8)</option>
                      <option value="WIT">WIT (GMT+9)</option>
                    </select>
                  </div>

                  <div className="space-y-1.5 col-span-2">
                    <label className="text-[10px] text-slate-500 font-extrabold block">
                      BATAS ALARM KEKELIRUAN MULTI-TAB (MAKSIMAL BLUR)
                    </label>
                    <input
                      type="number"
                      className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-red-600 font-black"
                      value={configLimit}
                      min={1}
                      max={10}
                      onChange={(e) => setConfigLimit(Number(e.target.value))}
                    />
                    <span className="text-[9.5px] text-slate-400 block font-semibold leading-tight pt-0.5">
                      Siswa otomatis di-diskualifikasi permanen oleh kernel dharat jika memindah tab/blur-frame sebanyak nilai ini (Default: 3)
                    </span>
                  </div>
                </div>

                <div className="p-4 bg-white rounded-2xl border border-slate-150 space-y-4 shadow-inner">
                  <p className="font-bold text-slate-500 uppercase text-[10px]">Madrasah Branding Assets (Unggah Berkas Logo & Atribut Utama)</p>
                  <p className="text-[10px] text-slate-400">Pilih berkas gambar untuk mengunggah logo atau tanda tangan secara langsung. Berkas akan terekam ke database lokal portal Anda.</p>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                    {/* LOGO KIRI */}
                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-center flex flex-col justify-between space-y-3">
                      <div>
                        <p className="font-bold text-slate-600 text-[10px] uppercase">Logo Kiri (Kemenag)</p>
                        <div className="h-16 flex items-center justify-center bg-white rounded-lg p-2 border border-slate-100 shadow-inner mb-2 mt-1">
                          <img src={simLogoKiri} className="max-h-full max-w-full object-contain rounded" alt="Logo Kiri" referrerPolicy="no-referrer" />
                        </div>
                      </div>
                      <label className="block">
                        <input
                          type="file"
                          accept="image/*"
                          className="block w-full text-[9px] text-slate-500
                            file:mr-2 file:py-1 file:px-2
                            file:rounded-lg file:border-0
                            file:text-[9.5px] file:font-semibold
                            file:bg-[#0666AE]/10 file:text-[#0666AE]
                            hover:file:bg-[#0666AE]/15 cursor-pointer"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              const reader = new FileReader();
                              reader.onload = (evt) => {
                                if (evt.target?.result) setSimLogoKiri(evt.target.result as string);
                              };
                              reader.readAsDataURL(file);
                            }
                          }}
                        />
                      </label>
                    </div>

                    {/* LOGO KANAN */}
                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-center flex flex-col justify-between space-y-3">
                      <div>
                        <p className="font-bold text-slate-600 text-[10px] uppercase">Logo Kanan (Madrasah)</p>
                        <div className="h-16 flex items-center justify-center bg-white rounded-lg p-2 border border-slate-100 shadow-inner mb-2 mt-1">
                          <img src={simLogoKanan} className="max-h-full max-w-full object-contain rounded" alt="Logo Kanan" referrerPolicy="no-referrer" />
                        </div>
                      </div>
                      <label className="block">
                        <input
                          type="file"
                          accept="image/*"
                          className="block w-full text-[9px] text-slate-500
                            file:mr-2 file:py-1 file:px-2
                            file:rounded-lg file:border-0
                            file:text-[9.5px] file:font-semibold
                            file:bg-[#0666AE]/10 file:text-[#0666AE]
                            hover:file:bg-[#0666AE]/15 cursor-pointer"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              const reader = new FileReader();
                              reader.onload = (evt) => {
                                if (evt.target?.result) setSimLogoKanan(evt.target.result as string);
                              };
                              reader.readAsDataURL(file);
                            }
                          }}
                        />
                      </label>
                    </div>

                    {/* UNIFIED STEMPEL & TTD PARAFF */}
                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-center flex flex-col justify-between space-y-3 col-span-1 sm:col-span-2">
                      <p className="font-bold text-slate-700 text-[10px] uppercase border-b border-slate-200 pb-1.5">Atribut Legalisasi Sekolah (Stempel & Paraf TTD)</p>
                      
                      <div className="grid grid-cols-2 gap-3">
                        {/* Stempel Kertas */}
                        <div className="flex flex-col justify-between h-full space-y-2">
                          <p className="font-bold text-slate-550 text-[8.5px] uppercase">1. Stempel Sekolah</p>
                          <div className="h-16 flex items-center justify-center bg-white rounded-lg p-2 border border-slate-100 shadow-inner mb-2 mt-1">
                            <img src={simStempel} className="max-h-full max-w-full object-contain" alt="Stempel" referrerPolicy="no-referrer" />
                          </div>
                          <label className="block">
                            <input
                              type="file"
                              accept="image/*"
                              className="block w-full text-[8px] text-slate-500
                                file:mr-1 file:py-1 file:px-2
                                file:rounded-md file:border-0
                                file:text-[8px] file:font-semibold
                                file:bg-[#0666AE]/10 file:text-[#0666AE]
                                hover:file:bg-[#0666AE]/15 cursor-pointer"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) {
                                  const reader = new FileReader();
                                  reader.onload = (evt) => {
                                    if (evt.target?.result) setSimStempel(evt.target.result as string);
                                  };
                                  reader.readAsDataURL(file);
                                }
                              }}
                            />
                          </label>
                        </div>

                        {/* Paraf TTD Kepsek */}
                        <div className="flex flex-col justify-between h-full space-y-2">
                          <p className="font-bold text-slate-550 text-[8.5px] uppercase">2. Paraf TTD Kepsek</p>
                          <div className="h-16 flex items-center justify-center bg-white rounded-lg p-2 border border-slate-100 shadow-inner mb-2 mt-1">
                            <img src={simTtd} className="max-h-full max-w-full object-contain" alt="TTD Paraf" referrerPolicy="no-referrer" />
                          </div>
                          <label className="block">
                            <input
                              type="file"
                              accept="image/*"
                              className="block w-full text-[8px] text-slate-500
                                file:mr-1 file:py-1 file:px-2
                                file:rounded-md file:border-0
                                file:text-[8px] file:font-semibold
                                file:bg-[#0666AE]/10 file:text-[#0666AE]
                                hover:file:bg-[#0666AE]/15 cursor-pointer"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) {
                                  const reader = new FileReader();
                                  reader.onload = (evt) => {
                                    if (evt.target?.result) setSimTtd(evt.target.result as string);
                                  };
                                  reader.readAsDataURL(file);
                                }
                              }}
                            />
                          </label>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-extrabold uppercase transition text-sm cursor-pointer shadow hover:shadow-md"
                >
                  Simpan Konfigurasi & Sync Aturan
                </button>
              </form>

              {/* DB Cloud Management & Backup/Restore */}
              <div className="bg-white p-6 rounded-2xl border border-slate-200 space-y-5 text-xs mt-6 shadow-sm">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 pb-3 border-b border-slate-200">
                  <div className="flex items-center gap-2">
                    <Database size={18} className="text-[#0666AE]" />
                    <div>
                      <h4 className="text-xs font-black text-slate-800 uppercase tracking-widest">
                        Pusat Keamanan & Pencadangan Basis Data
                      </h4>
                      <p className="text-[10px] text-slate-500 font-medium">
                        {getBackendProvider() === "supabase"
                          ? "Supabase PostgreSQL Terhubung & Aktif (Mode Hemat 350+ Siswa)"
                          : "Menunggu Konfigurasi Secrets Supabase (Mode Baca Backup Aktif)"}
                      </p>
                    </div>
                  </div>
                  <span
                    className={`px-2.5 py-1 rounded-full font-black text-[10px] flex items-center gap-1.5 border ${
                      getBackendProvider() === "supabase"
                        ? "bg-emerald-100 text-emerald-800 border-emerald-250"
                        : "bg-amber-100 text-amber-800 border-amber-200"
                    }`}
                  >
                    <span
                      className={`w-2 h-2 rounded-full ${
                        getBackendProvider() === "supabase" ? "bg-emerald-600 animate-ping" : "bg-amber-600"
                      }`}
                    ></span>
                    <span>
                      {getBackendProvider() === "supabase" ? "Supabase DB: ONLINE" : "Menunggu Secrets Supabase"}
                    </span>
                  </span>
                </div>

                {/* Cloud Status Detail */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200/80 text-[10px] font-mono">
                  <div>
                    <span className="text-slate-400 block font-sans font-bold">PROVIDER DATABASE</span>
                    <span className="font-bold text-slate-800">
                      {getBackendProvider() === "supabase" ? "Supabase PostgreSQL" : "Belum Terhubung (Fallback Baca)"}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block font-sans font-bold">KEAMANAN API</span>
                    <span className="font-bold text-emerald-700">✓ RLS + SERVER PROXY (/api/db)</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block font-sans font-bold">SINKRONISASI</span>
                    <span className="font-bold text-[#0666AE]">OPTIMASI 350+ SISWA (AKTIF)</span>
                  </div>
                </div>

                {/* Backup & Restore Tools */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                  {/* Backup Card */}
                  <div className="p-4 bg-emerald-50/50 border border-emerald-200 rounded-xl space-y-2 text-left">
                    <h5 className="font-black text-emerald-800 uppercase text-[11px] flex items-center gap-1.5">
                      <Download size={14} className="text-emerald-600" />
                      Cadangkan Database (Backup JSON)
                    </h5>
                    <p className="text-[10px] text-slate-600 font-medium leading-relaxed">
                      Unduh seluruh data CBT (Bank Soal, Siswa, Guru, Pengawas, Jadwal, dan Pengaturan) ke komputer Anda sebagai arsip aman sebelum ujian dimulai.
                    </p>
                    <button
                      type="button"
                      onClick={handleExportBackupJSON}
                      className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-xs flex items-center justify-center gap-1.5 transition shadow-sm cursor-pointer"
                    >
                      <Download size={13} />
                      <span>Unduh File Cadangan (.JSON)</span>
                    </button>
                  </div>

                  {/* Restore Card */}
                  <div className="p-4 bg-blue-50/50 border border-blue-200 rounded-xl space-y-2 text-left">
                    <h5 className="font-black text-blue-800 uppercase text-[11px] flex items-center gap-1.5">
                      <Upload size={14} className="text-blue-600" />
                      Pulihkan Database (Restore JSON)
                    </h5>
                    <p className="text-[10px] text-slate-600 font-medium leading-relaxed">
                      Pilih file cadangan JSON yang telah diunduh sebelumnya untuk memulihkan seluruh data dan menyinkronkannya kembali ke Cloud Firestore.
                    </p>
                    <label className="w-full py-2 bg-[#0666AE] hover:bg-[#0666AE]/90 text-white rounded-lg font-bold text-xs flex items-center justify-center gap-1.5 transition shadow-sm cursor-pointer block text-center">
                      <Upload size={13} />
                      <span>Pilih File Pulihkan (.JSON)</span>
                      <input
                        type="file"
                        accept=".json"
                        className="hidden"
                        onChange={handleRestoreBackupJSON}
                      />
                    </label>
                  </div>
                </div>

                {/* Seeding with safety warning */}
                <div className="pt-3 border-t border-slate-200">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                    <div>
                      <span className="font-bold text-slate-700 text-[11px] block">Inisialisasi Data Bawaan (Factory Demo)</span>
                      <span className="text-[10px] text-slate-400">Gunakan hanya untuk uji coba pertama kali bila database benar-benar kosong.</span>
                    </div>
                    {seedSuccess ? (
                      <span className="text-emerald-700 font-bold text-xs">✓ Data demo berhasil dimuat!</span>
                    ) : (
                      <button
                        type="button"
                        onClick={handleConfigureFirebaseSeeding}
                        disabled={isSeeding}
                        className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold rounded-lg text-[10px] transition cursor-pointer flex items-center gap-1 disabled:opacity-50"
                      >
                        <RotateCw size={11} className={isSeeding ? "animate-spin" : ""} />
                        <span>Reset ke Data Demo Bawaan</span>
                      </button>
                    )}
                  </div>
                  {seedError && (
                    <p className="text-[10px] text-rose-600 mt-1 font-bold">Gagal reset: {seedError}</p>
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {/* MENU 11: INFORMASI LISENSI */}
          {activeMenu === "lisensi" && (
            <motion.div
              key="lisensi"
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={{ duration: 0.25 }}
              className="space-y-6 text-left"
            >
              <h3 className="text-xs font-black text-slate-550 uppercase tracking-widest pb-1 border-b border-slate-200 text-slate-500">
                INFORMASI LISENSI DIGITAL CBT MTs. AL-MA'SUM II CMC
              </h3>

              <div className="p-6 bg-slate-50 border border-slate-200 rounded-2xl flex flex-col md:flex-row gap-6 items-center shadow-sm">
                <div className="w-16 h-16 rounded-full bg-emerald-100 border border-emerald-300 text-emerald-600 flex items-center justify-center shrink-0 shadow-inner">
                  <ShieldCheck size={36} />
                </div>
                <div className="space-y-1.5 flex-1 text-xs">
                  <h4 className="text-base font-extrabold text-[#0666AE] tracking-tight">CBT MTs. AL-MA'SUM II CMC LICENSE - VERIFIED</h4>
                  <p className="text-slate-500 font-semibold leading-relaxed">
                    Aplikasi CBT terikat lisensi paten berstempel resmi kementerian untuk institusi: <strong>MTs. Al-Ma'sum II Cimuncang</strong>.
                  </p>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3.5 pt-4 text-[10px] text-slate-400 font-mono uppercase bg-white p-3.5 rounded-xl border border-slate-200/60 shadow-inner font-bold">
                    <div>
                      <span>Tipe Registrasi</span>
                      <span className="font-extrabold text-emerald-600 block mt-0.5">MANDIRI PERPETUAL PREMIUM</span>
                    </div>
                    <div>
                      <span>Serial ID Lisensi</span>
                      <span className="font-extrabold text-slate-800 block mt-0.5">CBT-MTS-ALMASUM2-2026</span>
                    </div>
                    <div>
                      <span>Tenggat Paket Dukungan</span>
                      <span className="font-extrabold text-amber-600 block mt-0.5">SELAMANYA (SPRT 2030)</span>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* PRINT DIALOG CARD LIGHTWEIGHT VIEWER */}
      {showPrintCards && (
        <PrintCards
          siswaList={dbState.siswa}
          kelasList={dbState.kelas}
          kelasAkademikList={dbState.kelasAkademik}
          konfig={dbState.konfig}
          onClose={() => setShowPrintCards(false)}
        />
      )}

      {showPrintBeritaAcara && (
        <PrintBeritaAcara
          konfig={dbState.konfig}
          mapelList={dbState.mapel}
          kelasList={dbState.kelas}
          kelasAkademikList={dbState.kelasAkademik}
          pengawasList={dbState.pengawas}
          siswaList={dbState.siswa}
          onClose={() => setShowPrintBeritaAcara(false)}
        />
      )}

      {/* EXCEL IMPORT MODALS */}
      {showImportExcelSiswaModal && (
        <ImportSiswaModal
          existingSiswa={dbState.siswa}
          kelasList={dbState.kelas}
          kelasAkademikList={dbState.kelasAkademik}
          onClose={() => setShowImportExcelSiswaModal(false)}
          onSave={(newSiswaItems) => {
            const merged = [...getDB.siswa(), ...newSiswaItems];
            setDB.siswa(merged);
            showToast(`${newSiswaItems.length} siswa berhasil diimpor & tersimpan realtime!`);
          }}
        />
      )}

      {showImportExcelMapelModal && (
        <ImportMapelModal
          existingMapel={dbState.mapel}
          onClose={() => setShowImportExcelMapelModal(false)}
          onSave={(newMapelItems) => {
            const merged = [...getDB.mapel(), ...newMapelItems];
            setDB.mapel(merged);
            showToast(`${newMapelItems.length} mata pelajaran berhasil diimpor & tersimpan realtime!`);
          }}
        />
      )}

      {showImportExcelGuruModal && (
        <ImportGuruModal
          existingGuru={dbState.guru}
          mapelList={dbState.mapel}
          kelasAkademikList={dbState.kelasAkademik}
          onClose={() => setShowImportExcelGuruModal(false)}
          onSave={(newGuruItems) => {
            const merged = [...getDB.guru(), ...newGuruItems];
            setDB.guru(merged);
            showToast(`${newGuruItems.length} guru berhasil diimpor & tersimpan realtime!`);
          }}
        />
      )}

      {/* MODAL LEBAR 2-PANEL: ATUR PLOTTING MAPEL & KELAS GURU */}
      {guruPlotModalTarget && (() => {
        const filteredModalMapels = dbState.mapel.filter((m) => {
          if (!modalPlotSearchMapel.trim()) return true;
          const q = modalPlotSearchMapel.toLowerCase();
          return m.nama.toLowerCase().includes(q) || m.kode.toLowerCase().includes(q);
        });
        const selectedEntry = modalPlotMapelKelas.find((mk) => mk.mapelId === modalPlotActiveMapelId);
        const selectedMapelObj = dbState.mapel.find((m) => m.id === modalPlotActiveMapelId);

        const toggleModalMapel = (mId: string) => {
          const exists = modalPlotMapelKelas.some((mk) => mk.mapelId === mId);
          if (exists) {
            setModalPlotMapelKelas((prev) => prev.filter((mk) => mk.mapelId !== mId));
          } else {
            setModalPlotMapelKelas((prev) => [...prev, { mapelId: mId, kelasIds: [] }]);
          }
          setModalPlotActiveMapelId(mId);
        };

        const toggleModalKelas = (mId: string, kId: string) => {
          setModalPlotMapelKelas((prev) => {
            const hasMapel = prev.some((mk) => mk.mapelId === mId);
            const base = hasMapel ? prev : [...prev, { mapelId: mId, kelasIds: [] }];
            return base.map((mk) => {
              if (mk.mapelId !== mId) return mk;
              const exists = mk.kelasIds.includes(kId);
              return {
                ...mk,
                kelasIds: exists
                  ? mk.kelasIds.filter((id) => id !== kId)
                  : [...mk.kelasIds, kId],
              };
            });
          });
        };

        const applyModalAngkatan = (mId: string, mode: "VII" | "VIII" | "IX" | "ALL" | "NONE") => {
          setModalPlotMapelKelas((prev) => {
            const hasMapel = prev.some((mk) => mk.mapelId === mId);
            const base = hasMapel ? prev : [...prev, { mapelId: mId, kelasIds: [] }];
            return base.map((mk) => {
              if (mk.mapelId !== mId) return mk;
              if (mode === "NONE") return { ...mk, kelasIds: [] };
              if (mode === "ALL") return { ...mk, kelasIds: dbState.kelasAkademik.map((ka) => ka.id) };
              const matchedIds = dbState.kelasAkademik
                .filter((ka) => getGuruGradeLevel(ka.nama) === mode)
                .map((ka) => ka.id);
              const allSel = matchedIds.length > 0 && matchedIds.every((id) => mk.kelasIds.includes(id));
              return {
                ...mk,
                kelasIds: allSel
                  ? mk.kelasIds.filter((id) => !matchedIds.includes(id))
                  : Array.from(new Set([...mk.kelasIds, ...matchedIds])),
              };
            });
          });
        };

        const modalGradeGroups: { label: string; key: "VII" | "VIII" | "IX" | "Lainnya"; list: typeof dbState.kelasAkademik }[] = [
          { label: "Angkatan / Kelas VII", key: "VII", list: dbState.kelasAkademik.filter((ka) => getGuruGradeLevel(ka.nama) === "VII") },
          { label: "Angkatan / Kelas VIII", key: "VIII", list: dbState.kelasAkademik.filter((ka) => getGuruGradeLevel(ka.nama) === "VIII") },
          { label: "Angkatan / Kelas IX", key: "IX", list: dbState.kelasAkademik.filter((ka) => getGuruGradeLevel(ka.nama) === "IX") },
          { label: "Kelas Lainnya", key: "Lainnya", list: dbState.kelasAkademik.filter((ka) => getGuruGradeLevel(ka.nama) === "Lainnya") },
        ];

        return (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-3 sm:p-5 animate-fade-in">
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-4xl max-h-[88vh] overflow-hidden flex flex-col text-left font-sans"
            >
              {/* Modal Header */}
              <div className="bg-[#0666AE] text-white p-4 sm:p-5 flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white/15 rounded-xl">
                    <Layers size={20} className="text-emerald-300" />
                  </div>
                  <div>
                    <h3 className="font-black text-sm sm:text-base">
                      Plotting Mapel & Kelas: {guruPlotModalTarget.nama}
                    </h3>
                    <p className="text-[11px] text-sky-100">
                      Pilih mata pelajaran di panel kiri, lalu pilih kelas ajar di panel kanan ({modalPlotMapelKelas.length} Mapel diampu)
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setGuruPlotModalTarget(null)}
                  className="text-white/80 hover:text-white bg-white/10 hover:bg-white/20 p-1.5 rounded-full cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              {/* 2-Panel Body */}
              <div className="flex-1 overflow-hidden grid grid-cols-1 md:grid-cols-12 divide-y md:divide-y-0 md:divide-x divide-slate-200">
                {/* Panel Kiri: Daftar Mapel */}
                <div className="md:col-span-5 flex flex-col bg-slate-50/70 overflow-hidden">
                  <div className="p-3 border-b border-slate-200 bg-white space-y-2">
                    <div className="relative">
                      <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
                      <input
                        type="text"
                        value={modalPlotSearchMapel}
                        onChange={(e) => setModalPlotSearchMapel(e.target.value)}
                        placeholder="Cari mata pelajaran..."
                        className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-[#0666AE]"
                      />
                    </div>
                  </div>
                  <div className="flex-1 overflow-y-auto p-2.5 space-y-1.5 max-h-[45vh] md:max-h-[55vh]">
                    {filteredModalMapels.map((m) => {
                      const entry = modalPlotMapelKelas.find((mk) => mk.mapelId === m.id);
                      const isAdded = Boolean(entry);
                      const isFocused = modalPlotActiveMapelId === m.id;
                      const kCount = entry?.kelasIds.length || 0;

                      return (
                        <div
                          key={m.id}
                          onClick={() => setModalPlotActiveMapelId(m.id)}
                          className={`p-2.5 rounded-xl border flex items-center justify-between gap-2 cursor-pointer transition ${
                            isFocused
                              ? "bg-white border-[#0666AE] ring-2 ring-[#0666AE]/15 shadow-sm"
                              : isAdded
                              ? "bg-emerald-50/70 border-emerald-200 hover:bg-white"
                              : "bg-white/70 border-slate-200 hover:bg-white"
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <input
                              type="checkbox"
                              checked={isAdded}
                              onChange={() => toggleModalMapel(m.id)}
                              onClick={(e) => e.stopPropagation()}
                              className="rounded border-slate-300 text-emerald-600 cursor-pointer w-4 h-4 shrink-0"
                            />
                            <div className="min-w-0">
                              <p className="font-extrabold text-xs text-slate-800 truncate">{m.nama}</p>
                              <p className="text-[10px] text-slate-400 font-mono">{m.kode}</p>
                            </div>
                          </div>
                          {isAdded && (
                            <span
                              className={`text-[9px] font-black px-2 py-0.5 rounded-lg shrink-0 ${
                                kCount > 0 ? "bg-emerald-100 text-emerald-800" : "bg-sky-100 text-[#0666AE]"
                              }`}
                            >
                              {kCount > 0 ? `${kCount} Kelas` : "Semua"}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Panel Kanan: Kelas Ajar untuk Mapel Terpilih */}
                <div className="md:col-span-7 p-4 sm:p-5 overflow-y-auto space-y-4 bg-white max-h-[50vh] md:max-h-[60vh]">
                  {selectedMapelObj ? (
                    <>
                      <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-200">
                        <div>
                          <span className="text-[10px] font-black uppercase text-slate-400 block">
                            Pengaturan Kelas Mapel Terpilih
                          </span>
                          <h4 className="text-base font-black text-slate-800">
                            {selectedMapelObj.nama}
                          </h4>
                        </div>
                        <button
                          type="button"
                          onClick={() => toggleModalMapel(selectedMapelObj.id)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-extrabold cursor-pointer border transition ${
                            selectedEntry
                              ? "bg-emerald-600 text-white border-emerald-600"
                              : "bg-slate-100 text-slate-700 border-slate-200 hover:bg-emerald-50 hover:text-emerald-700"
                          }`}
                        >
                          {selectedEntry ? "✓ Diampu Guru Ini" : "+ Aktifkan Mapel Ini"}
                        </button>
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 bg-slate-50 rounded-xl border border-slate-200 text-xs">
                        <span className="font-bold text-slate-600 text-[11px]">
                          {selectedEntry
                            ? selectedEntry.kelasIds.length === 0
                              ? "Status: Mengajar di Semua Kelas"
                              : `Status: Terbatas di ${selectedEntry.kelasIds.length} Kelas`
                            : "Klik kelas di bawah untuk langsung mengaktifkan & memplot mapel ini."}
                        </span>
                        <div className="flex gap-1.5">
                          <button
                            type="button"
                            onClick={() => applyModalAngkatan(selectedMapelObj.id, "NONE")}
                            className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-white text-[#0666AE] border border-sky-200 hover:bg-sky-50 cursor-pointer"
                          >
                            Semua Kelas
                          </button>
                          <button
                            type="button"
                            onClick={() => applyModalAngkatan(selectedMapelObj.id, "ALL")}
                            className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-white text-emerald-700 border border-emerald-200 hover:bg-emerald-50 cursor-pointer"
                          >
                            Centang Semua
                          </button>
                        </div>
                      </div>

                      <div className="space-y-3">
                        {modalGradeGroups
                          .filter((g) => g.list.length > 0)
                          .map((grp) => {
                            const allGrpChecked =
                              Boolean(selectedEntry) &&
                              grp.list.every((ka) => selectedEntry!.kelasIds.includes(ka.id));
                            return (
                              <div key={grp.key} className="p-3 rounded-2xl border border-slate-200 bg-slate-50/40 space-y-2">
                                <div className="flex items-center justify-between">
                                  <span className="text-[11px] font-black text-slate-700 uppercase">
                                    {grp.label}
                                  </span>
                                  {grp.key !== "Lainnya" && (
                                    <button
                                      type="button"
                                      onClick={() => applyModalAngkatan(selectedMapelObj.id, grp.key as "VII" | "VIII" | "IX")}
                                      className={`px-2 py-0.5 rounded-lg text-[10px] font-extrabold border cursor-pointer transition ${
                                        allGrpChecked
                                          ? "bg-emerald-600 text-white border-emerald-600"
                                          : "bg-white text-slate-600 border-slate-200 hover:bg-slate-100"
                                      }`}
                                    >
                                      {allGrpChecked ? "✓ Terpilih Semua" : `Pilih Semua ${grp.key}`}
                                    </button>
                                  )}
                                </div>
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                  {grp.list.map((ka) => {
                                    const checked = selectedEntry?.kelasIds.includes(ka.id) || false;
                                    return (
                                      <button
                                        key={ka.id}
                                        type="button"
                                        onClick={() => toggleModalKelas(selectedMapelObj.id, ka.id)}
                                        className={`p-2 rounded-xl border text-xs font-bold text-left flex items-center justify-between cursor-pointer transition ${
                                          checked
                                            ? "bg-emerald-600 text-white border-emerald-600 shadow-sm"
                                            : "bg-white text-slate-700 border-slate-200 hover:border-emerald-300 hover:bg-emerald-50/50"
                                        }`}
                                      >
                                        <span className="truncate">{ka.nama}</span>
                                        {checked && <Check size={14} className="shrink-0" />}
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                            );
                          })}
                      </div>
                    </>
                  ) : (
                    <div className="h-full flex items-center justify-center text-xs text-slate-400">
                      Pilih mata pelajaran di panel kiri untuk mengatur kelasnya.
                    </div>
                  )}
                </div>
              </div>

              {/* Modal Footer */}
              <div className="bg-slate-50 border-t border-slate-200 p-4 flex flex-wrap justify-between items-center gap-2">
                <span className="text-[11px] font-bold text-slate-500">
                  Total Mapel Diampu: <strong className="text-emerald-700">{modalPlotMapelKelas.length} Mapel</strong>
                </span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setGuruPlotModalTarget(null)}
                    className="px-4 py-2 border border-slate-300 rounded-xl font-bold text-slate-600 hover:bg-slate-100 text-xs cursor-pointer"
                  >
                    Batal
                  </button>
                  <button
                    type="button"
                    onClick={saveGuruPlottingModal}
                    className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-black text-xs shadow-sm cursor-pointer flex items-center gap-1.5"
                  >
                    <Check size={14} />
                    <span>Simpan Plotting Mapel & Kelas</span>
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        );
      })()}

      {showImportExcelJadwalModal && (
        <ImportJadwalModal
          existingJadwal={dbState.jadwal}
          mapelList={dbState.mapel}
          kelasAkademikList={dbState.kelasAkademik}
          onClose={() => setShowImportExcelJadwalModal(false)}
          onSave={(newJadwalItems) => {
            const merged = [...getDB.jadwal(), ...newJadwalItems];
            setDB.jadwal(merged);
            showToast(`${newJadwalItems.length} jadwal ujian berhasil diimpor & tersimpan realtime!`);
          }}
        />
      )}

      {showImportExcelPengawasModal && (
        <ImportPengawasModal
          existingPengawas={dbState.pengawas}
          existingJadwalNgawas={dbState.jadwalNgawas}
          mapelList={dbState.mapel}
          kelasList={dbState.kelas}
          onClose={() => setShowImportExcelPengawasModal(false)}
          onSave={(newPengawas, newNgawas) => {
            if (newPengawas.length > 0) {
              const mergedP = [...getDB.pengawas(), ...newPengawas];
              setDB.pengawas(mergedP);
            }
            if (newNgawas.length > 0) {
              const mergedN = [...getDB.jadwalNgawas(), ...newNgawas];
              setDB.jadwalNgawas(mergedN);
            }
            showToast(`Impor pengawas selesai (${newPengawas.length} personil, ${newNgawas.length} jadwal jaga)!`);
          }}
        />
      )}

      {/* MODAL CONFIG AUDIT SOAL JADWAL */}
      {openConfigJadwalId && (() => {
        const jag = dbState.jadwal.find((j) => j.id === openConfigJadwalId);
        if (!jag) return null;
        const mat = dbState.mapel.find((m) => m.id === jag.mapelId);

        const targetAcadClassIds = normalizeSoalKelasIds(jag.kelasIds, dbState.kelasAkademik);
        const mapelQuestions = dbState.soal.filter((s) => s.mapelId === jag.mapelId);

        const activeJadwalQuestions = filterQuestionsForJadwal(jag, dbState.soal, dbState.kelasAkademik);
        const activeJadwalIdSet = new Set(activeJadwalQuestions.map((q) => q.id));

        const isManualMode = Boolean(jag.soalIds && jag.soalIds.length > 0);
        const selectedGuruIds = jag.guruIds || [];

        const updateCurrentJadwal = (patch: Partial<JadwalUjian>) => {
          const nextJadwal = getDB.jadwal().map((j) =>
            j.id === jag.id ? { ...j, ...patch } : j
          );
          setDB.jadwal(nextJadwal);
        };

        // Build per-guru breakdown for this mapel
        type GuruSourceStat = {
          guruKey: string;
          nama: string;
          totalCount: number;
          classMatchCount: number;
          gradeCounts: Record<"VII" | "VIII" | "IX" | "Lainnya", number>;
        };

        const authorKeysInSoal = Array.from(
          new Set(mapelQuestions.map((s) => s.guruId || SYSTEM_GURU_ID))
        );
        const assignedGuruIds = dbState.guru
          .filter(
            (g) =>
              (g.mapelIds || []).includes(jag.mapelId) ||
              (g.mapelKelas || []).some((mk) => mk.mapelId === jag.mapelId)
          )
          .map((g) => g.id);

        const allAuthorKeys = Array.from(new Set([...authorKeysInSoal, ...assignedGuruIds]));

        const guruStats: GuruSourceStat[] = allAuthorKeys.map((gKey) => {
          const guruObj = gKey === SYSTEM_GURU_ID ? null : dbState.guru.find((g) => g.id === gKey);
          const nama =
            gKey === SYSTEM_GURU_ID
              ? "Admin / Bank Soal Sistem"
              : guruObj?.nama || `Guru (${gKey})`;
          const gQuestions = mapelQuestions.filter((s) => (s.guruId || SYSTEM_GURU_ID) === gKey);
          const gradeCounts: Record<"VII" | "VIII" | "IX" | "Lainnya", number> = {
            VII: 0,
            VIII: 0,
            IX: 0,
            Lainnya: 0,
          };
          let classMatchCount = 0;

          gQuestions.forEach((q) => {
            if (isQuestionClassMatchForSchedule(q, jag, dbState.kelasAkademik)) {
              classMatchCount++;
            }
            const names = formatSoalKelasNames(q.kelasIds, dbState.kelasAkademik);
            if (names.length === 0) {
              gradeCounts.Lainnya++;
            } else {
              const seenGrades = new Set(names.map((n) => getClassGradeLevel(n)));
              seenGrades.forEach((lvl) => {
                gradeCounts[lvl]++;
              });
            }
          });

          return {
            guruKey: gKey,
            nama,
            totalCount: gQuestions.length,
            classMatchCount,
            gradeCounts,
          };
        });

        const handleToggleGuruSource = (guruKey: string) => {
          const exists = selectedGuruIds.includes(guruKey);
          const next = exists
            ? selectedGuruIds.filter((id) => id !== guruKey)
            : [...selectedGuruIds, guruKey];
          // Selecting guru clears manual soalIds override if switching source
          updateCurrentJadwal({ guruIds: next, soalIds: [] });
        };

        const handleUseAllGurus = () => {
          updateCurrentJadwal({ guruIds: [], soalIds: [] });
        };

        const handleToggleManualSoal = (soalId: string) => {
          const baseIds = isManualMode
            ? [...(jag.soalIds || [])]
            : activeJadwalQuestions.map((q) => q.id);
          const exists = baseIds.includes(soalId);
          const nextIds = exists
            ? baseIds.filter((id) => id !== soalId)
            : [...baseIds, soalId];
          updateCurrentJadwal({ soalIds: nextIds });
        };

        // NON-DESTRUCTIVE class append: adds this schedule's classes to existing kelasIds WITHOUT erasing other angkatan (XI, XII)!
        const handleAppendScheduleClassesToQuestion = (soalId: string) => {
          if (targetAcadClassIds.length === 0) return;
          const updatedQuestions = getDB.soal().map((s) => {
            if (s.id !== soalId) return s;
            const currentNorm = normalizeSoalKelasIds(s.kelasIds, dbState.kelasAkademik);
            if (currentNorm.length === 0) return s;
            const merged = Array.from(new Set([...currentNorm, ...targetAcadClassIds]));
            return { ...s, kelasIds: merged };
          });
          setDB.soal(updatedQuestions);
          showToast("Kelas jadwal berhasil ditambahkan ke butir soal secara aman.");
        };

        // Apply modal view filters
        const filteredQuestions = mapelQuestions.filter((s) => {
          const authorKey = s.guruId || SYSTEM_GURU_ID;
          if (configModalFilterGuru !== "ALL" && authorKey !== configModalFilterGuru) return false;

          const isIncluded = activeJadwalIdSet.has(s.id);
          if (configModalFilterStatus === "MATCHED" && !isIncluded) return false;
          if (configModalFilterStatus === "OTHER" && isIncluded) return false;

          if (configModalSearch.trim()) {
            const q = configModalSearch.trim().toLowerCase();
            if (!(s.teks || "").toLowerCase().includes(q)) return false;
          }
          return true;
        });

        const matchedTotalCount = activeJadwalQuestions.length;
        const otherTotalCount = mapelQuestions.length - matchedTotalCount;

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden shadow-2xl border border-slate-100 text-xs"
            >
              {/* HEADER */}
              <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-[#0666AE]/5 shrink-0">
                <div className="text-left">
                  <p className="font-extrabold text-[#0666AE] tracking-widest uppercase text-[10px]">
                    KONFIGURASI SUMBER SOAL & GURU
                  </p>
                  <h3 className="text-lg font-black text-slate-800 font-sans">
                    {mat ? mat.nama : "Ujian CBT"} {mat?.kode ? `(${mat.kode})` : ""}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setOpenConfigJadwalId(null)}
                  className="text-slate-400 hover:text-slate-600 bg-white hover:bg-slate-100 p-2 rounded-full transition-colors cursor-pointer border border-slate-200"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="p-5 md:p-6 overflow-y-auto space-y-5 flex-1 text-left">
                {/* RINGKASAN TARGET & STATUS */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  <div className="p-4 bg-slate-50 border border-slate-200/80 rounded-2xl space-y-1.5">
                    <p className="font-extrabold text-slate-500 uppercase tracking-widest text-[9px]">
                      Sasaran Sesi Jadwal
                    </p>
                    <p className="text-slate-800 text-[13px] font-bold">
                      Kelas Target:{" "}
                      <span className="text-[#0666AE] font-black">
                        {jag.kelasIds.join(", ") || "Semua Tingkat"}
                      </span>
                    </p>
                    <p className="text-slate-600 font-semibold text-[11px]">
                      Tanggal: {jag.tanggal} • {jag.jamMulai} - {jag.jamSelesai} WIB ({jag.durasiMenit} mnt)
                    </p>
                  </div>

                  <div className="p-4 bg-slate-50 border border-slate-200/80 rounded-2xl flex flex-col justify-between gap-2">
                    <div className="flex justify-between items-center gap-2">
                      <p className="font-extrabold text-slate-500 uppercase tracking-widest text-[9px]">
                        Soal Aktif Diujikan
                      </p>
                      <span
                        className={`text-[11px] font-black px-2.5 py-0.5 rounded-full border ${
                          matchedTotalCount > 0
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                            : "bg-amber-50 text-amber-700 border-amber-200"
                        }`}
                      >
                        {matchedTotalCount > 0
                          ? `✅ ${matchedTotalCount} Soal Siap Ujian`
                          : "⚠️ Belum Ada Soal Masuk"}
                      </span>
                    </div>
                    <p className="text-[10.5px] text-slate-600 leading-relaxed">
                      {otherTotalCount > 0
                        ? `Terdapat ${otherTotalCount} soal lain di mapel ini (mis. untuk angkatan VII/VIII/IX lain atau guru lain) yang otomatis terpisah dan tetap aman tidak tercampur.`
                        : "Semua soal di filter aktif siap digunakan untuk siswa pada jadwal ini."}
                    </p>
                  </div>
                </div>

                {/* PILIH SUMBER SOAL DARI GURU SIAPA */}
                <div className="p-4 bg-sky-50/50 border border-sky-200/80 rounded-2xl space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <h4 className="text-xs font-black text-[#0666AE] uppercase tracking-wider flex items-center gap-1.5">
                        <UserCheck size={15} />
                        Pilih Sumber Soal Dari Guru
                      </h4>
                      <p className="text-[10.5px] text-slate-600 mt-0.5">
                        Klik guru pembuat soal yang ingin dipakai untuk jadwal ini agar tidak salah mengambil bank soal guru lain.
                      </p>
                    </div>
                    {isManualMode && (
                      <button
                        type="button"
                        onClick={() => updateCurrentJadwal({ soalIds: [] })}
                        className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-extrabold text-[10px] cursor-pointer transition shrink-0 shadow-sm"
                      >
                        Kembali ke Otomatis (Guru & Kelas)
                      </button>
                    )}
                  </div>

                  {isManualMode && (
                    <div className="p-2.5 bg-indigo-50 border border-indigo-200 rounded-xl text-[10.5px] text-indigo-800 font-bold flex items-center justify-between gap-2">
                      <span>
                        Mode Pilih Manual sedang aktif ({jag.soalIds?.length} soal dicentang khusus untuk jadwal ini).
                      </span>
                    </div>
                  )}

                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={handleUseAllGurus}
                      className={`px-3 py-2 rounded-xl border text-left transition cursor-pointer ${
                        !isManualMode && selectedGuruIds.length === 0
                          ? "bg-[#0666AE] text-white border-[#0666AE] shadow-sm"
                          : "bg-white text-slate-700 border-slate-200 hover:border-sky-300"
                      }`}
                    >
                      <div className="font-black text-[11px]">
                        {!isManualMode && selectedGuruIds.length === 0 ? "✓ " : ""}
                        Semua Guru Mapel Ini
                      </div>
                      <div
                        className={`text-[9.5px] font-semibold mt-0.5 ${
                          !isManualMode && selectedGuruIds.length === 0 ? "text-sky-100" : "text-slate-500"
                        }`}
                      >
                        Total {mapelQuestions.length} soal • Otomatis saring sesuai kelas
                      </div>
                    </button>

                    {guruStats.map((gs) => {
                      const isSelected = !isManualMode && selectedGuruIds.includes(gs.guruKey);
                      const gradeSummaryParts = (["VII", "VIII", "IX", "Lainnya"] as const)
                        .filter((lvl) => gs.gradeCounts[lvl] > 0)
                        .map((lvl) => `${lvl === "Lainnya" ? "Umum" : `Kls ${lvl}`}: ${gs.gradeCounts[lvl]}`);

                      return (
                        <button
                          key={gs.guruKey}
                          type="button"
                          onClick={() => handleToggleGuruSource(gs.guruKey)}
                          className={`px-3 py-2 rounded-xl border text-left transition cursor-pointer ${
                            isSelected
                              ? "bg-emerald-600 text-white border-emerald-600 shadow-sm"
                              : "bg-white text-slate-700 border-slate-200 hover:border-emerald-300"
                          }`}
                        >
                          <div className="font-black text-[11px] flex items-center gap-1.5">
                            <span>{isSelected ? "✓" : "○"}</span>
                            <span>{gs.nama}</span>
                            <span
                              className={`px-1.5 py-0.2 rounded text-[9px] font-extrabold ${
                                isSelected
                                  ? "bg-white/20 text-white"
                                  : gs.classMatchCount > 0
                                  ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                  : "bg-slate-100 text-slate-500"
                              }`}
                            >
                              {gs.classMatchCount} cocok / {gs.totalCount} total
                            </span>
                          </div>
                          <div
                            className={`text-[9.5px] font-semibold mt-0.5 ${
                              isSelected ? "text-emerald-50" : "text-slate-500"
                            }`}
                          >
                            {gradeSummaryParts.length > 0
                              ? `Cakupan: ${gradeSummaryParts.join(" • ")}`
                              : "Belum ada soal diupload"}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* FILTER & PENCARIAN DAFTAR SOAL */}
                <div className="space-y-3 font-sans">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-2.5 bg-slate-50 p-3 rounded-2xl border border-slate-200">
                    <div className="flex flex-wrap items-center gap-1.5">
                      {[
                        { id: "ALL" as const, label: `Semua (${mapelQuestions.length})` },
                        { id: "MATCHED" as const, label: `Masuk Ujian (${matchedTotalCount})` },
                        { id: "OTHER" as const, label: `Kelas/Guru Lain (${otherTotalCount})` },
                      ].map((tab) => (
                        <button
                          key={tab.id}
                          type="button"
                          onClick={() => setConfigModalFilterStatus(tab.id)}
                          className={`px-2.5 py-1.5 rounded-xl text-[10px] font-extrabold cursor-pointer transition border ${
                            configModalFilterStatus === tab.id
                              ? "bg-slate-800 text-white border-slate-800"
                              : "bg-white text-slate-600 border-slate-200 hover:bg-slate-100"
                          }`}
                        >
                          {tab.label}
                        </button>
                      ))}
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <select
                        value={configModalFilterGuru}
                        onChange={(e) => setConfigModalFilterGuru(e.target.value)}
                        className="px-2.5 py-1.5 bg-white border border-slate-200 rounded-xl text-[10.5px] font-bold text-slate-700 cursor-pointer"
                      >
                        <option value="ALL">Semua Pembuat Soal</option>
                        {guruStats.map((gs) => (
                          <option key={gs.guruKey} value={gs.guruKey}>
                            {gs.nama} ({gs.totalCount})
                          </option>
                        ))}
                      </select>

                      <div className="relative">
                        <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                          type="text"
                          value={configModalSearch}
                          onChange={(e) => setConfigModalSearch(e.target.value)}
                          placeholder="Cari teks soal..."
                          className="pl-7 pr-3 py-1.5 bg-white border border-slate-200 rounded-xl text-[10.5px] font-semibold text-slate-700 w-44 focus:outline-none focus:border-[#0666AE]"
                        />
                      </div>
                    </div>
                  </div>

                  {/* LIST PERTANYAAN */}
                  <div className="divide-y divide-slate-100 border border-slate-200 rounded-2xl overflow-hidden bg-white">
                    {filteredQuestions.length === 0 ? (
                      <div className="p-8 text-center text-slate-400 font-bold space-y-2">
                        <BookOpen size={24} className="mx-auto text-slate-300" />
                        <p>Tidak ada soal yang sesuai filter saat ini.</p>
                      </div>
                    ) : (
                      filteredQuestions.map((s, idx) => {
                        const isIncluded = activeJadwalIdSet.has(s.id);
                        const isClassCompatible = isQuestionClassMatchForSchedule(
                          s,
                          jag,
                          dbState.kelasAkademik
                        );
                        const qClassNames = formatSoalKelasNames(s.kelasIds, dbState.kelasAkademik);
                        const authorKey = s.guruId || SYSTEM_GURU_ID;
                        const authorObj =
                          authorKey === SYSTEM_GURU_ID
                            ? null
                            : dbState.guru.find((g) => g.id === authorKey);
                        const authorName =
                          authorKey === SYSTEM_GURU_ID
                            ? "Admin / Sistem"
                            : authorObj?.nama || `Guru (${authorKey})`;

                        const qGrades = Array.from(
                          new Set(qClassNames.map((n) => getClassGradeLevel(n)))
                        );

                        return (
                          <div
                            key={s.id}
                            className={`p-4 flex flex-col md:flex-row gap-3 justify-between items-start md:items-center transition-colors ${
                              isIncluded
                                ? "bg-emerald-50/20 hover:bg-emerald-50/35"
                                : "bg-slate-50/40 hover:bg-slate-50"
                            }`}
                          >
                            <div className="flex items-start gap-3 flex-1 min-w-0">
                              <button
                                type="button"
                                onClick={() => handleToggleManualSoal(s.id)}
                                title={
                                  isIncluded
                                    ? "Hapus butir soal ini dari jadwal (mode pilih manual)"
                                    : "Centang agar soal ini ikut masuk ke jadwal"
                                }
                                className={`mt-0.5 p-1 rounded-lg border transition cursor-pointer shrink-0 ${
                                  isIncluded
                                    ? "bg-emerald-600 text-white border-emerald-600"
                                    : "bg-white text-slate-400 border-slate-300 hover:border-slate-400"
                                }`}
                              >
                                {isIncluded ? <CheckSquare size={14} /> : <Square size={14} />}
                              </button>

                              <div className="space-y-1.5 flex-1 min-w-0 text-left">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="bg-slate-100 text-slate-700 font-extrabold px-1.5 py-0.5 rounded text-[10px]">
                                    No. {idx + 1}
                                  </span>

                                  {isIncluded ? (
                                    <span className="bg-emerald-50 text-emerald-700 text-[9.5px] font-extrabold px-2 py-0.5 rounded-full border border-emerald-200">
                                      ✅ Masuk Ujian Ini
                                    </span>
                                  ) : (
                                    <span className="bg-slate-100 text-slate-600 text-[9.5px] font-extrabold px-2 py-0.5 rounded-full border border-slate-200">
                                      {!isClassCompatible
                                        ? "ℹ️ Khusus Kelas Lain"
                                        : "⏸️ Tidak Terpilih"}
                                    </span>
                                  )}

                                  <span className="bg-sky-50 text-[#0666AE] text-[9.5px] font-extrabold px-2 py-0.5 rounded-full border border-sky-200">
                                    Guru: {authorName}
                                  </span>

                                  {qGrades.length > 0 && qGrades.some((g) => g !== "Lainnya") && (
                                    <span className="bg-indigo-50 text-indigo-700 text-[9px] font-extrabold px-2 py-0.5 rounded-full border border-indigo-200">
                                      Angkatan: {qGrades.join(", ")}
                                    </span>
                                  )}
                                </div>

                                <p className="font-bold text-slate-800 text-[12px] leading-snug line-clamp-2">
                                  {s.teks || <span className="italic text-slate-400">(Teks soal kosong)</span>}
                                </p>

                                <div className="flex flex-wrap items-center gap-2 text-[10px] text-slate-500 font-semibold">
                                  <span>
                                    Sasaran Kelas:{" "}
                                    <span className="text-slate-700 font-bold">
                                      {qClassNames.length > 0 ? qClassNames.join(", ") : "Semua Kelas / Umum"}
                                    </span>
                                  </span>
                                  <span>•</span>
                                  <span>
                                    Kunci: <strong className="text-slate-700">{s.kunci}</strong>
                                  </span>
                                </div>
                              </div>
                            </div>

                            {/* NON-DESTRUCTIVE APPEND ACTION (ONLY IF NOT YET TARGETING SCHEDULE CLASSES) */}
                            {!isClassCompatible && targetAcadClassIds.length > 0 && (
                              <div className="shrink-0">
                                <button
                                  type="button"
                                  onClick={() => handleAppendScheduleClassesToQuestion(s.id)}
                                  title="Menambahkan kelas pada jadwal ini ke soal TANPA menghapus target kelas/angkatan lain yang sudah ada"
                                  className="bg-white hover:bg-sky-50 text-[#0666AE] border border-sky-200 font-extrabold px-3 py-1.5 rounded-xl cursor-pointer text-[10px] transition flex items-center gap-1 shadow-sm"
                                >
                                  <Plus size={12} />
                                  Tambahkan Kelas Jadwal (Aman)
                                </button>
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>

              <div className="p-4 border-t border-slate-100 bg-slate-50 flex flex-col sm:flex-row justify-between items-center gap-2 shrink-0">
                <p className="text-[10.5px] text-slate-500 font-semibold">
                  Perubahan guru sumber & pilihan soal tersimpan otomatis dan tidak mengubah target kelas di bank soal guru.
                </p>
                <button
                  type="button"
                  onClick={() => setOpenConfigJadwalId(null)}
                  className="bg-[#0666AE] hover:bg-[#0666AE]/95 text-white font-extrabold px-6 py-2 rounded-xl cursor-pointer shadow-sm shrink-0"
                >
                  Selesai & Tutup
                </button>
              </div>
            </motion.div>
          </div>
        );
      })()}
      {/* UNGGAH / TAMBAH SOAL MODAL OVERLAY */}
      {showAddSoalModal && (
        <div id="add-soal-modal" className="fixed inset-0 z-[9998] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto">
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-3xl max-w-3xl w-full shadow-2xl border border-slate-100 overflow-hidden text-left"
          >
            <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-[#0666AE]/5">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-[#0666AE]/10 text-[#0666AE] rounded-xl border border-[#0666AE]/15">
                  <Plus size={16} />
                </div>
                <div>
                  <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest leading-none">Unggah / Tambah Soal CBT</h3>
                  <p className="text-[10px] text-slate-500 mt-1 font-semibold">
                    Mendukung Upload Word (.docx), Bahasa Arab (RTL), Bahasa Inggris, Rumus Matematika, & Jawaban Gambar.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowAddSoalModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            {/* TAB SELECTOR */}
            <div className="flex border-b border-slate-100 bg-slate-50/50 px-6 pt-2 gap-2 text-xs font-extrabold">
              <button
                type="button"
                onClick={() => setAddSoalTab("mass")}
                className={`pb-2.5 px-3 border-b-2 cursor-pointer transition ${
                  addSoalTab === "mass" ? "border-[#0666AE] text-[#0666AE]" : "border-transparent text-slate-400 hover:text-slate-600"
                }`}
              >
                Impor Massal (Word .docx / Teks)
              </button>
              <button
                type="button"
                onClick={() => setAddSoalTab("manual")}
                className={`pb-2.5 px-3 border-b-2 cursor-pointer transition ${
                  addSoalTab === "manual" ? "border-[#0666AE] text-[#0666AE]" : "border-transparent text-slate-400 hover:text-slate-600"
                }`}
              >
                Input Manual Satu Butir
              </button>
            </div>

            {addSoalTab === "mass" ? (
              <form onSubmit={handleAdminMassSoal} className="p-6 space-y-4 max-h-[78vh] overflow-y-auto text-xs">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] text-slate-500 font-extrabold uppercase block">Mata Pelajaran Target</label>
                    <select
                      value={inputSoalMapel}
                      onChange={(e) => setInputSoalMapel(e.target.value)}
                      className="w-full p-2 bg-white border border-slate-200 rounded-xl text-slate-800 font-bold"
                      required
                    >
                      <option value="">-- Pilih Mata Pelajaran --</option>
                      {dbState.mapel.map((m) => (
                        <option key={m.id} value={m.id}>{m.nama}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] text-slate-500 font-extrabold uppercase block">Sasaran Tingkat Kelas (Opsional)</label>
                    <select
                      value=""
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val && !inputSoalKelasIds.includes(val)) {
                          setInputSoalKelasIds([...inputSoalKelasIds, val]);
                        }
                      }}
                      className="w-full p-2 bg-white border border-slate-200 rounded-xl text-slate-800 font-bold"
                    >
                      <option value="">-- Pilih / Tambah Kelas (Kosong = Umum) --</option>
                      {dbState.kelasAkademik.map((ka) => (
                        <option key={ka.id} value={ka.id}>{ka.nama}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {inputSoalKelasIds.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 p-2 bg-slate-50 rounded-xl border border-slate-200">
                    {inputSoalKelasIds.map((kId) => {
                      const kObj = dbState.kelasAkademik.find((ka) => ka.id === kId);
                      return (
                        <span key={kId} className="px-2 py-0.5 bg-sky-50 text-[#0666AE] border border-sky-100 rounded-lg text-[10px] font-bold flex items-center gap-1">
                          {kObj ? kObj.nama : kId}
                          <button
                            type="button"
                            onClick={() => setInputSoalKelasIds(inputSoalKelasIds.filter((id) => id !== kId))}
                            className="text-red-500 hover:text-red-700 font-bold cursor-pointer"
                          >
                            ×
                          </button>
                        </span>
                      );
                    })}
                  </div>
                )}

                {/* UPLOAD WORD .DOCX */}
                <div className="p-3.5 bg-gradient-to-r from-sky-50 to-indigo-50 border border-sky-200 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="space-y-0.5">
                    <p className="text-[11px] font-black text-[#0666AE] flex items-center gap-1.5">
                      <FileText size={14} />
                      <span>Upload Langsung File Microsoft Word (.docx)</span>
                    </p>
                    <p className="text-[10px] text-slate-600 font-medium">
                      Otomatis mengekstrak soal teks, Arab RTL (١. أ ب ج د هـ), Inggris, rumus Equation ($...$), dan gambar soal/opsi!
                    </p>
                  </div>
                  <label className={`px-3.5 py-2 rounded-xl font-extrabold text-[11px] flex items-center justify-center gap-1.5 cursor-pointer shrink-0 shadow-sm transition ${
                    isParsingDocx ? "bg-slate-400 text-white" : "bg-[#0666AE] hover:bg-[#05558E] text-white"
                  }`}>
                    <Upload size={13} />
                    <span>{isParsingDocx ? "Memproses Word..." : "Pilih File Word (.docx)"}</span>
                    <input
                      type="file"
                      accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                      onChange={handleAdminDocxFileChange}
                      disabled={isParsingDocx}
                      className="hidden"
                    />
                  </label>
                </div>

                {/* LIVE PARSE COUNTER */}
                {massSoalText.trim() && (
                  <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 bg-slate-50 border border-slate-200 rounded-xl">
                    <div className="flex flex-wrap items-center gap-2 text-[11px] font-extrabold">
                      <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                        ✅ {massParsePreview.questions.length} Soal Terdeteksi
                      </span>
                      {massParsePreview.skipped.length > 0 && (
                        <span className="px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800">
                          ⚠️ {massParsePreview.skipped.length} Blok Belum Lengkap
                        </span>
                      )}
                    </div>
                    {massParsePreview.questions.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setShowMassPreviewModal(true)}
                        className="px-3 py-1 bg-white hover:bg-sky-50 text-[#0666AE] border border-sky-200 rounded-lg font-extrabold text-[10.5px] flex items-center gap-1 cursor-pointer"
                      >
                        <Eye size={12} />
                        <span>Pratinjau Semua ({massParsePreview.questions.length})</span>
                      </button>
                    )}
                  </div>
                )}

                <div className="space-y-1">
                  <div className="flex justify-between items-center">
                    <label className="text-[10px] text-slate-500 font-extrabold uppercase">Naskah Soal (Tempel atau Hasil Ekstrak Word)</label>
                    <span className="text-[9px] text-[#0666AE] font-mono font-bold">Support Indo / Arab / English / LaTeX ($...$)</span>
                  </div>
                  <textarea
                    rows={8}
                    value={massSoalText}
                    onChange={(e) => setMassSoalText(e.target.value)}
                    placeholder={`Contoh format:\n1. Hitung nilai $\\frac{3}{4} + \\frac{1}{2} = \\dots$\nA. $\\frac{5}{4}$\nB. $\\frac{4}{6}$\nC. 1\nD. 2\nKunci: A\n\n٢. ما معنى كلمة «مدرسة»؟\nأ. Rumah\nب. Sekolah\nج. Masjid\nد. Pasar\nالمفتاح: ب`}
                    className="w-full p-3 bg-white border border-slate-200 rounded-xl text-slate-800 font-mono text-[11px] leading-relaxed focus:outline-none focus:border-[#0666AE]"
                    required
                  />
                </div>

                {massParsePreview.skipped.length > 0 && (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-[10px] text-amber-900 space-y-1">
                    <p className="font-extrabold">Catatan Blok yang Dilewati (Pastikan punya pertanyaan + min. Opsi A & B):</p>
                    <ul className="list-disc pl-4 space-y-0.5 max-h-20 overflow-y-auto">
                      {massParsePreview.skipped.slice(0, 5).map((sk) => (
                        <li key={sk.index}>
                          <strong>Blok #{sk.index}:</strong> {sk.reason} — <span className="italic opacity-80">"{sk.preview}"</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setShowAddSoalModal(false)}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl cursor-pointer"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-[#0666AE] hover:bg-[#0666AE]/90 text-white font-extrabold rounded-xl shadow cursor-pointer uppercase"
                  >
                    Impor {massParsePreview.questions.length > 0 ? `${massParsePreview.questions.length} ` : ""}Soal Permanen
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleAddSoal} className="p-6 space-y-4 max-h-[78vh] overflow-y-auto text-xs">
                <div className="space-y-1">
                  <div className="flex justify-between items-center">
                    <label className="text-[10px] text-slate-500 font-extrabold uppercase block">Teks / Pertanyaan Soal (Support Arab & Rumus $...$)</label>
                  </div>
                  <textarea
                    rows={3}
                    value={inputSoalTeks}
                    onChange={(e) => setInputSoalTeks(e.target.value)}
                    dir="auto"
                    placeholder="Ketik pertanyaan soal di sini... (Untuk rumus matematika gunakan $...$, misal $\frac{a}{b}$)"
                    className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-slate-800 font-medium focus:outline-none focus:border-[#0666AE]"
                    required
                  />
                  {inputSoalTeks.trim() && (
                    <div className="p-2 bg-slate-50 border border-slate-200 rounded-xl text-[11px] text-slate-700">
                      <span className="text-[9px] font-black uppercase text-slate-400 block mb-0.5">Pratinjau Tampilan Siswa:</span>
                      <RichMathText text={inputSoalTeks} />
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] text-slate-500 font-extrabold uppercase block">Mata Pelajaran</label>
                    <select
                      value={inputSoalMapel}
                      onChange={(e) => setInputSoalMapel(e.target.value)}
                      className="w-full p-2 bg-white border border-slate-200 rounded-xl text-slate-800 font-bold"
                      required
                    >
                      <option value="">-- Pilih Mata Pelajaran --</option>
                      {dbState.mapel.map((m) => (
                        <option key={m.id} value={m.id}>{m.nama}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] text-slate-500 font-extrabold uppercase block">Kunci Jawaban Benar</label>
                    <select
                      value={inputSoalKunci}
                      onChange={(e) => setInputSoalKunci(e.target.value as any)}
                      className="w-full p-2 bg-white border border-slate-200 rounded-xl text-[#0666AE] font-black"
                    >
                      <option value="A">A</option>
                      <option value="B">B</option>
                      <option value="C">C</option>
                      <option value="D">D</option>
                      <option value="E">E</option>
                    </select>
                  </div>
                </div>

                {/* Gambar Soal Utama */}
                <div className="space-y-2 p-3 bg-slate-50 border border-slate-200 rounded-2xl">
                  <label className="text-[10px] text-slate-600 font-extrabold uppercase block">Gambar Soal (Opsional - URL atau Upload)</label>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <input
                      type="text"
                      value={inputSoalImg}
                      onChange={(e) => setInputSoalImg(e.target.value)}
                      placeholder="https://... atau upload file gambar"
                      className="flex-1 p-2 bg-white border border-slate-200 rounded-xl text-slate-800 font-mono text-[10px]"
                    />
                    <label className="flex items-center justify-center gap-1.5 px-3 py-2 bg-[#0666AE] hover:bg-[#05558E] text-white font-extrabold rounded-xl text-[10px] cursor-pointer shrink-0">
                      <ImagePlus size={12} />
                      <span>Upload Gambar</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => handleFileChange(e, setInputSoalImg)}
                        className="hidden"
                      />
                    </label>
                  </div>
                  {inputSoalImg && (
                    <div className="flex items-center gap-2 bg-white p-2 rounded-xl border border-slate-200">
                      <img src={inputSoalImg} alt="Preview Soal" className="h-14 w-auto object-contain rounded border" />
                      <span className="text-[10px] text-slate-500 truncate flex-1">{inputSoalImg.startsWith("data:") ? "Gambar Terkompres Siap Simpan" : inputSoalImg}</span>
                      <button type="button" onClick={() => setInputSoalImg("")} className="p-1 text-rose-500 hover:bg-rose-50 rounded cursor-pointer"><X size={14} /></button>
                    </div>
                  )}
                </div>

                <div className="space-y-2.5 p-3 bg-slate-50 border border-slate-200 rounded-2xl">
                  <label className="text-[10px] text-slate-500 font-extrabold uppercase block">Pilihan Jawaban A–E (Teks / Rumus / Gambar Jawaban)</label>
                  {(["A", "B", "C", "D", "E"] as const).map((optKey) => {
                    const optImg = inputSoalOpsiGambar[optKey];
                    return (
                      <div key={optKey} className="space-y-1.5 bg-white p-2 rounded-xl border border-slate-200/80">
                        <div className="flex items-center gap-2">
                          <span className="w-6 h-6 rounded-lg bg-slate-100 text-slate-700 font-black flex items-center justify-center shrink-0">
                            {optKey}
                          </span>
                          <input
                            type="text"
                            dir="auto"
                            value={inputSoalOpsi[optKey]}
                            onChange={(e) => setInputSoalOpsi({ ...inputSoalOpsi, [optKey]: e.target.value })}
                            placeholder={`Teks jawaban ${optKey} (opsional jika pakai gambar)...`}
                            className="flex-1 p-2 bg-white border border-slate-200 rounded-xl text-slate-800"
                            required={(optKey === "A" || optKey === "B") && !optImg}
                          />
                          <label className="px-2.5 py-2 bg-sky-50 hover:bg-sky-100 text-[#0666AE] border border-sky-200 rounded-xl text-[10px] font-bold flex items-center gap-1 cursor-pointer shrink-0">
                            <ImagePlus size={12} />
                            <span>Gambar</span>
                            <input
                              type="file"
                              accept="image/*"
                              onChange={(e) =>
                                handleFileChange(e, (url) =>
                                  setInputSoalOpsiGambar((prev) => ({ ...prev, [optKey]: url }))
                                )
                              }
                              className="hidden"
                            />
                          </label>
                        </div>
                        {optImg && (
                          <div className="flex items-center gap-2 pl-8">
                            <img src={optImg} alt={`Opsi ${optKey}`} className="h-12 w-auto object-contain rounded border" />
                            <button
                              type="button"
                              onClick={() =>
                                setInputSoalOpsiGambar((prev) => {
                                  const next = { ...prev };
                                  delete next[optKey];
                                  return next;
                                })
                              }
                              className="text-[10px] text-rose-600 font-bold hover:underline cursor-pointer"
                            >
                              Hapus Gambar {optKey}
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setShowAddSoalModal(false)}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl cursor-pointer"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-[#0666AE] hover:bg-[#0666AE]/90 text-white font-extrabold rounded-xl shadow cursor-pointer uppercase"
                  >
                    Simpan Butir Soal
                  </button>
                </div>
              </form>
            )}
          </motion.div>
        </div>
      )}

      {/* PREVIEW MODAL MASS SOAL ADMIN */}
      {showMassPreviewModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/70 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl max-w-4xl w-full max-h-[88vh] flex flex-col overflow-hidden shadow-2xl border border-slate-200">
            <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-[#0666AE]/5">
              <div>
                <h3 className="text-sm font-black text-slate-800">
                  Pratinjau Hasil Deteksi ({massParsePreview.questions.length} Soal)
                </h3>
                <p className="text-[10.5px] text-slate-500">
                  Verifikasi tampilan teks Arab RTL, rumus matematika KaTeX, serta gambar soal & opsi sebelum disimpan.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowMassPreviewModal(false)}
                className="p-2 bg-white border border-slate-200 rounded-full text-slate-500 hover:text-slate-700 cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>
            <div className="p-5 overflow-y-auto space-y-4 flex-1 bg-slate-50/50 text-xs">
              {massParsePreview.questions.map((pq, i) => (
                <div key={i} className="p-4 bg-white rounded-2xl border border-slate-200 space-y-2.5 shadow-2xs">
                  <div className="flex justify-between items-center border-b border-slate-100 pb-1.5">
                    <span className="font-black text-[#0666AE]">Soal #{i + 1}</span>
                    <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-extrabold text-[10px]">
                      Kunci: {pq.kunci}
                    </span>
                  </div>
                  <div className="font-bold text-slate-800 text-[13px]">
                    <RichMathText text={pq.teks} />
                  </div>
                  {pq.gambarUrl && (
                    <img src={pq.gambarUrl} alt="Gambar Soal" className="max-h-36 object-contain rounded-lg border" />
                  )}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-1">
                    {(["A", "B", "C", "D", "E"] as const).map((k) => {
                      const val = pq.opsi[k];
                      const img = pq.opsiGambar?.[k];
                      if (!val && !img) return null;
                      return (
                        <div
                          key={k}
                          className={`p-2 rounded-xl border text-[11px] flex flex-col gap-1 ${
                            pq.kunci === k ? "bg-emerald-50 border-emerald-200 font-bold" : "bg-slate-50 border-slate-200"
                          }`}
                        >
                          <div className="flex gap-1.5 items-start">
                            <span className="font-mono font-black text-[#0666AE] shrink-0">{k}.</span>
                            {val && <RichMathText text={val} className="flex-1" />}
                          </div>
                          {img && <img src={img} alt={`Opsi ${k}`} className="max-h-20 object-contain rounded border self-start ml-4" />}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
            <div className="p-4 border-t border-slate-200 bg-white flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowMassPreviewModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs cursor-pointer"
              >
                Tutup Pratinjau
              </button>
            </div>
          </div>
        </div>
      )}

      {/* EDIT SOAL MODAL OVERLAY */}
      {editingSoal && (
        <div id="edit-soal-modal" className="fixed inset-0 z-[9998] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto">
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-3xl max-w-2xl w-full shadow-2xl border border-slate-100 overflow-hidden text-left"
          >
            <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-[#0666AE]/10 text-[#0666AE] rounded-xl border border-[#0666AE]/15">
                  <Edit size={16} />
                </div>
                <div>
                  <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest leading-none">Edit Butir Soal</h3>
                  <p className="text-[10px] text-slate-400 mt-1 font-semibold">Ubah konten soal, rumus matematika, teks Arab, atau gambar jawaban opsi A–E.</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingSoal(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleUpdateSoal} className="p-6 space-y-4 max-h-[78vh] overflow-y-auto text-xs">
              <div className="space-y-1">
                <label className="text-[10px] text-slate-500 font-extrabold uppercase my-1 block">Pertanyaan / Teks Soal</label>
                <textarea
                  rows={4}
                  dir="auto"
                  value={editSoalTeks}
                  onChange={(e) => setEditSoalTeks(e.target.value)}
                  className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-slate-800 font-medium focus:outline-none focus:border-[#0666AE]"
                  placeholder="Tuliskan pertanyaan ujian..."
                  required
                />
                {editSoalTeks.trim() && (
                  <div className="p-2 bg-slate-50 border border-slate-200 rounded-xl text-[11px] text-slate-700">
                    <span className="text-[9px] font-black uppercase text-slate-400 block mb-0.5">Pratinjau:</span>
                    <RichMathText text={editSoalTeks} />
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] text-slate-500 font-extrabold uppercase my-1 block">Mata Pelajaran</label>
                  <select
                    value={editSoalMapel}
                    onChange={(e) => setEditSoalMapel(e.target.value)}
                    className="w-full p-2.5 bg-white border border-slate-205 rounded-xl text-slate-705 font-bold focus:outline-none focus:border-[#0666AE]"
                    required
                  >
                    <option value="">-- Pilih Mapel --</option>
                    {dbState.mapel.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.nama}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] text-emerald-600 font-extrabold uppercase my-1 block">Kunci Pilihan Jawaban</label>
                  <select
                    value={editSoalKunci}
                    onChange={(e) => setEditSoalKunci(e.target.value as any)}
                    className="w-full p-2.5 bg-white border border-slate-205 rounded-xl text-emerald-600 font-bold focus:outline-none focus:border-[#0666AE]"
                    required
                  >
                    <option value="A">Opsi A</option>
                    <option value="B">Opsi B</option>
                    <option value="C">Opsi C</option>
                    <option value="D">Opsi D</option>
                    <option value="E">Opsi E</option>
                  </select>
                </div>
              </div>

              <div className="space-y-2 p-3 bg-slate-50 border border-slate-200 rounded-2xl">
                <label className="text-[10px] text-slate-650 font-extrabold uppercase my-1 block">Lampiran Gambar Soal (Opsional)</label>
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="text"
                    value={editSoalImg}
                    onChange={(e) => setEditSoalImg(e.target.value)}
                    placeholder="Tempel URL Gambar atau upload berkas..."
                    className="flex-1 p-2.5 bg-white border border-slate-250 rounded-xl text-slate-800 font-mono text-[10px] focus:outline-none focus:border-[#0666AE]"
                  />
                  <label className="flex items-center justify-center gap-1.5 px-3 py-2 bg-[#0666AE] hover:bg-[#0666AE]/95 text-white font-extrabold uppercase rounded-xl text-[9px] cursor-pointer transition select-none shadow-sm shrink-0">
                    <Upload size={12} />
                    <span>Upload File</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleFileChange(e, setEditSoalImg)}
                      className="hidden"
                    />
                  </label>
                </div>
                {editSoalImg && (
                  <div className="pt-2 flex items-center gap-3 bg-white p-2 rounded-xl border border-slate-155">
                    <div className="relative w-14 h-14 rounded-lg overflow-hidden border border-slate-200 bg-slate-100 flex items-center justify-center shrink-0">
                      <img src={editSoalImg} alt="Preview" className="w-full h-full object-cover" />
                    </div>
                    <div className="flex-1 overflow-hidden">
                      <p className="text-[9px] font-mono text-slate-400 truncate">{editSoalImg.startsWith("data:") ? "Berkas Gambar Berhasil Diunggah" : editSoalImg}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setEditSoalImg("")}
                      className="p-1 text-red-500 hover:bg-red-50 rounded-lg transition"
                      title="Hapus gambar"
                    >
                      <X size={14} />
                    </button>
                  </div>
                )}
              </div>

              {/* Targets Checklist */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-2">
                <label className="text-[10px] text-[#0666AE] font-black uppercase tracking-wider block">Sasaran Kelas Akademik (Multi-Select)</label>
                <div className="flex flex-wrap gap-2">
                  {dbState.kelasAkademik.map((ka) => {
                    const isChecked = editSoalKelasIds.includes(ka.id);
                    return (
                      <label key={ka.id} className="flex items-center gap-1.5 cursor-pointer font-bold bg-white p-1.5 px-3 rounded-lg border border-slate-200 hover:bg-slate-50 select-none text-[11px]">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {
                            if (isChecked) {
                              setEditSoalKelasIds(editSoalKelasIds.filter((id) => id !== ka.id));
                            } else {
                              setEditSoalKelasIds([...editSoalKelasIds, ka.id]);
                            }
                          }}
                          className="rounded text-[#0666AE] focus:ring-0"
                        />
                        <span>{ka.nama}</span>
                      </label>
                    );
                  })}
                </div>
                <p className="text-[9px] text-slate-400 font-medium">Jika tidak menceklis kelas manapun, soal akan diterbitkan sebagai "Umum" untuk semua kelas.</p>
              </div>

              <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-2.5">
                <label className="text-[10px] text-slate-400 font-extrabold uppercase block">Opsi Pilihan Jawaban (A-E) & Gambar Jawaban</label>
                {(["A", "B", "C", "D", "E"] as const).map((o) => {
                  const optImg = editSoalOpsiGambar[o];
                  return (
                    <div key={o} className="space-y-1.5 bg-white p-2 rounded-xl border border-slate-200/80">
                      <div className="flex gap-2 items-center">
                        <span className="font-extrabold text-[#0666AE] w-4 font-mono text-[11px]">{o}</span>
                        <input
                          type="text"
                          dir="auto"
                          value={editSoalOpsi[o]}
                          onChange={(e) => setEditSoalOpsi({ ...editSoalOpsi, [o]: e.target.value })}
                          placeholder={`Isi pilihan Opsi ${o}...`}
                          className="flex-1 p-2 bg-white border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-[#0666AE]"
                          required={["A", "B"].includes(o) && !optImg}
                        />
                        <label className="px-2.5 py-2 bg-sky-50 hover:bg-sky-100 text-[#0666AE] border border-sky-200 rounded-xl text-[10px] font-bold flex items-center gap-1 cursor-pointer shrink-0">
                          <ImagePlus size={12} />
                          <span>Gambar</span>
                          <input
                            type="file"
                            accept="image/*"
                            onChange={(e) =>
                              handleFileChange(e, (url) =>
                                setEditSoalOpsiGambar((prev) => ({ ...prev, [o]: url }))
                              )
                            }
                            className="hidden"
                          />
                        </label>
                      </div>
                      {optImg && (
                        <div className="flex items-center gap-2 pl-6">
                          <img src={optImg} alt={`Opsi ${o}`} className="h-12 w-auto object-contain rounded border" />
                          <button
                            type="button"
                            onClick={() =>
                              setEditSoalOpsiGambar((prev) => {
                                const next = { ...prev };
                                delete next[o];
                                return next;
                              })
                            }
                            className="text-[10px] text-rose-600 font-bold hover:underline cursor-pointer"
                          >
                            Hapus Gambar {o}
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingSoal(null)}
                  className="px-4 py-2 bg-white border border-slate-200 text-slate-600 rounded-xl font-bold hover:bg-slate-50 cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#0666AE] hover:bg-[#0666AE]/95 text-white rounded-xl font-extrabold uppercase shadow cursor-pointer"
                >
                  Simpan Perubahan
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
      {confirmModal && confirmModal.isOpen && (
        <div id="confirm-modal-overlay" className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-2xl max-w-sm w-full shadow-2xl border border-slate-100 overflow-hidden"
          >
            <div className="p-5">
              <div className="flex items-start gap-3">
                <div className={`p-2.5 rounded-full flex-shrink-0 ${confirmModal.isDanger !== false ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-600'}`}>
                  <ShieldAlert size={20} />
                </div>
                <div className="space-y-1">
                  <h3 className="text-xs font-black text-slate-850 uppercase tracking-wider">
                    {confirmModal.title}
                  </h3>
                  <p className="text-[11px] text-slate-500 leading-normal">
                    {confirmModal.message}
                  </p>
                </div>
              </div>
            </div>
            
            <div className="bg-slate-50 p-3 border-t border-slate-100 flex justify-end gap-2 text-[10px]">
              <button
                type="button"
                onClick={() => setConfirmModal(null)}
                className="px-3.5 py-1.5 bg-white border border-slate-200 text-slate-600 rounded-lg font-bold hover:bg-slate-50 transition-all cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={async () => {
                  const fn = confirmModal.onConfirm;
                  setConfirmModal(null);
                  await fn();
                }}
                className={`px-3.5 py-1.5 text-white rounded-lg font-extrabold transition-all cursor-pointer shadow-sm ${confirmModal.isDanger !== false ? 'bg-red-600 hover:bg-red-700' : 'bg-amber-500 hover:bg-amber-600'}`}
              >
                Ya, Konfirmasi
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
