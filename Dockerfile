# Imagen base oficial y liviana de Node.js LTS
FROM node:20-alpine

# Establecer directorio de trabajo en el contenedor
WORKDIR /app

# Instalar ffmpeg para renderizado y procesamiento multimedia
RUN apk add --no-cache ffmpeg

# Copiar manifiestos de dependencias y paquetes compartidos
COPY package*.json ./
COPY packages ./packages

# Instalar dependencias
RUN npm install

# Copiar el código fuente de la aplicación
COPY . .

# Compilar backend y frontend
RUN npm run build

# Exponer el puerto de la aplicación
EXPOSE 3000

# Comando de inicio por defecto
CMD ["npm", "start"]
