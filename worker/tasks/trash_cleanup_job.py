import os
import re
import time
from pathlib import Path
from typing import List, Optional
import pymysql
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
                cursor.execute("""
                    SELECT uuid FROM canvases
                    WHERE deleted_at IS NOT NULL
                      AND deleted_at < NOW() - INTERVAL %s DAY
                """, (self.RETENTION_DAYS,))
                expired_rows = cursor.fetchall()
                uuids_to_purge = [r["uuid"] for r in expired_rows if "uuid" in r and r["uuid"]]

                deleted_count = 0
                if uuids_to_purge:
                    placeholders = ', '.join(['%s'] * len(uuids_to_purge))
                    cursor.execute(f"DELETE FROM canvases WHERE uuid IN ({placeholders})", tuple(uuids_to_purge))
                    deleted_count = cursor.rowcount
                    try:
                        cursor.execute(f"DELETE FROM db_identity.user_favorites WHERE item_type = 'canvas' AND item_id IN ({placeholders})", tuple(uuids_to_purge))
                    except Exception as fav_err:
                        self.logger.warning(f"Error al limpiar favoritos en purga de papelera: {fav_err}")

            self.last_run_timestamp = time.time()
            if deleted_count > 0:
                self.logger.info(f"Se eliminaron definitivamente {deleted_count} lienzos expirados de la base de datos.")
                self._purge_physical_blobs(uuids_to_purge)
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

    def _purge_physical_blobs(self, uuids: List[str]) -> None:
        blob_dir = Path(config.CANVAS_STORAGE_DIR)
        if not blob_dir.exists():
            local_candidate = Path(__file__).resolve().parent.parent.parent / "data" / "canvases"
            if local_candidate.exists():
                blob_dir = local_candidate

        if not blob_dir.exists():
            self.logger.warning(f"Directorio de blobs {blob_dir} no accesible para purga física.")
            return

        purged_files = 0
        for u in uuids:
            safe_uuid = re.sub(r"[^a-zA-Z0-9_-]", "", str(u))
            blob_path = blob_dir / f"{safe_uuid}.sb.gz"
            try:
                if blob_path.is_file():
                    blob_path.unlink()
                    purged_files += 1
            except Exception as e:
                self.logger.warning(f"No se pudo eliminar el archivo blob {blob_path}: {e}")

        if purged_files > 0:
            self.logger.info(f"Se eliminaron físicamente {purged_files} archivos .sb.gz de lienzos expirados.")

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
