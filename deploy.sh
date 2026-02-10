#!/bin/bash
# Deploy script: Local → Server
# Sincronizza la versione locale sul server di produzione

echo "🚀 Deploying to drape-dev.it..."

# Sincronizza tutti i file
rsync -avz --delete \
  --exclude='.git' \
  --exclude='node_modules' \
  --exclude='.DS_Store' \
  --exclude='*.bak' \
  --exclude='deploy.sh' \
  --exclude='sync-from-server.sh' \
  -e "ssh -i ~/.ssh/id_ed25519_drape" \
  /Users/leon/Desktop/drape-dev.it/ \
  root@77.42.1.116:/var/www/drape-dev.it/

echo "✅ Deploy completato!"
echo ""
echo "📝 Prossimi passi:"
echo "1. Svuota cache Cloudflare se hai modificato HTML/CSS/JS"
echo "2. Testa il sito: https://drape-dev.it"
