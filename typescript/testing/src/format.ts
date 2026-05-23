export type UserCard = {
  name: string;
  role: string;
  active: boolean;
};

export function formatUserCard(user: UserCard): string {
  const status = user.active ? "active" : "inactive";

  return [`Name: ${user.name}`, `Role: ${user.role}`, `Status: ${status}`].join(
    "\n",
  );
}
