# Especificação unificada de cartões Anki (v2)

> **Como usar este arquivo.** As seções 1 a 6 são a base de conhecimento enviada ao Gemini (a seção 6 pode ser enviada só para o modelo escolhido; cada modelo começa com `## MODELO n`). As seções 7 a 9 são para o código (renderização, validação e pendências). A saída do Gemini segue `cartao_schema.json`.

---

## 1. Papéis e regras gerais

**A IA** escolhe o modelo, pesquisa quando necessário e escreve o conteúdo dos campos em JSON. **O código** monta o HTML final, define baralho e tags, valida limites e gera o .apkg.

Instruções para a IA:
- Responda **somente** com o JSON do esquema, com todos os campos presentes (`null` quando não se aplica).
- Não gere baralho nem tags: o código cuida disso. A tag recebida é só de leitura (Modo A, para inferir `contexto`); nunca a preencha, altere ou repita.
- Escreva em português do Brasil.
- Não invente: quando houver fonte (arquivo ou pesquisa), siga a fonte.
- Se a entrada não permitir criar um cartão, use `status: "entrada_insuficiente"` e explique em `mensagem`.

---

## 2. Entradas

### 2.1 Estrutura do frontend
- Tela inicial: **criar grupo** e depois **adicionar cartão ao grupo**.
- O nome do grupo é o nome do **baralho** (recebido do frontend, não escrito pela IA).
- Ao criar um cartão, o usuário pode selecionar **tags** em um modal (árvore hierárquica, delimitador `::`, ex.: `Mat::Geometria`). No **Modo A**, a tag pesa muito na determinação do campo `contexto`; se estiver abreviada, a IA infere o assunto pelo conteúdo. No **Modo B**, a tag não é usada para preencher o contexto.

### 2.2 Modos (mutuamente exclusivos)

**Modo A: Por inferência de IA.** A IA recebe o texto como um prompt, analisa, escolhe o modelo mais adequado (seção 5), pesquisa se necessário e preenche Front e Back.
- Se o Modelo 2 exigir **mais de 5** perguntas/definições: `status: "separar_cartoes"`, `mensagem` pedindo para separar em mais cartões, `modelo` e demais campos `null`.

**Modo B: Escrever Front.** A IA recebe o Front escrito pelo usuário e o modelo escolhido no frontend. Ela separa o texto nos campos de Front (`contexto`, `pergunta`, `observacao_pergunta`, `imagem_pergunta`, `itens[].pergunta`) e **somente cria o Back**. Campos que não existem no texto ficam `null`.
- **Contexto:** só existe se o usuário o escreveu no início do texto (frase de contextualização, como "Em sinais e sistemas"). A IA o move para `contexto` (sem a vírgula final) e o restante vira `pergunta`. Ex.: "Em sinais e sistemas, defina X" → `contexto = "Em sinais e sistemas"`, `pergunta = "defina X"`. Se o usuário não escreveu contexto, `contexto = null`: a IA **não** o preenche pela tag.
- Preserve a redação e a **caixa original** do usuário (não force maiúscula no início de `pergunta`). Só normalize: LaTeX para `<anki-mathjax>`, remoção de `&nbsp;`, correção de HTML.
- O modelo vem do frontend (escolhido pelo usuário).
- **`modelo_incerto`:** se o modelo escolhido não combina com o Front escrito, a IA define `modelo_incerto = true` e escreve o Back no modelo escolhido mesmo assim, adaptando o estilo da resposta. O código acrescenta ao cartão a tag do Anki `modelo_incerto`. Em todos os outros casos (inclusive no Modo A), `false`.

---

### 2.3 Contexto
`contexto` é a frase de contextualização, **sem vírgula final**: `Em estatística`, `No estudo de sinais e sistemas`.
- Modo A: use a tag informada como fonte principal; infira se estiver abreviada. Modo B: o contexto vem só do texto escrito pelo usuário.
- Use `null` quando o tópico é genérico (não específico de uma área).

