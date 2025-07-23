import React, { createContext, useState, useEffect, useContext } from 'react';
import { BOMCalculator } from '../utils/BOMCalculator'; // <<< 기존 파일을 import 합니다.
import { getKoreanName } from '../utils/nameMap';

const ProductContext = createContext();
const bomCalculator = new BOMCalculator(); // 클래스 인스턴스를 생성합니다.

export const ProductProvider = ({ children }) => {
  const [products, setProducts] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [productType, setProductType] = useState('');
  const [options, setOptions] = useState({
    size: '',
    height: '',
    level: '',
    color: '',
  });

  const [price, setPrice] = useState(0);
  const [bom, setBom] = useState([]);

  useEffect(() => {
    fetch('/sammirack-estimator/data.json')
      .then(res => res.json())
      .then(data => {
        // BOMCalculator 클래스가 data.json에 접근할 수 있도록 데이터를 주입합니다.
        // (BOMCalculator 클래스 수정이 필요할 수 있음)
        bomCalculator.setData(data); 
        setProducts(data);
        setLoading(false);
      })
      .catch(err => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    if (!products || !productType || !options.size || !options.level) {
      setPrice(0);
      setBom([]);
      return;
    }

    // 1. 가격 계산 (이 부분은 data.json을 직접 참조)
    try {
      const basePrice = products[productType]?.기본가격?.[options.size]?.[options.height]?.[options.level] || 0;
      setPrice(basePrice);
    } catch (e) {
      setPrice(0);
    }

    // 2. BOM 계산 (기존 BOMCalculator 활용)
    // BOMCalculator의 메소드가 요구하는 파라미터 형식에 맞게 데이터를 구성합니다.
    const productForBOM = {
      type: productType,
      levels: options.level,
      color: options.color,
      dimensions: {
        width: options.size.split('x')[0],
        length: options.size.split('x')[1],
        height: options.height,
      },
      // 추가 옵션들...
    };
    
    try {
      const newBom = bomCalculator.calculateBOM(productForBOM);
      setBom(newBom);
    } catch (err) {
      console.error("BOM 계산 중 에러:", err);
      setBom([]);
    }

  }, [products, productType, options]);

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
    getKoreanName,
  };

  return (
    <ProductContext.Provider value={value}>{children}</ProductContext.Provider>
  );
};

export const useProducts = () => useContext(ProductContext);
