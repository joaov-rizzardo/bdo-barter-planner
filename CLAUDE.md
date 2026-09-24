# BDO Barter Planner

App desktop (Tauri 2 + React + TypeScript) para planejar permutas (barter) no Black Desert
Online: montar a cadeia de trocas T0→T7, simular a carga do navio, calcular a barganha gasta
e gerar um roteiro de viagem com checklist. Interface em português do Brasil.

## Comandos

| Comando                 | O que faz                                                        |
| ----------------------- | ---------------------------------------------------------------- |
| `npm run dev`           | Vite em `http://localhost:1420` (porta fixa, exigida pelo Tauri) |
| `npm run tauri dev`     | Janela desktop + Vite (precisa do toolchain Rust)                |
| `npm run build`         | `tsc -b` + build do frontend em `dist/`                          |
| `npm run tauri build`   | Empacota o app desktop                                           |
| `npm test`              | Vitest em watch                                                  |
| `npm run test:run`      | Vitest uma vez (usar em CI)                                      |
| `npm run typecheck`     | TypeScript strict                                                |
| `npm run lint`          | ESLint                                                           |
| `npm run format`        | Prettier                                                         |
| `npm run data:convert`  | Regenera `src/data/*.json` a partir de `data/raw/*.json`         |

Rust ainda não está instalado nesta máquina; sem ele só o frontend roda (`npm run dev`) — o
shell Rust do Tauri nunca foi compilado aqui. Para rodar/compilar no Linux:
`curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh` mais as libs do WebKitGTK
(no Fedora: `sudo dnf install webkit2gtk4.1-devel openssl-devel libappindicator-gtk3-devel
librsvg2-devel` e `sudo dnf group install "C Development Tools and Libraries"`).

## Gerar o .exe do Windows

Três caminhos, do mais confiável ao menos:

1. **GitHub Actions** (não precisa de Windows nem de Rust aqui): workflow
   `.github/workflows/build-windows.yml`, disparado à mão (`workflow_dispatch`) ou por tag
   `v*`. Sai o artefato `bdo-barter-windows` com o `.exe` solto
   (`src-tauri/target/release/BDO Barter Planner.exe`), o instalador NSIS e o `.msi`.
2. **Na própria máquina Windows**: instalar Rust (rustup, toolchain MSVC), o
   "Desktop development with C++" do Visual Studio Build Tools e o WebView2 (já vem no
   Windows 11); depois `npm ci` e `npm run tauri build` na raiz do projeto.
3. **Cross-compile do Linux** (último recurso, segundo a própria doc do Tauri):
   `rustup target add x86_64-pc-windows-msvc`, `cargo install --locked cargo-xwin` e
   `npm run tauri build -- --runner cargo-xwin --target x86_64-pc-windows-msvc --bundles nsis`.
   Só o NSIS sai desse caminho: `.msi` precisa de Windows.

Os ícones do bundle (incluindo `icon.ico`, exigido pelo Windows) foram gerados com
`npx tauri icon`; para trocar a arte, rode o comando de novo com um PNG de 1024×1024.

## Arquitetura

```
src/
  core/            <- domínio puro: sem React, sem Zustand, sem Tauri (ESLint bloqueia)
    models/        types.ts: Island, BarterItem, MarketMaterial, Trade, AppSettings
    models/        itemIndex.ts: consulta por item (tier, peso, empilha, é material T0)
    schemas/       gameData.ts: validação Zod dos 4 arquivos + integridade referencial
    data/          tierRules.ts (regras por degrau, pesos, empilhamento, MAX_BARTER),
                   sampleData.ts (fixture pequena para testes)
    barter/        cost.ts: soma das reduções e resumo de barganha do plano
    chain/         routeIndex.ts (rotas por item/ilha) e resolveChain.ts (estoque, faltas
                   de origem com as opções de precedente, lista de compras, sobras)
    settings/      defaults.ts (padrões, schema e normalização) e ports.ts (ajustes de
                   armazém/gerente de cais e validação de base/descarga)
    cargo/         cargo.ts: peso, slots (empilha x não empilha) e limite de espaço livre
    balance/       itemBalance.ts: demanda/produção por item, déficit, sobra e estoque
    routing/       distance.ts (euclidiana + matriz de overrides), precedence.ts,
                   order.ts (Held-Karp exato até 10 trocas + vizinho mais próximo/2-opt),
                   simulate.ts (passos da viagem com peso/slots), solver.ts (RouteSolver),
                   fixtures.ts (cenário usado só nos testes)
  data/            JSON normalizado gerado pelo conversor + loadGameData() memoizado
  store/           persistence.ts (tauri-plugin-store / localStorage), settingsStore.ts,
                   dataStore.ts (dados embutidos ou importados), planStore.ts (trocas),
                   uiStore.ts (aba ativa)
  ui/              App.tsx, format.ts, describe.ts, tiers.ts, components/ (controls, Modal,
                   ItemBadge), hooks/ (useIlhas, useCadeia), screens/ (Planejamento, Roteiro,
                   Configurações + planejamento/* e configuracoes/*)
src-tauri/         shell Rust: main.rs, lib.rs, tauri.conf.json, capabilities/
data/raw/          arquivos brutos do projeto original (fonte do conversor)
public/icons/      215 ícones .webp dos itens
scripts/           convert-data.mjs
```