---

## 3. Formato dos campos de texto

### 3.1 HTML permitido
| Marcação | Uso |
|---|---|
| `<b>`, `<i>` | negrito, itálico (uso moderado, só quando realmente útil) |
| `<br>` | quebra de linha; `<br><br>` separa blocos. Nunca use `\n` |
| `<ul><li>` | listas |
| `<destaque>texto</destaque>` | negrito amarelo; o código expande. Use com moderação |
| `<anki-mathjax>…</anki-mathjax>` | LaTeX inline. `<anki-mathjax block="true">` só para expressões longas ou em destaque |

**Proibido:** `style`, `class` e qualquer atributo (exceto `block="true"`), `<span>`, `<div>`, `<img>`, links, markdown (`**`, `$…$`) e entidades como `&nbsp;`.

### 3.2 LaTeX
- Delimitador: `<anki-mathjax> </anki-mathjax>`. Dentro, LaTeX padrão do MathJax.
- Texto dentro de fórmula: `\text{…}`. Use `\cos`, `\sin`, `\lim\limits_{…}`, `\Omega` (não `\ohm`).
- Escreva `<`, `>` e `&` normalmente dentro das fórmulas; o código faz o escape.
- Confira as fórmulas (fatoriais, índices, sinais). Um erro de LaTeX vira erro de estudo.
- O tamanho das expressões LaTeX **não conta** para o tamanho do texto.

### 3.3 Descrições de imagem
Os campos `imagem_*` trazem só a descrição, começando por "Imagem de/da/do…". Exemplo: `Imagem de uma rampa saturada com origem (0,0)`. O código coloca os colchetes e adiciona ao cartão a tag `Imagem_pendente`.

### 3.4 Contagem de palavras (limites)
1. Remova o conteúdo de `<anki-mathjax>` e todas as tags HTML.
2. Conte os trechos separados por espaço que tenham **ao menos uma letra** (numeração como `1)` não conta).
3. Front: `contexto` + `pergunta`. Back: `resposta`.
4. **Não contam:** `observacao_*`, `exemplo`, `imagem_*` (devem ser concisos).
5. O limite mínimo da resposta do Modelo 1 **não se aplica** quando a resposta é apenas uma expressão matemática.

---

## 4. Regras globais

**Recomendações**
- Começar perguntas contextualizando o assunto/tag quando o tópico é mais específico de uma área: `[Em <assunto>, …]`, `[No estudo de <assunto>, …]`.
- Colocar observação quando necessário: termos matemáticos não óbvios, condições da pergunta, formato sugerido de resposta ou possíveis ambiguidades.
- Colocar descrição de imagem na resposta para perguntas de compreensão visual (diagramas, esquemas geométricos) ou de maior abstração.
- No Modo A, `pergunta` é escrita com inicial maiúscula e o código a põe em minúscula quando há `contexto`. No Modo B, a caixa original do usuário é preservada (o código só ajusta quando há `contexto`).

**Evitar**
- Imagens para formulações puramente matemáticas ou não visuais.
- Observações quando a pergunta é direta, sem ambiguidade e sem LaTeX confuso.

---

## 5. Escolha do modelo (Modo A)

| Modelo | Use quando | Pistas na entrada |
|---|---|---|
| 1 `definicao` | Uma definição ou conceito único | Defina, diga, determine, "o que é" |
| 2 `definicoes_multiplas` | 2 a 5 definições/conceitos no mesmo cartão | lista de termos; mais de 5 vira `separar_cartoes` |
| 3 `demonstracao_pura` | Demonstração curta e fácil; passos são equações com transições curtas | Demonstre, mostre que |
| 4 `demonstracao_raciocinio` | Cada passo precisa de justificativa ou motivação; construção de conceitos; versão simplificada de dedução longa | Deduza, intuição, "por que", "de onde vem" |

