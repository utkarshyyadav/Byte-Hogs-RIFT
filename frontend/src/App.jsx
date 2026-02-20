const API_BASE = "http://localhost:8000";

import { useState, useMemo, useEffect, useRef } from "react";

const MOCK_SUMMARY = {
  totalAccounts: 8472,
  suspiciousAccounts: 214,
  fraudRings: 7,
  processingTime: 2.34,
};

const MOCK_RINGS = [
  {
    id: "RING_001", pattern: "cycle", riskScore: 94,
    members: ["ACC_0041","ACC_0088","ACC_0113","ACC_0244"],
    nodes: [
      { id:"ACC_0041", x:150, y:80,  score:94 },
      { id:"ACC_0088", x:280, y:180, score:87 },
      { id:"ACC_0113", x:150, y:280, score:91 },
      { id:"ACC_0244", x:20,  y:180, score:78 },
    ],
    edges:[["ACC_0041","ACC_0088"],["ACC_0088","ACC_0113"],["ACC_0113","ACC_0244"],["ACC_0244","ACC_0041"]],
  },
  {
    id: "RING_002", pattern: "smurfing", riskScore: 88,
    members: ["ACC_0320","ACC_0321","ACC_0322","ACC_0323","ACC_0324","ACC_0500"],
    nodes: [
      { id:"ACC_0500", x:155, y:160, score:88 },
      { id:"ACC_0320", x:280, y:60,  score:71 },
      { id:"ACC_0321", x:305, y:190, score:69 },
      { id:"ACC_0322", x:215, y:285, score:73 },
      { id:"ACC_0323", x:90,  y:285, score:68 },
      { id:"ACC_0324", x:10,  y:155, score:72 },
    ],
    edges:[["ACC_0320","ACC_0500"],["ACC_0321","ACC_0500"],["ACC_0322","ACC_0500"],["ACC_0323","ACC_0500"],["ACC_0324","ACC_0500"]],
  },
  {
    id: "RING_003", pattern: "layered_shell", riskScore: 79,
    members: ["ACC_0700","ACC_0701","ACC_0702","ACC_0703","ACC_0704","ACC_0705"],
    nodes: [
      { id:"ACC_0700", x:30,  y:140, score:79 },
      { id:"ACC_0701", x:140, y:60,  score:65 },
      { id:"ACC_0702", x:140, y:220, score:63 },
      { id:"ACC_0703", x:260, y:60,  score:57 },
      { id:"ACC_0704", x:260, y:220, score:54 },
      { id:"ACC_0705", x:360, y:140, score:48 },
    ],
    edges:[["ACC_0700","ACC_0701"],["ACC_0700","ACC_0702"],["ACC_0701","ACC_0703"],["ACC_0702","ACC_0704"],["ACC_0703","ACC_0705"],["ACC_0704","ACC_0705"]],
  },
  {
    id:"RING_004", pattern:"cycle", riskScore:76,
    members:["ACC_1001","ACC_1002","ACC_1003"],
    nodes:[{ id:"ACC_1001",x:150,y:50,score:76 },{ id:"ACC_1002",x:260,y:200,score:72 },{ id:"ACC_1003",x:40,y:200,score:69 }],
    edges:[["ACC_1001","ACC_1002"],["ACC_1002","ACC_1003"],["ACC_1003","ACC_1001"]],
  },
  {
    id:"RING_005", pattern:"smurfing", riskScore:71,
    members:["ACC_2001","ACC_2002","ACC_2003","ACC_2004"],
    nodes:[{ id:"ACC_2001",x:160,y:160,score:71 },{ id:"ACC_2002",x:280,y:70,score:55 },{ id:"ACC_2003",x:280,y:255,score:58 },{ id:"ACC_2004",x:40,y:160,score:52 }],
    edges:[["ACC_2002","ACC_2001"],["ACC_2003","ACC_2001"],["ACC_2004","ACC_2001"]],
  },
  {
    id:"RING_006", pattern:"layered_shell", riskScore:65,
    members:["ACC_3001","ACC_3002","ACC_3003","ACC_3004"],
    nodes:[{ id:"ACC_3001",x:30,y:130,score:65 },{ id:"ACC_3002",x:150,y:60,score:55 },{ id:"ACC_3003",x:150,y:200,score:53 },{ id:"ACC_3004",x:280,y:130,score:45 }],
    edges:[["ACC_3001","ACC_3002"],["ACC_3001","ACC_3003"],["ACC_3002","ACC_3004"],["ACC_3003","ACC_3004"]],
  },
  {
    id:"RING_007", pattern:"cycle", riskScore:58,
    members:["ACC_4001","ACC_4002","ACC_4003","ACC_4004","ACC_4005"],
    nodes:[{ id:"ACC_4001",x:155,y:30,score:58 },{ id:"ACC_4002",x:270,y:115,score:52 },{ id:"ACC_4003",x:230,y:255,score:50 },{ id:"ACC_4004",x:75,y:255,score:48 },{ id:"ACC_4005",x:35,y:115,score:46 }],
    edges:[["ACC_4001","ACC_4002"],["ACC_4002","ACC_4003"],["ACC_4003","ACC_4004"],["ACC_4004","ACC_4005"],["ACC_4005","ACC_4001"]],
  },
];

const MOCK_ACCOUNTS = [
  { id:"ACC_0041", score:94, patterns:["cycle","high_velocity"], ring:"RING_001" },
  { id:"ACC_0113", score:91, patterns:["cycle"], ring:"RING_001" },
  { id:"ACC_0500", score:88, patterns:["smurfing"], ring:"RING_002" },
  { id:"ACC_0088", score:87, patterns:["cycle"], ring:"RING_001" },
  { id:"ACC_0700", score:79, patterns:["layered_shell"], ring:"RING_003" },
  { id:"ACC_0244", score:78, patterns:["cycle"], ring:"RING_001" },
  { id:"ACC_1001", score:76, patterns:["cycle"], ring:"RING_004" },
  { id:"ACC_0322", score:73, patterns:["smurfing"], ring:"RING_002" },
  { id:"ACC_1002", score:72, patterns:["cycle"], ring:"RING_004" },
  { id:"ACC_0320", score:71, patterns:["smurfing"], ring:"RING_002" },
  { id:"ACC_2001", score:71, patterns:["smurfing"], ring:"RING_005" },
  { id:"ACC_0701", score:65, patterns:["layered_shell"], ring:"RING_003" },
  { id:"ACC_3001", score:65, patterns:["layered_shell"], ring:"RING_006" },
  { id:"ACC_4001", score:58, patterns:["cycle"], ring:"RING_007" },
];

const patternLabel = {
  cycle: "Cycle", smurfing: "Fan-In / Fan-Out",
  layered_shell: "Layered Network", high_velocity: "High Velocity",
  fan_in: "Fan-In", fan_out: "Fan-Out", anomalous_flow: "Anomalous Flow",
};

// Normalise pattern names that come from the backend (e.g. "cycle_length_4" → "cycle")
function normalisePattern(p) {
  if (p.startsWith("cycle")) return "cycle";
  if (p === "fan_in" || p === "fan_out") return "smurfing";
  return p;
}

