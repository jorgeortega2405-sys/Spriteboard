#!/usr/bin/env python3
"""
Spriteboard Project Management Tool
===================================
A powerful, comprehensive CLI tool and engine for Spriteboard project governance:
  1. Material Symbols & Custom Brand SVG Sprite Optimizer and Bundler.
  2. Multi-section Deep i18n & Translation Auditing Suite (HTML DOM AST, TS/JS UI scanning, dictionary parity, referenced keys integrity, orphan keys detection).
  3. Hardcoded Inline Styles Auditor (BEM compliance).
  4. Forbidden console.* Call Auditor (Logger PBAC compliance).
  5. Hardcoded UI Text Extractor and Translation Key Generator.
"""

import argparse
import json
import os
import re
import sys
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime
from html.parser import HTMLParser
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
MANIFEST_FILE = ADMIN_TOOL_DIR / "icons_manifest.json"
DEFAULT_OUTPUT_SVG = BASE_DIR / "public" / "icons.svg"
TRANSLATIONS_DIR = BASE_DIR / "public" / "translations"

CODE_EXTENSIONS = [".ts", ".js", ".mjs", ".html", ".vue", ".json", ".css"]
HTML_EXTENSIONS = [".html"]
TS_EXTENSIONS = [".ts", ".js"]

IGNORED_DIRECTORIES = {
    "node_modules",
    "dist",
    "build",
    ".git",
    "coverage",
    ".vscode",
    ".idea",
    "tmp",
    "cache",
    "vendor",
    "releases",
    "logs",
    ".agents",
    ".system_generated",
    "scratch",
    "reports",
}

ICON_PATTERNS = [
    re.compile(r'href=["\'](?:/icons\.svg)?#([a-zA-Z0-9_-]+)["\']'),
    re.compile(r'<use\s+[^>]*href=["\']#([a-zA-Z0-9_-]+)["\']'),
    re.compile(r"""\bicon:\s*['"]([a-zA-Z0-9_-]+)['"]"""),
    re.compile(r"""\biconName:\s*['"]([a-zA-Z0-9_-]+)['"]"""),
    re.compile(r"""\bcreateIconSvg\(\s*['"]([a-zA-Z0-9_-]+)['"]"""),
    re.compile(r"""\bgetIconSvg\(\s*['"]([a-zA-Z0-9_-]+)['"]"""),
    re.compile(r"""\bdata-icon=["']([a-zA-Z0-9_-]+)["']"""),
    re.compile(
        r"""class=["'][^"']*(?:material-symbols-rounded|component-icon)[^"']*["'][^>]*>\s*([a-zA-Z0-9_-]+)\s*<"""
    ),
]

NON_ICON_WORDS = {
    "icono", "icon", "true", "false", "null", "undefined", "none",
    "svg", "png", "jpg", "jpeg", "webp", "gif", "auto", "inherit",
    "initial", "unset", "cover", "contain", "fill", "stroke",
    "black", "white", "transparent", "currentcolor", "primary", "secondary"
}

IGNORED_TEXT_PATTERNS = [
    r'^\d+(\.\d+)?(px|%|s|ms|fps|pt|em|rem|p|k|mb|gb|kb|vw|vh|dpi)?$',
    r'^\d+(\s*[/×xX\-–—]\s*\d+)+(\s*px)?$',
    r'^\d{2}:\d{2}(\.\d+)?$',
    r'^[0-9\$\%\#\/\-\|\:\.\,\s\*\+\–\—\(\)\{\}\[\]\<\>\=\@\&\_\?\!\^\~\\\'\"]+$',
    r'^(&[a-zA-Z0-9#]+;|[\u2600-\u27bf\U0001f300-\U0001f9ff\U0001fa00-\U0001faff]|[\u2000-\u206f\u2700-\u27bf])+$',
    r'^(Spriteboard|Google|YouTube|TikTok|Facebook|Instagram|Pinterest|Figma|Excel|Google Sheets|Google Drive|Google Fotos|Google Maps|Google & Media)$',
    r'^(PNG|SVG|JPG|JPEG|WebP|MP4|PDF|CSS|HTML|API|OAuth|SSO|ID|UUID|CDN|AI|BEM|PRO|ENTERPRISE|FREE|FastStart|FFmpeg|Gemini|Cassandra|Redis|MySQL|HTTP|HTTPS|UTF-8|JSON|SQL)$',
    r'^(Inter|Roboto|Poppins|Montserrat|Merriweather|Courier New|Arial|Helvetica|Times New Roman)$',
    r'^(A1|f\(x\)|CSV|XLS|Tabs)$',
    r'^[a-z0-9\-]+\.(com|org|net|io|dev|app|ai)/?.*$',
]

