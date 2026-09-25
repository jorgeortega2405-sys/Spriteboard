import time
from typing import Optional
import pymysql
import redis
from config import config
from .base import BaseJob

class AiQuotaJob(BaseJob):
    """
    Trabajo periódico que sincroniza y reinicia las cuotas de IA expiradas (ciclo de 12 horas).
    Se ejecuta cada 60 segundos para asegurar que los usuarios recuperen su cuota a tiempo.
    También purga registros de generación de IA con más de 90 días de antigüedad.
    """

    CYCLE_INTERVAL_SECONDS = 60.0
    LOGS_CLEANUP_INTERVAL_SECONDS = 86400.0

    def __init__(self):
        super().__init__("ai_quota")
        self.mysql_conn: Optional[pymysql.Connection] = None
        self.redis_client: Optional[redis.Redis] = None
        self.last_run_timestamp: float = 0.0
        self.last_cleanup_timestamp: float = 0.0

    def _get_mysql_conn(self) -> pymysql.Connection:
        if self.mysql_conn is None or not self.mysql_conn.open:
            self.mysql_conn = pymysql.connect(
                host=config.DB_HOST,
                port=config.DB_PORT,
                user=config.DB_USER,
                password=config.DB_PASSWORD,
                database=config.DB_NAME,
                autocommit=True,
                cursorclass=pymysql.cursors.DictCursor,
                connect_timeout=10,
            )
        return self.mysql_conn

    def _get_redis_client(self) -> redis.Redis:
        if self.redis_client is None:
            self.redis_client = redis.Redis(
                host=config.REDIS_HOST,
                port=config.REDIS_PORT,
                password=config.REDIS_PASSWORD,
                decode_responses=True,
                socket_timeout=5,
            )
        return self.redis_client

    def setup(self) -> None:
        self.logger.info("Inicializando conexiones de MySQL y Redis para AiQuotaJob...")
        try:
            conn = self._get_mysql_conn()
            with conn.cursor() as cursor:
                cursor.execute("SELECT 1 AS ok")

            r = self._get_redis_client()
            r.ping()

            self.logger.info("Conexiones a MySQL y Redis establecidas para AiQuotaJob.")
        except Exception as e:
            self.logger.error(f"Error al inicializar AiQuotaJob: {e}")
            raise

    def run_cycle(self) -> float:
        now = time.time()
        elapsed = now - self.last_run_timestamp

        if self.last_run_timestamp > 0 and elapsed < self.CYCLE_INTERVAL_SECONDS:
            remaining = self.CYCLE_INTERVAL_SECONDS - elapsed
            return min(remaining, 10.0)

        self.last_run_timestamp = now

        try:
            self._reset_expired_quotas()
        except Exception as e:
            self.logger.error(f"Error al reiniciar cuotas de IA expiradas: {e}", exc_info=True)
            if self.mysql_conn:
                try:
                    self.mysql_conn.close()
                except Exception:
                    pass
                self.mysql_conn = None

        if now - self.last_cleanup_timestamp >= self.LOGS_CLEANUP_INTERVAL_SECONDS:
            try:
                self._cleanup_old_logs()
                self.last_cleanup_timestamp = now
            except Exception as e:
                self.logger.error(f"Error al purgar logs antiguos de IA: {e}", exc_info=True)

        return 10.0

    def _reset_expired_quotas(self) -> None:
        conn = self._get_mysql_conn()
        with conn.cursor() as cursor:
            cursor.execute("""
                SELECT user_id FROM user_ai_quotas
                WHERE cycle_reset_at IS NOT NULL
                  AND cycle_reset_at <= NOW()
            """)
            expired_rows = cursor.fetchall()
            expired_user_ids = [r["user_id"] for r in expired_rows if "user_id" in r]

            if not expired_user_ids:
                return

            cursor.execute("""
                UPDATE user_ai_quotas
                SET tokens_used = 0,
                    cycle_started_at = NULL,
                    cycle_reset_at = NULL
                WHERE cycle_reset_at IS NOT NULL
                  AND cycle_reset_at <= NOW()
            """)
            reset_count = cursor.rowcount

            r = self._get_redis_client()
            for user_id in expired_user_ids:
                try:
                    r.delete(f"ai_quota:user:{user_id}")
                except Exception as redis_err:
                    self.logger.warning(f"No se pudo invalidar clave Redis para usuario {user_id}: {redis_err}")

            self.logger.info(f"Se reiniciaron {reset_count} cuotas de IA expiradas satisfactoriamente.")

    def _cleanup_old_logs(self) -> None:
        conn = self._get_mysql_conn()
        with conn.cursor() as cursor:
            cursor.execute("""
                DELETE FROM ai_generation_logs
                WHERE created_at < NOW() - INTERVAL 90 DAY
            """)
            deleted = cursor.rowcount
            if deleted > 0:
                self.logger.info(f"Se purgaron {deleted} registros antiguos de generación de IA (>90 días).")

    def shutdown(self) -> None:
        self.logger.info("Cerrando recursos de AiQuotaJob...")
        if self.mysql_conn:
            try:
                self.mysql_conn.close()
            except Exception:
                pass
            self.mysql_conn = None

        if self.redis_client:
            try:
                self.redis_client.close()
            except Exception:
                pass
            self.redis_client = None

        self.logger.info("AiQuotaJob finalizado limpiamente.")
