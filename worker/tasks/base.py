from abc import ABC, abstractmethod
import logging

class BaseJob(ABC):
    """
    Clase base para todos los trabajos y tareas en segundo plano del worker.
    Permite registrar nuevos módulos de procesamiento con ciclo de vida uniforme.
    """

    def __init__(self, name: str):
        self.name = name
        self.logger = logging.getLogger(f"worker.{name}")
        self._is_running = True

    @abstractmethod
    def setup(self) -> None:
        """Inicializa conexiones, esquemas o recursos específicos del trabajo."""
        pass

    @abstractmethod
    def run_cycle(self) -> float:
        """
        Ejecuta un ciclo de procesamiento del trabajo.
        Retorna el número de segundos a esperar antes del próximo ciclo
        (0 para continuar inmediatamente si hubo trabajo procesado).
        """
        pass

    @abstractmethod
    def shutdown(self) -> None:
        """Libera conexiones y vacía cualquier recurso pendiente antes del apagado."""
        pass

    def stop(self) -> None:
        """Señala al trabajo que debe detenerse."""
        self._is_running = False
