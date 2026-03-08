import { useState, useEffect, useMemo, useRef } from "react";

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────
const INITIAL_CATEGORIES = {
  income:  ["Salaire","Freelance","Investissement","Cadeau","Remboursement","Autre"],
  expense: ["Logement","Alimentation","Transport","Santé","Loisirs","Vêtements","Abonnements","Épargne","Autre"],
};
const MONTHS_FR = ["Janvier","Février","Mars","Avril","Mai","Juin","Juillet","Août","Septembre","Octobre","Novembre","Décembre"];
const PROJECT_EMOJIS = ["🏖️","✈️","🏠","🚗","💻","🎓","💍","🎁","⛺","🛥️","🎸","💪","🌍","🐶","📷"];

// ─────────────────────────────────────────────────────────────────────────────
// THEME — Clarté · Marine & Menthe (écosystème Prism)
// ─────────────────────────────────────────────────────────────────────────────
const T = {
  bg:           "#F6F8FA",
  surface:      "#FFFFFF",
  header:       "#0A2342",
  primary:      "#0A2342",
  accent:       "#3ECFB2",
  accentDark:   "#2EB89E",
  accentLight:  "#E6FAF6",
  income:       "#138A60",
  incomeLight:  "#E8F7EF",
  expense:      "#B83232",
  expenseLight: "#FDECEA",
  project:      "#7C3AED",
  projectLight: "#EDE9FE",
  warn:         "#D97706",
  warnLight:    "#FEF3C7",
  text:         "#0A1929",
  muted:        "#607080",
  border:       "#D8E4EC",
  font:         "'Segoe UI','Helvetica Neue',Helvetica,sans-serif",
};

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────
const fmt  = n => new Intl.NumberFormat("fr-FR", { style:"currency", currency:"EUR" }).format(n || 0);
const fmtD = d => { try { return new Date(d + "T00:00:00").toLocaleDateString("fr-FR"); } catch { return d || ""; } };
const today = () => new Date().toISOString().split("T")[0];
const mKey  = (y, m) => `${y}-${String(m + 1).padStart(2, "0")}`;
const uid   = () => Date.now().toString(36) + Math.random().toString(36).slice(2);

const inPeriod = (item, year, month) => {
  const cur   = year  * 12 + month;
  const start = item.startYear * 12 + item.startMonth;
  if (cur < start) return false;
  if (item.endYear != null && item.endMonth != null) {
    if (cur > item.endYear * 12 + item.endMonth) return false;
  }
  return true;
};

const periodLabel = item => {
  const s = `${MONTHS_FR[item.startMonth].slice(0, 3)} ${item.startYear}`;
  if (item.endYear == null) return `Depuis ${s}`;
  return `${s} → ${MONTHS_FR[item.endMonth].slice(0, 3)} ${item.endYear}`;
};

// Durée en jours entre aujourd'hui et une date cible
const daysUntil = dateStr => {
  const now = new Date(); now.setHours(0,0,0,0);
  const target = new Date(dateStr + "T00:00:00");
  return Math.ceil((target - now) / 86400000);
};

// ─────────────────────────────────────────────────────────────────────────────
// LOGO PRISM
// ─────────────────────────────────────────────────────────────────────────────
function PrismLogo({ size = 32 }) {
  const r = Math.round(size * 0.28), cx = size / 2;
  const top = size * 0.15, bot = size * 0.82, mid = size * 0.55;
  const lx = size * 0.18, rx = size * 0.82;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} fill="none" style={{ display: "block" }}>
      <rect width={size} height={size} rx={r} fill={T.header} />
      <polygon
        points={`${cx},${top} ${rx},${bot} ${lx},${bot}`}
        fill="none" stroke={T.accent} strokeWidth={size * 0.065} strokeLinejoin="round"
      />
      <line x1={cx} y1={top} x2={cx} y2={mid}
        stroke="#FFFFFF" strokeWidth={size * 0.04} strokeOpacity="0.55" />
      <line x1={cx} y1={mid} x2={lx + (cx - lx) * 0.55} y2={bot}
        stroke={T.accent} strokeWidth={size * 0.04} strokeOpacity="0.75" />
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPOSANTS UI
// ─────────────────────────────────────────────────────────────────────────────
const Bar = ({ pct, color, h=6 }) => (
  <div style={{ height:h, borderRadius:4, background:T.border, overflow:"hidden", marginTop:3 }}>
    <div style={{ width:`${Math.min(pct||0,100)}%`, height:"100%", background:color, borderRadius:4, transition:"width .4s" }}/>
  </div>
);

const S = {
  card: { background:T.surface, borderRadius:14, padding:"13px 16px", margin:"10px 14px",
          border:`1px solid ${T.border}`, boxShadow:"0 1px 6px rgba(10,35,66,0.05)" },
  cf:  (m="10px 14px") => ({ background:T.surface, borderRadius:14, padding:"13px 16px",
          margin:m, border:`1px solid ${T.border}` }),
  row: { display:"flex", justifyContent:"space-between", alignItems:"center",
         padding:"9px 0", borderBottom:`1px solid ${T.border}` },
  rowL:{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"9px 0" },
  inp: { width:"100%", background:T.bg, border:`1.5px solid ${T.border}`, borderRadius:9,
         padding:"9px 12px", color:T.text, fontSize:14, fontFamily:T.font,
         boxSizing:"border-box", marginBottom:9, outline:"none" },
  sel: { width:"100%", background:T.bg, border:`1.5px solid ${T.border}`, borderRadius:9,
         padding:"9px 12px", color:T.text, fontSize:14, fontFamily:T.font,
         boxSizing:"border-box", marginBottom:9, outline:"none" },
  btn: (bg, fg="#fff") => ({ width:"100%", padding:"11px", background:bg, border:"none",
         borderRadius:10, color:fg, fontSize:14, fontWeight:700, fontFamily:T.font,
         cursor:"pointer", marginBottom:7 }),
  smBtn:(bg, fg="#fff", o=false) => ({ padding:"5px 11px", background:o?"transparent":bg,
         border:o?`1.5px solid ${bg}`:"none", borderRadius:8, color:o?bg:fg,
         fontSize:12, fontWeight:600, fontFamily:T.font, cursor:"pointer", flexShrink:0 }),
  tog: { display:"flex", background:T.bg, border:`1.5px solid ${T.border}`, borderRadius:10,
         padding:3, marginBottom:10 },
  tBtn:(a) => ({ flex:1, padding:"7px", border:"none", borderRadius:8, fontFamily:T.font,
         cursor:"pointer", fontWeight:a?700:400, fontSize:13,
         background:a?`${T.accent}22`:"transparent", color:a?T.accent:T.muted }),
  tab: (a) => ({ flex:1, padding:"7px", border:"none", borderRadius:8, fontFamily:T.font,
         cursor:"pointer", fontWeight:a?700:400, fontSize:13,
         background:a?T.accent:"transparent", color:a?"#fff":T.muted }),
  nav: { position:"fixed", bottom:0, left:"50%", transform:"translateX(-50%)", width:"100%",
         maxWidth:480, background:T.surface, display:"flex", borderTop:`1px solid ${T.border}`,
         zIndex:100, boxShadow:"0 -2px 12px rgba(10,35,66,0.08)" },
  navB:(a) => ({ flex:1, padding:"10px 2px 8px", background:"none", border:"none",
         fontFamily:T.font, color:a?T.accent:T.muted, cursor:"pointer", fontSize:9,
         display:"flex", flexDirection:"column", alignItems:"center", gap:2,
         fontWeight:a?700:500, borderTop:a?`2.5px solid ${T.accent}`:"2.5px solid transparent" }),
  lbl: { fontSize:11, color:T.muted, fontWeight:600, display:"block", marginBottom:3, letterSpacing:.3 },
  sec: { fontSize:10, color:T.muted, fontWeight:700, letterSpacing:1.5, textTransform:"uppercase" },
  mSel:{ display:"flex", gap:6, padding:"8px 14px", overflowX:"auto", scrollbarWidth:"none" },
  mChip:(a) => ({ padding:"5px 12px", borderRadius:20,
         border:`1px solid ${a?T.accent:T.border}`, background:a?T.accent:T.surface,
         color:a?"#fff":T.muted, cursor:"pointer", whiteSpace:"nowrap",
         fontSize:12, fontWeight:a?700:400 }),
};

