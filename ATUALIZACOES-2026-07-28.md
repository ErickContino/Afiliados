# Atualizações do AffiliaZap — 28/07/2026

## Contexto

Este documento consolida o trabalho feito em paralelo em múltiplas conversas do Claude Code sobre o mesmo projeto `afiliados-dashboard`. Nenhuma dessas mudanças foi commitada ainda — tudo está como alteração local (`git status`), pendente de revisão e commit.

**Importante**: eu (este chat) não tenho acesso ao histórico das outras conversas. O conteúdo abaixo foi reconstruído a partir do **estado real do código no disco** (`git diff`/`git status`, que é a fonte da verdade, já que reflete o resultado combinado de tudo que rodou até agora) mais o que você colou aqui de resumos de outras conversas. Se uma das outras conversas ("Revisão geral e completa...", por exemplo) tiver feito algo que ainda não apareceu no código, ele não está listado aqui — cole o resumo dela nesta conversa que eu incorporo.

Último commit antes de todas essas mudanças: `e8fbe6d` — "ajuste dominio vercel" (13/05/2026).

---

## 1. Redesign visual + modernização geral (feito nesta conversa)

**Sistema de design novo** — `lib/design-tokens.ts` + `app/components/ui/` (Card, Button, Field, Input/Select/Textarea, DataTable com paginação embutida, StatusBadge, Callout, Toast, ConfirmDialog, StatCard, LoadingState, AccessBlockedState, Tooltip) substituindo estilos inline duplicados em todas as páginas. Ícones reais (`lucide-react`) no lugar de emojis.

**Todas as 7 páginas originais restilizadas** (login, dashboard, perfil, financeiro, comissões, casas, usuários) — só JSX/estilo, lógica de negócio preservada intacta.

**Dashboard**: tabela trocada para `DataTable` (removeu o corte silencioso de 50 linhas), + 3 gráficos novos (Recharts): volume ao longo do tempo, comissão por casa, REV vs CPA (só admin_master) — todos alimentados pelos dados já filtrados por hierarquia de permissão.

**Correções de segurança/técnicas**:
- `lib/supabase.ts`: credenciais hardcoded → variáveis de ambiente (`.env.example` criado).
- `app/api/users/bootstrap` e `app/api/users/assign-affiliate`: antes sem validação de token nenhuma, agora exigem Bearer token válido.
- `app/api/houses/route.ts` (endpoint duplicado/código morto, sem as validações que `houses/upsert` tinha): removido.

**Funcionalidades novas**:
- Upload de NF em PDF via Supabase Storage (bucket `financial-invoices`, privado) — rotas `app/api/financial/upload-invoice` e `/invoice-url`. Depende de `ALTER TABLE financial_payouts ADD COLUMN invoice_file_path text NULL;` (**você já rodou**) e do bucket (**você já criou**).
- Botão de suporte via WhatsApp na sidebar, número real configurado: `+55 11 96599-0451`.
- Confirmação (`ConfirmDialog`) em todas as ações sensíveis, incluindo "Desativar usuário", que antes não pedia confirmação nenhuma.
- Correção de bug: em Financeiro, o botão "Dar baixa" desabilitava todos os botões da lista ao mesmo tempo em vez de só o clicado (agora usa `payingId` por linha).

**Decisão consciente**: "excluir usuário" do backlog não foi implementado como exclusão real — mantido só "Desativar" (preserva integridade referencial com `conversions`/`commission_splits`), a seu pedido.

---

## 2. Painel do Admin / Gerenciar Dados (outra conversa, "Criar painel administrat...")

Página nova `/admin`, visível só para `admin_master`, seção "Administração" na sidebar (item de menu adicionado em `LayoutShell.tsx`, depois preservado quando essa mesma tela foi restilizada pelo redesign geral — ver seção 1).

**Implementado**:
- `app/admin/page.tsx`: wrapper com gate de role + navegação em abas internas (hoje só "Gerenciar Dados", pensada pra crescer).
- `app/admin/components/GerenciarDados.tsx`: lista/filtra `conversions` (casa, afiliado, período), cria/edita registro manualmente (modal), importa `.csv`, exclui registro, 2 botões de processo automático.
- `app/api/conversions/save/route.ts`: insere/atualiza `conversions`, `admin_master`-only.
- `app/api/conversions/delete/route.ts`: apaga um registro de `conversions` + seus `commission_splits`, `admin_master`-only.
- `app/api/admin/run-process/route.ts`: dispara as RPCs em lote, `admin_master`-only.

