import { initializeApp } from "firebase/app";
import { getAuth, signInAnonymously } from "firebase/auth";
import {
  getFirestore,
  initializeFirestore,
  doc,
  collection,
  onSnapshot,
  getDocFromServer,
} from "firebase/firestore";
import firebaseConfig from "./firebase-applet-config.json";
import type {
  Kelas,
  KelasAkademik,
  Mapel,
  Siswa,
  Guru,
  Pengawas,
  JadwalNgawas,
  Soal,
  JadwalUjian,
  TokenUjian,
  SesiSiswa,
  HasilUjian,
  KonfigurasiSekolah,
} from "./types";

// Safe payload cleaner: recurses and removes any undefined fields
export function cleanPayload<T>(obj: T): T {
  if (obj === null || obj === undefined) return obj;
  if (Array.isArray(obj)) {
    return obj.map((item) => cleanPayload(item)) as any;
  }
  if (typeof obj === "object" && !(obj instanceof Date)) {
    const cleaned: any = {};
    for (const [k, v] of Object.entries(obj)) {
      if (v !== undefined) {
        cleaned[k] = cleanPayload(v);
      }
    }
    return cleaned;
  }
  return obj;
}

export enum OperationType {
  CREATE = "create",
  UPDATE = "update",
  DELETE = "delete",
  LIST = "list",
  GET = "get",
  WRITE = "write",
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export const isFirebaseConfigured =
  Boolean(firebaseConfig.apiKey) &&
  firebaseConfig.apiKey !== "YOUR_API_KEY_PLACEHOLDER" &&
  !firebaseConfig.apiKey.startsWith("YOUR_");

export let db: any = null;
export let auth: any = null;

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
) {
  const currentUser = auth?.currentUser;
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: currentUser?.uid || null,
      email: currentUser?.email || null,
      emailVerified: currentUser?.emailVerified || null,
      isAnonymous: currentUser?.isAnonymous || null,
      tenantId: currentUser?.tenantId || null,
      providerInfo:
        currentUser?.providerData?.map((provider: any) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error("Database Error Decoded: ", JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// ------------------------------------------------------------------------
// REACTIVE LOCAL CACHE & SUBSCRIBERS
// ------------------------------------------------------------------------

type Subscriber = () => void;
const subscribers = new Set<Subscriber>();

export function notifySync() {
  subscribers.forEach((cb) => cb());
}

export function subscribeToDB(cb: Subscriber) {
  subscribers.add(cb);
  return () => {
    subscribers.delete(cb);
  };
}

const DEFAULT_KELAS: Kelas[] = [
  { id: "k1", nama: "Ruang CBT 01", jurusan: "UMUM" },
  { id: "k2", nama: "Ruang CBT 02", jurusan: "UMUM" },
  { id: "k3", nama: "Ruang LAB-1", jurusan: "LAB" },
  { id: "k4", nama: "Ruang LAB-2", jurusan: "LAB" },
];

const DEFAULT_KELAS_AKADEMIK: KelasAkademik[] = [
  { id: "ka_vii_1", nama: "Kelas VII-1" },
  { id: "ka_vii_2", nama: "Kelas VII-2" },
  { id: "ka_vii_3", nama: "Kelas VII-3" },
  { id: "ka_viii_1", nama: "Kelas VIII-1" },
  { id: "ka_viii_2", nama: "Kelas VIII-2" },
  { id: "ka_viii_3", nama: "Kelas VIII-3" },
  { id: "ka_ix_1", nama: "Kelas IX-1" },
  { id: "ka_ix_2", nama: "Kelas IX-2" },
  { id: "ka_ix_3", nama: "Kelas IX-3" },
  { id: "ka_vii", nama: "Kelas VII" },
  { id: "ka_viii", nama: "Kelas VIII" },
  { id: "ka_ix", nama: "Kelas IX" },
];

const DEFAULT_MAPEL: Mapel[] = [
  { id: "m1", nama: "Matematika", kode: "MAT-MTs" },
  { id: "m2", nama: "Bahasa Inggris", kode: "ING-MTs" },
  { id: "m3", nama: "Ilmu Pengetahuan Alam (IPA)", kode: "IPA-MTs" },
  { id: "m4", nama: "Ilmu Pengetahuan Sosial (IPS)", kode: "IPS-MTs" },
];

const DEFAULT_GURU: Guru[] = [
  { id: "g1", nama: "H. Ahmad Fauzi, S.Pd.", nip: "19840112 201001 1 002", username: "guru1", password: "Password123", mapelIds: ["m1", "m3"] },
  { id: "g2", nama: "Dra. Siti Masithoh", nip: "19720815 199803 2 001", username: "guru2", password: "Password123", mapelIds: ["m2", "m4"] },
];

const DEFAULT_PENGAWAS: Pengawas[] = [
  { id: "p1", nama: "Drs. H. Mulyadi, M.Pd.", nip: "19760514 200212 1 003", username: "pengawas1", password: "Password123" },
  { id: "p2", nama: "Siti Rahmawati, S.Sos.", nip: "19831120 201101 2 004", username: "pengawas2", password: "Password123" },
];

const DEFAULT_JADWAL_NGAWAS: JadwalNgawas[] = [
  { id: "jn1", pengawasId: "p1", mapelId: "m1", ruangId: "k1", sesi: "Sesi I (07:30 - 09:30)", tanggal: "2026-06-08" },
  { id: "jn2", pengawasId: "p2", mapelId: "m2", ruangId: "k2", sesi: "Sesi I (07:30 - 09:30)", tanggal: "2026-06-08" },
];

const DEFAULT_SISWA: Siswa[] = [
  { id: "s1", nama: "Ahmad Dani", nisn: "0095432101", username: "siswa1", password: "Password123", kelasId: "k1", kelas: "Kelas IX-1", noPeserta: "26-04-01-0001" },
  { id: "s2", nama: "Budi Santoso", nisn: "0095432102", username: "siswa2", password: "Password123", kelasId: "k1", kelas: "Kelas IX-1", noPeserta: "26-04-01-0002" },
  { id: "s3", nama: "Citra Kirana", nisn: "0095432103", username: "siswa3", password: "Password123", kelasId: "k2", kelas: "Kelas IX-2", noPeserta: "26-04-02-0001" },
  { id: "s4", nama: "Dewi Lestari", nisn: "0115432104", username: "siswa4", password: "Password123", kelasId: "k3", kelas: "Kelas VII-1", noPeserta: "26-04-03-0001" },
  { id: "s5", nama: "Farhan Malik", nisn: "0105432105", username: "siswa5", password: "Password123", kelasId: "k4", kelas: "Kelas VIII-1", noPeserta: "26-04-04-0001" },
];

const DEFAULT_SOAL: Soal[] = [
  {
    id: "q1_1",
    mapelId: "m1",
    teks: "Hasil dari (-12) + 25 - (-8) adalah...",
    opsi: {
      A: "21",
      B: "5",
      C: "-29",
      D: "15",
      E: "25",
    },
    kunci: "A",
  },
  {
    id: "q1_2",
    mapelId: "m1",
    teks: "Jika 3x - 5 = 16, maka nilai dari x + 4 adalah...",
    opsi: {
      A: "7",
      B: "11",
      C: "9",
      D: "12",
      E: "10",
    },
    kunci: "B",
  },
  {
    id: "q1_3",
    mapelId: "m1",
    teks: "Sebuah segitiga siku-siku memiliki panjang sisi siku-siku 6 cm dan 8 cm. Panjang sisi miring (hipotenusa) segitiga tersebut adalah...",
    opsi: {
      A: "10 cm",
      B: "12 cm",
      C: "14 cm",
      D: "9 cm",
      E: "11 cm",
    },
    kunci: "A",
  },
  {
    id: "q1_4",
    mapelId: "m1",
    teks: "Keliling sebuah persegi panjang yang memiliki panjang 15 cm dan lebar 8 cm adalah...",
    opsi: {
      A: "46 cm",
      B: "23 cm",
      C: "120 cm",
      D: "38 cm",
      E: "60 cm",
    },
    kunci: "A",
  },
  {
    id: "q1_5",
    mapelId: "m1",
    teks: "Berapakah rata-rata (mean) dari data nilai ulangan berikut: 70, 75, 80, 85, 90?",
    opsi: {
      A: "75",
      B: "80",
      C: "82",
      D: "85",
      E: "78",
    },
    kunci: "B",
  },
  {
    id: "q2_1",
    mapelId: "m2",
    teks: "Choose the correct sentence to complete the dialogue:\nJohn: 'Would you like some tea?'\nMary: '________. I just drank water.'",
    opsi: {
      A: "Yes, please",
      B: "No, thank you",
      C: "I'd love to",
      D: "Sure, sounds great",
      E: "Of course",
    },
    kunci: "B",
  },
  {
    id: "q2_2",
    mapelId: "m2",
    teks: "Identify the passive form of: 'The teacher explains the lesson.'",
    opsi: {
      A: "The lesson is explained by the teacher.",
      B: "The lesson is explaining by the teacher.",
      C: "The lesson was explained by the teacher.",
      D: "The lesson has been explained by the teacher.",
      E: "The teacher is explaining the lesson.",
    },
    kunci: "A",
  },
];

const DEFAULT_JADWAL: JadwalUjian[] = [
  {
    id: "j1",
    mapelId: "m1",
    kelasIds: ["Kelas IX-1", "Kelas IX-2"],
    tanggal: new Date().toISOString().split("T")[0],
    jamMulai: "00:00",
    jamSelesai: "23:59",
    acakSoal: true,
    durasiMenit: 90,
  },
  {
    id: "j2",
    mapelId: "m2",
    kelasIds: ["Kelas VII-1", "Kelas VIII-1"],
    tanggal: new Date().toISOString().split("T")[0],
    jamMulai: "00:00",
    jamSelesai: "23:59",
    acakSoal: false,
    durasiMenit: 90,
  },
];

const DEFAULT_KONFIGURASI: KonfigurasiSekolah = {
  namaSekolah: "MTs. AL-MA'SUM II CIMUNCANG",
  alamatSekolah: "Cimuncang, Malausma, Majalengka, Jawa Barat",
  kodeRegistrasi: "MTS-ALMASUM2-CMC-2026",
  logoKiriUrl: "/assets/aistudio/MTS_AL-MA_SUM_II_7c7dea1b.png",
  logoKananUrl: "/assets/aistudio/MTS_AL-MA_SUM_II_7c7dea1b.png",
  bgUrl: "",
  ttdKepsekUrl: "",
  stempelSekolahUrl: "",
  namaKepsek: "Kepala MTs. Al-Ma'sum II Cimuncang",
  nipKepsek: "-",
  zonaWaktu: "WIB",
  batasPelanggaran: 3,
};

const storage = {
  get: <T>(key: string, defaultValue: T): T => {
    try {
      const data = localStorage.getItem(`exambro_${key}`);
      return data !== null ? JSON.parse(data) : defaultValue;
    } catch {
      return defaultValue;
    }
  },
  set: <T>(key: string, val: T): T => {
    try {
      localStorage.setItem(`exambro_${key}`, JSON.stringify(val));
      notifySync();
    } catch (e) {
      console.error(e);
    }
    return val;
  },
};

// ------------------------------------------------------------------------
// SYNC STATUS & BACKEND PROVIDER MANAGEMENT
// ------------------------------------------------------------------------
export type BackendProvider = "supabase" | "firestore-readonly" | "unconfigured";

export interface SyncStatus {
  pendingCount: number;
  lastSavedAt: number | null;
  lastError: string | null;
  cloudReady: boolean;
  quotaExceeded: boolean;
  provider?: BackendProvider;
}

let activeProvider: BackendProvider = "unconfigured";
let syncMode: "staff" | "student" = "staff";
let activeStudentNisn = "";

let currentSyncStatus: SyncStatus = {
  pendingCount: 0,
  lastSavedAt: null,
  lastError: null,
  cloudReady: false,
  quotaExceeded: false,
  provider: "unconfigured",
};

type SyncStatusSubscriber = (status: SyncStatus) => void;
const syncStatusSubscribers = new Set<SyncStatusSubscriber>();

function notifySyncStatus() {
  syncStatusSubscribers.forEach((cb) => cb(currentSyncStatus));
}

export function getBackendProvider(): BackendProvider {
  return activeProvider;
}

export function getSyncStatus(): SyncStatus {
  return currentSyncStatus;
}

export function subscribeToSyncStatus(cb: SyncStatusSubscriber) {
  syncStatusSubscribers.add(cb);
  return () => {
    syncStatusSubscribers.delete(cb);
  };
}

export function clearSyncError() {
  currentSyncStatus = { ...currentSyncStatus, lastError: null, quotaExceeded: false };
  notifySyncStatus();
}

export function setSyncMode(mode: "staff" | "student", studentNisn?: string) {
  syncMode = mode;
  activeStudentNisn = mode === "student" && studentNisn ? studentNisn.trim() : "";
}

const recentlyDeletedDocIds = new Set<string>();
const inFlightWriteTimestamps = new Map<string, number>();

function markDocWriteInFlight(path: string, id: string) {
  inFlightWriteTimestamps.set(`${path}::${id}`, Date.now());
}

function clearDocWriteInFlight(path: string, id: string) {
  const key = `${path}::${id}`;
  setTimeout(() => {
    const ts = inFlightWriteTimestamps.get(key);
    if (ts && Date.now() - ts >= 550) {
      inFlightWriteTimestamps.delete(key);
    }
  }, 600);
}

function isDocWriteProtected(path: string, id: string): boolean {
  const ts = inFlightWriteTimestamps.get(`${path}::${id}`);
  if (!ts) return false;
  if (Date.now() - ts > 8000) {
    inFlightWriteTimestamps.delete(`${path}::${id}`);
    return false;
  }
  return true;
}

export function markDocAsDeleted(id: string) {
  if (!id) return;
  recentlyDeletedDocIds.add(id);
  setTimeout(() => {
    recentlyDeletedDocIds.delete(id);
  }, 30000);
}

function stableStringify(val: any): string {
  if (val === null || val === undefined) return "null";
  if (typeof val !== "object") return JSON.stringify(val);
  if (Array.isArray(val)) return "[" + val.map(stableStringify).join(",") + "]";
  const keys = Object.keys(val).sort();
  return "{" + keys.map((k) => JSON.stringify(k) + ":" + stableStringify(val[k])).join(",") + "}";
}

// ------------------------------------------------------------------------
// SUPABASE SERVER PROXY TRANSPORT (/api/db/*)
// ------------------------------------------------------------------------

async function apiRequest<T = any>(url: string, options?: RequestInit): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  try {
    const res = await fetch(url, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(options?.headers || {}),
      },
      signal: controller.signal,
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || json?.ok === false) {
      throw new Error(json?.error || json?.message || `HTTP ${res.status}`);
    }
    return json as T;
  } finally {
    clearTimeout(timer);
  }
}

function mergeIncomingCollection(storageKey: string, remoteItems: any[]) {
  const localCurrent = storage.get<any[]>(storageKey, []);
  const localMap = new Map(
    (Array.isArray(localCurrent) ? localCurrent : [])
      .filter((i: any) => i && i.id)
      .map((i: any) => [i.id, i])
  );

  const merged: any[] = [];
  const seenIds = new Set<string>();

  for (const remoteItem of remoteItems || []) {
    if (!remoteItem || !remoteItem.id) continue;
    if (recentlyDeletedDocIds.has(remoteItem.id)) continue;
    seenIds.add(remoteItem.id);
    if (isDocWriteProtected(storageKey, remoteItem.id) && localMap.has(remoteItem.id)) {
      merged.push(localMap.get(remoteItem.id));
    } else {
      merged.push(remoteItem);
    }
  }

  localMap.forEach((item, id) => {
    if (!seenIds.has(id) && !recentlyDeletedDocIds.has(id) && isDocWriteProtected(storageKey, id)) {
      merged.push(item);
    }
  });

  const prevSerialized = localStorage.getItem(`exambro_${storageKey}`);
  const nextSerialized = JSON.stringify(merged);
  if (prevSerialized !== nextSerialized) {
    localStorage.setItem(`exambro_${storageKey}`, nextSerialized);
    return true;
  }
  return false;
}

let pollInProgress = false;

async function fetchSupabaseBootstrap(initial = false) {
  if (activeProvider !== "supabase" || pollInProgress) return;
  if (!initial && typeof document !== "undefined" && document.visibilityState === "hidden") return;

  pollInProgress = true;
  try {
    if (syncMode === "student" && activeStudentNisn) {
      const res = await apiRequest<{ ok: boolean; data: { jadwal: any[]; tokens: any[]; mySession: any | null } }>(
        `/api/db/bootstrap?scope=student&nisn=${encodeURIComponent(activeStudentNisn)}`
      );
      let changed = false;
      if (Array.isArray(res.data?.jadwal)) {
        if (mergeIncomingCollection("jadwal", res.data.jadwal)) changed = true;
      }
      if (Array.isArray(res.data?.tokens)) {
        if (mergeIncomingCollection("tokens", res.data.tokens)) changed = true;
      }
      // Update only this student's session so admin/proctor force-submit or reset takes effect immediately
      const currentSessions = storage.get<SesiSiswa[]>("sessions", []);
      const remoteSes = res.data?.mySession;
      if (!isDocWriteProtected("sessions", activeStudentNisn)) {
        if (remoteSes && !recentlyDeletedDocIds.has(activeStudentNisn)) {
          const withoutMe = currentSessions.filter((s) => s.id !== activeStudentNisn);
          const next = [...withoutMe, remoteSes];
          if (stableStringify(currentSessions) !== stableStringify(next)) {
            localStorage.setItem("exambro_sessions", JSON.stringify(next));
            changed = true;
          }
        } else {
          // Session was deleted (Reset Sesi by proctor/admin)
          const withoutMe = currentSessions.filter((s) => s.id !== activeStudentNisn);
          if (withoutMe.length !== currentSessions.length) {
            localStorage.setItem("exambro_sessions", JSON.stringify(withoutMe));
            changed = true;
          }
        }
      }
      if (changed) notifySync();
    } else {
      const isStudentPage =
        typeof window !== "undefined" && window.location.search.toLowerCase().includes("siswa");
      const scope = isStudentPage ? "studentInit" : "staff";
      const res = await apiRequest<{ ok: boolean; data: Record<string, any> }>(
        `/api/db/bootstrap?scope=${scope}`
      );
      const data = res.data || {};
      let changed = false;

      const arrayKeys = [
        "kelas",
        "kelasAkademik",
        "mapel",
        "siswa",
        "guru",
        "pengawas",
        "jadwalNgawas",
        "soal",
        "jadwal",
        "tokens",
        "sessions",
        "hasil",
      ];

      for (const k of arrayKeys) {
        if (Array.isArray(data[k])) {
          if (mergeIncomingCollection(k, data[k])) changed = true;
        }
      }

      if (data.konfig && !isDocWriteProtected("konfig", "sekolah")) {
        const prevK = localStorage.getItem("exambro_konfig");
        const nextK = JSON.stringify(data.konfig);
        if (prevK !== nextK) {
          localStorage.setItem("exambro_konfig", nextK);
          changed = true;
        }
      }

      if (!currentSyncStatus.cloudReady || currentSyncStatus.lastError) {
        currentSyncStatus = {
          ...currentSyncStatus,
          cloudReady: true,
          lastError: null,
          quotaExceeded: false,
          provider: "supabase",
        };
        notifySyncStatus();
      }

      if (changed || initial) notifySync();
    }
  } catch (err: any) {
    console.warn("Sinkronisasi Supabase sementara tertunda:", err?.message || err);
    if (initial) {
      currentSyncStatus = {
        ...currentSyncStatus,
        cloudReady: true,
        lastError: `Gagal memuat data awal Supabase: ${err?.message || err}`,
        provider: "supabase",
      };
      notifySyncStatus();
    }
  } finally {
    pollInProgress = false;
  }
}

async function syncArrayToBackend(storageKey: string, newItems: any[], prevItems?: any[]) {
  if (activeProvider !== "supabase") {
    if (activeProvider === "firestore-readonly" || activeProvider === "unconfigured") {
      currentSyncStatus = {
        ...currentSyncStatus,
        lastError:
          "Database Supabase belum terhubung. Tambahkan SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY di panel Secrets AI Studio, lalu restart aplikasi.",
        quotaExceeded: false,
      };
      notifySyncStatus();
    }
    return;
  }

  currentSyncStatus = {
    ...currentSyncStatus,
    pendingCount: currentSyncStatus.pendingCount + 1,
    lastError: null,
  };
  notifySyncStatus();

  try {
    const cleanedItems = (newItems || [])
      .map((item) => cleanPayload(item))
      .filter((i: any) => Boolean(i && i.id));
    const incomingMap = new Map(cleanedItems.map((item) => [item.id, item]));

    const oldItems = (prevItems ?? storage.get<any[]>(storageKey, [])).map((item) => cleanPayload(item));
    const oldMap = new Map(
      oldItems.filter((i: any) => Boolean(i && i.id)).map((item: any) => [item.id, item])
    );

    const oldDeletedIds = oldItems
      .filter((item: any) => item && item.id && !incomingMap.has(item.id))
      .map((item: any) => item.id);

    oldDeletedIds.forEach((id: string) => markDocAsDeleted(id));

    if (cleanedItems.length === 0) {
      await apiRequest(`/api/db/collection/${storageKey}`, { method: "DELETE" });
      currentSyncStatus = {
        ...currentSyncStatus,
        pendingCount: Math.max(0, currentSyncStatus.pendingCount - 1),
        lastSavedAt: Date.now(),
        lastError: null,
        quotaExceeded: false,
      };
      notifySyncStatus();
      return;
    }

    const changedItems = cleanedItems.filter((item: any) => {
      const prevDoc = oldMap.get(item.id);
      if (!prevDoc) return true;
      return stableStringify(prevDoc) !== stableStringify(item);
    });

    const itemsToWrite = oldItems.length === 0 && changedItems.length === 0 ? cleanedItems : changedItems;

    if (oldDeletedIds.length === 0 && itemsToWrite.length === 0) {
      currentSyncStatus = {
        ...currentSyncStatus,
        pendingCount: Math.max(0, currentSyncStatus.pendingCount - 1),
        lastSavedAt: Date.now(),
        lastError: null,
      };
      notifySyncStatus();
      return;
    }

    itemsToWrite.forEach((item: any) => markDocWriteInFlight(storageKey, item.id));
    try {
      await apiRequest(`/api/db/collection/${storageKey}`, {
        method: "PUT",
        body: JSON.stringify({
          upserts: itemsToWrite,
          deleteIds: oldDeletedIds,
        }),
      });
    } finally {
      itemsToWrite.forEach((item: any) => clearDocWriteInFlight(storageKey, item.id));
    }

    currentSyncStatus = {
      ...currentSyncStatus,
      pendingCount: Math.max(0, currentSyncStatus.pendingCount - 1),
      lastSavedAt: Date.now(),
      lastError: null,
      quotaExceeded: false,
    };
    notifySyncStatus();
  } catch (err: any) {
    console.warn(`Gagal menyimpan '${storageKey}' ke Supabase:`, err?.message || err);
    currentSyncStatus = {
      ...currentSyncStatus,
      pendingCount: Math.max(0, currentSyncStatus.pendingCount - 1),
      lastError: `Gagal menyimpan ke server Supabase (${storageKey}): ${err?.message || err}`,
      quotaExceeded: false,
    };
    notifySyncStatus();
  }
}

async function syncSingleDocToBackend(storageKey: string, docId: string, data: any) {
  if (activeProvider !== "supabase") {
    currentSyncStatus = {
      ...currentSyncStatus,
      lastError:
        "Database Supabase belum terhubung. Tambahkan SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY di panel Secrets AI Studio.",
      quotaExceeded: false,
    };
    notifySyncStatus();
    return;
  }

  currentSyncStatus = {
    ...currentSyncStatus,
    pendingCount: currentSyncStatus.pendingCount + 1,
    lastError: null,
  };
  notifySyncStatus();
  markDocWriteInFlight(storageKey, docId);

  try {
    await apiRequest(`/api/db/doc/${storageKey}/${encodeURIComponent(docId)}`, {
      method: "PUT",
      body: JSON.stringify({ item: cleanPayload(data) }),
    });
    currentSyncStatus = {
      ...currentSyncStatus,
      pendingCount: Math.max(0, currentSyncStatus.pendingCount - 1),
      lastSavedAt: Date.now(),
      lastError: null,
      quotaExceeded: false,
    };
    notifySyncStatus();
  } catch (err: any) {
    console.warn(`Gagal menyimpan dokumen ${storageKey}/${docId} ke Supabase:`, err?.message || err);
    currentSyncStatus = {
      ...currentSyncStatus,
      pendingCount: Math.max(0, currentSyncStatus.pendingCount - 1),
      lastError: `Gagal menyimpan ke server Supabase (${storageKey}): ${err?.message || err}`,
      quotaExceeded: false,
    };
    notifySyncStatus();
  } finally {
    clearDocWriteInFlight(storageKey, docId);
  }
}

// Atomic student session upsert: updates localStorage + single row sessions/{nisn} without colliding with other 349 students
export async function syncSingleSession(session: SesiSiswa): Promise<void> {
  if (!session || !session.id) return;
  const cleaned = cleanPayload(session);
  const current = storage.get<SesiSiswa[]>("sessions", []);
  const next = [...current.filter((s) => s.id !== cleaned.id), cleaned];
  storage.set("sessions", next);
  await syncSingleDocToBackend("sessions", cleaned.id, cleaned);
}

async function deleteSingleDocFromBackend(storageKey: string, id: string): Promise<boolean> {
  markDocAsDeleted(id);
  const filtered = storage.get<any[]>(storageKey, []).filter((item) => item.id !== id);
  storage.set(storageKey, filtered);

  if (activeProvider !== "supabase") {
    currentSyncStatus = {
      ...currentSyncStatus,
      lastError:
        "Database Supabase belum terhubung. Tambahkan SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY di panel Secrets AI Studio.",
    };
    notifySyncStatus();
    return false;
  }

  currentSyncStatus = {
    ...currentSyncStatus,
    pendingCount: currentSyncStatus.pendingCount + 1,
    lastError: null,
  };
  notifySyncStatus();

  try {
    await apiRequest(`/api/db/doc/${storageKey}/${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
    currentSyncStatus = {
      ...currentSyncStatus,
      pendingCount: Math.max(0, currentSyncStatus.pendingCount - 1),
      lastSavedAt: Date.now(),
      lastError: null,
      quotaExceeded: false,
    };
    notifySyncStatus();
    return true;
  } catch (err: any) {
    console.warn(`Gagal menghapus ${storageKey}/${id} di Supabase:`, err?.message || err);
    currentSyncStatus = {
      ...currentSyncStatus,
      pendingCount: Math.max(0, currentSyncStatus.pendingCount - 1),
      lastError: `Gagal menghapus di server Supabase (${storageKey}): ${err?.message || err}`,
    };
    notifySyncStatus();
    return false;
  }
}

async function deleteAllDocsFromBackend(storageKey: string): Promise<boolean> {
  const existing = storage.get<any[]>(storageKey, []);
  existing.forEach((item) => item?.id && markDocAsDeleted(item.id));
  storage.set(storageKey, []);

  if (activeProvider !== "supabase") {
    currentSyncStatus = {
      ...currentSyncStatus,
      lastError:
        "Database Supabase belum terhubung. Tambahkan SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY di panel Secrets AI Studio.",
    };
    notifySyncStatus();
    return false;
  }

  currentSyncStatus = {
    ...currentSyncStatus,
    pendingCount: currentSyncStatus.pendingCount + 1,
    lastError: null,
  };
  notifySyncStatus();

  try {
    await apiRequest(`/api/db/collection/${storageKey}`, { method: "DELETE" });
    currentSyncStatus = {
      ...currentSyncStatus,
      pendingCount: Math.max(0, currentSyncStatus.pendingCount - 1),
      lastSavedAt: Date.now(),
      lastError: null,
      quotaExceeded: false,
    };
    notifySyncStatus();
    return true;
  } catch (err: any) {
    console.warn(`Gagal mengosongkan ${storageKey} di Supabase:`, err?.message || err);
    currentSyncStatus = {
      ...currentSyncStatus,
      pendingCount: Math.max(0, currentSyncStatus.pendingCount - 1),
      lastError: `Gagal menghapus data di server Supabase (${storageKey}): ${err?.message || err}`,
    };
    notifySyncStatus();
    return false;
  }
}

let firestoreFallbackStarted = false;

// ------------------------------------------------------------------------
// READ-ONLY FIRESTORE FALLBACK (only used before Supabase Secrets/backend are active, so user can export Backup JSON)
// ------------------------------------------------------------------------
function startFirestoreReadFallback(reasonMessage: string) {
  if (activeProvider === "supabase") return;
  activeProvider = "firestore-readonly";
  currentSyncStatus = {
    ...currentSyncStatus,
    provider: "firestore-readonly",
    lastError: reasonMessage,
  };
  notifySyncStatus();

  if (firestoreFallbackStarted) return;
  firestoreFallbackStarted = true;

  if (!isFirebaseConfigured) {
    currentSyncStatus = { ...currentSyncStatus, cloudReady: true };
    notifySyncStatus();
    return;
  }

  try {
    const firebaseApp = initializeApp(firebaseConfig);
    try {
      db = initializeFirestore(
        firebaseApp,
        { ignoreUndefinedProperties: true },
        firebaseConfig.firestoreDatabaseId
      );
    } catch {
      db = getFirestore(firebaseApp, firebaseConfig.firestoreDatabaseId);
    }
    auth = getAuth(firebaseApp);
    signInAnonymously(auth).catch(() => {});
    getDocFromServer(doc(db, "test", "connection")).catch(() => {});

    const syncCollections = [
      { key: "kelas", path: "kelas" },
      { key: "kelasAkademik", path: "kelasAkademik" },
      { key: "mapel", path: "mapel" },
      { key: "siswa", path: "siswa" },
      { key: "guru", path: "guru" },
      { key: "pengawas", path: "pengawas" },
      { key: "jadwalNgawas", path: "jadwalNgawas" },
      { key: "soal", path: "soal" },
      { key: "jadwal", path: "jadwalUjian" },
      { key: "tokens", path: "tokenUjian" },
      { key: "sessions", path: "sessions" },
      { key: "hasil", path: "hasilUjian" },
    ];

    const loadedKeys = new Set<string>();
    const markLoaded = (k: string) => {
      loadedKeys.add(k);
      if (!currentSyncStatus.cloudReady && loadedKeys.size >= syncCollections.length) {
        currentSyncStatus = { ...currentSyncStatus, cloudReady: true };
        notifySyncStatus();
      }
    };

    syncCollections.forEach(({ key, path }) => {
      onSnapshot(
        collection(db, path),
        (snapshot) => {
          if (activeProvider === "supabase") return;
          const items: any[] = [];
          snapshot.forEach((docSnap) => {
            if (!recentlyDeletedDocIds.has(docSnap.id)) {
              items.push({ id: docSnap.id, ...docSnap.data() });
            }
          });
          localStorage.setItem(`exambro_${key}`, JSON.stringify(items));
          markLoaded(key);
          notifySync();
        },
        () => {
          markLoaded(key);
        }
      );
    });

    onSnapshot(
      doc(db, "konfigurasi", "sekolah"),
      (snapshot) => {
        if (activeProvider === "supabase") return;
        if (snapshot.exists()) {
          localStorage.setItem("exambro_konfig", JSON.stringify(snapshot.data()));
          notifySync();
        }
      },
      () => {}
    );
  } catch (err) {
    console.warn("Firestore read-only fallback error:", err);
    currentSyncStatus = { ...currentSyncStatus, cloudReady: true };
    notifySyncStatus();
  }
}

let supabasePollStarted = false;

async function probeAndActivateSupabase(retryCount = 0): Promise<void> {
  if (typeof window === "undefined") return;
  try {
    const res = await fetch("/api/db/health", { cache: "no-store" });
    const contentType = res.headers.get("content-type") || "";
    if (!contentType.includes("application/json")) {
      throw new Error("Endpoint backend /api/db/health mengembalikan HTML (server backend Express belum aktif atau perlu publish ulang).");
    }
    const health = (await res.json()) as {
      provider?: string;
      configured?: boolean;
      ok?: boolean;
      message?: string;
    };

    if (health.provider === "supabase" && health.configured && health.ok) {
      activeProvider = "supabase";
      currentSyncStatus = {
        ...currentSyncStatus,
        provider: "supabase",
        lastError: null,
        quotaExceeded: false,
      };
      notifySyncStatus();

      await fetchSupabaseBootstrap(true);

      if (!supabasePollStarted) {
        supabasePollStarted = true;
        const scheduleNextPoll = () => {
          const delayMs = syncMode === "student" ? 10000 : 5000;
          setTimeout(async () => {
            await fetchSupabaseBootstrap(false);
            scheduleNextPoll();
          }, delayMs);
        };
        scheduleNextPoll();
      }
      return;
    }

    startFirestoreReadFallback(
      health.message ||
        "Database Supabase belum aktif: tambahkan SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY di panel Secrets AI Studio, lalu restart aplikasi."
    );
  } catch (err: any) {
    startFirestoreReadFallback(
      err?.message ||
        "Server backend belum merespons untuk Supabase. Mode baca Firestore sementara aktif untuk Backup JSON."
    );
    if (retryCount < 12) {
      setTimeout(() => {
        if (activeProvider !== "supabase") {
          probeAndActivateSupabase(retryCount + 1);
        }
      }, 4000);
    }
  }
}

probeAndActivateSupabase(0);

export async function seedDefaultDataToFirebase() {
  const entries = [
    { key: "kelas", items: DEFAULT_KELAS },
    { key: "kelasAkademik", items: DEFAULT_KELAS_AKADEMIK },
    { key: "mapel", items: DEFAULT_MAPEL },
    { key: "siswa", items: DEFAULT_SISWA },
    { key: "guru", items: DEFAULT_GURU },
    { key: "pengawas", items: DEFAULT_PENGAWAS },
    { key: "jadwalNgawas", items: DEFAULT_JADWAL_NGAWAS },
    { key: "soal", items: DEFAULT_SOAL },
    { key: "jadwal", items: DEFAULT_JADWAL },
  ];

  for (const entry of entries) {
    storage.set(entry.key, entry.items);
    if (activeProvider === "supabase") {
      await apiRequest(`/api/db/collection/${entry.key}`, {
        method: "PUT",
        body: JSON.stringify({ items: cleanPayload(entry.items) }),
      });
    }
  }

  storage.set("konfig", DEFAULT_KONFIGURASI);
  if (activeProvider === "supabase") {
    await apiRequest(`/api/db/doc/konfig/sekolah`, {
      method: "PUT",
      body: JSON.stringify({ item: cleanPayload(DEFAULT_KONFIGURASI) }),
    });
  }
  return true;
}

// Unified Getters
export const getDB = {
  kelas: (): Kelas[] => storage.get<Kelas[]>("kelas", DEFAULT_KELAS),
  kelasAkademik: (): KelasAkademik[] => storage.get<KelasAkademik[]>("kelasAkademik", DEFAULT_KELAS_AKADEMIK),
  mapel: (): Mapel[] => storage.get<Mapel[]>("mapel", DEFAULT_MAPEL),
  siswa: (): Siswa[] => storage.get<Siswa[]>("siswa", DEFAULT_SISWA),
  guru: (): Guru[] => storage.get<Guru[]>("guru", DEFAULT_GURU),
  pengawas: (): Pengawas[] => storage.get<Pengawas[]>("pengawas", DEFAULT_PENGAWAS),
  jadwalNgawas: (): JadwalNgawas[] => storage.get<JadwalNgawas[]>("jadwalNgawas", DEFAULT_JADWAL_NGAWAS),
  soal: (): Soal[] => storage.get<Soal[]>("soal", DEFAULT_SOAL),
  jadwal: (): JadwalUjian[] => storage.get<JadwalUjian[]>("jadwal", DEFAULT_JADWAL),
  tokens: (): TokenUjian[] => storage.get<TokenUjian[]>("tokens", []),
  sessions: (): SesiSiswa[] => storage.get<SesiSiswa[]>("sessions", []),
  hasil: (): HasilUjian[] => storage.get<HasilUjian[]>("hasil", []),
  konfig: (): KonfigurasiSekolah => storage.get<KonfigurasiSekolah>("konfig", DEFAULT_KONFIGURASI),
};

// Unified Setters
export const setDB = {
  kelas: (val: any) => {
    const prev = storage.get<any[]>("kelas", []);
    const res = storage.set("kelas", val);
    syncArrayToBackend("kelas", val, prev);
    return res;
  },
  kelasAkademik: (val: any) => {
    const prev = storage.get<any[]>("kelasAkademik", []);
    const res = storage.set("kelasAkademik", val);
    syncArrayToBackend("kelasAkademik", val, prev);
    return res;
  },
  mapel: (val: any) => {
    const prev = storage.get<any[]>("mapel", []);
    const res = storage.set("mapel", val);
    syncArrayToBackend("mapel", val, prev);
    return res;
  },
  siswa: (val: any) => {
    const prev = storage.get<any[]>("siswa", []);
    const res = storage.set("siswa", val);
    syncArrayToBackend("siswa", val, prev);
    return res;
  },
  guru: (val: any) => {
    const prev = storage.get<any[]>("guru", []);
    const res = storage.set("guru", val);
    syncArrayToBackend("guru", val, prev);
    return res;
  },
  pengawas: (val: any) => {
    const prev = storage.get<any[]>("pengawas", []);
    const res = storage.set("pengawas", val);
    syncArrayToBackend("pengawas", val, prev);
    return res;
  },
  jadwalNgawas: (val: any) => {
    const prev = storage.get<any[]>("jadwalNgawas", []);
    const res = storage.set("jadwalNgawas", val);
    syncArrayToBackend("jadwalNgawas", val, prev);
    return res;
  },
  soal: (val: any) => {
    const prev = storage.get<any[]>("soal", []);
    const res = storage.set("soal", val);
    syncArrayToBackend("soal", val, prev);
    return res;
  },
  jadwal: (val: any) => {
    const prev = storage.get<any[]>("jadwal", []);
    const res = storage.set("jadwal", val);
    syncArrayToBackend("jadwal", val, prev);
    return res;
  },
  tokens: (val: any) => {
    const prev = storage.get<any[]>("tokens", []);
    const res = storage.set("tokens", val);
    syncArrayToBackend("tokens", val, prev);
    return res;
  },
  sessions: (val: any) => {
    const prev = storage.get<any[]>("sessions", []);
    const res = storage.set("sessions", val);
    syncArrayToBackend("sessions", val, prev);
    return res;
  },
  hasil: (val: any) => {
    const prev = storage.get<any[]>("hasil", []);
    const res = storage.set("hasil", val);
    syncArrayToBackend("hasil", val, prev);
    return res;
  },
  konfig: (val: any) => {
    const res = storage.set("konfig", val);
    syncSingleDocToBackend("konfig", "sekolah", val);
    return res;
  },

  deleteSession: (id: string) => deleteSingleDocFromBackend("sessions", id),
  deleteKelas: (id: string) => deleteSingleDocFromBackend("kelas", id),
  deleteKelasAkademik: (id: string) => deleteSingleDocFromBackend("kelasAkademik", id),
  deleteMapel: (id: string) => deleteSingleDocFromBackend("mapel", id),
  deleteSiswa: (id: string) => deleteSingleDocFromBackend("siswa", id),
  deleteAllSiswa: () => deleteAllDocsFromBackend("siswa"),
  deleteGuru: (id: string) => deleteSingleDocFromBackend("guru", id),
  deleteAllGuru: () => deleteAllDocsFromBackend("guru"),
  deletePengawas: (id: string) => deleteSingleDocFromBackend("pengawas", id),
  deleteAllPengawas: async (): Promise<boolean> => {
    const okP = await deleteAllDocsFromBackend("pengawas");
    const okJ = await deleteAllDocsFromBackend("jadwalNgawas");
    return okP && okJ;
  },
  deleteJadwalNgawas: (id: string) => deleteSingleDocFromBackend("jadwalNgawas", id),
  deleteSoal: (id: string) => deleteSingleDocFromBackend("soal", id),
  deleteJadwal: (id: string) => deleteSingleDocFromBackend("jadwal", id),
  deleteHasil: (id: string, _currentHasil?: any[]) => deleteSingleDocFromBackend("hasil", id),
  deleteSelectedHasil: async (ids: string[], _currentHasil?: any[]): Promise<boolean> => {
    ids.forEach((id) => markDocAsDeleted(id));
    const current = storage.get<any[]>("hasil", []);
    const filtered = current.filter((h) => !ids.includes(h.id));
    storage.set("hasil", filtered);

    if (activeProvider !== "supabase") {
      currentSyncStatus = {
        ...currentSyncStatus,
        lastError: "Database Supabase belum terhubung.",
      };
      notifySyncStatus();
      return false;
    }

    currentSyncStatus = {
      ...currentSyncStatus,
      pendingCount: currentSyncStatus.pendingCount + 1,
      lastError: null,
    };
    notifySyncStatus();
    try {
      await apiRequest(`/api/db/doc/hasil/batch-delete`, {
        method: "POST",
        body: JSON.stringify({ ids }),
      });
      currentSyncStatus = {
        ...currentSyncStatus,
        pendingCount: Math.max(0, currentSyncStatus.pendingCount - 1),
        lastSavedAt: Date.now(),
        lastError: null,
      };
      notifySyncStatus();
      return true;
    } catch (err: any) {
      currentSyncStatus = {
        ...currentSyncStatus,
        pendingCount: Math.max(0, currentSyncStatus.pendingCount - 1),
        lastError: `Gagal menghapus hasil di Supabase: ${err?.message || err}`,
      };
      notifySyncStatus();
      return false;
    }
  },
  deleteAllHasil: () => deleteAllDocsFromBackend("hasil"),
};
