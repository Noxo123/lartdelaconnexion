# L'Art de la Connexion

Plateforme web premium de consultations privées avec espace client, espace propriétaire, réservation, paiements Stripe/PayPal et visioconférence WebRTC.

## Fonctionnalités

- Accueil responsive violet et blanc
- Inscription et connexion sécurisées
- Rôles `client` et `owner`
- Réservation avec créneaux et disponibilités
- Validation/annulation/fin de consultation
- Espace personnel client
- Tableau de bord propriétaire
- Paiement Stripe
- Paiement PayPal Checkout avec PayPal Web SDK v6 + Orders API
- Salon visio privé WebRTC (2 participants maximum)
- Signalisation temps réel via Socket.IO
- Base locale SQLite
- PWA installable

## Installation

```bash
npm install
cp .env.example .env
npm start
```

Sous Windows :

```powershell
npm install
copy .env.example .env
npm start
```

Ouvrez ensuite `http://localhost:3000`.

## Compte propriétaire

Renseignez l'adresse du propriétaire dans `.env` :

```env
ADMIN_EMAIL=votre-email@example.com
```

Lorsque cette adresse s'inscrit ou se connecte, le compte obtient le rôle `owner`.

## PayPal

L'intégration utilise le SDK serveur PayPal et le Web SDK JavaScript v6. Les commandes sont créées côté serveur à partir du tarif stocké en base : le navigateur ne peut donc pas imposer son propre montant. Le paiement est ensuite capturé côté serveur après l'approbation PayPal. Cette architecture suit les recommandations actuelles de PayPal pour les Orders API.

Commencez par le Sandbox :

```env
PAYPAL_ENVIRONMENT=sandbox
PAYPAL_CLIENT_ID=votre_client_id_sandbox
PAYPAL_CLIENT_SECRET=votre_secret_sandbox
PAYPAL_CURRENCY=EUR
```

Après `npm install` et redémarrage, un bouton PayPal apparaît automatiquement à côté du paiement des consultations non réglées.

Pour passer en production :

```env
PAYPAL_ENVIRONMENT=production
PAYPAL_CLIENT_ID=votre_client_id_live
PAYPAL_CLIENT_SECRET=votre_secret_live
PAYPAL_CURRENCY=EUR
```

Ne commitez jamais `PAYPAL_CLIENT_SECRET`. Utilisez toujours des identifiants Sandbox pendant les tests et validez le flux de bout en bout avant de passer en production.

## Stripe

Stripe reste disponible en parallèle :

```env
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_SUCCESS_URL=http://localhost:3000/espace?payment=success
STRIPE_CANCEL_URL=http://localhost:3000/espace?payment=cancelled
```

## Production

La production doit utiliser HTTPS :

```env
NODE_ENV=production
SESSION_SECRET=une-longue-valeur-aleatoire-d-au-moins-32-caracteres
```

Pour une visio fiable sur tous les réseaux, ajoutez un serveur TURN :

```env
TURN_URL=turn:turn.votredomaine.fr:3478
TURN_USERNAME=...
TURN_CREDENTIAL=...
```

## Sécurité

- `helmet` + CSP restrictive adaptée au WebRTC et PayPal
- cookies de session `HttpOnly`, `SameSite=Lax` et `Secure` en production
- sessions côté serveur dans SQLite
- mots de passe bcrypt
- protection CSRF
- vérification d'origine
- rate limiting
- validation Zod
- contrôle d'accès sur chaque consultation et paiement
- montant PayPal déterminé exclusivement côté serveur
- secrets PayPal/Stripe uniquement dans `.env`
- capture PayPal côté serveur
- salons visio limités aux participants autorisés

Aucune application connectée à Internet ne peut être qualifiée de « sécurité absolue ». Avant mise en ligne, ajoutez sauvegardes, reverse proxy HTTPS, supervision, rotation des secrets et audit périodique.

## Arborescence

```text
.
├── public/
│   ├── app2.js
│   ├── index.html
│   ├── paypal.js
│   ├── styles.css
│   └── manifest.webmanifest
├── paypal-bootstrap.js
├── .env.example
├── .gitignore
├── package.json
├── README.md
└── server.js
```
