/**
 * חישוב מס הכנסה + ביטוח לאומי + בריאות לפי חוקי ישראל (2024)
 *
 * מקורות:
 * - מדרגות מס הכנסה 2024: רשות המסים
 * - שיעורי ביטוח לאומי ובריאות 2024: המוסד לביטוח לאומי
 * - ערך נקודת זיכוי 2024: 242 ₪/חודש
 */

// ─── מדרגות מס הכנסה שנתי 2024 ────────────────────────────────────────────────

const INCOME_TAX_BRACKETS: Array<{ upTo: number; rate: number }> = [
  { upTo: 84_120,   rate: 0.10 },
  { upTo: 120_720,  rate: 0.14 },
  { upTo: 193_800,  rate: 0.20 },
  { upTo: 269_280,  rate: 0.31 },
  { upTo: 558_240,  rate: 0.35 },
  { upTo: 721_560,  rate: 0.47 },
  { upTo: Infinity, rate: 0.50 },
];

/** ערך נקודת זיכוי חודשי 2024 */
const CREDIT_POINT_MONTHLY = 242;

// ─── מדרגות ביטוח לאומי + בריאות (עובד שכיר) 2024 ────────────────────────────

/** 60% מהשכר הממוצע — גבול המדרגה הנמוכה */
const NI_LOW_CEILING_MONTHLY = 7_522;

/** תקרת ביטוח לאומי חודשית */
const NI_MAX_MONTHLY = 49_030;

// שיעורי ביטוח לאומי
const NI_LOW_RATE  = 0.004;  // 0.4%  על מדרגה נמוכה
const NI_HIGH_RATE = 0.07;   // 7%    על מדרגה גבוהה

// שיעורי ביטוח בריאות
const HEALTH_LOW_RATE  = 0.031; // 3.1% על מדרגה נמוכה
const HEALTH_HIGH_RATE = 0.05;  // 5%   על מדרגה גבוהה

// ─── ממשק קלט / פלט ───────────────────────────────────────────────────────────

export interface TaxInput {
  /** שכר ברוטו חודשי (שעות × שכר שעתי) */
  monthlyGross: number;
  /** שווי שימוש ברכב (חודשי) — נכנס לחישוב המס אך לא לשכר בפועל */
  carBenefitMonthly: number;
  /** מספר נקודות זיכוי */
  creditPoints: number;
}

export interface TaxResult {
  /** ברוטו בפועל */
  grossPay: number;
  /** ברוטו חייב במס (כולל שווי רכב) */
  taxableGross: number;
  /** מס הכנסה חודשי */
  incomeTax: number;
  /** ביטוח לאומי חודשי */
  nationalInsurance: number;
  /** ביטוח בריאות חודשי */
  healthInsurance: number;
  /** סך ניכויים */
  totalDeductions: number;
  /** נטו לקבלה */
  netPay: number;
  /** שיעור מס אפקטיבי (%) */
  effectiveTaxRate: number;
}

// ─── פונקציות עזר ─────────────────────────────────────────────────────────────

/**
 * חישוב מס הכנסה שנתי לפי מדרגות.
 * מחזיר את המס החודשי לאחר ניכוי נקודות זיכוי.
 */
function calcMonthlyIncomeTax(monthlyTaxableGross: number, creditPoints: number): number {
  const annualIncome = monthlyTaxableGross * 12;
  let annualTax = 0;
  let prevBracket = 0;

  for (const bracket of INCOME_TAX_BRACKETS) {
    if (annualIncome <= prevBracket) break;
    const taxableInBracket = Math.min(annualIncome, bracket.upTo) - prevBracket;
    annualTax += taxableInBracket * bracket.rate;
    prevBracket = bracket.upTo;
  }

  // ניכוי נקודות זיכוי
  const annualCreditReduction = creditPoints * CREDIT_POINT_MONTHLY * 12;
  const finalAnnualTax = Math.max(0, annualTax - annualCreditReduction);

  return finalAnnualTax / 12;
}

/**
 * חישוב ביטוח לאומי ובריאות חודשי.
 * מחושב על השכר בפועל בלבד (לא כולל שווי שימוש רכב).
 */
function calcNIAndHealth(monthlyGross: number): {
  nationalInsurance: number;
  healthInsurance: number;
} {
  const capped = Math.min(monthlyGross, NI_MAX_MONTHLY);

  const lowPart  = Math.min(capped, NI_LOW_CEILING_MONTHLY);
  const highPart = Math.max(0, capped - NI_LOW_CEILING_MONTHLY);

  const nationalInsurance =
    lowPart  * NI_LOW_RATE +
    highPart * NI_HIGH_RATE;

  const healthInsurance =
    lowPart  * HEALTH_LOW_RATE +
    highPart * HEALTH_HIGH_RATE;

  return { nationalInsurance, healthInsurance };
}

// ─── פונקציה ראשית ────────────────────────────────────────────────────────────

/**
 * מחשב את כל הניכויים ומחזיר פירוט מלא.
 */
export function calcIsraeliTax(input: TaxInput): TaxResult {
  const { monthlyGross, carBenefitMonthly, creditPoints } = input;

  const taxableGross = monthlyGross + carBenefitMonthly;

  const incomeTax = calcMonthlyIncomeTax(taxableGross, creditPoints);
  const { nationalInsurance, healthInsurance } = calcNIAndHealth(monthlyGross);

  const totalDeductions = incomeTax + nationalInsurance + healthInsurance;
  const netPay = Math.max(0, monthlyGross - totalDeductions);
  const effectiveTaxRate = monthlyGross > 0
    ? (totalDeductions / monthlyGross) * 100
    : 0;

  return {
    grossPay: monthlyGross,
    taxableGross,
    incomeTax,
    nationalInsurance,
    healthInsurance,
    totalDeductions,
    netPay,
    effectiveTaxRate,
  };
}

/**
 * חישוב יחסי לפי מספר שעות עבודה בחודש.
 * מחשב תחילה את המס על שכר חודשי מלא, ואז מחזיר חלק יחסי.
 *
 * @param hoursWorked - שעות עבודה בפועל
 * @param hourlyRate  - שכר לשעה
 * @param totalMonthlyHours - שעות חודשיות נורמליות (ברירת מחדל: 186)
 */
export function calcTaxForHours(
  hoursWorked: number,
  hourlyRate: number,
  carBenefitMonthly: number,
  creditPoints: number,
  totalMonthlyHours = 186,
): TaxResult {
  const monthlyGross = hoursWorked * hourlyRate;

  // שווי רכב מחושב יחסית לפי חלק מהחודש שעבדנו
  const ratio = totalMonthlyHours > 0 ? hoursWorked / totalMonthlyHours : 1;
  const adjustedCarBenefit = carBenefitMonthly * Math.min(ratio, 1);

  return calcIsraeliTax({
    monthlyGross,
    carBenefitMonthly: adjustedCarBenefit,
    creditPoints,
  });
}
