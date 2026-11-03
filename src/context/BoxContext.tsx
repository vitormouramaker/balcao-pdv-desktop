import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";
import { boxService } from "../services/boxService";
import { useAuth } from "./AuthContext";

interface BoxContextType {
  isBoxOpen: boolean;
  isLoadingBoxStatus: boolean;
  updateBoxStatus: () => Promise<void>;
}

const BoxContext = createContext<BoxContextType | undefined>(undefined);

export const BoxProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const { user } = useAuth();
  const [isBoxOpen, setIsBoxOpen] = useState(false);
  const [isLoadingBoxStatus, setIsLoadingBoxStatus] = useState(false);

  const updateBoxStatus = async () => {
    if (!user) return;

    const empresaId = localStorage.getItem("empresa_id");
    const filialId =
      localStorage.getItem("filial") || localStorage.getItem("filial_id");
    const caixaId = localStorage.getItem("caixa");

    if (!empresaId || !caixaId) {
      // Se falta configuração, assume fechado ou trata erro
      setIsBoxOpen(false);
      return;
    }

    try {
      setIsLoadingBoxStatus(true);
      const res = await boxService.checkBoxStatus({
        usuario_id: user.id,
        caixa_id: parseInt(caixaId),
        filial_id: filialId ? parseInt(filialId) : 1,
        empresa_id: parseInt(empresaId),
      });

      if (res.payload && res.payload.obj) {
        setIsBoxOpen(res.payload.obj.is_open);
      }
    } catch (error) {
      console.error("Erro ao verificar status do caixa:", error);
    } finally {
      setIsLoadingBoxStatus(false);
    }
  };

  // Verifica status sempre que o usuário logar ou mudar (e na montagem inicial se já logado)
  useEffect(() => {
    if (user) {
      updateBoxStatus();
    }
  }, [user]);

  return (
    <BoxContext.Provider
      value={{ isBoxOpen, isLoadingBoxStatus, updateBoxStatus }}
    >
      {children}
    </BoxContext.Provider>
  );
};

export const useBox = () => {
  const context = useContext(BoxContext);
  if (context === undefined) {
    throw new Error("useBox deve ser usado dentro de um BoxProvider");
  }
  return context;
};
