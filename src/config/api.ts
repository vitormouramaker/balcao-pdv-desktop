const API_BASE: string =
  import.meta.env?.VITE_API_BASE_URL || "http://localhost:4444";

// Token da sessão do operador. Fica só em memória: fechar o app encerra a
// sessão, e nada sensível vai para o localStorage.
let authToken: string | null = null;

export const setAuthToken = (token: string | null) => {
  authToken = token;
};

/**
 * fetch com o token de sessão no cabeçalho Authorization. Se a API responder
 * 401 (token vencido), avisa o AuthContext para voltar ao login.
 */
export const apiFetch = async (
  input: string,
  init: RequestInit = {}
): Promise<Response> => {
  const headers = new Headers(init.headers);
  if (authToken) headers.set("Authorization", `Bearer ${authToken}`);
  const response = await fetch(input, { ...init, headers });
  if (response.status === 401) {
    window.dispatchEvent(new Event("pdv:sessao-expirada"));
  }
  return response;
};

export { API_BASE };
