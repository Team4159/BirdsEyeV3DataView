export function applyDarkMode(enabled: boolean) {
  if (enabled) {
    document.body.classList.remove("light");
  } else {
    document.body.classList.add("light");
  }
}
