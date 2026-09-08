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
    role: String,
    tx: ClientSender,
}

#[derive(Debug)]
enum RedisOutboundCmd {
    Publish {
        channel: String,
        payload: String,
    },
    SetPresence {
        canvas_uuid: String,
        conn_id: String,
        user_json: String,
    },
    RemovePresence {
        canvas_uuid: String,
        conn_id: String,
    },
    CacheSnapshot {
        canvas_uuid: String,
        data_json: String,
    },
}

#[derive(Debug, Serialize, Deserialize)]
struct RedisCanvasEnvelope {
    origin_instance: String,
    canvas_uuid: String,
    sender_conn_id: String,
    is_binary: bool,
    payload: String,
}

#[derive(Clone)]
struct AppState {
    // user_id -> Map<conn_id, Sender>
    clients: Arc<RwLock<HashMap<i64, HashMap<String, ClientSender>>>>,
    // canvas_uuid -> Map<conn_id, CanvasParticipant>
    canvas_rooms: Arc<RwLock<HashMap<String, HashMap<String, CanvasParticipant>>>>,
    session_secret: Arc<String>,
    instance_id: Arc<String>,
    redis_cmd_tx: mpsc::UnboundedSender<RedisOutboundCmd>,
    redis_client: Arc<redis::Client>,
}

