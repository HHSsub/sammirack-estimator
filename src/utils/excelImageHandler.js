// 이미지 처리 유틸리티 (로고, 도장 등)

export class ExcelImageHandler {
  constructor(workbook) {
    this.workbook = workbook;
  }

  /**
   * Base64 이미지를 Excel에 추가
   * @param {string} base64Data - Base64 인코딩된 이미지 데이터
   * @param {string} extension - 이미지 확장자 (png, jpg, jpeg)
   * @param {string} range - 이미지를 삽입할 셀 범위 (예: 'A1:C3')
   * @param {object} options - 추가 옵션
   */
  addBase64Image(base64Data, extension, range, options = {}) {
    try {
      // base64 데이터에서 헤더 제거
      const cleanBase64 = base64Data.replace(/^data:image\/[a-z]+;base64,/, '');
      
      const imageId = this.workbook.addImage({
        base64: cleanBase64,
        extension: extension.toLowerCase()
      });

      const worksheet = options.worksheet || this.workbook.getWorksheet(1);
      
      worksheet.addImage(imageId, {
        tl: { col: this.getColumnIndex(range.split(':')[0]), row: this.getRowIndex(range.split(':')[0]) - 1 },
        br: { col: this.getColumnIndex(range.split(':')[1]), row: this.getRowIndex(range.split(':')[1]) - 1 },
        editAs: 'oneCell'
      });

      return imageId;
    } catch (error) {
      console.error('이미지 추가 실패:', error);
      return null;
    }
  }

  /**
   * URL에서 이미지를 가져와 Excel에 추가
   * @param {string} imageUrl - 이미지 URL
   * @param {string} range - 이미지를 삽입할 셀 범위
   * @param {object} options - 추가 옵션
   */
  async addImageFromUrl(imageUrl, range, options = {}) {
    try {
      const response = await fetch(imageUrl);
      const blob = await response.blob();
      
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const base64 = reader.result;
          const extension = this.getImageExtension(imageUrl) || 'png';
          const imageId = this.addBase64Image(base64, extension, range, options);
          resolve(imageId);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    } catch (error) {
      console.error('URL 이미지 추가 실패:', error);
      return null;
    }
  }

  /**
   * 회사 로고 추가 (표준 위치)
   * @param {string} logoData - 로고 이미지 데이터 (base64 또는 URL)
   * @param {object} worksheet - 워크시트
   */
  async addCompanyLogo(logoData, worksheet) {
    const logoRange = 'A1:C4';
    
    if (logoData.startsWith('data:image') || logoData.startsWith('/9j/') || logoData.startsWith('iVBORw0KGgo')) {
      // Base64 이미지
      const extension = this.getBase64Extension(logoData) || 'png';
      return this.addBase64Image(logoData, extension, logoRange, { worksheet });
    } else if (logoData.startsWith('http')) {
      // URL 이미지
      return await this.addImageFromUrl(logoData, logoRange, { worksheet });
    } else {
      console.warn('지원하지 않는 이미지 형식:', logoData);
      return null;
    }
  }

  /**
   * 도장 이미지 추가 (표준 위치)
   * @param {string} stampData - 도장 이미지 데이터
   * @param {object} worksheet - 워크시트
   * @param {number} totalRows - 전체 행 수 (도장 위치 계산용)
   */
  async addCompanyStamp(stampData, worksheet, totalRows) {
    const stampRange = `F${totalRows + 2}:H${totalRows + 5}`;
    
    if (stampData.startsWith('data:image') || stampData.startsWith('/9j/') || stampData.startsWith('iVBORw0KGgo')) {
      const extension = this.getBase64Extension(stampData) || 'png';
      return this.addBase64Image(stampData, extension, stampRange, { worksheet });
    } else if (stampData.startsWith('http')) {
      return await this.addImageFromUrl(stampData, stampRange, { worksheet });
    } else {
      console.warn('지원하지 않는 도장 이미지 형식:', stampData);
      return null;
    }
  }

  // 헬퍼 메서드들
  getColumnIndex(cellRef) {
    const match = cellRef.match(/^([A-Z]+)/);
    if (!match) return 0;
    
    const letters = match[1];
    let result = 0;
    for (let i = 0; i < letters.length; i++) {
      result = result * 26 + (letters.charCodeAt(i) - 64);
    }
    return result - 1;
  }

  getRowIndex(cellRef) {
    const match = cellRef.match(/(\d+)$/);
    return match ? parseInt(match[1]) : 1;
  }

  getImageExtension(url) {
    const match = url.match(/\.([a-z]{3,4})(?:\?|$)/i);
    return match ? match[1] : null;
  }

  getBase64Extension(base64) {
    if (base64.startsWith('data:image/')) {
      const match = base64.match(/data:image\/([a-z]+);base64,/i);
      return match ? match[1] : null;
    }
    // Base64 시그니처로 판단
    if (base64.startsWith('/9j/')) return 'jpg';
    if (base64.startsWith('iVBORw0KGgo')) return 'png';
    if (base64.startsWith('R0lGODlh')) return 'gif';
    return 'png'; // 기본값
  }
}