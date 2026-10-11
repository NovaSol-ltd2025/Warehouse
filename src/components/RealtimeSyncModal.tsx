import React, { useState } from 'react';
import { useInventory } from '../context/InventoryContext';
import {
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  X,
  ShieldCheck,
  Zap,
  Radio,
} from 'lucide-react';

interface RealtimeSyncModalProps {
  onClose: () => void;
  onOpenGasModal: () => void;
}

export const RealtimeSyncModal: React.FC<RealtimeSyncModalProps> = ({
  onClose,
  onOpenGasModal,
}) => {
  const {
    sheetsConnection,
    sheetsSync,
    isSheetsConfigured,
    saveSheetsConnection,
    refreshFromSheet,
    testSheetsConnection,
  } = useInventory();

  const [apiUrl, setApiUrl] = useState(sheetsConnection.apiUrl);
  const [apiToken, setApiToken] = useState(sheetsConnection.apiToken);
  const [isBusy, setIsBusy] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

  const handleTest = async () => {
    setIsBusy(true);
    setResult(null);
    const r = await testSheetsConnection({ apiUrl, apiToken });
    setResult({ success: r.ok, message: r.message });
    setIsBusy(false);
  };

  const handleSave = async () => {
    setIsBusy(true);
    setResult(null);
    if (apiUrl.trim() || apiToken.trim()) {
      const r = await testSheetsConnection({ apiUrl, apiToken });
      if (!r.ok) {
        setResult({ success: false, message: `ยังไม่บันทึก: ${r.message}` });
        setIsBusy(false);
        return;
      }
    }
    await saveSheetsConnection({ apiUrl, apiToken });
    setResult({
      success: true,
      message: apiUrl.trim()
        ? 'บันทึกการเชื่อมต่อแล้ว ระบบกำลังโหลดข้อมูลจาก Google Sheet'
        : 'ล้างการเชื่อมต่อแล้ว (กลับสู่โหมดทดลอง)',
    });
    setIsBusy(false);
  };

  const handleRefresh = async () => {
    setIsBusy(true);
    const ok = await refreshFromSheet();
    setResult({
      success: ok,
      message: ok ? 'โหลดข้อมูลล่าสุดจาก Google Sheet เรียบร้อย' : 'โหลดข้อมูลไม่สำเร็จ ดูสถานะด้านบน',
    });
    setIsBusy(false);
  };

  const online = isSheetsConfigured && sheetsSync.status !== 'ERROR';

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/75 backdrop-blur-sm flex justify-center items-center p-3 sm:p-5 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-800 via-teal-800 to-slate-900 text-white p-5 sm:p-6 flex items-start justify-between">
          <div className="space-y-1">
            <span className="bg-emerald-400/20 text-emerald-200 text-xs px-2.5 py-1 rounded-md font-bold border border-emerald-400/30 inline-flex items-center gap-1.5">
              <Radio className="w-3.5 h-3.5 text-emerald-300" />
              ฐานข้อมูล Google Sheet
            </span>
            <h2 className="text-xl sm:text-2xl font-bold mt-1">เชื่อมต่อ Google Sheet</h2>
            <p className="text-emerald-100 text-xs sm:text-sm">
              ข้อมูลทั้งหมดของระบบถูกเก็บในไฟล์ Google Sheet ของคุณ ทุกเครื่องที่ใส่ URL เดียวกันจะเห็นข้อมูลตรงกัน
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-300 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-4 sm:p-6 overflow-y-auto space-y-5 flex-1">
          {/* Status */}
          <div
            className={`p-4 rounded-xl border flex items-center justify-between gap-3 ${
              online
                ? 'bg-emerald-50 border-emerald-300 text-emerald-950'
                : sheetsSync.status === 'ERROR'
                ? 'bg-rose-50 border-rose-300 text-rose-950'
                : 'bg-amber-50 border-amber-300 text-amber-950'
            }`}
          >
            <div className="text-sm">
              <div className="font-bold">
                {sheetsSync.status === 'ONLINE' && '🟢 เชื่อมต่อ Google Sheet แล้ว'}
                {sheetsSync.status === 'SYNCING' && '🔄 กำลังซิงก์กับ Google Sheet'}
                {sheetsSync.status === 'CONNECTING' && '⏳ กำลังเชื่อมต่อ...'}
                {sheetsSync.status === 'ERROR' && '🔴 เชื่อมต่อมีปัญหา'}
                {sheetsSync.status === 'NOT_CONFIGURED' && '🟡 ยังไม่ได้เชื่อมต่อ (โหมดทดลอง)'}
              </div>
              <div className="text-xs text-slate-600 mt-0.5">
                {sheetsSync.message}
                {sheetsSync.lastSyncTime ? ` • ล่าสุด ${sheetsSync.lastSyncTime}` : ''}
              </div>
            </div>
            <button
              onClick={handleRefresh}
              disabled={isBusy || !isSheetsConfigured}
              className="text-xs bg-white hover:bg-slate-50 border border-slate-300 px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5 disabled:opacity-40 cursor-pointer shrink-0"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isBusy ? 'animate-spin' : ''}`} />
              <span>โหลดใหม่</span>
            </button>
          </div>

          {/* Connection form */}
          <div className="space-y-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1">Web App URL</label>
              <input
                type="url"
                placeholder="https://script.google.com/macros/s/AKfycb.../exec"
                value={apiUrl}
                onChange={(e) => setApiUrl(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1">API Token</label>
              <input
                type="password"
                autoComplete="off"
                placeholder="รหัสที่ได้จากการรัน setupDatabase"
                value={apiToken}
                onChange={(e) => setApiToken(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
              />
            </div>

            <div className="flex flex-wrap justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={handleTest}
                disabled={isBusy}
                className="bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 text-xs font-bold px-3 py-2 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
              >
                {isBusy ? 'กำลังทำงาน...' : 'ทดสอบการเชื่อมต่อ'}
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={isBusy}
                className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-4 py-2 rounded-lg transition-colors cursor-pointer shadow-xs disabled:opacity-50"
              >
                บันทึกและเชื่อมต่อ
              </button>
            </div>

            {result && (
              <div
                className={`p-3 rounded-lg text-xs flex items-center gap-2 ${
                  result.success
                    ? 'bg-emerald-100/70 border border-emerald-300 text-emerald-900'
                    : 'bg-rose-50 border border-rose-300 text-rose-900'
                }`}
              >
                {result.success ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                )}
                <span>{result.message}</span>
              </div>
            )}
          </div>

          {/* Guide */}
          <div className="border border-slate-200 rounded-xl p-4 space-y-2.5 bg-white">
            <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
              <Zap className="w-4 h-4 text-amber-500" />
              ยังไม่มี URL / Token? ติดตั้งสคริปต์ในชีต (ทำครั้งเดียว):
            </h4>
            <ol className="text-xs text-slate-600 space-y-1 list-decimal pl-4 leading-relaxed">
              <li>
                คัดลอกโค้ดจาก{' '}
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenGasModal();
                  }}
                  className="text-emerald-700 underline font-bold hover:text-emerald-900"
                >
                  หน้าโค้ด Google Apps Script
                </button>{' '}
                ไปวางที่ Google Sheet &rarr; ส่วนขยาย &rarr; Apps Script
              </li>
              <li>รันฟังก์ชัน <strong>setupDatabase</strong> เพื่อสร้างแท็บและรับ API Token</li>
              <li>
                Deploy เป็น <strong>เว็บแอป</strong> (ดำเนินการในฐานะ: ฉัน / ผู้มีสิทธิ์: ทุกคน) แล้วคัดลอก URL ที่ลงท้าย <code>/exec</code>
              </li>
            </ol>
          </div>

          <div className="bg-blue-50 border border-blue-200 p-3.5 rounded-xl flex items-start gap-2.5 text-xs text-blue-900">
            <ShieldCheck className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold block mb-0.5">หมายเหตุ</span>
              <span>
                URL และ Token ถูกเก็บในเบราว์เซอร์ของเครื่องนี้ ต้องกรอกในแต่ละเครื่อง/เบราว์เซอร์ (หรือกำหนดเป็นค่าเริ่มต้นตอน build ดูใน README)
                แก้ไขข้อมูลผ่านแอปเท่านั้น — คอลัมน์ในแท็บ DB_* ที่เป็นข้อความสรุปแก้ในชีตแล้วจะไม่มีผลกับแอป
              </span>
            </div>
          </div>
        </div>

        <div className="p-3.5 sm:p-4 bg-slate-50 border-t border-slate-200 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 text-xs sm:text-sm font-bold bg-slate-900 hover:bg-slate-800 text-white rounded-xl transition-colors cursor-pointer"
          >
            ปิดหน้าต่าง
          </button>
        </div>
      </div>
    </div>
  );
};
