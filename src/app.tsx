import { Fragment, type JSX } from "preact";
import { useEffect, useState } from "preact/hooks";
import { ApiError } from "./api";
import { refreshMe } from "./me";
import { setLang, useLang } from "./i18n";
import { useRoute } from "./router";
import { meStore } from "./store";
import { inTelegram, startParam } from "./tg";
import { ErrorState, Screen, Skeleton, SkeletonGrid, Toasts } from "./ui";
import { ArtGallery } from "./art";
import { Welcome } from "./screens/Welcome";
import { ChatHome } from "./screens/ChatHome";
import { Conversation } from "./screens/Conversation";
import { Contacts } from "./screens/Contacts";
import { ChatSettings } from "./screens/ChatSettings";
import { HeroAdmin } from "./admin/HeroAdmin";
import { LanguagePick } from "./screens/LanguagePick";
import { ChannelGate } from "./screens/ChannelGate";
import { Profile } from "./screens/Profile";
import { LazyPublicPages } from "./lazy";

/** Deep links: t.me/<bot>?startapp=order_12 / s_2828 / wallet */
function routeFromStartParam(p: string | null): string | null {
  if (!p) return null;
  let m = /^order_(\d+)$/.exec(p);
  if (m) return `/order/${m[1]}`;
  m = /^s_(\d+)$/.exec(p);
  if (m) return `/s/${m[1]}`;
  if (p === "wallet" || p === "orders" || p === "profile") return `/${p}`;
  return null;
}

/** Called once before the first render: a deep link replaces the start route (no history entry, no animation). */
export function applyStartRoute() {
  const deep = routeFromStartParam(startParam);
  if (deep && (location.hash === "" || location.hash === "#/")) history.replaceState(history.state, "", "#" + deep);
}

/** Shown until /me answers: shaped like Home (hero card, search, platform grid). */
function AppSkeleton() {
  return (
    <Screen bottom="none">
      <Skeleton h={236} radius={24} />
      <Skeleton h={44} />
      <div class="card">
        <SkeletonGrid />
      </div>
    </Screen>
  );
}

export function App() {
  useLang();
  const me = meStore.use();
  const route = useRoute();
  const [error, setError] = useState<unknown>(null);
  // A plain browser (not Telegram, not the local dev user): the setup wizard, or "Open the bot in Telegram"
  const [outside, setOutside] = useState(false);

  const load = () => {
    setError(null);
    refreshMe()
      .then((m) => setLang(m.lang))
      .catch((e) => {
        if (!inTelegram && e instanceof ApiError && e.code === "UNAUTHORIZED") setOutside(true);
        else setError(e);
      });
  };
  useEffect(load, []);

  // Each route change remounts the screen (keyed), so it plays the enter animation picked by the router (html[data-nav]).
  let key: string;
  let screen: JSX.Element;
  if (import.meta.env.DEV && route.path === "/__art") {
    // Dev-only art gallery (spec §8.3); not linked anywhere.
    key = "__art";
    screen = <ArtGallery />;
  } else if (outside || (import.meta.env.DEV && route.path === "/__public")) {
    // (Dev only: #/__public previews the setup wizard / "open in Telegram" page while signed in as the dev user.)
    key = "public";
    screen = <LazyPublicPages />;
  } else if (error) {
    key = "error";
    screen = (
      <Screen bottom="none" center>
        <ErrorState error={error} onRetry={load} />
      </Screen>
    );
  } else if (!me) {
    key = "loading";
    screen = <AppSkeleton />;
  } else if (!me.langChosen) {
    key = "lang";
    screen = <LanguagePick />;
  } else if (!me.termsAccepted) {
    // First run: language → welcome → join the update channel → home
    key = "welcome";
    screen = <Welcome />;
  } else if (me.channelRequired) {
    key = "gate";
    screen = <ChannelGate />;
  } else {
    const [a, b, c] = route.parts;
    key = route.path + "?" + route.query;
    if (route.path === "/") screen = <ChatHome />;
    else if (a === "chat" && b) screen = <Conversation id={Number(b)} />;
    else if (route.path === "/contacts") screen = <Contacts />;
    else if (route.path === "/settings") screen = <ChatSettings />;
    else if (route.path === "/profile") screen = <Profile />;
    else if (route.path === "/admin" && me.isAdmin) screen = <HeroAdmin />;
    else screen = <ChatHome />;
  }

  return (
    <>
      <Fragment key={key}>{screen}</Fragment>
      <Toasts />
    </>
  );
}
