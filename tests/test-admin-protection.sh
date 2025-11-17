#!/bin/bash

# Tests de Protection des Pages Admin - US1.3
# Ce script teste tous les critères d'acceptation

BASE_URL="http://localhost:10001"
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "========================================="
echo "Tests de Protection Admin (US1.3)"
echo "========================================="
echo ""

# Fonction pour afficher les résultats
test_result() {
  local test_name="$1"
  local expected="$2"
  local actual="$3"
  
  if [ "$expected" = "$actual" ]; then
    echo -e "${GREEN}✅ PASS${NC} - $test_name"
    return 0
  else
    echo -e "${RED}❌ FAIL${NC} - $test_name"
    echo "   Attendu: $expected"
    echo "   Reçu: $actual"
    return 1
  fi
}

# Test 1: Accès à page admin sans authentification
echo -e "${YELLOW}Test 1: Accès à /admin_public/index.html sans authentification${NC}"
status=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/admin_public/index.html")
test_result "Redirection 302" "302" "$status"
echo ""

# Test 2: Vérification que la redirection va vers login
echo -e "${YELLOW}Test 2: Vérification de la redirection vers login${NC}"
location=$(curl -s -i "$BASE_URL/admin_public/index.html" 2>&1 | grep "Location:" | cut -d' ' -f2 | tr -d '\r')
test_result "Redirection vers /admin_public/login.html" "/admin_public/login.html" "$location"
echo ""

# Test 3: Accès à la page login (public)
echo -e "${YELLOW}Test 3: Accès à /admin_public/login.html (page publique)${NC}"
status=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/admin_public/login.html")
test_result "Accès autorisé (200)" "200" "$status"
echo ""

# Test 4: Accès aux assets (public)
echo -e "${YELLOW}Test 4: Accès aux assets /admin_public/assets/admin.css${NC}"
status=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/admin_public/assets/admin.css")
test_result "Accès autorisé (200)" "200" "$status"
echo ""

# Test 5: API auth/me sans authentification
echo -e "${YELLOW}Test 5: GET /api/auth/me sans authentification${NC}"
response=$(curl -s "$BASE_URL/api/auth/me")
test_result "Réponse non-authentifié" '{"authenticated":false}' "$response"
echo ""

# Test 6: Tentative de login avec mauvais identifiants
echo -e "${YELLOW}Test 6: Login avec identifiants invalides${NC}"
status=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE_URL/api/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"invalid","password":"invalid"}')
test_result "Rejet (401)" "401" "$status"
echo ""

# Test 7: Vérifier les données utilisateurs
echo -e "${YELLOW}Test 7: Vérification du fichier users.json${NC}"
if [ -f "./data/users.json" ]; then
  echo -e "${GREEN}✅ PASS${NC} - Fichier data/users.json existe"
  echo "  Contenu:"
  cat ./data/users.json | head -5
else
  echo -e "${RED}❌ FAIL${NC} - Fichier data/users.json introuvable"
fi
echo ""

echo "========================================="
echo "Tests terminés !"
echo "========================================="
echo ""
echo "Notes pour tester avec authentification:"
echo "1. Vérifier les identifiants dans data/users.json"
echo "2. Utiliser le formulaire de login sur $BASE_URL/admin_public/login.html"
echo "3. Ou faire un POST /api/login avec les bonnes identifiants"
echo ""
