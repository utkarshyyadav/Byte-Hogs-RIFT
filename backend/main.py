"""
money_muling_engine.py — RIFT 2026 Hackathon Submission
Graph-Based Financial Crime Detection Engine

JSON output format, field names, ring ID format, cycle lengths, smurfing fan-in/fan-out,
shell hop counts, and false-positive guards all match the problem statement exactly.
"""

import io
import logging
import math
import time
import concurrent.futures
from typing import Any, Dict, List, Set, Tuple

import networkx as nx
import pandas as pd
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

# =============================================================================
# Logging
# =============================================================================

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
)
logger = logging.getLogger("muling_engine")

# =============================================================================
# Configuration — all tunable constants in one place
# =============================================================================

class Config:
    # Required CSV columns
    REQUIRED_COLUMNS: Set[str] = {
        "transaction_id", "sender_id", "receiver_id", "amount", "timestamp"
    }
    ID_COLUMNS: Tuple[str, ...] = ("transaction_id", "sender_id", "receiver_id")

    # ── Circular routing (PDF §Detection Pattern 1) ──────────────────────────
    CYCLE_MIN_LEN: int = 3
    CYCLE_MAX_LEN: int = 5          # PDF specifies exactly 3–5

    # ── Smurfing (PDF §Detection Pattern 2) ──────────────────────────────────
    SMURF_MIN_COUNTERPARTIES: int = 10   # 10+ senders (fan-in) or receivers (fan-out)
    SMURF_WINDOW_HOURS: int = 72

    # ── Layered shells (PDF §Detection Pattern 3) ─────────────────────────────
    SHELL_MIN_HOPS: int = 3              # chains of 3+ hops
    SHELL_MAX_TX_PER_NODE: int = 3       # intermediate accounts with ≤ 3 total txns (PDF: "2–3")
    SHELL_MAX_DEPTH: int = 8             # DFS recursion cap

    # ── False-positive guards ─────────────────────────────────────────────────
    # High-volume legitimate accounts: top N% by transaction count are excluded
    # from shell/smurfing flags (they are merchants or payroll systems).
    # They CAN still be flagged for cycle membership (genuine structural signal).
    MERCHANT_PERCENTILE: float = 97.0
    MERCHANT_MIN_TX: int = 50

    # ── Suspicion scoring weights (must sum to 1.0) ───────────────────────────
    W_CYCLE:    float = 0.40
    W_SMURF:    float = 0.30
    W_SHELL:    float = 0.15
    W_VOLUME:   float = 0.15

    # Volume normalisation (log scale denominator)
    VOLUME_LOG_SCALE: float = 1_000_000.0


CFG = Config()

# =============================================================================
# Pydantic models — field names match the PDF's required JSON format EXACTLY
# =============================================================================

class SuspiciousAccount(BaseModel):
    account_id: str
    suspicion_score: float              # 0–100, sorted descending
    detected_patterns: List[str]        # e.g. ["cycle_length_3", "high_velocity"]
    ring_id: str                        # e.g. "RING_001"

class FraudRing(BaseModel):
    ring_id: str                        # e.g. "RING_001"
    member_accounts: List[str]
    pattern_type: str                   # "cycle" | "smurfing" | "layered_shells"
    risk_score: float                   # 0–100

class Summary(BaseModel):
    total_accounts_analyzed: int
    suspicious_accounts_flagged: int
    fraud_rings_detected: int
    processing_time_seconds: float

class AnalysisResponse(BaseModel):
    suspicious_accounts: List[SuspiciousAccount]
    fraud_rings: List[FraudRing]
    summary: Summary

class UploadResponse(BaseModel):
    status: str
    transactions_loaded: int

# =============================================================================
# Helpers
# =============================================================================

def _canonical_cycle(cycle: List[str]) -> Tuple[str, ...]:
    """Rotate so smallest node leads — stable deduplication key."""
    min_i = cycle.index(min(cycle))
    return tuple(cycle[min_i:] + cycle[:min_i])


def _log_volume_score(volume: float, scale: float) -> float:
    if volume <= 0:
        return 0.0
    return min(math.log1p(volume) / math.log1p(scale), 1.0)


