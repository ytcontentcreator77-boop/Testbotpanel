import { Hono } from "hono";
import { validateInitData, type TgUser } from "../auth";
import type { Env } from "../env";
import { isOwner } from "../env";

type Vars = { uid: number; tgUser: TgUser };
const chat = new Hono<{ Bindings: Env; Variables: Vars }>();
const fail = (c: any, status: number, code: string) => c.json({ ok: false, code }, status);
const now = () => Math.floor(Date.now() / 1000);
const cleanUsername = (s: string) => s.trim().replace(/^@/, "").toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 32);

chat.use("*", async (c, next) => {
  const auth = c.req.header("authorization") ?? "";
  if (!auth.startsWith("tma ")) return fail(c, 401, "UNAUTHORIZED");
  const data = await validateInitData(auth.slice(4), c.env.BOT_TOKEN);
  if (!data?.user?.id) return fail(c, 401, "UNAUTHORIZED");
  const u = data.user;
  const stamp = now();
  await c.env.DB.prepare(`INSERT INTO users (id, first_name, last_name, username, photo_url, language_code, created_at, last_seen_at)
    VALUES (?1,?2,?3,?4,?5,?6,?7,?7)
    ON CONFLICT(id) DO UPDATE SET first_name=excluded.first_name,last_name=excluded.last_name,
      username=excluded.username,photo_url=COALESCE(excluded.photo_url,users.photo_url),
      language_code=excluded.language_code,last_seen_at=excluded.last_seen_at`)
    .bind(u.id, u.first_name ?? "", u.last_name ?? "", u.username ?? null, u.photo_url ?? null, u.language_code ?? null, stamp).run();
  const me = await c.env.DB.prepare("SELECT banned FROM users WHERE id=?1").bind(u.id).first<{ banned: number }>();
  if (me?.banned) return fail(c, 403, "BANNED");
  c.set("uid", u.id);
  c.set("tgUser", u);
  await next();
});

chat.get("/users/search", async (c) => {
  const raw = (c.req.query("q") ?? "").trim().slice(0, 64);
  if (raw.length < 2) return c.json({ items: [] });
  const username = cleanUsername(raw);
  const like = `%${raw}%`;
  const usernamePrefix = username + "%";
  const items = await c.env.DB.prepare(`SELECT id, first_name AS firstName, last_name AS lastName,
      username, photo_url AS photoUrl, last_seen_at AS lastSeenAt
    FROM users
    WHERE id <> ?1 AND banned = 0 AND (
      lower(username) = ?2 OR lower(username) LIKE ?3 ESCAPE '\\'
      OR first_name LIKE ?4 ESCAPE '\\' OR last_name LIKE ?4 ESCAPE '\\'
      OR (first_name || ' ' || last_name) LIKE ?4 ESCAPE '\\'
    )
    ORDER BY CASE WHEN lower(username)=?2 THEN 0 WHEN lower(username) LIKE ?3 ESCAPE '\\' THEN 1 ELSE 2 END,
      last_seen_at DESC LIMIT 30`)
    .bind(c.get("uid"), username, username ? usernamePrefix : like, like).all();
  return c.json({ items: items.results });
});

chat.get("/users/:id", async (c) => {
  const id = Number(c.req.param("id"));
  if (!Number.isSafeInteger(id) || id <= 0) return fail(c, 400, "INVALID_USER");
  const user = await c.env.DB.prepare(`SELECT id, first_name AS firstName, last_name AS lastName,
    username, photo_url AS photoUrl, last_seen_at AS lastSeenAt FROM users WHERE id=?1 AND banned=0`).bind(id).first();
  return user ? c.json({ user }) : fail(c, 404, "USER_NOT_FOUND");
});