// Transform the raw FastAPI response into the shape the UI needs
function transformApiData(detection, graphData, uploadSummary) {
  // account_id → suspicious_account entry
  const accountMap = {};
  detection.suspicious_accounts.forEach(a => { accountMap[a.account_id] = a; });

  // Collect actual transaction edges between ring members from graph_data
  function edgesForMembers(memberSet) {
    const found = [];
    (graphData?.edges || []).forEach(e => {
      if (memberSet.has(e.source) && memberSet.has(e.target))
        found.push([e.source, e.target]);
    });
    return found;
  }

  const rings = detection.fraud_rings.map(ring => {
    const n = ring.member_accounts.length;
    const radius = n <= 2 ? 60 : Math.min(110, 40 + n * 14);

    const nodes = ring.member_accounts.map((id, i) => {
      const angle = (i / n) * 2 * Math.PI - Math.PI / 2;
      return {
        id,
        x: 155 + radius * Math.cos(angle),
        y: 160 + radius * Math.sin(angle),
        score: Math.round(accountMap[id]?.suspicion_score ?? 0),
      };
    });

    const memberSet = new Set(ring.member_accounts);
    let edges = edgesForMembers(memberSet);

    // Fallback: synthesise edges when graph_data didn't contain them
    if (edges.length === 0) {
      if (ring.pattern_type === "cycle") {
        for (let i = 0; i < n; i++)
          edges.push([ring.member_accounts[i], ring.member_accounts[(i + 1) % n]]);
      } else {
        // smurfing / layered_shell — star topology
        for (let i = 1; i < n; i++)
          edges.push([ring.member_accounts[i], ring.member_accounts[0]]);
      }
    }

    return {
      id: ring.ring_id,
      pattern: ring.pattern_type,
      riskScore: Math.round(ring.risk_score),
      members: ring.member_accounts,
      nodes,
      edges,
    };
  });

  const accounts = detection.suspicious_accounts.map(a => ({
    id: a.account_id,
    score: Math.round(a.suspicion_score),
    patterns: (a.detected_patterns || []).map(normalisePattern).filter((v,i,arr)=>arr.indexOf(v)===i),
    ring: a.ring_id || null,
  }));

  const summary = {
    totalAccounts: uploadSummary.total_accounts_analyzed,
    suspiciousAccounts: uploadSummary.suspicious_accounts_flagged,
    fraudRings: uploadSummary.fraud_rings_detected,
    processingTime: uploadSummary.processing_time_seconds,
  };

  return { rings, accounts, summary };
}

// Node color based on risk score
function nodeColor(score) {
  if (score >= 85) return "#DC2626"; // critical — deep red
  if (score >= 70) return "#F97316"; // high — orange
  if (score >= 55) return "#3B82F6"; // medium — blue
  return "#22C55E";                  // low — green
}

function nodeBorder(score) {
  if (score >= 85) return "#991B1B";
  if (score >= 70) return "#C2410C";
  if (score >= 55) return "#1D4ED8";
  return "#15803D";
}

// Shared zoom/pan hook
function useZoomPan({ minScale=0.3, maxScale=5, initialScale=1 } = {}) {
  const [transform, setTransform] = useState({ x:0, y:0, scale:initialScale });
  const dragging = useRef(false);
  const last = useRef({ x:0, y:0 });
  const svgRef = useRef(null);

  const onWheel = (e) => {
    e.preventDefault();
    const rect = svgRef.current.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const delta = -e.deltaY * 0.001;
    setTransform(t => {
      const newScale = Math.min(maxScale, Math.max(minScale, t.scale * (1 + delta * 1.5)));
      const ratio = newScale / t.scale;
      return {
        scale: newScale,
        x: mx - ratio * (mx - t.x),
        y: my - ratio * (my - t.y),
      };
    });
  };

  const onMouseDown = (e) => {
    if (e.target.closest("g[data-node]")) return;
    dragging.current = true;
    last.current = { x: e.clientX, y: e.clientY };
    e.currentTarget.style.cursor = "grabbing";
  };

  const onMouseMove = (e) => {
    if (!dragging.current) return;
    const dx = e.clientX - last.current.x;
    const dy = e.clientY - last.current.y;
    last.current = { x: e.clientX, y: e.clientY };
    setTransform(t => ({ ...t, x: t.x + dx, y: t.y + dy }));
  };

  const onMouseUp = (e) => {
    dragging.current = false;
    if (svgRef.current) svgRef.current.style.cursor = "grab";
  };

  const reset = () => setTransform({ x:0, y:0, scale:initialScale });
  const zoomIn = () => setTransform(t => ({ ...t, scale: Math.min(maxScale, t.scale * 1.3) }));
  const zoomOut = () => setTransform(t => ({ ...t, scale: Math.max(minScale, t.scale / 1.3) }));

  return { transform, svgRef, onWheel, onMouseDown, onMouseMove, onMouseUp, reset, zoomIn, zoomOut };
}

function ZoomControls({ onZoomIn, onZoomOut, onReset, scale }) {
  const btn = {
    width:28, height:28, border:"1px solid #e0e0e0", background:"#fff",
    borderRadius:6, cursor:"pointer", fontSize:15, display:"flex",
    alignItems:"center", justifyContent:"center", color:"#333",
    fontFamily:"monospace", transition:"background 0.1s",
  };
  return (
    <div style={{ position:"absolute", bottom:12, right:12, display:"flex", flexDirection:"column", gap:4, zIndex:10 }}>
      <button style={btn} onClick={onZoomIn} title="Zoom in">+</button>
      <button style={btn} onClick={onZoomOut} title="Zoom out">−</button>
      <button style={{ ...btn, fontSize:9, fontFamily:"'Google Sans',sans-serif", letterSpacing:"0.02em" }}
        onClick={onReset} title="Reset view">RST</button>
      <div style={{ textAlign:"center", fontSize:9, color:"#aaa", fontFamily:"'Google Sans',sans-serif", marginTop:2 }}>
        {Math.round(scale*100)}%
      </div>
    </div>
  );
}

