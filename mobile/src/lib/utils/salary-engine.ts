/**
 * salary-engine.ts
 *
 * Defines every salary component with full behavioral flags and smart tags.
 * This is the single source of truth for how each component affects gross,
 * tax base, net pay, and pension calculations.
 */

// ─── Tag types ────────────────────────────────────────────────────────────────

export type SalaryTag =
  | 'נכנס לנטו'
  | 'לצורכי מס בלבד'
  | 'לא נכלל בפנסיה'
  | 'רכיב חד פעמי'
  | 'הטבה חייבת'
  | 'מגדיל בסיס מס'
  | 'שכר בסיס'
  | 'בסיס פנסיוני'
  | 'הטבת מעסיק'
  | 'פטור ממס'
  | 'לא נכנס לנטו';

// ─── Component definition ─────────────────────────────────────────────────────

export interface SalaryComponentDef {
  id: string;
  label: string;                          // Hebrew display name
  explanation: string;                    // Short user-friendly explanation
  tags: SalaryTag[];                      // Smart tags to display
  includedInRegularGross: boolean;        // Counts toward ברוטו רגיל (cash wage)
  includedInTaxGross: boolean;            // Counts toward ברוטו למס (taxable)
  includedInNet: boolean;                 // Actually received as cash
  includedInEmployeePensionBase: boolean;
  includedInEmployerPensionBase: boolean;
  taxable: boolean;                       // Subject to income tax
  isOneTime: boolean;                     // One-time vs monthly recurring
}

// ─── Component definitions ────────────────────────────────────────────────────

export const BASE_SALARY: SalaryComponentDef = {
  id: 'base_salary',
  label: 'שכר בסיס',
  explanation: 'שכר הבסיס מהווה את ליבת השכר — נכנס לברוטו, לנטו ולבסיס ההפרשות הפנסיוניות',
  tags: ['שכר בסיס', 'נכנס לנטו', 'בסיס פנסיוני'],
  includedInRegularGross: true,
  includedInTaxGross: true,
  includedInNet: true,
  includedInEmployeePensionBase: true,
  includedInEmployerPensionBase: true,
  taxable: true,
  isOneTime: false,
};

export const BONUS: SalaryComponentDef = {
  id: 'bonus',
  label: 'בונוס',
  explanation: 'בונוס חד-פעמי — מתווסף לשכר, חייב במס, אך אינו נכלל בבסיס ההפרשות לפנסיה',
  tags: ['נכנס לנטו', 'הטבה חייבת', 'לא נכלל בפנסיה'],
  includedInRegularGross: true,
  includedInTaxGross: true,
  includedInNet: true,
  includedInEmployeePensionBase: false,
  includedInEmployerPensionBase: false,
  taxable: true,
  isOneTime: true,
};

export const CAR_GROSSUP: SalaryComponentDef = {
  id: 'car_grossup',
  label: 'גילום רכב',
  explanation: 'תשלום מהמעסיק לכיסוי עלות המס על הרכב — נכנס לנטו בפועל, אך אינו בסיס פנסיוני',
  tags: ['נכנס לנטו', 'מגדיל בסיס מס', 'לא נכלל בפנסיה'],
  includedInRegularGross: true,
  includedInTaxGross: true,
  includedInNet: true,
  includedInEmployeePensionBase: false,
  includedInEmployerPensionBase: false,
  taxable: true,
  isOneTime: false,
};

export const CAR_BENEFIT: SalaryComponentDef = {
  id: 'car_benefit',
  label: 'שווי שימוש ברכב',
  explanation: 'שווי שימוש ברכב מגדיל את חישוב המס אך אינו משולם לך בפועל — זקיפת שווי לצורכי מיסוי בלבד',
  tags: ['לצורכי מס בלבד', 'מגדיל בסיס מס', 'לא נכלל בפנסיה'],
  includedInRegularGross: false,
  includedInTaxGross: true,
  includedInNet: false,
  includedInEmployeePensionBase: false,
  includedInEmployerPensionBase: false,
  taxable: true,
  isOneTime: false,
};

export const GIFT_CARD: SalaryComponentDef = {
  id: 'gift_card',
  label: 'שווי מתנות / גיפטקארד',
  explanation: 'הטבת שי/גיפטקארד — חייבת במס, מגדילה את בסיס המס, אך אינה כסף מזומן בנטו',
  tags: ['לצורכי מס בלבד', 'הטבה חייבת', 'לא נכלל בפנסיה'],
  includedInRegularGross: false,
  includedInTaxGross: true,
  includedInNet: false,
  includedInEmployeePensionBase: false,
  includedInEmployerPensionBase: false,
  taxable: true,
  isOneTime: true,
};