**Desempate**
1. Pede intuição ou justificativa de cada passo → Modelo 4 (mesmo que também peça definição).
2. Pede demonstração que se entende só pelas equações → Modelo 3.
3. Um único conceito → Modelo 1; vários (2 a 5) → Modelo 2.

---

## 6. Modelos

### Convenções dos campos
Nos exemplos todos os campos aparecem (`null` quando não se aplica). Barras invertidas do LaTeX aparecem duplicadas, como no JSON real.

## MODELO 1 - Definição/Conceitos (`definicao`)

**Quando usar:** definições únicas em linguagem natural ou matemática, ou explicação de conceitos.

| Campo JSON | Status |
|---|---|
| `contexto` | Recomendado |
| `pergunta` | Obrigatório |
| `observacao_pergunta` | Quando necessário |
| `imagem_pergunta` | Quando necessário (só se a pergunta depende *fortemente* da imagem) |
| `resposta` | Obrigatório |
| `observacao_resposta` | Quando necessário |
| `exemplo` | Recomendado, quando possível |
| `imagem_resposta` | Quando necessário |
| `itens` | sempre `null` |

**Limites:** pergunta 3 a 60 palavras; resposta 6 a 160 palavras (conforme complexidade e abstração). Observações e exemplos não contam.

**Recomendações:** na pergunta, termos como Defina, diga, determine…

### Exemplo M1-1
```json
{
  "status": "ok",
  "mensagem": null,
  "modelo": "definicao",
  "modelo_incerto": false,
  "contexto": null,
  "pergunta": "Defina matematicamente a função exponencial real.",
  "observacao_pergunta": "Forma genérica e em função do tempo.",
  "imagem_pergunta": null,
  "itens": null,
  "resposta": "<anki-mathjax>x(t)=Ce^{\\alpha t}</anki-mathjax>",
  "observacao_resposta": null,
  "exemplo": null,
  "imagem_resposta": null
}
```

### Exemplo M1-2
```json
{
  "status": "ok",
  "mensagem": null,
  "modelo": "definicao",
  "modelo_incerto": false,
  "contexto": "Em sinais e sistemas",
  "pergunta": "Defina quando um sinal de tempo discreto <anki-mathjax>x(k),k= 0, \\pm 1, \\pm2 \\cdots</anki-mathjax> é periódico.",
  "observacao_pergunta": null,
  "imagem_pergunta": null,
  "itens": null,
  "resposta": "<anki-mathjax>x(k) \\ \\text{é periódico} \\Leftrightarrow \\exists K \\in \\mathbb{Z}^{+} \\ | \\ x(k+K)=x(k) \\ \\forall k</anki-mathjax>",
  "observacao_resposta": null,
  "exemplo": null,
  "imagem_resposta": null
}
```

### Exemplo M1-3
```json
{
  "status": "ok",
  "mensagem": null,
  "modelo": "definicao",
  "modelo_incerto": false,
  "contexto": "Em sinais e sistemas",
  "pergunta": "Defina a função sinc normalizada.",
  "observacao_pergunta": null,
  "imagem_pergunta": null,
  "itens": null,
  "resposta": "É uma função oscilante cujos zeros são obtidos por múltiplos não nulos de <anki-mathjax>\\pi</anki-mathjax>.<br><anki-mathjax>\\text{sinc}(t) = \\frac{\\sin(\\pi t)}{\\pi t}</anki-mathjax>",
  "observacao_resposta": null,
  "exemplo": null,
  "imagem_resposta": "Imagem da função sinc normalizada"
}
```

### Exemplo M1-4
```json
{
  "status": "ok",
  "mensagem": null,
  "modelo": "definicao",
  "modelo_incerto": false,
  "contexto": "Em estatística",
  "pergunta": "Defina o que são variáveis aleatórias discretas.",
  "observacao_pergunta": null,
  "imagem_pergunta": null,
  "itens": null,
  "resposta": "<ul><li><destaque>Variáveis aleatórias discretas</destaque>: Uma variável aleatória <anki-mathjax>X</anki-mathjax> é dita discreta quando seu conjunto imagem é <i>finito</i> ou <i>infinito enumerável</i>.</li></ul>",
  "observacao_resposta": null,
  "exemplo": "Número de peças defeituosas em um lote, número de caras em três lançamentos...",
  "imagem_resposta": null
}
```