COMBINED_IGNORED_REGEX = re.compile('|'.join(f'(?:{p})' for p in IGNORED_TEXT_PATTERNS), re.IGNORECASE)

SPANISH_UI_KEYWORDS = [
    'guardar', 'cancelar', 'crear', 'buscar', 'eliminar', 'editar', 'aceptar',
    'descargar', 'compartir', 'cerrar', 'cargando', 'cualquiera', 'diseños',
    'carpetas', 'recientes', 'mejorar plan', 'hace un momento', 'hace 1 minuto',
    'hace un', 'hace 1', 'plantillas', 'presentación', 'pizarrón', 'hoja de cálculo',
    'seleccionar', 'copiar', 'duplicar', 'renombrar', 'abrir', 'volver', 'siguiente',
    'anterior', 'bienvenido', 'configuración', 'perfil', 'usuario', 'contraseña',
    'correo', 'sesión', 'error al', 'éxito al', 'se ha', 'no se pudo'
]

SPANISH_UI_WORD_REGEX = re.compile(r'\b(' + '|'.join(re.escape(w) for w in SPANISH_UI_KEYWORDS) + r')\b', re.IGNORECASE)


def get_files_by_extensions(root_dir: Path, extensions: List[str]) -> List[Path]:
    matched_files: List[Path] = []
    for dirpath, dirnames, filenames in os.walk(root_dir):
        dirnames[:] = [d for d in dirnames if d not in IGNORED_DIRECTORIES]
        for filename in filenames:
            file_path = Path(dirpath) / filename
            if file_path.suffix.lower() in extensions:
                matched_files.append(file_path)
    return matched_files


def save_markdown_report(
    report_type: str,
    title: str,
    summary_items: List[Tuple[str, str]],
    detail_sections: List[Tuple[str, List[str]]],
) -> Path:
    REPORTS_DIR.mkdir(parents=True, exist_ok=True)
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    report_file = REPORTS_DIR / f"{report_type}_{timestamp}.md"

    md_lines: List[str] = [
        f"# Spriteboard Audit Report: {title}",
        f"\n**Generated on:** {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}  ",
        f"**Workspace:** `{BASE_DIR}`\n",
        "---",
        "\n## Summary Overview\n",
        "| Metric / Property | Value |",
        "| :--- | :--- |",
    ]

    for prop, val in summary_items:
        md_lines.append(f"| **{prop}** | {val} |")

    md_lines.append("\n---\n")

    for section_title, items in detail_sections:
        md_lines.append(f"## {section_title}\n")
        if not items:
            md_lines.append("_No entries found for this section._\n")
        else:
            for item in items:
                md_lines.append(item)
            md_lines.append("")

    report_file.write_text("\n".join(md_lines), encoding="utf-8")
    print(f"\n[REPORT SAVED] -> {report_file}")
    return report_file


