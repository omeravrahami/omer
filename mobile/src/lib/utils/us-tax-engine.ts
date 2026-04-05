/**
 * US Federal Tax Engine — 2026 Tax Brackets (IRS Rev. Proc. 2025-32)
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

// 2026 Federal Income Tax Brackets (IRS Rev. Proc. 2025-32)
const US_TAX_CONFIG = {
  single: [
    { upTo: 12_400,  rate: 0.10 },
    { upTo: 50_400,  rate: 0.12 },
    { upTo: 105_700, rate: 0.22 },
    { upTo: 201_775, rate: 0.24 },
    { upTo: 256_225, rate: 0.32 },
    { upTo: 640_600, rate: 0.35 },
    { upTo: Infinity, rate: 0.37 },
  ],
  married: [
    { upTo: 24_800,  rate: 0.10 },
    { upTo: 100_800, rate: 0.12 },
    { upTo: 211_400, rate: 0.22 },
    { upTo: 403_550, rate: 0.24 },
    { upTo: 512_450, rate: 0.32 },
    { upTo: 768_700, rate: 0.35 },
    { upTo: Infinity, rate: 0.37 },
  ],
  head_of_household: [
    { upTo: 17_700,  rate: 0.10 },
    { upTo: 67_450,  rate: 0.12 },
    { upTo: 105_700, rate: 0.22 },
    { upTo: 201_750, rate: 0.24 },
    { upTo: 256_200, rate: 0.32 },
    { upTo: 640_600, rate: 0.35 },
    { upTo: Infinity, rate: 0.37 },
  ],
  // FICA
  socialSecurityRate: 0.062,       // 6.2% up to wage base
  socialSecurityWageBase: 176_100, // 2026 annual wage base
  medicareRate: 0.0145,            // 1.45%
  additionalMedicareRate: 0.009,   // 0.9% above $200k single
  additionalMedicareThreshold: 200_000,
  // Standard deduction 2026 (annual)
  standardDeduction: {
    single: 16_100,
    married: 32_200,
    head_of_household: 24_150,
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
