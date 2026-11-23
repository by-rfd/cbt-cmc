import express from "express";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const TABLE_MAP: Record<string, string> = {
  kelas: "kelas",
  kelasAkademik: "kelas_akademik",
  mapel: "mapel",
  siswa: "siswa",
  guru: "guru",
  pengawas: "pengawas",
  jadwalNgawas: "jadwal_ngawas",
  soal: "soal",
  jadwal: "jadwal_ujian",
  jadwalUjian: "jadwal_ujian",
  tokens: "token_ujian",
  tokenUjian: "token_ujian",
  sessions: "sessions",
  hasil: "hasil_ujian",
  hasilUjian: "hasil_ujian",
  konfig: "konfigurasi",
  konfigurasi: "konfigurasi",
};

const ALL_COLLECTION_KEYS = [
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
  "konfig",
] as const;

function normalizeSupabaseUrl(raw: string): { url: string; error?: string } {
  const cleaned = raw.trim().replace(/^["']|["']$/g, "");
  if (!cleaned) return { url: "" };
  if (cleaned.startsWith("eyJ") || cleaned.startsWith("sb_")) {
    return {
      url: "",
      error: "Nilai SUPABASE_URL berisi API Key, bukan URL Project. Tukar agar SUPABASE_URL diisi https://xxxx.supabase.co.",
    };
  }
  let parsed: URL;
  try {
    parsed = new URL(cleaned.startsWith("http") ? cleaned : `https://${cleaned}`);
  } catch {
    return { url: "", error: "Format SUPABASE_URL tidak valid. Contoh benar: https://abcdefgh.supabase.co" };
  }

  if (parsed.hostname === "supabase.com" || parsed.hostname === "app.supabase.com") {
    const match = parsed.pathname.match(/\/project\/([a-z0-9_-]+)/i);
    if (match?.[1]) {
      return { url: `https://${match[1]}.supabase.co` };
    }
    return {
      url: "",
      error:
        "URL yang dimasukkan adalah halaman dashboard supabase.com, bukan Project URL API. Ambil Project URL (format https://xxxx.supabase.co) dari Project Settings -> Data API.",
    };
  }

  return { url: parsed.origin };
}

function detectSupabaseKeyKind(key: string): "service_role" | "anon" | "sb_secret" | "sb_publishable" | "unknown" {
  if (key.startsWith("sb_secret_")) return "sb_secret";
  if (key.startsWith("sb_publishable_")) return "sb_publishable";
  const parts = key.split(".");
  if (parts.length === 3) {
    try {
      const payloadJson = Buffer.from(parts[1], "base64url").toString("utf8");
      const parsed = JSON.parse(payloadJson);
      if (parsed?.role === "service_role") return "service_role";
      if (parsed?.role === "anon") return "anon";
    } catch {
      // ignore decode error
    }
  }
  return "unknown";
}

function getSupabaseConfig(): { client: SupabaseClient | null; configError?: string; host?: string; keyKind?: string } {
  const rawUrl = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "").trim();
  const rawKey = (
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    ""
  )
    .trim()
    .replace(/^["']|["']$/g, "");

  if (!rawUrl || !rawKey || rawUrl.includes("YOUR_PROJECT_ID") || rawKey.includes("YOUR_SUPABASE")) {
    return { client: null };
  }
  if (rawKey.startsWith("http://") || rawKey.startsWith("https://")) {
    return {
      client: null,
      configError: "Nilai SUPABASE_SERVICE_ROLE_KEY berisi URL, bukan secret key.",
    };
  }

  const keyKind = detectSupabaseKeyKind(rawKey);
  if (keyKind === "anon" || keyKind === "sb_publishable") {
    return {
      client: null,
      keyKind,
      configError:
        "Kunci yang dimasukkan adalah anon/publishable key (kunci publik), bukan service_role / secret key. Ambil service_role key dari Supabase Project Settings -> API Keys.",
    };
  }

  const normalized = normalizeSupabaseUrl(rawUrl);
  if (normalized.error || !normalized.url) {
    return { client: null, keyKind, configError: normalized.error || "SUPABASE_URL tidak valid." };
  }

  const client = createClient(normalized.url, rawKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return { client, host: new URL(normalized.url).hostname, keyKind };
}

let cachedClient: SupabaseClient | null = null;
let cachedError: string | undefined;
let cachedHost: string | undefined;
let cachedKeyKind: string | undefined;
let cachedEnvSignature = "";

function getSupabaseState(): { client: SupabaseClient | null; configError?: string; host?: string; keyKind?: string } {
  const sig = `${process.env.SUPABASE_URL || ""}|${process.env.SUPABASE_SERVICE_ROLE_KEY || ""}|${process.env.SUPABASE_ANON_KEY || ""}`;
  if (sig !== cachedEnvSignature) {
    cachedEnvSignature = sig;
    const res = getSupabaseConfig();
    cachedClient = res.client;
    cachedError = res.configError;
    cachedHost = res.host;
    cachedKeyKind = res.keyKind;
  }
  return { client: cachedClient, configError: cachedError, host: cachedHost, keyKind: cachedKeyKind };
}

function supabase(): SupabaseClient | null {
  return getSupabaseState().client;
}

async function fetchAllRows(client: SupabaseClient, table: string): Promise<Array<{ id: string; payload: any }>> {
  const pageSize = 1000;
  let from = 0;
  const allRows: Array<{ id: string; payload: any }> = [];

  while (true) {
    const { data, error } = await client
      .from(table)
      .select("id, payload")
      .range(from, from + pageSize - 1);

    if (error) {
      throw new Error(`${table}: ${error.message}`);
    }

    const batch = (data || []) as Array<{ id: string; payload: any }>;
    allRows.push(...batch);
    if (batch.length < pageSize) break;
    from += pageSize;
  }

  return allRows;
}

function extractItems(rows: Array<{ id: string; payload: any }>): any[] {
  return rows.map((r) => {
    const p = r.payload && typeof r.payload === "object" ? r.payload : {};
    return { id: r.id, ...p };
  });
}

async function upsertInChunks(
  client: SupabaseClient,
  table: string,
  items: Array<{ id: string; payload: any }>
): Promise<void> {
  const chunkSize = 200;
  for (let i = 0; i < items.length; i += chunkSize) {
    const slice = items.slice(i, i + chunkSize).map((item) => ({
      id: item.id,
      payload: item.payload,
      updated_at: new Date().toISOString(),
    }));
    const { error } = await client.from(table).upsert(slice, { onConflict: "id" });
    if (error) {
      throw new Error(`${table} upsert: ${error.message}`);
    }
  }
}

async function deleteIdsInChunks(client: SupabaseClient, table: string, ids: string[]): Promise<void> {
  const cleanIds = ids.filter(Boolean);
  const chunkSize = 200;
  for (let i = 0; i < cleanIds.length; i += chunkSize) {
    const slice = cleanIds.slice(i, i + chunkSize);
    const { error } = await client.from(table).delete().in("id", slice);
    if (error) {
      throw new Error(`${table} delete: ${error.message}`);
    }
  }
}

const app = express();
app.use(express.json({ limit: "25mb" }));

// Health probe for Supabase backend
app.get("/api/db/health", async (_req, res) => {
  const { client, configError, host, keyKind } = getSupabaseState();
  if (configError) {
    return res.status(400).json({
      provider: "supabase",
      configured: true,
      ok: false,
      keyKind,
      message: configError,
    });
  }
  if (!client) {
    return res.json({
      provider: "supabase",
      configured: false,
      ok: false,
      message:
        "Tambahkan Environment Variable SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY di Settings Vercel, lalu Redeploy aplikasi.",
    });
  }

  try {
    const { error } = await client.from("konfigurasi").select("id").limit(1);
    if (error) {
      return res.status(500).json({
        provider: "supabase",
        configured: true,
        ok: false,
        host,
        keyKind,
        message: `Koneksi Supabase gagal (${error.message}). Pastikan Project URL benar (https://xxxx.supabase.co) dan skrip tabel SQL sudah dijalankan.`,
      });
    }
    return res.json({
      provider: "supabase",
      configured: true,
      ok: true,
      host,
      keyKind,
    });
  } catch (err: any) {
    return res.status(500).json({
      provider: "supabase",
      configured: true,
      ok: false,
      host,
      message: err?.message || "Gagal menghubungi server Supabase.",
    });
  }
});

// Bulk bootstrap endpoint
app.get("/api/db/bootstrap", async (req, res) => {
  const client = supabase();
  if (!client) {
    return res.status(503).json({ ok: false, error: "Supabase belum dikonfigurasi." });
  }

  const scope = String(req.query.scope || "staff");
  const nisn = String(req.query.nisn || "").trim();

  try {
    if (scope === "student") {
      const [jadwalRows, tokenRows, sessionRes] = await Promise.all([
        fetchAllRows(client, "jadwal_ujian"),
        fetchAllRows(client, "token_ujian"),
        nisn
          ? client.from("sessions").select("id, payload").eq("id", nisn).maybeSingle()
          : Promise.resolve({ data: null, error: null }),
      ]);

      if (sessionRes && "error" in sessionRes && sessionRes.error) {
        throw new Error(`sessions: ${sessionRes.error.message}`);
      }

      const mySession =
        sessionRes && "data" in sessionRes && sessionRes.data
          ? { id: sessionRes.data.id, ...(sessionRes.data.payload || {}) }
          : null;

      return res.json({
        ok: true,
        data: {
          jadwal: extractItems(jadwalRows),
          tokens: extractItems(tokenRows),
          mySession,
        },
      });
    }

    const keysToLoad =
      scope === "studentInit"
        ? ["kelas", "kelasAkademik", "mapel", "siswa", "soal", "jadwal", "tokens", "konfig"]
        : [...ALL_COLLECTION_KEYS];

    const entries = await Promise.all(
      keysToLoad.map(async (key) => {
        const table = TABLE_MAP[key];
        const rows = await fetchAllRows(client, table);
        if (key === "konfig") {
          const docRow = rows.find((r) => r.id === "sekolah") || rows[0];
          return [key, docRow ? docRow.payload : null] as const;
        }
        return [key, extractItems(rows)] as const;
      })
    );

    const data = Object.fromEntries(entries);
    return res.json({ ok: true, data });
  } catch (err: any) {
    return res.status(500).json({ ok: false, error: err?.message || "Gagal memuat data Supabase." });
  }
});

// Get single collection
app.get("/api/db/collection/:key", async (req, res) => {
  const client = supabase();
  if (!client) {
    return res.status(503).json({ ok: false, error: "Supabase belum dikonfigurasi." });
  }
  const table = TABLE_MAP[req.params.key];
  if (!table) {
    return res.status(400).json({ ok: false, error: `Koleksi tidak dikenal: ${req.params.key}` });
  }
  try {
    const rows = await fetchAllRows(client, table);
    if (table === "konfigurasi") {
      const docRow = rows.find((r) => r.id === "sekolah") || rows[0];
      return res.json({ ok: true, data: docRow ? docRow.payload : null });
    }
    return res.json({ ok: true, items: extractItems(rows) });
  } catch (err: any) {
    return res.status(500).json({ ok: false, error: err?.message || "Gagal membaca koleksi." });
  }
});

// Get single document
app.get("/api/db/doc/:key/:id", async (req, res) => {
  const client = supabase();
  if (!client) {
    return res.status(503).json({ ok: false, error: "Supabase belum dikonfigurasi." });
  }
  const table = TABLE_MAP[req.params.key];
  if (!table) {
    return res.status(400).json({ ok: false, error: `Koleksi tidak dikenal: ${req.params.key}` });
  }
  try {
    const { data, error } = await client
      .from(table)
      .select("id, payload")
      .eq("id", req.params.id)
      .maybeSingle();
    if (error) {
      throw new Error(`${table}/${req.params.id}: ${error.message}`);
    }
    const item = data ? { id: data.id, ...(data.payload || {}) } : null;
    return res.json({ ok: true, item });
  } catch (err: any) {
    return res.status(500).json({ ok: false, error: err?.message || "Gagal membaca dokumen." });
  }
});

// Sync collection changes
app.put("/api/db/collection/:key", async (req, res) => {
  const client = supabase();
  if (!client) {
    return res.status(503).json({ ok: false, error: "Supabase belum dikonfigurasi." });
  }
  const table = TABLE_MAP[req.params.key];
  if (!table) {
    return res.status(400).json({ ok: false, error: `Koleksi tidak dikenal: ${req.params.key}` });
  }

  try {
    const { upserts, deleteIds, items } = req.body || {};

    if (Array.isArray(upserts) || Array.isArray(deleteIds)) {
      const cleanDeletes = Array.isArray(deleteIds) ? deleteIds.map(String).filter(Boolean) : [];
      const cleanUpserts = Array.isArray(upserts)
        ? upserts
            .filter((item: any) => item && item.id)
            .map((item: any) => ({ id: String(item.id), payload: item }))
        : [];

      if (cleanDeletes.length > 0) {
        await deleteIdsInChunks(client, table, cleanDeletes);
      }
      if (cleanUpserts.length > 0) {
        await upsertInChunks(client, table, cleanUpserts);
      }
      return res.json({ ok: true });
    }

    if (Array.isArray(items)) {
      const cleanItems = items
        .filter((item: any) => item && item.id)
        .map((item: any) => ({ id: String(item.id), payload: item }));

      const incomingIdSet = new Set(cleanItems.map((i) => i.id));
      const { data: existingRows, error: listErr } = await client.from(table).select("id");
      if (listErr) {
        throw new Error(`${table} list: ${listErr.message}`);
      }
      const idsToDelete = (existingRows || [])
        .map((r: any) => String(r.id))
        .filter((id: string) => !incomingIdSet.has(id));

      if (idsToDelete.length > 0) {
        await deleteIdsInChunks(client, table, idsToDelete);
      }
      if (cleanItems.length > 0) {
        await upsertInChunks(client, table, cleanItems);
      }
      return res.json({ ok: true });
    }

    return res.status(400).json({ ok: false, error: "Payload sinkronisasi tidak valid." });
  } catch (err: any) {
    return res.status(500).json({ ok: false, error: err?.message || "Gagal menyimpan koleksi." });
  }
});

// Upsert single document
app.put("/api/db/doc/:key/:id", async (req, res) => {
  const client = supabase();
  if (!client) {
    return res.status(503).json({ ok: false, error: "Supabase belum dikonfigurasi." });
  }
  const table = TABLE_MAP[req.params.key];
  if (!table) {
    return res.status(400).json({ ok: false, error: `Koleksi tidak dikenal: ${req.params.key}` });
  }
  try {
    const payload = req.body?.item ?? req.body?.data ?? req.body;
    if (!payload || typeof payload !== "object") {
      return res.status(400).json({ ok: false, error: "Payload dokumen kosong." });
    }
    const docId = String(req.params.id);
    const { error } = await client.from(table).upsert(
      {
        id: docId,
        payload,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" }
    );
    if (error) {
      throw new Error(`${table}/${docId}: ${error.message}`);
    }
    return res.json({ ok: true });
  } catch (err: any) {
    return res.status(500).json({ ok: false, error: err?.message || "Gagal menyimpan dokumen." });
  }
});

// Batch delete documents
app.post("/api/db/doc/:key/batch-delete", async (req, res) => {
  const client = supabase();
  if (!client) {
    return res.status(503).json({ ok: false, error: "Supabase belum dikonfigurasi." });
  }
  const table = TABLE_MAP[req.params.key];
  if (!table) {
    return res.status(400).json({ ok: false, error: `Koleksi tidak dikenal: ${req.params.key}` });
  }
  try {
    const ids = Array.isArray(req.body?.ids) ? req.body.ids.map(String).filter(Boolean) : [];
    if (ids.length > 0) {
      await deleteIdsInChunks(client, table, ids);
    }
    return res.json({ ok: true });
  } catch (err: any) {
    return res.status(500).json({ ok: false, error: err?.message || "Gagal menghapus data." });
  }
});

// Delete single document
app.delete("/api/db/doc/:key/:id", async (req, res) => {
  const client = supabase();
  if (!client) {
    return res.status(503).json({ ok: false, error: "Supabase belum dikonfigurasi." });
  }
  const table = TABLE_MAP[req.params.key];
  if (!table) {
    return res.status(400).json({ ok: false, error: `Koleksi tidak dikenal: ${req.params.key}` });
  }
  try {
    const docId = String(req.params.id);
    const { error } = await client.from(table).delete().eq("id", docId);
    if (error) {
      throw new Error(`${table}/${docId}: ${error.message}`);
    }
    return res.json({ ok: true });
  } catch (err: any) {
    return res.status(500).json({ ok: false, error: err?.message || "Gagal menghapus dokumen." });
  }
});

// Clear entire collection
app.delete("/api/db/collection/:key", async (req, res) => {
  const client = supabase();
  if (!client) {
    return res.status(503).json({ ok: false, error: "Supabase belum dikonfigurasi." });
  }
  const table = TABLE_MAP[req.params.key];
  if (!table) {
    return res.status(400).json({ ok: false, error: `Koleksi tidak dikenal: ${req.params.key}` });
  }
  try {
    const { error } = await client.from(table).delete().neq("id", "__nonexistent_sentinel__");
    if (error) {
      throw new Error(`${table} clear: ${error.message}`);
    }
    return res.json({ ok: true });
  } catch (err: any) {
    return res.status(500).json({ ok: false, error: err?.message || "Gagal mengosongkan tabel." });
  }
});

export default app;
