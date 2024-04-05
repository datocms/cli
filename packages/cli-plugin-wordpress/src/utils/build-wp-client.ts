import WPAPI from 'wpapi';

type WpClientType = {
  /** A WP-API Basic HTTP Authentication username */
  username: string | undefined;
  /** A WP-API Basic HTTP Authentication password */
  password: string | undefined;
  /** The URI for a WP-API endpoint */
  apiUrl: string | undefined;
  /** A URL within a REST API-enabled WordPress website */
  discoverUrl: string | undefined;
};

export async function buildWpClient({
  username,
  password,
  apiUrl,
  discoverUrl,
}: WpClientType): Promise<WPAPI> {
  if (!(username && password)) {
    throw new Error('You need to provide email and password to authenticate!');
  }

  let wpClient: WPAPI;

  if (apiUrl) {
    wpClient = new WPAPI({
      endpoint: apiUrl,
      username,
      password,
    });
  } else if (discoverUrl) {
    wpClient = await WPAPI.discover(discoverUrl);
    await wpClient.auth({ username, password });
  } else {
    throw new Error('You need to provide the URl to your WordPress install!');
  }

  return wpClient;
}
