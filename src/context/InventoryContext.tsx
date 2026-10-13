import React, { createContext, useContext, useState, useEffect, useRef, useCallback, ReactNode } from 'react';
import {
  InventoryItem,
  Supplier,
  Branch,
  BranchOrder,
  OrderItemDetail,
  PurchaseOrder,
  StockMovement,
  RoutingType,
  BranchOrderStatus,
  POStatus,
  SheetsSyncState,
  BranchMonthlyDemand,
  BranchDemandSummary,
} from '../types/inventory';
import {
  INITIAL_ITEMS,
  INITIAL_SUPPLIERS,
  INITIAL_BRANCHES,
  INITIAL_BRANCH_ORDERS,
  INITIAL_PURCHASE_ORDERS,
  INITIAL_MOVEMENTS,
  INITIAL_BRANCH_DEMANDS,
} from '../data/mockInitialData';
import {
  sheetsApi,
  loadConnection,
  saveConnection,
  isConfigured,
  SheetsConnection,
  DbOp,
  DbSnapshot,
  CollectionName,
} from '../sheetsApi';

const POLL_INTERVAL_MS = 20000;
const CACHE_KEY = 'novasol.snapshot.v1';

interface InventoryContextType {
  items: InventoryItem[];
  suppliers: Supplier[];
  branches: Branch[];
  branchOrders: BranchOrder[];
  purchaseOrders: PurchaseOrder[];
  movements: StockMovement[];
  lowStockItems: InventoryItem[];
  branchDemands: BranchMonthlyDemand[];

  // Google Sheet database
  sheetsConnection: SheetsConnection;
  sheetsSync: SheetsSyncState;
  isSheetsConfigured: boolean;
  isCloudLoading: boolean;
  saveSheetsConnection: (conn: SheetsConnection) => Promise<void>;
  refreshFromSheet: () => Promise<boolean>;
  testSheetsConnection: (conn: SheetsConnection) => Promise<{ ok: boolean; message: string }>;

  // Branch management actions
  addSupplier: (supplier: Omit<Supplier, 'id'>) => Promise<void>;
  updateSupplier: (supplier: Supplier) => Promise<void>;
  deleteSupplier: (id: string) => Promise<void>;
  addBranch: (branch: Omit<Branch, 'id'>) => Promise<void>;
  updateBranch: (branch: Branch) => Promise<void>;
  deleteBranch: (id: string) => Promise<void>;

  // Item & Stock actions
  addItem: (item: Omit<InventoryItem, 'id'>) => Promise<void>;
  updateItem: (item: InventoryItem) => Promise<void>;
  deleteItem: (id: string) => Promise<void>;
  adjustStock: (
    itemId: string,
    delta: number,
    type: 'IN_SUPPLIER' | 'OUT_BRANCH' | 'ADJUSTMENT',
    referenceNo?: string,
    notes?: string
  ) => Promise<void>;

  // Order actions
  createBranchOrder: (
    orderData: Omit<BranchOrder, 'id' | 'deliveryOrderNo' | 'routingType' | 'totalAmount' | 'status'> & {
      routingTypeOverride?: RoutingType;
    }
  ) => Promise<BranchOrder>;
  updateBranchOrderStatus: (id: string, status: BranchOrderStatus) => Promise<void>;
  markOrderPayment: (id: string, paid: boolean, paymentRef?: string) => Promise<void>;
  markPOPayment: (id: string, paid: boolean, paymentRef?: string) => Promise<void>;
  reconcileDeliveredOrder: (before: BranchOrder, after: BranchOrder) => Promise<void>;
  updateBranchOrder: (order: BranchOrder) => Promise<void>;
  deleteBranchOrder: (id: string, restoreStock?: boolean) => Promise<void>;
  createPurchaseOrder: (
    poData: Omit<PurchaseOrder, 'id' | 'poNumber' | 'totalAmount' | 'minAmountMet' | 'status'>
  ) => Promise<PurchaseOrder>;
  updatePOStatus: (id: string, status: POStatus) => Promise<void>;
  resetToDefaultData: () => Promise<void>;

  // Demand & Quota Planning
  setBranchDemand: (branchId: string, itemId: string, monthlyQuota: number, notes?: string) => Promise<void>;
  batchUpdateBranchDemands: (demands: BranchMonthlyDemand[]) => Promise<void>;
  getBranchMonthlyDemand: (branchId: string, itemId: string) => number;
  getBranchDeliveredThisMonth: (branchId: string, itemId: string, yearMonth?: string) => number;
  getBranchDemandSummaries: (branchId?: string, yearMonth?: string) => BranchDemandSummary[];
  calculateProcurementDeficitFromDemand: () => {
    deficits: {
      item: InventoryItem;
      totalMonthlyQuota: number;
      totalDeliveredThisMonth: number;
      remainingBranchDemand: number;
      currentStockHQ: number;
      netDeficitQty: number;
      subtotalCost: number;
    }[];
    totalOrderAmount: number;
    minOrderAmount: number;
    isMinMet: boolean;
    differenceToMin: number;
    supplier: Supplier;
  };

