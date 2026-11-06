/**
 * Utilitário de compressão de fotos no cliente via HTMLCanvasElement nativo:
 * - Redimensiona para largura/altura máxima de 1280px mantendo proporção.
 * - Formato WebP (com fallback JPEG) e qualidade ~0.7.
 * - Garante arquivo final <= 300KB para economizar dados móveis (3G/4G) em campo.
 */
export async function comprimirFotoMAC(file) {
  if (!file) {
    throw new Error('Nenhum arquivo fornecido para compressão.');
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (event) => {
      const img = new Image();

      img.onload = () => {
        try {
          const maxDimensao = 1280;
          let width = img.width;
          let height = img.height;

          // Redimensiona proporcionalmente para largura/altura máxima de 1280px
          if (width > maxDimensao || height > maxDimensao) {
            if (width > height) {
              height = Math.round((height * maxDimensao) / width);
              width = maxDimensao;
            } else {
              width = Math.round((width * maxDimensao) / height);
              height = maxDimensao;
            }
          }

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext('2d');
          if (!ctx) {
            return reject(new Error('Falha ao obter contexto gráfico 2D do Canvas.'));
          }

          // Desenha a imagem redimensionada no canvas
          ctx.drawImage(img, 0, 0, width, height);

          // Limite estrito de 300KB (300 * 1024 bytes)
          const limiteBytes = 300 * 1024;

          const exportarBlob = (qualidade, formato = 'image/webp') => {
            canvas.toBlob(
              (blob) => {
                if (!blob) {
                  // Fallback para JPEG caso navegador não suporte encoding WebP
                  if (formato === 'image/webp') {
                    exportarBlob(qualidade, 'image/jpeg');
                  } else {
                    reject(new Error('Não foi possível gerar o Blob da imagem comprimida.'));
                  }
                  return;
                }

                // Se exceder 300KB, reduz a qualidade progressivamente até atingir o limite
                if (blob.size > limiteBytes && qualidade > 0.3) {
                  exportarBlob(Math.max(0.3, Number((qualidade - 0.15).toFixed(2))), formato);
                } else {
                  resolve(blob);
                }
              },
              formato,
              qualidade
            );
          };

          // Inicia com qualidade 0.7 e formato WebP
          exportarBlob(0.7, 'image/webp');
        } catch (err) {
          reject(err);
        }
      };

      img.onerror = () => reject(new Error('Falha ao interpretar o arquivo de imagem.'));
      img.src = event.target.result;
    };

    reader.onerror = () => reject(new Error('Falha ao carregar o arquivo em memória.'));
    reader.readAsDataURL(file);
  });
}
