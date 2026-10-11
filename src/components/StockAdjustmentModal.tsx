import React, { useState } from 'react';
import { useInventory } from '../context/InventoryContext';
import { InventoryItem } from '../types/inventory';
import { X, ArrowDownRight, ArrowUpRight, CheckCircle2 } from 'lucide-react';

interface StockAdjustmentModalProps {
  item: InventoryItem;
  onClose: () => void;
}

export const StockAdjustmentModal: React.FC<StockAdjustmentModalProps> = ({ item, onClose }) => {
  const { adjustStock } = useInventory();
  const [type, setType] = useState<'IN' | 'OUT' | 'AUDIT'>('IN');
  const [quantity, setQuantity] = useState<number>(1);
  const [newTotalStock, setNewTotalStock] = useState<number>(item.currentStockHQ);
  const [notes, setNotes] = useState<string>('');
  const [referenceNo, setReferenceNo] = useState<string>('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (type === 'AUDIT') {
      const delta = newTotalStock - item.currentStockHQ;
      adjustStock(item.id, delta, 'ADJUSTMENT', referenceNo || 'ตรวจนับสต็อก', notes || 'ปรับยอดตรวจนับจริง');
    } else if (type === 'IN') {
      adjustStock(item.id, quantity, 'IN_SUPPLIER', referenceNo || 'รับเข้าคลัง', notes || 'รับของเข้าคลัง สนง.ใหญ่');
    } else {
      adjustStock(item.id, -quantity, 'OUT_BRANCH', referenceNo || 'เบิกใช้งาน', notes || 'เบิกใช้งานทั่วไป');
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex justify-center items-center p-4">
      <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="bg-slate-900 text-white p-5 flex items-start justify-between">
          <div>
            <h3 className="font-bold text-base">ปรับปรุงยอดสต็อกคลัง สนง.ใหญ่</h3>
            <p className="text-xs text-slate-300 mt-1">{item.name}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 flex justify-between items-center text-xs">
            <span className="text-slate-600">สต็อกคงเหลือปัจจุบัน:</span>
            <span className="text-base font-bold text-slate-900">
              {item.currentStockHQ} {item.unit}
            </span>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              ประเภทการปรับยอด
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setType('IN')}
                className={`py-2 px-3 text-xs font-semibold rounded-lg border flex items-center justify-center gap-1.5 ${
                  type === 'IN'
                    ? 'bg-emerald-50 border-emerald-500 text-emerald-800 ring-2 ring-emerald-500/20'
                    : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
                }`}
              >
                <ArrowDownRight className="w-4 h-4 text-emerald-600" />
                รับเข้า (+)
              </button>
              <button
                type="button"
                onClick={() => setType('OUT')}
                className={`py-2 px-3 text-xs font-semibold rounded-lg border flex items-center justify-center gap-1.5 ${
                  type === 'OUT'
                    ? 'bg-rose-50 border-rose-500 text-rose-800 ring-2 ring-rose-500/20'
                    : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
                }`}
              >
                <ArrowUpRight className="w-4 h-4 text-rose-600" />
                จ่ายออก (-)
              </button>
              <button
                type="button"
                onClick={() => setType('AUDIT')}
                className={`py-2 px-3 text-xs font-semibold rounded-lg border flex items-center justify-center gap-1.5 ${
                  type === 'AUDIT'
                    ? 'bg-blue-50 border-blue-500 text-blue-800 ring-2 ring-blue-500/20'
                    : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
                }`}
              >
                ตรวจนับใหม่
              </button>
            </div>
          </div>

          {type === 'AUDIT' ? (
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                จำนวนที่ตรวจนับได้จริงในคลัง ({item.unit})
              </label>
              <input
                type="number"
                min={0}
                value={newTotalStock}
                onChange={(e) => setNewTotalStock(parseInt(e.target.value) || 0)}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          ) : (
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                จำนวนที่{type === 'IN' ? 'รับเข้า' : 'เบิกจ่าย'} ({item.unit})
              </label>
              <input
                type="number"
                min={1}
                value={quantity}
                onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              เลขอ้างอิง / เอกสาร
            </label>
            <input
              type="text"
              placeholder="เช่น PO-2610-001 หรือ ใบร้องขอเบิก"
              value={referenceNo}
              onChange={(e) => setReferenceNo(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              หมายเหตุ
            </label>
            <input
              type="text"
              placeholder="ระบุเหตุผล เช่น สินค้าชำรุด, ตรวจนับประจำเดือน"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div className="pt-2 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800"
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-4 py-2 rounded-xl transition-colors"
            >
              บันทึกการปรับยอด
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
