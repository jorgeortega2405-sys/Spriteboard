import logging
import signal
import sys
import time
from typing import List
from config import config
from tasks import BaseJob, TelemetryJob

# Configuración de Logging Unificado y Seguro
logging.basicConfig(
    level=getattr(logging, config.LOG_LEVEL, logging.INFO),
    format="[%(asctime)s] [%(levelname)s] [%(name)s] %(message)s",
    datefmt="%Y-%m-%dT%H:%M:%SZ",
)
logger = logging.getLogger("worker.main")

class WorkerDaemon:
    """
    Orquestador genérico del demonio de tareas en segundo plano.
    Permite registrar y ejecutar de forma concurrente múltiples trabajos (jobs),
    garantizando un apagado ordenado (graceful shutdown) ante señales del sistema.
    """

    def __init__(self):
        self.jobs: List[BaseJob] = []
        self._shutdown_requested = False

    def register(self, job: BaseJob) -> None:
        """Registra un nuevo trabajo en el demonio."""
        self.jobs.append(job)
        logger.info(f"Trabajo registrado: '{job.name}' ({job.__class__.__name__})")

    def setup_all(self) -> None:
        """Inicializa todos los trabajos registrados."""
        logger.info(f"Iniciando configuración de {len(self.jobs)} trabajos registrados...")
        for job in self.jobs:
            try:
                job.setup()
            except Exception as e:
                logger.error(f"Fallo crítico al inicializar trabajo '{job.name}': {e}", exc_info=True)
                sys.exit(1)
        logger.info("Todos los trabajos han sido inicializados correctamente.")

    def run(self) -> None:
        """Bucle principal de ejecución del demonio."""
        self._bind_signals()
        self.setup_all()

        logger.info("Spriteboard Worker iniciado y escuchando colas...")

        while not self._shutdown_requested:
            idle_times = []
            for job in self.jobs:
                if not job._is_running:
                    continue
                try:
                    wait_sec = job.run_cycle()
                    idle_times.append(wait_sec)
                except Exception as e:
                    logger.error(f"Excepción en trabajo '{job.name}': {e}", exc_info=True)
                    idle_times.append(1.0)

            # Si todos los trabajos están ociosos, pausar brevemente el hilo principal
            sleep_time = min(idle_times) if idle_times else 1.0
            if sleep_time > 0 and not self._shutdown_requested:
                time.sleep(sleep_time)

        self._shutdown()

    def _bind_signals(self) -> None:
        def handle_signal(sig, frame):
            sig_name = signal.Signals(sig).name
            logger.info(f"Señal {sig_name} recibida. Iniciando apagado ordenado de trabajos...")
            self._shutdown_requested = True
            for job in self.jobs:
                job.stop()

        signal.signal(signal.SIGINT, handle_signal)
        signal.signal(signal.SIGTERM, handle_signal)

    def _shutdown(self) -> None:
        logger.info("Ejecutando vaciado y liberación de recursos de todos los trabajos...")
        for job in self.jobs:
            try:
                job.shutdown()
            except Exception as e:
                logger.error(f"Error apagando trabajo '{job.name}': {e}", exc_info=True)
        logger.info("Spriteboard Worker finalizado limpiamente.")
        sys.exit(0)

if __name__ == "__main__":
    daemon = WorkerDaemon()

    # 1. Telemetría y Métricas (Redis -> Cassandra)
    daemon.register(TelemetryJob())

    # Aquí se pueden registrar futuros trabajos (ej: EmailJob, AnalyticsJob, CleanupJob, etc.)

    daemon.run()
