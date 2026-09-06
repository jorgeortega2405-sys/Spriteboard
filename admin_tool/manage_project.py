import argparse
import json
import os
import re
import sys
import time
import urllib.error
import urllib.request
import xml.etree.ElementTree as ET
from pathlib import Path
from typing import Dict, List, Set, Tuple

BASE_DIR = Path(__file__).resolve().parent.parent
ADMIN_TOOL_DIR = BASE_DIR / "admin_tool"
CACHE_DIR = ADMIN_TOOL_DIR / "cache" / "icons"
DEFAULT_OUTPUT_SVG = BASE_DIR / "public" / "icons.svg"
DEFAULT_MANIFEST = ADMIN_TOOL_DIR / "icons_manifest.json"

GOOGLE_FONTS_SVG_URL = "https://fonts.gstatic.com/s/i/short-term/release/materialsymbolsrounded/{icon}/default/24px.svg"
GITHUB_RAW_SVG_URL = "https://raw.githubusercontent.com/google/material-design-icons/master/symbols/web/{icon}/materialsymbolsrounded/{icon}_24px.svg"

SCAN_EXTENSIONS = {".html", ".ts", ".js", ".css"}
EXCLUDED_DIRS = {
    "node_modules",
    ".git",
    "dist",
    "logs",
    "admin_tool",
    "cache",
    "data",
    ".agents",
}

KNOWN_DYNAMIC_ICONS = {
    "visibility",
    "visibility_off",
    "check_circle",
    "error",
    "error_outline",
    "warning",
    "info",
    "lock",
    "lock_open",
    "refresh",
    "send",
    "history",
    "support_agent",
    "search",
    "menu",
    "close",
    "add",
    "delete",
    "delete_outline",
    "workspace_premium",
    "settings",
    "help",
    "logout",
    "navigate_next",
    "arrow_back",
    "arrow_upward",
    "tune",
    "gavel",
    "shield",
    "cookie",
    "balance",
    "payments",
    "devices",
    "receipt_long",
    "content_copy",
    "key",
    "qr_code_scanner",
    "verified_user",
    "cloud",
    "credit_card",
    "photo_camera",
    "language",
    "expand_more",
    "person",
    "home",
}

ICON_PATTERNS = [
    re.compile(
        r'<use[^>]*href=[\'"][^\'"]*#([a-zA-Z0-9_]+)[\'"]',
        re.IGNORECASE,
    ),
    re.compile(
        r'<span[^>]*class=[\'"][^\'"]*\bcomponent-icon\b[^\'"]*[\'"][^>]*>\s*([a-zA-Z0-9_]+)\s*</span>',
        re.IGNORECASE,
    ),
    re.compile(
        r'class=[\'"][^\'"]*\bcomponent-icon\b[^\'"]*[\'"][^>]*>\s*([a-zA-Z0-9_]+)\s*<',
        re.IGNORECASE,
    ),
    re.compile(
        r'<span[^>]*class=[\'"][^\'"]*material-symbols-rounded[^\'"]*[\'"][^>]*>\s*([a-zA-Z0-9_]+)\s*</span>',
        re.IGNORECASE,
    ),
    re.compile(
        r'class=[\'"][^\'"]*material-symbols-rounded[^\'"]*[\'"][^>]*>\s*([a-zA-Z0-9_]+)\s*<',
        re.IGNORECASE,
    ),
    re.compile(r'iconName\s*=\s*[\'"]([a-zA-Z0-9_]+)[\'"]'),
    re.compile(r'feat\.icon\s*\|\|\s*[\'"]([a-zA-Z0-9_]+)[\'"]'),
    re.compile(r'data-icon=[\'"]([a-zA-Z0-9_]+)[\'"]'),
    re.compile(r'createIconSvg\([\'"]([a-zA-Z0-9_]+)[\'"]'),
]


