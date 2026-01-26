# Grafana + Tempo + Loki Observability Stack

This setup provides a local observability stack for viewing OpenTelemetry traces and logs together with full correlation.

## Architecture

```
┌─────────────────┐     OTLP      ┌──────────────────┐
│   CodeMachine   │──────────────▶│  OTel Collector  │
│   (traces+logs) │    :4319      │                  │
└─────────────────┘               └────────┬─────────┘
                                           │
                          ┌────────────────┼────────────────┐
                          ▼                                 ▼
                   ┌──────────┐                      ┌──────────┐
                   │  Tempo   │                      │   Loki   │
                   │ (traces) │                      │  (logs)  │
                   └────┬─────┘                      └────┬─────┘
                        │                                 │
                        └────────────┬────────────────────┘
                                     ▼
                              ┌──────────────┐
                              │   Grafana    │
                              │   :3000      │
                              └──────────────┘
```

## Quick Start

### Step 1: Start the stack

```bash
cd docker/observability
docker compose up -d
```

Wait ~30 seconds for services to initialize.

### Step 2: Verify services are running

```bash
docker compose ps
```

All 4 services should show "running": grafana, loki, otel-collector, tempo.

### Step 3: Send test traces and logs

```bash
# From the project root
DEBUG=true CODEMACHINE_TRACE=2 CODEMACHINE_TRACE_EXPORTER=otlp \
  CODEMACHINE_TRACE_OTLP_ENDPOINT=http://localhost:4319/v1/traces \
  bun -e "
import { initTracing, shutdownTracing, getCliTracer, withSpan } from './src/shared/tracing/index.js';
import { initOTelLogging, shutdownOTelLogging } from './src/shared/logging/otel-init.js';
import { appDebug } from './src/shared/logging/logger.js';

async function test() {
  await initOTelLogging();
  await initTracing();

  const tracer = getCliTracer();

  await withSpan(tracer, 'demo-operation', async (span) => {
    console.log('TraceID:', span.spanContext().traceId);
    appDebug('Starting demo operation');

    await withSpan(tracer, 'sub-task-1', async () => {
      appDebug('Executing sub-task 1');
      await new Promise(r => setTimeout(r, 100));
    });

    await withSpan(tracer, 'sub-task-2', async () => {
      appDebug('Executing sub-task 2');
      await new Promise(r => setTimeout(r, 50));
    });

    appDebug('Demo operation complete');
  });

  await new Promise(r => setTimeout(r, 3000));
  await shutdownOTelLogging();
  await shutdownTracing();
  console.log('Done! Check Grafana at http://localhost:3000');
}

test();
"
```

Or run the full CLI:
```bash
DEBUG=true CODEMACHINE_TRACE=2 CODEMACHINE_TRACE_EXPORTER=otlp \
  CODEMACHINE_TRACE_OTLP_ENDPOINT=http://localhost:4319/v1/traces \
  bun run dev --help
```

---

## Tutorial: Using Grafana

Open **http://localhost:3000** (login: `admin` / `admin`)

A pre-built **CodeMachine Observability** dashboard is automatically loaded as the home dashboard. It includes:
- **Error/Warning/Total log counts** - Quick status overview
- **Log Volume by Severity** - Time series chart showing log distribution
- **Recent Traces** - Table with clickable trace IDs
- **Application Logs** - Live log stream with expandable entries

### Viewing Traces in Tempo

1. Click **Explore** (compass icon in left sidebar)
2. Select **Tempo** from the datasource dropdown (top-left)
3. Choose the **Search** tab
4. Set filters:
   - **Service Name**: `codemachine`
   - Optionally set **Span Name**: `demo-operation`
5. Click **Run query** (blue button)
6. You'll see a list of traces with:
   - Trace ID
   - Root span name
   - Duration
   - Timestamp

7. **Click on a trace** to see the waterfall view:
   - Hierarchical span tree showing parent-child relationships
   - Duration bars for each span
   - Click any span to see its attributes and events

### Viewing Logs in Loki

1. In **Explore**, select **Loki** from the datasource dropdown
2. Enter a LogQL query:
   ```
   {service_name="codemachine"}
   ```
3. Click **Run query**
4. You'll see log entries with:
   - Timestamp
   - Log message (body)
   - Labels including `trace_id`, `span_id`, `severity_text`

