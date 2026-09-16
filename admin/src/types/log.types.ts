export type LogServiceSource = 'web' | 'admin';
export type LogCategory = 'app' | 'database' | 'security';
export type LogLevel = 'INFO' | 'WARN' | 'ERROR' | 'DEBUG';

export interface LogFileRecord {
  category: LogCategory;
  categoryLabel: string;
  errorCount: number;
  fileName: string;
  id: string;
  lineCount: number;
  service: LogServiceSource;
  serviceLabel: string;
  sizeBytes: number;
  sizeFormatted: string;
  updatedAt: string;
  warnCount: number;
}

export interface ParsedLogLine {
  category?: string;
  level?: LogLevel;
  lineNumber: number;
  message: string;
  raw: string;
  timestamp?: string;
}

export interface LogStats {
  debugCount: number;
  errorCount: number;
  infoCount: number;
  totalLines: number;
  warnCount: number;
}

export interface LogFileContent {
  category: LogCategory;
  categoryLabel: string;
  fileName: string;
  id: string;
  lines: ParsedLogLine[];
  rawContent: string;
  service: LogServiceSource;
  serviceLabel: string;
  sizeBytes: number;
  stats: LogStats;
  updatedAt: string;
}
