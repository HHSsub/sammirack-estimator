import React, { createContext, useState, useEffect, useContext } from "react";
import { BOMCalculator } from "../utils/BOMCalculator";
import { applyRateToPrice } from "../utils/priceUtils";

const ProductContext = createContext();
const bomCalculator = new BOMCalculator();

const EXTRA_OPTIONS = {
  스텐랙: { sizes: ["50x210"], heights: ["210"], levels: ["2단", "3단", "4단", "5단", "6단"] },
  하이랙: { sizes: ["45x150", "80x108"], heights: ["250"], levels: ["2단", "3단", "4단", "5단", "6단"] },
  파렛트랙: { sizes: [], heights: [], levels: [] } // 필요시 확장
};

export const ProductProvider = ({ children }) => {
  const [productsData, setProductsData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [cart, setCart] = useState([]);

  const [selections, setSelectionsRaw] = useState({
    type: "",
    version: "",
    color: "",
    format: "",  // ⬅ 추가됨
    size: "",
    height: "",
    level: "",
    quantity: 1,
    applyRate: 100,
    customPrice: null,
  });

  const setSelections = (updater) => {
    setSelectionsRaw((prev) => {
      const updated = typeof updater === "function" ? updater(prev) : updater;
      if (updated.type === "스텐랙") return { ...updated, version: "기본형 V1" };
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

  const getOptionsFromJson = () => {
    if (!productsData) {
      return {
        versions: [],
        colors: [],
        formats: [],
        sizes: [],
        heights: [],
        levels: [],
      };
    }

    const { type, color, version, format, size, height } = selections;
    const product = productsData[type];
    let opts = {
      versions: [],
      colors: [],
      formats: [],
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
      if (color && product.기본가격[color]) {
        opts.sizes = Object.keys(product.기본가격[color]);
        if (size && product.기본가격[color][size]) {
          opts.heights = Object.keys(product.기본가격[color][size]);
          if (height && product.기본가격[color][size][height]) {
            opts.levels = Object.keys(product.기본가격[color][size][height]);
          }
        }
      }
    }

    if (type === "파렛트랙" && product) {
      opts.formats = Object.keys(product.기본가격);
      if (format && product.기본가격[format]) {
        opts.sizes = Object.keys(product.기본가격[format]);
        if (size && product.기본가격[format][size]) {
          opts.heights = Object.keys(product.기본가격[format][size]);
        }
      }
    }

    return opts;
  };

  const mergeOptions = (baseOpts, extraOpts) => {
    const uniq = (arr) => [...new Set(arr.filter(Boolean))];
    return {
      versions: uniq([...(baseOpts.versions || []), ...(extraOpts.versions || [])]),
      colors: uniq([...(baseOpts.colors || []), ...(extraOpts.colors || [])]),
      formats: uniq([...(baseOpts.formats || [])]),
      sizes: uniq([...(baseOpts.sizes || []), ...(extraOpts.sizes || [])]),
      heights: uniq([...(baseOpts.heights || []), ...(extraOpts.heights || [])]),
      levels: uniq([...(baseOpts.levels || []), ...(extraOpts.levels || [])]),
    };
  };

  const baseOptions = getOptionsFromJson();
  const extraOptions = { versions: [], colors: [], formats: [], sizes: [], heights: [], levels: [] };

  if (selections.type && EXTRA_OPTIONS[selections.type]) {
    Object.assign(extraOptions, EXTRA_OPTIONS[selections.type]);
  }

  const availableOptions = mergeOptions(baseOptions, extraOptions);

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

  const isOptionFullyOpen = isExtraOptionSelected();

  const isOptionInJson = () => {
    if (!productsData) return false;
    try {
      const { type, version, color, format, size, height, level } = selections;
      const product = productsData[type];
      if (!product) return false;

      if (type === "스텐랙") {
        return (
          version &&
          product.버전 &&
          product.버전[version] &&
          product.기본가격[size] &&
          product.기본가격[size][height] &&
          product.기본가격[size][height][level] !== undefined
        );
      }
      if (type === "하이랙") {
        return (
          color &&
          product.기본가격[color]?.[size]?.[height]?.[level] !== undefined
        );
      }
      if (type === "파렛트랙") {
        return (
          format &&
          product.기본가격[format]?.[size]?.[height] !== undefined
        );
      }
    } catch {
      return false;
    }
  };

  useEffect(() => {
    if (!productsData) return;
    const { type, version, color, format, size, height, level, quantity, applyRate, customPrice } = selections;
    const product = productsData[type];
    let unitPrice = 0;

    if (customPrice !== null) {
      unitPrice = Number(customPrice);
    } else {
      try {
        if (type === "스텐랙") {
          const base = product.기본가격[size]?.[height]?.[level] || 0;
          const ver = product.버전?.[version]?.기본가 || 0;
          unitPrice = base + ver;
        } else if (type === "하이랙") {
          unitPrice = product.기본가격[color]?.[size]?.[height]?.[level] || 0;
        } else if (type === "파렛트랙") {
          unitPrice = product.기본가격[format]?.[size]?.[height] || 0;
        }
      } catch {
        unitPrice = 0;
      }
    }

    const adjusted = applyRateToPrice(unitPrice, applyRate || 100);
    setCurrentPrice(adjusted * (quantity || 1));
    setCurrentBom(bomCalculator.calculateBOM(type, selections, quantity || 1));
  }, [productsData, selections]);

  const addToCart = () => {
    if (currentPrice <= 0) {
      alert("가격을 계산할 수 없는 항목은 추가할 수 없습니다.");
      return;
    }

    const { type, version, color, format, size, height, level, quantity, applyRate, customPrice } = selections;
    const product = productsData[type];
    let unit = 0;

    if (customPrice !== null) {
      unit = Number(customPrice);
    } else {
      try {
        if (type === "스텐랙") {
          const base = product.기본가격[size]?.[height]?.[level] || 0;
          const ver = product.버전?.[version]?.기본가 || 0;
          unit = base + ver;
        } else if (type === "하이랙") {
          unit = product.기본가격[color]?.[size]?.[height]?.[level] || 0;
        } else if (type === "파렛트랙") {
          unit = product.기본가격[format]?.[size]?.[height] || 0;
        }
      } catch {
        unit = 0;
      }
    }

    const name = (() => {
      if (type === "스텐랙") return `스텐랙 - ${size}x${height} / ${level} / ${version}`;
      if (type === "하이랙") return `하이랙 (${color}) - ${size} / ${height} / ${level}단`;
      if (type === "파렛트랙") return `파렛트랙 (${format}) - ${size} / ${height}`;
      return type;
    })();

    const newItem = {
      id: Date.now(),
      selections,
      displayName: name,
      price: currentPrice,
      originalPrice: unit * (quantity || 1),
      unitPrice: applyRateToPrice(unit, applyRate || 100),
      originalUnitPrice: unit,
      applyRate: applyRate || 100,
      bom: currentBom,
    };

    setCart((prev) => [...prev, newItem]);
  };

  const removeFromCart = (id) => setCart((prev) => prev.filter((item) => item.id !== id));
  const clearCart = () => setCart([]);
  const cartTotal = cart.reduce((acc, item) => acc + item.price, 0);

  const isCustomPriceMode =
    !isOptionInJson() &&
    selections.type &&
    (selections.type === "스텐랙" || selections.type === "하이랙" || selections.type === "파렛트랙") &&
    selections.size &&
    selections.height;

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
        isOptionFullyOpen,
        isExtraOptionSelected: isExtraOptionSelected(),
      }}
    >
      {children}
    </ProductContext.Provider>
  );
};

export const useProducts = () => useContext(ProductContext);
