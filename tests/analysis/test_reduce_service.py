"""Tests for Reduce Service"""

from unittest.mock import MagicMock

from src.analysis.map_service import ChunkDigest, QuestionAnalysis
from src.analysis.reduce_service import AnalysisReport, PatternFinding, ReduceService


def test_reduce_service_initialization():
    """Test service initialization"""
    service = ReduceService(llm=MagicMock(), num_passes=3, temperature=0.5)

    assert service.num_passes == 3
    assert service.temperature == 0.5


def test_reduce_service_default_values():
    """Test service with default values"""
    service = ReduceService(llm=MagicMock())

    assert service.num_passes == 5
    assert service.temperature == 0.7


def test_format_digests():
    """Test digest formatting for prompt"""
    service = ReduceService(llm=MagicMock())

    digests = [
        ChunkDigest(
            chunk_id="chunk_1",
            summary="Test summary",
            patterns_found=[{"type": "estilo", "description": "Test pattern"}],
            questions_analysis=[],
        )
    ]

    formatted = service._format_digests(digests)

    assert "chunk_1" in formatted
    assert "Test summary" in formatted
    assert "estilo" in formatted


def test_format_digests_empty_patterns():
    """Test digest formatting when no patterns found"""
    service = ReduceService(llm=MagicMock())

    digests = [
        ChunkDigest(
            chunk_id="chunk_1",
            summary="Summary without patterns",
            patterns_found=[],
            questions_analysis=[],
        )
    ]

    formatted = service._format_digests(digests)

    assert "chunk_1" in formatted
    assert "Nenhum padrao identificado" in formatted


def test_format_digests_multiple():
    """Test formatting multiple digests"""
    service = ReduceService(llm=MagicMock())

    digests = [
        ChunkDigest(
            chunk_id="chunk_1",
            summary="First summary",
            patterns_found=[{"type": "temporal", "description": "Pattern 1"}],
            questions_analysis=[],
        ),
        ChunkDigest(
            chunk_id="chunk_2",
            summary="Second summary",
            patterns_found=[{"type": "estilo", "description": "Pattern 2"}],
            questions_analysis=[],
        ),
    ]

    formatted = service._format_digests(digests)

    assert "chunk_1" in formatted
    assert "chunk_2" in formatted
    assert "First summary" in formatted
    assert "Second summary" in formatted


def test_consolidate_patterns_majority_voting():
    """Test pattern consolidation with majority voting"""
    service = ReduceService(llm=MagicMock(), num_passes=5)

    patterns = [
        {"type": "temporal", "description": "Pattern A", "evidence_ids": ["q1"]},
        {"type": "temporal", "description": "Pattern A", "evidence_ids": ["q2"]},
        {"type": "temporal", "description": "Pattern A", "evidence_ids": ["q1"]},
        {"type": "estilo", "description": "Pattern B", "evidence_ids": ["q3"]},
    ]

    result = service._consolidate_patterns(patterns)

    # Pattern A should have 3 votes (high confidence)
    pattern_a = next(p for p in result if "Pattern A" in p.description)
    assert pattern_a.votes == 3
    assert pattern_a.confidence == "high"

    # Pattern B should have 1 vote (low confidence)
    pattern_b = next(p for p in result if "Pattern B" in p.description)
    assert pattern_b.votes == 1
    assert pattern_b.confidence == "low"


def test_consolidate_patterns_medium_confidence():
    """Test pattern with medium confidence (2 votes)"""
    service = ReduceService(llm=MagicMock(), num_passes=5)

    patterns = [
        {"type": "dificuldade", "description": "Medium pattern", "evidence_ids": ["q1"]},
        {"type": "dificuldade", "description": "Medium pattern", "evidence_ids": ["q2"]},
    ]

    result = service._consolidate_patterns(patterns)

    pattern = result[0]
    assert pattern.votes == 2
    assert pattern.confidence == "medium"


def test_consolidate_patterns_evidence_aggregation():
    """Test that evidence IDs are aggregated across passes"""
    service = ReduceService(llm=MagicMock())

    patterns = [
        {"type": "temporal", "description": "Same pattern", "evidence_ids": ["q1", "q2"]},
        {"type": "temporal", "description": "Same pattern", "evidence_ids": ["q2", "q3"]},
        {"type": "temporal", "description": "Same pattern", "evidence_ids": ["q4"]},
    ]

    result = service._consolidate_patterns(patterns)

    pattern = result[0]
    # Should have unique evidence IDs: q1, q2, q3, q4
    assert len(pattern.evidence_ids) == 4
    assert set(pattern.evidence_ids) == {"q1", "q2", "q3", "q4"}


