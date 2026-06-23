// ============================================================
//  Edge Function: invite-cliente
//  Cadastro de cliente pelo ANALISTA. Roda no servidor com a
//  service_role (privilégio elevado) — a publishable key do
//  front NÃO cria usuários, por isso este passo é uma função.
//
//  Faz, em ordem:
//   1. valida que quem chama está logado e é 'analista';
//   2. cria o usuário e dispara o convite por e-mail
//      (admin.inviteUserByEmail) para ele definir a senha;
//   3. grava o registro completo em public.clientes ligado a
//      esse usuário (razão social, CNPJ, regime, endereço, e-mail).
//
//  Deploy:  supabase functions deploy invite-cliente
//  (verify_jwt fica ligado por padrão: só usuários logados chamam.)
// ============================================================
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Cabeçalhos CORS — o app roda em outra origem (GitHub Pages / localhost).
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Resposta JSON util.
function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  // Preflight CORS.
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Método não permitido" }, 405);

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

  try {
    // ---- 1. identifica e autoriza quem chamou ----
    const authHeader = req.headers.get("Authorization") ?? "";
    const caller = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userErr } = await caller.auth.getUser();
    if (userErr || !user) return json({ error: "Não autenticado" }, 401);

    // cliente admin (service_role) — ignora RLS.
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    const { data: prof } = await admin
      .from("profiles").select("role").eq("id", user.id).single();
    if (prof?.role !== "analista") {
      return json({ error: "Apenas analistas podem cadastrar clientes" }, 403);
    }

    // ---- 2. valida payload ----
    const body = await req.json();
    const { razao_social, cnpj, regime, endereco, email, telefone, whatsapp_grupo, redirectTo } = body ?? {};
    if (!email || !razao_social || !cnpj) {
      return json({ error: "Informe ao menos razão social, CNPJ e e-mail" }, 400);
    }

    // ---- 3. cria o usuário + envia o convite ----
    const { data: invited, error: inviteErr } = await admin.auth.admin
      .inviteUserByEmail(email, { redirectTo });

    if (inviteErr) {
      // Caso comum: e-mail já tem conta (ex.: usuário antigo do magic link).
      const msg = (inviteErr.message || "").toLowerCase();
      if (msg.includes("already") || msg.includes("registered") || msg.includes("exists")) {
        return json({
          error:
            "Este e-mail já tem conta. Peça ao cliente para usar \"Esqueci minha senha\" para definir a senha.",
        }, 409);
      }
      return json({ error: inviteErr.message }, 400);
    }

    const newUserId = invited.user.id;

    // ---- 4. grava o cliente completo ligado ao usuário ----
    const { error: cliErr } = await admin.from("clientes").insert({
      user_id: newUserId,
      razao_social,
      cnpj,
      regime: regime || "SP",
      endereco: endereco || null,
      email,
      // telefone (WhatsApp) e link de grupo — opcionais, usados no envio da nota.
      telefone: telefone || null,
      whatsapp_grupo: whatsapp_grupo || null,
    });
    if (cliErr) return json({ error: cliErr.message }, 400);

    return json({ ok: true, user_id: newUserId });
  } catch (e) {
    return json({ error: String(e?.message ?? e) }, 500);
  }
});
