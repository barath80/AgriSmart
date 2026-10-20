/**
 * A local file (photo, voice recording) ready for `FormData.append`.
 *
 * In the browser, pickers and recorders hand back `blob:` or `data:` URLs; reading one gives
 * a Blob that the browser's FormData sends as a normal file part.
 */
export async function fileForUpload(uri: string, name: string, type: string): Promise<Blob> {
  const blob = await (await fetch(uri)).blob();
  return new File([blob], name, { type: blob.type || type });
}
