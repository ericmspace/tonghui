import { createContext, useContext, useEffect, useState } from "react";

export type Role = "admin" | "teacher";

type RoleCtx = {
  role: Role;
  setRole: (r: Role) => void;
  isAdmin: boolean;
  isTeacher: boolean;
};

const Ctx = createContext<RoleCtx | null>(null);
const STORAGE_KEY = "th_role";

export function RoleProvider({ children }: { children: React.ReactNode }) {
  const [role, setRoleState] = useState<Role>("teacher");

  // 客户端恢复上次选择
  useEffect(() => {
    const saved = typeof window !== "undefined" ? window.localStorage.getItem(STORAGE_KEY) : null;
    if (saved === "admin" || saved === "teacher") setRoleState(saved);
  }, []);

  const setRole = (r: Role) => {
    setRoleState(r);
    if (typeof window !== "undefined") window.localStorage.setItem(STORAGE_KEY, r);
  };

  return (
    <Ctx.Provider value={{ role, setRole, isAdmin: role === "admin", isTeacher: role === "teacher" }}>
      {children}
    </Ctx.Provider>
  );
}

export function useRole(): RoleCtx {
  const v = useContext(Ctx);
  if (!v) throw new Error("useRole 必须在 RoleProvider 内使用");
  return v;
}
