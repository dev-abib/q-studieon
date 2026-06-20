#!/bin/bash
# Load nvm so npm/node are available in non-interactive shells
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

cd ~/q-studieon

# Force overwrite any local changes before pulling
git fetch --all
git reset --hard origin/main

npm install
npm run build
pm2 restart dwellr-api
echo "✅ Deployed successfully!"
