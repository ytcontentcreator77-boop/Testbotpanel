import { useEffect, useState } from "preact/hooks";
import { api } from "../api";
import { navigate } from "../router";

type Person={id:number;firstName:string;lastName:string;username:string|null;photoUrl:string|null};
type Chat={id:number;peerId:number|null;peerFirstName:string|null;peerLastName:string|null;peerUsername:string|null;peerPhotoUrl:string|null;lastMessage:string|null;unread:number};
const full=(u:Person|Chat)=>{const x=u as any;return `${x.firstName??x.peerFirstName??""} ${x.lastName??x.peerLastName??""}`.trim()};
function Avatar({url,name}:{url:string|null|undefined;name:string}){return <span class="hero-avatar">{url?<img src={url} alt=""/>:name.slice(0,1).toUpperCase()||"?"}</span>}
export function ChatHome(){
 const [q,setQ]=useState(""); const [found,setFound]=useState<Person[]>([]); const [items,setItems]=useState<Chat[]>([]); const [busy,setBusy]=useState(false);
 const load=()=>api<{items:Chat[]}>("/chat/conversations").then(r=>setItems(r.items)).catch(()=>{});
 useEffect(()=>{load();const t=setInterval(load,7000);return()=>clearInterval(t)},[]);
 useEffect(()=>{const value=q.trim();if(value.length<2){setFound([]);return}let live=true;const t=setTimeout(()=>api<{items:Person[]}>("/chat/users/search?q="+encodeURIComponent(value)).then(r=>live&&setFound(r.items)).catch(()=>live&&setFound([])),220);return()=>{live=false;clearTimeout(t)}},[q]);
 const start=async(id:number)=>{if(busy)return;setBusy(true);try{const r=await api<{conversationId:number}>("/chat/conversations/direct",{method:"POST",body:{userId:id}});navigate("/chat/"+r.conversationId)}catch(e){alert(e instanceof Error?e.message:"Could not start chat")}finally{setBusy(false)}};
 return <main class="hero-screen">
  <header class="hero-top"><div><small>TELEGRAM X HERO</small><h1>Messages</h1></div><div class="hero-head-actions"><button class="hero-icon-btn" aria-label="Archived chats" onClick={()=>navigate("/archive")}>▣</button><button class="hero-icon-btn" aria-label="Settings" onClick={()=>navigate("/settings")}>⚙</button></div></header>
  <label class="hero-search">⌕ <input value={q} onInput={e=>setQ((e.target as HTMLInputElement).value)} placeholder="Search people by name or @username"/></label>
  {q.trim().length>=2?<section class="hero-section"><h2>People</h2>{found.length?found.map(u=><button class="hero-person" onClick={()=>start(u.id)}><Avatar url={u.photoUrl} name={full(u)}/><span><b>{full(u)}</b><small>{u.username?"@"+u.username:"Telegram user"}</small></span><i>Message ›</i></button>):<p class="hero-muted">No users found. Ask them to open Telegram X Hero once and try their exact @username.</p>}</section>:null}
  <section class="hero-section"><div class="hero-section-head"><h2>All chats</h2><span>{items.length}</span></div>
   {items.length?items.map(c=><button class="hero-chat-row" onClick={()=>navigate("/chat/"+c.id)}><Avatar url={c.peerPhotoUrl} name={full(c)}/><span class="hero-chat-copy"><b>{full(c)||"Telegram user"}</b><small>{c.lastMessage||"Start a conversation"}</small></span><span class="hero-chat-meta">{c.unread>0?<em>{c.unread}</em>:null}<small>@{c.peerUsername||"user"}</small></span></button>):<div class="hero-empty"><b>No conversations yet</b><p>Search for a username above to start your first private chat.</p></div>}
  </section>
  <HeroTabs active="chats"/>
 </main>
}
export function HeroTabs({active}:{active:string}){return <nav class="hero-tabs"><button class={active==="chats"?"active":""} onClick={()=>navigate("/")}>◷<small>Chats</small></button><button class={active==="contacts"?"active":""} onClick={()=>navigate("/contacts")}>♙<small>Contacts</small></button><button class={active==="settings"?"active":""} onClick={()=>navigate("/settings")}>⚙<small>Settings</small></button></nav>}
