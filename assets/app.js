/* =========================================================
   D’Anjos Nails — comportamento do site
   Lê tudo de window.SITE (assets/config.js).
   Agenda online via Supabase quando configurado; senão, WhatsApp.
   ========================================================= */
(() => {
"use strict";
const S = window.SITE;
const DEMO = !!S.modoDemonstracao;
const ONLINE = !!(S.supabase && S.supabase.url && S.supabase.chavePublica);
const TZ = "America/Sao_Paulo";
const SDK = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.js";

/* ---------- utilitários ---------- */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const el = (tag, props = {}, ...kids) => {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (v == null || v === false) continue;
    if (k === "class") n.className = v;
    else if (k === "text") n.textContent = v;
    else if (k === "html") n.innerHTML = v;          // só conteúdo fixo do próprio site
    else if (k.startsWith("on")) n.addEventListener(k.slice(2), v);
    else n.setAttribute(k, v === true ? "" : v);
  }
  kids.flat().forEach(c => c != null && c !== false && n.append(c));
  return n;
};
const mostrar = item => !!item && (!item.confirmar || DEMO);
const tagC = (item, txt = "a confirmar") => (item && item.confirmar && DEMO) ? el("span", { class: "tag-c", text: txt }) : null;
const brl = v => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: v % 1 ? 2 : 0 });
const dur = m => m < 60 ? `${m} min` : `${Math.floor(m / 60)}h${m % 60 ? String(m % 60).padStart(2, "0") : ""}`;
const toMin = t => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };
const toHM = m => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
const soDig = s => (s || "").replace(/\D/g, "");
const zap = txt => `https://wa.me/${S.marca.whatsapp}?text=${encodeURIComponent(txt)}`;
const SINAL = S.marca.sinal && Number(S.marca.sinal.valor) > 0 ? S.marca.sinal : null;
const sinalTxt = () => SINAL ? brl(Number(SINAL.valor)) : "";
const foneFmt = (() => { const d = S.marca.whatsapp.replace(/^55/, ""); return d.length === 11 ? `(${d.slice(0,2)}) ${d.slice(2,7)}-${d.slice(7)}` : d; })();
const DIAS = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
const DIAS_L = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
const reduz = matchMedia("(prefers-reduced-motion: reduce)").matches;
const ICON_T = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.2" aria-hidden="true"><circle cx="8" cy="8" r="6.2"/><path d="M8 4.6V8l2.3 1.5"/></svg>';
const ICON_OK = '<svg viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M2.5 6.2 5 8.6l4.5-5"/></svg>';
const quem = S.marca.profissional || "ela";
const precoLabel = (s, curto) => s.preco != null ? (s.adicional ? "+ " : "") + brl(s.preco) : (DEMO ? "Preço a preencher" : (curto ? "Sob consulta" : "Valor sob consulta"));
async function copiar(txt) { try { await navigator.clipboard.writeText(txt); return true; } catch { return false; } }

/* datas no fuso de São Paulo (independe do fuso do aparelho) */
const fmtTZ = (d, o) => new Intl.DateTimeFormat("pt-BR", { timeZone: TZ, ...o }).format(d);
const diaKey = d => new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
const horaTZ = d => fmtTZ(d, { hour: "2-digit", minute: "2-digit" });
const diaLongo = d => fmtTZ(d, { weekday: "long", day: "numeric", month: "long" });

/* ---------- Supabase (carregado só se configurado) ---------- */
let sbPromise = null;
function supa() {
  if (!ONLINE) return Promise.resolve(null);
  if (!sbPromise) sbPromise = new Promise((ok, falha) => {
    const fazer = () => ok(window.supabase.createClient(S.supabase.url, S.supabase.chavePublica, { auth: { persistSession: false } }));
    if (window.supabase && window.supabase.createClient) return fazer();
    const sc = document.createElement("script"); sc.src = SDK; sc.async = true;
    sc.onload = fazer; sc.onerror = () => { sbPromise = null; falha(new Error("SDK")); };
    document.head.append(sc);
  });
  return sbPromise;
}
const ERROS = {
  OCUPADO: "Esse horário acabou de ser reservado. Escolha outro, por favor.",
  ANTECEDENCIA: "Esse horário está muito em cima da hora. Escolha outro, por favor.",
  BLOQUEADO: "Esse horário não está mais disponível. Escolha outro, por favor.",
  FECHADO: "Ela não atende nesse dia. Escolha outro, por favor.",
  FORA_DO_EXPEDIENTE: "Esse horário passa do expediente dela. Escolha outro, por favor.",
  HORARIO_INVALIDO: "Esse horário não é válido. Escolha outro, por favor.",
  MUITO_DISTANTE: "Essa data ainda não está aberta para agendamento.",
  SERVICO_INVALIDO: "Um dos serviços escolhidos não está mais disponível. Atualize a página, por favor.",
  SO_ADICIONAL: "A nail art é um adicional. Escolha também uma esmaltação, manicure ou outro serviço.",
  NOME_INVALIDO: "Confira o seu nome.",
  TELEFONE_INVALIDO: "Confira o seu WhatsApp com DDD.",
  ENDERECO_INVALIDO: "Confira o endereço: rua, número, bairro e cidade são obrigatórios.",
  LIMITE_AGENDAMENTOS: "Você já tem 3 horários marcados. Para marcar mais, fale com ela pelo WhatsApp.",
  NAO_ENCONTRADO: "Não encontramos esse agendamento. Confira o link.",
  JA_ENCERRADO: "Esse agendamento já foi encerrado ou cancelado.",
  PRAZO_ENCERRADO: "O prazo para mudar pelo site já passou. Fale com ela pelo WhatsApp.",
};
const msgErro = e => ERROS[e && e.message] || "Não conseguimos concluir agora. Confira sua internet e tente de novo.";
const horasTexto = min => min >= 1440 && min % 1440 === 0 ? `${min / 1440 === 1 ? "24 horas" : (min / 1440) + " dias"}` : dur(min);

/* ---------- lótus ---------- */
const LOTUS = `<svg viewBox="0 0 64 42" fill="none" stroke="currentColor" stroke-width="1.1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path pathLength="1" d="M32 3c5.5 7.5 5.5 20 0 29.5C26.5 23 26.5 10.5 32 3Z"/><path pathLength="1" d="M32 32.5c-1.8-10.5-8.8-18.6-18.3-20.6 0 10.4 7.2 19.4 18.3 20.6Z"/><path pathLength="1" d="M32 32.5c1.8-10.5 8.8-18.6 18.3-20.6 0 10.4-7.2 19.4-18.3 20.6Z"/><path pathLength="1" d="M32 32.5C23.8 26.4 12 24.2 2.8 26.4c7.3 6.3 18 8.4 29.2 6.1Z"/><path pathLength="1" d="M32 32.5c8.2-6.1 20-8.3 29.2-6.1-7.3 6.3-18 8.4-29.2 6.1Z"/></svg>`;
const pintaLotus = (r = document) => $$(".lotus", r).forEach(e => { if (!e.firstChild) e.innerHTML = LOTUS; });
pintaLotus();

