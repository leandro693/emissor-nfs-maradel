// ============================================================
//  client.js — telas do CLIENTE (prestador), mobile-first
//  Dashboard, nova solicitação, tomadores, detalhe da nota.
// ============================================================
import * as api from './api.js';
import {
  ICON, brl, parseBRL, maskMoneyInput, maskDocInput, currentCompetencia,
  fmtCompetencia, fmtCompetenciaShort, relTime, fmtDate, initials, badge,
  esc, toast, copyToClipboard, openEnvioEmail, openEnvioWhatsApp,
  ressalvaPill, statusTag, notaPublicUrl, linkPublicoCard, bindLinkPublico,
  toggle, bindToggle, isToggleOn, fmtDateTime, openModal, closeModal, openContaSheet, openAjuda
} from './ui.js';

let CTX = { profile:null, cliente:null, root:null, tab:'dashboard' };

// Título do cabeçalho (desktop) por aba de topo. Subtelas (nova/detalhe)
// definem o próprio título via setHeader().
const TAB_TITLE = {
  dashboard:'Início', solicitacoes:'Minhas solicitações',
  tomadores:'Cadastro de Tomadores', conta:'Minha conta'
};

// Ponto de entrada: monta o shell do cliente. Faz onboarding se necessário.
export async function mountCliente(root, profile){
  CTX = { profile, cliente:null, root, tab:'dashboard', contato:null };
  const [cliente, contato] = await Promise.all([
    api.getMeuCliente(),
    api.getConfigAtendimento().catch(()=>null),
  ]);
  CTX.cliente = cliente; CTX.contato = contato;
  if(!CTX.cliente){ return renderSemCadastro(); }
  renderShell();
  showDashboard();
}

// ---- shell + navegação ------------------------------------------------------
// Layout adaptativo (item 1): a MESMA marcação traz a sidebar (desktop) e a
// barra inferior (mobile); o CSS mostra uma ou outra conforme a largura da tela.
// No desktop, a sidebar retrai/expande (item 1) e há um cabeçalho com o título
// da tela e o perfil à direita. "Nova solicitação" virou item de menu (item 2).
function renderShell(){
  const nome = CTX.profile.nome || CTX.cliente.razao_social;
  // Preferência de sidebar retraída persiste entre sessões.
  const collapsed = localStorage.getItem('cli_side_collapsed') === '1';
  CTX.root.innerHTML = `
    <div class="cli" data-collapsed="${collapsed?'true':'false'}">
      <!-- SIDEBAR — visível no desktop -->
      <aside class="cli-side">
        <div class="cli-side-head">
          <img class="cli-side-logo" src="assets/logo-horizontal-white.png" alt="Maradel">
          <button class="cli-side-toggle" id="cli-toggle" title="Retrair/expandir menu">${ICON.menu}</button>
        </div>
        <nav class="cli-side-nav">
          <button class="s-item s-nova" data-tab="nova" title="Nova solicitação">${ICON.plus}<span>Nova solicitação</span></button>
          <button class="s-item" data-tab="dashboard" title="Início">${ICON.home}<span>Início</span></button>
          <button class="s-item" data-tab="solicitacoes" title="Solicitações">${ICON.list}<span>Solicitações</span><span class="s-badges" id="sb-side" hidden></span></button>
          <button class="s-item" data-tab="tomadores" title="Cadastro de Tomadores">${ICON.users}<span>Cadastro de Tomadores</span></button>
          <button class="s-item" data-tab="conta" title="Conta">${ICON.user}<span>Conta</span></button>
        </nav>
        <div class="cli-side-user">
          <div class="ava">${initials(nome)}</div>
          <div class="info"><div class="nm">${esc(nome)}</div><div class="rl">Prestador</div></div>
          <button id="cli-logout-side" class="logout" title="Sair">${ICON.logout}</button>
        </div>
      </aside>
      <!-- SHELL — cabeçalho + conteúdo + barra inferior (mobile) -->
      <div class="cli-shell">
        <header class="cli-top">
          <div class="cli-top-brand">
            <img class="cli-top-mark" src="assets/logo-mark.png" alt="Maradel">
            <span class="cli-top-prod">Emissor de Notas</span>
          </div>
          <h1 class="cli-title" id="cli-title">Início</h1>
          <div class="cli-profile">
            <div class="info"><div class="nm">${esc(nome)}</div><div class="rl">Prestador</div></div>
            <button id="cli-ajuda" class="logout" title="Ajuda desta tela">${ICON.help}</button>
            <button id="cli-conta" class="ava" title="Conta">${initials(nome)}</button>
          </div>
        </header>
        <div id="cli-view"></div>
        <nav class="cli-nav">
          <button class="item" data-tab="dashboard">${ICON.home}<span>Início</span></button>
          <button class="item" data-tab="solicitacoes"><span class="nav-ic">${ICON.list}<span class="nb-bubble" id="sb-nav" hidden></span></span><span>Solicitações</span></button>
          <button class="item item-nova" data-tab="nova"><span class="navplus">${ICON.plus}</span><span>Nova</span></button>
          <button class="item" data-tab="tomadores">${ICON.users}<span>Cadastros</span></button>
        </nav>
      </div>
    </div>`;

  // Sair: padronizado com o escritório — abre a folha de Conta com confirmação
  // (evita saída acidental). A sidebar do desktop também usa a folha.
  const sair = async () => { await api.signOut(); location.reload(); };
  // Avatar → menu da conta: Minha conta, Treinamentos e Sair (Conta saiu da barra).
  const abrirConta = () => openContaSheet({ nome, papelLabel:'Prestador',
    acoes: [
      { label:'Minha conta', sub:'Seus dados e senha', icon: ICON.user, onClick: showMinhaConta },
      { label:'Treinamentos', sub:'Vídeos e ajuda do app', icon: ICON.help, onClick: () => openAjuda('completo') },
    ],
    onSair: sair });
  CTX.root.querySelector('#cli-logout-side').onclick = abrirConta;
  // Ajuda contextual da tela atual (com o contato de atendimento embutido).
  CTX.root.querySelector('#cli-ajuda').onclick = () =>
    openAjuda('cli-' + (CTX.tab==='dashboard' ? 'inicio' : (CTX.tab||'inicio')), { contato: CTX.contato });
  // O avatar abre o menu da conta (Minha conta, Treinamentos, Sair).
  CTX.root.querySelector('#cli-conta').onclick = abrirConta;

  // Retrair/expandir a sidebar (desktop) e lembrar a preferência.
  CTX.root.querySelector('#cli-toggle').onclick = () => {
    const cli = CTX.root.querySelector('.cli');
    const on = cli.dataset.collapsed !== 'true';
    cli.dataset.collapsed = on ? 'true' : 'false';
    localStorage.setItem('cli_side_collapsed', on ? '1' : '0');
  };

  // Navegação: sidebar (desktop) e barra inferior (mobile) compartilham data-tab.
  CTX.root.querySelectorAll('[data-tab]').forEach(b => b.onclick = () => {
    const t = b.dataset.tab;
    if(t==='nova') showNovaSolicitacao();
    else if(t==='dashboard') showDashboard();
    else if(t==='solicitacoes') showSolicitacoes();
    else if(t==='tomadores') showTomadores();
    else showMinhaConta();
  });
  // Mede a altura do cabeçalho fixo (faixa preta) para o filtro de solicitações
  // grudar logo abaixo dele.
  requestAnimationFrame(() => {
    const top = CTX.root.querySelector('.cli-top'), cli = CTX.root.querySelector('.cli');
    if(top && cli) cli.style.setProperty('--cli-top-h', top.offsetHeight + 'px');
  });
}
// Marca a aba ativa (em ambos os menus) e atualiza o título do cabeçalho.
function setActiveTab(tab){
  CTX.tab = tab;
  CTX.root.querySelectorAll('[data-tab]').forEach(b =>
    b.classList.toggle('active', b.dataset.tab===tab));
  setHeader(TAB_TITLE[tab] || '');
}
// Atualiza o título exibido no cabeçalho (desktop). Usado por subtelas.
function setHeader(title){
  const h = CTX.root.querySelector('#cli-title');
  if(h) h.textContent = title;
}
// Atualiza o contador do módulo "Solicitações" nos menus (item 6): UM ÚNICO
// número = total de solicitações que precisam de atenção (em aberto). Fica
// vermelho quando há ressalva (pendência do cliente), senão âmbar.
function updateNavBadges(aAtender, comRessalva){
  const total = aAtender + comRessalva;
  const alerta = comRessalva > 0;
  const side = CTX.root.querySelector('#sb-side');
  if(side){
    side.textContent = total>0 ? `(${total})` : '';
    side.className = 's-badges ' + (alerta ? 'nb-alert' : 'nb-pend');
    side.hidden = total===0;
  }
  const nav = CTX.root.querySelector('#sb-nav');
  if(nav){
    nav.textContent = total>0 ? String(total) : '';
    nav.className = 'nb-bubble ' + (alerta ? 'alert' : 'pend');
    nav.hidden = total===0;
  }
}
const view = () => CTX.root.querySelector('#cli-view');

