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
from typing import Any, Dict, List, Optional, Set, Tuple

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

BASE_DIR = Path(__file__).resolve().parent.parent
ADMIN_TOOL_DIR = BASE_DIR / "admin_tool"
CACHE_DIR = ADMIN_TOOL_DIR / "cache" / "icons"
REPORTS_DIR = ADMIN_TOOL_DIR / "reports"
DEFAULT_OUTPUT_SVG = BASE_DIR / "public" / "icons.svg"
DEFAULT_MANIFEST = ADMIN_TOOL_DIR / "icons_manifest.json"
TRANSLATIONS_DIR = BASE_DIR / "public" / "translations"

GOOGLE_FONTS_SVG_URL = "https://fonts.gstatic.com/s/i/short-term/release/materialsymbolsrounded/{icon}/default/24px.svg"
GITHUB_RAW_SVG_URL = "https://raw.githubusercontent.com/google/material-design-icons/master/symbols/web/{icon}/materialsymbolsrounded/{icon}_24px.svg"

EXCLUDED_DIRS = {
    "node_modules",
    ".git",
    "dist",
    "logs",
    "admin_tool/cache",
    "admin_tool/reports",
    "reports",
    "cache",
    "data",
    ".agents",
}

CODE_EXTENSIONS = {".ts", ".js", ".mjs", ".cjs", ".tsx", ".jsx", ".html"}
HTML_EXTENSIONS = {".html"}
PYTHON_EXTENSIONS = {".py"}

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
    "shopping_cart",
    "business_center",
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
    "star_fill",
    "chat_bubble_outline",
    "add_comment",
    "add_reaction",
    "alternate_email",
    "sticky_note_2",
    "add_photo_alternate",
    "format_bold",
    "schedule",
    "mood",
    "pets",
    "restaurant",
    "directions_car",
    "sports_soccer",
    "lightbulb",
    "favorite",
    "flag",
}

ICON_PATTERNS = [
    re.compile(r'<use[^>]*href=[\'"][^\'"]*#([a-zA-Z0-9_]+)[\'"]', re.IGNORECASE),
    re.compile(r'<span[^>]*class=[\'"][^\'"]*\bcomponent-icon\b[^\'"]*[\'"][^>]*>\s*([a-zA-Z0-9_]+)\s*</span>', re.IGNORECASE),
    re.compile(r'class=[\'"][^\'"]*\bcomponent-icon\b[^\'"]*[\'"][^>]*>\s*([a-zA-Z0-9_]+)\s*<', re.IGNORECASE),
    re.compile(r'<span[^>]*class=[\'"][^\'"]*material-symbols-rounded[^\'"]*[\'"][^>]*>\s*([a-zA-Z0-9_]+)\s*</span>', re.IGNORECASE),
    re.compile(r'class=[\'"][^\'"]*material-symbols-rounded[^\'"]*[\'"][^>]*>\s*([a-zA-Z0-9_]+)\s*<', re.IGNORECASE),
    re.compile(r'iconName\s*=\s*[\'"]([a-zA-Z0-9_]+)[\'"]'),
    re.compile(r'feat\.icon\s*\|\|\s*[\'"]([a-zA-Z0-9_]+)[\'"]'),
    re.compile(r'data-icon=[\'"]([a-zA-Z0-9_]+)[\'"]'),
    re.compile(r'createIconSvg\([\'"]([a-zA-Z0-9_]+)[\'"]'),
    re.compile(r'\bicon:\s*[\'"]([a-zA-Z0-9_]+)[\'"]'),
]


def is_path_excluded(path: Path) -> bool:
    rel_str = str(path.relative_to(BASE_DIR)).replace("\\", "/")
    for exc in EXCLUDED_DIRS:
        if exc in rel_str.split("/"):
            return True
    return False


def get_files_by_extensions(root_dir: Path, extensions: Set[str]) -> List[Path]:
    matched_files: List[Path] = []
    for dirpath, dirnames, filenames in os.walk(root_dir):
        dirnames[:] = [d for d in dirnames if d not in EXCLUDED_DIRS]
        for filename in filenames:
            file_path = Path(dirpath) / filename
            if not is_path_excluded(file_path) and file_path.suffix.lower() in extensions:
                matched_files.append(file_path)
    return sorted(matched_files)


