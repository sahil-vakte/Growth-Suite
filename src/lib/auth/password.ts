import bcrypt from "bcryptjs";

export const hashPassword = (plain: string) => bcrypt.hash(plain, 12);
export const verifyPassword = (plain: string, hash: string) => bcrypt.compare(plain, hash);

export function passwordProblems(p: string): string | null {
  if (p.length < 10) return "Password must be at least 10 characters.";
  if (!/[a-z]/i.test(p) || !/\d/.test(p)) return "Password must contain letters and numbers.";
  return null;
}
