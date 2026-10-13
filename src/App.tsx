import React, { useState } from 'react';
import { InventoryProvider, useInventory } from './context/InventoryContext';
import { NovasolLogo } from './components/NovasolLogo';
import { DeliveryNotePrint } from './components/DeliveryNotePrint';
import { AutoReorderModal } from './components/AutoReorderModal';
import { BranchRequisitionModal } from './components/BranchRequisitionModal';
import { StockAdjustmentModal } from './components/StockAdjustmentModal';
import { OrderEditModal } from './components/OrderEditModal';
import { GoogleSheetsExporter } from './components/GoogleSheetsExporter';
import { InventoryItem, BranchOrder, PurchaseOrder, ItemCategory } from './types/inventory';
import { COMPANY_INFO } from './data/mockInitialData';
import {
  Boxes,
  AlertTriangle,
  Truck,
  FileSpreadsheet,
  Printer,
  Plus,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  ArrowRight,
  ShieldAlert,
  Building,
  RefreshCw,
  ShoppingBag,
  PackageCheck,
  ChevronRight,
  Info,
  Calendar,
  Layers,
  MapPin,
  ExternalLink,
  Code2,
  Image as ImageIcon,
  TrendingUp,
  TrendingDown,
  Sparkles,
  Share2,
  Radio,
  Upload,
  FolderOpen,
  Target,
  Trash2,
  Building2,
  Pencil,
} from 'lucide-react';
import { GoogleAppsScriptModal } from './components/GoogleAppsScriptModal';
import { ItemDetailModal } from './components/ItemDetailModal';
import { ShareLinkModal } from './components/ShareLinkModal';
import { RealtimeSyncModal } from './components/RealtimeSyncModal';
import { LiveGoogleSheetStatusBar } from './components/LiveGoogleSheetStatusBar';
import { BranchDemandPlanningTab } from './components/BranchDemandPlanningTab';
import { BranchManagementTab } from './components/BranchManagementTab';
import { SupplierManagementTab } from './components/SupplierManagementTab';
import { BudgetReportTab } from './components/BudgetReportTab';
import { Wallet } from 'lucide-react';
import { Factory } from 'lucide-react';
import { processLocalImageFile, convertToLh3Url } from './utils/imageHelper';

