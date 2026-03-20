export interface Settings {
  id: string;
  deviceId: string;
  hourlyRate: number;
  currency: string;
  dailyGoalHours: number;
  weeklyGoalHours: number;
  defaultBreakMinutes: number;
  showSalaryOnDashboard: boolean;
  themeMode: string;
  isPro: boolean;
  onboardingCompleted: boolean;
}

export interface BreakSession {
  id: string;
  workSessionId: string;
  startTime: string;
  endTime: string | null;
  durationMinutes: number;
}

export interface WorkSession {
  id: string;
  deviceId: string;
  date: string;
  startTime: string;
  endTime: string | null;
  grossMinutes: number;
  breakMinutes: number;
  netMinutes: number;
  totalPay: number;
  notes: string;
  workplaceName: string;
  status: 'active' | 'completed';
  sessionType: 'shift' | 'sick' | 'vacation';
  breaks: BreakSession[];
}

export interface Stats {
  totalHours: number;
  totalPay: number;
  avgHoursPerDay: number;
  workDaysCount: number;
  dailyGoalProgress: number;
  weeklyGoalProgress: number;
  dailyData: { date: string; hours: number; pay: number }[];
}
