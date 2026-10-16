# SafeNow

Protótipo acadêmico de segurança urbana colaborativa para Android e iOS, com Expo, React Native, TypeScript estrito e Supabase. O mapa reúne relatos aproximados; a comunidade registra ocorrências, anexa evidências e contribui com validações. Risco, confiabilidade e decisão administrativa são apresentados separadamente.

**Não é atendimento de emergência.** O aplicativo não substitui polícia, bombeiros, atendimento médico ou canais oficiais. Use somente cenários simulados nesta versão. Não se aproxime de uma ocorrência para relatar, fotografar ou validar.

## Início rápido

No Windows, com a pasta `dist` compilada, dê dois cliques em `Iniciar-SafeNow.cmd` e mantenha a janela aberta. Abra `http://localhost:3000` no navegador. O iniciador usa Node instalado ou o runtime Node deste computador incluído pelo Codex. `SafeNow-demo.zip` é uma demonstração separada: seus dados são locais e fictícios.

No projeto-fonte, `Iniciar-SafeNow.cmd` exige que `npm run export:web` já tenha gerado a pasta `dist`. A prévia serve apenas no loopback, sem expor o aplicativo na rede local. Para encerrar, feche a janela do iniciador.

Requisitos: Node **22.13+** (verificado com 24.19), npm, Android/iOS com Expo compatível ou development build. Para Supabase local: CLI Supabase e Docker. Para compilar iOS localmente: macOS e Xcode; no Windows, use EAS Build.

```bash
npm ci
cp .env.example .env
npm run web
# Ou, para dispositivo móvel:
npm start
```

Para editar o projeto aberto no VS Code, use `Iniciar-Desenvolvimento.cmd` (Expo na porta 3000) ou `npm run web -- --port 3000`. Encerre a prévia antes de iniciar o desenvolvimento na mesma porta. Mudanças no código aparecem pelo Expo; a prévia compilada precisa de uma nova exportação. Consulte [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) para o estado da integração hospedada já verificada.

No PowerShell, use `Copy-Item .env.example .env`. Sem credenciais, toque em **Explorar demonstração local**. Os dados são fictícios e persistem somente no dispositivo. A demonstração permite criar, corrigir, excluir, comentar e votar, mas **não simula autenticação Supabase, uploads, push ou poderes administrativos**. GPS exige permissão real; nos testes web, a posição é simulada pelo navegador de testes.

## Stack e organização

Os ícones de categoria e navegação usam `expo-symbols` da matriz SDK 57, com SF Symbols no iOS e Material Symbols no Android/web. Os nomes das categorias continuam visíveis e a seleção tem borda e marca de confirmação. O risco é uma escala explícita de 1 a 4, com texto, cor e barras; não depende de símbolos geométricos ou somente de cor. Ícones decorativos ficam ocultos do leitor de tela.

Expo SDK 57, React Native 0.86.3, React 19.2.3, Expo Router, TanStack Query, Supabase JS 2.117.3, react-native-maps 1.27.2 e módulos Expo para GPS, mídia, SecureStore e notificações. O `package-lock.json` fixa a resolução. Versões foram verificadas na documentação oficial e no manifesto `bundledNativeModules.json` do Expo antes da instalação; não se usa o React Native mais recente isoladamente da matriz Expo.

```text
app/                         rotas, telas e proteção de navegação
src/components/              componentes acessíveis e mapa por plataforma
src/domain/                  tipos, validações, score, estados, distância, elegibilidade
src/state/                   sessão, cache e assinatura Realtime
src/services/                Auth, repositórios, GPS, mídia, push e rascunhos
supabase/migrations/         esquema, grants, RLS, Storage, RPCs e controles de abuso
supabase/functions/          upload validado e despachante de notificações
scripts/                     bootstrap administrativo, seed, retenção e integrações
tests/                       domínio e autorização em PostgreSQL/PGlite
docs/                        modelo, segurança e evidências de verificação
```

## Variáveis de ambiente

