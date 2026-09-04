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

    # Logging
    LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO").upper()

config = Config()
