use axum::{
    extract::{
        ws::{Message, WebSocket, WebSocketUpgrade},
        Request, State,
    },
    http::header,
    response::Response,
    routing::get,
    Router,
};
use base64::engine::general_purpose::URL_SAFE_NO_PAD;
use base64::Engine;
use futures_util::StreamExt;
use hmac::{Hmac, Mac};
use serde::{Deserialize, Serialize};
use sha2::Sha256;
use std::collections::{HashMap, HashSet};
use std::env;
use std::net::SocketAddr;
use std::sync::Arc;
use std::time::{SystemTime, UNIX_EPOCH};
use tokio::sync::{mpsc, RwLock};

type HmacSha256 = Hmac<Sha256>;
type ClientSender = mpsc::UnboundedSender<Message>;

#[derive(Clone)]
struct CanvasParticipant {
    conn_id: String,
    user_id: i64,
    username: String,
    color: String,
    tx: ClientSender,
}

#[derive(Clone)]
struct AppState {
    // user_id -> Map<conn_id, Sender>
    clients: Arc<RwLock<HashMap<i64, HashMap<String, ClientSender>>>>,
    // canvas_uuid -> Map<conn_id, CanvasParticipant>
    canvas_rooms: Arc<RwLock<HashMap<String, HashMap<String, CanvasParticipant>>>>,
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

#[derive(Debug, Serialize, Deserialize)]
struct ParticipantInfo {
    #[serde(rename = "connId")]
    conn_id: String,
    #[serde(rename = "userId")]
    user_id: i64,
    username: String,
    color: String,
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
    let sig_bytes = URL_SAFE_NO_PAD.decode(signature_b64).ok()?;
    let mut mac = HmacSha256::new_from_slice(secret.as_bytes()).ok()?;
    mac.update(payload_b64.as_bytes());

