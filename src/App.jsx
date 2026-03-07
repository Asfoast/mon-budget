import { useState, useEffect, useMemo, useRef } from "react";

// ─────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────
const INITIAL_CATEGORIES = {
  income:  ["Salaire","Freelance","Investissement","Cadeau","Remboursement","Autre"],
  expense: ["Logement","Alimentation","Transport","Santé","Loisirs","Vêtements","Abonnements","Épargne","Autre"],
};
const MONTHS_FR = ["Janvier","Février","Mars","Avril","Mai","Juin","Juillet","Août","Septembre","Octobre","Novembre","Décembre"];

// ─────────────────────────────────────────────────────────────
// THEME — Clarté · Marine & Menthe (écosystème Prism)
// ─────────────────────────────────────────────────────────────
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
  text:         "#0A1929",
  muted:        "#607080",
  border:       "#D8E4EC",
  font:         "'Segoe UI','Helvetica Neue',Helvetica,sans-serif",
};

// ─────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────
const fmt  = n => new Intl.NumberFormat("fr-FR", { style:"currency", currency:"EUR" }).format(n || 0);
const fmtD = d => { try { return new Date(d + "T00:00:00").toLocaleDateString("fr-FR"); } catch { return d || ""; } };
const today = () => new Date().toISOString().split("T")[0];
const mKey  = (y, m) => `${y}-${String(m + 1).padStart(2, "0")}`;

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

// ─────────────────────────────────────────────────────────────
// LOGO PRISM
// ─────────────────────────────────────────────────────────────
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

