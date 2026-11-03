import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import styles from "./LoginPage.module.css";
import { Eye, EyeOff } from "react-feather";
import { invoke } from "@tauri-apps/api/core";

const LoginPage: React.FC = () => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  // const [error, setError] = useState(''); // Removido em favor do Toast

  // Hooks para navegação e autenticação
  const navigate = useNavigate();
  const { login, user } = useAuth();
  const { toast } = useToast();
  interface AppConfig {
    caixa: string;
    servidor: string;
    filial: string;
  }

  useEffect(() => {
    // 🔹 Buscar config do PC via Tauri
    const carregarConfig = async () => {
      try {
        const data = await invoke<string>("ler_config");
        const config: AppConfig = JSON.parse(data);
        if (config?.caixa) {
          localStorage.setItem("caixa", config.caixa);
          localStorage.setItem("filial", config.filial);
          console.log("Caixa carregado do config:", config.caixa);
        }
      } catch (error) {
        // Fora do app desktop (navegador em modo dev) não existe o comando
        // Tauri: usa o caixa/loja padrão do .env do front.
        console.warn("Config do caixa indisponível, usando padrão:", error);
        if (!localStorage.getItem("caixa")) {
          localStorage.setItem("caixa", import.meta.env.VITE_DEFAULT_CAIXA || "1");
          localStorage.setItem("filial", import.meta.env.VITE_DEFAULT_FILIAL || "1");
        }
      }
    };

    carregarConfig();

    // 🔹 Verifica se há usuário lembrado (só o usuário; a senha nunca é salva)
    localStorage.removeItem("rememberedUser"); // formato antigo, guardava a senha
    const rememberedUsername = localStorage.getItem("rememberedUsername");
    if (rememberedUsername) {
      setUsername(rememberedUsername);
      setRememberMe(true);
    }
  }, []);

  useEffect(() => {
    if (user) navigate("/");
  }, [user, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await login(username, password);

      // Salva ou remove o usuário lembrado
      if (rememberMe) {
        localStorage.setItem("rememberedUsername", username);
      } else {
        localStorage.removeItem("rememberedUsername");
      }

      navigate("/");
    } catch (err) {
      toast.error((err as Error).message || "Erro ao fazer login");
    }
  };

  return (
    <div className={styles.loginPage}>
      <div className={styles.formSide}>
        <div className={styles.formContainer}>
          <h1 className={styles.title}>Bem-vindo de volta!</h1>
          <p className={styles.subtitle}>
            Faça login para acessar o Balcão PDV.
          </p>

          <form onSubmit={handleSubmit} className={styles.form}>
            <div>
              <label htmlFor="username" className={styles.formLabel}>
                Usuário
              </label>
              <input
                id="username"
                type="text"
                className={styles.formInput}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                autoFocus
              />
            </div>
            <div>
              <label htmlFor="password" className={styles.formLabel}>
                Senha
              </label>
              <div className={styles.inputGroup}>
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  className={styles.formInput}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className={styles.passwordToggle}
                >
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
            </div>
            <div className={styles.options}>
              <div className={styles.checkboxContainer}>
                <input
                  type="checkbox"
                  id="remember"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                />
                <label htmlFor="remember">Lembrar-me</label>
              </div>
            </div>
            {/* {error && <p style={{ color: 'red' }}>{error}</p>} Substituído por Toast */}
            <button type="submit" className={styles.primaryButton}>
              Entrar
            </button>
          </form>
        </div>
      </div>
      <div className={styles.imageSide} />
    </div>
  );
};

export default LoginPage;