// ---- DASHBOARD --------------------------------------------------------------
async function showDashboard(){
  setActiveTab('dashboard');
  view().innerHTML = `<div class="cli-body"><div class="spinner" style="margin:60px auto"></div></div>`;
  const solics = await api.listSolicitacoesCliente(CTX.cliente.id);

  // Notas com ressalva (faltando número de pedido obrigatório) — card de alerta.
  const pendentes = solics.filter(temRessalva);
  const aAtender = solics.filter(s => s.status==='solicitada' && !temRessalva(s)).length;
  updateNavBadges(aAtender, pendentes.length);

  const primeiro = CTX.profile.nome ? CTX.profile.nome.split(' ')[0] : '';
  view().innerHTML = `
    <div class="cli-body">
      <div class="cli-brandline">
        <img class="cli-brandline-logo" src="assets/logo-mark.png" alt="Maradel">
        <div class="cli-brandline-tx">
          <div class="prod">Emissor de Notas <span>· Grupo Maradel</span></div>
          <div class="cli-emp">${esc(CTX.cliente.razao_social)}</div>
        </div>
      </div>
      <div class="cli-hello">Olá${primeiro?', '+esc(primeiro):''} 👋</div>

      ${pendentes.length ? `
      <div class="card alert-card" id="cli-pend" role="button" tabindex="0">
        <span class="ic">${ICON.alert}</span>
        <div class="tx">
          <div class="t">${pendentes.length===1
            ? 'Você tem 1 nota aguardando número de pedido'
            : `Você tem ${pendentes.length} notas aguardando número de pedido`}</div>
          <div class="s">Toque para informar o número e liberar a emissão.</div>
        </div>
        <span class="go">${ICON.chevR}</span>
      </div>` : ''}

      <div style="display:flex;align-items:center;justify-content:space-between;margin:6px 0 4px">
        <span class="section-title">Últimas solicitações</span>
      </div>
      ${solics.length ? `<div class="qlist">${QHEAD}${solics.slice(0,5).map(rowQueue).join('')}</div>`
        : emptyState('file', 'Sua primeira nota começa aqui',
            'Você ainda não tem solicitações. Crie uma e a Maradel cuida da emissão.')}
    </div>`;

  view().querySelectorAll('[data-solic]').forEach(r =>
    r.onclick = () => showSolicitacao(r.dataset.solic));

  // Card de ressalva (item 4): com 1 nota abre direto; com várias, vai à lista.
  const pend = view().querySelector('#cli-pend');
  if(pend) pend.onclick = () =>
    pendentes.length===1 ? showSolicitacao(pendentes[0].id) : showSolicitacoes();
}

// Desenha o gráfico de evolução (SVG area) a partir dos meses informados.
function renderChart(meses, porMes){
  if(meses.length < 2){
    return `<div style="height:118px;display:flex;align-items:center;justify-content:center;color:var(--mist);font-size:13px;margin-top:14px">Gráfico aparece quando houver 2+ meses emitidos</div>`;
  }
  const vals = meses.map(m => porMes[m]);
  const max = Math.max(...vals), min = Math.min(...vals);
  const W=320, H=100, pad=10;
  const x = i => pad + i*((W-2*pad)/(meses.length-1));
  const y = v => max===min ? H/2 : 100 - ((v-min)/(max-min))*78 - 8;
  const pts = meses.map((m,i)=>`${x(i)},${y(porMes[m])}`);
  const line = 'M'+pts.join(' L');
  const area = `${line} L${x(meses.length-1)},100 L${x(0)},100 Z`;
  const labels = meses.map((m,i)=>{
    const nome = fmtCompetencia(m).split('/')[0];
    const last = i===meses.length-1;
    return `<span style="font-size:11px;font-weight:${last?700:500};color:${last?'var(--grafite)':'var(--mist)'}">${nome}</span>`;
  }).join('');
  return `
    <svg width="100%" height="118" viewBox="0 0 320 118" preserveAspectRatio="none" style="display:block;margin-top:14px">
      <line x1="0" y1="30" x2="320" y2="30" stroke="rgba(57,57,59,.06)"/>
      <line x1="0" y1="65" x2="320" y2="65" stroke="rgba(57,57,59,.06)"/>
      <path d="${area}" fill="#DB8438" fill-opacity="0.10"/>
      <path d="${line}" fill="none" stroke="#DB8438" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
      <circle cx="${x(meses.length-1)}" cy="${y(porMes[meses[meses.length-1]])}" r="4.5" fill="#DB8438" stroke="#fff" stroke-width="2"/>
    </svg>
    <div style="display:flex;justify-content:space-between;margin-top:8px;padding:0 4px">${labels}</div>`;
}

// Linha de solicitação na lista do dashboard.
// Indica ressalva quando o tomador exige número de pedido e ele está em branco.
function temRessalva(s){
  return !!s.tomador?.exige_numero_pedido && !String(s.numero_pedido||'').trim() && s.status!=='emitida' && s.status!=='cancelada';
}
// Status como o CLIENTE vê: o estado interno "aguardando conferência" não
// vaza — para o cliente é apenas "Em emissão" (em andamento na Maradel).
function statusCliente(st){ return st==='aguardando_conferencia' ? 'em_emissao' : st; }