**Decisão técnica — import de arquivo**: avaliaram `xlsx` (SheetJS) do npm e descartaram — tem vulnerabilidades altas (prototype pollution, ReDoS) sem correção publicada no registry. Implementaram parser CSV próprio, sem dependência, que reconhece o layout do `Comissao.csv` (inclusive a coluna "Campanha" duplicada). **Só aceita `.csv`, não `.xlsx`** — pendente decidir se isso é bloqueante.

**Descoberta sobre o pipeline de comissão** (comportamento existente no Supabase, não foi criado por nenhuma conversa — importante pra quem for mexer em RPCs de comissão no futuro):
- `generate_commission_splits`/`generate_pending_commission_splits` não geram nada (sem erro, silenciosamente) se os 4 campos de snapshot da conversão (`gross_value_snapshot`, `box_value_snapshot`, `commission_value_snapshot`, `rev_value_snapshot`) estiverem nulos.
- Quem preenche esses snapshots é a RPC `process_pending_conversions()`, que também resolve `lead_owner_user_id` a partir do código do afiliado (ignora o que for mandado manualmente nesse campo).
- **Ordem correta sempre**: `process_pending_conversions()` → `generate_pending_commission_splits()`.
- A rota de salvar zera os 4 snapshots ao editar um registro, pra ele voltar a contar como "pendente" e ser reprocessado.
- Geração de comissão só funciona quando o código do afiliado bate com um vínculo real em `user_house_links` — sem vínculo cadastrado, não gera comissão pra esse registro (não é bug, é como a RPC já funcionava).

**Testado de ponta a ponta** (script Node com service role + Playwright headless contra banco de dev real): login admin_master → navegação até `/admin`; criar registro manual → snapshot + splits corretos (validados contra `commission_rules`/`affiliate_commission_settings` reais); editar registro → não duplica splits; importar CSV (usando o `Comissao.csv` do repo) → preview, vínculo sugerido, grava certo; excluir registro → some de `conversions` e `commission_splits`; os 2 botões de processo → contagem retornada bate com o processado no banco. `npm run build`/`lint` rodados limpos 4-5 vezes ao longo da sessão. Nenhum dado real apagado nos testes (linhas de teste próprias, removidas depois).

**Pendente / precisa de atenção**:
- ~~`app/api/conversions/delete/route.ts` e `app/api/admin/run-process/route.ts` ainda não migrados pra `lib/api-auth.ts`~~ — **resolvido**, a terceira conversa migrou as duas também (ver seção 3).
- Import só aceita `.csv` — decidir se `.xlsx` é necessário.
- Não confirmaram 100% que o gate de role rejeita não-admin nesse fluxo específico (credencial de teste não bateu) — a lógica é idêntica à já usada/testada em `commissions/upsert` e `houses/upsert`, então baixo risco, mas não validado diretamente aqui.
- Sem teste de volume/paginação real (banco de dev só tinha ~10 registros em `conversions`).

---

## 3. Terceira conversa ("Revisão geral e completa...")

Fez uma revisão geral do projeto inteiro (só leitura), depois aplicou correções a pedido do usuário. Resumo final dela (colado pelo usuário + cruzado com o código real):

### ✅ RLS do Supabase — CONFIRMADO SEGURO (item que estava em aberto, agora resolvido)

Testaram direto contra a API REST do Supabase com a chave anônima **sem sessão**: leituras anônimas de `users`, `commission_splits`, `conversions` retornam `[]` — confirmado que não é tabela vazia (leitura com service role mostrou 146 linhas em `users`). Depois o usuário rodou as queries de auditoria (`pg_policies`/`pg_proc`) no SQL Editor e colou o resultado de volta: **as policies de RLS em `users`/`conversions`/`commission_splits` restringem corretamente por hierarquia** (funções `can_view_user()` e `is_user_descendant()` no banco), batendo com o filtro que o front-end já fazia. Ou seja: mesmo que alguém tentasse ler a API do Supabase direto (fora do app), o banco já barra por conta própria — o filtro client-side no Dashboard/Comissões era redundante em segurança, não a única camada.

### ⚠️ Novo gap encontrado — `admin_partner` pode estar vendo lista vazia (precisa você testar)

A função `can_view_user()` no banco só dá visão total pra `admin_master`. `admin_partner` não tem bypass equivalente — e como `parent_id` só é preenchido pra role `afiliado` (nunca aponta pra um `admin_partner`), um login `admin_partner` provavelmente **vê a lista de afiliados vazia** em `/comissoes` e `/usuarios`, mesmo o código do front-end tratando `admin_master` e `admin_partner` como equivalentes em alguns pontos (`app/comissoes/page.tsx`, linha ~304).

