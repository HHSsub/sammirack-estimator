// 이미지 처리 유틸리티 (로고, 도장 등)

export class ExcelImageHandler {
  constructor(workbook) {
    this.workbook = workbook;
  }

  /**
   * Base64 이미지를 Excel에 추가
   * @param {string} base64Data - Base64 인코딩된 이미지 데이터
   * @param {string} extension - 이미지 확장자 (png, jpg, jpeg)
   * @param {string} range - 이미지를 삽입할 셀 범위 ('A1:C3')
   * @param {object} options - 추가 옵션
   */
  addBase64Image(base64Data, extension, range, options = {}) {
    try {
      // Base64 데이터에서 헤더 제거
      const cleanBase64 = base64Data.replace(/^data:image\/[a-z]+;base64,/, '');
      
      const imageId = this.workbook.addImage({
        base64: cleanBase64,
        extension: extension.toLowerCase()
      });

      const worksheet = options.worksheet || this.workbook.worksheets[0];
      
      worksheet.addImage(imageId, {
        tl: { col: this.getColumnIndex(range.split(':')[0]), row: this.getRowIndex(range.split(':')[0]) - 1 },
        br: { col: this.getColumnIndex(range.split(':')[1]), row: this.getRowIndex(range.split(':')[1]) - 1 },
        editAs: 'oneCell'
      });
    } catch (error) {
      console.error('Base64 이미지 추가 실패:', error);
    }
  }

  /**
   * URL에서 이미지를 가져와서 Excel에 추가
   * @param {string} imageUrl - 이미지 URL
   * @param {string} range - 이미지를 삽입할 셀 범위
   * @param {object} options - 추가 옵션
   */
  async addImageFromUrl(imageUrl, range, options = {}) {
    return new Promise((resolve, reject) => {
      try {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        
        img.onload = () => {
          try {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            canvas.width = img.width;
            canvas.height = img.height;
            ctx.drawImage(img, 0, 0);
            
            const base64Data = canvas.toDataURL('image/png');
            this.addBase64Image(base64Data, 'png', range, options);
            resolve();
          } catch (error) {
            console.error('이미지 처리 실패:', error);
            reject(error);
          }
        };
        
        img.onerror = () => {
          console.error('이미지 로드 실패:', imageUrl);
          reject(new Error('이미지 로드 실패'));
        };
        
        img.src = imageUrl;
      } catch (error) {
        console.error('이미지 URL 처리 실패:', error);
        reject(error);
      }
    });
  }

  /**
   * 견적서용 회사 로고 추가
   * @param {object} worksheet - 워크시트 객체
   * @param {string} range - 로고를 삽입할 셀 범위
   */
  async addEstimateCompanyLogo(worksheet, range) {
    try {
      // 회사 로고 이미지 경로 (public/images/logo.png 등)
      const logoPath = '/images/logo.png';
      await this.addImageFromUrl(logoPath, range, { worksheet });
    } catch (error) {
      console.warn('견적서 로고 추가 실패:', error);
      // 로고 추가 실패 시 무시하고 계속 진행
    }
  }

  /**
   * 발주서용 회사 로고 추가
   * @param {object} worksheet - 워크시트 객체
   * @param {string} range - 로고를 삽입할 셀 범위
   */
  async addPurchaseOrderCompanyLogo(worksheet, range) {
    try {
      // 회사 로고 이미지 경로
      const logoPath = '/images/logo.png';
      await this.addImageFromUrl(logoPath, range, { worksheet });
    } catch (error) {
      console.warn('발주서 로고 추가 실패:', error);
      // 로고 추가 실패 시 무시하고 계속 진행
    }
  }

  /**
   * 일반 회사 로고 추가
   * @param {object} worksheet - 워크시트 객체
   * @param {string} range - 로고를 삽입할 셀 범위
   */
  async addCompanyLogo(worksheet, range) {
    try {
      // 회사 로고 이미지 경로
      const logoPath = '/images/logo.png';
      await this.addImageFromUrl(logoPath, range, { worksheet });
    } catch (error) {
      console.warn('회사 로고 추가 실패:', error);
      // 로고 추가 실패 시 무시하고 계속 진행
    }
  }

  /**
   * 회사 도장 추가
   * @param {object} worksheet - 워크시트 객체
   * @param {string} range - 도장을 삽입할 셀 범위
   */
  async addCompanyStamp(worksheet, range) {
    try {
      // 도장 이미지 경로 - public/images/도장.png
      const stampPath = '/images/도장.png';
      await this.addImageFromUrl(stampPath, range, { worksheet });
    } catch (error) {
      console.warn('회사 도장 추가 실패:', error);
      // 도장 추가 실패 시에도 계속 진행
      
      // 대안: Base64로 인코딩된 기본 도장 이미지 사용
      try {
        await this.addDefaultStamp(worksheet, range);
      } catch (fallbackError) {
        console.warn('기본 도장 추가도 실패:', fallbackError);
      }
    }
  }

  /**
   * 기본 도장 이미지 추가 (Base64 인코딩된 이미지)
   * @param {object} worksheet - 워크시트 객체
   * @param {string} range - 도장을 삽입할 셀 범위
   */
  async addDefaultStamp(worksheet, range) {
    try {
      // 기본 도장 이미지 (작은 원형 도장 모양의 Base64 데이터)
      // 실제 프로젝트에서는 실제 도장 이미지를 Base64로 변환하여 사용
      const defaultStampBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
      
      this.addBase64Image(defaultStampBase64, 'png', range, { worksheet });
    } catch (error) {
      console.error('기본 도장 추가 실패:', error);
    }
  }

  /**
   * 컬럼 문자를 인덱스로 변환 (A=0, B=1, ...)
   * @param {string} range - 셀 범위 (예: 'A1')
   * @returns {number} 컬럼 인덱스
   */
  getColumnIndex(range) {
    const col = range.match(/[A-Z]+/)[0];
    let result = 0;
    for (let i = 0; i < col.length; i++) {
      result = result * 26 + (col.charCodeAt(i) - 'A'.charCodeAt(0) + 1);
    }
    return result - 1;
  }

  /**
   * 행 번호를 인덱스로 변환
   * @param {string} range - 셀 범위 (예: 'A1')
   * @returns {number} 행 인덱스
   */
  getRowIndex(range) {
    const row = range.match(/\d+/)[0];
    return parseInt(row);
  }

  /**
   * 이미지 확장자 추출
   * @param {string} filename - 파일명
   * @returns {string} 확장자
   */
  getImageExtension(filename) {
    const ext = filename.split('.').pop().toLowerCase();
    return ['png', 'jpg', 'jpeg', 'gif'].includes(ext) ? ext : 'png';
  }

  /**
   * Base64 데이터에서 확장자 추출
   * @param {string} base64Data - Base64 데이터
   * @returns {string} 확장자
   */
  getBase64Extension(base64Data) {
    if (base64Data.startsWith('data:image/png')) return 'png';
    if (base64Data.startsWith('data:image/jpg') || base64Data.startsWith('data:image/jpeg')) return 'jpg';
    if (base64Data.startsWith('data:image/gif')) return 'gif';
    return 'png'; // 기본값
  }
}