def test_consolidate_patterns_sorted_by_votes():
    """Test that patterns are sorted by votes descending"""
    service = ReduceService(llm=MagicMock())

    patterns = [
        {"type": "estilo", "description": "One vote", "evidence_ids": []},
        {"type": "temporal", "description": "Three votes", "evidence_ids": []},
        {"type": "temporal", "description": "Three votes", "evidence_ids": []},
        {"type": "temporal", "description": "Three votes", "evidence_ids": []},
        {"type": "pegadinha", "description": "Two votes", "evidence_ids": []},
        {"type": "pegadinha", "description": "Two votes", "evidence_ids": []},
    ]

    result = service._consolidate_patterns(patterns)

    assert result[0].votes == 3
    assert result[1].votes == 2
    assert result[2].votes == 1


def test_consolidate_patterns_empty():
    """Test consolidation with empty patterns list"""
    service = ReduceService(llm=MagicMock())

    result = service._consolidate_patterns([])

    assert result == []


def test_parse_synthesis_response_valid():
    """Test parsing valid JSON response"""
    service = ReduceService(llm=MagicMock())

    response = """```json
{
    "patterns": [{"type": "temporal", "description": "Test", "evidence_ids": ["q1"], "confidence": "high"}],
    "report_text": "Full report here",
    "study_recommendations": ["Study topic X"]
}
```"""

    result = service._parse_synthesis_response(response)

    assert len(result["patterns"]) == 1
    assert result["report_text"] == "Full report here"
    assert len(result["study_recommendations"]) == 1


def test_parse_synthesis_response_raw_json():
    """Test parsing raw JSON without markdown blocks"""
    service = ReduceService(llm=MagicMock())

    response = """{
    "patterns": [{"type": "estilo", "description": "Style pattern", "evidence_ids": [], "confidence": "medium"}],
    "report_text": "Report text",
    "study_recommendations": []
}"""

    result = service._parse_synthesis_response(response)

    assert len(result["patterns"]) == 1
    assert result["patterns"][0]["type"] == "estilo"


def test_parse_synthesis_response_invalid():
    """Test handling invalid JSON"""
    service = ReduceService(llm=MagicMock())

    result = service._parse_synthesis_response("invalid json {")

    assert result["patterns"] == []
    assert "invalid json" in result["report_text"]


def test_parse_synthesis_response_partial():
    """Test handling partial JSON response"""
    service = ReduceService(llm=MagicMock())

    response = """```json
{
    "patterns": [],
    "report_text": "Partial report"
}
```"""

    result = service._parse_synthesis_response(response)

    assert result["patterns"] == []
    assert result["report_text"] == "Partial report"
    # study_recommendations not present in response
    assert result.get("study_recommendations") is None


def test_synthesize_integration():
    """Test full synthesis flow"""
    mock_llm = MagicMock()
    mock_llm.generate.return_value = {
        "text": """```json
{
    "patterns": [{"type": "temporal", "description": "Evolucao de topicos", "evidence_ids": ["q1"], "confidence": "high"}],
    "report_text": "Analise completa",
    "study_recommendations": ["Priorizar gramatica"]
}
```"""
    }

    service = ReduceService(llm=mock_llm, num_passes=2)

    digests = [
        ChunkDigest(
            chunk_id="chunk_1",
            summary="Test",
            patterns_found=[],
            questions_analysis=[
                QuestionAnalysis(
                    questao_id="q1",
                    difficulty="medium",
                    difficulty_reasoning="Test",
                    bloom_level="understand",
                    has_trap=False,
                )
            ],
        )
    ]

    result = service.synthesize(
        chunk_digests=digests,
        similarity_report={"similar_pairs": []},
        disciplina="Portugues",
        banca="CEBRASPE",
        anos=[2022, 2023],
        total_questoes=50,
    )

    assert isinstance(result, AnalysisReport)
    assert result.disciplina == "Portugues"
    assert mock_llm.generate.call_count == 2  # num_passes=2


