"""Tests for Map Service"""

from unittest.mock import MagicMock

from src.analysis.map_service import ChunkDigest, MapService, QuestionAnalysis


def test_create_chunks_basic():
    """Test chunk creation"""
    service = MapService(llm=MagicMock())
    questoes = [{"id": f"q{i}"} for i in range(50)]

    chunks = service.create_chunks(questoes, chunk_size=20)

    assert len(chunks) == 3  # 50 / 20 = 2.5, rounded up to 3
    assert len(chunks[0]) == 20
    assert len(chunks[1]) == 20
    assert len(chunks[2]) == 10


def test_create_chunks_small_list():
    """Test with fewer questions than chunk size"""
    service = MapService(llm=MagicMock())
    questoes = [{"id": f"q{i}"} for i in range(5)]

    chunks = service.create_chunks(questoes, chunk_size=20)

    assert len(chunks) == 1
    assert len(chunks[0]) == 5


def test_create_chunks_empty_list():
    """Test with empty list"""
    service = MapService(llm=MagicMock())
    questoes = []

    chunks = service.create_chunks(questoes, chunk_size=20)

    assert len(chunks) == 0


def test_create_chunks_exact_multiple():
    """Test with exact multiple of chunk size"""
    service = MapService(llm=MagicMock())
    questoes = [{"id": f"q{i}"} for i in range(40)]

    chunks = service.create_chunks(questoes, chunk_size=20)

    assert len(chunks) == 2
    assert len(chunks[0]) == 20
    assert len(chunks[1]) == 20


def test_build_analysis_prompt():
    """Test prompt building"""
    service = MapService(llm=MagicMock())

    prompt = service._build_analysis_prompt(
        disciplina="Portugues",
        banca="CEBRASPE",
        questoes_json='[{"id": "q1"}]',
        cluster_info={"cluster_0": ["q1"]},
    )

    assert "Disciplina: Portugues" in prompt
    assert "Banca: CEBRASPE" in prompt
    assert "cluster_0" in prompt
    assert "<thinking>" in prompt
    assert "output_schema" in prompt


def test_build_analysis_prompt_without_cluster():
    """Test prompt building without cluster info"""
    service = MapService(llm=MagicMock())

    prompt = service._build_analysis_prompt(
        disciplina="Matematica", banca="FGV", questoes_json='[{"id": "q1"}]', cluster_info=None
    )

    assert "Disciplina: Matematica" in prompt
    assert "Banca: FGV" in prompt
    # When cluster_info=None, cluster data (like "cluster_0") should not be in prompt
    # Note: generic cluster instructions may still appear in the prompt template
    assert "cluster_0" not in prompt
    assert "cluster_1" not in prompt


def test_parse_response_success():
    """Test parsing valid JSON response"""
    service = MapService(llm=MagicMock())

    response = """```json
{
    "chunk_digest": "Test summary",
    "patterns_found": [{"type": "estilo", "description": "Test pattern", "evidence_ids": ["q1"], "confidence": "high"}],
    "questions_analysis": [
        {"id": "q1", "difficulty": "medium", "difficulty_reasoning": "Test", "bloom_level": "understand", "has_trap": false}
    ]
}
```"""

    result = service._parse_response("chunk_1", response, [])

    assert isinstance(result, ChunkDigest)
    assert result.summary == "Test summary"
    assert len(result.patterns_found) == 1
    assert len(result.questions_analysis) == 1
    assert result.questions_analysis[0].difficulty == "medium"


def test_parse_response_with_trap():
    """Test parsing response with trap detection"""
    service = MapService(llm=MagicMock())

    response = """```json
{
    "chunk_digest": "Questoes com pegadinhas",
    "patterns_found": [],
    "questions_analysis": [
        {"id": "q1", "difficulty": "hard", "difficulty_reasoning": "Complexo", "bloom_level": "analyze", "has_trap": true, "trap_description": "Negacao dupla"}
    ]
}
```"""

    result = service._parse_response("chunk_1", response, [])

    assert result.questions_analysis[0].has_trap is True
    assert result.questions_analysis[0].trap_description == "Negacao dupla"


def test_parse_response_raw_json():
    """Test parsing raw JSON without markdown blocks"""
    service = MapService(llm=MagicMock())

    response = """{
    "chunk_digest": "Test summary",
    "patterns_found": [],
    "questions_analysis": []
}"""

    result = service._parse_response("chunk_1", response, [])

    assert isinstance(result, ChunkDigest)
    assert result.summary == "Test summary"


