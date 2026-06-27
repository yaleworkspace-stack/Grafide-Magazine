# Grafide Magazine — Developer Guide

## Project Structure

```
grafide-magazine/
├── index.html                  # Homepage
├── 404.html                    # 404 page
├── css/
│   ├── styles.css              # Shared base (tokens, header, footer, buttons)
│   ├── home.css                # Homepage styles
│   ├── article.css             # Article detail page
│   ├── category.css            # Shared: Fashion, Lifestyle, Photography, Culture
│   ├── magazine.css            # Magazines listing + detail
│   ├── podcast.css             # Podcast page
│   ├── auth.css                # Sign in, register, forgot, reset
│   ├── submit.css              # Submit, my submissions, resubmit
│   ├── editor.css              # Editor dashboard
│   └── static.css              # About, Contact, Work With Us, Terms, Privacy, Cookies
├── js/
│   ├── shared.js               # API layer, header/footer, session, toast
│   ├── app.js                  # Homepage
│   ├── article.js              # Article detail
│   ├── category-base.js        # Shared category logic
│   ├── fashion.js              # Fashion page
│   ├── lifestyle.js            # Lifestyle page
│   ├── photography.js          # Photography page
│   ├── culture.js              # Culture page
│   ├── magazine.js             # Magazines page
│   ├── podcast.js              # Podcast page
│   ├── auth.js                 # Auth pages
│   ├── submit.js               # Submit + my submissions + resubmit
│   ├── editor.js               # Editor dashboard
│   └── contact.js              # Contact form
├── pages/
│   ├── article.html
│   ├── fashion.html
│   ├── lifestyle.html
│   ├── photography.html
│   ├── culture.html
│   ├── magazine.html
│   ├── podcast.html
│   ├── auth.html
│   ├── submit.html
│   ├── editor.html
│   ├── about.html
│   ├── contact.html
│   ├── work-with-us.html
│   ├── terms.html
│   ├── privacy.html
│   └── cookies.html
└── backend/
    ├── pom.xml
    ├── Dockerfile
    └── src/main/
        ├── java/com/grafide/
        │   ├── GrafideApplication.java
        │   ├── config/
        │   │   ├── SecurityConfig.java
        │   │   ├── CloudinaryConfig.java
        │   │   └── GlobalExceptionHandler.java
        │   ├── controller/
        │   │   ├── AuthController.java
        │   │   ├── ArticleController.java
        │   │   ├── SubmissionController.java
        │   │   ├── MagazineController.java
        │   │   ├── PodcastController.java
        │   │   ├── SubscriberController.java
        │   │   ├── ContactController.java
        │   │   ├── UploadController.java
        │   │   └── HealthController.java
        │   ├── model/
        │   │   ├── User.java
        │   │   ├── Article.java
        │   │   ├── Submission.java
        │   │   ├── Magazine.java
        │   │   ├── Podcast.java
        │   │   ├── Subscriber.java
        │   │   └── ContactMessage.java
        │   ├── repository/
        │   │   ├── UserRepository.java
        │   │   ├── ArticleRepository.java
        │   │   ├── SubmissionRepository.java
        │   │   ├── MagazineRepository.java
        │   │   ├── PodcastRepository.java
        │   │   ├── SubscriberRepository.java
        │   │   └── ContactRepository.java
        │   └── security/
        │       ├── JwtUtil.java
        │       └── JwtAuthFilter.java
        └── resources/
            ├── application.properties          ← shared (all profiles)
            ├── application-local.properties    ← Windows local dev
            └── application-prod.properties     ← Render cloud
```

---

## Local Development (Windows — no Docker)

### Prerequisites

