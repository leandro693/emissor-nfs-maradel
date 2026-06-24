// ============================================================
//  api.js — camada de acesso a dados (Supabase)
//  Cada função encapsula uma operação de banco/storage. RLS no
//  servidor garante que cada papel só acessa o que pode.
// ============================================================
import { supabase } from './supabaseClient.js';

// ---- AUTH / PERFIL ----------------------------------------------------------

// Retorna a sessão atual (ou null).
export async function getSession(){
  const { data } = await supabase.auth.getSession();
  return data.session;
}

// URL de retorno do app (usada nos e-mails de convite e recuperação).
function redirectUrl(){ return window.location.origin + window.location.pathname; }

// Login por e-mail + senha.
export async function entrarComSenha(email, password){
  return supabase.auth.signInWithPassword({ email, password });
}

// Envia e-mail de recuperação de senha ("Esqueci minha senha").
export async function recuperarSenha(email){
  return supabase.auth.resetPasswordForEmail(email, { redirectTo: redirectUrl() });
}

// Define/atualiza a senha do usuário logado (usado no convite, recuperação e Minha conta).
export async function definirSenha(password){
  const { error } = await supabase.auth.updateUser({ password });
  if(error) throw error;
}

// Atualiza o e-mail do usuário logado (Supabase envia confirmação ao novo e-mail).
export async function atualizarEmail(email){
  const { error } = await supabase.auth.updateUser({ email });
  if(error) throw error;
}

// Atualiza o nome do contato no profile do usuário logado. A coluna
// profiles.nome já existe; a RLS permite o próprio usuário se atualizar.
export async function atualizarMeuNome(nome){
  const uid = (await supabase.auth.getUser()).data.user.id;
  const { error } = await supabase.from('profiles').update({ nome }).eq('id', uid);
  if(error) throw error;
}

// Encerra a sessão.
export async function signOut(){ return supabase.auth.signOut(); }

// ---- CADASTRO DE CLIENTE PELO ANALISTA (Edge Function) ----------------------

// Chama a Edge Function 'invite-cliente' (service_role) para criar o usuário,
// disparar o convite por e-mail e gravar o registro completo do cliente.
export async function convidarCliente({ razao_social, cnpj, regime, endereco, email, telefone, whatsapp_grupo }){
  const { data, error } = await supabase.functions.invoke('invite-cliente', {
    body: { razao_social, cnpj, regime, endereco, email, telefone, whatsapp_grupo, redirectTo: redirectUrl() }
  });
  // A função retorna { error } no corpo em caso de falha de regra de negócio.
  if(error){
    let msg = error.message;
    try { const ctx = await error.context?.json(); if(ctx?.error) msg = ctx.error; } catch {}
    throw new Error(msg);
  }
  if(data?.error) throw new Error(data.error);
  return data;
}

// ---- GESTÃO DE EQUIPE (usuários internos) — só master ----------------------

// Convida um usuário interno (nome + e-mail + papel) via Edge Function
// 'invite-equipe' (service_role). A pessoa recebe o convite e define a senha.
export async function convidarUsuarioEquipe({ nome, email, role }){
  const { data, error } = await supabase.functions.invoke('invite-equipe', {
    body: { action:'invite', nome, email, role, redirectTo: redirectUrl() }
  });
  if(error){
    let msg = error.message;
    try { const ctx = await error.context?.json(); if(ctx?.error) msg = ctx.error; } catch {}
    throw new Error(msg);
  }
  if(data?.error) throw new Error(data.error);
  return data;
}

// Remove um usuário interno (exclusão real do auth) — só master.
export async function removerUsuarioEquipe(userId){
  const { data, error } = await supabase.functions.invoke('invite-equipe', {
    body: { action:'remove', user_id: userId }
  });
  if(error){
    let msg = error.message;
    try { const ctx = await error.context?.json(); if(ctx?.error) msg = ctx.error; } catch {}
    throw new Error(msg);
  }
  if(data?.error) throw new Error(data.error);
  return data;
}

