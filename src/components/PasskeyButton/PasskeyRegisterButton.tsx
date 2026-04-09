import { useUser } from '../../contexts/UserContextCore';
import styles from './PasskeyButton.module.scss';
import { Icon } from '../Icons/AutoIcons';

const passkeyIcon = <Icon name='Passkey' />;

function base64UrlToUint8Array(base64UrlString: string) {
  const base64 =
    base64UrlString.replace(/-/g, '+').replace(/_/g, '/') +
    '=='.slice(0, (4 - (base64UrlString.length % 4)) % 4);
  const raw = atob(base64);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

function bufferToBase64Url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  bytes.forEach((b) => (binary += String.fromCharCode(b)));
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

export default function PasskeyRegisterButton() {
  const { user, applyDeviceChallenge } = useUser();
  const handleRegister = async () => {
    try {
      const startRes = await fetch('/api/passkey/register/start/', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: user?.email }),
      });

      if (!startRes.ok) {
        const err = await startRes.json();
        console.error('Start registration error:', err);
        return;
      }

      const options = await startRes.json();
      const publicKey = {
        challenge: base64UrlToUint8Array(options.challenge),
        rp: options.rp,
        user: {
          id: base64UrlToUint8Array(options.user.id),
          name: options.user.name,
          displayName: options.user.displayName,
        },
        pubKeyCredParams: options.pubKeyCredParams,
        timeout: options.timeout || 60000,
        authenticatorSelection: options.authenticatorSelection,
        attestation: options.attestation || 'none',
      };

      const credential = (await navigator.credentials.create({
        publicKey,
      })) as PublicKeyCredential;

      const body = {
        id: credential.id,
        rawId: bufferToBase64Url(credential.rawId),
        type: credential.type,
        response: {
          clientDataJSON: bufferToBase64Url(
            (credential.response as AuthenticatorAttestationResponse)
              .clientDataJSON,
          ),
          attestationObject: bufferToBase64Url(
            (credential.response as AuthenticatorAttestationResponse)
              .attestationObject,
          ),
        },
      };

      const finishRes = await fetch('/api/passkey/register/finish/', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      const finishData = await finishRes.json();
      if (!finishRes.ok) {
        console.error('Finish registration error:', finishData);
        return;
      }
      if (finishData.needs_device_confirmation && finishData.challenge_id) {
        applyDeviceChallenge({
          challenge_id: finishData.challenge_id as string,
          ...(typeof finishData.trusted_device === 'string' &&
          finishData.trusted_device.trim()
            ? { trusted_device: finishData.trusted_device.trim() }
            : {}),
        });
        return;
      }
    } catch (e) {
      console.error('Registration failed:', e);
    }
  };

  return (
    <button onClick={handleRegister} className={styles.passkeyButton}>
      {passkeyIcon}
      Add Passkey
    </button>
  );
}