def scan_codebase_for_icons(root_dir: Path) -> Set[str]:
    found_icons: Set[str] = set()

    for dirpath, dirnames, filenames in os.walk(root_dir):
        dirnames[:] = [d for d in dirnames if d not in EXCLUDED_DIRS]
        for filename in filenames:
            file_path = Path(dirpath) / filename
            if file_path.suffix.lower() not in SCAN_EXTENSIONS:
                continue

            try:
                content = file_path.read_text(encoding="utf-8", errors="ignore")
            except Exception:
                continue

            for pattern in ICON_PATTERNS:
                for match in pattern.findall(content):
                    cleaned = match.strip().lower()
                    if cleaned and re.match(r"^[a-z0-9_]+$", cleaned):
                        found_icons.add(cleaned)

    found_icons.update(KNOWN_DYNAMIC_ICONS)
    return found_icons


def download_icon_svg(icon_name: str, cache_dir: Path, force: bool = False) -> Tuple[bool, str]:
    cache_dir.mkdir(parents=True, exist_ok=True)
    cached_file = cache_dir / f"{icon_name}.svg"

    if cached_file.exists() and not force:
        try:
            content = cached_file.read_text(encoding="utf-8")
            if content.strip().startswith("<svg"):
                return True, content
        except Exception:
            pass

    urls = [
        GOOGLE_FONTS_SVG_URL.format(icon=icon_name),
        GITHUB_RAW_SVG_URL.format(icon=icon_name),
    ]

    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) SpriteboardIconManager/1.0",
        "Accept": "image/svg+xml,text/plain,*/*",
    }

    for url in urls:
        try:
            req = urllib.request.Request(url, headers=headers)
            with urllib.request.urlopen(req, timeout=10) as response:
                if response.status == 200:
                    raw_svg = response.read().decode("utf-8")
                    if "<svg" in raw_svg and "</svg>" in raw_svg:
                        cached_file.write_text(raw_svg, encoding="utf-8")
                        return True, raw_svg
        except (urllib.error.HTTPError, urllib.error.URLError, TimeoutError):
            continue

    return False, ""


ET.register_namespace("", "http://www.w3.org/2000/svg")


def extract_svg_symbol_content(raw_svg: str, icon_name: str) -> Tuple[str, str]:
    clean_svg = re.sub(r"<\?xml[^>]*\?>", "", raw_svg).strip()

    viewbox_match = re.search(r'viewBox=[\'"]([^\'"]+)[\'"]', clean_svg, re.IGNORECASE)
    viewbox = viewbox_match.group(1) if viewbox_match else "0 -960 960 960"

    try:
        root = ET.fromstring(clean_svg)
        inner_elements: List[str] = []
        for child in root:
            tag = child.tag.split("}")[-1]
            if tag in {"path", "circle", "rect", "g", "polygon", "polyline"}:
                if "fill" in child.attrib:
                    del child.attrib["fill"]
                raw_child = ET.tostring(child, encoding="unicode").strip()
                raw_child = re.sub(r"</?ns\d+:", lambda m: "<" if not m.group(0).startswith("</") else "</", raw_child)
                raw_child = re.sub(r"\s*xmlns(:[a-zA-Z0-9]+)?=[\"'][^\"']*[\"']", "", raw_child)
                inner_elements.append(raw_child)
        if inner_elements:
            return viewbox, "\n    ".join(inner_elements)
    except ET.ParseError:
        pass

    paths = re.findall(r"<path[^>]*>", clean_svg, re.IGNORECASE)
    cleaned_paths: List[str] = []
    for p in paths:
        p_clean = re.sub(r"\s*fill=[\"'][^\"']*[\"']", "", p)
        p_clean = re.sub(r"\s*xmlns(:[a-zA-Z0-9]+)?=[\"'][^\"']*[\"']", "", p_clean)
        p_clean = re.sub(r"</?ns\d+:", lambda m: "<" if not m.group(0).startswith("</") else "</", p_clean)
        cleaned_paths.append(p_clean)

    return viewbox, "\n    ".join(cleaned_paths)


