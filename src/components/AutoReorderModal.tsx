import React, { useState, useMemo } from 'react';
import { useInventory } from '../context/InventoryContext';
import { InventoryItem, OrderItemDetail } from '../types/inventory';
import {
  AlertTriangle,
  CheckCircle,
  Truck,
  Calendar,
  Sparkles,
  Plus,
  Trash2,
  Copy,
  Check,
  X,
  FileText,
  Clock,
  Building,
  Image as ImageIcon,
} from 'lucide-react';

interface AutoReorderModalProps {
  onClose: () => void;
  onSuccessPoCreated: (poNumber: string) => void;
}

export const AutoReorderModal: React.FC<AutoReorderModalProps> = ({
  onClose,
  onSuccessPoCreated,
}) => {
  const { items, suppliers, branches, createPurchaseOrder } = useInventory();

  const [selectedSupplierId, setSelectedSupplierId] = useState<string>(
    suppliers[0]?.id || 'SUP-01'
  );

  const supplier = useMemo(
    () => suppliers.find((s) => s.id === selectedSupplierId) || suppliers[0],
    [suppliers, selectedSupplierId]
  );

  const [destination, setDestination] = useState<'HQ_WAREHOUSE' | 'DIRECT_BRANCH'>(
    'HQ_WAREHOUSE'
  );
  const [selectedBranchId, setSelectedBranchId] = useState<string>(
    branches[0]?.id || 'BR-01'
  );
  const [copiedText, setCopiedText] = useState(false);

  // Initialize reorder items with all items that are low in stock
  const initialItemsToReorder = useMemo(() => {
    const criticalItems = items.filter(
      (item) =>
        item.currentStockHQ <= item.minStockThreshold &&
        (item.supplierId === selectedSupplierId || !item.supplierId)
    );

    return criticalItems.map((item) => ({
      itemId: item.id,
      itemName: item.name,
      quantity: item.reorderQuantity || Math.max(5, item.minStockThreshold * 2),
      unit: item.unit,
      unitPrice: item.unitPrice,
      baselinePrice: item.baselinePrice || item.unitPrice,
      imageUrl: item.imageUrl,
      currentStock: item.currentStockHQ,
      minStock: item.minStockThreshold,
    }));
  }, [items, selectedSupplierId]);

  const [orderItems, setOrderItems] = useState(initialItemsToReorder);
  const [additionalItemId, setAdditionalItemId] = useState<string>('');

  // Update item quantity
  const handleQuantityChange = (itemId: string, newQty: number) => {
    const val = Math.max(1, newQty);
    setOrderItems((prev) =>
      prev.map((item) => (item.itemId === itemId ? { ...item, quantity: val } : item))
    );
  };

  // Remove item
  const handleRemoveItem = (itemId: string) => {
    setOrderItems((prev) => prev.filter((item) => item.itemId !== itemId));
  };

  // Add additional item from catalog
  const handleAddCatalogItem = () => {
    if (!additionalItemId) return;
    const itemToAdd = items.find((i) => i.id === additionalItemId);
    if (!itemToAdd) return;

    if (orderItems.some((i) => i.itemId === itemToAdd.id)) {
      // If already present, increment
      handleQuantityChange(itemToAdd.id, (orderItems.find((i) => i.itemId === itemToAdd.id)?.quantity || 1) + 1);
    } else {
      setOrderItems((prev) => [
        ...prev,
        {
          itemId: itemToAdd.id,
          itemName: itemToAdd.name,
          quantity: itemToAdd.reorderQuantity || 5,
          unit: itemToAdd.unit,
          unitPrice: itemToAdd.unitPrice,
          baselinePrice: itemToAdd.baselinePrice || itemToAdd.unitPrice,
          imageUrl: itemToAdd.imageUrl,
          currentStock: itemToAdd.currentStockHQ,
          minStock: itemToAdd.minStockThreshold,
        },
      ]);
    }
    setAdditionalItemId('');
  };

  // Calculations
  const minRequiredAmount = supplier?.minOrderAmount || 5000;
  const totalAmount = useMemo(
    () => orderItems.reduce((acc, curr) => acc + curr.quantity * curr.unitPrice, 0),
    [orderItems]
  );
  const differenceToMin = Math.max(0, minRequiredAmount - totalAmount);
  const isMinMet = totalAmount >= minRequiredAmount;

  // Smart Top-Up: automatically increases quantity of high-usage items (trash bags, tissue, detergents) to satisfy the 5,000 THB minimum
  const handleSmartTopUp = () => {
    if (isMinMet) return;
    let deficit = differenceToMin;
    const updated = [...orderItems];

    // Priority items for top-up
    const fastMovers = ['ทิชชู่', 'ถุงขยะ', 'สบู่', 'พื้น', 'กระจก'];

    for (let i = 0; i < updated.length && deficit > 0; i++) {
      const it = updated[i];
      const isFastMover = fastMovers.some((keyword) => it.itemName.includes(keyword));
      if (isFastMover || i === updated.length - 1) {
        const unitsNeeded = Math.ceil(deficit / it.unitPrice);
        it.quantity += unitsNeeded;
        deficit = 0;
        break;
      }
    }

    // If still deficit, add tissue or standard fast-turnover item from catalog
    if (deficit > 0) {
      const tissue = items.find((i) => i.name.includes('ทิชชู่') || i.unitPrice >= 200);
      if (tissue) {
        const unitsNeeded = Math.ceil(deficit / tissue.unitPrice);
        updated.push({
          itemId: tissue.id,
          itemName: tissue.name,
          quantity: unitsNeeded,
          unit: tissue.unit,
          unitPrice: tissue.unitPrice,
          baselinePrice: tissue.baselinePrice || tissue.unitPrice,
          imageUrl: tissue.imageUrl,
          currentStock: tissue.currentStockHQ,
          minStock: tissue.minStockThreshold,
        });
      }
    }

    setOrderItems(updated);
  };

  // Calculate 7 days delivery arrival date
  const today = new Date();
  const deliveryDateObj = new Date(today);
  deliveryDateObj.setDate(today.getDate() + 7);
  const deliveryDateStr = deliveryDateObj.toISOString().split('T')[0];

  const targetBranch = branches.find((b) => b.id === selectedBranchId);

  // Submit Order
  const handleConfirmOrder = async () => {
    if (orderItems.length === 0) return;

    const itemsPayload: OrderItemDetail[] = orderItems.map((item) => ({
      itemId: item.itemId,
      itemName: item.itemName,
      quantity: item.quantity,
      unit: item.unit,
      unitPrice: item.unitPrice,
    }));

    const po = await createPurchaseOrder({
      supplierId: supplier.id,
      supplierName: supplier.name,
      orderDate: today.toISOString().split('T')[0],
      expectedDeliveryDate: deliveryDateStr,
      destination,
      targetBranchId: destination === 'DIRECT_BRANCH' ? targetBranch?.id : undefined,
      targetBranchName: destination === 'DIRECT_BRANCH' ? targetBranch?.name : undefined,
      items: itemsPayload,
      notes: `สั่งซื้อของเพิ่มอัตโนมัติผ่านระบบออนไลน์ (ระยะเวลาจัดส่ง 7 วัน) ส่งถึง ${
        destination === 'DIRECT_BRANCH'
          ? `สาขา: ${targetBranch?.name}`
          : 'คลังสินค้ากลาง สนง.ใหญ่ โนวาโซล'
      }`,
    });

    onSuccessPoCreated(po.poNumber);
    onClose();
  };

  // Copy procurement message for LINE/Email
  const generateMessageText = () => {
    const list = orderItems
      .map(
        (it, idx) =>
          `${idx + 1}. ${it.itemName} จำนวน ${it.quantity} ${it.unit} (@${it.unitPrice} ฿ = ${(
            it.quantity * it.unitPrice
          ).toLocaleString()} บาท)`
      )
      .join('\n');

    return `เรียน ${supplier.name}\n` +
      `เรื่อง สั่งซื้อวัสดุอุปกรณ์ทำความสะอาด (ระบบควบคุมคลังสินค้า โนวาโซล)\n\n` +
      `รายการสั่งซื้อ:\n${list}\n\n` +
      `ยอดรวมทั้งสิ้น: ${totalAmount.toLocaleString()} บาท (ขั้นต่ำ 5,000 บาท: ${isMinMet ? 'ผ่านเกณฑ์' : 'ไม่ถึง'})\n` +
      `สถานที่จัดส่ง: ${
        destination === 'DIRECT_BRANCH'
          ? `ส่งตรงถึงสาขา: ${targetBranch?.name} (${targetBranch?.address})`
          : 'คลังสินค้าสำนักงานใหญ่ โนวาโซล 199/32 ม.เด่นชัย 2 ต.บางด้วน สมุทรปราการ'
      }\n` +
      `ระยะเวลาจัดส่งที่กำหนด: ภายใน 7 วัน (คาดว่าจะได้รับวันที่: ${deliveryDateStr})\n` +
      `ติดต่อประสานงาน: ห้างหุ้นส่วนจำกัด โนวาโซล โทร. 089-455-0278`;
  };

  const handleCopyMessage = () => {
    navigator.clipboard.writeText(generateMessageText());
    setCopiedText(true);
    setTimeout(() => setCopiedText(false), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm flex justify-center items-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-700 via-indigo-700 to-blue-900 text-white p-5 sm:p-6 flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="bg-blue-500/30 text-blue-200 text-xs px-2.5 py-1 rounded-full font-semibold border border-blue-400/30 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" />
                ระบบสั่งซื้อของเพิ่มอัตโนมัติ (Auto-Reorder Engine)
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold mt-2 flex items-center gap-2">
              สั่งซื้อสินค้าเพิ่มเข้าคลังสินค้า
            </h2>
            <p className="text-blue-100 text-xs sm:text-sm mt-1">
              คำนวณจากสต็อกที่ใกล้หมด &bull; ระยะเวลาขนส่งประมาณ 7 วัน &bull; เกณฑ์ขั้นต่ำ {minRequiredAmount.toLocaleString()} บาท/คำสั่งซื้อ
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-blue-200 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-6 flex-1">
          {/* Top Options: Supplier & Destination */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Supplier Selector */}
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
              <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wider">
                Supplier ผู้จัดจำหน่าย
              </label>
              <select
                value={selectedSupplierId}
                onChange={(e) => setSelectedSupplierId(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} (ยอดขั้นต่ำ {s.minOrderAmount.toLocaleString()} ฿)
                  </option>
                ))}
              </select>
              <div className="mt-2 text-xs text-slate-500 flex items-center justify-between">
                <span>โทร: {supplier.phone}</span>
                <span className="text-blue-700 font-medium">เงื่อนไข: ขั้นต่ำ 5,000 บาท</span>
              </div>
            </div>

            {/* Destination Selector */}
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
              <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wider">
                จุดหมายปลายทางจัดส่ง
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setDestination('HQ_WAREHOUSE')}
                  className={`px-3 py-2 text-xs font-semibold rounded-lg border text-left transition-all flex flex-col gap-1 ${
                    destination === 'HQ_WAREHOUSE'
                      ? 'bg-blue-50 border-blue-600 text-blue-900 ring-2 ring-blue-500/20'
                      : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <span className="flex items-center gap-1.5">
                    <Building className="w-3.5 h-3.5 text-blue-600" />
                    ส่งเข้าคลัง สนง.ใหญ่
                  </span>
                  <span className="text-[10px] text-slate-500">
                    เก็บสำรอง & รอกระจายต่อ
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setDestination('DIRECT_BRANCH')}
                  className={`px-3 py-2 text-xs font-semibold rounded-lg border text-left transition-all flex flex-col gap-1 ${
                    destination === 'DIRECT_BRANCH'
                      ? 'bg-blue-50 border-blue-600 text-blue-900 ring-2 ring-blue-500/20'
                      : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <span className="flex items-center gap-1.5">
                    <Truck className="w-3.5 h-3.5 text-indigo-600" />
                    ส่งตรงถึงสาขา (5,000+ ฿)
                  </span>
                  <span className="text-[10px] text-slate-500">
                    Supplier วิ่งส่งถึงสาขา
                  </span>
                </button>
              </div>

              {destination === 'DIRECT_BRANCH' && (
                <div className="mt-2.5">
                  <select
                    value={selectedBranchId}
                    onChange={(e) => setSelectedBranchId(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {branches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </div>

          {/* Delivery Timeline Card */}
          <div className="bg-blue-50/70 border border-blue-200 rounded-xl p-3.5 flex items-center justify-between text-xs text-blue-900">
            <div className="flex items-center gap-3">
              <Clock className="w-5 h-5 text-blue-600 shrink-0" />
              <div>
                <span className="font-semibold">ระยะเวลาส่งของประมาณ 7 วัน:</span> คำสั่งซื้อจะถูกส่งทางออนไลน์วันนี้ และคาดว่าสินค้าจะมาถึงในวันที่{' '}
                <strong className="text-blue-950 underline decoration-blue-400">
                  {new Date(deliveryDateStr).toLocaleDateString('th-TH', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                  })}
                </strong>
              </div>
            </div>
            <span className="hidden sm:inline-block bg-blue-100 text-blue-800 px-2 py-1 rounded font-medium">
              Lead Time: 7 วัน
            </span>
          </div>

          {/* 5,000 THB Minimum Rule Status Bar */}
          <div
            className={`p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
              isMinMet
                ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                : 'bg-amber-50 border-amber-300 text-amber-900'
            }`}
          >
            <div className="flex items-center gap-3">
              {isMinMet ? (
                <CheckCircle className="w-6 h-6 text-emerald-600 shrink-0" />
              ) : (
                <AlertTriangle className="w-6 h-6 text-amber-600 shrink-0" />
              )}
              <div>
                <div className="font-bold text-sm sm:text-base">
                  {isMinMet
                    ? `ยอดสั่งซื้อรวม ${totalAmount.toLocaleString()} บาท (ผ่านเกณฑ์ขั้นต่ำ 5,000 บาท)`
                    : `ยอดสั่งซื้อรวม ${totalAmount.toLocaleString()} บาท (ยังขาดอีก ${differenceToMin.toLocaleString()} บาท)`}
                </div>
                <div className="text-xs text-slate-600 mt-0.5">
                  {isMinMet
                    ? 'เงื่อนไข Supplier: ครบยอด 5,000 บาท พร้อมส่งใบสั่งซื้อและจัดส่งฟรีทันที'
                    : 'Supplier บริษัท คงธนา เซอร์วิส จำกัด มีเงื่อนไขสั่งขั้นต่ำ 5,000 บาท'}
                </div>
              </div>
            </div>

            {!isMinMet && (
              <button
                type="button"
                onClick={handleSmartTopUp}
                className="flex items-center justify-center gap-2 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 text-white text-xs font-semibold px-4 py-2.5 rounded-lg shadow-sm transition-all shrink-0 cursor-pointer"
              >
                <Sparkles className="w-4 h-4 text-amber-200" />
                <span>เติมสินค้าหมุนเวียนเร็วให้ครบ 5,000 ฿ (Smart Top-up)</span>
              </button>
            )}
          </div>

          {/* Items Reorder Table */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                <span>รายการสินค้าที่จะสั่งซื้อ</span>
                <span className="bg-slate-200 text-slate-700 text-xs px-2 py-0.5 rounded-full font-medium">
                  {orderItems.length} รายการ
                </span>
              </h3>

              {/* Add item dropdown */}
              <div className="flex items-center gap-2">
                <select
                  value={additionalItemId}
                  onChange={(e) => setAdditionalItemId(e.target.value)}
                  className="bg-white border border-slate-300 rounded-lg px-2.5 py-1 text-xs text-slate-700 focus:outline-none"
                >
                  <option value="">+ เลือกเพิ่มสินค้าจากคลัง...</option>
                  {items
                    .filter((i) => !orderItems.some((oi) => oi.itemId === i.id))
                    .map((i) => (
                      <option key={i.id} value={i.id}>
                        {i.name} ({i.unitPrice} ฿/{i.unit})
                      </option>
                    ))}
                </select>
                <button
                  type="button"
                  onClick={handleAddCatalogItem}
                  disabled={!additionalItemId}
                  className="bg-slate-800 hover:bg-slate-900 disabled:bg-slate-300 text-white text-xs px-2.5 py-1 rounded-lg transition-colors cursor-pointer"
                >
                  เพิ่ม
                </button>
              </div>
            </div>

            <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-2 text-center w-8">ที่</th>
                    <th className="py-2.5 px-2 text-center w-12">รูปภาพ</th>
                    <th className="py-2.5 px-3">รายการวัสดุ/อุปกรณ์</th>
                    <th className="py-2.5 px-2 text-center w-24">สต็อกคงเหลือ</th>
                    <th className="py-2.5 px-3 text-center w-28">จำนวนที่สั่ง</th>
                    <th className="py-2.5 px-2 text-right w-24">ราคา/หน่วย</th>
                    <th className="py-2.5 px-3 text-right w-28">รวม (บาท)</th>
                    <th className="py-2.5 px-2 text-center w-8"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {orderItems.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-slate-400">
                        ไม่มีรายการสินค้าที่ต้องสั่งซื้อขณะนี้
                      </td>
                    </tr>
                  ) : (
                    orderItems.map((item, index) => {
                      const isLow = item.currentStock <= item.minStock;
                      const priceDiff = item.unitPrice - (item.baselinePrice || item.unitPrice);
                      const isPriceUp = priceDiff > 0;

                      return (
                        <tr key={item.itemId} className="hover:bg-slate-50/70 transition-colors">
                          <td className="py-2.5 px-2 text-center text-slate-500 font-medium">
                            {index + 1}
                          </td>
                          <td className="py-2.5 px-2 text-center">
                            <div className="w-9 h-9 rounded-lg overflow-hidden border border-slate-200 bg-white mx-auto flex items-center justify-center">
                              {item.imageUrl ? (
                                <img src={item.imageUrl} alt={item.itemName} className="w-full h-full object-cover" />
                              ) : (
                                <ImageIcon className="w-3.5 h-3.5 text-slate-300" />
                              )}
                            </div>
                          </td>
                          <td className="py-2.5 px-3 font-medium text-slate-800">
                            <div>{item.itemName}</div>
                            {isLow && (
                              <span className="inline-flex items-center gap-1 text-[10px] text-amber-700 bg-amber-50 px-1.5 py-0.2 rounded font-normal border border-amber-200/50 mt-0.5">
                                สต็อกใกล้หมด (เหลือ {item.currentStock} / เกณฑ์เตือน {item.minStock})
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-2 text-center">
                            <span
                              className={`font-semibold ${
                                isLow ? 'text-rose-600' : 'text-slate-700'
                              }`}
                            >
                              {item.currentStock} {item.unit}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              <input
                                type="number"
                                min={1}
                                value={item.quantity}
                                onChange={(e) =>
                                  handleQuantityChange(item.itemId, parseInt(e.target.value) || 1)
                                }
                                className="w-16 bg-white border border-slate-300 rounded px-2 py-1 text-center font-bold text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500"
                              />
                              <span className="text-slate-500 text-[11px]">{item.unit}</span>
                            </div>
                          </td>
                          <td className="py-2.5 px-2 text-right text-slate-700">
                            <div className="font-semibold">{item.unitPrice.toLocaleString()} ฿</div>
                            {isPriceUp && (
                              <span className="text-[10px] text-rose-600 font-bold block">
                                +{priceDiff.toLocaleString()} ฿ (ปรับขึ้น)
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-right font-bold text-slate-900">
                            {(item.quantity * item.unitPrice).toLocaleString()} ฿
                          </td>
                          <td className="py-2.5 px-2 text-center">
                            <button
                              type="button"
                              onClick={() => handleRemoveItem(item.itemId)}
                              className="text-slate-400 hover:text-rose-600 p-1 rounded transition-colors"
                              title="ลบรายการ"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
                <tfoot className="bg-slate-50 border-t border-slate-200">
                  <tr>
                    <td colSpan={5} className="py-3 px-3 text-right font-bold text-slate-700">
                      ยอดรวมทั้งสิ้น:
                    </td>
                    <td className="py-3 px-3 text-right font-extrabold text-base text-blue-900">
                      {totalAmount.toLocaleString()} ฿
                    </td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="bg-slate-100 p-4 sm:p-5 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopyMessage}
              className="flex items-center gap-1.5 text-xs text-slate-700 hover:text-slate-900 bg-white border border-slate-300 hover:bg-slate-50 px-3 py-2 rounded-lg font-medium transition-colors shadow-xs"
            >
              {copiedText ? (
                <>
                  <Check className="w-4 h-4 text-emerald-600" />
                  <span className="text-emerald-700 font-semibold">คัดลอกข้อความแล้ว!</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  <span>คัดลอกข้อความส่ง LINE/เมล Supplier</span>
                </>
              )}
            </button>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 bg-transparent hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
            >
              ยกเลิก
            </button>
            <button
              type="button"
              onClick={handleConfirmOrder}
              disabled={orderItems.length === 0}
              className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 text-white text-xs sm:text-sm font-bold px-5 py-2.5 rounded-xl shadow-md transition-all cursor-pointer"
            >
              <Truck className="w-4 h-4" />
              <span>ยืนยันและสร้างคำสั่งซื้อ PO ออนไลน์</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
