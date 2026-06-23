// ============================================================
//  analyst.js — telas do ANALISTA (Maradel), desktop
//  Fila com contadores/busca, detalhe com copiar + emitir nota.
// ============================================================
import * as api from './api.js';
import {
  ICON, brl, fmtCompetencia, fmtCompetenciaShort, fmtDate, fmtDateTime, relTime, initials, badge,
  esc, toast, copyToClipboard, maskDocInput, openEnvioEmail, openEnvioWhatsApp,
  ressalvaPill, notaPublicUrl, linkPublicoCard, bindLinkPublico, STATUS_LABEL
} from './ui.js';

let CTX = { profile:null, root:null, status:'solicitada', busca:'' };

// Ponto de entrada: monta o shell do analista e abre na fila "solicitada".
export async function mountAnalista(root, profile){
  CTX = { profile, root, status:'solicitada', busca:'' };
  renderShell();
  showFila();
}

const main = () => CTX.root.querySelector('#an-main');

function renderShell(){
  const nome = CTX.profile.nome || 'Analista';
  CTX.root.innerHTML = `
    <div class="an">
      <aside class="an-side">
        <div class="brand"><img src="assets/logo-horizontal-white.png" alt="Maradel"></div>
        <nav class="nav">
          <button class="item active" data-nav="fila">${ICON.list}<span>Fila</span></button>
          <button class="item" data-nav="notas">${ICON.file}<span>Notas emitidas</span></button>
          <button class="item" data-nav="clientes">${ICON.users}<span>Clientes</span></button>
        </nav>
        <div class="user">
          <div class="ava">${initials(nome)}</div>
          <div style="min-width:0"><div class="nm">${esc(nome)}</div><div class="rl">Analista fiscal</div></div>
          <button id="an-logout" title="Sair" style="margin-left:auto;background:none;border:none;color:rgba(255,255,255,.5);cursor:pointer;width:20px;height:20px">${ICON.logout}</button>
        </div>
      </aside>
      <div class="an-main" id="an-main"></div>
    </div>`;
  CTX.root.querySelector('#an-logout').onclick = async () => { await api.signOut(); location.reload(); };
  // Navegação lateral: Fila / Notas emitidas / Clientes.
  CTX.root.querySelectorAll('[data-nav]').forEach(b => b.onclick = () => {
    const n = b.dataset.nav;
    if(n==='fila'){ CTX.status='solicitada'; showFila(); }
    else if(n==='notas'){ CTX.status='emitida'; showFila(); }
    else showClientes();
  });
}

// Marca o item ativo na barra lateral.
function setNav(nav){
  CTX.root.querySelectorAll('[data-nav]').forEach(b =>
    b.classList.toggle('active', b.dataset.nav===nav));
}

// ---- FILA -------------------------------------------------------------------
async function showFila(){
  setNav(CTX.status==='emitida' ? 'notas' : 'fila');
  main().innerHTML = `<div style="padding:60px"><div class="spinner"></div></div>`;
  const [cont, rows] = await Promise.all([
    api.contadoresPorStatus(),
    api.listSolicitacoesAnalista({ status:CTX.status, busca:CTX.busca })
  ]);
  const hoje = new Date().toLocaleDateString('pt-BR',{ weekday:'long', day:'2-digit', month:'long' });
  const pend = cont.solicitada;

  main().innerHTML = `
    <div class="an-head">
      <div class="row1">
        <div>
          <h1>Fila de solicitações</h1>
          <div class="day">${hoje.charAt(0).toUpperCase()+hoje.slice(1)} · ${pend?pend+' aguardando ação':'tudo em dia'}</div>
        </div>
        <div class="an-search">${ICON.search}<input id="an-busca" placeholder="Buscar cliente ou CNPJ…" value="${esc(CTX.busca)}"></div>
      </div>
      <div class="an-tabs">
        ${tab('solicitada', cont.solicitada)}
        ${tab('em_emissao', cont.em_emissao)}
        ${tab('emitida', cont.emitida)}
        ${tab('cancelada', cont.cancelada)}
      </div>
    </div>
    <div class="an-content">
      ${rows.length ? `
        <div class="tbl-head"><span>Cliente</span><span>Tomador</span><span>Serviço</span><span>Competência</span><span style="text-align:right">Valor</span><span style="text-align:right">Status</span></div>
        <div class="tbl">${rows.map(filaRow).join('')}</div>`
       : filaEmpty(CTX.status)}
    </div>`;

  // contadores/abas
  main().querySelectorAll('[data-tab]').forEach(t => t.onclick = () => { CTX.status = t.dataset.tab; showFila(); });
  // busca (debounce simples)
  const bs = main().querySelector('#an-busca');
  let deb; bs.oninput = () => { clearTimeout(deb); deb = setTimeout(()=>{ CTX.busca = bs.value; showFila().then(()=>{ const n=main().querySelector('#an-busca'); n.focus(); n.setSelectionRange(n.value.length,n.value.length); }); }, 280); };
  // linhas → detalhe
  main().querySelectorAll('[data-open]').forEach(r => r.onclick = () => showDetalhe(r.dataset.open));
}

