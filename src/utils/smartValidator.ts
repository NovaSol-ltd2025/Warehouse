import { InventoryItem, OrderItemDetail, SmartCheckResult } from '../types/inventory';

/**
 * Smart Validation & Loss Prevention Engine for NOVASOL Warehouse
 */
export const analyzeBranchRequisition = (
  branchId: string,
  branchName: string,
  orderItems: { itemId: string; itemName: string; quantity: number; unitPrice: number }[],
  allCatalogItems: InventoryItem[]
): SmartCheckResult => {
  const warnings: SmartCheckResult['warnings'] = [];

  orderItems.forEach((orderItem) => {
    const catalogItem = allCatalogItems.find((i) => i.id === orderItem.itemId);
    if (!catalogItem) return;

    // 1. Branch-specific compatibility & notes check
    if (catalogItem.branchSpecificNotes && catalogItem.branchSpecificNotes[branchId]) {
      const specificNote = catalogItem.branchSpecificNotes[branchId];
      if (specificNote.includes('🛑') || specificNote.includes('⚠️') || specificNote.includes('เท่านั้น')) {
        warnings.push({
          type: 'BRANCH_MISMATCH',
          itemId: catalogItem.id,
          itemName: catalogItem.name,
          title: `กฎเฉพาะของสาขา ${branchName}`,
          message: specificNote,
          severity: 'warning',
          suggestedAction: 'ตรวจสอบสเปก/สี/กลิ่นของสินค้าก่อนส่งเพื่อไม่ให้สาขาปฏิเสธการรับของ',
        });
      }
    }

    // 2. Allowed branches check
    if (
      catalogItem.allowedBranchIds &&
      catalogItem.allowedBranchIds.length > 0 &&
      !catalogItem.allowedBranchIds.includes(branchId)
    ) {
      warnings.push({
        type: 'BRANCH_MISMATCH',
        itemId: catalogItem.id,
        itemName: catalogItem.name,
        title: 'สาขาปลายทางไม่ได้ลงทะเบียนสำหรับสูตร/สินค้านี้',
        message: `สินค้านี้มีสเปกเฉพาะที่ลงทะเบียนไว้สำหรับสาขาอื่น โปรดยืนยันว่าสาขา ${branchName} ใช้งานสินค้านี้จริงหรือไม่`,
        severity: 'danger',
        suggestedAction: 'ตรวจสอบกับหัวหน้าสาขาก่อนจัดส่ง',
      });
    }

    // 3. Similar name confusion risk (e.g. Soap Pearl Blue vs Pink, or Floor Cleaner Lavender vs Super Fresh)
    const similarItems = allCatalogItems.filter(
      (other) =>
        other.id !== catalogItem.id &&
        other.category === catalogItem.category &&
        (other.name.includes(catalogItem.name.slice(0, 15)) ||
          catalogItem.name.includes(other.name.slice(0, 15)))
    );

    if (similarItems.length > 0) {
      const variantDesc = catalogItem.variantSpec
        ? [catalogItem.variantSpec.color, catalogItem.variantSpec.scent, catalogItem.variantSpec.size]
            .filter(Boolean)
            .join(', ')
        : '';

      if (variantDesc) {
        warnings.push({
          type: 'SPEC_CONFUSION',
          itemId: catalogItem.id,
          itemName: catalogItem.name,
          title: `ระวังส่งสเปกผิด: รายการนี้มีรุ่นคล้ายกันในคลัง`,
          message: `สินค้านี้คือสูตร [${variantDesc}] โปรดสังเกตรูปภาพและป้ายบรรจุภัณฑ์ให้ตรงกับที่สาขาต้องการ`,
          severity: 'info',
        });
      }
    }

    // 4. Price volatility & margin guard check
    if (catalogItem.baselinePrice && catalogItem.unitPrice > catalogItem.baselinePrice) {
      const increaseAmount = catalogItem.unitPrice - catalogItem.baselinePrice;
      const increasePercent = (increaseAmount / catalogItem.baselinePrice) * 100;

      if (increasePercent >= 8) {
        warnings.push({
          type: 'PRICE_SPIKE',
          itemId: catalogItem.id,
          itemName: catalogItem.name,
          title: `แจ้งเตือนต้นทุนปรับขึ้น +${increasePercent.toFixed(1)}%`,
          message: `ราคาสินค้านี้เพิ่มขึ้นจากราคาฐานเดิม ${catalogItem.baselinePrice.toLocaleString()} ฿ เป็น ${catalogItem.unitPrice.toLocaleString()} ฿ (+${increaseAmount.toLocaleString()} ฿/หน่วย) โปรดระมัดระวังการตั้งงบประมาณ`,
          severity: 'warning',
          suggestedAction: 'ตรวจสอบใบเสนอราคาล่าสุดจาก Supplier หรือสั่งซื้อเท่าที่จำเป็น',
        });
      }
    }
  });

  return {
    hasWarning: warnings.length > 0,
    warnings,
  };
};

/**
 * Check monthly quota limits during requisition
 */
export const checkMonthlyQuotaWarning = (
  branchId: string,
  branchName: string,
  itemId: string,
  itemName: string,
  unit: string,
  requestedQty: number,
  monthlyQuota: number,
  alreadyDeliveredThisMonth: number
): SmartCheckResult['warnings'][0] | null => {
  if (monthlyQuota <= 0) return null;
  const remainingQuota = Math.max(0, monthlyQuota - alreadyDeliveredThisMonth);

  if (requestedQty > remainingQuota) {
    const excess = requestedQty - remainingQuota;
    return {
      type: 'OVER_QUOTA',
      itemId,
      itemName,
      title: `แจ้งเตือนขอเบิกเกินโควตารายเดือนของสาขา ${branchName}`,
      message: `โควตารายเดือนคือ ${monthlyQuota} ${unit} (ส่งไปแล้ว ${alreadyDeliveredThisMonth} ${unit}, โควตาคงเหลือ ${remainingQuota} ${unit}) แต่ครั้งนี้ขอเบิก ${requestedQty} ${unit} ซึ่งเกินโควตา ${excess} ${unit}`,
      severity: 'warning',
      suggestedAction: `แนะนำปรับลดจำนวนให้เหลือ ${remainingQuota} ${unit} หรือยืนยันขออนุมัติพิเศษ`,
    };
  }

  return null;
};

/**
 * Check single item price trend
 */
export const getPriceTrend = (item: InventoryItem) => {
  if (!item.baselinePrice) return { status: 'STABLE', percent: 0, diff: 0 };
  const diff = item.unitPrice - item.baselinePrice;
  const percent = (diff / item.baselinePrice) * 100;

  if (percent > 3) {
    return { status: 'UP', percent: Math.round(percent * 10) / 10, diff };
  } else if (percent < -3) {
    return { status: 'DOWN', percent: Math.round(percent * 10) / 10, diff };
  }
  return { status: 'STABLE', percent: 0, diff: 0 };
};
