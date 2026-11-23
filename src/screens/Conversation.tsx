import { useEffect, useRef, useState } from "preact/hooks";
import { api } from "../api";
import { back } from "../router";
import { meStore } from "../store";
type Msg={id:number;senderId:number;body:string;createdAt:number;editedAt:number|null;senderFirstName:string};
export function Conversation({id}:{id:number}){
 const me=meStore.use()!;const [items,setItems]=useState<Msg[]>([]);const [text,setText]=useState("");const [peer,setPeer]=useState<any>(null);const [typing,setTyping]=useState(false);const bottom=useRef<HTMLDivElement>(null);const lastTyping=useRef(0);
 const load=()=>api<{items:Msg[]}>("/chat/conversations/"+id+"/messages").then(r=>setItems(r.items)).catch(()=>{});
 useEffect(()=>{load();const t=setInterval(()=>{load();api<{items:any[]}>("/chat/conversations/"+id+"/typing").then(r=>setTyping(r.items.length>0)).catch(()=>setTyping(false))},2500);return()=>clearInterval(t)},[id]);
 useEffect(()=>{api<{items:any[]}>("/chat/conversations").then(r=>setPeer(r.items.find((x:any)=>x.id===id)??null)).catch(()=>{})},[id]);
 useEffect(()=>{bottom.current?.scrollIntoView({behavior:"smooth"})},[items.length]);
 const send=async()=>{const body=text.trim();if(!body)return;setText("");try{await api("/chat/conversations/"+id+"/messages",{method:"POST",body:{text:body}});await load()}catch(e){setText(body);alert(e instanceof Error?e.message:"Message failed")}};
 return <main class="hero-screen hero-thread"><header class="hero-thread-head"><button onClick={()=>back("/")}>‹</button><span><b>{peer?.peerFirstName||"Conversation"} {peer?.peerLastName||""}</b><small>{typing?"typing…":peer?.peerUsername?"@"+peer.peerUsername:"Telegram X Hero"}</small></span><button onClick={()=>peer?.peerId&&api("/chat/contacts/"+peer.peerId,{method:"POST"}).then(()=>alert("Added to contacts"))}>＋</button></header>
 <div class="hero-messages">{items.map(m=><div class={m.senderId===me.id?"hero-bubble mine":"hero-bubble"}><p>{m.body}</p><small>{new Date(m.createdAt*1000).toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"})}{m.editedAt?" · edited":""}</small>{m.senderId===me.id?<div class="hero-message-actions"><button onClick={()=>{const next=prompt("Edit message",m.body);if(next?.trim())api("/chat/messages/"+m.id,{method:"PATCH",body:{text:next}}).then(load)}}>Edit</button><button onClick={()=>{if(confirm("Delete this message?"))api("/chat/messages/"+m.id,{method:"DELETE"}).then(load)}}>Delete</button></div>:null}</div>)}<div ref={bottom}/></div>
 <div class="hero-composer"><input value={text} onInput={e=>{const value=(e.target as HTMLInputElement).value;setText(value);if(Date.now()-lastTyping.current>1800){lastTyping.current=Date.now();void api("/chat/conversations/"+id+"/typing",{method:"POST",body:{}}).catch(()=>{})}}} onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();void send()}}} placeholder="Message"/><button disabled={!text.trim()} onClick={()=>void send()}>➤</button></div>
 </main>
}
