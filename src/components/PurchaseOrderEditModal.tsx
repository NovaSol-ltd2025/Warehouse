import React, { useMemo, useState } from 'react';
import { useInventory } from '../context/InventoryContext';
import { OrderItemDetail, PurchaseOrder } from '../types/inventory';
import { Plus, Trash2, X, Save, Loader2, AlertTriangle } from 'lucide-react';

const CUSTOM = '__CUSTOM__';
const fmt = (n: number) => n.toLocaleString('th-TH', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
const input =
  'w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500';

interface Props {
  po: PurchaseOrder;
  onClose: () => void;
}

export const PurchaseOrderEditModal: React.FC<Props> = ({ po, onClose }) => {
  const { items: catalog, suppliers, branches, updatePurchaseOrder } = useInventory();

  const [poNumber, setPoNumber] = useState(po.poNumber);
  const [supplierId, setSupplierId] = useState(po.supplierId);
  const [orderDate, setOrderDate] = useState(po.orderDate);
  const [expected, setExpected] = useState(po.expectedDeliveryDate);
  const [destination, setDestination] = useState(po.destination);
  const [targetBranchId, setTargetBranchId] = useState(po.targetBranchId || '');
  const [notes, setNotes] = useState(po.notes || '');
  const [rows, setRows] = useState<OrderItemDetail[]>(po.items.map((i) => ({ ...i })));
  const [pick, setPick] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const total = useMemo(() => rows.reduce((s, r) => s + (Number(r.quantity) || 0) * (Number(r.unitPrice) || 0), 0), [rows]);
  const used = new Set(rows.map((r) => r.itemId));
  const patch = (i: number, p: Partial<OrderItemDetail>) => setRows((prev) => prev.map((r, k) => (k === i ? { ...r, ...p } : r)));

  const addRow = (v: string) => {
    if (!v) return;
    if (v === CUSTOM) {
      setRows((p) => [...p, { itemId: `CUSTOM-${Date.now()}`, itemName: '', quantity: 1, unit: '', unitPrice: 0 }]);
    } else {
      const it = catalog.find((c) => c.id === v);
      if (it) setRows((p) => [...p, { itemId: it.id, itemName: it.name, quantity: 1, unit: it.unit, unitPrice: it.unitPrice, historicalPrice: it.baselinePrice, imageUrl: it.imageUrl }]);
    }
    setPick('');
  };

  const save = async () => {
    setError('');
    const clean = rows.map((r) => ({ ...r, itemName: r.itemName.trim(), unit: r.unit.trim(), quantity: Number(r.quantity), unitPrice: Number(r.unitPrice) || 0 }));
    if (!clean.length) return setError('ต้องมีอย่างน้อย 1 รายการ (ถ้าไม่ต้องการ PO นี้ ให้ใช้ปุ่มลบ)');
    if (clean.some((r) => !r.itemName)) return setError('กรุณากรอกชื่อรายการให้ครบทุกแถว');
    if (clean.some((r) => !(r.quantity > 0))) return setError('จำนวนต้องมากกว่า 0 (ถ้าไม่ต้องการรายการนั้น ให้กดลบแถว)');
    if (!poNumber.trim()) return setError('กรุณากรอกเลขที่ PO');
    if (destination === 'DIRECT_BRANCH' && !targetBranchId) return setError('กรุณาเลือกสาขาปลายทาง');

    const sup = suppliers.find((s) => s.id === supplierId);
    const br = branches.find((b) => b.id === targetBranchId);
    const after: PurchaseOrder = {
      ...po,
      poNumber: poNumber.trim(),
      supplierId,
      supplierName: sup?.name || po.supplierName,
      orderDate,
      expectedDeliveryDate: expected,
      destination,
      targetBranchId: destination === 'DIRECT_BRANCH' ? targetBranchId : undefined,
      targetBranchName: destination === 'DIRECT_BRANCH' ? br?.name || po.targetBranchName : undefined,
      items: clean,
      notes: notes.trim() || undefined,
    };
    setSaving(true);
    try {
      await updatePurchaseOrder(po, after);
      onClose();
    } catch (e: any) {
      setError(e?.message || 'บันทึกไม่สำเร็จ');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="no-print fixed inset-0 z-[70] bg-slate-900/80 backdrop-blur-sm flex justify-center items-start overflow-y-auto p-2 sm:p-6">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl my-2 flex flex-col">
        <div className="flex items-start justify-between gap-3 p-4 sm:p-5 border-b border-slate-200">
          <div>
            <h3 className="font-bold text-slate-900">แก้ไขใบสั่งซื้อ {po.poNumber}</h3>
            <p className="text-xs text-slate-500 mt-0.5">แก้ไขรายการ จำนวน ราคา Supplier วันที่ และปลายทาง</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 cursor-pointer" aria-label="ปิด">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 sm:p-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <label className="text-xs font-bold text-slate-700">
              เลขที่ PO
              <input className={`${input} mt-1`} value={poNumber} onChange={(e) => setPoNumber(e.target.value)} />
            </label>
            <label className="text-xs font-bold text-slate-700 sm:col-span-2">
              Supplier
              <select className={`${input} mt-1`} value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
                {!suppliers.some((s) => s.id === po.supplierId) && <option value={po.supplierId}>{po.supplierName}</option>}
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </label>
            <label className="text-xs font-bold text-slate-700">
              วันที่สั่ง
              <input type="date" className={`${input} mt-1`} value={orderDate} onChange={(e) => setOrderDate(e.target.value)} />
            </label>
            <label className="text-xs font-bold text-slate-700">
              กำหนดได้รับสินค้า
              <input type="date" className={`${input} mt-1`} value={expected} onChange={(e) => setExpected(e.target.value)} />
            </label>
            <label className="text-xs font-bold text-slate-700">
              ปลายทางส่งมอบ
              <select className={`${input} mt-1`} value={destination} onChange={(e) => setDestination(e.target.value as PurchaseOrder['destination'])}>
                <option value="HQ_WAREHOUSE">คลังสินค้า สนง.ใหญ่ โนวาโซล</option>
                <option value="DIRECT_BRANCH">ส่งตรงถึงสาขา</option>
              </select>
            </label>
          </div>
          {destination === 'DIRECT_BRANCH' && (
            <label className="block text-xs font-bold text-slate-700">
              สาขาปลายทาง
              <select className={`${input} mt-1`} value={targetBranchId} onChange={(e) => setTargetBranchId(e.target.value)}>
                <option value="">— เลือกสาขา —</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </label>
          )}

          <div className="space-y-2">
            <div className="hidden sm:grid grid-cols-[2rem_1fr_5.5rem_5rem_6rem_2.2rem] gap-2 text-[11px] font-bold text-slate-500 px-1">
              <span>ที่</span><span>รายการ</span><span>จำนวน</span><span>หน่วย</span><span>ราคา/หน่วย</span><span />
            </div>
            {rows.map((r, i) => (
              <div key={`${r.itemId}-${i}`} className="grid grid-cols-2 sm:grid-cols-[2rem_1fr_5.5rem_5rem_6rem_2.2rem] gap-2 items-center bg-slate-50 sm:bg-transparent rounded-lg p-2 sm:p-0 border sm:border-0 border-slate-200">
                <span className="hidden sm:block text-xs text-slate-500 text-center">{i + 1}</span>
                <input className={`${input} col-span-2 sm:col-span-1`} value={r.itemName} placeholder="ชื่อรายการ" onChange={(e) => patch(i, { itemName: e.target.value })} />
                <input className={input} type="number" min={0} step="any" aria-label="จำนวน" value={r.quantity} onChange={(e) => patch(i, { quantity: e.target.value === '' ? 0 : Number(e.target.value) })} />
                <input className={input} value={r.unit} placeholder="หน่วย" onChange={(e) => patch(i, { unit: e.target.value })} />
                <input className={input} type="number" min={0} step="any" aria-label="ราคาต่อหน่วย" value={r.unitPrice} onChange={(e) => patch(i, { unitPrice: e.target.value === '' ? 0 : Number(e.target.value) })} />
                <button onClick={() => setRows((p) => p.filter((_, k) => k !== i))} className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg justify-self-end cursor-pointer" title="ลบแถวนี้">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <select value={pick} onChange={(e) => addRow(e.target.value)} className={`${input} sm:max-w-md`}>
                <option value="">+ เพิ่มรายการจากคลังสินค้า...</option>
                {catalog.filter((c) => !used.has(c.id)).map((c) => (
                  <option key={c.id} value={c.id}>{c.code} · {c.name}</option>
                ))}
                <option value={CUSTOM}>รายการอื่น (พิมพ์ชื่อเอง)</option>
              </select>
              <span className="ml-auto text-sm font-bold text-slate-900">ยอดรวม {fmt(total)} ฿</span>
            </div>
          </div>

          <label className="block text-xs font-bold text-slate-700">
            หมายเหตุ
            <textarea className={`${input} mt-1`} rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </label>

          {po.status === 'RECEIVED' && po.destination === 'HQ_WAREHOUSE' && (
            <div className="flex items-start gap-2 text-[11px] bg-blue-50 border border-blue-200 text-blue-900 rounded-lg p-2.5">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>ใบนี้ตรวจรับเข้าคลังแล้ว เมื่อบันทึก ระบบจะลงรายการรับเข้า/ย้อนรายการในสต็อกตามส่วนต่างของจำนวนให้อัตโนมัติ</span>
            </div>
          )}
          {po.paymentStatus === 'PAID' && total !== po.totalAmount && (
            <div className="flex items-start gap-2 text-[11px] bg-amber-50 border border-amber-200 text-amber-900 rounded-lg p-2.5">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>ใบนี้บันทึก "จ่ายเงินแล้ว" ไว้ที่ยอดเดิม {fmt(po.totalAmount)} ฿ — ยอดใหม่ต่างกัน {fmt(total - po.totalAmount)} ฿ โปรดตรวจสอบการจ่ายเงิน</span>
            </div>
          )}
          {error && <div className="text-xs bg-rose-50 border border-rose-200 text-rose-800 rounded-lg p-2.5">{error}</div>}
        </div>

        <div className="flex justify-end gap-2 p-4 border-t border-slate-200 bg-slate-50 rounded-b-2xl">
          <button onClick={onClose} className="px-4 py-2 text-sm font-bold bg-white border border-slate-300 rounded-xl cursor-pointer">ยกเลิก</button>
          <button onClick={save} disabled={saving} className="px-5 py-2 text-sm font-bold bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white rounded-xl flex items-center gap-1.5 cursor-pointer">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} บันทึกการแก้ไข
          </button>
        </div>
      </div>
    </div>
  );
};
