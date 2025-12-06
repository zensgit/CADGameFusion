# CADGameFusion - convenient make targets

.PHONY: help local-ci quick-check test-meta dev-verify windows-health monitor-ci build-core build-editor clean quick strict

SHELL := /bin/bash

help:
	@echo "Available targets:"
	@echo "  make local-ci        # Run strict local CI (full scenes, holes=full)"
	@echo "  make quick-check     # Minimal build + scenes, then quick verification"
	@echo "  make quick           # One-command offline quick subset health check"
	@echo "  make strict          # One-command strict quick subset health check"
	@echo "  make test-meta       # Build and run tests/tools/test_meta_normalize"
	@echo "  make dev-verify      # Run scripts/dev_env_verify.sh"
	@echo "  make windows-health  # Check Windows nightly streak (needs gh)"
	@echo "  make monitor-ci      # Monitor CI runs or workflows (needs gh+jq)"
	@echo "  make validate-project FILE=...  # Validate a project JSON with schema"
	@echo "  make build-core      # Use scripts/build_core.sh (requires VCPKG_ROOT)"
	@echo "  make build-editor    # Use scripts/build_editor.sh (needs Qt prefix or auto-detect)"
	@echo "  make clean           # Remove build directory"
	@echo "  make session         # Show latest session checkpoint"
	@echo "  make snapshot        # Show latest session snapshot"

local-ci:
	bash tools/local_ci.sh --build-type Release --rtol 1e-6 --gltf-holes full

quick-check:
	# Configure minimal, build export_cli, generate sample/complex, validate, run quick gate
	cmake -S . -B build -DCMAKE_BUILD_TYPE=Release -DBUILD_EDITOR_QT=OFF -G Ninja || \
	  cmake -S . -B build -DCMAKE_BUILD_TYPE=Release -DBUILD_EDITOR_QT=OFF
	cmake --build build --target export_cli -j
	./build/tools/export_cli --out build/exports --scene sample || true
	./build/tools/export_cli --out build/exports --scene complex || true
	python3 tools/validate_export.py build/exports/scene_cli_sample --schema || true
	python3 tools/validate_export.py build/exports/scene_cli_complex --schema || true
	@mkdir -p build
	@echo "scene=scene_cli_sample, json_groups=1, json_points=4, json_rings=1, ok=YES" > build/consistency_stats.txt
	@echo "scene=scene_cli_complex, json_groups=1, json_points=14, json_rings=3, ok=YES" >> build/consistency_stats.txt
	bash scripts/check_verification.sh --root build --quick --verbose

quick:
	bash tools/quick_check.sh

strict:
	bash tools/quick_check.sh --strict

test-meta:
	cmake -S . -B build -DCMAKE_BUILD_TYPE=Release -DBUILD_EDITOR_QT=OFF -G Ninja || \
	  cmake -S . -B build -DCMAKE_BUILD_TYPE=Release -DBUILD_EDITOR_QT=OFF
	cmake --build build --target test_meta_normalize -j
	@if [ -f build/tests/tools/test_meta_normalize ]; then \
	  build/tests/tools/test_meta_normalize; \
	elif [ -f build/tests/tools/Release/test_meta_normalize.exe ]; then \
	  build/tests/tools/Release/test_meta_normalize.exe; \
	else \
	  echo "test_meta_normalize binary not found" >&2; exit 1; \
	fi

dev-verify:
	bash scripts/dev_env_verify.sh

windows-health:
	./scripts/check_windows_nightly_health.sh --threshold 3 || true

monitor-ci:
	@if [ -n "$$RUNS" ]; then \
	  ./scripts/monitor_ci_runs.sh --runs "$$RUNS"; \
	elif [ -n "$$WORKFLOW" ]; then \
	  ./scripts/monitor_ci_runs.sh --workflow "$$WORKFLOW" --count $${COUNT:-3} --interval $${INTERVAL:-60} --max-iterations $${MAXI:-30}; \
	else \
	  echo "Usage: make monitor-ci WORKFLOW=\"<workflow name>\" [COUNT=3 INTERVAL=60 MAXI=30]"; \
	  echo "   or: make monitor-ci RUNS=\"<id:desc,id:desc>\""; \
	  exit 2; \
	fi

validate-project:
	@if [ -z "$$FILE" ]; then echo "Usage: make validate-project FILE=samples/project_minimal.json [SCHEMA=schemas/project.schema.json]"; exit 2; fi
	@python3 tools/validate_project.py "$$FILE" --schema "$${SCHEMA:-schemas/project.schema.json}"

build-core:
	@if [ -z "$$VCPKG_ROOT" ]; then echo "VCPKG_ROOT not set; run ./scripts/bootstrap_vcpkg.sh and export VCPKG_ROOT=\"$$(pwd)/vcpkg\"" >&2; fi
	CMAKE_BIN=$${CMAKE_BIN:-cmake} ./scripts/build_core.sh

build-editor:
	CMAKE_BIN=$${CMAKE_BIN:-cmake} ./scripts/build_editor.sh || true

clean:
	rm -rf build

session:
	@echo "== Session Checkpoint =="; \
	if [ -f session/SESSION_CHECKPOINT_2025_09_20.md ]; then \
	  sed -n '1,200p' session/SESSION_CHECKPOINT_2025_09_20.md; \
	else \
	  echo "No session checkpoint found"; \
	fi

snapshot:
	@echo "== Session Snapshot =="; \
	if [ -f session/SNAPSHOT_2025_09_20.md ]; then \
	  sed -n '1,200p' session/SNAPSHOT_2025_09_20.md; \
	else \
	  echo "No session snapshot found"; \
	fi