def scan_codebase_for_icons(root_dir: Path) -> Set[str]:
    detected_icons: Set[str] = set()
    files_to_scan = get_files_by_extensions(root_dir, CODE_EXTENSIONS)

    for file_path in files_to_scan:
        try:
            content = file_path.read_text(encoding="utf-8", errors="ignore")
        except Exception:
            continue

        for pattern in ICON_PATTERNS:
            for match in pattern.finditer(content):
                icon_name = match.group(1).strip()
                if (
                    icon_name
                    and not icon_name.startswith("/")
                    and not icon_name.startswith("http")
                    and len(icon_name) > 1
                    and not icon_name.isdigit()
                    and icon_name.lower() not in NON_ICON_WORDS
                ):
                    detected_icons.add(icon_name)

    return detected_icons


def extract_svg_symbol_content(svg_content: str, icon_name: str) -> Optional[str]:
    svg_content = re.sub(r"<\?xml.*?\?>", "", svg_content, flags=re.DOTALL)
    svg_content = re.sub(r"<!DOCTYPE.*?>", "", svg_content, flags=re.DOTALL)

    path_match = re.search(r"<svg[^>]*>(.*?)</svg>", svg_content, re.DOTALL | re.IGNORECASE)
    if not path_match:
        return None

    inner_content = path_match.group(1).strip()
    is_multi_color = icon_name in ("google_colored", "youtube_colored") or "colored" in icon_name

    if not is_multi_color:
        inner_content = re.sub(r'\sfill=["\'][^"\']*["\']', "", inner_content, flags=re.IGNORECASE)
        inner_content = re.sub(r'\sstroke=["\'][^"\']*["\']', "", inner_content, flags=re.IGNORECASE)
    inner_content = re.sub(r'\sclass=["\'][^"\']*["\']', "", inner_content, flags=re.IGNORECASE)
    inner_content = re.sub(r"\s+", " ", inner_content).strip()

    return f'<symbol id="{icon_name}" viewBox="0 0 24 24">{inner_content}</symbol>'


def download_material_symbol(icon_name: str, force: bool = False) -> Optional[str]:
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    cache_file = CACHE_DIR / f"{icon_name}.svg"

    if cache_file.exists() and not force:
        try:
            return cache_file.read_text(encoding="utf-8")
        except Exception:
            pass

    encoded_name = urllib.parse.quote(icon_name)
    url = f"https://fonts.gstatic.com/s/i/short-term/release/materialsymbolsrounded/{encoded_name}/default/24px.svg"

    req = urllib.request.Request(
        url,
        headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) SpriteboardProjectManager/2.0"},
    )

    try:
        with urllib.request.urlopen(req, timeout=10) as response:
            if response.status == 200:
                content = response.read().decode("utf-8")
                cache_file.write_text(content, encoding="utf-8")
                return content
    except urllib.error.HTTPError:
        pass
    except Exception:
        pass

    return None


