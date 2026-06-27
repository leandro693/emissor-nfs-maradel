// ============================================================
//  analyst.js — telas do ANALISTA (Maradel), desktop
//  Fila com contadores/busca, detalhe com copiar + emitir nota.
// ============================================================
import * as api from './api.js';
import {
  ICON, brl, fmtCompetencia, fmtCompetenciaShort, fmtDate, fmtDateTime, relTime, initials, badge,
  esc, toast, copyToClipboard, maskDocInput, openEnvioEmail, openEnvioWhatsApp,
  ressalvaPill, statusTag, notaPublicUrl, linkPublicoCard, bindLinkPublico, STATUS_LABEL,
  roleLabel, openModal, closeModal, toggle, bindToggle, isToggleOn
} from './ui.js';

let CTX = { profile:null, root:null, status:'solicitada', busca:'' };

// Permissões por papel (lê o papel do profile logado). Hierarquia:
//   admin_master > admin_operacional > analista > auxiliar.
const pode = {
  master:   () => CTX.profile?.role === 'admin_master',
  admin:    () => ['admin_master','admin_operacional'].includes(CTX.profile?.role),
  conferir: () => ['admin_master','admin_operacional','analista'].includes(CTX.profile?.role),
  auxiliar: () => CTX.profile?.role === 'auxiliar',
};

// Ponto de entrada: monta o shell do analista e abre na fila "solicitada".
export async function mountAnalista(root, profile){
  CTX = { profile, root, status:'solicitada', busca:'' };
  renderShell();
  showFila();
}

const main = () => CTX.root.querySelector('#an-main');

function renderShell(){
  // Cabeçalho mostra o NOME REAL e o PAPEL do usuário logado (item 3).
  const nome = CTX.profile.nome || 'Equipe Maradel';
  // Preferência de sidebar retraída persiste entre sessões (item 4, paridade com o cliente).
  const collapsed = localStorage.getItem('an_side_collapsed') === '1';
  // Menu organizado em GRUPOS com rótulo e separador (item 2 — "itens soltos"):
  //   OPERAÇÃO (Fila/Conferência/Notas) · CADASTROS (Clientes) · GESTÃO (Equipe/Config).
  const item = (nav, ico, label, extra='') =>
    `<button class="item${nav==='fila'?' active':''}" data-nav="${nav}">${ico}<span>${label}</span>${extra}</button>`;
  const grupoOperacao = [
    item('fila', ICON.list, 'Fila', `<span class="nav-cnt muted" id="nav-fila" hidden></span>`),
    pode.conferir() ? item('conferencia', ICON.check, 'Conferência', `<span class="nav-cnt" id="nav-conf" hidden></span>`) : '',
    item('notas', ICON.file, 'Notas emitidas'),
  ].filter(Boolean).join('');
  // CADASTROS reúne tudo que é cadastro: prestadores (clientes), tomadores e a
  // equipe interna. Tomadores são gerenciados aqui pelo escritório e vinculados
  // a um prestador; o vínculo aparece para o cliente na nova solicitação.
  const grupoCadastros = [
    item('clientes', ICON.users, 'Clientes'),
    item('tomadores', ICON.building, 'Tomadores'),
    pode.master() ? item('equipe', ICON.user, 'Equipe') : '',
  ].filter(Boolean).join('');
  const grupoGestao = [
    pode.admin() ? item('config', ICON.settings, 'Configurações') : '',
  ].filter(Boolean);

  const nav = `
    <div class="nav-label">Operação</div>
    ${grupoOperacao}
    <div class="nav-sep"></div>
    <div class="nav-label">Cadastros</div>
    ${grupoCadastros}
    ${grupoGestao.length ? `<div class="nav-sep"></div><div class="nav-label">Gestão</div>${grupoGestao.join('')}` : ''}`;

  // ---- Barra inferior (mobile, paridade com o app do cliente) ----------------
  // No celular a sidebar dá lugar a uma barra fixa embaixo com até 5 destinos.
  // Os cadastros (Clientes/Tomadores/Equipe) entram numa folha ("Cadastros").
  const bn = (nav, ico, label, extra='') =>
    `<button class="bn-item${nav==='fila'?' active':''}" data-nav="${nav}">${ico}<span>${label}</span>${extra}</button>`;
  const bottomNav = [
    bn('fila', ICON.list, 'Fila', `<span class="bn-badge muted" id="bn-fila" hidden></span>`),
    pode.conferir() ? bn('conferencia', ICON.check, 'Conferir', `<span class="bn-badge" id="bn-conf" hidden></span>`) : '',
    bn('notas', ICON.file, 'Notas'),
    `<button class="bn-item bn-cad" data-sheet="cadastros"><span class="bn-ic">${ICON.building}</span><span>Cadastros</span></button>`,
    pode.admin() ? bn('config', ICON.settings, 'Config') : '',
  ].filter(Boolean).join('');

  CTX.root.innerHTML = `
    <div class="an" data-collapsed="${collapsed?'true':'false'}">
      <aside class="an-side">
        <div class="brand">
          <img src="assets/logo-horizontal-white.png" alt="Maradel">
          <button class="brand-toggle" id="an-toggle" title="Retrair/expandir menu">${ICON.menu}</button>
        </div>
        <nav class="nav">${nav}</nav>
        <div class="user">
          <div class="ava">${initials(nome)}</div>
          <div style="min-width:0"><div class="nm">${esc(nome)}</div><div class="rl">${roleLabel(CTX.profile.role)}</div></div>
          <button id="an-logout" title="Sair" style="margin-left:auto;background:none;border:none;color:rgba(255,255,255,.5);cursor:pointer;width:20px;height:20px">${ICON.logout}</button>
        </div>
      </aside>
      <header class="an-topbar">
        <img src="assets/logo-horizontal-white.png" alt="Maradel">
        <div class="an-topbar-user">
          <span class="nm">${esc(nome.split(' ')[0])}</span>
          <button id="an-logout-m" class="ava" title="Sair">${ICON.logout}</button>
        </div>
      </header>
      <div class="an-main" id="an-main"></div>
      <nav class="an-bottomnav">${bottomNav}</nav>
    </div>`;
  const sair = async () => { await api.signOut(); location.reload(); };
  CTX.root.querySelector('#an-logout').onclick = sair;
  CTX.root.querySelector('#an-logout-m').onclick = sair;
  // Folha de Cadastros (mobile): Clientes / Tomadores / Equipe.
  CTX.root.querySelector('[data-sheet="cadastros"]').onclick = abrirFolhaCadastros;
  // Retrair/expandir a sidebar (desktop) e lembrar a preferência.
  CTX.root.querySelector('#an-toggle').onclick = () => {
    const an = CTX.root.querySelector('.an');
    const on = an.dataset.collapsed !== 'true';
    an.dataset.collapsed = on ? 'true' : 'false';
    localStorage.setItem('an_side_collapsed', on ? '1' : '0');
  };
  // Navegação lateral.
  CTX.root.querySelectorAll('[data-nav]').forEach(b => b.onclick = () => {
    const n = b.dataset.nav;
    if(n==='fila'){ CTX.status='solicitada'; showFila(); }
    else if(n==='conferencia'){ CTX.status='aguardando_conferencia'; showFila(); }
    else if(n==='notas'){ CTX.status='emitida'; showFila(); }
    else if(n==='clientes'){ showClientes(); }
    else if(n==='tomadores'){ showTomadores(); }
    else if(n==='equipe'){ showEquipe(); }
    else if(n==='config'){ showConfiguracoes(); }
  });
}

