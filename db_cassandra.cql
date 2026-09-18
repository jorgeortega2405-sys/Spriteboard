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

CREATE KEYSPACE IF NOT EXISTS spriteboard_support
WITH replication = {
    'class': 'SimpleStrategy',
    'replication_factor': 1
};

CREATE TABLE IF NOT EXISTS spriteboard_support.conversations_by_user (
    user_id int,
    created_at timestamp,
    ticket_id int,
    ticket_uuid text,
    ticket_number text,
    subject text,
    description text,
    status text,
    priority text,
    assigned_agent_id int,
    assigned_agent_name text,
    updated_at timestamp,
    closed_at timestamp,
    last_message text,
    last_message_sender text,
    last_message_at timestamp,
    total_messages int,
    PRIMARY KEY ((user_id), created_at, ticket_id)
) WITH CLUSTERING ORDER BY (created_at DESC, ticket_id DESC);

CREATE TABLE IF NOT EXISTS spriteboard_support.tickets_by_id (
    ticket_id int,
    user_id int,
    ticket_uuid text,
    ticket_number text,
    subject text,
    description text,
    status text,
    priority text,
    assigned_agent_id int,
    assigned_agent_name text,
    created_at timestamp,
    updated_at timestamp,
    closed_at timestamp,
    last_message text,
    last_message_sender text,
    last_message_at timestamp,
    total_messages int,
    PRIMARY KEY (ticket_id)
);

CREATE TABLE IF NOT EXISTS spriteboard_support.messages_by_ticket (
    ticket_id int,
    created_at timestamp,
    id int,
    sender_type text,
    sender_id int,
    sender_name text,
    sender_avatar text,
    message text,
    PRIMARY KEY ((ticket_id), created_at, id)
) WITH CLUSTERING ORDER BY (created_at ASC, id ASC);

CREATE KEYSPACE IF NOT EXISTS spriteboard_audit
WITH replication = {
    'class': 'SimpleStrategy',
    'replication_factor': 1
};

CREATE TABLE IF NOT EXISTS spriteboard_audit.admin_audit_logs (
    bucket_month text,
    created_at timestamp,
    id timeuuid,
    actor_id int,
    actor_username text,
    actor_role text,
    action text,
    module text,
    target_type text,
    target_id text,
    description text,
    old_values text,
    new_values text,
    ip_address text,
    user_agent text,
    risk_level text,
    status text,
    PRIMARY KEY ((bucket_month), created_at, id)
) WITH CLUSTERING ORDER BY (created_at DESC, id DESC);

CREATE TABLE IF NOT EXISTS spriteboard_audit.audit_by_actor (
    actor_id int,
    bucket_month text,
    created_at timestamp,
    id timeuuid,
    action text,
    module text,
    target_type text,
    target_id text,
    description text,
    risk_level text,
    ip_address text,
    PRIMARY KEY ((actor_id, bucket_month), created_at, id)
) WITH CLUSTERING ORDER BY (created_at DESC, id DESC);

CREATE TABLE IF NOT EXISTS spriteboard_audit.audit_by_target (
    target_type text,
    target_id text,
    created_at timestamp,
    id timeuuid,
    actor_id int,
    actor_username text,
    action text,
    description text,
    new_values text,
    PRIMARY KEY ((target_type, target_id), created_at, id)
) WITH CLUSTERING ORDER BY (created_at DESC, id DESC);

CREATE KEYSPACE IF NOT EXISTS spriteboard_ai
WITH replication = {
    'class': 'SimpleStrategy',
    'replication_factor': 1
};

CREATE TABLE IF NOT EXISTS spriteboard_ai.chat_messages (
    session_id text,
    created_at timestamp,
    message_id timeuuid,
    user_id int,
    username text,
    is_admin boolean,
    sender_role text,
    content text,
    model_name text,
    tokens_prompt int,
    tokens_completion int,
    feedback_rating text,
    metadata text,
    PRIMARY KEY ((session_id), created_at, message_id)
) WITH CLUSTERING ORDER BY (created_at ASC, message_id ASC);

CREATE TABLE IF NOT EXISTS spriteboard_ai.chat_sessions_by_user (
    user_id int,
    bucket_month text,
    created_at timestamp,
    session_id text,
    first_message text,
    total_messages int,
    last_message_at timestamp,
    PRIMARY KEY ((user_id, bucket_month), created_at, session_id)
) WITH CLUSTERING ORDER BY (created_at DESC, session_id DESC);

CREATE TABLE IF NOT EXISTS spriteboard_ai.copilot_query_audit (
    admin_id int,
    bucket_month text,
    created_at timestamp,
    id timeuuid,
    admin_username text,
    page_context text,
    user_prompt text,
    model_reply text,
    sql_queries_executed text,
    execution_time_ms int,
    success boolean,
    PRIMARY KEY ((admin_id, bucket_month), created_at, id)
) WITH CLUSTERING ORDER BY (created_at DESC, id DESC);


