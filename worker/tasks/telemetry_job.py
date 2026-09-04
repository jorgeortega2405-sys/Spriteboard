import json
import time
from datetime import datetime, timezone
import redis
from cassandra.cluster import Cluster
from cassandra.query import BatchStatement, ConsistencyLevel
from cassandra.util import uuid_from_time
from config import config
from .base import BaseJob

QUEUE_KEY = "telemetry:queue"
MAX_BATCH_SIZE = 100

class TelemetryJob(BaseJob):
    """
    Consumidor de telemetría de alto rendimiento:
    Drena la cola 'telemetry:queue' de Redis y persiste los eventos
    por lotes en Apache Cassandra usando prepared statements.
    """

    def __init__(self):
        super().__init__("telemetry")
        self.redis_client = None
        self.cassandra_cluster = None
        self.cassandra_session = None

        # Prepared statements
        self.stmt_http_metrics = None
        self.stmt_http_by_route = None
        self.stmt_events = None
        self.stmt_events_by_category = None
        self.stmt_system = None
        self.stmt_vitals = None

    def setup(self) -> None:
        self.logger.info("Inicializando conexiones para TelemetryJob...")
        self._init_redis()
        self._init_cassandra()
        self._prepare_statements()
        self.logger.info("TelemetryJob preparado y listo para procesar eventos.")

    def _init_redis(self) -> None:
        self.logger.info(f"Conectando a Redis en {config.REDIS_HOST}:{config.REDIS_PORT}...")
        self.redis_client = redis.Redis(
            host=config.REDIS_HOST,
            port=config.REDIS_PORT,
            password=config.REDIS_PASSWORD,
            decode_responses=True,
            socket_timeout=5,
        )
        self.redis_client.ping()
        self.logger.info("Conexión con Redis establecida exitosamente.")

    def _init_cassandra(self, retries=20, delay_sec=3) -> None:
        self.logger.info(f"Conectando a Apache Cassandra en {config.CASSANDRA_CONTACT_POINTS}:{config.CASSANDRA_PORT}...")
        for attempt in range(1, retries + 1):
            try:
                self.cassandra_cluster = Cluster(
                    contact_points=config.CASSANDRA_CONTACT_POINTS,
                    port=config.CASSANDRA_PORT,
                    connect_timeout=10,
                )
                self.cassandra_session = self.cassandra_cluster.connect(config.CASSANDRA_KEYSPACE)
                self.logger.info(f"Conexión con Cassandra establecida en keyspace '{config.CASSANDRA_KEYSPACE}'.")
                return
            except Exception as e:
                self.logger.warning(f"Esperando a Cassandra ({attempt}/{retries})...")
                if attempt == retries:
                    self.logger.error("No se pudo conectar a Apache Cassandra tras múltiples intentos.", exc_info=True)
                    raise
                time.sleep(delay_sec)

    def _prepare_statements(self) -> None:
        ks = config.CASSANDRA_KEYSPACE

        self.stmt_http_metrics = self.cassandra_session.prepare(
            f"""
            INSERT INTO {ks}.http_metrics (bucket_day, created_at, id, route, method, status_code, duration_ms, ip_hash, user_agent_category)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """
        )

        self.stmt_http_by_route = self.cassandra_session.prepare(
            f"""
            INSERT INTO {ks}.http_metrics_by_route (route, bucket_day, created_at, id, method, status_code, duration_ms)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """
        )

        self.stmt_events = self.cassandra_session.prepare(
            f"""
            INSERT INTO {ks}.events (bucket_day, created_at, id, category, event_name, user_id, session_id, metadata)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """
        )

        self.stmt_events_by_category = self.cassandra_session.prepare(
            f"""
            INSERT INTO {ks}.events_by_category (category, bucket_day, created_at, id, event_name, user_id, session_id, metadata)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """
        )

        self.stmt_system = self.cassandra_session.prepare(
            f"""
            INSERT INTO {ks}.system_metrics (bucket_day, created_at, id, heap_used_mb, heap_total_mb, rss_mb, event_loop_lag_ms, active_requests)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """
        )

        self.stmt_vitals = self.cassandra_session.prepare(
            f"""
            INSERT INTO {ks}.web_vitals (bucket_day, created_at, id, metric_name, value, rating, page_path)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """
        )

    def run_cycle(self) -> float:
        """Extrae un lote de eventos de Redis y los vuelca en Cassandra."""
        try:
            # Drenar hasta MAX_BATCH_SIZE elementos de la cola
            pipe = self.redis_client.pipeline()
            pipe.lrange(QUEUE_KEY, 0, MAX_BATCH_SIZE - 1)
            pipe.ltrim(QUEUE_KEY, MAX_BATCH_SIZE, -1)
            raw_items, _ = pipe.execute()

            if not raw_items:
                return 1.0  # Si la cola está vacía, descansar 1 segundo

            self._process_batch(raw_items)

            # Si leímos un lote completo, no descansar para drenar rápidamente
            return 0.0 if len(raw_items) >= MAX_BATCH_SIZE else 0.5
        except Exception as e:
            self.logger.error("Error en ciclo de procesamiento de telemetría", exc_info=True)
            return 2.0

    def _process_batch(self, raw_items: list) -> None:
        futures = []

        for raw in raw_items:
            try:
                item = json.loads(raw)
            except Exception:
                continue

            item_type = item.get("type")
            payload = item.get("payload", {})
            created_at = datetime.now(timezone.utc)
            bucket_day = created_at.strftime("%Y-%m-%d")
            time_uuid = uuid_from_time(time.time())

            if item_type == "http":
                # Inserción en http_metrics y http_metrics_by_route
                f1 = self.cassandra_session.execute_async(
                    self.stmt_http_metrics,
                    (
                        bucket_day,
                        created_at,
                        time_uuid,
                        payload.get("route", "/"),
                        payload.get("method", "GET"),
                        int(payload.get("statusCode", 200)),
                        int(payload.get("durationMs", 0)),
                        payload.get("ipHash", "unknown"),
                        payload.get("userAgentCategory", "desktop"),
                    ),
                )
                f2 = self.cassandra_session.execute_async(
                    self.stmt_http_by_route,
                    (
                        payload.get("route", "/"),
                        bucket_day,
                        created_at,
                        time_uuid,
                        payload.get("method", "GET"),
                        int(payload.get("statusCode", 200)),
                        int(payload.get("durationMs", 0)),
                    ),
                )
                futures.extend([f1, f2])

            elif item_type == "event":
                meta = payload.get("metadata")
                meta_str = json.dumps(meta) if meta and isinstance(meta, (dict, list)) else None
                user_id = payload.get("userId")
                cat = payload.get("category", "general")

                f1 = self.cassandra_session.execute_async(
                    self.stmt_events,
                    (
                        bucket_day,
                        created_at,
                        time_uuid,
                        cat,
                        payload.get("eventName", "unnamed"),
                        int(user_id) if user_id is not None else None,
                        payload.get("sessionId"),
                        meta_str,
                    ),
                )
                f2 = self.cassandra_session.execute_async(
                    self.stmt_events_by_category,
                    (
                        cat,
                        bucket_day,
                        created_at,
                        time_uuid,
                        payload.get("eventName", "unnamed"),
                        int(user_id) if user_id is not None else None,
                        payload.get("sessionId"),
                        meta_str,
                    ),
                )
                futures.extend([f1, f2])

            elif item_type == "system":
                f1 = self.cassandra_session.execute_async(
                    self.stmt_system,
                    (
                        bucket_day,
                        created_at,
                        time_uuid,
                        float(payload.get("heapUsedMb", 0)),
                        float(payload.get("heapTotalMb", 0)),
                        float(payload.get("rssMb", 0)),
                        float(payload.get("eventLoopLagMs", 0)),
                        int(payload.get("activeRequests", 0)),
                    ),
                )
                futures.append(f1)

            elif item_type == "vital":
                f1 = self.cassandra_session.execute_async(
                    self.stmt_vitals,
                    (
                        bucket_day,
                        created_at,
                        time_uuid,
                        str(payload.get("metricName", "UNKNOWN")),
                        float(payload.get("value", 0)),
                        str(payload.get("rating", "unknown")),
                        str(payload.get("pagePath", "/")),
                    ),
                )
                futures.append(f1)

        # Esperar a que todas las escrituras asíncronas finalicen
        for f in futures:
            try:
                f.result()
            except Exception as e:
                self.logger.warning(f"Error escribiendo registro en Cassandra: {e}")

        self.logger.debug(f"Lote de {len(raw_items)} elementos procesado exitosamente ({len(futures)} escrituras CQL).")

    def shutdown(self) -> None:
        self.logger.info("Cerrando TelemetryJob y vaciando registros pendientes...")
        try:
            # Procesar lo que haya quedado en cola
            if self.redis_client:
                remaining = self.redis_client.lrange(QUEUE_KEY, 0, -1)
                if remaining:
                    self.logger.info(f"Vaciando {len(remaining)} elementos residuales antes de apagar...")
                    self._process_batch(remaining)
                    self.redis_client.delete(QUEUE_KEY)
        except Exception as e:
            self.logger.error("Error vaciando registros residuales", exc_info=True)

        if self.cassandra_cluster:
            try:
                self.cassandra_cluster.shutdown()
            except Exception:
                pass
        self.logger.info("TelemetryJob apagado limpiamente.")