// Lista os usuários internos (qualquer papel que não seja 'cliente'). A RLS
// deixa a equipe ler os profiles.
export async function listEquipe(){
  const { data, error } = await supabase.from('profiles')
    .select('*').neq('role', 'cliente').order('created_at', { ascending:true });
  if(error) throw error;
  return data;
}

// ---- CONTATO DE ATENDIMENTO (institucional) --------------------------------

// Lê o contato de atendimento (singleton). Qualquer usuário logado pode ler.
export async function getConfigAtendimento(){
  const { data, error } = await supabase.from('config_atendimento')
    .select('*').eq('id', 1).maybeSingle();
  if(error) throw error;
  return data;
}

// Atualiza o contato de atendimento — RLS permite só admin (master/operacional).
export async function atualizarConfigAtendimento({ nome, whatsapp, email }){
  const { error } = await supabase.from('config_atendimento')
    .update({ nome, whatsapp, email, updated_at: new Date().toISOString() }).eq('id', 1);
  if(error) throw error;
}

// Lista todos os clientes (analista enxerga todos via RLS).
export async function listClientes(){
  const { data, error } = await supabase.from('clientes').select('*').order('created_at', { ascending:false });
  if(error) throw error;
  return data;
}

// Exclui um cliente (prestador). RLS permite SOMENTE o admin_master.
export async function excluirCliente(id){
  const { error } = await supabase.from('clientes').delete().eq('id', id);
  if(error) throw error;
}

// Busca um cliente (prestador) pelo id — usado na tela de detalhe do cliente
// (lado equipe). RLS já libera a leitura para a equipe.
export async function getCliente(id){
  const { data, error } = await supabase.from('clientes').select('*').eq('id', id).single();
  if(error) throw error;
  return data;
}

// Busca um cliente pelo user_id — usado logo após o convite, para descobrir o
// id do registro recém-criado e gravar o acesso à prefeitura.
export async function getClienteByUserId(userId){
  const { data, error } = await supabase.from('clientes').select('*').eq('user_id', userId).maybeSingle();
  if(error) throw error;
  return data;
}

// ---- ACESSO À PREFEITURA (Parte 3) — tabela só da equipe, senha cifrada ------

// Lê os metadados de acesso à prefeitura de um cliente (link, login, se há
// senha e o indicador de procuração). NÃO traz a senha em claro. RPC restrito
// à equipe (is_staff). Retorna null quando não há nada cadastrado.
export async function getClientePrefeitura(clienteId){
  const { data, error } = await supabase.rpc('get_cliente_prefeitura', { p_cliente_id: clienteId });
  if(error) throw error;
  return Array.isArray(data) ? (data[0] || null) : (data || null);
}

// Devolve a SENHA em claro — só para analista ou superior (RPC valida o papel).
export async function getClientePrefeituraSenha(clienteId){
  const { data, error } = await supabase.rpc('get_cliente_prefeitura_senha', { p_cliente_id: clienteId });
  if(error) throw error;
  return data; // texto (ou null se não cadastrada)
}

// Grava/atualiza o acesso à prefeitura — só admin (RPC valida e criptografa a
// senha). senha: undefined/null = manter a atual; '' = remover; texto = trocar.
export async function setClientePrefeitura(clienteId, { link, login, senha, procuracao }){
  const { error } = await supabase.rpc('set_cliente_prefeitura', {
    p_cliente_id: clienteId,
    p_link: link ?? null,
    p_login: login ?? null,
    p_senha: senha === undefined ? null : senha,
    p_procuracao: !!procuracao,
  });
  if(error) throw error;
}

// Atualiza dados editáveis do próprio cliente (prestador) — ex.: telefone
// (WhatsApp) e link de grupo, usados no envio da nota. RLS garante que o
// cliente só altere o próprio registro.
export async function atualizarMeuCliente(clienteId, campos){
  const { error } = await supabase.from('clientes').update(campos).eq('id', clienteId);
  if(error) throw error;
}

