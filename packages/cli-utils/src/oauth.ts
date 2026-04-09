import { createHash, randomBytes } from 'node:crypto';
import {
  type IncomingMessage,
  type ServerResponse,
  createServer,
} from 'node:http';
import { URL } from 'node:url';

function generateCodeVerifier(): string {
  return randomBytes(32).toString('base64url');
}

function deriveCodeChallenge(verifier: string): string {
  return createHash('sha256').update(verifier).digest('base64url');
}

const CLIENT_ID = 'iGmvrtZyY3k4VgXUJk9aA_hp9ViZXmxjfg8vteaYyug';
const DEFAULT_OAUTH_BASE_URL = 'https://oauth.datocms.com';
const REDIRECT_PORT = 7651;
const REDIRECT_URI = `http://localhost:${REDIRECT_PORT}/callback`;
const SCOPES = 'read_account read_sites read_organizations';

function buildAuthorizeUrl(
  state: string,
  codeChallenge: string,
  oauthBaseUrl: string,
): string {
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    response_type: 'code',
    redirect_uri: REDIRECT_URI,
    scope: SCOPES,
    state,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
  });

  return `${oauthBaseUrl}/oauth/authorize?${params.toString()}`;
}

async function exchangeCodeForToken(
  code: string,
  codeVerifier: string,
  oauthBaseUrl: string,
): Promise<string> {
  const tokenUrl = `${oauthBaseUrl}/oauth/token`;

  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      grant_type: 'authorization_code',
      code,
      redirect_uri: REDIRECT_URI,
      code_verifier: codeVerifier,
    }).toString(),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Token exchange failed (${response.status}): ${body}`);
  }

  const data = (await response.json()) as { access_token: string };

  return data.access_token;
}

const SUCCESS_HTML = `<!DOCTYPE html>
<html>
<head><title>DatoCMS CLI</title></head>
<body style="font-family: system-ui, sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0;">
  <div style="text-align: center;">
    <h1>Login successful!</h1>
    <p>You can close this tab and return to the terminal.</p>
  </div>
</body>
</html>`;

export async function revokeOAuthToken(
  token: string,
  oauthBaseUrl?: string,
): Promise<void> {
  const baseUrl = oauthBaseUrl || DEFAULT_OAUTH_BASE_URL;

  await fetch(`${baseUrl}/oauth/revoke`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      token,
    }).toString(),
  });
}

export type PerformOAuthLoginOptions = {
  oauthBaseUrl?: string;
  openBrowser: (url: string) => Promise<void>;
  promptForUrl: (authorizeUrl: string) => Promise<string>;
  onListening: () => void;
  onOobFallback: () => void;
};

export async function performOAuthLogin(
  options: PerformOAuthLoginOptions,
): Promise<string> {
  const oauthBaseUrl = options.oauthBaseUrl || DEFAULT_OAUTH_BASE_URL;
  const state = randomBytes(16).toString('hex');
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = deriveCodeChallenge(codeVerifier);
  const authorizeUrl = buildAuthorizeUrl(state, codeChallenge, oauthBaseUrl);

  const serverResult = await tryStartServer(state, codeVerifier, oauthBaseUrl);

  if (!serverResult) {
    options.onOobFallback();
    const pastedUrl = await options.promptForUrl(authorizeUrl);

    const parsed = new URL(pastedUrl);
    const code = parsed.searchParams.get('code');
    const returnedState = parsed.searchParams.get('state');

    if (returnedState !== state) {
      throw new Error('Invalid state parameter in the pasted URL');
    }

    if (!code) {
      throw new Error('No authorization code found in the pasted URL');
    }

    return exchangeCodeForToken(code, codeVerifier, oauthBaseUrl);
  }

  options.onListening();
  await options.openBrowser(authorizeUrl);

  const token = await serverResult.waitForToken();

  if (!token) {
    throw new Error('Authentication failed');
  }

  return token;
}

type ServerHandle = {
  waitForToken: () => Promise<string | null>;
};

function tryStartServer(
  state: string,
  codeVerifier: string,
  oauthBaseUrl: string,
): Promise<ServerHandle | null> {
  return new Promise((resolveStart) => {
    let resolveToken: (token: string | null) => void;

    const tokenPromise = new Promise<string | null>((resolve) => {
      resolveToken = resolve;
    });

    const server = createServer(
      async (req: IncomingMessage, res: ServerResponse) => {
        const url = new URL(
          req.url || '/',
          `http://localhost:${REDIRECT_PORT}`,
        );

        if (url.pathname !== '/callback') {
          res.writeHead(404);
          res.end('Not found');
          return;
        }

        const code = url.searchParams.get('code');
        const returnedState = url.searchParams.get('state');

        if (returnedState !== state) {
          res.writeHead(400);
          res.end('Invalid state parameter');
          return;
        }

        if (!code) {
          const error =
            url.searchParams.get('error_description') ||
            'No authorization code received';
          res.writeHead(400);
          res.end(error);
          server.close();
          resolveToken!(null);
          return;
        }

        try {
          const accessToken = await exchangeCodeForToken(
            code,
            codeVerifier,
            oauthBaseUrl,
          );
          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end(SUCCESS_HTML);
          server.close();
          resolveToken!(accessToken);
        } catch (err) {
          res.writeHead(500);
          res.end(
            `Token exchange failed: ${
              err instanceof Error ? err.message : String(err)
            }`,
          );
          server.close();
          resolveToken!(null);
        }
      },
    );

    server.once('error', () => {
      resolveStart(null);
    });

    server.once('listening', () => {
      resolveStart({
        waitForToken: () => tokenPromise,
      });
    });

    server.listen(REDIRECT_PORT, '127.0.0.1');
  });
}
