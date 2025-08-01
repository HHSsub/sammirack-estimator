import React, { createContext, useState, useEffect, useContext } from 'react';
import { BOMCalculator } from '../utils/BOMCalculator';
import { applyRateToPrice } from '../utils/priceUtils';

const ProductContext = createContext();
const bomCalculator = new BOMCalculator();

// OptionSelector에서 사용하는 옵션 목록 상수 포함 (중복 관리 가능)
const STAINLESS_VERSIONS = ['기본형 V1', '기본형 V2', '기본형 V3'];
const STAINLESS_SIZES = ['50x75', '50x90', '50x120', '50x150', '50x180'];
const STAINLESS_HEIGHTS = ['75', '90', '120', '150', '180', '200', '210'];
const STAINLESS_LEVELS = ['1단', '2단', '3단', '4단', '5단', '6단'];

const HIGHRACK_COLORS = [
  "메트그레이(볼트식)200kg",
  "메트그레이(볼트식)350kg",
  "블루(기둥)+오렌지(가로대)(볼트식)200kg",
  "블루(기둥)+오렌지(가로대)(볼트식)350kg",
  "블루(기둥.선반)+오렌지(빔)700kg"
];
const HIGHRACK_SIZES = ['45x108', '45x150', '60x108', '60x150', '80x146', '80x210'];
const HIGHRACK_HEIGHTS = ['150', '200', '250'];
const HIGHRACK_LEVELS = ['5단', '6단', '7단'];

export const ProductProvider = ({ children }) => {
  const [productsData, setProductsData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [cart, setCart] = useState([]);

  // 기본 selections 상태
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

  // 데이터 로드
  useEffect(() => {
    fetch('/sammirack-estimator/data.json')
      .then(res => res.json())
      .then(data => { setProductsData(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  // 옵션이 JSON에 존재하는지 확인 (타입에 따라 분기)
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

  // 가격 계산 및 BOM 계산 useEffect
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

  // 장바구니 추가 처리
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
    } else {
      alert("가격을 계산할 수 없는 항목은 추가할 수 없습니다.");
    }
  };

  const removeFromCart = (id) => {
    setCart(prev => prev.filter(item => item.id !== id));
  };

  const clearCart = () => setCart([]);

  const cartTotal = cart.reduce((sum, item) => sum + item.price, 0);

  // 옵션 목록 반환 (UI용)
  const getAvailableOptions = () => ({
    versions: STAINLESS_VERSIONS,
    colors: HIGHRACK_COLORS,
    sizes: selections.type === '스텐랙' ? STAINLESS_SIZES : selections.type === '하이랙' ? HIGHRACK_SIZES : [],
    heights: selections.type === '스텐랙' ? STAINLESS_HEIGHTS : selections.type === '하이랙' ? HIGHRACK_HEIGHTS : [],
    levels: selections.type === '스텐랙' ? STAINLESS_LEVELS : selections.type === '하이랙' ? HIGHRACK_LEVELS : [],
  });

  // JSON 옵션에 없는 조합이며, 주요 필수 옵션 모두 선택됐을 때 true (직접 가격 입력 필드 표시용)
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
