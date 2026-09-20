# Modelos 3D Personalizados de Spriteboard

Coloca tus archivos de modelos 3D en formato .obj en este directorio (public/models/3d/).
El motor del pizarrón los cargará, centrará y escalará automáticamente.

## Nombres de Archivo Estándar

| Archivo | Figura en el Pizarrón |
|---|---|
| globe.obj | 🌍 Globo Terráqueo |
| rocket.obj | 🚀 Cohete Espacial |
| diamond.obj | 💎 Diamante |
| robot.obj | 🤖 Robot Futurista |
| car.obj | 🚗 Auto Deportivo |
| star.obj | ⭐ Estrella 3D |
| heart.obj | 💖 Corazón Esculpido |
| house.obj | 🏠 Casa 3D |
| tree.obj | 🌲 Árbol 3D |
| book.obj | 📖 Libro de Tapa Dura |
| cube.obj | 📦 Cubo |
| pyramid.obj | 🔺 Pirámide |
| cylinder.obj | 🥫 Cilindro |
| sphere.obj | 🔮 Esfera |
| torus.obj | 🍩 Toroide |

## Características Soportadas

1. Auto-Escalado y Centrado: Cualquier modelo es normalizado y centrado en el origen (0,0,0) automáticamente.
2. Colores por Vértice: Soporta líneas con colores 'v x y z r g b' (utilizado por MagicaVoxel, PolyPizza, etc.).
3. Materiales: Soporta 'usemtl [nombre]' con detección inteligente de colores, códigos hexadecimales (ej. 'usemtl #3b82f6') y reflejos metálicos.
4. Respaldo Automático: Si un archivo .obj no está presente en la carpeta, se utilizará el modelo procedimental de respaldo sin dar error.

## Sitios Recomendados para Descargar Modelos Gratis (.obj)

- Poly Pizza: https://poly.pizza/ (Modelos animados y Pixar en formato .obj)
- Kenney 3D Assets: https://kenney.nl/assets/category:3D
- Sketchfab: https://sketchfab.com/ (Filtro Free / Descargable)
- Free3D: https://free3d.com/