def test_parse_response_invalid_json():
    """Test handling invalid JSON"""
    service = MapService(llm=MagicMock())

    result = service._parse_response("chunk_1", "invalid json {", [])

    assert isinstance(result, ChunkDigest)
    assert "Erro" in result.summary


def test_parse_response_empty_fields():
    """Test parsing response with missing fields"""
    service = MapService(llm=MagicMock())

    response = """```json
{
    "chunk_digest": "Partial response"
}
```"""

    result = service._parse_response("chunk_1", response, [])

    assert result.summary == "Partial response"
    assert result.patterns_found == []
    assert result.questions_analysis == []


def test_analyze_chunk_integration():
    """Test full analyze_chunk flow"""
    mock_llm = MagicMock()
    mock_llm.generate.return_value = {
        "text": """```json
{
    "chunk_digest": "Padroes encontrados",
    "patterns_found": [],
    "questions_analysis": [
        {"id": "q1", "difficulty": "hard", "difficulty_reasoning": "Complexo", "bloom_level": "analyze", "has_trap": true, "trap_description": "Pegadinha no exceto"}
    ]
}
```""",
        "provider": "groq",
    }

    service = MapService(llm=mock_llm)

    result = service.analyze_chunk(
        chunk_id="chunk_1",
        questoes=[{"id": "q1", "enunciado": "Test", "alternativas": {"A": "a"}}],
        disciplina="Portugues",
        banca="CEBRASPE",
    )

    assert result.chunk_id == "chunk_1"
    assert result.summary == "Padroes encontrados"
    mock_llm.generate.assert_called_once()


def test_analyze_chunk_with_cluster_info():
    """Test analyze_chunk with cluster information"""
    mock_llm = MagicMock()
    mock_llm.generate.return_value = {
        "text": """```json
{
    "chunk_digest": "Cluster analysis",
    "patterns_found": [{"type": "similaridade", "description": "Questoes similares", "evidence_ids": ["q1", "q2"], "confidence": "high"}],
    "questions_analysis": []
}
```""",
        "provider": "groq",
    }

    service = MapService(llm=mock_llm)

    result = service.analyze_chunk(
        chunk_id="chunk_1",
        questoes=[{"id": "q1"}, {"id": "q2"}],
        disciplina="Direito",
        banca="FCC",
        cluster_info={"cluster_0": ["q1", "q2"]},
    )

    assert len(result.patterns_found) == 1
    assert result.patterns_found[0]["type"] == "similaridade"


def test_analyze_chunk_handles_error():
    """Test error handling in analyze_chunk"""
    mock_llm = MagicMock()
    mock_llm.generate.side_effect = Exception("API Error")

    service = MapService(llm=mock_llm)

    result = service.analyze_chunk(
        chunk_id="chunk_1", questoes=[{"id": "q1"}], disciplina="Portugues", banca="CEBRASPE"
    )

    assert result.chunk_id == "chunk_1"
    assert "Erro" in result.summary
    assert result.patterns_found == []
    assert result.questions_analysis == []


def test_question_analysis_dataclass():
    """Test QuestionAnalysis dataclass"""
    qa = QuestionAnalysis(
        questao_id="q1",
        difficulty="hard",
        difficulty_reasoning="Complex reasoning required",
        bloom_level="analyze",
        has_trap=True,
        trap_description="Hidden negation",
    )

    assert qa.questao_id == "q1"
    assert qa.difficulty == "hard"
    assert qa.has_trap is True
    assert qa.trap_description == "Hidden negation"


def test_chunk_digest_dataclass():
    """Test ChunkDigest dataclass"""
    qa = QuestionAnalysis(
        questao_id="q1",
        difficulty="medium",
        difficulty_reasoning="Test",
        bloom_level="understand",
        has_trap=False,
    )

    digest = ChunkDigest(
        chunk_id="chunk_1",
        summary="Test summary",
        patterns_found=[{"type": "estilo", "description": "Pattern"}],
        questions_analysis=[qa],
    )

    assert digest.chunk_id == "chunk_1"
    assert digest.summary == "Test summary"
    assert len(digest.patterns_found) == 1
    assert len(digest.questions_analysis) == 1
