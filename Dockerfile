FROM maven:3.9-eclipse-temurin-17 AS build
WORKDIR /app
COPY Backend/pom.xml Backend/
COPY Backend/src Backend/src
COPY Frontend /app/Backend/src/main/resources/static
RUN cd Backend && mvn package -DskipTests

FROM eclipse-temurin:17-jre
WORKDIR /app
COPY --from=build /app/Backend/target/*.jar app.jar
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "app.jar"]