export const MEAL_BENEFIT: SalaryComponentDef = {
  id: 'meal_benefit',
  label: 'סיבוס / תן ביס',
  explanation: 'הטבת ארוחות — משפיעה על בסיס המס כזקיפת שווי, אך אינה מזומן שנכנס לחשבונך',
  tags: ['לצורכי מס בלבד', 'הטבת מעסיק'],
  includedInRegularGross: false,
  includedInTaxGross: true,
  includedInNet: false,
  includedInEmployeePensionBase: false,
  includedInEmployerPensionBase: false,
  taxable: true,
  isOneTime: false,
};

export const TRANSPORTATION: SalaryComponentDef = {
  id: 'transportation',
  label: 'נסיעות / החזר הוצאות',
  explanation: 'החזר הוצאות נסיעה — מתווסף לנטו לאחר המס, אינו נחשב הכנסה לצורכי מס',
  tags: ['נכנס לנטו', 'הטבת מעסיק'],
  includedInRegularGross: false,
  includedInTaxGross: false,
  includedInNet: true,
  includedInEmployeePensionBase: false,
  includedInEmployerPensionBase: false,
  taxable: false,
  isOneTime: false,
};

// ─── All components registry ──────────────────────────────────────────────────

export const ALL_COMPONENTS: SalaryComponentDef[] = [
  BASE_SALARY,
  BONUS,
  CAR_GROSSUP,
  CAR_BENEFIT,
  GIFT_CARD,
  MEAL_BENEFIT,
  TRANSPORTATION,
];

// ─── Tag color map ────────────────────────────────────────────────────────────

export const TAG_COLORS: Record<SalaryTag, { bg: string; text: string }> = {
  'נכנס לנטו':        { bg: 'rgba(34,197,94,0.15)',    text: '#22C55E' },
  'לצורכי מס בלבד':  { bg: 'rgba(245,158,11,0.15)',   text: '#F59E0B' },
  'לא נכלל בפנסיה':  { bg: 'rgba(148,163,184,0.15)',  text: '#94A3B8' },
  'רכיב חד פעמי':    { bg: 'rgba(139,92,246,0.15)',   text: '#A78BFA' },
  'הטבה חייבת':      { bg: 'rgba(249,115,22,0.15)',   text: '#FB923C' },
  'מגדיל בסיס מס':   { bg: 'rgba(59,130,246,0.15)',   text: '#3B82F6' },
  'שכר בסיס':        { bg: 'rgba(6,182,212,0.15)',    text: '#06B6D4' },
  'בסיס פנסיוני':    { bg: 'rgba(20,184,166,0.15)',   text: '#14B8A6' },
  'הטבת מעסיק':      { bg: 'rgba(99,102,241,0.15)',   text: '#818CF8' },
  'פטור ממס':         { bg: 'rgba(34,197,94,0.1)',     text: '#4ADE80' },
  'לא נכנס לנטו':    { bg: 'rgba(148,163,184,0.12)',  text: '#94A3B8' },
};

// ─── Calculation types ────────────────────────────────────────────────────────

export interface SalaryInput {
  // Base
  baseMonthlyGross: number;         // hours × hourlyRate (with overtime)

  // Benefits & additions
  carBenefitMonthly: number;        // שווי שימוש (tax-only)
  carGrossupMonthly: number;        // גילום (cash + taxable)
  oneTimeBonus: number;             // bonuses this month (cash + taxable)
  oneTimeGifts: number;             // gifts/giftcard (tax-only)
  transportationMonthly: number;    // נסיעות (net addition, not taxable)
  trainingFundEmployeeRate: number; // קרן השתלמות עובד (% of regularGross or fixed ₪)
  trainingFundType: 'percent' | 'fixed';

  // Tax config
  creditPoints: number;
  employerPensionRate: number;      // as fraction e.g. 0.065
  totalHours?: number;              // for hourly rate calc
}

export interface SalaryResult {
  // Three layers
  regularGross: number;        // שכר בסיס + בונוס + גילום (מה שמגיע בפועל)
  taxableGross: number;        // regularGross + שווי שימוש + גיפטקארד (בסיס המס)

  // Deductions
  incomeTax: number;
  nationalInsurance: number;
  healthInsurance: number;
  trainingFundDeduction: number;
  totalDeductions: number;

  // Net
  netBeforeTransport: number;     // regularGross - totalDeductions
  transportationAllowance: number;
  finalTakeHome: number;          // netBeforeTransport + transportation

  // Pension
  employerPension: number;        // base salary × employerPensionRate ONLY

  // Rates
  effectiveTaxRate: number;       // totalDeductions / regularGross × 100
  effectiveHourlyNet: number;     // finalTakeHome / totalHours (if hours provided)
  netToGrossRatio: number;        // finalTakeHome / regularGross
}