// ─────────────────────────────────────────────────────────────
// MAIN APP
// ─────────────────────────────────────────────────────────────
export default function PrismFinance() {

  // ── Core state ────────────────────────────────────────────
  const [transactions,    setTransactions]    = useState([]);
  const [recurring,       setRecurring]       = useState([]);
  const [categories,      setCategories]      = useState(INITIAL_CATEGORIES);
  const [generatedMonths, setGeneratedMonths] = useState([]);
  const [loaded,          setLoaded]          = useState(false);

  // ── UI state ──────────────────────────────────────────────
  const [view,        setView]        = useState("dashboard");
  const [manageTab,   setManageTab]   = useState("recurring");
  const [filterMonth, setFilterMonth] = useState(new Date().getMonth());
  const [filterYear,  setFilterYear]  = useState(new Date().getFullYear());

  // ── Transaction form ──────────────────────────────────────
  const [form,    setForm]    = useState({ type:"expense", amount:"", description:"", category:"Alimentation", date:today() });
  const [formErr, setFormErr] = useState("");
  const [saveMsg, setSaveMsg] = useState("");

  // ── Recurring form ────────────────────────────────────────
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

  // ── Category form ─────────────────────────────────────────
  const [newCatName, setNewCatName] = useState("");
  const [newCatType, setNewCatType] = useState("expense");
  const [editCat,    setEditCat]    = useState(null);
  const [editCatVal, setEditCatVal] = useState("");

  // ── Import ────────────────────────────────────────────────
  const [importMsg, setImportMsg] = useState(null);
  const fileRef = useRef(null);

  // ─────────────────────────────────────────────────────────
  // LOCALSTORAGE — avec migration automatique des anciennes clés
  // ─────────────────────────────────────────────────────────
  useEffect(() => {
    const g = k => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : null; } catch { return null; } };

    // ── Migration : toutes les versions précédentes → clés actuelles ──
    // Format : [ancienne clé, nouvelle clé]
    const migrations = [
      // v1 : clés budget_*
      ["budget_transactions",    "prism_tx"],
      ["budget_recurring",       "prism_recur"],
      ["budget_categories",      "prism_cats"],
      ["budget_generated_months","prism_genmonths"],
      // v2 : clés budget_custom_categories (version intermédiaire)
      ["budget_custom_categories","prism_cats"],
    ];

    if (!localStorage.getItem("prism_finance_migrated_v1")) {
      migrations.forEach(([oldKey, newKey]) => {
        const oldData = localStorage.getItem(oldKey);
        if (oldData && !localStorage.getItem(newKey)) {
          localStorage.setItem(newKey, oldData);
        }
      });
      localStorage.setItem("prism_finance_migrated_v1", "1");
    }
    // ─────────────────────────────────────────────────────────

    setTransactions(   g("prism_tx")         || []);
    setRecurring(      g("prism_recur")      || []);
    setCategories(     g("prism_cats")       || INITIAL_CATEGORIES);
    setGeneratedMonths(g("prism_genmonths")  || []);
    setLoaded(true);
  }, []);

  useEffect(() => { if (loaded) localStorage.setItem("prism_tx",        JSON.stringify(transactions));    }, [transactions,    loaded]);
  useEffect(() => { if (loaded) localStorage.setItem("prism_recur",     JSON.stringify(recurring));       }, [recurring,       loaded]);
  useEffect(() => { if (loaded) localStorage.setItem("prism_cats",      JSON.stringify(categories));      }, [categories,      loaded]);
  useEffect(() => { if (loaded) localStorage.setItem("prism_genmonths", JSON.stringify(generatedMonths)); }, [generatedMonths, loaded]);

  // ─────────────────────────────────────────────────────────
  // AUTO-GENERATE RECURRING TRANSACTIONS
  // ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!loaded) return;
    const key = mKey(filterYear, filterMonth);
    if (generatedMonths.includes(key)) return;

    const eligible = recurring.filter(r => inPeriod(r, filterYear, filterMonth));
    const newTx = eligible.map(item => {
      const daysInMonth = new Date(filterYear, filterMonth + 1, 0).getDate();
      const day  = Math.min(Math.max(parseInt(item.day) || 1, 1), daysInMonth);
      const date = `${filterYear}-${String(filterMonth + 1).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
      return {
        id:          Date.now() + Math.random(),
        type:        item.type,
        amount:      parseFloat(item.amount) || 0,
        description: item.name,
        category:    item.category,
        date,
        isRecurring: true,
        recurringId: item.id,
      };
    });

    if (newTx.length > 0) setTransactions(prev => [...newTx, ...prev]);
    setGeneratedMonths(prev => [...prev, key]);
  }, [filterMonth, filterYear, loaded, recurring]);

  // ─────────────────────────────────────────────────────────
  // DERIVED DATA
  // ─────────────────────────────────────────────────────────
  const allCats = useMemo(() => ({
    income:  categories.income  || INITIAL_CATEGORIES.income,
    expense: categories.expense || INITIAL_CATEGORIES.expense,
  }), [categories]);

  const filtered = useMemo(() =>
    transactions
      .filter(t => {
        const d = new Date(t.date);
        return d.getMonth() === filterMonth && d.getFullYear() === filterYear;
      })
      .sort((a, b) => new Date(b.date) - new Date(a.date)),
  [transactions, filterMonth, filterYear]);

  const yearTx = useMemo(() =>
    transactions.filter(t => new Date(t.date).getFullYear() === filterYear),
  [transactions, filterYear]);

  const mIncome  = useMemo(() => filtered.filter(t => t.type === "income" ).reduce((s, t) => s + t.amount, 0), [filtered]);
  const mExpense = useMemo(() => filtered.filter(t => t.type === "expense").reduce((s, t) => s + t.amount, 0), [filtered]);
  const mBalance = mIncome - mExpense;
  const mSavings = useMemo(() => filtered.filter(t => t.category === "Épargne").reduce((s, t) => s + t.amount, 0), [filtered]);

  const yIncome  = useMemo(() => yearTx.filter(t => t.type === "income" ).reduce((s, t) => s + t.amount, 0), [yearTx]);
  const yExpense = useMemo(() => yearTx.filter(t => t.type === "expense").reduce((s, t) => s + t.amount, 0), [yearTx]);
  const yBalance = yIncome - yExpense;
  const ySavings = useMemo(() => yearTx.filter(t => t.category === "Épargne").reduce((s, t) => s + t.amount, 0), [yearTx]);

  const catMonth = useMemo(() => {
    const map = {};
    filtered.filter(t => t.type === "expense").forEach(t => { map[t.category] = (map[t.category] || 0) + t.amount; });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [filtered]);

  const catYear = useMemo(() => {
    const map = {};
    yearTx.filter(t => t.type === "expense").forEach(t => { map[t.category] = (map[t.category] || 0) + t.amount; });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [yearTx]);

  const monthStats = useMemo(() =>
    MONTHS_FR.map((name, m) => {
      const mx  = transactions.filter(t => new Date(t.date).getFullYear() === filterYear && new Date(t.date).getMonth() === m);
      const inc = mx.filter(t => t.type === "income" ).reduce((s, t) => s + t.amount, 0);
      const exp = mx.filter(t => t.type === "expense").reduce((s, t) => s + t.amount, 0);
      return { name, inc, exp, bal: inc - exp };
    }),
  [transactions, filterYear]);

  const years = [...new Set([filterYear, ...transactions.map(t => new Date(t.date).getFullYear())])].sort((a, b) => b - a);

  const activeRecur    = useMemo(() => recurring.filter(r => inPeriod(r, filterYear, filterMonth)), [recurring, filterYear, filterMonth]);
  const recurCostMonth = useMemo(() => activeRecur.filter(r => r.type === "expense").reduce((s, r) => s + (parseFloat(r.amount) || 0), 0), [activeRecur]);

  // ─────────────────────────────────────────────────────────
  // CRUD — TRANSACTIONS
  // ─────────────────────────────────────────────────────────
  const submitTx = () => {
    const amt = parseFloat(String(form.amount).replace(",", "."));
    if (!amt || amt <= 0) { setFormErr("Montant invalide."); return; }
    if (!form.description.trim()) { setFormErr("Description requise."); return; }
    setTransactions(prev => [{
      id: Date.now(), type: form.type, amount: amt,
      description: form.description.trim(), category: form.category, date: form.date,
    }, ...prev]);
    setForm({ type:"expense", amount:"", description:"", category: allCats.expense[0] || "Autre", date: today() });
    setFormErr("");
    setSaveMsg("✅ Mouvement enregistré !");
    setTimeout(() => setSaveMsg(""), 2500);
    setView("dashboard");
  };

  const deleteTx = id => {
    if (window.confirm("Supprimer ce mouvement ?")) setTransactions(prev => prev.filter(t => t.id !== id));
  };

  // ─────────────────────────────────────────────────────────
  // CRUD — RECURRING
  // ─────────────────────────────────────────────────────────
  const submitRecur = () => {
    const amt = parseFloat(String(recurForm.amount).replace(",", "."));
    if (!recurForm.name.trim() || !amt || amt <= 0) return;
    const item = {
      id:         editRecurId || Date.now(),
      name:       recurForm.name.trim(),
      amount:     amt,
      category:   recurForm.category,
      type:       recurForm.type,
      day:        Math.min(Math.max(parseInt(recurForm.day) || 1, 1), 31),
      startMonth: parseInt(recurForm.startMonth),
      startYear:  parseInt(recurForm.startYear),
      endMonth:   recurForm.hasEnd ? parseInt(recurForm.endMonth) : null,
      endYear:    recurForm.hasEnd ? parseInt(recurForm.endYear)  : null,
    };
    if (editRecurId) {
      setRecurring(prev => prev.map(r => r.id === editRecurId ? item : r));
      const startKey = mKey(item.startYear, item.startMonth);
      setGeneratedMonths(prev => prev.filter(k => k < startKey));
      setTransactions(prev => prev.filter(t => !(t.isRecurring && t.recurringId === editRecurId)));
    } else {
      setRecurring(prev => [...prev, item]);
      const startKey = mKey(item.startYear, item.startMonth);
      setGeneratedMonths(prev => prev.filter(k => k < startKey));
    }
    setRecurForm(emptyR); setShowRecurF(false); setEditRecurId(null);
  };

  const deleteRecur = id => {
    if (!window.confirm("Supprimer cette récurrence et ses transactions générées ?")) return;
    setRecurring(prev => prev.filter(r => r.id !== id));
    setTransactions(prev => prev.filter(t => !(t.isRecurring && t.recurringId === id)));
  };

  const startEditRecur = item => {
    setRecurForm({
      name: item.name, amount: String(item.amount), category: item.category,
      type: item.type, day: String(item.day),
      startMonth: item.startMonth, startYear: item.startYear,
      endMonth:   item.endMonth ?? new Date().getMonth(),
      endYear:    item.endYear  ?? new Date().getFullYear(),
      hasEnd:     item.endMonth != null,
    });
    setEditRecurId(item.id);
    setShowRecurF(true);
  };

  // ─────────────────────────────────────────────────────────
  // CRUD — CATEGORIES
  // ─────────────────────────────────────────────────────────
  const addCat = () => {
    const name = newCatName.trim();
    if (!name) return;
    if ((categories[newCatType] || []).includes(name)) { alert("Cette catégorie existe déjà."); return; }
    setCategories(prev => ({ ...prev, [newCatType]: [...(prev[newCatType] || []), name] }));
    setNewCatName("");
  };

  const startEditCat = (type, idx) => { setEditCat({ type, idx }); setEditCatVal(categories[type][idx]); };

  const saveEditCat = () => {
    if (!editCat) return;
    const { type, idx } = editCat;
    const newName = editCatVal.trim();
    const oldName = categories[type][idx];
    if (!newName || newName === oldName) { setEditCat(null); return; }
    if ((categories[type] || []).includes(newName)) { alert("Ce nom existe déjà."); return; }
    setTransactions(prev => prev.map(t => t.category === oldName ? { ...t, category: newName } : t));
    setRecurring(prev => prev.map(r => r.category === oldName ? { ...r, category: newName } : r));
    setCategories(prev => { const a = [...(prev[type] || [])]; a[idx] = newName; return { ...prev, [type]: a }; });
    setEditCat(null);
  };

  const deleteCat = (type, idx) => {
    const name  = categories[type][idx];
    const count = transactions.filter(t => t.category === name).length;
    const msg   = count > 0
      ? `"${name}" est utilisée dans ${count} mouvement(s). Ils seront réaffectés à "Autre". Continuer ?`
      : `Supprimer la catégorie "${name}" ?`;
    if (!window.confirm(msg)) return;
    if (count > 0) setTransactions(prev => prev.map(t => t.category === name ? { ...t, category: "Autre" } : t));
    setRecurring(prev => prev.map(r => r.category === name ? { ...r, category: "Autre" } : r));
    setCategories(prev => ({ ...prev, [type]: (prev[type] || []).filter((_, i) => i !== idx) }));
  };

  const resetCats = () => {
    if (window.confirm("Réinitialiser toutes les catégories aux valeurs par défaut ?")) setCategories(INITIAL_CATEGORIES);
  };

  // ─────────────────────────────────────────────────────────
  // CSV EXPORT
  // ─────────────────────────────────────────────────────────
  const exportCSV = () => {
    const headers = ["Date", "Type", "Catégorie", "Description", "Montant (€)", "Récurrent"];
    const rows = [...transactions]
      .sort((a, b) => new Date(a.date) - new Date(b.date))
      .map(t => [
        t.date,
        t.type === "income" ? "Entrée" : "Sortie",
        t.category || "",
        `"${(t.description || "").replace(/"/g, '""')}"`,
        (t.amount || 0).toFixed(2).replace(".", ","),
        t.isRecurring ? "Oui" : "Non",
      ]);
    const csv  = [headers, ...rows].map(r => r.join(";")).join("\r\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href = url; a.download = `prism-finance-${filterYear}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  // ─────────────────────────────────────────────────────────
  // CSV IMPORT
  // ─────────────────────────────────────────────────────────
  const handleImport = e => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const text  = ev.target.result.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
        const lines = text.split("\n").map(l => l.trim()).filter(Boolean);
        if (lines.length < 2) { setImportMsg({ error: "Fichier vide ou sans données." }); return; }

        const sep     = (lines[0].match(/;/g) || []).length >= (lines[0].match(/,/g) || []).length ? ";" : ",";
        const parseRow = row => {
          const cells = []; let cur = "", inQ = false;
          for (const ch of row) {
            if (ch === '"') { inQ = !inQ; }
            else if (ch === sep && !inQ) { cells.push(cur.trim()); cur = ""; }
            else cur += ch;
          }
          cells.push(cur.trim()); return cells;
        };

        const headers = parseRow(lines[0]).map(h => h.toLowerCase().replace(/["""]/g, "").trim());
        const find    = kws => headers.findIndex(h => kws.some(k => h.includes(k)));

        const iDate = find(["date"]);
        const iType = find(["type"]);
        const iCat  = find(["catég", "categ", "cat"]);
        const iDesc = find(["desc", "libell", "label", "intit", "objet"]);
        const iAmt  = find(["mont", "amount", "somme", "crédit", "credit", "débit", "debit"]);

        if (iAmt === -1) { setImportMsg({ error: "Colonne Montant introuvable. Vérifiez le format." }); return; }

        let imported = 0, skipped = 0;
        const newTx = [];

        for (let i = 1; i < lines.length; i++) {
          const cols   = parseRow(lines[i]);
          if (cols.length < 2) { skipped++; continue; }
          const rawAmt = (cols[iAmt] || "").replace(/[€$£\s\u00a0\u202f]/g, "").replace(",", ".");
          const amount = parseFloat(rawAmt);
          if (isNaN(amount) || amount === 0) { skipped++; continue; }

          let type;
          if (iType !== -1) {
            const tv = (cols[iType] || "").toLowerCase();
            type = tv.includes("entr") || tv.includes("income") || tv.includes("crédit") || tv.includes("credit") ? "income" : "expense";
          } else {
            type = amount > 0 ? "income" : "expense";
          }

          let date = today();
          if (iDate !== -1) {
            const raw = (cols[iDate] || "").trim().replace(/"/g, "");
            const d1  = new Date(raw);
            if (!isNaN(d1) && raw.length >= 8) {
              date = d1.toISOString().split("T")[0];
            } else {
              const parts = raw.split(/[\/\-\.]/);
              if (parts.length === 3) {
                const [a, b, c] = parts.map(p => p.trim());
                const yr = c.length === 2 ? "20" + c : c;
                const dd = parseInt(a) > 12 ? `${yr}-${b.padStart(2,"0")}-${a.padStart(2,"0")}` : `${yr}-${a.padStart(2,"0")}-${b.padStart(2,"0")}`;
                const d2 = new Date(dd);
                if (!isNaN(d2)) date = d2.toISOString().split("T")[0];
              }
            }
          }

          const description = iDesc !== -1 ? (cols[iDesc] || `Ligne ${i}`).replace(/^["']|["']$/g, "").trim() : `Import ligne ${i}`;
          const category    = iCat  !== -1 ? (cols[iCat]  || "Autre").replace(/^["']|["']$/g, "").trim()      : "Autre";

          newTx.push({ id: Date.now() + i + Math.random(), type, amount: Math.abs(amount), description, category, date });
          imported++;
        }

        if (newTx.length > 0) setTransactions(prev => [...newTx, ...prev]);
        setImportMsg({ imported, skipped });
      } catch (err) {
        setImportMsg({ error: `Erreur : ${err.message}` });
      }
    };
    reader.readAsText(file, "UTF-8");
    e.target.value = "";
  };

  // ─────────────────────────────────────────────────────────
  // STYLES
  // ─────────────────────────────────────────────────────────
  const S = {
    app:    { minHeight:"100vh", background:T.bg, color:T.text, fontFamily:T.font, maxWidth:480, margin:"0 auto", paddingBottom:72 },
    header: { background:T.header, padding:"13px 16px", display:"flex", alignItems:"center", justifyContent:"space-between", position:"sticky", top:0, zIndex:200 },
    card:   { background:T.surface, borderRadius:14, padding:"13px 16px", margin:"10px 14px", border:`1px solid ${T.border}`, boxShadow:"0 1px 6px rgba(10,35,66,0.06)" },
    cf:     (m = "10px 14px") => ({ background:T.surface, borderRadius:14, padding:"13px 16px", margin:m, border:`1px solid ${T.border}` }),
    balBox: { background:T.header, borderRadius:16, padding:"18px 16px 16px", margin:"10px 14px" },
    row:    { display:"flex", justifyContent:"space-between", alignItems:"center", padding:"9px 0", borderBottom:`1px solid ${T.border}` },
    rowL:   { display:"flex", justifyContent:"space-between", alignItems:"center", padding:"9px 0" },
    inp:    { width:"100%", background:T.bg, border:`1.5px solid ${T.border}`, borderRadius:9, padding:"10px 12px", color:T.text, fontSize:15, fontFamily:T.font, boxSizing:"border-box", marginBottom:10, outline:"none" },
    sel:    { width:"100%", background:T.bg, border:`1.5px solid ${T.border}`, borderRadius:9, padding:"10px 12px", color:T.text, fontSize:15, fontFamily:T.font, boxSizing:"border-box", marginBottom:10, outline:"none" },
    btn:    (bg, fg = "#fff") => ({ width:"100%", padding:"12px", background:bg, border:"none", borderRadius:10, color:fg, fontSize:15, fontWeight:700, fontFamily:T.font, cursor:"pointer", marginBottom:8 }),
    smBtn:  (bg, fg = "#fff", o = false) => ({ padding:"5px 11px", background:o?"transparent":bg, border:o?`1.5px solid ${bg}`:"none", borderRadius:8, color:o?bg:fg, fontSize:12, fontWeight:600, fontFamily:T.font, cursor:"pointer" }),
    toggle: { display:"flex", background:T.bg, border:`1.5px solid ${T.border}`, borderRadius:10, padding:3, marginBottom:10 },
    tBtn:   (a, type) => ({ flex:1, padding:"8px", border:"none", borderRadius:8, fontFamily:T.font, cursor:"pointer", fontWeight:a?700:400, fontSize:14, transition:"all .15s", background:a?(type==="income"?T.incomeLight:T.expenseLight):"transparent", color:a?(type==="income"?T.income:T.expense):T.muted }),
    tab:    a => ({ flex:1, padding:"8px", border:"none", borderRadius:8, fontFamily:T.font, cursor:"pointer", fontWeight:a?700:400, fontSize:13, background:a?T.accent:"transparent", color:a?"#fff":T.muted }),
    nav:    { position:"fixed", bottom:0, left:"50%", transform:"translateX(-50%)", width:"100%", maxWidth:480, background:T.surface, display:"flex", borderTop:`1px solid ${T.border}`, zIndex:100, boxShadow:"0 -2px 12px rgba(10,35,66,0.08)" },
    navBtn: a => ({ flex:1, padding:"10px 2px 8px", background:"none", border:"none", fontFamily:T.font, color:a?T.accent:T.muted, cursor:"pointer", fontSize:9, display:"flex", flexDirection:"column", alignItems:"center", gap:2, fontWeight:a?700:500, borderTop:a?`2.5px solid ${T.accent}`:"2.5px solid transparent" }),
    label:  { fontSize:12, color:T.muted, fontWeight:600, display:"block", marginBottom:4, letterSpacing:0.3 },
    mSel:   { display:"flex", gap:6, padding:"8px 14px", overflowX:"auto", scrollbarWidth:"none" },
    mChip:  a => ({ padding:"5px 13px", borderRadius:20, border:`1px solid ${a?T.accent:T.border}`, background:a?T.accent:T.surface, color:a?"#fff":T.muted, cursor:"pointer", whiteSpace:"nowrap", fontSize:12, fontWeight:a?700:400 }),
    secTitle: { fontSize:10, color:T.muted, fontWeight:700, letterSpacing:1.5, textTransform:"uppercase" },
  };

  const Bar = ({ pct, color }) => (
    <div style={{ height:5, borderRadius:3, background:T.border, overflow:"hidden", marginTop:3 }}>
      <div style={{ width:`${Math.min(pct||0,100)}%`, height:"100%", background:color, borderRadius:3, transition:"width .3s" }}/>
    </div>
  );

  const Nav = ({ icon, label, target }) => (
    <button style={S.navBtn(view === target)} onClick={() => setView(target)}>
      <span style={{ fontSize:17, lineHeight:1 }}>{icon}</span>{label}
    </button>
  );

  const MonthSel = () => (
    <div style={S.mSel}>
      {MONTHS_FR.map((m, i) => (
        <button key={i} style={S.mChip(filterMonth === i)} onClick={() => setFilterMonth(i)}>
          {m.slice(0, 3)}
        </button>
      ))}
    </div>
  );

  if (!loaded) return (
    <div style={{ ...S.app, display:"flex", alignItems:"center", justifyContent:"center", height:"100vh" }}>
      <div style={{ textAlign:"center" }}>
        <PrismLogo size={52}/>
        <div style={{ marginTop:12, color:T.muted, fontSize:13 }}>Chargement…</div>
      </div>
    </div>
  );

  // ─────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────
  return (
    <div style={S.app}>

      {/* ════ HEADER ════ */}
      <div style={S.header}>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <PrismLogo size={30}/>
          <div>
            <div style={{ fontSize:15, fontWeight:800, color:"#fff", letterSpacing:0.2, lineHeight:1.2 }}>Prism</div>
            <div style={{ fontSize:9, color:"rgba(255,255,255,0.35)", letterSpacing:1.5, textTransform:"uppercase" }}>Finance</div>
          </div>
        </div>
        <div style={{ display:"flex", gap:6, alignItems:"center" }}>
          <select value={filterYear} onChange={e => setFilterYear(+e.target.value)}
            style={{ ...S.sel, width:"auto", marginBottom:0, padding:"4px 8px", fontSize:12, background:"rgba(255,255,255,0.10)", border:"1px solid rgba(255,255,255,0.15)", color:"#fff" }}>
            {years.map(y => <option key={y} value={y} style={{ background:T.header, color:"#fff" }}>{y}</option>)}
          </select>
          <button onClick={exportCSV}
            style={{ background:"rgba(255,255,255,0.10)", border:"1px solid rgba(255,255,255,0.15)", borderRadius:8, padding:"5px 10px", color:"rgba(255,255,255,0.85)", cursor:"pointer", fontSize:11, fontWeight:600 }}>
            ⬇ CSV
          </button>
          <button onClick={() => fileRef.current?.click()}
            style={{ background:T.accent, border:"none", borderRadius:8, padding:"5px 10px", color:T.header, cursor:"pointer", fontSize:11, fontWeight:700 }}>
            ⬆ Import
          </button>
          <input ref={fileRef} type="file"
            accept=".csv,.txt,.CSV,text/csv,text/plain,application/csv,application/vnd.ms-excel"
            onChange={handleImport} style={{ display:"none" }}/>
        </div>
      </div>

      {/* ── Banners ── */}
      {importMsg && (
        <div style={{ margin:"8px 14px", padding:"10px 14px", borderRadius:10, border:`1px solid ${importMsg.error?T.expense:T.accent}33`, background:importMsg.error?T.expenseLight:T.accentLight, color:importMsg.error?T.expense:T.income, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <span style={{ fontSize:13, fontWeight:600 }}>
            {importMsg.error
              ? `❌ ${importMsg.error}`
              : `✅ ${importMsg.imported} mouvement(s) importé(s)${importMsg.skipped > 0 ? ` · ${importMsg.skipped} ligne(s) ignorée(s)` : ""}`}
          </span>
          <button onClick={() => setImportMsg(null)} style={{ background:"none", border:"none", color:"inherit", cursor:"pointer", fontSize:18, padding:0, lineHeight:1 }}>×</button>
        </div>
      )}
      {saveMsg && (
        <div style={{ margin:"8px 14px", padding:"10px 14px", borderRadius:10, background:T.accentLight, color:T.income, fontWeight:600, fontSize:13, border:`1px solid ${T.accent}44` }}>
          {saveMsg}
        </div>
      )}

      {/* ════════════════════════════════════════
          DASHBOARD
      ════════════════════════════════════════ */}
      {view === "dashboard" && (<>
        <MonthSel/>

        {/* Balance principale */}
        <div style={S.balBox}>
          <div style={{ ...S.secTitle, color:"rgba(255,255,255,0.4)", marginBottom:4 }}>
            Solde — {MONTHS_FR[filterMonth]} {filterYear}
          </div>
          <div style={{ fontSize:34, fontWeight:800, color:"#fff", letterSpacing:-1, marginBottom:16 }}>
            {fmt(mBalance)}
          </div>
          <div style={{ display:"flex", gap:8 }}>
            {[
              { label:"▲ Revenus",  val:mIncome,  color:"#A8F0D8" },
              { label:"▼ Dépenses", val:mExpense, color:"#FFAAAA" },
            ].map(({ label, val, color }) => (
              <div key={label} style={{ flex:1, background:"rgba(255,255,255,0.09)", borderRadius:10, padding:"9px 12px" }}>
                <div style={{ ...S.secTitle, color:"rgba(255,255,255,0.35)", marginBottom:3 }}>{label}</div>
                <div style={{ fontSize:15, fontWeight:700, color }}>{fmt(val)}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Épargne */}
        {(mSavings > 0 || ySavings > 0) && (
          <div style={{ ...S.card, background:T.accentLight, border:`1px solid ${T.accent}44` }}>
            <div style={{ ...S.secTitle, color:T.accent, marginBottom:8 }}>🐖 Épargne</div>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-end", marginBottom:mSavings > 0 && mExpense > 0 ? 10 : 0 }}>
              <div>
                <div style={{ fontSize:10, color:T.muted, marginBottom:2 }}>Ce mois</div>
                <div style={{ fontSize:22, fontWeight:800, color:T.income }}>{fmt(mSavings)}</div>
              </div>
              <div style={{ textAlign:"right" }}>
                <div style={{ fontSize:10, color:T.muted, marginBottom:2 }}>Cette année</div>
                <div style={{ fontSize:22, fontWeight:800, color:T.income }}>{fmt(ySavings)}</div>
              </div>
            </div>
            {mSavings > 0 && mExpense > 0 && (<>
              <div style={{ display:"flex", justifyContent:"space-between", fontSize:11, color:T.muted, marginBottom:3 }}>
                <span>Taux d'épargne</span>
                <span style={{ fontWeight:700, color:T.income }}>{((mSavings / mExpense) * 100).toFixed(1)} %</span>
              </div>
              <Bar pct={(mSavings / mExpense) * 100} color={T.income}/>
            </>)}
          </div>
        )}

        {/* Résumé annuel */}
        <div style={S.card}>
          <div style={{ ...S.secTitle, marginBottom:12 }}>Résumé annuel {filterYear}</div>
          <div style={{ display:"flex", justifyContent:"space-between" }}>
            {[
              { l:"Revenus",  v:yIncome,  c:T.income  },
              { l:"Dépenses", v:yExpense, c:T.expense },
              { l:"Solde",    v:yBalance, c:yBalance >= 0 ? T.income : T.expense },
            ].map(({ l, v, c }) => (
              <div key={l} style={{ textAlign:"center" }}>
                <div style={{ fontSize:10, color:T.muted, marginBottom:3 }}>{l}</div>
                <div style={{ fontSize:15, fontWeight:800, color:c }}>{fmt(v)}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Récurrences actives */}
        {activeRecur.length > 0 && (
          <div style={S.card}>
            <div style={{ ...S.secTitle, marginBottom:10 }}>🔄 Récurrences — {MONTHS_FR[filterMonth]}</div>
            {activeRecur.map(r => (
              <div key={r.id} style={S.row}>
                <div>
                  <div style={{ fontSize:13, fontWeight:600 }}>{r.name}</div>
                  <div style={{ fontSize:10, color:T.muted }}>{r.category} · le {r.day} du mois</div>
                </div>
                <span style={{ fontWeight:700, color:r.type==="income"?T.income:T.expense, fontSize:13 }}>
                  {r.type==="income"?"+":"−"}{fmt(r.amount)}
                </span>
              </div>
            ))}
            <div style={{ display:"flex", justifyContent:"space-between", paddingTop:8, marginTop:2 }}>
              <span style={{ fontSize:12, color:T.muted, fontWeight:600 }}>Total sorties récurrentes</span>
              <span style={{ fontWeight:800, color:T.expense, fontSize:13 }}>−{fmt(recurCostMonth)}</span>
            </div>
          </div>
        )}

        {/* Top dépenses */}
        {catMonth.length > 0 && (
          <div style={S.card}>
            <div style={{ ...S.secTitle, marginBottom:10 }}>Top dépenses — {MONTHS_FR[filterMonth]}</div>
            {catMonth.slice(0, 5).map(([cat, amt]) => (
              <div key={cat} style={{ marginBottom:9 }}>
                <div style={{ display:"flex", justifyContent:"space-between", fontSize:13, marginBottom:2 }}>
                  <span>{cat}</span>
                  <span style={{ fontWeight:700, color:T.expense }}>{fmt(amt)}</span>
                </div>
                <Bar pct={mExpense > 0 ? (amt / mExpense) * 100 : 0} color={T.expense}/>
              </div>
            ))}
          </div>
        )}

        {/* Derniers mouvements */}
        <div style={{ ...S.secTitle, margin:"14px 14px 0" }}>Derniers mouvements</div>
        <div style={S.card}>
          {filtered.length === 0
            ? <div style={{ color:T.muted, textAlign:"center", padding:"24px 0", fontSize:13 }}>
                Aucun mouvement ce mois.{" "}
                <span style={{ color:T.accent, fontWeight:600, cursor:"pointer" }} onClick={() => setView("add")}>
                  Appuyez sur ＋ pour ajouter
                </span>
              </div>
            : filtered.slice(0, 8).map((t, i, arr) => (
              <div key={t.id} style={i === arr.slice(0,8).length - 1 ? S.rowL : S.row}>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:13, fontWeight:600, display:"flex", alignItems:"center", gap:4 }}>
                    {t.isRecurring && <span style={{ fontSize:11, color:T.accent, flexShrink:0 }}>🔄</span>}
                    <span style={{ overflow:"hidden", whiteSpace:"nowrap", textOverflow:"ellipsis" }}>{t.description}</span>
                  </div>
                  <div style={{ fontSize:11, color:T.muted }}>{fmtD(t.date)} · {t.category}</div>
                </div>
                <div style={{ fontWeight:700, color:t.type==="income"?T.income:T.expense, fontSize:14, marginLeft:10, flexShrink:0 }}>
                  {t.type==="income"?"+":"−"}{fmt(t.amount)}
                </div>
              </div>
            ))
          }
          {filtered.length > 8 && (
            <button onClick={() => setView("history")}
              style={{ width:"100%", background:"none", border:"none", color:T.accent, cursor:"pointer", padding:"8px 0", fontSize:12, fontWeight:700, marginTop:2 }}>
              Voir les {filtered.length} mouvements →
            </button>
          )}
        </div>
      </>)}

      {/* ════════════════════════════════════════
          AJOUTER
      ════════════════════════════════════════ */}
      {view === "add" && (
        <div style={{ padding:"16px 14px" }}>
          <div style={{ fontSize:18, fontWeight:800, marginBottom:18, marginTop:4 }}>Nouveau mouvement</div>

          <div style={S.toggle}>
            <button style={S.tBtn(form.type==="expense","expense")} onClick={() => setForm(f => ({ ...f, type:"expense", category:allCats.expense[0]||"Autre" }))}>⬇ Sortie</button>
            <button style={S.tBtn(form.type==="income","income")}   onClick={() => setForm(f => ({ ...f, type:"income",  category:allCats.income[0] ||"Autre" }))}>⬆ Entrée</button>
          </div>

          <label style={S.label}>Date</label>
          <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date:e.target.value }))} style={S.inp}/>

          <label style={S.label}>Montant (€)</label>
          <input type="number" inputMode="decimal" placeholder="0,00" value={form.amount}
            onChange={e => setForm(f => ({ ...f, amount:e.target.value }))} style={S.inp} min="0" step="0.01"/>

          <label style={S.label}>Description</label>
          <input type="text" placeholder="Ex : Courses Leclerc" value={form.description}
            onChange={e => setForm(f => ({ ...f, description:e.target.value }))}
            onKeyDown={e => e.key === "Enter" && submitTx()} style={S.inp}/>

          <label style={S.label}>Catégorie</label>
          <select value={form.category} onChange={e => setForm(f => ({ ...f, category:e.target.value }))} style={S.sel}>
            {allCats[form.type === "income" ? "income" : "expense"].map(c => <option key={c}>{c}</option>)}
          </select>

          {formErr && (
            <div style={{ color:T.expense, fontSize:12, marginBottom:8, fontWeight:600, padding:"6px 10px", background:T.expenseLight, borderRadius:8 }}>
              {formErr}
            </div>
          )}

          <button style={S.btn(form.type==="income" ? T.income : T.primary)} onClick={submitTx}>
            {form.type==="income" ? "✅ Enregistrer l'entrée" : "✅ Enregistrer la sortie"}
          </button>
          <button style={{ ...S.btn(T.surface, T.muted), border:`1px solid ${T.border}` }}
            onClick={() => { setForm({ type:"expense", amount:"", description:"", category:allCats.expense[0]||"Autre", date:today() }); setFormErr(""); }}>
            Effacer le formulaire
          </button>
        </div>
      )}

      {/* ════════════════════════════════════════
          JOURNAL (HISTORIQUE)
      ════════════════════════════════════════ */}
      {view === "history" && (<>
        <MonthSel/>

        <div style={{ ...S.card, padding:"10px 16px" }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
            <span style={{ fontSize:14, fontWeight:800 }}>{MONTHS_FR[filterMonth]} {filterYear}</span>
            <span style={{ fontSize:12, color:T.muted }}>{filtered.length} mouvement(s)</span>
          </div>
          <div style={{ display:"flex", gap:12, marginTop:6 }}>
            <span style={{ fontSize:12, color:T.income,  fontWeight:700 }}>▲ {fmt(mIncome)}</span>
            <span style={{ fontSize:12, color:T.expense, fontWeight:700 }}>▼ {fmt(mExpense)}</span>
            <span style={{ fontSize:12, fontWeight:800,  color:mBalance >= 0 ? T.income : T.expense }}>= {fmt(mBalance)}</span>
          </div>
        </div>

        <div style={S.card}>
          {filtered.length === 0
            ? <div style={{ color:T.muted, textAlign:"center", padding:"24px 0", fontSize:13 }}>Aucun mouvement ce mois.</div>
            : filtered.map((t, i, arr) => (
              <div key={t.id} style={i === arr.length - 1 ? S.rowL : S.row}>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:13, fontWeight:600, display:"flex", alignItems:"center", gap:4 }}>
                    {t.isRecurring && <span style={{ fontSize:10, color:T.accent, flexShrink:0 }}>🔄</span>}
                    <span style={{ overflow:"hidden", whiteSpace:"nowrap", textOverflow:"ellipsis" }}>{t.description}</span>
                  </div>
                  <div style={{ fontSize:11, color:T.muted }}>{fmtD(t.date)} · {t.category}</div>
                </div>
                <div style={{ textAlign:"right", flexShrink:0, marginLeft:10 }}>
                  <div style={{ fontWeight:700, color:t.type==="income"?T.income:T.expense, fontSize:14 }}>
                    {t.type==="income"?"+":"−"}{fmt(t.amount)}
                  </div>
                  <button onClick={() => deleteTx(t.id)}
                    style={{ background:"none", border:"none", color:T.muted, cursor:"pointer", fontSize:12, padding:"2px 0", fontFamily:T.font }}>
                    🗑
                  </button>
                </div>
              </div>
            ))
          }
        </div>
      </>)}

      {/* ════════════════════════════════════════
          STATS
      ════════════════════════════════════════ */}
      {view === "stats" && (<>
        <div style={{ padding:"16px 14px 0", fontSize:18, fontWeight:800 }}>Statistiques {filterYear}</div>

        <div style={S.card}>
          <div style={{ ...S.secTitle, marginBottom:12 }}>Synthèse {filterYear}</div>
          <div style={{ display:"flex", justifyContent:"space-between" }}>
            {[
              { l:"Revenus",  v:yIncome,  c:T.income  },
              { l:"Dépenses", v:yExpense, c:T.expense },
              { l:"Solde",    v:yBalance, c:yBalance >= 0 ? T.income : T.expense },
              { l:"Épargne",  v:ySavings, c:T.accent  },
            ].map(({ l, v, c }) => (
              <div key={l} style={{ textAlign:"center" }}>
                <div style={{ fontSize:9, color:T.muted, fontWeight:700, letterSpacing:0.8, marginBottom:3 }}>{l.toUpperCase()}</div>
                <div style={{ fontSize:13, fontWeight:800, color:c }}>{fmt(v)}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Évolution mensuelle */}
        <div style={S.card}>
          <div style={{ ...S.secTitle, marginBottom:12 }}>Évolution mensuelle</div>
          {monthStats.map((m, i) => (
            <div key={i} style={{ marginBottom:10 }}>
              <div style={{ display:"flex", justifyContent:"space-between", fontSize:12, marginBottom:2, alignItems:"center" }}>
                <span style={{ color:T.muted, width:34, flexShrink:0, fontWeight:500 }}>{m.name.slice(0,3)}</span>
                <span style={{ color:T.income,  flex:1, textAlign:"center" }}>{m.inc > 0 ? fmt(m.inc) : "—"}</span>
                <span style={{ color:T.expense, flex:1, textAlign:"center" }}>{m.exp > 0 ? fmt(m.exp) : "—"}</span>
                <span style={{ color:m.bal >= 0 ? T.income : T.expense, flex:1, textAlign:"right", fontWeight:700 }}>
                  {m.inc > 0 || m.exp > 0 ? fmt(m.bal) : "—"}
                </span>
              </div>
              {m.exp > 0 && <Bar pct={yExpense > 0 ? (m.exp / yExpense) * 100 : 0} color={T.expense}/>}
            </div>
          ))}
          <div style={{ display:"flex", justifyContent:"space-between", fontSize:9, color:T.muted, fontWeight:700, marginTop:4 }}>
            <span style={{ width:34 }}/>
            <span style={{ flex:1, textAlign:"center" }}>REVENUS</span>
            <span style={{ flex:1, textAlign:"center" }}>DÉPENSES</span>
            <span style={{ flex:1, textAlign:"right"  }}>SOLDE</span>
          </div>
        </div>

        {/* Dépenses par catégorie */}
        <div style={S.card}>
          <div style={{ ...S.secTitle, marginBottom:12 }}>Dépenses par catégorie — {filterYear}</div>
          {catYear.length === 0
            ? <div style={{ color:T.muted, fontSize:13 }}>Aucune dépense enregistrée.</div>
            : catYear.map(([cat, amt]) => (
              <div key={cat} style={{ marginBottom:9 }}>
                <div style={{ display:"flex", justifyContent:"space-between", fontSize:13, marginBottom:2 }}>
                  <span>{cat}</span>
                  <span style={{ fontWeight:700, color:T.expense }}>{fmt(amt)}</span>
                </div>
                <Bar pct={yExpense > 0 ? (amt / yExpense) * 100 : 0} color={T.expense}/>
              </div>
            ))
          }
        </div>
      </>)}

      {/* ════════════════════════════════════════
          GÉRER
      ════════════════════════════════════════ */}
      {view === "manage" && (
        <div style={{ padding:"16px 14px" }}>
          <div style={{ fontSize:18, fontWeight:800, marginBottom:16, marginTop:4 }}>Gérer</div>

          <div style={{ ...S.toggle, marginBottom:16 }}>
            <button style={S.tab(manageTab==="recurring")}  onClick={() => setManageTab("recurring")}>🔄 Récurrences</button>
            <button style={S.tab(manageTab==="categories")} onClick={() => setManageTab("categories")}>🏷 Catégories</button>
          </div>

          {/* ────── RÉCURRENCES ────── */}
          {manageTab === "recurring" && (<>
            <button onClick={() => { setShowRecurF(!showRecurF); setEditRecurId(null); setRecurForm(emptyR); }}
              style={S.btn(showRecurF ? T.muted : T.primary)}>
              {showRecurF ? "✕ Annuler" : "＋ Nouvelle récurrence"}
            </button>

            {showRecurF && (
              <div style={{ ...S.cf("0 0 14px"), border:`1.5px solid ${T.accent}`, boxShadow:`0 0 0 3px ${T.accentLight}` }}>
                <div style={{ fontSize:14, fontWeight:800, marginBottom:12 }}>
                  {editRecurId ? "Modifier la récurrence" : "Nouvelle récurrence"}
                </div>

                <div style={S.toggle}>
                  <button style={S.tBtn(recurForm.type==="expense","expense")} onClick={() => setRecurForm(f => ({ ...f, type:"expense", category:"Logement" }))}>⬇ Sortie</button>
                  <button style={S.tBtn(recurForm.type==="income","income")}   onClick={() => setRecurForm(f => ({ ...f, type:"income",  category:"Salaire"  }))}>⬆ Entrée</button>
                </div>

                <label style={S.label}>Nom</label>
                <input placeholder="Ex : Loyer, Netflix, EDF…" value={recurForm.name}
                  onChange={e => setRecurForm(f => ({ ...f, name:e.target.value }))} style={S.inp}/>

                <label style={S.label}>Montant (€)</label>
                <input type="number" inputMode="decimal" placeholder="0,00" value={recurForm.amount}
                  onChange={e => setRecurForm(f => ({ ...f, amount:e.target.value }))} style={S.inp} min="0" step="0.01"/>

                <label style={S.label}>Catégorie</label>
                <select value={recurForm.category} onChange={e => setRecurForm(f => ({ ...f, category:e.target.value }))} style={S.sel}>
                  {allCats[recurForm.type === "income" ? "income" : "expense"].map(c => <option key={c}>{c}</option>)}
                </select>

                <label style={S.label}>Jour du mois (1 – 31)</label>
                <input type="number" min="1" max="31" value={recurForm.day}
                  onChange={e => setRecurForm(f => ({ ...f, day:e.target.value }))} style={S.inp}/>

                {/* Début */}
                <label style={S.label}>Mois de début</label>
                <div style={{ display:"flex", gap:8, marginBottom:10 }}>
                  <select value={recurForm.startMonth} onChange={e => setRecurForm(f => ({ ...f, startMonth:+e.target.value }))}
                    style={{ ...S.sel, marginBottom:0, flex:2 }}>
                    {MONTHS_FR.map((m, i) => <option key={i} value={i}>{m}</option>)}
                  </select>
                  <input type="number" placeholder="2025" value={recurForm.startYear}
                    onChange={e => setRecurForm(f => ({ ...f, startYear:+e.target.value }))}
                    style={{ ...S.inp, marginBottom:0, flex:1 }} min="2000" max="2099"/>
                </div>

                {/* Fin optionnelle */}
                <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:10 }}>
                  <input type="checkbox" id="hasEnd" checked={recurForm.hasEnd}
                    onChange={e => setRecurForm(f => ({ ...f, hasEnd:e.target.checked }))}
                    style={{ width:16, height:16, accentColor:T.accent, cursor:"pointer" }}/>
                  <label htmlFor="hasEnd" style={{ fontSize:13, color:T.text, cursor:"pointer", fontWeight:500 }}>
                    Définir une date de fin
                  </label>
                </div>

                {recurForm.hasEnd && (<>
                  <label style={S.label}>Mois de fin</label>
                  <div style={{ display:"flex", gap:8, marginBottom:10 }}>
                    <select value={recurForm.endMonth ?? 0} onChange={e => setRecurForm(f => ({ ...f, endMonth:+e.target.value }))}
                      style={{ ...S.sel, marginBottom:0, flex:2 }}>
                      {MONTHS_FR.map((m, i) => <option key={i} value={i}>{m}</option>)}
                    </select>
                    <input type="number" placeholder="2025" value={recurForm.endYear ?? new Date().getFullYear()}
                      onChange={e => setRecurForm(f => ({ ...f, endYear:+e.target.value }))}
                      style={{ ...S.inp, marginBottom:0, flex:1 }} min="2000" max="2099"/>
                  </div>
                </>)}

                <button style={S.btn(T.accent, T.primary)} onClick={submitRecur}>
                  ✅ {editRecurId ? "Mettre à jour" : "Ajouter la récurrence"}
                </button>
              </div>
            )}

            {recurring.length === 0
              ? <div style={{ color:T.muted, textAlign:"center", padding:"30px 0", fontSize:13 }}>
                  Aucune récurrence configurée.<br/>
                  <span style={{ fontSize:12 }}>Loyer, abonnements, salaire…</span>
                </div>
              : recurring.map(r => (
                <div key={r.id} style={{ ...S.cf("0 0 8px"), display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:14, fontWeight:700 }}>{r.name}</div>
                    <div style={{ fontSize:11, color:T.muted }}>{r.category} · le {r.day} du mois</div>
                    <div style={{ fontSize:11, color:T.accent, marginTop:3, fontWeight:600 }}>📅 {periodLabel(r)}</div>
                  </div>
                  <div style={{ display:"flex", alignItems:"center", gap:6, flexShrink:0, marginLeft:8, paddingTop:2 }}>
                    <span style={{ fontWeight:800, color:r.type==="income"?T.income:T.expense, fontSize:14 }}>
                      {r.type==="income"?"+":"−"}{fmt(r.amount)}
                    </span>
                    <button onClick={() => startEditRecur(r)} style={S.smBtn(T.primary)}>✏️</button>
                    <button onClick={() => deleteRecur(r.id)} style={S.smBtn(T.expense)}>🗑</button>
                  </div>
                </div>
              ))
            }
          </>)}

          {/* ────── CATÉGORIES ────── */}
          {manageTab === "categories" && (<>
            <div style={S.cf("0 0 12px")}>
              <div style={{ fontSize:13, fontWeight:700, marginBottom:10 }}>Nouvelle catégorie</div>
              <div style={S.toggle}>
                <button style={S.tab(newCatType==="expense")} onClick={() => setNewCatType("expense")}>Dépense</button>
                <button style={S.tab(newCatType==="income")}  onClick={() => setNewCatType("income")}>Revenu</button>
              </div>
              <div style={{ display:"flex", gap:8, marginTop:4 }}>
                <input placeholder="Nom de la catégorie" value={newCatName}
                  onChange={e => setNewCatName(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && addCat()}
                  style={{ ...S.inp, marginBottom:0, flex:1 }}/>
                <button onClick={addCat} style={S.smBtn(T.accent, T.primary)}>Ajouter</button>
              </div>
            </div>

            {["expense","income"].map(type => (
              <div key={type} style={S.cf("0 0 10px")}>
                <div style={{ ...S.secTitle, marginBottom:12 }}>
                  {type === "expense" ? "🔴 Dépenses" : "🟢 Revenus"}
                  <span style={{ fontSize:9, background:T.muted+"22", color:T.muted, borderRadius:4, padding:"1px 6px", marginLeft:8, fontWeight:700 }}>
                    {(categories[type] || []).length}
                  </span>
                </div>
                {(categories[type] || []).map((cat, idx) => (
                  <div key={cat + idx}>
                    {editCat?.type === type && editCat?.idx === idx ? (
                      <div style={{ display:"flex", gap:6, padding:"6px 0", borderBottom:`1px solid ${T.border}`, alignItems:"center" }}>
                        <input autoFocus value={editCatVal} onChange={e => setEditCatVal(e.target.value)}
                          onKeyDown={e => { if(e.key==="Enter")saveEditCat(); if(e.key==="Escape")setEditCat(null); }}
                          style={{ ...S.inp, marginBottom:0, flex:1, padding:"6px 10px", fontSize:13 }}/>
                        <button onClick={saveEditCat}          style={S.smBtn(T.income)}>✓</button>
                        <button onClick={() => setEditCat(null)} style={S.smBtn(T.muted)}>✕</button>
                      </div>
                    ) : (
                      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"8px 0", borderBottom:`1px solid ${T.border}` }}>
                        <span style={{ fontSize:13, fontWeight:500 }}>{cat}</span>
                        <div style={{ display:"flex", gap:6 }}>
                          <button onClick={() => startEditCat(type, idx)} style={S.smBtn(T.primary, undefined, true)}>✏️</button>
                          <button onClick={() => deleteCat(type, idx)}    style={S.smBtn(T.expense, undefined, true)}>🗑</button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ))}

            <button onClick={resetCats}
              style={{ ...S.btn(T.surface, T.muted), border:`1px solid ${T.border}`, fontSize:12, fontWeight:600 }}>
              🔄 Réinitialiser les catégories par défaut
            </button>
            <div style={{ fontSize:10, color:T.muted, textAlign:"center", marginTop:-4, marginBottom:8 }}>
              Les mouvements existants ne sont pas modifiés.
            </div>
          </>)}
        </div>
      )}

      {/* ════ BOTTOM NAV ════ */}
      <div style={S.nav}>
        <Nav icon="🏠" label="Accueil"  target="dashboard"/>
        <Nav icon="＋" label="Ajouter"  target="add"/>
        <Nav icon="📋" label="Journal"  target="history"/>
        <Nav icon="📊" label="Stats"    target="stats"/>
        <Nav icon="⚙️" label="Gérer"    target="manage"/>
      </div>
    </div>
  );
}
