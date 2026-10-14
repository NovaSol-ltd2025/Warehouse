import React, { useState, useMemo } from 'react';
import { useInventory } from '../context/InventoryContext';
import { BranchOrder, OrderItemDetail, RoutingType } from '../types/inventory';
import { analyzeBranchRequisition, getPriceTrend, checkMonthlyQuotaWarning } from '../utils/smartValidator';
import {
  Package,
  Truck,
  Building2,
  Plus,
  Trash2,
  X,
  AlertCircle,
  CheckCircle2,
  FileCheck,
  ShieldAlert,
  Image as ImageIcon,
  TrendingUp,
  TrendingDown,
  Info,
  Sparkles,
  History,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  Calendar,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

interface BranchRequisitionModalProps {
  onClose: () => void;
  onSuccessCreated: (order: BranchOrder) => void;
}

export const BranchRequisitionModal: React.FC<BranchRequisitionModalProps> = ({
  onClose,
  onSuccessCreated,
}) => {
  const {
    items,
    branches,
    branchOrders,
    createBranchOrder,
    getBranchMonthlyDemand,
    getBranchDeliveredThisMonth,
  } = useInventory();
  const [showComparison, setShowComparison] = useState(true);

  const [selectedBranchId, setSelectedBranchId] = useState<string>(
    branches[0]?.id || 'BR-01'
  );
  const [orderDate, setOrderDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [deliveryDate, setDeliveryDate] = useState<string>(
    new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  );
  const [receiverName, setReceiverName] = useState<string>('');
  const [senderName, setSenderName] = useState<string>('พนักงานจัดส่ง โนวาโซล');
  const [notes, setNotes] = useState<string>('');

  // Items in this order
  const [orderItems, setOrderItems] = useState<
    {
      itemId: string;
      itemName: string;
      quantity: number;
      unit: string;
      unitPrice: number;
      imageUrl?: string;
      remark: string;
    }[]
  >([
    {
      itemId: items[0]?.id || 'ITEM-01',
      itemName: items[0]?.name || 'ถุงขยะสีดำ ขนาด 18 x 20 นิ้ว',
      quantity: 5,
      unit: items[0]?.unit || 'กก.',
      unitPrice: items[0]?.unitPrice || 65,
      imageUrl: items[0]?.imageUrl,
      remark: '',
    },
    {
      itemId: items[7]?.id || 'ITEM-08',
      itemName: items[7]?.name || 'ผลิตภัณฑ์สบู่เหลวล้างมือ กลิ่นนมข้าว สีฟ้ามุก K-SAVE (3.8 L)',
      quantity: 3,
      unit: items[7]?.unit || 'แกลลอน',
      unitPrice: items[7]?.unitPrice || 195,
      imageUrl: items[7]?.imageUrl,
      remark: 'สูตรสีฟ้ามุก สำหรับสาขาจตุจักร',
    },
  ]);

  const [selectedCatalogItemId, setSelectedCatalogItemId] = useState<string>('');
  const [overrideRouting, setOverrideRouting] = useState<RoutingType | null>(null);

  const currentBranch = useMemo(
    () => branches.find((b) => b.id === selectedBranchId) || branches[0],
    [branches, selectedBranchId]
  );

  // Calculate order total
  const totalAmount = useMemo(
    () => orderItems.reduce((sum, it) => sum + it.quantity * it.unitPrice, 0),
    [orderItems]
  );

  // Core rule: >= 5,000 THB can be delivered directly by Supplier
  const isDirectEligible = totalAmount >= 5000;
  const effectiveRouting: RoutingType =
    overrideRouting || (isDirectEligible ? 'SUPPLIER_DIRECT' : 'HQ_DELIVERY');

  // Smart Validation Analysis & Monthly Quota Check
  const smartAnalysis = useMemo(() => {
    const baseAnalysis = analyzeBranchRequisition(selectedBranchId, currentBranch.name, orderItems, items);
    
    // Check monthly quota limits
    const quotaWarnings = orderItems
      .map((item) => {
        const monthlyQuota = getBranchMonthlyDemand(selectedBranchId, item.itemId);
        const deliveredThisMonth = getBranchDeliveredThisMonth(selectedBranchId, item.itemId);
        return checkMonthlyQuotaWarning(
          selectedBranchId,
          currentBranch.name,
          item.itemId,
          item.itemName,
          item.unit,
          item.quantity,
          monthlyQuota,
          deliveredThisMonth
        );
      })
      .filter(Boolean) as typeof baseAnalysis.warnings;

    const allWarnings = [...quotaWarnings, ...baseAnalysis.warnings];
    return {
      hasWarning: allWarnings.length > 0,
      warnings: allWarnings,
    };
  }, [selectedBranchId, currentBranch, orderItems, items, getBranchMonthlyDemand, getBranchDeliveredThisMonth]);

  // Find the most recent delivery order for the selected branch
  const latestPreviousOrder = useMemo(() => {
    const prevOrders = branchOrders
      .filter((o) => o.branchId === selectedBranchId)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    return prevOrders[0] || null;
  }, [branchOrders, selectedBranchId]);

  // Comparison between latest previous delivery and current requisition
  const comparisonData = useMemo(() => {
    if (!latestPreviousOrder) return null;

    const prevTotal = latestPreviousOrder.totalAmount;
    const currTotal = totalAmount;
    const totalDiff = currTotal - prevTotal;
    const daysDiff = Math.max(
      0,
      Math.round(
        (new Date(orderDate).getTime() - new Date(latestPreviousOrder.date).getTime()) /
          (1000 * 60 * 60 * 24)
      )
    );

    // Items currently in the order
    const comparedCurrentItems = orderItems.map((cur) => {
      const prevItem = latestPreviousOrder.items.find(
        (pi) => pi.itemId === cur.itemId || pi.itemName === cur.itemName
      );
      const prevQty = prevItem ? prevItem.quantity : 0;
      const diffQty = cur.quantity - prevQty;
      const percentChange = prevQty > 0 ? (diffQty / prevQty) * 100 : 100;

      let status: 'SAME' | 'INCREASED' | 'DECREASED' | 'NEW_ITEM' = 'SAME';
      if (!prevItem) {
        status = 'NEW_ITEM';
      } else if (diffQty > 0) {
        status = 'INCREASED';
      } else if (diffQty < 0) {
        status = 'DECREASED';
      }

      return {
        itemId: cur.itemId,
        itemName: cur.itemName,
        unit: cur.unit,
        currentQty: cur.quantity,
        previousQty: prevQty,
        diffQty,
        percentChange,
        status,
        imageUrl: cur.imageUrl,
      };
    });

    // Items in previous order that are missing from current order
    const missingFromPrev = latestPreviousOrder.items.filter(
      (pi) => !orderItems.some((ci) => ci.itemId === pi.itemId || ci.itemName === pi.itemName)
    );

    return {
      latestPreviousOrder,
      prevTotal,
      currTotal,
      totalDiff,
      daysDiff,
      comparedCurrentItems,
      missingFromPrev,
    };
  }, [latestPreviousOrder, orderItems, totalAmount, orderDate]);

  const handleAddMissingItem = (itemToAdd: OrderItemDetail) => {
    setOrderItems((prev) => [
      ...prev,
      {
        itemId: itemToAdd.itemId,
        itemName: itemToAdd.itemName,
        quantity: itemToAdd.quantity,
        unit: itemToAdd.unit,
        unitPrice: itemToAdd.unitPrice,
        imageUrl: itemToAdd.imageUrl,
        remark: itemToAdd.remark || 'เพิ่มตามยอดรอบก่อนหน้า',
      },
    ]);
  };

  const handleAddItem = () => {
    if (!selectedCatalogItemId) return;
    const catItem = items.find((i) => i.id === selectedCatalogItemId);
    if (!catItem) return;

    if (orderItems.some((i) => i.itemId === catItem.id)) {
      setOrderItems((prev) =>
        prev.map((i) => (i.itemId === catItem.id ? { ...i, quantity: i.quantity + 1 } : i))
      );
    } else {
      setOrderItems((prev) => [
        ...prev,
        {
          itemId: catItem.id,
          itemName: catItem.name,
          quantity: 1,
          unit: catItem.unit,
          unitPrice: catItem.unitPrice,
          imageUrl: catItem.imageUrl,
          remark: '',
        },
      ]);
    }
    setSelectedCatalogItemId('');
  };

  const handleRemoveItem = (index: number) => {
    setOrderItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleUpdateItem = (
    index: number,
    field: 'quantity' | 'remark' | 'unitPrice',
    val: any
  ) => {
    setOrderItems((prev) =>
      prev.map((it, i) => (i === index ? { ...it, [field]: val } : it))
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (orderItems.length === 0) return;

    const itemsPayload: OrderItemDetail[] = orderItems.map((it) => ({
      itemId: it.itemId,
      itemName: it.itemName,
      quantity: Number(it.quantity) || 1,
      unit: it.unit,
      unitPrice: it.unitPrice,
      imageUrl: it.imageUrl,
      remark: it.remark,
    }));

    const newOrder = await createBranchOrder({
      branchId: currentBranch.id,
      branchName: currentBranch.name,
      date: orderDate,
      items: itemsPayload,
      routingTypeOverride: effectiveRouting,
      deliveryDate,
      receiverName: receiverName || currentBranch.defaultRecipientName || currentBranch.contactPerson,
      senderName,
      supplierId: items.find((i) => i.id === itemsPayload[0]?.itemId)?.supplierId || undefined,
      notes:
        notes ||
        (effectiveRouting === 'SUPPLIER_DIRECT'
          ? `ยอดคำขอ ${totalAmount.toLocaleString()} บาท (>= 5,000 บาท) ให้ Supplier ไปส่งตรงที่สาขา`
          : `ยอดคำขอ ${totalAmount.toLocaleString()} บาท (< 5,000 บาท) สั่งมาพักที่ สนง.ใหญ่ ก่อน แล้วทีมงานโนวาโซลนำส่งเอง`),
    });

    onSuccessCreated(newOrder);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm flex justify-center items-center p-3 sm:p-5 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-5xl max-h-[94vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="bg-slate-900 text-white p-5 sm:p-6 flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="bg-blue-500/20 text-blue-300 text-xs px-2.5 py-1 rounded-md font-semibold border border-blue-400/30 flex items-center gap-1.5">
                <Truck className="w-3.5 h-3.5" />
                กระจายสินค้าตามสาขา & ออกใบส่งของ
              </span>
              <span className="bg-emerald-500/20 text-emerald-300 text-xs px-2.5 py-1 rounded-md font-semibold border border-emerald-400/30 flex items-center gap-1">
                <Sparkles className="w-3 h-3" />
                ระบบ Smart ป้องกันสั่งผิด & ขาดทุน
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold mt-2">
              สร้างใบส่งสินค้าประจำสาขา (พร้อมรูปภาพ & ตรวจสเปก)
            </h2>
            <p className="text-slate-400 text-xs sm:text-sm mt-1">
              คำนวณเส้นทางอัตโนมัติ: ยอด &lt; 5,000 ฿ รวมส่ง สนง.ใหญ่ | ยอด &ge; 5,000 ฿ Supplier ส่งตรงสาขา
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content Body */}
        <form onSubmit={handleSubmit} className="p-5 sm:p-6 overflow-y-auto space-y-6 flex-1">
          
          {/* Branch & Dates */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-1">
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                สาขาปลายทาง (สถานที่ปฏิบัติงาน) *
              </label>
              <select
                value={selectedBranchId}
                onChange={(e) => {
                  setSelectedBranchId(e.target.value);
                  const b = branches.find((item) => item.id === e.target.value);
                  if (b?.defaultRecipientName) setReceiverName(b.defaultRecipientName);
                }}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
              <div className="text-[11px] text-slate-500 mt-1">
                {currentBranch?.address}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                วันที่ออกเอกสาร *
              </label>
              <input
                type="date"
                value={orderDate}
                onChange={(e) => setOrderDate(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                กำหนดส่งมอบสินค้า
              </label>
              <input
                type="date"
                value={deliveryDate}
                onChange={(e) => setDeliveryDate(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* SMART SYSTEM WARNINGS (แจ้งเตือนความผิดพลาดและป้องกันขาดทุน) */}
          {smartAnalysis.hasWarning && (
            <div className="bg-amber-50 border-2 border-amber-300 rounded-2xl p-4 space-y-3">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-amber-700 shrink-0" />
                <h4 className="font-bold text-xs sm:text-sm text-amber-950">
                  ระบบ Smart ตรวจพบข้อควรระวัง ({smartAnalysis.warnings.length} จุด):
                </h4>
              </div>

              <div className="space-y-2">
                {smartAnalysis.warnings.map((w, idx) => (
                  <div
                    key={idx}
                    className={`p-3 rounded-xl border text-xs flex items-start gap-2.5 ${
                      w.severity === 'danger'
                        ? 'bg-rose-50 border-rose-300 text-rose-950'
                        : 'bg-white border-amber-200 text-slate-800'
                    }`}
                  >
                    <AlertCircle
                      className={`w-4 h-4 shrink-0 mt-0.5 ${
                        w.severity === 'danger' ? 'text-rose-600' : 'text-amber-600'
                      }`}
                    />
                    <div className="flex-1 space-y-0.5">
                      <div className="font-bold text-slate-900 flex items-center justify-between">
                        <span>{w.title}: <strong className="text-blue-800">{w.itemName}</strong></span>
                        <span className="text-[10px] uppercase font-bold text-slate-500">
                          {w.type === 'BRANCH_MISMATCH' ? 'ระวังสเปกสาขา' : w.type === 'PRICE_SPIKE' ? 'ต้นทุนปรับขึ้น' : 'ตรวจสอบสเปก'}
                        </span>
                      </div>
                      <p className="text-slate-700 leading-relaxed">{w.message}</p>
                      {w.suggestedAction && (
                        <div className="text-[11px] font-semibold text-blue-700 pt-0.5">
                          คำแนะนำ: {w.suggestedAction}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Dynamic Routing Rule Banner */}
          <div
            className={`p-4 rounded-xl border transition-all ${
              isDirectEligible
                ? 'bg-blue-50/80 border-blue-200 text-blue-950'
                : 'bg-amber-50/80 border-amber-200 text-amber-950'
            }`}
          >
            <div className="flex items-start gap-3">
              {isDirectEligible ? (
                <CheckCircle2 className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              )}
              <div className="flex-1">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="font-bold text-sm">
                    {isDirectEligible
                      ? `ยอดรวม ${totalAmount.toLocaleString()} บาท (ตรงตามเกณฑ์ 5,000+ บาท)`
                      : `ยอดรวม ${totalAmount.toLocaleString()} บาท (น้อยกว่า 5,000 บาท)`}
                  </div>
                  <span
                    className={`text-xs px-2.5 py-0.5 rounded-full font-bold ${
                      effectiveRouting === 'SUPPLIER_DIRECT'
                        ? 'bg-blue-600 text-white'
                        : 'bg-amber-600 text-white'
                    }`}
                  >
                    {effectiveRouting === 'SUPPLIER_DIRECT'
                      ? '🏭 Supplier จัดส่งตรงถึงสาขา'
                      : '🚚 โนวาโซลไปส่งเอง (พักของที่ สนง.ใหญ่)'}
                  </span>
                </div>
                <p className="text-xs mt-1 text-slate-700">
                  {isDirectEligible
                    ? `สาขานี้มียอดเบิกเกิน 5,000 บาท สามารถให้ Supplier (บริษัท คงธนา เซอร์วิส จำกัด) ไปส่งตรงที่สาขา "${currentBranch.name}" ได้เลย`
                    : `เนื่องจากยอดไม่ถึง 5,000 บาท ระบบจะกำหนดให้สินค้ามาเก็บไว้ที่สำนักงานใหญ่ก่อน จากนั้นทีมงานจัดส่งโนวาโซลจะนำส่งให้สาขาเอง`}
                </p>

                {/* Routing override option */}
                <div className="mt-2.5 flex items-center gap-2 pt-2 border-t border-slate-200/60 text-xs">
                  <span className="text-slate-500">ปรับเปลี่ยนเส้นทางจัดส่ง:</span>
                  <button
                    type="button"
                    onClick={() => setOverrideRouting('HQ_DELIVERY')}
                    className={`px-2 py-0.5 rounded text-xs transition-colors ${
                      effectiveRouting === 'HQ_DELIVERY'
                        ? 'bg-amber-600 text-white font-medium'
                        : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    รวมที่ สนง.ใหญ่ (โนวาโซลส่งเอง)
                  </button>
                  <button
                    type="button"
                    onClick={() => setOverrideRouting('SUPPLIER_DIRECT')}
                    className={`px-2 py-0.5 rounded text-xs transition-colors ${
                      effectiveRouting === 'SUPPLIER_DIRECT'
                        ? 'bg-blue-600 text-white font-medium'
                        : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    Supplier ส่งตรงสาขา
                  </button>
                  {overrideRouting && (
                    <button
                      type="button"
                      onClick={() => setOverrideRouting(null)}
                      className="text-slate-500 hover:text-slate-800 underline text-[11px]"
                    >
                      (รีเซ็ตเป็นค่าแนะนำ)
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* 📊 REQUIREMENT 2: ประวัติการส่งสินค้ารอบล่าสุด เทียบกับ รอบปัจจุบันที่กำลังจะไปส่ง */}
          <div className="bg-white rounded-2xl border-2 border-slate-200 overflow-hidden shadow-xs">
            {/* Header with toggle */}
            <div
              onClick={() => setShowComparison(!showComparison)}
              className="bg-slate-50 hover:bg-slate-100 p-4 border-b border-slate-200 flex items-center justify-between cursor-pointer transition-colors"
            >
              <div className="flex items-center gap-2.5">
                <div className="bg-indigo-600 text-white p-2 rounded-xl shadow-xs">
                  <History className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="font-bold text-sm text-slate-900">
                      เปรียบเทียบประวัติการส่งสินค้ารอบล่าสุด vs รอบปัจจุบันที่จะไปส่ง
                    </h4>
                    {comparisonData ? (
                      <span className="bg-indigo-100 text-indigo-800 text-[11px] font-bold px-2 py-0.5 rounded-full">
                        ห่างจากรอบก่อน {comparisonData.daysDiff} วัน
                      </span>
                    ) : (
                      <span className="bg-slate-200 text-slate-700 text-[11px] font-semibold px-2 py-0.5 rounded-full">
                        การสั่งครั้งแรก
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    ตรวจสอบยอดและจำนวนเทียบกับรอบก่อนหน้า เพื่อป้องกันการสั่งของซ้ำซ้อน ขาดตกบกพร่อง หรือสั่งเกินงบ
                  </p>
                </div>
              </div>

              <button
                type="button"
                className="text-slate-400 hover:text-slate-700 p-1 rounded-lg"
              >
                {showComparison ? (
                  <ChevronUp className="w-5 h-5" />
                ) : (
                  <ChevronDown className="w-5 h-5" />
                )}
              </button>
            </div>

            {/* Comparison Body */}
            {showComparison && (
              <div className="p-4 sm:p-5 space-y-4">
                {comparisonData ? (
                  <>
                    {/* Top Comparison Summary (Side-by-side) */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {/* Previous Delivery Info */}
                      <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-bold text-slate-500 uppercase flex items-center gap-1">
                            <Calendar className="w-3.5 h-3.5 text-slate-400" />
                            รอบล่าสุดที่ส่ง ({comparisonData.latestPreviousOrder.date})
                          </span>
                          <span className="text-[11px] font-semibold text-slate-600 font-mono">
                            {comparisonData.latestPreviousOrder.deliveryOrderNo}
                          </span>
                        </div>
                        <div className="flex items-baseline justify-between pt-1">
                          <div className="text-lg font-bold text-slate-800">
                            {comparisonData.prevTotal.toLocaleString()} ฿
                          </div>
                          <span className="text-xs text-slate-600">
                            {comparisonData.latestPreviousOrder.routingType === 'SUPPLIER_DIRECT'
                              ? '🏭 Supplier ส่งตรง'
                              : '🏢 สนง.ใหญ่ส่งเอง'}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-500">
                          ส่งมอบรวม {comparisonData.latestPreviousOrder.items.length} รายการ
                        </div>
                      </div>

                      {/* Current Requisition Info */}
                      <div className="bg-blue-50/60 border border-blue-200 rounded-xl p-3.5 space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-bold text-blue-700 uppercase flex items-center gap-1">
                            <Truck className="w-3.5 h-3.5 text-blue-600" />
                            รอบปัจจุบันที่กำลังจะไปส่ง ({orderDate})
                          </span>
                          <span className="text-[11px] font-bold text-blue-800">
                            {comparisonData.totalDiff >= 0
                              ? `+${comparisonData.totalDiff.toLocaleString()} ฿`
                              : `${comparisonData.totalDiff.toLocaleString()} ฿`}
                          </span>
                        </div>
                        <div className="flex items-baseline justify-between pt-1">
                          <div className="text-lg font-bold text-blue-900">
                            {comparisonData.currTotal.toLocaleString()} ฿
                          </div>
                          <span className="text-xs font-semibold text-blue-700">
                            {effectiveRouting === 'SUPPLIER_DIRECT'
                              ? '🏭 Supplier ส่งตรง (เกณฑ์ 5,000+ ฿)'
                              : '🚚 สนง.ใหญ่ส่งเอง (< 5,000 ฿)'}
                          </span>
                        </div>
                        <div className="text-[11px] text-blue-700">
                          รายการในใบเบิกรอบนี้ {orderItems.length} รายการ
                        </div>
                      </div>
                    </div>

                    {/* Detailed Item Comparison Table */}
                    <div className="overflow-x-auto rounded-xl border border-slate-200">
                      <table className="w-full text-xs text-left">
                        <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                          <tr>
                            <th className="py-2.5 px-3">รายการสินค้า</th>
                            <th className="py-2.5 px-3 text-center">รอบก่อนหน้า</th>
                            <th className="py-2.5 px-3 text-center">รอบนี้</th>
                            <th className="py-2.5 px-3 text-center">เปรียบเทียบส่วนต่าง</th>
                            <th className="py-2.5 px-3 text-center">สถานะการสั่ง</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 bg-white">
                          {comparisonData.comparedCurrentItems.map((item, idx) => (
                            <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                              <td className="py-2 px-3 font-medium text-slate-900 flex items-center gap-2">
                                {item.imageUrl ? (
                                  <img
                                    src={item.imageUrl}
                                    alt={item.itemName}
                                    className="w-7 h-7 object-cover rounded-md border border-slate-200 shrink-0"
                                  />
                                ) : (
                                  <div className="w-7 h-7 rounded-md bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-400 shrink-0">
                                    <Package className="w-3.5 h-3.5" />
                                  </div>
                                )}
                                <span className="line-clamp-1">{item.itemName}</span>
                              </td>

                              <td className="py-2 px-3 text-center text-slate-600">
                                {item.previousQty > 0 ? (
                                  <span className="font-semibold">
                                    {item.previousQty} {item.unit}
                                  </span>
                                ) : (
                                  <span className="text-slate-400 italic">-</span>
                                )}
                              </td>

                              <td className="py-2 px-3 text-center font-bold text-slate-900">
                                {item.currentQty} {item.unit}
                              </td>

                              <td className="py-2 px-3 text-center font-semibold">
                                {item.status === 'NEW_ITEM' ? (
                                  <span className="text-blue-600 font-bold">
                                    +{item.currentQty} {item.unit} (สั่งใหม่)
                                  </span>
                                ) : item.diffQty > 0 ? (
                                  <span className="text-emerald-700 font-bold flex items-center justify-center gap-0.5">
                                    <ArrowUpRight className="w-3.5 h-3.5 text-emerald-600" />
                                    +{item.diffQty} {item.unit} (+{item.percentChange.toFixed(0)}%)
                                  </span>
                                ) : item.diffQty < 0 ? (
                                  <span className="text-amber-700 font-bold flex items-center justify-center gap-0.5">
                                    <ArrowDownRight className="w-3.5 h-3.5 text-amber-600" />
                                    {item.diffQty} {item.unit} ({item.percentChange.toFixed(0)}%)
                                  </span>
                                ) : (
                                  <span className="text-slate-500 font-medium flex items-center justify-center gap-0.5">
                                    <Minus className="w-3 h-3 text-slate-400" />
                                    เท่าเดิม
                                  </span>
                                )}
                              </td>

                              <td className="py-2 px-3 text-center">
                                {item.status === 'NEW_ITEM' && (
                                  <span className="bg-blue-100 text-blue-800 text-[10px] font-bold px-2 py-0.5 rounded-md">
                                    🆕 รายการใหม่
                                  </span>
                                )}
                                {item.status === 'INCREASED' && (
                                  <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded-md">
                                    🔺 สั่งเพิ่มขึ้น
                                  </span>
                                )}
                                {item.status === 'DECREASED' && (
                                  <span className="bg-amber-100 text-amber-800 text-[10px] font-bold px-2 py-0.5 rounded-md">
                                    🔻 สั่งลดลง
                                  </span>
                                )}
                                {item.status === 'SAME' && (
                                  <span className="bg-slate-100 text-slate-700 text-[10px] font-medium px-2 py-0.5 rounded-md">
                                    ปกติ
                                  </span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Alert for items ordered last time but missing from this order */}
                    {comparisonData.missingFromPrev.length > 0 && (
                      <div className="bg-amber-50 border border-amber-300 rounded-xl p-3.5 space-y-2">
                        <div className="flex items-center gap-1.5 text-amber-900 font-bold text-xs">
                          <AlertCircle className="w-4 h-4 text-amber-600" />
                          <span>
                            สินค้าที่รอบล่าสุดเคยสั่ง แต่ในรอบปัจจุบันยังไม่ได้ใส่ลงในรายการ ({comparisonData.missingFromPrev.length} รายการ):
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {comparisonData.missingFromPrev.map((miss, mIdx) => (
                            <button
                              key={mIdx}
                              type="button"
                              onClick={() => handleAddMissingItem(miss)}
                              className="text-xs bg-white hover:bg-amber-100 border border-amber-300 text-amber-950 px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
                              title="คลิกเพื่อเพิ่มรายการนี้กลับเข้าสู่ใบเบิกทันที"
                            >
                              <Plus className="w-3.5 h-3.5 text-amber-700" />
                              <span>
                                {miss.itemName} ({miss.quantity} {miss.unit})
                              </span>
                            </button>
                          ))}
                        </div>
                        <span className="text-[11px] text-amber-700 block">
                          *คลิกที่ปุ่มเพื่อดึงรายการจากรอบที่แล้วกลับเข้ามาในใบส่งของได้ทันที ป้องกันการตกหล่น
                        </span>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="text-center py-6 text-slate-500 space-y-1">
                    <History className="w-8 h-8 mx-auto text-slate-300" />
                    <p className="text-xs font-semibold">
                      สาขานี้ยังไม่มีประวัติการส่งสินค้าก่อนหน้าในระบบ
                    </p>
                    <p className="text-[11px] text-slate-400">
                      เมื่อออกใบส่งสินค้ารอบนี้แล้ว ข้อมูลจะถูกบันทึกเพื่อใช้เปรียบเทียบในรอบถัดไปทันที
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Items Selector with Photos */}
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                รายการวัสดุ/อุปกรณ์ที่จะจัดส่ง ({orderItems.length} รายการ)
              </label>

              {/* Add item dropdown */}
              <div className="flex items-center gap-2">
                <select
                  value={selectedCatalogItemId}
                  onChange={(e) => setSelectedCatalogItemId(e.target.value)}
                  className="bg-white border border-slate-300 rounded-lg px-2.5 py-1 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500 max-w-xs"
                >
                  <option value="">+ เลือกเพิ่มสินค้าจากคลัง...</option>
                  {items.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.name} (ในคลังมี {i.currentStockHQ} {i.unit})
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={handleAddItem}
                  disabled={!selectedCatalogItemId}
                  className="bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white text-xs px-3 py-1 rounded-lg font-medium transition-colors cursor-pointer"
                >
                  เพิ่มรายการ
                </button>
              </div>
            </div>

            {/* Table with Pictures */}
            <div className="border border-slate-200 rounded-xl overflow-hidden shadow-xs">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-2 text-center w-8">ที่</th>
                    <th className="py-2.5 px-2 text-center w-14">รูปภาพ</th>
                    <th className="py-2.5 px-3">รายการวัสดุ / สเปก</th>
                    <th className="py-2.5 px-2 text-center w-28">จำนวน</th>
                    <th className="py-2.5 px-2 text-center w-16">หน่วย</th>
                    <th className="py-2.5 px-3 text-right w-24">ราคา/หน่วย</th>
                    <th className="py-2.5 px-3 text-right w-24">รวมเงิน</th>
                    <th className="py-2.5 px-3 w-32">หมายเหตุ</th>
                    <th className="py-2.5 px-2 text-center w-8"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {orderItems.map((item, idx) => {
                    const catalogInfo = items.find((ci) => ci.id === item.itemId);
                    const stock = catalogInfo ? catalogInfo.currentStockHQ : 0;
                    const trend = catalogInfo ? getPriceTrend(catalogInfo) : null;
                    const itemImg = item.imageUrl || catalogInfo?.imageUrl;

                    return (
                      <tr key={idx} className="hover:bg-slate-50/70">
                        <td className="py-2 px-2 text-center text-slate-400 font-medium">
                          {idx + 1}
                        </td>
                        
                        {/* Image Thumbnail */}
                        <td className="py-2 px-2 text-center">
                          <div className="w-10 h-10 rounded-lg overflow-hidden border border-slate-200 bg-white mx-auto flex items-center justify-center">
                            {itemImg ? (
                              <img
                                src={itemImg}
                                alt={item.itemName}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <ImageIcon className="w-4 h-4 text-slate-300" />
                            )}
                          </div>
                        </td>

                        {/* Name and Variant Specs */}
                        <td className="py-2 px-3">
                          <div className="font-semibold text-slate-800">{item.itemName}</div>
                          <div className="text-[10px] text-slate-400 flex items-center gap-2 mt-0.5">
                            <span>คงเหลือ สนง.ใหญ่: {stock} {item.unit}</span>
                            {catalogInfo?.variantSpec?.color && (
                              <span className="bg-slate-100 text-slate-700 px-1 rounded">
                                {catalogInfo.variantSpec.color}
                              </span>
                            )}
                            {catalogInfo?.variantSpec?.scent && (
                              <span className="bg-slate-100 text-slate-700 px-1 rounded">
                                {catalogInfo.variantSpec.scent}
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Quantity */}
                        <td className="py-2 px-2 text-center">
                          <input
                            type="number"
                            min={1}
                            value={item.quantity}
                            onChange={(e) =>
                              handleUpdateItem(idx, 'quantity', parseInt(e.target.value) || 1)
                            }
                            className="w-16 bg-white border border-slate-300 rounded px-2 py-1 text-center font-bold text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500"
                          />
                        </td>

                        <td className="py-2 px-2 text-center text-slate-600 font-medium">
                          {item.unit}
                        </td>

                        {/* Unit price & trend */}
                        <td className="py-2 px-3 text-right text-slate-600">
                          <div>{item.unitPrice.toLocaleString()} ฿</div>
                          {trend && trend.status === 'UP' && (
                            <span className="text-[10px] text-rose-600 font-bold flex items-center justify-end gap-0.5">
                              <TrendingUp className="w-3 h-3" /> +{trend.percent}%
                            </span>
                          )}
                        </td>

                        {/* Subtotal */}
                        <td className="py-2 px-3 text-right font-bold text-slate-900">
                          {(item.quantity * item.unitPrice).toLocaleString()} ฿
                        </td>

                        {/* Remark */}
                        <td className="py-2 px-3">
                          <input
                            type="text"
                            placeholder="หมายเหตุเพิ่มเติม"
                            value={item.remark}
                            onChange={(e) => handleUpdateItem(idx, 'remark', e.target.value)}
                            className="w-full bg-transparent border-b border-slate-300 text-[11px] text-slate-700 focus:outline-none focus:border-blue-500 py-0.5"
                          />
                        </td>

                        <td className="py-2 px-2 text-center">
                          <button
                            type="button"
                            onClick={() => handleRemoveItem(idx)}
                            className="text-slate-400 hover:text-rose-600 p-1 rounded transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot className="bg-slate-50 border-t border-slate-200">
                  <tr>
                    <td colSpan={6} className="py-3 px-3 text-right font-bold text-slate-700">
                      มูลค่ารวมทั้งสิ้น:
                    </td>
                    <td className="py-3 px-3 text-right font-extrabold text-sm text-blue-900">
                      {totalAmount.toLocaleString()} ฿
                    </td>
                    <td colSpan={2}></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Receiver and Sender names for Signature box in Delivery Slip */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                ชื่อผู้รับสินค้า (สาขา)
              </label>
              <input
                type="text"
                placeholder="เช่น คุณนพดล สุขเจริญ (ศูนย์ฝึกอาชีพจตุจักร)"
                value={receiverName}
                onChange={(e) => setReceiverName(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                ชื่อผู้ส่งสินค้า
              </label>
              <input
                type="text"
                placeholder="เช่น นายประสิทธิ์ พนักงานจัดส่ง"
                value={senderName}
                onChange={(e) => setSenderName(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>
        </form>

        {/* Footer Actions */}
        <div className="bg-slate-100 p-4 sm:p-5 border-t border-slate-200 flex items-center justify-between">
          <div className="text-xs text-slate-600">
            เอกสารนี้สามารถพิมพ์เป็น <strong className="text-slate-900">ใบส่งสินค้าทางการ (A4)</strong> ได้ทันทีหลังบันทึก
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 rounded-lg transition-colors cursor-pointer"
            >
              ยกเลิก
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={orderItems.length === 0}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs sm:text-sm font-bold px-5 py-2.5 rounded-xl shadow-md transition-all cursor-pointer"
            >
              <FileCheck className="w-4 h-4" />
              <span>บันทึก & ออกใบส่งของทันที</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
