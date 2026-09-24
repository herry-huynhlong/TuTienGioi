# Deploy AWS EC2 With Existing Nginx

This project can run on an existing AWS EC2 host behind Nginx. The recommended small-production shape is:

- Nginx on the host terminates HTTP/HTTPS.
- Docker Compose runs `web`, `worker`, `postgres`, and `redis`.
- `web` only binds to `127.0.0.1:3000`, so it is not public except through Nginx.
- Nginx reverse-proxies the game domain to `127.0.0.1:3000`.

For heavier production, replace local Postgres/Redis with AWS RDS and ElastiCache, then update `DATABASE_URL` and `REDIS_URL`.

## 1. AWS Security Group

Open only:

- `22/tcp` from your IP for SSH.
- `80/tcp` from the internet.
- `443/tcp` from the internet.

Do not open `3000`, `5432`, or `6379` publicly.

## 2. Install Runtime On EC2

Ubuntu example:

```bash
sudo apt update
sudo apt install -y git nginx ca-certificates curl

sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo tee /etc/apt/keyrings/docker.asc >/dev/null
sudo chmod a+r /etc/apt/keyrings/docker.asc
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | sudo tee /etc/apt/sources.list.d/docker.list >/dev/null
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo usermod -aG docker $USER
```

Log out and SSH back in so the Docker group applies.

## 3. Upload Or Clone The Project

```bash
sudo mkdir -p /opt/tutiengioi
sudo chown -R $USER:$USER /opt/tutiengioi
cd /opt/tutiengioi
git clone YOUR_REPO_URL .
```

If you do not use Git yet, upload the project folder with `rsync`/SFTP.

## 4. Configure Environment

```bash
cp .env.production.example .env.production
openssl rand -hex 32
```

Edit `.env.production`:

- Set `POSTGRES_PASSWORD` to a strong database password.
- Set `AUTH_SECRET` to the generated random value.
- Set `APP_URL` to `https://your-domain.com`.
- Set strong `ADMIN_PASSWORD`.
- Set strong `PAYMENT_WEBHOOK_SECRET`.

## 5. Build And Start

```bash
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build postgres redis
docker compose -f docker-compose.prod.yml --env-file .env.production run --rm web pnpm db:migrate
docker compose -f docker-compose.prod.yml --env-file .env.production run --rm web pnpm --filter @ttg/db db:seed
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build web worker
```

Check logs:

```bash
docker compose -f docker-compose.prod.yml --env-file .env.production ps
docker compose -f docker-compose.prod.yml --env-file .env.production logs -f web worker
```

Local health check on the server:

```bash
curl -I http://127.0.0.1:3000
curl http://127.0.0.1:3000/api/health
```

## 6. Wire Existing Nginx

Copy the sample config:

```bash
sudo cp deploy/nginx/tutiengioi.conf /etc/nginx/sites-available/tutiengioi.conf
sudo nano /etc/nginx/sites-available/tutiengioi.conf
```

Replace `your-domain.com` with your real domain.

Enable it:

```bash
sudo ln -s /etc/nginx/sites-available/tutiengioi.conf /etc/nginx/sites-enabled/tutiengioi.conf
sudo nginx -t
sudo systemctl reload nginx
```

If another server block already owns the same domain, merge only the `location /` proxy block into that existing file instead.

## 7. Enable HTTPS

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com -d www.your-domain.com
```

Certbot will update the Nginx server block and set up auto-renewal.

## 8. Updating Later

```bash
cd /opt/tutiengioi
git pull
docker compose -f docker-compose.prod.yml --env-file .env.production build web worker
docker compose -f docker-compose.prod.yml --env-file .env.production run --rm web pnpm db:migrate
docker compose -f docker-compose.prod.yml --env-file .env.production up -d web worker
docker image prune -f
```

## 9. Basic Operations

```bash
docker compose -f docker-compose.prod.yml --env-file .env.production logs -f web
docker compose -f docker-compose.prod.yml --env-file .env.production logs -f worker
docker compose -f docker-compose.prod.yml --env-file .env.production restart web worker
docker compose -f docker-compose.prod.yml --env-file .env.production exec postgres pg_dump -U tutien tutiengioi > backup.sql
```

## 10. Notes

- Keep `.env.production` out of Git.
- Back up Postgres before every deploy that includes migrations.
- Use RDS for safer managed backups once the game has real users.
- Keep Nginx as the only public entrypoint for the app.
