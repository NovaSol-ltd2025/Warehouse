import React, { useEffect, useRef, useState } from 'react';
import { BranchOrder } from '../types/inventory';
import { COMPANY_INFO } from '../data/mockInitialData';
import { NovasolLogo } from './NovasolLogo';
import { useInventory } from '../context/InventoryContext';
import { SignatureModal } from './SignatureModal';
import { OrderEditModal } from './OrderEditModal';
// html2canvas-pro: รองรับสี oklch/oklab ของ Tailwind v4 (html2canvas ตัวเดิมจะ error)
import html2canvas from 'html2canvas-pro';
import { createPortal } from 'react-dom';
import { jsPDF } from 'jspdf';
import {
  Pencil,
  Printer,
  X,
  Download,
  Share2,
  CheckCircle2,
  PenTool,
  Trash2,
  FileText,
  MessageCircle,
  Copy,
  AlertTriangle,
  Loader2,
  Image as ImageIcon,
} from 'lucide-react';

interface DeliveryNotePrintProps {
  order: BranchOrder;
  onClose: () => void;
}

export const DeliveryNotePrint: React.FC<DeliveryNotePrintProps> = ({ order: initialOrder, onClose }) => {
  const { updateBranchOrder, deleteBranchOrder } = useInventory();
  const [currentOrder, setCurrentOrder] = useState<BranchOrder>(initialOrder);
  const printContentRef = useRef<HTMLDivElement>(null);
  // เก็บไฟล์ที่เรนเดอร์ไว้แล้ว เพื่อให้ปุ่มแชร์ทำงานทันทีหลังกด
  // (เบราว์เซอร์มือถืออนุญาตให้เรียกแชร์ได้เฉพาะช่วงสั้น ๆ หลังกดปุ่ม ถ้าเรนเดอร์ก่อนแชร์จะหมดสิทธิ์)
  const cacheRef = useRef<{
    image?: { blob: Blob; fileName: string };
    pdf?: { blob: Blob; fileName: string };
  }>({});

  // Modals state
  const [showSignatureModal, setShowSignatureModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  // เรนเดอร์รูป/PDF รอไว้ในพื้นหลังทันทีที่เปิดใบส่งของ (และเมื่อมีการแก้ เช่น เซ็นชื่อเพิ่ม)
  // เพื่อให้กดแชร์แล้วส่งได้ทันที ไม่ต้องรอเรนเดอร์
  useEffect(() => {
    cacheRef.current = {};
    let cancelled = false;
    const timer = setTimeout(async () => {
      await generateImageBlob(true);
      if (!cancelled) await generatePdfBlob(true);
    }, 1200);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentOrder]);

  const showToast = (msg: string) => {
    setActionMessage(msg);
    setTimeout(() => setActionMessage(null), 4000);
  };

  // Browser print fallback
  const handlePrint = () => {
    window.print();
  };

  // Save Signatures handler
  const handleSaveSignatures = (signatures: {
    senderSignatureUrl?: string;
    receiverSignatureUrl?: string;
    senderName?: string;
    receiverName?: string;
    senderSignedAt?: string;
    receiverSignedAt?: string;
  }) => {
    const updated: BranchOrder = {
      ...currentOrder,
      ...signatures,
    };
    setCurrentOrder(updated);
    updateBranchOrder(updated);
    showToast('✅ บันทึกลายเซ็นลงในใบส่งสินค้าเรียบร้อยแล้ว');
  };

  // Delete Order handler
  const handleDeleteOrder = () => {
    deleteBranchOrder(currentOrder.id, true);
    showToast('🗑️ ลบใบส่งสินค้าและคืนสต็อกเรียบร้อยแล้ว');
    setTimeout(() => {
      onClose();
    }, 600);
  };

  // จับภาพใบส่งของเป็น canvas (ใช้ร่วมกันทั้งรูปภาพและ PDF)
  const captureCanvas = async (): Promise<HTMLCanvasElement> => {
    const element = printContentRef.current;
    if (!element) throw new Error('ไม่พบเอกสาร');
    if ((document as any).fonts?.ready) await (document as any).fonts.ready;
    // รอรูปทั้งหมด (โลโก้/รูปสินค้า) โหลดเสร็จหรือล้มเหลวก่อน ไม่งั้นรูปอาจหายจากไฟล์ (รอสูงสุด 6 วินาที)
    await Promise.race([
      Promise.all(
        Array.from(element.querySelectorAll('img'))
          .filter((img) => !img.complete)
          .map(
            (img) =>
              new Promise<void>((resolve) => {
                img.addEventListener('load', () => resolve(), { once: true });
                img.addEventListener('error', () => resolve(), { once: true });
              })
          )
      ),
      new Promise((resolve) => setTimeout(resolve, 6000)),
    ]);
    await new Promise((resolve) => requestAnimationFrame(() => resolve(null))); // ให้โลโก้สำรอง (SVG) เรนเดอร์ก่อน
    return html2canvas(element, {
      scale: 2, // ความละเอียดสูง ให้ตัวอักษรและลายเซ็นคมชัด
      useCORS: true,
      backgroundColor: '#ffffff',
      logging: false,
      // ซ่อนปุ่มที่ไม่ควรอยู่ในรูป (เช่น ข้อความช่วยเหลือ) เฉพาะตอนจับภาพ
      // ในเอกสารที่ไลบรารีคัดลอกไปจับภาพ ไฟล์ CSS ภายนอกยังโหลดไม่ทัน (ตัวอักษร/สไตล์จะหาย)
      // จึงฝังกฎ CSS ของหน้านี้ลงในสำเนาโดยตรง
      // ไม่เอาข้อความ/ปุ่มช่วยเหลือ (เช่น "แตะเพื่อเซ็นชื่อ") ลงในรูป เหมือนตอนพิมพ์
      ignoreElements: (el) => el.classList?.contains('no-print') ?? false,
      onclone: (doc) => {
        const css = Array.from(document.styleSheets)
          .map((sheet) => {
            try {
              return Array.from(sheet.cssRules)
                .map((rule) => rule.cssText)
                .join(' ');
            } catch {
              return ''; // สไตล์จากโดเมนอื่น (เช่น Google Fonts) อ่านไม่ได้ ข้ามไป
            }
          })
          .join(' ');
        const style = doc.createElement('style');
        style.textContent = css;
        doc.head.appendChild(style);
      },
    });
  };

  const fileBase = () =>
    `ใบส่งของ_${currentOrder.deliveryOrderNo}_${currentOrder.branchName.replace(/\s+/g, '_')}`;

  // Generate Image Blob (PNG)
  const generateImageBlob = async (silent = false): Promise<{ blob: Blob; fileName: string } | null> => {
    if (cacheRef.current.image) return cacheRef.current.image;
    if (!silent) setIsGeneratingImage(true);
    try {
      const canvas = await captureCanvas();
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
      if (!blob) return null;
      const res = { blob, fileName: `${fileBase()}.png` };
      cacheRef.current.image = res;
      return res;
    } catch (err) {
      console.error('Image generation error', err);
      return null;
    } finally {
      if (!silent) setIsGeneratingImage(false);
    }
  };

  // Generate PDF (A4 หน้าเดียว ย่อพอดีหน้ากระดาษโดยไม่บิดสัดส่วน)
  const generatePdfBlob = async (silent = false): Promise<{ blob: Blob; fileName: string } | null> => {
    if (cacheRef.current.pdf) return cacheRef.current.pdf;
    if (!silent) setIsGeneratingPdf(true);
    try {
      const canvas = await captureCanvas();
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const pageW = 210;
      const pageH = 297;
      const ratio = Math.min(pageW / canvas.width, pageH / canvas.height);
      const w = canvas.width * ratio;
      const h = canvas.height * ratio;
      // JPEG คุณภาพสูง: ไฟล์เล็กกว่า PNG มาก (พื้นหลังขาวทึบอยู่แล้ว)
      pdf.addImage(canvas.toDataURL('image/jpeg', 0.92), 'JPEG', (pageW - w) / 2, 0, w, h);
      const res = { blob: pdf.output('blob'), fileName: `${fileBase()}.pdf` };
      cacheRef.current.pdf = res;
      return res;
    } catch (err) {
      console.error('PDF error', err);
      return null;
    } finally {
      if (!silent) setIsGeneratingPdf(false);
    }
  };

  // Download PDF
  const handleDownloadPdf = async () => {
    const res = await generatePdfBlob();
    if (!res) {
      alert('ไม่สามารถสร้างไฟล์ PDF ได้ กรุณาลองใช้ปุ่มพิมพ์แทน');
      return;
    }

    const url = URL.createObjectURL(res.blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = res.fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showToast('📄 ดาวน์โหลดไฟล์ PDF เรียบร้อยแล้ว');
  };

  // Download Image (PNG)
  const handleDownloadImage = async () => {
    const res = await generateImageBlob();
    if (!res) {
      alert('ไม่สามารถสร้างรูปภาพได้');
      return;
    }

    const url = URL.createObjectURL(res.blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = res.fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showToast('🖼️ ดาวน์โหลดรูปภาพใบส่งของเรียบร้อยแล้ว');
  };

  // 1. Share as IMAGE directly to LINE (No text messages)
  const handleShareImageToLine = async () => {
    showToast('⏳ กำลังเรนเดอร์รูปภาพใบส่งของเพื่อส่งเข้า LINE...');
    const res = await generateImageBlob();
    if (!res) {
      alert('ไม่สามารถสร้างรูปภาพใบส่งของได้');
      return;
    }

    const file = new File([res.blob], res.fileName, { type: 'image/png' });

    // Try System Native Share (Mobile device share drawer -> User selects LINE)
    if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({
          title: `ใบส่งสินค้า ${currentOrder.deliveryOrderNo}`,
          files: [file],
        });
        showToast('✅ ส่งรูปภาพใบส่งสินค้าสำเร็จ');
        setShowShareModal(false);
        return;
      } catch (err: any) {
        if (err.name === 'AbortError') return;
      }
    }

    // Fallback on desktop / web where file sharing isn't triggered:
    // Copy image directly to Clipboard so user can press Ctrl+V in LINE to send photo!
    let copied = false;
    try {
      if (navigator.clipboard && window.ClipboardItem) {
        await navigator.clipboard.write([
          new ClipboardItem({ 'image/png': res.blob }),
        ]);
        copied = true;
      }
    } catch (err) {
      console.warn('Clipboard write image not supported:', err);
    }

    // Also download image so file is ready
    const url = URL.createObjectURL(res.blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = res.fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    if (copied) {
      showToast('📋 คัดลอกรูปภาพแล้ว! กด "วาง (Ctrl+V)" ในแชท LINE เพื่อส่งรูปภาพได้ทันที');
    } else {
      showToast('🖼️ บันทึกรูปภาพแล้ว ส่งไฟล์รูปภาพใน LINE ได้ทันที');
    }
    setShowShareModal(false);
  };

  // 2. Share as PDF directly to LINE (No text messages)
  const handleSharePdfToLine = async () => {
    showToast('⏳ กำลังเตรียมไฟล์ PDF ใบส่งของเพื่อส่งเข้า LINE...');
    const res = await generatePdfBlob();
    if (!res) {
      alert('ไม่สามารถสร้างไฟล์ PDF ได้');
      return;
    }

    const file = new File([res.blob], res.fileName, { type: 'application/pdf' });

    // Try System Native Share with PDF file
    if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({
          title: `ใบส่งสินค้า ${currentOrder.deliveryOrderNo}`,
          files: [file],
        });
        showToast('✅ แชร์ไฟล์ PDF ใบส่งสินค้าสำเร็จ');
        setShowShareModal(false);
        return;
      } catch (err: any) {
        if (err.name === 'AbortError') return;
      }
    }

    // Fallback: Download the PDF so user can attach file directly into LINE
    const url = URL.createObjectURL(res.blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = res.fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    showToast('📄 บันทึกไฟล์ PDF แล้ว! แนบไฟล์ส่งในแชท LINE ได้ทันที');
    setShowShareModal(false);
  };

  // 3. One-click Copy Image to Clipboard
  const handleCopyImageToClipboard = async () => {
    showToast('⏳ กำลังคัดลอกรูปภาพใบส่งของ...');
    const res = await generateImageBlob();
    if (!res) return;

    try {
      if (navigator.clipboard && window.ClipboardItem) {
        await navigator.clipboard.write([
          new ClipboardItem({ 'image/png': res.blob }),
        ]);
        showToast('📋 คัดลอกรูปภาพแล้ว! กด "วาง (Ctrl+V)" ในแชท LINE เพื่อส่งรูปได้ทันที');
        setShowShareModal(false);
        return;
      }
    } catch (err) {
      console.warn('Clipboard write error', err);
    }

    // Fallback download image
    const url = URL.createObjectURL(res.blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = res.fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showToast('🖼️ บันทึกรูปภาพแล้ว ส่งใน LINE ได้ทันที');
    setShowShareModal(false);
  };

  // Pre-fill up to 20 rows to match the physical Thai delivery sheet template
  const totalDisplayRows = 20;
  const items = currentOrder.items;
  const emptyRowsNeeded = Math.max(0, totalDisplayRows - items.length);

  // Format Thai date
  const orderDateObj = new Date(currentOrder.date);
  const day = String(orderDateObj.getDate()).padStart(2, '0');
  const month = String(orderDateObj.getMonth() + 1).padStart(2, '0');
  const thaiYear = orderDateObj.getFullYear() + 543;

  // แสดงผ่าน portal ที่ <body> เพื่อให้ตอนพิมพ์ซ่อนหน้าเว็บอื่นทั้งหมดได้ (พิมพ์เฉพาะใบส่งของ)
  return createPortal(
    <div className="delivery-note-portal fixed inset-0 z-50 bg-slate-900/75 backdrop-blur-sm flex justify-center items-start overflow-y-auto p-2 sm:p-4 md:p-6">
      {/* Toast Alert */}
      {actionMessage && (
        <div className="no-print fixed top-5 left-1/2 -translate-x-1/2 z-60 bg-slate-900 text-white text-xs sm:text-sm px-4 py-2.5 rounded-xl shadow-xl border border-slate-700 flex items-center gap-2 animate-in fade-in slide-in-from-top-4">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{actionMessage}</span>
        </div>
      )}

      {/* Container card */}
      <div className="note-card relative bg-white w-full max-w-4xl my-2 sm:my-4 rounded-xl shadow-2xl border border-slate-200 overflow-hidden">
        
        {/* Top Action Toolbar (Hidden during print) */}
        <div className="no-print bg-slate-900 text-white px-4 sm:px-6 py-3.5 flex flex-wrap items-center justify-between gap-2.5 border-b border-slate-800">
          <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
            <span className="bg-emerald-500/20 text-emerald-400 text-xs font-semibold px-2.5 py-1 rounded-md border border-emerald-500/30">
              เลขที่ใบส่งของ: {currentOrder.deliveryOrderNo}
            </span>
            <span className="text-slate-300 text-xs sm:text-sm">
              สาขา: <strong className="text-white">{currentOrder.branchName}</strong>
            </span>
            {(currentOrder.receiverSignatureUrl || currentOrder.senderSignatureUrl) && (
              <span className="bg-blue-500/20 text-blue-300 text-[11px] px-2 py-0.5 rounded-full border border-blue-400/30 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3 text-blue-400" />
                มีลายเซ็นดิจิทัลแล้ว
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
            {/* Edit order button */}
            <button
              onClick={() => setShowEditModal(true)}
              className="flex items-center gap-1.5 bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold px-3 py-2 rounded-lg shadow-xs transition-colors cursor-pointer"
              title="แก้ไขรายการ จำนวน ราคา หมายเหตุ ของใบส่งของนี้"
            >
              <Pencil className="w-3.5 h-3.5" />
              <span>แก้ไขรายการ</span>
            </button>

            {/* Signature button */}
            <button
              onClick={() => setShowSignatureModal(true)}
              className="flex items-center gap-1.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-xs font-bold px-3 py-2 rounded-lg shadow-xs transition-colors cursor-pointer"
              title="เซ็นลายมือชื่อผู้ส่งและผู้รับในระบบ"
            >
              <PenTool className="w-3.5 h-3.5" />
              <span>เซ็นชื่อผู้ส่ง/รับ</span>
            </button>

            {/* Save PDF */}
            <button
              onClick={handleDownloadPdf}
              disabled={isGeneratingPdf}
              className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold px-3 py-2 rounded-lg shadow-xs transition-colors cursor-pointer"
              title="บันทึกเป็นไฟล์ PDF ลงในเครื่อง"
            >
              {isGeneratingPdf ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Download className="w-3.5 h-3.5" />
              )}
              <span>บันทึก PDF</span>
            </button>

            {/* Share Image to LINE directly */}
            <button
              onClick={handleShareImageToLine}
              disabled={isGeneratingImage}
              className="flex items-center gap-1.5 bg-[#06C755] hover:bg-[#05b34c] disabled:opacity-50 text-white text-xs font-bold px-3 py-2 rounded-lg shadow-xs transition-colors cursor-pointer"
              title="แชร์เป็นรูปภาพเข้า LINE ทันที (หรือคัดลอกรูปภาพ)"
            >
              {isGeneratingImage ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <ImageIcon className="w-3.5 h-3.5" />
              )}
              <span>แชร์รูปเข้า LINE</span>
            </button>

            {/* More Share Options */}
            <button
              onClick={() => setShowShareModal(true)}
              className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold px-2.5 py-2 rounded-lg transition-colors cursor-pointer"
              title="เลือกตัวเลือกแชร์ PDF หรือคัดลอกรูปภาพ"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span>แชร์อื่นๆ</span>
            </button>

            {/* Print A4 */}
            <button
              onClick={handlePrint}
              className="hidden sm:flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium px-3 py-2 rounded-lg transition-colors cursor-pointer"
              title="สั่งพิมพ์ออกเครื่องพิมพ์"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>พิมพ์</span>
            </button>

            {/* Delete button (Requirement 1) */}
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="flex items-center gap-1 bg-rose-900/60 hover:bg-rose-800 text-rose-200 text-xs font-bold px-2.5 py-2 rounded-lg border border-rose-700/60 transition-colors cursor-pointer"
              title="ลบใบส่งสินค้านี้หากมีการเปลี่ยนแปลง"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">ลบใบส่งของ</span>
            </button>

            {/* Close */}
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
              title="ปิดหน้าต่าง"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* The Printable Page Canvas (Exact reproduction of uploaded sample document) */}
        <div
          ref={printContentRef}
          id="delivery-note-a4"
          className="print-container bg-white p-6 sm:p-10 md:p-12 text-slate-900 font-document"
          style={{ minHeight: '297mm' }}
        >
          {/* Header section */}
          <div className="relative mb-6">
            {/* Logo on top-left */}
            <div className="absolute left-0 top-0">
              <NovasolLogo size={84} />
            </div>

            {/* Centered Business Information */}
            <div className="text-center pt-1 px-16 sm:px-24">
              <h1 className="text-xl sm:text-2xl font-bold tracking-wide text-black mb-1">
                ใบส่งสินค้า
              </h1>
              <h2 className="text-base sm:text-lg font-bold text-black mb-1">
                {COMPANY_INFO.name}
              </h2>
              <p className="text-xs sm:text-sm text-black leading-snug">
                {COMPANY_INFO.addressLine1}
              </p>
              <p className="text-xs sm:text-sm text-black leading-snug">
                {COMPANY_INFO.addressLine2} โทร. {COMPANY_INFO.phone}
              </p>
            </div>

            {/* Destination branch & Doc number */}
            <div className="flex items-center justify-between mt-4 text-xs sm:text-sm">
              <span className="font-mono text-slate-700 font-bold">
                เลขที่เอกสาร: {currentOrder.deliveryOrderNo}
              </span>
              <span className="text-black font-bold">
                สถานที่ปฏิบัติงาน{' '}
                <span className="font-semibold text-black underline decoration-slate-400 underline-offset-4">
                  {currentOrder.branchName}
                </span>
              </span>
            </div>
          </div>

          {/* Table section matching sample document layout */}
          <div className="border border-black">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-black text-black text-xs sm:text-sm font-bold bg-white">
                  <th className="border-r border-black py-1.5 px-2 text-center w-12">
                    ที่
                  </th>
                  <th className="border-r border-black py-1.5 px-3 text-center">
                    รายการ
                  </th>
                  <th className="border-r border-black py-1.5 px-2 text-center w-20">
                    จำนวน
                  </th>
                  <th className="border-r border-black py-1.5 px-2 text-center w-24">
                    หน่วย
                  </th>
                  <th className="py-1.5 px-2 text-center w-28">
                    หมายเหตุ
                  </th>
                </tr>
              </thead>
              <tbody className="text-xs sm:text-[13px] text-black">
                {/* Real items */}
                {items.map((item, index) => (
                  <tr
                    key={`item-${index}`}
                    className="border-b border-black last:border-b-0"
                    style={{ height: '24px' }}
                  >
                    <td className="border-r border-black py-1 px-2 text-center font-medium">
                      {index + 1}
                    </td>
                    <td className="border-r border-black py-1 px-3">
                      {item.itemName}
                    </td>
                    <td className="border-r border-black py-1 px-2 text-right pr-4 font-medium">
                      {item.quantity}
                    </td>
                    <td className="border-r border-black py-1 px-2 text-left pl-3">
                      {item.unit}
                    </td>
                    <td className="py-1 px-2 text-center text-[11px] text-slate-700">
                      {item.remark || ''}
                    </td>
                  </tr>
                ))}

                {/* Empty padding rows to reach total 20 rows like standard forms */}
                {Array.from({ length: emptyRowsNeeded }).map((_, emptyIdx) => {
                  const rowNumber = items.length + emptyIdx + 1;
                  return (
                    <tr
                      key={`empty-${emptyIdx}`}
                      className="border-b border-black last:border-b-0"
                      style={{ height: '24px' }}
                    >
                      <td className="border-r border-black py-1 px-2 text-center text-slate-300">
                        {rowNumber}
                      </td>
                      <td className="border-r border-black py-1 px-3"></td>
                      <td className="border-r border-black py-1 px-2"></td>
                      <td className="border-r border-black py-1 px-2"></td>
                      <td className="py-1 px-2"></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Signatures section with DIGITAL SIGNATURE CAPABILITY */}
          <div className="mt-8 grid grid-cols-2 gap-8 sm:gap-16">
            
            {/* Box 1: Receiver (ผู้รับสินค้า) */}
            <div
              onClick={() => setShowSignatureModal(true)}
              className="border border-black p-3.5 flex flex-col justify-between items-center text-center min-h-[145px] cursor-pointer hover:bg-slate-50/50 transition-colors relative group"
              title="คลิกเพื่อลงลายมือชื่อผู้รับสินค้า"
            >
              <div className="w-full flex-1 flex flex-col items-center justify-center">
                {currentOrder.receiverSignatureUrl ? (
                  <div className="flex flex-col items-center">
                    <img
                      src={currentOrder.receiverSignatureUrl}
                      alt="ลายมือชื่อผู้รับสินค้า"
                      className="h-14 max-w-[180px] object-contain"
                    />
                    <div className="text-xs text-black font-semibold mt-0.5">
                      ({currentOrder.receiverName || 'ผู้รับมอบสินค้า'})
                    </div>
                  </div>
                ) : (
                  <div className="w-full pt-4">
                    <div className="text-black text-xs tracking-widest">
                      ...........................................................................
                    </div>
                    <div className="text-xs text-slate-500 mt-1 no-print flex items-center justify-center gap-1">
                      <PenTool className="w-3 h-3 text-blue-600" />
                      <span className="text-blue-600 underline">แตะเพื่อเซ็นชื่อ</span>
                    </div>
                  </div>
                )}
                <div className="text-sm font-bold text-black mt-1">
                  ผู้รับสินค้า
                </div>
              </div>
              <div className="text-xs text-black mt-1">
                {currentOrder.receiverSignedAt ? (
                  <span>ลงนามเมื่อ: {currentOrder.receiverSignedAt}</span>
                ) : (
                  <span>วันที่ .........{day}........./.........{month}........./.........{thaiYear}.........</span>
                )}
              </div>
            </div>

            {/* Box 2: Sender (ผู้ส่งสินค้า) */}
            <div
              onClick={() => setShowSignatureModal(true)}
              className="border border-black p-3.5 flex flex-col justify-between items-center text-center min-h-[145px] cursor-pointer hover:bg-slate-50/50 transition-colors relative group"
              title="คลิกเพื่อลงลายมือชื่อผู้ส่งสินค้า"
            >
              <div className="w-full flex-1 flex flex-col items-center justify-center">
                {currentOrder.senderSignatureUrl ? (
                  <div className="flex flex-col items-center">
                    <img
                      src={currentOrder.senderSignatureUrl}
                      alt="ลายมือชื่อผู้ส่งสินค้า"
                      className="h-14 max-w-[180px] object-contain"
                    />
                    <div className="text-xs text-black font-semibold mt-0.5">
                      ({currentOrder.senderName || 'ทีมจัดส่ง โนวาโซล'})
                    </div>
                  </div>
                ) : (
                  <div className="w-full pt-4">
                    <div className="text-black text-xs tracking-widest">
                      ...........................................................................
                    </div>
                    <div className="text-xs text-slate-500 mt-1 no-print flex items-center justify-center gap-1">
                      <PenTool className="w-3 h-3 text-emerald-600" />
                      <span className="text-emerald-600 underline">แตะเพื่อเซ็นชื่อ</span>
                    </div>
                  </div>
                )}
                <div className="text-sm font-bold text-black mt-1">
                  ผู้ส่งสินค้า
                </div>
              </div>
              <div className="text-xs text-black mt-1">
                {currentOrder.senderSignedAt ? (
                  <span>ลงนามเมื่อ: {currentOrder.senderSignedAt}</span>
                ) : (
                  <span>วันที่ .........{day}........./.........{month}........./.........{thaiYear}.........</span>
                )}
              </div>
            </div>

          </div>

          {/* Document Footer */}
          <div className="mt-6 text-center text-[11px] text-slate-400 no-print flex items-center justify-center gap-2">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
            <span>ใบส่งสินค้านี้จัดทำตามแบบฟอร์มทางการของ {COMPANY_INFO.name} &bull; บันทึกเป็น PDF หรือแชร์ไปยัง LINE ได้ทันที</span>
          </div>
        </div>

      </div>

      {/* 0. Edit Order Modal */}
      {showEditModal && (
        <OrderEditModal
          order={currentOrder}
          onClose={() => setShowEditModal(false)}
          onSaved={(updated) => {
            setCurrentOrder(updated);
            showToast('✅ บันทึกการแก้ไขใบส่งสินค้าเรียบร้อยแล้ว');
          }}
        />
      )}

      {/* 1. Signature Modal */}
      {showSignatureModal && (
        <SignatureModal
          order={currentOrder}
          onSave={handleSaveSignatures}
          onClose={() => setShowSignatureModal(false)}
        />
      )}

      {/* 2. Delete Confirmation Modal (Requirement 1) */}
      {showDeleteConfirm && (
        <div className="no-print fixed inset-0 z-60 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95">
            <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="w-6 h-6" />
            </div>

            <h3 className="text-lg font-bold text-slate-900 text-center">
              ยืนยันการลบใบส่งสินค้านี้?
            </h3>
            <p className="text-xs sm:text-sm text-slate-600 text-center mt-2">
              เลขที่เอกสาร: <strong className="text-slate-900">{currentOrder.deliveryOrderNo}</strong>
              <br />
              สาขา: <strong className="text-slate-900">{currentOrder.branchName}</strong>
            </p>

            <div className="bg-amber-50 text-amber-800 text-xs p-3 rounded-xl border border-amber-200 mt-4 leading-relaxed">
              <strong>หมายเหตุ:</strong> ระบบจะคืนสต็อกสินค้าทั้งหมดกลับเข้าคลัง สนง.ใหญ่ ให้โดยอัตโนมัติ (หากเคยตัดจ่ายแล้ว) และจะซิงก์การลบไปยัง Google Sheet ทันที
            </div>

            <div className="grid grid-cols-2 gap-3 mt-6">
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(false)}
                className="py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs sm:text-sm font-bold rounded-xl transition-colors cursor-pointer"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={handleDeleteOrder}
                className="py-2.5 px-4 bg-rose-600 hover:bg-rose-700 text-white text-xs sm:text-sm font-bold rounded-xl shadow-sm transition-colors cursor-pointer flex items-center justify-center gap-1.5"
              >
                <Trash2 className="w-4 h-4" />
                <span>ยืนยันลบใบส่งของ</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. Share Options Modal (Requirement 2 - LINE & file share) */}
      {showShareModal && (
        <div className="no-print fixed inset-0 z-60 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
                  <Share2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-sm sm:text-base text-slate-900">
                    แชร์ใบส่งสินค้าไปยัง LINE หรือแอปอื่น
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    เลขที่ {currentOrder.deliveryOrderNo} &bull; {currentOrder.branchName}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowShareModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 mt-4">
              {/* Option 1: Share IMAGE directly to LINE */}
              <button
                type="button"
                onClick={handleShareImageToLine}
                disabled={isGeneratingImage}
                className="w-full flex items-center gap-3 p-3.5 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 rounded-xl transition-all cursor-pointer text-left group"
              >
                <div className="w-11 h-11 rounded-xl bg-[#06C755] text-white flex items-center justify-center shrink-0 shadow-xs group-hover:scale-105 transition-transform">
                  {isGeneratingImage ? (
                    <Loader2 className="w-6 h-6 animate-spin" />
                  ) : (
                    <ImageIcon className="w-6 h-6" />
                  )}
                </div>
                <div className="flex-1">
                  <div className="text-xs sm:text-sm font-extrabold text-emerald-950 flex items-center gap-1.5">
                    <span>แชร์เป็นรูปภาพเข้า LINE ทันที (Image)</span>
                    <span className="bg-emerald-200 text-emerald-800 text-[10px] px-1.5 py-0.2 rounded font-bold">
                      แนะนำ
                    </span>
                  </div>
                  <div className="text-[11px] text-emerald-800 mt-0.5">
                    ส่งรูปภาพใบส่งของความละเอียดสูงพร้อมลายเซ็นเข้า LINE (ส่งเป็นรูปภาพ ไม่ส่งเป็นข้อความ)
                  </div>
                </div>
              </button>

              {/* Option 2: Share PDF directly to LINE */}
              <button
                type="button"
                onClick={handleSharePdfToLine}
                disabled={isGeneratingPdf}
                className="w-full flex items-center gap-3 p-3.5 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-xl transition-all cursor-pointer text-left group"
              >
                <div className="w-11 h-11 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-xs group-hover:scale-105 transition-transform">
                  {isGeneratingPdf ? (
                    <Loader2 className="w-6 h-6 animate-spin" />
                  ) : (
                    <FileText className="w-6 h-6" />
                  )}
                </div>
                <div className="flex-1">
                  <div className="text-xs sm:text-sm font-bold text-blue-950">
                    แชร์ไฟล์ PDF เข้า LINE (PDF Document)
                  </div>
                  <div className="text-[11px] text-blue-700 mt-0.5">
                    แนบไฟล์เอกสาร .pdf ต้นฉบับขนาด A4 ส่งตรงเข้า LINE หรือแอปอื่น
                  </div>
                </div>
              </button>

              {/* Option 3: Copy Image to Clipboard */}
              <button
                type="button"
                onClick={handleCopyImageToClipboard}
                disabled={isGeneratingImage}
                className="w-full flex items-center gap-3 p-3 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl transition-all cursor-pointer text-left"
              >
                <div className="w-9 h-9 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0">
                  <Copy className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <div className="text-xs font-bold text-slate-800">
                    คัดลอกรูปภาพลงคลิปบอร์ด (Copy Image)
                  </div>
                  <div className="text-[11px] text-slate-500">
                    กดคัดลอก แล้วไปกด 'วาง' (Ctrl+V) ในช่องแชท LINE เพื่อส่งรูปภาพได้ทันที
                  </div>
                </div>
              </button>

              {/* Option 4: Download Image and PDF file */}
              <div className="grid grid-cols-2 gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleDownloadImage}
                  disabled={isGeneratingImage}
                  className="flex items-center justify-center gap-1.5 py-2 px-3 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5 text-slate-500" />
                  <span>โหลดรูป PNG</span>
                </button>

                <button
                  type="button"
                  onClick={handleDownloadPdf}
                  disabled={isGeneratingPdf}
                  className="flex items-center justify-center gap-1.5 py-2 px-3 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5 text-slate-500" />
                  <span>โหลดไฟล์ PDF</span>
                </button>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100 text-center">
              <button
                type="button"
                onClick={() => setShowShareModal(false)}
                className="text-xs text-slate-500 hover:text-slate-800 font-medium cursor-pointer"
              >
                ปิดหน้าต่าง
              </button>
            </div>
          </div>
        </div>
      )}

    </div>,
    document.body
  );
};
