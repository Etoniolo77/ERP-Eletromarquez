import api from "./api";

// Módulos com processamento pesado que exigem timeout estendido
const HEAVY_MODULES = ["logccm", "all", "5s", "apr", "indisponibilidade", "saida_base"];
const HEAVY_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutos

/**
 * Dispara a sincronização de dados no backend (re-lê arquivos da fonte)
 * e limpa o cache. Deve ser chamado ANTES de recarregar os dados do dashboard.
 *
 * @param module - Módulo a sincronizar (default: "all")
 * @returns true se sync concluiu com sucesso, false caso contrário.
 */
export async function triggerSync(module = "all"): Promise<boolean> {
    const timeout = HEAVY_MODULES.includes(module) ? HEAVY_TIMEOUT_MS : 60000;
    try {
        await api.post(`/sync/run?module=${encodeURIComponent(module)}`, null, { timeout });
        return true;
    } catch (error) {
        console.error(`[SYNC] Falha ao sincronizar módulo "${module}":`, error);
        return false;
    }
}
