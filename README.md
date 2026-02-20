# Money Muling Detection Engine

A FastAPI backend that ingests financial transaction data and applies graph-based
algorithms to flag money-muling patterns with deterministic suspicion scoring.

---

## Quick Start

```bash
# Install dependencies
pip install fastapi uvicorn pandas networkx python-multipart

# Run the server
uvicorn main:app --host 0.0.0.0 --port 8000 --reload

# Interactive API docs
open http://localhost:8000/docs
```

---

## API Usage

### 1 — Upload transactions

```bash
curl -X POST http://localhost:8000/upload \
     -F "file=@transactions.csv"
```

**CSV format** (required columns):

| Column         | Type    | Example                  |
|----------------|---------|--------------------------|
| transaction_id | string  | `txn_001`                |
| sender_id      | string  | `acct_A`                 |
| receiver_id    | string  | `acct_B`                 |
| amount         | float   | `1500.00`                |
| timestamp      | ISO8601 | `2024-01-15T08:30:00Z`   |

### 2 — Run analysis

```bash
curl http://localhost:8000/analysis
# Optional: filter by minimum suspicion score
curl "http://localhost:8000/analysis?min_score=50"
```

**Response schema:**

```json
{
  "suspicious_accounts": [
    {
      "account_id": "acct_X",
      "suspicion_score": 87.3,
      "flags": ["circular_routing", "smurfing"],
      "transaction_count": 42,
      "total_volume": 190500.0
    }
  ],
  "fraud_rings": [
    {
      "ring_id": "cycle_0000",
      "pattern_type": "circular_routing",
      "accounts": ["acct_A", "acct_B", "acct_C"],
      "evidence": {"cycle_length": 3}
    }
  ],
  "metadata": {
    "processing_time_seconds": 1.243,
    "total_nodes": 512,
    "total_edges": 10000,
    "transactions_analyzed": 10000
  }
}
```

---

## Detection Algorithms & Complexity

### 1. Circular Routing

**What it detects:** Directed cycles of length 3–5 (A → B → C → A).

**Algorithm:** Johnson's Algorithm, implemented via `networkx.simple_cycles()`.

- **Time complexity:** O((V + E)(C + 1)) where V = nodes, E = edges, C = number of simple cycles.
- **Why Johnson's?** Tarjan's SCC is O(V + E) but only finds *strongly connected components*, not individual cycles of bounded length. Johnson's enumerates all simple cycles without redundancy, making post-filtering by length efficient.
- For sparse financial graphs (typical fan-out ≤ 20), the algorithm runs in near-linear time in practice.

### 2. Smurfing (Fan-in / Fan-out)

**What it detects:** Any account that, within a rolling 72-hour window, aggregates funds from 10+ unique senders **or** disperses funds to 10+ unique receivers.

**Algorithm:** Sort edges by timestamp → sliding-window scan per account.

- **Time complexity:** O(E log E) — dominated by the sort step; the per-node window scan is O(k²) where k = edges per account (small in practice).
- **Payroll guard:** Fan-out is not flagged when `|total_out − total_in| / max(total_out, total_in) < 0.20`. This prevents legitimate payroll processors from being flagged.

### 3. Layered Shells

**What it detects:** Transaction chains of 3+ hops where every *intermediate* account has a total transaction degree ≤ 3 (thin connectors typical of nominee / shell accounts).

**Algorithm:** DFS from every node, pruning branches where intermediate degree exceeds the threshold.

- **Time complexity:** O(V + E) for degree pre-computation + O(V · d^h) for DFS where d = average out-degree and h = max hop depth (5 in practice). Effectively linear for sparse graphs.

### 4. Suspicion Scoring

```
score = (cycle_weight × in_cycle) +
        (velocity_weight × tx_count / p95_local) +
        (volume_weight × own_volume / (2 × local_mean))

Normalised to [0, 100].
```

| Component    | Weight | Rationale                                       |
|--------------|--------|-------------------------------------------------|
| Cycle        | 45 %   | Circular routing is the strongest fraud signal  |
| Velocity     | 25 %   | High frequency relative to peers is suspicious  |
| Volume       | 30 %   | Outlier volume in local subgraph signals layering|

Scores are **deterministic**: same input CSV always produces identical output
because accounts are sorted lexicographically before scoring, and all
aggregations use pandas deterministic groupby.

---

## Module Structure

```
.
├── main.py        — FastAPI routes, CSV validation, state management
├── detector.py    — Graph construction + all three detection algorithms + scoring
├── models.py      — Pydantic request/response models
└── README.md
```

---

## Performance Notes

| Dataset size | Expected processing time |
|-------------|--------------------------|
| 1 000 rows  | < 1 s                    |
| 10 000 rows | < 10 s (well within 30 s SLA) |
| 100 000 rows| ~60–120 s (switch to Dask + rustworkx at this scale) |

- For 10 k rows, pandas is preferred over Dask due to lower scheduling overhead.
- For > 100 k rows, replace `pd.read_csv` with `dask.dataframe.read_csv` and
  `nx.MultiDiGraph` with `rustworkx.PyDiGraph` (C++ backend, ~10× faster cycle detection).
