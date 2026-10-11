import React, { useState, useMemo } from 'react';
import { useInventory } from '../context/InventoryContext';
import { Branch } from '../types/inventory';
import {
  Building2,
  Plus,
  Search,
  Edit2,
  Trash2,
  MapPin,
  Phone,
  User,
  Package,
  Truck,
  CheckCircle2,
  AlertTriangle,
  X,
  ExternalLink,
  Cloud,
  Layers,
  ArrowRight,
  ShieldAlert,
  LogIn,
  RefreshCw,
  FolderOpen,
} from 'lucide-react';

interface BranchManagementTabProps {
  onNavigateToDeliveries?: (branchId: string) => void;
  onNavigateToDemand?: (branchId: string) => void;
  onRequestRequisitionForBranch?: (branchId: string) => void;
}

export const BranchManagementTab: React.FC<BranchManagementTabProps> = ({
  onNavigateToDeliveries,
  onNavigateToDemand,
  onRequestRequisitionForBranch,
}) => {
  const {
    branches,
    branchOrders,
    branchDemands,
    addBranch,
    updateBranch,
    deleteBranch,
    isCloudLoading,
    sheetsSync,
  } = useInventory();

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');

  // Modals state
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingBranch, setEditingBranch] = useState<Branch | null>(null);
  const [branchToDelete, setBranchToDelete] = useState<Branch | null>(null);

  // Form states for Add / Edit
  const [formData, setFormData] = useState<{
    code: string;
    name: string;
    address: string;
    contactPerson: string;
    phone: string;
    defaultRecipientName: string;
  }>({
    code: '',
    name: '',
    address: '',
    contactPerson: '',
    phone: '',
    defaultRecipientName: '',
  });

  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Pre-generate next suggested branch code
  const suggestNextCode = () => {
    const existingNums = branches
      .map((b) => {
        const match = b.code.match(/BR-(\d+)/);
        return match ? parseInt(match[1], 10) : 0;
      })
      .filter((n) => n > 0);
    const maxNum = existingNums.length > 0 ? Math.max(...existingNums) : branches.length;
    return `BR-${String(maxNum + 1).padStart(2, '0')}`;
  };

  const handleOpenAddModal = () => {
    setFormData({
      code: suggestNextCode(),
      name: '',
      address: '',
      contactPerson: '',
      phone: '',
      defaultRecipientName: '',
    });
    setFormError(null);
    setShowAddModal(true);
  };

  const handleOpenEditModal = (branch: Branch) => {
    setEditingBranch(branch);
    setFormData({
      code: branch.code,
      name: branch.name,
      address: branch.address || '',
      contactPerson: branch.contactPerson || '',
      phone: branch.phone || '',
      defaultRecipientName: branch.defaultRecipientName || '',
    });
    setFormError(null);
  };

  const handleSaveAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      setFormError('กรุณาระบุชื่อสาขา');
      return;
    }
    if (!formData.code.trim()) {
      setFormError('กรุณาระบุรหัสสาขา');
      return;
    }

    // Check duplicate code
    const isDuplicate = branches.some(
      (b) => b.code.trim().toUpperCase() === formData.code.trim().toUpperCase()
    );
    if (isDuplicate) {
      setFormError(`รหัสสาขา ${formData.code} มีอยู่ในระบบแล้ว กรุณาใช้รหัสอื่น`);
      return;
    }

    setIsSubmitting(true);
    try {
      await addBranch({
        code: formData.code.trim().toUpperCase(),
        name: formData.name.trim(),
        address: formData.address.trim(),
        contactPerson: formData.contactPerson.trim(),
        phone: formData.phone.trim(),
        defaultRecipientName: formData.defaultRecipientName.trim() || formData.contactPerson.trim(),
      });
      setShowAddModal(false);
      showToast(`เพิ่มสาขา "${formData.name.trim()}" สำเร็จและบันทึกลง Google Sheet เรียบร้อย`);
    } catch (err: any) {
      setFormError(err.message || 'เกิดข้อผิดพลาดในการบันทึก');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingBranch) return;

    if (!formData.name.trim()) {
      setFormError('กรุณาระบุชื่อสาขา');
      return;
    }
    if (!formData.code.trim()) {
      setFormError('กรุณาระบุรหัสสาขา');
      return;
    }

    // Check duplicate code with other branches
    const isDuplicate = branches.some(
      (b) =>
        b.id !== editingBranch.id &&
        b.code.trim().toUpperCase() === formData.code.trim().toUpperCase()
    );
    if (isDuplicate) {
      setFormError(`รหัสสาขา ${formData.code} ซ้ำกับสาขาอื่นในระบบ`);
      return;
    }

    setIsSubmitting(true);
    try {
      await updateBranch({
        ...editingBranch,
        code: formData.code.trim().toUpperCase(),
        name: formData.name.trim(),
        address: formData.address.trim(),
        contactPerson: formData.contactPerson.trim(),
        phone: formData.phone.trim(),
        defaultRecipientName: formData.defaultRecipientName.trim() || formData.contactPerson.trim(),
      });
      setEditingBranch(null);
      showToast(`อัปเดต/เปลี่ยนชื่อสาขา "${formData.name.trim()}" สำเร็จแล้ว`);
    } catch (err: any) {
      setFormError(err.message || 'เกิดข้อผิดพลาดในการอัปเดต');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!branchToDelete) return;

    setIsSubmitting(true);
    try {
      const name = branchToDelete.name;
      await deleteBranch(branchToDelete.id);
      setBranchToDelete(null);
      showToast(`ลบสาขา "${name}" ออกจากระบบและ Google Sheet เรียบร้อย`);
    } catch (err: any) {
      alert(`ไม่สามารถลบสาขาได้: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Filter branches by search query
  const filteredBranches = useMemo(() => {
    if (!searchQuery.trim()) return branches;
    const q = searchQuery.toLowerCase();
    return branches.filter(
      (b) =>
        b.name.toLowerCase().includes(q) ||
        b.code.toLowerCase().includes(q) ||
        (b.contactPerson && b.contactPerson.toLowerCase().includes(q)) ||
        (b.phone && b.phone.toLowerCase().includes(q)) ||
        (b.address && b.address.toLowerCase().includes(q))
    );
  }, [branches, searchQuery]);

  // Calculate order stats per branch
  const branchStats = useMemo(() => {
    const map = new Map<
      string,
      {
        totalOrders: number;
        pendingOrders: number;
        deliveredOrders: number;
        totalAmount: number;
        demandItemsCount: number;
      }
    >();

    branches.forEach((b) => {
      const orders = branchOrders.filter((o) => o.branchId === b.id);
      const demands = branchDemands.filter((d) => d.branchId === b.id && d.monthlyQuota > 0);
      map.set(b.id, {
        totalOrders: orders.length,
        pendingOrders: orders.filter((o) => o.status !== 'DELIVERED').length,
        deliveredOrders: orders.filter((o) => o.status === 'DELIVERED').length,
        totalAmount: orders.reduce((sum, o) => sum + (o.totalAmount || 0), 0),
        demandItemsCount: demands.length,
      });
    });

    return map;
  }, [branches, branchOrders, branchDemands]);

  const totalBranchesCount = branches.length;
  const totalOrdersAcrossBranches = branchOrders.length;
  const totalPendingAcrossBranches = branchOrders.filter((o) => o.status !== 'DELIVERED').length;

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-5 py-3 rounded-2xl shadow-xl flex items-center gap-3 border border-slate-700 animate-bounce">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          <span className="text-sm font-semibold">{toastMessage}</span>
        </div>
      )}

      {/* Google Sheet database banner */}
      <div className="bg-gradient-to-r from-emerald-900 via-teal-900 to-slate-900 text-white p-4 sm:p-5 rounded-2xl shadow-sm border border-emerald-800/60 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start sm:items-center gap-3.5">
          <div className="p-2.5 bg-emerald-500/20 rounded-xl border border-emerald-400/30 text-emerald-300 shrink-0">
            <Cloud className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-extrabold text-base sm:text-lg tracking-tight">
              ฐานข้อมูล Google Sheet
            </h3>
            <p className="text-xs text-emerald-200 mt-0.5">
              ข้อมูลสาขา สินค้าคงคลัง และใบส่งสินค้า ถูกเก็บในไฟล์ Google Sheet ของคุณ ทุกเครื่องที่เชื่อมต่อเห็นข้อมูลตรงกัน
              {isCloudLoading ? ' (กำลังโหลด...)' : ''}
            </p>
          </div>
        </div>
        <div className="self-end sm:self-center shrink-0 text-xs bg-white/10 px-3 py-1.5 rounded-xl border border-white/10 font-medium text-emerald-100">
          {sheetsSync.message}
        </div>
      </div>

      {/* Main Header and Controls */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-blue-50 text-blue-700 rounded-xl">
              <Building2 className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">
                จัดการสาขา (Branch Management)
              </h2>
              <p className="text-xs text-slate-500 mt-0.5 font-medium">
                เพิ่มสาขาใหม่ แก้ไขเปลี่ยนชื่อสาขา หรือลบสาขา สำหรับการกระจายสินค้าและการวางแผนโควตา
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={handleOpenAddModal}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm px-4 py-2.5 rounded-xl shadow-xs transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>เพิ่มสาขาใหม่</span>
          </button>
        </div>
      </div>

      {/* KPI Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4.5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              จำนวนสาขาทั้งหมด
            </span>
            <div className="p-2 bg-blue-50 text-blue-700 rounded-xl">
              <Building2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-900">{totalBranchesCount}</span>
            <span className="text-xs font-semibold text-slate-500">สาขา</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">กระจายสินค้าทั่วกรุงเทพฯ และปริมณฑล</p>
        </div>

        <div className="bg-white p-4.5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              ใบส่งสินค้าทั้งหมด
            </span>
            <div className="p-2 bg-indigo-50 text-indigo-700 rounded-xl">
              <Truck className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-900">{totalOrdersAcrossBranches}</span>
            <span className="text-xs font-semibold text-slate-500">ออเดอร์</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">รวมประวัติการจัดส่งทุกสาขา</p>
        </div>

        <div className="bg-white p-4.5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              อยู่ระหว่างรอจัดส่ง
            </span>
            <div className="p-2 bg-amber-50 text-amber-700 rounded-xl">
              <Package className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-amber-700">{totalPendingAcrossBranches}</span>
            <span className="text-xs font-semibold text-amber-600">รายการ</span>
          </div>
          <p className="text-[11px] text-amber-600/80 mt-1">กำลังเตรียมหรืออยู่ระหว่างทาง</p>
        </div>

        <div className="bg-white p-4.5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              สถานะ Cloud Database
            </span>
            <div className="p-2 bg-emerald-50 text-emerald-700 rounded-xl">
              <Cloud className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-xl font-black text-emerald-700">ONLINE</span>
            <span className="text-xs font-semibold text-emerald-600">พร้อมซิงก์</span>
          </div>
          <p className="text-[11px] text-emerald-600/80 mt-1">ทุกอุปกรณ์รับข้อมูลตรงกัน 100%</p>
        </div>
      </div>

      {/* Search & Filter Toolbar */}
      <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="ค้นหาชื่อสาขา, รหัสสาขา (เช่น BR-01), ผู้ติดต่อ, เบอร์โทร หรือที่อยู่..."
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        <div className="text-xs font-semibold text-slate-500 shrink-0">
          แสดง <span className="text-slate-900 font-bold">{filteredBranches.length}</span> จาก{' '}
          {branches.length} สาขา
        </div>
      </div>

      {/* Branches Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4.5">
        {filteredBranches.map((branch) => {
          const stats = branchStats.get(branch.id) || {
            totalOrders: 0,
            pendingOrders: 0,
            deliveredOrders: 0,
            totalAmount: 0,
            demandItemsCount: 0,
          };

          return (
            <div
              key={branch.id}
              className="bg-white rounded-2xl border border-slate-200 shadow-xs hover:shadow-md transition-all flex flex-col justify-between overflow-hidden group"
            >
              {/* Card Header */}
              <div className="p-5 border-b border-slate-100">
                <div className="flex items-start justify-between gap-2.5">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="bg-blue-100 text-blue-800 text-[11px] font-extrabold px-2 py-0.5 rounded-md border border-blue-200">
                        {branch.code}
                      </span>
                      {stats.pendingOrders > 0 && (
                        <span className="bg-amber-100 text-amber-800 text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                          รอส่ง {stats.pendingOrders} ใบ
                        </span>
                      )}
                    </div>
                    <h3 className="font-extrabold text-base text-slate-900 leading-snug group-hover:text-blue-700 transition-colors">
                      {branch.name}
                    </h3>
                  </div>

                  {/* Actions Dropdown / Quick Buttons */}
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleOpenEditModal(branch)}
                      className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                      title="แก้ไข / เปลี่ยนชื่อสาขา"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setBranchToDelete(branch)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                      title="ลบสาขาออกจากระบบ"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Details */}
                <div className="mt-3.5 space-y-2 text-xs text-slate-600">
                  <div className="flex items-start gap-2">
                    <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                    <span className="line-clamp-2 text-slate-600">
                      {branch.address || 'ยังไม่ระบุที่อยู่จัดส่ง'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-100">
                    <div className="flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="font-medium text-slate-700">
                        {branch.contactPerson || '-'}
                      </span>
                    </div>
                    {branch.phone && (
                      <div className="flex items-center gap-1 text-slate-600">
                        <Phone className="w-3 h-3 text-slate-400 shrink-0" />
                        <a
                          href={`tel:${branch.phone}`}
                          className="hover:text-blue-600 font-mono text-[11px]"
                        >
                          {branch.phone}
                        </a>
                      </div>
                    )}
                  </div>

                  {branch.defaultRecipientName && branch.defaultRecipientName !== branch.contactPerson && (
                    <div className="text-[11px] text-slate-500 pl-5">
                      ผู้รับของค่าเริ่มต้น: <span className="font-medium text-slate-700">{branch.defaultRecipientName}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Statistics Strip */}
              <div className="bg-slate-50/70 px-5 py-3 border-b border-slate-100 grid grid-cols-3 gap-2 text-center text-xs">
                <div>
                  <span className="text-[10px] text-slate-400 block font-semibold">ใบส่งของ</span>
                  <span className="font-bold text-slate-800">{stats.totalOrders} ใบ</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block font-semibold">โควตาสินค้า</span>
                  <span className="font-bold text-blue-700">{stats.demandItemsCount} รายการ</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block font-semibold">ยอดจัดส่งรวม</span>
                  <span className="font-bold text-emerald-700">
                    ฿{stats.totalAmount.toLocaleString()}
                  </span>
                </div>
              </div>

              {/* Card Footer Actions */}
              <div className="p-3 bg-white flex items-center justify-between gap-2">
                {onRequestRequisitionForBranch && (
                  <button
                    onClick={() => onRequestRequisitionForBranch(branch.id)}
                    className="flex-1 flex items-center justify-center gap-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-bold py-1.5 px-2 rounded-xl transition-colors cursor-pointer"
                  >
                    <Truck className="w-3.5 h-3.5" />
                    <span>ออกใบส่งของ</span>
                  </button>
                )}

                {onNavigateToDeliveries && (
                  <button
                    onClick={() => onNavigateToDeliveries(branch.id)}
                    className="flex items-center justify-center gap-1 text-slate-600 hover:text-slate-900 text-xs font-semibold py-1.5 px-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 transition-colors cursor-pointer"
                    title="ดูประวัติการส่งของสาขานี้"
                  >
                    <span>ดูประวัติ</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                )}

                {onNavigateToDemand && (
                  <button
                    onClick={() => onNavigateToDemand(branch.id)}
                    className="flex items-center justify-center gap-1 text-slate-600 hover:text-slate-900 text-xs font-semibold py-1.5 px-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 transition-colors cursor-pointer"
                    title="ตั้งค่าโควตารายเดือน"
                  >
                    <Layers className="w-3 h-3 text-indigo-500" />
                    <span>โควตา</span>
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {filteredBranches.length === 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
          <Building2 className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h4 className="font-bold text-slate-700 text-base">ไม่พบข้อมูลสาขาที่ค้นหา</h4>
          <p className="text-xs text-slate-400 mt-1">
            ลองปรับเปลี่ยนคำค้นหา หรือกดปุ่ม "เพิ่มสาขาใหม่" เพื่อลงทะเบียนสาขาเข้าสู่ระบบ
          </p>
          <button
            onClick={handleOpenAddModal}
            className="mt-4 inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-4 py-2 rounded-xl transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>เพิ่มสาขาใหม่</span>
          </button>
        </div>
      )}

      {/* Add Branch Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-6 py-4.5 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-blue-500/20 rounded-xl text-blue-400">
                  <Building2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base">เพิ่มสาขาใหม่ (Add New Branch)</h3>
                  <p className="text-xs text-slate-400">
                    บันทึกข้อมูลสาขาลงฐานข้อมูลคลาวด์ ซิงก์ทุกเครื่องพร้อมกัน
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveAdd} className="p-6 space-y-4">
              {formError && (
                <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs p-3 rounded-xl flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    รหัสสาขา <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                    placeholder="เช่น BR-06"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white uppercase"
                    required
                  />
                  <p className="text-[10px] text-slate-400 mt-1">รหัสเฉพาะไม่ซ้ำกับสาขาอื่น</p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    ชื่อสาขา <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="เช่น สาขา 6 - สยามพารากอน"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    ผู้ติดต่อ / ผู้จัดการสาขา
                  </label>
                  <input
                    type="text"
                    value={formData.contactPerson}
                    onChange={(e) => setFormData({ ...formData, contactPerson: e.target.value })}
                    placeholder="เช่น คุณสมศักดิ์ รักงาน"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    เบอร์โทรศัพท์ติดต่อ
                  </label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="เช่น 02-123-4567 หรือ 081-xxx-xxxx"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  ที่อยู่จัดส่งสินค้า
                </label>
                <textarea
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  placeholder="ระบุเลขที่ ถนน แขวง เขต จังหวัด รหัสไปรษณีย์ และจุดสังเกตการลงสินค้า"
                  rows={3}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  ชื่อผู้รับสินค้าเริ่มต้นในใบส่งของ
                </label>
                <input
                  type="text"
                  value={formData.defaultRecipientName}
                  onChange={(e) =>
                    setFormData({ ...formData, defaultRecipientName: e.target.value })
                  }
                  placeholder="หากเว้นว่าง ระบบจะใช้ชื่อผู้ติดต่อข้างต้น"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 text-xs sm:text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 text-xs sm:text-sm font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-xs transition-colors flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>กำลังบันทึกลงคลาวด์...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      <span>บันทึกสาขาใหม่</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit / Rename Branch Modal */}
      {editingBranch && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-6 py-4.5 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-indigo-500/20 rounded-xl text-indigo-400">
                  <Edit2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base">แก้ไข / เปลี่ยนชื่อสาขา</h3>
                  <p className="text-xs text-slate-400">
                    แก้ไขข้อมูลสาขา {editingBranch.code} และบันทึกคลาวด์เรียลไทม์
                  </p>
                </div>
              </div>
              <button
                onClick={() => setEditingBranch(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="p-6 space-y-4">
              {formError && (
                <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs p-3 rounded-xl flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    รหัสสาขา <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white uppercase"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    ชื่อสาขา (เปลี่ยนชื่อ) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    ผู้ติดต่อ / ผู้จัดการสาขา
                  </label>
                  <input
                    type="text"
                    value={formData.contactPerson}
                    onChange={(e) => setFormData({ ...formData, contactPerson: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    เบอร์โทรศัพท์ติดต่อ
                  </label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  ที่อยู่จัดส่งสินค้า
                </label>
                <textarea
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  ชื่อผู้รับสินค้าเริ่มต้น
                </label>
                <input
                  type="text"
                  value={formData.defaultRecipientName}
                  onChange={(e) =>
                    setFormData({ ...formData, defaultRecipientName: e.target.value })
                  }
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setEditingBranch(null)}
                  className="px-4 py-2 text-xs sm:text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 text-xs sm:text-sm font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-xs transition-colors flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>กำลังอัปเดต...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      <span>บันทึกการแก้ไข</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {branchToDelete && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-6">
              <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mb-4">
                <Trash2 className="w-6 h-6" />
              </div>

              <h3 className="font-extrabold text-lg text-slate-900">
                ยืนยันการลบสาขา "{branchToDelete.name}"?
              </h3>

              <div className="mt-2.5 p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 space-y-1">
                <p className="font-bold flex items-center gap-1.5">
                  <ShieldAlert className="w-4 h-4 shrink-0 text-rose-600" />
                  คำเตือนการลบข้อมูล:
                </p>
                <p>
                  รหัสสาขา: <span className="font-semibold">{branchToDelete.code}</span>
                </p>
                {(() => {
                  const orders = branchOrders.filter((o) => o.branchId === branchToDelete.id);
                  if (orders.length > 0) {
                    return (
                      <p className="font-semibold text-rose-900 pt-1 border-t border-rose-200/60">
                        สาขานี้มีประวัติใบส่งของจำนวน {orders.length} ใบ ในระบบ
                        การลบจะนำสาขาออกจากรายการสาขาที่เลือกได้
                      </p>
                    );
                  }
                  return <p>สาขานี้จะถูกลบออกจาก Cloud Database ทันที</p>;
                })()}
              </div>

              <div className="mt-6 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setBranchToDelete(null)}
                  className="px-4 py-2 text-xs sm:text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDelete}
                  disabled={isSubmitting}
                  className="px-4.5 py-2 text-xs sm:text-sm font-bold bg-rose-600 hover:bg-rose-700 text-white rounded-xl shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>กำลังลบ...</span>
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-4 h-4" />
                      <span>ยืนยันลบสาขา</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
