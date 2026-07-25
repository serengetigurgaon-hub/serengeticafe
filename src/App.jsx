import React, { useState, useEffect, useRef } from "react";
import {
  ChefHat, UtensilsCrossed, Receipt, Users, LogOut, Plus, Minus, Trash2,
  Check, Clock, Flame, Zap, Printer, X, Pencil, Save, ArrowRight,
  Search, ClipboardList, ShieldCheck, CircleDot, ImagePlus, Loader2, Leaf,
  ShoppingBag, Home, LayoutDashboard, TrendingUp, Utensils, MessageCircle,
  Bell, Volume2, PartyPopper, ChevronLeft, ChevronRight, History, Cake, Baby
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, CartesianGrid } from "recharts";
import html2canvas from "html2canvas";
import { initializeApp } from "firebase/app";
import { getFirestore, doc, setDoc, onSnapshot } from "firebase/firestore";

// ---------------------------------------------------------------------------
// Firebase setup — Serengeti · The Eden Park staff app
// ---------------------------------------------------------------------------
const firebaseConfig = {
  apiKey: "AIzaSyAHvVQeolYC0ymNVA9f2FVq-CPZYaOCX9E",
  authDomain: "serengeticafe-75756.firebaseapp.com",
  projectId: "serengeticafe-75756",
  storageBucket: "serengeticafe-75756.firebasestorage.app",
  messagingSenderId: "472969509801",
  appId: "1:472969509801:web:b2b66a2eb58b744b6422b8",
  measurementId: "G-F539H66P1C",
};

const firebaseApp = initializeApp(firebaseConfig);
const db = getFirestore(firebaseApp);

// Dish photo hosting — Cloudinary free tier (no billing card required, unlike
// Firebase Storage which now needs the paid Blaze plan). Create a free account
// at cloudinary.com, then fill these two values in — see setup notes below.
const CLOUDINARY_CLOUD_NAME = "n7puth5b";
const CLOUDINARY_UPLOAD_PRESET = "restaurant_dishes";

// Brand imagery (Serengeti — The Eden Park, serengeti.in)
const BRAND = {
  logo: "https://www.serengeti.in/logo.png",
  hero: "https://www.serengeti.in/media/real/hero.jpg",
  cafePond: "https://www.serengeti.in/media/real/cafe-pond.jpg",
};

// All shared restaurant data lives in one Firestore collection, "restaurant",
// as four documents: profiles / menu / orders / bills — each holding { data: [...] }.
const KEYS = { profiles: "profiles", menu: "menu", orders: "orders", bills: "bills", parties: "parties" };
const COLLECTION = "restaurant";

function docRef(key) {
  return doc(db, COLLECTION, key);
}

function subscribe(key, onChange) {
  return onSnapshot(docRef(key), (snap) => {
    const data = snap.exists() ? snap.data().data : [];
    onChange(Array.isArray(data) ? data : []);
  }, (err) => {
    console.error("Firestore subscribe failed for", key, err);
  });
}

async function persistToFirestore(key, val) {
  try {
    await setDoc(docRef(key), { data: val });
  } catch (e) {
    console.error("Firestore write failed for", key, e);
  }
}

// Rewrites a Cloudinary URL to auto-resize (max 800px wide), auto-compress,
// and auto-select the best format (WebP/AVIF where supported) — makes photos
// load fast on slow restaurant wifi without any quality-loss guesswork.
function optimizeCloudinaryUrl(url) {
  return url.replace("/upload/", "/upload/w_800,c_limit,q_auto,f_auto/");
}

// Uploads a dish photo to Cloudinary and returns its optimized public URL.
async function uploadDishImage(file) {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);
  const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`, {
    method: "POST",
    body: formData,
  });
  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`Cloudinary upload failed: ${res.status} ${errText}`);
  }
  const data = await res.json();
  return optimizeCloudinaryUrl(data.secure_url);
}

const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
const money = (n) => `₹${Number(n || 0).toFixed(2)}`;
const ROLES = ["owner", "manager", "server", "chef"];
const ROLE_LABEL = { owner: "Owner", manager: "Manager", server: "Server", chef: "Chef" };

const STATUS_FLOW = ["pending", "preparing", "ready", "sent"];
const STATUS_LABEL = { pending: "New", preparing: "Preparing", ready: "Complete", sent: "Sent" };
const STATUS_NEXT_LABEL = { pending: "Start Preparing", preparing: "Mark Complete", ready: "Mark Sent" };

// ---------------------------------------------------------------------------
// Sound alerts — generated tones (no audio file to host). Browsers block
// audio until the page has had a user gesture (a click/tap), so we "unlock"
// the shared AudioContext on login — after that, alerts can fire on their
// own. Gain is set to the maximum the browser allows (1.0); a web app can't
// change the device's physical/system volume, only how loud its own sound
// plays within that.
// ---------------------------------------------------------------------------
let sharedAudioCtx = null;
function unlockAudio() {
  try {
    if (!sharedAudioCtx) sharedAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (sharedAudioCtx.state === "suspended") sharedAudioCtx.resume();
  } catch (e) { /* audio unsupported in this browser — alerts will just stay silent */ }
}
function playAlertTone(pattern) {
  try {
    if (!sharedAudioCtx) sharedAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (sharedAudioCtx.state === "suspended") sharedAudioCtx.resume();
    let t = sharedAudioCtx.currentTime;
    pattern.forEach((freq) => {
      const osc = sharedAudioCtx.createOscillator();
      const gain = sharedAudioCtx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(1, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.32);
      osc.connect(gain);
      gain.connect(sharedAudioCtx.destination);
      osc.start(t);
      osc.stop(t + 0.34);
      t += 0.36;
    });
  } catch (e) { /* ignore — visual toast still shows */ }
}
const playNewOrderAlert = () => playAlertTone([880, 660, 880, 660, 880]);
const playStatusAlert = () => playAlertTone([740, 990]);

// ---------------------------------------------------------------------------
// Root App
// ---------------------------------------------------------------------------
export default function App() {
  const [profiles, setProfiles] = useState([]);
  const [menu, setMenu] = useState([]);
  const [orders, setOrders] = useState([]);
  const [bills, setBills] = useState([]);
  const [parties, setParties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loaded, setLoaded] = useState({ profiles: false, menu: false, orders: false, bills: false, parties: false });
  const [currentUser, setCurrentUser] = useState(null);
  const [syncedAt, setSyncedAt] = useState(null);
  const [globalView, setGlobalView] = useState("home");

  // Public read-only menu — reached via a plain link or QR code, no login
  // needed. Example: https://yoursite.github.io/serengeticafe/?menu=1
  const isPublicMenu = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("menu") === "1";

  useEffect(() => {
    const markLoaded = (k) => setLoaded((prev) => ({ ...prev, [k]: true }));
    const unsubs = [
      subscribe(KEYS.profiles, (v) => { setProfiles(v); markLoaded("profiles"); setSyncedAt(new Date()); }),
      subscribe(KEYS.menu, (v) => { setMenu(v); markLoaded("menu"); setSyncedAt(new Date()); }),
      subscribe(KEYS.orders, (v) => { setOrders(v); markLoaded("orders"); setSyncedAt(new Date()); }),
      subscribe(KEYS.bills, (v) => { setBills(v); markLoaded("bills"); setSyncedAt(new Date()); }),
      subscribe(KEYS.parties, (v) => { setParties(v); markLoaded("parties"); setSyncedAt(new Date()); }),
    ];
    return () => unsubs.forEach((u) => u());
  }, []);

  useEffect(() => {
    if (Object.values(loaded).every(Boolean)) setLoading(false);
  }, [loaded]);

  useEffect(() => {
    const handler = (e) => { setCurrentUser(e.detail); setGlobalView("home"); };
    window.addEventListener("rt-login", handler);
    return () => window.removeEventListener("rt-login", handler);
  }, []);

  const persist = { profiles: (n) => { setProfiles(n); persistToFirestore(KEYS.profiles, n); },
    menu: (n) => { setMenu(n); persistToFirestore(KEYS.menu, n); },
    orders: (n) => { setOrders(n); persistToFirestore(KEYS.orders, n); },
    bills: (n) => { setBills(n); persistToFirestore(KEYS.bills, n); },
    parties: (n) => { setParties(n); persistToFirestore(KEYS.parties, n); } };

  // Every role can take orders like a server, not just server logins. Server
  // accounts always land straight on order-taking (that's their whole job);
  // everyone else gets a small toggle to switch into "Take Order" mode.
  const showOrderToggle = currentUser && currentUser.role !== "server";
  const effectiveView = currentUser && currentUser.role === "server" ? "order" : globalView;

  // New-order alerts for chefs, status-change alerts for everyone else —
  // sound + on-screen popup, live off the same Firestore orders feed.
  const notification = useOrderNotifications(orders, currentUser);

  if (isPublicMenu) {
    return (
      <div className="relative min-h-screen">
        <AmbientBackground />
        <FontStyles />
        <PublicMenu menu={menu} loading={loading} />
      </div>
    );
  }

  return (
    <div className="relative min-h-screen">
      <AmbientBackground />
      <FontStyles />
      <NotificationToast notification={notification} />
      {loading ? (
        <div className="relative z-10 min-h-screen flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <Leaf className="text-[#C9A66B] animate-pulse" size={28} />
            <div className="text-[#F3EFE3] font-ticket text-xs tracking-[0.25em] uppercase">Setting the table…</div>
          </div>
        </div>
      ) : !currentUser ? (
        <LoginScreen profiles={profiles} setProfiles={persist.profiles} />
      ) : (
        <Shell currentUser={currentUser} onLogout={() => setCurrentUser(null)} syncedAt={syncedAt}>
          {showOrderToggle && (
            <div className="flex gap-1 mb-5 bg-[#F0EBDD] rounded-full p-1 w-fit no-print">
              <button onClick={() => setGlobalView("home")}
                className={`px-4 py-2 rounded-full text-sm font-ui font-medium flex items-center gap-2 transition ${effectiveView === "home" ? "bg-[#16261F] text-white shadow-md" : "text-[#5c5648] hover:text-[#16261F]"}`}>
                <Home size={15} /> {ROLE_LABEL[currentUser.role]} Dashboard
              </button>
              <button onClick={() => setGlobalView("order")}
                className={`px-4 py-2 rounded-full text-sm font-ui font-medium flex items-center gap-2 transition ${effectiveView === "order" ? "bg-[#16261F] text-white shadow-md" : "text-[#5c5648] hover:text-[#16261F]"}`}>
                <ShoppingBag size={15} /> Take Order
              </button>
            </div>
          )}

          {effectiveView === "order" ? (
            <ServerDashboard currentUser={currentUser} menu={menu} orders={orders} setOrders={persist.orders} />
          ) : (
            <>
              {(currentUser.role === "owner" || currentUser.role === "manager") && (
                <AdminDashboard
                  currentUser={currentUser}
                  profiles={profiles} setProfiles={persist.profiles}
                  menu={menu} setMenu={persist.menu}
                  orders={orders} setOrders={persist.orders}
                  bills={bills} setBills={persist.bills}
                  parties={parties} setParties={persist.parties}
                />
              )}
              {currentUser.role === "chef" && (
                <ChefDashboard orders={orders} setOrders={persist.orders} menu={menu} setMenu={persist.menu} />
              )}
            </>
          )}
        </Shell>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Order notifications — new orders alert the chef, status changes (made by
// the chef) alert everyone else. Sound + on-screen popup.
// ---------------------------------------------------------------------------
function useOrderNotifications(orders, currentUser) {
  const prevRef = useRef(null);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    if (!currentUser) { prevRef.current = null; return; }
    const prev = prevRef.current;

    if (prev === null) {
      // First snapshot after login — just record state, don't fire alerts
      // for orders that already existed before this session started.
      const map = {};
      orders.forEach((o) => { map[o.id] = o.status; });
      prevRef.current = map;
      return;
    }

    const nextMap = {};
    let newOrderForChef = null;
    let statusChangeForOthers = null;

    orders.forEach((o) => {
      nextMap[o.id] = o.status;
      if (!(o.id in prev)) {
        if (currentUser.role === "chef" && o.status === "pending") newOrderForChef = o;
      } else if (prev[o.id] !== o.status) {
        if (currentUser.role === "server" || currentUser.role === "manager" || currentUser.role === "owner") {
          statusChangeForOthers = o;
        }
      }
    });
    prevRef.current = nextMap;

    if (newOrderForChef) {
      playNewOrderAlert();
      setToast({ tone: "new", title: `New order — Table ${newOrderForChef.table}`, subtitle: `${newOrderForChef.items.length} item${newOrderForChef.items.length !== 1 ? "s" : ""} from ${newOrderForChef.serverName}` });
    } else if (statusChangeForOthers) {
      playStatusAlert();
      setToast({ tone: "status", title: `Table ${statusChangeForOthers.table} → ${STATUS_LABEL[statusChangeForOthers.status]}`, subtitle: "Updated by the kitchen" });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orders, currentUser]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 7000);
    return () => clearTimeout(t);
  }, [toast]);

  return [toast, setToast];
}

function NotificationToast({ notification }) {
  const [toast, setToast] = notification;
  if (!toast) return null;
  const isNew = toast.tone === "new";
  return (
    <div className="fixed top-3 left-1/2 -translate-x-1/2 z-50 no-print w-[calc(100%-1.5rem)] max-w-sm">
      <div className={`rounded-2xl shadow-2xl px-4 py-3.5 flex items-start gap-3 text-white ${isNew ? "bg-[#C1694F]" : "bg-[#16261F]"} animate-pulse-once`}>
        <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center shrink-0 mt-0.5">
          <Bell size={16} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-ui font-semibold text-sm leading-tight">{toast.title}</div>
          <div className="font-ui text-xs text-white/80 mt-0.5">{toast.subtitle}</div>
        </div>
        <button onClick={() => setToast(null)} className="shrink-0"><X size={16} /></button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Ambient full-page background — image covers the entire viewport, fixed,
// with every screen's content floating above it in translucent panels.
// ---------------------------------------------------------------------------
function AmbientBackground() {
  return (
    <div className="fixed inset-0 -z-10">
      <img src={BRAND.hero} alt="" className="w-full h-full object-cover" />
      <div className="absolute inset-0 bg-gradient-to-b from-[#0F1C15]/93 via-[#16261F]/88 to-[#0F1C15]/95" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Fonts & shared visual language — modern luxury farm-to-table app
// ---------------------------------------------------------------------------
function FontStyles() {
  return (
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@500;600;700&family=Jost:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600&display=swap');
      .font-display { font-family: 'Cormorant Garamond', ui-serif, Georgia, serif; letter-spacing: 0.01em; }
      .font-ui { font-family: 'Jost', ui-sans-serif, sans-serif; }
      .font-ticket { font-family: 'IBM Plex Mono', ui-monospace, monospace; }
      body { font-family: 'Jost', ui-sans-serif, sans-serif; }
      .perf { background-image: radial-gradient(circle, #DCD5C0 1.2px, transparent 1.4px); background-size: 10px 100%; background-position: center; height: 2px; }
      .scrollbar-none::-webkit-scrollbar { display: none; }
      .scrollbar-none { -ms-overflow-style: none; scrollbar-width: none; }
      .line-clamp-2 { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
      @keyframes pulse-once { 0% { transform: scale(0.95); opacity: 0; } 15% { transform: scale(1.02); opacity: 1; } 30% { transform: scale(1); } 100% { transform: scale(1); } }
      .animate-pulse-once { animation: pulse-once 0.35s ease-out; }
      @media print {
        .no-print { display: none !important; }
        .print-area { position: absolute; top: 0; left: 0; width: 100%; }
      }
    `}</style>
  );
}

