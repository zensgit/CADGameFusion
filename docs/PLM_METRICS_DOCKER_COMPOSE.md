# PLM Metrics Docker Compose (Prometheus + Grafana)

This example spins up Prometheus + Grafana with a preloaded dashboard.

## Prerequisites
- Docker + Docker Compose v2
- Router running on the host (default port 9000)

## Files
Create a working directory and add the files below:

### 1) docker-compose.yml
```yaml
services:
  prometheus:
    image: prom/prometheus:latest
    container_name: cadgf_prometheus
    ports:
      - "9090:9090"
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml:ro
      - ./prometheus-data:/prometheus

  grafana:
    image: grafana/grafana:latest
    container_name: cadgf_grafana
    ports:
      - "3000:3000"
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=admin
    volumes:
      - ./grafana-provisioning:/etc/grafana/provisioning
      - ./grafana-data:/var/lib/grafana
    depends_on:
      - prometheus
```

### 2) prometheus.yml
```yaml
global:
  scrape_interval: 15s

scrape_configs:
  - job_name: cadgf_router
    metrics_path: /metrics
    static_configs:
      - targets: ["host.docker.internal:9000"]
```

If `/metrics` requires auth, add a token file and update the scrape config:

```yaml
  - job_name: cadgf_router
    metrics_path: /metrics
    bearer_token_file: /etc/prometheus/cadgf_router.token
    static_configs:
      - targets: ["host.docker.internal:9000"]
```

Place the token in `cadgf_router.token` and mount it in the Prometheus container:

```yaml
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml:ro
      - ./cadgf_router.token:/etc/prometheus/cadgf_router.token:ro
      - ./prometheus-data:/prometheus
```

### 3) Grafana provisioning
Create `grafana-provisioning/datasources/prometheus.yml`:

```yaml
apiVersion: 1

datasources:
  - name: Prometheus
    type: prometheus
    access: proxy
    url: http://prometheus:9090
    isDefault: true
```

Create `grafana-provisioning/dashboards/dashboards.yml`:

```yaml
apiVersion: 1

dashboards:
  - name: cadgf
    orgId: 1
    folder: "CADGameFusion"
    type: file
    disableDeletion: false
    editable: true
    options:
      path: /etc/grafana/provisioning/dashboards
```

Copy the dashboard JSON from `docs/grafana/cadgf_router_dashboard.json` into:

```
./grafana-provisioning/dashboards/cadgf_router_dashboard.json
```

## Run
```bash
docker compose up -d
```

## Open Grafana
- http://localhost:3000
- User: `admin`
- Password: `admin`

The "CADGameFusion" folder contains the dashboard.

## Notes
- `host.docker.internal` works on macOS/Windows. On Linux, replace with your host IP.