def _ring_id(index: int) -> str:
    """PDF specifies format RING_001, RING_002, …"""
    return f"RING_{index + 1:03d}"


def _build_merchant_whitelist(count_map: Dict[str, int]) -> Set[str]:
    """
    Accounts in the top MERCHANT_PERCENTILE by tx count AND above MERCHANT_MIN_TX
    are treated as legitimate high-volume merchants / payroll accounts and
    excluded from smurfing + shell flags.
    PDF requirement: 'MUST NOT flag legitimate high-volume merchants or payroll accounts'.
    """
    if not count_map:
        return set()
    counts = sorted(count_map.values())
    threshold_idx = int(len(counts) * CFG.MERCHANT_PERCENTILE / 100)
    percentile_val = counts[min(threshold_idx, len(counts) - 1)]
    threshold = max(CFG.MERCHANT_MIN_TX, percentile_val)
    return {acct for acct, cnt in count_map.items() if cnt >= threshold}

# =============================================================================
# Detection 1 — Circular Routing (PDF §1)
# =============================================================================

def detect_circular_routing(G: nx.MultiDiGraph) -> List[List[str]]:
    """
    Simple cycles of length 3–5 (PDF: 'Detect cycles of length 3 to 5').
    Iterative pruning removes nodes that cannot be part of any cycle.
    """
    simple_G = nx.DiGraph(G)

    changed = True
    while changed:
        low = [n for n in simple_G if simple_G.degree(n) < 2]
        simple_G.remove_nodes_from(low)
        changed = bool(low)

    cycles: List[List[str]] = []
    seen: Set[Tuple[str, ...]] = set()

    for cycle in nx.simple_cycles(simple_G):
        if CFG.CYCLE_MIN_LEN <= len(cycle) <= CFG.CYCLE_MAX_LEN:
            key = _canonical_cycle(cycle)
            if key not in seen:
                seen.add(key)
                cycles.append(cycle)

    logger.info("Cycles: %d unique rings found", len(cycles))
    return cycles

# =============================================================================
# Detection 2 — Smurfing: Fan-in AND Fan-out (PDF §2)
# =============================================================================

def _sliding_window_check(
    grp: pd.DataFrame,
    counterpart_col: str,
    window_hours: int,
    threshold: int,
) -> Tuple[bool, int, float, str]:
    """
    Two-pointer sliding window. Returns (found, unique_counterparts, amount, window_start).
    O(n) per group after sort.
    """
    grp = grp.reset_index(drop=True)
    left = 0
    cp_counts: Dict[str, int] = {}
    window_amt = 0.0

    for right in range(len(grp)):
        cp  = grp.at[right, counterpart_col]
        amt = grp.at[right, "amount"]
        cp_counts[cp] = cp_counts.get(cp, 0) + 1
        window_amt += amt

        cutoff = grp.at[right, "timestamp"] - pd.Timedelta(hours=window_hours)
        while grp.at[left, "timestamp"] < cutoff:
            old_cp = grp.at[left, counterpart_col]
            cp_counts[old_cp] -= 1
            if cp_counts[old_cp] == 0:
                del cp_counts[old_cp]
            window_amt -= grp.at[left, "amount"]
            left += 1

        if len(cp_counts) >= threshold:
            return True, len(cp_counts), round(window_amt, 2), str(grp.at[left, "timestamp"])

    return False, 0, 0.0, ""


