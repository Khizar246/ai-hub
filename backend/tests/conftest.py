# Shared pytest setup: dummy secrets so core.config validates without real keys,
# and the backend root on sys.path so `agents.*` / `core.*` import from anywhere.

import os
import sys
from pathlib import Path

os.environ.setdefault("ANTHROPIC_API_KEY", "test-key-not-real")
os.environ.setdefault("VOYAGE_API_KEY", "test-key-not-real")

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