// Card "Precisa de ajuda?" — compacto e discreto (item 5): ícone pequeno, nome
// e links de WhatsApp/e-mail em linha. Nada de ícone grande.
function ajudaCard(cfg){
  if(!cfg || (!cfg.whatsapp && !cfg.email)) return '';
  const nome = cfg.nome || 'a Maradel';
  const wpp = cfg.whatsapp ? `https://wa.me/${String(cfg.whatsapp).replace(/\D/g,'')}` : '';
  return `
    <div class="help-card">
      <span class="help-ic">${ICON.help}</span>
      <span class="help-tx">Precisa de ajuda? Fale com <strong>${esc(nome)}</strong></span>
      <span class="help-links">
        ${wpp?`<a class="help-ico-link" href="${esc(wpp)}" target="_blank" rel="noopener" title="WhatsApp" aria-label="WhatsApp">${ICON.whatsapp}</a>`:''}
        ${cfg.email?`<a class="help-ico-link" href="mailto:${esc(cfg.email)}" title="E-mail" aria-label="E-mail">${ICON.mail}</a>`:''}
      </span>
    </div>`;
}

// Data de atendimento (item 1): SÓ existe quando a nota está emitida; enquanto
// não, retorna '' (exibida de forma discreta). Nunca pode ser anterior à data
// da solicitação — se a emissão vier antes (dado inconsistente), usa a data da
// solicitação como piso. Comparação por data ISO (YYYY-MM-DD), sem fuso.
function dataAtendimento(s){
  const nota = Array.isArray(s.nota) ? s.nota[0] : s.nota;
  if(s.status!=='emitida' || !nota?.data_emissao) return '';
  const sol = String(s.created_at||'').slice(0,10);
  const at  = (sol && nota.data_emissao < sol) ? sol : nota.data_emissao;
  return fmtDate(at);
}
// Cabeçalho da tabela de solicitações (visível no desktop; some no mobile).
const QHEAD = `<div class="qhead"><span>Tomador</span><span>Solicitada</span><span>Atendida</span><span class="r">Valor / Status</span></div>`;
// Uma linha da tabela de solicitações. Mais novo em cima (a lista já vem
// ordenada desc.). Mostra data da solicitação e, quando emitida, a de atendimento.
// Status em UMA única tag (item 2), sem empilhar.
function rowQueue(s){
  const canceled = s.status==='cancelada';
  const serv = (s.descricao||'').slice(0,40);
  const dSol = fmtDate(s.created_at), dAt = dataAtendimento(s);
  const atendCol = dAt ? dAt : '<span style="color:var(--mist)">—</span>';
  return `
    <div class="qrow" data-solic="${s.id}">
      <div class="q-main">
        <div class="nome">${esc(s.tomador?.nome||'Tomador')}</div>
        <div class="meta">${esc(serv)}${(s.descricao||'').length>40?'…':''}<span class="q-dates"> · ${dSol}${dAt?' → '+dAt:''}</span></div>
      </div>
      <div class="q-date">${dSol}</div>
      <div class="q-date">${atendCol}</div>
      <div class="q-end">
        <div class="q-val" style="${canceled?'color:var(--mist);text-decoration:line-through':''}">${brl(s.valor)}</div>
        <div class="q-st">${statusTag(statusCliente(s.status), temRessalva(s))}</div>
      </div>
    </div>`;
}

// Grupos de filtro rápido (item 7). "Em andamento" = tudo que não foi emitido
// nem cancelado (inclui o estado interno de conferência, que o cliente vê como
// em andamento).
const SOLIC_FILTROS = {
  todas:      { label:'Todas',        teste: () => true },
  andamento:  { label:'Em andamento', teste: s => s.status!=='emitida' && s.status!=='cancelada' },
  atendidas:  { label:'Atendidas',    teste: s => s.status==='emitida' },
  canceladas: { label:'Canceladas',   teste: s => s.status==='cancelada' },
};
let solicFiltro = 'todas';

// ---- SOLICITAÇÕES (lista completa) -----------------------------------------
async function showSolicitacoes(){
  setActiveTab('solicitacoes');
  view().innerHTML = `<div class="cli-body"><div class="spinner" style="margin:60px auto"></div></div>`;
  const solics = await api.listSolicitacoesCliente(CTX.cliente.id);
  // Contador único do menu (item 6): solicitações que precisam de atenção.
  const comRessalva = solics.filter(temRessalva).length;
  const aAtender = solics.filter(s => s.status==='solicitada' && !temRessalva(s)).length;
  updateNavBadges(aAtender, comRessalva);

  // Botões de filtro rápido. Renderiza a lista filtrada (sempre mais novo em cima).
  const renderLista = () => {
    const f = SOLIC_FILTROS[solicFiltro] || SOLIC_FILTROS.todas;
    const lista = solics.filter(f.teste);
    const box = view().querySelector('#solic-lista');
    box.innerHTML = lista.length
      ? `<div class="qlist">${QHEAD}${lista.map(rowQueue).join('')}</div>`
      : `<div class="empty-mini">Nada em "${f.label}".</div>`;
    box.querySelectorAll('[data-solic]').forEach(r => r.onclick = () => showSolicitacao(r.dataset.solic));
  };

  view().innerHTML = `
    <div class="subhead" style="position:static"><h2 style="margin-left:4px">Minhas solicitações</h2></div>
    <div class="cli-body">
      ${solics.length ? `
        <div class="cli-filtro-bar">
          <button class="cli-filtro" id="sf-btn">
            <span class="ic">${ICON.list}</span>
            <span class="tx">Mostrando: <strong id="sf-lbl">${SOLIC_FILTROS[solicFiltro].label}</strong></span>
            <span class="cv">${ICON.chevD}</span>
          </button>
        </div>
        <div id="solic-lista"></div>`
        : emptyState('list','Nenhuma solicitação ainda','Toque em "Nova solicitação" e a Maradel cuida da emissão.')}
    </div>`;

  if(solics.length){
    renderLista();
    // Cascata: abre a folha com as opções (Todas vem marcada por padrão).
    view().querySelector('#sf-btn').onclick = () => abrirFiltroSolic(() => {
      view().querySelector('#sf-lbl').textContent = SOLIC_FILTROS[solicFiltro].label;
      renderLista();
    });
  }
}

// Folha (cascata) para escolher o filtro das solicitações — sempre uma linha.
function abrirFiltroSolic(onPick){
  const itens = Object.entries(SOLIC_FILTROS).map(([k,v]) =>
    `<button class="sheet-item" data-f="${k}">
       <span class="sheet-tx"><span class="t">${v.label}</span></span>
       ${k===solicFiltro?`<span class="sheet-ck">${ICON.check}</span>`:''}
     </button>`).join('');
  const ov = document.createElement('div');
  ov.className = 'sheet-overlay';
  ov.innerHTML = `<div class="sheet"><div class="sheet-grip"></div>
    <div class="sheet-title">Mostrar solicitações</div>${itens}</div>`;
  ov.addEventListener('click', e => { if(e.target === ov) ov.remove(); });
  document.body.appendChild(ov);
  ov.querySelectorAll('[data-f]').forEach(b => b.onclick = () => {
    solicFiltro = b.dataset.f; ov.remove(); onPick();
  });
}

