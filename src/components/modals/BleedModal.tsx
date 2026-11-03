import React, { useState } from "react";
import Modal from "../common/Modal";
import styles from "./BoxModals.module.css";
import { boxService } from "../../services/boxService";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";

interface BleedModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

const REASONS = [
  "Enviar para outro caixa (Troco)",
  "Pagamento de Fornecedor",
  "Compra de Material/Insumo",
  "Sangria de Segurança",
  "Outros",
];

const BleedModal: React.FC<BleedModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { user } = useAuth();
  const { toast } = useToast();

  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState(REASONS[0]);
  const [observation, setObservation] = useState("");
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
    const valorSangria = cleanCurrency(amount);
    if (!valorSangria || valorSangria <= 0) {
      toast.error("Informe um valor válido.");
      return;
    }

    if (!observation.trim()) {
      toast.error("Informe uma observação/justificativa.");
      return;
    }

    if (!user) return;

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
      const res = await boxService.bleedBox({
        usuario_id: user.id,
        caixa_id: parseInt(caixaId),
        filial_id: filialId ? parseInt(filialId) : 1,
        empresa_id: parseInt(empresaId),
        valor_ruptura: valorSangria,
        motivo: `${reason} - ${observation}`,
      });

      if (res.error) {
        toast.error(res.message || "Erro ao realizar sangria.");
      } else {
        toast.success("Sangria realizada com sucesso!");
        // Reset form
        setAmount("");
        setObservation("");
        setReason(REASONS[0]);
        if (onSuccess) onSuccess();
        onClose();
      }
    } catch (error) {
      console.error(error);
      toast.error("Erro de comunicação.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Sangria de Caixa"
      maxWidth={500}
    >
      <div className={styles.container}>
        <div className={styles.inputGroup}>
          <label className={styles.label}>Valor da Retirada (R$)</label>
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

        <div className={styles.inputGroup}>
          <label className={styles.label}>Motivo</label>
          <select
            className={styles.select}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          >
            {REASONS.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </div>

        <div className={styles.inputGroup}>
          <label className={styles.label}>Observação / Detalhes</label>
          <textarea
            className={`${styles.input} ${styles.textarea}`}
            value={observation}
            onChange={(e) => setObservation(e.target.value)}
            placeholder="Descreva o motivo da retirada..."
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleConfirm();
              }
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
            {isLoading ? "Processando..." : "Confirmar Retirada"}
          </button>
        </div>
      </div>
    </Modal>
  );
};

export default BleedModal;
