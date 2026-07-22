import React, { useState, useEffect } from "react";
import {
  ChefHat, UtensilsCrossed, Receipt, Users, LogOut, Plus, Minus, Trash2,
  Check, Clock, Flame, Zap, Printer, X, Pencil, Save, ArrowRight,
  Search, ClipboardList, ShieldCheck, CircleDot, ImagePlus, Loader2, Leaf
} from "lucide-react";
import { initializeApp } from "firebase/app";
import { getFirestore, doc, setDoc, onSnapshot } from "firebase/firestore";
import { getStorage, ref as storageRef, uploadBytes, getDownloadURL } from "firebase/storage";

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
const storage = getStorage(firebaseApp);

// Brand imagery (Serengeti — The Eden Park, serengeti.in)
const BRAND = {
  logo: "https://www.serengeti.in/logo.png",
  hero: "https://www.serengeti.in/media/real/hero.jpg",
  cafePond: "https://www.serengeti.in/media/real/cafe-pond.jpg",
};

// All shared restaurant data lives in one Firestore collection, "restaurant",
// as four documents: profiles / menu / orders / bills — each holding { data: [...] }.
const KEYS = { profiles: "profiles", menu: "menu", orders: "orders", bills: "bills" };
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

// Uploads a dish photo to Firebase Storage and returns its public URL.
async function uploadDishImage(file) {
  const path = `dishes/${uid()}-${file.name.replace(/\s+/g, "-")}`;
  const r = storageRef(storage, path);
  await uploadBytes(r, file);
  return await getDownloadURL(r);
}

const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
const money = (n) => `₹${Number(n || 0).toFixed(2)}`;
const ROLES = ["owner", "manager", "server", "chef"];
const ROLE_LABEL = { owner: "Owner", manager: "Manager", server: "Server", chef: "Chef" };

const STATUS_FLOW = ["pending", "preparing", "ready", "sent"];
const STATUS_LABEL = { pending: "New", preparing: "Preparing", ready: "Complete", sent: "Sent" };
const STATUS_NEXT_LABEL = { pending: "Start Preparing", preparing: "Mark Complete", ready: "Mark Sent" };

// ---------------------------------------------------------------------------
// Root App
// ---------------------------------------------------------------------------
export default function App() {
  const [profiles, setProfiles] = useState([]);
  const [menu, setMenu] = useState([]);
  const [orders, setOrders] = useState([]);
  const [bills, setBills] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loaded, setLoaded] = useState({ profiles: false, menu: false, orders: false, bills: false });
  const [currentUser, setCurrentUser] = useState(null);
  const [syncedAt, setSyncedAt] = useState(null);

  useEffect(() => {
    const markLoaded = (k) => setLoaded((prev) => ({ ...prev, [k]: true }));
    const unsubs = [
      subscribe(KEYS.profiles, (v) => { setProfiles(v); markLoaded("profiles"); setSyncedAt(new Date()); }),
      subscribe(KEYS.menu, (v) => { setMenu(v); markLoaded("menu"); setSyncedAt(new Date()); }),
      subscribe(KEYS.orders, (v) => { setOrders(v); markLoaded("orders"); setSyncedAt(new Date()); }),
      subscribe(KEYS.bills, (v) => { setBills(v); markLoaded("bills"); setSyncedAt(new Date()); }),
    ];
    return () => unsubs.forEach((u) => u());
  }, []);

  useEffect(() => {
    if (Object.values(loaded).every(Boolean)) setLoading(false);
  }, [loaded]);

  useEffect(() => {
    const handler = (e) => setCurrentUser(e.detail);
    window.addEventListener("rt-login", handler);
    return () => window.removeEventListener("rt-login", handler);
  }, []);

  const persist = { profiles: (n) => { setProfiles(n); persistToFirestore(KEYS.profiles, n); },
    menu: (n) => { setMenu(n); persistToFirestore(KEYS.menu, n); },
    orders: (n) => { setOrders(n); persistToFirestore(KEYS.orders, n); },
    bills: (n) => { setBills(n); persistToFirestore(KEYS.bills, n); } };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#16261F] flex items-center justify-center">
        <FontStyles />
        <div className="flex flex-col items-center gap-3">
          <Leaf className="text-[#B08D57] animate-pulse" size={28} />
          <div className="text-[#F3EFE3] font-ticket text-xs tracking-[0.25em] uppercase">Setting the table…</div>
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return <LoginScreen profiles={profiles} setProfiles={persist.profiles} />;
  }

  return (
    <Shell currentUser={currentUser} onLogout={() => setCurrentUser(null)} syncedAt={syncedAt}>
      {(currentUser.role === "owner" || currentUser.role === "manager") && (
        <AdminDashboard
          currentUser={currentUser}
          profiles={profiles} setProfiles={persist.profiles}
          menu={menu} setMenu={persist.menu}
          orders={orders} setOrders={persist.orders}
          bills={bills} setBills={persist.bills}
        />
      )}
      {currentUser.role === "server" && (
        <ServerDashboard currentUser={currentUser} menu={menu} orders={orders} setOrders={persist.orders} />
      )}
      {currentUser.role === "chef" && (
        <ChefDashboard orders={orders} setOrders={persist.orders} />
      )}
    </Shell>
  );
}