// ---- NOVA SOLICITAÇÃO -------------------------------------------------------
async function showNovaSolicitacao(){
  setActiveTab('nova'); setHeader('Nova solicitação');
  const tomadores = await api.listTomadores(CTX.cliente.id);

  // Sem tomador cadastrado: oferece atalho para cadastrar ali mesmo (item A).
  if(!tomadores.length){
    view().innerHTML = `
      <div class="subhead"><button class="back" id="ns-back">${ICON.back}</button><h2>Nova solicitação</h2></div>
      <div class="cli-body">
        ${emptyState('users','Cadastre um tomador primeiro','Toda nota precisa de um tomador (quem recebe). Cadastre o primeiro — leva 1 minuto.')}
        <button class="btn btn-primary btn-block" id="ns-novo-tom" style="max-width:340px;margin:0 auto">${ICON.plus}<span>Cadastrar tomador agora</span></button>
      </div>`;
    view().querySelector('#ns-back').onclick = showDashboard;
    // Após cadastrar, volta direto para a nova solicitação.
    view().querySelector('#ns-novo-tom').onclick = () => tomadorForm(null, showNovaSolicitacao);
    return;
  }

  const ultimoId = tomadores[0]?.id || '';
  const exigeInicial = tomadores[0]?.exige_numero_pedido;
  view().innerHTML = `
    <div class="subhead"><button class="back" id="ns-back">${ICON.back}</button><h2>Nova solicitação</h2></div>
    <div class="cli-body" style="padding-bottom:120px">
      <div class="field">
        <label>Tomador</label>
        <select class="select" id="ns-tomador">
          ${tomadores.map((t,i)=>`<option value="${t.id}" data-exige="${t.exige_numero_pedido?1:0}" ${t.id===ultimoId?'selected':''}>${esc(t.nome)}${t.doc?' — '+esc(t.doc):''}${i===0?' · último usado':''}</option>`).join('')}
        </select>
        <button class="link-add" id="ns-add-tom" type="button">${ICON.plus}<span>Cadastrar novo tomador</span></button>
      </div>
      <div class="field"><label>Descrição do serviço</label><textarea class="textarea" id="ns-desc" placeholder="Descreva o serviço prestado…"></textarea></div>
      <div class="form-grid">
        <div class="field"><label>Valor</label><input class="input input-lg" id="ns-valor" inputmode="numeric" placeholder="R$ 0,00"></div>
        <div class="field"><label>Competência</label><input class="input" id="ns-comp" type="month" value="${currentCompetencia()}"></div>
      </div>
      <div class="field">
        <label id="ns-ped-label">Número de pedido${exigeInicial?' <span class="req">obrigatório</span>':' <span class="opt">opcional</span>'}</label>
        <input class="input" id="ns-pedido" placeholder="Ex.: PO-2026-0042">
        <div id="ns-ped-aviso" class="aviso-ressalva ${exigeInicial?'':'hidden'}">${ICON.alert}<span>Este tomador exige número de pedido. Sem ele, a solicitação segue <strong>com ressalva</strong> e a Maradel só emite após o preenchimento.</span></div>
      </div>
      <div class="field">
        <label>Recorrência</label>
        <div class="recor-row">
          ${toggle('ns-recor', 'Esta é uma nota recorrente', false)}
        </div>
        <div id="ns-recor-meses" class="hidden" style="margin-top:10px">
          <label style="font-size:11px">Por quantos meses?</label>
          <input class="input" id="ns-meses" type="number" min="1" max="60" placeholder="Ex.: 12" style="max-width:160px">
          <div style="font-size:12px;color:var(--mist);margin-top:6px">Apenas informativo — você cria cada solicitação normalmente.</div>
        </div>
      </div>
      <div class="card" style="padding:13px 14px;display:flex;gap:9px;align-items:flex-start;margin-top:4px">
        <span style="color:var(--taupe);width:17px;flex:none">${ICON.info}</span>
        <span style="font-size:12.5px;color:var(--taupe);line-height:1.5">A nota é emitida pela Maradel. Você é avisado assim que ela sair.</span>
      </div>
    </div>
    <div class="cli-footbar">
      <button class="btn btn-primary btn-block" id="ns-send">Enviar solicitação</button>
    </div>`;
  maskMoneyInput(view().querySelector('#ns-valor'));
  view().querySelector('#ns-back').onclick = showDashboard;
  view().querySelector('#ns-add-tom').onclick = () => tomadorForm(null, showNovaSolicitacao);
  // Atualiza o aviso de "obrigatório" conforme o tomador escolhido.
  const sel = view().querySelector('#ns-tomador');
  sel.onchange = () => {
    const exige = sel.selectedOptions[0]?.dataset.exige === '1';
    view().querySelector('#ns-ped-label').innerHTML = `Número de pedido${exige?' <span class="req">obrigatório</span>':' <span class="opt">opcional</span>'}`;
    view().querySelector('#ns-ped-aviso').classList.toggle('hidden', !exige);
  };
  // Toggle de recorrência mostra/esconde o nº de meses.
  bindToggle(view(), 'ns-recor', on => view().querySelector('#ns-recor-meses').classList.toggle('hidden', !on));
  view().querySelector('#ns-send').onclick = enviarSolicitacao;
}

async function enviarSolicitacao(){
  const sel = view().querySelector('#ns-tomador');
  const tomador_id = sel?.value;
  const descricao  = view().querySelector('#ns-desc').value.trim();
  const valor      = parseBRL(view().querySelector('#ns-valor').value);
  const competencia= view().querySelector('#ns-comp').value;
  const numero_pedido = view().querySelector('#ns-pedido').value.trim() || null;
  const recorrente = isToggleOn(view(), 'ns-recor');
  const recorrencia_meses = recorrente ? (Number(view().querySelector('#ns-meses').value) || null) : null;
  if(!tomador_id) return toast('Cadastre e selecione um tomador');
  if(!descricao)  return toast('Informe a descrição do serviço');
  if(!valor)      return toast('Informe o valor');
  const btn = view().querySelector('#ns-send'); btn.disabled = true; btn.textContent = 'Enviando…';
  try{
    await api.criarSolicitacao({ cliente_id:CTX.cliente.id, tomador_id, descricao, valor, competencia,
      numero_pedido, recorrente, recorrencia_meses });
    const exige = sel.selectedOptions[0]?.dataset.exige === '1';
    showConfirmacao(exige && !numero_pedido);
  }catch(e){ toast('Erro: '+e.message); btn.disabled=false; btn.textContent='Enviar solicitação'; }
}