def save_markdown_report(
    prefix: str,
    title: str,
    summary_items: List[Tuple[str, str]],
    detail_sections: List[Tuple[str, List[str]]],
) -> Path:
    REPORTS_DIR.mkdir(parents=True, exist_ok=True)
    timestamp = time.strftime("%Y%m%d_%H%M%S")
    filename = f"{prefix}_{timestamp}.md"
    file_path = REPORTS_DIR / filename

    lines = [
        f"# Spriteboard Audit Report: {title}",
        "",
        f"- **Timestamp**: {time.strftime('%Y-%m-%d %H:%M:%S')}",
        f"- **Workspace Directory**: `{BASE_DIR}`",
        f"- **Generated File**: `{file_path.name}`",
        "",
        "## 1. Executive Summary",
        "",
    ]

    for key, val in summary_items:
        lines.append(f"- **{key}**: {val}")

    lines.append("")
    lines.append("## 2. Detailed Findings")
    lines.append("")

    for section_title, section_lines in detail_sections:
        lines.append(f"### {section_title}")
        lines.append("")
        if not section_lines:
            lines.append("*(No violations found in this section)*")
        else:
            lines.extend(section_lines)
        lines.append("")

    file_path.write_text("\n".join(lines), encoding="utf-8")
    print(f"\n[REPORT SAVED] -> {file_path}")
    return file_path


def scan_codebase_for_icons(root_dir: Path) -> Set[str]:
    found_icons: Set[str] = set()
    files = get_files_by_extensions(root_dir, {".html", ".ts", ".js", ".css"})

    for file_path in files:
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

    urls = []
    if icon_name.endswith("_fill"):
        base_name = icon_name[:-5]
        urls.append(f"https://fonts.gstatic.com/s/i/short-term/release/materialsymbolsrounded/{base_name}/fill1/24px.svg")

    urls.extend([
        GOOGLE_FONTS_SVG_URL.format(icon=icon_name),
        GITHUB_RAW_SVG_URL.format(icon=icon_name),
    ])

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
) -> Dict[str, Any]:
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
            print(f"  [ERROR] Could not download icon: '{icon}'")
            continue

        if was_cached:
            results["from_cache"] += 1
        else:
            results["downloaded"] += 1
            print(f"  [OK] Downloaded: '{icon}'")

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


def run_icon_bundler(scan_only: bool = False, force: bool = False, extra_icons: Optional[List[str]] = None, output_file: Optional[str] = None) -> int:
    output_path = Path(output_file).resolve() if output_file else DEFAULT_OUTPUT_SVG
    print("====================================================================")
    print(" SPRITEBOARD: MATERIAL SYMBOLS SVG BUNDLER & OPTIMIZER")
    print("====================================================================")
    print(f"Target workspace: {BASE_DIR}")
    print("Scanning codebase for Material Symbol icon references...")

    scanned_icons = scan_codebase_for_icons(BASE_DIR)
    if extra_icons:
        for extra in extra_icons:
            scanned_icons.add(extra.strip().lower())

    icon_list = sorted(list(scanned_icons))
    print(f"Total detected icons: {len(icon_list)}")

    if scan_only:
        print("\nDiscovered icons:")
        for idx, ic in enumerate(icon_list, start=1):
            print(f"  {idx:2d}. {ic}")
        return 0

    print(f"\nProcessing and packaging icons into: {output_path}...")
    start_time = time.time()
    summary = bundle_icons_to_svg(icon_list, CACHE_DIR, output_path, force=force)
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
    print(" ICON BUNDLING COMPLETED")
    print("--------------------------------------------------------------------")
    print(f"  Bundled icons:       {len(summary['bundled_icons'])} / {summary['total_requested']}")
    print(f"  Loaded from cache:   {summary['from_cache']}")
    print(f"  Downloaded:          {summary['downloaded']}")
    print(f"  Download errors:     {len(summary['failed'])}")
    print(f"  Generated SVG file:  {output_path} ({size_kb:.2f} KB)")
    print(f"  Manifest file:       {DEFAULT_MANIFEST}")
    print(f"  Elapsed time:        {elapsed:.2f}s")
    print("====================================================================")
    return 0 if not summary["failed"] else 1


