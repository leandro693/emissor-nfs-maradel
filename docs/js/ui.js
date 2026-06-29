// ============================================================
//  ui.js — helpers de interface, máscaras, formatação e ícones
//  Funções puras + utilidades de DOM reutilizadas pelas telas.
// ============================================================

// ---- ícones (Lucide inline, 1.5px stroke) ----------------------------------
// Mantém o app sem dependência de fonte de ícones. Cada chave => <svg> string.
const P = (d, sw = 1.8) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
export const ICON = {
  home:    P('<path d="M3 9.5 12 3l9 6.5V20a1 1 0 0 1-1 1h-5v-7h-6v7H4a1 1 0 0 1-1-1z"/>'),
  file:    P('<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>'),
  users:   P('<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/>'),
  plus:    P('<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>', 2.4),
  back:    P('<line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>'),
  chevR:   P('<polyline points="9 18 15 12 9 6"/>', 2),
  chevD:   P('<polyline points="6 9 12 15 18 9"/>', 2),
  search:  P('<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>', 2),
  copy:    P('<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>', 2),
  check:   P('<polyline points="20 6 9 17 4 12"/>', 2.4),
  download:P('<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>', 2),
  upload:  P('<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>'),
  mail:    P('<rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-10 5L2 7"/>'),
  lock:    P('<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>'),
  bell:    P('<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>', 1.6),
  list:    P('<line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>'),
  chart:   P('<path d="M3 3v18h18"/><path d="M18.7 8 13 13.6l-3-3L6.3 14.3"/>'),
  info:    P('<circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>'),
  logout:  P('<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>'),
  party:   P('<path d="M5.8 11.3 2 22l10.7-3.79"/><path d="M4 3h.01M22 8h.01M15 2h.01M22 20h.01"/><path d="m11 13 9-9"/><path d="M14 7a4 4 0 0 1 6 6"/>', 1.5),
  send:    P('<line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>'),
  user:    P('<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>'),
  x:       P('<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>', 2),
  phone:   P('<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z"/>', 1.7),
  // ícone WhatsApp (preenchido, marca) — usa fill currentColor
  whatsapp:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M.057 24l1.687-6.163a11.867 11.867 0 0 1-1.587-5.945C.16 5.335 5.495 0 12.05 0a11.82 11.82 0 0 1 8.413 3.488 11.82 11.82 0 0 1 3.48 8.414c-.003 6.557-5.338 11.892-11.893 11.892a11.9 11.9 0 0 1-5.688-1.448L.057 24zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884a9.86 9.86 0 0 0 1.51 5.26l-.999 3.648 3.477-.913zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z"/></svg>',
  link:    P('<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>', 1.9),
  eye:     P('<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/>', 1.8),
  refresh: P('<polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>', 1.9),
  alert:   P('<path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>', 1.8),
  // menu (hambúrguer) — usado no botão de retrair/expandir a sidebar (desktop)
  menu:    P('<line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>', 2),
  // edit (lápis) — editar cadastro/solicitação
  edit:    P('<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4z"/>'),
  // settings (engrenagem) — tela de configurações (contato de atendimento)
  settings:P('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>', 1.6),
  // help (interrogação) — contato de atendimento
  help:    P('<circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/>'),
  // building (prédio) — cadastro de tomadores (quem recebe a nota)
  building:P('<rect x="4" y="2" width="16" height="20" rx="2"/><path d="M9 22v-4h6v4"/><line x1="8" y1="6" x2="8" y2="6"/><line x1="12" y1="6" x2="12" y2="6"/><line x1="16" y1="6" x2="16" y2="6"/><line x1="8" y1="10" x2="8" y2="10"/><line x1="12" y1="10" x2="12" y2="10"/><line x1="16" y1="10" x2="16" y2="10"/><line x1="8" y1="14" x2="8" y2="14"/><line x1="12" y1="14" x2="12" y2="14"/><line x1="16" y1="14" x2="16" y2="14"/>'),
};

// ---- formatação -------------------------------------------------------------

