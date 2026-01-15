"""
Projeto routes - CRUD for projects
"""

import uuid
from typing import Optional

from fastapi import APIRouter, HTTPException, Query
from loguru import logger
from sqlalchemy import func, select
from sqlalchemy.orm import selectinload

from src.core.database import get_db
from src.models.edital import Edital
from src.models.projeto import Projeto
from src.models.questao import Questao
from src.schemas.projeto import (
    ProjetoCreate,
    ProjetoListResponse,
    ProjetoRead,
    ProjetoReadWithEdital,
    ProjetoStats,
    ProjetoUpdate,
)

router = APIRouter()


@router.get("/", response_model=ProjetoListResponse)
async def list_projetos(
    status: Optional[str] = Query(None, description="Filter by status"),
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
):
    """
    List all projetos with their edital info
    """
    try:
        async for db in get_db():
            # Build query
            stmt = select(Projeto).options(selectinload(Projeto.edital))

            if status:
                stmt = stmt.where(Projeto.status == status)

            stmt = stmt.order_by(Projeto.updated_at.desc())
            stmt = stmt.limit(limit).offset(offset)

            result = await db.execute(stmt)
            projetos = result.scalars().all()

            # Count total
            count_stmt = select(func.count(Projeto.id))
            if status:
                count_stmt = count_stmt.where(Projeto.status == status)
            count_result = await db.execute(count_stmt)
            total = count_result.scalar()

            # Build response with edital info
            projetos_response = []
            for p in projetos:
                proj_dict = {
                    "id": p.id,
                    "nome": p.nome,
                    "descricao": p.descricao,
                    "banca": p.banca,
                    "cargo": p.cargo,
                    "ano": p.ano,
                    "status": p.status,
                    "total_provas": p.total_provas,
                    "total_questoes": p.total_questoes,
                    "total_questoes_validas": p.total_questoes_validas,
                    "total_anuladas": p.total_anuladas,
                    "config": p.config,
                    "created_at": p.created_at,
                    "updated_at": p.updated_at,
                    "edital_id": p.edital.id if p.edital else None,
                    "edital_nome": p.edital.nome if p.edital else None,
                    "has_taxonomia": bool(
                        p.edital and p.edital.taxonomia and p.edital.taxonomia.get("disciplinas")
                    ),
                }
                projetos_response.append(ProjetoReadWithEdital(**proj_dict))

            return ProjetoListResponse(projetos=projetos_response, total=total)

    except Exception as e:
        logger.error(f"Failed to list projetos: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/", response_model=ProjetoRead)
async def create_projeto(projeto: ProjetoCreate):
    """
    Create a new projeto
    """
    try:
        async for db in get_db():
            new_projeto = Projeto(
                nome=projeto.nome,
                descricao=projeto.descricao,
                banca=projeto.banca,
                cargo=projeto.cargo,
                ano=projeto.ano,
                status="configurando",
            )

            db.add(new_projeto)
            await db.commit()
            await db.refresh(new_projeto)

            logger.info(f"Projeto created: {new_projeto.id}")
            return ProjetoRead.model_validate(new_projeto)

    except Exception as e:
        logger.error(f"Failed to create projeto: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{projeto_id}", response_model=ProjetoReadWithEdital)
async def get_projeto(projeto_id: uuid.UUID):
    """
    Get projeto by ID with edital info
    """
    try:
        async for db in get_db():
            stmt = (
                select(Projeto)
                .options(selectinload(Projeto.edital))
                .where(Projeto.id == projeto_id)
            )
            result = await db.execute(stmt)
            projeto = result.scalar_one_or_none()

            if not projeto:
                raise HTTPException(status_code=404, detail="Projeto not found")

            return ProjetoReadWithEdital(
                id=projeto.id,
                nome=projeto.nome,
                descricao=projeto.descricao,
                banca=projeto.banca,
                cargo=projeto.cargo,
                ano=projeto.ano,
                status=projeto.status,
                total_provas=projeto.total_provas,
                total_questoes=projeto.total_questoes,
                total_questoes_validas=projeto.total_questoes_validas,
                total_anuladas=projeto.total_anuladas,
                config=projeto.config,
                created_at=projeto.created_at,
                updated_at=projeto.updated_at,
                edital_id=projeto.edital.id if projeto.edital else None,
                edital_nome=projeto.edital.nome if projeto.edital else None,
                has_taxonomia=bool(
                    projeto.edital
                    and projeto.edital.taxonomia
                    and projeto.edital.taxonomia.get("disciplinas")
                ),
            )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get projeto: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.patch("/{projeto_id}", response_model=ProjetoRead)
