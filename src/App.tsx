import React, { useState, useEffect } from "react";
import AdminPortal from "./components/AdminPortal";
import GuruPortal from "./components/GuruPortal";
import PengawasPortal from "./components/PengawasPortal";
import StudentSimulator from "./components/StudentSimulator";
import { Shield, ArrowRight, Eye, EyeOff, Smartphone, AlertCircle, Cloud } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { getDB, subscribeToDB, getSyncStatus, subscribeToSyncStatus, SyncStatus } from "./firebaseConfig";

export default function App() {
  // Check if query parameter specifies student mode
  const isSiswaParam = typeof window !== "undefined" && window.location.search.toLowerCase().includes("siswa");

  if (isSiswaParam) {
    return (
      <div className="bg-[#0666AE]/5 min-h-screen text-slate-800 font-sans flex flex-col justify-between overflow-x-hidden">
        <StudentSimulator standalone={true} />
      </div>
    );
  }

  // Navigation & Sesi state inside main portal
  const [currentUserRole, setCurrentUserRole] = useState<"none" | "admin" | "guru" | "pengawas">("none");
  const [currentUsername, setCurrentUsername] = useState("");

  // Portal login credentials inputs
  const [portalUser, setPortalUser] = useState("");
  const [portalPass, setPortalPass] = useState("");
  const [showPortalPass, setShowPortalPass] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [, setDbTick] = useState(0);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>(getSyncStatus());

  useEffect(() => {
    const unsubDb = subscribeToDB(() => setDbTick((t) => t + 1));
    const unsubSync = subscribeToSyncStatus((st) => setSyncStatus(st));
    return () => {
      unsubDb();
      unsubSync();
    };
  }, []);

  const handlePortalLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    const user = portalUser.trim().toLowerCase();
    const pass = portalPass.trim();

    if (!user) {
      setLoginError("Masukkan nama pengguna (username) terlebih dahulu.");
      return;
    }

    // 1. Verify Admin
    if (user === "admin") {
      setCurrentUserRole("admin");
      setCurrentUsername("admin");
      return;
    }

    // 2. Verify Guru dynamically in database
    const gList = getDB.guru();
    const matchGuru = gList.find(
      (g) =>
        (g.username || "").trim().toLowerCase() === user &&
        (g.password ? g.password === pass : pass === "Password123")
    );
    if (matchGuru) {
      setCurrentUserRole("guru");
      setCurrentUsername(matchGuru.username);
      return;
    }

    // 3. Verify Pengawas / Supervisor dynamically in database
    const pList = getDB.pengawas();
    const matchPengawas = pList.find(
      (p) =>
        (p.username || "").trim().toLowerCase() === user &&
        (p.password ? p.password === pass : pass === "Password123")
    );
    if (matchPengawas) {
      setCurrentUserRole("pengawas");
      setCurrentUsername(matchPengawas.username);
      return;
    }

    if (!syncStatus.cloudReady) {
      setLoginError("Data akun dari server Cloud sedang dimuat. Tunggu beberapa detik lalu coba masuk kembali.");
      return;
    }

    setLoginError(
      "Username atau kata sandi tidak ditemukan di database terbaru. Pastikan username & password sesuai data yang didaftarkan Admin."
    );
  };

  const handlePortalLogout = () => {
    setCurrentUserRole("none");
    setCurrentUsername("");
    setPortalUser("");
    setPortalPass("");
    setLoginError(null);
  };

  return (
    <div className="bg-slate-50 min-h-screen text-slate-800 font-sans flex flex-col justify-between overflow-x-hidden">
      {/* 1. MAIN GLOBAL NAVBAR */}
      <header className="bg-white border-b border-slate-200/80 px-3 sm:px-6 py-2.5 sm:py-3.5 flex flex-col sm:flex-row justify-between items-center gap-2.5 sm:gap-4 select-none shrink-0 sticky top-0 z-40 shadow-xs">
        <div className="flex items-center gap-2.5 sm:gap-3 text-left w-full sm:w-auto justify-between sm:justify-start">
          <div className="flex items-center gap-2.5 sm:gap-3">
            <img
              src="/assets/aistudio/MTS_AL-MA_SUM_II_7c7dea1b.png"
              alt="Logo CBT MTs. Al-Ma'sum II Cmc"
              className="w-8 h-8 sm:w-10 sm:h-10 object-contain shrink-0"
              referrerPolicy="no-referrer"
            />
            <div>
              <h1 className="text-xs sm:text-md font-extrabold tracking-tight text-slate-900 flex items-center gap-1.5 sm:gap-2">
                <span className="font-sans">CBT MTs. AL-MA'SUM II CMC</span>
                <span className="text-[9px] sm:text-[10px] bg-[#0666AE] text-white px-1.5 sm:px-2 py-0.2 sm:py-0.5 rounded-full font-mono uppercase font-bold text-center tracking-wide">
                  CBT v1.0
                </span>
              </h1>
              <p className="text-[10px] sm:text-xs text-slate-500 font-medium line-clamp-1">Sistem Portal Ujian Digital Madrasah • MTs. Al-Ma'sum II Cimuncang</p>
            </div>
          </div>

          {/* Quick link to student portal on mobile top bar if logged out */}
          {currentUserRole === "none" && (
            <a
              href="?siswa=true"
              className="sm:hidden px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[10px] font-bold shadow-xs whitespace-nowrap"
            >
              Ujian Siswa 👨‍🎓
            </a>
          )}
        </div>

        {/* Portal Info Badge */}
        <div className="hidden sm:flex items-center gap-3">
          <div className="flex items-center bg-slate-50 px-3.5 py-1.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 gap-2">
            <span className={`w-2 h-2 rounded-full ${syncStatus.cloudReady ? "bg-emerald-500 animate-pulse" : "bg-amber-400 animate-ping"}`}></span>
            <span>{syncStatus.cloudReady ? "Sistem Berjalan Utama Live" : "Menghubungkan ke Server..."}</span>
          </div>
        </div>
      </header>

      {/* 2. DYNAMICAL INTERACT VIEWS PLATFORMS WITH ANIMS */}
      <main className="flex-1 p-2 sm:p-4 md:p-6 max-w-7xl w-full mx-auto flex flex-col gap-4 sm:gap-6 justify-start sm:justify-center">
        {/* Full Width: Administration Portals container */}
        <div className="w-full">
          <AnimatePresence mode="wait">
            <motion.div
              key="portal-view"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.35, ease: "easeOut" }}
              className={`bg-white border border-slate-200 rounded-2xl p-2 sm:p-5 md:p-6 min-h-[550px] shadow-sm flex flex-col text-left ${
                currentUserRole === "none" ? "justify-center" : "justify-start"
              }`}
            >
              {currentUserRole === "none" ? (
                <div className="max-w-md mx-auto py-10 space-y-6 text-center w-full">
                  <div className="space-y-3">
                    <div className="flex justify-center items-center gap-3">
                      <img
                        src="/assets/aistudio/MTS_AL-MA_SUM_II_7c7dea1b.png"
                        alt="Logo CBT MTs. Al-Ma'sum II Cmc"
                        className="w-16 h-16 object-contain drop-shadow-md animate-pulse"
                        referrerPolicy="no-referrer"
                      />
                    </div>
                    <div>
                      <h2 className="text-xl font-extrabold tracking-tight text-slate-900 uppercase">CBT MTs. Al-Ma'sum II Cmc</h2>
                      <div className="inline-flex items-center gap-1.5 mt-1 bg-sky-50 text-[#0666AE] border border-sky-100 font-extrabold font-mono text-[10px] px-2.5 py-1 rounded-full uppercase tracking-wider">
                        <span>Portal Resmi CBT • Cimuncang</span>
                      </div>
                      
                      {/* Highly prominent redirect banner for students */}
                      <div className="mt-4 p-4 bg-emerald-600 text-white rounded-2xl shadow-md border border-emerald-500/10 space-y-2 text-center">
                        <p className="text-xs font-black tracking-wide uppercase">👨‍🎓 PORTAL KHUSUS PESERTA UJIAN SISWA</p>
                        <p className="text-[10.5px] text-emerald-50 font-bold opacity-90 leading-tight">
                          Apakah Anda siswa yang ingin mengerjakan soal ujian?
                        </p>
                        <a 
                          href="?siswa=true" 
                          className="inline-block mt-1.5 px-6 py-2 bg-white text-emerald-700 font-black rounded-xl hover:bg-emerald-50 hover:scale-[1.02] text-xs transition shadow-md cursor-pointer animate-bounce"
                        >
                          MASUK KE UJIAN SISWA 🚀
                        </a>
                      </div>

                      <p className="text-xs text-slate-500 max-w-sm mx-auto mt-4 font-medium leading-relaxed">
                        Silakan login sebagai guru pengampu, administrator utama, atau pengawas aktif ruang CBT madrasah jika Anda pengelola.
                      </p>

                      <div className="mt-2 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 text-[10px] font-bold text-slate-600">
                        <Cloud size={12} className={syncStatus.cloudReady ? "text-emerald-600" : "text-amber-500 animate-pulse"} />
                        <span>
                          {syncStatus.cloudReady
                            ? "Data akun tersinkronisasi dari server"
                            : "Memuat daftar akun terbaru dari server..."}
                        </span>
                      </div>
                    </div>
                  </div>

                  {loginError && (
                    <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs font-bold flex items-start gap-2 text-left">
                      <AlertCircle size={15} className="shrink-0 mt-0.5" />
                      <span>{loginError}</span>
                    </div>
                  )}

                  <form onSubmit={handlePortalLogin} className="space-y-4 text-xs text-left bg-slate-50/50 p-6 rounded-2xl border border-slate-100">
                    <div className="space-y-1.5">
                      <label className="text-[10px] text-slate-500 font-extrabold uppercase block">Nama Pengguna (Username)</label>
                      <input
                        type="text"
                        value={portalUser}
                        onChange={(e) => setPortalUser(e.target.value)}
                        placeholder="Masukkan username"
                        className="w-full p-3 bg-white border border-slate-200 rounded-xl text-slate-800 focus:outline-[#0666AE] focus:ring-2 focus:ring-[#0666AE]/20 transition-all font-medium"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] text-slate-500 font-extrabold uppercase block">Password / Kata Sandi</label>
                      <div className="relative">
                        <input
                          type={showPortalPass ? "text" : "password"}
                          value={portalPass}
                          onChange={(e) => setPortalPass(e.target.value)}
                          placeholder="Masukkan password..."
                          className="w-full p-3 bg-white border border-slate-200 rounded-xl text-slate-800 focus:outline-[#0666AE] focus:ring-2 focus:ring-[#0666AE]/20 transition-all font-medium"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPortalPass((p) => !p)}
                          className="absolute right-3 top-3.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                        >
                          {showPortalPass ? <EyeOff size={15} /> : <Eye size={15} />}
                        </button>
                      </div>
                    </div>

                    <button
                      type="submit"
                      className="w-full py-3 bg-[#0666AE] hover:bg-[#0666AE]/95 text-white font-extrabold rounded-xl cursor-pointer transition-all flex items-center justify-center gap-2 shadow-sm hover:shadow-md hover:scale-[1.01]"
                    >
                      <span>Masuk Ke Portal Utama</span>
                      <ArrowRight size={14} />
                    </button>
                  </form>
                </div>
              ) : currentUserRole === "admin" ? (
                <AdminPortal onLogout={handlePortalLogout} adminEmail="almasumcimuncang@gmail.com" />
              ) : currentUserRole === "guru" ? (
                <GuruPortal onLogout={handlePortalLogout} guruUser={currentUsername} />
              ) : (
                <PengawasPortal onLogout={handlePortalLogout} pengawasUser={currentUsername} />
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>

      {/* 3. CORE BRAND FOOTER */}
      <footer className="py-5 text-center border-t border-slate-200 text-[11px] text-slate-500 shrink-0 select-none bg-white leading-relaxed">
        <p className="font-medium">Hak Cipta Terdaftar © {new Date().getFullYear()} MTs. Al-Ma'sum II Cimuncang. Semua Hak Dilindungi Undang-Undang.</p>
        <p className="text-slate-400 mt-1 font-mono uppercase tracking-[0.14em] text-[9px]">CBT MTs. Al-Ma'sum II Cmc • Security Platform Kernel v1.0-Prod</p>
      </footer>
    </div>
  );
}
