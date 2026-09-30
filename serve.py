"""Serve the static app locally; production requires only static files."""
import argparse
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

parser = argparse.ArgumentParser()
parser.add_argument("--port", type=int, default=8000)
args = parser.parse_args()
handler = partial(SimpleHTTPRequestHandler, directory=str(Path(__file__).parent))
with ThreadingHTTPServer(("127.0.0.1", args.port), handler) as server:
    print(f"FladSim: http://localhost:{args.port}", flush=True)
    server.serve_forever()
