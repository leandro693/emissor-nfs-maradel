# Emissor NFS-e — Maradel

App web para **solicitação e gestão de NFS-e** do escritório Maradel.
Dois perfis: **cliente** (prestador, foco em celular) e **analista fiscal** (Maradel, foco em desktop).
Frontend estático (HTML + JS, sem build) + **Supabase** (Postgres, Auth, Storage, Edge Functions).

---

## 1. Estrutura

```
docs/                      ← o app (publicável no GitHub Pages)
  index.html
  styles.css               ← identidade visual Maradel + responsivo (mobile/desktop)
  assets/                  ← logos
  nota/                    ← PÁGINA PÚBLICA da nota (sem login)
    index.html
    nota.js                ← lê o token da URL e chama a Edge Function nota-publica
  js/
    supabaseClient.js      ← URL + publishable key
    ui.js                  ← máscaras, formatação, ícones, envio (e-mail/WhatsApp),
                              link público, toggle, histórico, helpers
    api.js                 ← acesso a dados, auth (e-mail+senha), convite, eventos
    app.js                 ← login, recuperação e definição de senha + roteamento
    client.js              ← telas do cliente (Início, Solicitações, Tomadores, Conta)
    analyst.js             ← telas do analista (fila, clientes, detalhe/emissão)
supabase/
  migrations/
    0001_init.sql          ← schema, RLS, triggers, storage
    0002_auth_senha_email.sql ← endereço/e-mail do cliente + e-mail do tomador
    0003_pedido_recorrencia_link_publico.sql
                           ← nº de pedido + bloqueio, recorrência, token público
                              (90 dias), telefone/grupo do cliente, histórico (eventos)
  functions/
    invite-cliente/index.ts ← cria usuário + convite por e-mail (service_role)
    nota-publica/index.ts   ← página pública: valida token, registra abertura,
                              devolve dados + URLs assinadas (service_role)
```

> A chave em `supabaseClient.js` é a **publishable key** — pública por design, segura no frontend. A `service_role` **nunca** vai para o cliente; ela só existe dentro da Edge Function, no servidor.

---

## 2. Configurar o Supabase

### 2.1 Banco de dados
No painel do projeto, abra **SQL Editor** e rode, **em ordem**, todo o conteúdo de:
1. `supabase/migrations/0001_init.sql`
2. `supabase/migrations/0002_auth_senha_email.sql`
3. `supabase/migrations/0003_pedido_recorrencia_link_publico.sql`

Isso cria tabelas, enums, RLS, triggers, a função de auth e o bucket `notas`,
adiciona os campos de endereço/e-mail e, na 0003, adiciona: número de pedido +
bloqueio real de emissão, recorrência (informativa), token público das notas
(expira em 90 dias), telefone/grupo de WhatsApp do cliente e a tabela de
histórico `nota_eventos`. As migrações são **aditivas e idempotentes** — rodar
a 0003 num banco já existente não apaga nada.

### 2.2 Autenticação (e-mail + senha)
- Em **Authentication → Providers → Email**: mantenha **Email** habilitado e
  **Confirm email** ligado. Como o cliente é cadastrado pela Maradel, recomenda-se
  **desabilitar o auto-cadastro** (*Allow new users to sign up* = OFF). O convite
  via Edge Function continua funcionando mesmo com o auto-cadastro desligado.
- Em **Authentication → URL Configuration**:
  - **Site URL**: a URL do app (ex.: `https://SEU_USUARIO.github.io/SEU_REPO/`).
  - **Redirect URLs**: adicione `http://localhost:8000` e a URL do GitHub Pages.
    Esses endereços recebem os links de **convite** e de **recuperação de senha**.
- Em **Authentication → SMTP**: confirme o **SMTP da Maradel** já configurado —
  é por ele que saem os e-mails de convite e de recuperação.

