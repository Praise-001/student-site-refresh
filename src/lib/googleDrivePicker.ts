const API_KEY = import.meta.env.VITE_GOOGLE_API_KEY;
const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;
const SCOPES = 'https://www.googleapis.com/auth/drive.readonly';

export const isGoogleDriveConfigured = Boolean(API_KEY && CLIENT_ID);

let tokenClient: any = null;
let accessToken: string | null = null;
let pickerLoaded = false;
let gisLoaded = false;

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) {
      resolve();
      return;
    }
    const script = document.createElement('script');
    script.src = src;
    script.onload = () => resolve();
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

async function ensureGapiLoaded(): Promise<void> {
  if (pickerLoaded) return;
  await loadScript('https://apis.google.com/js/api.js');
  await new Promise<void>((resolve) => {
    (window as any).gapi.load('picker', () => {
      pickerLoaded = true;
      resolve();
    });
  });
}

async function ensureGisLoaded(): Promise<void> {
  if (gisLoaded) return;
  await loadScript('https://accounts.google.com/gsi/client');
  gisLoaded = true;
}

function getAccessToken(): Promise<string> {
  return new Promise((resolve, reject) => {
    if (accessToken) {
      resolve(accessToken);
      return;
    }

    if (!tokenClient) {
      tokenClient = (window as any).google.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID,
        scope: SCOPES,
        callback: (response: any) => {
          if (response.error) {
            reject(new Error(response.error));
            return;
          }
          accessToken = response.access_token;
          // Token expires in ~1hr, clear it after 50 min
          setTimeout(() => { accessToken = null; }, 50 * 60 * 1000);
          resolve(response.access_token);
        },
      });
    }

    tokenClient.requestAccessToken();
  });
}

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
}

export async function openDrivePicker(): Promise<File | null> {
  if (!isGoogleDriveConfigured) {
    throw new Error('Google Drive is not configured');
  }

  await Promise.all([ensureGapiLoaded(), ensureGisLoaded()]);
  const token = await getAccessToken();

  return new Promise((resolve) => {
    const google = (window as any).google;
    const view = new google.picker.DocsView()
      .setIncludeFolders(false)
      .setMimeTypes(
        'application/pdf,' +
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document,' +
        'application/msword,' +
        'application/vnd.openxmlformats-officedocument.presentationml.presentation,' +
        'application/vnd.ms-powerpoint,' +
        'text/plain,' +
        'image/png,image/jpeg,image/gif,image/webp'
      );

    const picker = new google.picker.PickerBuilder()
      .addView(view)
      .setOAuthToken(token)
      .setDeveloperKey(API_KEY)
      .setCallback(async (data: any) => {
        if (data.action === google.picker.Action.PICKED) {
          const doc = data.docs[0];
          try {
            const file = await downloadDriveFile(doc.id, doc.name, doc.mimeType, token);
            resolve(file);
          } catch (err) {
            console.error('Failed to download Drive file:', err);
            resolve(null);
          }
        } else if (data.action === google.picker.Action.CANCEL) {
          resolve(null);
        }
      })
      .build();

    picker.setVisible(true);
  });
}

async function downloadDriveFile(
  fileId: string,
  fileName: string,
  mimeType: string,
  token: string
): Promise<File> {
  // Google Docs/Sheets/Slides need to be exported
  const googleDocTypes: Record<string, string> = {
    'application/vnd.google-apps.document': 'application/pdf',
    'application/vnd.google-apps.spreadsheet': 'application/pdf',
    'application/vnd.google-apps.presentation': 'application/pdf',
  };

  let url: string;
  let finalMimeType = mimeType;

  if (googleDocTypes[mimeType]) {
    finalMimeType = googleDocTypes[mimeType];
    url = `https://www.googleapis.com/drive/v3/files/${fileId}/export?mimeType=${encodeURIComponent(finalMimeType)}`;
    if (!fileName.endsWith('.pdf')) fileName += '.pdf';
  } else {
    url = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;
  }

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    throw new Error(`Failed to download file: ${response.statusText}`);
  }

  const blob = await response.blob();
  return new File([blob], fileName, { type: finalMimeType });
}