  // Calculations
  calculateReorderSuggestion: (supplierId: string) => {
    suggestedItems: { item: InventoryItem; suggestedQty: number; subtotal: number }[];
    totalAmount: number;
    minAmount: number;
    differenceToMin: number;
    isMinMet: boolean;
  };
}

const InventoryContext = createContext<InventoryContextType | undefined>(undefined);

const demandId = (d: { branchId: string; itemId: string }) => `${d.branchId}_${d.itemId}`;

const sortSnapshot = {
  branches: (l: Branch[]) => [...l].sort((a, b) => a.code.localeCompare(b.code)),
  items: (l: InventoryItem[]) => [...l].sort((a, b) => a.code.localeCompare(b.code)),
  branchOrders: (l: BranchOrder[]) =>
    [...l].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
  purchaseOrders: (l: PurchaseOrder[]) =>
    [...l].sort((a, b) => new Date(b.orderDate).getTime() - new Date(a.orderDate).getTime()),
  movements: (l: StockMovement[]) =>
    [...l].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
};

const readCache = (): DbSnapshot | null => {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? (JSON.parse(raw) as DbSnapshot) : null;
  } catch {
    return null;
  }
};

const initialSnapshot = (): DbSnapshot => ({
  items: INITIAL_ITEMS,
  suppliers: INITIAL_SUPPLIERS,
  branches: INITIAL_BRANCHES,
  branch_orders: INITIAL_BRANCH_ORDERS,
  purchase_orders: INITIAL_PURCHASE_ORDERS,
  movements: INITIAL_MOVEMENTS,
  branch_demands: INITIAL_BRANCH_DEMANDS,
});