chat.post("/conversations/direct", async (c) => {
  const body = await c.req.json<{ userId?: number }>().catch(() => ({}));
  const other = Number(body.userId);
  const me = c.get("uid");
  if (!Number.isSafeInteger(other) || other <= 0 || other === me) return fail(c, 400, "INVALID_USER");
  const target = await c.env.DB.prepare("SELECT id FROM users WHERE id=?1 AND banned=0").bind(other).first();
  if (!target) return fail(c, 404, "USER_NOT_FOUND");
  const blocked = await c.env.DB.prepare(`SELECT 1 FROM user_blocks WHERE
    (user_id=?1 AND blocked_user_id=?2) OR (user_id=?2 AND blocked_user_id=?1) LIMIT 1`).bind(me, other).first();
  if (blocked) return fail(c, 403, "MESSAGING_BLOCKED");
  const pair = me < other ? `${me}:${other}` : `${other}:${me}`;
  const stamp = now();
  await c.env.DB.prepare(`INSERT INTO conversations(kind,pair_key,created_by,created_at,updated_at)
    VALUES('direct',?1,?2,?3,?3) ON CONFLICT(pair_key) DO NOTHING`).bind(pair, me, stamp).run();
  const conv = await c.env.DB.prepare("SELECT id FROM conversations WHERE pair_key=?1").bind(pair).first<{id:number}>();
  if (!conv) return fail(c, 500, "CONVERSATION_CREATE_FAILED");
  await c.env.DB.batch([
    c.env.DB.prepare("INSERT INTO conversation_members(conversation_id,user_id,role,joined_at) VALUES(?1,?2,'member',?3) ON CONFLICT DO NOTHING").bind(conv.id, me, stamp),
    c.env.DB.prepare("INSERT INTO conversation_members(conversation_id,user_id,role,joined_at) VALUES(?1,?2,'member',?3) ON CONFLICT DO NOTHING").bind(conv.id, other, stamp),
  ]);
  return c.json({ conversationId: conv.id });
});

chat.get("/conversations", async (c) => {
  const uid = c.get("uid");
  const { results } = await c.env.DB.prepare(`SELECT c.id,c.kind,c.title,c.updated_at AS updatedAt,
    m.id AS lastMessageId,m.body AS lastMessage,m.created_at AS lastMessageAt,m.sender_id AS lastSenderId,
    other.id AS peerId,other.first_name AS peerFirstName,other.last_name AS peerLastName,
    other.username AS peerUsername,other.photo_url AS peerPhotoUrl,
    (SELECT COUNT(*) FROM messages unread WHERE unread.conversation_id=c.id AND unread.id>COALESCE(cm.last_read_message_id,0) AND unread.sender_id<>?1 AND unread.deleted_at IS NULL) AS unread
    FROM conversation_members cm JOIN conversations c ON c.id=cm.conversation_id
    LEFT JOIN messages m ON m.id=(SELECT MAX(mx.id) FROM messages mx WHERE mx.conversation_id=c.id AND mx.deleted_at IS NULL)
    LEFT JOIN conversation_members peer ON peer.conversation_id=c.id AND peer.user_id<>?1
    LEFT JOIN users other ON other.id=peer.user_id
    WHERE cm.user_id=?1 ORDER BY COALESCE(m.created_at,c.updated_at) DESC LIMIT 100`).bind(uid).all();
  return c.json({ items: results });
});

chat.get("/conversations/:id/messages", async (c) => {
  const id = Number(c.req.param("id"));
  const uid = c.get("uid");
  const member = await c.env.DB.prepare("SELECT 1 FROM conversation_members WHERE conversation_id=?1 AND user_id=?2").bind(id, uid).first();
  if (!member) return fail(c, 404, "CONVERSATION_NOT_FOUND");
  const before = Number(c.req.query("before") ?? Number.MAX_SAFE_INTEGER);
  const { results } = await c.env.DB.prepare(`SELECT m.id,m.conversation_id AS conversationId,m.sender_id AS senderId,
    m.body,m.media_type AS mediaType,m.media_url AS mediaUrl,m.media_name AS mediaName,
    m.reply_to_id AS replyToId,m.edited_at AS editedAt,m.created_at AS createdAt,
    u.first_name AS senderFirstName,u.last_name AS senderLastName,u.username AS senderUsername
    FROM messages m JOIN users u ON u.id=m.sender_id
    WHERE m.conversation_id=?1 AND m.id<?2 AND m.deleted_at IS NULL ORDER BY m.id DESC LIMIT 50`)
    .bind(id, Number.isSafeInteger(before) ? before : Number.MAX_SAFE_INTEGER).all();
  const latest = results.length ? Math.max(...results.map((x: any) => x.id)) : 0;
  if (latest) await c.env.DB.prepare("UPDATE conversation_members SET last_read_message_id=MAX(COALESCE(last_read_message_id,0),?3) WHERE conversation_id=?1 AND user_id=?2").bind(id,uid,latest).run();
  return c.json({ items: results.reverse() });
});

