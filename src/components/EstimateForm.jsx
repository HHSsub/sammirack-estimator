import { formatEstimateData, navigateToPrintPage, checkPrintSupport } from '../utils/printUtils';

const EstimateForm = () => {
  // ... 기존 코드 ...

  const handlePrint = async () => {
    try {
      // 프린트 지원 확인
      if (!checkPrintSupport()) {
        alert('현재 브라우저에서는 프린트 기능을 지원하지 않습니다.');
        return;
      }

      // 필수 데이터 검증
      if (!cart || cart.length === 0) {
        alert('프린트할 항목이 없습니다.');
        return;
      }

      // 로딩 상태 표시
      setIsLoading(true);

      const printData = formatEstimateData(formData, cart, cartTotal);
      navigateToPrintPage('gyeonjuk', printData, navigate);
    } catch (error) {
      console.error('프린트 준비 오류:', error);
      alert('프린트 준비 중 오류가 발생했습니다. 다시 시도해주세요.');
    } finally {
      setIsLoading(false);
    }
  };

  // ... 기존 코드 ...
};
