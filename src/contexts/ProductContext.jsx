import React, { createContext, useState, useEffect, useContext } from "react";
import { BOMCalculator } from "../utils/BOMCalculator";
import { applyRateToPrice } from "../utils/priceUtils";

const ProductContext = createContext();
const bomCalculator = new BOMCalculator();

// EXTRA 옵션 리스트 (JSON 옵션 외 사용자 직접 선택 가능)
const EXTRA_OPTIONS = {
  스텐랙: {
    sizes: ["50x210"],
    heights: ["210"],
    levels: ["2단", "3단", "4단", "5단", "6단"],
  },
  하이랙: {
    sizes: ["45x150", "80x108"],
    heights: ["250"],
    levels: ["2단", "3단", "4단", "5단", "6단"],
  },
};

export const ProductProvider = ({ children }) => {
  const [productsData, setProductsData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [cart, setCart] = useState([]);

  const [selections, setSelectionsRaw] = useState({
    type: "",
    version: "", // 스텐랙 고정 ‘기본형 V1’
    color: "",
    size: "",
    height: "",
    level: "",
    quantity: 1,
    applyRate: 100,
    customPrice: null,
  });

  // selections setter: 스텐랙이면 version 강제 고정
  const setSelections = (updater) => {
    setSelectionsRaw((prev) => {
      const updated = typeof updater === "function" ? updater(prev) : updater;
      if (updated.type === "스텐랙") {
        return { ...updated, version: "기본형 V1" };
      }
      return { ...updated, version: "" };
    });
  };

  const [currentPrice, setCurrentPrice] = useState(0);
  const [currentBom, setCurrentBom] = useState([]);

  useEffect(() => {
    fetch("/sammirack-estimator/data.json")
      .then((res) => res.json())
      .then((data) => {
        setProductsData(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  // JSON 내 옵션만 추출
  const getOptionsFromJson = () => {
    if (!productsData) {
      return {
        versions: [],
        colors: [],
        sizes: [],
        heights: [],
        levels: [],
      };
    }

    const { type, color, size, height } = selections;
    const product = productsData[type];
    let opts = {
      versions: [],
      colors: [],
      sizes: [],
      heights: [],
      levels: [],
    };

    if (type === "스텐랙" && product?.기본가격) {
      opts.sizes = Object.keys(product.기본가격);
      if (size && product.기본가격[size]) {
        opts.heights = Object.keys(product.기본가격[size]);
        if (height && product.기본가격[size][height]) {
          opts.levels = Object.keys(product.기본가격[size][height]);
        }
      }
      opts.versions = product.버전 ? Object.keys(product.버전) : [];
    }

    if (type === "하이랙" && product) {
      opts.colors = product.색상 || [];
      if (color && product.기본가격 && product.기본가격[color]) {
        opts.sizes = Object.keys(product.기본가격[color]);
        if (size && product.기본가격[color][size]) {
          opts.heights = Object.keys(product.기본가격[color][size]);
          if (height && product.기본가격[color][size][height]) {
            opts.levels = Object.keys(product.기본가격[color][size][height]);
          }
        }
      }
    }
    return opts;
  };

  // 옵션 병합 및 중복 제거
  const mergeOptions = (baseOpts, extraOpts) => {
    const uniq = (arr) => [...new Set(arr.filter(Boolean))];
    return {
      versions: uniq([...(baseOpts.versions || []), ...(extraOpts.versions || [])]),
      colors: uniq([...(baseOpts.colors || []), ...(extraOpts.colors || [])]),
      sizes: uniq([...(baseOpts.sizes || []), ...(extraOpts.sizes || [])]),
      heights: uniq([...(baseOpts.heights || []), ...(extraOpts.heights || [])]),
      levels: uniq([...(baseOpts.levels || []), ...(extraOpts.levels || [])]),
    };
  };

  const baseOptions = getOptionsFromJson();

  // 스텐랙 / 하이랙 타입별 extra 옵션만 병합 (버전은 스텐랙 고정 하나라 제외)
  const extraOptions = {
    versions: [],
    colors: [],
    sizes: [],
    heights: [],
    levels: [],
  };

  if (selections.type && EXTRA_OPTIONS[selections.type]) {
    extraOptions.sizes = EXTRA_OPTIONS[selections.type].sizes;
    extraOptions.heights = EXTRA_OPTIONS[selections.type].heights;
    extraOptions.levels = EXTRA_OPTIONS[selections.type].levels;
  }

  const availableOptions = mergeOptions(baseOptions, extraOptions);

  // selections 안에 EXTRA 옵션 중 하나라도 포함되었는지 확인
  const isExtraOptionSelected = () => {
    if (!selections.type) return false;
    const extra = EXTRA_OPTIONS[selections.type];
    if (!extra) return false;
    return (
      extra.sizes.includes(selections.size) ||
      extra.heights.includes(selections.height) ||
      extra.levels.includes(selections.level)
    );
  };

  // 전체 옵션 자유 개방 상태 (disabled 안할 상태)
  const isOptionFullyOpen = isExtraOptionSelected();

  // 선택 조합이 JSON에 있는지 판단
  const isOptionInJson = () => {
    if (!productsData) return false;
    try {
      const { type, version, color, size, height, level } = selections;
      const product = productsData[type];
      if (!product) return false;

      if (type === "스텐랙") {
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
      if (type === "하이랙") {
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

  useEffect(() => {
    if (!productsData) return;
    const {
      type,
      version,
      color,
      size,
      height,
      level,
      quantity,
      applyRate,
      customPrice,
    } = selections;
    const product = productsData[type];
    let unitPrice = 0;

    if (customPrice !== null && customPrice !== undefined) {
      unitPrice = Number(customPrice);
    } else {
      try {
        if (type === "스텐랙" && version && size && height && level) {
          const basePrice = product.기본가격[size][height][level];
          const versionPrice = product.버전[version]?.기본가 || 0;
          unitPrice = basePrice + versionPrice;
        } else if (
          type === "하이랙" &&
          color &&
          size &&
          height &&
          level
        ) {
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

  const addToCart = () => {
    if (currentPrice <= 0) {
      alert("가격을 계산할 수 없는 항목은 추가할 수 없습니다.");
      return;
    }

    const {
      type,
      version,
      color,
      size,
      height,
      level,
      quantity,
      applyRate,
      customPrice,
    } = selections;
    const product = productsData[type];

    let originalUnitPrice = 0;

    if (customPrice !== null && customPrice !== undefined) {
      originalUnitPrice = Number(customPrice);
    } else {
      try {
        if (type === "스텐랙" && version && size && height && level) {
          const basePrice = product.기본가격[size][height][level];
          const versionPrice = product.버전[version]?.기본가 || 0;
          originalUnitPrice = basePrice + versionPrice;
        } else if (
          type === "하이랙" &&
          color &&
          size &&
          height &&
          level
        ) {
          originalUnitPrice = product.기본가격[color][size][height][level];
        }
      } catch {
        originalUnitPrice = 0;
      }
    }

    const displayName = (() => {
      if (type === "스텐랙") {
        return `스텐랙 - ${size}x${height} / ${level} / ${version}`;
      }
      if (type === "하이랙") {
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

    setCart((prev) => [...prev, newItem]);
  };

  const removeFromCart = (id) => setCart((prev) => prev.filter((item) => item.id !== id));
  const clearCart = () => setCart([]);
  const cartTotal = cart.reduce((acc, item) => acc + item.price, 0);

  // 직접 가격 입력란 활성화 조건
  const isCustomPriceMode =
    !isOptionInJson() &&
    selections.type !== "" &&
    ((selections.type === "스텐랙" && selections.version === "기본형 V1") ||
      selections.type === "하이랙") &&
    selections.size !== "" &&
    selections.height !== "" &&
    selections.level !== "";

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
        isOptionFullyOpen, // 추가 옵션 선택 시 완전 개방 여부
        isExtraOptionSelected: isExtraOptionSelected(),
      }}
    >
      {children}
    </ProductContext.Provider>
  );
};

export const useProducts = () => useContext(ProductContext);
