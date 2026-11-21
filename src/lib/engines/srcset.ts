/** srcset for images optimised on upload (<base>-full.webp with -w480/-w960 variants). */
export const IMAGE_WIDTHS = [480, 960] as const;
export const IMAGE_MAX_WIDTH = 2000;
export function srcSetFor(url: string): string | undefined {
  if (!/-full\.webp$/.test(url)) return undefined;
  return [
    ...IMAGE_WIDTHS.map((w) => `${url.replace(/-full\.webp$/, `-w${w}.webp`)} ${w}w`),
    `${url} ${IMAGE_MAX_WIDTH}w`,
  ].join(", ");
}
