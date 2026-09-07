const { createClient } = window.supabase;
const db = createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);

const $ = id => document.getElementById(id);
const categories = {
  expense: ["Alimentación","Transporte","Casa","Ocio","Compras","Suscripciones","Salud","Estudios","Otros"],
  income: ["Sueldo","Freelance","Ventas","Regalo","Inversión","Otros"]
};
let session = null, movements = [], currentType = "expense", authMode = "login";

const euro = n => new Intl.NumberFormat("es-ES",{style:"currency",currency:"EUR"}).format(Number(n)||0);
const dateES = d => new Intl.DateTimeFormat("es-ES",{day:"2-digit",month:"short",year:"numeric"}).format(new Date(d+"T12:00:00"));
const today = () => new Date().toISOString().slice(0,10);

function toast(msg){$("toast").textContent=msg;$("toast").classList.add("show");setTimeout(()=>$("toast").classList.remove("show"),2200)}
function setAuthMessage(msg=""){ $("authMessage").textContent=msg }

function updateCategoryOptions(type, selected=""){
  $("category").innerHTML = categories[type].map(c=>`<option ${c===selected?"selected":""}>${c}</option>`).join("");
}
function updateCategoryFilter(){
  const all=[...new Set(movements.map(m=>m.category).filter(Boolean))].sort();
  $("categoryFilter").innerHTML='<option value="all">Todas las categorías</option>'+all.map(c=>`<option>${c}</option>`).join("");
}

async function init(){
  const {data:{session:s}}=await db.auth.getSession();
  session=s; renderAuth();
  db.auth.onAuthStateChange((_e,s2)=>{session=s2;renderAuth();if(s2) loadMovements()});
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
const WIZARD_TOTAL = 5;
function openModal(m=null){
  $("modal").classList.remove("hidden");
  $("movementId").value=m?.id||""; $("modalTitle").textContent=m?"Editar movimiento":"Nuevo movimiento";
  currentType=m?.type||"expense";
  document.querySelectorAll(".type-btn").forEach(b=>b.classList.toggle("active",b.dataset.type===currentType));
  updateCategoryOptions(currentType,m?.category||categories[currentType][0]);
  $("amount").value=m?.amount??""; $("description").value=m?.description??""; $("date").value=m?.date||today(); $("paymentMethod").value=m?.payment_method||"Tarjeta";
  $("deleteBtn").classList.toggle("hidden",!m); wizardStep=1; updateWizard();
  setTimeout(()=>$("amount").focus(),120);
}
function closeModal(){$("modal").classList.add("hidden")}
function updateWizard(){
  document.querySelectorAll(".wizard-step").forEach(x=>x.classList.toggle("active",Number(x.dataset.step)===wizardStep));
  $("wizardStepLabel").textContent=`Paso ${wizardStep} de ${WIZARD_TOTAL}`;
  $("wizardProgressBar").style.width=`${wizardStep/WIZARD_TOTAL*100}%`;
  $("wizardBack").classList.toggle("hidden",wizardStep===1);
  $("wizardNext").classList.toggle("hidden",wizardStep===WIZARD_TOTAL);
  $("wizardSave").classList.toggle("hidden",wizardStep!==WIZARD_TOTAL);
  if(wizardStep===WIZARD_TOTAL) $("wizardSummary").innerHTML=`<strong>${currentType==="income"?"Ingreso":"Gasto"}</strong><br>${escapeHtml($("description").value)} · ${escapeHtml($("category").value)}<br>${euro($("amount").value)} · ${dateES($("date").value)} · ${escapeHtml($("paymentMethod").value)}`;
}
function validateWizardStep(){
  const ids={1:"amount",2:"description",3:"category",4:"date",5:"paymentMethod"}; const el=$(ids[wizardStep]);
  if(!el.checkValidity()){el.reportValidity();return false} return true;
}
$("wizardNext").addEventListener("click",()=>{if(validateWizardStep()&&wizardStep<WIZARD_TOTAL){wizardStep++;updateWizard();document.querySelector(`.wizard-step[data-step="${wizardStep}"] input,.wizard-step[data-step="${wizardStep}"] select`)?.focus()}});
$("wizardBack").addEventListener("click",()=>{if(wizardStep>1){wizardStep--;updateWizard()}});
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
document.querySelectorAll(".nav-item").forEach(b=>b.addEventListener("click",()=>toast(b.dataset.view==="home"?"Inicio":"Esta sección estará disponible próximamente")));

init();
