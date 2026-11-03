import React, { useState } from "react";
import Modal from "../common/Modal";
import styles from "./BoxModals.module.css";
import { boxService } from "../../services/boxService";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";

interface BoxOpeningModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

const BoxOpeningModal: React.FC<BoxOpeningModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [amount, setAmount] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const formatCurrency = (value: string) => {
    const onlyDigits = value.replace(/\D/g, "");
    if (!onlyDigits) return "";
    const numberValue = parseInt(onlyDigits, 10) / 100;
    return numberValue.toLocaleString("pt-BR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setAmount(formatCurrency(e.target.value) || "");
  };

  const cleanCurrency = (value: string) => {
    if (!value) return 0;
    return parseFloat(value.replace(/\./g, "").replace(",", "."));
  };

  const handleConfirm = async () => {
    if (!amount) {
      toast.error("Informe o valor de abertura.");
      return;
    }

    if (!user) {
      toast.error("Usuário não identificado.");
      return;
    }

    const valorAbertura = cleanCurrency(amount);

    // Recupera dados do localStorage como fallback/contexto
    // Idealmente viriam do contexto, mas vamos garantir daqui
    const empresaId = localStorage.getItem("empresa_id");
    const filialId =
      localStorage.getItem("filial") || localStorage.getItem("filial_id");
    const caixaId = localStorage.getItem("caixa");

    if (!empresaId || !caixaId) {
      toast.error("Erro de configuração de caixa/empresa.");
      return;
    }

    try {
      setIsLoading(true);
      const res = await boxService.openBox({
        usuario_id: user.id,
        caixa_id: parseInt(caixaId),
        filial_id: filialId ? parseInt(filialId) : 1, // Default 1 se não achar
        empresa_id: parseInt(empresaId),
        valor_abertura: valorAbertura,
      });

      if (res.error) {
        toast.error(res.message || "Erro ao abrir caixa.");
      } else {
        toast.success("Caixa aberto com sucesso!");
        setAmount("");
        if (onSuccess) onSuccess();
        onClose();
      }
    } catch (error) {
      console.error(error);
      toast.error("Erro de comunicação ao abrir caixa.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Abertura de Caixa"
      maxWidth={400}
    >
      <div className={styles.container}>
        <div className={styles.inputGroup}>
          <label className={styles.label}>Valor em Espécie (R$)</label>
          <input
            type="text"
            className={styles.input}
            value={amount}
            onChange={handleInputChange}
            placeholder="0,00"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter") handleConfirm();
            }}
          />
        </div>

        <div className={styles.actions}>
          <button className={styles.cancelButton} onClick={onClose}>
            Cancelar
          </button>
          <button
            className={styles.confirmButton}
            onClick={handleConfirm}
            disabled={isLoading}
          >
            {isLoading ? "Abrindo..." : "Confirmar Abertura"}
          </button>
        </div>
      </div>
    </Modal>
  );
};

export default BoxOpeningModal;
