# Catálogo Maestro de Herramientas y Capacidades de Spriteboard

Este documento define de forma exhaustiva y categorizada todas las herramientas, componentes y modalidades implementadas en la plataforma **Spriteboard**.

En Spriteboard existen **únicamente 2 modalidades maestras de lienzo**:
1. **Pizarrón Infinito (`board`)**: Lienzo bidireccional infinito multipropósito que unifica dibujo libre, figuras geométricas, notas adhesivas, diagramas de flujo, mapas mentales, tablas, pixel art y colaboración.
2. **Documentos (`doc`)**: Procesador de texto enriquecido estructurado por páginas independientes para redacción, informes, documentación técnica y exportación profesional.

---

## 1. Pizarrón Infinito (`board`)

El pizarrón infinito es el entorno creativo principal. Permite combinar libremente todas las siguientes herramientas en un mismo espacio de trabajo:

### A. Herramientas de Dibujo Libre y Navegación
| Herramienta | Atajo | Descripción |
| :--- | :---: | :--- |
| **Seleccionar / Transformar** | `V` | Permite hacer clic para seleccionar un elemento individual, arrastrar para selección por recuadro (marquee), mover, rotar y redimensionar elementos con tiradores interactivos. |
| **Mano / Paneo** | `H` o `Espacio` | Navegación panorámica bidireccional suave a través del lienzo infinito sin alterar los elementos seleccionados. |
| **Bolígrafo / Pluma** | `P` | Trazo vectorial libre de precisión con suavizado por curvas cuadráticas y grosor configurable (2px a 16px). |
| **Marcador** | `M` | Trazo sólido con puntas redondeadas de opacidad moderada (85%) para dibujar o rotular con presencia. |
| **Resaltador (Highlighter)** | `R` | Trazo translúcido de punta cuadrada con opacidad del 35% que permite subrayar y destacar texto o figuras sin ocultar los trazos inferiores. |
| **Borrador** | `E` | Borrado por contacto directo. Elimina trazos libres o elementos completos con tolerancia de proximidad calibrada. |
| **Zoom y Vista** | Botones `/` | Controles de zoom desde 10% hasta 300%, ajuste automático a la selección y restablecimiento rápido al 100%. |

---

### B. Figuras Geométricas (11 Tipos Canónicos)
Todas las figuras geométricas admiten personalización de color de relleno, color de borde, grosor de trazo (0px a 16px), estilo de trazo (sólido, discontinuo, punteado), opacidad, redondeo de esquinas y edición de texto central de doble clic.

| Figura | Tipo interno | Uso principal y características |
| :--- | :--- | :--- |
| **Rectángulo** | `rect` | Cajas estándar, tarjetas y contenedores rectangulares con esquinas personalizables. |
| **Rectángulo Redondeado** | `round-rect` | Botones, tarjetas modernas y componentes visuales suaves. |
| **Círculo / Elipse** | `circle` | Nodos centrales, estados circulares y diagramas conceptuales. |
| **Triángulo** | `triangle` | Nodos de advertencia, jerarquías piramidales o flechas direccionales. |
| **Rombo** | `diamond` | Evaluaciones condicionales, bifurcaciones Sí/No y decisiones en diagramas. |
| **Paralelogramo** | `parallelogram` | Nodos de entrada / salida de información (I/O) en diagramas de flujo. |
| **Cilindro** | `cylinder` | Representación de almacenes de datos, bases de datos SQL/NoSQL y storage. |
| **Píldora / Cápsula** | `pill` | Nodos de Inicio / Fin en diagramas de flujo o etiquetas tipo badge. |
| **Documento** | `document` | Representación de reportes impresos, documentos físicos o salidas en papel con onda inferior. |
| **Nube** | `cloud` | Servicios en la nube, infraestructura externa y conexiones de red. |
| **Estrella** | `star` | Calificaciones, elementos destacados o hitos con número de puntas configurable (3 a 12). |

---

