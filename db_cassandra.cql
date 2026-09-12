CREATE KEYSPACE IF NOT EXISTS spriteboard_telemetry
WITH replication = {
    'class': 'SimpleStrategy',
    'replication_factor': 1
};

CREATE TABLE IF NOT EXISTS spriteboard_telemetry.http_metrics (
    bucket_day text,
    created_at timestamp,
    id timeuuid,
    route text,
    method text,
    status_code int,
    duration_ms int,
    ip_hash text,
    user_agent_category text,
    PRIMARY KEY ((bucket_day), created_at, id)
) WITH CLUSTERING ORDER BY (created_at DESC, id DESC)
  AND default_time_to_live = 2592000;

CREATE TABLE IF NOT EXISTS spriteboard_telemetry.http_metrics_by_route (
    route text,
    bucket_day text,
    created_at timestamp,
    id timeuuid,
    method text,
    status_code int,
    duration_ms int,
    PRIMARY KEY ((route, bucket_day), created_at, id)
) WITH CLUSTERING ORDER BY (created_at DESC, id DESC)
  AND default_time_to_live = 2592000;

CREATE TABLE IF NOT EXISTS spriteboard_telemetry.events (
    bucket_day text,
    created_at timestamp,
    id timeuuid,
    category text,
    event_name text,
    user_id int,
    session_id text,
    metadata text,
    PRIMARY KEY ((bucket_day), created_at, id)
) WITH CLUSTERING ORDER BY (created_at DESC, id DESC)
  AND default_time_to_live = 2592000;

CREATE TABLE IF NOT EXISTS spriteboard_telemetry.events_by_category (
    category text,
    bucket_day text,
    created_at timestamp,
    id timeuuid,
    event_name text,
    user_id int,
    session_id text,
    metadata text,
    PRIMARY KEY ((category, bucket_day), created_at, id)
) WITH CLUSTERING ORDER BY (created_at DESC, id DESC)
  AND default_time_to_live = 2592000;

CREATE TABLE IF NOT EXISTS spriteboard_telemetry.system_metrics (
    bucket_day text,
    created_at timestamp,
    id timeuuid,
    heap_used_mb double,
    heap_total_mb double,
    rss_mb double,
    event_loop_lag_ms double,
    active_requests int,
    PRIMARY KEY ((bucket_day), created_at, id)
) WITH CLUSTERING ORDER BY (created_at DESC, id DESC)
  AND default_time_to_live = 2592000;

CREATE TABLE IF NOT EXISTS spriteboard_telemetry.web_vitals (
    bucket_day text,
    created_at timestamp,
    id timeuuid,
    metric_name text,
    value double,
    rating text,
    page_path text,
    PRIMARY KEY ((bucket_day), created_at, id)
) WITH CLUSTERING ORDER BY (created_at DESC, id DESC)
  AND default_time_to_live = 2592000;
