# Coordenadas de nodes a partir do BDOCodex

Como tirar a posição no mapa de um node (ou NPC) do BDOCodex e converter para o mesmo sistema
de coordenadas de `src/data/islands.json` (`x`, `y`).

## Onde está o dado

Qualquer página que tenha o mapa do BDOCodex (conhecimento, NPC, node etc.) traz as posições no
próprio HTML, dentro do `<script>` que monta o mapa Leaflet. Não precisa de navegador nem de API:
um `curl` com User-Agent de navegador basta.

```sh
curl -sL -A "Mozilla/5.0" https://bdocodex.com/pt/node/3407/ -o pagina.html
```

Variáveis úteis no script:

| Variável    | Conteúdo                                                                        |
| ----------- | ------------------------------------------------------------------------------- |
| `locations` | Pontos da própria página. Ex.: `[[[88771.28, 61632.8], "Rad Rasha"]]`           |
| `nodes`     | **Todos os nodes do mundo** (~1051), repetidos em toda página com mapa          |
| `links`     | Ligações entre nodes (pares de pontos)                                          |

O array `nodes` aparece duas vezes no HTML, em dois formatos:

```
[[91705.16, 61101.6], "Shakatu CP:0 (1314)", 1, 1]   <- com CP, usado nos marcadores
[[91705.16, 61101.6], "Shakatu (1314)", 1]           <- sem CP
```

O número entre parênteses é o id do node; o inteiro seguinte é o tipo do ícone
(`/images/node_icons/icon_node_<tipo>.webp`).

## Conversão para as coordenadas do jogo

Os valores são **pixels do mapa no zoom máximo** (`map.unproject(ponto, map.getMaxZoom())`).
Para chegar nas coordenadas de `islands.json`:

```
x = (px − 68600) × 25
y = (py − 72200) × 25
```

Conferido contra os dados que já temos (bate na casa decimal):

| Node            | px, py               | x calculado | y calculado | `islands.json`       |
| --------------- | -------------------- | ----------- | ----------- | -------------------- |
| Ilha de Racid   | 71370.02, 55848.92   | 69250.5     | −408777     | 69250.5, −408777     |
| Ilha de Staren  | 58655.96, 63882      | −248601     | −207950     | −248601, −207950     |

> **Cuidado:** o script do BDOCodex tem a função `get_markers()`, que exporta marcadores com
> `(py − 72208) × 25 × −1`. Essa fórmula **não** bate com os nossos dados (sinal de `y`
> invertido e deslocamento de 200). Use a fórmula acima.

## Script de extração

Lê um HTML salvo e imprime os nodes com as coordenadas já convertidas. Passe um trecho do nome
para filtrar.

```python
import re
import sys

html = open(sys.argv[1], encoding='utf-8', errors='ignore').read()
filtro = sys.argv[2].lower() if len(sys.argv) > 2 else ''

# Formato sem CP: [[px, py], "Nome (id)", tipo]
padrao = r'\[\[([\d.]+), ([\d.]+)\], "([^"]*?) \((\d+)\)",(\d+)\]'
for px, py, nome, node_id, tipo in re.findall(padrao, html):
    if filtro and filtro not in nome.lower():
        continue
    x = (float(px) - 68600) * 25
    y = (float(py) - 72200) * 25
    print(f'{node_id}\t{nome}\tx={x:.1f}\ty={y:.1f}')

# Pontos da própria página (NPC, conhecimento...)
loc = re.search(r'var locations\s*=\s*(\[.*?\]);', html, re.S)
if loc:
    print('locations:', loc.group(1))
```

Uso:

```sh
python3 extrair.py pagina.html corvo
# 1659  Posto de Corvo Noturno  x=17996.0   y=344861.2
# 1746  Ninho do Corvo          x=252800.0  y=-710000.0
```

## Exemplo: conhecimento 3407 (Píer Abandonado em Shakatu)

- `locations`: Rad Rasha em `[88771.28, 61632.8]` → **x = 504282, y = −264180**
- node 1377 "Píer Abandonado em Shakatu" em `[88807.36, 61637.92]` → **x = 505184, y = −264052**

## Uso no projeto

- **Ninho do Corvo** (`id` 983) não tem coordenada nos brutos: o node 1746 dá
  **x = 252800, y = −710000**, gravado em `COORDENADAS_EXTRAS` no `scripts/convert-data.mjs`.
- Portos só com Gerente de Cais (sem permutador) ficam em `PORTOS_SO_COM_GERENTE`, com as
  coordenadas convertidas daqui: Porto de Epheria (604), Posto de Abastecimento do Posto
  Avançado (1719), Píer Abandonado de Shakatu (1377), Balsa Esperançosa (1326) e Academia de
  Olvia (2052). Ilha de Lema (1001) e Ilhas de Kuit (1091) bateram exatamente com
  `islands.json`, o que confirma a fórmula.
- Depois de mexer no conversor, rode `npm run data:convert`.