async def update_projeto(projeto_id: uuid.UUID, update: ProjetoUpdate):
    """
    Update projeto
    """
    try:
        async for db in get_db():
            stmt = select(Projeto).where(Projeto.id == projeto_id)
            result = await db.execute(stmt)
            projeto = result.scalar_one_or_none()

            if not projeto:
                raise HTTPException(status_code=404, detail="Projeto not found")

            # Update fields
            update_data = update.model_dump(exclude_unset=True)
            for key, value in update_data.items():
                setattr(projeto, key, value)

            await db.commit()
            await db.refresh(projeto)

            logger.info(f"Projeto updated: {projeto.id}")
            return ProjetoRead.model_validate(projeto)

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to update projeto: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{projeto_id}")
async def delete_projeto(projeto_id: uuid.UUID):
    """
    Delete projeto and all associated data
    """
    try:
        async for db in get_db():
            stmt = select(Projeto).where(Projeto.id == projeto_id)
            result = await db.execute(stmt)
            projeto = result.scalar_one_or_none()

            if not projeto:
                raise HTTPException(status_code=404, detail="Projeto not found")

            await db.delete(projeto)
            await db.commit()

            logger.info(f"Projeto deleted: {projeto_id}")
            return {"success": True, "message": "Projeto deleted"}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to delete projeto: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{projeto_id}/vincular-edital/{edital_id}")
async def vincular_edital(projeto_id: uuid.UUID, edital_id: uuid.UUID):
    """
    Link an existing edital to a projeto
    """
    try:
        async for db in get_db():
            # Get projeto
            proj_stmt = select(Projeto).where(Projeto.id == projeto_id)
            proj_result = await db.execute(proj_stmt)
            projeto = proj_result.scalar_one_or_none()

            if not projeto:
                raise HTTPException(status_code=404, detail="Projeto not found")

            # Get edital
            edital_stmt = select(Edital).where(Edital.id == edital_id)
            edital_result = await db.execute(edital_stmt)
            edital = edital_result.scalar_one_or_none()

            if not edital:
                raise HTTPException(status_code=404, detail="Edital not found")

            # Link them
            edital.projeto_id = projeto.id

            # Update projeto with edital info
            projeto.banca = edital.banca
            projeto.ano = edital.ano
            if edital.taxonomia and edital.taxonomia.get("disciplinas"):
                projeto.status = "coletando"
            else:
                projeto.status = "configurando"

            await db.commit()

            logger.info(f"Edital {edital_id} linked to Projeto {projeto_id}")
            return {
                "success": True,
                "message": "Edital vinculado ao projeto",
                "projeto_status": projeto.status,
            }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to link edital: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{projeto_id}/stats", response_model=ProjetoStats)
async def get_projeto_stats(projeto_id: uuid.UUID):
    """
    Get detailed statistics for a projeto
    """
    try:
        async for db in get_db():
            # Get projeto with provas
            stmt = (
                select(Projeto)
                .options(selectinload(Projeto.provas))
                .where(Projeto.id == projeto_id)
            )
            result = await db.execute(stmt)
            projeto = result.scalar_one_or_none()

            if not projeto:
                raise HTTPException(status_code=404, detail="Projeto not found")

            # Calculate stats
            provas_por_ano = {}
            questoes_por_disciplina = {}

            for prova in projeto.provas or []:
                # Count by year
                if prova.ano:
                    provas_por_ano[prova.ano] = provas_por_ano.get(prova.ano, 0) + 1

                # Get questions for this prova
                q_stmt = select(Questao).where(Questao.prova_id == prova.id)
                q_result = await db.execute(q_stmt)
                questoes = q_result.scalars().all()

                for q in questoes:
                    disc = q.disciplina or "Sem disciplina"
                    questoes_por_disciplina[disc] = questoes_por_disciplina.get(disc, 0) + 1

            # Determine if ready for analysis
            pronto_para_analise = (
                projeto.total_questoes_validas >= 10  # At least 10 questions
                and len(provas_por_ano) >= 1  # At least 1 year of data
            )

            return ProjetoStats(
                total_provas=projeto.total_provas,
                total_questoes=projeto.total_questoes,
                total_questoes_validas=projeto.total_questoes_validas,
                total_anuladas=projeto.total_anuladas,
                provas_por_ano=provas_por_ano,
                questoes_por_disciplina=questoes_por_disciplina,
                status=projeto.status,
                pronto_para_analise=pronto_para_analise,
            )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get projeto stats: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{projeto_id}/questoes")