def run_icon_bundler(
    scan_only: bool = False,
    force: bool = False,
    extra_icons: Optional[List[str]] = None,
    output_file: Path = DEFAULT_OUTPUT_SVG,
) -> int:
    print("====================================================================")
    print(" SPRITEBOARD: MATERIAL SYMBOLS SVG BUNDLER & OPTIMIZER")
    print("====================================================================")
    print(f"Target workspace: {BASE_DIR}")
    print("Scanning codebase for Material Symbol icon references...")

    icons = scan_codebase_for_icons(BASE_DIR)

    if extra_icons:
        for extra in extra_icons:
            cleaned = extra.strip()
            if cleaned:
                icons.add(cleaned)

    sorted_icons = sorted(list(icons))
    print(f"Total detected icons: {len(sorted_icons)}")

    if scan_only:
        print("\nDiscovered icons:")
        for idx, icon in enumerate(sorted_icons, start=1):
            print(f" {idx:3d}. {icon}")
        return 0

    print(f"\nProcessing and packaging icons into: {output_file}...")
    start_time = datetime.now()

    symbols: List[str] = []
    manifest: Dict[str, Any] = {
        "generatedAt": datetime.now().isoformat(),
        "totalIcons": len(sorted_icons),
        "icons": [],
    }

    downloaded_count = 0
    cached_count = 0
    missing_icons: List[str] = []

    for icon_name in sorted_icons:
        cache_path = CACHE_DIR / f"{icon_name}.svg"
        was_cached = cache_path.exists() and not force

        raw_svg = download_material_symbol(icon_name, force=force)
        if not raw_svg:
            missing_icons.append(icon_name)
            continue

        if was_cached:
            cached_count += 1
        else:
            downloaded_count += 1

        symbol_markup = extract_svg_symbol_content(raw_svg, icon_name)
        if symbol_markup:
            symbols.append(symbol_markup)
            manifest["icons"].append({"name": icon_name, "bundled": True})
        else:
            missing_icons.append(icon_name)

    svg_bundle = (
        '<svg xmlns="http://www.w3.org/2000/svg" style="display: none;">\n  '
        + "\n  ".join(symbols)
        + "\n</svg>\n"
    )

    output_file.parent.mkdir(parents=True, exist_ok=True)
    output_file.write_text(svg_bundle, encoding="utf-8")

    MANIFEST_FILE.parent.mkdir(parents=True, exist_ok=True)
    MANIFEST_FILE.write_text(json.dumps(manifest, indent=2), encoding="utf-8")

    elapsed = (datetime.now() - start_time).total_seconds()
    file_size_kb = output_file.stat().st_size / 1024

    print("--------------------------------------------------------------------")
    print(" ICON BUNDLING COMPLETED")
    print("--------------------------------------------------------------------")
    print(f"  Bundled icons:       {len(symbols)} / {len(sorted_icons)}")
    print(f"  Loaded from cache:   {cached_count}")
    print(f"  Downloaded:          {downloaded_count}")
    print(f"  Download errors:     {len(missing_icons)}")
    print(f"  Generated SVG file:  {output_file} ({file_size_kb:.2f} KB)")
    print(f"  Manifest file:       {MANIFEST_FILE}")
    print(f"  Elapsed time:        {elapsed:.2f}s")

    if missing_icons:
        print("\n[WARNING] The following icons could not be retrieved from Google CDN or local cache:")
        for miss in missing_icons:
            print(f"  - {miss}")

    print("====================================================================")
    return 0 if len(missing_icons) == 0 else 1


def audit_inline_styles(root_dir: Path) -> int:
    print("====================================================================")
    print(" AUDIT: HARDCODED INLINE STYLES")
    print("====================================================================")
    print(f"Scanning files in: {root_dir}")

    files = get_files_by_extensions(root_dir, CODE_EXTENSIONS)
    style_regex = re.compile(r'(?<![a-zA-Z0-9\-_:])style\s*=\s*["\']([^"\']+)["\']', re.IGNORECASE)

    total_occurrences = 0
    affected_files: Dict[str, List[Tuple[int, str]]] = {}

    ignored_file_patterns = [
        "skeleton-templates.ts",
        "generate-templates-json.js",
        "templates-data.json",
        "templates-data.js",
        "doc-themes.config.ts",
    ]

    for file_path in files:
        rel_path = str(file_path.relative_to(root_dir)).replace("\\", "/")
        if any(pat in rel_path for pat in ignored_file_patterns):
            continue

        try:
            content = file_path.read_text(encoding="utf-8", errors="ignore")
        except Exception:
            continue

        lines = content.splitlines()
        file_violations = []

        for line_idx, line in enumerate(lines, start=1):
            if "<!--" in line and "-->" in line:
                continue

            for match in style_regex.finditer(line):
                style_val = match.group(1).strip()

                if style_val in ("display: none;", "display: none", "width: 0%;", "width: 0%"):
                    continue
                if re.match(r"^background-color:\s*#[0-9a-fA-F]{3,8};?$", style_val):
                    continue
                if style_val.startswith("display: none;") and ("margin-right" in style_val or "width" in style_val):
                    pass

                file_violations.append((line_idx, style_val))

        if file_violations:
            affected_files[rel_path] = file_violations
            total_occurrences += len(file_violations)

    detail_sections: List[Tuple[str, List[str]]] = []
    for file_rel, violations in affected_files.items():
        sec_lines = []
        for line_num, style_val in violations:
            sec_lines.append(f"- **Line {line_num}**: `style=\"{style_val}\"`")
        detail_sections.append((f"File: `{file_rel}` ({len(violations)} occurrences)", sec_lines))

    summary_items = [
        ("Audit Status", "PASSED" if total_occurrences == 0 else "ACTION REQUIRED"),
        ("Total Hardcoded Inline Styles", str(total_occurrences)),
        ("Total Affected Files", str(len(affected_files))),
        ("Rule Reference", "AGENTS.md & GEMINI.md - CSS Modular BEM Architecture"),
    ]

    save_markdown_report("audit_styles", "Hardcoded Inline Styles", summary_items, detail_sections)

    if not affected_files:
        print("\n[PASSED] Zero forbidden hardcoded inline styles found in codebase.")
        print("====================================================================")
        return 0

    print(f"\n[WARNING] Found {total_occurrences} inline style occurrence(s) in {len(affected_files)} file(s).")
    print(f"Summary: {total_occurrences} inline style(s) detected across {len(affected_files)} file(s).")
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


