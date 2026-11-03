import React, {
  createContext,
  useState,
  useContext,
  useEffect,
  ReactNode,
} from "react";
import { API_BASE, setAuthToken } from "../config/api";

// Tipos para o usuário e suas permissões
type UserRole = "master" | "frente de caixa" | "estoque" | "administrativo";
interface User {
  id: number;
  username: string;
  role: UserRole;
}

// O que o contexto vai fornecer para a aplicação
interface AuthContextType {
  user: User | null;
  login: (username: string, pass: string) => Promise<void>;
  logout: () => void;
}

// Criando o contexto
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// O Provedor que irá envolver nossa aplicação
export const AuthProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const [user, setUser] = useState<User | null>(null);

  const login = async (username: string, pass: string) => {
    const response = await fetch(`${API_BASE}/web/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        user: username,
        pass: pass,
        caixa_id: localStorage.getItem("caixa"),
        filial_id: localStorage.getItem("filial"),
      }),
    });
    const data = await response.json();
    if (data.payload.boleano) {
      setAuthToken(data.payload.obj.token);
      setUser({
        id: data.payload.obj.id,
        username: data.payload.obj.nome,
        role: data.payload.obj.cargo_nome,
      });
      localStorage.setItem("user_id", String(data.payload.obj.id));
      localStorage.setItem("empresa_id", String(data.payload.obj.empresa_id));
    } else {
      throw new Error("Usuário ou senha inválidos");
    }
  };

  const logout = () => {
    setAuthToken(null);
    setUser(null);
  };

  // A API respondeu 401 (token vencido): volta para o login.
  useEffect(() => {
    const onExpirada = () => logout();
    window.addEventListener("pdv:sessao-expirada", onExpirada);
    return () => window.removeEventListener("pdv:sessao-expirada", onExpirada);
  }, []);

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

// Hook customizado para facilitar o uso do contexto
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth deve ser usado dentro de um AuthProvider");
  }
  return context;
};
