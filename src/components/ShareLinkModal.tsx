import React, { useState } from 'react';
import {
  Share2,
  Copy,
  Check,
  ExternalLink,
  X,
  Smartphone,
  Globe,
  CheckCircle2,
  Send,
  MessageCircle,
  HelpCircle,
} from 'lucide-react';

interface ShareLinkModalProps {
  onClose: () => void;
}

export const ShareLinkModal: React.FC<ShareLinkModalProps> = ({ onClose }) => {
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [copiedLineMsg, setCopiedLineMsg] = useState(false);

  // The live deployed web app URL for employees
  const sharedUrl = window.location.origin.includes('localhost')
    ? 'https://ais-pre-dr4fvqt7vycwx65grmz6q4-667571402726.asia-east1.run.app'
    : window.location.href;

  const lineMessage = `เรียน ทีมงานและพนักงานโนวาโซล ทุกท่าน\n\n` +
    `ขอแจ้งลิงก์สำหรับเข้าใช้งาน "ระบบควบคุมสต็อก & เบิกจ่ายวัสดุอุปกรณ์ ห้างหุ้นส่วนจำกัด โนวาโซล"\n\n` +
    `🔗 ลิงก์เข้าใช้งานระบบ:\n${sharedUrl}\n\n` +
    `📌 สิ่งที่สามารถทำได้ผ่านระบบนี้:\n` +
    `1. ตรวจสอบสต็อกคงเหลือ และรูปภาพสินค้าจริง\n` +
    `2. สร้างใบเบิกของและออกใบส่งสินค้าประจำสาขา (เช่น ศูนย์ฝึกอาชีพจตุจักร)\n` +
    `3. ตรวจสอบสเปกสินค้า กลิ่น และสี เพื่อป้องกันการจัดของผิด\n` +
    `4. พิมพ์ใบส่งของขนาด A4 ที่มีตราประทับโนวาโซลได้ทันที\n\n` +
    `*สามารถเปิดผ่านเว็บเบราว์เซอร์บนมือถือ แท็บเล็ต หรือคอมพิวเตอร์ได้เลยโดยไม่ต้องลงโปรแกรมครับ*`;

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(sharedUrl);
    setCopiedUrl(true);
    setTimeout(() => setCopiedUrl(false), 2500);
  };

  const handleCopyLineMsg = () => {
    navigator.clipboard.writeText(lineMessage);
    setCopiedLineMsg(true);
    setTimeout(() => setCopiedLineMsg(false), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/75 backdrop-blur-sm flex justify-center items-center p-3 sm:p-5 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-700 via-indigo-700 to-slate-900 text-white p-5 sm:p-6 flex items-start justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="bg-blue-400/20 text-blue-200 text-xs px-2.5 py-1 rounded-md font-bold border border-blue-400/30 flex items-center gap-1.5">
                <Share2 className="w-3.5 h-3.5" />
                แชร์ระบบให้พนักงานใช้งาน
              </span>
              <span className="bg-emerald-400/20 text-emerald-200 text-xs px-2 py-0.5 rounded font-semibold">
                พร้อมใช้งานทันที (No Setup)
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold mt-1">
              ส่งลิงก์ให้พนักงานนำไปใช้งานได้เลย
            </h2>
            <p className="text-blue-100 text-xs sm:text-sm">
              พนักงานสามารถเปิดผ่านมือถือหรือคอมพิวเตอร์ได้ทันที ไม่ต้องสร้าง Google Sheet หรือเขียน Script ใหม่
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
        <div className="p-5 sm:p-6 space-y-5">
          
          {/* Main Answer Card */}
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-xs sm:text-sm text-emerald-950 flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <strong className="font-bold text-emerald-900 block">
                คำตอบ: พนักงานสามารถใช้งานผ่านลิงก์นี้ได้ทันทีเลยครับ!
              </strong>
              <p className="text-slate-700 text-xs leading-relaxed">
                ระบบนี้เป็น Web Application เต็มรูปแบบที่ทำงานได้สมบูรณ์ในตัวเอง พนักงานทุกคนสามารถเปิดใช้งาน ควบคุมสต็อก ตรวจรูปภาพ สเปกสินค้า ออกใบส่งของ และสั่งพิมพ์ A4 ได้จากลิงก์นี้ทันที ส่วน Google Sheet และ Script นั้นเป็นเพียงทางเลือกเสริมหากต้องการสำรองข้อมูลเข้าสเปรดชีตเท่านั้น
              </p>
            </div>
          </div>

          {/* Direct URL Box */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
              ลิงก์ระบบสำหรับพนักงาน (Direct Link)
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={sharedUrl}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2.5 text-xs sm:text-sm font-mono text-slate-900 select-all focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                onClick={handleCopyUrl}
                className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs sm:text-sm px-4 py-2.5 rounded-xl transition-colors cursor-pointer shrink-0"
              >
                {copiedUrl ? (
                  <>
                    <Check className="w-4 h-4" />
                    <span>คัดลอกแล้ว!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    <span>คัดลอกลิงก์</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Quick LINE Message Box */}
          <div className="bg-slate-50 rounded-xl border border-slate-200 p-4 space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MessageCircle className="w-4 h-4 text-emerald-600" />
                <span className="text-xs font-bold text-slate-800">
                  ข้อความสำเร็จรูปสำหรับส่งเข้ากลุ่ม LINE พนักงาน
                </span>
              </div>
              <button
                onClick={handleCopyLineMsg}
                className="text-xs text-blue-700 hover:text-blue-900 font-bold flex items-center gap-1 cursor-pointer"
              >
                {copiedLineMsg ? (
                  <span className="text-emerald-600 flex items-center gap-1">
                    <Check className="w-3.5 h-3.5" /> คัดลอกข้อความ LINE แล้ว!
                  </span>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" /> คัดลอกทั้งข้อความ
                  </>
                )}
              </button>
            </div>

            <pre className="text-[11px] font-sans bg-white p-3 rounded-lg border border-slate-200 text-slate-600 whitespace-pre-wrap leading-relaxed max-h-36 overflow-y-auto">
              {lineMessage}
            </pre>
          </div>

          {/* Compatibility Highlights */}
          <div className="grid grid-cols-2 gap-3 text-xs text-slate-600">
            <div className="flex items-center gap-2 bg-slate-50 p-2.5 rounded-lg border border-slate-200">
              <Smartphone className="w-4 h-4 text-blue-600 shrink-0" />
              <span>รองรับทั้งโทรศัพท์มือถือ, iPad/Tablet และคอมพิวเตอร์</span>
            </div>
            <div className="flex items-center gap-2 bg-slate-50 p-2.5 rounded-lg border border-slate-200">
              <Globe className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>เปิดผ่าน Chrome, Safari, Edge ได้ทันที</span>
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="bg-slate-100 p-4 border-t border-slate-200 flex items-center justify-between">
          <div className="text-xs text-slate-500">
            ห้างหุ้นส่วนจำกัด โนวาโซล &bull; ระบบออนไลน์พร้อมใช้งาน
          </div>
          <button
            onClick={onClose}
            className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer"
          >
            ปิดหน้าต่าง
          </button>
        </div>

      </div>
    </div>
  );
};
