FROM node:24-alpine AS frontend
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM python:3.12-slim
WORKDIR /app
COPY server/requirements.txt server/requirements.txt
RUN pip install --no-cache-dir -r server/requirements.txt && useradd --create-home fleet
COPY server ./server
COPY --from=frontend /app/dist ./dist
RUN mkdir -p /app/data && chown -R fleet:fleet /app
USER fleet
ENV FLEET_STATIC_DIR=/app/dist FLEET_DATA_DIR=/app/data FLEET_DEV=0
EXPOSE 8000
CMD ["python", "-m", "uvicorn", "server.app:create_app", "--factory", "--host", "0.0.0.0", "--port", "8000", "--workers", "1", "--no-access-log"]