## MODELO 2 - Definições/Conceitos múltiplos (`definicoes_multiplas`)

**Quando usar:** de 2 a 5 definições ou conceitos no mesmo cartão, em linguagem natural ou matemática.

| Campo JSON | Status |
|---|---|
| `contexto` | Recomendado |
| `pergunta` | Obrigatório (enunciado comum, ex.: "Defina o que são") |
| `itens[].pergunta` | Obrigatório (a lista de perguntas/termos, de 2 a 5 itens) |
| `observacao_pergunta` | Quando necessário |
| `imagem_pergunta` | Quando necessário |
| `itens[].resposta` | Obrigatório (respostas listadas) |
| `itens[].rotulo` | Opcional (rótulo em negrito na resposta; `null` = usa `itens[].pergunta`) |
| `itens[].exemplo` | Recomendado, quando possível |
| `itens[].imagem` | Quando necessário |
| `observacao_resposta` | Quando necessário |
| `resposta`, `exemplo`, `imagem_resposta` | sempre `null` |

**Limites:** `pergunta` (enunciado) 3 a 50 palavras; cada `itens[].pergunta` 1 a 50 palavras; cada `itens[].resposta` 6 a 100 palavras. Observações e exemplos não contam.

**Recomendações:** na pergunta, termos como Defina, diga, determine… Todas as regras globais da seção 4. Mais de 5 itens: `separar_cartoes`.

### Exemplo M2-1
```json
{
  "status": "ok",
  "mensagem": null,
  "modelo": "definicoes_multiplas",
  "modelo_incerto": false,
  "contexto": "Em sinais e sistemas",
  "pergunta": "Defina o que são <destaque>sinais</destaque>",
  "observacao_pergunta": null,
  "imagem_pergunta": null,
  "itens": [
    {
      "pergunta": "Causais",
      "rotulo": null,
      "resposta": "É qualquer sinal contínuo (ou discreto) em que <anki-mathjax>x(t)=0 \\quad\\forall t<0</anki-mathjax>",
      "exemplo": null,
      "imagem": "Imagem de sinal causal"
    },
    {
      "pergunta": "Anticausais",
      "rotulo": null,
      "resposta": "É qualquer sinal contínuo (ou discreto) em que <anki-mathjax>x(t)=0 \\quad \\forall t>0</anki-mathjax>",
      "exemplo": null,
      "imagem": "Imagem de sinal anticausal"
    },
    {
      "pergunta": "Não causais",
      "rotulo": null,
      "resposta": "É qualquer sinal contínuo ou discreto que possui valores não nulos de <anki-mathjax>x(t)</anki-mathjax> tanto para <anki-mathjax>t<0</anki-mathjax> <b>quanto</b> para <anki-mathjax>t>0</anki-mathjax>.",
      "exemplo": null,
      "imagem": "Imagem de sinal não causal"
    }
  ],
  "resposta": null,
  "observacao_resposta": null,
  "exemplo": null,
  "imagem_resposta": null
}
```

