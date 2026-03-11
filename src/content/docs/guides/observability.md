---
title: "Observability"
description: "Monitor Thunder with OpenTelemetry traces, metrics, and logs using the included observability stack."
---

Thunder has built-in OpenTelemetry (OTEL) support for exporting traces, metrics, and logs. The repository includes a Docker Compose stack with an OTEL Collector, Tempo (traces), Loki (logs), Prometheus (metrics), VictoriaMetrics, and Grafana for visualization.

## Architecture overview

```
Thunder Runtime
  |
  +-- OTLP HTTP (traces, metrics, logs)
  |
  v
OTEL Collector (port 4318)
  |
  +-- Traces  --> Tempo
  +-- Metrics --> Prometheus / VictoriaMetrics
  +-- Logs    --> Loki
  |
  v
Grafana (port 3000) -- unified visualization
```

## Starting the observability stack

The full stack is defined in `observability/docker-compose.yml`. Start it from the repository root:

```bash
docker compose -f observability/docker-compose.yml up -d
```

Verify all services are running:

```bash
docker compose -f observability/docker-compose.yml ps
```

### Stack components

| Service | Image | Port | Purpose |
|---------|-------|------|---------|
| OTEL Collector | `otel/opentelemetry-collector-contrib:0.100.0` | 4317 (gRPC), 4318 (HTTP) | Receives and routes telemetry |
| Tempo | `grafana/tempo:2.5.0` | 3200 | Distributed tracing backend |
| Loki | `grafana/loki:3.0.0` | 3100 | Log aggregation |
| Prometheus | `prom/prometheus:v2.52.0` | 9090 | Metrics storage |
| VictoriaMetrics | `victoriametrics/victoria-metrics:v1.102.1` | 8428 | Alternative metrics storage |
| vmagent | `victoriametrics/vmagent:v1.102.1` | 8429 | Metrics scraping agent |
| Grafana | `grafana/grafana:11.0.0` | 3000 | Dashboards and exploration |

## Starting Thunder with OTEL enabled

Run the runtime with all telemetry signals enabled:

```bash
thunder \
  --otel-enabled \
  --otel-endpoint http://127.0.0.1:4318 \
  --otel-service-name thunder-local \
  --otel-enable-traces true \
  --otel-enable-metrics true \
  --otel-enable-logs true \
  --otel-export-isolate-logs true \
  start --print-isolate-logs false
```

### Key flags

| Flag | Default | Description |
|------|---------|-------------|
| `--otel-enabled` | `false` | Enable OTEL export |
| `--otel-endpoint <URL>` | `http://127.0.0.1:4318` | OTLP collector base URL |
| `--otel-service-name <NAME>` | `thunder` | OTEL resource `service.name` |
| `--otel-enable-traces` | `true` | Export trace spans |
| `--otel-enable-metrics` | `true` | Export metrics |
| `--otel-enable-logs` | `true` | Export logs |
| `--otel-export-isolate-logs` | `true` | Export isolate `console.*` logs to OTEL |
| `--otel-export-interval-ms` | `5000` | Batch export interval |
| `--otel-export-timeout-ms` | `10000` | Export timeout |

All flags have corresponding environment variables prefixed with `EDGE_RUNTIME_`. For example, `--otel-enabled` maps to `EDGE_RUNTIME_OTEL_ENABLED`.

### Isolate logs routing

Thunder captures `console.log()`, `console.warn()`, `console.error()`, and other `console.*` calls from function isolates.

There are two destinations for these logs:

1. **stdout** -- when `--print-isolate-logs true` (default). Logs appear in the runtime process output.
2. **OTEL logs pipeline** -- when `--otel-export-isolate-logs true` and `--print-isolate-logs false`.

To route isolate logs to the OTEL pipeline, you must disable stdout printing:

```bash
thunder --otel-enabled start --print-isolate-logs false
```

If `--print-isolate-logs true` is set, logs go to stdout and the OTEL collector receives no isolate log events.

## Viewing telemetry in Grafana

Open Grafana at [http://localhost:3000](http://localhost:3000) and log in:

- **Username:** `admin`
- **Password:** `admin`

### Pre-configured datasources

The stack provisions these datasources automatically:

- VictoriaMetrics (default)
- Prometheus
- Loki
- Tempo

### Pre-configured dashboard

A dashboard called **"Edge Runtime - Observability Overview"** is provisioned automatically and provides a high-level view of runtime behavior.

### Exploring telemetry

**Traces:**
Navigate to Explore, select the Tempo datasource, and search by service name `thunder-local`. Each request generates a trace with spans for HTTP routing, function dispatch, and isolate execution.

**Logs:**
Select the Loki datasource and query:

```
{service_name="thunder-local"}
```

For isolate-specific logs:

```
{log_source="isolate"}
```

**Metrics:**
Select the Prometheus or VictoriaMetrics datasource. Example queries:

```promql
edge_runtime_isolate_logs_exported_total
```

## Runtime metrics endpoint

Thunder exposes a metrics endpoint on the admin listener, independent of the OTEL pipeline:

```bash
curl http://localhost:9000/_internal/metrics
```

This returns runtime and per-function metrics in JSON format. Use `?fresh=1` to force recomputation when validating recent load tests:

```bash
curl http://localhost:9000/_internal/metrics?fresh=1
```

The same data is available at the alias `/metrics` on the admin listener.

## Generating traffic for validation

After starting the stack and the runtime, deploy a function and send requests:

```bash
# Bundle and deploy
thunder bundle --entrypoint ./examples/hello/hello.ts --output ./hello.eszip

curl -X POST http://localhost:9000/_internal/functions \
  -H "x-function-name: hello" \
  --data-binary @./hello.eszip

# Generate traffic
for i in $(seq 1 50); do
  curl -s http://localhost:8080/hello > /dev/null
done
```

Then check Grafana for traces, logs, and metrics.

## Direct backend validation

You can also query backends directly to verify data flow:

| Endpoint | Purpose |
|----------|---------|
| `http://localhost:8888/metrics` | OTEL Collector internal metrics |
| `http://localhost:9464/metrics` | OTEL Collector Prometheus export |
| `http://localhost:3200/ready` | Tempo readiness |
| `http://localhost:3100/ready` | Loki readiness |
| `http://localhost:9090` | Prometheus UI |
| `http://localhost:8428/vmui` | VictoriaMetrics UI |
| `http://localhost:8429/targets` | vmagent scrape targets |

## Stopping the stack

Stop all services:

```bash
docker compose -f observability/docker-compose.yml down
```

Stop and remove all data volumes:

```bash
docker compose -f observability/docker-compose.yml down -v
```

## Troubleshooting

### No isolate logs in Loki

- Ensure the runtime started with `start --print-isolate-logs false`.
- Ensure `--otel-export-isolate-logs true` is set.
- Check collector logs: `docker logs edge-otel-collector`.

### No traces in Tempo

- Confirm `--otel-enabled` and `--otel-enable-traces true` are set.
- Verify the collector is receiving data: check `docker logs edge-otel-collector`.
- Confirm the OTEL endpoint is reachable: `curl http://127.0.0.1:4318/v1/traces`.

### No metrics in Prometheus

- Check targets at `http://localhost:9090/targets`.
- Ensure the collector is exposing metrics on port 9464.

### No metrics in VictoriaMetrics

- Check vmagent targets at `http://localhost:8429/targets`.
- Query VictoriaMetrics directly at `http://localhost:8428/vmui` for `otelcol_receiver_accepted_spans`.
