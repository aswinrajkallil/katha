import { createContext, useContext, useRef, useCallback } from "react";

const NavigationGuardContext = createContext(null);

export function NavigationGuardProvider({ children }) {
  const guardRef = useRef(null);

  const registerGuard = useCallback((guardHandler) => {
    guardRef.current = guardHandler;
    return () => {
      if (guardRef.current === guardHandler) {
        guardRef.current = null;
      }
    };
  }, []);

  const triggerGuard = useCallback(() => {
    if (typeof guardRef.current === "function") {
      return guardRef.current();
    }
    return false;
  }, []);

  return (
    <NavigationGuardContext.Provider value={{ registerGuard, triggerGuard }}>
      {children}
    </NavigationGuardContext.Provider>
  );
}

export function useNavigationGuard() {
  const ctx = useContext(NavigationGuardContext);
  if (!ctx) {
    return {
      registerGuard: () => () => {},
      triggerGuard: () => false,
    };
  }
  return ctx;
}