function tab(status, n){
  const active = CTX.status===status;
  return `<button class="an-tab ${active?'active':''}" data-tab="${status}"><span>${STATUS_LABEL[status]}</span><span class="cnt">${n}</span></button>`;
}

// Ressalva: tomador exige número de pedido e ele ainda não foi preenchido.
function temRessalva(s){
  return !!s.tomador?.exige_numero_pedido && !String(s.numero_pedido||'').trim()
    && s.status!=='emitida' && s.status!=='cancelada';
}
function filaRow(s){
  return `
    <div class="tbl-row" data-open="${s.id}">
      <div><div class="cli-nm">${esc(s.cliente?.razao_social||'—')}</div><div class="sub">${relTime(s.created_at)}</div></div>
      <div><div class="tom">${esc(s.tomador?.nome||'—')}</div><div class="sub">${esc(s.tomador?.doc||'')}</div></div>
      <div class="svc">${esc((s.descricao||'').slice(0,22))}${(s.descricao||'').length>22?'…':''}</div>
      <div class="comp svc">${fmtCompetenciaShort(s.competencia)}</div>
      <div class="val">${brl(s.valor)}</div>
      <div class="st" style="display:flex;gap:5px;justify-content:flex-end;flex-wrap:wrap">${temRessalva(s)?ressalvaPill():''}${badge(s.status)}</div>
    </div>`;
}

function filaEmpty(status){
  if(status==='solicitada'){
    return `<div class="empty"><div class="ico" style="color:var(--st-emit-fg);border-radius:26px;width:104px;height:104px"><span style="width:48px;height:48px">${ICON.party}</span></div>
      <h3>Nenhuma solicitação pendente 🎉</h3>
      <p>Você zerou a fila. Novas solicitações aparecem aqui automaticamente.</p></div>`;
  }
  return `<div class="empty"><div class="ico"><span style="width:42px;height:42px">${ICON.file}</span></div>
    <h3>Nada em "${STATUS_LABEL[status]}"</h3><p>Não há solicitações com este status no momento.</p></div>`;
}

// ---- CLIENTES ---------------------------------------------------------------
// Lista os prestadores cadastrados e dá acesso ao cadastro de um novo cliente.
async function showClientes(){
  setNav('clientes');
  main().innerHTML = `<div style="padding:60px"><div class="spinner"></div></div>`;
  const clientes = await api.listClientes();
  main().innerHTML = `
    <div class="an-head">
      <div class="row1">
        <div><h1>Clientes</h1><div class="day">${clientes.length} prestador(es) cadastrado(s)</div></div>
        <button class="btn btn-primary btn-sm" id="cl-novo">${ICON.plus}<span>Novo cliente</span></button>
      </div>
    </div>
    <div class="an-content">
      ${clientes.length ? `
        <div class="tbl-head" style="grid-template-columns:2.2fr 1.6fr 1fr 1.8fr"><span>Razão social</span><span>CNPJ</span><span>Regime</span><span>E-mail</span></div>
        <div class="tbl">${clientes.map(c=>`
          <div class="tbl-row" style="grid-template-columns:2.2fr 1.6fr 1fr 1.8fr;cursor:default">
            <div class="cli-nm">${esc(c.razao_social)}</div>
            <div class="tom">${esc(c.cnpj)}</div>
            <div class="svc">${esc(c.regime||'—')}</div>
            <div class="svc">${esc(c.email||'—')}</div>
          </div>`).join('')}</div>`
        : `<div class="empty"><div class="ico"><span style="width:42px;height:42px">${ICON.users}</span></div>
            <h3>Nenhum cliente ainda</h3><p>Cadastre o primeiro prestador. Ele recebe um convite por e-mail para definir a senha.</p></div>`}
    </div>`;
  main().querySelector('#cl-novo').onclick = showNovoCliente;
}