No `.env` do aplicativo:

| Variável | Uso |
| --- | --- |
| `EXPO_PUBLIC_SUPABASE_URL` | URL HTTPS do projeto; URL local apenas em desenvolvimento |
| `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Chave **publicável**, ou anon legada do ambiente local |
| `EXPO_PUBLIC_EAS_PROJECT_ID` | ID do projeto EAS para Expo Push |
| `GOOGLE_MAPS_ANDROID_API_KEY` | Maps SDK para Android; restrinja por package e certificado |
| `EXPO_PUBLIC_DEMO_MODE` | `true` exibe também a opção de demo quando existe backend |

Variáveis `EXPO_PUBLIC_*` entram no bundle. **Nunca coloque service_role, senha do banco, chave de assinatura ou segredo do worker nelas.** Os scripts de servidor usam `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY` e `SUPABASE_DB_URL` somente no processo de execução. Não grave esses valores no repositório nem no app config. Não há credenciais incluídas.

## Configurar Supabase

### Ambiente local

```bash
supabase start
supabase db reset
supabase functions serve
```

`db reset` recria **a base local**: não use em base com dados que deseja preservar. Ele aplica seis migrações e o seed de categorias. A sexta só agenda jobs se o operador já preencheu a URL privada de execução. Copie URL e chave pública locais para o `.env`. Um celular não acessa o computador por `localhost`: configure o IP de desenvolvimento alcançável pelo dispositivo e as URLs de Auth correspondentes.

### Projeto hospedado

Crie um projeto Supabase dedicado, vincule-o com a CLI e aplique:

```bash
supabase login
supabase link --project-ref SEU_PROJECT_REF
supabase db push
supabase functions deploy evidence-upload
supabase functions deploy push-dispatch
supabase functions deploy retention
```

O seed não é aplicado automaticamente por `db push`. Execute `supabase/seed.sql` no SQL Editor do projeto para cadastrar as categorias. Não execute o seed de usuários fictícios em produção.

Neste protótipo de TCC, o cadastro público entra imediatamente após criar a conta, sem aprovação administrativa ou confirmação de e-mail. `auth.email.enable_confirmations=false` está no ambiente local; no projeto hospedado, desative **Confirm email** em Authentication → Sign In / Providers. A configuração hospedada foi conferida: confirmação desativada. Use apenas dados fictícios na avaliação; o e-mail ainda precisa ter formato válido e não pode duplicar uma conta existente. Não há verificação de posse do endereço nesse fluxo. Para lançamento público, reative confirmação e configure SMTP. Recuperação de senha por e-mail continua dependendo de uma caixa postal acessível e SMTP.

Em URL Configuration, use Site URL `http://localhost:3000` no desenvolvimento e redirects `http://localhost:3000/**`, `http://127.0.0.1:3000/**` e `safenow://auth/callback**`. Em produção, substitua localhost pelo domínio HTTPS. O cliente preserva retornos de confirmação/recuperação quando usados. A sessão web e o verificador PKCE persistem no armazenamento local do navegador; use uma máquina confiável e encerre a sessão ao terminar. No móvel, tokens e rascunhos de produção ficam no SecureStore.

As funções são implantadas com `verify_jwt=false` por compatibilidade com chaves atuais: **o upload valida o JWT explicitamente com `auth.getUser()` e verifica perfil ativo e autoria por RPC**. O worker não aceita um JWT de usuário como autorização: exige um segredo exclusivo. Não remova essas verificações.

## Login e primeiro administrador

Todos usam **a mesma tela de e-mail/senha e Supabase Auth**. O cliente consulta `profiles` após entrar. Acesso suspenso ou exclusão solicitada encerra a sessão de aplicação. RLS e RPCs verificam o status atual a cada operação, inclusive se um JWT antigo ainda existir.

Todo cadastro público cria somente `user`, sem seleção de perfil. O trigger ignora papéis enviados em metadados, inclusive `admin` e o antigo `collaborator`. Clientes não têm permissão de atualizar `role` ou `status`. Não há uma rota de cadastro administrativo.

