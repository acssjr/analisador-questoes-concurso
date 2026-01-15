"""
Analise routes - Deep analysis API endpoints
"""

import asyncio
import uuid
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, BackgroundTasks, HTTPException, Query
from loguru import logger
from sqlalchemy import func, select
from sqlalchemy.orm import selectinload

from src.core.database import AsyncSessionLocal, get_db
from src.models.analise_job import AnaliseJob
from src.models.projeto import Projeto
from src.models.prova import Prova
from src.models.questao import Questao
from src.schemas.analise import (
    AnaliseIniciarRequest,
    AnaliseIniciarResponse,
    AnaliseJobListResponse,
    AnaliseResultadoDisciplinaResponse,
    AnaliseResultadoResponse,
    AnaliseResumoResponse,
    AnaliseStatusResponse,
    AnalysisReportSchema,
    ClusterResultSchema,
    PatternFindingSchema,
    VerificationResultSchema,
    VerifiedReportSchema,
)

router = APIRouter()


# =============================================================================
# Constants
# =============================================================================

MIN_QUESTOES_PARA_ANALISE = 5  # Minimum questions required to start analysis


# =============================================================================
# Background Task: Run Analysis Pipeline
# =============================================================================


async def run_analysis_pipeline(job_id: uuid.UUID):
    """
    Background task to run the 4-phase analysis pipeline.

    This function runs asynchronously after the API returns.
    """
    from src.analysis.pipeline import AnalysisPipeline, PipelineResult

    logger.info(f"Starting background analysis for job {job_id}")

    async with AsyncSessionLocal() as db:
        try:
            # Load job
            stmt = select(AnaliseJob).where(AnaliseJob.id == job_id)
            result = await db.execute(stmt)
            job = result.scalar_one_or_none()

            if not job:
                logger.error(f"Job {job_id} not found")
                return

            # Update status to running
            job.status = "running"
            job.started_at = datetime.now()
            job.current_phase = 1
            await db.commit()

            # Load project and questions
            proj_stmt = (
                select(Projeto)
                .options(selectinload(Projeto.provas))
                .where(Projeto.id == job.projeto_id)
            )
            proj_result = await db.execute(proj_stmt)
            projeto = proj_result.scalar_one_or_none()

            if not projeto:
                job.status = "failed"
                job.error_message = "Projeto not found"
                await db.commit()
                return

            # Get questions for this discipline
            prova_ids = [p.id for p in (projeto.provas or [])]
            if not prova_ids:
                job.status = "failed"
                job.error_message = "No provas found in project"
                await db.commit()
                return

            q_stmt = select(Questao).where(Questao.prova_id.in_(prova_ids))
            if job.disciplina != "all":
                q_stmt = q_stmt.where(Questao.disciplina == job.disciplina)

            q_result = await db.execute(q_stmt)
            questoes_db = q_result.scalars().all()

            # Convert to dict format for pipeline
            questoes = []
            anos_set = set()
            for q in questoes_db:
                questoes.append(
                    {
                        "id": str(q.id),
                        "numero": q.numero,
                        "disciplina": q.disciplina,
                        "enunciado": q.enunciado,
                        "alternativas": q.alternativas,
                        "gabarito": q.gabarito,
                        "anulada": q.anulada,
                        "assunto_pci": q.assunto_pci,
                    }
                )
                # Get year from prova
                prova = next((p for p in projeto.provas if p.id == q.prova_id), None)
                if prova and prova.ano:
                    anos_set.add(prova.ano)

            if len(questoes) < MIN_QUESTOES_PARA_ANALISE:
                job.status = "failed"
                job.error_message = (
                    f"Not enough questions ({len(questoes)}). Minimum: {MIN_QUESTOES_PARA_ANALISE}"
                )
                await db.commit()
                return

            # Update job with input info
            job.total_questoes = len(questoes)
            job.banca = projeto.banca
            job.anos = sorted(list(anos_set))
            await db.commit()

            # Run pipeline (in thread pool to not block async loop)
            pipeline = AnalysisPipeline()

            # Run synchronously in executor
            loop = asyncio.get_event_loop()
            pipeline_result: PipelineResult = await loop.run_in_executor(
                None,
                lambda: pipeline.run(
                    questoes=questoes,
                    disciplina=job.disciplina,
                    banca=projeto.banca or "Desconhecida",
                    anos=job.anos or [],
                    skip_phases=None,  # Could be passed from job config
                ),
            )

            # Update phase tracking during execution (simulated for now)
            # In a real implementation, you'd update this as each phase completes

            # Store results
            job.phases_completed = pipeline_result.phases_completed

            # Phase 1 results
            if pipeline_result.cluster_result:
                job.cluster_result = {
                    "n_clusters": pipeline_result.cluster_result.n_clusters,
                    "cluster_sizes": pipeline_result.cluster_result.cluster_sizes,
                    "silhouette_score": pipeline_result.cluster_result.silhouette_score,
                }
            job.similar_pairs = [
                {"q1": p[0], "q2": p[1], "score": p[2]} for p in pipeline_result.similar_pairs
            ]

            # Phase 2 results
            if pipeline_result.chunk_digests:
                job.chunk_digests = [
                    {
                        "chunk_id": d.chunk_id,
                        "summary": d.summary,
                        "patterns_found": d.patterns_found,
                        "questions_count": len(d.questions_analysis),
                    }
                    for d in pipeline_result.chunk_digests
                ]

            # Phase 3 results
            if pipeline_result.analysis_report:
                report = pipeline_result.analysis_report
                job.analysis_report = {
                    "disciplina": report.disciplina,
                    "total_questoes": report.total_questoes,
                    "temporal_patterns": [
                        {
                            "pattern_type": p.pattern_type,
                            "description": p.description,
                            "evidence_ids": p.evidence_ids,
                            "confidence": p.confidence,
                            "votes": p.votes,
                        }
                        for p in report.temporal_patterns
                    ],
                    "similarity_patterns": [
                        {
                            "pattern_type": p.pattern_type,
                            "description": p.description,
                            "evidence_ids": p.evidence_ids,
                            "confidence": p.confidence,
                            "votes": p.votes,
                        }
                        for p in report.similarity_patterns
                    ],
                    "difficulty_analysis": report.difficulty_analysis,
                    "trap_analysis": report.trap_analysis,
                    "study_recommendations": report.study_recommendations,
                    "raw_text": report.raw_text,
                }

            # Phase 4 results
            if pipeline_result.verified_report:
                vr = pipeline_result.verified_report
                job.verified_report = {
                    "original_claims": vr.original_claims,
                    "verified_claims": vr.verified_claims,
                    "rejected_claims": vr.rejected_claims,
                    "verification_results": [
                        {
                            "claim": r.claim,
                            "verification_question": r.verification_question,
                            "evidence_ids": r.evidence_ids,
                            "evidence_summary": r.evidence_summary,
                            "is_verified": r.is_verified,
                            "confidence": r.confidence,
                            "notes": r.notes,
                        }
                        for r in vr.verification_results
                    ],
                    "cleaned_report": vr.cleaned_report,
                }

            # Store errors
            job.errors = pipeline_result.errors

            # Update status
            if pipeline_result.errors:
                # Partial success if some phases completed
                if pipeline_result.phases_completed:
                    job.status = "completed"  # Completed with errors
                else:
                    job.status = "failed"
                    job.error_message = "; ".join(pipeline_result.errors[:3])
            else:
                job.status = "completed"

            job.completed_at = datetime.now()
            job.current_phase = None
            await db.commit()

            logger.info(f"Analysis job {job_id} completed with status: {job.status}")

        except Exception as e:
            logger.error(f"Analysis job {job_id} failed: {e}")
            # Update job status
            try:
                stmt = select(AnaliseJob).where(AnaliseJob.id == job_id)
                result = await db.execute(stmt)
                job = result.scalar_one_or_none()
                if job:
                    job.status = "failed"
                    job.error_message = str(e)[:500]
                    job.completed_at = datetime.now()
                    await db.commit()
            except Exception as db_error:
                logger.error(f"Failed to update job status: {db_error}")