def audit_inline_styles(root_dir: Path) -> int:
    print("====================================================================")
    print(" AUDIT: HARDCODED INLINE STYLES")
    print("====================================================================")
    print(f"Scanning files in: {root_dir}")

    files = get_files_by_extensions(root_dir, CODE_EXTENSIONS)
    style_regex = re.compile(r'''(?P<prefix><[a-zA-Z0-9\-]+[^>]*?\sstyle\s*=\s*["'])(?P<style>[^"']+)(?P<suffix>["'])''', re.IGNORECASE)

    total_violations = 0
    affected_files: Dict[str, List[Tuple[int, str, str]]] = {}

    for file_path in files:
        try:
            lines = file_path.read_text(encoding="utf-8", errors="ignore").splitlines()
        except Exception:
            continue

        rel_path = str(file_path.relative_to(root_dir)).replace("\\", "/")
        file_violations = []

        for line_idx, line in enumerate(lines, start=1):
            if "data-spriteboard-icons" in line or "<!--" in line:
                continue

            matches = style_regex.finditer(line)
            for m in matches:
                style_value = m.group("style").strip()
                tag_preview = line.strip()
                file_violations.append((line_idx, style_value, tag_preview))

        if file_violations:
            affected_files[rel_path] = file_violations
            total_violations += len(file_violations)

    detail_sections: List[Tuple[str, List[str]]] = []
    for file_rel, violations in affected_files.items():
        sec_lines = []
        for line_num, style_val, tag_snippet in violations:
            sec_lines.append(f"- **Line {line_num}**: `style=\"{style_val}\"`")
            sec_lines.append(f"  ```html\n  {tag_snippet}\n  ```")
        detail_sections.append((f"File: `{file_rel}` ({len(violations)} occurrences)", sec_lines))

    summary_items = [
        ("Audit Status", "PASSED" if total_violations == 0 else "ACTION REQUIRED"),
        ("Total Inline Style Violations", str(total_violations)),
        ("Total Affected Files", str(len(affected_files))),
        ("Recommendation", "Replace inline styles with modular BEM CSS classes in public/css/."),
    ]

    save_markdown_report("audit_styles", "Hardcoded Inline Styles", summary_items, detail_sections)

    if not affected_files:
        print("\n[PASSED] Zero hardcoded inline styles found in codebase.")
        print("====================================================================")
        return 0

    print(f"\n[WARNING] Found {total_violations} inline style occurrence(s) in {len(affected_files)} file(s).")
    print(f"Summary: {total_violations} inline style(s) detected across {len(affected_files)} file(s).")
    print("Recommendation: Move inline styles to modular BEM CSS classes.")
    print("====================================================================")
    return 1


def flatten_json_keys(data: Any, prefix: str = "") -> Set[str]:
    keys = set()
    if isinstance(data, dict):
        for k, v in data.items():
            full_key = f"{prefix}.{k}" if prefix else k
            if isinstance(v, dict):
                keys.update(flatten_json_keys(v, full_key))
            else:
                keys.add(full_key)
    return keys


