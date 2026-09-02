# L'Art de la Connexion

Plateforme web de consultations de médiumnité avec espace client, espace propriétaire, réservation et visioconférence WebRTC.

## Fonctionnalités

- Accueil responsive violet et blanc
- Inscription et connexion sécurisées
- Rôles `client` et `owner`
- Demandes de rendez-vous
- Validation/refus/fin de consultation par le propriétaire
- Espace personnel client
- Tableau de bord propriétaire
- Salon visio privé WebRTC (2 participants maximum)
- Signalisation temps réel via Socket.IO
- Base locale SQLite

## Installation

```bash
npm install
cp .env.example .env
npm start
```

Sous Windows, copiez `.env.example` vers `.env` manuellement si nécessaire.

Ouvrez ensuite `http://localhost:3000`.

## Compte propriétaire

Renseignez l'adresse du propriétaire dans `.env` :

```env
ADMIN_EMAIL=votre-email@example.com
```

Lorsque cette adresse s'inscrit ou se connecte, le compte obtient le rôle `owner`.

## Production

La production doit obligatoirement utiliser HTTPS. Configurez également :

```env
NODE_ENV=production
SESSION_SECRET=une-longue-valeur-aleatoire-d-au-moins-32-caracteres
```

Pour une visio fiable sur tous les réseaux (4G/5G, NAT strict, réseaux d'entreprise), ajoutez un serveur TURN :

```env
TURN_URL=turn:turn.votredomaine.fr:3478
TURN_USERNAME=...
TURN_CREDENTIAL=...
```

Coturn peut être utilisé comme serveur TURN auto-hébergé.

## Sécurité déjà intégrée

- `helmet` et Content Security Policy restrictive
- cookies de session `HttpOnly`, `SameSite=Lax` et `Secure` en production
- stockage des sessions côté serveur dans SQLite
- mots de passe hachés avec bcrypt (coût 12)
- protection CSRF par jeton de session
- vérification de l'origine des requêtes mutatives
- rate limiting global et renforcé sur l'authentification
- validation Zod côté serveur
- limites de taille sur les corps HTTP et Socket.IO
- contrôle d'accès sur chaque consultation
- salons visio limités aux participants autorisés
- erreurs d'authentification non détaillées
- en-tête `X-Powered-By` désactivé

## Important avant mise en ligne

Aucune application connectée à Internet ne peut être qualifiée de « sécurité absolue ». Pour un vrai déploiement public, ajoutez au minimum : sauvegardes chiffrées, reverse proxy HTTPS (Caddy/Nginx/Traefik), mises à jour régulières, supervision, rotation des secrets et audit de sécurité périodique.

Les données de visio ne sont pas enregistrées par l'application. WebRTC chiffre les flux en transit, mais la confidentialité globale dépend aussi du navigateur, du poste, du réseau et du serveur TURN utilisé.

## Arborescence

```text
.
├── public/
│   ├── app.js
│   ├── index.html
│   └── styles.css
├── .env.example
├── .gitignore
├── package.json
├── README.md
└── server.js
```
