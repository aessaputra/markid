export type Theme = 'system' | 'light' | 'dark';
const themeKey = 'markid-theme';
export function readTheme(): Theme {
 try {const value=localStorage.getItem(themeKey);if(value==='light' || value==='dark') return value;} catch { /* Storage is optional. */ }
 return 'system';
}
export function applyTheme(theme: Theme): void {
 document.documentElement.dataset.theme=theme==='system' ? (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark':'light') : theme;
}
export function setTheme(theme: Theme): void {
 try {localStorage.setItem(themeKey,theme);} catch { /* Keep the in-memory preference. */ }
 applyTheme(theme);
}
export function watchSystemTheme(preference: () => Theme): () => void {
 const media=matchMedia('(prefers-color-scheme: dark)');
 const changed=() => {if(preference()==='system') applyTheme('system');};
 media.addEventListener('change',changed);
 return () => media.removeEventListener('change',changed);
}