def detect_smurfing(
    df: pd.DataFrame,
    whitelist: Set[str],
) -> Dict[str, Dict[str, Any]]:
    """
    Fan-in:  ≥10 unique senders → 1 receiver within 72 h
    Fan-out: 1 sender → ≥10 unique receivers within 72 h
    Both checked; whitelisted accounts skipped.
    """
    df_t = df[["receiver_id", "sender_id", "amount", "timestamp"]].copy()
    df_t["timestamp"] = pd.to_datetime(df_t["timestamp"], utc=True, errors="coerce")
    dropped = df_t["timestamp"].isna().sum()
    if dropped:
        logger.warning("Smurfing: %d rows with unparseable timestamps dropped", dropped)
    df_t = df_t.dropna(subset=["timestamp"]).sort_values("timestamp").reset_index(drop=True)

    flagged: Dict[str, Dict[str, Any]] = {}

    # Fan-in: focal = receiver, counterpart = sender
    for receiver, grp in df_t.groupby("receiver_id", sort=False):
        if str(receiver) in whitelist:
            continue
        found, cnt, amt, ws = _sliding_window_check(
            grp, "sender_id", CFG.SMURF_WINDOW_HOURS, CFG.SMURF_MIN_COUNTERPARTIES
        )
        if found:
            flagged[str(receiver)] = {"pattern": "fan_in", "fan_count": cnt, "amount": amt, "window_start": ws}

    # Fan-out: focal = sender, counterpart = receiver
    for sender, grp in df_t.groupby("sender_id", sort=False):
        if str(sender) in whitelist or str(sender) in flagged:
            continue
        found, cnt, amt, ws = _sliding_window_check(
            grp, "receiver_id", CFG.SMURF_WINDOW_HOURS, CFG.SMURF_MIN_COUNTERPARTIES
        )
        if found:
            flagged[str(sender)] = {"pattern": "fan_out", "fan_count": cnt, "amount": amt, "window_start": ws}

    logger.info("Smurfing: %d accounts flagged", len(flagged))
    return flagged

# =============================================================================
# Detection 3 — Layered Shell Networks (PDF §3)
# =============================================================================

def detect_layered_shells(
    G: nx.MultiDiGraph,
    count_map: Dict[str, int],
    whitelist: Set[str],
) -> List[List[str]]:
    """
    Chains of 3+ hops where INTERIOR nodes have ≤ SHELL_MAX_TX_PER_NODE transactions.
    PDF: 'chains of 3+ hops where intermediate accounts have only 2–3 total transactions'.
    Chain head and tail are not constrained.
    """

    def is_shell_interior(node: str) -> bool:
        return (
            node not in whitelist
            and count_map.get(str(node), 0) <= CFG.SHELL_MAX_TX_PER_NODE
        )

    candidate_nodes = {n for n in G.nodes() if str(n) not in whitelist}
    sub_G: nx.DiGraph = nx.DiGraph(G.subgraph(candidate_nodes))

    chains: List[List[str]] = []
    seen: Set[Tuple[str, ...]] = set()

    def dfs(node: str, path: List[str]) -> None:
        if len(path) >= CFG.SHELL_MIN_HOPS:
            interior = path[1:-1]
            if interior and all(is_shell_interior(n) for n in interior):
                key = tuple(path)
                if key not in seen:
                    seen.add(key)
                    chains.append(list(path))

        if len(path) < CFG.SHELL_MAX_DEPTH:
            for succ in sub_G.successors(node):
                if succ not in path:
                    path.append(succ)
                    dfs(succ, path)
                    path.pop()

    # Start from nodes with no incoming edges (chain heads)
    chain_heads = [n for n in sub_G if sub_G.in_degree(n) == 0]
    if not chain_heads:
        chain_heads = list(sub_G.nodes())

    for head in chain_heads:
        dfs(head, [head])

    logger.info("Shell chains: %d found", len(chains))
    return chains

# =============================================================================
# Pattern label builder
# =============================================================================

def _detected_patterns(
    in_cycle: bool,
    cycle_len: int,
    smurf_info: Dict[str, Any],
    in_shell: bool,
    volume: float,
) -> List[str]:
    """
    Returns descriptive string labels.
    PDF example: ["cycle_length_3", "high_velocity"].
    """
    patterns = []
    if in_cycle and cycle_len:
        patterns.append(f"cycle_length_{cycle_len}")
    if smurf_info:
        pat = smurf_info.get("pattern", "fan_in")
        patterns.append("high_velocity" if pat == "fan_in" else "fan_out")
    if in_shell:
        patterns.append("layered_shell")
    if volume > 500_000:
        patterns.append("high_volume")
    return sorted(patterns)

# =============================================================================
# Core Analysis Engine
# =============================================================================

def _validate(df: pd.DataFrame) -> None:
    missing = CFG.REQUIRED_COLUMNS - set(df.columns)
    if missing:
        raise ValueError(f"Missing required columns: {sorted(missing)}")
    if df.empty:
        raise ValueError("CSV contains no data rows.")


