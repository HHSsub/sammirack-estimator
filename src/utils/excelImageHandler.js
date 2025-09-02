// 도장 이미지를 엑셀에 추가하는 함수
export const addImageToWorkbook = async (workbook, worksheet, cellRef = 'H7') => {
  try {
    // public/images/도장.png 이미지 로드
    const imageUrl = `${import.meta.env.BASE_URL}images/도장.png`;
    
    // 이미지를 base64로 변환
    const imageBase64 = await loadImageAsBase64(imageUrl);
    
    if (imageBase64) {
      // 이미지 정보 객체 생성
      const imageInfo = {
        name: '도장',
        data: imageBase64,
        type: 'image',
        position: {
          type: 'twoCellAnchor',
          from: parseCell(cellRef),
          to: { col: parseCell(cellRef).col + 1, row: parseCell(cellRef).row + 2 }
        }
      };
      
      // 워크시트에 이미지 추가
      if (!worksheet['!images']) {
        worksheet['!images'] = [];
      }
      worksheet['!images'].push(imageInfo);
      
      console.log('도장 이미지가 성공적으로 추가되었습니다.');
    }
  } catch (error) {
    console.warn('이미지 추가 중 오류:', error);
    // 이미지 추가 실패해도 엑셀 생성은 계속 진행
  }
};

// 이미지를 Base64로 변환하는 함수
const loadImageAsBase64 = async (imageUrl) => {
  try {
    const axios = require('axios');
    const response = await axios.get(imageUrl, { responseType: 'arraybuffer' });
    const base64 = Buffer.from(response.data, 'binary').toString('base64');
    return base64;
  } catch (error) {
    console.warn('이미지 로드 실패:', error);
    return null;
  }
};

// 셀 참조를 행/열 객체로 변환
const parseCell = (cellRef) => {
  const match = cellRef.match(/([A-Z]+)(\d+)/);
  if (!match) return { col: 0, row: 0 };
  
  const colStr = match[1];
  const rowNum = parseInt(match[2]) - 1;
  
  // 컬럼 문자를 숫자로 변환
  let colNum = 0;
  for (let i = 0; i < colStr.length; i++) {
    colNum = colNum * 26 + (colStr.charCodeAt(i) - 64);
  }
  colNum--; // 0 기반 인덱스로 변환
  
  return { col: colNum, row: rowNum };
};

// 이미지 크기 조정 함수
export const resizeImage = (canvas, maxWidth = 100, maxHeight = 50) => {
  const ctx = canvas.getContext('2d');
  const { width, height } = canvas;
  
  // 비율 계산
  const ratio = Math.min(maxWidth / width, maxHeight / height);
  const newWidth = width * ratio;
  const newHeight = height * ratio;
  
  // 새 캔버스 생성
  const newCanvas = document.createElement('canvas');
  const newCtx = newCanvas.getContext('2d');
  
  newCanvas.width = newWidth;
  newCanvas.height = newHeight;
  
  // 이미지 리사이즈
  newCtx.drawImage(canvas, 0, 0, newWidth, newHeight);
  
  return newCanvas;
};

// 이미지 포맷 검증
export const validateImageFormat = (file) => {
  const validTypes = ['image/png', 'image/jpeg', 'image/jpg'];
  return validTypes.includes(file.type);
};

// 이미지 파일을 Base64로 변환
export const convertFileToBase64 = (file) => {
  return new Promise((resolve, reject) => {
    if (!validateImageFormat(file)) {
      reject(new Error('지원되지 않는 이미지 형식입니다.'));
      return;
    }
    
    const reader = new FileReader();
    
    reader.onload = (event) => {
      const base64 = event.target.result.split(',')[1];
      resolve(base64);
    };
    
    reader.onerror = () => {
      reject(new Error('파일 읽기 실패'));
    };
    
    reader.readAsDataURL(file);
  });
};

// 기본 export
export default {
  addImageToWorkbook,
  loadImageAsBase64,
  resizeImage,
  validateImageFormat,
  convertFileToBase64
};
