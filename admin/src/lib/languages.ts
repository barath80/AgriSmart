/** Languages farmers can use — must match the backend `Language` enum. */
export const LANGUAGES = [
  { code: "en", name: "English" }, { code: "hi", name: "Hindi" }, { code: "bn", name: "Bengali" },
  { code: "te", name: "Telugu" }, { code: "mr", name: "Marathi" }, { code: "ta", name: "Tamil" },
  { code: "gu", name: "Gujarati" }, { code: "kn", name: "Kannada" }, { code: "ml", name: "Malayalam" },
  { code: "or", name: "Odia" }, { code: "pa", name: "Punjabi" },
] as const;

export const languageName = (code: string): string => LANGUAGES.find((l) => l.code === code)?.name ?? code;
