import 'dotenv/config';

import DirectusSDK from '@directus/sdk-js';

const directusUrl = process.env.DIRECTUS_URL;
const directusProject = process.env.DIRECTUS_PROJECT;
const directusEmail = process.env.DIRECTUS_USER_EMAIL;
const directusPass = process.env.DIRECTUS_USER_PASSWORD;

async function getDirectusClient() {
  const client = new DirectusSDK({
    url: directusUrl,
    project: directusProject,
  });

  await client.login({
    email: directusEmail,
    password: directusPass,
  });

  return client;
}

export default getDirectusClient;
