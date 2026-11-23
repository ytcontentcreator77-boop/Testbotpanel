import { Hono } from "hono";
import { timingSafeEqual, webhookSecret } from "../auth";
import type { Env } from "../env";
import { tg } from "../telegram";

export const bot=new Hono<{Bindings:Env}>();
bot.post("/",async c=>{
 const secret=c.req.header("x-telegram-bot-api-secret-token")??"";
 if(!secret||!timingSafeEqual(secret,await webhookSecret(c.env)))return c.text("forbidden",403);
 const update=await c.req.json<any>().catch(()=>null);
 const m=update?.message;
 if(!m||m.chat?.type!=="private"||!m.from?.id)return c.text("ok");
 const u=m.from;const stamp=Math.floor(Date.now()/1000);
 await c.env.DB.prepare(`INSERT INTO users(id,first_name,last_name,username,language_code,can_message,created_at,last_seen_at)
 VALUES(?1,?2,?3,?4,?5,1,?6,?6)
 ON CONFLICT(id) DO UPDATE SET first_name=excluded.first_name,last_name=excluded.last_name,
 username=excluded.username,language_code=excluded.language_code,can_message=1,last_seen_at=excluded.last_seen_at`)
 .bind(u.id,u.first_name??"",u.last_name??"",u.username??null,u.language_code??null,stamp).run();
 const text=String(m.text??"").trim();const cmd=/^\/(\w+)/.exec(text)?.[1]?.toLowerCase()??"";
 if(cmd==="start"||cmd==="help"){
  const origin=new URL(c.req.url).origin;
  const markup={inline_keyboard:[[{text:"Open Telegram X Hero",web_app:{url:origin}}]]};
  await tg(c.env.BOT_TOKEN,"sendMessage",{chat_id:u.id,parse_mode:"HTML",text:"👋 <b>Welcome to Telegram X Hero!</b>\n\nChat privately, find people by username, manage your contacts and enjoy a modern messaging experience.\n\nOpen the app to get started.",reply_markup:markup});
 }
 return c.text("ok");
});