function RingGraph({ ring, highlightNode, onNodeClick }) {
  const [hov, setHov] = useState(null);
  const { transform, svgRef, onWheel, onMouseDown, onMouseMove, onMouseUp, reset, zoomIn, zoomOut } = useZoomPan({ initialScale:1 });
  const aid = `arr-${ring.id}`;

  return (
    <div style={{ position:"relative", userSelect:"none" }}>
      <svg ref={svgRef} viewBox="-24 -24 430 360" width="100%"
        style={{ display:"block", cursor:"grab", touchAction:"none" }}
        onWheel={onWheel}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}>
        <defs>
          {/* Dark filled arrowhead */}
          <marker id={aid} markerWidth="10" markerHeight="10" refX="8" refY="3.5" orient="auto">
            <path d="M0,0 L0,7 L10,3.5 z" fill="#222"/>
          </marker>
          {/* Highlighted arrowhead */}
          <marker id={`${aid}-hl`} markerWidth="10" markerHeight="10" refX="8" refY="3.5" orient="auto">
            <path d="M0,0 L0,7 L10,3.5 z" fill="#F97316"/>
          </marker>
          {ring.nodes.map(n => (
            <filter key={`glow-${n.id}`} id={`glow-${ring.id}-${n.id.replace(/[^a-z0-9]/gi,"")}`}>
              <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
              <feMerge><feMergeNode in="coloredBlur"/><feMergeNode in="SourceGraphic"/></feMerge>
            </filter>
          ))}
        </defs>

        <g transform={`translate(${transform.x},${transform.y}) scale(${transform.scale})`}>
          {ring.edges.map(([s,d],i) => {
            const sn=ring.nodes.find(n=>n.id===s), dn=ring.nodes.find(n=>n.id===d);
            if(!sn||!dn) return null;
            const dx=dn.x-sn.x, dy=dn.y-sn.y, len=Math.sqrt(dx*dx+dy*dy)||1, r=23;
            const isHighlighted = highlightNode && (s===highlightNode||d===highlightNode);
            return (
              <g key={i}>
                {/* Shadow line for depth */}
                <line x1={sn.x+(dx/len)*r} y1={sn.y+(dy/len)*r}
                  x2={dn.x-(dx/len)*r} y2={dn.y-(dy/len)*r}
                  stroke="rgba(0,0,0,0.08)" strokeWidth={isHighlighted?5:4}/>
                {/* Main arrow line */}
                <line x1={sn.x+(dx/len)*r} y1={sn.y+(dy/len)*r}
                  x2={dn.x-(dx/len)*r} y2={dn.y-(dy/len)*r}
                  stroke={isHighlighted?"#F97316":"#333"} strokeWidth={isHighlighted?2.5:1.8}
                  markerEnd={`url(#${isHighlighted?`${aid}-hl`:aid})`}
                  style={{transition:"stroke 0.2s, stroke-width 0.2s"}}/>
              </g>
            );
          })}

          {ring.nodes.map(n => {
            const h=hov===n.id;
            const isHL = highlightNode===n.id;
            const fill = nodeColor(n.score);
            const border = nodeBorder(n.score);
            const isCritical = n.score >= 85;
            const safeId = n.id.replace(/[^a-z0-9]/gi,"");
            return (
              <g key={n.id} data-node="1"
                onMouseEnter={()=>setHov(n.id)}
                onMouseLeave={()=>setHov(null)}
                onClick={()=>onNodeClick && onNodeClick(n)}
                style={{cursor:"pointer"}}>
                {isCritical && (
                  <circle cx={n.x} cy={n.y} r={28} fill={fill} opacity="0.18">
                    <animate attributeName="r" values="24;32;24" dur="2s" repeatCount="indefinite"/>
                    <animate attributeName="opacity" values="0.18;0.05;0.18" dur="2s" repeatCount="indefinite"/>
                  </circle>
                )}
                <circle cx={n.x} cy={n.y} r={h||isHL?25:22}
                  fill={fill}
                  stroke={isHL?"#000":border}
                  strokeWidth={isHL?2.5:1.5}
                  filter={h?`url(#glow-${ring.id}-${safeId})`:"none"}
                  style={{transition:"r 0.15s, stroke-width 0.15s"}}/>
                <text x={n.x} y={n.y+4} textAnchor="middle" fontSize="9"
                  fontFamily="'Google Sans Text', 'Google Sans', sans-serif" fontWeight="600" fill="#fff">
                  {n.id.replace("ACC_","")}
                </text>
                {h && (
                  <g>
                    <rect x={n.x+28} y={n.y-26} width={120} height={46} rx="5" fill="#111" opacity="0.95"/>
                    <text x={n.x+88} y={n.y-10} textAnchor="middle" fontSize="8.5" fill="#fff"
                      fontFamily="'Google Sans', sans-serif" fontWeight="600">{n.id}</text>
                    <text x={n.x+88} y={n.y+4} textAnchor="middle" fontSize="7.5" fill="#aaa"
                      fontFamily="'Google Sans', sans-serif">Score: {n.score}</text>
                    <text x={n.x+88} y={n.y+16} textAnchor="middle" fontSize="7" fill={fill}
                      fontFamily="'Google Sans', sans-serif">
                      {n.score>=85?"Critical":n.score>=70?"High Risk":n.score>=55?"Medium":"Low"}
                    </text>
                  </g>
                )}
              </g>
            );
          })}
        </g>
      </svg>
      <ZoomControls onZoomIn={zoomIn} onZoomOut={zoomOut} onReset={reset} scale={transform.scale}/>
    </div>
  );
}