function showConfirmacao(comRessalva){
  view().innerHTML = `
    <div class="cli-body" style="min-height:70vh;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding-top:40px">
      <div style="width:88px;height:88px;border-radius:50%;background:var(--terracota-subtle);display:flex;align-items:center;justify-content:center;margin-bottom:28px">
        <div style="width:60px;height:60px;border-radius:50%;background:var(--terracota);color:#fff;display:flex;align-items:center;justify-content:center"><span style="width:32px;height:32px">${ICON.check}</span></div>
      </div>
      <h3 style="font-size:24px;font-weight:600">Solicitação recebida</h3>
      <p class="muted" style="font-size:15px;margin-top:10px;line-height:1.6;max-width:300px">Avisaremos no seu e-mail e aqui no app assim que a nota for emitida.</p>
      ${comRessalva ? `<div class="aviso-ressalva" style="max-width:320px;margin-top:18px;text-align:left">${ICON.alert}<span>Como faltou o <strong>número de pedido</strong> exigido por este tomador, a solicitação segue <strong>com ressalva</strong>. A Maradel só emite após o número ser informado.</span></div>` : ''}
      <button class="btn btn-primary btn-block" id="cf-home" style="margin-top:30px;max-width:300px">Voltar ao início</button>
    </div>`;
  view().querySelector('#cf-home').onclick = showDashboard;
}

// ---- DETALHE DA SOLICITAÇÃO / NOTA -----------------------------------------
async function showSolicitacao(id){
  setHeader('Solicitação');
  view().innerHTML = `<div class="cli-body"><div class="spinner" style="margin:60px auto"></div></div>`;
  const s = await api.getSolicitacao(id);
  const nota = Array.isArray(s.nota) ? s.nota[0] : s.nota;
  const emitida = s.status==='emitida' && nota;

  const ressalva = temRessalva(s);
  // Com ressalva e ainda editável: o cliente pode informar o número de pedido
  // aqui mesmo e reenviar, saindo da ressalva (item 4). Usa o endpoint existente
  // api.setNumeroPedido — nenhuma alteração de backend.
  const podeResolverRessalva = ressalva && s.status==='solicitada';
  view().innerHTML = `
    <div class="subhead"><button class="back" id="sd-back">${ICON.back}</button><h2>${emitida?'Nota emitida':'Solicitação'}</h2></div>
    <div class="cli-body">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:18px;gap:8px;flex-wrap:wrap">
        <div>
          <div class="fat-label">${emitida?'NFS-e nº':'Solicitação'}</div>
          <div style="font-size:24px;font-weight:700;color:var(--terracota);margin-top:3px">${emitida?esc(nota.numero||'—'):'#'+s.id.slice(0,8)}</div>
        </div>
        <div style="display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end">${statusTag(statusCliente(s.status), ressalva)}</div>
      </div>
      ${ressalva?`<div class="aviso-ressalva" style="margin-bottom:16px">${ICON.alert}<span>Falta o <strong>número de pedido</strong> exigido por este tomador. A Maradel só emite após o preenchimento.</span></div>`:''}
      ${podeResolverRessalva?`
      <div class="card" style="padding:16px;margin-bottom:16px">
        <div class="field" style="margin:0">
          <label>Número de pedido <span class="req">obrigatório</span></label>
          <input class="input" id="sd-pedido" placeholder="Ex.: PO-2026-0042">
        </div>
        <button class="btn btn-primary btn-block" id="sd-save-pedido" style="margin-top:12px">Salvar e reenviar</button>
      </div>`:''}
      <div class="card">
        <div class="kv"><span class="k">Tomador</span><span class="v">${esc(s.tomador?.nome||'—')}</span></div>
        <div class="kv"><span class="k">Documento</span><span class="v">${esc(s.tomador?.doc||'—')}</span></div>
        <div class="kv"><span class="k">Serviço</span><span class="v">${esc(s.descricao)}</span></div>
        ${s.numero_pedido?`<div class="kv"><span class="k">Nº de pedido</span><span class="v">${esc(s.numero_pedido)}</span></div>`:''}
        ${s.recorrente?`<div class="kv"><span class="k">Recorrência</span><span class="v">${s.recorrencia_meses?esc(s.recorrencia_meses)+' meses':'Sim'}</span></div>`:''}
        <div class="kv"><span class="k">Competência</span><span class="v">${fmtCompetencia(s.competencia)}</span></div>
        ${emitida?`<div class="kv"><span class="k">Emissão</span><span class="v">${dataAtendimento(s)}</span></div>`:''}
        <div class="kv" style="background:#FAF8F6"><span class="k" style="font-weight:600;color:var(--grafite)">Valor</span><span class="v" style="font-size:18px;color:var(--terracota)">${brl(s.valor)}</span></div>
      </div>
      ${emitida ? `
        ${linkPublicoCard(nota.public_token)}
        <div class="nota-acoes">
          <button class="btn btn-outline btn-sm" data-dl="pdf" ${nota.pdf_url?'':'disabled'}>${ICON.download}<span>PDF</span></button>
          <button class="btn btn-outline btn-sm" data-dl="xml" ${nota.xml_url?'':'disabled'}>${ICON.download}<span>XML</span></button>
          <button class="btn btn-outline btn-sm" id="sd-email">${ICON.mail}<span>E-mail</span></button>
          <button class="btn btn-outline btn-sm" id="sd-whats">${ICON.whatsapp}<span>WhatsApp</span></button>
        </div>` : `
        <div class="card" style="padding:14px 16px;margin-top:18px;display:flex;gap:9px;align-items:flex-start">
          <span style="color:var(--taupe);width:17px;flex:none">${ICON.info}</span>
          <span style="font-size:13px;color:var(--taupe);line-height:1.5">Assim que a Maradel emitir, o link da nota e os botões para baixar o PDF e o XML aparecem aqui.</span>
        </div>
        ${(s.status==='cancelada' && s.motivo_cancelamento)?`<div class="aviso-ressalva" style="margin-top:16px">${ICON.info}<span>Cancelada pelo cliente. Motivo: <strong>${esc(s.motivo_cancelamento)}</strong></span></div>`:''}
        ${s.status==='solicitada'?`
        <div style="display:flex;justify-content:center;margin-top:18px">
          <button class="btn btn-outline btn-sm" id="sd-editar">${ICON.edit}<span>Editar solicitação</span></button>
        </div>
        <button class="link-danger" id="sd-cancel" style="display:block;margin:14px auto 0">Cancelar solicitação</button>`:''}`}
    </div>`;
  view().querySelector('#sd-back').onclick = showDashboard;
  // Resolver ressalva: grava o número de pedido e recarrega (item 4).
  const sp = view().querySelector('#sd-save-pedido');
  if(sp) sp.onclick = async () => {
    const ped = view().querySelector('#sd-pedido').value.trim();
    if(!ped) return toast('Informe o número de pedido');
    sp.disabled = true; sp.textContent = 'Salvando…';
    try{
      await api.setNumeroPedido(id, ped);
      toast('Número enviado! A nota saiu da ressalva.');
      showSolicitacao(id);
    }catch(e){ toast('Erro: '+e.message); sp.disabled=false; sp.textContent='Salvar e reenviar'; }
  };
  view().querySelectorAll('[data-dl]').forEach(b => b.onclick = async () => {
    const path = b.dataset.dl==='pdf' ? nota.pdf_url : nota.xml_url;
    const url = await api.urlAssinada(path);
    if(url) window.open(url,'_blank'); else toast('Arquivo indisponível');
  });
  if(emitida) bindLinkPublico(view(), nota.public_token, {
    onRegenerar: () => api.regenerarTokenNota(nota.id),
    onRefresh: () => showSolicitacao(id),
  });
  // Enviar por e-mail (texto padrão + link público + mailto).
  const be = view().querySelector('#sd-email');
  if(be) be.onclick = () => openEnvioEmail({
    numero: nota.numero,
    empresa: CTX.cliente.razao_social,
    dataEmissao: fmtDate(nota.data_emissao),
    assinatura: CTX.profile.nome || CTX.cliente.razao_social,
    token: nota.public_token,
    tomadorEmail: s.tomador?.email || '',
    onEnviado: (canal, destinatario) => api.registrarEnvio({ nota_id: nota.id, canal, destinatario }).catch(()=>{}),
  });
  // Enviar por WhatsApp (número e/ou grupo do cliente).
  const bw = view().querySelector('#sd-whats');
  if(bw) bw.onclick = () => openEnvioWhatsApp({
    numero: nota.numero,
    empresa: CTX.cliente.razao_social,
    dataEmissao: fmtDate(nota.data_emissao),
    assinatura: CTX.profile.nome || CTX.cliente.razao_social,
    token: nota.public_token,
    clienteTelefone: CTX.cliente.telefone || '',
    clienteGrupo: CTX.cliente.whatsapp_grupo || '',
    onEnviado: (canal, destinatario) => api.registrarEnvio({ nota_id: nota.id, canal, destinatario }).catch(()=>{}),
  });
  // Editar a solicitação (enquanto não atendida) — abre o formulário prefilled.
  const ed = view().querySelector('#sd-editar');
  if(ed) ed.onclick = () => showEditarSolicitacao(s);
  // Cancelar: agora pede confirmação e motivo (ação irreversível).
  const c = view().querySelector('#sd-cancel');
  if(c) c.onclick = () => confirmarCancelamento(id, () => showDashboard());
}

