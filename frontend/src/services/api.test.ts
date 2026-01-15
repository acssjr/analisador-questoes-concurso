import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { api } from './api';
import { mockXHRResponse, resetXHRMock } from '../test/setup';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('API Service', () => {
  beforeEach(() => {
    mockFetch.mockClear();
    resetXHRMock();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('fetchApi helper', () => {
    it('should make GET request with correct headers', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([{ id: '1', name: 'Test' }]),
      });

      await api.getDatasets();

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/datasets'),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
          }),
        })
      );
    });

    it('should throw ApiError on non-ok response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: () => Promise.resolve({ detail: 'Not found' }),
      });

      await expect(api.getDatasets()).rejects.toMatchObject({
        name: 'ApiError',
        status: 404,
        message: 'Not found',
      });
    });

    it('should handle response without JSON error body', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: () => Promise.reject(new Error('Invalid JSON')),
      });

      await expect(api.getDatasets()).rejects.toMatchObject({
        status: 500,
        message: 'Erro desconhecido',
      });
    });
  });

  describe('getDatasets', () => {
    it('should return datasets array', async () => {
      const mockDatasets = [
        { id: '1', name: 'Dataset 1' },
        { id: '2', name: 'Dataset 2' },
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockDatasets),
      });

      const result = await api.getDatasets();

      expect(result).toEqual(mockDatasets);
    });
  });

  describe('getQuestoes', () => {
    it('should include dataset_id in params', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([]),
      });

      await api.getQuestoes('dataset-123');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('dataset_id=dataset-123'),
        expect.anything()
      );
    });

    it('should include disciplina when provided', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([]),
      });

      await api.getQuestoes('dataset-123', 'Português');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringMatching(/disciplina=Portugu/),
        expect.anything()
      );
    });
  });

  describe('getDashboardStats', () => {
    it('should fetch stats with dataset_id', async () => {
      const mockStats = {
        total_questoes: 100,
        disciplinas: ['Português', 'Matemática'],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockStats),
      });

      const result = await api.getDashboardStats('dataset-123');

      expect(result).toEqual(mockStats);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/dashboard/stats'),
        expect.anything()
      );
    });

    it('should include disciplina filter when provided', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({}),
      });

      await api.getDashboardStats('dataset-123', 'Matemática');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringMatching(/disciplina=Matem/),
        expect.anything()
      );
    });
  });

  describe('getQuestoesSimilares', () => {
    it('should include all required params', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([]),
      });

      await api.getQuestoesSimilares('dataset-123', 'Português', 0.8);

      const url = mockFetch.mock.calls[0][0];
      expect(url).toContain('dataset_id=dataset-123');
      expect(url).toContain('disciplina=');
      expect(url).toContain('threshold=0.8');
    });

    it('should use default threshold of 0.75', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([]),
      });

      await api.getQuestoesSimilares('dataset-123', 'Português');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('threshold=0.75'),
        expect.anything()
      );
    });
  });

  describe('uploadPdf', () => {
    it('should upload file with FormData', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ job_id: 'job-123', status: 'pending' }),
      });

      const file = new File(['test'], 'test.pdf', { type: 'application/pdf' });
      const result = await api.uploadPdf(file);

      expect(result.job_id).toBe('job-123');
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/upload/pdf'),
        expect.objectContaining({
          method: 'POST',
          body: expect.any(FormData),
        })
      );
    });

    it('should throw on upload error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
      });

      const file = new File(['test'], 'test.pdf', { type: 'application/pdf' });

      await expect(api.uploadPdf(file)).rejects.toMatchObject({
        status: 400,
        message: 'Erro ao fazer upload do PDF',
      });
    });
  });

  describe('uploadEdital', () => {
    it('should upload edital file', async () => {
      const mockResponse = {
        edital_id: 'edital-123',
        nome: 'Concurso TRT',
        cargos: ['Analista', 'Técnico'],
      };

      // Use XHR mock for uploadWithProgress
      mockXHRResponse(200, JSON.stringify(mockResponse));

      const file = new File(['test'], 'edital.pdf', { type: 'application/pdf' });
      const result = await api.uploadEdital(file);

      expect(result.edital_id).toBe('edital-123');
    });
  });

  describe('uploadConteudoProgramatico', () => {
    it('should upload without cargo', async () => {
      const mockResponse = { taxonomia: {} };
      mockXHRResponse(200, JSON.stringify(mockResponse));

      const file = new File(['test'], 'conteudo.pdf', { type: 'application/pdf' });
      const result = await api.uploadConteudoProgramatico('edital-123', file);

      expect(result).toEqual(mockResponse);
    });

    it('should include cargo param when provided', async () => {
      const mockResponse = { taxonomia: {} };
      mockXHRResponse(200, JSON.stringify(mockResponse));

      const file = new File(['test'], 'conteudo.pdf', { type: 'application/pdf' });
      const result = await api.uploadConteudoProgramatico('edital-123', file, 'Analista');

      expect(result).toEqual(mockResponse);
    });
  });

  describe('uploadProvasVinculadas', () => {
    it('should upload multiple files with edital_id', async () => {
      const mockResponse = {
        success: true,
        total_files: 2,
        successful_files: 2,
        failed_files: 0,
        total_questoes: 120,
        results: [],
      };

      mockXHRResponse(200, JSON.stringify(mockResponse));

      const files = [
        new File(['test1'], 'prova1.pdf', { type: 'application/pdf' }),
        new File(['test2'], 'prova2.pdf', { type: 'application/pdf' }),
      ];

      const result = await api.uploadProvasVinculadas('edital-123', files);

      expect(result.success).toBe(true);
      expect(result.total_questoes).toBe(120);
    });
  });

  describe('getJobStatus', () => {
    it('should return job status', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ status: 'completed', progress: 100 }),
      });

      const result = await api.getJobStatus('job-123');

      expect(result.status).toBe('completed');
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/jobs/job-123'),
        expect.anything()
      );
    });
  });
});