def test_synthesize_aggregates_recommendations():
    """Test that recommendations are deduplicated"""
    mock_llm = MagicMock()
    # Return same recommendation in both passes
    mock_llm.generate.return_value = {
        "text": """```json
{
    "patterns": [],
    "report_text": "Report",
    "study_recommendations": ["Priorizar gramatica", "Estudar verbos"]
}
```"""
    }

    service = ReduceService(llm=mock_llm, num_passes=2)

    result = service.synthesize(
        chunk_digests=[],
        similarity_report={},
        disciplina="Portugues",
        banca="CEBRASPE",
        anos=[2023],
        total_questoes=10,
    )

    # Should deduplicate identical recommendations
    assert "Priorizar gramatica" in result.study_recommendations
    # Count occurrences - should appear only once
    assert result.study_recommendations.count("Priorizar gramatica") == 1


def test_synthesize_handles_pass_failures():
    """Test synthesis continues even if some passes fail"""
    mock_llm = MagicMock()
    call_count = [0]

    def side_effect(*args, **kwargs):
        call_count[0] += 1
        if call_count[0] == 1:
            raise Exception("First pass failed")
        return {
            "text": """{"patterns": [], "report_text": "Success", "study_recommendations": []}"""
        }

    mock_llm.generate.side_effect = side_effect

    service = ReduceService(llm=mock_llm, num_passes=2)

    result = service.synthesize(
        chunk_digests=[],
        similarity_report={},
        disciplina="Portugues",
        banca="CEBRASPE",
        anos=[2023],
        total_questoes=10,
    )

    # Should still return a result
    assert isinstance(result, AnalysisReport)
    assert mock_llm.generate.call_count == 2


def test_build_final_report_difficulty_aggregation():
    """Test difficulty distribution aggregation"""
    service = ReduceService(llm=MagicMock())

    digests = [
        ChunkDigest(
            chunk_id="chunk_1",
            summary="Test",
            patterns_found=[],
            questions_analysis=[
                QuestionAnalysis(
                    questao_id="q1",
                    difficulty="easy",
                    difficulty_reasoning="",
                    bloom_level="remember",
                    has_trap=False,
                ),
                QuestionAnalysis(
                    questao_id="q2",
                    difficulty="medium",
                    difficulty_reasoning="",
                    bloom_level="understand",
                    has_trap=False,
                ),
                QuestionAnalysis(
                    questao_id="q3",
                    difficulty="medium",
                    difficulty_reasoning="",
                    bloom_level="understand",
                    has_trap=False,
                ),
                QuestionAnalysis(
                    questao_id="q4",
                    difficulty="hard",
                    difficulty_reasoning="",
                    bloom_level="analyze",
                    has_trap=False,
                ),
            ],
        )
    ]

    result = service._build_final_report(
        consolidated_patterns=[],
        all_reports=["Report 1"],
        all_recommendations=["Rec 1"],
        disciplina="Portugues",
        total_questoes=4,
        chunk_digests=digests,
    )

    assert result.difficulty_analysis["easy"] == 1
    assert result.difficulty_analysis["medium"] == 2
    assert result.difficulty_analysis["hard"] == 1


def test_build_final_report_trap_aggregation():
    """Test trap analysis aggregation"""
    service = ReduceService(llm=MagicMock())

    digests = [
        ChunkDigest(
            chunk_id="chunk_1",
            summary="Test",
            patterns_found=[],
            questions_analysis=[
                QuestionAnalysis(
                    questao_id="q1",
                    difficulty="medium",
                    difficulty_reasoning="",
                    bloom_level="understand",
                    has_trap=True,
                    trap_description="Negacao dupla",
                ),
                QuestionAnalysis(
                    questao_id="q2",
                    difficulty="medium",
                    difficulty_reasoning="",
                    bloom_level="understand",
                    has_trap=True,
                    trap_description="Negacao dupla",
                ),
                QuestionAnalysis(
                    questao_id="q3",
                    difficulty="medium",
                    difficulty_reasoning="",
                    bloom_level="understand",
                    has_trap=True,
                    trap_description="Exceto",
                ),
                QuestionAnalysis(
                    questao_id="q4",
                    difficulty="medium",
                    difficulty_reasoning="",
                    bloom_level="understand",
                    has_trap=False,
                ),
            ],
        )
    ]

    result = service._build_final_report(
        consolidated_patterns=[],
        all_reports=[],
        all_recommendations=[],
        disciplina="Portugues",
        total_questoes=4,
        chunk_digests=digests,
    )

    # Trap descriptions are truncated to 30 chars
    assert "Negacao dupla" in str(result.trap_analysis)
    assert "Exceto" in str(result.trap_analysis)