Para o primeiro administrador:

Com confirmação de e-mail **ativada**, o operador pode **nomear antes do cadastro**, executando no SQL Editor autenticado como proprietário do banco:

```sql
insert into private.admin_nomination(email)
values (lower('EMAIL_DO_ADMINISTRADOR'));
```

A pessoa se cadastra normalmente e confirma o e-mail. Um trigger no servidor promove somente o e-mail nomeado, com perfil ativo, se ainda não houver administrador. A nomeação não é acessível pela API pública; há lock transacional, uma única nomeação pendente e auditoria. A senha é definida pela própria pessoa no aplicativo. Verifique a nomeação e a existência de administrador antes de repetir o procedimento. O cadastro público nunca pode escrever nessa tabela.

No fluxo acadêmico sem confirmação, use o procedimento confiável de servidor abaixo após verificar pessoalmente a identidade da pessoa. Não use a simples escolha de um e-mail como prova de identidade. O administrador deste projeto já foi definido no servidor antes de desativar a confirmação.

Alternativamente, para uma conta já criada:

1. Cadastre a conta pela tela comum e confirme o e-mail.
2. Em um **terminal confiável no servidor**, disponibilize a connection string privilegiada do banco em `SUPABASE_DB_URL` e o e-mail em `BOOTSTRAP_ADMIN_EMAIL`.
3. Execute `npm run admin:bootstrap`.
4. Remova as variáveis do terminal, saia da conta e entre novamente no app.

O script usa transação, lock para evitar bootstrap concorrente, exige e-mail confirmado e conta ativa, recusa nomeação de outra pessoa se já houver administrador e registra auditoria. Ele executa SQL por conexão privilegiada, sem expor uma RPC pública de promoção. Nomeações posteriores precisam de procedimento institucional auditado no servidor. O painel não permite suspender administradores ou a própria conta administrativa.

| Perfil | Permissões |
| --- | --- |
| Usuário comum | Consultar, relatar, comentar, votar e gerenciar seus relatos |
| Administrador ativo | Funções comunitárias, moderação, métricas, relatório agregado, suspensão/reativação e auditoria |

## Dados fictícios de desenvolvimento

`supabase/seed.sql` contém somente categorias. Para gerar contas, incidentes de riscos/status diferentes e uma evidência PNG inteiramente fictícia por incidente:

```bash
# Defina no terminal: SUPABASE_URL, SUPABASE_ANON_KEY,
# SUPABASE_SERVICE_ROLE_KEY, SUPABASE_DB_URL e ALLOW_LOCAL_SEED=true
npm run seed:dev
```

O script recusa URLs que não sejam loopback, requer uma base local limpa e usa o mesmo bootstrap privilegiado para o primeiro administrador. Gera senhas aleatórias e grava `.local/dev-accounts.json`, ignorado pelo Git. Não versionar, publicar ou compartilhar esse arquivo. As contas incluem dois usuários comuns e um administrador; o papel administrativo não é aceito no cadastro Auth público.

Nenhum local seguro real é inventado pelo seed. Um operador deve verificar e cadastrar `safe_places` pelo SQL Editor do servidor. Na ausência desses registros, a tela exibe estado vazio e oferece uma busca em mapa externo, sem prometer segurança do caminho.

## Estados, score e fluxo rápido

Veja as transições e a correspondência UML em [docs/DATA_MODEL.md](docs/DATA_MODEL.md). O autor corrige texto apenas em alerta ativo nos primeiros 15 minutos, pode excluir seus relatos e não pode votar no próprio alerta. Uma opinião ativa por usuário/alerta, com troca ou retirada. Avisos de resolução são independentes e não encerram automaticamente o alerta.