# =============================================================================
# API Endpoints
# =============================================================================


@router.post("/{projeto_id}/iniciar", response_model=AnaliseIniciarResponse)
async def iniciar_analise(
    projeto_id: uuid.UUID,
    request: AnaliseIniciarRequest,
    background_tasks: BackgroundTasks,
):
    """
    Start a deep analysis job for a project.

    The analysis runs asynchronously in the background.
    Returns a job_id that can be used to track progress.
    """
    try:
        async for db in get_db():
            # Verify project exists
            proj_stmt = (
                select(Projeto)
                .options(selectinload(Projeto.provas))
                .where(Projeto.id == projeto_id)
            )
            proj_result = await db.execute(proj_stmt)
            projeto = proj_result.scalar_one_or_none()

            if not projeto:
                raise HTTPException(status_code=404, detail="Projeto not found")

            # Determine discipline to analyze
            disciplina = request.disciplina or "all"

            # Get question count for validation
            prova_ids = [p.id for p in (projeto.provas or [])]
            if not prova_ids:
                raise HTTPException(
                    status_code=400, detail="Project has no provas. Upload provas first."
                )

            count_stmt = select(func.count(Questao.id)).where(Questao.prova_id.in_(prova_ids))
            if disciplina != "all":
                count_stmt = count_stmt.where(Questao.disciplina == disciplina)

            count_result = await db.execute(count_stmt)
            questao_count = count_result.scalar() or 0

            if questao_count < MIN_QUESTOES_PARA_ANALISE:
                raise HTTPException(
                    status_code=400,
                    detail=f"Not enough questions ({questao_count}) for analysis. "
                    f"Minimum required: {MIN_QUESTOES_PARA_ANALISE}",
                )

            # Check if there's already a running job for this project/discipline
            existing_stmt = (
                select(AnaliseJob)
                .where(AnaliseJob.projeto_id == projeto_id)
                .where(AnaliseJob.disciplina == disciplina)
                .where(AnaliseJob.status == "running")
            )
            existing_result = await db.execute(existing_stmt)
            existing_job = existing_result.scalar_one_or_none()

            if existing_job:
                raise HTTPException(
                    status_code=409,
                    detail=f"Analysis already running for this discipline. Job ID: {existing_job.id}",
                )

            # Create analysis job
            job = AnaliseJob(
                projeto_id=projeto_id,
                disciplina=disciplina,
                status="pending",
                total_questoes=questao_count,
            )
            db.add(job)
            await db.commit()
            await db.refresh(job)

            logger.info(
                f"Created analysis job {job.id} for projeto {projeto_id}, disciplina: {disciplina}"
            )

            # Start background task
            background_tasks.add_task(run_analysis_pipeline, job.id)

            return AnaliseIniciarResponse(
                job_id=job.id,
                projeto_id=projeto_id,
                disciplina=disciplina,
                status="pending",
                message=f"Analysis started for {questao_count} questions. "
                f"Use GET /api/analise/{projeto_id}/status to track progress.",
            )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to start analysis: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{projeto_id}/status", response_model=AnaliseStatusResponse)
