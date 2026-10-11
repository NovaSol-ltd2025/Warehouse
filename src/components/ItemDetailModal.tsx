import React, { useState, useRef } from 'react';
import { InventoryItem, PriceHistoryRecord } from '../types/inventory';
import { useInventory } from '../context/InventoryContext';
import { getPriceTrend } from '../utils/smartValidator';
import { processLocalImageFile, convertToLh3Url, extractGoogleDriveId } from '../utils/imageHelper';
import {
  X,
  Image as ImageIcon,
  TrendingUp,
  TrendingDown,
  Minus,
  AlertTriangle,
  Building,
  Check,
  Plus,
  Save,
  Tag,
  ShieldAlert,
  Info,
  Upload,
  FolderOpen,
  Link2,
  Sparkles,
} from 'lucide-react';

interface ItemDetailModalProps {
  item: InventoryItem;
  onClose: () => void;
}

export const ItemDetailModal: React.FC<ItemDetailModalProps> = ({ item, onClose }) => {
  const { updateItem, branches } = useInventory();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form states
  const [name, setName] = useState(item.name);
  const [unitPrice, setUnitPrice] = useState(item.unitPrice);
  const [baselinePrice, setBaselinePrice] = useState(item.baselinePrice || item.unitPrice);
  const [imageUrl, setImageUrl] = useState(item.imageUrl || '');
  const [imageDriveId, setImageDriveId] = useState(item.imageDriveId || '');
  const [driveInput, setDriveInput] = useState(item.imageDriveId || '');
  const [isProcessingFile, setIsProcessingFile] = useState(false);
  const [imageNotice, setImageNotice] = useState<string | null>(null);
  const [color, setColor] = useState(item.variantSpec?.color || '');
  const [scent, setScent] = useState(item.variantSpec?.scent || '');
  const [size, setSize] = useState(item.variantSpec?.size || '');
  const [notes, setNotes] = useState(item.notes || '');

  // Branch note editor for the selected branch
  const [selectedBranchId, setSelectedBranchId] = useState<string>(branches[0]?.id || 'BR-01');
  const [branchNotes, setBranchNotes] = useState<{ [branchId: string]: string }>(
    item.branchSpecificNotes || {}
  );
  const [currentBranchNote, setCurrentBranchNote] = useState<string>(
    item.branchSpecificNotes?.[branches[0]?.id || 'BR-01'] || ''
  );

  // New Price History entry
  const [newHistoryPrice, setNewHistoryPrice] = useState<number>(item.unitPrice);
  const [newHistoryNote, setNewHistoryNote] = useState<string>('');
  const [priceHistory, setPriceHistory] = useState<PriceHistoryRecord[]>(
    item.priceHistory || [
      {
        date: new Date().toISOString().split('T')[0],
        price: item.unitPrice,
        supplierName: 'บริษัท คงธนา เซอร์วิส จำกัด',
        note: 'ราคาปัจจุบัน',
      },
    ]
  );

  const [savedSuccess, setSavedSuccess] = useState(false);

  // Handle branch note update
  const handleUpdateBranchNote = () => {
    setBranchNotes((prev) => ({
      ...prev,
      [selectedBranchId]: currentBranchNote,
    }));
  };

  // Add new price entry
  const handleAddPriceHistory = () => {
    if (!newHistoryPrice) return;
    const newRecord: PriceHistoryRecord = {
      date: new Date().toISOString().split('T')[0],
      price: Number(newHistoryPrice),
      supplierName: 'บริษัท คงธนา เซอร์วิส จำกัด',
      note: newHistoryNote || (newHistoryPrice > unitPrice ? 'ราคาปรับขึ้น' : 'ราคาปรับลด'),
    };
    setPriceHistory((prev) => [newRecord, ...prev]);
    setUnitPrice(Number(newHistoryPrice));
    setNewHistoryNote('');
  };

  // 1. Handle Local File Upload from device & convert to optimized base64
  const handleLocalFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsProcessingFile(true);
      setImageNotice(null);
      const dataUrl = await processLocalImageFile(file, 640, 640, 0.85);
      setImageUrl(dataUrl);
      setImageNotice(`✓ แนบรูปภาพจากเครื่องเรียบร้อย (${file.name})`);
    } catch (err: any) {
      alert(err?.message || 'เกิดข้อผิดพลาดในการโหลดรูปภาพ');
    } finally {
      setIsProcessingFile(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // 2. Handle Google Drive Link/ID conversion to direct lh3 URL
  const handleDriveUrlConvert = (val: string) => {
    setDriveInput(val);
    const driveId = extractGoogleDriveId(val);
    if (driveId) {
      setImageDriveId(driveId);
      const lh3Url = `https://lh3.googleusercontent.com/d/${driveId}`;
      setImageUrl(lh3Url);
      setImageNotice(`✓ แปลงลิงก์ Google Drive เป็นลิงก์ตรงความเร็วสูง lh3 แล้ว (ID: ${driveId})`);
    }
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();

    const updatedItem: InventoryItem = {
      ...item,
      name,
      unitPrice: Number(unitPrice),
      baselinePrice: Number(baselinePrice),
      imageUrl: imageUrl.trim() || undefined,
      imageDriveId: imageDriveId.trim() || undefined,
      variantSpec: {
        color: color || undefined,
        scent: scent || undefined,
        size: size || undefined,
      },
      branchSpecificNotes: {
        ...branchNotes,
        [selectedBranchId]: currentBranchNote,
      },
      priceHistory,
      notes,
    };

    updateItem(updatedItem);
    setSavedSuccess(true);
    setTimeout(() => {
      setSavedSuccess(false);
      onClose();
    }, 800);
  };

  const trend = getPriceTrend({ ...item, unitPrice, baselinePrice });

  // Preset clean photos
  const presetPhotos = [
    { label: 'ถุงขยะสีดำ', url: 'https://images.unsplash.com/photo-1595246140625-573b715d11dc?auto=format&fit=crop&w=400&q=80' },
    { label: 'น้ำยาแกลลอน 3.8L', url: 'https://images.unsplash.com/photo-1584820927498-cfe5211fd8bf?auto=format&fit=crop&w=400&q=80' },
    { label: 'สบู่เหลว/หัวปั๊ม', url: 'https://images.unsplash.com/photo-1608248597359-59752f9b8c9c?auto=format&fit=crop&w=400&q=80' },
    { label: 'กระดาษทิชชู่', url: 'https://images.unsplash.com/photo-1584556812952-905ffd0c611a?auto=format&fit=crop&w=400&q=80' },
    { label: 'ผ้าไมโครไฟเบอร์/ผ้าม๊อบ', url: 'https://images.unsplash.com/photo-1528740561666-dc2479dc08ab?auto=format&fit=crop&w=400&q=80' },
    { label: 'เสื้อยูนิฟอร์ม', url: 'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?auto=format&fit=crop&w=400&q=80' },
  ];

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/75 backdrop-blur-sm flex justify-center items-center p-3 sm:p-5 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[94vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="bg-slate-900 text-white p-5 sm:p-6 flex items-start justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-bold bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded border border-blue-400/30">
                {item.code}
              </span>
              <span className="text-xs text-slate-400 font-medium">
                {item.category}
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold">{item.name}</h2>
            <p className="text-xs text-slate-400">
              กำหนดรูปภาพสินค้า &bull; ติดตามความผันผวนของราคา &bull; ข้อกำหนดและป้องกันส่งผิดสาขา
            </p>
          </div>

          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSave} className="p-5 sm:p-6 overflow-y-auto space-y-6 flex-1">
          
          {/* Section 1: Product Photo & Identification */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6 bg-slate-50 p-4 sm:p-5 rounded-2xl border border-slate-200">
            {/* Image Preview Box */}
            <div className="md:col-span-4 flex flex-col items-center justify-center">
              <div className="w-full aspect-square max-w-[220px] rounded-xl overflow-hidden border-2 border-slate-300 bg-white shadow-inner flex items-center justify-center relative group">
                {imageUrl ? (
                  <img
                    src={imageUrl}
                    alt={name}
                    className="w-full h-full object-cover"
                    onError={() => setImageUrl('')}
                  />
                ) : (
                  <div className="text-center p-4 text-slate-400">
                    <ImageIcon className="w-12 h-12 mx-auto mb-2 text-slate-300" />
                    <span className="text-xs">ยังไม่มีรูปภาพสินค้า</span>
                  </div>
                )}
              </div>
              <span className="text-[11px] text-slate-500 mt-2 text-center">
                รูปสินค้าสำหรับแสดงในใบเบิกและคลังสินค้า
              </span>
            </div>

            {/* Image Input, File Selector & Drive converter */}
            <div className="md:col-span-8 space-y-3.5">
              
              {/* Option A: Select File from Device */}
              <div className="bg-white p-3.5 rounded-xl border border-slate-200">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <FolderOpen className="w-4 h-4 text-blue-600" />
                    เลือกรูปภาพจากเครื่อง (มือถือ/คอมพิวเตอร์)
                  </span>
                  <span className="text-[10px] text-slate-500">
                    JPG, PNG, WebP
                  </span>
                </div>

                <input
                  type="file"
                  ref={fileInputRef}
                  accept="image/*"
                  onChange={handleLocalFileChange}
                  className="hidden"
                />

                <div className="flex flex-wrap gap-2 items-center">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isProcessingFile}
                    className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-3.5 py-2 rounded-lg transition-colors cursor-pointer shadow-xs disabled:opacity-50"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>{isProcessingFile ? 'กำลังแปลงไฟล์...' : 'เลือกไฟล์รูปภาพในเครื่อง'}</span>
                  </button>

                  {imageUrl && (
                    <button
                      type="button"
                      onClick={() => {
                        setImageUrl('');
                        setImageNotice(null);
                      }}
                      className="text-xs text-rose-600 bg-rose-50 hover:bg-rose-100 px-3 py-2 rounded-lg font-semibold transition-colors"
                    >
                      ลบรูปภาพ
                    </button>
                  )}
                </div>
              </div>

              {/* Option B: Google Drive to lh3 Converter */}
              <div className="bg-white p-3.5 rounded-xl border border-slate-200">
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <Link2 className="w-4 h-4 text-emerald-600" />
                    วางลิงก์ Google Drive (แปลงเป็น lh3 อัตโนมัติ)
                  </label>
                  <span className="text-[10px] text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.5 rounded">
                    ความเร็วสูง lh3
                  </span>
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="วางลิงก์ Drive หรือ File ID เช่น 1seZ1h5ddiY1CL7ELoXxqSC1pxbbJuBbO"
                    value={driveInput}
                    onChange={(e) => handleDriveUrlConvert(e.target.value)}
                    className="flex-1 bg-slate-50 border border-slate-300 rounded-lg px-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
                  />
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  ระบบจะดึง File ID และแปลงเป็น <code className="text-emerald-700 bg-emerald-50 px-1 py-0.5 rounded">https://lh3.googleusercontent.com/d/ID</code> โดยตรงเพื่อให้โหลดเร็วทันที
                </p>
              </div>

              {/* Notice Banner */}
              {imageNotice && (
                <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs px-3 py-2 rounded-xl flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{imageNotice}</span>
                </div>
              )}

              {/* Option C: Image URL & Quick Presets */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  หรือวาง URL รูปภาพโดยตรง (Direct Image URL):
                </label>
                <input
                  type="url"
                  placeholder="https://... URL รูปภาพ"
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Quick Preset Selector */}
              <div>
                <span className="text-[11px] font-semibold text-slate-500 block mb-1.5">
                  เลือกจากรูปภาพสำเร็จรูป (คลิกเพื่อเลือกทันที):
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {presetPhotos.map((p, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        setImageUrl(p.url);
                        setImageNotice(`✓ เลือกรูป ${p.label}`);
                      }}
                      className="text-[11px] bg-white hover:bg-blue-50 hover:text-blue-700 hover:border-blue-400 border border-slate-200 px-2.5 py-1 rounded-lg transition-colors cursor-pointer"
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Variant Specs (Color, Scent, Size) to prevent confusion */}
              <div className="pt-2 border-t border-slate-200">
                <span className="text-xs font-bold text-slate-700 block mb-2">
                  ลักษณะเฉพาะเพื่อป้องกันการส่งสเปกผิด (Variant Specs)
                </span>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-[11px] text-slate-500 mb-1">สีของน้ำยา/วัสดุ</label>
                    <input
                      type="text"
                      placeholder="เช่น สีฟ้ามุก, สีม่วง"
                      value={color}
                      onChange={(e) => setColor(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-900"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-500 mb-1">กลิ่น / สูตร</label>
                    <input
                      type="text"
                      placeholder="เช่น นมข้าว, ซุปเปอร์เฟรช"
                      value={scent}
                      onChange={(e) => setScent(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-900"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-500 mb-1">ขนาด / ไซส์</label>
                    <input
                      type="text"
                      placeholder="เช่น 18x20 นิ้ว, 3.8 L"
                      value={size}
                      onChange={(e) => setSize(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-900"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Section 2: Price Fluctuation & Price History (ระบบวิเคราะห์ราคาขึ้น-ลง) */}
          <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Tag className="w-4 h-4 text-blue-600" />
                  <span>ระบบวิเคราะห์ความผันผวนของราคา (Price Volatility & Margin Guard)</span>
                </h3>
                <p className="text-xs text-slate-500">
                  ตรวจสอบการปรับขึ้นหรือลงของราคาในแต่ละครั้ง เพื่อป้องกันต้นทุนสูงเกินควร
                </p>
              </div>

              {/* Price Trend Badge */}
              <div className="flex items-center gap-2">
                {trend.status === 'UP' && (
                  <span className="inline-flex items-center gap-1 bg-rose-100 text-rose-800 text-xs font-bold px-2.5 py-1 rounded-full border border-rose-200">
                    <TrendingUp className="w-3.5 h-3.5 text-rose-600" />
                    <span>ราคาปรับขึ้น +{trend.percent}% (+{trend.diff.toLocaleString()} ฿)</span>
                  </span>
                )}
                {trend.status === 'DOWN' && (
                  <span className="inline-flex items-center gap-1 bg-emerald-100 text-emerald-800 text-xs font-bold px-2.5 py-1 rounded-full border border-emerald-200">
                    <TrendingDown className="w-3.5 h-3.5 text-emerald-600" />
                    <span>ราคาปรับลด {trend.percent}% (ประหยัดต้นทุน)</span>
                  </span>
                )}
                {trend.status === 'STABLE' && (
                  <span className="inline-flex items-center gap-1 bg-slate-100 text-slate-700 text-xs font-semibold px-2.5 py-1 rounded-full border border-slate-200">
                    <Minus className="w-3.5 h-3.5 text-slate-500" />
                    <span>ราคาคงที่ตามเกณฑ์</span>
                  </span>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  ราคาซื้อปัจจุบัน (บาท / {item.unit}) *
                </label>
                <input
                  type="number"
                  min={0}
                  step={0.5}
                  value={unitPrice}
                  onChange={(e) => setUnitPrice(Number(e.target.value))}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  ราคาฐานเปรียบเทียบ (Benchmark Price)
                </label>
                <input
                  type="number"
                  min={0}
                  step={0.5}
                  value={baselinePrice}
                  onChange={(e) => setBaselinePrice(Number(e.target.value))}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <span className="text-[10px] text-slate-400 mt-0.5 block">
                  ใช้เปรียบเทียบแจ้งเตือนหากราคาสินค้าพุ่งสูงผิดปกติ
                </span>
              </div>
            </div>

            {/* Price History Table */}
            <div className="space-y-2 pt-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700">
                  ประวัติราคาแต่ละครั้ง ({priceHistory.length} บันทึก)
                </span>
                
                {/* Add new price point inline */}
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    placeholder="ราคาใหม่"
                    value={newHistoryPrice}
                    onChange={(e) => setNewHistoryPrice(Number(e.target.value))}
                    className="w-20 bg-slate-50 border border-slate-300 rounded px-2 py-1 text-xs"
                  />
                  <input
                    type="text"
                    placeholder="เหตุผล (เช่น ปรับต้นทุน)"
                    value={newHistoryNote}
                    onChange={(e) => setNewHistoryNote(e.target.value)}
                    className="w-32 bg-slate-50 border border-slate-300 rounded px-2 py-1 text-xs"
                  />
                  <button
                    type="button"
                    onClick={handleAddPriceHistory}
                    className="bg-slate-800 hover:bg-slate-900 text-white text-xs px-2.5 py-1 rounded cursor-pointer"
                  >
                    + บันทึกราคา
                  </button>
                </div>
              </div>

              <div className="border border-slate-200 rounded-xl overflow-hidden max-h-36 overflow-y-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-100 text-slate-700 sticky top-0 font-semibold">
                    <tr>
                      <th className="py-1.5 px-3">วันที่</th>
                      <th className="py-1.5 px-3 text-right">ราคาต่อหน่วย</th>
                      <th className="py-1.5 px-3">Supplier</th>
                      <th className="py-1.5 px-3">หมายเหตุ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {priceHistory.map((ph, idx) => (
                      <tr key={idx} className="hover:bg-slate-50">
                        <td className="py-1.5 px-3 text-slate-500 font-mono">{ph.date}</td>
                        <td className="py-1.5 px-3 text-right font-bold text-slate-900">
                          {ph.price.toLocaleString()} ฿
                        </td>
                        <td className="py-1.5 px-3 text-slate-600">{ph.supplierName}</td>
                        <td className="py-1.5 px-3 text-slate-500 text-[11px]">{ph.note || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Section 3: Branch-Specific Compatibility & Smart Rules (ป้องกันส่งผิดสาขา) */}
          <div className="bg-amber-50/60 p-4 sm:p-5 rounded-2xl border border-amber-200 space-y-3">
            <div className="flex items-start gap-2.5">
              <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <h3 className="text-sm font-bold text-amber-950">
                  ระบบ Smart: ข้อกำหนดและเงื่อนไขเฉพาะแต่ละสาขา (Branch Compatibility & Whitelist)
                </h3>
                <p className="text-xs text-amber-900 mt-0.5 leading-relaxed">
                  บางสาขาจะใช้สินค้าคนละสูตร/คนละสเปกกันแม้ชื่อจะเหมือนกัน เช่น <strong>ศูนย์ฝึกอาชีพจตุจักร</strong> กำหนดให้ใช้เฉพาะสูตรสบู่เหลวสีฟ้ามุก หรือน้ำยาถูพื้นสีม่วงเท่านั้น การระบุไว้จะทำให้ระบบแจ้งเตือนทันทีเมื่อมีคนเปิดใบส่งของผิดสูตร
                </p>
              </div>
            </div>

            <div className="bg-white p-3.5 rounded-xl border border-amber-200 space-y-2 mt-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label className="text-xs font-bold text-slate-700">
                  เลือกสาขาที่ต้องการตั้งกฎเฉพาะ:
                </label>
                <select
                  value={selectedBranchId}
                  onChange={(e) => {
                    const bId = e.target.value;
                    setSelectedBranchId(bId);
                    setCurrentBranchNote(branchNotes[bId] || '');
                  }}
                  className="bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1 text-xs text-slate-900 font-semibold"
                >
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <textarea
                  rows={2}
                  placeholder="เช่น ศูนย์ฝึกอาชีพจตุจักร กำหนดใช้กลิ่นนมข้าว สีฟ้ามุก K-SAVE เท่านั้น ห้ามส่งสีชมพู!"
                  value={currentBranchNote}
                  onChange={(e) => setCurrentBranchNote(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
                <div className="flex justify-end mt-1">
                  <button
                    type="button"
                    onClick={handleUpdateBranchNote}
                    className="bg-amber-600 hover:bg-amber-700 text-white text-xs px-3 py-1 rounded-lg font-medium cursor-pointer"
                  >
                    บันทึกกฎเฉพาะสาขานี้
                  </button>
                </div>
              </div>
            </div>
          </div>

        </form>

        {/* Footer */}
        <div className="bg-slate-100 p-4 sm:p-5 border-t border-slate-200 flex items-center justify-between">
          <div className="text-xs text-slate-500">
            {savedSuccess ? (
              <span className="text-emerald-600 font-bold flex items-center gap-1">
                <Check className="w-4 h-4" /> บันทึกข้อมูลและกฎ Smart เรียบร้อยแล้ว!
              </span>
            ) : (
              <span>การบันทึกจะอัปเดตระบบตรวจจับ Smart ทั่วทั้งระบบ</span>
            )}
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
              onClick={handleSave}
              className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-sm font-bold px-5 py-2.5 rounded-xl shadow-md transition-all cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>บันทึกการเปลี่ยนแปลง</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