// Modal de confirmação de cancelamento com motivo (texto livre). O cancelamento
// é irreversível, por isso exige confirmação explícita.
function confirmarCancelamento(id, onDone){
  const m = openModal(`
    <div class="modal-head"><h3>Cancelar solicitação</h3>
      <button class="modal-x" id="cc-x">${ICON.x}</button></div>
    <p class="modal-sub">Esta ação <strong>não poderá ser desfeita</strong>. Conte rapidamente o motivo do cancelamento.</p>
    <div class="field" style="margin-top:14px"><label>Motivo do cancelamento</label>
      <textarea class="textarea" id="cc-motivo" placeholder="Ex.: valor incorreto, serviço não realizado…"></textarea></div>
    <div class="modal-actions">
      <button class="btn btn-primary btn-block" id="cc-ok" style="background:var(--st-canc-fg);box-shadow:none">Confirmar cancelamento</button>
      <button class="btn btn-outline btn-block" id="cc-no">Voltar</button>
    </div>`);
  m.querySelector('#cc-x').onclick = closeModal;
  m.querySelector('#cc-no').onclick = closeModal;
  m.querySelector('#cc-ok').onclick = async () => {
    const motivo = m.querySelector('#cc-motivo').value.trim();
    if(!motivo) return toast('Informe o motivo do cancelamento');
    const btn = m.querySelector('#cc-ok'); btn.disabled=true; btn.textContent='Cancelando…';
    try{
      await api.cancelarSolicitacao(id, motivo);
      closeModal(); toast('Solicitação cancelada'); onDone?.();
    }catch(e){ toast('Erro: '+e.message); btn.disabled=false; btn.textContent='Confirmar cancelamento'; }
  };
}

// ---- EDITAR SOLICITAÇÃO (enquanto não atendida) ----------------------------
async function showEditarSolicitacao(s){
  setHeader('Editar solicitação');
  const tomadores = await api.listTomadores(CTX.cliente.id);
  const exigeDe = id => tomadores.find(t=>t.id===id)?.exige_numero_pedido;
  view().innerHTML = `
    <div class="subhead"><button class="back" id="es-back">${ICON.back}</button><h2>Editar solicitação</h2></div>
    <div class="cli-body">
      <div class="field"><label>Tomador</label>
        <select class="select" id="es-tomador">
          ${tomadores.map(t=>`<option value="${t.id}" data-exige="${t.exige_numero_pedido?1:0}" ${t.id===s.tomador_id?'selected':''}>${esc(t.nome)}${t.doc?' — '+esc(t.doc):''}</option>`).join('')}
        </select>
      </div>
      <div class="field"><label>Descrição do serviço</label><textarea class="textarea" id="es-desc">${esc(s.descricao)}</textarea></div>
      <div class="form-grid">
        <div class="field"><label>Valor</label><input class="input input-lg" id="es-valor" inputmode="numeric" value="${brl(s.valor)}"></div>
        <div class="field"><label>Competência</label><input class="input" id="es-comp" type="month" value="${esc(s.competencia)}"></div>
      </div>
      <div class="field">
        <label id="es-ped-label">Número de pedido${exigeDe(s.tomador_id)?' <span class="req">obrigatório</span>':' <span class="opt">opcional</span>'}</label>
        <input class="input" id="es-pedido" value="${esc(s.numero_pedido||'')}" placeholder="Ex.: PO-2026-0042">
      </div>
      <div class="field">
        <label>Recorrência</label>
        <div class="recor-row">${toggle('es-recor', 'Esta é uma nota recorrente', !!s.recorrente)}</div>
        <div id="es-recor-meses" class="${s.recorrente?'':'hidden'}" style="margin-top:10px">
          <label style="font-size:11px">Por quantos meses?</label>
          <input class="input" id="es-meses" type="number" min="1" max="60" value="${esc(s.recorrencia_meses||'')}" placeholder="Ex.: 12" style="max-width:160px">
        </div>
      </div>
      <button class="btn btn-primary btn-block" id="es-save" style="margin-top:6px">Salvar alterações</button>
    </div>`;
  maskMoneyInput(view().querySelector('#es-valor'));
  view().querySelector('#es-back').onclick = () => showSolicitacao(s.id);
  const sel = view().querySelector('#es-tomador');
  sel.onchange = () => {
    const exige = sel.selectedOptions[0]?.dataset.exige === '1';
    view().querySelector('#es-ped-label').innerHTML = `Número de pedido${exige?' <span class="req">obrigatório</span>':' <span class="opt">opcional</span>'}`;
  };
  bindToggle(view(), 'es-recor', on => view().querySelector('#es-recor-meses').classList.toggle('hidden', !on));
  view().querySelector('#es-save').onclick = async () => {
    const tomador_id = sel.value;
    const descricao  = view().querySelector('#es-desc').value.trim();
    const valor      = parseBRL(view().querySelector('#es-valor').value);
    const competencia= view().querySelector('#es-comp').value;
    const numero_pedido = view().querySelector('#es-pedido').value.trim() || null;
    const recorrente = isToggleOn(view(), 'es-recor');
    const recorrencia_meses = recorrente ? (Number(view().querySelector('#es-meses').value) || null) : null;
    if(!descricao) return toast('Informe a descrição do serviço');
    if(!valor)     return toast('Informe o valor');
    const btn = view().querySelector('#es-save'); btn.disabled=true; btn.textContent='Salvando…';
    try{
      await api.atualizarSolicitacao(s.id, { tomador_id, descricao, valor, competencia, numero_pedido, recorrente, recorrencia_meses });
      toast('Solicitação atualizada'); showSolicitacao(s.id);
    }catch(e){ toast('Erro: '+e.message); btn.disabled=false; btn.textContent='Salvar alterações'; }
  };
}

