import {
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";

import { useState } from "react";
import type { ReactNode } from "react";
import { AuthProvider } from "../contexts/AuthContext";
import { OrgProvider } from "../contexts/OrgContext";

interface ProvidersProps {
  children: ReactNode;
}

export function Providers({ children }: ProvidersProps) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            retry: 1,
            refetchOnWindowFocus: false,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <OrgProvider>{children}</OrgProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}