### C. Notas Adhesivas (Sticky Notes - 8 Colores Canónicos)
Las notas adhesivas cuentan con sombra de profundidad aislada, esquinas redondeadas y contraste automático de texto. Al hacer doble clic sobre una nota se abre el editor en línea con ajuste automático de líneas.

| Color | Código Hex | Color de Texto | Uso sugerido |
| :--- | :---: | :---: | :--- |
| **Amarillo** | `#fef08a` | `#1e293b` | Ideas generales, notas estándar y recordatorios rápidos. |
| **Naranja** | `#fed7aa` | `#1e293b` | Advertencias, tareas prioritarias y notas de atención. |
| **Rosa** | `#fbcfe8` | `#1e293b` | Comentarios, feedback y notas de diseño. |
| **Azul** | `#bae6fd` | `#1e293b` | Tareas técnicas, infraestructura y especificaciones. |
| **Verde** | `#bbf7d0` | `#1e293b` | Tareas completadas, aprobaciones y validaciones. |
| **Morado** | `#e9d5ff` | `#1e293b` | Investigación, ideas creativas y backlog. |
| **Rojo** | `#fecaca` | `#1e293b` | Errores críticos, bloqueos y alertas de máxima urgencia. |
| **Gris** | `#f1f5f9` | `#1e293b` | Archivos neutrales, contexto histórico y notas de soporte. |

---

### D. Conectores Inteligentes y Líneas
Herramienta activable con `C`. Conecta libremente puntos del lienzo o enlaza magnéticamente elementos (figuras, notas, tablas):

- **Estilos de línea**:
  - **Curvo (Bezier suave)**: Conexión orgánica con curvatura calculada automáticamente.
  - **Ortogonal (Manhattan/Ángulo recto)**: Trazado en 90 grados para diagramas técnicos y arquitectura de software.
  - **Recto (Línea directa)**: Unión lineal directa entre puntos.
- **Marcadores de Extremo (Inicio y Fin)**:
  - Flecha rellena (`arrow-filled`)
  - Flecha abierta (`arrow`)
  - Círculo relleno (`circle-filled`)
  - Círculo hueco (`circle`)
  - Rombo relleno (`diamond-filled`)
  - Rombo hueco (`diamond`)
  - Barra transversal (`bar`)
  - Sin marcador (`none`)
- **Etiquetas en Conectores**: Permite agregar texto centrado sobre el conector con fondo blanco para preservar la legibilidad.

---

### E. Mapas Mentales y Mapas Conceptuales
Sistema integrado dentro del pizarrón con atajos de teclado rápidos:
- **Crear Subtema (Hijo)**: Presiona `Tab` teniendo seleccionado cualquier nodo para generar un nuevo subtema conectado automáticamente.
- **Crear Tema Hermano**: Presiona `Enter` teniendo seleccionado cualquier nodo para generar un nuevo hermano alineado verticalmente.
- **Auto-conexión**: Conectores curvos sincronizados con el color y jerarquía del nodo padre.

---

### F. Diagramas de Flujo
Componentes preconfigurados disponibles en la barra lateral o mediante inserción rápida:
- **Nodo Inicio / Fin**: Forma de cápsula/píldora verde esmeralda.
- **Nodo de Proceso**: Rectángulo azul para operaciones o pasos de trabajo.
- **Nodo de Decisión**: Rombo ámbar para bifurcaciones condicionales.
- **Nodo de Entrada/Salida**: Paralelogramo morado para datos de entrada o salida.
- **Nodo de Base de Datos**: Cilindro cian para representar bases de datos y almacenamiento.

---

### G. Tablas Estructuradas en el Pizarrón
Permite insertar tablas interactivas de cualquier dimensión (ej. 3×3 por defecto):
- **Edición en celda**: Doble clic en cualquier celda para escribir texto en vivo.
- **Menú contextual de tabla** (clic derecho):
  - Agregar fila arriba / abajo.
  - Agregar columna a la izquierda / derecha.
  - Eliminar fila o columna específica.
  - Mover fila hacia arriba o abajo.
  - Mover columna a la izquierda o derecha.
  - Ajustar tamaño de fila o columna automáticamente al contenido.
  - Personalizar color de celda individual o color de cabecera.