async def get_projeto_questoes(
    projeto_id: uuid.UUID,
    disciplina: Optional[str] = Query(None, description="Filter by disciplina"),
    topico: Optional[str] = Query(None, description="Filter by topic (assunto_pci)"),
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
):
    """
    Get questoes from a projeto with optional filtering by disciplina/topico.
    Returns questoes with their prova info.
    """
    try:
        async for db in get_db():
            # Verify projeto exists and get its provas
            proj_stmt = (
                select(Projeto)
                .options(selectinload(Projeto.provas))
                .where(Projeto.id == projeto_id)
            )
            proj_result = await db.execute(proj_stmt)
            projeto = proj_result.scalar_one_or_none()

            if not projeto:
                raise HTTPException(status_code=404, detail="Projeto not found")

            # Get prova IDs for this projeto
            prova_ids = [p.id for p in (projeto.provas or [])]

            if not prova_ids:
                return {
                    "questoes": [],
                    "total": 0,
                    "disciplinas": [],
                }

            # Build questao query with eager loading of classificacoes
            q_stmt = (
                select(Questao)
                .options(selectinload(Questao.classificacoes))
                .where(Questao.prova_id.in_(prova_ids))
            )

            # Apply filters with flexible matching
            # "Legislação" should match "Legislação Básica Aplicada À..."
            first_word = None
            if disciplina:
                # Use LIKE for partial matching - normalize to first significant word
                disciplina_normalized = _normalize_for_matching(disciplina)
                first_word = disciplina_normalized.split()[0] if disciplina_normalized else ""
                # Match any discipline that starts with the same first word (case-insensitive)
                q_stmt = q_stmt.where(
                    func.lower(Questao.disciplina).like(f"{first_word}%")
                )
            if topico:
                q_stmt = q_stmt.where(Questao.assunto_pci == topico)

            # Count total before pagination
            count_stmt = select(func.count(Questao.id)).where(Questao.prova_id.in_(prova_ids))
            if disciplina and first_word:
                # Use same flexible matching as query
                count_stmt = count_stmt.where(
                    func.lower(Questao.disciplina).like(f"{first_word}%")
                )
            if topico:
                count_stmt = count_stmt.where(Questao.assunto_pci == topico)

            count_result = await db.execute(count_stmt)
            total = count_result.scalar()

            # Get distinct disciplinas ordered by first occurrence in exam
            disc_stmt = (
                select(Questao.disciplina, func.min(Questao.numero).label("first_numero"))
                .where(Questao.prova_id.in_(prova_ids))
                .where(Questao.disciplina.isnot(None))
                .group_by(Questao.disciplina)
                .order_by(func.min(Questao.numero))
            )
            disc_result = await db.execute(disc_stmt)
            disciplinas = [d[0] for d in disc_result.all()]

            # Apply pagination and ordering
            q_stmt = q_stmt.order_by(Questao.numero).limit(limit).offset(offset)

            result = await db.execute(q_stmt)
            questoes = result.scalars().all()

            # Build response with prova info and classification
            questoes_response = []
            for q in questoes:
                # Get prova info
                prova = next((p for p in projeto.provas if p.id == q.prova_id), None)

                # Get primary classification (first one, if any)
                classificacao = None
                if q.classificacoes:
                    # Use the first classification (most recent or primary)
                    c = q.classificacoes[0]
                    classificacao = {
                        "disciplina": c.disciplina,
                        "assunto": c.assunto,
                        "topico": c.topico,
                        "subtopico": c.subtopico,
                        "item_edital_path": c.item_edital_path,
                        "confianca_disciplina": c.confianca_disciplina,
                        "confianca_assunto": c.confianca_assunto,
                        "confianca_topico": c.confianca_topico,
                    }

                questoes_response.append(
                    {
                        "id": str(q.id),
                        "numero": q.numero,
                        "disciplina": q.disciplina,
                        "assunto_pci": q.assunto_pci,
                        "enunciado": q.enunciado,
                        "alternativas": q.alternativas,
                        "gabarito": q.gabarito,
                        "anulada": q.anulada,
                        "motivo_anulacao": q.motivo_anulacao,
                        "confianca_score": q.confianca_score,
                        "status_extracao": q.status_extracao,
                        "prova_nome": prova.nome if prova else None,
                        "prova_ano": prova.ano if prova else None,
                        "classificacao": classificacao,
                    }
                )

            return {
                "questoes": questoes_response,
                "total": total,
                "disciplinas": disciplinas,  # Already ordered by first occurrence in exam
            }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get projeto questoes: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{projeto_id}/taxonomia-incidencia")
