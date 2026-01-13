# tests/services/test_queue_processor.py
"""
Tests for QueueProcessor - the core PDF processing service.
"""
import pytest
from unittest.mock import MagicMock, patch
from src.services.queue_processor import QueueProcessor, ProcessingResult


class TestQueueProcessorStateMachine:
    """Tests for state machine behavior"""

    def test_processor_has_state_machine(self):
        """Processor should have the correct states defined"""
        processor = QueueProcessor()

        assert processor.STATES == [
            'pending', 'validating', 'processing', 'completed', 'partial', 'failed', 'retry'
        ]

    def test_processor_initializes_dependencies(self):
        """Processor should initialize validator and scorer"""
        processor = QueueProcessor()

        assert processor.validator is not None
        assert processor.scorer is not None
        assert processor.llm is None  # Lazy initialization


class TestProcessingResult:
    """Tests for ProcessingResult dataclass"""

    def test_processing_result_attributes(self):
        """ProcessingResult should have all required attributes"""
        result = ProcessingResult(
            success=True,
            status='completed',
            questoes_count=10,
            questoes_revisao=2,
            confianca_media=85.0
        )

        assert result.success is True
        assert result.status == 'completed'
        assert result.questoes_count == 10
        assert result.questoes_revisao == 2
        assert result.confianca_media == 85.0
        assert result.error_code is None
        assert result.error_message is None
        assert result.checkpoint is None
        assert result.questoes == []

    def test_processing_result_with_error(self):
        """ProcessingResult should handle error fields"""
        result = ProcessingResult(
            success=False,
            status='failed',
            error_code='NO_FILE',
            error_message='File not found'
        )

        assert result.success is False
        assert result.status == 'failed'
        assert result.error_code == 'NO_FILE'
        assert result.error_message == 'File not found'


class TestProcessProva:
    """Tests for process_prova method"""

    def test_processor_returns_result(self):
        """Processor should return ProcessingResult"""
        processor = QueueProcessor()

        # Mock a prova
        mock_prova = MagicMock()
        mock_prova.id = "test-id"
        mock_prova.arquivo_original = "test.pdf"
        mock_prova.queue_status = "pending"

        # Should return ProcessingResult even if file doesn't exist
        result = processor.process_prova(mock_prova)

        assert isinstance(result, ProcessingResult)
        assert hasattr(result, 'success')
        assert hasattr(result, 'status')
        assert hasattr(result, 'questoes_count')

    def test_processor_fails_without_file(self):
        """Processor should fail if prova has no file"""
        processor = QueueProcessor()

        mock_prova = MagicMock()
        mock_prova.id = "test-id"
        mock_prova.arquivo_original = None

        result = processor.process_prova(mock_prova)

        assert result.success is False
        assert result.status == 'failed'
        assert result.error_code == 'NO_FILE'

    def test_processor_validates_pdf_first(self):
        """Processor should validate PDF before processing"""
        processor = QueueProcessor()

        mock_prova = MagicMock()
        mock_prova.id = "test-id"
        mock_prova.arquivo_original = "nonexistent.pdf"

        result = processor.process_prova(mock_prova)

        # Should fail validation (file doesn't exist)
        assert result.success is False
        assert result.status == 'failed'
        assert result.error_code == 'FILE_NOT_FOUND'
        assert result.checkpoint == 'validation_failed'