async def get_analise_status(
    projeto_id: uuid.UUID,
    disciplina: Optional[str] = Query(None, description="Filter by discipline"),
):
    """
    Get the status of analysis for a project.

    Returns the most recent analysis job for the specified discipline,
    or the most recent job overall if no discipline is specified.
    """
    try:
        async for db in get_db():
            # Verify project exists
            proj_stmt = select(Projeto).where(Projeto.id == projeto_id)
            proj_result = await db.execute(proj_stmt)
            projeto = proj_result.scalar_one_or_none()

            if not projeto:
                raise HTTPException(status_code=404, detail="Projeto not found")

            # Find the most recent job
            job_stmt = select(AnaliseJob).where(AnaliseJob.projeto_id == projeto_id)

            if disciplina:
                job_stmt = job_stmt.where(AnaliseJob.disciplina == disciplina)

            job_stmt = job_stmt.order_by(AnaliseJob.created_at.desc()).limit(1)

            job_result = await db.execute(job_stmt)
            job = job_result.scalar_one_or_none()

            if not job:
                raise HTTPException(
                    status_code=404, detail="No analysis job found for this project"
                )

            return AnaliseStatusResponse(
                job_id=job.id,
                projeto_id=job.projeto_id,
                disciplina=job.disciplina,
                status=job.status,
                current_phase=job.current_phase,
                phase_progress=job.phase_progress,
                phases_completed=job.phases_completed or [],
                total_questoes=job.total_questoes,
                started_at=job.started_at,
                completed_at=job.completed_at,
                duration_seconds=job.duration_seconds,
                error_message=job.error_message,
            )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get analysis status: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{projeto_id}/resultado", response_model=AnaliseResultadoResponse)