Regra central: **toda regra de negócio vive em `src/core/` e é testável sem DOM**. A UI lê o
estado do Zustand e chama funções puras do core; o Tauri só aparece na camada de persistência.

## Dados

`npm run data:convert` transforma os arquivos brutos em três coleções:

- `src/data/islands.json` — 96 portos: 91 com permutador e 5 só com Gerente de Cais
  (`PORTOS_SO_COM_GERENTE`, id `node-<id do BDOCodex>`, `barterer: null`), que servem só de
  parada para transferência ao inventário e venda de T7. Campos: `id`, `name`, `namePt`, `x`,
  `y`, `barterer`, `npcId`, `sourceTier`, `targetTier`, `hasWarehouse`, `hasWharfManager`.
- `src/data/barterItems.json` — 123 itens T1–T7 + Oceano, com `tier`, `weightLt`, `stacks`.
- `src/data/marketMaterials.json` — 91 bens terrestres (T0) com `weightLt` por unidade.
- `src/data/barterRoutes.json` — 4356 rotas reais: porto, item dado/recebido, proporção,
  `parleyRequired` e `exchangeMaxCount`. É a fonte de verdade das trocas possíveis,
  inclusive das receitas T0→T1. `kind`: `tier` (sobe degrau), `crow_coin`, `outro`.
  As rotas da região 0 (ofertas especiais por barra de ouro) são descartadas.

Os tiers usam as strings do jogo: `level_0` … `level_7` e `great_ocean`.
`TIER_RULES` (em `core/data/tierRules.ts`) virou reserva: só entra quando a rota traz dado
implausível — `maxTrocasEfetivo` e `custoBaseEfetivo` corrigem rotas de sub-grupo com
`exchangeMaxCount: 0` ou `parleyRequired: 68` (caso das T6→T7 nos dados brutos).
Coordenadas que faltam nos brutos vêm de `COORDENADAS_EXTRAS` (Ninho do Corvo, tirada do
BDOCodex). Porto sem posição no mapa tem `x`/`y` nulos e fica fora do cálculo de rota.
Para tirar coordenadas de nodes do BDOCodex, ver `docs/bdocodex-coordenadas.md`.
Materiais de recompensa (`receiveItemId` das rotas `outro`) não estão no catálogo:
`ItemIndex.nameOf` devolve `Item <id>` nesses casos. A Moeda Corvo (`CROW_COIN_ID` = `10`) entra
no `ItemIndex` à mão (nome do BDOCodex, ícone `public/icons/crow_coin.webp`, `tier: null`).
`hasWarehouse`/`hasWharfManager` **não** existem nos dados brutos: a lista inicial
(`PORTOS_COM_ARMAZEM` e `PORTOS_COM_GERENTE_DE_CAIS` em `scripts/convert-data.mjs`) é um palpite
editável nas Configurações.

## Regras de cadeia e estoque

Cada troca tem `hasStock: boolean` — o usuário marca se já tem o item de entrada:

- **Com estoque**: a entrada não gera demanda; aparece em `fromStock` ("precisa de N no armazém").
- **Sem estoque**: a entrada precisa vir de outra troca que o **usuário informe** (ou do
  mercado, no caso de bem T0). O app **não adiciona nada sozinho**: o que fica sem origem
  entra em `ChainResult.faltas` com a quantidade e as trocas precedentes possíveis
  (`opcoes`: porto, item de entrada, proporção, teto de trocas e barganha), e a tela mostra
  isso no painel "Trocas precedentes que faltam".
- **Sem origem possível em toda a cadeia**: `resolveChain` faz uma busca recursiva (com
  memória e proteção de ciclo) até o mercado; se nenhum caminho chega lá, o diagnóstico é
  `erro`/`sem_origem` e `possivel: false`.
- Outros diagnósticos: `cadeia_incompleta` (falta troca precedente, mas é possível),
  `sobra_de_itens`, `produto_final`, `compra_no_mercado`, `estoque_necessario`.
