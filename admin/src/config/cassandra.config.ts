import cassandra from 'cassandra-driver';
import { config } from './env.config.js';
import { logger } from '../services/logger.service.js';

let isConnected = false;

export const cassandraClient = new cassandra.Client({
  contactPoints: config.cassandra.contactPoints,
  localDataCenter: config.cassandra.localDataCenter,
  pooling: {
    coreConnectionsPerHost: {
      [cassandra.types.distance.local]: 2,
      [cassandra.types.distance.remote]: 1,
    },
  },
  protocolOptions: {
    port: config.cassandra.port,
  },
  socketOptions: {
    connectTimeout: 5000,
    readTimeout: 12000,
  },
});

export async function runCassandraAdminMigrations(): Promise<void> {
  await cassandraClient.execute(`
    CREATE KEYSPACE IF NOT EXISTS spriteboard_audit
    WITH replication = {
      'class': 'SimpleStrategy',
      'replication_factor': 1
    };
  `);

  await cassandraClient.execute(`
    CREATE TABLE IF NOT EXISTS spriteboard_audit.admin_audit_logs (
      bucket_month text,
      created_at timestamp,
      id timeuuid,
      actor_id int,
      actor_username text,
      actor_role text,
      action text,
      module text,
      target_type text,
      target_id text,
      description text,
      old_values text,
      new_values text,
      ip_address text,
      user_agent text,
      risk_level text,
      status text,
      PRIMARY KEY ((bucket_month), created_at, id)
    ) WITH CLUSTERING ORDER BY (created_at DESC, id DESC);
  `);

  await cassandraClient.execute(`
    CREATE TABLE IF NOT EXISTS spriteboard_audit.audit_by_actor (
      actor_id int,
      bucket_month text,
      created_at timestamp,
      id timeuuid,
      action text,
      module text,
      target_type text,
      target_id text,
      description text,
      risk_level text,
      ip_address text,
      PRIMARY KEY ((actor_id, bucket_month), created_at, id)
    ) WITH CLUSTERING ORDER BY (created_at DESC, id DESC);
  `);

  await cassandraClient.execute(`
    CREATE TABLE IF NOT EXISTS spriteboard_audit.audit_by_target (
      target_type text,
      target_id text,
      created_at timestamp,
      id timeuuid,
      actor_id int,
      actor_username text,
      action text,
      description text,
      new_values text,
      PRIMARY KEY ((target_type, target_id), created_at, id)
    ) WITH CLUSTERING ORDER BY (created_at DESC, id DESC);
  `);

  await cassandraClient.execute(`
    CREATE KEYSPACE IF NOT EXISTS spriteboard_ai
    WITH replication = {
      'class': 'SimpleStrategy',
      'replication_factor': 1
    };
  `);

  await cassandraClient.execute(`
    CREATE TABLE IF NOT EXISTS spriteboard_ai.chat_messages (
      session_id text,
      created_at timestamp,
      message_id timeuuid,
      user_id int,
      username text,
      is_admin boolean,
      sender_role text,
      content text,
      model_name text,
      tokens_prompt int,
      tokens_completion int,
      feedback_rating text,
      metadata text,
      PRIMARY KEY ((session_id), created_at, message_id)
    ) WITH CLUSTERING ORDER BY (created_at ASC, message_id ASC);
  `);

  await cassandraClient.execute(`
    CREATE TABLE IF NOT EXISTS spriteboard_ai.chat_sessions_by_user (
      user_id int,
      bucket_month text,
      created_at timestamp,
      session_id text,
      first_message text,
      total_messages int,
      last_message_at timestamp,
      PRIMARY KEY ((user_id, bucket_month), created_at, session_id)
    ) WITH CLUSTERING ORDER BY (created_at DESC, session_id DESC);
  `);

  await cassandraClient.execute(`
    CREATE TABLE IF NOT EXISTS spriteboard_ai.copilot_query_audit (
      admin_id int,
      bucket_month text,
      created_at timestamp,
      id timeuuid,
      admin_username text,
      page_context text,
      user_prompt text,
      model_reply text,
      sql_queries_executed text,
      execution_time_ms int,
      success boolean,
      PRIMARY KEY ((admin_id, bucket_month), created_at, id)
    ) WITH CLUSTERING ORDER BY (created_at DESC, id DESC);
  `);

  logger.db.info('Tablas CQL de Auditoría y AI Copilot verificadas en Apache Cassandra desde Admin.');
}

export async function checkCassandraConnection(retries = 10, delayMs = 2000): Promise<void> {
  const contactPointsStr = config.cassandra.contactPoints.join(', ');
  for (let i = 1; i <= retries; i++) {
    try {
      await cassandraClient.connect();
      isConnected = true;
      logger.db.info(`Conexión establecida exitosamente con Apache Cassandra desde Admin (${contactPointsStr}:${config.cassandra.port}).`);
      await runCassandraAdminMigrations();
      return;
    } catch (err) {
      isConnected = false;
      logger.db.warn(`Esperando a Cassandra en ${contactPointsStr}:${config.cassandra.port} (intento ${i}/${retries})...`);
      if (i === retries) {
        logger.db.error('No se pudo conectar a Apache Cassandra desde Admin tras múltiples intentos.', err);
        throw err;
      }
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
}

export function isCassandraReady(): boolean {
  return isConnected;
}
