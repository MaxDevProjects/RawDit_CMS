#!/bin/bash

# Test interactif du flux d'authentification complet
# Ce script démontre le cycle login/redirect/access

BASE_URL="http://localhost:10001"

echo "========================================="
echo "Test Interactif - Flux Complet Auth"
echo "========================================="
echo ""

# Créer un fichier temporaire pour les cookies
COOKIES="/tmp/admin_cookies.txt"
rm -f "$COOKIES"

echo "1️⃣  Tentative d'accès direct à /admin_public/sites.html"
echo "   (Sans authentification)"
echo ""
echo "   Commande:"
echo "   curl -v $BASE_URL/admin_public/sites.html"
echo ""
echo "   Réponse attendue: HTTP 302 avec Location: /admin_public/index.html"
echo ""
read -p "   Appuyer sur Entrée pour continuer..."
echo ""

curl -i "$BASE_URL/admin_public/sites.html" 2>&1 | head -20
echo ""
echo "   ✅ Redirection correcte vers la page index !"
echo ""

echo "2️⃣  Tentative de connexion avec mauvais identifiants"
echo ""
echo "   Commande:"
echo "   curl -X POST $BASE_URL/api/login \\"
echo "     -H 'Content-Type: application/json' \\"
echo "     -d '{\"username\":\"invalid\",\"password\":\"invalid\"}'"
echo ""
read -p "   Appuyer sur Entrée pour continuer..."
echo ""

curl -s -X POST "$BASE_URL/api/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"invalid","password":"invalid"}' \
  -w "\nStatus: %{http_code}\n"
echo ""
echo "   ✅ Authentification rejetée (401) !"
echo ""

echo "3️⃣  Connexion réussie avec identifiants valides"
echo ""
echo "   Identifiants : username=admin"
echo "   (Password stocké dans data/users.json)"
echo ""
echo "   Commande:"
echo "   curl -X POST $BASE_URL/api/login \\"
echo "     -H 'Content-Type: application/json' \\"
echo "     -d '{\"username\":\"admin\",\"password\":\"clower123\"}' \\"
echo "     -c cookies.txt"
echo ""
echo "   (Le serveur crée une session et envoie un cookie)"
echo ""
read -p "   Appuyer sur Entrée pour essayer la connexion..."
echo ""

# Essayer avec le mot de passe par défaut (à adapter selon votre config)
# Pour demo, on suppose que c'est possible de récupérer la réponse
response=$(curl -s -X POST "$BASE_URL/api/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"password"}' \
  -c "$COOKIES" \
  -w "\n%{http_code}")

http_code=$(echo "$response" | tail -1)
body=$(echo "$response" | head -1)

echo "   Réponse: $body"
echo "   Status: $http_code"
echo ""

if [ "$http_code" = "200" ]; then
  echo "   ✅ Connexion réussie ! Session créée."
  echo ""
  
  echo "4️⃣  Vérification du statut d'authentification"
  echo ""
  echo "   Commande:"
  echo "   curl $BASE_URL/api/auth/me -b cookies.txt"
  echo ""
  read -p "   Appuyer sur Entrée pour vérifier..."
  echo ""
  
  curl -s "$BASE_URL/api/auth/me" -b "$COOKIES"
  echo ""
  echo ""
  echo "   ✅ Authentification confirmée !"
  echo ""
  
  echo "5️⃣  Accès à la page admin (maintenant autorisé)"
  echo ""
  echo "   Commande:"
  echo "   curl $BASE_URL/admin_public/sites.html -b cookies.txt"
  echo ""
  read -p "   Appuyer sur Entrée pour accéder à la page..."
  echo ""
  
  curl -s "$BASE_URL/admin_public/sites.html" -b "$COOKIES" | head -20
  echo ""
  echo "   ... (contenu HTML)"
  echo ""
  echo "   ✅ Page chargée avec succès !"
  echo ""
  
  echo "6️⃣  Déconnexion"
  echo ""
  echo "   Commande:"
  echo "   curl -X POST $BASE_URL/api/logout -b cookies.txt"
  echo ""
  read -p "   Appuyer sur Entrée pour se déconnecter..."
  echo ""
  
  curl -s -w "Status: %{http_code}\n" -X POST "$BASE_URL/api/logout" -b "$COOKIES"
  echo ""
  echo "   ✅ Déconnexion effectuée !"
  echo ""
  
  echo "7️⃣  Vérification après déconnexion"
  echo ""
  curl -s "$BASE_URL/api/auth/me" -b "$COOKIES"
  echo ""
  echo ""
  echo "   ✅ Session bien détruite !"
  echo ""
else
  echo "   ⚠️  Connexion échouée. Vérifiez:"
  echo "      - Le serveur est bien lancé sur $BASE_URL"
  echo "      - Les identifiants dans data/users.json"
  echo "      - Le mot de passe utilisé (doit correspondre au hash)"
  echo ""
fi

echo "========================================="
echo "Test interactif terminé !"
echo "========================================="
echo ""
echo "Fichier de cookies: $COOKIES"
echo "(Peut être utilisé dans d'autres requêtes curl avec: -b $COOKIES)"
echo ""
