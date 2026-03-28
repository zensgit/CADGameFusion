#!/usr/bin/env python3
import argparse
import json
import os
import subprocess
import sys
import time
import urllib.parse
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter


def run(cmd, **kwargs):
    return subprocess.run(cmd, check=False, text=True, **kwargs)


def format_host(host: str) -> str:
    host = host.strip()
    if not host:
        return "127.0.0.1"
    if ":" in host and not host.startswith("["):
        return f"[{host}]"
    return host


def wait_http(host, port, retries=120, delay=0.2):
    host = format_host(host)
    for _ in range(retries):
        res = run(
            [
                "curl",
                "-fsS",
                "--connect-timeout",
                "1",
                "--max-time",
                "2",
                f"http://{host}:{port}/",
            ],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        if res.returncode == 0:
            return True
        time.sleep(delay)
    return False


def pdf_to_png(pdf_path: Path, png_path: Path) -> None:
    run(["sips", "-s", "format", "png", str(pdf_path), "--out", str(png_path)],
        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    if not png_path.exists():
        raise RuntimeError(f"Failed to render PDF: {pdf_path}")
    img = Image.open(png_path).convert("RGB")
    arr = np.array(img)
    if arr.max() == 0:
        tmp_dir = Path("/private/tmp")
        tmp_dir.mkdir(parents=True, exist_ok=True)
        res = run(["qlmanage", "-t", "-s", "2000", "-o", str(tmp_dir), str(pdf_path)],
                  stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        if res.returncode == 0:
            thumb = tmp_dir / f"{pdf_path.name}.png"
            if thumb.exists():
                thumb.replace(png_path)


def crop_pdf_content(img: Image.Image, margin: int = 10) -> Image.Image:
    gray = img.convert("L")
    arr = np.array(gray)
    # Treat near-white as background so we crop to linework instead of full page.
    mask = arr < 240
    coords = np.argwhere(mask)
    if coords.size == 0:
        return img
    y0, x0 = coords.min(axis=0)
    y1, x1 = coords.max(axis=0)
    x0 = max(0, x0 - margin)
    y0 = max(0, y0 - margin)
    x1 = min(arr.shape[1] - 1, x1 + margin)
    y1 = min(arr.shape[0] - 1, y1 + margin)
    return img.crop((x0, y0, x1 + 1, y1 + 1))


def crop_viewer_content(img: Image.Image, margin: int = 10) -> Image.Image:
    gray = img.convert("L")
    edges = gray.filter(ImageFilter.FIND_EDGES)
    arr = np.array(edges)
    mask = arr > 25
    h, w = mask.shape
    # If the left panel is visible, it tends to be bright; otherwise keep full width.
    left_probe = np.array(gray)[:, : max(1, int(w * 0.25))]
    left_avg = float(left_probe.mean()) if left_probe.size else 0.0
    left_cut = int(w * 0.35) if left_avg > 200 else 0
    mask[:, :left_cut] = False
    coords = np.argwhere(mask)
    if coords.size == 0:
        return img
    y0, x0 = coords.min(axis=0)
    y1, x1 = coords.max(axis=0)
    x0 = max(0, x0 - margin)
    y0 = max(0, y0 - margin)
    x1 = min(w - 1, x1 + margin)
    y1 = min(h - 1, y1 + margin)
    return img.crop((x0, y0, x1 + 1, y1 + 1))


def scale_to_height(img: Image.Image, height: int) -> Image.Image:
    if img.height == height:
        return img
    scale = height / img.height
    width = max(1, int(round(img.width * scale)))
    return img.resize((width, height), Image.Resampling.LANCZOS)


def pad_to_width(img: Image.Image, width: int, color=(0, 0, 0)) -> Image.Image:
    if img.width == width:
        return img
    pad_left = (width - img.width) // 2
    pad_right = width - img.width - pad_left
    out = Image.new("RGB", (width, img.height), color)
    out.paste(img, (pad_left, 0))
    return out


def edge_mask(img: Image.Image, threshold: int = 30) -> np.ndarray:
    edges = img.convert("L").filter(ImageFilter.FIND_EDGES)
    arr = np.array(edges)
    return arr > threshold


def filter_components(mask: np.ndarray, min_size: int, max_size: int) -> np.ndarray:
    if min_size <= 0 and max_size <= 0:
        return mask
    h, w = mask.shape
    visited = np.zeros((h, w), dtype=bool)
    out = np.zeros((h, w), dtype=bool)
    for y in range(h):
        row = mask[y]
        for x in range(w):
            if not row[x] or visited[y, x]:
                continue
            stack = [(y, x)]
            visited[y, x] = True
            coords = []
            while stack:
                cy, cx = stack.pop()
                coords.append((cy, cx))
                for ny in (cy - 1, cy, cy + 1):
                    if ny < 0 or ny >= h:
                        continue
                    for nx in (cx - 1, cx, cx + 1):
                        if nx < 0 or nx >= w:
                            continue
                        if visited[ny, nx] or not mask[ny, nx]:
                            continue
                        visited[ny, nx] = True
                        stack.append((ny, nx))
            size = len(coords)
            if min_size > 0 and size < min_size:
                continue
            if max_size > 0 and size > max_size:
                continue
            for cy, cx in coords:
                out[cy, cx] = True
    return out


def translate_mask(mask: np.ndarray, dx: int, dy: int) -> np.ndarray:
    h, w = mask.shape
    out = np.zeros_like(mask)
    src_x0 = max(0, -dx)
    src_y0 = max(0, -dy)
    dst_x0 = max(0, dx)
    dst_y0 = max(0, dy)
    width = w - max(src_x0, dst_x0)
    height = h - max(src_y0, dst_y0)
    if width <= 0 or height <= 0:
        return out
    out[dst_y0:dst_y0 + height, dst_x0:dst_x0 + width] = mask[src_y0:src_y0 + height, src_x0:src_x0 + width]
    return out


def mask_center_of_mass(mask: np.ndarray) -> tuple[float, float]:
    ys, xs = np.nonzero(mask)
    if xs.size == 0:
        return 0.0, 0.0
    return float(xs.mean()), float(ys.mean())


def find_best_alignment(
    mask_a: np.ndarray,
    mask_b: np.ndarray,
    max_shift: int = 80,
    base_dx: int = 0,
    base_dy: int = 0,
) -> tuple[int, int]:
    best = (0, 0)
    best_score = -1
    for dy in range(-max_shift, max_shift + 1):
        for dx in range(-max_shift, max_shift + 1):
            shift_dx = base_dx + dx
            shift_dy = base_dy + dy
            shifted = translate_mask(mask_b, shift_dx, shift_dy)
            score = int((mask_a & shifted).sum())
            if score > best_score:
                best_score = score
                best = (shift_dx, shift_dy)
    return best


def overlay_edges(mask_a: np.ndarray, mask_b: np.ndarray) -> Image.Image:
    h, w = mask_a.shape
    out = np.zeros((h, w, 3), dtype=np.uint8)
    both = mask_a & mask_b
    only_a = mask_a & ~mask_b
    only_b = mask_b & ~mask_a
    out[both] = (80, 220, 120)    # green
    out[only_a] = (80, 200, 255)  # cyan (AutoCAD)
    out[only_b] = (255, 140, 80)  # orange (viewer)
    return Image.fromarray(out, "RGB")


def main() -> int:
    parser = argparse.ArgumentParser(description="Compare AutoCAD PDF to web viewer render.")
    parser.add_argument("--pdf", required=True)
    parser.add_argument("--manifest", default=None)
    parser.add_argument("--outdir", default="docs/assets")
    parser.add_argument("--project-id", default="demo")
    parser.add_argument("--document-label", default="dim_text")
    parser.add_argument("--document-id", default="ZGVtbwpkaW1fdGV4dA")
    parser.add_argument("--filter", default="all", choices=["dimension", "text", "all"])
    parser.add_argument("--text-overlay", default="0",
                        help="Include text overlay in viewer screenshot (1/0/true/false).")
    parser.add_argument("--line-overlay", default="1",
                        help="Include line overlay in viewer screenshot (1/0/true/false).")
    parser.add_argument("--text-style", default="",
                        help="Optional text style override for viewer (e.g., clean).")
    parser.add_argument("--space", default="model", choices=["model", "paper", "all"],
                        help="DXF space filter for viewer rendering.")
    parser.add_argument("--paper-viewport", default="1",
                        help="Apply paper viewport transform when space=paper (1/0/true/false).")
    parser.add_argument("--layout", default="",
                        help="Optional layout name to filter paper space viewports.")
    parser.add_argument("--ui", default="0",
                        help="Show UI in viewer screenshot (1/0/true/false).")
    parser.add_argument("--viewer-image", default=None,
                        help="Use an existing viewer screenshot instead of capturing a new one.")
    parser.add_argument("--playwright", action="store_true",
                        help="Use Playwright CLI for viewer screenshot capture.")
    parser.add_argument("--playwright-channel", default="",
                        help="Optional Playwright Chromium channel (e.g., chrome).")
    parser.add_argument("--line-weight-scale", type=float, default=None)
    parser.add_argument("--bind", default="127.0.0.1",
                        help="Bind address for the local HTTP server.")
    parser.add_argument("--host", default="",
                        help="Host to use for viewer URL (defaults to --bind).")
    parser.add_argument("--min-component-size", type=int, default=0)
    parser.add_argument("--max-component-size", type=int, default=0,
                        help="Drop edge components larger than this size (0 disables).")
    parser.add_argument("--port", type=int, default=8080)
    parser.add_argument("--report", default="docs/STEP160_WEB_VIEWER_TEXT_OVERLAY_VERIFICATION.md")
    parser.add_argument("--metrics-json", default="",
                        help="Optional path to write machine-readable metrics JSON.")
    args = parser.parse_args()

    raw_overlay = str(args.text_overlay).strip().lower()
    overlay_enabled = raw_overlay not in {"0", "false", "off", "no"}
    raw_lines = str(args.line_overlay).strip().lower()
    line_overlay_enabled = raw_lines not in {"0", "false", "off", "no"}
    raw_ui = str(args.ui).strip().lower()
    ui_enabled = raw_ui not in {"0", "false", "off", "no"}
    raw_paper_viewport = str(args.paper_viewport).strip().lower()
    paper_viewport_enabled = raw_paper_viewport not in {"0", "false", "off", "no"}
    text_style = str(args.text_style).strip().lower()
    layout_filter = str(args.layout).strip()

    repo_root = Path(__file__).resolve().parents[1]
    pdf_path = Path(args.pdf)
    if not pdf_path.exists():
        print(f"PDF not found: {pdf_path}", file=sys.stderr)
        return 1

    manifest = Path(args.manifest) if args.manifest else repo_root / "build/plm_preview_dim/manifest.json"
    if not manifest.exists():
        print(f"Manifest not found: {manifest}", file=sys.stderr)
        return 1

    outdir = repo_root / args.outdir
    outdir.mkdir(parents=True, exist_ok=True)

    chrome = Path("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome")
    if not args.playwright and not args.viewer_image and not chrome.exists():
        print(f"Chrome not found at: {chrome}", file=sys.stderr)
        return 1

    pdf_png = outdir / "autocad_model.png"
    pdf_to_png(pdf_path, pdf_png)

    viewer_png = outdir / f"viewer_{args.filter}.png"
    viewer_image = Path(args.viewer_image).resolve() if args.viewer_image else None

    server = None
    server_log_fh = None
    bind_host = str(args.bind).strip() or "127.0.0.1"
    url_host = str(args.host).strip() or bind_host
    url_host = format_host(url_host)
    if not viewer_image:
        server_log_path = outdir / "http_server.log"
        server_log_fh = server_log_path.open("w", encoding="utf-8")
        server = subprocess.Popen([
            sys.executable,
            "-m",
            "http.server",
            str(args.port),
            "--directory",
            str(repo_root),
            "--bind",
            bind_host,
        ], stdout=server_log_fh, stderr=server_log_fh)

    try:
        if viewer_image:
            if not viewer_image.exists():
                print(f"Viewer image not found: {viewer_image}", file=sys.stderr)
                return 1
            if viewer_image != viewer_png:
                viewer_png.write_bytes(viewer_image.read_bytes())
        else:
            if not wait_http(bind_host, args.port):
                rc = None
                if server:
                    rc = server.poll()
                detail = f"bind={bind_host} port={args.port} rc={rc}"
                print(f"HTTP server failed to start ({detail})", file=sys.stderr)
                if not viewer_image:
                    try:
                        text = (outdir / "http_server.log").read_text(encoding="utf-8", errors="ignore")
                        tail = "\n".join(text.splitlines()[-12:])
                        if tail.strip():
                            print("http_server.log tail:", file=sys.stderr)
                            print(tail, file=sys.stderr)
                    except Exception:
                        pass
                return 1

            base_url = f"http://{url_host}:{args.port}/tools/web_viewer/index.html"
            try:
                rel_manifest = manifest.resolve().relative_to(repo_root.resolve())
                manifest_url = rel_manifest.as_posix()
            except Exception:
                manifest_url = os.path.relpath(manifest, repo_root).replace(os.sep, "/")
            encoded_manifest = urllib.parse.quote(manifest_url)
            query = (
                f"manifest={encoded_manifest}"
                f"&project_id={args.project_id}"
                f"&document_label={args.document_label}"
                f"&document_id={args.document_id}"
                f"&text_overlay={'1' if overlay_enabled else '0'}"
                f"&line_overlay={'1' if line_overlay_enabled else '0'}"
                f"&view=top"
                f"&projection=ortho"
                f"&grid=0"
                f"&bg=black"
                f"&ui={'1' if ui_enabled else '0'}"
                f"&space={args.space}"
                f"&paper_viewport={'1' if paper_viewport_enabled else '0'}"
                f"&mesh=0"
            )
            if text_style:
                query += f"&text_style={urllib.parse.quote(text_style)}"
            if layout_filter:
                query += f"&layout={urllib.parse.quote(layout_filter)}"
            if args.line_weight_scale is not None:
                query += f"&line_weight_scale={args.line_weight_scale}"
            url = f"{base_url}?{query}&text_filter={args.filter}"
            if args.playwright:
                cmd = [
                    "npx", "playwright", "screenshot",
                    "--viewport-size", "1400,900",
                    "--wait-for-timeout", "15000",
                ]
                if args.playwright_channel:
                    cmd += ["--channel", args.playwright_channel]
                cmd += [url, str(viewer_png)]
                run(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            else:
                run([
                    str(chrome),
                    "--headless=new",
                    "--window-size=1400,900",
                    "--virtual-time-budget=15000",
                    f"--screenshot={viewer_png}",
                    url,
                ], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

    finally:
        if server:
            server.terminate()
            try:
                server.wait(timeout=2)
            except subprocess.TimeoutExpired:
                server.kill()
        if server_log_fh:
            try:
                server_log_fh.close()
            except Exception:
                pass

    if not viewer_png.exists():
        print("Viewer screenshot missing", file=sys.stderr)
        return 1

    pdf_img = Image.open(pdf_png)
    viewer_img = Image.open(viewer_png)

    pdf_crop = crop_pdf_content(pdf_img)
    viewer_crop = crop_viewer_content(viewer_img)

    # Optional region focus to reduce layout noise.
    region = (os.environ.get("COMPARE_REGION") or "").strip().lower()
    if region in {"frame", "border", "title"}:
        def focus_region(img: Image.Image, mode: str) -> Image.Image:
            w, h = img.size
            if mode == "frame":
                left = int(w * 0.08)
                right = int(w * 0.92)
                top = int(h * 0.10)
                bottom = int(h * 0.90)
                return img.crop((left, top, right, bottom))
            # title block region (bottom-right)
            left = int(w * 0.55)
            right = int(w * 0.98)
            top = int(h * 0.70)
            bottom = int(h * 0.98)
            return img.crop((left, top, right, bottom))

        pdf_crop = focus_region(pdf_crop, region)
        viewer_crop = focus_region(viewer_crop, region)

    pdf_crop_path = outdir / "autocad_model_crop.png"
    viewer_crop_path = outdir / f"viewer_{args.filter}_crop.png"
    pdf_crop.save(pdf_crop_path)
    viewer_crop.save(viewer_crop_path)

    best = None
    best_pdf = None
    for rotation in [0, 90, 180, 270]:
        rotated = pdf_crop.rotate(rotation, expand=True)
        target_h = max(rotated.height, viewer_crop.height)
        pdf_scaled = scale_to_height(rotated, target_h)
        viewer_scaled = scale_to_height(viewer_crop, target_h)
        target_w = max(pdf_scaled.width, viewer_scaled.width)
        pdf_pad = pad_to_width(pdf_scaled, target_w, (0, 0, 0))
        viewer_pad = pad_to_width(viewer_scaled, target_w, (0, 0, 0))
        mask_pdf = filter_components(edge_mask(pdf_pad), args.min_component_size, args.max_component_size)
        mask_viewer = filter_components(edge_mask(viewer_pad), args.min_component_size, args.max_component_size)
        overlap = int((mask_pdf & mask_viewer).sum())
        pdf_edges = int(mask_pdf.sum())
        viewer_edges = int(mask_viewer.sum())
        union = pdf_edges + viewer_edges - overlap
        jaccard = (overlap / union) if union else 0.0
        pdf_cx, pdf_cy = mask_center_of_mass(mask_pdf)
        viewer_cx, viewer_cy = mask_center_of_mass(mask_viewer)
        pre_dx = int(round(pdf_cx - viewer_cx))
        pre_dy = int(round(pdf_cy - viewer_cy))
        dx, dy = find_best_alignment(mask_pdf, mask_viewer, base_dx=pre_dx, base_dy=pre_dy)
        shifted_viewer = translate_mask(mask_viewer, dx, dy)
        overlap_aligned = int((mask_pdf & shifted_viewer).sum())
        union_aligned = pdf_edges + viewer_edges - overlap_aligned
        jaccard_aligned = (overlap_aligned / union_aligned) if union_aligned else 0.0

        if not best or jaccard_aligned > best["jaccard_aligned"]:
            best = {
                "rotation": rotation,
                "pdf_edges": pdf_edges,
                "viewer_edges": viewer_edges,
                "overlap": overlap,
                "jaccard": jaccard,
                "prefit_dx": pre_dx,
                "prefit_dy": pre_dy,
                "shift_dx": dx,
                "shift_dy": dy,
                "overlap_aligned": overlap_aligned,
                "jaccard_aligned": jaccard_aligned,
                "pdf_pad": pdf_pad,
                "viewer_pad": viewer_pad,
                "mask_pdf": mask_pdf,
                "mask_viewer": mask_viewer,
            }
            best_pdf = rotated

    pdf_rotated_path = outdir / "autocad_model_rotated.png"
    if best_pdf is not None:
        best_pdf.save(pdf_rotated_path)
    else:
        pdf_rotated_path = pdf_crop_path
        best = {
            "rotation": 0,
            "pdf_edges": 0,
            "viewer_edges": 0,
            "overlap": 0,
            "jaccard": 0.0,
            "pdf_pad": pdf_crop,
            "viewer_pad": viewer_crop,
        }

    pdf_pad = best["pdf_pad"]
    viewer_pad = best["viewer_pad"]
    target_h = pdf_pad.height
    target_w = pdf_pad.width

    side_by_side = Image.new("RGB", (target_w * 2 + 20, target_h), (0, 0, 0))
    side_by_side.paste(pdf_pad, (0, 0))
    side_by_side.paste(viewer_pad, (target_w + 20, 0))

    side_path = outdir / "autocad_vs_viewer_side_by_side.png"
    side_by_side.save(side_path)

    mask_pdf = best["mask_pdf"]
    mask_viewer = best["mask_viewer"]
    overlay = overlay_edges(mask_pdf, mask_viewer)
    overlay_path = outdir / "autocad_vs_viewer_edge_overlay.png"
    overlay.save(overlay_path)

    pre_dx = int(best["prefit_dx"])
    pre_dy = int(best["prefit_dy"])
    dx = int(best["shift_dx"])
    dy = int(best["shift_dy"])
    shifted_viewer = translate_mask(mask_viewer, dx, dy)
    overlay_aligned = overlay_edges(mask_pdf, shifted_viewer)
    overlay_aligned_path = outdir / "autocad_vs_viewer_edge_overlay_aligned.png"
    overlay_aligned.save(overlay_aligned_path)

    overlap_aligned = int(best["overlap_aligned"])
    jaccard_aligned = float(best["jaccard_aligned"])
    pdf_edges = int(best["pdf_edges"])
    viewer_edges = int(best["viewer_edges"])

    overlap = best["overlap"]
    jaccard = best["jaccard"]

    metrics_path = str(args.metrics_json).strip()
    if metrics_path:
        metrics_file = Path(metrics_path)
        metrics_file.parent.mkdir(parents=True, exist_ok=True)
        payload = {
            "pdf": str(pdf_path),
            "manifest": str(manifest),
            "layout": layout_filter,
            "filter": args.filter,
            "space": args.space,
            "paper_viewport": paper_viewport_enabled,
            "rotation": int(best["rotation"]),
            "pdf_edges": int(pdf_edges),
            "viewer_edges": int(viewer_edges),
            "overlap": int(overlap),
            "jaccard": float(jaccard),
            "shift_prefit_dx": int(pre_dx),
            "shift_prefit_dy": int(pre_dy),
            "shift_dx": int(dx),
            "shift_dy": int(dy),
            "overlap_aligned": int(overlap_aligned),
            "jaccard_aligned": float(jaccard_aligned),
            "artifacts": {
                "pdf_png": str(pdf_png),
                "pdf_crop": str(pdf_crop_path),
                "viewer_png": str(viewer_png),
                "viewer_crop": str(viewer_crop_path),
                "side": str(side_path),
                "overlay": str(overlay_path),
                "overlay_aligned": str(overlay_aligned_path),
            },
        }
        with metrics_file.open("w", encoding="utf-8") as fh:
            json.dump(payload, fh, ensure_ascii=False, indent=2)
            fh.write("\n")

    report_path = repo_root / args.report
    report_path.parent.mkdir(parents=True, exist_ok=True)
    with report_path.open("a", encoding="utf-8") as f:
        f.write("\n\n## AutoCAD PDF comparison\n")
        f.write(f"- PDF: `{pdf_path}`\n")
        f.write(f"- Manifest: `{manifest}`\n")
        f.write(f"- Viewer filter: `{args.filter}`\n")
        f.write(f"- Viewer space: `{args.space}`\n")
        if args.space == "paper":
            f.write(f"- Paper viewport: {'on' if paper_viewport_enabled else 'off'}\n")
            if layout_filter:
                f.write(f"- Layout filter: `{layout_filter}`\n")
        if viewer_image:
            f.write("- Viewer capture: external image\n")
        elif args.playwright:
            f.write("- Viewer capture: playwright\n")
        else:
            f.write("- Viewer capture: chrome\n")
        if args.min_component_size > 0 or args.max_component_size > 0:
            f.write(f"- Edge component filter: min_size={args.min_component_size}, max_size={args.max_component_size}\n")
        f.write("- Artifacts:\n")
        f.write(f"  - `{pdf_png}`\n")
        f.write(f"  - `{pdf_crop_path}`\n")
        f.write(f"  - `{pdf_rotated_path}`\n")
        f.write(f"  - `{viewer_png}`\n")
        f.write(f"  - `{viewer_crop_path}`\n")
        f.write(f"  - `{side_path}`\n")
        f.write(f"  - `{overlay_path}`\n")
        f.write(f"  - `{overlay_aligned_path}`\n")
        f.write(f"- Rotation picked: {best['rotation']} degrees\n")
        f.write("- Edge overlap (pixel count):\n")
        f.write(f"  - pdf_edges: {pdf_edges}\n")
        f.write(f"  - viewer_edges: {viewer_edges}\n")
        f.write(f"  - overlap: {overlap}\n")
        f.write(f"  - jaccard: {jaccard:.4f}\n")
        f.write("- Aligned edge overlap (pixel count):\n")
        f.write(f"  - shift_dx: {dx}\n")
        f.write(f"  - shift_dy: {dy}\n")
        f.write(f"  - overlap_aligned: {overlap_aligned}\n")
        f.write(f"  - jaccard_aligned: {jaccard_aligned:.4f}\n")

    print("Artifacts:")
    print(f"  {pdf_png}")
    print(f"  {pdf_crop_path}")
    print(f"  {viewer_png}")
    print(f"  {viewer_crop_path}")
    print(f"  {side_path}")
    print(f"  {overlay_path}")
    print("Edge overlap:")
    print(" pdf_edges", pdf_edges)
    print(" viewer_edges", viewer_edges)
    print(" overlap", overlap)
    print(" jaccard", f"{jaccard:.4f}")
    print("Aligned overlap:")
    print(" shift_dx", dx)
    print(" shift_dy", dy)
    print(" overlap_aligned", overlap_aligned)
    print(" jaccard_aligned", f"{jaccard_aligned:.4f}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
