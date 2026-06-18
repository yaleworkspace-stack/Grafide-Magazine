# Grafide Magazines

A small full-stack editorial magazine project with:
- `Frontend/` — plain static HTML, CSS, and JavaScript
- `Backend/` — Spring Boot REST API in Java 17
- `uploads/images/` — local storage for uploaded media
- `Dockerfile` — build container for the backend app

## Repository layout

```
Grafide Magazines (website)/
├── Backend/
│   ├── pom.xml
│   └── src/main/
│       ├── java/com/grafide/GrafideApplication.java
│       └── resources/application.properties
├── Frontend/
│   ├── index.html
│   ├── css/
│   │   └── styles.css
│   └── js/
│       └── grafide.js
├── uploads/
│   └── images/              # image uploads served by backend
├── docker-compose.yml
├── Dockerfile
└── README.md

```

## What this project contains

- `Backend/` is a Spring Boot application with MongoDB integration, JWT login, file uploads, and REST endpoints.
- `Frontend/` is a simple browser app with no build step.
- `uploads/images/` is the folder where the Spring Boot backend stores uploaded files.
- `Dockerfile` builds the backend into an executable JAR container.

## Local setup

### Backend

1. Install Java 17+ and Maven.
2. Start MongoDB locally or configure a MongoDB connection string.
3. From the repository root:

```bash
cd Backend
mvn spring-boot:run
```

The backend listens on `http://localhost:8080` by default.

### Frontend

The frontend is static, so you can use any static file server.

```bash
cd Frontend
python -m http.server 3000
```

Then open `http://localhost:3000` in your browser.

## Docker

The `Dockerfile` builds the backend JAR and runs it in a Java 17 container.

Build:

```bash
docker build -t grafide-api .
```

Run:

```bash
docker run -p 8080:8080 grafide-api
```

## Configuration

Key settings are in `Backend/src/main/resources/application.properties` and can be overridden by environment variables.

Important properties:

- `server.port` — backend port (default `8080`)
- `spring.data.mongodb.uri` — MongoDB connection URI
- `jwt.secret` — JWT signing secret
- `jwt.expiration-ms` — token lifetime in milliseconds
- `grafide.upload.dir` — upload directory (`uploads/images`)
- `grafide.cors.allowed-origins` — allowed frontend origins
- `grafide.editor-code` — secret code for editor-level actions

Example configuration values are already set to local defaults in `application.properties`.

## API overview

The backend exposes REST routes under `/api`.

Common endpoints:

- `POST /api/auth/login` — authenticate and receive JWT
- `POST /api/auth/register` — create a new user account
- `GET /api/health` — health check
- `GET /api/articles` — list published articles
- `GET /api/articles/{id}` — get one article by ID
- `PUT /api/articles/{id}` — update a published article
- `DELETE /api/articles/{id}` — delete an article
- `PUT /api/articles/{id}/pin` — pin an article as cover story
- `PUT /api/articles/{id}/unpin` — unpin an article
- `PUT /api/articles/{id}/unpublish` — hide an article
- `PUT /api/articles/{id}/republish` — publish a previously hidden article
- `GET /api/articles/search?q=term` — search published articles

## Data storage

- `users` — user accounts and credentials
- `articles` — seeded and managed magazine articles
- `submissions` — creator submissions and editorial review state
- uploaded files — stored on disk in `uploads/images/`

## Notes

- The backend seeds initial article content automatically when the database is empty.
- The frontend is intentionally unbundled, so you can host it on any static web server.
- Uploaded images are stored locally; for production, consider replacing local storage with cloud storage.
