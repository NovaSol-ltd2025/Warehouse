import React from 'react';
import { useInventory } from '../context/InventoryContext';
import { FileSpreadsheet, RefreshCw, Settings, AlertTriangle } from 'lucide-react';

interface LiveGoogleSheetStatusBarProps {
  onOpenSettings: () => void;
  onOpenGasModal?: () => void;
}

export const LiveGoogleSheetStatusBar: React.FC<LiveGoogleSheetStatusBarProps> = ({
  onOpenSettings,
}) => {
  const { sheetsSync, isSheetsConfigured, refreshFromSheet } = useInventory();
  const { status } = sheetsSync;
  const busy = status === 'SYNCING' || status === 'CONNECTING';

  const tone =
    status === 'ONLINE'
      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-400/30'
      : status === 'ERROR'
      ? 'bg-rose-500/20 text-rose-200 border-rose-400/40'
      : status === 'NOT_CONFIGURED'
      ? 'bg-amber-500/20 text-amber-200 border-amber-400/40'
      : 'bg-blue-500/20 text-blue-200 border-blue-400/30';

  const label =
    status === 'ONLINE'
      ? 'Google Sheet: เชื่อมต่อแล้ว'
      : status === 'ERROR'
      ? 'Google Sheet: มีปัญหา'
      : status === 'NOT_CONFIGURED'
      ? 'ยังไม่เชื่อมต่อ Google Sheet (โหมดทดลอง)'
      : 'Google Sheet: กำลังซิงก์...';

  return (
    <div className="w-full px-3.5 sm:px-6 py-2 border-b text-xs bg-gradient-to-r from-slate-950 via-slate-900 to-indigo-950 text-white border-slate-800 no-print">
      <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex items-center gap-2.5 flex-wrap min-w-0">
          <button
            onClick={onOpenSettings}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] sm:text-xs font-bold cursor-pointer ${tone}`}
            title="ตั้งค่าการเชื่อมต่อ Google Sheet"
          >
            {status === 'ERROR' || status === 'NOT_CONFIGURED' ? (
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
            ) : (
              <FileSpreadsheet className="w-3.5 h-3.5 shrink-0" />
            )}
            <span>{label}</span>
          </button>
          <span className="text-slate-300 text-[11px] truncate max-w-[60vw]">
            {sheetsSync.message}
            {sheetsSync.lastSyncTime ? ` • ${sheetsSync.lastSyncTime}` : ''}
          </span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {isSheetsConfigured && (
            <button
              onClick={() => refreshFromSheet()}
              disabled={busy}
              className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 px-2.5 py-1 rounded-xl text-slate-200 text-[11px] font-bold transition-colors cursor-pointer border border-slate-700 disabled:opacity-50"
              title="โหลดข้อมูลล่าสุดจาก Google Sheet"
            >
              <RefreshCw className={`w-3 h-3 ${busy ? 'animate-spin text-emerald-400' : ''}`} />
              <span className="hidden sm:inline">โหลดข้อมูลล่าสุด</span>
            </button>
          )}
          <button
            onClick={onOpenSettings}
            className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
            title="ตั้งค่า Google Sheet"
          >
            <Settings className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