export const InventoryProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [sheetsConnection, setSheetsConnection] = useState<SheetsConnection>(() => loadConnection());
  const configured = isConfigured(sheetsConnection);

  // ถ้าเชื่อมต่อ Sheet แล้ว ใช้แคชล่าสุดระหว่างรอโหลด; ถ้ายังไม่เชื่อมต่อ ใช้ข้อมูลตัวอย่าง (โหมดทดลอง)
  const startSnapshot = (): DbSnapshot => (configured ? readCache() || {} : initialSnapshot());
  const [snap0] = useState<DbSnapshot>(startSnapshot);

  const [items, setItems] = useState<InventoryItem[]>(sortSnapshot.items(snap0.items || []));
  const [suppliers, setSuppliers] = useState<Supplier[]>(snap0.suppliers || []);
  const [branches, setBranches] = useState<Branch[]>(sortSnapshot.branches(snap0.branches || []));
  const [branchOrders, setBranchOrders] = useState<BranchOrder[]>(
    sortSnapshot.branchOrders(snap0.branch_orders || [])
  );
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>(
    sortSnapshot.purchaseOrders(snap0.purchase_orders || [])
  );
  const [movements, setMovements] = useState<StockMovement[]>(sortSnapshot.movements(snap0.movements || []));
  const [branchDemands, setBranchDemands] = useState<BranchMonthlyDemand[]>(snap0.branch_demands || []);

  const [sheetsSync, setSheetsSync] = useState<SheetsSyncState>({
    status: configured ? 'CONNECTING' : 'NOT_CONFIGURED',
    message: configured ? 'กำลังเชื่อมต่อ Google Sheet...' : 'ยังไม่ได้เชื่อมต่อ Google Sheet (โหมดทดลอง ข้อมูลจะไม่ถูกบันทึกถาวร)',
  });
  const [isCloudLoading, setIsCloudLoading] = useState<boolean>(configured);

  const itemsRef = useRef<InventoryItem[]>([]);
  itemsRef.current = items;
  const connRef = useRef(sheetsConnection);
  const revRef = useRef<number>(-1);
  const pendingWrites = useRef(0);
  const queueRef = useRef<Promise<unknown>>(Promise.resolve());
  const refreshing = useRef(false);

  useEffect(() => {
    connRef.current = sheetsConnection;
  }, [sheetsConnection]);

  const nowLabel = () =>
    new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  const applySnapshot = useCallback((data: DbSnapshot) => {
    setItems(sortSnapshot.items(data.items || []));
    setSuppliers(data.suppliers || []);
    setBranches(sortSnapshot.branches(data.branches || []));
    setBranchOrders(sortSnapshot.branchOrders(data.branch_orders || []));
    setPurchaseOrders(sortSnapshot.purchaseOrders(data.purchase_orders || []));
    setMovements(sortSnapshot.movements(data.movements || []));
    setBranchDemands(data.branch_demands || []);
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(data));
    } catch {
      /* แคชเต็มหรือใช้ไม่ได้ ไม่เป็นปัญหา */
    }
  }, []);

  /** ดึงข้อมูลล่าสุดจาก Google Sheet (ข้ามถ้าไม่มีอะไรเปลี่ยน เว้นแต่ force) */
  const refreshFromSheet = useCallback(
    async (force = true): Promise<boolean> => {
      const conn = connRef.current;
      if (!isConfigured(conn) || refreshing.current || pendingWrites.current > 0) return false;
      refreshing.current = true;
      try {
        const meta = await sheetsApi.meta(conn);
        if (!meta.seeded) {
          setSheetsSync((p) => ({ ...p, status: 'SYNCING', message: 'กำลังสร้างข้อมูลเริ่มต้นใน Google Sheet...' }));
          await sheetsApi.seed(conn, initialSnapshot());
        } else if (!force && meta.rev === revRef.current) {
          setSheetsSync({ status: 'ONLINE', lastSyncTime: nowLabel(), message: 'เชื่อมต่อ Google Sheet แล้ว' });
          return true;
        }
        const { meta: m2, data } = await sheetsApi.getAll(conn);
        if (pendingWrites.current > 0) return false; // มีการบันทึกใหม่แทรกเข้ามา ใช้ข้อมูลนี้ไม่ได้แล้ว
        revRef.current = m2.rev;
        applySnapshot(data);
        setSheetsSync({ status: 'ONLINE', lastSyncTime: nowLabel(), message: 'เชื่อมต่อ Google Sheet แล้ว' });
        return true;
      } catch (err: any) {
        setSheetsSync((p) => ({ ...p, status: 'ERROR', message: err?.message || 'เชื่อมต่อ Google Sheet ไม่สำเร็จ' }));
        return false;
      } finally {
        refreshing.current = false;
        setIsCloudLoading(false);
      }
    },
    [applySnapshot]
  );

  // โหลดครั้งแรก + ตรวจการเปลี่ยนแปลงเป็นระยะ (ให้ทุกเครื่องเห็นข้อมูลตรงกัน)
  useEffect(() => {
    if (!configured) {
      setIsCloudLoading(false);
      return;
    }
    revRef.current = -1;
    refreshFromSheet(true);
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') refreshFromSheet(false);
    }, POLL_INTERVAL_MS);
    const onVisible = () => {
      if (document.visibilityState === 'visible') refreshFromSheet(false);
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [configured, sheetsConnection.apiUrl, sheetsConnection.apiToken, refreshFromSheet]);

  /** ส่งการเปลี่ยนแปลงไป Google Sheet ทีละคิว (กันเขียนชนกันในเครื่องเดียวกัน) */
  const commit = useCallback(async (ops: DbOp[]): Promise<void> => {
    const conn = connRef.current;
    if (!isConfigured(conn) || ops.length === 0) return; // โหมดทดลอง: อัปเดตเฉพาะหน้าจอ
    pendingWrites.current += 1;
    setSheetsSync((p) => ({ ...p, status: 'SYNCING', message: 'กำลังบันทึกลง Google Sheet...' }));
    const task = queueRef.current.then(async () => {
      const res = await sheetsApi.apply(conn, ops);
      if (res.prevRev === revRef.current) revRef.current = res.rev; // ไม่มีใครแก้แทรก ไม่ต้องดึงซ้ำ
      else revRef.current = -1;
    });
    queueRef.current = task.catch(() => undefined);
    try {
      await task;
      setSheetsSync({ status: 'ONLINE', lastSyncTime: nowLabel(), message: 'บันทึกลง Google Sheet สำเร็จ' });
    } catch (err: any) {
      const message = err?.message || 'บันทึกลง Google Sheet ไม่สำเร็จ';
      setSheetsSync((p) => ({ ...p, status: 'ERROR', message }));
      throw new Error(message);
    } finally {
      pendingWrites.current -= 1;
    }
  }, []);

  const saveSheetsConnection = async (conn: SheetsConnection) => {
    const clean = { apiUrl: conn.apiUrl.trim(), apiToken: conn.apiToken.trim() };
    saveConnection(clean);
    connRef.current = clean;
    setSheetsConnection(clean);
    if (!isConfigured(clean)) {
      setSheetsSync({ status: 'NOT_CONFIGURED', message: 'ยังไม่ได้เชื่อมต่อ Google Sheet (โหมดทดลอง ข้อมูลจะไม่ถูกบันทึกถาวร)' });
    } else {
      setSheetsSync({ status: 'CONNECTING', message: 'กำลังเชื่อมต่อ Google Sheet...' });
      setIsCloudLoading(true);
    }
  };

  const testSheetsConnection = async (conn: SheetsConnection) => {
    if (!isConfigured(conn)) return { ok: false, message: 'กรุณากรอกทั้ง Web App URL และ API Token' };
    try {
      const meta = await sheetsApi.meta({ apiUrl: conn.apiUrl.trim(), apiToken: conn.apiToken.trim() });
      const total = Object.values(meta.counts).reduce((a, b) => a + b, 0);
      return { ok: true, message: `เชื่อมต่อสำเร็จ — พบข้อมูลในชีต ${total} แถว${meta.seeded ? '' : ' (ยังไม่เคยสร้างข้อมูลเริ่มต้น จะสร้างให้อัตโนมัติ)'}` };
    } catch (err: any) {
      return { ok: false, message: err?.message || 'เชื่อมต่อไม่สำเร็จ' };
    }
  };

  // Derived low stock items
  const lowStockItems = items.filter((item) => item.currentStockHQ <= item.minStockThreshold);

  const upsert = (collection: CollectionName, record: { id: string }, merge = false): DbOp => ({
    op: 'upsert',
    collection,
    id: record.id,
    data: record,
    merge,
  });

  // ================= SUPPLIER ACTIONS =================
  const addSupplier = async (data: Omit<Supplier, 'id'>) => {
    const sup: Supplier = { ...data, id: `SUP-${Date.now().toString().slice(-6)}` };
    await commit([upsert('suppliers', sup)]);
    setSuppliers((prev) => [...prev, sup]);
  };

  const updateSupplier = async (sup: Supplier) => {
    await commit([upsert('suppliers', sup, true)]);
    setSuppliers((prev) => prev.map((x) => (x.id === sup.id ? sup : x)));
  };

  const deleteSupplier = async (id: string) => {
    await commit([{ op: 'delete', collection: 'suppliers', id }]);
    setSuppliers((prev) => prev.filter((x) => x.id !== id));
  };

  // ================= BRANCH MANAGEMENT ACTIONS =================
  const addBranch = async (branchData: Omit<Branch, 'id'>) => {
    const newBranch: Branch = {
      ...branchData,
      id: `BR-${Date.now().toString().slice(-4)}`,
    };

    await commit([upsert('branches', newBranch)]);
    setBranches((prev) => sortSnapshot.branches([...prev, newBranch]));
  };

  const updateBranch = async (updatedBranch: Branch) => {
    await commit([upsert('branches', updatedBranch, true)]);
    setBranches((prev) => prev.map((b) => (b.id === updatedBranch.id ? updatedBranch : b)));
  };

  const deleteBranch = async (id: string) => {
    await commit([{ op: 'delete', collection: 'branches', id }]);
    setBranches((prev) => prev.filter((b) => b.id !== id));
  };

  // ================= INVENTORY ITEMS ACTIONS =================
  const addItem = async (itemData: Omit<InventoryItem, 'id'>) => {
    const newItem: InventoryItem = {
      ...itemData,
      id: `ITEM-${Date.now().toString().slice(-4)}`,
    };

    await commit([upsert('items', newItem)]);
    setItems((prev) => [...prev, newItem]);
  };

  const updateItem = async (updated: InventoryItem) => {
    await commit([upsert('items', updated, true)]);
    setItems((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
  };

  const deleteItem = async (id: string) => {
    await commit([{ op: 'delete', collection: 'items', id }]);
    setItems((prev) => prev.filter((item) => item.id !== id));
  };

  const adjustStock = async (
    itemId: string,
    delta: number,
    type: 'IN_SUPPLIER' | 'OUT_BRANCH' | 'ADJUSTMENT',
    referenceNo: string = '-',
    notes: string = ''
  ) => {
    const targetItem = itemsRef.current.find((i) => i.id === itemId);
    if (!targetItem) return;

    const newQty = Math.max(0, targetItem.currentStockHQ + delta);
    const updatedItem = { ...targetItem, currentStockHQ: newQty };
    // อัปเดต ref ทันที เพื่อให้การเรียกต่อเนื่อง (รับเข้า → จ่ายออก) คำนวณจากยอดล่าสุด
    itemsRef.current = itemsRef.current.map((it) => (it.id === itemId ? updatedItem : it));

    const newMovement: StockMovement = {
      id: `MOV-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      date: new Date().toISOString().split('T')[0],
      itemId: targetItem.id,
      itemName: targetItem.name,
      type,
      quantity: Math.abs(delta),
      balanceAfter: newQty,
      branchOrSupplierName: referenceNo,
      referenceNo,
      notes,
    };

    await commit([
      { op: 'upsert', collection: 'items', id: itemId, data: { currentStockHQ: newQty }, merge: true },
      upsert('movements', newMovement),
    ]);

    setItems((prev) => prev.map((it) => (it.id === itemId ? updatedItem : it)));
    setMovements((mPrev) => [newMovement, ...mPrev]);
  };

  // ================= BRANCH DELIVERY ORDERS ACTIONS =================
  const createBranchOrder = async (
    orderData: Omit<BranchOrder, 'id' | 'deliveryOrderNo' | 'routingType' | 'totalAmount' | 'status'> & {
      routingTypeOverride?: RoutingType;
    }
  ): Promise<BranchOrder> => {
    const totalAmount = orderData.items.reduce(
      (sum, item) => sum + item.quantity * item.unitPrice,
      0
    );

    const calculatedRouting: RoutingType = totalAmount >= 5000 ? 'SUPPLIER_DIRECT' : 'HQ_DELIVERY';
    const routingType = orderData.routingTypeOverride || calculatedRouting;

    const count = branchOrders.length + 1;
    const dateStr = new Date().toISOString().slice(2, 7).replace('-', '');
    const deliveryOrderNo = `DO-${dateStr}-${String(count).padStart(3, '0')}`;

    // routingTypeOverride เป็นค่าชั่วคราวสำหรับคำนวณ ไม่ต้องเก็บลงชีต
    const { routingTypeOverride: _ignored, ...rest } = orderData;
    const newOrder: BranchOrder = {
      ...rest,
      id: `BO-${Date.now()}`,
      deliveryOrderNo,
      totalAmount,
      routingType,
      status: 'PENDING',
    };

    await commit([upsert('branch_orders', newOrder)]);
    setBranchOrders((prev) => [newOrder, ...prev]);
    return newOrder;
  };

  const supplierLabel = (o: BranchOrder) =>
    suppliers.find((x) => x.id === o.supplierId)?.name || suppliers[0]?.name || 'Supplier';

  /**
   * ลงบัญชีสต็อกของใบส่งของ
   * - รวมส่งที่ สนง.ใหญ่: ของเข้าคลังตอนรับ PO อยู่แล้ว → ลงรายการจ่ายออกไปสาขา
   * - Supplier ส่งตรงสาขา: ลงรายการ "รับเข้า" (ตรวจรับ/จ่ายเงิน) แล้ว "จ่ายออก" ไปสาขาทันที ยอดคงเหลือเท่าเดิมแต่มีประวัติครบ
   * dir = 1 ตอนยืนยันส่ง, dir = -1 ตอนยกเลิก/ลบ (ย้อนรายการ)
   */
  const postDeliveryStock = async (order: BranchOrder, dir: 1 | -1, factor: number = 1) => {
    const direct = order.routingType === 'SUPPLIER_DIRECT';
    for (const it of order.items) {
      const q = it.quantity * factor;
      if (!q) continue;
      if (dir === 1) {
        if (direct) {
          await adjustStock(it.itemId, q, 'IN_SUPPLIER', order.deliveryOrderNo, `รับเข้าจาก ${supplierLabel(order)} (ส่งตรงสาขา ${order.branchName})`);
        }
        await adjustStock(it.itemId, -q, 'OUT_BRANCH', order.deliveryOrderNo, `จัดส่งถึง ${order.branchName}`);
      } else {
        await adjustStock(it.itemId, q, 'ADJUSTMENT', order.deliveryOrderNo, `ยกเลิก/แก้ไขใบส่งของ ${order.deliveryOrderNo} คืนรายการจ่ายออก`);
        if (direct) {
          await adjustStock(it.itemId, -q, 'ADJUSTMENT', order.deliveryOrderNo, `ยกเลิก/แก้ไขใบส่งของ ${order.deliveryOrderNo} ย้อนรายการรับเข้า`);
        }
      }
    }
  };

  const reconcileDeliveredOrder = async (before: BranchOrder, after: BranchOrder) => {
    if (before.status !== 'DELIVERED') return;
    if (before.routingType !== after.routingType) {
      await postDeliveryStock(before, -1);
      await postDeliveryStock(after, 1);
      return;
    }
    const sum = (o: BranchOrder) => {
      const m = new Map<string, OrderItemDetail>();
      o.items.forEach((it) => {
        const cur = m.get(it.itemId);
        m.set(it.itemId, cur ? { ...cur, quantity: cur.quantity + it.quantity } : { ...it });
      });
      return m;
    };
    const b = sum(before);
    const a = sum(after);
    for (const id of new Set([...b.keys(), ...a.keys()])) {
      const delta = (a.get(id)?.quantity || 0) - (b.get(id)?.quantity || 0);
      if (delta === 0) continue;
      const ref = a.get(id) || b.get(id)!;
      const one = { ...after, items: [{ ...ref, quantity: Math.abs(delta) }] };
      await postDeliveryStock(one, delta > 0 ? 1 : -1);
    }
  };

  const markPOPayment = async (id: string, paid: boolean, paymentRef?: string) => {
    const patch = paid
      ? { paymentStatus: 'PAID' as const, paidAt: new Date().toISOString().split('T')[0], paymentRef: paymentRef || '' }
      : { paymentStatus: 'UNPAID' as const, paidAt: '', paymentRef: '' };
    await commit([{ op: 'upsert', collection: 'purchase_orders', id, data: patch, merge: true }]);
    setPurchaseOrders((prev) => prev.map((o) => (o.id === id ? { ...o, ...patch } : o)));
  };

  const markOrderPayment = async (id: string, paid: boolean, paymentRef?: string) => {
    const patch = paid
      ? { paymentStatus: 'PAID' as const, paidAt: new Date().toISOString().split('T')[0], paymentRef: paymentRef || '' }
      : { paymentStatus: 'UNPAID' as const, paidAt: '', paymentRef: '' };
    await commit([{ op: 'upsert', collection: 'branch_orders', id, data: patch, merge: true }]);
    setBranchOrders((prev) => prev.map((o) => (o.id === id ? { ...o, ...patch } : o)));
  };

  const updateBranchOrderStatus = async (id: string, status: BranchOrderStatus) => {
    const order = branchOrders.find((o) => o.id === id);
    if (!order) return;

    // ยืนยันส่งแล้ว: ทุกใบต้องผ่านบัญชีสต็อก (รับเข้า-จ่ายออก) เพื่อควบคุมปริมาณและงบประมาณ
    if (status === 'DELIVERED' && order.status !== 'DELIVERED') {
      await postDeliveryStock(order, 1);
    }
    // ยกเลิกการยืนยันส่ง: ย้อนรายการรับเข้า/จ่ายออกที่ลงไว้
    if (order.status === 'DELIVERED' && status !== 'DELIVERED') {
      await postDeliveryStock(order, -1);
    }

    await commit([
      { op: 'upsert', collection: 'branch_orders', id, data: { status }, merge: true },
    ]);
    setBranchOrders((prev) => prev.map((o) => (o.id === id ? { ...o, status } : o)));
  };

  const updateBranchOrder = async (updatedOrder: BranchOrder) => {
    await commit([upsert('branch_orders', updatedOrder, true)]);
    setBranchOrders((prev) => prev.map((o) => (o.id === updatedOrder.id ? updatedOrder : o)));
  };

  const deleteBranchOrder = async (id: string, restoreStock: boolean = true) => {
    const orderToDelete = branchOrders.find((o) => o.id === id);
    if (!orderToDelete) return;

    if (restoreStock && orderToDelete.status === 'DELIVERED') {
      await postDeliveryStock(orderToDelete, -1);
    }

    await commit([{ op: 'delete', collection: 'branch_orders', id }]);
    setBranchOrders((prev) => prev.filter((o) => o.id !== id));
  };

  // ================= PURCHASE ORDERS ACTIONS =================
  const createPurchaseOrder = async (
    poData: Omit<PurchaseOrder, 'id' | 'poNumber' | 'totalAmount' | 'minAmountMet' | 'status'>
  ): Promise<PurchaseOrder> => {
    const totalAmount = poData.items.reduce(
      (sum, item) => sum + item.quantity * item.unitPrice,
      0
    );

    const minAmountMet = totalAmount >= 5000;
    const count = purchaseOrders.length + 1;
    const dateStr = new Date().toISOString().slice(2, 7).replace('-', '');
    const poNumber = `PO-${dateStr}-${String(count).padStart(3, '0')}`;

    const newPO: PurchaseOrder = {
      ...poData,
      id: `PO-${Date.now()}`,
      poNumber,
      totalAmount,
      minAmountMet,
      status: 'ORDERED',
    };

    await commit([upsert('purchase_orders', newPO)]);
    setPurchaseOrders((prev) => [newPO, ...prev]);
    return newPO;
  };

  const updatePOStatus = async (id: string, status: POStatus) => {
    const po = purchaseOrders.find((p) => p.id === id);
    if (!po) return;

    if (status === 'RECEIVED' && po.status !== 'RECEIVED' && po.destination === 'HQ_WAREHOUSE') {
      for (const item of po.items) {
        await adjustStock(
          item.itemId,
          item.quantity,
          'IN_SUPPLIER',
          po.poNumber,
          `รับสินค้าเข้าคลัง สนง.ใหญ่ จาก ${po.supplierName}`
        );
      }
    }

    await commit([{ op: 'upsert', collection: 'purchase_orders', id, data: { status }, merge: true }]);
    setPurchaseOrders((prev) => prev.map((p) => (p.id === id ? { ...p, status } : p)));
  };

  // ================= DEMAND & QUOTA ACTIONS =================
  const setBranchDemand = async (
    branchId: string,
    itemId: string,
    monthlyQuota: number,
    notes?: string
  ) => {
    const record: BranchMonthlyDemand = { branchId, itemId, monthlyQuota, notes };
    const id = demandId(record);

    await commit([{ op: 'upsert', collection: 'branch_demands', id, data: { ...record, id }, merge: true }]);
    setBranchDemands((prev) => {
      const idx = prev.findIndex((d) => d.branchId === branchId && d.itemId === itemId);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = record;
        return copy;
      }
      return [...prev, record];
    });
  };

  const batchUpdateBranchDemands = async (demands: BranchMonthlyDemand[]) => {
    await commit(
      demands.map((d) => ({
        op: 'upsert' as const,
        collection: 'branch_demands' as const,
        id: demandId(d),
        data: { ...d, id: demandId(d) },
        merge: true,
      }))
    );

    setBranchDemands((prev) => {
      const map = new Map<string, BranchMonthlyDemand>();
      prev.forEach((d) => map.set(demandId(d), d));
      demands.forEach((d) => map.set(demandId(d), d));
      return Array.from(map.values());
    });
  };

  const getBranchMonthlyDemand = (branchId: string, itemId: string): number => {
    const found = branchDemands.find((d) => d.branchId === branchId && d.itemId === itemId);
    return found ? found.monthlyQuota : 0;
  };

  const getBranchDeliveredThisMonth = (branchId: string, itemId: string, yearMonth?: string): number => {
    const ym = yearMonth || new Date().toISOString().slice(0, 7);
    return branchOrders
      .filter((o) => o.branchId === branchId && o.date.startsWith(ym))
      .reduce((sum, o) => {
        const matchItem = o.items.find((it) => it.itemId === itemId);
        return sum + (matchItem ? matchItem.quantity : 0);
      }, 0);
  };

  const getBranchDemandSummaries = (branchIdFilter?: string, yearMonth?: string): BranchDemandSummary[] => {
    const ym = yearMonth || new Date().toISOString().slice(0, 7);
    const targetBranches = branchIdFilter
      ? branches.filter((b) => b.id === branchIdFilter)
      : branches;

    const summaries: BranchDemandSummary[] = [];

    targetBranches.forEach((branch) => {
      items.forEach((item) => {
        const quota = getBranchMonthlyDemand(branch.id, item.id);
        const delivered = getBranchDeliveredThisMonth(branch.id, item.id, ym);

        if (quota > 0 || delivered > 0) {
          const remaining = Math.max(0, quota - delivered);
          const percent = quota > 0 ? Math.round((delivered / quota) * 100) : 100;
          let status: 'COMPLETED' | 'ON_TRACK' | 'PENDING' | 'OVER_QUOTA' = 'PENDING';
          if (delivered > quota && quota > 0) {
            status = 'OVER_QUOTA';
          } else if (percent >= 100) {
            status = 'COMPLETED';
          } else if (percent >= 40) {
            status = 'ON_TRACK';
          }

          summaries.push({
            branchId: branch.id,
            branchName: branch.name,
            itemId: item.id,
            itemName: item.name,
            unit: item.unit,
            monthlyQuota: quota,
            deliveredThisMonth: delivered,
            remainingQuota: remaining,
            fulfillmentPercent: percent,
            status,
          });
        }
      });
    });

    return summaries;
  };

  const calculateProcurementDeficitFromDemand = () => {
    const ym = new Date().toISOString().slice(0, 7);
    const supplier = suppliers[0] || INITIAL_SUPPLIERS[0];
    const minOrderAmount = supplier?.minOrderAmount || 5000;

    const deficits = items
      .map((item) => {
        const totalMonthlyQuota = branches.reduce(
          (sum, br) => sum + getBranchMonthlyDemand(br.id, item.id),
          0
        );
        const totalDeliveredThisMonth = branches.reduce(
          (sum, br) => sum + getBranchDeliveredThisMonth(br.id, item.id, ym),
          0
        );
        const remainingBranchDemand = branches.reduce((sum, br) => {
          const q = getBranchMonthlyDemand(br.id, item.id);
          const del = getBranchDeliveredThisMonth(br.id, item.id, ym);
          return sum + Math.max(0, q - del);
        }, 0);

        const netDeficitQty = Math.max(0, remainingBranchDemand - item.currentStockHQ);
        const subtotalCost = netDeficitQty * item.unitPrice;

        return {
          item,
          totalMonthlyQuota,
          totalDeliveredThisMonth,
          remainingBranchDemand,
          currentStockHQ: item.currentStockHQ,
          netDeficitQty,
          subtotalCost,
        };
      })
      .filter((d) => d.remainingBranchDemand > 0 || d.currentStockHQ <= d.item.minStockThreshold);

    const itemsNeedingPurchase = deficits.filter((d) => d.netDeficitQty > 0);
    const totalOrderAmount = itemsNeedingPurchase.reduce((sum, d) => sum + d.subtotalCost, 0);
    const isMinMet = totalOrderAmount >= minOrderAmount;
    const differenceToMin = Math.max(0, minOrderAmount - totalOrderAmount);

    return {
      deficits,
      totalOrderAmount,
      minOrderAmount,
      isMinMet,
      differenceToMin,
      supplier,
    };
  };

  const calculateReorderSuggestion = (supplierId: string) => {
    const supplier = suppliers.find((s) => s.id === supplierId) || suppliers[0];
    const minAmount = supplier?.minOrderAmount || 5000;

    const supplierItems = items.filter((item) => item.supplierId === supplierId || !item.supplierId);
    const criticalItems = supplierItems.filter(
      (item) => item.currentStockHQ <= item.minStockThreshold
    );

    const suggestedItems = criticalItems.map((item) => {
      const suggestedQty = item.reorderQuantity || Math.max(1, item.minStockThreshold * 2 - item.currentStockHQ);
      const subtotal = suggestedQty * item.unitPrice;
      return { item, suggestedQty, subtotal };
    });

    const totalAmount = suggestedItems.reduce((acc, curr) => acc + curr.subtotal, 0);
    const differenceToMin = Math.max(0, minAmount - totalAmount);
    const isMinMet = totalAmount >= minAmount;

    return {
      suggestedItems,
      totalAmount,
      minAmount,
      differenceToMin,
      isMinMet,
    };
  };
  const resetToDefaultData = async () => {
    const seed = initialSnapshot();
    await commit(
      (Object.keys(seed) as CollectionName[]).map((collection) => ({
        op: 'replace' as const,
        collection,
        records: (seed[collection] || []).map((r: any) => ({
          ...r,
          id: collection === 'branch_demands' ? demandId(r) : r.id,
        })),
      }))
    );

    setItems(INITIAL_ITEMS);
    setSuppliers(INITIAL_SUPPLIERS);
    setBranches(INITIAL_BRANCHES);
    setBranchOrders(INITIAL_BRANCH_ORDERS);
    setPurchaseOrders(INITIAL_PURCHASE_ORDERS);
    setMovements(INITIAL_MOVEMENTS);
    setBranchDemands(INITIAL_BRANCH_DEMANDS);
  };

  return (
    <InventoryContext.Provider
      value={{
        items,
        suppliers,
        branches,
        branchOrders,
        purchaseOrders,
        movements,
        lowStockItems,
        branchDemands,
        sheetsConnection,
        sheetsSync,
        isSheetsConfigured: configured,
        isCloudLoading,
        saveSheetsConnection,
        refreshFromSheet: () => refreshFromSheet(true),
        testSheetsConnection,
        addSupplier,
        updateSupplier,
        deleteSupplier,
        addBranch,
        updateBranch,
        deleteBranch,
        addItem,
        updateItem,
        deleteItem,
        adjustStock,
        createBranchOrder,
        updateBranchOrderStatus,
        markOrderPayment,
        markPOPayment,
        reconcileDeliveredOrder,
        updateBranchOrder,
        deleteBranchOrder,
        createPurchaseOrder,
        updatePOStatus,
        resetToDefaultData,
        calculateReorderSuggestion,
        setBranchDemand,
        batchUpdateBranchDemands,
        getBranchMonthlyDemand,
        getBranchDeliveredThisMonth,
        getBranchDemandSummaries,
        calculateProcurementDeficitFromDemand,
      }}
    >
      {children}
    </InventoryContext.Provider>
  );
};

export const useInventory = () => {
  const context = useContext(InventoryContext);
  if (!context) {
    throw new Error('useInventory must be used within an InventoryProvider');
  }
  return context;
};
