import { JadwalUjian, KelasAkademik, Soal } from "../types";

export const SYSTEM_GURU_ID = "__SYSTEM__";

export function canonicalClassAlias(raw: string): string {
  if (!raw) return "";
  let s = raw.trim().toLowerCase().replace(/\s+/g, " ");
  s = s.replace(/\s*-\s*/g, "-");
  s = s.replace(/^kelas\s+/, "");
  // Convert numeric Indonesian MTs grade prefixes 7/8/9 to vii/viii/ix at token start
  s = s.replace(/^9(?=$|[\s\-])/, "ix");
  s = s.replace(/^8(?=$|[\s\-])/, "viii");
  s = s.replace(/^7(?=$|[\s\-])/, "vii");
  return s.trim();
}

export function getClassGradeLevel(nama: string): "VII" | "VIII" | "IX" | "Lainnya" {
  const upper = (nama || "").toUpperCase();
  if (/\bIX\b/.test(upper) || /\b9\b/.test(upper) || /\b9[A-Z]\b/.test(upper)) return "IX";
  if (/\bVIII\b/.test(upper) || /\b8\b/.test(upper) || /\b8[A-Z]\b/.test(upper)) return "VIII";
  if (/\bVII\b/.test(upper) || /\b7\b/.test(upper) || /\b7[A-Z]\b/.test(upper)) return "VII";
  return "Lainnya";
}

export function resolveKelasTokens(
  rawList: string[],
  kelasAkademik: KelasAkademik[]
): Set<string> {
  const tokens = new Set<string>();
  for (const raw of rawList) {
    if (!raw) continue;
    const lower = raw.trim().toLowerCase();
    const alias = canonicalClassAlias(raw);
    if (lower) tokens.add(lower);
    if (alias) tokens.add(alias);

    const matched = kelasAkademik.find(
      (ka) =>
        ka.id === raw ||
        ka.id.trim().toLowerCase() === lower ||
        ka.nama.trim().toLowerCase() === lower ||
        (alias && canonicalClassAlias(ka.nama) === alias)
    );
    if (matched) {
      tokens.add(matched.id.trim().toLowerCase());
      tokens.add(matched.nama.trim().toLowerCase());
      const kaAlias = canonicalClassAlias(matched.nama);
      if (kaAlias) tokens.add(kaAlias);
    }
  }
  return tokens;
}

export function normalizeSoalKelasIds(
  rawIds: string[] | undefined,
  kelasAkademik: KelasAkademik[]
): string[] {
  if (!rawIds || rawIds.length === 0) return [];
  const resolved = rawIds.map((raw) => {
    const lower = raw.trim().toLowerCase();
    const alias = canonicalClassAlias(raw);
    const found = kelasAkademik.find(
      (ka) =>
        ka.id === raw ||
        ka.id.trim().toLowerCase() === lower ||
        ka.nama.trim().toLowerCase() === lower ||
        (alias && canonicalClassAlias(ka.nama) === alias)
    );
    return found ? found.id : raw;
  });
  return Array.from(new Set(resolved));
}

export function isQuestionClassMatchForSchedule(
  soal: Soal,
  jad: JadwalUjian,
  kelasAkademik: KelasAkademik[]
): boolean {
  if (!jad.kelasIds || jad.kelasIds.length === 0) return true;
  if (!soal.kelasIds || soal.kelasIds.length === 0) return true;

  const qTokens = resolveKelasTokens(soal.kelasIds, kelasAkademik);
  const schedTokens = resolveKelasTokens(jad.kelasIds, kelasAkademik);

  for (const tok of qTokens) {
    if (schedTokens.has(tok)) return true;
  }
  return false;
}

export function filterQuestionsForJadwal(
  jad: JadwalUjian,
  allSoal: Soal[],
  kelasAkademik: KelasAkademik[],
  options?: {
    studentClassName?: string;
    studentClassId?: string;
    ignoreManualSoalIds?: boolean;
  }
): Soal[] {
  const mapelSoal = allSoal.filter((s) => s.mapelId === jad.mapelId);

  // Explicit manual selection override
  if (!options?.ignoreManualSoalIds && jad.soalIds && jad.soalIds.length > 0) {
    const manualSet = new Set(jad.soalIds);
    return mapelSoal.filter((s) => manualSet.has(s.id));
  }

  return mapelSoal.filter((s) => {
    // 1. Filter by selected guru(s) if configured on schedule
    if (jad.guruIds && jad.guruIds.length > 0) {
      const authorKey = s.guruId || SYSTEM_GURU_ID;
      if (!jad.guruIds.includes(authorKey)) return false;
    }

    // 2. General question (no class restrictions) applies to all
    if (!s.kelasIds || s.kelasIds.length === 0) return true;

    const qTokens = resolveKelasTokens(s.kelasIds, kelasAkademik);

    // 3a. Student-level matching
    if (options?.studentClassName || options?.studentClassId) {
      const studentInputs = [options.studentClassName || "", options.studentClassId || ""].filter(Boolean);
      const studentTokens = resolveKelasTokens(studentInputs, kelasAkademik);
      if (studentTokens.size > 0) {
        for (const tok of qTokens) {
          if (studentTokens.has(tok)) return true;
        }
        return false;
      }
    }

    // 3b. Schedule-level matching
    if (!jad.kelasIds || jad.kelasIds.length === 0) return true;
    const schedTokens = resolveKelasTokens(jad.kelasIds, kelasAkademik);
    for (const tok of qTokens) {
      if (schedTokens.has(tok)) return true;
    }
    return false;
  });
}

export function formatSoalKelasNames(
  rawIds: string[] | undefined,
  kelasAkademik: KelasAkademik[]
): string[] {
  if (!rawIds || rawIds.length === 0) return [];
  const names = rawIds.map((raw) => {
    const lower = raw.trim().toLowerCase();
    const alias = canonicalClassAlias(raw);
    const found = kelasAkademik.find(
      (ka) =>
        ka.id === raw ||
        ka.id.trim().toLowerCase() === lower ||
        ka.nama.trim().toLowerCase() === lower ||
        (alias && canonicalClassAlias(ka.nama) === alias)
    );
    return found ? found.nama : raw;
  });
  return Array.from(new Set(names));
}
