import React, { useRef, useState, useEffect } from 'react';
import { X, RotateCcw, Check, PenTool, User, Calendar, CheckCircle2 } from 'lucide-react';
import { BranchOrder } from '../types/inventory';

interface SignatureModalProps {
  order: BranchOrder;
  onSave: (signatures: {
    senderSignatureUrl?: string;
    receiverSignatureUrl?: string;
    senderName?: string;
    receiverName?: string;
    senderSignedAt?: string;
    receiverSignedAt?: string;
  }) => void;
  onClose: () => void;
}

type SignerRole = 'RECEIVER' | 'SENDER';

export const SignatureModal: React.FC<SignatureModalProps> = ({ order, onSave, onClose }) => {
  const [activeRole, setActiveRole] = useState<SignerRole>('RECEIVER');

  // Signer details
  const [receiverName, setReceiverName] = useState(order.receiverName || '');
  const [senderName, setSenderName] = useState(order.senderName || 'ทีมจัดส่ง โนวาโซล');
  const [receiverSignature, setReceiverSignature] = useState<string | undefined>(order.receiverSignatureUrl);
  const [senderSignature, setSenderSignature] = useState<string | undefined>(order.senderSignatureUrl);
  const [receiverSignedAt, setReceiverSignedAt] = useState<string | undefined>(order.receiverSignedAt);
  const [senderSignedAt, setSenderSignedAt] = useState<string | undefined>(order.senderSignedAt);

  // Canvas drawing state
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasDrawnCurrent, setHasDrawnCurrent] = useState(false);
  const [penColor, setPenColor] = useState('#1e293b'); // Navy-Slate
  const [penWidth, setPenWidth] = useState(3);

  // Setup canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Handle high DPI
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Clear canvas
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, rect.width, rect.height);

    // If active role already has signature, render it
    const existingSig = activeRole === 'RECEIVER' ? receiverSignature : senderSignature;
    if (existingSig) {
      const img = new Image();
      img.onload = () => {
        ctx.drawImage(img, 0, 0, rect.width, rect.height);
      };
      img.src = existingSig;
      setHasDrawnCurrent(true);
    } else {
      setHasDrawnCurrent(false);
    }
  }, [activeRole]);

  // Touch & Mouse Drawing Handlers
  const getCoordinates = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();

    if ('touches' in e) {
      const touch = e.touches[0];
      return {
        x: touch.clientX - rect.left,
        y: touch.clientY - rect.top,
      };
    } else {
      return {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      };
    }
  };

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { x, y } = getCoordinates(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.strokeStyle = penColor;
    ctx.lineWidth = penWidth;
    setIsDrawing(true);
    setHasDrawnCurrent(true);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { x, y } = getCoordinates(e);
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    if (!isDrawing) return;
    setIsDrawing(false);
    saveCurrentCanvasToState();
  };

  const saveCurrentCanvasToState = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL('image/png');
    const nowStr = new Date().toLocaleString('th-TH', {
      dateStyle: 'medium',
      timeStyle: 'short',
    });

    if (activeRole === 'RECEIVER') {
      setReceiverSignature(dataUrl);
      if (!receiverSignedAt) setReceiverSignedAt(nowStr);
    } else {
      setSenderSignature(dataUrl);
      if (!senderSignedAt) setSenderSignedAt(nowStr);
    }
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, rect.width, rect.height);

    if (activeRole === 'RECEIVER') {
      setReceiverSignature(undefined);
      setReceiverSignedAt(undefined);
    } else {
      setSenderSignature(undefined);
      setSenderSignedAt(undefined);
    }
    setHasDrawnCurrent(false);
  };

  const handleFinalSubmit = () => {
    saveCurrentCanvasToState();
    const nowStr = new Date().toLocaleString('th-TH', {
      dateStyle: 'medium',
      timeStyle: 'short',
    });

    onSave({
      receiverSignatureUrl: receiverSignature,
      senderSignatureUrl: senderSignature,
      receiverName: receiverName || order.receiverName || 'ผู้รับประจำสาขา',
      senderName: senderName || order.senderName || 'ทีมจัดส่ง โนวาโซล',
      receiverSignedAt: receiverSignature ? (receiverSignedAt || nowStr) : undefined,
      senderSignedAt: senderSignature ? (senderSignedAt || nowStr) : undefined,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/75 backdrop-blur-sm flex justify-center items-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="bg-slate-900 text-white px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-600/30 border border-blue-400/40 flex items-center justify-center text-blue-300">
              <PenTool className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-sm sm:text-base leading-tight">
                ลงลายมือชื่อดิจิทัล (ผู้ส่ง & ผู้รับ)
              </h3>
              <p className="text-xs text-slate-300 mt-0.5">
                เลขที่ {order.deliveryOrderNo} &bull; {order.branchName}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Role Selector Tabs */}
        <div className="grid grid-cols-2 p-3 bg-slate-100 gap-2 border-b border-slate-200">
          <button
            type="button"
            onClick={() => {
              saveCurrentCanvasToState();
              setActiveRole('RECEIVER');
            }}
            className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
              activeRole === 'RECEIVER'
                ? 'bg-white text-blue-700 shadow-sm border border-blue-200'
                : 'text-slate-600 hover:bg-slate-200/70'
            }`}
          >
            <User className="w-4 h-4 text-blue-600" />
            <span>1. ผู้รับสินค้า (สาขา)</span>
            {receiverSignature && (
              <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
            )}
          </button>

          <button
            type="button"
            onClick={() => {
              saveCurrentCanvasToState();
              setActiveRole('SENDER');
            }}
            className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
              activeRole === 'SENDER'
                ? 'bg-white text-blue-700 shadow-sm border border-blue-200'
                : 'text-slate-600 hover:bg-slate-200/70'
            }`}
          >
            <User className="w-4 h-4 text-emerald-600" />
            <span>2. ผู้ส่งสินค้า (โนวาโซล)</span>
            {senderSignature && (
              <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
            )}
          </button>
        </div>

        {/* Body */}
        <div className="p-4 sm:p-5 space-y-4">
          
          {/* Signer Name & Timestamp Input */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                {activeRole === 'RECEIVER' ? 'ชื่อ-นามสกุล ผู้รับมอบสินค้า:' : 'ชื่อ-นามสกุล ผู้จัดส่งสินค้า:'}
              </label>
              <input
                type="text"
                value={activeRole === 'RECEIVER' ? receiverName : senderName}
                onChange={(e) => {
                  if (activeRole === 'RECEIVER') setReceiverName(e.target.value);
                  else setSenderName(e.target.value);
                }}
                placeholder={activeRole === 'RECEIVER' ? 'ระบุชื่อผู้รับของ...' : 'ระบุชื่อพนักงานส่ง...'}
                className="w-full text-xs sm:text-sm px-3 py-2 bg-white rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-slate-500" />
                <span>วันเวลาที่ลงนาม:</span>
              </label>
              <div className="text-xs sm:text-sm px-3 py-2 bg-slate-200/70 rounded-lg text-slate-700 font-medium">
                {(activeRole === 'RECEIVER' ? receiverSignedAt : senderSignedAt) || 'ลงนามตอนนี้ (บันทึกอัตโนมัติ)'}
              </div>
            </div>
          </div>

          {/* Signature Canvas Area */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <span>พื้นที่เซ็นลายมือชื่อ (ใช้นิ้ว ปากกา หรือเมาส์วาด):</span>
              </span>

              {/* Controls */}
              <div className="flex items-center gap-2">
                {/* Pen width */}
                <div className="flex items-center gap-1 bg-slate-100 px-2 py-0.5 rounded-lg border border-slate-200">
                  <span className="text-[10px] text-slate-500 font-semibold">หัวปากกา:</span>
                  <button
                    type="button"
                    onClick={() => setPenWidth(2)}
                    className={`text-[10px] px-1.5 py-0.5 rounded font-bold cursor-pointer ${
                      penWidth === 2 ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    เล็ก
                  </button>
                  <button
                    type="button"
                    onClick={() => setPenWidth(3)}
                    className={`text-[10px] px-1.5 py-0.5 rounded font-bold cursor-pointer ${
                      penWidth === 3 ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    กลาง
                  </button>
                  <button
                    type="button"
                    onClick={() => setPenWidth(5)}
                    className={`text-[10px] px-1.5 py-0.5 rounded font-bold cursor-pointer ${
                      penWidth === 5 ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    หนา
                  </button>
                </div>

                {/* Clear button */}
                <button
                  type="button"
                  onClick={clearCanvas}
                  className="flex items-center gap-1 text-xs text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 px-2.5 py-1 rounded-lg font-bold transition-colors cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>ล้างลายเซ็น</span>
                </button>
              </div>
            </div>

            {/* Canvas Box */}
            <div className="relative border-2 border-dashed border-slate-300 rounded-xl overflow-hidden bg-white shadow-inner">
              <canvas
                ref={canvasRef}
                onMouseDown={startDrawing}
                onMouseMove={draw}
                onMouseUp={stopDrawing}
                onMouseLeave={stopDrawing}
                onTouchStart={startDrawing}
                onTouchMove={draw}
                onTouchEnd={stopDrawing}
                className="w-full h-44 sm:h-52 cursor-crosshair touch-none bg-white block"
              />
              <div className="absolute bottom-2 left-3 pointer-events-none text-[11px] text-slate-400 font-medium">
                ✕ เซ็นชื่อเหนือเส้นประนี้
              </div>
            </div>
          </div>

          {/* Quick status summary of both signatures */}
          <div className="grid grid-cols-2 gap-3 pt-1">
            <div className="border border-slate-200 rounded-xl p-2.5 bg-slate-50 text-xs flex items-center justify-between">
              <div>
                <span className="text-slate-500 block text-[11px]">ผู้รับ (สาขา):</span>
                <span className="font-bold text-slate-800 line-clamp-1">{receiverName || 'ยังไม่ระบุ'}</span>
              </div>
              {receiverSignature ? (
                <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                  <Check className="w-3 h-3 text-emerald-600" />
                  เซ็นแล้ว
                </span>
              ) : (
                <span className="text-slate-400 text-[10px]">ยังไม่เซ็น</span>
              )}
            </div>

            <div className="border border-slate-200 rounded-xl p-2.5 bg-slate-50 text-xs flex items-center justify-between">
              <div>
                <span className="text-slate-500 block text-[11px]">ผู้ส่ง (โนวาโซล):</span>
                <span className="font-bold text-slate-800 line-clamp-1">{senderName || 'ยังไม่ระบุ'}</span>
              </div>
              {senderSignature ? (
                <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                  <Check className="w-3 h-3 text-emerald-600" />
                  เซ็นแล้ว
                </span>
              ) : (
                <span className="text-slate-400 text-[10px]">ยังไม่เซ็น</span>
              )}
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="bg-slate-50 px-5 py-3.5 border-t border-slate-200 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs sm:text-sm font-semibold text-slate-600 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
          >
            ยกเลิก
          </button>

          <button
            type="button"
            onClick={handleFinalSubmit}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-sm font-bold px-5 py-2.5 rounded-xl shadow-md transition-all cursor-pointer"
          >
            <Check className="w-4 h-4" />
            <span>ตกลง & บันทึกลายเซ็นลงในใบส่งของ</span>
          </button>
        </div>

      </div>
    </div>
  );
};
