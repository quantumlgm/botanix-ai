# botanix-ai
AI-powered plant identification and botanical insights.

## Render deployment configuration

Set `VITE_API_URL` on the Vite Static Site to the FastAPI Web Service's HTTPS
URL. The production frontend requires this value because the static site and API
are deployed as separate services.

Set `CORS_ALLOWED_ORIGINS` on the FastAPI Web Service to a comma-separated list
of exact frontend origins, including the scheme (for example,
`https://your-frontend.onrender.com`). Keep the local defaults for local
development if needed. Do not use `*` when credentials are enabled.

Keep `DEBUG=false` on Render. Set `DEBUG=true` only in a local backend
environment if the `dev_mock` Telegram payload is needed for development.