def audit_translations(root_dir: Path) -> int:
    print("====================================================================")
    print(" AUDIT: HARDCODED TEXTS, I18N KEYS & NON-I18N LANGUAGE RULES")
    print("====================================================================")
    print(f"Analyzing translations and language constraints in: {root_dir}")

    total_issues = 0

    es_file = TRANSLATIONS_DIR / "es-419.json"
    en_file = TRANSLATIONS_DIR / "en-US.json"
    es_keys: Set[str] = set()
    en_keys: Set[str] = set()

    if es_file.exists():
        try:
            es_keys = flatten_json_keys(json.loads(es_file.read_text(encoding="utf-8")))
        except Exception:
            pass

    if en_file.exists():
        try:
            en_keys = flatten_json_keys(json.loads(en_file.read_text(encoding="utf-8")))
        except Exception:
            pass

    print("\n--- 1. Translation Dictionaries Integrity ---")
    missing_in_en = es_keys - en_keys
    missing_in_es = en_keys - es_keys

    dict_report_lines: List[str] = []
    if not missing_in_en and not missing_in_es:
        print(f"  [OK] Both language dictionaries are in sync ({len(es_keys)} keys).")
        dict_report_lines.append(f"- Both dictionaries are fully synchronized ({len(es_keys)} keys).")
    else:
        if missing_in_en:
            print(f"  [ERROR] {len(missing_in_en)} key(s) present in es-419.json but missing in en-US.json:")
            dict_report_lines.append(f"#### Missing in `en-US.json` ({len(missing_in_en)} keys):")
            for k in sorted(list(missing_in_en)):
                dict_report_lines.append(f"- `{k}`")
            for k in sorted(list(missing_in_en))[:10]:
                print(f"    - {k}")
            if len(missing_in_en) > 10:
                print(f"    ... and {len(missing_in_en) - 10} more.")
            total_issues += len(missing_in_en)

        if missing_in_es:
            print(f"  [ERROR] {len(missing_in_es)} key(s) present in en-US.json but missing in es-419.json:")
            dict_report_lines.append(f"#### Missing in `es-419.json` ({len(missing_in_es)} keys):")
            for k in sorted(list(missing_in_es)):
                dict_report_lines.append(f"- `{k}`")
            for k in sorted(list(missing_in_es))[:10]:
                print(f"    - {k}")
            if len(missing_in_es) > 10:
                print(f"    ... and {len(missing_in_es) - 10} more.")
            total_issues += len(missing_in_es)

    print("\n--- 2. Frontend UI Templates (public/views/ and client components) ---")
    html_files = get_files_by_extensions(root_dir / "public" / "views", HTML_EXTENSIONS)
    extra_html = get_files_by_extensions(root_dir / "desktop" / "src", HTML_EXTENSIONS)
    html_files.extend(extra_html)

    tag_text_regex = re.compile(r'<(?P<tag>[a-zA-Z0-9\-]+)(?P<attrs>[^>]*)>(?P<text>[^<]+)</(?P=tag)>')
    attr_placeholder_regex = re.compile(r'\bplaceholder=[\'"]([^\'"]+)[\'"]')
    attr_aria_regex = re.compile(r'\baria-label=[\'"]([^\'"]+)[\'"]')
    attr_title_regex = re.compile(r'\btitle=[\'"]([^\'"]+)[\'"]')
    attr_tooltip_regex = re.compile(r'\bdata-tooltip=[\'"]([^\'"]+)[\'"]')

    ignored_tags = {"script", "style", "code", "pre", "svg", "symbol", "defs"}
    icon_classes = {"material-symbols-rounded", "component-icon", "google-icon"}

    frontend_violations: List[str] = []
    frontend_report_lines: List[str] = []

    for file_path in html_files:
        try:
            lines = file_path.read_text(encoding="utf-8", errors="ignore").splitlines()
        except Exception:
            continue

        rel_path = str(file_path.relative_to(root_dir)).replace("\\", "/")

        for line_idx, line in enumerate(lines, start=1):
            if "<!--" in line:
                continue

            for m in tag_text_regex.finditer(line):
                tag_name = m.group("tag").lower()
                attrs = m.group("attrs")
                raw_text = m.group("text").strip()

                if tag_name in ignored_tags or not raw_text:
                    continue

                if any(cls in attrs for cls in icon_classes):
                    continue

                if re.match(r"^(&[a-zA-Z0-9#]+;|\d+|[\$\%\#\/\-\|\:\.\,\s\*\+]+)$", raw_text):
                    continue

                if "data-i18n" not in attrs and "data-i18n-html" not in attrs:
                    msg = f"`{rel_path}:{line_idx}` | Tag `<{tag_name}>` has untranslated text: `{raw_text}` (missing `data-i18n`)"
                    frontend_violations.append(msg)
                    frontend_report_lines.append(f"- {msg}")
                elif "data-i18n" in attrs and raw_text:
                    msg = f"`{rel_path}:{line_idx}` | Tag `<{tag_name}>` has both `data-i18n` and hardcoded text: `{raw_text}`"
                    frontend_violations.append(msg)
                    frontend_report_lines.append(f"- {msg}")

            placeholder_match = attr_placeholder_regex.search(line)
            if placeholder_match:
                val = placeholder_match.group(1).strip()
                if val and "data-i18n-placeholder" not in line:
                    msg = f"`{rel_path}:{line_idx}` | Hardcoded `placeholder=\"{val}\"` without `data-i18n-placeholder`"
                    frontend_violations.append(msg)
                    frontend_report_lines.append(f"- {msg}")

            aria_match = attr_aria_regex.search(line)
            if aria_match:
                val = aria_match.group(1).strip()
                if val and "data-i18n-aria" not in line:
                    msg = f"`{rel_path}:{line_idx}` | Hardcoded `aria-label=\"{val}\"` without `data-i18n-aria`"
                    frontend_violations.append(msg)
                    frontend_report_lines.append(f"- {msg}")

            title_match = attr_title_regex.search(line)
            if title_match:
                val = title_match.group(1).strip()
                if val and "data-i18n-title" not in line:
                    msg = f"`{rel_path}:{line_idx}` | Hardcoded `title=\"{val}\"` without `data-i18n-title`"
                    frontend_violations.append(msg)
                    frontend_report_lines.append(f"- {msg}")

            tooltip_match = attr_tooltip_regex.search(line)
            if tooltip_match:
                val = tooltip_match.group(1).strip()
                if val and "data-i18n-tooltip" not in line:
                    msg = f"`{rel_path}:{line_idx}` | Hardcoded `data-tooltip=\"{val}\"` without `data-i18n-tooltip`"
                    frontend_violations.append(msg)
                    frontend_report_lines.append(f"- {msg}")

    if not frontend_violations:
        print("  [OK] No untranslated UI elements or hardcoded attributes found.")
    else:
        print(f"  [WARNING] Found {len(frontend_violations)} untranslated UI element(s):")
        for v in frontend_violations[:20]:
            print(f"  {v}")
        if len(frontend_violations) > 20:
            print(f"  ... and {len(frontend_violations) - 20} more.")
        total_issues += len(frontend_violations)

    print("\n--- 3. Non-i18n Files (Backend / Python / Scripts / Tools English-Only Rule) ---")
    non_i18n_files: List[Path] = []
    for d in [root_dir / "src", root_dir / "admin_tool", root_dir / "scripts", root_dir / "worker", root_dir / "websocket", root_dir / "admin" / "scripts"]:
        if d.exists():
            non_i18n_files.extend(get_files_by_extensions(d, {".ts", ".js", ".py"}))

    spanish_char_regex = re.compile(r'[áéíóúÁÉÍÓÚñÑ¿¡]')
    spanish_keywords_regex = re.compile(
        r'\b(iniciar|sesion|contrase[nñ]a|guardar|eliminar|editar|crear|usuario|usuarios|correo|archivo|archivos|servidor|base de datos|registro|registros|exito|exitosamente|fallido|error al|no se pudo|descargando|procesando|completado|tiempo transcurrido|segundos|minutos|horas|cancelar|aceptar|volver|siguiente|anterior|configuracion|notificacion|notificaciones|tabla|tablas|columna|columnas|permiso|permisos|rol|roles|verificacion|instantanea|copia de seguridad|respaldo|respaldos|preparacion|entorno)\b',
        re.IGNORECASE,
    )

    non_i18n_violations: List[str] = []
    non_i18n_report_lines: List[str] = []

    for file_path in non_i18n_files:
        rel_path = str(file_path.relative_to(root_dir)).replace("\\", "/")
        if "translations" in rel_path or "email-templates.json" in rel_path:
            continue

        try:
            lines = file_path.read_text(encoding="utf-8", errors="ignore").splitlines()
        except Exception:
            continue

        for line_idx, line in enumerate(lines, start=1):
            stripped = line.strip()
            if not stripped:
                continue

            if "es-419" in line or "es-ES" in line or "spanish" in line.lower() or "Spanish" in line:
                continue

            has_accent = bool(spanish_char_regex.search(line))
            kw_match = spanish_keywords_regex.search(line)

            if has_accent or kw_match:
                snippet = stripped if len(stripped) <= 90 else stripped[:87] + "..."
                matched_reason = "Spanish accents" if has_accent else f"Spanish keyword '{kw_match.group(0)}'"
                msg = f"`{rel_path}:{line_idx}` | [{matched_reason}] -> `{snippet}`"
                non_i18n_violations.append(msg)
                non_i18n_report_lines.append(f"- {msg}")

    if not non_i18n_violations:
        print("  [OK] Backend, Python and script files adhere to the English-only rule.")
    else:
        print(f"  [WARNING] Found {len(non_i18n_violations)} Spanish text violation(s) in non-i18n files:")
        for v in non_i18n_violations[:20]:
            print(f"  {v}")
        if len(non_i18n_violations) > 20:
            print(f"  ... and {len(non_i18n_violations) - 20} more.")
        total_issues += len(non_i18n_violations)

    detail_sections = [
        ("Translation Dictionaries Sync (es-419.json vs en-US.json)", dict_report_lines),
        (f"Frontend UI Templates Untranslated Elements ({len(frontend_violations)})", frontend_report_lines),
        (f"Non-i18n Files Spanish Violations ({len(non_i18n_violations)})", non_i18n_report_lines),
    ]

    summary_items = [
        ("Audit Status", "PASSED" if total_issues == 0 else "ACTION REQUIRED"),
        ("Total Language & i18n Issues", str(total_issues)),
        ("Dictionary Sync Mismatches", str(len(missing_in_en) + len(missing_in_es))),
        ("Frontend Untranslated UI Elements", str(len(frontend_violations))),
        ("Non-i18n Spanish Violations", str(len(non_i18n_violations))),
    ]

    save_markdown_report("audit_i18n", "Hardcoded Texts, i18n & Language Rules", summary_items, detail_sections)

    print("--------------------------------------------------------------------")
    print(f"Total Translation & Language Findings: {total_issues}")
    print("====================================================================")
    return 0 if total_issues == 0 else 1


