/** localStorage key for the user's choice: "dark" or "light". Unset means "follow the system". */
export const THEME_STORAGE_KEY = "theme";

/**
 * Runs in <head> before the page paints, so there is no flash of the wrong theme.
 * Pattern from the Next.js guide "How to prevent flash before hydration".
 */
export const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem("${THEME_STORAGE_KEY}");var dark=t?t==="dark":matchMedia("(prefers-color-scheme: dark)").matches;document.documentElement.classList.toggle("dark",dark)}catch(e){}})()`;