- A tela de Roteiro avisa quando o plano tem faltas: o roteiro assume que esses itens já
  estão no armazém.
- Rotas com faixa: nos dados reais **todas** as rotas T1→T2 e T2→T3 são `1:2-3`
  (`receiveQtyMin: 2`, `receiveQtyMax: 3`); T3→T4 é 1:2 e os degraus acima são 1:1. O
  formulário mostra a faixa no rótulo do porto (`1:2–3`) e tem o campo "Recebe por troca"
  para o usuário escolher, começando pelo **maior** valor. `Trade.outputQtyPerTrade` guarda
  a escolha; o balanço, a carga e o roteiro usam esse valor.
- `FaltaDeOrigem.opcoes` traz `receiveQty` (mínimo) e `receiveQtyMax`, e o painel estima as
  trocas necessárias como faixa ("precisa de 3 a 5 trocas").

## Regras fixas (não são configuráveis)

Decisões do usuário que simplificam o cálculo — não reintroduza campos para elas:

- **Reduções sempre somadas** (nível + pacote econômico + vice-capitão), limitadas a [0, 1].
- **Custo sempre arredondado para baixo** (`Math.floor`).
- **Barganha disponível é sempre `MAX_BARTER`** (1.000.000); `resumoBarganha` usa a constante.
- **Nível de permuta não tem tabela**: o usuário informa à mão a % que o nível dá
  (`BarterSettings.levelReduction`).
- **Navio**: `freeWeightLt`/`freeSlots` são o espaço **livre**, não a capacidade total, e é
  isso que vira `CargoLimits` na simulação (`limitesDoNavio`). `totalWeightLt` é a capacidade
  cheia; `freeWeightLt` é **derivado** (`total - soma de sailorsLt`, recalculado em
  `normalizeSettings`) e fica somente leitura na UI.
- **Transferência para o inventário**: sempre disponível, sem opção para desligar; é sempre
  **1 slot e no máximo uma por viagem**.
- **Sem importação de dados na UI**: o app usa só os dados embutidos em `src/data/`
  (regerados por `npm run data:convert`).

## Pendências de dados

- `hasWarehouse`/`hasWharfManager` são um palpite inicial (ver `PORTOS_COM_ARMAZEM` e
  `PORTOS_COM_GERENTE_DE_CAIS`).

## Estado e persistência

- `useSettingsStore` guarda `AppSettings` e grava a cada alteração; `useDataStore` só expõe os
  dados embutidos (sem persistência). `App.tsx` chama `hydrate()` de configurações, plano e
  progresso no mount e só renderiza as telas depois.
- `getStore()` devolve `tauri-plugin-store` (arquivo `bdo-barter.json`) quando `isTauri()`, e
  cai para `localStorage` no `npm run dev` fora do Tauri — é o que permite desenvolver a UI
  sem o toolchain Rust. Falha de gravação não quebra a UI: vira aviso na tela.
- Toda escrita passa por `normalizeSettings`, que limita as faixas (redução de 0 a 100%, peso
  e slots positivos) e **migra o formato antigo** salvo antes (`levelReductionOverride`,
  `maxWeightLt`, `slots`), para não quebrar configurações já gravadas.

## Tela de Planejamento

- O formulário é guiado pelos dados: item de entrada → saídas possíveis → portos, cada um com a
  proporção real, o teto de trocas e a barganha da rota. Nada de proporção digitada à mão.
- Entrada e saída usam `SeletorDeItem`: um modal com busca (sem acento; casa o nome em
  português e o em inglês, mas só o português é exibido), abas por tier (com contagem, e
  "Todos" primeiro; as abas só aparecem quando há mais de um tier na lista) e o ícone de cada
  item. Enter escolhe o primeiro resultado, Esc fecha. `Modal` fecha com Esc e com clique
  fora, e aceita `tamanho: 'md' | 'lg'`.
- Nomes longos: colunas de grid usam `minmax(0,1fr)` (com `1fr` puro o conteúdo largo estica o
  card e aperta o painel vizinho) e os nomes truncam com `truncate` + `min-w-0`, com o nome
  completo no `title`.
- `useCadeia()` confere o plano inteiro a cada render (memoizado) e devolve faltas, balanço,
  lista de compras, diagnósticos e resumo de barganha — é o ponto único de leitura para
  todos os painéis.
- O modal de limite de barganha abre no clique de **Calcular rota** (antes de ir para o
  Roteiro) e informa excedente, passo em que a barganha acaba e refreshes necessários.
- Déficit de item T0 aparece como "comprar" (vem do mercado), não como erro.

