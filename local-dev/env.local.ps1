# Dot-source this to set up the local dev environment on Windows:
#   . .\local-dev\env.local.ps1
# Local-only values; Replit provides its own env via Secrets.

$env:PATH = "C:\Users\46743\tools\node-v24.16.0-win-x64;C:\Users\46743\AppData\Local\Programs\Git\usr\bin;" + $env:PATH

# Repo scripts use sh syntax (export, &&, case) — run them through Git's sh
$env:npm_config_script_shell = "C:\Users\46743\AppData\Local\Programs\Git\usr\bin\sh.exe"

# API server
$env:PORT = "8080"
$env:DATABASE_URL = "postgresql://postgres@localhost:5544/belief_analyzer"

# LLM — mock by default (run: node local-dev/mock-openai.cjs).
# BASE_URL set   -> OpenAI-compatible backend (the mock; zero spend).
# BASE_URL unset -> Claude Agent SDK backend (claude-opus-4-8 via the
#                   Max-subscription OAuth token / logged-in Claude Code).
$env:OPENAI_API_KEY = "mock-local-key"
$env:AI_INTEGRATIONS_OPENAI_BASE_URL = "http://localhost:8090/v1"

# Expo app -> local API (scheme helper picks http for localhost)
$env:EXPO_PUBLIC_DOMAIN = "localhost:8080"

# Replit-parity build inputs
$env:BASE_PATH = "/"