    if mac.verify_slice(&sig_bytes).is_err() {
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

    let user = user.unwrap_or_else(|| {
        let rand_suffix = (SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_millis()
            % 9000
            + 1000) as i64;
        AuthenticatedUser {
            id: -rand_suffix,
            username: format!("Invitado {}", rand_suffix),
            session_id: None,
        }
    });

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
    let mut joined_rooms: HashSet<String> = HashSet::new();

    if user.id > 0 {
        let mut clients = state.clients.write().await;
        clients
            .entry(user.id)
            .or_default()
            .insert(conn_id.clone(), tx.clone());
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
                    Some(Ok(Message::Text(text))) => {
                        if let Ok(val) = serde_json::from_str::<serde_json::Value>(&text) {
                            let msg_type = val.get("type").and_then(|t| t.as_str()).unwrap_or("");
                            let canvas_uuid = val.get("canvasUuid").and_then(|c| c.as_str()).unwrap_or("");

                            if !canvas_uuid.is_empty() {
                                match msg_type {
                                    "JOIN_CANVAS" => {
                                        let display_name = val.get("user")
                                            .and_then(|u| u.get("username"))
                                            .and_then(|un| un.as_str())
                                            .unwrap_or(&user.username)
                                            .to_string();

                                        let color = val.get("user")
                                            .and_then(|u| u.get("color"))
                                            .and_then(|c| c.as_str())
                                            .unwrap_or("#00E5FF")
                                            .to_string();

                                        let participant = CanvasParticipant {
                                            conn_id: conn_id.clone(),
                                            user_id: user.id,
                                            username: display_name.clone(),
                                            color: color.clone(),
                                            tx: tx.clone(),
                                        };

                                        joined_rooms.insert(canvas_uuid.to_string());

                                        let mut rooms = state.canvas_rooms.write().await;
                                        let room = rooms.entry(canvas_uuid.to_string()).or_default();

                                        let presence_users: Vec<ParticipantInfo> = room
                                            .values()
                                            .map(|p| ParticipantInfo {
                                                conn_id: p.conn_id.clone(),
                                                user_id: p.user_id,
                                                username: p.username.clone(),
                                                color: p.color.clone(),
                                            })
                                            .collect();

                                        let presence_msg = serde_json::json!({
                                            "type": "ROOM_PRESENCE",
                                            "canvasUuid": canvas_uuid,
                                            "users": presence_users
                                        }).to_string();

                                        let _ = tx.send(Message::Text(presence_msg));

                                        let user_joined_msg = serde_json::json!({
                                            "type": "USER_JOINED",
                                            "canvasUuid": canvas_uuid,
                                            "user": {
                                                "connId": conn_id.clone(),
                                                "userId": user.id,
                                                "username": display_name,
                                                "color": color
                                            }
                                        }).to_string();

                                        for (peer_conn, peer) in room.iter() {
                                            if peer_conn != &conn_id {
                                                let _ = peer.tx.send(Message::Text(user_joined_msg.clone()));
                                            }
                                        }

                                        room.insert(conn_id.clone(), participant);
                                    }
                                    "LEAVE_CANVAS" => {
                                        joined_rooms.remove(canvas_uuid);
                                        let mut rooms = state.canvas_rooms.write().await;
                                        if let Some(room) = rooms.get_mut(canvas_uuid) {
                                            if let Some(p) = room.remove(&conn_id) {
                                                let user_left_msg = serde_json::json!({
                                                    "type": "USER_LEFT",
                                                    "canvasUuid": canvas_uuid,
                                                    "connId": conn_id.clone(),
                                                    "userId": p.user_id,
                                                    "username": p.username
                                                }).to_string();

                                                for peer in room.values() {
                                                    let _ = peer.tx.send(Message::Text(user_left_msg.clone()));
                                                }
                                            }
                                            if room.is_empty() {
                                                rooms.remove(canvas_uuid);
                                            }
                                        }
                                    }
                                    "CANVAS_CURSOR" => {
                                        let rooms = state.canvas_rooms.read().await;
                                        if let Some(room) = rooms.get(canvas_uuid) {
                                            if let Some(sender_p) = room.get(&conn_id) {
                                                let x = val.get("x").and_then(|v| v.as_f64()).unwrap_or(0.0);
                                                let y = val.get("y").and_then(|v| v.as_f64()).unwrap_or(0.0);

                                                let cursor_msg = serde_json::json!({
                                                    "type": "CANVAS_CURSOR",
                                                    "canvasUuid": canvas_uuid,
                                                    "connId": conn_id.clone(),
                                                    "username": sender_p.username,
                                                    "color": sender_p.color,
                                                    "x": x,
                                                    "y": y
                                                }).to_string();

                                                for (peer_conn, peer) in room.iter() {
                                                    if peer_conn != &conn_id {
                                                        let _ = peer.tx.send(Message::Text(cursor_msg.clone()));
                                                    }
                                                }
                                            }
                                        }
                                    }
                                    "CANVAS_DRAW_STROKE" | "CANVAS_ACTION" | "CANVAS_FULL_UPDATE" => {
                                        let rooms = state.canvas_rooms.read().await;
                                        if let Some(room) = rooms.get(canvas_uuid) {
                                            let mut outgoing = val.clone();
                                            if let Some(obj) = outgoing.as_object_mut() {
                                                obj.insert("senderConnId".to_string(), serde_json::Value::String(conn_id.clone()));
                                            }
                                            let forward_msg = outgoing.to_string();

                                            for (peer_conn, peer) in room.iter() {
                                                if peer_conn != &conn_id {
                                                    let _ = peer.tx.send(Message::Text(forward_msg.clone()));
                                                }
                                            }
                                        }
                                    }
                                    "CANVAS_ACCESS_CHANGED" => {
                                        let rooms = state.canvas_rooms.read().await;
                                        if let Some(room) = rooms.get(canvas_uuid) {
                                            let access_level = val.get("accessLevel").and_then(|a| a.as_str()).unwrap_or("private");
                                            let notice_msg = serde_json::json!({
                                                "type": "CANVAS_ACCESS_CHANGED",
                                                "canvasUuid": canvas_uuid,
                                                "accessLevel": access_level,
                                                "senderConnId": conn_id
                                            }).to_string();

                                            for (peer_conn, peer) in room.iter() {
                                                if peer_conn != &conn_id {
                                                    let _ = peer.tx.send(Message::Text(notice_msg.clone()));
                                                }
                                            }
                                        }
                                    }
                                    "CANVAS_MEMBER_REMOVED" => {
                                        let target_user_id = val.get("targetUserId").and_then(|v| v.as_i64()).unwrap_or(0);
                                        let notice_msg = serde_json::json!({
                                            "type": "CANVAS_MEMBER_REMOVED",
                                            "canvasUuid": canvas_uuid,
                                            "targetUserId": target_user_id,
                                            "senderConnId": conn_id
                                        }).to_string();

                                        let mut rooms = state.canvas_rooms.write().await;
                                        if let Some(room) = rooms.get_mut(canvas_uuid) {
                                            let mut to_remove = Vec::new();
                                            for (peer_conn, peer) in room.iter() {
                                                if peer_conn != &conn_id {
                                                    let _ = peer.tx.send(Message::Text(notice_msg.clone()));
                                                }
                                                if target_user_id > 0 && peer.user_id as i64 == target_user_id {
                                                    to_remove.push(peer_conn.clone());
                                                }
                                            }
                                            for k in to_remove {
                                                room.remove(&k);
                                            }
                                        }
                                    }
                                    "CANVAS_MEMBER_ADDED" => {
                                        let rooms = state.canvas_rooms.read().await;
                                        if let Some(room) = rooms.get(canvas_uuid) {
                                            let member = val.get("member").cloned().unwrap_or(serde_json::Value::Null);
                                            let notice_msg = serde_json::json!({
                                                "type": "CANVAS_MEMBER_ADDED",
                                                "canvasUuid": canvas_uuid,
                                                "member": member,
                                                "senderConnId": conn_id
                                            }).to_string();

                                            for (peer_conn, peer) in room.iter() {
                                                if peer_conn != &conn_id {
                                                    let _ = peer.tx.send(Message::Text(notice_msg.clone()));
                                                }
                                            }
                                        }
                                    }
                                    _ => {}
                                }
                            }
                        }
                    }
                    Some(Ok(_)) => {}
                    Some(Err(_)) => break,
                }
            }
        }
    }

    // Limpieza de salas de lienzo al desconectar
    {
        let mut rooms = state.canvas_rooms.write().await;
        for room_id in joined_rooms {
            if let Some(room) = rooms.get_mut(&room_id) {
                if let Some(p) = room.remove(&conn_id) {
                    let user_left_msg = serde_json::json!({
                        "type": "USER_LEFT",
                        "canvasUuid": room_id,
                        "connId": conn_id.clone(),
                        "userId": p.user_id,
                        "username": p.username
                    }).to_string();

                    for peer in room.values() {
                        let _ = peer.tx.send(Message::Text(user_left_msg.clone()));
                    }
                }
            }
        }
    }

    // Limpieza de conexión de usuario al desconectar
    if user.id > 0 {
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
        canvas_rooms: Arc::new(RwLock::new(HashMap::new())),
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