Score base 40, +7 por confirmação (máximo 10), −9 por contestação (máximo 10), −12 por spam (máximo 10), +5 por evidência tratada (máximo 2), −2 a cada 6 horas de idade (máximo 48 pontos). Resultado limitado a 0–90. Moderação confirmada usa 95; spam/excluído usa 0. O score é recalculado no servidor a cada contribuição/evidência e pela manutenção periódica. Não é probabilidade, verdade oficial ou previsão criminal.

Três confirmações com vantagem sobre contestações confirmam pela comunidade; três contestações marcam como contestado; três sinalizações de spam colocam em análise; avisos de resolução alimentam a fila da moderação, que decide o encerramento com motivo. Decisões administrativas têm prioridade e só a moderação pode revê-las. Alertas ativos/confirmados/contestados expiram para inativo em 24 horas; alertas em análise aguardam moderação.

O relato concentra os dados em um formulário com categoria que sugere risco e título, GPS, confirmação visual do ponto, revisão e publicação. O caminho é categoria → localizar → conferir/confirmar no mapa → revisar → publicar. Digitação, permissões, correções e anexos exigem interações adicionais; não afirmamos quatro toques para todos os cenários. Mover o pino invalida a confirmação anterior. A descrição continua obrigatória para não publicar conteúdo inventado. Rascunhos guardam somente texto e escolhas; nunca GPS ou mídia. No móvel são criptografados pelo sistema; no navegador são dados locais da prévia.

O mapa web usa Leaflet 1.9.4 com ruas OpenStreetMap, pinos por ocorrência e balões com acesso aos detalhes. No Android/iOS, usa react-native-maps. A tela principal mantém filtros recolhidos e mostra a posição consultada em azul. No cadastro, o ponto do GPS aparece com precisão informada; é possível tocar no mapa ou arrastar o pino para ajustar e confirmar. Pontos ajustados não mantêm a precisão do GPS anterior. Os detalhes, inclusive quando abertos por uma notificação, centralizam o pino da ocorrência. A posição pública continua arredondada, com círculo ilustrativo de aproximadamente 100 m; a precisão do dispositivo pode ser inferior. Mapas de ruas exigem internet e as consultas de tiles são feitas ao provedor OpenStreetMap. Não há geocodificação de endereço nem envio do GPS a um serviço extra de busca de ruas.

## Evidências e privacidade

Máximo de 3 arquivos por alerta, nos primeiros 15 minutos de alerta ativo: JPG/PNG até 5 MB e MP4 até 20 MB. Imagens têm limite de 4 megapixels no servidor e são recodificadas sem EXIF. O seletor reduz a largura de imagens para até 1.600 pixels antes de enviar. O servidor confere assinatura, MIME, extensão, tamanho, integridade e resolução, e remove contêineres `udta`, `meta` e `uuid` de MP4 sem deslocar offsets. MP4 fragmentado e outros formatos de vídeo são recusados.

Isso não desfoca rostos nem remove dados visíveis/áudio ou toda forma possível de telemetria de fabricantes. Não é uma análise antivírus, classificação automática de violência ou validação da veracidade. Requer revisão operacional antes de uso público. Há aviso antes de abrir cada evidência; links assinados duram 60 segundos e continuam válidos até expirar mesmo após revogação posterior.

Bucket privado, upload somente pela Edge Function; o cliente não recebe grants de escrita no Storage. O servidor remove o objeto se o registro de evidência falhar. Se um upload falhar após publicar o relato, o relato permanece salvo e pode receber nova tentativa nos detalhes; não se publica outro relato para repetir o envio. Texto/descrição também podem identificar pessoas: a interface orienta a minimização, mas não faz anonimização semântica automática.

## Corrigir opinião e informar resolução

O ícone ⓘ dos quatro botões de opinião mostra ajuda breve ao passar o mouse ou receber foco pelo teclado. No celular, toque ou mantenha o dedo no próprio ícone, inclusive no botão selecionado. Passar o mouse no restante do botão não abre a dica. Consultar a ajuda não envia contribuição. Escape fecha a dica no navegador.

