FROM maven:3.8.8-eclipse-temurin-17 AS build
WORKDIR /app
COPY Backend/ ./Backend/
COPY Frontend/ ./Backend/src/main/resources/static/
WORKDIR /app/Backend
RUN mvn clean package -DskipTests

FROM eclipse-temurin:17-jre-alpine
COPY --from=build /app/Backend/target/*.jar /app.jar
ENTRYPOINT ["java", "-jar", "/app.jar"]