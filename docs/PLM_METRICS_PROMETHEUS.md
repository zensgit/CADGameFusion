# PLM Router Metrics (Prometheus + Grafana)

This guide shows how to scrape `/metrics` from the PLM router and visualize it in Grafana.

## 1) Run the router
```bash
python3 tools/plm_router_service.py --port 9000
```

If you want to protect `/metrics` with auth:
```bash
CADGF_ROUTER_METRICS_AUTH=1 python3 tools/plm_router_service.py \
  --port 9000 \
  --auth-token mytoken \
  --metrics-auth
```

Verify metrics:
```bash
curl -s http://127.0.0.1:9000/metrics | head -n 10
```

## 2) Prometheus config
Create `prometheus.yml`:

```yaml
global:
  scrape_interval: 15s

scrape_configs:
  - job_name: cadgf_router
    metrics_path: /metrics
    static_configs:
      - targets: ["127.0.0.1:9000"]
```

If `/metrics` is protected, add a bearer token file:

```yaml
  - job_name: cadgf_router
    metrics_path: /metrics
    bearer_token_file: /etc/prometheus/cadgf_router.token
    static_configs:
      - targets: ["127.0.0.1:9000"]
```

Put the token in `/etc/prometheus/cadgf_router.token` with file permissions locked down.

## 3) Grafana dashboard
Import the dashboard JSON at:

- `docs/grafana/cadgf_router_dashboard.json`

In Grafana:
- Dashboards → Import → Upload JSON → select your Prometheus datasource.

## 4) Docker Compose shortcut
For a one-command Prometheus + Grafana stack, see:

- `docs/PLM_METRICS_DOCKER_COMPOSE.md`

## Notes
- History-based metrics are bounded by the router history window (see `--history-limit`).
- `cadgf_router_info` exposes build metadata via labels.
