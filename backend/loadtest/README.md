# Load test

Closed-loop virtual farmers. Each one logs in once, then repeats a realistic mix of requests
(assistant questions, weather, mandi prices, schemes, crop advice, profile) with about 1 s of
thinking time between them. The test reports throughput, p50, p95 and p99 latency per
endpoint, the error rate, and the CPU used by the server processes.

```powershell
# one instance
python -m loadtest.loadtest --url http://127.0.0.1:8001 --users 100 300 --duration 45

# behind a load balancer: count CPU for the balancer and every instance
python -m loadtest.loadtest --url http://127.0.0.1:8080 --server-ports 8080 8001 8002 8003 --users 100 300
```

A single Python load generator tops out at about one CPU core (roughly 120 requests per
second). For more load, run several generators side by side.

## Measured on the development PC (2 October 2026)

Setup:
- One Windows 11 laptop, 16 logical CPUs.
- Local PostgreSQL 16 with `max_connections=100`.
- The models served were `crop_v3`, `yield_v3`, `disease_v1` and `pest_v1`.
- Load balancing used three API instances with 2 workers each, `DB_POOL_SIZE=5` and `DB_MAX_OVERFLOW=5`.

| Through | Farmers | Requests | Errors | p50 | p95 | p99 |
|---|---|---|---|---|---|---|
| One instance, direct | 100 | 2,696 | 0 % | 90 ms | 326 ms | 584 ms |
| Caddy, `least_conn`, 3 instances | 100 | 4,409 | 0 % | 23 ms | 71 ms | 106 ms |
| Caddy, 3 instances, 4 generators | 1,000 | 13,182 | 0 % | ≈1.8 s | ≈7 s | ≈11 s |

At 1,000 farmers the single PC is saturated: about 81% CPU in total, with 3.8 cores spent on the
load generators themselves. Throughput is about 270 req/s for six workers, so on this hardware one worker handles
about 45 req/s, or roughly 55 active farmers at low latency. Capacity grows by adding
replicas (`API_REPLICAS`) and workers (`WEB_CONCURRENCY`) on more cores. With 1,000 users
nothing failed: everything queued and was answered.

Findings that changed the code:

* **XGBoost used all 16 cores per prediction.** For a single row this only adds OpenMP
  spin-waiting: 54.6 ms of CPU per crop prediction versus 7.4 ms single-threaded, and
  single-threaded was also faster in wall time. The serving runtime now pins boosters to one
  thread. Per-request server CPU fell about 4×.
* **PostgreSQL ran out of connections** ("too many clients") with the development pool size
  (10 + 20 per worker × 6 workers). Size the pools to the budget in `deploy/docker-compose.yml`
  (replicas × workers × (pool + overflow) < `max_connections`), or put PgBouncer in front for
  large fleets. Running out of connections now returns **503 `service_busy` with
  `Retry-After`** instead of a 500. `DB_POOL_TIMEOUT_SECONDS` (10 s) makes requests fail fast
  instead of queueing forever.
* **nginx for Windows is not a meaningful benchmark.** It uses `select()` with a single worker
  (p95 5.9 s at 100 users, against 71 ms through Caddy on the same instances). Production runs
  the official nginx Docker image on Linux. Its configuration (`deploy/nginx.conf`) was
  validated with `nginx -t` (1.28), and requests were spread exactly evenly (10/10/10) over
  three instances in a local run. `/metrics` is blocked at the edge, and each request carries
  one `X-Request-ID` end to end.
