# GitHub Secrets required for auto-deploy

Go to your repo on GitHub → **Settings → Secrets and variables → Actions → New repository secret**
and add each of these:

| Secret name    | Value |
|----------------|-------|
| `VPS_HOST`     | Your domain or VPS IP, e.g. `karaoke.mysite.com` |
| `VPS_USER`     | SSH login username, usually `root` on Hostinger |
| `VPS_SSH_KEY`  | Your **private** SSH key (the full contents of `~/.ssh/id_ed25519` or `id_rsa`) |
| `VPS_PORT`     | SSH port — Hostinger default is `22` |

## Generating an SSH key pair (if you don't have one)

Run this on your local machine (or the VPS — just copy the key pair):

```bash
ssh-keygen -t ed25519 -C "github-deploy" -f ~/.ssh/karaoke_deploy
```

This creates two files:
- `~/.ssh/karaoke_deploy`      ← **private key** → paste into `VPS_SSH_KEY` secret
- `~/.ssh/karaoke_deploy.pub`  ← public key → add to VPS

### Add the public key to the VPS

```bash
ssh root@YOUR_VPS_IP
mkdir -p ~/.ssh
echo "PASTE_PUBLIC_KEY_HERE" >> ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys
```

Or from your local machine:
```bash
ssh-copy-id -i ~/.ssh/karaoke_deploy.pub root@YOUR_VPS_IP
```

## How it works

Every `git push` to `master` triggers `.github/workflows/deploy.yml`, which:
1. SSHes into the VPS
2. `git pull origin master`
3. `npm install` (server) + `npm install && npm run build` (client)
4. `pm2 restart karaoke-server`

The `server/.env` file on the VPS is **never touched** by the workflow — it stays as you set it up manually. Only code changes are deployed.