// Formulário de cadastro completo do cliente. Ao salvar, dispara o convite
// por e-mail (Edge Function com service_role).
function showNovoCliente(){
  main().innerHTML = `
    <div class="det-head">
      <button class="back" id="nc-back">${ICON.back}</button>
      <div><h1>Novo cliente</h1>
        <div class="sub" style="font-size:12.5px;color:var(--mist);margin-top:2px">Ao salvar, enviamos um convite para o e-mail definir a senha.</div></div>
    </div>
    <div class="an-content" style="max-width:560px">
      <div class="field"><label>Razão social</label><input class="input" id="nc-razao" placeholder="Nome da empresa"></div>
      <div style="display:flex;gap:14px">
        <div class="field" style="flex:1.4"><label>CNPJ</label><input class="input" id="nc-cnpj" inputmode="numeric" placeholder="00.000.000/0000-00"></div>
        <div class="field" style="flex:1"><label>Regime</label><select class="select" id="nc-regime"><option value="SP">Município (SP)</option><option value="Nacional">Nacional</option></select></div>
      </div>
      <div class="field"><label>Endereço</label><input class="input" id="nc-end" placeholder="Rua, número, bairro, cidade/UF"></div>
      <div class="field"><label>E-mail do cliente (para o convite)</label><input class="input" id="nc-email" type="email" placeholder="cliente@empresa.com.br"></div>
      <div class="form-grid">
        <div class="field"><label>Telefone (WhatsApp) <span style="text-transform:none;letter-spacing:0;color:var(--mist)">opcional</span></label><input class="input" id="nc-tel" inputmode="tel" placeholder="(11) 99999-8888"></div>
        <div class="field"><label>Link do grupo do WhatsApp <span style="text-transform:none;letter-spacing:0;color:var(--mist)">opcional</span></label><input class="input" id="nc-grupo" placeholder="https://chat.whatsapp.com/..."></div>
      </div>
      <button class="btn btn-primary btn-block" id="nc-save" style="margin-top:8px">${ICON.send}<span>Salvar e enviar convite</span></button>
    </div>`;
  maskDocInput(main().querySelector('#nc-cnpj'));
  main().querySelector('#nc-back').onclick = showClientes;
  main().querySelector('#nc-save').onclick = async () => {
    const g = id => main().querySelector(id).value.trim();
    const razao_social = g('#nc-razao'), cnpj = g('#nc-cnpj'), email = g('#nc-email');
    if(!razao_social || !cnpj) return toast('Preencha razão social e CNPJ');
    if(!/^[^@]+@[^@]+\.[^@]+$/.test(email)) return toast('Informe um e-mail válido');
    const btn = main().querySelector('#nc-save'); btn.disabled=true; btn.innerHTML='Enviando convite…';
    try{
      await api.convidarCliente({ razao_social, cnpj, regime:g('#nc-regime'), endereco:g('#nc-end'), email,
        telefone:g('#nc-tel')||null, whatsapp_grupo:g('#nc-grupo')||null });
      toast('Cliente cadastrado e convite enviado'); showClientes();
    }catch(e){ toast('Erro: '+e.message); btn.disabled=false; btn.innerHTML=`${ICON.send}<span>Salvar e enviar convite</span>`; }
  };
}

// ---- DETALHE ----------------------------------------------------------------
let DET = { pdf:null, xml:null }; // arquivos selecionados (ainda não enviados)