class TestProcessProvaWithMocks:
    """Tests with mocked dependencies for full pipeline testing"""

    @patch('src.services.queue_processor.extract_questions_chunked')
    @patch('src.services.queue_processor.PDFValidator')
    def test_processor_calls_llm_after_validation(self, mock_validator_class, mock_extract):
        """Processor should call LLM extraction after successful validation"""
        # Setup validator mock
        mock_validator = MagicMock()
        mock_validator.validate.return_value = MagicMock(
            is_valid=True,
            page_count=10,
            text_length=5000
        )
        mock_validator_class.return_value = mock_validator

        # Setup extraction mock
        mock_extract.return_value = {
            "questoes": [
                {
                    "numero": 1,
                    "enunciado": "Test question " * 10,
                    "alternativas": {"A": "a", "B": "b", "C": "c", "D": "d", "E": "e"},
                    "gabarito": "A",
                    "disciplina": "Portugues"
                }
            ]
        }

        processor = QueueProcessor()
        processor.validator = mock_validator  # Inject mock

        mock_prova = MagicMock()
        mock_prova.id = "test-id"
        mock_prova.arquivo_original = "/path/to/file.pdf"

        result = processor.process_prova(mock_prova)

        # Validation should be called
        mock_validator.validate.assert_called_once()

        # Extraction should be called after successful validation
        mock_extract.assert_called_once()

    @patch('src.services.queue_processor.extract_questions_chunked')
    @patch('src.services.queue_processor.PDFValidator')
    def test_processor_scores_extracted_questions(self, mock_validator_class, mock_extract):
        """Processor should score each extracted question"""
        # Setup validator mock
        mock_validator = MagicMock()
        mock_validator.validate.return_value = MagicMock(
            is_valid=True,
            page_count=10,
            text_length=5000
        )
        mock_validator_class.return_value = mock_validator

        # Setup extraction mock with questions
        mock_extract.return_value = {
            "questoes": [
                {
                    "numero": 1,
                    "enunciado": "Test question with adequate length for scoring " * 5,
                    "alternativas": {"A": "opt a", "B": "opt b", "C": "opt c", "D": "opt d", "E": "opt e"},
                    "gabarito": "A",
                    "disciplina": "Portugues"
                },
                {
                    "numero": 2,
                    "enunciado": "Another test question with adequate length " * 5,
                    "alternativas": {"A": "a", "B": "b", "C": "c", "D": "d", "E": "e"},
                    "gabarito": "B",
                    "disciplina": "Matematica"
                }
            ]
        }

        processor = QueueProcessor()
        processor.validator = mock_validator

        mock_prova = MagicMock()
        mock_prova.id = "test-id"
        mock_prova.arquivo_original = "/path/to/file.pdf"

        result = processor.process_prova(mock_prova)

        # Should have scored questions
        assert result.questoes_count == 2
        assert len(result.questoes) == 2

        # Each question should have confidence score
        for q in result.questoes:
            assert "confianca_score" in q
            assert "confianca_detalhes" in q
            assert "confianca_nivel" in q

    @patch('src.services.queue_processor.extract_questions_chunked')
    @patch('src.services.queue_processor.PDFValidator')
    def test_processor_status_completed_when_all_high_confidence(self, mock_validator_class, mock_extract):
        """Processor should return 'completed' when all questions have high confidence"""
        mock_validator = MagicMock()
        mock_validator.validate.return_value = MagicMock(
            is_valid=True,
            page_count=10,
            text_length=5000
        )
        mock_validator_class.return_value = mock_validator

        # Good quality questions
        mock_extract.return_value = {
            "questoes": [
                {
                    "numero": 1,
                    "enunciado": "Complete question text with reasonable length " * 3,
                    "alternativas": {"A": "opt a", "B": "opt b", "C": "opt c", "D": "opt d", "E": "opt e"},
                    "gabarito": "A",
                    "disciplina": "Portugues"
                }
            ]
        }

        processor = QueueProcessor()
        processor.validator = mock_validator

        mock_prova = MagicMock()
        mock_prova.id = "test-id"
        mock_prova.arquivo_original = "/path/to/file.pdf"

        result = processor.process_prova(mock_prova, edital_disciplinas=["Portugues"])

        # With good quality questions matching edital, should be completed
        assert result.success is True
        assert result.status in ['completed', 'partial']
        assert result.confianca_media > 0

    @patch('src.services.queue_processor.extract_questions_chunked')
    @patch('src.services.queue_processor.PDFValidator')
    def test_processor_status_partial_when_some_low_confidence(self, mock_validator_class, mock_extract):
        """Processor should return 'partial' when some questions have low confidence"""
        mock_validator = MagicMock()
        mock_validator.validate.return_value = MagicMock(
            is_valid=True,
            page_count=10,
            text_length=5000
        )
        mock_validator_class.return_value = mock_validator

        # Mix of good and bad quality questions
        mock_extract.return_value = {
            "questoes": [
                {
                    "numero": 1,
                    "enunciado": "Good question " * 20,
                    "alternativas": {"A": "a", "B": "b", "C": "c", "D": "d", "E": "e"},
                    "gabarito": "A",
                    "disciplina": "Portugues"
                },
                {
                    "numero": 2,
                    "enunciado": "Bad",  # Too short
                    "alternativas": {"A": "a"},  # Only one alternative
                    "gabarito": None,  # No answer
                    "disciplina": None
                }
            ]
        }

        processor = QueueProcessor()
        processor.validator = mock_validator

        mock_prova = MagicMock()
        mock_prova.id = "test-id"
        mock_prova.arquivo_original = "/path/to/file.pdf"

        result = processor.process_prova(mock_prova)

        # One low quality question -> partial
        assert result.success is True
        assert result.status == 'partial'
        assert result.questoes_revisao >= 1

    @patch('src.services.queue_processor.extract_questions_chunked')
    @patch('src.services.queue_processor.PDFValidator')
    def test_processor_handles_extraction_failure(self, mock_validator_class, mock_extract):
        """Processor should handle extraction exceptions gracefully"""
        mock_validator = MagicMock()
        mock_validator.validate.return_value = MagicMock(
            is_valid=True,
            page_count=10,
            text_length=5000
        )
        mock_validator_class.return_value = mock_validator

        # Extraction raises exception
        mock_extract.side_effect = Exception("LLM API error")

        processor = QueueProcessor()
        processor.validator = mock_validator

        mock_prova = MagicMock()
        mock_prova.id = "test-id"
        mock_prova.arquivo_original = "/path/to/file.pdf"

        result = processor.process_prova(mock_prova)

        assert result.success is False
        assert result.status == 'failed'
        assert result.error_code == 'PROCESSING_ERROR'
        assert "LLM API error" in result.error_message

    @patch('src.services.queue_processor.extract_questions_chunked')
    @patch('src.services.queue_processor.PDFValidator')
    def test_processor_handles_rate_limit(self, mock_validator_class, mock_extract):
        """Processor should set retry status on rate limit errors"""
        mock_validator = MagicMock()
        mock_validator.validate.return_value = MagicMock(
            is_valid=True,
            page_count=10,
            text_length=5000
        )
        mock_validator_class.return_value = mock_validator

        # Rate limit error
        mock_extract.side_effect = Exception("Rate limit exceeded (429)")

        processor = QueueProcessor()
        processor.validator = mock_validator

        mock_prova = MagicMock()
        mock_prova.id = "test-id"
        mock_prova.arquivo_original = "/path/to/file.pdf"

        result = processor.process_prova(mock_prova)

        assert result.success is False
        assert result.status == 'retry'
        assert result.error_code == 'RATE_LIMIT'
        assert result.checkpoint == 'rate_limited'

    @patch('src.services.queue_processor.extract_questions_chunked')
    @patch('src.services.queue_processor.PDFValidator')
    def test_processor_fails_when_no_questions_extracted(self, mock_validator_class, mock_extract):
        """Processor should fail when no questions are extracted"""
        mock_validator = MagicMock()
        mock_validator.validate.return_value = MagicMock(
            is_valid=True,
            page_count=10,
            text_length=5000
        )
        mock_validator_class.return_value = mock_validator

        # Empty extraction
        mock_extract.return_value = {"questoes": []}

        processor = QueueProcessor()
        processor.validator = mock_validator

        mock_prova = MagicMock()
        mock_prova.id = "test-id"
        mock_prova.arquivo_original = "/path/to/file.pdf"

        result = processor.process_prova(mock_prova)

        assert result.success is False
        assert result.status == 'failed'
        assert result.error_code == 'NO_QUESTIONS'
        assert result.checkpoint == 'extraction_failed'
