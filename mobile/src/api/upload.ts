import { File } from 'expo-file-system';

/**
 * A local file (photo, voice recording) ready for `FormData.append`.
 *
 * Expo's fetch (the global `fetch` since SDK 52) does not accept React Native's old
 * `{ uri, name, type }` descriptor and fails before sending anything. An expo-file-system
 * `File` is a real Blob it can stream. Its MIME type comes from the file extension.
 */
export async function fileForUpload(uri: string, _name: string, _type: string): Promise<Blob> {
  return new File(uri);
}