chat.post("/conversations/:id/messages", async (c) => {
  const id = Number(c.req.param("id"));
  const uid = c.get("uid");
  const body = await c.req.json<{ text?: string; replyToId?: number }>().catch(() => ({}));
  const text = (body.text ?? "").trim();
  const replyTo = Number(body.replyToId);
  const replyToId = Number.isSafeInteger(replyTo) && replyTo > 0 ? replyTo : null;
  if (!text || text.length > 4000) return fail(c, 400, "INVALID_MESSAGE");
  const member = await c.env.DB.prepare("SELECT 1 FROM conversation_members WHERE conversation_id=?1 AND user_id=?2").bind(id,uid).first();
  if (!member) return fail(c, 404, "CONVERSATION_NOT_FOUND");
  const blocked = await c.env.DB.prepare(`SELECT 1 FROM conversation_members cm JOIN user_blocks b
    ON b.user_id=cm.user_id AND b.blocked_user_id=?2
    WHERE cm.conversation_id=?1 AND cm.user_id<>?3 LIMIT 1`).bind(id,uid,uid).first();
  if (blocked) return fail(c, 403, "MESSAGING_BLOCKED");
  const stamp=now();
  const result=await c.env.DB.prepare("INSERT INTO messages(conversation_id,sender_id,body,reply_to_id,created_at) VALUES(?1,?2,?3,?4,?5)")
    .bind(id,uid,text,replyToId,stamp).run();
  await c.env.DB.batch([
    c.env.DB.prepare("UPDATE conversations SET updated_at=?2 WHERE id=?1").bind(id,stamp),
    c.env.DB.prepare("DELETE FROM typing_status WHERE conversation_id=?1 AND user_id=?2").bind(id,uid),
  ]);
  return c.json({ id: result.meta.last_row_id, createdAt: stamp });
});

chat.patch("/messages/:id", async (c) => {
  const id=Number(c.req.param("id")); const uid=c.get("uid");
  const body=await c.req.json<{text?:string}>().catch(()=>({}));
  const text=(body.text??"").trim();
  if(!text||text.length>4000) return fail(c,400,"INVALID_MESSAGE");
  const r=await c.env.DB.prepare("UPDATE messages SET body=?3,edited_at=?4 WHERE id=?1 AND sender_id=?2 AND deleted_at IS NULL")
    .bind(id,uid,text,now()).run();
  return r.meta.changes ? c.json({ok:true}) : fail(c,404,"MESSAGE_NOT_FOUND");
});

chat.delete("/messages/:id", async (c) => {
  const id=Number(c.req.param("id")); const uid=c.get("uid");
  const r=await c.env.DB.prepare("UPDATE messages SET body='',media_url=NULL,deleted_at=?3 WHERE id=?1 AND sender_id=?2 AND deleted_at IS NULL")
    .bind(id,uid,now()).run();
  return r.meta.changes ? c.json({ok:true}) : fail(c,404,"MESSAGE_NOT_FOUND");
});

chat.post("/conversations/:id/typing", async (c) => {
  const id=Number(c.req.param("id")); const uid=c.get("uid");
  const member=await c.env.DB.prepare("SELECT 1 FROM conversation_members WHERE conversation_id=?1 AND user_id=?2").bind(id,uid).first();
  if(!member) return fail(c,404,"CONVERSATION_NOT_FOUND");
  await c.env.DB.prepare("INSERT INTO typing_status(conversation_id,user_id,expires_at) VALUES(?1,?2,?3) ON CONFLICT(conversation_id,user_id) DO UPDATE SET expires_at=excluded.expires_at")
    .bind(id,uid,now()+5).run();
  return c.json({ok:true});
});

chat.get("/conversations/:id/typing", async (c) => {
  const id=Number(c.req.param("id")); const uid=c.get("uid");
  const {results}=await c.env.DB.prepare("SELECT u.id,u.first_name AS firstName,u.username FROM typing_status t JOIN users u ON u.id=t.user_id JOIN conversation_members cm ON cm.user_id=t.user_id AND cm.conversation_id=t.conversation_id WHERE t.conversation_id=?1 AND t.user_id<>?2 AND t.expires_at>?3")
    .bind(id,uid,now()).all();
  return c.json({items:results});
});

chat.post("/contacts/:id", async (c) => {
  const other=Number(c.req.param("id")); const uid=c.get("uid");
  if(!Number.isSafeInteger(other)||other===uid) return fail(c,400,"INVALID_USER");
  const r=await c.env.DB.prepare("INSERT INTO contacts(user_id,contact_user_id,created_at) SELECT ?1,id,?3 FROM users WHERE id=?2 AND banned=0 ON CONFLICT DO NOTHING").bind(uid,other,now()).run();
  return r.meta.changes ? c.json({ok:true}) : fail(c,404,"USER_NOT_FOUND");
});

