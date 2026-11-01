/** Original content stays above the footer, including unusually small ID PDFs. */
export function packPageLayout(width: number, height: number) {
  const scale = Math.min(555 / width, 752 / height);
  return {
    x: (595 - width * scale) / 2,
    y: 50 + (752 - height * scale) / 2,
    width: width * scale,
    height: height * scale,
  };
}