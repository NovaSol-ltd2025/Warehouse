export type ItemCategory =
  | 'ขยะและถุง'
  | 'น้ำยาและเคมีภัณฑ์'
  | 'อุปกรณ์ทำความสะอาด'
  | 'กระดาษชำระ'
  | 'เครื่องแต่งกายและอื่นๆ';

export interface PriceHistoryRecord {
  date: string;
  price: number;
  supplierName: string;
  note?: string;
}

export interface InventoryItem {
  id: string;
  code: string;
  name: string;
  category: ItemCategory;
  unit: string;
  unitPrice: number;
  baselinePrice: number; // Historical benchmark price to detect fluctuations
  priceHistory?: PriceHistoryRecord[];
  currentStockHQ: number;
  minStockThreshold: number;
  reorderQuantity: number;
  leadTimeDays: number; // e.g. 7 days
  dailyUsage: number;
  supplierId: string;
  imageUrl?: string;
  imageDriveId?: string;
  variantSpec?: {
    color?: string;
    scent?: string;
    size?: string;
    brand?: string;
    packageType?: string;
    material?: string;
  };
  allowedBranchIds?: string[]; // Specific branches authorized/dedicated to this item
  branchSpecificNotes?: { [branchId: string]: string }; // Warnings & instructions per branch
  notes?: string;
}

export interface Supplier {
  id: string;
  name: string;
  contactPerson: string;
  phone: string;
  email: string;
  address: string;
  minOrderAmount: number; // 5,000 THB
  deliveryLeadTime: number; // 7 days
  notes?: string;
}

export interface Branch {
  id: string;
  name: string;
  code: string;
  address: string;
  contactPerson: string;
  phone: string;
  defaultRecipientName?: string;
}

export type RoutingType = 'HQ_DELIVERY' | 'SUPPLIER_DIRECT';

export type BranchOrderStatus =
  | 'PENDING'
  | 'APPROVED'
  | 'PREPARING'
  | 'IN_TRANSIT'
  | 'DELIVERED';

export interface OrderItemDetail {
  itemId: string;
  itemName: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  historicalPrice?: number;
  imageUrl?: string;
  remark?: string;
}

export interface BranchOrder {
  id: string;
  deliveryOrderNo: string; // e.g. DO-202610-001
  branchId: string;
  branchName: string;
  date: string;
  items: OrderItemDetail[];
  totalAmount: number;
  routingType: RoutingType;
  status: BranchOrderStatus;
  deliveryDate?: string;
  receiverName?: string;
  senderName?: string;
  senderSignatureUrl?: string;
  receiverSignatureUrl?: string;
  senderSignedAt?: string;
  receiverSignedAt?: string;
  supplierId?: string;
  notes?: string;
  paymentStatus?: 'UNPAID' | 'PAID'; // การจ่ายเงินให้ Supplier / ค่าสินค้าของใบนี้
  paidAt?: string;
  paymentRef?: string;
  smartWarnings?: string[]; // Smart warnings detected for this order
}

export type POStatus = 'DRAFT' | 'ORDERED' | 'IN_TRANSIT' | 'RECEIVED';

export interface PurchaseOrder {
  id: string;
  poNumber: string;
  supplierId: string;
  supplierName: string;
  orderDate: string;
  expectedDeliveryDate: string; // 7 days from order date
  destination: 'HQ_WAREHOUSE' | 'DIRECT_BRANCH';
  targetBranchId?: string;
  targetBranchName?: string;
  items: OrderItemDetail[];
  totalAmount: number;
  minAmountMet: boolean; // >= 5000
  status: POStatus;
  notes?: string;
  smartPriceWarnings?: string[]; // Price increase alerts
  paymentStatus?: 'UNPAID' | 'PAID';
  paidAt?: string;
  paymentRef?: string;
}

export interface StockMovement {
  id: string;
  date: string;
  itemId: string;
  itemName: string;
  type: 'IN_SUPPLIER' | 'OUT_BRANCH' | 'ADJUSTMENT';
  quantity: number;
  balanceAfter: number;
  branchOrSupplierName: string;
  referenceNo: string;
  notes?: string;
}

export interface BranchMonthlyDemand {
  branchId: string;
  itemId: string;
  monthlyQuota: number; // ปริมาณความต้องการต่อเดือน เช่น 50 แพ็ค
  notes?: string;
}

export interface BranchDemandSummary {
  branchId: string;
  branchName: string;
  itemId: string;
  itemName: string;
  unit: string;
  monthlyQuota: number;
  deliveredThisMonth: number;
  remainingQuota: number;
  fulfillmentPercent: number;
  status: 'COMPLETED' | 'ON_TRACK' | 'PENDING' | 'OVER_QUOTA';
}

export interface SmartCheckResult {
  hasWarning: boolean;
  warnings: {
    type: 'PRICE_SPIKE' | 'BRANCH_MISMATCH' | 'SPEC_CONFUSION' | 'OVER_ORDER' | 'OVER_QUOTA';
    itemId: string;
    itemName: string;
    title: string;
    message: string;
    severity: 'danger' | 'warning' | 'info';
    suggestedAction?: string;
  }[];
}

export type SyncStatus = 'NOT_CONFIGURED' | 'CONNECTING' | 'ONLINE' | 'SYNCING' | 'ERROR';

/** สถานะการเชื่อมต่อฐานข้อมูล Google Sheet */
export interface SheetsSyncState {
  status: SyncStatus;
  lastSyncTime?: string;
  message?: string;
}

export interface OrderComparisonItem {
  itemId: string;
  itemName: string;
  unit: string;
  unitPrice: number;
  previousQty: number;
  currentQty: number;
  diffQty: number;
  percentChange: number;
  status: 'INCREASED' | 'DECREASED' | 'SAME' | 'NEW_ITEM' | 'MISSING_FROM_PREV';
  remark?: string;
}