async function showDetalhe(id){
  main().innerHTML = `<div style="padding:60px"><div class="spinner"></div></div>`;
  DET = { pdf:null, xml:null };
  const s = await api.getSolicitacao(id);
  const nota = Array.isArray(s.nota) ? s.nota[0] : s.nota;
  const doc = s.tomador?.doc || '—';
  const emitida = s.status==='emitida' && nota;

  // Bloqueio do número de pedido (item B): se o tomador exige e está vazio,
  // a emissão fica travada. O <input> abaixo destrava ao preencher; o banco
  // (trigger) é a guarda real, este é o aviso/bloqueio visual que a acompanha.
  const exigePedido = !!s.tomador?.exige_numero_pedido;
  const pedidoVazio = !String(s.numero_pedido||'').trim();

  main().innerHTML = `
    <div class="det">
      <div class="det-head">
        <button class="back" id="dt-back">${ICON.back}</button>
        <div>
          <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap"><h1>${esc(s.cliente?.razao_social||'Cliente')}</h1>${(exigePedido&&pedidoVazio&&!emitida)?ressalvaPill():''}${badge(s.status)}</div>
          <div class="sub" style="font-size:12.5px;color:var(--mist);margin-top:2px">Recebida ${relTime(s.created_at)} · #${s.id.slice(0,8)}</div>
        </div>
      </div>
      <div class="det-grid">
        <div class="det-left">
          <div class="cap">Dados para o portal da prefeitura</div>
          ${copyRow('Tomador · Razão social', esc(s.tomador?.nome||'—'), s.tomador?.nome||'')}
          ${copyRow('CNPJ / CPF', esc(doc), doc)}
          ${copyRow('Descrição do serviço', esc(s.descricao), s.descricao)}
          <div style="display:flex;gap:8px">
            ${copyRow('Valor', brl(s.valor), String(s.valor).replace('.',','), true)}
            ${copyRow('Competência', fmtCompetenciaShort(s.competencia), fmtCompetenciaShort(s.competencia))}
          </div>
          ${s.recorrente?`<div class="det-info-pill">${ICON.refresh}<span>Recorrente${s.recorrencia_meses?` · ${esc(s.recorrencia_meses)} meses`:''} <em>(informativo)</em></span></div>`:''}
          <div style="display:flex;align-items:center;gap:10px;margin-top:8px;padding:12px 16px;background:#fff;border:1px dashed rgba(57,57,59,.18);border-radius:10px">
            <span style="color:var(--taupe);width:16px">${ICON.users}</span>
            <span style="font-size:12.5px;color:var(--taupe)">Prestador: <strong style="color:var(--chumbo)">${esc(s.cliente?.razao_social||'—')}</strong> · CNPJ ${esc(s.cliente?.cnpj||'—')}</span>
          </div>
          <div id="dt-historico" style="margin-top:18px"></div>
        </div>
        <div class="det-right">
          <div><div style="font-size:16px;font-weight:600">Registrar emissão</div>
            <div style="font-size:12.5px;color:var(--taupe);margin-top:3px;line-height:1.5">Emita no portal, cole o número e suba os arquivos.</div></div>
          <div class="field" style="margin:0">
            <label>Número de pedido${exigePedido?' <span class="req">obrigatório</span>':' <span class="opt">opcional</span>'}</label>
            <input class="input" id="dt-pedido" value="${esc(s.numero_pedido||'')}" placeholder="${exigePedido?'Preencha para liberar a emissão':'PO-2026-0042'}">
          </div>
          <div id="dt-bloqueio" class="aviso-ressalva ${exigePedido&&pedidoVazio?'':'hidden'}">${ICON.alert}<span>Este tomador <strong>exige número de pedido</strong>. A emissão fica bloqueada até preencher o número acima.</span></div>
          <div class="field" style="margin:0"><label>Número da NFS-e</label><input class="input" id="dt-num" value="${esc(nota?.numero||'')}" placeholder="2026/0000"></div>
          <div style="display:flex;flex-direction:column;gap:10px">
            ${dropzone('pdf', nota?.pdf_url)}
            ${dropzone('xml', nota?.xml_url)}
          </div>
          <input type="file" id="dt-file-pdf" accept="application/pdf" class="hidden">
          <input type="file" id="dt-file-xml" accept=".xml,application/xml,text/xml" class="hidden">
          ${emitida?linkPublicoCard(nota.public_token):''}
          <div style="margin-top:auto;display:flex;flex-direction:column;gap:10px">
            <button class="btn btn-primary btn-block" id="dt-emitir">${ICON.check}<span>${emitida?'Atualizar emissão':'Marcar como emitida'}</span></button>
            ${emitida?`<div class="btn-row"><button class="btn btn-ghost" id="dt-email">${ICON.mail}<span>E-mail</span></button><button class="btn btn-ghost" id="dt-whats">${ICON.whatsapp}<span>WhatsApp</span></button></div>`:''}
            ${s.status!=='cancelada'?`<button class="link-danger" id="dt-cancel" style="margin:0 auto">Cancelar solicitação</button>`:''}
          </div>
        </div>
      </div>
    </div>`;

  main().querySelector('#dt-back').onclick = showFila;

  // copiar
  main().querySelectorAll('[data-copy]').forEach(b =>
    b.onclick = () => copyToClipboard(b.dataset.copy, b));

  // dropzones → abrir seletor de arquivo
  const fpdf = main().querySelector('#dt-file-pdf'), fxml = main().querySelector('#dt-file-xml');
  main().querySelector('[data-drop="pdf"]').onclick = () => fpdf.click();
  main().querySelector('[data-drop="xml"]').onclick = () => fxml.click();
  fpdf.onchange = () => { DET.pdf = fpdf.files[0]; refreshDrop('pdf', DET.pdf?.name); };
  fxml.onchange = () => { DET.xml = fxml.files[0]; refreshDrop('xml', DET.xml?.name); };

  // Bloqueio dinâmico: liga/desliga o aviso e o botão emitir conforme o pedido.
  const inpPedido = main().querySelector('#dt-pedido');
  const btnEmitir = main().querySelector('#dt-emitir');
  const aviso = main().querySelector('#dt-bloqueio');
  function syncBloqueio(){
    const vazio = !inpPedido.value.trim();
    const bloq = exigePedido && vazio;
    aviso.classList.toggle('hidden', !bloq);
    btnEmitir.disabled = bloq;
    btnEmitir.title = bloq ? 'Preencha o número de pedido para emitir' : '';
  }
  inpPedido.oninput = syncBloqueio;
  syncBloqueio();

  // emitir
  btnEmitir.onclick = () => emitir(s);

  // link público (copiar / abrir / regenerar) — só quando emitida
  if(emitida) bindLinkPublico(main(), nota.public_token, {
    onRegenerar: () => api.regenerarTokenNota(nota.id),
    onRefresh: () => showDetalhe(id),
  });

  // enviar por e-mail / WhatsApp (nota já emitida)
  const be = main().querySelector('#dt-email');
  if(be) be.onclick = () => openEnvioEmail({
    numero: nota?.numero,
    empresa: s.cliente?.razao_social,
    dataEmissao: fmtDate(nota?.data_emissao),
    assinatura: CTX.profile.nome || s.cliente?.razao_social,
    token: nota?.public_token,
    tomadorEmail: s.tomador?.email || '',
    onEnviado: (canal, destinatario) => recarregarHistorico(nota.id, canal, destinatario),
  });
  const bw = main().querySelector('#dt-whats');
  if(bw) bw.onclick = () => openEnvioWhatsApp({
    numero: nota?.numero,
    empresa: s.cliente?.razao_social,
    dataEmissao: fmtDate(nota?.data_emissao),
    assinatura: CTX.profile.nome || s.cliente?.razao_social,
    token: nota?.public_token,
    clienteTelefone: s.cliente?.telefone || '',
    clienteGrupo: s.cliente?.whatsapp_grupo || '',
    onEnviado: (canal, destinatario) => recarregarHistorico(nota.id, canal, destinatario),
  });

  const c = main().querySelector('#dt-cancel');
  if(c) c.onclick = async () => { await api.setStatus(s.id,'cancelada'); toast('Solicitação cancelada'); showFila(); };

  // histórico (envios + aberturas) — carrega assíncrono
  if(nota) carregarHistorico(nota.id);
}

