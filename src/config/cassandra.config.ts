import cassandra from 'cassandra-driver';
import { dbManager, NoSqlAdapter } from './database.config.js';
import { config } from './env.config.js';
import { logger } from '../services/logger.service.js';

let isConnected = false;

export const cassandraClient = new cassandra.Client({
  contactPoints: config.cassandra.contactPoints,
  localDataCenter: config.cassandra.localDataCenter,
  protocolOptions: {
    port: config.cassandra.port,
  },
  pooling: {
    coreConnectionsPerHost: {
      [cassandra.types.distance.local]: 2,
      [cassandra.types.distance.remote]: 1,
    },
  },
  socketOptions: {
    connectTimeout: 5000,
    readTimeout: 12000,
  },
});

export class CassandraAdapter implements NoSqlAdapter {
  name = 'cassandra';

  async connect(): Promise<void> {
    if (!isConnected) {
      await cassandraClient.connect();
      isConnected = true;
    }
  }

  async disconnect(): Promise<void> {
    if (isConnected) {
      await cassandraClient.shutdown();
      isConnected = false;
    }
  }

  isConnected(): boolean {
    return isConnected;
  }

  getClient<T = cassandra.Client>(): T {
    return cassandraClient as unknown as T;
  }
}

export const cassandraAdapter = new CassandraAdapter();
dbManager.registerNoSql('cassandra', cassandraAdapter);

export async function runCassandraMigrations(): Promise<void> {
  const keyspace = config.cassandra.keyspace;

  await cassandraClient.execute(`
    CREATE KEYSPACE IF NOT EXISTS ${keyspace}
    WITH replication = {
      'class': 'SimpleStrategy',
      'replication_factor': 1
    };
  `);

  await cassandraClient.execute(`
    CREATE TABLE IF NOT EXISTS ${keyspace}.http_metrics (
      bucket_day text,
      created_at timestamp,
      id timeuuid,
      route text,
      method text,
      status_code int,
      duration_ms int,
      ip_hash text,
      user_agent_category text,
      PRIMARY KEY ((bucket_day), created_at, id)
    ) WITH CLUSTERING ORDER BY (created_at DESC, id DESC)
      AND default_time_to_live = 2592000;
  `);

  await cassandraClient.execute(`
    CREATE TABLE IF NOT EXISTS ${keyspace}.http_metrics_by_route (
      route text,
      bucket_day text,
      created_at timestamp,
      id timeuuid,
      method text,
      status_code int,
      duration_ms int,
      PRIMARY KEY ((route, bucket_day), created_at, id)
    ) WITH CLUSTERING ORDER BY (created_at DESC, id DESC)
      AND default_time_to_live = 2592000;
  `);

  await cassandraClient.execute(`
    CREATE TABLE IF NOT EXISTS ${keyspace}.events (
      bucket_day text,
      created_at timestamp,
      id timeuuid,
      category text,
      event_name text,
      user_id int,
      session_id text,
      metadata text,
      PRIMARY KEY ((bucket_day), created_at, id)
    ) WITH CLUSTERING ORDER BY (created_at DESC, id DESC)
      AND default_time_to_live = 2592000;
  `);

  await cassandraClient.execute(`
    CREATE TABLE IF NOT EXISTS ${keyspace}.events_by_category (
      category text,
      bucket_day text,
      created_at timestamp,
      id timeuuid,
      event_name text,
      user_id int,
      session_id text,
      metadata text,
      PRIMARY KEY ((category, bucket_day), created_at, id)
    ) WITH CLUSTERING ORDER BY (created_at DESC, id DESC)
      AND default_time_to_live = 2592000;
  `);

  await cassandraClient.execute(`
    CREATE TABLE IF NOT EXISTS ${keyspace}.system_metrics (
      bucket_day text,
      created_at timestamp,
      id timeuuid,
      heap_used_mb double,
      heap_total_mb double,
      rss_mb double,
      event_loop_lag_ms double,
      active_requests int,
      PRIMARY KEY ((bucket_day), created_at, id)
    ) WITH CLUSTERING ORDER BY (created_at DESC, id DESC)
      AND default_time_to_live = 2592000;
  `);

  await cassandraClient.execute(`
    CREATE TABLE IF NOT EXISTS ${keyspace}.web_vitals (
      bucket_day text,
      created_at timestamp,
      id timeuuid,
      metric_name text,
      value double,
      rating text,
      page_path text,
      PRIMARY KEY ((bucket_day), created_at, id)
    ) WITH CLUSTERING ORDER BY (created_at DESC, id DESC)
      AND default_time_to_live = 2592000;
  `);

  const telemetryTables = [
    'http_metrics',
    'http_metrics_by_route',
    'events',
    'events_by_category',
    'system_metrics',
    'web_vitals',
  ];
  for (const t of telemetryTables) {
    try {
      await cassandraClient.execute(`ALTER TABLE ${keyspace}.${t} WITH default_time_to_live = 2592000;`);
    } catch {}
  }

  logger.db.info(`Tablas CQL de telemetría verificadas con TTL de 30 días en keyspace "${keyspace}".`);
}

export async function checkCassandraConnection(retries = 25, delayMs = 3000): Promise<void> {
  const contactPointsStr = config.cassandra.contactPoints.join(', ');
  for (let i = 1; i <= retries; i++) {
    try {
      await cassandraClient.connect();
      isConnected = true;
      logger.db.info(`Conexión establecida exitosamente con Apache Cassandra (${contactPointsStr}:${config.cassandra.port}).`);
      await runCassandraMigrations();
      return;
    } catch (err) {
      isConnected = false;
      logger.db.warn(`Esperando a Cassandra en ${contactPointsStr}:${config.cassandra.port} (intento ${i}/${retries})...`);
      if (i === retries) {
        logger.db.error('No se pudo conectar a Apache Cassandra tras múltiples intentos.', err);
        throw err;
      }
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
}

export function isCassandraReady(): boolean {
  return isConnected;
}

export default cassandraClient;
