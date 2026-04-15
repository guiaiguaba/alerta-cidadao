# 🚀 Guia Completo de Deploy — Alerta Cidadão
## Debian 11 (Bullseye) — Locaweb VPS

---

## 1. Acesso Inicial ao Servidor

```bash
# Conectar via SSH (usar IP fornecido pela Locaweb)
ssh root@SEU_IP_DO_SERVIDOR

# Atualizar sistema
apt update && apt upgrade -y

# Instalar utilitários essenciais
apt install -y curl wget git ufw htop nano unzip net-tools ca-certificates gnupg lsb-release
```

---

## 2. Criar Usuário Não-Root

```bash
# Criar usuário deploy
adduser deploy
# Adicionar ao grupo sudo
usermod -aG sudo deploy

# Copiar chave SSH para novo usuário (se usar chave)
mkdir -p /home/deploy/.ssh
cp ~/.ssh/authorized_keys /home/deploy/.ssh/
chown -R deploy:deploy /home/deploy/.ssh
chmod 700 /home/deploy/.ssh
chmod 600 /home/deploy/.ssh/authorized_keys

# Testar login com o novo usuário em outro terminal antes de fechar este
```

---

## 3. Configurar Firewall (UFW)

```bash
# Ativar UFW
ufw default deny incoming
ufw default allow outgoing

# Liberar SSH (IMPORTANTE: fazer antes de ativar!)
ufw allow OpenSSH

# Liberar HTTP e HTTPS
ufw allow 80/tcp
ufw allow 443/tcp

# Ativar firewall
ufw enable

# Verificar status
ufw status verbose
```

---

## 4. Instalar Docker

```bash
# Adicionar repositório oficial Docker
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/debian/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
chmod a+r /etc/apt/keyrings/docker.gpg

echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
  https://download.docker.com/linux/debian $(lsb_release -cs) stable" | \
  tee /etc/apt/sources.list.d/docker.list > /dev/null

apt update

# Instalar Docker Engine + Compose plugin
apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# Adicionar usuário deploy ao grupo docker (evita usar sudo)
usermod -aG docker deploy

# Verificar instalação
docker --version
docker compose version

# Iniciar Docker na inicialização do sistema
systemctl enable docker
systemctl start docker
```

---

## 5. Configurar DNS (Locaweb / Registrar de Domínio)

No painel DNS do seu domínio, crie os seguintes registros apontando para o IP do servidor:

```
Tipo  Nome                          Valor
A     alertacidadao.com.br          SEU_IP
A     api.alertacidadao.com.br      SEU_IP
A     storage.alertacidadao.com.br  SEU_IP
A     *.alertacidadao.com.br        SEU_IP   ← wildcard para tenants
```

> ⚠️ Aguarde a propagação DNS (pode levar até 24h, mas geralmente < 1h na Locaweb)
> Verifique com: `dig api.alertacidadao.com.br`

---

## 6. Instalar Certbot (SSL Let's Encrypt)

```bash
# Instalar Certbot com plugin Nginx
apt install -y certbot python3-certbot-nginx

# Gerar certificado wildcard (necessário para *.alertacidadao.com.br)
# Requer validação via DNS (adicionar registro TXT no seu DNS)
certbot certonly \
  --manual \
  --preferred-challenges=dns \
  --email seu@email.com \
  --agree-tos \
  -d "alertacidadao.com.br" \
  -d "*.alertacidadao.com.br"

# O Certbot pedirá para você adicionar um registro TXT no DNS:
# _acme-challenge.alertacidadao.com.br  →  <valor gerado>
# Adicione no painel DNS e aguarde propagar antes de pressionar Enter

# Verificar certificados gerados
ls /etc/letsencrypt/live/alertacidadao.com.br/

# Configurar renovação automática
crontab -e
# Adicionar linha:
# 0 3 * * * certbot renew --quiet && docker restart alerta_nginx
```

---

## 7. Clonar Projeto e Configurar Variáveis

```bash
# Fazer login como deploy
su - deploy
cd /home/deploy

# Clonar repositório (ou enviar via SCP/rsync)
git clone https://github.com/seu-usuario/alerta-cidadao.git
cd alerta-cidadao

# Criar arquivo .env a partir do exemplo
cp .env.example .env

# Editar variáveis de ambiente
nano .env
```

