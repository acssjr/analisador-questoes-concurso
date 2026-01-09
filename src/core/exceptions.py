"""
Custom exceptions for the application
"""


class AnalisadorException(Exception):
    """Base exception for all application errors"""

    pass


# Extraction Exceptions
class ExtractionError(AnalisadorException):
    """Base exception for extraction errors"""

    pass


class PDFFormatError(ExtractionError):
    """PDF format not recognized or invalid"""

    pass


class GabaritoNotFoundError(ExtractionError):
    """Gabarito file not found or could not be parsed"""

    pass


class ImageExtractionError(ExtractionError):
    """Failed to extract images from PDF"""

    pass


class OCRError(ExtractionError):
    """OCR processing failed"""

    pass


# LLM Exceptions
class LLMError(AnalisadorException):
    """Base exception for LLM errors"""

    pass


class LLMAPIError(LLMError):
    """LLM API request failed"""

    pass


class LLMRateLimitError(LLMError):
    """LLM API rate limit exceeded"""

    pass


class LLMResponseError(LLMError):
    """LLM response could not be parsed"""

    pass


# Classification Exceptions
class ClassificationError(AnalisadorException):
    """Base exception for classification errors"""

    pass


class TaxonomyNotFoundError(ClassificationError):
    """Edital taxonomy not found"""

    pass


# Analysis Exceptions
class AnalysisError(AnalisadorException):
    """Base exception for analysis errors"""

    pass


class EmbeddingError(AnalysisError):
    """Failed to generate embeddings"""

    pass


class ClusteringError(AnalysisError):
    """Clustering algorithm failed"""

    pass


# Report Exceptions
class ReportError(AnalisadorException):
    """Base exception for report generation errors"""

    pass


class TemplateNotFoundError(ReportError):
    """Report template not found"""

    pass


class PDFGenerationError(ReportError):
    """Failed to generate PDF report"""

    pass


# Database Exceptions
class DatabaseError(AnalisadorException):
    """Base exception for database errors"""

    pass


class RecordNotFoundError(DatabaseError):
    """Database record not found"""

    pass


class DuplicateRecordError(DatabaseError):
    """Duplicate record already exists"""

    pass
