# Imagen base oficial y liviana de Node.js LTS
FROM node:20-alpine

# Establecer directorio de trabajo en el contenedor
WORKDIR /app

# Copiar manifiestos de dependencias
COPY package*.json ./

# Instalar dependencias
RUN npm install

# Copiar el código fuente de la aplicación
COPY . .

# Exponer el puerto de la aplicación
EXPOSE 3000

# Comando de inicio por defecto
CMD ["npm", "start"]
