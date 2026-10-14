import { PaymentInstallment, PaymentTermType, Supplier } from '../types/inventory';

export interface PaymentTerms {
  type: PaymentTermType;
  creditDays: number;
  installmentCount: number;
  intervalDays: number;
}

export const termsOf = (s?: Partial<Supplier> | null): PaymentTerms => ({
  type: s?.paymentTermType || 'IMMEDIATE',
  creditDays: Math.max(0, Number(s?.creditDays) || 0),
  installmentCount: Math.max(2, Math.floor(Number(s?.installmentCount) || 2)),
  intervalDays: Math.max(1, Math.floor(Number(s?.installmentIntervalDays) || 30)),
});

export const termsLabel = (s?: Partial<Supplier> | null): string => {
  const t = termsOf(s);
  if (t.type === 'CREDIT') return `เครดิต ${t.creditDays} วัน`;
  if (t.type === 'INSTALLMENT')
    return `ผ่อน ${t.installmentCount} งวด ทุก ${t.intervalDays} วัน${t.creditDays ? ` (งวดแรกหลัง ${t.creditDays} วัน)` : ''}`;
  return 'ชำระทันที';
};

export const minOrderLabel = (s?: Partial<Supplier> | null): string =>
  !s || !Number(s.minOrderAmount) ? 'ไม่มีขั้นต่ำ' : `ขั้นต่ำ ${Number(s.minOrderAmount).toLocaleString()} ฿`;

export const addDays = (ymd: string, days: number): string => {
  const [y, m, d] = (ymd || new Date().toISOString().slice(0, 10)).split('-').map(Number);
  const dt = new Date(Date.UTC(y, (m || 1) - 1, d || 1));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
};

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * สร้างตารางกำหนดจ่ายตามเงื่อนไข Supplier
 * - ชำระทันที: ครบกำหนดวันที่สั่ง
 * - เครดิต N วัน: นับจากวันรับของ (baseDate)
 * - ผ่อนเป็นงวด: แบ่งยอดเท่า ๆ กัน งวดแรกหลัง creditDays วัน แล้วห่างกันทุก intervalDays วัน
 * existing: งวดที่จ่ายแล้วจะคงไว้ (ไม่ถูกเปลี่ยนยอด) ส่วนยอดคงเหลือแบ่งให้งวดที่ยังไม่จ่าย
 */
export const buildPlan = (
  terms: PaymentTerms,
  amount: number,
  orderDate: string,
  baseDate: string,
  existing?: PaymentInstallment[]
): PaymentInstallment[] => {
  const dates: string[] =
    terms.type === 'IMMEDIATE'
      ? [orderDate]
      : terms.type === 'CREDIT'
      ? [addDays(baseDate, terms.creditDays)]
      : Array.from({ length: terms.installmentCount }, (_, i) => addDays(baseDate, terms.creditDays + i * terms.intervalDays));

  const paidBySeq = new Map<number, PaymentInstallment>();
  (existing || []).forEach((e) => e.paid && paidBySeq.set(e.seq, e));
  const keptPaid = dates.map((_, i) => paidBySeq.get(i + 1)).filter(Boolean) as PaymentInstallment[];
  const paidSum = keptPaid.reduce((s, e) => s + e.amount, 0);
  const unpaidSeqs = dates.map((_, i) => i + 1).filter((q) => !paidBySeq.has(q));
  const remaining = round2(Math.max(0, amount - paidSum));
  const each = unpaidSeqs.length ? round2(remaining / unpaidSeqs.length) : 0;

  let allocated = 0;
  return dates.map((due, i) => {
    const seq = i + 1;
    const kept = paidBySeq.get(seq);
    if (kept) return { ...kept, dueDate: kept.dueDate || due };
    const isLast = seq === unpaidSeqs[unpaidSeqs.length - 1];
    const amt = isLast ? round2(remaining - allocated) : each;
    allocated = round2(allocated + amt);
    return { seq, dueDate: due, amount: amt, paid: false };
  });
};

export const planSummary = (plan: PaymentInstallment[]) => {
  const paidCount = plan.filter((p) => p.paid).length;
  const allPaid = plan.length > 0 && paidCount === plan.length;
  const next = plan.find((p) => !p.paid);
  return {
    paidCount,
    total: plan.length,
    allPaid,
    next,
    paidAmount: plan.filter((p) => p.paid).reduce((s, p) => s + p.amount, 0),
    unpaidAmount: plan.filter((p) => !p.paid).reduce((s, p) => s + p.amount, 0),
  };
};

export const todayYmd = () => new Date().toISOString().slice(0, 10);
