import { navigate } from "../router";
import { HeroTabs } from "./ChatHome";
export function Premium(){
 return <main class="hero-screen">
  <header class="hero-top"><div><small>TELEGRAM X HERO</small><h1>Premium</h1></div><button class="hero-icon-btn" onClick={()=>navigate("/settings")}>‹</button></header>
  <section class="hero-premium-hero"><div class="hero-premium-orb">✦</div><small>TELEGRAM X HERO</small><h2>Make your chats feel special.</h2><p>Premium features are being prepared for Telegram X Hero.</p><span class="hero-coming-soon">COMING SOON</span></section>
  <section class="hero-section"><h2>What we're preparing</h2><div class="hero-premium-feature"><b>✦ Enhanced profile</b><small>More profile customization and expressive profile details.</small></div><div class="hero-premium-feature"><b>⚡ Extra chat tools</b><small>Additional ways to organize and personalize conversations.</small></div><div class="hero-premium-feature"><b>◈ Exclusive themes</b><small>More color palettes and visual styles for your app.</small></div></section>
  <p class="hero-muted hero-premium-note">No payment is collected on this page. Premium activation and billing are not available yet.</p>
  <HeroTabs active="settings"/>
 </main>
}
