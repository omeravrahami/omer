/**
 * חישוב מס הכנסה + ביטוח לאומי + בריאות לפי חוקי ישראל (2024)
 *
 * מקורות:
 * - מדרגות מס הכנסה 2024: רשות המסים
 * - שיעורי ביטוח לאומי ובריאות 2024: המוסד לביטוח לאומי
 * - ערך נקודת זיכוי 2024: 242 ₪/חודש
 *
 * ניתן לעדכן את הערכים בסעיף TAX_CONFIG בלבד כשמשתנים החוקים.
 */

// ─── קונפיגורציה — לעדכן כאן בלבד ──────────────────────────────────────────

export const TAX_CONFIG = {
  /** ערך נקודת זיכוי חודשי (2024) */
  creditPointMonthly: 242,

  /** מדרגות מס הכנסה שנתי 2024 (₪) */
  incomeTaxBrackets: [
    { upTo: 84_120,   rate: 0.10, label: '10%' },
    { upTo: 120_720,  rate: 0.14, label: '14%' },
    { upTo: 193_800,  rate: 0.20, label: '20%' },
    { upTo: 269_280,  rate: 0.31, label: '31%' },
    { upTo: 558_240,  rate: 0.35, label: '35%' },
    { upTo: 721_560,  rate: 0.47, label: '47%' },
    { upTo: Infinity, rate: 0.50, label: '50%' },
  ],

  /** מדרגות ביטוח לאומי + בריאות (עובד שכיר, חודשי 2024) */
  ni: {
    lowCeiling: 7_522,   // 60% מהשכר הממוצע
    maxIncome:  49_030,  // תקרה חודשית
    lowNI:      0.004,   // 0.4% מדרגה נמוכה
    highNI:     0.07,    // 7% מדרגה גבוהה
    lowHealth:  0.031,   // 3.1% מדרגה נמוכה
    highHealth: 0.05,    // 5% מדרגה גבוהה
  },
} as const;

// ─── ממשקי קלט / פלט ──────────────────────────────────────────────────────────

export interface TaxInput {
  monthlyGross: number;
  carBenefitMonthly: number;
  creditPoints: number;
  trainingFundValue?: number;
  trainingFundType?: 'percent' | 'fixed';
  transportationValue?: number;
  transportationType?: 'percent' | 'fixed';
  carGrossupMonthly?: number;
  oneTimeBonusTotal?: number;   // bonus — taxable + cash
  oneTimeGiftTotal?: number;    // gifts — taxable only (not cash)
  employerPensionRate?: number; // default 0.065 (6.5%)
}

export interface TaxResult {
  grossPay: number;
  taxableGross: number;
  cashGross: number;
  incomeTax: number;
  nationalInsurance: number;
  healthInsurance: number;
  totalDeductions: number;
  netPay: number;
  effectiveTaxRate: number;
  trainingFundDeduction: number;
  transportationAllowance: number;
  finalTakeHome: number;
  employerPension: number;
}

export interface BracketInfo {
  currentRate: number;
  currentLabel: string;
  nextRate: number | null;
  nextLabel: string | null;
  /** ₪ הכנסה שנתית שנותרה עד המדרגה הבאה */
  annualAmountToNextBracket: number | null;
  /** ₪ הכנסה חודשית שנותרה עד המדרגה הבאה */
  monthlyAmountToNextBracket: number | null;
  /** שעות עבודה (בשכר הנוכחי) עד המדרגה הבאה */
  hoursToNextBracket: number | null;
  /** האם במדרגה האחרונה */
  isTopBracket: boolean;
}

export interface SimulationResult extends TaxResult {
  extraHours: number;
  extraGross: number;
  extraNet: number;
  /** % מהתוספת ברוטו שנשאר כנטו */
  keepRate: number;
  bracketCrossed: boolean;
}

// ─── פונקציות עזר פנימיות ─────────────────────────────────────────────────────

function calcMonthlyIncomeTax(monthlyTaxableGross: number, creditPoints: number): number {
  const annual = monthlyTaxableGross * 12;
  let tax = 0;
  let prev = 0;
  for (const bracket of TAX_CONFIG.incomeTaxBrackets) {
    if (annual <= prev) break;
    const taxable = Math.min(annual, bracket.upTo) - prev;
    tax += taxable * bracket.rate;
    prev = bracket.upTo;
  }
  const creditReduction = creditPoints * TAX_CONFIG.creditPointMonthly * 12;
  return Math.max(0, tax - creditReduction) / 12;
}

function calcNIAndHealth(monthlyGross: number): { ni: number; health: number } {
  const { lowCeiling, maxIncome, lowNI, highNI, lowHealth, highHealth } = TAX_CONFIG.ni;
  const capped = Math.min(monthlyGross, maxIncome);
  const low  = Math.min(capped, lowCeiling);
  const high = Math.max(0, capped - lowCeiling);
  return {
    ni:     low * lowNI     + high * highNI,
    health: low * lowHealth + high * highHealth,
  };
}

