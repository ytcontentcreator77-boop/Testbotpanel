import { useEffect,useState } from "preact/hooks";
import { api } from "../api";
import { navigate } from "../router";
import { HeroTabs } from "./ChatHome";

type ArchivedChat={id:number;peerId:number|null;peerFirstName:string|null;peerLastName:string|null;peerUsername:string|null;peerPhotoUrl:string|null;lastMessage:string|null};
const display=(c:ArchivedChat)=>[c.peerFirstName,c.peerLastName].filter(Boolean).join(" ")||"Telegram user";
export function ArchivedChats(){
 const [items,setItems]=useState<ArchivedChat[]>([]);
 const [busy,setBusy]=useState<number|null>(null);
 const load=()=>api<{items:ArchivedChat[]}>("/chat/conversations/archived").then(r=>setItems(r.items)).catch(()=>setItems([]));
 useEffect(()=>{load()},[]);
 const restore=async(id:number)=>{setBusy(id);try{await api("/chat/conversations/"+id+"/archive",{method:"PATCH",body:{archived:false}});await load()}catch(e){alert(e instanceof Error?e.message:"Could not restore chat")}finally{setBusy(null)}};
 return <main class="hero-screen">
  <header class="hero-top"><div><small>TELEGRAM X HERO</small><h1>Archived chats</h1></div><button class="hero-icon-btn" onClick={()=>navigate("/settings")}>‹</button></header>
  <p class="hero-muted">Chats you archive are hidden from your main inbox. Restore one whenever you want.</p>
  {items.length?items.map(c=><div class="hero-archive-row"><button class="hero-chat-row" onClick={()=>navigate("/chat/"+c.id)}><span class="hero-avatar">{display(c).slice(0,1).toUpperCase()}</span><span class="hero-chat-copy"><b>{display(c)}</b><small>{c.lastMessage||"No messages yet"}</small></span></button><button class="hero-restore" disabled={busy===c.id} onClick={()=>void restore(c.id)}>{busy===c.id?"…":"Restore"}</button></div>):<div class="hero-empty"><b>No archived chats</b><p>When you archive a conversation, it will appear here.</p></div>}
  <HeroTabs active="settings"/>
 </main>
}
