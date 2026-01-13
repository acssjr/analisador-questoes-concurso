# Handoff: PCI Parser Fix + Modal UI Improvements

**Data:** 2026-01-13
**Commits:** 82a4b15, a00e110

---

## O que foi feito

### 1. UI de Projetos (82a4b15)
- Criado `ProjectsList` component em `frontend/src/components/features/ProjectsList.tsx`
- Adicionado tipos `Projeto` em `frontend/src/types/index.ts`
- Adicionado API methods para projetos em `frontend/src/services/api.ts`
- Home page agora mostra projetos existentes
- Ao finalizar workflow, projeto é criado automaticamente no backend

### 2. Parser PCI Corrigido (a00e110)
- **Problema:** Parser esperava formato `15. [Português - Sintaxe]` mas PDFs do PCI Concursos/IDCAP usam `Questão 03\n(Correta: C)`
- **Solução:** Adicionado suporte ao formato IDCAP com auto-detecção
- Parser agora tenta ambos os padrões e usa o que encontrar mais questões
- Testado com PDF real: 60 questões extraídas com sucesso

### 3. Modal UI Melhorias (a00e110)
- Barra de progresso com animação verde
- Seletor de cargo estilizado (cards ou select customizado)
- Scroll do modal corrigido (body lock, content scroll)
- Mouse wheel funcionando
- Taxonomia com estilo melhorado

---

## Arquivos Modificados

```
src/extraction/pci_parser.py     - Dual format support (legacy + IDCAP)
frontend/src/index.css           - Progress bar, cargo selector, taxonomy styles
frontend/src/components/features/EditalWorkflowModal.tsx - UI components
frontend/src/components/ui/Modal.tsx - Scroll handling
frontend/src/components/features/ProjectsList.tsx - NEW
frontend/src/pages/Home.tsx      - Projects list integration
frontend/src/types/index.ts      - Projeto types
frontend/src/services/api.ts     - Projects API methods
```

---

## Pendências

### Alta Prioridade
1. **Detecção de disciplinas melhorada** - Parser detecta disciplina pelos headers mas precisa refinamento
2. **Testar fluxo completo no frontend** - Upload edital -> conteúdo -> provas -> ver questões

### Média Prioridade
3. **API /api/projetos retornava 404** - Router JÁ está registrado em main.py, servidor precisa restart
4. **Step indicator do modal** - Deveria mostrar passo atual mais claramente (já tem código, verificar se está funcionando)

### Baixa Prioridade
5. Melhorar regex de alternativas para formatos variados
6. Adicionar suporte a questões com imagens

---

## Como Testar

```bash
# Backend (reiniciar para pegar mudanças)
.venv\Scripts\python.exe -m uvicorn src.api.main:app --reload --port 8000

# Frontend
cd frontend && npm run dev

# Testar parser diretamente
.venv\Scripts\python.exe analyze_pdf.py "data/raw/provas/PROVA UNEB 2024 TÉCNICO UNIVERSITÁRIO.pdf"
```

---

## Contexto do Problema

O usuário estava fazendo upload de PDFs do PCI Concursos (que são provas da IDCAP com gabarito ao lado) mas o parser retornava 0 questões porque esperava um formato diferente. O formato real é:

```
Questão 03
(Correta: C)
A comunicação e a empatia serão duas habilidades...
```

E não:

```
15. [Português - Sintaxe]
Enunciado da questão...
Resposta: C
```
