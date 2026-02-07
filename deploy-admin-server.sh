#!/bin/bash
# Deploy script per Admin Server su 77.42.1.116
# Esegui questo script sul server dopo aver copiato i file

set -e

# Crea cartella per admin server (separata dall'app)
mkdir -p /opt/drape-admin
cd /opt/drape-admin

# Copia i file (esegui questi comandi dal tuo PC):
# scp server.js root@77.42.1.116:/opt/drape-admin/
# scp package.json root@77.42.1.116:/opt/drape-admin/
# scp serviceAccountKey.json root@77.42.1.116:/opt/drape-admin/

# Installa dipendenze
npm install

# Crea servizio systemd
cat > /etc/systemd/system/drape-admin.service << 'EOF'
[Unit]
Description=Drape Admin Dashboard API
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/drape-admin
ExecStart=/usr/bin/node server.js
Restart=on-failure
RestartSec=10
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
EOF

# Abilita e avvia il servizio
systemctl daemon-reload
systemctl enable drape-admin
systemctl start drape-admin

# Verifica stato
systemctl status drape-admin

echo ""
echo "=== Admin Server deployed! ==="
echo "API running on http://77.42.1.116:3001"
echo ""
