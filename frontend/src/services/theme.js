export function getStoredTheme() {
  return localStorage.getItem('theme') === 'dark' ? 'dark' : 'light'
}

export function applyTheme(theme) {
  const isDark = theme === 'dark'
  document.documentElement.classList.toggle('dark', isDark)
  document.documentElement.style.colorScheme = isDark ? 'dark' : 'light'
  localStorage.setItem('theme', theme)
}