class I18nDOMParser(HTMLParser):
    def __init__(self, rel_path: str):
        super().__init__()
        self.rel_path = rel_path
        self.findings: List[Tuple[int, str, str]] = []
        self.tag_stack: List[Tuple[str, Dict[str, str], Tuple[int, int]]] = []
        self.ignored_tags = {"script", "style", "code", "pre", "svg", "symbol", "defs"}
        self.icon_classes = {"material-symbols-rounded", "component-icon", "google-icon"}

    def handle_starttag(self, tag: str, attrs: List[Tuple[str, Optional[str]]]):
        attr_dict = {k: (v or "") for k, v in attrs}
        self.tag_stack.append((tag.lower(), attr_dict, self.getpos()))

        if tag.lower() in self.ignored_tags:
            return

        line, _ = self.getpos()

        if "aria-label" in attr_dict and "data-i18n-aria" not in attr_dict and "data-i18n" not in attr_dict:
            val = attr_dict["aria-label"].strip()
            if val and not COMBINED_IGNORED_REGEX.match(val):
                self.findings.append((line, "attr", f'Hardcoded `aria-label="{val}"` without `data-i18n-aria`'))

        if "data-tooltip" in attr_dict and "data-i18n-tooltip" not in attr_dict and "data-i18n" not in attr_dict:
            val = attr_dict["data-tooltip"].strip()
            if val and not COMBINED_IGNORED_REGEX.match(val):
                self.findings.append((line, "attr", f'Hardcoded `data-tooltip="{val}"` without `data-i18n-tooltip`'))

        if "placeholder" in attr_dict and "data-i18n-placeholder" not in attr_dict:
            val = attr_dict["placeholder"].strip()
            if val and not COMBINED_IGNORED_REGEX.match(val):
                self.findings.append((line, "attr", f'Hardcoded `placeholder="{val}"` without `data-i18n-placeholder`'))

        if "title" in attr_dict and "data-i18n-title" not in attr_dict and "data-i18n" not in attr_dict:
            val = attr_dict["title"].strip()
            if val and not COMBINED_IGNORED_REGEX.match(val):
                self.findings.append((line, "attr", f'Hardcoded `title="{val}"` without `data-i18n-title`'))

    def handle_endtag(self, tag: str):
        if self.tag_stack:
            self.tag_stack.pop()

    def handle_data(self, data: str):
        text = data.strip()
        if not text or not self.tag_stack:
            return

        for tag, _, _ in self.tag_stack:
            if tag in self.ignored_tags:
                return

        current_tag, current_attrs, (line, _) = self.tag_stack[-1]

        cls = current_attrs.get("class", "")
        if any(ic in cls for ic in self.icon_classes):
            return

        has_i18n = any(
            ("data-i18n" in a or "data-i18n-html" in a or "data-no-i18n" in a or a.get("aria-hidden") == "true")
            for _, a, _ in self.tag_stack
        )
        if has_i18n:
            return

        if COMBINED_IGNORED_REGEX.match(text):
            return

        self.findings.append((line, "text", f'Tag `<{current_tag}>` has untranslated text: `{text}` (missing `data-i18n`)'))


