import React, { useState, useEffect } from "react";
import Modal from "../common/Modal";
import styles from "./BoxModals.module.css";
import { boxService, ClosingValuesResponse } from "../../services/boxService";
import { useToast } from "../../context/ToastContext";
import { Lock, Unlock } from "react-feather";

interface BoxClosingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

const BoxClosingModal: React.FC<BoxClosingModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { toast } = useToast();

  const [closingData, setClosingData] = useState<ClosingValuesResponse | null>(
    null
  );
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  // Estado do input de conferência
  const [finalCountInput, setFinalCountInput] = useState("");
  const [isLocked, setIsLocked] = useState(true);

  const fetchValues = async () => {
    const empresaId = localStorage.getItem("empresa_id");
    const filialId =
      localStorage.getItem("filial") || localStorage.getItem("filial_id");
    const caixaId = localStorage.getItem("caixa");

    if (!empresaId || !caixaId) return;

    setIsLoadingData(true);
    try {
      const res = await boxService.getClosingValues(
        parseInt(caixaId),
        filialId ? parseInt(filialId) : 1,
        parseInt(empresaId)
      );
      console.log(res);
      if (res.payload && res.payload.obj) {
        setClosingData(res.payload.obj);
        // Inicializa o input com o valor calculado (esperado em espécie)
        // O typo 'valor_especie' refere-se ao que deveria ter na gaveta
        const valorCalculado = res.payload.obj.valor_especie;
        setFinalCountInput(
          valorCalculado.toLocaleString("pt-BR", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })
        );
      }
    } catch (error) {
      console.error(error);
      toast.error("Erro ao carregar valores de fechamento.");
    } finally {
      setIsLoadingData(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchValues();
      setIsLocked(true); // Sempre começa bloqueado
    }
  }, [isOpen]);

  const formatCurrency = (value: string) => {
    const onlyDigits = value.replace(/\D/g, "");
    if (!onlyDigits) return "";
    const numberValue = parseInt(onlyDigits, 10) / 100;
    return numberValue.toLocaleString("pt-BR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  const cleanCurrency = (value: string) => {
    if (!value) return 0;
    return parseFloat(value.replace(/\./g, "").replace(",", "."));
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFinalCountInput(formatCurrency(e.target.value) || "");
  };

  const handleConfirm = async () => {
    if (!closingData) return;

    const valorContado = cleanCurrency(finalCountInput);
    const valorCalculado = closingData.valor_especie;

    // Validação: "sempre para mais e não para menos"
    if (valorContado < valorCalculado) {
      toast.error(
        "O valor de fechamento não pode ser menor que o calculado pelo sistema."
      );
      return;
    }

    const empresaId = localStorage.getItem("empresa_id");
    const filialId =
      localStorage.getItem("filial") || localStorage.getItem("filial_id");
    const caixaId = localStorage.getItem("caixa");

    if (!empresaId || !caixaId) return;

    try {
      setIsProcessing(true);
      const res = await boxService.closeBox({
        caixa_id: parseInt(caixaId),
        filial_id: filialId ? parseInt(filialId) : 1,
        empresa_id: parseInt(empresaId),
      });

      if (res.error) {
        toast.error(res.message || "Erro ao fechar caixa.");
      } else {
        toast.success("Caixa fechado com sucesso!");
        if (onSuccess) onSuccess();
        onClose();
      }
    } catch (error) {
      console.error(error);
      toast.error("Erro ao refalizar fechamento.");
    } finally {
      setIsProcessing(false);
    }
  };

  const confirmButtonRef = React.useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (isOpen && !isLoadingData && closingData) {
      // Pequeno timeout para garantir renderização
      setTimeout(() => {
        confirmButtonRef.current?.focus();
      }, 100);
    }
  }, [isOpen, isLoadingData, closingData]);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Fechamento de Caixa"
      maxWidth={500}
    >
      <div className={styles.container}>
        {isLoadingData ? (
          <div>Carregando valores...</div>
        ) : closingData ? (
          <>
            <div className={styles.closingInfo}>
              <div className={styles.infoRow}>
                <span>Abertura:</span>
                <span>
                  {closingData.valor_abertua?.toLocaleString("pt-BR", {
                    style: "currency",
                    currency: "BRL",
                  })}
                </span>
              </div>
              <div className={styles.infoRow}>
                <span>Total em Vendas:</span>
                <span>
                  {/* O endpoint retorna 'valor_total' e 'valor_especie', assumindo que estes são os acumulados */}
                  Apurado pelo sistema
                </span>
              </div>
              <div className={styles.infoTotal}>
                <span>Saldo em Espécie Calculado:</span>
                <span style={{ color: "green" }}>
                  {closingData.valor_especie?.toLocaleString("pt-BR", {
                    style: "currency",
                    currency: "BRL",
                  })}
                </span>
              </div>
            </div>

            <div className={styles.warningText}>
              Confira o valor em espécie na gaveta. Se necessário, edite o valor
              abaixo (permitido apenas ajuste para cima).
            </div>

            <div className={styles.inputGroup}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <label className={styles.label}>Contagem Final (Espécie)</label>
                <button
                  type="button"
                  onClick={() => setIsLocked(!isLocked)}
                  style={{
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    color: "#666",
                  }}
                  title={isLocked ? "Desbloquear edição" : "Bloquear edição"}
                >
                  {isLocked ? <Lock size={16} /> : <Unlock size={16} />}
                </button>
              </div>

              <div style={{ position: "relative" }}>
                <input
                  type="text"
                  className={styles.input}
                  value={finalCountInput}
                  onChange={handleInputChange}
                  disabled={isLocked}
                  style={{ backgroundColor: isLocked ? "#e9ecef" : "white" }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleConfirm();
                  }}
                />
              </div>
            </div>

            <div className={styles.actions}>
              <button className={styles.cancelButton} onClick={onClose}>
                Cancelar
              </button>
              <button
                ref={confirmButtonRef}
                className={styles.confirmButton}
                onClick={handleConfirm}
                disabled={isProcessing}
              >
                {isProcessing ? "Fechando..." : "Confirmar Fechamento"}
              </button>
            </div>
          </>
        ) : (
          <div>Erro ao carregar dados. Tente novamente.</div>
        )}
      </div>
    </Modal>
  );
};

export default BoxClosingModal;
