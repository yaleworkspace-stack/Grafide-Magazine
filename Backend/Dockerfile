# ============================================================
# Grafide API — Dockerfile
#
# Two-stage build:
#   Stage 1 (builder) — compiles the project and produces a
#                        self-contained executable fat-jar.
#   Stage 2 (runtime) — copies only the jar into a minimal
#                        JRE image; no build tooling ships.
#
# This image is the CLOUD artefact only.
# Local development runs natively on Windows via Maven:
#   mvn spring-boot:run -Dspring-boot.run.profiles=local
# ============================================================

# ── Stage 1: Builder ────────────────────────────────────────
FROM eclipse-temurin:21-jdk-alpine AS builder

WORKDIR /build

# Copy dependency manifest first so Docker can cache the
# dependency-download layer independently of source changes.
COPY pom.xml .

# Download all dependencies (cached unless pom.xml changes)
RUN mvn dependency:go-offline --no-transfer-progress 2>/dev/null || \
    (apk add --no-cache maven && \
     mvn dependency:go-offline --no-transfer-progress)

# Install Maven if not bundled with the base image
RUN apk add --no-cache maven

# Copy source and build the fat-jar.
# -DskipTests: tests require a live database; run them in CI
#              against a MongoDB service container instead.
COPY src ./src
RUN mvn package -DskipTests --no-transfer-progress

# ── Stage 2: Runtime ────────────────────────────────────────
FROM eclipse-temurin:21-jre-alpine AS runtime

# Non-root user — Render and most cloud platforms run containers
# as non-root by default; make it explicit.
RUN addgroup -S grafide && adduser -S grafide -G grafide
USER grafide

WORKDIR /app

# Pull only the compiled jar from the builder stage
COPY --from=builder /build/target/grafide-api-*.jar app.jar

# ── Runtime environment ──────────────────────────────────────
# Activates application-prod.properties.
# All other secrets (SPRING_DATA_MONGODB_URI, JWT_SECRET,
# CLOUDINARY_URL, GRAFIDE_CORS_ORIGINS, GRAFIDE_EDITOR_CODE,
# BASE_URL) must be injected as Render environment variables.
ENV SPRING_PROFILES_ACTIVE=prod

# Render injects PORT automatically; default to 8080 locally
# if someone runs this image with  docker run -p 8080:8080 ...
ENV PORT=8080
EXPOSE 8080

# JVM tuning for container environments:
#   -XX:+UseContainerSupport   — respect cgroup memory limits
#   -XX:MaxRAMPercentage=75    — leave headroom for the OS
ENTRYPOINT ["java", \
  "-XX:+UseContainerSupport", \
  "-XX:MaxRAMPercentage=75.0", \
  "-jar", "app.jar"]