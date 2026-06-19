# Grafide — Developer Guide

## Project structure

```
project-root/
├── Backend/
│   ├── src/main/java/com/grafide/
│   │   ├── GrafideApplication.java
│   │   └── SpaFallbackController.java
│   ├── src/main/resources/
│   │   ├── application.properties          ← shared config (all profiles)
│   │   ├── application-local.properties    ← local Windows dev
│   │   └── application-prod.properties     ← Docker / Render cloud
│   ├── pom.xml
│   └── Dockerfile
└── Frontend/
    ├── index.html
    ├── grafide.js
    └── ...
```

---

## Local development (Windows — no Docker required)

### Prerequisites

| Tool | Version | Notes |
|------|---------|-------|
| JDK | 21+ | [Eclipse Temurin](https://adoptium.net/) recommended |
| Maven | 3.9+ | Add `mvn` to `PATH`; verify with `mvn -v` |
| MongoDB | 6+ | Install as a Windows service; starts automatically on boot |

### Start MongoDB (if not running)

```bat
net start MongoDB
```

Verify it's up:

```bat
mongosh --eval "db.adminCommand('ping')"
```

### Run the API

From the `Backend/` directory:

```bat
cd Backend
mvn spring-boot:run -Dspring-boot.run.profiles=local
```

The API starts on **http://localhost:8080**.  
The frontend at `../Frontend/` is served by Spring automatically.  
Open **http://localhost:8080** in your browser — done.

### What the local profile does

- Connects to `mongodb://localhost:27017/grafide` (no Atlas, no Docker Compose).
- Uses a safe hard-coded dev JWT secret (never deploy this value).
- Stores uploaded images on local disk under `Backend/uploads/images/`.
- Activates `SpaFallbackController` so browser refreshes on SPA routes work.
- Serves the `../Frontend/` directory as static content via Spring.
- No CORS issues — the API and frontend share the same origin.

### Stop MongoDB

```bat
net stop MongoDB
```

---

## Environment variables (local overrides)

You never need to set any environment variables for normal local development.  
All local defaults live in `application-local.properties`.

If you want to test Cloudinary uploads locally, set:

```bat
set CLOUDINARY_URL=cloudinary://key:secret@cloud-name
```

If you want to test email locally, set:

```bat
set MAIL_HOST=smtp.gmail.com
set MAIL_PORT=587
set MAIL_USERNAME=you@gmail.com
set MAIL_PASSWORD=your-app-password
```

---

## Docker build (cloud deployment)

Docker is used **only** for producing the cloud deployment artefact.  
Never run Docker Compose for local development.

### Build the image

From the `Backend/` directory:

```bash
docker build -t grafide-api .
```

### Test the image locally (optional smoke-test)

You must supply all required environment variables:

```bash
docker run -p 8080:8080 \
  -e SPRING_DATA_MONGODB_URI="mongodb+srv://user:pass@cluster.mongodb.net/grafide" \
  -e JWT_SECRET="your-long-random-secret" \
  -e GRAFIDE_CORS_ORIGINS="http://localhost:8080" \
  -e GRAFIDE_EDITOR_CODE="test-code" \
  -e BASE_URL="http://localhost:8080" \
  grafide-api
```

---

## Render deployment

### Backend (Web Service)

| Setting | Value |
|---------|-------|
| Environment | Docker |
| Dockerfile path | `Backend/Dockerfile` |
| Instance type | Starter or above |

**Environment variables to set in Render dashboard:**

| Variable | Description |
|----------|-------------|
| `SPRING_DATA_MONGODB_URI` | MongoDB Atlas connection string |
| `JWT_SECRET` | Long random string (32+ chars). App refuses to start without it. |
| `CLOUDINARY_URL` | Cloudinary URL. Without it, uploads use ephemeral container disk. |
| `GRAFIDE_CORS_ORIGINS` | Your frontend URL e.g. `https://grafide-frontend.onrender.com` |
| `GRAFIDE_EDITOR_CODE` | Secret code for editor registration |
| `BASE_URL` | Your backend URL e.g. `https://grafide-api.onrender.com` |
| `MAIL_HOST` | SMTP host (optional — reset links fall back to logs if absent) |
| `MAIL_PORT` | SMTP port (optional) |
| `MAIL_USERNAME` | SMTP username (optional) |
| `MAIL_PASSWORD` | SMTP password (optional) |
| `MAIL_FROM` | From address for reset emails (optional) |

### Frontend (Static Site)

| Setting | Value |
|---------|-------|
| Root directory | `Frontend/` |
| Build command | *(leave blank — no build step)* |
| Publish directory | `Frontend/` |

**Redirect rule** — add this in the Render Static Site dashboard  
*(replaces the deleted `SpaFallbackController` which is inactive in prod)*:

| Source | Destination | Type |
|--------|-------------|------|
| `/*` | `/index.html` | Rewrite |

---

## Key design decisions

### Why two Spring profiles instead of one `application.properties`?

A single file with `${VAR:fallback}` syntax creates two risks:

1. **Accidental prod-like runs locally** — if a developer has `JWT_SECRET` set in their shell from a previous task, the local app silently picks it up.
2. **Weak secrets deployed to prod** — if `JWT_SECRET` is not set on Render, the app would boot with the fallback string, allowing anyone to forge admin tokens.

Separate profile files make each environment self-describing and eliminate both risks.

### Why no Docker Compose?

Docker Compose is a multi-container orchestration tool. Using it locally would mean:

- Running MongoDB inside a Docker container instead of the native Windows service.
- Every developer needing Docker Desktop installed (heavyweight, licensed for teams).
- Slower iteration — containers must rebuild on source changes.

The native Windows MongoDB service starts faster, persists data between sessions without volume mounts, and needs no Docker knowledge to operate.

### Why `@Profile("local")` on `SpaFallbackController` and `staticFrontendConfigurer`?

In the prod Docker image, Spring must not intercept `/article/**` or serve `../Frontend/` — the frontend is a completely separate Render Static Site. If these beans activated in prod, every SPA-route request would 404 inside the container (the `Frontend/` directory doesn't exist in the image) and potentially mask API errors.