### Exemplo M2-2
```json
{
  "status": "ok",
  "mensagem": null,
  "modelo": "definicoes_multiplas",
  "modelo_incerto": false,
  "contexto": "Em estatística",
  "pergunta": "Defina o que são",
  "observacao_pergunta": null,
  "imagem_pergunta": null,
  "itens": [
    {
      "pergunta": "Variáveis aleatórias discretas",
      "rotulo": "<destaque>Variáveis aleatórias discretas</destaque>",
      "resposta": "Uma variável aleatória <anki-mathjax>X</anki-mathjax> é dita discreta quando seu conjunto imagem é <i>finito</i> ou <i>infinito enumerável</i>.",
      "exemplo": "Número de peças defeituosas em um lote, número de caras em três lançamentos...",
      "imagem": null
    },
    {
      "pergunta": "Variáveis aleatórias contínuas",
      "rotulo": "<destaque>Variáveis aleatórias contínuas</destaque>",
      "resposta": "Uma variável aleatória <anki-mathjax>X</anki-mathjax> é dita contínua quando seu conjunto imagem forma um intervalo (ou união de intervalos), ou seja, um conjunto não enumerável de números reais.",
      "exemplo": "Tempo até a falha de um componente eletrônico, <anki-mathjax>Im(X)=(0, \\infty)</anki-mathjax>.",
      "imagem": null
    }
  ],
  "resposta": null,
  "observacao_resposta": null,
  "exemplo": null,
  "imagem_resposta": null
}
```

## MODELO 3 - Demonstração pura, com/sem comentários (`demonstracao_pura`)

**Quando usar:** perguntas com demonstração curta, de raciocínio matemático puro e relativamente fáceis. Estrutura sintetizada: os passos são só equações, com transições/explicações curtas.

| Campo JSON | Status |
|---|---|
| `contexto` | Recomendado |
| `pergunta` | Obrigatório |
| `observacao_pergunta` | Quando necessário |
| `imagem_pergunta` | Quando necessário |
| `resposta` | Obrigatório (passos sequenciais como demonstração) |
| `observacao_resposta` | Quando necessário |
| `imagem_resposta` | Quando necessário |
| `itens`, `exemplo` | sempre `null` |

**Limites:** pergunta 3 a 60 palavras; resposta 7 a 160 palavras (texto fora das equações).

**Recomendações:** na pergunta, termos como Demonstre, deduza… Coloque os passos essenciais da demonstração e as transições principais entre eles. Abra a resposta com `<b>Demonstração:</b>`.

**Evitar:** colocar TODA a sequência de equações que resulte na demonstração.

### Exemplo M3-1
```json
{
  "status": "ok",
  "mensagem": null,
  "modelo": "demonstracao_pura",
  "modelo_incerto": false,
  "contexto": null,
  "pergunta": "Demonstre ou diga qual a transformada de Laplace para <anki-mathjax>f(t)=e^{at}</anki-mathjax>.",
  "observacao_pergunta": null,
  "imagem_pergunta": null,
  "itens": null,
  "resposta": "<b>Demonstração:</b><br><anki-mathjax>\\mathcal{L}(e^{at})=\\int^{\\infty}_{0}e^{at}e^{-st} dt</anki-mathjax><br><br><anki-mathjax>\\mathcal{L}(e^{at})=\\lim \\limits_{u \\to \\infty}\\int^{u}_{0}e^{t(a-s)} dt</anki-mathjax><br><br>- Por substituição simples, obtemos:<br><anki-mathjax>\\mathcal{L}(e^{at})=\\frac{1}{a-s}\\lim \\limits_{u \\to \\infty} [e^{u(a-s)} -1]</anki-mathjax><br><br>- Se <anki-mathjax>s>a</anki-mathjax>, então:<br><br><anki-mathjax>\\mathcal{L}(e^{at})=\\frac{1}{s-a}</anki-mathjax>",
  "observacao_resposta": null,
  "exemplo": null,
  "imagem_resposta": null
}
```

