import { logger } from '../services/logger.service.js';
import { dbManager, NoSqlAdapter } from './database.config.js';
import { config } from './env.config.js';
import cassandra from 'cassandra-driver';

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

  await cassandraClient.execute(`
    CREATE KEYSPACE IF NOT EXISTS spriteboard_support
    WITH replication = {
      'class': 'SimpleStrategy',
      'replication_factor': 1
    };
  `);

  await cassandraClient.execute(`
    CREATE TABLE IF NOT EXISTS spriteboard_support.conversations_by_user (
      user_id int,
      created_at timestamp,
      ticket_id int,
      ticket_uuid text,
      ticket_number text,
      subject text,
      description text,
      status text,
      priority text,
      assigned_agent_id int,
      assigned_agent_name text,
      updated_at timestamp,
      closed_at timestamp,
      last_message text,
      last_message_sender text,
      last_message_at timestamp,
      total_messages int,
      PRIMARY KEY ((user_id), created_at, ticket_id)
    ) WITH CLUSTERING ORDER BY (created_at DESC, ticket_id DESC);
  `);

  await cassandraClient.execute(`
    CREATE TABLE IF NOT EXISTS spriteboard_support.tickets_by_id (
      ticket_id int,
      user_id int,
      ticket_uuid text,
      ticket_number text,
      subject text,
      description text,
      status text,
      priority text,
      assigned_agent_id int,
      assigned_agent_name text,
      created_at timestamp,
      updated_at timestamp,
      closed_at timestamp,
      last_message text,
      last_message_sender text,
      last_message_at timestamp,
      total_messages int,
      PRIMARY KEY (ticket_id)
    );
  `);

  await cassandraClient.execute(`
    CREATE TABLE IF NOT EXISTS spriteboard_support.messages_by_ticket (
      ticket_id int,
      created_at timestamp,
      id int,
      sender_type text,
      sender_id int,
      sender_name text,
      sender_avatar text,
      message text,
      PRIMARY KEY ((ticket_id), created_at, id)
    ) WITH CLUSTERING ORDER BY (created_at ASC, id ASC);
  `);

  logger.db.info(`Tablas CQL de telemetría y soporte verificadas en Apache Cassandra.`);
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