const MainApp: React.FC = () => {
  const {
    items,
    suppliers,
    branches,
    branchOrders,
    purchaseOrders,
    lowStockItems,
    sheetsSync,
    isSheetsConfigured,
    updateBranchOrderStatus,
    markOrderPayment,
    updatePOStatus,
    resetToDefaultData,
    addItem,
    deleteBranchOrder,
  } = useInventory();

  // Navigation tab
  const [currentTab, setCurrentTab] = useState<
    | 'DASHBOARD'
    | 'INVENTORY'
    | 'BRANCH_DELIVERY'
    | 'DEMAND_PLANNING'
    | 'BRANCH_MANAGEMENT'
    | 'SUPPLIERS'
    | 'BUDGET'
    | 'PURCHASE_ORDERS'
    | 'SHEETS_SYNC'
  >('DASHBOARD');

  // Order deletion confirmation state
  const [orderToDelete, setOrderToDelete] = useState<BranchOrder | null>(null);
  const [orderToEdit, setOrderToEdit] = useState<BranchOrder | null>(null);

  // Modals state
  const [showAutoReorderModal, setShowAutoReorderModal] = useState(false);
  const [showRequisitionModal, setShowRequisitionModal] = useState(false);
  const [selectedOrderToPrint, setSelectedOrderToPrint] = useState<BranchOrder | null>(null);
  const [itemToAdjust, setItemToAdjust] = useState<InventoryItem | null>(null);
  const [selectedItemForDetail, setSelectedItemForDetail] = useState<InventoryItem | null>(null);
  const [showAddItemModal, setShowAddItemModal] = useState(false);
  const [showGasModal, setShowGasModal] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showRealtimeSyncModal, setShowRealtimeSyncModal] = useState(false);

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [stockStatusFilter, setStockStatusFilter] = useState<'ALL' | 'LOW' | 'NORMAL'>('ALL');

  // New Item Form State
  const [newItemName, setNewItemName] = useState('');
  const [newItemCode, setNewItemCode] = useState('');
  const [newItemCategory, setNewItemCategory] = useState<ItemCategory>('น้ำยาและเคมีภัณฑ์');
  const [newItemUnit, setNewItemUnit] = useState('แกลลอน');
  const [newItemSupplierId, setNewItemSupplierId] = useState('');
  const [newItemPrice, setNewItemPrice] = useState<number>(150);
  const [newItemStock, setNewItemStock] = useState<number>(10);
  const [newItemMinThreshold, setNewItemMinThreshold] = useState<number>(5);
  const [newItemImage, setNewItemImage] = useState<string>('');
  const [isUploadingNewImage, setIsUploadingNewImage] = useState<boolean>(false);

  const handleAddNewItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItemName) return;

    addItem({
      code: newItemCode || `MAT-${String(items.length + 1).padStart(3, '0')}`,
      name: newItemName,
      category: newItemCategory,
      unit: newItemUnit,
      unitPrice: Number(newItemPrice) || 100,
      baselinePrice: Number(newItemPrice) || 100,
      currentStockHQ: Number(newItemStock) || 0,
      minStockThreshold: Number(newItemMinThreshold) || 5,
      reorderQuantity: 10,
      leadTimeDays: 7,
      dailyUsage: 0.5,
      supplierId: newItemSupplierId || suppliers[0]?.id || '',
      imageUrl: newItemImage.trim() || undefined,
    });

    setNewItemName('');
    setNewItemCode('');
    setNewItemImage('');
    setNewItemSupplierId('');
    setShowAddItemModal(false);
  };

  // Filtered items
  const filteredItems = items.filter((item) => {
    const matchesSearch =
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.code.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory =
      selectedCategory === 'ALL' || item.category === selectedCategory;
    const matchesStock =
      stockStatusFilter === 'ALL'
        ? true
        : stockStatusFilter === 'LOW'
        ? item.currentStockHQ <= item.minStockThreshold
        : item.currentStockHQ > item.minStockThreshold;

    return matchesSearch && matchesCategory && matchesStock;
  });

  // Calculate estimated total PO cost for low stock items
  const estimatedReorderTotal = lowStockItems.reduce(
    (sum, item) => sum + (item.reorderQuantity || 10) * item.unitPrice,
    0
  );

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans">
      {/* Live Google Sheet Connection Status Bar */}
      <LiveGoogleSheetStatusBar
        onOpenSettings={() => setShowRealtimeSyncModal(true)}
        onOpenGasModal={() => setShowGasModal(true)}
      />

      {/* Top Header Bar */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-xs no-print">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-20">
            {/* Logo and Brand Title */}
            <div className="flex items-center gap-3.5">
              <NovasolLogo size={58} className="shrink-0" />
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="font-extrabold text-lg sm:text-xl text-slate-900 tracking-tight leading-none">
                    {COMPANY_INFO.name}
                  </h1>
                  <span className="hidden sm:inline-block bg-blue-100 text-blue-800 text-[11px] font-bold px-2 py-0.5 rounded-full border border-blue-200">
                    Warehouse & Distribution
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-1 font-medium">
                  ระบบควบคุมวัสดุอุปกรณ์คลังสินค้า &bull; สั่งซื้ออัตโนมัติ (7 วัน) &bull; กระจายส่งสาขา (เกณฑ์ 5,000 ฿)
                </p>
              </div>
            </div>

            {/* Quick Action Buttons */}
            <div className="flex items-center gap-1.5 sm:gap-2.5">
              {/* Google Sheet database status pill */}
              <button
                onClick={() => setShowRealtimeSyncModal(true)}
                className={`flex items-center gap-1 sm:gap-1.5 text-xs font-bold px-2.5 sm:px-3 py-2 rounded-xl border transition-colors cursor-pointer ${
                  sheetsSync.status === 'ONLINE' || sheetsSync.status === 'SYNCING'
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100'
                    : sheetsSync.status === 'ERROR'
                    ? 'bg-rose-50 text-rose-800 border-rose-300 hover:bg-rose-100'
                    : 'bg-amber-50 text-amber-800 border-amber-300 hover:bg-amber-100'
                }`}
                title="คลิกเพื่อตั้งค่าหรือดูสถานะการเชื่อมต่อ Google Sheet (ฐานข้อมูลของระบบ)"
              >
                <span
                  className={`w-2 h-2 rounded-full shrink-0 ${
                    sheetsSync.status === 'ONLINE' || sheetsSync.status === 'SYNCING'
                      ? 'bg-emerald-500 animate-pulse'
                      : sheetsSync.status === 'ERROR'
                      ? 'bg-rose-500'
                      : 'bg-amber-500'
                  }`}
                />
                <span className="hidden lg:inline">Google Sheet:</span>
                <span>
                  {!isSheetsConfigured
                    ? 'ตั้งค่าเชื่อมต่อ'
                    : sheetsSync.status === 'ERROR'
                    ? 'มีปัญหา'
                    : sheetsSync.status === 'ONLINE'
                    ? 'ออนไลน์'
                    : 'กำลังซิงก์'}
                </span>
              </button>

              <button
                onClick={() => setShowAutoReorderModal(true)}
                className="hidden xl:flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white text-xs sm:text-sm font-bold px-3.5 py-2.5 rounded-xl shadow-xs transition-all cursor-pointer"
              >
                <ShoppingBag className="w-4 h-4" />
                <span>สั่งของเพิ่ม (Auto-PO)</span>
                {lowStockItems.length > 0 && (
                  <span className="bg-rose-500 text-white text-[11px] px-1.5 py-0.2 rounded-full font-extrabold animate-pulse">
                    {lowStockItems.length}
                  </span>
                )}
              </button>

              <button
                onClick={() => setShowShareModal(true)}
                className="flex items-center gap-1 sm:gap-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 text-xs sm:text-sm font-bold px-2.5 sm:px-3 py-2 sm:py-2.5 rounded-xl transition-colors cursor-pointer"
                title="แชร์ลิงก์ให้พนักงานนำไปใช้ได้ทันที"
              >
                <Share2 className="w-4 h-4 text-blue-600 shrink-0" />
                <span className="hidden md:inline">แชร์ลิงก์</span>
              </button>

              <button
                onClick={() => setShowGasModal(true)}
                className="hidden sm:flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-bold px-3 py-2 sm:py-2.5 rounded-xl shadow-xs transition-colors cursor-pointer"
              >
                <Code2 className="w-4 h-4" />
                <span className="hidden lg:inline">Google Apps Script</span>
                <span className="lg:hidden">GAS</span>
              </button>

              <button
                onClick={() => setShowRequisitionModal(true)}
                className="flex items-center gap-1.5 sm:gap-2 bg-slate-900 hover:bg-slate-800 text-white text-xs sm:text-sm font-bold px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl shadow-xs transition-all cursor-pointer"
              >
                <Truck className="w-4 h-4 shrink-0" />
                <span>ออกใบส่งของ</span>
              </button>
            </div>
          </div>

          {/* Navigation Tabs */}
          <nav className="flex space-x-1 sm:space-x-3 border-t border-slate-100 overflow-x-auto py-2">
            <button
              onClick={() => setCurrentTab('DASHBOARD')}
              className={`px-3 py-2 text-xs sm:text-sm font-semibold rounded-lg transition-colors cursor-pointer flex items-center gap-2 whitespace-nowrap ${
                currentTab === 'DASHBOARD'
                  ? 'bg-blue-50 text-blue-700 font-bold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <Boxes className="w-4 h-4" />
              <span>ภาพรวมคลังสินค้า & แจ้งเตือน</span>
              {lowStockItems.length > 0 && (
                <span className="bg-rose-600 text-white text-[10px] px-1.5 py-0.5 rounded-full font-bold">
                  {lowStockItems.length}
                </span>
              )}
            </button>

            <button
              onClick={() => setCurrentTab('INVENTORY')}
              className={`px-3 py-2 text-xs sm:text-sm font-semibold rounded-lg transition-colors cursor-pointer flex items-center gap-2 whitespace-nowrap ${
                currentTab === 'INVENTORY'
                  ? 'bg-blue-50 text-blue-700 font-bold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <Layers className="w-4 h-4" />
              <span>คลังสินค้า สนง.ใหญ่ ({items.length})</span>
            </button>

            <button
              onClick={() => setCurrentTab('BRANCH_DELIVERY')}
              className={`px-3 py-2 text-xs sm:text-sm font-semibold rounded-lg transition-colors cursor-pointer flex items-center gap-2 whitespace-nowrap ${
                currentTab === 'BRANCH_DELIVERY'
                  ? 'bg-blue-50 text-blue-700 font-bold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <Truck className="w-4 h-4" />
              <span>กระจายส่งสินค้าสาขา ({branchOrders.length})</span>
            </button>

            <button
              onClick={() => setCurrentTab('DEMAND_PLANNING')}
              className={`px-3 py-2 text-xs sm:text-sm font-semibold rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
                currentTab === 'DEMAND_PLANNING'
                  ? 'bg-indigo-50 text-indigo-700 font-bold border-b-2 border-indigo-600'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <Target className="w-4 h-4 text-indigo-600" />
              <span>ความต้องการสาขา & โควตา</span>
              <span className="bg-indigo-100 text-indigo-800 text-[10px] px-1.5 py-0.2 rounded-full font-extrabold">
                Smart
              </span>
            </button>

            <button
              onClick={() => setCurrentTab('BRANCH_MANAGEMENT')}
              className={`px-3 py-2 text-xs sm:text-sm font-semibold rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
                currentTab === 'BRANCH_MANAGEMENT'
                  ? 'bg-blue-50 text-blue-700 font-bold border-b-2 border-blue-600'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <Building2 className="w-4 h-4 text-blue-600" />
              <span>จัดการสาขา ({branches.length})</span>
            </button>

            <button
              onClick={() => setCurrentTab('SUPPLIERS')}
              className={`px-3 py-2 text-xs sm:text-sm font-semibold rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
                currentTab === 'SUPPLIERS'
                  ? 'bg-blue-50 text-blue-700 font-bold border-b-2 border-blue-600'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <Factory className="w-4 h-4 text-blue-600" />
              <span>Supplier ผู้จัดจำหน่าย ({suppliers.length})</span>
            </button>

            <button
              onClick={() => setCurrentTab('BUDGET')}
              className={`px-3 py-2 text-xs sm:text-sm font-semibold rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
                currentTab === 'BUDGET'
                  ? 'bg-blue-50 text-blue-700 font-bold border-b-2 border-blue-600'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <Wallet className="w-4 h-4 text-blue-600" />
              <span>งบประมาณ & ค้างจ่าย</span>
            </button>

            <button
              onClick={() => setCurrentTab('PURCHASE_ORDERS')}
              className={`px-3 py-2 text-xs sm:text-sm font-semibold rounded-lg transition-colors cursor-pointer flex items-center gap-2 whitespace-nowrap ${
                currentTab === 'PURCHASE_ORDERS'
                  ? 'bg-blue-50 text-blue-700 font-bold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <ShoppingBag className="w-4 h-4" />
              <span>คำสั่งซื้อ Supplier PO ({purchaseOrders.length})</span>
            </button>

            <button
              onClick={() => setCurrentTab('SHEETS_SYNC')}
              className={`px-3 py-2 text-xs sm:text-sm font-semibold rounded-lg transition-colors cursor-pointer flex items-center gap-2 whitespace-nowrap ${
                currentTab === 'SHEETS_SYNC'
                  ? 'bg-emerald-50 text-emerald-800 font-bold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              <span>บันทึก Google Sheet & CSV</span>
            </button>
          </nav>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        
        {/* ========================================================= */}
        {/* 1. DASHBOARD VIEW */}
        {/* ========================================================= */}
        {currentTab === 'DASHBOARD' && (
          <div className="space-y-6">
            
            {/* Metrics Overview Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Card 1: Low Stock Warning */}
              <div
                onClick={() => setShowAutoReorderModal(true)}
                className={`p-5 rounded-2xl border transition-all cursor-pointer relative overflow-hidden shadow-xs hover:shadow-md ${
                  lowStockItems.length > 0
                    ? 'bg-gradient-to-br from-rose-50 to-orange-50/50 border-rose-300'
                    : 'bg-white border-slate-200'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-xs font-semibold text-rose-800 uppercase tracking-wider">
                      แจ้งเตือนสต็อกใกล้หมด
                    </span>
                    <div className="text-3xl font-extrabold text-rose-600 mt-1 flex items-baseline gap-2">
                      <span>{lowStockItems.length}</span>
                      <span className="text-xs font-normal text-rose-700">รายการ</span>
                    </div>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-rose-100 flex items-center justify-center text-rose-600">
                    <AlertTriangle className="w-5 h-5" />
                  </div>
                </div>
                <div className="mt-3 text-xs text-rose-900 flex items-center justify-between font-medium">
                  <span>กดเพื่อสั่งซื้อเพิ่มทันที &rarr;</span>
                  <span className="font-bold">ขั้นต่ำ 5,000 ฿</span>
                </div>
              </div>

              {/* Card 2: Total Items */}
              <div
                onClick={() => setCurrentTab('INVENTORY')}
                className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs hover:shadow-md transition-all cursor-pointer"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      วัสดุอุปกรณ์ในคลัง สนง.ใหญ่
                    </span>
                    <div className="text-3xl font-extrabold text-slate-900 mt-1 flex items-baseline gap-2">
                      <span>{items.length}</span>
                      <span className="text-xs font-normal text-slate-500">ชนิด</span>
                    </div>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600">
                    <Boxes className="w-5 h-5" />
                  </div>
                </div>
                <div className="mt-3 text-xs text-slate-500 flex items-center gap-1.5">
                  <span className="text-emerald-600 font-semibold">
                    {items.length - lowStockItems.length} รายการ
                  </span>
                  <span>อยู่ในระดับปลอดภัย</span>
                </div>
              </div>

              {/* Card 3: Supplier PO in transit (7 days) */}
              <div
                onClick={() => setCurrentTab('PURCHASE_ORDERS')}
                className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs hover:shadow-md transition-all cursor-pointer"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      คำสั่งซื้อ Supplier กำลังขนส่ง
                    </span>
                    <div className="text-3xl font-extrabold text-blue-600 mt-1 flex items-baseline gap-2">
                      <span>
                        {purchaseOrders.filter((p) => p.status === 'IN_TRANSIT').length}
                      </span>
                      <span className="text-xs font-normal text-slate-500">ใบสั่งซื้อ</span>
                    </div>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600">
                    <Clock className="w-5 h-5" />
                  </div>
                </div>
                <div className="mt-3 text-xs text-slate-500">
                  ระยะเวลาส่งมอบประมาณ <strong>7 วัน</strong>
                </div>
              </div>

              {/* Card 4: Branch Deliveries */}
              <div
                onClick={() => setCurrentTab('BRANCH_DELIVERY')}
                className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs hover:shadow-md transition-all cursor-pointer"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      ใบส่งของประจำสาขา
                    </span>
                    <div className="text-3xl font-extrabold text-indigo-600 mt-1 flex items-baseline gap-2">
                      <span>{branchOrders.length}</span>
                      <span className="text-xs font-normal text-slate-500">ฉบับ</span>
                    </div>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600">
                    <Truck className="w-5 h-5" />
                  </div>
                </div>
                <div className="mt-3 text-xs text-indigo-800 font-semibold flex items-center gap-1">
                  <span>พิมพ์ใบส่งของแบบมาตรฐาน A4 &rarr;</span>
                </div>
              </div>
            </div>

            {/* Smart Reorder Engine Banner */}
            <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 rounded-2xl p-6 text-white shadow-lg relative overflow-hidden">
              <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                <div className="space-y-2 max-w-2xl">
                  <div className="inline-flex items-center gap-2 bg-blue-500/30 text-blue-200 text-xs px-3 py-1 rounded-full font-bold border border-blue-400/30">
                    <ShieldAlert className="w-3.5 h-3.5 text-blue-300" />
                    <span>ระบบเตือนจุดสั่งซื้ออัตโนมัติ (Automated Reorder Point System)</span>
                  </div>
                  <h2 className="text-xl sm:text-2xl font-bold">
                    มีสินค้าสต็อกใกล้หมด {lowStockItems.length} รายการ ที่ต้องสั่งซื้อเติมคลัง
                  </h2>
                  <p className="text-slate-300 text-xs sm:text-sm leading-relaxed">
                    ระบบคำนวณระยะเวลาขนส่ง <strong>7 วัน</strong> พร้อมตรวจเกณฑ์ขั้นต่ำ <strong>5,000 บาท</strong> หากยอดสั่งซื้อไม่ถึง 5,000 บาท ระบบมีฟังก์ชัน <strong>Smart Top-up</strong> ช่วยแนะนำสินค้าหมุนเวียนเร็วเติมให้ครบยอดอัตโนมัติ
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-3 shrink-0">
                  <button
                    onClick={() => setShowAutoReorderModal(true)}
                    className="flex items-center gap-2 bg-blue-500 hover:bg-blue-400 text-slate-950 font-extrabold text-xs sm:text-sm px-5 py-3 rounded-xl shadow-md transition-all cursor-pointer"
                  >
                    <ShoppingBag className="w-4 h-4" />
                    <span>สร้างใบสั่งซื้อ Supplier (PO) ทันที</span>
                  </button>
                  <button
                    onClick={() => setCurrentTab('SHEETS_SYNC')}
                    className="flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white font-medium text-xs sm:text-sm px-4 py-3 rounded-xl border border-white/20 transition-colors cursor-pointer"
                  >
                    <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
                    <span>ซิงค์ลง Google Sheet</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Two Column Layout: Critical Stock Items & Recent Branch Deliveries */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              
              {/* Critical Stock List (7 Cols) */}
              <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200 shadow-xs p-5 sm:p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-slate-900 text-base">
                      รายการที่สต็อกต่ำกว่าเกณฑ์แจ้งเตือน
                    </h3>
                    <span className="bg-rose-100 text-rose-800 text-xs px-2 py-0.5 rounded-full font-bold">
                      {lowStockItems.length}
                    </span>
                  </div>
                  <button
                    onClick={() => setShowAutoReorderModal(true)}
                    className="text-xs text-blue-600 hover:text-blue-800 font-semibold cursor-pointer"
                  >
                    สั่งซื้อทั้งหมด &rarr;
                  </button>
                </div>

                <div className="divide-y divide-slate-100">
                  {lowStockItems.length === 0 ? (
                    <div className="py-10 text-center text-slate-400 text-sm">
                      <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                      ทุกรายการสินค้ามีสต็อกเพียงพอ ปลอดภัยดี
                    </div>
                  ) : (
                    lowStockItems.map((item) => (
                      <div
                        key={item.id}
                        className="py-3 flex flex-wrap items-center justify-between gap-2 hover:bg-slate-50/60 rounded-lg px-2 transition-colors"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="font-semibold text-slate-800 text-sm truncate">
                            {item.name}
                          </div>
                          <div className="text-xs text-slate-500 flex items-center gap-3 mt-0.5">
                            <span className="text-rose-600 font-bold">
                              คงเหลือ: {item.currentStockHQ} {item.unit}
                            </span>
                            <span>&bull;</span>
                            <span>จุดเตือน: {item.minStockThreshold} {item.unit}</span>
                            <span>&bull;</span>
                            <span>แนะนำสั่ง: {item.reorderQuantity} {item.unit}</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-slate-900">
                            {((item.reorderQuantity || 10) * item.unitPrice).toLocaleString()} ฿
                          </span>
                          <button
                            onClick={() => setItemToAdjust(item)}
                            className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 px-2.5 py-1 rounded-lg font-medium transition-colors cursor-pointer"
                            title="ปรับปรุงยอดสต็อก"
                          >
                            ปรับสต็อก
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Recent Branch Deliveries with Instant Print (5 Cols) */}
              <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200 shadow-xs p-5 sm:p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-slate-900 text-base">
                      ใบส่งของสาขา & แบบฟอร์ม
                    </h3>
                    <span className="bg-blue-100 text-blue-800 text-xs px-2 py-0.5 rounded-full font-bold">
                      {branchOrders.length}
                    </span>
                  </div>
                  <button
                    onClick={() => setCurrentTab('BRANCH_DELIVERY')}
                    className="text-xs text-blue-600 hover:text-blue-800 font-semibold cursor-pointer"
                  >
                    ดูทั้งหมด &rarr;
                  </button>
                </div>

                <div className="space-y-3">
                  {branchOrders.slice(0, 3).map((bo) => (
                    <div
                      key={bo.id}
                      className="border border-slate-200 rounded-xl p-3.5 hover:border-blue-400 transition-all bg-slate-50/50 flex flex-col justify-between gap-2"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="font-mono text-xs font-bold text-blue-700">
                            {bo.deliveryOrderNo}
                          </div>
                          <div className="font-bold text-slate-900 text-sm mt-0.5">
                            {bo.branchName}
                          </div>
                          <div className="text-xs text-slate-500 mt-0.5">
                            วันที่: {bo.date} &bull; {bo.items.length} รายการ
                          </div>
                        </div>

                        <span
                          className={`text-[11px] font-bold px-2 py-0.5 rounded ${
                            bo.routingType === 'SUPPLIER_DIRECT'
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {bo.routingType === 'SUPPLIER_DIRECT'
                            ? 'Supplier ส่งตรง'
                            : 'โนวาโซลส่งเอง'}
                        </span>
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t border-slate-200/60 mt-1">
                        <span className="text-xs font-bold text-slate-900">
                          {bo.totalAmount.toLocaleString()} ฿
                        </span>
                        <button
                          onClick={() => setSelectedOrderToPrint(bo)}
                          className="flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
                        >
                          <Printer className="w-3.5 h-3.5" />
                          <span>พิมพ์ใบส่งสินค้า</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="pt-2">
                  <button
                    onClick={() => setShowRequisitionModal(true)}
                    className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>สร้างใบส่งของใหม่ (สาขาอื่น)</span>
                  </button>
                </div>
              </div>

            </div>

            {/* Logistics Routing Logic Explanation Card */}
            <div className="bg-slate-100/80 rounded-2xl p-5 border border-slate-200 text-xs text-slate-700 space-y-2">
              <h4 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <Info className="w-4 h-4 text-blue-600" />
                เงื่อนไขการกระจายสินค้าและการสั่งซื้อของระบบโนวาโซล
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
                <div className="bg-white p-3 rounded-xl border border-slate-200">
                  <strong className="text-slate-900 block mb-1">
                    1. เกณฑ์สั่งขั้นต่ำ Supplier:
                  </strong>
                  คำสั่งซื้อส่งไปยัง Supplier (เช่น บริษัท คงธนา เซอร์วิส จำกัด) ต้องมียอดขั้นต่ำ <strong>5,000 บาท</strong> ขนส่งประมาณ <strong>7 วัน</strong>
                </div>
                <div className="bg-white p-3 rounded-xl border border-slate-200">
                  <strong className="text-amber-800 block mb-1">
                    2. กรณีสาขายอดน้อย (&lt; 5,000 ฿):
                  </strong>
                  ระบบกำหนดให้สั่งมารวมเก็บที่ <strong>สำนักงานใหญ่ โนวาโซล</strong> ก่อน แล้วทีมงานโนวาโซลจะนำส่งให้สาขาเอง
                </div>
                <div className="bg-white p-3 rounded-xl border border-slate-200">
                  <strong className="text-blue-800 block mb-1">
                    3. กรณีสาขายอดถึงเกณฑ์ (&ge; 5,000 ฿):
                  </strong>
                  สามารถสั่งให้ <strong>Supplier ขับไปส่งตรงถึงสาขา</strong> เช่น ศูนย์ฝึกอาชีพจตุจักรอาคาร 5 ชั้น ได้ทันที
                </div>
              </div>
            </div>

          </div>
        )}

        {/* ========================================================= */}
        {/* 2. INVENTORY VIEW */}
        {/* ========================================================= */}
        {currentTab === 'INVENTORY' && (
          <div className="space-y-4">
            {/* Action Bar */}
            <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-3 flex-1 min-w-[280px]">
                {/* Search */}
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  <input
                    type="text"
                    placeholder="ค้นหาชื่อวัสดุ หรือรหัสสินค้า..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl pl-9 pr-4 py-2 text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* Category Filter */}
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs sm:text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="ALL">ทุกหมวดหมู่ ({items.length})</option>
                  <option value="ขยะและถุง">ขยะและถุง</option>
                  <option value="น้ำยาและเคมีภัณฑ์">น้ำยาและเคมีภัณฑ์</option>
                  <option value="อุปกรณ์ทำความสะอาด">อุปกรณ์ทำความสะอาด</option>
                  <option value="กระดาษชำระ">กระดาษชำระ</option>
                  <option value="เครื่องแต่งกายและอื่นๆ">เครื่องแต่งกายและอื่นๆ</option>
                </select>

                {/* Stock status filter */}
                <select
                  value={stockStatusFilter}
                  onChange={(e) => setStockStatusFilter(e.target.value as any)}
                  className="bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs sm:text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="ALL">ทุกสถานะสต็อก</option>
                  <option value="LOW">เฉพาะสต็อกใกล้หมด ({lowStockItems.length})</option>
                  <option value="NORMAL">สต็อกปกติ</option>
                </select>
              </div>

              {/* Add New Item Button */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowAddItemModal(true)}
                  className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-sm font-bold px-4 py-2 rounded-xl transition-colors cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>เพิ่มรายการวัสดุใหม่</span>
                </button>
              </div>
            </div>

            {/* Inventory Table */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                    <tr>
                      <th className="py-3 px-2 w-10 text-center">ลำดับ</th>
                      <th className="py-3 px-2 w-14 text-center">รูปภาพ</th>
                      <th className="py-3 px-3 w-20">รหัส</th>
                      <th className="py-3 px-4">ชื่อวัสดุ / สเปกป้องกันส่งผิด</th>
                      <th className="py-3 px-3">หมวดหมู่</th>
                      <th className="py-3 px-3 text-right">ราคา/หน่วย (แนวโน้ม)</th>
                      <th className="py-3 px-3 text-center">คงเหลือ สนง.ใหญ่</th>
                      <th className="py-3 px-3 text-center">จุดเตือน</th>
                      <th className="py-3 px-3 text-center">สถานะ</th>
                      <th className="py-3 px-3 text-center w-36">จัดการ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredItems.map((item, index) => {
                      const isLow = item.currentStockHQ <= item.minStockThreshold;
                      const stockPercentage = Math.min(
                        100,
                        Math.round((item.currentStockHQ / (item.minStockThreshold * 2)) * 100)
                      );
                      const priceDiff = item.unitPrice - (item.baselinePrice || item.unitPrice);
                      const pricePercent = item.baselinePrice
                        ? Math.round((priceDiff / item.baselinePrice) * 100 * 10) / 10
                        : 0;

                      return (
                        <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                          <td className="py-3 px-2 text-center text-slate-400 font-medium">
                            {index + 1}
                          </td>

                          {/* Image thumbnail */}
                          <td className="py-3 px-2 text-center">
                            <div
                              onClick={() => setSelectedItemForDetail(item)}
                              className="w-11 h-11 rounded-lg overflow-hidden border border-slate-200 bg-white mx-auto flex items-center justify-center cursor-pointer hover:ring-2 hover:ring-blue-400 transition-all shadow-2xs"
                              title="คลิกเพื่อดูรูปใหญ่และแก้ไขสเปก"
                            >
                              {item.imageUrl ? (
                                <img
                                  src={item.imageUrl}
                                  alt={item.name}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <ImageIcon className="w-5 h-5 text-slate-300" />
                              )}
                            </div>
                          </td>

                          <td className="py-3 px-3 font-mono text-slate-500 font-semibold">
                            {item.code}
                          </td>

                          {/* Name & Variant Spec Details */}
                          <td className="py-3 px-4">
                            <div
                              onClick={() => setSelectedItemForDetail(item)}
                              className="font-bold text-slate-900 text-sm hover:text-blue-600 cursor-pointer transition-colors"
                            >
                              {item.name}
                            </div>
                            
                            {/* Variant Specs & Branch Rules */}
                            <div className="flex flex-wrap items-center gap-1.5 mt-1">
                              {item.variantSpec?.color && (
                                <span className="text-[10px] bg-slate-100 text-slate-700 px-1.5 py-0.2 rounded font-medium border border-slate-200">
                                  {item.variantSpec.color}
                                </span>
                              )}
                              {item.variantSpec?.scent && (
                                <span className="text-[10px] bg-indigo-50 text-indigo-700 px-1.5 py-0.2 rounded font-medium border border-indigo-200">
                                  {item.variantSpec.scent}
                                </span>
                              )}
                              {item.variantSpec?.size && (
                                <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.2 rounded font-medium">
                                  {item.variantSpec.size}
                                </span>
                              )}
                              {item.branchSpecificNotes && Object.keys(item.branchSpecificNotes).length > 0 && (
                                <span className="text-[10px] bg-amber-100 text-amber-800 font-bold px-1.5 py-0.2 rounded border border-amber-200 flex items-center gap-1">
                                  <span>มีกฎเฉพาะสาขา</span>
                                </span>
                              )}
                            </div>
                          </td>

                          <td className="py-3 px-3 text-slate-600 font-medium">
                            {item.category}
                          </td>

                          {/* Price & Volatility indicator */}
                          <td className="py-3 px-3 text-right">
                            <div className="font-semibold text-slate-800">
                              {item.unitPrice.toLocaleString()} ฿ / {item.unit}
                            </div>
                            {priceDiff > 0 && (
                              <span className="text-[10px] text-rose-600 font-bold flex items-center justify-end gap-0.5">
                                <TrendingUp className="w-3 h-3" /> +{pricePercent}%
                              </span>
                            )}
                            {priceDiff < 0 && (
                              <span className="text-[10px] text-emerald-600 font-bold flex items-center justify-end gap-0.5">
                                <TrendingDown className="w-3 h-3" /> {pricePercent}%
                              </span>
                            )}
                          </td>

                          <td className="py-3 px-3 text-center">
                            <div className="font-extrabold text-sm text-slate-900">
                              {item.currentStockHQ} {item.unit}
                            </div>
                            {/* Stock level bar */}
                            <div className="w-16 bg-slate-200 h-1.5 rounded-full mx-auto mt-1 overflow-hidden">
                              <div
                                className={`h-full rounded-full ${
                                  isLow ? 'bg-rose-500' : 'bg-emerald-500'
                                }`}
                                style={{ width: `${Math.max(10, stockPercentage)}%` }}
                              />
                            </div>
                          </td>

                          <td className="py-3 px-3 text-center text-slate-500 font-medium">
                            {item.minStockThreshold} {item.unit}
                          </td>

                          <td className="py-3 px-3 text-center">
                            {isLow ? (
                              <span className="inline-flex items-center gap-1 bg-rose-100 text-rose-800 text-[11px] font-bold px-2 py-0.5 rounded-full">
                                <AlertTriangle className="w-3 h-3 text-rose-600" />
                                ใกล้หมด
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 bg-emerald-100 text-emerald-800 text-[11px] font-bold px-2 py-0.5 rounded-full">
                                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                สต็อกปกติ
                              </span>
                            )}
                          </td>

                          {/* Action Buttons */}
                          <td className="py-3 px-3 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                onClick={() => setSelectedItemForDetail(item)}
                                className="bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-semibold px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer"
                                title="ดูรูปภาพ สเปกสินค้า และประวัติราคาขึ้นลง"
                              >
                                รายละเอียด
                              </button>
                              <button
                                onClick={() => setItemToAdjust(item)}
                                className="bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold px-2 py-1.5 rounded-lg transition-colors cursor-pointer"
                                title="ปรับยอดสต็อกเข้า-ออก"
                              >
                                ปรับยอด
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile Responsive Cards View */}
              <div className="md:hidden divide-y divide-slate-100 bg-white">
                {filteredItems.map((item) => {
                  const isLow = item.currentStockHQ <= item.minStockThreshold;
                  const priceDiff = item.unitPrice - (item.baselinePrice || item.unitPrice);
                  const pricePercent = item.baselinePrice
                    ? Math.round((priceDiff / item.baselinePrice) * 100 * 10) / 10
                    : 0;

                  return (
                    <div key={item.id} className="p-3.5 space-y-2.5">
                      <div className="flex items-start gap-3">
                        <div
                          onClick={() => setSelectedItemForDetail(item)}
                          className="w-14 h-14 rounded-xl overflow-hidden border border-slate-200 bg-slate-50 shrink-0 flex items-center justify-center cursor-pointer shadow-2xs"
                        >
                          {item.imageUrl ? (
                            <img
                              src={item.imageUrl}
                              alt={item.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <ImageIcon className="w-6 h-6 text-slate-300" />
                          )}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-1.5">
                            <span className="font-mono text-[11px] text-slate-400 font-semibold">
                              {item.code}
                            </span>
                            {isLow ? (
                              <span className="inline-flex items-center gap-1 bg-rose-100 text-rose-800 text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0">
                                <AlertTriangle className="w-2.5 h-2.5 text-rose-600" />
                                สต็อกใกล้หมด
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0">
                                <CheckCircle2 className="w-2.5 h-2.5 text-emerald-600" />
                                สต็อกปกติ
                              </span>
                            )}
                          </div>

                          <div
                            onClick={() => setSelectedItemForDetail(item)}
                            className="font-bold text-slate-900 text-xs sm:text-sm line-clamp-2 mt-0.5 cursor-pointer hover:text-blue-600"
                          >
                            {item.name}
                          </div>

                          <div className="flex flex-wrap gap-1 mt-1">
                            {item.variantSpec?.color && (
                              <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.2 rounded font-medium">
                                {item.variantSpec.color}
                              </span>
                            )}
                            {item.variantSpec?.scent && (
                              <span className="text-[10px] bg-indigo-50 text-indigo-700 px-1.5 py-0.2 rounded font-medium">
                                {item.variantSpec.scent}
                              </span>
                            )}
                            {item.variantSpec?.size && (
                              <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.2 rounded font-medium">
                                {item.variantSpec.size}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Stock & Price Row */}
                      <div className="flex items-center justify-between bg-slate-50 p-2.5 rounded-xl text-xs border border-slate-100">
                        <div>
                          <span className="text-slate-500 text-[11px] block">คงเหลือ สนง.ใหญ่:</span>
                          <span className="font-extrabold text-sm text-slate-900">
                            {item.currentStockHQ} {item.unit}
                          </span>
                          <span className="text-[10px] text-slate-400 ml-1">
                            (จุดเตือน: {item.minStockThreshold})
                          </span>
                        </div>

                        <div className="text-right">
                          <span className="text-slate-500 text-[11px] block">ราคาต่อหน่วย:</span>
                          <span className="font-bold text-slate-800">
                            {item.unitPrice.toLocaleString()} ฿
                          </span>
                          {priceDiff > 0 && (
                            <span className="text-[10px] text-rose-600 font-bold block">
                              +{pricePercent}% จากราคาฐาน
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Mobile Actions */}
                      <div className="grid grid-cols-2 gap-2 pt-0.5">
                        <button
                          onClick={() => setSelectedItemForDetail(item)}
                          className="w-full py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-bold rounded-xl transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                        >
                          <ImageIcon className="w-3.5 h-3.5" />
                          <span>ดูรูป & สเปก</span>
                        </button>
                        <button
                          onClick={() => setItemToAdjust(item)}
                          className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-xl transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                        >
                          <RefreshCw className="w-3.5 h-3.5" />
                          <span>ปรับยอดสต็อก</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* 3. BRANCH DELIVERY & PRINT VIEW */}
        {/* ========================================================= */}
        {currentTab === 'BRANCH_DELIVERY' && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-slate-900">
                  การกระจายส่งสินค้าสาขา & พิมพ์ใบส่งสินค้า
                </h2>
                <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                  ระบบคัดแยกเส้นทางอัตโนมัติตามเกณฑ์ 5,000 บาท พร้อมพิมพ์ใบส่งของตามแบบฟอร์มโนวาโซล (A4)
                </p>
              </div>

              <div className="flex items-center gap-2.5">
                <button
                  onClick={() => setCurrentTab('BRANCH_MANAGEMENT')}
                  className="flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs sm:text-sm font-bold px-3.5 py-2.5 rounded-xl border border-slate-200 transition-colors cursor-pointer"
                >
                  <Building2 className="w-4 h-4 text-blue-600" />
                  <span>จัดการสาขา ({branches.length})</span>
                </button>

                <button
                  onClick={() => setShowRequisitionModal(true)}
                  className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-sm font-bold px-4 py-2.5 rounded-xl shadow-sm transition-all cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>สร้างใบส่งของสาขาใหม่</span>
                </button>
              </div>
            </div>

            {/* List of Orders */}
            <div className="space-y-4">
              {branchOrders.map((order) => {
                const isDirect = order.routingType === 'SUPPLIER_DIRECT';

                return (
                  <div
                    key={order.id}
                    className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 sm:p-6 space-y-4 hover:border-slate-300 transition-all"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-extrabold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                            {order.deliveryOrderNo}
                          </span>
                          <span className="text-xs text-slate-500">
                            วันที่: {order.date}
                          </span>
                          <span
                            className={`text-xs px-2.5 py-0.5 rounded-full font-bold ${
                              order.status === 'DELIVERED'
                                ? 'bg-emerald-100 text-emerald-800'
                                : order.status === 'IN_TRANSIT'
                                ? 'bg-blue-100 text-blue-800'
                                : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            สถานะ: {order.status === 'DELIVERED' ? 'จัดส่งเรียบร้อย' : order.status === 'IN_TRANSIT' ? 'กำลังจัดส่ง' : 'กำลังเตรียมของ'}
                          </span>
                          {(order.receiverSignatureUrl || order.senderSignatureUrl) && (
                            <span className="text-[11px] bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full font-bold border border-blue-200 flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3 text-blue-600" />
                              <span>มีลายเซ็นแล้ว</span>
                            </span>
                          )}
                        </div>

                        <h3 className="text-base sm:text-lg font-bold text-slate-900 mt-1 flex items-center gap-2">
                          <MapPin className="w-4 h-4 text-rose-500" />
                          <span>{order.branchName}</span>
                        </h3>
                        <div className="text-xs text-slate-500">
                          ผู้รับสินค้า: {order.receiverName || 'ตัวแทนประจำสาขา'} &bull; ผู้ส่ง: {order.senderName || 'ทีมจัดส่ง โนวาโซล'}
                        </div>
                      </div>

                      {/* Routing Badge & Actions */}
                      <div className="flex flex-col sm:items-end gap-2">
                        <div
                          className={`text-xs px-3 py-1.5 rounded-xl font-bold flex items-center gap-1.5 border ${
                            isDirect
                              ? 'bg-blue-50 text-blue-900 border-blue-200'
                              : 'bg-amber-50 text-amber-900 border-amber-200'
                          }`}
                        >
                          {isDirect ? (
                            <>
                              <Truck className="w-4 h-4 text-blue-600" />
                              <span>Supplier ส่งตรงถึงสาขา (ยอด &ge; 5,000 ฿)</span>
                            </>
                          ) : (
                            <>
                              <Building className="w-4 h-4 text-amber-600" />
                              <span>รวมส่งที่ สนง.ใหญ่ (โนวาโซลนำส่งเอง)</span>
                            </>
                          )}
                        </div>

                        <div className="flex items-center gap-2 mt-1">
                          <button
                            onClick={() => setSelectedOrderToPrint(order)}
                            className="flex items-center gap-1.5 bg-[#06C755] hover:bg-[#05b34c] text-white text-xs font-bold px-3 py-2 rounded-xl transition-colors cursor-pointer shadow-xs"
                            title="แชร์เป็นรูปภาพหรือ PDF ส่งเข้า LINE ทันที (ไม่ส่งข้อความ)"
                          >
                            <Share2 className="w-3.5 h-3.5" />
                            <span>แชร์ LINE (รูป/PDF)</span>
                          </button>

                          <button
                            onClick={() => setOrderToEdit(order)}
                            className="flex items-center gap-1.5 bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold px-3 py-2 rounded-xl transition-colors cursor-pointer shadow-xs"
                            title="แก้ไขรายการ จำนวน ราคา หมายเหตุ ของใบส่งสินค้านี้"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                            <span>แก้ไข</span>
                          </button>

                          <button
                            onClick={() => setSelectedOrderToPrint(order)}
                            className="flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold px-3.5 py-2 rounded-xl transition-colors cursor-pointer shadow-xs"
                          >
                            <Printer className="w-3.5 h-3.5" />
                            <span>ดู & พิมพ์ใบส่งของ / เซ็นชื่อ</span>
                          </button>

                          {order.status !== 'DELIVERED' && (
                            <button
                              onClick={() => updateBranchOrderStatus(order.id, 'DELIVERED')}
                              className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-3 py-2 rounded-xl transition-colors cursor-pointer"
                              title="ยืนยันว่าส่งมอบถึงสาขาเรียบร้อย (ลงรายการรับเข้า/จ่ายออกในบัญชีสต็อก)"
                            >
                              ยืนยันการจัดส่งแล้ว
                            </button>
                          )}

                          {order.status === 'DELIVERED' && (
                            <span
                              className="text-xs font-bold px-3 py-2 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200"
                              title="ยืนยันส่งแล้ว และลงบัญชีสต็อกแล้ว"
                            >
                              ✓ ยืนยันส่งแล้ว
                            </span>
                          )}

                          {order.status === 'DELIVERED' && (
                            <button
                              onClick={() => {
                                if (
                                  window.confirm(
                                    `ยกเลิกการยืนยันส่งใบ ${order.deliveryOrderNo}?\nระบบจะย้อนรายการรับเข้า/จ่ายออกในสต็อก และเปลี่ยนสถานะกลับเป็น "กำลังจัดส่ง"`
                                  )
                                )
                                  updateBranchOrderStatus(order.id, 'IN_TRANSIT');
                              }}
                              className="text-xs font-bold px-3 py-2 rounded-xl bg-white text-slate-700 border border-slate-300 hover:bg-slate-50 cursor-pointer"
                              title="ยกเลิกการยืนยันส่ง และคืนรายการสต็อก"
                            >
                              ยกเลิกการยืนยัน
                            </button>
                          )}

                          <button
                            onClick={() => {
                              if (order.paymentStatus === 'PAID') {
                                if (window.confirm('ยกเลิกสถานะ "จ่ายเงินแล้ว" ของใบนี้?')) markOrderPayment(order.id, false);
                              } else {
                                const ref = window.prompt('บันทึกการจ่ายเงิน — เลขที่อ้างอิง/ใบเสร็จ/โอน (ไม่บังคับ)', '');
                                if (ref !== null) markOrderPayment(order.id, true, ref.trim());
                              }
                            }}
                            className={`text-xs font-bold px-3 py-2 rounded-xl transition-colors cursor-pointer border ${
                              order.paymentStatus === 'PAID'
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                                : 'bg-white text-rose-700 border-rose-300 hover:bg-rose-50'
                            }`}
                            title="บันทึกการจ่ายเงินค่าสินค้าของใบนี้เพื่อควบคุมงบประมาณ"
                          >
                            {order.paymentStatus === 'PAID'
                              ? `จ่ายเงินแล้ว${order.paidAt ? ' ' + order.paidAt : ''}${order.paymentRef ? ' (' + order.paymentRef + ')' : ''}`
                              : 'ยังไม่จ่ายเงิน · บันทึกการจ่าย'}
                          </button>

                          <button
                            onClick={() => setOrderToDelete(order)}
                            className="p-2 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-xl border border-rose-200 transition-colors cursor-pointer"
                            title="ลบใบส่งสินค้านี้หากมีการเปลี่ยนแปลง (คืนสต็อกเข้าคลังอัตโนมัติ)"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Order Items Preview Table */}
                    <div className="border border-slate-200 rounded-xl overflow-hidden text-xs">
                      <table className="w-full text-left">
                        <thead className="bg-slate-100 text-slate-600 font-bold border-b border-slate-200">
                          <tr>
                            <th className="py-1.5 px-3 w-10 text-center">ที่</th>
                            <th className="py-1.5 px-3">รายการ</th>
                            <th className="py-1.5 px-3 text-center w-24">จำนวน</th>
                            <th className="py-1.5 px-3 text-center w-24">หน่วย</th>
                            <th className="py-1.5 px-3 text-right w-28">ราคา/หน่วย</th>
                            <th className="py-1.5 px-3 text-right w-28">รวม (บาท)</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {order.items.slice(0, 5).map((it, idx) => (
                            <tr key={idx} className="hover:bg-slate-50">
                              <td className="py-1.5 px-3 text-center text-slate-400">
                                {idx + 1}
                              </td>
                              <td className="py-1.5 px-3 font-medium text-slate-800">
                                {it.itemName}
                              </td>
                              <td className="py-1.5 px-3 text-center font-bold">
                                {it.quantity}
                              </td>
                              <td className="py-1.5 px-3 text-center text-slate-600">
                                {it.unit}
                              </td>
                              <td className="py-1.5 px-3 text-right text-slate-600">
                                {it.unitPrice.toLocaleString()} ฿
                              </td>
                              <td className="py-1.5 px-3 text-right font-bold text-slate-900">
                                {(it.quantity * it.unitPrice).toLocaleString()} ฿
                              </td>
                            </tr>
                          ))}
                          {order.items.length > 5 && (
                            <tr>
                              <td colSpan={6} className="py-1 px-3 text-center text-slate-400 bg-slate-50 italic">
                                ... และรายการอื่นๆ อีก {order.items.length - 5} รายการ (เปิดดูในใบส่งของ)
                              </td>
                            </tr>
                          )}
                        </tbody>
                        <tfoot className="bg-slate-50 border-t border-slate-200">
                          <tr>
                            <td colSpan={5} className="py-2 px-3 text-right font-bold text-slate-700">
                              มูลค่าคำสั่งซื้อรวม:
                            </td>
                            <td className="py-2 px-3 text-right font-extrabold text-blue-900">
                              {order.totalAmount.toLocaleString()} ฿
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* 3.5 MONTHLY DEMAND PLANNING & QUOTA (SMART PROCUREMENT) */}
        {/* ========================================================= */}
        {currentTab === 'DEMAND_PLANNING' && (
          <BranchDemandPlanningTab
            onOpenRequisitionWithItem={() => setShowRequisitionModal(true)}
            onOpenAutoReorder={() => setShowAutoReorderModal(true)}
          />
        )}

        {/* ========================================================= */}
        {/* 3.8 BRANCH MANAGEMENT VIEW */}
        {/* ========================================================= */}
        {currentTab === 'BRANCH_MANAGEMENT' && (
          <BranchManagementTab
            onNavigateToDeliveries={() => {
              setCurrentTab('BRANCH_DELIVERY');
            }}
            onNavigateToDemand={() => {
              setCurrentTab('DEMAND_PLANNING');
            }}
            onRequestRequisitionForBranch={() => {
              setShowRequisitionModal(true);
            }}
          />
        )}

        {currentTab === 'SUPPLIERS' && <SupplierManagementTab />}
        {currentTab === 'BUDGET' && <BudgetReportTab />}

        {/* ========================================================= */}
        {/* 4. SUPPLIER PURCHASE ORDERS (PO) VIEW */}
        {/* ========================================================= */}
        {currentTab === 'PURCHASE_ORDERS' && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-slate-900">
                  คำสั่งซื้อ Supplier (PO) & ติดตามการจัดส่ง 7 วัน
                </h2>
                <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                  สั่งซื้อของเพิ่มผ่านระบบออนไลน์ &bull; ผู้จัดจำหน่าย: บริษัท คงธนา เซอร์วิส จำกัด &bull; ขั้นต่ำ 5,000 บาท
                </p>
              </div>

              <button
                onClick={() => setShowAutoReorderModal(true)}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-sm font-bold px-4 py-2.5 rounded-xl shadow-sm transition-all cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>สร้างคำสั่งซื้อ Supplier PO ใหม่</span>
              </button>
            </div>

            <div className="space-y-4">
              {purchaseOrders.map((po) => {
                const daysRemaining = 7;

                return (
                  <div
                    key={po.id}
                    className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 sm:p-6 space-y-4"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold text-slate-800 bg-slate-100 px-2.5 py-0.5 rounded border border-slate-300">
                            {po.poNumber}
                          </span>
                          <span className="text-xs text-slate-500">
                            วันที่สั่ง: {po.orderDate}
                          </span>
                          <span
                            className={`text-xs px-2.5 py-0.5 rounded-full font-bold ${
                              po.status === 'RECEIVED'
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-blue-100 text-blue-800'
                            }`}
                          >
                            {po.status === 'RECEIVED'
                              ? 'รับเข้าคลังเรียบร้อย'
                              : 'กำลังจัดส่ง (ระยะเวลา 7 วัน)'}
                          </span>
                        </div>

                        <h3 className="text-base font-bold text-slate-900 mt-1">
                          {po.supplierName}
                        </h3>
                        <div className="text-xs text-slate-500 mt-0.5">
                          ปลายทางส่งมอบ:{' '}
                          <strong className="text-slate-800">
                            {po.destination === 'DIRECT_BRANCH'
                              ? `ส่งตรงถึงสาขา: ${po.targetBranchName}`
                              : 'คลังสินค้า สนง.ใหญ่ โนวาโซล'}
                          </strong>
                        </div>
                      </div>

                      <div className="flex flex-col sm:items-end gap-2">
                        <div className="text-right">
                          <span className="text-xs text-slate-500">ยอดสั่งซื้อรวม</span>
                          <div className="text-lg font-extrabold text-blue-900">
                            {po.totalAmount.toLocaleString()} ฿
                          </div>
                          <span className="text-[11px] text-emerald-600 font-semibold">
                            (ผ่านเกณฑ์ขั้นต่ำ 5,000 บาท)
                          </span>
                        </div>

                        {po.status !== 'RECEIVED' && (
                          <button
                            onClick={() => updatePOStatus(po.id, 'RECEIVED')}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-3.5 py-2 rounded-xl transition-colors cursor-pointer flex items-center gap-1.5 shadow-xs"
                          >
                            <PackageCheck className="w-4 h-4" />
                            <span>ตรวจรับสินค้าเข้าสต็อก สนง.ใหญ่</span>
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Timeline Tracker */}
                    <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-xs flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2 text-slate-700">
                        <Clock className="w-4 h-4 text-blue-600" />
                        <span>
                          กำหนดได้รับสินค้า:{' '}
                          <strong className="text-slate-900 font-bold">
                            {po.expectedDeliveryDate}
                          </strong>{' '}
                          (รอบขนส่งมาตรฐาน 7 วัน)
                        </span>
                      </div>
                      <span className="text-slate-500 text-[11px]">
                        สั่งผ่านระบบออนไลน์
                      </span>
                    </div>

                    {/* Items table */}
                    <div className="border border-slate-200 rounded-xl overflow-hidden text-xs">
                      <table className="w-full text-left">
                        <thead className="bg-slate-100 text-slate-600 font-bold border-b border-slate-200">
                          <tr>
                            <th className="py-1.5 px-3 w-10 text-center">ที่</th>
                            <th className="py-1.5 px-3">รายการ</th>
                            <th className="py-1.5 px-3 text-center w-24">จำนวน</th>
                            <th className="py-1.5 px-3 text-center w-20">หน่วย</th>
                            <th className="py-1.5 px-3 text-right w-24">ราคา/หน่วย</th>
                            <th className="py-1.5 px-3 text-right w-28">รวม (บาท)</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {po.items.map((it, idx) => (
                            <tr key={idx} className="hover:bg-slate-50">
                              <td className="py-1.5 px-3 text-center text-slate-400">
                                {idx + 1}
                              </td>
                              <td className="py-1.5 px-3 font-medium text-slate-800">
                                {it.itemName}
                              </td>
                              <td className="py-1.5 px-3 text-center font-bold">
                                {it.quantity}
                              </td>
                              <td className="py-1.5 px-3 text-center text-slate-600">
                                {it.unit}
                              </td>
                              <td className="py-1.5 px-3 text-right text-slate-600">
                                {it.unitPrice.toLocaleString()} ฿
                              </td>
                              <td className="py-1.5 px-3 text-right font-bold text-slate-900">
                                {(it.quantity * it.unitPrice).toLocaleString()} ฿
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* 5. GOOGLE SHEETS & EXCEL EXPORT VIEW */}
        {/* ========================================================= */}
        {currentTab === 'SHEETS_SYNC' && (
          <div className="space-y-6">
            <GoogleSheetsExporter onOpenGasModal={() => setShowGasModal(true)} />
          </div>
        )}

      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-6 text-center text-xs text-slate-500 no-print">
        <div className="max-w-7xl mx-auto px-4 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <NovasolLogo size={24} />
            <span className="font-semibold text-slate-700">{COMPANY_INFO.name}</span>
            <span>&bull; {COMPANY_INFO.phone}</span>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                if (
                  window.confirm(
                    'รีเซ็ตข้อมูลทั้งหมดกลับเป็นข้อมูลตัวอย่าง?\nข้อมูลปัจจุบันใน Google Sheet จะถูกเขียนทับ และกู้คืนไม่ได้'
                  )
                ) {
                  resetToDefaultData().catch((err: Error) => alert(`รีเซ็ตไม่สำเร็จ: ${err.message}`));
                }
              }}
              className="text-slate-400 hover:text-rose-600 transition-colors flex items-center gap-1"
              title="รีเซ็ตเป็นข้อมูลตัวอย่างเริ่มต้นตามเอกสาร"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>รีเซ็ตข้อมูลเริ่มต้น</span>
            </button>
          </div>
        </div>
      </footer>

      {/* ========================================================= */}
      {/* MODALS */}
      {/* ========================================================= */}

      {/* 1. Printable Delivery Slip Modal (matches exact uploaded PDF sample) */}
      {orderToEdit && (
        <OrderEditModal order={orderToEdit} onClose={() => setOrderToEdit(null)} />
      )}

      {selectedOrderToPrint && (
        <DeliveryNotePrint
          order={selectedOrderToPrint}
          onClose={() => setSelectedOrderToPrint(null)}
        />
      )}

      {/* 2. Auto-Reorder PO Generator Modal */}
      {showAutoReorderModal && (
        <AutoReorderModal
          onClose={() => setShowAutoReorderModal(false)}
          onSuccessPoCreated={(poNum) => {
            setCurrentTab('PURCHASE_ORDERS');
          }}
        />
      )}

      {/* 3. Branch Requisition & Dispatch Modal */}
      {showRequisitionModal && (
        <BranchRequisitionModal
          onClose={() => setShowRequisitionModal(false)}
          onSuccessCreated={(newOrder) => {
            setSelectedOrderToPrint(newOrder);
          }}
        />
      )}

      {/* 4. Stock Adjustment Modal */}
      {itemToAdjust && (
        <StockAdjustmentModal
          item={itemToAdjust}
          onClose={() => setItemToAdjust(null)}
        />
      )}

      {/* 5. Add New Material Modal */}
      {showAddItemModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex justify-center items-center p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="bg-slate-900 text-white p-5 flex items-start justify-between">
              <div>
                <h3 className="font-bold text-base">เพิ่มรายการวัสดุ/อุปกรณ์ใหม่</h3>
                <p className="text-xs text-slate-300 mt-0.5">บันทึกเข้าแคตตาล็อกคลังสินค้า โนวาโซล</p>
              </div>
              <button onClick={() => setShowAddItemModal(false)} className="text-slate-400 hover:text-white">
                &times;
              </button>
            </div>

            <form onSubmit={handleAddNewItem} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  ชื่อวัสดุ/อุปกรณ์ *
                </label>
                <input
                  type="text"
                  required
                  placeholder="เช่น ผลิตภัณฑ์ดันฝุ่น K-SAVE (3.8 L)"
                  value={newItemName}
                  onChange={(e) => setNewItemName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    รหัสสินค้า
                  </label>
                  <input
                    type="text"
                    placeholder="MAT-019"
                    value={newItemCode}
                    onChange={(e) => setNewItemCode(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    หมวดหมู่
                  </label>
                  <select
                    value={newItemCategory}
                    onChange={(e) => setNewItemCategory(e.target.value as any)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 focus:outline-none"
                  >
                    <option value="ขยะและถุง">ขยะและถุง</option>
                    <option value="น้ำยาและเคมีภัณฑ์">น้ำยาและเคมีภัณฑ์</option>
                    <option value="อุปกรณ์ทำความสะอาด">อุปกรณ์ทำความสะอาด</option>
                    <option value="กระดาษชำระ">กระดาษชำระ</option>
                    <option value="เครื่องแต่งกายและอื่นๆ">เครื่องแต่งกายและอื่นๆ</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    หน่วยนับ
                  </label>
                  <input
                    type="text"
                    placeholder="แกลลอน, กก., ด้าม, ลัง"
                    value={newItemUnit}
                    onChange={(e) => setNewItemUnit(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-1.5 text-xs text-slate-900 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Supplier ผู้จัดจำหน่าย
                  </label>
                  <select
                    value={newItemSupplierId}
                    onChange={(e) => setNewItemSupplierId(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-1.5 text-xs text-slate-900 focus:outline-none"
                  >
                    <option value="">{suppliers[0] ? `ค่าเริ่มต้น: ${suppliers[0].name}` : '— ยังไม่มี Supplier —'}</option>
                    {suppliers.map((sp) => (
                      <option key={sp.id} value={sp.id}>{sp.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    ราคาต่อหน่วย (บาท)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={newItemPrice}
                    onChange={(e) => setNewItemPrice(Number(e.target.value))}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-1.5 text-xs text-slate-900 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    จำนวนคงเหลือเริ่มต้น
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={newItemStock}
                    onChange={(e) => setNewItemStock(Number(e.target.value))}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-1.5 text-xs text-slate-900 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    จุดเตือนสั่งซื้อ (Safety Stock)
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={newItemMinThreshold}
                    onChange={(e) => setNewItemMinThreshold(Number(e.target.value))}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-1.5 text-xs text-slate-900 focus:outline-none"
                  />
                </div>
              </div>

              {/* Product Image Attachment */}
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-2">
                <label className="block text-xs font-bold text-slate-800">
                  รูปภาพสินค้า (เลือกจากเครื่อง หรือ วางลิงก์ Drive แปลง lh3)
                </label>
                <div className="flex gap-2 items-center">
                  <label className="bg-white hover:bg-slate-100 border border-slate-300 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-700 cursor-pointer flex items-center gap-1.5 shrink-0 shadow-2xs">
                    <FolderOpen className="w-3.5 h-3.5 text-blue-600" />
                    <span>{isUploadingNewImage ? 'กำลังโหลด...' : 'เลือกรูปจากเครื่อง'}</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          try {
                            setIsUploadingNewImage(true);
                            const url = await processLocalImageFile(file, 640, 640);
                            setNewItemImage(url);
                          } catch (err: any) {
                            alert(err?.message || 'ไม่สามารถโหลดรูปได้');
                          } finally {
                            setIsUploadingNewImage(false);
                          }
                        }
                      }}
                    />
                  </label>
                  <input
                    type="text"
                    placeholder="หรือวางลิงก์ Google Drive / lh3 / URL รูปภาพ"
                    value={newItemImage}
                    onChange={(e) => setNewItemImage(convertToLh3Url(e.target.value))}
                    className="flex-1 bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs text-slate-900 focus:outline-none"
                  />
                  {newItemImage && (
                    <div className="w-8 h-8 rounded-lg overflow-hidden border border-slate-300 shrink-0">
                      <img src={newItemImage} alt="Preview" className="w-full h-full object-cover" />
                    </div>
                  )}
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddItemModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-4 py-2 rounded-xl transition-colors"
                >
                  บันทึกรายการ
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 6. Google Apps Script Modal */}
      {showGasModal && (
        <GoogleAppsScriptModal onClose={() => setShowGasModal(false)} />
      )}

      {/* 7. Product Detail, Photos & Price History Modal */}
      {selectedItemForDetail && (
        <ItemDetailModal
          item={selectedItemForDetail}
          onClose={() => setSelectedItemForDetail(null)}
        />
      )}

      {/* 8. Share Link for Employees Modal */}
      {showShareModal && (
        <ShareLinkModal onClose={() => setShowShareModal(false)} />
      )}

      {/* 9. Realtime Google Sheet Sync Modal */}
      {showRealtimeSyncModal && (
        <RealtimeSyncModal
          onClose={() => setShowRealtimeSyncModal(false)}
          onOpenGasModal={() => {
            setShowRealtimeSyncModal(false);
            setShowGasModal(true);
          }}
        />
      )}

    </div>
  );
};

export default function App() {
  return (
    <InventoryProvider>
      <MainApp />
    </InventoryProvider>
  );
}