// ─────────────────────────────────────────────────────────────────────────────
// CSV HELPERS
// ─────────────────────────────────────────────────────────────────────────────
const exportCSV = (transactions) => {
  const BOM = "\uFEFF";
  const hdr = "Date;Type;Catégorie;Description;Montant (€);Récurrent\n";
  const rows = transactions.map(t => {
    const d = fmtD(t.date);
    const type = t.type === "income" ? "Revenu" : "Dépense";
    const desc = (t.description || "").replace(/;/g, ",");
    const cat  = (t.category || "").replace(/;/g, ",");
    const amt  = String(t.amount).replace(".", ",");
    const rec  = t.isRecurring ? "Oui" : "Non";
    return `${d};${type};${cat};${desc};${amt};${rec}`;
  }).join("\n");
  const blob = new Blob([BOM + hdr + rows], { type:"text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = `prism-finance-${today()}.csv`; a.click();
  URL.revokeObjectURL(url);
};

const parseCSV = (text) => {
  const lines = text.replace(/\r/g, "").split("\n").filter(l => l.trim());
  if (lines.length < 2) return [];
  const results = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(/;|,/).map(c => c.trim().replace(/^"|"$/g, ""));
    if (cols.length < 5) continue;
    const [rawDate, rawType, cat, desc, rawAmt] = cols;
    // Date: DD/MM/YYYY ou YYYY-MM-DD
    let date = today();
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(rawDate)) {
      const [d,m,y] = rawDate.split("/");
      date = `${y}-${m}-${d}`;
    } else if (/^\d{4}-\d{2}-\d{2}$/.test(rawDate)) {
      date = rawDate;
    }
    const type = rawType.toLowerCase().includes("rev") ? "income" : "expense";
    const amount = parseFloat(rawAmt.replace(",", ".")) || 0;
    if (amount <= 0) continue;
    results.push({ id:uid(), date, type, category:cat||"Autre", description:desc||"", amount, isRecurring:false });
  }
  return results;
};

