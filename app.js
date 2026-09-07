const { createClient } = window.supabase;
const db = createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);

const $ = id => document.getElementById(id);
let session = null, movements = [], currentType = "expense", authMode = "login";

const defaultCategories = {
  expense: ["Alimentación","Transporte","Casa","Ocio","Compras","Suscripciones","Salud","Estudios","Otros"],
  income: ["Sueldo","Freelance","Ventas","Regalo","Inversión","Otros"]
};
let settings = { theme:"dark", currency:"EUR", categories: structuredClone(defaultCategories) };
function settingsKey(){ return `finanzas-settings-${session?.user?.id||"guest"}`; }
function loadSettings(){
  try { const saved=JSON.parse(localStorage.getItem(settingsKey())||"null"); if(saved){ settings={...settings,...saved,categories:{...defaultCategories,...(saved.categories||{})}}; } } catch(e){}
  applyTheme();
}
function saveSettings(){ localStorage.setItem(settingsKey(), JSON.stringify(settings)); }
function applyTheme(){
  const theme=settings.theme||"dark";
  document.documentElement.dataset.theme=theme;
  if(theme==="auto") document.documentElement.classList.toggle("system-light",matchMedia("(prefers-color-scheme: light)").matches);
  else document.documentElement.classList.remove("system-light");
}
const money = n => new Intl.NumberFormat("es-ES",{style:"currency",currency:settings.currency||"EUR"}).format(Number(n)||0);
const euro = money;
const dateES = d => new Intl.DateTimeFormat("es-ES",{day:"2-digit",month:"short",year:"numeric"}).format(new Date(d+"T12:00:00"));
const today = () => new Date().toISOString().slice(0,10);

function toast(msg){$("toast").textContent=msg;$("toast").classList.add("show");setTimeout(()=>$("toast").classList.remove("show"),2200)}
function setAuthMessage(msg=""){ $("authMessage").textContent=msg }

function updateCategoryOptions(type, selected=""){
  $("category").innerHTML = settings.categories[type].map(c=>`<option ${c===selected?"selected":""}>${c}</option>`).join("");
}
function updateCategoryFilter(){
  const all=[...new Set(movements.map(m=>m.category).filter(Boolean))].sort();
  $("categoryFilter").innerHTML='<option value="all">Todas las categorías</option>'+all.map(c=>`<option>${c}</option>`).join("");
}

async function init(){
  loadSettings();
  const {data:{session:s}}=await db.auth.getSession();
  session=s; if(session) loadSettings(); renderAuth();
  db.auth.onAuthStateChange((_e,s2)=>{session=s2; if(s2) loadSettings(); renderAuth(); if(s2) loadMovements()});
}
function renderAuth(){
  if(session){$("authView").classList.add("hidden");$("appView").classList.remove("hidden");$("greeting").textContent="Hola 👋";loadMovements();}
  else {$("authView").classList.remove("hidden");$("appView").classList.add("hidden")}
}

async function loadMovements(){
  if(!session)return;
  const {data,error}=await db.from("movements").select("*").order("date",{ascending:false}).order("created_at",{ascending:false});
  if(error){toast("No se pudieron cargar los movimientos");console.error(error);return}
  movements=data||[]; updateCategoryFilter(); render();
}

