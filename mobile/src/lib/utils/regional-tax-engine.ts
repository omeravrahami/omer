/**
 * Regional Tax Engine - dispatches to the correct country engine
 */

import { calcIsraeliTax, TaxInput, TaxResult } from './tax-calc';
import { calcUSTax, USTaxInput } from './us-tax-engine';
import { calcUKTax, UKTaxInput } from './uk-tax-engine';
import { calcEUTax, EUTaxInput } from './eu-tax-engine';

export type Region = 'IL' | 'US' | 'UK' | 'EU';

export interface RegionalTaxInput {
  region: Region;
  monthlyGross: number;
  // Israel specific
  carBenefitMonthly?: number;
  creditPoints?: number;
  trainingFundValue?: number;
  trainingFundType?: 'percent' | 'fixed';
  transportationValue?: number;
  transportationType?: 'percent' | 'fixed';
  carGrossupMonthly?: number;
  oneTimeBonusTotal?: number;
  oneTimeGiftTotal?: number;
  employerPensionRate?: number;
  // US specific
  filingStatus?: 'single' | 'married' | 'head_of_household';
  // All regions
  totalHours?: number;
}

export interface RegionalTaxResult {
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
  isEstimate?: boolean;
  estimateNote?: string;
  region: Region;
}

export function calcRegionalTax(input: RegionalTaxInput): RegionalTaxResult {
  const { region } = input;

  switch (region) {
    case 'IL': {
      const ilInput: TaxInput = {
        monthlyGross: input.monthlyGross,
        carBenefitMonthly: input.carBenefitMonthly ?? 0,
        creditPoints: input.creditPoints ?? 2.25,
        trainingFundValue: input.trainingFundValue,
        trainingFundType: input.trainingFundType,
        transportationValue: input.transportationValue,
        transportationType: input.transportationType,
        carGrossupMonthly: input.carGrossupMonthly,
        oneTimeBonusTotal: input.oneTimeBonusTotal,
        oneTimeGiftTotal: input.oneTimeGiftTotal,
        employerPensionRate: input.employerPensionRate,
        totalHours: input.totalHours,
      };
      const result: TaxResult = calcIsraeliTax(ilInput);
      return { ...result, region: 'IL' };
    }

    case 'US': {
      const usInput: USTaxInput = {
        monthlyGross: input.monthlyGross,
        filingStatus: input.filingStatus ?? 'single',
        totalHours: input.totalHours,
      };
      const result = calcUSTax(usInput);
      return { ...result, region: 'US' };
    }

    case 'UK': {
      const ukInput: UKTaxInput = {
        monthlyGross: input.monthlyGross,
        totalHours: input.totalHours,
      };
      const result = calcUKTax(ukInput);
      return { ...result, region: 'UK' };
    }

    case 'EU': {
      const euInput: EUTaxInput = {
        monthlyGross: input.monthlyGross,
        totalHours: input.totalHours,
      };
      const result = calcEUTax(euInput);
      return { ...result, region: 'EU' };
    }

    default: {
      // Fallback to Israel
      const fallbackInput: TaxInput = {
        monthlyGross: input.monthlyGross,
        carBenefitMonthly: 0,
        creditPoints: 2.25,
        totalHours: input.totalHours,
      };
      const result: TaxResult = calcIsraeliTax(fallbackInput);
      return { ...result, region: 'IL' };
    }
  }
}

export function getRegionCurrency(region: Region): string {
  switch (region) {
    case 'IL': return 'ILS';
    case 'US': return 'USD';
    case 'UK': return 'GBP';
    case 'EU': return 'EUR';
    default: return 'ILS';
  }
}

export function getRegionCurrencySymbol(region: Region): string {
  switch (region) {
    case 'IL': return '₪';
    case 'US': return '$';
    case 'UK': return '£';
    case 'EU': return '€';
    default: return '₪';
  }
}

export function formatCurrency(amount: number, region: Region, language: string = 'en'): string {
  const locale = language === 'he' ? 'he-IL' :
                 region === 'US' ? 'en-US' :
                 region === 'UK' ? 'en-GB' :
                 region === 'EU' ? 'de-DE' : 'en-US';

  const currency = getRegionCurrency(region);

  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `${getRegionCurrencySymbol(region)}${Math.round(amount).toLocaleString()}`;
  }
}