def test_build_final_report_pattern_categorization():
    """Test pattern categorization by type"""
    service = ReduceService(llm=MagicMock())

    patterns = [
        PatternFinding(
            pattern_type="temporal",
            description="Time pattern",
            evidence_ids=["q1"],
            confidence="high",
            votes=3,
        ),
        PatternFinding(
            pattern_type="similaridade",
            description="Similar pattern",
            evidence_ids=["q2"],
            confidence="medium",
            votes=2,
        ),
        PatternFinding(
            pattern_type="dificuldade",
            description="Difficulty pattern",
            evidence_ids=["q3"],
            confidence="low",
            votes=1,
        ),
    ]

    result = service._build_final_report(
        consolidated_patterns=patterns,
        all_reports=["Report"],
        all_recommendations=["Rec"],
        disciplina="Portugues",
        total_questoes=10,
        chunk_digests=[],
    )

    assert len(result.temporal_patterns) == 1
    assert result.temporal_patterns[0].pattern_type == "temporal"
    assert len(result.similarity_patterns) == 1
    assert result.similarity_patterns[0].pattern_type == "similaridade"


def test_build_final_report_raw_text_limit():
    """Test raw text is limited to 10000 chars"""
    service = ReduceService(llm=MagicMock())

    long_report = "A" * 20000

    result = service._build_final_report(
        consolidated_patterns=[],
        all_reports=[long_report],
        all_recommendations=[],
        disciplina="Portugues",
        total_questoes=10,
        chunk_digests=[],
    )

    assert len(result.raw_text) <= 10000


def test_pattern_finding_dataclass():
    """Test PatternFinding dataclass"""
    pattern = PatternFinding(
        pattern_type="temporal",
        description="Topics evolved over time",
        evidence_ids=["q1", "q2"],
        confidence="high",
        votes=4,
    )

    assert pattern.pattern_type == "temporal"
    assert pattern.description == "Topics evolved over time"
    assert len(pattern.evidence_ids) == 2
    assert pattern.confidence == "high"
    assert pattern.votes == 4


def test_analysis_report_dataclass():
    """Test AnalysisReport dataclass"""
    report = AnalysisReport(
        disciplina="Portugues",
        total_questoes=100,
        temporal_patterns=[],
        similarity_patterns=[],
        difficulty_analysis={"easy": 20, "medium": 50, "hard": 30},
        trap_analysis={"Negacao dupla": 15},
        study_recommendations=["Focus on grammar"],
        raw_text="Full analysis text",
    )

    assert report.disciplina == "Portugues"
    assert report.total_questoes == 100
    assert report.difficulty_analysis["medium"] == 50
    assert len(report.study_recommendations) == 1


def test_run_synthesis_pass_uses_anthropic():
    """Test that synthesis pass uses anthropic provider"""
    mock_llm = MagicMock()
    mock_llm.generate.return_value = {
        "text": '{"patterns": [], "report_text": "", "study_recommendations": []}'
    }

    service = ReduceService(llm=mock_llm, num_passes=1)

    service._run_synthesis_pass(
        digests_summary="Test",
        similarity_report={},
        disciplina="Portugues",
        banca="CEBRASPE",
        anos=[2023],
        total_questoes=10,
        pass_num=0,
    )

    # Verify anthropic is preferred provider
    call_kwargs = mock_llm.generate.call_args[1]
    assert call_kwargs["preferred_provider"] == "anthropic"
    assert call_kwargs["temperature"] == 0.7


def test_default_recommendations_when_empty():
    """Test default recommendation when none found"""
    service = ReduceService(llm=MagicMock())

    result = service._build_final_report(
        consolidated_patterns=[],
        all_reports=[],
        all_recommendations=[],
        disciplina="Portugues",
        total_questoes=10,
        chunk_digests=[],
    )

    assert result.study_recommendations == ["Aguardando analise completa"]
