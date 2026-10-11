import React, { useState } from 'react';
import { useInventory } from '../context/InventoryContext';
import {
  FileSpreadsheet,
  Download,
  Copy,
  Check,
  ExternalLink,
  Table,
  CheckCircle2,
  Layers,
  Code2,
  Sparkles,
} from 'lucide-react';

interface GoogleSheetsExporterProps {
  onOpenGasModal?: () => void;
}

export const GoogleSheetsExporter: React.FC<GoogleSheetsExporterProps> = ({ onOpenGasModal }) => {
  const { items, branchOrders, purchaseOrders, movements } = useInventory();
  const [activeTab, setActiveTab] = useState<'STOCK' | 'BRANCH_ORDERS' | 'PURCHASE_ORDERS' | 'MOVEMENTS'>('STOCK');
  const [copied, setCopied] = useState(false);

  // Generate Tab-Separated Values (TSV) for clipboard paste directly into Google Sheets
  const generateTSV = (tabType: string): string => {
    if (tabType === 'STOCK') {
      const headers = ['รหัสสินค้า', 'รายการวัสดุ/อุปกรณ์', 'หมวดหมู่', 'หน่วย', 'ราคาต่อหน่วย (บาท)', 'สต็อกคงเหลือ สนง.ใหญ่', 'จุดเตือนสั่งซื้อ', 'สถานะสต็อก', 'ระยะเวลาส่ง (วัน)'];
      const rows = items.map((i) => [
        i.code,
        i.name,
        i.category,
        i.unit,
        i.unitPrice,
        i.currentStockHQ,
        i.minStockThreshold,
        i.currentStockHQ <= i.minStockThreshold ? 'ใกล้หมด (ต้องสั่งซื้อ)' : 'ปกติ',
        i.leadTimeDays,
      ]);
      return [headers.join('\t'), ...rows.map((r) => r.join('\t'))].join('\n');
    }

    if (tabType === 'BRANCH_ORDERS') {
      const headers = ['เลขที่ใบส่งของ', 'สาขาปลายทาง (สถานที่ปฏิบัติงาน)', 'วันที่ออกเอกสาร', 'กำหนดส่งมอบ', 'รูปแบบการจัดส่ง', 'ยอดรวม (บาท)', 'เกณฑ์ 5,000 ฿', 'สถานะ', 'ผู้รับสินค้า'];
      const rows = branchOrders.map((o) => [
        o.deliveryOrderNo,
        o.branchName,
        o.date,
        o.deliveryDate || '-',
        o.routingType === 'SUPPLIER_DIRECT' ? 'Supplier ส่งตรงสาขา' : 'โนวาโซลส่งเอง (ผ่าน สนง.ใหญ่)',
        o.totalAmount,
        o.totalAmount >= 5000 ? 'ผ่านเกณฑ์ 5,000 ฿' : 'ไม่ถึงเกณฑ์',
        o.status,
        o.receiverName || '-',
      ]);
      return [headers.join('\t'), ...rows.map((r) => r.join('\t'))].join('\n');
    }

    if (tabType === 'PURCHASE_ORDERS') {
      const headers = ['เลขที่ PO', 'Supplier ผู้จำหน่าย', 'วันที่สั่งซื้อ', 'กำหนดได้รับของ (7 วัน)', 'สถานที่จัดส่ง', 'ยอดสั่งซื้อ (บาท)', 'เกณฑ์ขั้นต่ำ 5,000 ฿', 'สถานะคำสั่งซื้อ'];
      const rows = purchaseOrders.map((p) => [
        p.poNumber,
        p.supplierName,
        p.orderDate,
        p.expectedDeliveryDate,
        p.destination === 'DIRECT_BRANCH' ? `ส่งตรงสาขา (${p.targetBranchName})` : 'คลัง สนง.ใหญ่ โนวาโซล',
        p.totalAmount,
        p.minAmountMet ? 'ผ่านเกณฑ์ขั้นต่ำ' : 'ไม่ถึงเกณฑ์',
        p.status,
      ]);
      return [headers.join('\t'), ...rows.map((r) => r.join('\t'))].join('\n');
    }

    // Movements
    const headers = ['วันที่', 'รหัสรายการ', 'รายการสินค้า', 'ประเภท', 'จำนวน', 'คงเหลือหลังทำรายการ', 'เลขอ้างอิง', 'หมายเหตุ'];
    const rows = movements.map((m) => [
      m.date,
      m.itemId,
      m.itemName,
      m.type === 'IN_SUPPLIER' ? 'รับเข้าจาก Supplier' : m.type === 'OUT_BRANCH' ? 'จ่ายไปสาขา' : 'ปรับยอดตรวจนับ',
      m.quantity,
      m.balanceAfter,
      m.referenceNo,
      m.notes || '-',
    ]);
    return [headers.join('\t'), ...rows.map((r) => r.join('\t'))].join('\n');
  };

  // Copy to clipboard
  const handleCopyTSV = () => {
    const text = generateTSV(activeTab);
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  // Download CSV with BOM for Thai support
  const handleDownloadCSV = () => {
    const tsv = generateTSV(activeTab);
    // Convert TSV to CSV format
    const lines = tsv.split('\n');
    const csvContent = lines
      .map((line) =>
        line
          .split('\t')
          .map((cell) => `"${cell.replace(/"/g, '""')}"`)
          .join(',')
      )
      .join('\n');

    // Add UTF-8 BOM so Excel & Sheets open Thai correctly
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `NOVASOL_${activeTab}_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      {/* Top Banner */}
      <div className="bg-emerald-900 text-white p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="bg-emerald-500/30 text-emerald-200 text-xs px-2.5 py-1 rounded-md font-semibold border border-emerald-400/30 flex items-center gap-1.5">
                <FileSpreadsheet className="w-3.5 h-3.5" />
                Google Sheets & Excel Data Export Hub
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold mt-2">
              บันทึกและซิงค์ข้อมูลลง Google Sheet
            </h2>
            <p className="text-emerald-100 text-xs sm:text-sm mt-1">
              คัดลอกตารางไปวางใน Google Sheet ได้ในคลิกเดียว หรือดาวน์โหลดไฟล์ CSV พร้อมหัวตารางภาษาไทย
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleCopyTSV}
              className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs sm:text-sm px-4 py-2.5 rounded-xl shadow-md transition-all cursor-pointer"
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4 text-slate-950" />
                  <span>คัดลอกเรียบร้อยแล้ว! (พร้อม Paste)</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  <span>คัดลอกตาราง (Paste ลง Google Sheet)</span>
                </>
              )}
            </button>

            <button
              onClick={handleDownloadCSV}
              className="flex items-center gap-2 bg-emerald-800 hover:bg-emerald-700 text-white font-medium text-xs sm:text-sm px-3.5 py-2.5 rounded-xl border border-emerald-600 transition-colors cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>ดาวน์โหลด CSV</span>
            </button>

            <a
              href="https://sheets.new"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-emerald-200 hover:text-white bg-emerald-950/50 hover:bg-emerald-950 px-3 py-2.5 rounded-xl text-xs font-semibold border border-emerald-700/50 transition-colors"
            >
              <span>เปิดชีตใหม่ (sheets.new)</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>
      </div>

      {/* Google Apps Script Feature Banner */}
      {onOpenGasModal && (
        <div className="bg-gradient-to-r from-emerald-50 via-teal-50 to-blue-50 border-b border-emerald-200 p-4 sm:p-5 flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1 max-w-2xl">
            <div className="flex items-center gap-2">
              <span className="bg-emerald-600 text-white text-[11px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                <Sparkles className="w-3 h-3" />
                Google Apps Script (GAS)
              </span>
              <span className="text-xs font-bold text-emerald-900">
                ฟอนต์: Chakra Petch | Logo Drive ID: 1seZ1h5ddiY1CL7ELoXxqSC1pxbbJuBbO
              </span>
            </div>
            <p className="text-xs text-slate-700 leading-relaxed">
              ต้องการให้ Google Sheets สร้างตารางทั้ง 5 ชีท, ใส่สูตรคำนวณอัตโนมัติ, แทรกโลโก้ Drive และฟอร์มใบส่งสินค้า A4 โดยอัตโนมัติหรือไม่?
            </p>
          </div>

          <button
            onClick={onOpenGasModal}
            className="flex items-center gap-2 bg-emerald-700 hover:bg-emerald-800 text-white text-xs sm:text-sm font-bold px-4 py-2.5 rounded-xl shadow-xs transition-colors cursor-pointer"
          >
            <Code2 className="w-4 h-4" />
            <span>ดูโค้ด & วิธีติดตั้ง Google Apps Script</span>
          </button>
        </div>
      )}

      {/* Tabs */}
      <div className="bg-slate-50 border-b border-slate-200 px-4 sm:px-6 pt-3 flex flex-wrap gap-2 text-xs font-semibold">
        <button
          onClick={() => setActiveTab('STOCK')}
          className={`pb-3 px-3 border-b-2 transition-colors cursor-pointer flex items-center gap-2 ${
            activeTab === 'STOCK'
              ? 'border-emerald-600 text-emerald-800 font-bold'
              : 'border-transparent text-slate-600 hover:text-slate-900'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>1. ชีตสต็อกสินค้าคงเหลือ ({items.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('BRANCH_ORDERS')}
          className={`pb-3 px-3 border-b-2 transition-colors cursor-pointer flex items-center gap-2 ${
            activeTab === 'BRANCH_ORDERS'
              ? 'border-emerald-600 text-emerald-800 font-bold'
              : 'border-transparent text-slate-600 hover:text-slate-900'
          }`}
        >
          <Table className="w-4 h-4" />
          <span>2. ชีตใบส่งสินค้าสาขา ({branchOrders.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('PURCHASE_ORDERS')}
          className={`pb-3 px-3 border-b-2 transition-colors cursor-pointer flex items-center gap-2 ${
            activeTab === 'PURCHASE_ORDERS'
              ? 'border-emerald-600 text-emerald-800 font-bold'
              : 'border-transparent text-slate-600 hover:text-slate-900'
          }`}
        >
          <Table className="w-4 h-4" />
          <span>3. ชีตใบสั่งซื้อ Supplier PO ({purchaseOrders.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('MOVEMENTS')}
          className={`pb-3 px-3 border-b-2 transition-colors cursor-pointer flex items-center gap-2 ${
            activeTab === 'MOVEMENTS'
              ? 'border-emerald-600 text-emerald-800 font-bold'
              : 'border-transparent text-slate-600 hover:text-slate-900'
          }`}
        >
          <Table className="w-4 h-4" />
          <span>4. ชีตประวัติการเคลื่อนไหวสต็อก ({movements.length})</span>
        </button>
      </div>

      {/* Guide Note */}
      <div className="p-4 bg-emerald-50/50 border-b border-emerald-100 flex items-center gap-3 text-xs text-emerald-900">
        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
        <span>
          <strong>วิธีใช้งานกับ Google Sheet:</strong> กดปุ่ม <em>"คัดลอกตาราง"</em> ด้านบน &rarr; ไปที่ Google Sheets ของคุณ &rarr; กดปุ่ม <strong>Ctrl + V</strong> (หรือ Command + V บน Mac) ที่เซลล์ A1 ข้อมูลจะแยกช่องและจัดคอลัมน์ให้อัตโนมัติทันที
        </span>
      </div>

      {/* Preview Table */}
      <div className="overflow-x-auto max-h-96">
        {activeTab === 'STOCK' && (
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200 sticky top-0">
              <tr>
                <th className="py-2 px-3">รหัส</th>
                <th className="py-2 px-3">รายการวัสดุ/อุปกรณ์</th>
                <th className="py-2 px-3">หมวดหมู่</th>
                <th className="py-2 px-3 text-center">หน่วย</th>
                <th className="py-2 px-3 text-right">ราคา/หน่วย</th>
                <th className="py-2 px-3 text-center">คงเหลือ สนง.ใหญ่</th>
                <th className="py-2 px-3 text-center">จุดเตือนสั่งซื้อ</th>
                <th className="py-2 px-3 text-center">สถานะ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((it) => {
                const isLow = it.currentStockHQ <= it.minStockThreshold;
                return (
                  <tr key={it.id} className="hover:bg-slate-50">
                    <td className="py-2 px-3 font-mono text-slate-500">{it.code}</td>
                    <td className="py-2 px-3 font-medium text-slate-800">{it.name}</td>
                    <td className="py-2 px-3 text-slate-600">{it.category}</td>
                    <td className="py-2 px-3 text-center text-slate-600">{it.unit}</td>
                    <td className="py-2 px-3 text-right font-semibold">{it.unitPrice.toLocaleString()} ฿</td>
                    <td className="py-2 px-3 text-center">
                      <span className={`font-bold ${isLow ? 'text-rose-600' : 'text-slate-800'}`}>
                        {it.currentStockHQ}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-center text-slate-500">{it.minStockThreshold}</td>
                    <td className="py-2 px-3 text-center">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                          isLow ? 'bg-rose-100 text-rose-800' : 'bg-emerald-100 text-emerald-800'
                        }`}
                      >
                        {isLow ? 'ใกล้หมด' : 'ปกติ'}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}

        {activeTab === 'BRANCH_ORDERS' && (
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200 sticky top-0">
              <tr>
                <th className="py-2 px-3">เลขที่ใบส่งของ</th>
                <th className="py-2 px-3">สาขาปลายทาง</th>
                <th className="py-2 px-3">วันที่</th>
                <th className="py-2 px-3">รูปแบบการจัดส่ง</th>
                <th className="py-2 px-3 text-right">ยอดรวม (บาท)</th>
                <th className="py-2 px-3 text-center">สถานะ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {branchOrders.map((bo) => (
                <tr key={bo.id} className="hover:bg-slate-50">
                  <td className="py-2 px-3 font-mono font-bold text-blue-700">{bo.deliveryOrderNo}</td>
                  <td className="py-2 px-3 font-semibold text-slate-900">{bo.branchName}</td>
                  <td className="py-2 px-3 text-slate-600">{bo.date}</td>
                  <td className="py-2 px-3">
                    <span
                      className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                        bo.routingType === 'SUPPLIER_DIRECT'
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {bo.routingType === 'SUPPLIER_DIRECT'
                        ? 'Supplier ส่งตรงสาขา (5,000+ ฿)'
                        : 'โนวาโซลส่งเอง (รวม สนง.ใหญ่)'}
                    </span>
                  </td>
                  <td className="py-2 px-3 text-right font-bold text-slate-900">
                    {bo.totalAmount.toLocaleString()} ฿
                  </td>
                  <td className="py-2 px-3 text-center">
                    <span className="bg-slate-100 text-slate-800 px-2 py-0.5 rounded font-medium text-[11px]">
                      {bo.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {activeTab === 'PURCHASE_ORDERS' && (
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200 sticky top-0">
              <tr>
                <th className="py-2 px-3">เลขที่ PO</th>
                <th className="py-2 px-3">Supplier</th>
                <th className="py-2 px-3">วันที่สั่งซื้อ</th>
                <th className="py-2 px-3">กำหนดส่ง (7 วัน)</th>
                <th className="py-2 px-3">ปลายทาง</th>
                <th className="py-2 px-3 text-right">ยอดรวม</th>
                <th className="py-2 px-3 text-center">สถานะ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {purchaseOrders.map((po) => (
                <tr key={po.id} className="hover:bg-slate-50">
                  <td className="py-2 px-3 font-mono font-bold text-slate-800">{po.poNumber}</td>
                  <td className="py-2 px-3 font-medium text-slate-900">{po.supplierName}</td>
                  <td className="py-2 px-3 text-slate-600">{po.orderDate}</td>
                  <td className="py-2 px-3 text-blue-700 font-medium">{po.expectedDeliveryDate}</td>
                  <td className="py-2 px-3 text-slate-700">
                    {po.destination === 'DIRECT_BRANCH'
                      ? `ส่งตรงสาขา: ${po.targetBranchName}`
                      : 'คลัง สนง.ใหญ่'}
                  </td>
                  <td className="py-2 px-3 text-right font-bold">{po.totalAmount.toLocaleString()} ฿</td>
                  <td className="py-2 px-3 text-center">
                    <span className="bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded font-semibold text-[11px]">
                      {po.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {activeTab === 'MOVEMENTS' && (
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200 sticky top-0">
              <tr>
                <th className="py-2 px-3">วันที่</th>
                <th className="py-2 px-3">รายการสินค้า</th>
                <th className="py-2 px-3">ประเภท</th>
                <th className="py-2 px-3 text-center">จำนวน</th>
                <th className="py-2 px-3 text-center">คงเหลือหลังทำรายการ</th>
                <th className="py-2 px-3">เอกสารอ้างอิง</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {movements.map((m) => (
                <tr key={m.id} className="hover:bg-slate-50">
                  <td className="py-2 px-3 text-slate-600">{m.date}</td>
                  <td className="py-2 px-3 font-medium text-slate-900">{m.itemName}</td>
                  <td className="py-2 px-3">
                    <span
                      className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                        m.type === 'IN_SUPPLIER'
                          ? 'bg-emerald-100 text-emerald-800'
                          : m.type === 'OUT_BRANCH'
                          ? 'bg-rose-100 text-rose-800'
                          : 'bg-blue-100 text-blue-800'
                      }`}
                    >
                      {m.type === 'IN_SUPPLIER'
                        ? 'รับเข้าจาก Supplier'
                        : m.type === 'OUT_BRANCH'
                        ? 'ส่งไปสาขา'
                        : 'ปรับยอด'}
                    </span>
                  </td>
                  <td className="py-2 px-3 text-center font-bold">
                    {m.type === 'OUT_BRANCH' ? `-${m.quantity}` : `+${m.quantity}`}
                  </td>
                  <td className="py-2 px-3 text-center font-bold text-slate-800">{m.balanceAfter}</td>
                  <td className="py-2 px-3 font-mono text-slate-600">{m.referenceNo}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};