**Valores obrigatórios a preencher no `.env`:**

```env
POSTGRES_DB=alertacidadao
POSTGRES_USER=alertauser
POSTGRES_PASSWORD=UmaSenhaForte123!      # Troque por senha segura

REDIS_PASSWORD=OutraSenhaForte456!       # Troque por senha segura

MINIO_ROOT_USER=minioadmin
MINIO_ROOT_PASSWORD=MinioSenha789!       # Troque por senha segura
STORAGE_PUBLIC_URL=https://storage.alertacidadao.com.br

# JSON da service account Firebase (sem quebras de linha)
# Obtenha em: Firebase Console → Configurações → Contas de serviço → Gerar nova chave privada
FIREBASE_SERVICE_ACCOUNT_JSON={"type":"service_account",...}

CORS_ORIGINS=https://iguaba.alertacidadao.com.br,https://admin.alertacidadao.com.br

NEXT_PUBLIC_API_URL=https://api.alertacidadao.com.br
NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSy...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=seu-projeto.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=seu-projeto
```

---

## 8. Configurar MinIO (Criar Bucket)

```bash
# Subir apenas o MinIO inicialmente para criar bucket
docker compose up -d minio

# Aguardar MinIO iniciar
sleep 10

# Instalar cliente MinIO
wget https://dl.min.io/client/mc/release/linux-amd64/mc -O /usr/local/bin/mc
chmod +x /usr/local/bin/mc

# Configurar cliente
mc alias set local http://localhost:9000 $MINIO_ROOT_USER $MINIO_ROOT_PASSWORD

# Criar bucket
mc mb local/alertacidadao

# Tornar bucket público para leitura (imagens públicas)
mc anonymous set download local/alertacidadao

# Verificar
mc ls local/
```

---

## 9. Deploy Completo

```bash
cd /home/deploy/alerta-cidadao

# Build e subir todos os serviços
docker compose up -d --build

# Acompanhar logs
docker compose logs -f

# Verificar status de todos os containers
docker compose ps
```

**Saída esperada:**
```
NAME                STATUS
alerta_api          Up (healthy)
alerta_web          Up
alerta_postgres     Up (healthy)
alerta_redis        Up (healthy)
alerta_minio        Up (healthy)
alerta_nginx        Up
```

---

## 10. Criar Primeiro Tenant

```bash
# Criar tenant de exemplo via API
curl -X POST https://api.alertacidadao.com.br/tenants \
  -H "Content-Type: application/json" \
  -d '{"slug": "iguaba", "name": "Prefeitura de Iguaba Grande", "plan": "pro"}'
```

---

## 11. Comandos Úteis do Dia a Dia

```bash
# Ver logs da API
docker compose logs -f api

# Reiniciar serviço específico
docker compose restart api

# Atualizar após novo deploy
git pull
docker compose up -d --build api web

# Backup do banco
docker exec alerta_postgres pg_dump -U alertauser alertacidadao > backup_$(date +%Y%m%d).sql

# Restaurar banco
cat backup_20241201.sql | docker exec -i alerta_postgres psql -U alertauser alertacidadao

# Acessar banco diretamente
docker exec -it alerta_postgres psql -U alertauser -d alertacidadao

# Limpar espaço (imagens Docker não usadas)
docker system prune -f
```

---

## 12. Monitoramento Básico

```bash
# Instalar Netdata (monitoramento em tempo real)
wget -O /tmp/netdata-kickstart.sh https://get.netdata.cloud/kickstart.sh
sh /tmp/netdata-kickstart.sh --non-interactive

# Acessível em: http://SEU_IP:19999
# Bloquear acesso externo (apenas local):
ufw deny 19999
```

---

## ✅ Checklist Final

- [ ] Docker e Docker Compose instalados
- [ ] Firewall configurado (80, 443, SSH)
- [ ] DNS apontando para o servidor (incluindo wildcard)
- [ ] Certificado SSL gerado com Certbot
- [ ] Arquivo `.env` configurado
- [ ] MinIO com bucket criado
- [ ] Containers todos `Up`
- [ ] Primeiro tenant criado
- [ ] App Flutter configurado com URL da API
- [ ] Backup automático configurado
