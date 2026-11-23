import { Hono } from "hono";
import type { Env } from "./env";
import { app as profileApi } from "./routes/app";
import { chat } from "./routes/chat";
import { bot } from "./routes/bot";
import { ensureSchema } from "./migrate";
import { timingSafeEqual, webhookSecret } from "./auth";
import { tg } from "./telegram";
import { mediaResponse } from "./assets";
import { getSettings, setSettings } from "./settings";

const app=new Hono<{Bindings:Env}>();
app.use("*",async(c,next)=>{await ensureSchema(c.env);await next()});
app.route("/api",profileApi);
app.route("/api/chat",chat);
app.route("/bot",bot);
app.get("/media/:kind",(c)=>mediaResponse(c.env,c.req.param("kind"),c.req.query("v")));
app.get("/setup/:secret",async c=>{
 const expected=c.env.SETUP_SECRET??"";
 if(!expected||!timingSafeEqual(c.req.param("secret"),expected))return c.notFound();
 const origin=new URL(c.req.url).origin;
 const secret=await webhookSecret(c.env);
 await tg(c.env.BOT_TOKEN,"setWebhook",{url:origin+"/bot",secret_token:secret,allowed_updates:["message"]});
 await tg(c.env.BOT_TOKEN,"setMyCommands",{commands:[{command:"start",description:"Open Telegram X Hero"},{command:"help",description:"How to use Telegram X Hero"}]});
 const botInfo=await tg<{username?:string}>(c.env.BOT_TOKEN,"getMe");
 const settings=await getSettings(c.env);
 if(botInfo.username&&!settings.bot_username)await setSettings(c.env,{bot_username:botInfo.username});
 return c.json({ok:true,webhook:origin+"/bot",message:"Webhook configured. Open your bot and press Start."});
});
app.onError((e,c)=>{console.error(e);return c.json({error:"INTERNAL",code:"INTERNAL"},500)});
export default {
 fetch:app.fetch,
 async scheduled(_controller:ScheduledController,env:Env){
  await ensureSchema(env);
  await env.DB.prepare("DELETE FROM typing_status WHERE expires_at<=?1").bind(Math.floor(Date.now()/1000)).run().catch(()=>undefined);
 }
} satisfies ExportedHandler<Env>;
