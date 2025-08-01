import React, { createContext, useState, useEffect, useContext } from 'react';
import { BOMCalculator } from '../utils/BOMCalculator';
import { applyRateToPrice } from '../utils/priceUtils';

const ProductContext = createContext();
const bomCalculator = new BOMCalculator();

// 추가 옵션은 JSON 옵션에 없는 "직접 선택 가능" 항목들 (중복 자동 제거됨)
const EXTRA_OPTIONS = {
  스텐랙: {
    sizes: ["50x210"],
    heights: ["210"],
    levels: ["5단", "6단"]
  },
  하이랙: {
    sizes: ["45x150", "80x108"],
    heights: ["250"],
    levels: ["5단", "6단"]
  }
};

export const ProductProvider = ({ children }) => {
  const [productsData, setProductsData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [cart, setCart] = useState([]);

  const [selections, setSelectionsRaw] = useState({
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

  // selections setter: 스텐랙은 version 무조건 '기본형 V1' 고정
  const setSelections = (updater) => {
    setSelectionsRaw(prev => {
      const updated = typeof updater === 'function' ? updater(prev) : updater;
      if (updated.type === '스텐랙') {
        return { ...updated, version: '기본형 V1' };
      } else {
        return { ...updated, version: '' };
      }
    });
  };

  const [currentPrice, setCurrentPrice] = useState(0);
  const [currentBom, setCurrentBom] = useState([]);

  useEffect(() => {
    fetch('/sammirack-estimator/data.json')
      .then(res => res.json())
      .then(data => { setProductsData(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  // JSON 옵션 + EXTRA_OPTIONS 병합하여 중복 제거하고 반환
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
    let opt = {
      versions: [],
      colors: [],
      sizes: [],
      heights: [],
      levels: [],
    };

    if (type === '스텐랙' && product?.기본가격) {
      opt.sizes = Object.keys(product.기본가격);
      if (size && product.기본가격[size]) {
        opt.heights = Object.keys(product.기본가격[size]);
        if (height && product.기본가격[size][height]) {
          opt.levels = Object.keys(product.기본가격[size][height]);
        }
      }
      if (product?.버전) {
        opt.versions = Object.keys(product.버전);
      }
    }

    if (type === '하이랙' && color && product?.기본가격 && product.기본가격[color]) {
      opt.sizes = Object.keys(product.기본가격[color]);
      if (size && product.기본가격[color][size]) {
        opt.heights = Object.keys(product.기본가격[color][size]);
        if (height && product.기본가격[color][size][height]) {
          opt.levels = Object.keys(product.기본가격[color][size][height]);
        }
      }
    }

    if (type === '하이랙' && product?.색상) {
      opt.colors = product.색상;
    }

    // 병합 함수 (중복제거)
    const uniq = (list) => [...new Set(list)];

    if (EXTRA_OPTIONS[type]) {
      opt.sizes = uniq([...(opt.sizes ?? []), ...EXTRA_OPTIONS[type].sizes]);
      opt.heights = uniq([...(opt.heights ?? []), ...EXTRA_OPTIONS[type].heights]);
      opt.levels = uniq([...(opt.levels ?? []), ...EXTRA_OPTIONS[type].levels]);
    }

    return opt;
  };

  const availableOptions = getAvailableOptions();

  // 선택한 조합이 JSON에 있는지 판단 (가격 조회 가능 여부)
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

  // 가격 계산 및 BOM 계산
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

  // 장바구니 관련 함수
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

  const removeFromCart = (id) => setCart(prev => prev.filter(item => item.id !== id));
  const clearCart = () => setCart([]);
  const cartTotal = cart.reduce((acc, item) => acc + item.price, 0);

  // 직접 가격 입력란 노출 여부
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
        isCustomPriceMode
      }}
    >
      {children}
    </ProductContext.Provider>
  );
};

export const useProducts = () => useContext(ProductContext);
