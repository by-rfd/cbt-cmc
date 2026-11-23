import { getDB, setDB, syncSingleSession } from "../firebaseConfig";
import { HasilUjian, Mapel, SesiSiswa, Soal } from "../types";

export interface ForceSubmitOutcome {
  siswaNama: string;
  nilai: number;
  benar: number;
  salah: number;
  totalSoal: number;
}

/**
 * Forces a student's exam session to finish immediately ("Selesai")
 * and records an accurate score computed from their recorded answers (`jawabanSiswa`).
 */
export function executeForceSubmitSession(sessionTarget: SesiSiswa | any): ForceSubmitOutcome | null {
  if (!sessionTarget) return null;

  const allSessions: SesiSiswa[] = getDB.sessions();
  const existingIdx = allSessions.findIndex((s) => s.id === sessionTarget.id);
  const ses: SesiSiswa = existingIdx !== -1 ? allSessions[existingIdx] : sessionTarget;

  const allSoal = getDB.soal() as Soal[];
  const allMapel = getDB.mapel() as Mapel[];
  const matchedMapel = allMapel.find(
    (m) =>
      (ses.mapelId && m.id === ses.mapelId) ||
      m.nama.trim().toLowerCase() === (ses.mapelNama || "").trim().toLowerCase()
  );
  const resolvedMapelId = ses.mapelId || matchedMapel?.id || "";

  // Reconstruct exact ordered question list if questionIds was stored
  let orderedQuestions: Soal[] = [];
  if (ses.questionIds && ses.questionIds.length > 0) {
    const soalById = new Map(allSoal.map((q) => [q.id, q]));
    orderedQuestions = ses.questionIds
      .map((qId) => soalById.get(qId))
      .filter((q): q is Soal => Boolean(q));
  } else if (resolvedMapelId) {
    orderedQuestions = allSoal.filter((q) => q.mapelId === resolvedMapelId);
    if (ses.totalSoal && ses.totalSoal > 0 && orderedQuestions.length > ses.totalSoal) {
      orderedQuestions = orderedQuestions.slice(0, ses.totalSoal);
    }
  }

  const totalSoal = ses.totalSoal || orderedQuestions.length || 0;
  const answers = ses.jawabanSiswa || {};

  let benar = 0;
  if (orderedQuestions.length > 0) {
    orderedQuestions.forEach((q, idx) => {
      const ans = answers[idx];
      if (ans && ans === q.kunci) {
        benar++;
      }
    });
  }

  const denominator = totalSoal > 0 ? totalSoal : orderedQuestions.length;
  const salah = Math.max(0, denominator - benar);
  const nilai = denominator > 0 ? Math.round((benar / denominator) * 100) : 0;

  const resultRecord: HasilUjian = {
    id: `h_${ses.id}_${resolvedMapelId || "exam"}_${Date.now()}`,
    siswaNisn: ses.id,
    siswaNama: ses.siswaNama,
    siswaKelas: ses.siswaKelas,
    mapelId: resolvedMapelId || undefined,
    mapelNama: ses.mapelNama || matchedMapel?.nama || "Ujian Utama",
    totalSoal: denominator,
    benar,
    salah,
    nilai,
    tanggalSelesai: new Date().toLocaleString("id-ID"),
    status: "Selesai",
  };

  // Replace any older result for this student + mapel so there are no duplicate rows
  const prevHasil: HasilUjian[] = getDB.hasil();
  const nextHasil = prevHasil.filter(
    (h) =>
      !(
        (h.siswaNisn === ses.id ||
          (h.siswaNama || "").trim().toLowerCase() === (ses.siswaNama || "").trim().toLowerCase()) &&
        (h.mapelNama || "").trim().toLowerCase() === (resultRecord.mapelNama || "").trim().toLowerCase()
      )
  );
  nextHasil.push(resultRecord);
  setDB.hasil(nextHasil);

  const updatedSession: SesiSiswa = {
    ...ses,
    mapelId: resolvedMapelId || ses.mapelId,
    status: "Selesai",
    lastUpdated: new Date().toISOString(),
  };

  syncSingleSession(updatedSession);

  return {
    siswaNama: ses.siswaNama,
    nilai,
    benar,
    salah,
    totalSoal: denominator,
  };
}

/**
 * Completely resets a student's exam session and removes any prior result for that subject,
 * so the student immediately restarts from the beginning on their device.
 */
export async function executeResetStudentSession(sessionTarget: SesiSiswa | any): Promise<void> {
  if (!sessionTarget) return;

  // 1. Delete matching HasilUjian entries (so unified monitor & student select-exam do not remain "Selesai")
  const allHasil: HasilUjian[] = getDB.hasil();
  const targetNisn = sessionTarget.id;
  const targetNameLower = (sessionTarget.siswaNama || "").trim().toLowerCase();
  const targetMapelLower = (sessionTarget.mapelNama || "").trim().toLowerCase();

  const matchingHasilIds = allHasil
    .filter((h) => {
      if (sessionTarget.hasilDocId && h.id === sessionTarget.hasilDocId) return true;
      const sameStudent =
        (h.siswaNisn && h.siswaNisn === targetNisn) ||
        (targetNameLower && (h.siswaNama || "").trim().toLowerCase() === targetNameLower);
      if (!sameStudent) return false;
      if (!targetMapelLower) return true;
      return (h.mapelNama || "").trim().toLowerCase() === targetMapelLower;
    })
    .map((h) => h.id);

  if (matchingHasilIds.length > 0) {
    await setDB.deleteSelectedHasil(matchingHasilIds, allHasil);
  }

  // 2. Delete SesiSiswa permanently from local + Cloud Firestore
  await setDB.deleteSession(targetNisn);
}