5. **Useful LogQL queries:**
   ```logql
   # All logs from codemachine
   {service_name="codemachine"}

   # Only ERROR and WARN logs
   {service_name="codemachine"} | severity_text=~"ERROR|WARN"

   # Logs containing specific text
   {service_name="codemachine"} |= "sub-task"

   # Logs for a specific trace
   {service_name="codemachine", trace_id="YOUR_TRACE_ID"}
   ```

### Navigating Between Traces and Logs

#### Trace → Logs (see logs for a span)
1. Open a trace in Tempo
2. Click on any span in the waterfall view
3. In the span details panel, look for **Logs for this span** section
4. This shows all logs emitted during that span's execution

#### Log → Trace (jump to the trace)
1. View logs in Loki
2. Expand a log entry (click the `>` arrow)
3. Find the `trace_id` field
4. Click the **Tempo** link next to it to jump directly to the trace

---

## Customizing the Dashboard

The pre-built dashboard is a good starting point. Here's how to create your own or modify it.

### Creating a New Dashboard

1. Click **Dashboards** (four squares icon) in the left sidebar
2. Click **New** → **New Dashboard**
3. Click **Add visualization**

### Step 2: Add a Trace Search Panel

1. Select **Tempo** as the datasource
2. Choose visualization: **Table**
3. In the query:
   - Set **Service Name**: `codemachine`
   - Set **Limit**: `20`
4. Click **Apply**
5. Title the panel: "Recent Traces"

### Step 3: Add a Logs Panel

1. Click **Add** → **Visualization**
2. Select **Loki** as the datasource
3. Choose visualization: **Logs**
4. Enter query: `{service_name="codemachine"}`
5. Click **Apply**
6. Title the panel: "Application Logs"

### Step 4: Add a Log Volume Panel

1. Click **Add** → **Visualization**
2. Select **Loki** as the datasource
3. Choose visualization: **Time series**
4. Enter query:
   ```logql
   sum by (severity_text) (count_over_time({service_name="codemachine"}[1m]))
   ```
5. Click **Apply**
6. Title the panel: "Log Volume by Severity"

### Step 5: Add an Error Rate Panel

1. Click **Add** → **Visualization**
2. Select **Loki** as the datasource
3. Choose visualization: **Stat**
4. Enter query:
   ```logql
   count_over_time({service_name="codemachine", severity_text="ERROR"}[5m])
   ```
5. Set **Stat** options:
   - **Color mode**: Background
   - **Graph mode**: None
6. Add a threshold: Red when > 0
7. Title: "Errors (5m)"

### Step 6: Save the Dashboard

1. Click **Save dashboard** (disk icon, top-right)
2. Enter name: "CodeMachine Observability"
3. Click **Save**

### Example Dashboard Layout

```
┌─────────────────────────────────────────────────────────────┐
│  Errors (5m)  │  Warnings (5m)  │     Log Volume by Severity │
│      0        │        2        │         [Time Series]      │
├───────────────┴─────────────────┴────────────────────────────┤
│                      Recent Traces                           │
│  [Table: TraceID | Service | Operation | Duration | Time]    │
├──────────────────────────────────────────────────────────────┤
│                     Application Logs                         │
│  [Logs panel with expandable entries]                        │
└──────────────────────────────────────────────────────────────┘
```

### Pro Tips

1. **Variables**: Add a variable for time range to make the dashboard more flexible
   - Dashboard Settings → Variables → Add variable
   - Type: Interval, Values: `1m,5m,15m,1h,6h,24h`

2. **Annotations**: Add trace annotations to show when traces occurred
   - Dashboard Settings → Annotations → Add annotation query
   - Datasource: Tempo, enable "Show traces"

3. **Links**: Add data links to navigate from logs to traces
   - Panel settings → Data links → Add link
   - URL: `/explore?left={"datasource":"tempo","queries":[{"refId":"A","queryType":"traceql","query":"${__value.raw}"}]}`

---

## Ports Reference

| Service        | Port  | Description              |
|----------------|-------|--------------------------|
| Grafana        | 3000  | Web UI                   |
| OTel Collector | 4319  | OTLP HTTP endpoint       |
| Tempo          | 3200  | Tempo query API          |
| Tempo          | 4317  | OTLP gRPC (internal)     |
| Tempo          | 4318  | OTLP HTTP (internal)     |
| Loki           | 3100  | Loki API                 |

