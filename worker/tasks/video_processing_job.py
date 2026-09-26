import json
import logging
import os
import subprocess
import time
from typing import Optional
import pymysql
import redis
from config import config
from .base import BaseJob

QUEUE_KEY = "video:queue"

class VideoProcessingJob(BaseJob):
    """
    Trabajador asíncrono para procesamiento y optimización de videos:
    Drena la cola 'video:queue' de Redis, realiza análisis de metadatos
    y garantiza la correcta persistencia y optimización de videos subidos.
    """

    def __init__(self):
        super().__init__("video_processing")
        self.redis_client: Optional[redis.Redis] = None
        self.mysql_conn: Optional[pymysql.Connection] = None

    def _get_mysql(self) -> pymysql.Connection:
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

    def setup(self) -> None:
        self.logger.info("Inicializando conexiones para VideoProcessingJob...")
        self.redis_client = redis.Redis(
            host=config.REDIS_HOST,
            port=config.REDIS_PORT,
            password=config.REDIS_PASSWORD,
            decode_responses=True,
            socket_timeout=5,
        )
        try:
            self.redis_client.ping()
            self.logger.info("Conexión con Redis establecida para cola de videos.")
        except Exception as e:
            self.logger.warn(f"Redis no disponible de inmediato para VideoProcessingJob: {e}")

        try:
            conn = self._get_mysql()
            with conn.cursor() as cursor:
                cursor.execute("SELECT 1 AS ok")
            self.logger.info("Conexión con MySQL establecida para VideoProcessingJob.")
        except Exception as e:
            self.logger.warn(f"MySQL no disponible de inmediato para VideoProcessingJob: {e}")

    def run_cycle(self) -> float:
        if not self.redis_client:
            return 2.0

        try:
            raw_item = self.redis_client.rpop(QUEUE_KEY)
            if not raw_item:
                return 1.0

            payload = json.loads(raw_item)
            upload_uuid = payload.get("uploadUuid")
            user_id = payload.get("userId")
            local_path = payload.get("localFilePath")

            self.logger.info(f"Procesando tarea de video para UUID: {upload_uuid} (Usuario {user_id})")

            if local_path and os.path.exists(local_path):
                try:
                    cmd = [
                        "ffprobe",
                        "-v", "error",
                        "-show_entries", "format=duration:stream=width,height",
                        "-of", "json",
                        local_path,
                    ]
                    res = subprocess.run(cmd, capture_output=True, text=True, timeout=15)
                    if res.returncode == 0:
                        info = json.loads(res.stdout)
                        dur = float(info.get("format", {}).get("duration", 0.0))
                        width = 0
                        height = 0
                        streams = info.get("streams", [])
                        if streams:
                            width = int(streams[0].get("width", 0))
                            height = int(streams[0].get("height", 0))

                        if dur > 0 or width > 0:
                            conn = self._get_mysql()
                            with conn.cursor() as cursor:
                                cursor.execute(
                                    """
                                    UPDATE user_uploads
                                    SET duration_seconds = COALESCE(NULLIF(%s, 0), duration_seconds),
                                        width = COALESCE(NULLIF(%s, 0), width),
                                        height = COALESCE(NULLIF(%s, 0), height)
                                    WHERE uuid = %s AND user_id = %s
                                    """,
                                    (dur, width, height, upload_uuid, user_id),
                                )
                            self.logger.info(f"Metadatos de video actualizados con éxito para {upload_uuid}")
                except Exception as ex:
                    self.logger.warn(f"Error secundario extrayendo metadatos en worker para {upload_uuid}: {ex}")

            return 0.0
        except Exception as e:
            self.logger.error(f"Error procesando ciclo de video en cola: {e}")
            return 1.0

    def shutdown(self) -> None:
        self.logger.info("Cerrando VideoProcessingJob...")
        if self.redis_client:
            try:
                self.redis_client.close()
            except Exception:
                pass
        if self.mysql_conn and self.mysql_conn.open:
            try:
                self.mysql_conn.close()
            except Exception:
                pass
