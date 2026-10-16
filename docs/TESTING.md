# Verificação do protótipo

Verificações realizadas neste workspace Windows em 14 de outubro de 2026. O projeto original estava vazio. Na etapa inicial não havia backend; posteriormente o Supabase conectado foi configurado e testado. Não há Docker ou dispositivos Android/iOS conectados. Veja [DEPLOYMENT.md](DEPLOYMENT.md) para a integração real.

| Verificação | Resultado | O que comprova |
| --- | --- | --- |
| TypeScript da aplicação | Passou | Tipagem estrita, campos/rotas e contratos do cliente |
| TypeScript das funções (`typecheck:edge`) | Passou | Tipos e imports dos handlers, com contrato Deno tipado para ambiente de teste |
| ESLint | Passou | Regras Expo/React e hooks sem erros |
| Vitest | 88 testes passaram | Domínio, categorias, motivos administrativos, Auth com gateway, mensagens de erro, callbacks, autorização SQL e handlers de funções com rede substituída |
| Migrações no PostgreSQL/PGlite | Passaram | Oito migrações, grants, RLS, nomeação segura e funções SQL; agendamento hospedado ignora ambiente sem configuração |
| `expo install --check` | Passou | Dependências compatíveis com o SDK instalado |
| Expo export web | Passou | Bundle web compilado |
| Expo export Android | Passou | Bundle nativo e bytecode Hermes compilados |
| Expo export iOS | Passou | Bundle nativo e bytecode Hermes compilados |
| Navegação Playwright/Chromium | Passou | Fluxos de demo executados em viewport 412×915 sem erros de runtime |
| Interface conectada Playwright/Chromium | Passou | Formulário chama o Auth real, recusa senha inválida, não oferece cadastro administrativo e trata retorno inválido na Site URL |
| Auth, PostgREST e Storage remoto | Passaram | Login correto/incorreto, suspensão, autorização administrativa, relato, voto e foto privada no Supabase real |
| SMTP e entrega push em telefone | Não executados | Link de recuperação gerado e worker com HTTP 200, sem comprovar entrega de e-mail ou push físico |
| Build de APK/IPA e instalação física | Não executados | Exigem ambiente Android/Xcode ou EAS com credenciais |
| `deno check` nativo | Bloqueado no ambiente | Sandbox Windows recusou canonicalização de cache npm; o typecheck alternativo e os testes dos handlers passaram |

Bundles não equivalem a APK/IPA nem à homologação de sensores, permissões e push em hardware. Não há evidência de disponibilidade de 99%, latência máxima de 5 segundos, acessibilidade com leitor de tela físico ou precisão garantida de GPS. Esses são objetivos de avaliação futura.

## Comandos reproduzíveis

```bash
npm ci
npm run typecheck
npm run typecheck:edge
npm run lint
npm test
npx expo install --check
npm run export:web
npx expo export --platform android --output-dir dist-android
npx expo export --platform ios --output-dir dist-ios
npx playwright install chromium --only-shell
npm run test:e2e
# Com a prévia conectada executando em localhost:3000:
npm run test:e2e:connected
# Bundle conectado em dist; API interceptada, sem modificar dados reais:
npm run test:e2e:admin
```

O script E2E serve o bundle `dist` em `127.0.0.1:8097`, abre um navegador de teste isolado, concede GPS simulado e encerra o servidor/navegador ao concluir. Não toca em abas ou perfis pessoais. Aceita `PLAYWRIGHT_CHANNEL` ou `PLAYWRIGHT_EXECUTABLE_PATH`. Sem Supabase configurado, percorre abertura → demo → GPS → relato anônimo → comentário → correção → exclusão → contribuição → troca/retirada de opinião → aviso/retirada de resolução independente → perfil comum → zona/preferências. As capturas de QA ficam em `work/` e não são distribuídas com o código.

O E2E também abre uma ocorrência pelo pino Leaflet, confere seu mapa individual, expande/recolhe filtros e verifica o ponto azul do GPS. No relato, recusa revisão antes da confirmação, confirma o ponto, altera a posição pelo mapa, exige nova confirmação e publica. O detalhe deve conter um único pino da ocorrência selecionada. Uma corrida de animação Leaflet ao alternar telas foi corrigida desativando transições de zoom e encerrando o mapa no cleanup; o fluxo completo passou sem erros de runtime.

