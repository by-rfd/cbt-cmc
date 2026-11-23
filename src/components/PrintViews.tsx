import React, { useState, useMemo, useRef, useEffect } from "react";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import QRCode from "qrcode";
import { Siswa, Kelas, KelasAkademik, KonfigurasiSekolah, Mapel, Pengawas } from "../types";
import {
  Printer,
  Download,
  X,
  FileText,
  BadgeInfo,
  Check,
  CheckSquare,
  Square,
  Filter,
  Search,
  Eye,
  Users,
  Scissors,
  Layers,
  Sparkles,
  Loader2,
  Calendar,
  Clock,
  UserCheck,
} from "lucide-react";

// ----------------------------------------------------------------------------
// HELPER: Inline High-Resolution QR Code Component (No External Network Required)
// ----------------------------------------------------------------------------
const LocalQRCode: React.FC<{
  value: string;
  size: number;
  className?: string;
}> = ({ value, size, className = "" }) => {
  const [dataUrl, setDataUrl] = useState<string>("");

  useEffect(() => {
    let isMounted = true;
    QRCode.toDataURL(value, {
      width: size * 3, // 3x scale for ultra crisp print quality
      margin: 1,
      errorCorrectionLevel: "M",
      color: {
        dark: "#0f172a",
        light: "#ffffff",
      },
    })
      .then((url) => {
        if (isMounted) setDataUrl(url);
      })
      .catch((err) => {
        console.error("QR Code generation error:", err);
      });

    return () => {
      isMounted = false;
    };
  }, [value, size]);

  if (!dataUrl) {
    return (
      <div
        style={{ width: size, height: size }}
        className={`bg-slate-100 flex items-center justify-center text-[8px] text-slate-400 font-mono rounded ${className}`}
      >
        QR...
      </div>
    );
  }

  return (
    <img
      src={dataUrl}
      alt="QR Code Login"
      style={{ width: size, height: size }}
      className={`object-contain block ${className}`}
    />
  );
};

// ----------------------------------------------------------------------------
// HELPER: Chunk array into pages of N items
// ----------------------------------------------------------------------------
function chunkArray<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

// ----------------------------------------------------------------------------
// PRINT CARDS COMPONENT (A4 - 8 KARTU ATAU 10 KARTU PER HALAMAN)
// ----------------------------------------------------------------------------
interface PrintCardsProps {
  siswaList: Siswa[];
  kelasList: Kelas[];
  kelasAkademikList?: KelasAkademik[];
  konfig: KonfigurasiSekolah;
  onClose: () => void;
}

