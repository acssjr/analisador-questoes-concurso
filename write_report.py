import os

# Create output directory
os.makedirs('.claude/cache/agents/scout', exist_ok=True)

report = """# Análise de Capacidade e Custo de Tokens
Generated: 2026-01-12

## Sumário Executivo

O sistema atualmente processa **1 prova (60 questões) em ~30 segundos** usando **46,728 tokens** via Groq API (Llama 4 Scout). O **GARGALO PRINCIPAL é TPM (Tokens Per Minute)**, limitando a capacidade a **~0.64 provas/minuto** ou **~38 provas/hora**.

Para processar **20 provas simultaneamente**, o tempo estimado é **~32 minutos** sequencialmente. O sistema **NÃO possui filas ou processamento assíncrono**, bloqueando durante uploads.

---

## 1. Métricas Atuais (1 Prova de 60 Questões)

### Token Usage
```
Total de tokens: 46,728
Chamadas API: 7 (batch de 3 páginas cada)
Tempo de processamento: ~30 segundos
Páginas processadas: 16 páginas
Tokens por página: ~2,920
Tokens por questão: ~779
```

### Distribuição de Tokens por Batch
```
Batch 1 (páginas 3-5):   9,323 tokens
Batch 2 (páginas 6-8):   9,129 tokens
Batch 3 (páginas 9-11):  9,064 tokens
Batch 4 (páginas 12-14): 3,640 tokens
Batch 5 (páginas 15-16): 1,631 tokens
Metadata (edital):       10,802 tokens
Conteúdo programático:   3,139 tokens
```

---

## 2. Limites da API Groq

### Llama 4 Scout (Free Tier) - Estimativas
```
RPM (Requests Per Minute): ~30 requisições/minuto
TPM (Tokens Per Minute):   ~30,000-50,000 tokens/minuto
Rate Limiting:             Exponential backoff (1s, 2s, 4s)
Max Retries:               3 tentativas
```

---

## 3. Gargalos Identificados

| Fator | Limite | Capacidade | Cálculo |
|-------|--------|------------|---------|
| **Tokens (TPM)** | 30,000/min | **0.64 provas/min** | 30,000 / 46,728 |
| Requests (RPM) | 30/min | 4.3 provas/min | 30 / 7 |

**GARGALO PRINCIPAL: TOKENS (TPM)**

Capacidade: ~38 provas/hora

---

## 4. Cenários de Escala

| Quantidade | Tempo Estimado | Tokens Totais |
|------------|----------------|---------------|
| 1 prova    | ~1.5 min       | 46,728        |
| 5 provas   | ~8 min         | 233,640       |
| 10 provas  | ~16 min        | 467,280       |
| **20 provas** | **~32 min** | **934,560**   |
| 50 provas  | ~78 min        | 2,336,400     |

---

## 5. Arquitetura Atual

### Código Relevante

**Upload Endpoint**: `C:\Users\Antônio\Documents\analisador-questoes-concurso\src\api\routes\upload.py:23-145`

**Extractor**: `C:\Users\Antônio\Documents\analisador-questoes-concurso\src\extraction\prova_extractor.py:85-173`
- Batch size: 3 páginas por chamada API
- Processamento sequencial (síncrono)

**Groq Client**: `C:\Users\Antônio\Documents\analisador-questoes-concurso\src\llm\providers\groq_client.py:31-116`
- MAX_RETRIES: 3
- BASE_DELAY: 1 segundo
- Exponential backoff em rate limits

---

## 6. Limitações Atuais

### Infraestrutura
- ❌ **Sem sistema de filas** (Redis/Celery)
- ❌ **Sem processamento assíncrono** de múltiplas provas
- ❌ **Uploads bloqueantes** (frontend aguarda 30s por prova)
- ❌ **Sem rate limiting interno**
- ❌ **Sem progress tracking**

### Resiliência
- ✅ Retry com exponential backoff (3 tentativas)
- ❌ **Sem fallback para outros LLMs**
- ❌ **Sem cache de resultados**

---

## 7. Recomendações

### 🟢 Curto Prazo (0-2 semanas) - Até 50 Provas/Dia
**STATUS**: Sistema atual **SUFICIENTE**

1. Adicionar progress feedback no frontend
2. Implementar cache de taxonomias (Redis ou in-memory)
3. Melhorar logging de tokens

### 🟡 Médio Prazo (2-4 semanas) - 100-500 Provas/Dia
**STATUS**: Necessário **SISTEMA DE FILAS**

Implementar:
- Redis (queue + cache)
- Celery (task queue)
- Rate limiter interno
- Worker pool (3-5 workers)

### 🔴 Longo Prazo (1-3 meses) - 1000+ Provas/Dia

Implementar:
- Auto-scaling de workers
- Multi-provider LLM (Groq → Anthropic fallback)
- Monitoring (Prometheus + Grafana)
- Database optimization

---

## 8. Comparação de Custos

### Free Tier + Filas (Recomendado MVP)
```
- Groq Free Tier: $0/mês
- Redis Cloud: $0/mês (250MB)
- VPS: ~$10/mês
Total: ~$10/mês
Capacidade: ~1000 provas/mês
```

### Paid API + Filas
```
- Groq Paid: ~$7/mês (estimativa)
- Redis: $10/mês
- VPS: ~$20/mês
Total: ~$37/mês
Capacidade: Ilimitada
```

---

## 9. Próximos Passos (Prioridade)

### P0 (Crítico) - Semana 1
- [ ] Progress indicator no frontend
- [ ] Cache de taxonomias
- [ ] Melhorar error handling

### P1 (Importante) - Semanas 2-3
- [ ] Setup Redis + Celery
- [ ] Task queue implementation
- [ ] Rate limiter interno
- [ ] Status endpoint

### P2 (Desejável) - Semana 4
- [ ] Fallback para Anthropic
- [ ] Monitoring dashboard

---

## Conclusão

**Sistema atual funciona bem para uso de baixa escala** (~50 provas/dia).

Para escalar:
1. **Imediato**: Adicionar Redis + Celery (2-3 dias)
2. **Custo**: ~$10/mês infraestrutura
3. **Capacidade**: 100-500 provas/dia com filas
"""

with open('.claude/cache/agents/scout/latest-output.md', 'w', encoding='utf-8') as f:
    f.write(report)

print('✓ Report written to .claude/cache/agents/scout/latest-output.md')