// Busca o profile (papel) do usuário logado.
export async function getProfile(){
  const { data, error } = await supabase.from('profiles').select('*').eq('id',
    (await supabase.auth.getUser()).data.user.id).single();
  if(error) throw error;
  return data;
}

// ---- CLIENTE (prestador) ----------------------------------------------------

// Retorna o registro 'clientes' do usuário logado (ou null se ainda não vinculado).
// O cliente não se auto-cadastra: o registro é criado pelo analista (Edge Function).
export async function getMeuCliente(){
  const uid = (await supabase.auth.getUser()).data.user.id;
  const { data, error } = await supabase.from('clientes').select('*').eq('user_id', uid).maybeSingle();
  if(error) throw error;
  return data;
}

// ---- TOMADORES --------------------------------------------------------------

// Lista os tomadores (de um cliente, ou todos se analista via RLS).
export async function listTomadores(clienteId){
  let q = supabase.from('tomadores').select('*').order('created_at', { ascending:false });
  if(clienteId) q = q.eq('cliente_id', clienteId);
  const { data, error } = await q;
  if(error) throw error;
  return data;
}

// Cadastra um tomador reutilizável.
export async function criarTomador(t){
  const { data, error } = await supabase.from('tomadores').insert(t).select().single();
  if(error) throw error;
  return data;
}

// ---- SOLICITAÇÕES -----------------------------------------------------------

// Lista solicitações do cliente logado (com tomador embutido).
export async function listSolicitacoesCliente(clienteId){
  const { data, error } = await supabase.from('solicitacoes')
    .select('*, tomador:tomadores(*), nota:notas(*)')
    .eq('cliente_id', clienteId)
    .order('created_at', { ascending:false });
  if(error) throw error;
  return data;
}

// Lista solicitações para o analista, com filtro de status e busca.
// Faz join de cliente e tomador para exibir nomes/CNPJ na fila.
export async function listSolicitacoesAnalista({ status, busca } = {}){
  let q = supabase.from('solicitacoes')
    .select('*, cliente:clientes(*), tomador:tomadores(*), nota:notas(*)')
    .order('created_at', { ascending:false });
  if(status) q = q.eq('status', status);
  const { data, error } = await q;
  if(error) throw error;
  let rows = data;
  // Busca local por nome do cliente, do tomador ou documento.
  if(busca){
    const b = busca.toLowerCase();
    rows = rows.filter(r =>
      (r.cliente?.razao_social||'').toLowerCase().includes(b) ||
      (r.cliente?.cnpj||'').toLowerCase().includes(b) ||
      (r.tomador?.nome||'').toLowerCase().includes(b) ||
      (r.tomador?.doc||'').toLowerCase().includes(b)
    );
  }
  return rows;
}

// Conta solicitações por status (para os contadores do topo). Inclui a fila
// de conferência (item 2).
export async function contadoresPorStatus(){
  const { data, error } = await supabase.from('solicitacoes').select('status');
  if(error) throw error;
  const c = { solicitada:0, em_emissao:0, aguardando_conferencia:0, emitida:0, cancelada:0 };
  data.forEach(r => { c[r.status] = (c[r.status]||0) + 1; });
  return c;
}

// Busca uma solicitação completa pelo id.
export async function getSolicitacao(id){
  const { data, error } = await supabase.from('solicitacoes')
    .select('*, cliente:clientes(*), tomador:tomadores(*), nota:notas(*)')
    .eq('id', id).single();
  if(error) throw error;
  return data;
}

// Cria uma nova solicitação (status default 'solicitada' no banco).
export async function criarSolicitacao(s){
  const { data, error } = await supabase.from('solicitacoes').insert(s).select().single();
  if(error) throw error;
  return data;
}

// Atualiza o status de uma solicitação (ex.: cancelar).
export async function setStatus(id, status){
  const { error } = await supabase.from('solicitacoes').update({ status }).eq('id', id);
  if(error) throw error;
}

