#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INSTALL_DIR="$(dirname "$SCRIPT_DIR")"
SERVICE_DIR="$HOME/.config/systemd/user"

echo "Installing claude-code-viewer systemd services..."
echo "  Install dir: $INSTALL_DIR"
echo "  Home: $HOME"

mkdir -p "$SERVICE_DIR"

# Claude Code Viewer service
sed -e "s|{{INSTALL_DIR}}|$INSTALL_DIR|g" \
    -e "s|{{HOME}}|$HOME|g" \
    "$SCRIPT_DIR/claude-code-viewer.service.template" \
    > "$SERVICE_DIR/claude-code-viewer.service"

echo "Created: $SERVICE_DIR/claude-code-viewer.service"

# Cloudflared service (optional)
if command -v cloudflared &> /dev/null; then
    cp "$SCRIPT_DIR/cloudflared.service.template" "$SERVICE_DIR/cloudflared.service"
    echo "Created: $SERVICE_DIR/cloudflared.service"
    SERVICES="cloudflared claude-code-viewer"
else
    echo "Skipping cloudflared (not installed)"
    SERVICES="claude-code-viewer"
fi

systemctl --user daemon-reload
systemctl --user enable $SERVICES

echo ""
echo "Services enabled. To start now:"
echo "  systemctl --user start $SERVICES"
echo ""
echo "To enable at boot (without login):"
echo "  sudo loginctl enable-linger $USER"
