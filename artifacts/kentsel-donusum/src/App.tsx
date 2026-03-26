import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Home from "@/pages/Home";
import Uzmanlar from "@/pages/Uzmanlar";
import KullanimKosullari from "@/pages/KullanimKosullari";
import Kvkk from "@/pages/Kvkk";
import WelcomeModal, { useWelcomeModal } from "@/components/WelcomeModal";

const queryClient = new QueryClient();

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/uzmanlar" component={Uzmanlar} />
      <Route path="/kullanim-kosullari" component={KullanimKosullari} />
      <Route path="/kvkk" component={Kvkk} />
      <Route component={NotFound} />
    </Switch>
  );
}

function AppShell() {
  const { showModal, hasAccepted, accept, openInfo, closeInfo } = useWelcomeModal();

  return (
    <>
      <Router />

      {/* Welcome / info modal */}
      {showModal && (
        <WelcomeModal
          isFirstVisit={!hasAccepted}
          onAccept={accept}
          onClose={closeInfo}
        />
      )}

      {/* Floating "?" help button — visible after acceptance */}
      {hasAccepted && !showModal && (
        <button
          onClick={openInfo}
          aria-label="Kullanım bilgisi"
          className="fixed bottom-6 right-6 z-50 w-10 h-10 rounded-full bg-[#1B2E4B] border-2 border-[#C9A84C] text-[#C9A84C] font-bold text-sm shadow-[0_4px_16px_rgba(27,46,75,0.3)] hover:bg-[#243d63] hover:scale-110 transition-all duration-200 flex items-center justify-center"
        >
          ?
        </button>
      )}
    </>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <AppShell />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
