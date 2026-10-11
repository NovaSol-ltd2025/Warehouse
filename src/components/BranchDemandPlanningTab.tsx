import React, { useState, useMemo } from 'react';
import { useInventory } from '../context/InventoryContext';
import { BranchMonthlyDemand, InventoryItem, Branch } from '../types/inventory';
import {
  Target,
  TrendingUp,
  Boxes,
  Truck,
  ShoppingBag,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Plus,
  Edit2,
  Save,
  Check,
  Search,
  Filter,
  Calendar,
  Building,
  ArrowRight,
  Info,
  Activity,
  Flame,
  Zap,
  BarChart3,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
} from 'lucide-react';
import { calculateItemUsageTrends, ItemUsageTrend } from '../utils/trendAnalytics';

interface BranchDemandPlanningTabProps {
  initialSubTab?: 'FULFILLMENT' | 'SETTINGS' | 'SMART_PROCUREMENT' | 'USAGE_TRENDS';
  onOpenRequisitionWithItem?: (branchId: string, itemId: string, qty: number) => void;
  onOpenAutoReorder?: () => void;
}

export const BranchDemandPlanningTab: React.FC<BranchDemandPlanningTabProps> = ({
  initialSubTab,
  onOpenRequisitionWithItem,
  onOpenAutoReorder,
}) => {
  const {
    items,
    branches,
    suppliers,
    branchOrders,
    movements,
    branchDemands,
    setBranchDemand,
    batchUpdateBranchDemands,
    getBranchDemandSummaries,
    calculateProcurementDeficitFromDemand,
    createPurchaseOrder,
  } = useInventory();

  // Active view
  const [subTab, setSubTab] = useState<'FULFILLMENT' | 'SETTINGS' | 'SMART_PROCUREMENT' | 'USAGE_TRENDS'>(
    initialSubTab || 'FULFILLMENT'
  );

  // Filters
  const [selectedBranchId, setSelectedBranchId] = useState<string>('ALL');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const currentMonthStr = new Date().toISOString().slice(0, 7);
  const [selectedMonth, setSelectedMonth] = useState(currentMonthStr);

  // Trend specific filters
  const [trendStatusFilter, setTrendStatusFilter] = useState<'ALL' | 'SURGE' | 'INCREASING' | 'STABLE' | 'DECREASING'>('ALL');
  const [runoutFilter, setRunoutFilter] = useState<'ALL' | 'CRITICAL' | 'WARNING' | 'HEALTHY'>('ALL');

  // Inline editing state for Tab B (Quota Matrix)
  const [editingBranchId, setEditingBranchId] = useState<string>(branches[0]?.id || 'BR-01');
  const activeEditingBranchId = branches.some((b) => b.id === editingBranchId)
    ? editingBranchId
    : (branches[0]?.id || 'BR-01');
  const [editedQuotas, setEditedQuotas] = useState<{ [itemId: string]: number }>({});
  const [editedNotes, setEditedNotes] = useState<{ [itemId: string]: string }>({});
  const [saveSuccessMessage, setSaveSuccessMessage] = useState<string | null>(null);

  // Calculate usage trends
  const usageTrends = useMemo(() => {
    return calculateItemUsageTrends(items, branchOrders, branches, movements);
  }, [items, branchOrders, branches, movements]);

  // Filtered usage trends
  const filteredUsageTrends = useMemo(() => {
    return usageTrends.filter((t) => {
      const matchSearch =
        t.item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        t.item.code.toLowerCase().includes(searchTerm.toLowerCase());
      const matchCat = selectedCategory === 'ALL' || t.item.category === selectedCategory;
      const matchTrend = trendStatusFilter === 'ALL' || t.trendDirection === trendStatusFilter;
      const matchRunout = runoutFilter === 'ALL' || t.runoutStatus === runoutFilter;
      const matchBranch =
        selectedBranchId === 'ALL' ||
        t.branchUsage.some((b) => b.branchId === selectedBranchId);

      return matchSearch && matchCat && matchTrend && matchRunout && matchBranch;
    });
  }, [usageTrends, searchTerm, selectedCategory, trendStatusFilter, runoutFilter, selectedBranchId]);

  // Trend summary KPIs
  const trendKpis = useMemo(() => {
    const surgeCount = usageTrends.filter((t) => t.trendDirection === 'SURGE').length;
    const criticalRunout = usageTrends.filter((t) => t.runoutStatus === 'CRITICAL').length;
    const warningRunout = usageTrends.filter((t) => t.runoutStatus === 'WARNING').length;
    const total30dVolume = usageTrends.reduce((sum, t) => sum + t.totalUsage30Days, 0);

    return { surgeCount, criticalRunout, warningRunout, total30dVolume };
  }, [usageTrends]);

  // Notification toast
  const triggerSuccess = (msg: string) => {
    setSaveSuccessMessage(msg);
    setTimeout(() => setSaveSuccessMessage(null), 3000);
  };

  // Summaries
  const summaries = useMemo(() => {
    return getBranchDemandSummaries(
      selectedBranchId === 'ALL' ? undefined : selectedBranchId,
      selectedMonth
    );
  }, [selectedBranchId, selectedMonth, branchDemands, getBranchDemandSummaries]);

  // Filtered summaries
  const filteredSummaries = useMemo(() => {
    return summaries.filter((s) => {
      const matchSearch =
        s.itemName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.branchName.toLowerCase().includes(searchTerm.toLowerCase());
      const itemObj = items.find((it) => it.id === s.itemId);
      const matchCat = selectedCategory === 'ALL' || itemObj?.category === selectedCategory;
      return matchSearch && matchCat;
    });
  }, [summaries, searchTerm, selectedCategory, items]);

  // Overall KPI stats for the month
  const kpiStats = useMemo(() => {
    const totalQuota = summaries.reduce((acc, s) => acc + s.monthlyQuota, 0);
    const totalDelivered = summaries.reduce((acc, s) => acc + s.deliveredThisMonth, 0);
    const totalRemaining = summaries.reduce((acc, s) => acc + s.remainingQuota, 0);
    const completedCount = summaries.filter((s) => s.status === 'COMPLETED').length;
    const overQuotaCount = summaries.filter((s) => s.status === 'OVER_QUOTA').length;
    const percent = totalQuota > 0 ? Math.round((totalDelivered / totalQuota) * 100) : 0;

    return {
      totalQuota,
      totalDelivered,
      totalRemaining,
      completedCount,
      overQuotaCount,
      percent,
    };
  }, [summaries]);

  // Smart Procurement Deficit calculation
  const procurementDeficit = useMemo(() => {
    return calculateProcurementDeficitFromDemand();
  }, [calculateProcurementDeficitFromDemand]);

  // Format month name in Thai
  const formatThaiMonth = (ym: string) => {
    const [year, month] = ym.split('-');
    const monthNames = [
      'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
      'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม',
    ];
    const mIdx = parseInt(month, 10) - 1;
    const thaiYear = parseInt(year, 10) + 543;
    return `${monthNames[mIdx]} ${thaiYear}`;
  };

  // Handle Save Quotas in Tab B
  const handleSaveQuotasForBranch = () => {
    const newDemands: BranchMonthlyDemand[] = items.map((item) => {
      const quota = editedQuotas[item.id] !== undefined
        ? editedQuotas[item.id]
        : (branchDemands.find((d) => d.branchId === activeEditingBranchId && d.itemId === item.id)?.monthlyQuota || 0);

      const note = editedNotes[item.id] !== undefined
        ? editedNotes[item.id]
        : (branchDemands.find((d) => d.branchId === activeEditingBranchId && d.itemId === item.id)?.notes || '');

      return {
        branchId: activeEditingBranchId,
        itemId: item.id,
        monthlyQuota: quota,
        notes: note,
      };
    });

    batchUpdateBranchDemands(newDemands);
    triggerSuccess('บันทึกการกำหนดโควตารายเดือนเรียบร้อยแล้ว');
  };

  // One-click Auto PO from Demand Deficit
  const handleCreateAutoPOFromDeficit = async () => {
    const itemsToOrder = procurementDeficit.deficits
      .filter((d) => d.netDeficitQty > 0)
      .map((d) => ({
        itemId: d.item.id,
        itemName: d.item.name,
        quantity: d.netDeficitQty,
        unit: d.item.unit,
        unitPrice: d.item.unitPrice,
        historicalPrice: d.item.baselinePrice,
      }));

    if (itemsToOrder.length === 0) {
      alert('ยอดสต็อกปัจจุบันที่ สนง.ใหญ่ เพียงพอต่อความต้องการสาขาในเดือนนี้แล้ว');
      return;
    }

    const newPO = await createPurchaseOrder({
      supplierId: procurementDeficit.supplier.id,
      supplierName: procurementDeficit.supplier.name,
      orderDate: new Date().toISOString().split('T')[0],
      expectedDeliveryDate: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
      destination: 'HQ_WAREHOUSE',
      items: itemsToOrder,
      notes: `สร้างอัตโนมัติจากแผนความต้องการสาขารายเดือน (${formatThaiMonth(selectedMonth)}) สนองความต้องการที่ขาด`,
    });

    triggerSuccess(`✅ สร้างคำสั่งซื้อ Supplier ${newPO.poNumber} ยอดรวม ${newPO.totalAmount.toLocaleString()} บาท เรียบร้อยแล้ว`);
  };

  return (
    <div className="space-y-6">
      
      {/* Toast Notification */}
      {saveSuccessMessage && (
        <div className="fixed top-5 right-5 z-60 bg-emerald-600 text-white text-xs sm:text-sm px-4 py-3 rounded-xl shadow-xl flex items-center gap-2 animate-in fade-in slide-in-from-right-4">
          <CheckCircle2 className="w-5 h-5 text-white shrink-0" />
          <span>{saveSuccessMessage}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 bg-indigo-50 text-indigo-700 rounded-xl border border-indigo-200">
              <Target className="w-5 h-5" />
            </span>
            <h2 className="text-xl sm:text-2xl font-bold text-slate-900">
              วางแผนความต้องการสาขารายเดือน (Smart Demand & Quota)
            </h2>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            กำหนดปริมาณความต้องการสินค้าต่อเดือนของแต่ละสาขา ติดตามความคืบหน้าการจัดส่ง และคำนวณการสั่งซื้อ Supplier รวมอัตโนมัติ
          </p>
        </div>

        {/* Sub-tab navigation */}
        <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
          <button
            onClick={() => setSubTab('FULFILLMENT')}
            className={`px-3 sm:px-4 py-2 text-xs sm:text-sm font-bold rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
              subTab === 'FULFILLMENT'
                ? 'bg-white text-blue-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <TrendingUp className="w-4 h-4" />
            <span>ติดตามการส่งมอบเดือนนี้</span>
          </button>

          <button
            onClick={() => setSubTab('SETTINGS')}
            className={`px-3 sm:px-4 py-2 text-xs sm:text-sm font-bold rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
              subTab === 'SETTINGS'
                ? 'bg-white text-blue-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Edit2 className="w-4 h-4" />
            <span>กำหนดโควตารายสาขา</span>
          </button>

          <button
            onClick={() => setSubTab('SMART_PROCUREMENT')}
            className={`px-3 sm:px-4 py-2 text-xs sm:text-sm font-bold rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
              subTab === 'SMART_PROCUREMENT'
                ? 'bg-white text-indigo-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Sparkles className="w-4 h-4 text-indigo-600" />
            <span>Smart วางแผนสั่งซื้อ PO</span>
          </button>

          <button
            onClick={() => setSubTab('USAGE_TRENDS')}
            className={`px-3 sm:px-4 py-2 text-xs sm:text-sm font-bold rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
              subTab === 'USAGE_TRENDS'
                ? 'bg-white text-amber-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Flame className="w-4 h-4 text-amber-600" />
            <span>แนวโน้มการใช้สินค้า (Trend Analytics)</span>
            {trendKpis.surgeCount > 0 && (
              <span className="bg-rose-500 text-white text-[10px] px-1.5 py-0.2 rounded-full font-extrabold animate-pulse">
                {trendKpis.surgeCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* SUB-TAB 1: FULFILLMENT & PROGRESS TRACKING */}
      {/* ========================================================================= */}
      {subTab === 'FULFILLMENT' && (
        <div className="space-y-6">
          
          {/* KPI Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
              <span className="text-slate-500 text-xs font-semibold block">โควตารวมเป้าหมายเดือนนี้:</span>
              <div className="text-2xl font-extrabold text-slate-900 mt-1">
                {kpiStats.totalQuota.toLocaleString()}{' '}
                <span className="text-xs font-normal text-slate-500">หน่วยรวม</span>
              </div>
              <div className="text-[11px] text-slate-400 mt-1">
                รอบเดือน: {formatThaiMonth(selectedMonth)}
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-emerald-200 shadow-xs bg-emerald-50/20">
              <span className="text-emerald-800 text-xs font-semibold block">จัดส่งสะสมแล้วเดือนนี้:</span>
              <div className="text-2xl font-extrabold text-emerald-700 mt-1">
                {kpiStats.totalDelivered.toLocaleString()}{' '}
                <span className="text-xs font-normal text-emerald-600">หน่วย</span>
              </div>
              <div className="text-[11px] text-emerald-600 font-bold mt-1">
                สำเร็จแล้ว {kpiStats.percent}% ของเป้าหมาย
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-amber-200 shadow-xs bg-amber-50/20">
              <span className="text-amber-800 text-xs font-semibold block">ความต้องการคงเหลือที่ต้องส่ง:</span>
              <div className="text-2xl font-extrabold text-amber-700 mt-1">
                {kpiStats.totalRemaining.toLocaleString()}{' '}
                <span className="text-xs font-normal text-amber-600">หน่วย</span>
              </div>
              <div className="text-[11px] text-amber-700 mt-1">
                เพื่อตอบสนองความต้องการให้ครบเดือน
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-indigo-200 shadow-xs bg-indigo-50/20">
              <span className="text-indigo-800 text-xs font-semibold block">การวางแผนจัดซื้อ:</span>
              <div className="text-xl font-bold text-indigo-900 mt-1">
                {procurementDeficit.deficits.filter((d) => d.netDeficitQty > 0).length}{' '}
                <span className="text-xs font-normal text-indigo-700">รายการต้องสั่งเพิ่ม</span>
              </div>
              <button
                onClick={() => setSubTab('SMART_PROCUREMENT')}
                className="text-[11px] text-indigo-600 font-bold mt-1 hover:underline flex items-center gap-1 cursor-pointer"
              >
                <span>ดูยอดสั่งซื้อ Supplier &rarr;</span>
              </button>
            </div>
          </div>

          {/* Filter Bar */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 flex-1 min-w-[220px]">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="ค้นหาชื่อสินค้า หรือชื่อสาขา..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full text-xs sm:text-sm pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {/* Branch Filter */}
              <div className="flex items-center gap-1.5 text-xs">
                <Building className="w-4 h-4 text-slate-500 shrink-0" />
                <select
                  value={selectedBranchId}
                  onChange={(e) => setSelectedBranchId(e.target.value)}
                  className="bg-slate-50 border border-slate-200 text-slate-800 text-xs font-semibold rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="ALL">ทุกสาขา ({branches.length})</option>
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Month Selector */}
              <div className="flex items-center gap-1.5 text-xs">
                <Calendar className="w-4 h-4 text-slate-500 shrink-0" />
                <input
                  type="month"
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="bg-slate-50 border border-slate-200 text-slate-800 text-xs font-semibold rounded-xl px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Table of Demand Summaries */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs sm:text-sm">
                <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4">สาขา</th>
                    <th className="py-3 px-4">รายการสินค้า</th>
                    <th className="py-3 px-3 text-center">โควตา/เดือน</th>
                    <th className="py-3 px-3 text-center">ส่งแล้วเดือนนี้</th>
                    <th className="py-3 px-3 text-center">ยังต้องการอีก</th>
                    <th className="py-3 px-4 text-center min-w-[140px]">% ความคืบหน้า</th>
                    <th className="py-3 px-3 text-center">สถานะ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredSummaries.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-400">
                        ไม่พบข้อมูลโควตาตรงกับเงื่อนไขที่เลือก
                      </td>
                    </tr>
                  ) : (
                    filteredSummaries.map((s, idx) => {
                      const itemObj = items.find((it) => it.id === s.itemId);

                      return (
                        <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                          {/* Branch */}
                          <td className="py-3 px-4">
                            <span className="font-bold text-slate-900 block text-xs sm:text-sm">
                              {s.branchName}
                            </span>
                          </td>

                          {/* Item */}
                          <td className="py-3 px-4">
                            <div className="font-semibold text-slate-900">
                              {s.itemName}
                            </div>
                            <span className="text-[10px] text-slate-400">
                              {itemObj?.category} &bull; สต็อก สนง.ใหญ่: {itemObj?.currentStockHQ} {s.unit}
                            </span>
                          </td>

                          {/* Quota */}
                          <td className="py-3 px-3 text-center font-bold text-slate-900">
                            {s.monthlyQuota} {s.unit}
                          </td>

                          {/* Delivered */}
                          <td className="py-3 px-3 text-center font-bold text-emerald-700">
                            {s.deliveredThisMonth} {s.unit}
                          </td>

                          {/* Remaining */}
                          <td className="py-3 px-3 text-center">
                            {s.remainingQuota > 0 ? (
                              <span className="font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                                {s.remainingQuota} {s.unit}
                              </span>
                            ) : (
                              <span className="text-slate-400 text-xs font-medium">
                                ครบแล้ว
                              </span>
                            )}
                          </td>

                          {/* Progress Bar */}
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2">
                              <div className="flex-1 bg-slate-200 h-2 rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full transition-all ${
                                    s.status === 'OVER_QUOTA'
                                      ? 'bg-rose-500'
                                      : s.status === 'COMPLETED'
                                      ? 'bg-emerald-500'
                                      : s.fulfillmentPercent >= 40
                                      ? 'bg-blue-500'
                                      : 'bg-amber-400'
                                  }`}
                                  style={{ width: `${Math.min(100, s.fulfillmentPercent)}%` }}
                                />
                              </div>
                              <span className="text-xs font-bold text-slate-700 w-10 text-right">
                                {s.fulfillmentPercent}%
                              </span>
                            </div>
                          </td>

                          {/* Status */}
                          <td className="py-3 px-3 text-center">
                            {s.status === 'COMPLETED' ? (
                              <span className="inline-flex items-center gap-1 bg-emerald-100 text-emerald-800 text-[11px] font-bold px-2.5 py-0.5 rounded-full">
                                <Check className="w-3 h-3 text-emerald-600" />
                                ส่งครบแล้ว
                              </span>
                            ) : s.status === 'OVER_QUOTA' ? (
                              <span className="inline-flex items-center gap-1 bg-rose-100 text-rose-800 text-[11px] font-bold px-2 py-0.5 rounded-full" title="ส่งเกินโควตาที่กำหนดสำหรับเดือนนี้">
                                <AlertTriangle className="w-3 h-3 text-rose-600" />
                                เกินโควตา
                              </span>
                            ) : s.status === 'ON_TRACK' ? (
                              <span className="inline-flex items-center gap-1 bg-blue-100 text-blue-800 text-[11px] font-bold px-2 py-0.5 rounded-full">
                                <Clock className="w-3 h-3 text-blue-600" />
                                ตามแผน
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 bg-amber-100 text-amber-800 text-[11px] font-bold px-2 py-0.5 rounded-full">
                                รอจัดส่ง
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SUB-TAB 2: DEFINE QUOTA MATRIX & PER-BRANCH SETTINGS */}
      {/* ========================================================================= */}
      {subTab === 'SETTINGS' && (
        <div className="space-y-6">
          <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-4">
            <div>
              <h3 className="text-base font-bold text-slate-900">
                เลือกสาขาที่ต้องการกำหนดปริมาณความต้องการสินค้าต่อเดือน
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                สามารถปรับเพิ่ม-ลดจำนวนโควตาของแต่ละรายการได้ทันที และกดบันทึก
              </p>
            </div>

            <div className="flex items-center gap-3">
              <select
                value={activeEditingBranchId}
                onChange={(e) => {
                  setEditingBranchId(e.target.value);
                  setEditedQuotas({});
                  setEditedNotes({});
                }}
                className="bg-slate-50 border border-slate-300 text-slate-900 text-xs sm:text-sm font-bold rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name} ({b.code})
                  </option>
                ))}
              </select>

              <button
                type="button"
                onClick={handleSaveQuotasForBranch}
                className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-sm font-bold px-4 py-2.5 rounded-xl shadow-sm transition-all cursor-pointer"
              >
                <Save className="w-4 h-4" />
                <span>บันทึกโควตาสาขานี้</span>
              </button>
            </div>
          </div>

          {/* Matrix Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs sm:text-sm">
                <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4 w-12 text-center">ลำดับ</th>
                    <th className="py-3 px-4">รายการสินค้า</th>
                    <th className="py-3 px-3">หมวดหมู่</th>
                    <th className="py-3 px-3 text-center">สต็อก สนง.ใหญ่</th>
                    <th className="py-3 px-4 text-center w-48">ปริมาณความต้องการ/เดือน</th>
                    <th className="py-3 px-4">คำแนะนำ/กฎเฉพาะสาขา</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {items.map((item, idx) => {
                    const currentQuota =
                      editedQuotas[item.id] !== undefined
                        ? editedQuotas[item.id]
                        : (branchDemands.find(
                            (d) => d.branchId === activeEditingBranchId && d.itemId === item.id
                          )?.monthlyQuota || 0);

                    const currentNote =
                      editedNotes[item.id] !== undefined
                        ? editedNotes[item.id]
                        : (branchDemands.find(
                            (d) => d.branchId === activeEditingBranchId && d.itemId === item.id
                          )?.notes || '');

                    return (
                      <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                        <td className="py-3 px-4 text-center text-slate-400 font-mono">
                          {idx + 1}
                        </td>

                        <td className="py-3 px-4">
                          <div className="font-bold text-slate-900">{item.name}</div>
                          <span className="font-mono text-[11px] text-slate-400">
                            {item.code} &bull; {item.unitPrice.toLocaleString()} ฿/{item.unit}
                          </span>
                        </td>

                        <td className="py-3 px-3 text-slate-600 font-medium">
                          {item.category}
                        </td>

                        <td className="py-3 px-3 text-center font-bold text-slate-800">
                          {item.currentStockHQ} {item.unit}
                        </td>

                        {/* Quota Input */}
                        <td className="py-3 px-4">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => {
                                const newVal = Math.max(0, currentQuota - 5);
                                setEditedQuotas((prev) => ({ ...prev, [item.id]: newVal }));
                              }}
                              className="w-7 h-7 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg cursor-pointer flex items-center justify-center"
                            >
                              -
                            </button>

                            <div className="relative">
                              <input
                                type="number"
                                min="0"
                                value={currentQuota}
                                onChange={(e) => {
                                  const val = Math.max(0, parseInt(e.target.value, 10) || 0);
                                  setEditedQuotas((prev) => ({ ...prev, [item.id]: val }));
                                }}
                                className="w-20 text-center font-extrabold text-blue-900 bg-blue-50/50 border border-blue-200 rounded-lg py-1.5 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                              />
                            </div>

                            <button
                              type="button"
                              onClick={() => {
                                const newVal = currentQuota + 5;
                                setEditedQuotas((prev) => ({ ...prev, [item.id]: newVal }));
                              }}
                              className="w-7 h-7 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg cursor-pointer flex items-center justify-center"
                            >
                              +
                            </button>

                            <span className="text-xs text-slate-500 ml-1 font-medium">
                              {item.unit}
                            </span>
                          </div>
                        </td>

                        {/* Note */}
                        <td className="py-3 px-4">
                          <input
                            type="text"
                            placeholder="ระบุคำแนะนำ หรือเงื่อนไขเฉพาะสาขา..."
                            value={currentNote}
                            onChange={(e) => {
                              setEditedNotes((prev) => ({ ...prev, [item.id]: e.target.value }));
                            }}
                            className="w-full text-xs px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="bg-slate-50 p-4 border-t border-slate-200 flex items-center justify-between">
              <span className="text-xs text-slate-500">
                เมื่อปรับตัวเลขเรียบร้อย อย่าลืมกดปุ่มบันทึกเพื่ออัปเดตระบบและ Google Sheet
              </span>
              <button
                type="button"
                onClick={handleSaveQuotasForBranch}
                className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-sm font-bold px-5 py-2 rounded-xl shadow-sm transition-all cursor-pointer"
              >
                <Save className="w-4 h-4" />
                <span>บันทึกโควตาสาขานี้</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SUB-TAB 3: SMART PROCUREMENT PLANNING FROM AGGREGATE DEFICIT */}
      {/* ========================================================================= */}
      {subTab === 'SMART_PROCUREMENT' && (
        <div className="space-y-6">
          <div className="bg-gradient-to-r from-indigo-900 to-blue-900 text-white p-5 sm:p-6 rounded-3xl shadow-lg border border-indigo-700/50">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="max-w-2xl">
                <div className="inline-flex items-center gap-1.5 bg-indigo-500/30 text-indigo-200 text-xs font-bold px-3 py-1 rounded-full border border-indigo-400/30 mb-2">
                  <Sparkles className="w-3.5 h-3.5 text-indigo-300" />
                  <span>SMART PROCUREMENT ENGINE</span>
                </div>
                <h3 className="text-xl sm:text-2xl font-extrabold tracking-tight">
                  คำนวณการสั่งซื้อ Supplier รวมจากความต้องการสาขาที่ขาด
                </h3>
                <p className="text-xs sm:text-sm text-indigo-200 mt-1 leading-relaxed">
                  ระบบวิเคราะห์จาก: <strong>[ความต้องการรวมทุกสาขาเดือนนี้ - สต็อกคงเหลือ สนง.ใหญ่]</strong> เพื่อสรุปยอดที่ต้องสั่งซื้อจริง พร้อมตรวจสอบเกณฑ์จัดส่งฟรี 5,000 บาท กับ บริษัท คงธนา เซอร์วิส จำกัด
                </p>
              </div>

              {/* Status Box */}
              <div className="bg-white/10 backdrop-blur-md p-4 rounded-2xl border border-white/20 text-right">
                <span className="text-indigo-200 text-xs block">มูลค่าสั่งซื้อที่แนะนำ:</span>
                <div className="text-2xl sm:text-3xl font-extrabold text-white mt-0.5">
                  {procurementDeficit.totalOrderAmount.toLocaleString()} ฿
                </div>
                <div className="mt-1">
                  {procurementDeficit.isMinMet ? (
                    <span className="bg-emerald-500/30 text-emerald-300 text-[11px] font-bold px-2 py-0.5 rounded-full border border-emerald-400/40">
                      ✓ ครบเกณฑ์ขั้นต่ำ 5,000 บาท (Supplier ส่งฟรี)
                    </span>
                  ) : (
                    <span className="bg-amber-500/30 text-amber-300 text-[11px] font-bold px-2 py-0.5 rounded-full border border-amber-400/40">
                      ขาดอีก {procurementDeficit.differenceToMin.toLocaleString()} บาท จะครบ 5,000 บาท
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="mt-5 pt-4 border-t border-indigo-800 flex flex-wrap items-center justify-between gap-3">
              <div className="text-xs text-indigo-300">
                ผู้จัดจำหน่าย: <strong>{procurementDeficit.supplier.name}</strong> &bull; ระยะเวลาส่งของ: 7 วัน
              </div>

              <button
                type="button"
                onClick={handleCreateAutoPOFromDeficit}
                className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-slate-950 text-xs sm:text-sm font-extrabold px-5 py-2.5 rounded-xl shadow-md transition-all cursor-pointer"
              >
                <ShoppingBag className="w-4 h-4 text-slate-950" />
                <span>สร้างใบสั่งซื้อ Supplier PO ทันทีจากยอดที่ขาด</span>
              </button>
            </div>
          </div>

          {/* Breakdown Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
              <h4 className="font-bold text-sm text-slate-900">
                รายการสินค้าที่ต้องสั่งซื้อเพิ่มเพื่อรองรับความต้องการสาขาตลอดเดือน
              </h4>
              <span className="text-xs text-slate-500">
                {procurementDeficit.deficits.filter((d) => d.netDeficitQty > 0).length} รายการ
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs sm:text-sm">
                <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4">รายการสินค้า</th>
                    <th className="py-3 px-3 text-center">โควตารวมสาขา/เดือน</th>
                    <th className="py-3 px-3 text-center">ส่งแล้วเดือนนี้</th>
                    <th className="py-3 px-3 text-center">สาขายังต้องการอีก</th>
                    <th className="py-3 px-3 text-center">สต็อกที่มี สนง.ใหญ่</th>
                    <th className="py-3 px-3 text-center text-blue-900 font-extrabold">ต้องสั่งเพิ่ม (PO)</th>
                    <th className="py-3 px-4 text-right">ยอดเงิน (บาท)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {procurementDeficit.deficits.map((d, idx) => {
                    const isShortage = d.netDeficitQty > 0;

                    return (
                      <tr key={idx} className={isShortage ? 'bg-amber-50/30' : 'hover:bg-slate-50'}>
                        <td className="py-3 px-4">
                          <div className="font-bold text-slate-900">{d.item.name}</div>
                          <span className="text-[11px] text-slate-400">
                            {d.item.code} &bull; {d.item.unitPrice.toLocaleString()} ฿/{d.item.unit}
                          </span>
                        </td>

                        <td className="py-3 px-3 text-center font-medium text-slate-700">
                          {d.totalMonthlyQuota} {d.item.unit}
                        </td>

                        <td className="py-3 px-3 text-center font-medium text-emerald-700">
                          {d.totalDeliveredThisMonth} {d.item.unit}
                        </td>

                        <td className="py-3 px-3 text-center font-bold text-amber-800">
                          {d.remainingBranchDemand} {d.item.unit}
                        </td>

                        <td className="py-3 px-3 text-center font-semibold text-slate-900">
                          {d.currentStockHQ} {d.item.unit}
                        </td>

                        <td className="py-3 px-3 text-center">
                          {isShortage ? (
                            <span className="font-extrabold text-rose-700 bg-rose-100 px-2.5 py-1 rounded-md text-xs sm:text-sm">
                              +{d.netDeficitQty} {d.item.unit}
                            </span>
                          ) : (
                            <span className="text-emerald-700 text-xs font-semibold">
                              ✓ มีพอแล้ว
                            </span>
                          )}
                        </td>

                        <td className="py-3 px-4 text-right font-bold text-slate-900">
                          {d.subtotalCost > 0 ? `${d.subtotalCost.toLocaleString()} ฿` : '-'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot className="bg-slate-50 border-t border-slate-200 font-bold">
                  <tr>
                    <td colSpan={6} className="py-3 px-4 text-right text-slate-700">
                      ยอดรวมคำสั่งซื้อที่ต้องสั่ง Supplier:
                    </td>
                    <td className="py-3 px-4 text-right text-base font-extrabold text-blue-900">
                      {procurementDeficit.totalOrderAmount.toLocaleString()} ฿
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SUB-TAB 4: USAGE TRENDS & CONSUMPTION FORECASTING (แนวโน้มปริมาณการใช้สินค้า) */}
      {/* ========================================================================= */}
      {subTab === 'USAGE_TRENDS' && (
        <div className="space-y-6">
          {/* Executive Overview Hero */}
          <div className="bg-gradient-to-r from-amber-950 via-slate-900 to-indigo-950 text-white p-5 sm:p-6 rounded-3xl shadow-lg border border-amber-500/20">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="max-w-2xl">
                <div className="inline-flex items-center gap-1.5 bg-amber-500/20 text-amber-300 text-xs font-bold px-3 py-1 rounded-full border border-amber-400/30 mb-2">
                  <Flame className="w-3.5 h-3.5 text-amber-400" />
                  <span>CONSUMPTION TREND & RUNOUT PREDICTOR</span>
                </div>
                <h3 className="text-xl sm:text-2xl font-extrabold tracking-tight">
                  แนวโน้มและอัตราการใช้สินค้าจริงของสาขา (Usage Trends)
                </h3>
                <p className="text-xs sm:text-sm text-slate-300 mt-1 leading-relaxed">
                  วิเคราะห์อัตราการเบิกใช้จริงย้อนหลัง (Consumption Burn Rate), คำนวณวันหมดสต็อกคาดการณ์ (Runout Prediction), และคาดการณ์ยอดสั่งที่เหมาะสมสำหรับเดือนถัดไปเพื่อป้องกันของขาดมือ
                </p>
              </div>

              {/* Quick Summary Pill */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div className="bg-white/10 backdrop-blur-md p-3 rounded-2xl border border-white/10 text-center">
                  <span className="text-[11px] text-amber-200 block">ใช้ไป 30 วัน</span>
                  <div className="text-lg sm:text-xl font-extrabold text-white">
                    {trendKpis.total30dVolume.toLocaleString()}
                  </div>
                  <span className="text-[10px] text-slate-400">หน่วยรวม</span>
                </div>

                <div className="bg-white/10 backdrop-blur-md p-3 rounded-2xl border border-white/10 text-center">
                  <span className="text-[11px] text-rose-300 block">ใช้พุ่งสูง (Surge)</span>
                  <div className="text-lg sm:text-xl font-extrabold text-rose-400">
                    {trendKpis.surgeCount}
                  </div>
                  <span className="text-[10px] text-slate-400">รายการ</span>
                </div>

                <div className="bg-white/10 backdrop-blur-md p-3 rounded-2xl border border-white/10 text-center">
                  <span className="text-[11px] text-rose-300 block">เสี่ยงหมด &lt; 7 วัน</span>
                  <div className="text-lg sm:text-xl font-extrabold text-rose-400">
                    {trendKpis.criticalRunout}
                  </div>
                  <span className="text-[10px] text-slate-400">วิกฤต</span>
                </div>

                <div className="bg-white/10 backdrop-blur-md p-3 rounded-2xl border border-white/10 text-center">
                  <span className="text-[11px] text-amber-200 block">หมดใน 14 วัน</span>
                  <div className="text-lg sm:text-xl font-extrabold text-amber-300">
                    {trendKpis.warningRunout}
                  </div>
                  <span className="text-[10px] text-slate-400">เฝ้าระวัง</span>
                </div>
              </div>
            </div>
          </div>

          {/* Filters Bar */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2.5 flex-1 min-w-[280px]">
              {/* Search */}
              <div className="relative flex-1 min-w-[200px]">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="ค้นหาชื่อสินค้า หรือรหัสสินค้า..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              {/* Trend Filter */}
              <select
                value={trendStatusFilter}
                onChange={(e) => setTrendStatusFilter(e.target.value as any)}
                className="text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-700 focus:outline-none font-medium"
              >
                <option value="ALL">แนวโน้มทั้งหมด</option>
                <option value="SURGE">🔥 ใช้พุ่งสูง (&gt; +30%)</option>
                <option value="INCREASING">📈 มีแนวโน้มเพิ่มขึ้น</option>
                <option value="STABLE">➖ ทรงตัว / สม่ำเสมอ</option>
                <option value="DECREASING">📉 มีแนวโน้มลดลง</option>
              </select>

              {/* Runout Filter */}
              <select
                value={runoutFilter}
                onChange={(e) => setRunoutFilter(e.target.value as any)}
                className="text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-700 focus:outline-none font-medium"
              >
                <option value="ALL">สถานะคงเหลือทั้งหมด</option>
                <option value="CRITICAL">🚨 วิกฤต (หมดใน 7 วัน)</option>
                <option value="WARNING">⚠️ เฝ้าระวัง (หมดใน 14 วัน)</option>
                <option value="HEALTHY">✅ ปลอดภัย (&gt; 14 วัน)</option>
              </select>
            </div>

            <div className="text-xs text-slate-500">
              พบ {filteredUsageTrends.length} รายการ
            </div>
          </div>

          {/* Trend Analytics Cards / Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs sm:text-sm">
                <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                  <tr>
                    <th className="py-3.5 px-4 min-w-[200px]">รายการสินค้า</th>
                    <th className="py-3.5 px-3 text-center">สต็อก สนง.ใหญ่</th>
                    <th className="py-3.5 px-3 text-center">ใช้จริงเดือนนี้</th>
                    <th className="py-3.5 px-3 text-center">อัตราใช้/วัน</th>
                    <th className="py-3.5 px-3 text-center min-w-[130px]">ทิศทางแนวโน้ม</th>
                    <th className="py-3.5 px-3 text-center min-w-[140px]">คาดการณ์วันหมด</th>
                    <th className="py-3.5 px-3 text-center">คาดการณ์เดือนหน้า</th>
                    <th className="py-3.5 px-4 text-center">สาขาที่ใช้มากสุด</th>
                    <th className="py-3.5 px-3 text-right">ดำเนินการ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredUsageTrends.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-12 text-center text-slate-400">
                        ไม่พบข้อมูลสินค้าที่ตรงกับเงื่อนไขการค้นหา
                      </td>
                    </tr>
                  ) : (
                    filteredUsageTrends.map((t) => {
                      const isSurge = t.trendDirection === 'SURGE';
                      const isCritical = t.runoutStatus === 'CRITICAL';
                      const isWarning = t.runoutStatus === 'WARNING';

                      return (
                        <tr
                          key={t.itemId}
                          className={`hover:bg-slate-50 transition-colors ${
                            isCritical ? 'bg-rose-50/40' : isSurge ? 'bg-amber-50/30' : ''
                          }`}
                        >
                          {/* Item Name */}
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-2.5">
                              {t.item.imageUrl ? (
                                <img
                                  src={t.item.imageUrl}
                                  alt={t.item.name}
                                  className="w-9 h-9 object-cover rounded-lg border border-slate-200 shrink-0"
                                />
                              ) : (
                                <div className="w-9 h-9 bg-slate-100 rounded-lg flex items-center justify-center shrink-0 text-slate-400 font-bold">
                                  {t.item.code.slice(-2)}
                                </div>
                              )}
                              <div>
                                <div className="font-bold text-slate-900 leading-snug">
                                  {t.item.name}
                                </div>
                                <div className="text-[11px] text-slate-400">
                                  {t.item.code} &bull; {t.item.category}
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* HQ Stock */}
                          <td className="py-3.5 px-3 text-center">
                            <span className="font-extrabold text-slate-900 text-sm">
                              {t.currentStockHQ}
                            </span>
                            <span className="text-[11px] text-slate-500 ml-1">
                              {t.item.unit}
                            </span>
                            {t.currentStockHQ <= t.minThreshold && (
                              <div className="text-[10px] text-rose-600 font-bold">
                                ต่ำกว่าจุดเตือน ({t.minThreshold})
                              </div>
                            )}
                          </td>

                          {/* Consumption This Month */}
                          <td className="py-3.5 px-3 text-center">
                            <div className="font-bold text-slate-800">
                              {t.thisMonthUsage} {t.item.unit}
                            </div>
                            <div className="text-[10px] text-slate-400">
                              (เดือนก่อน: {t.lastMonthUsage})
                            </div>
                          </td>

                          {/* Daily Burn Rate */}
                          <td className="py-3.5 px-3 text-center font-mono text-slate-700">
                            <strong>{t.dailyBurnRate}</strong>
                            <span className="text-[10px] text-slate-400 block">/วัน</span>
                          </td>

                          {/* Trend Direction Badge */}
                          <td className="py-3.5 px-3 text-center">
                            {t.trendDirection === 'SURGE' && (
                              <span className="inline-flex items-center gap-1 bg-rose-100 text-rose-800 text-xs px-2.5 py-1 rounded-full font-bold border border-rose-300">
                                <Flame className="w-3.5 h-3.5 text-rose-600 animate-pulse" />
                                <span>พุ่งสูง +{t.trendPercent}%</span>
                              </span>
                            )}
                            {t.trendDirection === 'INCREASING' && (
                              <span className="inline-flex items-center gap-1 bg-amber-100 text-amber-800 text-xs px-2.5 py-1 rounded-full font-bold border border-amber-300">
                                <ArrowUpRight className="w-3.5 h-3.5 text-amber-600" />
                                <span>เพิ่มขึ้น +{t.trendPercent}%</span>
                              </span>
                            )}
                            {t.trendDirection === 'STABLE' && (
                              <span className="inline-flex items-center gap-1 bg-slate-100 text-slate-700 text-xs px-2.5 py-1 rounded-full font-medium border border-slate-200">
                                <Minus className="w-3.5 h-3.5 text-slate-500" />
                                <span>สม่ำเสมอ ({t.trendPercent >= 0 ? `+${t.trendPercent}` : t.trendPercent}%)</span>
                              </span>
                            )}
                            {t.trendDirection === 'DECREASING' && (
                              <span className="inline-flex items-center gap-1 bg-emerald-100 text-emerald-800 text-xs px-2.5 py-1 rounded-full font-medium border border-emerald-300">
                                <ArrowDownRight className="w-3.5 h-3.5 text-emerald-600" />
                                <span>ลดลง {t.trendPercent}%</span>
                              </span>
                            )}
                          </td>

                          {/* Runout Prediction */}
                          <td className="py-3.5 px-3 text-center">
                            {t.runoutStatus === 'CRITICAL' && (
                              <div className="bg-rose-100 text-rose-900 border border-rose-300 px-2 py-1 rounded-xl">
                                <div className="text-xs font-extrabold flex items-center justify-center gap-1">
                                  <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                                  <span>{t.runoutDays} วันหมดสต็อก</span>
                                </div>
                                <span className="text-[10px] text-rose-700 block">ต้องรีบสั่งซื้อด่วน</span>
                              </div>
                            )}
                            {t.runoutStatus === 'WARNING' && (
                              <div className="bg-amber-100 text-amber-900 border border-amber-300 px-2 py-1 rounded-xl">
                                <div className="text-xs font-bold flex items-center justify-center gap-1">
                                  <Clock className="w-3.5 h-3.5 text-amber-700" />
                                  <span>~{t.runoutDays} วัน</span>
                                </div>
                                <span className="text-[10px] text-amber-800 block">วางแผนสั่งซื้อล่วงหน้า</span>
                              </div>
                            )}
                            {t.runoutStatus === 'HEALTHY' && (
                              <div className="text-emerald-700 text-xs font-semibold">
                                ✓ ปลอดภัย ({t.runoutDays > 90 ? '> 90 วัน' : `${t.runoutDays} วัน`})
                              </div>
                            )}
                            {t.runoutStatus === 'SURPLUS' && (
                              <div className="text-slate-500 text-xs font-medium">
                                สต็อกคงเหลือสูง
                              </div>
                            )}
                          </td>

                          {/* Projected Next Month Demand */}
                          <td className="py-3.5 px-3 text-center">
                            <span className="font-bold text-blue-900 text-sm">
                              ~{t.projectedNextMonthDemand}
                            </span>
                            <span className="text-[11px] text-slate-500 ml-1">
                              {t.item.unit}
                            </span>
                            <span className="text-[10px] text-slate-400 block">
                              (Safety: {t.suggestedSafetyStock})
                            </span>
                          </td>

                          {/* Top Branch */}
                          <td className="py-3.5 px-4 text-center">
                            {t.topBranchName ? (
                              <div className="text-xs">
                                <span className="font-bold text-slate-800 block">
                                  {t.topBranchName}
                                </span>
                                <span className="text-[11px] text-slate-500">
                                  สัดส่วน {t.topBranchPercentage}%
                                </span>
                              </div>
                            ) : (
                              <span className="text-xs text-slate-400">-</span>
                            )}
                          </td>

                          {/* Actions */}
                          <td className="py-3.5 px-3 text-right">
                            <button
                              type="button"
                              onClick={() => {
                                if (onOpenAutoReorder) onOpenAutoReorder();
                              }}
                              className="inline-flex items-center gap-1 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-bold px-2.5 py-1.5 rounded-lg border border-blue-200 transition-colors cursor-pointer"
                              title="เปิดสั่งซื้อ PO ด่วน"
                            >
                              <ShoppingBag className="w-3.5 h-3.5" />
                              <span>สั่ง PO</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Footnote */}
            <div className="bg-slate-50 p-4 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-600">
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1 text-rose-700 font-bold">
                  <Flame className="w-3.5 h-3.5" /> พุ่งสูง = อัตราการใช้มากกว่าค่าเฉลี่ย 30%
                </span>
                <span className="flex items-center gap-1 text-amber-700 font-bold">
                  <Clock className="w-3.5 h-3.5" /> คาดการณ์วันหมด = สต็อก HQ &divide; อัตราการใช้ต่อวัน
                </span>
              </div>
              <div>
                ข้อมูลคำนวณแบบ Real-time ร่วมกับฐานข้อมูล Google Sheet และใบส่งสินค้าสาขา
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
