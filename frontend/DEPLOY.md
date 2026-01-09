# Deploy - Analisador de Questões Frontend

## Build de Produção

```bash
# Instalar dependências
npm install

# Build
npm run build

# Preview local do build
npm run preview
```

O build gera a pasta `dist/` com todos os assets otimizados.

## Deploy em Vercel

```bash
# Instalar Vercel CLI
npm install -g vercel

# Deploy
vercel

# Deploy de produção
vercel --prod
```

### Configuração Vercel

No arquivo `vercel.json` (criar na raiz do projeto frontend):

```json
{
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "devCommand": "npm run dev",
  "installCommand": "npm install",
  "framework": "vite",
  "env": {
    "VITE_API_URL": "https://sua-api.com/api"
  }
}
```

## Deploy em Netlify

```bash
# Instalar Netlify CLI
npm install -g netlify-cli

# Deploy
netlify deploy

# Deploy de produção
netlify deploy --prod
```

### Configuração Netlify

No arquivo `netlify.toml` (criar na raiz do projeto frontend):

```toml
[build]
  command = "npm run build"
  publish = "dist"

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200

[build.environment]
  VITE_API_URL = "https://sua-api.com/api"
```

## Variáveis de Ambiente

Criar arquivo `.env.production`:

```env
VITE_API_URL=https://sua-api-backend.com/api
```

## Otimizações de Performance

### Code Splitting

Para reduzir o bundle size inicial, adicionar em `vite.config.ts`:

```typescript
export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor': ['react', 'react-dom'],
          'charts': ['recharts'],
          'utils': ['lodash', 'date-fns'],
        },
      },
    },
  },
});
```

### Compressão

Habilitar compressão gzip/brotli no servidor:

**Vercel/Netlify**: Automático

**Nginx**:
```nginx
gzip on;
gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;
```

## CORS

Se o backend estiver em domínio diferente, configurar CORS no backend FastAPI:

```python
from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://seu-frontend.vercel.app"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

## Monitoramento

Opções recomendadas:
- **Sentry**: Error tracking
- **Google Analytics**: Métricas de uso
- **Vercel Analytics**: Web vitals

## Checklist de Deploy

- [ ] Build de produção funcionando sem erros
- [ ] Variáveis de ambiente configuradas
- [ ] CORS configurado no backend
- [ ] SSL/HTTPS habilitado
- [ ] Compressão habilitada
- [ ] Cache headers configurados
- [ ] 404 redirects para index.html (SPA)
- [ ] Testes manuais no ambiente de staging
- [ ] Monitoramento de erros ativado

## URLs de Exemplo

- **Frontend (Vercel)**: https://analisador-questoes.vercel.app
- **Backend (Railway/Render)**: https://analisador-questoes-api.railway.app
- **Documentação API**: https://analisador-questoes-api.railway.app/docs