// Registra o envio no histórico e recarrega a lista (item F).
async function recarregarHistorico(notaId, canal, destinatario){
  try{ await api.registrarEnvio({ nota_id: notaId, canal, destinatario }); }catch{}
  carregarHistorico(notaId);
}

// Carrega e renderiza o histórico de envios/aberturas da nota.
async function carregarHistorico(notaId){
  const box = main().querySelector('#dt-historico');
  if(!box) return;
  let eventos = [];
  try{ eventos = await api.listEventosNota(notaId); }catch{}
  box.innerHTML = `
    <div class="cap" style="margin-bottom:8px">Histórico de envios e aberturas</div>
    ${eventos.length ? `<div class="timeline">${eventos.map(histRow).join('')}</div>`
      : `<div style="font-size:12.5px;color:var(--mist);padding:10px 0">Ainda sem envios. Use os botões de e-mail/WhatsApp para enviar a nota.</div>`}`;
}

// Uma linha do histórico.
function histRow(e){
  const abertura = e.tipo === 'abertura';
  const icone = abertura ? ICON.eye : (e.canal==='whatsapp' ? ICON.whatsapp : ICON.mail);
  const titulo = abertura
    ? 'Tomador abriu o link'
    : `Enviado por ${e.canal==='whatsapp' ? 'WhatsApp' : 'e-mail'}${e.destinatario ? ' · '+esc(e.destinatario) : ''}`;
  return `
    <div class="tl-row ${abertura?'open':'send'}">
      <div class="tl-ic"><span style="width:15px">${icone}</span></div>
      <div style="flex:1;min-width:0">
        <div class="tl-t">${titulo}</div>
        <div class="tl-d">${fmtDateTime(e.created_at)}</div>
      </div>
    </div>`;
}

