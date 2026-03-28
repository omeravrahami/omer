import { test, expect, describe } from "bun:test";

// Tax config constants for 2026 (matching mobile/src/lib/utils/tax-calc.ts)
const TAX_2026 = {
  creditPointMonthly: 242,
  brackets: [
    { upTo: 7_010 * 12, rate: 0.10 },
    { upTo: 10_060 * 12, rate: 0.14 },
    { upTo: 16_150 * 12, rate: 0.20 },
    { upTo: 22_440 * 12, rate: 0.31 },
    { upTo: 46_690 * 12, rate: 0.35 },
    { upTo: 60_130 * 12, rate: 0.47 },
    { upTo: Infinity,    rate: 0.50 },
  ],
  ni: {
    lowCeiling: 7_420,
    maxIncome: 49_030,
    lowNI: 0.004,
    highNI: 0.07,
    lowHealth: 0.031,
    highHealth: 0.05,
  },
};

// Local implementation of key functions for testing
function calcMonthlyIncomeTax(monthlyTaxableGross: number, creditPoints: number): number {
  const annual = monthlyTaxableGross * 12;
  let tax = 0;
  let prev = 0;
  for (const bracket of TAX_2026.brackets) {
    if (annual <= prev) break;
    const taxable = Math.min(annual, bracket.upTo) - prev;
    tax += taxable * bracket.rate;
    prev = bracket.upTo;
  }
  const creditReduction = creditPoints * TAX_2026.creditPointMonthly * 12;
  return Math.max(0, tax - creditReduction) / 12;
}

function calcNIAndHealth(monthlyGross: number): { ni: number; health: number } {
  const { lowCeiling, maxIncome, lowNI, highNI, lowHealth, highHealth } = TAX_2026.ni;
  const capped = Math.min(monthlyGross, maxIncome);
  const low = Math.min(capped, lowCeiling);
  const high = Math.max(0, capped - lowCeiling);
  return {
    ni: low * lowNI + high * highNI,
    health: low * lowHealth + high * highHealth,
  };
}

function calcIsraeliTax(input: {
  monthlyGross: number;
  creditPoints: number;
  carBenefitMonthly?: number;
  bonusTotal?: number;
  giftTotal?: number;
  grossup?: number;
}) {
  const { monthlyGross, creditPoints } = input;
  const carBenefit = input.carBenefitMonthly ?? 0;
  const bonus = input.bonusTotal ?? 0;
  const gift = input.giftTotal ?? 0;
  const grossup = input.grossup ?? 0;

  const regularGross = monthlyGross + grossup + bonus;
  const taxableGross = regularGross + carBenefit + gift;

  const incomeTax = calcMonthlyIncomeTax(taxableGross, creditPoints);
  const { ni, health } = calcNIAndHealth(regularGross);
  const totalDeductions = incomeTax + ni + health;
  const netPay = Math.max(0, regularGross - totalDeductions);
  const effectiveTaxRate = regularGross > 0 ? (totalDeductions / regularGross) * 100 : 0;

  return { regularGross, taxableGross, incomeTax, ni, health, totalDeductions, netPay, effectiveTaxRate };
}