No ambiente desta execução, npm foi usado por seu `npm-cli.js` em uma pasta de trabalho, porque o wrapper pnpm tinha restrições no diretório pessoal. Para Expo, `__UNSAFE_EXPO_HOME_DIRECTORY` apontou a um diretório temporário do workspace e `EXPO_NO_TELEMETRY=1`. A exportação conjunta dos dois sistemas falhou ao gravar um temporário Hermes; exportações separadas, com `TEMP`/`TMP` no workspace, passaram. O Edge instalado falhou dentro do sandbox; o Chromium Headless Shell em um diretório de trabalho executou o E2E com sucesso. Essas adaptações são do ambiente de execução e não devem ser necessárias em uma máquina de desenvolvimento normal.

## Escopo dos testes automatizados

Revisão administrativa em 15/10/2026: `tests/moderation.test.ts` verifica textos de auditoria padrão para confirmar/resolver, observação opcional dentro do limite total, motivo escrito para ocultar/reabrir, somente decisões essenciais permitidas, reabertura contextual, fila de relatos não moderados, suspensão/reativação e nomes compreensíveis. `scripts/smoke-admin.mjs` percorre a interface compilada em computador e viewport de celular com API Supabase e WebSocket interceptados. Confere a ausência das opções antigas, resolve/confirma sem digitar, cancela sem mutação, oculta com motivo, preserva o texto após erro do servidor, reabre um resolvido com justificativa e bloqueia confirmação repetida. Também verifica motivos separados por conta, suspensão/reativação, histórico e acesso comum negado. Não altera contas nem ocorrências reais e não substitui os testes SQL de autorização. Capturas ficam em `work/smoke-admin-*.png`.

A revisão passou a abrir uma ocorrência ou conta por vez. O teste percorre as duas etapas, salva, cancela, fecha a revisão e abre outra pessoa sem herdar justificativa. A animação web foi desativada para evitar sobreposição de janelas de revisão durante a troca rápida de contas; no nativo permanece a apresentação própria do sistema. `tests/categories.test.ts` verifica ordem por risco sem mutar a origem, nome visual de trânsito, títulos livres e preservação de texto ao trocar categoria. O E2E confirma os quatro filtros visíveis, a ordem das nove categorias e publica um relato com título específico de trânsito, conferindo-o nos detalhes. O domínio verifica que Em análise reúne revisão e contestação sem incluir encerrados.

`tests/domain.test.ts`: login válido e papel consultado, senha incorreta, conta suspensa e sign-out, ausência de autorização administrativa comum, falha de perfil, e-mail/senha/termos, relato, permissão/GPS, precisão variável, score, transições, filtros vazios, raio/categoria/validade e horário silencioso.

`tests/database.test.ts`: executa PostgreSQL real compilado para WASM, com esquemas mínimos `auth` e `storage` e roles equivalentes para exercitar as políticas da aplicação. O SQL das migrações não é substituído. Testa grants, RLS em todas as tabelas, autopromoção bloqueada, metadados de cadastro forjados, suspensão mesmo com JWT, leitura privada, usuário sem sessão, anonimato no payload, coordenadas arredondadas, idempotência/autovalidação, troca/retirada e recálculo de opinião, resolução independente sem encerramento automático, histórico privado e migração legada, consenso, correção temporal, exclusão, moderação/auditoria, transições inválidas, tokens, Storage, comentários, limite de evidências, deduplicação de entregas e exclusão de conta.

PGlite não inicia GoTrue, PostgREST, Storage HTTP ou o servidor Realtime. O teste unitário de Auth usa gateway substituído. A integração separada `deployment-check`, descrita em DEPLOYMENT.md, verificou senhas e operações no projeto remoto com contas descartáveis, removidas depois. Realtime entre dois dispositivos continua pendente de homologação.

`tests/edge.test.ts`: chama o handler real do upload, substituindo somente as fronteiras Supabase/rede. Rejeita sessão/autoria inválida, MIME forjado e métodos incorretos; recodifica JPEG com APP1/EXIF de teste e verifica remoção dos metadados; confirma remoção do objeto após falha de registro.

`tests/worker.test.ts`: chama o despachante real com Supabase/fetch substituídos. Verifica segredo do servidor, filtro por zona, payload mínimo, canal sem som, reserva já processada e envio com resultado incerto. Testes de domínio também verificam categorias e silêncio por fuso. As reservas e limites reais estão no SQL testado.

`tests/auth-links.test.ts`: verifica retorno web por origem/porta, deep link móvel, PKCE, hash legado, distinção entre cadastro/recuperação, retorno na Site URL raiz e rejeição de protocolos/links inválidos. As migrações 004 e 005 acrescentam testes de promoção somente após confirmação do e-mail e negação de rotinas de jobs/retenção para usuários comuns.

## Integração Auth ao vivo

