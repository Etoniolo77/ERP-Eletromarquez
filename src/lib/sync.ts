import api from "./api";

/**
 * Dispara a sincronização de dados no backend (re-lê arquivos da fonte)
 * e limpa o cache. Deve ser chamado ANTES de recarregar os dados do dashboard.
 *
 * @param module - Módulo a sincronizar (default: "all")
 * @returns true se sync concluiu com sucesso, false caso contrário.
 */
export async function triggerSync(module = "all"): Promise<boolean> {
    try {
        await api.post(`/sync/run?module=${encodeURIComponent(module)}`);
        return true;
    } catch (error) {
        console.error(`[SYNC] Falha ao sincronizar módulo "${module}":`, error);
        return false;
    }
}
