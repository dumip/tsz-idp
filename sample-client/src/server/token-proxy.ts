/**
 * Vite dev server plugin that proxies token exchange requests.
 *
 * When VITE_CLIENT_SECRET is set, the browser POSTs to /api/token with
 * { code, code_verifier, redirect_uri }.  This plugin forwards the request
 * to Cognito's /oauth2/token endpoint adding HTTP Basic auth
 * (client_id:client_secret) so the secret never leaves the server.
 */
import { type Plugin, loadEnv } from 'vite';

export function tokenProxyPlugin(): Plugin {
  let clientId = '';
  let clientSecret = '';
  let tokenUrl = '';
  let basicAuth = '';

  return {
    name: 'token-proxy',

    config(_, { mode }) {
      const env = loadEnv(mode, process.cwd(), 'VITE_');
      clientId = env.VITE_COGNITO_CLIENT_ID || '';
      clientSecret = env.VITE_CLIENT_SECRET || '';
      const cognitoDomain = env.VITE_COGNITO_DOMAIN || '';

      if (clientSecret && cognitoDomain) {
        tokenUrl = `https://${cognitoDomain}/oauth2/token`;
        basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
      }
    },

    configureServer(server) {
      if (!clientSecret) return; // public client, nothing to proxy

      server.middlewares.use('/api/token', async (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.end(JSON.stringify({ error: 'Method not allowed' }));
          return;
        }

        const chunks: Buffer[] = [];
        for await (const chunk of req) {
          chunks.push(chunk as Buffer);
        }
        const body = JSON.parse(Buffer.concat(chunks).toString());

        const params = new URLSearchParams({
          grant_type: 'authorization_code',
          code: body.code,
          redirect_uri: body.redirect_uri,
          code_verifier: body.code_verifier,
        });

        try {
          const upstream = await fetch(tokenUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
              Authorization: `Basic ${basicAuth}`,
            },
            body: params.toString(),
          });

          const data = await upstream.text();
          res.statusCode = upstream.status;
          res.setHeader('Content-Type', 'application/json');
          res.end(data);
        } catch (err) {
          res.statusCode = 502;
          res.end(JSON.stringify({ error: 'Token proxy request failed' }));
        }
      });
    },
  };
}