Configure um projeto **de teste** com as migrações. Crie uma conta comum ativa e uma suspensa. Suspenda pelo administrador no app, com motivo. Forneça somente no terminal:

- `SUPABASE_URL` e `SUPABASE_ANON_KEY`.
- `TEST_USER_EMAIL`, `TEST_USER_PASSWORD` de conta comum ativa.
- `TEST_SUSPENDED_EMAIL`, `TEST_SUSPENDED_PASSWORD`.

```bash
npm run test:live
```

O script testa senha incorreta, senha válida, consulta do papel, RPC administrativa recusada para usuário comum e RLS recusando dados/mutações de conta suspensa. Uma suspensão de aplicação pode coexistir com token Auth válido; **o acesso à aplicação deve continuar negado no servidor**. O script não imprime senhas/tokens. Sem configuração, retorna código 2 e informa que a integração não foi executada.

## Homologação manual antes da apresentação

1. Android e iOS: cadastrar com aceite e entrar imediatamente, login errado/correto e recuperar senha pelo deep link no mesmo dispositivo. Sair e verificar que não há cache de outra conta.
2. Conta comum: abrir `/admin` e chamar as RPCs diretamente; ambas as tentativas devem ser negadas. Forjar `signup_role=admin` em uma conta de teste deve resultar em perfil comum.
3. Administrador: usar a tela de login comum, moderar com motivo, conferir auditoria, suspender outra conta. A conta suspensa deve perder leitura/escrita mesmo se já estiver aberta.
4. GPS: negar permissão, desligar localização, testar sinal impreciso e depois posição válida. Confirmar que mapa/relato mostram estado coerente.
5. Upload: foto JPEG com EXIF, PNG e MP4 convencional, limite de tamanho, arquivo disfarçado, quatro anexos e falha de rede após criação. Conferir que bucket não é público e outro usuário não consegue abrir mídia de alerta oculto.
6. Dois dispositivos: criar alerta e mudar status, verificar Realtime e inscrição removida ao sair. Repetir a mesma opinião sem duplicar, trocar e retirar; validar bloqueio ao próprio autor. Confirmar e informar resolução separadamente, retirar cada contribuição e verificar que somente a moderação encerra como resolvido.
7. Push: registrar token, configurar categoria/raio/silêncio, chamar worker, testar primeiro plano/app fechado e toque navegando aos detalhes. Repetir worker sem duplicar evento. Desativar zona/categoria e confirmar ausência de avisos.
8. Perfil: alterar anonimato, verificar nome público apenas quando explicitamente escolhido, salvar/descartar rascunho, solicitar exclusão e executar retenção no servidor de teste.
9. Leitor de tela, fonte ampliada e contraste em ambos os sistemas; validação de usabilidade em simulações, sem exposição real a perigo.

## Problemas corrigidos durante a implementação

Na conexão hospedada, o teste do retorno de Auth na raiz detectou uma corrida entre a navegação inicial e a leitura assíncrona do link. O retorno web agora é capturado sincronamente e encaminhado ao callback preservando código/hash; o teste conectado passou após a correção. A compilação de teste habilita a demo separadamente e a compilação de uso real limpa o cache do Metro para garantir que a troca de variáveis públicas seja aplicada. Os nomes locais das migrações foram alinhados ao histórico do servidor para permitir futuras atualizações pela CLI.

Foram corrigidos erros de JSX/tipos da navegação, atualização de estado por efeitos, dependências opcionais Expo fora da matriz, caminho de import do despachante, tipo Buffer do decoder PNG, fixture PNG corrompida no seed e referências de assets do template. As regras SQL passaram desde a primeira execução; controles adicionais de upload/push foram incorporados e os testes repetidos. Não foi necessário enfraquecer RLS ou usar bucket público para fazer os testes passarem.

A ajuda dos quatro botões de contribuição é verificada no E2E por hover e foco somente no ícone ⓘ, toque no ícone e pressão longa nele simulada por eventos touch. Passar o mouse no botão principal ou sair do ícone não mantém a dica aberta. O teste confirma que consultar a ajuda não altera a opinião, inclusive no botão selecionado/desabilitado. A interação física Android/iOS continua dependendo de homologação em aparelho.

Filtro de distância: testes de domínio verificam unidades em metros, limite inclusivo do raio, diferentes raios, ausência de GPS, visão sem limite e preservação dos demais filtros. O E2E seleciona 1 km sem GPS, confere o aviso pendente, simula GPS distante para produzir lista vazia, remove o limite para recuperar os alertas e valida zoom com wheel e pinça touch no navegador. A interação física em Android/iOS permanece sujeita à homologação em aparelho.