---

### H. Secciones y Marcos Agrupadores
Permite crear marcos contenedores con borde estilizado y título superior personalizable:
- Agrupa visualmente conjuntos de elementos (ej. "Sprint 1", "Investigación", "Arquitectura").
- Al mover o seleccionar la sección, todos los elementos contenidos en su interior se desplazan conjuntamente.

---

### I. Pixel Art Studio (Lienzo de Píxeles Integrado)
Módulo integrado para crear y editar arte en píxeles sin salir del pizarrón (atajo `X`):
- **Dimensiones de Cuadrícula**: 16×16, 32×32, 48×48 y 64×64 píxeles.
- **Herramientas de Píxel**:
  - **Lápiz de Píxel** (`B`): Dibuja píxeles individuales con tamaño de brocha de 1px a 8px.
  - **Bote de Pintura / Relleno** (`G`): Rellena áreas contiguas del mismo color mediante algoritmo Flood-Fill.
  - **Borrador de Píxel** (`E`): Borra píxeles volviéndolos transparentes.
  - **Cuentagotas / Eyedropper** (`I`): Muestrea el color exacto de cualquier píxel del lienzo.
- **Paletas Predefinidas**:
  - Paleta Clásica (32 colores equilibrados).
  - Paleta PICO-8 (16 colores retro).
  - Paleta GameBoy (4 tonos monocromáticos clásicos).
- **Exportación de Sprite**: Exporta el sprite en formato PNG transparente de alta resolución sin desenfoque (`imageSmoothingEnabled = false`).

---

### J. Tipografía, Imágenes y Stickers
- **Texto Enriquecido** (`T`): Bloques de título, subtítulo y texto con control de fuente (12px a 72px) y colores.
- **Imágenes**: Carga e inserción de imágenes locales o remotas con cálculo de aspecto proporcional y soporte de caché en memoria.
- **Stickers**: Biblioteca de stickers y emoticones listos para ilustrar diagramas.

---

### K. Colaboración, Historial y Exportación
- **Multi-cursor en tiempo real**: Visualización de los cursores de todos los colaboradores con nombre de usuario e indicador de color exclusivo vía WebSocket.
- **Historial Completo (Undo / Redo)**: Atajos `Ctrl+Z` y `Ctrl+Y` con persistencia de estados de todos los elementos.
- **Deselección Rápida**: Presionar `Escape` deselecciona todos los elementos y cierra cualquier menú abierto.
- **Exportación de Pizarrón**:
  - Imagen PNG (con fondo completo o fondo transparente).
  - Vectorial SVG puro (.svg).
  - Archivo de Proyecto Spriteboard (.json) para respaldo y transferencia total.

---

## 2. Documentos Doc (`doc`)

La modalidad **Documentos** está diseñada para redacción formal, especificaciones técnicas, actas y documentación estructurada:

### A. Estructura y Paginación
- **Páginas Dinámicas**: Soporte de múltiples páginas numeradas de forma independiente dentro del mismo documento.
- **Configuración de Página**:
  - Tamaño de papel: Carta (Letter) o A4.
  - Orientación: Vertical (Portrait) u Horizontal (Landscape).
  - Márgenes configurables: Normal (96px), Estrecho (48px) o Ancho (144px).
  - Numeración automática de páginas al pie.
- **Vistas de Lectura**: Modo paginado visual con separación de hojas o modo continuo sin saltos.

---

### B. Formato de Texto y Tipografía
- **Jerarquía Tipográfica**: Encabezado 1 (`H1`), Encabezado 2 (`H2`), Encabezado 3 (`H3`), Párrafo normal y Texto pequeño.
- **Estilos de Fuente**: Negrita (`Ctrl+B`), Cursiva (`Ctrl+I`), Subrayado (`Ctrl+U`), Tachado.
- **Colores y Resaltado**: Paleta completa de colores de texto y color de marcador para fondo de texto.
- **Alineación**: Alineación izquierda, centrada, derecha y justificada.
- **Interlineado**: Espaciado simple (1.0), 1.15, 1.5 y doble (2.0).

