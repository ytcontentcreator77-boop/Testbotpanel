import { useEffect,useState } from "preact/hooks";
import { api } from "../api";
import { navigate } from "../router";
import { HeroTabs } from "../screens/ChatHome";
export function HeroAdmin(){const [stats,setStats]=useState<any>(null);const [users,setUsers]=useState<any[]>([]);const [reports,setReports]=useState<any[]>([]);const [q,setQ]=useState("");const [tab,setTab]=useState("overview");
 const load=()=>{api("/chat/admin/overview").then(r=>setStats((r as any).stats)).catch(()=>{});api("/chat/admin/users").then(r=>setUsers((r as any).items)).catch(()=>{});api("/chat/admin/reports").then(r=>setReports((r as any).items)).catch(()=>{})};
 useEffect(()=>{load()},[]);
 useEffect(()=>{const t=setTimeout(()=>api("/chat/admin/users?q="+encodeURIComponent(q)).then(r=>setUsers((r as any).items)).catch(()=>{}),250);return()=>clearTimeout(t)},[q]);
 const ban=async(u:any)=>{await api("/chat/admin/users/"+u.id+"/ban",{method:"POST",body:{banned:!u.banned}});load()};
 const resolve=async(r:any,status:string)=>{await api("/chat/admin/reports/"+r.id,{method:"PATCH",body:{status}});load()};
 return <main class="hero-screen"><header class="hero-top"><div><small>TELEGRAM X HERO · MANAGEMENT</small><h1>Admin panel</h1></div><button class="hero-icon-btn" onClick={()=>navigate("/")}>×</button></header>
 <div class="hero-admin-tabs">{["overview","users","reports"].map(t=><button class={tab===t?"active":""} onClick={()=>setTab(t)}>{t}</button>)}</div>
 {tab==="overview"?<><div class="hero-stats">{[["Users",stats?.users],["Conversations",stats?.conversations],["Messages",stats?.messages],["Open reports",stats?.reports]].map(([k,v])=><div><small>{k}</small><b>{v??"—"}</b></div>)}</div><section class="hero-section"><h2>Platform management</h2><p class="hero-muted">Manage accounts, moderation and reports. Admin access is restricted to the configured bot owner.</p><button class="hero-setting" onClick={()=>setTab("users")}>Manage users <i>›</i></button><button class="hero-setting" onClick={()=>setTab("reports")}>Review reports <i>›</i></button></section></>:null}
 {tab==="users"?<section class="hero-section"><h2>Users</h2><input class="hero-admin-search" value={q} onInput={e=>setQ((e.target as HTMLInputElement).value)} placeholder="Search name, username or Telegram ID"/>{users.map(u=><div class="hero-admin-row"><span><b>{u.firstName} {u.lastName}</b><small>@{u.username||"no username"} · {u.id}</small></span><button onClick={()=>void ban(u)}>{u.banned?"Unban":"Ban"}</button></div>)}</section>:null}
 {tab==="reports"?<section class="hero-section"><h2>Reports</h2>{reports.length?reports.map(r=><div class="hero-admin-report"><b>Report #{r.id} · @{r.reportedUsername||r.reportedUserId}</b><p>{r.reason}</p><small>{r.status}</small>{r.status==="open"?<div><button onClick={()=>void resolve(r,"reviewed")}>Reviewed</button><button onClick={()=>void resolve(r,"dismissed")}>Dismiss</button></div>:null}</div>):<p class="hero-muted">No reports found.</p>}</section>:null}
 <HeroTabs active="settings"/>
 </main>}
