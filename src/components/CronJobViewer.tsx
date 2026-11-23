import React, { useState } from "react";
import { Check, Copy, Code } from "lucide-react";

export default function CronJobViewer() {
  const [copied, setCopied] = useState(false);

  const codeString = `/**
 * Firebase Cloud Function v2 (Cron Job)
 * File: functions/src/index.ts
 * 
 * Rotates a 6-digit random token every 7 minutes for each active subject exam.
 * Deploy with: firebase deploy --only functions
 */

import { onSchedule } from "firebase-functions/v2/scheduler";
import { logger } from "firebase-functions";
import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

initializeApp();
const db = getFirestore();

// Generates a random 6-digit number string
function generate6DigitToken(): string {
  const num = Math.floor(100000 + Math.random() * 900000);
  return num.toString();
}

/**
 * Scheduled Cloud Function running every 7 minutes
 * Syntax uses standard crontab timing: "*/7 * * * *"
 */
export const rotateExamTokens = onSchedule("*/7 * * * *", async (event) => {
  logger.info("Executing token rotating cron job...");

  const now = Date.now();
  const rotationPeriodMs = 7 * 60 * 1000; // 7 minutes
  const expiresAt = now + rotationPeriodMs;

  try {
    // 1. Fetch all scheduled exams that are active today
    const activeExamsSnapshot = await db.collection("jadwalUjian").get();
    
    if (activeExamsSnapshot.empty) {
      logger.info("No active exam schedules found.");
      return;
    }

    const batch = db.batch();

    // 2. Iterate through each active exam schedule and recreate/update its rotatable token
    for (const doc of activeExamsSnapshot.docs) {
      const exam = doc.data();
      const mapelId = exam.mapelId;
      
      // Let's grab mapel name
      const mapelDoc = await db.collection("mapel").doc(mapelId).get();
      const mapelNama = mapelDoc.exists ? mapelDoc.data()?.nama : "Mata Pelajaran";

      const tokenRef = db.collection("tokenUjian").doc(mapelId);
      const newToken = generate6DigitToken();

      batch.set(tokenRef, {
        id: mapelId,
        mapelNama: mapelNama,
        token: newToken,
        createdAt: now,
        expiresAt: expiresAt
      }, { merge: true });

      logger.info(\`Rotated token for subject \${mapelNama} (\${mapelId}): \${newToken}\`);
    }

    // 3. Commit the batch writes
    await batch.commit();
    logger.info("Token rotation batch committed successfully.");

  } catch (error) {
    logger.error("Error executing token rotation cron job:", error);
  }
});`;

  const handleCopy = () => {
    navigator.clipboard.writeText(codeString);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-slate-50 rounded-2xl p-5 border border-slate-200 text-slate-800 font-mono text-sm shadow-sm">
      <div className="flex justify-between items-center pb-3 border-b border-slate-200 mb-4 select-none">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse"></div>
          <span className="text-slate-700 font-sans font-bold text-xs flex items-center gap-1.5">
            <Code size={14} className="text-[#0666AE]" />
            Firebase Cloud Scheduler (Automated 7-Mins Token Rotator)
          </span>
        </div>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-600 hover:text-slate-900 text-xs font-sans font-bold rounded-xl border border-slate-200 cursor-pointer transition-colors shadow-sm"
        >
          {copied ? (
            <>
              <Check size={14} className="text-emerald-600" />
              <span>Copied!</span>
            </>
          ) : (
            <>
              <Copy size={13} />
              <span>Copy Code</span>
            </>
          )}
        </button>
      </div>

      {/* Code box remains high-fidelity obsidian styled for code-editing readability */}
      <div className="bg-[#0F172A] p-4 rounded-xl overflow-x-auto max-h-[380px] leading-relaxed text-xs text-indigo-300 shadow-inner">
        <pre className="whitespace-pre font-mono text-slate-200">{codeString}</pre>
      </div>

      <div className="mt-4 pt-3.5 border-t border-slate-200 text-slate-600 text-xs font-sans flex flex-col gap-1.5 leading-relaxed font-medium">
        <p className="font-bold text-slate-800">
          💡 Deskripsi Sistem Rotasi Scheduler:
        </p>
        <p>
          Script nirkabel (serverless) ini beroperasi penuh memanfaatkan Google Cloud Scheduler secara real-time berdasarkan format crontab standar{" "}
          <code className="bg-slate-200 text-slate-800 px-1.5 py-0.5 rounded font-mono font-bold">"*/7 * * * *"</code>. Setiap 7 menit, scheduler akan menilai seluruh jadwal aktif, memicu generator 6-digit numerik acak baru, lalu menulis ulang koleksi token. Klien Android Siswa dan Dewan Guru akan secara instan terupdate dengan data terbaru secara reaktif.
        </p>
      </div>
    </div>
  );
}