def audit_console_logs(root_dir: Path) -> int:
    print("====================================================================")
    print(" AUDIT: CONSOLE LOGS & WARNINGS (console.*)")
    print("====================================================================")
    print(f"Scanning codebase for console.* usage in: {root_dir}")

    files = get_files_by_extensions(root_dir, CODE_EXTENSIONS)
    console_regex = re.compile(
        r'\bconsole\.(log|warn|error|info|debug|trace|table|dir|assert|count|time|timeEnd|group|groupEnd)\b\s*\(',
        re.IGNORECASE,
    )

    allowed_exceptions = {
        "client/services/websocket.service.ts",
        "admin/client/services/websocket.service.ts",
    }

    total_violations = 0
    affected_files: Dict[str, List[Tuple[int, str, str]]] = {}

    for file_path in files:
        rel_path = str(file_path.relative_to(root_dir)).replace("\\", "/")
        if rel_path in allowed_exceptions:
            continue

        try:
            content = file_path.read_text(encoding="utf-8", errors="ignore")
        except Exception:
            continue

        clean_content = re.sub(r'/\*.*?\*/', '', content, flags=re.DOTALL)
        lines = clean_content.splitlines()

        file_violations = []
        for line_idx, line in enumerate(lines, start=1):
            trimmed = line.strip()
            if trimmed.startswith("//") or trimmed.startswith("*") or trimmed.startswith("#"):
                continue

            match = console_regex.search(line)
            if match:
                method = match.group(1)
                snippet = trimmed if len(trimmed) <= 100 else trimmed[:97] + "..."
                file_violations.append((line_idx, method, snippet))

        if file_violations:
            affected_files[rel_path] = file_violations
            total_violations += len(file_violations)

    detail_sections: List[Tuple[str, List[str]]] = []
    for file_rel, violations in affected_files.items():
        sec_lines = []
        for line_num, method, snippet in violations:
            sec_lines.append(f"- **Line {line_num}**: `console.{method}` -> `{snippet}`")
        detail_sections.append((f"File: `{file_rel}` ({len(violations)} calls)", sec_lines))

    summary_items = [
        ("Audit Status", "PASSED" if total_violations == 0 else "ACTION REQUIRED"),
        ("Total Forbidden console.* Calls", str(total_violations)),
        ("Total Affected Files", str(len(affected_files))),
        ("Allowed Whitelist", ", ".join(sorted(list(allowed_exceptions)))),
        ("Backend Rule", "Use centralized Logger (logger.app, logger.db, logger.security)."),
        ("Frontend Rule", "Use UI toast/i18n notifications."),
    ]

    save_markdown_report("audit_console", "Console Logs & Warnings (console.*)", summary_items, detail_sections)

    if not affected_files:
        print("\n[PASSED] Zero forbidden console.* calls found in codebase.")
        print(f"Allowed exception respected: {', '.join(allowed_exceptions)}")
        print("====================================================================")
        return 0

    print(f"\n[FAILED] Found {total_violations} forbidden console.* call(s) in {len(affected_files)} file(s):\n")
    for file_rel, violations in affected_files.items():
        print(f"--- File: {file_rel} ({len(violations)} occurrences) ---")
        for line_num, method, snippet in violations:
            print(f"  Line {line_num:4d} | console.{method} -> {snippet}")
        print()

    print("--------------------------------------------------------------------")
    print(f"Summary: {total_violations} violation(s) detected across {len(affected_files)} file(s).")
    print("Reminder: Use centralized Logger in backend and toast/i18n notifications in frontend.")
    print("====================================================================")
    return 1


