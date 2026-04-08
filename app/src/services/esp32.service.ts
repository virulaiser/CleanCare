import axios from 'axios';

const TIMEOUT = 5000; // 5s — el ESP32 puede estar offline

export interface EstadoMaquina {
  estado: 'funcionando' | 'apagado';
  minutos_restantes: number;
}

export interface ActivarResponse {
  estado: string;
  minutos: number;
}

function buildUrl(ip: string, path: string): string {
  return `http://${ip}${path}`;
}

export async function obtenerEstado(ip: string): Promise<EstadoMaquina> {
  const { data } = await axios.get<EstadoMaquina>(buildUrl(ip, '/estado'), {
    timeout: TIMEOUT,
  });
  return data;
}

export async function activarMaquina(ip: string, minutos: number): Promise<ActivarResponse> {
  const { data } = await axios.post<ActivarResponse>(
    buildUrl(ip, '/activar'),
    { minutos },
    { timeout: TIMEOUT }
  );
  return data;
}