def bundle_icons_to_svg(
    icons: List[str],
    cache_dir: Path,
    output_path: Path,
    force: bool = False,
) -> Dict[str, any]:
    results = {
        "total_requested": len(icons),
        "downloaded": 0,
        "from_cache": 0,
        "failed": [],
        "bundled_icons": [],
        "output_path": str(output_path),
    }

    symbols: List[str] = []

    for icon in sorted(icons):
        cached_file = cache_dir / f"{icon}.svg"
        was_cached = cached_file.exists() and not force

        success, raw_svg = download_icon_svg(icon, cache_dir, force=force)
        if not success:
            results["failed"].append(icon)
            print(f"  [ERROR] No se pudo descargar el icono: '{icon}'")
            continue

        if was_cached:
            results["from_cache"] += 1
        else:
            results["downloaded"] += 1
            print(f"  [OK] Descargado: '{icon}'")

        viewbox, inner_content = extract_svg_symbol_content(raw_svg, icon)
        symbol_block = f'  <symbol id="{icon}" viewBox="{viewbox}">\n    {inner_content}\n  </symbol>'
        symbols.append(symbol_block)
        results["bundled_icons"].append(icon)

    svg_content = [
        '<svg xmlns="http://www.w3.org/2000/svg" style="display: none;" data-spriteboard-icons="true">',
        "  <defs>",
        *symbols,
        "  </defs>",
        "</svg>",
        "",
    ]

    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text("\n".join(svg_content), encoding="utf-8")

    results["file_size_bytes"] = output_path.stat().st_size
    return results


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Spriteboard Icon Bundler: Escanea, descarga de Google y unifica iconos Material Symbols en un único SVG optimizado."
    )
    parser.add_argument(
        "--scan",
        action="store_true",
        help="Solo escanea y lista los iconos encontrados en el proyecto sin descargar.",
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="Fuerza la re-descarga de todos los iconos omitiendo el caché local.",
    )
    parser.add_argument(
        "--add",
        nargs="+",
        default=[],
        help="Nombres de iconos adicionales a incluir explícitamente.",
    )
    parser.add_argument(
        "--output",
        type=str,
        default=str(DEFAULT_OUTPUT_SVG),
        help=f"Ruta del archivo SVG unificado de salida (por defecto: {DEFAULT_OUTPUT_SVG}).",
    )

    args = parser.parse_args()
    output_path = Path(args.output).resolve()

    print("====================================================================")
    print(" SPRITEBOARD: MATERIAL SYMBOLS SVG BUNDLER & OPTIMIZER")
    print("====================================================================")
    print(f"Directorios analizados: {BASE_DIR}")
    print("Escaneando archivos del proyecto en busca de iconos...")

    scanned_icons = scan_codebase_for_icons(BASE_DIR)
    if args.add:
        for extra in args.add:
            scanned_icons.add(extra.strip().lower())

    icon_list = sorted(list(scanned_icons))
    print(f"Total de iconos detectados: {len(icon_list)}")

    if args.scan:
        print("\nIconos encontrados:")
        for idx, ic in enumerate(icon_list, start=1):
            print(f"  {idx:2d}. {ic}")
        return 0

    print(f"\nProcesando y empaquetando iconos en: {output_path}...")
    start_time = time.time()
    summary = bundle_icons_to_svg(icon_list, CACHE_DIR, output_path, force=args.force)
    elapsed = time.time() - start_time

    manifest_data = {
        "generated_at": time.strftime("%Y-%m-%d %H:%M:%S"),
        "total_icons": len(summary["bundled_icons"]),
        "file_size_bytes": summary.get("file_size_bytes", 0),
        "output_file": str(output_path),
        "icons": summary["bundled_icons"],
    }
    DEFAULT_MANIFEST.parent.mkdir(parents=True, exist_ok=True)
    DEFAULT_MANIFEST.write_text(json.dumps(manifest_data, indent=2), encoding="utf-8")

    size_kb = summary.get("file_size_bytes", 0) / 1024
    print("--------------------------------------------------------------------")
    print(" EMPAQUETADO COMPLETADO EXITOSAMENTE")
    print("--------------------------------------------------------------------")
    print(f"  Iconos incluidos:    {len(summary['bundled_icons'])} / {summary['total_requested']}")
    print(f"  Desde cache local:   {summary['from_cache']}")
    print(f"  Descargados de red:  {summary['downloaded']}")
    print(f"  Errores de descarga: {len(summary['failed'])}")
    print(f"  Archivo generado:    {output_path} ({size_kb:.2f} KB)")
    print(f"  Manifiesto guardado: {DEFAULT_MANIFEST}")
    print(f"  Tiempo transcurrido: {elapsed:.2f} segundos")
    print("====================================================================")

    return 0 if not summary["failed"] else 1


if __name__ == "__main__":
    sys.exit(main())
