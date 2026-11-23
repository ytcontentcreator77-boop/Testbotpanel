// Telegram X Hero update-channel access gate.
import type { Env } from "./env";
import { isOwner } from "./env";
import { alertAdmins } from "./alerts";
import { getSettings, type Settings } from "./settings";
import { tg } from "./telegram";

const DAY = 86400;
const MEMBER = new Set(["creator", "administrator", "member"]);
export type ChannelCheck = "member" | "not_member" | "unavailable";
export class RetryLater extends Error {}
export interface GateUser { id:number; channel_ok:number; channel_checked_at:number|null; }

export async function checkChannel(env:Env,s:Settings,userId:number):Promise<ChannelCheck>{
 if(!s.channel_id)return "unavailable";
 try{
  const m=await tg<{status:string;is_member?:boolean}>(env.BOT_TOKEN,"getChatMember",{chat_id:s.channel_id,user_id:userId});
  return MEMBER.has(m.status)||(m.status==="restricted"&&m.is_member)?"member":"not_member";
 }catch(e){
  const msg=(e as Error).message;
  if(/user not found|participant/i.test(msg))return "not_member";
  if(/\b429\b|too many requests/i.test(msg))throw new RetryLater(msg);
  if(!msg.startsWith("Telegram ")||/^Telegram \w+: 5\d\d\b/.test(msg))return "unavailable";
  await alertAdmins(env,"channel","The bot cannot verify channel membership. Check that it is an administrator in the configured update channel.");
  return "unavailable";
 }
}

export async function channelGateRequired(env:Env,s:Settings,u:GateUser):Promise<boolean>{
 if(!s.channel_gate||!s.channel_id||isOwner(env,s,u.id))return false;
 const stamp=Math.floor(Date.now()/1000);
 if(u.channel_ok===0)return true;
 if(u.channel_checked_at&&stamp-u.channel_checked_at<DAY)return false;
 const result=await checkChannel(env,s,u.id).catch(()=> "unavailable" as const);
 const next=result==="member"?1:result==="not_member"?0:u.channel_ok;
 await env.DB.prepare("UPDATE users SET channel_ok=?2,channel_checked_at=?3 WHERE id=?1").bind(u.id,next,stamp).run();
 return next===0;
}

export async function verifyChannel(env:Env,s:Settings,userId:number):Promise<ChannelCheck>{
 const stamp=Math.floor(Date.now()/1000);
 const slot=await env.DB.prepare("UPDATE users SET channel_checked_at=?2 WHERE id=?1 AND (channel_checked_at IS NULL OR channel_checked_at<=?2-5)").bind(userId,stamp).run();
 if(!slot.meta.changes)throw new RetryLater("too fast");
 const result=await checkChannel(env,s,userId);
 const value=result==="member"?1:result==="not_member"?0:2;
 await env.DB.prepare("UPDATE users SET channel_ok=CASE WHEN ?2=2 AND channel_ok=1 THEN channel_ok ELSE ?2 END,channel_checked_at=?3 WHERE id=?1").bind(userId,value,Math.floor(Date.now()/1000)).run();
 return result;
}
