import { useRole } from "~/lib/role";
import { Segmented } from "~/components/ui/primitives";

export function RoleSwitcher() {
  const { role, setRole } = useRole();
  return (
    <Segmented
      value={role}
      onChange={setRole}
      options={[
        { value: "teacher", label: "👩‍🏫 教师" },
        { value: "admin", label: "🛡️ 管理员" },
      ]}
    />
  );
}