// ---- TOMADORES --------------------------------------------------------------
async function showTomadores(){
  setActiveTab('tomadores');
  view().innerHTML = `<div class="cli-body"><div class="spinner" style="margin:60px auto"></div></div>`;
  const tomadores = await api.listTomadores(CTX.cliente.id);
  // Renderiza a lista (reusada na busca). Cada linha abre o cadastro completo.
  const renderLista = lista => lista.length ? `<div class="solic-list">${lista.map(t=>`
        <div class="tom-row" data-tom="${t.id}">
          <div class="ava">${initials(t.nome)}</div>
          <div style="flex:1;min-width:0">
            <div class="nome">${esc(t.nome)}</div>
            <div class="meta">${esc(t.doc)}${t.cidade?' · '+esc(t.cidade):''}${t.uf?', '+esc(t.uf):''}${t.exige_numero_pedido?' · <span style="color:var(--terracota-dark)">exige nº pedido</span>':''}</div>
          </div>
          <span class="tom-go">${ICON.chevR}</span>
        </div>`).join('')}</div>`
    : `<div class="empty-mini">Nenhum tomador encontrado.</div>`;
  view().innerHTML = `
    <div class="subhead" style="position:static">
      <h2 style="margin-left:4px">Cadastro de Tomadores</h2>
      <button class="btn-subtle" id="tm-novo" title="Cadastrar novo tomador">${ICON.plus}<span>Novo tomador</span></button>
    </div>
    <div class="cli-body">
      ${tomadores.length?`<div class="filter-box">${ICON.search}<input id="tm-busca" placeholder="Buscar por nome, CNPJ/CPF ou cidade…"></div>`:''}
      <div id="tm-list">${tomadores.length?renderLista(tomadores)
        :emptyState('users','Nenhum tomador ainda','Cadastre quem recebe suas notas. Depois é só selecionar na nova solicitação.')}</div>
    </div>`;
  view().querySelector('#tm-novo').onclick = () => tomadorForm(null);
  // Clique numa linha → abre o cadastro completo do tomador (ver/editar).
  const bindRows = () => view().querySelectorAll('[data-tom]').forEach(r =>
    r.onclick = () => { const t = tomadores.find(x=>x.id===r.dataset.tom); if(t) tomadorForm(t); });
  bindRows();
  // Busca/filtro local por nome, documento ou cidade.
  const busca = view().querySelector('#tm-busca');
  if(busca) busca.oninput = () => {
    const b = busca.value.trim().toLowerCase();
    const filtrada = tomadores.filter(t =>
      (t.nome||'').toLowerCase().includes(b) ||
      (t.doc||'').toLowerCase().includes(b) ||
      (t.cidade||'').toLowerCase().includes(b));
    view().querySelector('#tm-list').innerHTML = renderLista(filtrada);
    bindRows();
  };
}

// Formulário de tomador — cria (tomador=null) ou edita (tomador existente).
// O botão "Salvar" fica logo abaixo dos campos (sem barra fixa), para não exigir
// rolagem. onSalvo: callback após salvar (ex.: voltar à nova solicitação).
function tomadorForm(tomador, onSalvo){
  const editando = !!tomador;
  const t = tomador || {};
  setHeader(editando ? 'Editar tomador' : 'Novo tomador');
  const voltar = onSalvo || showTomadores;
  const sel = (v, opt) => v===opt ? 'selected' : '';
  view().innerHTML = `
    <div class="subhead"><button class="back" id="nt-back">${ICON.back}</button><h2>${editando?'Editar tomador':'Novo tomador'}</h2></div>
    <div class="cli-body">
      <div class="field"><label>Tipo</label>
        <select class="select" id="nt-tipo">
          <option value="PJ" ${sel(t.tipo,'PJ')}>Pessoa Jurídica (CNPJ)</option>
          <option value="PF" ${sel(t.tipo,'PF')}>Pessoa Física (CPF)</option>
        </select>
      </div>
      <div class="field"><label>CNPJ / CPF</label><input class="input" id="nt-doc" inputmode="numeric" value="${esc(t.doc||'')}" placeholder="00.000.000/0000-00"></div>
      <div class="field"><label>Razão social / Nome</label><input class="input" id="nt-nome" value="${esc(t.nome||'')}" placeholder="Nome do tomador"></div>
      <div class="field"><label>E-mail <span style="text-transform:none;letter-spacing:0;color:var(--mist)">(opcional)</span></label><input class="input" id="nt-email" type="email" value="${esc(t.email||'')}" placeholder="contato@tomador.com.br"></div>
      <div class="field"><label>Endereço</label><input class="input" id="nt-end" value="${esc(t.endereco||'')}" placeholder="Rua, número, bairro"></div>
      <div class="form-grid form-grid-3">
        <div class="field"><label>Cidade</label><input class="input" id="nt-cid" value="${esc(t.cidade||'')}" placeholder="Cidade"></div>
        <div class="field"><label>UF</label><input class="input" id="nt-uf" maxlength="2" value="${esc(t.uf||'')}" placeholder="SP"></div>
        <div class="field"><label>CEP</label><input class="input" id="nt-cep" value="${esc(t.cep||'')}" placeholder="00000-000"></div>
      </div>
      <div class="field">
        <label>Número de pedido obrigatório?</label>
        ${toggle('nt-exige', 'Exigir número de pedido nas notas deste tomador', !!t.exige_numero_pedido)}
        <div style="font-size:12px;color:var(--mist);margin-top:8px">Se ligado, a solicitação sem número de pedido segue com ressalva e a Maradel só emite após o preenchimento.</div>
      </div>
      <button class="btn btn-primary btn-block" id="nt-save" style="margin-top:6px">${editando?'Salvar alterações':'Salvar tomador'}</button>
    </div>`;
  maskDocInput(view().querySelector('#nt-doc'));
  bindToggle(view(), 'nt-exige');
  view().querySelector('#nt-back').onclick = voltar;
  view().querySelector('#nt-save').onclick = async () => {
    const g = id => view().querySelector(id).value.trim();
    const nome = g('#nt-nome'), doc = g('#nt-doc');
    if(!nome || !doc) return toast('Preencha nome e documento');
    const btn = view().querySelector('#nt-save'); btn.disabled=true; btn.textContent='Salvando…';
    const campos = { tipo:g('#nt-tipo'), doc, nome, email:g('#nt-email')||null,
      endereco:g('#nt-end'), cidade:g('#nt-cid'), uf:g('#nt-uf'), cep:g('#nt-cep'),
      exige_numero_pedido: isToggleOn(view(), 'nt-exige') };
    try{
      if(editando) await api.atualizarTomador(t.id, campos);
      else         await api.criarTomador({ cliente_id:CTX.cliente.id, ...campos });
      toast(editando?'Tomador atualizado':'Tomador cadastrado'); voltar();
    }catch(e){ toast('Erro: '+e.message); btn.disabled=false; btn.textContent=editando?'Salvar alterações':'Salvar tomador'; }
  };
}

