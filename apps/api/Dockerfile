# Dialoo API image (used by Render). Build context = apps/api.
# Stage 1: Maven + JDK 21 builds the jar.  Stage 2: slim JRE 21 runs it as a non-root user.
FROM maven:3.9-eclipse-temurin-21 AS build
WORKDIR /app
COPY pom.xml settings.xml ./
# Maven Central sometimes answers "429 Too Many Requests" to shared build servers: retry with a pause instead of failing the deploy.
RUN for i in 1 2 3 4 5 6; do mvn -s settings.xml -q -B -Dmaven.wagon.http.retryHandler.count=5 dependency:go-offline && break; echo "Maven download failed (attempt $i), retrying in 30s"; sleep 30; [ "$i" = 6 ] && exit 1; done
COPY src ./src
RUN for i in 1 2 3 4 5 6; do mvn -s settings.xml -q -B -DskipTests -Dmaven.wagon.http.retryHandler.count=5 package && break; echo "Maven build failed (attempt $i), retrying in 30s"; sleep 30; [ "$i" = 6 ] && exit 1; done

FROM eclipse-temurin:21-jre
WORKDIR /app
RUN useradd -r -u 1001 dialoo
COPY --from=build /app/target/dialoo-api.jar app.jar
USER dialoo
EXPOSE 8080
# Small-memory settings so it fits a 512 MB free Render instance. Render injects PORT (Spring reads it via server.port).
ENV JAVA_TOOL_OPTIONS="-Xmx340m -XX:+UseSerialGC -XX:TieredStopAtLevel=1"
ENTRYPOINT ["java","-jar","/app/app.jar"]
