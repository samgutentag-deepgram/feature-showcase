# The redirect image, the same for every old app. The demo id comes from the app's own name:
# Fly sets FLY_APP_NAME=dg-devrel-<id> at run time. DEMO, if set, wins (for a local run).
FROM caddy:2.10-alpine
COPY Caddyfile /etc/caddy/Caddyfile
CMD ["sh", "-c", "DEMO=${DEMO:-${FLY_APP_NAME#dg-devrel-}}; case $DEMO in ''|*[!a-z0-9-]*) echo \"no demo id (FLY_APP_NAME=$FLY_APP_NAME)\" >&2; exit 1;; esac; export DEMO; exec caddy run --config /etc/caddy/Caddyfile --adapter caddyfile"]
