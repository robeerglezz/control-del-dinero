// Configuración de Supabase.
// La anon/publishable key NO es un secreto. La seguridad se consigue con RLS en Supabase.
// Sustituye estos valores por los de tu proyecto.
window.SUPABASE_URL = "https://zscahalavxgdpnbztqah.supabase.co";
window.SUPABASE_ANON_KEY = "sb_publishable_W7dHIBbtgmTqKGVjaKTDAw_ccnoCUDu";


window.addEventListener("error", (event) => {
  const box = document.getElementById("authMessage");
  if (box && !box.textContent) box.textContent = "Error de la aplicación: " + (event.message || "revisa la configuración de Supabase.");
});
