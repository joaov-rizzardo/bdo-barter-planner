# Plano: importar trocas a partir de prints

Levar o leitor de prints (hoje só o script `npm run ocr:ler`, ver "Leitor de prints" no
`CLAUDE.md`) para a tela de Planejamento. O usuário sobe várias prints da janela
"Informações de Permuta", o app extrai as trocas, o usuário escolhe quais quer fazer e elas
entram no plano.

## Fluxo do usuário

1. No Planejamento, o botão **"Importar de prints"** abre um modal grande.
2. **Adicionar prints**, de três jeitos:
   - botão "Escolher arquivos" (vários de uma vez, só imagens);
   - **Ctrl+V** com o modal aberto, para colar prints tiradas no PC (Win+Shift+S, PrintScreen);
   - arrastar e soltar imagens no modal.

   Cada print vira uma miniatura com botão de remover e um contador ("3 prints prontas").
3. **"Ler prints"** processa uma print por vez, com progresso ("Lendo print 2 de 3…"). As que
   já terminaram podem ser revisadas enquanto as outras são lidas.
4. **Revisão**: lista de trocas com caixa de seleção. Cada linha mostra:
   - porto e restante;
   - ícones e nomes de "dá → recebe";
   - "recebe por troca", editável quando a rota tem faixa;
   - trocas planejadas, editáveis;
   - barganha calculada;
   - "tenho no armazém";
   - selo ✔/⚠, como no script.
5. **"Adicionar N trocas ao planejamento"**: as trocas entram no plano e o modal fecha com uma
   confirmação.

## Regras da revisão

- **Barganha calculada pelo app, nunca a lida da print**:
  - `baseBarterCost = custoBaseEfetivo(rota)`, o mesmo valor do formulário;
  - a coluna mostra `custoPorTroca(base, reduções) × planejadas` e acompanha as reduções das
    Configurações;
  - o valor de barganha lido da print é descartado.
- **Restante e planejadas**:
  - `remainingTrades` vem do "Restante" da print;
  - sem leitura, usa o teto da rota (`maxTrocasEfetivo`) e marca ⚠;
  - `plannedTrades` começa em `min(restante, teto)`.
- **Recebe por troca**: o número do ícone quando cabe na faixa da rota; senão o máximo da
  faixa, com ⚠ "confira a quantidade".
- **Seleção inicial**:

  | Situação                                         | Começa     |
  | ------------------------------------------------ | ---------- |
  | Leitura confiável e restante > 0                 | marcada    |
  | ⚠ ambígua (seletor com a escolhida + alternativas) | desmarcada |
  | Restante 0 ("sem trocas restantes hoje")         | desmarcada |
  | Mesma rota já no plano (`routeKey`)               | desmarcada |

  Na ambígua, escolher a rota no seletor marca a troca. A que já está no plano ganha a
  etiqueta "já está no plano".
- **Duplicadas entre prints** (a mesma linha em duas prints por causa da rolagem): junta pela
  `routeKey` e fica com a leitura de maior confiança.
- **`hasStock`** (tenho no armazém) começa desligado.

## Filtros na revisão

Facilitam marcar as trocas por tipo depois da análise.

**Filtro por degrau**: barra de botões acima da lista, no estilo das abas por tier do
`SeletorDeItem`.

```
[Todos (27)] [Mercado → Nível 1 (6)] [Nível 1 → 2 (5)] [Nível 2 → 3 (6)]
[Nível 5 → 6 (6)] [Nível 6 → 7 (4)] [→ Moeda Corvo (6)] [⚠ Para conferir (3)]
```

- **Quais botões aparecem**: só os degraus presentes nas trocas lidas, com a contagem de cada
  um; "Todos" vem primeiro.
- **De onde vem o degrau**: da **rota casada**, não do texto da print.
  - É o tier do item de entrada → o tier do item de saída.
  - Bem do mercado (T0) aparece como "Mercado".
  - Moeda Corvo é um grupo próprio, "→ Moeda Corvo", seja qual for o tier de entrada.
  - Itens do Oceano entram como "Nível 4 → Oceano".
- **"⚠ Para conferir"**: atalho que junta as ambíguas, as de confiança baixa e as de quantidade
  não lida.
- **Ordem dos botões**: do menor para o maior degrau; Moeda Corvo e "Para conferir" no fim.

