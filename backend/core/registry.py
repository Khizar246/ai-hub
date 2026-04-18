# Agent registry dict — mirrors frontend agentRegistry.ts, used to validate agent routes

AGENT_REGISTRY: dict[str, dict[str, str]] = {
    "audit": {
        "name": "AI Audit Agent",
        "router_prefix": "/agents/audit",
    },
    "news": {
        "name": "News Research Agent",
        "router_prefix": "/agents/news",
    },
    "data": {
        "name": "TalkToData Engine",
        "router_prefix": "/agents/data",
    },
}
