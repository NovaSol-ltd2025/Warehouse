import React, { useMemo, useState } from 'react';
import { Wallet, Download, CheckCircle2, AlertTriangle } from 'lucide-react';
import { useInventory } from '../context/InventoryContext';
import { PaymentInstallment } from '../types/inventory';
import { planSummary, termsLabel, todayYmd, addDays } from '../utils/payment';
import { fmtDate } from './PaymentButton';

type Doc = {
  key: string;
  kind: 'PO' | 'DO';
  id: string;
  no: string;
  date: string;
  supplier: string;
  target: string;
  amount: number;
  paid: boolean;
  paidAt?: string;
  paymentRef?: string;
  plan: PaymentInstallment[];
  terms: string;
};

const fmt = (n: number) => n.toLocaleString('th-TH', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
const BUDGET_KEY = 'novasol.monthlyBudget';
const thMonth = (ym: string) => {
  const [y, m] = ym.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('th-TH', { month: 'long', year: 'numeric' });
};

const readBudget = (): Record<string, number> => {
  try {
    return JSON.parse(localStorage.getItem(BUDGET_KEY) || '{}') || {};
  } catch {
    return {};
  }
};

export const BudgetReportTab: React.FC = () => {
  const { purchaseOrders, branchOrders, items, suppliers, markOrderPayment, markPOPayment, planForPO, planForOrder, supplierOfOrder } = useInventory();
  const nowYm = new Date().toISOString().slice(0, 7);
  const [month, setMonth] = useState(nowYm);
  const [filter, setFilter] = useState<'ALL' | 'UNPAID' | 'PAID'>('ALL');
  const [budgets, setBudgets] = useState<Record<string, number>>(readBudget);

  const budget = budgets[month] || 0;
  const setBudget = (v: number) => {
    const next = { ...budgets, [month]: v };
    setBudgets(next);
    try {
      localStorage.setItem(BUDGET_KEY, JSON.stringify(next));
    } catch {}
  };

  const supplierName = (id?: string) => suppliers.find((s) => s.id === id)?.name;

  // เอกสารที่ต้องจ่ายเงิน: PO ที่สั่งแล้ว + ใบส่งของแบบ Supplier ส่งตรง (ใบรวมส่ง สนง.ใหญ่ใช้ของจาก PO แล้ว จึงไม่นับซ้ำ)
  const docs: Doc[] = useMemo(() => {
    const out: Doc[] = [];
    purchaseOrders.forEach((po) => {
      if (po.status === 'DRAFT') return;
      out.push({
        key: `PO-${po.id}`,
        kind: 'PO',
        id: po.id,
        no: po.poNumber,
        date: po.orderDate,
        supplier: po.supplierName || supplierName(po.supplierId) || 'ไม่ระบุ Supplier',
        target: po.destination === 'DIRECT_BRANCH' ? po.targetBranchName || 'สาขา' : 'คลัง สนง.ใหญ่',
        amount: po.totalAmount,
        paid: planSummary(planForPO(po)).allPaid,
        paidAt: po.paidAt,
        paymentRef: po.paymentRef,
        plan: planForPO(po),
        terms: termsLabel(suppliers.find((x) => x.id === po.supplierId)),
      });
    });
    branchOrders.forEach((o) => {
      if (o.routingType !== 'SUPPLIER_DIRECT') return;
      const firstItem = items.find((i) => i.id === o.items[0]?.itemId);
      out.push({
        key: `DO-${o.id}`,
        kind: 'DO',
        id: o.id,
        no: o.deliveryOrderNo,
        date: o.date,
        supplier: supplierOfOrder(o)?.name || supplierName(firstItem?.supplierId) || 'ไม่ระบุ Supplier',
        target: o.branchName,
        amount: o.totalAmount,
        paid: planSummary(planForOrder(o)).allPaid,
        paidAt: o.paidAt,
        paymentRef: o.paymentRef,
        plan: planForOrder(o),
        terms: termsLabel(supplierOfOrder(o)),
      });
    });
    return out.sort((a, b) => b.date.localeCompare(a.date));
  }, [purchaseOrders, branchOrders, items, suppliers]);

  const monthDocs = docs.filter((d) => d.date.slice(0, 7) === month);
  const spend = monthDocs.reduce((s, d) => s + d.amount, 0);
  const paidAmt = monthDocs.reduce((s, d) => s + planSummary(d.plan).paidAmount, 0);
  const unpaidAmt = spend - paidAmt;
  const pct = budget > 0 ? (spend / budget) * 100 : 0;

  // ตารางกำหนดจ่ายที่ยังไม่ชำระ (ทุกเดือน) เรียงตามวันครบกำหนด เพื่อวางแผนเงินสดหมุนเวียน
  const today = todayYmd();
  const dueRows = useMemo(
    () =>
      docs
        .flatMap((d) => d.plan.filter((p) => !p.paid).map((p) => ({ d, p })))
        .sort((a, b) => a.p.dueDate.localeCompare(b.p.dueDate)),
    [docs]
  );
  const allUnpaidAmt = dueRows.reduce((s, r) => s + r.p.amount, 0);
  const overdueRows = dueRows.filter((r) => r.p.dueDate < today);
  const overdueAmt = overdueRows.reduce((s, r) => s + r.p.amount, 0);
  const soonLimit = addDays(today, 7);
  const soonAmt = dueRows.filter((r) => r.p.dueDate >= today && r.p.dueDate <= soonLimit).reduce((s, r) => s + r.p.amount, 0);
  const cashByMonth = useMemo(() => {
    const m = new Map<string, number>();
    dueRows.forEach((r) => {
      const ym = r.p.dueDate < today ? 'เกินกำหนด' : r.p.dueDate.slice(0, 7);
      m.set(ym, (m.get(ym) || 0) + r.p.amount);
    });
    return [...m.entries()];
  }, [dueRows, today]);

  const bySupplier = useMemo(() => {
    const m = new Map<string, { total: number; unpaid: number; count: number; oldest: string; terms: string }>();
    docs.forEach((d) => {
      const cur = m.get(d.supplier) || { total: 0, unpaid: 0, count: 0, oldest: '', terms: d.terms };
      if (d.date.slice(0, 7) === month) cur.total += d.amount;
      const un = d.plan.filter((p) => !p.paid);
      if (un.length) {
        cur.unpaid += un.reduce((s, p) => s + p.amount, 0);
        cur.count += 1;
        const first = un[0].dueDate;
        if (!cur.oldest || first < cur.oldest) cur.oldest = first;
      }
      m.set(d.supplier, cur);
    });
    return [...m.entries()].filter(([, v]) => v.total > 0 || v.unpaid > 0).sort((a, b) => b[1].unpaid - a[1].unpaid);
  }, [docs, month]);

  // การใช้ของแต่ละสาขา (ทุกใบที่ส่งแล้วในเดือน ไม่ว่าจะส่งตรงหรือผ่าน สนง.ใหญ่) เพื่อควบคุมปริมาณการใช้
  const byBranch = useMemo(() => {
    const m = new Map<string, { amount: number; orders: number }>();
    branchOrders
      .filter((o) => o.status === 'DELIVERED' && (o.deliveryDate || o.date).slice(0, 7) === month)
      .forEach((o) => {
        const cur = m.get(o.branchName) || { amount: 0, orders: 0 };
        cur.amount += o.totalAmount;
        cur.orders += 1;
        m.set(o.branchName, cur);
      });
    return [...m.entries()].sort((a, b) => b[1].amount - a[1].amount);
  }, [branchOrders, month]);

  const trend = useMemo(() => {
    const [y, m] = month.split('-').map(Number);
    return Array.from({ length: 6 }, (_, i) => {
      const d = new Date(y, m - 1 - (5 - i), 1);
      const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      return { ym, total: docs.filter((x) => x.date.slice(0, 7) === ym).reduce((s, x) => s + x.amount, 0) };
    });
  }, [docs, month]);
  const trendMax = Math.max(1, ...trend.map((t) => t.total), budget);

  const shown = monthDocs.filter((d) => (filter === 'ALL' ? true : filter === 'PAID' ? d.paid : !d.paid));

  const payInst = (d: Doc, p: PaymentInstallment) => {
    const fn = d.kind === 'PO' ? markPOPayment : markOrderPayment;
    if (p.paid) {
      if (window.confirm('ยกเลิกสถานะ "จ่ายแล้ว" ของงวดนี้?')) fn(d.id, false, '', p.seq);
    } else {
      const ref = window.prompt(
        `บันทึกการจ่าย ${d.no}${d.plan.length > 1 ? ` งวดที่ ${p.seq}/${d.plan.length}` : ''} จำนวน ${fmt(p.amount)} ฿\nเลขที่อ้างอิง/ใบเสร็จ/โอน (ไม่บังคับ)`,
        ''
      );
      if (ref !== null) fn(d.id, true, ref.trim(), p.seq);
    }
  };

  const exportCsv = () => {
    const esc = (v: any) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const rows = [
      ['ประเภท', 'เลขที่', 'วันที่สั่ง', 'Supplier', 'ปลายทาง', 'ยอดทั้งใบ (บาท)', 'เงื่อนไขชำระเงิน', 'งวดที่', 'ครบกำหนด', 'ยอดงวด (บาท)', 'สถานะ', 'วันที่จ่าย', 'เลขอ้างอิง'],
      ...monthDocs.flatMap((d) =>
        d.plan.map((p) => [
          d.kind === 'PO' ? 'ใบสั่งซื้อ' : 'ใบส่งของ(ส่งตรง)',
          d.no,
          d.date,
          d.supplier,
          d.target,
          d.amount,
          d.terms,
          `${p.seq}/${d.plan.length}`,
          p.dueDate,
          p.amount,
          p.paid ? 'จ่ายแล้ว' : p.dueDate < today ? 'เกินกำหนด' : 'ค้างจ่าย',
          p.paidAt || '',
          p.paymentRef || '',
        ])
      ),
    ];
    const blob = new Blob(['﻿' + rows.map((r) => r.map(esc).join(',')).join('\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `รายงานค้างจ่าย-${month}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  };

  const card = 'bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-sm';

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Wallet className="w-6 h-6 text-blue-600" /> รายงานงบประมาณ & ยอดค้างจ่าย
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            นับยอดจากใบสั่งซื้อ (PO) และใบส่งของแบบ Supplier ส่งตรงสาขา — ใบที่ส่งจากคลัง สนง.ใหญ่ใช้ของที่ซื้อผ่าน PO แล้ว จึงไม่นับซ้ำ
          </p>
        </div>
        <div className="flex items-center gap-2">
          <input type="month" value={month} onChange={(e) => e.target.value && setMonth(e.target.value)} className="border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white" />
          <button onClick={exportCsv} className="px-3 py-2 text-sm font-bold bg-white border border-slate-300 hover:bg-slate-50 rounded-xl flex items-center gap-1.5 cursor-pointer">
            <Download className="w-4 h-4" /> CSV
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className={card}>
          <div className="text-xs text-slate-500">ยอดสั่งซื้อ {thMonth(month)}</div>
          <div className="text-2xl font-extrabold text-slate-900 mt-1">{fmt(spend)} ฿</div>
          <div className="text-[11px] text-slate-500 mt-1">{monthDocs.length} เอกสาร</div>
        </div>
        <div className={card}>
          <div className="text-xs text-slate-500">จ่ายแล้ว</div>
          <div className="text-2xl font-extrabold text-emerald-700 mt-1">{fmt(paidAmt)} ฿</div>
        </div>
        <div className={card}>
          <div className="text-xs text-slate-500">ยังไม่จ่าย (ของยอดสั่งเดือนนี้)</div>
          <div className="text-2xl font-extrabold text-rose-700 mt-1">{fmt(unpaidAmt)} ฿</div>
          <div className="text-[11px] text-slate-500 mt-1">ค้างจ่ายสะสมทุกเดือน {fmt(allUnpaidAmt)} ฿ ({dueRows.length} งวด)</div>
        </div>
        <div className={card}>
          <div className="text-xs text-slate-500 flex items-center justify-between">
            งบประมาณเดือนนี้
          </div>
          <div className="flex items-center gap-1 mt-1">
            <input
              type="number"
              min={0}
              value={budget || ''}
              placeholder="ตั้งงบ"
              onChange={(e) => setBudget(Number(e.target.value) || 0)}
              className="w-full border border-slate-300 rounded-lg px-2 py-1 text-sm font-bold"
            />
            <span className="text-sm">฿</span>
          </div>
          {budget > 0 ? (
            <>
              <div className="h-2 bg-slate-100 rounded-full mt-2 overflow-hidden">
                <div className={`h-full ${pct > 100 ? 'bg-rose-500' : pct > 80 ? 'bg-amber-500' : 'bg-emerald-500'}`} style={{ width: `${Math.min(100, pct)}%` }} />
              </div>
              <div className={`text-[11px] mt-1 font-semibold ${pct > 100 ? 'text-rose-700' : 'text-slate-600'}`}>
                {pct > 100 ? (
                  <span className="inline-flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> เกินงบ {fmt(spend - budget)} ฿</span>
                ) : (
                  `ใช้ไป ${pct.toFixed(0)}% · เหลือ ${fmt(budget - spend)} ฿`
                )}
              </div>
            </>
          ) : (
            <div className="text-[11px] text-slate-400 mt-1">กรอกงบเพื่อดูเปอร์เซ็นต์การใช้</div>
          )}
          <div className="text-[10px] text-slate-400 mt-1">เก็บในเบราว์เซอร์เครื่องนี้</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className={card}>
          <h3 className="font-bold text-slate-900 text-sm mb-3">ยอดค้างจ่ายแยกตาม Supplier</h3>
          {bySupplier.length === 0 ? (
            <p className="text-xs text-slate-500">ยังไม่มีข้อมูล</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-slate-500 border-b border-slate-200 text-left">
                    <th className="py-1.5">Supplier</th>
                    <th className="py-1.5 text-right">ซื้อเดือนนี้</th>
                    <th className="py-1.5 text-right">ค้างจ่าย</th>
                    <th className="py-1.5 text-right">ใบ</th>
                    <th className="py-1.5 text-right">ครบกำหนดแรก</th>
                  </tr>
                </thead>
                <tbody>
                  {bySupplier.map(([name, v]) => (
                    <tr key={name} className="border-b border-slate-100">
                      <td className="py-1.5 font-semibold text-slate-800">{name}<div className="text-[10px] font-normal text-slate-500">{v.terms}</div></td>
                      <td className="py-1.5 text-right">{fmt(v.total)}</td>
                      <td className={`py-1.5 text-right font-bold ${v.unpaid > 0 ? 'text-rose-700' : 'text-slate-400'}`}>{fmt(v.unpaid)}</td>
                      <td className="py-1.5 text-right">{v.count}</td>
                      <td className="py-1.5 text-right text-slate-500">{v.oldest ? fmtDate(v.oldest) : '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className={card}>
          <h3 className="font-bold text-slate-900 text-sm mb-3">มูลค่าที่ส่งถึงแต่ละสาขา (ส่งแล้ว) {thMonth(month)}</h3>
          {byBranch.length === 0 ? (
            <p className="text-xs text-slate-500">เดือนนี้ยังไม่มีใบส่งของที่ยืนยันส่งแล้ว</p>
          ) : (
            <div className="space-y-2">
              {byBranch.map(([name, v]) => (
                <div key={name}>
                  <div className="flex justify-between text-xs">
                    <span className="font-semibold text-slate-800">{name}</span>
                    <span>{fmt(v.amount)} ฿ · {v.orders} ใบ</span>
                  </div>
                  <div className="h-1.5 bg-slate-100 rounded-full mt-1">
                    <div className="h-full bg-blue-500 rounded-full" style={{ width: `${(v.amount / byBranch[0][1].amount) * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className={card}>
        <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
          <div>
            <h3 className="font-bold text-slate-900 text-sm">แผนเงินสดที่ต้องจ่าย (ตามวันครบกำหนด · ทุกเดือน)</h3>
            <p className="text-[11px] text-slate-500 mt-0.5">คำนวณจากเงื่อนไขของแต่ละ Supplier — ชำระทันที / เครดิต / ผ่อนเป็นงวด</p>
          </div>
          <div className="flex gap-2 text-xs">
            <div className={`rounded-xl border px-3 py-1.5 ${overdueAmt > 0 ? 'bg-rose-50 border-rose-300 text-rose-800' : 'bg-slate-50 border-slate-200 text-slate-600'}`}>
              เกินกำหนด <strong>{fmt(overdueAmt)} ฿</strong> ({overdueRows.length} งวด)
            </div>
            <div className="rounded-xl border border-amber-300 bg-amber-50 text-amber-800 px-3 py-1.5">
              ครบใน 7 วัน <strong>{fmt(soonAmt)} ฿</strong>
            </div>
          </div>
        </div>
        {cashByMonth.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-3">
            {cashByMonth.map(([k, v]) => (
              <span key={k} className={`text-[11px] font-semibold px-2.5 py-1 rounded-full border ${k === 'เกินกำหนด' ? 'bg-rose-50 text-rose-700 border-rose-200' : 'bg-slate-50 text-slate-700 border-slate-200'}`}>
                {k === 'เกินกำหนด' ? k : thMonth(k)}: {fmt(v)} ฿
              </span>
            ))}
          </div>
        )}
        {dueRows.length === 0 ? (
          <p className="text-xs text-slate-500">ไม่มียอดค้างจ่าย</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-slate-500 border-b border-slate-200 text-left">
                  <th className="py-1.5">ครบกำหนด</th>
                  <th className="py-1.5">เอกสาร</th>
                  <th className="py-1.5">Supplier</th>
                  <th className="py-1.5 text-right">ยอด (฿)</th>
                  <th className="py-1.5 text-center">จ่ายเงิน</th>
                </tr>
              </thead>
              <tbody>
                {dueRows.slice(0, 30).map(({ d, p }) => (
                  <tr key={`${d.key}-${p.seq}`} className="border-b border-slate-100">
                    <td className={`py-1.5 font-semibold ${p.dueDate < today ? 'text-rose-700' : 'text-slate-800'}`}>
                      {fmtDate(p.dueDate)}{p.dueDate < today && ' ⚠'}
                    </td>
                    <td className="py-1.5">{d.no}{d.plan.length > 1 ? ` · งวด ${p.seq}/${d.plan.length}` : ''}</td>
                    <td className="py-1.5">{d.supplier}</td>
                    <td className="py-1.5 text-right font-bold">{fmt(p.amount)}</td>
                    <td className="py-1.5 text-center">
                      <button onClick={() => payInst(d, p)} className="px-2.5 py-1 rounded-lg font-bold border bg-white text-rose-700 border-rose-300 hover:bg-rose-50 cursor-pointer">
                        บันทึกจ่าย
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {dueRows.length > 30 && <p className="text-[11px] text-slate-500 mt-2">แสดง 30 งวดแรกจากทั้งหมด {dueRows.length} งวด</p>}
          </div>
        )}
      </div>

      <div className={card}>
        <h3 className="font-bold text-slate-900 text-sm mb-3">ยอดสั่งซื้อย้อนหลัง 6 เดือน</h3>
        <div className="flex items-end gap-3 h-36">
          {trend.map((t) => (
            <div key={t.ym} className="flex-1 flex flex-col items-center justify-end h-full gap-1">
              <span className="text-[10px] text-slate-600">{t.total ? fmt(t.total) : ''}</span>
              <div className={`w-full rounded-t ${t.ym === month ? 'bg-blue-600' : 'bg-blue-200'}`} style={{ height: `${(t.total / trendMax) * 100}%`, minHeight: t.total ? 3 : 0 }} />
              <span className="text-[10px] text-slate-500">{thMonth(t.ym).replace(/ \d{4}$/, '')}</span>
            </div>
          ))}
        </div>
      </div>

      <div className={card}>
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <h3 className="font-bold text-slate-900 text-sm">รายการเอกสาร {thMonth(month)}</h3>
          <div className="flex gap-1 text-xs">
            {(['ALL', 'UNPAID', 'PAID'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1.5 rounded-lg font-semibold cursor-pointer ${filter === f ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
              >
                {f === 'ALL' ? 'ทั้งหมด' : f === 'UNPAID' ? 'ค้างจ่าย' : 'จ่ายแล้ว'}
              </button>
            ))}
          </div>
        </div>
        {shown.length === 0 ? (
          <p className="text-xs text-slate-500">ไม่มีเอกสารในเงื่อนไขนี้</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-slate-500 border-b border-slate-200 text-left">
                  <th className="py-1.5">เลขที่</th>
                  <th className="py-1.5">วันที่</th>
                  <th className="py-1.5">Supplier</th>
                  <th className="py-1.5">ปลายทาง</th>
                  <th className="py-1.5 text-right">ยอด (฿)</th>
                  <th className="py-1.5 text-center">การจ่ายเงิน (ตามเงื่อนไข Supplier)</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((d) => (
                  <tr key={d.key} className="border-b border-slate-100">
                    <td className="py-1.5 font-semibold text-slate-800">
                      {d.no} <span className="ml-1 text-[10px] text-slate-400">{d.kind === 'PO' ? 'PO' : 'ส่งตรง'}</span>
                    </td>
                    <td className="py-1.5">{d.date}</td>
                    <td className="py-1.5">{d.supplier}</td>
                    <td className="py-1.5">{d.target}</td>
                    <td className="py-1.5 text-right font-bold">{fmt(d.amount)}</td>
                    <td className="py-1.5">
                      <div className="text-[10px] text-slate-500 text-center mb-0.5">{d.terms}</div>
                      <div className="flex flex-wrap justify-center gap-1">
                        {d.plan.map((p) => (
                          <button
                            key={p.seq}
                            onClick={() => payInst(d, p)}
                            className={`px-2 py-1 rounded-lg font-bold border cursor-pointer text-[11px] ${
                              p.paid
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                                : p.dueDate < today
                                ? 'bg-rose-600 text-white border-rose-700'
                                : 'bg-white text-rose-700 border-rose-300 hover:bg-rose-50'
                            }`}
                            title={p.paid ? `จ่ายเมื่อ ${fmtDate(p.paidAt)}${p.paymentRef ? ` (${p.paymentRef})` : ''} — คลิกเพื่อยกเลิก` : 'คลิกเพื่อบันทึกการจ่าย'}
                          >
                            {p.paid ? (
                              <span className="inline-flex items-center gap-1"><CheckCircle2 className="w-3 h-3" />{d.plan.length > 1 ? `งวด ${p.seq} ` : ''}จ่ายแล้ว</span>
                            ) : (
                              `${d.plan.length > 1 ? `งวด ${p.seq} · ` : ''}${fmt(p.amount)} ฿ · ครบ ${fmtDate(p.dueDate)}`
                            )}
                          </button>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
