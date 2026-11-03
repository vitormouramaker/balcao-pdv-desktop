import React, { ReactNode, useEffect } from "react";
import styles from "./Modal.module.css";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void; // Ação do botão "Voltar" ou "Cancelar" (ou Esc)
  onConfirm?: () => void; // Ação do botão "Confirmar" (ou Enter)
  title: string;
  children: ReactNode;
  // Mapeamento de teclas numéricas para ações específicas
  shortcutMap?: { [key: string]: () => void };
  maxWidth?: string | number; // Prop opcional para largura
}

const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  children,
  shortcutMap,
  maxWidth,
}) => {
  const modalRef = React.useRef<HTMLDivElement>(null);

  // Efeito para focar o modal quando abrir
  useEffect(() => {
    if (isOpen) {
      // Pequeno timeout para garantir que o DOM renderizou
      setTimeout(() => {
        // Tenta focar um elemento com autoFocus primeiro
        const autoFocusElement = modalRef.current?.querySelector(
          "[autofocus]"
        ) as HTMLElement;
        if (autoFocusElement) {
          autoFocusElement.focus();
          return;
        }

        // Se não, foca o primeiro input livre
        const firstInput = modalRef.current?.querySelector(
          "input:not([disabled]), select:not([disabled]), button:not([disabled])"
        ) as HTMLElement;
        if (firstInput) {
          firstInput.focus();
        }
      }, 50);
    }
  }, [isOpen]);

  // Efeito para adicionar e remover listeners de teclado (Enter, Esc, Números) e Focus Trap
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      // 1. FOCUS TRAP (TAB Loop)
      if (event.key === "Tab") {
        const focusableModalElements = modalRef.current?.querySelectorAll(
          'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])'
        );

        if (!focusableModalElements || focusableModalElements.length === 0) {
          event.preventDefault();
          return;
        }

        const firstElement = focusableModalElements[0] as HTMLElement;
        const lastElement = focusableModalElements[
          focusableModalElements.length - 1
        ] as HTMLElement;

        if (event.shiftKey) {
          // Shift + Tab
          if (document.activeElement === firstElement) {
            event.preventDefault();
            lastElement.focus();
          }
        } else {
          // Tab
          if (document.activeElement === lastElement) {
            event.preventDefault();
            firstElement.focus();
          }
        }
        return; // Retorna para não cair nas outras verificações se for Tab
      }

      // Identifica se o foco está em um campo editável
      const targetIsInput = ["INPUT", "SELECT", "TEXTAREA"].includes(
        (event.target as HTMLElement).tagName
      );

      // Tecla Escape: Chama a função onClose (equivalente a Cancelar/Voltar)
      if (event.key === "Escape") {
        event.preventDefault();
        onClose(); // Usamos onClose como a ação padrão de Esc
      }
      // Tecla Enter: Chama onConfirm (se existir e não estiver em input)
      else if (event.key === "Enter" && onConfirm && !targetIsInput) {
        event.preventDefault();
        onConfirm();
      }
      // Teclas Numéricas (se shortcutMap existir e não estiver em input)
      else if (shortcutMap && shortcutMap[event.key] && !targetIsInput) {
        event.preventDefault();
        shortcutMap[event.key](); // Executa a ação mapeada para o número
      }
    };

    document.addEventListener("keydown", handleKeyDown);

    // Função de limpeza: remove o listener quando o modal fecha ou o componente é desmontado
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
    // Adiciona shortcutMap às dependências do efeito
  }, [isOpen, onClose, onConfirm, shortcutMap]);

  if (!isOpen) {
    return null;
  }

  return (
    // Backdrop SEM onClick para impedir fechamento
    <div className={styles.backdrop}>
      {/* Modal com stopPropagation para evitar fechar se o backdrop tivesse onClick */}
      <div
        className={styles.modal}
        onClick={(e) => e.stopPropagation()}
        style={maxWidth ? { maxWidth: maxWidth } : {}}
        ref={modalRef} // Referência adicionada
        tabIndex={-1} // Permite focar a div programaticamente se necessário
      >
        <div className={styles.modalHeader}>
          <h2 className={styles.modalTitle}>{title}</h2>
          {/* Botão de fechar ('X') REMOVIDO */}
        </div>
        <div>{children}</div>
      </div>
    </div>
  );
};

export default Modal;
