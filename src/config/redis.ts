import { Redis } from 'ioredis';
import { config } from './env.js';

export const redis = new Redis({
  host: config.redis.host,
  port: config.redis.port,
  lazyConnect: true,
  maxRetriesPerRequest: 3,
  retryStrategy(times) {
    const delay = Math.min(times * 100, 2000);
    return delay;
  },
});

redis.on('error', (err) => {
  console.warn('⚠️ Advertencia en cliente Redis:', err.message);
});

export async function checkRedisConnection(retries = 10, delayMs = 1500): Promise<void> {
  for (let i = 1; i <= retries; i++) {
    try {
      if (redis.status !== 'ready' && redis.status !== 'connecting') {
        await redis.connect();
      }
      const pong = await redis.ping();
      if (pong === 'PONG') {
        console.log('✅ Conexión establecida exitosamente con Redis.');
        return;
      }
    } catch (err) {
      console.warn(`⏳ Esperando a Redis en ${config.redis.host}:${config.redis.port} (intento ${i}/${retries})...`);
      if (i === retries) {
        console.error('❌ No se pudo conectar a Redis después de múltiples intentos.');
        throw err;
      }
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
}

export default redis;
