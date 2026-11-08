// Use the platform's installed Korean faces without requesting a font inventory.
const aliases = {
  "함초롬바탕": ["함초롬바탕", "바탕", "Batang", "AppleMyungjo", "Noto Serif CJK KR"],
  "함초롬돋움": ["함초롬돋움", "맑은 고딕", "Malgun Gothic", "Apple SD Gothic Neo", "Noto Sans CJK KR"]
};
export const REGISTERED_FONTS = new Set(Object.keys(aliases));
const detected = new Set();
export function getDetectedOSFonts() { return detected; }
let ready;
export function loadWebFonts() {
  return ready ??= Promise.all(Object.entries(aliases).map(async ([name, candidates]) => {
    const source = candidates.map(font => 'local("' + font + '")').join(", ");
    try {
      const face = await new FontFace(name, source).load();
      document.fonts.add(face);
      detected.add(name);
    } catch { /* The system fallback is still available. */ }
  }));
}