O usuário preferiu testar com um login `admin_partner` real antes de decidir se conserta. **Se confirmar o problema, o fix é uma linha na função `can_view_user()` no Supabase — não é código do repo.**

### Outras correções aplicadas

- **`lib/api-auth.ts`** (novo): helper compartilhado `getRequester(req, allowedRoles?, forbiddenMessage?)` + `supabaseAdmin`/`supabasePublic` + `isValidPeriod(year, month)`. Migrou as **13 rotas de API** pra usar ele (inclusive as 2 que a conversa do Painel Admin tinha deixado pendente: `admin/run-process` e `conversions/delete`, que apareceram no meio da sessão — identificados via `find -newer`) — removeu ~25 linhas de boilerplate de auth duplicado por arquivo. `users/bootstrap` ficou parcialmente fora do padrão de propósito: é self-service e precisa funcionar mesmo quando o usuário ainda não existe em `users`, então não usa `getRequester` com `allowedRoles`.
- **`app/api/users/create`**: corrigiu bug de usuário órfão no Auth — se o insert na tabela `users` falhasse depois do `auth.admin.createUser` já ter criado a conta, sobrava uma conta de login sem perfil associado. Agora, se o insert falhar, chama `supabaseAdmin.auth.admin.deleteUser()` pra desfazer. (O registro "Testenovo / fredpaofre@gmail.com" sem role/UUID no `melhorias.txt` parece ser exatamente esse bug acontecendo antes da correção.)
- **`app/api/financial/upload-invoice`**: sanitiza o nome do arquivo antes de montar o caminho no Storage (antes ia cru — uma `/` no nome do arquivo podia escapar da pasta pretendida); agora também apaga o PDF anterior do Storage quando o usuário reenvia a NF do mesmo mês (antes ficava lixo acumulando).
- **`isValidPeriod`** aplicado em `mark-paid`, `upload-invoice`, `invoice-url` — antes um mês fora do intervalo 1–12 montava uma query de intervalo de datas quebrada silenciosamente.
- **`app/page.tsx`**: removida a lógica duplicada de criar o registro `pending` do usuário via insert direto no client (com a chave anônima); agora chama `/api/users/bootstrap`, igual a tela de login já fazia — um caminho só pra criar usuário em vez de dois que podiam divergir.
- **`app/api/conversions/save/route.ts`**: ao reler o arquivo pra aplicar o refactor de auth, notaram que a geração de comissão já tinha sido trocada de "uma chamada de `generate_commission_splits` por conversão, em loop" para uma única chamada em lote (`generate_pending_commission_splits()`, sem parâmetro) — mais eficiente. Não foi essa conversa que fez essa mudança (encontraram já pronta); o texto da seção 2 acima ainda descrevia o comportamento antigo (loop por conversão) — **já corrigido aqui, o comportamento atual é o em lote**.
- Rodou `npx tsc --noEmit` (limpo), `npx eslint` nos arquivos tocados (sem erros novos — os 3 erros/3 warnings que aparecem já existiam antes, em código não tocado por essa conversa: tipos `any` em `houses/upsert`, variável de catch não usada em `users/complete`, exhaustive-deps em `page.tsx`), e `npm run build` duas vezes (antes e depois de pegar os 2 arquivos que apareceram no meio da sessão) — compilou limpo nas duas vezes, 15 rotas de API listadas.
- **Decidiu não fazer** (de propósito, fora de escopo pra uma revisão de bugs): converter o `style={{}}` inline das ~10 páginas pra Tailwind/design tokens — reconheceram que isso é melhoria de qualidade, não bug (é exatamente o que eu já tinha feito na seção 1, então não há conflito, só reconhecimento de que já estava resolvido por outra via).

**Pendente dessa conversa**: nenhum teste end-to-end em navegador dos fluxos que ela tocou (login → bootstrap, upload/reenvio de NF, criação de usuário com rollback, marcar comissão paga com mês inválido) — só validação estática (`tsc`/`eslint`/`build`) e a auditoria de RLS via `curl`/SQL direto no banco.

---

## Arquivos alterados (estado atual, `git status`)

**Removido**: `app/api/houses/route.ts`

