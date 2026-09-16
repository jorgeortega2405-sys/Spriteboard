import datetime
import json
import os
import shutil
import sys
import time
from pathlib import Path
from typing import Dict, List, Optional
import pymysql
from config import config
from .base import BaseJob

# Carga o referencia del motor de respaldos
SCRIPT_CANDIDATES = [
    Path(__file__).resolve().parent.parent.parent / "scripts" / "backup_engine.py",
    Path(__file__).resolve().parent.parent.parent / "admin" / "scripts" / "backup_engine.py",
    Path("/app/scripts/backup_engine.py"),
]

def load_backup_engine_class():
    for sc in SCRIPT_CANDIDATES:
        if sc.exists():
            import importlib.util
            spec = importlib.util.spec_from_file_location("backup_engine", str(sc))
            if spec and spec.loader:
                module = importlib.util.module_from_spec(spec)
                spec.loader.exec_module(module)
                if hasattr(module, "BackupEngine"):
                    return module.BackupEngine
    return None

class BackupScheduleJob(BaseJob):
    """
    Trabajo periódico del worker de Python que supervisa y ejecuta automáticamente
    las copias de seguridad programadas según el intervalo configurado en la base de datos.
    """

    CHECK_INTERVAL_SECONDS = 30.0

    def __init__(self):
        super().__init__("backup_scheduler")
        self.connection: Optional[pymysql.Connection] = None
        self.last_check_timestamp: float = 0.0
        self.BackupEngineClass = None

    def _get_connection(self) -> pymysql.Connection:
        if self.connection is None or not self.connection.open:
            self.connection = pymysql.connect(
                host=config.DB_HOST,
                port=config.DB_PORT,
                user=config.DB_USER,
                password=config.DB_PASSWORD,
                database=config.DB_NAME,
                autocommit=True,
                cursorclass=pymysql.cursors.DictCursor,
                connect_timeout=10,
            )
        return self.connection

    def setup(self) -> None:
        self.logger.info("Inicializando tarea de copias de seguridad automáticas...")
        try:
            conn = self._get_connection()
            with conn.cursor() as cursor:
                cursor.execute("""
                    CREATE TABLE IF NOT EXISTS backup_schedules (
                        id INT AUTO_INCREMENT PRIMARY KEY,
                        name VARCHAR(255) NOT NULL DEFAULT 'Copia Automática Programada',
                        enabled BOOLEAN NOT NULL DEFAULT FALSE,
                        interval_type ENUM('hourly', 'every_6_hours', 'every_12_hours', 'daily', 'weekly', 'monthly', 'custom_hours') NOT NULL DEFAULT 'daily',
                        interval_hours INT NOT NULL DEFAULT 24,
                        time_of_day VARCHAR(5) NOT NULL DEFAULT '02:00',
                        day_of_week INT NOT NULL DEFAULT 1,
                        day_of_month INT NOT NULL DEFAULT 1,
                        databases_included JSON NULL,
                        include_s3 BOOLEAN NOT NULL DEFAULT TRUE,
                        s3_buckets_included JSON NULL,
                        include_redis BOOLEAN NOT NULL DEFAULT TRUE,
                        include_cassandra BOOLEAN NOT NULL DEFAULT FALSE,
                        format VARCHAR(20) NOT NULL DEFAULT 'zip',
                        retention_count INT NOT NULL DEFAULT 7,
                        description TEXT NULL,
                        last_run_at TIMESTAMP NULL DEFAULT NULL,
                        next_run_at TIMESTAMP NULL DEFAULT NULL,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
                    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
                """)
            self.BackupEngineClass = load_backup_engine_class()
            self.logger.info("Módulo de respaldos programados y motor de backup inicializados correctamente.")
        except Exception as e:
            self.logger.error(f"Error al verificar base de datos para copias de seguridad automáticas: {e}")
            raise

    def calculate_next_run(
        self,
        interval_type: str,
        interval_hours: int,
        time_of_day: str,
        day_of_week: int,
        day_of_month: int,
        from_date: datetime.datetime,
    ) -> datetime.datetime:
        time_parts = (time_of_day or "02:00").split(":")
        target_hour = int(time_parts[0]) if len(time_parts) > 0 else 2
        target_min = int(time_parts[1]) if len(time_parts) > 1 else 0

        next_dt = from_date.replace(microsecond=0)

        if interval_type == "hourly":
            next_dt = next_dt.replace(minute=target_min, second=0)
            if next_dt <= from_date:
                next_dt += datetime.timedelta(hours=1)
            return next_dt

        if interval_type == "every_6_hours":
            next_dt = next_dt.replace(minute=target_min, second=0)
            while next_dt <= from_date:
                next_dt += datetime.timedelta(hours=6)
            return next_dt

        if interval_type == "every_12_hours":
            next_dt = next_dt.replace(minute=target_min, second=0)
            while next_dt <= from_date:
                next_dt += datetime.timedelta(hours=12)
            return next_dt

        if interval_type == "custom_hours":
            hrs = max(1, int(interval_hours or 24))
            next_dt = next_dt.replace(minute=target_min, second=0)
            while next_dt <= from_date:
                next_dt += datetime.timedelta(hours=hrs)
            return next_dt

        if interval_type == "weekly":
            js_target_day = 0 if day_of_week == 7 else day_of_week
            next_dt = next_dt.replace(hour=target_hour, minute=target_min, second=0)
            # Python weekday: Monday is 0, Sunday is 6
            py_current_day = next_dt.weekday()
            py_target_day = 6 if js_target_day == 0 else js_target_day - 1
            days_ahead = (py_target_day - py_current_day + 7) % 7
            if days_ahead == 0 and next_dt <= from_date:
                days_ahead = 7
            next_dt += datetime.timedelta(days=days_ahead)
            return next_dt

        if interval_type == "monthly":
            dom = min(28, max(1, int(day_of_month or 1)))
            next_dt = next_dt.replace(day=dom, hour=target_hour, minute=target_min, second=0)
            if next_dt <= from_date:
                # Siguiente mes
                month = next_dt.month + 1
                year = next_dt.year
                if month > 12:
                    month = 1
                    year += 1
                next_dt = next_dt.replace(year=year, month=month, day=dom)
            return next_dt

        # Por defecto 'daily'
        next_dt = next_dt.replace(hour=target_hour, minute=target_min, second=0)
        if next_dt <= from_date:
            next_dt += datetime.timedelta(days=1)
        return next_dt

    def run_cycle(self) -> float:
        now_ts = time.time()
        elapsed = now_ts - self.last_check_timestamp

        if self.last_check_timestamp > 0 and elapsed < self.CHECK_INTERVAL_SECONDS:
            return max(1.0, self.CHECK_INTERVAL_SECONDS - elapsed)

        self.last_check_timestamp = now_ts

        try:
            conn = self._get_connection()
            with conn.cursor() as cursor:
                cursor.execute("""
                    SELECT * FROM backup_schedules
                    WHERE enabled = 1 AND (next_run_at IS NULL OR next_run_at <= NOW())
                """)
                due_schedules = cursor.fetchall()

            if not due_schedules:
                return self.CHECK_INTERVAL_SECONDS

            for sched in due_schedules:
                self._execute_scheduled_backup(sched)

        except Exception as e:
            self.logger.error(f"Error en ciclo de verificación de copias programadas: {e}", exc_info=True)
            if self.connection:
                try:
                    self.connection.close()
                except Exception:
                    pass
                self.connection = None
            return 15.0

        return self.CHECK_INTERVAL_SECONDS

    def _execute_scheduled_backup(self, schedule_row: dict) -> None:
        sched_id = schedule_row.get("id")
        name_prefix = schedule_row.get("name") or "Copia Automática"
        interval_type = schedule_row.get("interval_type", "daily")
        interval_hours = schedule_row.get("interval_hours", 24)
        time_of_day = schedule_row.get("time_of_day", "02:00")
        day_of_week = schedule_row.get("day_of_week", 1)
        day_of_month = schedule_row.get("day_of_month", 1)
        retention_count = schedule_row.get("retention_count", 7)
        raw_format = schedule_row.get("format", "zip")
        include_s3 = bool(schedule_row.get("include_s3", True))
        include_redis = bool(schedule_row.get("include_redis", True))
        include_cassandra = bool(schedule_row.get("include_cassandra", False))

        databases_included = []
        if schedule_row.get("databases_included"):
            try:
                db_raw = schedule_row["databases_included"]
                databases_included = json.loads(db_raw) if isinstance(db_raw, str) else db_raw
            except Exception:
                databases_included = []

        if not databases_included:
            databases_included = [
                {"database": config.DB_NAME, "include_data": True, "include_schema": True, "tables": []},
                {"database": config.DB_CANVAS_NAME, "include_data": True, "include_schema": True, "tables": []},
            ]

        s3_buckets = []
        if schedule_row.get("s3_buckets_included"):
            try:
                s3_raw = schedule_row["s3_buckets_included"]
                s3_buckets = json.loads(s3_raw) if isinstance(s3_raw, str) else s3_raw
            except Exception:
                s3_buckets = []
        if not s3_buckets:
            s3_buckets = [config.AWS_S3_BUCKET or "spriteboard-storage"]

        now_dt = datetime.datetime.now(datetime.timezone.utc)
        date_str = now_dt.strftime("%Y-%m-%d %H:%M:%S")
        backup_title = f"{name_prefix} - {date_str}"
        sanitized_name = f"auto_{now_dt.strftime('%Y%m%d_%H%M%S')}"
        import uuid
        backup_uuid = str(uuid.uuid4())
        filename = f"{sanitized_name}_{backup_uuid[:8]}.{raw_format}"

        output_dir = Path("/app/data/backups")
        if not output_dir.exists():
            local_cand = Path(__file__).resolve().parent.parent.parent / "data" / "backups"
            if local_cand.exists() or local_cand.parent.exists():
                output_dir = local_cand
        output_dir.mkdir(parents=True, exist_ok=True)
        target_file_path = output_dir / filename

        self.logger.info(f"Iniciando ejecución programada de copia de seguridad '{backup_title}' (UUID: {backup_uuid})...")

        conn = self._get_connection()
        try:
            with conn.cursor() as cursor:
                cursor.execute("""
                    INSERT INTO backups (
                        uuid, name, filename, file_path, format, status, progress_percent, current_step,
                        databases_included, include_s3, s3_buckets_included, include_redis, include_cassandra,
                        description, created_by_user_id, created_by_username
                    ) VALUES (%s, %s, %s, %s, %s, 'pending', 0, 'Iniciando respaldo programado por worker...', %s, %s, %s, %s, %s, %s, NULL, 'Sistema (Worker Automático)')
                """, (
                    backup_uuid,
                    backup_title,
                    filename,
                    str(target_file_path),
                    raw_format,
                    json.dumps(databases_included),
                    include_s3,
                    json.dumps(s3_buckets),
                    include_redis,
                    include_cassandra,
                    "Copia de seguridad automática ejecutada periódicamente por el worker.",
                ))
                backup_id = cursor.lastrowid
        except Exception as ins_err:
            self.logger.error(f"Error al registrar fila de backup en base de datos: {ins_err}")
            return

        engine_cfg = {
            "backup_id": backup_id,
            "uuid": backup_uuid,
            "databases": databases_included,
            "db_host": config.DB_HOST,
            "db_port": config.DB_PORT,
            "db_user": config.DB_USER,
            "db_password": config.DB_PASSWORD,
            "filename": filename,
            "format": raw_format,
            "output_dir": str(output_dir),
            "redis": {"include": include_redis},
            "redis_host": config.REDIS_HOST,
            "redis_port": config.REDIS_PORT,
            "redis_password": config.REDIS_PASSWORD,
            "s3": {
                "buckets": s3_buckets,
                "include": include_s3,
                "prefixes": [],
            },
            "s3_access_key": config.AWS_ACCESS_KEY_ID,
            "s3_secret_key": config.AWS_SECRET_ACCESS_KEY,
            "s3_endpoint": config.AWS_S3_ENDPOINT,
            "s3_region": config.AWS_REGION,
            "s3_bucket": config.AWS_S3_BUCKET,
        }

        if not self.BackupEngineClass:
            self.BackupEngineClass = load_backup_engine_class()

        if self.BackupEngineClass:
            try:
                engine = self.BackupEngineClass(engine_cfg)
                engine.run()
                self.logger.info(f"Copia de seguridad automática finalizada exitosamente: {filename}")
            except Exception as eng_err:
                self.logger.error(f"Fallo en la ejecución del motor de respaldos: {eng_err}", exc_info=True)
        else:
            self.logger.error("No se encontró la clase BackupEngine para ejecutar el respaldo.")

        # Calcular próxima fecha de ejecución
        next_run_dt = self.calculate_next_run(
            interval_type,
            interval_hours,
            time_of_day,
            day_of_week,
            day_of_month,
            datetime.datetime.now(),
        )

        try:
            with conn.cursor() as cursor:
                cursor.execute("""
                    UPDATE backup_schedules
                    SET last_run_at = NOW(), next_run_at = %s
                    WHERE id = %s
                """, (next_run_dt, sched_id))
            self.logger.info(f"Próxima ejecución programada para {next_run_dt.isoformat()}.")
        except Exception as upd_err:
            self.logger.warning(f"Error al actualizar siguiente fecha de ejecución: {upd_err}")

        # Aplicar política de retención
        if retention_count and retention_count > 0:
            self._apply_retention(retention_count)

    def _apply_retention(self, retention_count: int) -> None:
        try:
            conn = self._get_connection()
            with conn.cursor() as cursor:
                cursor.execute("""
                    SELECT id, uuid, filename, file_path
                    FROM backups
                    WHERE status = 'completed'
                      AND (created_by_username = 'Sistema (Worker Automático)' OR name LIKE '%Copia Automática%')
                    ORDER BY created_at DESC
                """)
                completed_rows = cursor.fetchall()

            if len(completed_rows) > retention_count:
                to_delete = completed_rows[retention_count:]
                for item in to_delete:
                    fp = item.get("file_path")
                    if fp and os.path.exists(fp):
                        try:
                            os.remove(fp)
                        except Exception as rm_err:
                            self.logger.warning(f"No se pudo eliminar archivo físico {fp}: {rm_err}")
                    with conn.cursor() as cursor:
                        cursor.execute("DELETE FROM backups WHERE id = %s", (item["id"],))
                    self.logger.info(f"Copia automática antigua purgada por política de retención ({retention_count}): {item.get('filename')}")
        except Exception as ret_err:
            self.logger.error(f"Error al aplicar retención de copias de seguridad: {ret_err}")

    def shutdown(self) -> None:
        self.logger.info("Cerrando recursos de 'backup_scheduler'...")
        if self.connection:
            try:
                self.connection.close()
            except Exception:
                pass
            self.connection = None
        self.logger.info("Recursos de 'backup_scheduler' liberados.")