/* ---------- textos básicos ---------- */
$$("[data-nome]").forEach(e => e.textContent = S.marca.nome);
$("#ano").textContent = new Date().getFullYear();
if (DEMO) $("#demoBar").hidden = false;
$("#privInfo").textContent = ONLINE ? `Seus dados ficam guardados com segurança e só ${quem} tem acesso, para organizar o atendimento.` : "Esses dados vão só na mensagem para ela. O site não guarda nada.";
$("#privRodape").textContent = ONLINE
  ? "Os dados informados no agendamento ficam guardados com segurança e são vistos apenas pela profissional, só para organizar o atendimento. Para pedir a exclusão, fale com ela pelo WhatsApp."
  : "Seus dados são usados apenas para montar a mensagem de agendamento enviada pelo WhatsApp. Este site não armazena informações pessoais.";
$("#modoInfo").textContent = ONLINE ? "Os horários mostrados estão livres agora. O valor final e a taxa de deslocamento, se houver, são confirmados por ela." : "Ela confirma a disponibilidade, o valor e a taxa de deslocamento, se houver, pelo WhatsApp.";
$("#enviar .lbl").textContent = ONLINE ? "Confirmar agendamento" : "Enviar pedido pelo WhatsApp";
$("#admLink").hidden = !ONLINE;

/* ---------- topo e menu ---------- */
const topo = $(".topo");
addEventListener("scroll", () => topo.classList.toggle("scrolled", scrollY > 40), { passive: true });
const menuBtn = $("#menuBtn"), sheet = $("#menuSheet");
const setMenu = open => {
  sheet.hidden = !open; menuBtn.setAttribute("aria-expanded", String(open));
  menuBtn.setAttribute("aria-label", open ? "Fechar menu" : "Abrir menu");
  document.documentElement.style.overflow = open ? "hidden" : "";
};
menuBtn.addEventListener("click", () => setMenu(sheet.hidden));
$$("a", sheet).forEach(a => a.addEventListener("click", () => setMenu(false)));
addEventListener("keydown", e => { if (e.key === "Escape" && !sheet.hidden) { setMenu(false); menuBtn.focus(); } });
const navLinks = $$(".nav a");
const secIO = new IntersectionObserver(es => es.forEach(en => {
  if (!en.isIntersecting) return;
  navLinks.forEach(a => a.setAttribute("aria-current", String(a.getAttribute("href") === "#" + en.target.id)));
}), { rootMargin: "-45% 0px -50% 0px" });
$$("main > section[id]").forEach(s => secIO.observe(s));
// links para seções escondidas também somem
function ajustaLinks() { $$('a[href^="#"]').forEach(a => { const h = a.getAttribute("href"); if (h.length < 2) return; const t = document.getElementById(h.slice(1)); a.hidden = !t || !!t.closest("[hidden]"); }); }

/* ---------- início ---------- */
(() => {
  try {
    const c = document.createElement("canvas"); c.width = c.height = 180;
    const x = c.getContext("2d"), d = x.createImageData(180, 180);
    for (let i = 0; i < d.data.length; i += 4) { const v = Math.random() * 255; d.data[i] = d.data[i+1] = d.data[i+2] = v; d.data[i+3] = 255; }
    x.putImageData(d, 0, 0); $(".grain").style.backgroundImage = `url(${c.toDataURL()})`;
  } catch {}
  if (reduz) return;
  const a = $$(".slides img"), b = $$(".feature img"), dots = $$(".sdots span"); let k = 0;
  setInterval(() => {
    if (document.hidden) return;
    [a, b, dots].forEach(l => l[k] && l[k].classList.remove("on"));
    k = (k + 1) % a.length;
    [a, b, dots].forEach(l => l[k] && l[k].classList.add("on"));
  }, 5600);
})();

/* ---------- boas-vindas, sobre, diferenciais, higiene ---------- */
(() => {
  if (!mostrar(S.boasVindas)) $("#boas-vindas").hidden = true;
  else { $("#boasTxt").textContent = "“" + S.boasVindas.texto + "”"; const t = tagC(S.boasVindas); if (t) $("#boasTxt").append(" ", t);
    $("#boasAss").textContent = S.marca.profissional ? `${S.marca.profissional} · ${S.marca.nome}` : S.marca.nome; }

  if (!mostrar(S.sobre)) $("#sobre").hidden = true;
  else {
    const h = $("#sobreTitulo"); h.textContent = S.sobre.titulo + " "; const t = tagC(S.sobre); if (t) h.append(t);
    S.sobre.paragrafos.forEach(p => $("#sobreTexto").append(el("p", { text: p })));
    const ass = S.sobre.assinatura || S.marca.profissional;
    if (ass) { $("#sobreAssina").textContent = ass; $("#sobreAssina").hidden = false; }
    $("#sobreZap").href = zap(`Olá${S.marca.profissional ? ", " + S.marca.profissional : ""}! Vim pelo site e queria conversar sobre um atendimento.`);
  }

  (S.diferenciais || []).filter(mostrar).forEach(d => $("#difs").append(el("div", {}, el("b", { text: d.t }), el("p", {}, d.d, tagC(d) ? " " : null, tagC(d)))));

  const box = $("#higieneBox");
  if (!mostrar(S.higiene)) box.hidden = true;
  else { const t = tagC(S.higiene); if (t) $(".hig-head", box).append(t);
    S.higiene.itens.forEach(i => $("#higiene").append(el("li", {}, el("b", { text: i.t }), el("p", { text: i.d })))); }
})();

/* ---------- galeria com categorias + ampliação ---------- */
(() => {
  const gal = $("#gal"), filtros = $("#galFiltros"), lb = $("#lightbox"), img = $("#lbImg"), cap = $("#lbCap");
  const fotos = (S.galeria || []).filter(f => f && f.src && mostrar(f));
  const cats = (S.galeriaCategorias || []).map(c => ({ ...c, fotos: fotos.filter(f => f.categoria === c.id) }));
  const catsVisiveis = cats.filter(c => c.fotos.length || DEMO);
  if (!fotos.length && !DEMO && !S.marca.instagram) { $("#galeria").hidden = true; return; }
  let lista = fotos, atual = 0;
  const abrir = i => { atual = (i + lista.length) % lista.length; img.src = lista[atual].src; img.alt = lista[atual].alt || ""; cap.textContent = lista[atual].legenda || "";
    $("#lbPrev").hidden = $("#lbNext").hidden = lista.length < 2;
    if (!lb.open) { try { lb.showModal(); } catch { lb.setAttribute("open", ""); } } };
  function render(cat) {
    gal.innerHTML = "";
    lista = cat === "todos" ? fotos : fotos.filter(f => f.categoria === cat);
    lista.forEach((f, i) => gal.append(el("button", { type: "button", class: "gal-item", "aria-label": "Ampliar foto: " + (f.alt || f.legenda || ""), onclick: () => abrir(i) },
      el("div", { class: "arch" }, el("img", { src: f.src, alt: f.alt || "", loading: "lazy" })), el("span", { text: f.legenda || "" }), tagC(f, "confirmar se é trabalho dela"))));
    if (DEMO) (cat === "todos" ? cats : cats.filter(c => c.id === cat)).filter(c => !c.fotos.length).forEach(c =>
      gal.append(el("div", { class: "gal-vazio" }, el("span", { class: "lotus", html: LOTUS }), el("b", { text: c.nome }), el("small", { text: "Espaço reservado para fotos reais deste serviço" }))));
    if (cat === "todos" && S.marca.instagram) gal.append(el("a", { class: "ig-card", href: S.marca.instagram, target: "_blank", rel: "noopener" },
      el("span", { class: "lotus", html: LOTUS }), el("b", { text: "Mais trabalhos no Instagram" }), el("span", { class: "nota", text: "Abrir perfil" })));
  }
  const chip = (id, nome) => el("button", { type: "button", class: "chip", "aria-pressed": String(id === "todos"), "data-c": id, text: nome,
    onclick: e => { $$(".chip", filtros).forEach(x => x.setAttribute("aria-pressed", String(x === e.currentTarget))); render(id); } });
  if (catsVisiveis.length > 1) { filtros.append(chip("todos", "Todos")); catsVisiveis.forEach(c => filtros.append(chip(c.id, c.nome))); } else filtros.hidden = true;
  render("todos");
  const fechar = () => { try { lb.close(); } catch { lb.removeAttribute("open"); } };
  $("#lbFechar").addEventListener("click", fechar);
  $("#lbPrev").addEventListener("click", () => abrir(atual - 1));
  $("#lbNext").addEventListener("click", () => abrir(atual + 1));
  lb.addEventListener("click", e => { if (e.target === lb) fechar(); });
  lb.addEventListener("keydown", e => { if (e.key === "ArrowLeft") abrir(atual - 1); if (e.key === "ArrowRight") abrir(atual + 1); });
})();

