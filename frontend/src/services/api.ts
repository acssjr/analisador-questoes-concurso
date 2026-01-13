import type { Dataset, Questao, QuestaoCompleta, DashboardStats, QuestaoSimilar, EditalUploadResponse, ConteudoProgramaticoUploadResponse, Projeto, ProjetoCreate, ProjetoListResponse } from '../types';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';

interface ApiError extends Error {
  status: number;
}

function createApiError(status: number, message: string): ApiError {
  const error = new Error(message) as ApiError;
  error.name = 'ApiError';
  error.status = status;
  return error;
}

async function fetchApi<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
    ...options,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Erro desconhecido' }));
    throw createApiError(response.status, error.detail || error.message || 'Erro na requisição');
  }

  return response.json();
}

export const api = {
  // Datasets
  async getDatasets(): Promise<Dataset[]> {
    return fetchApi('/datasets');
  },

  async getDataset(id: string): Promise<Dataset> {
    return fetchApi(`/datasets/${id}`);
  },

  // Questões
  async getQuestoes(datasetId: string, disciplina?: string): Promise<Questao[]> {
    const params = new URLSearchParams({ dataset_id: datasetId });
    if (disciplina) params.append('disciplina', disciplina);
    return fetchApi(`/questoes?${params}`);
  },

  async getQuestao(id: string): Promise<QuestaoCompleta> {
    return fetchApi(`/questoes/${id}`);
  },

  async getQuestaoAnalise(id: string): Promise<QuestaoCompleta> {
    return fetchApi(`/questoes/${id}/analise`);
  },

  // Dashboard e estatísticas
  async getDashboardStats(datasetId: string, disciplina?: string): Promise<DashboardStats> {
    const params = new URLSearchParams({ dataset_id: datasetId });
    if (disciplina) params.append('disciplina', disciplina);
    return fetchApi(`/dashboard/stats?${params}`);
  },

  // Similaridade
  async getQuestoesSimilares(
    datasetId: string,
    disciplina: string,
    threshold: number = 0.75
  ): Promise<QuestaoSimilar[]> {
    const params = new URLSearchParams({
      dataset_id: datasetId,
      disciplina,
      threshold: threshold.toString(),
    });
    return fetchApi(`/questoes/similares?${params}`);
  },

  // Upload de PDF
  async uploadPdf(file: File): Promise<{ job_id: string; status: string }> {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch(`${API_BASE_URL}/upload/pdf`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      throw createApiError(response.status, 'Erro ao fazer upload do PDF');
    }

    return response.json();
  },

  // Status de job
  async getJobStatus(jobId: string): Promise<{ status: string; progress?: number; error?: string }> {
    return fetchApi(`/jobs/${jobId}`);
  },

  // Edital endpoints
  async listEditais(): Promise<any[]> {
    return fetchApi('/editais/');
  },

  async getEdital(id: string): Promise<any> {
    return fetchApi(`/editais/${id}`);
  },

  async uploadEdital(file: File): Promise<EditalUploadResponse> {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch(`${API_BASE_URL}/editais/upload`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      throw createApiError(response.status, 'Erro ao fazer upload do edital');
    }

    return response.json();
  },

  async uploadConteudoProgramatico(editalId: string, file: File, cargo?: string): Promise<ConteudoProgramaticoUploadResponse> {
    const formData = new FormData();
    formData.append('file', file);

    // Build URL with cargo parameter if provided
    let url = `${API_BASE_URL}/editais/${editalId}/conteudo-programatico`;
    if (cargo) {
      url += `?cargo=${encodeURIComponent(cargo)}`;
    }

    const response = await fetch(url, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      throw createApiError(response.status, 'Erro ao fazer upload do conteúdo programático');
    }

    return response.json();
  },

  async uploadProvasVinculadas(editalId: string, files: File[]): Promise<{
    success: boolean;
    total_files: number;
    successful_files: number;
    failed_files: number;
    total_questoes: number;
    results: Array<{
      success: boolean;
      filename: string;
      format?: string;
      total_questoes?: number;
      questoes?: any[];
      metadados?: any;
      error?: string;
    }>;
  }> {
    const formData = new FormData();
    files.forEach(file => {
      formData.append('files', file);
    });

    const response = await fetch(`${API_BASE_URL}/upload/pdf?edital_id=${editalId}`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      throw createApiError(response.status, 'Erro ao fazer upload das provas');
    }

    return response.json();
  },

  // Projetos
  async listProjetos(status?: string): Promise<ProjetoListResponse> {
    const params = new URLSearchParams();
    if (status) params.append('status', status);
    return fetchApi(`/projetos?${params}`);
  },

  async createProjeto(data: ProjetoCreate): Promise<Projeto> {
    return fetchApi('/projetos', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async getProjeto(id: string): Promise<Projeto> {
    return fetchApi(`/projetos/${id}`);
  },

  async deleteProjeto(id: string): Promise<void> {
    return fetchApi(`/projetos/${id}`, { method: 'DELETE' });
  },

  async vincularEdital(projetoId: string, editalId: string): Promise<{ success: boolean }> {
    return fetchApi(`/projetos/${projetoId}/vincular-edital/${editalId}`, {
      method: 'POST',
    });
  },

  async getProjetoStats(projetoId: string): Promise<{
    total_provas: number;
    total_questoes: number;
    total_questoes_validas: number;
    total_anuladas: number;
    provas_por_ano: Record<number, number>;
    questoes_por_disciplina: Record<string, number>;
    status: string;
    pronto_para_analise: boolean;
  }> {
    return fetchApi(`/projetos/${projetoId}/stats`);
  },
};