// ---------------------------------------------------------------------------
// Fonts & shared visual language — "fine dining farm estate"
// ---------------------------------------------------------------------------
function FontStyles() {
  return (
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@500;600;700&family=Jost:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500;600&display=swap');
      .font-display { font-family: 'Cormorant Garamond', ui-serif, Georgia, serif; letter-spacing: 0.01em; }
      .font-ui { font-family: 'Jost', ui-sans-serif, sans-serif; }
      .font-ticket { font-family: 'IBM Plex Mono', ui-monospace, monospace; }
      body { font-family: 'Jost', ui-sans-serif, sans-serif; }
      .perf { background-image: radial-gradient(circle, #DCD5C0 1.2px, transparent 1.4px); background-size: 10px 100%; background-position: center; height: 2px; }
      .scrollbar-none::-webkit-scrollbar { display: none; }
      .scrollbar-none { -ms-overflow-style: none; scrollbar-width: none; }
      @media print {
        .no-print { display: none !important; }
        .print-area { position: absolute; top: 0; left: 0; width: 100%; }
      }
    `}</style>
  );
}

function roleColor(role) {
  return { owner: "#B08D57", manager: "#7C8F5E", server: "#3E6E7E", chef: "#A6503B" }[role] || "#9C9686";
}

// ---------------------------------------------------------------------------
// Login
// ---------------------------------------------------------------------------
function LoginScreen({ profiles, setProfiles }) {
  const [pendingLogin, setPendingLogin] = useState(null);
  const [pinInput, setPinInput] = useState("");
  const [err, setErr] = useState("");
  const [showSetup, setShowSetup] = useState(profiles.length === 0);
  const [form, setForm] = useState({ name: "", role: "server", pin: "" });

  const attemptLogin = (profile, pin) => {
    if (String(profile.pin) === String(pin)) {
      window.dispatchEvent(new CustomEvent("rt-login", { detail: profile }));
    } else {
      setErr("Incorrect PIN. Try again.");
    }
  };

  const createProfile = (e) => {
    e.preventDefault();
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
    <div className="min-h-screen relative flex flex-col items-center justify-center px-4 py-10 overflow-hidden">
      <FontStyles />
      <div className="absolute inset-0">
        <img src={BRAND.hero} alt="" className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-b from-[#0F1C15]/80 via-[#16261F]/75 to-[#0F1C15]/90" />
      </div>

      <div className="relative z-10 flex flex-col items-center mb-8 text-center">
        <img src={BRAND.logo} alt="Serengeti" className="h-14 sm:h-16 w-auto mb-3 drop-shadow-lg" />
        <h1 className="font-display text-3xl sm:text-4xl font-600 text-[#F7F4EC] tracking-tight">Serengeti</h1>
        <p className="font-ticket text-[10px] sm:text-xs text-[#B08D57] uppercase tracking-[0.3em] mt-1">The Eden Park · Staff</p>
      </div>

      {profiles.length === 0 ? (
        <div className="relative z-10 w-full max-w-sm bg-[#F7F4EC] rounded-lg p-6 shadow-2xl">
          <p className="font-ticket text-xs text-[#9C9686] uppercase mb-4 tracking-widest">Set up the owner account</p>
          <form onSubmit={createProfile} className="space-y-3">
            <input autoFocus placeholder="Owner's name" value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value, role: "owner" })}
              className="w-full border border-[#DCD5C0] bg-white px-3 py-2.5 text-sm rounded-md focus:outline-none focus:ring-2 focus:ring-[#B08D57]" />
            <input placeholder="Choose a 4+ digit PIN" value={form.pin} inputMode="numeric" pattern="[0-9]*" autoComplete="off"
              onChange={(e) => setForm({ ...form, pin: e.target.value.replace(/\D/g, "") })}
              className="w-full border border-[#DCD5C0] bg-white px-3 py-2.5 text-sm rounded-md focus:outline-none focus:ring-2 focus:ring-[#B08D57]" />
            <button type="submit"
              className="w-full bg-[#16261F] text-[#F7F4EC] py-2.5 rounded-md text-sm font-ui font-medium uppercase tracking-wide hover:bg-[#1F3A2E] transition">
              Create Owner Account
            </button>
          </form>
        </div>
      ) : (
        <div className="relative z-10 w-full max-w-md">
          <p className="font-ticket text-xs text-[#DCD5C0] uppercase mb-3 tracking-widest text-center">Who's joining service?</p>
          <div className="grid grid-cols-2 gap-3">
            {profiles.map((p) => (
              <button key={p.id} onClick={() => { setPendingLogin(p); setPinInput(""); setErr(""); }}
                className="bg-[#F7F4EC]/95 hover:bg-white rounded-lg px-4 py-4 text-left shadow-xl transition border-l-[5px] backdrop-blur-sm"
                style={{ borderColor: roleColor(p.role) }}>
                <div className="font-display text-lg font-600 text-[#16261F] leading-tight">{p.name}</div>
                <div className="font-ticket text-[10px] uppercase tracking-widest" style={{ color: roleColor(p.role) }}>{ROLE_LABEL[p.role]}</div>
              </button>
            ))}
          </div>
          <button onClick={() => setShowSetup(true)} className="mt-4 text-[#DCD5C0] text-xs font-ticket underline mx-auto block">
            + add a staff profile
          </button>
        </div>
      )}

      {showSetup && profiles.length > 0 && (
        <div className="fixed inset-0 z-20 bg-black/60 flex items-center justify-center px-4" onClick={() => setShowSetup(false)}>
          <div className="bg-[#F7F4EC] rounded-lg p-6 w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <p className="font-display text-lg font-600 text-[#16261F]">New Profile</p>
              <button onClick={() => setShowSetup(false)}><X size={18} /></button>
            </div>
            <form onSubmit={createProfile} className="space-y-3">
              <input autoFocus placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full border border-[#DCD5C0] bg-white px-3 py-2.5 text-sm rounded-md" />
              <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}
                className="w-full border border-[#DCD5C0] bg-white px-3 py-2.5 text-sm rounded-md">
                {ROLES.map(r => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
              </select>
              <input placeholder="PIN" value={form.pin} inputMode="numeric" pattern="[0-9]*" autoComplete="off"
                onChange={(e) => setForm({ ...form, pin: e.target.value.replace(/\D/g, "") })}
                className="w-full border border-[#DCD5C0] bg-white px-3 py-2.5 text-sm rounded-md" />
              <button type="submit" className="w-full bg-[#16261F] text-[#F7F4EC] py-2.5 rounded-md text-sm font-ui uppercase tracking-wide">Create Profile</button>
            </form>
          </div>
        </div>
      )}

      {pendingLogin && (
        <div className="fixed inset-0 z-20 bg-black/60 flex items-center justify-center px-4" onClick={() => setPendingLogin(null)}>
          <div className="bg-[#F7F4EC] rounded-lg p-6 w-full max-w-xs" onClick={(e) => e.stopPropagation()}>
            <p className="font-display text-xl font-600 text-[#16261F] mb-1">{pendingLogin.name}</p>
            <p className="font-ticket text-[10px] uppercase tracking-widest mb-4" style={{ color: roleColor(pendingLogin.role) }}>{ROLE_LABEL[pendingLogin.role]}</p>
            <form onSubmit={(e) => { e.preventDefault(); attemptLogin(pendingLogin, pinInput); }}>
              <input autoFocus type="password" placeholder="PIN" value={pinInput} inputMode="numeric" pattern="[0-9]*" autoComplete="off"
                onChange={(e) => setPinInput(e.target.value.replace(/\D/g, ""))}
                className="w-full border border-[#DCD5C0] bg-white px-3 py-2.5 text-sm rounded-md mb-2" />
              {err && <p className="text-[#A6503B] text-xs mb-2">{err}</p>}
              <button type="submit" className="w-full bg-[#16261F] text-[#F7F4EC] py-2.5 rounded-md text-sm font-ui uppercase tracking-wide">Log In</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// App Shell (top bar + nav)
// ---------------------------------------------------------------------------
function Shell({ currentUser, onLogout, syncedAt, children }) {
  return (
    <div className="min-h-screen bg-[#F7F4EC]">
      <FontStyles />
      <header className="bg-[#16261F] text-[#F7F4EC] no-print sticky top-0 z-30 shadow-md">
        <div className="max-w-6xl mx-auto px-3 sm:px-4 py-2.5 sm:py-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <img src={BRAND.logo} alt="Serengeti" className="h-7 sm:h-8 w-auto shrink-0" />
            <div className="min-w-0">
              <div className="font-display text-base sm:text-lg font-600 leading-none truncate">Serengeti</div>
              <div className="font-ticket text-[8px] sm:text-[9px] text-[#B08D57] uppercase tracking-[0.2em] hidden xs:block">The Eden Park</div>
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-4 shrink-0">
            <div className="hidden md:flex items-center gap-1 text-[10px] font-ticket text-[#9C9686] uppercase tracking-widest">
              <CircleDot size={9} className="text-[#7C8F5E]" /> synced {syncedAt ? syncedAt.toLocaleTimeString() : "…"}
            </div>
            <div className="text-right leading-tight hidden sm:block">
              <div className="text-sm font-medium">{currentUser.name}</div>
              <div className="text-[10px] font-ticket uppercase tracking-widest" style={{ color: roleColor(currentUser.role) }}>{ROLE_LABEL[currentUser.role]}</div>
            </div>
            <button onClick={onLogout} className="p-2 hover:bg-white/10 rounded-md" title="Log out"><LogOut size={18} /></button>
          </div>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-3 sm:px-4 py-5 sm:py-6">{children}</main>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tag / badge helpers
// ---------------------------------------------------------------------------
function Tag({ children, tone = "default" }) {
  const tones = {
    default: "bg-[#EDE7D6] text-[#5c5648]",
    urgent: "bg-[#A6503B] text-white",
    quick: "bg-[#B08D57] text-white",
    ready: "bg-[#7C8F5E] text-white",
    pending: "bg-[#9C9686] text-white",
  };
  return <span className={`px-2 py-0.5 rounded-sm text-[10px] font-ticket uppercase tracking-widest whitespace-nowrap ${tones[tone]}`}>{children}</span>;
}

// ---------------------------------------------------------------------------
// Order Ticket (shared visual component)
// ---------------------------------------------------------------------------
function OrderTicket({ order, footer }) {
  const stubColor = order.urgent ? "#A6503B" : order.quick ? "#B08D57" : "#3E6E7E";
  const mins = Math.max(0, Math.round((Date.now() - new Date(order.createdAt).getTime()) / 60000));
  return (
    <div className="bg-white rounded-md shadow-md border-l-[6px] overflow-hidden" style={{ borderColor: stubColor }}>
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
            {it.remarks && <div className="text-[11px] text-[#A6503B] pl-4">note: {it.remarks}</div>}
          </div>
        ))}
      </div>
      {footer && <div className="px-4 pb-4">{footer}</div>}
    </div>
  );
}

function TabBar({ tabs, current, onChange }) {
  return (
    <div className="flex gap-1 border-b border-[#E4DECB] no-print overflow-x-auto scrollbar-none -mx-3 px-3 sm:mx-0 sm:px-0">
      {tabs.map(([key, label, Icon]) => (
        <button key={key} onClick={() => onChange(key)}
          className={`px-3 sm:px-4 py-2 text-sm font-ui font-medium uppercase tracking-wide flex items-center gap-2 border-b-2 -mb-px transition whitespace-nowrap shrink-0 ${current === key ? "border-[#B08D57] text-[#16261F]" : "border-transparent text-[#9C9686] hover:text-[#16261F]"}`}>
          <Icon size={15} /> {label}
        </button>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Dish photo card (used by server ordering + owner menu manager)
// ---------------------------------------------------------------------------
function DishImage({ src, alt, className }) {
  if (!src) {
    return (
      <div className={`bg-[#EDE7D6] flex items-center justify-center ${className}`}>
        <UtensilsCrossed size={22} className="text-[#C9C2AF]" />
      </div>
    );
  }
  return <img src={src} alt={alt} className={`object-cover ${className}`} />;
}

// ---------------------------------------------------------------------------
// SERVER DASHBOARD
// ---------------------------------------------------------------------------
function ServerDashboard({ currentUser, menu, orders, setOrders }) {
  const [tab, setTab] = useState("new");
  const [table, setTable] = useState("");
  const [urgent, setUrgent] = useState(false);
  const [quick, setQuick] = useState(false);
  const [cart, setCart] = useState([]);
  const [search, setSearch] = useState("");

  const available = menu.filter(m => m.available !== false && (m.name.toLowerCase().includes(search.toLowerCase())));

  const addToCart = (item) => {
    setCart((c) => {
      const exists = c.find((x) => x.menuItemId === item.id && !x.remarks);
      if (exists) return c.map((x) => x === exists ? { ...x, qty: x.qty + 1 } : x);
      return [...c, { id: uid(), menuItemId: item.id, name: item.name, price: item.price, qty: 1, remarks: "" }];
    });
  };
  const updateCartLine = (id, patch) => setCart((c) => c.map((l) => l.id === id ? { ...l, ...patch } : l));
  const removeCartLine = (id) => setCart((c) => c.filter((l) => l.id !== id));

  const submitOrder = () => {
    if (!table.trim() || cart.length === 0) return;
    const newOrder = {
      id: uid(), table: table.trim(), items: cart, urgent, quick,
      status: "pending", serverName: currentUser.name, createdAt: new Date().toISOString(), billed: false,
    };
    setOrders([newOrder, ...orders]);
    setCart([]); setUrgent(false); setQuick(false); setTable("");
  };

  const myActiveOrders = orders.filter(o => !o.billed).sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt));

  return (
    <div>
      <TabBar tabs={[["new", "New Order", ClipboardList], ["active", "Active Orders", Clock]]} current={tab} onChange={setTab} />
      {tab === "new" ? (
        <div className="grid md:grid-cols-3 gap-6 mt-4">
          <div className="md:col-span-2">
            <div className="flex flex-wrap gap-2 sm:gap-3 mb-4">
              <input value={table} onChange={(e) => setTable(e.target.value)} placeholder="Table number"
                className="border border-[#DCD5C0] bg-white px-3 py-2 rounded-md text-sm font-ticket w-32 sm:w-40" />
              <button onClick={() => setUrgent(!urgent)}
                className={`px-3 py-2 rounded-md text-xs font-ui font-medium uppercase tracking-widest flex items-center gap-1 border ${urgent ? "bg-[#A6503B] text-white border-[#A6503B]" : "border-[#DCD5C0] text-[#5c5648] bg-white"}`}>
                <Flame size={14} /> Urgent
              </button>
              <button onClick={() => setQuick(!quick)}
                className={`px-3 py-2 rounded-md text-xs font-ui font-medium uppercase tracking-widest flex items-center gap-1 border ${quick ? "bg-[#B08D57] text-white border-[#B08D57]" : "border-[#DCD5C0] text-[#5c5648] bg-white"}`}>
                <Zap size={14} /> Quick
              </button>
            </div>
            <div className="relative mb-3">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9C9686]" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search menu…"
                className="w-full border border-[#DCD5C0] bg-white pl-9 pr-3 py-2.5 rounded-md text-sm" />
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {available.length === 0 && <p className="text-sm text-[#9C9686] font-ticket col-span-full">No dishes found.</p>}
              {available.map((item) => (
                <button key={item.id} onClick={() => addToCart(item)}
                  className="text-left bg-white hover:shadow-lg border border-[#EDE7D6] rounded-lg overflow-hidden transition group">
                  <DishImage src={item.image} alt={item.name} className="w-full aspect-[4/3] group-hover:scale-105 transition" />
                  <div className="p-2.5">
                    <div className="text-sm font-medium text-[#16261F] leading-tight truncate">{item.name}</div>
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-[9px] font-ticket text-[#9C9686] uppercase truncate">{item.category}</span>
                      <span className="font-ticket text-sm text-[#B08D57] shrink-0">{money(item.price)}</span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="bg-white rounded-lg shadow-md p-4 sticky top-20">
              <div className="font-display text-lg font-600 text-[#16261F] mb-3 flex items-center gap-2"><ClipboardList size={16} /> Order for Table {table || "—"}</div>
              {cart.length === 0 && <p className="text-xs text-[#9C9686] font-ticket">Tap dishes to add them here.</p>}
              <div className="space-y-3 mb-3 max-h-[50vh] overflow-y-auto">
                {cart.map((l) => (
                  <div key={l.id} className="border-b border-dashed border-[#EDE7D6] pb-2">
                    <div className="flex items-center justify-between text-sm gap-2">
                      <span className="text-[#16261F] truncate">{l.name}</span>
                      <button onClick={() => removeCartLine(l.id)} className="shrink-0"><Trash2 size={14} className="text-[#A6503B]" /></button>
                    </div>
                    <div className="flex items-center justify-between mt-1">
                      <div className="flex items-center gap-2">
                        <button onClick={() => updateCartLine(l.id, { qty: Math.max(1, l.qty - 1) })} className="w-6 h-6 flex items-center justify-center bg-[#EDE7D6] rounded-sm"><Minus size={12} /></button>
                        <span className="font-ticket text-sm w-4 text-center">{l.qty}</span>
                        <button onClick={() => updateCartLine(l.id, { qty: l.qty + 1 })} className="w-6 h-6 flex items-center justify-center bg-[#EDE7D6] rounded-sm"><Plus size={12} /></button>
                      </div>
                      <span className="font-ticket text-sm text-[#B08D57]">{money(l.price * l.qty)}</span>
                    </div>
                    <input value={l.remarks} onChange={(e) => updateCartLine(l.id, { remarks: e.target.value })} placeholder="remarks e.g. no onions"
                      className="w-full mt-1 border border-[#EDE7D6] rounded-sm px-2 py-1 text-xs font-ticket" />
                  </div>
                ))}
              </div>
              {cart.length > 0 && (
                <div className="flex justify-between font-display font-600 text-base mb-3 text-[#16261F]">
                  <span>Total</span>
                  <span>{money(cart.reduce((s, l) => s + l.price * l.qty, 0))}</span>
                </div>
              )}
              <button onClick={submitOrder} disabled={!table.trim() || cart.length === 0}
                className="w-full bg-[#16261F] disabled:opacity-30 text-[#F7F4EC] py-2.5 rounded-md text-sm font-ui font-medium uppercase tracking-wide flex items-center justify-center gap-2">
                Send to Kitchen <ArrowRight size={16} />
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
          {myActiveOrders.length === 0 && <p className="text-sm text-[#9C9686] font-ticket">No active orders.</p>}
          {myActiveOrders.map((o) => <OrderTicket key={o.id} order={o} />)}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// CHEF DASHBOARD
// ---------------------------------------------------------------------------
function ChefDashboard({ orders, setOrders }) {
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
      <div className="flex items-center gap-2 mb-4">
        <ChefHat className="text-[#A6503B]" size={20} />
        <h2 className="font-display text-xl font-600 text-[#16261F]">Kitchen — Orders by Table</h2>
      </div>
      {Object.keys(grouped).length === 0 && <p className="text-sm text-[#9C9686] font-ticket">No orders in progress.</p>}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {Object.entries(grouped).map(([table, tableOrders]) => (
          <div key={table} className="space-y-3">
            {tableOrders.map((o) => (
              <OrderTicket key={o.id} order={o} footer={
                o.status !== "sent" ? (
                  <button onClick={() => advance(o)}
                    className="w-full bg-[#7C8F5E] text-white py-2.5 rounded-md text-xs font-ui font-medium uppercase tracking-widest flex items-center justify-center gap-2">
                    <Check size={14} /> {STATUS_NEXT_LABEL[o.status]}
                  </button>
                ) : (
                  <div className="w-full text-center text-[#7C8F5E] text-xs font-ticket uppercase tracking-widest py-1">✓ Sent to table</div>
                )
              } />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ADMIN DASHBOARD (owner / manager)
// ---------------------------------------------------------------------------
function AdminDashboard({ currentUser, profiles, setProfiles, menu, setMenu, orders, setOrders, bills, setBills }) {
  const tabsBase = [["menu", "Menu", UtensilsCrossed], ["orders", "Orders", Clock], ["billing", "Billing", Receipt]];
  const tabs = currentUser.role === "owner" ? [...tabsBase, ["staff", "Staff", Users]] : tabsBase;
  const [tab, setTab] = useState("menu");

  return (
    <div>
      <div className="relative rounded-lg overflow-hidden mb-5 h-28 sm:h-36 no-print">
        <img src={BRAND.cafePond} alt="" className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#16261F]/85 via-[#16261F]/40 to-transparent flex items-center">
          <div className="px-5">
            <div className="font-display text-2xl sm:text-3xl font-600 text-white leading-tight">Welcome, {currentUser.name}</div>
            <div className="font-ticket text-[10px] sm:text-xs text-[#DCD5C0] uppercase tracking-widest mt-1">Serengeti · The Eden Park</div>
          </div>
        </div>
      </div>
      <TabBar tabs={tabs} current={tab} onChange={setTab} />
      <div className="mt-4">
        {tab === "menu" && <MenuManager menu={menu} setMenu={setMenu} />}
        {tab === "orders" && <OrdersOverview orders={orders} />}
        {tab === "billing" && <Billing orders={orders} setOrders={setOrders} bills={bills} setBills={setBills} />}
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

  const handleNewImage = async (file) => {
    if (!file) return;
    setForm((f) => ({ ...f, image: URL.createObjectURL(file) }));
    setUploading(true);
    try {
      const url = await uploadDishImage(file);
      setForm((f) => ({ ...f, image: url }));
    } catch (e) {
      console.error(e);
    } finally {
      setUploading(false);
    }
  };

  const handleEditImage = async (file) => {
    if (!file) return;
    setEditForm((f) => ({ ...f, image: URL.createObjectURL(file) }));
    setEditUploading(true);
    try {
      const url = await uploadDishImage(file);
      setEditForm((f) => ({ ...f, image: url }));
    } catch (e) {
      console.error(e);
    } finally {
      setEditUploading(false);
    }
  };

  const [formError, setFormError] = useState("");
  const [editError, setEditError] = useState("");

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

  const byCategory = menu.reduce((acc, m) => { (acc[m.category] = acc[m.category] || []).push(m); return acc; }, {});

  return (
    <div className="grid md:grid-cols-3 gap-6">
      <div className="md:col-span-2 space-y-6">
        {Object.keys(byCategory).length === 0 && <p className="text-sm text-[#9C9686] font-ticket">No dishes yet — add your first one.</p>}
        {Object.entries(byCategory).map(([cat, items]) => (
          <div key={cat}>
            <h3 className="font-ticket uppercase text-xs text-[#9C9686] mb-2 tracking-widest">{cat}</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {items.map((item) => (
                editingId === item.id ? (
                  <div key={item.id} className="bg-white rounded-lg shadow-sm p-3 col-span-2 sm:col-span-3 space-y-2">
                    <div className="flex gap-3 items-start flex-wrap">
                      <DishImage src={editForm.image} alt="" className="w-20 h-20 rounded-md shrink-0" />
                      <label className="text-xs font-ticket text-[#B08D57] underline cursor-pointer flex items-center gap-1">
                        {editUploading ? <Loader2 size={12} className="animate-spin" /> : <ImagePlus size={12} />} change photo
                        <input type="file" accept="image/*" className="hidden" onChange={(e) => handleEditImage(e.target.files?.[0])} />
                      </label>
                      <div className="flex-1 flex gap-2 items-center flex-wrap min-w-[200px]">
                        <input value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} className="border border-[#DCD5C0] rounded-md px-2 py-1.5 text-sm flex-1" placeholder="Name" />
                        <input value={editForm.price} onChange={(e) => setEditForm({ ...editForm, price: e.target.value })} className="border border-[#DCD5C0] rounded-md px-2 py-1.5 text-sm w-24 font-ticket" placeholder="Price" />
                        <input value={editForm.category} onChange={(e) => setEditForm({ ...editForm, category: e.target.value })} className="border border-[#DCD5C0] rounded-md px-2 py-1.5 text-sm w-28" placeholder="Category" />
                      </div>
                    </div>
                    {editError && <p className="text-[#A6503B] text-xs font-ticket">{editError}</p>}
                    <div className="flex gap-2 justify-end">
                      <button onClick={saveEdit} disabled={editUploading} className="px-3 py-1.5 bg-[#7C8F5E] disabled:opacity-40 text-white rounded-md text-xs font-ui uppercase flex items-center gap-1"><Save size={13} /> Save</button>
                      <button onClick={() => setEditingId(null)} className="px-3 py-1.5 bg-[#9C9686] text-white rounded-md text-xs font-ui uppercase flex items-center gap-1"><X size={13} /> Cancel</button>
                    </div>
                  </div>
                ) : (
                  <div key={item.id} className="bg-white rounded-lg shadow-sm overflow-hidden group">
                    <div className="relative">
                      <DishImage src={item.image} alt={item.name} className={`w-full aspect-[4/3] ${item.available === false ? "opacity-40 grayscale" : ""}`} />
                      {item.available === false && (
                        <div className="absolute top-1.5 left-1.5"><Tag tone="urgent">86'd</Tag></div>
                      )}
                      <div className="absolute top-1.5 right-1.5 flex gap-1 opacity-0 group-hover:opacity-100 transition">
                        <button onClick={() => toggleAvailable(item.id)} title="Toggle availability" className="p-1.5 bg-white/90 rounded-md text-[#5c5648] hover:text-[#16261F]"><CircleDot size={13} /></button>
                        <button onClick={() => startEdit(item)} className="p-1.5 bg-white/90 rounded-md text-[#5c5648] hover:text-[#16261F]"><Pencil size={13} /></button>
                        <button onClick={() => removeItem(item.id)} className="p-1.5 bg-white/90 rounded-md text-[#A6503B]"><Trash2 size={13} /></button>
                      </div>
                    </div>
                    <div className="p-2.5">
                      <div className="text-sm font-medium text-[#16261F] leading-tight truncate">{item.name}</div>
                      <div className="font-ticket text-sm text-[#B08D57] mt-1">{money(item.price)}</div>
                    </div>
                  </div>
                )
              ))}
            </div>
          </div>
        ))}
      </div>
      <div>
        <div className="bg-white rounded-lg shadow-md p-4 sticky top-20">
          <div className="font-display text-lg font-600 text-[#16261F] mb-3">Add a Dish</div>
          <form onSubmit={addItem} className="space-y-2">
            <label className="block cursor-pointer">
              <DishImage src={form.image} alt="" className={`w-full aspect-[4/3] rounded-md mb-1 ${!form.image ? "ring-1 ring-[#A6503B]/40" : ""}`} />
              <div className="text-xs font-ticket text-[#B08D57] underline flex items-center gap-1 justify-center py-1">
                {uploading ? <Loader2 size={13} className="animate-spin" /> : <ImagePlus size={13} />}
                {form.image ? "change photo" : "add a photo (required)"}
              </div>
              <input type="file" accept="image/*" className="hidden" onChange={(e) => handleNewImage(e.target.files?.[0])} />
            </label>
            <input placeholder="Dish name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full border border-[#DCD5C0] rounded-md px-3 py-2 text-sm" />
            <input placeholder="Price" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} className="w-full border border-[#DCD5C0] rounded-md px-3 py-2 text-sm font-ticket" />
            <input placeholder="Category (e.g. Starters)" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="w-full border border-[#DCD5C0] rounded-md px-3 py-2 text-sm" />
            {formError && <p className="text-[#A6503B] text-xs font-ticket">{formError}</p>}
            <button type="submit" disabled={uploading || !form.image} className="w-full bg-[#16261F] disabled:opacity-40 text-[#F7F4EC] py-2.5 rounded-md text-sm font-ui font-medium uppercase flex items-center justify-center gap-2"><Plus size={16} /> Add to Menu</button>
          </form>
          <p className="text-[11px] text-[#9C9686] font-ticket mt-3">Every dish needs a photo — changes appear for servers immediately.</p>
        </div>
      </div>
    </div>
  );
}

function OrdersOverview({ orders }) {
  const active = orders.filter(o => !o.billed).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {active.length === 0 && <p className="text-sm text-[#9C9686] font-ticket">No active orders right now.</p>}
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
      <div className="md:col-span-2 bg-white rounded-lg shadow-sm divide-y divide-[#EDE7D6]">
        {profiles.map((p) => (
          <div key={p.id} className="px-4 py-3 flex items-center justify-between">
            <div>
              <div className="text-sm font-medium text-[#16261F]">{p.name}</div>
              <div className="text-[10px] font-ticket uppercase tracking-widest" style={{ color: roleColor(p.role) }}>{ROLE_LABEL[p.role]}</div>
            </div>
            {p.id !== currentUser.id && <button onClick={() => removeProfile(p.id)} className="text-[#A6503B]"><Trash2 size={16} /></button>}
          </div>
        ))}
      </div>
      <div className="bg-white rounded-lg shadow-md p-4">
        <div className="font-display text-lg font-600 text-[#16261F] mb-3 flex items-center gap-2"><ShieldCheck size={16} /> New Profile</div>
        <form onSubmit={addProfile} className="space-y-2">
          <input placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full border border-[#DCD5C0] rounded-md px-3 py-2 text-sm" />
          <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} className="w-full border border-[#DCD5C0] rounded-md px-3 py-2 text-sm">
            {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
          </select>
          <input placeholder="PIN" value={form.pin} inputMode="numeric" pattern="[0-9]*" autoComplete="off"
            onChange={(e) => setForm({ ...form, pin: e.target.value.replace(/\D/g, "") })} className="w-full border border-[#DCD5C0] rounded-md px-3 py-2 text-sm" />
          <button type="submit" className="w-full bg-[#16261F] text-[#F7F4EC] py-2.5 rounded-md text-sm font-ui uppercase tracking-wide">Create Profile</button>
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
      id: uid(), table: selectedTable, customerName: customerName.trim() || "Guest",
      items: allItems, extras, total: grandTotal, createdAt: new Date().toISOString(),
    };
    setBills([bill, ...bills]);
    setOrders(orders.map((o) => tableOrders.find((t) => t.id === o.id) ? { ...o, billed: true } : o));
    setFinalizedBill(bill);
  };

  const resetAfterBill = () => {
    setFinalizedBill(null); setSelectedTable(""); setCustomerName(""); setExtras([]);
  };

  if (finalizedBill) {
    return <BillReceipt bill={finalizedBill} onClose={resetAfterBill} />;
  }

  return (
    <div className="grid md:grid-cols-3 gap-6">
      <div className="md:col-span-2">
        <label className="text-xs font-ticket uppercase text-[#9C9686] tracking-widest">Table ready to bill</label>
        <select value={selectedTable} onChange={(e) => setSelectedTable(e.target.value)} className="w-full border border-[#DCD5C0] bg-white rounded-md px-3 py-2.5 text-sm mt-1 mb-4">
          <option value="">Select a table…</option>
          {billableTables.map((t) => <option key={t} value={t}>Table {t}</option>)}
        </select>
        {billableTables.length === 0 && <p className="text-sm text-[#9C9686] font-ticket">No orders are marked "Sent" yet — nothing to bill.</p>}

        {selectedTable && (
          <div className="bg-white rounded-lg shadow-md p-4">
            <div className="font-display text-lg font-600 text-[#16261F] mb-3">Table {selectedTable} — Items</div>
            <div className="font-ticket text-sm space-y-1 mb-3">
              {tableOrders.flatMap(o => o.items).map((it, i) => (
                <div key={i} className="flex justify-between border-b border-dashed border-[#EDE7D6] pb-1">
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
                  <span className="flex items-center gap-2">{money(e.price)}<button onClick={() => removeExtra(e.id)}><X size={14} className="text-[#A6503B]" /></button></span>
                </div>
              ))}
            </div>
            <form onSubmit={addExtra} className="flex gap-2 mb-4">
              <input placeholder="Extra item (e.g. delivery, service)" value={extraForm.name} onChange={(e) => setExtraForm({ ...extraForm, name: e.target.value })} className="flex-1 border border-[#DCD5C0] rounded-md px-2 py-1.5 text-sm" />
              <input placeholder="Price" value={extraForm.price} onChange={(e) => setExtraForm({ ...extraForm, price: e.target.value })} className="w-24 border border-[#DCD5C0] rounded-md px-2 py-1.5 text-sm font-ticket" />
              <button type="submit" className="px-3 bg-[#EDE7D6] rounded-md"><Plus size={16} /></button>
            </form>
          </div>
        )}
      </div>
      {selectedTable && (
        <div>
          <div className="bg-white rounded-lg shadow-md p-4 sticky top-20">
            <div className="font-display text-lg font-600 text-[#16261F] mb-3">Final Bill</div>
            <input placeholder="Customer name" value={customerName} onChange={(e) => setCustomerName(e.target.value)} className="w-full border border-[#DCD5C0] rounded-md px-3 py-2 text-sm mb-3" />
            <div className="font-ticket text-sm space-y-1 mb-3">
              <div className="flex justify-between"><span>Subtotal</span><span>{money(dishSubtotal)}</span></div>
              <div className="flex justify-between"><span>Additional items</span><span>{money(extrasTotal)}</span></div>
              <div className="flex justify-between font-display font-600 text-lg border-t border-[#EDE7D6] pt-2"><span>Total</span><span className="text-[#B08D57]">{money(grandTotal)}</span></div>
            </div>
            <button onClick={generateBill} className="w-full bg-[#16261F] text-[#F7F4EC] py-2.5 rounded-md text-sm font-ui font-medium uppercase flex items-center justify-center gap-2">
              <Receipt size={16} /> Generate Bill
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function BillReceipt({ bill, onClose }) {
  return (
    <div className="max-w-md mx-auto">
      <div className="print-area bg-white rounded-lg shadow-lg p-6 font-ticket">
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
        <div className="flex justify-between font-display font-600 text-lg text-[#16261F]"><span>Total</span><span className="text-[#B08D57]">{money(bill.total)}</span></div>
        <div className="text-center text-[10px] text-[#9C9686] mt-4 uppercase tracking-widest">Thank you for dining with us</div>
      </div>
      <div className="flex gap-2 mt-4 no-print">
        <button onClick={() => window.print()} className="flex-1 bg-[#16261F] text-[#F7F4EC] py-2.5 rounded-md text-sm font-ui font-medium uppercase flex items-center justify-center gap-2"><Printer size={16} /> Print</button>
        <button onClick={onClose} className="flex-1 bg-[#EDE7D6] text-[#16261F] py-2.5 rounded-md text-sm font-ui font-medium uppercase">Close Table</button>
      </div>
    </div>
  );
}
