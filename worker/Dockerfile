FROM python:3.11-slim

WORKDIR /app

# Instalar dependencias de compilación si son necesarias para wheels C
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    python3-dev \
    libev-dev \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

ENV PYTHONUNBUFFERED=1

CMD ["python", "main.py"]
