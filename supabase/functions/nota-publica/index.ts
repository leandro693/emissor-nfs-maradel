// ============================================================
//  Edge Function: nota-publica
//  Página pública de visualização da nota (item D). Roda no
//  servidor com a service_role para:
//   1. validar o token e a expiração (90 dias após a emissão);
//   2. registrar a ABERTURA do link (nota_eventos / tipo='abertura');
//   3. devolver APENAS os dados daquela nota + URLs assinadas
//      (curtas) para baixar o PDF e o XML do bucket privado.
//
//  Segurança: nenhuma outra informação do banco é exposta. O token
//  é a única credencial; sem token válido e dentro do prazo, nada
//  é retornado. A service_role nunca chega ao navegador — fica só aqui.
//
//  Deploy (verify_jwt OFF, pois a página não tem login):
//    supabase functions deploy nota-publica --no-verify-jwt
// ============================================================
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// CORS — a página pública roda em outra origem (GitHub Pages / localhost).
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Método não permitido" }, 405);

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  try {
    const { token } = (await req.json()) ?? {};
    if (!token || typeof token !== "string") {
      return json({ error: "Link inválido." }, 400);
    }

    // service_role ignora a RLS — por isso filtramos manualmente pelo token.
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    // ---- 1. localiza a nota pelo token e traz só os dados seguros ----
    const { data: nota, error: notaErr } = await admin
      .from("notas")
      .select(
        "id, numero, data_emissao, pdf_url, xml_url, token_expira_em, " +
          "solicitacao:solicitacoes(descricao, valor, competencia, " +
          "cliente:clientes(razao_social, cnpj), tomador:tomadores(nome, doc))",
      )
      .eq("public_token", token)
      .maybeSingle();

    if (notaErr) return json({ error: "Não foi possível carregar a nota." }, 500);
    if (!nota) return json({ error: "Nota não encontrada." }, 404);

    // ---- 2. checa a expiração (90 dias após a emissão) ----
    if (nota.token_expira_em && new Date(nota.token_expira_em).getTime() < Date.now()) {
      return json({ error: "expirado" }, 410);
    }

    // ---- 3. registra a abertura (não bloqueia a resposta se falhar) ----
    const ua = req.headers.get("user-agent") ?? "";
    await admin.from("nota_eventos").insert({
      nota_id: nota.id,
      tipo: "abertura",
      user_agent: ua.slice(0, 300),
    });

    // ---- 4. gera URLs assinadas curtas para PDF/XML (bucket privado) ----
    const signed = async (path: string | null) => {
      if (!path) return null;
      const { data } = await admin.storage.from("notas").createSignedUrl(path, 300);
      return data?.signedUrl ?? null;
    };
    const pdfUrl = await signed(nota.pdf_url);
    const xmlUrl = await signed(nota.xml_url);

    // O join vem como array no supabase-js; normaliza para objeto.
    const solic = Array.isArray(nota.solicitacao) ? nota.solicitacao[0] : nota.solicitacao;
    const cliente = Array.isArray(solic?.cliente) ? solic.cliente[0] : solic?.cliente;
    const tomador = Array.isArray(solic?.tomador) ? solic.tomador[0] : solic?.tomador;

    // ---- 5. devolve SOMENTE os campos da nota daquele token ----
    return json({
      numero: nota.numero,
      data_emissao: nota.data_emissao,
      descricao: solic?.descricao ?? null,
      valor: solic?.valor ?? null,
      competencia: solic?.competencia ?? null,
      prestador: { razao_social: cliente?.razao_social ?? null, cnpj: cliente?.cnpj ?? null },
      tomador: { nome: tomador?.nome ?? null, doc: tomador?.doc ?? null },
      pdf_url: pdfUrl,
      xml_url: xmlUrl,
    });
  } catch (e) {
    return json({ error: String((e as Error)?.message ?? e) }, 500);
  }
});
