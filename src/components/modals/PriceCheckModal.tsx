import React, { useState, useEffect, useRef } from "react";
import Modal from "../common/Modal";
import styles from "./PriceCheckModal.module.css";
import { Search, X } from "react-feather";
import { API_BASE, apiFetch } from "../../config/api";
import { SaleProduct } from "../../features/sales/mockSalesData";

interface PriceCheckModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const PriceCheckModal: React.FC<PriceCheckModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [barcode, setBarcode] = useState("");
  const [product, setProduct] = useState<SaleProduct | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  // Foca no input toda vez que o modal abre ou limpamos o produto
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
      setBarcode("");
      setProduct(null);
      setError("");
    }
  }, [isOpen]);

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!barcode.trim()) return;

    setLoading(true);
    setError("");
    setProduct(null);

    try {
      const empresa_id = localStorage.getItem("empresa_id");
      // Usa a mesma rota de busca (que suporta código de barras ou nome)
      // Se for código de barras exato, deve retornar 1 item geralmente
      const res = await apiFetch(
        `${API_BASE}/api/search?q=${encodeURIComponent(barcode)}&e=${empresa_id}`
      );
      const data = await res.json();
      const products = (data?.payload?.obj ?? []) as SaleProduct[];

      // Tenta encontrar match exato pelo SKU/Código de Barras primeiro
      const exactMatch = products.find(
        (p) => p.sku === barcode || p.sku === barcode.trim()
      );

      if (exactMatch) {
        setProduct(exactMatch);
      } else if (products.length > 0) {
        // Se não achou exato, pega o primeiro (caso tenha digitado nome)
        setProduct(products[0]);
      } else {
        setError("Produto não encontrado.");
      }
    } catch (err) {
      console.error("Erro ao buscar produto:", err);
      setError("Erro ao buscar informações do produto.");
    } finally {
      setLoading(false);
      // Mantém o foco no input para próxima leitura se quiser
      inputRef.current?.focus();
      // Limpa input para próxima leitura automática (opcional, aqui mantemos para conferência)
      setBarcode("");
    }
  };

  const handleClose = () => {
    setBarcode("");
    setProduct(null);
    setError("");
    onClose();
  };

  const formatCurrency = (val: number) => {
    return val.toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    });
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Consulta de Preço"
      maxWidth="600px"
    >
      <div className={styles.modalContent}>
        <form onSubmit={handleSearch} className={styles.inputContainer}>
          <label className={styles.inputLabel}>
            Bipe ou digite o código do produto
          </label>
          <div className={styles.inputWrapper}>
            <input
              ref={inputRef}
              type="text"
              className={styles.barcodeInput}
              value={barcode}
              onChange={(e) => setBarcode(e.target.value)}
              placeholder="Código de barras..."
              disabled={loading}
              autoFocus
            />
            <button
              type="submit"
              className={styles.searchButton}
              disabled={loading}
            >
              <Search size={20} />
            </button>
          </div>
        </form>

        {loading && <p>Buscando...</p>}

        {error && (
          <div className={styles.notFoundContainer}>
            <X size={48} style={{ marginBottom: 8 }} />
            <div>{error}</div>
          </div>
        )}

        {product && (
          <div className={styles.resultContainer}>
            <div className={styles.productName}>{product.name}</div>
            <div className={styles.productPrice}>
              {formatCurrency(product.price)}
            </div>
            <div className={styles.productDetail}>Código: {product.sku}</div>
            <div className={styles.productDetail}>
              Unidade: {product.type === "PESO" ? "KG" : "UN"}
            </div>
          </div>
        )}

        <div className={styles.footer}>
          <button
            onClick={() => {
              setProduct(null);
              setBarcode("");
              setError("");
              inputRef.current?.focus();
            }}
            className={styles.clearButton}
            type="button"
          >
            Limpar
          </button>
          <button onClick={handleClose} className={styles.closeButton}>
            Fechar (ESC)
          </button>
        </div>
      </div>
    </Modal>
  );
};

export default PriceCheckModal;
