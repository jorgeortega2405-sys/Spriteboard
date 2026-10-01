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

export async function checkCassandraConnection(retries = 10, delayMs = 2000): Promise<void> {
  const contactPointsStr = config.cassandra.contactPoints.join(', ');
  for (let i = 1; i <= retries; i++) {
    try {
      await cassandraClient.connect();
      isConnected = true;
      logger.db.info(`Conexión establecida exitosamente con Apache Cassandra desde Admin (${contactPointsStr}:${config.cassandra.port}).`);
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