// Atualiza campos editáveis de uma solicitação ainda não emitida. A RLS
// garante que o cliente só altera as próprias. Sem mudança de schema.
export async function atualizarSolicitacao(id, campos){
  const { error } = await supabase.from('solicitacoes').update(campos).eq('id', id);
  if(error) throw error;
}

// Cancela uma solicitação registrando o motivo (texto livre). O motivo é
// gravado em solicitacoes.motivo_cancelamento (migração 0004). Caso a coluna
// ainda não exista no projeto, o cancelamento ocorre mesmo assim — o motivo é
// apenas ignorado (degrada com elegância).
export async function cancelarSolicitacao(id, motivo){
  const campos = { status: 'cancelada' };
  if(motivo) campos.motivo_cancelamento = motivo;
  let { error } = await supabase.from('solicitacoes').update(campos).eq('id', id);
  if(error && motivo && /motivo_cancelamento/.test(error.message||'')){
    // Coluna ainda não migrada: cancela sem o motivo.
    ({ error } = await supabase.from('solicitacoes').update({ status:'cancelada' }).eq('id', id));
  }
  if(error) throw error;
}

// Atualiza um tomador (cliente dono via RLS).
export async function atualizarTomador(id, campos){
  const { error } = await supabase.from('tomadores').update(campos).eq('id', id);
  if(error) throw error;
}

// Grava o número de pedido na solicitação (analista preenche para liberar a
// emissão quando o tomador exige número de pedido — item B).
export async function setNumeroPedido(id, numero_pedido){
  const { error } = await supabase.from('solicitacoes').update({ numero_pedido }).eq('id', id);
  if(error) throw error;
}

// ---- NOTAS + STORAGE --------------------------------------------------------

// Faz upload de um arquivo (PDF/XML) no bucket 'notas', seguindo a convenção
// de caminho notas/<cliente_id>/<solicitacao_id>/<arquivo> exigida pela RLS.
export async function uploadArquivo(clienteId, solicitacaoId, file, tipo){
  const ext = tipo === 'pdf' ? 'pdf' : 'xml';
  const path = `${clienteId}/${solicitacaoId}/nota.${ext}`;
  const { error } = await supabase.storage.from('notas')
    .upload(path, file, { upsert:true, contentType: tipo==='pdf'?'application/pdf':'application/xml' });
  if(error) throw error;
  return path;
}

// id do usuário logado (atalho reutilizado).
async function uid(){ return (await supabase.auth.getUser()).data.user.id; }

// upsert da nota (uma por solicitação). Não muda o status — quem muda é o
// fluxo (preparo/emissão/conferência), respeitando o papel.
async function upsertNota({ solicitacaoId, numero, pdfPath, xmlPath }){
  const payload = {
    solicitacao_id: solicitacaoId,
    numero,
    data_emissao: new Date().toISOString().slice(0,10),
    pdf_url: pdfPath || null,
    xml_url: xmlPath || null
  };
  const { data: existente } = await supabase.from('notas')
    .select('id').eq('solicitacao_id', solicitacaoId).maybeSingle();
  if(existente){
    const { error } = await supabase.from('notas').update(payload).eq('id', existente.id);
    if(error) throw error;
  } else {
    const { error } = await supabase.from('notas').insert(payload);
    if(error) throw error;
  }
}

// Grava o rastreamento interno (quem preparou/conferiu). Tabela só da equipe —
// o cliente nunca lê. Faz upsert por solicitação, atualizando só os campos dados.
async function gravarInterno(solicitacaoId, campos){
  const { error } = await supabase.from('solicitacao_interno')
    .upsert({ solicitacao_id: solicitacaoId, ...campos, updated_at: new Date().toISOString() },
            { onConflict: 'solicitacao_id' });
  if(error) throw error;
}

// Salva/atualiza a nota (número/arquivos) SEM mudar o status. Usado na
// aprovação da conferência quando o analista ajusta algo antes de liberar.
export async function salvarNota(args){ await upsertNota(args); }

