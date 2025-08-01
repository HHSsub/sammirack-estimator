import React, { createContext, useState, useEffect, useContext } from 'react';
import { BOMCalculator } from '../utils/BOMCalculator';
import { applyRateToPrice } from '../utils/priceUtils';

const ProductContext = createContext();
const bomCalculator = new BOMCalculator();

export const ProductProvider = ({ children }) => {
  // 실제 옵션 배열을 여기 파일 내부에 직접 선언 (외부 분리 없이)
  const STAINLESS_VERSIONS = ['기본형 V1']; // 고정값. 선택 UI에서 아예 안보임.
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

  const [productsData, setProductsData] = useState(null);
  const [loading, setLoading] = useState(true);

  const [cart, setCart] = useState([]);

  // 초기 selections, version은 스텐랙이면 고정, 하이랙이면 빈문자열
  const [selections, setSelectionsRaw] = useState({
    type: '',
    version: '', // 스텐랙이면 아래에서 강제 세팅 될 것임
    color: '',
    size: '',
    height: '',
    level: '',
    quantity: 1,
    applyRate: 100,
    customPrice: null,
  });

  // selections를 강제로 조작하여 스텐랙일 경우 version 강제 고정
  const setSelections = (updater) => {
    setSelectionsRaw(prev => {
      const updated = typeof updater === 'function' ? updater(prev) : updater;

      if (updated.type === '스텐랙') {
        return { ...updated, version: '기본형 V1' };
      } else {
        // 하이랙이면 version 빈 문자열 유지
        return { ...updated, version: '' };
      }
    });
  };

  const [currentPrice, setCurrentPrice] = useState(0);
  const [currentBom, setCurrentBom] = useState([]);

  // 제품 데이터 로드 (json)
  useEffect(() => {
    fetch('/sammirack-estimator/data.json')
      .then(res => res.json())
      .then(data => {
        setProductsData(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  // 현재 선택 옵션이 JSON 내에 존재하는지 체크하는 함수
  const isOptionInJson = () => {
    if (!productsData) return false;
    try {
      const { type, version, color, size, height, level } = selections;
      const product = productsData[type];
      if (!product) return false;

      if (type === '스텐랙') {
        if (
          version && // 항상 '기본형 V1', 단 여기 체크를 넣어 유지함
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

  // 가격 계산 및 BOM 계산 수행
  useEffect(() => {
    if (!productsData) return;

    const {
      type, version, color,
      size, height, level,
      quantity, applyRate,
      customPrice
    } = selections;

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

  // 장바구니 추가 함수
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

  // 장바구니에서 항목 제거
  const removeFromCart = (id) => setCart(prev => prev.filter(item => item.id !== id));

  // 장바구니 비우기
  const clearCart = () => setCart([]);

  // 장바구니 총액 계산
  const cartTotal = cart.reduce((sum, item) => sum + item.price, 0);

  // OptionSelector에서 쓸 옵션 제공 (상수형, 분기 구분 포함)
  // OptionSelector는 여기서 받아서 활용, 혼동없게 하기 위함
  const availableOptions = {
    versions: STAINLESS_VERSIONS,
    colors: HIGHRACK_COLORS,
    sizes: selections.type === '스텐랙' ? STAINLESS_SIZES
           : selections.type === '하이랙' ? HIGHRACK_SIZES : [],
    heights: selections.type === '스텐랙' ? STAINLESS_HEIGHTS
             : selections.type === '하이랙' ? HIGHRACK_HEIGHTS : [],
    levels: selections.type === '스텐랙' ? STAINLESS_LEVELS
            : selections.type === '하이랙' ? HIGHRACK_LEVELS : [],
  };

  // JSON에 옵션 조합이 없고 중요한 필드가 모두 선택된 경우 직접 가격 입력 필드 활성화용
  const isCustomPriceMode = !isOptionInJson()
    && selections.type !== ''
    && ((selections.type === '스텐랙' && selections.version === '기본형 V1')
      || selections.type === '하이랙')
    && selections.size !== ''
    && selections.height !== ''
    && selections.level !== ''
  ;

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