function GlobalGraph({ rings, onNodeClick }) {
  const [hov, setHov] = useState(null);
  const { transform, svgRef, onWheel, onMouseDown, onMouseMove, onMouseUp, reset, zoomIn, zoomOut } = useZoomPan({ initialScale:1 });

  const laid = useMemo(() => {
    const out = [];
    rings.forEach((ring, ri) => {
      const cx = 440 + 280*Math.cos((ri/rings.length)*2*Math.PI);
      const cy = 300 + 225*Math.sin((ri/rings.length)*2*Math.PI);
      ring.nodes.forEach((n, ni) => {
        const a = (ni/ring.nodes.length)*2*Math.PI;
        out.push({...n, ring:ring.id, px:cx+55*Math.cos(a), py:cy+55*Math.sin(a)});
      });
    });
    return out;
  }, [rings]);
  const nodePos = useMemo(() => { const m=new Map(); laid.forEach(n=>m.set(n.id,n)); return m; }, [laid]);
  const allEdges = useMemo(() => { const e=[]; rings.forEach(r=>r.edges.forEach(([s,d])=>e.push({s,d,ring:r.id}))); return e; }, [rings]);

  return (
    <div style={{ position:"relative", userSelect:"none" }}>
      <svg ref={svgRef} viewBox="0 0 880 600" width="100%"
        style={{display:"block", cursor:"grab", touchAction:"none"}}
        onWheel={onWheel}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}>
        <defs>
          {/* Dark arrowhead for global graph */}
          <marker id="ag" markerWidth="10" markerHeight="10" refX="8" refY="3.5" orient="auto">
            <path d="M0,0 L0,7 L10,3.5 z" fill="#333"/>
          </marker>
          {/* Hover highlight arrowhead */}
          <marker id="ag-hl" markerWidth="10" markerHeight="10" refX="8" refY="3.5" orient="auto">
            <path d="M0,0 L0,7 L10,3.5 z" fill="#F97316"/>
          </marker>
        </defs>

        <g transform={`translate(${transform.x},${transform.y}) scale(${transform.scale})`}>
          {allEdges.map(({s,d},i) => {
            const sn=nodePos.get(s), dn=nodePos.get(d);
            if(!sn||!dn) return null;
            const dx=dn.px-sn.px, dy=dn.py-sn.py, len=Math.sqrt(dx*dx+dy*dy)||1, r=15;
            const isHov = hov && (s===hov||d===hov);
            return (
              <g key={i}>
                {/* Shadow for depth */}
                <line x1={sn.px+(dx/len)*r} y1={sn.py+(dy/len)*r}
                  x2={dn.px-(dx/len)*r} y2={dn.py-(dy/len)*r}
                  stroke="rgba(0,0,0,0.07)" strokeWidth={isHov?5:3.5}/>
                {/* Main arrow */}
                <line x1={sn.px+(dx/len)*r} y1={sn.py+(dy/len)*r}
                  x2={dn.px-(dx/len)*r} y2={dn.py-(dy/len)*r}
                  stroke={isHov?"#F97316":"#3a3a3a"} strokeWidth={isHov?2.2:1.5}
                  markerEnd={`url(#${isHov?"ag-hl":"ag"})`}
                  style={{transition:"stroke 0.15s, stroke-width 0.15s"}}/>
              </g>
            );
          })}

          {laid.map(n => {
            const h=hov===n.id;
            const fill = nodeColor(n.score);
            const border = nodeBorder(n.score);
            return (
              <g key={n.id} data-node="1"
                onMouseEnter={()=>setHov(n.id)}
                onMouseLeave={()=>setHov(null)}
                onClick={()=>onNodeClick && onNodeClick(n)}
                style={{cursor:"pointer"}}>
                {n.score>=85 && (
                  <circle cx={n.px} cy={n.py} r={18} fill={fill} opacity="0.2">
                    <animate attributeName="r" values="14;20;14" dur="2.2s" repeatCount="indefinite"/>
                    <animate attributeName="opacity" values="0.2;0.04;0.2" dur="2.2s" repeatCount="indefinite"/>
                  </circle>
                )}
                <circle cx={n.px} cy={n.py} r={h?17:14}
                  fill={fill} stroke={border} strokeWidth={h?2.5:1.5}
                  style={{transition:"r 0.15s, stroke-width 0.15s"}}/>
                <text x={n.px} y={n.py+3.5} textAnchor="middle" fontSize="6.5"
                  fontFamily="'Google Sans', sans-serif" fontWeight="600" fill="#fff">
                  {n.id.replace("ACC_","")}
                </text>
                {h && (
                  <g>
                    <rect x={n.px+20} y={n.py-28} width={130} height={52} rx="5" fill="#111" opacity="0.97"/>
                    <text x={n.px+85} y={n.py-13} textAnchor="middle" fontSize="8" fill="#fff"
                      fontFamily="'Google Sans', sans-serif" fontWeight="600">{n.id}</text>
                    <text x={n.px+85} y={n.py+1} textAnchor="middle" fontSize="7.5" fill="#aaa"
                      fontFamily="'Google Sans', sans-serif">Score: {n.score} · {n.ring}</text>
                    <text x={n.px+85} y={n.py+14} textAnchor="middle" fontSize="7" fill={fill}
                      fontFamily="'Google Sans', sans-serif">
                      {n.score>=85?"Critical":n.score>=70?"High Risk":n.score>=55?"Medium":"Low"} — click to inspect
                    </text>
                  </g>
                )}
              </g>
            );
          })}
        </g>
      </svg>
      <ZoomControls onZoomIn={zoomIn} onZoomOut={zoomOut} onReset={reset} scale={transform.scale}/>
    </div>
  );
}

function Pill({ label }) {
  return (
    <span style={{
      display:"inline-block", padding:"3px 12px",
      border:"1px solid #000", borderRadius:40,
      fontSize:12, fontWeight:500, color:"#000",
      letterSpacing:"0.01em", lineHeight:"18px",
      fontFamily:"'Google Sans', sans-serif",
    }}>{label}</span>
  );
}

function ScoreBar({ score, animated }) {
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setWidth(score), animated ? 100 : 0);
    return () => clearTimeout(t);
  }, [score, animated]);
  const color = nodeColor(score);
  return (
    <div style={{ display:"flex", alignItems:"center", gap:12 }}>
      <div style={{ flex:1, height:3, background:"#f0f0f0", position:"relative", borderRadius:2, overflow:"hidden" }}>
        <div style={{
          position:"absolute", top:0, left:0, height:"100%",
          width:`${width}%`, background:color, borderRadius:2,
          transition:"width 0.8s cubic-bezier(0.16,1,0.3,1)",
        }}/>
      </div>
      <span style={{ fontSize:13, fontWeight:700, minWidth:28, textAlign:"right", color }}>{score}</span>
    </div>
  );
}