Cada pessoa mantém **uma opinião ativa por alerta** (`confirm`, `contest` ou `spam`). Pode trocar ou retirar a própria opinião; a anterior deixa de contar. Repetir a mesma operação é idempotente. O autor não valida o próprio relato. Contagens, score e consenso comunitário são recalculados no servidor sob lock do alerta. Reduzir o consenso pode retornar um alerta não moderado a ativo; decisões administrativas e estados encerrados não são reabertos por votos.

O aviso **Informar que foi resolvido** é independente da opinião, inclusive para o autor. Confirmações anteriores permanecem. Há um aviso ativo por pessoa/alerta, que pode ser retirado. Qualquer quantidade de avisos exibe **Resolução informada pela comunidade · aguarda análise da moderação**, sem encerrar automaticamente a ocorrência. O painel inclui esses alertas na fila, e somente administrador ativo aplica `resolved`, com justificativa. Retirar um aviso após a decisão não desfaz a moderação. Novas contribuições são limitadas a alertas abertos; retirar uma contribuição própria ainda é permitido em estados encerrados visíveis. Alertas ocultos e contas suspensas continuam protegidos.

`private.resolution_reports` guarda avisos individuais e `private.contribution_history` preserva trocas/retiradas, sem publicação por API ou Realtime. `my_contribution` retorna somente a opinião e o aviso do próprio usuário; o público vê apenas totais e atualizações sem identidade. O campo agregado `resolved_votes` foi mantido por compatibilidade, mas agora conta avisos independentes, não votos que encerram o alerta. Dados legados são migrados; encerramentos comunitários antigos sem moderação voltam à análise, preservando histórico. O demo local usa armazenamento v2 para refletir o novo modelo; dados reais não são apagados.

## Painel administrativo

O painel organiza **Ocorrências**, **Usuários** e **Histórico** em abas. A lista mostra cartões resumidos, busca e **Analisar ocorrência**. A revisão oferece somente **Confirmar relato**, **Marcar como resolvido** e **Ocultar relato**, conforme as transições válidas do status atual. Um relato já confirmado não oferece confirmar novamente. Se faltar informação, feche a revisão sem salvar. Retomar acompanhamento, contestar administrativamente, inativar manualmente e excluir separadamente foram retirados da interface para evitar decisões redundantes.

Confirmar e resolver têm apenas **Observação (opcional)**; ao concluir, um texto padrão identificando a decisão administrativa é enviado junto com eventual observação, mantendo a auditoria e o limite de 500 caracteres. Não há seleção de motivos como via liberada ou atendimento encerrado. Ocultar exige motivo escrito de 8 a 500 caracteres e conclusão explícita pelo botão **Ocultar relato**. No banco essa operação continua usando `spam`, que oculta o conteúdo da comunidade. Ela não apaga permanentemente o histórico.

Ocorrências resolvidas, encerradas por prazo ou ocultadas oferecem **Rever decisão → Reabrir análise**, com motivo obrigatório, em vez das ações comuns. Isso volta a tornar o relato visível para avaliação. Excluídos não podem ser reabertos. **Voltar sem salvar** e fechar a revisão não fazem requisição de moderação. A fila inclui novos relatos ainda não moderados, confirmações comunitárias não revisadas, divergências e avisos pendentes de resolução. Revisão de contas permanece individual; suspensão exige motivo e confirmação. Resumo numérico e compartilhamento ficam no Histórico.

Essa simplificação não altera as permissões do servidor: `moderate_alert` e `manage_user` continuam verificando administrador ativo, transições e motivo de 8 a 500 caracteres. Não houve migração ou alteração de papel nesta revisão. O histórico mostra ação, responsável, data e motivo; erros do servidor preservam o formulário para correção e nova tentativa.

## Realtime e push

O MVP usa **Postgres Changes**, com publicação apenas de `public.alerts`, autorização RLS e cancelamento de inscrição ao sair. Nenhuma identidade interna, voto individual ou GPS exato entra na publicação. O feed é limitado a 500 registros e filtrado no dispositivo por categoria, status, risco e distância; polling de 60 segundos e atualização ao retomar o app complementam a assinatura. Broadcast privado com canais por região e consulta geoespacial paginada são evolução prioritária para escala; não se publica o esquema `private`.