## Moeda Corvo

- O formulário oferece as rotas `tier` e as `crow_coin` (T1–T4 → Moeda Corvo). No seletor, a
  moeda aparece na aba "Moedas" e com o rótulo "Moeda" no lugar do tier.
- A moeda vai **direto para o personagem** (`ItemInfo.offShip`, `ItemIndex.isOffShip`): na
  simulação a saída não entra na carga, então a troca só tira peso e slot do navio, e a moeda
  não aparece na descarga da base.
- Rotas de moeda de sub-grupo vêm com `maxTrades: 0` e barganha implausível: a reserva é
  `CROW_COIN_MAX_TRADES` (1) e `CROW_COIN_BASE_COST` (21.650).
- Faixas largas de recebimento (ex.: 175–325) usam campo numérico em "Recebe por troca" em vez
  de lista.
- Na ordem de execução da cadeia, a troca por moeda fica logo depois do tier da entrada.

## Sobrepeso e inventário do personagem

- `ShipSettings.allowOverweight` (padrão desligado) libera navegar com sobrepeso;
  `overweightMode` escolhe entre `transferencia` (padrão) e `qualquer`.
- O teto é **150% da capacidade total**. Como a simulação trabalha sobre o espaço livre e o
  que já está a bordo é `total - livre`, sobra `livre + 0,5 × total` de carga planejada:
  é isso que `limitesDoNavio` grava em `CargoLimits.overweight.limitLt`.
- Depois de uma troca em sobrepeso o navio **trava**: nenhuma outra troca acontece antes de
  aliviar. No modo `transferencia` o sobrepeso só é aceito quando a transferência resolve na
  hora; no modo `qualquer` o navio pode seguir em sobrepeso até a base (fim da viagem).
- Transferência para o inventário: **1 slot**, no gerente de cais mais próximo
  (`RouteContext.wharfIslandIds`), **uma por viagem**. Item que empilha vai em pack inteiro
  (12 T4 = 1 slot), item que não empilha vai 1 unidade (12 T5 = 12 slots, não dá). Vale com
  ou sem sobrepeso — também serve para resolver falta de slot. O pack sai da carga em
  definitivo: viaja com o personagem e entra em `Trip.inventory` e no descarregamento da base.
  `melhorTransferencia` nunca leva o que ainda vai ser gasto nas trocas seguintes da viagem.
- Depois da **última** troca da viagem não há alívio de peso: o navio volta pesado e
  descarrega na base, desde que possa navegar (dentro do peso, ou em sobrepeso abaixo do
  teto). Sem sobrepeso liberado, ou com falta de slot, a regra normal continua valendo.
- Passo novo no roteiro: `TripStep` com `kind: 'transfer'`.

## Marinheiros

- `ShipSettings.sailorsLt`: peso de cada marinheiro equipado (padrão
  `PESO_PADRAO_MARINHEIRO_LT` = 200, editável um a um). Só o peso importa; velocidade não
  entra no cálculo.
- O solver recebe `RouteContext.sailorsLt` e monta as viagens como se **todos** pudessem
  ficar na base (`comFolga` soma o peso ao livre, mas **não** ao teto do sobrepeso: desequipar
  só vale quando deixa o navio leve, nunca para caber no teto de 150%). Depois, cada viagem
  recebe o **menor** número de marinheiros a desequipar (mais pesados primeiro) com que cabe
  **sem** sobrepeso, transferência para o inventário ou venda de T7 — desequipar na base é o
  alívio mais barato. Se nenhuma quantidade evita esses recursos, fica a que menos depende
  deles: `Trip.sailorsUnequipped`/`sailorsUnequippedLt`. O sobrepeso conta por **trecho
  navegado** acima do peso (passos `sail`), não pelo pico: o pico logo depois de uma troca
  pode não cair com os marinheiros, mas a volta pesada para a base, sim. Uma quantidade maior
  só é escolhida se reduzir esse custo; a troca que não cabe nem sozinha não desequipa ninguém.
- O roteiro mostra a instrução "desequipe N marinheiros" no topo da viagem, ou, quando cabe
  com todos, só um lembrete para equipar de volta — nenhum dos dois é passo do checklist.

## Venda de T7 para aliviar o navio

- `ShipSettings.sellT7` (padrão ligado; configurações antigas migram para ligado) vira
  `RouteContext.sellT7`. Só T7 (`level_7`) e só nos gerentes de cais (`wharfIslandIds`).
- Só vende quando é preciso, em dois momentos de `simularViagem`:
  **antes** de uma troca cuja carga resultante passaria do peso ou dos slots (ou com o navio já
  em sobrepeso), parando na doca que menos desvia do caminho até o porto da troca; e **depois**
  de uma troca que deixou o navio pesado, só se o próprio porto tem gerente de cais (navio
  pesado não navega).
