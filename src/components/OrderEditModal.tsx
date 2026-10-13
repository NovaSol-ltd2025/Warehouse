import React, { useMemo, useState } from 'react';
import { useInventory } from '../context/InventoryContext';
import { BranchOrder, OrderItemDetail, RoutingType } from '../types/inventory';
import { Plus, Trash2, X, Save, AlertTriangle, Loader2 } from 'lucide-react';

/** แบบฟอร์มใบส่งของจริงมี 20 แถว */
const MAX_ROWS = 20;
const CUSTOM = '__CUSTOM__';

interface OrderEditModalProps {
  order: BranchOrder;
  onClose: () => void;
  onSaved?: (updated: BranchOrder) => void;
}

const fmt = (n: number) => n.toLocaleString('th-TH', { minimumFractionDigits: 0, maximumFractionDigits: 2 });

export const OrderEditModal: React.FC<OrderEditModalProps> = ({ order, onClose, onSaved }) => {
  const { items: catalog, branches, updateBranchOrder, reconcileDeliveredOrder } = useInventory();

  const [branchId, setBranchId] = useState(order.branchId);
  const [date, setDate] = useState(order.date);
  const [routing, setRouting] = useState<RoutingType>(order.routingType);
  const [receiverName, setReceiverName] = useState(order.receiverName || '');
  const [senderName, setSenderName] = useState(order.senderName || '');
  const [notes, setNotes] = useState(order.notes || '');
  const [rows, setRows] = useState<OrderItemDetail[]>(order.items.map((it) => ({ ...it })));
  const [pickValue, setPickValue] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const total = useMemo(() => rows.reduce((s, r) => s + (Number(r.quantity) || 0) * (Number(r.unitPrice) || 0), 0), [rows]);
  const suggestedRouting: RoutingType = total >= 5000 ? 'SUPPLIER_DIRECT' : 'HQ_DELIVERY';
  const usedIds = new Set(rows.map((r) => r.itemId));

  const patchRow = (idx: number, patch: Partial<OrderItemDetail>) =>
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)));

  const addRow = (value: string) => {
    if (!value) return;
    if (rows.length >= MAX_ROWS) {
      setError(`ใบส่งของ A4 มีได้สูงสุด ${MAX_ROWS} รายการ ถ้ามีมากกว่านี้ให้แยกเป็นอีกใบ`);
      return;
    }
    setError('');
    if (value === CUSTOM) {
      setRows((prev) => [
        ...prev,
        { itemId: `CUSTOM-${Date.now()}`, itemName: '', quantity: 1, unit: '', unitPrice: 0 },
      ]);
    } else {
      const it = catalog.find((c) => c.id === value);
      if (!it) return;
      setRows((prev) => [
        ...prev,
        {
          itemId: it.id,
          itemName: it.name,
          quantity: 1,
          unit: it.unit,
          unitPrice: it.unitPrice,
          historicalPrice: it.baselinePrice,
          imageUrl: it.imageUrl,
        },
      ]);
    }
    setPickValue('');
  };

  const handleSave = async () => {
    setError('');
    const clean = rows.map((r) => ({ ...r, itemName: r.itemName.trim(), unit: r.unit.trim(), quantity: Number(r.quantity) }));
    if (clean.length === 0) return setError('ต้องมีอย่างน้อย 1 รายการ (ถ้าไม่ต้องการใบส่งของนี้ ให้ใช้ปุ่มลบ)');
    if (clean.some((r) => !r.itemName)) return setError('กรุณากรอกชื่อรายการให้ครบทุกแถว');
    if (clean.some((r) => !(r.quantity > 0))) return setError('จำนวนต้องมากกว่า 0 (ถ้าไม่ต้องการรายการนั้น ให้กดลบแถว)');
    if (!date) return setError('กรุณาระบุวันที่');

    const branch = branches.find((b) => b.id === branchId);
    const updated: BranchOrder = {
      ...order,
      branchId,
      branchName: branch ? branch.name : order.branchName,
      date,
      items: clean.map((r) => {
        const { remark, ...rest } = r;
        return remark?.trim() ? { ...rest, remark: remark.trim() } : rest;
      }),
      totalAmount: clean.reduce((s, r) => s + r.quantity * (Number(r.unitPrice) || 0), 0),
      routingType: routing,
      receiverName: receiverName.trim() || undefined,
      senderName: senderName.trim() || undefined,
      notes: notes.trim() || undefined,
    };

    setSaving(true);
    try {
      await updateBranchOrder(updated);

      // ใบที่ยืนยันส่งแล้ว: ลงบัญชีสต็อก (รับเข้า/จ่ายออก) ตามส่วนต่างที่แก้
      await reconcileDeliveredOrder(order, updated);

      onSaved?.(updated);
      onClose();
    } catch (err: any) {
      setError(err?.message || 'บันทึกไม่สำเร็จ');
    } finally {
      setSaving(false);
    }
  };

  const input =
    'w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500';

  return (
    <div className="no-print fixed inset-0 z-[70] bg-slate-900/80 backdrop-blur-sm flex justify-center items-start overflow-y-auto p-2 sm:p-6">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl my-2 flex flex-col">
        <div className="flex items-start justify-between gap-3 p-4 sm:p-5 border-b border-slate-200">
          <div>
            <h3 className="text-base sm:text-lg font-bold text-slate-900">แก้ไขใบส่งสินค้า {order.deliveryOrderNo}</h3>
            <p className="text-xs text-slate-500 mt-0.5">เพิ่ม/ลบรายการ ปรับจำนวน ราคา หมายเหตุ ได้ตามที่ส่งจริง</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 cursor-pointer" aria-label="ปิด">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 sm:p-5 space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <label className="text-xs font-bold text-slate-700">
              สาขาปลายทาง
              <select value={branchId} onChange={(e) => setBranchId(e.target.value)} className={`${input} mt-1`}>
                {!branches.some((b) => b.id === order.branchId) && <option value={order.branchId}>{order.branchName}</option>}
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs font-bold text-slate-700">
              วันที่
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={`${input} mt-1`} />
            </label>
            <label className="text-xs font-bold text-slate-700">
              รูปแบบการจัดส่ง
              <select value={routing} onChange={(e) => setRouting(e.target.value as RoutingType)} className={`${input} mt-1`}>
                <option value="HQ_DELIVERY">รวมส่งที่ สนง.ใหญ่ (โนวาโซลนำส่งเอง)</option>
                <option value="SUPPLIER_DIRECT">Supplier ส่งตรงถึงสาขา</option>
              </select>
            </label>
          </div>

          {routing !== suggestedRouting && (
            <div className="flex items-start gap-2 text-xs bg-amber-50 border border-amber-200 text-amber-900 rounded-lg p-2.5">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>
                ยอดรวมใหม่ {fmt(total)} ฿ ตามเกณฑ์ 5,000 ฿ ระบบแนะนำ{' '}
                <strong>{suggestedRouting === 'SUPPLIER_DIRECT' ? 'Supplier ส่งตรงถึงสาขา' : 'รวมส่งที่ สนง.ใหญ่'}</strong>{' '}
                <button type="button" onClick={() => setRouting(suggestedRouting)} className="underline font-bold cursor-pointer">
                  ใช้ตามที่แนะนำ
                </button>
              </span>
            </div>
          )}

          <div className="space-y-2">
            <div className="hidden sm:grid grid-cols-[2.2rem_1fr_5.5rem_5rem_6rem_9rem_2.2rem] gap-2 text-[11px] font-bold text-slate-500 px-1">
              <span>ที่</span>
              <span>รายการ</span>
              <span>จำนวน</span>
              <span>หน่วย</span>
              <span>ราคา/หน่วย</span>
              <span>หมายเหตุ</span>
              <span />
            </div>

            {rows.map((r, idx) => (
              <div
                key={`${r.itemId}-${idx}`}
                className="grid grid-cols-2 sm:grid-cols-[2.2rem_1fr_5.5rem_5rem_6rem_9rem_2.2rem] gap-2 items-center bg-slate-50 sm:bg-transparent rounded-lg p-2 sm:p-0 border sm:border-0 border-slate-200"
              >
                <span className="hidden sm:block text-xs text-slate-500 text-center">{idx + 1}</span>
                <input
                  className={`${input} col-span-2 sm:col-span-1`}
                  value={r.itemName}
                  placeholder="ชื่อรายการ"
                  onChange={(e) => patchRow(idx, { itemName: e.target.value })}
                />
                <input
                  className={input}
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step="any"
                  value={r.quantity}
                  onChange={(e) => patchRow(idx, { quantity: e.target.value === '' ? (0 as number) : Number(e.target.value) })}
                  aria-label="จำนวน"
                />
                <input className={input} value={r.unit} placeholder="หน่วย" onChange={(e) => patchRow(idx, { unit: e.target.value })} />
                <input
                  className={input}
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step="any"
                  value={r.unitPrice}
                  onChange={(e) => patchRow(idx, { unitPrice: e.target.value === '' ? 0 : Number(e.target.value) })}
                  aria-label="ราคาต่อหน่วย"
                />
                <input
                  className={input}
                  value={r.remark || ''}
                  placeholder="หมายเหตุ"
                  onChange={(e) => patchRow(idx, { remark: e.target.value })}
                />
                <button
                  type="button"
                  onClick={() => setRows((prev) => prev.filter((_, i) => i !== idx))}
                  className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg justify-self-end cursor-pointer"
                  title="ลบแถวนี้"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}

            <div className="flex flex-wrap items-center gap-2 pt-1">
              <select
                value={pickValue}
                onChange={(e) => addRow(e.target.value)}
                disabled={rows.length >= MAX_ROWS}
                className={`${input} sm:max-w-md`}
              >
                <option value="">+ เพิ่มรายการจากคลังสินค้า...</option>
                {catalog
                  .filter((c) => !usedIds.has(c.id))
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.code} · {c.name}
                    </option>
                  ))}
                <option value={CUSTOM}>รายการอื่น (พิมพ์ชื่อเอง)</option>
              </select>
              <span className="text-[11px] text-slate-500">
                {rows.length}/{MAX_ROWS} แถว
              </span>
              <span className="ml-auto text-sm font-bold text-slate-900">ยอดรวม {fmt(total)} ฿</span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="text-xs font-bold text-slate-700">
              ผู้รับสินค้า
              <input className={`${input} mt-1`} value={receiverName} onChange={(e) => setReceiverName(e.target.value)} />
            </label>
            <label className="text-xs font-bold text-slate-700">
              ผู้ส่งสินค้า
              <input className={`${input} mt-1`} value={senderName} onChange={(e) => setSenderName(e.target.value)} />
            </label>
          </div>
          <label className="block text-xs font-bold text-slate-700">
            หมายเหตุใบส่งของ
            <textarea className={`${input} mt-1`} rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </label>

          {order.status === 'DELIVERED' && (
            <p className="text-[11px] text-slate-500">
              ใบนี้ยืนยันส่งแล้ว เมื่อบันทึก ระบบจะลงรายการรับเข้า/จ่ายออกตามส่วนต่างของจำนวนที่แก้ให้อัตโนมัติ
            </p>
          )}

          {error && <div className="text-xs bg-rose-50 border border-rose-200 text-rose-800 rounded-lg p-2.5">{error}</div>}
        </div>

        <div className="flex justify-end gap-2 p-4 sm:p-5 border-t border-slate-200 bg-slate-50 rounded-b-2xl">
          <button onClick={onClose} className="px-4 py-2 text-xs sm:text-sm font-bold bg-white border border-slate-300 hover:bg-slate-100 rounded-xl cursor-pointer">
            ยกเลิก
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-5 py-2 text-xs sm:text-sm font-bold bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white rounded-xl flex items-center gap-1.5 cursor-pointer"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            <span>บันทึกการแก้ไข</span>
          </button>
        </div>
      </div>
    </div>
  );
};
