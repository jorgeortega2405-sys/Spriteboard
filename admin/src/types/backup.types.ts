export interface BackupDatabaseOption {
  database: string;
  include_data: boolean;
  include_schema: boolean;
  tables: string[];
}

export interface BackupS3Option {
  buckets: string[];
  include: boolean;
  prefixes: string[];
}

export interface BackupCreatePayload {
  databases: BackupDatabaseOption[];
  description?: string;
  format?: 'tar.gz' | 'zip';
  include_cassandra?: boolean;
  include_redis?: boolean;
  name: string;
  s3?: BackupS3Option;
}

export interface BackupRecord {
  completed_at: string | null;
  created_at: string;
  created_by_user_id: number | null;
  created_by_username: string | null;
  current_step: string | null;
  databases_included: BackupDatabaseOption[] | null;
  description: string | null;
  duration_seconds: number;
  error_message: string | null;
  file_path: string | null;
  file_size_bytes: number;
  filename: string;
  format: 'tar.gz' | 'zip';
  id: number;
  include_cassandra: boolean;
  include_redis: boolean;
  include_s3: boolean;
  name: string;
  progress_percent: number;
  s3_buckets_included: string[] | null;
  status: 'completed' | 'failed' | 'in_progress' | 'pending';
  uuid: string;
}

export interface BackupTargetOptions {
  databases: Array<{
    name: string;
    table_count: number;
    tables: Array<{
      name: string;
      row_count: number;
      size_bytes: number;
    }>;
  }>;
  redis: {
    available: boolean;
    host: string;
  };
  s3: {
    available: boolean;
    bucket: string;
    folders: string[];
  };
}

export interface BackupListQuery {
  limit?: number;
  page?: number;
  search?: string;
  status?: string;
}
