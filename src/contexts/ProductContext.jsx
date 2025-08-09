import React, { createContext, useState, useEffect, useContext } from 'react';
import { BOMCalculator } from '../utils/BOMCalculator';
import { applyRateToPrice } from '../utils/priceUtils';

const ProductContext = createContext();
const bomCalculator = new BOMCalculator();

export const ProductProvider = ({ children }) => {
  const [productsData, setProductsData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [cart, setCart] = useState([]);

  const [selections, setSelections] = useState({
    type: '', size: '', height: '', level: '', color: '',
    quantity: 1, applyRate: 100
  });

  const [currentPrice, setCurrentPrice] = useState(0);
  const [currentBom, setCurrentBom] = useState([]);

  // data.json 불러오기
  useEffect(() => {
    fetch('/sammirack-estimator/data.json')
      .then(res => res.json())
      .then(json => {
        setProductsData(json);
        setLoading(false);
      });
  }, []);

  // 가격 & BOM 자동 계산
  useEffect(() => {
    if (!productsData || !selections.type) {
      setCurrentPrice(0);
      setCurrentBom([]);
      return;
    }

    let price = 0;
    let bom = [];

    // 스텐랙 & 하이랙 = 규칙 기반 + BOMCalculator
    if (['스텐랙', '하이랙'].includes(selections.type)) {
      bom = bomCalculator.calculateBOM(selections.type, selections, selections.quantity);
      // 가격 있는 옵션이면 data.json 가격 적용
      if (productsData[selections.type]?.[selections.size]?.[selections.height]?.[selections.level]) {
        price = productsData[selections.type][selections.size][selections.height][selections.level];
      }
    }
    // 그 외 랙 = data.json 가격표 직접 사용
    else {
      const typeData = productsData[selections.type];
      if (typeData && selections.size && selections.height && selections.level) {
        price = typeData[selections.size]?.[selections.height]?.[selections.level] || 0;
      }
    }

    // 수량·적용율 반영
    if (price > 0) {
      price = applyRateToPrice(price * selections.quantity, selections.applyRate);
    }

    setCurrentPrice(price);
    setCurrentBom(bom);

  }, [productsData, selections]);

  // selections 업데이트 함수
  const updateSelection = (field, value) => {
    setSelections(prev => ({
      ...prev,
      [field]: value
    }));
  };

  // 장바구니에 현재 항목 추가
  const addToCart = () => {
    if (currentPrice <= 0) return;
    setCart(prev => [
      ...prev,
      { selections, price: currentPrice, bom: currentBom }
    ]);
  };

  const cartTotal = cart.reduce((sum, item) => sum + item.price, 0);

  return (
    <ProductContext.Provider
      value={{
        productsData, loading,
        selections, updateSelection,
        currentPrice, currentBom,
        addToCart, cart, cartTotal
      }}
    >
      {children}
    </ProductContext.Provider>
  );
};

export const useProducts = () => useContext(ProductContext);