async def get_analise_resultado(projeto_id: uuid.UUID):
    """
    Get complete analysis results for a project.

    Returns results from all completed analysis jobs for the project,
    organized by discipline.
    """
    try:
        async for db in get_db():
            # Verify project exists
            proj_stmt = select(Projeto).where(Projeto.id == projeto_id)
            proj_result = await db.execute(proj_stmt)
            projeto = proj_result.scalar_one_or_none()

            if not projeto:
                raise HTTPException(status_code=404, detail="Projeto not found")

            # Get all jobs for this project
            jobs_stmt = (
                select(AnaliseJob)
                .where(AnaliseJob.projeto_id == projeto_id)
                .order_by(AnaliseJob.disciplina, AnaliseJob.created_at.desc())
            )
            jobs_result = await db.execute(jobs_stmt)
            all_jobs = jobs_result.scalars().all()

            if not all_jobs:
                raise HTTPException(
                    status_code=404, detail="No analysis results found for this project"
                )

            # Get the most recent job per discipline
            jobs_by_disciplina: dict[str, AnaliseJob] = {}
            for job in all_jobs:
                if job.disciplina not in jobs_by_disciplina:
                    jobs_by_disciplina[job.disciplina] = job

            # Build response
            results = {}
            completed_count = 0
            disciplinas = []

            for disc, job in jobs_by_disciplina.items():
                disciplinas.append(disc)
                if job.status == "completed":
                    completed_count += 1

                # Build discipline result
                result = _build_disciplina_result(job)
                results[disc] = result

            return AnaliseResultadoResponse(
                projeto_id=projeto_id,
                disciplinas=sorted(disciplinas),
                total_jobs=len(jobs_by_disciplina),
                completed_jobs=completed_count,
                results=results,
            )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get analysis results: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get(
    "/{projeto_id}/resultado/{disciplina}", response_model=AnaliseResultadoDisciplinaResponse
)
async def get_analise_resultado_disciplina(
    projeto_id: uuid.UUID,
    disciplina: str,
):
    """
    Get analysis results for a specific discipline.

    Returns the most recent completed analysis for the specified discipline.
    """
    try:
        async for db in get_db():
            # Verify project exists
            proj_stmt = select(Projeto).where(Projeto.id == projeto_id)
            proj_result = await db.execute(proj_stmt)
            projeto = proj_result.scalar_one_or_none()

            if not projeto:
                raise HTTPException(status_code=404, detail="Projeto not found")

            # Find the most recent job for this discipline
            job_stmt = (
                select(AnaliseJob)
                .where(AnaliseJob.projeto_id == projeto_id)
                .where(AnaliseJob.disciplina == disciplina)
                .order_by(AnaliseJob.created_at.desc())
                .limit(1)
            )
            job_result = await db.execute(job_stmt)
            job = job_result.scalar_one_or_none()

            if not job:
                raise HTTPException(
                    status_code=404, detail=f"No analysis found for discipline: {disciplina}"
                )

            return _build_disciplina_result(job)

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get discipline analysis: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{projeto_id}/jobs", response_model=AnaliseJobListResponse)
async def list_analise_jobs(
    projeto_id: uuid.UUID,
    status: Optional[str] = Query(None, description="Filter by status"),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
):
    """
    List all analysis jobs for a project.

    Useful for viewing history of analysis runs.
    """
    try:
        async for db in get_db():
            # Verify project exists
            proj_stmt = select(Projeto).where(Projeto.id == projeto_id)
            proj_result = await db.execute(proj_stmt)
            projeto = proj_result.scalar_one_or_none()

            if not projeto:
                raise HTTPException(status_code=404, detail="Projeto not found")

            # Build query
            jobs_stmt = select(AnaliseJob).where(AnaliseJob.projeto_id == projeto_id)

            if status:
                jobs_stmt = jobs_stmt.where(AnaliseJob.status == status)

            jobs_stmt = jobs_stmt.order_by(AnaliseJob.created_at.desc())

            # Count total
            count_stmt = select(func.count(AnaliseJob.id)).where(
                AnaliseJob.projeto_id == projeto_id
            )
            if status:
                count_stmt = count_stmt.where(AnaliseJob.status == status)
            count_result = await db.execute(count_stmt)
            total = count_result.scalar() or 0

            # Apply pagination
            jobs_stmt = jobs_stmt.limit(limit).offset(offset)
            jobs_result = await db.execute(jobs_stmt)
            jobs = jobs_result.scalars().all()

            # Build response
            job_responses = [
                AnaliseStatusResponse(
                    job_id=job.id,
                    projeto_id=job.projeto_id,
                    disciplina=job.disciplina,
                    status=job.status,
                    current_phase=job.current_phase,
                    phase_progress=job.phase_progress,
                    phases_completed=job.phases_completed or [],
                    total_questoes=job.total_questoes,
                    started_at=job.started_at,
                    completed_at=job.completed_at,
                    duration_seconds=job.duration_seconds,
                    error_message=job.error_message,
                )
                for job in jobs
            ]

            return AnaliseJobListResponse(jobs=job_responses, total=total)

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to list analysis jobs: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{projeto_id}/resumo", response_model=AnaliseResumoResponse)
async def get_analise_resumo(projeto_id: uuid.UUID):
    """
    Get a summary of analysis status for a project.

    Useful for dashboard display.
    """
    try:
        async for db in get_db():
            # Verify project exists
            proj_stmt = select(Projeto).where(Projeto.id == projeto_id)
            proj_result = await db.execute(proj_stmt)
            projeto = proj_result.scalar_one_or_none()

            if not projeto:
                raise HTTPException(status_code=404, detail="Projeto not found")

            # Get distinct disciplines from questions
            prova_ids_stmt = select(Prova.id).where(Prova.projeto_id == projeto_id)
            prova_result = await db.execute(prova_ids_stmt)
            prova_ids = [p[0] for p in prova_result.all()]

            disciplinas_total = 0
            if prova_ids:
                disc_stmt = (
                    select(func.count(func.distinct(Questao.disciplina)))
                    .where(Questao.prova_id.in_(prova_ids))
                    .where(Questao.disciplina.isnot(None))
                )
                disc_result = await db.execute(disc_stmt)
                disciplinas_total = disc_result.scalar() or 0

            # Get completed jobs
            jobs_stmt = (
                select(AnaliseJob)
                .where(AnaliseJob.projeto_id == projeto_id)
                .where(AnaliseJob.status == "completed")
            )
            jobs_result = await db.execute(jobs_stmt)
            completed_jobs = jobs_result.scalars().all()

            # Aggregate stats
            disciplinas_analisadas = len(set(j.disciplina for j in completed_jobs))
            questoes_analisadas = sum(j.total_questoes for j in completed_jobs)
            padroes_encontrados = 0
            recomendacoes = 0

            for job in completed_jobs:
                if job.analysis_report:
                    temporal = job.analysis_report.get("temporal_patterns", [])
                    similarity = job.analysis_report.get("similarity_patterns", [])
                    padroes_encontrados += len(temporal) + len(similarity)
                    recomendacoes += len(job.analysis_report.get("study_recommendations", []))

            # Determine overall status
            running_stmt = (
                select(func.count(AnaliseJob.id))
                .where(AnaliseJob.projeto_id == projeto_id)
                .where(AnaliseJob.status == "running")
            )
            running_result = await db.execute(running_stmt)
            running_count = running_result.scalar() or 0

            if running_count > 0:
                overall_status = "running"
            elif disciplinas_analisadas == 0:
                overall_status = "pending"
            elif disciplinas_analisadas < disciplinas_total:
                overall_status = "partial"
            else:
                overall_status = "completed"

            # Get last updated time
            last_job_stmt = (
                select(AnaliseJob.updated_at)
                .where(AnaliseJob.projeto_id == projeto_id)
                .order_by(AnaliseJob.updated_at.desc())
                .limit(1)
            )
            last_job_result = await db.execute(last_job_stmt)
            last_updated = last_job_result.scalar()

            return AnaliseResumoResponse(
                projeto_id=projeto_id,
                status=overall_status,
                disciplinas_analisadas=disciplinas_analisadas,
                disciplinas_total=disciplinas_total,
                questoes_analisadas=questoes_analisadas,
                padroes_encontrados=padroes_encontrados,
                recomendacoes=recomendacoes,
                last_updated=last_updated,
            )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get analysis summary: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{projeto_id}/jobs/{job_id}")