// Marca o item ativo na barra lateral e na barra inferior (mobile). O botão
// "Cadastros" da barra inferior acende quando se está em qualquer cadastro.
function setNav(nav){
  CTX.root.querySelectorAll('[data-nav]').forEach(b =>
    b.classList.toggle('active', b.dataset.nav===nav));
  const cad = CTX.root.querySelector('.bn-cad');
  if(cad) cad.classList.toggle('active', ['clientes','tomadores','equipe'].includes(nav));
}

// Folha inferior de Cadastros (mobile): atalhos para Clientes, Tomadores e,
// para o master, Equipe. Fecha ao tocar fora ou após escolher.
function abrirFolhaCadastros(){
  const opt = (nav, ico, label, sub) =>
    `<button class="sheet-item" data-go="${nav}"><span class="sheet-ic">${ico}</span>
       <span class="sheet-tx"><span class="t">${label}</span><span class="s">${sub}</span></span>${ICON.chevR}</button>`;
  const itens = [
    opt('clientes', ICON.users, 'Clientes', 'Prestadores de serviço'),
    opt('tomadores', ICON.building, 'Tomadores', 'Quem recebe a nota'),
    pode.master() ? opt('equipe', ICON.user, 'Equipe', 'Usuários internos') : '',
  ].filter(Boolean).join('');
  const ov = document.createElement('div');
  ov.className = 'sheet-overlay';
  ov.innerHTML = `<div class="sheet"><div class="sheet-grip"></div>
    <div class="sheet-title">Cadastros</div>${itens}</div>`;
  ov.addEventListener('click', e => { if(e.target === ov) ov.remove(); });
  document.body.appendChild(ov);
  ov.querySelectorAll('[data-go]').forEach(b => b.onclick = () => {
    const n = b.dataset.go; ov.remove();
    if(n==='clientes') showClientes();
    else if(n==='tomadores') showTomadores();
    else if(n==='equipe') showEquipe();
  });
}

// ---- FILA -------------------------------------------------------------------
async function showFila(){
  setNav(CTX.status==='emitida' ? 'notas' : CTX.status==='aguardando_conferencia' ? 'conferencia' : 'fila');
  main().innerHTML = `<div style="padding:60px"><div class="spinner"></div></div>`;
  const [cont, rows] = await Promise.all([
    api.contadoresPorStatus(),
    api.listSolicitacoesAnalista({ status:CTX.status, busca:CTX.busca })
  ]);
  const hoje = new Date().toLocaleDateString('pt-BR',{ weekday:'long', day:'2-digit', month:'long' });
  // Título conforme a fila aberta.
  const titulo = CTX.status==='aguardando_conferencia' ? 'Fila de conferência'
    : CTX.status==='emitida' ? 'Notas emitidas' : 'Fila de solicitações';
  // Resumo do dia: prioriza a conferência quando há itens aguardando.
  const conf = cont.aguardando_conferencia, pend = cont.solicitada;
  const day = conf ? `${conf} aguardando conferência` : (pend ? `${pend} aguardando ação` : 'tudo em dia');

  // Atualiza as bolhas do menu (sidebar desktop + barra inferior mobile):
  // Conferência (terracota, ação) e Fila (neutra) com o total aguardando.
  const setCnt = (sel, n) => CTX.root.querySelectorAll(sel).forEach(e => { e.textContent = n; e.hidden = !n; });
  setCnt('#nav-conf, #bn-conf', conf);
  setCnt('#nav-fila, #bn-fila', pend);

  main().innerHTML = `
    <div class="an-head">
      <div class="row1">
        <div>
          <h1>${titulo}</h1>
          <div class="day">${hoje.charAt(0).toUpperCase()+hoje.slice(1)} · ${day}</div>
        </div>
        <div class="an-search">${ICON.search}<input id="an-busca" placeholder="Buscar cliente, tomador ou CNPJ…" value="${esc(CTX.busca)}"></div>
      </div>
      <div class="an-tabs">
        ${tab('solicitada', cont.solicitada)}
        ${tab('em_emissao', cont.em_emissao)}
        ${pode.conferir() ? tab('aguardando_conferencia', cont.aguardando_conferencia) : ''}
        ${tab('emitida', cont.emitida)}
        ${tab('cancelada', cont.cancelada)}
      </div>
    </div>
    <div class="an-content">
      ${rows.length ? `
        <div class="tbl-head"><span>Cliente (prestador)</span><span>Tomador (recebe)</span><span>Serviço</span><span>Competência</span><span style="text-align:right">Valor</span><span style="text-align:right">Status</span></div>
        <div class="tbl tbl-fila">${rows.map(filaRow).join('')}</div>`
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
  // Rótulo curto para a aba de conferência (o nome completo é longo demais).
  const label = status==='aguardando_conferencia' ? 'Conferência' : STATUS_LABEL[status];
  return `<button class="an-tab ${active?'active':''}" data-tab="${status}"><span>${label}</span><span class="cnt">${n}</span></button>`;
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
      <div class="st" style="display:flex;justify-content:flex-end">${statusTag(s.status, temRessalva(s))}</div>
    </div>`;
}

