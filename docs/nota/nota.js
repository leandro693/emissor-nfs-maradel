// ============================================================
//  nota.js — página PÚBLICA de visualização da nota (item D)
//  Sem login. Lê o token da URL (?t=maradel-...), chama a Edge
//  Function 'nota-publica' (service_role, no servidor) e mostra
//  só os dados daquela nota + botões de PDF/XML. Nenhuma outra
//  informação do banco é acessível a partir desta página.
// ============================================================
import { supabase } from '../js/supabaseClient.js';

const root = document.getElementById('nota-app');

// ---- helpers locais (a página é independente do app principal) --------------
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' }[c]));
const brl = n => (Number(n) || 0).toLocaleString('pt-BR', { style:'currency', currency:'BRL' });
const MESES = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];
function fmtCompetencia(ym){
  if(!ym) return '—';
  const [y,m] = String(ym).split('-');
  const nome = MESES[Number(m)-1] || '';
  return `${nome.charAt(0).toUpperCase()+nome.slice(1)}/${y}`;
}
function fmtDate(iso){ if(!iso) return '—'; return new Date(iso).toLocaleDateString('pt-BR'); }

const ICON = {
  download: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>',
  check:    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>',
  clock:    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>',
};

// Lê o token da query string (?t=...). Aceita também o hash como alternativa.
function lerToken(){
  const q = new URLSearchParams(window.location.search);
  const t = q.get('t') || q.get('token');
  if(t) return t.trim();
  const h = window.location.hash.replace(/^#/, '').trim();
  return h || '';
}

// Tela de erro/estado vazio reutilizável.
function telaInfo(icon, titulo, texto){
  root.innerHTML = `
    <div class="nota-pub">
      <header class="nota-pub-top">
        <img src="../assets/logo-horizontal-white.png" alt="Maradel">
      </header>
      <main class="nota-pub-body">
        <div class="empty" style="padding:64px 28px">
          <div class="ico"><span style="width:42px;height:42px">${icon}</span></div>
          <h3>${esc(titulo)}</h3>
          <p>${esc(texto)}</p>
        </div>
      </main>
      <footer class="nota-pub-foot">Maradel Contábil · documento fiscal eletrônico</footer>
    </div>`;
}

// Renderiza a nota com seus dados e os botões de download.
function renderNota(n){
  const linhas = [
    ['Prestador', esc(n.prestador?.razao_social || '—')],
    ['CNPJ do prestador', esc(n.prestador?.cnpj || '—')],
    ['Tomador', esc(n.tomador?.nome || '—')],
    ['Documento do tomador', esc(n.tomador?.doc || '—')],
    ['Competência', fmtCompetencia(n.competencia)],
    ['Emissão', fmtDate(n.data_emissao)],
    ['Descrição do serviço', esc(n.descricao || '—')],
  ];
  root.innerHTML = `
    <div class="nota-pub">
      <header class="nota-pub-top">
        <img src="../assets/logo-horizontal-white.png" alt="Maradel">
      </header>
      <main class="nota-pub-body">
        <div class="nota-pub-card card">
          <div class="nota-pub-head">
            <div>
              <div class="fat-label">Nota Fiscal de Serviço</div>
              <div class="nota-pub-num">nº ${esc(n.numero || '—')}</div>
            </div>
            <div class="nota-pub-valor">
              <div class="fat-label">Valor</div>
              <div class="v">${brl(n.valor)}</div>
            </div>
          </div>
          <div class="nota-pub-kvs">
            ${linhas.map(([k,v]) => `<div class="kv"><span class="k">${k}</span><span class="v">${v}</span></div>`).join('')}
          </div>
          <div class="nota-pub-actions">
            <button class="btn btn-primary" id="dl-pdf" ${n.pdf_url ? '' : 'disabled'}>${ICON.download}<span>Baixar PDF</span></button>
            <button class="btn btn-outline" id="dl-xml" ${n.xml_url ? '' : 'disabled'}>${ICON.download}<span>Baixar XML</span></button>
          </div>
        </div>
        <p class="nota-pub-aviso">Este link é pessoal e expira automaticamente. Em caso de dúvidas, fale com a Maradel Contábil.</p>
      </main>
      <footer class="nota-pub-foot">Maradel Contábil · documento fiscal eletrônico</footer>
    </div>`;

  const abrir = url => { if(url) window.open(url, '_blank'); };
  const bp = root.querySelector('#dl-pdf'); if(n.pdf_url) bp.onclick = () => abrir(n.pdf_url);
  const bx = root.querySelector('#dl-xml'); if(n.xml_url) bx.onclick = () => abrir(n.xml_url);
}

// ---- bootstrap --------------------------------------------------------------
async function init(){
  const token = lerToken();
  if(!token){
    return telaInfo(ICON.clock, 'Link inválido', 'Não encontramos um identificador de nota nesta página. Verifique o link recebido.');
  }
  try{
    // A Edge Function valida o token, registra a abertura e devolve os dados
    // + URLs assinadas. verify_jwt está desligado nela (página sem login).
    const { data, error } = await supabase.functions.invoke('nota-publica', { body: { token } });
    if(error){
      // Erros de regra de negócio vêm no corpo (410 = expirado, 404 = não achou).
      let body = null;
      try { body = await error.context?.json(); } catch {}
      if(body?.error === 'expirado'){
        return telaInfo(ICON.clock, 'Link expirado',
          'O prazo de visualização desta nota (90 dias) terminou. Solicite um novo link à Maradel ou ao prestador.');
      }
      return telaInfo(ICON.clock, 'Nota indisponível', 'Não foi possível abrir esta nota. O link pode estar incorreto ou ter sido substituído.');
    }
    if(data?.error === 'expirado'){
      return telaInfo(ICON.clock, 'Link expirado',
        'O prazo de visualização desta nota (90 dias) terminou. Solicite um novo link à Maradel ou ao prestador.');
    }
    if(!data || data.error){
      return telaInfo(ICON.clock, 'Nota indisponível', 'Não foi possível abrir esta nota. O link pode estar incorreto ou ter sido substituído.');
    }
    renderNota(data);
  }catch(e){
    telaInfo(ICON.clock, 'Erro ao carregar', 'Tente novamente em instantes.');
  }
}
init();
