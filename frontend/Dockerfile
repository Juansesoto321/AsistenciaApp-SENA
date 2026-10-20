# Etapa 1: compilar
FROM node:20-alpine AS compilar
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Etapa 2: servir con nginx
FROM nginx:alpine
COPY --from=compilar /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY nginx-rutas.conf /etc/nginx/asistenciaapp/rutas.conf
EXPOSE 80