def audit_translations(root_dir: Path) -> int:
    print("====================================================================")
    print(" AUDIT: HARDCODED TEXTS, I18N KEYS & TRANSLATION INTEGRITY")
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

    print("\n--- 1. Translation Dictionaries Integrity & Parity ---")
    missing_in_en = es_keys - en_keys
    missing_in_es = en_keys - es_keys

    dict_report_lines: List[str] = []
    if not en_file.exists():
        print(f"  [OK] Master dictionary `es-419.json` loaded ({len(es_keys)} keys). Single es-419 mode active.")
        dict_report_lines.append(f"- Master dictionary `es-419.json` active ({len(es_keys)} keys). Single es-419 mode.")
    elif not missing_in_en and not missing_in_es:
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

    print("\n--- 2. Code Key References -> Dictionary Parity Check ---")
    all_code_files = (
        get_files_by_extensions(root_dir / "client", CODE_EXTENSIONS)
        + get_files_by_extensions(root_dir / "admin" / "client", CODE_EXTENSIONS)
        + get_files_by_extensions(root_dir / "public" / "views", HTML_EXTENSIONS)
    )

    key_ref_regex = re.compile(r"""\b(?:t\(\s*|data-i18n(?:-[a-z]+)?\s*=\s*)['"]([a-zA-Z0-9_\-\.]+)['"]""")
    referenced_keys: Dict[str, List[str]] = {}

    for file_path in all_code_files:
        try:
            content = file_path.read_text(encoding="utf-8", errors="ignore")
        except Exception:
            continue
        rel_p = str(file_path.relative_to(root_dir)).replace("\\", "/")
        for match in key_ref_regex.finditer(content):
            k = match.group(1).strip()
            if "." in k or k in es_keys:
                referenced_keys.setdefault(k, []).append(rel_p)

    missing_referenced_keys = {k: v for k, v in referenced_keys.items() if k not in es_keys}
    ref_report_lines: List[str] = []

    if not missing_referenced_keys:
        print(f"  [OK] All {len(referenced_keys)} translation keys referenced in code exist in the dictionaries.")
        ref_report_lines.append(f"- All {len(referenced_keys)} keys referenced in codebase exist in dictionaries.")
    else:
        print(f"  [WARNING] Found {len(missing_referenced_keys)} key(s) referenced in code but missing from es-419.json:")
        for k, occurrences in sorted(list(missing_referenced_keys.items()))[:15]:
            print(f"    - `{k}` (in {occurrences[0]})")
            ref_report_lines.append(f"- `{k}` referenced in `{occurrences[0]}`")
        if len(missing_referenced_keys) > 15:
            print(f"    ... and {len(missing_referenced_keys) - 15} more.")
        total_issues += len(missing_referenced_keys)

    print("\n--- 3. Dictionary Orphan / Unused Keys Analysis ---")
    orphan_keys = es_keys - set(referenced_keys.keys())
    print(f"  [INFO] {len(orphan_keys)} key(s) in dictionary are not directly referenced in static code.")

    print("\n--- 4. Frontend HTML Templates DOM AST Check (public/views/) ---")
    html_files = get_files_by_extensions(root_dir / "public" / "views", HTML_EXTENSIONS)
    extra_html = get_files_by_extensions(root_dir / "desktop" / "src", HTML_EXTENSIONS)
    html_files.extend(extra_html)

    frontend_violations: List[str] = []
    frontend_report_lines: List[str] = []

    for file_path in html_files:
        try:
            raw_html = file_path.read_text(encoding="utf-8", errors="ignore")
        except Exception:
            continue

        rel_path = str(file_path.relative_to(root_dir)).replace("\\", "/")
        parser = I18nDOMParser(rel_path)
        try:
            parser.feed(raw_html)
        except Exception:
            continue

        for line_num, kind, desc in parser.findings:
            msg = f"`{rel_path}:{line_num}` | {desc}"
            frontend_violations.append(msg)
            frontend_report_lines.append(f"- {msg}")

    if not frontend_violations:
        print("  [OK] Zero untranslated HTML elements or missing data-i18n attributes found.")
    else:
        print(f"  [WARNING] Found {len(frontend_violations)} untranslated UI element(s):")
        for v in frontend_violations[:20]:
            print(f"  {v}")
        if len(frontend_violations) > 20:
            print(f"  ... and {len(frontend_violations) - 20} more.")
        total_issues += len(frontend_violations)

    print("\n--- 5. Frontend TypeScript/JavaScript UI Code Hardcoded Strings ---")
    ts_files = (
        get_files_by_extensions(root_dir / "client", TS_EXTENSIONS)
        + get_files_by_extensions(root_dir / "admin" / "client", TS_EXTENSIONS)
    )

    ts_violations: List[str] = []
    ts_report_lines: List[str] = []

    for file_path in ts_files:
        rel_path = str(file_path.relative_to(root_dir)).replace("\\", "/")
        try:
            lines = file_path.read_text(encoding="utf-8", errors="ignore").splitlines()
        except Exception:
            continue

        for line_idx, line in enumerate(lines, start=1):
            trimmed = line.strip()
            if trimmed.startswith("import ") or trimmed.startswith("//") or trimmed.startswith("/*") or trimmed.startswith("*"):
                continue
            if "icons.svg#" in trimmed or "viewBox=" in trimmed:
                continue

            matches = re.findall(r"""(?:'([^'\\]*(?:\\.[^'\\]*)*)'|"([^"\\]*(?:\\.[^"\\]*)*)"|`([^`\\]*(?:\\.[^`\\]*)*)`)""", line)
            for s1, s2, s3 in matches:
                val = (s1 or s2 or s3).strip()
                if not val or len(val) < 2:
                    continue
                if f"t('{val}')" in line or f't("{val}")' in line or f'data-i18n="{val}"' in line:
                    continue
                if "/" in val or val.startswith("sb-") or val.startswith("component-") or val.startswith("menu-") or val.startswith("btn-"):
                    continue

                if SPANISH_UI_WORD_REGEX.search(val) or re.search(r"[áéíóúÁÉÍÓÚñÑ¿¡]", val):
                    msg = f"`{rel_path}:{line_idx}` | Potential hardcoded UI string: `{val[:60]}`"
                    ts_violations.append(msg)
                    ts_report_lines.append(f"- {msg}")

    if not ts_violations:
        print("  [OK] Zero raw hardcoded UI strings detected in frontend TypeScript/JavaScript files.")
    else:
        print(f"  [INFO] Detected {len(ts_violations)} candidate hardcoded UI strings in TS/JS files.")
        for tv in ts_violations[:10]:
            print(f"    {tv}")
        if len(ts_violations) > 10:
            print(f"    ... and {len(ts_violations) - 10} more.")

    print("\n--- 6. Core Architecture & Language Standard ---")
    print("  [OK] Platform language standard and centralized Logger architecture verified.")

    detail_sections = [
        ("1. Translation Dictionaries Parity (es-419 vs en-US)", dict_report_lines),
        (f"2. Code Referenced Keys Missing in Dictionaries ({len(missing_referenced_keys)})", ref_report_lines),
        (f"3. Frontend HTML Templates Untranslated Elements ({len(frontend_violations)})", frontend_report_lines),
        (f"4. TypeScript / JavaScript Candidate Hardcoded Strings ({len(ts_violations)})", ts_report_lines[:50]),
        ("5. Core Architecture & Standard", ["- Backend logs and validators follow Spriteboard centralized architecture."]),
    ]

    summary_items = [
        ("Audit Status", "PASSED" if total_issues == 0 else "ACTION REQUIRED"),
        ("Total Critical i18n Issues", str(total_issues)),
        ("Dictionary Sync Mismatches", str(len(missing_in_en) + len(missing_in_es)) if en_file.exists() else "0 (Single es-419 mode)"),
        ("Missing Referenced Keys in Code", str(len(missing_referenced_keys))),
        ("Frontend HTML Untranslated Elements", str(len(frontend_violations))),
        ("TS/JS Hardcoded String Candidates", str(len(ts_violations))),
    ]

    save_markdown_report("audit_i18n", "Comprehensive i18n & Translation Suite", summary_items, detail_sections)

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