**Note**: Send your OTLP data to port `4319` (OTel Collector), not directly to Tempo.

---

## Configuration for CodeMachine

To send traces and logs to this stack:

```bash
export CODEMACHINE_TRACE=2
export CODEMACHINE_TRACE_EXPORTER=otlp
export CODEMACHINE_TRACE_OTLP_ENDPOINT=http://localhost:4319/v1/traces
export DEBUG=true  # Enable debug-level logging
```

Or in a single command:
```bash
DEBUG=true CODEMACHINE_TRACE=2 CODEMACHINE_TRACE_EXPORTER=otlp \
  CODEMACHINE_TRACE_OTLP_ENDPOINT=http://localhost:4319/v1/traces \
  bun run dev
```

---

## Cleanup

```bash
# Stop containers
docker compose down

# Stop and remove volumes (deletes all data)
docker compose down -v
```

---

## Troubleshooting

### Check service logs
```bash
docker compose logs tempo
docker compose logs loki
docker compose logs otel-collector
docker compose logs grafana
```

### Verify OTel Collector is receiving data
```bash
docker logs observability-otel-collector-1 2>&1 | tail -50
```
You should see `LogRecord` and `Span` entries in the debug output.

### Verify Tempo has traces
```bash
curl -s "http://localhost:3200/api/search" | jq
```

### Verify Loki has logs
```bash
curl -s "http://localhost:3100/loki/api/v1/labels"
# Should include "service_name" if logs were received
```

### Common Issues

**No traces appearing:**
- Check that CODEMACHINE_TRACE_OTLP_ENDPOINT points to port 4319 (not 4318)
- Ensure the OTel Collector is running: `docker compose ps`

**No logs appearing:**
- Ensure DEBUG=true is set (enables debug-level logging)
- Check OTel Collector logs for errors

**Cannot correlate logs to traces:**
- Logs must be emitted within an active span to have trace correlation
- Early boot logs (before tracing init) won't have trace_id/span_id

---

## Importing Bug Reports

Users can share their telemetry files for debugging. The import tool loads JSON files into the observability stack.

### User: Collecting Telemetry for Bug Report

Tell users to include these files from their project:
```
.codemachine/traces/
├── latest.json          # Trace spans
├── latest-logs.json     # Log entries
└── YYYY-MM-DD/          # Historical sessions
    ├── HH-MM-SS.json
    └── HH-MM-SS-logs.json
```

They can zip the entire `.codemachine/traces/` directory.

### Developer: Importing the Bug Report

1. **Start the observability stack** (if not running):
   ```bash
   cd docker/observability && docker compose up -d
   ```

2. **Extract the user's trace files** to a directory (e.g., `~/bug-reports/issue-123/`)

3. **Run the import script**:
   ```bash
   # From project root
   bun run import-telemetry ~/bug-reports/issue-123/traces

   # Or directly
   bun scripts/import-telemetry.ts ~/bug-reports/issue-123/traces
   ```

4. **View in Grafana** at http://localhost:3000
   - Imported logs have label `imported="true"`
   - Query: `{service_name="codemachine", imported="true"}`

### Import Script Options

```bash
bun scripts/import-telemetry.ts <path> [options]

Options:
  --loki-url <url>   Loki URL (default: http://localhost:3100)
  --tempo-url <url>  Tempo OTLP URL (default: http://localhost:4318)
  --logs-only        Only import logs
  --traces-only      Only import traces

Examples:
  # Import from user's bug report
  bun scripts/import-telemetry.ts ~/Downloads/bug-report-traces/

  # Import only logs
  bun scripts/import-telemetry.ts ./traces --logs-only

  # Import to remote stack
  bun scripts/import-telemetry.ts ./traces --loki-url http://192.168.1.100:3100
```

### Viewing Imported Data

Imported data is tagged to distinguish it from live data:

**Logs:**
```logql
# All imported logs
{service_name="codemachine", imported="true"}

# Imported errors only
{service_name="codemachine", imported="true", severity_text="ERROR"}

# Search imported logs
{service_name="codemachine", imported="true"} |= "error message"
```

**Traces:**
- Service name: `codemachine`
- Look for `bug-report-operation` or user's operation names
- Use the Tempo Search tab with Service Name filter
