// ─── User ────────────────────────────────────────────────────────────────────

export interface User {
  id: string;
  email: string;
  displayName: string | null;
  plan: 'free' | 'pro' | 'team' | string;
  createdAt: string;
  lastLogin: string;
  isOnline: boolean;
  deleted: boolean;
  aiSpent: number | null;
  aiLimit: number | null;
  aiPercent: number | null;
  location: string | null;
  provider: string | null;
}

// ─── Project ─────────────────────────────────────────────────────────────────

export interface Project {
  id: string;
  projectId: string;
  name: string;
  userId: string;
  userEmail: string;
  userPlan: string;
  userDisplayName: string | null;
  type: 'git' | 'app' | string;
  repositoryUrl: string | null;
  template: string | null;
  language: string | null;
  framework: string | null;
}

// ─── Published Site ──────────────────────────────────────────────────────────

export interface PublishedSite {
  id: string;
  slug: string;
  url: string;
  projectId: string;
  publishedAt: string;
  owner: {
    userId: string;
    email: string;
    displayName: string | null;
  };
}

// ─── Overview Stats ──────────────────────────────────────────────────────────

export interface OverviewStats {
  totalUsers: number;
  activeUsers: number;
  totalProjects: number;
  gitProjects: number;
  appProjects: number;
  activeContainers: number;
  aiCostMonth: number;
  countryDistribution: Record<string, number>;
}

// ─── Behavior Data ───────────────────────────────────────────────────────────

export interface BehaviorRetention {
  dau: number;
  wau: number;
  mau: number;
  wauTrend: number;
  dauEmails: string[];
}

export interface DailyActiveEntry {
  date: string;
  count: number;
}

export interface DayOfWeekEntry {
  day: string;
  avg: number;
}

export interface AiModelTrendEntry {
  date: string;
  [model: string]: string | number;
}

export interface FrameworkPopularityEntry {
  framework: string;
  count: number;
}

export interface OperationTypeEntry {
  type: string;
  count: number;
}

export interface NewUserEntry {
  email: string;
  createdAt: string;
  displayName: string | null;
}

export interface EngagementScoreEntry {
  email: string;
  score: number;
  sessions: number;
  aiCalls: number;
  projects: number;
  lastLogin: string;
}

export interface BehaviorData {
  retention: BehaviorRetention;
  activity: {
    dailyActiveUsers: DailyActiveEntry[];
    avgByDayOfWeek: DayOfWeekEntry[];
  };
  aiModelTrend: AiModelTrendEntry[] | { labels: string[]; datasets: Record<string, number[]> };
  frameworkPopularity: { labels: string[]; data: number[] } | FrameworkPopularityEntry[];
  operationsByType: OperationTypeEntry[];
  newUsers7d: { count: number; emails: string[] } | NewUserEntry[];
  paidPercent: number;
  paidCount: number;
  allUsers: EngagementScoreEntry[];
  totalEngagedUsers: number;
}

// ─── Report Data ─────────────────────────────────────────────────────────────

export interface ReportDay {
  date: string;
  activeUsers: number;
  newUsers: number;
  totalUsers: number;
  activeUserEmails: string[];
  newUserEmails: string[];
  userSessions?: Record<string, unknown>;
}

export interface ReportSummary {
  avgDau: number;
  totalSignups: number;
  peakDau: number;
  peakDate: string;
}

export interface ReportData {
  dateRange: {
    from: string;
    to: string;
  };
  days: ReportDay[];
  summary: ReportSummary;
}

// ─── Container Diagnostics ───────────────────────────────────────────────────

export interface ContainerSystemInfo {
  cpu: {
    cores: number;
    loadAvg1m: number;
    loadAvg5m: number;
    loadAvg15m: number;
  };
  memory: {
    total: number;
    used: number;
    available: number;
  };
  disk: {
    total: number;
    used: number;
    available: number;
  };
  uptimeSeconds: number;
}

export interface ContainerInfo {
  id: string;
  name: string;
  image: string;
  state: string;
  status: string;
  ports: string;
  createdAt: string;
  projectId: string | null;
  owner: {
    userId: string;
    email: string;
    displayName: string | null;
  } | null;
  stats: {
    cpu: string;
    memory: string;
    memoryPercent: string;
    network: string;
    blockIO: string;
    processes: number;
  } | null;
  limits: {
    memoryBytes: number;
    cpuCores: number;
  };
  startedAt: string | null;
  finishedAt: string | null;
  sessionLastUsed: number | null;
  sessionIdleMs: number | null;
  sessionActive: boolean;
  destroyInMs: number | null;
}

export interface ContainerDiagnostics {
  system: ContainerSystemInfo;
  containers: ContainerInfo[];
  runningContainers: number;
  totalContainers: number;
  allocatedMemory: number;
}

// ─── Presence ────────────────────────────────────────────────────────────────

export interface PresenceUser {
  id: string;
  email: string;
  name: string | null;
  location: string | { city?: string; country?: string; lat?: number; lng?: number } | null;
  lastSeen: string;
  onlineFor: number;
}

// ─── User Behavior Detail ────────────────────────────────────────────────────

export interface UserBehaviorDetail {
  email: string;
  uid: string;
  displayName: string | null;
  plan: string;
  createdAt: string;
  lastLogin: string;
  totalAiCalls: number;
  totalDaysActive: number;
  aiByModel: { labels: string[]; data: number[] };
  aiTrend: { labels: string[]; data: number[] };
  operationsByType: Record<string, number>;
  activityDays: ({ date: string } | string)[];
  projects: Project[];
  aiBudget: { spent: number; limit: number; percent: number } | null;
  onboarding?: Record<string, unknown>;
}

// ─── User Events ─────────────────────────────────────────────────────────────

export interface UserEvent {
  type: string;
  screen: string;
  timestamp: string;
  time?: string;
  data?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface UserEvents {
  email: string;
  date: string;
  totalEvents: number;
  screenCounts: Record<string, number>;
  events: UserEvent[];
}

// ─── AI Costs ────────────────────────────────────────────────────────────────

export interface AiCostUser {
  email: string;
  uid: string;
  spent: number;
  limit: number;
  percentUsed: number;
}

export interface AiCosts {
  totalCost: number;
  byUser: AiCostUser[];
}

// ─── Analytics ───────────────────────────────────────────────────────────────

export interface TimeSeriesEntry {
  date: string;
  count: number;
}

export interface PlanDistributionEntry {
  plan: string;
  count: number;
  percent: number;
}

export interface AnalyticsData {
  usersByDay: TimeSeriesEntry[];
  newUsersByDay: TimeSeriesEntry[];
  operations: OperationTypeEntry[];
  planDistribution: PlanDistributionEntry[];
}

// ─── API Response Wrapper ────────────────────────────────────────────────────

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  error?: string;
}
