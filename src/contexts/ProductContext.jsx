import React, { createContext, useState, useEffect, useContext } from 'react';
import { BOMCalculator } from '../utils/BOMCalculator';
import { applyRateToPrice } from '../utils/priceUtils';

const ProductContext = createContext();
const bomCalculator = new BOMCalculator();

export const ProductProvider = ({ children }) => {
  const [productsData, setProductsData] = useState(null);
  const [loading, setLoading] = useState(true);

  const [cart, setCart] = useState([]);

  // selections 상태. version은 스텐랙 고정 '기본형 V1', 외부 노출 UI 없음
  const [selections, setSelectionsRaw] = useState({
    type: '',
    version: '', // 내부에서 강제 세팅
    color: '',
    size: '',
    height: '',
    level: '',
    quantity: 1,
    applyRate: 100,
    customPrice: null,
  });

  // selections setter 래퍼: 스텐랙 선택 시 version 자동 고정
  const setSelections = (updater) => {
    setSelectionsRaw(prev => {
      const updated = typeof updater === 'function' ? updater(prev) : updater;
      if (updated.type === '스텐랙') {
        return { ...updated, version: '기본형 V1' };
      }
      return { ...updated, version: '' };
    });
  };

  const [currentPrice, setCurrentPrice] = useState(0);
  const [currentBom, setCurrentBom] = useState([]);

  // 데이터 로드
  useEffect(() => {
    fetch('/sammirack-estimator/data.json')
      .then(res => res.json())
      .then(data => {
        setProductsData(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  // JSON 내 선택 옵션 존재 판단
  const isOptionInJson = () => {
    if (!productsData) return false;
    try {
      const { type, version, color, size, height, level } = selections;
      const product = productsData[type];
      if (!product) return false;

      if (type === '스텐랙') {
        return (
          version &&
          product.버전 &&
          product.버전[version] &&
          product.기본가격 &&
          product.기본가격[size] &&
          product.기본가격[size][height] &&
          product.기본가격[size][height][level] !== undefined
        );
      }
      if (type === '하이랙') {
        return (
          color &&
          product.기본가격 &&
          product.기본가격[color] &&
          product.기본가격[color][size] &&
          product.기본가격[color][size][height] &&
          product.기본가격[color][size][height][level] !== undefined
        );
      }
    } catch {
      return false;
    }
    return false;
  };

  // 가격 및 BOM 계산
  useEffect(() => {
    if (!productsData) return;

    const { type, version, color, size, height, level, quantity, applyRate, customPrice } = selections;
    const product = productsData[type];

    let unitPrice = 0;

    if (customPrice !== null && customPrice !== undefined) {
      unitPrice = Number(customPrice);
    } else {
      try {
        if (type === '스텐랙' && version && size && height && level) {
          const basePrice = product.기본가격[size][height][level];
          const versionPrice = product.버전[version]?.기본가 || 0;
          unitPrice = basePrice + versionPrice;
        } else if (type === '하이랙' && color && size && height && level) {
          unitPrice = product.기본가격[color][size][height][level];
        }
      } catch {
        unitPrice = 0;
      }
    }

    const adjustedUnitPrice = applyRateToPrice(unitPrice, applyRate || 100);
    setCurrentPrice(adjustedUnitPrice * (quantity || 1));
    setCurrentBom(bomCalculator.calculateBOM(type, selections, quantity || 1));
  }, [productsData, selections]);

  // 장바구니 추가
  const addToCart = () => {
    if (currentPrice <= 0) {
      alert("가격을 계산할 수 없는 항목은 추가할 수 없습니다.");
      return;
    }

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
        return `스텐랙 - ${size}x${height} / ${level} / ${version}`;
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

    setCart(prev => [...prev, newItem]);
  };

  // 장바구니 항목 삭제
  const removeFromCart = (id) => {
    setCart(prev => prev.filter(item => item.id !== id));
  };

  // 장바구니 초기화
  const clearCart = () => setCart([]);

  // 장바구니 총합 계산
  const cartTotal = cart.reduce((sum, item) => sum + item.price, 0);

  // OptionSelector에 공급할 옵션 목록 생성 (JSON 옵션만 사용)
  const getAvailableOptions = () => {
    if (!productsData) return {
      versions: [],
      colors: [],
      sizes: [],
      heights: [],
      levels: []
    };

    const { type, color, size, height } = selections;
    const product = productsData[type];
    const options = {
      versions: type === '스텐랙' && product?.버전 ? Object.keys(product.버전) : [],
      colors: type === '하이랙' && product?.색상 ? product.색상 : [],
      sizes: [],
      heights: [],
      levels: []
    };

    if (type === '스텐랙' && product?.기본가격) {
      options.sizes = Object.keys(product.기본가격);
      if (size && product.기본가격[size]) {
        options.heights = Object.keys(product.기본가격[size]);
        if (height && product.기본가격[size][height]) {
          options.levels = Object.keys(product.기본가격[size][height]);
        }
      }
    }

    if (type === '하이랙' && color && product?.기본가격 && product.기본가격[color]) {
      options.sizes = Object.keys(product.기본가격[color]);
      if (size && product.기본가격[color][size]) {
        options.heights = Object.keys(product.기본가격[color][size]);
        if (height && product.기본가격[color][size][height]) {
          options.levels = Object.keys(product.기본가격[color][size][height]);
        }
      }
    }

    return options;
  };

  const availableOptions = getAvailableOptions();

  // JSON에 없는 옵션 선택 및 필수값 선택 완료 여부 판단
  const isCustomPriceMode = !isOptionInJson()
    && selections.type !== ''
    && ((selections.type === '스텐랙' && selections.version === '기본형 V1')
        || selections.type === '하이랙')
    && selections.size !== ''
    && selections.height !== ''
    && selections.level !== '';

  return (
    <ProductContext.Provider
      value={{
        loading,
        productsData,
        selections,
        setSelections,
        availableOptions,
        currentPrice,
        currentBom,
        cart,
        addToCart,
        removeFromCart,
        clearCart,
        cartTotal,
        isCustomPriceMode,
      }}
    >
      {children}
    </ProductContext.Provider>
  );
};

export const useProducts = () => useContext(ProductContext);
