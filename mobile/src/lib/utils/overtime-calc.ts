/**
 * Overtime pay calculation based on Israeli labor law.
 */

/**
 * Calculate pay for a single shift using daily overtime rules:
 *   0–8 hours   → ×1.00
 *   8–10 hours  → ×1.25
 *   10+ hours   → ×1.50
 */
export function calcOvertimePay(
  netMinutes: number,
  hourlyRate: number,
  mode: 'daily' | 'monthly'
): number {
  if (mode === 'daily') {
    return calcDailyOvertimePay(netMinutes, hourlyRate);
  }
  return calcMonthlyOvertimePay(netMinutes, hourlyRate);
}

function calcDailyOvertimePay(netMinutes: number, hourlyRate: number): number {
  const hours = netMinutes / 60;

  // Tier 1: 0–8 hours at ×1.00
  const tier1Hours = Math.min(hours, 8);
  const tier1Pay = tier1Hours * hourlyRate * 1.0;

  if (hours <= 8) return tier1Pay;

  // Tier 2: 8–10 hours at ×1.25
  const tier2Hours = Math.min(hours - 8, 2);
  const tier2Pay = tier2Hours * hourlyRate * 1.25;

  if (hours <= 10) return tier1Pay + tier2Pay;

  // Tier 3: 10+ hours at ×1.50 (capped concept: >12 still ×1.50)
  const tier3Hours = hours - 10;
  const tier3Pay = tier3Hours * hourlyRate * 1.5;

  return tier1Pay + tier2Pay + tier3Pay;
}

function calcMonthlyOvertimePay(netMinutes: number, hourlyRate: number): number {
  const hours = netMinutes / 60;

  // Tier 1: 0–182 hours at ×1.00
  const tier1Hours = Math.min(hours, 182);
  const tier1Pay = tier1Hours * hourlyRate * 1.0;

  if (hours <= 182) return tier1Pay;

  // Tier 2: 182–210 hours at ×1.25
  const tier2Hours = Math.min(hours - 182, 28);
  const tier2Pay = tier2Hours * hourlyRate * 1.25;

  if (hours <= 210) return tier1Pay + tier2Pay;

  // Tier 3: >210 hours at ×1.50
  const tier3Hours = hours - 210;
  const tier3Pay = tier3Hours * hourlyRate * 1.5;

  return tier1Pay + tier2Pay + tier3Pay;
}

/**
 * Sum up daily overtime pay for all sessions in a month.
 * Used when showing monthly totals with daily mode enabled.
 */
export function calcOvertimePayMonthly(
  sessions: { netMinutes: number }[],
  hourlyRate: number
): number {
  return sessions.reduce(
    (sum, s) => sum + calcDailyOvertimePay(s.netMinutes, hourlyRate),
    0
  );
}
