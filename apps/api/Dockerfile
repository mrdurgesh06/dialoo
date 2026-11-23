# Dialoo API image (used by Render). Build context = apps/api.
# Stage 1: Maven + JDK 21 builds the jar.  Stage 2: slim JRE 21 runs it as a non-root user.
FROM maven:3.9-eclipse-temurin-21 AS build
WORKDIR /app
COPY pom.xml .
RUN mvn -q -B dependency:go-offline
COPY src ./src
RUN mvn -q -B -DskipTests package

FROM eclipse-temurin:21-jre
WORKDIR /app
RUN useradd -r -u 1001 dialoo
COPY --from=build /app/target/dialoo-api.jar app.jar
USER dialoo
EXPOSE 8080
# Small-memory settings so it fits a 512 MB free Render instance. Render injects PORT (Spring reads it via server.port).
ENV JAVA_TOOL_OPTIONS="-Xmx340m -XX:+UseSerialGC -XX:TieredStopAtLevel=1"
ENTRYPOINT ["java","-jar","/app/app.jar"]
