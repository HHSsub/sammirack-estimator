import React, { createContext, useState, useEffect, useContext } from 'react';

// BOM 계산 로직과 이름 변환 유틸리티를 별도 파일에서 가져옵니다.
import { calculateBOM } from '../utils/bomCalculator';
import { getKoreanName } from '../utils/nameMap';

const ProductContext = createContext();

export const ProductProvider = ({ children }) => {
  const [products, setProducts] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // 사용자 선택 상태
  const [productType, setProductType] = useState(''); // 예: '스텐랙'
  const [options, setOptions] = useState({
    size: '',
    height: '',
    level: '',
    color: '', // 하이랙용
  });

  // 계산 결과 상태
  const [price, setPrice] = useState(0);
  const [bom, setBom] = useState([]); // 부품 목록 (Bill of Materials)

  // 데이터 로딩
  useEffect(() => {
    fetch('/sammirack-estimator/data.json')
      .then(res => {
        if (!res.ok) throw new Error('데이터 파일을 불러오는 데 실패했습니다.');
        return res.json();
      })
      .then(data => {
        setProducts(data);
        setLoading(false);
      })
      .catch(err => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  // 옵션이 변경될 때마다 가격과 BOM을 다시 계산하는 핵심 로직
  useEffect(() => {
    if (!products || !productType) {
      setPrice(0);
      setBom([]);
      return;
    }

    const productData = products[productType];
    if (!productData) return;

    // 1. 가격 계산
    try {
      const basePrice = productData.기본가격?.[options.size]?.[options.height]?.[options.level];
      setPrice(basePrice || 0);
    } catch (e) {
      setPrice(0);
    }

    // 2. BOM (부품 목록) 계산
    const newBom = calculateBOM(productType, options);
    setBom(newBom);

  }, [products, productType, options]);

  // Context를 통해 하위 컴포넌트에 전달할 값들
  const value = {
    loading,
    error,
    products,
    productType,
    setProductType,
    options,
    setOptions,
    price,
    bom,
    getKoreanName, // 이름 변환 함수도 함께 전달
  };

  return (
    <ProductContext.Provider value={value}>{children}</ProductContext.Provider>
  );
};

// 다른 컴포넌트에서 Context를 쉽게 사용하기 위한 훅
export const useProducts = () => {
  const context = useContext(ProductContext);
  if (!context) {
    throw new Error('useProducts는 반드시 ProductProvider 안에서 사용해야 합니다.');
  }
  return context;
};