def run_all_audits(root_dir: Path) -> int:
    print("\n" + "#" * 68)
    print(" SPRITEBOARD COMPREHENSIVE PROJECT HEALTH AUDIT")
    print("#" * 68 + "\n")

    res_styles = audit_inline_styles(root_dir)
    print()
    res_i18n = audit_translations(root_dir)
    print()
    res_console = audit_console_logs(root_dir)

    summary_items = [
        ("1. Hardcoded Inline Styles", "[CLEAN]" if res_styles == 0 else "[ACTION REQUIRED]"),
        ("2. Untranslated Text / i18n Rules", "[CLEAN]" if res_i18n == 0 else "[ACTION REQUIRED]"),
        ("3. Forbidden console.* Calls", "[CLEAN]" if res_console == 0 else "[ACTION REQUIRED]"),
        ("Overall Status", "HEALTHY" if (res_styles == 0 and res_i18n == 0 and res_console == 0) else "ACTION REQUIRED"),
    ]

    detail_sections = [
        ("Auditing Summary Overview", [
            "- Each individual audit module has generated its corresponding detailed report in `admin_tool/reports/`.",
            f"- Inline Styles Status: `{'CLEAN' if res_styles == 0 else 'ACTION REQUIRED'}`",
            f"- Translations & Language Status: `{'CLEAN' if res_i18n == 0 else 'ACTION REQUIRED'}`",
            f"- Console Calls Status: `{'CLEAN' if res_console == 0 else 'ACTION REQUIRED'}`",
        ])
    ]

    save_markdown_report("audit_full_health", "Comprehensive Health Check", summary_items, detail_sections)

    print("\n" + "=" * 68)
    print(" AUDIT SUMMARY REPORT")
    print("=" * 68)
    print(f"  1. Hardcoded Inline Styles:     {'[CLEAN]' if res_styles == 0 else '[ACTION REQUIRED]'}")
    print(f"  2. Untranslated Text / i18n:    {'[CLEAN]' if res_i18n == 0 else '[ACTION REQUIRED]'}")
    print(f"  3. Forbidden console.* Calls:   {'[CLEAN]' if res_console == 0 else '[ACTION REQUIRED]'}")
    print("=" * 68)

    overall_code = 1 if (res_styles != 0 or res_i18n != 0 or res_console != 0) else 0
    return overall_code