**Modificados**: `app/api/commissions/upsert/route.ts`, `app/api/financial/mark-paid/route.ts`, `app/api/houses/upsert/route.ts`, `app/api/users/assign-affiliate/route.ts`, `app/api/users/bootstrap/route.ts`, `app/api/users/complete/route.ts`, `app/api/users/create/route.ts`, `app/api/users/deactivate/route.ts`, `app/api/users/reactivate/route.ts`, `app/casas/page.tsx`, `app/comissoes/page.tsx`, `app/components/LayoutShell.tsx`, `app/financeiro/page.tsx`, `app/globals.css`, `app/layout.tsx`, `app/login/page.tsx`, `app/page.tsx`, `app/perfil/page.tsx`, `app/usuarios/page.tsx`, `lib/supabase.ts`, `package.json`, `package-lock.json`

**Novos**: `app/admin/page.tsx`, `app/admin/components/GerenciarDados.tsx`, `app/api/admin/run-process/route.ts`, `app/api/conversions/delete/route.ts`, `app/api/conversions/save/route.ts`, `app/api/financial/invoice-url/route.ts`, `app/api/financial/upload-invoice/route.ts`, `app/components/icons.ts`, `app/components/ui/*` (14 arquivos), `lib/api-auth.ts`, `lib/design-tokens.ts`, `ATUALIZACOES-2026-07-28.md` (este arquivo)

**Dependências novas**: `lucide-react`, `recharts` (nada de `xlsx` — confirmado ausente do `package.json`).

---

## O que precisa de validação manual antes de commitar/dar deploy

- [x] ~~RLS do Supabase~~ — confirmado seguro (ver seção 3), policies restringem por hierarquia via `can_view_user()`/`is_user_descendant()`.
- [ ] **🔴 PRIORIDADE — testar login como `admin_partner`**: confirmar se `/comissoes` e `/usuarios` mostram a lista de afiliados vazia pra esse role (gap encontrado na função `can_view_user()` do banco — ver seção 3). Se confirmar, o fix é no Supabase, não no repo.
- [ ] **Login/logout** e criação de conta (`/login`) — os dois modos (entrar/criar conta).
- [ ] **Dashboard** (`/`) — testar com pelo menos 2 roles diferentes (ex: `admin_master` e `afiliado`) e confirmar que REV só aparece pro admin_master, que os filtros (data/casa/pessoa) refletem nos 3 gráficos e na tabela, e que a paginação da tabela funciona.
- [ ] **Financeiro** (`/financeiro`) — aba "Meu Financeiro" pra afiliado comum; aba "Pagamentos" + "Dar baixa" pra admin_master (confirmar que só a linha clicada mostra loading agora); **upload de NF em PDF de ponta a ponta** (enviar → "Ver NF" abre o PDF) já que SQL e bucket estão prontos.
- [ ] **Comissões** (`/comissoes`) — alterar comissão de um afiliado como `gerente` e como `admin_master`, confirmar o modal de confirmação.
- [ ] **Casas** (`/casas`) — criar/alterar uma casa, confirmar validação de pool (bruto = taxa + pool) e o preview ao vivo.
- [ ] **Usuários** (`/usuarios`) — completar cadastro pendente, criar usuário manual, **desativar** (confirmar que agora pede confirmação), reativar, atribuir afiliado do CSV.
- [ ] **Painel do Admin → Gerenciar Dados** (`/admin`) — importar um CSV de teste, editar um registro manualmente, **excluir um registro** (confirmar que os splits somem junto), rodar os 2 botões de processo manualmente e conferir se os dados batem no Dashboard depois.
- [ ] Botão de **WhatsApp** na sidebar abre a conversa certa.
- [ ] Testar em **mobile/tela estreita** (o redesign adicionou algumas classes responsivas via Tailwind, mas não foi testado em dispositivo real).
- [ ] Rodar `npm run build` uma última vez depois de qualquer ajuste manual, pra garantir que nada quebrou.
- [ ] Depois de validar: **commitar tudo** (nada disso está commitado ainda) e só então dar redeploy na Vercel.

## Observação técnica (não bloqueia nada)

`npm run lint` acusa erros de um conjunto de regras novas do Next.js 16 (React Compiler) contra o padrão `useEffect` + função `init()` assíncrona usado em todas as páginas desde antes dessas mudanças — pré-existente, confirmado inclusive em arquivos não tocados por nenhuma das conversas. `npm run build` roda limpo porque essa versão do Next não executa lint no build por padrão. Corrigir isso é um projeto à parte (reestruturar o padrão de carregamento de dados do zero).
