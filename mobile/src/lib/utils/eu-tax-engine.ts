/**
 * European Generic Tax Engine
 * This is a simplified generic estimate for EU countries.
 * Actual taxes vary significantly by country. Country-specific
 * engines will replace this in future versions.
 */

export interface EUTaxInput {
  monthlyGross: number;
  country?: string; // for display only
  totalHours?: number;
}

export interface EUTaxResult {
  grossPay: number;
  regularGross: number;
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
  effectiveHourlyNet: number;
  netToGrossRatio: number;
  isEstimate: true;
  estimateNote: string;
}

// Generic EU estimates (average across major EU economies)
// These are rough approximations only
const EU_TAX_CONFIG = {
  incomeTaxBrackets: [
    { upTo: 10_000 * 12, rate: 0.20 },
    { upTo: 30_000 * 12, rate: 0.30 },
    { upTo: 60_000 * 12, rate: 0.40 },
    { upTo: Infinity, rate: 0.47 },
  ],
  socialContributionRate: 0.10, // average social security / health
};

export function calcEUTax(input: EUTaxInput): EUTaxResult {
  const { monthlyGross, totalHours } = input;
  const annualGross = monthlyGross * 12;

  let annualIncomeTax = 0;
  let prev = 0;
  for (const bracket of EU_TAX_CONFIG.incomeTaxBrackets) {
    if (annualGross <= prev) break;
    const taxable = Math.min(annualGross, bracket.upTo) - prev;
    annualIncomeTax += taxable * bracket.rate;
    prev = bracket.upTo;
  }
  const incomeTax = annualIncomeTax / 12;
  const nationalInsurance = monthlyGross * EU_TAX_CONFIG.socialContributionRate;
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
    estimateNote: 'Generic EU estimate. Tax rates vary significantly by country.',
  };
}