// ─── פונקציות ציבוריות ────────────────────────────────────────────────────────

/** חישוב מלא של כל הניכויים */
export function calcIsraeliTax(input: TaxInput): TaxResult {
  const {
    monthlyGross,
    carBenefitMonthly,
    creditPoints,
    trainingFundValue,
    trainingFundType,
    transportationValue,
    transportationType,
  } = input;

  const bonusTotal = input.oneTimeBonusTotal ?? 0;
  const giftTotal  = input.oneTimeGiftTotal  ?? 0;
  const grossup    = input.carGrossupMonthly ?? 0;
  const empPensionRate = input.employerPensionRate ?? 0.065;

  // What is taxed (base + car benefit + car grossup + bonus + gift):
  const taxableGross = monthlyGross + carBenefitMonthly + grossup + bonusTotal + giftTotal;

  // What is actually received as cash (base + bonus only):
  const cashGross = monthlyGross + bonusTotal;

  const incomeTax = calcMonthlyIncomeTax(taxableGross, creditPoints);

  // NI/health computed on cash gross (not on non-cash benefits)
  const { ni, health } = calcNIAndHealth(cashGross);

  const totalDeductions = incomeTax + ni + health;

  // Net pay is cash minus all taxes/deductions
  const netPay = Math.max(0, cashGross - totalDeductions);

  const effectiveTaxRate = cashGross > 0 ? (totalDeductions / cashGross) * 100 : 0;

  const trainingFundDeduction = trainingFundType === 'fixed'
    ? (trainingFundValue ?? 0)
    : (cashGross * ((trainingFundValue ?? 0) / 100));

  const transportationAllowance = transportationType === 'fixed'
    ? (transportationValue ?? 0)
    : (cashGross * ((transportationValue ?? 0) / 100));

  const finalTakeHome = Math.max(0, netPay - trainingFundDeduction + transportationAllowance);

  // Employer pension based on base wage + bonus
  const pensionBase = monthlyGross + bonusTotal;
  const employerPension = pensionBase * empPensionRate;

  return {
    grossPay: monthlyGross,
    taxableGross,
    cashGross,
    incomeTax,
    nationalInsurance: ni,
    healthInsurance: health,
    totalDeductions,
    netPay,
    effectiveTaxRate,
    trainingFundDeduction,
    transportationAllowance,
    finalTakeHome,
    employerPension,
  };
}

/** חישוב יחסי לפי שעות עבודה בחודש */
export function calcTaxForHours(
  hoursWorked: number,
  hourlyRate: number,
  carBenefitMonthly: number,
  creditPoints: number,
  totalMonthlyHours = 186,
  trainingFundValue = 0,
  trainingFundType: 'percent' | 'fixed' = 'percent',
  transportationValue = 0,
  transportationType: 'percent' | 'fixed' = 'fixed',
  carGrossupMonthly = 0,
  oneTimeBonusTotal = 0,
  oneTimeGiftTotal = 0,
  employerPensionRate = 0.065,
): TaxResult {
  const monthlyGross = hoursWorked * hourlyRate;
  const ratio = totalMonthlyHours > 0 ? Math.min(hoursWorked / totalMonthlyHours, 1) : 1;
  return calcIsraeliTax({
    monthlyGross,
    carBenefitMonthly: carBenefitMonthly * ratio,
    creditPoints,
    trainingFundValue,
    trainingFundType,
    transportationValue,
    transportationType,
    carGrossupMonthly: carGrossupMonthly * ratio,
    oneTimeBonusTotal: oneTimeBonusTotal * ratio,
    oneTimeGiftTotal: oneTimeGiftTotal * ratio,
    employerPensionRate,
  });
}

/** מידע על מדרגת המס הנוכחית והבאה */
export function getBracketInfo(
  monthlyGross: number,
  hourlyRate: number,
  carBenefitMonthly: number,
): BracketInfo {
  const annualTaxable = (monthlyGross + carBenefitMonthly) * 12;
  const brackets = TAX_CONFIG.incomeTaxBrackets;

  let currentBracketIdx = 0;
  for (let i = 0; i < brackets.length; i++) {
    if (annualTaxable <= brackets[i].upTo) { currentBracketIdx = i; break; }
    if (i === brackets.length - 1) currentBracketIdx = i;
  }

  const current = brackets[currentBracketIdx];
  const next = currentBracketIdx < brackets.length - 1 ? brackets[currentBracketIdx + 1] : null;

  const isTopBracket = currentBracketIdx === brackets.length - 1;
  let annualAmountToNextBracket: number | null = null;
  let monthlyAmountToNextBracket: number | null = null;
  let hoursToNextBracket: number | null = null;

  if (next && !isTopBracket) {
    annualAmountToNextBracket = Math.max(0, current.upTo - annualTaxable);
    monthlyAmountToNextBracket = annualAmountToNextBracket / 12;
    hoursToNextBracket = hourlyRate > 0 ? monthlyAmountToNextBracket / hourlyRate : null;
  }

  return {
    currentRate: current.rate,
    currentLabel: current.label,
    nextRate: next?.rate ?? null,
    nextLabel: next?.label ?? null,
    annualAmountToNextBracket,
    monthlyAmountToNextBracket,
    hoursToNextBracket,
    isTopBracket,
  };
}

