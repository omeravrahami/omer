/**
 * US Federal Tax Engine (2026 Estimates)
 * Note: This is a simplified federal-only estimate. Actual take-home may vary
 * based on state taxes, local taxes, FICA deductions, and personal circumstances.
 */

export interface USTaxInput {
  monthlyGross: number;
  filingStatus?: 'single' | 'married' | 'head_of_household';
  state?: string; // for display only (simplified)
  totalHours?: number;
}

export interface USTaxResult {
  grossPay: number;
  regularGross: number;
  taxableGross: number;
  cashGross: number;
  federalIncomeTax: number;
  socialSecurity: number;
  medicare: number;
  incomeTax: number;
  nationalInsurance: number; // = socialSecurity (alias for shared interface)
  healthInsurance: number;   // = medicare (alias for shared interface)
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

// 2026 Federal Income Tax Brackets (Single filer)
const US_TAX_CONFIG = {
  single: [
    { upTo: 11_600 * 12,  rate: 0.10 },
    { upTo: 47_150 * 12,  rate: 0.12 },
    { upTo: 100_525 * 12, rate: 0.22 },
    { upTo: 191_950 * 12, rate: 0.24 },
    { upTo: 243_725 * 12, rate: 0.32 },
    { upTo: 609_350 * 12, rate: 0.35 },
    { upTo: Infinity,     rate: 0.37 },
  ],
  married: [
    { upTo: 23_200 * 12,  rate: 0.10 },
    { upTo: 94_300 * 12,  rate: 0.12 },
    { upTo: 201_050 * 12, rate: 0.22 },
    { upTo: 383_900 * 12, rate: 0.24 },
    { upTo: 487_450 * 12, rate: 0.32 },
    { upTo: 731_200 * 12, rate: 0.35 },
    { upTo: Infinity,     rate: 0.37 },
  ],
  head_of_household: [
    { upTo: 16_550 * 12,  rate: 0.10 },
    { upTo: 63_100 * 12,  rate: 0.12 },
    { upTo: 100_500 * 12, rate: 0.22 },
    { upTo: 191_950 * 12, rate: 0.24 },
    { upTo: 243_700 * 12, rate: 0.32 },
    { upTo: 609_350 * 12, rate: 0.35 },
    { upTo: Infinity,     rate: 0.37 },
  ],
  // FICA
  socialSecurityRate: 0.062,   // 6.2% up to wage base
  socialSecurityWageBase: 168_600, // 2026 annual wage base
  medicareRate: 0.0145,        // 1.45%
  additionalMedicareRate: 0.009, // 0.9% above $200k single
  additionalMedicareThreshold: 200_000,
  // Standard deduction (annual)
  standardDeduction: {
    single: 14_600,
    married: 29_200,
    head_of_household: 21_900,
  },
};

function calcUSFederalTax(annualGross: number, filingStatus: 'single' | 'married' | 'head_of_household'): number {
  const stdDed = US_TAX_CONFIG.standardDeduction[filingStatus];
  const taxableIncome = Math.max(0, annualGross - stdDed);
  const brackets = US_TAX_CONFIG[filingStatus];
  let tax = 0;
  let prev = 0;
  for (const bracket of brackets) {
    if (taxableIncome <= prev) break;
    const taxable = Math.min(taxableIncome, bracket.upTo) - prev;
    tax += taxable * bracket.rate;
    prev = bracket.upTo;
  }
  return tax;
}

export function calcUSTax(input: USTaxInput): USTaxResult {
  const { monthlyGross, filingStatus = 'single', totalHours } = input;
  const annualGross = monthlyGross * 12;

  // Federal income tax
  const annualFederal = calcUSFederalTax(annualGross, filingStatus);
  const federalIncomeTax = annualFederal / 12;

  // Social Security (6.2% up to annual wage base)
  const annualSSWages = Math.min(annualGross, US_TAX_CONFIG.socialSecurityWageBase);
  const socialSecurity = (annualSSWages * US_TAX_CONFIG.socialSecurityRate) / 12;

  // Medicare
  const medicare = monthlyGross * US_TAX_CONFIG.medicareRate;

  const totalDeductions = federalIncomeTax + socialSecurity + medicare;
  const netPay = Math.max(0, monthlyGross - totalDeductions);
  const effectiveTaxRate = monthlyGross > 0 ? (totalDeductions / monthlyGross) * 100 : 0;
  const effectiveHourlyNet = (totalHours && totalHours > 0) ? netPay / totalHours : 0;

  return {
    grossPay: monthlyGross,
    regularGross: monthlyGross,
    taxableGross: monthlyGross,
    cashGross: monthlyGross,
    federalIncomeTax,
    socialSecurity,
    medicare,
    incomeTax: federalIncomeTax,
    nationalInsurance: socialSecurity,
    healthInsurance: medicare,
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
    estimateNote: 'Federal estimate only. State/local taxes and personal circumstances may vary.',
  };
}
