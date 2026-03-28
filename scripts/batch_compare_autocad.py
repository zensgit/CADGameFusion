#!/usr/bin/env python3
import argparse
import json
import re
import subprocess
import sys
from pathlib import Path


def slugify(value: str) -> str:
    slug = re.sub(r"[^a-zA-Z0-9]+", "_", value).strip("_").lower()
    return slug or "case"


def bool_arg(value, default=False):
    if value is None:
        return "1" if default else "0"
    if isinstance(value, bool):
        return "1" if value else "0"
    raw = str(value).strip().lower()
    return "0" if raw in {"0", "false", "off", "no"} else "1"


def parse_metric(lines, key):
    for line in lines:
        line = line.strip()
        if line.startswith(key):
            parts = line.split()
            if parts:
                try:
                    return float(parts[-1])
                except ValueError:
                    return None
    return None


def main() -> int:
    parser = argparse.ArgumentParser(description="Batch AutoCAD PDF comparisons via Playwright.")
    parser.add_argument("--cases", required=True, help="JSON file listing comparison cases.")
    parser.add_argument("--report", default="docs/STEP164_BATCH_COMPARE_VERIFICATION.md")
    parser.add_argument("--outdir", default="docs/assets/batch")
    parser.add_argument("--append", action="store_true", help="Append to report instead of overwriting header.")
    args = parser.parse_args()

    cases_path = Path(args.cases)
    if not cases_path.exists():
        print(f"Cases not found: {cases_path}", file=sys.stderr)
        return 1

    with cases_path.open("r", encoding="utf-8") as f:
        cases = json.load(f)

    if not isinstance(cases, list) or not cases:
        print("Cases JSON must be a non-empty list.", file=sys.stderr)
        return 1

    repo_root = Path(__file__).resolve().parents[1]
    report_path = repo_root / args.report
    report_path.parent.mkdir(parents=True, exist_ok=True)
    if not args.append:
        report_path.write_text("# Batch AutoCAD PDF Comparison\n", encoding="utf-8")

    outdir_root = repo_root / args.outdir
    outdir_root.mkdir(parents=True, exist_ok=True)

    script_path = repo_root / "scripts/compare_autocad_pdf.py"
    results = []

    for case in cases:
        name = str(case.get("name") or case.get("pdf") or "case")
        pdf = case.get("pdf")
        manifest = case.get("manifest")
        if not pdf or not manifest:
            print(f"Skipping case without pdf/manifest: {name}", file=sys.stderr)
            continue
        filters = case.get("filters") or ["dimension"]
        for flt in filters:
            slug = slugify(f"{name}_{flt}")
            outdir = outdir_root / slug
            outdir.mkdir(parents=True, exist_ok=True)
            cmd = [
                sys.executable,
                str(script_path),
                "--playwright",
                "--ui", bool_arg(case.get("ui", True), default=True),
                "--text-overlay", bool_arg(case.get("text_overlay", True), default=True),
                "--line-overlay", bool_arg(case.get("line_overlay", False), default=False),
                "--filter", str(flt),
                "--pdf", str(pdf),
                "--manifest", str(manifest),
                "--outdir", str(outdir),
                "--report", str(report_path),
                "--space", str(case.get("space", "model")),
                "--paper-viewport", bool_arg(case.get("paper_viewport", True), default=True),
            ]
            text_style = str(case.get("text_style", "")).strip()
            if text_style:
                cmd += ["--text-style", text_style]
            layout = str(case.get("layout", "")).strip()
            if layout:
                cmd += ["--layout", layout]
            if case.get("line_weight_scale") is not None:
                cmd += ["--line-weight-scale", str(case["line_weight_scale"])]
            if case.get("min_component_size") is not None:
                cmd += ["--min-component-size", str(case["min_component_size"])]
            if case.get("max_component_size") is not None:
                cmd += ["--max-component-size", str(case["max_component_size"])]

            result = subprocess.run(cmd, text=True, capture_output=True)
            lines = (result.stdout or "").splitlines()
            jaccard = parse_metric(lines, "jaccard")
            jaccard_aligned = parse_metric(lines, "jaccard_aligned")
            shift_dx = parse_metric(lines, "shift_dx")
            shift_dy = parse_metric(lines, "shift_dy")
            results.append({
                "name": name,
                "filter": flt,
                "space": case.get("space", "model"),
                "layout": layout,
                "jaccard": jaccard,
                "jaccard_aligned": jaccard_aligned,
                "shift_dx": shift_dx,
                "shift_dy": shift_dy,
                "returncode": result.returncode,
            })
            if result.returncode != 0:
                print(result.stdout)
                print(result.stderr, file=sys.stderr)

    with report_path.open("a", encoding="utf-8") as f:
        f.write("\n\n## Batch Summary\n")
        f.write("| Case | Filter | Space | Layout | Jaccard | Jaccard Aligned | Shift dx | Shift dy | Status |\n")
        f.write("| --- | --- | --- | --- | --- | --- | --- | --- | --- |\n")
        for item in results:
            status = "ok" if item["returncode"] == 0 else f"error:{item['returncode']}"
            jaccard = "" if item["jaccard"] is None else f"{item['jaccard']:.4f}"
            jaccard_aligned = "" if item["jaccard_aligned"] is None else f"{item['jaccard_aligned']:.4f}"
            shift_dx = "" if item["shift_dx"] is None else str(int(item["shift_dx"]))
            shift_dy = "" if item["shift_dy"] is None else str(int(item["shift_dy"]))
            f.write(
                f"| {item['name']} | {item['filter']} | {item['space']} | {item['layout'] or '-'} | "
                f"{jaccard} | {jaccard_aligned} | {shift_dx} | {shift_dy} | {status} |\n"
            )

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