function filtered(){
  const t=$("typeFilter").value,c=$("categoryFilter").value,q=$("searchFilter").value.trim().toLowerCase();
  return movements.filter(m=>(t==="all"||m.type===t)&&(c==="all"||m.category===c)&&(!q||m.description.toLowerCase().includes(q)||m.category.toLowerCase().includes(q)));
}
function render(){
  const allBalance=movements.reduce((s,m)=>s+(m.type==="income"?Number(m.amount):-Number(m.amount)),0);
  const month=new Date().toISOString().slice(0,7);
  const mm=movements.filter(m=>m.date.startsWith(month));
  const monthBalance=mm.reduce((s,m)=>s+(m.type==="income"?Number(m.amount):-Number(m.amount)),0);
  const income=movements.filter(m=>m.type==="income").reduce((s,m)=>s+Number(m.amount),0);
  const expense=movements.filter(m=>m.type==="expense").reduce((s,m)=>s+Number(m.amount),0);
  $("balance").textContent=euro(allBalance);$("monthBalance").textContent=euro(monthBalance);
  $("incomeTotal").textContent=euro(income);$("expenseTotal").textContent=euro(expense);
  const list=filtered();$("movementCount").textContent=`${list.length} movimiento${list.length===1?"":"s"}`;
  $("movements").innerHTML=list.map(m=>`<article class="movement" data-id="${m.id}">
    <div class="movement-icon">${m.type==="income"?"↗":"↘"}</div>
    <div class="movement-main"><div class="movement-title">${escapeHtml(m.description)}</div><div class="movement-sub">${escapeHtml(m.category)} · ${dateES(m.date)} · ${escapeHtml(m.payment_method||"")}</div></div>
    <div class="movement-amount ${m.type}">${m.type==="income"?"+":"−"} ${euro(m.amount)}</div>
  </article>`).join("");
  $("emptyState").classList.toggle("hidden",list.length>0);
}
function escapeHtml(s){return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]))}

let wizardStep = 1;
const totalWizardSteps = 5;

function showWizardStep(step){
  wizardStep = Math.max(1, Math.min(totalWizardSteps, step));
  for(let i=1;i<=totalWizardSteps;i++) $(`wizardStep${i}`).classList.toggle("hidden",i!==wizardStep);
  $("stepCounter").textContent=`PASO ${wizardStep} DE ${totalWizardSteps}`;
  $("wizardProgress").style.width=`${wizardStep/totalWizardSteps*100}%`;
  $("wizardBack").classList.toggle("hidden",wizardStep===1);
  $("wizardNext").classList.toggle("hidden",wizardStep===totalWizardSteps);
  $("wizardSave").classList.toggle("hidden",wizardStep!==totalWizardSteps);
  if(wizardStep===totalWizardSteps) updateWizardSummary();
  const input=[null,"amount","description","category","date","paymentMethod"][wizardStep];
  if(input) setTimeout(()=>$(input)?.focus(),80);
}
function updateWizardSummary(){
  $("wizardSummary").innerHTML=`<div><span>${currentType==="income"?"Ingreso":"Gasto"}</span><strong>${euro($("amount").value)}</strong></div><div><span>Concepto</span><strong>${escapeHtml($("description").value)}</strong></div><div><span>Categoría</span><strong>${escapeHtml($("category").value)}</strong></div><div><span>Fecha</span><strong>${dateES($("date").value)}</strong></div><div><span>Método</span><strong>${escapeHtml($("paymentMethod").value)}</strong></div>`;
}
function validateWizardStep(){
  const ids=[null,"amount","description","category","date","paymentMethod"];
  if(wizardStep===1 && (!(Number($("amount").value)>0))) {toast("Introduce una cantidad válida");$("amount").focus();return false}
  if(wizardStep===2 && !$("description").value.trim()) {toast("Introduce un concepto");$("description").focus();return false}
  if(wizardStep===3 && !$("category").value) {toast("Elige una categoría");return false}
  if(wizardStep===4 && !$("date").value) {toast("Elige una fecha");return false}
  return true;
}
function openModal(m=null){
  $("modal").classList.remove("hidden");
  $("movementId").value=m?.id||"";$("modalTitle").textContent=m?"Editar movimiento":"Nuevo movimiento";
  currentType=m?.type||"expense";
  document.querySelectorAll(".type-btn").forEach(b=>b.classList.toggle("active",b.dataset.type===currentType));
  updateCategoryOptions(currentType,m?.category||settings.categories[currentType][0]);
  $("amount").value=m?.amount??"";$("description").value=m?.description??"";$("date").value=m?.date||today();$("paymentMethod").value=m?.payment_method||"Tarjeta";
  $("deleteBtn").classList.toggle("hidden",!m);
  showWizardStep(1);
}
function closeModal(){$("modal").classList.add("hidden")}

