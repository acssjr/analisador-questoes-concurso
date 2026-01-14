"""
SQLAlchemy models
"""
from src.models.analise_job import AnaliseJob
from src.models.classificacao import Classificacao
from src.models.cluster import Cluster, ClusterQuestao, Similaridade
from src.models.edital import Edital
from src.models.embedding import Embedding
from src.models.projeto import Projeto
from src.models.prova import Prova
from src.models.questao import Questao
from src.models.relatorio import Relatorio

__all__ = [
    "AnaliseJob",
    "Projeto",
    "Prova",
    "Questao",
    "Edital",
    "Classificacao",
    "Embedding",
    "Cluster",
    "ClusterQuestao",
    "Similaridade",
    "Relatorio",
]
