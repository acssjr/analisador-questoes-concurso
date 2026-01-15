"""Tests for CoVe Service"""

from unittest.mock import MagicMock

from src.analysis.cove_service import CoVeService, VerificationResult, VerifiedReport


def test_cove_service_initialization():
    """Test service initialization"""
    service = CoVeService(llm=MagicMock())
    assert service.llm is not None


def test_extract_claims():
    """Test claim extraction"""
    mock_llm = MagicMock()
    mock_llm.generate.return_value = {"text": '{"claims": ["claim 1", "claim 2"]}'}

    service = CoVeService(llm=mock_llm)
    claims = service._extract_claims("test report", max_claims=10)

    assert len(claims) == 2
    assert "claim 1" in claims


def test_extract_claims_with_code_block():
    """Test claim extraction when response has code block"""
    mock_llm = MagicMock()
    mock_llm.generate.return_value = {"text": '```json\n{"claims": ["claim A", "claim B"]}\n```'}

    service = CoVeService(llm=mock_llm)
    claims = service._extract_claims("test report", max_claims=10)

    assert len(claims) == 2
    assert "claim A" in claims


def test_extract_claims_error_handling():
    """Test claim extraction error handling"""
    mock_llm = MagicMock()
    mock_llm.generate.return_value = {"text": "invalid json"}

    service = CoVeService(llm=mock_llm)
    claims = service._extract_claims("test report", max_claims=10)

    assert claims == []


def test_generate_verification_question():
    """Test verification question generation"""
    mock_llm = MagicMock()
    mock_llm.generate.return_value = {"text": "Quais questoes abordam este topico?"}

    service = CoVeService(llm=mock_llm)
    question = service._generate_verification_question("Test claim")

    assert "Quais" in question or "?" in question


def test_find_evidence():
    """Test evidence finding"""
    mock_llm = MagicMock()
    mock_llm.generate.return_value = {
        "text": '{"evidence_ids": ["q1", "q2"], "summary": "Found evidence"}'
    }

    service = CoVeService(llm=mock_llm)
    questoes = [{"id": "q1", "enunciado": "Test", "disciplina": "Portugues"}]

    ids, summary = service._find_evidence("Test question", questoes)

    assert "q1" in ids
    assert "Found evidence" in summary


def test_find_evidence_with_numero_field():
    """Test evidence finding when questions use 'numero' instead of 'id'"""
    mock_llm = MagicMock()
    mock_llm.generate.return_value = {
        "text": '{"evidence_ids": ["1"], "summary": "Evidence from question 1"}'
    }

    service = CoVeService(llm=mock_llm)
    questoes = [{"numero": "1", "enunciado": "Test question", "disciplina": "Direito"}]

    ids, summary = service._find_evidence("Test question", questoes)

    assert "1" in ids
    assert "Evidence from question 1" in summary


def test_find_evidence_error_handling():
    """Test evidence finding error handling"""
    mock_llm = MagicMock()
    mock_llm.generate.return_value = {"text": "not valid json"}

    service = CoVeService(llm=mock_llm)
    questoes = [{"id": "q1", "enunciado": "Test"}]

    ids, summary = service._find_evidence("Test question", questoes)

    assert ids == []
    assert "Falha ao buscar evidencias" in summary


def test_validate_claim_verified():
    """Test claim validation - verified case"""
    mock_llm = MagicMock()
    mock_llm.generate.return_value = {
        "text": '{"is_verified": true, "confidence": "high", "notes": "Clear evidence"}'
    }

    service = CoVeService(llm=mock_llm)
    is_verified, confidence, notes = service._validate_claim("claim", "evidence")

    assert is_verified is True
    assert confidence == "high"
    assert notes == "Clear evidence"


def test_validate_claim_rejected():
    """Test claim validation - rejected case"""
    mock_llm = MagicMock()
    mock_llm.generate.return_value = {
        "text": '{"is_verified": false, "confidence": "low", "notes": "No evidence"}'
    }

    service = CoVeService(llm=mock_llm)
    is_verified, confidence, notes = service._validate_claim("claim", "evidence")

    assert is_verified is False
    assert confidence == "low"
    assert notes == "No evidence"