def run_full_analysis(df: pd.DataFrame) -> Dict[str, Any]:
    _validate(df)
    start = time.perf_counter()

    # ── Pre-compute per-account volume & tx-count maps ────────────────────────
    in_vol  = df.groupby("receiver_id")["amount"].sum()
    out_vol = df.groupby("sender_id")["amount"].sum()
    vol_map: Dict[str, float] = in_vol.add(out_vol, fill_value=0).to_dict()

    in_cnt  = df.groupby("receiver_id")["transaction_id"].count()
    out_cnt = df.groupby("sender_id")["transaction_id"].count()
    cnt_map: Dict[str, int] = in_cnt.add(out_cnt, fill_value=0).astype(int).to_dict()

    whitelist = _build_merchant_whitelist(cnt_map)
    logger.info("Merchant whitelist: %d accounts", len(whitelist))

    # ── Build graph ───────────────────────────────────────────────────────────
    G = nx.MultiDiGraph()
    G.add_edges_from([
        (str(r.sender_id), str(r.receiver_id), {"amount": r.amount})
        for r in df.itertuples()
    ])
    total_accounts = G.number_of_nodes()
    logger.info("Graph: %d nodes, %d edges", total_accounts, G.number_of_edges())

    # ── Run detectors in parallel ─────────────────────────────────────────────
    with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
        f_cycles = pool.submit(detect_circular_routing, G)
        f_smurf  = pool.submit(detect_smurfing, df, whitelist)
        f_shells = pool.submit(detect_layered_shells, G, cnt_map, whitelist)
        cycles       = f_cycles.result()
        smurf_map    = f_smurf.result()
        shell_chains = f_shells.result()

    # ── Assign RING_xxx IDs ───────────────────────────────────────────────────
    ring_counter = 0
    fraud_rings_raw: List[Dict[str, Any]] = []
    acct_to_ring: Dict[str, str] = {}       # first ring assignment wins
    acct_to_cycle_len: Dict[str, int] = {}

    for cycle in cycles:
        rid = _ring_id(ring_counter); ring_counter += 1
        fraud_rings_raw.append({
            "ring_id": rid, "member_accounts": list(cycle),
            "pattern_type": "cycle",
        })
        for acct in cycle:
            acct_to_ring.setdefault(acct, rid)
            acct_to_cycle_len[acct] = len(cycle)

    for chain in shell_chains:
        rid = _ring_id(ring_counter); ring_counter += 1
        fraud_rings_raw.append({
            "ring_id": rid, "member_accounts": list(chain),
            "pattern_type": "layered_shells",
        })
        for acct in chain[1:-1]:    # interior only
            acct_to_ring.setdefault(acct, rid)

    for acct in smurf_map:
        if acct not in acct_to_ring:
            rid = _ring_id(ring_counter); ring_counter += 1
            fraud_rings_raw.append({
                "ring_id": rid, "member_accounts": [acct],
                "pattern_type": "smurfing",
            })
            acct_to_ring[acct] = rid

    # ── Score each flagged account ────────────────────────────────────────────
    cycle_nodes = set(acct_to_cycle_len.keys())
    shell_nodes = {n for c in shell_chains if len(c) > 2 for n in c[1:-1]}
    all_flagged = cycle_nodes | set(smurf_map.keys()) | shell_nodes

    score_map: Dict[str, float] = {}
    suspicious_out: List[Dict[str, Any]] = []

    for acct in all_flagged:
        in_cycle = acct in cycle_nodes
        in_smurf = acct in smurf_map
        in_shell = acct in shell_nodes
        vol      = vol_map.get(acct, 0.0)

        score = round(min(
            CFG.W_CYCLE  * (100.0 if in_cycle else 0.0) +
            CFG.W_SMURF  * (100.0 if in_smurf else 0.0) +
            CFG.W_SHELL  * (100.0 if in_shell else 0.0) +
            CFG.W_VOLUME * _log_volume_score(vol, CFG.VOLUME_LOG_SCALE) * 100.0,
            100.0,
        ), 2)

        score_map[acct] = score

        suspicious_out.append({
            "account_id":        acct,
            "suspicion_score":   score,
            "detected_patterns": _detected_patterns(
                in_cycle, acct_to_cycle_len.get(acct, 0),
                smurf_map.get(acct, {}), in_shell, vol,
            ),
            "ring_id": acct_to_ring.get(acct, "NONE"),
        })

    # Sorted descending — PDF requirement
    suspicious_out.sort(key=lambda x: x["suspicion_score"], reverse=True)

    # ── Attach risk_score to each ring ────────────────────────────────────────
    fraud_rings_out: List[Dict[str, Any]] = []
    for ring in fraud_rings_raw:
        members = ring["member_accounts"]
        avg_score = (
            round(sum(score_map.get(m, 0.0) for m in members) / len(members), 1)
            if members else 0.0
        )
        fraud_rings_out.append({
            "ring_id":         ring["ring_id"],
            "member_accounts": members,
            "pattern_type":    ring["pattern_type"],
            "risk_score":      avg_score,
        })

    elapsed = round(time.perf_counter() - start, 4)
    logger.info("Done %.4fs — %d suspicious, %d rings", elapsed, len(suspicious_out), len(fraud_rings_out))

    return {
        "suspicious_accounts": suspicious_out,
        "fraud_rings":         fraud_rings_out,
        "summary": {
            "total_accounts_analyzed":     total_accounts,
            "suspicious_accounts_flagged": len(suspicious_out),
            "fraud_rings_detected":        len(fraud_rings_out),
            "processing_time_seconds":     elapsed,
        },
    }

