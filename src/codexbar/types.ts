export interface CodexbarProviderToggle {
  provider: string;
  displayName?: string;
  enabled: boolean;
  defaultEnabled?: boolean;
}

export interface CodexbarUsageWindow {
  usedPercent?: number;
  resetsAt?: string;
  resetDescription?: string;
  windowMinutes?: number;
}

export interface CodexbarUsage {
  updatedAt?: string;
  primary?: CodexbarUsageWindow | null;
  secondary?: CodexbarUsageWindow | null;
  tertiary?: CodexbarUsageWindow | null;
  identity?: Record<string, unknown>;
}

export interface CodexbarStatus {
  indicator?: string;
  description?: string;
  updatedAt?: string;
  url?: string;
}

export interface CodexbarProviderError {
  code?: number;
  kind?: string;
  message?: string;
}

export interface CodexbarUsageRecord {
  provider: string;
  source?: string;
  account?: string;
  version?: string;
  usage?: CodexbarUsage;
  status?: CodexbarStatus;
  error?: CodexbarProviderError;
}

export interface CodexbarCostDaily {
  date?: string;
  totalCost?: number;
  totalTokens?: number;
  modelsUsed?: string[];
}

export interface CodexbarCostRecord {
  provider: string;
  source?: string;
  currencyCode?: string;
  last30DaysCostUSD?: number;
  sessionCostUSD?: number;
  sessionTokens?: number;
  last30DaysTokens?: number;
  updatedAt?: string;
  daily?: CodexbarCostDaily[];
}

export interface CodexbarConfigValidationIssue {
  level?: string;
  path?: string;
  message?: string;
  [key: string]: unknown;
}

export type CodexbarConfigValidateResult =
  | CodexbarConfigValidationIssue[]
  | {
      valid?: boolean;
      errors?: string[];
      warnings?: string[];
      [key: string]: unknown;
    };

export interface CodexbarConfigProviderEntry {
  id: string;
  enabled?: boolean;
  [key: string]: unknown;
}

export interface CodexbarConfigDumpResult {
  version?: number;
  providers?: CodexbarConfigProviderEntry[];
  [key: string]: unknown;
}

export interface CodexbarProviderDiagnostic {
  schemaVersion?: string;
  provider?: string;
  displayName?: string;
  source?: string;
  sourceMode?: string;
  timestamp?: string;
  error?: {
    category?: string;
    safeDescription?: string;
  };
  usage?: {
    windows?: Array<{
      label?: string;
      usedPercent?: number;
    }>;
  };
  [key: string]: unknown;
}

export type CodexbarDiagnoseResult =
  | CodexbarProviderDiagnostic
  | {
      schemaVersion?: string;
      timestamp?: string;
      diagnostics?: CodexbarProviderDiagnostic[];
      [key: string]: unknown;
    };

export interface CodexbarCommandResult {
  stdout: string;
  stderr: string;
}
