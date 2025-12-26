# Systemd User Services

This directory contains systemd user service templates for running Claude Code Viewer as a background service.

## Prerequisites

- Node.js >= 20
- `pnpm build` completed
- (Optional) `cloudflared` for Cloudflare Tunnel access

## Installation

```bash
./systemd/install.sh
```

This will:
1. Generate service files from templates with your paths
2. Install them to `~/.config/systemd/user/`
3. Enable the services

## Start Services

```bash
systemctl --user start claude-code-viewer

# With Cloudflare Tunnel:
systemctl --user start cloudflared claude-code-viewer
```

## Enable at Boot

By default, user services only start when you log in. To start at boot:

```bash
sudo loginctl enable-linger $USER
```

## Useful Commands

```bash
# Status
systemctl --user status claude-code-viewer

# Logs
journalctl --user -u claude-code-viewer -f

# Restart
systemctl --user restart claude-code-viewer

# Stop
systemctl --user stop claude-code-viewer

# Disable
systemctl --user disable claude-code-viewer
```

## Cloudflare Tunnel Setup

Before using the cloudflared service, configure your tunnel:

```bash
# Login to Cloudflare
cloudflared tunnel login

# Create tunnel
cloudflared tunnel create my-tunnel

# Route DNS
cloudflared tunnel route dns my-tunnel viewer.example.com

# Create config
cat > ~/.cloudflared/config.yml << EOF
tunnel: my-tunnel
credentials-file: /home/$USER/.cloudflared/<UUID>.json

ingress:
  - hostname: viewer.example.com
    service: http://localhost:3000
  - service: http_status:404
EOF
```

See [Cloudflare Tunnel docs](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/) for more details.
