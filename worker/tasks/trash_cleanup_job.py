import time
import pymysql
from typing import Optional
from config import config
from .base import BaseJob

class TrashCleanupJob(BaseJob):
    """
    Trabajo periódico que purga de forma permanente de la base de datos
    aquellos lienzos que llevan más de 30 días en la papelera de reciclaje.
    Se ejecuta automáticamente cada 24 horas.
    """

    CLEANUP_INTERVAL_SECONDS = 86400  # 24 horas
    RETENTION_DAYS = 30

    def __init__(self):
        super().__init__("trash_cleanup")
        self.connection: Optional[pymysql.Connection] = None
        self.last_run_timestamp: float = 0.0

    def _get_connection(self) -> pymysql.Connection:
        if self.connection is None or not self.connection.open:
            self.connection = pymysql.connect(
                host=config.DB_HOST,
                port=config.DB_PORT,
                user=config.DB_USER,
                password=config.DB_PASSWORD,
                database=config.DB_CANVAS_NAME,
                autocommit=True,
                cursorclass=pymysql.cursors.DictCursor,
                connect_timeout=10,
            )
        return self.connection

    def setup(self) -> None:
        self.logger.info("Iniciando conexión a MySQL para la tarea de limpieza de papelera...")
        try:
            conn = self._get_connection()
            with conn.cursor() as cursor:
                cursor.execute("SELECT 1 AS ok")
            self.logger.info("Conexión a MySQL establecida correctamente para 'trash_cleanup'.")
        except Exception as e:
            self.logger.error(f"Error al verificar conexión con base de datos de lienzos: {e}")
            raise

    def run_cycle(self) -> float:
        now = time.time()
        elapsed = now - self.last_run_timestamp

        # Si aún no han pasado 24 horas desde la última ejecución, retornar tiempo restante
        if self.last_run_timestamp > 0 and elapsed < self.CLEANUP_INTERVAL_SECONDS:
            remaining = self.CLEANUP_INTERVAL_SECONDS - elapsed
            return min(remaining, 60.0)

        self.logger.info(f"Ejecutando ciclo de purga de papelera (lienzos con más de {self.RETENTION_DAYS} días)...")
        try:
            conn = self._get_connection()
            with conn.cursor() as cursor:
                query = """
                    DELETE FROM canvases
                    WHERE deleted_at IS NOT NULL
                      AND deleted_at < NOW() - INTERVAL %s DAY
                """
                cursor.execute(query, (self.RETENTION_DAYS,))
                deleted_count = cursor.rowcount

            self.last_run_timestamp = time.time()
            if deleted_count > 0:
                self.logger.info(f"Se eliminaron definitivamente {deleted_count} lienzos expirados de la papelera.")
            else:
                self.logger.info("No se encontraron lienzos expirados en la papelera para purgar.")
        except Exception as e:
            self.logger.error(f"Error durante la purga de la papelera: {e}", exc_info=True)
            if self.connection:
                try:
                    self.connection.close()
                except Exception:
                    pass
                self.connection = None
            return 30.0

        return min(self.CLEANUP_INTERVAL_SECONDS, 60.0)

    def shutdown(self) -> None:
        self.logger.info("Cerrando conexión de base de datos para 'trash_cleanup'...")
        if self.connection:
            try:
                self.connection.close()
            except Exception as e:
                self.logger.warn(f"Error al cerrar conexión MySQL: {e}")
            finally:
                self.connection = None
        self.logger.info("Recursos de 'trash_cleanup' liberados.")