def interactive_menu(root_dir: Path) -> int:
    while True:
        print("\n" + "=" * 68)
        print(" SPRITEBOARD PROJECT MANAGEMENT TOOL")
        print("=" * 68)
        print(" 1. Audit Hardcoded Inline Styles")
        print(" 2. Audit Hardcoded Texts & Language Rules (i18n & English-only)")
        print(" 3. Audit Console Logs & Warnings (console.*)")
        print(" 4. Run All Audits (Comprehensive Health Check)")
        print(" 5. Scan Material Icons (Codebase Reference Check)")
        print(" 6. Bundle Material Icons into SVG Sprite")
        print(" 0. Exit")
        print("=" * 68)

        try:
            choice = input(" Select an option [0-6]: ").strip()
        except (KeyboardInterrupt, EOFError):
            print("\nOperation aborted by user.")
            return 0

        if choice == "1":
            audit_inline_styles(root_dir)
        elif choice == "2":
            audit_translations(root_dir)
        elif choice == "3":
            audit_console_logs(root_dir)
        elif choice == "4":
            run_all_audits(root_dir)
        elif choice == "5":
            run_icon_bundler(scan_only=True)
        elif choice == "6":
            run_icon_bundler(scan_only=False)
        elif choice == "0":
            print("Exiting.")
            return 0
        else:
            print("[ERROR] Invalid option. Please enter a number between 0 and 6.")


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Spriteboard Project Manager: Auditing tools (inline styles, i18n & language rules, console logs) and Material Symbols SVG bundler."
    )

    audit_group = parser.add_argument_group("Auditing Options")
    audit_group.add_argument(
        "-s",
        "--audit-styles",
        action="store_true",
        help="Audit codebase for hardcoded inline style attributes (style='...').",
    )
    audit_group.add_argument(
        "-i",
        "--audit-i18n",
        action="store_true",
        help="Audit codebase for untranslated UI text/attributes and enforce English-only in non-i18n files.",
    )
    audit_group.add_argument(
        "-c",
        "--audit-console",
        action="store_true",
        help="Audit codebase for forbidden console.* calls (respecting WebSocket exception).",
    )
    audit_group.add_argument(
        "-a",
        "--audit-all",
        action="store_true",
        help="Run all project health audits simultaneously.",
    )
    audit_group.add_argument(
        "-m",
        "--menu",
        action="store_true",
        help="Launch the interactive CLI menu.",
    )

    icon_group = parser.add_argument_group("Icon Bundler Options")
    icon_group.add_argument(
        "--icons",
        action="store_true",
        help="Bundle Material Symbols SVG sprite (default when no audit options provided).",
    )
    icon_group.add_argument(
        "--scan",
        action="store_true",
        help="Scan and list detected Material Symbol icons without downloading.",
    )
    icon_group.add_argument(
        "--force",
        action="store_true",
        help="Force re-downloading all icons, bypassing local cache.",
    )
    icon_group.add_argument(
        "--add",
        nargs="+",
        default=[],
        help="Additional icon names to explicitly include in the bundle.",
    )
    icon_group.add_argument(
        "--output",
        type=str,
        default=str(DEFAULT_OUTPUT_SVG),
        help=f"Output file path for unified SVG sprite (default: {DEFAULT_OUTPUT_SVG}).",
    )

    args = parser.parse_args()

    if args.menu:
        return interactive_menu(BASE_DIR)
    if args.audit_all:
        return run_all_audits(BASE_DIR)
    if args.audit_styles:
        return audit_inline_styles(BASE_DIR)
    if args.audit_i18n:
        return audit_translations(BASE_DIR)
    if args.audit_console:
        return audit_console_logs(BASE_DIR)
    if args.scan or args.force or args.add or args.icons:
        return run_icon_bundler(
            scan_only=args.scan,
            force=args.force,
            extra_icons=args.add,
            output_file=args.output,
        )

    return interactive_menu(BASE_DIR)


if __name__ == "__main__":
    sys.exit(main())
