import React, { createContext, useState, useEffect, useContext } from 'react';
import { BOMCalculator } from '../utils/BOMCalculator';
import { getKoreanName } from '../utils/nameMap';

const ProductContext = createContext();
const bomCalculator = new BOMCalculator();

export const ProductProvider = ({ children }) => {
  const [products, setProducts] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [productType, setProductType] = useState('');
  const [options, setOptions] = useState({
    size: '',
    height: '',
    level: '',
    color: '', // 하이랙의 '색상'은 단순 색이 아닌 '타입'을 의미
  });

  const [price, setPrice] = useState(0);
  const [bom, setBom] = useState([]);

  useEffect(() => {
    fetch('/sammirack-estimator/data.json')
      .then(res => res.json())
      .then(data => {
        setProducts(data);
        setLoading(false);
      })
      .catch(err => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  // 가격 및 BOM 계산 로직
  useEffect(() => {
    if (!products || !productType) {
      setPrice(0);
      setBom([]);
      return;
    }

    const productData = products[productType];
    if (!productData) return;

    // 1. 가격 계산
    let calculatedPrice = 0;
    try {
      if (productType === '스텐랙') {
        if (options.size && options.height && options.level) {
          calculatedPrice = productData.기본가격[options.size][options.height][options.level] || 0;
        }
      } else if (productType === '하이랙') {
        // 하이랙은 'color' 옵션(타입)이 가격 구조의 상위 키
        if (options.color && options.size && options.height && options.level) {
          calculatedPrice = productData.기본가격[options.color][options.size][options.height][options.level] || 0;
        }
      }
    } catch (e) {
      calculatedPrice = 0; // 옵션 선택 중 경로가 유효하지 않으면 0으로 처리
    }
    setPrice(calculatedPrice);

    // 2. BOM 계산
    const newBom = bomCalculator.calculateBOM(productType, options);
    setBom(newBom);

  }, [products, productType, options]);

  const value = {
    loading, error, products,
    productType, setProductType,
    options, setOptions,
    price, bom, getKoreanName,
  };

  return (
    <ProductContext.Provider value={value}>{children}</ProductContext.Provider>
  );
};

export const useProducts = () => useContext(ProductContext);
