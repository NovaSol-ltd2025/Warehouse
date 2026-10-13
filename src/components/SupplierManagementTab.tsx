import React, { useMemo, useState } from 'react';
import { Factory, Plus, Pencil, Trash2, Phone, Mail, MapPin, User, X, Search, Package } from 'lucide-react';
import { useInventory } from '../context/InventoryContext';
import { Supplier } from '../types/inventory';

type Form = {
  name: string;
  contactPerson: string;
  phone: string;
  email: string;
  address: string;
  minOrderAmount: string;
  deliveryLeadTime: string;
  notes: string;
};

const emptyForm: Form = {
  name: '',
  contactPerson: '',
  phone: '',
  email: '',
  address: '',
  minOrderAmount: '5000',
  deliveryLeadTime: '7',
  notes: '',
};

const input =
  'w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500';

export const SupplierManagementTab: React.FC = () => {
  const { suppliers, items, purchaseOrders, addSupplier, updateSupplier, deleteSupplier } = useInventory();
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState<Supplier | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<Form>(emptyForm);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [toDelete, setToDelete] = useState<Supplier | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return suppliers;
    return suppliers.filter((s) =>
      [s.name, s.contactPerson, s.phone, s.email, s.address].some((v) => (v || '').toLowerCase().includes(q))
    );
  }, [suppliers, query]);

  const openAdd = () => {
    setEditing(null);
    setForm(emptyForm);
    setError('');
    setShowForm(true);
  };

  const openEdit = (s: Supplier) => {
    setEditing(s);
    setForm({
      name: s.name,
      contactPerson: s.contactPerson || '',
      phone: s.phone || '',
      email: s.email || '',
      address: s.address || '',
      minOrderAmount: String(s.minOrderAmount ?? 0),
      deliveryLeadTime: String(s.deliveryLeadTime ?? 0),
      notes: s.notes || '',
    });
    setError('');
    setShowForm(true);
  };

  const save = async () => {
    if (!form.name.trim()) return setError('กรุณากรอกชื่อ Supplier');
    const data = {
      name: form.name.trim(),
      contactPerson: form.contactPerson.trim(),
      phone: form.phone.trim(),
      email: form.email.trim(),
      address: form.address.trim(),
      minOrderAmount: Number(form.minOrderAmount) || 0,
      deliveryLeadTime: Number(form.deliveryLeadTime) || 0,
      notes: form.notes.trim() || undefined,
    };
    setSaving(true);
    try {
      if (editing) await updateSupplier({ ...editing, ...data });
      else await addSupplier(data);
      setShowForm(false);
    } catch (e: any) {
      setError(e?.message || 'บันทึกไม่สำเร็จ');
    } finally {
      setSaving(false);
    }
  };

  const set = (k: keyof Form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Factory className="w-6 h-6 text-blue-600" /> Supplier ผู้จัดจำหน่าย
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            รายชื่อผู้จัดจำหน่ายทั้งหมด ใช้เลือกในสินค้าและใบสั่งซื้อ (PO)
          </p>
        </div>
        <button
          onClick={openAdd}
          className="px-4 py-2.5 text-sm font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-xl flex items-center gap-2 cursor-pointer"
        >
          <Plus className="w-4 h-4" /> เพิ่ม Supplier
        </button>
      </div>

      <div className="relative max-w-md">
        <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="ค้นหาชื่อ ผู้ติดต่อ เบอร์โทร..."
          className={`${input} pl-9`}
        />
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white border border-dashed border-slate-300 rounded-2xl p-10 text-center text-sm text-slate-500">
          ยังไม่มี Supplier — กด "เพิ่ม Supplier" เพื่อเริ่มต้น
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filtered.map((s) => {
            const itemCount = items.filter((i) => i.supplierId === s.id).length;
            const poCount = purchaseOrders.filter((p) => p.supplierId === s.id).length;
            return (
              <div key={s.id} className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-sm space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-bold text-slate-900 text-base">{s.name}</h3>
                    <div className="flex flex-wrap gap-2 mt-1.5 text-[11px]">
                      <span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 font-semibold flex items-center gap-1">
                        <Package className="w-3 h-3" /> สินค้า {itemCount} รายการ
                      </span>
                      <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-semibold">PO {poCount} ใบ</span>
                    </div>
                  </div>
                  <div className="flex gap-1.5 shrink-0">
                    <button onClick={() => openEdit(s)} className="p-2 rounded-lg bg-amber-50 text-amber-700 hover:bg-amber-100 cursor-pointer" title="แก้ไข">
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button onClick={() => setToDelete(s)} className="p-2 rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-100 cursor-pointer" title="ลบ">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <div className="text-xs text-slate-600 space-y-1.5">
                  {s.contactPerson && <div className="flex gap-2"><User className="w-3.5 h-3.5 mt-0.5 text-slate-400" />{s.contactPerson}</div>}
                  {s.phone && <div className="flex gap-2"><Phone className="w-3.5 h-3.5 mt-0.5 text-slate-400" />{s.phone}</div>}
                  {s.email && <div className="flex gap-2"><Mail className="w-3.5 h-3.5 mt-0.5 text-slate-400" />{s.email}</div>}
                  {s.address && <div className="flex gap-2"><MapPin className="w-3.5 h-3.5 mt-0.5 text-slate-400" />{s.address}</div>}
                </div>
                <div className="text-[11px] text-slate-500 border-t border-slate-100 pt-2">
                  สั่งขั้นต่ำ {Number(s.minOrderAmount || 0).toLocaleString()} ฿ · ส่งภายใน {s.deliveryLeadTime || 0} วัน
                  {s.notes && <div className="mt-1 text-slate-600">{s.notes}</div>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showForm && (
        <div className="no-print fixed inset-0 z-[70] bg-slate-900/80 backdrop-blur-sm flex justify-center items-start overflow-y-auto p-2 sm:p-6">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl my-2">
            <div className="flex items-center justify-between p-4 border-b border-slate-200">
              <h3 className="font-bold text-slate-900">{editing ? 'แก้ไข Supplier' : 'เพิ่ม Supplier ใหม่'}</h3>
              <button onClick={() => setShowForm(false)} className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 cursor-pointer" aria-label="ปิด">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 space-y-3">
              <label className="block text-xs font-bold text-slate-700">
                ชื่อบริษัท / ร้าน *
                <input className={`${input} mt-1`} value={form.name} onChange={set('name')} />
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="block text-xs font-bold text-slate-700">
                  ผู้ติดต่อ
                  <input className={`${input} mt-1`} value={form.contactPerson} onChange={set('contactPerson')} />
                </label>
                <label className="block text-xs font-bold text-slate-700">
                  เบอร์โทร
                  <input className={`${input} mt-1`} value={form.phone} onChange={set('phone')} />
                </label>
              </div>
              <label className="block text-xs font-bold text-slate-700">
                อีเมล
                <input className={`${input} mt-1`} value={form.email} onChange={set('email')} />
              </label>
              <label className="block text-xs font-bold text-slate-700">
                ที่อยู่
                <textarea className={`${input} mt-1`} rows={2} value={form.address} onChange={set('address')} />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block text-xs font-bold text-slate-700">
                  ยอดสั่งซื้อขั้นต่ำ (฿)
                  <input type="number" min={0} className={`${input} mt-1`} value={form.minOrderAmount} onChange={set('minOrderAmount')} />
                </label>
                <label className="block text-xs font-bold text-slate-700">
                  ระยะเวลาส่ง (วัน)
                  <input type="number" min={0} className={`${input} mt-1`} value={form.deliveryLeadTime} onChange={set('deliveryLeadTime')} />
                </label>
              </div>
              <label className="block text-xs font-bold text-slate-700">
                หมายเหตุ
                <textarea className={`${input} mt-1`} rows={2} value={form.notes} onChange={set('notes')} />
              </label>
              {error && <div className="text-xs bg-rose-50 border border-rose-200 text-rose-800 rounded-lg p-2.5">{error}</div>}
            </div>
            <div className="flex justify-end gap-2 p-4 border-t border-slate-200 bg-slate-50 rounded-b-2xl">
              <button onClick={() => setShowForm(false)} className="px-4 py-2 text-sm font-bold bg-white border border-slate-300 rounded-xl cursor-pointer">ยกเลิก</button>
              <button onClick={save} disabled={saving} className="px-5 py-2 text-sm font-bold bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white rounded-xl cursor-pointer">
                {saving ? 'กำลังบันทึก...' : 'บันทึก'}
              </button>
            </div>
          </div>
        </div>
      )}

      {toDelete && (
        <div className="no-print fixed inset-0 z-[70] bg-slate-900/80 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-5 space-y-4">
            <h3 className="font-bold text-slate-900">ลบ Supplier นี้?</h3>
            <p className="text-sm text-slate-600">
              {toDelete.name}
              {items.some((i) => i.supplierId === toDelete.id) && (
                <span className="block mt-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2">
                  มีสินค้าที่ผูกกับ Supplier นี้อยู่ สินค้าจะยังอยู่แต่ไม่มี Supplier (เลือกใหม่ได้ภายหลัง)
                </span>
              )}
            </p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setToDelete(null)} className="px-4 py-2 text-sm font-bold bg-white border border-slate-300 rounded-xl cursor-pointer">ยกเลิก</button>
              <button
                onClick={async () => {
                  await deleteSupplier(toDelete.id);
                  setToDelete(null);
                }}
                className="px-4 py-2 text-sm font-bold bg-rose-600 hover:bg-rose-700 text-white rounded-xl cursor-pointer"
              >
                ลบ
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
