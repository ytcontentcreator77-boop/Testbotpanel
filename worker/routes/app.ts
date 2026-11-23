import { Hono } from "hono";
import type { Me, Lang } from "../../shared/types";
import { LANGS, pickLang } from "../../shared/types";
import { validateInitData, type TgUser } from "../auth";
import type { Env } from "../env";
import { isOwner } from "../env";
import { brandInfo } from "../brand";
import { getSettings } from "../settings";
import { channelGateRequired, verifyChannel, RetryLater } from "../growth";

interface UserRow {
 id:number; first_name:string; last_name:string; username:string|null; photo_url:string|null;
 language_code:string|null; lang:string|null; balance:number; notify:number; can_message:number;
 terms_accepted_at:number|null; banned:number; channel_ok:number; channel_checked_at:number|null;
}
type Vars={tgUser:TgUser;user:UserRow;lang:Lang;startParam:string|null};
export const app=new Hono<{Bindings:Env;Variables:Vars}>();
const err=(c:any,status:number,code:string)=>c.json({error:code,code},status);
const now=()=>Math.floor(Date.now()/1000);
async function upsert(env:Env,u:TgUser){
 const stamp=now();
 await env.DB.prepare(`INSERT INTO users(id,first_name,last_name,username,photo_url,language_code,created_at,last_seen_at)
 VALUES(?1,?2,?3,?4,?5,?6,?7,?7)
 ON CONFLICT(id) DO UPDATE SET first_name=excluded.first_name,last_name=excluded.last_name,
 username=excluded.username,photo_url=COALESCE(excluded.photo_url,users.photo_url),
 language_code=excluded.language_code,last_seen_at=excluded.last_seen_at`)
 .bind(u.id,u.first_name??"",u.last_name??"",u.username??null,u.photo_url??null,u.language_code??null,stamp).run();
 return env.DB.prepare("SELECT * FROM users WHERE id=?1").bind(u.id).first<UserRow>();
}
app.use("*",async(c,next)=>{
 const auth=c.req.header("authorization")??"";
 if(!auth.startsWith("tma ")) return err(c,401,"UNAUTHORIZED");
 const data=await validateInitData(auth.slice(4),c.env.BOT_TOKEN);
 if(!data?.user?.id) return err(c,401,"UNAUTHORIZED");
 const user=await upsert(c.env,data.user);
 if(!user) return err(c,401,"UNAUTHORIZED");
 if(user.banned) return err(c,403,"BANNED");
 c.set("tgUser",data.user);c.set("user",user);c.set("lang",pickLang(user.lang??user.language_code));c.set("startParam",data.startParam);
 await next();
});
async function meView(c:any,userOverride?:UserRow,langOverride?:Lang):Promise<Me>{
 const u=(userOverride??c.get("user")) as UserRow;const s=await getSettings(c.env);
 return {
  id:u.id,firstName:u.first_name,lastName:u.last_name,username:u.username,photoUrl:u.photo_url,
  lang:langOverride??c.get("lang"),langChosen:u.lang!==null,balance:u.balance??0,notify:!!u.notify,canMessage:!!u.can_message,
  termsAccepted:!!u.terms_accepted_at,isAdmin:isOwner(c.env,s,u.id),
  starsPerUsd:s.stars_per_usd,minTopup:s.min_topup_stars,maxTopup:s.max_topup_stars,
  supportUsername:s.support_username||null,channelUrl:s.channel_url||null,
  channelRequired:await channelGateRequired(c.env,s,u),referralEnabled:false,referralReward:0,
  botUsername:s.bot_username||null,brand:brandInfo(s),recent:[]
 };
}
app.get("/me",async c=>c.json(await meView(c)));
app.patch("/me",async c=>{
 const body=await c.req.json<{lang?:string|null;notify?:boolean;canMessage?:boolean;acceptTerms?:boolean}>().catch(()=>null);
 if(!body||typeof body!=="object") return err(c,400,"INVALID_BODY");
 const u=c.get("user");const sets:string[]=[];const vals:unknown[]=[];
 if(body.lang!==undefined){if(body.lang!==null&&!(LANGS as readonly string[]).includes(body.lang))return err(c,400,"INVALID_LANG");sets.push("lang=?");vals.push(body.lang)}
 if(body.notify!==undefined)sets.push("notify="+(body.notify?1:0));
 if(body.canMessage)sets.push("can_message=1");
 if(body.acceptTerms)sets.push(`terms_accepted_at=COALESCE(terms_accepted_at,${now()})`);
 if(sets.length){await c.env.DB.prepare(`UPDATE users SET ${sets.join(",")} WHERE id=?`).bind(...vals,u.id).run();const updated=await c.env.DB.prepare("SELECT * FROM users WHERE id=?1").bind(u.id).first<UserRow>();if(updated)return c.json(await meView(c,updated,pickLang(updated.lang??updated.language_code)))}
 return c.json(await meView(c));
});
app.get("/terms",async c=>{const s=await getSettings(c.env);return c.json({terms:s.terms_text||"Telegram X Hero community guidelines."})});
app.post("/channel/verify",async c=>{
 const s=await getSettings(c.env);let result;
 try{result=await verifyChannel(c.env,s,c.get("user").id)}catch(e){if(e instanceof RetryLater)return err(c,429,"TRY_AGAIN");throw e}
 c.set("user",await c.env.DB.prepare("SELECT * FROM users WHERE id=?1").bind(c.get("user").id).first<UserRow>());
 return c.json({result,me:await meView(c)});
});