document.addEventListener("DOMContentLoaded", () => {
  const toggle = $("toggleAuth");
  if (toggle) {
    toggle.addEventListener("click", (e) => {
      e.preventDefault();
      authMode = authMode === "login" ? "signup" : "login";
      $("authTitle").textContent = authMode === "login" ? "Tu dinero, bajo control." : "Crea tu cuenta.";
      $("authSubtitle").textContent = authMode === "login"
        ? "Inicia sesión para ver tus ingresos y gastos."
        : "Crea una cuenta para guardar tus movimientos.";
      $("authSubmit").textContent = authMode === "login" ? "Iniciar sesión" : "Crear cuenta";
      $("toggleAuth").textContent = authMode === "login"
        ? "¿No tienes cuenta? Crear una"
        : "¿Ya tienes cuenta? Iniciar sesión";
      $("resetPassword").classList.toggle("hidden", authMode !== "login");
      setAuthMessage("");
      $("password").value = "";
      $("email").focus();
    });
  }
});

$("authForm").addEventListener("submit",async e=>{
  e.preventDefault();setAuthMessage("");const email=$("email").value.trim(),password=$("password").value;
  $("authSubmit").disabled=true;
  let result;
  if(authMode==="login") result=await db.auth.signInWithPassword({email,password});
  else result=await db.auth.signUp({email,password});
  $("authSubmit").disabled=false;
  if(result.error)setAuthMessage(result.error.message);
  else if(authMode==="signup"){
  if(result.data?.session){
    setAuthMessage("Cuenta creada correctamente. Entrando…");
  } else {
    setAuthMessage("Cuenta creada. Revisa tu email para confirmar la cuenta y después inicia sesión.");
  }
}
});
async function oauth(provider){
  setAuthMessage("");
  const {error}=await db.auth.signInWithOAuth({
    provider,
    options:{redirectTo:window.location.origin+window.location.pathname}
  });
  if(error)setAuthMessage(error.message);
}
$("googleBtn").addEventListener("click",()=>oauth("google"));