def test_validate_claim_error_handling():
    """Test claim validation error handling"""
    mock_llm = MagicMock()
    mock_llm.generate.return_value = {"text": "invalid json"}

    service = CoVeService(llm=mock_llm)
    is_verified, confidence, notes = service._validate_claim("claim", "evidence")

    assert is_verified is False
    assert confidence == "low"
    assert "Falha na validacao" in notes


def test_generate_cleaned_report_no_rejections():
    """Test cleaned report with no rejections"""
    service = CoVeService(llm=MagicMock())

    results = [
        VerificationResult(
            claim="Test claim",
            verification_question="Test?",
            evidence_ids=["q1"],
            evidence_summary="Evidence",
            is_verified=True,
            confidence="high",
        )
    ]

    cleaned = service._generate_cleaned_report("Original report", results)

    assert cleaned == "Original report"


def test_generate_cleaned_report_with_rejections():
    """Test cleaned report with rejections"""
    service = CoVeService(llm=MagicMock())

    results = [
        VerificationResult(
            claim="Rejected claim",
            verification_question="Test?",
            evidence_ids=[],
            evidence_summary="No evidence",
            is_verified=False,
            confidence="low",
        )
    ]

    cleaned = service._generate_cleaned_report("Original report", results)

    assert "AVISO" in cleaned
    assert "Rejected claim" in cleaned
    assert "Original report" in cleaned


def test_generate_cleaned_report_mixed_results():
    """Test cleaned report with mixed verification results"""
    service = CoVeService(llm=MagicMock())

    results = [
        VerificationResult(
            claim="Verified claim",
            verification_question="Q1?",
            evidence_ids=["q1"],
            evidence_summary="Evidence found",
            is_verified=True,
            confidence="high",
        ),
        VerificationResult(
            claim="Rejected claim",
            verification_question="Q2?",
            evidence_ids=[],
            evidence_summary="No evidence",
            is_verified=False,
            confidence="low",
        ),
    ]

    cleaned = service._generate_cleaned_report("Original report", results)

    assert "AVISO" in cleaned
    assert "Rejected claim" in cleaned
    assert "Verified claim" not in cleaned.split("---")[0]  # Verified not in warning section


def test_parse_json_response_plain():
    """Test JSON parsing without code blocks"""
    service = CoVeService(llm=MagicMock())

    result = service._parse_json_response('{"key": "value"}')

    assert result == {"key": "value"}


def test_parse_json_response_with_code_block():
    """Test JSON parsing with code blocks"""
    service = CoVeService(llm=MagicMock())

    result = service._parse_json_response('```json\n{"key": "value"}\n```')

    assert result == {"key": "value"}


def test_parse_json_response_with_generic_code_block():
    """Test JSON parsing with generic code blocks"""
    service = CoVeService(llm=MagicMock())

    result = service._parse_json_response('```\n{"key": "value"}\n```')

    assert result == {"key": "value"}


def test_verify_claim_full_flow():
    """Test full claim verification flow"""
    mock_llm = MagicMock()

    # Mock responses for each step
    mock_llm.generate.side_effect = [
        {"text": "Existem questoes sobre este tema?"},  # verification question
        {
            "text": '{"evidence_ids": ["q1"], "summary": "Found relevant questions"}'
        },  # find evidence
        {"text": '{"is_verified": true, "confidence": "high", "notes": "Confirmed"}'},  # validate
    ]

    service = CoVeService(llm=mock_llm)
    questoes = [{"id": "q1", "enunciado": "Test question", "disciplina": "Portugues"}]

    result = service._verify_claim("Test claim", questoes)

    assert isinstance(result, VerificationResult)
    assert result.claim == "Test claim"
    assert result.is_verified is True
    assert result.confidence == "high"
    assert "q1" in result.evidence_ids


