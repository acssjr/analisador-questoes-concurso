"""
Prompts for question classification
"""


SYSTEM_PROMPT_CLASSIFICACAO = """Você é um especialista em análise de questões de concursos públicos brasileiros.

Sua tarefa é classificar questões de forma hierárquica e detalhada, seguindo a taxonomia do edital quando disponível.

IMPORTANTE:
- Seja preciso e específico nas classificações
- Identifique o conceito EXATO sendo testado, não apenas categorias gerais
- Analise profundamente o que a questão REALMENTE está avaliando
- Forneça scores de confiança honestos
- Sempre responda em formato JSON válido"""


def build_classification_prompt(
    questao: dict,
    edital_taxonomia: dict = None,
) -> str:
    """
    Build prompt for hierarchical classification

    Args:
        questao: Question dict with enunciado, alternativas, etc
        edital_taxonomia: Optional edital taxonomy

    Returns:
        str: Complete prompt
    """
    prompt = f"""Classifique esta questão de concurso de forma hierárquica e detalhada.

QUESTÃO #{questao['numero']}:

ENUNCIADO:
{questao['enunciado']}

ALTERNATIVAS:
"""

    for letra, texto in questao.get("alternativas", {}).items():
        prompt += f"{letra}) {texto}\n"

    if questao.get("gabarito"):
        prompt += f"\nGABARITO: {questao['gabarito']}\n"

    if edital_taxonomia:
        prompt += f"""

TAXONOMIA DO EDITAL (OFICIAL):
{format_taxonomia(edital_taxonomia)}

IMPORTANTE: Esta taxonomia é OFICIAL do edital do concurso. Você DEVE mapear a questão para os itens exatos desta taxonomia.
Use os nomes EXATOS como aparecem na estrutura acima. Não invente categorias que não existam nesta taxonomia.
"""

    prompt += """

TAREFA:
Classifique esta questão fornecendo:

1. CLASSIFICAÇÃO HIERÁRQUICA:
   - Disciplina (ex: "Língua Portuguesa", "Matemática")
   - Assunto (ex: "Sintaxe", "Geometria")
   - Tópico (ex: "Período Composto", "Triângulos")
   - Subtópico (ex: "Orações Subordinadas Adverbiais", "Teorema de Pitágoras")
   - Conceito específico (ex: "Orações concessivas com inversão sintática", "Cálculo de hipotenusa com catetos dados")

2. SCORES DE CONFIANÇA (0.0 a 1.0):
   - confianca_disciplina
   - confianca_assunto
   - confianca_topico
   - confianca_subtopico

3. ANÁLISE CONCEITUAL:
   - conceito_testado: Explicação detalhada do que está sendo testado
   - habilidade_bloom: Uma de ["lembrar", "entender", "aplicar", "analisar", "avaliar", "criar"]
   - nivel_dificuldade: Uma de ["basico", "intermediario", "avancado"]
   - conceitos_adjacentes: Lista de conceitos relacionados necessários

4. ANÁLISE DE ALTERNATIVAS:
   Para cada alternativa (A-E), explique:
   - Se é correta ou incorreta
   - Justificativa/motivo do erro
   - Tipo de pegadinha usada (se aplicável)

RESPONDA EM JSON:
```json
{
  "disciplina": "...",
  "assunto": "...",
  "topico": "...",
  "subtopico": "...",
  "conceito_especifico": "...",
  "item_edital_path": "Disciplina > Assunto > Tópico > Subtópico",
  "confianca_disciplina": 0.0,
  "confianca_assunto": 0.0,
  "confianca_topico": 0.0,
  "confianca_subtopico": 0.0,
  "conceito_testado": "Explicação detalhada aqui...",
  "habilidade_bloom": "...",
  "nivel_dificuldade": "...",
  "conceitos_adjacentes": ["conceito1", "conceito2"],
  "analise_alternativas": {
    "A": {"correta": false, "justificativa": "..."},
    "B": {"correta": true, "justificativa": "..."}
  }
}
```

NOTA: O campo "item_edital_path" só é obrigatório quando a taxonomia do edital for fornecida. Deve ser o caminho completo na hierarquia, ex: "Língua Portuguesa > Sintaxe > Período Composto > Orações Subordinadas"
"""

    return prompt


def format_taxonomia(taxonomia: dict) -> str:
    """Format taxonomy dict as readable text"""
    lines = []
    for disc in taxonomia.get("disciplinas", []):
        lines.append(f"• {disc['nome']}")
        for assunto in disc.get("assuntos", []):
            lines.append(f"  ├─ {assunto['nome']}")
            for topico in assunto.get("topicos", []):
                lines.append(f"    ├─ {topico['nome']}")
                for subtopico in topico.get("subtopicos", []):
                    lines.append(f"      └─ {subtopico}")
    return "\n".join(lines)
