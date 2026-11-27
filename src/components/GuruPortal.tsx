import React, { useState, useEffect, useMemo } from "react";
import {
  getDB,
  setDB,
  subscribeToDB,
  getSyncStatus,
  subscribeToSyncStatus,
  clearSyncError,
  SyncStatus,
} from "../firebaseConfig";
import { Soal, GuruAmpuan } from "../types";
import {
  BookOpen,
  Award,
  Calendar,
  LogOut,
  Plus,
  Trash2,
  FileSpreadsheet,
  Check,
  Shield,
  Clock,
  Upload,
  X,
  Edit,
  Menu,
  FolderOpen,
  Layers,
  Search,
  FileText,
  Image as ImageIcon,
  Eye,
  AlertCircle,
  CheckCircle2,
  ClipboardList,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import * as XLSX from "xlsx";
import {
  parseMassSoalText,
  buildSoalObjectsFromParsed,
  MassSoalParseResult,
  OpsiKey,
} from "../utils/massSoalParser";
import { parseDocxSoalFile } from "../utils/docxSoalParser";
import { compressImageFile } from "../utils/imageUtils";
import RichMathText, {
  areAllOptionsArabicRtl,
  getLineDirection,
  hasArabicText,
  isArabicDominant,
} from "./RichMathText";
import { sortSoalByWordOrder } from "../utils/examQuestionFilter";

interface GuruPortalProps {
  onLogout: () => void;
  guruUser: string;
}

export default function GuruPortal({ onLogout, guruUser }: GuruPortalProps) {
  const [activeMenu, setActiveMenu] = useState("banksoal");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [dbState, setDbState] = useState({
    soal: getDB.soal(),
    mapel: getDB.mapel(),
    hasil: getDB.hasil(),
    guru: getDB.guru(),
    siswa: getDB.siswa(),
    konfig: getDB.konfig(),
    kelasAkademik: getDB.kelasAkademik(),
    kelas: getDB.kelas(),
    pengawas: getDB.pengawas(),
    jadwalNgawas: getDB.jadwalNgawas(),
  });

  // Keep synced with local observers
  useEffect(() => {
    const unsub = subscribeToDB(() => {
      setDbState({
        soal: getDB.soal(),
        mapel: getDB.mapel(),
        hasil: getDB.hasil(),
        guru: getDB.guru(),
        siswa: getDB.siswa(),
        konfig: getDB.konfig(),
        kelasAkademik: getDB.kelasAkademik(),
        kelas: getDB.kelas(),
        pengawas: getDB.pengawas(),
        jadwalNgawas: getDB.jadwalNgawas(),
      });
    });
    return unsub;
  }, []);

  const currentGuru = dbState.guru.find((g) => g.username === guruUser) || {
    id: "g_temp",
    nama: "Guru MTs. Al-Ma'sum II Cmc",
    nip: "1980000000000000",
    mapelIds: [] as string[],
    mapelKelas: [] as GuruAmpuan[],
  };

  // Canonicalize a class token (e.g. "Kelas VII-1", "7-1", "vii-1") for resilient matching
  const normalizeClassMatchStr = (raw: string) => {
    let s = (raw || "").trim().toLowerCase().replace(/^kelas\s+/i, "");
    s = s.replace(/^9(?=\b|[-_\s])/i, "ix");
    s = s.replace(/^8(?=\b|[-_\s])/i, "viii");
    s = s.replace(/^7(?=\b|[-_\s])/i, "vii");
    return s.replace(/[^a-z0-9]/g, "");
  };

  // Resolve plotted kelasAkademik IDs for a given mapelId (empty = unrestricted / all classes)
  const getPlottedKelasIdsForMapel = (mapelId: string): string[] => {
    if (!mapelId) return [];
    const entry = currentGuru.mapelKelas?.find((mk) => mk.mapelId === mapelId);
    if (!entry || !entry.kelasIds || entry.kelasIds.length === 0) return [];
    return Array.from(
      new Set(
        entry.kelasIds.map((raw) => {
          const normRaw = normalizeClassMatchStr(raw);
          const found = dbState.kelasAkademik.find(
            (ka) => ka.id === raw || normalizeClassMatchStr(ka.nama) === normRaw
          );
          return found ? found.id : raw;
        })
      )
    );
  };

  // Filter subjects and questions that belong to this teacher (include subjects plotted AND any subjects they created questions for)
  const teacherUploadedMapelIds = dbState.soal.filter((s) => s.guruId === currentGuru.id).map((s) => s.mapelId);
  const guruAmpuanMapelIds =
    currentGuru.mapelKelas && currentGuru.mapelKelas.length > 0
      ? currentGuru.mapelKelas.map((mk) => mk.mapelId)
      : currentGuru.mapelIds || [];
  const plottedMapelIds = guruAmpuanMapelIds.length > 0 ? guruAmpuanMapelIds : dbState.mapel.map((m) => m.id);
  const guruMapels = dbState.mapel.filter((m) => plottedMapelIds.includes(m.id) || teacherUploadedMapelIds.includes(m.id));
  const guruSoals = dbState.soal.filter((s) => {
    if (s.guruId === currentGuru.id) return true;
    if (!plottedMapelIds.includes(s.mapelId)) return false;
    const allowedKelas = getPlottedKelasIdsForMapel(s.mapelId);
    if (allowedKelas.length === 0) return true;
    if (!s.kelasIds || s.kelasIds.length === 0) return true;
    return s.kelasIds.some((kId) => {
      const kaObj = dbState.kelasAkademik.find((ka) => ka.id === kId || normalizeClassMatchStr(ka.nama) === normalizeClassMatchStr(kId));
      return allowedKelas.includes(kaObj ? kaObj.id : kId);
    });
  });

  // --- Toast Notification & Cloud Sync Status ---
  const [toastMsg, setToastMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>(getSyncStatus());

  const showToast = (text: string, type: "success" | "error" = "success") => {
    setToastMsg({ text, type });
  };

  useEffect(() => {
    if (!toastMsg) return;
    const t = setTimeout(() => setToastMsg(null), 5000);
    return () => clearTimeout(t);
  }, [toastMsg]);

  useEffect(() => {
    const unsub = subscribeToSyncStatus(() => setSyncStatus(getSyncStatus()));
    return unsub;
  }, []);

  // --- Sub states for uploading a question ---
  const [soalInputMode, setSoalInputMode] = useState<"individual" | "mass">("individual");
  const [soalTeks, setSoalTeks] = useState("");
  const [soalMapel, setSoalMapel] = useState("");
  const [soalKunci, setSoalKunci] = useState<"A" | "B" | "C" | "D" | "E">("A");
  const [soalImg, setSoalImg] = useState("");
  const [opsi, setOpsi] = useState({
    A: "",
    B: "",
    C: "",
    D: "",
    E: "",
  });
  const [opsiGambar, setOpsiGambar] = useState<Partial<Record<OpsiKey, string>>>({});
  const [soalKelasIds, setSoalKelasIds] = useState<string[]>([]);
  const lastScopedMapelRef = React.useRef<string>("");

  // Automatically sync soalMapel state so it is ALWAYS a valid ID representing a subject the teacher actually teaches
  useEffect(() => {
    if (guruMapels.length > 0) {
      const isValid = guruMapels.some((m) => m.id === soalMapel);
      if (!isValid) {
        setSoalMapel(guruMapels[0].id);
      }
    }
  }, [guruMapels, soalMapel]);

  // Automatically pre-select teacher's plotted classes whenever target Mapel changes
  useEffect(() => {
    if (!soalMapel) return;
    if (lastScopedMapelRef.current !== soalMapel) {
      lastScopedMapelRef.current = soalMapel;
      const plottedForMapel = getPlottedKelasIdsForMapel(soalMapel);
      setSoalKelasIds(plottedForMapel);
    }
  }, [soalMapel, currentGuru.id, currentGuru.mapelKelas]);

  // Automatically repair any questions written by this teacher that have invalid/missing/deleted subject IDs
  useEffect(() => {
    if (!syncStatus.cloudReady || syncStatus.quotaExceeded) return;
    if (dbState.soal.length > 0 && dbState.mapel.length > 0 && currentGuru.id && guruMapels.length > 0) {
      let needsRepair = false;
      const repairedSoals = dbState.soal.map((s) => {
        if (s.guruId === currentGuru.id) {
          const mapelExists = dbState.mapel.some((m) => m.id === s.mapelId);
          if (!mapelExists && s.mapelId !== guruMapels[0].id) {
            needsRepair = true;
            return {
              ...s,
              mapelId: guruMapels[0].id,
            };
          }
        }
        return s;
      });

      if (needsRepair) {
        setDB.soal(repairedSoals);
      }
    }
  }, [syncStatus.cloudReady, dbState.soal, dbState.mapel, currentGuru.id, guruMapels]);

  const [massText, setMassText] = useState("");
  const [massDocxName, setMassDocxName] = useState("");
  const [massDocxLoading, setMassDocxLoading] = useState(false);
  const [massDocxResult, setMassDocxResult] = useState<MassSoalParseResult | null>(null);
  const [showMassPreviewModal, setShowMassPreviewModal] = useState(false);
  const [massImages, setMassImages] = useState<{ id: string; name: string; data: string }[]>([]);

  const activeMassParse: MassSoalParseResult | null = useMemo(() => {
    if (massDocxResult) return massDocxResult;
    if (!massText.trim()) return null;
    return parseMassSoalText(massText);
  }, [massDocxResult, massText]);

  const handleDocxFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    if (!file.name.toLowerCase().endsWith(".docx")) {
      showToast("Mohon pilih file Microsoft Word berformat .docx (bukan .doc lama).", "error");
      return;
    }
    setMassDocxLoading(true);
    try {
      const output = await parseDocxSoalFile(file);
      setMassDocxName(file.name);
      setMassDocxResult(output.parsed);
      setMassText(output.rawExtractedText);
      if (output.parsed.questions.length > 0) {
        showToast(
          `Berhasil membaca "${file.name}": ${output.parsed.questions.length} soal & ${output.extractedImageCount} gambar terdeteksi!`,
          "success"
        );
      } else {
        showToast(
          `File "${file.name}" terbaca tetapi belum ada soal beropsi A & B yang terdeteksi.`,
          "error"
        );
      }
    } catch (err) {
      showToast("Gagal membaca berkas Word (.docx): " + (err instanceof Error ? err.message : String(err)), "error");
    } finally {
      setMassDocxLoading(false);
    }
  };

  const handleMassFilesChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (file.size > 5 * 1024 * 1024) {
        showToast(`Ukuran berkas "${file.name}" melebihi batas 5MB.`, "error");
        continue;
      }
      try {
        const compressed = await compressImageFile(file, 900, 0.78);
        setMassImages((prev) => [
          ...prev,
          {
            id: "img_" + Date.now() + "_" + Math.random().toString(36).substr(2, 5),
            name: file.name,
            data: compressed,
          },
        ]);
      } catch {
        showToast(`Gagal memproses gambar "${file.name}".`, "error");
      }
    }
  };

  const [expandedGuruGroupKey, setExpandedGuruGroupKey] = useState<string | null>(null);
  const [guruFilterMapel, setGuruFilterMapel] = useState("");
  const [guruFilterKelas, setGuruFilterKelas] = useState("");
  const [guruSearchSoal, setGuruSearchSoal] = useState("");
  const [hasilFilterMapel, setHasilFilterMapel] = useState("");
  const [hasilFilterKelas, setHasilFilterKelas] = useState("");
  const [hasilSearch, setHasilSearch] = useState("");
  const [selectedGuruSoalIds, setSelectedGuruSoalIds] = useState<string[]>([]);
  const [plottingGroupTarget, setPlottingGroupTarget] = useState<{
    title: string;
    soalIds: string[];
    initialKelasIds: string[];
  } | null>(null);
  const [plottingKelasIds, setPlottingKelasIds] = useState<string[]>([]);

  // Helper: detect grade/angkatan level from class name (VII, VIII, IX)
  const getGradeLevel = (nama: string): "VII" | "VIII" | "IX" | "Lainnya" => {
    const upper = nama.toUpperCase();
    if (/\bIX\b/.test(upper) || /\b9\b/.test(upper) || /\b9[A-Z]\b/.test(upper)) return "IX";
    if (/\bVIII\b/.test(upper) || /\b8\b/.test(upper) || /\b8[A-Z]\b/.test(upper)) return "VIII";
    if (/\bVII\b/.test(upper) || /\b7\b/.test(upper) || /\b7[A-Z]\b/.test(upper)) return "VII";
    return "Lainnya";
  };

  // Helper: quick select kelasIds by Angkatan
  const applyAngkatanQuickSelect = (
    mode: "VII" | "VIII" | "IX" | "ALL" | "NONE",
    setter: React.Dispatch<React.SetStateAction<string[]>>
  ) => {
    if (mode === "NONE") {
      setter([]);
      return;
    }
    if (mode === "ALL") {
      setter(dbState.kelasAkademik.map((ka) => ka.id));
      return;
    }
    const matchedIds = dbState.kelasAkademik
      .filter((ka) => getGradeLevel(ka.nama) === mode)
      .map((ka) => ka.id);
    setter((prev) => {
      const allSelected = matchedIds.length > 0 && matchedIds.every((id) => prev.includes(id));
      if (allSelected) {
        return prev.filter((id) => !matchedIds.includes(id));
      }
      return Array.from(new Set([...prev, ...matchedIds]));
    });
  };

  // Canonicalize a question's kelasIds to academic class IDs
  const normalizeSoalKelasIds = (ids?: string[]): string[] => {
    if (!ids || ids.length === 0) return [];
    const resolved = ids.map((raw) => {
      const found = dbState.kelasAkademik.find(
        (ka) => ka.id === raw || ka.nama.trim().toLowerCase() === raw.trim().toLowerCase()
      );
      return found ? found.id : raw;
    });
    return Array.from(new Set(resolved)).sort();
  };

  const handleOpenPlottingModal = (title: string, soalIds: string[], initialKelasIds: string[]) => {
    setPlottingGroupTarget({ title, soalIds, initialKelasIds });
    setPlottingKelasIds(normalizeSoalKelasIds(initialKelasIds));
  };

  const handleSavePlottingKelompok = (e: React.FormEvent) => {
    e.preventDefault();
    if (!plottingGroupTarget) return;
    const targetSet = new Set(plottingGroupTarget.soalIds);
    const updated = dbState.soal.map((s) =>
      targetSet.has(s.id) ? { ...s, kelasIds: [...plottingKelasIds] } : s
    );
    setDB.soal(updated);
    const targetNames = plottingKelasIds.length > 0
      ? dbState.kelasAkademik.filter((ka) => plottingKelasIds.includes(ka.id)).map((ka) => ka.nama).join(", ")
      : "Semua Kelas / Umum";
    setPlottingGroupTarget(null);
    setSelectedGuruSoalIds((prev) => prev.filter((id) => !targetSet.has(id)));
    setExpandedGuruGroupKey(null);
    alert(`${plottingGroupTarget.soalIds.length} butir soal berhasil di-plotting ke kelompok: ${targetNames}!`);
  };

  // States for Teacher Editing Soal
  const [editingGuruSoal, setEditingGuruSoal] = useState<Soal | null>(null);
  const [editGuruSoalTeks, setEditGuruSoalTeks] = useState("");
  const [editGuruSoalMapel, setEditGuruSoalMapel] = useState("");
  const [editGuruSoalKunci, setEditGuruSoalKunci] = useState<"A" | "B" | "C" | "D" | "E">("A");
  const [editGuruSoalImg, setEditGuruSoalImg] = useState("");
  const [editGuruSoalOpsi, setEditGuruSoalOpsi] = useState({
    A: "",
    B: "",
    C: "",
    D: "",
    E: "",
  });
  const [editGuruSoalOpsiGambar, setEditGuruSoalOpsiGambar] = useState<Partial<Record<OpsiKey, string>>>({});
  const [editGuruSoalKelasIds, setEditGuruSoalKelasIds] = useState<string[]>([]);

  const startEditGuruSoal = (s: Soal) => {
    setEditingGuruSoal(s);
    setEditGuruSoalTeks(s.teks);
    setEditGuruSoalMapel(s.mapelId);
    setEditGuruSoalKunci(s.kunci);
    setEditGuruSoalImg(s.gambarUrl || "");
    setEditGuruSoalOpsi({
      A: s.opsi.A || "",
      B: s.opsi.B || "",
      C: s.opsi.C || "",
      D: s.opsi.D || "",
      E: s.opsi.E || "",
    });
    setEditGuruSoalOpsiGambar({ ...(s.opsiGambar || {}) });
    setEditGuruSoalKelasIds(s.kelasIds || []);
  };

  const handleUpdateGuruSoal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingGuruSoal) return;
    const hasA = Boolean(editGuruSoalOpsi.A.trim() || editGuruSoalOpsiGambar.A);
    const hasB = Boolean(editGuruSoalOpsi.B.trim() || editGuruSoalOpsiGambar.B);
    if (!editGuruSoalTeks.trim() || !editGuruSoalMapel || !hasA || !hasB) {
      showToast("Isi teks soal, mata pelajaran, serta minimal teks atau gambar opsi A & B.", "error");
      return;
    }

    const cleanOpsiGambar: Partial<Record<OpsiKey, string>> = {};
    (["A", "B", "C", "D", "E"] as const).forEach((k) => {
      const val = editGuruSoalOpsiGambar[k]?.trim();
      if (val) cleanOpsiGambar[k] = val;
    });

    const latestSoals = getDB.soal() as Soal[];
    const updated = latestSoals.map((s) => {
      if (s.id === editingGuruSoal.id) {
        const cleaned: Soal = {
          ...s,
          teks: editGuruSoalTeks,
          mapelId: editGuruSoalMapel,
          kunci: editGuruSoalKunci,
          opsi: { ...editGuruSoalOpsi },
          kelasIds: editGuruSoalKelasIds || [],
        };
        if (editGuruSoalImg && editGuruSoalImg.trim()) {
          cleaned.gambarUrl = editGuruSoalImg.trim();
        } else {
          delete cleaned.gambarUrl;
        }
        if (Object.keys(cleanOpsiGambar).length > 0) {
          cleaned.opsiGambar = cleanOpsiGambar;
        } else {
          delete cleaned.opsiGambar;
        }
        return cleaned;
      }
      return s;
    });

    setDB.soal(updated);
    setEditingGuruSoal(null);
    showToast("Perubahan butir soal berhasil disimpan!", "success");
  };

  // Bulk delete for a specific teacher's subject+class group
  const handleBulkDeleteGuruGroup = (soalIds: string[], mapelNama: string, kelasLabel: string) => {
    if (soalIds.length === 0) return;
    if (
      confirm(
        `Apakah Anda yakin ingin menghapus ${soalIds.length} butir soal di kelompok "${mapelNama} — ${kelasLabel}"? Kelompok kelas/angkatan lain tidak akan terhapus.`
      )
    ) {
      const idSet = new Set(soalIds);
      const remaining = (getDB.soal() as Soal[]).filter((s) => !idSet.has(s.id));
      setDB.soal(remaining);
      setSelectedGuruSoalIds((prev) => prev.filter((id) => !idSet.has(id)));
      setExpandedGuruGroupKey(null);
      showToast(`${soalIds.length} butir soal di kelompok "${mapelNama} — ${kelasLabel}" berhasil dihapus.`, "success");
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>, setImgUrl: (url: string) => void) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    if (file.size > 5 * 1024 * 1024) {
      showToast("Ukuran berkas melebihi batas 5MB. Pilih berkas yang lebih kecil.", "error");
      return;
    }
    try {
      const compressed = await compressImageFile(file, 900, 0.78);
      setImgUrl(compressed);
    } catch {
      showToast("Gagal memproses berkas gambar.", "error");
    }
  };

  const handleSaveSoal = (e: React.FormEvent) => {
    e.preventDefault();
    const hasA = Boolean(opsi.A.trim() || opsiGambar.A);
    const hasB = Boolean(opsi.B.trim() || opsiGambar.B);
    if ((!soalTeks.trim() && !soalImg) || !soalMapel || !hasA || !hasB) {
      showToast("Isi teks/gambar soal, mata pelajaran, dan minimal teks/gambar opsi A & B.", "error");
      return;
    }

    const plottedForMapel = getPlottedKelasIdsForMapel(soalMapel);
    const effectiveKelasIds = soalKelasIds && soalKelasIds.length > 0 ? soalKelasIds : plottedForMapel;

    const cleanOpsiGambar: Partial<Record<OpsiKey, string>> = {};
    (["A", "B", "C", "D", "E"] as const).forEach((k) => {
      const val = opsiGambar[k]?.trim();
      if (val) cleanOpsiGambar[k] = val;
    });

    const items = [...(getDB.soal() as Soal[])];
    const newSoal: Soal = {
      id: "soal_guru_" + Date.now(),
      mapelId: soalMapel,
      teks: soalTeks.trim() || "(Lihat gambar soal di atas)",
      opsi: { ...opsi },
      kunci: soalKunci,
      guruId: currentGuru.id,
      kelasIds: effectiveKelasIds,
    };
    if (soalImg && soalImg.trim()) {
      newSoal.gambarUrl = soalImg.trim();
    }
    if (Object.keys(cleanOpsiGambar).length > 0) {
      newSoal.opsiGambar = cleanOpsiGambar;
    }

    items.push(newSoal);
    setDB.soal(items);

    const normIds = normalizeSoalKelasIds(effectiveKelasIds);
    const targetGroupKey = normIds.length === 0 ? `${soalMapel}__umum` : `${soalMapel}__${normIds.join("|")}`;
    setExpandedGuruGroupKey(targetGroupKey);

    setSoalTeks("");
    setSoalImg("");
    setOpsi({ A: "", B: "", C: "", D: "", E: "" });
    setOpsiGambar({});
    showToast("Soal berhasil disimpan ke kelompok kelas yang dipilih!", "success");
  };

  const handleSaveMassSoal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!soalMapel) {
      showToast("Silakan pilih Mata Pelajaran target terlebih dahulu!", "error");
      return;
    }
    if (!massText.trim() && !massDocxResult) {
      showToast("Silakan upload file Word (.docx) atau tempel teks soal terlebih dahulu!", "error");
      return;
    }

    try {
      const parseResult = massDocxResult ?? parseMassSoalText(massText);
      if (parseResult.questions.length === 0) {
        showToast("Tidak ada soal yang terdeteksi. Periksa kembali format penomoran & opsi jawaban.", "error");
        return;
      }

      const plottedForMassDone = getPlottedKelasIdsForMapel(soalMapel);
      const effectiveMassKelasDone = soalKelasIds && soalKelasIds.length > 0 ? soalKelasIds : plottedForMassDone;

      const parsedSoals = buildSoalObjectsFromParsed(parseResult.questions, {
        mapelId: soalMapel,
        guruId: currentGuru.id,
        kelasIds: effectiveMassKelasDone,
        idPrefix: "soal_guru_",
      });

      const updated = [...(getDB.soal() as Soal[]), ...parsedSoals];
      const normIds = normalizeSoalKelasIds(effectiveMassKelasDone);
      const targetGroupKey = normIds.length === 0 ? `${soalMapel}__umum` : `${soalMapel}__${normIds.join("|")}`;
      const targetNames =
        normIds.length > 0
          ? dbState.kelasAkademik
              .filter((ka) => normIds.includes(ka.id))
              .map((ka) => ka.nama)
              .join(", ")
          : "Semua Kelas / Umum";

      setDB.soal(updated);
      setMassText("");
      setMassDocxName("");
      setMassDocxResult(null);
      setShowMassPreviewModal(false);
      setExpandedGuruGroupKey(targetGroupKey);

      const skippedNote =
        parseResult.skipped.length > 0 ? ` (${parseResult.skipped.length} blok dilewati karena opsi A/B kurang)` : "";
      showToast(
        `Berhasil mengimpor ${parsedSoals.length} Butir Soal ke [${targetNames}]!${skippedNote}`,
        "success"
      );
    } catch (err) {
      showToast("Terjadi kegagalan parsing naskah: " + String(err), "error");
    }
  };

  const handleDeleteSoal = (id: string) => {
    setDB.deleteSoal(id);
  };

  const handleDeleteHasil = (id: string) => {
    if (confirm("Apakah Anda yakin ingin menghapus 1 data hasil ujian ini dari server?")) {
      setDB.deleteHasil(id, dbState.hasil);
      alert("Hasil ujian berhasil dihapus.");
    }
  };

  // Base results belonging to subjects AND specific classes taught by this teacher
  const getTeacherBaseResults = () => {
    const teacherMapelIds = guruAmpuanMapelIds;
    return dbState.hasil.filter((h) => {
      if (teacherMapelIds.length === 0) return true;
      const matchMapel = dbState.mapel.find((m) => m.nama === h.mapelNama || m.id === h.mapelId);
      const resolvedMapelId = matchMapel?.id || h.mapelId || "";
      if (!teacherMapelIds.includes(resolvedMapelId)) return false;

      // Enforce per-mapel class restriction if Admin plotted specific classes for this teacher
      const allowedKelasIds = getPlottedKelasIdsForMapel(resolvedMapelId);
      if (allowedKelasIds.length === 0) return true;

      const siswaKelasNorm = normalizeClassMatchStr(h.siswaKelas || "");
      return allowedKelasIds.some((kId) => {
        const kaObj = dbState.kelasAkademik.find((ka) => ka.id === kId);
        return (
          normalizeClassMatchStr(kaObj ? kaObj.nama : kId) === siswaKelasNorm ||
          kId === h.siswaKelas
        );
      });
    });
  };

  // Apply Mapel, Kelas / Angkatan, and Search filters to teacher results
  const getFilteredTeacherResults = () => {
    return getTeacherBaseResults().filter((h) => {
      if (hasilFilterMapel) {
        const selectedMapelObj = dbState.mapel.find((m) => m.id === hasilFilterMapel);
        const matchById = h.mapelId && h.mapelId === hasilFilterMapel;
        const matchByName = selectedMapelObj && h.mapelNama === selectedMapelObj.nama;
        if (!matchById && !matchByName) return false;
      }

      if (hasilFilterKelas) {
        const siswaKelas = (h.siswaKelas || "").trim();
        if (hasilFilterKelas.startsWith("grade:")) {
          const targetLvl = hasilFilterKelas.replace("grade:", "");
          if (getGradeLevel(siswaKelas) !== targetLvl) return false;
        } else {
          if (siswaKelas.toLowerCase() !== hasilFilterKelas.trim().toLowerCase()) return false;
        }
      }

      if (hasilSearch.trim()) {
        const q = hasilSearch.trim().toLowerCase();
        const matchNama = (h.siswaNama || "").toLowerCase().includes(q);
        const matchKelas = (h.siswaKelas || "").toLowerCase().includes(q);
        const matchMapel = (h.mapelNama || "").toLowerCase().includes(q);
        if (!matchNama && !matchKelas && !matchMapel) return false;
      }

      return true;
    });
  };

  const handleDownloadExcel = () => {
    const filteredHasil = getFilteredTeacherResults();

    if (filteredHasil.length === 0) {
      alert("Tidak ada data nilai ujian siswa yang sesuai filter untuk diunduh.");
      return;
    }

    const rows = filteredHasil.map((h, idx) => {
      const matchSiswa = (dbState.siswa || []).find(
        (s) => s.nisn === h.siswaNisn || s.nama.toLowerCase() === h.siswaNama.toLowerCase()
      );
      return {
        "No": idx + 1,
        "No. Peserta": matchSiswa?.noPeserta || "-",
        "NISN": matchSiswa?.nisn || h.siswaNisn || "-",
        "Nama Lengkap Siswa": h.siswaNama,
        "Kelas": h.siswaKelas,
        "Mata Pelajaran": h.mapelNama,
        "Benar": h.benar ?? "-",
        "Salah": h.salah ?? "-",
        "Nilai / Skor": h.nilai,
        "Status Kelulusan": h.nilai >= 75 ? "LULUS" : "REMIDI",
        "Waktu Pengumpulan": h.waktuSelesai || h.tanggalSelesai || new Date().toLocaleString("id-ID"),
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(rows);

    // Auto-fit column widths for clear readability in Excel
    worksheet["!cols"] = [
      { wch: 6 },  // No
      { wch: 18 }, // No Peserta
      { wch: 16 }, // NISN
      { wch: 28 }, // Nama Siswa
      { wch: 14 }, // Kelas
      { wch: 26 }, // Mata Pelajaran
      { wch: 10 }, // Benar
      { wch: 10 }, // Salah
      { wch: 14 }, // Nilai / Skor
      { wch: 18 }, // Status
      { wch: 22 }, // Waktu Pengumpulan
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Rekap Nilai Siswa");

    const cleanGuruName = (currentGuru.nama || "Guru").replace(/[^a-zA-Z0-9]/g, "_");
    const mapelObj = hasilFilterMapel ? dbState.mapel.find((m) => m.id === hasilFilterMapel) : null;
    const mapelSlug = mapelObj ? `_${mapelObj.nama.replace(/[^a-zA-Z0-9]/g, "_")}` : "";
    const kelasSlug = hasilFilterKelas
      ? `_${hasilFilterKelas.replace("grade:", "Angkatan_").replace(/[^a-zA-Z0-9_]/g, "_")}`
      : "";
    const todayStr = new Date().toISOString().split("T")[0];
    XLSX.writeFile(workbook, `Rekap_Nilai_CBT_${cleanGuruName}${mapelSlug}${kelasSlug}_${todayStr}.xlsx`);
  };

  // Dynamically match logged-in Guru with any matching Pengawas account (by Username, NIP, or Name)
  const matchingPengawas = dbState.pengawas?.find(
    (p) =>
      p.username.toLowerCase() === guruUser.toLowerCase() ||
      (p.nip && currentGuru.nip && p.nip.replace(/\s+/g, "") === currentGuru.nip.replace(/\s+/g, "")) ||
      (p.nama && currentGuru.nama && p.nama.toLowerCase().replace(/[^a-z0-9]/g, "") === currentGuru.nama.toLowerCase().replace(/[^a-z0-9]/g, ""))
  );

  // Derive proctor schedule from real database records dynamically
  const proctorSchedule = (dbState.jadwalNgawas || [])
    .filter((jn) => matchingPengawas && jn.pengawasId === matchingPengawas.id)
    .map((jn) => {
      const matchMapel = dbState.mapel.find((m) => m.id === jn.mapelId);
      const mapelNama = matchMapel ? `${matchMapel.nama} (${matchMapel.kode})` : "Ujian CBT";
      const matchRuang = dbState.kelas.find((k) => k.id === jn.ruangId);
      const ruangNama = matchRuang ? matchRuang.nama : "Ruang Ujian";

      // Parse and format Date
      let formattedHari = "Hari Ujian";
      let formattedTanggal = jn.tanggal || "";
      if (jn.tanggal) {
        try {
          const dateObj = new Date(jn.tanggal);
          if (!isNaN(dateObj.getTime())) {
            const indonesianWeekday = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"][dateObj.getDay()];
            const indonesianMonths = [
              "Januari", "Februari", "Maret", "April", "Mei", "Juni",
              "Juli", "Agustus", "September", "Oktober", "November", "Desember"
            ];
            formattedHari = indonesianWeekday;
            formattedTanggal = `${dateObj.getDate()} ${indonesianMonths[dateObj.getMonth()]} ${dateObj.getFullYear()}`;
          }
        } catch (err) {
          console.error("Format date error in proctor schedule:", err);
        }
      }

      return {
        hari: formattedHari,
        tanggal: formattedTanggal,
        sesi: jn.sesi || "Sesi I",
        ruang: ruangNama,
        mapel: mapelNama,
        kelas: "Seluruh Peserta Terplot",
        status: "Aktif" as const,
      };
    });

  const guruMenuItems = [
    { id: "banksoal", label: "Bank Soal Saya", icon: BookOpen },
    { id: "hasil", label: "Hasil Ujian Siswa", icon: Award },
    { id: "jadwal", label: "Jadwal Pengawas", icon: Calendar },
  ];

  return (
    <div className="flex flex-col lg:flex-row bg-white text-slate-800 min-h-[580px] h-full rounded-2xl overflow-hidden border border-slate-200 shadow-sm text-left relative">
      {/* 1. MOBILE TOP NAVIGATION BAR (Visible only on < lg) */}
      <div className="lg:hidden w-full bg-slate-50 border-b border-slate-200 p-3 sm:p-4 flex items-center justify-between select-none shrink-0 z-30">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded bg-[#0666AE]/10 text-[#0666AE] border border-[#0666AE]/20">
            <Shield size={16} />
          </div>
          <div>
            <h2 className="text-[9px] font-bold text-slate-400 uppercase tracking-widest leading-none">PORTAL GURU</h2>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="text-xs font-black text-slate-800">
                {guruMenuItems.find((m) => m.id === activeMenu)?.label || "Menu Guru"}
              </span>
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
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5 text-xs p-1">
              {guruMenuItems.map((m) => {
                const Icon = m.icon;
                const isActive = activeMenu === m.id;
                return (
                  <button
                    key={m.id}
                    onClick={() => {
                      setActiveMenu(m.id);
                      setMobileNavOpen(false);
                    }}
                    className={`flex items-center gap-2.5 p-3 rounded-xl text-left font-bold transition cursor-pointer ${
                      isActive
                        ? "bg-[#0666AE] text-white shadow-sm"
                        : "bg-white text-slate-700 hover:bg-slate-100 border border-slate-200/60"
                    }`}
                  >
                    <Icon size={15} className={isActive ? "text-white" : "text-[#0666AE]"} />
                    <span>{m.label}</span>
                  </button>
                );
              })}
            </div>
            <div className="mt-2 pt-2 border-t border-slate-200 flex justify-between items-center text-[10px] px-1">
              <span className="text-slate-500 font-mono font-bold truncate">Guru: {currentGuru.nama}</span>
              <button
                onClick={onLogout}
                className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg font-bold flex items-center gap-1 cursor-pointer transition"
              >
                <LogOut size={11} />
                <span>Keluar</span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 2. DESKTOP PERMANENT SIDEBAR */}
      <aside className="hidden lg:flex w-64 bg-slate-50 border-r border-slate-250/70 flex-col justify-between shrink-0 select-none">
        <div>
          <div className="p-5 border-b border-slate-250/70 bg-slate-100/50">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded bg-[#0666AE]/10 text-[#0666AE] border border-[#0666AE]/20 shadow-inner">
                <Shield size={18} />
              </div>
              <div className="text-left">
                <h2 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none">PORTAL GURU</h2>
                <h1 className="text-sm font-bold text-slate-800 mt-1 line-clamp-1">{currentGuru.nama}</h1>
              </div>
            </div>
            <p className="text-[10px] text-[#0666AE] font-mono mt-2 bg-indigo-50/60 p-1.5 rounded border border-[#0666AE]/15 text-center font-bold">
              NIP: {currentGuru.nip}
            </p>
            {guruMapels.length > 0 && (
              <div className="mt-2.5 p-2 bg-white rounded-xl border border-slate-200/80 space-y-1 text-left">
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-wider">
                  Mapel & Kelas Ampuan:
                </p>
                <div className="space-y-1 max-h-24 overflow-y-auto pr-0.5">
                  {guruMapels.map((m) => {
                    const pKelasIds = getPlottedKelasIdsForMapel(m.id);
                    const pKelasLabel =
                      pKelasIds.length > 0
                        ? pKelasIds
                            .map((kId) => dbState.kelasAkademik.find((ka) => ka.id === kId)?.nama || kId)
                            .join(", ")
                        : "Semua Kelas";
                    return (
                      <div key={m.id} className="text-[10px] leading-tight">
                        <span className="font-extrabold text-slate-700">{m.nama}:</span>{" "}
                        <span className="font-bold text-emerald-700">{pKelasLabel}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          <nav className="p-3 flex flex-col gap-1.5 text-xs">
            {guruMenuItems.map((m) => {
              const Icon = m.icon;
              const isActive = activeMenu === m.id;
              return (
                <button
                  key={m.id}
                  onClick={() => setActiveMenu(m.id)}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-left font-semibold transition-all duration-300 cursor-pointer ${
                    isActive
                      ? "bg-[#0666AE] text-white shadow-sm font-extrabold"
                      : "text-slate-600 hover:bg-slate-200/50 hover:text-slate-900"
                  }`}
                >
                  <Icon size={16} />
                  <span>{m.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        <div className="p-4 border-t border-slate-200 bg-slate-100/50 text-xs">
          <p className="text-slate-400 text-[10px]">Identitas CBT:</p>
          <p className="font-mono text-[#0666AE] truncate text-[11px] font-bold">{guruUser}@almasum.sch.id</p>
          <button
            onClick={onLogout}
            className="mt-3.5 w-full py-2 px-3 bg-white border border-slate-200 text-slate-600 hover:text-red-650 rounded-xl flex items-center justify-center gap-1.5 cursor-pointer hover:bg-red-50 hover:border-red-200 transition-all font-bold text-[11px] shadow-sm"
          >
            <LogOut size={12} className="text-red-500" />
            <span>Keluar Sesi Guru</span>
          </button>
        </div>
      </aside>

      {/* Main Container */}
      <main className="flex-1 p-3 sm:p-6 overflow-y-auto bg-white flex flex-col justify-start">
        {/* Sync & Toast Banners */}
        {syncStatus.lastError && (
          <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs font-bold flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <AlertCircle size={15} className="shrink-0 text-rose-600" />
              <span>{syncStatus.lastError}</span>
            </div>
            <button
              type="button"
              onClick={clearSyncError}
              className="p-1 text-rose-500 hover:bg-rose-100 rounded-lg cursor-pointer"
            >
              <X size={14} />
            </button>
          </div>
        )}

        {toastMsg && (
          <div
            className={`mb-4 p-3 rounded-xl border text-xs font-bold flex items-center justify-between gap-2 shadow-xs ${
              toastMsg.type === "error"
                ? "bg-rose-50 border-rose-200 text-rose-800"
                : "bg-emerald-50 border-emerald-200 text-emerald-800"
            }`}
          >
            <div className="flex items-center gap-2">
              {toastMsg.type === "error" ? (
                <AlertCircle size={15} className="shrink-0 text-rose-600" />
              ) : (
                <CheckCircle2 size={15} className="shrink-0 text-emerald-600" />
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

        <div className="pb-3 border-b border-slate-200 mb-6 text-left flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">PANEL DEWAN GURU MADRASAH</p>
            <h2 className="text-lg font-extrabold text-slate-800 uppercase tracking-tight mt-1">
              {dbState.konfig.namaSekolah}
            </h2>
          </div>
          <div className="text-[10px] font-bold px-2.5 py-1 rounded-lg border bg-slate-50 border-slate-200 text-slate-600 flex items-center gap-1.5">
            <span
              className={`w-2 h-2 rounded-full ${
                syncStatus.pendingCount > 0 ? "bg-amber-500 animate-ping" : "bg-emerald-500"
              }`}
            />
            <span>{syncStatus.pendingCount > 0 ? "Menyimpan ke Cloud..." : "Tersinkron Realtime"}</span>
          </div>
        </div>

        {guruMapels.length === 0 && (
          <div className="bg-amber-50 border border-amber-250 p-4 rounded-xl text-amber-800 text-xs font-semibold leading-normal mb-6 flex items-start gap-2.5">
            <span className="text-lg mt-0.5 shrink-0">🚨</span>
            <div>
              <p className="font-bold">Akses Terbatas: Belum Ada Mata Pelajaran Diampu</p>
              <p className="text-slate-600 font-medium mt-0.5">
                Anda belum diplot untuk mengampu mata pelajaran apapun oleh Administrator Utama. Hubungi admin untuk memplot/memetakan mata pelajaran yang Anda ampu agar Anda bisa membuat soal dan melihat hasil ujian untuk mata pelajaran tersebut.
              </p>
            </div>
          </div>
        )}

        {/* --------------------------------------------------------------------
            VIEW 1: BANK SOAL SAYA WITH ANIMS
            -------------------------------------------------------------------- */}
        <AnimatePresence mode="wait">
          {activeMenu === "banksoal" && (
            <motion.div
              key="banksoal-panel"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.25 }}
              className="space-y-6 text-left"
            >
              <div className="flex justify-between items-center pb-1 border-b border-slate-100">
                <h3 className="text-xs font-extrabold text-slate-500 uppercase tracking-widest">
                  BANK SOAL MANDIRI DEWAN GURU ({guruSoals.length} Butir Soal Terpublikasi)
                </h3>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                {/* Form Input with Individual & Mass Tabs */}
                <div className="p-5 bg-slate-50/55 border border-slate-200 rounded-2xl text-xs space-y-4 lg:col-span-5 shadow-sm">
                  {/* Tab Selector */}
                  <div className="flex bg-slate-250 p-1 rounded-xl border border-slate-200">
                    <button
                      type="button"
                      onClick={() => setSoalInputMode("individual")}
                      className={`flex-1 py-1.5 rounded-lg font-bold text-center transition-all cursor-pointer ${
                        soalInputMode === "individual"
                          ? "bg-[#0666AE] text-white shadow-sm"
                          : "text-slate-600 hover:text-slate-800 hover:bg-slate-300/30"
                      }`}
                    >
                      Input Manual Soal (PG)
                    </button>
                    <button
                      type="button"
                      onClick={() => setSoalInputMode("mass")}
                      className={`flex-1 py-1.5 rounded-lg font-bold text-center transition-all cursor-pointer flex items-center justify-center gap-1 ${
                        soalInputMode === "mass"
                          ? "bg-[#0666AE] text-white shadow-sm"
                          : "text-slate-600 hover:text-slate-800 hover:bg-slate-300/30"
                      }`}
                    >
                      <span>Masal via Word/Teks 📥</span>
                    </button>
                  </div>

                  {/* Target Subject Selector */}
                  <div className="space-y-1">
                    <label className="text-[10px] text-slate-500 font-extrabold uppercase">MATA PELAJARAN TARGET</label>
                    <select
                      value={soalMapel}
                      onChange={(e) => setSoalMapel(e.target.value)}
                      className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-slate-700 font-bold focus:outline-none focus:border-[#0666AE] cursor-pointer shadow-sm"
                    >
                      {guruMapels.length === 0 ? (
                        <option value="">Tidak ada mapel diampui</option>
                      ) : (
                        guruMapels.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.nama} ({m.kode})
                          </option>
                        ))
                      )}
                    </select>
                  </div>

                  {/* Target Academic Classes Multi-Select + Quick Angkatan Buttons (Scoped by Teacher Plot) */}
                  {(() => {
                    const plottedForSelectedMapel = getPlottedKelasIdsForMapel(soalMapel);
                    const isClassRestricted = plottedForSelectedMapel.length > 0;
                    const selectableKelas = isClassRestricted
                      ? dbState.kelasAkademik.filter((ka) => plottedForSelectedMapel.includes(ka.id))
                      : dbState.kelasAkademik;
                    const selectedMapelObj = guruMapels.find((m) => m.id === soalMapel);

                    return (
                      <div className="space-y-2 p-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs">
                        <div className="flex flex-wrap items-center justify-between gap-1.5">
                          <label className="text-[10px] text-slate-600 font-extrabold uppercase">
                            SASARAN KELAS / ANGKATAN TARGET
                          </label>
                          <span className="text-[9px] font-black px-2 py-0.5 rounded bg-sky-100 text-[#0666AE]">
                            {soalKelasIds.length === 0
                              ? isClassRestricted
                                ? "Otomatis Kelas Ampuan"
                                : "Umum / Semua Kelas"
                              : `${soalKelasIds.length} Kelas Dipilih`}
                          </span>
                        </div>

                        {isClassRestricted && (
                          <div className="p-2 bg-emerald-50 border border-emerald-200 rounded-xl text-[10px] text-emerald-800 font-semibold">
                            Plotting <strong>{selectedMapelObj?.nama}</strong> Anda:{" "}
                            <span className="font-extrabold">
                              {selectableKelas.map((ka) => ka.nama).join(", ")}
                            </span>
                          </div>
                        )}

                        {/* Quick Angkatan / Class Selector Buttons */}
                        <div className="flex flex-wrap gap-1.5 pb-1">
                          {!isClassRestricted &&
                            (["VII", "VIII", "IX"] as const).map((lvl) => {
                              const lvlIds = dbState.kelasAkademik
                                .filter((ka) => getGradeLevel(ka.nama) === lvl)
                                .map((ka) => ka.id);
                              if (lvlIds.length === 0) return null;
                              const active = lvlIds.every((id) => soalKelasIds.includes(id));
                              return (
                                <button
                                  key={lvl}
                                  type="button"
                                  onClick={() => applyAngkatanQuickSelect(lvl, setSoalKelasIds)}
                                  className={`px-2 py-1 rounded-lg text-[10px] font-extrabold border transition cursor-pointer ${
                                    active
                                      ? "bg-[#0666AE] text-white border-[#0666AE] shadow-xs"
                                      : "bg-white text-slate-600 border-slate-200 hover:bg-slate-100"
                                  }`}
                                >
                                  {active ? `✓ Angkatan ${lvl}` : `+ Angkatan ${lvl}`}
                                </button>
                              );
                            })}
                          <button
                            type="button"
                            onClick={() => setSoalKelasIds(selectableKelas.map((ka) => ka.id))}
                            className="px-2 py-1 rounded-lg text-[10px] font-bold bg-white text-emerald-700 border border-emerald-200 hover:bg-emerald-50 cursor-pointer transition"
                          >
                            {isClassRestricted ? "Pilih Semua Kelas Ampuan" : "Pilih Semua"}
                          </button>
                          {soalKelasIds.length > 0 && (
                            <button
                              type="button"
                              onClick={() => setSoalKelasIds([])}
                              className="px-2 py-1 rounded-lg text-[10px] font-bold bg-white text-rose-600 border border-rose-200 hover:bg-rose-50 cursor-pointer transition"
                            >
                              {isClassRestricted ? "Kosongkan Pilihan" : "Reset (Umum)"}
                            </button>
                          )}
                        </div>

                        <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto pt-1 border-t border-slate-200/70">
                          {selectableKelas.map((ka) => {
                            const isChecked = soalKelasIds.includes(ka.id);
                            return (
                              <label
                                key={ka.id}
                                className={`flex items-center gap-1.5 cursor-pointer font-bold text-[11px] p-1.5 px-2.5 rounded-lg border select-none transition-all ${
                                  isChecked
                                    ? "bg-sky-50 text-[#0666AE] border-[#0666AE]/40 shadow-2xs"
                                    : "bg-white text-slate-650 border-slate-200 hover:bg-slate-50"
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => {
                                    if (isChecked) {
                                      setSoalKelasIds(soalKelasIds.filter((id) => id !== ka.id));
                                    } else {
                                      setSoalKelasIds([...soalKelasIds, ka.id]);
                                    }
                                  }}
                                  className="rounded text-[#0666AE] focus:ring-0"
                                />
                                <span>{ka.nama}</span>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })()}

                  {soalInputMode === "individual" ? (
                    <form onSubmit={handleSaveSoal} className="space-y-4">
                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <label className="text-[10px] text-slate-500 font-extrabold uppercase">
                            PERTANYAAN / TEKS SOAL (Dukung Arab RTL & Rumus $...$)
                          </label>
                        </div>
                        <textarea
                          dir="auto"
                          rows={3}
                          value={soalTeks}
                          onChange={(e) => setSoalTeks(e.target.value)}
                          placeholder="Tuliskan pertanyaan ujian (Bahasa Indonesia / Arab / Inggris / Rumus Matematika seperti $\frac{1}{2}$ atau $\sqrt{16}$)..."
                          className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-slate-800 font-sans focus:outline-none focus:border-[#0666AE] bidi-plaintext"
                        />
                        {soalTeks.trim() && (
                          <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-[11.5px] text-slate-700">
                            <span className="text-[9px] font-black uppercase text-slate-400 block mb-1">Pratinjau Tampilan Siswa:</span>
                            <RichMathText text={soalTeks} />
                          </div>
                        )}
                      </div>

                      <div className="space-y-2 p-3 bg-slate-50 border border-slate-200 rounded-2xl">
                        <label className="text-[10px] text-slate-600 font-extrabold uppercase my-1 block">Lampiran Gambar Soal (Opsional)</label>
                        <div className="flex flex-col sm:flex-row gap-2">
                          <input
                            type="text"
                            value={soalImg}
                            onChange={(e) => setSoalImg(e.target.value)}
                            placeholder="Tempel URL Gambar atau upload berkas..."
                            className="flex-1 p-2.5 bg-white border border-slate-250 rounded-xl text-slate-800 font-mono text-[10px] focus:outline-none focus:border-[#0666AE]"
                          />
                          <label className="flex items-center justify-center gap-1.5 px-3 py-2 bg-[#0666AE] hover:bg-[#0666AE]/95 text-white font-extrabold uppercase rounded-xl text-[9px] cursor-pointer transition select-none shadow-sm shrink-0">
                            <Upload size={12} />
                            <span>Upload File</span>
                            <input
                              type="file"
                              accept="image/*"
                              onChange={(e) => handleFileChange(e, setSoalImg)}
                              className="hidden"
                            />
                          </label>
                        </div>
                        {soalImg && (
                          <div className="pt-2 flex items-center gap-3 bg-white p-2 rounded-xl border border-slate-155">
                            <div className="relative w-14 h-14 rounded-lg overflow-hidden border border-slate-200 bg-slate-100 flex items-center justify-center shrink-0">
                              <img src={soalImg} alt="Preview" className="w-full h-full object-cover" />
                            </div>
                            <div className="flex-1 overflow-hidden">
                              <p className="text-[9px] font-mono text-slate-400 truncate">{soalImg.startsWith("data:") ? "Berkas Gambar Berhasil Diunggah" : soalImg}</p>
                            </div>
                            <button
                              type="button"
                              onClick={() => setSoalImg("")}
                              className="p-1 text-red-500 hover:bg-red-50 rounded-lg transition cursor-pointer"
                              title="Hapus gambar"
                            >
                              <X size={14} />
                            </button>
                          </div>
                        )}
                      </div>

                      <div className="space-y-2.5 p-3 bg-white border border-slate-200/70 rounded-xl shadow-inner">
                        <label className="text-[9px] text-[#0666AE] font-black uppercase tracking-wider block">
                          Opsi Jawaban Lembaran A-E (Bisa Teks, Rumus, Arab, & Gambar Opsi!)
                        </label>
                        {(["A", "B", "C", "D", "E"] as const).map((o) => {
                          const optImg = opsiGambar[o] || "";
                          return (
                            <div key={o} className="space-y-1.5 p-2 rounded-xl bg-slate-50/70 border border-slate-200/70">
                              <div className="flex gap-2 items-center">
                                <span className="font-extrabold text-[#0666AE] w-4 font-mono">{o}</span>
                                <input
                                  dir={isArabicDominant(opsi[o]) ? "rtl" : "ltr"}
                                  type="text"
                                  value={opsi[o]}
                                  onChange={(e) => setOpsi({ ...opsi, [o]: e.target.value })}
                                  placeholder={`Teks Opsi ${o} (kosongkan jika hanya gambar)...`}
                                  className={`flex-1 p-1.5 bg-white border border-slate-200 rounded-lg text-xs focus:outline-none focus:border-[#0666AE] text-slate-800 bidi-plaintext ${
                                    hasArabicText(opsi[o]) ? "font-arabic text-sm" : ""
                                  }`}
                                />
                                <label
                                  className="px-2 py-1.5 bg-sky-50 hover:bg-sky-100 text-[#0666AE] border border-sky-200 rounded-lg text-[9px] font-extrabold cursor-pointer flex items-center gap-1 shrink-0 transition"
                                  title={`Upload gambar untuk jawaban Opsi ${o}`}
                                >
                                  <ImageIcon size={12} />
                                  <span>Gambar {o}</span>
                                  <input
                                    type="file"
                                    accept="image/*"
                                    onChange={(e) =>
                                      handleFileChange(e, (url) =>
                                        setOpsiGambar((prev) => ({ ...prev, [o]: url }))
                                      )
                                    }
                                    className="hidden"
                                  />
                                </label>
                              </div>
                              {optImg && (
                                <div className="pl-6 flex items-center gap-2">
                                  <img
                                    src={optImg}
                                    alt={`Preview Opsi ${o}`}
                                    className="h-12 w-auto max-w-[140px] object-contain rounded border border-slate-200 bg-white p-0.5"
                                  />
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setOpsiGambar((prev) => {
                                        const next = { ...prev };
                                        delete next[o];
                                        return next;
                                      })
                                    }
                                    className="px-2 py-0.5 text-[9px] font-bold text-rose-600 bg-rose-50 hover:bg-rose-100 rounded border border-rose-200 cursor-pointer"
                                  >
                                    Hapus Gambar {o}
                                  </button>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] text-emerald-600 font-extrabold uppercase">KUNCI JAWABAN BENAR</label>
                        <select
                          value={soalKunci}
                          onChange={(e) => setSoalKunci(e.target.value as any)}
                          className="w-full p-2.5 bg-white border border-slate-200 rounded-xl font-bold text-emerald-600 text-sm focus:outline-none cursor-pointer"
                        >
                          <option value="A">Opsi A</option>
                          <option value="B">Opsi B</option>
                          <option value="C">Opsi C</option>
                          <option value="D">Opsi D</option>
                          <option value="E">Opsi E</option>
                        </select>
                      </div>

                      <button
                        type="submit"
                        className="w-full mt-2 py-3 bg-[#0666AE] hover:bg-[#0666AE]/95 text-white rounded-xl font-extrabold uppercase transition-all shadow-sm cursor-pointer flex items-center justify-center gap-1.5"
                      >
                        <Upload size={14} />
                        <span>Rilis Butir Soal Baru</span>
                      </button>
                    </form>
                  ) : (
                    <form onSubmit={handleSaveMassSoal} className="space-y-4">
                      {/* DIRECT WORD (.DOCX) UPLOAD BOX */}
                      <div className="p-4 bg-gradient-to-br from-sky-50 to-indigo-50/60 border border-sky-200 rounded-2xl space-y-2.5">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <div className="p-1.5 bg-[#0666AE] text-white rounded-lg">
                              <FileText size={14} />
                            </div>
                            <div>
                              <p className="text-[10px] font-black text-[#0666AE] uppercase tracking-wider">
                                UPLOAD FILE WORD (.DOCX) LANGSUNG
                              </p>
                              <p className="text-[9.5px] text-slate-600 font-semibold">
                                Otomatis membaca soal, gambar soal & gambar opsi, Bahasa Arab, Inggris, & Rumus Matematika Word!
                              </p>
                            </div>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          <label className="flex items-center justify-center gap-1.5 px-3.5 py-2 bg-[#0666AE] hover:bg-[#0666AE]/95 text-white font-black uppercase rounded-xl text-[9.5px] cursor-pointer transition select-none shadow-sm">
                            <Upload size={12} />
                            <span>{massDocxLoading ? "Memproses Word..." : "Pilih File Word (.docx)"}</span>
                            <input
                              type="file"
                              accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                              onChange={handleDocxFileChange}
                              disabled={massDocxLoading}
                              className="hidden"
                            />
                          </label>
                          {massDocxName && (
                            <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-lg flex items-center gap-1.5">
                              <span>✓ {massDocxName}</span>
                              <button
                                type="button"
                                onClick={() => {
                                  setMassDocxName("");
                                  setMassDocxResult(null);
                                  setMassText("");
                                }}
                                className="text-rose-500 hover:text-rose-700 cursor-pointer"
                                title="Reset file Word"
                              >
                                <X size={12} />
                              </button>
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <label className="text-[10px] text-slate-500 font-extrabold uppercase">
                            ATAU TEMPEL NASKAH SOAL (WORD / ARAB / INGGRIS / LATEX)
                          </label>
                          {activeMassParse && (
                            <span
                              className={`text-[9.5px] font-black px-2 py-0.5 rounded-lg border ${
                                activeMassParse.questions.length > 0
                                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                  : "bg-amber-50 text-amber-700 border-amber-200"
                              }`}
                            >
                              {activeMassParse.questions.length} Soal Terdeteksi
                              {activeMassParse.skipped.length > 0 ? ` • ${activeMassParse.skipped.length} Perlu Cek` : ""}
                            </span>
                          )}
                        </div>
                        <textarea
                          dir="auto"
                          rows={9}
                          value={massText}
                          onChange={(e) => {
                            setMassDocxResult(null);
                            setMassDocxName("");
                            setMassText(e.target.value);
                          }}
                          placeholder="Upload .docx di atas ATAU salin/tempel soal Anda di sini (mendukung penomoran 1./١., opsi A-E / أ ب ج د هـ, Bahasa Arab, Inggris, & Rumus Matematika $...$)..."
                          className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-slate-800 font-sans text-[11px] leading-relaxed focus:outline-none focus:border-[#0666AE] bidi-plaintext"
                        />
                      </div>

                      {/* LIVE PARSE STATUS & PREVIEW BUTTON */}
                      {activeMassParse && (activeMassParse.questions.length > 0 || activeMassParse.skipped.length > 0) && (
                        <div className="p-3 bg-white border border-slate-200 rounded-2xl space-y-2">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="text-[10.5px] font-bold text-slate-700">
                              Deteksi Otomatis:{" "}
                              <span className="text-emerald-700 font-black">
                                {activeMassParse.questions.length} Soal Siap Masuk
                              </span>
                              {activeMassParse.skipped.length > 0 && (
                                <span className="text-amber-700 font-black ml-1.5">
                                  ({activeMassParse.skipped.length} blok dilewati)
                                </span>
                              )}
                            </div>
                            {activeMassParse.questions.length > 0 && (
                              <button
                                type="button"
                                onClick={() => setShowMassPreviewModal(true)}
                                className="px-2.5 py-1 bg-sky-50 hover:bg-sky-100 text-[#0666AE] border border-sky-200 rounded-lg text-[10px] font-extrabold flex items-center gap-1 cursor-pointer"
                              >
                                <Eye size={12} />
                                <span>Pratinjau Semua ({activeMassParse.questions.length})</span>
                              </button>
                            )}
                          </div>
                          {activeMassParse.skipped.length > 0 && (
                            <div className="p-2 bg-amber-50 border border-amber-200 rounded-xl text-[9.5px] text-amber-800 space-y-1 max-h-24 overflow-y-auto">
                              <p className="font-black">Blok yang perlu dilengkapi sebelum diimpor:</p>
                              {activeMassParse.skipped.map((sk, idx) => (
                                <p key={idx} className="truncate">
                                  • Blok #{sk.index}: {sk.reason} — <span className="italic opacity-80">{sk.preview}</span>
                                </p>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Bulk upload image assistant helper (Question + Options A-E) */}
                      <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
                        <p className="font-extrabold text-[10px] text-[#0666AE] uppercase tracking-wider flex items-center gap-1.5">
                          <Upload size={14} className="text-[#0666AE]" />
                          <span>ALAT BANTU GAMBAR MASSAL (Untuk Soal Maupun Opsi A–E)</span>
                        </p>
                        <p className="text-[10px] text-slate-550 leading-relaxed font-semibold">
                          Jika menempel teks manual & butuh gambar pada soal atau opsi jawaban, unggah gambar di sini lalu salin tag <code className="bg-slate-200 px-1 rounded">Gambar:</code> (untuk pertanyaan) atau <code className="bg-slate-200 px-1 rounded">GambarA:</code>–<code className="bg-slate-200 px-1 rounded">GambarE:</code> (untuk jawaban berupa gambar).
                        </p>

                        <div className="flex items-center gap-3">
                          <label className="flex items-center justify-center gap-1.5 px-3.5 py-2.5 bg-[#0666AE] hover:bg-[#0666AE]/95 text-white font-black uppercase rounded-xl text-[9px] cursor-pointer transition select-none shadow-sm">
                            <Upload size={12} />
                            <span>Pilih Berkas Gambar Lokal</span>
                            <input
                              type="file"
                              accept="image/*"
                              multiple
                              onChange={handleMassFilesChange}
                              className="hidden"
                            />
                          </label>
                        </div>

                        {massImages.length > 0 && (
                          <div className="grid grid-cols-1 gap-2.5 pt-2">
                            {massImages.map((img) => (
                              <div key={img.id} className="p-2.5 bg-white rounded-xl border border-slate-200 flex items-center gap-2.5 shadow-sm">
                                <div className="relative w-10 h-10 rounded-lg overflow-hidden border border-slate-200 bg-slate-50 flex items-center justify-center shrink-0">
                                  <img src={img.data} alt="Helper Preview" className="w-full h-full object-cover" />
                                </div>
                                <div className="flex-1 min-w-0 space-y-1">
                                  <p className="text-[9px] font-bold text-slate-700 truncate" title={img.name}>
                                    {img.name}
                                  </p>
                                  <div className="flex flex-wrap gap-1">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        navigator.clipboard.writeText(`Gambar: ${img.data}`);
                                        showToast(`Tag Gambar Soal untuk "${img.name}" disalin ke clipboard!`, "success");
                                      }}
                                      className="px-2 py-0.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-extrabold rounded text-[8.5px] border border-emerald-200 cursor-pointer"
                                    >
                                      Salin Gambar Soal
                                    </button>
                                    {(["A", "B", "C", "D", "E"] as const).map((k) => (
                                      <button
                                        key={k}
                                        type="button"
                                        onClick={() => {
                                          navigator.clipboard.writeText(`Gambar${k}: ${img.data}`);
                                          showToast(`Tag Gambar Opsi ${k} untuk "${img.name}" disalin ke clipboard!`, "success");
                                        }}
                                        className="px-1.5 py-0.5 bg-sky-50 hover:bg-sky-100 text-[#0666AE] font-extrabold rounded text-[8.5px] border border-sky-200 cursor-pointer"
                                      >
                                        Opsi {k}
                                      </button>
                                    ))}
                                    <button
                                      type="button"
                                      onClick={() => setMassImages((prev) => prev.filter((i) => i.id !== img.id))}
                                      className="p-0.5 text-red-500 hover:bg-red-50 rounded border border-red-100 cursor-pointer ml-auto"
                                      title="Hapus gambar"
                                    >
                                      <X size={12} />
                                    </button>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Formatting guidelines help note */}
                      <div className="bg-amber-50 p-3 rounded-xl border border-amber-200/70 space-y-1 text-[10px] text-amber-800 leading-normal">
                        <p className="font-extrabold uppercase text-[9px] flex items-center gap-1 text-amber-700">
                          <span>💡 FORMAT YANG DIDUKUNG OTOMATIS:</span>
                        </p>
                        <ul className="list-disc list-inside space-y-0.5 text-[9.5px]">
                          <li>File Word <strong>.docx</strong> langsung (tabel, penomoran otomatis, gambar soal & opsi, Equation rumus)</li>
                          <li>Bahasa Arab (<code className="bg-amber-100 px-1">١. ٢.</code> &amp; opsi <code className="bg-amber-100 px-1">أ. ب. ج. د. هـ.</code>), Bahasa Inggris, &amp; Matematika (<code className="bg-amber-100 px-1">$\frac&#123;a&#125;&#123;b&#125;$</code>)</li>
                          <li>Kunci via baris <code className="bg-amber-100 px-1">Kunci: A</code>, tanda <code className="bg-amber-100 px-1">*A.</code>, atau daftar kunci di akhir naskah</li>
                        </ul>
                      </div>

                      <button
                        type="submit"
                        className="w-full mt-2 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-extrabold uppercase transition-all shadow-sm cursor-pointer flex items-center justify-center gap-1.5"
                      >
                        <Plus size={14} />
                        <span>
                          PROSES &amp; IMPOR {activeMassParse?.questions.length ? `${activeMassParse.questions.length} ` : ""}BUTIR SOAL 🚀
                        </span>
                      </button>
                    </form>
                  )}
                </div>

                {/* Grid Soal Guru — Grouped Separately by Mapel + Kelas/Angkatan */}
                <div className="lg:col-span-7 space-y-4">
                  <div className="flex flex-wrap justify-between items-center gap-2 pb-2 border-b border-slate-200/80">
                    <h4 className="text-xs font-black text-[#0666AE] uppercase tracking-wider flex items-center gap-1.5">
                      <FolderOpen size={15} />
                      <span>REPOSITORI BANK SOAL SAYA ({guruSoals.length} Butir Soal)</span>
                    </h4>
                    {selectedGuruSoalIds.length > 0 && (
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() =>
                            handleOpenPlottingModal(
                              `Plotting ${selectedGuruSoalIds.length} Soal Terpilih`,
                              selectedGuruSoalIds,
                              []
                            )
                          }
                          className="px-2.5 py-1 bg-[#0666AE] hover:bg-[#0666AE]/90 text-white rounded-lg text-[10px] font-black uppercase flex items-center gap-1 shadow-sm cursor-pointer"
                        >
                          <Layers size={11} />
                          <span>Plotting {selectedGuruSoalIds.length} Soal Terpilih</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setSelectedGuruSoalIds([])}
                          className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-[10px] font-bold cursor-pointer"
                        >
                          Batal Pilih
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Filter & Search Bar for Guru Repository */}
                  <div className="bg-slate-50/80 p-3 rounded-2xl border border-slate-200 grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
                    <div className="relative">
                      <Search size={13} className="absolute left-2.5 top-2.5 text-slate-400" />
                      <input
                        type="text"
                        value={guruSearchSoal}
                        onChange={(e) => setGuruSearchSoal(e.target.value)}
                        placeholder="Cari teks soal..."
                        className="w-full pl-8 pr-2.5 py-1.5 bg-white border border-slate-200 rounded-xl text-[11px] font-semibold focus:outline-none focus:border-[#0666AE]"
                      />
                    </div>
                    <select
                      value={guruFilterMapel}
                      onChange={(e) => setGuruFilterMapel(e.target.value)}
                      className="w-full p-1.5 px-2.5 bg-white border border-slate-200 rounded-xl text-[11px] font-bold text-[#0666AE] focus:outline-none cursor-pointer"
                    >
                      <option value="">-- Semua Mapel Diampu --</option>
                      {guruMapels.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.nama}
                        </option>
                      ))}
                    </select>
                    <select
                      value={guruFilterKelas}
                      onChange={(e) => setGuruFilterKelas(e.target.value)}
                      className="w-full p-1.5 px-2.5 bg-white border border-slate-200 rounded-xl text-[11px] font-bold text-[#0666AE] focus:outline-none cursor-pointer"
                    >
                      <option value="">-- Semua Kelas / Angkatan --</option>
                      <option value="grade:VII">Angkatan / Kelas VII</option>
                      <option value="grade:VIII">Angkatan / Kelas VIII</option>
                      <option value="grade:IX">Angkatan / Kelas IX</option>
                      <option value="umum">Umum (Tanpa Batasan Kelas)</option>
                      {dbState.kelasAkademik.map((ka) => (
                        <option key={ka.id} value={ka.id}>
                          {ka.nama}
                        </option>
                      ))}
                    </select>
                  </div>

                  {(() => {
                    const filteredGuruSoals = guruSoals.filter((soal) => {
                      if (guruFilterMapel && soal.mapelId !== guruFilterMapel) return false;
                      if (guruSearchSoal) {
                        const kw = guruSearchSoal.toLowerCase();
                        const plainTeks = (soal.teks || "").replace(/\[\[\/?(?:U|TABLE|ROW|CELL|BR)\]\]|<\/?u>/gi, " ").toLowerCase();
                        if (!plainTeks.includes(kw)) return false;
                      }
                      if (guruFilterKelas) {
                        const normIds = normalizeSoalKelasIds(soal.kelasIds);
                        if (guruFilterKelas === "umum") {
                          if (normIds.length > 0) return false;
                        } else if (guruFilterKelas.startsWith("grade:")) {
                          const targetLvl = guruFilterKelas.replace("grade:", "");
                          const matchesLvl = normIds.some((id) => {
                            const kaObj = dbState.kelasAkademik.find((k) => k.id === id);
                            return getGradeLevel(kaObj ? kaObj.nama : id) === targetLvl;
                          });
                          if (!matchesLvl) return false;
                        } else {
                          if (!normIds.includes(guruFilterKelas)) return false;
                        }
                      }
                      return true;
                    });

                    // Build separate groups by Mapel + Normalized Target Kelas Combination
                    const groupsRecord: Record<
                      string,
                      {
                        key: string;
                        mapelId: string;
                        mapelNama: string;
                        kelasIds: string[];
                        kelasLabel: string;
                        angkatanBadge: string;
                        soalList: Soal[];
                      }
                    > = {};

                    filteredGuruSoals.forEach((soal) => {
                      const mapelObj = dbState.mapel.find((m) => m.id === soal.mapelId);
                      const mapelNama = mapelObj ? mapelObj.nama : "Mata Pelajaran";
                      const normIds = normalizeSoalKelasIds(soal.kelasIds);
                      const kelasSignature = normIds.length === 0 ? "umum" : normIds.join("|");
                      const key = `${soal.mapelId}__${kelasSignature}`;

                      if (!groupsRecord[key]) {
                        let kelasLabel = "Semua Kelas / Umum";
                        let angkatanBadge = "UMUM";

                        if (normIds.length > 0) {
                          const names = normIds.map((id) => {
                            const found = dbState.kelasAkademik.find((ka) => ka.id === id);
                            return found ? found.nama : id;
                          });
                          kelasLabel = names.join(", ");
                          const lvls = Array.from(
                            new Set(names.map((n) => getGradeLevel(n)).filter((l) => l !== "Lainnya"))
                          );
                          angkatanBadge = lvls.length > 0 ? `Angkatan ${lvls.join("/")}` : "Kelompok Kelas";
                        }

                        groupsRecord[key] = {
                          key,
                          mapelId: soal.mapelId,
                          mapelNama,
                          kelasIds: normIds,
                          kelasLabel,
                          angkatanBadge,
                          soalList: [],
                        };
                      }
                      groupsRecord[key].soalList.push(soal);
                    });

                    const guruGroupedList = Object.values(groupsRecord)
                      .map((g) => ({
                        ...g,
                        soalList: sortSoalByWordOrder(g.soalList),
                      }))
                      .sort((a, b) => {
                        const mComp = a.mapelNama.localeCompare(b.mapelNama);
                        if (mComp !== 0) return mComp;
                        return a.kelasLabel.localeCompare(b.kelasLabel);
                      });

                    return (
                      <div className="space-y-3 max-h-[650px] overflow-y-auto pr-1">
                        {guruMapels.length === 0 ? (
                          <p className="text-slate-400 italic py-12 text-center bg-slate-50 border border-slate-200 rounded-2xl">
                            Anda belum memiliki mata pelajaran diampu yang disetting oleh Administrator.
                          </p>
                        ) : guruGroupedList.length === 0 ? (
                          <div className="p-10 text-center bg-slate-50 border border-dashed border-slate-250 rounded-2xl space-y-2">
                            <FolderOpen className="mx-auto text-slate-300 h-9 w-9" />
                            <p className="text-slate-600 font-extrabold text-xs uppercase">
                              Belum Ada Kelompok Soal Sesuai Filter
                            </p>
                            <p className="text-slate-400 text-[11px]">
                              Pilih sasaran kelas / angkatan di panel sebelah kiri lalu unggah soal, atau bersihkan filter pencarian di atas.
                            </p>
                          </div>
                        ) : (
                          guruGroupedList.map((group) => {
                            const isExpanded = expandedGuruGroupKey === group.key;
                            const groupSoalIds = group.soalList.map((s) => s.id);
                            const allGroupSelected =
                              groupSoalIds.length > 0 &&
                              groupSoalIds.every((id) => selectedGuruSoalIds.includes(id));

                            return (
                              <div
                                key={group.key}
                                className="bg-white border border-slate-250 rounded-2xl overflow-hidden shadow-sm transition-all"
                              >
                                {/* Group Header */}
                                <div className="p-3.5 bg-slate-50/75 border-b border-slate-200/60 flex items-center justify-between flex-wrap gap-2 text-xs">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setExpandedGuruGroupKey(isExpanded ? null : group.key)
                                    }
                                    className="flex items-center gap-2.5 text-left font-sans cursor-pointer py-0.5 select-none flex-1 min-w-[200px]"
                                  >
                                    <div className="p-2 bg-[#0666AE]/10 text-[#0666AE] rounded-xl border border-[#0666AE]/15 shrink-0">
                                      <FolderOpen size={15} />
                                    </div>
                                    <div className="min-w-0">
                                      <div className="flex flex-wrap items-center gap-1.5">
                                        <h5 className="font-black text-slate-800 uppercase tracking-tight text-[12px]">
                                          {group.mapelNama}
                                        </h5>
                                        <span
                                          className={`px-1.5 py-0.5 rounded text-[9px] font-black uppercase ${
                                            group.angkatanBadge === "UMUM"
                                              ? "bg-amber-100 text-amber-800"
                                              : "bg-indigo-100 text-indigo-800"
                                          }`}
                                        >
                                          {group.angkatanBadge}
                                        </span>
                                      </div>
                                      <p className="text-[10px] text-[#0666AE] font-extrabold mt-0.5 truncate">
                                        Kelompok Kelas: {group.kelasLabel}
                                      </p>
                                    </div>
                                  </button>

                                  <div className="flex flex-wrap items-center gap-1.5">
                                    <span className="bg-sky-50 text-[#0666AE] font-black border border-sky-100 rounded-lg text-[10px] px-2 py-1">
                                      {group.soalList.length} Soal
                                    </span>

                                    <button
                                      type="button"
                                      onClick={() =>
                                        handleOpenPlottingModal(
                                          `Plotting Kelompok: ${group.mapelNama} (${group.kelasLabel})`,
                                          groupSoalIds,
                                          group.kelasIds
                                        )
                                      }
                                      className="p-1 px-2.5 rounded-lg text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 font-extrabold text-[10px] transition cursor-pointer flex items-center gap-1 shadow-xs"
                                      title="Atur ulang / pindahkan seluruh soal dalam kelompok ini ke kelas atau angkatan tertentu"
                                    >
                                      <Layers size={11} />
                                      <span>Plotting Kelompok</span>
                                    </button>

                                    <button
                                      type="button"
                                      onClick={() =>
                                        handleBulkDeleteGuruGroup(
                                          groupSoalIds,
                                          group.mapelNama,
                                          group.kelasLabel
                                        )
                                      }
                                      className="p-1 px-2 rounded-lg text-red-650 bg-red-50 hover:bg-red-100 border border-red-200 font-extrabold text-[10px] transition cursor-pointer flex items-center gap-1 shadow-xs"
                                      title="Hapus khusus kelompok kelas ini saja"
                                    >
                                      <Trash2 size={11} />
                                      <span>Hapus</span>
                                    </button>

                                    <button
                                      type="button"
                                      onClick={() =>
                                        setExpandedGuruGroupKey(isExpanded ? null : group.key)
                                      }
                                      className="text-slate-600 hover:text-slate-800 font-extrabold text-[10px] uppercase border border-slate-200 bg-white rounded-lg px-2 py-1 cursor-pointer"
                                    >
                                      {isExpanded ? "▲ Tutup" : "▼ Detail"}
                                    </button>
                                  </div>
                                </div>

                                {/* Questions belonging to this specific Mapel + Class Group */}
                                {isExpanded && (
                                  <div className="p-4 bg-slate-50/45 border-t border-slate-100 space-y-3">
                                    {/* Group Selection Toolbar for splitting/plotting */}
                                    <div className="flex flex-wrap justify-between items-center gap-2 bg-white p-2.5 rounded-xl border border-slate-200 text-[10px]">
                                      <label className="flex items-center gap-2 font-bold text-slate-700 cursor-pointer select-none">
                                        <input
                                          type="checkbox"
                                          checked={allGroupSelected}
                                          onChange={() => {
                                            if (allGroupSelected) {
                                              setSelectedGuruSoalIds((prev) =>
                                                prev.filter((id) => !groupSoalIds.includes(id))
                                              );
                                            } else {
                                              setSelectedGuruSoalIds((prev) =>
                                                Array.from(new Set([...prev, ...groupSoalIds]))
                                              );
                                            }
                                          }}
                                          className="rounded text-[#0666AE] focus:ring-0"
                                        />
                                        <span>Pilih Semua ({group.soalList.length} Soal) di Kelompok Ini</span>
                                      </label>
                                      <span className="text-slate-400 font-medium">
                                        Centang sebagian soal lalu klik "Plotting Soal Terpilih" di atas untuk memisah/memindahkan ke kelas/angkatan lain.
                                      </span>
                                    </div>

                                    {group.soalList.map((soal, sIdx) => {
                                      const normIds = normalizeSoalKelasIds(soal.kelasIds);
                                      const targetClassNames =
                                        normIds.length > 0
                                          ? dbState.kelasAkademik
                                              .filter((ka) => normIds.includes(ka.id))
                                              .map((ka) => ka.nama)
                                          : ["Semua Kelas / Umum"];
                                      const isSelected = selectedGuruSoalIds.includes(soal.id);

                                      return (
                                        <div
                                          key={soal.id}
                                          className={`p-4 bg-white border rounded-xl space-y-2.5 relative shadow-xs transition-all font-sans ${
                                            isSelected
                                              ? "border-[#0666AE] ring-1 ring-[#0666AE]/20 bg-sky-50/20"
                                              : "border-slate-200 hover:border-[#0666AE]/30"
                                          }`}
                                        >
                                          <div className="flex justify-between items-center bg-slate-50 p-2 rounded-xl border border-slate-200/60 flex-wrap gap-2 text-[10px]">
                                            <label className="font-extrabold text-slate-550 flex items-center gap-2 cursor-pointer select-none">
                                              <input
                                                type="checkbox"
                                                checked={isSelected}
                                                onChange={() => {
                                                  setSelectedGuruSoalIds((prev) =>
                                                    isSelected
                                                      ? prev.filter((id) => id !== soal.id)
                                                      : [...prev, soal.id]
                                                  );
                                                }}
                                                className="rounded text-[#0666AE] focus:ring-0"
                                              />
                                              <span>Sasaran Kelas:</span>
                                              <span className="text-[#0666AE] font-black">
                                                {targetClassNames.join(", ")}
                                              </span>
                                            </label>
                                            <div className="flex gap-1.5 items-center">
                                              <span className="p-1 px-2 text-[9px] bg-emerald-50 text-emerald-600 font-black border border-emerald-100 rounded-lg">
                                                KUNCI: {soal.kunci}
                                              </span>

                                              {/* EDIT BUTTON */}
                                              <button
                                                type="button"
                                                onClick={() => startEditGuruSoal(soal)}
                                                className="flex items-center gap-1.5 px-2.5 py-1.5 text-[10px] font-black text-[#0666AE] bg-sky-50 hover:bg-sky-100 border border-[#0666AE]/20 rounded-lg transition-all cursor-pointer uppercase"
                                                title="Ubah Butir Soal"
                                              >
                                                <Edit size={11} />
                                                <span>Edit Soal</span>
                                              </button>

                                              {/* DELETE BUTTON */}
                                              <button
                                                type="button"
                                                onClick={() => {
                                                  if (
                                                    confirm(
                                                      "Apakah Anda yakin ingin menghapus butir soal ini dari bank soal?"
                                                    )
                                                  ) {
                                                    handleDeleteSoal(soal.id);
                                                    alert("Butir soal berhasil dihapus!");
                                                  }
                                                }}
                                                className="flex items-center gap-1.5 px-2.5 py-1.5 text-[10px] font-black text-red-650 bg-red-50 hover:bg-red-100 border border-red-200 rounded-lg transition-all cursor-pointer uppercase"
                                                title="Hapus Soal"
                                              >
                                                <Trash2 size={11} />
                                                <span>Hapus Soal</span>
                                              </button>
                                            </div>
                                          </div>

                                          {(() => {
                                            const firstLine = (soal.teks || "").split(/\r?\n/).find((l) => l.trim()) || "";
                                            const qFirstRtl = getLineDirection(firstLine) === "rtl";
                                            return (
                                              <div
                                                className={`font-extrabold text-slate-800 mt-2 leading-relaxed text-[12.5px] flex items-start gap-1.5 ${
                                                  qFirstRtl ? "flex-row-reverse" : ""
                                                }`}
                                              >
                                                <span className="shrink-0">{sIdx + 1}.</span>
                                                <div className="flex-1 min-w-0">
                                                  <RichMathText text={soal.teks} />
                                                </div>
                                              </div>
                                            );
                                          })()}

                                          {soal.gambarUrl && (
                                            <div className="bg-slate-50 p-2 rounded-lg border border-slate-150 inline-block max-w-[220px]">
                                              <img
                                                src={soal.gambarUrl}
                                                alt="Lampiran visual"
                                                className="max-h-28 object-contain rounded"
                                              />
                                            </div>
                                          )}

                                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-[11px] pt-2 border-t border-slate-100">
                                            {(() => {
                                              const allOptsArabicRtl = areAllOptionsArabicRtl(soal.opsi);
                                              return (["A", "B", "C", "D", "E"] as const).map((key) => {
                                                const val = soal.opsi[key];
                                                const optImg = soal.opsiGambar?.[key];
                                                if (!val && !optImg) return null;
                                                const isCorrect = key === soal.kunci;
                                                return (
                                                  <div
                                                    key={key}
                                                    className={`p-2 rounded-xl font-semibold border transition-all flex items-start gap-1.5 justify-between ${
                                                      allOptsArabicRtl ? "flex-row-reverse" : ""
                                                    } ${
                                                      isCorrect
                                                        ? "bg-emerald-50 text-emerald-700 border-emerald-250 font-extrabold"
                                                        : "bg-white text-slate-600 border-slate-200"
                                                    }`}
                                                  >
                                                    <div
                                                      className={`flex items-start gap-1.5 flex-1 min-w-0 ${
                                                        allOptsArabicRtl ? "flex-row-reverse" : ""
                                                      }`}
                                                    >
                                                      <strong className="font-mono text-[11px] text-[#0666AE] shrink-0">
                                                        {key}.
                                                      </strong>
                                                      <div
                                                        className={`flex-1 min-w-0 space-y-1 flex flex-col ${
                                                          allOptsArabicRtl ? "items-end" : "items-start"
                                                        }`}
                                                      >
                                                        {optImg && (
                                                          <img
                                                            src={optImg}
                                                            alt={`Gambar Opsi ${key}`}
                                                            className="max-h-20 rounded border border-slate-200 bg-white p-0.5 object-contain"
                                                          />
                                                        )}
                                                        {val && <RichMathText text={val} />}
                                                      </div>
                                                    </div>
                                                    {isCorrect && (
                                                      <Check size={11} className="text-emerald-600 shrink-0 mt-0.5" />
                                                    )}
                                                  </div>
                                                );
                                              });
                                            })()}
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>
                            );
                          })
                        )}
                      </div>
                    );
                  })()}
                </div>
              </div>
            </motion.div>
          )}

          {/* --------------------------------------------------------------------
              VIEW 2: HASIL UJIAN SISWA WITH FILTER & EXCEL EXPORT
              -------------------------------------------------------------------- */}
          {activeMenu === "hasil" && (() => {
            const baseResults = getTeacherBaseResults();
            const teacherResults = getFilteredTeacherResults();
            const scopedKelasIds = hasilFilterMapel
              ? getPlottedKelasIdsForMapel(hasilFilterMapel)
              : guruMapels.length > 0 && guruMapels.every((m) => getPlottedKelasIdsForMapel(m.id).length > 0)
              ? Array.from(new Set(guruMapels.flatMap((m) => getPlottedKelasIdsForMapel(m.id))))
              : [];
            const scopedKelasNames =
              scopedKelasIds.length > 0
                ? dbState.kelasAkademik.filter((ka) => scopedKelasIds.includes(ka.id)).map((ka) => ka.nama)
                : dbState.kelasAkademik.map((ka) => ka.nama);
            const availableClassNames = Array.from(
              new Set([
                ...scopedKelasNames,
                ...baseResults.map((h) => h.siswaKelas).filter(Boolean),
              ])
            ).sort();

            return (
              <motion.div
                key="hasil-panel"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                transition={{ duration: 0.25 }}
                className="space-y-5 text-left"
              >
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-2 border-b border-slate-100">
                  <div>
                    <h3 className="text-xs font-extrabold text-slate-500 uppercase tracking-widest">
                      DAFTAR REKAPAN NILAI SISWA KELAS BIMBINGAN
                    </h3>
                    <p className="text-[11px] text-slate-400 font-medium mt-0.5">
                      Menampilkan <strong className="text-[#0666AE]">{teacherResults.length}</strong> dari {baseResults.length} hasil ujian
                    </p>
                  </div>
                  <button
                    onClick={handleDownloadExcel}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-extrabold flex items-center gap-2 cursor-pointer transition-all shadow-sm hover:shadow active:scale-98"
                  >
                    <FileSpreadsheet size={15} />
                    <span>Download Nilai Excel ({teacherResults.length})</span>
                  </button>
                </div>

                {/* Filter Panel: Mapel, Kelas / Angkatan, & Pencarian */}
                <div className="bg-slate-50/80 p-3.5 rounded-2xl border border-slate-200 grid grid-cols-1 md:grid-cols-4 gap-3 text-xs">
                  <div className="space-y-1">
                    <label className="text-[10px] font-extrabold text-slate-500 uppercase block">
                      Cari Nama Siswa
                    </label>
                    <div className="relative">
                      <Search size={13} className="absolute left-2.5 top-2.5 text-slate-400" />
                      <input
                        type="text"
                        value={hasilSearch}
                        onChange={(e) => setHasilSearch(e.target.value)}
                        placeholder="Ketik nama siswa..."
                        className="w-full pl-8 pr-2.5 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-[#0666AE]"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-extrabold text-slate-500 uppercase block">
                      Filter Mata Pelajaran
                    </label>
                    <select
                      value={hasilFilterMapel}
                      onChange={(e) => setHasilFilterMapel(e.target.value)}
                      className="w-full p-2 bg-white border border-slate-200 rounded-xl font-bold text-[#0666AE] focus:outline-none cursor-pointer"
                    >
                      <option value="">-- Semua Mapel Diampu --</option>
                      {guruMapels.map((m) => (
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
                      value={hasilFilterKelas}
                      onChange={(e) => setHasilFilterKelas(e.target.value)}
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
                    {(hasilFilterMapel || hasilFilterKelas || hasilSearch) ? (
                      <button
                        type="button"
                        onClick={() => {
                          setHasilFilterMapel("");
                          setHasilFilterKelas("");
                          setHasilSearch("");
                        }}
                        className="w-full py-2 px-3 bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 rounded-xl font-extrabold uppercase text-[10px] cursor-pointer transition"
                      >
                        Reset Filter
                      </button>
                    ) : (
                      <div className="w-full py-2 px-3 bg-white border border-slate-200 rounded-xl text-[10px] text-slate-400 font-bold text-center">
                        Download Excel mengikuti filter aktif
                      </div>
                    )}
                  </div>
                </div>

                <div className="bg-white rounded-2xl border border-slate-200 overflow-x-auto text-xs shadow-sm">
                  <table className="w-full text-left text-slate-600">
                    <thead className="bg-[#0666AE]/5 border-b border-slate-200 text-slate-700 uppercase text-[10px] tracking-wider font-extrabold font-sans">
                      <tr>
                        <th className="p-3.5 text-center">No</th>
                        <th className="p-3.5">Nama Siswa</th>
                        <th className="p-3.5">Kelas</th>
                        <th className="p-3.5">Mata Pelajaran</th>
                        <th className="p-3.5 text-center">Skor Akhir</th>
                        <th className="p-3.5 text-center">Status Keamanan</th>
                        <th className="p-3.5 text-center">KKM (75)</th>
                        <th className="p-3.5 text-center w-16">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {teacherResults.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="p-10 text-center italic text-slate-400 font-medium">
                            {baseResults.length === 0
                              ? "Belum ada siswa yang merampungkan lembar ujian mata pelajaran Anda hari ini."
                              : "Tidak ada data nilai ujian yang sesuai dengan filter mapel / kelas / angkatan."}
                          </td>
                        </tr>
                      ) : (
                        teacherResults.map((h, i) => (
                          <tr key={h.id} className="hover:bg-slate-50/50 transition-colors">
                            <td className="p-3.5 text-center font-mono text-slate-400 font-bold">{i + 1}</td>
                            <td className="p-3.5 font-extrabold text-slate-800">{h.siswaNama}</td>
                            <td className="p-3.5 font-bold text-slate-600">{h.siswaKelas}</td>
                            <td className="p-3.5 text-slate-500 font-bold">{h.mapelNama}</td>
                            <td className="p-3.5 text-center font-extrabold font-mono text-[#0666AE] text-sm">
                              {h.nilai}
                            </td>
                            <td className="p-3.5 text-center">
                              <span className={`px-2 py-0.5 rounded-lg text-[9px] font-extrabold uppercase ${
                                h.status === "Diskualifikasi" ? "bg-red-50 text-red-650 border border-red-205" : "bg-emerald-50 text-emerald-600 border border-emerald-100"
                              }`}>
                                {h.status}
                              </span>
                            </td>
                            <td className="p-3.5 text-center">
                              <span className={`px-2 py-0.5 rounded-lg text-[9px] font-extrabold ${
                                h.nilai >= 75 ? "bg-emerald-50 text-emerald-600 border border-emerald-200" : "bg-amber-50 text-amber-700 border border-amber-200"
                              }`}>
                                {h.nilai >= 75 ? "LULUS" : "REMIDI"}
                              </span>
                            </td>
                            <td className="p-3.5 text-center">
                              <button
                                onClick={() => handleDeleteHasil(h.id)}
                                className="text-slate-400 hover:text-red-650 cursor-pointer p-1.5 rounded-lg hover:bg-red-50 transition-colors inline-block"
                                title="Hapus Nilai"
                              >
                                <Trash2 size={13} />
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </motion.div>
            );
          })()}

          {/* --------------------------------------------------------------------
              VIEW 3: JADWAL PENGAWAS WITH ANIMS
              -------------------------------------------------------------------- */}
          {activeMenu === "jadwal" && (
            <motion.div
              key="jadwal-panel"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.25 }}
              className="space-y-6 text-left"
            >
              <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                <h3 className="text-xs font-extrabold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                  <ClipboardList size={18} className="text-[#0666AE]" />
                  JADWAL MENGAWAS DAN ALOKASI RUANGAN CBT
                </h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                {/* Timetable schedule cards */}
                <div className="space-y-4 md:col-span-8">
                  <h4 className="text-xs font-extrabold text-slate-700 uppercase pb-1 flex items-center gap-1.5">
                    <Clock size={14} className="text-[#0666AE]" />
                    ROSTER PENGAWASAN CBT HARIAN
                  </h4>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                    {proctorSchedule.length === 0 ? (
                      <div className="col-span-full p-8 text-center bg-slate-50 border border-slate-205 rounded-2xl text-slate-400 italic font-medium">
                        Belum ada penugasan atau plotting jadwal mengawas yang terdaftar untuk akun Guru Anda di Ruang CBT. 
                        <br />
                        <span className="text-[10px] text-slate-400 mt-1 block">Silakan hubungi Administrator untuk plotting ruang ujian atau nama Anda di dewan pengawas.</span>
                      </div>
                    ) : (
                      proctorSchedule.map((ts, idx) => (
                        <div
                          key={idx}
                          className="p-5 bg-slate-50/50 border border-slate-205 hover:border-[#0666AE]/30 hover:bg-white rounded-2xl space-y-3 text-left transition-all shadow-sm"
                        >
                          <div className="flex justify-between items-center">
                            <span className="p-1 px-2.5 bg-[#0666AE]/10 text-[#0666AE] font-black uppercase text-[9px] rounded-lg">
                              {ts.hari}, {ts.tanggal}
                            </span>
                            <span className={`px-2 py-0.5 rounded-full text-[8px] font-black tracking-wide uppercase bg-[#0666AE]/10 text-[#0666AE]`}>
                              {ts.status}
                            </span>
                          </div>
                          
                          <div className="space-y-1 pt-1">
                            <p className="font-extrabold text-slate-800 text-md leading-tight">{ts.ruang}</p>
                            <p className="text-[#0666AE] font-bold text-xs">{ts.mapel}</p>
                            <p className="text-slate-500 font-semibold">{ts.kelas}</p>
                          </div>

                          <div className="text-[10px] text-slate-400 font-bold font-mono pt-2 border-t border-slate-200/50 flex justify-between items-center">
                            <span>Sesi Waktu:</span>
                            <span className="text-slate-700 font-extrabold flex items-center gap-1 font-sans">
                              <Clock size={11} className="text-[#0666AE]" />
                              {ts.sesi}
                            </span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Proctor regulations cards */}
                <div className="p-5 bg-amber-50/45 border border-amber-200 rounded-2xl space-y-4 text-xs md:col-span-4 self-start shadow-sm">
                  <h4 className="text-xs font-extrabold text-amber-850 uppercase pb-2 border-b border-amber-200 flex items-center gap-1.5">
                    <Shield size={14} className="text-amber-600" />
                    TATA TERTIB PENGAWASAN CBT
                  </h4>
                  <ul className="space-y-2.5 list-none text-slate-600 leading-relaxed text-[11.5px] font-medium">
                    <li className="flex items-start gap-2">
                      <span className="w-1.5 h-1.5 bg-amber-600 rounded-full mt-1.5 shrink-0"></span>
                      <span>Hadir di ruang CBT 15 menit sebelum sesi dimulai untuk sterilisasi ruang & device.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="w-1.5 h-1.5 bg-amber-600 rounded-full mt-1.5 shrink-0"></span>
                      <span>Dilarang keras menyebarkan atau mengumumkan Token ujian diluar area ruang CBT madrasah.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="w-1.5 h-1.5 bg-amber-600 rounded-full mt-1.5 shrink-0"></span>
                      <span>Manfaatkan dashboard monitoring status siswa secara aktif untuk melacak kecurangan digital.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="w-1.5 h-1.5 bg-amber-600 rounded-full mt-1.5 shrink-0"></span>
                      <span>Segera laporkan apabila terdapat kegagalan otentikasi Device ID atau upaya penggantian browser sirkuler.</span>
                    </li>
                  </ul>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* TEACHER EDIT SOAL MODAL OVERLAY */}
        {editingGuruSoal && (
          <div id="edit-guru-soal-modal" className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto">
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
                    <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest leading-none">Edit Soal Mandiri</h3>
                    <p className="text-[10px] text-slate-400 mt-1 font-semibold">Sesuaikan butir soal di repositori pengampu Anda.</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setEditingGuruSoal(null)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>

              <form onSubmit={handleUpdateGuruSoal} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto text-xs">
                <div className="space-y-1">
                  <label className="text-[10px] text-slate-500 font-extrabold uppercase my-1 block">Pertanyaan / Teks Soal</label>
                  <textarea
                    rows={4}
                    dir="auto"
                    value={editGuruSoalTeks}
                    onChange={(e) => setEditGuruSoalTeks(e.target.value)}
                    className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-slate-800 font-medium focus:outline-none focus:border-[#0666AE] bidi-plaintext"
                    placeholder="Tuliskan pertanyaan ujian..."
                    required
                  />
                  {editGuruSoalTeks.trim() && (
                    <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-[11.5px] text-slate-700">
                      <span className="text-[9px] font-black uppercase text-slate-400 block mb-1">Pratinjau Tampilan Siswa:</span>
                      <RichMathText text={editGuruSoalTeks} />
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] text-slate-500 font-extrabold uppercase my-1 block">Mata Pelajaran</label>
                    <select
                      value={editGuruSoalMapel}
                      onChange={(e) => setEditGuruSoalMapel(e.target.value)}
                      className="w-full p-2.5 bg-white border border-slate-205 rounded-xl text-slate-705 font-bold focus:outline-none focus:border-[#0666AE]"
                      required
                    >
                      <option value="">-- Pilih Mapel --</option>
                      {guruMapels.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.nama}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] text-emerald-600 font-extrabold uppercase my-1 block">Kunci Jawaban</label>
                    <select
                      value={editGuruSoalKunci}
                      onChange={(e) => setEditGuruSoalKunci(e.target.value as any)}
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
                      value={editGuruSoalImg}
                      onChange={(e) => setEditGuruSoalImg(e.target.value)}
                      placeholder="Tempel URL Gambar atau upload berkas..."
                      className="flex-1 p-2.5 bg-white border border-slate-250 rounded-xl text-slate-800 font-mono text-[10px] focus:outline-none focus:border-[#0666AE]"
                    />
                    <label className="flex items-center justify-center gap-1.5 px-3 py-2 bg-[#0666AE] hover:bg-[#0666AE]/95 text-white font-extrabold uppercase rounded-xl text-[9px] cursor-pointer transition select-none shadow-sm shrink-0">
                      <Upload size={12} />
                      <span>Upload File</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => handleFileChange(e, setEditGuruSoalImg)}
                        className="hidden"
                      />
                    </label>
                  </div>
                  {editGuruSoalImg && (
                    <div className="pt-2 flex items-center gap-3 bg-white p-2 rounded-xl border border-slate-155">
                      <div className="relative w-14 h-14 rounded-lg overflow-hidden border border-slate-200 bg-slate-100 flex items-center justify-center shrink-0">
                        <img src={editGuruSoalImg} alt="Preview" className="w-full h-full object-cover" />
                      </div>
                      <div className="flex-1 overflow-hidden">
                        <p className="text-[9px] font-mono text-slate-400 truncate">{editGuruSoalImg.startsWith("data:") ? "Berkas Gambar Berhasil Diunggah" : editGuruSoalImg}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setEditGuruSoalImg("")}
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
                  <label className="text-[10px] text-[#0666AE] font-black uppercase tracking-wider block">Sasaran Target Kelas Akademik</label>
                  <div className="flex flex-wrap gap-2">
                    {dbState.kelasAkademik.map((ka) => {
                      const isChecked = editGuruSoalKelasIds.includes(ka.id);
                      return (
                        <label key={ka.id} className="flex items-center gap-1.5 cursor-pointer font-bold bg-white p-1.5 px-3 rounded-lg border border-slate-200 hover:bg-slate-50 select-none text-[11px]">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => {
                              if (isChecked) {
                                setEditGuruSoalKelasIds(editGuruSoalKelasIds.filter((id) => id !== ka.id));
                              } else {
                                setEditGuruSoalKelasIds([...editGuruSoalKelasIds, ka.id]);
                              }
                            }}
                            className="rounded text-[#0666AE] focus:ring-0"
                          />
                          <span>{ka.nama}</span>
                        </label>
                      );
                    })}
                  </div>
                  <p className="text-[9px] text-slate-400 font-medium">Kosongi target kelas jika merupakan soal Umum / Semua Kelas.</p>
                </div>

                <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-2.5">
                  <label className="text-[10px] text-slate-500 font-extrabold uppercase block">
                    Opsi Pilihan Jawaban A–E (Teks, Rumus, Arab &amp; Gambar Opsi)
                  </label>
                  {(["A", "B", "C", "D", "E"] as const).map((o) => {
                    const optImg = editGuruSoalOpsiGambar[o] || "";
                    return (
                      <div key={o} className="space-y-1.5 p-2 bg-white rounded-xl border border-slate-200">
                        <div className="flex gap-2 items-center text-xs">
                          <span className="font-extrabold text-[#0666AE] w-4 font-mono text-[11px]">{o}</span>
                          <input
                            dir={isArabicDominant(editGuruSoalOpsi[o]) ? "rtl" : "ltr"}
                            type="text"
                            value={editGuruSoalOpsi[o]}
                            onChange={(e) => setEditGuruSoalOpsi({ ...editGuruSoalOpsi, [o]: e.target.value })}
                            placeholder={`Isi teks Opsi ${o} (atau unggah gambar)...`}
                            className={`flex-1 p-2 bg-slate-50/70 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-[#0666AE] focus:bg-white bidi-plaintext ${
                              hasArabicText(editGuruSoalOpsi[o]) ? "font-arabic text-sm" : ""
                            }`}
                          />
                          <label className="px-2.5 py-2 bg-sky-50 hover:bg-sky-100 text-[#0666AE] border border-sky-200 rounded-xl text-[9px] font-extrabold cursor-pointer flex items-center gap-1 shrink-0">
                            <ImageIcon size={12} />
                            <span>Gambar {o}</span>
                            <input
                              type="file"
                              accept="image/*"
                              onChange={(e) =>
                                handleFileChange(e, (url) =>
                                  setEditGuruSoalOpsiGambar((prev) => ({ ...prev, [o]: url }))
                                )
                              }
                              className="hidden"
                            />
                          </label>
                        </div>
                        {optImg && (
                          <div className="pl-6 flex items-center gap-2">
                            <img
                              src={optImg}
                              alt={`Preview Opsi ${o}`}
                              className="h-14 w-auto max-w-[160px] object-contain rounded border border-slate-200 bg-slate-50 p-0.5"
                            />
                            <button
                              type="button"
                              onClick={() =>
                                setEditGuruSoalOpsiGambar((prev) => {
                                  const next = { ...prev };
                                  delete next[o];
                                  return next;
                                })
                              }
                              className="px-2 py-0.5 text-[9px] font-bold text-rose-600 bg-rose-50 hover:bg-rose-100 rounded border border-rose-200 cursor-pointer"
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
                    onClick={() => setEditingGuruSoal(null)}
                    className="px-4 py-2 bg-white border border-slate-200 text-slate-600 rounded-xl font-bold hover:bg-slate-50 cursor-pointer"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-[#0666AE] hover:bg-[#0666AE]/95 text-white rounded-xl font-extrabold uppercase shadow cursor-pointer text-xs"
                  >
                    Simpan Perubahan
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}

        {/* MASS IMPORT LIVE PREVIEW MODAL */}
        {showMassPreviewModal && activeMassParse && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-white rounded-3xl max-w-4xl w-full max-h-[88vh] flex flex-col shadow-2xl border border-slate-100 overflow-hidden text-left"
            >
              <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-[#0666AE]/5 shrink-0">
                <div>
                  <h3 className="text-xs font-black text-[#0666AE] uppercase tracking-widest">
                    PRATINJAU HASIL DETEKSI SOAL ({activeMassParse.questions.length} BUTIR SIAP IMPOR)
                  </h3>
                  <p className="text-[10.5px] text-slate-500 mt-0.5 font-semibold">
                    Periksa tampilan rumus matematika, tulisan Arab RTL, dan lampiran gambar soal maupun opsi sebelum disimpan.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowMassPreviewModal(false)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="p-5 overflow-y-auto space-y-3 flex-1 text-xs bg-slate-50/50">
                {activeMassParse.questions.map((q, idx) => (
                  <div key={idx} className="p-4 bg-white rounded-2xl border border-slate-200 space-y-2.5 shadow-2xs">
                    <div className="flex items-center justify-between gap-2 pb-1.5 border-b border-slate-100">
                      <span className="px-2 py-0.5 bg-sky-50 text-[#0666AE] rounded font-black text-[10px]">
                        Soal #{idx + 1}
                      </span>
                      <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded font-black text-[10px]">
                        Kunci: {q.kunci}
                      </span>
                    </div>
                    {q.gambarUrl && (
                      <div className="bg-slate-50 p-2 rounded-xl border border-slate-200 inline-block max-w-[240px]">
                        <img src={q.gambarUrl} alt={`Gambar Soal ${idx + 1}`} className="max-h-32 object-contain rounded" />
                      </div>
                    )}
                    <div className="font-bold text-slate-800 text-[12.5px]">
                      <RichMathText text={q.teks} />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-1">
                      {(() => {
                        const allOptsArabicRtl = areAllOptionsArabicRtl(q.opsi);
                        return (["A", "B", "C", "D", "E"] as const).map((optKey) => {
                          const txt = q.opsi[optKey];
                          const img = q.opsiGambar?.[optKey];
                          if (!txt && !img) return null;
                          const isKey = q.kunci === optKey;
                          return (
                            <div
                              key={optKey}
                              className={`p-2 rounded-xl border flex items-start gap-2 ${
                                allOptsArabicRtl ? "flex-row-reverse" : ""
                              } ${
                                isKey ? "bg-emerald-50 border-emerald-200 text-emerald-800 font-bold" : "bg-slate-50/70 border-slate-200 text-slate-700"
                              }`}
                            >
                              <span className="font-mono font-black text-[#0666AE] shrink-0">{optKey}.</span>
                              <div
                                className={`flex-1 min-w-0 space-y-1 flex flex-col ${
                                  allOptsArabicRtl ? "items-end" : "items-start"
                                }`}
                              >
                                {img && (
                                  <img
                                    src={img}
                                    alt={`Opsi ${optKey}`}
                                    className="max-h-20 rounded border border-slate-200 bg-white p-0.5 object-contain"
                                  />
                                )}
                                {txt && <RichMathText text={txt} />}
                              </div>
                            </div>
                          );
                        });
                      })()}
                    </div>
                  </div>
                ))}
              </div>

              <div className="p-4 border-t border-slate-100 bg-white flex justify-end gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setShowMassPreviewModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs cursor-pointer"
                >
                  Tutup Pratinjau
                </button>
                <button
                  type="button"
                  onClick={(e) => handleSaveMassSoal(e as unknown as React.FormEvent)}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-black text-xs cursor-pointer shadow"
                >
                  Konfirmasi &amp; Impor {activeMassParse.questions.length} Soal Sekarang
                </button>
              </div>
            </motion.div>
          </div>
        )}
        {/* PLOTTING KELOMPOK KELAS / ANGKATAN MODAL */}
        {plottingGroupTarget && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-white rounded-3xl max-w-lg w-full shadow-2xl border border-slate-100 overflow-hidden text-left"
            >
              <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/70">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl border border-indigo-200">
                    <Layers size={16} />
                  </div>
                  <div>
                    <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest leading-none">
                      Plotting Kelompok Kelas / Angkatan
                    </h3>
                    <p className="text-[10px] text-slate-500 mt-1 font-semibold truncate max-w-[300px]">
                      {plottingGroupTarget.title} ({plottingGroupTarget.soalIds.length} Soal)
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setPlottingGroupTarget(null)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>

              <form onSubmit={handleSavePlottingKelompok} className="p-5 space-y-4 text-xs">
                <div className="space-y-2">
                  <label className="text-[10px] text-slate-600 font-extrabold uppercase block">
                    Pilih Cepat Per Angkatan:
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {(["VII", "VIII", "IX"] as const).map((lvl) => {
                      const lvlIds = dbState.kelasAkademik
                        .filter((ka) => getGradeLevel(ka.nama) === lvl)
                        .map((ka) => ka.id);
                      if (lvlIds.length === 0) return null;
                      const active = lvlIds.every((id) => plottingKelasIds.includes(id));
                      return (
                        <button
                          key={lvl}
                          type="button"
                          onClick={() => applyAngkatanQuickSelect(lvl, setPlottingKelasIds)}
                          className={`px-2.5 py-1.5 rounded-lg text-[10px] font-extrabold border transition cursor-pointer ${
                            active
                              ? "bg-[#0666AE] text-white border-[#0666AE]"
                              : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                          }`}
                        >
                          {active ? `✓ Angkatan ${lvl}` : `+ Angkatan ${lvl}`}
                        </button>
                      );
                    })}
                    <button
                      type="button"
                      onClick={() => applyAngkatanQuickSelect("ALL", setPlottingKelasIds)}
                      className="px-2.5 py-1.5 rounded-lg text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 cursor-pointer"
                    >
                      Pilih Semua
                    </button>
                    <button
                      type="button"
                      onClick={() => applyAngkatanQuickSelect("NONE", setPlottingKelasIds)}
                      className="px-2.5 py-1.5 rounded-lg text-[10px] font-bold bg-rose-50 text-rose-600 border border-rose-200 hover:bg-rose-100 cursor-pointer"
                    >
                      Kosongkan (Umum)
                    </button>
                  </div>
                </div>

                <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl space-y-2">
                  <label className="text-[10px] text-[#0666AE] font-black uppercase tracking-wider block">
                    Daftar Kelas Akademik Target:
                  </label>
                  <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto">
                    {dbState.kelasAkademik.map((ka) => {
                      const isChecked = plottingKelasIds.includes(ka.id);
                      return (
                        <label
                          key={ka.id}
                          className={`flex items-center gap-1.5 cursor-pointer font-bold p-1.5 px-2.5 rounded-lg border select-none text-[11px] transition ${
                            isChecked
                              ? "bg-sky-50 text-[#0666AE] border-[#0666AE]/40"
                              : "bg-white text-slate-700 border-slate-200 hover:bg-slate-100"
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => {
                              setPlottingKelasIds((prev) =>
                                isChecked ? prev.filter((id) => id !== ka.id) : [...prev, ka.id]
                              );
                            }}
                            className="rounded text-[#0666AE] focus:ring-0"
                          />
                          <span>{ka.nama}</span>
                        </label>
                      );
                    })}
                  </div>
                  <p className="text-[10px] text-slate-500 font-medium pt-1">
                    {plottingKelasIds.length === 0
                      ? "Status: Umum / Tampil untuk semua tingkat kelas."
                      : `Akan di-plotting khusus untuk ${plottingKelasIds.length} kelas terpilih.`}
                  </p>
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setPlottingGroupTarget(null)}
                    className="px-4 py-2 bg-white border border-slate-200 text-slate-600 rounded-xl font-bold hover:bg-slate-50 cursor-pointer"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-[#0666AE] hover:bg-[#0666AE]/95 text-white rounded-xl font-extrabold uppercase shadow cursor-pointer text-xs"
                  >
                    Simpan Plotting Kelompok
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </main>
    </div>
  );
}
