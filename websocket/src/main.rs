use axum::{
    extract::{
        ws::{Message, WebSocket, WebSocketUpgrade},
        Request, State,
    },
    http::{header, StatusCode},
    response::{IntoResponse, Response},
    routing::get,
    Router,
};
use base64::engine::general_purpose::URL_SAFE_NO_PAD;
use base64::Engine;
use futures_util::StreamExt;
use hmac::{Hmac, Mac};
use serde::Deserialize;
use sha2::Sha256;
use std::collections::HashMap;
use std::env;
use std::net::SocketAddr;
use std::sync::Arc;
use std::time::{SystemTime, UNIX_EPOCH};
use tokio::sync::{mpsc, RwLock};

type HmacSha256 = Hmac<Sha256>;
type ClientSender = mpsc::UnboundedSender<Message>;

#[derive(Clone)]
struct AppState {
    // user_id -> Map<conn_id, Sender>
    clients: Arc<RwLock<HashMap<i64, HashMap<String, ClientSender>>>>,
}

#[derive(Debug, Deserialize)]
struct SessionAccount {
    id: i64,
    username: String,
    #[serde(default)]
    #[allow(dead_code)]
    email: String,
    #[serde(default)]
    #[serde(rename = "sessionId")]
    session_id: Option<String>,
}

#[derive(Debug, Deserialize)]
struct SessionPayload {
    #[serde(rename = "activeId")]
    active_id: Option<i64>,
    #[serde(rename = "sessionId")]
    session_id: Option<String>,
    #[serde(default)]
    accounts: Vec<SessionAccount>,
    id: Option<i64>,
    username: Option<String>,
    exp: Option<u64>,
}

#[derive(Debug, Clone)]
struct AuthenticatedUser {
    id: i64,
    username: String,
    #[allow(dead_code)]
    session_id: Option<String>,
}

#[derive(Debug, Deserialize)]
struct SessionRevokeEvent {
    #[serde(rename = "type")]
    event_type: String,
    #[serde(rename = "userId")]
    user_id: i64,
    #[serde(rename = "sessionId")]
    #[allow(dead_code)]
    session_id: Option<String>,
}

fn extract_cookie<'a>(req: &'a Request, cookie_name: &str) -> Option<&'a str> {
    let cookie_header = req.headers().get(header::COOKIE)?.to_str().ok()?;
    for pair in cookie_header.split(';') {
        let mut parts = pair.trim().splitn(2, '=');
        if let (Some(k), Some(v)) = (parts.next(), parts.next()) {
            if k == cookie_name {
                return Some(v);
            }
        }
    }
    None
}

fn verify_session_token(token: &str, secret: &str) -> Option<AuthenticatedUser> {
    let parts: Vec<&str> = token.split('.').collect();
    if parts.len() != 2 {
        return None;
    }
    let payload_b64 = parts[0];
    let signature_b64 = parts[1];

    let mut mac = HmacSha256::new_from_slice(secret.as_bytes()).ok()?;
    mac.update(payload_b64.as_bytes());

    let expected_bytes = mac.finalize().into_bytes();
    let expected_b64 = URL_SAFE_NO_PAD.encode(expected_bytes);

    if expected_b64 != signature_b64 {
        return None;
    }

    let payload_bytes = URL_SAFE_NO_PAD.decode(payload_b64).ok()?;
    let payload_str = std::str::from_utf8(&payload_bytes).ok()?;
    let parsed: SessionPayload = serde_json::from_str(payload_str).ok()?;

    let now_ms = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .ok()?
        .as_millis() as u64;

    if let Some(exp) = parsed.exp {
        if now_ms > exp {
            return None;
        }
    }

    if let Some(active_id) = parsed.active_id {
        if let Some(acc) = parsed.accounts.into_iter().find(|a| a.id == active_id) {
            return Some(AuthenticatedUser {
                id: acc.id,
                username: acc.username,
                session_id: acc.session_id.or(parsed.session_id),
            });
        }
    }

    if let (Some(id), Some(username)) = (parsed.id, parsed.username) {
        return Some(AuthenticatedUser {
            id,
            username,
            session_id: parsed.session_id,
        });
    }

    None
}

async fn ws_handler(
    State(state): State<AppState>,
    ws: WebSocketUpgrade,
    req: Request,
) -> Response {
    let session_secret = env::var("SESSION_SECRET")
        .unwrap_or_else(|_| "spriteboard_session_secret_key_2026".to_string());

    let user = match extract_cookie(&req, "sprite_session") {
        Some(token) => verify_session_token(token, &session_secret),
        None => None,
    };

    let user = match user {
        Some(u) => u,
        None => {
            return (
                StatusCode::UNAUTHORIZED,
                "Unauthorized: Valid session required for WebSocket connection\n",
            )
                .into_response();
        }
    };

    ws.on_upgrade(move |socket| handle_socket(socket, user, state))
}

