#!/bin/bash

# Validateur d'implémentation US1.3
# Vérifie que tous les critères sont satisfaits

echo "╔════════════════════════════════════════════════════════════╗"
echo "║     Validation US1.3 - Protection Admin                    ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

PASS=0
FAIL=0

# Fonction pour valider un critère
check() {
  local name="$1"
  local condition="$2"
  
  if eval "$condition"; then
    echo "✅ $name"
    ((PASS++))
  else
    echo "❌ $name"
    ((FAIL++))
  fi
}

# Section 1: Fichiers créés/modifiés
echo "📄 Fichiers"
echo "──────────────"
check "core/dev.js modifié" "grep -q 'adminGuardMiddleware' ./core/dev.js"
check "auth-service.js existe" "test -f ./core/lib/auth-service.js"
check "session-store.js existe" "test -f ./core/lib/session-store.js"
check "users.json existe" "test -f ./data/users.json"
check "create-user.js existe" "test -f ./create-user.js"
echo ""

# Section 2: Middleware
echo "🔐 Middleware"
echo "──────────────"
check "adminGuardMiddleware défini" "grep -q 'function adminGuardMiddleware' ./core/dev.js"
check "isPublicPath défini" "grep -q 'function isPublicPath' ./core/dev.js"
check "isHtmlPath défini" "grep -q 'function isHtmlPath' ./core/dev.js"
check "readSessionCookie défini" "grep -q 'function readSessionCookie' ./core/dev.js"
echo ""

# Section 3: API Endpoints
echo "🌐 API Endpoints"
echo "──────────────"
check "POST /api/login existe" "grep -q \"app.post('/api/login'\" ./core/dev.js"
check "POST /api/logout existe" "grep -q \"app.post('/api/logout'\" ./core/dev.js"
check "GET /api/auth/me existe" "grep -q \"app.get('/api/auth/me'\" ./core/dev.js"
echo ""

# Section 4: Sécurité
echo "🔒 Sécurité"
echo "──────────────"
check "HttpOnly cookies" "grep -q 'httpOnly: true' ./core/dev.js"
check "SameSite protection" "grep -q \"sameSite: 'lax'\" ./core/dev.js"
check "bcryptjs utilisé" "grep -q 'bcryptjs' ./package.json"
check "crypto utilisé" "grep -q \"from 'node:crypto'\" ./core/lib/session-store.js"
echo ""

# Section 5: Routes protégées
echo "🛡️  Routes Protégées"
echo "──────────────"
check "Routes /admin protégées" "grep -q \"app.use('/admin', adminGuardMiddleware\" ./core/dev.js"
check "Routes /admin_public protégées" "grep -q \"app.use('/admin_public', adminGuardMiddleware\" ./core/dev.js"
check "Page index (login) publique" "grep -q \"'/index.html'\" ./core/dev.js"
check "Assets publics" "grep -q \"'/assets/'\" ./core/dev.js"
echo ""

# Section 6: Documentation
echo "📚 Documentation"
echo "──────────────"
check "START_HERE.md créé" "test -f ./START_HERE.md"
check "PROTECTION_ADMIN_README.md créé" "test -f ./PROTECTION_ADMIN_README.md"
check "US1.3_PROTECTION_ADMIN.md créé" "test -f ./US1.3_PROTECTION_ADMIN.md"
check "ARCHITECTURE_SECURITY.md créé" "test -f ./ARCHITECTURE_SECURITY.md"
check "TESTS_PROTECTION_ADMIN.md créé" "test -f ./TESTS_PROTECTION_ADMIN.md"
check "INDEX_DOCUMENTATION.md créé" "test -f ./INDEX_DOCUMENTATION.md"
echo ""

# Section 7: Tests
echo "🧪 Tests"
echo "──────────────"
check "test-admin-protection.sh existe" "test -f ./test-admin-protection.sh"
check "test-auth-flow.sh existe" "test -f ./test-auth-flow.sh"
check "Scripts exécutables" "test -x ./test-admin-protection.sh"
echo ""

# Section 8: Configuration
echo "⚙️  Configuration"
echo "──────────────"
check "COOKIE_NAME défini" "grep -q 'COOKIE_NAME' ./core/dev.js"
check "SESSION_TTL = 8h" "grep -q '1000 \\* 60 \\* 60 \\* 8' ./core/dev.js"
check "Port auto-détecté" "grep -q 'findFreePort' ./core/dev.js"
echo ""

# Section 9: AuthService
echo "🔑 AuthService"
echo "──────────────"
check "authenticate() disponible" "grep -q 'authenticate(username, password)' ./core/lib/auth-service.js"
check "loadUsers() disponible" "grep -q 'loadUsers()' ./core/lib/auth-service.js"
check "bcrypt.compare utilisé" "grep -q 'bcrypt.compare' ./core/lib/auth-service.js"
echo ""

# Section 10: SessionStore
echo "💾 SessionStore"
echo "──────────────"
check "createSession() disponible" "grep -q 'createSession' ./core/lib/session-store.js"
check "getSession() disponible" "grep -q 'getSession' ./core/lib/session-store.js"
check "destroySession() disponible" "grep -q 'destroySession' ./core/lib/session-store.js"
check "crypto.randomBytes utilisé" "grep -q 'crypto.randomBytes' ./core/lib/session-store.js"
echo ""

# Résumé
echo "╔════════════════════════════════════════════════════════════╗"
TOTAL=$((PASS + FAIL))
PERCENTAGE=$((PASS * 100 / TOTAL))

if [ $FAIL -eq 0 ]; then
  echo "║  ✅ VALIDATION RÉUSSIE                                     ║"
else
  echo "║  ⚠️  VALIDATION PARTIELLE                                   ║"
fi

echo "║                                                            ║"
echo "║  Critères passés : $PASS/$TOTAL ($PERCENTAGE%)                       ║"
echo "║                                                            ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

if [ $FAIL -eq 0 ]; then
  echo "🎉 Tous les critères sont satisfaits !"
  echo ""
  echo "Prochaines étapes:"
  echo "  1. npm run dev                 # Démarrer le serveur"
  echo "  2. ./test-admin-protection.sh  # Lancer les tests"
  echo "  3. Consulter START_HERE.md     # Guide de démarrage"
  echo ""
  exit 0
else
  echo "⚠️  Certains critères ne sont pas satisfaits."
  echo "Vérifiez l'implémentation et les fichiers."
  echo ""
  exit 1
fi