// Campo somente-leitura com botão copiar ao lado.
function copyRow(label, display, raw, accent){
  return `
    <div class="copyfield ${accent?'accent':''}" style="${accent?'flex:1.2':'flex:1'}">
      <div style="min-width:0">
        <div class="cf-k">${label}</div>
        <div class="cf-v ${accent?'big':''}">${display}</div>
      </div>
      <button class="copy-btn" data-copy="${esc(raw)}">${ICON.copy}<span>Copiar</span></button>
    </div>`;
}

// Área de upload (estado vazio ou com arquivo já anexado).
function dropzone(tipo, existing){
  const filled = !!existing;
  const label = tipo.toUpperCase();
  return `
    <div class="drop ${filled?'filled':''}" data-drop="${tipo}">
      <div class="ic">${filled?`<span style="color:var(--st-emit-fg);width:17px">${ICON.check}</span>`:`<span style="color:var(--taupe);width:17px">${ICON.upload}</span>`}</div>
      <div style="flex:1;min-width:0">
        <div class="t" data-drop-t="${tipo}">${filled?`nota.${tipo}`:`Anexar ${label}`}</div>
        <div class="s" data-drop-s="${tipo}">${filled?`${label} · anexado`:'Clique para enviar'}</div>
      </div>
    </div>`;
}
function refreshDrop(tipo, name){
  const wrap = main().querySelector(`[data-drop="${tipo}"]`);
  if(!name) return;
  wrap.classList.add('filled');
  wrap.querySelector('.ic').innerHTML = `<span style="color:var(--st-emit-fg);width:17px">${ICON.check}</span>`;
  main().querySelector(`[data-drop-t="${tipo}"]`).textContent = name;
  main().querySelector(`[data-drop-s="${tipo}"]`).textContent = `${tipo.toUpperCase()} · pronto para enviar`;
}

// Fluxo de emissão: salva o número de pedido (item B), sobe arquivos (se
// houver), grava a nota e muda o status. O bloqueio do pedido tem dupla guarda:
// aqui (pré-checagem) e no banco (trigger trg_notas_check_pedido).
async function emitir(s){
  const numero = main().querySelector('#dt-num').value.trim();
  const pedido = main().querySelector('#dt-pedido').value.trim();
  if(s.tomador?.exige_numero_pedido && !pedido){
    return toast('Número de pedido obrigatório para este tomador');
  }
  if(!numero) return toast('Informe o número da nota');
  const btn = main().querySelector('#dt-emitir'); btn.disabled = true; btn.innerHTML = 'Emitindo…';
  try{
    // Persiste/atualiza o número de pedido antes de emitir (libera o trigger).
    if(pedido !== String(s.numero_pedido||'').trim()){
      await api.setNumeroPedido(s.id, pedido || null);
    }
    let pdfPath = null, xmlPath = null;
    if(DET.pdf) pdfPath = await api.uploadArquivo(s.cliente_id, s.id, DET.pdf, 'pdf');
    if(DET.xml) xmlPath = await api.uploadArquivo(s.cliente_id, s.id, DET.xml, 'xml');
    await api.emitirNota({ solicitacaoId:s.id, numero, pdfPath, xmlPath });
    toast('Nota marcada como emitida'); CTX.status='solicitada'; showFila();
  }catch(e){ toast('Erro: '+e.message); btn.disabled=false; btn.innerHTML = `${ICON.check}<span>Marcar como emitida</span>`; }
}