function roleColor(role) {
  return { owner: "#C9A66B", manager: "#7C8F5E", server: "#5B8FA3", chef: "#C1694F" }[role] || "#9C9686";
}

// ---------------------------------------------------------------------------
// Public read-only menu — no login required. Reached via a plain link or the
// QR code shown on the staff login screen (?menu=1 in the URL).
// ---------------------------------------------------------------------------
function PublicMenu({ menu, loading }) {
  const [category, setCategory] = useState("All");
  const available = menu.filter((m) => m.available !== false);
  const categories = [...new Set(available.map((m) => m.category))];
  const filtered = category === "All" ? available : available.filter((m) => m.category === category);
  const byCategory = filtered.reduce((acc, m) => { (acc[m.category] = acc[m.category] || []).push(m); return acc; }, {});

  const staffLoginUrl = () => {
    const url = new URL(window.location.href);
    url.searchParams.delete("menu");
    return url.toString();
  };

  return (
    <div className="relative z-10 min-h-screen flex flex-col items-center px-4 py-8 sm:py-10">
      <div className="flex flex-col items-center mb-6 text-center">
        <img src={BRAND.logo} alt="Serengeti" className="h-14 sm:h-16 w-auto mb-3 drop-shadow-lg" />
        <h1 className="font-display text-4xl sm:text-5xl font-600 text-white tracking-tight drop-shadow">Serengeti</h1>
        <p className="font-ui text-[10px] sm:text-xs text-[#C9A66B] uppercase tracking-[0.35em] mt-1.5 font-medium">The Eden Park · Menu</p>
      </div>

      <div className="w-full max-w-4xl bg-[#FAF8F2] rounded-3xl shadow-2xl p-4 sm:p-6">
        {loading ? (
          <p className="text-sm text-[#9C9686] font-ui text-center py-10">Loading menu…</p>
        ) : available.length === 0 ? (
          <p className="text-sm text-[#9C9686] font-ui text-center py-10">The menu isn't published yet — please check back soon.</p>
        ) : (
          <>
            {categories.length > 1 && <CategoryChips categories={categories} selected={category} onSelect={setCategory} />}
            <div className="space-y-6">
              {Object.entries(byCategory).map(([cat, items]) => (
                <div key={cat}>
                  <h3 className="font-ui uppercase text-xs text-[#9C9686] mb-2 tracking-widest font-medium">{cat}</h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {items.map((item) => (
                      <div key={item.id} className="bg-white rounded-2xl shadow-sm overflow-hidden">
                        <DishImage src={item.image} alt={item.name} className="w-full aspect-square" />
                        <div className="p-2.5">
                          <div className="text-sm font-medium text-[#16261F] leading-tight line-clamp-2">{item.name}</div>
                          <div className="font-ui font-semibold text-[#8a6f42] mt-1">{money(item.price)}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      <a href={staffLoginUrl()} className="text-[#EAE4D3] text-xs font-ui underline mt-6">Staff login</a>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Login
// ---------------------------------------------------------------------------
function menuUrl() {
  if (typeof window === "undefined") return "";
  const url = new URL(window.location.href);
  url.search = "";
  url.searchParams.set("menu", "1");
  return url.toString();
}

function CustomerMenuCard() {
  const url = menuUrl();
  const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&margin=8&color=22-38-31&bgcolor=250-248-242&data=${encodeURIComponent(url)}`;
  return (
    <div className="mt-8 bg-white/95 backdrop-blur-sm rounded-2xl shadow-xl p-5 flex flex-col sm:flex-row items-center gap-4 text-center sm:text-left">
      <img src={qrSrc} alt="Scan to view menu" className="w-28 h-28 rounded-xl shrink-0" />
      <div>
        <div className="font-display text-lg font-600 text-[#16261F]">Browsing as a guest?</div>
        <p className="text-xs font-ui text-[#5c5648] mt-1 mb-3">Scan the code or tap below to see today's menu — no login needed.</p>
        <a href={url} className="inline-flex items-center gap-2 bg-[#16261F] text-white text-xs font-ui font-semibold uppercase tracking-wide px-4 py-2.5 rounded-full shadow">
          <UtensilsCrossed size={14} /> View Menu
        </a>
      </div>
    </div>
  );
}

function LoginScreen({ profiles, setProfiles }) {
  const [pendingLogin, setPendingLogin] = useState(null);
  const [pinInput, setPinInput] = useState("");
  const [err, setErr] = useState("");
  const [showSetup, setShowSetup] = useState(profiles.length === 0);
  const [form, setForm] = useState({ name: "", role: "server", pin: "" });

  const attemptLogin = (profile, pin) => {
    unlockAudio();
    if (String(profile.pin) === String(pin)) {
      window.dispatchEvent(new CustomEvent("rt-login", { detail: profile }));
    } else {
      setErr("Incorrect PIN. Try again.");
    }
  };

  const createProfile = (e) => {
    e.preventDefault();
    unlockAudio();
    if (!form.name.trim() || !form.pin.trim()) return;
    const p = { id: uid(), name: form.name.trim(), role: form.role, pin: form.pin.trim() };
    const next = [...profiles, p];
    setProfiles(next);
    if (profiles.length === 0) {
      window.dispatchEvent(new CustomEvent("rt-login", { detail: p }));
    }
    setForm({ name: "", role: "server", pin: "" });
    setShowSetup(false);
  };

  return (
    <div className="relative z-10 min-h-screen flex flex-col items-center justify-center px-4 py-10">
      <div className="relative z-10 flex flex-col items-center mb-8 text-center">
        <img src={BRAND.logo} alt="Serengeti" className="h-14 sm:h-16 w-auto mb-3 drop-shadow-lg" />
        <h1 className="font-display text-4xl sm:text-5xl font-600 text-white tracking-tight drop-shadow">Serengeti</h1>
        <p className="font-ui text-[10px] sm:text-xs text-[#C9A66B] uppercase tracking-[0.35em] mt-1.5 font-medium">The Eden Park · Staff</p>
      </div>

      {profiles.length === 0 ? (
        <div className="relative z-10 w-full max-w-sm bg-white/97 backdrop-blur-xl rounded-3xl p-6 shadow-2xl">
          <p className="font-ui text-xs text-[#9C9686] uppercase mb-4 tracking-widest font-medium">Set up the owner account</p>
          <form onSubmit={createProfile} className="space-y-3">
            <input autoFocus placeholder="Owner's name" value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value, role: "owner" })}
              className="w-full border border-[#EAE4D3] bg-[#FAF8F2] px-4 py-3 text-sm rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#C9A66B]" />
            <input placeholder="Choose a 4+ digit PIN" value={form.pin} inputMode="numeric" pattern="[0-9]*" autoComplete="off"
              onChange={(e) => setForm({ ...form, pin: e.target.value.replace(/\D/g, "") })}
              className="w-full border border-[#EAE4D3] bg-[#FAF8F2] px-4 py-3 text-sm rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#C9A66B]" />
            <button type="submit"
              className="w-full bg-[#16261F] text-white py-3 rounded-2xl text-sm font-ui font-semibold uppercase tracking-wide hover:bg-[#1F3A2E] transition shadow-lg">
              Create Owner Account
            </button>
          </form>
        </div>
      ) : (
        <div className="relative z-10 w-full max-w-md">
          <p className="font-ui text-xs text-[#EAE4D3] uppercase mb-3 tracking-widest text-center font-medium">Who's joining service?</p>
          <div className="grid grid-cols-2 gap-3">
            {profiles.map((p) => (
              <button key={p.id} onClick={() => { setPendingLogin(p); setPinInput(""); setErr(""); }}
                className="bg-white/95 hover:bg-white rounded-2xl px-4 py-4 text-left shadow-xl transition backdrop-blur-sm hover:-translate-y-0.5">
                <div className="w-8 h-8 rounded-full flex items-center justify-center mb-2 text-white text-xs font-ui font-semibold" style={{ backgroundColor: roleColor(p.role) }}>
                  {p.name.charAt(0).toUpperCase()}
                </div>
                <div className="font-display text-lg font-600 text-[#16261F] leading-tight">{p.name}</div>
                <div className="font-ui text-[10px] uppercase tracking-widest font-medium" style={{ color: roleColor(p.role) }}>{ROLE_LABEL[p.role]}</div>
              </button>
            ))}
          </div>
          <button onClick={() => setShowSetup(true)} className="mt-5 text-[#EAE4D3] text-xs font-ui underline mx-auto block">
            + add a staff profile
          </button>

          <CustomerMenuCard />
        </div>
      )}

      {showSetup && profiles.length > 0 && (
        <div className="fixed inset-0 z-20 bg-black/60 flex items-center justify-center px-4" onClick={() => setShowSetup(false)}>
          <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <p className="font-display text-xl font-600 text-[#16261F]">New Profile</p>
              <button onClick={() => setShowSetup(false)} className="p-1 hover:bg-[#F3EFE3] rounded-full"><X size={18} /></button>
            </div>
            <form onSubmit={createProfile} className="space-y-3">
              <input autoFocus placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full border border-[#EAE4D3] bg-[#FAF8F2] px-4 py-3 text-sm rounded-2xl" />
              <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}
                className="w-full border border-[#EAE4D3] bg-[#FAF8F2] px-4 py-3 text-sm rounded-2xl">
                {ROLES.map(r => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
              </select>
              <input placeholder="PIN" value={form.pin} inputMode="numeric" pattern="[0-9]*" autoComplete="off"
                onChange={(e) => setForm({ ...form, pin: e.target.value.replace(/\D/g, "") })}
                className="w-full border border-[#EAE4D3] bg-[#FAF8F2] px-4 py-3 text-sm rounded-2xl" />
              <button type="submit" className="w-full bg-[#16261F] text-white py-3 rounded-2xl text-sm font-ui font-semibold uppercase tracking-wide">Create Profile</button>
            </form>
          </div>
        </div>
      )}

      {pendingLogin && (
        <div className="fixed inset-0 z-20 bg-black/60 flex items-center justify-center px-4" onClick={() => setPendingLogin(null)}>
          <div className="bg-white rounded-3xl p-6 w-full max-w-xs shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="w-10 h-10 rounded-full flex items-center justify-center mb-3 text-white text-sm font-ui font-semibold" style={{ backgroundColor: roleColor(pendingLogin.role) }}>
              {pendingLogin.name.charAt(0).toUpperCase()}
            </div>
            <p className="font-display text-2xl font-600 text-[#16261F] mb-1 leading-tight">{pendingLogin.name}</p>
            <p className="font-ui text-[10px] uppercase tracking-widest mb-4 font-medium" style={{ color: roleColor(pendingLogin.role) }}>{ROLE_LABEL[pendingLogin.role]}</p>
            <form onSubmit={(e) => { e.preventDefault(); attemptLogin(pendingLogin, pinInput); }}>
              <input autoFocus type="password" placeholder="PIN" value={pinInput} inputMode="numeric" pattern="[0-9]*" autoComplete="off"
                onChange={(e) => setPinInput(e.target.value.replace(/\D/g, ""))}
                className="w-full border border-[#EAE4D3] bg-[#FAF8F2] px-4 py-3 text-sm rounded-2xl mb-2 text-center tracking-[0.3em] font-ticket" />
              {err && <p className="text-[#C1694F] text-xs mb-2">{err}</p>}
              <button type="submit" className="w-full bg-[#16261F] text-white py-3 rounded-2xl text-sm font-ui font-semibold uppercase tracking-wide">Log In</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// App Shell (top bar + floating content card)
// ---------------------------------------------------------------------------
function Shell({ currentUser, onLogout, syncedAt, children }) {
  const [soundOn, setSoundOn] = useState(false);
  const enableSound = () => { unlockAudio(); setSoundOn(true); playStatusAlert(); };
  return (
    <div className="relative z-10 min-h-screen flex flex-col">
      <header className="bg-[#16261F] text-white no-print sticky top-0 z-30 shadow-lg">
        <div className="max-w-6xl mx-auto px-3 sm:px-4 py-2.5 sm:py-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <img src={BRAND.logo} alt="Serengeti" className="h-7 sm:h-8 w-auto shrink-0" />
            <div className="min-w-0">
              <div className="font-display text-base sm:text-lg font-600 leading-none truncate">Serengeti</div>
              <div className="font-ui text-[8px] sm:text-[9px] text-[#C9A66B] uppercase tracking-[0.2em] hidden xs:block font-medium">The Eden Park</div>
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-4 shrink-0">
            <button onClick={enableSound} title="Enable notification sound" className={`p-2 rounded-full transition ${soundOn ? "text-[#7C8F5E]" : "text-white/70 hover:bg-white/10"}`}>
              <Volume2 size={17} />
            </button>
            <div className="hidden md:flex items-center gap-1 text-[10px] font-ticket text-[#B8B2A0] uppercase tracking-widest">
              <CircleDot size={9} className="text-[#7C8F5E]" /> synced {syncedAt ? syncedAt.toLocaleTimeString() : "…"}
            </div>
            <div className="text-right leading-tight hidden sm:block">
              <div className="text-sm font-medium">{currentUser.name}</div>
              <div className="text-[10px] font-ui uppercase tracking-widest font-medium" style={{ color: roleColor(currentUser.role) }}>{ROLE_LABEL[currentUser.role]}</div>
            </div>
            <button onClick={onLogout} className="p-2 hover:bg-white/10 rounded-full" title="Log out"><LogOut size={18} /></button>
          </div>
        </div>
      </header>
      <main className="flex-1">
        <div className="max-w-6xl mx-auto px-3 sm:px-4 pt-4 sm:pt-6 pb-4">
          <div className="bg-[#FAF8F2] rounded-3xl shadow-2xl p-4 sm:p-6 pb-24 sm:pb-6 min-h-[72vh]">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tag / badge helpers
// ---------------------------------------------------------------------------
function Tag({ children, tone = "default" }) {
  const tones = {
    default: "bg-[#F0EBDD] text-[#5c5648]",
    urgent: "bg-[#C1694F] text-white",
    quick: "bg-[#C9A66B] text-white",
    ready: "bg-[#7C8F5E] text-white",
    pending: "bg-[#9C9686] text-white",
  };
  return <span className={`px-2 py-0.5 rounded-full text-[10px] font-ui font-medium uppercase tracking-widest whitespace-nowrap ${tones[tone]}`}>{children}</span>;
}

// ---------------------------------------------------------------------------
// Order Ticket (shared visual component — kitchen/ops functional views)
// ---------------------------------------------------------------------------
function OrderTicket({ order, footer }) {
  const stubColor = order.urgent ? "#C1694F" : order.quick ? "#C9A66B" : "#5B8FA3";
  const mins = Math.max(0, Math.round((Date.now() - new Date(order.createdAt).getTime()) / 60000));
  return (
    <div className="bg-white rounded-2xl shadow-md border-l-[6px] overflow-hidden" style={{ borderColor: stubColor }}>
      <div className="px-4 pt-3 pb-2 flex items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="font-display text-xl font-600 text-[#16261F] leading-tight">Table {order.table}</div>
          <div className="font-ticket text-[10px] text-[#9C9686] uppercase tracking-widest truncate">{order.serverName} · {mins}m ago</div>
        </div>
        <div className="flex gap-1 flex-wrap justify-end shrink-0">
          {order.urgent && <Tag tone="urgent">Rush</Tag>}
          {order.quick && <Tag tone="quick">Quick</Tag>}
          <Tag tone={order.status === "pending" ? "pending" : order.status === "sent" ? "ready" : "default"}>{STATUS_LABEL[order.status]}</Tag>
        </div>
      </div>
      <div className="perf" />
      <div className="px-4 py-3 space-y-2 font-ticket">
        {order.items.map((it) => (
          <div key={it.id} className="text-sm">
            <div className="flex justify-between text-[#16261F] gap-2">
              <span className="min-w-0">{it.qty}× {it.name}</span>
              <span className="shrink-0">{money(it.price * it.qty)}</span>
            </div>
            {it.remarks && <div className="text-[11px] text-[#C1694F] pl-4">note: {it.remarks}</div>}
          </div>
        ))}
      </div>
      {footer && <div className="px-4 pb-4">{footer}</div>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Adaptive navigation — pill tabs on desktop, app-style bottom nav on mobile
// ---------------------------------------------------------------------------
function NavTabs({ tabs, current, onChange }) {
  return (
    <>
      <div className="hidden sm:flex gap-1 mb-5 bg-[#F0EBDD] rounded-full p-1 w-fit no-print">
        {tabs.map(([key, label, Icon]) => (
          <button key={key} onClick={() => onChange(key)}
            className={`px-4 py-2 rounded-full text-sm font-ui font-medium flex items-center gap-2 transition ${current === key ? "bg-[#16261F] text-white shadow-md" : "text-[#5c5648] hover:text-[#16261F]"}`}>
            <Icon size={15} /> {label}
          </button>
        ))}
      </div>
      <div className="sm:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-[#F0EBDD] shadow-[0_-4px_24px_rgba(0,0,0,0.1)] flex justify-around py-1.5 no-print" style={{ paddingBottom: "max(0.4rem, env(safe-area-inset-bottom))" }}>
        {tabs.map(([key, label, Icon]) => (
          <button key={key} onClick={() => onChange(key)} className="flex flex-col items-center gap-0.5 px-3 py-1.5">
            <Icon size={20} className={current === key ? "text-[#C9A66B]" : "text-[#9C9686]"} />
            <span className={`text-[9px] font-ui uppercase tracking-wide ${current === key ? "text-[#16261F] font-semibold" : "text-[#9C9686]"}`}>{label}</span>
          </button>
        ))}
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Dish photo helper (used by server ordering + owner menu manager)
// ---------------------------------------------------------------------------
function DishImage({ src, alt, className }) {
  if (!src) {
    return (
      <div className={`bg-[#F0EBDD] flex items-center justify-center ${className}`}>
        <UtensilsCrossed size={22} className="text-[#C9C2AF]" />
      </div>
    );
  }
  return <img src={src} alt={alt} className={`object-cover ${className}`} />;
}

// ---------------------------------------------------------------------------
// Category chip filter — shopping-app style
// ---------------------------------------------------------------------------
function CategoryChips({ categories, selected, onSelect }) {
  return (
    <div className="flex gap-2 overflow-x-auto scrollbar-none pb-1 -mx-1 px-1 mb-4">
      {["All", ...categories].map((cat) => (
        <button key={cat} onClick={() => onSelect(cat)}
          className={`shrink-0 px-4 py-1.5 rounded-full text-xs font-ui font-medium uppercase tracking-wide border transition ${selected === cat ? "bg-[#16261F] text-white border-[#16261F]" : "bg-white text-[#5c5648] border-[#EAE4D3] hover:border-[#C9A66B]"}`}>
          {cat}
        </button>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Dish card — Amazon/food-app style product card with inline stepper
// ---------------------------------------------------------------------------
function DishCard({ item, qty, onAdd, onRemove }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm hover:shadow-lg transition overflow-hidden">
      <div className="relative">
        <DishImage src={item.image} alt={item.name} className="w-full aspect-square" />
        <div className="absolute bottom-2 right-2">
          {qty === 0 ? (
            <button onClick={() => onAdd(item)}
              className="bg-white shadow-md border border-[#C9A66B] text-[#8a6f42] font-ui font-semibold text-[11px] uppercase tracking-wide px-4 py-1.5 rounded-full hover:bg-[#C9A66B] hover:text-white transition">
              Add
            </button>
          ) : (
            <div className="flex items-center gap-2.5 bg-[#16261F] rounded-full px-2 py-1.5 shadow-md">
              <button onClick={() => onRemove(item)} className="w-5 h-5 flex items-center justify-center text-white"><Minus size={13} /></button>
              <span className="text-white text-xs font-ticket w-3 text-center">{qty}</span>
              <button onClick={() => onAdd(item)} className="w-5 h-5 flex items-center justify-center text-white"><Plus size={13} /></button>
            </div>
          )}
        </div>
      </div>
      <div className="p-3">
        <div className="text-sm font-medium text-[#16261F] leading-tight line-clamp-2">{item.name}</div>
        <div className="text-[9px] font-ui text-[#9C9686] uppercase tracking-wide mt-0.5">{item.category}</div>
        <div className="font-ui font-semibold text-[#16261F] mt-1">{money(item.price)}</div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// SERVER DASHBOARD
// ---------------------------------------------------------------------------
function ServerDashboard({ currentUser, menu, orders, setOrders }) {
  const [table, setTable] = useState("");
  const [urgent, setUrgent] = useState(false);
  const [quick, setQuick] = useState(false);
  const [cart, setCart] = useState([]);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");

  const categories = [...new Set(menu.map((m) => m.category))];
  const available = menu.filter((m) =>
    m.available !== false &&
    m.name.toLowerCase().includes(search.toLowerCase()) &&
    (category === "All" || m.category === category)
  );

  const cartQtyFor = (itemId) => cart.filter((l) => l.menuItemId === itemId).reduce((s, l) => s + l.qty, 0);

  const addToCart = (item) => {
    setCart((c) => {
      const exists = c.find((x) => x.menuItemId === item.id && !x.remarks);
      if (exists) return c.map((x) => x === exists ? { ...x, qty: x.qty + 1 } : x);
      return [...c, { id: uid(), menuItemId: item.id, name: item.name, price: item.price, qty: 1, remarks: "" }];
    });
  };
  const removeOneFromCart = (item) => {
    setCart((c) => {
      const line = c.find((x) => x.menuItemId === item.id && !x.remarks);
      if (!line) return c;
      if (line.qty <= 1) return c.filter((x) => x !== line);
      return c.map((x) => x === line ? { ...x, qty: x.qty - 1 } : x);
    });
  };
  const updateCartLine = (id, patch) => setCart((c) => c.map((l) => l.id === id ? { ...l, ...patch } : l));
  const removeCartLine = (id) => setCart((c) => c.filter((l) => l.id !== id));

  const cartCount = cart.reduce((s, l) => s + l.qty, 0);
  const cartTotal = cart.reduce((s, l) => s + l.price * l.qty, 0);

  const submitOrder = () => {
    if (!table.trim() || cart.length === 0) return;
    const newOrder = {
      id: uid(), table: table.trim(), items: cart, urgent, quick,
      status: "pending", serverName: currentUser.name, createdAt: new Date().toISOString(), billed: false,
    };
    setOrders([newOrder, ...orders]);
    setCart([]); setUrgent(false); setQuick(false); setTable("");
  };

  // Every logged-in device shares the same Firestore data, so this list is
  // already the same "all active orders, all tables, all servers" for everyone.
  const activeOrders = orders.filter(o => !o.billed).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  const disabledReason = !table.trim() && cart.length === 0
    ? "Enter a table number and add at least one dish"
    : !table.trim()
    ? "Enter a table number"
    : cart.length === 0
    ? "Add at least one dish"
    : "";

  return (
    <div>
      <div className="grid md:grid-cols-3 gap-6">
        <div className="md:col-span-2">
          <div className="font-display text-xl font-600 text-[#16261F] mb-3 flex items-center gap-2"><ShoppingBag size={18} /> New Order</div>
          <div className="flex flex-wrap gap-2 sm:gap-3 mb-4">
            <input value={table} onChange={(e) => setTable(e.target.value)} placeholder="Table number" inputMode="numeric"
              className="border border-[#EAE4D3] bg-white px-4 py-2.5 rounded-full text-sm font-ticket w-32 sm:w-40 shadow-sm" />
            <button onClick={() => setUrgent(!urgent)}
              className={`px-4 py-2.5 rounded-full text-xs font-ui font-medium uppercase tracking-widest flex items-center gap-1.5 shadow-sm transition ${urgent ? "bg-[#C1694F] text-white" : "bg-white text-[#5c5648]"}`}>
              <Flame size={14} /> Urgent
            </button>
            <button onClick={() => setQuick(!quick)}
              className={`px-4 py-2.5 rounded-full text-xs font-ui font-medium uppercase tracking-widest flex items-center gap-1.5 shadow-sm transition ${quick ? "bg-[#C9A66B] text-white" : "bg-white text-[#5c5648]"}`}>
              <Zap size={14} /> Quick
            </button>
          </div>
          <div className="relative mb-4">
            <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#9C9686]" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search the menu…"
              className="w-full border border-[#EAE4D3] bg-white pl-11 pr-4 py-3 rounded-full text-sm shadow-sm" />
          </div>
          <CategoryChips categories={categories} selected={category} onSelect={setCategory} />
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-8">
            {available.length === 0 && <p className="text-sm text-[#9C9686] font-ui col-span-full">No dishes found.</p>}
            {available.map((item) => (
              <DishCard key={item.id} item={item} qty={cartQtyFor(item.id)} onAdd={addToCart} onRemove={removeOneFromCart} />
            ))}
          </div>

          <div className="font-display text-xl font-600 text-[#16261F] mb-3 flex items-center gap-2 no-print"><Clock size={18} /> Live Orders — All Tables</div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {activeOrders.length === 0 && <p className="text-sm text-[#9C9686] font-ui col-span-full">No active orders right now.</p>}
            {activeOrders.map((o) => <OrderTicket key={o.id} order={o} />)}
          </div>
        </div>

        <div>
          <div id="cart-panel" className="bg-white rounded-2xl shadow-md p-4 sm:sticky sm:top-4 scroll-mt-4">
            <div className="font-display text-lg font-600 text-[#16261F] mb-3 flex items-center gap-2"><ShoppingBag size={16} /> Order for Table {table || "—"}</div>
            {cart.length === 0 && <p className="text-xs text-[#9C9686] font-ui">Tap "Add" on a dish to start the order.</p>}
            <div className="space-y-3 mb-3 max-h-[50vh] overflow-y-auto">
              {cart.map((l) => (
                <div key={l.id} className="border-b border-dashed border-[#F0EBDD] pb-2">
                  <div className="flex items-center justify-between text-sm gap-2">
                    <span className="text-[#16261F] truncate">{l.name}</span>
                    <button onClick={() => removeCartLine(l.id)} className="shrink-0"><Trash2 size={14} className="text-[#C1694F]" /></button>
                  </div>
                  <div className="flex items-center justify-between mt-1">
                    <div className="flex items-center gap-2">
                      <button onClick={() => updateCartLine(l.id, { qty: Math.max(1, l.qty - 1) })} className="w-6 h-6 flex items-center justify-center bg-[#F0EBDD] rounded-full"><Minus size={12} /></button>
                      <span className="font-ticket text-sm w-4 text-center">{l.qty}</span>
                      <button onClick={() => updateCartLine(l.id, { qty: l.qty + 1 })} className="w-6 h-6 flex items-center justify-center bg-[#F0EBDD] rounded-full"><Plus size={12} /></button>
                    </div>
                    <span className="font-ticket text-sm text-[#8a6f42]">{money(l.price * l.qty)}</span>
                  </div>
                  <input value={l.remarks} onChange={(e) => updateCartLine(l.id, { remarks: e.target.value })} placeholder="remarks e.g. no onions"
                    className="w-full mt-1.5 border border-[#F0EBDD] rounded-xl px-2.5 py-1.5 text-xs font-ticket" />
                </div>
              ))}
            </div>
            {cart.length > 0 && (
              <div className="flex justify-between font-display font-600 text-base mb-3 text-[#16261F]">
                <span>Total</span>
                <span>{money(cartTotal)}</span>
              </div>
            )}
            <button onClick={submitOrder} disabled={!table.trim() || cart.length === 0}
              className="w-full bg-[#16261F] disabled:opacity-30 text-white py-3 rounded-full text-sm font-ui font-semibold uppercase tracking-wide flex items-center justify-center gap-2 shadow-lg">
              Send to Kitchen <ArrowRight size={16} />
            </button>
            {disabledReason && <p className="text-[10px] text-[#9C9686] font-ui text-center mt-2">{disabledReason}</p>}
          </div>
        </div>
      </div>

      {cart.length > 0 && (
        <button onClick={() => document.getElementById("cart-panel")?.scrollIntoView({ behavior: "smooth", block: "start" })}
          className="sm:hidden fixed bottom-3 left-3 right-3 z-30 bg-[#16261F] text-white rounded-full shadow-2xl px-5 py-3.5 flex items-center justify-between no-print">
          <span className="font-ui text-sm font-medium">{cartCount} item{cartCount !== 1 ? "s" : ""} · {money(cartTotal)}</span>
          <span className="font-ui text-sm font-semibold flex items-center gap-1">View Order <ArrowRight size={14} /></span>
        </button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// CHEF DASHBOARD
// ---------------------------------------------------------------------------
function ChefDashboard({ orders, setOrders, menu, setMenu }) {
  const [tab, setTab] = useState("kitchen");
  const visible = orders.filter(o => !o.billed).sort((a, b) => {
    if (a.urgent !== b.urgent) return a.urgent ? -1 : 1;
    return new Date(a.createdAt) - new Date(b.createdAt);
  });

  const advance = (order) => {
    const idx = STATUS_FLOW.indexOf(order.status);
    const nextStatus = STATUS_FLOW[Math.min(idx + 1, STATUS_FLOW.length - 1)];
    setOrders(orders.map(o => o.id === order.id ? { ...o, status: nextStatus } : o));
  };

  const grouped = visible.reduce((acc, o) => {
    (acc[o.table] = acc[o.table] || []).push(o);
    return acc;
  }, {});

  return (
    <div>
      <NavTabs tabs={[["kitchen", "Kitchen", ChefHat], ["menu", "Menu", UtensilsCrossed]]} current={tab} onChange={setTab} />
      {tab === "kitchen" ? (
        <div>
          <div className="flex items-center gap-2 mb-4">
            <ChefHat className="text-[#C1694F]" size={20} />
            <h2 className="font-display text-2xl font-600 text-[#16261F]">Kitchen — Orders by Table</h2>
          </div>
          {Object.keys(grouped).length === 0 && <p className="text-sm text-[#9C9686] font-ui">No orders in progress.</p>}
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Object.entries(grouped).map(([table, tableOrders]) => (
              <div key={table} className="space-y-3">
                {tableOrders.map((o) => (
                  <OrderTicket key={o.id} order={o} footer={
                    o.status !== "sent" ? (
                      <button onClick={() => advance(o)}
                        className="w-full bg-[#7C8F5E] text-white py-3 rounded-full text-xs font-ui font-semibold uppercase tracking-widest flex items-center justify-center gap-2 shadow-sm">
                        <Check size={14} /> {STATUS_NEXT_LABEL[o.status]}
                      </button>
                    ) : (
                      <div className="w-full text-center text-[#7C8F5E] text-xs font-ui font-medium uppercase tracking-widest py-1">✓ Sent to table</div>
                    )
                  } />
                ))}
              </div>
            ))}
          </div>
        </div>
      ) : (
        <AvailabilityBoard menu={menu} setMenu={setMenu} />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Dish availability toggle — usable by owner, manager, and chef to mark a
// dish available or 86'd (out of stock) without needing full edit access.
// ---------------------------------------------------------------------------
function AvailabilityBoard({ menu, setMenu }) {
  const [category, setCategory] = useState("All");
  const categories = [...new Set(menu.map((m) => m.category))];
  const filtered = category === "All" ? menu : menu.filter((m) => m.category === category);
  const toggle = (id) => setMenu(menu.map((m) => m.id === id ? { ...m, available: !m.available } : m));

  return (
    <div>
      <div className="font-display text-2xl font-600 text-[#16261F] mb-4 flex items-center gap-2"><UtensilsCrossed size={20} /> Dish Availability</div>
      {menu.length === 0 ? (
        <p className="text-sm text-[#9C9686] font-ui">No dishes on the menu yet.</p>
      ) : (
        <>
          <CategoryChips categories={categories} selected={category} onSelect={setCategory} />
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {filtered.map((item) => (
              <button key={item.id} onClick={() => toggle(item.id)} className="text-left bg-white rounded-2xl shadow-sm overflow-hidden hover:shadow-lg transition">
                <div className="relative">
                  <DishImage src={item.image} alt={item.name} className={`w-full aspect-square ${item.available === false ? "opacity-40 grayscale" : ""}`} />
                  <div className="absolute top-1.5 right-1.5">
                    <Tag tone={item.available === false ? "urgent" : "ready"}>{item.available === false ? "86'd" : "Available"}</Tag>
                  </div>
                </div>
                <div className="p-2.5">
                  <div className="text-sm font-medium text-[#16261F] leading-tight truncate">{item.name}</div>
                  <div className="font-ui font-semibold text-sm text-[#8a6f42] mt-1">{money(item.price)}</div>
                </div>
              </button>
            ))}
          </div>
          <p className="text-[11px] text-[#9C9686] font-ui mt-3">Tap a dish to mark it available or 86'd — updates for servers and the customer menu instantly.</p>
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// ADMIN DASHBOARD (owner / manager)
// ---------------------------------------------------------------------------
function AdminDashboard({ currentUser, profiles, setProfiles, menu, setMenu, orders, setOrders, bills, setBills, parties, setParties }) {
  const tabsBase = [["dashboard", "Dashboard", LayoutDashboard], ["menu", "Menu", UtensilsCrossed], ["orders", "Orders", Clock], ["billing", "Billing", Receipt], ["history", "Bill History", History], ["parties", "Parties", PartyPopper]];
  const tabs = currentUser.role === "owner" ? [...tabsBase, ["staff", "Staff", Users]] : tabsBase;
  const [tab, setTab] = useState("dashboard");

  return (
    <div>
      <div className="relative rounded-2xl overflow-hidden mb-5 h-28 sm:h-36 no-print">
        <img src={BRAND.cafePond} alt="" className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#16261F]/88 via-[#16261F]/45 to-transparent flex items-center">
          <div className="px-5">
            <div className="font-display text-2xl sm:text-3xl font-600 text-white leading-tight">Welcome, {currentUser.name}</div>
            <div className="font-ui text-[10px] sm:text-xs text-[#EAE4D3] uppercase tracking-widest mt-1 font-medium">Serengeti · The Eden Park</div>
          </div>
        </div>
      </div>
      <NavTabs tabs={tabs} current={tab} onChange={setTab} />
      <div>
        {tab === "dashboard" && <AnalyticsDashboard orders={orders} menu={menu} />}
        {tab === "menu" && <MenuManager menu={menu} setMenu={setMenu} />}
        {tab === "orders" && <OrdersOverview orders={orders} />}
        {tab === "billing" && <Billing orders={orders} setOrders={setOrders} bills={bills} setBills={setBills} />}
        {tab === "history" && <BillHistory bills={bills} parties={parties} />}
        {tab === "parties" && <PartyBookings parties={parties} setParties={setParties} currentUser={currentUser} />}
        {tab === "staff" && currentUser.role === "owner" && <StaffManager profiles={profiles} setProfiles={setProfiles} currentUser={currentUser} />}
      </div>
    </div>
  );
}

function MenuManager({ menu, setMenu }) {
  const [form, setForm] = useState({ name: "", price: "", category: "", image: "" });
  const [uploading, setUploading] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [editUploading, setEditUploading] = useState(false);
  const [category, setCategory] = useState("All");
  const [formError, setFormError] = useState("");
  const [editError, setEditError] = useState("");

  const handleNewImage = async (file) => {
    if (!file) return;
    setForm((f) => ({ ...f, image: URL.createObjectURL(file) }));
    setUploading(true);
    setFormError("");
    try {
      const url = await uploadDishImage(file);
      setForm((f) => ({ ...f, image: url }));
    } catch (e) {
      console.error(e);
      setForm((f) => ({ ...f, image: "" }));
      setFormError("Photo upload failed — check the Cloudinary setup (cloud name / upload preset).");
    } finally {
      setUploading(false);
    }
  };

  const handleEditImage = async (file) => {
    if (!file) return;
    setEditForm((f) => ({ ...f, image: URL.createObjectURL(file) }));
    setEditUploading(true);
    setEditError("");
    try {
      const url = await uploadDishImage(file);
      setEditForm((f) => ({ ...f, image: url }));
    } catch (e) {
      console.error(e);
      setEditForm((f) => ({ ...f, image: "" }));
      setEditError("Photo upload failed — check the Cloudinary setup (cloud name / upload preset).");
    } finally {
      setEditUploading(false);
    }
  };

  const addItem = (e) => {
    e.preventDefault();
    if (!form.name.trim() || !form.price) { setFormError("Name and price are required."); return; }
    if (!form.image) { setFormError("Add a photo before saving this dish."); return; }
    setFormError("");
    setMenu([...menu, { id: uid(), name: form.name.trim(), price: parseFloat(form.price), category: form.category.trim() || "General", available: true, image: form.image }]);
    setForm({ name: "", price: "", category: "", image: "" });
  };
  const startEdit = (item) => { setEditingId(item.id); setEditForm(item); setEditError(""); };
  const saveEdit = () => {
    if (!editForm.image) { setEditError("This dish needs a photo before you can save."); return; }
    setEditError("");
    setMenu(menu.map((m) => m.id === editingId ? { ...editForm, price: parseFloat(editForm.price) } : m));
    setEditingId(null);
  };
  const removeItem = (id) => setMenu(menu.filter((m) => m.id !== id));
  const toggleAvailable = (id) => setMenu(menu.map((m) => m.id === id ? { ...m, available: !m.available } : m));

  const categories = [...new Set(menu.map((m) => m.category))];
  const filtered = category === "All" ? menu : menu.filter((m) => m.category === category);
  const byCategory = filtered.reduce((acc, m) => { (acc[m.category] = acc[m.category] || []).push(m); return acc; }, {});

  return (
    <div className="grid md:grid-cols-3 gap-6">
      <div className="md:col-span-2">
        {menu.length > 0 && <CategoryChips categories={categories} selected={category} onSelect={setCategory} />}
        <div className="space-y-6">
          {Object.keys(byCategory).length === 0 && <p className="text-sm text-[#9C9686] font-ui">No dishes yet — add your first one.</p>}
          {Object.entries(byCategory).map(([cat, items]) => (
            <div key={cat}>
              <h3 className="font-ui uppercase text-xs text-[#9C9686] mb-2 tracking-widest font-medium">{cat}</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {items.map((item) => (
                  editingId === item.id ? (
                    <div key={item.id} className="bg-white rounded-2xl shadow-sm p-3 col-span-2 sm:col-span-3 space-y-2">
                      <div className="flex gap-3 items-start flex-wrap">
                        <DishImage src={editForm.image} alt="" className="w-20 h-20 rounded-xl shrink-0" />
                        <label className="text-xs font-ui text-[#8a6f42] underline cursor-pointer flex items-center gap-1">
                          {editUploading ? <Loader2 size={12} className="animate-spin" /> : <ImagePlus size={12} />} change photo
                          <input type="file" accept="image/*" className="hidden" onChange={(e) => handleEditImage(e.target.files?.[0])} />
                        </label>
                        <div className="flex-1 flex gap-2 items-center flex-wrap min-w-[200px]">
                          <input value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} className="border border-[#EAE4D3] rounded-xl px-2 py-1.5 text-sm flex-1" placeholder="Name" />
                          <input value={editForm.price} onChange={(e) => setEditForm({ ...editForm, price: e.target.value })} className="border border-[#EAE4D3] rounded-xl px-2 py-1.5 text-sm w-24 font-ticket" placeholder="Price" />
                          <input value={editForm.category} onChange={(e) => setEditForm({ ...editForm, category: e.target.value })} className="border border-[#EAE4D3] rounded-xl px-2 py-1.5 text-sm w-28" placeholder="Category" />
                        </div>
                      </div>
                      {editError && <p className="text-[#C1694F] text-xs font-ui">{editError}</p>}
                      <div className="flex gap-2 justify-end">
                        <button onClick={saveEdit} disabled={editUploading} className="px-3 py-1.5 bg-[#7C8F5E] disabled:opacity-40 text-white rounded-full text-xs font-ui font-medium uppercase flex items-center gap-1"><Save size={13} /> Save</button>
                        <button onClick={() => setEditingId(null)} className="px-3 py-1.5 bg-[#9C9686] text-white rounded-full text-xs font-ui font-medium uppercase flex items-center gap-1"><X size={13} /> Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <div key={item.id} className="bg-white rounded-2xl shadow-sm overflow-hidden group">
                      <div className="relative">
                        <DishImage src={item.image} alt={item.name} className={`w-full aspect-square ${item.available === false ? "opacity-40 grayscale" : ""}`} />
                        {item.available === false && (
                          <div className="absolute top-1.5 left-1.5"><Tag tone="urgent">86'd</Tag></div>
                        )}
                        <div className="absolute top-1.5 right-1.5 flex gap-1 opacity-0 group-hover:opacity-100 transition">
                          <button onClick={() => toggleAvailable(item.id)} title="Toggle availability" className="p-1.5 bg-white/95 rounded-full text-[#5c5648] hover:text-[#16261F] shadow-sm"><CircleDot size={13} /></button>
                          <button onClick={() => startEdit(item)} className="p-1.5 bg-white/95 rounded-full text-[#5c5648] hover:text-[#16261F] shadow-sm"><Pencil size={13} /></button>
                          <button onClick={() => removeItem(item.id)} className="p-1.5 bg-white/95 rounded-full text-[#C1694F] shadow-sm"><Trash2 size={13} /></button>
                        </div>
                      </div>
                      <div className="p-2.5">
                        <div className="text-sm font-medium text-[#16261F] leading-tight truncate">{item.name}</div>
                        <div className="font-ui font-semibold text-sm text-[#8a6f42] mt-1">{money(item.price)}</div>
                      </div>
                    </div>
                  )
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
      <div>
        <div className="bg-white rounded-2xl shadow-md p-4 sm:sticky sm:top-4">
          <div className="font-display text-lg font-600 text-[#16261F] mb-3">Add a Dish</div>
          <form onSubmit={addItem} className="space-y-2">
            <label className="block cursor-pointer">
              <DishImage src={form.image} alt="" className={`w-full aspect-square rounded-2xl mb-1 ${!form.image ? "ring-1 ring-[#C1694F]/40" : ""}`} />
              <div className="text-xs font-ui text-[#8a6f42] underline flex items-center gap-1 justify-center py-1.5">
                {uploading ? <Loader2 size={13} className="animate-spin" /> : <ImagePlus size={13} />}
                {form.image ? "change photo" : "add a photo (required)"}
              </div>
              <input type="file" accept="image/*" className="hidden" onChange={(e) => handleNewImage(e.target.files?.[0])} />
            </label>
            <input placeholder="Dish name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full border border-[#EAE4D3] rounded-xl px-3 py-2.5 text-sm" />
            <input placeholder="Price" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} className="w-full border border-[#EAE4D3] rounded-xl px-3 py-2.5 text-sm font-ticket" />
            <input placeholder="Category (e.g. Starters)" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="w-full border border-[#EAE4D3] rounded-xl px-3 py-2.5 text-sm" />
            {formError && <p className="text-[#C1694F] text-xs font-ui">{formError}</p>}
            <button type="submit" disabled={uploading || !form.image} className="w-full bg-[#16261F] disabled:opacity-40 text-white py-3 rounded-full text-sm font-ui font-semibold uppercase flex items-center justify-center gap-2 shadow-lg"><Plus size={16} /> Add to Menu</button>
          </form>
          <p className="text-[11px] text-[#9C9686] font-ui mt-3">Every dish needs a photo — changes appear for servers immediately.</p>
        </div>
      </div>
    </div>
  );
}

function KpiCard({ label, value, icon: Icon, tint }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm p-4 flex items-center gap-3">
      <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: `${tint}22` }}>
        <Icon size={18} style={{ color: tint }} />
      </div>
      <div className="min-w-0">
        <div className="font-display text-2xl font-600 text-[#16261F] leading-none">{value}</div>
        <div className="text-[10px] font-ui uppercase tracking-widest text-[#9C9686] mt-1 font-medium">{label}</div>
      </div>
    </div>
  );
}

const CHART_COLORS = ["#C9A66B", "#7C8F5E", "#5B8FA3", "#C1694F", "#9C9686", "#8a6f42"];

function AnalyticsDashboard({ orders, menu }) {
  const activeOrders = orders.filter((o) => !o.billed);
  const activeTables = [...new Set(activeOrders.map((o) => o.table))];

  const statusCounts = STATUS_FLOW.reduce((acc, s) => {
    acc[s] = activeOrders.filter((o) => o.status === s).length;
    return acc;
  }, {});
  const statusData = STATUS_FLOW.map((s) => ({ name: STATUS_LABEL[s], value: statusCounts[s] })).filter((d) => d.value > 0);

  const dishTally = {};
  orders.forEach((o) => o.items.forEach((it) => {
    dishTally[it.name] = (dishTally[it.name] || 0) + it.qty;
  }));
  const topDishes = Object.entries(dishTally)
    .map(([name, qty]) => ({ name, qty }))
    .sort((a, b) => b.qty - a.qty)
    .slice(0, 8);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard label="Total Orders" value={orders.length} icon={ClipboardList} tint="#5B8FA3" />
        <KpiCard label="Active Orders" value={activeOrders.length} icon={Clock} tint="#C9A66B" />
        <KpiCard label="Active Tables" value={activeTables.length} icon={Utensils} tint="#7C8F5E" />
        <KpiCard label="Dishes on Menu" value={menu.length} icon={UtensilsCrossed} tint="#C1694F" />
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm p-4">
          <div className="font-display text-lg font-600 text-[#16261F] mb-3 flex items-center gap-2"><TrendingUp size={16} /> Best-Selling Dishes</div>
          {topDishes.length === 0 ? (
            <p className="text-sm text-[#9C9686] font-ui">No orders yet — this fills in once servers start sending orders.</p>
          ) : (
            <div style={{ width: "100%", height: 260 }}>
              <ResponsiveContainer>
                <BarChart data={topDishes} layout="vertical" margin={{ left: 10, right: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F0EBDD" horizontal={false} />
                  <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: "#9C9686" }} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 11, fill: "#16261F" }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #F0EBDD", fontSize: 12 }} />
                  <Bar dataKey="qty" name="Sold" fill="#C9A66B" radius={[0, 8, 8, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div className="bg-white rounded-2xl shadow-sm p-4">
          <div className="font-display text-lg font-600 text-[#16261F] mb-3">Active Orders by Status</div>
          {statusData.length === 0 ? (
            <p className="text-sm text-[#9C9686] font-ui">Nothing in progress right now.</p>
          ) : (
            <div style={{ width: "100%", height: 200 }}>
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={statusData} dataKey="value" nameKey="name" innerRadius={45} outerRadius={75} paddingAngle={3}>
                    {statusData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #F0EBDD", fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 justify-center">
            {statusData.map((d, i) => (
              <div key={d.name} className="flex items-center gap-1.5 text-xs font-ui text-[#5c5648]">
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }} />
                {d.name} ({d.value})
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm p-4">
        <div className="font-display text-lg font-600 text-[#16261F] mb-3">Tables Currently Active</div>
        {activeTables.length === 0 ? (
          <p className="text-sm text-[#9C9686] font-ui">No tables have open orders right now.</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {activeTables.map((t) => {
              const tOrders = activeOrders.filter((o) => o.table === t);
              const isUrgent = tOrders.some((o) => o.urgent);
              return (
                <div key={t} className={`rounded-xl p-3 border ${isUrgent ? "border-[#C1694F]/40 bg-[#C1694F]/5" : "border-[#F0EBDD] bg-[#FAF8F2]"}`}>
                  <div className="font-display text-xl font-600 text-[#16261F]">Table {t}</div>
                  <div className="text-[10px] font-ui uppercase tracking-widest text-[#9C9686] mt-1">{tOrders.length} order{tOrders.length !== 1 ? "s" : ""}</div>
                  {isUrgent && <div className="mt-1"><Tag tone="urgent">Rush</Tag></div>}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function OrdersOverview({ orders }) {
  const active = orders.filter(o => !o.billed).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {active.length === 0 && <p className="text-sm text-[#9C9686] font-ui">No active orders right now.</p>}
      {active.map((o) => <OrderTicket key={o.id} order={o} />)}
    </div>
  );
}

function StaffManager({ profiles, setProfiles, currentUser }) {
  const [form, setForm] = useState({ name: "", role: "server", pin: "" });
  const addProfile = (e) => {
    e.preventDefault();
    if (!form.name.trim() || !form.pin.trim()) return;
    setProfiles([...profiles, { id: uid(), name: form.name.trim(), role: form.role, pin: form.pin.trim() }]);
    setForm({ name: "", role: "server", pin: "" });
  };
  const removeProfile = (id) => { if (id === currentUser.id) return; setProfiles(profiles.filter((p) => p.id !== id)); };

  return (
    <div className="grid md:grid-cols-3 gap-6">
      <div className="md:col-span-2 bg-white rounded-2xl shadow-sm divide-y divide-[#F0EBDD]">
        {profiles.map((p) => (
          <div key={p.id} className="px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-ui font-semibold shrink-0" style={{ backgroundColor: roleColor(p.role) }}>
                {p.name.charAt(0).toUpperCase()}
              </div>
              <div>
                <div className="text-sm font-medium text-[#16261F]">{p.name}</div>
                <div className="text-[10px] font-ui uppercase tracking-widest font-medium" style={{ color: roleColor(p.role) }}>{ROLE_LABEL[p.role]}</div>
              </div>
            </div>
            {p.id !== currentUser.id && <button onClick={() => removeProfile(p.id)} className="text-[#C1694F] p-1.5 hover:bg-[#F0EBDD] rounded-full"><Trash2 size={16} /></button>}
          </div>
        ))}
      </div>
      <div className="bg-white rounded-2xl shadow-md p-4">
        <div className="font-display text-lg font-600 text-[#16261F] mb-3 flex items-center gap-2"><ShieldCheck size={16} /> New Profile</div>
        <form onSubmit={addProfile} className="space-y-2">
          <input placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full border border-[#EAE4D3] rounded-xl px-3 py-2.5 text-sm" />
          <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} className="w-full border border-[#EAE4D3] rounded-xl px-3 py-2.5 text-sm">
            {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
          </select>
          <input placeholder="PIN" value={form.pin} inputMode="numeric" pattern="[0-9]*" autoComplete="off"
            onChange={(e) => setForm({ ...form, pin: e.target.value.replace(/\D/g, "") })} className="w-full border border-[#EAE4D3] rounded-xl px-3 py-2.5 text-sm" />
          <button type="submit" className="w-full bg-[#16261F] text-white py-3 rounded-full text-sm font-ui font-semibold uppercase tracking-wide shadow-lg">Create Profile</button>
        </form>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// BILLING
// ---------------------------------------------------------------------------
function Billing({ orders, setOrders, bills, setBills }) {
  const billableTables = [...new Set(orders.filter(o => !o.billed && (o.status === "sent" || o.status === "ready")).map(o => o.table))];
  const [selectedTable, setSelectedTable] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [extras, setExtras] = useState([]);
  const [extraForm, setExtraForm] = useState({ name: "", price: "" });
  const [finalizedBill, setFinalizedBill] = useState(null);

  const tableOrders = orders.filter(o => o.table === selectedTable && !o.billed && (o.status === "sent" || o.status === "ready"));
  const dishSubtotal = tableOrders.reduce((s, o) => s + o.items.reduce((s2, it) => s2 + it.price * it.qty, 0), 0);
  const extrasTotal = extras.reduce((s, e) => s + (parseFloat(e.price) || 0), 0);
  const grandTotal = dishSubtotal + extrasTotal;

  const addExtra = (e) => {
    e.preventDefault();
    if (!extraForm.name.trim() || !extraForm.price) return;
    setExtras([...extras, { id: uid(), name: extraForm.name.trim(), price: parseFloat(extraForm.price) }]);
    setExtraForm({ name: "", price: "" });
  };
  const removeExtra = (id) => setExtras(extras.filter((e) => e.id !== id));

  const generateBill = () => {
    if (!selectedTable || tableOrders.length === 0) return;
    const allItems = tableOrders.flatMap(o => o.items.map(it => ({ name: it.name, price: it.price, qty: it.qty, remarks: it.remarks })));
    const bill = {
      id: uid(), table: selectedTable, customerName: customerName.trim() || "Guest", customerPhone: customerPhone.trim(),
      items: allItems, extras, total: grandTotal, createdAt: new Date().toISOString(),
    };
    setBills([bill, ...bills]);
    setOrders(orders.map((o) => tableOrders.find((t) => t.id === o.id) ? { ...o, billed: true } : o));
    setFinalizedBill(bill);
  };

  const resetAfterBill = () => {
    setFinalizedBill(null); setSelectedTable(""); setCustomerName(""); setCustomerPhone(""); setExtras([]);
  };

  if (finalizedBill) {
    return <BillReceipt bill={finalizedBill} onClose={resetAfterBill} />;
  }

  return (
    <div className="grid md:grid-cols-3 gap-6">
      <div className="md:col-span-2">
        <label className="text-xs font-ui uppercase text-[#9C9686] tracking-widest font-medium">Table ready to bill</label>
        <select value={selectedTable} onChange={(e) => setSelectedTable(e.target.value)} className="w-full border border-[#EAE4D3] bg-white rounded-full px-4 py-3 text-sm mt-1 mb-4 shadow-sm">
          <option value="">Select a table…</option>
          {billableTables.map((t) => <option key={t} value={t}>Table {t}</option>)}
        </select>
        {billableTables.length === 0 && <p className="text-sm text-[#9C9686] font-ui">No orders are marked "Sent" yet — nothing to bill.</p>}

        {selectedTable && (
          <div className="bg-white rounded-2xl shadow-md p-4">
            <div className="font-display text-lg font-600 text-[#16261F] mb-3">Table {selectedTable} — Items</div>
            <div className="font-ticket text-sm space-y-1 mb-3">
              {tableOrders.flatMap(o => o.items).map((it, i) => (
                <div key={i} className="flex justify-between border-b border-dashed border-[#F0EBDD] pb-1">
                  <span>{it.qty}× {it.name}{it.remarks ? ` (${it.remarks})` : ""}</span>
                  <span>{money(it.price * it.qty)}</span>
                </div>
              ))}
            </div>
            <div className="font-ui font-medium uppercase text-sm text-[#9C9686] mb-2">Additional Items</div>
            <div className="space-y-1 mb-2">
              {extras.map((e) => (
                <div key={e.id} className="flex justify-between items-center font-ticket text-sm">
                  <span>{e.name}</span>
                  <span className="flex items-center gap-2">{money(e.price)}<button onClick={() => removeExtra(e.id)}><X size={14} className="text-[#C1694F]" /></button></span>
                </div>
              ))}
            </div>
            <form onSubmit={addExtra} className="flex gap-2 mb-4">
              <input placeholder="Extra item (e.g. delivery, service)" value={extraForm.name} onChange={(e) => setExtraForm({ ...extraForm, name: e.target.value })} className="flex-1 border border-[#EAE4D3] rounded-full px-3 py-2 text-sm" />
              <input placeholder="Price" value={extraForm.price} onChange={(e) => setExtraForm({ ...extraForm, price: e.target.value })} className="w-24 border border-[#EAE4D3] rounded-full px-3 py-2 text-sm font-ticket" />
              <button type="submit" className="px-4 bg-[#F0EBDD] rounded-full"><Plus size={16} /></button>
            </form>
          </div>
        )}
      </div>
      {selectedTable && (
        <div>
          <div className="bg-white rounded-2xl shadow-md p-4 sm:sticky sm:top-4">
            <div className="font-display text-lg font-600 text-[#16261F] mb-3">Final Bill</div>
            <input placeholder="Customer name" value={customerName} onChange={(e) => setCustomerName(e.target.value)} className="w-full border border-[#EAE4D3] rounded-xl px-3 py-2.5 text-sm mb-2" />
            <input placeholder="Customer phone (optional, for WhatsApp)" value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} inputMode="tel" className="w-full border border-[#EAE4D3] rounded-xl px-3 py-2.5 text-sm mb-3" />
            <div className="font-ticket text-sm space-y-1 mb-3">
              <div className="flex justify-between"><span>Subtotal</span><span>{money(dishSubtotal)}</span></div>
              <div className="flex justify-between"><span>Additional items</span><span>{money(extrasTotal)}</span></div>
              <div className="flex justify-between font-display font-600 text-lg border-t border-[#F0EBDD] pt-2"><span>Total</span><span className="text-[#8a6f42]">{money(grandTotal)}</span></div>
            </div>
            <button onClick={generateBill} className="w-full bg-[#16261F] text-white py-3 rounded-full text-sm font-ui font-semibold uppercase flex items-center justify-center gap-2 shadow-lg">
              <Receipt size={16} /> Generate Bill
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function BillReceipt({ bill, onClose }) {
  const receiptRef = useRef(null);
  const [sending, setSending] = useState(false);
  const [sendMsg, setSendMsg] = useState("");

  const captureReceiptImage = async () => {
    const canvas = await html2canvas(receiptRef.current, { scale: 2, backgroundColor: "#ffffff", useCORS: true });
    return new Promise((resolve) => canvas.toBlob((blob) => resolve(blob), "image/png"));
  };

  const sendOnWhatsApp = async () => {
    setSending(true);
    setSendMsg("");
    try {
      const blob = await captureReceiptImage();
      if (!blob) throw new Error("Could not render the bill image.");
      const filename = `serengeti-bill-table-${bill.table}.png`;
      const messageText = `Hi ${bill.customerName}, here's your bill from Serengeti · The Eden Park — Table ${bill.table}. Total: ${money(bill.total)}. Thank you for dining with us!`;

      // Preferred path: native share sheet with the bill image attached —
      // works the same way on Android (Chrome) and iOS (Safari) and lets the
      // person pick WhatsApp directly, with the photo already attached.
      const file = new File([blob], filename, { type: "image/png" });
      if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({ files: [file], title: "Serengeti Bill", text: messageText });
          setSendMsg("Shared — pick WhatsApp from the share menu if it didn't open automatically.");
        } catch (shareErr) {
          if (shareErr.name !== "AbortError") throw shareErr;
        }
        setSending(false);
        return;
      }

      // Fallback (mainly desktop browsers, or older mobile browsers without
      // file-sharing support): download the image, then open WhatsApp with
      // the message pre-filled so the photo just needs attaching manually.
      const ua = navigator.userAgent || navigator.vendor || "";
      const isIOS = /iPad|iPhone|iPod/.test(ua);
      const isAndroid = /Android/.test(ua);

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 10000);

      const phoneDigits = bill.customerPhone ? bill.customerPhone.replace(/\D/g, "") : "";
      const waUrl = phoneDigits
        ? `https://wa.me/${phoneDigits}?text=${encodeURIComponent(messageText)}`
        : `https://wa.me/?text=${encodeURIComponent(messageText)}`;
      window.open(waUrl, "_blank");

      setSendMsg(
        isAndroid ? "Bill photo saved to Downloads — WhatsApp is opening, attach the photo from there."
        : isIOS ? "Bill photo saved to Photos — WhatsApp is opening, attach the photo from there."
        : "Bill photo downloaded and WhatsApp Web is opening — attach the photo to your message."
      );
    } catch (e) {
      console.error(e);
      setSendMsg("Couldn't prepare the bill image — try Print instead, or check your connection.");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="max-w-md mx-auto">
      <div ref={receiptRef} className="print-area bg-white rounded-2xl shadow-lg p-6 font-ticket">
        <div className="text-center mb-4">
          <img src={BRAND.logo} alt="Serengeti" className="h-10 mx-auto mb-2" />
          <div className="font-display text-xl font-600 tracking-wide text-[#16261F]">Serengeti · The Eden Park</div>
          <div className="text-[10px] text-[#9C9686] uppercase tracking-widest">Guest Receipt</div>
        </div>
        <div className="perf mb-3" />
        <div className="flex justify-between text-xs mb-1"><span>Customer</span><span>{bill.customerName}</span></div>
        <div className="flex justify-between text-xs mb-3"><span>Table</span><span>{bill.table}</span></div>
        <div className="perf mb-3" />
        <div className="space-y-1 text-sm mb-3">
          {bill.items.map((it, i) => (
            <div key={i} className="flex justify-between"><span>{it.qty}× {it.name}</span><span>{money(it.price * it.qty)}</span></div>
          ))}
          {bill.extras.map((e) => (
            <div key={e.id} className="flex justify-between"><span>{e.name}</span><span>{money(e.price)}</span></div>
          ))}
        </div>
        <div className="perf mb-3" />
        <div className="flex justify-between font-display font-600 text-lg text-[#16261F]"><span>Total</span><span className="text-[#8a6f42]">{money(bill.total)}</span></div>
        <div className="text-center text-[10px] text-[#9C9686] mt-4 uppercase tracking-widest">Thank you for dining with us</div>
      </div>
      <div className="flex gap-2 mt-4 no-print">
        <button onClick={sendOnWhatsApp} disabled={sending}
          className="flex-1 bg-[#25D366] disabled:opacity-50 text-white py-3 rounded-full text-sm font-ui font-semibold uppercase flex items-center justify-center gap-2 shadow-lg">
          {sending ? <Loader2 size={16} className="animate-spin" /> : <MessageCircle size={16} />} {sending ? "Preparing…" : "Send on WhatsApp"}
        </button>
        <button onClick={() => window.print()} className="flex-1 bg-[#16261F] text-white py-3 rounded-full text-sm font-ui font-semibold uppercase flex items-center justify-center gap-2 shadow-lg"><Printer size={16} /> Print</button>
      </div>
      {sendMsg && <p className="text-xs font-ui text-[#5c5648] mt-2 text-center no-print">{sendMsg}</p>}
      <button onClick={onClose} className="w-full mt-2 bg-[#F0EBDD] text-[#16261F] py-3 rounded-full text-sm font-ui font-semibold uppercase no-print">Close Table</button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// BILL HISTORY — table bills + birthday party bills, filterable by Today / This Month
// ---------------------------------------------------------------------------
function BillHistory({ bills, parties }) {
  const [range, setRange] = useState("today");
  const todayKey = todayDateStr();
  const monthPrefix = todayKey.slice(0, 7);

  const partyBills = parties.filter((p) => p.billed);

  const allBills = [
    ...bills.map((b) => ({ ...b, kind: "Table", label: `Table ${b.table}` })),
    ...partyBills.map((p) => ({ ...p, kind: "Birthday", label: `${p.customerName}'s party`, total: p.total, createdAt: p.billedAt || p.createdAt })),
  ].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  const filtered = allBills.filter((b) => {
    const key = b.createdAt.slice(0, 10);
    return range === "today" ? key === todayKey : key.slice(0, 7) === monthPrefix;
  });

  const total = filtered.reduce((s, b) => s + b.total, 0);
  const tableCount = filtered.filter((b) => b.kind === "Table").length;
  const partyCount = filtered.filter((b) => b.kind === "Birthday").length;

  return (
    <div>
      <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
        <div className="font-display text-2xl font-600 text-[#16261F] flex items-center gap-2"><History size={20} /> Bill History</div>
        <div className="flex gap-1 bg-[#F0EBDD] rounded-full p-1">
          <button onClick={() => setRange("today")} className={`px-4 py-1.5 rounded-full text-xs font-ui font-medium uppercase tracking-wide ${range === "today" ? "bg-[#16261F] text-white" : "text-[#5c5648]"}`}>Today</button>
          <button onClick={() => setRange("month")} className={`px-4 py-1.5 rounded-full text-xs font-ui font-medium uppercase tracking-wide ${range === "month" ? "bg-[#16261F] text-white" : "text-[#5c5648]"}`}>This Month</button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="bg-white rounded-2xl shadow-sm p-4">
          <div className="font-display text-2xl font-600 text-[#16261F]">{money(total)}</div>
          <div className="text-[10px] font-ui uppercase tracking-widest text-[#9C9686] mt-1 font-medium">Total Billed</div>
        </div>
        <div className="bg-white rounded-2xl shadow-sm p-4">
          <div className="font-display text-2xl font-600 text-[#16261F]">{tableCount}</div>
          <div className="text-[10px] font-ui uppercase tracking-widest text-[#9C9686] mt-1 font-medium">Table Bills</div>
        </div>
        <div className="bg-white rounded-2xl shadow-sm p-4">
          <div className="font-display text-2xl font-600 text-[#16261F]">{partyCount}</div>
          <div className="text-[10px] font-ui uppercase tracking-widest text-[#9C9686] mt-1 font-medium">Birthday Parties</div>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-md overflow-hidden">
        <div className="grid grid-cols-[60px_1fr_90px_90px] gap-2 px-4 py-2.5 bg-[#F0EBDD] text-[9px] font-ui uppercase tracking-widest text-[#5c5648] font-medium">
          <span>Time</span><span>Bill</span><span>Type</span><span className="text-right">Amount</span>
        </div>
        <div className="divide-y divide-[#F0EBDD] max-h-[55vh] overflow-y-auto">
          {filtered.length === 0 && <div className="px-4 py-6 text-sm text-[#9C9686] font-ui text-center">No bills {range === "today" ? "today" : "this month"} yet.</div>}
          {filtered.map((b) => (
            <div key={b.id} className="grid grid-cols-[60px_1fr_90px_90px] gap-2 px-4 py-2.5 items-center text-sm">
              <span className="font-ticket text-xs text-[#9C9686]">{new Date(b.createdAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}</span>
              <span className="text-[#16261F] truncate">{b.label} <span className="text-[#9C9686]">— {b.customerName}</span></span>
              <span><Tag tone={b.kind === "Birthday" ? "quick" : "default"}>{b.kind}</Tag></span>
              <span className="font-ticket text-sm text-right text-[#16261F]">{money(b.total)}</span>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-[60px_1fr_90px_90px] gap-2 px-4 py-3 bg-[#FAF8F2] border-t border-[#F0EBDD]">
          <span></span><span className="font-ui font-semibold text-sm text-[#16261F]">Total</span><span></span>
          <span className="font-display font-600 text-lg text-right text-[#8a6f42]">{money(total)}</span>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// BIRTHDAY PARTY BOOKINGS — calendar (week/month), booking form, bill
// ---------------------------------------------------------------------------
const PARTY_SLOTS = [
  { id: "11-2", label: "11:00 AM – 2:00 PM" },
  { id: "3-6", label: "3:00 PM – 6:00 PM" },
  { id: "5-8", label: "5:00 PM – 8:00 PM" },
];
const PACKAGES = { standard: "Standard", premium: "Premium" };

function todayDateStr() { return new Date().toISOString().slice(0, 10); }
function toDateStr(d) { return d.toISOString().slice(0, 10); }
function startOfWeek(d) { const x = new Date(d); const day = x.getDay(); x.setDate(x.getDate() - day); x.setHours(0, 0, 0, 0); return x; }
function startOfMonth(d) { return new Date(d.getFullYear(), d.getMonth(), 1); }
function addDays(d, n) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }

function PartyBookings({ parties, setParties, currentUser }) {
  const [view, setView] = useState("week");
  const [anchor, setAnchor] = useState(new Date());
  const [formOpen, setFormOpen] = useState(false);
  const [prefill, setPrefill] = useState(null);
  const [billFor, setBillFor] = useState(null);

  const openBookingForm = (dateStr, slotId) => { setPrefill({ date: dateStr, slot: slotId }); setFormOpen(true); };

  const addBooking = (booking) => {
    setParties([...parties, { id: uid(), ...booking, billed: false, createdBy: currentUser.name, createdAt: new Date().toISOString() }]);
    setFormOpen(false);
  };
  const removeBooking = (id) => setParties(parties.filter((p) => p.id !== id));
  const markBilled = (booking, total) => {
    setParties(parties.map((p) => p.id === booking.id ? { ...p, billed: true, total, billedAt: new Date().toISOString() } : p));
  };

  const bookingFor = (dateStr, slotId) => parties.find((p) => p.date === dateStr && p.slot === slotId);

  return (
    <div>
      <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
        <div className="font-display text-2xl font-600 text-[#16261F] flex items-center gap-2"><PartyPopper size={20} /> Birthday Parties</div>
        <button onClick={() => { setPrefill(null); setFormOpen(true); }}
          className="bg-[#16261F] text-white px-4 py-2 rounded-full text-xs font-ui font-semibold uppercase tracking-wide flex items-center gap-2 shadow-lg">
          <Plus size={14} /> New Booking
        </button>
      </div>

      <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
        <div className="flex items-center gap-1">
          <button onClick={() => setAnchor(view === "week" ? addDays(anchor, -7) : new Date(anchor.getFullYear(), anchor.getMonth() - 1, 1))} className="p-2 bg-white rounded-full shadow-sm"><ChevronLeft size={16} /></button>
          <button onClick={() => setAnchor(new Date())} className="px-3 py-2 bg-white rounded-full shadow-sm text-xs font-ui font-medium uppercase">Today</button>
          <button onClick={() => setAnchor(view === "week" ? addDays(anchor, 7) : new Date(anchor.getFullYear(), anchor.getMonth() + 1, 1))} className="p-2 bg-white rounded-full shadow-sm"><ChevronRight size={16} /></button>
        </div>
        <div className="flex gap-1 bg-[#F0EBDD] rounded-full p-1">
          <button onClick={() => setView("week")} className={`px-4 py-1.5 rounded-full text-xs font-ui font-medium uppercase tracking-wide ${view === "week" ? "bg-[#16261F] text-white" : "text-[#5c5648]"}`}>Week</button>
          <button onClick={() => setView("month")} className={`px-4 py-1.5 rounded-full text-xs font-ui font-medium uppercase tracking-wide ${view === "month" ? "bg-[#16261F] text-white" : "text-[#5c5648]"}`}>Month</button>
        </div>
      </div>

      {view === "week" ? (
        <WeekView anchor={anchor} bookingFor={bookingFor} onBookSlot={openBookingForm} onSelectBooking={setBillFor} onRemove={removeBooking} />
      ) : (
        <MonthView anchor={anchor} parties={parties} onSelectDay={(d) => { setAnchor(d); setView("week"); }} />
      )}

      {formOpen && (
        <PartyBookingForm prefill={prefill} onClose={() => setFormOpen(false)} onSave={addBooking} bookingFor={bookingFor} />
      )}
      {billFor && (
        <PartyBillModal booking={billFor} onClose={() => setBillFor(null)} onBilled={(total) => { markBilled(billFor, total); setBillFor(null); }} onDelete={() => { removeBooking(billFor.id); setBillFor(null); }} />
      )}
    </div>
  );
}

function WeekView({ anchor, bookingFor, onBookSlot, onSelectBooking, onRemove }) {
  const weekStart = startOfWeek(anchor);
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  return (
    <div className="bg-white rounded-2xl shadow-md overflow-x-auto">
      <div className="grid min-w-[720px]" style={{ gridTemplateColumns: "90px repeat(7, 1fr)" }}>
        <div className="p-2"></div>
        {days.map((d) => {
          const isToday = toDateStr(d) === todayDateStr();
          return (
            <div key={d.toISOString()} className={`p-2 text-center border-b border-[#F0EBDD] ${isToday ? "bg-[#F0EBDD]/60" : ""}`}>
              <div className="font-ui text-[10px] uppercase tracking-widest text-[#9C9686]">{d.toLocaleDateString("en-IN", { weekday: "short" })}</div>
              <div className="font-display text-lg font-600 text-[#16261F]">{d.getDate()}</div>
            </div>
          );
        })}
        {PARTY_SLOTS.map((slot) => (
          <React.Fragment key={slot.id}>
            <div className="p-2 flex items-center border-t border-[#F0EBDD]">
              <span className="font-ui text-[10px] text-[#9C9686] leading-tight">{slot.label}</span>
            </div>
            {days.map((d) => {
              const dateStr = toDateStr(d);
              const booking = bookingFor(dateStr, slot.id);
              return (
                <div key={dateStr + slot.id} className="p-1.5 border-t border-l border-[#F0EBDD] min-h-[64px]">
                  {booking ? (
                    <button onClick={() => onSelectBooking(booking)}
                      className={`w-full h-full rounded-xl px-2 py-1.5 text-left ${booking.package === "premium" ? "bg-[#C9A66B]/15 border border-[#C9A66B]/40" : "bg-[#7C8F5E]/15 border border-[#7C8F5E]/40"}`}>
                      <div className="text-[11px] font-ui font-semibold text-[#16261F] truncate">{booking.customerName}</div>
                      <div className="text-[9px] font-ui text-[#5c5648] flex items-center gap-1"><Baby size={9} /> {booking.kids}k · {booking.adults}a</div>
                      <div className="text-[8px] font-ui uppercase tracking-wide" style={{ color: booking.package === "premium" ? "#8a6f42" : "#557052" }}>{PACKAGES[booking.package]}</div>
                    </button>
                  ) : (
                    <button onClick={() => onBookSlot(dateStr, slot.id)} className="w-full h-full rounded-xl border border-dashed border-[#DCD5C0] text-[#C9A66B] text-[10px] font-ui uppercase tracking-wide flex items-center justify-center gap-1 hover:bg-[#F0EBDD]/50">
                      <Plus size={12} /> Book
                    </button>
                  )}
                </div>
              );
            })}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}

function MonthView({ anchor, parties, onSelectDay }) {
  const monthStart = startOfMonth(anchor);
  const gridStart = startOfWeek(monthStart);
  const days = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
  const bookingsByDate = {};
  parties.forEach((p) => { (bookingsByDate[p.date] = bookingsByDate[p.date] || []).push(p); });

  return (
    <div className="bg-white rounded-2xl shadow-md p-3">
      <div className="grid grid-cols-7 gap-1 mb-1">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
          <div key={d} className="text-center text-[9px] font-ui uppercase tracking-widest text-[#9C9686] py-1">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {days.map((d) => {
          const dateStr = toDateStr(d);
          const inMonth = d.getMonth() === monthStart.getMonth();
          const isToday = dateStr === todayDateStr();
          const dayBookings = bookingsByDate[dateStr] || [];
          return (
            <button key={dateStr} onClick={() => onSelectDay(d)}
              className={`rounded-xl p-1.5 text-left min-h-[64px] border ${isToday ? "border-[#C9A66B]" : "border-[#F0EBDD]"} ${inMonth ? "bg-white" : "bg-[#FAF8F2] opacity-50"}`}>
              <div className="font-ticket text-xs text-[#16261F]">{d.getDate()}</div>
              <div className="flex gap-0.5 mt-1 flex-wrap">
                {PARTY_SLOTS.map((slot) => {
                  const booked = dayBookings.some((b) => b.slot === slot.id);
                  return <span key={slot.id} className={`w-2 h-2 rounded-full ${booked ? "bg-[#C1694F]" : "bg-[#EAE4D3]"}`} />;
                })}
              </div>
            </button>
          );
        })}
      </div>
      <p className="text-[10px] text-[#9C9686] font-ui mt-3">Dots show the 3 party slots for that day — filled means booked. Tap a day to open its week view.</p>
    </div>
  );
}

function PartyBookingForm({ prefill, onClose, onSave, bookingFor }) {
  const [form, setForm] = useState({
    date: prefill?.date || todayDateStr(), slot: prefill?.slot || PARTY_SLOTS[0].id,
    customerName: "", customerPhone: "", kids: "", adults: "",
    package: "standard", packagePrice: "", addOns: [], addOnForm: { name: "", price: "" },
  });
  const [error, setError] = useState("");

  const addAddOn = () => {
    if (!form.addOnForm.name.trim() || !form.addOnForm.price) return;
    setForm({ ...form, addOns: [...form.addOns, { id: uid(), name: form.addOnForm.name.trim(), price: parseFloat(form.addOnForm.price) }], addOnForm: { name: "", price: "" } });
  };
  const removeAddOn = (id) => setForm({ ...form, addOns: form.addOns.filter((a) => a.id !== id) });

  const conflict = bookingFor(form.date, form.slot);

  const submit = (e) => {
    e.preventDefault();
    if (!form.customerName.trim() || !form.kids || !form.adults || !form.packagePrice) { setError("Customer name, kids/adults count, and package price are required."); return; }
    if (conflict) { setError("That date and slot is already booked — pick a different slot."); return; }
    setError("");
    const total = parseFloat(form.packagePrice) + form.addOns.reduce((s, a) => s + a.price, 0);
    onSave({
      date: form.date, slot: form.slot, customerName: form.customerName.trim(), customerPhone: form.customerPhone.trim(),
      kids: parseInt(form.kids), adults: parseInt(form.adults), package: form.package, packagePrice: parseFloat(form.packagePrice),
      addOns: form.addOns, total,
    });
  };

  return (
    <div className="fixed inset-0 z-40 bg-black/60 flex items-center justify-center px-4 py-8" onClick={onClose}>
      <div className="bg-white rounded-3xl p-6 w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-4">
          <p className="font-display text-xl font-600 text-[#16261F] flex items-center gap-2"><Cake size={18} /> New Birthday Booking</p>
          <button onClick={onClose} className="p-1 hover:bg-[#F0EBDD] rounded-full"><X size={18} /></button>
        </div>
        <form onSubmit={submit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-ui uppercase tracking-widest text-[#9C9686] font-medium">Date</label>
              <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className="w-full border border-[#EAE4D3] rounded-xl px-3 py-2.5 text-sm mt-1 font-ticket" />
            </div>
            <div>
              <label className="text-[10px] font-ui uppercase tracking-widest text-[#9C9686] font-medium">Slot</label>
              <select value={form.slot} onChange={(e) => setForm({ ...form, slot: e.target.value })} className="w-full border border-[#EAE4D3] rounded-xl px-3 py-2.5 text-sm mt-1">
                {PARTY_SLOTS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
              </select>
            </div>
          </div>
          {conflict && <p className="text-[#C1694F] text-xs font-ui">This slot is already booked for {conflict.customerName} — choose another.</p>}

          <input placeholder="Customer name" value={form.customerName} onChange={(e) => setForm({ ...form, customerName: e.target.value })} className="w-full border border-[#EAE4D3] rounded-xl px-3 py-2.5 text-sm" />
          <input placeholder="Customer phone (optional, for WhatsApp)" value={form.customerPhone} onChange={(e) => setForm({ ...form, customerPhone: e.target.value })} inputMode="tel" className="w-full border border-[#EAE4D3] rounded-xl px-3 py-2.5 text-sm" />

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-ui uppercase tracking-widest text-[#9C9686] font-medium">No. of Kids</label>
              <input value={form.kids} onChange={(e) => setForm({ ...form, kids: e.target.value })} inputMode="numeric" className="w-full border border-[#EAE4D3] rounded-xl px-3 py-2.5 text-sm mt-1 font-ticket" />
            </div>
            <div>
              <label className="text-[10px] font-ui uppercase tracking-widest text-[#9C9686] font-medium">No. of Adults</label>
              <input value={form.adults} onChange={(e) => setForm({ ...form, adults: e.target.value })} inputMode="numeric" className="w-full border border-[#EAE4D3] rounded-xl px-3 py-2.5 text-sm mt-1 font-ticket" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-ui uppercase tracking-widest text-[#9C9686] font-medium">Package</label>
              <select value={form.package} onChange={(e) => setForm({ ...form, package: e.target.value })} className="w-full border border-[#EAE4D3] rounded-xl px-3 py-2.5 text-sm mt-1">
                <option value="standard">Standard</option>
                <option value="premium">Premium</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] font-ui uppercase tracking-widest text-[#9C9686] font-medium">Package Price</label>
              <input value={form.packagePrice} onChange={(e) => setForm({ ...form, packagePrice: e.target.value })} inputMode="decimal" className="w-full border border-[#EAE4D3] rounded-xl px-3 py-2.5 text-sm mt-1 font-ticket" placeholder="₹" />
            </div>
          </div>

          <div>
            <label className="text-[10px] font-ui uppercase tracking-widest text-[#9C9686] font-medium block mb-1">Additional Items &amp; Decorations</label>
            {form.addOns.map((a) => (
              <div key={a.id} className="flex justify-between items-center font-ticket text-sm mb-1">
                <span>{a.name}</span>
                <span className="flex items-center gap-2">{money(a.price)}<button type="button" onClick={() => removeAddOn(a.id)}><X size={13} className="text-[#C1694F]" /></button></span>
              </div>
            ))}
            <div className="flex gap-2">
              <input placeholder="e.g. Balloon decor, Cake, DJ" value={form.addOnForm.name} onChange={(e) => setForm({ ...form, addOnForm: { ...form.addOnForm, name: e.target.value } })} className="flex-1 border border-[#EAE4D3] rounded-full px-3 py-2 text-sm" />
              <input placeholder="Price" value={form.addOnForm.price} onChange={(e) => setForm({ ...form, addOnForm: { ...form.addOnForm, price: e.target.value } })} className="w-24 border border-[#EAE4D3] rounded-full px-3 py-2 text-sm font-ticket" />
              <button type="button" onClick={addAddOn} className="px-4 bg-[#F0EBDD] rounded-full"><Plus size={16} /></button>
            </div>
          </div>

          {error && <p className="text-[#C1694F] text-xs font-ui">{error}</p>}
          <div className="flex justify-between font-display font-600 text-lg text-[#16261F] border-t border-[#F0EBDD] pt-3">
            <span>Total</span>
            <span className="text-[#8a6f42]">{money((parseFloat(form.packagePrice) || 0) + form.addOns.reduce((s, a) => s + a.price, 0))}</span>
          </div>
          <button type="submit" className="w-full bg-[#16261F] text-white py-3 rounded-full text-sm font-ui font-semibold uppercase tracking-wide shadow-lg flex items-center justify-center gap-2">
            <PartyPopper size={16} /> Confirm Booking
          </button>
        </form>
      </div>
    </div>
  );
}

function PartyBillModal({ booking, onClose, onBilled, onDelete }) {
  const receiptRef = useRef(null);
  const [sending, setSending] = useState(false);
  const [sendMsg, setSendMsg] = useState("");
  const slotLabel = PARTY_SLOTS.find((s) => s.id === booking.slot)?.label || booking.slot;

  const captureImage = async () => {
    const canvas = await html2canvas(receiptRef.current, { scale: 2, backgroundColor: "#ffffff", useCORS: true });
    return new Promise((resolve) => canvas.toBlob((blob) => resolve(blob), "image/png"));
  };

  const sendOnWhatsApp = async () => {
    setSending(true);
    setSendMsg("");
    try {
      const blob = await captureImage();
      if (!blob) throw new Error("render failed");
      const filename = `serengeti-party-${booking.date}.png`;
      const messageText = `Hi ${booking.customerName}, here's the bill for your birthday party at Serengeti on ${booking.date} (${slotLabel}). Total: ${money(booking.total)}. Thank you!`;
      const file = new File([blob], filename, { type: "image/png" });
      if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
        try { await navigator.share({ files: [file], title: "Serengeti Party Bill", text: messageText }); setSendMsg("Shared — pick WhatsApp from the share menu if it didn't open automatically."); }
        catch (err) { if (err.name !== "AbortError") throw err; }
        setSending(false);
        return;
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a"); a.href = url; a.download = filename; document.body.appendChild(a); a.click(); document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 10000);
      const phoneDigits = booking.customerPhone ? booking.customerPhone.replace(/\D/g, "") : "";
      const waUrl = phoneDigits ? `https://wa.me/${phoneDigits}?text=${encodeURIComponent(messageText)}` : `https://wa.me/?text=${encodeURIComponent(messageText)}`;
      window.open(waUrl, "_blank");
      setSendMsg("Bill photo downloaded — WhatsApp is opening, attach the photo to your message.");
    } catch (e) {
      console.error(e);
      setSendMsg("Couldn't prepare the bill image — try Print instead.");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-40 bg-black/60 flex items-center justify-center px-4 py-8" onClick={onClose}>
      <div className="max-w-md w-full" onClick={(e) => e.stopPropagation()}>
        <div ref={receiptRef} className="bg-white rounded-2xl shadow-lg p-6 font-ticket">
          <div className="text-center mb-4">
            <img src={BRAND.logo} alt="Serengeti" className="h-10 mx-auto mb-2" />
            <div className="font-display text-xl font-600 tracking-wide text-[#16261F]">Serengeti · The Eden Park</div>
            <div className="text-[10px] text-[#9C9686] uppercase tracking-widest">Birthday Party Bill</div>
          </div>
          <div className="perf mb-3" />
          <div className="flex justify-between text-xs mb-1"><span>Customer</span><span>{booking.customerName}</span></div>
          <div className="flex justify-between text-xs mb-1"><span>Date</span><span>{booking.date}</span></div>
          <div className="flex justify-between text-xs mb-1"><span>Slot</span><span>{slotLabel}</span></div>
          <div className="flex justify-between text-xs mb-3"><span>Guests</span><span>{booking.kids} kids · {booking.adults} adults</span></div>
          <div className="perf mb-3" />
          <div className="space-y-1 text-sm mb-3">
            <div className="flex justify-between"><span>{PACKAGES[booking.package]} Package</span><span>{money(booking.packagePrice)}</span></div>
            {booking.addOns.map((a) => <div key={a.id} className="flex justify-between"><span>{a.name}</span><span>{money(a.price)}</span></div>)}
          </div>
          <div className="perf mb-3" />
          <div className="flex justify-between font-display font-600 text-lg text-[#16261F]"><span>Total</span><span className="text-[#8a6f42]">{money(booking.total)}</span></div>
          <div className="text-center text-[10px] text-[#9C9686] mt-4 uppercase tracking-widest">Thank you for celebrating with us</div>
        </div>
        <div className="flex gap-2 mt-4">
          <button onClick={sendOnWhatsApp} disabled={sending} className="flex-1 bg-[#25D366] disabled:opacity-50 text-white py-3 rounded-full text-sm font-ui font-semibold uppercase flex items-center justify-center gap-2 shadow-lg">
            {sending ? <Loader2 size={16} className="animate-spin" /> : <MessageCircle size={16} />} {sending ? "Preparing…" : "Send on WhatsApp"}
          </button>
          <button onClick={() => window.print()} className="flex-1 bg-[#16261F] text-white py-3 rounded-full text-sm font-ui font-semibold uppercase flex items-center justify-center gap-2 shadow-lg"><Printer size={16} /> Print</button>
        </div>
        {sendMsg && <p className="text-xs font-ui text-white/90 mt-2 text-center">{sendMsg}</p>}
        <div className="flex gap-2 mt-2">
          {!booking.billed && <button onClick={() => onBilled(booking.total)} className="flex-1 bg-[#7C8F5E] text-white py-2.5 rounded-full text-xs font-ui font-semibold uppercase">Mark as Billed</button>}
          <button onClick={onDelete} className="flex-1 bg-[#F0EBDD] text-[#C1694F] py-2.5 rounded-full text-xs font-ui font-semibold uppercase">Cancel Booking</button>
          <button onClick={onClose} className="flex-1 bg-[#F0EBDD] text-[#16261F] py-2.5 rounded-full text-xs font-ui font-semibold uppercase">Close</button>
        </div>
      </div>
    </div>
  );
}
