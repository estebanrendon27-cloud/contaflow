FROM node:20-alpine

WORKDIR /app

# Instalar dependencias del sistema
RUN apk add --no-cache wget

# Copiar package.json y instalar dependencias
COPY package.json ./
RUN npm install --omit=dev

# Copiar código fuente
COPY src/ ./src/
COPY .env.example ./.env.example

# Crear directorios necesarios
RUN mkdir -p uploads logs

# Usuario no-root por seguridad
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 && \
    chown -R nodejs:nodejs /app

USER nodejs

EXPOSE 3001

CMD ["node", "src/index.js"]