chat.get("/contacts", async (c) => {
  const {results}=await c.env.DB.prepare("SELECT u.id,u.first_name AS firstName,u.last_name AS lastName,u.username,u.photo_url AS photoUrl FROM contacts c JOIN users u ON u.id=c.contact_user_id WHERE c.user_id=?1 ORDER BY u.first_name,u.username")
    .bind(c.get("uid")).all();
  return c.json({items:results});
});

chat.post("/users/:id/block", async (c) => {
  const other=Number(c.req.param("id")); const uid=c.get("uid");
  if(!Number.isSafeInteger(other)||other===uid) return fail(c,400,"INVALID_USER");
  await c.env.DB.prepare("INSERT INTO user_blocks(user_id,blocked_user_id,created_at) VALUES(?1,?2,?3) ON CONFLICT DO NOTHING").bind(uid,other,now()).run();
  return c.json({ok:true});
});

chat.post("/reports", async (c) => {
  const body=await c.req.json<{userId?:number;messageId?:number;reason?:string}>().catch(()=>({}));
  const reason=(body.reason??"").trim().slice(0,500);
  const reportedId=Number(body.userId);
  if(!Number.isSafeInteger(reportedId)||reportedId<=0||!reason) return fail(c,400,"INVALID_REPORT");
  await c.env.DB.prepare("INSERT INTO message_reports(reporter_id,message_id,reported_user_id,reason,created_at) VALUES(?1,?2,?3,?4,?5)")
    .bind(c.get("uid"),body.messageId??null,reportedId,reason,now()).run();
  return c.json({ok:true});
});

chat.get("/admin/overview", async (c) => {
  if(!isOwner(c.env, await (await import("../settings")).getSettings(c.env), c.get("uid"))) return fail(c,403,"FORBIDDEN");
  const stats=await c.env.DB.prepare("SELECT (SELECT COUNT(*) FROM users WHERE banned=0) users,(SELECT COUNT(*) FROM conversations) conversations,(SELECT COUNT(*) FROM messages WHERE deleted_at IS NULL) messages,(SELECT COUNT(*) FROM message_reports WHERE status='open') reports").first();
  return c.json({stats});
});

chat.get("/admin/users", async (c) => {
  if(!isOwner(c.env, await (await import("../settings")).getSettings(c.env), c.get("uid"))) return fail(c,403,"FORBIDDEN");
  const q=(c.req.query("q")??"").trim().slice(0,80); const like=`%${q}%`;
  const {results}=await c.env.DB.prepare("SELECT id,first_name AS firstName,last_name AS lastName,username,banned,created_at AS createdAt,last_seen_at AS lastSeenAt FROM users WHERE (?1='' OR username LIKE ?2 OR first_name LIKE ?2 OR last_name LIKE ?2 OR CAST(id AS TEXT)=?1) ORDER BY last_seen_at DESC LIMIT 100").bind(q,like).all();
  return c.json({items:results});
});

chat.post("/admin/users/:id/ban", async (c) => {
  if(!isOwner(c.env, await (await import("../settings")).getSettings(c.env), c.get("uid"))) return fail(c,403,"FORBIDDEN");
  const id=Number(c.req.param("id")); const body=await c.req.json<{banned?:boolean}>().catch(()=>({}));
  await c.env.DB.prepare("UPDATE users SET banned=?2 WHERE id=?1").bind(id,body.banned?1:0).run();
  return c.json({ok:true});
});

chat.get("/admin/reports", async (c) => {
  if(!isOwner(c.env, await (await import("../settings")).getSettings(c.env), c.get("uid"))) return fail(c,403,"FORBIDDEN");
  const {results}=await c.env.DB.prepare("SELECT r.id,r.reason,r.status,r.created_at AS createdAt,r.reported_user_id AS reportedUserId,r.reporter_id AS reporterId,u.username AS reportedUsername FROM message_reports r LEFT JOIN users u ON u.id=r.reported_user_id ORDER BY r.id DESC LIMIT 100").all();
  return c.json({items:results});
});

chat.patch("/admin/reports/:id", async (c) => {
  if(!isOwner(c.env, await (await import("../settings")).getSettings(c.env), c.get("uid"))) return fail(c,403,"FORBIDDEN");
  const body=await c.req.json<{status?:string}>().catch(()=>({}));
  const status=body.status??"";
  if(!["reviewed","dismissed"].includes(status)) return fail(c,400,"INVALID_STATUS");
  await c.env.DB.prepare("UPDATE message_reports SET status=?2,resolved_at=?3,resolved_by=?4 WHERE id=?1").bind(Number(c.req.param("id")),status,now(),c.get("uid")).run();
  return c.json({ok:true});
});

export { chat };
