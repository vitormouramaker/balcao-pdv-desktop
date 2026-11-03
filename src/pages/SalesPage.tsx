// INTEREST_RATES removido pois parcelas agora são sem juros

import React, { useState, useEffect, useRef } from "react";
import styles from "./SalesPage.module.css";
import { SaleProduct } from "../features/sales/mockSalesData";
import { XCircle, Lock } from "react-feather";
import Modal from "../components/common/Modal";
import { API_BASE, apiFetch } from "../config/api";
import { useBox } from "../context/BoxContext";

import { useToast } from "../context/ToastContext";

// Define a interface para um item dentro do carrinho
interface CartItem extends SaleProduct {
  cartLineId: string;
  quantity: number;
  totalPrice: number;
}

interface PaymentEntry {
  id: string;
  method: "qr" | "credito" | "debito" | "especie";
  amount: number;
  installments?: number;
  changeGenerated?: number;
}

// Helper para formatação de moeda PT-BR
const formatCurrency = (value: number) => {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
};

const SalesPage: React.FC = () => {
  const { toast } = useToast();
  const { isBoxOpen } = useBox();

  // --- ESTADOS DO COMPONENTE ---
  const [cart, setCart] = useState<CartItem[]>([]);
  const [scanInput, setScanInput] = useState("");
  const [_, setScanError] = useState("");
  const [quantityMultiplier, setQuantityMultiplier] = useState(1);

  // Estados para modais
  const [isRemoveItemModalOpen, setIsRemoveItemModalOpen] = useState(false);
  const [itemToRemove, setItemToRemove] = useState<CartItem | null>(null);
  const [quantityToRemove, setQuantityToRemove] = useState<number>(1);

  const [paymentStatus, setPaymentStatus] = useState<
    | "idle"
    | "pending"
    | "processed"
    | "canceled"
    | "suspicious"
    | "waiting_next"
  >("idle");
  const [transactionId, setTransactionId] = useState<string | null>(null);
  const [, setVendaId] = useState<Number | null>(null);
  const [paymentError, setPaymentError] = useState("");

  const [isCancelSaleModalOpen, setIsCancelSaleModalOpen] = useState(false);
  const [isLastSaleExpanded, setIsLastSaleExpanded] = useState(false);

  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<
    "qr" | "credito" | "debito" | "especie" | null
  >(null);
  const [installments, setInstallments] = useState(1);

  const [changeAmount, setChangeAmount] = useState(0);

  // --- NOVOS ESTADOS PARA PAGAMENTOS MÚLTIPLOS ---
  const [payments, setPayments] = useState<PaymentEntry[]>([]);
  const [currentPaymentAmount, setCurrentPaymentAmount] = useState(""); // Valor sendo digitado para o pagamento atual
  const [amountReceived, setAmountReceived] = useState(""); // Novo estado para Valor Recebido

  // --- ESTADO DE HISTÓRICO ---
  const [lastSale, setLastSale] = useState<{
    id: any;
    total: number;
    itemsCount: number;
    payments: PaymentEntry[];
    change: number;
    products: CartItem[]; // Guardamos os produtos para reimpressão
  } | null>(null);

  const [, setIsLastSaleDetailsModalOpen] = useState(false);

  // Calcula o total pago até agora
  const totalPaid = payments.reduce((acc, p) => acc + p.amount, 0);

  // Calcula o total da venda (função auxiliar movida para cá ou usada diretamente)
  const totalSale = cart.reduce((total, item) => total + item.totalPrice, 0);

  // Calcula o restante a pagar
  const remainingAmount = Math.max(0, totalSale - totalPaid);

  // Atualiza o valor sugerido quando abre o modal ou muda os pagamentos
  useEffect(() => {
    if (isPaymentModalOpen) {
      setCurrentPaymentAmount(formatCurrencyInput(remainingAmount.toFixed(2)));
    }
  }, [isPaymentModalOpen, totalPaid, totalSale]);

  // Mantemos a lista filtrada visualmente para quem digita manualmente
  const [filteredProducts, setFilteredProducts] = useState<SaleProduct[]>([]);

  const searchInputRef = useRef<HTMLInputElement>(null);

  const [isWeightModalOpen, setIsWeightModalOpen] = useState(false);
  const [productForWeight, setProductForWeight] = useState<SaleProduct | null>(
    null
  );
  const [weightInput, setWeightInput] = useState("");

  // --- EFEITOS ---

  // 1. Gerenciamento de Foco e Atalhos Globais
  useEffect(() => {
    const isAnyModalOpen =
      isRemoveItemModalOpen || isCancelSaleModalOpen || isPaymentModalOpen;

    if (isAnyModalOpen) {
      searchInputRef.current?.blur();
    } else {
      setTimeout(() => searchInputRef.current?.focus(), 50);
    }

    const handleGlobalKeyDown = (event: KeyboardEvent) => {
      const isModalCurrentlyOpen =
        isRemoveItemModalOpen || isCancelSaleModalOpen || isPaymentModalOpen;

      if (!isModalCurrentlyOpen && event.ctrlKey) {
        switch (event.key) {
          case "1":
            event.preventDefault();
            if (cart.length > 0) openPaymentModal();
            break;
          case "2":
            event.preventDefault();
            if (cart.length > 0) openCancelSaleModal();
            break;
        }
      }
    };

    document.addEventListener("keydown", handleGlobalKeyDown);
    return () => {
      document.removeEventListener("keydown", handleGlobalKeyDown);
    };
  }, [
    isRemoveItemModalOpen,
    isCancelSaleModalOpen,
    isPaymentModalOpen,
    isWeightModalOpen,
    cart.length,
  ]);

  // 2. Busca Visual (Debounce) - Apenas para feedback visual enquanto digita
  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;

    const fetchProducts = async (query: string) => {
      try {
        const empresa_id = localStorage.getItem("empresa_id");
        const url =
          query.trim() === ""
            ? `${API_BASE}/api/products?e=${empresa_id}`
            : `${API_BASE}/api/search?q=${encodeURIComponent(query)}&e=${empresa_id}`;

        const res = await apiFetch(url, { signal });
        // Se o caixa estiver fechado, bloqueia submit
        if (!isBoxOpen) {
          toast.error("O caixa está fechado. Realize a abertura para vender.");
          setScanInput("");
          return;
        }

        if (!res.ok) return;

        const data = await res.json();
        const products = data?.payload?.obj ?? [];
        setFilteredProducts(Array.isArray(products) ? products : []);
        setScanError("");
      } catch (err: any) {
        if (err.name === "AbortError") return;
        console.error("Erro ao buscar produtos:", err);
      }
    };

    const timeout = setTimeout(() => fetchProducts(scanInput), 300);

    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
  }, [scanInput]);

  // 3. Cálculo de Troco (Apenas visual para quando seleciona espécie e ainda não adicionou)
  // 3. Cálculo de Troco (Apenas visual para quando seleciona espécie e ainda não adicionou)
  useEffect(() => {
    if (paymentMethod === "especie") {
      const tendered = parseCurrencyInput(amountReceived) || 0;
      const toPay = parseCurrencyInput(currentPaymentAmount) || 0;
      // Se for o último pagamento e for espécie, pode ter troco
      // Mas na lógica de múltiplos pagamentos, o troco geralmente é calculado sobre o total pago vs total venda
      // Aqui vamos simplificar: se o valor inserido for maior que o restante, mostra troco
      const change = tendered > toPay ? tendered - toPay : 0;
      setChangeAmount(change);
    }
  }, [amountReceived, currentPaymentAmount, paymentMethod]); // Updated dependency to amountReceived (state)

  // --- LÓGICA AUXILIAR ---

  const formatWeightInput = (value: string) => {
    const onlyDigits = value.replace(/\D/g, "");
    if (!onlyDigits) return "";
    const numberValue = parseInt(onlyDigits, 10) / 1000;
    return numberValue.toLocaleString("pt-BR", {
      minimumFractionDigits: 3,
      maximumFractionDigits: 3,
    });
  };

  const parseWeightInput = (value: string): number => {
    if (!value) return 0;
    const standardValue = value.replace(/\./g, "").replace(",", ".");
    return parseFloat(standardValue);
  };

  const formatCurrencyInput = (value: string) => {
    const onlyDigits = value.replace(/\D/g, "");
    if (!onlyDigits) return "";
    const numberValue = parseInt(onlyDigits, 10) / 100;
    return numberValue.toLocaleString("pt-BR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  const parseCurrencyInput = (value: string): number => {
    if (!value) return 0;
    const standardValue = value.replace(/\./g, "").replace(",", ".");
    return parseFloat(standardValue);
  };

  const calculateInstallmentValue = (
    total: number,
    numInstallments: number
  ): number => {
    if (numInstallments === 1) return total;
    // Removido cálculo de juros conforme solicitado
    return total / numInstallments;
  };

  // Scroll Ref
  const itemListRef = useRef<HTMLDivElement>(null);

  // Auto-scroll sempre que o carrinho mudar
  useEffect(() => {
    if (itemListRef.current) {
      itemListRef.current.scrollTop = itemListRef.current.scrollHeight;
    }
  }, [cart]);

  const addToCart = (product: SaleProduct, quantity: number) => {
    // Validação de caixa aberto
    if (!isBoxOpen) {
      toast.error("O caixa está fechado. Realize a abertura para vender.");
      return;
    }

    const newCartLineId = `${product.id}-${Date.now()}`;
    const calculatedPrice = product.price * quantity;

    // LÓGICA DE UNIDADE: Agora SEMPRE cria uma nova linha, não agrupa mais.
    if (product.type === "UNIDADE") {
      setCart((currentCart) => [
        ...currentCart,
        {
          ...product,
          quantity,
          cartLineId: newCartLineId,
          totalPrice: calculatedPrice,
        },
      ]);
    } else if (product.type === "PESO") {
      setCart((currentCart) => [
        ...currentCart,
        {
          ...product,
          quantity,
          cartLineId: newCartLineId,
          totalPrice: calculatedPrice,
        },
      ]);
    }
  };

  // --- MODAIS E AÇÕES ---

  const openRemoveItemModal = (item: CartItem) => {
    setItemToRemove(item);
    setQuantityToRemove(item.type === "PESO" ? item.quantity : 1);
    setIsRemoveItemModalOpen(true);
  };

  const closeRemoveItemModal = () => {
    setIsRemoveItemModalOpen(false);
    setItemToRemove(null);
    setQuantityToRemove(1);
  };

  const confirmRemoveItem = () => {
    if (!itemToRemove) return;

    if (itemToRemove.type === "PESO") {
      setCart((currentCart) =>
        currentCart.filter(
          (item) => item.cartLineId !== itemToRemove.cartLineId
        )
      );
      toast.info("Item removido do carrinho.");
      closeRemoveItemModal();
      return;
    }

    if (quantityToRemove > 0) {
      setCart((currentCart) => {
        const currentItem = currentCart.find(
          (item) => item.cartLineId === itemToRemove.cartLineId
        );
        if (!currentItem) return currentCart;

        if (quantityToRemove >= currentItem.quantity) {
          return currentCart.filter(
            (item) => item.cartLineId !== itemToRemove.cartLineId
          );
        } else {
          const newQuantity = currentItem.quantity - quantityToRemove;
          return currentCart.map((item) =>
            item.cartLineId === itemToRemove.cartLineId
              ? {
                  ...item,
                  quantity: newQuantity,
                  totalPrice: newQuantity * item.price,
                }
              : item
          );
        }
      });
    }
    closeRemoveItemModal();
  };

  const openCancelSaleModal = () => {
    if (cart.length > 0) setIsCancelSaleModalOpen(true);
  };

  const confirmCancelSale = () => {
    setCart([]);
    setScanInput("");
    setQuantityMultiplier(1);
    setIsCancelSaleModalOpen(false);
    searchInputRef.current?.focus();
  };

  const openPaymentModal = () => {
    if (cart.length > 0) setIsPaymentModalOpen(true);
  };

  const closePaymentModal = () => {
    setIsPaymentModalOpen(false);
    setPaymentMethod(null);

    setInstallments(1);
    setPayments([]); // Limpa pagamentos ao fechar
    setChangeAmount(0); // Reseta troco visual
    setAmountReceived(""); // Reseta valor recebido
  };

  const addPayment = () => {
    if (!paymentMethod) return;
    const amount = parseCurrencyInput(currentPaymentAmount);
    if (amount <= 0) {
      toast.error("Valor inválido");
      return;
    }

    if (amount > remainingAmount + 0.01 && paymentMethod !== "especie") {
      toast.error(
        "Valor maior que o restante (permitido apenas em espécie para troco)."
      );
      return;
    }

    const newPayment: PaymentEntry = {
      id: Date.now().toString(),
      method: paymentMethod,
      amount: amount,
      installments: paymentMethod === "credito" ? installments : 1,
    };

    setPayments([...payments, newPayment]);
    setPaymentMethod(null); // Reseta seleção para permitir adicionar outro
    setInstallments(1);
    setCurrentPaymentAmount("");
    setAmountReceived("");
  };

  const removePayment = (
    id: string,
    paymentMethodUsed: string,
    changeGenerated: number = 0
  ) => {
    setPayments(payments.filter((p) => p.id !== id));
    if (paymentMethodUsed === "especie" && changeGenerated > 0) {
      setChangeAmount((prev) => Math.max(0, prev - changeGenerated));
    }
  };

  const handleConfirmPayment = async () => {
    const total = calculateTotal();
    setPaymentStatus("pending");
    setIsPaymentModalOpen(false); // <--- FECHA O MODAL DE SELEÇÃO
    setPaymentError("");

    try {
      const userId = localStorage.getItem("user_id");
      const empresa_id = localStorage.getItem("empresa_id");
      const caixa = localStorage.getItem("caixa");
      const filial_id = localStorage.getItem("filial");

      // Filtra pagamentos
      const cashPayments = payments.filter((p) => p.method === "especie");
      const electronicPayments = payments.filter((p) => p.method !== "especie");

      // Define quais pagamentos enviar no gerar_venda
      // Envia SOMENTE pagamentos em espécie
      const initialPayments = [...cashPayments];
      // O primeiro eletrônico NÃO entra aqui mais, será iniciado separadamente

      // Calcula o valor sendo pago AGORA (inicialmente)
      const initialAmountTendered = initialPayments.reduce(
        (acc, p) => acc + p.amount,
        0
      );

      // 1. Inicia a venda enviando APENAS os pagamentos iniciais (espécie)
      const res = await apiFetch(`${API_BASE}/api/gerar_venda`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          total,
          caixa: caixa,
          products: cart.map((item) => ({
            id: item.id,
            sku: item.sku,
            name: item.name,
            quantity: item.quantity,
            unit_price: item.price,
            line_total: item.totalPrice,
            type: item.type,
          })),
          payments: initialPayments, // <--- MUDANÇA: Só envia espécie
          user_id: userId,
          amount_tendered: initialAmountTendered,
          change_amount: changeAmount,
          filial_id,
          empresa_id,
        }),
      });

      const data = await res.json();
      if (data.error) throw new Error(data.message || "Erro ao gerar venda");

      const receivedVendaId = data.payload?.obj?.venda_id;
      if (receivedVendaId) setVendaId(receivedVendaId);

      // Se houver pagamentos eletrônicos, inicia o primeiro agora
      if (electronicPayments.length > 0) {
        // Inicia o primeiro pagamento eletrônico (índice 0)
        // Passamos null como previousTransactionId pois é o primeiro
        processarProximoPagamentoInterno(
          receivedVendaId,
          electronicPayments,
          0,
          "", // previousTransactionId vazio
          0 // gracePeriod
        );
      } else {
        // Se não tem eletrônico (só espécie), conclui
        setPaymentStatus("processed");

        // --- AUTOMATIC SUCCESS (NO MODAL) ---
        handleSuccessfulSale(
          receivedVendaId,
          total,
          cart.length, // total items count (simplificado)
          initialPayments,
          changeAmount,
          cart
        );
      }
    } catch (err: any) {
      console.error("Erro ao iniciar pagamento:", err);
      setPaymentStatus("canceled");
      setPaymentError("Erro ao processar venda.");
      toast.error("Erro ao processar venda.");
    }
  };

  const handleSuccessfulSale = (
    vendaId: any,
    total: number,
    itemsCount: number,
    payments: PaymentEntry[],
    change: number,
    products: CartItem[]
  ) => {
    // 1. Atualiza Última Venda
    setLastSale({
      id: vendaId,
      total,
      itemsCount,
      payments,
      change,
      products,
    });

    // 2. Reseta a Tela sem mostrar modal de sucesso
    toast.success("Venda realizada com sucesso!");
    startNewSale();
  };

  const handlePaymentSuccess = (
    vendaId: any,
    electronicPayments: PaymentEntry[],
    currentIndex: number,
    currentTransactionId: string
  ) => {
    console.log(`[MONITOR] Pagamento ${currentIndex + 1} PROCESSADO.`);

    const nextIndex = currentIndex + 1;
    if (nextIndex < electronicPayments.length) {
      console.log(
        `[MONITOR] Pagamento ${
          currentIndex + 1
        } concluído. Aguardando usuário iniciar o próximo.`
      );
      // PAUSA: Define status para aguardar o usuário clicar em "Próximo"
      setPaymentStatus("waiting_next");

      // Atualiza o estado atual para saber qual é o próximo quando o usuário clicar
      setCurrentSerialPayment({
        vendaId,
        electronicPayments,
        currentIndex: nextIndex, // Já aponta para o próximo
        currentTransactionId, // Mantém o ID anterior para referência/log
      });
    } else {
      console.log(`[MONITOR] Todos os pagamentos processados.`);

      // --- TODOS OS PAGAMENTOS OK ---
      // Combinar pagamentos (espécie já foi, eletrônicos foram agora)
      const total = calculateTotal();

      handleSuccessfulSale(
        vendaId,
        total,
        cart.length,
        payments, // usamos os payments do estado como referência total
        changeAmount,
        cart
      );
    }
  };

  const cancelarpagamento = async (currentTransactionId: any) => {
    try {
      await apiFetch(`${API_BASE}/api/cancelar/${currentTransactionId}`);
    } catch (err) {
      // Ignora erros de rede temporários
    }
  };

  const monitorarPagamentoSerial = (
    vendaId: any,
    electronicPayments: PaymentEntry[],
    currentIndex: number,
    currentTransactionId: string,
    gracePeriodSeconds: number = 0
  ) => {
    let tentativas = 0;
    const maxTentativas = 300; // 5 minutos
    const startTime = Date.now();

    console.log(
      `[MONITOR] Iniciando monitoramento para pagamento ${currentIndex + 1}/${
        electronicPayments.length
      }. ID: ${currentTransactionId}. Grace: ${gracePeriodSeconds}s`
    );

    const intervalo = setInterval(async () => {
      tentativas++;
      try {
        const res = await apiFetch(
          `${API_BASE}/api/valida_pagamento/${currentTransactionId}`
        );
        const data = await res.json();
        console.log(
          `[MONITOR] Check ${tentativas} - ID: ${currentTransactionId} - Status: ${data.payload?.obj?.status}`,
          data
        );
        setPaymentStatus("pending");
        const status = data.payload?.obj?.status;

        // Verifica Grace Period / Sucesso Suspeito
        if (status === "processed" && gracePeriodSeconds > 0) {
          const elapsed = (Date.now() - startTime) / 1000;
          if (elapsed < gracePeriodSeconds) {
            console.warn(
              `[MONITOR] Status 'processed' detectado MUITO RÁPIDO (${elapsed.toFixed(
                1
              )}s). Pausando para confirmação manual.`
            );
            clearInterval(intervalo);

            // Armazena estado para retomada
            setCurrentSerialPayment({
              vendaId,
              electronicPayments,
              currentIndex,
              currentTransactionId,
            });
            return;
          }
        }

        // SE O STATUS MUDAR PARA PROCESSED
        if (status === "processed") {
          clearInterval(intervalo);
          handlePaymentSuccess(
            vendaId,
            electronicPayments,
            currentIndex,
            currentTransactionId
          );
          return;
        } else if (status === "canceled") {
          clearInterval(intervalo);
          setPaymentStatus("canceled");
          setPaymentError("Pagamento cancelado.");
          toast.error("Pagamento cancelado.");
          return;
        }
        if (tentativas > maxTentativas) {
          clearInterval(intervalo);
          setPaymentStatus("canceled");
          setPaymentError("Tempo limite excedido.");
          toast.error("Tempo limite excedido.");
        }
      } catch (err) {
        // Ignora erros de rede temporários
      }
    }, 2000);

    // Armazena o intervalo e dados para uso manual se necessário
    setCurrentSerialPayment({
      intervalo,
      vendaId,
      electronicPayments,
      currentIndex,
      currentTransactionId, // Guardamos o ID atual
    });
  };

  const processarProximoPagamentoInterno = async (
    vendaId: any,
    electronicPayments: PaymentEntry[],
    nextIndex: number,
    previousTransactionId: string,
    gracePeriodSeconds: number = 0
  ) => {
    setPaymentError("");
    const nextPayment = electronicPayments[nextIndex];
    console.log(
      `[NEXT] Iniciando pagamento ${nextIndex + 1}: R$ ${nextPayment.amount} (${
        nextPayment.method
      })`
    );

    try {
      const empresa_id = localStorage.getItem("empresa_id");
      const filial_id = localStorage.getItem("filial");
      const caixa = localStorage.getItem("caixa");

      const res = await apiFetch(`${API_BASE}/api/continuar_pagamento`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          venda_id: vendaId,
          amount: nextPayment.amount,
          method: nextPayment.method,
          installments: nextPayment.installments,
          empresa_id,
          filial_id,
          caixa,
        }),
      });
      const data = await res.json();
      const nextTransactionId = data.payload?.obj?.transaction_id;

      if (nextTransactionId) {
        if (nextTransactionId === previousTransactionId) {
          console.error(
            "[NEXT] ERRO CRÍTICO: ID de transação repetido pelo backend!"
          );
          setPaymentStatus("canceled");
          setPaymentError(
            "Erro: O sistema retornou o mesmo ID de transação. Tente novamente."
          );
          toast.error("Erro crítico: ID de transação duplicado.");
          return;
        }

        console.log(
          `[NEXT] Novo ID de transação recebido: ${nextTransactionId}`
        );
        setTransactionId(nextTransactionId);
        monitorarPagamentoSerial(
          vendaId,
          electronicPayments,
          nextIndex,
          nextTransactionId,
          gracePeriodSeconds
        );
      } else {
        setPaymentStatus("canceled");
        setPaymentError("Erro ao iniciar próximo pagamento.");
        toast.error("Erro ao iniciar próximo pagamento.");
      }
    } catch (err) {
      console.error(err);
      setPaymentStatus("canceled");
      setPaymentError("Erro de comunicação.");
      toast.error("Erro de comunicação.");
    }
  };

  // Estado para controlar o fluxo serial manual/automático
  const [currentSerialPayment, setCurrentSerialPayment] = useState<any>(null);

  const confirmSuspiciousPayment = () => {
    if (!currentSerialPayment) return;
    const { vendaId, electronicPayments, currentIndex, currentTransactionId } =
      currentSerialPayment;
    // O usuário confirmou que pagou, então aceitamos o sucesso
    handlePaymentSuccess(
      vendaId,
      electronicPayments,
      currentIndex,
      currentTransactionId
    );
  };

  const retrySuspiciousPayment = () => {
    if (!currentSerialPayment) return;
    const { vendaId, electronicPayments, currentIndex, currentTransactionId } =
      currentSerialPayment;

    console.log(
      "[RETRY] Tentando gerar novo pagamento para índice",
      currentIndex
    );

    setPaymentStatus("pending"); // <--- MOSTRA O MODAL DE PROCESSAMENTO

    // Tenta gerar novamente o MESMO pagamento (mesmo índice)
    // Passamos o ID atual como 'previous' para evitar duplicação se o backend checasse
    processarProximoPagamentoInterno(
      vendaId,
      electronicPayments,
      currentIndex,
      currentTransactionId,
      5
    );
  };

  const handleNextPayment = () => {
    if (!currentSerialPayment) return;
    const { vendaId, electronicPayments, currentIndex, currentTransactionId } =
      currentSerialPayment;

    console.log(`[MANUAL] Usuário iniciou pagamento ${currentIndex + 1}`);
    setPaymentStatus("pending");

    processarProximoPagamentoInterno(
      vendaId,
      electronicPayments,
      currentIndex,
      currentTransactionId,
      5
    );
  };

  const startNewSale = () => {
    setCart([]);
    setScanInput("");
    setQuantityMultiplier(1);
    setPaymentStatus("idle");
    setTransactionId(null);
    setPaymentError("");
    setChangeAmount(0);
    closePaymentModal();
    searchInputRef.current?.focus();
  };

  const openWeightModal = (product: SaleProduct) => {
    if (!isBoxOpen) {
      toast.error("O caixa está fechado. Realize a abertura para vender.");
      return;
    }
    setProductForWeight(product);
    setIsWeightModalOpen(true);
    setTimeout(() => {
      document.getElementById("weight")?.focus();
    }, 100);
  };

  const closeWeightModal = () => {
    setIsWeightModalOpen(false);
    setProductForWeight(null);
    setWeightInput("");
  };

  const confirmWeightAndAddToCart = () => {
    const weight = parseWeightInput(weightInput);
    if (productForWeight && weight > 0) {
      addToCart(productForWeight, weight);
      closeWeightModal();
      setScanInput("");
      setQuantityMultiplier(1);
      searchInputRef.current?.focus();
    } else {
      toast.error("Peso inválido.");
    }
  };

  const handleKeyDown = async (
    event: React.KeyboardEvent<HTMLInputElement>
  ) => {
    const rawValue = event.currentTarget.value;

    // Bloqueia se caixa fechado
    if (!isBoxOpen) {
      if (event.key === "Enter") {
        toast.error("O caixa está fechado.");
        setScanInput("");
      }
      // Permite digitar mas bloqueia ação ou bloqueia tudo?
      // Melhor deixar digitar mas bloquear Enter.
      // Mas se bloquear tudo fica mais claro.
      // Vamos bloquear o Enter principalmente.
      if (event.key === "Enter") event.preventDefault();
      return;
    }

    const multiplierMatch = rawValue.match(/^(\d+)\*$/);
    if (multiplierMatch) {
      const quantity = parseInt(multiplierMatch[1], 10);
      if (quantity > 0) {
        setQuantityMultiplier(quantity);
        setScanInput("");
        setScanError("");
        event.preventDefault();
        return;
      }
    }

    if (event.key === "Enter") {
      event.preventDefault();

      const searchTerm = rawValue.trim();
      if (searchTerm === "") return;

      try {
        const empresa_id = localStorage.getItem("empresa_id");

        const res = await apiFetch(
          `${API_BASE}/api/search?q=${encodeURIComponent(
            searchTerm
          )}&e=${empresa_id}`
        );
        const data = await res.json();
        const results: SaleProduct[] = data?.payload?.obj ?? [];

        let productToAdd = results.find((p) => p.sku === searchTerm);

        if (!productToAdd && results.length > 0) {
          productToAdd = results[0];
        }

        if (productToAdd) {
          if (productToAdd.type === "UNIDADE") {
            addToCart(productToAdd, quantityMultiplier);
            setScanInput("");
            setQuantityMultiplier(1);
          } else if (productToAdd.type === "PESO") {
            openWeightModal(productToAdd);
          }
          setScanError("");
          setScanError("");
        } else {
          // setScanError("Produto não encontrado.");
          // setTimeout(() => setScanError(""), 2000);
          toast.warning("Produto não encontrado.");
        }
      } catch (err) {
        console.error("Erro ao buscar produto no Enter:", err);
        // setScanError("Erro de conexão.");
        toast.error("Erro de conexão ao buscar produto.");
      }
    }
  };

  const calculateTotal = () => {
    return cart.reduce((total, item) => total + item.totalPrice, 0);
  };

  const reprintLastSale = async () => {
    if (!lastSale) return;

    // Se o caixa estiver fechado, bloqueia submit
    if (!isBoxOpen) {
      toast.error("O caixa está fechado. Realize a abertura para vender.");
      setScanInput("");
      return;
    }

    const userId = localStorage.getItem("user_id");
    const empresa_id = localStorage.getItem("empresa_id");
    const caixa = localStorage.getItem("caixa");
    const filial_id = localStorage.getItem("filial");

    try {
      await apiFetch(`${API_BASE}/api/imprimir`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          total: lastSale.total,
          caixa,
          products: lastSale.products.map((item) => ({
            id: item.id,
            sku: item.sku,
            name: item.name,
            quantity: item.quantity,
            unit_price: item.price,
            line_total: item.totalPrice,
            type: item.type,
          })),
          payments: lastSale.payments,
          change_amount: lastSale.change,
          user_id: userId,
          venda_id: lastSale.id,
          filial_id,
          empresa_id,
        }),
      });
      toast.success("Comprovante enviado para impressão.");
    } catch (err) {
      console.error("Erro ao reimprimir:", err);
      toast.error("Erro ao enviar para impressão.");
    }
  };

  return (
    <>
      {/* --- OVERLAY BLOQUEIO DE CAIXA FECHADO --- */}
      {!isBoxOpen && (
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0,0,0,0.7)",
            zIndex: 50,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            color: "white",
            backdropFilter: "blur(4px)",
          }}
        >
          <Lock size={64} style={{ marginBottom: 20, color: "#ff4d4f" }} />
          <h2 style={{ fontSize: "2rem", marginBottom: 10 }}>Caixa Fechado</h2>
          <p style={{ fontSize: "1.2rem", opacity: 0.8 }}>
            Realize a abertura do caixa no menu lateral para iniciar as vendas.
          </p>
        </div>
      )}

      <div
        className={styles.salesContainer}
        onClick={() => searchInputRef.current?.focus()}
      >
        <div className={styles.productSelection}>
          {/* CARD HISTÓRICO - TOPO DA ESQUERDA */}
          {lastSale && (
            <>
              <div className={styles.lastSaleCard}>
                <div className={styles.lastSaleInfo}>
                  <span className={styles.lastSaleTitle}>
                    Última Venda #{lastSale.id}
                  </span>
                  <span className={styles.lastSaleDetails}>
                    {formatCurrency(lastSale.total)}
                  </span>
                  {lastSale.change > 0 && (
                    <span
                      className={styles.lastSaleDetails}
                      style={{
                        fontSize: "0.9em",
                        color: "#16a34a",
                        marginTop: "2px",
                      }}
                    >
                      Troco: {formatCurrency(lastSale.change)}
                    </span>
                  )}
                </div>
                <div style={{ display: "flex", gap: "8px", marginTop: "8px" }}>
                  <button
                    className={styles.reprintButton}
                    onClick={reprintLastSale}
                    style={{ flex: 1 }}
                  >
                    Imprimir
                  </button>
                  <button
                    onClick={() => setIsLastSaleExpanded(!isLastSaleExpanded)}
                    className={styles.viewItemsButton}
                    style={{ flex: 1 }}
                  >
                    {isLastSaleExpanded ? "Ocultar" : "Ver Itens"}
                  </button>
                </div>
              </div>

              {/* LISTA EXPANDIDA INLINE (FORA DO CARD) */}
              {isLastSaleExpanded && (
                <div className={styles.lastSaleExpandedContainer}>
                  <div className={styles.lastSaleExpandedList}>
                    {lastSale.products.map((item, index) => (
                      <div key={index} className={styles.lastSaleExpandedItem}>
                        <div>
                          <strong>{item.quantity}x</strong> {item.name}
                        </div>
                        <div style={{ textAlign: "right" }}>
                          <div style={{ fontWeight: "bold" }}>
                            {formatCurrency(item.totalPrice)}
                          </div>
                          {(item.quantity > 1 || item.type === "PESO") && (
                            <div
                              style={{
                                fontSize: "0.8em",
                                color: "#6b7280",
                              }}
                            >
                              ({item.type === "PESO" ? "kg" : "un"}:{" "}
                              {formatCurrency(item.price)})
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* SEÇÃO DE PAGAMENTOS NO HISTÓRICO */}
                  <div
                    style={{
                      marginTop: "16px",
                      borderTop: "1px dashed #d1d5db",
                      paddingTop: "8px",
                    }}
                  >
                    <div
                      style={{
                        fontSize: "0.9em",
                        fontWeight: "bold",
                        color: "#4b5563",
                        marginBottom: "4px",
                      }}
                    >
                      Pagamentos Realizados:
                    </div>
                    {lastSale.payments.map((p, idx) => (
                      <div
                        key={idx}
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          fontSize: "0.9em",
                          padding: "2px 0",
                        }}
                      >
                        <span style={{ textTransform: "capitalize" }}>
                          {p.method}
                          {p.method === "credito" &&
                          p.installments &&
                          p.installments > 1
                            ? ` (${p.installments}x)`
                            : ""}
                        </span>
                        <span>{formatCurrency(p.amount)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          <div className={styles.inputContainer}>
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Bipe ou digite..."
              className={styles.searchInput}
              value={scanInput}
              onChange={(e) => setScanInput(e.target.value)}
              onKeyDown={handleKeyDown}
            />
            {quantityMultiplier > 1 && (
              <div className={styles.multiplierInfo}>
                <span>{quantityMultiplier}x</span>
                <button
                  onClick={() => {
                    setQuantityMultiplier(1);
                    searchInputRef.current?.focus();
                  }}
                  className={styles.cancelMultiplierButton}
                >
                  &times;
                </button>
              </div>
            )}
          </div>
          {/* {scanError && <p className={styles.scanError}>{scanError}</p>} Removido em favor do Toast */}

          <div className={styles.productGrid}>
            {filteredProducts.map((product) => (
              <div
                key={product.id}
                className={styles.productCard}
                onClick={() => {
                  if (product.type === "UNIDADE") {
                    addToCart(product, quantityMultiplier);
                    setScanInput("");
                    setQuantityMultiplier(1);
                    searchInputRef.current?.focus();
                  } else {
                    openWeightModal(product);
                  }
                }}
              >
                <div className={styles.productName}>{product.name}</div>
                <div className={styles.productPrice}>
                  {formatCurrency(product.price)}
                  {product.type === "PESO" ? "/kg" : ""}
                </div>
                <div className={styles.productSku}>{product.sku}</div>
              </div>
            ))}
          </div>
        </div>

        <div className={styles.receipt}>
          <h2 className={styles.receiptTitle}>Itens da Venda</h2>
          <div className={styles.itemList} ref={itemListRef}>
            {cart.length === 0 ? (
              <p style={{ textAlign: "center", color: "#6b7280" }}>
                Nenhum item adicionado.
              </p>
            ) : (
              cart.map((item) => (
                <div key={item.cartLineId} className={styles.item}>
                  <div className={styles.itemInfo}>
                    <div style={{ display: "flex", alignItems: "center" }}>
                      <span className={styles.itemQuantity}>
                        {item.quantity}
                        {item.type === "PESO" ? "kg" : "x"}
                      </span>
                      <span className={styles.itemName}>{item.name}</span>
                    </div>
                    {/* Exibe preço unitário se for PESO ou Qtd > 1 */}
                    {(item.type === "PESO" || item.quantity > 1) && (
                      <span
                        style={{
                          fontSize: "0.85em",
                          color: "#6b7280",
                          marginLeft: "8px",
                          fontStyle: "italic",
                        }}
                      >
                        {item.type === "PESO"
                          ? `(${formatCurrency(item.price)}/kg)`
                          : `(1 un: ${formatCurrency(item.price)})`}
                      </span>
                    )}
                  </div>
                  <div className={styles.itemActions}>
                    <span className={styles.itemTotal}>
                      {formatCurrency(item.totalPrice)}
                    </span>
                    <button
                      onClick={() => openRemoveItemModal(item)}
                      className={styles.removeItemButton}
                    >
                      <XCircle size={18} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
          <div className={styles.totalSection}>
            <span>Total</span>
            <span>{formatCurrency(calculateTotal())}</span>
          </div>
          <div className={styles.actionsContainer}>
            <button
              onClick={openPaymentModal}
              className={styles.finishButton}
              disabled={cart.length === 0}
            >
              Finalizar Venda (Ctrl+1)
            </button>
            <button
              onClick={openCancelSaleModal}
              className={styles.cancelButton}
              disabled={cart.length === 0}
            >
              Cancelar Venda (Ctrl+2)
            </button>
          </div>
        </div>
      </div>

      {/* MODAIS */}
      <Modal
        isOpen={isRemoveItemModalOpen}
        onClose={closeRemoveItemModal}
        onConfirm={confirmRemoveItem}
        title={`Remover "${itemToRemove?.name}"`}
        shortcutMap={{ "1": closeRemoveItemModal, "2": confirmRemoveItem }}
      >
        <div className={styles.modalContent}>
          <p className={styles.modalWarning}>A remoção será registrada.</p>
          {itemToRemove?.type === "UNIDADE" ? (
            <>
              <label className={styles.formLabel}>Qtd. remover?</label>
              <input
                type="number"
                className={styles.formInput}
                value={quantityToRemove}
                onChange={(e) =>
                  setQuantityToRemove(parseInt(e.target.value, 10))
                }
                min="1"
                max={itemToRemove?.quantity}
                autoFocus
              />
            </>
          ) : (
            <p>Remover item de peso?</p>
          )}
        </div>
        <div className={styles.modalActions}>
          <button
            onClick={closeRemoveItemModal}
            className={styles.secondaryButton}
          >
            Cancelar [1]
          </button>
          <button onClick={confirmRemoveItem} className={styles.dangerButton}>
            Confirmar [2]
          </button>
        </div>
      </Modal>

      <Modal
        isOpen={isCancelSaleModalOpen}
        onClose={() => setIsCancelSaleModalOpen(false)}
        onConfirm={confirmCancelSale}
        title="Cancelar Venda?"
      >
        <div className={styles.modalContent}>
          <p>Tudo será perdido.</p>
        </div>
        <div className={styles.modalActions}>
          <button
            onClick={() => setIsCancelSaleModalOpen(false)}
            className={styles.secondaryButton}
          >
            Voltar [Esc]
          </button>
          <button onClick={confirmCancelSale} className={styles.finishButton}>
            Confirmar [Enter]
          </button>
        </div>
      </Modal>

      <Modal
        isOpen={isPaymentModalOpen}
        onClose={closePaymentModal}
        onConfirm={
          paymentStatus !== "pending" && remainingAmount <= 0
            ? handleConfirmPayment
            : undefined
        }
        title="Pagamento"
        maxWidth="900px"
        shortcutMap={{
          "1": () => setPaymentMethod("qr"),
          "2": () => setPaymentMethod("debito"),
          "3": () => setPaymentMethod("credito"),
          "4": () => setPaymentMethod("especie"),
        }}
      >
        <div className={styles.modalContent}>
          <div className={styles.paymentModalContent}>
            {/* COLUNA ESQUERDA: SELEÇÃO */}
            <div className={styles.paymentSelectionColumn}>
              <h3 className={styles.sectionTitle}>Adicionar Pagamento</h3>
              <div className={styles.paymentOptions}>
                <button
                  className={`${styles.paymentButton} ${
                    paymentMethod === "qr" ? styles.paymentButtonSelected : ""
                  }`}
                  onClick={() => setPaymentMethod("qr")}
                >
                  <span>PIX</span>
                  <span style={{ fontSize: "12px", opacity: 0.8 }}>[1]</span>
                </button>
                <button
                  className={`${styles.paymentButton} ${
                    paymentMethod === "debito"
                      ? styles.paymentButtonSelected
                      : ""
                  }`}
                  onClick={() => setPaymentMethod("debito")}
                >
                  <span>Débito</span>
                  <span style={{ fontSize: "12px", opacity: 0.8 }}>[2]</span>
                </button>
                <button
                  className={`${styles.paymentButton} ${
                    paymentMethod === "credito"
                      ? styles.paymentButtonSelected
                      : ""
                  }`}
                  onClick={() => setPaymentMethod("credito")}
                >
                  <span>Crédito</span>
                  <span style={{ fontSize: "12px", opacity: 0.8 }}>[3]</span>
                </button>
                <button
                  className={`${styles.paymentButton} ${
                    paymentMethod === "especie"
                      ? styles.paymentButtonSelected
                      : ""
                  }`}
                  onClick={() => {
                    setPaymentMethod("especie");
                    setAmountReceived(""); // Resetar valor recebido
                    // O valor a pagar (currentPaymentAmount) já é setado no openPaymentModal ou mantido
                  }}
                >
                  <span>Espécie</span>
                  <span style={{ fontSize: "12px", opacity: 0.8 }}>[4]</span>
                </button>
              </div>

              {paymentMethod && (
                <div className={styles.cashSection}>
                  <div style={{ display: "flex", gap: "10px" }}>
                    <div style={{ flex: 1 }}>
                      <label className={styles.formLabel}>
                        Valor a Pagar (R$)
                      </label>
                      <input
                        type="text"
                        inputMode="numeric"
                        autoComplete="off"
                        className={styles.formInput}
                        value={currentPaymentAmount}
                        onChange={(e) =>
                          setCurrentPaymentAmount(
                            formatCurrencyInput(e.target.value)
                          )
                        }
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            // Se for espécie, o Enter no "A Pagar" deve ir para "Recebido" se estiver vazio?
                            // Ou tentar adicionar direto?
                            // Vamos focar no Recebido se for espécie
                            if (paymentMethod === "especie") {
                              document
                                .getElementById("amountReceivedInput")
                                ?.focus();
                            } else {
                              addPayment();
                            }
                          }
                        }}
                      />
                    </div>
                    {paymentMethod === "especie" && (
                      <div style={{ flex: 1 }}>
                        <label className={styles.formLabel}>
                          Valor Recebido (R$)
                        </label>
                        <input
                          id="amountReceivedInput"
                          type="text"
                          inputMode="numeric"
                          autoComplete="off"
                          className={styles.formInput}
                          value={amountReceived}
                          onChange={(e) =>
                            setAmountReceived(
                              formatCurrencyInput(e.target.value)
                            )
                          }
                          placeholder={currentPaymentAmount} // Sugestão visual
                          onKeyDown={(e) => {
                            if (e.key === "Enter") addPayment();
                          }}
                        />
                      </div>
                    )}
                  </div>

                  {paymentMethod === "especie" && (
                    <div
                      style={{
                        marginTop: "10px",
                        padding: "10px",
                        backgroundColor: "#f0fdf4",
                        borderRadius: "6px",
                        border: "1px solid #bbf7d0",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <span style={{ color: "#166534", fontWeight: "600" }}>
                        Troco Estimado:
                      </span>
                      <span
                        style={{
                          color: "#15803d",
                          fontWeight: "bold",
                          fontSize: "1.2em",
                        }}
                      >
                        {formatCurrency(
                          Math.max(
                            0,
                            (parseCurrencyInput(amountReceived) || 0) -
                              (parseCurrencyInput(currentPaymentAmount) || 0)
                          )
                        )}
                      </span>
                    </div>
                  )}

                  {paymentMethod === "credito" && (
                    <div
                      className={styles.installmentsSection}
                      style={{ borderTop: "none", paddingTop: 0 }}
                    >
                      <label className={styles.formLabel}>Parcelas</label>
                      <select
                        className={styles.formSelect}
                        value={installments}
                        onChange={(e) =>
                          setInstallments(parseInt(e.target.value, 10))
                        }
                      >
                        {Array.from({ length: 3 }, (_, i) => i + 1).map((i) => (
                          <option key={i} value={i}>
                            {i}x de{" "}
                            {formatCurrency(
                              calculateInstallmentValue(
                                parseCurrencyInput(currentPaymentAmount) || 0,
                                i
                              )
                            )}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  <button
                    onClick={addPayment}
                    className={styles.addPaymentButton}
                    disabled={
                      !currentPaymentAmount ||
                      parseCurrencyInput(currentPaymentAmount) <= 0
                    }
                  >
                    Adicionar Pagamento
                  </button>
                </div>
              )}
            </div>

            {/* COLUNA DIREITA: RESUMO */}
            <div className={styles.paymentSummaryColumn}>
              <h3 className={styles.sectionTitle}>Resumo da Venda</h3>

              <div className={styles.paymentSummaryRow}>
                <span className={styles.paymentSummaryLabel}>Total Venda:</span>
                <span className={styles.paymentSummaryValue}>
                  {formatCurrency(totalSale)}
                </span>
              </div>

              <div className={styles.paymentSummaryRow}>
                <span className={styles.paymentSummaryLabel}>Total Pago:</span>
                <span
                  className={`${styles.paymentSummaryValue} ${styles.paid}`}
                >
                  {formatCurrency(totalPaid)}
                </span>
              </div>

              <div className={styles.paymentSummaryRow}>
                <span className={styles.paymentSummaryLabel}>Restante:</span>
                <span
                  className={`${styles.paymentSummaryValue} ${
                    styles.remaining
                  } ${remainingAmount <= 0 ? styles.zero : ""}`}
                >
                  {formatCurrency(remainingAmount)}
                </span>
              </div>

              {changeAmount > 0 && (
                <div
                  className={styles.paymentSummaryRow}
                  style={{ marginTop: "16px" }}
                >
                  <span
                    className={styles.paymentSummaryLabel}
                    style={{ fontSize: "1.1em" }}
                  >
                    Troco:
                  </span>
                  <span
                    className={styles.paymentSummaryValue}
                    style={{ color: "#16a34a", fontSize: "1.2em" }}
                  >
                    {formatCurrency(changeAmount)}
                  </span>
                </div>
              )}

              <div className={styles.paymentList}>
                {payments.length === 0 ? (
                  <div className={styles.emptyPaymentList}>
                    Nenhum pagamento adicionado.
                  </div>
                ) : (
                  payments.map((p) => (
                    <div key={p.id} className={styles.addedPaymentItem}>
                      <div className={styles.addedPaymentInfo}>
                        <span className={styles.addedPaymentMethod}>
                          {p.method.toUpperCase()}
                          {p.installments && p.installments > 1 ? (
                            <span style={{ fontSize: "0.9em" }}>
                              {" "}
                              ({p.installments}x de{" "}
                              {formatCurrency(p.amount / p.installments)})
                            </span>
                          ) : (
                            ""
                          )}
                          {/* EXIBE O TROCO EM VERDE SE HOUVER para este pagamento */}
                          {p.method === "especie" &&
                            p.changeGenerated &&
                            p.changeGenerated > 0 && (
                              <span className={styles.changeText}>
                                Troco: {formatCurrency(p.changeGenerated)}
                              </span>
                            )}
                        </span>
                        <span className={styles.addedPaymentAmount}>
                          {formatCurrency(p.amount)}
                        </span>
                      </div>
                      <button
                        onClick={() =>
                          removePayment(p.id, p.method, p.changeGenerated)
                        }
                        className={styles.removePaymentButton}
                        title="Remover pagamento"
                      >
                        <XCircle size={20} />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
        <div className={styles.modalActions}>
          <button
            onClick={closePaymentModal}
            className={styles.secondaryButton}
          >
            Voltar [Esc]
          </button>
          <button
            onClick={handleConfirmPayment}
            className={styles.finishButton}
            // disabled={remainingAmount !== 0} // Desabilita se ainda faltar pagar
          >
            Finalizar Venda [Enter]
          </button>
        </div>
      </Modal>

      <Modal
        isOpen={paymentStatus === "pending" || paymentStatus === "waiting_next"}
        onClose={() => {}}
        title={
          paymentStatus === "waiting_next"
            ? "Pagamento Confirmado"
            : "Processando Pagamento..."
        }
        onConfirm={() => {}}
      >
        <div className={styles.modalContent}>
          {paymentStatus === "pending" && (
            <>
              <p>Aguarde a confirmação na maquininha.</p>
              {currentSerialPayment && (
                <p
                  style={{
                    fontWeight: "bold",
                    marginTop: "10px",
                    color: "#2563eb",
                  }}
                >
                  Pagamento {currentSerialPayment.currentIndex + 1} de{" "}
                  {currentSerialPayment.electronicPayments.length}
                </p>
              )}
              <div
                className={styles.loader}
                style={{ margin: "20px auto" }}
              ></div>
            </>
          )}

          {paymentStatus === "waiting_next" && (
            <div className="text-center">
              <div style={{ color: "#16a34a", marginBottom: "20px" }}>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="64"
                  height="64"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{ margin: "0 auto" }}
                >
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                  <polyline points="22 4 12 14.01 9 11.01"></polyline>
                </svg>
                <h3 className="text-xl font-bold mt-2">
                  Pagamento Confirmado!
                </h3>
              </div>

              <p className="mb-6">Pronto para iniciar o próximo pagamento?</p>

              <button
                onClick={handleNextPayment}
                className={styles.finishButton}
                style={{ width: "100%", padding: "15px", fontSize: "1.1em" }}
              >
                Iniciar Próximo Pagamento &rarr;
              </button>
            </div>
          )}

          {paymentError && (
            <p
              className={styles.error}
              style={{ color: "red", marginTop: "10px" }}
            >
              {paymentError}
            </p>
          )}

          {paymentStatus === "pending" && (
            <button
              onClick={() =>
                cancelarpagamento(currentSerialPayment.currentTransactionId)
              }
              className={styles.cancelButton}
              style={{ marginTop: "10px" }}
            >
              Cancelar
            </button>
          )}
        </div>
      </Modal>

      <Modal
        isOpen={
          paymentStatus === "processed" ||
          paymentStatus === "canceled" ||
          paymentStatus === "suspicious"
        }
        onClose={() => setPaymentStatus("idle")}
        title={
          paymentStatus === "processed"
            ? "Sucesso"
            : paymentStatus === "suspicious"
            ? "Atenção"
            : "Erro"
        }
        onConfirm={
          paymentStatus === "processed"
            ? startNewSale
            : () => setPaymentStatus("idle")
        }
      >
        {paymentStatus === "suspicious" && (
          <div className="text-center">
            <h2 className="text-2xl font-bold mb-2">Confirmação Necessária</h2>
            <p className="text-lg mb-6">
              A maquininha informou que o pagamento foi aprovado{" "}
              <strong>instantaneamente</strong>.
              <br />
              Por favor, verifique se o cliente realmente realizou o pagamento.
            </p>
            <div
              style={{
                display: "flex",
                gap: "10px",
                justifyContent: "flex-end",
                marginTop: "16px",
              }}
            >
              <button
                onClick={confirmSuspiciousPayment}
                className={styles.finishButton}
              >
                Sim, Pagou
              </button>
              <button
                onClick={retrySuspiciousPayment}
                className={styles.cancelButton}
              >
                Não Pagou (Cancelar)
              </button>
            </div>
          </div>
        )}

        {/* --- MODAL DE DETALHES DA ÚLTIMA VENDA --- */}

        {paymentStatus === "processed" ? (
          <div className={styles.statusContent}>
            <p>Venda realizada!</p>
            {transactionId && (
              <p
                style={{
                  fontSize: "0.9em",
                  color: "#6b7280",
                  marginTop: "8px",
                }}
              >
                ID Transação: {transactionId}
              </p>
            )}
            <div className={styles.modalActions}>
              <button
                onClick={reprintLastSale}
                className={styles.reprintButton}
              >
                Imprimir Comprovante
              </button>
              <button
                onClick={() => setIsLastSaleDetailsModalOpen(true)}
                className={styles.viewItemsButton}
              >
                Ver Itens
              </button>
              <button onClick={startNewSale} className={styles.finishButton}>
                Nova Venda
              </button>
            </div>
          </div>
        ) : (
          <div className={styles.statusContent}>
            <p className={styles.errorMessage}>{paymentError}</p>
            <button
              onClick={() => setPaymentStatus("idle")}
              className={styles.secondaryButton}
            >
              Tentar Novamente
            </button>
          </div>
        )}
      </Modal>

      {/* --- MODAL DE DETALHES DA ÚLTIMA VENDA (Movido para raiz) --- */}

      <Modal
        isOpen={isWeightModalOpen}
        onClose={closeWeightModal}
        onConfirm={confirmWeightAndAddToCart}
        title={`Pesar: ${productForWeight?.name}`}
      >
        <div className={styles.modalContent}>
          <p>{formatCurrency(productForWeight?.price || 0)}/kg</p>
          <label className={styles.formLabel}>Peso (Kg)</label>
          <input
            id="weight"
            type="text"
            inputMode="decimal"
            className={styles.formInput}
            value={weightInput}
            onChange={(e) => setWeightInput(formatWeightInput(e.target.value))}
            placeholder="0,000"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter") confirmWeightAndAddToCart();
            }}
          />
        </div>
        <div className={styles.modalActions}>
          <button onClick={closeWeightModal} className={styles.secondaryButton}>
            Voltar [Esc]
          </button>
          <button
            onClick={confirmWeightAndAddToCart}
            className={styles.finishButton}
          >
            Adicionar [Enter]
          </button>
        </div>
      </Modal>
    </>
  );
};

export default SalesPage;