### 2.3 Edge Function (convite de cliente)
O analista cadastra o cliente por completo e o convite é disparado por uma função
no servidor (a publishable key não pode criar usuários). Faça o deploy com a
[Supabase CLI](https://supabase.com/docs/guides/cli):

```bash
supabase login
supabase link --project-ref vccmbsntbtmwgaabhcxk
supabase functions deploy invite-cliente
# Página pública da nota — SEM login, então o JWT precisa ficar DESLIGADO:
supabase functions deploy nota-publica --no-verify-jwt
```

As variáveis `SUPABASE_URL`, `SUPABASE_ANON_KEY` e `SUPABASE_SERVICE_ROLE_KEY`
já são injetadas automaticamente nas funções — não precisa configurar segredos.

> **Importante:** a `nota-publica` **deve** ser publicada com `--no-verify-jwt`,
> pois a página pública não tem usuário logado. Mesmo assim ela só devolve a nota
> daquele token e nada mais — a service_role fica no servidor, nunca no navegador.

### 2.4 Definir um analista
Todo usuário novo nasce com papel `cliente`. Para promover alguém a **analista**
(após a pessoa ter feito login ao menos uma vez):

```sql
update public.profiles set role = 'analista'
where email = 'analista@maradel.com.br';
```

O analista também define a senha pelo fluxo de **convite** ou **"Esqueci minha senha"**.

---

## 3. Rodar localmente

O app usa ES modules, então precisa ser servido por HTTP (não abra o arquivo direto).

```bash
cd docs
python -m http.server 8000
# abra http://localhost:8000
```

(ou `npx serve docs`)

Garanta que `http://localhost:8000` está nas **Redirect URLs** do Supabase (passo 2.2).

---

## 4. Deploy no GitHub Pages

1. Suba o repositório no GitHub.
2. **Settings → Pages → Build and deployment**:
   - **Source**: *Deploy from a branch*
   - **Branch**: `main` · pasta **`/docs`**
3. Salve. Em ~1 min o app fica em `https://SEU_USUARIO.github.io/SEU_REPO/`.
4. Adicione essa URL em **Site URL** e **Redirect URLs** no Supabase.

> A pasta `supabase/` (migrations e functions) não é publicada pelo Pages — fica só
> no repositório, como migração/código de servidor.

---

## 5. Fluxos

### Login (e-mail + senha)
- Não há mais magic link. O acesso é **e-mail + senha**.
- **O cliente não se auto-cadastra.** O **analista** cria o cliente por completo
  (razão social, CNPJ, regime, endereço, e-mail) em **Clientes → Novo cliente**.
  Ao salvar, a Edge Function cria o usuário e dispara um **convite por e-mail**.
- No 1º acesso (link do convite), o cliente **define a própria senha**.
- **"Esqueci minha senha"** envia um link para definir uma nova senha — serve
  inclusive para usuários antigos (que vinham do magic link).
- **Minha conta** (cliente): trocar o próprio **e-mail** e a **senha** quando quiser.

### Cliente (celular)
Dashboard com gráfico de faturamento e lista de solicitações → nova solicitação
(tomador sugerido, máscara de R$ e CNPJ/CPF, competência no mês atual) →
gestão de tomadores (com **e-mail opcional**) → detalhe da nota com download de
PDF/XML e **Enviar por e-mail**.

### Analista (desktop)
**Clientes** (cadastro/convite) · **Fila** aberta em *Solicitada*, com contadores
por status e busca por cliente/CNPJ → detalhe numa tela só, com **copiar** ao lado
de cada campo, número da nota, upload de PDF/XML, **Marcar como emitida** e
**Enviar por e-mail**.

### Número de pedido + bloqueio (item B)
- Cada **solicitação** tem um campo **número de pedido** (opcional por padrão).
- No **tomador** há a opção **"Número de pedido obrigatório? (sim/não)"**.
- Se o tomador **exige** e o cliente não preencheu: a solicitação é registrada,
  mas chega ao analista marcada **"com ressalva"**. O analista **não consegue
  emitir** enquanto o número não for informado — é um **bloqueio real**: além do
  botão desabilitado, há um *trigger* no banco (`trg_notas_check_pedido`) que
  recusa a gravação da nota sem o pedido.

### Recorrência (item C — informativo)
Na nova solicitação há **"recorrente? (sim/não)"** e, se sim, **nº de meses**.
É apenas informativo (sem automação): aparece no detalhe para o analista.

### Página pública da nota (item D)
Cada nota emitida tem um **link público** (`/nota/?t=maradel-…`) acessível **sem
login**. O token é **criptograficamente aleatório** (`gen_random_bytes`, 144 bits,
formato `maradel-…` amigável) e o link **expira em 90 dias** após a emissão.
- A página mostra **prestador, tomador, nº, competência, valor, descrição** e
  botões para **baixar PDF e XML**.
- Cada **abertura** é registrada no histórico.
- Dá para **regenerar** o link (o anterior deixa de funcionar) — botão na nota.
- Segurança: a página chama a Edge Function `nota-publica`, que valida o token,
  confere a expiração e devolve **só aquela nota** + URLs assinadas curtas. Nenhuma
  outra informação do banco é exposta; a service_role nunca vai ao navegador.

### Enviar nota — e-mail e WhatsApp (item E, sem servidor)
Disponível na nota **emitida**, para cliente e analista. Ao enviar, o sistema
**gera o link público** (item D) e monta o **texto padrão com o link** — **não
anexa arquivo** (o destinatário baixa o PDF/XML na própria página da nota).

- **E-mail** (`mailto:`): se o tomador tem e-mail, pergunta *"Enviar para
  [e-mail]?"* (Sim / digitar outro). O link aparece como **âncora clicável**
  ("Visualizar Nota Fiscal"); use **Copiar mensagem** para colar no corpo
  mantendo o link clicável.
- **WhatsApp** (`wa.me`): usa o **telefone** e/ou o **link de grupo** do cliente
  (cadastro do cliente / Minha conta). Se houver os dois, pergunta **qual usar**.
  Como o WhatsApp não tem texto clicável, o link vai como **URL curta e amigável**
  (`maradel-…`). Para grupo, a mensagem é copiada e o grupo é aberto para colar.

Cada envio é registrado no histórico (item F). Sem SMTP de terceiros, sem guardar
senha, sem automação — o SMTP da Maradel só é usado pelo Supabase para **convite**
e **recuperação de senha**.

- **Texto padrão:** `Prezado(a), segue a Nota Fiscal de Serviço nº [número],
  referente aos serviços prestados por [empresa], emitida em [data]. Acesse pelo
  link: [link]. Atenciosamente, [nome].`

### Histórico / log (item F)
A tabela `nota_eventos` registra **envios** (canal e-mail/WhatsApp, quem disparou,
quando, destinatário) e **aberturas** do link pelo tomador (data/hora). O analista
vê esse histórico em uma **timeline** no detalhe da nota.

---

## 6. Segurança (RLS)

Ativada em todas as tabelas. Resumo:
- **Cliente** lê/escreve apenas os próprios `clientes`, `tomadores`, `solicitacoes` e `notas` (leitura).
- **Analista** lê/edita tudo; é o único que cria/edita `notas`.
- **Criação de cliente/usuário** só ocorre via Edge Function, que valida o papel
  `analista` antes de usar a `service_role`.
- **Storage** `notas` (privado): analista com acesso total; cliente lê só a própria
  pasta (`<cliente_id>/...`). Downloads usam URLs assinadas temporárias.
- **Auditoria** (`log`): preenchida por triggers; visível só para analistas.
- **`nota_eventos`** (histórico): leitura para o analista e o cliente dono da nota.
  Envios são inseridos pelo app autenticado (RLS exige `disparado_por = auth.uid()`);
  aberturas são gravadas só pela Edge Function `nota-publica` (service_role).
- **Página pública** (`/nota`): não abre nenhuma política de leitura anônima nas
  tabelas. Todo o acesso passa pela Edge Function, que filtra pelo token, valida a
  expiração e devolve apenas os campos daquela nota.

---

## 7. Manutenção

Cada módulo/função em `js/` e na Edge Function tem um comentário curto explicando
o que faz. Para reusar em outro projeto Supabase, troque `SUPABASE_URL` e
`SUPABASE_KEY` em `js/supabaseClient.js`, rode as migrações na ordem e refaça o
deploy das funções `invite-cliente` e `nota-publica`.

---

## 8. Passos manuais desta evolução (checklist)

Faça nesta ordem:

1. **Migration** — no **SQL Editor** do Supabase, rode todo o
   `supabase/migrations/0003_pedido_recorrencia_link_publico.sql`.
   (Aditiva e idempotente; as notas já emitidas recebem token e expiração de 90 dias.)
2. **Edge Functions** — pela Supabase CLI:
   ```bash
   supabase functions deploy invite-cliente
   supabase functions deploy nota-publica --no-verify-jwt
   ```
   - Reimplante a `invite-cliente` (ela passou a gravar telefone/grupo do cliente).
   - A `nota-publica` **precisa** do `--no-verify-jwt` (página sem login).
3. **Deploy do front** — publique a pasta `docs/` (GitHub Pages). Confira que a
   nova pasta **`docs/nota/`** foi para o ar (`.../nota/` deve abrir a página da nota).
4. **URLs do Supabase** — em **Authentication → URL Configuration**, mantenha as
   **Redirect URLs** do app. A página `/nota` **não** precisa de redirect (é pública),
   mas o link gerado usa a mesma origem do app, então nada novo a configurar.
5. **Teste rápido**:
   - Cadastre/edite um tomador com **"número de pedido obrigatório"** ligado, crie
     uma solicitação **sem** o número e confirme que aparece **"com ressalva"** e
     que **emitir fica bloqueado** até preencher o número.
   - Emita uma nota, abra o **link de visualização**, baixe **PDF/XML** e confira
     que a **abertura** aparece no histórico do analista.
   - Teste **Enviar por e-mail** (âncora "Visualizar Nota Fiscal") e **WhatsApp**
     (número e/ou grupo) e veja os **envios** no histórico.

> Nenhum segredo novo a configurar: `SUPABASE_URL`, `SUPABASE_ANON_KEY` e
> `SUPABASE_SERVICE_ROLE_KEY` já são injetados automaticamente nas Edge Functions.
