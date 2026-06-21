#!/usr/bin/env python3
"""Smoke test for the router's synchronous POST /solve-cadgf endpoint.

Starts plm_router_service with --default-solve-cli pointing at a built solve_from_project, then
POSTs CADGF-PROJ samples and asserts the returned envelopes. Verifies:
  - satisfiable sample  -> HTTP 200, ok:true, non-empty vars
  - unsatisfiable sample -> HTTP 200, ok:false WITH analysis (the 'blocked' case, not 'failed')
  - invalid body        -> HTTP 400, error_code INVALID_BODY
  - /health             -> advertises default_solve_cli

Usage: plm_solve_cadgf_smoke.py --solve-cli <path/to/solve_from_project> [--port N]
Exits 0 on success, non-zero on any failure.
"""
import argparse
import json
import subprocess
import sys
import tempfile
import time
import urllib.error
import urllib.request
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent


def post_json(url, payload):
    body = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(url, data=body, headers={"Content-Type": "application/json"}, method="POST")
    try:
        with urllib.request.urlopen(req) as resp:
            return resp.status, json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        return exc.code, json.loads(exc.read().decode("utf-8"))


def get_json(url):
    with urllib.request.urlopen(url) as resp:
        return resp.status, json.loads(resp.read().decode("utf-8"))


def wait_for_health(base, timeout=15.0):
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        try:
            status, _ = get_json(f"{base}/health")
            if status == 200:
                return True
        except Exception:
            pass
        time.sleep(0.2)
    return False


def load_sample(name):
    return json.loads((REPO_ROOT / "samples" / name).read_text(encoding="utf-8"))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--solve-cli", required=True, help="Path to built solve_from_project")
    ap.add_argument("--port", type=int, default=9077)
    args = ap.parse_args()

    base = f"http://127.0.0.1:{args.port}"
    failures = []

    with tempfile.TemporaryDirectory(prefix="solve-smoke-") as out_root:
        proc = subprocess.Popen(
            [sys.executable, str(REPO_ROOT / "tools" / "plm_router_service.py"),
             "--port", str(args.port), "--out-root", out_root,
             "--default-solve-cli", args.solve_cli],
            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
        )
        try:
            if not wait_for_health(base):
                print("FAIL: router did not become healthy")
                return 1

            # /health advertises the solver
            _, health = get_json(f"{base}/health")
            if "default_solve_cli" not in health:
                failures.append("/health missing default_solve_cli")

            # satisfiable -> ok:true with vars
            status, env = post_json(f"{base}/solve-cadgf", load_sample("project_horizontal_ok.json"))
            if status != 200 or env.get("ok") is not True or not env.get("vars"):
                failures.append(f"satisfiable: status={status} ok={env.get('ok')} vars={bool(env.get('vars'))}")

            # unsatisfiable -> ok:false WITH analysis (blocked, not failed)
            status, env = post_json(f"{base}/solve-cadgf", load_sample("project_distance_bad.json"))
            if status != 200 or env.get("ok") is not False or not isinstance(env.get("analysis"), dict):
                failures.append(f"unsatisfiable: status={status} ok={env.get('ok')} analysis={type(env.get('analysis')).__name__}")

            # invalid body -> 400 INVALID_BODY
            status, env = post_json(f"{base}/solve-cadgf", {})
            if status != 400 or env.get("error_code") != "INVALID_BODY":
                failures.append(f"invalid-body: status={status} code={env.get('error_code')}")
        finally:
            proc.terminate()
            try:
                proc.wait(timeout=5)
            except Exception:
                proc.kill()

    if failures:
        for f in failures:
            print(f"FAIL: {f}")
        return 1
    print("OK: /solve-cadgf smoke passed (satisfiable, unsatisfiable->analysis, invalid-body, health)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
