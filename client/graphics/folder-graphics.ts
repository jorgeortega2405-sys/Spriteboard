export const FOLDER_BACK_TAB_SVG = `
  <svg class="folder-card__back-svg" viewBox="0 0 300 50" preserveAspectRatio="none" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M0 10C0 4.5 4.5 0 10 0H105C110 0 115 2 118 6L124 14C127 18 132 20 137 20H290C295.5 20 300 24.5 300 30V50H0Z" fill="currentColor" />
  </svg>
`;

export function getFolderFrontIconSvg(folderName: string): string {
  if (folderName === 'Mis proyectos') {
    return `
      <svg class="folder-card__cloud-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
      </svg>
    `;
  }

  return `
    <svg class="folder-card__cloud-icon" viewBox="0 0 32 26" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M8 21C5.2 21 3 18.8 3 16C3 13.4 4.9 11.3 7.5 11C8.5 7 12 4 16 4C20.2 4 23.6 7.2 24 11.3C26.3 12 28 14 28 16.5C28 19 26 21 23.5 21H8Z" />
      <path d="M16 17V10M12.5 13.5L16 10L19.5 13.5" />
    </svg>
  `;
}
