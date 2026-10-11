import React, { useState } from 'react';
import { GOOGLE_APPS_SCRIPT_CODE } from '../data/googleAppsScriptCode';
import {
  Code2,
  Copy,
  Check,
  Download,
  ExternalLink,
  X,
  FileSpreadsheet,
  Sparkles,
  Layers,
  Printer,
  ChevronRight,
  ShieldCheck,
} from 'lucide-react';

interface GoogleAppsScriptModalProps {
  onClose: () => void;
}

export const GoogleAppsScriptModal: React.FC<GoogleAppsScriptModalProps> = ({ onClose }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(GOOGLE_APPS_SCRIPT_CODE);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleDownload = () => {
    const blob = new Blob([GOOGLE_APPS_SCRIPT_CODE], {
      type: 'text/javascript;charset=utf-8;',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'Code.gs';
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/75 backdrop-blur-sm flex justify-center items-center p-3 sm:p-5 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-5xl max-h-[94vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-800 via-teal-800 to-slate-900 text-white p-5 sm:p-6 flex items-start justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="bg-emerald-400/20 text-emerald-200 text-xs px-2.5 py-1 rounded-md font-bold border border-emerald-400/30 flex items-center gap-1.5">
                <Code2 className="w-3.5 h-3.5" />
                Google Apps Script
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold mt-1">
              สคริปต์ทำให้ Google Sheet เป็นฐานข้อมูลของระบบ
            </h2>
            <p className="text-emerald-100 text-xs sm:text-sm">
              สร้างแท็บเก็บข้อมูลทั้งหมดให้อัตโนมัติ (สินค้า สาขา ใบส่งของ PO ความเคลื่อนไหวสต็อก โควตา) พร้อมรหัส API Token
            </p>
          </div>

          <button
            onClick={onClose}
            className="text-slate-300 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-6 flex-1">
          {/* Quick Guide Steps */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2">
            <h4 className="font-bold text-xs sm:text-sm text-slate-800 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              วิธีติดตั้ง (ทำครั้งเดียว ประมาณ 3 นาที):
            </h4>
            <ol className="text-xs text-slate-600 space-y-1.5 list-decimal list-inside leading-relaxed">
              <li>เปิด Google Sheet ของคุณ แล้วเลือก <strong>ส่วนขยาย (Extensions)</strong> &rarr; <strong>Apps Script</strong></li>
              <li>ลบโค้ดเดิมใน <code>Code.gs</code> แล้ววางโค้ดจากด้านล่าง กดบันทึก</li>
              <li>เลือกฟังก์ชัน <strong>setupDatabase</strong> แล้วกด <strong>เรียกใช้ (Run)</strong> &rarr; กดยอมรับสิทธิ์ &rarr; จะมีหน้าต่างแสดง <strong>API Token</strong> (คัดลอกเก็บไว้)</li>
              <li>กด <strong>ทำให้ใช้งานได้ (Deploy)</strong> &rarr; <strong>การทำให้ใช้งานได้รายการใหม่</strong> &rarr; ประเภท <strong>เว็บแอป</strong> &rarr; ดำเนินการในฐานะ <strong>ฉัน</strong> / ผู้มีสิทธิ์เข้าถึง <strong>ทุกคน (Anyone)</strong></li>
              <li>คัดลอก <strong>Web App URL</strong> (ลงท้ายด้วย <code>/exec</code>) พร้อม API Token ไปใส่ในแอปที่ปุ่ม Google Sheet มุมบนขวา</li>
            </ol>
            <p className="text-[11px] text-slate-500 pt-1">
              หากแก้โค้ดภายหลัง ต้อง Deploy เป็น &quot;เวอร์ชันใหม่&quot; ทุกครั้ง การแก้ในตัวแก้ไขอย่างเดียวจะไม่มีผลกับ URL เดิม
            </p>
          </div>

          {/* Action Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <div className="text-xs text-slate-700 font-bold flex items-center gap-2">
              <span>โค้ด Google Apps Script (Code.gs)</span>
              
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleCopy}
                className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-4 py-2 rounded-xl shadow-xs transition-colors cursor-pointer"
              >
                {copied ? (
                  <>
                    <Check className="w-4 h-4 text-white" />
                    <span>คัดลอกโค้ดเรียบร้อยแล้ว!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    <span>คัดลอกโค้ดทั้งหมด (Copy Script)</span>
                  </>
                )}
              </button>

              <button
                onClick={handleDownload}
                className="flex items-center gap-2 bg-slate-800 hover:bg-slate-900 text-white text-xs font-medium px-3.5 py-2 rounded-xl transition-colors cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>ดาวน์โหลด Code.gs</span>
              </button>

              
            </div>
          </div>

          {/* Code Viewer */}
          <div className="relative rounded-xl overflow-hidden border border-slate-700 bg-slate-950 text-slate-200">
            <div className="bg-slate-900 px-4 py-2 text-xs font-mono text-slate-400 border-b border-slate-800 flex items-center justify-between">
              <span>Code.gs &bull; Google Apps Script</span>
              
            </div>
            <pre className="p-4 text-xs font-mono overflow-x-auto max-h-96 leading-relaxed text-slate-300 select-all">
              {GOOGLE_APPS_SCRIPT_CODE}
            </pre>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-slate-100 p-4 border-t border-slate-200 flex items-center justify-between text-xs text-slate-600">
          <div>
            ห้างหุ้นส่วนจำกัด โนวาโซล &bull; Google Sheet เป็นฐานข้อมูลกลาง
          </div>
          <button
            onClick={onClose}
            className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl transition-colors cursor-pointer"
          >
            ปิดหน้าต่าง
          </button>
        </div>

      </div>
    </div>
  );
};
