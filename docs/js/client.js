// ============================================================
//  client.js — telas do CLIENTE (prestador), mobile-first
//  Dashboard, nova solicitação, tomadores, detalhe da nota.
// ============================================================
import * as api from './api.js';
import {
  ICON, brl, parseBRL, maskMoneyInput, maskDocInput, currentCompetencia,
  fmtCompetencia, fmtCompetenciaShort, relTime, fmtDate, initials, badge,
  esc, toast, copyToClipboard, openEnvioEmail, openEnvioWhatsApp,
  ressalvaPill, notaPublicUrl, linkPublicoCard, bindLinkPublico,
  toggle, bindToggle, isToggleOn, fmtDateTime
} from './ui.js';

let CTX = { profile:null, cliente:null, root:null, tab:'dashboard' };

// Ponto de entrada: monta o shell do cliente. Faz onboarding se necessário.
export async function mountCliente(root, profile){
  CTX = { profile, cliente:null, root, tab:'dashboard' };
  CTX.cliente = await api.getMeuCliente();
  if(!CTX.cliente){ return renderSemCadastro(); }
  renderShell();
  showDashboard();
}

// ---- shell + navegação ------------------------------------------------------
function renderShell(){
  CTX.root.innerHTML = `
    <div class="cli">
      <div class="cli-top">
        <img src="assets/logo-horizontal-white.png" alt="Maradel">
        <div style="display:flex;align-items:center;gap:14px">
          <div style="position:relative;color:rgba(255,255,255,.8);width:22px;height:22px">${ICON.bell}</div>
          <button id="cli-logout" title="Sair" style="background:none;border:none;cursor:pointer;width:34px;height:34px;border-radius:50%;background:var(--terracota);color:#fff;display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:600">${initials(CTX.cliente.razao_social)}</button>
        </div>
      </div>
      <div id="cli-view"></div>
      <button class="btn btn-primary fab" id="cli-fab" style="border-radius:999px;padding:14px 24px">${ICON.plus}<span>Nova solicitação</span></button>
      <div class="cli-nav">
        <button class="item" data-tab="dashboard">${ICON.home}<span>Início</span></button>
        <button class="item" data-tab="solicitacoes">${ICON.list}<span>Solicitações</span></button>
        <button class="item" data-tab="tomadores">${ICON.users}<span>Tomadores</span></button>
        <button class="item" data-tab="conta">${ICON.user}<span>Conta</span></button>
      </div>
    </div>`;
  CTX.root.querySelector('#cli-logout').onclick = async () => { await api.signOut(); location.reload(); };
  CTX.root.querySelector('#cli-fab').onclick = () => showNovaSolicitacao();
  CTX.root.querySelectorAll('.cli-nav .item').forEach(b => b.onclick = () => {
    const t = b.dataset.tab;
    if(t==='dashboard') showDashboard();
    else if(t==='solicitacoes') showSolicitacoes();
    else if(t==='tomadores') showTomadores();
    else showMinhaConta();
  });
}
function setActiveTab(tab){
  CTX.tab = tab;
  CTX.root.querySelectorAll('.cli-nav .item').forEach(b =>
    b.classList.toggle('active', b.dataset.tab===tab));
  const fab = CTX.root.querySelector('#cli-fab');
  // FAB aparece nas telas de lista (Início e Solicitações).
  if(fab) fab.style.display = (tab==='dashboard' || tab==='solicitacoes') ? '' : 'none';
}
const view = () => CTX.root.querySelector('#cli-view');