function filaEmpty(status){
  if(status==='solicitada'){
    return `<div class="empty"><div class="ico" style="color:var(--st-emit-fg);border-radius:26px;width:104px;height:104px"><span style="width:48px;height:48px">${ICON.party}</span></div>
      <h3>Nenhuma solicitação pendente 🎉</h3>
      <p>Você zerou a fila. Novas solicitações aparecem aqui automaticamente.</p></div>`;
  }
  if(status==='aguardando_conferencia'){
    return `<div class="empty"><div class="ico" style="color:var(--st-emit-fg);border-radius:26px;width:104px;height:104px"><span style="width:48px;height:48px">${ICON.check}</span></div>
      <h3>Conferência em dia ✅</h3>
      <p>Nada aguardando liberação. Quando o auxiliar finalizar um preparo, ele aparece aqui.</p></div>`;
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
  const master = pode.master();
  const cols = master ? '2.2fr 1.6fr 1fr 1.8fr 60px' : '2.2fr 1.6fr 1fr 1.8fr';
  main().innerHTML = `
    <div class="an-head">
      <div class="row1">
        <div><h1>Clientes <span style="font-size:13px;font-weight:500;color:var(--mist)">· prestadores</span></h1><div class="day">${clientes.length} prestador(es) cadastrado(s)</div></div>
        <button class="btn btn-primary btn-sm" id="cl-novo">${ICON.plus}<span>Novo cliente</span></button>
      </div>
    </div>
    <div class="an-content">
      ${clientes.length ? `
        <div class="tbl-head" style="grid-template-columns:${cols}"><span>Razão social (prestador)</span><span>CNPJ</span><span>Regime</span><span>E-mail</span>${master?'<span></span>':''}</div>
        <div class="tbl">${clientes.map(c=>`
          <div class="tbl-row" style="grid-template-columns:${cols}" data-open-cli="${c.id}">
            <div class="cli-nm">${esc(c.razao_social)}</div>
            <div class="tom">${esc(c.cnpj)}</div>
            <div class="svc">${esc(c.regime||'—')}</div>
            <div class="svc">${esc(c.email||'—')}</div>
            ${master?`<div style="text-align:right"><button class="icon-danger" data-del-cli="${c.id}" data-nm="${esc(c.razao_social)}" title="Excluir cliente">${ICON.x}</button></div>`:''}
          </div>`).join('')}</div>`
        : `<div class="empty"><div class="ico"><span style="width:42px;height:42px">${ICON.users}</span></div>
            <h3>Nenhum cliente ainda</h3><p>Cadastre o primeiro prestador. Ele recebe um convite por e-mail para definir a senha.</p></div>`}
    </div>`;
  main().querySelector('#cl-novo').onclick = showNovoCliente;
  // Linha do cliente → abre o detalhe (dados + acesso à prefeitura).
  main().querySelectorAll('[data-open-cli]').forEach(r => r.onclick = () => showClienteDetalhe(r.dataset.openCli));
  // Exclusão de cliente é exclusiva do master (item 1) — RLS também bloqueia.
  main().querySelectorAll('[data-del-cli]').forEach(b => b.onclick = async (e) => {
    e.stopPropagation();  // não abrir o detalhe ao clicar em excluir
    if(!confirm(`Excluir o cliente "${b.dataset.nm}"? Esta ação remove o cadastro e não pode ser desfeita.`)) return;
    try{ await api.excluirCliente(b.dataset.delCli); toast('Cliente excluído'); showClientes(); }
    catch(e){ toast('Erro: '+e.message); }
  });
}

// ---- DETALHE DO CLIENTE (lado equipe) — dados + ACESSO À PREFEITURA ---------
// Admin (master/operacional) edita o acesso; analista vê a senha; auxiliar vê
// link/login mas não a senha. A senha trafega só sob demanda (RPC).
async function showClienteDetalhe(id){
  setNav('clientes');
  main().innerHTML = `<div style="padding:60px"><div class="spinner"></div></div>`;
  const [c, pref] = await Promise.all([
    api.getCliente(id),
    api.getClientePrefeitura(id).catch(()=>null),
  ]);
  const isAdmin = pode.admin();
  main().innerHTML = `
    <div class="det">
      <div class="det-head">
        <button class="back" id="cd-back">${ICON.back}</button>
        <div>
          <h1>${esc(c.razao_social)}</h1>
          <div class="sub" style="font-size:12.5px;color:var(--mist);margin-top:2px">Prestador · CNPJ ${esc(c.cnpj||'—')}</div>
        </div>
      </div>
      <div class="an-content" style="max-width:640px">
        <div class="cap">Dados do prestador</div>
        <div class="card" style="padding:2px 16px;margin-bottom:24px">
          <div class="kv"><span class="k">Razão social</span><span class="v">${esc(c.razao_social)}</span></div>
          <div class="kv"><span class="k">CNPJ</span><span class="v">${esc(c.cnpj||'—')}</span></div>
          <div class="kv"><span class="k">Regime</span><span class="v">${esc(c.regime||'—')}</span></div>
          <div class="kv"><span class="k">E-mail</span><span class="v">${esc(c.email||'—')}</span></div>
          <div class="kv"><span class="k">Endereço</span><span class="v">${esc(c.endereco||'—')}</span></div>
          <div class="kv"><span class="k">Telefone</span><span class="v">${esc(c.telefone||'—')}</span></div>
        </div>
        <div id="cd-pref"></div>
      </div>
    </div>`;
  main().querySelector('#cd-back').onclick = showClientes;
  // Seção de acesso à prefeitura: formulário (admin) ou somente leitura.
  const box = main().querySelector('#cd-pref');
  if(isAdmin) renderPrefeituraForm(box, id, pref);
  else        renderPrefeituraReadonly(box, id, pref, pode.conferir());
}

// Garante esquema https:// no link da prefeitura (evita abrir relativo).
function prefUrl(u){ u = String(u||'').trim(); return /^https?:\/\//i.test(u) ? u : 'https://'+u; }

// Formulário de acesso à prefeitura (admin master/operacional). Os campos de
// link/login/senha ficam SEMPRE visíveis; "emissão por procuração?" é só um
// indicador para o analista saber qual acesso usar (escritório x cliente).
function renderPrefeituraForm(box, clienteId, pref){
  const temSenha = !!pref?.tem_senha;
  box.innerHTML = `
    <div class="cap">Acesso à prefeitura <span style="text-transform:none;letter-spacing:0;color:var(--mist);font-weight:500">· editável por admin</span></div>
    <div class="card" style="padding:18px 18px 6px">
      <div class="field"><label>Link da prefeitura / portal de emissão</label>
        <input class="input" id="pf-link" value="${esc(pref?.link||'')}" placeholder="https://nfse.prefeitura.gov.br/..."></div>
      <div class="field"><label>Login / código de acesso</label>
        <input class="input" id="pf-login" value="${esc(pref?.login||'')}" placeholder="Usuário ou código de acesso"></div>
      <div class="field"><label>Senha da prefeitura</label>
        <input class="input" id="pf-senha" type="password" autocomplete="new-password" placeholder="${temSenha?'•••••••• (deixe em branco para manter)':'Defina a senha de acesso'}">
        <div style="font-size:12px;color:var(--mist);margin-top:6px">Guardada criptografada. Visível apenas para analista ou superior.${temSenha?' Em branco mantém a senha atual.':''}</div>
      </div>
      <div class="field">
        <label>Emissão por procuração?</label>
        ${toggle('pf-proc', 'Sim — a Maradel emite com o acesso do escritório', !!pref?.emissao_procuracao)}
        <div style="font-size:12px;color:var(--mist);margin-top:8px">Apenas informativo: indica ao analista qual acesso usar (escritório x cliente). Não altera os campos acima.</div>
      </div>
      <button class="btn btn-primary btn-block" id="pf-save" style="margin-bottom:18px">Salvar acesso</button>
    </div>`;
  bindToggle(box, 'pf-proc');
  box.querySelector('#pf-save').onclick = async () => {
    const link = box.querySelector('#pf-link').value.trim();
    const login = box.querySelector('#pf-login').value.trim();
    const senhaRaw = box.querySelector('#pf-senha').value;
    const procuracao = isToggleOn(box, 'pf-proc');
    // senha vazia => manter a atual (undefined); preenchida => trocar.
    const senha = senhaRaw ? senhaRaw : undefined;
    const btn = box.querySelector('#pf-save'); btn.disabled=true; btn.textContent='Salvando…';
    try{
      await api.setClientePrefeitura(clienteId, { link, login, senha, procuracao });
      toast('Acesso à prefeitura salvo');
      const novo = await api.getClientePrefeitura(clienteId).catch(()=>null);
      renderPrefeituraForm(box, clienteId, novo);
    }catch(e){ toast('Erro: '+e.message); btn.disabled=false; btn.textContent='Salvar acesso'; }
  };
}

// Acesso à prefeitura SOMENTE LEITURA (analista/auxiliar): link clicável, login
// para copiar e senha (revelar/copiar) só para analista+. Reutilizado também na
// tela de emissão. Devolve '' quando não há nada cadastrado.
function prefeituraAccessHTML(pref, canSeeSenha){
  if(!pref || (!pref.link && !pref.login && !pref.tem_senha && !pref.emissao_procuracao)) return '';
  const linkRow = pref.link ? `
    <div class="copyfield">
      <div style="min-width:0">
        <div class="cf-k">Portal da prefeitura</div>
        <div class="cf-v" style="font-size:13.5px;word-break:break-all">${esc(pref.link)}</div>
      </div>
      <div style="display:flex;gap:7px;flex:none">
        <a class="copy-btn" href="${esc(prefUrl(pref.link))}" target="_blank" rel="noopener">${ICON.link}<span>Abrir</span></a>
        <button class="copy-btn" data-copy="${esc(pref.link)}">${ICON.copy}<span>Copiar</span></button>
      </div>
    </div>` : '';
  const loginRow = pref.login ? copyRow('Login / código de acesso', esc(pref.login), pref.login) : '';
  const senhaRow = pref.tem_senha
    ? (canSeeSenha
        ? `<div class="copyfield" id="pref-senha-field">
             <div style="min-width:0">
               <div class="cf-k">Senha da prefeitura</div>
               <div class="cf-v" id="pref-senha-val" style="font-size:15px;letter-spacing:3px">••••••••</div>
             </div>
             <div style="display:flex;gap:7px;flex:none">
               <button class="copy-btn" id="pref-senha-show">${ICON.eye}<span>Mostrar</span></button>
               <button class="copy-btn hidden" id="pref-senha-copy">${ICON.copy}<span>Copiar</span></button>
             </div>
           </div>`
        : `<div class="aviso-ressalva">${ICON.lock}<span>Senha cadastrada — visível apenas para analista ou superior.</span></div>`)
    : '';
  const proc = `<div class="det-info-pill">${ICON.info}<span>Emissão por procuração: <strong>${pref.emissao_procuracao?'Sim — usar acesso do escritório':'Não — usar acesso do cliente'}</strong> <em>(informativo)</em></span></div>`;
  return `${linkRow}${loginRow}${senhaRow}${proc}`;
}

// Liga os botões de copiar/abrir e o "Mostrar senha" (busca a senha sob demanda).
function bindPrefeituraAccess(scope, clienteId){
  scope.querySelectorAll('[data-copy]').forEach(b => b.onclick = () => copyToClipboard(b.dataset.copy, b));
  const show = scope.querySelector('#pref-senha-show');
  if(show) show.onclick = async () => {
    show.disabled = true; show.innerHTML = '…';
    try{
      const senha = await api.getClientePrefeituraSenha(clienteId);
      const val = scope.querySelector('#pref-senha-val');
      val.textContent = senha || '—'; val.style.letterSpacing = '0';
      const copy = scope.querySelector('#pref-senha-copy');
      copy.classList.remove('hidden');
      copy.onclick = () => copyToClipboard(senha || '', copy);
      show.classList.add('hidden');
    }catch(e){ toast('Erro: '+e.message); show.disabled=false; show.innerHTML = `${ICON.eye}<span>Mostrar</span>`; }
  };
}

// Renderiza o acesso somente-leitura dentro de uma seção (tela de detalhe do cliente).
function renderPrefeituraReadonly(box, clienteId, pref, canSeeSenha){
  const inner = prefeituraAccessHTML(pref, canSeeSenha);
  box.innerHTML = `
    <div class="cap">Acesso à prefeitura</div>
    ${inner || `<div class="card" style="padding:14px 16px;font-size:13px;color:var(--taupe)">Nenhum dado de acesso cadastrado. Peça a um administrador para incluir.</div>`}`;
  if(inner) bindPrefeituraAccess(box, clienteId);
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
      ${pode.admin() ? `
      <div class="cap" style="margin-top:14px">Acesso à prefeitura <span style="text-transform:none;letter-spacing:0;color:var(--mist);font-weight:500">· opcional, pode ser preenchido depois</span></div>
      <div class="field"><label>Link da prefeitura / portal de emissão</label><input class="input" id="nc-pf-link" placeholder="https://nfse.prefeitura.gov.br/..."></div>
      <div class="form-grid">
        <div class="field"><label>Login / código de acesso</label><input class="input" id="nc-pf-login" placeholder="Usuário ou código"></div>
        <div class="field"><label>Senha da prefeitura</label><input class="input" id="nc-pf-senha" type="password" autocomplete="new-password" placeholder="Guardada criptografada"></div>
      </div>
      <div class="field">${toggle('nc-pf-proc', 'Emissão por procuração? (usar acesso do escritório)', false)}</div>
      ` : ''}
      <button class="btn btn-primary btn-block" id="nc-save" style="margin-top:8px">${ICON.send}<span>Salvar e enviar convite</span></button>
    </div>`;
  maskDocInput(main().querySelector('#nc-cnpj'));
  if(pode.admin()) bindToggle(main(), 'nc-pf-proc');
  main().querySelector('#nc-back').onclick = showClientes;
  main().querySelector('#nc-save').onclick = async () => {
    const g = id => main().querySelector(id).value.trim();
    const razao_social = g('#nc-razao'), cnpj = g('#nc-cnpj'), email = g('#nc-email');
    if(!razao_social || !cnpj) return toast('Preencha razão social e CNPJ');
    if(!/^[^@]+@[^@]+\.[^@]+$/.test(email)) return toast('Informe um e-mail válido');
    const btn = main().querySelector('#nc-save'); btn.disabled=true; btn.innerHTML='Enviando convite…';
    try{
      const res = await api.convidarCliente({ razao_social, cnpj, regime:g('#nc-regime'), endereco:g('#nc-end'), email,
        telefone:g('#nc-tel')||null, whatsapp_grupo:g('#nc-grupo')||null });
      // Acesso à prefeitura (admin): grava após o convite, já com o cliente criado.
      if(pode.admin()){
        const link = g('#nc-pf-link'), login = g('#nc-pf-login'), senha = main().querySelector('#nc-pf-senha').value;
        const proc = isToggleOn(main(), 'nc-pf-proc');
        if(link || login || senha || proc){
          try{
            const cli = res?.user_id ? await api.getClienteByUserId(res.user_id) : null;
            if(cli) await api.setClientePrefeitura(cli.id, { link, login, senha: senha || undefined, procuracao: proc });
          }catch(e){ toast('Cliente criado, mas o acesso à prefeitura falhou: '+e.message); }
        }
      }
      toast('Cliente cadastrado e convite enviado'); showClientes();
    }catch(e){ toast('Erro: '+e.message); btn.disabled=false; btn.innerHTML=`${ICON.send}<span>Salvar e enviar convite</span>`; }
  };
}

// ---- TOMADORES (cadastro pela equipe, vinculado a um prestador) -------------
// O escritório cadastra os tomadores e os vincula a um prestador (cliente). O
// mesmo tomador (ex.: Rappi) pode existir para vários prestadores — um registro
// por prestador. O vínculo aparece para o cliente na nova solicitação. A RLS
// (is_staff) já libera a equipe a gerenciar todos os tomadores; sem mudança de
// banco. Lista com busca; cada linha abre o cadastro para ver/editar.
let TOMS = []; // cache da última listagem (usado pela busca/edição)

async function showTomadores(){
  setNav('tomadores');
  main().innerHTML = `<div style="padding:60px"><div class="spinner"></div></div>`;
  const [toms, clientes] = await Promise.all([ api.listTomadoresComCliente(), api.listClientes() ]);
  TOMS = toms;
  const cols = '1.9fr 1.4fr 1.9fr 1.2fr 60px';
  const linha = t => `
    <div class="tbl-row" style="grid-template-columns:${cols}" data-open-tom="${t.id}">
      <div class="cli-nm">${esc(t.nome)}${t.exige_numero_pedido?` <span class="tom-flag" title="Exige número de pedido">nº pedido</span>`:''}</div>
      <div class="tom">${esc(t.doc||'—')}</div>
      <div class="svc">${esc(t.cliente?.razao_social||'— sem prestador')}</div>
      <div class="svc">${esc(t.cidade||'—')}${t.uf?'/'+esc(t.uf):''}</div>
      <div style="text-align:right"><button class="icon-danger" data-del-tom="${t.id}" data-nm="${esc(t.nome)}" title="Excluir tomador">${ICON.x}</button></div>
    </div>`;
  const tabela = lista => lista.length ? `
    <div class="tbl-head" style="grid-template-columns:${cols}"><span>Tomador (recebe)</span><span>CNPJ / CPF</span><span>Prestador (cliente)</span><span>Cidade</span><span></span></div>
    <div class="tbl">${lista.map(linha).join('')}</div>`
    : `<div class="empty-mini">Nenhum tomador encontrado.</div>`;

  main().innerHTML = `
    <div class="an-head">
      <div class="row1">
        <div><h1>Tomadores <span style="font-size:13px;font-weight:500;color:var(--mist)">· quem recebe a nota</span></h1>
          <div class="day">${toms.length} tomador(es) cadastrado(s)</div></div>
        <div style="display:flex;gap:10px;align-items:center">
          <div class="an-search">${ICON.search}<input id="tm-busca" placeholder="Buscar tomador, CNPJ ou prestador…"></div>
          <button class="btn btn-primary btn-sm" id="tm-novo"${clientes.length?'':' disabled title="Cadastre um cliente primeiro"'}>${ICON.plus}<span>Novo tomador</span></button>
        </div>
      </div>
    </div>
    <div class="an-content">
      ${toms.length ? `<div id="tm-list">${tabela(toms)}</div>`
        : `<div class="empty"><div class="ico"><span style="width:42px;height:42px">${ICON.building}</span></div>
            <h3>Nenhum tomador ainda</h3><p>Cadastre um tomador e vincule a um prestador. Ele passa a aparecer para o cliente ao criar uma solicitação.</p></div>`}
    </div>`;

  const bindRows = () => {
    main().querySelectorAll('[data-open-tom]').forEach(r => r.onclick = () =>
      showTomadorForm(TOMS.find(x=>x.id===r.dataset.openTom), clientes));
    main().querySelectorAll('[data-del-tom]').forEach(b => b.onclick = async (e) => {
      e.stopPropagation();
      if(!confirm(`Excluir o tomador "${b.dataset.nm}"? Esta ação não pode ser desfeita.`)) return;
      try{ await api.excluirTomador(b.dataset.delTom); toast('Tomador excluído'); showTomadores(); }
      catch(err){
        // FK on delete restrict: há solicitações usando este tomador.
        const fk = /violates foreign key|restrict/i.test(err.message||'');
        toast(fk ? 'Não dá para excluir: há solicitações usando este tomador.' : 'Erro: '+err.message);
      }
    });
  };
  const novo = main().querySelector('#tm-novo');
  if(novo && clientes.length) novo.onclick = () => showTomadorForm(null, clientes);
  bindRows();

  // Busca local por tomador (nome/doc/cidade) ou prestador (razão/CNPJ).
  const busca = main().querySelector('#tm-busca');
  if(busca) busca.oninput = () => {
    const b = busca.value.trim().toLowerCase();
    const filtrada = TOMS.filter(t =>
      (t.nome||'').toLowerCase().includes(b) ||
      (t.doc||'').toLowerCase().includes(b) ||
      (t.cidade||'').toLowerCase().includes(b) ||
      (t.cliente?.razao_social||'').toLowerCase().includes(b) ||
      (t.cliente?.cnpj||'').toLowerCase().includes(b));
    main().querySelector('#tm-list').innerHTML = tabela(filtrada);
    bindRows();
  };
}

// Formulário de tomador (equipe). Cria (tomador=null) ou edita. Ao criar, exige
// escolher o prestador; ao editar, o prestador fica fixo (trocar o dono de um
// tomador com solicitações geraria inconsistência).
function showTomadorForm(tomador, clientes){
  const editando = !!tomador;
  const t = tomador || {};
  const clienteId = t.cliente_id || (clientes[0]?.id || '');
  const prestadorNome = editando ? (t.cliente?.razao_social || '—') : '';
  const selOpt = (v, opt) => v===opt ? 'selected' : '';
  main().innerHTML = `
    <div class="det-head">
      <button class="back" id="nt-back">${ICON.back}</button>
      <div><h1>${editando?'Editar tomador':'Novo tomador'}</h1>
        <div class="sub" style="font-size:12.5px;color:var(--mist);margin-top:2px">${editando?'Tomador vinculado a um prestador.':'Vincule o tomador a um prestador (cliente).'}</div></div>
    </div>
    <div class="an-content" style="max-width:560px">
      <div class="field"><label>Prestador (cliente)${editando?'':' <span class="req">obrigatório</span>'}</label>
        ${editando
          ? `<input class="input" value="${esc(prestadorNome)}" disabled>`
          : `<select class="select" id="nt-cliente">${clientes.map(c=>`<option value="${c.id}" ${selOpt(clienteId,c.id)}>${esc(c.razao_social)}${c.cnpj?' — '+esc(c.cnpj):''}</option>`).join('')}</select>`}
      </div>
      <div class="form-grid">
        <div class="field"><label>Tipo</label>
          <select class="select" id="nt-tipo">
            <option value="PJ" ${selOpt(t.tipo,'PJ')}>Pessoa Jurídica (CNPJ)</option>
            <option value="PF" ${selOpt(t.tipo,'PF')}>Pessoa Física (CPF)</option>
          </select></div>
        <div class="field"><label>CNPJ / CPF</label><input class="input" id="nt-doc" inputmode="numeric" value="${esc(t.doc||'')}" placeholder="00.000.000/0000-00"></div>
      </div>
      <div class="field"><label>Razão social / Nome</label><input class="input" id="nt-nome" value="${esc(t.nome||'')}" placeholder="Nome do tomador"></div>
      <div class="field"><label>E-mail <span style="text-transform:none;letter-spacing:0;color:var(--mist)">opcional</span></label><input class="input" id="nt-email" type="email" value="${esc(t.email||'')}" placeholder="contato@tomador.com.br"></div>
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
  maskDocInput(main().querySelector('#nt-doc'));
  bindToggle(main(), 'nt-exige');
  main().querySelector('#nt-back').onclick = showTomadores;
  main().querySelector('#nt-save').onclick = async () => {
    const g = id => main().querySelector(id).value.trim();
    const nome = g('#nt-nome'), doc = g('#nt-doc');
    const cliente_id = editando ? t.cliente_id : main().querySelector('#nt-cliente')?.value;
    if(!cliente_id) return toast('Selecione o prestador');
    if(!nome || !doc) return toast('Preencha nome e documento');
    const campos = { tipo:g('#nt-tipo'), doc, nome, email:g('#nt-email')||null,
      endereco:g('#nt-end'), cidade:g('#nt-cid'), uf:g('#nt-uf'), cep:g('#nt-cep'),
      exige_numero_pedido: isToggleOn(main(), 'nt-exige') };
    const btn = main().querySelector('#nt-save'); btn.disabled=true; btn.textContent='Salvando…';
    try{
      if(editando) await api.atualizarTomador(t.id, campos);
      else         await api.criarTomador({ cliente_id, ...campos });
      toast(editando?'Tomador atualizado':'Tomador cadastrado'); showTomadores();
    }catch(e){ toast('Erro: '+e.message); btn.disabled=false; btn.textContent=editando?'Salvar alterações':'Salvar tomador'; }
  };
}

// ---- EQUIPE (gestão de usuários internos) — só master (item 3) -------------
async function showEquipe(){
  setNav('equipe');
  main().innerHTML = `<div style="padding:60px"><div class="spinner"></div></div>`;
  const equipe = await api.listEquipe();
  main().innerHTML = `
    <div class="an-head">
      <div class="row1">
        <div><h1>Equipe</h1><div class="day">${equipe.length} usuário(s) interno(s)</div></div>
        <button class="btn btn-primary btn-sm" id="eq-novo">${ICON.plus}<span>Novo usuário</span></button>
      </div>
    </div>
    <div class="an-content">
      <div class="tbl-head" style="grid-template-columns:2fr 2.4fr 1.6fr 70px"><span>Nome</span><span>E-mail</span><span>Papel</span><span></span></div>
      <div class="tbl">${equipe.map(u=>`
        <div class="tbl-row" style="grid-template-columns:2fr 2.4fr 1.6fr 70px;cursor:default">
          <div class="cli-nm">${esc(u.nome||'—')}</div>
          <div class="svc">${esc(u.email||'—')}</div>
          <div><span class="role-pill">${roleLabel(u.role)}</span></div>
          <div style="text-align:right">${(u.role!=='admin_master' && u.id!==CTX.profile.id)
            ? `<button class="icon-danger" data-del="${u.id}" data-nm="${esc(u.nome||u.email||'')}" title="Remover usuário">${ICON.x}</button>` : ''}</div>
        </div>`).join('')}</div>
    </div>`;
  main().querySelector('#eq-novo').onclick = showNovoUsuario;
  main().querySelectorAll('[data-del]').forEach(b => b.onclick = async () => {
    if(!confirm(`Remover ${b.dataset.nm} da equipe? Esta ação não pode ser desfeita.`)) return;
    try{ await api.removerUsuarioEquipe(b.dataset.del); toast('Usuário removido'); showEquipe(); }
    catch(e){ toast('Erro: '+e.message); }
  });
}

// Formulário de convite de usuário interno (nome + e-mail + papel).
function showNovoUsuario(){
  main().innerHTML = `
    <div class="det-head">
      <button class="back" id="nu-back">${ICON.back}</button>
      <div><h1>Novo usuário</h1>
        <div class="sub" style="font-size:12.5px;color:var(--mist);margin-top:2px">A pessoa recebe um convite por e-mail e define a própria senha.</div></div>
    </div>
    <div class="an-content" style="max-width:520px">
      <div class="field"><label>Nome</label><input class="input" id="nu-nome" placeholder="Nome completo"></div>
      <div class="field"><label>E-mail</label><input class="input" id="nu-email" type="email" placeholder="pessoa@maradelcontabil.com"></div>
      <div class="field"><label>Papel</label>
        <select class="select" id="nu-role">
          <option value="auxiliar">Auxiliar — prepara o trabalho (vai para conferência)</option>
          <option value="analista">Analista fiscal — emite e confere</option>
          <option value="admin_operacional">Admin operacional — gerencia o dia a dia</option>
        </select>
      </div>
      <button class="btn btn-primary btn-block" id="nu-save" style="margin-top:8px">${ICON.send}<span>Salvar e enviar convite</span></button>
    </div>`;
  main().querySelector('#nu-back').onclick = showEquipe;
  main().querySelector('#nu-save').onclick = async () => {
    const nome = main().querySelector('#nu-nome').value.trim();
    const email = main().querySelector('#nu-email').value.trim();
    const role = main().querySelector('#nu-role').value;
    if(!nome) return toast('Informe o nome');
    if(!/^[^@]+@[^@]+\.[^@]+$/.test(email)) return toast('Informe um e-mail válido');
    const btn = main().querySelector('#nu-save'); btn.disabled=true; btn.innerHTML='Enviando convite…';
    try{
      await api.convidarUsuarioEquipe({ nome, email, role });
      toast('Usuário convidado'); showEquipe();
    }catch(e){ toast('Erro: '+e.message); btn.disabled=false; btn.innerHTML=`${ICON.send}<span>Salvar e enviar convite</span>`; }
  };
}

// ---- CONFIGURAÇÕES — contato de atendimento (admin, item 5) ----------------
// Formata dígitos do WhatsApp para exibição amigável e normaliza para salvar.
function fmtWpp(d){
  d = String(d||'').replace(/\D/g,'').replace(/^55/,'');
  if(d.length===11) return `(${d.slice(0,2)}) ${d.slice(2,7)}-${d.slice(7)}`;
  if(d.length===10) return `(${d.slice(0,2)}) ${d.slice(2,6)}-${d.slice(6)}`;
  return d;
}
function wppDigits(v){ let d = String(v||'').replace(/\D/g,''); if(d && !d.startsWith('55')) d = '55'+d; return d; }

async function showConfiguracoes(){
  setNav('config');
  main().innerHTML = `<div style="padding:60px"><div class="spinner"></div></div>`;
  const cfg = (await api.getConfigAtendimento()) || {};
  main().innerHTML = `
    <div class="an-head"><div class="row1">
      <div><h1>Configurações</h1><div class="day">Contato de atendimento exibido aos clientes</div></div>
    </div></div>
    <div class="an-content" style="max-width:520px">
      <div class="card" style="padding:12px 16px;display:flex;gap:9px;align-items:flex-start;margin-bottom:18px">
        <span style="color:var(--taupe);width:17px;flex:none">${ICON.info}</span>
        <span style="font-size:12.5px;color:var(--taupe);line-height:1.5">Estes dados aparecem para o cliente em "Precisa de ajuda?". O WhatsApp vira um link que abre a conversa.</span>
      </div>
      <div class="field"><label>Nome do atendimento</label><input class="input" id="cf-nome" value="${esc(cfg.nome||'')}" placeholder="Ex.: Gabriela"></div>
      <div class="field"><label>WhatsApp</label><input class="input" id="cf-wpp" inputmode="tel" value="${esc(fmtWpp(cfg.whatsapp))}" placeholder="(11) 94272-2105"></div>
      <div class="field"><label>E-mail</label><input class="input" id="cf-email" type="email" value="${esc(cfg.email||'')}" placeholder="atendimento@maradelcontabil.com"></div>
      <button class="btn btn-primary btn-block" id="cf-save" style="margin-top:8px">Salvar contato</button>
    </div>`;
  main().querySelector('#cf-save').onclick = async () => {
    const nome = main().querySelector('#cf-nome').value.trim() || null;
    const whatsapp = wppDigits(main().querySelector('#cf-wpp').value) || null;
    const email = main().querySelector('#cf-email').value.trim() || null;
    const btn = main().querySelector('#cf-save'); btn.disabled=true; btn.textContent='Salvando…';
    try{ await api.atualizarConfigAtendimento({ nome, whatsapp, email }); toast('Contato de atendimento atualizado'); }
    catch(e){ toast('Erro: '+e.message); }
    btn.disabled=false; btn.textContent='Salvar contato';
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
  // Acesso à prefeitura do prestador — exibido de forma prática para o analista
  // já abrir o portal com o acesso em mãos (Parte 3).
  const pref = await api.getClientePrefeitura(s.cliente_id).catch(()=>null);

  // Bloqueio do número de pedido (item B): se o tomador exige e está vazio,
  // a emissão fica travada. O <input> abaixo destrava ao preencher; o banco
  // (trigger) é a guarda real, este é o aviso/bloqueio visual que a acompanha.
  const exigePedido = !!s.tomador?.exige_numero_pedido;
  const pedidoVazio = !String(s.numero_pedido||'').trim();

  // Ações conforme o papel (fluxo de conferência, item 2):
  //  - auxiliar: "Enviar para conferência" (não emite, não envia ao cliente);
  //  - analista+: "Marcar como emitida" no fluxo normal; na fila de conferência,
  //    "Aprovar e liberar" / "Devolver ao auxiliar".
  const emConferencia = s.status === 'aguardando_conferencia';
  const conf = pode.conferir();
  const aux  = pode.auxiliar();
  const podeEnviarCliente = emitida && conf;          // auxiliar nunca envia ao cliente
  const tituloPainel = aux ? 'Preparar emissão' : 'Registrar emissão';
  let acoesHTML;
  if(emitida){
    acoesHTML = conf
      ? `<button class="btn btn-primary btn-block dt-finalize" id="dt-emitir">${ICON.check}<span>Atualizar emissão</span></button>`
      : `<div class="aviso-ressalva" style="background:var(--st-emit-bg);border-color:rgba(74,124,89,.4);color:var(--st-emit-fg)">${ICON.check}<span>Nota emitida.</span></div>`;
  } else if(emConferencia){
    acoesHTML = conf
      ? `<button class="btn btn-primary btn-block dt-finalize" id="dt-aprovar">${ICON.check}<span>Aprovar e liberar</span></button>
         <button class="btn btn-outline btn-block" id="dt-devolver">${ICON.back}<span>Devolver ao auxiliar</span></button>`
      : `<div class="aviso-ressalva">${ICON.info}<span>Enviado para conferência. Aguarde a liberação de um analista.</span></div>`;
  } else {
    acoesHTML = aux
      ? `<button class="btn btn-primary btn-block dt-finalize" id="dt-conferir">${ICON.send}<span>Enviar para conferência</span></button>`
      : `<button class="btn btn-primary btn-block dt-finalize" id="dt-emitir">${ICON.check}<span>Marcar como emitida</span></button>`;
  }

  main().innerHTML = `
    <div class="det">
      <div class="det-head">
        <button class="back" id="dt-back">${ICON.back}</button>
        <div>
          <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap"><h1>${esc(s.cliente?.razao_social||'Cliente')}</h1>${statusTag(s.status, exigePedido&&pedidoVazio&&!emitida)}</div>
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
            <span style="font-size:12.5px;color:var(--taupe)">Prestador (cliente): <strong style="color:var(--chumbo)">${esc(s.cliente?.razao_social||'—')}</strong> · CNPJ ${esc(s.cliente?.cnpj||'—')}</span>
          </div>
          <div id="dt-pref" style="margin-top:18px"></div>
          <div id="dt-interno" style="margin-top:18px"></div>
          <div id="dt-historico" style="margin-top:18px"></div>
        </div>
        <div class="det-right">
          <div><div style="font-size:16px;font-weight:600">${tituloPainel}</div>
            <div style="font-size:12.5px;color:var(--taupe);margin-top:3px;line-height:1.5">${aux?'Prepare os dados, cole o número e suba os arquivos. Ao finalizar, vai para conferência.':'Emita no portal, cole o número e suba os arquivos.'}</div></div>
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
            ${acoesHTML}
            ${podeEnviarCliente?`<div class="btn-row"><button class="btn btn-ghost" id="dt-email">${ICON.mail}<span>E-mail</span></button><button class="btn btn-ghost" id="dt-whats">${ICON.whatsapp}<span>WhatsApp</span></button></div>`:''}
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

  // Bloqueio dinâmico: trava os botões de finalização (emitir / enviar para
  // conferência / aprovar) enquanto o número de pedido obrigatório está vazio.
  const inpPedido = main().querySelector('#dt-pedido');
  const aviso = main().querySelector('#dt-bloqueio');
  function syncBloqueio(){
    const bloq = exigePedido && !inpPedido.value.trim();
    aviso.classList.toggle('hidden', !bloq);
    main().querySelectorAll('.dt-finalize').forEach(b => {
      b.disabled = bloq; b.title = bloq ? 'Preencha o número de pedido para liberar' : '';
    });
  }
  inpPedido.oninput = syncBloqueio;
  syncBloqueio();

  // Ações por papel (cada botão só existe conforme o papel/estado).
  const onFin = (modo) => () => finalizar(s, modo, nota);
  main().querySelector('#dt-emitir')?.addEventListener('click', onFin('emitir'));
  main().querySelector('#dt-conferir')?.addEventListener('click', onFin('conferir'));
  main().querySelector('#dt-aprovar')?.addEventListener('click', onFin('aprovar'));
  main().querySelector('#dt-devolver')?.addEventListener('click', () => devolver(s));

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

  // acesso à prefeitura (link clicável + login/senha para copiar) — Parte 3
  const prefBox = main().querySelector('#dt-pref');
  if(prefBox){
    const prefHTML = prefeituraAccessHTML(pref, pode.conferir());
    if(prefHTML){
      prefBox.innerHTML = `<div class="cap" style="margin-bottom:8px">Acesso à prefeitura · para emitir</div>${prefHTML}`;
      bindPrefeituraAccess(prefBox, s.cliente_id);
    } else if(pode.admin()){
      prefBox.innerHTML = `<div class="cap" style="margin-bottom:8px">Acesso à prefeitura</div>
        <div style="font-size:12.5px;color:var(--mist)">Sem dados de acesso cadastrados. Inclua em <strong>Clientes › ${esc(s.cliente?.razao_social||'')}</strong>.</div>`;
    }
  }

  // controle interno (quem preparou/conferiu) — só a equipe vê (item 4)
  carregarInterno(s.id);
  // histórico (envios + aberturas) — carrega assíncrono
  if(nota) carregarHistorico(nota.id);
}

// Carrega o rastreamento interno (executou/conferiu) — visível só para a equipe.
async function carregarInterno(solicitacaoId){
  const box = main().querySelector('#dt-interno');
  if(!box) return;
  let it = null;
  try{ it = await api.getInterno(solicitacaoId); }catch{}
  if(!it || (!it.preparada_por_nome && !it.conferida_por_nome && !it.observacao)){ box.innerHTML = ''; return; }
  const linha = (k, nome, em) => nome
    ? `<div class="kv"><span class="k">${k}</span><span class="v">${esc(nome)}${em?' · '+fmtDateTime(em):''}</span></div>` : '';
  box.innerHTML = `
    <div class="cap" style="margin-bottom:8px">Controle interno · só a equipe vê</div>
    <div class="card" style="padding:2px 14px">
      ${linha('Executou (preparou)', it.preparada_por_nome, it.preparada_em)}
      ${linha('Conferiu / liberou', it.conferida_por_nome, it.conferida_em)}
      ${it.observacao?`<div class="kv"><span class="k">Observação</span><span class="v" style="color:var(--terracota-dark)">${esc(it.observacao)}</span></div>`:''}
    </div>`;
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

// Finaliza o trabalho conforme o papel/ação (item 2):
//   modo 'conferir' (auxiliar) → envia para a fila de conferência;
//   modo 'emitir'   (analista+) → emite direto (executou=conferiu=ele);
//   modo 'aprovar'  (analista+) → libera um item da fila de conferência.
// Salva o número de pedido (item B) e sobe arquivos novos, preservando os já
// anexados no preparo. O bloqueio do pedido tem dupla guarda: aqui e no banco.
async function finalizar(s, modo, nota){
  const numero = main().querySelector('#dt-num').value.trim();
  const pedido = main().querySelector('#dt-pedido').value.trim();
  if(s.tomador?.exige_numero_pedido && !pedido) return toast('Número de pedido obrigatório para este tomador');
  if(!numero) return toast('Informe o número da nota');
  const btn = main().querySelector('.dt-finalize'); if(btn){ btn.disabled = true; btn.innerHTML = 'Processando…'; }
  const nome = CTX.profile.nome || null;
  try{
    if(pedido !== String(s.numero_pedido||'').trim()) await api.setNumeroPedido(s.id, pedido || null);
    // Mantém o arquivo já anexado se nenhum novo foi escolhido.
    const pdfPath = DET.pdf ? await api.uploadArquivo(s.cliente_id, s.id, DET.pdf, 'pdf') : (nota?.pdf_url || null);
    const xmlPath = DET.xml ? await api.uploadArquivo(s.cliente_id, s.id, DET.xml, 'xml') : (nota?.xml_url || null);
    if(modo === 'conferir'){
      await api.enviarParaConferencia({ solicitacaoId:s.id, numero, pdfPath, xmlPath, nome });
      toast('Enviado para conferência'); CTX.status = 'aguardando_conferencia';
    } else if(modo === 'aprovar'){
      await api.salvarNota({ solicitacaoId:s.id, numero, pdfPath, xmlPath });
      await api.aprovarConferencia({ solicitacaoId:s.id, nome });
      toast('Conferência aprovada — nota liberada'); CTX.status = 'emitida';
    } else {
      await api.emitirNota({ solicitacaoId:s.id, numero, pdfPath, xmlPath, nome });
      toast('Nota marcada como emitida'); CTX.status = 'solicitada';
    }
    showFila();
  }catch(e){ toast('Erro: '+e.message); if(btn){ btn.disabled=false; btn.innerHTML = `${ICON.check}<span>Tentar novamente</span>`; } }
}

// ANALISTA+: devolve um item da conferência ao auxiliar, com observação.
function devolver(s){
  const m = openModal(`
    <div class="modal-head"><h3>Devolver ao auxiliar</h3>
      <button class="modal-x" id="dv-x">${ICON.x}</button></div>
    <p class="modal-sub">A solicitação volta para ajustes. Descreva o que precisa ser corrigido.</p>
    <div class="field" style="margin-top:14px"><label>Observação</label>
      <textarea class="textarea" id="dv-obs" placeholder="Ex.: número da nota divergente, anexar XML…"></textarea></div>
    <div class="modal-actions">
      <button class="btn btn-primary btn-block" id="dv-ok">Devolver com observação</button>
      <button class="btn btn-outline btn-block" id="dv-no">Voltar</button>
    </div>`);
  m.querySelector('#dv-x').onclick = closeModal;
  m.querySelector('#dv-no').onclick = closeModal;
  m.querySelector('#dv-ok').onclick = async () => {
    const observacao = m.querySelector('#dv-obs').value.trim();
    if(!observacao) return toast('Escreva a observação para o auxiliar');
    const b = m.querySelector('#dv-ok'); b.disabled=true; b.textContent='Devolvendo…';
    try{
      await api.devolverConferencia({ solicitacaoId:s.id, observacao, nome: CTX.profile.nome || null });
      closeModal(); toast('Devolvido ao auxiliar'); CTX.status='aguardando_conferencia'; showFila();
    }catch(e){ toast('Erro: '+e.message); b.disabled=false; b.textContent='Devolver com observação'; }
  };
}
