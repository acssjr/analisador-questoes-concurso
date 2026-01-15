"""
Prompts for question classification
"""

SYSTEM_PROMPT_CLASSIFICACAO = """Você é um especialista em análise de questões de concursos públicos brasileiros.

Classifique questões seguindo a taxonomia do edital quando disponível.

REGRAS:
1. Use APENAS categorias que existam na taxonomia do edital (se fornecida)
2. Se a questão não se encaixa na taxonomia, use "fora_taxonomia": true
3. Scores de confiança: 0.0-1.0 (seja honesto, não inflacione)
4. SEMPRE responda em JSON válido, sem texto adicional"""


SYSTEM_PROMPT_CLASSIFICACAO_LITE = """Classifique questões de concurso em JSON.
Use a taxonomia do edital quando fornecida.
Responda APENAS JSON válido."""


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

QUESTÃO #{questao["numero"]}:

ENUNCIADO:
{questao["enunciado"]}

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

RESPONDA em JSON com estes campos:
```json
{
  "disciplina": "nome da disciplina",
  "assunto": "assunto principal",
  "topico": "tópico específico ou null",
  "subtopico": "subtópico ou null",
  "conceito_especifico": "conceito exato sendo testado",
  "item_edital_path": "Caminho > Na > Taxonomia",
  "confianca_disciplina": 0.95,
  "confianca_assunto": 0.85,
  "confianca_topico": 0.7,
  "confianca_subtopico": 0.6,
  "conceito_testado": "O que a questão avalia",
  "habilidade_bloom": "aplicar",
  "nivel_dificuldade": "intermediario",
  "fora_taxonomia": false,
  "motivo_fora_taxonomia": null
}
```

NOTAS:
- habilidade_bloom: lembrar|entender|aplicar|analisar|avaliar|criar
- nivel_dificuldade: basico|intermediario|avancado
- Se não encaixar na taxonomia: fora_taxonomia=true + motivo
- Se não tiver certeza do subtopico, use null (não invente)
"""

    return prompt


def build_classification_prompt_lite(
    questao: dict,
    disciplinas_permitidas: list[str] = None,
) -> str:
    """
    Build lightweight prompt for batch classification (saves tokens).

    Args:
        questao: Question dict
        disciplinas_permitidas: List of allowed discipline names

    Returns:
        str: Compact prompt
    """
    prompt = f"""Q{questao["numero"]}: {questao["enunciado"][:500]}
"""

    if questao.get("gabarito"):
        prompt += f"Resp: {questao['gabarito']}\n"

    if disciplinas_permitidas:
        prompt += f"\nDisciplinas válidas: {', '.join(disciplinas_permitidas)}\n"

    prompt += """
JSON: {"disciplina":"...","assunto":"...","topico":"...","conceito_testado":"...","confianca":0.0-1.0,"habilidade_bloom":"...","nivel":"..."}"""

    return prompt


def format_taxonomia(taxonomia: dict) -> str:
    """Format taxonomy dict as readable text"""
    lines = []
    for disc in taxonomia.get("disciplinas", []):
        lines.append(f"• {disc['nome']}")
        # Handle both old format (assuntos list) and new format (itens list)
        items = disc.get("assuntos", []) or disc.get("itens", [])
        for item in items:
            item_name = item.get("nome") or item.get("texto", "")
            lines.append(f"  ├─ {item_name}")
            # Handle nested items (topicos or filhos)
            sub_items = item.get("topicos", []) or item.get("filhos", [])
            for sub in sub_items:
                sub_name = sub.get("nome") or sub.get("texto", "") if isinstance(sub, dict) else sub
                lines.append(f"    └─ {sub_name}")
    return "\n".join(lines)


def get_disciplinas_from_taxonomia(taxonomia: dict) -> list[str]:
    """Extract discipline names from taxonomy for filtering"""
    if not taxonomia:
        return []
    return [d.get("nome", "") for d in taxonomia.get("disciplinas", []) if d.get("nome")]