impl AppState {
    fn publish_canvas_event(
        &self,
        canvas_uuid: &str,
        sender_conn_id: &str,
        payload: String,
        is_binary: bool,
    ) {
        let envelope = RedisCanvasEnvelope {
            origin_instance: (*self.instance_id).clone(),
            canvas_uuid: canvas_uuid.to_string(),
            sender_conn_id: sender_conn_id.to_string(),
            is_binary,
            payload,
        };
        if let Ok(serialized) = serde_json::to_string(&envelope) {
            let channel = format!("canvas:events:{}", canvas_uuid);
            let _ = self.redis_cmd_tx.send(RedisOutboundCmd::Publish {
                channel,
                payload: serialized,
            });
        }
    }
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
    role: String,
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

#[derive(Debug, Deserialize)]
struct RoomTokenPayload {
    #[serde(rename = "canvasUuid")]
    canvas_uuid: String,
    #[serde(rename = "userId")]
    user_id: i64,
    role: String,
    exp: u64,
}

fn parse_hex_color(hex: &str) -> [u8; 3] {
    let s = hex.trim_start_matches('#');
    if s.len() == 6 {
        if let (Ok(r), Ok(g), Ok(b)) = (
            u8::from_str_radix(&s[0..2], 16),
            u8::from_str_radix(&s[2..4], 16),
            u8::from_str_radix(&s[4..6], 16),
        ) {
            return [r, g, b];
        }
    }
    [0, 229, 255]
}

fn verify_room_token(
    token: &str,
    secret: &str,
    expected_canvas_uuid: &str,
    user_id: i64,
) -> Option<String> {
    if token.is_empty() {
        return None;
    }
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
    let parsed: RoomTokenPayload = serde_json::from_str(payload_str).ok()?;

    let now_ms = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .ok()?
        .as_millis() as u64;

    if now_ms > parsed.exp {
        return None;
    }

    if parsed.canvas_uuid != expected_canvas_uuid {
        return None;
    }

    if parsed.user_id != user_id && user_id > 0 {
        return None;
    }

    Some(parsed.role)
}

async fn ws_handler(
    ws: WebSocketUpgrade,
    State(state): State<AppState>,
    req: Request,
) -> Response {
    let session_secret = state.session_secret.clone();
    let auth_user = extract_cookie(&req, "auth_session")
        .or_else(|| extract_cookie(&req, "sb_session"))
        .and_then(|token| verify_session_token(token, &session_secret));

    let user = auth_user.unwrap_or_else(|| {
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
    let session_secret = state.session_secret.clone();
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
                                        let room_token = val.get("roomToken")
                                            .or_else(|| val.get("room_token"))
                                            .and_then(|t| t.as_str())
                                            .unwrap_or("");

                                        let role = match verify_room_token(room_token, &session_secret, canvas_uuid, user.id) {
                                            Some(r) => r,
                                            None => {
                                                let err_msg = serde_json::json!({
                                                    "type": "CANVAS_JOIN_ERROR",
                                                    "canvasUuid": canvas_uuid,
                                                    "code": "UNAUTHORIZED_ROOM",
                                                    "message": "No tienes autorización para unirte a este lienzo."
                                                }).to_string();
                                                let _ = tx.send(Message::Text(err_msg));
                                                continue;
                                            }
                                        };

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
                                            role: role.clone(),
                                            tx: tx.clone(),
                                        };

                                        joined_rooms.insert(canvas_uuid.to_string());

                                        let mut rooms = state.canvas_rooms.write().await;
                                        let room = rooms.entry(canvas_uuid.to_string()).or_default();

                                        let mut presence_map: HashMap<String, ParticipantInfo> = HashMap::new();

                                        // 1. Cargar presencia global desde Redis
                                        let presence_key = format!("canvas:{}:presence", canvas_uuid);
                                        if let Ok(mut rconn) = state.redis_client.get_async_connection().await {
                                            let remote_presence: Result<HashMap<String, String>, _> = redis::cmd("HGETALL")
                                                .arg(&presence_key)
                                                .query_async(&mut rconn)
                                                .await;
                                            if let Ok(entries) = remote_presence {
                                                for (_c_id, info_json) in entries {
                                                    if let Ok(info) = serde_json::from_str::<ParticipantInfo>(&info_json) {
                                                        presence_map.insert(info.conn_id.clone(), info);
                                                    }
                                                }
                                            }
                                        }

                                        // 2. Combinar con participantes locales
                                        for p in room.values() {
                                            presence_map.insert(
                                                p.conn_id.clone(),
                                                ParticipantInfo {
                                                    conn_id: p.conn_id.clone(),
                                                    user_id: p.user_id,
                                                    username: p.username.clone(),
                                                    color: p.color.clone(),
                                                    role: p.role.clone(),
                                                },
                                            );
                                        }

                                        // 3. Incluir al usuario actual
                                        presence_map.insert(
                                            conn_id.clone(),
                                            ParticipantInfo {
                                                conn_id: conn_id.clone(),
                                                user_id: user.id,
                                                username: display_name.clone(),
                                                color: color.clone(),
                                                role: role.clone(),
                                            },
                                        );

                                        let presence_users: Vec<ParticipantInfo> = presence_map.into_values().collect();

                                        let presence_msg = serde_json::json!({
                                            "type": "ROOM_PRESENCE",
                                            "canvasUuid": canvas_uuid,
                                            "users": presence_users,
                                            "yourRole": role
                                        }).to_string();

                                        let _ = tx.send(Message::Text(presence_msg));

                                        let user_joined_msg = serde_json::json!({
                                            "type": "USER_JOINED",
                                            "canvasUuid": canvas_uuid,
                                            "user": {
                                                "connId": conn_id.clone(),
                                                "userId": user.id,
                                                "username": display_name,
                                                "color": color,
                                                "role": role
                                            }
                                        }).to_string();

                                        for (peer_conn, peer) in room.iter() {
                                            if peer_conn != &conn_id {
                                                let _ = peer.tx.send(Message::Text(user_joined_msg.clone()));
                                            }
                                        }

                                        room.insert(conn_id.clone(), participant);

                                        // Notificar a otras réplicas mediante Redis Pub/Sub
                                        state.publish_canvas_event(canvas_uuid, &conn_id, user_joined_msg, false);

                                        // Guardar presencia en Redis Hash con expiración
                                        let user_info_json = serde_json::json!({
                                            "connId": conn_id.clone(),
                                            "userId": user.id,
                                            "username": display_name,
                                            "color": color,
                                            "role": role
                                        }).to_string();
                                        let _ = state.redis_cmd_tx.send(RedisOutboundCmd::SetPresence {
                                            canvas_uuid: canvas_uuid.to_string(),
                                            conn_id: conn_id.clone(),
                                            user_json: user_info_json,
                                        });
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

                                                state.publish_canvas_event(canvas_uuid, &conn_id, user_left_msg, false);
                                                let _ = state.redis_cmd_tx.send(RedisOutboundCmd::RemovePresence {
                                                    canvas_uuid: canvas_uuid.to_string(),
                                                    conn_id: conn_id.clone(),
                                                });
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

                                                state.publish_canvas_event(canvas_uuid, &conn_id, cursor_msg, false);
                                            }
                                        }
                                    }
                                    "CANVAS_DRAW_STROKE" | "CANVAS_ACTION" | "CANVAS_FULL_UPDATE" => {
                                        let rooms = state.canvas_rooms.read().await;
                                        if let Some(room) = rooms.get(canvas_uuid) {
                                            if let Some(sender_p) = room.get(&conn_id) {
                                                if sender_p.role != "viewer" {
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

                                                    state.publish_canvas_event(canvas_uuid, &conn_id, forward_msg.clone(), false);

                                                    if msg_type == "CANVAS_FULL_UPDATE" {
                                                        if let Some(canvas_data) = val.get("data") {
                                                            let _ = state.redis_cmd_tx.send(RedisOutboundCmd::CacheSnapshot {
                                                                canvas_uuid: canvas_uuid.to_string(),
                                                                data_json: canvas_data.to_string(),
                                                            });
                                                        }
                                                    }
                                                }
                                            }
                                        }
                                    }
                                    "CANVAS_ACCESS_CHANGED" => {
                                        let mut rooms = state.canvas_rooms.write().await;
                                        if let Some(room) = rooms.get_mut(canvas_uuid) {
                                            let access_level = val.get("accessLevel").and_then(|a| a.as_str()).unwrap_or("private");
                                            let public_role = val.get("publicRole").and_then(|a| a.as_str()).unwrap_or("editor");

                                            if access_level == "public" {
                                                for (peer_conn, peer) in room.iter_mut() {
                                                    if peer_conn != &conn_id && peer.role != "owner" {
                                                        peer.role = public_role.to_string();
                                                    }
                                                }
                                            }

                                            let notice_msg = serde_json::json!({
                                                "type": "CANVAS_ACCESS_CHANGED",
                                                "canvasUuid": canvas_uuid,
                                                "accessLevel": access_level,
                                                "publicRole": public_role,
                                                "senderConnId": conn_id
                                            }).to_string();

                                            for (peer_conn, peer) in room.iter() {
                                                if peer_conn != &conn_id {
                                                    let _ = peer.tx.send(Message::Text(notice_msg.clone()));
                                                }
                                            }

                                            state.publish_canvas_event(canvas_uuid, &conn_id, notice_msg, false);
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

                                        state.publish_canvas_event(canvas_uuid, &conn_id, notice_msg, false);
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

                                            state.publish_canvas_event(canvas_uuid, &conn_id, notice_msg, false);
                                        }
                                    }
                                    _ => {}
                                }
                            }
                        }
                    }
                    Some(Ok(Message::Binary(bin))) => {
                        if !bin.is_empty() {
                            let opcode = bin[0];
                            match opcode {
                                1 => {
                                    if bin.len() >= 10 {
                                        let uuid_len = bin[1] as usize;
                                        if bin.len() >= 2 + uuid_len + 8 {
                                            if let Ok(canvas_uuid) = std::str::from_utf8(&bin[2..2 + uuid_len]) {
                                                let rooms = state.canvas_rooms.read().await;
                                                if let Some(room) = rooms.get(canvas_uuid) {
                                                    if let Some(sender_p) = room.get(&conn_id) {
                                                        let x_bytes: [u8; 4] = bin[2 + uuid_len..2 + uuid_len + 4].try_into().unwrap_or_default();
                                                        let y_bytes: [u8; 4] = bin[2 + uuid_len + 4..2 + uuid_len + 8].try_into().unwrap_or_default();
                                                        let color_rgb = parse_hex_color(&sender_p.color);

                                                        let conn_bytes = conn_id.as_bytes();
                                                        let conn_len = conn_bytes.len().min(255) as u8;
                                                        let mut out = Vec::with_capacity(1 + 1 + conn_len as usize + 3 + 8);
                                                        out.push(1);
                                                        out.push(conn_len);
                                                        out.extend_from_slice(&conn_bytes[..conn_len as usize]);
                                                        out.extend_from_slice(&color_rgb);
                                                        out.extend_from_slice(&x_bytes);
                                                        out.extend_from_slice(&y_bytes);

                                                        let out_msg = Message::Binary(out.clone());
                                                        for (peer_conn, peer) in room.iter() {
                                                            if peer_conn != &conn_id {
                                                                let _ = peer.tx.send(out_msg.clone());
                                                            }
                                                        }

                                                        let b64 = URL_SAFE_NO_PAD.encode(&out);
                                                        state.publish_canvas_event(canvas_uuid, &conn_id, b64, true);
                                                    }
                                                }
                                            }
                                        }
                                    }
                                }
                                2 => {
                                    if bin.len() >= 4 {
                                        let uuid_len = bin[1] as usize;
                                        if bin.len() > 2 + uuid_len {
                                            if let Ok(canvas_uuid) = std::str::from_utf8(&bin[2..2 + uuid_len]) {
                                                let rooms = state.canvas_rooms.read().await;
                                                if let Some(room) = rooms.get(canvas_uuid) {
                                                    if let Some(sender_p) = room.get(&conn_id) {
                                                        if sender_p.role != "viewer" {
                                                            let stroke_payload = &bin[2 + uuid_len..];
                                                            let conn_bytes = conn_id.as_bytes();
                                                            let conn_len = conn_bytes.len().min(255) as u8;

                                                            let mut out = Vec::with_capacity(1 + 1 + conn_len as usize + stroke_payload.len());
                                                            out.push(2);
                                                            out.push(conn_len);
                                                            out.extend_from_slice(&conn_bytes[..conn_len as usize]);
                                                            out.extend_from_slice(stroke_payload);

                                                            let out_msg = Message::Binary(out.clone());
                                                            for (peer_conn, peer) in room.iter() {
                                                                if peer_conn != &conn_id {
                                                                    let _ = peer.tx.send(out_msg.clone());
                                                                }
                                                            }

                                                            let b64 = URL_SAFE_NO_PAD.encode(&out);
                                                            state.publish_canvas_event(canvas_uuid, &conn_id, b64, true);
                                                        }
                                                    }
                                                }
                                            }
                                        }
                                    }
                                }
                                _ => {}
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

                    state.publish_canvas_event(&room_id, &conn_id, user_left_msg, false);
                    let _ = state.redis_cmd_tx.send(RedisOutboundCmd::RemovePresence {
                        canvas_uuid: room_id.clone(),
                        conn_id: conn_id.clone(),
                    });
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
                    if let Err(e) = pubsub.psubscribe("canvas:events:*").await {
                        eprintln!("[WebSocket] Error al suscribirse a 'canvas:events:*': {}", e);
                        tokio::time::sleep(tokio::time::Duration::from_secs(3)).await;
                        continue;
                    }

                    println!("[WebSocket] Suscrito exitosamente a 'auth:session_events' y 'canvas:events:*' en Redis");
                    let mut stream = pubsub.into_on_message();

                    while let Some(msg) = stream.next().await {
                        let channel_name = msg.get_channel_name().to_string();
                        let payload = match msg.get_payload::<String>() {
                            Ok(p) => p,
                            Err(_) => continue,
                        };

                        if channel_name == "auth:session_events" {
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
                        } else if channel_name.starts_with("canvas:events:") {
                            if let Ok(env) = serde_json::from_str::<RedisCanvasEnvelope>(&payload) {
                                // Descartar si proviene de esta misma réplica
                                if env.origin_instance == *state.instance_id {
                                    continue;
                                }

                                let rooms = state.canvas_rooms.read().await;
                                if let Some(room) = rooms.get(&env.canvas_uuid) {
                                    if !env.is_binary {
                                        let outgoing = Message::Text(env.payload);
                                        for (peer_conn, peer) in room.iter() {
                                            if peer_conn != &env.sender_conn_id {
                                                let _ = peer.tx.send(outgoing.clone());
                                            }
                                        }
                                    } else if let Ok(bytes) = URL_SAFE_NO_PAD.decode(&env.payload) {
                                        let outgoing = Message::Binary(bytes);
                                        for (peer_conn, peer) in room.iter() {
                                            if peer_conn != &env.sender_conn_id {
                                                let _ = peer.tx.send(outgoing.clone());
                                            }
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

async fn run_redis_publisher(
    redis_client: Arc<redis::Client>,
    mut rx: mpsc::UnboundedReceiver<RedisOutboundCmd>,
) {
    loop {
        match redis_client.get_async_connection().await {
            Ok(mut conn) => {
                println!("[WebSocket] Conexión de comandos Redis lista.");
                while let Some(cmd) = rx.recv().await {
                    match cmd {
                        RedisOutboundCmd::Publish { channel, payload } => {
                            let res: Result<(), redis::RedisError> = redis::cmd("PUBLISH")
                                .arg(&channel)
                                .arg(&payload)
                                .query_async(&mut conn)
                                .await;
                            if let Err(e) = res {
                                eprintln!("[WebSocket] Error al publicar en canal {}: {}", channel, e);
                            }
                        }
                        RedisOutboundCmd::SetPresence { canvas_uuid, conn_id, user_json } => {
                            let key = format!("canvas:{}:presence", canvas_uuid);
                            let _: Result<(), redis::RedisError> = redis::cmd("HSET")
                                .arg(&key)
                                .arg(&conn_id)
                                .arg(&user_json)
                                .query_async(&mut conn)
                                .await;
                            let _: Result<(), redis::RedisError> = redis::cmd("EXPIRE")
                                .arg(&key)
                                .arg(7200)
                                .query_async(&mut conn)
                                .await;
                        }
                        RedisOutboundCmd::RemovePresence { canvas_uuid, conn_id } => {
                            let key = format!("canvas:{}:presence", canvas_uuid);
                            let _: Result<(), redis::RedisError> = redis::cmd("HDEL")
                                .arg(&key)
                                .arg(&conn_id)
                                .query_async(&mut conn)
                                .await;
                        }
                        RedisOutboundCmd::CacheSnapshot { canvas_uuid, data_json } => {
                            let key = format!("canvas:snapshot:{}", canvas_uuid);
                            let _: Result<(), redis::RedisError> = redis::cmd("SETEX")
                                .arg(&key)
                                .arg(86400)
                                .arg(&data_json)
                                .query_async(&mut conn)
                                .await;
                        }
                    }
                }
                break;
            }
            Err(e) => {
                eprintln!("[WebSocket] Error al obtener conexión asíncrona de comandos Redis: {}", e);
                tokio::time::sleep(tokio::time::Duration::from_secs(3)).await;
            }
        }
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

    let session_secret = env::var("SESSION_SECRET")
        .unwrap_or_else(|_| "spriteboard_session_secret_key_2026".to_string());

    let redis_host = env::var("REDIS_HOST").unwrap_or_else(|_| "127.0.0.1".to_string());
    let redis_port = env::var("REDIS_PORT").unwrap_or_else(|_| "6379".to_string());
    let redis_url = format!("redis://{}:{}/", redis_host, redis_port);

    let redis_client = Arc::new(
        redis::Client::open(redis_url.clone())
            .expect("No se pudo configurar cliente Redis")
    );

    let (redis_cmd_tx, redis_cmd_rx) = mpsc::unbounded_channel::<RedisOutboundCmd>();

    let instance_id = format!(
        "ws-{:x}-{:x}",
        SystemTime::now().duration_since(UNIX_EPOCH).unwrap_or_default().as_millis(),
        std::process::id()
    );

    let state = AppState {
        clients: Arc::new(RwLock::new(HashMap::new())),
        canvas_rooms: Arc::new(RwLock::new(HashMap::new())),
        session_secret: Arc::new(session_secret),
        instance_id: Arc::new(instance_id.clone()),
        redis_cmd_tx,
        redis_client: redis_client.clone(),
    };

    println!(
        "[WebSocket Server] Instancia inicializada con ID: {}",
        instance_id
    );

    // Tarea para despachar comandos hacia Redis (Publicación, Presencia, Snapshot)
    let publisher_client = redis_client.clone();
    tokio::spawn(async move {
        run_redis_publisher(publisher_client, redis_cmd_rx).await;
    });

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
