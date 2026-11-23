import React, { useState, useEffect, useRef } from "react";
import jsQR from "jsqr";
import { 
  getDB, 
  setDB, 
  subscribeToDB, 
  notifySync,
  isFirebaseConfigured,
  setSyncMode,
  syncSingleSession
} from "../firebaseConfig";
import { 
  Smartphone, 
  Wifi, 
  Battery, 
  Clock, 
  Signal, 
  ScanLine, 
  BookOpen, 
  LogOut, 
  KeyRound, 
  ListOrdered, 
  CheckCircle, 
  AlertCircle, 
  ChevronLeft, 
  ChevronRight, 
  HelpCircle,
  Undo,
  Camera,
  Upload,
  RefreshCw
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { Siswa, Soal, JadwalUjian, SesiSiswa, HasilUjian } from "../types";
import { filterQuestionsForJadwal, canonicalClassAlias } from "../utils/examQuestionFilter";
import RichMathText, { hasArabicText } from "./RichMathText";

export default function StudentSimulator({ standalone = false }: { standalone?: boolean }) {
  // Device Hardware states
  const [isPowerOn, setIsPowerOn] = useState(true);
  const [signalStrength, setSignalStrength] = useState<4 | 3 | 2 | 1>(4);
  const [batteryLevel, setBatteryLevel] = useState(100);
  const [batteryCharging, setBatteryCharging] = useState(false);
  
  // Real-time ticking Clock headers
  const [currentTimeStr, setCurrentTimeStr] = useState("");
  const [currentDateStr, setCurrentDateStr] = useState("");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showKioskIntro, setShowKioskIntro] = useState(false);
  const [showFullscreenRequired, setShowFullscreenRequired] = useState(false);

  // Hook into browser Battery Status API securely
  useEffect(() => {
    const nav = navigator as any;
    if (nav.getBattery) {
      nav.getBattery().then((battery: any) => {
        setBatteryLevel(Math.round(battery.level * 100));
        setBatteryCharging(battery.charging);
        
        const updateLvl = () => setBatteryLevel(Math.round(battery.level * 100));
        const updateChg = () => setBatteryCharging(battery.charging);

        battery.addEventListener("levelchange", updateLvl);
        battery.addEventListener("chargingchange", updateChg);
        
        return () => {
          battery.removeEventListener("levelchange", updateLvl);
          battery.removeEventListener("chargingchange", updateChg);
        };
      });
    }
  }, []);

  // Hook into network and online/offline status
  useEffect(() => {
    const updateConnection = () => {
      const nav = navigator as any;
      if (!nav.onLine) {
        setSignalStrength(1);
        return;
      }
      const conn = nav.connection || nav.mozConnection || nav.webkitConnection;
      if (conn) {
        if (conn.effectiveType === "4g") setSignalStrength(4);
        else if (conn.effectiveType === "3g") setSignalStrength(3);
        else if (conn.effectiveType === "2g") setSignalStrength(2);
        else setSignalStrength(1);
      } else {
        setSignalStrength(4);
      }
    };
    updateConnection();
    window.addEventListener("online", updateConnection);
    window.addEventListener("offline", updateConnection);
    const conn = (navigator as any).connection;
    if (conn) {
      conn.addEventListener("change", updateConnection);
    }
    return () => {
      window.removeEventListener("online", updateConnection);
      window.removeEventListener("offline", updateConnection);
      if (conn) {
        conn.removeEventListener("change", updateConnection);
      }
    };
  }, []);

  // Hook into Fullscreen lifecycle
  useEffect(() => {
    const checkFullscreenState = () => {
      const isFull = !!(
        document.fullscreenElement ||
        (document as any).webkitFullscreenElement ||
        (document as any).mozFullScreenElement ||
        (document as any).msFullscreenElement
      );
      setIsFullscreen(isFull);
      
      // If we are standalone and not full screen, disable the blocker overlay for native APK/WebView compatibility
      setShowFullscreenRequired(false);
    };

    document.addEventListener("fullscreenchange", checkFullscreenState);
    document.addEventListener("webkitfullscreenchange", checkFullscreenState);
    document.addEventListener("mozfullscreenchange", checkFullscreenState);
    document.addEventListener("MSFullscreenChange", checkFullscreenState);
    
    checkFullscreenState();

    return () => {
      document.removeEventListener("fullscreenchange", checkFullscreenState);
      document.removeEventListener("webkitfullscreenchange", checkFullscreenState);
      document.removeEventListener("mozfullscreenchange", checkFullscreenState);
      document.removeEventListener("MSFullscreenChange", checkFullscreenState);
    };
  }, [standalone, showKioskIntro]);

  const requestKioskFullscreen = () => {
    const docEl = document.documentElement as any;
    const requestMethod =
      docEl.requestFullscreen ||
      docEl.webkitRequestFullscreen ||
      docEl.mozRequestFullScreen ||
      docEl.msRequestFullscreen;

    if (requestMethod) {
      requestMethod.call(docEl)
        .then(() => {
          setIsFullscreen(true);
          setShowKioskIntro(false);
          setShowFullscreenRequired(false);
        })
        .catch((err: any) => {
          console.error("Fullscreen error", err);
          // Fallback
          setIsFullscreen(true);
          setShowKioskIntro(false);
          setShowFullscreenRequired(false);
        });
    } else {
      setIsFullscreen(true);
      setShowKioskIntro(false);
      setShowFullscreenRequired(false);
    }
  };

  const recoverKioskFullscreen = (e: React.FormEvent) => {
    e.preventDefault();
    const masterReg = dbState.konfig.kodeRegistrasi || "";
    const isCorrect = 
      exitPasscode.trim().toUpperCase() === "ALMASUM" || 
      exitPasscode.trim() === "8899" ||
      (masterReg && exitPasscode.trim() === masterReg);

    if (isCorrect) {
      setExitPasscode("");
      setExitError(false);
      requestKioskFullscreen();
    } else {
      setExitError(true);
    }
  };

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTimeStr(
        now.toLocaleTimeString("id-ID", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: false,
        })
      );
      setCurrentDateStr(
        now.toLocaleDateString("id-ID", {
          weekday: "long",
          year: "numeric",
          month: "short",
          day: "numeric",
        })
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Sync state with shared DB
  const [dbState, setDBState] = useState({
    siswa: getDB.siswa(),
    soal: getDB.soal(),
    jadwal: getDB.jadwal(),
    tokens: getDB.tokens(),
    sessions: getDB.sessions(),
    hasil: getDB.hasil(),
    konfig: getDB.konfig(),
  });

  useEffect(() => {
    const unsub = subscribeToDB(() => {
      setDBState({
        siswa: getDB.siswa(),
        soal: getDB.soal(),
        jadwal: getDB.jadwal(),
        tokens: getDB.tokens(),
        sessions: getDB.sessions(),
        hasil: getDB.hasil(),
        konfig: getDB.konfig(),
      });
    });
    return unsub;
  }, []);

  // Student application flow states
  // screen: 'login' | 'select-exam' | 'token-entry' | 'exam' | 'completed' | 'blocked'
  const [screen, setScreen] = useState<"login" | "select-exam" | "token-entry" | "exam" | "completed" | "blocked">("login");
  const [loggedInStudent, setLoggedInStudent] = useState<Siswa | null>(null);
  const [selectedJadwal, setSelectedJadwal] = useState<JadwalUjian | null>(null);
  const [sessionResetNotice, setSessionResetNotice] = useState<string | null>(null);
  const [sessionForceFinishedNotice, setSessionForceFinishedNotice] = useState(false);
  const activeSessionCreatedRef = useRef(false);
  const pendingSessionRef = useRef<SesiSiswa | null>(null);
  const sessionSyncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flushSessionSync = (explicitSession?: SesiSiswa) => {
    if (sessionSyncTimerRef.current) {
      clearTimeout(sessionSyncTimerRef.current);
      sessionSyncTimerRef.current = null;
    }
    const target = explicitSession || pendingSessionRef.current;
    pendingSessionRef.current = null;
    if (target) {
      syncSingleSession(target);
    }
  };

  const scheduleSessionSync = (session: SesiSiswa) => {
    // Save immediately to localStorage + notify React state so refresh/infractions keep every answer
    const current = getDB.sessions();
    const next = [...current.filter((s) => s.id !== session.id), session];
    localStorage.setItem("exambro_sessions", JSON.stringify(next));
    notifySync();
    pendingSessionRef.current = session;
    if (sessionSyncTimerRef.current) return;
    sessionSyncTimerRef.current = setTimeout(() => {
      sessionSyncTimerRef.current = null;
      const toSend = pendingSessionRef.current;
      pendingSessionRef.current = null;
      if (toSend) {
        syncSingleSession(toSend);
      }
    }, 15000);
  };

  useEffect(() => {
    setSyncMode(loggedInStudent ? "student" : "staff", loggedInStudent?.nisn);
    return () => {
      flushSessionSync();
      setSyncMode("staff");
    };
  }, [loggedInStudent?.nisn]);

  useEffect(() => {
    const handleFlush = () => {
      if (document.visibilityState === "hidden") {
        flushSessionSync();
      }
    };
    const handlePageHide = () => flushSessionSync();
    document.addEventListener("visibilitychange", handleFlush);
    window.addEventListener("pagehide", handlePageHide);
    return () => {
      document.removeEventListener("visibilitychange", handleFlush);
      window.removeEventListener("pagehide", handlePageHide);
    };
  }, []);
  
  // Login input bindings
  const [usernameInput, setUsernameInput] = useState("");
  const [passwordInput, setPasswordInput] = useState("");
  const [showQRScanner, setShowQRScanner] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [showManualSelection, setShowManualSelection] = useState(false);

  // Helper: Decode and match student credentials from scanned QR payload
  const findStudentFromQRData = (rawText: string, siswaList: Siswa[]): { siswa: Siswa; password?: string } | null => {
    const text = (rawText || "").trim();
    if (!text) return null;

    // 1. JSON format: {"u":"siswa1","p":"..."} generated by PrintCards / Kartu Ujian
    try {
      const obj = JSON.parse(text);
      if (obj && typeof obj === "object") {
        const u = (obj.u || obj.username || obj.nisn || obj.noPeserta || "").toString().trim().toLowerCase();
        const p = (obj.p || obj.password || "").toString().trim();
        if (u) {
          const match = siswaList.find(
            (s) =>
              s.username.toLowerCase() === u ||
              s.nisn.toLowerCase() === u ||
              (s.noPeserta && s.noPeserta.toLowerCase() === u) ||
              s.id.toLowerCase() === u
          );
          if (match) return { siswa: match, password: p || match.password };
        }
      }
    } catch {
      // Not JSON, proceed to other patterns
    }

    // 2. Colon-separated format: "username:password"
    if (text.includes(":")) {
      const parts = text.split(":");
      const u = parts[0].trim().toLowerCase();
      const p = parts.slice(1).join(":").trim();
      const match = siswaList.find(
        (s) =>
          s.username.toLowerCase() === u ||
          s.nisn.toLowerCase() === u ||
          (s.noPeserta && s.noPeserta.toLowerCase() === u) ||
          s.id.toLowerCase() === u
      );
      if (match) return { siswa: match, password: p || match.password };
    }

    // 3. Direct match: username, NISN, noPeserta, or ID
    const target = text.toLowerCase();
    const directMatch = siswaList.find(
      (s) =>
        s.username.toLowerCase() === target ||
        s.nisn.toLowerCase() === target ||
        (s.noPeserta && s.noPeserta.toLowerCase() === target) ||
        s.id.toLowerCase() === target
    );
    if (directMatch) return { siswa: directMatch, password: directMatch.password };

    return null;
  };

  // Image Upload fallback for QR Code
  const handleQRImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        try {
          const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const code = jsQR(imgData.data, imgData.width, imgData.height, {
            inversionAttempts: "dontInvert",
          });
          if (code && code.data) {
            const result = findStudentFromQRData(code.data, dbState.siswa);
            if (result) {
              if (navigator.vibrate) navigator.vibrate(200);
              handleQRScannerBypass(result.siswa, result.password);
              return;
            } else {
              alert(`QR Code terdeteksi: "${code.data.slice(0, 45)}...", tetapi data siswa tidak ditemukan dalam database.`);
            }
          } else {
            alert("Kode QR tidak terdeteksi pada gambar. Pastikan gambar jelas, terang, dan tidak buram.");
          }
        } catch (err) {
          console.error("Gagal scan gambar QR:", err);
          alert("Gagal memproses gambar kode QR.");
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  // Physical Camera and live web-cam scanner loop using jsQR
  useEffect(() => {
    let active = true;
    let localStream: MediaStream | null = null;
    let animationId: number;

    if (showQRScanner) {
      setCameraError(null);

      // Check browser WebRTC camera capability
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setCameraError("Browser Anda tidak mendukung akses kamera langsung. Silakan gunakan tombol Unggah Foto QR di bawah.");
        return;
      }

      // Try back camera first with ideal constraints, then fallback to any available camera
      const requestCameraStream = async () => {
        try {
          return await navigator.mediaDevices.getUserMedia({
            video: {
              facingMode: { ideal: "environment" },
              width: { ideal: 1280 },
              height: { ideal: 720 },
            },
            audio: false,
          });
        } catch (err1) {
          console.warn("Retrying with any available video camera:", err1);
          try {
            return await navigator.mediaDevices.getUserMedia({
              video: true,
              audio: false,
            });
          } catch (err2) {
            console.error("All camera requests failed:", err2);
            throw err2;
          }
        }
      };

      requestCameraStream()
        .then((stream) => {
          if (!active) {
            stream.getTracks().forEach((t) => t.stop());
            return;
          }
          localStream = stream;
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            videoRef.current.setAttribute("playsinline", "true");
            videoRef.current.play().catch((e) => console.log("Video playback fail", e));
          }

          const scan = () => {
            if (!active) return;
            const video = videoRef.current;
            const canvas = canvasRef.current;
            if (video && canvas && video.readyState === video.HAVE_ENOUGH_DATA) {
              const ctx = canvas.getContext("2d");
              if (ctx) {
                canvas.width = video.videoWidth;
                canvas.height = video.videoHeight;
                ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                try {
                  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                  const code = jsQR(imageData.data, imageData.width, imageData.height, {
                    inversionAttempts: "dontInvert",
                  });

                  if (code && code.data) {
                    const result = findStudentFromQRData(code.data, dbState.siswa);
                    if (result) {
                      if (navigator.vibrate) navigator.vibrate(200);
                      handleQRScannerBypass(result.siswa, result.password);
                      return; // exit the loop on successful match
                    }
                  }
                } catch (e) {
                  console.error("Scanning process error", e);
                }
              }
            }
            animationId = requestAnimationFrame(scan);
          };
          animationId = requestAnimationFrame(scan);
        })
        .catch((err) => {
          console.error("Camera access failed", err);
          setCameraError(
            "Izin kamera belum aktif atau kamera sedang digunakan aplikasi lain. Silakan izinkan akses kamera atau gunakan tombol 'Ambil / Unggah Foto QR' di bawah."
          );
        });
    }

    return () => {
      active = false;
      if (localStream) {
        localStream.getTracks().forEach((t) => t.stop());
      }
      if (animationId) {
        cancelAnimationFrame(animationId);
      }
    };
  }, [showQRScanner, dbState.siswa]);
  const [loginError, setLoginError] = useState<string | null>(null);

  // Token entry state
  const [tokenInput, setTokenInput] = useState("");
  const [tokenError, setTokenError] = useState<string | null>(null);

  // Ongoing Exam state
  const [questions, setQuestions] = useState<Soal[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [fontSizeClass, setFontSizeClass] = useState<"text-sm" | "text-base" | "text-lg">("text-base");
  const [studentAnswers, setStudentAnswers] = useState<Record<number, string>>({});
  const [raguRaguAnswers, setRaguRaguAnswers] = useState<Record<number, boolean>>({});
  const [showNavigationDrawer, setShowNavigationDrawer] = useState(false);
  
  // Exam Timer Countdown
  const [secondsRemaining, setSecondsRemaining] = useState(3600); // changes depending on exam duration
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Warning state (windows blur checker)
  const [showCheatWarning, setShowCheatWarning] = useState(false);
  const [bypassFocusListen, setBypassFocusListen] = useState(false);

  // Security Exit state
  const [showExitModal, setShowExitModal] = useState(false);
  const [exitPasscode, setExitPasscode] = useState("");
  const [exitError, setExitError] = useState(false);

  // Custom interactive submit confirmation modal (replaces native confirm dialog)
  const [showSubmitConfirmModal, setShowSubmitConfirmModal] = useState(false);
  
  // Date/Time calculation for filtering schedules
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const currentDateStrYMD = `${year}-${month}-${day}`;

  // Local/UTC robust calendar compatibility (guards against VM or database timezone offsets)
  const utcYear = now.getUTCFullYear();
  const utcMonth = String(now.getUTCMonth() + 1).padStart(2, "0");
  const utcDay = String(now.getUTCDate()).padStart(2, "0");
  const currentDateStrYMD_UTC = `${utcYear}-${utcMonth}-${utcDay}`;

  const hours = String(now.getHours()).padStart(2, "0");
  const minutes = String(now.getMinutes()).padStart(2, "0");
  const currentTimeStrHM = `${hours}:${minutes}`;

  // School timezone calculations (WIB = Asia/Jakarta, WITA = Asia/Makassar, WIT = Asia/Jayapura)
  const tzMap: Record<string, string> = {
    WIB: "Asia/Jakarta",
    WITA: "Asia/Makassar",
    WIT: "Asia/Jayapura",
  };
  const schoolTz = tzMap[dbState?.konfig?.zonaWaktu || "WIB"] || "Asia/Jakarta";

  const getTzDateStr = (tz: string) => {
    try {
      return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
    } catch {
      return currentDateStrYMD;
    }
  };

  const getTzTimeStr = (tz: string) => {
    try {
      return new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", minute: "2-digit", hour12: false }).format(now);
    } catch {
      return currentTimeStrHM;
    }
  };

  const currentDateStrYMD_School = getTzDateStr(schoolTz);
  const currentTimeStrHM_School = getTzTimeStr(schoolTz);

  // Real-time watcher for remote Admin / Pengawas session actions (Submit Paksa, Buka Blokir, Reset Sesi)
  useEffect(() => {
    if (!loggedInStudent) {
      activeSessionCreatedRef.current = false;
      return;
    }

    const activeSession = dbState.sessions.find((s) => s.id === loggedInStudent.nisn);

    if (activeSession) {
      activeSessionCreatedRef.current = true;

      if (activeSession.status === "Diskualifikasi" && screen === "exam") {
        setShowCheatWarning(false);
        setShowSubmitConfirmModal(false);
        setScreen("blocked");
        return;
      }

      if (activeSession.status === "Mengerjakan" && screen === "blocked") {
        setStudentAnswers(activeSession.jawabanSiswa || {});
        setRaguRaguAnswers(activeSession.raguRagu || {});
        setShowCheatWarning(false);
        setScreen("exam");
        return;
      }

      if (activeSession.status === "Selesai" && (screen === "exam" || screen === "blocked")) {
        if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
        setShowCheatWarning(false);
        setShowSubmitConfirmModal(false);
        setSessionForceFinishedNotice(true);
        setScreen("completed");
        return;
      }

      if (
        screen === "exam" &&
        Object.keys(studentAnswers).length === 0 &&
        activeSession.jawabanSiswa &&
        Object.keys(activeSession.jawabanSiswa).length > 0
      ) {
        setStudentAnswers(activeSession.jawabanSiswa);
        setRaguRaguAnswers(activeSession.raguRagu || {});
      }
    } else if (
      activeSessionCreatedRef.current &&
      (screen === "exam" || screen === "blocked" || screen === "completed")
    ) {
      // Session was reset/deleted by Pengawas or Admin -> immediately wipe progress and restart from beginning!
      activeSessionCreatedRef.current = false;
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      setQuestions([]);
      setCurrentIndex(0);
      setStudentAnswers({});
      setRaguRaguAnswers({});
      setShowCheatWarning(false);
      setShowSubmitConfirmModal(false);
      setSessionForceFinishedNotice(false);
      setSelectedJadwal(null);
      setTokenInput("");
      setTokenError(null);
      setSessionResetNotice(
        "Sesi ujian Anda telah direset oleh Pengawas/Admin. Silakan mulai ulang ujian dari awal."
      );
      setScreen("select-exam");
    }
  }, [loggedInStudent, screen, dbState.sessions]);

  // Window Focus & Security Cheat Detection (CBT full lockdown system)
  useEffect(() => {
    if (screen !== "exam" || bypassFocusListen) return;

    const triggerSecurityInfraction = (tipe: string, keterangan: string) => {
      if (!loggedInStudent) return;
      const currentSession = dbState.sessions.find(s => s.id === loggedInStudent.nisn);
      if (!currentSession || currentSession.status !== "Mengerjakan") return;

      const updatedInfractions = (currentSession.pelanggaranCount || 0) + 1;
      const logEntry = {
        timestamp: new Date().toLocaleTimeString("id-ID"),
        tipe: tipe,
        keterangan: `${keterangan} (${updatedInfractions}x pelanggaran).`
      };

      const updatedLogs = [...(currentSession.pelanggaranLogs || []), logEntry];
      const limit = dbState.konfig.batasPelanggaran || 3;
      
      let newStatus: SesiSiswa["status"] = currentSession.status;
      if (updatedInfractions >= limit) {
        newStatus = "Diskualifikasi";
        setScreen("blocked");
      } else {
        setShowCheatWarning(true);
      }

      // Update immediately on infraction so proctor monitor receives alert in real time
      const latestSession: SesiSiswa = {
        ...currentSession,
        pelanggaranCount: updatedInfractions,
        pelanggaranLogs: updatedLogs,
        status: newStatus,
        lastUpdated: new Date().toISOString()
      };
      flushSessionSync(latestSession);
    };

    // 1. Tab switches and loss of window focus
    const handleBlur = () => {
      triggerSecurityInfraction("Pindah Layar / Tab", "Siswa keluar area fokus CBT.");
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        triggerSecurityInfraction("Navigasi Latar Belakang", "Siswa membuka aplikasi lain atau menutupi layar utama.");
      }
    };

    // 2. Prevent Split Screen, floating windows & PiP of phone via size tracking
    let lastWidth = window.innerWidth;
    let lastHeight = window.innerHeight;
    const handleResize = () => {
      const widthDiff = Math.abs(window.innerWidth - lastWidth);
      const heightDiff = Math.abs(window.innerHeight - lastHeight);
      if (widthDiff > 80 || heightDiff > 80) {
        triggerSecurityInfraction("Split Screen / Ukuran Berubah", "Deteksi pembagian layar (split-screen), rotasi ilegal, atau floating widget.");
        lastWidth = window.innerWidth;
        lastHeight = window.innerHeight;
      }
    };

    // 3. Prevent Copy, Paste, Cut
    const handleCopyPaste = (e: Event) => {
      e.preventDefault();
      triggerSecurityInfraction("Aksi Salin / Tempel", "Mencoba menyalin/menempel teks soal di area lembar ujian.");
    };

    // 4. Intercept Inspect & Cheat keys (F12, Inspect, Alt+Tab, Win keys, Ctrl+C / Ctrl+V, etc.)
    const handleKeyDown = (e: KeyboardEvent) => {
      const isControlOrMeta = e.ctrlKey || e.metaKey || e.altKey;
      if (
        e.code === "F12" || e.code === "F11" ||
        (isControlOrMeta && ["KeyC", "KeyV", "KeyI", "KeyJ", "KeyU", "KeyS", "KeyP", "KeyR", "KeyN", "KeyT"].includes(e.code)) ||
        e.code === "MetaLeft" || e.code === "MetaRight" || e.code === "ContextMenu"
      ) {
        e.preventDefault();
        e.stopPropagation();
        triggerSecurityInfraction("Shortcuts Terlarang", `Mencoba menggunakan tombol pintas (${e.key || e.code}) untuk mengambil tangkapan layar, inspect, atau shortcut eksternal.`);
      }
    };

    // 5. Intercept Right-click menu
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      triggerSecurityInfraction("Klik Kanan Dilarang", "Aksi klik kanan terblokir demi integritas ujian.");
    };

    window.addEventListener("blur", handleBlur);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("resize", handleResize);
    window.addEventListener("keydown", handleKeyDown, true);
    window.addEventListener("contextmenu", handleContextMenu, true);
    document.addEventListener("copy", handleCopyPaste, true);
    document.addEventListener("paste", handleCopyPaste, true);
    document.addEventListener("cut", handleCopyPaste, true);

    return () => {
      window.removeEventListener("blur", handleBlur);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("keydown", handleKeyDown, true);
      window.removeEventListener("contextmenu", handleContextMenu, true);
      document.removeEventListener("copy", handleCopyPaste, true);
      document.removeEventListener("paste", handleCopyPaste, true);
      document.removeEventListener("cut", handleCopyPaste, true);
    };
  }, [screen, loggedInStudent, dbState.sessions, dbState.konfig.batasPelanggaran, bypassFocusListen]);

  // Handle countdown exam timer
  useEffect(() => {
    if (screen === "exam") {
      timerIntervalRef.current = setInterval(() => {
        setSecondsRemaining(prev => {
          if (prev <= 1) {
            clearInterval(timerIntervalRef.current!);
            handleForceSubmitExam();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    }

    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    };
  }, [screen]);

  // Format second countdown timer
  const formatTimer = (totalSeconds: number) => {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
  };

  // Perform Student Authentication
  const handleLogin = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setLoginError(null);
    const u = usernameInput.trim().toLowerCase();
    const p = passwordInput.trim();

    if (!u || !p) {
      setLoginError("Username dan password harus diisi.");
      return;
    }

    const matchedSiswa = dbState.siswa.find(
      s => s.username.toLowerCase() === u && (s.password ? s.password === p : p === "Password123")
    );

    if (matchedSiswa) {
      setLoggedInStudent(matchedSiswa);
      // Auto transition to exam selection
      setScreen("select-exam");
    } else {
      setLoginError("Pasangan NISN/Username dan password salah.");
    }
  };

  // Bypasses logging using scanned QR Code or manual bypass click
  const handleQRScannerBypass = (siswa: Siswa, customPassword?: string) => {
    setUsernameInput(siswa.username);
    setPasswordInput(customPassword || siswa.password || "Password123");
    setShowQRScanner(false);
    setLoginError(null);
    
    // Auto logging
    setLoggedInStudent(siswa);
    setScreen("select-exam");
  };

  // Student starts exam scheduling process
  const startExamProcess = (jadwal: JadwalUjian) => {
    setSelectedJadwal(jadwal);
    setScreen("token-entry");
    setTokenInput("");
    setTokenError(null);
  };

  // Verifies dynamic tokens and launches physical exam frame
  const handleVerifyToken = () => {
    setTokenError(null);
    if (!selectedJadwal) return;

    // Check if the input matches any active token for this mapel
    const matchedTokenObj = dbState.tokens.find(
      t => t.id === selectedJadwal.mapelId && t.token.toUpperCase() === tokenInput.trim().toUpperCase()
    );

    // Get all mapels to display name
    const activeMapel = getDB.mapel().find(m => m.id === selectedJadwal.mapelId);
    const mapelNama = activeMapel ? activeMapel.nama : "Ujian Utama";

    if (!matchedTokenObj) {
      setTokenError("Token salah atau telah kedaluwarsa. Silakan minta Token baru kepada Pengawas Ruang.");
      return;
    }

    // Initialize exam questions (honoring manual soalIds, guruIds filter, and normalized class matching)
    const academicClasses = getDB.kelasAkademik();
    const studentClassName = (loggedInStudent?.kelas || "").trim();
    const studentAlias = canonicalClassAlias(studentClassName);

    const studentClassObj = academicClasses.find(
      (ka) =>
        ka.nama.trim().toLowerCase() === studentClassName.toLowerCase() ||
        ka.id.trim().toLowerCase() === studentClassName.toLowerCase() ||
        (studentAlias && canonicalClassAlias(ka.nama) === studentAlias)
    );
    const studentClassId = studentClassObj ? studentClassObj.id : "";

    const allQuestions = filterQuestionsForJadwal(selectedJadwal, dbState.soal, academicClasses, {
      studentClassName,
      studentClassId,
    });

    if (allQuestions.length === 0) {
      setTokenError("Ujian sedang disiapkan. Tidak ada butir soal ditemukan untuk mata pelajaran dan kelas Anda.");
      return;
    }

    const existingOngoing = dbState.sessions.find(
      (s) =>
        s.id === loggedInStudent!.nisn &&
        s.status === "Mengerjakan" &&
        (s.mapelId === selectedJadwal.mapelId ||
          (s.mapelNama || "").trim().toLowerCase() === mapelNama.trim().toLowerCase())
    );

    const resumedAnswers = existingOngoing?.jawabanSiswa || {};
    const resumedRagu = existingOngoing?.raguRagu || {};
    const resumedFilled = Object.keys(resumedAnswers).filter((k) => resumedAnswers[Number(k)]).length;

    // Set duration & initialize exam states (clean if new or after Reset Sesi)
    setSecondsRemaining(selectedJadwal.durasiMenit * 60);
    setQuestions(allQuestions);
    setCurrentIndex(0);
    setStudentAnswers(resumedAnswers);
    setRaguRaguAnswers(resumedRagu);
    setSessionResetNotice(null);
    setSessionForceFinishedNotice(false);
    activeSessionCreatedRef.current = true;

    // Register active CBT session dynamically
    const studentSessi: SesiSiswa = {
      id: loggedInStudent!.nisn,
      siswaNama: loggedInStudent!.nama,
      siswaKelas: loggedInStudent!.kelas,
      mapelId: selectedJadwal.mapelId,
      mapelNama: mapelNama,
      jadwalId: selectedJadwal.id,
      questionIds: existingOngoing?.questionIds?.length ? existingOngoing.questionIds : allQuestions.map((q) => q.id),
      status: "Mengerjakan",
      deviceId: existingOngoing?.deviceId || "Android-Device",
      pelanggaranCount: existingOngoing?.pelanggaranCount || 0,
      pelanggaranLogs: existingOngoing?.pelanggaranLogs || [],
      jawabanTerisi: resumedFilled,
      totalSoal: allQuestions.length,
      raguRagu: resumedRagu,
      jawabanSiswa: resumedAnswers,
      lastUpdated: new Date().toISOString()
    };

    // Push new exam session atomically without colliding with other students
    flushSessionSync(studentSessi);

    setScreen("exam");
  };

  // Stores answer selections locally (instant) and batches remote sync every 15s for 350-student scale
  const handleSelectAnswer = (optionKey: string) => {
    if (!loggedInStudent) return;
    const newAnswers = { ...studentAnswers, [currentIndex]: optionKey };
    setStudentAnswers(newAnswers);

    const filledCount = Object.keys(newAnswers).filter(k => newAnswers[Number(k)]).length;
    const existing = getDB.sessions().find(s => s.id === loggedInStudent.nisn);
    if (existing) {
      scheduleSessionSync({
        ...existing,
        jawabanTerisi: filledCount,
        jawabanSiswa: newAnswers,
        lastUpdated: new Date().toISOString()
      });
    }
  };

  // Toggle "Ragu-Ragu" (Maybe) state
  const handleToggleRaguRagu = () => {
    if (!loggedInStudent) return;
    const key = currentIndex;
    const newVal = !raguRaguAnswers[key];
    const newRagu = { ...raguRaguAnswers, [key]: newVal };
    setRaguRaguAnswers(newRagu);

    const existing = getDB.sessions().find(s => s.id === loggedInStudent.nisn);
    if (existing) {
      scheduleSessionSync({
        ...existing,
        raguRagu: newRagu,
        lastUpdated: new Date().toISOString()
      });
    }
  };

  // Submit forces exam completion instantly (on countdown timer end)
  const handleForceSubmitExam = () => {
    if (!loggedInStudent || !selectedJadwal) return;
    calculateAndCommitResult();
  };

  // Standard interactive user submit 
  const handleSubmitExam = () => {
    if (!loggedInStudent || !selectedJadwal) return;
    setShowSubmitConfirmModal(true);
  };

  // Calculates scores and updates database
  const calculateAndCommitResult = () => {
    if (!loggedInStudent || !selectedJadwal) return;

    // Mapel name lookup
    const map = getDB.mapel().find(m => m.id === selectedJadwal.mapelId);
    const mapelNama = map ? map.nama : "Ujian Utama";

    let correct = 0;
    let wrong = 0;

    questions.forEach((soal, idx) => {
      const studentAns = studentAnswers[idx];
      if (studentAns === soal.kunci) {
        correct++;
      } else {
        wrong++;
      }
    });

    const score = Math.round((correct / questions.length) * 100);

    const matchHasil: HasilUjian = {
      id: `h_${loggedInStudent.nisn}_${selectedJadwal.mapelId}_${Date.now()}`,
      siswaNisn: loggedInStudent.nisn,
      siswaNama: loggedInStudent.nama,
      siswaKelas: loggedInStudent.kelas,
      mapelId: selectedJadwal.mapelId,
      mapelNama: mapelNama,
      totalSoal: questions.length,
      salah: wrong,
      benar: correct,
      nilai: score,
      tanggalSelesai: new Date().toLocaleString("id-ID"),
      status: "Selesai"
    };

    // Update Hasil database collection (replace prior record for this student + mapel)
    const allHasil = getDB.hasil().filter(
      (h) =>
        !(
          (h.siswaNisn === loggedInStudent.nisn ||
            (h.siswaNama || "").toLowerCase() === loggedInStudent.nama.toLowerCase()) &&
          (h.mapelNama || "").toLowerCase() === mapelNama.toLowerCase()
        )
    );
    setDB.hasil([...allHasil, matchHasil]);

    // Update Student Session atomically to 'Selesai'
    const existingSes = getDB.sessions().find(s => s.id === loggedInStudent.nisn);
    const finishedSession: SesiSiswa = existingSes
      ? {
          ...existingSes,
          status: "Selesai",
          jawabanTerisi: Object.keys(studentAnswers).filter((k) => studentAnswers[Number(k)]).length,
          jawabanSiswa: studentAnswers,
          raguRagu: raguRaguAnswers,
          totalSoal: questions.length,
          lastUpdated: new Date().toISOString(),
        }
      : {
          id: loggedInStudent.nisn,
          siswaNama: loggedInStudent.nama,
          siswaKelas: loggedInStudent.kelas,
          mapelId: selectedJadwal.mapelId,
          mapelNama: mapelNama,
          status: "Selesai",
          deviceId: "Android-Device",
          pelanggaranCount: 0,
          pelanggaranLogs: [],
          jawabanTerisi: Object.keys(studentAnswers).filter((k) => studentAnswers[Number(k)]).length,
          totalSoal: questions.length,
          raguRagu: raguRaguAnswers,
          jawabanSiswa: studentAnswers,
          lastUpdated: new Date().toISOString(),
        };
    flushSessionSync(finishedSession);

    setScreen("completed");
  };

  // Admin / Pengawas bypass passcode to exit from client app
  const processSecureExit = (e: React.FormEvent) => {
    e.preventDefault();
    setExitError(false);

    // Passcodes: ALMASUM or 8899 or configurations master password
    const masterReg = dbState.konfig?.kodeRegistrasi || "";
    const isCorrect = 
      exitPasscode.trim().toUpperCase() === "ALMASUM" || 
      exitPasscode.trim() === "8899" ||
      (masterReg && exitPasscode.trim() === masterReg);

    if (isCorrect) {
      setShowExitModal(false);
      setExitPasscode("");
      
      // Exit HTML5 fullscreen of browser
      if (document.fullscreenElement || (document as any).webkitFullscreenElement) {
        const exitMethod = document.exitFullscreen || (document as any).webkitExitFullscreen;
        if (exitMethod) exitMethod.call(document).catch(() => {});
      }

      // Reset simulator flow to clean start
      setLoggedInStudent(null);
      setSelectedJadwal(null);
      setScreen("login");

      // Redirect student out of secure parameter link
      if (standalone) {
        window.location.href = window.location.origin;
      }
    } else {
      setExitError(true);
    }
  };

  // Student manual log out (only possible if from Select exam portal)
  const handleSimpleLogout = () => {
    setLoggedInStudent(null);
    setSelectedJadwal(null);
    setScreen("login");
  };

  // Re-enable / Reset simulator blocks (admin simulation helper click)
  const handleResetSimulatorBlock = () => {
    if (!loggedInStudent) return;
    const existing = getDB.sessions().find(s => s.id === loggedInStudent.nisn);
    if (existing) {
      flushSessionSync({
        ...existing,
        pelanggaranCount: 0,
        pelanggaranLogs: [],
        status: "Mengerjakan",
        lastUpdated: new Date().toISOString()
      });
    }
    setScreen("exam");
  };

  return (
    <div className={standalone ? "w-full select-none" : "w-full flex flex-col items-center select-none"} id="student_control_panel">
      {/* Immersive Fullscreen Lock Intro Gateway */}
      {standalone && showKioskIntro && (
        <div className="fixed inset-0 bg-slate-900 z-50 flex flex-col justify-center items-center text-center p-6 text-white selection:bg-sky-500/30">
          <div className="w-full max-w-md bg-slate-950 p-8 rounded-3xl border border-slate-800 shadow-2xl space-y-6">
            <div className="text-center space-y-2">
              <img 
                src="/assets/aistudio/MTS_AL-MA_SUM_II_7c7dea1b.png" 
                alt="Logo CBT MTs. Al-Ma'sum II Cmc" 
                className="w-20 h-20 object-contain mx-auto drop-shadow-md animate-bounce"
                referrerPolicy="no-referrer"
              />
              <h2 className="text-xl font-extrabold tracking-tight uppercase text-blue-200">GERBANG CBT AMAN</h2>
              <p className="text-[10px] text-slate-400 font-extrabold tracking-wider uppercase">MTs. AL-MA'SUM II CIMUNCANG</p>
              <div className="h-0.5 w-24 bg-gradient-to-r from-blue-500 to-emerald-500 mx-auto rounded"></div>
            </div>

            <div className="p-4 bg-slate-900 rounded-2xl border border-slate-800 space-y-3 text-left">
              <p className="text-xs text-slate-300 font-medium leading-relaxed">
                Anda mengakses halaman pengerjaan siswa resmi. Demi menjaga integritas dan kejujuran ujian digital, browser Anda wajib dikunci ke dalam <strong>Modus Layar Penuh (Kiosk Mode)</strong>.
              </p>

              <ul className="space-y-1.5 text-[10.5px] text-slate-400 font-bold">
                <li className="flex items-center gap-2">
                  <span className="text-blue-400">✓</span> Kunci Aplikasi & Multi-Tasking Terproteksi
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-blue-400">✓</span> Sensor Device Sinkronisasi Baterai & Sinyal Aktif
                </li>
                <li className="flex items-center gap-2 text-rose-450">
                  <span className="text-rose-500">⚠</span> Keluar Layar Penuh Menangguhkan Ujian!
                </li>
              </ul>
            </div>

            <div className="space-y-3">
              <button
                type="button"
                onClick={requestKioskFullscreen}
                className="w-full py-4 bg-gradient-to-r from-blue-600 to-emerald-600 hover:from-blue-700 hover:to-emerald-700 text-white font-extrabold text-xs uppercase rounded-2xl transition cursor-pointer shadow-lg active:scale-95 flex items-center justify-center gap-2"
              >
                <span>Mulai Konfigurasi Layar Penuh 🚀</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  window.location.href = window.location.origin;
                }}
                className="w-full py-2 bg-transparent hover:bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-300 font-extrabold text-[10px] uppercase rounded-xl transition cursor-pointer"
              >
                Kembali ke Portal Pengelola ↩
              </button>
            </div>

            <p className="text-[8.5px] text-slate-500 text-center font-mono uppercase">CBT MTs. AL-MA'SUM II CMC SHIELD V1.0</p>
          </div>
        </div>
      )}

      {/* Screen blocker overlay when fullscreen is escaped illegally */}
      {standalone && showFullscreenRequired && !showKioskIntro && (
        <div className="fixed inset-0 bg-slate-950 z-50 p-6 flex flex-col justify-center items-center text-center space-y-6 text-white">
          <div className="w-full max-w-sm bg-slate-900 p-8 rounded-3xl border border-rose-950 shadow-2xl space-y-5">
            <div className="w-16 h-16 rounded-full bg-rose-950 border border-rose-500/50 flex items-center justify-center text-rose-500 mx-auto animate-pulse">
              <AlertCircle size={38} className="animate-bounce" />
            </div>

            <div className="space-y-2">
              <h3 className="text-base font-black text-rose-500 uppercase tracking-tight">🔒 INTEGRITAS TERKUNCI: LAYAR KELUAR!</h3>
              <p className="text-xs text-rose-100 font-bold leading-relaxed leading-snug">
                Siswa terdeteksi keluar dari layar penuh resmi, mencoba beralih tab, atau membagi layar. Sesi ujian Anda telah DITANGGUHKAN.
              </p>
            </div>

            <div className="p-4 bg-slate-950 rounded-2xl border border-slate-850 text-left space-y-2">
              <p className="text-[10px] text-slate-400 font-bold">
                Minta Pengawas atau Proktor Anda untuk memasukkan PIN Otorisasi Guru guna memulihkan layar penuh dan melanjutkan ujian Anda:
              </p>
              
              <form onSubmit={recoverKioskFullscreen} className="space-y-3 mt-1.5">
                {exitError && (
                  <p className="text-[9px] text-rose-450 font-black text-center">❌ Sandi Pengisian keliru! Gagal Otorisasi.</p>
                )}

                <input
                  type="password"
                  value={exitPasscode}
                  onChange={(e) => setExitPasscode(e.target.value)}
                  placeholder="Masukkan Otorisasi PIN Guru/Proktor"
                  className="w-full p-2.5 bg-slate-900 border border-slate-800 rounded-xl text-center text-xs text-white tracking-widest font-extrabold focus:outline-emerald-500"
                  autoFocus
                />

                <button
                  type="submit"
                  className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs uppercase rounded-xl transition cursor-pointer"
                >
                  Pulihkan & Kunci Kembali Layar 🔑
                </button>
              </form>
            </div>
            
            <p className="text-[8px] text-slate-500 uppercase tracking-widest font-mono">CBT SHIELD • MTs. Al-Ma'sum II Cimuncang</p>
          </div>
        </div>
      )}

      {/* 
        ========================================
        MOCK ANDROID TELEPHONE CASING CONTAINER (Hides casing in standalone)
        ========================================
      */}
      <div className={
        standalone
          ? "w-full min-h-screen relative shrink-0"
          : "w-full max-w-[380px] bg-amber-950/5 relative p-4 rounded-[42px] border-4 border-slate-800 shadow-2xl bg-gradient-to-b from-slate-900 to-slate-950 shrink-0"
      }>
        
        {/* Dynamic Mobile Notch / Camera cutout */}
        {!standalone && (
          <div className="absolute top-6 left-1/2 -translate-x-1/2 w-32 h-6 bg-slate-800 rounded-full z-50 flex items-center justify-center gap-1.5 shadow-inner">
            <span className="w-2.5 h-2.5 rounded-full bg-slate-950 border border-slate-900 shadow-inner"></span>
            <span className="w-8 h-1 bg-slate-950 rounded-full"></span>
          </div>
        )}

        {/* Volume & Power Button Indicators */}
        {!standalone && (
          <>
            <div className="absolute -left-1.5 top-28 w-1 h-12 bg-slate-800 rounded-l"></div>
            <div className="absolute -left-1.5 top-44 w-1 h-12 bg-slate-800 rounded-l"></div>
            <button 
              onClick={() => setIsPowerOn(!isPowerOn)}
              className="absolute -right-1.5 top-32 w-1 h-16 bg-red-650 rounded-r border-y border-red-500 cursor-pointer active:scale-95"
              title="Tombol Power Android"
            ></button>
          </>
        )}

        {/* 
          ========================================
          ACTUAL MOBILE ACTIVE SCREEN CANVAS (350x640 ratio approximation)
          ========================================
        */}
        <div className={
          standalone
            ? "w-full min-h-screen bg-slate-900 overflow-hidden relative flex flex-col justify-between text-slate-800 shadow-sm"
            : "w-full min-h-[640px] max-h-[640px] bg-slate-900 rounded-[30px] overflow-hidden relative flex flex-col justify-between text-slate-800 shadow-sm border border-slate-800"
        }>
          
          {/* LCD Turned off screen cover */}
          {!isPowerOn && !standalone && (
            <div className="absolute inset-0 bg-black z-50 flex flex-col items-center justify-center text-center p-6 text-slate-500">
              <Smartphone size={50} className="text-slate-800 animate-pulse pb-2" />
              <h4 className="text-xs font-bold uppercase tracking-widest">Simulator Mati</h4>
              <p className="text-[10px] text-slate-600 mt-1">Tekan tombol power merah di kanan casing untuk menyalakan piranti CBT</p>
            </div>
          )}

          {/* 
            ========================================
            MOBILE OPERATIONAL SYSTEM HUD
            ========================================
          */}
          <div className="relative z-40 w-full h-8 px-4 pt-1 bg-slate-900/90 text-white flex justify-between items-center text-[11px] font-mono select-none" id="android-status-bar">
            {/* Left side: Clock */}
            <div className="flex items-center gap-1 font-extrabold text-blue-200">
              <Clock size={11} />
              <span>{currentTimeStr.slice(0, 5)}</span>
            </div>

            {/* Center Status Indicators */}
            <div className="text-[9px] font-black text-slate-400 bg-slate-800 px-2 py-0.5 rounded-full scale-95 border border-slate-700/50">
              {screen === "exam" ? "🔒 CBT LOCKED" : "CBT MTs. Al-Ma'sum II Cmc"}
            </div>

            {/* Right side: Signal, wifi, battery indicators */}
            <div className="flex items-center gap-1.5">
              <div className="flex items-center gap-1 text-emerald-400">
                <Signal size={12} className={signalStrength === 1 ? "text-rose-500" : signalStrength === 2 ? "text-amber-500" : "text-emerald-400"} />
                <span className="text-[9.5px] font-black text-slate-300">
                  {signalStrength === 4 ? "4G LTE" : signalStrength === 3 ? "3G" : signalStrength === 2 ? "HSDPA" : "No Service"}
                </span>
              </div>
              <Wifi size={12} className="text-blue-300" />
              <div className="flex items-center gap-0.5">
                <span className="text-[9px] font-bold text-slate-400">{batteryLevel}%</span>
                <Battery size={13} className={`${batteryCharging ? "text-emerald-400" : "text-slate-300"} rotate-0 shrink-0`} />
              </div>

              {/* Secure App Exit Button on students operational bar */}
              {standalone && (
                <button
                  type="button"
                  onClick={() => {
                    setShowExitModal(true);
                    setExitPasscode("");
                    setExitError(false);
                  }}
                  className="px-2 py-0.5 bg-rose-650 hover:bg-rose-700 text-white font-extrabold text-[9px] uppercase rounded-md tracking-wider flex items-center gap-1 cursor-pointer transition active:scale-95 border border-rose-500/30 shadow-sm ml-1"
                >
                  <LogOut size={9} />
                  <span>Keluar</span>
                </button>
              )}
            </div>
          </div>

          {/* 
            ========================================
            MAIN CBT WORK APPLICATION DISPLAY
            ========================================
          */}
          <div className="flex-1 bg-sky-50 flex flex-col overflow-y-auto no-scrollbar relative pt-1" id="android-app-container">
            
            {/* 1. STUDENT LOGIN SCREEN */}
            {screen === "login" && (
              <div className="flex-1 p-5 flex flex-col justify-between text-left relative overflow-hidden bg-gradient-to-b from-sky-500/10 via-sky-50 to-white">
                
                <div className="space-y-4 pt-4">
                  {/* Branding Header inside Phone */}
                  <div className="text-center space-y-1">
                    <img 
                      src="/assets/aistudio/MTS_AL-MA_SUM_II_7c7dea1b.png" 
                      alt="Logo MTs. Al-Ma'sum II Cimuncang" 
                      className="w-14 h-14 object-contain mx-auto drop-shadow-md animate-bounce" 
                      referrerPolicy="no-referrer"
                    />
                    <h2 className="font-display font-extrabold text-slate-800 text-[13px] tracking-tight uppercase leading-snug">
                      CBT MTs. Al-Ma'sum II Cmc
                    </h2>
                    <h3 className="text-[10px] text-[#0666AE] font-black tracking-widest uppercase">
                      MTs. AL-MA'SUM II CIMUNCANG
                    </h3>
                    <div className="h-0.5 bg-sky-200 w-16 mx-auto rounded"></div>
                  </div>

                  {/* Login Form */}
                  <form onSubmit={handleLogin} className="space-y-3 bg-white p-4 rounded-2xl border border-sky-100 shadow-sm">
                    <span className="inline-block px-2 py-0.5 text-[8px] bg-sky-100 text-sky-800 rounded font-black uppercase">
                      Autentikasi Siswa
                    </span>

                    {loginError && (
                      <div className="p-2 bg-rose-50 border border-rose-100 text-rose-700 text-[9px] font-semibold rounded-lg leading-relaxed flex gap-1 items-start">
                        <AlertCircle size={12} className="shrink-0 mt-0.5" />
                        <span>{loginError}</span>
                      </div>
                    )}

                    <div className="space-y-1">
                      <label className="text-[9px] text-slate-400 font-extrabold uppercase">Username / ID Peserta</label>
                      <input 
                        type="text"
                        value={usernameInput}
                        onChange={(e) => setUsernameInput(e.target.value)}
                        placeholder="Contoh: siswa1"
                        className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold focus:bg-white focus:outline-sky-500"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[9px] text-slate-400 font-extrabold uppercase">Password</label>
                      <input 
                        type="password"
                        value={passwordInput}
                        onChange={(e) => setPasswordInput(e.target.value)}
                        placeholder="••••••••"
                        className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:bg-white focus:outline-sky-500"
                      />
                    </div>

                    <div className="pt-1 space-y-2">
                      <button
                        type="submit"
                        className="w-full p-2.5 bg-[#0666AE] hover:bg-[#0666AE]/95 text-white font-extrabold text-xs uppercase rounded-xl transition cursor-pointer flex items-center justify-center gap-1.5 shadow-sm active:scale-95"
                      >
                        <KeyRound size={13} />
                        <span>Masuk CBT</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setShowQRScanner(true)}
                        className="w-full p-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold text-[10px] uppercase rounded-xl transition cursor-pointer flex items-center justify-center gap-1.5 border border-emerald-100"
                      >
                        <ScanLine size={13} className="text-emerald-600 animate-pulse" />
                        <span>Scan Kartu Ujian QR</span>
                      </button>
                    </div>
                  </form>
                </div>

                {/* Simulated Device ID Footer inside app */}
                <div className="text-center text-[9px] text-slate-400 font-mono select-none">
                  <p>CBT MTs. Al-Ma'sum II Cmc v1.0</p>
                  <p className="text-slate-350">UUID: MTS-CMC-{Math.floor(1000 + Math.random() * 9000)}</p>
                </div>

                {/* Simulated scan barcode modal */}
                <AnimatePresence>
                  {showQRScanner && (
                    <motion.div 
                      initial={{ opacity: 0 }} 
                      animate={{ opacity: 1 }} 
                      exit={{ opacity: 0 }}
                      className="absolute inset-0 bg-slate-950/98 z-50 p-4 pt-6 flex flex-col justify-between text-white overflow-y-auto"
                    >
                      <div className="space-y-1 text-center">
                        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px] font-black uppercase tracking-wider">
                          <Camera size={12} className="animate-pulse" />
                          <span>Pindai Kartu Ujian Siswa</span>
                        </div>
                        <p className="text-[9px] text-slate-400 leading-normal font-medium max-w-[280px] mx-auto pt-1">
                          Arahkan kamera ke Kode QR di kartu ujian Anda, atau unggah foto/gambar kartu QR.
                        </p>
                      </div>

                      {/* WebRTC Video Stream feed with target sights */}
                      <div className="w-52 h-52 sm:w-56 sm:h-56 border-4 border-emerald-500 rounded-3xl mx-auto flex items-center justify-center relative overflow-hidden bg-slate-900 shadow-[0_0_25px_rgba(16,185,129,0.35)] shrink-0 my-2">
                        {cameraError ? (
                          <div className="p-4 text-[9.5px] text-rose-300 text-center font-bold space-y-2">
                            <AlertCircle size={24} className="mx-auto text-rose-400" />
                            <p className="leading-relaxed">{cameraError}</p>
                          </div>
                        ) : (
                          <video 
                            ref={videoRef}
                            className="w-full h-full object-cover"
                            autoPlay
                            playsInline
                            muted
                          />
                        )}
                        <canvas ref={canvasRef} className="hidden" />
                        
                        {/* Animated overlay scanner lines */}
                        {!cameraError && (
                          <>
                            <div className="absolute inset-x-0 h-0.5 bg-emerald-400 opacity-90 shadow-[0_0_10px_rgba(52,211,153,0.9)] animate-[bounce_2s_infinite]"></div>
                            <div className="absolute inset-4 border border-dashed border-emerald-400/50 rounded-2xl pointer-events-none"></div>
                          </>
                        )}
                      </div>

                      {/* Alternate Options: File Upload and Manual Tester Selection */}
                      <div className="w-full space-y-2 shrink-0">
                        {/* File Upload Fallback / Take Photo */}
                        <label className="w-full py-2.5 px-3 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold text-[10.5px] rounded-xl flex items-center justify-center gap-2 cursor-pointer transition shadow-md border border-emerald-400/30">
                          <Upload size={14} />
                          <span>Ambil / Unggah Foto Kartu QR</span>
                          <input 
                            type="file" 
                            accept="image/*" 
                            capture="environment" 
                            onChange={handleQRImageUpload} 
                            className="hidden" 
                          />
                        </label>

                        {/* Hidden optional fallback for simulators on desktop with no webcam */}
                        <div className="text-center pt-0.5">
                          <button
                            type="button"
                            onClick={() => setShowManualSelection(prev => !prev)}
                            className="text-[9px] text-slate-400 hover:text-slate-200 underline uppercase font-bold cursor-pointer transition"
                          >
                            {showManualSelection ? "Sembunyikan Pilihan Manual" : "Pilihan Manual Siswa (Tester/Bypass)"}
                          </button>
                        </div>

                        {showManualSelection && (
                          <div className="space-y-1 w-full bg-slate-900 border border-slate-800 p-2 rounded-xl">
                            <p className="text-[8px] text-slate-400 font-extrabold uppercase tracking-widest text-center">Pilih Siswa Langsung:</p>
                            <div className="max-h-[110px] overflow-y-auto space-y-1 no-scrollbar">
                              {dbState.siswa.map((siswa) => (
                                <button
                                  key={siswa.id}
                                  type="button"
                                  onClick={() => handleQRScannerBypass(siswa)}
                                  className="w-full p-1.5 bg-slate-800 hover:bg-emerald-950 hover:border-emerald-700/80 text-left rounded-lg text-[9px] flex justify-between items-center transition border border-transparent cursor-pointer"
                                >
                                  <div>
                                    <p className="font-extrabold text-slate-200">{siswa.nama}</p>
                                    <p className="text-[8px] text-slate-400 font-mono">{siswa.kelas} • NISN: {siswa.nisn}</p>
                                  </div>
                                  <span className="text-[8px] text-emerald-400 font-bold font-mono">MASUK</span>
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => setShowQRScanner(false)}
                        className="py-2 px-5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-[10px] font-black rounded-xl uppercase mx-auto cursor-pointer transition mt-2 active:scale-95 border border-slate-700 shrink-0"
                      >
                        Tutup / Kembali
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}

            {/* 2. SELECT EXAM / MAPEL SCHEDULE VIEW */}
            {screen === "select-exam" && loggedInStudent && (
              <div className="p-4 flex-1 flex flex-col justify-between text-left space-y-4 bg-sky-50">
                <div className="space-y-4">
                  {/* Account detail banner */}
                  <div className="p-3 bg-gradient-to-r from-[#0666AE]/10 to-[#0666AE]/20 border border-sky-100 rounded-xl space-y-1">
                     <span className="px-1.5 py-0.5 text-[8px] bg-[#0666AE] text-white rounded uppercase font-black">LOGIN ACTIVE</span>
                     <h3 className="font-extrabold text-slate-800 text-xs truncate leading-normal">{loggedInStudent.nama}</h3>
                     <div className="flex justify-between items-center text-[9px] text-[#0666AE] font-bold">
                       <span>NISN: {loggedInStudent.nisn}</span>
                       <span>{loggedInStudent.kelas}</span>
                     </div>
                  </div>

                  {/* Session Reset Notice Banner */}
                  {sessionResetNotice && (
                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-[9.5px] text-amber-800 font-bold leading-relaxed flex items-start gap-2 shadow-sm">
                      <AlertCircle size={14} className="shrink-0 text-amber-600 mt-0.5" />
                      <div className="flex-1">
                        <p>{sessionResetNotice}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setSessionResetNotice(null)}
                        className="text-amber-600 hover:text-amber-800 font-black px-1 cursor-pointer"
                      >
                        ✕
                      </button>
                    </div>
                  )}

                  <div className="space-y-2">
                    <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                      Daftar Jadwal Ujian Aktif:
                    </h4>

                    {/* Filter schedules that apply either directly to student's class, or show items */}
                    {(() => {
                      const todaySchedules = dbState.jadwal.filter((jadwal) => {
                        const targetKelas = loggedInStudent.kelas; // e.g. "XII IPA"
                        const targetKelasId = loggedInStudent.kelasId; // e.g. "k1"
                        
                        const targetKelasClean = targetKelas ? targetKelas.trim().toLowerCase() : "";
                        const targetAlias = canonicalClassAlias(targetKelas || "");
                        const isClassMatch =
                          !jadwal.kelasIds ||
                          jadwal.kelasIds.length === 0 ||
                          jadwal.kelasIds.some((schedK) => {
                            const cleanK = schedK.trim().toLowerCase();
                            const aliasK = canonicalClassAlias(schedK);
                            return (
                              cleanK === targetKelasClean ||
                              schedK === targetKelasId ||
                              (aliasK && targetAlias && (
                                aliasK === targetAlias ||
                                targetAlias.startsWith(aliasK + "-") ||
                                targetAlias.startsWith(aliasK + " ") ||
                                aliasK.startsWith(targetAlias + "-") ||
                                aliasK.startsWith(targetAlias + " ")
                              ))
                            );
                          });

                        if (!isClassMatch) return false;

                        // Check date match supporting school timezone (WIB), device local, and UTC
                        const isDateMatch = 
                          jadwal.tanggal === currentDateStrYMD || 
                          jadwal.tanggal === currentDateStrYMD_School || 
                          jadwal.tanggal === currentDateStrYMD_UTC;
                        return isDateMatch;
                      });

                      if (todaySchedules.length === 0) {
                        return (
                          <div className="p-4 bg-white border border-slate-200 rounded-2xl text-center space-y-3.5 shadow-sm">
                            <div className="mx-auto w-10 h-10 rounded-full bg-amber-50 text-amber-700 flex items-center justify-center border border-amber-100">
                              <AlertCircle size={20} className="animate-pulse" />
                            </div>
                            <div className="space-y-1">
                              <h5 className="text-[11px] font-black text-slate-850 uppercase">Tidak Ada Ujian Hari Ini</h5>
                              <p className="text-[9.2px] text-slate-500 leading-relaxed max-w-[240px] mx-auto">
                                Jadwal ujian untuk kelas <strong>{loggedInStudent.kelas}</strong> tidak ditemukan pada hari ini (<strong>{currentDateStrYMD_School}</strong>). Hubungi Proktor / GURU Anda.
                              </p>
                            </div>
                          </div>
                        );
                      }

                      return (
                        <div className="space-y-2.5 max-h-[300px] overflow-y-auto no-scrollbar">
                          {todaySchedules.map((jadwal) => {
                            const mapel = getDB.mapel().find(m => m.id === jadwal.mapelId);
                            const mapelName = mapel ? mapel.nama : "Ujian";

                            // On exam date: from scheduled jamMulai onwards, it is active!
                            // Only marked 'Belum Mulai' if the current clock is strictly earlier than jamMulai
                            const isBeforeStart = Boolean(
                              jadwal.jamMulai && 
                              jadwal.jamMulai !== "00:00" && 
                              currentTimeStrHM_School < jadwal.jamMulai && 
                              currentTimeStrHM < jadwal.jamMulai
                            );

                            const isTimeActive = !isBeforeStart;

                            const liveSession = dbState.sessions.find(
                              (s) =>
                                s.id === loggedInStudent.nisn &&
                                (s.mapelId === jadwal.mapelId ||
                                  (s.mapelNama || "").trim().toLowerCase() === mapelName.trim().toLowerCase())
                            );
                            const existingHasil = dbState.hasil.find(
                              (h: any) =>
                                (h.siswaNisn === loggedInStudent.nisn ||
                                  (h.siswaNama || "").trim().toLowerCase() === loggedInStudent.nama.trim().toLowerCase()) &&
                                (h.mapelId === jadwal.mapelId ||
                                  (h.mapelNama || "").trim().toLowerCase() === mapelName.trim().toLowerCase())
                            );

                            const isSessionBlocked = liveSession?.status === "Diskualifikasi";
                            const isSessionCompleted = liveSession?.status === "Selesai" || Boolean(existingHasil);

                            let statusBadge = null;
                            let cardClass = "p-3 bg-white border border-slate-200 rounded-xl space-y-2 transition-all shadow-sm";
                            let btnText = "Mulai Tes";
                            let btnClass = "p-1.5 px-3 bg-[#0666AE] hover:bg-[#0666AE]/90 text-white font-extrabold rounded-lg text-[9px] uppercase transition cursor-pointer hover:shadow-sm";
                            let isClickable = true;

                            if (isSessionCompleted) {
                              statusBadge = (
                                <span className="px-1.5 py-0.5 text-[8px] font-black bg-emerald-50 text-emerald-700 rounded border border-emerald-200 uppercase flex items-center gap-1">
                                  <CheckCircle size={9} />
                                  Sudah Selesai
                                </span>
                              );
                              cardClass = "p-3 bg-emerald-50/40 border border-emerald-200 rounded-xl space-y-2 transition-all shadow-sm";
                              btnText = "Selesai";
                              btnClass = "p-1.5 px-3 bg-emerald-100 text-emerald-800 font-extrabold rounded-lg text-[9px] uppercase cursor-not-allowed";
                              isClickable = false;
                            } else if (isSessionBlocked) {
                              statusBadge = (
                                <span className="px-1.5 py-0.5 text-[8px] font-black bg-rose-50 text-rose-700 rounded border border-rose-200 uppercase flex items-center gap-1">
                                  Diblokir Pengawas
                                </span>
                              );
                              cardClass = "p-3 bg-rose-50/40 border border-rose-200 rounded-xl space-y-2 transition-all shadow-sm";
                              btnText = "Status Blokir";
                              btnClass = "p-1.5 px-3 bg-rose-600 hover:bg-rose-700 text-white font-extrabold rounded-lg text-[9px] uppercase cursor-pointer";
                              isClickable = true;
                            } else if (isTimeActive) {
                              statusBadge = (
                                <span className="px-1.5 py-0.5 text-[8px] font-black bg-emerald-50 text-emerald-700 rounded border border-emerald-100 uppercase animate-pulse flex items-center gap-1">
                                  <span className="w-1 h-1 rounded-full bg-emerald-500"></span>
                                  Sesi Aktif
                                </span>
                              );
                              cardClass += " hover:border-[#0666AE]/50 ring-1 ring-emerald-100";
                              btnText = liveSession?.status === "Mengerjakan" ? "Ulang / Lanjut" : "Mulai Tes";
                              btnClass = "p-1.5 px-3 bg-[#0666AE] hover:bg-[#0666AE]/90 text-white font-extrabold rounded-lg text-[9px] uppercase transition cursor-pointer hover:shadow-sm";
                              isClickable = true;
                            } else {
                              statusBadge = (
                                <span className="px-1.5 py-0.5 text-[8px] font-black bg-amber-50 text-amber-700 rounded border border-amber-100 uppercase flex items-center gap-1">
                                  <span className="w-1 h-1 rounded-full bg-amber-500"></span>
                                  Belum Mulai ({jadwal.jamMulai} WIB)
                                </span>
                              );
                              btnText = "Belum Mulai";
                              btnClass = "p-1.5 px-3 bg-slate-100 text-slate-400 font-bold rounded-lg text-[9px] uppercase cursor-not-allowed";
                              isClickable = false;
                            }

                            const handleActionClick = () => {
                              if (isSessionCompleted) return;
                              if (isSessionBlocked) {
                                activeSessionCreatedRef.current = true;
                                setSelectedJadwal(jadwal);
                                setScreen("blocked");
                                return;
                              }
                              if (!isClickable) {
                                return;
                              }
                              setSessionResetNotice(null);
                              startExamProcess(jadwal);
                            };

                            return (
                              <div key={jadwal.id} className={cardClass}>
                                <div className="flex justify-between items-start gap-1">
                                  <div>
                                    <h5 className="font-extrabold text-slate-800 text-xs truncate leading-snug">{mapelName}</h5>
                                    <div className="flex items-center gap-1.5 mt-0.5">
                                      <p className="text-[8px] text-[#0666AE] font-black tracking-wider uppercase">{mapel?.kode || "Master"}</p>
                                      {statusBadge}
                                    </div>
                                  </div>
                                  <span className="px-1.5 py-0.5 text-[8.5px] font-black bg-sky-50 text-[#0666AE] rounded border border-sky-100 uppercase shrink-0">
                                    {jadwal.durasiMenit} Mnt
                                  </span>
                                </div>

                                <div className="flex justify-between items-center border-t border-slate-50 pt-1.5">
                                  <div className="text-[8.5px] text-slate-500 font-mono flex items-center gap-1">
                                    <span>🕒 {jadwal.jamMulai} - {jadwal.jamSelesai}</span>
                                  </div>
                                  
                                  <button
                                    onClick={handleActionClick}
                                    className={btnClass}
                                  >
                                    {btnText}
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      );
                    })()}
                  </div>
                </div>

                <div className="space-y-2 font-black">
                  <button
                    onClick={handleSimpleLogout}
                    className="w-full p-2 bg-rose-50 border border-rose-200 text-rose-700 text-[10px] uppercase rounded-xl transition cursor-pointer flex items-center justify-center gap-1"
                  >
                    <LogOut size={12} />
                    <span>Keluar Aplikasi</span>
                  </button>
                </div>
              </div>
            )}

            {/* 3. TOKEN SUBMISSION CARD SCREEN */}
            {screen === "token-entry" && selectedJadwal && loggedInStudent && (
              <div className="p-4 flex-1 flex flex-col justify-between text-left space-y-4 bg-sky-50">
                <div className="space-y-4">
                  <div className="flex items-center gap-1.5 text-[#0666AE]">
                    <button 
                      onClick={() => setScreen("select-exam")} 
                      className="p-1 bg-white hover:bg-slate-100 rounded-lg cursor-pointer transition border border-slate-200 shadow-sm"
                    >
                      <ChevronLeft size={16} />
                    </button>
                    <span className="text-[10px] font-black uppercase text-slate-500">Konfirmasi Lembar Tes</span>
                  </div>

                  <div className="bg-white p-4 rounded-2xl border border-sky-100 space-y-3 shadow-sm">
                    <div className="space-y-1">
                      <p className="text-[8px] text-slate-400 font-black uppercase">Nama Mata Pelajaran</p>
                      <h4 className="text-xs font-extrabold text-slate-800">
                        {getDB.mapel().find(m => m.id === selectedJadwal.mapelId)?.nama || "Ujian Utama"}
                      </h4>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-[10px] border-t border-slate-50 pt-2 font-medium text-slate-600">
                      <div>
                        <p className="text-[8px] text-slate-400 font-bold uppercase">Durasi Pengerjaan</p>
                        <p className="font-extrabold text-slate-800">{selectedJadwal.durasiMenit} Menit</p>
                      </div>
                      <div>
                        <p className="text-[8px] text-slate-400 font-bold uppercase">Peserta</p>
                        <p className="font-extrabold text-slate-800 truncate">{loggedInStudent.nama}</p>
                      </div>
                    </div>

                    {tokenError && (
                      <div className="p-2 bg-rose-50 border border-rose-100 text-rose-700 text-[9px] font-semibold rounded-lg leading-relaxed flex gap-1 items-start">
                        <AlertCircle size={14} className="shrink-0 text-rose-600" />
                        <span>{tokenError}</span>
                      </div>
                    )}

                    <div className="space-y-1 pt-1.5 border-t border-slate-150">
                      <label className="text-[9px] text-[#0666AE] font-black uppercase tracking-wider block">
                        🎫 Token Rilis Pengawas
                      </label>
                      <input 
                        type="text"
                        value={tokenInput}
                        onChange={(e) => setTokenInput(e.target.value)}
                        placeholder="Masukkan 6 Digit Token"
                        maxLength={6}
                        className="w-full p-2.5 bg-slate-50 border-2 border-dashed border-slate-300 rounded-xl text-center text-xs font-mono font-black tracking-widest focus:bg-white focus:outline-[#0666AE] uppercase"
                      />
                      <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 mt-1.5 space-y-1 text-amber-800 text-left">
                        <p className="text-[9px] font-black uppercase text-amber-900 flex items-center gap-1">
                          <span>📢</span> Minta Token Pengawas
                        </p>
                        <p className="text-[8px] leading-normal font-bold">
                          Harap tanyakan kepada pengawas ruangan Anda di papan tulis atau secara langsung untuk mendapatkan Token ujian yang aktif.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleVerifyToken}
                  className="w-full p-3 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs uppercase rounded-xl transition cursor-pointer flex items-center justify-center gap-1 shadow"
                >
                  <BookOpen size={13} />
                  <span>Mulai Mengerjakan</span>
                </button>
              </div>
            )}

            {/* 4. CBT ACTIVE EXAM BOARD */}
            {screen === "exam" && loggedInStudent && selectedJadwal && questions.length > 0 && (
              <div className="flex-1 flex flex-col justify-between text-left relative bg-white" id="anbk-exam-layout">
                
                {/* Real-time exam status header inside phone screen */}
                <div className="p-2.5 bg-gradient-to-r from-blue-950 to-slate-900 text-white flex justify-between items-center text-[9px] font-mono select-none shrink-0 border-b border-blue-900 shadow-sm relative z-30">
                  <div className="truncate pr-2 select-none">
                    <p className="font-bold text-slate-300 text-[8px] uppercase tracking-wide">MATA PELAJARAN</p>
                    <p className="font-extrabold text-blue-200 truncate">{getDB.mapel().find(m => m.id === selectedJadwal.mapelId)?.nama || "Ujian"}</p>
                  </div>
                  
                  {/* Realtime Countdown Ticker */}
                  <div className="text-right shrink-0">
                    <p className="font-bold text-slate-300 text-[7px] uppercase select-none">SISA WAKTU</p>
                    <span className="p-1 px-2 rounded bg-rose-950 font-black text-rose-300 tracking-wider">
                      {formatTimer(secondsRemaining)}
                    </span>
                  </div>
                </div>

                {/* Font-Size Adjustment ANBK Toolbar */}
                <div className="flex justify-between items-center px-3 py-1.5 bg-slate-50 border-b border-slate-150 text-[10px] select-none shrink-0">
                  <div className="flex flex-col text-left">
                    <span className="font-bold text-slate-705 text-slate-750 font-sans">Soal {currentIndex + 1} dari {questions.length}</span>
                    <span className="text-[8px] font-black text-[#0666AE] tracking-wide uppercase mt-0.5">{Object.keys(studentAnswers).length} dari {questions.length} Terjawab</span>
                  </div>
                  <div className="flex items-center gap-1 font-mono">
                    <span className="text-slate-400 mr-1 text-[8px] font-extrabold">UKURAN FONT:</span>
                    <button 
                      onClick={() => setFontSizeClass("text-sm")} 
                      className={`px-1.5 py-0.5 rounded border text-[9px] font-bold ${fontSizeClass === "text-sm" ? "bg-slate-800 text-white border-slate-800" : "bg-white text-slate-700 border-slate-300"}`}
                    >
                      A-
                    </button>
                    <button 
                      onClick={() => setFontSizeClass("text-base")} 
                      className={`px-1.5 py-0.5 rounded border text-[9px] font-bold ${fontSizeClass === "text-base" ? "bg-slate-800 text-white border-slate-800" : "bg-white text-slate-700 border-slate-300"}`}
                    >
                      A
                    </button>
                    <button 
                      onClick={() => setFontSizeClass("text-lg")} 
                      className={`px-1.5 py-0.5 rounded border text-[9px] font-bold ${fontSizeClass === "text-lg" ? "bg-slate-800 text-white border-slate-800" : "bg-white text-slate-700 border-slate-300"}`}
                    >
                      A+
                    </button>
                  </div>
                </div>

                {/* Visual Progress Bar row representing answered weight */}
                <div className="w-full bg-slate-200 h-1 shrink-0 relative overflow-hidden" id="exam-progress-bar-row">
                  <div 
                    className="bg-emerald-500 h-full transition-all duration-350 ease-out shadow-[0_0_8px_rgba(16,185,129,0.4)]" 
                    style={{ width: `${(Object.keys(studentAnswers).length / questions.length) * 100}%` }}
                  ></div>
                </div>

                {/* 
                  ========================================
                  BUTIR DETAIL CONTENT SCROLL CONTAINER
                  ========================================
                */}
                <div className="flex-1 p-3 overflow-y-auto space-y-3 relative no-scrollbar" id="butir-konten-container">
                  {/* Floating Notification Indicator */}
                  <div className="p-2 py-1.5 bg-[#0666AE]/5 rounded-lg border border-[#0666AE]/20 font-sans text-[8px] font-bold text-[#0666AE] flex justify-between items-center mb-1">
                    <span>STATUS PERANGKAT: AMAN (CBT SHIELD ACTIVE)</span>
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  </div>

                  {/* Question Image if uploaded */}
                  {questions[currentIndex].gambarUrl && (
                    <div className="w-full p-1.5 bg-slate-50 border border-slate-150 rounded-xl max-h-[200px] overflow-hidden flex items-center justify-center">
                      <img 
                        src={questions[currentIndex].gambarUrl} 
                        className="max-h-[185px] rounded object-contain" 
                        alt="Soal Lampiran" 
                        referrerPolicy="no-referrer"
                      />
                    </div>
                  )}

                  {/* Question Text with Math & Arabic RTL support */}
                  <div className="text-slate-800 font-semibold leading-relaxed tracking-wide px-0.5" id="exam-teks-body">
                    <div className={`${fontSizeClass === "text-sm" ? "text-xs" : fontSizeClass === "text-base" ? "text-sm" : "text-base"}`}>
                      <RichMathText text={questions[currentIndex].teks} />
                    </div>
                  </div>

                  {/* Multiple Choice Options List (Text + Math + Arabic RTL + Option Images) */}
                  <div className="space-y-2 pt-2" id="exam-opsi-list">
                    {(["A", "B", "C", "D", "E"] as const).map((key) => {
                      const optText = (questions[currentIndex].opsi[key] || "").trim();
                      const optImg = questions[currentIndex].opsiGambar?.[key];
                      if (!optText && !optImg) return null;

                      const isSelected = studentAnswers[currentIndex] === key;
                      const optArabic = hasArabicText(optText);

                      return (
                        <button
                          key={key}
                          type="button"
                          onClick={() => handleSelectAnswer(key)}
                          className={`w-full p-2.5 text-left border rounded-xl font-sans transition-all text-xs flex items-start gap-2.5 cursor-pointer hover:shadow-xs ${
                            isSelected 
                              ? "bg-gradient-to-r from-blue-50 to-sky-50/70 border-[#0666AE] text-slate-800 ring-1 ring-[#0666AE]" 
                              : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50/50"
                          }`}
                        >
                          <span className={`w-5 h-5 rounded-lg text-[10px] font-black uppercase shrink-0 flex items-center justify-center border transition-all ${
                            isSelected 
                              ? "bg-[#0666AE] text-white border-[#0666AE] shadow-inner" 
                              : "bg-slate-100 text-slate-650 border-slate-300"
                          }`}>
                            {key}
                          </span>
                          <div className={`flex-1 min-w-0 space-y-1.5 ${optArabic ? "text-right" : "text-left"}`}>
                            {optImg && (
                              <div className="bg-slate-50 p-1.5 rounded-lg border border-slate-200/80 inline-block max-w-full">
                                <img
                                  src={optImg}
                                  alt={`Opsi ${key}`}
                                  className="max-h-32 max-w-full rounded object-contain"
                                  referrerPolicy="no-referrer"
                                />
                              </div>
                            )}
                            {optText && (
                              <div className="font-semibold pt-0.5 leading-snug">
                                <RichMathText text={optText} />
                              </div>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 
                  ========================================
                  EXAM INTERACTION FOOTER BAR (Prev, Ragu, Next)
                  ========================================
                */}
                <div className="p-2.5 bg-slate-50 border-t border-slate-150 select-none shrink-0 flex justify-between items-center gap-2 relative z-10 shadow-[0_-2px_6px_rgba(0,0,0,0.03)] pb-3">
                  <button
                    onClick={() => {
                      if (currentIndex > 0) setCurrentIndex(p => p - 1);
                    }}
                    disabled={currentIndex === 0}
                    className="p-2 bg-white hover:bg-slate-100 disabled:opacity-40 text-slate-700 border border-slate-350 font-extrabold text-[10px] rounded-xl flex items-center gap-0.5 cursor-pointer max-w-[80px]"
                  >
                    <ChevronLeft size={14} />
                    <span>SEBELUMNYA</span>
                  </button>

                  <button
                    onClick={handleToggleRaguRagu}
                    className={`p-2 transition text-[10px] rounded-xl font-extrabold border flex items-center justify-center gap-1 select-none grow max-w-[120px] ${
                      raguRaguAnswers[currentIndex]
                        ? "bg-amber-450 hover:bg-amber-500 text-white border-amber-500 shadow-inner"
                        : "bg-yellow-400 hover:bg-yellow-500 text-slate-900 border-yellow-500/80 shadow-xs"
                    }`}
                  >
                    <HelpCircle size={13} className="shrink-0" />
                    <span>{raguRaguAnswers[currentIndex] ? "RAGU CEKED" : "RAGU-RAGU"}</span>
                  </button>

                  {currentIndex < questions.length - 1 ? (
                    <button
                      onClick={() => setCurrentIndex(p => p + 1)}
                      className="p-2 bg-[#0666AE] hover:bg-[#0666AE]/95 text-white border border-[#0666AE] font-extrabold text-[10px] rounded-xl flex items-center gap-0.5 cursor-pointer max-w-[80px]"
                    >
                      <span>BERIKUTNYA</span>
                      <ChevronRight size={14} />
                    </button>
                  ) : (
                    <button
                      onClick={handleSubmitExam}
                      className="p-2 bg-emerald-600 hover:bg-emerald-700 text-white border border-emerald-600 font-extrabold text-[10px] rounded-xl cursor-pointer shadow-sm active:scale-95"
                    >
                      SELESAI
                    </button>
                  )}
                </div>

                {/* 
                  ========================================
                  FLOATING ANBK GRID MANAGER COLLAPSE
                  ========================================
                */}
                <button
                  type="button"
                  onClick={() => setShowNavigationDrawer(true)}
                  className="absolute right-3 bottom-16 bg-slate-900/90 text-white hover:bg-slate-900 p-2.5 rounded-full shadow-lg z-30 flex items-center justify-center ring-4 ring-white/10 select-none cursor-pointer"
                  title="Tampilkan daftar soal"
                >
                  <ListOrdered size={16} />
                </button>

                {/* Sliding navigation drawer for jumping to questions */}
                <AnimatePresence>
                  {showNavigationDrawer && (
                    <motion.div 
                      initial={{ opacity: 0, x: "100%" }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: "100%" }}
                      transition={{ duration: 0.25 }}
                      className="absolute inset-y-0 right-0 w-3/4 max-w-[270px] bg-slate-950/98 text-white z-40 p-4 pt-10 flex flex-col justify-between"
                    >
                      <div className="space-y-4">
                        <div className="flex justify-between items-center border-b border-slate-800 pb-2">
                          <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-widest flex items-center gap-1">
                            <ListOrdered size={13} className="text-[#0666AE]" />
                            Navigasi Soal
                          </h4>
                          <button 
                            onClick={() => setShowNavigationDrawer(false)}
                            className="text-xs font-black text-rose-400 bg-rose-950/20 px-2 py-0.5 rounded cursor-pointer"
                          >
                            TUTUP
                          </button>
                        </div>

                        {/* Grid list numbers */}
                        <div className="grid grid-cols-4 gap-1.5 max-h-[400px] overflow-y-auto no-scrollbar p-0.5">
                          {questions.map((soal, idx) => {
                            const isCurrent = idx === currentIndex;
                            const isAnswered = studentAnswers[idx] !== undefined;
                            const isRagu = raguRaguAnswers[idx] === true;

                            let baseStyle = "border-slate-800 bg-slate-900 text-slate-300";
                            if (isRagu) {
                              baseStyle = "bg-amber-500 text-slate-950 border-amber-600";
                            } else if (isAnswered) {
                              baseStyle = "bg-emerald-600 text-white border-emerald-700";
                            }

                            if (isCurrent) {
                              baseStyle += " ring-2 ring-blue-400 ring-offset-2 ring-offset-slate-950";
                            }

                            return (
                              <button
                                key={soal.id}
                                onClick={() => {
                                  setCurrentIndex(idx);
                                  setShowNavigationDrawer(false);
                                }}
                                className={`h-10 text-center font-mono font-extrabold text-[11px] rounded-lg border leading-tight flex flex-col justify-center items-center transition cursor-pointer relative ${baseStyle}`}
                              >
                                <span>{idx + 1}</span>
                                {isAnswered && (
                                  <span className="text-[8px] font-black -mt-0.5 block opacity-90">{studentAnswers[idx]}</span>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Legend detail */}
                      <div className="space-y-2 border-t border-slate-8 w-full pt-3 font-semibold text-[9px] text-slate-400">
                        <p className="font-extrabold uppercase tracking-wider text-[8px]">Keterangan Status:</p>
                        <div className="grid grid-cols-2 gap-1.5">
                          <div className="flex items-center gap-1">
                            <span className="w-2.5 h-2.5 rounded bg-emerald-650 border border-emerald-700 inline-block"></span>
                            <span>Sudah Diisi</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <span className="w-2.5 h-2.5 rounded bg-amber-500 border border-amber-600 inline-block"></span>
                            <span>Ragu-Ragu</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <span className="w-2.5 h-2.5 rounded bg-slate-900 border border-slate-800 inline-block"></span>
                            <span>Belum Diisi</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <span className="w-2.5 h-2.5 rounded ring-2 ring-blue-400 inline-block bg-transparent"></span>
                            <span>Aktif</span>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Ongoing Exam Cheat Alert Warning Modal popup */}
                <AnimatePresence>
                  {showCheatWarning && (
                    <motion.div 
                      initial={{ opacity: 0 }} 
                      animate={{ opacity: 1 }} 
                      exit={{ opacity: 0 }}
                      className="absolute inset-0 bg-slate-950/95 z-50 p-6 flex flex-col justify-center items-center text-center space-y-4 text-white"
                    >
                      <div className="w-16 h-16 rounded-full bg-rose-950 border border-rose-500/50 flex items-center justify-center text-rose-500 animate-pulse">
                        <AlertCircle size={38} className="animate-bounce" />
                      </div>
                      
                      <div className="space-y-2">
                        <h4 className="text-sm font-black uppercase text-rose-500 tracking-widest">ALARM DETEKSI CURANG!</h4>
                        <p className="text-[10px] text-slate-350 leading-relaxed font-semibold max-w-sm">
                          Sistem mendeteksi Anda mematikan layar, meninggalkan browser, atau membuka aplikasi lain! Aktivitas ini telah didokumentasikan dan dikirim langsung ke server monitoring pengawas ruang.
                        </p>
                      </div>

                      {/* Display remaining warning tries */}
                      {loggedInStudent && (
                        <div className="p-3 bg-slate-900 border border-slate-850 rounded-xl">
                          <p className="text-[10px] text-slate-400">Pelanggaran Terkumpul Sistem:</p>
                          <p className="font-mono font-black text-rose-600 text-sm mt-0.5">
                            {dbState.sessions.find(s => s.id === loggedInStudent.nisn)?.pelanggaranCount || 0} / {dbState.konfig.batasPelanggaran || 3} KALI
                          </p>
                        </div>
                      )}

                      <button
                        type="button"
                        onClick={() => setShowCheatWarning(false)}
                        className="p-2.5 px-6 bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-xs uppercase rounded-xl transition cursor-pointer"
                      >
                        Saya Mengerti, Kembali Ujian
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Custom Submit Confirmation Modal popup */}
                <AnimatePresence>
                  {showSubmitConfirmModal && (
                    <motion.div 
                      initial={{ opacity: 0, scale: 0.95 }} 
                      animate={{ opacity: 1, scale: 1 }} 
                      exit={{ opacity: 0, scale: 0.95 }}
                      className="absolute inset-0 bg-slate-950/98 z-50 p-5 flex flex-col justify-between text-white"
                    >
                      <div className="space-y-4 pt-4 flex-1 flex flex-col justify-center">
                        <div className="w-14 h-14 rounded-full bg-emerald-950 text-emerald-450 border border-emerald-500/30 flex items-center justify-center mx-auto text-emerald-400 shadow-lg shadow-emerald-500/10">
                          <CheckCircle size={30} className="animate-bounce" />
                        </div>
                        
                        <div className="space-y-1 text-center">
                          <h4 className="text-xs font-black uppercase text-emerald-400 tracking-wider">Konfirmasi Selesai Ujian</h4>
                          <p className="text-[9.5px] text-slate-300 leading-normal font-semibold max-w-xs mx-auto">
                            Sebelum menyelesaikan ujian, pastikan Anda telah meninjau seluruh jawaban Anda dengan teliti.
                          </p>
                        </div>

                        {/* Statistik pengerjaan */}
                        {(() => {
                          const totalAnswered = questions.filter((_, i) => studentAnswers[i] !== undefined && studentAnswers[i] !== "").length;
                          const totalUnanswered = questions.length - totalAnswered;
                          const totalRagu = Object.keys(raguRaguAnswers).filter(k => raguRaguAnswers[parseInt(k)] === true).length;

                          return (
                            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 space-y-3 max-w-xs mx-auto w-full">
                              <p className="text-[9px] font-black uppercase text-slate-400 tracking-wider text-center border-b border-slate-800/60 pb-1.5">
                                Ringkasan Jawaban Anda
                              </p>
                              
                              <div className="grid grid-cols-3 gap-1.5 text-center">
                                <div className="p-1 px-1 bg-emerald-950/20 border border-emerald-900/30 rounded-xl space-y-0.5">
                                  <p className="text-[7.5px] text-slate-400 font-extrabold uppercase leading-none">TERJAWAB</p>
                                  <p className="text-xs font-mono font-black text-emerald-400">{totalAnswered}</p>
                                </div>
                                <div className="p-1 px-1 bg-amber-950/20 border border-amber-900/30 rounded-xl space-y-0.5">
                                  <p className="text-[7.5px] text-slate-400 font-extrabold uppercase leading-none">RAGU-RAGU</p>
                                  <p className="text-xs font-mono font-black text-amber-500">{totalRagu}</p>
                                </div>
                                <div className="p-1 px-1 bg-slate-950/40 border border-slate-900 rounded-xl space-y-0.5">
                                  <p className="text-[7.5px] text-slate-400 font-extrabold uppercase leading-none">KOSONG</p>
                                  <p className="text-xs font-mono font-black text-slate-400">{totalUnanswered}</p>
                                </div>
                              </div>

                              {totalRagu > 0 && (
                                <div className="p-2 bg-amber-950/10 border border-amber-900/20 text-amber-300 text-[8.5px] font-semibold rounded-lg flex items-start gap-1 w-full text-left">
                                  <span className="shrink-0 text-amber-500">⚠️</span>
                                  <span>Anda masih memiliki <strong>{totalRagu} soal ragu-ragu</strong>. Hilangkan tanda ragu-ragu jika Anda sudah yakin!</span>
                                </div>
                              )}
                            </div>
                          );
                        })()}

                        <div className="p-3 bg-rose-950/15 border border-rose-900/30 text-rose-300 text-[8.5px] font-semibold rounded-xl text-center flex items-center justify-center gap-1.5 max-w-xs mx-auto">
                          <span>🔒</span>
                          <span>Setelah selesai, jawaban tidak dapat diubah kembali.</span>
                        </div>
                      </div>

                      <div className="space-y-2 mt-4">
                        <button
                          type="button"
                          onClick={() => {
                            setShowSubmitConfirmModal(false);
                            calculateAndCommitResult();
                          }}
                          className="w-full py-2.5 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-700 hover:to-emerald-600 text-white font-extrabold text-[10px] uppercase rounded-xl transition cursor-pointer shadow-md text-center hover:scale-[1.01] active:scale-95 animate-pulse"
                        >
                          YA, SAYA YAKIN - SELESAI UJIAN
                        </button>

                        <button
                          type="button"
                          onClick={() => setShowSubmitConfirmModal(false)}
                          className="w-full py-2 bg-slate-900 hover:bg-slate-850 hover:text-white text-slate-300 border border-slate-800 font-extrabold text-[9px] uppercase rounded-xl transition cursor-pointer text-center"
                        >
                          BATAL, PERIKSA KEMBALI
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}

            {/* 5. STUDENT PORTAL BLOCKED / DISQUALIFIED SCREEN */}
            {screen === "blocked" && loggedInStudent && (
              <div className="p-5 flex-1 flex flex-col justify-center items-center text-center space-y-5 bg-rose-50" id="block_screen">
                <div className="w-16 h-16 rounded-full bg-rose-100 flex items-center justify-center text-rose-700 border border-rose-200">
                  <AlertCircle size={34} className="animate-bounce" />
                </div>

                <div className="space-y-1">
                  <span className="px-2 py-0.5 text-[8px] bg-rose-900 text-rose-105 rounded font-black tracking-widest uppercase">
                    DEVICE SECURE BLOCKED
                  </span>
                  <h3 className="text-xs font-black text-slate-800 uppercase">Aplikasi CBT Dikunci</h3>
                  <p className="text-[10px] text-slate-500 leading-relaxed max-w-xs font-semibold">
                    Anda telah didiskualifikasi atau perangkat Anda dikunci otomatis karena melampaui batas pelanggaran toleransi CBT ({dbState.konfig.batasPelanggaran || 3} Kali).
                  </p>
                </div>

                {/* Detail logs info */}
                <div className="w-full bg-white p-3 rounded-xl border border-rose-150 text-left space-y-1.5 overflow-hidden">
                  <p className="text-[9px] text-[#0666AE] font-black uppercase">LOG PELANGGARAN KECURANGAN:</p>
                  <div className="max-h-[90px] overflow-y-auto space-y-1 text-[8.5px] no-scrollbar">
                    {dbState.sessions.find(s => s.id === loggedInStudent.nisn)?.pelanggaranLogs?.map((log: any, idx: number) => (
                      <p key={idx} className="text-rose-750 font-bold border-l-2 border-rose-300 pl-1">
                        [{log.timestamp}] {log.keterangan || "Tab focus switch"}
                      </p>
                    )) || <p className="text-slate-400 italic">Tidak ada log tercatat.</p>}
                  </div>
                </div>

                {/* Helpful shortcut interface specifically for AI Studio developers to allow clearing */}
                <div className="space-y-2 pt-2 w-full">
                  <button
                    type="button"
                    onClick={handleResetSimulatorBlock}
                    className="w-full bg-slate-900 hover:bg-slate-900/90 text-white p-2.5 text-[10px] rounded-xl font-bold uppercase transition inline-flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <Undo size={11} />
                    <span>Developer Unblock</span>
                  </button>
                  <p className="text-[8px] text-slate-400 font-semibold leading-normal">
                    *Di server riil, Anda harus dibebaskan oleh Pengawas dari menu Pengawas Portal dengan menekan tombol unblock.
                  </p>
                </div>
              </div>
            )}

            {/* 6. CBT UJIAN COMPLETED STATUS SCREEN */}
            {screen === "completed" && loggedInStudent && (
              <div className="p-6 flex-1 flex flex-col justify-center items-center text-center space-y-5 bg-emerald-50">
                <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-800 border border-emerald-250">
                  <CheckCircle size={34} className="animate-pulse" />
                </div>

                <div className="space-y-1 select-none">
                  <span
                    className={`px-2 py-0.5 text-[8px] text-white rounded font-black tracking-widest uppercase ${
                      sessionForceFinishedNotice ? "bg-indigo-700" : "bg-emerald-700"
                    }`}
                  >
                    {sessionForceFinishedNotice ? "UJIAN DISELESAIKAN PENGAWAS (SUBMIT PAKSA)" : "SELESAI DIKIRIM"}
                  </span>
                  <h3 className="text-xs font-black text-slate-800 uppercase leading-normal">
                    {sessionForceFinishedNotice ? "Ujian Telah Diakhiri!" : "Laporan Pengumpulan Sukses!"}
                  </h3>
                  <p className="text-[10px] text-slate-500 leading-relaxed font-semibold max-w-xs">
                    {sessionForceFinishedNotice
                      ? "Sesi ujian Anda telah diselesaikan melalui Submit Paksa oleh Pengawas/Admin. Jawaban terakhir Anda sudah otomatis dinilai dan direkap."
                      : "Terima kasih telah berpartisipasi menegakkan ujian jujur. Jawaban Anda telah tersinkronisasi sepenuhnya ke bank server Cloud Firestore."}
                  </p>
                </div>

                {/* Student confirmation card details */}
                <div className="bg-white p-4 rounded-xl border border-emerald-200 text-left text-[10px] space-y-1.5 w-full font-medium">
                  <p className="font-extrabold text-[#0666AE] tracking-widest uppercase text-[8px]">REKAP MASUK:</p>
                  <div className="flex justify-between">
                    <span className="text-slate-450">Nama Peserta:</span>
                    <span className="font-bold text-slate-800">{loggedInStudent.nama}</span>
                  </div>
                  <div className="flex justify-between border-t border-slate-50 pt-1.5">
                    <span className="text-slate-450">Kelas / Ruang:</span>
                    <span className="font-bold text-slate-800">{loggedInStudent.kelas}</span>
                  </div>
                  <div className="flex justify-between border-t border-slate-50 pt-1.5">
                    <span className="text-slate-450">Sinkronisasi:</span>
                    <span className="font-black text-emerald-700">✓ CLOUD FIRESTORE</span>
                  </div>
                </div>

                {/* Quick reset/exit button inside phone */}
                <button
                  type="button"
                  onClick={() => {
                    activeSessionCreatedRef.current = false;
                    setSessionForceFinishedNotice(false);
                    setLoggedInStudent(null);
                    setSelectedJadwal(null);
                    setScreen("login");
                  }}
                  className="w-full py-2.5 bg-[#0666AE] hover:bg-[#0666AE]/95 text-white font-extrabold text-[10px] rounded-xl uppercase transition cursor-pointer"
                >
                  Masuk Kembali
                </button>
              </div>
            )}
          </div>

          {/* 
            ========================================
            BOTTOM ANDROID MULTITASKING NAVIGATION BAR
            ========================================
          */}
          {!standalone && (
            <div className="w-full h-11 bg-slate-950 text-slate-400 flex justify-around items-center select-none rounded-b-[28px] shrink-0 relative z-30" id="android-navigation-bottom-bar">
              {/* Back button */}
              <button 
                type="button"
                onClick={() => {
                  if (screen === "exam") {
                    const confirmExit = window.confirm("Apakah Anda yakin ingin keluar dari pengerjaan ujian? Jawaban Anda telah tersimpan secara otomatis.");
                    if (confirmExit) {
                      setLoggedInStudent(null);
                      setSelectedJadwal(null);
                      setScreen("login");
                    }
                  } else if (screen === "token-entry") {
                    setScreen("select-exam");
                  } else if (screen === "select-exam") {
                    setLoggedInStudent(null);
                    setSelectedJadwal(null);
                    setScreen("login");
                  }
                }}
                className="px-6 py-2 hover:bg-slate-900 rounded-xl cursor-pointer active:scale-95 text-slate-400 hover:text-white"
                title="Tombol Kembali Android"
              >
                <ChevronLeft size={16} />
              </button>

              {/* Home button */}
              <button 
                type="button"
                onClick={() => {
                  if (screen === "exam" || screen === "select-exam" || screen === "token-entry") {
                    const confirmExit = window.confirm("Apakah Anda yakin ingin ke halaman utama? Sesi aktif Anda akan disimpan.");
                    if (confirmExit) {
                      setLoggedInStudent(null);
                      setSelectedJadwal(null);
                      setScreen("login");
                    }
                  } else {
                    setLoggedInStudent(null);
                    setSelectedJadwal(null);
                    setScreen("login");
                  }
                }}
                className="px-6 py-2 hover:bg-slate-900 rounded-xl cursor-pointer active:scale-95 text-slate-400 hover:text-white"
                title="Tombol Home Android"
              >
                <div className="w-3.5 h-3.5 border-2 border-slate-400 rounded-md"></div>
              </button>

              {/* Recents button */}
              <button 
                type="button"
                onClick={() => {
                  alert("Mode multi-tasking dinonaktifkan demi keamanan ujian.");
                }}
                className="px-6 py-2 hover:bg-slate-900 rounded-xl cursor-pointer active:scale-95 text-slate-400 hover:text-white"
                title="Tombol Recents Apps"
              >
                <div className="w-3.5 h-3.5 border-2 border-slate-400 rounded-lg"></div>
              </button>
            </div>
          )}

          {/* 
            ========================================
            SECURE EXIT PASSCODE DIALOG MODAL (8899/ALMASUM)
            ========================================
          */}
          <AnimatePresence>
            {showExitModal && (
              <motion.div 
                initial={{ opacity: 0 }} 
                animate={{ opacity: 1 }} 
                exit={{ opacity: 0 }}
                className="absolute inset-0 bg-slate-950/95 z-55 p-5 flex flex-col justify-center items-center text-center space-y-4 text-white font-sans"
              >
                <div className="w-12 h-12 rounded-xl bg-slate-900 border border-slate-800 text-amber-500 flex items-center justify-center shadow">
                  <LogOut size={20} className="animate-pulse" />
                </div>

                <div className="space-y-1.5 leading-normal">
                  <h4 className="text-xs font-black uppercase text-slate-350 tracking-widest">Sandi Proteksi Keluar</h4>
                  <p className="text-[9.5px] text-slate-400 leading-normal font-semibold max-w-xs nx-auto">
                    Aplikasi ini dijalankan dalam mode Kiosk Terkoneksi. Untuk membuka blokir navigator ponsel atau keluar ke halaman utama, Anda wajib memasukkan Sandi Pengawas/Admin.
                  </p>
                </div>

                <form onSubmit={processSecureExit} className="space-y-3 w-full max-w-[240px]">
                  {exitError && (
                    <p className="text-[9px] text-rose-450 font-black text-center">❌ Sandi Pengawas keliru!</p>
                  )}

                  <input 
                    type="password"
                    value={exitPasscode}
                    onChange={(e) => setExitPasscode(e.target.value)}
                    placeholder="Masukkan Sandi (e.g. 8899)"
                    className="w-full p-2.5 bg-slate-900 border border-slate-850 rounded-xl text-center text-xs text-white uppercase tracking-widest font-extrabold focus:outline-amber-500"
                    autoFocus
                  />

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setShowExitModal(false);
                        setExitPasscode("");
                        setExitError(false);
                      }}
                      className="w-1/2 p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-[10px] rounded-lg uppercase cursor-pointer"
                    >
                      Batal
                    </button>
                    <button
                      type="submit"
                      className="w-1/2 p-2 bg-amber-600 hover:bg-amber-700 text-white font-extrabold text-[10px] rounded-lg uppercase cursor-pointer shadow"
                    >
                      Keluar
                    </button>
                  </div>
                </form>

                <p className="text-[8px] font-mono text-slate-500">Sandi Bawaan Pengawas: <strong>8899</strong> atau <strong>ALMASUM</strong></p>
              </motion.div>
            )}
          </AnimatePresence>

        </div>
      </div>
    </div>
  );
}