async def get_projeto_taxonomia_incidencia(projeto_id: uuid.UUID):
    """
    Get the edital taxonomy tree with incidence counts for each node.
    Returns the hierarchical taxonomy from the edital with question counts at each level.
    """
    try:
        async for db in get_db():
            # Get projeto with edital
            proj_stmt = (
                select(Projeto)
                .options(selectinload(Projeto.edital), selectinload(Projeto.provas))
                .where(Projeto.id == projeto_id)
            )
            proj_result = await db.execute(proj_stmt)
            projeto = proj_result.scalar_one_or_none()

            if not projeto:
                raise HTTPException(status_code=404, detail="Projeto not found")

            if not projeto.edital:
                return {
                    "has_taxonomia": False,
                    "taxonomia": None,
                    "incidencia": [],
                }

            taxonomia = projeto.edital.taxonomia
            if not taxonomia or not taxonomia.get("disciplinas"):
                return {
                    "has_taxonomia": False,
                    "taxonomia": taxonomia,
                    "incidencia": [],
                }

            # Get all questions for this projeto
            prova_ids = [p.id for p in (projeto.provas or [])]

            if not prova_ids:
                # No provas yet, return taxonomy with zero counts
                incidencia = _build_incidencia_tree(taxonomia, {})
                return {
                    "has_taxonomia": True,
                    "taxonomia": taxonomia,
                    "incidencia": incidencia,
                    "total_questoes": 0,
                }

            # Count questions by disciplina
            disc_stmt = (
                select(Questao.disciplina, func.count(Questao.id).label("count"))
                .where(Questao.prova_id.in_(prova_ids))
                .where(Questao.disciplina.isnot(None))
                .group_by(Questao.disciplina)
            )
            disc_result = await db.execute(disc_stmt)
            disciplina_counts = {row[0]: row[1] for row in disc_result.all()}

            # Count questions by assunto_pci (topic)
            topic_stmt = (
                select(Questao.assunto_pci, func.count(Questao.id).label("count"))
                .where(Questao.prova_id.in_(prova_ids))
                .where(Questao.assunto_pci.isnot(None))
                .group_by(Questao.assunto_pci)
            )
            topic_result = await db.execute(topic_stmt)
            topic_counts = {row[0]: row[1] for row in topic_result.all()}

            # Get total questions
            total_stmt = select(func.count(Questao.id)).where(Questao.prova_id.in_(prova_ids))
            total_result = await db.execute(total_stmt)
            total_questoes = total_result.scalar() or 0

            # Build incidencia tree with counts
            incidencia = _build_incidencia_tree(taxonomia, disciplina_counts, topic_counts)

            return {
                "has_taxonomia": True,
                "taxonomia": taxonomia,
                "incidencia": incidencia,
                "total_questoes": total_questoes,
                "disciplina_counts": disciplina_counts,
                "topic_counts": topic_counts,
            }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get projeto taxonomia incidencia: {e}")
        raise HTTPException(status_code=500, detail=str(e))


def _normalize_for_matching(text: str) -> str:
    """Normalize text for case-insensitive matching."""
    import unicodedata

    # Remove accents and convert to lowercase
    normalized = unicodedata.normalize("NFD", text)
    without_accents = "".join(c for c in normalized if unicodedata.category(c) != "Mn")
    return without_accents.lower().strip()