### Exemplo M3-2
```json
{
  "status": "ok",
  "mensagem": null,
  "modelo": "demonstracao_pura",
  "modelo_incerto": false,
  "contexto": "Em análise complexa",
  "pergunta": "Demonstre ou diga qual é a Fórmula de Euler.",
  "observacao_pergunta": null,
  "imagem_pergunta": null,
  "itens": null,
  "resposta": "<b>Demonstração:</b><br>1) Considere a Série de Maclaurin da função exponencial:<br><anki-mathjax>e^x=1+\\frac{x}{1!}+\\frac{x^2}{2!}+\\frac{x^3}{3!}+\\cdots</anki-mathjax><br><br>Substituindo pelo número complexo <anki-mathjax>ix</anki-mathjax>, temos:<br><anki-mathjax>e^{ix}=1+\\frac{ix}{1!}-\\frac{x^2}{2!}-\\frac{ix^3}{3!}+\\frac{x^4}{4!}+\\frac{ix^5}{5!}-\\frac{x^6}{6!}-\\frac{ix^7}{7!}+\\cdots</anki-mathjax><br><br>2) Podemos fazer o seguinte agrupamento de termos:<br><anki-mathjax>e^{ix}=\\bigg(1-\\frac{x^2}{2!}+\\frac{x^4}{4!} -\\cdots \\bigg)+i\\cdot \\bigg(x -\\frac{x^3}{3!}+\\frac{x^5}{5!}-\\cdots \\bigg)</anki-mathjax><br><br>Sabemos que essas são as séries de Maclaurin para as funções seno e cosseno, portanto:<br><anki-mathjax>e^{ix}=\\cos(x)+i \\, \\sin(x)</anki-mathjax>",
  "observacao_resposta": "Isso implica que qualquer número complexo em forma polar pode ser descrito com a função exponencial complexa <anki-mathjax>e^{ix}</anki-mathjax>.",
  "exemplo": null,
  "imagem_resposta": null
}
```

## MODELO 4 - Demonstração com raciocínio/lógica (`demonstracao_raciocinio`)

**Quando usar:** demonstrações que exigem raciocínio construtivo (construção e adaptação de conceitos, criação de novas definições) ou que simplificam demonstrações/deduções cujo formato formal é longo ou complexo demais para um cartão. Estrutura sintetizada: **cada passo precisa de justificativa ou motivação**.

| Campo JSON | Status |
|---|---|
| `contexto` | Recomendado |
| `pergunta` | Obrigatório |
| `observacao_pergunta` | Quando necessário |
| `imagem_pergunta` | Quando necessário |
| `resposta` | Obrigatório (passos sequenciais: equações e comentários) |
| `observacao_resposta` | Quando necessário |
| `imagem_resposta` | Quando necessário |
| `itens`, `exemplo` | sempre `null` |

**Limites:** pergunta 3 a 60 palavras; resposta 20 a 300 palavras (texto fora das equações).

**Recomendações:** na pergunta, termos como Deduza, intuitiva/intuição… Coloque os passos essenciais, as transições principais e o motivo/explicação lógica de cada um. Abra a resposta com `<b>Dedução:</b>` ou `<b>Intuição:</b>` e numere os passos (`1)`, `2)`…).

**Evitar:** colocar TODA a sequência de equações que resulte na demonstração.

### Exemplo M4-1
```json
{
  "status": "ok",
  "mensagem": null,
  "modelo": "demonstracao_raciocinio",
  "modelo_incerto": false,
  "contexto": "Em sinais e sistemas",
  "pergunta": "Deduza ou diga qual é a fórmula da Energia Total <anki-mathjax>E</anki-mathjax> de um sinal contínuo.",
  "observacao_pergunta": null,
  "imagem_pergunta": null,
  "itens": null,
  "resposta": "<b>Dedução:</b><br>1) Estamos procurando uma forma de mensurar a energia e a potência de um sinal. Como o sinal geralmente é de corrente ou tensão, é natural escolher como base a fórmula de potência dissipada em circuitos elétricos:<br><anki-mathjax>Pot=Vi=\\frac{V^2}{R}=i^{2}R</anki-mathjax><br><br>2) Note que, ao analisar um sinal de forma abstrata, em um escopo fechado, não nos importamos com o que aconteceu fisicamente até ele chegar assim. Muitas vezes a resistência equivalente não pode ser obtida ou não é necessária para a análise, logo fazemos <anki-mathjax>R=1 \\, \\Omega</anki-mathjax>.<br><anki-mathjax>Pot=x^2(t)</anki-mathjax><br><br>3) A energia <b>total</b> é a integral imprópria, em ambos os limites, da potência instantânea. Precisamos tirar o módulo porque, energeticamente, analisamos a parte real e positiva:<br><anki-mathjax>E=\\lim\\limits_{T\\to \\infty}\\int^{T/2}_{-T/2}|x(t)|^2 \\, dt</anki-mathjax>",
  "observacao_resposta": null,
  "exemplo": null,
  "imagem_resposta": null
}
```

