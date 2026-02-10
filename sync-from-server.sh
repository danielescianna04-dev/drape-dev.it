#!/bin/bash
# Sync script: Server → Local (solo per emergenze)
# Scarica la versione dal server in locale

echo "⬇️  Scaricando dal server..."

rsync -avz \
  --exclude='.git' \
  -e "ssh -i ~/.ssh/id_ed25519_drape" \
  root@77.42.1.116:/var/www/drape-dev.it/ \
  /Users/leon/Desktop/drape-dev.it/

echo "✅ Sincronizzazione completata!"
echo ""
echo "⚠️  Attenzione: questo script sovrascrive i file locali con quelli del server."
echo "   Usa solo se hai fatto modifiche sul server e vuoi riportarle in locale."
