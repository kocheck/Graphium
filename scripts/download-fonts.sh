#!/bin/bash

# Download IBM Plex Fonts Script
# This script downloads IBM Plex Sans and IBM Plex Mono fonts in WOFF2 format
# from the official npm CDN (unpkg.com)

set -e

echo "📥 Downloading IBM Plex fonts..."

# Base URL for IBM Plex fonts
BASE_URL="https://unpkg.com/@ibm/plex@6.4.1"

# Destination directories
SANS_DIR="src/assets/fonts/ibm-plex-sans"
MONO_DIR="src/assets/fonts/ibm-plex-mono"

# Create directories if they don't exist
mkdir -p "$SANS_DIR"
mkdir -p "$MONO_DIR"

echo ""
echo "🔤 Downloading IBM Plex Sans..."

# Download IBM Plex Sans fonts
curl -sL -o "$SANS_DIR/IBMPlexSans-Regular.woff2" \
  "$BASE_URL/IBM-Plex-Sans/fonts/complete/woff2/IBMPlexSans-Regular.woff2"
echo "  ✓ Regular (400)"

curl -sL -o "$SANS_DIR/IBMPlexSans-Medium.woff2" \
  "$BASE_URL/IBM-Plex-Sans/fonts/complete/woff2/IBMPlexSans-Medium.woff2"
echo "  ✓ Medium (500)"

curl -sL -o "$SANS_DIR/IBMPlexSans-SemiBold.woff2" \
  "$BASE_URL/IBM-Plex-Sans/fonts/complete/woff2/IBMPlexSans-SemiBold.woff2"
echo "  ✓ SemiBold (600)"

curl -sL -o "$SANS_DIR/IBMPlexSans-Bold.woff2" \
  "$BASE_URL/IBM-Plex-Sans/fonts/complete/woff2/IBMPlexSans-Bold.woff2"
echo "  ✓ Bold (700)"

echo ""
echo "💻 Downloading IBM Plex Mono..."

# Download IBM Plex Mono fonts
curl -sL -o "$MONO_DIR/IBMPlexMono-Regular.woff2" \
  "$BASE_URL/IBM-Plex-Mono/fonts/complete/woff2/IBMPlexMono-Regular.woff2"
echo "  ✓ Regular (400)"

curl -sL -o "$MONO_DIR/IBMPlexMono-Medium.woff2" \
  "$BASE_URL/IBM-Plex-Mono/fonts/complete/woff2/IBMPlexMono-Medium.woff2"
echo "  ✓ Medium (500)"

curl -sL -o "$MONO_DIR/IBMPlexMono-SemiBold.woff2" \
  "$BASE_URL/IBM-Plex-Mono/fonts/complete/woff2/IBMPlexMono-SemiBold.woff2"
echo "  ✓ SemiBold (600)"

curl -sL -o "$MONO_DIR/IBMPlexMono-Bold.woff2" \
  "$BASE_URL/IBM-Plex-Mono/fonts/complete/woff2/IBMPlexMono-Bold.woff2"
echo "  ✓ Bold (700)"

echo ""
echo "✅ All fonts downloaded successfully!"
echo ""
echo "Font sizes:"
du -sh "$SANS_DIR"
du -sh "$MONO_DIR"
echo ""
echo "Total font files:"
find src/assets/fonts -name "*.woff2" | wc -l