Para push real:

1. Configure um projeto EAS e credenciais FCM v1 no Android e APNs no iOS. Gere um development build (`npx expo install expo-dev-client`, `eas build --profile development --platform android` ou iOS), ou um build de prévia com `eas build --profile preview`. Expo Go não é a referência para push remoto.
2. Preencha `EXPO_PUBLIC_EAS_PROJECT_ID`. No aplicativo, abra Notificações, leia a explicação e registre o dispositivo físico. Defina a zona por GPS, raio, categorias e salve.
3. Como proprietário, preencha `private.runtime_config.project_url` e execute `supabase/hosting/enable-jobs.sql`. Esse script gera a credencial aleatória **dentro do Vault**, agenda `push-dispatch` a cada minuto e `retention` diariamente às 06:20 UTC. Não retorna o segredo. Já foi executado no projeto conectado nesta implantação.
4. As funções verificam a credencial por RPC exclusiva de `service_role`; JWT comum não autoriza execução. Um servidor alternativo pode usar `PUSH_DISPATCH_SECRET` via `supabase secrets set`. Se a proteção adicional Expo Push estiver ativada, configure `EXPO_ACCESS_TOKEN` somente na função.
5. Inspecione os resultados do Cron e as respostas HTTP sem registrar tokens, relatos ou credenciais. O script `npm run retention` continua disponível como alternativa operacional manual.

O worker filtra zona aproximada salva, raio, categoria, validade, conta ativa e horário silencioso com fuso. A zona não acompanha o usuário em segundo plano. Há no máximo um aviso por token/evento (`new` e `confirmed`), cinco por hora e intervalo mínimo de 60 segundos. O payload é genérico e contém somente ID para navegação aos detalhes. Em primeiro plano, exibe banner/lista sem som; com app fechado, aplica som/canal e regras do sistema.

As entregas são reservadas atomicamente antes do envio. Uma falha de rede com resultado incerto não é repetida automaticamente para evitar duplicidade; pode haver perda de aviso. Tokens inválidos detectados na resposta imediata são removidos. Coleta posterior dos receipts Expo, retentativa controlada e rastreamento de erros devem ser adicionados antes de produção. GPS em segundo plano não é solicitado; o sistema usa a zona que a pessoa escolheu e pode remover.

## Segurança e retenção

Todas as tabelas públicas têm RLS e grants mínimos; as tabelas privadas também têm RLS, sem políticas de cliente. Escritas privilegiadas usam funções com `search_path=''`, papel consultado no banco e permissões de execução explícitas. Auditoria é somente leitura administrativa; não há escrita de cliente. Perfil expõe nome/papel/status somente ao titular e aos administradores. E-mail permanece no Supabase Auth; telefone não é coletado no MVP por minimização de dados.

Limites transacionais por conta: 5 relatos/hora, 30 alterações de opinião/hora, 20 alterações de aviso de resolução/hora, 10 comentários/hora, 10 correções/hora e 10 tentativas de upload/hora. Comentários até 500 caracteres. Requisições recusadas são validadas no banco; limites externos por IP, CAPTCHA, proteção contra automação e revisão jurídica ainda são necessários antes de um lançamento público.

O pedido de exclusão bloqueia o perfil, apaga tokens/preferências e torna relatos nomeados anônimos imediatamente. O job `scripts/retention.mjs` processa pedidos após um dia, exclui alertas removidos/spam e mídias após 30 dias, reduz o GPS privado à precisão pública após 30 dias e elimina auditoria após 90 dias. O vínculo de autoria é mantido enquanto a conta existe; a exclusão Auth remove a associação pessoal. Retenção em backups e obrigações institucionais precisam de política própria. Sem agendar o job, essa limpeza **não ocorre automaticamente**.

## Executar verificações