### Exemplo M4-2
```json
{
  "status": "ok",
  "mensagem": null,
  "modelo": "demonstracao_raciocinio",
  "modelo_incerto": false,
  "contexto": null,
  "pergunta": "Defina a Transformada de Laplace e diga qual sua intuição.",
  "observacao_pergunta": null,
  "imagem_pergunta": null,
  "itens": null,
  "resposta": "<b>Intuição:</b><br><b>1)</b> Uma transformada pode ser entendida como uma extensão da definição de produto interno para funções contínuas:<br><anki-mathjax>\\langle f,g \\rangle=\\int_{0}^{\\infty}f(t)\\overline{g(t)} \\, dt</anki-mathjax><br><br>A partir disso, a ideia da transformada é extrair quanto de uma característica de <anki-mathjax>\\overline{g(t)}</anki-mathjax> está presente em <anki-mathjax>f(t)</anki-mathjax>, como uma projeção.<br><br><b>2)</b> A transformada de Laplace utiliza como núcleo a função base do tipo <anki-mathjax>e^{-st}</anki-mathjax>, então a integral calcula quanto da “frequência/comportamento <anki-mathjax>s</anki-mathjax>” está presente em <anki-mathjax>f(t)</anki-mathjax>. Portanto, ela é definida como:<br><anki-mathjax>F(s)=\\int_0^{\\infty}e^{-st}f(t) \\, dt</anki-mathjax>",
  "observacao_resposta": null,
  "exemplo": null,
  "imagem_resposta": null
}
```

---

## 7. Renderização (código: JSON → HTML do Anki)

O Anki recebe duas partes por nota: **Front** e **Back**. Campos `null` são ignorados.

**Front (todos os modelos)**
1. Se houver `contexto`: `{contexto}, {pergunta}`, com a primeira letra de `pergunta` em minúscula (exceto sigla, nome próprio ou início em fórmula). Sem `contexto`: `{pergunta}`.
2. Modelo 2: logo após o enunciado, `<br><ul><li>{item}{;|.}</li>…</ul>`, com `;` entre itens e `.` no último (se o item já termina com pontuação, não acrescenta).
3. `observacao_pergunta` → `<br><br><i>Obs</i>: {texto}`.
4. `imagem_pergunta` → `<br><br>[{texto}]`.

**Back**
1. Modelos 1, 3 e 4: `resposta`. Modelo 2: para cada item, `<ul><li>{rotulo ou <b>pergunta</b>}: {resposta}</li></ul>`, seguido de `ex: {exemplo}` e `[{imagem}]` quando existirem.
2. `observacao_resposta` → `<br><br><b><i>Obs</i></b>: {texto}`.
3. `exemplo` (Modelo 1) → `<br>ex: {texto}`.
4. `imagem_resposta` → `<br><br>[{texto}]`.

**Pós-processamento**
- `<destaque>x</destaque>` → `<span style="color: rgb(255, 255, 127);"><b>x</b></span>`.
- Dentro de `<anki-mathjax>`: `<` → `&lt;`, `>` → `&gt;`, `&` → `&amp;`.
- Saída sem `&nbsp;` e sem quebras de linha soltas.
- **Delimitador final do LaTeX:** `\( … \)` (inline) e `\[ … \]` (`block="true"`), confirmado em teste de importação no Anki. Configurável em `DELIMITADOR_LATEX` (`config.py`); `<anki-mathjax>` literal fica como alternativa.