async def cancel_analise_job(projeto_id: uuid.UUID, job_id: uuid.UUID):
    """
    Cancel a running analysis job.

    Only jobs with status 'pending' or 'running' can be cancelled.
    """
    try:
        async for db in get_db():
            # Find the job
            job_stmt = (
                select(AnaliseJob)
                .where(AnaliseJob.id == job_id)
                .where(AnaliseJob.projeto_id == projeto_id)
            )
            job_result = await db.execute(job_stmt)
            job = job_result.scalar_one_or_none()

            if not job:
                raise HTTPException(status_code=404, detail="Job not found")

            if job.status not in ["pending", "running"]:
                raise HTTPException(
                    status_code=400, detail=f"Cannot cancel job with status: {job.status}"
                )

            # Cancel the job
            job.status = "cancelled"
            job.completed_at = datetime.now()
            await db.commit()

            logger.info(f"Cancelled analysis job {job_id}")

            return {"success": True, "message": "Job cancelled"}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to cancel job: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# =============================================================================
# Helper Functions
# =============================================================================


def _build_disciplina_result(job: AnaliseJob) -> AnaliseResultadoDisciplinaResponse:
    """Build the discipline result response from a job"""

    # Parse cluster result
    cluster_result = None
    if job.cluster_result:
        cluster_result = ClusterResultSchema(
            n_clusters=job.cluster_result.get("n_clusters", 0),
            cluster_sizes=job.cluster_result.get("cluster_sizes", {}),
            silhouette_score=job.cluster_result.get("silhouette_score"),
        )

    # Parse analysis report
    analysis_report = None
    if job.analysis_report:
        ar = job.analysis_report
        analysis_report = AnalysisReportSchema(
            disciplina=ar.get("disciplina", job.disciplina),
            total_questoes=ar.get("total_questoes", job.total_questoes),
            temporal_patterns=[PatternFindingSchema(**p) for p in ar.get("temporal_patterns", [])],
            similarity_patterns=[
                PatternFindingSchema(**p) for p in ar.get("similarity_patterns", [])
            ],
            difficulty_analysis=ar.get("difficulty_analysis", {}),
            trap_analysis=ar.get("trap_analysis", {}),
            study_recommendations=ar.get("study_recommendations", []),
            raw_text=ar.get("raw_text"),
        )

    # Parse verified report
    verified_report = None
    if job.verified_report:
        vr = job.verified_report
        verified_report = VerifiedReportSchema(
            original_claims=vr.get("original_claims", 0),
            verified_claims=vr.get("verified_claims", 0),
            rejected_claims=vr.get("rejected_claims", 0),
            verification_results=[
                VerificationResultSchema(**r) for r in vr.get("verification_results", [])
            ],
            cleaned_report=vr.get("cleaned_report"),
        )

    return AnaliseResultadoDisciplinaResponse(
        job_id=job.id,
        disciplina=job.disciplina,
        status=job.status,
        total_questoes=job.total_questoes,
        banca=job.banca,
        anos=job.anos or [],
        cluster_result=cluster_result,
        similar_pairs_count=len(job.similar_pairs or []),
        chunk_digests_count=len(job.chunk_digests or []),
        analysis_report=analysis_report,
        verified_report=verified_report,
        phases_completed=job.phases_completed or [],
        errors=job.errors or [],
        started_at=job.started_at,
        completed_at=job.completed_at,
        duration_seconds=job.duration_seconds,
    )