/** סימולציה: מה יקרה אם אעבוד X שעות נוספות */
export function simulateExtraHours(
  currentMonthlyGross: number,
  extraHours: number,
  hourlyRate: number,
  carBenefitMonthly: number,
  creditPoints: number,
  trainingFundValue = 0,
  trainingFundType: 'percent' | 'fixed' = 'percent',
  transportationValue = 0,
  transportationType: 'percent' | 'fixed' = 'fixed',
): SimulationResult {
  const extraGross = extraHours * hourlyRate;
  const newGross = currentMonthlyGross + extraGross;

  const currentResult = calcIsraeliTax({ monthlyGross: currentMonthlyGross, carBenefitMonthly, creditPoints, trainingFundValue, trainingFundType, transportationValue, transportationType });
  const newResult     = calcIsraeliTax({ monthlyGross: newGross, carBenefitMonthly, creditPoints, trainingFundValue, trainingFundType, transportationValue, transportationType });

  const extraNet = newResult.netPay - currentResult.netPay;
  const keepRate = extraGross > 0 ? (extraNet / extraGross) * 100 : 0;

  // בדיקה אם נחצית מדרגת מס
  const currentBracket = getBracketInfo(currentMonthlyGross, hourlyRate, carBenefitMonthly);
  const newBracket     = getBracketInfo(newGross, hourlyRate, carBenefitMonthly);
  const bracketCrossed = currentBracket.currentRate !== newBracket.currentRate;

  return { ...newResult, extraHours, extraGross, extraNet, keepRate, bracketCrossed };
}

/** טיפים כלכליים דינמיים לפי מצב נוכחי */
export function getSmartTips(
  monthlyGross: number,
  hourlyRate: number,
  carBenefitMonthly: number,
  creditPoints: number,
  dailyGoalHours: number,
  currentMonthHours: number,
  totalMonthlyHours = 186,
): string[] {
  const tips: string[] = [];
  const result = calcIsraeliTax({ monthlyGross, carBenefitMonthly, creditPoints });
  const bracket = getBracketInfo(monthlyGross, hourlyRate, carBenefitMonthly);

  // מדרגת מס — כמה נשאר
  if (!bracket.isTopBracket && bracket.hoursToNextBracket !== null && bracket.hoursToNextBracket < 80) {
    const hrs = Math.ceil(bracket.hoursToNextBracket);
    tips.push(`נשארו לך כ-${hrs} שעות עד מדרגת המס הבאה (${bracket.nextLabel})`);
  }

  // הסבר על מדרגות מס
  if (!bracket.isTopBracket) {
    tips.push(`מעבר למדרגה הבאה לא אומר שכל השכר ממוסה בשיעור חדש — רק השכר מעל הסף`);
  }

  // שווי שימוש רכב
  if (carBenefitMonthly > 0) {
    tips.push(`שווי שימוש הרכב (₪${carBenefitMonthly.toLocaleString()}) מגדיל את חישוב המס, אך לא נכנס לנטו שלך`);
  }

  // שיעור ניכוי
  const rate = Math.round(result.effectiveTaxRate);
  tips.push(`שיעור הניכוי האפקטיבי שלך החודש הוא כ-${rate}% מהברוטו`);

  // כמה נשאר מכל שעה נוספת
  if (hourlyRate > 0) {
    const sim = simulateExtraHours(monthlyGross, 1, hourlyRate, carBenefitMonthly, creditPoints);
    const netPerHour = Math.round(sim.extraNet);
    tips.push(`מכל שעה נוספת שתעבוד, תקבל כ-₪${netPerHour} נטו לאחר מס`);
  }

  // התקדמות לעבר יעד חודשי
  const ratio = totalMonthlyHours > 0 ? currentMonthHours / totalMonthlyHours : 0;
  if (ratio >= 0.9) {
    tips.push(`עמדת ב-${Math.round(ratio * 100)}% מיעד השעות החודשי — כל הכבוד!`);
  } else if (ratio >= 0.5) {
    const remaining = Math.ceil(totalMonthlyHours - currentMonthHours);
    tips.push(`נשארו לך ${remaining} שעות ליעד החודשי — אתה בדרך הנכונה`);
  }

  return tips.slice(0, 4); // מקסימום 4 טיפים
}