# =============================================================================
# FastAPI
# =============================================================================

app = FastAPI(title="RIFT 2026 — Money Muling Detection Engine")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

_state: Dict[str, Any] = {"df": None}


@app.get("/")
async def root() -> Dict[str, str]:
    return {"message": "Welcome to the Money Muling Detection Engine! POST a CSV to /upload and then GET /analysis."}

@app.get("/health")
async def health() -> Dict[str, str]:
    return {"status": "ok"}


@app.post("/upload", response_model=UploadResponse)
async def upload(file: UploadFile = File(...)) -> UploadResponse:
    if not file.filename.lower().endswith(".csv"):
        raise HTTPException(status_code=415, detail="Only CSV files accepted.")
    try:
        content = await file.read()
        df = pd.read_csv(io.BytesIO(content))
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Cannot parse CSV: {exc}") from exc

    for col in CFG.ID_COLUMNS:
        if col in df.columns:
            df[col] = df[col].astype(str).str.strip()

    missing = CFG.REQUIRED_COLUMNS - set(df.columns)
    if missing:
        raise HTTPException(status_code=422, detail=f"Missing columns: {sorted(missing)}")

    _state["df"] = df
    logger.info("Loaded '%s' — %d rows", file.filename, len(df))
    return UploadResponse(status="ok", transactions_loaded=len(df))


@app.get("/analysis")
async def analysis(min_score: float = 0.0) -> JSONResponse:
    if _state["df"] is None:
        raise HTTPException(status_code=400, detail="No data — POST a CSV to /upload first.")
    if not (0.0 <= min_score <= 100.0):
        raise HTTPException(status_code=422, detail="min_score must be 0–100.")
    try:
        results = run_full_analysis(_state["df"])
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    results["suspicious_accounts"] = [
        a for a in results["suspicious_accounts"] if a["suspicion_score"] >= min_score
    ]
    return JSONResponse(content=results)


@app.get("/download")
async def download_json(min_score: float = 0.0) -> JSONResponse:
    """
    PDF mandates a Download JSON button on the UI — wire it to this endpoint.
    Returns the analysis as a downloadable .json file attachment.
    """
    if _state["df"] is None:
        raise HTTPException(status_code=400, detail="No data loaded.")
    try:
        results = run_full_analysis(_state["df"])
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    results["suspicious_accounts"] = [
        a for a in results["suspicious_accounts"] if a["suspicion_score"] >= min_score
    ]
    return JSONResponse(
        content=results,
        headers={"Content-Disposition": "attachment; filename=muling_analysis.json"},
    )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=False)