| Tool    | Version | Notes |
|---------|---------|-------|
| JDK     | 17      | [Eclipse Temurin](https://adoptium.net/) |
| Maven   | 3.9+    | Add `mvn` to PATH |
| MongoDB | 6+      | Install as Windows service |

### Start MongoDB

```bat
net start MongoDB
```

### Run the API

From the `backend/` directory:

```bat
cd backend
mvn spring-boot:run "-Dspring-boot.run.profiles=local"
```

API starts at **http://localhost:8080**

Open `index.html` via a static server or Live Server in VS Code.

### Stop MongoDB

```bat
net stop MongoDB
```

---

## Environment Variables (local overrides only)

No environment variables are needed for normal local development —
all local defaults live in `application-local.properties`.

To test Cloudinary locally:

```bat
set CLOUDINARY_URL=cloudinary://key:secret@cloud-name
```

To test email locally:

```bat
set MAIL_HOST=smtp.gmail.com
set MAIL_PORT=587
set MAIL_USERNAME=you@gmail.com
set MAIL_PASSWORD=your-app-password
```

---

## Render Deployment

### Backend (Web Service)

| Setting            | Value               |
|--------------------|---------------------|
| Environment        | Docker              |
| Dockerfile path    | `backend/Dockerfile`|
| Instance type      | Starter or above    |

**Environment variables to set in Render:**

| Variable                  | Description |
|---------------------------|-------------|
| `SPRING_DATA_MONGODB_URI` | MongoDB Atlas connection string |
| `JWT_SECRET`              | 32+ character random string — app refuses to start without it |
| `CLOUDINARY_URL`          | Cloudinary URL for image uploads |
| `GRAFIDE_CORS_ORIGINS`    | Frontend URL e.g. `https://grafide-frontend.onrender.com` |
| `GRAFIDE_EDITOR_CODE`     | Secret code for editor account registration |
| `BASE_URL`                | Backend URL e.g. `https://grafide-api.onrender.com` |
| `MAIL_ENABLED`            | `true` to enable email; omit to log reset links to console |
| `MAIL_HOST`               | SMTP host (optional) |
| `MAIL_PORT`               | SMTP port (optional) |
| `MAIL_USERNAME`           | SMTP username (optional) |
| `MAIL_PASSWORD`           | SMTP password (optional) |
| `MAIL_FROM`               | From address for reset emails (optional) |

### Frontend (Static Site)

| Setting           | Value        |
|-------------------|--------------|
| Root directory    | `/`          |
| Build command     | *(blank)*    |
| Publish directory | `/`          |

**Redirect rule** (add in Render Static Site dashboard):

| Source | Destination  | Type    |
|--------|--------------|---------|
| `/*`   | `/index.html`| Rewrite |

---

## API Endpoints

### Auth
| Method | Endpoint                    | Auth   |
|--------|-----------------------------|--------|
| POST   | `/api/auth/register`        | Public |
| POST   | `/api/auth/login`           | Public |
| POST   | `/api/auth/forgot-password` | Public |
| POST   | `/api/auth/reset-password`  | Public |

### Articles
| Method | Endpoint                       | Auth   |
|--------|--------------------------------|--------|
| GET    | `/api/articles`                | Public |
| GET    | `/api/articles/{id}`           | Public |
| GET    | `/api/articles/search?q=`      | Public |
| PUT    | `/api/articles/{id}`           | Editor |
| PUT    | `/api/articles/{id}/pin`       | Editor |
| PUT    | `/api/articles/{id}/unpin`     | Editor |
| PUT    | `/api/articles/{id}/unpublish` | Editor |
| PUT    | `/api/articles/{id}/republish` | Editor |
| DELETE | `/api/articles/{id}`           | Editor |

### Submissions
| Method | Endpoint                          | Auth      |
|--------|-----------------------------------|-----------|
| POST   | `/api/submissions`                | Any user  |
| GET    | `/api/submissions/mine`           | Any user  |
| GET    | `/api/submissions/queue`          | Editor    |
| GET    | `/api/submissions/{id}`           | Author/Editor |
| PUT    | `/api/submissions/{id}/approve`   | Editor    |
| PUT    | `/api/submissions/{id}/return`    | Editor    |
| PUT    | `/api/submissions/{id}/resubmit`  | Author    |
| DELETE | `/api/submissions/{id}/withdraw`  | Author    |

### Magazines
| Method | Endpoint            | Auth   |
|--------|---------------------|--------|
| GET    | `/api/magazines`    | Public |
| GET    | `/api/magazines/{id}` | Public |
| POST   | `/api/magazines`    | Editor |
| DELETE | `/api/magazines/{id}` | Editor |

### Podcasts
| Method | Endpoint            | Auth   |
|--------|---------------------|--------|
| GET    | `/api/podcasts`     | Public |
| GET    | `/api/podcasts/{id}` | Public |
| POST   | `/api/podcasts`     | Editor |
| DELETE | `/api/podcasts/{id}` | Editor |

### Contact
| Method | Endpoint              | Auth   |
|--------|-----------------------|--------|
| POST   | `/api/contact`        | Public |
| GET    | `/api/contact`        | Editor |
| PUT    | `/api/contact/{id}/read` | Editor |

### Misc
| Method | Endpoint              | Auth   |
|--------|-----------------------|--------|
| POST   | `/api/subscribers`    | Public |
| GET    | `/api/subscribers`    | Editor |
| POST   | `/api/upload/image`   | Editor |
| GET    | `/api/health`         | Public |

---

## Key Design Decisions

### Two Spring profiles — not one `application.properties`

Keeps local dev and production self-describing. A developer never accidentally
runs with production secrets, and weak secrets can never reach Render.

### No Docker for local development

Docker is used only to produce the Render deployment artefact. Locally,
the native Windows MongoDB service starts faster, persists data without
volume mounts, and requires no Docker knowledge.

### JWT secret SHA-256 hashing

Raw secrets of any length are hashed to 256 bits before signing, preventing
`SignatureException` / HTTP 500 errors from short secrets.

### Page-scoped JS/CSS

Every page has its own HTML, CSS, and JS file. No single monolithic JS file.
`shared.js` provides the API layer, header/footer, session helpers, and toast —
everything else is page-specific.

### Editor access via role — no hidden URL

Editor registration requires the `GRAFIDE_EDITOR_CODE` secret.
Admin features are unlocked inside the normal app for accounts with `role=editor`.
