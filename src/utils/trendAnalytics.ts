import { InventoryItem, BranchOrder, StockMovement, Branch } from '../types/inventory';

export interface ItemUsageTrend {
  itemId: string;
  item: InventoryItem;
  currentStockHQ: number;
  minThreshold: number;

  // Consumption numbers
  thisMonthUsage: number;
  lastMonthUsage: number;
  twoMonthsAgoUsage: number;
  totalUsage30Days: number;
  dailyBurnRate: number; // units/day
  weeklyUsage: number;

  // Trend indicator
  trendPercent: number; // e.g. +24.5%
  trendDirection: 'SURGE' | 'INCREASING' | 'STABLE' | 'DECREASING';

  // Runout prediction
  runoutDays: number; // Days until stock reaches 0
  runoutStatus: 'CRITICAL' | 'WARNING' | 'HEALTHY' | 'SURPLUS';
  suggestedSafetyStock: number;
  projectedNextMonthDemand: number;

  // Branch breakdown
  branchUsage: {
    branchId: string;
    branchName: string;
    quantity: number;
    percentage: number;
  }[];
  topBranchName?: string;
  topBranchPercentage?: number;
}

/**
 * Calculates item consumption and usage trends across branches and time periods
 */
export const calculateItemUsageTrends = (
  items: InventoryItem[],
  branchOrders: BranchOrder[],
  branches: Branch[],
  movements: StockMovement[] = []
): ItemUsageTrend[] => {
  const now = new Date();
  const currentYm = now.toISOString().slice(0, 7);

  // Calculate previous month string (YYYY-MM)
  const prevDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const prevYm = prevDate.toISOString().slice(0, 7);

  // Two months ago
  const twoPrevDate = new Date(now.getFullYear(), now.getMonth() - 2, 1);
  const twoPrevYm = twoPrevDate.toISOString().slice(0, 7);

  // Thirty days ago timestamp
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  return items.map((item) => {
    let thisMonthQty = 0;
    let lastMonthQty = 0;
    let twoMonthsAgoQty = 0;
    let last30DaysQty = 0;

    const branchQtyMap = new Map<string, number>();

    // Scan branch orders
    branchOrders.forEach((order) => {
      // Exclude cancelled/empty
      const orderItem = order.items.find((it) => it.itemId === item.id);
      if (!orderItem) return;

      const qty = Number(orderItem.quantity) || 0;

      // Group by date period
      if (order.date.startsWith(currentYm)) {
        thisMonthQty += qty;
      } else if (order.date.startsWith(prevYm)) {
        lastMonthQty += qty;
      } else if (order.date.startsWith(twoPrevYm)) {
        twoMonthsAgoQty += qty;
      }

      if (order.date >= thirtyDaysAgo) {
        last30DaysQty += qty;
      }

      // Track by branch
      const curBranchTotal = branchQtyMap.get(order.branchId) || 0;
      branchQtyMap.set(order.branchId, curBranchTotal + qty);
    });

    // Also factor in movements OUT_BRANCH if orders were not populated
    if (thisMonthQty === 0 && movements.length > 0) {
      movements.forEach((m) => {
        if (m.itemId === item.id && m.type === 'OUT_BRANCH') {
          if (m.date.startsWith(currentYm)) {
            thisMonthQty += m.quantity;
          } else if (m.date.startsWith(prevYm)) {
            lastMonthQty += m.quantity;
          }
          if (m.date >= thirtyDaysAgo) {
            last30DaysQty += m.quantity;
          }
        }
      });
    }

    // Default daily usage fallback if data is early in the month
    const baselineDaily = item.dailyUsage || 0.5;
    const daysPassedInMonth = Math.max(1, now.getDate());
    const measuredDailyBurn = thisMonthQty > 0 ? thisMonthQty / daysPassedInMonth : (last30DaysQty > 0 ? last30DaysQty / 30 : baselineDaily);
    const dailyBurnRate = Math.round(Math.max(0.1, measuredDailyBurn) * 10) / 10;
    const weeklyUsage = Math.round(dailyBurnRate * 7 * 10) / 10;

    // Trend calculation
    let trendPercent = 0;
    const prevBenchmark = lastMonthQty > 0 ? lastMonthQty : (baselineDaily * 30);
    const projectedThisMonth = (thisMonthQty / daysPassedInMonth) * 30;

    if (prevBenchmark > 0) {
      trendPercent = Math.round(((projectedThisMonth - prevBenchmark) / prevBenchmark) * 100 * 10) / 10;
    }

    let trendDirection: ItemUsageTrend['trendDirection'] = 'STABLE';
    if (trendPercent >= 20) {
      trendDirection = 'SURGE';
    } else if (trendPercent > 5) {
      trendDirection = 'INCREASING';
    } else if (trendPercent < -10) {
      trendDirection = 'DECREASING';
    } else {
      trendDirection = 'STABLE';
    }

    // Runout days prediction
    const runoutDays = Math.round(item.currentStockHQ / dailyBurnRate);

    let runoutStatus: ItemUsageTrend['runoutStatus'] = 'HEALTHY';
    if (runoutDays <= 7) {
      runoutStatus = 'CRITICAL';
    } else if (runoutDays <= 14) {
      runoutStatus = 'WARNING';
    } else if (runoutDays > 45) {
      runoutStatus = 'SURPLUS';
    } else {
      runoutStatus = 'HEALTHY';
    }

    // Recommended next month & safety stock
    const projectedNextMonthDemand = Math.ceil(dailyBurnRate * 30 * (1 + Math.max(0, trendPercent / 100)));
    const suggestedSafetyStock = Math.ceil(dailyBurnRate * Math.max(item.leadTimeDays || 7, 7) * 1.5);

    // Build branch breakdown
    const totalOrderQtyAllBranches = Array.from(branchQtyMap.values()).reduce((sum, q) => sum + q, 0);
    const branchUsage = branches
      .map((b) => {
        const q = branchQtyMap.get(b.id) || 0;
        const pct = totalOrderQtyAllBranches > 0 ? Math.round((q / totalOrderQtyAllBranches) * 100) : 0;
        return {
          branchId: b.id,
          branchName: b.name,
          quantity: q,
          percentage: pct,
        };
      })
      .filter((b) => b.quantity > 0)
      .sort((a, b) => b.quantity - a.quantity);

    const topBranchName = branchUsage[0]?.branchName;
    const topBranchPercentage = branchUsage[0]?.percentage;

    return {
      itemId: item.id,
      item,
      currentStockHQ: item.currentStockHQ,
      minThreshold: item.minStockThreshold,
      thisMonthUsage: thisMonthQty,
      lastMonthUsage: lastMonthQty,
      twoMonthsAgoUsage: twoMonthsAgoQty,
      totalUsage30Days: last30DaysQty || Math.round(dailyBurnRate * 30),
      dailyBurnRate,
      weeklyUsage,
      trendPercent,
      trendDirection,
      runoutDays,
      runoutStatus,
      suggestedSafetyStock,
      projectedNextMonthDemand,
      branchUsage,
      topBranchName,
      topBranchPercentage,
    };
  });
};
