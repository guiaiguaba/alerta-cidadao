#!/bin/bash
# deploy-frontend.sh — Executa no servidor após substituir os arquivos

set -e

PROJECT_DIR="/home/deploy/alerta-cidadao"

echo "📂 Entrando no projeto..."
cd "$PROJECT_DIR"

echo "🛑 Parando container web..."
docker compose stop web

echo "🧹 Removendo imagem antiga para forçar rebuild..."
docker compose rm -f web
docker rmi alerta-cidadao-web 2>/dev/null || true

echo "📦 Verificando .env do frontend..."
if [ ! -f frontend/.env.local ]; then
  echo "⚠️  Criando .env.local — EDITE com suas credenciais Firebase!"
  cat > frontend/.env.local << EOF
NEXT_PUBLIC_API_URL=http://191.252.100.195:3001
NEXT_PUBLIC_TENANT_SLUG=demo
NEXT_PUBLIC_FIREBASE_API_KEY=COLOQUE_AQUI
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=COLOQUE_AQUI.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=COLOQUE_AQUI
EOF
fi

echo "🔨 Fazendo rebuild do frontend..."
docker compose build --no-cache web

echo "🚀 Subindo container..."
docker compose up -d web

echo "⏳ Aguardando iniciar..."
sleep 5

echo "📋 Status:"
docker compose ps web

echo "📝 Logs recentes:"
docker compose logs --tail=20 web

echo ""
echo "✅ Deploy concluído!"
echo "   Acesse: http://191.252.100.195:3000"