---

### C. Listas, Citas y Bloques
- **Listas con Viñetas**: Puntos de lista para enumeración no ordenada.
- **Listas Numeradas**: Secuencias numéricas automáticas.
- **Listas de Tareas (Checklists)**: Casillas de verificación interactivas para seguimiento de actividades pendientes.
- **Citas en Bloque (Blockquotes)**: Bloques estilizados con barra lateral de acento para destacar frases o notas clave.
- **Separadores Horizontales**: Líneas divisorias temáticas entre secciones del documento.

---

### D. Tablas en Documentos
- Inserción de tablas con número de filas y columnas personalizado.
- Edición de texto y formateo dentro de cada celda.
- Gestión de estructura de celdas y cabeceras.

---

### E. Medios y Enlace con Pizarrón
- **Imágenes**: Inserción de imágenes con ajuste de alineación y pie de foto.
- **Enviar a Pizarrón**: Convierte automáticamente cada página del documento en tarjetas visuales organizadas sobre un nuevo pizarrón infinito interactivo.

---

### F. Exportación de Documentos
- **Documento PDF (`.pdf`)**: Formato estándar de alta fidelidad listo para imprimir o enviar.
- **Microsoft Word (`.doc`)**: Documento compatible con suites ofimáticas (Word, LibreOffice, Google Docs).
- **Markdown (`.md`)**: Archivo en sintaxis Markdown limpia para repositorios, GitHub y documentación de código.
- **Texto Plano (`.txt`)**: Extracción de texto puro sin formato.
- **Página Web (`.html`)**: Documento web autosuficiente con estilos CSS embebidos.
- **Proyecto Spriteboard (`.json`)**: Archivo estructurado con todas las páginas y configuraciones del documento.

---

## 3. Resumen Rápido de Atajos de Teclado Globales

| Atajo | Acción en Pizarrón (`board`) | Acción en Documento (`doc`) |
| :--- | :--- | :--- |
| `V` | Herramienta Selección | - |
| `H` o `Espacio` | Herramienta Mano / Paneo | - |
| `P` | Herramienta Bolígrafo / Pluma | - |
| `M` | Herramienta Marcador | - |
| `R` | Herramienta Resaltador | - |
| `E` | Herramienta Borrador | - |
| `S` | Submenú de Figuras | - |
| `C` | Herramienta Conectores | - |
| `N` | Insertar Nota Adhesiva | - |
| `T` | Insertar Texto | - |
| `X` | Herramienta Pixel Art Studio | - |
| `Tab` | Crear nodo hijo en mapa mental | Sangría de texto / Siguiente celda |
| `Enter` | Crear nodo hermano en mapa mental | Nuevo párrafo |
| `Escape` | Deseleccionar elementos / Cerrar paneles | Cerrar paneles / modales |
| `Rueda del mouse` | Desplazamiento vertical (Scroll / Paneo) | Desplazamiento vertical por las páginas |
| `Ctrl + Rueda del mouse` | Zoom In / Zoom Out centrado en el puntero | Zoom In / Zoom Out del documento |
| `Shift + Rueda del mouse` | Desplazamiento horizontal (Scroll X) | - |
| `Ctrl + Z` | Deshacer última acción | Deshacer edición |
| `Ctrl + Y` | Rehacer última acción | Rehacer edición |
| `Ctrl + D` | Duplicar elementos seleccionados | - |
| `Ctrl + B` | - | Texto en Negrita |
| `Ctrl + I` | - | Texto en Cursiva |
| `Ctrl + U` | - | Texto Subrayado |
| `Delete` / `Backspace` | Eliminar elementos seleccionados | Borrar caracter / selección |