def _find_count_case_insensitive(name: str, counts: dict | None) -> int:
    """Find count using case-insensitive and flexible matching.

    Matches discipline names flexibly:
    - "LEGISLAÇÃO BÁSICA APLICADA À ADMIN..." matches "Legislação"
    - "LÍNGUA PORTUGUESA" matches "Língua Portuguesa"

    Uses first-word prefix matching when exact match fails.
    """
    if counts is None:
        return 0
    # Try exact match first
    if name in counts:
        return counts[name]

    # Try case-insensitive match
    name_normalized = _normalize_for_matching(name)
    for key, value in counts.items():
        if _normalize_for_matching(key) == name_normalized:
            return value

    # Try first-word prefix matching
    # This handles "Legislação" matching "LEGISLAÇÃO BÁSICA APLICADA À..."
    first_word = name_normalized.split()[0] if name_normalized else ""
    if first_word:
        total = 0
        for key, value in counts.items():
            key_normalized = _normalize_for_matching(key)
            key_first = key_normalized.split()[0] if key_normalized else ""
            if key_first == first_word:
                total += value
        if total > 0:
            return total

    return 0


def _build_incidencia_tree(
    taxonomia: dict, disciplina_counts: dict, topic_counts: dict | None = None
) -> list:
    """
    Build an incidencia tree from the taxonomia structure with question counts.

    The taxonomia structure uses recursive ItemConteudo:
    {
        "disciplinas": [
            {
                "nome": "Língua Portuguesa",
                "itens": [
                    {"id": "1", "texto": "Compreensão", "filhos": [...]},
                    ...
                ]
            }
        ]
    }

    Returns a list of incidencia nodes:
    [
        {
            "id": "disciplina-0",
            "nome": "Língua Portuguesa",
            "count": 15,
            "children": [
                {"id": "1", "nome": "Compreensão", "count": 5, "children": [...]},
                ...
            ]
        }
    ]
    """
    if topic_counts is None:
        topic_counts = {}

    incidencia = []

    for idx, disciplina in enumerate(taxonomia.get("disciplinas", [])):
        disc_nome = disciplina.get("nome", "Sem nome")
        disc_count = _find_count_case_insensitive(disc_nome, disciplina_counts)

        # Build children from itens (new format) or assuntos (legacy)
        children = []
        itens = disciplina.get("itens", [])
        if itens:
            children = _build_item_children(itens, topic_counts, disc_nome)
        else:
            # Legacy format with assuntos
            assuntos = disciplina.get("assuntos", [])
            for assunto in assuntos:
                assunto_nome = assunto.get("nome", "")
                assunto_count = _find_count_case_insensitive(assunto_nome, topic_counts)

                topico_children = []
                for topico in assunto.get("topicos", []):
                    topico_nome = topico.get("nome", "")
                    topico_count = _find_count_case_insensitive(topico_nome, topic_counts)

                    subtopico_children = []
                    for subtopico in topico.get("subtopicos", []):
                        subtopico_nome = (
                            subtopico if isinstance(subtopico, str) else subtopico.get("nome", "")
                        )
                        subtopico_count = _find_count_case_insensitive(subtopico_nome, topic_counts)
                        subtopico_children.append(
                            {
                                "id": f"subtopico-{len(subtopico_children)}",
                                "nome": subtopico_nome,
                                "count": subtopico_count,
                                "children": [],
                            }
                        )

                    topico_children.append(
                        {
                            "id": f"topico-{len(topico_children)}",
                            "nome": topico_nome,
                            "count": topico_count,
                            "children": subtopico_children,
                        }
                    )

                children.append(
                    {
                        "id": f"assunto-{len(children)}",
                        "nome": assunto_nome,
                        "count": assunto_count,
                        "children": topico_children,
                    }
                )

        incidencia.append(
            {
                "id": f"disciplina-{idx}",
                "nome": disc_nome,
                "count": disc_count,
                "children": children,
            }
        )

    return incidencia


def _build_item_children(itens: list, topic_counts: dict | None, parent_path: str = "") -> list:
    """
    Recursively build children from ItemConteudo format.
    """
    children = []

    for item in itens:
        item_id = item.get("id") or f"item-{len(children)}"
        item_texto = item.get("texto", "")
        item_count = _find_count_case_insensitive(item_texto, topic_counts)

        # Build full path for matching
        full_path = f"{parent_path} > {item_texto}" if parent_path else item_texto

        # Recursively process children (filhos)
        filhos = item.get("filhos", [])
        item_children = _build_item_children(filhos, topic_counts, full_path) if filhos else []

        children.append(
            {
                "id": item_id,
                "nome": item_texto,
                "count": item_count,
                "children": item_children,
            }
        )

    return children
