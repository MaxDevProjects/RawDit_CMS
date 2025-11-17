#!/usr/bin/env node

/**
 * Utilitaire pour créer/mettre à jour des utilisateurs
 * 
 * Usage:
 *   node core/scripts/create-user.js admin password123
 *   node core/scripts/create-user.js -l (liste les utilisateurs)
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import bcrypt from 'bcryptjs';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const USERS_FILE = path.join(__dirname, '../../data', 'users.json');

async function loadUsers() {
  try {
    const content = await fs.readFile(USERS_FILE, 'utf8');
    return JSON.parse(content || '[]');
  } catch (err) {
    if (err.code === 'ENOENT') {
      return [];
    }
    throw err;
  }
}

async function saveUsers(users) {
  await fs.writeFile(USERS_FILE, JSON.stringify(users, null, 2) + '\n');
}

async function hashPassword(password) {
  const saltRounds = 12;
  return bcrypt.hash(password, saltRounds);
}

async function listUsers() {
  const users = await loadUsers();
  console.log('\n📋 Utilisateurs enregistrés:\n');
  
  if (users.length === 0) {
    console.log('  (Aucun utilisateur)');
  } else {
    users.forEach((user, idx) => {
      console.log(`  ${idx + 1}. ${user.username}`);
      console.log(`     Hash: ${user.passwordHash.substring(0, 30)}...`);
    });
  }
  console.log('');
}

async function addUser(username, password) {
  if (!username || !password) {
    console.error('❌ Usage: node core/scripts/create-user.js <username> <password>');
    process.exit(1);
  }

  console.log(`🔐 Hachage du mot de passe pour "${username}"...`);
  const passwordHash = await hashPassword(password);
  
  const users = await loadUsers();
  
  // Vérifier si l'utilisateur existe déjà
  const existingIndex = users.findIndex(u => u.username === username);
  
  if (existingIndex >= 0) {
    console.log(`⚠️  L'utilisateur "${username}" existe déjà. Mise à jour...`);
    users[existingIndex].passwordHash = passwordHash;
  } else {
    console.log(`✨ Création du nouvel utilisateur "${username}"...`);
    users.push({ username, passwordHash });
  }
  
  await saveUsers(users);
  
  console.log('✅ Utilisateur sauvegardé !\n');
  console.log('📝 Contenu de data/users.json:');
  console.log(JSON.stringify(users, null, 2));
  console.log('');
}

async function main() {
  const args = process.argv.slice(2);
  
  if (args[0] === '-l' || args[0] === '--list') {
    await listUsers();
  } else if (args.length >= 2) {
    const username = args[0];
    const password = args[1];
    await addUser(username, password);
  } else {
    console.log(`
Usage:
  node core/scripts/create-user.js <username> <password>   Ajouter/modifier un utilisateur
  node core/scripts/create-user.js -l                      Lister les utilisateurs
  node core/scripts/create-user.js --list                  Lister les utilisateurs

Exemple:
  node core/scripts/create-user.js admin clower123
  node core/scripts/create-user.js editor password456
  node core/scripts/create-user.js -l
    `);
    process.exit(0);
  }
}

main().catch(err => {
  console.error('❌ Erreur:', err.message);
  process.exit(1);
});