$("resetPassword").addEventListener("click",async()=>{
  const email=$("email").value.trim();if(!email)return setAuthMessage("Escribe primero tu email.");
  const {error}=await db.auth.resetPasswordForEmail(email,{redirectTo:location.origin+location.pathname});
  setAuthMessage(error?error.message:"Te hemos enviado un enlace para restablecer la contraseña.");
});
$("logoutBtn").addEventListener("click",()=>db.auth.signOut());
$("addBtn").addEventListener("click",()=>openModal());
$("emptyAddBtn").addEventListener("click",()=>openModal());
$("closeModal").addEventListener("click",closeModal);$("modalBackdrop").addEventListener("click",closeModal);
document.querySelectorAll(".type-btn").forEach(b=>b.addEventListener("click",()=>{currentType=b.dataset.type;document.querySelectorAll(".type-btn").forEach(x=>x.classList.toggle("active",x===b));updateCategoryOptions(currentType)}));
$("wizardNext").addEventListener("click",()=>{
  if(validateWizardStep()) showWizardStep(wizardStep+1);
});
$("wizardBack").addEventListener("click",()=>showWizardStep(wizardStep-1));
document.querySelectorAll("#movementForm input").forEach(el=>el.addEventListener("keydown",e=>{
  if(e.key==="Enter" && wizardStep<totalWizardSteps){e.preventDefault();$("wizardNext").click();}
}));
$("movementForm").addEventListener("submit",async e=>{
  e.preventDefault(); if(!session)return;
  const id=$("movementId").value;
  const payload={type:currentType,amount:Number($("amount").value),description:$("description").value.trim(),category:$("category").value,date:$("date").value,payment_method:$("paymentMethod").value,user_id:session.user.id};
  let result=id?await db.from("movements").update(payload).eq("id",id):await db.from("movements").insert(payload);
  if(result.error)return toast(result.error.message);
  closeModal();toast(id?"Movimiento actualizado":"Movimiento guardado");loadMovements();
});
$("deleteBtn").addEventListener("click",async()=>{
  const id=$("movementId").value;if(!id)return;
  if(!confirm("¿Eliminar este movimiento?"))return;
  const {error}=await db.from("movements").delete().eq("id",id);
  if(error)return toast(error.message);closeModal();toast("Movimiento eliminado");loadMovements();
});
$("movements").addEventListener("click",e=>{const el=e.target.closest(".movement");if(!el)return;const m=movements.find(x=>x.id===el.dataset.id);if(m)openModal(m)});
["typeFilter","categoryFilter","searchFilter"].forEach(id=>$(id).addEventListener("input",render));
$("categoryFilter").addEventListener("change",render);
function showSettings(){
  document.querySelectorAll(".nav-item").forEach(b=>b.classList.toggle("active",b.dataset.view==="settings"));
  const themeLabel={dark:"Oscuro",light:"Claro",auto:"Automático"}[settings.theme]||"Oscuro";
  const currencyNames={EUR:"Euro (€)",USD:"Dólar ($)",GBP:"Libra (£)"};
  const catRows=(type)=>settings.categories[type].map((c,i)=>`<div class="cat-row"><span>${escapeHtml(c)}</span><div><button class="mini-btn edit-cat" data-type="${type}" data-index="${i}">Editar</button><button class="mini-btn danger-mini del-cat" data-type="${type}" data-index="${i}">×</button></div></div>`).join("");
  document.querySelector("main").innerHTML=`<section class="settings-page">
    <div class="settings-title"><div class="eyebrow">CONFIGURACIÓN</div><h2>Ajustes</h2><p>Personaliza tu cuenta y tus finanzas.</p></div>
    <div class="settings-group"><div class="group-label">CUENTA</div>
      <div class="settings-row"><span class="row-icon">✉</span><span><b>Correo electrónico</b><small>${escapeHtml(session?.user?.email||"")}</small></span></div>
      <button class="settings-row" id="changePassword"><span class="row-icon">🔒</span><span><b>Cambiar contraseña</b><small>Recibir enlace por email</small></span><span>›</span></button>
      <button class="settings-row" id="settingsLogout"><span class="row-icon">↪</span><span><b>Cerrar sesión</b><small>Salir de tu cuenta</small></span><span>›</span></button>
    </div>
    <div class="settings-group"><div class="group-label">APARIENCIA</div>
      <button class="settings-row" id="themeSetting"><span class="row-icon">☾</span><span><b>Tema</b><small>${themeLabel}</small></span><span>›</span></button>
    </div>
    <div class="settings-group"><div class="group-label">FINANZAS</div>
      <button class="settings-row" id="currencySetting"><span class="row-icon">€</span><span><b>Moneda</b><small>${currencyNames[settings.currency]||settings.currency}</small></span><span>›</span></button>
      <button class="settings-row" id="categoriesSetting"><span class="row-icon">🏷</span><span><b>Categorías</b><small>${settings.categories.expense.length} gastos · ${settings.categories.income.length} ingresos</small></span><span>›</span></button>
    </div>
    <div class="settings-group"><div class="group-label">DATOS</div><button class="settings-row" id="exportCsv"><span class="row-icon">⇩</span><span><b>Exportar movimientos</b><small>Descargar CSV</small></span><span>›</span></button><button class="settings-row" id="importCsv"><span class="row-icon">⇧</span><span><b>Importar movimientos</b><small>Cargar movimientos desde un CSV</small></span><span>›</span></button><input id="csvFileInput" type="file" accept=".csv,text/csv" class="hidden"></div>
    <div class="settings-group"><div class="group-label">SEGURIDAD</div><button class="settings-row danger-row" id="deleteAll"><span class="row-icon">⌫</span><span><b>Eliminar todos los movimientos</b><small>Esta acción no se puede deshacer</small></span><span>›</span></button></div>
    <div class="app-version">Finanzas · versión 1.1</div>
    <div class="settings-dialog hidden" id="settingsDialog"><div class="settings-dialog-card"><div class="dialog-head"><h3 id="dialogTitle"></h3><button id="dialogClose" class="icon-button">×</button></div><div id="dialogBody"></div></div></div>
  </section>`;
  const closeDialog=()=>$("settingsDialog").classList.add("hidden");
  const openDialog=(title,body)=>{$("dialogTitle").textContent=title;$("dialogBody").innerHTML=body;$("settingsDialog").classList.remove("hidden");};
  $("dialogClose").onclick=closeDialog; $("settingsDialog").onclick=e=>{if(e.target.id==="settingsDialog")closeDialog()};
  $("settingsLogout").onclick=()=>db.auth.signOut();
  $("changePassword").onclick=async()=>{const {error}=await db.auth.resetPasswordForEmail(session.user.email,{redirectTo:location.origin+location.pathname});toast(error?error.message:"Te hemos enviado un enlace para cambiar la contraseña.")};
  $("themeSetting").onclick=()=>openDialog("Tema",`<div class="choice-list">${[["dark","🌙","Oscuro"],["light","☀️","Claro"],["auto","◐","Automático"]].map(([v,i,l])=>`<button class="choice ${settings.theme===v?"selected":""}" data-theme-choice="${v}"><span>${i}</span><b>${l}</b>${settings.theme===v?"<em>✓</em>":""}</button>`).join("")}</div>`);
  $("currencySetting").onclick=()=>openDialog("Moneda",`<div class="choice-list">${[["EUR","€","Euro (€)"],["USD","$","Dólar ($)"],["GBP","£","Libra (£)"]].map(([v,i,l])=>`<button class="choice ${settings.currency===v?"selected":""}" data-currency-choice="${v}"><span>${i}</span><b>${l}</b>${settings.currency===v?"<em>✓</em>":""}</button>`).join("")}</div>`);
  $("categoriesSetting").onclick=()=>openDialog("Categorías",`<div class="cat-section"><h4>Gastos</h4><div class="cat-list">${catRows("expense")}</div><button class="primary full add-cat" data-type="expense">+ Añadir categoría de gasto</button></div><div class="cat-section"><h4>Ingresos</h4><div class="cat-list">${catRows("income")}</div><button class="primary full add-cat" data-type="income">+ Añadir categoría de ingreso</button></div>`);
  $("dialogBody").addEventListener("click",e=>{
    const t=e.target.closest("[data-theme-choice]"); if(t){settings.theme=t.dataset.themeChoice;saveSettings();applyTheme();closeDialog();showSettings();render();return;}
    const c=e.target.closest("[data-currency-choice]"); if(c){settings.currency=c.dataset.currencyChoice;saveSettings();closeDialog();showSettings();render();return;}
    const add=e.target.closest(".add-cat"); if(add){const name=prompt("Nombre de la categoría:");if(name&&name.trim()){const n=name.trim();if(settings.categories[add.dataset.type].some(x=>x.toLowerCase()===n.toLowerCase()))return toast("Esa categoría ya existe");settings.categories[add.dataset.type].push(n);saveSettings();showSettings();setTimeout(()=>$("categoriesSetting").click(),0);}return;}
    const edit=e.target.closest(".edit-cat"); if(edit){const arr=settings.categories[edit.dataset.type],old=arr[Number(edit.dataset.index)],name=prompt("Nuevo nombre de la categoría:",old);if(name&&name.trim()&&name.trim()!==old){const n=name.trim();if(arr.some((x,i)=>i!==Number(edit.dataset.index)&&x.toLowerCase()===n.toLowerCase()))return toast("Esa categoría ya existe");arr[Number(edit.dataset.index)]=n;saveSettings();showSettings();setTimeout(()=>$("categoriesSetting").click(),0);}return;}
    const del=e.target.closest(".del-cat"); if(del){const arr=settings.categories[del.dataset.type],idx=Number(del.dataset.index);if(arr.length<=1)return toast("Debes conservar al menos una categoría");if(!confirm(`¿Eliminar la categoría «${arr[idx]}»? Los movimientos antiguos conservarán su categoría.`))return;arr.splice(idx,1);saveSettings();showSettings();setTimeout(()=>$("categoriesSetting").click(),0);return;}
  });
  $("exportCsv").onclick=()=>{if(!movements.length)return toast("No hay movimientos para exportar");const rows=[["Fecha","Tipo","Cantidad","Concepto","Categoría","Método"],...movements.map(m=>[m.date,m.type,m.amount,m.description,m.category,m.payment_method])];const csv=rows.map(r=>r.map(v=>`"${String(v??"").replace(/"/g,'""')}"`).join(",")).join("\n");const a=document.createElement("a");a.href=URL.createObjectURL(new Blob(["\ufeff"+csv],{type:"text/csv;charset=utf-8"}));a.download="movimientos.csv";a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)};
  $("importCsv").onclick=()=>$("csvFileInput").click();
  $("csvFileInput").addEventListener("change",async e=>{const file=e.target.files?.[0];if(!file)return;await importCsvFile(file);e.target.value=""});
  $("deleteAll").onclick=async()=>{if(!movements.length)return toast("No hay movimientos");if(!confirm("¿Eliminar TODOS tus movimientos? Esta acción no se puede deshacer."))return;const {error}=await db.from("movements").delete().eq("user_id",session.user.id);if(error)return toast(error.message);toast("Movimientos eliminados");await loadMovements()};
}

