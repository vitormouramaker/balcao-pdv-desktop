import { API_BASE, apiFetch } from "../config/api";

export interface BoxOpeningData {
  usuario_id: number;
  caixa_id: number;
  filial_id: number;
  empresa_id: number;
  valor_abertura: number;
}

export interface BoxClosingData {
  caixa_id: number;
  filial_id: number;
  empresa_id: number;
}

export interface BleedData {
  usuario_id: number;
  caixa_id: number;
  filial_id: number;
  empresa_id: number;
  valor_ruptura: number;
  motivo: string;
}

export interface CheckBoxStatusData {
  usuario_id: number;
  caixa_id: number;
  filial_id: number;
  empresa_id: number;
}

export interface ClosingValuesResponse {
  valor_abertua: number; // Note: Typo present in backend response 'valor_abertua'
  valor_especie: number;
  valor_total: number;
}

export const boxService = {
  openBox: async (data: BoxOpeningData) => {
    const response = await apiFetch(`${API_BASE}/api/abertura`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    return response.json();
  },

  closeBox: async (data: BoxClosingData) => {
    const response = await apiFetch(`${API_BASE}/api/fechamento`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    return response.json();
  },

  bleedBox: async (data: BleedData) => {
    const response = await apiFetch(`${API_BASE}/api/ruptura`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    return response.json();
  },

  checkBoxStatus: async (data: CheckBoxStatusData) => {
    const response = await apiFetch(`${API_BASE}/web/verificar_caixa_aberto`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    return response.json();
  },

  getClosingValues: async (
    caixa_id: number,
    filial_id: number,
    empresa_id: number
  ): Promise<{ payload: { obj: ClosingValuesResponse } }> => {
    const response = await apiFetch(`${API_BASE}/api/valor_fechamento`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ caixa_id, filial_id, empresa_id }),
    });
    return response.json();
  },
};
