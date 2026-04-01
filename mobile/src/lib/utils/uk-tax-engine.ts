/**
 * UK Income Tax & National Insurance Engine (2025/26 Tax Year)
 * Based on PAYE system.
 * Note: This is an estimate. Actual take-home depends on your specific
 * tax code, pension contributions, and personal allowances.
 */

export interface UKTaxInput {
  monthlyGross: number;
  totalHours?: number;
}

export interface UKTaxResult {
  grossPay: number;
  regularGross: number;
  taxableGross: number;
  cashGross: number;
  incomeTax: number;
  nationalInsurance: number;
  healthInsurance: number; // 0 in UK (NI covers health)
  totalDeductions: number;
  netPay: number;
  effectiveTaxRate: number;
  trainingFundDeduction: number;
  transportationAllowance: number;
  finalTakeHome: number;
  employerPension: number;
  effectiveHourlyNet: number;
  netToGrossRatio: number;
  isEstimate: true;
  estimateNote: string;
}

// 2025/26 UK Tax Year
const UK_TAX_CONFIG = {
  personalAllowanceAnnual: 12_570,
  incomeTaxBrackets: [
    { upTo: 50_270, rate: 0.20 }, // Basic rate
    { upTo: 125_140, rate: 0.40 }, // Higher rate
    { upTo: Infinity, rate: 0.45 }, // Additional rate
  ],
  // National Insurance (Employee) 2025/26
  ni: {
    primaryThresholdAnnual: 12_570,
    upperEarningsLimitAnnual: 50_270,
    lowerRate: 0.08,   // 8% between primary threshold and UEL
    upperRate: 0.02,   // 2% above UEL
  },
  // Auto-enrolment pension (employer + employee minimums)
  autoEnrolmentEmployee: 0.05, // 5% minimum employee
};

export function calcUKTax(input: UKTaxInput): UKTaxResult {
  const { monthlyGross, totalHours } = input;
  const annualGross = monthlyGross * 12;

  // Income Tax
  const taxableIncome = Math.max(0, annualGross - UK_TAX_CONFIG.personalAllowanceAnnual);
  let annualIncomeTax = 0;
  let prev = 0;
  for (const bracket of UK_TAX_CONFIG.incomeTaxBrackets) {
    if (taxableIncome <= prev) break;
    const taxable = Math.min(taxableIncome, bracket.upTo - UK_TAX_CONFIG.personalAllowanceAnnual) - prev;
    if (taxable > 0) annualIncomeTax += taxable * bracket.rate;
    prev = Math.max(prev, bracket.upTo - UK_TAX_CONFIG.personalAllowanceAnnual);
  }
  const incomeTax = annualIncomeTax / 12;

  // National Insurance
  const { primaryThresholdAnnual, upperEarningsLimitAnnual, lowerRate, upperRate } = UK_TAX_CONFIG.ni;
  const niLow = Math.max(0, Math.min(annualGross, upperEarningsLimitAnnual) - primaryThresholdAnnual);
  const niHigh = Math.max(0, annualGross - upperEarningsLimitAnnual);
  const annualNI = niLow * lowerRate + niHigh * upperRate;
  const nationalInsurance = annualNI / 12;

  const totalDeductions = incomeTax + nationalInsurance;
  const netPay = Math.max(0, monthlyGross - totalDeductions);
  const effectiveTaxRate = monthlyGross > 0 ? (totalDeductions / monthlyGross) * 100 : 0;
  const effectiveHourlyNet = (totalHours && totalHours > 0) ? netPay / totalHours : 0;

  return {
    grossPay: monthlyGross,
    regularGross: monthlyGross,
    taxableGross: monthlyGross,
    cashGross: monthlyGross,
    incomeTax,
    nationalInsurance,
    healthInsurance: 0,
    totalDeductions,
    netPay,
    effectiveTaxRate,
    trainingFundDeduction: 0,
    transportationAllowance: 0,
    finalTakeHome: netPay,
    employerPension: 0,
    effectiveHourlyNet,
    netToGrossRatio: monthlyGross > 0 ? netPay / monthlyGross : 0,
    isEstimate: true,
    estimateNote: 'Based on standard personal allowance. Actual take-home depends on your tax code and circumstances.',
  };
}