// Lê o rastreamento interno de uma solicitação (equipe). Null se não houver.
export async function getInterno(solicitacaoId){
  const { data, error } = await supabase.from('solicitacao_interno')
    .select('*').eq('solicitacao_id', solicitacaoId).maybeSingle();
  if(error) throw error;
  return data;
}

// AUXILIAR: finaliza o preparo. Grava a nota (número/arquivos), registra quem
// preparou e manda para a fila de conferência (NÃO emite, cliente não é avisado).
export async function enviarParaConferencia({ solicitacaoId, numero, pdfPath, xmlPath, nome }){
  await upsertNota({ solicitacaoId, numero, pdfPath, xmlPath });
  await gravarInterno(solicitacaoId, {
    preparada_por: await uid(), preparada_por_nome: nome || null,
    preparada_em: new Date().toISOString(), observacao: null
  });
  await setStatus(solicitacaoId, 'aguardando_conferencia');
}

// ANALISTA+: emite diretamente (sem passar por auxiliar). Registra a mesma
// pessoa como preparou e conferiu, e libera (status 'emitida').
export async function emitirNota({ solicitacaoId, numero, pdfPath, xmlPath, nome }){
  await upsertNota({ solicitacaoId, numero, pdfPath, xmlPath });
  const u = await uid(), agora = new Date().toISOString();
  await gravarInterno(solicitacaoId, {
    preparada_por: u, preparada_por_nome: nome || null, preparada_em: agora,
    conferida_por: u, conferida_por_nome: nome || null, conferida_em: agora, observacao: null
  });
  await setStatus(solicitacaoId, 'emitida'); // trigger guard_emissao garante o papel
}

// ANALISTA+: aprova um item da fila de conferência → libera a emissão.
export async function aprovarConferencia({ solicitacaoId, nome }){
  await gravarInterno(solicitacaoId, {
    conferida_por: await uid(), conferida_por_nome: nome || null,
    conferida_em: new Date().toISOString()
  });
  await setStatus(solicitacaoId, 'emitida');
}

// ANALISTA+: devolve ao auxiliar com observação (sai da fila, volta a "em emissão").
export async function devolverConferencia({ solicitacaoId, observacao, nome }){
  await gravarInterno(solicitacaoId, {
    observacao: observacao || null,
    conferida_por: await uid(), conferida_por_nome: nome || null,
    conferida_em: new Date().toISOString()
  });
  await setStatus(solicitacaoId, 'em_emissao');
}

// Gera uma URL assinada (temporária) para baixar um arquivo do bucket privado.
export async function urlAssinada(path){
  if(!path) return null;
  const { data, error } = await supabase.storage.from('notas').createSignedUrl(path, 120);
  if(error) throw error;
  return data.signedUrl;
}

// ---- LINK PÚBLICO + HISTÓRICO (itens D, E, F) -------------------------------

// Regenera o token/link público da nota e renova a expiração (+90 dias).
// Função RPC (SECURITY DEFINER) valida se quem chama é analista ou dono da nota.
export async function regenerarTokenNota(notaId){
  const { data, error } = await supabase.rpc('regenerar_token_nota', { p_nota_id: notaId });
  if(error) throw error;
  return data; // novo token
}

// Registra um ENVIO (e-mail/WhatsApp) no histórico da nota (item F).
// canal: 'email' | 'whatsapp'. destinatario: e-mail ou telefone.
export async function registrarEnvio({ nota_id, canal, destinatario }){
  const uid = (await supabase.auth.getUser()).data.user.id;
  const { error } = await supabase.from('nota_eventos')
    .insert({ nota_id, tipo:'envio', canal, destinatario: destinatario || null, disparado_por: uid });
  if(error) throw error;
}

// Lista o histórico (envios + aberturas) de uma nota, mais recente primeiro.
export async function listEventosNota(notaId){
  const { data, error } = await supabase.from('nota_eventos')
    .select('*').eq('nota_id', notaId).order('created_at', { ascending:false });
  if(error) throw error;
  return data;
}
