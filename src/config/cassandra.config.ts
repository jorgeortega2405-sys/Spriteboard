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

export async function checkCassandraConnection(retries = 25, delayMs = 3000): Promise<void> {
  const contactPointsStr = config.cassandra.contactPoints.join(', ');
  for (let i = 1; i <= retries; i++) {
    try {
      await cassandraClient.connect();
      isConnected = true;
      logger.db.info(`Conexión establecida exitosamente con Apache Cassandra (${contactPointsStr}:${config.cassandra.port}).`);
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