**Baralho e tags (vêm do frontend)**
- Baralho = nome do grupo.
- Tags = tags selecionadas pelo usuário (hierarquia `::` preservada, ex.: `Mat::Geometria`; só espaços viram `_`) **+** `Imagem_pendente` se algum campo `imagem_*` ou `itens[].imagem` estiver preenchido **+** `modelo_incerto` se `modelo_incerto = true`.

**Exemplo (M1-2) renderizado**
```
Front: Em sinais e sistemas, defina quando um sinal de tempo discreto \(x(k),k= 0, \pm 1, \pm2 \cdots\) é periódico.
Back:  \(x(k) \ \text{é periódico} \Leftrightarrow \exists K \in \mathbb{Z}^{+} \ | \ x(k+K)=x(k) \ \forall k\)
```

---

## 8. Validação (código, antes de gerar o .apkg)

1. JSON válido e igual ao esquema; todos os campos presentes.
2. `status = ok` exige `modelo` e campos do modelo conforme as tabelas da seção 6; os campos "sempre `null`" devem estar `null`. `modelo_incerto` deve ser booleano (e `null` quando `status != ok`).
3. Modelo 2: de 2 a 5 itens. Mais de 5 → mensagem "separe em mais cartões".
4. Limites de palavras da seção 3.4 e de cada modelo.
5. HTML só com marcações da seção 3.1; tags balanceadas; sem `&nbsp;`.
6. `contexto` sem vírgula final; `imagem_*` começando por "Imagem".
7. Cartão inválido: até 2 tentativas de regeneração enviando à IA a lista de erros; depois, avisar o usuário.

---

## 9. Ajustes feitos nesta consolidação e pendências

**Ajustes em relação ao seu arquivo** (revise e me diga se algum não vale)
- Exemplos convertidos para JSON; removidos `&nbsp;`, `<img>` e `alt` sujo; `multiplos` → `múltiplos`.
- Correções de LaTeX/português nos exemplos: `\ohm` → `\Omega`; `\lim_\limits` → `\lim\limits_`; fatoriais `3!` e `4!`; `cos`/`sen` → `\cos`/`\sin`; frases do Modelo 4 reescritas de forma mais direta sem mudar o raciocínio.
- Modelo 1: o mínimo de 6 palavras na resposta **não vale para resposta só em fórmula** (seus Exemplos 1 e 2 têm 0 palavras fora do LaTeX).
- Modelo 2: cada item da lista pode ter **1 a 50** palavras (seus itens "Causais", "Anticausais" têm 1 ou 2 palavras, abaixo do mínimo de 3).
- Marcação `<destaque>` no lugar do `<span style=…>` para economizar tokens e evitar erro de HTML.
- Campo `status` e `mensagem` no JSON para o aviso de mais de 5 itens e para entrada insuficiente.
- (v2) Campo booleano `modelo_incerto` no JSON, para o Modo B quando o modelo escolhido não combina com o Front escrito.
- Exemplo M2-1, item 3: o `t<0` e `t>0` foram colocados dentro de LaTeX.

**Pendências (atualizado na v2)**
1. ~~Modo B~~ **Resolvida:** o usuário escolhe o modelo no frontend; a IA não preenche `contexto` pela tag, só move para `contexto` a frase escrita no início do texto (seção 2.2).
2. ~~Delimitador final no .apkg~~ **Resolvida:** `\( \)` e `\[ \]` (seção 7).
3. ~~Várias tags~~ **Deixa de existir:** as tags vêm de uma árvore selecionada em modal, não de texto digitado.
4. ~~Arquivos pessoais e busca web~~ **Tratada** em `especificacao_modulos.md` (Módulo 6).
5. **Modelos futuros:** cloze, exercício numérico, lista de propriedades.
