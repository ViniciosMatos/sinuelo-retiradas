/**
 * Funções auxiliares para manipulação de data no fuso brasileiro (America/Sao_Paulo)
 * Evita bugs clássicos de conversão UTC onde new Date('YYYY-MM-DD') volta 1 dia.
 */

/**
 * Retorna a data de hoje no fuso local no formato 'YYYY-MM-DD'
 */
export const getTodayBR = () => {
  const hoje = new Date();
  const ano = hoje.getFullYear();
  const mes = String(hoje.getMonth() + 1).padStart(2, '0');
  const dia = String(hoje.getDate()).padStart(2, '0');
  return `${ano}-${mes}-${dia}`; // Formato YYYY-MM-DD local sem conversão UTC
};

/**
 * Converte data (Date, string YYYY-MM-DD ou ISO) em YYYY-MM-DD no fuso local
 */
export const getLocalDateString = (dateInput = new Date()) => {
  if (!dateInput) return '';
  if (typeof dateInput === 'string') {
    const [parteData] = dateInput.split('T');
    const partes = parteData.split('-');
    if (partes.length === 3 && partes[0].length === 4) {
      return parteData;
    }
  }
  const d = dateInput instanceof Date ? dateInput : new Date(dateInput);
  if (isNaN(d.getTime())) return '';
  const ano = d.getFullYear();
  const mes = String(d.getMonth() + 1).padStart(2, '0');
  const dia = String(d.getDate()).padStart(2, '0');
  return `${ano}-${mes}-${dia}`;
};

/**
 * Formata qualquer data (YYYY-MM-DD ou Date) para exibição DD/MM/YYYY sem deslocamento UTC
 */
export const formatDateBR = (dateInput) => {
  if (!dateInput) return '';
  if (typeof dateInput === 'string') {
    const limpo = dateInput.split('T')[0].trim();
    const partes = limpo.split('-');
    if (partes.length === 3 && partes[0].length === 4) {
      const [ano, mes, dia] = partes;
      return `${dia.padStart(2, '0')}/${mes.padStart(2, '0')}/${ano}`;
    }
    if (limpo.includes('/')) {
      const partesBarra = limpo.split('/');
      if (partesBarra.length === 3) {
        if (partesBarra[0].length === 4) {
          return `${partesBarra[2].padStart(2, '0')}/${partesBarra[1].padStart(2, '0')}/${partesBarra[0]}`;
        }
        return limpo;
      }
    }
  }
  const d = dateInput instanceof Date ? dateInput : new Date(dateInput);
  if (isNaN(d.getTime())) return '';
  const ano = d.getFullYear();
  const mes = String(d.getMonth() + 1).padStart(2, '0');
  const dia = String(d.getDate()).padStart(2, '0');
  return `${dia}/${mes}/${ano}`;
};

/**
 * Adiciona ou subtrai N dias a uma string 'YYYY-MM-DD' preservando o fuso local
 */
export const addDiasBR = (dateStr, n) => {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-').map(Number);
  const data = new Date(y, m - 1, d + n);
  const ano = data.getFullYear();
  const mes = String(data.getMonth() + 1).padStart(2, '0');
  const dia = String(data.getDate()).padStart(2, '0');
  return `${ano}-${mes}-${dia}`;
};

/**
 * Retorna o mês atual no formato 'YYYY-MM'
 */
export const getCurrentMonthBR = () => {
  const hoje = new Date();
  const ano = hoje.getFullYear();
  const mes = String(hoje.getMonth() + 1).padStart(2, '0');
  return `${ano}-${mes}`;
};

/**
 * Retorna o intervalo do mês (primeiro dia e último dia) no formato YYYY-MM-DD
 */
export const getMonthRangeBR = (anoMes) => {
  let ano, mes;
  if (!anoMes) {
    const hoje = new Date();
    ano = hoje.getFullYear();
    mes = hoje.getMonth() + 1;
  } else {
    const partes = anoMes.split('-');
    ano = Number(partes[0]);
    mes = Number(partes[1]);
  }
  const mesPad = String(mes).padStart(2, '0');
  const ultimoDia = new Date(ano, mes, 0).getDate();
  return {
    primeiroDia: `${ano}-${mesPad}-01`,
    ultimoDia: `${ano}-${mesPad}-${String(ultimoDia).padStart(2, '0')}`,
    mes,
    ano
  };
};

/**
 * Retorna nome amigável do mês em português (ex: "Outubro de 2026")
 */
export const formatMonthNameBR = (anoMes) => {
  if (!anoMes) return '';
  const [ano, mes] = anoMes.split('-').map(Number);
  const meses = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];
  return `${meses[mes - 1]} de ${ano}`;
};
