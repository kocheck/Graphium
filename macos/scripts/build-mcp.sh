#!/usr/bin/env bash
# Builds graphium-mcp (the MCP server that lets AI tools build Graphium maps) and prints
# the settings to paste into Claude, Codex or Cursor. See docs/MCP.md.
# Graphium.app has the server built in (Settings > AI Tools); this is for working without the
# app or on the server itself. While AI Tools is on, the app points the link back at its own copy.
#
#   bash scripts/build-mcp.sh [campaign folder]
#
# The campaign folder is the only place the server may read and write. It defaults to
# ~/Documents/Graphium.
set -euo pipefail
cd "$(dirname "$0")/.."

folder="${1:-$HOME/Documents/Graphium}"
mkdir -p "$folder"
folder="$(cd "$folder" && pwd)"

swift build -c release --product graphium-mcp
built="$(swift build -c release --product graphium-mcp --show-bin-path)/graphium-mcp"
# Copied out of .build so a clean build doesn't break the AI clients pointing at it.
install_dir="$HOME/Library/Application Support/Graphium/bin"
mkdir -p "$install_dir"
bin="$install_dir/graphium-mcp"
cp "$built" "$bin"

cat <<CONFIG

Installed $bin
Campaign folder: $folder

Claude Code:
  claude mcp add --scope user graphium -- "$bin" --root "$folder"

Codex CLI:
  codex mcp add graphium -- "$bin" --root "$folder"

Claude Desktop (Settings > Developer > Edit Config) or Cursor (~/.cursor/mcp.json):
  {
    "mcpServers": {
      "graphium": {
        "command": "$bin",
        "args": ["--root", "$folder"]
      }
    }
  }
CONFIG