def test_verify_report_integration():
    """Test full verification flow"""
    mock_llm = MagicMock()

    # Mock responses in order:
    # 1. extract_claims
    # 2. For claim 1: generate_verification_question, find_evidence, validate_claim
    mock_llm.generate.side_effect = [
        {"text": '{"claims": ["Claim 1"]}'},  # extract_claims
        {"text": "Verification question?"},  # generate_verification_question
        {"text": '{"evidence_ids": ["q1"], "summary": "Evidence found"}'},  # find_evidence
        {"text": '{"is_verified": true, "confidence": "high"}'},  # validate_claim
    ]

    service = CoVeService(llm=mock_llm)
    questoes = [{"id": "q1", "enunciado": "Test", "disciplina": "Test"}]

    result = service.verify_report("Test report", questoes, max_claims=5)

    assert isinstance(result, VerifiedReport)
    assert result.original_claims == 1
    assert result.verified_claims == 1
    assert result.rejected_claims == 0
    assert len(result.verification_results) == 1
    assert result.verification_results[0].is_verified is True


def test_verify_report_with_rejections():
    """Test verification flow with rejected claims"""
    mock_llm = MagicMock()

    mock_llm.generate.side_effect = [
        {"text": '{"claims": ["Claim 1", "Claim 2"]}'},  # extract_claims
        # Claim 1 - verified
        {"text": "Q1?"},
        {"text": '{"evidence_ids": ["q1"], "summary": "Found"}'},
        {"text": '{"is_verified": true, "confidence": "high"}'},
        # Claim 2 - rejected
        {"text": "Q2?"},
        {"text": '{"evidence_ids": [], "summary": "Not found"}'},
        {"text": '{"is_verified": false, "confidence": "low"}'},
    ]

    service = CoVeService(llm=mock_llm)
    questoes = [{"id": "q1", "enunciado": "Test", "disciplina": "Test"}]

    result = service.verify_report("Test report", questoes, max_claims=5)

    assert result.original_claims == 2
    assert result.verified_claims == 1
    assert result.rejected_claims == 1
    assert "AVISO" in result.cleaned_report


def test_verify_report_empty_claims():
    """Test verification with no extractable claims"""
    mock_llm = MagicMock()
    mock_llm.generate.return_value = {"text": "not valid json"}

    service = CoVeService(llm=mock_llm)
    questoes = [{"id": "q1", "enunciado": "Test"}]

    result = service.verify_report("Test report", questoes)

    assert result.original_claims == 0
    assert result.verified_claims == 0
    assert result.rejected_claims == 0
    assert result.cleaned_report == "Test report"


def test_verification_result_dataclass():
    """Test VerificationResult dataclass"""
    result = VerificationResult(
        claim="Test claim",
        verification_question="Is this true?",
        evidence_ids=["q1", "q2"],
        evidence_summary="Found evidence",
        is_verified=True,
        confidence="high",
        notes="Additional notes",
    )

    assert result.claim == "Test claim"
    assert result.verification_question == "Is this true?"
    assert len(result.evidence_ids) == 2
    assert result.is_verified is True
    assert result.confidence == "high"
    assert result.notes == "Additional notes"


def test_verification_result_optional_notes():
    """Test VerificationResult with optional notes"""
    result = VerificationResult(
        claim="Test",
        verification_question="Q?",
        evidence_ids=[],
        evidence_summary="None",
        is_verified=False,
        confidence="low",
    )

    assert result.notes is None


def test_verified_report_dataclass():
    """Test VerifiedReport dataclass"""
    verification_results = [
        VerificationResult(
            claim="Claim 1",
            verification_question="Q1?",
            evidence_ids=["q1"],
            evidence_summary="Evidence",
            is_verified=True,
            confidence="high",
        )
    ]

    report = VerifiedReport(
        original_claims=1,
        verified_claims=1,
        rejected_claims=0,
        verification_results=verification_results,
        cleaned_report="Clean report",
    )

    assert report.original_claims == 1
    assert report.verified_claims == 1
    assert report.rejected_claims == 0
    assert len(report.verification_results) == 1
    assert report.cleaned_report == "Clean report"
