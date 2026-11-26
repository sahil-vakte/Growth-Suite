/** Select only from server-authorised sites; database row order must not change the workspace. */
export function chooseCurrentSite(
  sites: readonly { id: string; domain: string }[],
  wanted: string | undefined,
  defaultDomain: string,
): string | undefined {
  return (
    sites.find((site) => site.id === wanted)?.id ??
    sites.find((site) => site.domain === defaultDomain)?.id ??
    [...sites].sort((a, b) => a.id.localeCompare(b.id))[0]?.id
  );
}