- Vende todos os T7 livres a bordo; o que ainda vai ser gasto numa troca seguinte da viagem
  fica reservado. O vendido entra em `Trip.sold`, sai da carga e **não** volta na descarga da
  base. Passo novo no roteiro: `TripStep` com `kind: 'sell'`.
- A venda antecipada é tentada antes da transferência para o inventário.
- A ordem das trocas decide se a venda resolve (o T7 precisa nascer antes do aperto): quando a
  ordem mais curta não cabe, o solver tenta o mesmo percurso ao contrário (mesma distância).
  Vale para qualquer viagem, não só com T7: o peso aperta em pontos diferentes conforme a
  ordem. `montarViagem` ordena o grupo por id antes, para percursos empatados não variarem
  com a ordem de entrada (o cache do solver é pelo conjunto de trocas).
  Uma busca em profundidade por ordens viáveis foi testada e descartada: triplicava o tempo sem
  melhorar a distância.

## Rota e carga

- `RouteSolver` é a interface trocável: `createRouteSolver({ maxTrocasExato, reinicios,
  orcamentoMs })` devolve a estratégia padrão. Trocar de algoritmo não toca na UI.
- Cada **troca** é um nó da ordenação (não a ilha), então uma ilha pode ser visitada mais de
  uma vez na mesma viagem; paradas consecutivas na mesma ilha são agrupadas em `stops`.
- Precedência: B depende de A quando a saída de A é a entrada de B e B não tem estoque.
  Dependência que ficou em viagem anterior não bloqueia a sequência atual.
- Divisão em viagens: **guiada pela distância**. A cada passo o solver escolhe, entre as
  trocas cuja entrada já está a bordo (carregada na base ou produzida por uma troca já
  colocada), a que **menos aumenta o percurso** da viagem, e fecha a viagem quando nada mais
  cabe no navio. Em seguida move e troca cargas entre viagens enquanto a distância total cair
  (nunca cria viagem nova), e repete a construção com sorteio (GRASP) ficando com a melhor —
  `reinicios` (12) e `orcamentoMs` (5.000) limitam a busca, que é determinística.
  Se a troca não cabe nem sozinha, a viagem é emitida com o aviso `troca_nao_cabe`.
- O que a rota **não** otimiza: número de viagens (nunca aumenta), escolha do porto de cada
  troca (é sua) e lucro — só distância.
- Custo: ~0,7 s para 30 trocas em 10 viagens; ~7 s no pior caso testado (40 trocas, 10 por
  viagem). Por isso `useRoteiro` isola o solver em um `useMemo` próprio: marcar um passo no
  checklist não recalcula a rota.
- `simularViagem` calcula o carregamento da base (só o que não é produzido na própria
  viagem), recalcula peso e slots depois de cada passo e registra os picos.
- Portos sem coordenada entram no roteiro com distância zero e aviso `porto_sem_coordenada`.

## Convenções

- TypeScript strict com `exactOptionalPropertyTypes` e `noUncheckedIndexedAccess`.
- Imports de tipo sempre com `import type` (regra do ESLint).
- Nomes de domínio e textos da UI em português; identificadores técnicos em inglês quando já
  vêm dos dados (`sourceTier`, `weightLt`).
- Testes ao lado do código (`foo.ts` + `foo.test.ts`), só em `src/core/`.
- Prettier: aspas simples, ponto e vírgula, 100 colunas.
- Commits pequenos, um por fase, mensagem em português no formato `feat(fase-1): ...`.

## Fases

1. **Concluída** — scaffold, estrutura de pastas, conversor de dados, ícones, CLAUDE.md.
2. **Concluída** — schemas Zod, tabela de níveis, cálculo de barganha, índices de item/rota e
   conferência da cadeia com estoque e faltas de origem.
3. **Concluída** — Configurações (reduções de barganha, espaço livre do navio, base/descarga,
   tabela de portos) + persistência.
4. **Concluída** — Planejamento: formulário guiado pelas rotas, tabela editável, painel de
   barganha, balanço de itens, lista de compras, painel de faltas de origem, diagnósticos e
   modal de limite.
5. **Concluída** — simulação de carga e solver de rota (precedência, capacidade, múltiplas
   viagens, exato até 10 trocas + heurística acima disso).
6. **Concluída** — Roteiro: abas por viagem, checklist com peso/slots/barganha por passo,
   trocas parciais e recálculo a partir do progresso (92 testes).
7. Polimento e mapa opcional.