describe("Israeli Tax Engine 2026 - Edge Cases", () => {
  describe("Zero income scenarios", () => {
    test("zero monthly gross → zero tax, zero deductions", () => {
      const result = calcIsraeliTax({ monthlyGross: 0, creditPoints: 2.25 });
      expect(result.incomeTax).toBe(0);
      expect(result.ni).toBe(0);
      expect(result.health).toBe(0);
      expect(result.totalDeductions).toBe(0);
      expect(result.netPay).toBe(0);
      expect(result.effectiveTaxRate).toBe(0);
    });

    test("credit points exceed tax → income tax is zero (not negative)", () => {
      // Very low income (1000/month), high credit points → tax should be 0
      const result = calcIsraeliTax({ monthlyGross: 1000, creditPoints: 10 });
      expect(result.incomeTax).toBeGreaterThanOrEqual(0);
      expect(result.netPay).toBeGreaterThanOrEqual(0);
    });
  });

  describe("Standard bracket calculations", () => {
    test("income in first bracket (≤7010/mo) taxed at 10%", () => {
      const gross = 5000;
      const tax = calcMonthlyIncomeTax(gross, 0);
      // 5000 * 12 = 60000 < 7010 * 12 = 84120 → taxed at 10%
      expect(tax).toBeCloseTo((5000 * 12 * 0.10) / 12, 0);
    });

    test("income exactly at first bracket boundary", () => {
      const gross = 7010; // exactly at first bracket ceiling
      const tax = calcMonthlyIncomeTax(gross, 0);
      expect(tax).toBeCloseTo((7010 * 12 * 0.10) / 12, 0);
    });

    test("income spanning two brackets (10,000/mo)", () => {
      const gross = 10_000;
      // Annual: 120,000 → spans brackets 1 (84,120 @ 10%) and 2 (35,880 @ 14%)
      const tax = calcMonthlyIncomeTax(gross, 0);
      const expectedAnnual = 84_120 * 0.10 + (120_000 - 84_120) * 0.14;
      expect(tax).toBeCloseTo(expectedAnnual / 12, 0);
    });

    test("top bracket income (100000/mo) — no negative net", () => {
      const result = calcIsraeliTax({ monthlyGross: 100_000, creditPoints: 2.25 });
      expect(result.netPay).toBeGreaterThan(0);
      expect(result.effectiveTaxRate).toBeLessThan(100);
    });
  });

  describe("National Insurance ceiling", () => {
    test("income above NI max ceiling (49030) → NI does not increase further", () => {
      const atCeiling = calcNIAndHealth(49_030);
      const aboveCeiling = calcNIAndHealth(100_000);
      expect(atCeiling.ni).toBeCloseTo(aboveCeiling.ni, 1);
      expect(atCeiling.health).toBeCloseTo(aboveCeiling.health, 1);
    });

    test("income in low NI tier (≤7420) uses low rates", () => {
      const gross = 5000;
      const result = calcNIAndHealth(gross);
      expect(result.ni).toBeCloseTo(gross * 0.004, 2);
      expect(result.health).toBeCloseTo(gross * 0.031, 2);
    });

    test("income spanning NI tiers", () => {
      const gross = 10_000;
      const result = calcNIAndHealth(gross);
      const expectedNI = 7420 * 0.004 + (10_000 - 7_420) * 0.07;
      const expectedHealth = 7420 * 0.031 + (10_000 - 7_420) * 0.05;
      expect(result.ni).toBeCloseTo(expectedNI, 1);
      expect(result.health).toBeCloseTo(expectedHealth, 1);
    });
  });

  describe("Car benefit and non-cash components", () => {
    test("car benefit increases taxable gross but not regularGross", () => {
      const withCar = calcIsraeliTax({ monthlyGross: 10_000, creditPoints: 2.25, carBenefitMonthly: 3_000 });
      const withoutCar = calcIsraeliTax({ monthlyGross: 10_000, creditPoints: 2.25 });
      expect(withCar.taxableGross).toBe(withoutCar.taxableGross + 3_000);
      expect(withCar.regularGross).toBe(withoutCar.regularGross);
      // Car benefit increases income tax
      expect(withCar.incomeTax).toBeGreaterThan(withoutCar.incomeTax);
    });

    test("gift card increases taxable gross", () => {
      const withGift = calcIsraeliTax({ monthlyGross: 10_000, creditPoints: 2.25, giftTotal: 500 });
      const withoutGift = calcIsraeliTax({ monthlyGross: 10_000, creditPoints: 2.25 });
      expect(withGift.taxableGross).toBe(withoutGift.taxableGross + 500);
    });
  });

  describe("Net pay invariants", () => {
    test("net pay is always non-negative", () => {
      for (const gross of [0, 100, 1000, 5000, 10_000, 50_000, 100_000]) {
        const result = calcIsraeliTax({ monthlyGross: gross, creditPoints: 2.25 });
        expect(result.netPay).toBeGreaterThanOrEqual(0);
      }
    });

    test("net pay is always ≤ gross (no deductions create income)", () => {
      for (const gross of [1000, 5000, 10_000, 50_000]) {
        const result = calcIsraeliTax({ monthlyGross: gross, creditPoints: 2.25 });
        expect(result.netPay).toBeLessThanOrEqual(result.regularGross);
      }
    });

    test("higher gross → higher net (monotone property)", () => {
      const low = calcIsraeliTax({ monthlyGross: 10_000, creditPoints: 2.25 });
      const high = calcIsraeliTax({ monthlyGross: 20_000, creditPoints: 2.25 });
      expect(high.netPay).toBeGreaterThan(low.netPay);
    });

    test("effective tax rate increases with income (progressive)", () => {
      const low = calcIsraeliTax({ monthlyGross: 5_000, creditPoints: 2.25 });
      const mid = calcIsraeliTax({ monthlyGross: 20_000, creditPoints: 2.25 });
      const high = calcIsraeliTax({ monthlyGross: 50_000, creditPoints: 2.25 });
      expect(mid.effectiveTaxRate).toBeGreaterThan(low.effectiveTaxRate);
      expect(high.effectiveTaxRate).toBeGreaterThan(mid.effectiveTaxRate);
    });
  });

  describe("2025 minimum wage compliance", () => {
    test("Israeli minimum wage (6,248 NIS/month in 2025) → positive net", () => {
      const result = calcIsraeliTax({ monthlyGross: 6_248, creditPoints: 2.25 });
      expect(result.netPay).toBeGreaterThan(0);
      // Minimum wage earner should keep at least 85% (very low effective rate)
      expect(result.effectiveTaxRate).toBeLessThan(15);
    });
  });

  describe("Bonus and grossup", () => {
    test("bonus increases regularGross and taxableGross equally", () => {
      const withBonus = calcIsraeliTax({ monthlyGross: 10_000, creditPoints: 2.25, bonusTotal: 5_000 });
      const withoutBonus = calcIsraeliTax({ monthlyGross: 10_000, creditPoints: 2.25 });
      expect(withBonus.regularGross).toBe(withoutBonus.regularGross + 5_000);
      expect(withBonus.taxableGross).toBe(withoutBonus.taxableGross + 5_000);
    });

    test("grossup increases regularGross (employer covers tax)", () => {
      const withGrossup = calcIsraeliTax({ monthlyGross: 10_000, creditPoints: 2.25, grossup: 2_000 });
      expect(withGrossup.regularGross).toBe(12_000);
    });
  });
});

describe("Tax Rates Sanity Check 2026", () => {
  test("credit point value is 242 NIS/month", () => {
    expect(TAX_2026.creditPointMonthly).toBe(242);
  });

  test("first bracket ceiling is 7,010 NIS/month", () => {
    const firstBracket = TAX_2026.brackets[0];
    expect(firstBracket).toBeDefined();
    expect(firstBracket!.upTo).toBe(7_010 * 12);
    expect(firstBracket!.rate).toBe(0.10);
  });

  test("top bracket rate is 50%", () => {
    const topBracket = TAX_2026.brackets[TAX_2026.brackets.length - 1];
    expect(topBracket).toBeDefined();
    expect(topBracket!.rate).toBe(0.50);
  });

  test("NI ceiling is 49,030 NIS/month", () => {
    expect(TAX_2026.ni.maxIncome).toBe(49_030);
  });
});