// Formata número para moeda BRL: 4800 => "R$ 4.800,00".
export function brl(n){
  return (Number(n)||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
}

// Converte string digitada em centavos/reais. Aceita "4.800,00" ou "480000".
export function parseBRL(str){
  const digits = String(str).replace(/\D/g,'');
  return digits ? Number(digits)/100 : 0;
}

// Máscara de moeda enquanto digita (recebe input event target).
export function maskMoneyInput(el){
  el.addEventListener('input', () => {
    const v = parseBRL(el.value);
    el.value = v ? brl(v) : '';
  });
}

// Máscara dinâmica de CNPJ (00.000.000/0000-00) ou CPF (000.000.000-00).
export function maskDoc(str){
  const d = String(str).replace(/\D/g,'').slice(0,14);
  if (d.length <= 11){
    return d.replace(/(\d{3})(\d)/,'$1.$2').replace(/(\d{3})(\d)/,'$1.$2').replace(/(\d{3})(\d{1,2})$/,'$1-$2');
  }
  return d.replace(/^(\d{2})(\d)/,'$1.$2').replace(/^(\d{2})\.(\d{3})(\d)/,'$1.$2.$3')
          .replace(/\.(\d{3})(\d)/,'.$1/$2').replace(/(\d{4})(\d{1,2})$/,'$1-$2');
}
export function maskDocInput(el){
  el.addEventListener('input', () => { el.value = maskDoc(el.value); });
}

// Competência 'YYYY-MM' do mês atual.
export function currentCompetencia(){
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
}
const MESES = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];
// 'YYYY-MM' => 'Jun/2026'
export function fmtCompetencia(ym){
  if(!ym) return '—';
  const [y,m] = ym.split('-');
  const nome = MESES[Number(m)-1] || '';
  return `${nome.charAt(0).toUpperCase()+nome.slice(1)}/${y}`;
}
export function fmtCompetenciaShort(ym){ // 06/2026
  if(!ym) return '—'; const [y,m]=ym.split('-'); return `${m}/${y}`;
}
// data relativa simples: "há 14 min", "há 2 h", "18/jun"
export function relTime(iso){
  const t = new Date(iso), now = new Date(), diff = (now - t)/1000;
  if(diff < 60) return 'agora';
  if(diff < 3600) return `há ${Math.floor(diff/60)} min`;
  if(diff < 86400) return `há ${Math.floor(diff/3600)} h`;
  return `${String(t.getDate()).padStart(2,'0')}/${MESES[t.getMonth()]}`;
}
export function fmtDate(iso){
  if(!iso) return '—'; const t = new Date(iso);
  return t.toLocaleDateString('pt-BR');
}
// data + hora curtas: "23/06/2026 14:35" (usada no histórico de envios/aberturas)
export function fmtDateTime(iso){
  if(!iso) return '—'; const t = new Date(iso);
  return t.toLocaleString('pt-BR', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' });
}
// iniciais de um nome: "Studio Clareza" => "SC"
export function initials(name){
  return (name||'?').split(/\s+/).slice(0,2).map(s=>s[0]||'').join('').toUpperCase();
}
export const STATUS_LABEL = {
  solicitada:'Solicitada', em_emissao:'Em emissão',
  aguardando_conferencia:'Aguardando conferência',
  emitida:'Emitida', cancelada:'Cancelada'
};

// Rótulos dos papéis (hierarquia interna + cliente).
export const ROLE_LABEL = {
  admin_master:'Administrador master', admin_operacional:'Admin operacional',
  analista:'Analista fiscal', auxiliar:'Auxiliar', cliente:'Cliente'
};
export function roleLabel(role){ return ROLE_LABEL[role] || 'Usuário'; }

// Nome para exibir: usa o nome do profile; se vazio, deriva do e-mail
// (ex.: "leandro.silva@maradel.com" => "Leandro Silva"). Evita cair em
// "Equipe Maradel" quando a pessoa ainda não preencheu o nome.
export function nomeExibicao(profile, fallback='Usuário'){
  const n = (profile?.nome || '').trim();
  if(n) return n;
  const local = (profile?.email || '').split('@')[0];
  if(!local) return fallback;
  return local.split(/[._-]+/).filter(Boolean)
    .map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(' ') || fallback;
}

// ---- AJUDA / TREINAMENTOS ---------------------------------------------------
// Conteúdo por tela (texto + vídeo). Para publicar um vídeo, cole o ID do
// YouTube (recomendado: vídeo "não listado") no campo `video`. Enquanto vazio,
// mostra "em breve". É só editar este objeto — sem mexer no resto do código.
//   Ex.: video:'dQw4w9WgXcQ'  (o trecho depois de "watch?v=")
export const AJUDA = {
  completo:      { titulo:'Treinamento completo', texto:'Visão geral do sistema, do início ao fim — para quem está começando.', video:'' },
  // — Equipe (escritório) —
  fila:          { titulo:'Fila de solicitações', texto:'Onde chegam as solicitações dos clientes. Toque numa linha para ver os dados e emitir a nota. Use as abas para alternar entre Solicitadas, Conferência e Atendidas; a busca encontra qualquer status (inclui canceladas).', video:'' },
  conferencia:   { titulo:'Conferência', texto:'Aqui o analista revisa o que o auxiliar preparou e libera (ou devolve) a emissão.', video:'' },
  notas:         { titulo:'Notas emitidas', texto:'Histórico das notas atendidas. Em breve: filtro por período e por cliente.', video:'' },
  clientes:      { titulo:'Clientes (prestadores)', texto:'Cadastro dos prestadores. Toque para ver os detalhes e o acesso à prefeitura. Use a busca para localizar por empresa, CNPJ ou e-mail.', video:'' },
  tomadores:     { titulo:'Tomadores', texto:'Cadastro de quem recebe a nota, vinculado a um prestador. O mesmo tomador pode existir para vários prestadores. O vínculo aparece para o cliente na nova solicitação.', video:'' },
  equipe:        { titulo:'Equipe', texto:'Gestão dos usuários internos e seus papéis (master, admin, analista, auxiliar).', video:'' },
  config:        { titulo:'Configurações', texto:'Contato de atendimento exibido ao cliente em "Precisa de ajuda?".', video:'' },
  // — Cliente (prestador) —
  'cli-inicio':       { titulo:'Início', texto:'Seu painel: faturamento do mês, atalho de ajuda e suas últimas solicitações.', video:'' },
  'cli-nova':         { titulo:'Nova solicitação', texto:'Escolha o tomador, descreva o serviço, informe valor e competência. A Maradel emite e avisa você.', video:'' },
  'cli-solicitacoes': { titulo:'Minhas solicitações', texto:'Acompanhe todas as suas solicitações e baixe a nota (PDF/XML) quando emitida.', video:'' },
  'cli-tomadores':    { titulo:'Cadastro de tomadores', texto:'Cadastre quem recebe suas notas. Depois é só selecionar na nova solicitação.', video:'' },
  'cli-conta':        { titulo:'Minha conta', texto:'Seus dados de acesso, telefone/WhatsApp e troca de senha.', video:'' },
};

// Abre a ajuda de uma tela (modal com texto + vídeo + contatos, quando houver).
//   opts.contato: { nome, whatsapp, email } — exibe "falar com o atendimento".
export function openAjuda(key, opts = {}){
  const a = AJUDA[key] || AJUDA.completo;
  const video = a.video
    ? `<div class="ajuda-video"><iframe src="https://www.youtube-nocookie.com/embed/${esc(a.video)}" title="${esc(a.titulo)}" allow="encrypted-media; picture-in-picture; fullscreen" allowfullscreen></iframe></div>`
    : `<div class="ajuda-soon"><span style="width:18px">${ICON.party}</span><span>Vídeo de treinamento em breve.</span></div>`;
  const c = opts.contato;
  const wpp = c?.whatsapp ? `https://wa.me/${String(c.whatsapp).replace(/\D/g,'')}` : '';
  const contatoHTML = (c && (wpp || c.email)) ? `
    <div class="ajuda-contato">
      <div class="ajuda-contato-t">Precisa falar com alguém?</div>
      <div class="btn-row">
        ${wpp?`<a class="btn btn-outline btn-sm" href="${esc(wpp)}" target="_blank" rel="noopener">${ICON.whatsapp}<span>${esc(c.nome||'Atendimento')}</span></a>`:''}
        ${c.email?`<a class="btn btn-outline btn-sm" href="mailto:${esc(c.email)}">${ICON.mail}<span>E-mail</span></a>`:''}
      </div>
      <button class="ajuda-dev" id="aj-dev">${ICON.help}<span>Sobre o sistema · falar com o desenvolvedor</span></button>
    </div>` : '';
  const m = openModal(`
    <div class="modal-head"><h3>${esc(a.titulo)}</h3><button class="modal-x" id="aj-x">${ICON.x}</button></div>
    <p class="modal-sub">${esc(a.texto)}</p>
    ${video}
    ${contatoHTML}
    <div class="modal-actions">
      ${key!=='completo'?`<button class="btn btn-outline btn-block" id="aj-full">Ver treinamento completo</button>`:''}
      <button class="btn btn-primary btn-block" id="aj-ok">Fechar</button>
    </div>`);
  m.querySelector('#aj-x').onclick = closeModal;
  m.querySelector('#aj-ok').onclick = closeModal;
  const full = m.querySelector('#aj-full');
  if(full) full.onclick = () => openAjuda('completo');
  const dev = m.querySelector('#aj-dev');
  if(dev) dev.onclick = () => {
    const m2 = openModal(`
      <div class="modal-head"><h3>Sobre o sistema</h3><button class="modal-x" id="dv-x">${ICON.x}</button></div>
      <p class="modal-sub">Este sistema foi <strong>desenvolvido pelo Grupo Maradel</strong> — Desenvolvimento de softwares sob medida. Em breve você poderá falar com nosso time comercial para soluções personalizadas.</p>
      <div class="modal-actions"><button class="btn btn-primary btn-block" id="dv-ok">Entendi</button></div>`);
    m2.querySelector('#dv-x').onclick = closeModal;
    m2.querySelector('#dv-ok').onclick = closeModal;
  };
}

// ---- FOLHA DE CONTA (bottom sheet) — usada no escritório e no cliente --------
// Mostra nome + papel, ações opcionais (ex.: Configurações — fora do dia a dia)
// e um botão claro "Sair da conta", com confirmação para evitar saída acidental.
//   acoes: [{ label, sub?, icon, onClick }]   onSair: encerra a sessão.
export function openContaSheet({ nome, papelLabel, acoes = [], onSair }){
  const acoesHTML = acoes.map((a, i) =>
    `<button class="sheet-item" data-acao="${i}"><span class="sheet-ic">${a.icon}</span>
       <span class="sheet-tx"><span class="t">${esc(a.label)}</span>${a.sub?`<span class="s">${esc(a.sub)}</span>`:''}</span>${ICON.chevR}</button>`).join('');
  const ov = document.createElement('div');
  ov.className = 'sheet-overlay';
  ov.innerHTML = `<div class="sheet">
    <div class="sheet-grip"></div>
    <div class="acct-head">
      <span class="acct-ava">${initials(nome)}</span>
      <span class="acct-info"><span class="nm">${esc(nome)}</span><span class="rl">${esc(papelLabel||'')}</span></span>
    </div>
    ${acoesHTML}
    <div class="sheet-confirm hidden" id="cs-confirm">Tem certeza que deseja sair?</div>
    <button class="sheet-logout" id="cs-sair">${ICON.logout}<span>Sair da conta</span></button>`;
  ov.addEventListener('click', e => { if(e.target === ov) ov.remove(); });
  document.body.appendChild(ov);
  acoes.forEach((a, i) => {
    ov.querySelector(`[data-acao="${i}"]`).onclick = () => { ov.remove(); a.onClick?.(); };
  });
  const btn = ov.querySelector('#cs-sair');
  const conf = ov.querySelector('#cs-confirm');
  let armado = false;
  btn.onclick = async () => {
    if(!armado){ armado = true; conf.classList.remove('hidden');
      btn.querySelector('span').textContent = 'Confirmar saída'; btn.classList.add('arm'); return; }
    await onSair();
  };
  return ov;
}

// ---- DOM helpers ------------------------------------------------------------
export const el = (id) => document.getElementById(id);
export function html(node, str){ node.innerHTML = str; return node; }
export function esc(s){ return String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }

// Toast de feedback rápido.
let toastTimer;
export function toast(msg){
  let t = el('toast'); if(!t){ t = document.createElement('div'); t.id='toast'; document.body.appendChild(t); }
  t.textContent = msg; t.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(()=>t.classList.remove('show'), 2200);
}

// Copia texto para a área de transferência e dá feedback visual no botão.
export async function copyToClipboard(text, btn){
  try{ await navigator.clipboard.writeText(text); }
  catch{ const ta=document.createElement('textarea'); ta.value=text; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove(); }
  if(btn){
    const original = btn.innerHTML;
    btn.classList.add('done'); btn.innerHTML = `${ICON.check}<span>Copiado</span>`;
    setTimeout(()=>{ btn.classList.remove('done'); btn.innerHTML = original; }, 1600);
  }
  toast('Copiado para a área de transferência');
}

// Constrói um selo de status.
export function badge(status){
  return `<span class="badge ${status}"><span class="dot"></span>${STATUS_LABEL[status]||status}</span>`;
}

// Selo ÚNICO de status (nunca empilhado). Quando há ressalva, mostra uma única
// tag "<Status> · com ressalva" com cor própria (âmbar/terracota). Cores fixas
// por status (cinza/âmbar/azul/verde/vermelho) definidas no CSS, iguais em todo
// o app. Use sempre esta função para exibir status nas listas e detalhes.
export function statusTag(status, ressalva){
  if(ressalva){
    return `<span class="badge st-ressalva"><span class="dot"></span>${STATUS_LABEL[status]||status} · com ressalva</span>`;
  }
  return badge(status);
}

// Selo "com ressalva" — solicitação registrada sem número de pedido obrigatório
// (item B). Apenas visual; o bloqueio real da emissão é feito no banco.
export function ressalvaPill(){
  return `<span class="badge ressalva"><span style="width:11px;height:11px;display:inline-flex">${ICON.alert}</span>Com ressalva</span>`;
}

// ---- TOGGLE (interruptor sim/não) -------------------------------------------
// Componente de chave reutilizável (ex.: "exige número de pedido?",
// "recorrente?"). Renderiza o HTML; bindToggle liga o clique; isToggleOn lê.
export function toggle(id, label, on){
  return `<button type="button" class="toggle ${on?'on':''}" id="${id}" role="switch" aria-checked="${on?'true':'false'}">
    <span class="knob"></span><span class="tg-label">${label}</span></button>`;
}
export function bindToggle(scope, id, onChange){
  const el = scope.querySelector('#'+id);
  if(!el) return;
  el.onclick = () => {
    const on = !el.classList.contains('on');
    el.classList.toggle('on', on);
    el.setAttribute('aria-checked', on?'true':'false');
    onChange?.(on);
  };
}
export function isToggleOn(scope, id){
  return !!scope.querySelector('#'+id)?.classList.contains('on');
}

// ---- LINK PÚBLICO DA NOTA (item D) ------------------------------------------
// Monta a URL pública a partir do token. A página fica em /nota/ (relativa ao
// diretório do index.html), lendo o token na query string. Funciona em qualquer
// host estático (GitHub Pages, localhost) sem reescrita de servidor.
export function notaPublicUrl(token){
  if(!token) return '';
  const dir = window.location.origin + window.location.pathname.replace(/[^/]*$/, '');
  return `${dir}nota/?t=${encodeURIComponent(token)}`;
}

// Cartão do link público (copiar / abrir / regenerar). Reutilizado por cliente
// e analista. bindLinkPublico liga os botões; a regeneração e o refresh entram
// por callback (a ui não conhece a camada de api).
export function linkPublicoCard(token){
  const url = notaPublicUrl(token);
  return `
    <div class="card linkpub">
      <div class="fat-label" style="display:flex;align-items:center;gap:7px"><span style="width:15px">${ICON.link}</span>Link de visualização</div>
      <div class="linkpub-url" id="lp-url">${esc(url)}</div>
      <div class="btn-row" style="margin-top:10px">
        <button class="btn btn-outline btn-sm" id="lp-copy">${ICON.copy}<span>Copiar link</span></button>
        <a class="btn btn-outline btn-sm" id="lp-open" href="${esc(url)}" target="_blank" rel="noopener">${ICON.eye}<span>Abrir</span></a>
        <button class="btn btn-outline btn-sm" id="lp-regen">${ICON.refresh}<span>Regenerar</span></button>
      </div>
    </div>`;
}
export function bindLinkPublico(scope, token, { onRegenerar, onRefresh } = {}){
  const url = notaPublicUrl(token);
  scope.querySelector('#lp-copy').onclick = (e) => copyToClipboard(url, e.currentTarget);
  const reg = scope.querySelector('#lp-regen');
  if(reg) reg.onclick = async () => {
    if(!confirm('Gerar um novo link? O link anterior deixa de funcionar.')) return;
    try{ await onRegenerar?.(); toast('Novo link gerado'); onRefresh?.(); }
    catch(e){ toast('Erro: '+e.message); }
  };
}

// Copia conteúdo rico (HTML + texto puro) para a área de transferência. Ao
// colar no Gmail/Outlook web, o HTML vira o link clicável ("âncora"); o texto
// puro é o fallback. Cai para cópia simples quando a API rica não existe.
export async function copyRich(html, text, btn){
  try{
    const item = new ClipboardItem({
      'text/html':  new Blob([html], { type:'text/html' }),
      'text/plain': new Blob([text], { type:'text/plain' }),
    });
    await navigator.clipboard.write([item]);
  }catch{
    await copyToClipboard(text, btn);
    return;
  }
  if(btn){
    const original = btn.innerHTML;
    btn.classList.add('done'); btn.innerHTML = `${ICON.check}<span>Copiado</span>`;
    setTimeout(()=>{ btn.classList.remove('done'); btn.innerHTML = original; }, 1600);
  }
  toast('Mensagem copiada (link clicável)');
}

// ---- MODAL ------------------------------------------------------------------
// Abre um modal sobreposto com o HTML interno informado e devolve o nó .modal
// (para ligar eventos). closeModal() remove o overlay aberto.
export function openModal(innerHTML){
  closeModal();
  const ov = document.createElement('div');
  ov.className = 'modal-overlay'; ov.id = 'modal-overlay';
  ov.innerHTML = `<div class="modal">${innerHTML}</div>`;
  ov.addEventListener('click', e => { if(e.target === ov) closeModal(); });
  document.body.appendChild(ov);
  return ov.querySelector('.modal');
}
export function closeModal(){
  const ov = document.getElementById('modal-overlay');
  if(ov) ov.remove();
}

// ============================================================
//  ENVIO DA NOTA (sem servidor) — e-mail (mailto) e WhatsApp (wa.me)
//  Em ambos: gera o LINK público de visualização (item D) e monta o
//  texto padrão com o link. NÃO anexa arquivo — o destinatário baixa
//  PDF/XML na própria página da nota. O usuário confirma e envia pelo
//  próprio canal. Cada envio é registrado no histórico (item F) via
//  o callback opts.onEnviado(canal, destinatario).
// ============================================================

// Texto padrão (item E), em versão pura (WhatsApp / corpo do mailto).
function msgPadraoTexto({ numero, empresa, dataEmissao, link, assinatura }){
  return `Prezado(a), segue a Nota Fiscal de Serviço nº ${numero||'—'}, referente aos serviços prestados por ${empresa||''}, emitida em ${dataEmissao||'—'}. Acesse pelo link: ${link}. Atenciosamente, ${assinatura||empresa||''}.`;
}
// Versão HTML — o link vira a âncora clicável "Visualizar Nota Fiscal" (e-mail).
function msgPadraoHtml({ numero, empresa, dataEmissao, link, assinatura }){
  return `<p>Prezado(a), segue a Nota Fiscal de Serviço nº ${esc(numero||'—')}, referente aos serviços prestados por ${esc(empresa||'')}, emitida em ${esc(dataEmissao||'—')}. ` +
         `<a href="${esc(link)}">Visualizar Nota Fiscal</a>. Atenciosamente, ${esc(assinatura||empresa||'')}.</p>`;
}

// ---- ENVIO POR E-MAIL -------------------------------------------------------
//  opts: { numero, empresa, dataEmissao, assinatura, token, tomadorEmail, onEnviado }
export function openEnvioEmail(opts){
  const { numero, empresa, dataEmissao, assinatura, token, tomadorEmail, onEnviado } = opts;
  const link = notaPublicUrl(token);
  const assunto = `Nota Fiscal de Serviço nº ${numero||'—'} — ${empresa||''}`;
  const corpo = msgPadraoTexto({ numero, empresa, dataEmissao, link, assinatura });
  const corpoHtml = msgPadraoHtml({ numero, empresa, dataEmissao, link, assinatura });

  // Passo 1: se o tomador tem e-mail, pergunta "Enviar para [e-mail]?" (item E).
  if(tomadorEmail){
    const m = openModal(`
      <div class="modal-head"><h3>Enviar por e-mail</h3>
        <button class="modal-x" id="md-x">${ICON.x}</button></div>
      <p class="modal-sub">Enviar para <strong>${esc(tomadorEmail)}</strong>?</p>
      <div class="modal-actions">
        <button class="btn btn-primary btn-block" id="md-sim">Sim, usar este e-mail</button>
        <button class="btn btn-outline btn-block" id="md-outro">Não / Alterar e-mail</button>
      </div>`);
    m.querySelector('#md-x').onclick = closeModal;
    m.querySelector('#md-sim').onclick = () => stepCompor(tomadorEmail);
    m.querySelector('#md-outro').onclick = () => stepDigitar('');
  } else {
    stepDigitar('');
  }

  // Passo intermediário: digitar/alterar o e-mail do destinatário.
  function stepDigitar(valor){
    const m = openModal(`
      <div class="modal-head"><h3>E-mail do destinatário</h3>
        <button class="modal-x" id="md-x">${ICON.x}</button></div>
      <div class="field" style="margin-top:14px"><label>E-mail</label>
        <input class="input" id="md-email" type="email" value="${esc(valor)}" placeholder="destinatario@empresa.com.br"></div>
      <div class="modal-actions">
        <button class="btn btn-primary btn-block" id="md-ok">Continuar</button>
      </div>`);
    m.querySelector('#md-x').onclick = closeModal;
    const inp = m.querySelector('#md-email');
    inp.focus();
    m.querySelector('#md-ok').onclick = () => {
      const v = inp.value.trim();
      if(!/^[^@]+@[^@]+\.[^@]+$/.test(v)) return toast('Informe um e-mail válido');
      stepCompor(v);
    };
  }

  // Passo final: compor — copiar mensagem (link clicável) e abrir o e-mail.
  function stepCompor(dest){
    const mailto = `mailto:${encodeURIComponent(dest)}?subject=${encodeURIComponent(assunto)}&body=${encodeURIComponent(corpo)}`;
    const m = openModal(`
      <div class="modal-head"><h3>Enviar nota nº ${esc(numero||'—')}</h3>
        <button class="modal-x" id="md-x">${ICON.x}</button></div>
      <div class="mail-kv"><span class="k">Para</span><span class="v">${esc(dest)}</span></div>
      <div class="mail-kv"><span class="k">Assunto</span><span class="v">${esc(assunto)}</span></div>
      <label class="mail-label">Mensagem</label>
      <div class="msg-preview">Prezado(a), segue a Nota Fiscal de Serviço nº ${esc(numero||'—')}, referente aos serviços prestados por ${esc(empresa||'')}, emitida em ${esc(dataEmissao||'—')}. <a href="${esc(link)}" target="_blank" rel="noopener">Visualizar Nota Fiscal</a>. Atenciosamente, ${esc(assinatura||empresa||'')}.</div>
      <button class="btn btn-outline btn-block" id="md-copy" style="margin-top:12px">${ICON.copy}<span>Copiar mensagem (link clicável)</span></button>
      <a class="btn btn-primary btn-block" id="md-abrir" href="${mailto}" style="margin-top:10px">${ICON.send}<span>Abrir e-mail</span></a>
      <p class="modal-foot">No e-mail, o link aparece como <strong>Visualizar Nota Fiscal</strong>. Use <strong>Copiar mensagem</strong> e cole no corpo para manter o link clicável.</p>`);
    m.querySelector('#md-x').onclick = closeModal;
    m.querySelector('#md-copy').onclick = (e) => copyRich(corpoHtml, corpo, e.currentTarget);
    m.querySelector('#md-abrir').onclick = () => {
      toast('Abrindo seu e-mail…');
      onEnviado?.('email', dest);
    };
  }
}

// ---- ENVIO POR WHATSAPP -----------------------------------------------------
//  opts: { numero, empresa, dataEmissao, assinatura, token,
//          clienteTelefone, clienteGrupo, onEnviado }
export function openEnvioWhatsApp(opts){
  const { numero, empresa, dataEmissao, assinatura, token, clienteTelefone, clienteGrupo, onEnviado } = opts;
  const link = notaPublicUrl(token);
  const corpo = msgPadraoTexto({ numero, empresa, dataEmissao, link, assinatura });
  const temTel = !!(clienteTelefone && String(clienteTelefone).trim());
  const temGrp = !!(clienteGrupo && String(clienteGrupo).trim());

  // Se há telefone E grupo, pergunta qual usar (item E).
  if(temTel && temGrp){
    const m = openModal(`
      <div class="modal-head"><h3>Enviar por WhatsApp</h3>
        <button class="modal-x" id="md-x">${ICON.x}</button></div>
      <p class="modal-sub">Para onde enviar esta nota?</p>
      <div class="modal-actions">
        <button class="btn btn-primary btn-block" id="md-tel">${ICON.phone}<span>Número (${esc(formatTel(clienteTelefone))})</span></button>
        <button class="btn btn-outline btn-block" id="md-grp">${ICON.users}<span>Grupo do WhatsApp</span></button>
      </div>`);
    m.querySelector('#md-x').onclick = closeModal;
    m.querySelector('#md-tel').onclick = () => stepTelefone(clienteTelefone);
    m.querySelector('#md-grp').onclick = () => stepGrupo();
  } else if(temTel){
    stepTelefone(clienteTelefone);
  } else if(temGrp){
    stepGrupo();
  } else {
    stepTelefone('');
  }

  // Envio para um número: abre wa.me com o texto já pronto.
  function stepTelefone(valor){
    const m = openModal(`
      <div class="modal-head"><h3>Enviar por WhatsApp</h3>
        <button class="modal-x" id="md-x">${ICON.x}</button></div>
      <div class="field" style="margin-top:14px"><label>Número (com DDD)</label>
        <input class="input" id="md-tel" inputmode="tel" value="${esc(formatTel(valor))}" placeholder="(11) 99999-8888"></div>
      <label class="mail-label">Mensagem</label>
      <textarea class="textarea" id="md-corpo" rows="5" readonly>${esc(corpo)}</textarea>
      <button class="btn btn-outline btn-block" id="md-copy" style="margin-top:10px">${ICON.copy}<span>Copiar mensagem</span></button>
      <button class="btn btn-primary btn-block" id="md-abrir" style="margin-top:10px">${ICON.whatsapp}<span>Abrir no WhatsApp</span></button>
      <p class="modal-foot">O WhatsApp abre com o texto e o link prontos. É só conferir e enviar.</p>`);
    m.querySelector('#md-x').onclick = closeModal;
    const inp = m.querySelector('#md-tel');
    if(!valor) inp.focus();
    m.querySelector('#md-copy').onclick = (e) => copyToClipboard(corpo, e.currentTarget);
    m.querySelector('#md-abrir').onclick = () => {
      const digits = soDigitos(inp.value);
      if(digits.length < 10) return toast('Informe um número de WhatsApp válido');
      const fone = digits.length <= 11 ? '55'+digits : digits; // assume Brasil se sem DDI
      window.open(`https://wa.me/${fone}?text=${encodeURIComponent(corpo)}`, '_blank');
      onEnviado?.('whatsapp', fone);
      closeModal();
    };
  }

  // Envio para um grupo: o link de grupo não aceita texto pré-preenchido,
  // então copiamos a mensagem e abrimos o grupo para o usuário colar e enviar.
  function stepGrupo(){
    const m = openModal(`
      <div class="modal-head"><h3>Enviar ao grupo</h3>
        <button class="modal-x" id="md-x">${ICON.x}</button></div>
      <p class="modal-sub">Vamos <strong>copiar a mensagem</strong> e abrir o grupo. No WhatsApp, é só <strong>colar e enviar</strong>.</p>
      <label class="mail-label">Mensagem</label>
      <textarea class="textarea" id="md-corpo" rows="5" readonly>${esc(corpo)}</textarea>
      <button class="btn btn-outline btn-block" id="md-copy" style="margin-top:10px">${ICON.copy}<span>Copiar mensagem</span></button>
      <button class="btn btn-primary btn-block" id="md-abrir" style="margin-top:10px">${ICON.whatsapp}<span>Copiar e abrir o grupo</span></button>`);
    m.querySelector('#md-x').onclick = closeModal;
    m.querySelector('#md-copy').onclick = (e) => copyToClipboard(corpo, e.currentTarget);
    m.querySelector('#md-abrir').onclick = async () => {
      await copyToClipboard(corpo);
      window.open(clienteGrupo, '_blank');
      onEnviado?.('whatsapp', 'grupo');
      closeModal();
    };
  }
}

// Telefone só com dígitos.
function soDigitos(s){ return String(s||'').replace(/\D/g, ''); }
// Formata para exibição amigável (11) 99999-8888 a partir dos dígitos.
function formatTel(s){
  const d = soDigitos(s).replace(/^55/, '');
  if(d.length === 11) return `(${d.slice(0,2)}) ${d.slice(2,7)}-${d.slice(7)}`;
  if(d.length === 10) return `(${d.slice(0,2)}) ${d.slice(2,6)}-${d.slice(6)}`;
  return s || '';
}
