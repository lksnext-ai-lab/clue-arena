import { getAuth } from 'firebase-admin/auth';
import { getFirebaseAdminApp, getFirebaseProjectId } from './firebase-admin';
import { getFirebaseAuthProviderIds, getFirebaseAuthProviderLabel } from './firebase-provider';

export type FirebaseAuthOption = {
  id: string;
  kind: 'password' | 'oauth' | 'oidc' | 'saml';
  label: string;
};

function providerIdToKind(providerId: string): FirebaseAuthOption['kind'] {
  if (providerId === 'password') return 'password';
  if (providerId.startsWith('saml.')) return 'saml';
  if (providerId.startsWith('oidc.')) return 'oidc';
  return 'oauth';
}

function toAuthOption(providerId: string): FirebaseAuthOption {
  return {
    id: providerId,
    kind: providerIdToKind(providerId),
    label: getFirebaseAuthProviderLabel(providerId),
  };
}

async function getAdminAccessToken(): Promise<string> {
  const credential = getFirebaseAdminApp().options.credential;
  if (!credential) throw new Error('No Firebase Admin credential configured');
  const token = await credential.getAccessToken();
  return token.access_token;
}

interface IdentityToolkitConfig {
  signIn?: {
    email?: { enabled?: boolean };
    phoneNumber?: { enabled?: boolean };
  };
}

interface DefaultSupportedIdpConfigsResponse {
  defaultSupportedIdpConfigs?: Array<{ name: string; enabled: boolean }>;
}

async function fetchEnabledProvidersFromApi(projectId: string): Promise<string[]> {
  const accessToken = await getAdminAccessToken();
  const baseUrl = `https://identitytoolkit.googleapis.com/admin/v2/projects/${projectId}`;
  const headers = { Authorization: `Bearer ${accessToken}` };

  const [configRes, idpRes] = await Promise.all([
    fetch(`${baseUrl}/config`, { headers }),
    fetch(`${baseUrl}/defaultSupportedIdpConfigs`, { headers }),
  ]);

  const providers: string[] = [];

  if (configRes.ok) {
    const config = (await configRes.json()) as IdentityToolkitConfig;
    if (config.signIn?.email?.enabled) providers.push('password');
    if (config.signIn?.phoneNumber?.enabled) providers.push('phone');
  }

  if (idpRes.ok) {
    const { defaultSupportedIdpConfigs = [] } =
      (await idpRes.json()) as DefaultSupportedIdpConfigsResponse;
    for (const idp of defaultSupportedIdpConfigs) {
      if (idp.enabled) {
        // name format: "projects/PROJECT_ID/defaultSupportedIdpConfigs/google.com"
        const providerId = idp.name.split('/').pop();
        if (providerId) providers.push(providerId);
      }
    }
  }

  // SAML and OIDC custom providers via native Admin SDK method
  const auth = getAuth(getFirebaseAdminApp());
  const [samlResult, oidcResult] = await Promise.all([
    auth.listProviderConfigs({ type: 'saml' }),
    auth.listProviderConfigs({ type: 'oidc' }),
  ]);
  for (const cfg of [...samlResult.providerConfigs, ...oidcResult.providerConfigs]) {
    if (cfg.enabled) providers.push(cfg.providerId);
  }

  return providers;
}

export async function getFirebaseAuthOptions(): Promise<FirebaseAuthOption[]> {
  const projectId = getFirebaseProjectId();

  if (projectId) {
    try {
      const providerIds = await fetchEnabledProvidersFromApi(projectId);
      if (providerIds.length > 0) {
        return providerIds.map(toAuthOption);
      }
    } catch (error) {
      console.warn(
        '[firebase-auth-options] Could not fetch providers from Admin SDK, falling back to env:',
        error,
      );
    }
  }

  // Fallback: read from NEXT_PUBLIC_FIREBASE_AUTH_PROVIDER env variable
  return getFirebaseAuthProviderIds().map(toAuthOption);
}
