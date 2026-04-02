/**
 * חישוב מס הכנסה + ביטוח לאומי + בריאות לפי חוקי ישראל (2026)
 *
 * מקורות:
 * - מדרגות מס הכנסה 2026: רשות המסים
 * - שיעורי ביטוח לאומי ובריאות 2026: המוסד לביטוח לאומי
 * - ערך נקודת זיכוי 2026: 242 ₪/חודש
 *
 * ניתן לעדכן את הערכים בסעיף TAX_CONFIG בלבד כשמשתנים החוקים.
 */

// ─── קונפיגורציה — לעדכן כאן בלבד ──────────────────────────────────────────

export const YEAR = 2026;

export const TAX_CONFIG = {
  /** ערך נקודת זיכוי חודשי (2026) */
  creditPointMonthly: 242,

  /**
   * מדרגות מס הכנסה חודשי 2026 (₪)
   * מחושב שנתית פנימית (×12) אך מוגדר כאן כסכומים חודשיים לנוחות.
   */
  incomeTaxBrackets: [
    { upTo:   7_010 * 12, rate: 0.10, label: '10%' },
    { upTo:  10_060 * 12, rate: 0.14, label: '14%' },
    { upTo:  16_150 * 12, rate: 0.20, label: '20%' },
    { upTo:  22_440 * 12, rate: 0.31, label: '31%' },
    { upTo:  46_690 * 12, rate: 0.35, label: '35%' },
    { upTo:  60_130 * 12, rate: 0.47, label: '47%' },
    { upTo:  Infinity,    rate: 0.50, label: '50%' },
  ],

  /** מדרגות ביטוח לאומי + בריאות (עובד שכיר מתחת לגיל 60, חודשי 2026) */
  ni: {
    lowCeiling: 7_420,   // סף מדרגה נמוכה
    maxIncome:  49_030,  // תקרה חודשית (מעל — 0%)
    lowNI:      0.004,   // 0.4% מדרגה נמוכה
    highNI:     0.07,    // 7.0% מדרגה גבוהה
    lowHealth:  0.031,   // 3.1% מדרגה נמוכה
    highHealth: 0.05,    // 5.0% מדרגה גבוהה
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
  oneTimePensionTotal?: number; // additions included in pension base
  employerPensionRate?: number; // default 0.065 (6.5%)
  totalHours?: number;          // optional: for effectiveHourlyNet calc
}

export interface TaxResult {
  grossPay: number;          // base hourly gross (monthlyGross only)
  regularGross: number;      // cash components: baseGross + grossup + bonus
  taxableGross: number;      // regularGross + carBenefit + gifts (full tax base)
  cashGross: number;         // alias for regularGross (backwards compat)
  incomeTax: number;
  nationalInsurance: number;
  healthInsurance: number;
  totalDeductions: number;
  netPay: number;            // regularGross - all deductions (before transport)
  effectiveTaxRate: number;  // totalDeductions / regularGross × 100
  trainingFundDeduction: number;
  transportationAllowance: number;
  finalTakeHome: number;     // netPay - trainingFund + transportation
  employerPension: number;   // base salary only × rate (no bonus/grossup)
  effectiveHourlyNet: number; // finalTakeHome / totalHours (0 if no hours)
  netToGrossRatio: number;    // finalTakeHome / regularGross (0–1)
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

export interface NextBracketInfo {
  nextBracketThreshold: number;
  currentRate: number;
  nextRate: number;
  amountUntilNextBracket: number;
}

export interface ExtraHoursImpact {
  additionalGross: number;
  additionalTax: number;
  additionalNet: number;
  netPerExtraHour: number;
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
    totalHours,
  } = input;

  const bonusTotal = input.oneTimeBonusTotal ?? 0;
  const giftTotal  = input.oneTimeGiftTotal  ?? 0;
  const grossup    = input.carGrossupMonthly ?? 0;
  const empPensionRate = input.employerPensionRate ?? 0.065;

  // regularGross: cash components only (what you actually receive as cash)
  // = base salary + car grossup (employer pays your tax cost) + bonus
  const regularGross = monthlyGross + grossup + bonusTotal;

  // taxableGross: full tax base including non-cash benefits
  // = regularGross + car benefit (שווי שימוש) + gifts (tax-only additions)
  const taxableGross = regularGross + carBenefitMonthly + giftTotal;

  // Income tax on full taxable gross (including non-cash benefits)
  const incomeTax = calcMonthlyIncomeTax(taxableGross, creditPoints);

  // NI/health computed on regularGross only (not on non-cash benefits like שווי שימוש)
  const { ni, health } = calcNIAndHealth(regularGross);

  const trainingFundDeduction = trainingFundType === 'fixed'
    ? (trainingFundValue ?? 0)
    : (regularGross * ((trainingFundValue ?? 0) / 100));

  const totalDeductions = incomeTax + ni + health + trainingFundDeduction;

  // Net pay: regular cash received minus all taxes and deductions
  const netPay = Math.max(0, regularGross - totalDeductions);

  const effectiveTaxRate = regularGross > 0 ? (totalDeductions / regularGross) * 100 : 0;

  const transportationAllowance = transportationType === 'fixed'
    ? (transportationValue ?? 0)
    : (regularGross * ((transportationValue ?? 0) / 100));

  // finalTakeHome = net + transportation (transportation is added post-tax)
  const finalTakeHome = Math.max(0, netPay + transportationAllowance);

  // Employer pension: base salary + pension-eligible one-time additions
  const pensionBase = monthlyGross + (input.oneTimePensionTotal ?? 0);
  const employerPension = pensionBase * empPensionRate;

  // Effective hourly net — excludes car grossup (fixed monthly benefit unrelated to hours worked)
  // Work-based net = proportional share of netPay attributable to work income + transport
  const workIncome = monthlyGross + bonusTotal; // cash from actual work
  const workBasedNet = regularGross > 0
    ? netPay * (workIncome / regularGross) + transportationAllowance
    : 0;
  const effectiveHourlyNet = (totalHours && totalHours > 0) ? Math.max(0, workBasedNet) / totalHours : 0;

  // Net to gross ratio
  const netToGrossRatio = regularGross > 0 ? finalTakeHome / regularGross : 0;

  return {
    grossPay: monthlyGross,
    regularGross,
    taxableGross,
    cashGross: regularGross, // backwards compat alias
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
    effectiveHourlyNet,
    netToGrossRatio,
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
    totalHours: hoursWorked,
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
  context: Omit<TaxInput, 'monthlyGross'>,
): SimulationResult {
  const extraGross = extraHours * hourlyRate;
  const newGross   = currentMonthlyGross + extraGross;

  const currentResult = calcIsraeliTax({ ...context, monthlyGross: currentMonthlyGross });
  const newResult     = calcIsraeliTax({ ...context, monthlyGross: newGross });

  const extraNet = newResult.finalTakeHome - currentResult.finalTakeHome;
  const keepRate = extraGross > 0 ? (extraNet / extraGross) * 100 : 0;

  const currentBracket = getBracketInfo(currentMonthlyGross, hourlyRate, context.carBenefitMonthly);
  const newBracket     = getBracketInfo(newGross,             hourlyRate, context.carBenefitMonthly);
  const bracketCrossed = currentBracket.currentRate !== newBracket.currentRate;

  return { ...newResult, extraHours, extraGross, extraNet, keepRate, bracketCrossed };
}

/** שיעור נטו אפקטיבי — כמה אחוז מהברוטו נשאר לך */
export function calcEffectiveNetRate(gross: number, creditPoints: number = 2.25): number {
  if (gross <= 0) return 100;
  const result = calcIsraeliTax({
    monthlyGross: gross,
    carBenefitMonthly: 0,
    creditPoints,
  });
  return 100 - (result.totalDeductions / gross) * 100;
}

/** מידע על המדרגה הבאה לפי הכנסה חודשית */
export function getNextBracketInfo(monthlyGross: number): NextBracketInfo {
  const annualGross = monthlyGross * 12;
  const brackets = TAX_CONFIG.incomeTaxBrackets;

  let currentBracketIdx = brackets.length - 1;
  for (let i = 0; i < brackets.length; i++) {
    if (annualGross <= brackets[i].upTo) {
      currentBracketIdx = i;
      break;
    }
  }

  const current = brackets[currentBracketIdx];
  const isTop = currentBracketIdx === brackets.length - 1;

  if (isTop) {
    // Already at top bracket — no next bracket
    return {
      nextBracketThreshold: Infinity,
      currentRate: current.rate,
      nextRate: current.rate,
      amountUntilNextBracket: 0,
    };
  }

  const next = brackets[currentBracketIdx + 1];
  const annualThreshold = current.upTo;
  const amountUntilNextBracket = Math.max(0, (annualThreshold - annualGross) / 12);

  return {
    nextBracketThreshold: annualThreshold / 12, // monthly threshold
    currentRate: current.rate,
    nextRate: next.rate,
    amountUntilNextBracket,
  };
}

/** מחשב את השפעת שעות נוספות על הנטו */
export function calcExtraHoursImpact(
  currentMonthlyGross: number,
  hourlyRate: number,
  extraHours: number,
): ExtraHoursImpact {
  const additionalGross = hourlyRate * extraHours;
  const newGross = currentMonthlyGross + additionalGross;

  const defaultContext: Omit<TaxInput, 'monthlyGross'> = {
    carBenefitMonthly: 0,
    creditPoints: 2.25,
  };

  const currentResult = calcIsraeliTax({ ...defaultContext, monthlyGross: currentMonthlyGross });
  const newResult     = calcIsraeliTax({ ...defaultContext, monthlyGross: newGross });

  const additionalTax = newResult.totalDeductions - currentResult.totalDeductions;
  const additionalNet = newResult.finalTakeHome    - currentResult.finalTakeHome;
  const netPerExtraHour = extraHours > 0 ? additionalNet / extraHours : 0;

  return {
    additionalGross,
    additionalTax,
    additionalNet,
    netPerExtraHour,
  };
}

/** טיפים כלכליים דינמיים לפי מצב נוכחי */
export function getSmartTips(
  monthlyGross: number,
  hourlyRate: number,
  carBenefitMonthly: number,   // full sum for bracket calc
  creditPoints: number,
  dailyGoalHours: number,
  currentMonthHours: number,
  totalMonthlyHours = 186,
  actualCarBenefit = 0,         // actual שווי שימוש only (for tip text)
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

  // שווי שימוש רכב — show actual car benefit, not combined sum
  const displayCarBenefit = actualCarBenefit > 0 ? actualCarBenefit : carBenefitMonthly;
  if (displayCarBenefit > 0) {
    tips.push(`שווי שימוש הרכב (₪${Math.round(displayCarBenefit).toLocaleString('he-IL')}) מגדיל את חישוב המס, אך לא נכנס לנטו שלך`);
  }

  // שיעור ניכוי
  const rate = Math.round(result.effectiveTaxRate);
  tips.push(`שיעור הניכוי האפקטיבי שלך החודש הוא כ-${rate}% מהברוטו`);

  // כמה נשאר מכל שעה נוספת
  if (hourlyRate > 0) {
    const sim = simulateExtraHours(monthlyGross, 1, hourlyRate, { carBenefitMonthly, creditPoints });
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