export function PrintCards({
  siswaList,
  kelasList,
  kelasAkademikList = [],
  konfig,
  onClose,
}: PrintCardsProps) {
  const printAreaRef = useRef<HTMLDivElement>(null);

  // Layout mode: 8 kartu (2x4) atau 10 kartu (2x5) per lembar A4
  const [cardsPerPage, setCardsPerPage] = useState<8 | 10>(8);

  // Selection & Filter State
  const [selectedKelas, setSelectedKelas] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [activeTab, setActiveTab] = useState<"preview" | "selection">("preview");

  // Multi-select state: IDs of selected students (default: all students selected)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => {
    return new Set(siswaList.map((s) => s.id));
  });

  // PDF Generation progress
  const [isExportingPdf, setIsExportingPdf] = useState<boolean>(false);
  const [exportProgress, setExportProgress] = useState<string>("");

  // Get all unique class names across data
  const availableClasses = useMemo(() => {
    const set = new Set<string>();
    kelasList.forEach((k) => k.nama && set.add(k.nama));
    kelasAkademikList.forEach((ka) => ka.nama && set.add(ka.nama));
    siswaList.forEach((s) => s.kelas && set.add(s.kelas));
    return Array.from(set).sort();
  }, [kelasList, kelasAkademikList, siswaList]);

  // Map kelasId to display name
  const getKelasNama = (kelasId: string, fallbackKelas?: string) => {
    const k = kelasList.find((item) => item.id === kelasId);
    return k?.nama || fallbackKelas || "Umum";
  };

  // Filter students based on selectedKelas and searchQuery
  const filteredSiswa = useMemo(() => {
    return siswaList.filter((siswa) => {
      // Class filter
      if (selectedKelas !== "all") {
        const matchesClass =
          siswa.kelas === selectedKelas ||
          siswa.kelasId === selectedKelas ||
          kelasList.find((k) => k.id === siswa.kelasId)?.nama === selectedKelas;
        if (!matchesClass) return false;
      }

      // Search filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesQuery =
          siswa.nama.toLowerCase().includes(q) ||
          siswa.nisn.toLowerCase().includes(q) ||
          (siswa.noPeserta && siswa.noPeserta.toLowerCase().includes(q)) ||
          siswa.username.toLowerCase().includes(q);
        if (!matchesQuery) return false;
      }

      return true;
    });
  }, [siswaList, selectedKelas, searchQuery, kelasList]);

  // Actual selected students to render/print (subset of filtered or total selected)
  const printableSiswa = useMemo(() => {
    return siswaList.filter((s) => selectedIds.has(s.id));
  }, [siswaList, selectedIds]);

  // Chunks of students per A4 page
  const pages = useMemo(() => {
    return chunkArray(printableSiswa, cardsPerPage);
  }, [printableSiswa, cardsPerPage]);

  // Selection handlers
  const handleToggleSelectAllFiltered = () => {
    const next = new Set(selectedIds);
    const allFilteredSelected = filteredSiswa.every((s) => next.has(s.id));

    if (allFilteredSelected) {
      // Deselect all filtered
      filteredSiswa.forEach((s) => next.delete(s.id));
    } else {
      // Select all filtered
      filteredSiswa.forEach((s) => next.add(s.id));
    }
    setSelectedIds(next);
  };

  const handleToggleSingle = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedIds(next);
  };

  const handleSelectAllTotal = () => {
    setSelectedIds(new Set(siswaList.map((s) => s.id)));
  };

  const handleDeselectAll = () => {
    setSelectedIds(new Set());
  };

  // Direct A4 PDF Generation using jsPDF & html2canvas
  const handleDownloadPDF = async () => {
    if (printableSiswa.length === 0) {
      alert("Pilih minimal 1 siswa untuk membuat PDF Kartu Ujian.");
      return;
    }

    if (!printAreaRef.current) return;
    const pageNodes = printAreaRef.current.querySelectorAll<HTMLElement>(".a4-sheet-container");
    if (!pageNodes || pageNodes.length === 0) return;

    try {
      setIsExportingPdf(true);
      const totalPages = pageNodes.length;

      // Create PDF in A4 portrait (210 x 297 mm)
      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
        compress: true,
      });

      for (let i = 0; i < totalPages; i++) {
        setExportProgress(`Memproses Lembar ${i + 1} dari ${totalPages}...`);
        const pageEl = pageNodes[i];

        const canvas = await html2canvas(pageEl, {
          scale: 2, // 2x scale for sharp text and QR codes
          useCORS: true,
          logging: false,
          backgroundColor: "#ffffff",
          windowWidth: 1024,
        });

        const imgData = canvas.toDataURL("image/jpeg", 0.95);
        if (i > 0) {
          pdf.addPage("a4", "portrait");
        }
        pdf.addImage(imgData, "JPEG", 0, 0, 210, 297, undefined, "FAST");
      }

      const kelasLabel = selectedKelas === "all" ? "Semua_Kelas" : selectedKelas.replace(/\s+/g, "_");
      const fileName = `Kartu_Ujian_A4_${cardsPerPage}Kartu_${kelasLabel}_${new Date().toISOString().split("T")[0]}.pdf`;
      pdf.save(fileName);
      setExportProgress("Selesai!");
    } catch (err) {
      console.error("Gagal export PDF:", err);
      alert("Terjadi kendala saat membuat file PDF. Silakan coba gunakan tombol Cetak Browser (Simpan sebagai PDF).");
    } finally {
      setIsExportingPdf(false);
      setExportProgress("");
    }
  };

  // Native Browser Print (A4 with exact CSS rules)
  const handleBrowserPrint = () => {
    if (printableSiswa.length === 0) {
      alert("Pilih minimal 1 siswa untuk mencetak kartu ujian.");
      return;
    }
    // Switch to preview tab so print nodes are active in DOM
    setActiveTab("preview");
    setTimeout(() => {
      window.print();
    }, 150);
  };

  return (
    <div id="print-modal-portal" className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-sm flex flex-col items-center justify-start p-2 sm:p-4 overflow-hidden">
      {/* Print CSS Injection */}
      <style>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 6mm 6mm 6mm 6mm;
          }
          body {
            visibility: hidden !important;
            background: white !important;
          }
          #print-modal-portal, #print-modal-portal * {
            visibility: visible !important;
          }
          #print-modal-portal {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            background: white !important;
            padding: 0 !important;
            margin: 0 !important;
            overflow: visible !important;
          }
          .no-print {
            display: none !important;
          }
          .a4-sheet-container {
            width: 200mm !important;
            min-height: 285mm !important;
            max-height: 285mm !important;
            margin: 0 auto !important;
            padding: 0 !important;
            page-break-after: always !important;
            break-after: page !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            box-shadow: none !important;
            border: none !important;
            background: white !important;
          }
        }
      `}</style>

      {/* Main Container */}
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl max-h-[96vh] flex flex-col overflow-hidden border border-slate-200">
        {/* Top Header Bar */}
        <div className="no-print p-4 bg-gradient-to-r from-[#0666AE] to-[#044a80] text-white flex flex-wrap justify-between items-center gap-3 border-b border-sky-800">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/10 rounded-xl">
              <Printer size={22} className="text-sky-200" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-base sm:text-lg">Cetak Kartu Ujian Siswa (Format A4)</h3>
                <span className="px-2 py-0.5 bg-sky-400/20 text-sky-100 border border-sky-300/30 rounded-full text-[11px] font-bold">
                  Standar A4 (210 × 297 mm)
                </span>
              </div>
              <p className="text-xs text-sky-100/80 font-medium">
                Pilih format 8 kartu atau 10 kartu per halaman • Dilengkapi QR Code login & garis potong
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Download PDF button */}
            <button
              onClick={handleDownloadPDF}
              disabled={isExportingPdf || printableSiswa.length === 0}
              className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-800/50 text-white rounded-xl text-xs font-bold flex items-center gap-2 transition shadow-sm cursor-pointer disabled:cursor-not-allowed"
              title="Unduh file dokumen PDF A4 langsung ke perangkat Anda"
            >
              {isExportingPdf ? (
                <>
                  <Loader2 size={16} className="animate-spin text-white" />
                  <span>{exportProgress || "Membuat PDF..."}</span>
                </>
              ) : (
                <>
                  <Download size={16} />
                  <span>Unduh File PDF</span>
                </>
              )}
            </button>

            {/* Browser Print button */}
            <button
              onClick={handleBrowserPrint}
              disabled={isExportingPdf || printableSiswa.length === 0}
              className="px-3.5 py-2 bg-amber-500 hover:bg-amber-400 disabled:bg-amber-700/50 text-slate-950 font-black rounded-xl text-xs flex items-center gap-1.5 transition shadow-sm cursor-pointer disabled:cursor-not-allowed"
              title="Cetak langsung atau simpan sebagai PDF dari menu browser"
            >
              <Printer size={16} />
              <span>Cetak / Simpan PDF</span>
            </button>

            {/* Close button */}
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/20 rounded-xl transition text-white/90 hover:text-white cursor-pointer ml-1"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Toolbar & Filter Bar */}
        <div className="no-print p-3 sm:p-4 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
          {/* Left Controls: Class selector, Search, and Mode toggle */}
          <div className="flex flex-wrap items-center gap-2 sm:gap-3 flex-1 min-w-[300px]">
            {/* Filter Kelas */}
            <div className="flex items-center gap-1.5 bg-white border border-slate-300 rounded-xl px-2.5 py-1.5 shadow-xs">
              <Filter size={14} className="text-slate-500" />
              <label className="text-[10px] font-black text-slate-500 uppercase">Kelas:</label>
              <select
                value={selectedKelas}
                onChange={(e) => setSelectedKelas(e.target.value)}
                className="bg-transparent font-bold text-slate-800 text-xs focus:outline-none cursor-pointer"
              >
                <option value="all">Semua Kelas ({siswaList.length})</option>
                {availableClasses.map((cls) => {
                  const count = siswaList.filter(
                    (s) =>
                      s.kelas === cls ||
                      s.kelasId === cls ||
                      kelasList.find((k) => k.id === s.kelasId)?.nama === cls
                  ).length;
                  return (
                    <option key={cls} value={cls}>
                      {cls} ({count} siswa)
                    </option>
                  );
                })}
              </select>
            </div>

            {/* Search Input */}
            <div className="relative flex-1 min-w-[180px] max-w-xs">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari nama, NISN, no peserta..."
                className="w-full pl-8 pr-2.5 py-1.5 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#0666AE]"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X size={12} />
                </button>
              )}
            </div>

            {/* Mode 8 Kartu vs 10 Kartu per Lembar A4 */}
            <div className="flex items-center bg-slate-200/80 p-0.5 rounded-xl border border-slate-300">
              <button
                onClick={() => setCardsPerPage(8)}
                className={`px-3 py-1.5 rounded-lg text-xs font-black transition flex items-center gap-1.5 cursor-pointer ${
                  cardsPerPage === 8
                    ? "bg-[#0666AE] text-white shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <Layers size={13} />
                <span>8 Kartu / Lembar A4</span>
              </button>
              <button
                onClick={() => setCardsPerPage(10)}
                className={`px-3 py-1.5 rounded-lg text-xs font-black transition flex items-center gap-1.5 cursor-pointer ${
                  cardsPerPage === 10
                    ? "bg-[#0666AE] text-white shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <Sparkles size={13} />
                <span>10 Kartu / Lembar A4</span>
              </button>
            </div>
          </div>

          {/* Right Controls: Tab Switcher & Selection Summary */}
          <div className="flex items-center gap-2">
            <div className="flex bg-slate-200/80 p-0.5 rounded-xl border border-slate-300">
              <button
                onClick={() => setActiveTab("preview")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                  activeTab === "preview"
                    ? "bg-white text-slate-800 shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <Eye size={13} />
                <span>Preview A4 ({pages.length} Lembar)</span>
              </button>
              <button
                onClick={() => setActiveTab("selection")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                  activeTab === "selection"
                    ? "bg-white text-slate-800 shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <Users size={13} />
                <span>Pilih Siswa ({selectedIds.size})</span>
              </button>
            </div>
          </div>
        </div>

        {/* Selection Status Banner */}
        <div className="no-print bg-sky-50/80 border-b border-sky-100 px-4 py-2 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2 text-slate-700">
            <BadgeInfo size={15} className="text-[#0666AE] shrink-0" />
            <span>
              <strong>{printableSiswa.length} Siswa Terpilih</strong> untuk dicetak (Total:{" "}
              <strong>{pages.length} Lembar A4</strong> dalam mode <strong>{cardsPerPage} kartu/lembar</strong>)
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleToggleSelectAllFiltered}
              className="px-2.5 py-1 bg-white hover:bg-slate-100 border border-slate-300 rounded-lg text-slate-700 font-bold text-[11px] transition cursor-pointer"
            >
              {filteredSiswa.every((s) => selectedIds.has(s.id))
                ? "Batal Pilih Hasil Filter"
                : `Pilih Semua Terfilter (${filteredSiswa.length})`}
            </button>
            <button
              onClick={handleSelectAllTotal}
              className="px-2.5 py-1 bg-white hover:bg-slate-100 border border-slate-300 rounded-lg text-[#0666AE] font-bold text-[11px] transition cursor-pointer"
            >
              Pilih Semua Siswa ({siswaList.length})
            </button>
            <button
              onClick={handleDeselectAll}
              className="px-2.5 py-1 bg-white hover:bg-slate-100 border border-slate-300 rounded-lg text-red-600 font-bold text-[11px] transition cursor-pointer"
            >
              Kosongkan Pilihan
            </button>
          </div>
        </div>

        {/* Modal Body: Switch between Selection View and A4 Preview */}
        <div className="flex-1 overflow-y-auto bg-slate-200/70 p-3 sm:p-6 text-slate-800">
          {/* TAB 1: SELECTION CHECKLIST TABLE */}
          {activeTab === "selection" && (
            <div className="no-print max-w-4xl mx-auto bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="p-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
                <div>
                  <h4 className="font-extrabold text-slate-800 text-sm">
                    Daftar Ceklis Siswa ({filteredSiswa.length} ditampilkan)
                  </h4>
                  <p className="text-[11px] text-slate-500">
                    Beri centang pada siswa yang ingin dicetak kartu ujiannya. Anda dapat memilih per kelas atau satu per satu.
                  </p>
                </div>
                <button
                  onClick={() => setActiveTab("preview")}
                  className="px-3 py-1.5 bg-[#0666AE] hover:bg-[#0666AE]/90 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
                >
                  <Eye size={14} />
                  <span>Lihat Preview A4</span>
                </button>
              </div>

              <div className="max-h-[58vh] overflow-y-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-100 text-slate-600 font-extrabold sticky top-0 z-10 border-b border-slate-200">
                    <tr>
                      <th className="p-3 w-12 text-center">
                        <input
                          type="checkbox"
                          checked={filteredSiswa.length > 0 && filteredSiswa.every((s) => selectedIds.has(s.id))}
                          onChange={handleToggleSelectAllFiltered}
                          className="w-4 h-4 rounded text-[#0666AE] cursor-pointer"
                        />
                      </th>
                      <th className="p-3 w-12 text-center">No</th>
                      <th className="p-3">Nama Lengkap Siswa</th>
                      <th className="p-3">NISN</th>
                      <th className="p-3">Kelas</th>
                      <th className="p-3">No. Peserta</th>
                      <th className="p-3">Username</th>
                      <th className="p-3 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredSiswa.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="p-8 text-center text-slate-400 italic">
                          Tidak ada siswa yang sesuai dengan filter pencarian.
                        </td>
                      </tr>
                    ) : (
                      filteredSiswa.map((siswa, idx) => {
                        const isChecked = selectedIds.has(siswa.id);
                        return (
                          <tr
                            key={siswa.id}
                            onClick={() => handleToggleSingle(siswa.id)}
                            className={`cursor-pointer transition hover:bg-sky-50/50 ${
                              isChecked ? "bg-sky-50/30" : ""
                            }`}
                          >
                            <td className="p-3 text-center" onClick={(e) => e.stopPropagation()}>
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => handleToggleSingle(siswa.id)}
                                className="w-4 h-4 rounded text-[#0666AE] cursor-pointer"
                              />
                            </td>
                            <td className="p-3 text-center text-slate-500 font-mono">{idx + 1}</td>
                            <td className="p-3 font-bold text-slate-800">{siswa.nama}</td>
                            <td className="p-3 font-mono text-slate-600">{siswa.nisn}</td>
                            <td className="p-3">
                              <span className="px-2 py-0.5 bg-slate-100 text-slate-700 font-bold rounded text-[11px]">
                                {siswa.kelas || getKelasNama(siswa.kelasId)}
                              </span>
                            </td>
                            <td className="p-3 font-mono text-slate-700">{siswa.noPeserta || "-"}</td>
                            <td className="p-3 font-mono text-[#0666AE]">{siswa.username}</td>
                            <td className="p-3 text-center">
                              {isChecked ? (
                                <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 font-bold rounded text-[10px]">
                                  Dicetak
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 bg-slate-100 text-slate-400 font-medium rounded text-[10px]">
                                  Dilewati
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 2: A4 PRINT PREVIEW (EXACT A4 SHEETS) */}
          <div
            ref={printAreaRef}
            className={`${activeTab === "selection" ? "hidden" : "flex"} flex-col items-center gap-8`}
          >
            {pages.length === 0 ? (
              <div className="bg-white p-12 rounded-2xl shadow-sm text-center max-w-md mx-auto my-8 border border-slate-200">
                <Users size={40} className="mx-auto text-slate-300 mb-3" />
                <h4 className="font-extrabold text-slate-700 text-base">Tidak Ada Siswa Terpilih</h4>
                <p className="text-xs text-slate-500 mt-1 mb-4">
                  Silakan pilih minimal 1 siswa pada tab 'Pilih Siswa' atau klik tombol di bawah untuk mencetak seluruh siswa.
                </p>
                <button
                  onClick={handleSelectAllTotal}
                  className="px-4 py-2 bg-[#0666AE] hover:bg-[#0666AE]/90 text-white rounded-xl text-xs font-bold transition cursor-pointer"
                >
                  Pilih Semua Siswa ({siswaList.length})
                </button>
              </div>
            ) : (
              pages.map((pageSiswa, pageIdx) => (
                <div
                  key={`page-${pageIdx}`}
                  className="a4-sheet-container bg-white shadow-xl rounded-md relative flex flex-col justify-between"
                  style={{
                    width: "210mm",
                    minHeight: "297mm",
                    maxHeight: "297mm",
                    padding: "7mm 6mm 6mm 6mm",
                    boxSizing: "border-box",
                    margin: "0 auto",
                    pageBreakAfter: "always",
                    breakAfter: "page",
                  }}
                >
                  {/* Page Indicator Tag for On-Screen Preview */}
                  <div className="no-print absolute -top-5 left-0 right-0 flex justify-between text-[11px] font-bold text-slate-500 px-1">
                    <span>
                      Halaman A4: {pageIdx + 1} dari {pages.length}
                    </span>
                    <span>
                      {cardsPerPage === 8 ? "Format 8 Kartu (2 × 4)" : "Format 10 Kartu (2 × 5)"} • {pageSiswa.length} Kartu
                    </span>
                  </div>

                  {/* Cards Grid */}
                  <div
                    className={`grid grid-cols-2 ${
                      cardsPerPage === 8 ? "gap-2.5" : "gap-1.5"
                    } w-full h-full content-start`}
                  >
                    {pageSiswa.map((siswa) => {
                      const credentials = JSON.stringify({
                        u: siswa.username,
                        p: siswa.password || "Password123",
                      });

                      const kelasDisplay = siswa.kelas || getKelasNama(siswa.kelasId);

                      // MODE 8 KARTU (2 Kolom x 4 Baris): Lega, Tinggi ~66mm
                      if (cardsPerPage === 8) {
                        return (
                          <div
                            key={siswa.id}
                            style={{
                              height: "66.5mm",
                              boxSizing: "border-box",
                              pageBreakInside: "avoid",
                              breakInside: "avoid",
                            }}
                            className="border border-dashed border-slate-350 rounded-xl p-2.5 bg-white relative flex flex-col justify-between shadow-2xs hover:border-[#0666AE]/60 transition"
                          >
                            {/* Cutting guide icon indicator */}
                            <div className="absolute -top-1.5 -left-1.5 text-slate-400 select-none">
                              <Scissors size={10} className="transform rotate-90" />
                            </div>

                            {/* Card Header Kop */}
                            <div className="flex items-center justify-between gap-1.5 pb-1 border-b border-slate-200">
                              {konfig.logoKiriUrl ? (
                                <img
                                  src={konfig.logoKiriUrl}
                                  alt="Logo Kiri"
                                  className="h-7 w-7 object-contain rounded"
                                  referrerPolicy="no-referrer"
                                />
                              ) : (
                                <div className="h-7 w-7 bg-sky-100 rounded flex items-center justify-center text-[9px] font-bold text-[#0666AE]">
                                  MTs
                                </div>
                              )}
                              <div className="text-center flex-1 leading-tight px-1">
                                <h4 className="text-[10px] font-black uppercase text-slate-800 line-clamp-1 tracking-tight">
                                  {konfig.namaSekolah || "MTs. AL-MA'SUM II CIMUNCANG"}
                                </h4>
                                <p className="text-[8.5px] font-extrabold text-[#0666AE] tracking-wide">
                                  KARTU PESERTA ASESMEN / UJIAN CBT
                                </p>
                              </div>
                              {konfig.logoKananUrl ? (
                                <img
                                  src={konfig.logoKananUrl}
                                  alt="Logo Kanan"
                                  className="h-7 w-7 object-contain rounded"
                                  referrerPolicy="no-referrer"
                                />
                              ) : (
                                <div className="h-7 w-7 opacity-0" />
                              )}
                            </div>

                            {/* Card Body */}
                            <div className="flex items-center gap-2.5 my-auto">
                              {/* Left: QR Code */}
                              <div className="flex flex-col items-center bg-slate-50 border border-slate-200 rounded-lg p-1 shrink-0">
                                <LocalQRCode value={credentials} size={70} />
                                <span className="text-[7.5px] text-[#0666AE] font-mono font-black mt-0.5 tracking-tight">
                                  SCAN LOGIN
                                </span>
                              </div>

                              {/* Right: Biodata Detail */}
                              <div className="flex-1 min-w-0 text-left space-y-0.5">
                                <div>
                                  <span className="text-[7.5px] font-bold text-slate-400 uppercase block leading-none">
                                    NAMA LENGKAP
                                  </span>
                                  <span className="text-[11px] font-black text-slate-900 block truncate leading-tight">
                                    {siswa.nama}
                                  </span>
                                </div>

                                <div className="grid grid-cols-2 gap-1 pt-0.5">
                                  <div>
                                    <span className="text-[7px] font-bold text-slate-400 uppercase block leading-none">
                                      NISN
                                    </span>
                                    <span className="text-[9.5px] font-mono font-bold text-slate-800 block leading-tight">
                                      {siswa.nisn || "-"}
                                    </span>
                                  </div>
                                  <div>
                                    <span className="text-[7px] font-bold text-slate-400 uppercase block leading-none">
                                      KELAS
                                    </span>
                                    <span className="text-[9.5px] font-extrabold text-[#0666AE] block leading-tight truncate">
                                      {kelasDisplay}
                                    </span>
                                  </div>
                                </div>

                                {siswa.noPeserta && (
                                  <div>
                                    <span className="text-[7px] font-bold text-slate-400 uppercase block leading-none">
                                      NO. PESERTA
                                    </span>
                                    <span className="text-[9.5px] font-mono font-bold text-slate-700 block leading-tight">
                                      {siswa.noPeserta}
                                    </span>
                                  </div>
                                )}

                                {/* Credentials Box */}
                                <div className="pt-1 flex gap-1.5">
                                  <div className="flex-1 bg-sky-50 border border-sky-100 rounded px-1.5 py-0.5">
                                    <span className="text-[6.5px] font-extrabold text-sky-700 uppercase block leading-none">
                                      USER
                                    </span>
                                    <span className="text-[9px] font-mono font-black text-[#0666AE] block truncate">
                                      {siswa.username}
                                    </span>
                                  </div>
                                  <div className="flex-1 bg-slate-100 border border-slate-200 rounded px-1.5 py-0.5">
                                    <span className="text-[6.5px] font-extrabold text-slate-500 uppercase block leading-none">
                                      PASS
                                    </span>
                                    <span className="text-[9px] font-mono font-black text-slate-800 block truncate">
                                      {siswa.password || "Password123"}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            </div>

                            {/* Card Footer */}
                            <div className="pt-0.5 border-t border-slate-150 text-[7px] text-slate-400 text-center italic leading-tight">
                              Simpan kartu ujian ini baik-baik selama pelaksanaan ujian berlangsung.
                            </div>
                          </div>
                        );
                      }

                      // MODE 10 KARTU (2 Kolom x 5 Baris): Kompak, Hemat Kertas, Tinggi ~52.5mm
                      return (
                        <div
                          key={siswa.id}
                          style={{
                            height: "52.8mm",
                            boxSizing: "border-box",
                            pageBreakInside: "avoid",
                            breakInside: "avoid",
                          }}
                          className="border border-dashed border-slate-350 rounded-lg p-2 bg-white relative flex flex-col justify-between shadow-2xs hover:border-[#0666AE]/60 transition"
                        >
                          {/* Cutting guide icon indicator */}
                          <div className="absolute -top-1.5 -left-1.5 text-slate-400 select-none">
                            <Scissors size={9} className="transform rotate-90" />
                          </div>

                          {/* Header Mini */}
                          <div className="flex items-center justify-between gap-1 pb-0.5 border-b border-slate-200">
                            {konfig.logoKiriUrl && (
                              <img
                                src={konfig.logoKiriUrl}
                                alt="Logo Kiri"
                                className="h-5 w-5 object-contain rounded"
                                referrerPolicy="no-referrer"
                              />
                            )}
                            <div className="text-center flex-1 px-1 leading-none">
                              <h5 className="text-[8.5px] font-black uppercase text-slate-800 truncate">
                                {konfig.namaSekolah || "MTs. AL-MA'SUM II CIMUNCANG"}
                              </h5>
                              <p className="text-[7.5px] font-extrabold text-[#0666AE] mt-0.5">
                                KARTU PESERTA UJIAN CBT
                              </p>
                            </div>
                            {konfig.logoKananUrl && (
                              <img
                                src={konfig.logoKananUrl}
                                alt="Logo Kanan"
                                className="h-5 w-5 object-contain rounded"
                                referrerPolicy="no-referrer"
                              />
                            )}
                          </div>

                          {/* Body Mini */}
                          <div className="flex items-center gap-2 my-auto">
                            {/* QR Code Mini */}
                            <div className="flex flex-col items-center bg-slate-50 border border-slate-200 rounded p-0.5 shrink-0">
                              <LocalQRCode value={credentials} size={54} />
                              <span className="text-[6.5px] text-[#0666AE] font-mono font-black mt-0.5">
                                SCAN
                              </span>
                            </div>

                            {/* Details Mini */}
                            <div className="flex-1 min-w-0 text-left space-y-0.5">
                              <div>
                                <span className="text-[10px] font-black text-slate-900 block truncate leading-tight">
                                  {siswa.nama}
                                </span>
                                <span className="text-[8px] font-semibold text-slate-600 block leading-tight">
                                  NISN: {siswa.nisn || "-"} •{" "}
                                  <span className="font-extrabold text-[#0666AE]">{kelasDisplay}</span>
                                </span>
                              </div>

                              {siswa.noPeserta && (
                                <div className="text-[7.5px] font-mono font-bold text-slate-500 leading-none">
                                  No: {siswa.noPeserta}
                                </div>
                              )}

                              {/* Credentials Mini */}
                              <div className="flex gap-1 pt-0.5">
                                <div className="flex-1 bg-sky-50 border border-sky-100 rounded px-1 py-0.5 leading-none">
                                  <span className="text-[6px] text-sky-700 font-extrabold block">U:</span>
                                  <span className="text-[8px] font-mono font-bold text-[#0666AE] block truncate">
                                    {siswa.username}
                                  </span>
                                </div>
                                <div className="flex-1 bg-slate-100 border border-slate-200 rounded px-1 py-0.5 leading-none">
                                  <span className="text-[6px] text-slate-500 font-extrabold block">P:</span>
                                  <span className="text-[8px] font-mono font-bold text-slate-800 block truncate">
                                    {siswa.password || "Password123"}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Footer Mini */}
                          <div className="pt-0.5 border-t border-slate-100 text-[6.5px] text-slate-400 text-center italic">
                            Harap menjaga kartu ini hingga seluruh sesi ujian selesai.
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------------
// BERITA ACARA & DAFTAR HADIR PRINT COMPONENT (FORMAT A4 RESMI)
// ----------------------------------------------------------------------------
interface PrintBeritaAcaraProps {
  konfig: KonfigurasiSekolah;
  mapelList: Mapel[];
  kelasList: Kelas[];
  kelasAkademikList?: KelasAkademik[];
  pengawasList?: Pengawas[];
  siswaList: Siswa[];
  onClose: () => void;
}

export function PrintBeritaAcara({
  konfig,
  mapelList,
  kelasList,
  kelasAkademikList = [],
  pengawasList = [],
  siswaList,
  onClose,
}: PrintBeritaAcaraProps) {
  const printAreaRef = useRef<HTMLDivElement>(null);

  // Form custom state for Berita Acara
  const [selectedMapelId, setSelectedMapelId] = useState<string>(mapelList[0]?.id || "");
  const [selectedKelas, setSelectedKelas] = useState<string>("all");
  const [ruangSesi, setRuangSesi] = useState<string>("Ruang 01 / Sesi 1");
  const [tanggalUjian, setTanggalUjian] = useState<string>(
    new Date().toISOString().split("T")[0]
  );
  const [jamUjian, setJamUjian] = useState<string>("07:30 - 09:00 WIB");
  const [pengawas1Nama, setPengawas1Nama] = useState<string>(
    pengawasList[0]?.nama || "Pengawas Ujian 1"
  );
  const [pengawas1Nip, setPengawas1Nip] = useState<string>(
    pengawasList[0]?.nip || "19850101 201001 1 001"
  );
  const [pengawas2Nama, setPengawas2Nama] = useState<string>("Proktor CBT");
  const [pengawas2Nip, setPengawas2Nip] = useState<string>("-");
  const [catatanKhusus, setCatatanKhusus] = useState<string>(
    "Pelaksanaan ujian berbasis komputer/Android berjalan tertib, aman, dan lancar tanpa kendala teknis."
  );

  // Active view tab
  const [activeTab, setActiveTab] = useState<"preview" | "settings">("preview");

  // Selection of students (default all students matching class)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => {
    return new Set(siswaList.map((s) => s.id));
  });

  // PDF Export state
  const [isExportingPdf, setIsExportingPdf] = useState<boolean>(false);
  const [exportProgress, setExportProgress] = useState<string>("");

  // Unique classes
  const availableClasses = useMemo(() => {
    const set = new Set<string>();
    kelasList.forEach((k) => k.nama && set.add(k.nama));
    kelasAkademikList.forEach((ka) => ka.nama && set.add(ka.nama));
    siswaList.forEach((s) => s.kelas && set.add(s.kelas));
    return Array.from(set).sort();
  }, [kelasList, kelasAkademikList, siswaList]);

  // Filtered students for attendance list
  const filteredSiswa = useMemo(() => {
    return siswaList.filter((siswa) => {
      if (selectedKelas !== "all") {
        const matchesClass =
          siswa.kelas === selectedKelas ||
          siswa.kelasId === selectedKelas ||
          kelasList.find((k) => k.id === siswa.kelasId)?.nama === selectedKelas;
        if (!matchesClass) return false;
      }
      return true;
    });
  }, [siswaList, selectedKelas, kelasList]);

  // Selected students to print on attendance list
  const attendanceSiswa = useMemo(() => {
    return filteredSiswa.filter((s) => selectedIds.has(s.id));
  }, [filteredSiswa, selectedIds]);

  // Split attendance list into A4 pages (max 20 students per page for spacious signature rows)
  const attendancePages = useMemo(() => {
    return chunkArray(attendanceSiswa, 20);
  }, [attendanceSiswa]);

  const selectedMapel = mapelList.find((m) => m.id === selectedMapelId) || mapelList[0];

  const formattedDate = useMemo(() => {
    try {
      const d = new Date(tanggalUjian);
      return d.toLocaleDateString("id-ID", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      });
    } catch {
      return tanggalUjian;
    }
  }, [tanggalUjian]);

  // Checkbox toggle
  const handleToggleSingle = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const handleSelectAllFiltered = () => {
    const next = new Set(selectedIds);
    filteredSiswa.forEach((s) => next.add(s.id));
    setSelectedIds(next);
  };

  const handleDeselectFiltered = () => {
    const next = new Set(selectedIds);
    filteredSiswa.forEach((s) => next.delete(s.id));
    setSelectedIds(next);
  };

  // PDF Download using jsPDF
  const handleDownloadPDF = async () => {
    if (!printAreaRef.current) return;
    const pageNodes = printAreaRef.current.querySelectorAll<HTMLElement>(".a4-ba-sheet");
    if (!pageNodes || pageNodes.length === 0) return;

    try {
      setIsExportingPdf(true);
      const totalPages = pageNodes.length;

      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
        compress: true,
      });

      for (let i = 0; i < totalPages; i++) {
        setExportProgress(`Membuat Lembar ${i + 1} dari ${totalPages}...`);
        const pageEl = pageNodes[i];

        const canvas = await html2canvas(pageEl, {
          scale: 2,
          useCORS: true,
          logging: false,
          backgroundColor: "#ffffff",
          windowWidth: 1024,
        });

        const imgData = canvas.toDataURL("image/jpeg", 0.95);
        if (i > 0) {
          pdf.addPage("a4", "portrait");
        }
        pdf.addImage(imgData, "JPEG", 0, 0, 210, 297, undefined, "FAST");
      }

      const mapelName = (selectedMapel?.nama || "Ujian").replace(/[^a-zA-Z0-9]/g, "_");
      const kelasLabel = selectedKelas === "all" ? "Semua_Kelas" : selectedKelas.replace(/[^a-zA-Z0-9]/g, "_");
      const fileName = `Berita_Acara_A4_${mapelName}_${kelasLabel}_${tanggalUjian}.pdf`;
      pdf.save(fileName);
      setExportProgress("Selesai!");
    } catch (err) {
      console.error("Gagal export PDF Berita Acara:", err);
      alert("Terjadi kendala saat export PDF. Anda juga dapat menggunakan Cetak / Simpan PDF langsung dari browser.");
    } finally {
      setIsExportingPdf(false);
      setExportProgress("");
    }
  };

  // Browser print
  const handleBrowserPrint = () => {
    setActiveTab("preview");
    setTimeout(() => {
      window.print();
    }, 150);
  };

  return (
    <div id="print-modal-portal" className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-sm flex flex-col items-center justify-start p-2 sm:p-4 overflow-hidden">
      {/* Print CSS Injection for A4 Berita Acara */}
      <style>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 8mm 8mm 8mm 8mm;
          }
          body {
            visibility: hidden !important;
            background: white !important;
          }
          #print-modal-portal, #print-modal-portal * {
            visibility: visible !important;
          }
          #print-modal-portal {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            background: white !important;
            padding: 0 !important;
            margin: 0 !important;
            overflow: visible !important;
          }
          .no-print {
            display: none !important;
          }
          .a4-ba-sheet {
            width: 194mm !important;
            min-height: 281mm !important;
            max-height: 281mm !important;
            margin: 0 auto !important;
            padding: 0 !important;
            page-break-after: always !important;
            break-after: page !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            box-shadow: none !important;
            border: none !important;
            background: white !important;
            font-family: 'Times New Roman', Times, serif !important;
          }
        }
      `}</style>

      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[96vh] flex flex-col overflow-hidden border border-slate-200">
        {/* Header Bar */}
        <div className="no-print p-4 bg-gradient-to-r from-indigo-700 to-indigo-900 text-white flex flex-wrap justify-between items-center gap-3 border-b border-indigo-950">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/10 rounded-xl">
              <FileText size={22} className="text-indigo-200" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-base sm:text-lg">Berita Acara & Daftar Hadir Ujian (Format A4)</h3>
                <span className="px-2 py-0.5 bg-indigo-500/30 text-indigo-100 border border-indigo-400/30 rounded-full text-[11px] font-bold">
                  Standar A4 Resmi
                </span>
              </div>
              <p className="text-xs text-indigo-100/80 font-medium">
                Dilengkapi Kop Kemenag/Madrasah, Form Berita Acara, Lembar Tanda Tangan, dan Daftar Hadir Siswa
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleDownloadPDF}
              disabled={isExportingPdf}
              className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-800/50 text-white rounded-xl text-xs font-bold flex items-center gap-2 transition shadow-sm cursor-pointer disabled:cursor-not-allowed"
            >
              {isExportingPdf ? (
                <>
                  <Loader2 size={16} className="animate-spin text-white" />
                  <span>{exportProgress || "Exporting..."}</span>
                </>
              ) : (
                <>
                  <Download size={16} />
                  <span>Unduh File PDF</span>
                </>
              )}
            </button>

            <button
              onClick={handleBrowserPrint}
              disabled={isExportingPdf}
              className="px-3.5 py-2 bg-amber-500 hover:bg-amber-400 disabled:bg-amber-700/50 text-slate-950 font-black rounded-xl text-xs flex items-center gap-1.5 transition shadow-sm cursor-pointer"
            >
              <Printer size={16} />
              <span>Cetak / Simpan PDF</span>
            </button>

            <button
              onClick={onClose}
              className="p-2 hover:bg-white/20 rounded-xl transition text-white/90 hover:text-white cursor-pointer ml-1"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Toolbar Bar */}
        <div className="no-print p-3 sm:p-4 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-2 sm:gap-3 flex-1">
            {/* Filter Kelas */}
            <div className="flex items-center gap-1.5 bg-white border border-slate-300 rounded-xl px-2.5 py-1.5 shadow-xs">
              <Filter size={14} className="text-slate-500" />
              <label className="text-[10px] font-black text-slate-500 uppercase">Kelas:</label>
              <select
                value={selectedKelas}
                onChange={(e) => setSelectedKelas(e.target.value)}
                className="bg-transparent font-bold text-slate-800 text-xs focus:outline-none cursor-pointer"
              >
                <option value="all">Semua Kelas ({siswaList.length})</option>
                {availableClasses.map((cls) => (
                  <option key={cls} value={cls}>
                    {cls}
                  </option>
                ))}
              </select>
            </div>

            {/* Mata Pelajaran */}
            <div className="flex items-center gap-1.5 bg-white border border-slate-300 rounded-xl px-2.5 py-1.5 shadow-xs">
              <label className="text-[10px] font-black text-slate-500 uppercase">Mapel:</label>
              <select
                value={selectedMapelId}
                onChange={(e) => setSelectedMapelId(e.target.value)}
                className="bg-transparent font-bold text-slate-800 text-xs focus:outline-none cursor-pointer max-w-[180px] truncate"
              >
                {mapelList.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.nama} ({m.kode})
                  </option>
                ))}
              </select>
            </div>

            {/* Tanggal Ujian */}
            <div className="flex items-center gap-1.5 bg-white border border-slate-300 rounded-xl px-2.5 py-1.5 shadow-xs">
              <Calendar size={14} className="text-slate-500" />
              <input
                type="date"
                value={tanggalUjian}
                onChange={(e) => setTanggalUjian(e.target.value)}
                className="bg-transparent font-bold text-slate-800 text-xs focus:outline-none cursor-pointer"
              />
            </div>
          </div>

          {/* Tab Switcher */}
          <div className="flex bg-slate-200/80 p-0.5 rounded-xl border border-slate-300">
            <button
              onClick={() => setActiveTab("preview")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                activeTab === "preview"
                  ? "bg-white text-slate-800 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Eye size={13} />
              <span>Preview Lembar A4 ({1 + attendancePages.length} Lembar)</span>
            </button>
            <button
              onClick={() => setActiveTab("settings")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                activeTab === "settings"
                  ? "bg-white text-slate-800 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <UserCheck size={13} />
              <span>Pengaturan & Ceklis Siswa ({attendanceSiswa.length})</span>
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto bg-slate-200/70 p-3 sm:p-6 text-slate-800">
          {/* TAB: SETTINGS & CHECKLIST */}
          {activeTab === "settings" && (
            <div className="no-print max-w-3xl mx-auto space-y-6">
              {/* Form Data Administrasi */}
              <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 space-y-4">
                <h4 className="font-extrabold text-slate-800 text-sm border-b border-slate-200 pb-2">
                  1. Informasi Administrasi Berita Acara
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div>
                    <label className="text-[10px] font-black text-slate-500 uppercase block mb-1">
                      Ruang / Sesi Ujian
                    </label>
                    <input
                      type="text"
                      value={ruangSesi}
                      onChange={(e) => setRuangSesi(e.target.value)}
                      placeholder="Contoh: Ruang 01 / Sesi 1"
                      className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-slate-500 uppercase block mb-1">
                      Waktu / Jam Ujian
                    </label>
                    <input
                      type="text"
                      value={jamUjian}
                      onChange={(e) => setJamUjian(e.target.value)}
                      placeholder="Contoh: 07:30 - 09:00 WIB"
                      className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-slate-500 uppercase block mb-1">
                      Nama Pengawas 1
                    </label>
                    <input
                      type="text"
                      value={pengawas1Nama}
                      onChange={(e) => setPengawas1Nama(e.target.value)}
                      className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-slate-500 uppercase block mb-1">
                      NIP Pengawas 1
                    </label>
                    <input
                      type="text"
                      value={pengawas1Nip}
                      onChange={(e) => setPengawas1Nip(e.target.value)}
                      className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl font-mono text-slate-800"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-slate-500 uppercase block mb-1">
                      Nama Pengawas 2 / Proktor
                    </label>
                    <input
                      type="text"
                      value={pengawas2Nama}
                      onChange={(e) => setPengawas2Nama(e.target.value)}
                      className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-slate-500 uppercase block mb-1">
                      NIP Pengawas 2 / Proktor
                    </label>
                    <input
                      type="text"
                      value={pengawas2Nip}
                      onChange={(e) => setPengawas2Nip(e.target.value)}
                      className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl font-mono text-slate-800"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase block mb-1">
                    Catatan Pelaksanaan / Kejadian Khusus
                  </label>
                  <textarea
                    rows={2}
                    value={catatanKhusus}
                    onChange={(e) => setCatatanKhusus(e.target.value)}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800"
                  />
                </div>
              </div>

              {/* Checklist Siswa */}
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-wrap justify-between items-center gap-2">
                  <div>
                    <h4 className="font-extrabold text-slate-800 text-sm">
                      2. Ceklis Siswa pada Lembar Daftar Hadir ({attendanceSiswa.length} Siswa Terpilih)
                    </h4>
                    <p className="text-[11px] text-slate-500">
                      Hilangkan centang jika siswa berhalangan hadir atau dipindahkan ke ruang/sesi lain.
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={handleSelectAllFiltered}
                      className="px-2.5 py-1 bg-white border border-slate-300 rounded-lg text-slate-700 font-bold text-[11px] cursor-pointer"
                    >
                      Pilih Semua
                    </button>
                    <button
                      onClick={handleDeselectFiltered}
                      className="px-2.5 py-1 bg-white border border-slate-300 rounded-lg text-red-600 font-bold text-[11px] cursor-pointer"
                    >
                      Kosongkan
                    </button>
                  </div>
                </div>

                <div className="max-h-[40vh] overflow-y-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-100 text-slate-600 font-bold sticky top-0 border-b border-slate-200">
                      <tr>
                        <th className="p-2.5 w-10 text-center">Pilih</th>
                        <th className="p-2.5 w-10 text-center">No</th>
                        <th className="p-2.5">Nama Siswa</th>
                        <th className="p-2.5">NISN</th>
                        <th className="p-2.5">Kelas</th>
                        <th className="p-2.5">No. Peserta</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredSiswa.map((siswa, idx) => (
                        <tr
                          key={siswa.id}
                          onClick={() => handleToggleSingle(siswa.id)}
                          className="cursor-pointer hover:bg-indigo-50/40"
                        >
                          <td className="p-2.5 text-center" onClick={(e) => e.stopPropagation()}>
                            <input
                              type="checkbox"
                              checked={selectedIds.has(siswa.id)}
                              onChange={() => handleToggleSingle(siswa.id)}
                              className="w-4 h-4 rounded text-indigo-600 cursor-pointer"
                            />
                          </td>
                          <td className="p-2.5 text-center font-mono text-slate-500">{idx + 1}</td>
                          <td className="p-2.5 font-bold text-slate-800">{siswa.nama}</td>
                          <td className="p-2.5 font-mono text-slate-600">{siswa.nisn}</td>
                          <td className="p-2.5 font-semibold text-slate-700">{siswa.kelas || "-"}</td>
                          <td className="p-2.5 font-mono text-slate-600">{siswa.noPeserta || "-"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB: A4 PREVIEW (SHEET 1: BERITA ACARA, SHEET 2+: DAFTAR HADIR) */}
          <div
            ref={printAreaRef}
            className={`${activeTab === "settings" ? "hidden" : "flex"} flex-col items-center gap-8`}
          >
            {/* LEMBAR 1: FORMULIR BERITA ACARA RESMI (A4) */}
            <div
              className="a4-ba-sheet bg-white shadow-xl rounded-md relative flex flex-col justify-between"
              style={{
                width: "210mm",
                minHeight: "297mm",
                maxHeight: "297mm",
                padding: "16mm 18mm 16mm 18mm",
                boxSizing: "border-box",
                margin: "0 auto",
                pageBreakAfter: "always",
                breakAfter: "page",
                fontFamily: "'Times New Roman', Times, serif",
                color: "#000000",
              }}
            >
              <div className="space-y-4 text-left leading-relaxed">
                {/* Kop Surat Madrasah */}
                <div className="flex items-center gap-4 border-b-2 border-black pb-3">
                  {konfig.logoKiriUrl && (
                    <img
                      src={konfig.logoKiriUrl}
                      alt="Logo Kiri"
                      className="h-16 w-16 object-contain rounded"
                      referrerPolicy="no-referrer"
                    />
                  )}
                  <div className="text-center flex-1 leading-tight">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                      KEMENTERIAN AGAMA REPUBLIK INDONESIA
                    </h3>
                    <h2 className="text-base font-bold uppercase tracking-wide mt-0.5">
                      {konfig.namaSekolah || "MTs. AL-MA'SUM II CIMUNCANG"}
                    </h2>
                    <p className="text-[11px] italic mt-0.5 text-slate-700">
                      {konfig.alamatSekolah || "Cimuncang, Malausma, Majalengka, Jawa Barat"}
                    </p>
                  </div>
                  {konfig.logoKananUrl && (
                    <img
                      src={konfig.logoKananUrl}
                      alt="Logo Kanan"
                      className="h-16 w-16 object-contain rounded"
                      referrerPolicy="no-referrer"
                    />
                  )}
                </div>

                {/* Judul Dokumen */}
                <div className="text-center pt-1">
                  <h3 className="text-sm font-bold uppercase tracking-wider underline">
                    BERITA ACARA PELAKSANAAN UJIAN DIGITAL (CBT)
                  </h3>
                  <p className="text-xs">Tahun Ajaran 2025/2026</p>
                </div>

                {/* Paragraf Pembuka */}
                <p className="text-xs text-justify">
                  Pada hari ini <strong>{formattedDate}</strong>, telah diselenggarakan Ujian Berbasis Komputer/Android
                  menggunakan platform sistem <strong>CBT MTs. Al-Ma'sum II Cmc</strong> dengan rincian administrasi sebagai berikut:
                </p>

                {/* Tabel Identitas Pelaksanaan */}
                <table className="w-full text-xs border border-collapse border-black" style={{ borderCollapse: "collapse" }}>
                  <tbody>
                    <tr>
                      <td className="w-1/3 p-1.5 border border-black font-semibold bg-slate-50">Nama Madrasah</td>
                      <td className="p-1.5 border border-black">{konfig.namaSekolah}</td>
                    </tr>
                    <tr>
                      <td className="p-1.5 border border-black font-semibold bg-slate-50">Mata Pelajaran</td>
                      <td className="p-1.5 border border-black font-bold">
                        {selectedMapel ? `${selectedMapel.nama} (${selectedMapel.kode})` : "Semua Mata Pelajaran"}
                      </td>
                    </tr>
                    <tr>
                      <td className="p-1.5 border border-black font-semibold bg-slate-50">Tingkat / Kelas</td>
                      <td className="p-1.5 border border-black">{selectedKelas === "all" ? "Semua Kelas" : selectedKelas}</td>
                    </tr>
                    <tr>
                      <td className="p-1.5 border border-black font-semibold bg-slate-50">Ruang & Sesi</td>
                      <td className="p-1.5 border border-black">{ruangSesi}</td>
                    </tr>
                    <tr>
                      <td className="p-1.5 border border-black font-semibold bg-slate-50">Waktu Pelaksanaan</td>
                      <td className="p-1.5 border border-black">{jamUjian}</td>
                    </tr>
                    <tr>
                      <td className="p-1.5 border border-black font-semibold bg-slate-50">Jumlah Peserta Terdaftar</td>
                      <td className="p-1.5 border border-black">{attendanceSiswa.length} Orang</td>
                    </tr>
                    <tr>
                      <td className="p-1.5 border border-black font-semibold bg-slate-50">Jumlah Hadir / Mengerjakan</td>
                      <td className="p-1.5 border border-black">....... Orang</td>
                    </tr>
                    <tr>
                      <td className="p-1.5 border border-black font-semibold bg-slate-50">Jumlah Tidak Hadir</td>
                      <td className="p-1.5 border border-black">....... Orang</td>
                    </tr>
                  </tbody>
                </table>

                {/* Catatan / Kejadian Khusus */}
                <div className="space-y-1">
                  <p className="text-xs font-bold">Catatan Selama Pelaksanaan Ujian:</p>
                  <div className="p-2 border border-black text-xs min-h-[50px] bg-slate-50/50">
                    {catatanKhusus || "Pelaksanaan ujian berjalan tertib, aman, dan lancar tanpa kendala teknis."}
                  </div>
                </div>

                <p className="text-xs text-justify">
                  Demikian Berita Acara ini dibuat dengan sebenarnya dalam rangkap secukupnya untuk dipergunakan sebagaimana mestinya.
                </p>
              </div>

              {/* Area Tanda Tangan */}
              <div className="pt-6 grid grid-cols-2 gap-8 text-xs text-center items-start">
                <div className="flex flex-col items-center">
                  <div className="h-8 flex flex-col justify-start">
                    <p>Pengawas Ujian 1,</p>
                    <p className="text-[10px] text-slate-500 italic mt-0.5">(Tanda Tangan)</p>
                  </div>
                  <div className="h-20 w-full flex items-center justify-center my-1" />
                  <div className="text-center">
                    <p className="font-bold underline">{pengawas1Nama}</p>
                    <p>NIP. {pengawas1Nip || "....................................."}</p>
                  </div>
                </div>

                <div className="flex flex-col items-center">
                  <div className="h-8 flex flex-col justify-start">
                    <p>Kepala Madrasah,</p>
                  </div>
                  <div className="relative h-20 w-48 flex items-center justify-center my-1">
                    {/* Stempel di sisi kiri sedikit menumpuk sisi kiri TTD resmi */}
                    {konfig.stempelSekolahUrl && (
                      <img
                        src={konfig.stempelSekolahUrl}
                        className="absolute left-3 top-1/2 -translate-y-1/2 h-16 w-16 object-contain opacity-85 pointer-events-none z-10"
                        alt="Stempel"
                        referrerPolicy="no-referrer"
                      />
                    )}
                    {konfig.ttdKepsekUrl && (
                      <img
                        src={konfig.ttdKepsekUrl}
                        className={`relative h-14 w-32 object-contain pointer-events-none z-20 ${
                          konfig.stempelSekolahUrl ? "ml-6" : ""
                        }`}
                        alt="Tanda Tangan"
                        referrerPolicy="no-referrer"
                      />
                    )}
                  </div>
                  <div className="text-center">
                    <p className="font-bold underline">{konfig.namaKepsek || "Kepala Madrasah"}</p>
                    <p>NIP. {konfig.nipKepsek || "....................................."}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* LEMBAR 2+: DAFTAR HADIR PESERTA UJIAN (FORMAT A4) */}
            {attendancePages.map((pageSiswa, pageIdx) => (
              <div
                key={`att-page-${pageIdx}`}
                className="a4-ba-sheet bg-white shadow-xl rounded-md relative flex flex-col justify-between"
                style={{
                  width: "210mm",
                  minHeight: "297mm",
                  maxHeight: "297mm",
                  padding: "16mm 18mm 16mm 18mm",
                  boxSizing: "border-box",
                  margin: "0 auto",
                  pageBreakAfter: "always",
                  breakAfter: "page",
                  fontFamily: "'Times New Roman', Times, serif",
                  color: "#000000",
                }}
              >
                <div className="space-y-3">
                  {/* Header Daftar Hadir */}
                  <div className="text-center border-b border-black pb-2">
                    <h3 className="text-xs font-bold uppercase tracking-wider leading-none">
                      DAFTAR HADIR PESERTA UJIAN BERBASIS KOMPUTER (CBT)
                    </h3>
                    <h2 className="text-sm font-bold uppercase tracking-wide mt-1">
                      {konfig.namaSekolah || "MTs. AL-MA'SUM II CIMUNCANG"}
                    </h2>
                    <p className="text-[11px] text-slate-700 mt-0.5">
                      Mapel: <strong>{selectedMapel?.nama || "Semua"}</strong> • Kelas:{" "}
                      <strong>{selectedKelas === "all" ? "Semua Kelas" : selectedKelas}</strong> • Ruang:{" "}
                      <strong>{ruangSesi}</strong>
                    </p>
                  </div>

                  {/* Tabel Daftar Hadir Siswa */}
                  <table
                    className="w-full text-[11px] border border-collapse border-black"
                    style={{ borderCollapse: "collapse" }}
                  >
                    <thead>
                      <tr className="bg-slate-100">
                        <th className="p-1.5 border border-black w-8 text-center font-bold">No</th>
                        <th className="p-1.5 border border-black w-24 text-center font-bold">No. Peserta</th>
                        <th className="p-1.5 border border-black w-24 text-center font-bold">NISN</th>
                        <th className="p-1.5 border border-black text-left font-bold">Nama Lengkap Siswa</th>
                        <th className="p-1.5 border border-black w-20 text-center font-bold">Kelas</th>
                        <th className="p-1.5 border border-black w-36 text-center font-bold">Tanda Tangan</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pageSiswa.map((siswa, i) => {
                        const globalIndex = pageIdx * 20 + i + 1;
                        return (
                          <tr key={siswa.id} style={{ height: "8.5mm" }}>
                            <td className="p-1 border border-black text-center font-mono">{globalIndex}</td>
                            <td className="p-1 border border-black text-center font-mono">{siswa.noPeserta || "-"}</td>
                            <td className="p-1 border border-black text-center font-mono">{siswa.nisn}</td>
                            <td className="p-1 border border-black font-bold uppercase text-[10.5px]">
                              {siswa.nama}
                            </td>
                            <td className="p-1 border border-black text-center">{siswa.kelas || "-"}</td>
                            <td className="p-1 border border-black text-left pl-3 text-slate-500 font-serif italic text-[10px]">
                              {globalIndex % 2 !== 0 ? `${globalIndex}. .........` : `......... ${globalIndex}`}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Footer Lembar Hadir */}
                <div className="pt-4 flex justify-between items-end text-xs">
                  <div className="text-[10px] text-slate-500 italic">
                    Lembar {pageIdx + 1} dari {attendancePages.length} • Dicetak melalui Sistem CBT MTs. Al-Ma'sum II Cmc
                  </div>
                  <div className="text-center w-48">
                    <p className="text-[11px]">Pengawas Ruang,</p>
                    <div className="h-10" />
                    <p className="font-bold underline text-[11px]">{pengawas1Nama}</p>
                    <p className="text-[10px]">NIP. {pengawas1Nip || "..........................."}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
