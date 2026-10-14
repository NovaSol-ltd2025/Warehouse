import React from 'react';
import { PaymentInstallment } from '../types/inventory';
import { planSummary, todayYmd } from '../utils/payment';

export const fmtDate = (ymd?: string) => {
  if (!ymd) return '-';
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' });
};

interface Props {
  plan: PaymentInstallment[];
  onPay: (ref: string) => void;
  onReset: () => void;
}

/** ปุ่มบันทึกการจ่ายเงินตามตารางกำหนดจ่าย: กดแล้วจ่ายงวดถัดไป / จ่ายครบแล้วกดเพื่อยกเลิก */
export const PaymentButton: React.FC<Props> = ({ plan, onPay, onReset }) => {
  const sum = planSummary(plan);
  const overdue = !!sum.next && sum.next.dueDate < todayYmd();

  const click = () => {
    if (sum.allPaid) {
      if (window.confirm('ยกเลิกสถานะ "จ่ายเงินแล้ว" ทุกงวดของใบนี้?')) onReset();
      return;
    }
    const label = sum.total > 1 ? `งวดที่ ${sum.next!.seq}/${sum.total}` : 'ค่าสินค้า';
    const ref = window.prompt(
      `บันทึกการจ่าย ${label} จำนวน ${sum.next!.amount.toLocaleString()} ฿ (ครบกำหนด ${fmtDate(sum.next!.dueDate)})\nเลขที่อ้างอิง/ใบเสร็จ/โอน (ไม่บังคับ)`,
      ''
    );
    if (ref !== null) onPay(ref.trim());
  };

  const cls = sum.allPaid
    ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
    : overdue
    ? 'bg-rose-600 text-white border-rose-700'
    : 'bg-white text-rose-700 border-rose-300 hover:bg-rose-50';

  const text = sum.allPaid
    ? sum.total > 1
      ? `จ่ายครบ ${sum.total} งวดแล้ว`
      : `จ่ายเงินแล้ว${plan[0]?.paidAt ? ' ' + fmtDate(plan[0].paidAt) : ''}${plan[0]?.paymentRef ? ' (' + plan[0].paymentRef + ')' : ''}`
    : `${overdue ? '⚠ เกินกำหนด · ' : ''}${sum.total > 1 ? `งวด ${sum.next!.seq}/${sum.total} · ` : ''}ครบกำหนด ${fmtDate(sum.next!.dueDate)} · บันทึกจ่าย`;

  return (
    <button
      onClick={click}
      className={`text-xs font-bold px-3 py-2 rounded-xl border cursor-pointer ${cls}`}
      title="บันทึกการจ่ายเงินให้ Supplier ตามเงื่อนไขการชำระเงิน"
    >
      {text}
    </button>
  );
};
