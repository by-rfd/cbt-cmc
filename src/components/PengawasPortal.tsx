import React, { useState, useEffect } from "react";
import {
  getDB,
  setDB,
  subscribeToDB,
  getSyncStatus,
  subscribeToSyncStatus,
  clearSyncError,
  SyncStatus,
} from "../firebaseConfig";
import {
  SesiSiswa,
  TokenUjian,
  JadwalUjian,
  Pengawas,
  JadwalNgawas,
} from "../types";
import {
  Activity,
  Key,
  LogOut,
  Clock,
  Shield,
  ShieldCheck,
  CheckCircle,
  Copy,
  Users,
  RotateCw,
  Home,
  AlertTriangle,
  AlertCircle,
  Calendar,
  Menu,
  X,
  Search,
  Check,
  Cloud,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import {
  executeForceSubmitSession,
  executeResetStudentSession,
} from "../utils/sessionControls";

interface PengawasPortalProps {
  onLogout: () => void;
  pengawasUser: string;
}

export default function PengawasPortal({ onLogout, pengawasUser }: PengawasPortalProps) {
  const [activeMenu, setActiveMenu] = useState<"token" | "monitoring" | "jadwal">("jadwal");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [selectedRuang, setSelectedRuang] = useState<string>("all");
  const [monitorSelectedJadwalId, setMonitorSelectedJadwalId] = useState<string>("all");
  const [monitorSelectedStatus, setMonitorSelectedStatus] = useState<"all" | "mengerjakan" | "selesai" | "infraction">("all");
  const [monitorSearchQuery, setMonitorSearchQuery] = useState<string>("");
  const [copiedIndex, setCopiedIndex] = useState<string | null>(null);
  const [confirmModal, setConfirmModal] = useState<{
    title: string;
    message: string;
    onConfirm: () => void | Promise<void>;
    isDanger?: boolean;
  } | null>(null);

  const [dbState, setDbState] = useState({
    kelas: getDB.kelas(), // List of Ruang (Room)
    mapel: getDB.mapel(),
    siswa: getDB.siswa(),
    soal: getDB.soal(),
    jadwal: getDB.jadwal(),
    tokens: getDB.tokens(),
    sessions: getDB.sessions(),
    hasil: getDB.hasil(),
    konfig: getDB.konfig(),
    pengawas: getDB.pengawas(),
    shadowSiswa: getDB.siswa(), // just a shadow ref
    jadwalNgawas: getDB.jadwalNgawas(),
  });

  const [syncStatus, setSyncStatus] = useState<SyncStatus>(getSyncStatus());
  const [showAllTokens, setShowAllTokens] = useState(false);

  // Synchronize with database observers
  useEffect(() => {
    const unsub = subscribeToDB(() => {
      setDbState({
        kelas: getDB.kelas(),
        mapel: getDB.mapel(),
        siswa: getDB.siswa(),
        soal: getDB.soal(),
        jadwal: getDB.jadwal(),
        tokens: getDB.tokens(),
        sessions: getDB.sessions(),
        hasil: getDB.hasil(),
        konfig: getDB.konfig(),
        pengawas: getDB.pengawas(),
        shadowSiswa: getDB.siswa(),
        jadwalNgawas: getDB.jadwalNgawas(),
      });
    });
    const unsubSync = subscribeToSyncStatus((st) => setSyncStatus(st));
    return () => {
      unsub();
      unsubSync();
    };
  }, []);

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
  const [secondsRemaining, setSecondsRemaining] = useState(600); // 10 minutes = 600s
  const [timerProgress, setTimerProgress] = useState(100);

  const currentSupervisor = dbState.pengawas.find(
    (p) => (p.username || "").trim().toLowerCase() === pengawasUser.trim().toLowerCase()
  );
  const mySchedules = currentSupervisor
    ? dbState.jadwalNgawas.filter((jn) => jn.pengawasId === currentSupervisor.id)
    : [];

  useEffect(() => {
    const interval = setInterval(() => {
      setSecondsRemaining((prev) => {
        if (prev <= 1) {
          const st = getSyncStatus();
          const currentToks = getDB.tokens();
          const allExpired = currentToks.length === 0 || currentToks.every((t) => !t.expiresAt || t.expiresAt <= Date.now());
          if (st.cloudReady && !st.quotaExceeded && allExpired && getDB.jadwal().length > 0) {
            rotateAllTokens();
          }
          return 600;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    setTimerProgress((secondsRemaining / 600) * 100);
  }, [secondsRemaining]);

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

  const copyToClipboard = (token: string, mapelId: string) => {
    navigator.clipboard.writeText(token);
    setCopiedIndex(mapelId);
    setTimeout(() => {
      setCopiedIndex(null);
    }, 2000);
  };

  const handleForceSubmitSession = (sesObjOrId: any) => {
    const targetObj =
      typeof sesObjOrId === "string"
        ? getDB.sessions().find((s) => s.id === sesObjOrId)
        : sesObjOrId;
    if (!targetObj) return;

    setConfirmModal({
      title: "Submit Paksa Ujian Siswa",
      message: `Apakah Anda yakin ingin melakukan Submit Paksa untuk "${targetObj.siswaNama}"? Ujian siswa akan langsung berakhir (${targetObj.jawabanTerisi || 0}/${targetObj.totalSoal || 0} terjawab) dan nilainya otomatis terekap.`,
      isDanger: true,
      onConfirm: () => {
        executeForceSubmitSession(targetObj);
      },
    });
  };

  const handleClearSiswaViolations = (id: string) => {
    const current = [...getDB.sessions()];
    const idx = current.findIndex((s) => s.id === id);
    if (idx !== -1) {
      current[idx] = {
        ...current[idx],
        pelanggaranCount: 0,
        pelanggaranLogs: [],
        status: "Mengerjakan",
        lastUpdated: new Date().toISOString(),
      };
      setDB.sessions(current);
    }
  };

  const handleResetSession = (sesObjOrId: any) => {
    const targetObj =
      typeof sesObjOrId === "string"
        ? getDB.sessions().find((s) => s.id === sesObjOrId) || { id: sesObjOrId }
        : sesObjOrId;
    if (!targetObj) return;

    setConfirmModal({
      title: "Reset Sesi & Ulangi Dari Awal",
      message: `Apakah Anda yakin ingin mereset sesi "${targetObj.siswaNama || targetObj.id}"? Seluruh jawaban, pelanggaran, dan nilai sesi ini akan dihapus agar siswa langsung mengulang ujian dari awal.`,
      isDanger: true,
      onConfirm: async () => {
        await executeResetStudentSession(targetObj);
      },
    });
  };

  // Unified session data: combines live sessions and completed results so completed students never vanish
  const unifiedMonitorList = React.useMemo(() => {
    const sessionMap = new Map<string, any>();

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

  const getProctorTitle = () => {
    return pengawasUser.toUpperCase() === "PENGAWAS" 
      ? "Pengawas Umum" 
      : `Pengawas Ruang (${pengawasUser.toUpperCase()})`;
  };

  const navMenuItems = [
    { id: "jadwal", label: "Jadwal Mengawas", icon: Calendar },
    { id: "token", label: "Token Ujian", icon: Key },
    { id: "monitoring", label: "Live Monitor Ruang", icon: Activity },
  ];

  return (
    <div className="flex flex-col lg:flex-row bg-white text-slate-800 min-h-[580px] h-full rounded-2xl overflow-hidden border border-slate-200 shadow-md text-left relative">
      {/* 1. MOBILE TOP NAVIGATION BAR (Visible only on < lg) */}
      <div className="lg:hidden w-full bg-slate-50 border-b border-slate-200 p-3 sm:p-4 space-y-2.5 select-none shrink-0 z-30">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="p-1.5 rounded bg-amber-500/10 text-amber-600 border border-amber-500/20 shrink-0">
              <Shield size={16} />
            </div>
            <div className="min-w-0">
              <h2 className="text-[9px] font-bold text-slate-400 uppercase tracking-widest leading-none">PANEL PENGAWAS</h2>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="text-xs font-black text-slate-800 truncate">
                  {currentSupervisor ? currentSupervisor.nama : pengawasUser}
                </span>
                {dbState.sessions.filter((s) => s.pelanggaranCount > 0).length > 0 && (
                  <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping shrink-0"></span>
                )}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onLogout}
            className="px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 rounded-xl font-bold text-[11px] flex items-center gap-1 cursor-pointer transition shrink-0"
          >
            <LogOut size={12} />
            <span>Keluar</span>
          </button>
        </div>

        {/* Always-visible 3-tab mobile switcher */}
        <div className="grid grid-cols-3 gap-1.5">
          {navMenuItems.map((m) => {
            const Icon = m.icon;
            const isActive = activeMenu === m.id;
            const shortLabel = m.id === "jadwal" ? "Jadwal" : m.id === "token" ? "Token" : "Monitor";
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => {
                  setActiveMenu(m.id as any);
                  setMobileNavOpen(false);
                }}
                className={`flex items-center justify-center gap-1.5 py-2 px-2 rounded-xl text-[11px] font-extrabold transition cursor-pointer ${
                  isActive
                    ? "bg-amber-600 text-white shadow-sm"
                    : "bg-white text-slate-700 hover:bg-slate-100 border border-slate-200"
                }`}
              >
                <Icon size={13} className={isActive ? "text-white" : "text-amber-600"} />
                <span className="truncate">{shortLabel}</span>
              </button>
            );
          })}
        </div>
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
              {navMenuItems.map((m) => {
                const Icon = m.icon;
                const isActive = activeMenu === m.id;
                return (
                  <button
                    key={m.id}
                    onClick={() => {
                      setActiveMenu(m.id as any);
                      setMobileNavOpen(false);
                    }}
                    className={`flex items-center gap-2.5 p-3 rounded-xl text-left font-bold transition cursor-pointer ${
                      isActive
                        ? "bg-amber-600 text-white shadow-sm"
                        : "bg-white text-slate-700 hover:bg-slate-100 border border-slate-200/60"
                    }`}
                  >
                    <Icon size={15} className={isActive ? "text-white" : "text-amber-600"} />
                    <span>{m.label}</span>
                  </button>
                );
              })}
            </div>
            <div className="mt-2 pt-2 border-t border-slate-200 flex justify-between items-center text-[10px] px-1">
              <span className="text-slate-500 font-mono font-bold truncate">Pengawas: {pengawasUser}</span>
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
      <aside className="hidden lg:flex w-64 bg-slate-50 border-r border-slate-205/75 flex-col justify-between shrink-0 select-none">
        <div>
          <div className="p-5 border-b border-slate-200 bg-slate-100/50">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded bg-amber-500/10 text-amber-600 border border-amber-500/20 shadow-inner">
                <Shield size={18} />
              </div>
              <div className="text-left">
                <h2 className="text-[9px] font-bold text-slate-400 uppercase tracking-widest leading-none">PANEL PENGAWAS</h2>
                <h1 className="text-sm font-black text-slate-800 mt-1 line-clamp-1">{getProctorTitle()}</h1>
              </div>
            </div>
            <p className="text-[10px] text-amber-700 font-mono mt-2 bg-amber-500/5 p-1 px-2 rounded-lg border border-amber-500/10 text-center uppercase tracking-wide font-bold">
              MTs. AL-MA'SUM II CIMUNCANG
            </p>
          </div>

          <nav className="p-3 flex flex-col gap-1 text-xs">
            <button
              onClick={() => setActiveMenu("jadwal")}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-left font-semibold transition-all duration-350 cursor-pointer ${
                activeMenu === "jadwal"
                  ? "bg-amber-600 text-white shadow-sm font-extrabold"
                  : "text-slate-600 hover:bg-slate-200/50 hover:text-slate-900"
              }`}
            >
              <Calendar size={15} />
              <span>Jadwal Mengawas Anda</span>
            </button>
            <button
              onClick={() => setActiveMenu("token")}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-left font-semibold transition-all duration-350 cursor-pointer ${
                activeMenu === "token"
                  ? "bg-amber-600 text-white shadow-sm font-extrabold"
                  : "text-slate-600 hover:bg-slate-200/50 hover:text-slate-900"
              }`}
            >
              <Key size={15} />
              <span>Token Ujian Hari Ini</span>
            </button>
            <button
              onClick={() => setActiveMenu("monitoring")}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-left font-semibold transition-all duration-350 cursor-pointer ${
                activeMenu === "monitoring"
                  ? "bg-amber-600 text-white shadow-sm font-extrabold"
                  : "text-slate-600 hover:bg-slate-200/50 hover:text-slate-900"
              }`}
            >
              <Activity size={15} />
              <span>Live Monitor Ruang</span>
              {dbState.sessions.filter((s) => s.pelanggaranCount > 0).length > 0 && (
                <span className="ml-auto w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse"></span>
              )}
            </button>
          </nav>
        </div>

        <div className="p-4 border-t border-slate-200 bg-slate-100/50 text-[10px] text-left">
          <p className="text-slate-400">Pengawas Pengampu:</p>
          <p className="font-mono text-amber-700 truncate font-bold">{pengawasUser || "pengawas1"}</p>
          <button
            onClick={onLogout}
            className="mt-3 w-full py-2 px-3 bg-white border border-slate-200 text-slate-600 hover:text-red-655 rounded-xl flex items-center justify-center gap-1.5 cursor-pointer hover:bg-red-50 hover:border-red-200 transition-all font-bold"
          >
            <LogOut size={11} className="text-red-500" />
            <span>Keluar Sesi</span>
          </button>
        </div>
      </aside>

      {/* 2. MAIN WORKING SCREEN WITH ANIMS */}
      <main className="flex-1 p-3 sm:p-6 overflow-y-auto bg-white flex flex-col justify-stretch min-w-0">
        {/* TOP LEVEL NAVIGATION SUMMARY */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-4 mb-5 border-b border-slate-200 select-none">
          <div className="text-left min-w-0">
            <p className="text-[10px] text-slate-400 uppercase tracking-widest font-mono font-bold">Portal Pengawas Ujian MTs. Al-Ma'sum II Cmc</p>
            <h1 className="text-base md:text-lg font-black uppercase text-slate-800 flex items-center gap-1.5">
              <span className="break-words">{dbState.konfig.namaSekolah}</span>
            </h1>
          </div>

          <div className="flex items-center gap-3 bg-slate-50 p-2 px-3 rounded-xl border border-slate-200 text-xs text-left shadow-sm w-full sm:w-auto justify-between sm:justify-start">
            <div className="flex items-center gap-2.5">
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

        {!syncStatus.cloudReady && (
          <div className="mb-4 p-3 rounded-2xl border bg-sky-50 border-sky-200 text-sky-800 text-xs font-bold flex items-center gap-2">
            <Cloud size={15} className="animate-pulse shrink-0" />
            <span>Menyinkronkan jadwal pengawas, jadwal ujian, dan token terbaru dari server...</span>
          </div>
        )}

        {syncStatus.lastError && (
          <div className="mb-4 p-3 rounded-2xl border bg-rose-50 border-rose-200 text-rose-700 text-xs font-bold flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <AlertCircle size={15} className="shrink-0" />
              <span>{syncStatus.lastError}</span>
            </div>
            <button
              type="button"
              onClick={() => clearSyncError()}
              className="px-2.5 py-1 rounded-lg bg-white border border-rose-200 text-[10px] font-extrabold cursor-pointer shrink-0"
            >
              Tutup
            </button>
          </div>
        )}

        <AnimatePresence mode="wait">
          {/* MENU 0: JADWAL MENGAWAS */}
          {activeMenu === "jadwal" && (
            <motion.div
              key="jadwal"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.25 }}
              className="space-y-6 text-left"
            >
              <div className="flex flex-wrap justify-between items-center pb-2 border-b border-slate-200 gap-2">
                <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest">
                  JADWAL MENGAWAS & UJIAN AKTIF
                </h3>
                <span className="text-[10px] bg-amber-50 text-amber-700 border border-amber-200 rounded-lg px-2.5 py-1 font-bold">
                  Terintegrasi Akun Pengawas
                </span>
              </div>

              <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl text-xs text-slate-600 leading-relaxed font-semibold">
                <h4 className="text-sm font-black text-slate-800 mb-1 flex items-center gap-1.5">
                  Selamat Datang, {currentSupervisor ? currentSupervisor.nama : pengawasUser}!
                </h4>
                <p>Berikut adalah rincian plot penugasan ruang CBT serta jadwal ujian madrasah yang sedang berjalan.</p>
              </div>

              {mySchedules.length === 0 ? (
                <div className="p-4 bg-amber-50/70 border border-amber-200 rounded-2xl text-xs text-amber-800 space-y-1">
                  <p className="font-extrabold uppercase tracking-wide flex items-center gap-1.5">
                    <Calendar size={14} />
                    <span>Belum Ada Plot Ruang Khusus Untuk Akun Anda</span>
                  </p>
                  <p className="text-[11px] font-medium text-amber-700">
                    Admin belum memplot ruang jaga khusus ke akun Anda, atau Anda bertugas sebagai pengawas umum. Jadwal ujian aktif madrasah tetap ditampilkan di bawah agar dapat langsung dipantau.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  <h4 className="text-[11px] font-black uppercase tracking-wider text-amber-700">
                    Plot Ruang Jaga Anda ({mySchedules.length})
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {mySchedules.map((jn) => {
                      const mName = dbState.mapel.find((m) => m.id === jn.mapelId)?.nama || "Unknown Mapel";
                      const mCode = dbState.mapel.find((m) => m.id === jn.mapelId)?.kode || "";
                      const rName = dbState.kelas.find((k) => k.id === jn.ruangId)?.nama || "Unknown Ruang";
                      const rId = jn.ruangId;
                      const matchedToken = dbState.tokens.find((t) => t.id === jn.mapelId);

                      return (
                        <div
                          key={jn.id}
                          className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 sm:p-5 hover:shadow-md transition-all flex flex-col justify-between"
                        >
                          <div>
                            <div className="flex flex-wrap justify-between items-start gap-2 mb-3">
                              <span className="px-2.5 py-0.5 bg-amber-50 text-amber-800 border border-amber-200/60 rounded-full font-mono text-[10px] font-bold">
                                {jn.tanggal}
                              </span>
                              <span className="px-2.5 py-1 bg-emerald-50 text-emerald-800 border border-emerald-200/50 rounded-lg font-bold text-[10px] uppercase font-mono">
                                {rName}
                              </span>
                            </div>

                            <p className="font-black text-slate-800 text-[15px] leading-tight mt-1">
                              {mName}
                            </p>
                            <p className="text-[10px] font-mono text-slate-500 mt-1">
                              Sesi: <span className="font-semibold text-slate-700">{jn.sesi}</span> {mCode && `• Mapel: ${mCode}`}
                            </p>

                            {matchedToken ? (
                              <div className="mt-4 p-2.5 bg-amber-50/55 border border-amber-100 rounded-xl flex justify-between items-center text-xs gap-2">
                                <div>
                                  <p className="text-[9px] text-slate-400 uppercase font-bold tracking-wider leading-none">Token Ruang</p>
                                  <p className="font-mono text-amber-700 font-black text-lg mt-0.5">{matchedToken.token}</p>
                                </div>
                                <button
                                  onClick={() => copyToClipboard(matchedToken.token, jn.mapelId)}
                                  className="p-2 px-3 bg-amber-600 hover:bg-amber-700 text-white rounded-lg flex items-center gap-1 cursor-pointer text-[10px] font-bold transition-all shrink-0"
                                >
                                  {copiedIndex === jn.mapelId ? "Salin! ✓" : "Salin Token"}
                                </button>
                              </div>
                            ) : (
                              <div className="mt-4 p-2.5 bg-slate-50 border border-slate-100 rounded-xl text-[10px] text-slate-500 italic">
                                Token belum dirilis / ujian belum diaktivasi admin.
                              </div>
                            )}
                          </div>

                          <div className="mt-4 pt-3 border-t border-slate-100 flex gap-2">
                            <button
                              onClick={() => {
                                setSelectedRuang(rId);
                                setActiveMenu("monitoring");
                              }}
                              className="w-full py-2.5 bg-[#0666AE]/10 hover:bg-[#0666AE]/20 text-[#0666AE] font-extrabold text-[11px] rounded-xl text-center cursor-pointer transition-all flex items-center justify-center gap-1.5"
                            >
                              <Activity size={13} />
                              <span>Live Monitor Ruangan</span>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Always show active Madrasah Exam Schedules so Pengawas on mobile can read all active schedules */}
              <div className="space-y-3 pt-2 border-t border-slate-200">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h4 className="text-[11px] font-black uppercase tracking-wider text-slate-600">
                    Jadwal Ujian Madrasah Aktif ({dbState.jadwal.length})
                  </h4>
                  <button
                    type="button"
                    onClick={() => setActiveMenu("token")}
                    className="text-[11px] font-extrabold text-[#0666AE] hover:underline cursor-pointer"
                  >
                    Lihat Semua Token →
                  </button>
                </div>

                {dbState.jadwal.length === 0 ? (
                  <div className="p-6 text-center bg-slate-50 border border-slate-200 rounded-2xl text-xs text-slate-400 italic">
                    Belum ada jadwal ujian CBT yang dirilis Admin.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {dbState.jadwal.map((jad) => {
                      const mapelObj = dbState.mapel.find((m) => m.id === jad.mapelId);
                      const matchedToken = dbState.tokens.find((t) => t.id === jad.mapelId);
                      return (
                        <div
                          key={jad.id}
                          className="p-4 bg-slate-50/70 border border-slate-200 rounded-2xl space-y-2.5"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="px-2 py-0.5 bg-white border border-slate-200 rounded-lg font-mono text-[10px] font-bold text-slate-700">
                              {jad.tanggal} • {jad.jamMulai} - {jad.jamSelesai} WIB
                            </span>
                            <span className="px-2 py-0.5 bg-sky-50 text-[#0666AE] border border-sky-200 rounded-lg font-bold text-[10px]">
                              {jad.durasiMenit} Menit
                            </span>
                          </div>
                          <div>
                            <p className="font-black text-slate-800 text-sm">
                              {mapelObj ? mapelObj.nama : "Ujian CBT"}
                            </p>
                            <p className="text-[11px] text-slate-500 font-semibold mt-0.5">
                              Kelas: <span className="text-slate-700 font-bold">{jad.kelasIds?.join(", ") || "Semua Kelas"}</span>
                            </p>
                          </div>
                          {matchedToken && (
                            <div className="p-2 bg-white border border-amber-200 rounded-xl flex items-center justify-between gap-2">
                              <div>
                                <span className="text-[9px] font-bold text-slate-400 uppercase block">Token Ujian</span>
                                <span className="font-mono font-black text-base text-[#0666AE] tracking-wider">{matchedToken.token}</span>
                              </div>
                              <button
                                type="button"
                                onClick={() => copyToClipboard(matchedToken.token, `all_${jad.id}`)}
                                className="px-2.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-[10px] font-bold cursor-pointer"
                              >
                                {copiedIndex === `all_${jad.id}` ? "Salin! ✓" : "Salin"}
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* MENU 1: TOKEN UJIAN */}
          {activeMenu === "token" && (() => {
            const assignedTokens = dbState.tokens.filter((tok) =>
              mySchedules.some((jn) => jn.mapelId === tok.id)
            );
            const effectiveShowAll = showAllTokens || mySchedules.length === 0 || assignedTokens.length === 0;
            const filteredTokens = effectiveShowAll ? dbState.tokens : assignedTokens;

            return (
              <motion.div
                key="token"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                transition={{ duration: 0.25 }}
                className="space-y-6 text-left"
              >
                <div className="flex flex-wrap justify-between items-center gap-2 pb-2 border-b border-slate-200">
                  <h3 className="text-xs font-black uppercase tracking-widest text-slate-500">
                    TOKEN UJIAN AKTIF SAAT INI
                  </h3>
                  {mySchedules.length > 0 && assignedTokens.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setShowAllTokens((p) => !p)}
                      className="text-[10px] bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded-lg px-2.5 py-1 font-bold cursor-pointer"
                    >
                      {showAllTokens ? "Hanya Token Ruang Saya" : "Tampilkan Semua Token"}
                    </button>
                  )}
                </div>

                <div className="bg-amber-50/50 border border-amber-200/80 p-4 rounded-xl text-xs text-amber-800 leading-relaxed font-semibold mb-2">
                  <p className="flex items-center gap-1.5 font-bold mb-1">
                    <AlertTriangle size={15} />
                    <span>Informasi Autentikasi Ruang Pengawasan:</span>
                  </p>
                  <span>Bagikan Kode Token rilis di bawah ini kepada siswa di ruang ujian yang Anda awasi. Token dapat di-refresh jika diperlukan dan akan diperbarui berkala setiap 10 menit.</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredTokens.length === 0 ? (
                    <div className="col-span-full p-10 text-center bg-slate-50 border border-slate-200 rounded-2xl italic text-slate-400 font-medium w-full text-xs">
                      Belum ada token ujian yang dirilis untuk jadwal hari ini.
                    </div>
                  ) : (
                    filteredTokens.map((tok) => (
                      <div
                        key={tok.id}
                        className="p-4 sm:p-5 bg-white border border-slate-200 rounded-2xl hover:border-amber-500/30 transition-all shadow-sm space-y-4"
                      >
                        <div className="flex justify-between items-start gap-2">
                          <div className="text-left min-w-0">
                            <span className="text-[10px] font-mono font-black text-amber-700 bg-amber-50 border border-amber-100 px-2.5 py-0.5 rounded-lg uppercase tracking-wider">
                              AKTIF
                            </span>
                            <h4 className="font-extrabold text-slate-800 text-sm mt-2 line-clamp-2">{tok.mapelNama}</h4>
                            {(() => {
                              const matchedJadwals = dbState.jadwal.filter((j) => j.mapelId === tok.id);
                              const allTargetClasses = Array.from(
                                new Set(matchedJadwals.flatMap((j) => j.kelasIds || []))
                              );
                              const kelasTarget = allTargetClasses.length > 0 ? allTargetClasses.join(", ") : "Ujian Umum";
                              return (
                                <p className="text-[10px] text-slate-400 font-semibold mt-0.5">
                                  Kelas Target: <span className="font-extrabold text-[#0666AE]">{kelasTarget}</span>
                                </p>
                              );
                            })()}
                          </div>
                          <button
                            onClick={() => handleManualTokenRotation(tok.id)}
                            className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-500 rounded-xl cursor-pointer transition-colors shrink-0"
                            title="Refresh/Perbarui Token Baru"
                          >
                            <RotateCw size={13} />
                          </button>
                        </div>

                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 text-center space-y-2 relative shadow-inner">
                          <span className="text-[9px] uppercase font-bold text-slate-400 block tracking-widest">KODE TOKEN</span>
                          <div className="flex items-center justify-center gap-2">
                            <span className="text-2xl font-black font-mono tracking-widest text-[#0666AE]">{tok.token}</span>
                            <button
                              onClick={() => copyToClipboard(tok.token, tok.id)}
                              className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer transition-colors"
                              title="Salin Token"
                            >
                              <Copy size={14} />
                            </button>
                          </div>
                          {copiedIndex === tok.id && (
                            <span className="absolute bottom-1 right-2 bg-emerald-600 text-white text-[8px] font-bold uppercase rounded-md px-1.5 py-0.2 animate-fade-in-down">
                              Salin OK!
                            </span>
                          )}
                        </div>

                        <div className="flex justify-between text-[10px] text-slate-400 font-semibold font-mono">
                          <span>Kadaluarsa</span>
                          <span>{new Date(tok.expiresAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} ({formatTimeMinutes(secondsRemaining)})</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </motion.div>
            );
          })()}

          {/* MENU 2: LIVE MONITORING */}
          {activeMenu === "monitoring" && (() => {
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

            // 2. Filter by Ruang (matches either siswa's assigned Ruang CBT or academic class string)
            const filteredByRuang = filteredByJadwal.filter((item) => {
              if (selectedRuang === "all") return true;
              const matchRoomName = dbState.kelas.find((k) => k.id === selectedRuang)?.nama || "";
              const matchedStudent = dbState.siswa.find(
                (s) =>
                  s.nisn === item.id ||
                  s.id === item.id ||
                  (s.nama || "").trim().toLowerCase() === (item.siswaNama || "").trim().toLowerCase()
              );
              if (matchedStudent && matchedStudent.kelasId === selectedRuang) return true;
              return Boolean(matchRoomName) && (item.siswaKelas || "").toLowerCase() === matchRoomName.toLowerCase();
            });

            // Status counts
            const countTotal = filteredByRuang.length;
            const countMengerjakan = filteredByRuang.filter((s) => s.status === "Mengerjakan").length;
            const countSelesai = filteredByRuang.filter((s) => s.status === "Selesai").length;
            const countInfraction = filteredByRuang.filter(
              (s) => (s.pelanggaranCount || 0) > 0 || s.status === "Diskualifikasi"
            ).length;

            // 3. Filter by Status & Search Query
            const displayList = filteredByRuang.filter((item) => {
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
                key="monitoring"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                transition={{ duration: 0.25 }}
                className="space-y-5 text-left"
              >
                {/* Header Title */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-3 border-b border-slate-200">
                  <div>
                    <h3 className="text-xs font-black uppercase tracking-widest text-[#0666AE] flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping"></span>
                      <span>SITUASI KEAMANAN DIGITAL RUANG UJIAN</span>
                    </h3>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Memantau aktivitas ujian peserta aktif dan catatan peserta yang sudah selesai mengumpulkan.
                    </p>
                  </div>
                  <div className="text-xs flex items-center gap-1.5 text-slate-600 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200 font-bold">
                    <span className="text-amber-700">Toleransi Alarm:</span>
                    <span className="font-mono font-black text-rose-600 bg-rose-50 px-2 py-0.5 rounded-lg text-[10px]">
                      {dbState.konfig.batasPelanggaran} Kali
                    </span>
                  </div>
                </div>

                {/* Filter Controls: Sesi/Jadwal, Ruang, & Search */}
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
                        className="w-full p-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:border-amber-500 cursor-pointer"
                      >
                        <option value="all">Semua Sesi & Mata Pelajaran</option>
                        {dbState.jadwal.map((j) => {
                          const matchMapel = dbState.mapel.find((m) => m.id === j.mapelId);
                          const mapelNama = matchMapel ? matchMapel.nama : "Ujian CBT";
                          return (
                            <option key={j.id} value={j.id}>
                              {j.tanggal} • {mapelNama} ({j.jamMulai} - {j.jamSelesai})
                            </option>
                          );
                        })}
                      </select>
                    </div>

                    {/* Ruang Selector */}
                    <div>
                      <label className="text-[10px] font-extrabold uppercase text-slate-500 block mb-1">
                        Filter Ruang Ujian:
                      </label>
                      <select
                        value={selectedRuang}
                        onChange={(e) => setSelectedRuang(e.target.value)}
                        className="w-full p-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:border-amber-500 cursor-pointer"
                      >
                        <option value="all">Semua Ruang</option>
                        {dbState.kelas.map((r) => (
                          <option key={r.id} value={r.id}>{r.nama}</option>
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
                          className="w-full pl-8 pr-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-amber-500 font-medium"
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
                          ? "bg-amber-600 text-white shadow-sm"
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
                        Tidak ada siswa yang cocok dengan filter sesi/ruang/status ini.
                      </p>
                      <p className="text-xs text-slate-400">
                        {monitorSelectedJadwalId !== "all" || selectedRuang !== "all" || monitorSelectedStatus !== "all" || monitorSearchQuery
                          ? "Cobalah untuk mengubah opsi filter sesi jadwal atau reset ke Semua."
                          : "Aktivitas pengerjaan siswa akan otomatis muncul secara live di sini saat siswa memulai ujian."}
                      </p>
                      {(monitorSelectedJadwalId !== "all" || selectedRuang !== "all" || monitorSelectedStatus !== "all" || monitorSearchQuery) && (
                        <button
                          onClick={() => {
                            setMonitorSelectedJadwalId("all");
                            setSelectedRuang("all");
                            setMonitorSelectedStatus("all");
                            setMonitorSearchQuery("");
                          }}
                          className="px-4 py-2 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl text-xs font-bold text-amber-700 transition cursor-pointer shadow-sm"
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
        </AnimatePresence>
      </main>

      {/* IN-APP CONFIRMATION MODAL */}
      {confirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl border border-slate-100 space-y-4 text-left"
          >
            <div className="flex items-start gap-3">
              <div className={`p-2.5 rounded-xl shrink-0 ${confirmModal.isDanger ? "bg-rose-100 text-rose-600" : "bg-sky-100 text-[#0666AE]"}`}>
                <AlertTriangle size={20} />
              </div>
              <div className="space-y-1">
                <h4 className="font-black text-slate-800 text-sm">{confirmModal.title}</h4>
                <p className="text-xs text-slate-600 leading-relaxed">{confirmModal.message}</p>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setConfirmModal(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs cursor-pointer transition"
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
                className={`px-4 py-2 rounded-xl font-bold text-xs text-white cursor-pointer transition shadow-sm ${
                  confirmModal.isDanger ? "bg-rose-600 hover:bg-rose-700" : "bg-[#0666AE] hover:bg-[#0666AE]/95"
                }`}
              >
                Ya, Lanjutkan
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
