/* =========================================================
   Painel em MODO DEMONSTRAÇÃO (admin.html?demo=1)
   Só é usado quando o Supabase ainda não está configurado.
   Simula o banco na memória do navegador com dados de EXEMPLO,
   para visualizar o painel. Nada é salvo nem enviado.
   ========================================================= */
(() => {
"use strict";
const S = window.SITE;
const ligado = S.supabase && S.supabase.url && S.supabase.chavePublica;
if (ligado || !(window.FORCAR_DEMO || /[?&]demo=1/.test(location.search))) return;
const OFF = "-03:00";
const uuid = () => (crypto.randomUUID ? crypto.randomUUID() : "x" + Math.random().toString(16).slice(2) + Date.now().toString(16));
const dia = n => new Date(Date.now() + n * 864e5).toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
const em = (n, h) => new Date(`${dia(n)}T${h}:00${OFF}`).toISOString();
const mais = (iso, min) => new Date(new Date(iso).getTime() + min * 6e4).toISOString();
const DB = {
  settings: [{ id: 1, timezone: "America/Sao_Paulo", hours: { 0: null, 1: ["09:00", "19:00"], 2: ["09:00", "19:00"], 3: ["09:00", "19:00"], 4: ["09:00", "19:00"], 5: ["09:00", "19:00"], 6: ["08:00", "16:00"] },
    buffer_min: 40, step_min: 30, min_notice_min: 120, days_ahead: 21, cancel_notice_min: 1440 }],
  services: S.servicos.map((s, i) => ({ id: s.id, name: s.nome, summary: s.resumo, benefits: s.beneficios, care: s.cuidados, maintenance: s.manutencao || null,
    duration_min: s.duracao, price_cents: s.preco == null ? null : Math.round(s.preco * 100), category: s.categoria, is_addon: !!s.adicional, active: true, sort: i + 1 })),
  clients: [], appointments: [], time_off: [],
};
const cli = (name, phone, notes) => { const c = { id: uuid(), name, phone, notes: notes || null, created_at: em(-40, "10:00") }; DB.clients.push(c); return c; };
const ag = (c, svc, n, h, status, extra = {}) => {
  const sv = svc.map(id => DB.services.find(s => s.id === id)); const min = sv.reduce((a, s) => a + s.duration_min, 0);
  DB.appointments.push({ id: uuid(), client_id: c.id, service_ids: svc, service_names: sv.map(s => s.name).join(", "), starts_at: em(n, h), ends_at: mais(em(n, h), min),
    block_until: mais(em(n, h), min + 40), status, price_cents: null, address: { rua: "Rua de Exemplo", numero: "100", bairro: "Bairro Exemplo", cidade: "São Paulo" },
    notes: extra.notes || null, manage_token: uuid(), reminded_at: extra.reminded ? em(-1, "18:00") : null, created_at: em(-3, "09:00") });
};
const a = cli("Cliente Exemplo 1", "5511900000001", "Exemplo de anotação: prefere formato amendoado.");
const b = cli("Cliente Exemplo 2", "5511900000002");
const c = cli("Cliente Exemplo 3", "5511900000003");
ag(a, ["gel"], 0, "14:00", "confirmado", { reminded: true });
ag(b, ["manicure", "pedicure"], 0, "16:30", "pendente", { notes: "Exemplo: cor nude, por favor" });
ag(c, ["alongamento"], 1, "10:00", "confirmado");
ag(a, ["banho", "nailart"], 3, "13:00", "pendente");
ag(b, ["spa", "pedicure"], -7, "11:00", "concluido");
ag(c, ["manicure"], -14, "15:00", "faltou");
DB.time_off.push({ id: 1, starts_at: em(5, "00:00"), ends_at: em(6, "00:00"), reason: "Exemplo de folga", created_at: em(-1, "09:00") });
let seq = 2;

const cmp = (x, op, v) => { if (op === "in") return v.map(String).includes(String(x)); const A = typeof x === "string" && /^\d{4}-/.test(x) ? new Date(x).getTime() : x, B = typeof v === "string" && /^\d{4}-/.test(v) ? new Date(v).getTime() : v;
  return op === "=" ? String(x) === String(v) : op === ">=" ? A >= B : op === ">" ? A > B : op === "<" ? A < B : A <= B; };
class Q {
  constructor(t) { this.t = t; this.f = []; this.o = []; this.act = "select"; this.cols = "*"; }
  select(c = "*") { if (this.act === "select") this.cols = c; return this; }
  insert(v) { this.act = "insert"; this.v = v; return this; } update(v) { this.act = "update"; this.v = v; return this; } delete() { this.act = "delete"; return this; }
  eq(c, v) { this.f.push([c, "=", v]); return this; } gte(c, v) { this.f.push([c, ">=", v]); return this; } gt(c, v) { this.f.push([c, ">", v]); return this; }
  lt(c, v) { this.f.push([c, "<", v]); return this; } lte(c, v) { this.f.push([c, "<=", v]); return this; } in(c, v) { this.f.push([c, "in", v]); return this; }
  order(c, o = {}) { this.o.push([c, o.ascending !== false]); return this; } maybeSingle() { this.one = true; return this; } single() { this.one = true; return this; }
  run() {
    const T = DB[this.t]; const ok = r => this.f.every(([c, op, v]) => cmp(r[c], op, v));
    if (this.act === "insert") {
      const r = { ...this.v };
      if (this.t === "time_off") { r.id = seq++; r.created_at = new Date().toISOString(); }
      if (this.t === "services" && T.some(x => x.id === r.id)) return { data: null, error: { message: "duplicate key value" } };
      if (this.t === "services") Object.assign(r, { benefits: r.benefits || [], care: r.care || [] });
      T.push(r); return { data: [r], error: null };
    }
    if (this.act === "update") {
      if (this.t === "settings" && this.v.hours) for (const h of Object.values(this.v.hours)) if (h && h[0] >= h[1]) return { data: null, error: { message: "violates check constraint \"hours_formato\"" } };
      const rs = T.filter(ok); rs.forEach(r => Object.assign(r, this.v)); return { data: rs, error: null };
    }
    if (this.act === "delete") { const rs = T.filter(ok); DB[this.t] = T.filter(r => !rs.includes(r)); return { data: rs, error: null }; }
    let rs = T.filter(ok).map(r => ({ ...r }));
    this.o.forEach(([c, asc]) => rs.sort((x, y) => (x[c] > y[c] ? 1 : x[c] < y[c] ? -1 : 0) * (asc ? 1 : -1)));
    return { data: this.one ? rs[0] || null : rs, error: null };
  }
  then(res, rej) { return new Promise(r => setTimeout(() => r(this.run()), 120)).then(res, rej); }
}
let logado = false;
window.supabase = { createClient: () => ({
  from: t => new Q(t),
  rpc: async fn => fn === "am_i_admin" ? { data: logado, error: null } : { data: null, error: { message: "indisponível na demonstração" } },
  auth: {
    signInWithPassword: async () => { logado = true; return { data: { session: { user: { id: "demo" } } }, error: null }; },
    getSession: async () => ({ data: { session: logado ? { user: { id: "demo" } } : null } }),
    signOut: async () => { logado = false; return { error: null }; },
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
    resetPasswordForEmail: async () => ({ error: null }), updateUser: async () => ({ error: null }),
  },
}) };
window.SITE.supabase = { url: "demo", chavePublica: "demo" };
window.PAINEL_DEMO = true;
})();
