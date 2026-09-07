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

    # Logging
    LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO").upper()

config = Config()