async fn handle_socket(mut socket: WebSocket, user: AuthenticatedUser, state: AppState) {
    let conn_id = format!(
        "{}_{}",
        user.id,
        SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_nanos()
    );

    let (tx, mut rx) = mpsc::unbounded_channel::<Message>();

    {
        let mut clients = state.clients.write().await;
        clients
            .entry(user.id)
            .or_default()
            .insert(conn_id.clone(), tx);
    }

    println!(
        "[WebSocket] Conexión establecida con usuario: {} (ID: {}, Conn: {})",
        user.username, user.id, conn_id
    );

    loop {
        tokio::select! {
            Some(msg_to_send) = rx.recv() => {
                if socket.send(msg_to_send).await.is_err() {
                    break;
                }
            }
            res = socket.recv() => {
                match res {
                    Some(Ok(Message::Close(_))) | None => break,
                    Some(Ok(Message::Ping(payload))) => {
                        if socket.send(Message::Pong(payload)).await.is_err() {
                            break;
                        }
                    }
                    Some(Ok(_)) => {
                        // Mensajes cliente -> servidor reservados para futuros eventos
                    }
                    Some(Err(_)) => break,
                }
            }
        }
    }

    // Limpieza de conexión al desconectar
    {
        let mut clients = state.clients.write().await;
        if let Some(user_conns) = clients.get_mut(&user.id) {
            user_conns.remove(&conn_id);
            if user_conns.is_empty() {
                clients.remove(&user.id);
            }
        }
    }

    println!(
        "[WebSocket] Cliente desconectado: {} (ID: {}, Conn: {})",
        user.username, user.id, conn_id
    );
}

async fn run_redis_pubsub(state: AppState) {
    let redis_host = env::var("REDIS_HOST").unwrap_or_else(|_| "127.0.0.1".to_string());
    let redis_port = env::var("REDIS_PORT").unwrap_or_else(|_| "6379".to_string());
    let redis_url = format!("redis://{}:{}/", redis_host, redis_port);

    loop {
        println!("[WebSocket] Intentando conectar a Redis Pub/Sub en {}...", redis_url);
        match redis::Client::open(redis_url.clone()) {
            Ok(client) => match client.get_async_connection().await {
                Ok(conn) => {
                    let mut pubsub = conn.into_pubsub();
                    if let Err(e) = pubsub.subscribe("auth:session_events").await {
                        eprintln!("[WebSocket] Error al suscribirse a 'auth:session_events': {}", e);
                        tokio::time::sleep(tokio::time::Duration::from_secs(3)).await;
                        continue;
                    }

                    println!("[WebSocket] Suscrito exitosamente a 'auth:session_events' en Redis");
                    let mut stream = pubsub.into_on_message();

                    while let Some(msg) = stream.next().await {
                        if let Ok(payload) = msg.get_payload::<String>() {
                            if let Ok(event) = serde_json::from_str::<SessionRevokeEvent>(&payload) {
                                if event.event_type == "LOGOUT_ALL" || event.event_type == "LOGOUT" {
                                    println!(
                                        "[WebSocket] Evento {} recibido para usuario {}",
                                        event.event_type, event.user_id
                                    );

                                    let clients = state.clients.read().await;
                                    if let Some(user_conns) = clients.get(&event.user_id) {
                                        let disconnect_msg = serde_json::json!({
                                            "type": "SESSION_REVOKED",
                                            "reason": event.event_type.to_lowercase(),
                                            "message": "Tu sesión ha sido cerrada en todos los dispositivos."
                                        }).to_string();

                                        for tx in user_conns.values() {
                                            let _ = tx.send(Message::Text(disconnect_msg.clone()));
                                            let _ = tx.send(Message::Close(None));
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
                Err(e) => {
                    eprintln!("[WebSocket] Error al conectar a Redis Pub/Sub: {}", e);
                }
            },
            Err(e) => {
                eprintln!("[WebSocket] Error al crear cliente Redis: {}", e);
            }
        }
        tokio::time::sleep(tokio::time::Duration::from_secs(3)).await;
    }
}

async fn health_check() -> &'static str {
    "OK"
}

#[tokio::main]
async fn main() {
    let port = env::var("PORT")
        .unwrap_or_else(|_| "3001".to_string())
        .parse::<u16>()
        .unwrap_or(3001);

    let state = AppState {
        clients: Arc::new(RwLock::new(HashMap::new())),
    };

    // Tarea en segundo plano para escuchar eventos Pub/Sub de Redis
    let state_for_redis = state.clone();
    tokio::spawn(async move {
        run_redis_pubsub(state_for_redis).await;
    });

    let app = Router::new()
        .route("/health", get(health_check))
        .route("/ws", get(ws_handler))
        .with_state(state);

    let addr = SocketAddr::from(([0, 0, 0, 0], port));
    println!(
        "[WebSocket Server] Servidor Rust iniciado y escuchando en ws://0.0.0.0:{}",
        port
    );

    let listener = tokio::net::TcpListener::bind(addr)
        .await
        .expect("No se pudo iniciar el listener TCP");

    axum::serve(listener, app.into_make_service())
        .await
        .expect("Error al ejecutar el servidor Axum");
}
