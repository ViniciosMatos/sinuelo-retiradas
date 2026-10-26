/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                // Cores oficiais da Sinuelo Soluções extraídas da Logo
                brand: {
                    light: '#14518a',
                    DEFAULT: '#0c3a64', // Azul Escuro Principal (SINUELO)
                    dark: '#072440',
                    gray: '#7a7a7a'     // Cinza do subtítulo (SOLUÇÕES EM INTERNET)
                },
                // Cores de ação do sistema (Obrigatórias para a lógica na rua)
                action: {
                    success: '#10b981', // Verde para "Finalizar O.S."
                    danger: '#ef4444',  // Vermelho para "Improdutiva"
                    alert: '#f59e0b',   // Laranja/Amarelo para a Tarja de Horário Marcado
                }
            }
        },
    },
    plugins: [],
}