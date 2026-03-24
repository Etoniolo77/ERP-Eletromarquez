import axios from "axios";

// Instância base para comunicações com o Backend
// Sistema dinâmico: usa Next.js API routes no Vercel, FastAPI localmente
const getBaseURL = () => {
    // 1. Prioridade absoluta para variável de ambiente
    if (process.env.NEXT_PUBLIC_API_URL) return process.env.NEXT_PUBLIC_API_URL;

    // 2. Detecção automática baseada no host de acesso (cliente)
    if (typeof window !== "undefined") {
        const { hostname } = window.location;
        // Se acessado por IP ou hostname que não seja localhost, usa Next.js API routes
        if (hostname !== "localhost" && hostname !== "127.0.0.1") {
            return `/api/v1`;  // Use Next.js API routes on Vercel
        }
    }

    // 3. Fallback padrão para ambiente local
    return "http://127.0.0.1:8000/api/v1";
};

const api = axios.create({
    baseURL: getBaseURL(),
    timeout: 60000,
    headers: {
        "Content-Type": "application/json",
    },
});

export default api;
