import { AppRouter } from "./routes";
import { AuthProvider } from "./context/AuthContext";

import { ToastProvider } from "./context/ToastContext";

import { BoxProvider } from "./context/BoxContext";

function App() {
  return (
    <AuthProvider>
      <BoxProvider>
        <ToastProvider>
          <AppRouter />
        </ToastProvider>
      </BoxProvider>
    </AuthProvider>
  );
}

export default App;
