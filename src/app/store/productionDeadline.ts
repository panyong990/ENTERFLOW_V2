import type { Inquiry } from "./orders";

type DeliveryMethod = NonNullable<Inquiry["deliveryMethod"]>;

interface TransitTimeEstimate {
  minCalendarDays: number;
  maxCalendarDays: number;
}

export const DELIVERY_TRANSIT_TIME_ESTIMATES: Record<DeliveryMethod, TransitTimeEstimate> = {
  "Company Vehicle": { minCalendarDays: 1, maxCalendarDays: 2 },
  Lalamove: { minCalendarDays: 0, maxCalendarDays: 1 },
  "AP Cargo": { minCalendarDays: 2, maxCalendarDays: 3 },
  "Fast Cargo": { minCalendarDays: 3, maxCalendarDays: 5 },
  "Client Pick-up": { minCalendarDays: 0, maxCalendarDays: 0 },
};

export const DELIVERY_TRANSIT_ESTIMATE_NOTICE =
  "Temporary placeholder estimates only; Enter-Fil has not confirmed these transit times.";

export interface ProductionDeadlineCalculation {
  quotationCalendarDays: number;
  maximumTransitCalendarDays: number;
  productionWorkingDays: number;
  productionDueDate: string;
}

export function parseQuotationTimeframeCalendarDays(timeframe: string): number | undefined {
  const normalized = timeframe.trim().replace(/[–—]/g, "-");
  const range = normalized.match(
    /^(\d+)\s*(?:-|to)\s*(\d+)\s*(?:(?:calendar|working)\s*)?(days?|weeks?)\b/i,
  );
  const single = normalized.match(/^(\d+)\s*(?:(?:calendar|working)\s*)?(days?|weeks?)\b/i);
  const amount = range ? Number(range[2]) : single ? Number(single[1]) : Number.NaN;
  const unit = (range?.[3] ?? single?.[2])?.toLowerCase();

  if (!Number.isSafeInteger(amount) || amount <= 0 || !unit) return undefined;
  if (range && Number(range[1]) > amount) return undefined;

  const calendarDays = unit.startsWith("week") ? amount * 7 : amount;
  return Number.isSafeInteger(calendarDays) ? calendarDays : undefined;
}

function isValidDate(date: Date): boolean {
  return !Number.isNaN(date.getTime());
}

function formatUTCDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function calculateProductionDeadline(
  quotationTimeframe: string | undefined,
  deliveryMethod: string | undefined,
  generatedAt: Date = new Date(),
): ProductionDeadlineCalculation | undefined {
  if (!quotationTimeframe || !deliveryMethod || !isValidDate(generatedAt)) return undefined;

  const quotationCalendarDays = parseQuotationTimeframeCalendarDays(quotationTimeframe);
  const transitEstimate = DELIVERY_TRANSIT_TIME_ESTIMATES[deliveryMethod as DeliveryMethod];
  if (
    quotationCalendarDays === undefined
    || !transitEstimate
    || !Number.isSafeInteger(transitEstimate.minCalendarDays)
    || !Number.isSafeInteger(transitEstimate.maxCalendarDays)
    || transitEstimate.minCalendarDays < 0
    || transitEstimate.maxCalendarDays < transitEstimate.minCalendarDays
  ) {
    return undefined;
  }

  const productionWorkingDays = quotationCalendarDays - transitEstimate.maxCalendarDays;
  if (productionWorkingDays <= 0) return undefined;

  const deadline = new Date(Date.UTC(
    generatedAt.getFullYear(),
    generatedAt.getMonth(),
    generatedAt.getDate(),
  ));
  deadline.setUTCDate(deadline.getUTCDate() + 1);
  while (deadline.getUTCDay() === 0 || deadline.getUTCDay() === 6) {
    deadline.setUTCDate(deadline.getUTCDate() + 1);
  }

  let productionDaysCounted = 0;
  while (productionDaysCounted < productionWorkingDays) {
    productionDaysCounted += 1;
    if (productionDaysCounted < productionWorkingDays) {
      deadline.setUTCDate(deadline.getUTCDate() + 1);
      while (deadline.getUTCDay() === 0 || deadline.getUTCDay() === 6) {
        deadline.setUTCDate(deadline.getUTCDate() + 1);
      }
    }
  }

  return {
    quotationCalendarDays,
    maximumTransitCalendarDays: transitEstimate.maxCalendarDays,
    productionWorkingDays,
    productionDueDate: formatUTCDate(deadline),
  };
}