// ─────────────────────────────────────────────────────────────────────────────
// MOTEUR DE PROJECTION
// ─────────────────────────────────────────────────────────────────────────────
function buildProjection(transactions, recurring, nbMonths = 13) {
  const now = new Date();
  const curY = now.getFullYear();
  const curM = now.getMonth();

  // Moyenne mensuelle des dépenses par catégorie sur les 3–6 derniers mois réels
  const recentTx = transactions.filter(t => {
    const d = new Date(t.date + "T00:00:00");
    const age = (curY - d.getFullYear()) * 12 + (curM - d.getMonth());
    return age >= 0 && age < 6 && !t.isRecurring;
  });

  // Regrouper par mois réel pour calculer la moyenne
  const byMonth = {};
  recentTx.forEach(t => {
    const d = new Date(t.date + "T00:00:00");
    const k = mKey(d.getFullYear(), d.getMonth());
    if (!byMonth[k]) byMonth[k] = { income:0, expense:{} };
    if (t.type === "income") {
      byMonth[k].income += t.amount;
    } else {
      byMonth[k].expense[t.category] = (byMonth[k].expense[t.category] || 0) + t.amount;
    }
  });

  const monthKeys = Object.keys(byMonth);
  const nb = monthKeys.length || 1;

  // Moyenne des revenus non-récurrents
  const avgVarIncome = monthKeys.reduce((s, k) => s + byMonth[k].income, 0) / nb;

  // Moyenne dépenses variables par catégorie
  const catTotals = {};
  monthKeys.forEach(k => {
    Object.entries(byMonth[k].expense).forEach(([cat, amt]) => {
      catTotals[cat] = (catTotals[cat] || 0) + amt;
    });
  });
  const avgCatExpense = {};
  Object.entries(catTotals).forEach(([cat, total]) => {
    avgCatExpense[cat] = total / nb;
  });

  // Générer les N prochains mois
  const months = [];
  let cumulBalance = 0;

  for (let i = 0; i < nbMonths; i++) {
    let m = curM + i;
    let y = curY + Math.floor(m / 12);
    m = m % 12;

    // Récurrents actifs ce mois
    const activeRecur = recurring.filter(r => inPeriod(r, y, m));
    const recurIncome  = activeRecur.filter(r => r.type === "income").reduce((s, r) => s + r.amount, 0);
    const recurExpense = activeRecur.filter(r => r.type === "expense").reduce((s, r) => s + r.amount, 0);

    // Catégories de dépenses récurrentes (pour ne pas les doubler)
    const recurExpCats = new Set(activeRecur.filter(r => r.type === "expense").map(r => r.category));

    // Dépenses variables (hors catégories déjà couvertes par récurrents)
    let varExpense = 0;
    const catBreakdown = {};
    // Récurrents
    activeRecur.filter(r => r.type === "expense").forEach(r => {
      catBreakdown[r.category] = (catBreakdown[r.category] || 0) + r.amount;
    });
    // Variables
    Object.entries(avgCatExpense).forEach(([cat, avg]) => {
      if (!recurExpCats.has(cat)) {
        varExpense += avg;
        catBreakdown[cat] = (catBreakdown[cat] || 0) + avg;
      }
    });

    const projIncome  = recurIncome + avgVarIncome;
    const projExpense = recurExpense + varExpense;
    const balance     = projIncome - projExpense;
    cumulBalance     += balance;

    months.push({
      year: y, month: m,
      label: `${MONTHS_FR[m].slice(0,3)} ${y}`,
      income:  projIncome,
      expense: projExpense,
      balance,
      cumulBalance,
      catBreakdown,
      isHistory: i === 0, // mois courant
    });
  }
  return { months, avgVarIncome, avgCatExpense };
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN APP
// ─────────────────────────────────────────────────────────────────────────────
export default function PrismFinance() {

  // ── Core state ───────────────────────────────────────────────────────────
  const [transactions,    setTransactions]    = useState([]);
  const [recurring,       setRecurring]       = useState([]);
  const [categories,      setCategories]      = useState(INITIAL_CATEGORIES);
  const [generatedMonths, setGeneratedMonths] = useState([]);
  const [projects,        setProjects]        = useState([]);
  const [loaded,          setLoaded]          = useState(false);

  // ── UI state ─────────────────────────────────────────────────────────────
  const [view,        setView]        = useState("dashboard");
  const [manageTab,   setManageTab]   = useState("recurring");
  const [filterMonth, setFilterMonth] = useState(new Date().getMonth());
  const [filterYear,  setFilterYear]  = useState(new Date().getFullYear());

  // ── Transaction form ─────────────────────────────────────────────────────
  const [form,    setForm]    = useState({ type:"expense", amount:"", description:"", category:"Alimentation", date:today() });
  const [formErr, setFormErr] = useState("");
  const [saveMsg, setSaveMsg] = useState("");

  // ── Recurring form ────────────────────────────────────────────────────────
  const nowD = new Date();
  const emptyR = {
    name:"", amount:"", category:"Logement", type:"expense", day:"1",
    startMonth: nowD.getMonth(), startYear: nowD.getFullYear(),
    endMonth:   nowD.getMonth(), endYear:   nowD.getFullYear(),
    hasEnd: false,
  };
  const [recurForm,   setRecurForm]   = useState(emptyR);
  const [showRecurF,  setShowRecurF]  = useState(false);
  const [editRecurId, setEditRecurId] = useState(null);

  // ── Category form ─────────────────────────────────────────────────────────
  const [newCatName, setNewCatName] = useState("");
  const [newCatType, setNewCatType] = useState("expense");
  const [editCat,    setEditCat]    = useState(null);
  const [editCatVal, setEditCatVal] = useState("");

  // ── Import ────────────────────────────────────────────────────────────────
  const [importMsg,  setImportMsg]  = useState("");
  const fileRef = useRef(null);

  // ── Projets state ────────────────────────────────────────────────────────
  const emptyProj = { name:"", emoji:"🏖️", targetAmount:"", deadline:"", savedAmount:"", note:"" };
  const [projForm,   setProjForm]   = useState(emptyProj);
  const [showProjF,  setShowProjF]  = useState(false);
  const [editProjId, setEditProjId] = useState(null);
  const [projAllocForm, setProjAllocForm] = useState({ id:"", amount:"" });

  // ── Projection UI ────────────────────────────────────────────────────────
  const [projNbMonths, setProjNbMonths] = useState(13);
  const [projShowCats, setProjShowCats] = useState(false);

  // ─────────────────────────────────────────────────────────────────────────
  // LOCALSTORAGE — chargement avec migration des anciennes clés
  // ─────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    const g = k => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : null; } catch { return null; } };

    // Migration : anciennes clés → nouvelles clés prism_*
    if (!localStorage.getItem("prism_finance_migrated_v1")) {
      const oldTx   = g("budget_transactions");
      const oldRec  = g("budget_recurring");
      const oldCat1 = g("budget_categories");
      const oldCat2 = g("budget_custom_categories");
      const oldGen  = g("budget_generated_months");
      if (oldTx)   localStorage.setItem("prism_tx",        JSON.stringify(oldTx));
      if (oldRec)  localStorage.setItem("prism_recur",     JSON.stringify(oldRec));
      if (oldCat1) localStorage.setItem("prism_cats",      JSON.stringify(oldCat1));
      if (oldCat2 && !oldCat1) localStorage.setItem("prism_cats", JSON.stringify(oldCat2));
      if (oldGen)  localStorage.setItem("prism_genmonths", JSON.stringify(oldGen));
      localStorage.setItem("prism_finance_migrated_v1", "1");
    }

    setTransactions(   g("prism_tx")        || []);
    setRecurring(      g("prism_recur")      || []);
    setCategories(     g("prism_cats")       || INITIAL_CATEGORIES);
    setGeneratedMonths(g("prism_genmonths")  || []);
    setProjects(       g("prism_projects")   || []); // NOUVEAU — pas de migration (clé inédite)
    setLoaded(true);
  }, []);

  // ─────────────────────────────────────────────────────────────────────────
  // LOCALSTORAGE — sauvegarde
  // ─────────────────────────────────────────────────────────────────────────
  useEffect(() => { if (loaded) localStorage.setItem("prism_tx",       JSON.stringify(transactions));    }, [transactions,    loaded]);
  useEffect(() => { if (loaded) localStorage.setItem("prism_recur",    JSON.stringify(recurring));       }, [recurring,       loaded]);
  useEffect(() => { if (loaded) localStorage.setItem("prism_cats",     JSON.stringify(categories));      }, [categories,      loaded]);
  useEffect(() => { if (loaded) localStorage.setItem("prism_genmonths",JSON.stringify(generatedMonths)); }, [generatedMonths, loaded]);
  useEffect(() => { if (loaded) localStorage.setItem("prism_projects",  JSON.stringify(projects));       }, [projects,        loaded]);

  // ─────────────────────────────────────────────────────────────────────────
  // GÉNÉRATION DES RÉCURRENCES
  // ─────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!loaded) return;
    const now = new Date();
    const curY = now.getFullYear(), curM = now.getMonth();
    // Générer les 2 derniers mois + mois courant
    for (let delta = -1; delta <= 0; delta++) {
      let m = curM + delta, y = curY;
      if (m < 0) { m += 12; y--; }
      const key = mKey(y, m);
      if (generatedMonths.includes(key)) continue;
      const toAdd = recurring
        .filter(r => inPeriod(r, y, m))
        .map(r => ({
          id: `rec_${r.id}_${key}`,
          date: `${y}-${String(m + 1).padStart(2,"0")}-${String(Math.min(parseInt(r.day)||1, 28)).padStart(2,"0")}`,
          type: r.type, amount: r.amount, category: r.category,
          description: r.name, isRecurring: true, recurId: r.id,
        }))
        .filter(t => !transactions.some(x => x.id === t.id));
      if (toAdd.length > 0) setTransactions(prev => [...prev, ...toAdd]);
      setGeneratedMonths(prev => [...prev, key]);
    }
  }, [loaded, recurring]);

  // ─────────────────────────────────────────────────────────────────────────
  // DÉRIVÉS
  // ─────────────────────────────────────────────────────────────────────────
  const filteredTx = useMemo(() =>
    transactions.filter(t => {
      const d = new Date(t.date + "T00:00:00");
      return d.getFullYear() === filterYear && d.getMonth() === filterMonth;
    }).sort((a,b) => b.date.localeCompare(a.date)),
    [transactions, filterMonth, filterYear]);

  const totals = useMemo(() => ({
    income:  filteredTx.filter(t => t.type === "income").reduce((s,t) => s + t.amount, 0),
    expense: filteredTx.filter(t => t.type === "expense").reduce((s,t) => s + t.amount, 0),
  }), [filteredTx]);

  const catStats = useMemo(() => {
    const m = {};
    filteredTx.filter(t => t.type === "expense").forEach(t => {
      m[t.category] = (m[t.category] || 0) + t.amount;
    });
    return Object.entries(m).sort((a,b) => b[1]-a[1]);
  }, [filteredTx]);

  const monthlyEvol = useMemo(() => {
    const m = {};
    transactions.forEach(t => {
      const d = new Date(t.date + "T00:00:00");
      const k = mKey(d.getFullYear(), d.getMonth());
      if (!m[k]) m[k] = { income:0, expense:0, label:`${MONTHS_FR[d.getMonth()].slice(0,3)} ${d.getFullYear()}` };
      m[k][t.type] += t.amount;
    });
    return Object.entries(m).sort(([a],[b]) => a.localeCompare(b)).slice(-6).map(([,v]) => v);
  }, [transactions]);

  // Projection financière (moteur)
  const projection = useMemo(() =>
    loaded ? buildProjection(transactions, recurring, projNbMonths) : null,
    [transactions, recurring, projNbMonths, loaded]);

  // ─────────────────────────────────────────────────────────────────────────
  // TRANSACTIONS CRUD
  // ─────────────────────────────────────────────────────────────────────────
  const submitTx = () => {
    if (!form.amount || isNaN(parseFloat(form.amount)) || parseFloat(form.amount) <= 0) {
      setFormErr("Montant invalide."); return;
    }
    const tx = {
      id: uid(), date: form.date, type: form.type,
      amount: parseFloat(form.amount), description: form.description,
      category: form.category, isRecurring: false,
    };
    setTransactions(prev => [tx, ...prev]);
    setForm({ type:"expense", amount:"", description:"", category:"Alimentation", date:today() });
    setFormErr(""); setSaveMsg("✅ Enregistré !");
    setTimeout(() => setSaveMsg(""), 2000);
  };

  const deleteTx = id => {
    const t = transactions.find(x => x.id === id);
    if (t?.isRecurring && !window.confirm("Supprimer uniquement cette occurrence (les suivantes seront regénérées) ?")) return;
    setTransactions(prev => prev.filter(x => x.id !== id));
  };

  // ─────────────────────────────────────────────────────────────────────────
  // RÉCURRENCES CRUD
  // ─────────────────────────────────────────────────────────────────────────
  const submitRecur = () => {
    if (!recurForm.name.trim() || !recurForm.amount) return;
    const item = {
      ...recurForm,
      id: editRecurId || uid(),
      amount: parseFloat(recurForm.amount),
      day: parseInt(recurForm.day) || 1,
      endYear:  recurForm.hasEnd ? recurForm.endYear : null,
      endMonth: recurForm.hasEnd ? recurForm.endMonth : null,
    };
    if (editRecurId) {
      setRecurring(prev => prev.map(r => r.id === editRecurId ? item : r));
      // Supprimer les occurrences générées par cet item pour les regénérer
      setTransactions(prev => prev.filter(t => t.recurId !== editRecurId));
      setGeneratedMonths([]);
    } else {
      setRecurring(prev => [item, ...prev]);
    }
    setRecurForm(emptyR); setShowRecurF(false); setEditRecurId(null);
  };

  const deleteRecur = id => {
    if (!window.confirm("Supprimer cette récurrence et ses transactions générées ?")) return;
    setRecurring(prev => prev.filter(r => r.id !== id));
    setTransactions(prev => prev.filter(t => t.recurId !== id));
    setGeneratedMonths([]);
  };

  const startEditRecur = r => {
    setRecurForm({ ...r, hasEnd: r.endYear != null, endMonth: r.endMonth ?? nowD.getMonth(), endYear: r.endYear ?? nowD.getFullYear() });
    setEditRecurId(r.id); setShowRecurF(true);
  };

  // ─────────────────────────────────────────────────────────────────────────
  // CATÉGORIES CRUD
  // ─────────────────────────────────────────────────────────────────────────
  const addCategory = () => {
    const name = newCatName.trim();
    if (!name) return;
    setCategories(prev => ({ ...prev, [newCatType]: [...prev[newCatType].filter(c=>c!==name), name] }));
    setNewCatName("");
  };

  const renameCategory = (type, oldName) => {
    const newName = editCatVal.trim();
    if (!newName || newName === oldName) { setEditCat(null); return; }
    setCategories(prev => ({ ...prev, [type]: prev[type].map(c => c===oldName ? newName : c) }));
    setTransactions(prev => prev.map(t => t.category===oldName ? {...t, category:newName} : t));
    setRecurring(prev => prev.map(r => r.category===oldName ? {...r, category:newName} : r));
    setEditCat(null); setEditCatVal("");
  };

  const deleteCategory = (type, name) => {
    if (!window.confirm(`Supprimer la catégorie "${name}" ?`)) return;
    setCategories(prev => ({ ...prev, [type]: prev[type].filter(c => c !== name) }));
  };

  // ─────────────────────────────────────────────────────────────────────────
  // PROJETS D'ÉPARGNE CRUD
  // ─────────────────────────────────────────────────────────────────────────
  const submitProject = () => {
    if (!projForm.name.trim() || !projForm.targetAmount) return;
    const item = {
      ...projForm,
      id: editProjId || uid(),
      targetAmount: parseFloat(projForm.targetAmount),
      savedAmount:  parseFloat(projForm.savedAmount) || 0,
      createdAt: today(),
    };
    if (editProjId) setProjects(prev => prev.map(p => p.id === editProjId ? item : p));
    else setProjects(prev => [item, ...prev]);
    setProjForm(emptyProj); setShowProjF(false); setEditProjId(null);
  };

  const deleteProject = id => window.confirm("Supprimer ce projet ?") && setProjects(prev => prev.filter(p => p.id !== id));

  const startEditProject = p => { setProjForm({...p, targetAmount:String(p.targetAmount), savedAmount:String(p.savedAmount)}); setEditProjId(p.id); setShowProjF(true); };

  const allocateToProject = () => {
    const { id, amount } = projAllocForm;
    const amt = parseFloat(amount);
    if (!id || !amt || amt <= 0) return;
    setProjects(prev => prev.map(p => p.id === id ? { ...p, savedAmount: (p.savedAmount||0) + amt } : p));
    setProjAllocForm({ id:"", amount:"" });
  };

  // ─────────────────────────────────────────────────────────────────────────
  // IMPORT CSV
  // ─────────────────────────────────────────────────────────────────────────
  const handleImport = e => {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const parsed = parseCSV(ev.target.result);
      if (!parsed.length) { setImportMsg("❌ Aucune ligne importée."); return; }
      setTransactions(prev => {
        const ids = new Set(prev.map(t => t.date + t.amount + t.description));
        const news = parsed.filter(t => !ids.has(t.date + t.amount + t.description));
        setImportMsg(`✅ ${news.length} transaction(s) importée(s).`);
        return [...news, ...prev];
      });
    };
    reader.readAsText(file, "utf-8");
    e.target.value = "";
  };

  // ─────────────────────────────────────────────────────────────────────────
  // NAVIGATEUR MOIS
  // ─────────────────────────────────────────────────────────────────────────
  const NavMois = () => (
    <div style={{ display:"flex", alignItems:"center", gap:8, padding:"8px 14px" }}>
      <button onClick={() => { let m=filterMonth-1, y=filterYear; if(m<0){m=11;y--;} setFilterMonth(m);setFilterYear(y); }}
        style={{ background:"none", border:`1px solid ${T.border}`, borderRadius:8, padding:"4px 10px", cursor:"pointer", fontSize:14, color:T.muted }}>‹</button>
      <div style={{ flex:1, textAlign:"center", fontWeight:700, fontSize:15, color:T.primary }}>
        {MONTHS_FR[filterMonth]} {filterYear}
      </div>
      <button onClick={() => { let m=filterMonth+1, y=filterYear; if(m>11){m=0;y++;} setFilterMonth(m);setFilterYear(y); }}
        style={{ background:"none", border:`1px solid ${T.border}`, borderRadius:8, padding:"4px 10px", cursor:"pointer", fontSize:14, color:T.muted }}>›</button>
    </div>
  );

  const Nav = ({ icon, label, target }) => (
    <button style={S.navB(view === target)} onClick={() => setView(target)}>
      <span style={{ fontSize:17, lineHeight:1 }}>{icon}</span>{label}
    </button>
  );

  if (!loaded) return (
    <div style={{ minHeight:"100vh", background:T.bg, display:"flex", alignItems:"center", justifyContent:"center", fontFamily:T.font }}>
      <div style={{ textAlign:"center" }}><PrismLogo size={52}/><div style={{ marginTop:12, color:T.muted, fontSize:13 }}>Chargement…</div></div>
    </div>
  );

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight:"100vh", background:T.bg, color:T.text, fontFamily:T.font, maxWidth:480, margin:"0 auto", paddingBottom:80 }}>

      {/* ════ HEADER ════ */}
      <div style={{ background:T.header, padding:"12px 16px", display:"flex", alignItems:"center", justifyContent:"space-between", position:"sticky", top:0, zIndex:200 }}>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <PrismLogo size={30}/>
          <div>
            <div style={{ fontSize:15, fontWeight:800, color:"#fff", letterSpacing:.2, lineHeight:1.2 }}>Prism</div>
            <div style={{ fontSize:9, color:"rgba(255,255,255,0.35)", letterSpacing:1.5, textTransform:"uppercase" }}>Finance</div>
          </div>
        </div>
        <button onClick={() => setView("add")}
          style={{ background:T.accent, border:"none", borderRadius:10, padding:"7px 16px", color:"#fff", fontWeight:800, fontSize:14, cursor:"pointer" }}>
          + Ajouter
        </button>
      </div>

      {/* ════ DASHBOARD ════ */}
      {view === "dashboard" && (<>
        <NavMois/>
        {/* Bilan */}
        <div style={{ background:`linear-gradient(135deg,${T.header},#1a4a7a)`, borderRadius:16, padding:"18px 16px", margin:"10px 14px" }}>
          <div style={{ ...S.sec, color:"rgba(255,255,255,0.4)", marginBottom:14 }}>BILAN — {MONTHS_FR[filterMonth]} {filterYear}</div>
          <div style={{ display:"flex", justifyContent:"space-around", marginBottom:14 }}>
            {[["Revenus", totals.income, T.accent],["Dépenses", totals.expense,"#F87C52"],["Balance", totals.income-totals.expense, totals.income-totals.expense>=0?T.accent:"#F87C52"]].map(([l,v,c]) => (
              <div key={l} style={{ textAlign:"center" }}>
                <div style={{ fontSize:10, color:"rgba(255,255,255,0.45)", marginBottom:4 }}>{l.toUpperCase()}</div>
                <div style={{ fontSize:18, fontWeight:800, color:c }}>{fmt(v)}</div>
              </div>
            ))}
          </div>
          {totals.income > 0 && (
            <div>
              <div style={{ display:"flex", justifyContent:"space-between", fontSize:10, color:"rgba(255,255,255,0.4)", marginBottom:4 }}>
                <span>Dépenses / Revenus</span>
                <span>{Math.round(totals.expense/totals.income*100)}%</span>
              </div>
              <Bar pct={totals.income>0?totals.expense/totals.income*100:0} color={totals.expense/totals.income>.9?"#F87C52":T.accent}/>
            </div>
          )}
        </div>

        {/* Top catégories */}
        {catStats.length > 0 && (
          <div style={S.card}>
            <div style={{ ...S.sec, marginBottom:10 }}>Top dépenses</div>
            {catStats.slice(0, 4).map(([cat, amt]) => (
              <div key={cat} style={{ marginBottom:8 }}>
                <div style={{ display:"flex", justifyContent:"space-between", fontSize:13, marginBottom:2 }}>
                  <span>{cat}</span><span style={{ fontWeight:700, color:T.expense }}>{fmt(amt)}</span>
                </div>
                <Bar pct={totals.expense>0?amt/totals.expense*100:0} color={T.accent}/>
              </div>
            ))}
          </div>
        )}

        {/* Projets en cours */}
        {projects.filter(p => p.savedAmount < p.targetAmount).length > 0 && (
          <div style={S.card}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
              <span style={S.sec}>Projets d'épargne</span>
              <button onClick={() => { setView("manage"); setManageTab("projets"); }} style={{ ...S.smBtn(T.project), fontSize:10 }}>Voir tout</button>
            </div>
            {projects.filter(p => p.savedAmount < p.targetAmount).slice(0, 2).map(p => {
              const pct = p.targetAmount > 0 ? (p.savedAmount / p.targetAmount) * 100 : 0;
              const days = p.deadline ? daysUntil(p.deadline) : null;
              return (
                <div key={p.id} style={{ marginBottom:10 }}>
                  <div style={{ display:"flex", justifyContent:"space-between", fontSize:13, marginBottom:2 }}>
                    <span style={{ fontWeight:700 }}>{p.emoji} {p.name}</span>
                    <span style={{ color:T.project, fontWeight:700 }}>{fmt(p.savedAmount)} / {fmt(p.targetAmount)}</span>
                  </div>
                  {days !== null && (
                    <div style={{ fontSize:10, color:days<30?T.expense:T.muted, marginBottom:3 }}>
                      {days > 0 ? `⏱ ${days} jour(s) restant(s)` : "⚠️ Échéance dépassée"}
                    </div>
                  )}
                  <Bar pct={pct} color={T.project}/>
                  <div style={{ fontSize:10, color:T.muted, textAlign:"right", marginTop:2 }}>{pct.toFixed(0)}%</div>
                </div>
              );
            })}
          </div>
        )}

        {/* Évolution mensuelle */}
        {monthlyEvol.length > 1 && (
          <div style={S.card}>
            <div style={{ ...S.sec, marginBottom:10 }}>Évolution (6 mois)</div>
            {monthlyEvol.map((m, i) => (
              <div key={i} style={{ marginBottom:8 }}>
                <div style={{ display:"flex", justifyContent:"space-between", fontSize:11, marginBottom:2 }}>
                  <span style={{ color:T.muted }}>{m.label}</span>
                  <span style={{ fontWeight:700, color: m.income-m.expense>=0?T.income:T.expense }}>{fmt(m.income-m.expense)}</span>
                </div>
                <div style={{ display:"flex", gap:4, height:5, borderRadius:3, overflow:"hidden" }}>
                  <div style={{ flex:m.income||0, background:T.income, borderRadius:3 }}/>
                  <div style={{ flex:m.expense||0, background:T.expense, borderRadius:3 }}/>
                </div>
              </div>
            ))}
          </div>
        )}

        {filteredTx.length === 0 && (
          <div style={{ ...S.card, textAlign:"center", color:T.muted, padding:"28px 16px", fontSize:13 }}>
            Aucune transaction ce mois.<br/>Appuyez sur <strong>+ Ajouter</strong> pour commencer.
          </div>
        )}
      </>)}

      {/* ════ TRANSACTIONS ════ */}
      {view === "transactions" && (<>
        <NavMois/>
        <div style={{ padding:"0 14px 6px", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <span style={S.sec}>{filteredTx.length} mouvement(s)</span>
          <button onClick={() => exportCSV(transactions)} style={S.smBtn(T.primary)}>⬇ CSV</button>
        </div>
        {filteredTx.length === 0
          ? <div style={{ ...S.card, textAlign:"center", color:T.muted, padding:"28px 16px", fontSize:13 }}>Aucune transaction ce mois.</div>
          : filteredTx.map((t, i, arr) => (
            <div key={t.id} style={{ ...S.card, padding:"10px 14px" }}>
              <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                <div style={{ width:36, height:36, borderRadius:10, background: t.type==="income"?T.incomeLight:T.expenseLight,
                  display:"flex", alignItems:"center", justifyContent:"center", fontSize:16, flexShrink:0 }}>
                  {t.type==="income" ? "↑" : "↓"}
                </div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:13, fontWeight:600, overflow:"hidden", whiteSpace:"nowrap", textOverflow:"ellipsis" }}>
                    {t.description || t.category}
                  </div>
                  <div style={{ fontSize:10, color:T.muted }}>
                    {fmtD(t.date)} · {t.category}{t.isRecurring ? " · 🔁" : ""}
                  </div>
                </div>
                <div style={{ textAlign:"right", flexShrink:0 }}>
                  <div style={{ fontSize:14, fontWeight:700, color:t.type==="income"?T.income:T.expense }}>
                    {t.type==="income"?"+":"-"}{fmt(t.amount)}
                  </div>
                  <button onClick={() => deleteTx(t.id)} style={{ background:"none", border:"none", color:T.muted, cursor:"pointer", fontSize:12, padding:0 }}>🗑</button>
                </div>
              </div>
            </div>
          ))
        }
      </>)}

      {/* ════ AJOUTER ════ */}
      {view === "add" && (
        <div style={{ padding:"16px 14px" }}>
          <div style={{ fontSize:18, fontWeight:800, marginBottom:14, marginTop:4 }}>Nouvelle transaction</div>
          {/* Type toggle */}
          <div style={{ ...S.tog, marginBottom:12 }}>
            <button style={S.tab(form.type==="expense")} onClick={() => setForm(f=>({...f,type:"expense",category:"Alimentation"}))}>💸 Dépense</button>
            <button style={S.tab(form.type==="income")}  onClick={() => setForm(f=>({...f,type:"income",category:"Salaire"}))}>💰 Revenu</button>
          </div>
          <label style={S.lbl}>Date</label>
          <input type="date" value={form.date} onChange={e=>setForm(f=>({...f,date:e.target.value}))} style={S.inp}/>
          <label style={S.lbl}>Montant (€)</label>
          <input type="number" min="0" step="0.01" placeholder="0,00" value={form.amount} onChange={e=>setForm(f=>({...f,amount:e.target.value}))} style={S.inp}/>
          <label style={S.lbl}>Catégorie</label>
          <select value={form.category} onChange={e=>setForm(f=>({...f,category:e.target.value}))} style={S.sel}>
            {(categories[form.type]||[]).map(c => <option key={c}>{c}</option>)}
          </select>
          <label style={S.lbl}>Description (optionnel)</label>
          <input placeholder="Ex : Courses Carrefour" value={form.description} onChange={e=>setForm(f=>({...f,description:e.target.value}))} style={S.inp}/>
          {formErr && <div style={{ color:T.expense, fontSize:12, marginBottom:8, padding:"6px 10px", background:T.expenseLight, borderRadius:8 }}>{formErr}</div>}
          {saveMsg && <div style={{ color:T.income, fontSize:12, marginBottom:8, padding:"6px 10px", background:T.incomeLight, borderRadius:8 }}>{saveMsg}</div>}
          <button style={S.btn(T.accent)} onClick={submitTx}>✅ Enregistrer</button>
        </div>
      )}

      {/* ════ PROJECTION ════ */}
      {view === "projection" && projection && (<>
        <div style={{ padding:"16px 14px 8px" }}>
          <div style={{ fontSize:18, fontWeight:800, marginBottom:4 }}>📈 Projection financière</div>
          <div style={{ fontSize:12, color:T.muted, marginBottom:12, lineHeight:1.5 }}>
            Basée sur vos récurrences actives + la moyenne mensuelle des 6 derniers mois.
            Objectif : vision tendancielle, non précise au jour.
          </div>

          {/* Horizon */}
          <div style={{ display:"flex", gap:6, marginBottom:12 }}>
            {[7, 13, 25].map(n => (
              <button key={n} onClick={() => setProjNbMonths(n)}
                style={{ flex:1, padding:"7px 4px", borderRadius:8, border:`1px solid ${projNbMonths===n?T.accent:T.border}`,
                  background:projNbMonths===n?T.accentLight:T.bg, color:projNbMonths===n?T.accent:T.muted,
                  fontSize:12, fontWeight:projNbMonths===n?700:400, cursor:"pointer", fontFamily:T.font }}>
                {n===7?"6 mois":n===13?"12 mois":"24 mois"}
              </button>
            ))}
          </div>

          {/* Résumé moteur */}
          <div style={{ ...S.cf("0 0 12px"), background:T.accentLight, border:`1px solid ${T.accent}33` }}>
            <div style={{ ...S.sec, marginBottom:8, color:T.accentDark }}>Hypothèses</div>
            <div style={{ fontSize:12, color:T.text, display:"flex", flexDirection:"column", gap:5 }}>
              <div style={{ display:"flex", justifyContent:"space-between" }}>
                <span>Revenu mensuel estimé</span>
                <strong>{fmt(projection.months[0]?.income || 0)}</strong>
              </div>
              <div style={{ display:"flex", justifyContent:"space-between" }}>
                <span>Dépenses estimées</span>
                <strong style={{ color:T.expense }}>{fmt(projection.months[0]?.expense || 0)}</strong>
              </div>
              <div style={{ display:"flex", justifyContent:"space-between" }}>
                <span>Balance mensuelle</span>
                <strong style={{ color:projection.months[0]?.balance >= 0 ? T.income : T.expense }}>
                  {fmt(projection.months[0]?.balance || 0)}
                </strong>
              </div>
            </div>
            <button onClick={() => setProjShowCats(!projShowCats)}
              style={{ background:"none", border:"none", color:T.accentDark, fontSize:11, cursor:"pointer", padding:"4px 0 0", fontFamily:T.font }}>
              {projShowCats?"▾ Masquer":"▸ Détail par catégorie"}
            </button>
            {projShowCats && (
              <div style={{ marginTop:8 }}>
                {Object.entries(projection.months[0]?.catBreakdown || {}).sort((a,b)=>b[1]-a[1]).map(([cat,amt]) => (
                  <div key={cat} style={{ display:"flex", justifyContent:"space-between", fontSize:11, padding:"3px 0", borderBottom:`1px solid ${T.border}` }}>
                    <span style={{ color:T.muted }}>{cat}</span>
                    <span style={{ fontWeight:600 }}>{fmt(amt)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Tableau mois par mois */}
        <div style={{ padding:"0 14px 10px" }}>
          <div style={{ ...S.sec, marginBottom:8 }}>Mois par mois</div>
          {projection.months.map((m, i) => (
            <div key={i} style={{ ...S.cf("0 0 8px"), border:`1px solid ${m.balance >= 0 ? T.border : T.expenseLight}`,
              background: i === 0 ? `${T.accent}10` : T.surface }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:6 }}>
                <div>
                  <span style={{ fontSize:13, fontWeight:800, color:T.primary }}>{m.label}</span>
                  {i === 0 && <span style={{ fontSize:10, color:T.accent, marginLeft:6, fontWeight:700 }}>Mois courant</span>}
                </div>
                <div style={{ textAlign:"right" }}>
                  <div style={{ fontSize:14, fontWeight:800, color: m.balance >= 0 ? T.income : T.expense }}>
                    {m.balance >= 0 ? "+" : ""}{fmt(m.balance)}
                  </div>
                  <div style={{ fontSize:10, color:T.muted }}>Cumul : {fmt(m.cumulBalance)}</div>
                </div>
              </div>
              <div style={{ display:"flex", gap:8 }}>
                <div style={{ flex:1, textAlign:"center", background:T.incomeLight, borderRadius:8, padding:"5px 4px" }}>
                  <div style={{ fontSize:9, color:T.income, fontWeight:700 }}>REVENUS</div>
                  <div style={{ fontSize:12, fontWeight:800, color:T.income }}>{fmt(m.income)}</div>
                </div>
                <div style={{ flex:1, textAlign:"center", background:T.expenseLight, borderRadius:8, padding:"5px 4px" }}>
                  <div style={{ fontSize:9, color:T.expense, fontWeight:700 }}>DÉPENSES</div>
                  <div style={{ fontSize:12, fontWeight:800, color:T.expense }}>{fmt(m.expense)}</div>
                </div>
              </div>

              {/* Projets qui pourraient être financés ce mois */}
              {projects.filter(p => p.savedAmount < p.targetAmount).map(p => {
                const needed = p.targetAmount - p.savedAmount;
                // Épargne cumulée disponible jusqu'à ce mois (balance positive cumulée)
                const savable = projection.months.slice(0, i+1).reduce((s, mm) => s + Math.max(mm.balance, 0), 0);
                const canFund = savable >= needed;
                const isMilestone = canFund && (i === 0 || projection.months.slice(0, i).reduce((s,mm)=>s+Math.max(mm.balance,0),0) < needed);
                if (!isMilestone) return null;
                return (
                  <div key={p.id} style={{ marginTop:6, background:T.projectLight, borderRadius:8, padding:"6px 10px", fontSize:11, color:T.project, fontWeight:700 }}>
                    🎯 {p.emoji} {p.name} financé ({fmt(p.targetAmount)})
                  </div>
                );
              })}
            </div>
          ))}
        </div>

        {/* Projets & timeline */}
        {projects.length > 0 && (
          <div style={{ padding:"0 14px 10px" }}>
            <div style={{ ...S.sec, marginBottom:8, color:T.project }}>Objectifs d'épargne</div>
            {projects.map(p => {
              const needed = p.targetAmount - p.savedAmount;
              // Mois où le projet sera financé via la projection
              let fundMonth = null;
              let cumSave = 0;
              for (let i = 0; i < projection.months.length; i++) {
                cumSave += Math.max(projection.months[i].balance, 0);
                if (cumSave >= needed) { fundMonth = projection.months[i]; break; }
              }
              const pct = p.targetAmount > 0 ? Math.min((p.savedAmount / p.targetAmount) * 100, 100) : 0;
              const days = p.deadline ? daysUntil(p.deadline) : null;
              return (
                <div key={p.id} style={{ ...S.cf("0 0 8px"), border:`1px solid ${T.project}44` }}>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:6 }}>
                    <div style={{ fontSize:14, fontWeight:800 }}>{p.emoji} {p.name}</div>
                    <div style={{ fontSize:13, fontWeight:700, color:T.project }}>{fmt(p.savedAmount)} / {fmt(p.targetAmount)}</div>
                  </div>
                  {p.note && <div style={{ fontSize:11, color:T.muted, fontStyle:"italic", marginBottom:6 }}>{p.note}</div>}
                  <Bar pct={pct} color={T.project} h={7}/>
                  <div style={{ display:"flex", justifyContent:"space-between", marginTop:5, fontSize:10 }}>
                    <span style={{ color:T.muted }}>{pct.toFixed(0)}%</span>
                    {days !== null && <span style={{ color:days<30?T.expense:T.muted }}>Échéance : {fmtD(p.deadline)}</span>}
                  </div>
                  {fundMonth && p.savedAmount < p.targetAmount && (
                    <div style={{ marginTop:8, background:T.projectLight, borderRadius:8, padding:"6px 10px", fontSize:11, color:T.project }}>
                      📅 Finançable en <strong>{fundMonth.label}</strong> selon la projection
                    </div>
                  )}
                  {p.savedAmount >= p.targetAmount && (
                    <div style={{ marginTop:8, background:T.incomeLight, borderRadius:8, padding:"6px 10px", fontSize:11, color:T.income, fontWeight:700 }}>
                      🎉 Objectif atteint !
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </>)}

      {/* ════ GÉRER ════ */}
      {view === "manage" && (
        <div style={{ padding:"16px 14px" }}>
          <div style={{ fontSize:18, fontWeight:800, marginBottom:14, marginTop:4 }}>Gérer</div>
          <div style={{ display:"flex", gap:4, overflowX:"auto", marginBottom:14, scrollbarWidth:"none" }}>
            {[["recurring","🔁 Récurrences"],["categories","🏷 Catégories"],["projets","🎯 Projets"],["import","📥 Import"]].map(([k,l]) => (
              <button key={k} onClick={() => setManageTab(k)}
                style={{ padding:"7px 12px", borderRadius:20, border:`1px solid ${manageTab===k?T.accent:T.border}`,
                  background:manageTab===k?T.accent:T.bg, color:manageTab===k?"#fff":T.muted,
                  fontSize:12, fontWeight:manageTab===k?700:400, cursor:"pointer", whiteSpace:"nowrap", fontFamily:T.font, flexShrink:0 }}>
                {l}
              </button>
            ))}
          </div>

          {/* ─── RÉCURRENCES ─── */}
          {manageTab === "recurring" && (<>
            <button onClick={() => { setRecurForm(emptyR); setEditRecurId(null); setShowRecurF(!showRecurF); }}
              style={S.btn(showRecurF?T.muted:T.primary)}>
              {showRecurF?"✕ Annuler":"+ Nouvelle récurrence"}
            </button>
            {showRecurF && (
              <div style={{ ...S.cf("0 0 12px"), border:`1.5px solid ${T.accent}` }}>
                <div style={{ fontSize:13, fontWeight:800, marginBottom:12 }}>{editRecurId?"Modifier":"Nouvelle récurrence"}</div>
                <div style={{ display:"flex", gap:8 }}>
                  <div style={{ flex:1 }}>
                    <label style={S.lbl}>Type</label>
                    <select value={recurForm.type} onChange={e=>setRecurForm(f=>({...f,type:e.target.value,category:e.target.value==="income"?"Salaire":"Logement"}))} style={S.sel}>
                      <option value="expense">Dépense</option><option value="income">Revenu</option>
                    </select>
                  </div>
                  <div style={{ flex:2 }}>
                    <label style={S.lbl}>Nom</label>
                    <input placeholder="Ex : Loyer" value={recurForm.name} onChange={e=>setRecurForm(f=>({...f,name:e.target.value}))} style={S.inp}/>
                  </div>
                </div>
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
                  <div><label style={S.lbl}>Montant (€)</label><input type="number" min="0" step="0.01" value={recurForm.amount} onChange={e=>setRecurForm(f=>({...f,amount:e.target.value}))} style={{ ...S.inp, marginBottom:0 }}/></div>
                  <div><label style={S.lbl}>Jour du mois</label><input type="number" min="1" max="28" value={recurForm.day} onChange={e=>setRecurForm(f=>({...f,day:e.target.value}))} style={{ ...S.inp, marginBottom:0 }}/></div>
                </div>
                <div style={{ marginTop:9 }}>
                  <label style={S.lbl}>Catégorie</label>
                  <select value={recurForm.category} onChange={e=>setRecurForm(f=>({...f,category:e.target.value}))} style={S.sel}>
                    {(categories[recurForm.type]||[]).map(c=><option key={c}>{c}</option>)}
                  </select>
                </div>
                <label style={S.lbl}>Début</label>
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom:9 }}>
                  <select value={recurForm.startMonth} onChange={e=>setRecurForm(f=>({...f,startMonth:parseInt(e.target.value)}))} style={{ ...S.sel, marginBottom:0 }}>
                    {MONTHS_FR.map((m,i)=><option key={i} value={i}>{m}</option>)}
                  </select>
                  <input type="number" min="2020" max="2040" value={recurForm.startYear} onChange={e=>setRecurForm(f=>({...f,startYear:parseInt(e.target.value)}))} style={{ ...S.inp, marginBottom:0 }}/>
                </div>
                <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:9 }}>
                  <input type="checkbox" checked={recurForm.hasEnd} onChange={e=>setRecurForm(f=>({...f,hasEnd:e.target.checked}))} id="hasEnd"/>
                  <label htmlFor="hasEnd" style={{ fontSize:13, color:T.text, cursor:"pointer" }}>Définir une date de fin</label>
                </div>
                {recurForm.hasEnd && (<>
                  <label style={S.lbl}>Fin</label>
                  <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom:9 }}>
                    <select value={recurForm.endMonth} onChange={e=>setRecurForm(f=>({...f,endMonth:parseInt(e.target.value)}))} style={{ ...S.sel, marginBottom:0 }}>
                      {MONTHS_FR.map((m,i)=><option key={i} value={i}>{m}</option>)}
                    </select>
                    <input type="number" min="2020" max="2040" value={recurForm.endYear} onChange={e=>setRecurForm(f=>({...f,endYear:parseInt(e.target.value)}))} style={{ ...S.inp, marginBottom:0 }}/>
                  </div>
                </>)}
                <button style={S.btn(T.accent)} onClick={submitRecur} disabled={!recurForm.name.trim()||!recurForm.amount}>
                  ✅ {editRecurId?"Mettre à jour":"Enregistrer"}
                </button>
              </div>
            )}
            {recurring.length === 0
              ? <div style={{ ...S.card, textAlign:"center", color:T.muted, padding:"28px 16px", fontSize:13 }}>Aucune récurrence.</div>
              : recurring.map(r => (
                <div key={r.id} style={S.card}>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:13, fontWeight:700 }}>{r.name}</div>
                      <div style={{ fontSize:11, color:T.muted }}>{r.category} · Jour {r.day}</div>
                      <div style={{ fontSize:10, color:T.muted }}>{periodLabel(r)}</div>
                    </div>
                    <div style={{ textAlign:"right" }}>
                      <div style={{ fontSize:14, fontWeight:700, color:r.type==="income"?T.income:T.expense, marginBottom:6 }}>
                        {r.type==="income"?"+":"-"}{fmt(r.amount)}
                      </div>
                      <div style={{ display:"flex", gap:5 }}>
                        <button onClick={()=>startEditRecur(r)} style={S.smBtn(T.primary)}>✏️</button>
                        <button onClick={()=>deleteRecur(r.id)} style={S.smBtn(T.expense)}>🗑</button>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            }
          </>)}

          {/* ─── CATÉGORIES ─── */}
          {manageTab === "categories" && (<>
            {["expense","income"].map(type => (
              <div key={type} style={{ marginBottom:14 }}>
                <div style={{ ...S.sec, marginBottom:8 }}>{type==="expense"?"Dépenses":"Revenus"}</div>
                {(categories[type]||[]).map(cat => (
                  <div key={cat} style={{ ...S.card, padding:"8px 12px", margin:"0 0 6px" }}>
                    {editCat===`${type}:${cat}` ? (
                      <div style={{ display:"flex", gap:6 }}>
                        <input value={editCatVal} onChange={e=>setEditCatVal(e.target.value)}
                          onKeyDown={e=>e.key==="Enter"&&renameCategory(type,cat)}
                          autoFocus style={{ ...S.inp, marginBottom:0, flex:1, padding:"6px 10px", fontSize:13 }}/>
                        <button onClick={()=>renameCategory(type,cat)} style={S.smBtn(T.accent)}>✓</button>
                        <button onClick={()=>setEditCat(null)} style={S.smBtn(T.muted)}>✕</button>
                      </div>
                    ) : (
                      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                        <span style={{ fontSize:13 }}>{cat}</span>
                        <div style={{ display:"flex", gap:5 }}>
                          <button onClick={()=>{setEditCat(`${type}:${cat}`);setEditCatVal(cat);}} style={S.smBtn(T.primary)}>✏️</button>
                          <button onClick={()=>deleteCategory(type,cat)} style={S.smBtn(T.expense)}>🗑</button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
                <div style={{ display:"flex", gap:8, marginTop:6 }}>
                  <input placeholder={`Nouvelle catégorie (${type==="expense"?"dépense":"revenu"})`}
                    value={newCatType===type?newCatName:""} 
                    onChange={e=>{setNewCatName(e.target.value);setNewCatType(type);}}
                    onKeyDown={e=>e.key==="Enter"&&newCatType===type&&addCategory()}
                    style={{ ...S.inp, marginBottom:0, flex:1, fontSize:13, padding:"8px 10px" }}/>
                  <button onClick={()=>{setNewCatType(type);addCategory();}} style={{ ...S.smBtn(T.accent), padding:"8px 12px" }}>+</button>
                </div>
              </div>
            ))}
          </>)}

          {/* ─── PROJETS D'ÉPARGNE ─── */}
          {manageTab === "projets" && (<>
            <button onClick={() => { setProjForm(emptyProj); setEditProjId(null); setShowProjF(!showProjF); }}
              style={S.btn(showProjF?T.muted:T.project)}>
              {showProjF?"✕ Annuler":"🎯 Nouveau projet"}
            </button>

            {showProjF && (
              <div style={{ ...S.cf("0 0 12px"), border:`1.5px solid ${T.project}` }}>
                <div style={{ fontSize:13, fontWeight:800, marginBottom:12, color:T.project }}>{editProjId?"Modifier le projet":"Nouveau projet d'épargne"}</div>

                {/* Emoji picker */}
                <label style={S.lbl}>Icône</label>
                <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginBottom:9 }}>
                  {PROJECT_EMOJIS.map(e => (
                    <button key={e} onClick={() => setProjForm(f=>({...f,emoji:e}))}
                      style={{ width:36, height:36, borderRadius:8, border:`2px solid ${projForm.emoji===e?T.project:T.border}`,
                        background:projForm.emoji===e?T.projectLight:T.bg, fontSize:18, cursor:"pointer",
                        display:"flex", alignItems:"center", justifyContent:"center" }}>
                      {e}
                    </button>
                  ))}
                </div>

                <label style={S.lbl}>Nom du projet</label>
                <input placeholder="Ex : Voyage 2026" value={projForm.name} onChange={e=>setProjForm(f=>({...f,name:e.target.value}))} style={S.inp}/>

                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
                  <div>
                    <label style={S.lbl}>Objectif (€)</label>
                    <input type="number" min="0" step="1" placeholder="1000" value={projForm.targetAmount} onChange={e=>setProjForm(f=>({...f,targetAmount:e.target.value}))} style={{ ...S.inp, marginBottom:0 }}/>
                  </div>
                  <div>
                    <label style={S.lbl}>Déjà épargné (€)</label>
                    <input type="number" min="0" step="1" placeholder="0" value={projForm.savedAmount} onChange={e=>setProjForm(f=>({...f,savedAmount:e.target.value}))} style={{ ...S.inp, marginBottom:0 }}/>
                  </div>
                </div>

                <div style={{ marginTop:9 }}>
                  <label style={S.lbl}>Échéance (optionnel)</label>
                  <input type="date" value={projForm.deadline} onChange={e=>setProjForm(f=>({...f,deadline:e.target.value}))} style={S.inp}/>
                </div>

                <label style={S.lbl}>Note (optionnel)</label>
                <input placeholder="Ex : Hôtel 4 nuits + vols" value={projForm.note} onChange={e=>setProjForm(f=>({...f,note:e.target.value}))} style={S.inp}/>

                <button style={S.btn(T.project)} onClick={submitProject} disabled={!projForm.name.trim()||!projForm.targetAmount}>
                  ✅ {editProjId?"Mettre à jour":"Créer le projet"}
                </button>
              </div>
            )}

            {/* Allouer de l'épargne */}
            {projects.length > 0 && (
              <div style={{ ...S.cf("0 0 12px"), background:T.projectLight, border:`1px solid ${T.project}33` }}>
                <div style={{ ...S.sec, marginBottom:8, color:T.project }}>Allouer une épargne</div>
                <select value={projAllocForm.id} onChange={e=>setProjAllocForm(f=>({...f,id:e.target.value}))} style={{ ...S.sel, marginBottom:9 }}>
                  <option value="">— Choisir un projet —</option>
                  {projects.filter(p=>p.savedAmount<p.targetAmount).map(p=>(
                    <option key={p.id} value={p.id}>{p.emoji} {p.name} ({fmt(p.targetAmount - p.savedAmount)} restants)</option>
                  ))}
                </select>
                <div style={{ display:"flex", gap:8 }}>
                  <input type="number" min="0" step="0.01" placeholder="Montant (€)" value={projAllocForm.amount}
                    onChange={e=>setProjAllocForm(f=>({...f,amount:e.target.value}))}
                    style={{ ...S.inp, marginBottom:0, flex:1 }}/>
                  <button onClick={allocateToProject} disabled={!projAllocForm.id||!projAllocForm.amount}
                    style={{ ...S.smBtn(T.project), padding:"9px 14px", fontSize:13, opacity:(!projAllocForm.id||!projAllocForm.amount)?.5:1 }}>
                    Allouer
                  </button>
                </div>
              </div>
            )}

            {/* Liste des projets */}
            {projects.length === 0
              ? <div style={{ ...S.card, textAlign:"center", color:T.muted, padding:"28px 16px", fontSize:13 }}>
                  Aucun projet. Créez votre premier objectif d'épargne !
                </div>
              : projects.map(p => {
                  const pct = p.targetAmount > 0 ? Math.min((p.savedAmount / p.targetAmount) * 100, 100) : 0;
                  const days = p.deadline ? daysUntil(p.deadline) : null;
                  const done = p.savedAmount >= p.targetAmount;
                  return (
                    <div key={p.id} style={{ ...S.card, border:`1px solid ${done?T.income:T.project}44`, opacity:done?.85:1 }}>
                      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:8 }}>
                        <div>
                          <div style={{ fontSize:20, marginBottom:2 }}>{p.emoji}</div>
                          <div style={{ fontSize:14, fontWeight:800 }}>{p.name}</div>
                          {p.note && <div style={{ fontSize:11, color:T.muted, fontStyle:"italic" }}>{p.note}</div>}
                        </div>
                        <div style={{ display:"flex", gap:5 }}>
                          <button onClick={()=>startEditProject(p)} style={S.smBtn(T.primary)}>✏️</button>
                          <button onClick={()=>deleteProject(p.id)} style={S.smBtn(T.expense)}>🗑</button>
                        </div>
                      </div>
                      <div style={{ display:"flex", justifyContent:"space-between", fontSize:13, marginBottom:4 }}>
                        <span style={{ color:T.muted }}>Épargne</span>
                        <span style={{ fontWeight:800, color:done?T.income:T.project }}>{fmt(p.savedAmount)} / {fmt(p.targetAmount)}</span>
                      </div>
                      <Bar pct={pct} color={done?T.income:T.project} h={8}/>
                      <div style={{ display:"flex", justifyContent:"space-between", fontSize:10, marginTop:4 }}>
                        <span style={{ color:T.muted }}>{pct.toFixed(0)}%</span>
                        {done ? (
                          <span style={{ color:T.income, fontWeight:700 }}>🎉 Objectif atteint !</span>
                        ) : (
                          <span style={{ color:T.muted }}>{fmt(p.targetAmount - p.savedAmount)} restants</span>
                        )}
                      </div>
                      {days !== null && !done && (
                        <div style={{ marginTop:6, fontSize:11, color:days<30?T.expense:T.muted,
                          background:days<30?T.expenseLight:T.bg, padding:"4px 8px", borderRadius:6 }}>
                          ⏱ Échéance : {fmtD(p.deadline)}
                          {days >= 0 ? ` (dans ${days} jour${days>1?"s":""})` : " — Dépassée !"}
                        </div>
                      )}
                    </div>
                  );
                })
            }
          </>)}

          {/* ─── IMPORT CSV ─── */}
          {manageTab === "import" && (
            <div>
              <div style={{ fontSize:13, color:T.muted, marginBottom:12, lineHeight:1.6 }}>
                Importez un fichier CSV exporté depuis Prism Finance.<br/>
                Format accepté : <strong>Date;Type;Catégorie;Description;Montant (€);Récurrent</strong><br/>
                Séparateur <code>;</code> ou <code>,</code> · Date DD/MM/YYYY ou YYYY-MM-DD.
              </div>
              <input type="file" accept=".csv,.txt" ref={fileRef} onChange={handleImport} style={{ display:"none" }}/>
              <button style={S.btn(T.primary)} onClick={() => fileRef.current?.click()}>📂 Importer un fichier CSV</button>
              {importMsg && (
                <div style={{ padding:"10px 14px", borderRadius:10, fontSize:13, marginBottom:10,
                  background: importMsg.startsWith("✅")?T.incomeLight:T.expenseLight,
                  color: importMsg.startsWith("✅")?T.income:T.expense }}>
                  {importMsg}
                </div>
              )}
              <div style={{ borderTop:`1px solid ${T.border}`, paddingTop:12, marginTop:4 }}>
                <div style={{ ...S.sec, marginBottom:8 }}>Exporter</div>
                <button style={S.btn(T.accent)} onClick={() => exportCSV(transactions)}>
                  ⬇ Exporter toutes les transactions (CSV)
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ════ BOTTOM NAV ════ */}
      <div style={S.nav}>
        <Nav icon="🏠" label="Accueil"   target="dashboard"/>
        <Nav icon="📋" label="Mouvements" target="transactions"/>
        <Nav icon="📈" label="Projection" target="projection"/>
        <Nav icon="⚙️" label="Gérer"     target="manage"/>
      </div>
    </div>
  );
}
