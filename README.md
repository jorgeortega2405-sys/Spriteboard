# Spriteboard

Proyecto base en **Node.js** contenedorizado con **Docker** y **Docker Compose**.

## 🚀 Inicio Rápido con Docker

Asegúrate de tener instalado [Docker](https://www.docker.com/) y Docker Compose en tu sistema.

### 1. Iniciar en modo desarrollo

Ejecuta el siguiente comando en la raíz del proyecto:

```bash
docker compose up --build
```

El servidor estará disponible en [http://localhost:3000](http://localhost:3000).

> **Nota:** El proyecto está configurado con recarga automática (`--watch`). Cualquier cambio que realices en el código local en `src/` se reflejará automáticamente en el contenedor sin necesidad de reconstruir la imagen.

### 2. Detener los contenedores

Para detener los contenedores:

```bash
docker compose down
```

---

## 🛠️ Ejecución Local (Opcional, sin Docker)

Si prefieres ejecutarlo directamente en tu máquina con Node.js instalado (v18+ recomendado):

```bash
# Instalar dependencias
npm install

# Modo producción
npm start

# Modo desarrollo (con recarga automática)
npm run dev
```

---

## 📁 Estructura del Proyecto

```text
├── src/
│   └── index.js          # Punto de entrada de la aplicación Express
├── .dockerignore         # Archivos omitidos en el build de Docker
├── .gitignore            # Archivos ignorados por Git
├── Dockerfile            # Definición de la imagen Docker (Node.js 20 Alpine)
├── docker-compose.yml    # Orquestación de contenedores y configuración de puertos/volúmenes
├── package.json          # Dependencias y scripts del proyecto
└── README.md             # Instrucciones de uso
```