**Marcação em lote**, valendo só para o filtro ativo:

- "Marcar todas" / "Desmarcar todas" agem **só nas trocas visíveis**.
- "Marcar todas" respeita as regras de segurança: não marca troca com restante 0 nem ambígua
  sem rota escolhida. O aviso diz quantas pulou e por quê ("3 marcadas, 1 ignorada: sem
  trocas restantes").

**Seleção e contagens**:

- A seleção é **independente do filtro**: o que foi marcado em um degrau continua marcado ao
  trocar de filtro.
- Cada botão mostra quantas estão marcadas, ex.: `Nível 6 → 7 (2/4)`.
- O botão do rodapé mostra sempre o total ("Adicionar 9 trocas ao planejamento").

**Agrupamento**: com filtro ativo a lista vira uma tabela só, sem separar por print. A print de
origem aparece como etiqueta pequena na linha.

**Estado do filtro**: fica só no modal; ao abrir de novo, volta para "Todos".

## Arquitetura

Script e tela usam **o mesmo pipeline**; só muda quem abre a imagem e quem roda o tesseract.

### 1. Pipeline puro em `src/core/ocr/`

- `imagem.ts`: operações sobre `ImagemCrua`, hoje feitas com sharp em `scripts/ocr/comum.ts`:
  - preparar para o OCR (canal máximo invertido + ampliação);
  - recortar uma caixa;
  - reduzir escala.
- `pipeline.ts`: `lerTrocasDaPrint(imagem, { lerTexto }, dados, modelos)` faz
  layout → dígitos → casamento. `lerTexto` é uma porta injetada: o core continua sem depender
  do tesseract.
- `paraTroca.ts`: `novaTrocaDaLeitura(lida, escolhas) → NovaTroca` aplica as regras da revisão
  (custo pela rota, teto, restante, faixa).
- `revisao.ts`:
  - deduplicação entre prints, seleção inicial e detecção de "já no plano";
  - `degrauDaTroca(rota, items)`: chave e rótulo do degrau;
  - `resumoPorDegrau(trocas, selecionadas)`: botões com contagem total e marcada;
  - `marcarVisiveis(...)`: o que marcou e o que pulou, com o motivo.

### 2. Adaptadores

- **Node** (`scripts/ocr/comum.ts`): sharp + tesseract.js, chamando o pipeline do core.
- **Navegador** (`src/ui/ocr/leitorNavegador.ts`):
  - imagem: `createImageBitmap(file)` → canvas → `getImageData` → `ImagemCrua`;
  - texto: worker do tesseract.js criado na primeira leitura e reaproveitado.

### 3. Tesseract embutido (funciona offline no Tauri)

- `por.traineddata` (2,4 MB) e o núcleo `.wasm` vão para `public/tesseract/`, copiados por um
  script ou plugin do Vite.
- O worker usa `workerPath`/`corePath`/`langPath` locais.
- O idioma `eng` não é mais necessário: os dígitos usam o classificador próprio.

### 4. UI

- `ui/hooks/useLeitorDePrints.ts`:
  - fila de prints e estado de cada uma (pendente / lendo / pronta / erro);
  - progresso;
  - encerra o worker quando o modal fecha.
- `ui/screens/planejamento/importacao/`:
  - `ModalImportarPrints.tsx`: etapas Prints → Revisão;
  - `AreaDePrints.tsx`: input de arquivo, Ctrl+V (evento `paste`, `clipboardData.items` com
    `image/*`), arrastar e soltar, miniaturas;
  - `FiltroPorDegrau.tsx`: botões de degrau com contagens;
  - `RevisaoDeTrocas.tsx`: lista com seleção, edição e ações em lote.
- `Modal` ganha `tamanho: 'xl'`: a revisão tem muitas colunas e o `lg` atual tem largura
  máxima de 768 px (`max-w-3xl`).
- A leitura não é persistida: é estado do modal. Só o resultado entra no `planStore`, pelo
  `adicionar`.

## Etapas (um commit por etapa)

1. **Concluída.** Pipeline puro no core (`imagem`, `pipeline`, `paraTroca`, `revisao` com os filtros por degrau)
   com testes. O script migra para ele, e `npm run ocr:avaliar` tem que continuar em 148/150.
2. **Concluída.** Adaptador do navegador e tesseract local em `public/`, conferido manualmente no
   `npm run dev`.
3. **Concluída.** Modal com upload, Ctrl+V, arrastar e soltar, e leitura com progresso.
4. **Concluída.** Revisão:
   - seleção e edição;
   - filtros por degrau e marcação em lote;
   - ambíguas, duplicadas e "já no plano";
   - inclusão no plano.
5. Polimento:
   - mensagens de erro ("isso não parece a janela de permuta", "nenhuma troca encontrada");
   - documentação no `CLAUDE.md`;
   - teste ponta a ponta no navegador com as prints de `data/prints/`.

## Riscos a validar

- **Worker do tesseract.js v7 offline**: o pacote não traz `worker.min.js` no `dist`. A ordem
  das tentativas:
  1. importar o worker com `?url` / worker do Vite;
  2. servir o arquivo copiado do pacote;
  3. CDN só como último recurso.
- **Ctrl+V no WebView**: funciona no Chrome e no WebView2 (Windows). No WebKitGTK (Linux) a
  imagem colada pode não chegar pelo evento `paste`. Plano B: plugin de clipboard do Tauri
  (`readImage`). Validar primeiro no `npm run dev`; o shell Rust ainda não compila aqui.
- **Tempo**: ~5–6 s por print. O OCR roda num Web Worker para não travar a tela, mas várias
  prints somam. Por isso o progresso, e por isso dá para revisar as prints já lidas enquanto
  as outras terminam.
- **Navios** (Shipwrecked…, Combat Raft…): só têm nome em inglês nos dados e saem como
  ambíguos até termos os nomes em português. Na revisão, o usuário resolve pelo seletor de
  alternativas.

## Decisões

1. **Onde fica a importação**: modal aberto por um botão no Planejamento.
2. **Trocas ambíguas**: começam desmarcadas; o usuário escolhe a rota no seletor.

## Notas da etapa 1

- A ampliação para o OCR saiu do sharp para o core (`imagem.ts`). Bilinear + contraste esticado
  empata com o lanczos do sharp (148/150 no gabarito); bicúbico ficou pior (145/150).
- A altura da linha passou a ser a mediana dos passos entre linhas vizinhas (antes era o menor
  passo, que errava 2–3 px e deslocava o recorte do número do ícone).
- "Marcar todas" também pula as trocas que já estão no plano, além de ambíguas e sem restante.

## Notas da etapa 2

- O worker é gerado com o esbuild a partir de `tesseract.js/src/worker-script/browser` (o
  `global` do fonte vira `self`); núcleo e idioma são servidos de `public/tesseract/`.
- Conferido no Chrome com o `npm run dev`: mesmas trocas do script, ~4,3 s e ~5,8 s por print,
  sem nenhuma requisição para fora do `localhost`.

## Notas da etapa 3

- Botão "Importar de prints" no topo do Planejamento abre `ModalImportarPrints` (`Modal` ganhou
  `tamanho: 'xl'`). A fila fica em `useLeitorDePrints` (estado por print, progresso do lote,
  um worker do tesseract reaproveitado e liberado ao fechar o modal).
- O Ctrl+V escuta o `paste` da janela enquanto o modal está aberto; texto colado num campo
  segue normal (o aviso de "sem imagem" só aparece quando não veio nada).
- Conferido no Chrome: duas prints pelo campo de arquivo e uma colada, lidas em sequência, com
  o resultado de cada print aparecendo enquanto as outras ainda são lidas.

## Notas da etapa 4

- A revisão cresce a cada print lida (`incluirLeitura`), sem esperar as outras; o campo
  `editado` impede que a leitura de outra print desfaça o que o usuário já mexeu.
- Descoberto no teste: as alternativas próximas nem sempre trazem a rota certa (navios com nome
  só em inglês). Cada troca agora tem `outrosPortos` — os outros portos com os mesmos itens,
  primeiro os que aceitam o número lido no ícone. O seletor aparece nas ambíguas e, nas
  confirmadas, pelo link "trocar porto".
- A tabela também deixa editar o restante (caso o OCR leia errado), limitado ao teto da rota.
- Conferido no Chrome (com o `localStorage` salvo antes e restaurado depois): 3 prints, 17 trocas
  sem a repetida, filtros com contagem, escolha dos navios nas ambíguas e 5 trocas de Moeda
  Corvo no plano com a barganha base da rota (21.650), não a da print.
