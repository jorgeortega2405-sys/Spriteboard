import os
from dotenv import load_dotenv

load_dotenv()

class Config:
    # Redis Settings
    REDIS_HOST = os.getenv("REDIS_HOST", "redis")
    REDIS_PORT = int(os.getenv("REDIS_PORT", "6379"))
    REDIS_PASSWORD = os.getenv("REDIS_PASSWORD", None)

    # Cassandra Settings
    CASSANDRA_CONTACT_POINTS = [
        cp.strip() for cp in os.getenv("CASSANDRA_CONTACT_POINTS", "cassandra").split(",") if cp.strip()
    ]
    CASSANDRA_PORT = int(os.getenv("CASSANDRA_PORT", "9042"))
    CASSANDRA_KEYSPACE = os.getenv("CASSANDRA_KEYSPACE", "spriteboard_telemetry")
    CASSANDRA_LOCAL_DC = os.getenv("CASSANDRA_LOCAL_DC", "datacenter1")

    # MySQL Settings
    DB_HOST = os.getenv("DB_HOST", "mysql")
    DB_PORT = int(os.getenv("DB_PORT", "3306"))
    DB_USER = os.getenv("DB_USER", "sprite_user")
    DB_PASSWORD = os.getenv("DB_PASSWORD", "sprite_password")
    DB_CANVAS_NAME = os.getenv("DB_CANVAS_NAME", "db_canvas")
    CANVAS_STORAGE_DIR = os.getenv("CANVAS_STORAGE_DIR", "/data/canvases")

    # Logging
    LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO").upper()

    # AWS S3 Settings
    AWS_REGION = os.getenv("AWS_REGION", "us-east-1")
    AWS_ACCESS_KEY_ID = os.getenv("AWS_ACCESS_KEY_ID", "spriteboard_admin")
    AWS_SECRET_ACCESS_KEY = os.getenv("AWS_SECRET_ACCESS_KEY", "spriteboard_secret_key")
    AWS_S3_BUCKET = os.getenv("AWS_S3_BUCKET", "spriteboard-storage")
    AWS_S3_ENDPOINT = os.getenv("AWS_S3_ENDPOINT", None)
    AWS_S3_FORCE_PATH_STYLE = os.getenv("AWS_S3_FORCE_PATH_STYLE", "true").lower() == "true"

config = Config()