/* ---------- depoimentos ---------- */
(() => {
  const lista = (S.depoimentos || []).filter(mostrar);
  $("#depoZap").href = zap("Olá! Já fui atendida por você e quero deixar uma avaliação para o site:");
  if (!lista.length) {
    if (!DEMO) { $("#depoimentos").hidden = true; return; }
    $("#depos").append(el("div", { class: "vazio" }, el("b", { text: "Espaço reservado para avaliações reais" }),
      el("p", { text: "Peça às clientes uma frase sobre o atendimento e permissão para usar o primeiro nome. Depois, cole em depoimentos no config.js." })));
    return;
  }
  lista.forEach(d => $("#depos").append(el("figure", { class: "depo-card" }, el("blockquote", { text: d.texto }), el("figcaption", {}, d.nome + " ", tagC(d)))));
})();

/* ---------- políticas ---------- */
const polVisivel = mostrar(S.politicas);
(() => {
  if (!polVisivel) { $("#politicas").hidden = true; return; }
  const t = tagC(S.politicas); if (t) $("#politicas .h-sm").append(" ", t);
  S.politicas.itens.forEach(p => $("#polGrid").append(el("div", {}, el("b", { text: p.t }), el("p", { text: p.d }))));
})();

/* ---------- contato ---------- */
(() => {
  $("#fone").textContent = foneFmt;
  $("#copiarFone").addEventListener("click", async () => { $("#foneMsg").textContent = (await copiar(foneFmt)) ? "Número copiado." : "Selecione o número acima para copiar."; });
  $("#contatoZap").href = zap("Olá! Vim pelo site e gostaria de mais informações.");
  $("#zapFloat").href = zap("Olá! Vim pelo site e gostaria de tirar uma dúvida.");
  $("#faqZap").href = zap("Olá! Vim pelo site e fiquei com uma dúvida:");
  if (S.marca.instagram) { $("#igBox").hidden = false; const a = $("#igLink"); a.href = S.marca.instagram; a.textContent = S.marca.instagram.replace(/^https?:\/\/(www\.)?instagram\.com\//, "@").replace(/\/$/, ""); }
  const reg = $("#regiao");
  if (S.marca.regiao || S.marca.bairros.length) {
    reg.textContent = [S.marca.regiao, S.marca.bairros.length ? "Bairros: " + S.marca.bairros.join(", ") + "." : ""].filter(Boolean).join(". ");
    if (S.marca.regiao) { const m = $("#mapaLink"); m.href = "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(S.marca.regiao); m.hidden = false; }
  } else {
    reg.textContent = "Atendimento a domicílio. Pergunte pelo WhatsApp se ela atende o seu bairro. ";
    if (DEMO) reg.append(el("span", { class: "tag-c", text: "informar região" }));
  }
  S.marca.bairros.forEach(b => $("#bairrosList").append(el("option", { value: b })));
})();
function pintaHorarios(dias, confirmar) {
  const hb = $("#horasBox"), ul = $("#horas"); ul.innerHTML = ""; const h3 = $("h3", hb); $$(".tag-c", h3).forEach(x => x.remove());
  if (confirmar && !DEMO) { hb.hidden = true; return; }
  hb.hidden = false; if (confirmar && DEMO) h3.append(" ", el("span", { class: "tag-c", text: "a confirmar" }));
  [1, 2, 3, 4, 5, 6, 0].forEach(d => { const h = dias[d]; ul.append(el("li", {}, el("span", { text: DIAS_L[d] }), el("span", { text: h ? `${h[0]} às ${h[1]}` : "Não atende" }))); });
}

/* =========================================================
   DADOS: serviços e configurações (banco ou config.js)
   ========================================================= */
let SERV = S.servicos.map(s => ({ ...s }));
let CONF = { hours: S.agenda.dias, cancel_notice_min: 1440, days_ahead: S.agenda.diasVisiveis };
async function carregarDados() {
  if (!ONLINE) return false;
  const sb = await supa();
  const [sv, st] = await Promise.all([
    sb.from("services").select("*").order("sort"),
    sb.from("settings").select("hours, cancel_notice_min, days_ahead").eq("id", 1).maybeSingle(),
  ]);
  if (sv.error || st.error) throw sv.error || st.error;
  if (sv.data && sv.data.length) SERV = sv.data.map(r => ({ id: r.id, nome: r.name, duracao: r.duration_min, preco: r.price_cents == null ? null : r.price_cents / 100,
    categoria: r.category, adicional: r.is_addon, resumo: r.summary, beneficios: r.benefits || [], cuidados: r.care || [], manutencao: r.maintenance }));
  if (st.data) CONF = st.data;
  return true;
}

/* ---------- serviços ---------- */
function pintaServicos() {
  const cards = $("#cards"); cards.innerHTML = "";
  SERV.forEach(s => {
    const detId = "det-" + s.id;
    const det = el("div", { class: "det", id: detId, hidden: true },
      s.beneficios.length ? el("div", {}, el("h4", { text: "Benefícios" }), el("ul", {}, s.beneficios.map(b => el("li", { text: b })))) : null,
      s.cuidados.length ? el("div", {}, el("h4", { text: "Cuidados depois" }), el("ul", {}, s.cuidados.map(b => el("li", { text: b })))) : null,
      s.manutencao ? el("div", {}, el("h4", { text: "Manutenção" }), el("p", { text: s.manutencao })) : null);
    const toggle = el("button", { type: "button", class: "link-btn", "aria-expanded": "false", "aria-controls": detId, text: "Ver detalhes",
      onclick: e => { const open = det.hidden; det.hidden = !open; e.currentTarget.setAttribute("aria-expanded", String(open)); e.currentTarget.textContent = open ? "Fechar detalhes" : "Ver detalhes"; } });
    cards.append(el("article", { class: "card", "data-cat": s.categoria },
      el("div", { class: "top" }, el("h3", { text: s.nome }), s.adicional ? el("span", { class: "badge", text: "Adicional" }) : null),
      el("p", { class: "res", text: s.resumo }), det,
      el("div", { class: "meta" }, el("span", { html: ICON_T + "Cerca de " + dur(s.duracao) }),
        el("span", { class: "preco" + (s.preco == null && DEMO ? " falta" : ""), text: precoLabel(s) })),
      el("div", { class: "card-act" }, toggle, el("button", { type: "button", class: "btn sm", text: "Agendar", "aria-label": "Agendar " + s.nome, onclick: () => Booking.preselect(s.id) }))));
  });
  const ativo = $(".filtros .chip[aria-pressed=true][data-f]"); if (ativo) ativo.click();
  const t = $("#mq"); t.innerHTML = ""; SERV.map(s => s.nome).concat(["Atendimento a domicílio"]).forEach(n => t.append(el("span", { text: n })));
  $$(".mq:not(#mq)").forEach(x => x.remove()); const c = t.cloneNode(true); c.removeAttribute("id"); t.after(c);
}
$$(".filtros .chip[data-f]").forEach(b => b.addEventListener("click", () => {
  $$(".filtros .chip[data-f]").forEach(x => x.setAttribute("aria-pressed", String(x === b)));
  const f = b.dataset.f; $$("#cards .card").forEach(c => c.hidden = f !== "todos" && c.dataset.cat !== f);
}));

/* ---------- dúvidas ---------- */
function pintaFaq() {
  const faq = $("#faq"); faq.innerHTML = "";
  const prazo = horasTexto(CONF.cancel_notice_min);
  S.faq.filter(mostrar).forEach(q => {
    let r = q.r;
    if (q.usarPagamento) { if (!mostrar(S.marca.pagamento)) return; r = S.marca.pagamento.texto + (SINAL ? ` Para garantir o horário, é feito um sinal de ${sinalTxt()} por Pix. ${SINAL.regra || ""} O restante é pago no final do atendimento.` : " O pagamento é feito no final do atendimento."); }
    if (q.agenda) r = ONLINE ? "Você escolhe o serviço, vê os dias e horários que estão livres de verdade, informa seus dados e confirma. O horário fica reservado na hora e ela confirma pelo WhatsApp."
                             : "Você escolhe o serviço, o dia e um horário, informa o endereço e envia o pedido. A mensagem chega pronta no WhatsApp dela, e o horário fica garantido quando ela responder confirmando.";
    if (q.agenda && SINAL) r += ` Para garantir o horário, é pedido um sinal de ${sinalTxt()} por Pix, descontado do valor no dia.`;
    if (q.agendaCancel) r = ONLINE ? `No final do agendamento aparece um link só seu. Por ele você vê, cancela ou remarca o horário até ${prazo} antes. Depois disso, é só falar com ela no WhatsApp.`
                                   : "É só avisar pelo WhatsApp com antecedência. Assim ela consegue oferecer o horário para outra cliente.";
    faq.append(el("details", {}, el("summary", {}, el("span", {}, q.p + " ", tagC(q)), el("span", { class: "pm", "aria-hidden": "true" })), el("p", { class: "ans", text: r })));
  });
}

/* =========================================================
   AGENDAMENTO
   ========================================================= */
const Booking = (() => {
  const st = { step: 1, svc: new Set(), dia: null, hora: null, msg: "", slots: null, slotsKey: "" };
  const form = $("#bkForm"), steps = $$(".step", form), nav = $$("#stepsNav li");
  const bVoltar = $("#voltar"), bAvancar = $("#avancar"), bEnviar = $("#enviar");
  const svcById = id => SERV.find(s => s.id === id);
  const sel = () => [...st.svc].map(svcById).filter(Boolean);
  const totalMin = () => sel().reduce((a, s) => a + s.duracao, 0);
  const precoTxt = () => {
    const l = sel(); if (!l.length) return null;
    const com = l.filter(s => s.preco != null), sem = l.length - com.length;
    if (!com.length) return "A combinar com ela";
    return brl(com.reduce((a, s) => a + s.preco, 0)) + (sem ? " + itens sob consulta" : "");
  };
  const hoje0 = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };

  /* 1. serviços */
  function pintaPick() {
    const box = $("#pick"); box.innerHTML = "";
    SERV.forEach(s => {
      const inp = el("input", { type: "checkbox", id: "op-" + s.id, value: s.id });
      inp.checked = st.svc.has(s.id);
      inp.addEventListener("change", () => { inp.checked ? st.svc.add(s.id) : st.svc.delete(s.id); st.hora = null; st.dia = null; st.slots = null; erro(1); resumo(); });
      box.append(el("label", { class: "opt", for: "op-" + s.id }, inp, el("span", { class: "box", html: ICON_OK }), el("b", { text: s.nome }),
        el("span", { class: "pv", text: precoLabel(s, true) }), el("small", { text: "Cerca de " + dur(s.duracao) + (s.adicional ? " · adicional" : "") })));
    });
    [...st.svc].forEach(id => { if (!svcById(id)) st.svc.delete(id); });
  }

  /* horários: banco (online) ou expediente do config (WhatsApp) */
  function slotsOffline() {
    const out = []; const m = Math.max(totalMin(), 30);
    for (let i = 0; i < S.agenda.diasVisiveis; i++) {
      const d = hoje0(); d.setDate(d.getDate() + i);
      const h = S.agenda.dias[d.getDay()]; if (!h) continue;
      let [ini, fim] = h.map(toMin);
      if (i === 0) { const ag = new Date(), min = ag.getHours() * 60 + ag.getMinutes() + S.agenda.antecedenciaMinima; ini = Math.max(ini, Math.ceil(min / S.agenda.passo) * S.agenda.passo); }
      for (let t = ini; t + m <= fim; t += S.agenda.passo) { const x = new Date(d); x.setMinutes(t); out.push(x); }
    }
    return out;
  }
  async function carregaSlots(force) {
    const key = [...st.svc].sort().join(",");
    if (!force && st.slots && st.slotsKey === key) return;
    if (!ONLINE) { st.slots = slotsOffline(); st.slotsKey = key; return; }
    const sb = await supa();
    const { data, error } = await sb.rpc("available_slots", { p_service_ids: [...st.svc] });
    if (error) throw error;
    st.slots = (data || []).map(r => new Date(r.slot || r)); st.slotsKey = key;
  }
  const porDia = () => { const m = new Map(); (st.slots || []).forEach(d => { const k = ONLINE ? diaKey(d) : d.toDateString(); if (!m.has(k)) m.set(k, []); m.get(k).push(d); }); return m; };

  /* 2. dias */
  async function renderDias(force) {
    const box = $("#dias"), est = $("#diasEstado");
    box.classList.add("carregando"); est.hidden = false; est.className = "estado"; est.innerHTML = ""; est.append(el("span", { class: "spin", "aria-hidden": "true" }), "Buscando os dias com horário livre…");
    try { await carregaSlots(force); }
    catch (e) {
      box.classList.remove("carregando"); box.innerHTML = ""; est.className = "estado erro-box"; est.innerHTML = "";
      est.append(el("span", { text: "Não conseguimos carregar a agenda agora." }), el("button", { type: "button", class: "btn ghost sm", text: "Tentar de novo", onclick: () => renderDias(true) }),
        el("a", { class: "link-btn", href: zap("Olá! Tentei agendar pelo site mas a agenda não carregou. Pode me ajudar?"), target: "_blank", rel: "noopener", text: "Agendar pelo WhatsApp" }));
      return;
    }
    est.hidden = true; box.classList.remove("carregando"); box.innerHTML = "";
    const mapa = porDia(); const meses = new Set();
    const n = ONLINE ? (CONF.days_ahead || 21) + 1 : S.agenda.diasVisiveis;
    for (let i = 0; i < n; i++) {
      const d = new Date(Date.now() + i * 864e5); d.setHours(12, 0, 0, 0);
      const k = ONLINE ? diaKey(d) : (() => { const x = hoje0(); x.setDate(x.getDate() + i); return x.toDateString(); })();
      const livres = mapa.get(k) || [];
      meses.add(fmtTZ(d, { month: "long" }));
      const ativo = st.dia === k;
      if (ativo && !livres.length) { st.dia = null; st.hora = null; }
      box.append(el("button", { type: "button", class: "dia", disabled: !livres.length, "aria-pressed": String(ativo && !!livres.length),
        "aria-label": diaLongo(d) + (livres.length ? `, ${livres.length} horários` : ", sem horários"),
        onclick: e => { st.dia = k; st.diaData = d; st.hora = null; erro(2); $$(".dia", box).forEach(b => b.setAttribute("aria-pressed", String(b === e.currentTarget))); resumo(); } },
        el("small", { text: i === 0 ? "hoje" : DIAS[new Date(d).getDay()] }), el("b", { text: fmtTZ(d, { day: "numeric" }) }), el("small", { text: fmtTZ(d, { month: "short" }).replace(".", "") })));
    }
    const algum = $$(".dia:not([disabled])", box).length;
    $("#mesLabel").textContent = algum ? `Mostrando os dias com horário livre · ${[...meses].join(" e ")}` : "";
    if (!algum) { est.hidden = false; est.className = "estado"; est.innerHTML = ""; est.append(el("span", { text: "Não há horários livres nos próximos dias para essa combinação. " }),
      el("a", { class: "link-btn", href: zap("Olá! Não encontrei horário livre no site. Você teria alguma disponibilidade?"), target: "_blank", rel: "noopener", text: "Pergunte pelo WhatsApp" })); }
  }

  /* 3. horários */
  function renderHoras() {
    const box = $("#slots"); box.innerHTML = "";
    const lista = porDia().get(st.dia) || [], m = totalMin();
    $("#horaInfo").textContent = `${diaLongo(st.diaData)} · atendimento de cerca de ${dur(m)}. ` + (ONLINE ? "Todos estes horários estão livres agora." : "Ela confirma a disponibilidade pelo WhatsApp.");
    const grupos = { "Manhã": [], "Tarde": [], "Noite": [] };
    lista.forEach(d => { const h = Number((ONLINE ? horaTZ(d) : toHM(d.getHours() * 60 + d.getMinutes())).slice(0, 2)); grupos[h < 12 ? "Manhã" : h < 18 ? "Tarde" : "Noite"].push(d); });
    Object.entries(grupos).forEach(([g, l]) => {
      if (!l.length) return;
      box.append(el("div", { class: "periodo" }, el("h4", { text: g }),
        el("div", { class: "horas", role: "group", "aria-label": g }, l.map(d => {
          const ini = ONLINE ? horaTZ(d) : toHM(d.getHours() * 60 + d.getMinutes()), fim = ONLINE ? horaTZ(new Date(+d + m * 6e4)) : toHM(d.getHours() * 60 + d.getMinutes() + m);
          return el("button", { type: "button", class: "hora", "aria-pressed": String(st.hora && +st.hora === +d), "aria-label": `${ini} até ${fim}`,
            onclick: e => { st.hora = d; erro(3); $$(".hora", box).forEach(b => b.setAttribute("aria-pressed", String(b === e.currentTarget))); resumo(); } }, ini);
        }))));
    });
  }
  const horaTxt = d => ONLINE ? horaTZ(d) : toHM(d.getHours() * 60 + d.getMinutes());

  /* 4. dados */
  const tel = $("#tel"), cep = $("#cep");
  tel.addEventListener("input", () => {
    const d = soDig(tel.value).slice(0, 11);
    tel.value = d.length > 10 ? `(${d.slice(0,2)}) ${d.slice(2,7)}-${d.slice(7)}` : d.length > 6 ? `(${d.slice(0,2)}) ${d.slice(2,6)}-${d.slice(6)}` : d.length > 2 ? `(${d.slice(0,2)}) ${d.slice(2)}` : d;
  });
  cep.addEventListener("input", async () => {
    const d = soDig(cep.value).slice(0, 8); cep.value = d.length > 5 ? d.slice(0, 5) + "-" + d.slice(5) : d;
    const msg = $("#cepMsg"); msg.className = "fe";
    if (d.length < 8) { msg.textContent = ""; return; }
    msg.className = "fe info"; msg.textContent = "Buscando endereço…";
    const ctl = new AbortController(); const to = setTimeout(() => ctl.abort(), 6000);
    try {
      const r = await fetch(`https://viacep.com.br/ws/${d}/json/`, { signal: ctl.signal }); const j = await r.json();
      if (j.erro) throw new Error("cep");
      if (j.logradouro) $("#rua").value = j.logradouro; if (j.bairro) $("#bairro").value = j.bairro; if (j.localidade) $("#cidade").value = j.localidade + (j.uf ? " - " + j.uf : "");
      msg.className = "fe ok"; msg.textContent = "Endereço encontrado. Confira e complete o número."; $("#numero").focus();
    } catch (e) { msg.className = "fe info"; msg.textContent = e.message === "cep" ? "Não encontramos esse CEP. Preencha o endereço abaixo." : "Não deu para buscar o CEP agora. Preencha o endereço abaixo."; }
    finally { clearTimeout(to); }
  });
  const regras = {
    nome: v => v.trim().length >= 2 || "Digite seu nome.",
    tel: v => [10, 11].includes(soDig(v).length) || "Digite o WhatsApp com DDD, por exemplo (11) 91234-5678.",
    bairro: v => v.trim().length >= 2 || "Informe o bairro.",
    rua: v => v.trim().length >= 3 || "Informe a rua ou avenida.",
    numero: v => v.trim().length >= 1 || "Informe o número (ou s/n).",
    cidade: v => v.trim().length >= 2 || "Informe a cidade.",
  };
  const checar = id => {
    const i = $("#" + id), r = regras[id](i.value), fe = i.parentElement.querySelector(".fe");
    const ok = r === true; i.setAttribute("aria-invalid", String(!ok)); fe.className = "fe"; fe.textContent = ok ? "" : r;
    if (!fe.id) fe.id = "fe-" + id; if (!ok) i.setAttribute("aria-describedby", fe.id); else i.removeAttribute("aria-describedby");
    return ok;
  };
  Object.keys(regras).forEach(id => { const i = $("#" + id); i.addEventListener("blur", () => { if (i.value) checar(id); }); i.addEventListener("input", () => { if (i.getAttribute("aria-invalid") === "true") checar(id); }); });

  /* 5. revisão */
  const v = id => $("#" + id).value.trim();
  const endereco = () => `${v("rua")}, ${v("numero")}${v("compl") ? " - " + v("compl") : ""} · ${v("bairro")} · ${v("cidade")}${v("cep") ? " · CEP " + v("cep") : ""}`;
  const linhas = () => [
    ["Serviços", sel().map(s => s.nome).join(", ")],
    ["Dia", diaLongo(st.hora)],
    ["Horário", `${horaTxt(st.hora)} (cerca de ${dur(totalMin())})`],
    ["Endereço", endereco()],
    v("ref") ? ["Referência", v("ref")] : null,
    ["Nome", v("nome")], ["WhatsApp", v("tel")],
    v("obs") ? ["Observação", v("obs")] : null,
    ["Valor", precoTxt()],
  ].filter(Boolean);
  const fillDl = (dl, l) => { dl.innerHTML = ""; l.forEach(([k, x]) => dl.append(el("dt", { text: k }), el("dd", { text: x }))); };
  function renderRevisao() {
    fillDl($("#revisao"), linhas());
    const av = $("#avisoPol"); av.innerHTML = "";
    if (SINAL) av.append(el("p", { class: "sinal-l" }, el("b", { text: `Sinal de ${sinalTxt()} para garantir o horário: ` }),
      `depois de agendar, faça o Pix do sinal e mande o comprovante pelo WhatsApp. O horário só fica garantido depois do sinal. ${SINAL.regra || ""}`));
    $("#aceiteTxt").textContent = SINAL ? (polVisivel ? `Li as informações sobre o sinal de ${sinalTxt()}, cancelamento e atrasos.` : `Estou ciente do sinal de ${sinalTxt()} para garantir o horário.`) : "Li as informações sobre cancelamento e atrasos.";
    if (polVisivel) { S.politicas.itens.slice(0, 2).forEach(p => av.append(el("p", {}, el("b", { text: p.t + ": " }), p.d))); $(".check").hidden = false; }
    else { av.append(el("p", { text: ONLINE ? `Se precisar, você pode cancelar ou remarcar pelo link do agendamento até ${horasTexto(CONF.cancel_notice_min)} antes.` : "Se precisar desmarcar ou for se atrasar, avise pelo WhatsApp o quanto antes." })); if (!SINAL) $(".check").hidden = true; }
  }
  const mensagem = (link) => [`Olá${S.marca.profissional ? ", " + S.marca.profissional : ""}! ${ONLINE ? "Acabei de agendar pelo site." : "Vim pelo site e gostaria de agendar um horário."}`, "",
    ...linhas().map(([k, x]) => `*${k}:* ${x}`), link ? `*Meu agendamento:* ${link}` : null, SINAL ? `*Sinal:* ${sinalTxt()} via Pix (vou enviar o comprovante aqui)` : null, "", ONLINE ? "Fico no aguardo da sua confirmação. Obrigada!" : "Aguardo sua confirmação. Obrigada!"].filter(x => x !== null).join("\n");

  function resumo() {
    const dl = $("#resumo"); dl.innerHTML = "";
    const item = (k, x) => dl.append(el("dt", { text: k }), el("dd", { class: x ? "" : "vz", text: x || "Ainda não escolhido" }));
    item("Serviços", sel().map(s => s.nome).join(", ")); item("Duração", st.svc.size ? "Cerca de " + dur(totalMin()) : "");
    item("Dia", st.dia ? diaLongo(st.diaData) : ""); item("Horário", st.hora ? `${horaTxt(st.hora)} às ${horaTxt(new Date(+st.hora + totalMin() * 6e4))}` : ""); item("Valor", precoTxt());
  }

  function erro(n, txt) { const e = $(`[data-erro="${n}"]`); if (!e) return; e.hidden = !txt; e.textContent = txt || ""; }
  function valida(n) {
    if (n === 1 && !st.svc.size) { erro(1, "Escolha pelo menos um serviço para continuar."); return false; }
    if (n === 1 && sel().every(s => s.adicional)) { erro(1, ERROS.SO_ADICIONAL); return false; }
    if (n === 2 && !st.dia) { erro(2, "Escolha um dia para ver os horários."); return false; }
    if (n === 3 && !st.hora) { erro(3, "Escolha um horário."); return false; }
    if (n === 4) { const ok = Object.keys(regras).map(checar).every(Boolean); if (!ok) { const p = form.querySelector('[aria-invalid="true"]'); p && p.focus(); } return ok; }
    if (n === 5 && (polVisivel || SINAL) && !$("#aceite").checked) { erro(5, SINAL ? `Confirme que está ciente do sinal de ${sinalTxt()}.` : "Confirme que leu as informações sobre cancelamento e atrasos."); return false; }
    return true;
  }
  function ir(n, foco = true) {
    st.step = n;
    steps.forEach(s => s.hidden = Number(s.dataset.step) !== n);
    nav.forEach(li => { const k = Number(li.dataset.s); li.classList.toggle("done", k < n); k === n ? li.setAttribute("aria-current", "step") : li.removeAttribute("aria-current"); });
    bVoltar.hidden = n === 1; bAvancar.hidden = n === 5; bEnviar.hidden = n !== 5;
    if (n === 2) renderDias();
    if (n === 3) renderHoras();
    if (n === 5) renderRevisao();
    if (foco) { const t = steps[n - 1].querySelector(".step-t"); t.setAttribute("tabindex", "-1"); t.focus({ preventScroll: true });
      const top = $("#booking").getBoundingClientRect().top + scrollY - 90; if (Math.abs(scrollY - top) > 200) scrollTo({ top, behavior: reduz ? "auto" : "smooth" }); }
  }
  bAvancar.addEventListener("click", () => { if (valida(st.step)) ir(st.step + 1); });
  bVoltar.addEventListener("click", () => ir(st.step - 1));
  $("#aceite").addEventListener("change", () => erro(5));

  const carregando = on => { bEnviar.classList.toggle("loading", on); bEnviar.disabled = on; bVoltar.disabled = on;
    bEnviar.querySelector(".lbl").textContent = on ? (ONLINE ? "Reservando seu horário…" : "Abrindo o WhatsApp…") : (ONLINE ? "Confirmar agendamento" : "Enviar pedido pelo WhatsApp"); };
  function mostraSucesso({ titulo, texto, link, zapLabel }) {
    fillDl($("#revisaoFinal"), linhas());
    $("#sucTitulo").textContent = titulo; $("#sucTexto").innerHTML = ""; $("#sucTexto").append(...texto);
    $("#gerLinkBox").hidden = !link; if (link) $("#gerLink").value = link;
    $("#sinalBox").hidden = !SINAL;
    if (SINAL) {
      const t = $("#sinalTxt"); t.innerHTML = "";
      t.append(el("b", { text: `Faça o Pix do sinal de ${sinalTxt()}` }), " e mande o comprovante pelo WhatsApp. Seu horário fica garantido depois do sinal.");
      $("#sinalPix").value = SINAL.pix || ""; $("#sinalPix").closest(".gerlink-row").hidden = !SINAL.pix;
      if (!SINAL.pix) t.append(" Ela te passa a chave Pix pelo WhatsApp.");
      $("#sinalFav").textContent = SINAL.pix && SINAL.favorecido ? `Confira o nome no Pix: ${SINAL.favorecido}` : "";
    }
    $("#zapDeNovo").href = zap(st.msg); $("#zapDeNovo").textContent = zapLabel;
    form.hidden = true; $(".bk-side").hidden = true; $("#stepsNav").hidden = true;
    const ok = $("#sucesso"); ok.hidden = false; ok.focus({ preventScroll: true });
    scrollTo({ top: $("#booking").getBoundingClientRect().top + scrollY - 90, behavior: reduz ? "auto" : "smooth" });
  }
  form.addEventListener("submit", async e => {
    e.preventDefault();
    for (const n of [1, 2, 3, 4, 5]) if (!valida(n)) { ir(n); return; }
    if (!ONLINE) {
      st.msg = mensagem(); carregando(true);
      const a = el("a", { href: zap(st.msg), target: "_blank", rel: "noopener" }); document.body.append(a); a.click(); a.remove();
      setTimeout(() => { carregando(false); mostraSucesso({ titulo: "Pedido pronto para enviar!", zapLabel: "Abrir o WhatsApp de novo",
        texto: ["Abrimos o WhatsApp com a sua mensagem. ", el("b", { text: "É só tocar em enviar lá." }), " Quando ela responder confirmando, seu horário está garantido."] }); }, 700);
      return;
    }
    carregando(true); erro(5);
    try {
      const sb = await supa();
      const { data, error } = await sb.rpc("book_appointment", {
        p_service_ids: [...st.svc], p_start: st.hora.toISOString(), p_name: v("nome"), p_phone: v("tel"),
        p_address: { cep: v("cep"), rua: v("rua"), numero: v("numero"), compl: v("compl"), bairro: v("bairro"), cidade: v("cidade"), ref: v("ref") },
        p_notes: v("obs") || null });
      if (error) throw error;
      const link = `${location.origin}${location.pathname}?agendamento=${data.token}`;
      st.msg = mensagem(link);
      carregando(false);
      mostraSucesso({ titulo: "Horário reservado!", zapLabel: SINAL ? "Avisar e enviar comprovante" : "Avisar pelo WhatsApp", link,
        texto: [`Seu horário de ${diaLongo(st.hora)}, às ${horaTxt(st.hora)}, está reservado e aguardando a confirmação ${S.marca.profissional ? "da " + S.marca.profissional : "dela"}. `,
          el("b", { text: "Toque em Avisar pelo WhatsApp" }), " para mandar os detalhes e, se quiser, uma foto de referência."] });
    } catch (err) {
      carregando(false);
      const code = err && err.message;
      if (["OCUPADO", "ANTECEDENCIA", "BLOQUEADO", "FECHADO", "FORA_DO_EXPEDIENTE", "HORARIO_INVALIDO", "MUITO_DISTANTE"].includes(code)) {
        st.hora = null; st.slots = null; await ir(2); erro(2, msgErro(err)); return;
      }
      if (["NOME_INVALIDO", "TELEFONE_INVALIDO", "ENDERECO_INVALIDO"].includes(code)) { ir(4); return; }
      erro(5, msgErro(err));
    }
  });
  $("#copiarMsg").addEventListener("click", async () => { $("#copiaMsg").textContent = (await copiar(st.msg)) ? `Mensagem copiada. Cole no WhatsApp ${foneFmt}.` : `Não deu para copiar automaticamente. Envie para ${foneFmt}.`; });
  $("#copiarPix").addEventListener("click", async () => { const ok = await copiar($("#sinalPix").value); if (!ok) $("#sinalPix").select(); $("#copiaMsg").textContent = ok ? "Chave Pix copiada." : "Selecione a chave para copiar."; });
  $("#copiarLink").addEventListener("click", async () => { const ok = await copiar($("#gerLink").value); if (!ok) $("#gerLink").select(); $("#copiaMsg").textContent = ok ? "Link copiado." : "Selecione o link para copiar."; });
  $("#novoAg").addEventListener("click", () => {
    st.svc.clear(); st.dia = null; st.hora = null; st.slots = null; form.reset(); $$("#pick input").forEach(i => i.checked = false);
    $$("[aria-invalid]", form).forEach(i => i.removeAttribute("aria-invalid")); $$(".fe", form).forEach(f => f.textContent = "");
    $("#sucesso").hidden = true; form.hidden = false; $(".bk-side").hidden = false; $("#stepsNav").hidden = false; $("#copiaMsg").textContent = "";
    resumo(); ir(1);
  });

  return {
    iniciar() { pintaPick(); resumo(); ir(1, false); },
    preselect(id) {
      if (!$("#sucesso").hidden) $("#novoAg").click();
      const i = $("#op-" + id); if (i && !i.checked) { i.checked = true; i.dispatchEvent(new Event("change")); }
      ir(1, false);
      scrollTo({ top: $("#agendar").getBoundingClientRect().top + scrollY - 70, behavior: reduz ? "auto" : "smooth" });
      setTimeout(() => bAvancar.focus({ preventScroll: true }), reduz ? 0 : 700);
    },
  };
})();

/* =========================================================
   GERENCIAR AGENDAMENTO (link ?agendamento=código)
   ========================================================= */
const token = new URLSearchParams(location.search).get("agendamento");
/* tira o código da barra de endereço: assim, se alguém copiar o link do navegador
   para divulgar o site, não leva junto o agendamento de uma cliente */
if (token) { try { history.replaceState(null, "", location.pathname + location.hash); } catch { /* navegador antigo: segue normal */ } }
const Gerenciar = (() => {
  const dlg = $("#gerenciar"), corpo = $("#gerCorpo");
  const abrirDlg = () => { if (!dlg.open) { try { dlg.showModal(); } catch { dlg.setAttribute("open", ""); } } };
  const fechar = () => { try { dlg.close(); } catch { dlg.removeAttribute("open"); } };
  $("#gerFechar").addEventListener("click", fechar);
  const STATUS = { pendente: "Aguardando confirmação", confirmado: "Confirmado", concluido: "Concluído", cancelado: "Cancelado", faltou: "Não realizado" };
  const carregandoUI = txt => { corpo.innerHTML = ""; corpo.append(el("div", { class: "estado" }, el("span", { class: "spin", "aria-hidden": "true" }), txt)); };
  const erroUI = (txt, retry) => { corpo.innerHTML = ""; corpo.append(el("div", { class: "estado erro-box" }, el("span", { text: txt }), retry ? el("button", { type: "button", class: "btn ghost sm", text: "Tentar de novo", onclick: retry }) : null),
    el("a", { class: "btn ghost", href: zap("Olá! Preciso de ajuda com o meu agendamento."), target: "_blank", rel: "noopener", text: "Falar no WhatsApp" })); };
  async function mostrar(aviso) {
    abrirDlg(); carregandoUI("Buscando seu agendamento…");
    let b;
    try { const sb = await supa(); const r = await sb.rpc("get_booking", { p_token: token }); if (r.error) throw r.error; b = r.data; }
    catch (e) { erroUI(e && e.message === "SDK" ? "Não conseguimos conectar agora." : (e && /uuid/i.test(e.message || "") ? ERROS.NAO_ENCONTRADO : "Não conseguimos carregar agora."), e && /uuid/i.test(e.message || "") ? null : mostrar); return; }
    if (!b) { erroUI(ERROS.NAO_ENCONTRADO); return; }
    const ini = new Date(b.starts_at), fim = new Date(b.ends_at);
    corpo.innerHTML = "";
    if (aviso) corpo.append(el("div", { class: "ok-box", role: "status", text: aviso }));
    corpo.append(el("p", {}, `Olá, ${b.first_name}! `, el("span", { class: "status st-" + b.status, text: STATUS[b.status] || b.status })),
      el("dl", { class: "revisao" }, el("dt", { text: "Serviços" }), el("dd", { text: b.services }), el("dt", { text: "Dia" }), el("dd", { text: diaLongo(ini) }),
        el("dt", { text: "Horário" }), el("dd", { text: `${horaTZ(ini)} às ${horaTZ(fim)}` }), b.bairro ? el("dt", { text: "Bairro" }) : null, b.bairro ? el("dd", { text: b.bairro }) : null,
        el("dt", { text: "Valor" }), el("dd", { text: b.price_cents != null ? brl(b.price_cents / 100) : "A combinar com ela" })));
    if (b.can_change) {
      corpo.append(el("div", { class: "row" },
        el("button", { type: "button", class: "btn", text: "Remarcar", onclick: () => remarcar(b) }),
        el("button", { type: "button", class: "btn ghost", text: "Cancelar agendamento", onclick: () => confirmarCancel(b) })),
        el("p", { class: "nota", text: `Você pode cancelar ou remarcar por aqui até ${horasTexto(b.cancel_notice_min)} antes do horário.` }));
    } else if (["pendente", "confirmado"].includes(b.status)) {
      corpo.append(el("p", { class: "nota", text: `Faltam menos de ${horasTexto(b.cancel_notice_min)} para o atendimento. Para mudar, fale com ela.` }),
        el("a", { class: "btn ghost", href: zap(`Olá! Preciso falar sobre meu agendamento de ${diaLongo(ini)}, às ${horaTZ(ini)}.`), target: "_blank", rel: "noopener", text: "Falar no WhatsApp" }));
    } else corpo.append(el("a", { class: "btn", href: location.pathname + "#agendar", onclick: fechar, text: "Fazer um novo agendamento" }));
  }
  function confirmarCancel(b) {
    corpo.innerHTML = "";
    corpo.append(el("p", { text: `Tem certeza que quer cancelar o horário de ${diaLongo(new Date(b.starts_at))}, às ${horaTZ(new Date(b.starts_at))}?` }),
      el("div", { class: "row" }, el("button", { type: "button", class: "btn", text: "Sim, cancelar", onclick: async e => {
        e.currentTarget.disabled = true; carregandoUI("Cancelando…");
        try { const sb = await supa(); const { error } = await sb.rpc("cancel_booking", { p_token: token }); if (error) throw error; mostrar("Agendamento cancelado. Obrigada por avisar com antecedência!"); }
        catch (err) { erroUI(msgErro(err), () => mostrar()); }
      } }), el("button", { type: "button", class: "btn ghost", text: "Voltar", onclick: () => mostrar() })));
  }
  async function remarcar(b) {
    carregandoUI("Buscando horários livres…");
    let slots;
    try { const sb = await supa(); const { data, error } = await sb.rpc("available_slots", { p_service_ids: b.service_ids, p_token: token }); if (error) throw error; slots = (data || []).map(r => new Date(r.slot || r)).filter(d => +d !== +new Date(b.starts_at)); }
    catch (err) { erroUI(msgErro(err), () => remarcar(b)); return; }
    corpo.innerHTML = "";
    if (!slots.length) { corpo.append(el("p", { text: "Não há outros horários livres nos próximos dias." }), el("button", { type: "button", class: "btn ghost", text: "Voltar", onclick: () => mostrar() })); return; }
    const mapa = new Map(); slots.forEach(d => { const k = diaKey(d); if (!mapa.has(k)) mapa.set(k, []); mapa.get(k).push(d); });
    let escolhido = null;
    const dias = el("div", { class: "dias", role: "group", "aria-label": "Novo dia" }), horas = el("div", { class: "horas", role: "group", "aria-label": "Novo horário" });
    const btnOk = el("button", { type: "button", class: "btn", text: "Confirmar novo horário", disabled: true });
    [...mapa.entries()].forEach(([k, l]) => dias.append(el("button", { type: "button", class: "dia", "aria-pressed": "false", "aria-label": diaLongo(l[0]), onclick: e => {
      $$(".dia", dias).forEach(x => x.setAttribute("aria-pressed", String(x === e.currentTarget))); horas.innerHTML = ""; escolhido = null; btnOk.disabled = true;
      l.forEach(d => horas.append(el("button", { type: "button", class: "hora", "aria-pressed": "false", text: horaTZ(d), onclick: ev => { $$(".hora", horas).forEach(x => x.setAttribute("aria-pressed", String(x === ev.currentTarget))); escolhido = d; btnOk.disabled = false; } })));
    } }, el("small", { text: fmtTZ(l[0], { weekday: "short" }).replace(".", "") }), el("b", { text: fmtTZ(l[0], { day: "numeric" }) }), el("small", { text: fmtTZ(l[0], { month: "short" }).replace(".", "") }))));
    btnOk.addEventListener("click", async () => {
      btnOk.disabled = true; carregandoUI("Remarcando…");
      try { const sb = await supa(); const { error } = await sb.rpc("reschedule_booking", { p_token: token, p_new_start: escolhido.toISOString() }); if (error) throw error;
        mostrar(`Pronto! Novo horário: ${diaLongo(escolhido)}, às ${horaTZ(escolhido)}. Ela vai confirmar pelo WhatsApp.`); }
      catch (err) { erroUI(msgErro(err), () => remarcar(b)); }
    });
    corpo.append(el("p", { class: "step-h", text: "Escolha o novo dia e horário:" }), dias, horas, el("div", { class: "row" }, btnOk, el("button", { type: "button", class: "btn ghost", text: "Voltar", onclick: () => mostrar() })));
  }
  return { mostrar };
})();

/* =========================================================
   INICIALIZAÇÃO
   ========================================================= */
(async () => {
  pintaServicos(); pintaFaq(); Booking.iniciar(); pintaHorarios(S.agenda.dias, S.agenda.confirmar); ajustaLinks();
  if (ONLINE) {
    try { await carregarDados(); pintaServicos(); pintaFaq(); Booking.iniciar(); pintaHorarios(CONF.hours, false); }
    catch { /* mantém os dados do config.js; o agendamento mostra o erro e oferece o WhatsApp */ }
    if (token) Gerenciar.mostrar();
  }
  ajustaLinks();
})();

/* ---------- entrada das seções ao rolar ---------- */
if (!reduz && "IntersectionObserver" in window) {
  const io = new IntersectionObserver(es => es.forEach(en => { if (en.isIntersecting) { en.target.classList.remove("pre"); io.unobserve(en.target); } }), { rootMargin: "0px 0px -8% 0px" });
  $$(".reveal").forEach(r => { if (r.getBoundingClientRect().top > innerHeight) { r.classList.add("pre"); io.observe(r); } });
}

/* ---------- abertura ---------- */
(() => {
  const pronto = () => document.documentElement.classList.add("ready");
  if (reduz || token) { pronto(); return; }
  const box = document.createElement("div"); box.id = "intro"; box.setAttribute("role", "presentation");
  const limpa = s => s.replace(/[<>&"]/g, "");
  const letras = [...S.marca.nome].map((ch, i) => `<span style="animation-delay:${(.8 + i * .06).toFixed(2)}s,${(2.3 + i * .05).toFixed(2)}s">${ch === " " ? "&nbsp;" : limpa(ch)}</span>`).join("");
  box.innerHTML = `<div class="cur l"></div><div class="cur r"></div><div class="in"><span class="lotus lt">${LOTUS}</span><div class="nm" aria-hidden="true">${letras}</div><div class="rule"></div><div class="tg">${limpa(S.marca.slogan)}</div></div><div class="skip-i">Toque para entrar</div>`;
  document.body.append(box);
  document.documentElement.style.overflow = "hidden";
  let feito = false;
  const fechar = () => { if (feito) return; feito = true; box.classList.add("out"); document.documentElement.style.overflow = ""; setTimeout(pronto, 220); setTimeout(() => box.remove(), 1400); };
  box.addEventListener("click", fechar);
  addEventListener("keydown", function k(e) { if (["Escape", "Enter", " "].includes(e.key)) { fechar(); removeEventListener("keydown", k); } });
  setTimeout(fechar, 3700);
})();
})();
