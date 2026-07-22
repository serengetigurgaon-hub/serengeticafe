import React, { useState, useEffect, useCallback } from "react";
import {
  ChefHat, UtensilsCrossed, Receipt, Users, LogOut, Plus, Minus, Trash2,
  Check, Clock, Flame, Zap, Printer, X, Pencil, Save, ArrowRight,
  Search, ClipboardList, ShieldCheck, CircleDot
} from "lucide-react";
import { initializeApp } from "firebase/app";
import { getFirestore, doc, setDoc, onSnapshot } from "firebase/firestore";

// ---------------------------------------------------------------------------
// Firebase setup
// Paste the config object from Firebase Console → Project settings → your
// web app → SDK setup and configuration. See the README / setup steps
// for how to create this project (Firestore must be enabled).
// ---------------------------------------------------------------------------
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyAHvVQeolYC0ymNVA9f2FVq-CPZYaOCX9E",
  authDomain: "serengeticafe-75756.firebaseapp.com",
  projectId: "serengeticafe-75756",
  storageBucket: "serengeticafe-75756.firebasestorage.app",
  messagingSenderId: "472969509801",
  appId: "1:472969509801:web:b2b66a2eb58b744b6422b8",
  measurementId: "G-F539H66P1C"
};

const firebaseApp = initializeApp(firebaseConfig);
const db = getFirestore(firebaseApp);

// All shared restaurant data lives in one Firestore collection, "restaurant",
// as four documents: profiles / menu / orders / bills — each holding { data: [...] }.
const KEYS = { profiles: "profiles", menu: "menu", orders: "orders", bills: "bills" };
const COLLECTION = "restaurant";

function docRef(key) {
  return doc(db, COLLECTION, key);
}