function csvParse(text){
  const rows=[];let row=[],cell="",quoted=false;
  text=text.replace(/^\uFEFF/,"");
  for(let i=0;i<text.length;i++){const ch=text[i],next=text[i+1];
    if(ch==='"'){if(quoted&&next==='"'){cell+='"';i++;}else quoted=!quoted;}
    else if(ch===','&&!quoted){row.push(cell);cell="";}
    else if((ch==='\n'||ch==='\r')&&!quoted){if(ch==='\r'&&next==='\n')i++;row.push(cell);if(row.some(v=>v.trim()!==""))rows.push(row);row=[];cell="";}
    else cell+=ch;
  }
  if(cell!==""||row.length){row.push(cell);if(row.some(v=>v.trim()!==""))rows.push(row)}
  return rows;
}
function normalizeHeader(h){return String(h||"").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]/g,"")}
async function importCsvFile(file){
  try{
    const text=await file.text(),rows=csvParse(text);if(rows.length<2)return toast("El CSV no contiene movimientos");
    const headers=rows[0].map(normalizeHeader);
    const find=(names)=>{for(const n of names){const i=headers.indexOf(normalizeHeader(n));if(i>=0)return i}return -1};
    const ix={date:find(["fecha","date"]),type:find(["tipo","type"]),amount:find(["cantidad","importe","amount","monto"]),description:find(["concepto","descripcion","description"]),category:find(["categoria","category"]),method:find(["metodo","metodo de pago","payment method","payment_method","method"])};
    if(ix.type<0||ix.amount<0||ix.description<0||ix.category<0||ix.date<0){return toast("Faltan columnas obligatorias: Fecha, Tipo, Cantidad, Concepto y Categoría")}
    const valid=[],errors=[];
    rows.slice(1).forEach((r,n)=>{
      const rawType=String(r[ix.type]||"").trim().toLowerCase();const type=["ingreso","income","entrada","i"].includes(rawType)?"income":["gasto","expense","salida","e"].includes(rawType)?"expense":null;
      const amount=Number(String(r[ix.amount]||"").trim().replace(/\s/g,"").replace(/€/g,"").replace(/\.(?=\d{3}(?:,|$))/g,"").replace(",","."));
      const description=String(r[ix.description]||"").trim();const category=String(r[ix.category]||"").trim();const date=String(r[ix.date]||"").trim();const method=ix.method>=0?String(r[ix.method]||"").trim():"Otro";
      if(!type||!(amount>0)||!description||!category||!/^(\d{4}-\d{2}-\d{2})$/.test(date)){errors.push(n+2);return}
      valid.push({user_id:session.user.id,type,amount,description:description.slice(0,120),category,date,payment_method:method||"Otro"});
    });
    if(!valid.length)return toast(`No se pudieron importar filas${errors.length?` (errores: ${errors.join(", ")})`:""}`);
    const preview=`Se importarán ${valid.length} movimiento${valid.length===1?"":"s"}${errors.length?` y se omitirán ${errors.length} filas inválidas`:""}. ¿Continuar?`;
    if(!confirm(preview))return;
    const {error}=await db.from("movements").insert(valid);if(error)return toast(`Error al importar: ${error.message}`);
    toast(`${valid.length} movimiento${valid.length===1?"":"s"} importado${valid.length===1?"":"s"}`);await loadMovements();showSettings();
  }catch(err){console.error(err);toast("No se pudo leer el CSV")}
}
function showSummary(){
  document.querySelectorAll(".nav-item").forEach(b=>b.classList.toggle("active",b.dataset.view==="stats"));
  const month=new Date().toISOString().slice(0,7), monthMov=movements.filter(m=>m.date.startsWith(month));
  const sum=(arr,type)=>arr.filter(m=>!type||m.type===type).reduce((s,m)=>s+Number(m.amount),0);
  const income=sum(movements,"income"),expense=sum(movements,"expense"),balance=income-expense,mi=sum(monthMov,"income"),me=sum(monthMov,"expense");
  const byCat={};monthMov.filter(m=>m.type==="expense").forEach(m=>byCat[m.category]=(byCat[m.category]||0)+Number(m.amount));
  const cats=Object.entries(byCat).sort((a,b)=>b[1]-a[1]);const max=cats[0]?.[1]||1;
  const monthName=new Intl.DateTimeFormat("es-ES",{month:"long",year:"numeric"}).format(new Date());
  document.querySelector("main").innerHTML=`<section class="summary-page"><div class="settings-title"><div class="eyebrow">ANÁLISIS</div><h2>Resumen</h2><p>${monthName.charAt(0).toUpperCase()+monthName.slice(1)}</p></div>
    <section class="balance-card"><div class="balance-label">Saldo total</div><div class="balance">${money(balance)}</div><div class="balance-meta"><span>Este mes</span><span>${money(mi-me)}</span></div></section>
    <section class="stats-grid"><article class="stat income"><span>Ingresos totales</span><strong>${money(income)}</strong></article><article class="stat expense"><span>Gastos totales</span><strong>${money(expense)}</strong></article></section>
    <section class="summary-card"><div class="summary-card-head"><div><h3>Este mes</h3><p>${monthMov.length} movimientos</p></div></div><div class="summary-bars"><div><span>Ingresos</span><strong>${money(mi)}</strong></div><div class="bar"><i style="width:${Math.min(100,(mi/(Math.max(mi,me,1)))*100)}%"></i></div><div><span>Gastos</span><strong>${money(me)}</strong></div><div class="bar"><i style="width:${Math.min(100,(me/(Math.max(mi,me,1)))*100)}%"></i></div></div></section>
    <section class="summary-card"><div class="summary-card-head"><div><h3>Gastos por categoría</h3><p>Este mes</p></div></div>${cats.length?cats.slice(0,8).map(([c,v])=>`<div class="category-stat"><div><span>${escapeHtml(c)}</span><strong>${money(v)}</strong></div><div class="bar"><i style="width:${(v/max)*100}%"></i></div></div>`).join(""):"<div class='empty-inline'>No hay gastos este mes.</div>"}</section>
    <section class="summary-card"><div class="summary-card-head"><div><h3>Últimos movimientos</h3></div></div>${movements.slice(0,5).map(m=>`<div class="summary-movement"><span>${escapeHtml(m.description)}</span><strong class="movement-amount ${m.type}">${m.type==="income"?"+":"−"} ${money(m.amount)}</strong></div>`).join("")||"<div class='empty-inline'>No hay movimientos.</div>"}</section></section>`;
}
function showHome(){document.querySelectorAll(".nav-item").forEach(b=>b.classList.toggle("active",b.dataset.view==="home")); location.reload();}
document.querySelectorAll(".nav-item").forEach(b=>b.addEventListener("click",()=>b.dataset.view==="settings"?showSettings():b.dataset.view==="home"?showHome():showSummary()));

init();