// ---- CLIENTE SEM CADASTRO ---------------------------------------------------
// O cliente não se auto-cadastra: o registro é criado pela Maradel (analista).
// Se cair aqui, é porque a conta existe mas ainda não foi vinculada a um cliente.
function renderSemCadastro(){
  CTX.root.innerHTML = `
    <div class="auth-wrap"><div class="auth-card" style="text-align:center">
      <img class="logo" src="assets/logo-horizontal-dark.png" alt="Maradel" style="margin:0 auto 40px;display:block">
      <h1>Conta em configuração</h1>
      <p class="sub">Seu acesso ainda não está vinculado a uma empresa. Fale com a Maradel para concluir seu cadastro.</p>
      <button class="btn btn-outline btn-block" id="sc-sair" style="margin-top:28px">Sair</button>
    </div></div>`;
  document.getElementById('sc-sair').onclick = async () => { await api.signOut(); location.reload(); };
}

// ---- MINHA CONTA -----------------------------------------------------------
// Um único formulário com TODOS os dados (nome, e-mail de acesso, telefone e
// grupo de WhatsApp) e UM botão "Salvar alterações". A senha fica num cartão
// separado (fluxo próprio). Todos os campos são obrigatórios.
function showMinhaConta(){
  setActiveTab('conta');
  view().innerHTML = `
    <div class="subhead" style="position:static"><h2 style="margin-left:4px">Minha conta</h2></div>
    <div class="cli-body" style="padding-bottom:40px">
      <div class="card" style="padding:18px 18px 6px;margin-bottom:18px">
        <div class="cli-hello" style="margin-bottom:2px">Empresa</div>
        <div style="font-size:16px;font-weight:600;margin-bottom:16px">${esc(CTX.cliente.razao_social)}</div>
        <div class="field"><label>Seu nome</label>
          <input class="input" id="mc-nome" value="${esc(CTX.profile.nome||'')}" placeholder="Ex.: João Silva"></div>
        <div class="field"><label>E-mail de acesso</label>
          <input class="input" id="mc-email" type="email" value="${esc(CTX.profile.email||'')}" placeholder="voce@empresa.com.br"></div>
        <div class="field"><label>Telefone (WhatsApp)</label>
          <input class="input" id="mc-tel" inputmode="tel" value="${esc(CTX.cliente.telefone||'')}" placeholder="(11) 99999-8888"></div>
        <div class="field"><label>Link do grupo do WhatsApp</label>
          <input class="input" id="mc-grupo" value="${esc(CTX.cliente.whatsapp_grupo||'')}" placeholder="https://chat.whatsapp.com/..."></div>
        <button class="btn btn-primary btn-block" id="mc-save" style="margin-bottom:18px">Salvar alterações</button>
      </div>
      <div class="card" style="padding:18px 18px 4px">
        <div class="cli-hello" style="margin-bottom:14px">Trocar senha</div>
        <div class="field"><label>Nova senha</label>
          <input class="input" id="mc-s1" type="password" placeholder="Mínimo 6 caracteres" autocomplete="new-password"></div>
        <div class="field"><label>Confirmar senha</label>
          <input class="input" id="mc-s2" type="password" placeholder="Repita a senha" autocomplete="new-password"></div>
        <button class="btn btn-primary btn-block" id="mc-senha-save" style="margin-bottom:18px">Atualizar senha</button>
      </div>
      <button class="link-danger" id="mc-sair" style="display:block;margin:22px auto 0">Sair da conta</button>
    </div>`;

  // Salvar tudo de uma vez (nome, e-mail, telefone e grupo). Todos obrigatórios.
  view().querySelector('#mc-save').onclick = async () => {
    const g = id => view().querySelector(id).value.trim();
    const nome = g('#mc-nome'), email = g('#mc-email'), telefone = g('#mc-tel'), grupo = g('#mc-grupo');
    if(!nome)     return toast('Informe seu nome');
    if(!/^[^@]+@[^@]+\.[^@]+$/.test(email)) return toast('Informe um e-mail válido');
    if(!telefone) return toast('Informe o telefone (WhatsApp)');
    if(!grupo)    return toast('Informe o link do grupo do WhatsApp');
    const btn = view().querySelector('#mc-save'); btn.disabled=true; btn.textContent='Salvando…';
    try{
      // Nome (profile) + contato (cliente) sempre; e-mail só se mudou (dispara confirmação).
      await api.atualizarMeuNome(nome);
      await api.atualizarMeuCliente(CTX.cliente.id, { telefone, whatsapp_grupo: grupo });
      CTX.profile.nome = nome;
      CTX.cliente.telefone = telefone; CTX.cliente.whatsapp_grupo = grupo;
      let avisoEmail = '';
      if(email !== (CTX.profile.email||'')){
        await api.atualizarEmail(email);
        avisoEmail = ' Confirme a troca de e-mail no novo endereço.';
      }
      // Reflete nome/iniciais no cabeçalho e na sidebar na hora.
      const ini = initials(nome || CTX.cliente.razao_social);
      CTX.root.querySelector('#cli-conta').textContent = ini;
      CTX.root.querySelectorAll('.cli-profile .nm, .cli-side-user .nm').forEach(n => n.textContent = nome);
      const avaSide = CTX.root.querySelector('.cli-side-user .ava'); if(avaSide) avaSide.textContent = ini;
      toast('Dados atualizados.'+avisoEmail);
    }catch(err){ toast('Erro: '+err.message); }
    btn.disabled=false; btn.textContent='Salvar alterações';
  };

  // Atualizar senha.
  view().querySelector('#mc-senha-save').onclick = async () => {
    const s1 = view().querySelector('#mc-s1').value, s2 = view().querySelector('#mc-s2').value;
    if(s1.length < 6) return toast('A senha precisa de ao menos 6 caracteres');
    if(s1 !== s2)     return toast('As senhas não coincidem');
    const btn = view().querySelector('#mc-senha-save'); btn.disabled=true; btn.textContent='Salvando…';
    try{ await api.definirSenha(s1); toast('Senha atualizada'); view().querySelector('#mc-s1').value=''; view().querySelector('#mc-s2').value=''; }
    catch(err){ toast('Erro: '+err.message); }
    btn.disabled=false; btn.textContent='Atualizar senha';
  };

  view().querySelector('#mc-sair').onclick = () => openContaSheet({
    nome: CTX.profile.nome || CTX.cliente.razao_social, papelLabel:'Prestador',
    acoes: [{ label:'Treinamentos', sub:'Vídeos e ajuda do app', icon: ICON.help, onClick: () => openAjuda('completo') }],
    onSair: async () => { await api.signOut(); location.reload(); } });
}

// Estado vazio reutilizável.
function emptyState(icon, title, text){
  return `<div class="empty"><div class="ico"><span style="width:42px;height:42px">${ICON[icon]}</span></div>
    <h3>${title}</h3><p>${text}</p></div>`;
}