// Subscribes to live updates for one document; calls onChange(array) whenever it changes.
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

  // Live-subscribe to every collection on mount — updates push instantly to
  // every open device (server tablet, chef screen, owner's laptop) with no polling.
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

  // LoginScreen dispatches this once a PIN is verified (or an owner account is first created)
  useEffect(() => {
    const handler = (e) => setCurrentUser(e.detail);
    window.addEventListener("rt-login", handler);
    return () => window.removeEventListener("rt-login", handler);
  }, []);

  // mutation helpers — update local state immediately (snappy UI), then write
  // to Firestore; the onSnapshot listener above will reconcile every client.
  const persist = { profiles: (n) => { setProfiles(n); persistToFirestore(KEYS.profiles, n); },
    menu: (n) => { setMenu(n); persistToFirestore(KEYS.menu, n); },
    orders: (n) => { setOrders(n); persistToFirestore(KEYS.orders, n); },
    bills: (n) => { setBills(n); persistToFirestore(KEYS.bills, n); } };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#23201B] flex items-center justify-center">
        <FontStyles />
        <div className="text-[#F6F1E6] font-mono text-sm tracking-widest animate-pulse">LOADING KITCHEN…</div>
      </div>
    );
  }

  if (!currentUser) {
    return (
      <LoginScreen
        profiles={profiles}
        setProfiles={persist.profiles}
      />
    );
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
// Fonts & shared visual language

// ---------------------------------------------------------------------------
function FontStyles() {
  return (
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Oswald:wght@500;600;700&family=IBM+Plex+Mono:wght@400;500;600&display=swap');
      .font-display { font-family: 'Oswald', ui-sans-serif, sans-serif; letter-spacing: 0.02em; }
      .font-ticket { font-family: 'IBM Plex Mono', ui-monospace, monospace; }
      .perf { background-image: radial-gradient(circle, #C9C2AF 1.2px, transparent 1.4px); background-size: 10px 100%; background-position: center; height: 2px; }
      @media print {
        .no-print { display: none !important; }
        .print-area { position: absolute; top: 0; left: 0; width: 100%; }
      }
    `}</style>
  );
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

  // We need a way to actually log in at the App level. Use a global-ish trick:
  // Simplest robust approach — lift login via window custom event.
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
      // first profile created is the owner — log straight in
      window.dispatchEvent(new CustomEvent("rt-login", { detail: p }));
    }
    setForm({ name: "", role: "server", pin: "" });
    setShowSetup(false);
  };

  return (
    <div className="min-h-screen bg-[#23201B] flex flex-col items-center justify-center px-4 py-10">
      <FontStyles />
      <div className="flex items-center gap-2 mb-8">
        <ChefHat className="text-[#C1642F]" size={30} />
        <h1 className="font-display text-3xl font-700 text-[#F6F1E6] uppercase tracking-tight">The Pass</h1>
      </div>

      {profiles.length === 0 || showSetup && profiles.length === 0 ? (
        <div className="w-full max-w-sm bg-[#F6F1E6] rounded-sm p-6 shadow-2xl">
          <p className="font-ticket text-xs text-[#8A8578] uppercase mb-4 tracking-widest">Set up the owner account</p>
          <form onSubmit={createProfile} className="space-y-3">
            <input autoFocus placeholder="Owner's name" value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value, role: "owner" })}
              className="w-full border border-[#C9C2AF] bg-white px-3 py-2 text-sm rounded-sm focus:outline-none focus:ring-2 focus:ring-[#C1642F]" />
            <input placeholder="Choose a 4+ digit PIN" value={form.pin}
              onChange={(e) => setForm({ ...form, pin: e.target.value })}
              className="w-full border border-[#C9C2AF] bg-white px-3 py-2 text-sm rounded-sm focus:outline-none focus:ring-2 focus:ring-[#C1642F]" />
            <button type="submit" onClick={() => setForm(f => ({ ...f, role: "owner" }))}
              className="w-full bg-[#23201B] text-[#F6F1E6] py-2 rounded-sm text-sm font-display uppercase tracking-wide hover:bg-[#3a352c] transition">
              Create Owner Account
            </button>
          </form>
        </div>
      ) : (
        <div className="w-full max-w-md">
          <p className="font-ticket text-xs text-[#8A8578] uppercase mb-3 tracking-widest text-center">Who's clocking in?</p>
          <div className="grid grid-cols-2 gap-3">
            {profiles.map((p) => (
              <button key={p.id} onClick={() => { setPendingLogin(p); setPinInput(""); setErr(""); }}
                className="bg-[#F6F1E6] hover:bg-white rounded-sm px-4 py-4 text-left shadow-lg transition border-l-4"
                style={{ borderColor: roleColor(p.role) }}>
                <div className="font-display text-lg text-[#23201B] uppercase leading-tight">{p.name}</div>
                <div className="font-ticket text-[11px] uppercase tracking-widest" style={{ color: roleColor(p.role) }}>{ROLE_LABEL[p.role]}</div>
              </button>
            ))}
          </div>
          <button onClick={() => setShowSetup(true)} className="mt-4 text-[#8A8578] text-xs font-ticket underline mx-auto block">
            + add a staff profile
          </button>
        </div>
      )}

      {showSetup && profiles.length > 0 && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center px-4" onClick={() => setShowSetup(false)}>
          <div className="bg-[#F6F1E6] rounded-sm p-6 w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <p className="font-display uppercase text-[#23201B]">New Profile</p>
              <button onClick={() => setShowSetup(false)}><X size={18} /></button>
            </div>
            <form onSubmit={createProfile} className="space-y-3">
              <input autoFocus placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full border border-[#C9C2AF] bg-white px-3 py-2 text-sm rounded-sm" />
              <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}
                className="w-full border border-[#C9C2AF] bg-white px-3 py-2 text-sm rounded-sm">
                {ROLES.map(r => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
              </select>
              <input placeholder="PIN" value={form.pin} onChange={(e) => setForm({ ...form, pin: e.target.value })}
                className="w-full border border-[#C9C2AF] bg-white px-3 py-2 text-sm rounded-sm" />
              <button type="submit" className="w-full bg-[#23201B] text-[#F6F1E6] py-2 rounded-sm text-sm font-display uppercase">Create Profile</button>
            </form>
          </div>
        </div>
      )}

      {pendingLogin && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center px-4" onClick={() => setPendingLogin(null)}>
          <div className="bg-[#F6F1E6] rounded-sm p-6 w-full max-w-xs" onClick={(e) => e.stopPropagation()}>
            <p className="font-display uppercase text-[#23201B] mb-1">{pendingLogin.name}</p>
            <p className="font-ticket text-[11px] uppercase tracking-widest mb-4" style={{ color: roleColor(pendingLogin.role) }}>{ROLE_LABEL[pendingLogin.role]}</p>
            <form onSubmit={(e) => { e.preventDefault(); attemptLogin(pendingLogin, pinInput); }}>
              <input autoFocus type="password" placeholder="PIN" value={pinInput} onChange={(e) => setPinInput(e.target.value)}
                className="w-full border border-[#C9C2AF] bg-white px-3 py-2 text-sm rounded-sm mb-2" />
              {err && <p className="text-[#B23A2E] text-xs mb-2">{err}</p>}
              <button type="submit" className="w-full bg-[#23201B] text-[#F6F1E6] py-2 rounded-sm text-sm font-display uppercase">Log In</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function roleColor(role) {
  return { owner: "#C1642F", manager: "#8A6F1F", server: "#3E6B8A", chef: "#56724A" }[role] || "#8A8578";
}

// ---------------------------------------------------------------------------
// App Shell (top bar + nav)
// ---------------------------------------------------------------------------
function Shell({ currentUser, onLogout, syncedAt, children }) {
  return (
    <div className="min-h-screen bg-[#F6F1E6]">
      <FontStyles />
      <header className="bg-[#23201B] text-[#F6F1E6] no-print">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ChefHat className="text-[#C1642F]" size={22} />
            <span className="font-display uppercase tracking-tight text-lg">The Pass</span>
          </div>
          <div className="flex items-center gap-4">
            <div className="hidden sm:flex items-center gap-1 text-[10px] font-ticket text-[#8A8578] uppercase tracking-widest">
              <CircleDot size={10} className="text-[#56724A]" /> synced {syncedAt ? syncedAt.toLocaleTimeString() : "…"}
            </div>
            <div className="text-right leading-tight">
              <div className="text-sm font-medium">{currentUser.name}</div>
              <div className="text-[10px] font-ticket uppercase tracking-widest" style={{ color: roleColor(currentUser.role) }}>{ROLE_LABEL[currentUser.role]}</div>
            </div>
            <button onClick={onLogout} className="p-2 hover:bg-white/10 rounded-sm" title="Log out"><LogOut size={18} /></button>
          </div>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-4 py-6">{children}</main>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tag / badge helpers
// ---------------------------------------------------------------------------
function Tag({ children, tone = "default" }) {
  const tones = {
    default: "bg-[#EDE7D8] text-[#5c5648]",
    urgent: "bg-[#B23A2E] text-white",
    quick: "bg-[#C1642F] text-white",
    ready: "bg-[#56724A] text-white",
    pending: "bg-[#8A8578] text-white",
  };
  return <span className={`px-2 py-0.5 rounded-sm text-[10px] font-ticket uppercase tracking-widest ${tones[tone]}`}>{children}</span>;
}

// ---------------------------------------------------------------------------
// Order Ticket (shared visual component)
// ---------------------------------------------------------------------------
function OrderTicket({ order, footer }) {
  const stubColor = order.urgent ? "#B23A2E" : order.quick ? "#C1642F" : "#3E6B8A";
  const mins = Math.max(0, Math.round((Date.now() - new Date(order.createdAt).getTime()) / 60000));
  return (
    <div className="bg-white rounded-sm shadow-md border-l-[6px] overflow-hidden" style={{ borderColor: stubColor }}>
      <div className="px-4 pt-3 pb-2 flex items-center justify-between">
        <div>
          <div className="font-display text-xl uppercase text-[#23201B]">Table {order.table}</div>
          <div className="font-ticket text-[10px] text-[#8A8578] uppercase tracking-widest">{order.serverName} · {mins}m ago</div>
        </div>
        <div className="flex gap-1 flex-wrap justify-end">
          {order.urgent && <Tag tone="urgent">Rush</Tag>}
          {order.quick && <Tag tone="quick">Quick</Tag>}
          <Tag tone={order.status === "pending" ? "pending" : order.status === "sent" ? "ready" : "default"}>{STATUS_LABEL[order.status]}</Tag>
        </div>
      </div>
      <div className="perf" />
      <div className="px-4 py-3 space-y-2 font-ticket">
        {order.items.map((it) => (
          <div key={it.id} className="text-sm">
            <div className="flex justify-between text-[#23201B]">
              <span>{it.qty}× {it.name}</span>
              <span>{money(it.price * it.qty)}</span>
            </div>
            {it.remarks && <div className="text-[11px] text-[#B23A2E] pl-4">note: {it.remarks}</div>}
          </div>
        ))}
      </div>
      {footer && <div className="px-4 pb-4">{footer}</div>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// SERVER DASHBOARD
// ---------------------------------------------------------------------------
function ServerDashboard({ currentUser, menu, orders, setOrders }) {
  const [tab, setTab] = useState("new");
  const [table, setTable] = useState("");
  const [urgent, setUrgent] = useState(false);
  const [quick, setQuick] = useState(false);
  const [cart, setCart] = useState([]); // {menuItemId,name,price,qty,remarks}
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
            <div className="flex flex-wrap gap-3 mb-4">
              <input value={table} onChange={(e) => setTable(e.target.value)} placeholder="Table number"
                className="border border-[#C9C2AF] bg-white px-3 py-2 rounded-sm text-sm font-ticket w-40" />
              <button onClick={() => setUrgent(!urgent)}
                className={`px-3 py-2 rounded-sm text-xs font-ticket uppercase tracking-widest flex items-center gap-1 border ${urgent ? "bg-[#B23A2E] text-white border-[#B23A2E]" : "border-[#C9C2AF] text-[#5c5648]"}`}>
                <Flame size={14} /> Urgent
              </button>
              <button onClick={() => setQuick(!quick)}
                className={`px-3 py-2 rounded-sm text-xs font-ticket uppercase tracking-widest flex items-center gap-1 border ${quick ? "bg-[#C1642F] text-white border-[#C1642F]" : "border-[#C9C2AF] text-[#5c5648]"}`}>
                <Zap size={14} /> Quick
              </button>
            </div>
            <div className="relative mb-3">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8A8578]" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search menu…"
                className="w-full border border-[#C9C2AF] bg-white pl-9 pr-3 py-2 rounded-sm text-sm" />
            </div>
            <div className="grid sm:grid-cols-2 gap-2">
              {available.length === 0 && <p className="text-sm text-[#8A8578] font-ticket">No dishes found.</p>}
              {available.map((item) => (
                <button key={item.id} onClick={() => addToCart(item)}
                  className="text-left bg-white hover:bg-[#EDE7D8] border border-[#E4DECB] rounded-sm px-3 py-2 flex items-center justify-between transition">
                  <div>
                    <div className="text-sm font-medium text-[#23201B]">{item.name}</div>
                    <div className="text-[10px] font-ticket text-[#8A8578] uppercase">{item.category}</div>
                  </div>
                  <div className="font-ticket text-sm text-[#C1642F]">{money(item.price)}</div>
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="bg-white rounded-sm shadow-md p-4 sticky top-4">
              <div className="font-display uppercase text-[#23201B] mb-3 flex items-center gap-2"><ClipboardList size={16} /> Order for Table {table || "—"}</div>
              {cart.length === 0 && <p className="text-xs text-[#8A8578] font-ticket">Tap dishes to add them here.</p>}
              <div className="space-y-3 mb-3">
                {cart.map((l) => (
                  <div key={l.id} className="border-b border-dashed border-[#E4DECB] pb-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-[#23201B]">{l.name}</span>
                      <button onClick={() => removeCartLine(l.id)}><Trash2 size={14} className="text-[#B23A2E]" /></button>
                    </div>
                    <div className="flex items-center justify-between mt-1">
                      <div className="flex items-center gap-2">
                        <button onClick={() => updateCartLine(l.id, { qty: Math.max(1, l.qty - 1) })} className="w-6 h-6 flex items-center justify-center bg-[#EDE7D8] rounded-sm"><Minus size={12} /></button>
                        <span className="font-ticket text-sm w-4 text-center">{l.qty}</span>
                        <button onClick={() => updateCartLine(l.id, { qty: l.qty + 1 })} className="w-6 h-6 flex items-center justify-center bg-[#EDE7D8] rounded-sm"><Plus size={12} /></button>
                      </div>
                      <span className="font-ticket text-sm text-[#C1642F]">{money(l.price * l.qty)}</span>
                    </div>
                    <input value={l.remarks} onChange={(e) => updateCartLine(l.id, { remarks: e.target.value })} placeholder="remarks e.g. no onions"
                      className="w-full mt-1 border border-[#E4DECB] rounded-sm px-2 py-1 text-xs font-ticket" />
                  </div>
                ))}
              </div>
              {cart.length > 0 && (
                <div className="flex justify-between font-display uppercase text-sm mb-3">
                  <span>Total</span>
                  <span>{money(cart.reduce((s, l) => s + l.price * l.qty, 0))}</span>
                </div>
              )}
              <button onClick={submitOrder} disabled={!table.trim() || cart.length === 0}
                className="w-full bg-[#23201B] disabled:opacity-30 text-[#F6F1E6] py-2 rounded-sm text-sm font-display uppercase tracking-wide flex items-center justify-center gap-2">
                Send to Kitchen <ArrowRight size={16} />
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
          {myActiveOrders.length === 0 && <p className="text-sm text-[#8A8578] font-ticket">No active orders.</p>}
          {myActiveOrders.map((o) => <OrderTicket key={o.id} order={o} />)}
        </div>
      )}
    </div>
  );
}

function TabBar({ tabs, current, onChange }) {
  return (
    <div className="flex gap-1 border-b border-[#E4DECB] no-print">
      {tabs.map(([key, label, Icon]) => (
        <button key={key} onClick={() => onChange(key)}
          className={`px-4 py-2 text-sm font-display uppercase tracking-wide flex items-center gap-2 border-b-2 -mb-px transition ${current === key ? "border-[#C1642F] text-[#23201B]" : "border-transparent text-[#8A8578] hover:text-[#23201B]"}`}>
          <Icon size={15} /> {label}
        </button>
      ))}
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
        <ChefHat className="text-[#56724A]" size={20} />
        <h2 className="font-display uppercase text-xl text-[#23201B]">Kitchen — Orders by Table</h2>
      </div>
      {Object.keys(grouped).length === 0 && <p className="text-sm text-[#8A8578] font-ticket">No orders in progress.</p>}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {Object.entries(grouped).map(([table, tableOrders]) => (
          <div key={table} className="space-y-3">
            {tableOrders.map((o) => (
              <OrderTicket key={o.id} order={o} footer={
                o.status !== "sent" ? (
                  <button onClick={() => advance(o)}
                    className="w-full bg-[#56724A] text-white py-2 rounded-sm text-xs font-display uppercase tracking-widest flex items-center justify-center gap-2">
                    <Check size={14} /> {STATUS_NEXT_LABEL[o.status]}
                  </button>
                ) : (
                  <div className="w-full text-center text-[#56724A] text-xs font-ticket uppercase tracking-widest py-1">✓ Sent to table</div>
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
  const [form, setForm] = useState({ name: "", price: "", category: "" });
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});

  const addItem = (e) => {
    e.preventDefault();
    if (!form.name.trim() || !form.price) return;
    setMenu([...menu, { id: uid(), name: form.name.trim(), price: parseFloat(form.price), category: form.category.trim() || "General", available: true }]);
    setForm({ name: "", price: "", category: "" });
  };
  const startEdit = (item) => { setEditingId(item.id); setEditForm(item); };
  const saveEdit = () => {
    setMenu(menu.map((m) => m.id === editingId ? { ...editForm, price: parseFloat(editForm.price) } : m));
    setEditingId(null);
  };
  const removeItem = (id) => setMenu(menu.filter((m) => m.id !== id));
  const toggleAvailable = (id) => setMenu(menu.map((m) => m.id === id ? { ...m, available: !m.available } : m));

  const byCategory = menu.reduce((acc, m) => { (acc[m.category] = acc[m.category] || []).push(m); return acc; }, {});

  return (
    <div className="grid md:grid-cols-3 gap-6">
      <div className="md:col-span-2 space-y-6">
        {Object.keys(byCategory).length === 0 && <p className="text-sm text-[#8A8578] font-ticket">No dishes yet — add your first one.</p>}
        {Object.entries(byCategory).map(([cat, items]) => (
          <div key={cat}>
            <h3 className="font-display uppercase text-sm text-[#8A8578] mb-2 tracking-widest">{cat}</h3>
            <div className="bg-white rounded-sm shadow-sm divide-y divide-[#EDE7D8]">
              {items.map((item) => (
                <div key={item.id} className="px-4 py-3 flex items-center justify-between">
                  {editingId === item.id ? (
                    <div className="flex-1 flex gap-2 items-center flex-wrap">
                      <input value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} className="border border-[#C9C2AF] rounded-sm px-2 py-1 text-sm flex-1" />
                      <input value={editForm.price} onChange={(e) => setEditForm({ ...editForm, price: e.target.value })} className="border border-[#C9C2AF] rounded-sm px-2 py-1 text-sm w-24 font-ticket" />
                      <input value={editForm.category} onChange={(e) => setEditForm({ ...editForm, category: e.target.value })} className="border border-[#C9C2AF] rounded-sm px-2 py-1 text-sm w-28" />
                      <button onClick={saveEdit} className="p-1.5 bg-[#56724A] text-white rounded-sm"><Save size={14} /></button>
                      <button onClick={() => setEditingId(null)} className="p-1.5 bg-[#8A8578] text-white rounded-sm"><X size={14} /></button>
                    </div>
                  ) : (
                    <>
                      <div className={item.available === false ? "opacity-40" : ""}>
                        <div className="text-sm font-medium text-[#23201B]">{item.name}</div>
                        {item.available === false && <div className="text-[10px] font-ticket text-[#B23A2E] uppercase">86'd — unavailable</div>}
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-ticket text-sm text-[#C1642F]">{money(item.price)}</span>
                        <button onClick={() => toggleAvailable(item.id)} title="Toggle availability" className="text-[#8A8578] hover:text-[#23201B]"><CircleDot size={16} /></button>
                        <button onClick={() => startEdit(item)} className="text-[#8A8578] hover:text-[#23201B]"><Pencil size={16} /></button>
                        <button onClick={() => removeItem(item.id)} className="text-[#B23A2E]"><Trash2 size={16} /></button>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div>
        <div className="bg-white rounded-sm shadow-md p-4 sticky top-4">
          <div className="font-display uppercase text-[#23201B] mb-3">Add a Dish</div>
          <form onSubmit={addItem} className="space-y-2">
            <input placeholder="Dish name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full border border-[#C9C2AF] rounded-sm px-3 py-2 text-sm" />
            <input placeholder="Price" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} className="w-full border border-[#C9C2AF] rounded-sm px-3 py-2 text-sm font-ticket" />
            <input placeholder="Category (e.g. Starters)" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="w-full border border-[#C9C2AF] rounded-sm px-3 py-2 text-sm" />
            <button type="submit" className="w-full bg-[#23201B] text-[#F6F1E6] py-2 rounded-sm text-sm font-display uppercase flex items-center justify-center gap-2"><Plus size={16} /> Add to Menu</button>
          </form>
          <p className="text-[11px] text-[#8A8578] font-ticket mt-3">Changes appear for servers immediately — everyone syncs every few seconds.</p>
        </div>
      </div>
    </div>
  );
}

function OrdersOverview({ orders }) {
  const active = orders.filter(o => !o.billed).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {active.length === 0 && <p className="text-sm text-[#8A8578] font-ticket">No active orders right now.</p>}
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
      <div className="md:col-span-2 bg-white rounded-sm shadow-sm divide-y divide-[#EDE7D8]">
        {profiles.map((p) => (
          <div key={p.id} className="px-4 py-3 flex items-center justify-between">
            <div>
              <div className="text-sm font-medium text-[#23201B]">{p.name}</div>
              <div className="text-[10px] font-ticket uppercase tracking-widest" style={{ color: roleColor(p.role) }}>{ROLE_LABEL[p.role]}</div>
            </div>
            {p.id !== currentUser.id && <button onClick={() => removeProfile(p.id)} className="text-[#B23A2E]"><Trash2 size={16} /></button>}
          </div>
        ))}
      </div>
      <div className="bg-white rounded-sm shadow-md p-4">
        <div className="font-display uppercase text-[#23201B] mb-3 flex items-center gap-2"><ShieldCheck size={16} /> New Profile</div>
        <form onSubmit={addProfile} className="space-y-2">
          <input placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full border border-[#C9C2AF] rounded-sm px-3 py-2 text-sm" />
          <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} className="w-full border border-[#C9C2AF] rounded-sm px-3 py-2 text-sm">
            {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
          </select>
          <input placeholder="PIN" value={form.pin} onChange={(e) => setForm({ ...form, pin: e.target.value })} className="w-full border border-[#C9C2AF] rounded-sm px-3 py-2 text-sm" />
          <button type="submit" className="w-full bg-[#23201B] text-[#F6F1E6] py-2 rounded-sm text-sm font-display uppercase">Create Profile</button>
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
  const [extras, setExtras] = useState([]); // {id,name,price}
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
        <label className="text-xs font-ticket uppercase text-[#8A8578] tracking-widest">Table ready to bill</label>
        <select value={selectedTable} onChange={(e) => setSelectedTable(e.target.value)} className="w-full border border-[#C9C2AF] bg-white rounded-sm px-3 py-2 text-sm mt-1 mb-4">
          <option value="">Select a table…</option>
          {billableTables.map((t) => <option key={t} value={t}>Table {t}</option>)}
        </select>
        {billableTables.length === 0 && <p className="text-sm text-[#8A8578] font-ticket">No orders are marked "Sent" yet — nothing to bill.</p>}

        {selectedTable && (
          <div className="bg-white rounded-sm shadow-md p-4">
            <div className="font-display uppercase text-[#23201B] mb-3">Table {selectedTable} — Items</div>
            <div className="font-ticket text-sm space-y-1 mb-3">
              {tableOrders.flatMap(o => o.items).map((it, i) => (
                <div key={i} className="flex justify-between border-b border-dashed border-[#EDE7D8] pb-1">
                  <span>{it.qty}× {it.name}{it.remarks ? ` (${it.remarks})` : ""}</span>
                  <span>{money(it.price * it.qty)}</span>
                </div>
              ))}
            </div>
            <div className="font-display uppercase text-sm text-[#8A8578] mb-2">Additional Items</div>
            <div className="space-y-1 mb-2">
              {extras.map((e) => (
                <div key={e.id} className="flex justify-between items-center font-ticket text-sm">
                  <span>{e.name}</span>
                  <span className="flex items-center gap-2">{money(e.price)}<button onClick={() => removeExtra(e.id)}><X size={14} className="text-[#B23A2E]" /></button></span>
                </div>
              ))}
            </div>
            <form onSubmit={addExtra} className="flex gap-2 mb-4">
              <input placeholder="Extra item (e.g. delivery, service)" value={extraForm.name} onChange={(e) => setExtraForm({ ...extraForm, name: e.target.value })} className="flex-1 border border-[#C9C2AF] rounded-sm px-2 py-1.5 text-sm" />
              <input placeholder="Price" value={extraForm.price} onChange={(e) => setExtraForm({ ...extraForm, price: e.target.value })} className="w-24 border border-[#C9C2AF] rounded-sm px-2 py-1.5 text-sm font-ticket" />
              <button type="submit" className="px-3 bg-[#EDE7D8] rounded-sm"><Plus size={16} /></button>
            </form>
          </div>
        )}
      </div>
      {selectedTable && (
        <div>
          <div className="bg-white rounded-sm shadow-md p-4 sticky top-4">
            <div className="font-display uppercase text-[#23201B] mb-3">Final Bill</div>
            <input placeholder="Customer name" value={customerName} onChange={(e) => setCustomerName(e.target.value)} className="w-full border border-[#C9C2AF] rounded-sm px-3 py-2 text-sm mb-3" />
            <div className="font-ticket text-sm space-y-1 mb-3">
              <div className="flex justify-between"><span>Subtotal</span><span>{money(dishSubtotal)}</span></div>
              <div className="flex justify-between"><span>Additional items</span><span>{money(extrasTotal)}</span></div>
              <div className="flex justify-between font-display uppercase text-base border-t border-[#EDE7D8] pt-2"><span>Total</span><span className="text-[#C1642F]">{money(grandTotal)}</span></div>
            </div>
            <button onClick={generateBill} className="w-full bg-[#23201B] text-[#F6F1E6] py-2 rounded-sm text-sm font-display uppercase flex items-center justify-center gap-2">
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
      <div className="print-area bg-white rounded-sm shadow-lg p-6 font-ticket">
        <div className="text-center mb-4">
          <ChefHat className="mx-auto text-[#C1642F] mb-1" size={26} />
          <div className="font-display uppercase text-lg tracking-wide">The Pass</div>
          <div className="text-[10px] text-[#8A8578] uppercase tracking-widest">Guest Receipt</div>
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
        <div className="flex justify-between font-display uppercase text-lg"><span>Total</span><span className="text-[#C1642F]">{money(bill.total)}</span></div>
        <div className="text-center text-[10px] text-[#8A8578] mt-4 uppercase tracking-widest">Thank you for dining with us</div>
      </div>
      <div className="flex gap-2 mt-4 no-print">
        <button onClick={() => window.print()} className="flex-1 bg-[#23201B] text-[#F6F1E6] py-2 rounded-sm text-sm font-display uppercase flex items-center justify-center gap-2"><Printer size={16} /> Print</button>
        <button onClick={onClose} className="flex-1 bg-[#EDE7D8] text-[#23201B] py-2 rounded-sm text-sm font-display uppercase">Close Table</button>
      </div>
    </div>
  );
}
