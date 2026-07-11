# Dot-source this to set up the local dev environment on Windows:
#   . .\local-dev\env.local.ps1
# Local-only values; Replit provides its own env via Secrets.

$env:PATH = "C:\Users\46743\tools\node-v24.16.0-win-x64;C:\Users\46743\AppData\Local\Programs\Git\usr\bin;" + $env:PATH

# API server
$env:PORT = "8080"
$env:DATABASE_URL = "postgresql://postgres@localhost:5544/belief_analyzer"

# LLM — mock by default (run: node local-dev/mock-openai.cjs).
# For live DeepSeek, replace with the real key and remove the BASE_URL override.
$env:OPENAI_API_KEY = "mock-local-key"
$env:AI_INTEGRATIONS_OPENAI_BASE_URL = "http://localhost:8090/v1"

# Expo app -> local API (scheme helper picks http for localhost)
$env:EXPO_PUBLIC_DOMAIN = "localhost:8080"

# Replit-parity build inputs
$env:BASE_PATH = "/"
