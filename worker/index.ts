import { Hono } from "hono";
import type { Env } from "./env";
import { app as profileApi } from "./routes/app";
import { chat } from "./routes/chat";
import { bot } from "./routes/bot";
import { ensureSchema } from "./migrate";

const app=new Hono<{Bindings:Env}>();
app.use("*",async(c,next)=>{await ensureSchema(c.env);await next()});
app.route("/api",profileApi);
app.route("/api/chat",chat);
app.route("/bot",bot);
app.onError((e,c)=>{console.error(e);return c.json({error:"INTERNAL",code:"INTERNAL"},500)});
export default {
 fetch:app.fetch,
 async scheduled(_controller:ScheduledController,env:Env){
  await ensureSchema(env);
  await env.DB.prepare("DELETE FROM typing_status WHERE expires_at<=?1").bind(Math.floor(Date.now()/1000)).run().catch(()=>undefined);
 }
} satisfies ExportedHandler<Env>;
