import argparse
import datetime
import hashlib
import json
import os
import shutil
import sys
import tarfile
import time
import zipfile
from pathlib import Path
import pymysql

try:
    from dotenv import load_dotenv
    load_dotenv()
except Exception:
    pass

class BackupEngine:
    def __init__(self, config_data: dict):
        self.config = config_data
        self.backup_id = self.config.get("backup_id")
        self.uuid = self.config.get("uuid", "")
        self.output_dir = Path(self.config.get("output_dir", "data/backups")).resolve()
        self.format = self.config.get("format", "zip").lower()
        self.filename = self.config.get("filename") or f"backup_{int(time.time())}.{self.format}"
        self.temp_dir = self.output_dir / f"_tmp_{self.uuid or int(time.time())}"
        
        self.db_host = self.config.get("db_host") or os.getenv("DB_HOST", "localhost")
        self.db_port = int(self.config.get("db_port") or os.getenv("DB_PORT", "3306"))
        self.db_user = self.config.get("db_user") or os.getenv("DB_USER", "sprite_user")
        self.db_password = self.config.get("db_password") or os.getenv("DB_PASSWORD", "sprite_password")
        self.meta_db_name = os.getenv("DB_NAME", "db_identity")

        self.s3_endpoint = self.config.get("s3_endpoint") or os.getenv("AWS_S3_ENDPOINT")
        self.s3_access_key = self.config.get("s3_access_key") or os.getenv("AWS_ACCESS_KEY_ID", "spriteboard_admin")
        self.s3_secret_key = self.config.get("s3_secret_key") or os.getenv("AWS_SECRET_ACCESS_KEY", "spriteboard_secret_key")
        self.s3_region = self.config.get("s3_region") or os.getenv("AWS_REGION", "us-east-1")
        self.s3_bucket = self.config.get("s3_bucket") or os.getenv("AWS_S3_BUCKET", "spriteboard-storage")

        self.redis_host = self.config.get("redis_host") or os.getenv("REDIS_HOST", "localhost")
        self.redis_port = int(self.config.get("redis_port") or os.getenv("REDIS_PORT", "6379"))
        self.redis_password = self.config.get("redis_password") or os.getenv("REDIS_PASSWORD")

        self.start_time = time.time()
        self.manifest = {
            "uuid": self.uuid,
            "created_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
            "format": self.format,
            "filename": self.filename,
            "databases": {},
            "s3": {},
            "redis": {},
            "stats": {},
        }

    def _get_db_conn(self, database: str = None):
        return pymysql.connect(
            host=self.db_host,
            port=self.db_port,
            user=self.db_user,
            password=self.db_password,
            database=database or self.meta_db_name,
            charset="utf8mb4",
            autocommit=True,
            cursorclass=pymysql.cursors.DictCursor,
            connect_timeout=15,
        )

    def update_progress(self, percent: int, step: str):
        event_payload = {
            "event": "progress",
            "percent": max(0, min(100, percent)),
            "step": step,
            "uuid": self.uuid,
        }
        sys.stdout.write(json.dumps(event_payload) + "\n")
        sys.stdout.flush()

        if self.uuid or self.backup_id:
            try:
                conn = self._get_db_conn(self.meta_db_name)
                with conn.cursor() as cursor:
                    if self.uuid:
                        cursor.execute(
                            "UPDATE backups SET progress_percent = %s, current_step = %s, status = 'in_progress' WHERE uuid = %s",
                            (percent, step, self.uuid),
                        )
                    elif self.backup_id:
                        cursor.execute(
                            "UPDATE backups SET progress_percent = %s, current_step = %s, status = 'in_progress' WHERE id = %s",
                            (percent, step, self.backup_id),
                        )
                conn.close()
            except Exception:
                pass

    def run(self):
        try:
            self.output_dir.mkdir(parents=True, exist_ok=True)
            if self.temp_dir.exists():
                shutil.rmtree(self.temp_dir, ignore_errors=True)
            self.temp_dir.mkdir(parents=True, exist_ok=True)

            self.update_progress(5, "Iniciando preparación del entorno de respaldo...")

            db_configs = self.config.get("databases", [])
            total_dbs = len(db_configs)
            if total_dbs > 0:
                for idx, db_item in enumerate(db_configs):
                    db_name = db_item.get("database")
                    if not db_name:
                        continue
                    progress_base = 10 + int((idx / total_dbs) * 45)
                    self.dump_database(db_item, progress_base, int(45 / total_dbs))

            if self.config.get("s3", {}).get("include", False):
                self.update_progress(60, "Extrayendo objetos del almacenamiento S3 / MinIO...")
                self.dump_s3()

            if self.config.get("redis", {}).get("include", False):
                self.update_progress(75, "Extrayendo instantánea de claves de Redis...")
                self.dump_redis()

            self.update_progress(85, "Compilando manifiesto del respaldo...")
            self.write_manifest()

            self.update_progress(90, "Empaquetando y comprimiendo archivo de respaldo...")
            final_file_path = self.create_archive()

            duration = int(time.time() - self.start_time)
            file_size = os.path.getsize(final_file_path)

            self.manifest["stats"]["duration_seconds"] = duration
            self.manifest["stats"]["file_size_bytes"] = file_size

            self.finalize_db_record(final_file_path, file_size, duration)

            self.update_progress(100, "Copia de seguridad completada exitosamente.")
            sys.stdout.write(
                json.dumps(
                    {
                        "event": "completed",
                        "uuid": self.uuid,
                        "file_path": str(final_file_path),
                        "file_size": file_size,
                        "duration_seconds": duration,
                    }
                )
                + "\n"
            )
            sys.stdout.flush()

        except Exception as err:
            err_msg = str(err)
            self.fail_db_record(err_msg)
            sys.stdout.write(
                json.dumps(
                    {
                        "event": "failed",
                        "uuid": self.uuid,
                        "error": err_msg,
                    }
                )
                + "\n"
            )
            sys.stdout.flush()
            sys.exit(1)
        finally:
            if self.temp_dir.exists():
                shutil.rmtree(self.temp_dir, ignore_errors=True)

    def dump_database(self, db_item: dict, base_progress: int, span_progress: int):
        db_name = db_item.get("database")
        tables = db_item.get("tables", [])
        include_schema = db_item.get("include_schema", True)
        include_data = db_item.get("include_data", True)

        db_dir = self.temp_dir / "databases" / db_name
        db_dir.mkdir(parents=True, exist_ok=True)

        conn = self._get_db_conn(db_name)
        try:
            with conn.cursor() as cursor:
                if not tables:
                    cursor.execute("SHOW FULL TABLES WHERE Table_type = 'BASE TABLE'")
                    rows = cursor.fetchall()
                    tables = [list(r.values())[0] for r in rows]

                self.manifest["databases"][db_name] = {
                    "tables_included": tables,
                    "row_counts": {},
                }

                total_tables = len(tables)
                sql_file_path = db_dir / f"{db_name}.sql"
                with open(sql_file_path, "w", encoding="utf-8") as f:
                    f.write(f"-- Spriteboard MySQL Backup\n")
                    f.write(f"-- Database: `{db_name}`\n")
                    f.write(f"-- Date: {datetime.datetime.now(datetime.timezone.utc).isoformat()}\n\n")
                    f.write("SET FOREIGN_KEY_CHECKS = 0;\n")
                    f.write("SET SQL_MODE = 'NO_AUTO_VALUE_ON_ZERO';\n")
                    f.write("SET NAMES utf8mb4;\n\n")

                    for t_idx, table in enumerate(tables):
                        step_prog = base_progress + int((t_idx / max(1, total_tables)) * span_progress)
                        self.update_progress(step_prog, f"Extrayendo tabla `{db_name}`.`{table}`...")

                        if include_schema:
                            cursor.execute(f"SHOW CREATE TABLE `{table}`")
                            create_row = cursor.fetchone()
                            create_sql = create_row.get("Create Table") if create_row else ""
                            f.write(f"-- Structure for table `{table}`\n")
                            f.write(f"DROP TABLE IF EXISTS `{table}`;\n")
                            f.write(f"{create_sql};\n\n")

                        row_count = 0
                        if include_data:
                            f.write(f"-- Data for table `{table}`\n")
                            cursor.execute(f"SELECT * FROM `{table}`")
                            batch_size = 500
                            while True:
                                rows_batch = cursor.fetchmany(batch_size)
                                if not rows_batch:
                                    break
                                row_count += len(rows_batch)
                                for row in rows_batch:
                                    columns = [f"`{col}`" for col in row.keys()]
                                    formatted_vals = []
                                    for val in row.values():
                                        if val is None:
                                            formatted_vals.append("NULL")
                                        elif isinstance(val, (int, float)):
                                            formatted_vals.append(str(val))
                                        elif isinstance(val, (bytes, bytearray)):
                                            hex_val = val.hex()
                                            formatted_vals.append(f"X'{hex_val}'")
                                        elif isinstance(val, (datetime.datetime, datetime.date, datetime.time)):
                                            formatted_vals.append(f"'{val.isoformat()}'")
                                        else:
                                            escaped = pymysql.converters.escape_string(str(val))
                                            formatted_vals.append(f"'{escaped}'")
                                    
                                    cols_str = ", ".join(columns)
                                    vals_str = ", ".join(formatted_vals)
                                    f.write(f"INSERT INTO `{table}` ({cols_str}) VALUES ({vals_str});\n")

                            f.write("\n")

                        self.manifest["databases"][db_name]["row_counts"][table] = row_count

                    f.write("SET FOREIGN_KEY_CHECKS = 1;\n")
        finally:
            conn.close()

    def dump_s3(self):
        s3_cfg = self.config.get("s3", {})
        buckets = s3_cfg.get("buckets", [self.s3_bucket])
        prefixes = s3_cfg.get("prefixes", [])

        s3_dir = self.temp_dir / "s3_storage"
        s3_dir.mkdir(parents=True, exist_ok=True)

        try:
            import boto3
            from botocore.client import Config as BotoConfig

            session = boto3.session.Session()
            client_kwargs = {
                "service_name": "s3",
                "aws_access_key_id": self.s3_access_key,
                "aws_secret_access_key": self.s3_secret_key,
                "region_name": self.s3_region,
                "config": BotoConfig(s3={"addressing_style": "path"}),
            }
            if self.s3_endpoint:
                client_kwargs["endpoint_url"] = self.s3_endpoint

            s3_client = session.client(**client_kwargs)

            total_objects = 0
            for bucket in buckets:
                bucket_dir = s3_dir / bucket
                bucket_dir.mkdir(parents=True, exist_ok=True)
                self.manifest["s3"][bucket] = []

                if not prefixes:
                    prefixes_to_scan = [""]
                else:
                    prefixes_to_scan = prefixes

                for prefix in prefixes_to_scan:
                    paginator = s3_client.get_paginator("list_objects_v2")
                    for page in paginator.paginate(Bucket=bucket, Prefix=prefix):
                        for obj in page.get("Contents", []):
                            key = obj["Key"]
                            if key.endswith("/"):
                                continue
                            dest_path = bucket_dir / key
                            dest_path.parent.mkdir(parents=True, exist_ok=True)
                            s3_client.download_file(bucket, key, str(dest_path))
                            total_objects += 1
                            self.manifest["s3"][bucket].append({"key": key, "size": obj.get("Size", 0)})

            self.manifest["stats"]["s3_total_objects"] = total_objects
        except Exception as e:
            self.manifest["s3"]["error"] = str(e)

    def dump_redis(self):
        try:
            import redis

            r = redis.Redis(
                host=self.redis_host,
                port=self.redis_port,
                password=self.redis_password,
                decode_responses=False,
                socket_timeout=10,
            )
            keys = r.keys("*")
            dump_data = {}
            for k in keys:
                try:
                    k_str = k.decode("utf-8", errors="replace")
                    pttl = r.pttl(k)
                    raw_dump = r.dump(k)
                    if raw_dump is not None:
                        dump_data[k_str] = {
                            "pttl": pttl if pttl > 0 else 0,
                            "dump_hex": raw_dump.hex(),
                        }
                except Exception:
                    continue

            redis_dir = self.temp_dir / "redis"
            redis_dir.mkdir(parents=True, exist_ok=True)
            with open(redis_dir / "redis_snapshot.json", "w", encoding="utf-8") as f:
                json.dump(dump_data, f, indent=2)

            self.manifest["redis"]["total_keys"] = len(dump_data)
        except Exception as e:
            self.manifest["redis"]["error"] = str(e)

    def write_manifest(self):
        with open(self.temp_dir / "manifest.json", "w", encoding="utf-8") as f:
            json.dump(self.manifest, f, indent=2)

    def create_archive(self) -> Path:
        target_path = self.output_dir / self.filename
        if self.format == "tar.gz":
            with tarfile.open(target_path, "w:gz") as tar:
                for item in self.temp_dir.iterdir():
                    tar.add(item, arcname=item.name)
        else:
            with zipfile.ZipFile(target_path, "w", zipfile.ZIP_DEFLATED) as zipf:
                for root, _, files in os.walk(self.temp_dir):
                    for file in files:
                        full_path = Path(root) / file
                        rel_path = full_path.relative_to(self.temp_dir)
                        zipf.write(full_path, arcname=str(rel_path))
        return target_path

    def finalize_db_record(self, file_path: Path, file_size: int, duration: int):
        try:
            conn = self._get_db_conn(self.meta_db_name)
            with conn.cursor() as cursor:
                if self.uuid:
                    cursor.execute(
                        """
                        UPDATE backups
                        SET status = 'completed',
                            progress_percent = 100,
                            current_step = 'Completado',
                            file_path = %s,
                            file_size_bytes = %s,
                            duration_seconds = %s,
                            completed_at = NOW()
                        WHERE uuid = %s
                    """,
                        (str(file_path), file_size, duration, self.uuid),
                    )
                elif self.backup_id:
                    cursor.execute(
                        """
                        UPDATE backups
                        SET status = 'completed',
                            progress_percent = 100,
                            current_step = 'Completado',
                            file_path = %s,
                            file_size_bytes = %s,
                            duration_seconds = %s,
                            completed_at = NOW()
                        WHERE id = %s
                    """,
                        (str(file_path), file_size, duration, self.backup_id),
                    )
            conn.close()
        except Exception:
            pass

    def fail_db_record(self, error_message: str):
        try:
            conn = self._get_db_conn(self.meta_db_name)
            with conn.cursor() as cursor:
                safe_err = "Error durante el procesamiento del respaldo."
                if self.uuid:
                    cursor.execute(
                        """
                        UPDATE backups
                        SET status = 'failed',
                            error_message = %s,
                            current_step = 'Error al generar respaldo'
                        WHERE uuid = %s
                    """,
                        (safe_err, self.uuid),
                    )
                elif self.backup_id:
                    cursor.execute(
                        """
                        UPDATE backups
                        SET status = 'failed',
                            error_message = %s,
                            current_step = 'Error al generar respaldo'
                        WHERE id = %s
                    """,
                        (safe_err, self.backup_id),
                    )
            conn.close()
        except Exception:
            pass

def main():
    parser = argparse.ArgumentParser(description="Spriteboard Backup Engine")
    parser.add_argument("--payload", type=str, help="JSON string with backup configuration", default=None)
    parser.add_argument("--payload-file", type=str, help="Path to JSON file with backup configuration", default=None)
    args = parser.parse_args()

    config_data = {}
    if args.payload_file and os.path.exists(args.payload_file):
        with open(args.payload_file, "r", encoding="utf-8") as f:
            config_data = json.load(f)
    elif args.payload:
        config_data = json.loads(args.payload)
    else:
        sys.stderr.write("No configuration payload provided.\n")
        sys.exit(1)

    engine = BackupEngine(config_data)
    engine.run()

if __name__ == "__main__":
    main()