// Modal for node inspection
function NodeModal({ node, ring, onClose }) {
  if (!node) return null;
  const color = nodeColor(node.score);
  const level = node.score>=85?"Critical":node.score>=70?"High Risk":node.score>=55?"Medium":"Low";
  return (
    <div style={{
      position:"fixed", inset:0, zIndex:200,
      background:"rgba(0,0,0,0.45)", backdropFilter:"blur(4px)",
      display:"flex", alignItems:"center", justifyContent:"center",
    }} onClick={onClose}>
      <div onClick={e=>e.stopPropagation()} style={{
        background:"#fff", borderRadius:12, width:420, padding:36,
        boxShadow:"0 24px 80px rgba(0,0,0,0.18)",
        animation:"modalIn 0.2s cubic-bezier(0.16,1,0.3,1)",
      }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:24 }}>
          <div>
            <div style={{ fontSize:11, color:"#aaa", letterSpacing:"0.07em", textTransform:"uppercase", fontWeight:500, marginBottom:6 }}>Account Inspector</div>
            <div style={{ fontSize:26, fontWeight:700, letterSpacing:"-0.02em", fontFamily:"monospace" }}>{node.id}</div>
          </div>
          <button onClick={onClose} style={{
            background:"none", border:"none", cursor:"pointer", fontSize:20,
            color:"#999", lineHeight:1, padding:"4px 8px",
          }}>×</button>
        </div>

        {/* Score ring */}
        <div style={{ display:"flex", alignItems:"center", gap:24, marginBottom:28, padding:"20px 0", borderTop:"1px solid #f0f0f0", borderBottom:"1px solid #f0f0f0" }}>
          <svg width="80" height="80" viewBox="0 0 80 80">
            <circle cx="40" cy="40" r="32" fill="none" stroke="#f0f0f0" strokeWidth="6"/>
            <circle cx="40" cy="40" r="32" fill="none" stroke={color} strokeWidth="6"
              strokeDasharray={`${2*Math.PI*32*node.score/100} ${2*Math.PI*32*(100-node.score)/100}`}
              strokeLinecap="round" strokeDashoffset={2*Math.PI*32*0.25}/>
            <text x="40" y="45" textAnchor="middle" fontSize="20" fontWeight="700" fill={color}>{node.score}</text>
          </svg>
          <div>
            <div style={{ fontSize:18, fontWeight:700, color, marginBottom:4 }}>{level}</div>
            <div style={{ fontSize:13, color:"#666" }}>Suspicion Score</div>
            {ring && <div style={{ fontSize:12, color:"#888", marginTop:8 }}>Member of <strong>{ring.id}</strong></div>}
          </div>
        </div>

        {ring && (
          <div>
            <div style={{ fontSize:11, color:"#aaa", letterSpacing:"0.07em", textTransform:"uppercase", fontWeight:500, marginBottom:10 }}>Ring Pattern</div>
            <Pill label={patternLabel[ring.pattern]||ring.pattern}/>
            <div style={{ marginTop:16, fontSize:13, color:"#666" }}>
              This ring has <strong>{ring.members.length}</strong> member accounts with a ring-level risk score of <strong style={{color:nodeColor(ring.riskScore)}}>{ring.riskScore}</strong>.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function UploadZone({ onProcess, onDemo }) {
  const [dragging, setDragging] = useState(false);
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const go = async () => {
    if (!file) { setError("Please select or drop a CSV file first."); return; }
    setError(null);
    setLoading(true);
    try {
      // 1. Upload the CSV
      const form = new FormData();
      form.append("file", file);
      const upRes = await fetch(`${API_BASE}/upload`, { method: "POST", body: form });
      if (!upRes.ok) {
        const body = await upRes.json().catch(() => ({ detail: "Upload failed" }));
        throw new Error(typeof body.detail === "string" ? body.detail : JSON.stringify(body.detail));
      }
      const upData = await upRes.json();
      // upData = { status: "ok", transactions_loaded: 1234 }

      // 2. Fetch the analysis (backend runs detection on the uploaded data)
      const resRes = await fetch(`${API_BASE}/analysis`);
      if (!resRes.ok) throw new Error("Failed to retrieve results from server.");
      const resData = await resRes.json();
      // resData = { suspicious_accounts: [...], fraud_rings: [...], summary: {...} }

      // 3. Transform and hand off to App
      const transformed = transformApiData(
        resData,           // the detection object (has suspicious_accounts + fraud_rings)
        { edges: [] },     // no separate graph endpoint, so pass empty edges
        resData.summary    // the summary is nested inside resData
      );
      onProcess(transformed);
    } catch (err) {
      setError(err.message || "Unknown error — is the backend running on port 8000?");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div
        onDragOver={e=>{e.preventDefault();setDragging(true);}}
        onDragLeave={()=>setDragging(false)}
        onDrop={e=>{e.preventDefault();setDragging(false);const f=e.dataTransfer.files[0];if(f)setFile(f);setError(null);}}
        onClick={()=>document.getElementById("cz").click()}
        style={{
          border:`1px solid ${dragging?"#000":"#d8d8d8"}`,
          borderRadius:8, padding:"52px 40px", textAlign:"center",
          background:dragging?"#f8f8f8":"#fafafa", cursor:"pointer", transition:"all 0.15s",
        }}>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" style={{margin:"0 auto 14px"}}>
          <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12" stroke="#999" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        <div style={{ fontSize:14, color:"#000", fontWeight:500, marginBottom:6 }}>
          {file ? file.name : "Drop CSV file here or click to browse"}
        </div>
        <div style={{ fontSize:13, color:"#999" }}>
          Required: transaction_id · sender_id · receiver_id · amount · timestamp
        </div>
        <input id="cz" type="file" accept=".csv" style={{display:"none"}} onChange={e=>{setFile(e.target.files[0]);setError(null);}}/>
      </div>

      {error && (
        <div style={{ marginTop:12, padding:"10px 16px", background:"#fef2f2", border:"1px solid #fecaca",
          borderRadius:6, fontSize:13, color:"#dc2626" }}>
          ⚠ {error}
        </div>
      )}

      <div style={{ display:"flex", gap:12, marginTop:20 }}>
        <button onClick={go} disabled={loading} style={{
          padding:"11px 26px", background:"#000", color:"#fff",
          border:"none", borderRadius:40, fontSize:14, fontWeight:500,
          cursor:loading?"not-allowed":"pointer", opacity:loading?0.65:1,
          display:"flex", alignItems:"center", gap:9, transition:"opacity 0.2s",
          fontFamily:"'Google Sans', sans-serif",
        }}>
          {loading && <span style={{width:13,height:13,border:"1.5px solid #fff",borderTopColor:"transparent",borderRadius:"50%",animation:"sn 0.8s linear infinite"}}/>}
          {loading?"Analyzing…":"Analyze transactions"}
        </button>
        <button onClick={onDemo} style={{
          padding:"11px 26px", background:"#fff", color:"#000",
          border:"1px solid #000", borderRadius:40, fontSize:14, fontWeight:500,
          cursor:"pointer", fontFamily:"'Google Sans', sans-serif",
        }}>View sample output</button>
      </div>
      <style>{`@keyframes sn{to{transform:rotate(360deg);}}`}</style>
    </div>
  );
}

// Toast notification
function Toast({ msg, onDone }) {
  useEffect(() => { const t = setTimeout(onDone, 3000); return () => clearTimeout(t); }, []);
  return (
    <div style={{
      position:"fixed", bottom:32, right:32, zIndex:300,
      background:"#111", color:"#fff", padding:"14px 24px",
      borderRadius:40, fontSize:13, fontWeight:500,
      fontFamily:"'Google Sans', sans-serif",
      boxShadow:"0 8px 32px rgba(0,0,0,0.25)",
      animation:"toastIn 0.3s cubic-bezier(0.16,1,0.3,1)",
      display:"flex", alignItems:"center", gap:10,
    }}>
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
        <path d="M7 1v8M4 6l3 3 3-3M2 11h10" stroke="#fff" strokeWidth="1.4" strokeLinecap="round"/>
      </svg>
      {msg}
    </div>
  );
}

export default function App() {
  const [view, setView] = useState("home");
  const [tab, setTab] = useState("global");
  const [pf, setPf] = useState("all");
  const [search, setSearch] = useState("");
  const [desc, setDesc] = useState(true);
  const [inspectNode, setInspectNode] = useState(null);
  const [expandedRing, setExpandedRing] = useState(null);
  const [toast, setToast] = useState(null);
  const [animateBars, setAnimateBars] = useState(false);
  const [highlightRing, setHighlightRing] = useState(null);

  // Real data from backend (null = show mock/demo data)
  const [liveData, setLiveData] = useState(null);

  const activeRings    = liveData?.rings    || MOCK_RINGS;
  const activeAccounts = liveData?.accounts || MOCK_ACCOUNTS;
  const activeSummary  = liveData?.summary  || MOCK_SUMMARY;

  // Called when UploadZone finishes real analysis
  const handleRealData = (transformed) => {
    setLiveData(transformed);
    setView("results");
    setTab("global");
    setPf("all");
    setSearch("");
    setHighlightRing(null);
  };

  // Called for "View sample output" button
  const handleDemo = () => {
    setLiveData(null);
    setView("results");
    setTab("global");
  };

  // Animate score bars when switching to accounts tab
  useEffect(() => {
    if (tab === "accounts") {
      setAnimateBars(false);
      const t = setTimeout(() => setAnimateBars(true), 50);
      return () => clearTimeout(t);
    }
  }, [tab]);

  const rings = useMemo(() =>
    activeRings.filter(r => pf==="all"||r.pattern===pf).sort((a,b)=>b.riskScore-a.riskScore),
  [pf, activeRings]);

  const accounts = useMemo(() =>
    activeAccounts.filter(a=>{
      const matchSearch = !search || a.id.toLowerCase().includes(search.toLowerCase());
      const matchRing = !highlightRing || a.ring===highlightRing;
      return matchSearch && matchRing;
    }).sort((a,b)=>desc?b.score-a.score:a.score-b.score),
  [search, desc, highlightRing, activeAccounts]);

  const downloadReport = () => {
    const data = {
      suspicious_accounts: activeAccounts.map(a=>({account_id:a.id,suspicion_score:a.score,detected_patterns:a.patterns,ring_id:a.ring})),
      fraud_rings: activeRings.map(r=>({ring_id:r.id,pattern_type:r.pattern,member_count:r.members.length,risk_score:r.riskScore,member_account_ids:r.members})),
      summary: activeSummary,
    };
    const a=document.createElement("a");
    a.href=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:"application/json"}));
    a.download="investigation_report.json"; a.click();
    setToast("Report downloaded");
  };

  const handleNodeClick = (node) => {
    const ring = activeRings.find(r => r.members.includes(node.id));
    setInspectNode({ node, ring });
  };

  const handleAccountRowClick = (account) => {
    setHighlightRing(account.ring);
    setTab("rings");
    setPf("all");
    setTimeout(() => {
      const el = document.getElementById(`ring-${account.ring}`);
      if (el) el.scrollIntoView({ behavior:"smooth", block:"center" });
    }, 100);
  };

  const GS = "'Google Sans Text', 'Google Sans', 'Segoe UI', system-ui, sans-serif";

  return (
    <div style={{ minHeight:"100vh", background:"#fff", fontFamily:GS, color:"#000" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Google+Sans:wght@400;500;700&family=Google+Sans+Text:wght@400;500&display=swap');
        *{box-sizing:border-box;}
        body{margin:0;}
        ::-webkit-scrollbar{width:4px;height:4px;}
        ::-webkit-scrollbar-thumb{background:#e0e0e0;border-radius:2px;}
        .ring-card{transition:outline 0.12s, box-shadow 0.2s;}
        .ring-card:hover{outline:1px solid #000;}
        .ring-card.highlighted{outline:2px solid #F97316!important; box-shadow:0 0 0 4px rgba(249,115,22,0.12);}
        tr:hover td{background:#fafafa!important;}
        tr.clickable-row{cursor:pointer;}
        tr.clickable-row:hover td{background:#fff9f5!important;}
        .filterbtn{transition:all 0.12s;}
        @keyframes sn{to{transform:rotate(360deg);}}
        @keyframes modalIn{from{opacity:0;transform:scale(0.94) translateY(8px);}to{opacity:1;transform:scale(1) translateY(0);}}
        @keyframes toastIn{from{opacity:0;transform:translateY(12px);}to{opacity:1;transform:translateY(0);}}
      `}</style>

      {/* NAV */}
      <nav style={{
        position:"sticky", top:0, zIndex:100,
        background:"rgba(255,255,255,0.9)", backdropFilter:"blur(16px)",
        borderBottom:"1px solid #e8e8e8",
        height:64, display:"flex", alignItems:"center",
        padding:"0 48px", justifyContent:"space-between",
      }}>
        <div style={{ display:"flex", alignItems:"center", gap:40 }}>
          <div style={{ display:"flex", alignItems:"center", gap:8 }}>
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <rect x="1" y="1" width="7" height="7" stroke="#000" strokeWidth="1.5"/>
              <rect x="12" y="1" width="7" height="7" stroke="#000" strokeWidth="1.5"/>
              <rect x="1" y="12" width="7" height="7" stroke="#000" strokeWidth="1.5"/>
              <rect x="12" y="12" width="7" height="7" fill="#000"/>
            </svg>
            <span style={{ fontSize:15, fontWeight:600, letterSpacing:"-0.01em", fontFamily:GS }}>MuleNet</span>
          </div>

          {view==="results" && (
            <div style={{ display:"flex", gap:32 }}>
              {[["global","Global network"],["rings","Fraud rings"],["accounts","Accounts"]].map(([id,label]) => (
                <button key={id} onClick={()=>setTab(id)} style={{
                  background:"none", border:"none", cursor:"pointer",
                  fontSize:14, fontFamily:GS,
                  color:tab===id?"#000":"#777",
                  fontWeight:tab===id?500:400,
                  padding:"0 0 2px",
                  borderBottom:tab===id?"1px solid #000":"1px solid transparent",
                  transition:"all 0.12s",
                }}>{label}</button>
              ))}
            </div>
          )}
        </div>

        <div style={{ display:"flex", gap:12, alignItems:"center" }}>
          {view==="results" && (
            <button onClick={()=>setView("home")} style={{
              background:"none", border:"none", cursor:"pointer", fontSize:14,
              color:"#666", fontFamily:GS, padding:"0",
            }}>← New analysis</button>
          )}
          <button
            onClick={view==="home"?()=>setView("results"):downloadReport}
            style={{
              padding:"10px 22px", background:"#000", color:"#fff",
              border:"none", borderRadius:40, fontSize:14, fontWeight:500,
              cursor:"pointer", fontFamily:GS,
              display:"flex", alignItems:"center", gap:7,
            }}>
            {view==="home" ? "Upload CSV" : (
              <>
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M7 1v8M4 6l3 3 3-3M2 11h10" stroke="#fff" strokeWidth="1.4" strokeLinecap="round"/>
                </svg>
                Download report
              </>
            )}
          </button>
        </div>
      </nav>

      {view==="home" ? (
        <div style={{ maxWidth:1200, margin:"0 auto", padding:"0 48px" }}>
          <div style={{ paddingTop:112, paddingBottom:100 }}>
            <h1 style={{
              fontSize:"clamp(48px,5.8vw,72px)", fontWeight:700,
              letterSpacing:"-0.035em", lineHeight:1.05,
              maxWidth:700, marginBottom:28, color:"#000",
            }}>
              Graph-based financial crime detection
            </h1>
            <p style={{ fontSize:18, color:"#666", lineHeight:1.65, maxWidth:500, marginBottom:56 }}>
              Upload transaction data and uncover hidden money muling networks using advanced graph analytics.
            </p>
            <UploadZone onProcess={handleRealData} onDemo={handleDemo}/>
          </div>

          <div style={{ borderTop:"1px solid #e8e8e8" }}>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)" }}>
              {[
                { n:"01", t:"Cycle Detection", d:"Identify 3–5 hop transaction loops indicating circular money movement between colluding accounts." },
                { n:"02", t:"Smurfing Detection", d:"Detect fan-in and fan-out patterns within 72-hour windows — hallmarks of layered cash structuring." },
                { n:"03", t:"Layered Shell Analysis", d:"Expose intermediary networks used to obscure the origin and destination of illicit funds." },
              ].map((f,i) => (
                <div key={f.n} style={{
                  padding:"48px 40px 48px 0",
                  borderLeft:i>0?"1px solid #e8e8e8":"none",
                  paddingLeft:i>0?40:0,
                }}>
                  <div style={{ fontSize:12, color:"#aaa", fontWeight:500, letterSpacing:"0.05em", marginBottom:20 }}>{f.n}</div>
                  <h3 style={{ fontSize:20, fontWeight:600, marginBottom:14, letterSpacing:"-0.015em" }}>{f.t}</h3>
                  <p style={{ fontSize:14, color:"#666", lineHeight:1.72 }}>{f.d}</p>
                </div>
              ))}
            </div>
          </div>

          <div style={{ borderTop:"1px solid #e8e8e8", display:"grid", gridTemplateColumns:"repeat(4,1fr)", marginBottom:120 }}>
            {[
              { v:"10K+", l:"Accounts supported" },
              { v:"3",    l:"Detection algorithms" },
              { v:"<3s",  l:"Processing time" },
              { v:"100%", l:"Graph traversal coverage" },
            ].map((s,i) => (
              <div key={s.l} style={{
                padding:"48px 0",
                borderRight:i<3?"1px solid #e8e8e8":"none",
                paddingRight:i<3?40:0, paddingLeft:i>0?40:0,
              }}>
                <div style={{ fontSize:48, fontWeight:700, letterSpacing:"-0.04em", marginBottom:10 }}>{s.v}</div>
                <div style={{ fontSize:13, color:"#888" }}>{s.l}</div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div style={{ maxWidth:1200, margin:"0 auto", padding:"0 48px" }}>
          <div style={{ paddingTop:64, paddingBottom:48, borderBottom:"1px solid #e8e8e8" }}>
            <h1 style={{ fontSize:44, fontWeight:700, letterSpacing:"-0.03em", marginBottom:8 }}>
              Analysis results
            </h1>
            <p style={{ fontSize:14, color:"#888" }}>
              {new Date().toLocaleDateString("en-GB",{weekday:"long",year:"numeric",month:"long",day:"numeric"})}
              &ensp;·&ensp;Processed in {activeSummary.processingTime}s
              {!liveData && <span style={{marginLeft:8,fontSize:12,color:"#aaa",background:"#f5f5f5",padding:"2px 8px",borderRadius:20}}>sample data</span>}
            </p>
          </div>

          {/* Summary row */}
          <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", borderBottom:"1px solid #e8e8e8", marginBottom:64 }}>
            {[
              { v:activeSummary.totalAccounts.toLocaleString(), l:"Total accounts analyzed" },
              { v:activeSummary.suspiciousAccounts, l:"Accounts flagged" },
              { v:activeSummary.fraudRings, l:"Fraud rings detected" },
              { v:`${activeSummary.processingTime}s`, l:"Processing time" },
            ].map((s,i) => (
              <div key={s.l} style={{
                padding:"40px 0",
                borderRight:i<3?"1px solid #e8e8e8":"none",
                paddingRight:i<3?40:0, paddingLeft:i>0?40:0,
              }}>
                <div style={{ fontSize:48, fontWeight:700, letterSpacing:"-0.04em", marginBottom:8 }}>{s.v}</div>
                <div style={{ fontSize:13, color:"#888" }}>{s.l}</div>
              </div>
            ))}
          </div>

          {/* GLOBAL */}
          {tab==="global" && (
            <div style={{ paddingBottom:100 }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"baseline", marginBottom:32 }}>
                <h2 style={{ fontSize:26, fontWeight:600, letterSpacing:"-0.02em" }}>Global transaction network</h2>
                <div style={{ display:"flex", gap:20, fontSize:13, color:"#888", flexWrap:"wrap" }}>
                  {[
                    { color:"#DC2626", label:"Critical (≥85)" },
                    { color:"#F97316", label:"High (70–84)" },
                    { color:"#3B82F6", label:"Medium (55–69)" },
                    { color:"#22C55E", label:"Low (<55)" },
                  ].map(l => (
                    <span key={l.label} style={{ display:"flex", alignItems:"center", gap:6 }}>
                      <span style={{ width:10,height:10,background:l.color,borderRadius:"50%",display:"inline-block" }}/>
                      {l.label}
                    </span>
                  ))}
                </div>
              </div>
              <div style={{ border:"1px solid #e8e8e8", borderRadius:6, overflow:"hidden", background:"#fafafa" }}>
                <GlobalGraph rings={activeRings} onNodeClick={handleNodeClick}/>
              </div>
              <p style={{ marginTop:14, fontSize:13, color:"#aaa" }}>Scroll to zoom · Drag to pan · Click any node to inspect · Pulsing nodes are critical risk (≥85)</p>
            </div>
          )}

          {/* RINGS */}
          {tab==="rings" && (
            <div style={{ paddingBottom:100 }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:40 }}>
                <div style={{ display:"flex", alignItems:"center", gap:16 }}>
                  <h2 style={{ fontSize:26, fontWeight:600, letterSpacing:"-0.02em" }}>Fraud rings</h2>
                  {highlightRing && (
                    <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                      <span style={{ fontSize:12, padding:"4px 12px", background:"#fff7ed", border:"1px solid #F97316", borderRadius:40, color:"#F97316", fontWeight:500 }}>
                        Filtered: {highlightRing}
                      </span>
                      <button onClick={()=>setHighlightRing(null)} style={{
                        background:"none", border:"none", cursor:"pointer",
                        fontSize:13, color:"#888", padding:0, fontFamily:GS,
                      }}>Clear ×</button>
                    </div>
                  )}
                </div>
                <div style={{ display:"flex", gap:8 }}>
                  {["all","cycle","smurfing","layered_shell"].map(p => (
                    <button key={p} className="filterbtn" onClick={()=>setPf(p)} style={{
                      padding:"8px 18px", borderRadius:40,
                      border:"1px solid #000",
                      background:pf===p?"#000":"#fff",
                      color:pf===p?"#fff":"#000",
                      fontSize:13, fontWeight:500, cursor:"pointer", fontFamily:GS,
                    }}>
                      {p==="all"?"All":patternLabel[p]||p}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{
                display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(350px,1fr))",
                border:"1px solid #e8e8e8", borderRadius:6, overflow:"hidden",
                background:"#e8e8e8", gap:1,
              }}>
                {rings.map(ring => {
                  const isHL = highlightRing===ring.id;
                  const isExp = expandedRing===ring.id;
                  return (
                    <div key={ring.id} id={`ring-${ring.id}`}
                      className={`ring-card${isHL?" highlighted":""}`}
                      style={{ background:"#fff", padding:"32px" }}>
                      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:24 }}>
                        <div>
                          <div style={{ fontSize:11, color:"#aaa", letterSpacing:"0.07em", textTransform:"uppercase", fontWeight:500, marginBottom:6 }}>Ring ID</div>
                          <div style={{ fontSize:24, fontWeight:700, letterSpacing:"-0.025em" }}>{ring.id}</div>
                        </div>
                        <div style={{ textAlign:"right" }}>
                          <div style={{ fontSize:11, color:"#aaa", letterSpacing:"0.07em", textTransform:"uppercase", fontWeight:500, marginBottom:6 }}>Risk score</div>
                          <div style={{ fontSize:36, fontWeight:700, letterSpacing:"-0.03em", color:nodeColor(ring.riskScore) }}>{ring.riskScore}</div>
                        </div>
                      </div>

                      {/* Progress bar */}
                      <div style={{ height:2, background:"#f0f0f0", marginBottom:24, overflow:"hidden", position:"relative", borderRadius:2 }}>
                        <div style={{ position:"absolute", top:0, left:0, width:`${ring.riskScore}%`, height:"100%", background:nodeColor(ring.riskScore) }}/>
                      </div>

                      <div style={{ display:"flex", gap:8, marginBottom:28, flexWrap:"wrap" }}>
                        <Pill label={patternLabel[ring.pattern]||ring.pattern}/>
                        <Pill label={`${ring.members.length} accounts`}/>
                      </div>

                      <div style={{ borderTop:"1px solid #f0f0f0", paddingTop:24, marginBottom:16 }}>
                        <RingGraph ring={ring}
                          highlightNode={null}
                          onNodeClick={handleNodeClick}/>
                      </div>

                      <div style={{ borderTop:"1px solid #f0f0f0", paddingTop:18 }}>
                        <div style={{ fontSize:11, color:"#aaa", letterSpacing:"0.07em", textTransform:"uppercase", fontWeight:500, marginBottom:10 }}>Members</div>
                        <div style={{ display:"flex", flexWrap:"wrap", gap:5 }}>
                          {ring.members.map(m => (
                            <span key={m} style={{
                              fontSize:11, padding:"3px 10px",
                              border:"1px solid #e8e8e8", borderRadius:40,
                              color:"#666", fontFamily:"monospace", cursor:"pointer",
                              transition:"background 0.15s, border-color 0.15s",
                            }}
                            onClick={() => {
                              const acc = activeAccounts.find(a=>a.id===m);
                              if(acc) handleNodeClick({id:acc.id, score:acc.score});
                            }}
                            onMouseEnter={e=>{e.target.style.background="#f8f8f8";e.target.style.borderColor="#999";}}
                            onMouseLeave={e=>{e.target.style.background="";e.target.style.borderColor="#e8e8e8";}}
                            >{m}</span>
                          ))}
                        </div>
                      </div>

                      {/* View accounts button */}
                      <div style={{ marginTop:18, borderTop:"1px solid #f0f0f0", paddingTop:18 }}>
                        <button onClick={()=>{setHighlightRing(ring.id);setTab("accounts");}} style={{
                          background:"none", border:"none", cursor:"pointer",
                          fontSize:13, color:"#888", fontFamily:GS, padding:0,
                          display:"flex", alignItems:"center", gap:5,
                        }}>
                          View flagged accounts →
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ACCOUNTS */}
          {tab==="accounts" && (
            <div style={{ paddingBottom:100 }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:32 }}>
                <div style={{ display:"flex", alignItems:"center", gap:16 }}>
                  <h2 style={{ fontSize:26, fontWeight:600, letterSpacing:"-0.02em" }}>Suspicious accounts</h2>
                  {highlightRing && (
                    <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                      <span style={{ fontSize:12, padding:"4px 12px", background:"#fff7ed", border:"1px solid #F97316", borderRadius:40, color:"#F97316", fontWeight:500 }}>
                        {highlightRing}
                      </span>
                      <button onClick={()=>setHighlightRing(null)} style={{
                        background:"none", border:"none", cursor:"pointer",
                        fontSize:13, color:"#888", padding:0, fontFamily:GS,
                      }}>Clear ×</button>
                    </div>
                  )}
                </div>
                <div style={{ display:"flex", gap:12, alignItems:"center" }}>
                  <input
                    placeholder="Search account ID…"
                    value={search} onChange={e=>setSearch(e.target.value)}
                    style={{
                      padding:"9px 16px", border:"1px solid #d8d8d8", borderRadius:40,
                      fontSize:13, outline:"none", fontFamily:GS, minWidth:210,
                    }}
                  />
                  <button onClick={()=>setDesc(!desc)} style={{
                    padding:"9px 18px", border:"1px solid #d8d8d8", borderRadius:40,
                    background:"#fff", fontSize:13, cursor:"pointer", fontFamily:GS, color:"#666",
                  }}>Score {desc?"↓":"↑"}</button>
                </div>
              </div>

              {/* Risk legend for accounts */}
              <div style={{ display:"flex", gap:16, marginBottom:20, flexWrap:"wrap" }}>
                {[
                  { color:"#DC2626", label:"Critical ≥85" },
                  { color:"#F97316", label:"High 70–84" },
                  { color:"#3B82F6", label:"Medium 55–69" },
                  { color:"#22C55E", label:"Low <55" },
                ].map(l => (
                  <span key={l.label} style={{ display:"flex", alignItems:"center", gap:6, fontSize:12, color:"#666" }}>
                    <span style={{ width:8,height:8,background:l.color,borderRadius:"50%",display:"inline-block" }}/>
                    {l.label}
                  </span>
                ))}
              </div>

              <div style={{ border:"1px solid #e8e8e8", borderRadius:6, overflow:"hidden" }}>
                <table style={{ width:"100%", borderCollapse:"collapse" }}>
                  <thead>
                    <tr style={{ borderBottom:"1px solid #e8e8e8", background:"#fafafa" }}>
                      {["Account ID","Score","Detected patterns","Ring"].map(h => (
                        <th key={h} style={{
                          padding:"13px 20px", textAlign:"left",
                          fontSize:11, color:"#aaa", fontWeight:500,
                          letterSpacing:"0.07em", textTransform:"uppercase",
                        }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {accounts.map((a, i) => {
                      const color = nodeColor(a.score);
                      return (
                        <tr key={a.id}
                          className="clickable-row"
                          onClick={() => handleAccountRowClick(a)}
                          title="Click to view this ring"
                          style={{ borderBottom:"1px solid #f2f2f2", animationDelay:`${i*30}ms` }}>
                          <td style={{ padding:"15px 20px" }}>
                            <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                              <span style={{ width:8,height:8,background:color,borderRadius:"50%",flexShrink:0 }}/>
                              <span style={{ fontFamily:"monospace", fontSize:13, fontWeight:600 }}>{a.id}</span>
                            </div>
                          </td>
                          <td style={{ padding:"15px 20px", minWidth:180 }}>
                            <ScoreBar score={a.score} animated={animateBars}/>
                          </td>
                          <td style={{ padding:"15px 20px" }}>
                            <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
                              {a.patterns.map(p => <Pill key={p} label={patternLabel[p]||p}/>)}
                            </div>
                          </td>
                          <td style={{ padding:"15px 20px" }}>
                            <span style={{ fontSize:12, fontFamily:"monospace", color:"#888" }}>{a.ring}</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div style={{ marginTop:20, fontSize:13, color:"#aaa" }}>
                Showing {accounts.length} of {activeAccounts.length} accounts · click any row to view its fraud ring
              </div>
            </div>
          )}
        </div>
      )}

      {/* Node Inspector Modal */}
      {inspectNode && (
        <NodeModal
          node={inspectNode.node}
          ring={inspectNode.ring}
          onClose={()=>setInspectNode(null)}
        />
      )}

      {/* Toast */}
      {toast && <Toast msg={toast} onDone={()=>setToast(null)}/>}
    </div>
  );
}
