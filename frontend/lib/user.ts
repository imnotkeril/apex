/** Single source of truth for how the current user is displayed across the app. */

export interface DisplayUser {
  full_name?: string | null
  role?: string | null
}

export function userDisplay(me?: DisplayUser | null) {
  const name = me?.full_name?.trim() || "Yoshida"
  const initials =
    name
      .split(/\s+/)
      .map((w) => w[0] ?? "")
      .join("")
      .slice(0, 2)
      .toUpperCase() || "YO"
  const role = (me?.role || "org_admin")
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1).toLowerCase())
    .join(" ")
  return { name, initials, role }
}
