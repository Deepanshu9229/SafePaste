"use client";

import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { THEME_STORAGE_KEY } from "@/lib/theme";

function toggleTheme() {
  const isDark = document.documentElement.classList.toggle("dark");
  try {
    localStorage.setItem(THEME_STORAGE_KEY, isDark ? "dark" : "light");
  } catch {
    // Storage blocked (e.g. private mode): the theme still switches for this visit.
  }
}

export default function ThemeToggle() {
  return (
    <Button variant="outline" size="icon" aria-label="Switch between light and dark mode" onClick={toggleTheme}>
      {/* Both icons are rendered; the "dark" class on <html> decides which one shows. */}
      <Sun className="hidden dark:block" />
      <Moon className="dark:hidden" />
    </Button>
  );
}
