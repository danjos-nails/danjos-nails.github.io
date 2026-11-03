/* =========================================================
   D’Anjos Nails — painel da profissional
   Todo acesso passa pelo Supabase com login. As regras de
   segurança (RLS) no banco garantem que só administradoras
   veem e alteram dados. Nenhuma chave secreta fica aqui.
   ========================================================= */
(() => {
"use strict";
const S = window.SITE;
const SA = document.getElementById("semArquivos"); if (SA) SA.remove();
const TZ = "America/Sao_Paulo";
const OFFSET = "-03:00"; // horário de Brasília (sem horário de verão desde 2019)
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const el = (tag, props = {}, ...kids) => {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (v == null || v === false) continue;
    if (k === "class") n.className = v; else if (k === "text") n.textContent = v; else if (k === "html") n.innerHTML = v;
    else if (k.startsWith("on")) n.addEventListener(k.slice(2), v); else n.setAttribute(k, v === true ? "" : v);
  }
  kids.flat().forEach(c => c != null && c !== false && n.append(c));
  return n;
};
const LOTUS = `<svg viewBox="0 0 64 42" fill="none" stroke="currentColor" stroke-width="1.1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M32 3c5.5 7.5 5.5 20 0 29.5C26.5 23 26.5 10.5 32 3Z"/><path d="M32 32.5c-1.8-10.5-8.8-18.6-18.3-20.6 0 10.4 7.2 19.4 18.3 20.6Z"/><path d="M32 32.5c1.8-10.5 8.8-18.6 18.3-20.6 0 10.4-7.2 19.4-18.3 20.6Z"/><path d="M32 32.5C23.8 26.4 12 24.2 2.8 26.4c7.3 6.3 18 8.4 29.2 6.1Z"/><path d="M32 32.5c8.2-6.1 20-8.3 29.2-6.1-7.3 6.3-18 8.4-29.2 6.1Z"/></svg>`;
$$(".lotus").forEach(e => e.innerHTML = LOTUS);
$$("[data-nome]").forEach(e => e.textContent = S.marca.nome);

const fmt = (d, o) => new Intl.DateTimeFormat("pt-BR", { timeZone: TZ, ...o }).format(new Date(d));
const hora = d => fmt(d, { hour: "2-digit", minute: "2-digit" });
const diaLongo = d => fmt(d, { weekday: "long", day: "numeric", month: "long" });
const diaCurto = d => fmt(d, { day: "2-digit", month: "2-digit", year: "numeric" });
const diaKey = d => new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(d));
const inicioDia = key => new Date(`${key}T00:00:00${OFFSET}`);
const addDias = (key, n) => diaKey(new Date(inicioDia(key).getTime() + n * 864e5 + 6 * 36e5));
const brl = c => (c / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fone = p => { const d = (p || "").replace(/^55/, ""); return d.length === 11 ? `(${d.slice(0,2)}) ${d.slice(2,7)}-${d.slice(7)}` : d; };
const zapPara = (phone, txt) => `https://wa.me/${phone}?text=${encodeURIComponent(txt)}`;
const linkCliente = token => `${location.href.replace(/admin\.html.*$/, "").replace(/[?#].*$/, "")}?agendamento=${token}`;
const quem = S.marca.profissional ? S.marca.profissional : S.marca.nome;
const STATUS = { pendente: "Pendente", confirmado: "Confirmado", concluido: "Concluído", cancelado: "Cancelado", faltou: "Faltou" };
const toast = (txt, ms = 2600) => { const t = $("#toast"); t.textContent = txt; t.hidden = false; clearTimeout(toast._t); toast._t = setTimeout(() => t.hidden = true, ms); };
const abrirLink = url => { const a = el("a", { href: url, target: "_blank", rel: "noopener" }); document.body.append(a); a.click(); a.remove(); };
const msgErro = e => {
  const m = (e && e.message) || "";
  if (/hours_formato/.test(m)) return "Confira os horários: o início precisa ser antes do fim.";
  if (/sem_sobreposicao/.test(m)) return "Já existe outro agendamento nesse horário.";
  if (/check constraint/.test(m)) return "Algum valor está fora do permitido. Confira os campos.";
  if (/Invalid login/i.test(m)) return "E-mail ou senha incorretos.";
  if (/Email not confirmed/i.test(m)) return "Confirme o e-mail no link enviado pelo Supabase antes de entrar.";
  if (/fetch|network/i.test(m)) return "Sem conexão. Confira a internet e tente de novo.";
  return "Não deu certo: " + (m || "erro desconhecido");
};

/* ---------- diálogo genérico ---------- */
const dlg = $("#dlg");
const abrirDlg = (titulo, ...conteudo) => { $("#dlgTitulo").textContent = titulo; const c = $("#dlgCorpo"); c.innerHTML = ""; c.append(...conteudo); if (!dlg.open) { try { dlg.showModal(); } catch { dlg.setAttribute("open", ""); } } };
const fecharDlg = () => { try { dlg.close(); } catch { dlg.removeAttribute("open"); } };
$("#dlgFechar").addEventListener("click", fecharDlg);
const confirmar = (titulo, texto, rotulo) => new Promise(ok => {
  abrirDlg(titulo, el("p", { text: texto }), el("div", { class: "row" },
    el("button", { type: "button", class: "btn", text: rotulo, onclick: () => { fecharDlg(); ok(true); } }),
    el("button", { type: "button", class: "btn ghost", text: "Voltar", onclick: () => { fecharDlg(); ok(false); } })));
  dlg.addEventListener("close", () => ok(false), { once: true });
});

/* ---------- conexão ---------- */
if (!S.supabase || !S.supabase.url || !S.supabase.chavePublica) { $("#semConfig").hidden = false; return; }
if (!window.supabase || !window.supabase.createClient) {
  $("#semConfig").hidden = false; $("#semConfig h1").textContent = "Não conseguimos carregar o painel";
  $("#semConfig p").textContent = "Confira sua conexão com a internet e recarregue a página."; return;
}
// link de convite ou de "esqueci a senha": guardar antes do Supabase ler o endereço
let PEDIR_SENHA = /type=(invite|recovery|signup)/.test(location.hash);
const sb = window.supabase.createClient(S.supabase.url, S.supabase.chavePublica);
if (window.PAINEL_DEMO) {
  $("#demoPainel").hidden = false;
  $("#loginSub").textContent = "Demonstração: digite qualquer e-mail e senha para entrar.";
  $("#lgEmail").value = "demonstracao@exemplo.com"; $("#lgSenha").value = "demonstracao";
}

/* ---------- login ---------- */
const formLogin = $("#formLogin"), lgErro = $("#lgErro"), lgOk = $("#lgOk"), lgBtn = $("#lgBtn");
const loginErro = t => { lgErro.hidden = !t; lgErro.textContent = t || ""; };
formLogin.addEventListener("submit", async e => {
  e.preventDefault(); loginErro(); lgOk.hidden = true;
  const email = $("#lgEmail").value.trim(), senha = $("#lgSenha").value;
  if (!email || !senha) return loginErro("Preencha e-mail e senha.");
  lgBtn.classList.add("loading"); lgBtn.disabled = true;
  const { error } = await sb.auth.signInWithPassword({ email, password: senha });
  lgBtn.classList.remove("loading"); lgBtn.disabled = false;
  if (error) return loginErro(msgErro(error));
  entrar();
});
$("#lgEsqueci").addEventListener("click", async () => {
  loginErro(); const email = $("#lgEmail").value.trim();
  if (!email) return loginErro("Digite seu e-mail acima e toque de novo em Esqueci minha senha.");
  const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: location.href.replace(/[?#].*$/, "") });
  if (error) return loginErro(msgErro(error));
  lgOk.hidden = false; lgOk.textContent = "Se esse e-mail estiver cadastrado, você vai receber um link para criar uma nova senha.";
});
$("#formNovaSenha").addEventListener("submit", async e => {
  e.preventDefault(); const s = $("#nsSenha").value, er = $("#nsErro");
  if (s.length < 8) { er.hidden = false; er.textContent = "Use pelo menos 8 caracteres."; return; }
  const { error } = await sb.auth.updateUser({ password: s });
  if (error) { er.hidden = false; er.textContent = msgErro(error); return; }
  PEDIR_SENHA = false; history.replaceState(null, "", location.pathname);
  $("#formNovaSenha").hidden = true; formLogin.hidden = false; toast("Senha salva. Bem-vinda!"); entrar();
});
const pedirSenha = () => { $("#telaLogin").hidden = false; $("#app").hidden = true; formLogin.hidden = true; $("#formNovaSenha").hidden = false; $("#nsSenha").focus(); };
sb.auth.onAuthStateChange(ev => { if (ev === "PASSWORD_RECOVERY") { PEDIR_SENHA = true; pedirSenha(); } });
$("#btnSair").addEventListener("click", async () => { await sb.auth.signOut(); location.reload(); });

async function entrar() {
  const { data: s } = await sb.auth.getSession();
  if (!s || !s.session) { $("#telaLogin").hidden = false; $("#app").hidden = true; return; }
  if (PEDIR_SENHA) { pedirSenha(); return; }
  const { data: ok, error } = await sb.rpc("am_i_admin");
  if (error || !ok) {
    await sb.auth.signOut(); $("#telaLogin").hidden = false; $("#app").hidden = true;
    loginErro(error ? msgErro(error) : "Esta conta não tem acesso ao painel."); return;
  }
  $("#telaLogin").hidden = true; $("#app").hidden = false;
  irTab("agenda");
}

/* ---------- abas ---------- */
const CARREGA = {};
function irTab(id) {
  $$(".tabs button").forEach(b => b.dataset.tab === id ? b.setAttribute("aria-current", "page") : b.removeAttribute("aria-current"));
  $$(".painel").forEach(p => p.hidden = p.id !== "tab-" + id);
  irTab.atual = id; scrollTo(0, 0); CARREGA[id] && CARREGA[id]();
}
$$(".tabs button").forEach(b => b.addEventListener("click", () => irTab(b.dataset.tab)));
$("#btnAtualizar").addEventListener("click", async e => { e.currentTarget.classList.add("girando"); await (CARREGA[irTab.atual] && CARREGA[irTab.atual]()); e.currentTarget.classList.remove("girando"); toast("Atualizado."); });
const carregandoEm = box => { box.innerHTML = ""; box.append(el("div", { class: "estado-adm" }, el("span", { class: "spin", "aria-hidden": "true" }), "Carregando…")); };
const erroEm = (box, e, retry) => { box.innerHTML = ""; box.append(el("div", { class: "estado erro-box" }, el("span", { text: msgErro(e) }), el("button", { type: "button", class: "btn ghost sm", text: "Tentar de novo", onclick: retry }))); };

/* =========================================================
   AGENDA
   ========================================================= */
let vista = "hoje";
$$("#tab-agenda .seg .chip").forEach(b => b.addEventListener("click", () => { vista = b.dataset.v; $$("#tab-agenda .seg .chip").forEach(x => x.setAttribute("aria-pressed", String(x === b))); CARREGA.agenda(); }));
let CLIENTES = new Map();
async function buscaClientes(ids) {
  const faltam = [...new Set(ids)].filter(id => !CLIENTES.has(id)); if (!faltam.length) return;
  const { data, error } = await sb.from("clients").select("*").in("id", faltam); if (error) throw error;
  data.forEach(c => CLIENTES.set(c.id, c));
}
CARREGA.agenda = async () => {
  const box = $("#agLista"); carregandoEm(box);
  const hoje = diaKey(new Date()), agora = new Date().toISOString();
  let q = sb.from("appointments").select("*");
  if (vista === "hoje") q = q.gte("starts_at", inicioDia(hoje).toISOString()).lt("starts_at", inicioDia(addDias(hoje, 1)).toISOString()).order("starts_at");
  if (vista === "amanha") q = q.gte("starts_at", inicioDia(addDias(hoje, 1)).toISOString()).lt("starts_at", inicioDia(addDias(hoje, 2)).toISOString()).order("starts_at");
  if (vista === "semana") q = q.gte("starts_at", inicioDia(hoje).toISOString()).lt("starts_at", inicioDia(addDias(hoje, 7)).toISOString()).order("starts_at");
  if (vista === "pendentes") q = q.eq("status", "pendente").gte("starts_at", agora).order("starts_at");
  if (vista === "historico") q = q.lt("starts_at", agora).gte("starts_at", inicioDia(addDias(hoje, -60)).toISOString()).order("starts_at", { ascending: false });
  try {
    const [{ data, error }, pend, amanha] = await Promise.all([q,
      sb.from("appointments").select("id").eq("status", "pendente").gte("starts_at", agora),
      sb.from("appointments").select("id, status, reminded_at").eq("status", "confirmado").gte("starts_at", inicioDia(addDias(hoje, 1)).toISOString()).lt("starts_at", inicioDia(addDias(hoje, 2)).toISOString())]);
    if (error) throw error;
    $("#cntPend").textContent = pend.data && pend.data.length ? pend.data.length : "";
    const semLembrete = (amanha.data || []).filter(a => !a.reminded_at).length;
    const lb = $("#boxLembrete"); lb.hidden = !semLembrete || vista === "amanha"; lb.innerHTML = "";
    if (semLembrete) lb.append(el("span", { text: `${semLembrete} ${semLembrete > 1 ? "clientes de amanhã ainda não receberam" : "cliente de amanhã ainda não recebeu"} o lembrete.` }),
      el("button", { type: "button", class: "btn sm", text: "Ver amanhã", onclick: () => $('#tab-agenda .chip[data-v="amanha"]').click() }));
    await buscaClientes(data.map(a => a.client_id));
    box.innerHTML = "";
    const ativos = data.filter(a => ["pendente", "confirmado"].includes(a.status)).length;
    $("#agResumo").textContent = { hoje: `${ativos} atendimento(s) hoje`, amanha: `${ativos} atendimento(s) amanhã`, semana: `${ativos} nos próximos 7 dias`, pendentes: `${data.length} aguardando sua confirmação`, historico: "Últimos 60 dias" }[vista];
    if (!data.length) { box.append(el("div", { class: "vazio-adm", text: { hoje: "Nenhum atendimento hoje.", amanha: "Nenhum atendimento amanhã.", semana: "Nenhum atendimento nos próximos 7 dias.", pendentes: "Nada pendente. Tudo confirmado!", historico: "Nenhum atendimento nos últimos 60 dias." }[vista] })); return; }
    let ultimoDia = "";
    data.forEach(a => {
      const k = diaKey(a.starts_at);
      if (["semana", "pendentes", "historico"].includes(vista) && k !== ultimoDia) { ultimoDia = k; box.append(el("p", { class: "dia-h", text: diaLongo(a.starts_at) })); }
      box.append(cartaoAg(a));
    });
  } catch (e) { erroEm(box, e, CARREGA.agenda); }
};
function cartaoAg(a) {
  const c = CLIENTES.get(a.client_id) || { name: "Cliente", phone: "" };
  const ad = a.address || {};
  const end = [ad.rua && `${ad.rua}, ${ad.numero || "s/n"}`, ad.compl, ad.bairro, ad.cidade].filter(Boolean).join(" · ");
  const acts = el("div", { class: "acts" });
  const btn = (txt, cls, fn) => acts.append(el("button", { type: "button", class: "btn sm " + (cls || ""), text: txt, onclick: fn }));
  const prim = c.name.split(" ")[0];
  const quando = `${diaLongo(a.starts_at)}, às ${hora(a.starts_at)}`;
  if (a.status === "pendente") {
    btn("Confirmar", "", () => mudar(a, { status: "confirmado", confirmed_at: new Date().toISOString() }, "Confirmado.",
      `Olá, ${prim}! Aqui é ${quem}. Seu horário está confirmado: ${quando}.\nServiços: ${a.service_names}.\nSe precisar cancelar ou remarcar, use este link: ${linkCliente(a.manage_token)}\nAté lá! 💅`, c.phone));
    btn("Recusar", "ghost", () => cancelar(a, c));
  }
  if (a.status === "confirmado") {
    btn(a.reminded_at ? "Lembrar de novo" : "Enviar lembrete", a.reminded_at ? "ghost" : "", () => mudar(a, { reminded_at: new Date().toISOString() }, "Lembrete marcado como enviado.",
      `Olá, ${prim}! Passando para lembrar do seu atendimento ${quando}.\nServiços: ${a.service_names}.\nQualquer imprevisto, me avise por aqui. Até lá!`, c.phone));
    if (new Date(a.starts_at) < new Date()) { btn("Concluído", "ghost", () => mudar(a, { status: "concluido" }, "Marcado como concluído.")); btn("Faltou", "ghost", () => mudar(a, { status: "faltou" }, "Marcado como falta.")); }
    btn("Cancelar", "ghost", () => cancelar(a, c));
  }
  if (c.phone) acts.append(el("a", { class: "btn sm ghost", href: zapPara(c.phone, `Olá, ${prim}! Aqui é ${quem}.`), target: "_blank", rel: "noopener", text: "WhatsApp" }));
  return el("article", { class: "cartao ag " + a.status },
    el("div", { class: "hr" }, hora(a.starts_at), el("small", { text: "até " + hora(a.ends_at) })),
    el("div", { class: "nm" }, el("button", { type: "button", class: "link-btn", text: c.name, onclick: () => abrirCliente(c.id) }), el("span", { class: "status st-" + a.status, text: STATUS[a.status] })),
    el("div", { class: "sv", text: a.service_names + (a.price_cents != null ? " · " + brl(a.price_cents) : "") }),
    el("div", { class: "ad" }, fone(c.phone), end ? " · " + end : "", ad.ref ? ` (ref.: ${ad.ref})` : ""),
    a.notes ? el("div", { class: "obs", text: "“" + a.notes + "”" }) : null,
    acts);
}
async function mudar(a, campos, okTxt, msgZap, phone) {
  // abre o WhatsApp no mesmo toque (o navegador bloqueia se for depois)
  if (msgZap && phone) abrirLink(zapPara(phone, msgZap));
  const { error } = await sb.from("appointments").update(campos).eq("id", a.id);
  if (error) { toast(msgErro(error), 4000); return; }
  toast(okTxt); CARREGA.agenda();
}
async function cancelar(a, c) {
  const ok = await confirmar("Cancelar este horário?", `${c.name} · ${diaLongo(a.starts_at)}, às ${hora(a.starts_at)}. O horário volta a ficar livre no site.`, "Sim, cancelar");
  if (!ok) return;
  const { error } = await sb.from("appointments").update({ status: "cancelado", cancelled_at: new Date().toISOString(), cancelled_by: "profissional" }).eq("id", a.id);
  if (error) { toast(msgErro(error), 4000); return; }
  CARREGA.agenda();
  abrirDlg("Horário cancelado", el("p", { text: "Quer avisar a cliente pelo WhatsApp?" }), el("div", { class: "row" },
    el("a", { class: "btn", href: zapPara(c.phone, `Olá, ${c.name.split(" ")[0]}! Aqui é ${quem}. Infelizmente precisei cancelar seu horário de ${diaLongo(a.starts_at)}, às ${hora(a.starts_at)}. Podemos remarcar? Me diga o melhor dia para você.`), target: "_blank", rel: "noopener", text: "Avisar no WhatsApp", onclick: fecharDlg }),
    el("button", { type: "button", class: "btn ghost", text: "Agora não", onclick: fecharDlg })));
}

/* =========================================================
   FOLGAS E BLOQUEIOS
   ========================================================= */
let tipoBloq = "dia";
$$("#formBloq .chip").forEach(b => b.addEventListener("click", () => { tipoBloq = b.dataset.tipo; $$("#formBloq .chip").forEach(x => x.setAttribute("aria-pressed", String(x === b))); $$("#formBloq .per").forEach(p => p.hidden = tipoBloq !== "periodo"); }));
$("#bqIni").addEventListener("change", () => { if (!$("#bqFim").value || $("#bqFim").value < $("#bqIni").value) $("#bqFim").value = $("#bqIni").value; });
$("#formBloq").addEventListener("submit", async e => {
  e.preventDefault(); const er = $("#bqErro"); er.hidden = true;
  const di = $("#bqIni").value, df = $("#bqFim").value || di;
  if (!di) { er.hidden = false; er.textContent = "Escolha a data."; return; }
  if (df < di) { er.hidden = false; er.textContent = "A data final precisa ser igual ou depois da inicial."; return; }
  let ini, fim;
  if (tipoBloq === "dia") { ini = `${di}T00:00:00${OFFSET}`; fim = inicioDia(addDias(df, 1)).toISOString(); }
  else { const hi = $("#bqHi").value, hf = $("#bqHf").value; if (!hi || !hf || hf <= hi) { er.hidden = false; er.textContent = "O horário final precisa ser depois do inicial."; return; }
    if (df !== di) { er.hidden = false; er.textContent = "Para bloquear só um período, use a mesma data de início e fim."; return; }
    ini = `${di}T${hi}:00${OFFSET}`; fim = `${di}T${hf}:00${OFFSET}`; }
  const { error } = await sb.from("time_off").insert({ starts_at: ini, ends_at: fim, reason: $("#bqMotivo").value.trim() || null });
  if (error) { er.hidden = false; er.textContent = msgErro(error); return; }
  $("#bqMotivo").value = ""; toast("Bloqueio salvo. Esses horários já não aparecem no site."); CARREGA.bloqueios();
  // avisa se já havia clientes nesse período
  const { data } = await sb.from("appointments").select("id").in("status", ["pendente", "confirmado"]).lt("starts_at", fim).gt("block_until", ini);
  if (data && data.length) abrirDlg("Atenção", el("p", { text: `Você já tem ${data.length} atendimento(s) nesse período. O bloqueio não cancela ninguém: veja na Agenda se precisa remarcar.` }), el("button", { type: "button", class: "btn", text: "Entendi", onclick: fecharDlg }));
});
CARREGA.bloqueios = async () => {
  const box = $("#bqLista"); carregandoEm(box);
  if (!$("#bqIni").value) { $("#bqIni").value = diaKey(new Date()); $("#bqFim").value = $("#bqIni").value; }
  const { data, error } = await sb.from("time_off").select("*").gte("ends_at", new Date().toISOString()).order("starts_at");
  if (error) return erroEm(box, error, CARREGA.bloqueios);
  box.innerHTML = "";
  if (!data.length) { box.append(el("div", { class: "vazio-adm", text: "Nenhum bloqueio futuro." })); return; }
  data.forEach(t => {
    const diaInteiro = hora(t.starts_at) === "00:00" && hora(t.ends_at) === "00:00";
    const fimDia = new Date(new Date(t.ends_at).getTime() - 1);
    const txt = diaInteiro ? (diaKey(t.starts_at) === diaKey(fimDia) ? diaLongo(t.starts_at) : `${diaCurto(t.starts_at)} até ${diaCurto(fimDia)}`) + " · dia inteiro"
                           : `${diaLongo(t.starts_at)} · ${hora(t.starts_at)} às ${hora(t.ends_at)}`;
    box.append(el("div", { class: "cartao bq" }, el("div", {}, el("b", { text: txt }), el("span", { text: t.reason || "Sem motivo" })),
      el("button", { type: "button", class: "btn sm ghost", text: "Remover", "aria-label": "Remover bloqueio de " + txt, onclick: async () => {
        if (!await confirmar("Remover bloqueio?", txt + ". Os horários voltam a aparecer no site.", "Remover")) return;
        const { error: er } = await sb.from("time_off").delete().eq("id", t.id); if (er) return toast(msgErro(er), 4000); toast("Bloqueio removido."); CARREGA.bloqueios(); } })));
  });
};

/* =========================================================
   SERVIÇOS
   ========================================================= */
CARREGA.servicos = async () => {
  const box = $("#svLista"); carregandoEm(box);
  const { data, error } = await sb.from("services").select("*").order("sort");
  if (error) return erroEm(box, error, CARREGA.servicos);
  box.innerHTML = "";
  if (!data.length) box.append(el("div", { class: "vazio-adm", text: "Nenhum serviço cadastrado ainda." }));
  data.forEach(s => box.append(el("div", { class: "cartao sv-item" + (s.active ? "" : " inativo") },
    el("div", {}, el("b", { text: s.name }), el("br"), el("small", { text: `${s.duration_min} min · ${{ maos: "Mãos", pes: "Pés", extra: "Extra" }[s.category]}${s.is_addon ? " · adicional" : ""}${s.active ? "" : " · desativado"}` })),
    el("span", { class: "pr" + (s.price_cents == null ? " falta" : ""), text: s.price_cents == null ? "Sem preço" : brl(s.price_cents) }),
    el("div", { class: "acts" }, el("button", { type: "button", class: "btn sm", text: "Editar", onclick: () => editarServ(s) })))));
};
$("#svNovo").addEventListener("click", () => editarServ(null));
function editarServ(s) {
  const novo = !s; s = s || { name: "", summary: "", benefits: [], care: [], maintenance: "", duration_min: 60, price_cents: null, category: "maos", is_addon: false, active: true, sort: 99 };
  const f = (id, label, input) => el("div", { class: "f" + (["svNome", "svRes", "svBen", "svCui", "svMan"].includes(id) ? " full" : "") }, el("label", { for: id, text: label }), input);
  const preco = s.price_cents == null ? "" : (s.price_cents / 100).toFixed(2).replace(".", ",");
  const form = el("form", { class: "form", novalidate: true },
    el("div", { class: "campos" },
      f("svNome", "Nome", el("input", { id: "svNome", value: s.name, maxlength: "80", required: true })),
      f("svPreco", "Preço em R$ (vazio = sob consulta)", el("input", { id: "svPreco", value: preco, inputmode: "decimal", placeholder: "Ex.: 70,00" })),
      f("svDur", "Duração (minutos)", el("input", { id: "svDur", type: "number", min: "10", max: "480", step: "5", value: String(s.duration_min), inputmode: "numeric" })),
      f("svCat", "Categoria", (() => { const x = el("select", { id: "svCat" }); [["maos", "Mãos"], ["pes", "Pés"], ["extra", "Extra"]].forEach(([v, t]) => x.append(el("option", { value: v, text: t, selected: s.category === v }))); return x; })()),
      f("svOrdem", "Ordem no site", el("input", { id: "svOrdem", type: "number", value: String(s.sort), inputmode: "numeric" })),
      f("svRes", "Descrição", el("textarea", { id: "svRes", rows: "3", maxlength: "600" }, s.summary)),
      f("svBen", "Benefícios (um por linha)", el("textarea", { id: "svBen", rows: "3" }, (s.benefits || []).join("\n"))),
      f("svCui", "Cuidados depois (um por linha)", el("textarea", { id: "svCui", rows: "3" }, (s.care || []).join("\n"))),
      f("svMan", "Manutenção (opcional)", el("textarea", { id: "svMan", rows: "2", maxlength: "400" }, s.maintenance || ""))),
    el("div", { class: "chk-row" },
      el("label", {}, el("input", { type: "checkbox", id: "svAdd", checked: s.is_addon }), "É um adicional (ex.: nail art)"),
      el("label", {}, el("input", { type: "checkbox", id: "svAtivo", checked: s.active }), "Aparece no site")),
    el("p", { class: "erro", id: "svErro", role: "alert", hidden: true }),
    el("div", { class: "row" }, el("button", { type: "submit", class: "btn", text: "Salvar" }), el("button", { type: "button", class: "btn ghost", text: "Cancelar", onclick: fecharDlg })));
  form.addEventListener("submit", async e => {
    e.preventDefault(); const er = $("#svErro"); const erro = t => { er.hidden = false; er.textContent = t; };
    const nome = $("#svNome").value.trim(); if (nome.length < 2) return erro("Digite o nome do serviço.");
    const pTxt = $("#svPreco").value.trim().replace(/\s|R\$/g, "").replace(/\.(?=\d{3}(\D|$))/g, "").replace(",", ".");
    let price = null; if (pTxt) { price = Math.round(Number(pTxt) * 100); if (!Number.isFinite(price) || price < 0) return erro("Preço inválido. Use, por exemplo, 70,00."); }
    const durV = parseInt($("#svDur").value, 10); if (!(durV >= 10 && durV <= 480)) return erro("A duração precisa ficar entre 10 e 480 minutos.");
    const linhas = id => $("#" + id).value.split("\n").map(x => x.trim()).filter(Boolean).slice(0, 8);
    const dados = { name: nome, price_cents: price, duration_min: durV, category: $("#svCat").value, sort: parseInt($("#svOrdem").value, 10) || 0,
      summary: $("#svRes").value.trim(), benefits: linhas("svBen"), care: linhas("svCui"), maintenance: $("#svMan").value.trim() || null,
      is_addon: $("#svAdd").checked, active: $("#svAtivo").checked };
    let r;
    if (novo) { const id = nome.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "servico"; r = await sb.from("services").insert({ id, ...dados }); }
    else r = await sb.from("services").update(dados).eq("id", s.id);
    if (r.error) return erro(/duplicate key/.test(r.error.message) ? "Já existe um serviço com esse nome." : msgErro(r.error));
    fecharDlg(); toast("Serviço salvo. O site já mostra a mudança."); CARREGA.servicos();
  });
  abrirDlg(novo ? "Novo serviço" : "Editar serviço", form);
}

/* =========================================================
   HORÁRIOS
   ========================================================= */
const DL = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
CARREGA.horarios = async () => {
  const sem = $("#semana"); carregandoEm(sem);
  const { data, error } = await sb.from("settings").select("*").eq("id", 1).maybeSingle();
  if (error || !data) return erroEm(sem, error || { message: "configuração não encontrada" }, CARREGA.horarios);
  sem.innerHTML = "";
  [1, 2, 3, 4, 5, 6, 0].forEach(d => {
    const h = data.hours[String(d)];
    const on = el("input", { type: "checkbox", id: "hd" + d, checked: !!h, "aria-label": "Atende " + DL[d] });
    const ini = el("input", { type: "time", id: "hi" + d, value: h ? h[0] : "09:00", "aria-label": DL[d] + " início" });
    const fim = el("input", { type: "time", id: "hf" + d, value: h ? h[1] : "18:00", "aria-label": DL[d] + " fim" });
    const hh = el("div", { class: "hh" }, ini, "às", fim); hh.hidden = !h;
    on.addEventListener("change", () => hh.hidden = !on.checked);
    sem.append(el("div", { class: "dia-cfg" }, el("b", { text: DL[d] }), el("label", { class: "switch" }, on, el("span")), hh));
  });
  $("#hrBuffer").value = data.buffer_min; $("#hrStep").value = String(data.step_min); $("#hrNotice").value = Math.round(data.min_notice_min / 60);
  $("#hrDias").value = data.days_ahead; $("#hrCancel").value = Math.round(data.cancel_notice_min / 60);
};
$("#formHor").addEventListener("submit", async e => {
  e.preventDefault(); const er = $("#hrErro"), ok = $("#hrOk"); er.hidden = true; ok.hidden = true;
  const hours = {};
  for (let d = 0; d < 7; d++) {
    if (!$("#hd" + d).checked) { hours[d] = null; continue; }
    const a = $("#hi" + d).value, b = $("#hf" + d).value;
    if (!a || !b || b <= a) { er.hidden = false; er.textContent = `${DL[d]}: o horário final precisa ser depois do inicial.`; return; }
    hours[d] = [a, b];
  }
  const num = id => parseInt($("#" + id).value, 10);
  const dados = { hours, buffer_min: num("hrBuffer"), step_min: num("hrStep"), min_notice_min: num("hrNotice") * 60, days_ahead: num("hrDias"), cancel_notice_min: num("hrCancel") * 60 };
  if (Object.values(dados).some(v => typeof v === "number" && !Number.isFinite(v))) { er.hidden = false; er.textContent = "Preencha todos os campos com números."; return; }
  const { error } = await sb.from("settings").update(dados).eq("id", 1);
  if (error) { er.hidden = false; er.textContent = msgErro(error); return; }
  ok.hidden = false; ok.textContent = "Horários salvos. A agenda do site já usa os novos horários.";
});

/* =========================================================
   CLIENTES
   ========================================================= */
let TODAS = [];
CARREGA.clientes = async () => {
  const box = $("#cliLista"); carregandoEm(box);
  const { data, error } = await sb.from("clients").select("*").order("name");
  if (error) return erroEm(box, error, CARREGA.clientes);
  TODAS = data; data.forEach(c => CLIENTES.set(c.id, c)); pintaClientes();
};
const norm = s => (s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
function pintaClientes() {
  const box = $("#cliLista"), q = norm($("#cliBusca").value.trim()), qd = q.replace(/\D/g, "");
  const lista = TODAS.filter(c => !q || norm(c.name).includes(q) || (qd && c.phone.includes(qd)));
  box.innerHTML = "";
  if (!lista.length) { box.append(el("div", { class: "vazio-adm", text: TODAS.length ? "Nenhuma cliente encontrada." : "As clientes aparecem aqui depois do primeiro agendamento." })); return; }
  lista.forEach(c => box.append(el("button", { type: "button", class: "cartao cli", onclick: () => abrirCliente(c.id) }, el("div", {}, el("b", { text: c.name }), el("span", { text: fone(c.phone) })), el("span", { "aria-hidden": "true", text: "→" }))));
}
$("#cliBusca").addEventListener("input", pintaClientes);
async function abrirCliente(id) {
  const c = CLIENTES.get(id); if (!c) return;
  abrirDlg(c.name, el("div", { class: "estado-adm" }, el("span", { class: "spin" }), "Carregando histórico…"));
  const { data, error } = await sb.from("appointments").select("*").eq("client_id", id).order("starts_at", { ascending: false });
  if (error) { abrirDlg(c.name, el("p", { class: "erro", text: msgErro(error) })); return; }
  const notas = el("textarea", { id: "cliNotas", rows: "3", maxlength: "1000", placeholder: "Preferências, alergias informadas, formato de unha…" }, c.notes || "");
  const feitos = data.filter(a => a.status === "concluido").length, faltas = data.filter(a => a.status === "faltou").length;
  abrirDlg(c.name,
    el("p", {}, fone(c.phone), " · ", el("a", { href: zapPara(c.phone, `Olá, ${c.name.split(" ")[0]}! Aqui é ${quem}.`), target: "_blank", rel: "noopener", text: "Abrir WhatsApp" })),
    el("p", { class: "nota", text: `Cliente desde ${diaCurto(c.created_at)} · ${feitos} atendimento(s) concluído(s)${faltas ? ` · ${faltas} falta(s)` : ""}` }),
    el("div", { class: "f" }, el("label", { for: "cliNotas", text: "Anotações (só você vê)" }), notas),
    el("button", { type: "button", class: "btn sm", text: "Salvar anotações", onclick: async () => {
      const { error: er } = await sb.from("clients").update({ notes: notas.value.trim() || null }).eq("id", id);
      if (er) return toast(msgErro(er), 4000); c.notes = notas.value.trim() || null; toast("Anotações salvas."); } }),
    el("h3", { class: "h-sm", text: "Histórico" }),
    data.length ? el("div", { class: "hist" }, data.map(a => el("div", {}, el("span", { text: `${diaCurto(a.starts_at)} ${hora(a.starts_at)} · ${a.service_names}` }), el("span", { class: "status st-" + a.status, text: STATUS[a.status] })))) : el("p", { class: "nota", text: "Sem atendimentos." }));
}

/* ---------- atualização automática da agenda ---------- */
setInterval(() => { if (!document.hidden && !$("#app").hidden && irTab.atual === "agenda" && !dlg.open) CARREGA.agenda(); }, 60000);

entrar();
})();
