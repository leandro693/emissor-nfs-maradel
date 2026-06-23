// ============================================================
//  app.js — bootstrap: sessão, login (e-mail + senha) e
//  roteamento por papel (cliente vs analista). Ponto de entrada.
//  Também trata convite (definir senha no 1º acesso) e
//  recuperação de senha ("Esqueci minha senha").
// ============================================================
import { supabase } from './supabaseClient.js';
import * as api from './api.js';
import { ICON, esc, toast } from './ui.js';
import { mountCliente } from './client.js';
import { mountAnalista } from './analyst.js';

const root = document.getElementById('app');

// Tipo do link de retorno capturado da URL (#...type=invite|recovery), lido
// cedo porque o Supabase consome o hash logo após carregar.
const urlType = new URLSearchParams(window.location.hash.replace(/^#/,'')).get('type');
let aguardandoSenha = (urlType === 'invite' || urlType === 'recovery');

// Renderiza um spinner de carregamento de tela cheia.
function loading(msg='Carregando…'){
  root.innerHTML = `<div class="center-screen"><div class="spinner"></div><div style="color:var(--taupe);font-size:14px">${msg}</div></div>`;
}

// ---- LOGIN (e-mail + senha) -------------------------------------------------
function renderLogin(){
  aguardandoSenha = false;
  root.innerHTML = `
    <div class="auth-wrap"><div class="auth-card">
      <img class="logo" src="assets/logo-horizontal-dark.png" alt="Maradel">
      <h1>Acesse sua conta</h1>
      <p class="sub">Entre com seu e-mail e senha. O acesso é criado pela Maradel.</p>
      <div style="margin-top:30px">
        <div class="field"><label>E-mail</label>
          <div style="position:relative">
            <span style="position:absolute;left:14px;top:50%;transform:translateY(-50%);color:var(--mist);width:18px">${ICON.mail}</span>
            <input class="input" id="lg-email" type="email" placeholder="voce@empresa.com.br" style="padding-left:42px" autocomplete="email">
          </div>
        </div>
        <div class="field"><label>Senha</label>
          <div style="position:relative">
            <span style="position:absolute;left:14px;top:50%;transform:translateY(-50%);color:var(--mist);width:18px">${ICON.lock}</span>
            <input class="input" id="lg-senha" type="password" placeholder="Sua senha" style="padding-left:42px" autocomplete="current-password">
          </div>
        </div>
        <button class="btn btn-primary btn-block" id="lg-send">Entrar</button>
        <button class="link-danger" id="lg-forgot" style="display:block;margin:14px auto 0;color:var(--taupe)">Esqueci minha senha</button>
      </div>
      <div class="auth-foot"><span style="width:14px">${ICON.lock}</span><span>Conexão protegida · Maradel Contábil</span></div>
    </div></div>`;

  const send = document.getElementById('lg-send');
  const email = document.getElementById('lg-email');
  const senha = document.getElementById('lg-senha');
  senha.onkeydown = e => { if(e.key==='Enter') send.click(); };
  send.onclick = async () => {
    const e = email.value.trim(), s = senha.value;
    if(!/^[^@]+@[^@]+\.[^@]+$/.test(e)) return toast('Informe um e-mail válido');
    if(!s) return toast('Informe sua senha');
    send.disabled = true; send.textContent = 'Entrando…';
    const { error } = await api.entrarComSenha(e, s);
    if(error){ toast('E-mail ou senha inválidos'); send.disabled=false; send.textContent='Entrar'; return; }
    // onAuthStateChange (SIGNED_IN) cuida do roteamento.
  };
  document.getElementById('lg-forgot').onclick = renderEsqueciSenha;
}

// ---- ESQUECI MINHA SENHA ----------------------------------------------------
function renderEsqueciSenha(){
  root.innerHTML = `
    <div class="auth-wrap"><div class="auth-card">
      <img class="logo" src="assets/logo-horizontal-dark.png" alt="Maradel">
      <h1>Recuperar senha</h1>
      <p class="sub">Informe seu e-mail. Enviaremos um link para você definir uma nova senha.</p>
      <div style="margin-top:28px">
        <div class="field"><label>E-mail</label>
          <input class="input" id="rc-email" type="email" placeholder="voce@empresa.com.br" autocomplete="email"></div>
        <button class="btn btn-primary btn-block" id="rc-send">Enviar link</button>
        <button class="link-danger" id="rc-voltar" style="display:block;margin:14px auto 0;color:var(--taupe)">Voltar ao login</button>
      </div>
    </div></div>`;
  document.getElementById('rc-voltar').onclick = renderLogin;
  const send = document.getElementById('rc-send');
  const email = document.getElementById('rc-email');
  send.onclick = async () => {
    const e = email.value.trim();
    if(!/^[^@]+@[^@]+\.[^@]+$/.test(e)) return toast('Informe um e-mail válido');
    send.disabled = true; send.textContent = 'Enviando…';
    const { error } = await api.recuperarSenha(e);
    if(error){ toast('Erro: '+error.message); send.disabled=false; send.textContent='Enviar link'; return; }
    renderEmailEnviado(e);
  };
}

// Confirmação após enviar o link de recuperação.
function renderEmailEnviado(emailVal){
  root.innerHTML = `
    <div class="auth-wrap"><div class="auth-card" style="text-align:center">
      <div style="width:80px;height:80px;border-radius:50%;background:var(--terracota-subtle);display:flex;align-items:center;justify-content:center;margin:0 auto 24px">
        <span style="color:var(--terracota);width:36px;height:36px">${ICON.mail}</span>
      </div>
      <h1>Verifique seu e-mail</h1>
      <p class="sub">Enviamos um link para<br><strong style="color:var(--grafite)">${esc(emailVal)}</strong>. Abra-o para definir sua senha.</p>
      <button class="btn btn-outline btn-block" id="lg-voltar" style="margin-top:28px">Voltar ao login</button>
    </div></div>`;
  document.getElementById('lg-voltar').onclick = renderLogin;
}

// ---- DEFINIR SENHA (convite 1º acesso / recuperação) ------------------------
function renderDefinirSenha(){
  const primeiro = (urlType === 'invite');
  root.innerHTML = `
    <div class="auth-wrap"><div class="auth-card">
      <img class="logo" src="assets/logo-horizontal-dark.png" alt="Maradel">
      <h1>${primeiro ? 'Bem-vindo à Maradel' : 'Definir nova senha'}</h1>
      <p class="sub">${primeiro ? 'Crie uma senha para acessar o portal de notas.' : 'Escolha uma nova senha para sua conta.'}</p>
      <div style="margin-top:28px">
        <div class="field"><label>Nova senha</label>
          <input class="input" id="ds-s1" type="password" placeholder="Mínimo 6 caracteres" autocomplete="new-password"></div>
        <div class="field"><label>Confirmar senha</label>
          <input class="input" id="ds-s2" type="password" placeholder="Repita a senha" autocomplete="new-password"></div>
        <button class="btn btn-primary btn-block" id="ds-save">Salvar senha e entrar</button>
      </div>
    </div></div>`;
  const save = document.getElementById('ds-save');
  save.onclick = async () => {
    const s1 = document.getElementById('ds-s1').value, s2 = document.getElementById('ds-s2').value;
    if(s1.length < 6) return toast('A senha precisa de ao menos 6 caracteres');
    if(s1 !== s2)     return toast('As senhas não coincidem');
    save.disabled = true; save.textContent = 'Salvando…';
    try{
      await api.definirSenha(s1);
      aguardandoSenha = false;
      history.replaceState(null, '', window.location.pathname); // limpa o hash do link
      toast('Senha definida!');
      const session = await api.getSession();
      routeBySession(session);
    }catch(e){ toast('Erro: '+e.message); save.disabled=false; save.textContent='Salvar senha e entrar'; }
  };
}

// ---- ROTEAMENTO POR PAPEL ---------------------------------------------------
async function routeBySession(session){
  if(!session){ renderLogin(); return; }
  if(aguardandoSenha){ renderDefinirSenha(); return; }
  loading('Entrando…');
  try{
    const profile = await api.getProfile();
    if(profile.role === 'analista') await mountAnalista(root, profile);
    else                            await mountCliente(root, profile);
  }catch(e){
    // Profile pode levar 1 instante para ser criado pelo trigger; tenta de novo.
    console.error(e);
    root.innerHTML = `<div class="center-screen"><div style="color:var(--taupe)">Não foi possível carregar seu perfil.</div>
      <button class="btn btn-outline" onclick="location.reload()">Tentar novamente</button></div>`;
  }
}

// ---- INIT -------------------------------------------------------------------
async function init(){
  loading();
  // Reage a login/logout, convite e recuperação de senha.
  supabase.auth.onAuthStateChange((event, sess) => {
    if(event === 'PASSWORD_RECOVERY'){ aguardandoSenha = true; renderDefinirSenha(); return; }
    if(event === 'SIGNED_IN'){
      if(aguardandoSenha){ renderDefinirSenha(); return; }
      routeBySession(sess);
    }
    if(event === 'SIGNED_OUT') renderLogin();
  });
  const session = await api.getSession();
  await routeBySession(session);
}
init();