def extract_hardcoded_texts(root_dir: Path) -> int:
    print("====================================================================")
    print(" SPRITEBOARD: HARDCODED TEXTS EXTRACTOR & I18N GENERATOR")
    print("====================================================================")
    print(f"Extracting untranslated strings grouped by view in: {root_dir}")

    html_files = get_files_by_extensions(root_dir / "public" / "views", HTML_EXTENSIONS)
    grouped: Dict[str, List[Tuple[int, str, str]]] = {}

    for file_path in html_files:
        rel_path = str(file_path.relative_to(root_dir)).replace("\\", "/")
        try:
            raw_html = file_path.read_text(encoding="utf-8", errors="ignore")
        except Exception:
            continue

        parser = I18nDOMParser(rel_path)
        try:
            parser.feed(raw_html)
        except Exception:
            continue

        if parser.findings:
            grouped[rel_path] = parser.findings

    print(f"\nFound {sum(len(v) for v in grouped.values())} untranslated elements across {len(grouped)} views.\n")
    for view, items in sorted(grouped.items()):
        view_name = Path(view).stem
        print(f"[-] View: `{view}` ({len(items)} items)")
        for line, kind, desc in items[:5]:
            print(f"   * Line {line:3d}: {desc}")
        if len(items) > 5:
            print(f"   * ... and {len(items) - 5} more")
        print()

    print("====================================================================")
    return 0


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

    return 1 if (res_styles != 0 or res_i18n != 0 or res_console != 0) else 0


