// ============================================================
//  Edge Function: invite-equipe
//  Gestão de usuários INTERNOS (equipe), exclusiva do admin_master.
//  Roda no servidor com a service_role (a publishable key do front
//  não cria/exclui usuários nem altera papéis).
//
//  Ações (POST { action, ... }):
//   - "invite": cria o usuário, dispara o convite por e-mail (define a
//     própria senha) e grava nome + papel no profile.
//   - "remove": exclui o usuário (cascata remove o profile).
//
//  Papéis aceitos no convite: admin_operacional | analista | auxiliar.
//  (admin_master não é criado por aqui — é definido manualmente no banco.)
//
//  Deploy:  supabase functions deploy invite-equipe
// ============================================================
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

// Papéis que o master pode atribuir pela tela de equipe.
const PAPEIS_PERMITIDOS = ["admin_operacional", "analista", "auxiliar"];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Método não permitido" }, 405);

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

  try {
    // ---- 1. autoriza: precisa estar logado E ser admin_master ----
    const authHeader = req.headers.get("Authorization") ?? "";
    const caller = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userErr } = await caller.auth.getUser();
    if (userErr || !user) return json({ error: "Não autenticado" }, 401);

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    const { data: prof } = await admin
      .from("profiles").select("role").eq("id", user.id).single();
    if (prof?.role !== "admin_master") {
      return json({ error: "Apenas o administrador master gerencia a equipe" }, 403);
    }

    const body = await req.json();
    const action = body?.action ?? "invite";

    // ---- 2a. REMOVER usuário ----
    if (action === "remove") {
      const { user_id } = body ?? {};
      if (!user_id) return json({ error: "Informe o usuário a remover" }, 400);
      if (user_id === user.id) return json({ error: "Você não pode remover a si mesmo" }, 400);
      const { error: delErr } = await admin.auth.admin.deleteUser(user_id);
      if (delErr) return json({ error: delErr.message }, 400);
      return json({ ok: true });
    }

    // ---- 2b. CONVIDAR usuário interno ----
    const { nome, email, role, redirectTo } = body ?? {};
    if (!email || !nome || !role) {
      return json({ error: "Informe nome, e-mail e papel" }, 400);
    }
    if (!PAPEIS_PERMITIDOS.includes(role)) {
      return json({ error: "Papel inválido" }, 400);
    }

    const { data: invited, error: inviteErr } = await admin.auth.admin
      .inviteUserByEmail(email, { redirectTo });
    if (inviteErr) {
      const msg = (inviteErr.message || "").toLowerCase();
      if (msg.includes("already") || msg.includes("registered") || msg.includes("exists")) {
        return json({
          error: "Este e-mail já tem conta. Peça à pessoa para usar \"Esqueci minha senha\".",
        }, 409);
      }
      return json({ error: inviteErr.message }, 400);
    }

    const newUserId = invited.user.id;

    // ---- 3. grava nome + papel no profile (o trigger já criou a linha) ----
    const { error: updErr } = await admin
      .from("profiles").update({ nome, role }).eq("id", newUserId);
    if (updErr) return json({ error: updErr.message }, 400);

    return json({ ok: true, user_id: newUserId });
  } catch (e) {
    return json({ error: String((e as Error)?.message ?? e) }, 500);
  }
});