// ---- DASHBOARD --------------------------------------------------------------
async function showDashboard(){
  setActiveTab('dashboard');
  view().innerHTML = `<div class="cli-body"><div class="spinner" style="margin:60px auto"></div></div>`;
  const solics = await api.listSolicitacoesCliente(CTX.cliente.id);

  // Faturamento mensal = soma do valor das solicitações emitidas, por competência.
  const emitidas = solics.filter(s => s.status==='emitida');
  const porMes = {};
  emitidas.forEach(s => { porMes[s.competencia] = (porMes[s.competencia]||0) + Number(s.valor); });
  const meses = Object.keys(porMes).sort().slice(-6);
  const atual = currentCompetencia();
  const fatAtual = porMes[atual] || (meses.length ? porMes[meses[meses.length-1]] : 0);

  view().innerHTML = `
    <div class="cli-body">
      <div class="cli-hello">Olá${CTX.profile.nome?', '+esc(CTX.profile.nome.split(' ')[0]):''}</div>
      <div class="cli-empresa">${esc(CTX.cliente.razao_social)}</div>

      <div class="card fat-card">
        <div class="fat-label">Faturamento · ${fmtCompetencia(atual)}</div>
        <div class="fat-value">${brl(fatAtual).replace(/(,\d{2})$/, m=>`<small>${m}</small>`)}</div>
        ${renderChart(meses, porMes)}
      </div>

      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px">
        <span class="section-title">Últimas solicitações</span>
      </div>
      ${solics.length ? `<div class="solic-list">${solics.slice(0,12).map(rowSolic).join('')}</div>`
        : emptyState('file', 'Sua primeira nota começa aqui',
            'Você ainda não tem solicitações. Crie uma e a Maradel cuida da emissão.')}
    </div>`;

  view().querySelectorAll('[data-solic]').forEach(r =>
    r.onclick = () => showSolicitacao(r.dataset.solic));
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
function rowSolic(s){
  const canceled = s.status==='cancelada';
  return `
    <div class="solic-row" data-solic="${s.id}">
      <div style="flex:1;min-width:0">
        <div class="nome">${esc(s.tomador?.nome||'Tomador')}</div>
        <div class="meta">${esc(s.descricao.slice(0,28))}${s.descricao.length>28?'…':''} · ${relTime(s.created_at)}</div>
      </div>
      <div style="flex:none">
        <div class="val" style="${canceled?'color:var(--mist);text-decoration:line-through':''}">${brl(s.valor)}</div>
        <div style="text-align:right;margin-top:5px;display:flex;gap:5px;justify-content:flex-end;flex-wrap:wrap">${temRessalva(s)?ressalvaPill():''}${badge(s.status)}</div>
      </div>
    </div>`;
}

// ---- SOLICITAÇÕES (lista completa) -----------------------------------------
async function showSolicitacoes(){
  setActiveTab('solicitacoes');
  view().innerHTML = `<div class="cli-body"><div class="spinner" style="margin:60px auto"></div></div>`;
  const solics = await api.listSolicitacoesCliente(CTX.cliente.id);
  view().innerHTML = `
    <div class="subhead" style="position:static"><h2 style="margin-left:4px">Minhas solicitações</h2></div>
    <div class="cli-body" style="padding-bottom:120px">
      ${solics.length ? `<div class="solic-list">${solics.map(rowSolic).join('')}</div>`
        : emptyState('list','Nenhuma solicitação ainda','Toque em "Nova solicitação" e a Maradel cuida da emissão.')}
    </div>`;
  view().querySelectorAll('[data-solic]').forEach(r =>
    r.onclick = () => showSolicitacao(r.dataset.solic));
}

// ---- NOVA SOLICITAÇÃO -------------------------------------------------------
async function showNovaSolicitacao(){
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
    view().querySelector('#ns-novo-tom').onclick = () => showNovoTomador(showNovaSolicitacao);
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
          ${tomadores.map((t,i)=>`<option value="${t.id}" data-exige="${t.exige_numero_pedido?1:0}" ${t.id===ultimoId?'selected':''}>${esc(t.nome)}${i===0?' — último usado':''}</option>`).join('')}
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
  view().querySelector('#ns-add-tom').onclick = () => showNovoTomador(showNovaSolicitacao);
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
  view().innerHTML = `<div class="cli-body"><div class="spinner" style="margin:60px auto"></div></div>`;
  const s = await api.getSolicitacao(id);
  const nota = Array.isArray(s.nota) ? s.nota[0] : s.nota;
  const emitida = s.status==='emitida' && nota;

  const ressalva = temRessalva(s);
  view().innerHTML = `
    <div class="subhead"><button class="back" id="sd-back">${ICON.back}</button><h2>${emitida?'Nota emitida':'Solicitação'}</h2></div>
    <div class="cli-body">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:18px;gap:8px;flex-wrap:wrap">
        <div>
          <div class="fat-label">${emitida?'NFS-e nº':'Solicitação'}</div>
          <div style="font-size:24px;font-weight:700;color:var(--terracota);margin-top:3px">${emitida?esc(nota.numero||'—'):'#'+s.id.slice(0,8)}</div>
        </div>
        <div style="display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end">${ressalva?ressalvaPill():''}${badge(s.status)}</div>
      </div>
      ${ressalva?`<div class="aviso-ressalva" style="margin-bottom:16px">${ICON.alert}<span>Falta o <strong>número de pedido</strong> exigido por este tomador. A Maradel só emite após o preenchimento.</span></div>`:''}
      <div class="card">
        <div class="kv"><span class="k">Tomador</span><span class="v">${esc(s.tomador?.nome||'—')}</span></div>
        <div class="kv"><span class="k">Documento</span><span class="v">${esc(s.tomador?.doc||'—')}</span></div>
        <div class="kv"><span class="k">Serviço</span><span class="v">${esc(s.descricao)}</span></div>
        ${s.numero_pedido?`<div class="kv"><span class="k">Nº de pedido</span><span class="v">${esc(s.numero_pedido)}</span></div>`:''}
        ${s.recorrente?`<div class="kv"><span class="k">Recorrência</span><span class="v">${s.recorrencia_meses?esc(s.recorrencia_meses)+' meses':'Sim'}</span></div>`:''}
        <div class="kv"><span class="k">Competência</span><span class="v">${fmtCompetencia(s.competencia)}</span></div>
        ${emitida?`<div class="kv"><span class="k">Emissão</span><span class="v">${fmtDate(nota.data_emissao)}</span></div>`:''}
        <div class="kv" style="background:#FAF8F6"><span class="k" style="font-weight:600;color:var(--grafite)">Valor</span><span class="v" style="font-size:18px;color:var(--terracota)">${brl(s.valor)}</span></div>
      </div>
      ${emitida ? `
        ${linkPublicoCard(nota.public_token)}
        <div class="btn-row" style="margin-top:18px">
          <button class="btn btn-primary" data-dl="pdf" ${nota.pdf_url?'':'disabled'}>${ICON.download}<span>PDF</span></button>
          <button class="btn btn-outline" data-dl="xml" ${nota.xml_url?'':'disabled'}>${ICON.download}<span>XML</span></button>
        </div>
        <div class="btn-row" style="margin-top:12px">
          <button class="btn btn-ghost" id="sd-email">${ICON.mail}<span>Enviar por e-mail</span></button>
          <button class="btn btn-ghost" id="sd-whats">${ICON.whatsapp}<span>WhatsApp</span></button>
        </div>` : `
        <div class="card" style="padding:14px 16px;margin-top:18px;display:flex;gap:9px;align-items:flex-start">
          <span style="color:var(--taupe);width:17px;flex:none">${ICON.info}</span>
          <span style="font-size:13px;color:var(--taupe);line-height:1.5">Assim que a Maradel emitir, o link da nota e os botões para baixar o PDF e o XML aparecem aqui.</span>
        </div>
        ${s.status==='solicitada'?`<button class="link-danger" id="sd-cancel" style="display:block;margin:14px auto 0">Cancelar solicitação</button>`:''}`}
    </div>`;
  view().querySelector('#sd-back').onclick = showDashboard;
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
  const c = view().querySelector('#sd-cancel');
  if(c) c.onclick = async () => { await api.setStatus(id,'cancelada'); toast('Solicitação cancelada'); showDashboard(); };
}

// ---- TOMADORES --------------------------------------------------------------
async function showTomadores(){
  setActiveTab('tomadores');
  view().innerHTML = `<div class="cli-body"><div class="spinner" style="margin:60px auto"></div></div>`;
  const tomadores = await api.listTomadores(CTX.cliente.id);
  view().innerHTML = `
    <div class="subhead" style="position:static"><h2 style="margin-left:4px">Meus tomadores</h2></div>
    <div class="cli-body" style="padding-bottom:120px">
      ${tomadores.length ? `<div class="solic-list">${tomadores.map(t=>`
        <div class="tom-row">
          <div class="ava ${t===tomadores[0]?'last':''}">${initials(t.nome)}</div>
          <div style="flex:1;min-width:0">
            <div class="nome">${esc(t.nome)}</div>
            <div class="meta">${esc(t.doc)}${t.cidade?' · '+esc(t.cidade):''}${t.uf?', '+esc(t.uf):''}${t.exige_numero_pedido?' · <span style="color:var(--terracota-dark)">exige nº pedido</span>':''}</div>
          </div>
        </div>`).join('')}</div>`
        : emptyState('users','Nenhum tomador ainda','Cadastre quem recebe suas notas. Depois é só selecionar na nova solicitação.')}
    </div>
    <div class="cli-footbar" style="background:transparent;border-top:none;bottom:64px">
      <button class="btn btn-ghost btn-block" id="tm-novo">${ICON.plus}<span>Novo tomador</span></button>
    </div>`;
  view().querySelector('#tm-novo').onclick = () => showNovoTomador();
}

// onSalvo: callback opcional chamado após salvar (ex.: voltar para a nova
// solicitação quando o tomador foi cadastrado pelo atalho). Default: lista.
function showNovoTomador(onSalvo){
  const voltar = onSalvo || showTomadores;
  view().innerHTML = `
    <div class="subhead"><button class="back" id="nt-back">${ICON.back}</button><h2>Novo tomador</h2></div>
    <div class="cli-body" style="padding-bottom:120px">
      <div class="field"><label>Tipo</label>
        <select class="select" id="nt-tipo"><option value="PJ">Pessoa Jurídica (CNPJ)</option><option value="PF">Pessoa Física (CPF)</option></select>
      </div>
      <div class="field"><label>CNPJ / CPF</label><input class="input" id="nt-doc" inputmode="numeric" placeholder="00.000.000/0000-00"></div>
      <div class="field"><label>Razão social / Nome</label><input class="input" id="nt-nome" placeholder="Nome do tomador"></div>
      <div class="field"><label>E-mail <span style="text-transform:none;letter-spacing:0;color:var(--mist)">(opcional)</span></label><input class="input" id="nt-email" type="email" placeholder="contato@tomador.com.br"></div>
      <div class="field"><label>Endereço</label><input class="input" id="nt-end" placeholder="Rua, número, bairro"></div>
      <div class="form-grid form-grid-3">
        <div class="field"><label>Cidade</label><input class="input" id="nt-cid" placeholder="Cidade"></div>
        <div class="field"><label>UF</label><input class="input" id="nt-uf" maxlength="2" placeholder="SP"></div>
        <div class="field"><label>CEP</label><input class="input" id="nt-cep" placeholder="00000-000"></div>
      </div>
      <div class="field">
        <label>Número de pedido obrigatório?</label>
        ${toggle('nt-exige', 'Exigir número de pedido nas notas deste tomador', false)}
        <div style="font-size:12px;color:var(--mist);margin-top:8px">Se ligado, a solicitação sem número de pedido segue com ressalva e a Maradel só emite após o preenchimento.</div>
      </div>
    </div>
    <div class="cli-footbar">
      <button class="btn btn-primary btn-block" id="nt-save">Salvar tomador</button>
    </div>`;
  maskDocInput(view().querySelector('#nt-doc'));
  bindToggle(view(), 'nt-exige');
  view().querySelector('#nt-back').onclick = showTomadores;
  view().querySelector('#nt-save').onclick = async () => {
    const g = id => view().querySelector(id).value.trim();
    const nome = g('#nt-nome'), doc = g('#nt-doc');
    if(!nome || !doc) return toast('Preencha nome e documento');
    const btn = view().querySelector('#nt-save'); btn.disabled=true; btn.textContent='Salvando…';
    try{
      await api.criarTomador({ cliente_id:CTX.cliente.id, tipo:g('#nt-tipo'), doc, nome,
        email:g('#nt-email')||null, endereco:g('#nt-end'), cidade:g('#nt-cid'), uf:g('#nt-uf'), cep:g('#nt-cep'),
        exige_numero_pedido: isToggleOn(view(), 'nt-exige') });
      toast('Tomador cadastrado'); voltar();
    }catch(e){ toast('Erro: '+e.message); btn.disabled=false; btn.textContent='Salvar tomador'; }
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

// ---- MINHA CONTA (trocar e-mail e senha) -----------------------------------
function showMinhaConta(){
  setActiveTab('conta');
  view().innerHTML = `
    <div class="subhead" style="position:static"><h2 style="margin-left:4px">Minha conta</h2></div>
    <div class="cli-body" style="padding-bottom:40px">
      <div class="card" style="padding:18px 18px 4px;margin-bottom:18px">
        <div class="cli-hello" style="margin-bottom:2px">Empresa</div>
        <div style="font-size:16px;font-weight:600;margin-bottom:14px">${esc(CTX.cliente.razao_social)}</div>
        <div class="field"><label>E-mail de acesso</label>
          <input class="input" id="mc-email" type="email" value="${esc(CTX.profile.email||'')}"></div>
        <button class="btn btn-outline btn-block" id="mc-email-save" style="margin-bottom:18px">Atualizar e-mail</button>
      </div>
      <div class="card" style="padding:18px 18px 4px;margin-bottom:18px">
        <div class="cli-hello" style="margin-bottom:2px">Contato para envio de notas</div>
        <div style="font-size:12.5px;color:var(--mist);margin-bottom:14px">Usados nos botões "Enviar por WhatsApp" das notas. Opcionais.</div>
        <div class="field"><label>Telefone (WhatsApp)</label>
          <input class="input" id="mc-tel" inputmode="tel" value="${esc(CTX.cliente.telefone||'')}" placeholder="(11) 99999-8888"></div>
        <div class="field"><label>Link do grupo do WhatsApp</label>
          <input class="input" id="mc-grupo" value="${esc(CTX.cliente.whatsapp_grupo||'')}" placeholder="https://chat.whatsapp.com/..."></div>
        <button class="btn btn-outline btn-block" id="mc-contato-save" style="margin-bottom:18px">Salvar contato</button>
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

  // Atualizar e-mail (Supabase envia confirmação ao novo endereço).
  view().querySelector('#mc-email-save').onclick = async () => {
    const e = view().querySelector('#mc-email').value.trim();
    if(!/^[^@]+@[^@]+\.[^@]+$/.test(e)) return toast('Informe um e-mail válido');
    const btn = view().querySelector('#mc-email-save'); btn.disabled=true; btn.textContent='Salvando…';
    try{ await api.atualizarEmail(e); toast('Confirme a troca no novo e-mail'); }
    catch(err){ toast('Erro: '+err.message); }
    btn.disabled=false; btn.textContent='Atualizar e-mail';
  };

  // Salvar telefone (WhatsApp) e link de grupo no registro do cliente.
  view().querySelector('#mc-contato-save').onclick = async () => {
    const telefone = view().querySelector('#mc-tel').value.trim() || null;
    const whatsapp_grupo = view().querySelector('#mc-grupo').value.trim() || null;
    const btn = view().querySelector('#mc-contato-save'); btn.disabled=true; btn.textContent='Salvando…';
    try{
      await api.atualizarMeuCliente(CTX.cliente.id, { telefone, whatsapp_grupo });
      CTX.cliente.telefone = telefone; CTX.cliente.whatsapp_grupo = whatsapp_grupo;
      toast('Contato atualizado');
    }catch(err){ toast('Erro: '+err.message); }
    btn.disabled=false; btn.textContent='Salvar contato';
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

  view().querySelector('#mc-sair').onclick = async () => { await api.signOut(); location.reload(); };
}

// Estado vazio reutilizável.
function emptyState(icon, title, text){
  return `<div class="empty"><div class="ico"><span style="width:42px;height:42px">${ICON[icon]}</span></div>
    <h3>${title}</h3><p>${text}</p></div>`;
}
