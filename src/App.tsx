import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import AuthGuard from "@/components/AuthGuard";
import Index from "./pages/Index.tsx";
import Auth from "./pages/Auth.tsx";
import PendingApproval from "./pages/PendingApproval.tsx";
import AdminUsers from "./pages/AdminUsers.tsx";
import AdminPrompts from "./pages/AdminPrompts.tsx";
import NotFound from "./pages/NotFound.tsx";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/auth" element={<Auth />} />
            <Route path="/pending-approval" element={<PendingApproval />} />
            <Route
              path="/"
              element={
                <AuthGuard>
                  <Index />
                </AuthGuard>
              }
            />
            <Route
              path="/admin/users"
              element={
                <AuthGuard>
                  <AdminUsers />
                </AuthGuard>
              }
            />
            <Route
              path="/admin/prompts"
              element={
                <AuthGuard>
                  <AdminPrompts />
                </AuthGuard>
              }
            />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
