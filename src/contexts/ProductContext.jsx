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
    type: '',
    version: '',
    color: '',
    size: '',
    height: '',
    level: '',
    quantity: 1,
    applyRate: 100,
    customPrice: null,
  });

  const [currentPrice, setCurrentPrice] = useState(0);
  const [currentBom, setCurrentBom] = useState([]);

  useEffect(() => {
    fetch('/sammirack-estimator/data.json')
      .then(res => res.json())
      .then(data => { setProductsData(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  // 현재 selections 조합이 JSON에 존재하는지 체크 함수
  const isOptionInJson = () => {
    if (!productsData) return false;
    try {
      const { type, version, color, size, height, level } = selections;
      const product = productsData[type];
      if (!product) return false;

      if (type === '스텐랙') {
        if (
          version &&
          product.버전 &&
          product.버전[version] &&
          product.기본가격 &&
          product.기본가격[size] &&
          product.기본가격[size][height] &&
          product.기본가격[size][height][level] !== undefined
        ) return true;
      } else if (type === '하이랙') {
        if (
          color &&
          product.기본가격 &&
          product.기본가격[color] &&
          product.기본가격[color][size] &&
          product.기본가격[color][size][height] &&
          product.기본가격[color][size][height][level] !== undefined
        ) return true;
      }
    } catch {
      return false;
    }
    return false;
  };

  // 가격 계산 useEffect
  useEffect(() => {
    if (!productsData) return;

    const { type, version, color, size, height, level, quantity, applyRate, customPrice } = selections;
    const product = productsData[type];

    let baseUnitPrice = 0;

    if (customPrice !== null && customPrice !== undefined) {
      baseUnitPrice = Number(customPrice);
    } else {
      try {
        if (type === '스텐랙' && version && size && height && level) {
          const basePrice = product.기본가격[size][height][level];
          const versionPrice = product.버전[version]?.기본가 || 0;
          baseUnitPrice = basePrice + versionPrice;
        } else if (type === '하이랙' && color && size && height && level) {
          baseUnitPrice = product.기본가격[color][size][height][level];
        }
      } catch {
        baseUnitPrice = 0;
      }
    }

    const adjustedUnitPrice = applyRateToPrice(baseUnitPrice, applyRate || 100);
    setCurrentPrice(adjustedUnitPrice * (quantity || 1));

    // BOM 계산
    setCurrentBom(bomCalculator.calculateBOM(type, selections, quantity || 1));
  }, [productsData, selections]);

  const addToCart = () => {
    if (currentPrice > 0) {
      const { type, version, color, size, height, level, quantity, applyRate, customPrice } = selections;
      const product = productsData[type];

      let originalUnitPrice = 0;

      if (customPrice !== null && customPrice !== undefined) {
        originalUnitPrice = Number(customPrice);
      } else {
        try {
          if (type === '스텐랙' && version && size && height && level) {
            const basePrice = product.기본가격[size][height][level];
            const versionPrice = product.버전[version]?.기본가 || 0;
            originalUnitPrice = basePrice + versionPrice;
          } else if (type === '하이랙' && color && size && height && level) {
            originalUnitPrice = product.기본가격[color][size][height][level];
          }
        } catch {
          originalUnitPrice = 0;
        }
      }

      const displayName = (() => {
        if (type === '스텐랙') {
          return `스텐랙 - ${size}x${height} / ${level}`;
        }
        if (type === '하이랙') {
          return `하이랙 (${color}) - ${size} / ${height} / ${level}단`;
        }
        return type;
      })();

      const newItem = {
        id: Date.now(),
        selections,
        displayName,
        price: currentPrice,
        originalPrice: originalUnitPrice * (quantity || 1),
        unitPrice: applyRateToPrice(originalUnitPrice, applyRate || 100),
        originalUnitPrice,
        applyRate: applyRate || 100,
        bom: currentBom,
      };

      setCart(prevCart => [...prevCart, newItem]);
    } else {
      alert("가격을 계산할 수 없는 항목은 추가할 수 없습니다.");
    }
  };

  const removeFromCart = (id) => {
    setCart(prev => prev.filter(item => item.id !== id));
  };

  const clearCart = () => setCart([]);

  const cartTotal = cart.reduce((sum, item) => sum + item.price, 0);

  // 전체 옵션 리스트 반환 (JSON 의존성 탈피)
  const getAvailableOptions = () => {
    const vs = productsData?.['스텐랙']?.버전 ? Object.keys(productsData['스텐랙'].버전) : [];
    const cs = productsData?.['하이랙']?.색상 || [];
    const ss = ALL_SIZES;
    const hs = ALL_HEIGHTS;
    const ls = ALL_LEVELS;

    return { versions: vs, colors: cs.length > 0 ? cs : ALL_COLORS, sizes: ss, heights: hs, levels: ls };
  };

  // JSON 내 옵션이 없고, 필요한 선택값 다 있으면 true (직접 입력 가격란 노출용)
  const isCustomPriceMode = !isOptionInJson() &&
    selections.type !== '' &&
    ((selections.type === '스텐랙' && selections.version !== '') || selections.type === '하이랙') &&
    selections.size !== '' &&
    selections.height !== '' &&
    selections.level !== '';

  return (
    <ProductContext.Provider
      value={{
        loading,
        productsData,
        selections,
        setSelections,
        availableOptions: getAvailableOptions(),
        currentPrice,
        currentBom,
        cart,
        addToCart,
        removeFromCart,
        clearCart,
        cartTotal,
        isCustomPriceMode
      }}
    >
      {children}
    </ProductContext.Provider>
  );
};

export const useProducts = () => useContext(ProductContext);
