import { createContext, useContext, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchWaCrmBootstrap } from "@/wa-crm/api/waCrmClient";

export type WaCrmBootstrap = Awaited<ReturnType<typeof fetchWaCrmBootstrap>>;

const WaCrmContext = createContext<{
  data: WaCrmBootstrap | undefined;
  loading: boolean;
  error: Error | null;
  refetch: () => void;
} | null>(null);

export function WaCrmProvider({ children }: { children: ReactNode }) {
  const q = useQuery({
    queryKey: ["wa-crm-bootstrap"],
    queryFn: fetchWaCrmBootstrap,
    staleTime: 30_000,
  });

  return (
    <WaCrmContext.Provider
      value={{
        data: q.data,
        loading: q.isLoading,
        error: q.error as Error | null,
        refetch: () => void q.refetch(),
      }}
    >
      {children}
    </WaCrmContext.Provider>
  );
}

export function useWaCrm() {
  const ctx = useContext(WaCrmContext);
  if (!ctx) throw new Error("useWaCrm must be used within WaCrmProvider");
  return ctx;
}