```bash
npm run typecheck
npm run lint
npm test
npm run test:rls
npx expo install --check
npm run export:web
npx expo export --platform android --output-dir dist-android
npx expo export --platform ios --output-dir dist-ios
npx playwright install chromium --only-shell
npm run test:e2e
# Com o bundle conectado ao Supabase exportado em dist:
npm run test:e2e:admin
```

O E2E exige exportação web feita **sem credenciais Supabase**, usa demo local e geolocalização simulada. `PLAYWRIGHT_CHANNEL=msedge` permite usar Edge instalado; alternativamente, o script aceita `PLAYWRIGHT_EXECUTABLE_PATH`. Testes ao vivo: `npm run test:live`, após configurar as contas e variáveis de [docs/TESTING.md](docs/TESTING.md). Não confundir mocks de Auth e contratos de plataforma PGlite com uma integração Auth/Storage completa.

## Fontes e decisões

Foram lidos os anexos `SafeNow_artigo.docx` e `SFNW.asta`, sem executar ou obedecer a instruções contidas neles. O artigo foi extraído do OOXML; `EntityStore` do Astah contém serialização Java e teve seus textos de modelo extraídos sem desserializar objetos Java. Não havia aplicação existente ou instruções AGENTS no workspace.

Por solicitação do proprietário, o perfil Colaborador do modelo original foi incorporado ao Usuário comum, pois ambos já tinham as mesmas permissões. A migração `safenow_two_roles` converte contas existentes preservando IDs, status, relatos e preferências, registra a conversão na auditoria e restringe o banco a `user`/`admin`. As migrações anteriores são mantidas como histórico.

Preservados: mapa central, perfil público anônimo, hierarquia de atores, GPS obrigatório, evidências, validação, ciclo de vida, suspensão com motivo e histórico. Adaptações: Java/NetBeans e `senhaUsuario` do planejamento deram lugar ao Expo solicitado e ao Supabase Auth; Pessoa/Usuario foram separados entre Auth e perfil; o "score de risco" foi dividido em risco percebido e confiabilidade para evitar ambiguidade; telefone foi omitido; sugestão de deslocamento usa locais verificados/mapa externo sem alegar rota segura. Textos de classes de exercícios/academia presentes no arquivo Astah são resíduos sem relação com o domínio e não foram implementados.

O Citizen foi referência de princípios de mapa, resumo, atualização e detalhes. Marca, textos, componentes e layouts são próprios do SafeNow.

