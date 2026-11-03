import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  ReactNode,
} from "react";
import styles from "../components/common/Toast/Toast.module.css";
import { CheckCircle, XCircle, AlertTriangle, Info, Bell } from "react-feather";

type ToastType = "success" | "error" | "warning" | "info" | "notification";

interface Toast {
  id: string;
  message: string;
  type: ToastType;
  duration?: number;
  exiting?: boolean;
}

interface ToastContextData {
  addToast: (message: string, type: ToastType, duration?: number) => void;
  removeToast: (id: string) => void;
  toast: {
    success: (message: string, duration?: number) => void;
    error: (message: string, duration?: number) => void;
    warning: (message: string, duration?: number) => void;
    info: (message: string, duration?: number) => void;
    notification: (message: string, duration?: number) => void;
  };
}

const ToastContext = createContext<ToastContextData>({} as ToastContextData);

export const useToast = () => useContext(ToastContext);

export const ToastProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const removeToast = useCallback((id: string) => {
    // Trigger exit animation first?
    // Implementing exit animation needs state update.
    // For simplicity, we just filter out.
    // To support animation, we would mark as exiting, wait, then remove.
    // Let's implement immediate removal for now to avoid complexity,
    // or adding 'exiting' class logic if robust.
    setToasts((state) => state.filter((toast) => toast.id !== id));
  }, []);

  const addToast = useCallback(
    (message: string, type: ToastType, duration = 3000) => {
      const id = Date.now().toString() + Math.random().toString();
      const newToast: Toast = { id, message, type, duration };

      setToasts((state) => [...state, newToast]);

      if (duration) {
        setTimeout(() => {
          removeToast(id);
        }, duration);
      }
    },
    [removeToast]
  );

  const toastHelpers = {
    success: (msg: string, dur?: number) => addToast(msg, "success", dur),
    error: (msg: string, dur?: number) => addToast(msg, "error", dur),
    warning: (msg: string, dur?: number) => addToast(msg, "warning", dur),
    info: (msg: string, dur?: number) => addToast(msg, "info", dur),
    notification: (msg: string, dur?: number) =>
      addToast(msg, "notification", dur),
  };

  return (
    <ToastContext.Provider
      value={{ addToast, removeToast, toast: toastHelpers }}
    >
      {children}
      <div className={styles.toastContainer}>
        {toasts.map((t) => (
          <div key={t.id} className={`${styles.toast} ${styles[t.type]}`}>
            <div className={styles.icon}>
              {t.type === "success" && <CheckCircle size={24} />}
              {t.type === "error" && <XCircle size={24} />}
              {t.type === "warning" && <AlertTriangle size={24} />}
              {t.type === "info" && <Info size={24} />}
              {t.type === "notification" && <Bell size={24} />}
            </div>
            <div className={styles.content}>{t.message}</div>
            {/* Optional Progress Bar Animation if duration is set */}
            {t.duration && (
              <div
                className={styles.progressBar}
                style={{ animationDuration: `${t.duration}ms` }}
              />
            )}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};