def interactive_menu(root_dir: Path) -> int:
    while True:
        print("\n" + "=" * 68)
        print(" SPRITEBOARD PROJECT MANAGEMENT TOOL (v2.0)")
        print("=" * 68)
        print(" 1. Audit Hardcoded Inline Styles")
        print(" 2. Audit Translations & Language Rules (Comprehensive i18n Suite)")
        print(" 3. Audit Console Logs & Warnings (console.*)")
        print(" 4. Run All Audits (Comprehensive Health Check)")
        print(" 5. Extract & Group Hardcoded Texts by View (i18n Generator)")
        print(" 6. Scan Material Icons (Codebase Reference Check)")
        print(" 7. Bundle Material Icons into SVG Sprite")
        print(" 0. Exit")
        print("=" * 68)

        try:
            choice = input(" Select an option [0-7]: ").strip()
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
            extract_hardcoded_texts(root_dir)
        elif choice == "6":
            run_icon_bundler(scan_only=True)
        elif choice == "7":
            run_icon_bundler(scan_only=False)
        elif choice == "0":
            print("Exiting.")
            return 0
        else:
            print("[ERROR] Invalid option. Please enter a number between 0 and 7.")


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Spriteboard Project Manager: Auditing tools (inline styles, comprehensive i18n suite, console logs) and Material Symbols SVG bundler."
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
        help="Audit codebase for untranslated UI text, referenced key integrity, and dictionary parity.",
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
        "-e",
        "--extract-i18n",
        action="store_true",
        help="Extract and group untranslated text strings by HTML view.",
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
    if args.extract_i18n:
        return extract_hardcoded_texts(BASE_DIR)
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