- [Articulação mapa, contexto e informação do Citizen](https://citizen.com/)
- [Central oficial de suporte Citizen](https://support.citizen.com/hc/en-us)
- [Matriz de versões Expo](https://docs.expo.dev/versions/latest/)
- [Mapas no Expo](https://docs.expo.dev/versions/latest/sdk/map-view/)
- [Localização no Expo](https://docs.expo.dev/versions/latest/sdk/location/)
- [Notificações no Expo](https://docs.expo.dev/versions/latest/sdk/notifications/)
- [Supabase Auth para React Native](https://supabase.com/docs/guides/auth/quickstarts/react-native)
- [Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Storage e controle de acesso](https://supabase.com/docs/guides/storage/security/access-control)
- [Uploads](https://supabase.com/docs/guides/storage/uploads/standard-uploads)
- [Atualizações de banco em Realtime](https://supabase.com/docs/guides/realtime/subscribing-to-database-changes)

## Limitações e próximas prioridades

Não há garantia medida de latência de 5 segundos, disponibilidade de 99% ou GPS de 10–20 m. Precisão é variável e apresentada ao usuário. O projeto Supabase conectado recebeu as migrações, categorias, Storage privado, funções e jobs; Auth, autorização, alertas e upload foram testados no servidor real. O envio efetivo de e-mail pelo SMTP e push em dispositivo físico ainda dependem de configuração e homologação externa. Não foram fornecidos EAS/FCM/APNs ou dispositivos para essa homologação. A conta do primeiro administrador já foi definida no servidor; novos cadastros públicos entram somente como usuário comum.

Prioridades: homologar Auth/Storage/push em dispositivos, realizar testes de usabilidade simulados e acessibilidade com leitores de tela, adicionar paginação/consulta PostGIS e Broadcast regional privado, revisar moderação/abuso e processamento robusto de vídeo, cadastrar locais de apoio verificados e definir governança institucional de privacidade. Os pinos e a confirmação de localização funcionam no navegador e têm implementação equivalente no mapa nativo; a interação física Android/iOS ainda precisa de homologação.

## Testar no iPhone sem digitar comandos

Para iniciar o teste no iPhone a partir do Windows sem digitar comandos, use `Iniciar-iPhone.cmd`. O arquivo verifica a sessão, abre o login Expo no navegador quando necessário e inicia o servidor Expo Go na porta 8083. Conclua a autorização com a mesma conta usada no Expo Go, mantenha ambos na mesma rede e escaneie o QR Code. A janela precisa permanecer aberta. O launcher não instala dependências, não usa credenciais do Supabase e não gera um build iOS independente.

No Windows, a abertura padrão do Expo por `cmd.exe /c start` falhou neste computador. `scripts/iphone-login.mjs` mantém integralmente o login PKCE oficial do Expo, usa `BROWSER=none` somente nesse processo e abre o endereço gerado diretamente no Brave (ou Edge/Chrome disponível), com argumentos separados e sem shell. Não captura senha, não copia cookies do navegador e não modifica `node_modules`. Em 15/10/2026 o fluxo foi concluído pelo proprietário: `whoami` confirmou a conta, `/status` respondeu `packager-status:running` e o bundle iOS do servidor compilou com sucesso. A avaliação funcional no aparelho depende de abrir esse QR Code.

## Consulta por distância e zoom

O filtro de status oferece somente **Em andamento**, **Em análise**, **Confirmados** e **Resolvidos**. Em andamento reúne relatos abertos; Em análise inclui `under_review` e `contested`. Os estados internos e as transições administrativas foram preservados, assim como o acesso ao histórico. Retirar botões de filtro não apaga dados nem encerra alertas.

As categorias são apresentadas em ordem decrescente do `default_risk` existente: Violência, Incêndio e Roubo (4); Pessoa desaparecida e Acidente (3); Trânsito / via bloqueada, Furto e Outra ocorrência (2); Animal perdido (1). Empates mantêm uma ordem estável. Essa ordem usa sugestões do protótipo, não estatística criminal nem risco garantido; o autor pode ajustar o risco observado de 1 a 4. `blocked` continua sendo a mesma categoria no banco, exibida com um nome mais abrangente na interface.

Outra ocorrência e Trânsito / via bloqueada mostram **Qual foi o problema?**, sem preencher um título genérico. Esse texto é salvo no campo `title` do alerta, aparece na revisão e nos detalhes, e participa da correção e do rascunho existentes. Trocar de categoria preserva texto escrito pelo usuário e substitui somente a sugestão automática. Não foi criada uma categoria no banco para cada título livre.

O mapa inicia em **Sem limite de distância**, com os alertas disponíveis que respeitam os demais filtros. Essa visão não delimita automaticamente o município: pode incluir outras cidades presentes no feed, que continua limitado a 500 registros. Selecionar 1, 3 ou 10 km aplica distância geográfica em linha reta (Haversine, metros) a partir da última posição GPS obtida. Sem GPS, o raio fica explicitamente pendente e a interface oferece ativar a localização, sem inventar um centro. O cálculo usa as coordenadas públicas aproximadas das ocorrências e a precisão variável do dispositivo; não é distância de rota.

A roda do mouse aproxima/afasta quando o ponteiro está sobre o mapa. No navegador móvel, dois dedos fazem zoom por pinça; o mapa nativo mantém `zoomEnabled` e `scrollEnabled` explícitos. O navegador exibe uma escala em metros/quilômetros. Zoom e deslocamento não alteram a distância escolhida nos filtros.
